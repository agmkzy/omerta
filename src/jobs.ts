// Jobs, tip-offs, schemes, ventures and conversations: everything that starts from the player.
// All state is plain data (Job, Venture) so it saves and loads with the world.
import { lineOf } from './rackets';
import { temper } from './temper';
import { bizMove } from './econ';
import { ERRAND_KINDS, resolveErrand, runCrewJob } from './orders';
import { giveWork, judge, needsOf, noteWork } from './work';
import { aptitude, grow, lateOf } from './people';
import { arch, bossWhy, dodge, injury, pitch, whyOf } from './voice';
import { confide, perform, share, tension } from './actions';
import { afterClient, afterKilling } from './consequences';
import { addFact, bear, clamp, concealedGap, earn, factText, feel, feelOn, handleDeath, money, newId, notifyProtector, ownerBiz, recordCareer, regard, rel, repute, shortTime, travelTime, witnessesAt } from './core';
import { askBetween, move as askMove, openAsk } from './asks';
import { isOpen } from './situ';
import { gigApproaches, gigTick, gigOffer, gigResolve, gigStale, GIG_HELP, GIG_LABEL } from './gigs';
import { Action, Character, DAY, Id, Job, World } from './types';
import { pickedUp } from './inside';
import { imposed } from './imposed';

export interface Approach {
  code: string;
  label: string;
  hint: string;
}
export interface Result {
  lines: string[];
  minutes: number;
  ok: boolean;
  money?: number;
  note?: string;
}
export interface Move {
  kind: 'sell_cars' | 'pawn_goods' | 'deliver_cars' | 'chop_start' | 'meeting' | 'bonus' | 'topic';
  actor: Id;
  biz?: Id;
  target?: Id;
  code?: string;
  label: string;
}
export interface SchemeOpt {
  label: string;
  hint?: string;
  job?: { kind: 'boost' | 'burgle' | 'scam'; biz?: Id; target?: Id };
  move?: Move;
}

const HOSTILE = new Set(['beating', 'vandalism', 'robbery', 'poach', 'scam', 'burglary', 'theft']);
const PL = (w: World) => w.chars[w.playerId!];
const AP = (c: string | undefined) => c as Action['approach'];
const crewOf = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.bossId === w.playerId);
export const bump = (c: Character, d: number) => {
  c.heat = clamp(c.heat + d, 0, 1.5);
};

export const KIND_LABEL: Record<Job['kind'], string> = {
  collect: 'Collection',
  lean: 'Protection',
  handle: 'Rough work',
  hit: 'Contract',
  boost: 'Cars',
  burgle: 'Burglary',
  scam: 'Scam',
  summons: 'Summons',
  gig: 'Opportunity', watch: 'Watching', deliver: 'Delivery', message: 'Message', guard: 'Guard duty', find: 'Search', shake: 'Late payer', fix: 'Fix',
};

export const KIND_HELP: Record<string, string> = {
  collect: 'Get money a man owes you or the family.',
  lean: 'Put a business under the family’s protection, and start the weekly envelope.',
  handle: 'Somebody needs teaching a lesson. You decide how hard.',
  hit: 'A killing, paid for by a client. The worst way to earn.',
  boost: 'Steal cars to sell on.',
  burgle: 'Break into a place and take what’s there.',
  scam: 'Con money out of people who trust the wrong face.',
  summons: 'A meeting you’re expected at.',
  watch: 'Follow a man and learn what he’s up to.',
  deliver: 'Carry something from here to there, quietly.',
  message: 'Pass a warning to somebody, in person.',
  guard: 'Stand watch over a place or a man.',
  find: 'Track down a man or a fact.',
  shake: 'A shop is behind on its envelope. Go and get it.',
  fix: 'Get a man out of jail.',
  gig: 'Something has come up that you could use.',
};
export function traitWords(c: Character): string {
  const t = c.traits;
  const out: string[] = [];
  if (t.violence > 0.7) out.push('violent');
  if (t.caution > 0.65) out.push('careful');
  if (t.caution < 0.3) out.push('reckless');
  if (t.greed > 0.75) out.push('greedy');
  if (t.sociability > 0.7) out.push('smooth talker');
  if (t.vice > 0.7) out.push('gambler');
  if (t.ambition > 0.8) out.push('ambitious');
  if (t.courage < 0.55) out.push('nervy');
  return out.slice(0, 2).join(', ') || 'steady';
}
export function standingWord(s: number): string {
  return s < 20 ? 'on thin ice' : s < 45 ? 'unproven' : s < 60 ? 'trusted' : s < 80 ? 'respected' : 'a rising name';
}

// ------------------------------------------------------------------ plumbing

export type NewJob = Omit<Job, 'id' | 'created' | 'expires' | 'status'> & { days?: number; status?: Job['status'] };
export function mkJob(w: World, j: NewJob): Job {
  const { days, status, ...rest } = j;
  // (nobody gives work to himself: a job whose giver would be the man doing it is nobody's but his own, and is not a job)
  if (rest.giver && rest.giver === rest.assignee) rest.giver = null;
  if (rest.kind !== 'summons') {
    const same = w.jobs.find((q) => q.kind === rest.kind && q.target === rest.target && q.biz === rest.biz && (((q.status === 'offered' || q.status === 'active') && rest.via !== 'order' && rest.via !== 'scheme') || q.giver === rest.giver && q.assignee === rest.assignee && ((q.status === 'offered' || q.status === 'active') || (w.now - q.created < 10 * DAY && q.via === rest.via && rest.via !== 'order' && rest.via !== 'scheme'))));
    if (same) return same;
  }
  const job: Job = { ...rest, id: newId(w, 'j'), created: w.now, expires: w.now + (days ?? 6) * DAY, status: status ?? 'offered' };
  w.jobs.push(job);
  return job;
}

export function jail(w: World, c: Character, days: number, why?: string) {
  c.jailedUntil = w.now + days * DAY;
  if (why) pickedUp(w, c, why);
  recordCareer(w, c, `Arrested; inside ${days} days`);
  c.heat = 0.1;
  const kin = Object.values(w.chars).filter((x) => x.alive && x.familyId && x.familyId === c.familyId).map((x) => x.id);
  addFact(w, { kind: 'arrest', actor: c.id, text: `${c.name} was arrested.`, district: c.district }, { broadcast: kin });
}

// Pays the doer (the player keeps all of it; a man sent by someone keeps 35% and the rest goes to the man who sent him: you, or an
// NPC superior who gave the order).
export function paid(w: World, doer: Character, amount: number, from?: Character, src = 'scheme', boss?: Character): number {
  let amt = Math.max(0, Math.round(amount));
  if (from) {
    const b = ownerBiz(w, from.id);
    const have = Math.max(0, from.cash) + (b ? Math.max(0, b.cash) : 0);
    amt = Math.min(amt, Math.floor(have));
    const fromCash = Math.min(Math.max(0, from.cash), amt);
    from.cash -= fromCash;
    if (b) bizMove(w, b, -(amt - fromCash), 'aid', from.id);
  }
  const p = PL(w);
  if (doer.isPlayer) earn(doer, amt, src);
  else {
    const mine = Math.round(amt * 0.35);
    earn(doer, mine, 'cut');
    earn(boss ?? p, amt - mine, 'delegated');
  }
  return amt;
}

// ------------------------------------------------------------------- offers

const hasOpenFrom = (w: World, giver: Id, kind: Job['kind']) => w.jobs.some((j) => j.giver === giver && j.kind === kind && (j.status === 'offered' || j.status === 'active'));

// The player asks his superior for work, or his superior has some for him: what is offered is what the superior actually needs done
// (work.needsOf, the same list every superior hands out from), or a matter of his own he wants handled.
export function bossOffer(w: World, force = false): boolean {
  const p = PL(w);
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  if (!boss || !boss.alive || !p.familyId) return false;
  if (!force && w.jobs.some((j) => j.via === 'boss' && (j.status === 'offered' || j.status === 'active'))) return false;
  if (force && w.jobs.some((j) => j.via === 'boss' && j.status === 'offered')) return false;
  const options: (() => void)[] = [];
  const need = needsOf(w, boss).filter((n) => n.target !== p.id).sort((a, b) => b.weight - a.weight)[0];
  if (need) options.push(() => void giveWork(w, boss, p, need));

  // He wants someone in his own house gone, and says it is for the family's sake. Whether that is true is another matter.
  const rankOrder = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
  const foes = Object.entries(boss.rels)
    .map(([id, r]) => ({ x: w.chars[id], r }))
    .filter(({ x, r }) => x?.alive && x.id !== p.id && x.familyId === p.familyId && x.id !== boss.id && r.grudge >= 0.25 && rankOrder.indexOf(x.rank) >= 1 && rankOrder.indexOf(x.rank) < rankOrder.indexOf(boss.rank) && !w.jobs.some((j) => j.target === x.id && (j.status === 'offered' || j.status === 'active')));
  if (foes.length && boss.rank !== 'associate')
    options.push(() => {
      const { x } = foes.sort((a, b) => b.r.grudge - a.r.grudge)[0];
      const rivals = Object.values(w.fam).filter((f) => f.id !== p.familyId);
      const rival = w.rng.pick(rivals);
      const disloyal = w.rng.chance(0.6);
      const contact = Object.values(w.chars).some((y) => y.alive && y.familyId && y.familyId !== x.familyId && ((x.rels[y.id]?.trust ?? 0) >= 0.35 || (y.rels[x.id]?.trust ?? 0) >= 0.35));
      const gap = concealedGap(w, x);
      const lethal = x.rank !== 'associate';
      mkJob(w, {
        kind: lethal ? 'hit' : 'handle', subject: disloyal ? 'disloyal' : 'skimming',
        title: lethal ? `${boss.name} says ${x.name} has to go` : `${boss.name} wants ${x.name} straightened out`,
        brief: disloyal ? `${boss.name} says ${x.name} has been talking to the ${rival.name} people. ${lethal ? 'He wants it ended.' : 'He wants it dealt with.'}` : `${boss.name} says ${x.name} has been skimming from the family. ${lethal ? 'He wants it ended.' : 'He wants it dealt with.'}`,
        giver: boss.id, via: 'boss', assignee: p.id, target: x.id, pay: lethal ? 1500 : 300,
        reason: disloyal ? `${x.name} has been talking to ${rival.name}'s people.` : `${x.name} has been skimming.`,
        why: bossWhy(w, boss, x, disloyal ? 'disloyal' : 'skimming', disloyal ? contact : gap > 40, rival.name),
        claimTrue: disloyal ? contact : gap > 40,
      });
    });

  if (!options.length) return false;
  options[0]();
  return true;
}
export const forceBossOffer = (w: World) => bossOffer(w, true);

export function tipFrom(w: World, c: Character): boolean {
  const p = PL(w);
  const facts = Object.entries(c.known)
    .map(([id, k]) => ({ f: w.facts[id], k }))
    .filter(({ f }) => f && HOSTILE.has(f.kind) && f.victim === c.id && w.now - f.t < 25 * DAY && !w.jobs.some((j) => j.cause === f.id));
  if (!facts.length) return false;
  const { f, k } = facts[facts.length - 1];
  let culprit: Id | undefined;
  let sure = false;
  if (k.knowsActor && f.actor) {
    culprit = f.actor;
    sure = true;
  } else {
    let bg = 0.3;
    for (const [id, r] of Object.entries(c.rels)) if (id !== c.id && r.grudge > bg && w.chars[id]?.alive) {
      bg = r.grudge;
      culprit = id;
    }
  }
  if (!culprit) return false;
  const t = w.chars[culprit];
  if (!t || !t.alive || t.id === p.id || t.id === c.id) return false;
  if (t.familyId && t.familyId === p.familyId) return false;
  if (t.rank === 'boss' || t.rank === 'underboss') return false;
  const pay = Math.min(600, Math.max(150, Math.round((c.cash * 0.25) / 50) * 50));
  const why = whyOf(w, c, t, f, p);
  mkJob(w, {
    kind: 'handle',
    title: `${c.name} wants ${t.name} dealt with`,
    brief: `${c.name} found you and asked for a minute. "${pitch(w, c, t, f, sure, pay)}"`,
    giver: c.id, via: 'tip', assignee: p.id, target: t.id, cause: f.id, pay, reason: why.surface, why, claimTrue: culprit === f.actor, subject: 'wrong',
  });
  return true;
}

function tipOffer(w: World): boolean {
  const p = PL(w);
  const pool = Object.keys(p.rels).map((id) => w.chars[id]).filter((c) => c && c.alive && c.id !== p.id && c.jailedUntil <= w.now && p.rels[c.id].trust >= 0.2);
  for (let i = 0; i < 8 && pool.length; i++) if (tipFrom(w, pool.splice(w.rng.int(0, pool.length - 1), 1)[0])) return true;
  return false;
}

function contractOffer(w: World): boolean {
  const p = PL(w);
  const cands: [Character, Character][] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.id === p.id || c.cash < 1500 || !p.rels[c.id] || p.rels[c.id].trust < 0.2) continue;
    for (const [id, r] of Object.entries(c.rels)) {
      if (r.grudge < 0.6) continue;
      const x = w.chars[id];
      if (!x || !x.alive || x.id === p.id || x.id === c.id || (x.familyId && x.familyId === p.familyId) || x.rank === 'boss' || x.rank === 'underboss') continue;
      if (hasOpenFrom(w, c.id, 'hit')) continue;
      cands.push([c, x]);
    }
  }
  if (!cands.length) return false;
  const [c, x] = w.rng.pick(cands);
  const hurt = Object.values(w.facts).find((f) => f.actor === x.id && f.victim === c.id && !f.minor);
  const pay = Math.min(4000, Math.max(1500, Math.round((c.cash * 0.5) / 250) * 250));
  const why = whyOf(w, c, x, hurt, p);
  const a = arch(c);
  const ask = {
    cold: `I want ${x.name} gone. I’ll pay ${money(pay)} and I won’t be thanking anyone. It should look like nothing.`,
    proud: `A man like ${x.name} shouldn’t be walking around. ${money(pay)}. Quietly. You’ll know what to do.`,
    bitter: `I have the money. ${money(pay)}. I would rather not say how I came by it. I want ${x.name} out of the picture.`,
    schemer: `If ${x.name} were to disappear, a number of things would resolve themselves. I’m offering ${money(pay)} to make that happen.`,
    earnest: `I never thought I would say this. I want ${x.name} gone. I have ${money(pay)}. Please.`,
    hothead: `${x.name}. Gone. ${money(pay)}. I’m not going to dress it up.`,
    jovial: `There’s a fellow I would like to stop seeing. ${x.name}. It’s worth ${money(pay)} to me.`,
    frightened: `I need ${x.name} to not be a problem anymore. I have ${money(pay)}. Please don’t ask me to say it plainer.`,
  }[a];
  mkJob(w, { kind: 'hit', title: `${c.name} wants ${x.name} gone`, brief: `${c.name} asked for a private word. "${ask}" Once it’s done it can’t be undone, and ${c.name} will know it was you.`, giver: c.id, via: 'contract', assignee: p.id, target: x.id, pay, days: 8, subject: 'grudge', reason: why.surface, why, claimTrue: !!hurt });
  return true;
}

function garageJob(w: World, b: { id: Id; ownerId: Id; name: string; district: string }): boolean {
  const o = w.chars[b.ownerId];
  if (!o?.alive || hasOpenFrom(w, o.id, 'boost')) return false;
  mkJob(w, { kind: 'boost', title: `${o.name} needs cars`, brief: `${o.name} at ${b.name} (${b.district}) is short of stock and asks no questions. He'll pay ${money(650)} a car, cash, no paperwork.`, giver: o.id, via: 'opportunity', assignee: PL(w).id, biz: b.id, pay: 650 });
  return true;
}
function pawnJob(w: World, pb: { id: Id; ownerId: Id }): boolean {
  const p = PL(w);
  const o = w.chars[pb.ownerId];
  if (!o?.alive || hasOpenFrom(w, o.id, 'burgle')) return false;
  const vics = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && b.id !== pb.id && b.protection?.familyId !== p.familyId && w.chars[b.ownerId]?.alive);
  if (!vics.length) return false;
  const v = w.rng.pick(vics);
  mkJob(w, { kind: 'burgle', title: `A tip on ${v.name}`, brief: `${o.name} hears ${v.name} (${v.district}) keeps good stock out the back. He'll take whatever you bring at 55% of its value and won't ask where it came from.`, giver: o.id, via: 'opportunity', assignee: p.id, biz: v.id, pay: 0 });
  return true;
}
export function oppFrom(w: World, t: Character): boolean {
  const b = ownerBiz(w, t.id);
  if (!b) return false;
  if (b.kind === 'garage') return garageJob(w, b);
  if (b.kind === 'pawnshop') return pawnJob(w, b);
  return false;
}

function oppOffer(w: World): boolean {
  const p = PL(w);
  const tries: (() => boolean)[] = [];
  for (const b of Object.values(w.biz)) if (b.open && b.kind === 'garage') tries.push(() => garageJob(w, b));
  for (const b of Object.values(w.biz)) if (b.open && b.kind === 'pawnshop') tries.push(() => pawnJob(w, b));
  tries.push(() => {
    const marks = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && w.chars[b.ownerId]?.alive && b.ownerId !== p.id && w.chars[b.ownerId].cash + b.cash >= 600);
    if (!marks.length) return false;
    const b = w.rng.pick(marks);
    const o = w.chars[b.ownerId];
    if (w.jobs.some((j) => j.kind === 'scam' && j.target === o.id && (j.status === 'offered' || j.status === 'active'))) return false;
    const tipsters = Object.keys(p.rels).map((id) => w.chars[id]).filter((c) => c && c.alive && c.id !== o.id && c.id !== p.id);
    const tip = tipsters.length ? w.rng.pick(tipsters) : undefined;
    mkJob(w, { kind: 'scam', title: `${o.name} has been flush`, brief: `${tip ? tip.name + ' says' : 'Word is'} ${o.name} (${b.name}) has had a good run and keeps cash on hand. A smooth talker could part him from some of it.`, giver: tip?.id ?? null, via: 'opportunity', assignee: p.id, target: o.id, biz: b.id, pay: 0 });
    return true;
  });
  for (let i = 0; i < 6 && tries.length; i++) if (tries.splice(w.rng.int(0, tries.length - 1), 1)[0]()) return true;
  return false;
}

export function newOffer(w: World) {
  const bag = ['tip', 'opp', 'opp', 'gig', 'gig', 'gig', 'contract']; // (a superior's work comes through work.ts, the same for every man)
  for (let i = 0; i < 6 && bag.length; i++) {
    const k = bag.splice(w.rng.int(0, bag.length - 1), 1)[0];
    const ok = k === 'boss' ? bossOffer(w) : k === 'tip' ? tipOffer(w) : k === 'opp' ? oppOffer(w) : k === 'gig' ? gigOffer(w) : contractOffer(w);
    if (ok) return;
  }
}

// ------------------------------------------------------------ job lifecycle

export function takeJob(w: World, j: Job) {
  j.status = 'active';
  j.assignee = w.playerId!;
  j.accepted = w.now;
  delete j.due;
}
export function attendedJob(w: World, j: Job) { j.status = 'done'; j.reported = true; }
export function declineJob(w: World, j: Job) {
  const p = PL(w);
  const g = j.giver ? w.chars[j.giver] : undefined;
  j.status = 'declined';
  if (g) feel(w, g, p.id, 'respect', -0.03);
  if (j.via === 'boss') repute(w, p, -2, 'refused work');
  if (j.reason === 'blackmail' && g) {
    // He will tell the people who would want to know.
    feel(w, g, p.id, 'trust', -0.2);
    bear(w, g, p.id, 0.3, `${p.name} tried to blackmail him`);
    const f = Object.values(w.facts).filter((q) => q.kind === 'murder' && (q.actor === p.id || q.actor === g.id)).sort((a, b) => b.t - a.t)[0];
    if (f) {
      f.actor = p.id;
      w.pending.push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(5, 12) * DAY, kind: 'reveal', fact: f.id });
    }
  }
}
export function dropJob(w: World, j: Job) {
  const p = PL(w);
  j.status = 'declined';
  if (j.via === 'boss') repute(w, p, -4, 'refused work');
  const g = j.giver ? w.chars[j.giver] : undefined;
  if (g) feel(w, g, p.id, 'trust', -0.05);
}
// One man, one time-consuming assignment. This is the only place that decides whether he's free.
export function activityOf(w: World, c: Character): { why: string; until: number } | undefined {
  if (c.jailedUntil > w.now) return { why: 'locked up', until: c.jailedUntil };
  if (c.hurtUntil > w.now) return { why: 'laid up', until: c.hurtUntil };
  const j = w.jobs.find((q) => q.status === 'active' && q.assignee === c.id && q.kind !== 'summons');
  if (j) return { why: `on a job: ${j.title.replace(/^(.)/, (m) => m.toLowerCase())}`, until: j.due ?? j.expires };
  { const o = lineOf(w, c); if (o?.lull && o.lull > w.now) return { why: 'keeping his head down', until: o.lull }; }
  return undefined;
}
export const JOB_STATE: Record<Job['status'], string> = { offered: 'Available', active: 'In progress', done: 'Completed', failed: 'Failed', declined: 'Cancelled', expired: 'Cancelled' };

// Is the same piece of work already being done by someone?
export const inHand = (w: World, j: Pick<Job, 'kind' | 'target' | 'biz'>, except?: Job) =>
  w.jobs.find((q) => q !== except && q.status === 'active' && q.kind === j.kind && q.target === j.target && q.biz === j.biz && q.kind !== 'summons' && q.kind !== 'boost' && q.kind !== 'watch');

export function assign(w: World, j: Job, memberId: Id, orders: 'quiet' | 'hard'): string | null {
  const m = w.chars[memberId];
  if (!m?.alive) return 'He isn’t around any more.';
  const busy = activityOf(w, m);
  if (busy) return `${m.name} is ${busy.why} until ${shortTime(busy.until)}.`;
  if (j.status === 'active') return 'That job is already in hand.';
  const dup = inHand(w, j, j);
  if (dup) return `${w.chars[dup.assignee]?.name ?? 'Someone'} is already on that.`;
  // taking this one up takes the matching offers off the table, silently: they are the same piece of work, not stale ones
  for (const q of w.jobs) if (q !== j && q.status === 'offered' && q.kind === j.kind && q.target === j.target && q.biz === j.biz && q.kind !== 'summons') { q.status = 'expired'; q.notes = [...(q.notes ?? []), 'Taken up under another name.']; }
  j.status = 'active';
  j.assignee = memberId;
  j.accepted = w.now;
  j.orders = orders;
  j.due = w.now + w.rng.int(1, 3) * DAY;
  return null;
}

// Whether what the work asked for has been done by the man it was given to (or his own men), however he went about it: in
// conversation, through the job's own screen, or on his own initiative. The job is one record; this is the one test of it.
//   lean    the shop now pays him (or one of his men)
//   handle  he has been at the man since it was given: a beating, a threat, damage to his place
// Other kinds are done through their own screen (a collection, a delivery, a contract), which resolves them there.
export function objectiveMet(w: World, j: Job): boolean {
  const who = new Set([j.assignee, ...Object.values(w.chars).filter((c) => c.bossId === j.assignee).map((c) => c.id)]);
  if (j.kind === 'lean') { const b = j.biz ? w.biz[j.biz] : undefined; return !!b?.protection && who.has(b.protection.collectorId) && (b.protection.since ?? j.created) >= j.created - DAY; }
  if (j.kind === 'handle' && j.target) return Object.values(w.facts).some((f) => f.t >= j.created && f.actor && who.has(f.actor) && (f.victim === j.target || (!!f.business && w.biz[f.business]?.ownerId === j.target)) && ['beating', 'threat', 'vandalism'].includes(f.kind));
  //   message  he has told the man to his face (a warning given in conversation is the message delivered)
  if (j.kind === 'message' && j.target) return Object.values(w.facts).some((f) => f.t >= j.created && f.actor && who.has(f.actor) && f.victim === j.target && f.kind === 'threat');
  return false;
}
// Work of the player's that has been done by doing it: finished as if he had done it from the job's own screen (paid, credited, counted
// and remembered by the man who gave it), with a word on World. Work offered and done before he said yes counts as taken and done.
export function reached(w: World) {
  const p = PL(w);
  if (!p) return;
  for (const j of w.jobs) {
    if ((j.status !== 'active' && j.status !== 'offered') || j.assignee !== p.id || !objectiveMet(w, j)) continue;
    if (j.status === 'offered') takeJob(w, j);
    const r = finishJob(w, j, true);
    const g = j.giver ? w.chars[j.giver] : undefined;
    addFact(w, { kind: 'report', actor: j.giver ?? undefined, victim: p.id, minor: true, text: `${j.title}: done.${g?.alive ? ` ${g.name} will want to hear it from you.` : ''}${r.lines.length ? ' ' + r.lines.join(' ') : ''}`, district: p.district }, { witnesses: [p.id] });
  }
}

export function approaches(w: World, j: Job): Approach[] {
  switch (j.kind) {
    case 'gig':
      return gigApproaches(w, j);
    case 'summons':
      return [];
    case 'collect':
      return [
        { code: 'soft', label: 'Talk it through', hint: 'Slow and polite. Smaller take, no bad blood.' },
        { code: 'firm', label: 'Squeeze him', hint: 'Make it clear what happens if he stalls.' },
        { code: 'hard', label: 'Make an example', hint: 'He pays or he gets hurt. Word gets round.' },
      ];
    case 'lean':
      return [
        { code: 'soft', label: 'Offer friendship', hint: 'Harder sell, but he keeps his dignity.' },
        { code: 'firm', label: 'Lay it out plainly', hint: 'The usual conversation.' },
        { code: 'hard', label: 'Smash the place up', hint: 'Likely to work. He won’t forget it.' },
      ];
    case 'handle':
      return [
        { code: 'warn', label: 'Have a quiet word', hint: 'Works if he’s guilty and sensible. If he’s innocent, you have insulted him.' },
        { code: 'squeeze', label: 'Squeeze him for restitution', hint: 'Takes his money. He’ll remember who sent you.' },
        { code: 'beat', label: 'Beat him', hint: 'Fast and final. Heat goes up. If he didn’t do it, so does the cost.' },
      ];
    case 'hit':
      return [
        { code: 'specialist', label: 'Hire a specialist', hint: `Costs ${money(Math.round((j.pay * 0.35) / 50) * 50)}. If it comes out, the client's name is on it, not yours.` },
        { code: 'self', label: 'Do it yourself', hint: 'You keep the full fee and carry all the heat and risk.' },
      ];
    case 'boost':
      return [
        { code: 'lot', label: 'Quiet lot at night', hint: '1-2 cars. Low risk.' },
        { code: 'street', label: 'Lift them off the street', hint: '2-3 cars. Medium risk.' },
        { code: 'showroom', label: 'Showroom job', hint: '3-5 cars. High risk, and arrest is on the table.' },
      ];
    case 'burgle':
      return [
        { code: 'quiet', label: 'Quiet entry', hint: 'Smaller haul, less noise.' },
        { code: 'smash', label: 'Smash and grab', hint: 'Bigger haul. Damages the shop. More heat.' },
      ];
    case 'scam':
      return [
        { code: 'charity', label: 'Fake charity drive', hint: 'Small and easy. Rarely noticed.' },
        { code: 'insurance', label: 'Fake insurance man', hint: 'A solid payoff if he’s trusting.' },
        { code: 'rigged', label: 'Rigged card game ($300 stake)', hint: 'The biggest payoff. You lose the stake if it fails.' },
        { code: 'fakecoll', label: 'Fake collections', hint: 'Knock on doors as the union, the church, the city. Steady and small.' },
        { code: 'pyramid', label: 'A pyramid', hint: 'The largest money, and the loudest fallout when it falls apart.' },
      ];
    case 'shake':
      return [
        { code: 'soft', label: 'A friendly word', hint: 'Slow. He keeps his dignity, you get the base.' },
        { code: 'firm', label: 'Make it plain', hint: 'Pays what’s owed.' },
        { code: 'hard', label: 'Make an example', hint: 'More than owed. Everyone on the street hears.' },
      ];
    // (a pickup is trust handed to you in an envelope: carry it straight, or help yourself and hope nobody counts)
    case 'deliver':
      if (j.giver && j.via !== 'order' && /envelopes/.test(j.title)) return [
        { code: 'go', label: 'Carry it straight up', hint: 'Every dollar where it belongs. It’s how men learn they can trust you.' },
        { code: 'skim', label: 'Take a little off the top', hint: 'A few dollars from each envelope. Most men never count. Some always do.' },
      ];
    // (a message to another family's man: said straight, or said so he remembers it; either way it is your face he sees)
    // falls through
    case 'message':
      if (j.kind === 'message') return [
        { code: 'go', label: 'Say it civilly, once', hint: 'He hears it, and he knows who sent it.' },
        { code: 'hard', label: 'Say it so he remembers', hint: 'It may settle it. It may make it worse between the families.' },
      ];
    // falls through
    case 'watch':
    case 'guard':
    case 'find':
    case 'fix':
      return [{ code: 'go', label: { watch: 'Keep eyes on him', deliver: 'Make the delivery', message: 'Deliver the message', guard: 'Take the post', find: 'Start asking around', fix: 'Pull the strings' }[j.kind as string] ?? 'Get on it', hint: { watch: 'Hours of patience. You learn who he talks to.', deliver: 'Get it there in one piece, and don’t open it.', message: 'Say it right, say it once.', guard: 'Stand where you’re told and look like trouble.', find: 'Ask, lean and listen until somebody coughs up a name.', fix: 'A favour in the right ear keeps a man out of a cell.' }[j.kind as string] ?? '' }];
  }
}

function conclude(w: World, j: Job, res: Result): Result {
  const p = PL(w);
  const giver = j.giver ? w.chars[j.giver] : undefined;
  j.status = res.ok ? 'done' : 'failed';
  noteWork(w, j, res.ok); // (the record every man's road reads: work.ts)
  if (w.chars[j.assignee]) grow(w.chars[j.assignee], j.kind, res.ok ? 0.02 : 0.008);
  const doer = w.chars[j.assignee];
  if (giver && doer && giver.id !== doer.id && doer.isPlayer) {
    // V89: earned at a believable pace (core.regard): the tenth errand in a month is not worth what the first one was.
    // (A man an NPC superior sent is judged on his report, which may not be the truth: work.ts judge.)
    if (res.ok) {
      regard(w, giver, doer, 'trust', 0.08, 'job');
      regard(w, giver, doer, 'respect', 0.05, 'job');
    } else regard(w, giver, doer, 'trust', -0.06, 'job');
  }
  if (j.via === 'boss' && giver && doer?.isPlayer) {
    const d = repute(w, p, res.ok ? 4 : -5, 'bossjob');
    res.lines.push(res.ok ? (d >= 2 ? `${giver.name} will hear it went well. That does your name some good.` : `${giver.name} will hear it went well, for what one more errand is worth.`) : `${giver.name} won’t like this. It costs you.`);
  } else if (res.ok && giver && (j.via === 'tip' || j.via === 'contract')) res.lines.push(ERRAND_KINDS.includes(j.kind) ? `${giver.name.split(' ')[0]} will remember who did it for him.` : `${giver.name} owes you one now. In this life that’s worth more than cash.`);
  return res;
}
// V89: a job whose outcome was left open (a quiet word the man has not yet answered, asks.ts 'layoff') is finished later, when the
// matter is: paid and concluded exactly as if it had come off on the day.
export function finishJob(w: World, j: Job, ok: boolean, lines: string[] = []): Result {
  if (j.status !== 'active') return { lines, minutes: 0, ok: false };
  const doer = w.chars[j.assignee], giver = j.giver ? w.chars[j.giver] : undefined;
  let gained = 0;
  if (ok && doer && j.pay > 0) { gained = paid(w, doer, j.pay, giver, 'handle', j.via === 'order' && giver && !doer.isPlayer ? giver : undefined); if (gained > 0 && doer.isPlayer) lines.push(`${giver?.name ?? 'He'} pays you ${money(gained)}.`); }
  return conclude(w, j, { lines, minutes: 0, ok, money: gained || undefined });
}

export function resolve(w: World, j: Job, code: string): Result {
  const lines: string[] = [];
  if (j.status !== 'active') return { lines: ['That job is no longer open.'], minutes: 5, ok: false };
  const doer = w.chars[j.assignee];
  const p = PL(w);
  const rng = w.rng;
  const giver = j.giver ? w.chars[j.giver] : undefined;
  const boss = !doer.isPlayer && j.via === 'order' && giver ? giver : p; // whom a man sent on this works for
  let minutes = 120;
  let ok = false;
  let gained = 0;
  let note: string | undefined;
  const done = (): Result => conclude(w, j, { lines, minutes, ok, money: gained || undefined, note });
  const fail = (msg: string): Result => {
    lines.push(msg);
    ok = false;
    return done();
  };

  if (ERRAND_KINDS.includes(j.kind)) {
    const er = resolveErrand(w, j, doer, code);
    if (er) {
      lines.push(...er.lines);
      minutes = er.minutes;
      ok = er.ok;
      if (ok && er.money) {
        gained = paid(w, doer, er.money, j.kind === 'shake' ? undefined : giver, 'handle', boss);
      }
      return done();
    }
  }
  const adj = aptitude(doer, j.kind) - 0.5;

  switch (j.kind) {
    case 'gig': {
      const r = gigResolve(w, j, doer, code);
      lines.push(...r.lines); minutes = r.minutes; ok = r.ok; gained = r.money ?? 0; note = r.note;
      break;
    }
    case 'collect': {
      const d = w.debts.find((x) => x.id === j.debt);
      const t = w.chars[j.target!];
      if (!d || d.status !== 'active' || !t?.alive) return fail('The debt is no longer there to collect.');
      const before = d.balance;
      const r = perform(w, { kind: 'collect', actor: doer.id, target: t.id, debt: d.id, approach: AP(code), label: '', score: 0 });
      lines.push(...r.lines);
      minutes = r.minutes;
      const got = before - d.balance;
      ok = got > 0;
      if (ok && giver) {
        const cut = Math.round(got * 0.25);
        giver.cash -= cut;
        gained = paid(w, doer, cut, undefined, 'loans', boss);
        lines.push(`${giver.name} gets ${money(got)}. Your cut is ${money(cut)}.`);
        note = `Brought in ${money(got)} for ${giver.name}.`;
      } else lines.push(`${giver?.name ?? 'The boss'} gets nothing out of this.`);
      break;
    }

    case 'lean': {
      const b = w.biz[j.biz!];
      const o = w.chars[b.ownerId];
      if (!b.open || !o?.alive) return fail('The shop is shut. Nothing to lean on.');
      const r = perform(w, { kind: 'shakedown', actor: doer.id, target: o.id, biz: b.id, approach: AP(code), label: '', score: 0 });
      lines.push(...r.lines);
      minutes = r.minutes;
      ok = b.protection?.collectorId === doer.id;
      if (ok && giver) {
        gained = paid(w, doer, j.pay, giver, 'protection', boss);
        lines.push(`${giver.name} pays you ${money(gained)} for the shop.`);
      }
      // (he hasn't said yes, and hasn't said no for good: the matter is open between them, and so is the work. It is done when he
      // agrees, however that comes about (reached); it has not failed because the first conversation didn't settle it.)
      { const sit = askBetween(w, 'protect', doer.id, o.id, b.id); if (!ok && sit && isOpen(sit)) return { lines: [...lines, 'He hasn’t said yes. It isn’t over: it is between you and him now, and the work stays yours until it is settled.'], minutes, ok: false }; }
      break;
    }

    case 'handle': {
      const t = w.chars[j.target!];
      if (!t?.alive) return fail('He’s already out of the picture.');
      if (!giver) return fail('Nobody to answer to.');
      const guilty = j.cause ? w.facts[j.cause]?.actor === t.id : true;
      minutes = travelTime(doer.district, t.district) + 60;
      doer.district = t.district;
      // V89: a quiet word is a matter between the two men (asks.ts 'layoff'), not a roll: he weighs who is asking, whether he did
      // it at all and how much he wants at the man; whatever he says, the doer can go back to him, and if he agrees later the job
      // is done then. (If the world's matters are too many for one more, the old single answer stands in.)
      const quiet = code === 'warn' ? askBetween(w, 'layoff', doer.id, t.id) ?? openAsk(w, 'layoff', doer, t, { about: giver.id, why: `${giver.name} wants ${t.name} to leave him alone` }) : undefined;
      if (quiet) {
        quiet.m = { ...(quiet.m ?? {}), for: giver.id, ...(j.cause ? { fact: j.cause } : {}) };
        const o = askMove(w, quiet, 'ask');
        lines.push(...o.lines);
        // (a man sent to say it has done his part once it is said: the answer is the other man's to give, in his own time)
        ok = o.answer === 'yes' || (!doer.isPlayer && isOpen(quiet));
        if (!ok && isOpen(quiet)) {
          if (doer.isPlayer) { quiet.m.job = j.id; lines.push(`It isn’t settled. ${t.name.split(' ')[0]} knows what you came for, and you can go back to him.`); return { lines, minutes, ok: false }; }
          if (!guilty) note = `${t.name} swore it wasn't him.`;
        }
      } else if (code === 'warn') {
        const pr = clamp(0.45 + adj * 0.25 + (temper(t).caution - 0.5) * 0.5 - (temper(t).courage - 0.4) * 0.3, 0.1, 0.9);
        if (guilty && rng.chance(pr)) {
          const rest = Math.min(Math.round((t.cash * 0.5) / 10) * 10, 800);
          t.cash -= rest;
          giver.cash += rest;
          bear(w, t, doer.id, 0.05, `${doer.name} made him pay`);
          lines.push(rest >= 50 ? `${t.name} studies his shoes and agrees to make it right: ${money(rest)} to ${giver.name}.` : `${t.name} apologises. He has nothing to give, but he’ll stay away from ${giver.name}.`);
          ok = true;
        } else if (!guilty) {
          lines.push(rng.chance(0.6) ? `${t.name} looks genuinely baffled. He swears he never touched ${giver.name}'s place. You’re not sure you believe him.` : `${t.name} denies everything, a little too smoothly.`);
          bear(w, t, doer.id, 0.15, `${doer.name} accused him of something he did not do`);
          note = `${t.name} swore it wasn't him.`;
        } else {
          lines.push(`${t.name} tells you to mind your own business. The door closes on the last word.`);
          bear(w, t, doer.id, 0.15, `${doer.name} came accusing him`);
        }
      } else if (code === 'squeeze') {
        const amt = Math.min(Math.round((t.cash * 0.6) / 10) * 10, 1000);
        if (amt < 100) lines.push(`${t.name} has nothing worth taking. You walk out with your pride and an empty pocket.`);
        else if (rng.chance(clamp(0.7 + adj * 0.2 - temper(t).courage * 0.4, 0.2, 0.9))) {
          t.cash -= amt;
          const toClient = Math.round(amt * 0.6);
          giver.cash += toClient;
          paid(w, doer, amt - toClient, undefined, 'handle', boss);
          bump(doer, 0.1);
          addFact(w, { kind: 'robbery', actor: doer.id, victim: t.id, amount: amt, text: `${doer.name} squeezed ${t.name} for ${money(amt)} on ${giver.name}'s behalf.`, district: t.district }, { witnesses: witnessesAt(w, t.district, [doer.id, t.id], 2) });
          lines.push(`${t.name} counts out ${money(amt)} with shaking hands. He knows exactly who sent you.`);
          ok = true;
        } else {
          bear(w, t, doer.id, 0.2, `${doer.name} leaned on him`);
          lines.push(`${t.name} spits a refusal and tells you what he thinks of you. It’s not flattering.`);
        }
      } else {
        const r = perform(w, { kind: 'retaliate', mode: 'beat', actor: doer.id, target: t.id, label: '', score: 0 });
        lines.push(...r.lines);
        minutes += r.minutes;
        ok = t.hurtUntil > w.now;
      }
      if (ok) {
        gained = paid(w, doer, j.pay, giver, 'handle', boss);
        if (gained > 0) lines.push(`${giver.name} pays you ${money(gained)}.`);
        if (!guilty) {
          lines.push(rng.chance(0.5) ? `${t.name} kept insisting it wasn't him. You find yourself wondering.` : `Something about it doesn't sit right.`);
          note = `It may not have been ${t.name} after all.`;
        }
      }
      break;
    }

    case 'hit': {
      const t = w.chars[j.target!];
      if (!t?.alive) return fail('He’s already dead. Somebody got there first.');
      if (code === 'self') {
        const r = perform(w, { kind: 'retaliate', mode: 'hit', actor: doer.id, target: t.id, label: '', score: 0 });
        lines.push(...r.lines);
        minutes = r.minutes;
        ok = !t.alive;
        if (ok) afterClient(w, doer, t, { client: j.via === 'contract' ? giver?.id : undefined, false: j.claimTrue === false, accuser: giver?.id });
      } else {
        const fee = Math.round((j.pay * 0.35) / 50) * 50;
        if (doer.cash < fee) return fail(`You can’t cover the specialist's ${money(fee)}.`);
        doer.cash -= fee;
        minutes = 240;
        if (rng.chance(0.8)) {
          const kin = Object.values(w.chars).filter((y) => y.alive && y.id !== t.id && ((t.familyId && y.familyId === t.familyId) || (y.rels[t.id]?.affection ?? 0) > 0.4)).map((y) => y.id);
          handleDeath(w, t.id);
          const mf = addFact(w, { kind: 'murder', actor: giver?.id, victim: t.id, hiddenActor: true, text: `${giver?.name ?? 'Someone'} had ${t.name} killed.`, textHidden: `${t.name} was found dead.`, district: t.district }, { broadcast: kin });
          afterKilling(w, doer, t, mf, { client: j.via === 'contract' ? giver?.id : undefined, false: j.claimTrue === false, accuser: giver?.id });
          if (giver) tension(w, giver, t, 3);
          ok = true;
          lines.push(`The specialist does it cleanly. ${t.name} is dead and your name is nowhere near it. ${giver?.name ?? 'The client'}'s might be.`);
        } else lines.push('The specialist walks away from it. No refund.');
      }
      if (ok && giver) {
        gained = paid(w, doer, j.pay, giver, 'hit', boss);
        lines.push(`${giver.name} pays ${money(gained)}.`);
        if (!t.familyId) {
          repute(w, p, -3, 'botched');
          lines.push('Killing a civilian for money isn’t the work your family respects. (standing -3)');
        }
      }
      break;
    }

    case 'boost': {
      const cfg = ({ lot: { n: [1, 2], risk: 0.15, heat: 0.1 }, street: { n: [2, 3], risk: 0.3, heat: 0.2 }, showroom: { n: [3, 5], risk: 0.5, heat: 0.35 } } as Record<string, { n: number[]; risk: number; heat: number }>)[code];
      minutes = rng.int(150, 300);
      const risk = clamp(cfg.risk + (0.5 - doer.traits.caution) * 0.2 - adj * 0.3, 0.05, 0.8);
      if (!rng.chance(risk)) {
        const n = rng.int(cfg.n[0], cfg.n[1]);
        doer.cars += n;
        bump(doer, cfg.heat);
        ok = true;
        const civs = Object.values(w.chars).filter((c) => c.alive && !c.familyId);
        const v = civs.length ? rng.pick(civs) : undefined;
        addFact(w, { kind: 'theft', actor: doer.id, victim: v?.id, amount: n, hiddenActor: true, text: `${doer.name} stole ${n} cars in ${doer.district}.`, textHidden: `${n} cars were stolen in ${doer.district}.`, district: doer.district }, { witnesses: witnessesAt(w, doer.district, [doer.id], 2).filter(() => rng.chance(0.3)) });
        lines.push(`${n} cars, no questions, and nobody the wiser. For tonight.`);
        if (giver && j.via === 'opportunity') {
          gained = paid(w, doer, n * j.pay, giver, 'boost', boss);
          doer.cars -= n;
          lines.push(`${giver.name} takes them for ${money(gained)}.`);
        } else lines.push('They need selling. Try a garage or a chop shop.');
        note = `${n} cars boosted.`;
      } else {
        bump(doer, cfg.heat * 1.5);
        lines.push('A patrol rolls through at the wrong moment. You drop the job and run.');
        if (code === 'showroom' && rng.chance(0.35)) {
          jail(w, doer, rng.int(3, 15), 'Caught in the showroom, red-handed. There was no talking your way out of that.');
          lines.push('Not fast enough. You’re arrested.');
          note = `${doer.name} was arrested.`;
        }
      }
      break;
    }

    case 'burgle': {
      const b = w.biz[j.biz!];
      const o = w.chars[b.ownerId];
      if (!b.open || !o?.alive) return fail('The shop is shut. No stock, no job.');
      const quiet = code === 'quiet';
      minutes = rng.int(120, 240);
      doer.district = b.district;
      const guarded = b.lastApproach !== undefined && w.now - b.lastApproach < 14 * DAY;
      b.lastApproach = w.now;
      if (guarded) lines.push(`${o.name} has had a rough week and is watching the place like a hawk.`);
      const risk = clamp((quiet ? 0.28 : 0.18) + (guarded ? 0.3 : 0) + (0.5 - doer.traits.caution) * 0.2 - adj * 0.3, 0.05, 0.85);
      if (rng.chance(risk)) {
        bump(doer, quiet ? 0.15 : 0.3);
        lines.push(quiet ? 'A dog starts barking. You walk away.' : 'The alarm and a neighbour at the same time. You leave empty-handed.');
        if (!quiet && rng.chance(0.35)) {
          jail(w, doer, rng.int(5, 20), 'The alarm went, a neighbour saw you, and the police were there before you were round the corner.');
          lines.push('The police are quicker than you hoped. You’re arrested.');
          note = `${doer.name} was arrested.`;
        }
        break;
      }
      const value = Math.min(2500, Math.round((b.income * rng.range(0.7, 1.3) * (quiet ? 1 : 1.3)) / 50) * 50);
      doer.goods += value;
      bump(doer, quiet ? 0.15 : 0.3);
      if (!quiet) b.damaged = Math.max(b.damaged, 1);
      ok = true;
      const f = addFact(w, { kind: 'burglary', actor: doer.id, victim: o.id, business: b.id, amount: value, hiddenActor: true, text: `${doer.name} burgled ${b.name}.`, textHidden: `${b.name} was burgled.`, district: b.district }, { witnesses: witnessesAt(w, b.district, [doer.id, o.id], 2).filter(() => rng.chance(0.3)) });
      notifyProtector(w, b, f);
      lines.push(`You carry out about ${money(value)} in goods. Heavy, hot and not yours.`);
      if (b.protection && b.protection.familyId !== doer.familyId) lines.push(`${b.name} pays ${w.fam[b.protection.familyId].name} protection. They’ll take this personally if they learn who did it.`);
      if (giver && j.via === 'opportunity') {
        gained = paid(w, doer, Math.round(value * 0.55), giver, 'burgle', boss);
        doer.goods -= value;
        lines.push(`${giver.name} takes the lot for ${money(gained)}.`);
      } else lines.push('Pawn it or fence it when things cool down.');
      note = `Goods worth about ${money(value)}.`;
      break;
    }

    case 'scam': {
      const m = w.chars[j.target!];
      if (!m?.alive) return fail('Your mark is gone.');
      const b = ownerBiz(w, m.id);
      doer.district = m.district;
      minutes = rng.int(90, 180);
      const cfg = ({ charity: { base: 0.8, amt: () => rng.int(150, 350) }, insurance: { base: 0.65, amt: () => Math.min(900, Math.round((m.cash * 0.5) / 10) * 10) }, rigged: { base: 0.55, amt: () => Math.min(1200, Math.round((m.cash * 0.8) / 10) * 10) }, fakecoll: { base: 0.7, amt: () => rng.int(180, 420) }, pyramid: { base: 0.45, amt: () => Math.min(2000, Math.round((m.cash * 0.9) / 10) * 10) } } as Record<string, { base: number; amt: () => number }>)[code];
      if (code === 'rigged') {
        if (doer.cash < 300) return fail('You need a $300 stake for a rigged game.');
        doer.cash -= 300;
      }
      const wary = (m.cooldown.scammed ?? 0) > w.now;
      m.cooldown.scammed = w.now + 21 * DAY;
      const pr = clamp(cfg.base - (wary ? 0.35 : 0) - (temper(m).caution - 0.5) * 0.6 + (doer.traits.sociability - 0.5) * 0.2 + adj * 0.4, 0.1, 0.9);
      const amt = Math.min(cfg.amt(), Math.floor(m.cash * 0.8));
      if (amt < 100) {
        if (code === 'rigged') doer.cash += 300;
        return fail(`${m.name} has too little on him to be worth the effort.`);
      }
      const wit = witnessesAt(w, m.district, [doer.id, m.id], 2).filter(() => rng.chance(0.25));
      if (rng.chance(pr)) {
        m.cash -= amt;
        if (code === 'rigged') doer.cash += 300;
        gained = paid(w, doer, amt, undefined, 'scam', boss);
        ok = true;
        lines.push(`${m.name} swallows every word. You leave ${money(amt)} richer and he thanks you for it.`);
        if (code === 'pyramid') {
          bump(doer, 0.3);
          lines.push('A pyramid always comes down. He’ll bring in others, and when it falls, they’ll all want to know whose idea it was.');
        }
        if (rng.chance(0.4 + temper(m).caution * 0.3)) {
          const f = addFact(w, { kind: 'scam', actor: doer.id, victim: m.id, business: b?.id, amount: amt, hiddenActor: true, text: `${doer.name} swindled ${m.name} out of ${money(amt)}.`, textHidden: `${m.name} was swindled out of ${money(amt)} by a smooth talker.`, district: m.district }, { witnesses: wit });
          if (b) notifyProtector(w, b, f);
          lines.push(`He’ll work it out eventually. When he does, he'll go looking for whoever he thinks did it.`);
          note = `${m.name} will notice.`;
        }
      } else {
        bump(doer, 0.05);
        const f = addFact(w, { kind: 'scam', actor: doer.id, victim: m.id, business: b?.id, amount: 0, hiddenActor: true, text: `${doer.name} tried to swindle ${m.name}.`, textHidden: `A smooth talker tried to swindle ${m.name}.`, district: m.district }, { witnesses: wit });
        if (b) notifyProtector(w, b, f);
        lines.push(`${m.name} sees through it and shows you the door. He won't forget your face.`);
      }
      break;
    }
  }
  return done();
}

// ------------------------------------------------------- delegated jobs

function autoResolve(w: World, j: Job) {
  runCrewJob(w, j);
  judge(w, j); // an NPC superior weighs what he was told (work.ts); the player does it himself
}

// Whether a job is the player's business: his to do, or given by him (his orders carry no giver). Work NPC superiors give their
// own men runs through the same records but isn't his to see.
export const playerSide = (w: World, j: Job) => j.assignee === w.playerId || j.giver === w.playerId || (j.giver === null && j.via === 'order');

// A job nobody needs any more should not sit in the inbox: somebody else got there, or the reason went away.
export function staleReason(w: World, j: Job): string | null {
  const p = PL(w);
  { const gs = gigStale(w, j); if (gs) return gs; }
  if (j.kind === 'summons') {
    if (j.meeting === 'sitdown') {
      const g = w.grievances.find((q) => q.id === j.extra?.g);
      if (!g || g.status !== 'open') return 'It sorted itself out.';
    }
    return null;
  }
  if (j.status === 'offered' && w.jobs.some((q) => q !== j && q.kind === j.kind && q.target === j.target && q.biz === j.biz && (q.status === 'active' || (q.status === 'offered' && q.created < j.created) || (q.status === 'offered' && q.created === j.created && q.id < j.id)))) return 'Already in hand.';
  const t = j.target ? w.chars[j.target] : undefined;
  if (j.target && !t?.alive) return `${t?.name ?? 'He'} is dead. Somebody else dealt with it.`;
  if (!w.chars[j.assignee]?.alive) return 'The man on it’s gone.';
  if (j.giver && !w.chars[j.giver]?.alive && j.via !== 'order' && j.via !== 'scheme') return 'The man who asked is dead.';
  if (j.debt) {
    const d = w.debts.find((q) => q.id === j.debt);
    if (!d || d.status !== 'active') return 'The debt is settled. Somebody got there first.';
    if (d.missed < 1 && j.kind === 'collect') return 'He caught up on the payments.';
  }
  const b = j.biz ? w.biz[j.biz] : undefined;
  if (j.biz && !b?.open) return `${b?.name ?? 'The place'} has closed.`;
  if (j.kind === 'lean' && b?.protection && b.protection.familyId === p.familyId) return `${b.name} already pays the family.`;
  if (j.kind === 'shake' && b && lateOf(b) < 1) return `${b.name} paid up.`;
  if (j.kind === 'fix' && t && t.jailedUntil <= w.now) return `${t.name} is already out.`;
  if (j.kind === 'handle' && t && j.via !== 'boss' && (p.rels[t.id]?.grudge ?? 0) < 0.05 && j.giver && (w.chars[j.giver]?.rels[t.id]?.grudge ?? 0) < 0.1) return 'The bad blood is gone. It’s no longer a job.';
  return null;
}
export function pruneJobs(w: World) {
  const p = PL(w);
  reached(w); // (what was asked for and has been done is done, not "no longer needed")
  for (const j of w.jobs) {
    if (j.status !== 'offered' && j.status !== 'active') continue;
    const why = staleReason(w, j);
    if (!why) continue;
    j.status = 'expired';
    j.notes = [...(j.notes ?? []), why];
    if (playerSide(w, j)) addFact(w, { kind: 'report', actor: j.giver ?? undefined, minor: true, text: `${j.title}: no longer needed. ${why}`, district: p.district }, { witnesses: [p.id] });
  }
}

export function daily(w: World) {
  const p = PL(w);
  if (!p) return;
  pruneJobs(w);
  for (const j of w.jobs) {
    if (j.status === 'offered' && w.now >= j.expires) {
      j.status = 'expired';
      const g = j.giver ? w.chars[j.giver] : undefined;
      if (j.via === 'boss' && g) {
        repute(w, p, -3, 'ignored summons');
        feel(w, g, p.id, 'trust', -0.05);
        // Ignoring the man who runs your end twice in a month is asking for it.
        if (j.kind === 'summons' && w.jobs.filter((q) => q.kind === 'summons' && q.status === 'expired' && w.now - q.expires < 30 * DAY).length >= 2 && p.hurtUntil <= w.now) {
          // (it is done to him, so he knows it, and why: from the man who did it)
          const missed = w.jobs.filter((q) => q.kind === 'summons' && q.status === 'expired' && q.giver === g.id && w.now - q.expires < 30 * DAY).length;
          if (temper(g).volatility > 0.5) {
            p.hurtUntil = w.now + 3 * DAY;
            bear(w, p, g.id, 0.3, `${g.name} had him roughed up for not coming when called`);
            addFact(w, { kind: 'discipline', actor: g.id, victim: p.id, text: `${g.name} had ${p.name} beaten for ignoring him.`, district: p.district }, { witnesses: [] }); // (he hears it from the man himself: imposed)
            imposed(w, p, g, { title: `${g.name.split(' ')[0]} had you roughed up`, said: `Two of ${g.name.split(' ')[0]}’s men catch you outside. When they’re done, one of them says: “He sent for you ${missed > 2 ? `${missed} times` : 'twice'}. You didn’t come.”`, why: 'When I send for a man, he comes. You didn’t, more than once. Now you know what it costs.', record: `${g.name} had you beaten for not coming when he sent for you.` });
          } else {
            p.kickRate = Math.min(0.35, p.kickRate + 0.05);
            addFact(w, { kind: 'discipline', actor: g.id, victim: p.id, text: `${g.name} raised ${p.name}'s share for ignoring him.`, district: p.district }, { witnesses: [] }); // (he hears it from the man himself: imposed)
            imposed(w, p, g, { title: `${g.name.split(' ')[0]} raised your share`, said: `Word comes from ${g.name.split(' ')[0]}: from this Sunday you pass up ${Math.round(p.kickRate * 100)} percent. “He sent for you ${missed > 2 ? `${missed} times` : 'twice'}. A man who can’t find the time to come can find the money.”`, why: 'I sent for you and you didn’t come. Twice. A man who has no time for me can pay for the privilege.', record: `${g.name} raised your share to ${Math.round(p.kickRate * 100)} percent for not coming when he sent for you.` });
          }
        }
      // (a favour asked and let lapse costs a little; a word about a mark is only information, and passing on it costs nothing)
      } else if (g && j.via !== 'opportunity') feel(w, g, p.id, 'trust', -0.03);
    }
  }
  for (const j of w.jobs) if (j.status === 'active' && j.due !== undefined && j.due <= w.now && j.assignee !== p.id) autoResolve(w, j);
  if (w.jobs.length > 80) w.jobs = w.jobs.filter((j) => j.status === 'offered' || j.status === 'active' || w.now - j.created < 20 * DAY);
  if (!p.alive) return;
  if (w.jobs.filter((j) => j.status === 'offered').length < 4 && w.rng.chance(0.6)) newOffer(w);
  gigTick(w);
}

// ----------------------------------------------------------------- ventures

export function ventureWeek(w: World) {
  for (const v of w.ventures) {
    if (!v.open) continue;
    const owner = w.chars[v.ownerId];
    const host = w.chars[v.hostId];
    const b = w.biz[v.bizId];
    if (!owner?.alive) {
      v.open = false;
      continue;
    }
    v.weeks++;
    const processed = Math.min(v.stock, 2);
    if (processed > 0) {
      const rev = processed * 1000;
      v.takings += rev;
      v.stock -= processed;
      const cut = Math.round(rev * v.hostShare);
      if (host?.alive) host.cash += cut;
      earn(owner, rev - cut, 'scheme');
      bump(owner, 0.05 * processed);
    }
    if (w.rng.chance(0.03 + 0.025 * v.stock + 0.02 * processed)) {
      v.open = false;
      v.stock = 0;
      if (b) b.damaged = Math.max(b.damaged, 2);
      const kin = Object.values(w.chars).filter((x) => x.alive && x.familyId && x.familyId === owner.familyId).map((x) => x.id);
      addFact(w, { kind: 'raid', actor: owner.id, text: `Police raided ${b?.name ?? 'a garage'}: a chop shop, with ${owner.name}'s name on it.`, district: b?.district ?? owner.district }, { broadcast: kin });
      if (w.rng.chance(0.5)) jail(w, owner, w.rng.int(10, 30));
    }
  }
}

export function ventureOf(w: World, c: Character) {
  return w.ventures.find((v) => v.open && v.ownerId === c.id);
}

// ------------------------------------------------------------------ schemes

export function startScheme(w: World, p: Character, spec: { kind: 'boost' | 'burgle' | 'scam'; biz?: Id; target?: Id }): Job {
  const existing = w.jobs.find((j) => j.via === 'scheme' && j.status === 'active' && j.kind === spec.kind && j.biz === spec.biz && j.target === spec.target);
  if (existing) return existing;
  const b = spec.biz ? w.biz[spec.biz] : undefined;
  const titles = { boost: 'Boost some cars', burgle: `Burgle ${b?.name ?? 'a shop'}`, scam: `Work ${spec.target ? w.chars[spec.target].name : 'a mark'}` };
  const briefs = {
    boost: 'Your own idea. Steal cars and sell them to a garage or run them through a chop shop. Every car adds to the heat.',
    burgle: `Your own idea. ${b?.name ?? 'The shop'} in ${b?.district ?? 'town'} has stock worth taking. Whatever you take, you’ll need to fence.`,
    scam: `Your own idea. Find out how much ${spec.target ? w.chars[spec.target].name : 'he'} will give up if he’s told the right story.`,
  };
  return mkJob(w, { kind: spec.kind, title: titles[spec.kind], brief: briefs[spec.kind], giver: null, via: 'scheme', assignee: p.id, biz: spec.biz, target: spec.target, pay: 0, status: 'active', days: 5 });
}

export function schemes(w: World, p: Character): SchemeOpt[] {
  const out: SchemeOpt[] = [];
  out.push({ label: 'Boost cars', hint: 'Steal cars to sell or chop. Heat goes up.', job: { kind: 'boost' } });
  const near = (a: { district: string }, b: { district: string }) => Number(b.district === p.district) - Number(a.district === p.district);
  for (const b of Object.values(w.biz).filter((x) => x.open && x.kind !== 'casino' && x.protection?.familyId !== p.familyId && w.chars[x.ownerId]?.alive).sort((a, b) => near(a, b) || b.income - a.income).slice(0, 4))
    out.push({ label: `Burgle ${b.name} (${b.district})`, hint: b.protection ? `Protected by ${w.chars[b.protection.collectorId]?.name ?? 'someone'} of ${w.fam[b.protection.familyId].name}. They’ll take it personally.` : 'Nobody’s looking after it.', job: { kind: 'burgle', biz: b.id } });
  for (const b of Object.values(w.biz).filter((x) => x.open && x.kind !== 'casino' && x.ownerId !== p.id && w.chars[x.ownerId]?.alive).sort((a, b) => near(a, b) || b.income - a.income).slice(0, 4)) {
    const o = w.chars[b.ownerId];
    out.push({ label: `Work ${o.name} at ${b.name}`, hint: o.traits.caution > 0.65 ? 'Looks careful with his money.' : o.traits.caution < 0.4 ? 'Looks trusting.' : 'Hard to read.', job: { kind: 'scam', biz: b.id, target: o.id } });
  }
  const v = ventureOf(w, p);
  if (!v) {
    for (const b of Object.values(w.biz).filter((x) => x.open && x.kind === 'garage' && w.chars[x.ownerId]?.alive).slice(0, 2)) {
      const o = w.chars[b.ownerId];
      out.push({ label: `Chop shop with ${o.name} at ${b.name}: partner ($2,000)`, hint: 'He gets 30% and stays friendly.', move: { kind: 'chop_start', actor: p.id, biz: b.id, code: 'partner', label: '' } });
      out.push({ label: `Chop shop at ${b.name}: lean on ${o.name} ($300)`, hint: 'He gets 15% and resents it.', move: { kind: 'chop_start', actor: p.id, biz: b.id, code: 'strongarm', label: '' } });
    }
  } else if (p.cars > 0) out.push({ label: `Deliver ${p.cars} cars to your chop shop`, hint: 'It processes two a week.', move: { kind: 'deliver_cars', actor: p.id, label: '' } });
  if (p.cars > 0)
    for (const b of Object.values(w.biz).filter((x) => x.open && x.kind === 'garage' && w.chars[x.ownerId]?.alive).slice(0, 2))
      out.push({ label: `Sell ${p.cars} cars to ${w.chars[b.ownerId].name} (${money(p.cars * 550)})`, hint: 'No questions, $550 a car.', move: { kind: 'sell_cars', actor: p.id, biz: b.id, label: '' } });
  if (p.goods > 0)
    for (const b of Object.values(w.biz).filter((x) => x.open && x.kind === 'pawnshop' && w.chars[x.ownerId]?.alive).slice(0, 2))
      out.push({ label: `Pawn ${money(p.goods)} in goods at ${b.name} (${money(Math.round(p.goods * 0.4))})`, hint: '40% of what it’s worth.', move: { kind: 'pawn_goods', actor: p.id, biz: b.id, label: '' } });
  return out;
}

export function crewMoves(w: World, p: Character): Move[] {
  if (!crewOf(w).length) return [];
  return [
    { kind: 'bonus', actor: p.id, label: `Pay every man a $100 bonus (${money(100 * crewOf(w).length)})` },
  ];
}

export function topicOptions(w: World, p: Character, t: Character): Move[] {
  const out: Move[] = [];
  const mv = (code: string, label: string) => out.push({ kind: 'topic', actor: p.id, target: t.id, code, label });
  mv('ask', 'Ask what he has heard lately');
  if (t.id === p.bossId) mv('bossjob', 'Ask whether there’s any work');
  else mv('work', 'Ask if he knows of any work');
  const b = ownerBiz(w, t.id);
  if (b && t.rank === 'civilian') {
    mv('money', 'Ask how business is');
    if (b.protection?.familyId !== p.familyId) mv('protect', 'Suggest he could use some friends');
  }
  mv('drink', 'Stand him a drink ($40)');
  return out;
}

// -------------------------------------------------------------------- moves

export function performMove(w: World, m: Move): { minutes: number; lines: string[] } {
  const p = PL(w);
  const lines: string[] = [];
  const rng = w.rng;
  switch (m.kind) {
    case 'sell_cars': {
      const b = w.biz[m.biz!];
      const n = p.cars;
      if (n <= 0) return { minutes: 10, lines: ['You have no cars to sell.'] };
      const mins = travelTime(p.district, b.district) + 45;
      p.district = b.district;
      earn(p, n * 550, 'boost');
      p.cars = 0;
      lines.push(`${w.chars[b.ownerId].name} counts out ${money(n * 550)} and the cars are gone by morning.`);
      return { minutes: mins, lines };
    }
    case 'pawn_goods': {
      const b = w.biz[m.biz!];
      const amt = Math.round(p.goods * 0.4);
      if (amt <= 0) return { minutes: 10, lines: ['You have nothing to pawn.'] };
      const mins = travelTime(p.district, b.district) + 45;
      p.district = b.district;
      earn(p, amt, 'burgle');
      p.goods = 0;
      lines.push(`${w.chars[b.ownerId].name} takes the lot and pays ${money(amt)}.`);
      return { minutes: mins, lines };
    }
    case 'deliver_cars': {
      const v = ventureOf(w, p);
      if (!v || p.cars <= 0) return { minutes: 10, lines: ['Nothing to deliver.'] };
      v.stock += p.cars;
      lines.push(`${p.cars} cars go into the back bay. The shop clears two a week.`);
      p.cars = 0;
      return { minutes: 60, lines };
    }
    case 'chop_start': {
      const b = w.biz[m.biz!];
      const host = w.chars[b.ownerId];
      if (ventureOf(w, p)) return { minutes: 10, lines: ['You already have a chop shop running.'] };
      const partner = m.code === 'partner';
      const cost = partner ? 2000 : 300;
      if (p.cash < cost) return { minutes: 10, lines: [`You need ${money(cost)}.`] };
      const mins = travelTime(p.district, b.district) + 60;
      p.district = b.district;
      const accept = partner ? rng.chance(clamp(0.85 - temper(host).caution * 0.3, 0.4, 0.9)) : rng.chance(clamp(0.6 - temper(host).courage * 0.5 + p.traits.violence * 0.3, 0.15, 0.9));
      if (!accept) {
        bear(w, host, p.id, (partner ? 0.05 : 0.25), `${p.name} wanted in on his place`);
        lines.push(`${host.name} wants no part of it. He looks past you at the street.`);
        return { minutes: mins, lines };
      }
      p.cash -= cost;
      host.cash += cost;
      if (!partner) bear(w, host, p.id, 0.2, `${p.name} forced his way in`);
      w.ventures.push({ id: newId(w, 'v'), ownerId: p.id, bizId: b.id, hostId: host.id, hostShare: partner ? 0.3 : 0.15, stock: 0, since: w.now, weeks: 0, takings: 0, open: true });
      lines.push(`${host.name} gives you the back bay at ${b.name}. Bring it cars; it clears two a week. Raids are always a risk, and more cars means more risk.`);
      return { minutes: mins, lines };
    }
    case 'meeting': {
      const crew = crewOf(w);
      if (!crew.length) return { minutes: 15, lines: ['You have nobody left to meet.'] };
      lines.push('You gather the crew in the back of a bar.');
      const before = w.jobs.length;
      for (const c of crew) {
        if (c.jailedUntil > w.now) {
          lines.push(`${c.name} is locked up.`);
          continue;
        }
        for (const [a, b] of [[c, p], [p, c]] as [Character, Character][]) {
          const r = rel(a, b.id);
          feelOn(w, r, 'trust', 0.03);
          feelOn(w, r, 'respect', 0.02);
        }
        const debt = w.debts.find((d) => d.status === 'active' && d.debtor === c.id);
        lines.push(`${c.name} (${traitWords(c)}), ${money(c.cash)}${c.heat > 0.4 ? ', running hot' : ''}${debt ? `, owes ${w.chars[debt.creditor].name} ${money(debt.balance)}` : ''}.`);
        share(w, c, p, lines);
        share(w, p, c, []);
        if (rng.chance(0.5)) tipFrom(w, c);
      }
      if (w.jobs.length > before) lines.push('One of them has brought you something. Check your messages.');
      return { minutes: 120, lines };
    }
    case 'bonus': {
      const crew = crewOf(w);
      const cost = 100 * crew.length;
      if (!crew.length) return { minutes: 10, lines: ['You have nobody to pay.'] };
      if (p.cash < cost) return { minutes: 10, lines: [`You need ${money(cost)}.`] };
      p.cash -= cost;
      for (const c of crew) {
        c.cash += 100;
        feel(w, c, p.id, 'trust', 0.1);
        feel(w, c, p.id, 'affection', 0.05);
      }
      lines.push(`You peel off ${money(100)} for each of them. They notice.`);
      return { minutes: 20, lines };
    }
    case 'topic': {
      const t = w.chars[m.target!];
      if (!t?.alive) return { minutes: 10, lines: ['He’s not there.'] };
      switch (m.code) {
        case 'ask': {
          const n = lines.length;
          share(w, t, p, lines);
          share(w, p, t, []);
          if (lines.length === n) lines.push(`${t.name} shakes his head. Nothing new.`);
          return { minutes: 30, lines };
        }
        case 'work':
        case 'bossjob': {
          if (m.code === 'bossjob') {
            lines.push(bossOffer(w, true) ? `${t.name} has something for you. ${jobSaid(w.jobs.at(-1)!)}` : `${t.name} tells you to finish what’s already on your plate first.`);
            return { minutes: 30, lines };
          }
          const before = w.jobs.length;
          if (rng.chance(0.35 + rel(t, p.id).trust * 0.5)) tipFrom(w, t) || oppFrom(w, t);
          lines.push(w.jobs.length > before ? `${t.name} puts something your way. ${jobSaid(w.jobs.at(-1)!)}` : `${t.name} shrugs. Nothing right now. Come back when there’s news.`);
          return { minutes: 30, lines };
        }
        case 'money': {
          const n = lines.length;
          confide(w, p, t, lines);
          if (lines.length === n) lines.push(`${t.name} says business is fine. Maybe it is.`);
          return { minutes: 30, lines };
        }
        case 'protect': {
          const b = ownerBiz(w, t.id);
          if (!b) return { minutes: 10, lines: ['He has no business to protect.'] };
          const r = perform(w, { kind: 'shakedown', actor: p.id, target: t.id, biz: b.id, approach: 'soft', label: '', score: 0 });
          return { minutes: 30 + r.minutes, lines: r.lines };
        }
        case 'drink': {
          if (p.cash < 40) return { minutes: 10, lines: ["You can't afford the round."] };
          p.cash -= 40;
          regard(w, t, p, 'trust', 0.06, 'drink');
          regard(w, t, p, 'affection', 0.06, 'drink');
          { const r = rel(p, t.id); feelOn(w, r, 'trust', 0.06); feelOn(w, r, 'affection', 0.06); }
          lines.push(`You buy ${t.name} a drink. His shoulders drop an inch.`);
          return { minutes: 45, lines };
        }
      }
      return { minutes: 10, lines };
    }
  }
}

// ------------------------------------------------- doubting an assignment

const ACCUSED_KINDS: Job['kind'][] = ['hit', 'handle'];
export const canQuestion = (j: Job) => ACCUSED_KINDS.includes(j.kind) && (j.status === 'offered' || j.status === 'active') && j.reason !== undefined;

const note = (j: Job, s: string) => {
  (j.notes ??= []).push(s);
  return s;
};
const did = (j: Job, k: string) => !!j.checked?.includes(k);
export const jobChecks = (j: Job) => ({ press: did(j, 'ask') && !did(j, 'press') && !!j.why, ask: !did(j, 'ask'), inv: !did(j, 'inv'), around: !did(j, 'around'), haggle: !j.haggled && j.pay > 0 && (j.kind === 'hit' || j.via === 'contract' || j.via === 'tip') });

// Ask the person who wants it done to explain. A liar doubles down; an honest man admits what he cannot prove.
export function questionJob(w: World, j: Job): { lines: string[]; minutes: number } {
  w0 = w;
  const p = PL(w);
  const g = j.giver ? w.chars[j.giver] : undefined;
  (j.checked ??= []).push('ask');
  if (!g) return { lines: [note(j, 'There’s nothing more to ask.')], minutes: 15 };
  const trust = rel(g, p.id).trust;
  const lines: string[] = [];
  if (j.why) {
    lines.push(`${g.name}: "${j.why.surface}"`);
    // the tell: a man telling a truth he believes sounds different from a man selling you one
    const lying = j.claimTrue === false;
    if (lying && w.rng.chance(clamp(0.45 + p.traits.caution * 0.25 - g.traits.caution * 0.2, 0.2, 0.8))) lines.push(pickTell(g, true));
    else if (!lying && w.rng.chance(0.55)) lines.push(pickTell(g, false));
    else lines.push(`You can’t tell if that’s the real reason or just the one he wants you to hear.`);
  } else lines.push(`${g.name}: "${j.reason ?? 'It’s personal.'}"`);
  void trust;
  for (const l of lines) note(j, l);
  return { lines, minutes: 20 };
}

const TELLS_LIE = [
  'He answers a half-second too fast, like it was rehearsed.',
  'He looks at the table, not at you, when he gets to the part that matters.',
  'He’s too calm. A man who’s angry about something real gets angry.',
  'He repeats himself, the same two phrases, as if saying them enough will make them heavier.',
];
const TELLS_TRUE = [
  'He’s rougher about it than he needs to be. That’s not an act.',
  'His hand isn’t steady on the glass. Whatever this is, it costs him.',
  'He holds your eye the whole time and doesn’t oversell it.',
  'He stops once and starts again. A liar doesn’t usually stop.',
];
const pickTell = (g: Character, lie: boolean) => (lie ? TELLS_LIE : TELLS_TRUE)[Math.floor(w0.rng.next() * 4)];
let w0: World;

// Lean on him until the first reason cracks and you hear the second one.
export function pressJob(w: World, j: Job): { lines: string[]; minutes: number } {
  const p = PL(w);
  const g = j.giver ? w.chars[j.giver] : undefined;
  (j.checked ??= []).push('press');
  if (!g || !j.why) return { lines: [note(j, 'He has said all he’s going to say.')], minutes: 15 };
  const r = rel(g, p.id);
  const pr = clamp(0.2 + r.trust * 0.45 + r.respect * 0.25 + (j.why.hidden ? -0.1 : 0.1), 0.1, 0.9);
  const lines: string[] = [];
  if (w.rng.chance(pr)) {
    lines.push(`He’s quiet for a bit, then lowers his voice. "${j.why.deep}"`);
    if (j.why.hidden) j.disproved = false;
    feelOn(w, r, 'trust', 0.03);
  } else {
    lines.push(`${g.name}: "${dodge(arch(g), j.id)}"`);
    feelOn(w, r, 'trust', -0.04);
  }
  for (const l of lines) note(j, l);
  return { lines, minutes: 15 };
}

// Check the allegation against the world. You are more likely to be right than wrong, but not certain.
export function investigateJob(w: World, j: Job): { lines: string[]; minutes: number } {
  const p = PL(w);
  const t = j.target ? w.chars[j.target] : undefined;
  (j.checked ??= []).push('inv');
  const lines: string[] = [];
  if (!t) return { lines: [note(j, 'You can’t find anything to check.')], minutes: 30 };
  const acc = clamp(0.6 + p.traits.caution * 0.2, 0.55, 0.85);
  const reveal = (truth: boolean, yes: string, no: string, unsure: string) => {
    if (!w.rng.chance(acc)) return unsure;
    return truth ? yes : no;
  };
  let supports: boolean | undefined;
  if (j.subject === 'disloyal') {
    const contacts = Object.values(w.chars).filter((y) => y.alive && y.familyId && y.familyId !== t.familyId && ((t.rels[y.id]?.trust ?? 0) >= 0.35 || (y.rels[t.id]?.trust ?? 0) >= 0.35));
    const truth = contacts.length > 0;
    supports = truth;
    lines.push(reveal(truth, `You find that ${t.name} has been seen with ${contacts[0]?.name} of the ${contacts[0] ? w.fam[contacts[0].familyId!].name : ''} family. That’s not nothing.`, `You look into who ${t.name} has been meeting. You find nothing that points outside the family.`, `You ask around, but nobody will say anything you can use.`));
  } else if (j.subject === 'skimming') {
    const gap = concealedGap(w, t);
    supports = gap > 40;
    lines.push(reveal(gap > 40, `You go through what ${t.name} has handed up against what he has earned. About ${money(gap)} doesn’t add up.`, `You go through ${t.name}'s dealings. The numbers hold up.`, `You can’t get a clear look at his books.`));
  } else if (j.cause) {
    const f = w.facts[j.cause];
    const truth = f?.actor === t.id;
    supports = truth;
    lines.push(reveal(truth, `You find witnesses and talk that point to ${t.name}. It looks right.`, `You ask around about what happened. Nothing ties ${t.name} to it.`, `The trail is cold. You can’t tell.`));
  } else {
    const friends = Object.values(w.chars).filter((y) => y.alive && (y.rels[t.id]?.trust ?? 0) >= 0.6).length;
    lines.push(`${t.name} is ${t.familyId ? `a ${t.rank} in the ${w.fam[t.familyId].name} family` : 'nobody special'}. About ${friends} people would take it personally if he disappeared.`);
  }
  if (supports !== undefined) {
    const said = lines[0];
    if (said.includes('can’t') || said.includes('cold') || said.includes('nobody will')) {
      /* inconclusive */
    } else j.disproved = !said.includes('not nothing') && !said.includes('doesn’t add up') && !said.includes('looks right') ? true : false;
  }
  for (const l of lines) note(j, l);
  return { lines, minutes: 90 };
}

// Another opinion.
export function askAroundJob(w: World, j: Job): { lines: string[]; minutes: number } {
  const p = PL(w);
  const t = j.target ? w.chars[j.target] : undefined;
  (j.checked ??= []).push('around');
  const lines: string[] = [];
  if (!t) return { lines: [note(j, 'There’s nobody to ask.')], minutes: 30 };
  const who = Object.values(w.chars)
    .filter((x) => x.alive && x.id !== t.id && x.id !== p.id && x.id !== j.giver && (p.rels[x.id]?.trust ?? 0) >= 0.3 && ((x.rels[t.id]?.trust ?? 0) > 0 || Object.values(x.known).length))
    .sort((a, b) => (b.rels[t.id]?.trust ?? 0) - (a.rels[t.id]?.trust ?? 0) + (p.rels[b.id]?.trust ?? 0) - (p.rels[a.id]?.trust ?? 0))[0];
  if (!who) return { lines: [note(j, 'Nobody you trust knows him well enough to say.')], minutes: 40 };
  const r = who.rels[t.id];
  const view = !r ? 'barely knows' : r.grudge >= 0.3 ? 'has no time for' : r.trust > 0.6 ? 'vouches for' : r.trust > 0.35 ? 'has nothing against' : 'is wary of';
  lines.push(`${who.name} ${view} ${t.name}.`);
  const f = Object.values(w.facts).filter((q) => q.actor === t.id && who.known[q.id] && !q.minor && ['beating', 'robbery', 'vandalism', 'poach', 'burglary', 'scam', 'theft', 'shortfall'].includes(q.kind)).sort((a, b) => b.t - a.t)[0];
  if (f) lines.push(`He adds: "${who.known[f.id].knowsActor ? f.text : f.textHidden ?? f.text}"`);
  else lines.push(`He has heard nothing bad about him.`);
  for (const l of lines) note(j, l);
  return { lines, minutes: 45 };
}

export function haggleJob(w: World, j: Job): { lines: string[]; minutes: number } {
  const p = PL(w);
  const g = j.giver ? w.chars[j.giver] : undefined;
  j.haggled = true;
  if (!g) return { lines: ['There’s no one to haggle with.'], minutes: 10 };
  // V89: pushing for more is an ask (asks.ts 'jobpay'): he comes up, meets you part way with the reason he has, or won't; and it
  // stays between you, so you can take his figure later, settle for less, or let it go, in conversation with him.
  const other = askBetween(w, 'jobpay', p.id, g.id); // (one haggle with a man at a time: another job's stays as it was)
  const s = other ? (other.m?.job === j.id ? other : undefined) : openAsk(w, 'jobpay', p, g, { amt: Math.round((j.pay * 1.3) / 50) * 50, about: j.id, why: `${p.name} wanted more for ${j.title}` });
  if (s) {
    s.m = { ...(s.m ?? {}), job: j.id };
    const o = askMove(w, s, 'ask');
    return { lines: o.lines.map((l) => note(j, l)), minutes: 15 };
  }
  const pr = clamp(0.35 + p.standing / 100 * 0.3 - g.traits.greed * 0.2 + rel(g, p.id).respect * 0.2, 0.1, 0.75);
  if (w.rng.chance(pr)) {
    j.pay = Math.round((j.pay * 1.3) / 50) * 50;
    return { lines: [note(j, `${g.name} grumbles and comes up. It’s now ${money(j.pay)}.`)], minutes: 15 };
  }
  feel(w, g, p.id, 'trust', -0.05);
  return { lines: [note(j, `${g.name} doesn’t like being pushed. The price stays where it was.`)], minutes: 15 };
}

// V90: a job, as the man giving it says it aloud (so asking for work is answered with the work, not with "he names something").
const IMPERATIVE = new Set(['Bring', 'Burgle', 'Carry', 'Collect', 'Find', 'Get', 'Guard', 'Lean', 'Ride', 'Shake', 'Spend', 'Take', 'Watch', 'Work']);
export function jobSaid(j: Job): string {
  const first = j.title.split(' ')[0];
  return IMPERATIVE.has(first) ? `“I need somebody to ${j.title.charAt(0).toLowerCase() + j.title.slice(1)}. It’s yours if you want it.”` : `“Here’s one for you. ${j.title}.”`;
}
