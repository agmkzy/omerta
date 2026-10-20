// V89: matters. A matter is anything unresolved between people: a quarrel that will not cool, a man just out of a cell whom his
// boss is not sure of, a brother who wants the man who hurt his brother, a soldier who wants a crew of his own. Every one is a
// situation (situ.ts): the same record of who is in it, who knows what, what has been said, what happens next and how it ends.
//
// Matters start in different ways, and most of them do not start with anyone asking anyone for anything:
//   event         something happened (an arrest, a beating, a killing, money gone missing) and people have to answer it
//   relationship  bad blood between two men grows until it has to be settled one way or another
//   ambition      a man wants to rise, and what he does about it is seen and answered by the men around him
//   obligation    money is owed (debts, tribute) and the clock runs
//   negotiation   one man wants something from another (asks.ts); also used INSIDE other matters (a man asks leave to hit back)
//
// What people do in a matter comes from a shared set of moves, the same for the player and for everyone else: investigate,
// confront, retaliate, conceal, ally, reconcile, ask, wait, let go. Each kind of matter only says who is in it, when it moves,
// which of those moves each side weighs (by who he is, what he knows and how he stands with the others), and what the player can
// say or do about it from where he stands: in it, close to someone in it, or only hearing about it.
import { perform, tension } from './actions';
import { openAsk, ASKS, askee, asker } from './asks';
import { clamp, factHooks, learn, money, regard, rel, repute, witnessesAt } from './core';
import { addEnc, addFavour } from './encounters';
import { agencyOf, goalHooks } from './goals';
import { closeKin, kinTie, madeKin } from './kin';
import { LADDER } from './rank';
import { claim, closeSit, commonSuper, isOpen, know, registerStep, spawn, tell } from './situ';
import { Character, DAY, Enc, Fact, Id, Situation, SitKind, WEEK, World } from './types';

export type Origin = 'event' | 'relationship' | 'ambition' | 'obligation' | 'negotiation';
// Every kind of matter in the game and how it begins (the older V75 kinds included), so the views can treat them alike.
export const ORIGIN: Partial<Record<SitKind, Origin>> = {
  skim: 'event', intel: 'event', arrest: 'event', revenge: 'event',
  rivalry: 'relationship', dispute: 'relationship', crew: 'relationship', partner: 'relationship',
  grudge: 'ambition', climb: 'ambition',
  debt: 'obligation', tribute: 'obligation',
  ask: 'negotiation',
};
export interface Opt { code: string; label: string; hint: string; who?: Id; big?: boolean }
interface MatterKind {
  title: (w: World, s: Situation) => string;
  step: (w: World, s: Situation) => void;
  stage: (w: World, s: Situation, p: Character) => string; // where it stands, as the player can see it
  opts: (w: World, s: Situation, p: Character, t?: Character) => Opt[]; // t: the man he is talking to (none: from Stories)
  act: (w: World, s: Situation, p: Character, code: string, who?: Character) => string[];
}
export const MATTERS: Partial<Record<SitKind, MatterKind>> = {};

// ------------------------------------------------------------------ helpers
const first = (c: Character) => c.name.split(' ')[0];
const rk = (c: Character) => Math.max(0, LADDER.indexOf(c.rank));
const live = (w: World, id?: Id | number | string | null) => { const c = id ? w.chars[String(id)] : undefined; return c?.alive ? c : undefined; };
const free = (w: World, c?: Character) => !!c && c.alive && c.jailedUntil <= w.now;
const role = (s: Situation, r: string) => (s.parties ?? []).find((p) => p.role === r)?.id;
const roles = (s: Situation, r: string) => (s.parties ?? []).filter((p) => p.role === r).map((p) => p.id);
const inLife = (c?: Character) => !!c && c.rank !== 'civilian';
const sits = (w: World) => (w.situations ??= []);
const P = (w: World) => (w.playerId ? w.chars[w.playerId] : undefined);
const M = (s: Situation) => (s.m ??= {});
const num = (s: Situation, k: string) => Number(s.m?.[k] ?? 0);
const at = (w: World, s: Situation, ph: string, days: number) => { s.phase = ph; s.next = w.now + Math.max(1, Math.round(days)) * DAY; if (s.stage === 'brewing') s.stage = 'handling'; };
const bump = (w: World, k: string) => { const st = ((w.sitpace ??= { lastMajor: -1e9, lastVisible: -1e9, weekVis: 0, wk: 0 }).stats ??= {}); st[k] = (st[k] ?? 0) + 1; };
const addParty = (s: Situation, id: Id, r: string) => { if (!(s.parties ?? []).some((p) => p.id === id)) (s.parties ??= []).push({ id, role: r }); };
// who the player is in this matter, and whether he has heard of it at all
const knowsOf = (w: World, s: Situation, c: Character) => !!s.k?.[c.id] || (s.parties ?? []).some((x) => x.id === c.id) || Object.keys(c.known).some((id) => w.facts[id]?.story === 'sit:' + s.id);
const done = (w: World, p: Character, s: Situation, code: string) => (p.cooldown[`mt:${s.id}:${code}`] ?? -1) >= Math.floor(w.now / DAY);
const mark = (w: World, p: Character, s: Situation, code: string) => { p.cooldown[`mt:${s.id}:${code}`] = Math.floor(w.now / DAY); };
const opt = (w: World, p: Character, s: Situation, code: string, label: string, hint: string, who?: Id, big?: boolean): Opt[] => (done(w, p, s, code) ? [] : [{ code, label, hint, who, big }]);
// the newest fact of a kind between two men, tagged to the matter so it belongs to the story
function adopt(w: World, s: Situation, actor: Id, victim: Id, since: number) {
  for (const f of Object.values(w.facts)) if (f.t >= since && f.actor === actor && f.victim === victim && !f.story) { f.story = 'sit:' + s.id; (s.hist ??= []).push({ t: w.now, text: f.text }); }
  if ((s.hist?.length ?? 0) > 8) s.hist!.splice(0, s.hist!.length - 8);
}

const ownerOf = (w: World, c: Character) => Object.values(w.biz).find((b) => b.ownerId === c.id && b.open)?.name;
// ------------------------------------------------------------------ the shared moves
// Asking around. Whoever knows something and trusts the man asking may tell him; the man it is about may hear that he is asking.
export function investigate(w: World, s: Situation, by: Character, root?: Fact, about?: Character): boolean {
  const ids = [...new Set([...Object.keys(s.k ?? {}), ...(root ? Object.keys(w.chars).filter((id) => w.chars[id].known[root.id]?.knowsActor) : [])])].slice(0, 40);
  const src = ids.map((id) => w.chars[id]).filter((c) => c?.alive && c.id !== by.id && c.id !== about?.id && c.id !== root?.actor && (rel(c, by.id).trust >= 0.3 || !!closeKin(w, c, by)))
    .sort((a, b) => rel(b, by.id).trust - rel(a, by.id).trust)[0];
  if (about && w.rng.chance(0.25 + (1 - by.traits.caution) * 0.25)) { know(w, s, about.id, 1, 'heard he was asking'); M(s)['heard:' + about.id] = 1; }
  if (!src) { M(s)['cert:' + by.id] = clamp(num(s, 'cert:' + by.id) + 0.1); return false; }
  if (root && src.known[root.id]?.knowsActor) learn(w, by.id, root, 'told:' + src.id, true);
  for (const id of Object.keys(src.known)) { const f = w.facts[id]; if (f?.story === 'sit:' + s.id) learn(w, by.id, f, 'told:' + src.id, src.known[id].knowsActor); }
  know(w, s, by.id, 2, 'asked ' + src.id);
  M(s)['cert:' + by.id] = clamp(num(s, 'cert:' + by.id) + 0.45);
  return true;
}
// Having it out face to face. How the other man takes it is who he is: he owns it, he denies it, or he squares up.
export function confront(w: World, s: Situation, by: Character, t: Character, guilty: boolean): 'admit' | 'deny' | 'defy' {
  const fear = clamp(0.2 + (rk(by) - rk(t)) * 0.15 + by.skills.nerve * 0.2 - t.traits.courage * 0.3);
  const r: 'admit' | 'deny' | 'defy' = t.traits.violence > 0.6 && fear < 0.3 ? 'defy' : guilty && (fear > 0.35 || t.traits.caution < 0.4) ? 'admit' : 'deny';
  const wit = witnessesAt(w, t.district, [by.id, t.id], 2);
  tell(w, s, r === 'admit' ? `${t.name} owned up to ${by.name}, face to face.` : r === 'deny' ? `${by.name} had it out with ${t.name}, who swore it wasn't him.` : `${by.name} went to ${t.name} about it, and ${t.name} told him where to go.`, { actor: by.id, victim: t.id, witnesses: wit, minor: true });
  if (r === 'defy') { rel(by, t.id).grudge = clamp(rel(by, t.id).grudge + 0.12); rel(t, by.id).grudge = clamp(rel(t, by.id).grudge + 0.08); tension(w, by, t, 0.5); }
  if (r === 'admit') rel(by, t.id).respect = clamp(rel(by, t.id).respect + 0.03);
  return r;
}
// Hitting back, through the same rule every hit-back in the game goes through (actions 'retaliate'): heat, witnesses, cooldowns.
export function retaliate(w: World, s: Situation, by: Character, t: Character, mode: 'beat' | 'torch' | 'hit' = 'beat'): boolean {
  if (!free(w, by) || !t.alive || (by.cooldown.restraint ?? 0) > w.now || (by.cooldown[`ret:${mode}:${t.id}`] ?? 0) > w.now) return false;
  const t0 = w.now;
  perform(w, { kind: 'retaliate', actor: by.id, target: t.id, mode, approved: true, label: '', score: 0 });
  adopt(w, s, by.id, t.id, t0);
  return true;
}
// Keeping it quiet: money to the man who could talk. Money moves between them like any other money.
export function conceal(w: World, s: Situation, by: Character, from: Character, amt: number): boolean {
  amt = Math.min(Math.round(amt / 10) * 10, by.cash);
  if (amt < 30) return false;
  by.cash -= amt; from.cash += amt;
  rel(from, by.id).trust = clamp(rel(from, by.id).trust + 0.02);
  M(s)['hush:' + from.id] = amt;
  tell(w, s, `${by.name} saw to it that ${from.name} would keep his mouth shut.`, { actor: by.id, victim: from.id, minor: true });
  return true;
}
// Bringing someone in: family first, then friends who are in the life. They learn what it is about and are now in it.
export function ally(w: World, s: Situation, by: Character): Character | undefined {
  const inIt = new Set((s.parties ?? []).map((x) => x.id));
  const pool = [...madeKin(w, by).filter((k) => closeKin(w, by, k)), ...Object.keys(by.rels).map((id) => w.chars[id]).filter((c) => c && inLife(c) && rel(by, c.id).trust >= 0.55 && rel(c, by.id).trust >= 0.45)]
    .filter((c) => c && free(w, c) && !c.isPlayer && !inIt.has(c.id));
  const a = pool[0];
  if (!a) return undefined;
  addParty(s, a.id, 'with:' + by.id);
  know(w, s, a.id, 2, 'brought in by ' + by.id);
  M(s)['sup:' + by.id] = num(s, 'sup:' + by.id) + 0.3;
  tell(w, s, `${by.name} brought ${a.name} into it.`, { actor: by.id, victim: a.id, witnesses: [a.id], minor: true });
  return a;
}
// Making peace. A gift helps; pride, temper and how deep the wound goes stand against it.
export function reconcile(w: World, s: Situation, by: Character, t: Character, gift = 0): boolean {
  const r = rel(t, by.id);
  const v = 0.25 + (1 - t.traits.violence) * 0.25 + t.traits.caution * 0.15 + r.affection * 0.25 + Math.min(0.3, gift / 1000) + (rk(by) > rk(t) ? 0.1 : 0) - r.grudge * 0.6 - (t.traits.ambition > 0.7 ? 0.08 : 0);
  if (gift > 0 && by.cash >= gift) { by.cash -= gift; t.cash += gift; }
  const ok = v + w.rng.range(-0.12, 0.12) > 0.3;
  if (ok) { r.grudge = clamp(r.grudge * 0.4); rel(by, t.id).grudge = clamp(rel(by, t.id).grudge * 0.5); r.trust = clamp(r.trust + 0.03); }
  else r.respect = clamp(r.respect - 0.02);
  tell(w, s, ok ? `${by.name} and ${t.name} made their peace${gift ? `, and ${money(gift)} changed hands` : ''}.` : `${by.name} tried to make peace with ${t.name}${gift ? ` and offered ${money(gift)}` : ''}. ${first(t)} wasn't having it.`, { actor: by.id, victim: t.id, witnesses: witnessesAt(w, t.district, [by.id, t.id], 2), minor: true });
  return ok;
}

// ------------------------------------------------------------------ the player, asked inside a matter
// When a matter reaches a point where someone in it wants the player's answer, it comes to him as a request he must answer.
function putTo(w: World, s: Situation, from: Character, title: string, lines: string[], opts: Enc['opts'], what: string, days = 4) {
  if (w.enc.some((e) => e.status === 'open' && e.kind === 'matter' && e.data?.sit === s.id)) return;
  addEnc(w, { kind: 'matter', from: from.id, title, days, lines, opts, data: { sit: s.id, what } });
  bump(w, 'put.' + s.kind);
}
export function answerMatter(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  const s = sits(w).find((x) => x.id === e.data?.sit);
  const K = s?.kind ? MATTERS[s.kind] : undefined;
  if (!s || !K || !isOpen(s)) return { lines: ['It has moved on without you.'], minutes: 5 };
  return { lines: K.act(w, s, p, 'enc:' + String(e.data?.what) + ':' + code, e.from ? w.chars[e.from] : undefined), minutes: 25 };
}

// ================================================================== RIVALRY (relationship)
// Two men in the life who cannot stand each other. Nobody has to ask anybody anything: it grows on slights, whispers to the boss
// and things said in front of people, until one of them makes peace, someone above them rules on it, or it comes to blows.
const rivals = (w: World, s: Situation) => roles(s, 'rival').map((id) => w.chars[id]).filter(Boolean) as Character[];
function rivalryStep(w: World, s: Situation) {
  const [a, b] = rivals(w, s);
  if (!a?.alive || !b?.alive) return closeSit(w, s, 'gone', [], 8);
  const heat = num(s, 'heat');
  const cool = rel(a, b.id).grudge < 0.12 && rel(b, a.id).grudge < 0.12;
  if (cool && s.weeks >= 1) return closeSit(w, s, 'cooled', ['it blew over'], 8);
  if (w.now - s.since > 16 * WEEK) return closeSit(w, s, 'faded', [], 8);
  // the man above them hears what is being said in front of people, and a careful one will not have it in his crew
  const up = commonSuper(w, a, b);
  if (up && !up.isPlayer && free(w, up) && heat > 0.4) {
    const heard = Object.keys(up.known).filter((id) => w.facts[id]?.story === 'sit:' + s.id).length;
    if (heard >= 2 && w.rng.chance(0.2 + up.traits.caution * 0.4)) return ruleOn(w, s, up, a, b);
  }
  for (const [x, y] of w.rng.chance(0.5) ? [[a, b], [b, a]] : [[b, a], [a, b]]) {
    if (x.isPlayer || !free(w, x) || !isOpen(s)) continue; // the player acts for himself
    const t = x.traits, g = rel(x, y.id).grudge, aff = rel(x, y.id).affection;
    const up = commonSuper(w, x, y);
    const opts: { k: string; s: number }[] = [
      { k: 'slight', s: (0.1 + t.violence * 0.25 + (1 - t.caution) * 0.2 + g * 0.3) * Math.pow(0.6, num(s, 'sl:' + x.id)) }, // the same insult wears thin
      { k: 'undermine', s: up && !up.isPlayer ? 0.05 + t.ambition * 0.25 + t.greed * 0.1 + g * 0.2 - t.caution * 0.05 : -1 },
      { k: 'strike', s: heat > 0.45 && g > 0.45 && t.violence > 0.45 ? 0.1 + t.violence * 0.4 + heat * 0.35 - t.caution * 0.3 : -1 },
      { k: 'ally', s: heat > 0.35 && !num(s, 'sup:' + x.id) ? 0.15 + t.sociability * 0.2 : -1 },
      { k: 'peace', s: 0.05 + (1 - t.violence) * 0.25 + t.caution * 0.2 + aff * 0.3 - g * 0.45 + (s.weeks >= 4 ? 0.15 : 0) },
      { k: 'upstairs', s: up && !up.isPlayer && heat > 0.3 ? 0.05 + t.caution * 0.3 + (rk(up) >= 2 ? 0.1 : 0) - t.ambition * 0.1 : -1 },
      { k: 'nothing', s: 0.2 + t.caution * 0.1 + (s.weeks >= 6 ? 0.2 : 0) },
    ];
    const k = opts.map((o) => ({ ...o, s: o.s * w.rng.range(0.75, 1.25) })).sort((p, q) => q.s - p.s)[0].k;
    bump(w, 'rival.' + k);
    if (k === 'slight') {
      const yb = ownerOf(w, y);
      tell(w, s, w.rng.pick([
        `${x.name} made a crack about ${y.name} in front of people.`, `${x.name} turned his back on ${y.name} at the club.`, `${x.name} told anyone who'd listen that ${y.name} is all mouth.`,
        `${x.name} wouldn't sit at the same table as ${y.name}.`, `${x.name} laughed at ${y.name} in front of his own crew.`,
        y.cash < 300 ? `${x.name} has been saying ${y.name} can't pay for his own coffee.` : `${x.name} has been asking where ${y.name}'s money really comes from.`,
        yb ? `${x.name} told people not to bother with ${yb}.` : `${x.name} has been calling ${y.name} a ${y.rank === 'associate' ? 'gofer' : 'has-been'}.`,
      ]), { actor: x.id, victim: y.id, witnesses: witnessesAt(w, x.district, [x.id, y.id], 3), broadcast: [y.id], minor: true });
      rel(y, x.id).grudge = clamp(rel(y, x.id).grudge + 0.08); M(s).heat = clamp(heat + 0.12); M(s)['sl:' + x.id] = num(s, 'sl:' + x.id) + 1;
    } else if (k === 'undermine' && up) {
      const caught = w.rng.chance(0.2 + (1 - t.caution) * 0.25);
      claim(w, s, x.id, `${first(y)} can't be trusted with anything that matters`, false);
      rel(up, y.id).trust = clamp(rel(up, y.id).trust - 0.02);
      tell(w, s, `${x.name} has been putting ${y.name} down to ${up.name}.`, { actor: x.id, victim: y.id, witnesses: caught ? [up.id, y.id] : [up.id], minor: true });
      if (caught) { rel(y, x.id).grudge = clamp(rel(y, x.id).grudge + 0.15); M(s).heat = clamp(heat + 0.15); }
    } else if (k === 'strike') {
      // blows end the quarrel as a quarrel: what follows is payback, a dispute between families, or a sit-down
      if (retaliate(w, s, x, y, 'beat')) return closeSit(w, s, 'came to blows', [`${first(x)} put ${first(y)} in the hospital`, x.familyId !== y.familyId ? 'two families are in it now' : 'the crew is watching'], 10);
    } else if (k === 'ally') ally(w, s, x);
    else if (k === 'peace') { if (reconcile(w, s, x, y)) return closeSit(w, s, 'made peace', [`${first(x)} made peace`], 8); }
    else if (k === 'upstairs' && up) return ruleOn(w, s, up, x, y);
    else { M(s).heat = clamp(num(s, 'heat') - 0.08); rel(x, y.id).grudge = clamp(rel(x, y.id).grudge - 0.04); M(s).quiet = num(s, 'quiet') + 1; }
  }
  // men who keep letting it lie end up simply keeping out of each other's way
  if (isOpen(s) && num(s, 'quiet') >= 3 && s.weeks >= 3) return closeSit(w, s, 'kept apart', ['they keep out of each other\'s way'], 10);
  if (isOpen(s) && num(s, 'heat') < 0.08 && s.weeks >= 3) return closeSit(w, s, 'cooled', ['it went quiet'], 8);
  if (isOpen(s)) at(w, s, num(s, 'heat') > 0.5 ? 'hot' : 'simmering', w.rng.int(3, 6));
}
// The man above both of them decides, being himself: he favours the man he trusts, and the loser has to swallow it.
function ruleOn(w: World, s: Situation, up: Character, x: Character, y: Character, playerFor?: Id) {
  const score = (c: Character) => rel(up, c.id).trust + rel(up, c.id).respect * 0.6 + c.standing / 200 + num(s, 'sup:' + c.id) + (playerFor === c.id ? 0.15 : 0);
  const [win, lose] = score(x) >= score(y) ? [x, y] : [y, x];
  rel(lose, win.id).grudge = clamp(rel(lose, win.id).grudge * 0.6); rel(win, lose.id).grudge = clamp(rel(win, lose.id).grudge * 0.4);
  rel(lose, up.id).grudge = clamp(rel(lose, up.id).grudge + 0.06);
  tell(w, s, `${up.name} sat ${x.name} and ${y.name} down and told ${first(lose)} to let it go.`, { actor: up.id, victim: lose.id, witnesses: [x.id, y.id], minor: true });
  return closeSit(w, s, 'ruled on', [`${first(up)} ruled for ${first(win)}`, `${first(lose)} has to swallow it`], 10);
}
MATTERS.rivalry = {
  title: (w, s) => { const [a, b] = rivals(w, s); return a && b ? `${first(a)} and ${first(b)}: bad blood` : 'Bad blood'; },
  step: rivalryStep,
  stage: (w, s, p) => { const r = rivals(w, s), me = r.some((x) => x.id === p.id); return num(s, 'blows') ? 'It has come to blows' : me ? (num(s, 'heat') > 0.5 ? 'He is gunning for you' : 'There is bad blood between you') : num(s, 'heat') > 0.5 ? 'Getting worse' : 'Simmering'; },
  opts: (w, s, p, t) => {
    const r = rivals(w, s), other = r.find((x) => x.id !== p.id)!, me = r.some((x) => x.id === p.id);
    const out: Opt[] = [];
    if (me && other) {
      if (!t || t.id === other.id) {
        out.push(...opt(w, p, s, 'peace', `Clear the air with ${first(other)}`, 'Swallow some pride. He may not take it.', other.id));
        if (p.cash >= 200) out.push(...opt(w, p, s, 'peace200', `Make it right with ${first(other)}: $200`, 'Money says sorry louder than words do.', other.id));
        out.push(...opt(w, p, s, 'face', `Have it out with ${first(other)}`, 'Say it to his face. It may clear the air or start something.', other.id));
      }
      const up = commonSuper(w, p, other);
      if (up && (!t || t.id === up.id)) out.push(...opt(w, p, s, 'upstairs', `Take it to ${first(up)}`, `Let ${first(up)} rule on it. Whoever he favours, the other has to accept it.`, up.id));
      return out;
    }
    const x = t && r.some((y) => y.id === t.id) ? t : undefined, y = x ? r.find((z) => z.id !== x.id) : undefined;
    if (x && y) {
      out.push(...opt(w, p, s, 'ask', `Ask what's between him and ${first(y)}`, 'He may tell you his side. It will be his side.', x.id));
      if (rk(p) > rk(x) || rel(x, p.id).trust >= 0.5) out.push(...opt(w, p, s, 'calm', `Tell him to let it go with ${first(y)}`, rk(p) > rk(x) ? 'You outrank him. He may resent being told.' : 'He trusts you. It may be enough.', x.id));
      out.push(...opt(w, p, s, 'side', `Tell him you're with him against ${first(y)}`, `He will remember it. So will ${first(y)}, if he hears.`, x.id));
    }
    if (!t && rk(p) >= 2 && r.every((z) => z.bossId === p.id || commonSuper(w, z, p)?.id === p.id)) out.push(...opt(w, p, s, 'rule', 'Sit them down and settle it', 'Your ruling. The man you rule against will swallow it, and remember.'));
    return out;
  },
  act: (w, s, p, code, who) => {
    mark(w, p, s, code);
    const r = rivals(w, s), other = r.find((x) => x.id !== p.id);
    if (code === 'peace' || code === 'peace200') { if (!other) return []; const ok = reconcile(w, s, p, other, code === 'peace200' ? 200 : 0); if (ok) closeSit(w, s, 'made peace', ['you made peace'], 8); return [ok ? `${first(other)} looks at you a long moment, then takes your hand. "All right. It's done."` : `${first(other)} hears you out and says nothing you'd want repeated.`]; }
    if (code === 'face' && other) { const res = confront(w, s, p, other, rel(other, p.id).grudge > 0.3); M(s).heat = clamp(num(s, 'heat') + (res === 'defy' ? 0.2 : -0.1)); return [res === 'defy' ? `${first(other)} squares up. "You want to do something about it?" People are watching.` : res === 'admit' ? `${first(other)} shrugs. "Maybe I said some things." It's not an apology, but it's something.` : `"I don't know what you heard," ${first(other)} says. "I never said a word about you."`]; }
    if (code === 'upstairs' && other && who) { ruleOn(w, s, who, p, other); return [s.cons?.at(-2) ?? 'He hears you both and rules.', ...(s.cons?.slice(-1) ?? [])]; }
    if (code === 'rule' && r.length === 2) { ruleOn(w, s, p, r[0], r[1]); return ['You hear them both and give your ruling.', ...(s.cons?.slice(-1) ?? [])]; }
    if (!who) return [];
    const y = r.find((z) => z.id !== who.id)!;
    if (code === 'ask') {
      if (rel(who, p.id).trust < 0.3) return [`"It's between me and him," ${first(who)} says, and that is all you get.`];
      for (const id of Object.keys(who.known)) { const f = w.facts[id]; if (f?.story === 'sit:' + s.id) learn(w, p.id, f, 'told:' + who.id, who.known[id].knowsActor); }
      know(w, s, p.id, 2, 'told by ' + who.id);
      return [`${first(who)} tells you about ${first(y)} at some length. In his telling, ${first(y)} started all of it.`];
    }
    if (code === 'calm') {
      const g = rel(who, y.id); g.grudge = clamp(g.grudge * (rk(p) > rk(who) ? 0.6 : 0.75)); M(s).heat = clamp(num(s, 'heat') - 0.15);
      if (rk(p) > rk(who)) rel(who, p.id).grudge = clamp(rel(who, p.id).grudge + 0.03);
      tell(w, s, `${p.name} told ${who.name} to let it go with ${y.name}.`, { actor: p.id, victim: who.id, minor: true });
      return [`${first(who)} doesn't like it. "For you, I'll leave it. For now."`];
    }
    if (code === 'side') {
      addParty(s, p.id, 'with:' + who.id); M(s)['sup:' + who.id] = num(s, 'sup:' + who.id) + 0.3;
      regard(w, who, p, 'affection', 0.05, 'took-side'); rel(y, p.id).grudge = clamp(rel(y, p.id).grudge + (w.rng.chance(0.5) ? 0.1 : 0));
      tell(w, s, `${p.name} let ${who.name} know he is with him against ${y.name}.`, { actor: p.id, victim: y.id, witnesses: [who.id], minor: true });
      return [`${first(who)} grips your arm. "I won't forget it."`];
    }
    return [];
  },
};
// Bad blood that has grown past a certain point becomes a matter. Weekly, among men in the life; a few at a time.
function rivalryScan(w: World) {
  let n = 0;
  for (const c of Object.values(w.chars)) {
    if (n >= 3) break;
    if (!c.alive || c.isPlayer || !inLife(c) || c.jailedUntil > w.now) continue;
    for (const [id, r] of Object.entries(c.rels)) {
      if (r.grudge < 0.4) continue;
      const o = w.chars[id];
      if (!o?.alive || !inLife(o) || o.id === c.id || rel(o, c.id).grudge < 0.15 && !o.isPlayer) continue;
      if (o.isPlayer && !c.familyId) continue;
      if (startRivalry(w, c, o, `${c.name} and ${o.name} have no use for each other`)) n++;
      break;
    }
  }
}
export function startRivalry(w: World, a: Character, b: Character, why: string): Situation | undefined {
  const key = 'rival:' + [a.id, b.id].sort().join(':');
  const s = spawn(w, 'rivalry', key, a.id, { cause: why, parties: [{ id: a.id, role: 'rival' }, { id: b.id, role: 'rival' }], sev: 0.3, phase: 'simmering', next: w.now + w.rng.int(2, 5) * DAY, orgs: [...new Set([a.familyId, b.familyId].filter(Boolean) as Id[])], m: { heat: 0.2 } });
  if (s) { know(w, s, a.id, 2, 'his own'); know(w, s, b.id, 2, 'his own'); }
  return s;
}

// ================================================================== ARREST (event)
// A man in the life is picked up. While he is inside, the men above him wonder what he is saying; when he is out, they want to
// know. Whether he talked is a fact of the world, decided when he was picked up (and a man who did talk may go on talking: the
// family's informant can be born here). The boss finds out the way anyone finds anything out, or doesn't.
function arrestStep(w: World, s: Situation) {
  const c = live(w, role(s, 'held')), boss = live(w, role(s, 'boss'));
  if (!c || !boss) return closeSit(w, s, 'gone', [], 8);
  if (s.phase === 'held') {
    if (c.jailedUntil > w.now) return at(w, s, 'held', Math.max(1, (c.jailedUntil - w.now) / DAY));
    tell(w, s, `${c.name} is back on the street.`, { actor: c.id, broadcast: [boss.id], minor: true });
    // out too quickly is a question in itself
    M(s).quick = w.now - s.since < 6 * DAY ? 1 : 0;
    return at(w, s, 'out', 2);
  }
  const talked = s.truth === 'talked';
  const doubt = clamp(0.15 + num(s, 'quick') * 0.2 + boss.traits.caution * 0.2 + (talked ? 0.15 : 0) - rel(boss, c.id).trust * 0.3 - num(s, 'vouch') * 0.2 + num(s, 'doubted') * 0.25);
  if (s.phase === 'out') {
    if (c.isPlayer) {
      putTo(w, s, boss, `${first(boss)} wants a word about the arrest`, [`${first(boss)} doesn't ask how you are. "They had you for ${Math.max(1, Math.round((w.now - s.since) / DAY))} days. What did they want, and what did you give them?"`], [
        { code: 'nothing', label: 'Tell him you gave them nothing', hint: 'The truth. Whether he believes it is up to him.' },
        { code: 'detail', label: 'Tell him exactly what they asked about', hint: 'Names, questions, the detective. It shows you kept your head.' },
        { code: 'offended', label: 'Ask him if he really has to ask', hint: 'Proud. It works with some men.' },
      ], 'arrest');
      return at(w, s, 'questioned', 5);
    }
    if (doubt < 0.25) return clear(w, s, c, boss);
    return at(w, s, 'doubt', 3);
  }
  if (s.phase === 'doubt') {
    const found = talked && (investigate(w, s, boss, undefined, c) || w.rng.chance(0.2 + boss.traits.caution * 0.2)) && w.rng.chance(0.55);
    if (found) {
      rel(boss, c.id).trust = clamp(rel(boss, c.id).trust - 0.4); rel(boss, c.id).grudge = clamp(rel(boss, c.id).grudge + 0.4);
      if (c.informant) c.informant.exposed = true;
      tell(w, s, `${boss.name} found out ${c.name} talked to the police.`, { kind: 'informant', actor: c.id, victim: boss.id, broadcast: [boss.id], minor: false });
      const crew = Object.values(w.chars).find((x) => x.alive && x.bossId === boss.id && x.id !== c.id && !x.isPlayer && x.traits.violence > 0.5 && free(w, x));
      if (crew) retaliate(w, s, crew, c, 'beat');
      const pl = P(w); const v = num(s, 'vouch');
      if (pl && v && s.m?.voucher === pl.id) { regard(w, boss, pl, 'trust', -0.08, 'vouched-wrong'); repute(w, pl, -3, 'vouched-wrong'); s.cons = [...(s.cons ?? []), 'you vouched for a man who talked'].slice(-5); }
      return closeSit(w, s, 'talked', [`${first(c)} talked, and ${first(boss)} knows it`], 12);
    }
    if (doubt > 0.5 && boss.traits.caution > 0.55) {
      rel(boss, c.id).trust = clamp(rel(boss, c.id).trust - 0.1);
      tell(w, s, `${boss.name} is keeping ${c.name} at arm's length since the arrest.`, { actor: boss.id, victim: c.id, minor: true });
      return closeSit(w, s, 'doubted', [`${first(boss)} never quite trusted ${first(c)} again`], 10);
    }
    return clear(w, s, c, boss);
  }
  if (s.phase === 'questioned') { // the player did not answer: silence reads badly
    M(s).doubted = 1; return at(w, s, 'doubt', 2);
  }
}
function clear(w: World, s: Situation, c: Character, boss: Character) {
  if (c.isPlayer) { regard(w, boss, c, 'respect', 0.06, 'kept-quiet'); repute(w, c, 2, 'kept-quiet'); }
  else { rel(boss, c.id).trust = clamp(rel(boss, c.id).trust + 0.05); rel(boss, c.id).respect = clamp(rel(boss, c.id).respect + 0.05); c.standing = clamp(c.standing + 2, 0, 100); }
  tell(w, s, `${c.name} kept his mouth shut. ${boss.name} knows it.`, { actor: c.id, victim: boss.id, broadcast: [boss.id], minor: true });
  return closeSit(w, s, 'kept quiet', [`${first(c)} kept quiet`], 10);
}
MATTERS.arrest = {
  title: (w, s) => { const c = w.chars[role(s, 'held') ?? '']; return c ? `${first(c)}'s arrest` : 'An arrest'; },
  step: arrestStep,
  stage: (w, s, p) => { const c = w.chars[role(s, 'held') ?? '']; return s.phase === 'held' ? (c?.isPlayer ? 'You are inside' : 'He is still inside') : c?.isPlayer ? 'They want to know what you said' : 'People are wondering what he said'; },
  opts: (w, s, p, t) => {
    const c = live(w, role(s, 'held')), boss = live(w, role(s, 'boss'));
    if (!c || !boss || c.isPlayer || s.phase === 'held' && t?.id === c.id) return [];
    const out: Opt[] = [];
    if (t?.id === c.id || !t && free(w, c)) {
      out.push(...opt(w, p, s, 'what', 'Ask what the cops wanted', rel(c, p.id).trust >= 0.4 ? 'He trusts you. Watch how he answers.' : 'He may not want to talk about it.', c.id));
      out.push(...opt(w, p, s, 'back', 'Tell him you have his back', 'He will remember who stood by him.', c.id));
    }
    if (boss.id !== p.id && (t?.id === boss.id || !t) && !s.m?.voucher) {
      out.push(...opt(w, p, s, 'vouch', `Vouch for ${first(c)} with ${first(boss)}`, 'Your word against his doubts. If he did talk, you wear it.', boss.id));
      if (s.k?.[p.id]?.l === 1 || num(s, 'nervous:' + p.id)) out.push(...opt(w, p, s, 'doubt', `Tell ${first(boss)} you have doubts about ${first(c)}`, 'If you are wrong, it will get back to him.', boss.id));
    }
    return out;
  },
  act: (w, s, p, code, who) => {
    mark(w, p, s, code);
    const c = live(w, role(s, 'held')), boss = live(w, role(s, 'boss'));
    if (!c || !boss) return ['It doesn\'t matter now.'];
    const talked = s.truth === 'talked';
    if (code.startsWith('enc:arrest:')) {
      const a = code.slice(11);
      const believe = rel(boss, p.id).trust * 0.6 + (a === 'detail' ? 0.3 : a === 'offended' ? (boss.traits.caution < 0.5 ? 0.3 : -0.1) : 0.15) + p.skills.charm * 0.15;
      if (believe > 0.45) { clear(w, s, p, boss); return [a === 'detail' ? `You give him all of it. ${first(boss)} listens, then nods once. "Good. You kept your head."` : a === 'offended' ? `${first(boss)} holds your eye, then laughs. "No. I don't have to ask."` : `${first(boss)} looks at you for a long moment. "All right."`]; }
      M(s).doubted = 1; at(w, s, 'doubt', 4);
      return [`${first(boss)} nods, but he doesn't look like a man who has heard what he wanted to.`];
    }
    if (code === 'what') {
      if (rel(c, p.id).trust < 0.4) return [`"Nothing. They wanted nothing," ${first(c)} says, and changes the subject.`];
      know(w, s, p.id, talked ? 1 : 2, 'asked him');
      if (talked) { M(s)['nervous:' + p.id] = 1; return [`${first(c)} answers too quickly, and then talks about something else for a long time.`]; }
      return [`${first(c)} laughs. "Same as always. Who runs the book on Mulberry, who collects. I gave them the weather."`];
    }
    if (code === 'back') { regard(w, c, p, 'affection', 0.06, 'stood-by'); regard(w, c, p, 'trust', 0.03, 'stood-by'); return [`${first(c)} nods. "That means something. Not many came round."`]; }
    if (code === 'vouch') {
      M(s).vouch = 1; M(s).voucher = p.id;
      tell(w, s, `${p.name} vouched for ${c.name} to ${boss.name}.`, { actor: p.id, victim: c.id, witnesses: [boss.id], minor: true });
      regard(w, c, p, 'trust', 0.04, 'vouched');
      return [`${first(boss)} hears you out. "You're sure of him." It isn't a question. Your name is on it now.`];
    }
    if (code === 'doubt') {
      M(s).doubted = 1; if (s.phase === 'out' || s.phase === 'questioned') at(w, s, 'doubt', 1);
      if (w.rng.chance(0.4)) rel(c, p.id).grudge = clamp(rel(c, p.id).grudge + 0.2);
      tell(w, s, `${p.name} told ${boss.name} he isn't sure of ${c.name}.`, { actor: p.id, victim: c.id, witnesses: [boss.id], minor: true });
      return [`${first(boss)} says nothing for a while. "I'll look into it."`];
    }
    void who; return [];
  },
};
function onArrest(w: World, f: Fact) {
  const c = live(w, f.actor);
  if (!c || !inLife(c) || !c.bossId) return;
  const boss = live(w, c.bossId);
  if (!boss) return;
  // whether he talked is decided now, by who he is, and is the world's truth from here on
  const press = (1 - c.traits.courage) * 0.3 + (c.problem?.kind === 'debt' || c.problem?.kind === 'gambling' ? 0.1 : 0) - rel(c, boss.id).trust * 0.15 - (rk(c) >= 2 ? 0.05 : 0);
  const talked = !c.isPlayer && w.rng.chance(clamp(press, 0.02, 0.4));
  const s = spawn(w, 'arrest', 'arrest:' + c.id + ':' + Math.floor(w.now / WEEK), c.id, { cause: `${c.name} was picked up by the police`, parties: [{ id: c.id, role: 'held' }, { id: boss.id, role: 'boss' }], sev: 0.35, phase: 'held', next: w.now + 2 * DAY, truth: talked ? 'talked' : 'quiet', orgs: c.familyId ? [c.familyId] : [] });
  if (!s) return;
  f.story ??= 'sit:' + s.id;
  for (const id of Object.keys(w.chars)) if (w.chars[id].known[f.id]) know(w, s, id, 2, 'heard');
  if (talked && c.rank !== 'associate' && c.familyId && !Object.values(w.chars).some((x) => x.informant && !x.informant.exposed)) c.informant = { since: w.now, evidence: 0.15, agent: 'a detective from the Sixth Precinct' };
  bump(w, 'arrest.' + (talked ? 'talked' : 'quiet'));
}

// ================================================================== REVENGE (event + family)
// A man is beaten or killed, and someone of his blood who is in the life wants the man who did it. He may not know who that was;
// he finds out, or guesses, and may guess wrong. If the man he wants is made, or another family's, he must ask leave of his own
// boss first (an ask inside the matter). He may be talked down, paid off, warned, or he may do it anyway.
function revengeStep(w: World, s: Situation) {
  const av = live(w, role(s, 'avenger')), wronged = w.chars[role(s, 'wronged') ?? ''];
  const target = live(w, s.m?.target as string | undefined);
  if (s.phase === 'struck') return closeSit(w, s, 'avenged', [`${av ? first(av) : 'He'} paid ${target ? first(target) : 'him'} back`], 12);
  if (!av || !free(w, av) && s.phase !== 'seething') { if (!av) return closeSit(w, s, 'gone', [], 8); return at(w, s, s.phase ?? 'seething', 5); }
  if (w.now - s.since > 10 * WEEK) return closeSit(w, s, 'let go', [`${first(av)} let it go in the end`], 8);
  const root = w.facts[String(s.m?.fact ?? '')];
  if (s.phase === 'seething' || s.phase === 'looking') {
    if (!target) {
      if (root && av.known[root.id]?.knowsActor && live(w, root.actor)) M(s).target = root.actor!;
      else if (investigate(w, s, av, root) && root && av.known[root.id]?.knowsActor) M(s).target = root.actor!;
      else {
        M(s).tries = num(s, 'tries') + 1;
        // a man who cannot find out settles on whoever he already hated
        if (num(s, 'tries') >= 3) {
          const guess = Object.entries(av.rels).filter(([id, r]) => r.grudge > 0.3 && live(w, id) && id !== wronged?.id).sort((a, b) => b[1].grudge - a[1].grudge)[0]?.[0];
          if (!guess) return closeSit(w, s, 'never knew', [`${first(av)} never found out who did it`], 8);
          M(s).target = guess; M(s).guessed = 1;
          claim(w, s, av.id, `${w.chars[guess].name} did it`, guess === root?.actor);
        } else return at(w, s, 'looking', 4);
      }
      const t = live(w, s.m?.target as string)!;
      addParty(s, t.id, 'target');
      tell(w, s, `${av.name} has let it be known he wants ${t.name} for what happened to ${wronged ? first(wronged) : 'his family'}.`, { actor: av.id, victim: t.id, witnesses: witnessesAt(w, av.district, [av.id], 3), minor: true });
      // the player's own family comes to him first
      const pl = P(w);
      if (wronged?.isPlayer && pl) putTo(w, s, av, `${first(av)} wants to settle it`, [`${first(av)} comes round with his jaw set. "I know who did it to you. ${t.name}. I'm going to take care of it."`], [
        { code: 'let', label: 'Let him', hint: 'It will be done. It will be talked about, and it has your name on it.' },
        { code: 'mine', label: 'Tell him it\'s yours to settle', hint: 'He stands down. You had better do something.' },
        { code: 'leave', label: 'Tell him to leave it', hint: 'He won\'t like it. Revenge has a price.' },
      ], 'revenge');
      return at(w, s, 'resolved to', 3);
    }
  }
  if (!target) return at(w, s, 'looking', 4);
  if (s.phase === 'resolved to') {
    if (s.m?.held) return closeSit(w, s, 'stood down', [`${first(av)} stood down`], 8);
    // a made man, or another family's man, is not touched without leave
    const boss = av.bossId ? live(w, av.bossId) : undefined;
    const needs = (inLife(target) && (target.familyId !== av.familyId || rk(target) >= 2)) && boss && !boss.isPlayer;
    if (needs && !s.m?.['child:permit']) {
      const asked = openAsk(w, 'permit', av, boss!, { about: target.id, parent: s.id, why: `${av.name} wants leave to go after ${target.name}` });
      if (asked) { M(s).permit = asked.id; return at(w, s, 'asking leave', 6); }
      // he can't get in to see him: a careful man waits and lets it go, a hot one stops waiting
      M(s).noleave = num(s, 'noleave') + 1;
      if (num(s, 'noleave') < 2) return at(w, s, 'resolved to', 4);
      if (av.traits.caution > 0.5) return closeSit(w, s, 'let go', [`${first(av)} never got his answer, and let it go`], 8);
    }
    return strike(w, s, av, target);
  }
  if (s.phase === 'asking leave') {
    const ans = s.m?.['child:permit'];
    const ask = (w.situations ?? []).find((x) => x.id === s.m?.permit);
    if (!ans && ask && isOpen(ask)) return at(w, s, 'asking leave', 4);
    if (!ans) { M(s)['child:permit'] = 'no answer'; }
    if (s.m?.['child:permit'] === 'agreed' || s.m?.['child:permit'] === 'gave in') return strike(w, s, av, target);
    // refused: the hot ones go anyway
    if (av.traits.violence > 0.75 && av.traits.caution < 0.4) { const boss = live(w, av.bossId); if (boss) rel(boss, av.id).trust = clamp(rel(boss, av.id).trust - 0.15); M(s).defied = 1; return strike(w, s, av, target); }
    return closeSit(w, s, 'held back', [`${first(av)}'s boss would not allow it`], 8);
  }
}
function strike(w: World, s: Situation, av: Character, t: Character) {
  const root = w.facts[String(s.m?.fact ?? '')];
  const mode = root?.kind === 'murder' && av.traits.violence > 0.7 && !t.isPlayer ? 'hit' : 'beat';
  if (!retaliate(w, s, av, t, mode)) return at(w, s, 'resolved to', 5);
  bump(w, 'revenge.' + mode + (s.m?.guessed && t.id !== root?.actor ? '.wrong' : ''));
  return at(w, s, 'struck', 2);
}
MATTERS.revenge = {
  title: (w, s) => { const av = w.chars[role(s, 'avenger') ?? '']; const wr = w.chars[role(s, 'wronged') ?? '']; return av ? `${first(av)} wants payback${wr && !wr.isPlayer ? ` for ${first(wr)}` : ''}` : 'Payback'; },
  step: revengeStep,
  stage: (w, s, p) => { const t = s.m?.target === p.id; return s.phase === 'looking' || s.phase === 'seething' ? 'He is looking for who did it' : s.phase === 'asking leave' ? 'He has asked his boss for leave' : t ? 'He is coming for you' : 'He knows who he wants'; },
  opts: (w, s, p, t) => {
    const av = live(w, role(s, 'avenger')), target = live(w, s.m?.target as string | undefined), root = w.facts[String(s.m?.fact ?? '')];
    if (!av) return [];
    const out: Opt[] = [];
    if (target?.isPlayer) {
      if (!t || t.id === av.id) {
        const fee = root?.kind === 'murder' ? 2000 : 400;
        if (p.cash >= fee) out.push(...opt(w, p, s, 'amends', `Make amends with ${first(av)}: ${money(fee)}`, 'Pay for what was done. Some men will take it.', av.id, true));
        out.push(...opt(w, p, s, 'deny', `Tell ${first(av)} it wasn't you`, root?.actor === p.id ? 'A lie. If he ever learns otherwise, it is worse.' : 'The truth. He may not believe it.', av.id));
      }
      const boss = av.bossId ? live(w, av.bossId) : undefined;
      if (boss && !boss.isPlayer && (!t || t.id === boss.id)) out.push(...opt(w, p, s, 'leash', `Ask ${first(boss)} to keep ${first(av)} on a leash`, 'It goes over his head. He will know you did it.', boss.id));
      return out;
    }
    if (!t || t.id === av.id) {
      if (root?.actor && p.known[root.id]?.knowsActor && s.m?.target !== root.actor && live(w, root.actor)) out.push(...opt(w, p, s, 'truth', `Tell ${first(av)} who really did it`, `You know it was ${w.chars[root.actor].name}. Now so will he.`, av.id, true));
      if (rel(av, p.id).trust >= 0.35 || rk(p) > rk(av)) out.push(...opt(w, p, s, 'talkdown', `Talk ${first(av)} out of it`, rk(p) > rk(av) ? 'You outrank him. It is close to an order.' : 'He trusts you. It may be enough.', av.id));
    }
    if (target && target.id !== p.id && (!t || t.id === target.id) && rel(p, target.id).trust >= 0.25) out.push(...opt(w, p, s, 'warn', `Warn ${first(target)} that ${first(av)} is after him`, 'He will be ready. Whether he thanks you is his affair.', target.id));
    return out;
  },
  act: (w, s, p, code, who) => {
    mark(w, p, s, code);
    const av = live(w, role(s, 'avenger')), target = live(w, s.m?.target as string | undefined), root = w.facts[String(s.m?.fact ?? '')];
    if (!av) return [];
    if (code.startsWith('enc:revenge:')) {
      const a = code.slice(12);
      if (a === 'let') { regard(w, av, p, 'affection', 0.03, 'let-avenge'); return [`${first(av)} nods. "Leave it with me."`]; }
      M(s).held = 1;
      if (a === 'mine') { regard(w, av, p, 'respect', 0.04, 'own-score'); closeSit(w, s, 'stood down', ['he left it to you'], 8); return [`"All right," ${first(av)} says. "But if you don't, I will."`]; }
      rel(av, p.id).grudge = clamp(rel(av, p.id).grudge + 0.05); closeSit(w, s, 'stood down', ['you made him leave it'], 8);
      return [`${first(av)} stares at you. "You'd let that go?" He goes, but he goes angry.`];
    }
    if (code === 'amends' && av) {
      const fee = root?.kind === 'murder' ? 2000 : 400;
      const ok = reconcile(w, s, p, av, fee);
      if (ok) { closeSit(w, s, 'made amends', ['you paid for what was done'], 12); return [`${first(av)} counts it in front of you, slowly. "This doesn't make us friends. But it's finished."`]; }
      return [`${first(av)} takes the money and looks at you. "This is a start." It is not the end of it.`];
    }
    if (code === 'deny') {
      const guilty = root?.actor === p.id;
      const believe = p.skills.charm * 0.4 + rel(av, p.id).trust * 0.4 + (guilty ? -0.15 : 0.2) - num(s, 'cert:' + av.id) * 0.4 + (s.m?.guessed ? 0.15 : -0.1);
      if (believe > 0.3) { if (guilty) (av.denied ??= {})[root!.id] = w.now; M(s).target = ''; s.phase = 'looking'; M(s).tries = 0; s.next = w.now + 3 * DAY; return [`${first(av)} studies you for a long time. "Then who?"`]; }
      return [`"Save it," ${first(av)} says.`];
    }
    if (code === 'leash' && who) {
      const ok = rel(who, p.id).trust * 0.6 + rel(who, p.id).respect * 0.3 + (who.familyId === p.familyId ? 0.15 : 0) + who.traits.caution * 0.2 > 0.55;
      if (ok) { M(s).held = 1; closeSit(w, s, 'held back', [`${first(who)} called ${first(av)} off`], 8); rel(av, p.id).grudge = clamp(rel(av, p.id).grudge + 0.08); return [`${first(who)} hears you. "I'll speak to him. Stay out of his way a while."`]; }
      return [`${first(who)} shrugs. "What his family does about his family isn't mine to stop."`];
    }
    if (code === 'truth' && root?.actor) {
      learn(w, av.id, root, 'told:' + p.id, true); M(s).target = root.actor; delete s.m!.guessed; addParty(s, root.actor, 'target');
      regard(w, av, p, 'trust', 0.05, 'told-truth');
      tell(w, s, `${p.name} told ${av.name} who really did it.`, { actor: p.id, victim: root.actor, witnesses: [av.id], minor: true });
      return [`${first(av)} goes very still. "${w.chars[root.actor].name}." He thanks you, which is worse.`];
    }
    if (code === 'talkdown') {
      const v = (rk(p) > rk(av) ? 0.35 : 0) + rel(av, p.id).trust * 0.4 + av.traits.caution * 0.25 - av.traits.violence * 0.3 - (root?.kind === 'murder' ? 0.25 : 0);
      if (v > 0.2) { M(s).held = 1; closeSit(w, s, 'talked down', ['you talked him down'], 8); return [`${first(av)} breathes out. "For now. Only because it's you."`]; }
      return [`"You'd feel the same," ${first(av)} says. He's not listening.`];
    }
    if (code === 'warn' && target) {
      know(w, s, target.id, 2, 'warned by ' + p.id); regard(w, target, p, 'trust', 0.05, 'warned');
      tell(w, s, `${p.name} warned ${target.name} that ${av.name} is coming for him.`, { actor: p.id, victim: target.id, witnesses: [target.id], minor: true });
      // a warned man does something about it: makes peace, finds friends, or gets ready
      if (target.traits.caution > 0.5 && reconcile(w, s, target, av, Math.min(300, Math.floor(target.cash * 0.2)))) { closeSit(w, s, 'made amends', [`${first(target)} made it right`], 10); return [`${first(target)} goes pale, then goes to see ${first(av)} with an envelope. It's settled.`]; }
      ally(w, s, target);
      return [`${first(target)} nods slowly. "I owe you one." He'll be watching his back.`];
    }
    return [];
  },
};
function onHurt(w: World, f: Fact) {
  const v = w.chars[f.victim ?? ''];
  if (!v || f.minor) return;
  const kin = madeKin(w, v).filter((k) => closeKin(w, v, k) && k.id !== f.actor && free(w, k) && !k.isPlayer);
  const av = kin.sort((a, b) => b.traits.violence - a.traits.violence)[0];
  if (!av) return;
  const wantIt = 0.15 + av.traits.violence * 0.45 + (f.kind === 'murder' ? 0.4 : 0) - av.traits.caution * 0.25 + (kinTie(w, av, v) === 'brother' ? 0.15 : 0);
  if (!w.rng.chance(clamp(wantIt, 0, 0.9))) return;
  const s = spawn(w, 'revenge', 'revenge:' + f.id, av.id, { cause: `${f.text.replace(/\.$/, '')}, and ${av.name} is ${v.isPlayer ? 'family' : 'his ' + (kinTie(w, av, v) ?? 'kin')}`, parties: [{ id: av.id, role: 'avenger' }, { id: v.id, role: 'wronged' }], sev: f.kind === 'murder' ? 0.5 : 0.35, phase: 'seething', next: w.now + w.rng.int(1, 3) * DAY, orgs: av.familyId ? [av.familyId] : [], m: { fact: f.id } });
  if (!s) return;
  learn(w, av.id, f, 'family', !f.hiddenActor);
  know(w, s, av.id, 2, 'family'); know(w, s, v.id, 1, 'family');
  bump(w, 'revenge.start');
}
// leave to go after a man (asked of the avenger's boss inside a revenge)
ASKS.permit = {
  id: 'permit', sev: 0.3, roles: ['asks leave', 'boss'], cool: 2,
  title: (w, s) => { const x = w.chars[String(s.m?.about ?? '')]; return x ? `Leave to go after ${first(x)}` : 'Leave'; },
  valid: (w, s) => !!live(w, s.m?.about as string),
  lean: (w, s, a, boss) => {
    const x = w.chars[String(s.m?.about ?? '')];
    if (!x) return -1;
    const other = x.familyId && x.familyId !== boss.familyId;
    const ten = other && boss.familyId ? w.fam[boss.familyId]?.tension[x.familyId!] ?? 0 : 0;
    return -0.15 + rel(boss, x.id).grudge * 0.6 + boss.traits.violence * 0.3 - boss.traits.caution * 0.35 + rel(boss, a.id).trust * 0.2 - (other ? 0.15 - ten * 0.05 : 0) - (rk(x) >= 2 ? 0.15 : 0);
  },
  yes: (w, s, a, boss) => `${first(boss)} gives ${first(a)} a small nod. "Not in the street. And not his family."`,
  phrase: { ask: () => '"I want your leave."', yes: 'He gives it.', no: '"No. Not now. Not him."', counter: '', stall: '"Let me think about it. Don\'t do anything."' },
};

// ================================================================== CLIMB (ambition)
// A man who wants to rise. The plan itself lives in goals.ts (what he does: asks for backing, gives gifts, undermines rivals,
// builds a crew); here it becomes something people see. Rivals notice and push back (a rivalry starts), and he comes to the men
// around him, the player among them, for a word in the right ear.
function climbStep(w: World, s: Situation) {
  const c = live(w, role(s, 'climber'));
  const g = agencyOf(w).goals.find((x) => x.id === s.m?.goal);
  if (!c) return closeSit(w, s, 'gone', [], 8);
  if (!g) { const e = agencyOf(w).ended.find((x) => x.id === s.m?.goal); return closeSit(w, s, e?.how === 'done' ? 'rose' : e?.how === 'failed' ? 'blocked' : 'gave up', [e?.how === 'done' ? `${first(c)} got his step` : `${first(c)} ${e?.how === 'failed' ? 'was blocked' : 'gave up for now'}`], 10); }
  const pl = P(w), boss = live(w, c.bossId);
  // a man close to the player, in the same crew, asks him for a word
  if (pl && boss && !boss.isPlayer && pl.familyId === c.familyId && pl.id !== c.id && rel(c, pl.id).trust >= 0.35 && !s.m?.asked && rk(pl) >= 1 && (pl.bossId === c.bossId || pl.bossId === boss.id)) {
    M(s).asked = 1;
    putTo(w, s, c, `${first(c)} wants a word in ${first(boss)}'s ear`, [`${first(c)} takes you aside. "I'm ready for more. You know it, I know it. If ${first(boss)} asks you about me, say the right thing. I won't forget."`], [
      { code: 'yes', label: 'Say you will', hint: 'It costs you nothing now. Your word is on him.' },
      { code: 'think', label: 'Say you\'ll see', hint: 'Noncommittal. He will read it.' },
      { code: 'no', label: 'Tell him to wait his turn', hint: 'He will remember that too.' },
    ], 'climb', 5);
  }
  at(w, s, 'climbing', 7);
}
function onGoal(w: World, g: import('./types').Goal, c: Character, what: string, o?: { rival?: Id; seen?: boolean; amt?: number; how?: string }) {
  if (g.kind !== 'advance') return;
  const key = 'climb:' + g.id;
  let s = sits(w).find((x) => x.key === key && isOpen(x));
  if (what === 'end') { if (s) s.next = w.now; return; }
  const boss = live(w, c.bossId);
  if (!s) {
    // it becomes a matter when it shows: his boss has said yes or no to him, or he was seen doing a rival down
    if (!boss || !(what === 'backed' || what === 'refused' && g.tries >= 2 || what === 'undermine' && o?.seen)) return;
    s = spawn(w, 'climb', key, c.id, { cause: `${c.name} wants to rise`, parties: [{ id: c.id, role: 'climber' }, { id: boss.id, role: 'above' }], sev: 0.25, phase: 'climbing', next: w.now + 3 * DAY, orgs: c.familyId ? [c.familyId] : [], m: { goal: g.id } });
    if (!s) return;
    know(w, s, c.id, 2, 'his own');
  }
  if (what === 'refused' && boss) tell(w, s, `${c.name} asked ${boss.name} to put his name forward, and was told not yet.`, { actor: c.id, victim: boss.id, witnesses: [boss.id], minor: true });
  else if (what === 'backed' && boss) tell(w, s, `${boss.name} has said he'll put ${c.name}'s name forward.`, { actor: boss.id, victim: c.id, witnesses: [c.id], broadcast: Object.values(w.chars).filter((x) => x.bossId === boss.id && x.alive).map((x) => x.id).slice(0, 8), minor: true });
  else if (what === 'gift' && boss) tell(w, s, `${c.name} brought ${boss.name} something, out of respect. ${money(o?.amt ?? 0)}.`, { actor: c.id, victim: boss.id, witnesses: [boss.id], minor: true });
  else if (what === 'undermine' && o?.rival) {
    const rv = live(w, o.rival);
    if (!rv) return;
    addParty(s, rv.id, 'rival');
    tell(w, s, `${c.name} has been talking ${rv.name} down to get ahead of him.`, { actor: c.id, victim: rv.id, witnesses: o.seen ? [rv.id] : [], minor: true });
    // seen doing it: the man he did it to has a reason now. Ambition becomes bad blood.
    if (o.seen) { const r = startRivalry(w, rv, c, `${rv.name} caught ${c.name} talking him down to get ahead`); if (r) bump(w, 'climb.rivalry'); }
  }
}
MATTERS.climb = {
  title: (w, s) => { const c = w.chars[role(s, 'climber') ?? '']; return c ? `${first(c)} wants to rise` : 'Ambition'; },
  step: climbStep,
  stage: (w, s) => (s.hist ?? []).some((h) => /put .* name forward/.test(h.text) && !/not yet/.test(h.text)) ? 'His boss is behind him' : 'Making his case',
  opts: (w, s, p, t) => {
    const c = live(w, role(s, 'climber')), boss = live(w, role(s, 'above'));
    if (!c || !boss || c.isPlayer) return [];
    const out: Opt[] = [];
    if (!t || t.id === c.id) {
      out.push(...opt(w, p, s, 'plans', 'Ask where he sees himself', 'Ambitious men like to be asked.', c.id));
      if (rk(p) > rk(c)) out.push(...opt(w, p, s, 'wait', 'Tell him to wait his turn', 'You outrank him. He will not thank you.', c.id));
    }
    if (!boss.isPlayer && (!t || t.id === boss.id) && !s.m?.['said:' + p.id]) {
      out.push(...opt(w, p, s, 'praise', `Put in a word for ${first(c)} with ${first(boss)}`, 'Your standing behind his name.', boss.id));
      out.push(...opt(w, p, s, 'knock', `Tell ${first(boss)} ${first(c)} is getting ahead of himself`, 'It may stick. It may get back to him.', boss.id));
    }
    return out;
  },
  act: (w, s, p, code) => {
    mark(w, p, s, code);
    const c = live(w, role(s, 'climber')), boss = live(w, role(s, 'above'));
    if (!c || !boss) return [];
    const weight = clamp(p.standing / 100 + rel(boss, p.id).trust * 0.3, 0, 0.6);
    const praise = () => { rel(boss, c.id).trust = clamp(rel(boss, c.id).trust + 0.03 + weight * 0.06); M(s)['said:' + p.id] = 1; addFavour(w, p.id, c.id, 1, 'put in a word for him'); tell(w, s, `${p.name} spoke up for ${c.name} to ${boss.name}.`, { actor: p.id, victim: c.id, witnesses: [boss.id, c.id], minor: true }); };
    if (code.startsWith('enc:climb:')) {
      const a = code.slice(10);
      if (a === 'yes') { praise(); regard(w, c, p, 'affection', 0.05, 'backed-climb'); return [`${first(c)} claps your shoulder. "I knew I could count on you."`]; }
      if (a === 'no') { rel(c, p.id).grudge = clamp(rel(c, p.id).grudge + 0.12); return [`${first(c)}'s smile stays where it is. His eyes don't.`]; }
      regard(w, c, p, 'trust', -0.03, 'hedged'); return [`"Sure," ${first(c)} says. "You'll see."`];
    }
    if (code === 'plans') {
      if (rel(c, p.id).trust < 0.35) return [`"Where I am is fine," ${first(c)} says, which is what men say when it isn't.`];
      know(w, s, p.id, 2, 'he told you');
      const g = agencyOf(w).goals.find((x) => x.id === s.m?.goal);
      return [`${first(c)} leans in. "${g?.next && g.next !== 'wait for the nod' ? `I need to ${g.next.replace(/^he /, '')}.` : 'I\'m waiting on the nod.'} After that, a crew of my own."`];
    }
    if (code === 'wait') { rel(c, p.id).grudge = clamp(rel(c, p.id).grudge + 0.1); const g = agencyOf(w).goals.find((x) => x.id === s.m?.goal); if (g && c.traits.caution > 0.6) g.review = w.now + 4 * WEEK; return [`${first(c)} hears you out. "Sure. My turn." He doesn't say when that is.`]; }
    if (code === 'praise') { praise(); return [`${first(boss)} listens. "${first(c)}. Hm. Maybe."`]; }
    if (code === 'knock') {
      rel(boss, c.id).trust = clamp(rel(boss, c.id).trust - 0.02 - weight * 0.05); M(s)['said:' + p.id] = 1;
      const heard = w.rng.chance(0.3);
      tell(w, s, `${p.name} told ${boss.name} that ${c.name} is getting ahead of himself.`, { actor: p.id, victim: c.id, witnesses: heard ? [boss.id, c.id] : [boss.id], minor: true });
      if (heard) { rel(c, p.id).grudge = clamp(rel(c, p.id).grudge + 0.25); startRivalry(w, c, p, `${c.name} heard what ${p.name} said about him to ${boss.name}`); }
      return [`${first(boss)} nods slowly. "I've wondered."`];
    }
    return [];
  },
};

// ------------------------------------------------------------------ what the player can see and do, across every kind
export const matterKind = (s: Situation) => (s.kind ? MATTERS[s.kind] : undefined);
// Matters to raise with this man: ones he is in or knows about, that the player knows about too. Shown by dialogue.
export function topicsWith(w: World, p: Character, t: Character): { s: Situation; o: Opt }[] {
  const out: { s: Situation; o: Opt }[] = [];
  for (const s of sits(w)) {
    const K = matterKind(s);
    if (!K || !isOpen(s) || !knowsOf(w, s, t) || !knowsOf(w, s, p)) continue;
    for (const o of K.opts(w, s, p, t)) if (!o.who || o.who === t.id) out.push({ s, o });
  }
  return out.slice(0, 4);
}
export function matterAct(w: World, p: Character, sid: Id, code: string, who?: Id): { lines: string[]; minutes: number } {
  const s = sits(w).find((x) => x.id === sid), K = s ? matterKind(s) : undefined;
  if (!s || !K || !isOpen(s)) return { lines: ['It has been settled.'], minutes: 5 };
  if (!K.opts(w, s, p, who ? w.chars[who] : undefined).some((o) => o.code === code)) return { lines: ['That is not open to you now.'], minutes: 5 };
  return { lines: K.act(w, s, p, code, who ? w.chars[who] : undefined), minutes: 30 };
}
export const matterTitle = (w: World, s: Situation) => matterKind(s)?.title(w, s);
export const matterStage = (w: World, s: Situation, p: Character) => matterKind(s)?.stage(w, s, p);
export const matterOpts = (w: World, s: Situation, p: Character) => (isOpen(s) ? matterKind(s)?.opts(w, s, p) ?? [] : []);

// ------------------------------------------------------------------ wiring
for (const k of ['rivalry', 'arrest', 'revenge', 'climb'] as SitKind[]) registerStep(k, (w, s) => MATTERS[k]!.step(w, s));
factHooks().push((w, f) => {
  if (f.story?.startsWith('sit:') && f.kind !== 'arrest') return; // a matter's own doings do not open new matters, except an arrest
  if (f.kind === 'arrest') onArrest(w, f);
  else if (f.kind === 'beating' || f.kind === 'murder') onHurt(w, f);
});
goalHooks().push(onGoal);
// weekly, from the engine
export function mattersWeek(w: World) { rivalryScan(w); }
void asker; void askee;
