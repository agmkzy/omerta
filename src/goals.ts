// V74: NPC agency. Men who want something, work out how to get it, and keep at it for weeks: save, scout, approach, negotiate,
// raise the rest, close - or hit a wall and change course. Every step that moves money, a business, a man or a rank goes
// through the same functions the player's moves use (transferBusiness, addStake, bizMove, createDebt, recruitProspect...).
// Promotion is never granted here: an advancement goal only works on the things careerTick already looks at.
// V89: plans resolve. Every kind has ways to succeed, fail and be given up, on a timescale of weeks, read from real state (cash,
// standing, the other side's answers, deaths, arrests, a man moving up). How a plan ends is a fact the people around the man hear
// (his boss, his crew, his family), so it travels by gossip like anything else. A plan that needs another man goes through the
// shared asks engine (asks.ts: borrow, lend, join), so men negotiate instead of rolling once; and when the player is plausibly the
// man to ask (his boss, his creditor, kin, a trusted friend, someone who knows the owner), the man comes to the player, rarely.
import { addFact, clamp, createDebt, learn, money, ownerBiz, payDebt, rel } from './core';
import { INVEST_CAP, addStake, bizMove, transferBusiness, trade } from './econ';
import { LADDER, leaveCrew } from './rank';
import { isRunner, members, readiness, recommend } from './career';
import { RECRUIT_COST, recruitProspect } from './orders';
import { addEnc, addFavour } from './encounters';
import { ASKS, askBetween, askTurn, move as askMove, openAsk } from './asks';
import { closeSit, isOpen } from './situ';
import { closeKin, kinOf, kinTie } from './kin';
import { post } from './ledger';
import { Agency, Business, Character, DAY, Debt, Enc, Goal, GoalEnd, GoalKind, Id, Rank, Situation, WEEK, World } from './types';

export const AGENCY = { on: true, audit: false, caps: { perMan: 2, ended: 60 } };
export const KINDS: GoalKind[] = ['wealth', 'business', 'recruit', 'advance', 'debt', 'independence'];
const RESERVE = 150;
// Money an NPC spends on the outside world (improving his own place): it leaves the books like any other business expense. Counted so the audit can tell it from a leak.
let spentOut = 0;
const MAX_OWNED = 3;
const CREW_ROOM: Record<string, number> = { soldier: 3, capo: 8, underboss: 10 };
const first = (c: Character) => c.name.split(' ')[0];
const next = (r: Rank): Rank | undefined => LADDER[LADDER.indexOf(r) + 1];

export function agencyOf(w: World): Agency { return (w.agency ??= { goals: [], ended: [], stats: {}, cool: {}, lastAsk: -1e9 }); }
const bump = (w: World, k: string, n = 1) => { const s = agencyOf(w).stats; s[k] = (s[k] ?? 0) + n; };
export const goalsOf = (w: World, id: Id) => agencyOf(w).goals.filter((g) => g.who === id);
const active = (c: Character) => c.alive && !c.isPlayer && c.rank !== 'civilian';
const free = (w: World, c: Character) => c.jailedUntil <= w.now;

// ---------------------------------------------------------------- money and money-shaped things

export function moneyTotal(w: World): number {
  let t = 0;
  for (const c of Object.values(w.chars)) t += c.cash;
  for (const b of Object.values(w.biz)) t += b.cash;
  for (const f of Object.values(w.fam)) t += f.treasury ?? 0;
  return t;
}
// A transfer between two men. Nothing is created or destroyed.
function give(from: Character, to: Character, amt: number): boolean {
  amt = Math.round(amt);
  if (amt <= 0 || from.cash < amt) return false;
  from.cash -= amt; to.cash += amt;
  return true;
}
export function priceOf(w: World, b: Business): number {
  const t = trade(w, b);
  const weekly = t.weeks >= 2 ? t.profit : b.income - b.expense;
  return Math.max(1200, Math.round((Math.max(0, weekly) * 30 + Math.max(0, b.cash) * 0.5) / 50) * 50);
}
const stakeRoom = (b: Business) => 0.6 - (b.stakes ?? []).reduce((a, s) => a + s.share, 0);
const owned = (w: World, id: Id) => Object.values(w.biz).filter((b) => b.open && b.ownerId === id).length;
const debtsOf = (w: World, id: Id) => w.debts.filter((d) => d.debtor === id && d.status === 'active' && d.balance > 0);

// ---------------------------------------------------------------- starting and ending

export function begin(w: World, c: Character, kind: GoalKind, motive: string, priority: number, o: Partial<Goal> = {}): Goal {
  const a = agencyOf(w);
  const g: Goal = {
    id: 'g' + w.nextId++, who: c.id, kind, motive, priority: Math.round(priority * 100) / 100, stage: 'plan', need: 0, have: c.cash, next: 'work out a plan', progress: 0,
    started: w.now, review: w.now + w.rng.int(1, 2) * WEEK, deadline: w.now + w.rng.int(8, 16) * WEEK, tries: 0, ...o,
  };
  if (c.bossId && g.under === undefined) g.under = c.bossId;
  if (g.was === undefined) g.was = c.rank;
  a.goals.push(g);
  bump(w, 'started.' + kind);
  if (kind === 'advance') bump(w, 'promoPursued');
  return g;
}
function refund(w: World, g: Goal) {
  if (!g.fin) return;
  const c = w.chars[g.who], by = w.chars[g.fin.by];
  if (c && by?.alive) {
    const back = Math.min(c.cash, g.fin.amt);
    give(c, by, back);
    if (back < g.fin.amt) { rel(by, c.id).grudge = clamp(rel(by, c.id).grudge + 0.25); rel(by, c.id).trust = clamp(rel(by, c.id).trust - 0.2); }
  }
  delete g.fin;
}
// V89: what a man does in pursuit of a plan is something other people can see and answer (matters.ts listens here)
type GoalHook = (w: World, g: Goal, c: Character, what: string, o?: { rival?: Id; seen?: boolean; amt?: number; how?: string }) => void;
export function goalHooks(): GoalHook[] { const h = goalHooks as unknown as { l?: GoalHook[] }; return (h.l ??= []); }
const emit = (w: World, g: Goal, c: Character, what: string, o?: { rival?: Id; seen?: boolean; amt?: number; how?: string }) => { for (const h of goalHooks()) h(w, g, c, what, o); };
export function endGoal(w: World, g: Goal, how: 'done' | 'failed' | 'dropped', why: string) {
  const a = agencyOf(w);
  const i = a.goals.indexOf(g);
  if (i < 0) return;
  { const c = w.chars[g.who]; if (c) emit(w, g, c, 'end', { how }); }
  if (how !== 'done') refund(w, g);
  // an ask still open on his behalf has nothing left to be about
  dropSit(w, g);
  announce(w, g, how, why);
  a.goals.splice(i, 1);
  const e: GoalEnd = { id: g.id, who: g.who, kind: g.kind, t: w.now, how, why };
  if (g.target) e.target = g.target;
  a.ended.push(e);
  if (a.ended.length > AGENCY.caps.ended) a.ended.splice(0, a.ended.length - AGENCY.caps.ended);
  bump(w, how + '.' + g.kind);
  // a man who has just failed or given up doesn't start something new straight away
  a.cool[g.who] = w.now + (how === 'done' ? 3 : how === 'failed' ? 8 : 5) * WEEK;
  if (how === 'failed') a.cool[g.who + ':' + g.kind] = w.now + 20 * WEEK;
}
const later = (w: World, g: Goal, weeks: number) => { g.review = w.now + Math.round(weeks * WEEK); };

// ---------------------------------------------------------------- who hears how it ended

// The people who would hear of a man's plans: the man he answers to, his close family, the men who answer to him and the men he
// works beside. (The player among them, if he is one of those.) Bounded, so a big crew does not make a small thing loud.
function audience(w: World, c: Character): Id[] {
  const out: Id[] = [];
  const add = (x?: Character) => { if (x?.alive && x.id !== c.id && !out.includes(x.id)) out.push(x.id); };
  if (c.bossId) add(w.chars[c.bossId]);
  for (const t of kinOf(w, c)) { const x = w.chars[t.id]; if (x && closeKin(w, c, x)) add(x); }
  const crew = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && (x.bossId === c.id || (!!c.bossId && x.bossId === c.bossId)));
  const pl = crew.find((x) => x.isPlayer);
  if (pl) add(pl);
  for (const x of crew.slice(0, 6)) add(x);
  // (and the friends he talks to: a man with no boss, no family and no crew still has somebody who hears his news)
  for (const [id] of Object.entries(c.rels).filter(([, r]) => r.affection >= 0.4 || r.trust >= 0.45).sort((a, b) => (b[1].affection + b[1].trust) - (a[1].affection + a[1].trust)).slice(0, 3)) add(w.chars[id]);
  return out;
}
const nm = (w: World, id?: Id | null) => (id && w.chars[id] ? w.chars[id].name : undefined);
// How it ended, as people tell it. Plain words; no figures. `minor` is small news that stays with the people told.
function endText(w: World, g: Goal, c: Character, how: 'done' | 'failed' | 'dropped', why: string): { text: string; minor: boolean; with?: Id } | undefined {
  if (why === 'he died') return undefined; // his death is the news
  if (why === 'locked up too long') return { text: `${c.name} had plans. They went away with him when they locked him up.`, minor: true };
  const b = g.target ? w.biz[g.target] : undefined;
  switch (g.kind) {
    case 'business': {
      const bn = b?.name ?? 'a place', on = nm(w, g.owner) ?? 'the owner';
      if (how === 'done') return { text: g.mode === 'stake' ? `${c.name} has bought into ${bn}. He wanted a piece of something steady.` : `${c.name} has bought ${bn} off ${on}. He had been after a place of his own for a while.`, minor: false, with: g.owner };
      if (/price|pay more/.test(why)) return { text: `${c.name} wanted ${bn}, but he and ${on} could not agree a price.`, minor: false, with: g.owner };
      if (/sell/.test(why)) return { text: `${c.name} has been going round asking to buy a place. Nobody would sell to him.`, minor: false };
      if (/money|raise|back him|share it/.test(why)) return { text: `${c.name} had his eye on ${bn}, but he could not raise the money.`, minor: false };
      if (/get to the owner/.test(why)) return { text: `${c.name} wanted ${bn} and could not find anyone to put him in front of ${on}.`, minor: true };
      if (/savings/.test(why)) return { text: `${c.name} had money put by for a place of his own. It’s gone now.`, minor: false };
      if (/fell through/.test(why)) return { text: `${c.name}'s deal for ${bn} fell through at the last.`, minor: false, with: g.owner };
      return { text: `${c.name} has stopped looking for a place to buy.`, minor: true };
    }
    case 'wealth':
      if (how === 'done') return { text: `${c.name} has been doing well for himself lately. He has money put by.`, minor: false };
      if (/lost/.test(why)) return { text: `${c.name} has lost what he had put by.`, minor: false };
      return { text: `${c.name} has been trying to get ahead and has nothing to show for it.`, minor: true };
    case 'recruit': {
      const p = nm(w, g.target);
      if (how === 'done') return /full/.test(why) ? undefined : { text: `${c.name} has brought ${p ?? 'a new man'} into his crew.`, minor: false, with: g.target };
      if (how === 'failed') return { text: `${c.name} has been looking for new men. Nobody he wanted would come.`, minor: false };
      return { text: `${c.name} has stopped looking for new men.`, minor: true };
    }
    case 'advance': {
      const boss = nm(w, g.under ?? c.bossId) ?? 'the men above him';
      if (how === 'done') return undefined; // the promotion is announced where it happens
      if (how === 'failed') return { text: `${c.name} asked ${boss} to put his name forward and was turned down. He took it hard.`, minor: false };
      if (/patient|nod/.test(why)) return { text: `${c.name} has been told to be patient about moving up. He is tired of hearing it.`, minor: false };
      return { text: `${c.name} has stopped pushing to move up, for now.`, minor: true };
    }
    case 'debt': {
      const d = w.debts.find((x) => x.id === g.target), cr = nm(w, d?.creditor) ?? 'the man he owed';
      if (how === 'done') return /paid/.test(why) ? { text: `${c.name} has paid off what he owed ${cr}.`, minor: false, with: d?.creditor } : undefined;
      if (how === 'failed') return { text: `${c.name} could not pay what he owed ${cr}.`, minor: false, with: d?.creditor };
      return { text: `${c.name} has stopped trying to get clear of what he owes ${cr}.`, minor: true };
    }
    case 'independence': {
      const boss = nm(w, g.under ?? c.bossId) ?? 'the man above him';
      if (how === 'done') return /better terms|as little/.test(why) ? { text: `${c.name} talked ${boss} into letting him keep more of what he earns.`, minor: false } : undefined;
      if (how === 'failed') return { text: `${c.name} asked ${boss} for better terms and got nowhere.`, minor: false };
      return /moved up|gone/.test(why) ? undefined : { text: `${c.name} has stopped complaining about what he passes up. For now.`, minor: true };
    }
  }
}
function announce(w: World, g: Goal, how: 'done' | 'failed' | 'dropped', why: string) {
  const c = w.chars[g.who];
  if (!c?.alive) return;
  const t = endText(w, g, c, how, why);
  if (!t) return;
  const other = t.with && w.chars[t.with]?.alive ? t.with : undefined;
  addFact(w, { kind: 'rumour', actor: c.id, victim: other, minor: t.minor, story: 'goal:' + g.id, text: t.text, district: c.district }, { witnesses: other ? [other] : [], broadcast: audience(w, c) });
  bump(w, 'told.' + how);
  // a purchase also has its deed: the people around him hear of that too
  if (g.kind === 'business' && how === 'done' && g.target) {
    const f = Object.values(w.facts).filter((x) => x.kind === 'ownership' && x.business === g.target && x.actor === c.id).sort((x, y) => y.t - x.t)[0];
    if (f) for (const id of audience(w, c)) learn(w, id, f, 'public', true);
  }
}

// ---------------------------------------------------------------- asks on a plan's behalf

const sitOf = (w: World, g: Goal): Situation | undefined => (g.sit ? (w.situations ?? []).find((s) => s.id === g.sit) : undefined);
function dropSit(w: World, g: Goal) {
  const s = sitOf(w, g);
  if (s && isOpen(s) && s.terms?.by === g.who) {
    const e = s.ask ? w.enc.find((x) => x.id === s.ask && x.status === 'open') : undefined;
    if (e) e.status = 'lapsed';
    closeSit(w, s, 'dropped', [], 2);
  }
  delete g.sit;
}
// He puts it to someone through the shared engine. Returns false when the engine has no room (or they settled it lately).
function putAsk(w: World, g: Goal, c: Character, ak: string, t: Character, o: { amt?: number; why: string; line?: string; m?: Situation['m'] }): boolean {
  goalAsks();
  const s = openAsk(w, ak, c, t, { amt: o.amt, why: o.why, m: { ...(o.m ?? {}), goal: g.id, ...(t.isPlayer ? { once: 1, ...(o.line ? { why: o.line } : {}) } : {}) } });
  if (!s || s.terms?.by !== c.id || !isOpen(s) || s.m?.goal !== g.id) return false;
  g.sit = s.id;
  bump(w, 'npcask'); bump(w, 'npcask.' + ak);
  if (t.isPlayer) { agencyOf(w).lastAsk = w.now; bump(w, 'ask.shown'); bump(w, 'ask.' + ak); }
  later(w, g, 1 / 7);
  return true;
}
// Waiting on an ask. Returns undefined while it is open; once it is settled, whether the answer was yes and who gave it.
function heard(w: World, g: Goal): { yes: boolean; who?: Id; ak?: string; amt?: number } | undefined {
  let s = sitOf(w, g);
  if (s && isOpen(s)) { askTurn(w, s); if (isOpen(s)) { later(w, g, 1 / 7); return undefined; } }
  s = sitOf(w, g);
  delete g.sit;
  const yes = !!s && (s.out === 'agreed' || s.out === 'gave in');
  const who = s?.terms?.of;
  if (who && !yes) g.asked = [...(g.asked ?? []), who].slice(-6);
  if (w.chars[who ?? '']?.isPlayer) bump(w, yes ? 'ask.accepted' : 'ask.refused');
  return { yes, who, ak: s?.ak, amt: s?.terms?.amt };
}
// Whether the player is someone this man would plausibly come to: family, the man he answers to (or who answers to him), a man in
// the same crew he trusts, or a friend.
function nearPlayer(w: World, c: Character): Character | undefined {
  const p = w.chars[w.playerId ?? ''];
  if (!p?.alive || p.jailedUntil > w.now || p.id === c.id) return undefined;
  const r = c.rels[p.id];
  if ((r?.grudge ?? 0) > 0.3) return undefined;
  if (kinTie(w, c, p) && closeKin(w, c, p)) return p;
  if (c.bossId === p.id || p.bossId === c.id) return p;
  if ((r?.trust ?? 0) >= 0.45) return p;
  if (c.familyId && c.familyId === p.familyId && c.bossId && c.bossId === p.bossId && (r?.trust ?? 0) >= 0.3) return p;
  return undefined;
}

// ---------------------------------------------------------------- choosing what to want

function crewSize(w: World, c: Character) { return Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.rank === 'associate').length; }
function prospectsFor(w: World, c: Character): Character[] {
  const taken = new Set(agencyOf(w).goals.filter((g) => g.kind === 'recruit' && g.target).map((g) => g.target!));
  return Object.values(w.chars).filter((x) => x.alive && x.prospect && x.rank === 'civilian' && !ownerBiz(w, x.id) && !taken.has(x.id));
}
function score(w: World, c: Character, kind: GoalKind): number {
  const t = c.traits, want = c.want?.kind, cool = agencyOf(w).cool[c.id + ':' + kind] ?? 0;
  if (cool > w.now) return 0;
  switch (kind) {
    case 'debt': {
      const ds = debtsOf(w, c.id);
      if (!ds.length) return 0;
      const owe = ds.reduce((a, d) => a + d.balance, 0);
      return 0.25 + Math.min(0.6, owe / Math.max(400, c.cash + 400) * 0.5) + (ds.some((d) => d.missed > 0) ? 0.35 : 0);
    }
    case 'business':
      if (c.cash < 500 || owned(w, c.id) >= MAX_OWNED) return 0;
      return 0.15 + t.greed * 0.4 + t.ambition * 0.25 + (want === 'gamble' || want === 'rich' || want === 'independent' ? 0.25 : 0) + Math.min(0.2, c.cash / 15000);
    case 'recruit':
      if (LADDER.indexOf(c.rank) < 1 || crewSize(w, c) >= (CREW_ROOM[c.rank] ?? 0) || c.cash < RECRUIT_COST + RESERVE || !prospectsFor(w, c).length) return 0;
      return 0.1 + t.ambition * 0.3 + t.sociability * 0.25 + (c.rank === 'capo' ? 0.2 : 0) + (want === 'lieutenant' || want === 'made' ? 0.15 : 0);
    case 'advance': {
      const to = next(c.rank);
      if (!to || to === 'boss' || !c.familyId) return 0;
      return 0.1 + t.ambition * 0.65 + (want === 'made' || want === 'respect' || want === 'lieutenant' ? 0.3 : 0) - t.caution * 0.15;
    }
    case 'wealth':
      return 0.12 + t.greed * 0.5 + (want === 'rich' ? 0.3 : 0) + (c.cash < 400 ? 0.1 : 0);
    case 'independence': {
      const boss = c.bossId ? w.chars[c.bossId] : undefined;
      if (!boss?.alive || c.rank === 'boss') return 0;
      return 0.05 + (want === 'independent' ? 0.5 : 0) + t.ambition * 0.15 + (1 - rel(c, boss.id).trust) * 0.15 + (c.kickRate > 0.15 ? 0.1 : 0);
    }
  }
}
function motiveFor(c: Character, kind: GoalKind): string {
  const t = c.traits;
  switch (kind) {
    case 'debt': return 'he owes money and it is wearing on him';
    case 'business': return t.greed > 0.6 ? 'he wants something that earns while he sleeps' : t.ambition > 0.6 ? 'a place of his own is a step up' : 'he wants something steady of his own';
    case 'recruit': return 'a man with a crew is worth more';
    case 'advance': return c.want?.kind === 'made' ? 'he wants to be made' : t.ambition > 0.65 ? 'he thinks he is owed the next step' : 'he is ready for more';
    case 'wealth': return t.greed > 0.6 ? 'he wants more money, and not slowly' : 'he wants a cushion';
    case 'independence': return 'he is tired of answering for every dollar';
  }
}

function consider(w: World, c: Character) {
  const a = agencyOf(w);
  if ((a.cool[c.id] ?? 0) > w.now || !free(w, c)) return;
  const mine = goalsOf(w, c.id);
  if (mine.length >= AGENCY.caps.perMan) return;
  if (!w.rng.chance(0.4)) return; // most weeks, most men are just getting on with their lives
  let best: GoalKind | null = null, bs = 0.5;
  for (const k of KINDS) {
    if (mine.some((g) => g.kind === k)) continue;
    const s = score(w, c, k) * w.rng.range(0.75, 1.25);
    if (s > bs) { bs = s; best = k; }
  }
  if (!best) { a.cool[c.id] = w.now + w.rng.int(2, 5) * WEEK; return; }
  // a second goal only if it matters nearly as much as the first (two big plans at once is how people fail at both)
  if (mine.length && bs < 0.7) return;
  const g = begin(w, c, best, motiveFor(c, best), clamp(bs, 0, 1.2) / 1.2);
  if (best === 'wealth') { g.need = Math.round(Math.max(c.cash * 1.4, c.cash + 600) / 50) * 50; g.stage = 'build'; g.next = 'put money to work'; }
  else if (best === 'business') { g.stage = 'scout'; g.next = 'find a place worth having'; }
  else if (best === 'recruit') { g.stage = 'spot'; g.next = 'find a man worth bringing on'; }
  else if (best === 'advance') { g.stage = 'build'; g.next = 'get the right people behind him'; g.deadline = w.now + 20 * WEEK; }
  else if (best === 'debt') { const d = debtsOf(w, c.id).sort((x, y) => y.balance - x.balance)[0]; g.target = d.id; g.stage = 'recover'; g.next = 'work the debt down'; g.need = d.balance; }
  else { g.stage = 'income'; g.next = 'get some money of his own'; g.n = 0; g.have = Math.round(c.kickRate * 1000); }
}

export function goalsOnDeath(w: World, d: Character) { for (const g of [...agencyOf(w).goals]) if (g.who === d.id) endGoal(w, g, 'failed', 'he died'); }

// ---------------------------------------------------------------- the weekly run

export function agencyWeek(w: World) {
  if (!AGENCY.on) return;
  goalAsks();
  const a = agencyOf(w);
  // the dead and the gone
  for (const g of [...a.goals]) {
    const c = w.chars[g.who];
    if (!c?.alive) endGoal(w, g, 'failed', 'he died');
  }
  // anything the player was asked and did not answer
  lapses(w);
  for (const c of Object.values(w.chars)) if (active(c)) consider(w, c);
  stepDue(w);
  for (const k of Object.keys(a.cool)) if (a.cool[k] < w.now - 4 * WEEK) delete a.cool[k];
  joinAsk(w);
}
// V89: plans move when they fall due, any day of the week (a man who said "next Tuesday" means Tuesday). Choosing new plans
// stays weekly.
export function agencyDay(w: World) {
  if (!AGENCY.on) return;
  goalAsks();
  const a = agencyOf(w);
  for (const g of [...a.goals]) if (!w.chars[g.who]?.alive) endGoal(w, g, 'failed', 'he died');
  lapses(w);
  stepDue(w);
}
function lapses(w: World) {
  for (const g of [...agencyOf(w).goals]) if (g.ask) {
    const e = w.enc.find((x) => x.id === g.ask);
    if (!e || e.status !== 'open') { const lapsed = e?.status === 'lapsed'; delete g.ask; if (lapsed || !e) answered(w, g, 'lapse'); }
  }
}
function stepDue(w: World) {
  const a = agencyOf(w);
  for (const g of [...a.goals].sort((x, y) => x.review - y.review || (x.id < y.id ? -1 : 1))) {
    if (!a.goals.includes(g) || g.review > w.now) continue;
    const c = w.chars[g.who];
    if (!c?.alive) continue;
    const m0 = AGENCY.audit ? moneyTotal(w) : 0;
    spentOut = 0;
    stepGoal(w, g, c);
    if (AGENCY.audit && moneyTotal(w) !== m0 - spentOut) { bump(w, 'leak'); bump(w, `leak.${g.kind}.${g.stage}.${g.next}`); }
    spentOut = 0;
  }
}

export function stepGoal(w: World, g: Goal, c: Character) {
  if (g.paused && g.paused > w.now) return;
  if (g.ask) return; // waiting on the player
  if (c.jailedUntil > w.now) {
    if (c.jailedUntil - w.now > 30 * DAY) return endGoal(w, g, 'dropped', 'locked up too long');
    g.obstacle = 'locked up'; return later(w, g, 2);
  }
  delete g.obstacle;
  // circumstances change: a man thrown out of the life, or moved up, wants different things now
  if (c.rank === 'civilian') return endGoal(w, g, 'dropped', 'out of the life');
  if (g.was && g.was !== c.rank && g.kind !== 'advance' && g.kind !== 'debt' && LADDER.indexOf(c.rank) > LADDER.indexOf(g.was as Rank)) {
    if (g.kind === 'independence') return endGoal(w, g, 'dropped', 'moved up; the old complaint went with it');
    g.was = c.rank;
  }
  if (w.now > g.deadline && g.kind !== 'debt' && !g.sit) return endGoal(w, g, g.progress > 0.6 ? 'dropped' : 'failed', 'ran out of time');
  switch (g.kind) {
    case 'business': return businessStep(w, g, c);
    case 'wealth': return wealthStep(w, g, c);
    case 'recruit': return recruitStep(w, g, c);
    case 'advance': return advanceStep(w, g, c);
    case 'debt': return debtStep(w, g, c);
    case 'independence': return independenceStep(w, g, c);
  }
}

// ---------------------------------------------------------------- business

function willing(w: World, b: Business, o: Character, mode: 'buy' | 'stake'): number {
  // the lowest fraction of the asking price he would take. Lower when he is in trouble, higher when he is doing well or is proud.
  const owe = debtsOf(w, o.id), missed = owe.some((d) => d.missed > 0);
  let thr = 1.08 - Math.min(0.35, b.distress * 0.1) - (o.jailedUntil > w.now ? 0.12 : 0) - (missed ? 0.12 : 0) + o.traits.greed * 0.1 + o.traits.ambition * 0.05 - (o.cash < 200 ? 0.05 : 0);
  if (mode === 'stake') thr -= 0.12;
  return thr;
}
function sellable(w: World, b: Business, c: Character, g: Goal): boolean {
  const o = w.chars[b.ownerId];
  return b.open && b.kind !== 'casino' && !!o?.alive && !o.isPlayer && o.id !== c.id && !g.no?.includes(b.id) && !(b.managerId === c.id);
}
function reach(w: World, c: Character, o: Character): boolean {
  if (o.familyId && o.familyId === c.familyId) return true;
  const ob = ownerBiz(w, o.id);
  if (ob && (ob.district === c.district || ob.protection?.familyId === c.familyId)) return true; // a made man can walk into a shop in his own streets
  const r = c.rels[o.id];
  return !!r && r.trust >= 0.15;
}
function bridge(w: World, c: Character, o: Character): Character | undefined {
  return Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== o.id && (c.rels[x.id]?.trust ?? 0) >= 0.3 && (x.rels[o.id]?.trust ?? 0) >= 0.3);
}

function businessStep(w: World, g: Goal, c: Character) {
  const b = g.target ? w.biz[g.target] : undefined;
  const t = c.traits;
  const reckless = t.courage > 0.6 && t.caution < 0.4;
  if (g.stage !== 'scout' && (!b || !sellable(w, b, c, g) || b.ownerId !== g.owner)) {
    // the place has gone, changed hands or closed: start the search again
    if (b && b.ownerId === c.id) return endGoal(w, g, 'done', 'he owns it');
    refund(w, g); dropSit(w, g);
    g.no = [...(g.no ?? []), ...(g.target ? [g.target] : [])].slice(-4);
    delete g.target; delete g.owner; g.stage = 'scout'; g.tries++; g.next = 'find another place';
    if (g.tries > 3) return endGoal(w, g, 'dropped', 'nothing came right');
    return later(w, g, 1);
  }
  if (g.stage === 'scout') {
    const maxMul = reckless ? 5 : t.caution > 0.6 ? 2 : 3.2;
    let best: { b: Business; s: number } | undefined;
    for (const x of Object.values(w.biz)) {
      if (!sellable(w, x, c, g)) continue;
      const o = w.chars[x.ownerId], price = priceOf(w, x);
      if (price > Math.max(c.cash, 600) * maxMul) continue;
      if (c.cash < price * 0.45 && stakeRoom(x) < 0.1) continue;
      if (agencyOf(w).goals.filter((q) => q.kind === 'business' && q.target === x.id && q.who !== c.id).length >= 2) continue;
      const yieldW = (Math.max(0, trade(w, x).profit) * 52) / price;
      const s = yieldW + (x.distress >= 2 ? 0.4 : 0) + (debtsOf(w, o.id).some((d) => d.missed > 0) ? 0.3 : 0) + (x.district === c.district ? 0.2 : 0) + (reach(w, c, o) ? 0.2 : 0) + w.rng.range(0, 0.25);
      if (!best || s > best.s) best = { b: x, s };
    }
    if (!best) { g.tries++; if (g.tries >= 2) return endGoal(w, g, 'dropped', 'nothing worth buying'); g.obstacle = 'nothing on the market'; return later(w, g, 2); }
    const price = priceOf(w, best.b);
    g.target = best.b.id; g.owner = best.b.ownerId;
    g.mode = c.cash >= price * 0.45 ? 'buy' : 'stake';
    if (g.mode === 'stake') g.share = Math.max(0.1, Math.min(0.4, stakeRoom(best.b), Math.floor((c.cash * 0.8 / price) * 20) / 20));
    g.need = Math.round(g.mode === 'buy' ? price * (t.caution > 0.55 ? 0.6 : 0.45) : price * g.share!);
    g.have = c.cash; g.stage = 'save'; g.n = 0; g.next = g.mode === 'buy' ? `put together ${money(g.need)} for ${best.b.name}` : `buy ${Math.round(g.share! * 100)}% of ${best.b.name}`;
    return later(w, g, 1);
  }
  if (!b) return;
  const o = w.chars[b.ownerId];
  const price = priceOf(w, b);
  if (g.stage === 'save') {
    g.progress = clamp((c.cash - g.have) / Math.max(1, g.need + RESERVE - g.have), 0, 1);
    if (c.cash >= g.need + RESERVE) { g.stage = 'approach'; g.next = `get to ${first(o)}`; return later(w, g, 0.5); }
    const lastCash = g.offer ?? 0;
    g.n = c.cash <= lastCash ? (g.n ?? 0) + 1 : 0;
    g.offer = c.cash;
    if ((g.n ?? 0) >= 4) {
      // not getting anywhere with the savings; a partner might cover the gap, otherwise he gives up
      if (g.mode === 'buy' && c.cash >= g.need * 0.5) { g.stage = 'approach'; g.next = 'see whether he would take less'; return later(w, g, 0.5); }
      return endGoal(w, g, 'failed', 'could not put the money together');
    }
    if (c.cash < g.have * 0.3) return endGoal(w, g, 'dropped', 'lost his savings');
    return later(w, g, 1 + w.rng.int(0, 2));
  }
  if (g.stage === 'approach') {
    if (!reach(w, c, o)) {
      const br = bridge(w, c, o);
      if (br) { // an introduction through someone both of them trust: a real change in how they stand
        rel(c, o.id).trust = Math.max(rel(c, o.id).trust, 0.2); rel(o, c.id).trust = Math.max(rel(o, c.id).trust, 0.2);
        rel(c, br.id).trust = clamp(rel(c, br.id).trust - 0.02); bump(w, 'inter.intro');
        g.next = `talk to ${first(o)}`; return later(w, g, 1);
      }
      // the player knows the man: he asks the player to put him in front of him
      const p = nearPlayer(w, c);
      if (p && !g.asked?.includes(p.id) && Math.max(o.rels[p.id]?.trust ?? 0, p.rels[o.id]?.trust ?? 0) >= 0.35 && askOk(w)) {
        g.with = p.id;
        const e = surface(w, g, c, 'intro', `${first(c)} wants an introduction`, [`${c.name} has his eye on ${b.name}, and he knows you know ${o.name}.`, `"Put me in front of him. Just an introduction. I'll take it from there, and I won't forget it."`], [{ code: 'yes', label: `Introduce him to ${first(o)}`, hint: 'He’ll owe you. Your name is on the introduction.' }, { code: 'no', label: 'Stay out of it', hint: 'He’ll find another way in, or he won’t.' }]);
        if (e) return;
      }
      g.tries++; g.obstacle = 'no way in';
      if (g.tries >= 3) return endGoal(w, g, 'dropped', 'could not get to the owner');
      return later(w, g, 1.5);
    }
    // sounding him out: is he even thinking of selling?
    bump(w, 'inter.sound');
    const thr = willing(w, b, o, g.mode ?? 'buy');
    const open = b.distress >= 1 || debtsOf(w, o.id).length > 0 || o.jailedUntil > w.now || w.rng.chance(0.2 + o.traits.greed * 0.25 - rel(o, c.id).grudge * 0.3);
    if (!open && thr > 0.9) {
      g.tries++; rel(c, o.id).respect = clamp(rel(c, o.id).respect - 0.01);
      bump(w, 'refused.sound');
      g.no = [...(g.no ?? []), b.id].slice(-4);
      delete g.target; g.stage = 'scout'; g.next = 'look at something else';
      if (g.tries >= 4) return endGoal(w, g, 'failed', 'nobody would sell');
      return later(w, g, 1);
    }
    g.stage = 'negotiate'; g.n = 0; g.next = `make ${first(o)} an offer`;
    return later(w, g, 0.5);
  }
  if (g.stage === 'negotiate') {
    const full = g.mode === 'stake' ? Math.round(price * (g.share ?? 0.2)) : price;
    const style = t.greed > 0.6 ? 0.82 : t.ambition > 0.7 && t.violence > 0.5 ? 0.85 : t.caution > 0.6 ? 0.95 : 0.9;
    let offer = g.offer && g.n ? g.offer : Math.round(full * style / 50) * 50;
    if (c.cash - RESERVE < offer * 0.5) { g.stage = 'save'; g.n = 0; return later(w, g, 1); }
    const thr = willing(w, b, o, g.mode ?? 'buy') + (rel(o, c.id).grudge * 0.2) - rel(o, c.id).trust * 0.08 + w.rng.range(-0.04, 0.04);
    bump(w, 'inter.offer');
    if (offer >= full * thr) {
      g.offer = offer; g.stage = c.cash - RESERVE >= offer ? 'close' : 'finance'; g.next = g.stage === 'close' ? 'settle up' : 'raise the difference';
      return later(w, g, 0.3);
    }
    // turned down: a better offer, a partner, another place - or he walks
    g.tries++; bump(w, 'refused.offer');
    const counter = Math.round(full * thr / 50) * 50;
    const proud = t.ambition > 0.7 && t.violence > 0.6;
    if (g.tries >= 4 || counter > full * 1.2) return endGoal(w, g, 'failed', 'could not agree a price');
    if (proud && counter > offer * 1.12) { rel(c, o.id).grudge = clamp(rel(c, o.id).grudge + 0.1); return endGoal(w, g, 'failed', 'would not be made to pay more'); }
    if (counter <= c.cash - RESERVE || (t.greed < 0.7 && counter <= (c.cash - RESERVE) * 1.4)) {
      g.offer = Math.max(offer, Math.round(counter * 0.98 / 50) * 50); g.n = 1; g.next = 'come back with a better offer';
      return later(w, g, 1);
    }
    g.no = [...(g.no ?? []), b.id].slice(-4); delete g.target; delete g.owner; g.stage = 'scout'; g.next = 'look at something else';
    return later(w, g, 1);
  }
  if (g.stage === 'finance') {
    // an answer to an ask he made for the money
    if (g.sit) { const h = heard(w, g); if (!h) return; if (h.yes) { g.stage = 'close'; g.next = 'settle up'; bump(w, 'loans'); return later(w, g, 0.2); } g.tries++; bump(w, 'refused.finance'); if (g.tries >= 4) return endGoal(w, g, 'failed', 'nobody would back him'); return later(w, g, 0.5); }
    const need = Math.max(0, (g.offer ?? price) - (c.cash - RESERVE));
    if (need <= 0) { g.stage = 'close'; return later(w, g, 0.2); }
    if (t.ambition > 0.7 && t.violence > 0.6 && g.tries > 0) return endGoal(w, g, 'dropped', 'would not share it with anyone');
    const cand = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== o.id && x.jailedUntil <= w.now && x.cash >= need * 2.2 + RESERVE && (x.familyId === c.familyId || (c.rels[x.id]?.trust ?? 0) >= 0.35) && (c.rels[x.id]?.trust ?? 0) >= 0.2 && !g.asked?.includes(x.id))
      .sort((p, q) => (c.rels[q.id]?.trust ?? 0) - (c.rels[p.id]?.trust ?? 0));
    const plr = nearPlayer(w, c);
    if (plr && !g.asked?.includes(plr.id) && askOk(w)) {
      // the player, if he is the man to ask: a partner's share if he outranks him, otherwise a loan between friends
      if (plr.familyId === c.familyId && plr.cash >= need * 2.2 + RESERVE && LADDER.indexOf(plr.rank) > LADDER.indexOf(c.rank)) {
        g.with = plr.id; g.share = need;
        const e = surface(w, g, c, 'finance', `${first(c)} wants backing`, [`${c.name} has found a place. ${b.name}.`, `"I'm ${money(need)} short. Put it up and you get a piece of it. I'll make it worth your while."`], [{ code: 'yes', label: `Put up ${money(need)}`, hint: 'You get a share of the place.' }, { code: 'no', label: 'Tell him no', hint: 'He’ll look elsewhere.' }]);
        if (e) return;
      } else if (plr.bossId === c.id && Math.round(Math.min(need, plr.cash * 0.5) / 50) * 50 >= 200) {
        // the man he answers to brings him in on it: money for a piece
        const amt = Math.round(Math.min(need, plr.cash * 0.5) / 50) * 50;
        g.with = plr.id; g.share = amt;
        const e = surface(w, g, c, 'finance', `${first(c)} offers you a piece`, [`${c.name} is buying ${b.name} off ${o.name}, and he is putting the money together.`, `"You've been good to me. ${money(amt)} and you have a piece of it, a share of what it makes every week. I'm offering it to you before anybody."`], [{ code: 'yes', label: `Put in ${money(amt)}`, hint: 'You get a share of the place, if the deal goes through.' }, { code: 'no', label: 'Say you’ll pass', hint: 'He’ll find the money somewhere else. He may remember who didn’t step up.' }]);
        if (e) return;
      } else if (need <= 2500 && plr.cash >= need + 200) {
        const amt = Math.round(need / 10) * 10;
        if (putAsk(w, g, c, 'borrow', plr, { amt, why: `${c.name} needs money to buy ${b.name}`, line: `${c.name} comes to see you. He has found a place, ${b.name}, and ${o.name} will sell. He is ${money(amt)} short.` })) return;
      }
    }
    const lender = cand[0];
    // a man who is not greedy for a piece of it would rather lend: he asks, and they talk terms (asks.ts)
    if (lender && lender.traits.greed <= 0.6 && need < 6000) {
      bump(w, 'inter.finance');
      if (putAsk(w, g, c, 'borrow', lender, { amt: Math.round(need / 10) * 10, why: `${c.name} needs money to buy ${b.name}` })) return;
    }
    if (!lender) { g.tries++; if (g.tries >= 4) return endGoal(w, g, 'failed', 'could not raise the rest'); g.obstacle = 'nobody to back him'; return later(w, g, 2); }
    bump(w, 'inter.finance');
    const chance = 0.2 + rel(lender, c.id).trust * 0.45 + lender.traits.greed * 0.15 + (lender.rank === 'capo' || lender.rank === 'underboss' ? 0.1 : 0);
    if (!w.rng.chance(chance)) { g.tries++; bump(w, 'refused.finance'); rel(c, lender.id).respect = clamp(rel(c, lender.id).respect - 0.01); if (g.tries >= 4) return endGoal(w, g, 'failed', 'nobody would back him'); return later(w, g, 1); }
    if (need < 6000 && w.rng.chance(0.5)) { // a loan instead of a partner: he owes it back, nobody gets a share
      const amt = Math.round(need / 10) * 10;
      if (give(lender, c, amt)) { createDebt(w, lender.id, c.id, amt, 0.015, `to buy ${b.name}`); bump(w, 'loans'); bump(w, 'investments'); g.stage = 'close'; g.next = 'settle up'; }
      return later(w, g, 0.3);
    }
    return fund(w, g, c, lender, need);
  }
  if (g.stage === 'close') {
    const offer = g.offer ?? price;
    if (c.cash < offer || owned(w, c.id) >= MAX_OWNED && g.mode === 'buy') { g.stage = 'save'; g.n = 0; refund(w, g); return later(w, g, 1); }
    if (g.mode === 'stake' && stakeRoom(b) < (g.share ?? 0.2) - 1e-9) { g.stage = 'scout'; delete g.target; delete g.owner; return later(w, g, 1); }
    give(c, o, offer);
    if (g.mode === 'stake') {
      addStake(w, b, c.id, g.share ?? 0.2, 'bought in');
      addFact(w, { kind: 'ownership', actor: c.id, victim: o.id, business: b.id, text: `${c.name} bought a share of ${b.name} from ${o.name}.`, district: b.district }, { witnesses: [] });
      bump(w, 'stake');
    } else {
      if (!transferBusiness(w, b, c.id, 'bought', `${c.name} bought ${b.name} from ${o.name}.`)) { give(o, c, offer); return endGoal(w, g, 'failed', 'the deal fell through'); }
      if (g.fin) addStake(w, b, g.fin.by, Math.min(0.4, Math.max(0.1, Math.round(g.fin.amt / Math.max(1, offer) * 20) / 20)), 'financed');
      bump(w, 'acq');
    }
    rel(c, o.id).respect = clamp(rel(c, o.id).respect + 0.03);
    delete g.fin; // paid for; the partner's interest is on the business now
    g.progress = 1;
    return endGoal(w, g, 'done', g.mode === 'stake' ? 'bought in' : 'bought it');
  }
}

// A backer pays towards the plan. The money is in the buyer's pocket; if the plan fails it goes back (see refund).
function fund(w: World, g: Goal, c: Character, by: Character, amt: number) {
  amt = Math.round(amt / 10) * 10;
  if (!give(by, c, amt)) return later(w, g, 1);
  g.fin = { by: by.id, amt: (g.fin?.amt ?? 0) + amt };
  rel(c, by.id).trust = clamp(rel(c, by.id).trust + 0.03);
  g.stage = 'close'; g.next = 'settle up';
  bump(w, 'investments');
  return later(w, g, 0.3);
}

// ---------------------------------------------------------------- wealth

function wealthStep(w: World, g: Goal, c: Character) {
  if (g.sit) { const h = heard(w, g); if (!h) return; if (h.ak === 'collect') { if (!h.yes) g.tries++; g.next = h.yes ? 'let it grow' : 'keep the pressure on'; return later(w, g, 1.5); } if (h.yes) { bump(w, 'loans'); g.next = 'collect what he is owed'; } else { g.tries++; bump(w, 'refused.loan'); } return later(w, g, 1.5); }
  g.progress = clamp((c.cash - g.have) / Math.max(1, g.need - g.have), 0, 1);
  if (c.cash >= g.need) return endGoal(w, g, 'done', 'put the money together');
  if (c.cash < g.have * 0.4 && g.have > 300) return endGoal(w, g, 'dropped', 'lost what he had');
  const t = c.traits, b = ownerBiz(w, c.id);
  const opts: { k: string; s: number }[] = [];
  if (b && b.open && (b.invest ?? 0) < INVEST_CAP * 0.8 && c.cash > 450) opts.push({ k: 'invest', s: 0.35 + t.caution * 0.3 + (b.distress === 0 ? 0.15 : -0.3) });
  const chasing = w.debts.filter((d) => d.creditor === c.id && d.status === 'active' && d.missed > 0 && w.chars[d.debtor]?.alive);
  if (chasing.length) opts.push({ k: 'collect', s: 0.5 + t.violence * 0.3 + t.greed * 0.2 });
  if (c.cash > 600) opts.push({ k: 'lend', s: 0.15 + t.greed * 0.45 + t.vice * 0.1 });
  if (!opts.length) { g.obstacle = 'nothing to work with'; g.tries++; if (g.tries >= 5) return endGoal(w, g, 'dropped', 'no way to make it grow'); return later(w, g, 2); }
  const pick = opts.map((o) => ({ ...o, s: Math.max(0.02, o.s) * w.rng.range(0.7, 1.3) })).sort((x, y) => y.s - x.s)[0].k;
  if (pick === 'invest' && b) {
    const spend = Math.round(Math.min(c.cash * 0.3, 600) / 10) * 10;
    if (spend >= 100) {
      c.cash -= spend; spentOut += spend; bizMove(w, b, spend, 'inject', c.id); bizMove(w, b, -spend, 'invest', c.id);
      b.invest = Math.min(INVEST_CAP, (b.invest ?? 0) + spend / Math.max(200, b.income * 6));
      bump(w, 'invest');
      g.next = 'let it pay off';
      return later(w, g, 3);
    }
  } else if (pick === 'collect') {
    const d = chasing.sort((x, y) => y.balance - x.balance)[0], debtor = w.chars[d.debtor];
    bump(w, 'inter.collect');
    // he goes to the man for it: an ask, which the man can pay, haggle over, stall or refuse (and a hard man may take it out of him)
    const due = Math.min(d.balance, d.weeklyPayment * Math.max(1, d.missed + 1));
    if ((!debtor.isPlayer || askOk(w)) && putAsk(w, g, c, 'collect', debtor, { amt: due, why: `${debtor.name} is behind with what he owes ${c.name}`, m: { debt: d.id }, line: debtor.isPlayer ? `${c.name} finds you. You are behind with what you owe him, and he wants it.` : undefined })) { g.next = 'get what he is owed'; return; }
    if (debtor.isPlayer) return later(w, g, 1); // he does not just help himself to the player's money
    const amt = Math.min(d.balance, Math.round(debtor.cash * 0.6));
    if (amt >= 20) { payDebt(w, d, amt); rel(debtor, c.id).grudge = clamp(rel(debtor, c.id).grudge + (t.violence > 0.5 ? 0.08 : 0.03)); g.next = 'keep the pressure on'; }
    else { g.tries++; g.obstacle = 'he has nothing'; }
    return later(w, g, 2);
  } else if (pick === 'lend') {
    const amt = Math.round(Math.min(c.cash * 0.25, 400) / 25) * 25;
    // the player, short of money and close to him: he offers, once
    const p = nearPlayer(w, c);
    if (p && amt >= 100 && p.cash < 150 && !g.asked?.includes(p.id) && !w.debts.some((d) => d.status === 'active' && d.debtor === p.id && d.creditor === c.id) && askOk(w)
      && putAsk(w, g, c, 'lend', p, { amt, why: `${c.name} offered ${p.name} a loan`, line: `${c.name} has heard you’re short. He puts it to you quietly: he can help, at a price.` })) return;
    const need = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.rank !== 'boss' && (x.cash < 150 || (ownerBiz(w, x.id)?.distress ?? 0) >= 2) && !debtsOf(w, x.id).length && (x.familyId === c.familyId || (c.rels[x.id]?.trust ?? 0) > 0.25) && !g.asked?.includes(x.id));
    const m = need.sort((p, q) => p.cash - q.cash)[0];
    if (!m) { g.tries++; return later(w, g, 2); }
    bump(w, 'inter.loan');
    // he offers; the other man weighs it and may haggle or say no (asks.ts)
    if (amt >= 100 && putAsk(w, g, c, 'lend', m, { amt, why: `${c.name} offered ${m.name} a loan` })) return;
    if (amt < 100 || !(m.cash < 80 || w.rng.chance(0.4))) { g.tries++; bump(w, 'refused.loan'); return later(w, g, 2); }
    const shy = t.greed > 0.65 || t.violence > 0.6;
    if (give(c, m, amt)) { createDebt(w, c.id, m.id, amt, shy ? 0.05 : 0.02, 'a loan to tide him over'); bump(w, 'loans'); g.next = 'collect what he is owed'; }
    return later(w, g, 2.5);
  }
  return later(w, g, 2);
}

// ---------------------------------------------------------------- recruiting

function recruitStep(w: World, g: Goal, c: Character) {
  if (g.sit) {
    const h = heard(w, g);
    if (!h) return;
    const p = h.who ? w.chars[h.who] : undefined;
    if (h.yes && p?.bossId === c.id && p.rank === 'associate') { bump(w, 'recruit'); return endGoal(w, g, 'done', `took on ${p.name}`); }
    g.tries++; g.no = [...(g.no ?? []), ...(h.who ? [h.who] : [])].slice(-4); delete g.target; g.stage = 'spot'; g.next = 'find another man'; bump(w, 'refused.recruit');
    if (g.tries >= 4) return endGoal(w, g, 'failed', 'they would not come');
    return later(w, g, 1);
  }
  if (LADDER.indexOf(c.rank) < 1) return endGoal(w, g, 'dropped', 'no standing to bring anyone on');
  if (crewSize(w, c) >= (CREW_ROOM[c.rank] ?? 0)) return endGoal(w, g, 'done', 'his crew is full');
  if (c.cash < RECRUIT_COST + 50) { g.obstacle = 'short of cash'; g.tries++; if (g.tries >= 6) return endGoal(w, g, 'dropped', 'could not afford to'); return later(w, g, 2); }
  if (g.stage === 'spot') {
    const pool = prospectsFor(w, c).sort((a, b) => Number(b.district === c.district) - Number(a.district === c.district) || (a.id < b.id ? -1 : 1));
    const pick = pool.filter((x) => !g.no?.includes(x.id))[0];
    if (!pick) { g.tries++; g.obstacle = 'nobody suitable'; if (g.tries >= 3) return endGoal(w, g, 'dropped', 'nobody worth taking'); return later(w, g, 2); }
    g.target = pick.id; g.stage = 'approach'; g.next = `talk to ${first(pick)}`;
    return later(w, g, 1);
  }
  const p = g.target ? w.chars[g.target] : undefined;
  if (p?.alive && p.bossId === c.id && (p.rank as Rank) === 'associate') { bump(w, 'recruit'); return endGoal(w, g, 'done', `took on ${p.name}`); } // (V89: he said yes to the offer)
  if (!p?.alive || !p.prospect || p.rank !== 'civilian') { // someone else got him, or he's gone
    if (p && p.rank !== 'civilian' && p.bossId !== c.id) { g.tries++; bump(w, 'lostRecruit'); }
    delete g.target; g.stage = 'spot'; g.tries++;
    if (g.tries >= 4) return endGoal(w, g, 'failed', 'lost the man he wanted');
    return later(w, g, 1);
  }
  // a keen young man wants a name behind him
  if (p.traits.ambition > 0.8) {
    const sp = c.bossId ? w.chars[c.bossId] : undefined;
    if (!(sp?.alive && rel(sp, c.id).trust >= 0.35) && c.rank === 'soldier') { g.obstacle = 'nobody to vouch for him'; g.tries++; g.no = [...(g.no ?? []), p.id].slice(-4); delete g.target; g.stage = 'spot'; if (g.tries >= 4) return endGoal(w, g, 'failed', 'could not vouch for his man'); return later(w, g, 2); }
  }
  // V89: the offer is a matter between them (asks.ts 'recruit'), not a single roll: he answers from what he wants and needs, may name
  // his own start, and the recruiter goes on with it in his own way (asks.ts step); the goal waits on how it ends.
  if (askBetween(w, 'recruit', c.id, p.id)) { g.stage = 'asking'; g.next = `wait for ${first(p)}'s answer`; return later(w, g, 0.5); }
  const refused = () => {
    g.tries++; g.no = [...(g.no ?? []), p.id].slice(-4); delete g.target; g.stage = 'spot'; bump(w, 'refused.recruit');
    if (g.tries >= 4) return endGoal(w, g, 'failed', 'they would not come');
    return later(w, g, 1.5);
  };
  if (g.stage === 'asking') return refused(); // it ended, and not with him on the crew (that is handled above)
  if ((w.sitcool?.[`ask:recruit:${c.id}:${p.id}:`] ?? 0) > w.now) return refused(); // he was asked not long ago, and it came to nothing
  const s = openAsk(w, 'recruit', c, p, { amt: RECRUIT_COST, why: `${c.name} offered ${p.name} a place` });
  if (!s) { g.obstacle = 'too much going on'; return later(w, g, 1); } // the street is busy with other matters; he tries again later
  bump(w, 'recruitTry'); bump(w, 'inter.recruit');
  askMove(w, s, 'ask');
  if ((p.rank as Rank) === 'associate' && p.bossId === c.id) { bump(w, 'recruit'); return endGoal(w, g, 'done', `took on ${p.name}`); }
  g.stage = 'asking'; g.next = `wait for ${first(p)}'s answer`;
  return later(w, g, 0.5);
}

// ---------------------------------------------------------------- advancement

function advanceStep(w: World, g: Goal, c: Character) {
  const to = next(c.rank);
  if (!to || (g.target && LADDER.indexOf(c.rank) >= LADDER.indexOf(g.target as Rank))) {
    return endGoal(w, g, 'done', 'got the step he wanted');
  }
  if (!g.target) g.target = (to as unknown) as Id;
  if (LADDER.indexOf(c.rank) >= LADDER.indexOf(g.target as Rank)) return endGoal(w, g, 'done', 'got the step he wanted');
  if (c.familyId == null) return endGoal(w, g, 'dropped', 'no family to rise in');
  // a new man above him is a new start: what the last one said no longer counts
  if (c.bossId && g.under && c.bossId !== g.under) { g.under = c.bossId; g.tries = 0; g.n = 0; g.stage = 'build'; }
  const r = readiness(w, c);
  if (!r) return endGoal(w, g, 'dropped', 'nowhere to go');
  g.progress = clamp(r.score, 0, 1);
  g.next = r.blockers[0] ? r.blockers[0].replace('you haven’t', 'he hasn’t').replace('your', 'his').replace('you’re', 'he’s').replace('you', 'he') : 'wait for the nod';
  const t = c.traits, boss = c.bossId ? w.chars[c.bossId] : undefined, fam = w.fam[c.familyId];
  const sp = r.sponsor;
  // somebody senior has his name: now it is up to the men at the top. He waits, but not for ever.
  if (sp) {
    if (g.stage !== 'nod') { g.stage = 'nod'; g.since = w.now; }
    if (w.now - (g.since ?? w.now) > 5 * WEEK) return endGoal(w, g, 'dropped', 'told to be patient; tired of waiting for the nod');
  } else if (g.stage === 'nod') { g.stage = 'build'; delete g.since; } // his sponsor has gone cold on him
  const opts: { k: string; s: number }[] = [];
  if (!sp && boss?.alive) opts.push({ k: 'ask', s: 0.9 });
  if (c.standing < 55 && c.cash > 300 && boss?.alive && boss.id !== c.id && !boss.isPlayer) opts.push({ k: 'gift', s: 0.35 + (1 - t.greed) * 0.3 });
  if (t.ambition > 0.6 && t.caution < 0.65 && (t.violence > 0.4 || t.greed > 0.5)) opts.push({ k: 'undermine', s: 0.2 + t.ambition * 0.3 + t.violence * 0.2 });
  if (LADDER.indexOf(c.rank) >= 1 && crewSize(w, c) < (CREW_ROOM[c.rank] ?? 0) && goalsOf(w, c.id).length < AGENCY.caps.perMan && prospectsFor(w, c).length && c.cash >= RECRUIT_COST + RESERVE && !goalsOf(w, c.id).some((x) => x.kind === 'recruit'))
    opts.push({ k: 'crew', s: 0.3 + t.sociability * 0.3 });
  if (!opts.length) {
    // nothing he can do but wait: money earned and standing earned are things the world gives him, not things a plan can conjure
    if (!sp) { g.n = (g.n ?? 0) + 1; if (g.n > 6) return endGoal(w, g, 'dropped', r.blockers.some((x) => /no room/.test(x)) ? 'no room at the next level' : 'no way up for now'); }
    return later(w, g, 2);
  }
  const pick = opts.map((o) => ({ ...o, s: o.s * w.rng.range(0.7, 1.3) })).sort((x, y) => y.s - x.s)[0].k;
  if (pick === 'ask' && boss) {
    // he asks the man above him to put his name forward. If that man is the player, he asks the player.
    if (boss.isPlayer) {
      if (askOk(w) && !g.asked?.includes(boss.id)) {
        const e = surface(w, g, c, 'advance', `${first(c)} wants you to put his name forward`, [`${c.name} waits until the others have gone.`, `"I've been with you a while now. I bring in what I'm supposed to and I don't make trouble. I'm asking you to put my name in."`], [{ code: 'yes', label: 'Put his name forward', hint: 'Your name goes with his. If he fails, you answer for it.' }, { code: 'no', label: 'Tell him he isn’t ready', hint: 'He’ll take it hard, and he may look elsewhere.' }]);
        if (e) return;
      }
      g.n = (g.n ?? 0) + 1; if (g.n > 6) return endGoal(w, g, 'dropped', 'no way up for now');
      return later(w, g, 2);
    }
    bump(w, 'inter.ask');
    const rb = rel(boss, c.id);
    const chance = 0.1 + rb.trust * 0.45 + rb.respect * 0.25 + clamp(c.lifetimeKick / 4000, 0, 0.2) - rb.grudge * 0.4 + (LADDER.indexOf(boss.rank) >= 1 ? 0 : -1);
    if (w.rng.chance(chance)) { c.backer = boss.id; rb.trust = clamp(rb.trust + 0.04); g.next = 'wait for the nod'; bump(w, 'backed'); emit(w, g, c, 'backed'); return later(w, g, 2); }
    g.tries++; bump(w, 'refused.ask'); rb.respect = clamp(rb.respect - 0.01); emit(w, g, c, 'refused');
    if (g.tries >= 3) {
      // told no three times: he takes it to heart, and it shows in how he deals with that man from now on
      const rc = rel(c, boss.id); rc.grudge = clamp(rc.grudge + 0.12); rc.trust = clamp(rc.trust - 0.06);
      return endGoal(w, g, 'failed', 'his superior would not back him');
    }
    return later(w, g, 2.5);
  }
  if (pick === 'gift' && boss) {
    const amt = Math.round(Math.min(c.cash * 0.15, 250) / 10) * 10;
    if (amt >= 50 && give(c, boss, amt)) { rel(boss, c.id).trust = clamp(rel(boss, c.id).trust + 0.04); rel(boss, c.id).respect = clamp(rel(boss, c.id).respect + 0.02); c.standing = clamp(c.standing + 0.8, 0, 100); bump(w, 'inter.gift'); g.next = 'keep his name in front of them'; emit(w, g, c, 'gift', { amt }); }
    return later(w, g, 3);
  }
  if (pick === 'undermine') {
    const rivals = fam ? members(w, fam.id).filter((x) => x.id !== c.id && x.rank === c.rank && !x.isPlayer && !isRunner(w, x)) : [];
    const rv = rivals.map((x) => ({ x, r: readiness(w, x)?.score ?? 0 })).sort((a, b) => b.r - a.r)[0]?.x;
    if (!rv || (readiness(w, rv)?.score ?? 0) < g.progress * 0.8) return later(w, g, 2);
    bump(w, 'inter.undermine');
    rv.standing = clamp(rv.standing - 2, 0, 100);
    if (boss?.alive) rel(boss, rv.id).trust = clamp(rel(boss, rv.id).trust - 0.03);
    const seen = w.rng.chance(0.15 + (1 - t.caution) * 0.2);
    if (seen) { // he was seen doing it
      rel(rv, c.id).grudge = clamp(rel(rv, c.id).grudge + 0.25); rel(rv, c.id).trust = clamp(rel(rv, c.id).trust - 0.2);
      if (boss?.alive) rel(boss, c.id).respect = clamp(rel(boss, c.id).respect - 0.04);
      bump(w, 'caught');
    }
    emit(w, g, c, 'undermine', { rival: rv.id, seen });
    return later(w, g, 3);
  }
  if (pick === 'crew') {
    const q = begin(w, c, 'recruit', 'a bigger crew will help him rise', 0.5, { stage: 'spot', next: 'find a man worth bringing on' });
    q.deadline = w.now + 12 * WEEK;
    return later(w, g, 2);
  }
  return later(w, g, 2);
}

// ---------------------------------------------------------------- debts

function debtStep(w: World, g: Goal, c: Character) {
  const d: Debt | undefined = w.debts.find((x) => x.id === g.target);
  if (!d || d.status === 'paid' || d.status === 'void') return endGoal(w, g, 'done', d?.status === 'void' ? 'the debt went away' : 'paid it off');
  if (d.status === 'defaulted') return endGoal(w, g, 'failed', 'could not pay it');
  const cr = w.chars[d.creditor];
  g.progress = clamp(1 - d.balance / Math.max(1, g.need), 0, 1);
  // he went to someone for the money to pay it down
  if (g.sit) { const h = heard(w, g); if (!h) return; if (h.yes) { bump(w, 'loans'); const pay = Math.min(d.balance, h.amt ?? 0, c.cash - 20); if (pay > 0) { payDebt(w, d, pay); bump(w, 'inter.repay'); } g.next = 'keep paying it down'; return later(w, g, 1); } g.tries++; return later(w, g, 1); }
  const t = c.traits, ownBiz = ownerBiz(w, c.id);
  const opts: { k: string; s: number }[] = [];
  const spare = c.cash - RESERVE - d.weeklyPayment;
  if (spare >= 100) opts.push({ k: 'pay', s: 0.5 + t.caution * 0.3 + (1 - t.vice) * 0.1 });
  if (cr?.alive && (d.missed > 0 || c.cash < d.weeklyPayment * 2)) opts.push({ k: 'time', s: 0.6 + (d.missed > 0 ? 0.2 : 0) - t.ambition * 0.15 });
  if (cr?.alive && d.weeklyRate > 0.02 && (g.n ?? 0) < 2) opts.push({ k: 'terms', s: 0.3 + t.caution * 0.2 });
  if (ownBiz && !(ownBiz.stakes ?? []).some((s) => s.share >= 0.3) && stakeRoom(ownBiz) >= 0.15 && ownBiz.open) opts.push({ k: 'sell', s: 0.25 + t.greed * 0.1 + (d.missed > 1 ? 0.3 : 0) });
  if (cr?.alive && t.violence > 0.65 && t.courage > 0.5 && cr.id !== w.playerId && LADDER.indexOf(cr.rank) <= LADDER.indexOf(c.rank)) opts.push({ k: 'lean', s: 0.15 + t.violence * 0.3 + t.courage * 0.1 });
  if (cr?.alive && t.greed > 0.6 && t.caution < 0.4 && d.missed > 0) opts.push({ k: 'stall', s: 0.2 + t.greed * 0.2 });
  // behind, and short: borrow from someone who would lend to him (family, a friend, the player if he is one of those) to pay it down
  const amt = Math.round(Math.min(d.balance, Math.max(d.weeklyPayment * 3, 150), 1500) / 10) * 10;
  const pl = d.missed > 0 && spare < 100 && cr?.id !== w.playerId ? nearPlayer(w, c) : undefined;
  const friend = d.missed > 0 && spare < 100 ? Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== d.creditor && x.jailedUntil <= w.now && x.cash >= amt * 2 + RESERVE && !g.asked?.includes(x.id) && ((c.rels[x.id]?.trust ?? 0) >= 0.35 || (kinTie(w, c, x) && closeKin(w, c, x)))).sort((p, q) => (c.rels[q.id]?.trust ?? 0) - (c.rels[p.id]?.trust ?? 0))[0] : undefined;
  const lender = pl && pl.cash >= amt + 200 && !g.asked?.includes(pl.id) && askOk(w) ? pl : friend;
  if (lender && amt >= 100) opts.push({ k: 'borrow', s: 0.35 + t.caution * 0.2 + (d.missed > 1 ? 0.15 : 0) });
  if (!opts.length) { g.tries++; if (g.tries >= 5) return endGoal(w, g, 'dropped', 'nothing left to try'); return later(w, g, 1.5); }
  const pick = opts.map((o) => ({ ...o, s: o.s * w.rng.range(0.6, 1.4) })).sort((x, y) => y.s - x.s)[0].k;
  if (pick === 'pay') {
    const amt = Math.min(d.balance, Math.round(spare * 0.6 / 10) * 10);
    if (amt > 0) { payDebt(w, d, amt); bump(w, 'inter.repay'); g.next = 'keep paying it down'; }
    return later(w, g, 2);
  }
  if (pick === 'time' && cr) {
    if (cr.isPlayer) {
      if (askOk(w)) {
        const e = surface(w, g, c, 'time', `${first(c)} needs more time`, [`${c.name} finds you after the meeting.`, `"I'm behind on what I owe you. Give me two more weeks. I'll have it."`], [{ code: 'yes', label: 'Give him two weeks', hint: 'He’ll remember it.' }, { code: 'no', label: 'No. Pay what you owe', hint: 'The debt stands.' }]);
        if (e) return;
      }
      return later(w, g, 2);
    }
    bump(w, 'inter.time');
    const chance = 0.2 + rel(cr, c.id).trust * 0.4 + (cr.traits.greed < 0.5 ? 0.15 : -0.05) - rel(cr, c.id).grudge * 0.3 + (d.missed === 0 ? 0.1 : 0);
    if (w.rng.chance(chance)) { d.nextDue += 14 * DAY; d.missed = Math.max(0, d.missed - 1); bump(w, 'extension'); g.next = 'use the time'; rel(c, cr.id).trust = clamp(rel(c, cr.id).trust + 0.02); return later(w, g, 2); }
    g.tries++; bump(w, 'refused.time'); rel(cr, c.id).trust = clamp(rel(cr, c.id).trust - 0.02);
    return later(w, g, 1.5);
  }
  if (pick === 'terms' && cr) {
    g.n = (g.n ?? 0) + 1; bump(w, 'inter.terms');
    if (cr.isPlayer) return later(w, g, 3);
    if (w.rng.chance(0.15 + rel(cr, c.id).trust * 0.35 + (cr.traits.greed < 0.4 ? 0.1 : 0))) { d.weeklyRate = Math.max(0.01, Math.round(d.weeklyRate * 0.7 * 1000) / 1000); bump(w, 'renegotiated'); }
    else bump(w, 'refused.terms');
    return later(w, g, 3);
  }
  if (pick === 'sell' && ownBiz) {
    const sh = 0.15, price = Math.round(priceOf(w, ownBiz) * sh * 0.9 / 10) * 10;
    const buyer = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== d.creditor && x.jailedUntil <= w.now && x.cash >= price * 2 + RESERVE && (x.familyId === c.familyId || (c.rels[x.id]?.trust ?? 0) > 0.3)).sort((p, q) => q.cash - p.cash)[0];
    bump(w, 'inter.sellstake');
    if (!buyer || !w.rng.chance(0.3 + rel(buyer, c.id).trust * 0.3 + buyer.traits.greed * 0.2)) { g.tries++; return later(w, g, 2); }
    if (give(buyer, c, price)) { addStake(w, ownBiz, buyer.id, sh, 'bought in'); bump(w, 'investments'); bump(w, 'stakeSold'); addFact(w, { kind: 'ownership', actor: buyer.id, victim: c.id, business: ownBiz.id, text: `${buyer.name} bought a share of ${ownBiz.name} from ${c.name}.`, district: ownBiz.district }, { witnesses: [] }); g.next = 'use what it raised'; }
    return later(w, g, 1);
  }
  if (pick === 'lean' && cr) {
    bump(w, 'inter.lean');
    if (w.rng.chance(0.2 + t.violence * 0.15 - rel(cr, c.id).trust * 0.1)) { d.status = 'void'; bump(w, 'leaned'); rel(cr, c.id).grudge = clamp(rel(cr, c.id).grudge + 0.4); addFact(w, { kind: 'rumour', actor: c.id, victim: cr.id, minor: true, text: `${cr.name} let ${c.name}'s debt go after a talk. Nobody believes it was generosity.`, district: c.district }, { witnesses: [cr.id] }); return endGoal(w, g, 'done', 'frightened the debt away'); }
    rel(cr, c.id).grudge = clamp(rel(cr, c.id).grudge + 0.3); rel(cr, c.id).respect = clamp(rel(cr, c.id).respect - 0.1); g.tries++;
    return later(w, g, 2);
  }
  if (pick === 'borrow' && lender) {
    bump(w, 'inter.borrow');
    const line = lender.isPlayer ? `${c.name} comes to you with his hat in his hand. He is behind with ${cr?.name ?? 'a man he owes'}, and that is not a man to be behind with.` : undefined;
    if (putAsk(w, g, c, 'borrow', lender, { amt, why: `${c.name} needs money to pay ${cr?.name ?? 'a debt'}`, line })) return;
    g.tries++; return later(w, g, 1);
  }
  if (pick === 'stall' && cr) { rel(cr, c.id).trust = clamp(rel(cr, c.id).trust - 0.05); bump(w, 'stalled'); g.tries++; return later(w, g, 2); }
  return later(w, g, 2);
}

// ---------------------------------------------------------------- independence

function independenceStep(w: World, g: Goal, c: Character) {
  const boss = c.bossId ? w.chars[c.bossId] : undefined;
  if (!boss?.alive) return endGoal(w, g, 'dropped', 'the man above him is gone');
  if (g.under && boss.id !== g.under) return endGoal(w, g, 'dropped', 'a new man above him; it starts again with him');
  const t = c.traits;
  const b = ownerBiz(w, c.id);
  const floor = Math.max(0.05, 0.2 - 0.1);
  if (g.stage === 'income') {
    g.progress = 0.2;
    if (b || c.cash >= 1500 || stakesHeld(w, c.id)) { g.stage = 'ties'; g.n = 0; g.next = 'make friends outside the crew'; return later(w, g, 1); }
    // no money of his own: that is a different goal, so he works at it by chasing a business
    if (!goalsOf(w, c.id).some((x) => x.kind === 'business') && goalsOf(w, c.id).length < AGENCY.caps.perMan && c.cash >= 500 && owned(w, c.id) < MAX_OWNED) begin(w, c, 'business', 'a place of his own would free him', 0.6, { stage: 'scout', next: 'find a place worth having' });
    g.tries++;
    if (g.tries >= 4) return endGoal(w, g, 'dropped', 'no money of his own');
    return later(w, g, 2);
  }
  if (g.stage === 'ties') {
    const out = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== boss.id && x.familyId !== c.familyId && (x.rank !== 'civilian' || ownerBiz(w, x.id)) && (c.rels[x.id]?.trust ?? 0) < 0.4);
    const x = out[Math.floor(w.rng.next() * out.length)];
    bump(w, 'inter.tie');
    if (x && w.rng.chance(0.3 + t.sociability * 0.4)) { const r1 = rel(c, x.id), r2 = rel(x, c.id); r1.trust = clamp(r1.trust + 0.15); r2.trust = clamp(r2.trust + 0.12); r1.lastMet = w.now; r2.lastMet = w.now; g.n = (g.n ?? 0) + 1; }
    g.progress = 0.2 + 0.2 * Math.min(3, g.n ?? 0) / 3;
    if ((g.n ?? 0) >= 3) { g.stage = 'terms'; g.next = 'ask for better terms'; g.tries = 0; }
    else { g.tries++; if (g.tries >= 6) return endGoal(w, g, 'dropped', 'could not make the contacts'); }
    return later(w, g, 1.5);
  }
  if (g.stage === 'terms') {
    g.progress = 0.7;
    const rb = rel(boss, c.id);
    if (c.kickRate <= floor + 0.001) return endGoal(w, g, 'done', 'passes up as little as he can');
    // the man he passes his money up to is the player: he asks him
    if (boss.isPlayer) {
      if (askOk(w) && !g.asked?.includes(boss.id)) {
        const e = surface(w, g, c, 'terms', `${first(c)} wants to keep more`, [`${c.name} has something on his mind, and he gets to it.`, `"I bring in more than I used to, and I pass up the same as when I started. I think I've earned a better cut. I'm asking you, man to man."`], [{ code: 'yes', label: 'Give him a better cut', hint: 'Less comes up to you every week. He’ll be grateful.' }, { code: 'no', label: 'Tell him the cut stays', hint: 'He’ll swallow it, or he won’t.' }]);
        if (e) return;
      }
      g.tries++;
      if (g.asked?.includes(boss.id) && t.ambition > 0.7 && (b || c.cash >= 1500) && w.rng.chance(0.3)) return walkAway(w, g, c, boss);
      if (g.tries >= 3) return endGoal(w, g, 'failed', 'his superior would not move');
      return later(w, g, 2);
    }
    bump(w, 'inter.terms');
    const chance = 0.1 + rb.trust * 0.35 + rb.respect * 0.25 + (b ? 0.1 : 0) - rb.grudge * 0.3;
    if (!boss.isPlayer && w.rng.chance(chance)) { c.kickRate = Math.max(floor, c.kickRate - 0.03); bump(w, 'renegotiated'); return endGoal(w, g, 'done', 'got better terms'); }
    g.tries++; bump(w, 'refused.terms'); rb.respect = clamp(rb.respect - 0.01);
    if (g.tries >= 3 && t.ambition > 0.7 && (b || c.cash >= 1500) && w.rng.chance(0.3)) {
      return walkAway(w, g, c, boss);
    }
    if (g.tries >= 4) return endGoal(w, g, 'failed', 'his superior would not move');
    return later(w, g, 2);
  }
}
// he decides he doesn't need that man: he moves under someone else, keeping his rank. People hear of it.
function walkAway(w: World, g: Goal, c: Character, boss: Character) {
  leaveCrew(w, c);
  addFact(w, { kind: 'rumour', actor: c.id, victim: boss.id, text: `${c.name} has stopped answering to ${boss.name}.`, district: c.district }, { witnesses: [boss.id], broadcast: audience(w, c) });
  if (boss.isPlayer) rel(c, boss.id).grudge = clamp(rel(c, boss.id).grudge + 0.1);
  else rel(boss, c.id).grudge = clamp(rel(boss, c.id).grudge + 0.3);
  bump(w, 'broke');
  return endGoal(w, g, 'done', 'walked away from his superior');
}
const stakesHeld = (w: World, id: Id) => Object.values(w.biz).some((b) => (b.stakes ?? []).some((s) => s.holder === id && s.share >= 0.15));

// ---------------------------------------------------------------- the player, when it is plausible

// Approaches are rare: at most one open at a time (from a plan, or a plan's ask), and a week at least since the last.
export const ASK_GAP = 7 * DAY;
const askOk = (w: World) => {
  const a = agencyOf(w);
  if (w.now - a.lastAsk < ASK_GAP) return false;
  if (w.enc.some((e) => e.status === 'open' && e.data?.what === 'goal')) return false;
  const sit = new Set(w.enc.filter((e) => e.status === 'open' && e.kind === 'ask').map((e) => String(e.data?.sit)));
  return !(w.situations ?? []).some((s) => sit.has(s.id) && s.m?.goal);
};
function surface(w: World, g: Goal, c: Character, t: string, title: string, lines: string[], opts: Enc['opts']): Enc | undefined {
  const p = w.chars[w.playerId ?? ''];
  if (!p?.alive || !askOk(w)) return undefined;
  const e = addEnc(w, { kind: 'crew', from: c.id, title, days: 7, lines, opts, data: { what: 'goal', g: g.id, t } });
  g.ask = e.id; agencyOf(w).lastAsk = w.now; bump(w, 'ask.shown'); bump(w, 'ask.' + t);
  return e;
}
// The player has answered (or has not): apply it. `lapse` is no answer, which is a refusal for everyone but the man's pride.
// Every answer leaves something the world reads later: a debt, a share, a sponsor, a cut, a favour owed, how the man feels.
function answered(w: World, g: Goal, code: string): string[] {
  const c = w.chars[g.who], p = w.chars[w.playerId ?? ''];
  const lines: string[] = [];
  if (!c?.alive || !p) return lines;
  const yes = code === 'yes';
  bump(w, yes ? 'ask.accepted' : 'ask.refused');
  const r = rel(c, p.id);
  if (!yes) g.asked = [...(g.asked ?? []), p.id].slice(-6); // he does not come back to the player on this plan
  if (g.stage === 'finance' && g.with === p.id) {
    const amt = g.share ?? 0;
    if (yes && p.cash >= amt && amt > 0) { p.cash -= amt; c.cash += amt; post(w, { from: p.id, to: c.id, amt, flow: 'stake', note: `backing for ${c.name}'s purchase` }); g.fin = { by: p.id, amt }; g.stage = 'close'; g.next = 'settle up'; bump(w, 'investments'); r.trust = clamp(r.trust + 0.1); lines.push(`${first(c)} shakes your hand. "You won't regret it."`); }
    else if (yes) lines.push('You haven’t got it to give.');
    else { g.tries++; r.trust = clamp(r.trust - 0.02); lines.push(`${first(c)} nods. "I'll find it somewhere else."`); }
    delete g.with;
    later(w, g, 0.5);
    return lines;
  }
  if (g.kind === 'business' && g.with === p.id) { // an introduction
    const b = g.target ? w.biz[g.target] : undefined, o = g.owner ? w.chars[g.owner] : undefined;
    delete g.with;
    if (yes && o?.alive) {
      const ro = rel(o, c.id); ro.trust = Math.max(ro.trust, 0.25); ro.lastMet = w.now; rel(c, o.id).trust = Math.max(rel(c, o.id).trust, 0.25);
      rel(o, p.id).trust = clamp(rel(o, p.id).trust - 0.02); // a little of what he thinks of you went into it
      addFavour(w, p.id, c.id, 1, `introduced him to ${o.name}`);
      r.trust = clamp(r.trust + 0.06);
      addFact(w, { kind: 'rumour', actor: p.id, victim: c.id, minor: true, text: `${p.name} introduced ${c.name} to ${o.name}${b ? ` about ${b.name}` : ''}.`, district: o.district }, { witnesses: [c.id, o.id] });
      g.next = `talk to ${first(o)}`;
      lines.push(`You take ${first(c)} round and make the introduction. ${first(o)} hears him out. ${first(c)} owes you for it, and he knows it.`);
      later(w, g, 0.3);
      return lines;
    }
    g.tries++; r.trust = clamp(r.trust - 0.02);
    lines.push(`${first(c)} shrugs. "I'll find another way in."`);
    later(w, g, 1);
    return lines;
  }
  if (g.kind === 'debt') {
    const d = w.debts.find((x) => x.id === g.target);
    if (yes && d) { d.nextDue += 14 * DAY; d.missed = Math.max(0, d.missed - 1); r.trust = clamp(r.trust + 0.08); bump(w, 'extension'); addFavour(w, p.id, c.id, 1, 'gave him time on what he owed'); lines.push(`${first(c)} lets out a breath. "Two weeks. I won't forget it."`); }
    else { r.trust = clamp(r.trust - 0.03); g.tries++; lines.push(`${first(c)} takes it without a word. He's still on the hook.`); }
    later(w, g, 2);
    return lines;
  }
  if (g.kind === 'advance') {
    if (yes) {
      bump(w, 'backed');
      if (c.bossId === p.id && LADDER.indexOf(p.rank) >= 1) lines.push(...recommend(w, p, c));
      else { c.backer = p.id; r.trust = clamp(r.trust + 0.1); r.affection = clamp(r.affection + 0.05); }
      rel(p, c.id).trust = Math.max(rel(p, c.id).trust, 0.35); // you have put your name on him: the rule reads that as your trust
      lines.push(`"You won't regret it," ${first(c)} says.`);
      later(w, g, 1);
    } else {
      g.tries++; r.respect = clamp(r.respect - 0.03); r.grudge = clamp(r.grudge + 0.06);
      lines.push(code === 'lapse' ? `${first(c)} waited for an answer that didn't come. He has stopped waiting.` : `${first(c)} nods slowly. "I'll keep earning it."`);
      // turned down by the man above him: an ambitious man starts thinking about the terms he works under
      if (c.traits.ambition > 0.6) (agencyOf(w).cool[c.id + ':advance'] = w.now + 10 * WEEK);
      endGoal(w, g, 'failed', 'his superior would not back him');
    }
    return lines;
  }
  if (g.kind === 'independence') {
    if (yes) {
      const floor = 0.1, was = c.kickRate;
      c.kickRate = Math.max(floor, Math.round((c.kickRate - 0.03) * 1000) / 1000);
      r.trust = clamp(r.trust + 0.08); r.affection = clamp(r.affection + 0.04);
      bump(w, 'renegotiated');
      lines.push(was > c.kickRate ? `${first(c)} nods. "That's fair. You'll see it was worth it." Less of what he makes will come up to you from now on.` : `${first(c)} nods. He was already passing up as little as a man can.`);
      endGoal(w, g, 'done', 'got better terms');
    } else {
      g.tries++; r.grudge = clamp(r.grudge + 0.06); r.trust = clamp(r.trust - 0.03);
      lines.push(`${first(c)} hears it. "Sure. The cut stays." He doesn't look at you when he says it.`);
      later(w, g, 2);
    }
    return lines;
  }
  return lines;
}
export function goalChoose(w: World, p: Character, e: Enc, code: string): string[] | undefined {
  if (e.data?.what !== 'goal') return undefined;
  const g = agencyOf(w).goals.find((x) => x.id === e.data?.g);
  e.status = 'done';
  if (!g) return ['It has gone quiet.'];
  delete g.ask;
  return answered(w, g, code);
}

// A keen young man asks to run with the player. Rare, and only when the player could really take him on.
function joinAsk(w: World) {
  const p = w.chars[w.playerId ?? ''];
  if (!p?.alive || LADDER.indexOf(p.rank) < 1 || !askOk(w) || p.jailedUntil > w.now) return;
  if (crewSize(w, p) >= (CREW_ROOM[p.rank] ?? 0) || p.cash < RECRUIT_COST + 100) return;
  if ((p.cooldown.joinAsk ?? 0) > w.now) return;
  p.cooldown.joinAsk = w.now + 30 * DAY;
  if (!w.rng.chance(0.3)) return;
  const taken = new Set(agencyOf(w).goals.filter((g) => g.kind === 'recruit' && g.target).map((g) => g.target!));
  const c = Object.values(w.chars).filter((x) => x.alive && x.prospect && x.rank === 'civilian' && !ownerBiz(w, x.id) && !taken.has(x.id) && x.traits.ambition > 0.5 && x.district === p.district)[0];
  if (!c) return;
  const e = addEnc(w, { kind: 'crew', from: c.id, title: `${first(c)} wants to run with you`, days: 7, lines: [`${c.name} has been hanging around.`, `"I hear you're looking for good men. I'm one. Give me a chance."`], opts: [{ code: 'yes', label: `Take him on (${money(RECRUIT_COST)})`, hint: 'He will answer to you, and what he does goes on your name.' }, { code: 'no', label: 'Tell him no', hint: 'He’ll find someone else.' }], data: { what: 'goal', t: 'join', g: '' } });
  agencyOf(w).lastAsk = w.now; bump(w, 'ask.shown'); void e;
}
export function joinChoose(w: World, p: Character, e: Enc, code: string): string[] | undefined {
  if (e.data?.what !== 'goal' || e.data?.t !== 'join') return undefined;
  e.status = 'done';
  const c = e.from ? w.chars[e.from] : undefined;
  if (!c?.alive) return ['He is gone.'];
  if (code !== 'yes') { bump(w, 'ask.refused'); return [`${first(c)} shrugs. He'll try someone else.`]; }
  bump(w, 'ask.accepted'); bump(w, 'recruit');
  return recruitProspect(w, p, c);
}

// ---------------------------------------------------------------- the asks a plan makes
// Bringing a young man on is an ask like any other (asks.ts): he is offered a place, weighs it from who he is and who is asking,
// may want time, may say no; the man asking can come back with an argument or a word from someone senior, or let it go.
// Registered by engine.ts once everything has loaded, and again (harmlessly) whenever a plan is about to use it.
export function goalAsks() {
  if (ASKS.join) return;
  ASKS.join = {
    id: 'join', sev: 0.1, roles: ['recruiter', 'prospect'], cool: 6,
    moves: ['ask', 'persuade', 'senior', 'wait', 'drop'],
    title: (w, s) => { const a = w.chars[s.terms?.by ?? ''], t = w.chars[s.terms?.of ?? '']; return a && t ? `${first(a)} wants ${first(t)} in his crew` : 'An offer of work'; },
    valid: (w, s) => {
      const a = w.chars[s.terms?.by ?? ''], t = w.chars[s.terms?.of ?? ''];
      return !!a?.alive && !!t?.alive && !!t.prospect && t.rank === 'civilian' && LADDER.indexOf(a.rank) >= 1 && a.cash >= RECRUIT_COST && crewSize(w, a) < (CREW_ROOM[a.rank] ?? 0);
    },
    // what running with this man is worth to him: his ambition against his caution, the man's name, and whether he needs the money
    lean: (w, s, a, t) => 0.1 + t.traits.ambition * 0.35 - t.traits.caution * 0.25 + a.traits.sociability * 0.15 + (a.rank === 'capo' ? 0.1 : 0) + clamp(a.standing / 100, 0, 1) * 0.15 + (t.cash < 150 ? 0.1 : 0),
    yes: (w, s, a, t) => { recruitProspect(w, a, t); return `${t.name} will run with ${a.name}.`; },
    phrase: {
      ask: () => '"There’s a place for a man like you with my people. Steady money, and people who look after their own."',
      yes: 'He shakes on it.', no: '"It’s not for me."', counter: '', stall: '"Let me think about it."',
    },
  };
}

// ---------------------------------------------------------------- inspection

export function agencyIssues(w: World): string[] {
  const out: string[] = [];
  const a = w.agency;
  if (!a) return out;
  const seen = new Set<string>();
  const per: Record<Id, number> = {};
  for (const g of a.goals) {
    const c = w.chars[g.who];
    if (!c) out.push(`goal ${g.id}: no such man ${g.who}`);
    else if (!c.alive) out.push(`goal ${g.id}: ${c.name} is dead`);
    if (c?.isPlayer) out.push(`goal ${g.id}: belongs to the player`);
    per[g.who] = (per[g.who] ?? 0) + 1;
    const k = g.who + g.kind;
    if (seen.has(k)) out.push(`goal ${g.id}: ${c?.name} has two ${g.kind} goals`);
    seen.add(k);
    if (g.kind === 'business' && g.target && g.stage !== 'scout' && !w.biz[g.target]) out.push(`goal ${g.id}: business ${g.target} does not exist`);
    if (g.kind === 'debt' && g.target && !w.debts.some((d) => d.id === g.target)) out.push(`goal ${g.id}: debt ${g.target} does not exist`);
    if (g.fin && !w.chars[g.fin.by]) out.push(`goal ${g.id}: backer ${g.fin.by} does not exist`);
    if (g.fin && g.kind !== 'business') out.push(`goal ${g.id}: financing on a ${g.kind} goal`);
    if (g.ask && !w.enc.some((e) => e.id === g.ask)) out.push(`goal ${g.id}: waiting on a missing question`);
  }
  for (const [id, n] of Object.entries(per)) if (n > AGENCY.caps.perMan) out.push(`${id} has ${n} goals`);
  if (a.ended.length > AGENCY.caps.ended) out.push(`ended goals ring is ${a.ended.length}`);
  return out;
}

// How the money and the businesses are spread. For watching the economy, not for the game to use.
export function wealthReport(w: World) {
  const npcs = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian');
  const cash = npcs.map((c) => c.cash).sort((x, y) => x - y);
  const sum = cash.reduce((x, y) => x + y, 0);
  let gini = 0;
  if (sum > 0) { let cum = 0; for (let i = 0; i < cash.length; i++) { cum += cash[i]; gini += (i + 1) * cash[i]; } gini = (2 * gini) / (cash.length * sum) - (cash.length + 1) / cash.length; }
  const open = Object.values(w.biz).filter((b) => b.open);
  const by: Record<Id, number> = {};
  for (const b of open) by[b.ownerId] = (by[b.ownerId] ?? 0) + 1;
  const counts = Object.values(by).sort((x, y) => y - x);
  return {
    npcs: npcs.length, cashTotal: sum, cashMedian: cash[Math.floor(cash.length / 2)] ?? 0, gini: Math.round(gini * 100) / 100,
    businesses: open.length, owners: counts.length, topOwner: counts[0] ?? 0, distressed: open.filter((b) => b.distress >= 2).length,
    debts: w.debts.filter((d) => d.status === 'active').length, debtTotal: w.debts.filter((d) => d.status === 'active').reduce((x, d) => x + d.balance, 0),
    stakes: open.reduce((x, b) => x + (b.stakes?.length ?? 0), 0),
  };
}
