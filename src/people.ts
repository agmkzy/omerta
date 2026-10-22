// People: what they are good at, what is going wrong in their lives, and how that leaks into their work.
// A man who is late with his envelope has a reason. The reason is usually not the one he gives.
import { addFact, clamp, createDebt, feelOn, money, ownerBiz, witnessesAt } from './core';
import { spawnCivilian } from './world';
import { FEMALE, rollFirst } from './names';
import { interestsOf } from './orgs';
import { Business, Character, DAY, Id, Problem, ProblemKind, Rank, Skill, Skills, World } from './types';
import { Rng } from './rng';

export const SKILLS: Skill[] = ['muscle', 'driving', 'charm', 'nerve', 'brains'];
export const SKILL_LABEL: Record<Skill, string> = { muscle: 'Muscle', driving: 'Driving', charm: 'Charm', nerve: 'Nerve', brains: 'Brains' };

export function rollSkills(rng: Rng, rank: Rank): Skills {
  const lo = rank === 'civilian' ? 0.1 : 0.2;
  const hi = rank === 'civilian' ? 0.6 : rank === 'associate' ? 0.7 : 0.85;
  const s = {} as Skills;
  for (const k of SKILLS) s[k] = Math.round(rng.range(lo, hi) * 100) / 100;
  const gift = SKILLS[rng.int(0, 4)];
  s[gift] = Math.min(1, Math.round((s[gift] + 0.2) * 100) / 100);
  return s;
}
export const skillWord = (v: number) => (v < 0.25 ? 'poor' : v < 0.45 ? 'fair' : v < 0.65 ? 'good' : v < 0.82 ? 'sharp' : 'gifted');
export const bestSkill = (c: Character): Skill => SKILLS.slice().sort((a, b) => c.skills[b] - c.skills[a])[0];

// Which skills a kind of work leans on.
export const NEEDS: Record<string, Skill[]> = {
  collect: ['muscle', 'charm'], lean: ['charm', 'nerve'], handle: ['muscle', 'nerve'], hit: ['nerve', 'muscle'], boost: ['driving', 'nerve'],
  burgle: ['nerve', 'brains'], scam: ['charm', 'brains'], hijack: ['driving', 'muscle'], watch: ['brains', 'nerve'], deliver: ['driving', 'brains'],
  message: ['charm', 'nerve'], guard: ['muscle', 'nerve'], find: ['brains', 'charm'], fix: ['charm', 'brains'], numbers: ['brains', 'charm'], shake: ['muscle', 'nerve'],
};
export function aptitude(c: Character, kind: string): number {
  const ks = NEEDS[kind] ?? ['nerve'];
  return ks.reduce((a, k) => a + c.skills[k], 0) / ks.length;
}
export function grow(c: Character, kind: string, amt = 0.025) {
  for (const k of NEEDS[kind] ?? []) c.skills[k] = Math.min(1, Math.round((c.skills[k] + amt) * 1000) / 1000);
}

export const PROBLEM_LABEL: Record<ProblemKind, string> = {
  gambling: 'a gambling problem', debt: 'in debt to someone dangerous', family: 'trouble at home', drink: 'drinking', house: 'saving for a way out', resentment: 'resentful', woman: 'a woman who costs him',
};
const FACTOR: Record<ProblemKind, number> = { gambling: 3.5, debt: 2.5, family: 1.6, drink: 1.2, house: 0.3, resentment: 0, woman: 2 };
const SIGNS: Record<ProblemKind, string[]> = {
  gambling: ['was seen at the track again', 'lost big at cards last night', 'is borrowing from anyone who will lend'],
  debt: ['looks like a man being followed', 'keeps asking about advances', 'has been seen with a man nobody likes'],
  family: ['missed a day with no explanation', 'left early again, something at home', 'looked like he hadn’t slept'],
  drink: ['turned up drunk at noon', 'couldn’t be found for two days', 'got into it with a bartender'],
  house: ['has been looking at houses in Jersey', 'is spending like a man with a plan', 'is saving every dollar he can find'],
  resentment: ['has been complaining about the money', 'told someone he’s tired of carrying people', 'sat out the last gathering'],
  woman: ['was seen with someone he shouldn’t be seen with', 'is buying jewellery again', 'told a friend he was in trouble over a woman'],
};

export function rollProblem(w: World, c: Character): Problem | undefined {
  const T = c.traits;
  const weights: [ProblemKind, number][] = [
    ['gambling', 0.15 + T.vice * 1.2], ['drink', 0.05 + T.vice * 0.7], ['debt', c.cash < 300 ? 0.8 : 0.1], ['family', 0.3],
    ['house', 0.1 + T.greed * 0.9], ['resentment', c.rank !== 'boss' ? 0.1 + T.ambition * 0.8 : 0], ['woman', 0.1 + T.sociability * 0.6],
  ];
  const total = weights.reduce((a, [, v]) => a + v, 0);
  let r = w.rng.next() * total;
  for (const [k, v] of weights) {
    r -= v;
    if (r <= 0) return { kind: k, sev: w.rng.range(0.15, 0.4), since: w.now };
  }
  return undefined;
}

// A crisis: he borrows from the wrong man.
function crisis(w: World, c: Character) {
  const p = c.problem!;
  const sharks = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && x.familyId && x.familyId !== c.familyId && ['soldier', 'associate'].includes(x.rank));
  if (!sharks.length) return;
  const shark = w.rng.pick(sharks);
  const amt = Math.round((1500 + p.sev * 3000) / 250) * 250;
  if (w.debts.some((d) => d.debtor === c.id && d.status === 'active')) return;
  createDebt(w, shark.id, c.id, amt, 0.07, 'a loan from the wrong man');
  c.cash += Math.round(amt * 0.4); // a little of it still around
  addFact(w, { kind: 'loan', actor: shark.id, victim: c.id, amount: amt, text: `${c.name} owes ${money(amt)} to ${shark.name} of the ${w.fam[shark.familyId!].name} family.`, district: c.district }, { witnesses: [] });
}

export function peopleWeek(w: World) {
  const rng = w.rng;
  for (const c of Object.values(w.chars)) {
    if (!c.alive || !c.familyId || c.isPlayer || !['associate', 'soldier', 'capo'].includes(c.rank)) continue;
    const boss = c.bossId ? w.chars[c.bossId] : undefined;
    if (!c.problem) {
      const rb = boss ? c.rels[boss.id] : undefined;
      const resent = rb && rb.trust < 0.4 && c.traits.ambition > 0.6 ? 0.012 : 0;
      if (rng.chance((c.rank === 'capo' ? 0.006 : 0.016) + resent)) c.problem = rollProblem(w, c);
      continue;
    }
    const p = c.problem;
    const drift = p.kind === 'gambling' || p.kind === 'debt' || p.kind === 'drink' ? 0.04 : 0.015;
    p.sev = clamp(p.sev + (rng.chance(0.2) ? -0.05 : drift));
    const living = { associate: 90, soldier: 130, capo: 250 }[c.rank as 'associate' | 'soldier' | 'capo'];
    const drain = Math.round(p.sev * living * FACTOR[p.kind] * rng.range(0.7, 1.3));
    c.cash = Math.max(0, c.cash - drain);
    c.books.expenses += drain;
    if (p.kind === 'gambling' && drain > 40) c.books.gross.odd = (c.books.gross.odd ?? 0) + 0;
    // others notice
    if (rng.chance(p.sev * 0.5)) {
      const sign = rng.pick(SIGNS[p.kind]);
      const wit = witnessesAt(w, c.district, [c.id], 2).filter(() => rng.chance(0.6));
      addFact(w, { kind: 'trouble', actor: c.id, minor: p.sev < 0.35, text: `${c.name} ${sign}.`, district: c.district }, { witnesses: wit });
    }
    if (p.sev > 0.75 && (p.kind === 'gambling' || p.kind === 'debt') && rng.chance(0.2)) crisis(w, c);
    // it passes, or it does not
    if (rng.chance(0.025 + (c.cash > living * 6 ? 0.04 : 0))) delete c.problem;
  }

  // (Late protection is now decided where the money is paid: econ.ts payProtection.)

  // prospects drift in and out
  const ps = Object.values(w.chars).filter((c) => c.prospect && c.alive);
  for (const c of ps) if (rng.chance(0.06)) c.prospect = false;
  newBlood(w);
}

// Foundation step 2 (Oct 2026): new blood. A family short of men at the bottom (about four associates to every five made men) draws
// them from the street, as long as it has the work to feed them, and each comes for a reason that is recorded: a man who already knows one of its people, or who needs money,
// starts hanging around; failing anyone like that, a young relative of somebody in its neighbourhoods comes of age. Taking him on is
// the family's men's own business (goals.ts recruit plans). Paced by the family's need, never by a quota: a family with enough men at
// the bottom draws nobody.
function newBlood(w: World) {
  const rng = w.rng, all = Object.values(w.chars);
  const waiting = all.filter((c) => c.alive && c.prospect && c.rank === 'civilian').length;
  for (const f of Object.values(w.fam).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ms = all.filter((c) => c.alive && c.familyId === f.id);
    const made = ms.filter((c) => c.rank === 'soldier' || c.rank === 'capo').length, assoc = ms.filter((c) => c.rank === 'associate').length;
    const short = Math.round(made * 0.8) - assoc - Math.round(waiting / Math.max(1, Object.keys(w.fam).length));
    // and only while the family has work to feed another man: a baseline, two to a district it holds, one to every business it owns
    // or protects. A family that wins shops takes on men; one that loses them stops.
    const carry = 10 + f.districts.length * 2 + interestsOf(w, f.id).length;
    if (short <= 0 || ms.length >= carry || !rng.chance(clamp(short * 0.06, 0, 0.45))) continue;
    const home = f.districts.length ? f.districts : [ms[0]?.district ?? 'Little Italy'];
    const men = ms.filter((c) => (c.rank === 'soldier' || c.rank === 'capo') && !c.isPlayer && c.jailedUntil <= w.now);
    // someone who already has a reason to come
    const near = all.filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && !c.familyId && !c.prospect && !ownerBiz(w, c.id) && c.traits.ambition >= 0.45 && home.includes(c.district) && !FEMALE.includes(c.name.split(' ')[0]))
      .map((c) => ({ c, tie: men.filter((m) => (c.rels[m.id]?.trust ?? 0) >= 0.3 || (m.rels[c.id]?.trust ?? 0) >= 0.3).sort((a, b) => (a.id < b.id ? -1 : 1))[0], need: c.cash < 150 }))
      .filter((x) => x.tie || x.need).sort((a, b) => (a.c.id < b.c.id ? -1 : 1));
    if (near.length) {
      const { c, tie } = rng.pick(near);
      c.prospect = true;
      addFact(w, tie
        ? { kind: 'report', actor: c.id, victim: tie.id, text: `${c.name} has started hanging around ${tie.name}'s crew.`, district: c.district }
        : { kind: 'report', actor: c.id, text: `${c.name} is short of money and has been asking the ${f.name} people for work.`, district: c.district }, { witnesses: tie ? [tie.id] : [] });
      continue;
    }
    // or a young man of the neighbourhood comes of age, with an uncle or a cousin in it
    const elders = all.filter((c) => c.alive && !c.isPlayer && home.includes(c.district) && !FEMALE.includes(c.name.split(' ')[0]) && (c.familyId === f.id || (c.rank === 'civilian' && !!ownerBiz(w, c.id)))).sort((a, b) => (a.id < b.id ? -1 : 1));
    const elder = elders.length ? rng.pick(elders) : undefined;
    if (!elder) continue;
    const surname = elder.name.split(' ').slice(1).join(' ');
    const y = spawnCivilian(w, `${rollFirst(() => rng.next())} ${surname}`, elder.district, rng.int(20, 150));
    y.prospect = true;
    y.traits.ambition = Math.round(rng.range(0.45, 0.95) * 100) / 100;
    y.traits.violence = Math.round(rng.range(0.2, 0.7) * 100) / 100;
    y.traits.courage = Math.round(rng.range(0.45, 0.9) * 100) / 100;
    y.rels[elder.id] ??= { trust: 0.4, respect: 0.4, affection: 0.4, grudge: 0, lastMet: w.now }; // (family)
    addFact(w, { kind: 'report', actor: y.id, victim: elder.id, text: `${y.name}, ${elder.name}'s nephew, is old enough now, and has started coming round the ${f.name} people.`, district: y.district }, { witnesses: [elder.id] });
  }
}

export const lateOf = (b: Business) => b.protection?.late ?? 0;
export function clearLate(b: Business) {
  if (b.protection) b.protection.late = 0;
}

// The player helps a man out. Cheap, quick, and it buys loyalty. Or he lets him sink.
// What you did for him goes on the record, and the trouble eases or ends accordingly.
function noteHelp(w: World, p: Character, c: Character, text: string) {
  c.cooldown.helped = w.now;
  addFact(w, { kind: 'favour', actor: p.id, victim: c.id, story: 'man:' + c.id, text, district: c.district }, { witnesses: [p.id, c.id] });
  const pr = c.problem;
  if (pr && pr.sev <= 0.12) {
    delete c.problem;
    addFact(w, { kind: 'favour', actor: c.id, story: 'man:' + c.id, text: `${c.name} is back on his feet. Whatever it was, it has stopped costing him.`, district: c.district }, { witnesses: [p.id, c.id] });
  }
}
export function helpMan(w: World, p: Character, c: Character, how: 'cash' | 'duties' | 'leave'): string[] {
  const pr = c.problem;
  const r = (c.rels[p.id] ??= { trust: 0.3, respect: 0.3, affection: 0.3, grudge: 0, lastMet: w.now });
  if (how === 'leave') {
    feelOn(w, r, 'trust', -0.04);
    return [`You tell ${c.name} it’s his to sort out. He nods and doesn’t argue, which tells you what he thinks.`];
  }
  if (how === 'cash') {
    const amt = 400;
    if (p.cash < amt) return ['You can’t spare it right now.'];
    p.cash -= amt;
    c.cash += amt;
    feelOn(w, r, 'trust', 0.12);
    feelOn(w, r, 'affection', 0.1);
    if (pr) pr.sev = clamp(pr.sev - 0.25);
    noteHelp(w, p, c, `${p.name} put $${amt} in ${c.name}’s hand to ease his trouble.`);
    return [`You press ${money(amt)} into ${c.name}'s hand. He doesn’t say thank you. He says he won’t forget it, which is better.`];
  }
  c.kickRate = Math.max(0.05, c.kickRate - 0.05);
  if (pr) pr.sev = clamp(pr.sev - 0.1);
  feelOn(w, r, 'trust', 0.06);
  noteHelp(w, p, c, `${p.name} took ${c.name} off the money for a while and lightened his share.`);
  return [`You take ${c.name} off the money-handling for a while and lighten his share. He’s grateful and a little ashamed.`];
}

export const ageDays = (w: World, t: number) => Math.floor((w.now - t) / DAY);
export const _unused = (_: Id) => _;
