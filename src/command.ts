// Orders, by the hierarchy (The Family, October 2026). A man can have someone beaten, a place wrecked, or a man killed, but whose word
// he needs depends on who the target is and where both men stand, and the man he sends is a man, not a button.
//
//   whom he can send     anyone below him in his own chain: an associate's or a soldier's crewmen, a captain's soldiers and theirs, the
//                        underboss's and the boss's whole family through it
//   whose leave          a civilian: his own call (a killing: his captain's); another crew's man: that man's captain; a made man, or
//                        killing anyone connected: the boss's; a place another family protects: his captain's; a place his own family
//                        protects: nobody can allow it, it is a breach
//   asking               the man whose word it is decides by how he sees the one asking and the one named, what it would cost him, and
//                        his own temper; he may give it, refuse it, or say he'll see to it his own way
//   the man sent         weighs it: what he owes the one who sent him, his stomach for this work, whether the target is a friend of his,
//                        whether anyone with the right has allowed it, his own caution; he goes, or refuses and says why. A man who goes
//                        may still lose his nerve or make a mess of it.
//   going around it      possible: it is recorded, and the man whose word it was holds it, with the reason
// The deed itself is the world's own (actions.perform: a beating, a fire, a killing), done by the man sent, a day or two later, so it is
// witnessed, known, guessed at and answered like any other. Who sent him is known only to the two of them, until it gets out.
import { addFact, bear, clamp, feel, notifyProtector, rel, witnessesAt } from './core';
import { bizMove } from './econ';
import { isConsigliere, positionOf, SENIORITY } from './standing';
import { temper } from './temper';
import { tension } from './actions';
import { DAY, type Business, type Character, type Id, type Pending, type World } from './types';

export type Deed = 'beat' | 'wreck' | 'kill';
const MADE = new Set(['soldier', 'capo', 'underboss', 'boss']);
const first = (c: Character) => c.name.split(' ')[0];
const sen = (w: World, c: Character) => SENIORITY[positionOf(w, c)] ?? 0;
type Target = Character | Business;
const isBiz = (t: Target): t is Business => 'ownerId' in t && 'kind' in t && !('rank' in t);
const tName = (t: Target) => t.name;
export const deedWord = (deed: Deed, t: Target) => (deed === 'wreck' ? `${tName(t)} wrecked` : deed === 'kill' ? `${tName(t)} killed` : `${tName(t)} beaten`);

// the man above c who commands a crew: his captain, or whoever above that he answers to
export function captainOf(w: World, c: Character): Character | undefined {
  let x = c.bossId ? w.chars[c.bossId] : undefined;
  for (let i = 0; x && i < 6; i++, x = x.bossId ? w.chars[x.bossId] : undefined) if (x.rank === 'capo' || x.rank === 'underboss' || x.rank === 'boss') return x;
  return undefined;
}
// Is m below p, at any depth, in p's own chain of command?
export function under(w: World, p: Character, m: Character): boolean {
  let x = m.bossId ? w.chars[m.bossId] : undefined;
  for (let i = 0; x && i < 8; i++, x = x.bossId ? w.chars[x.bossId] : undefined) if (x.id === p.id) return true;
  return false;
}
// The men p can send: his own chain, free to go, his own men first.
export function sendable(w: World, p: Character, target?: Target): Character[] {
  const tid = target && !isBiz(target) ? target.id : undefined;
  return Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.id !== tid && c.jailedUntil <= w.now && c.hurtUntil <= w.now && under(w, p, c) && !isConsigliere(w, c))
    .sort((a, b) => Number(b.bossId === p.id) - Number(a.bossId === p.id) || (a.id < b.id ? -1 : 1)).slice(0, 8);
}

// ------------------------------------------------------------------------------------------------ whose leave
export interface Leave { need: 'none' | 'captain' | 'boss' | 'breach'; from?: Character; why: string; have: boolean; commission?: boolean }
const leaveKey = (deed: Deed, id: Id) => `leave:${deed}:${id}`;
export function leaveFor(w: World, p: Character, deed: Deed, target: Target): Leave {
  const fam = p.familyId ? w.fam[p.familyId] : undefined, boss = fam ? w.chars[fam.bossId] : undefined;
  const has = (id: Id) => (p.cooldown[leaveKey(deed, id)] ?? 0) > w.now || (p.cooldown[`sanction:${id}`] ?? 0) > w.now;
  const pBoss = p.rank === 'boss' || positionOf(w, p) === 'acting boss';
  // a man at or above the one whose word it is needs nobody's
  const mine = (from: Character | undefined) => !from || from.id === p.id || sen(w, p) >= sen(w, from);
  const upper = captainOf(w, p) ?? boss;
  if (isBiz(target)) {
    const prot = target.protection;
    if (prot && prot.familyId === p.familyId) return { need: 'breach', why: `${target.name} pays our own family; wrecking it is robbing our own`, have: false };
    if (prot) return { need: 'captain', from: upper, why: `${target.name} pays the ${w.fam[prot.familyId]?.name ?? 'other'} family, and that starts something`, have: mine(upper) || has(target.id) };
    return { need: 'none', why: 'nobody looks after it', have: true };
  }
  const t = target, same = !!t.familyId && t.familyId === p.familyId;
  if (MADE.has(t.rank)) {
    const commission = !same && !!t.familyId;
    const why = same && deed === 'kill' ? `${t.name} is one of ours, and only the boss can allow a made man of his own family to be killed`
      : `${t.name} is a made man${commission ? ` of the ${w.fam[t.familyId!]?.name} family` : ''}, and nobody touches him without the boss’s say`;
    return { need: 'boss', from: boss, why, have: pBoss || has(t.id), commission };
  }
  if (t.familyId && deed === 'kill') return { need: 'boss', from: boss, why: `killing a man connected to ${same ? 'our own family' : `the ${w.fam[t.familyId]?.name} family`} is the boss’s decision`, have: pBoss || has(t.id) };
  if (t.familyId) {
    const cap = same ? captainOf(w, t) ?? boss : upper;
    return { need: 'captain', from: cap, why: same ? `${t.name} answers to ${cap?.id === p.id ? 'you' : cap?.name ?? 'another captain'}` : `${t.name} is with the ${w.fam[t.familyId]?.name} family`, have: mine(cap) || has(t.id) };
  }
  if (deed === 'kill') return { need: 'captain', from: upper, why: 'a dead civilian brings the police down on everybody', have: mine(upper) || has(t.id) };
  return { need: 'none', why: 'he’s nobody’s', have: true };
}
export const leaveWord = (l: Leave) => (l.have ? (l.need === 'none' ? 'yours to decide' : 'you have the word for it') : l.need === 'breach' ? 'nobody can allow it' : `needs ${l.from?.name ?? 'someone'}’s word`);

// ------------------------------------------------------------------------------------------------ asking for it
// The man whose word it is decides: how he sees the man asking and the man named, what it would cost him (another family, the police, a
// made man), and his temper. He gives it, refuses it, or keeps it for himself.
export function askLeave(w: World, p: Character, deed: Deed, target: Target): string[] {
  const l = leaveFor(w, p, deed, target), by = l.from;
  if (l.have) return ['You don’t need anyone’s word for it.'];
  if (l.need === 'breach' || !by?.alive) return [`There’s nobody who can allow that. ${cap(l.why)}.`];
  if ((p.cooldown[`asked:${deed}:${target.id}`] ?? 0) > w.now) return [`You’ve already asked ${first(by)}. Asking again would be telling him his answer was wrong.`];
  p.cooldown[`asked:${deed}:${target.id}`] = w.now + 21 * DAY;
  const t = isBiz(target) ? w.chars[target.ownerId ?? ''] : target;
  const wronged = !!t && Object.values(w.facts).some((f) => f.actor === t.id && (f.victim === p.id || f.victim === by.id) && !f.minor);
  const r = rel(by, p.id), tr = t ? rel(by, t.id) : undefined, tp = temper(by);
  const weight = { beat: 0.1, wreck: 0.2, kill: 0.55 }[deed] + (l.commission ? 0.25 : 0) + (t && MADE.has(t.rank) ? 0.15 : 0) + (t && t.familyId === p.familyId && deed === 'kill' ? 0.4 : 0);
  const lean = r.trust * 0.45 + r.respect * 0.25 + (wronged ? 0.3 : 0) + (tr ? tr.grudge * 0.5 - tr.trust * 0.4 - tr.affection * 0.3 : 0) - weight + tp.volatility * 0.15 - tp.caution * 0.15;
  r.lastMet = w.now;
  if (lean > 0.15) {
    p.cooldown[leaveKey(deed, target.id)] = w.now + 14 * DAY;
    if (deed !== 'wreck' && t && MADE.has(t.rank)) p.cooldown[`sanction:${t.id}`] = w.now + 14 * DAY;
    addFact(w, { kind: 'ruling', actor: by.id, victim: t?.id, minor: true, text: `${by.name} gave ${p.name} leave to have ${deedWord(deed, target)}.`, district: by.district }, { witnesses: [p.id, by.id] });
    return [`${first(by)} hears you out. ${deed === 'kill' ? '“If it has to be done, it’s done right, and it never comes back to this table.”' : '“Go ahead. Don’t make a circus of it.”'} You have two weeks.`];
  }
  if (lean > 0 && deed !== 'kill') {
    if (t && !isBiz(target)) bear(w, by, t.id, 0.05, `${p.name} brought him a complaint about him`);
    return [`${first(by)} shakes his head. “Leave it with me. I’ll take care of it my own way.” Whether he does is his business now.`];
  }
  feel(w, by, p.id, 'respect', -0.02);
  const no = tr && (tr.trust > 0.4 || tr.affection > 0.4) ? `${t!.name.split(' ')[0]} is a friend of mine` : l.commission ? 'I’m not starting a war over this' : t && t.familyId === p.familyId && deed === 'kill' ? 'we don’t do that to our own' : wronged ? 'it isn’t worth what it would cost' : 'I don’t see the reason';
  return [`${first(by)} looks at you a long time. “No. ${cap(no)}.”`];
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------------------------------------ sending a man
// What the man sent makes of it. Not a roll: what weighed most is the reason he gives.
export function willOf(w: World, p: Character, m: Character, deed: Deed, target: Target): { will: number; why: string } {
  const r = rel(m, p.id), tp = temper(m);
  const t = isBiz(target) ? w.chars[target.ownerId ?? ''] : target;
  const l = leaveFor(w, p, deed, target);
  const tr = t ? rel(m, t.id) : undefined;
  const parts: [number, string][] = [
    [r.trust * 0.45 + r.respect * 0.3 + (r.fear ?? 0) * 0.35 - r.grudge * 0.8 + (m.bossId === p.id ? 0.1 : 0), r.grudge > 0.25 ? `he hasn’t forgotten ${r.why?.text ?? 'what is between you'}` : 'he doesn’t owe you that much'],
    [deed === 'beat' ? m.traits.violence * 0.35 + m.skills.muscle * 0.15 - 0.1 : deed === 'wreck' ? m.traits.violence * 0.3 - 0.05 : m.traits.violence * 0.45 + m.skills.nerve * 0.3 - 0.45, deed === 'kill' ? 'he has never killed a man and doesn’t mean to start for you' : 'it isn’t his kind of work'],
    [tr ? -(tr.trust * 0.5 + tr.affection * 0.6) : 0, t ? `${t.name} is a friend of his` : ''],
    [l.have ? 0 : l.need === 'breach' ? -0.6 : -0.35, l.need === 'breach' ? 'it would be robbing our own family' : `nobody with the right has said it can be done: ${l.why}`],
    [-tp.caution * 0.25, 'he thinks it will come back on him'],
  ];
  const will = parts.reduce((a, [v]) => a + v, 0) + 0.15;
  const worst = parts.filter(([v, s]) => s && v < 0).sort((a, b) => a[0] - b[0])[0] ?? parts.filter(([, s]) => s).sort((a, b) => a[0] - b[0])[0];
  return { will, why: worst[1] };
}
// Whether a man is already out on an errand of p's
export const onOrder = (w: World, m: Character) => (w.pending ?? []).some((q) => q.kind === 'order' && q.a === m.id);
export function sendMan(w: World, p: Character, m: Character, deed: Deed, target: Target): string[] {
  if (onOrder(w, m)) return [`${first(m)} is already out on something for you.`];
  const { will, why } = willOf(w, p, m, deed, target);
  rel(m, p.id).lastMet = w.now;
  if (will < 0) {
    feel(w, p, m.id, 'trust', -0.05, `${m.name} wouldn’t do what he was told`);
    addFact(w, { kind: 'report', actor: m.id, victim: p.id, minor: true, text: `${m.name} refused when ${p.name} told him to have ${deedWord(deed, target)}.`, district: m.district }, { witnesses: [p.id, m.id] });
    return [`${first(m)} hears you out and doesn’t move. He won’t do it: ${why}.`];
  }
  noteBreach(w, p, deed, target);
  (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(1, 2) * DAY, kind: 'order', a: m.id, b: isBiz(target) ? target.ownerId ?? undefined : target.id, c: isBiz(target) ? target.id : undefined, by: p.id, note: deed, tries: 0 });
  return [`${first(m)} nods once. ${deed === 'kill' ? 'He doesn’t ask how you want it done, and you don’t tell him.' : 'He’ll see to it in the next day or two.'}`];
}
// The day comes: he goes, or he doesn't, and the man who sent him is told what happened (by him, so as he tells it).
export function orderDue(w: World, q: Pending, perform: (w: World, a: import('./types').Action) => { lines: string[] }) {
  const m = q.a ? w.chars[q.a] : undefined, p = q.by ? w.chars[q.by] : undefined, deed = q.note as Deed;
  const x = q.b ? w.chars[q.b] : undefined, b = q.c ? w.biz[q.c] : undefined;
  if (!m || !p?.alive) return;
  const tell = (text: string, minor = false) => addFact(w, { kind: 'report', actor: m.id, victim: x?.id, business: b?.id, minor, text, district: m.district }, { witnesses: [p.id, m.id] });
  if (!m.alive) return void tell(`${m.name} never got to it.`, true);
  if (m.jailedUntil > w.now || m.hurtUntil > w.now) {
    if ((q.tries ?? 0) < 3) (w.pending ??= []).push({ ...q, due: Math.max(m.jailedUntil, m.hurtUntil) + DAY, tries: (q.tries ?? 0) + 1 });
    else tell(`${m.name} couldn’t get to what ${p.name} asked of him.`, true);
    return;
  }
  if (deed === 'wreck' ? !b?.open : !x?.alive) return void tell(`${m.name} found there was nothing left to do: ${deed === 'wreck' ? `${b?.name ?? 'the place'} had closed` : `${x?.name ?? 'he'} was already dead`}.`, true);
  // he can still make a mess of it: a careful, skilled man less often
  const skill = deed === 'kill' ? m.skills.nerve : m.skills.muscle;
  const botch = w.rng.chance(clamp(0.22 - skill * 0.15 + (deed === 'kill' ? 0.1 : 0) + temper(m).volatility * 0.05, 0.04, 0.4));
  const cause = addFact(w, { kind: 'event', actor: p.id, victim: x?.id, business: b?.id, minor: true, hiddenActor: true, text: `${p.name} sent ${m.name} to have ${deed === 'wreck' ? `${b!.name} wrecked` : `${x!.name} ${deed === 'kill' ? 'killed' : 'beaten'}`}.`, textHidden: `Somebody sent ${m.name}.`, district: m.district }, { witnesses: [p.id, m.id] });
  if (botch) {
    m.heat = clamp(m.heat + 0.1, 0, 1.5);
    if (x?.alive) { bear(w, x, m.id, 0.2, `${m.name} came for him`); if (w.rng.chance(0.5)) bear(w, x, p.id, 0.15, `${m.name} came for him, and everyone knows whose man he is`); }
    feel(w, p, m.id, 'trust', -0.04, `${m.name} made a mess of it`);
    return void tell(deed === 'kill' ? `${m.name} went for ${x!.name} and lost his nerve, or his chance. ${x!.name} knows somebody came for him.` : `${m.name} made a mess of it: ${deed === 'wreck' ? `he was seen outside ${b!.name} and ran` : `${x!.name} saw him coming and got away`}.`);
  }
  if (deed === 'wreck') {
    b!.damaged = Math.max(b!.damaged, 2);
    bizMove(w, b!, -160, 'damage');
    m.heat = clamp(m.heat + 0.08, 0, 1.5);
    const f = addFact(w, { kind: 'vandalism', actor: m.id, cause: cause.id, victim: x?.id, business: b!.id, hiddenActor: true, text: `${m.name} wrecked ${b!.name}.`, textHidden: `Someone wrecked ${b!.name}.`, district: b!.district }, { witnesses: witnessesAt(w, b!.district, [m.id, ...(x ? [x.id] : [])], 2).filter(() => w.rng.chance(0.5)) });
    notifyProtector(w, b!, f);
    if (x) { bear(w, x, m.id, 0.1, `his place was wrecked`); tension(w, m, x, 0.5); }
    return void tell(`${m.name} did what you asked: ${b!.name} is in pieces, and nobody saw a face.`);
  }
  perform(w, { kind: 'retaliate', mode: deed === 'kill' ? 'hit' : 'beat', actor: m.id, target: x!.id, approved: true, label: 'order', score: 0 });
  if (deed === 'kill') tell(x!.alive ? `${m.name} went to do it and came back with his hands shaking. ${x!.name} is still alive.` : `${m.name} did what you asked. ${x!.name} is dead.`);
  else tell(`${m.name} did what you asked. ${x!.name} took a beating he won’t forget, and knows who gave it, if not who sent him.`);
  feel(w, m, p.id, 'trust', 0.02);
}
// Going around the man whose word it was: he holds it, with the reason, and it is on record; done to our own, it is everybody's business.
export function noteBreach(w: World, p: Character, deed: Deed, target: Target) {
  const l = leaveFor(w, p, deed, target);
  if (l.have) return;
  if (l.from?.alive && l.from.id !== p.id) {
    bear(w, l.from, p.id, deed === 'kill' ? 0.35 : 0.12, `${p.name} went around him over ${tName(target)}`);
    feel(w, l.from, p.id, 'trust', deed === 'kill' ? -0.12 : -0.05);
  }
  addFact(w, { kind: 'ruling', actor: p.id, minor: l.need !== 'breach' && deed !== 'kill', text: `${p.name} had ${deedWord(deed, target)} without ${l.from ? `${l.from.name}’s word` : 'anyone’s say'}: ${l.why}.`, district: p.district }, { witnesses: [p.id, ...(l.from ? [l.from.id] : [])] });
}
