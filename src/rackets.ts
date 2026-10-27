import { hasPerk } from './specs';
// Ongoing operations. Each one has a runner, a weekly take, and a way to go wrong. Money from these comes through the books
// like everything else, so what your superiors can see is a choice with consequences.
import { aptitude, grow } from './people';
import { addFact, bearOn, clamp, createDebt, earn, feel, feelOn, money, newId, ownerBiz, rel } from './core';
import { move, openAsk } from './asks';
import { askToInvest } from './reports';
import { temper } from './temper';
import { addEnc } from './encounters';
import { bookWeek } from './book';
import { recordWeek } from './standing';
import { developments, meetWeek, opsChangeHands, paperWeek, payOpStakes, PILOT, pilotWeek, pruneCars } from './enterprise';
import { Character, DAY, Id, Op, OpKind, WEEK, World } from './types';
import { arch, pick } from './voice';

export interface OpDef {
  label: string;
  group: string;
  cost: number;
  base: number;
  risk: number;
  heat: number;
  rank: 'associate' | 'soldier';
  districts?: string[];
  blurb: string;
  skill: string;
  src?: string; // how its money shows in a man's books (books.SOURCE_LABEL), when not its own kind
  bad?: string[]; good?: string[]; // what a bad week and a good one look like
}
export type OpKey = Exclude<OpKind, 'hijack'>;
export const OPS: Record<OpKey, OpDef> = {
  numbers: { label: 'Numbers bank', group: 'Betting', cost: 600, base: 420, risk: 0.05, heat: 0.03, rank: 'associate', skill: 'numbers', blurb: 'Runners take nickel and dime bets in bars and barbershops. You pay the hits. Steady money, steady attention.', bad: ['a runner skipped town with the slips', 'a big hit came in and he had to pay out', 'two of his corner shops stopped taking bets after a police visit'], good: ['the corner is busy and the slips are thick'] },
  bookie: { label: 'Bookmaking', group: 'Betting', cost: 400, base: 450, risk: 0.04, heat: 0.025, rank: 'associate', skill: 'numbers', blurb: 'Sports and the horses. Wonderful until a favourite comes in.', bad: ['the favourite came in and the book took a beating', 'a regular welshed on a big bet', 'he laid off too much and ate it'], good: ['the book fell his way'] },
  vending: { label: 'Jukeboxes and vending', group: 'Street trades', cost: 800, base: 380, risk: 0.015, heat: 0.01, rank: 'associate', skill: 'lean', blurb: 'Machines in every bar in the district, and every owner agrees they’re yours.', bad: ['a machine was smashed and the repair cost him', 'a bar owner dropped him for a rival route'], good: ['the bars were full'] },
  dock: { label: 'Pier loading racket', group: 'Waterfront and unions', cost: 0, base: 620, risk: 0.05, heat: 0.04, rank: 'soldier', districts: ['Red Hook', 'Staten Island'], skill: 'collect', blurb: 'Every crate that moves pays a toll. The foremen know who to give it to.' },
  union: { label: 'Union local', group: 'Waterfront and unions', cost: 1500, base: 520, risk: 0.03, heat: 0.03, rank: 'soldier', districts: ["Hell's Kitchen", 'The Bronx', 'Astoria'], skill: 'lean', blurb: 'Dues, a pension fund and jobs for sale. Quiet and very profitable. The first month is a bribe.' },
  shylock: { label: 'Street loans', group: 'Street trades', cost: 1200, base: 300, risk: 0.04, heat: 0.015, rank: 'associate', skill: 'collect', blurb: 'Cash lent at a weekly rate to people the banks won’t see. It pays well until someone can’t. Then it pays in other ways.', bad: ['two borrowers went quiet and he couldn’t find them', 'one customer lost his job and paid nothing'], good: ['everybody paid on time'] },
  cigarettes: { label: 'Bootleg cigarettes', group: 'Street trades', cost: 900, base: 230, risk: 0.03, heat: 0.02, rank: 'associate', skill: 'handle', blurb: 'Untaxed cartons from the south, sold from the back of every corner store. The state taxes are the profit.' },
  nightclub: { label: 'A nightclub stake', group: 'Fronts', cost: 4000, base: 330, risk: 0.02, heat: 0.01, rank: 'associate', skill: 'charm', blurb: 'Your name behind the bar of a place everyone wants to be seen. The cash register does the laundering.' },
  carting: { label: 'Private carting', group: 'Waterfront and unions', cost: 1800, base: 440, risk: 0.025, heat: 0.02, rank: 'soldier', districts: ['Bensonhurst', 'The Bronx', 'Staten Island'], skill: 'lean', blurb: 'Every restaurant and shop pays for its rubbish to go, and nobody else is allowed to take it. Dull, steady, vicious if you cross it.' },
  construction: { label: 'Construction kickbacks', group: 'Waterfront and unions', cost: 2500, base: 560, risk: 0.035, heat: 0.03, rank: 'soldier', districts: ["Hell's Kitchen", 'Astoria', 'Little Italy'], skill: 'fix', blurb: 'Concrete, cranes and building inspectors. Every contractor pays to keep the site moving.' },
  trucking: { label: 'Trucking and cargo', group: 'Waterfront and unions', cost: 2200, base: 480, risk: 0.05, heat: 0.035, rank: 'soldier', districts: ['Red Hook', 'Staten Island', 'The Bronx'], skill: 'handle', blurb: 'Control the drivers and you control what gets delivered, what gets lost, and who is told about it.' },
  chop: { label: 'Chop shop', group: 'Street trades', cost: 0, base: 480, risk: 0.05, heat: 0.04, rank: 'associate', skill: 'boost', src: 'boost', blurb: 'Cars taken to order and run to a chop shop. Quick money, and a cop’s car is a very bad night.', bad: ['the chop shop was shut for a week', 'a car turned out to be a cop’s', 'the buyer cut his price'], good: ['a good run of cars'] },
  fencing: { label: 'Fencing operation', group: 'Street trades', cost: 300, base: 400, risk: 0.025, heat: 0.02, rank: 'associate', skill: 'scam', src: 'scam', blurb: 'Whatever comes off a truck, moved on at a third of what it cost somebody.', bad: ['his supplier dried up', 'a load turned out to be junk'], good: ['a rich shipment moved fast'] },
  front: { label: 'A front business', group: 'Fronts', cost: 3000, base: 150, risk: 0.01, heat: -0.04, rank: 'associate', skill: 'numbers', blurb: 'A laundromat or a restaurant on paper. Clean money and a reason to be seen.' },
};
export const OP_GROUPS = ['Betting', 'Street trades', 'Waterfront and unions', 'Fronts'] as const;

const PL = (w: World) => w.chars[w.playerId!];

export function canStart(w: World, p: Character, kind: Exclude<OpKind, 'hijack'>, district: string): string | null {
  const d = OPS[kind];
  if (p.rank === 'associate' && d.rank === 'soldier') return 'That’s made men\'s business. You are not made.';
  if (d.districts && !d.districts.includes(district)) return `It only works in ${d.districts.join(' or ')}.`;
  if (p.cash < d.cost) return `You need ${money(d.cost)}.`;
  if (w.ops.some((o) => o.owner === p.id && o.kind === kind && o.district === district && o.state !== 'closed')) return 'You already run one there.';
  if (d.rank === 'soldier') {
    const fam = p.familyId ? w.fam[p.familyId] : undefined;
    const capo = p.bossId ? w.chars[p.bossId] : undefined;
    if (!fam?.districts.includes(district)) return 'That’s not your family\'s ground. You would need leave to work it.';
    if (capo && (capo.rels[p.id]?.trust ?? 0) < 0.35) return `${capo.name} doesn’t trust you with it yet.`;
  }
  return null;
}

export function startOp(w: World, p: Character, kind: Exclude<OpKind, 'hijack'>, district: string, runner: Id | null): string[] {
  const d = OPS[kind];
  const err = canStart(w, p, kind, district);
  if (err) return [err];
  p.cash -= d.cost;
  const op: Op = { id: newId(w, 'op'), kind, owner: p.id, runner, district, since: w.now, state: 'running', last: 0, total: 0, skimmed: 0, weeks: 0 };
  w.ops.push(op);
  const r = runner ? w.chars[runner] : undefined;
  if (kind === 'dock' || kind === 'union') {
    const capo = p.bossId ? w.chars[p.bossId] : undefined;
    if (capo) feel(w, capo, p.id, 'respect', 0.03);
  }
  return [`${d.label} in ${district}. ${r ? `${r.name} will run it.` : 'You’ll run it yourself.'} ${d.cost ? `It costs you ${money(d.cost)}.` : ''} The first money comes in a week.`];
}

export function hijack(w: World, p: Character, crew: Id[]): string[] {
  const men = crew.map((id) => w.chars[id]).filter((c) => c?.alive && c.jailedUntil <= w.now);
  if (men.length < 2) return ['You need at least two men you can trust.'];
  const cargo = pick(['a truck of cigarettes off the Jersey Turnpike', 'a trailer of fur coats out of the garment district', 'a load of television sets bound for a department store', 'a shipment of liquor leaving a bonded warehouse'], p.id + w.now);
  const op: Op = { id: newId(w, 'op'), kind: 'hijack', owner: p.id, runner: men[0].id, district: p.district, since: w.now, state: 'out', last: 0, total: 0, skimmed: 0, crew: men.map((m) => m.id), due: w.now + 2 * DAY, note: cargo, weeks: 0 };
  w.ops.push(op);
  return [`You put ${men.map((m) => m.name).join(', ')} on ${cargo}. You’ll hear in a couple of days. Nobody says the word hijack out loud.`];
}

export function closeOp(w: World, op: Op): string[] {
  op.state = 'closed';
  return [`${OPS[op.kind as Exclude<OpKind, 'hijack'>]?.label ?? 'The job'} is shut down. People will notice the gap.`];
}

export function countOp(w: World, p: Character, op: Op): { lines: string[]; found: number } {
  const r = op.runner ? w.chars[op.runner] : undefined;
  const found = Math.round(op.skimmed);
  const lines: string[] = [];
  if (!r) return { lines: ['You count it yourself. It’s all there. It’s yours, after all.'], found: 0 };
  if (found > 30) {
    lines.push(`You go through ${r.name}'s count, line by line. It doesn’t add up. About ${money(found)} has gone somewhere, over the weeks.`);
  } else lines.push(`You go through ${r.name}'s count. It adds up. He’s either honest or very careful.`);
  op.skimmed = 0;
  rel(r, p.id).lastMet = w.now;
  return { lines, found };
}
export function opRule(w: World, p: Character, op: Op, code: string, found: number): string[] {
  const r = op.runner ? w.chars[op.runner] : undefined;
  if (!r) return [];
  const rr = rel(r, p.id);
  if (code === 'repay') {
    const amt = Math.min(r.cash, found);
    r.cash -= amt;
    p.cash += amt;
    feelOn(w, rr, 'trust', -0.08);
    return [`${r.name} hands over ${money(amt)} without looking at you. Whatever he felt about you, he feels it a little differently now.`];
  }
  if (code === 'fire') {
    op.runner = null;
    bearOn(w, rr, 0.1, `${p.name} took him off the operation`);
    feelOn(w, rr, 'trust', -0.15);
    return [`You take the operation away from ${r.name}. He takes it the way men take a public embarrassment.`];
  }
  feelOn(w, rr, 'trust', -0.02);
  return [`You tell ${r.name} you know, and that it stops. He nods once.`];
}

// ------------------------------------------------------------------ ticking

export function opsDaily(w: World) {
  for (const op of w.ops) {
    if (op.state === 'out' && op.due !== undefined && op.due <= w.now) resolveHijack(w, op);
    if (op.state === 'raided' && op.until !== undefined && op.until <= w.now) op.state = 'running';
  }
}

function resolveHijack(w: World, op: Op) {
  const p = w.chars[op.owner];
  const men = (op.crew ?? []).map((id) => w.chars[id]).filter((c) => c?.alive);
  const strength = men.length ? men.reduce((a, c) => a + aptitude(c, 'hijack'), 0) / men.length : 0.3;
  const roll = w.rng.next();
  const ok = clamp(0.3 + strength * 0.55, 0.2, 0.85);
  op.state = 'done';
  const where = op.district;
  if (roll < ok) {
    const gross = Math.round(w.rng.int(1800, 3800) * (0.8 + strength * 0.4));
    const cut = Math.round(gross * 0.12);
    for (const m of men) { m.cash += cut; grow(m, 'hijack'); }
    const net = gross - cut * men.length;
    earn(p, net, 'hijack');
    p.heat = clamp(p.heat + 0.2, 0, 1.5);
    op.total = net;
    addFact(w, { kind: 'report', actor: men[0]?.id, minor: true, text: `The ${op.note ?? 'job'} went clean. ${money(net)} after the men's share.`, district: where }, { witnesses: [p.id] });
    if (w.rng.chance(0.3)) addFact(w, { kind: 'theft', actor: p.id, hiddenActor: true, text: `${p.name} had a truck taken off the road.`, textHidden: `A truck was taken off the road in ${where}.`, district: where }, {});
  } else if (roll < ok + (1 - ok) * 0.55) {
    const gross = Math.round(gross0(w) * 0.2);
    earn(p, gross, 'hijack');
    op.total = gross;
    addFact(w, { kind: 'report', actor: men[0]?.id, minor: true, text: `The ${op.note ?? 'job'} was a dud. The truck was mostly empty. ${money(gross)} was all there was to take.`, district: where }, { witnesses: [p.id] });
  } else {
    const caught = men.filter(() => w.rng.chance(0.5));
    for (const m of caught) { m.jailedUntil = w.now + w.rng.int(10, 30) * DAY; m.heat = clamp(m.heat + 0.5, 0, 1.5); }
    p.heat = clamp(p.heat + 0.25, 0, 1.5);
    addFact(w, { kind: 'arrest', actor: caught[0]?.id ?? men[0]?.id, text: `${caught.map((c) => c.name).join(' and ') || 'Two men'} picked up after a hijacking went wrong near ${where}.`, district: where }, { witnesses: [p.id], broadcast: caught.map((c) => c.id) });
  }
}
const gross0 = (w: World) => w.rng.int(1800, 3800);

// Stage 4 (Oct 2026): one weekly pass for every enterprise, whoever owns it. What used to be the player's operations and NPCs'
// hustles are the same records under the same rules: a take that depends on the man doing the work, how far the owner has grown it,
// how crowded the trade is in the district and what his family wants this month; bad weeks and good ones; police raids; a runner
// who may skim. Street loans are real loans (shylockWeek); a betting book's heavy losers run up real markers (marker). NPC owners
// also decide for themselves: grow it, or after a run of bad weeks change course (npcTend), and men without one start one, by the
// same rules the player's Rackets tab uses (startEnterprises, canStart).
export function enterpriseWeek(w: World) {
  recordWeek(w);
  opsChangeHands(w);
  pruneCars(w);
  meetWeek(w);
  paperWeek(w);
  startEnterprises(w);
  for (const op of w.ops) {
    if (op.state === 'closed' || op.kind === 'hijack' || op.state === 'done') continue;
    const d = OPS[op.kind as OpKey];
    const owner = w.chars[op.owner];
    const runner = op.runner ? w.chars[op.runner] : undefined;
    // (a dead man's racket waits for its captain's word, running on habit, before it closes: enterprise.assignAsk)
    if (!owner?.alive) { if (w.enc.some((e) => e.status === 'open' && e.kind === 'ent' && e.data?.k === 'assign' && e.data?.op === op.id)) { op.last = 0; continue; } op.state = 'closed'; continue; }
    if (runner && !runner.alive) op.runner = null;
    op.weeks++;
    if (op.state === 'raided') { op.last = 0; continue; }
    if ((op.lull ?? 0) > w.now) { op.last = 0; continue; }
    const doer = runner && runner.alive ? runner : owner;
    if (doer.jailedUntil > w.now) { op.last = Math.round(op.last * 0.3); continue; }
    if (!owner.isPlayer && npcTend(w, op, owner, d)) continue;
    if (owner.isPlayer && op.kind === 'bookie') bookWeek(w, op, owner); // (the player's book has decisions: book.ts)
    const lvl = op.level ?? 1;
    if (op.kind === 'shylock') { shylockWeek(w, op, owner, lvl); continue; }
    const fam = owner.familyId ? w.fam[owner.familyId] : undefined;
    let take = d.base * (0.55 + aptitude(doer, d.skill) * 0.9) * (1 + (lvl - 1) * 0.55) * w.rng.range(0.8, 1.25) * crowding(w, op);
    if (owner.isPlayer && hasPerk(w, owner, 'earner')) take *= 1.12;
    const dir = fam?.directive && fam.directive.until > w.now ? fam.directive.kind : undefined;
    if (dir) take *= dir === 'push' ? 1.25 : 0.85;
    let cause = d.good?.length ? pick(d.good, op.id + ':' + w.now) : '';
    // the four pilot rackets: the week is what their people did (enterprise.ts), with the same weight of the world on it as any other
    const people = PILOT.has(op.kind) ? pilotWeek(w, op, owner, doer, (owner.isPlayer && hasPerk(w, owner, 'earner') ? 1.12 : 1) * (dir ? (dir === 'push' ? 1.25 : 0.85) : 1) * crowding(w, op)) : undefined;
    if (people) { take = people.take; cause = people.cause; op.bad = take < 0 ? (op.bad ?? 0) + 1 : Math.max(0, (op.bad ?? 0) - 1); }
    else if (op.kind === 'bookie' && w.rng.chance(0.18)) { take = -w.rng.int(150, 500) * lvl; cause = d.bad?.length ? pick(d.bad, op.id + ':' + w.now) : 'the favourite came in'; op.bad = (op.bad ?? 0) + 1; }
    else if (w.rng.chance(0.12)) { take *= w.rng.range(0.15, 0.55); cause = d.bad?.length ? pick(d.bad, op.id + ':' + w.now) : 'a bad week'; op.bad = (op.bad ?? 0) + 1; }
    else op.bad = Math.max(0, (op.bad ?? 0) - 1);
    if (op.kind === 'front') take = d.base * w.rng.range(0.8, 1.2);
    if (!fam?.districts.includes(op.district)) take *= 0.7;
    const hot = Object.values(fam?.tension ?? {}).reduce((a, b) => Math.max(a, b), 0);
    // police
    if (d.risk > 0 && w.rng.chance((d.risk + owner.heat * 0.06) * (owner.isPlayer ? 1 : 1.2 - temper(owner).caution * 0.6) * (dir === 'push' ? 1.5 : dir === 'quiet' ? 0.4 : 1) * ((op.pad ?? 0) > w.now ? 0.25 : 1))) {
      op.state = 'raided';
      op.until = w.now + w.rng.int(2, 4) * DAY * 7;
      const fine = w.rng.int(150, 450);
      owner.cash = Math.max(0, owner.cash - fine);
      if (w.rng.chance(runner ? 0.6 : doer.isPlayer ? 0.2 : 0.4)) { doer.jailedUntil = w.now + w.rng.int(7, 21) * DAY; doer.heat = clamp(doer.heat + 0.4, 0, 1.5); }
      addFact(w, { kind: 'raid', actor: doer.id, text: `Police raided the ${d.label.toLowerCase()} in ${op.district}${doer.jailedUntil > w.now ? ` and took ${doer.name}` : ''}. It costs ${owner.name} ${money(fine)} and some weeks.`, amount: fine, district: op.district }, { witnesses: [owner.id] });
      op.last = 0; op.bad = (op.bad ?? 0) + 1;
      continue;
    }
    // a heavy loser on a betting book owes it: a marker, a real debt with a man's name on it
    if ((op.kind === 'bookie' || op.kind === 'numbers') && w.rng.chance(0.04 * lvl)) marker(w, op, owner);
    // squeeze from a rival
    if (owner.isPlayer && hot >= 3 && w.rng.chance(0.07) && !w.enc.some((e) => e.status === 'open' && e.kind === 'squeeze')) {
      const rf = Object.entries(fam!.tension).sort((a, b) => b[1] - a[1])[0];
      const rb = rf ? w.chars[w.fam[rf[0]].bossId] : undefined;
      const rc = Object.values(w.chars).find((c) => c.alive && c.familyId === rf?.[0] && c.rank === 'capo');
      if (rc && rb) addEnc(w, { kind: 'squeeze', from: rc.id, title: `${rc.name} wants a piece`, lines: [`${rc.name} of the ${w.fam[rc.familyId!].name} family sends a man to say it nicely.`, `"We hear you have a ${d.label.toLowerCase()} in ${op.district}. ${op.district} is busy. Busy places need friends. A tenth of the take, and everyone stays friends."`], opts: [{ code: 'pay', label: 'Pay the tenth', hint: 'Peace, at a price.' }, { code: 'no', label: 'Tell him no', hint: 'His family will remember.' }], data: { op: op.id, fam: rc.familyId! }, days: 5 });
    }
    // the runner
    let skim = 0;
    if (runner && take > 0 && runner.alive) {
      const tempted = (runner.problem && runner.problem.sev > 0.35) || ['schemer', 'bitter'].includes(arch(runner));
      const loyal = rel(runner, owner.id).trust;
      if (tempted && w.rng.chance(0.35 - loyal * 0.2)) {
        skim = Math.round(take * w.rng.range(0.08, 0.3));
        op.skimmed += skim;
        runner.cash += skim;
      }
      grow(runner, d.skill, 0.01);
    }
    // Stage 5D: what a man runs for the player is noticed by others: when enough has gone missing, someone tells him the count has
    // been coming up light (one of his own men, or someone who drinks with the runner). What he does about it is his: count it, and
    // rule on it (countOp, opRule), as an NPC owner's suspicion becomes a matter (work.delegate).
    if (owner.isPlayer && runner?.alive && op.skimmed > 150 && (op.tipped ?? -1e9) < w.now - 4 * WEEK) {
      const by = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== runner.id && (x.bossId === owner.id || (x.rels[runner.id]?.affection ?? 0) > 0.3) && (x.rels[owner.id]?.trust ?? 0) >= 0.3).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      if (by) { op.tipped = w.now; addFact(w, { kind: 'report', actor: by.id, victim: runner.id, text: `${by.name} says the count on your ${d.label.toLowerCase()} has been coming up light, and ${runner.name} runs it.`, district: op.district }, { witnesses: [owner.id] }); }
    }
    const net = Math.round(take - skim);
    op.last = net;
    op.total += net;
    op.cause = cause;
    if (net > 0) earn(owner, net, d.src ?? op.kind);
    else owner.cash += net;
    // (a captain's piece, the garage owner's share: out of a good week's take)
    payOpStakes(w, op, net);
    // the runner's agreed cut of a good week, out of the owner's pocket (Stage 4: asks 'run', work.delegate)
    if (runner?.alive && runner.id !== owner.id && op.cut && net > 0) { const pay = Math.min(Math.max(0, owner.cash), Math.round(net * op.cut)); owner.cash -= pay; earn(runner, pay, 'cut'); }
    owner.heat = clamp(owner.heat + d.heat, 0, 1.5);
    if (owner.isPlayer && Math.abs(net) >= 1) addFact(w, { kind: 'report', actor: doer.id, minor: true, text: net < 0 ? `A bad week on the ${d.label.toLowerCase()} in ${op.district}: ${cause || 'a favourite came in'}, and ${money(-net)} went out.` : `The ${d.label.toLowerCase()} in ${op.district} brought in ${money(net)}.`, district: op.district }, { witnesses: [owner.id] });
    // what has come about around it (enterprise.ts): only what has actually happened, and only now and then
    developments(w, op);
  }
}
// (the trade is thinner where many work it: one more of the same kind in the district than two takes a little off everyone's)
function crowding(w: World, op: Op): number {
  const n = w.ops.filter((o) => o !== op && o.kind === op.kind && o.district === op.district && o.state === 'running').length;
  return 1 / (1 + Math.max(0, n - 2) * 0.12);
}
// An NPC owner's own decisions: a run of bad weeks and he gives it up (he will start something else when he can); spare money and
// ambition and he grows it, asking his superior to put money in if his superior is the player and has said he wants asking.
function npcTend(w: World, op: Op, owner: Character, d: OpDef): boolean {
  if ((op.bad ?? 0) >= 3) { op.state = 'closed'; owner.cooldown.ent = w.now + 2 * WEEK; return true; }
  const lvl = op.level ?? 1;
  if (lvl < 3 && owner.cash > 1200 * lvl + d.cost && owner.traits.ambition > 0.45 && !(op.bad ?? 0) && w.rng.chance(0.07)) {
    const cost = 600 * lvl, boss = owner.bossId ? w.chars[owner.bossId] : undefined;
    if (boss?.isPlayer && (w.expect?.invest ?? 'ask') === 'ask') askToInvest(w, owner, cost, d.label.toLowerCase());
    else { owner.cash -= cost; op.stake = (op.stake ?? d.cost) + cost; op.level = lvl + 1; owner.books.expenses += cost; }
  }
  return false;
}
// Street loans are a book of real loans: each week the owner lends some of his capital to a man who needs it, on his terms, through
// the one way a loan is made (asks 'lend'); what it earns is the vig and the principal paid back to him (core.payDebt credits it).
function shylockWeek(w: World, op: Op, owner: Character, lvl: number) {
  const book = w.debts.filter((x) => x.status === 'active' && x.creditor === owner.id);
  op.last = book.filter((x) => x.missed === 0).reduce((a, x) => a + Math.min(x.weeklyPayment, x.balance), 0);
  op.total += op.last;
  op.bad = book.some((x) => x.missed >= 2) ? (op.bad ?? 0) + 1 : Math.max(0, (op.bad ?? 0) - 1);
  op.cause = op.bad ? 'a couple of borrowers went quiet' : book.length ? 'the money came back on time' : 'nobody in need this week';
  const capital = Math.min(owner.cash * 0.6, 1200 * lvl);
  if (book.length >= 2 + lvl * 2 || capital < 150) return;
  const fam = owner.familyId ? w.fam[owner.familyId] : undefined;
  const near = (c: Character) => c.district === op.district || !!fam?.districts.includes(c.district);
  const m = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.id !== owner.id && c.rank !== 'boss' && near(c) && (c.cash < 150 || (ownerBiz(w, c.id)?.distress ?? 0) >= 1) && !book.some((x) => x.debtor === c.id))
    .sort((a, b) => a.cash - b.cash || (a.id < b.id ? -1 : 1))[0];
  if (!m) return;
  const s = openAsk(w, 'lend', owner, m, { amt: Math.max(150, Math.round(Math.min(capital, w.rng.int(200, 600)) / 50) * 50), biz: ownerBiz(w, m.id)?.id, why: `${owner.name} offered ${m.name} a loan from his book` });
  if (s) move(w, s, 'ask');
}
// A bettor who lost more than he had: the book carries him, and now he owes it.
// Like the casino (actions.ts 'gamble'), a book gives no credit to a man already in it for a marker, or who stiffed it before.
function marker(w: World, op: Op, owner: Character) {
  const fam = owner.familyId ? w.fam[owner.familyId] : undefined;
  const g = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.id !== owner.id && c.traits.vice >= 0.6 && c.cash < 300 && (c.district === op.district || !!fam?.districts.includes(c.district)) && !w.debts.some((x) => (x.status === 'active' || x.status === 'defaulted') && x.creditor === owner.id && x.debtor === c.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!g.length) return;
  const c = w.rng.pick(g), amt = Math.round(w.rng.int(100, 400) * (op.level ?? 1) / 50) * 50;
  const f = addFact(w, { kind: 'loan', actor: owner.id, victim: c.id, amount: amt, text: `${c.name} ran up a ${money(amt)} marker on ${owner.name}'s book.`, district: op.district }, { witnesses: [owner.id, c.id] });
  createDebt(w, owner.id, c.id, amt, 0.1, 'a marker on the book', f.id);
}
// Men in the life without an enterprise start one when they can, choosing by what it would pay a man like him, how crowded the
// trade is where he lives, the heat it would bring and how careful he is: the same kinds and the same rules as the player's
// (canStart: made men's kinds need rank, the right district and a captain who trusts him; and the money to start it).
function startEnterprises(w: World) {
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || !c.familyId || (c.rank !== 'associate' && c.rank !== 'soldier') || c.jailedUntil > w.now || (c.cooldown.ent ?? 0) > w.now) continue;
    // (one enterprise to begin with; a man doing well, with money put by and the ambition, adds a second of another kind: the way a
    // young man moves on from stealing cars to a numbers bank or a book of loans)
    const mine = w.ops.filter((o) => o.owner === c.id && o.kind !== 'hijack' && (o.state === 'running' || o.state === 'raided'));
    // (a man running another man's racket has his hands full, and setting up the same trade beside it would be walking out: enterprise.goesOwnWay)
    if (w.ops.some((o) => o.runner === c.id && (o.state === 'running' || o.state === 'raided'))) continue;
    if (mine.length >= 2 || (mine.length === 1 && !(c.cash > 2500 && c.traits.ambition > 0.5 && w.rng.chance(0.05)))) continue;
    const fam = w.fam[c.familyId];
    // (he weighs them all and leans to what suits him best, but men are not all alike in what they reach for: a weighted choice,
    // not every man taking the single best-paying trade)
    const opts: { k: OpKey; d: string; s: number }[] = [];
    for (const k of Object.keys(OPS) as OpKey[]) {
      const d = OPS[k];
      const where = d.districts ? d.districts.find((x) => fam.districts.includes(x)) ?? d.districts[0] : c.district;
      if (canStart(w, c, k, where) || mine.some((o) => o.kind === k)) continue;
      const heatPen = 1 - clamp(c.heat, 0, 1) * d.risk * 8, carePen = 1 - temper(c).caution * d.risk * 6;
      const want = k === 'chop' ? 0.7 + c.traits.violence * 0.6 : k === 'bookie' || k === 'shylock' || k === 'numbers' ? 0.7 + c.traits.greed * 0.5 : 1;
      const sc = d.base * (0.55 + aptitude(c, d.skill) * 0.9) * heatPen * carePen * want * w.rng.range(0.85, 1.15) / (1 + Math.max(0, w.ops.filter((o) => o.kind === k && o.district === where && o.state === 'running').length - 2) * 0.12);
      if (sc > 0) opts.push({ k, d: where, s: sc });
    }
    if (!opts.length) continue;
    let r = w.rng.next() * opts.reduce((a, o) => a + o.s, 0);
    const pickd = opts.find((o) => (r -= o.s) <= 0) ?? opts[opts.length - 1];
    startOp(w, c, pickd.k, pickd.d, null);
  }
}
// The enterprise a man is known for: his biggest running one (what conversation, Sunday and the crew screens ask about).
export function lineOf(w: World, c: Character): Op | undefined {
  return w.ops.filter((o) => o.owner === c.id && o.kind !== 'hijack' && (o.state === 'running' || o.state === 'raided')).sort((a, b) => (b.level ?? 1) - (a.level ?? 1) || b.total - a.total)[0];
}
export function enterpriseLine(w: World, c: Character): string | undefined {
  const op = lineOf(w, c);
  if (!op) return undefined;
  const l = OPS[op.kind as OpKey]?.label ?? op.kind;
  return `${l[0].toLowerCase()}${l.slice(1)}${(op.level ?? 1) > 1 ? ', grown to a real business' : ''}`;
}
