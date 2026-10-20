// V74: NPC agency. Men who want something, work out how to get it, and keep at it for weeks: save, scout, approach, negotiate,
// raise the rest, close - or hit a wall and change course. Every step that moves money, a business, a man or a rank goes
// through the same functions the player's moves use (transferBusiness, addStake, bizMove, createDebt, recruitProspect...).
// Promotion is never granted here: an advancement goal only works on the things careerTick already looks at.
import { addFact, clamp, createDebt, money, ownerBiz, payDebt, rel } from './core';
import { INVEST_CAP, addStake, bizMove, transferBusiness, trade } from './econ';
import { LADDER, leaveCrew } from './rank';
import { isRunner, members, readiness } from './career';
import { RECRUIT_COST, recruitProspect } from './orders';
import { addEnc } from './encounters';
import { Agency, Business, Character, DAY, Debt, Enc, Goal, GoalEnd, GoalKind, Id, Rank, WEEK, World } from './types';

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
    started: w.now, review: w.now + w.rng.int(1, 2) * WEEK, deadline: w.now + w.rng.int(16, 40) * WEEK, tries: 0, ...o,
  };
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
  else if (best === 'advance') { g.stage = 'build'; g.next = 'get the right people behind him'; g.deadline = w.now + 52 * WEEK; }
  else if (best === 'debt') { const d = debtsOf(w, c.id).sort((x, y) => y.balance - x.balance)[0]; g.target = d.id; g.stage = 'recover'; g.next = 'work the debt down'; g.need = d.balance; }
  else { g.stage = 'income'; g.next = 'get some money of his own'; g.n = 0; g.have = Math.round(c.kickRate * 1000); }
}

export function goalsOnDeath(w: World, d: Character) { for (const g of [...agencyOf(w).goals]) if (g.who === d.id) endGoal(w, g, 'failed', 'he died'); }

// ---------------------------------------------------------------- the weekly run

export function agencyWeek(w: World) {
  if (!AGENCY.on) return;
  const a = agencyOf(w);
  const before = AGENCY.audit ? moneyTotal(w) : 0;
  // the dead and the gone
  for (const g of [...a.goals]) {
    const c = w.chars[g.who];
    if (!c?.alive) endGoal(w, g, 'failed', 'he died');
  }
  // anything the player was asked and did not answer
  for (const g of [...a.goals]) if (g.ask) {
    const e = w.enc.find((x) => x.id === g.ask);
    if (!e || e.status !== 'open') { const lapsed = e?.status === 'lapsed'; delete g.ask; if (lapsed || !e) answered(w, g, 'lapse'); }
  }
  for (const c of Object.values(w.chars)) if (active(c)) consider(w, c);
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
  for (const k of Object.keys(a.cool)) if (a.cool[k] < w.now - 4 * WEEK) delete a.cool[k];
  joinAsk(w);
  
}

export function stepGoal(w: World, g: Goal, c: Character) {
  if (g.paused && g.paused > w.now) return;
  if (g.ask) return; // waiting on the player
  if (c.jailedUntil > w.now) {
    if (c.jailedUntil - w.now > 30 * DAY) return endGoal(w, g, 'dropped', 'locked up too long');
    g.obstacle = 'locked up'; return later(w, g, 2);
  }
  delete g.obstacle;
  if (w.now > g.deadline && g.kind !== 'debt') return endGoal(w, g, g.progress > 0.6 ? 'dropped' : 'failed', 'ran out of time');
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
    refund(w, g);
    g.no = [...(g.no ?? []), ...(g.target ? [g.target] : [])].slice(-4);
    delete g.target; delete g.owner; g.stage = 'scout'; g.tries++; g.next = 'find another place';
    if (g.tries > 4) return endGoal(w, g, 'dropped', 'nothing came right');
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
    if (!best) { g.tries++; if (g.tries >= 3) return endGoal(w, g, 'dropped', 'nothing worth buying'); g.obstacle = 'nothing on the market'; return later(w, g, 3); }
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
    if ((g.n ?? 0) >= 6) {
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
      g.tries++; g.obstacle = 'no way in';
      if (g.tries >= 3) return endGoal(w, g, 'dropped', 'could not get to the owner');
      return later(w, g, 2);
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
    const need = Math.max(0, (g.offer ?? price) - (c.cash - RESERVE));
    if (need <= 0) { g.stage = 'close'; return later(w, g, 0.2); }
    if (t.ambition > 0.7 && t.violence > 0.6 && g.tries > 0) return endGoal(w, g, 'dropped', 'would not share it with anyone');
    const cand = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== o.id && x.jailedUntil <= w.now && x.cash >= need * 2.2 + RESERVE && (x.familyId === c.familyId || (c.rels[x.id]?.trust ?? 0) >= 0.35) && (c.rels[x.id]?.trust ?? 0) >= 0.2)
      .sort((p, q) => (c.rels[q.id]?.trust ?? 0) - (c.rels[p.id]?.trust ?? 0));
    const plr = w.chars[w.playerId ?? ''];
    if (plr?.alive && plr.familyId === c.familyId && plr.cash >= need * 2.2 + RESERVE && (c.rels[plr.id]?.trust ?? 0) >= 0.3 && askOk(w) && LADDER.indexOf(plr.rank) > LADDER.indexOf(c.rank)) {
      g.with = plr.id; g.share = need;
      const e = surface(w, g, c, 'finance', `${first(c)} wants backing`, [`${c.name} has found a place. ${b.name}.`, `"I'm ${money(need)} short. Put it up and you get a piece of it. I'll make it worth your while."`], [{ code: 'yes', label: `Put up ${money(need)}`, hint: 'You get a share of the place.' }, { code: 'no', label: 'Tell him no', hint: 'He’ll look elsewhere.' }]);
      if (e) return;
    }
    const lender = cand[0];
    if (!lender) { g.tries++; if (g.tries >= 4) return endGoal(w, g, 'failed', 'could not raise the rest'); g.obstacle = 'nobody to back him'; return later(w, g, 2); }
    bump(w, 'inter.finance');
    const chance = 0.2 + rel(lender, c.id).trust * 0.45 + lender.traits.greed * 0.15 + (lender.rank === 'capo' || lender.rank === 'underboss' ? 0.1 : 0);
    if (!w.rng.chance(chance)) { g.tries++; bump(w, 'refused.finance'); rel(c, lender.id).respect = clamp(rel(c, lender.id).respect - 0.01); if (g.tries >= 4) return endGoal(w, g, 'failed', 'nobody would back him'); return later(w, g, 1.5); }
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
  g.progress = clamp((c.cash - g.have) / Math.max(1, g.need - g.have), 0, 1);
  if (c.cash >= g.need) return endGoal(w, g, 'done', 'put the money together');
  if (c.cash < g.have * 0.4 && g.have > 300) return endGoal(w, g, 'dropped', 'lost what he had');
  const t = c.traits, b = ownerBiz(w, c.id);
  const opts: { k: string; s: number }[] = [];
  if (b && b.open && (b.invest ?? 0) < INVEST_CAP * 0.8 && c.cash > 450) opts.push({ k: 'invest', s: 0.35 + t.caution * 0.3 + (b.distress === 0 ? 0.15 : -0.3) });
  const chasing = w.debts.filter((d) => d.creditor === c.id && d.status === 'active' && d.missed > 0 && w.chars[d.debtor]?.alive);
  if (chasing.length) opts.push({ k: 'collect', s: 0.5 + t.violence * 0.3 + t.greed * 0.2 });
  if (c.cash > 600) opts.push({ k: 'lend', s: 0.15 + t.greed * 0.45 + t.vice * 0.1 });
  if (!opts.length) { g.obstacle = 'nothing to work with'; g.tries++; if (g.tries >= 8) return endGoal(w, g, 'dropped', 'no way to make it grow'); return later(w, g, 2); }
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
    const amt = Math.min(d.balance, Math.round(debtor.cash * 0.6));
    if (amt >= 20) { payDebt(w, d, amt); rel(debtor, c.id).grudge = clamp(rel(debtor, c.id).grudge + (t.violence > 0.5 ? 0.08 : 0.03)); g.next = 'keep the pressure on'; }
    else { g.tries++; g.obstacle = 'he has nothing'; }
    return later(w, g, 2);
  } else if (pick === 'lend') {
    const need = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.rank !== 'boss' && (x.cash < 150 || (ownerBiz(w, x.id)?.distress ?? 0) >= 2) && !debtsOf(w, x.id).length && (x.familyId === c.familyId || (c.rels[x.id]?.trust ?? 0) > 0.25));
    const m = need.sort((p, q) => p.cash - q.cash)[0];
    if (!m) { g.tries++; return later(w, g, 2); }
    const amt = Math.round(Math.min(c.cash * 0.25, 400) / 25) * 25;
    bump(w, 'inter.loan');
    if (amt < 100 || !(m.cash < 80 || w.rng.chance(0.4))) { g.tries++; bump(w, 'refused.loan'); return later(w, g, 2); }
    const shy = t.greed > 0.65 || t.violence > 0.6;
    if (give(c, m, amt)) { createDebt(w, c.id, m.id, amt, shy ? 0.05 : 0.02, 'a loan to tide him over'); bump(w, 'loans'); g.next = 'collect what he is owed'; }
    return later(w, g, 2.5);
  }
  return later(w, g, 2);
}

// ---------------------------------------------------------------- recruiting

function recruitStep(w: World, g: Goal, c: Character) {
  if (LADDER.indexOf(c.rank) < 1) return endGoal(w, g, 'dropped', 'no standing to bring anyone on');
  if (crewSize(w, c) >= (CREW_ROOM[c.rank] ?? 0)) return endGoal(w, g, 'done', 'his crew is full');
  if (c.cash < RECRUIT_COST + 50) { g.obstacle = 'short of cash'; g.tries++; if (g.tries >= 6) return endGoal(w, g, 'dropped', 'could not afford to'); return later(w, g, 2); }
  const t = c.traits;
  if (g.stage === 'spot') {
    const pool = prospectsFor(w, c).sort((a, b) => Number(b.district === c.district) - Number(a.district === c.district) || (a.id < b.id ? -1 : 1));
    const pick = pool.filter((x) => !g.no?.includes(x.id))[0];
    if (!pick) { g.tries++; g.obstacle = 'nobody suitable'; if (g.tries >= 3) return endGoal(w, g, 'dropped', 'nobody worth taking'); return later(w, g, 3); }
    g.target = pick.id; g.stage = 'approach'; g.next = `talk to ${first(pick)}`;
    return later(w, g, 1);
  }
  const p = g.target ? w.chars[g.target] : undefined;
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
  bump(w, 'recruitTry'); bump(w, 'inter.recruit');
  const chance = 0.3 + t.sociability * 0.25 + (c.rank === 'capo' ? 0.1 : 0) + p.traits.ambition * 0.15 - p.traits.caution * 0.2 + clamp(c.standing / 100, 0, 1) * 0.15;
  if (!w.rng.chance(chance)) {
    g.tries++; g.no = [...(g.no ?? []), p.id].slice(-4); delete g.target; g.stage = 'spot'; bump(w, 'refused.recruit');
    if (g.tries >= 4) return endGoal(w, g, 'failed', 'they would not come');
    return later(w, g, 1.5);
  }
  recruitProspect(w, c, p);
  if ((p.rank as Rank) === 'associate' && p.bossId === c.id) { bump(w, 'recruit'); return endGoal(w, g, 'done', `took on ${p.name}`); }
  g.tries++; return later(w, g, 1);
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
  const r = readiness(w, c);
  if (!r) return endGoal(w, g, 'dropped', 'nowhere to go');
  g.progress = clamp(r.score, 0, 1);
  g.next = r.blockers[0] ? r.blockers[0].replace('you haven’t', 'he hasn’t').replace('your', 'his').replace('you’re', 'he’s').replace('you', 'he') : 'wait for the nod';
  const t = c.traits, boss = c.bossId ? w.chars[c.bossId] : undefined, fam = w.fam[c.familyId];
  const sp = r.sponsor;
  const opts: { k: string; s: number }[] = [];
  if (!sp && boss?.alive) opts.push({ k: 'ask', s: 0.9 });
  if (c.standing < 55 && c.cash > 300 && boss?.alive && boss.id !== c.id) opts.push({ k: 'gift', s: 0.35 + (1 - t.greed) * 0.3 + (fam && boss ? 0 : 0) });
  if (t.ambition > 0.6 && t.caution < 0.65 && (t.violence > 0.4 || t.greed > 0.5)) opts.push({ k: 'undermine', s: 0.2 + t.ambition * 0.3 + t.violence * 0.2 });
  if (LADDER.indexOf(c.rank) >= 1 && crewSize(w, c) < (CREW_ROOM[c.rank] ?? 0) && goalsOf(w, c.id).length < AGENCY.caps.perMan && prospectsFor(w, c).length && c.cash >= RECRUIT_COST + RESERVE && !goalsOf(w, c.id).some((x) => x.kind === 'recruit'))
    opts.push({ k: 'crew', s: 0.3 + t.sociability * 0.3 });
  if (!opts.length) {
    // nothing he can do but wait: money earned and standing earned are things the world gives him, not things a plan can conjure
    if (r.blockers.some((x) => /no room/.test(x))) { g.obstacle = 'no room'; g.n = (g.n ?? 0) + 1; if (g.n > 26) return endGoal(w, g, 'dropped', 'no room at the next level'); }
    return later(w, g, 3);
  }
  const pick = opts.map((o) => ({ ...o, s: o.s * w.rng.range(0.7, 1.3) })).sort((x, y) => y.s - x.s)[0].k;
  if (pick === 'ask' && boss) {
    // he asks the man above him to put his name forward
    if (boss.isPlayer) return later(w, g, 2);
    bump(w, 'inter.ask');
    const rb = rel(boss, c.id);
    const chance = 0.1 + rb.trust * 0.45 + rb.respect * 0.25 + clamp(c.lifetimeKick / 4000, 0, 0.2) - rb.grudge * 0.4 + (LADDER.indexOf(boss.rank) >= 1 ? 0 : -1);
    if (w.rng.chance(chance)) { c.backer = boss.id; rb.trust = clamp(rb.trust + 0.04); g.next = 'wait for the nod'; bump(w, 'backed'); emit(w, g, c, 'backed'); return later(w, g, 3); }
    g.tries++; bump(w, 'refused.ask'); rb.respect = clamp(rb.respect - 0.01); emit(w, g, c, 'refused');
    if (g.tries >= 6) return endGoal(w, g, 'failed', 'his superior would not back him');
    return later(w, g, 3);
  }
  if (pick === 'gift' && boss) {
    const amt = Math.round(Math.min(c.cash * 0.15, 250) / 10) * 10;
    if (amt >= 50 && give(c, boss, amt)) { rel(boss, c.id).trust = clamp(rel(boss, c.id).trust + 0.04); rel(boss, c.id).respect = clamp(rel(boss, c.id).respect + 0.02); c.standing = clamp(c.standing + 0.8, 0, 100); bump(w, 'inter.gift'); g.next = 'keep his name in front of them'; emit(w, g, c, 'gift', { amt }); }
    return later(w, g, 6);
  }
  if (pick === 'undermine') {
    const rivals = fam ? members(w, fam.id).filter((x) => x.id !== c.id && x.rank === c.rank && !x.isPlayer && !isRunner(w, x)) : [];
    const rv = rivals.map((x) => ({ x, r: readiness(w, x)?.score ?? 0 })).sort((a, b) => b.r - a.r)[0]?.x;
    if (!rv || (readiness(w, rv)?.score ?? 0) < g.progress * 0.8) return later(w, g, 3);
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
    return later(w, g, 4);
  }
  if (pick === 'crew') {
    const q = begin(w, c, 'recruit', 'a bigger crew will help him rise', 0.5, { stage: 'spot', next: 'find a man worth bringing on' });
    q.deadline = w.now + 20 * WEEK;
    return later(w, g, 3);
  }
  return later(w, g, 3);
}

// ---------------------------------------------------------------- debts

function debtStep(w: World, g: Goal, c: Character) {
  const d: Debt | undefined = w.debts.find((x) => x.id === g.target);
  if (!d || d.status === 'paid' || d.status === 'void') return endGoal(w, g, 'done', d?.status === 'void' ? 'the debt went away' : 'paid it off');
  if (d.status === 'defaulted') return endGoal(w, g, 'failed', 'could not pay it');
  const cr = w.chars[d.creditor];
  g.progress = clamp(1 - d.balance / Math.max(1, g.need), 0, 1);
  const t = c.traits, ownBiz = ownerBiz(w, c.id);
  const opts: { k: string; s: number }[] = [];
  const spare = c.cash - RESERVE - d.weeklyPayment;
  if (spare >= 100) opts.push({ k: 'pay', s: 0.5 + t.caution * 0.3 + (1 - t.vice) * 0.1 });
  if (cr?.alive && (d.missed > 0 || c.cash < d.weeklyPayment * 2)) opts.push({ k: 'time', s: 0.6 + (d.missed > 0 ? 0.2 : 0) - t.ambition * 0.15 });
  if (cr?.alive && d.weeklyRate > 0.02 && (g.n ?? 0) < 2) opts.push({ k: 'terms', s: 0.3 + t.caution * 0.2 });
  if (ownBiz && !(ownBiz.stakes ?? []).some((s) => s.share >= 0.3) && stakeRoom(ownBiz) >= 0.15 && ownBiz.open) opts.push({ k: 'sell', s: 0.25 + t.greed * 0.1 + (d.missed > 1 ? 0.3 : 0) });
  if (cr?.alive && t.violence > 0.65 && t.courage > 0.5 && cr.id !== w.playerId && LADDER.indexOf(cr.rank) <= LADDER.indexOf(c.rank)) opts.push({ k: 'lean', s: 0.15 + t.violence * 0.3 + t.courage * 0.1 });
  if (cr?.alive && t.greed > 0.6 && t.caution < 0.4 && d.missed > 0) opts.push({ k: 'stall', s: 0.2 + t.greed * 0.2 });
  if (!opts.length) { g.tries++; if (g.tries >= 8) return endGoal(w, g, 'dropped', 'nothing left to try'); return later(w, g, 1.5); }
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
  if (pick === 'stall' && cr) { rel(cr, c.id).trust = clamp(rel(cr, c.id).trust - 0.05); bump(w, 'stalled'); g.tries++; return later(w, g, 2); }
  return later(w, g, 2);
}

// ---------------------------------------------------------------- independence

function independenceStep(w: World, g: Goal, c: Character) {
  const boss = c.bossId ? w.chars[c.bossId] : undefined;
  if (!boss?.alive) return endGoal(w, g, 'done', 'nobody above him now');
  const t = c.traits;
  const b = ownerBiz(w, c.id);
  const floor = Math.max(0.05, 0.2 - 0.1);
  if (g.stage === 'income') {
    g.progress = 0.2;
    if (b || c.cash >= 1500 || stakesHeld(w, c.id)) { g.stage = 'ties'; g.n = 0; g.next = 'make friends outside the crew'; return later(w, g, 1); }
    // no money of his own: that is a different goal, so he works at it by chasing a business
    if (!goalsOf(w, c.id).some((x) => x.kind === 'business') && goalsOf(w, c.id).length < AGENCY.caps.perMan && c.cash >= 500 && owned(w, c.id) < MAX_OWNED) begin(w, c, 'business', 'a place of his own would free him', 0.6, { stage: 'scout', next: 'find a place worth having' });
    g.tries++;
    if (g.tries >= 10) return endGoal(w, g, 'dropped', 'no money of his own');
    return later(w, g, 3);
  }
  if (g.stage === 'ties') {
    const out = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== c.id && x.id !== boss.id && x.familyId !== c.familyId && (x.rank !== 'civilian' || ownerBiz(w, x.id)) && (c.rels[x.id]?.trust ?? 0) < 0.4);
    const x = out[Math.floor(w.rng.next() * out.length)];
    bump(w, 'inter.tie');
    if (x && w.rng.chance(0.3 + t.sociability * 0.4)) { const r1 = rel(c, x.id), r2 = rel(x, c.id); r1.trust = clamp(r1.trust + 0.15); r2.trust = clamp(r2.trust + 0.12); r1.lastMet = w.now; r2.lastMet = w.now; g.n = (g.n ?? 0) + 1; }
    g.progress = 0.2 + 0.2 * Math.min(3, g.n ?? 0) / 3;
    if ((g.n ?? 0) >= 3) { g.stage = 'terms'; g.next = 'ask for better terms'; g.tries = 0; }
    else { g.tries++; if (g.tries >= 12) return endGoal(w, g, 'dropped', 'could not make the contacts'); }
    return later(w, g, 2);
  }
  if (g.stage === 'terms') {
    g.progress = 0.7;
    const rb = rel(boss, c.id);
    if (c.kickRate <= floor + 0.001) return endGoal(w, g, 'done', 'passes up as little as he can');
    bump(w, 'inter.terms');
    const chance = 0.1 + rb.trust * 0.35 + rb.respect * 0.25 + (b ? 0.1 : 0) - rb.grudge * 0.3;
    if (!boss.isPlayer && w.rng.chance(chance)) { c.kickRate = Math.max(floor, c.kickRate - 0.03); bump(w, 'renegotiated'); return endGoal(w, g, 'done', 'got better terms'); }
    g.tries++; bump(w, 'refused.terms'); rb.respect = clamp(rb.respect - 0.01);
    if (g.tries >= 3 && t.ambition > 0.7 && (b || c.cash >= 1500) && w.rng.chance(0.3)) {
      // he decides he doesn't need that man: he moves under someone else, keeping his rank
      leaveCrew(w, c);
      addFact(w, { kind: 'rumour', actor: c.id, victim: boss.id, minor: true, text: `${c.name} has stopped answering to ${boss.name}.`, district: c.district }, { witnesses: [boss.id] });
      rel(boss, c.id).grudge = clamp(rel(boss, c.id).grudge + 0.3);
      bump(w, 'broke');
      return endGoal(w, g, 'done', 'walked away from his superior');
    }
    if (g.tries >= 5) return endGoal(w, g, 'failed', 'his superior would not move');
    return later(w, g, 3);
  }
}
const stakesHeld = (w: World, id: Id) => Object.values(w.biz).some((b) => (b.stakes ?? []).some((s) => s.holder === id && s.share >= 0.15));

// ---------------------------------------------------------------- the player, when it is plausible

const askOk = (w: World) => {
  const a = agencyOf(w);
  return w.now - a.lastAsk >= 12 * DAY && !w.enc.some((e) => e.status === 'open' && e.data?.what === 'goal');
};
function surface(w: World, g: Goal, c: Character, t: string, title: string, lines: string[], opts: Enc['opts']): Enc | undefined {
  const p = w.chars[w.playerId ?? ''];
  if (!p?.alive || !askOk(w)) return undefined;
  const e = addEnc(w, { kind: 'crew', from: c.id, title, days: 7, lines, opts, data: { what: 'goal', g: g.id, t } });
  g.ask = e.id; agencyOf(w).lastAsk = w.now; bump(w, 'ask.shown');
  return e;
}
// The player has answered (or has not): apply it. `lapse` is no answer, which is a refusal for everyone but the man's pride.
function answered(w: World, g: Goal, code: string): string[] {
  const c = w.chars[g.who], p = w.chars[w.playerId ?? ''];
  const lines: string[] = [];
  if (!c?.alive || !p) return lines;
  const yes = code === 'yes';
  bump(w, yes ? 'ask.accepted' : 'ask.refused');
  const r = rel(c, p.id);
  if (g.stage === 'finance' && g.with === p.id) {
    const amt = g.share ?? 0;
    if (yes && p.cash >= amt && amt > 0) { p.cash -= amt; c.cash += amt; g.fin = { by: p.id, amt }; g.stage = 'close'; g.next = 'settle up'; bump(w, 'investments'); r.trust = clamp(r.trust + 0.1); lines.push(`${first(c)} shakes your hand. "You won't regret it."`); }
    else if (yes) lines.push('You haven’t got it to give.');
    else { g.tries++; r.trust = clamp(r.trust - 0.02); lines.push(`${first(c)} nods. "I'll find it somewhere else."`); }
    delete g.with;
    later(w, g, 1);
    return lines;
  }
  if (g.kind === 'debt') {
    const d = w.debts.find((x) => x.id === g.target);
    if (yes && d) { d.nextDue += 14 * DAY; d.missed = Math.max(0, d.missed - 1); r.trust = clamp(r.trust + 0.08); bump(w, 'extension'); lines.push(`${first(c)} lets out a breath. "Two weeks. I won't forget it."`); }
    else { r.trust = clamp(r.trust - 0.03); g.tries++; lines.push(`${first(c)} takes it without a word. He's still on the hook.`); }
    later(w, g, 2);
    return lines;
  }
  if (g.kind === 'advance') {
    if (yes) { c.backer = p.id; r.trust = clamp(r.trust + 0.1); r.affection = clamp(r.affection + 0.05); bump(w, 'backed'); lines.push(`"You won't regret it," ${first(c)} says.`); }
    else { g.tries++; r.respect = clamp(r.respect - 0.03); lines.push(`${first(c)} nods slowly. "I'll keep earning it."`); }
    later(w, g, 3);
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
