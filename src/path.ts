import { lineOf } from './rackets';
import { ledgerAdd } from './powers2';
import { bizMove } from './econ';
import { powerOptions as powerOptions2, usePower2 } from './powers2';
// The road up. A rank is not a lottery ticket: there is a list of things you do, you can see how far along each is,
// there is a trial you choose how to attempt, and when you have done the lot the family makes room for you.
// Above capo there is a different kind of road: you get there by being needed, and by taking the chair.
import { addFact, bear, bearAtLeast, clamp, earn, factText, famName, feel, feelTo, handleDeath, learn, money, rel, repute } from './core';
import { addEnc } from './encounters';
import { mkJob } from './jobs';
import { canSeatUnderboss, capOf, isRunner, LADDER, members, openSeatFor, promote, sponsorOf, vacancy, WAGE } from './career';
import { applyRank, repairHierarchy } from './rank';
import { candidates, leaderChanged, noteDeal } from './orgs';
import { Character, DAY, Enc, Id, PathState, Rank, World } from './types';


// The road up is the same for every man (Stage 4, increment 5): what he has passed up, the work he has done for the family (his
// own and what his men did on his orders), the family's hard work for the higher seats, the backing of the right men, a name worth
// having, and, before he is made, proof of himself. The numbers come from what men in this world actually do: over two years an
// associate passes up about $2,000 (the best $10,000), a soldier about $8,000, a captain about $11,000; a superior hands a man below
// him a piece of work every few months.
export const ROAD: Record<string, { kick: number; work: number; hard: number; standing: number }> = {
  soldier: { kick: 3000, work: 2, hard: 0, standing: 30 },
  capo: { kick: 10000, work: 3, hard: 0, standing: 40 },
  underboss: { kick: 20000, work: 6, hard: 1, standing: 50 },
  boss: { kick: 0, work: 0, hard: 0, standing: 0 },
};
export const READY_AT = 0.75; // how much of the rest of the road, taken together
const first = (c: Character) => c.name.split(' ')[0];
const nextRank = (r: Rank): Rank | undefined => LADDER[LADDER.indexOf(r) + 1];
export const pathState = (w: World): PathState => (w.path ??= { deeds: 0, counted: [], trial: {}, retry: {} });

// Everyone who answers, directly or not, to c.
export function underlings(w: World, c: Character): Character[] {
  const out: Character[] = [];
  const seen = new Set<Id>([c.id]);
  let frontier = [c.id];
  while (frontier.length) {
    const nxt: Id[] = [];
    for (const x of Object.values(w.chars)) if (x.alive && x.bossId && frontier.includes(x.bossId) && !seen.has(x.id) && x.rank !== 'civilian') { seen.add(x.id); out.push(x); nxt.push(x.id); }
    frontier = nxt;
  }
  return out;
}

export interface Goal { key: string; label: string; frac: number; done: boolean; note: string; tip: string }
export interface PathInfo { to: Rank; goals: Goal[]; ready: boolean; trial: 'none' | 'open' | 'passed'; retryAt: number }

// One road for every man: the player's screens read it, and so does the family deciding on an NPC (career.readiness).
export function pathInfo(w: World, p: Character): PathInfo | undefined {
  const to = nextRank(p.rank);
  if (!to || !p.familyId || p.rank === 'civilian') return undefined;
  const n = ROAD[to];
  const st = p.isPlayer ? pathState(w) : undefined;
  const rec = p.career ?? { done: 0, failed: 0, log: [] };
  const fam = w.fam[p.familyId];
  const boss = w.chars[fam.bossId];
  const goals: Goal[] = [];
  const you = p.isPlayer;
  const g = (key: string, label: string, frac: number, note: string, tip: string, done = frac >= 1) => goals.push({ key, label, frac: clamp(frac, 0, 1), done, note, tip });
  if (to === 'boss') {
    const gone = !!boss && !boss.alive;
    g('chair', 'The chair is taken, not given', gone ? 1 : 0, boss?.alive ? `${boss.name} still holds it` : 'it is empty', 'The only way up is for the man above you to stop being the boss. How that happens is your business.', gone);
    return { to, goals, ready: true, trial: 'passed', retryAt: 0 };
  }
  g('earn', 'Pass up to the family', p.lifetimeKick / n.kick, `${money(p.lifetimeKick)} of ${money(n.kick)} passed up in total`, 'It all adds up over the whole climb. Declare it straight, hand it over in person, and be generous to the man above you.');
  const work = Math.max(rec.done + (rec.led ?? 0), st?.deeds ?? 0); // (an old save's count of the player's deeds carries over)
  g('deeds', 'Get the work done', work / n.work, `${Math.min(work, n.work)} of ${n.work} jobs finished`, 'Take the work you’re given and finish it. What your own men finish on your orders counts too.');
  if (n.hard) {
    const k = Math.max(rec.hard ?? 0, st?.kills ?? 0);
    g('kills', n.hard > 1 ? 'Do the family’s hard work, twice' : 'Do the family’s hard work', k / n.hard, `${Math.min(k, n.hard)} of ${n.hard} done on the family’s orders`, 'A man who hurt one of ours, dealt with because your superior asked. When there is such work, ask for it.');
  }
  g('name', 'A name worth having', p.standing / n.standing, p.standing >= n.standing ? 'people speak well of you' : 'not yet', 'What people say of you comes from what you do and who sees it.');
  const made = members(w, p.familyId).filter((x) => x.id !== p.id && LADDER.indexOf(x.rank) >= 1);
  if (to === 'soldier') {
    const backers = made.filter((x) => rel(x, p.id).trust >= 0.4);
    g('sponsor', 'Made men who’ll back you', backers.length / 3, `${Math.min(3, backers.length)} of 3${sponsorOf(w, p) ? '' : ', and nobody to speak for you'}`, 'Spend time with made men. Do favours. Bring them something now and then.', backers.length >= 3 && !!sponsorOf(w, p));
  } else if (to === 'capo') {
    const bossT = boss ? rel(boss, p.id).trust : 0;
    const ub = made.find((x) => x.rank === 'underboss');
    const ubT = ub ? rel(ub, p.id).trust : 1;
    g('sponsor', `${boss ? first(boss) : 'The boss'}${ub ? ` and ${first(ub)}` : ''} behind ${you ? 'you' : 'him'}`, Math.min(bossT, ubT) / 0.5, `${boss ? first(boss) : 'boss'} ${bossT >= 0.5 ? 'yes' : 'not yet'}${ub ? `, ${first(ub)} ${ubT >= 0.5 ? 'yes' : 'not yet'}` : ''}`, 'Both of them have to want you. Be useful to them personally.', bossT >= 0.5 && ubT >= 0.5);
  } else {
    const t = boss ? rel(boss, p.id).trust : 0;
    g('sponsor', `${boss ? first(boss) : 'The boss'} has to trust ${you ? 'you' : 'him'}`, t / 0.6, t >= 0.6 ? 'he does' : 'not yet', 'Be seen. Be useful. Never be the reason he has a bad week.');
  }
  // proof of himself before he is made: once the rest of the road is done the family sets him a test (the same for every man: the
  // player chooses how to go about it, another man goes about it his best way; npcTrial below).
  const trial = to !== 'soldier' ? 'passed' : you ? st!.trial[to] ?? 'none' : rec.proved === to ? 'passed' : 'none';
  if (to === 'soldier') g('trial', 'Make your bones', trial === 'passed' ? 1 : 0, trial === 'passed' ? 'done' : trial === 'open' ? 'waiting on you: check your messages' : 'comes once the rest is done', 'A job is put to you. You choose how to do it.', trial === 'passed');
  const latched = you ? !!st!.latch?.[to] : rec.latch === to;
  if (latched) for (const x of goals) if (x.key !== 'trial') { x.done = true; x.frac = 1; }
  // Ready: the money passed up and a senior man who will speak for him are not negotiable; the rest (the breadth of his backing, the
  // work, his name, the family's hard work) is weighed together, so a man strong in most and short in one is still in the running.
  const rest = goals.filter((x) => x.key !== 'trial');
  const ready = latched || (goals.find((x) => x.key === 'earn')!.done && !!sponsorOf(w, p) && rest.reduce((a, x) => a + x.frac, 0) / rest.length >= READY_AT);
  if (ready && !you) (p.career ??= { done: 0, failed: 0, log: [] }).latch = to; // once he has done the work it stays done
  return { to, goals, ready, trial: trial as PathInfo['trial'], retryAt: st?.retry[to] ?? 0 };
}

// What to tell the player when they ask where they stand.
export function pathBlockers(w: World, p: Character): string[] {
  const i = pathInfo(w, p);
  if (!i) return [];
  return i.goals.filter((x) => !x.done).map((x) => x.tip);
}

// ---------------------------------------------------------------- the daily check
export function pathTick(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (!p?.alive || !p.familyId) return;
  const st = pathState(w);
  for (const g of [...(st.guar ?? [])]) {
    if (g.due > w.now) continue;
    st.guar = st.guar!.filter((x) => x !== g);
    const c = w.chars[g.who];
    if (!c?.alive) { p.cash = Math.max(0, p.cash - g.amt); continue; }
    const o = lineOf(w, c); const good = !!o && o.total > g.amt * 0.2 && (o.bad ?? 0) < 3;
    if (good) {
      earn(p, Math.round(g.amt * 0.25), 'cut'); feel(w, c, p.id, 'trust', 0.1);
      addFact(w, { kind: 'report', actor: c.id, minor: false, text: `${c.name} paid back what ${p.name} stood for, with something on top. ${p.name}’s word held.`, district: c.district }, { witnesses: [p.id] });
    } else {
      const pay = Math.min(p.cash, Math.round(g.amt * 0.6));
      p.cash -= pay; repute(w, p, -3, 'trial');
      addFact(w, { kind: 'report', actor: c.id, minor: false, text: `${c.name} couldn’t pay what ${p.name} stood for. ${p.name} covered ${money(pay)} out of his own pocket.`, district: c.district }, { witnesses: [p.id] });
    }
  }
  if (w.promo && !w.promo.result) return;
  const info = pathInfo(w, p);
  if (!info) { delete st.hold; return; }
  const to = info.to;
  if (to === 'boss') { delete st.hold; return; }
  if (!info.ready) {
    delete st.hold;
    return;
  }
  (st.latch ??= {})[to] = true; // once you've done the work it stays done
  if (p.jailedUntil > w.now || p.hurtUntil > w.now) return;
  const fam = w.fam[p.familyId];
  const boss = w.chars[fam.bossId];
  if (!boss?.alive) return;
  if (to === 'soldier' && info.trial !== 'passed') {
    const open = w.enc.some((e) => e.kind === 'promo' && e.data?.stage === 'trial' && e.status === 'open');
    if (open) return;
    if (st.trial[to] === 'open') { delete st.trial[to]; st.retry[to] = w.now + 3 * DAY; repute(w, p, -1, 'trial'); }
    if ((st.retry[to] ?? 0) > w.now) return;
    offerTrial(w, p, to);
    st.trial[to] = 'open';
    return;
  }
  if ((p.cooldown.induct ?? 0) > w.now) return;
  if (w.jobs.some((j) => j.kind === 'summons' && j.meeting === 'induction' && j.status === 'offered')) return;
  if (to !== 'underboss' && !vacancy(w, p.familyId, to)) return; // he waits for a seat, like any man whose road is done (career.noticeTick)
  if (to === 'underboss' && !canSeatUnderboss(w, boss, p)) return;
  st.hold = to;
  makeRoom(w, p, boss, to);
  const sp = sponsorOf(w, p) ?? boss;
  w.promo = { to, stage: 0, since: w.now, next: w.now + 4 * 60, sponsor: sp.id, points: 1, log: [] };
}

// (the family makes room for a man whose road is done, as it would for anyone's: career.openSeatFor, within what the family can carry)
function openSeat(w: World, fid: Id, to: Rank) {
  while (!vacancy(w, fid, to) && openSeatFor(w, fid, to));
}

// The chair beside the boss: empty, or the boss rates this man well above the one in it, in which case he moves that one aside
// (the same for any captain whose road is done: career.careerTick).
function makeRoom(w: World, p: Character, boss: Character, to: Rank) {
  const fam = w.fam[p.familyId!];
  if (to !== 'underboss') return;
  const u = members(w, fam.id).find((x) => x.rank === 'underboss' && x.id !== p.id);
  if (u) {
    bear(w, u, p.id, 0.25, `${p.name} went for the seat above him`);
    applyRank(w, u, 'capo', { wage: 300, place: (x) => { x.bossId = boss.id; }, fact: { actor: boss.id, victim: u.id, story: 'seat:underboss', text: `${boss.name} has moved ${u.name} aside. He is a captain again, and the chair beside the boss is to go to ${p.name}.`, broadcast: members(w, fam.id).map((y) => y.id) } });
  }
}

// ---------------------------------------------------------------- the trial
type Way = 'muscle' | 'charm' | 'nerve' | 'brains';
const TRIAL: Record<string, { title: string; lead: string; ways: Record<Way, string> }> = {
  soldier: {
    title: 'Make your bones',
    lead: 'has a job that needs a man he can rely on. It’s the kind of job nobody mentions afterwards. How you do it is up to you.',
    ways: {
      muscle: 'Lean on a late payer until he pays, hard if he needs it',
      charm: 'Talk a stubborn shopkeeper round to the family’s way',
      nerve: 'Drive a package across the river, no questions asked',
      brains: 'Find where a book is leaking money, and fix it quietly',
    },
  },
  capo: {
    title: 'Prove you can run a crew',
    lead: 'has put a problem in front of you. If you can handle it, nobody will doubt you can carry a crew.',
    ways: {
      muscle: 'Put a rival crew back in their place',
      charm: 'Broker peace between two of your own men who can’t stand each other',
      nerve: 'Take a risky job yourself when nobody else would',
      brains: 'Reorganise the crew’s collections so nothing is missed',
    },
  },
  underboss: {
    title: 'Earn the boss’s confidence',
    lead: 'wants to see how you handle something that could go badly for the whole family.',
    ways: {
      muscle: 'Settle a dangerous quarrel with another family by force of presence',
      charm: 'Sit down with the other family and talk them out of it',
      nerve: 'Go yourself, alone, and make the call on the spot',
      brains: 'Find the weak point in their position and use it',
    },
  },
};
export function chanceOf(p: Character, way: Way, bonus = 0): number {
  const T = p.traits, S = p.skills;
  const base = way === 'muscle' ? 0.35 + T.violence * 0.3 + S.muscle * 0.25 + T.courage * 0.1
    : way === 'charm' ? 0.3 + S.charm * 0.4 + T.sociability * 0.2 + p.standing / 400
    : way === 'nerve' ? 0.3 + S.nerve * 0.3 + S.driving * 0.2 + T.courage * 0.2
    : 0.3 + S.brains * 0.45 + T.caution * 0.2;
  return clamp(base + bonus, 0.35, 0.92);
}
const bonusOf = (w: World, to: Rank) => Math.min(0.3, (w.path?.fails?.[to] ?? 0) * 0.12);
// An NPC's test: the same test, the same odds, taken the way that suits him best; a man who fails may try again, and they know he tried.
export function npcTrial(w: World, c: Character, to: Rank, by: Character) {
  const rec = (c.career ??= { done: 0, failed: 0, log: [] });
  if (rec.proved === to || !TRIAL[to]) return;
  const way = (Object.keys(TRIAL[to].ways) as Way[]).sort((a, b) => chanceOf(c, b) - chanceOf(c, a))[0];
  const bonus = Math.min(0.3, (rec.tries ?? 0) * 0.12);
  if (w.rng.chance(chanceOf(c, way, bonus))) {
    rec.proved = to; delete rec.tries;
    repute(w, c, 3, 'trial'); feel(w, by, c.id, 'respect', 0.07);
    addFact(w, { kind: 'report', actor: c.id, story: 'seat:' + to, minor: false, text: `${by.name} set ${c.name} a job to see what he was made of. ${c.name} handled it.`, district: c.district }, { witnesses: [c.id, by.id] });
  } else {
    rec.tries = (rec.tries ?? 0) + 1;
    repute(w, c, -1, 'trial'); feel(w, by, c.id, 'respect', -0.03);
  }
}
function offerTrial(w: World, p: Character, to: Rank) {
  const boss = w.chars[w.fam[p.familyId!].bossId];
  const sp = to === 'underboss' ? boss : sponsorOf(w, p) ?? boss;
  const t = TRIAL[to];
  if (!t) return;
  addEnc(w, {
    kind: 'promo', from: sp.id, title: t.title, days: 9,
    lines: [`${sp.name} ${t.lead}`, `"You’ve done what was asked. This is the last thing. You decide how."`],
    opts: (Object.keys(t.ways) as Way[]).map((k) => ({ code: k, label: t.ways[k], hint: `Your odds: about ${Math.round(chanceOf(p, k, bonusOf(w, to)) * 100 / 5) * 5}%${bonusOf(w, to) ? ' (they know you tried)' : ''}` })),
    data: { stage: 'trial', to },
  });
}
export function trialChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const to = String(e.data?.to) as Rank;
  const st = pathState(w);
  const sp = e.from ? w.chars[e.from] : undefined;
  const ok = w.rng.chance(chanceOf(p, code as Way, bonusOf(w, to)));
  if (ok) {
    st.trial[to] = 'passed';
    repute(w, p, 3, 'trial');
    if (sp) feel(w, sp, p.id, 'respect', 0.07);
    addFact(w, { kind: 'report', actor: p.id, story: 'seat:' + to, minor: false, text: `${sp?.name ?? 'The boss'} heard how ${p.name} handled it. He said one word, and the word was “good”.`, district: p.district }, { broadcast: sp ? [p.id, sp.id] : [p.id] });
    return [`It goes the way you hoped. ${sp?.name ?? 'He'} hears about it before you tell him. ${sp ? `"Good," he says. That is all, and it is a great deal.` : ''}`, 'Whatever is left is formality. The family will be in touch.'];
  }
  delete st.trial[to];
  (st.fails ??= {})[to] = (st.fails[to] ?? 0) + 1;
  st.retry[to] = w.now + 3 * DAY;
  repute(w, p, -1, 'trial');
  if (sp) feel(w, sp, p.id, 'respect', -0.03);
  return [`It doesn’t go well. Not a disaster, but not what ${sp?.name ?? 'he'} wanted to see.`, `${sp ? first(sp) : 'He'} says you can have another chance in a few days. Think about which way suits you.`];
}

// ---------------------------------------------------------------- above capo: the chair
export function chairReady(w: World, p: Character): boolean {
  if (p.rank !== 'underboss') return false;
  return !!w.chars[w.fam[p.familyId!]?.bossId]?.alive;
}
export interface ChairOpt { code: 'ask' | 'move'; label: string; hint: string; chance: number }
export function chairOptions(w: World, p: Character): ChairOpt[] {
  if (!chairReady(w, p)) return [];
  const boss = w.chars[w.fam[p.familyId!].bossId];
  if (!boss?.alive) return [];
  const rb = rel(boss, p.id);
  const ask = clamp(0.1 + rb.trust * 0.5 + rb.respect * 0.2 - boss.traits.ambition * 0.25 - boss.traits.greed * 0.1 + (boss.jailedUntil > w.now ? 0.2 : 0), 0.05, 0.85);
  const backers = members(w, p.familyId!).filter((x) => x.id !== p.id && x.id !== boss.id && (x.rank === 'capo') && rel(x, p.id).trust >= 0.5);
  const loyal = members(w, p.familyId!).filter((x) => x.id !== boss.id && x.id !== p.id && x.rank !== 'associate' && rel(x, boss.id).trust > 0.7).length;
  const move = clamp(0.25 + backers.length * 0.14 + p.skills.nerve * 0.15 - loyal * 0.05 + (boss.jailedUntil > w.now ? 0.2 : 0), 0.1, 0.85);
  const blocked = (p.cooldown.chair ?? 0) > w.now;
  return [
    { code: 'ask', label: `Ask ${first(boss)} to step aside`, hint: blocked ? 'You tried recently. Give it time.' : `He may go quietly if he trusts you. About ${Math.round(ask * 100 / 5) * 5}%.`, chance: blocked ? 0 : ask },
    { code: 'move', label: `Move against ${first(boss)}`, hint: blocked ? 'You tried recently. Give it time.' : `With your captains behind you. If it fails you won’t get a second chance soon. About ${Math.round(move * 100 / 5) * 5}%.`, chance: blocked ? 0 : move },
  ];
}
export function chairAct(w: World, p: Character, code: string): string[] {
  const opt = chairOptions(w, p).find((o) => o.code === code);
  const boss = w.chars[w.fam[p.familyId!].bossId];
  if (!opt || !boss) return ['Not now.'];
  if (opt.chance <= 0) return ['Not now. Give it time.'];
  const fam = w.fam[p.familyId!];
  const win = w.rng.chance(opt.chance);
  const all = members(w, fam.id).map((c) => c.id);
  if (code === 'ask') {
    if (win) {
      applyRank(w, boss, 'capo', { wage: 400, fact: false, repair: false, place: (x) => { x.bossId = p.id; } });
      takeChair(w, p, boss.id, 'stepped');
      chairCeremony(w, p);
      addFact(w, { kind: 'promotion', actor: p.id, text: `${boss.name} has stepped down. ${p.name} is the head of the ${famName(w, p)} family.`, district: p.district }, { broadcast: all });
      return [`${boss.name} is quiet for a long time. Then he reaches for his coat. "It was always going to be someone. Better you than a stranger."`, 'You are the boss.'];
    }
    p.cooldown.chair = w.now + 30 * DAY;
    feel(w, boss, p.id, 'trust', -0.25);
    bear(w, boss, p.id, 0.3, `${p.name} went for his chair`);
    return [`${boss.name} looks at you the way a man looks at a stranger in his house. "No." He doesn’t raise his voice.`, 'He will remember you asked.'];
  }
  if (win) {
    const dead = boss.name;
    addFact(w, { kind: 'murder', actor: p.id, victim: boss.id, text: `${dead} was found dead. The family closed ranks very quickly.`, district: boss.district }, { broadcast: all, witnesses: [] });
    handleDeath(w, boss.id, { cause: 'coup', favoured: p.id });
    if (fam.bossId !== p.id) takeChair(w, p, boss.id, 'coup');
    chairCeremony(w, p);
    return [`It is done quickly, and the men who matter are told before the street is. Nobody asks you where you were.`, 'You are the boss. Don’t let anyone work out how.'];
  }
  p.cooldown.chair = w.now + 45 * DAY;
  p.hurtUntil = w.now + 10 * DAY;
  repute(w, p, -20, 'failed coup');
  feelTo(boss, p.id, 'trust', 0); bearAtLeast(w, boss, p.id, 0.9, `${p.name} went for his chair and lost`);
  for (const c of members(w, fam.id)) if (c.rank === 'capo' && c.id !== p.id) feel(w, c, p.id, 'trust', -0.2);
  return ['It goes wrong. Somebody talked, or somebody lost their nerve.', `${boss.name} lets you live, because killing his own underboss in public would look like weakness. He will not forget.`];
}
function chairCeremony(w: World, p: Character) {
  const cap = members(w, p.familyId!).find((c) => c.id !== p.id && (c.rank === 'underboss' || c.rank === 'capo'));
  mkJob(w, { kind: 'summons', meeting: 'induction', extra: { to: 'boss' }, giver: (cap ?? p).id, via: 'boss', assignee: p.id, pay: 0, days: 10, title: 'The family gathers', brief: 'The men who matter want to see you take the chair properly. They will come one at a time. You don’t get a second first impression.' } as never);
}
function takeChair(w: World, p: Character, oldId: Id, cause = 'stepped') {
  const fam = w.fam[p.familyId!];
  const cs = candidates(w, fam.id, oldId, { cause, favoured: p.id });
  fam.bossId = p.id;
  applyRank(w, p, 'boss', { fact: false, repair: false, place: (x) => { x.bossId = null; for (const c of Object.values(w.chars)) if (c.alive && c.bossId === oldId && c.id !== x.id) c.bossId = x.id; } });
  repute(w, p, 6, 'took the chair');
  repairHierarchy(w, fam.id);
  leaderChanged(w, fam.id, p, oldId, cause, cs);
  void promote;
}

// ---------------------------------------------------------------- what rank lets you do: make men
export interface Raise { c: Character; to: Rank }
export function raisable(w: World, p: Character): Raise[] {
  if (!p.familyId || p.rank !== 'underboss') return [];
  return members(w, p.familyId)
    .filter((c) => c.id !== p.id && !c.isPlayer && c.jailedUntil <= w.now && c.rank === 'associate' && !isRunner(w, c) && !c.prospect && c.lifetimeKick >= 400)
    .sort((a, b) => b.lifetimeKick - a.lifetimeKick).slice(0, 6).map((c) => ({ c, to: 'soldier' as Rank }));
}
export function raise(w: World, p: Character, c: Character, to: Rank): string[] {
  const fam = w.fam[p.familyId!];
  if ((p.cooldown.raise ?? 0) > w.now) return ['You made a man very recently. Let the family catch its breath.'];
  const boss = w.chars[fam.bossId];
  if (!vacancy(w, fam.id, to)) {
    if (boss && rel(boss, p.id).trust < 0.5) return [`${boss.name} won’t add another ${to}. “Not yet. You’ve not earned that kind of say.”`];
    openSeat(w, fam.id, to);
    if (!vacancy(w, fam.id, to)) return [`There is no room for another ${to}. The family hasn’t the men below to carry one.`];
  }
  promote(w, c, to, p);
  ledgerAdd(w, 'made', c.id, `You made ${c.name} a ${to}.`);
  fam.lastPromo = w.now;
  p.cooldown.raise = w.now + 3 * DAY;
  feel(w, c, p.id, 'trust', 0.25);
  feel(w, c, p.id, 'affection', 0.1);
  return [`You put ${c.name}’s name forward and nobody objects. He is a ${to} now, and he knows exactly who to thank.`];
}

// The boss answers to nobody: any man can be made, broken, or moved.
export const RANKS: Rank[] = ['associate', 'soldier', 'capo', 'underboss'];
export function setRank(w: World, p: Character, c: Character, to: Rank): string[] {
  if (p.rank !== 'boss' || c.id === p.id || !c.alive || c.familyId !== p.familyId) return ['That isn’t yours to decide.'];
  if (c.rank === to) return [];
  const fam = w.fam[p.familyId!];
  const up = LADDER.indexOf(to) > LADDER.indexOf(c.rank);
  const was = c.rank;
  if (to === 'underboss') {
    const u = members(w, fam.id).find((x) => x.rank === 'underboss' && x.id !== c.id);
    if (u) { applyRank(w, u, 'capo', { fact: false, repair: false, place: (x) => { x.bossId = c.id; } }); feel(w, u, p.id, 'trust', -0.2); }
    for (const x of members(w, fam.id)) if (x.rank === 'capo' && x.id !== c.id) x.bossId = c.id;
    c.bossId = p.id;
  } else if (to === 'capo') c.bossId = members(w, fam.id).find((x) => x.rank === 'underboss')?.id ?? p.id;
  else {
    const caps = members(w, fam.id).filter((x) => x.rank === 'capo' && x.id !== c.id);
    const count = (x: Character) => members(w, fam.id).filter((y) => y.bossId === x.id).length;
    c.bossId = caps.sort((a, b) => count(a) - count(b))[0]?.id ?? p.id;
  }
  // his own men follow him up, or go to his boss if he is broken
  for (const x of members(w, fam.id)) if (x.bossId === c.id && LADDER.indexOf(x.rank) >= LADDER.indexOf(to)) x.bossId = c.bossId;
  applyRank(w, c, to, { fact: false, repair: false });
  c.sponsor = p.id; delete c.backer;
  feel(w, c, p.id, 'trust', (up ? 0.25 : -0.25));
  bear(w, c, p.id, (up ? 0 : 0.3), `${p.name} put him down`);
  addFact(w, { kind: 'promotion', actor: p.id, victim: c.id, text: up ? `${c.name} was made ${to === 'soldier' ? 'a soldier' : 'a ' + to} by ${p.name}.` : `${c.name} has been put down to ${to === 'soldier' ? 'soldier' : to === 'capo' ? 'captain' : 'associate'} by ${p.name}.`, district: c.district }, { broadcast: members(w, fam.id).map((x) => x.id) });
  repairHierarchy(w, fam.id);
  void was;
  return [up ? `${c.name} is a ${to} now. Nobody asked you to explain.` : `${c.name} takes it without a word. That’s the worst kind of taking it.`];
}

// ---------------------------------------------------------------- what only this rank can do
export interface Power { code: string; label: string; hint: string; off?: boolean }
const cd = (w: World, p: Character, k: string) => (p.cooldown[`pw:${k}`] ?? 0) > w.now;
const waitDays = (w: World, p: Character, k: string) => Math.ceil(((p.cooldown[`pw:${k}`] ?? 0) - w.now) / DAY);
const TURF_CAP: Record<string, number> = { capo: 2, underboss: 3, boss: 5 };
const turfOf = (w: World) => pathState(w).turf ?? [];
const nextTurf = (w: World, p: Character) => w.fam[p.familyId!].districts.find((d) => !turfOf(w).includes(d));
export function powerOptions(w: World, p: Character): Power[] { return powerOptions2(w, p); }
export function usePower(w: World, p: Character, code: string): string[] {
  const opt = powerOptions(w, p).find((o) => o.code === code);
  if (!opt || opt.off) return [opt?.hint ?? 'Not now.'];
  const r2 = usePower2(w, p, code);
  if (r2) return r2;
  if (code === 'crewscore') code = 'score';
  const rng = w.rng;
  const set = (days: number) => { p.cooldown[`pw:${code}`] = w.now + days * DAY; };
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.rank !== 'civilian');
  const caps = members(w, p.familyId!).filter((c) => c.rank === 'capo' && c.id !== p.id);
  if (code === 'lawyer') {
    p.heat = 0; p.jailedUntil = Math.min(p.jailedUntil, w.now);
    for (const c of members(w, p.familyId!)) if (p.rank === 'boss' && c.jailedUntil > w.now) c.jailedUntil = w.now;
    set(p.rank === 'boss' ? 10 : 14);
    return ['The lawyer makes two calls. By morning the file has a problem, and so does the man who was holding it.', 'Heat: gone.'];
  }
  if (code === 'courtesy') {
    const amt = rng.int(2, 6) * 100;
    earn(p, amt, 'protection'); p.heat = Math.min(1, p.heat + 0.04); set(5);
    return [`A florist, a tailor, a man with a butcher’s shop. Each remembers what you are. ${money(amt)} by the end of the afternoon, all of it offered.`];
  }
  if (code === 'score') {
    let take = 0;
    for (let i = 0; i < crew.length; i++) take += rng.int(250, 700);
    take = Math.round(take / 10) * 10;
    earn(p, take, 'delegated'); p.heat = Math.min(1, p.heat + 0.1); set(7);
    const lines = [`You send everyone out on one job, and it goes the way those jobs should. ${money(take)} comes back.`];
    if (rng.chance(0.2)) { const m = rng.pick(crew); m.jailedUntil = w.now + rng.int(4, 10) * DAY; lines.push(`${m.name} was picked up on the way home. He’ll keep his mouth shut. It’ll cost you to keep him comfortable.`); feel(w, m, p.id, 'trust', 0.05); }
    return lines;
  }
  if (code === 'dinner') {
    p.cash -= 400; set(7);
    for (const c of crew) { feel(w, c, p.id, 'trust', 0.08); feel(w, c, p.id, 'affection', 0.06); }
    return [`A long table, too much food. Nobody mentions work. By the end they’re laughing at each other’s stories. Your men leave a little more yours than when they came.`];
  }
  if (code === 'tax') {
    let take = 0;
    for (const c of caps) { take += rng.int(900, 2000); feel(w, c, p.id, 'trust', -0.03); }
    take = Math.round(take / 50) * 50;
    earn(p, take, 'kickups'); set(7);
    return [`Each captain sends something upstairs and a man with it who doesn’t say much. ${money(take)}. They’ll pay it. They won’t enjoy it.`];
  }
  if (code === 'counsel') {
    const boss = w.chars[w.fam[p.familyId!].bossId];
    if (boss) { feel(w, boss, p.id, 'trust', 0.06); feel(w, boss, p.id, 'respect', 0.04); }
    repute(w, p, 2, 'trial'); set(8);
    return [`Over coffee, you put things the way he already half-thinks them. ${boss?.name ?? 'The boss'} nods. He thinks it was his idea. That is the art.`];
  }
  if (code === 'tribute') {
    const men = members(w, p.familyId!).filter((c) => c.id !== p.id);
    let take = 0;
    for (const c of men) take += c.rank === 'underboss' ? rng.int(1500, 3000) : c.rank === 'capo' ? rng.int(900, 1800) : c.rank === 'soldier' ? rng.int(100, 300) : rng.int(0, 60);
    take = Math.round(take / 50) * 50;
    earn(p, take, 'kickups'); set(7);
    return [`Envelopes arrive all week and nobody asks what you spend them on. ${money(take)}.`];
  }
  if (code === 'piece') {
    const boss = p.bossId ? w.chars[p.bossId] : undefined;
    set(30);
    if (!boss) return ['There’s nobody to ask.'];
    const ok = rng.chance(clamp(0.2 + rel(boss, p.id).trust * 0.6 + p.standing / 400, 0.1, 0.85));
    if (!ok) { feel(w, boss, p.id, 'respect', -0.02); return [`${boss.name} listens to the whole ask. "Not now." He doesn’t say what would change that.`]; }
    p.books.side = (p.books.side ?? 0) + 250; p.books.sideKnown = true;
    return [`${boss.name} thinks about it for a day. Then a name and an address: a vending route that was nobody’s in particular. "It’s yours. Keep it clean."`, 'About $250 a week, and it’s all above board.'];
  }
  if (code === 'stand') {
    const st = pathState(w);
    const c = Object.values(w.chars).filter((x) => x.alive && x.bossId === p.id && (lineOf(w, x)?.level ?? 1) < 3 && !!lineOf(w, x)).sort((a, b) => rel(b, p.id).trust - rel(a, p.id).trust)[0];
    if (!c) return ['There’s nobody who could use it.'];
    const op = lineOf(w, c)!, amt = 3000 * (op.level ?? 1);
    op.level = (op.level ?? 1) + 1; op.stake = (op.stake ?? 0) + amt; c.cash += Math.round(amt * 0.2);
    (st.guar ??= []).push({ who: c.id, amt, due: w.now + 90 * DAY });
    feel(w, c, p.id, 'trust', 0.15); feel(w, c, p.id, 'affection', 0.05);
    set(14);
    return [`You tell the lender you’ll stand for ${c.name}. ${money(amt)} goes into his operation on your word alone.`, 'In about three months it’ll be paid back, or it will be yours to pay. A made man’s word is a promissory note.'];
  }
  if (code === 'award') {
    const c = Object.values(w.chars).filter((x) => x.alive && x.bossId === p.id && !!lineOf(w, x) && (lineOf(w, x)!.level ?? 1) < 3).sort((a, b) => (lineOf(w, b)!.total) - (lineOf(w, a)!.total))[0];
    if (!c) return ['There’s nobody who has earned it.'];
    { const op = lineOf(w, c)!; op.level = (op.level ?? 1) + 1; }
    feel(w, c, p.id, 'trust', 0.15); feel(w, c, p.id, 'affection', 0.08);
    c.traits.ambition = clamp(c.traits.ambition + 0.07);
    repute(w, p, 1, 'trial'); set(14);
    if (c.traits.ambition > 0.8 && c.want?.kind !== 'independent') c.want = { kind: 'independent', since: w.now };
    return [`You give ${c.name} a bigger piece of the business to run. He thanks you in a way that makes you believe him.`, `He’ll make you more money. A man with that much to lose also starts to think about what he could win.`];
  }
  if (code === 'quiet' || code === 'push') {
    const fam = w.fam[p.familyId!];
    fam.directive = { kind: code, until: w.now + 14 * DAY };
    set(14);
    for (const c of members(w, fam.id)) if (c.id !== p.id) { if (code === 'quiet') c.heat = Math.max(0, c.heat - 0.25); else feel(w, c, p.id, 'respect', -0.01); }
    if (code === 'quiet') p.heat = Math.max(0, p.heat - 0.2);
    return [code === 'quiet' ? 'The word goes down the line: stay home, stay quiet. For two weeks the family earns a little less and the police find less to look at.' : 'The word goes down the line: more. For two weeks everyone is out earning, and everyone is more visible.'];
  }
  if (code === 'review') {
    set(10);
    const lines: string[] = [];
    for (const c of members(w, p.familyId!)) {
      if (c.id === p.id || (c.rank !== 'capo' && c.rank !== 'soldier')) continue;
      const h = c.books.history.slice(-3);
      if (c.books.side && !c.books.sideKnown) { c.books.sideKnown = true; lines.push(`${c.name} has an operation of his own, about ${money(c.books.side)} a week, in no one’s books but his.`); }
      else if (h.length && h.reduce((a, x) => a + Math.max(0, x.expected - x.due), 0) > 150) lines.push(`${c.name}’s declared numbers are lower than what the books say he takes in. Not by accident.`);
    }
    return lines.length ? ['You spend a week with the books and a man who knows how to read them.', ...lines.slice(0, 4)] : ['A week with the books. Everyone’s numbers are what they say they are, which is either good news or very good bookkeeping.'];
  }
  if (code === 'rules_down' || code === 'rules_up') {
    const d = code === 'rules_down' ? -0.05 : 0.05;
    for (const c of members(w, p.familyId!)) if (c.id !== p.id && c.rank !== 'civilian') { c.kickRate = clamp(c.kickRate + d, 0.05, 0.4); feel(w, c, p.id, 'trust', (d < 0 ? 0.06 : -0.06)); if (d < 0 && c.traits.ambition > 0.7) c.traits.greed = clamp(c.traits.greed + 0.02); }
    set(45);
    return [d < 0 ? 'The word goes out: five points less. The captains are delighted. Some of them will spend it well. Some won’t.' : 'The word goes out: five points more. Nobody says anything to your face.', d < 0 ? 'Your own income from kick-ups will fall.' : 'Your own income from kick-ups will rise.'];
  }
  if (code === 'book') {
    const st = pathState(w);
    const cost = ((st.book ?? 0) + 1) * 1500;
    p.cash -= cost; st.book = (st.book ?? 0) + 1;
    const weekly = Math.round(cost * 0.1);
    p.books.side = (p.books.side ?? 0) + weekly;
    set(3);
    return [`A man in a back office knows a dozen people who need money and can’t ask a bank. You put ${money(cost)} out through him. About ${money(weekly)} a week will come back, in cash, in no one’s books.`, 'It’s your own business. If anyone upstairs finds out, they’ll want to know why you didn’t mention it.'];
  }
  if (code === 'claim') {
    const st = pathState(w);
    const d = nextTurf(w, p);
    if (!d) return ['Nothing left to claim.'];
    p.cash -= 1500;
    (st.turf ??= []).push(d);
    repute(w, p, 1, 'trial'); set(10);
    addFact(w, { kind: 'report', actor: p.id, minor: false, text: `${p.name} has let it be known that ${d} answers to him now.`, district: d }, { broadcast: members(w, p.familyId!).map((c) => c.id) });
    return [`A word in the right ears. By the end of the week every shopkeeper in ${d} knows whose name to say when a man in a good coat comes in.`, 'They’ll pay a little each week, and you’ll have to see that nobody else bothers them.'];
  }
  if (code === 'ear') {
    p.cash -= 250; set(6);
    const fresh = Object.values(w.facts).filter((f) => !f.minor && !p.known[f.id] && w.now - f.t < 40 * DAY && f.kind !== 'rumour').sort(() => rng.next() - 0.5).slice(0, 2);
    if (!fresh.length) return ['A week of listening. Nothing you didn’t already know.'];
    for (const f of fresh) learn(w, p.id, f, 'informant', !f.hiddenActor);
    return ['A barber, a bartender, a sergeant who owes someone. You hear:', ...fresh.map((f) => factText(f, !f.hiddenActor))];
  }
  if (code === 'lean') {
    const others = Object.values(w.fam).filter((f) => f.id !== p.familyId);
    const f2 = rng.pick(others), fam = w.fam[p.familyId!];
    const take = rng.int(3000, 6500);
    earn(p, take, 'protection'); p.heat = Math.min(1.5, p.heat + 0.15);
    fam.tension[f2.id] = (fam.tension[f2.id] ?? 0) + 2; f2.tension[fam.id] = (f2.tension[fam.id] ?? 0) + 2;
    set(10);
    addFact(w, { kind: 'report', actor: p.id, minor: false, text: `Somebody in the ${fam.name} family has started taking a share of the ${f2.name} family’s numbers on the border.`, district: p.district }, { broadcast: members(w, f2.id).map((c) => c.id) });
    return [`A route changes hands, a driver is told to look the other way. ${money(take)} arrives the first week.`, `The ${f2.name} people noticed. They haven’t said anything yet. That is the part you should worry about.`];
  }
  if (code === 'peace') {
    const fam = w.fam[p.familyId!];
    const worst = Object.entries(fam.tension).sort((a, b) => b[1] - a[1])[0];
    p.cash -= 1000; set(12);
    repute(w, p, 2, 'trial');
    if (!worst || worst[1] <= 0) return ['You send the gifts and make the calls. There’s nothing to settle, which is a good way to find out.'];
    const f2 = w.fam[worst[0]];
    fam.tension[f2.id] = Math.max(0, worst[1] - 3); f2.tension[fam.id] = Math.max(0, (f2.tension[fam.id] ?? 0) - 3);
    noteDeal(w, fam.id, f2.id, `${p.name} brokered a peace over dinner`, 0.15);
    return [`A dinner nobody admits happened. By the end of it the ${f2.name} people and your people have remembered why they used to do business.`];
  }
  if (code === 'levy') {
    const fam = w.fam[p.familyId!];
    fam.levy = { extra: 0.07, until: w.now + 4 * 7 * DAY };
    for (const c of members(w, fam.id)) if (c.id !== p.id) feel(w, c, p.id, 'trust', -0.03);
    addFact(w, { kind: 'levy', actor: p.id, text: `The ${fam.name} family is financing a big venture. Everyone owes 7% extra for the next four weeks.`, district: p.district }, { broadcast: members(w, fam.id).map((c) => c.id) });
    set(60);
    return ['The word goes down the line. Nobody complains where you can hear it.', 'For four weeks, everyone passes up 7% more.'];
  }
  if (code === 'bonus') {
    const men = members(w, p.familyId!).filter((c) => c.id !== p.id && LADDER.indexOf(c.rank) >= 1);
    const cost = men.length * 200;
    if (p.cash < cost) return [`That’s ${money(cost)}. You haven’t got it.`];
    p.cash -= cost; set(30);
    for (const c of men) { c.cash += 200; feel(w, c, p.id, 'trust', 0.1); feel(w, c, p.id, 'affection', 0.05); }
    repute(w, p, 3, 'trial');
    return [`An envelope for every made man in the family, with a card. It costs ${money(cost)}. They’ll remember who sent it, and they’ll remember if next year there isn’t one.`];
  }
  if (code === 'commission') {
    p.heat = Math.max(0, p.heat - 0.3); repute(w, p, 4, 'trial'); set(14);
    return [`Five families, one table, one agreement that nobody will put in writing. You’re spoken to like a man whose word moves things. The police find, somehow, that there’s less to look at.`];
  }
  return [];
}

// What a claimed district pays every week.
export function turfWeek(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  const st = w.path;
  if (!p?.alive || !st?.turf?.length) return;
  let total = 0;
  for (const d of st.turf) for (const b of Object.values(w.biz)) {
    if (!b.open || b.district !== d || b.ownerId === p.id) continue;
    const pay = Math.min(Math.max(0, b.cash), Math.round(b.income * 0.1));
    if (pay <= 0) continue;
    bizMove(w, b, -pay, 'extort', p.id); total += pay;
  }
  if (total > 0) { earn(p, total, 'protection'); p.heat = Math.min(1.5, p.heat + 0.01 * st.turf.length); }
}
