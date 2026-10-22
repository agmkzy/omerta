import { post } from './ledger';
import { bizMove, succeedOwner } from './econ';
import { applyRank, repairHierarchy } from './rank';
import { succeed } from './orgs';
import { Business, Character, DAY, Debt, Fact, FactKind, Id, Rel, World } from './types';
import { goalsOnDeath } from './goals';
import { temper } from './temper';

export const DISTRICTS = ['Little Italy', 'Bensonhurst', 'Red Hook', "Hell's Kitchen", 'The Bronx', 'Staten Island', 'Astoria'];

export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const travelTime = (a: string, b: string) => (a === b ? 10 : 35);
export const dayNo = (t: number) => Math.floor(t / DAY) + 1;

// Day 0 is Monday 2 March 1970.
export function fmtTime(t: number): string {
  const d = new Date(Date.UTC(1970, 2, 2) + t * 60000);
  return d.toLocaleString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export function shortTime(t: number): string {
  const m = t % DAY;
  return `Day ${dayNo(t)} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function newId(w: World, prefix: string): Id {
  return prefix + w.nextId++;
}

// V89: reading how a man stands with another without creating a record for two men who have never met (rel() creates one,
// which is right when something is about to change, and fills the save when it is only a question)
const NOREL: Readonly<Rel> = Object.freeze({ trust: 0.1, respect: 0.3, affection: 0.1, grudge: 0, lastMet: -1e9 });
export const peek = (c: Character, id: Id): Readonly<Rel> => c.rels[id] ?? NOREL;
export function rel(c: Character, id: Id): Rel {
  return (c.rels[id] ??= { trust: 0.1, respect: 0.3, affection: 0.1, grudge: 0, lastMet: -1e9 });
}

// Foundation (Oct 2026): one door for what one man holds against another, and why. Every change to a grudge comes through here,
// with its reason: the event that caused it, or a plain reason where nothing was recorded as an event. The reason kept is the one
// that did most to raise the grudge lately (a slight does not overwrite a beating; a month-old reason gives way to a new one), and
// it goes when the grudge does, so anyone who reads a grudge can say what it is about.
export const bear = (w: World, c: Character, other: Id, amount: number, why: Fact | string) => bearOn(w, rel(c, other), amount, why);
// a grudge raised to at least a level (a killing, a betrayal), rather than by an amount
export const bearAtLeast = (w: World, c: Character, other: Id, level: number, why: Fact | string) => bearAtLeastOn(w, rel(c, other), level, why);
// a grudge let go, in part (by a factor) or wholly (0)
export function ease(c: Character, other: Id, factor: number) { const r = c.rels[other]; if (r) easeOn(r, factor); }
// the same, on a relationship already in hand
export function bearOn(w: World, r: Rel, amount: number, why: Fact | string) {
  const before = r.grudge;
  r.grudge = clamp(r.grudge + amount);
  if (r.grudge > before) noteWhy(w, r, r.grudge - before, why);
  else if (r.grudge < 0.05) delete r.why;
}
export function bearAtLeastOn(w: World, r: Rel, level: number, why: Fact | string) {
  if (r.grudge < level) { noteWhy(w, r, level - r.grudge, why); r.grudge = level; }
}
export function easeOn(r: Rel, factor: number) {
  r.grudge = clamp(r.grudge * factor);
  if (r.grudge < 0.05) delete r.why;
}
function noteWhy(w: World, r: Rel, a: number, why: Fact | string) { r.why = pickWhy(w, r.why, a, why); }
// the reason kept is the one that did most lately: a small thing does not overwrite a big one, a month-old one gives way
function pickWhy(w: World, cur: Rel['why'], a: number, why: Fact | string): Rel['why'] {
  if (cur && a < cur.a * 0.5 && w.now - cur.t < 30 * DAY) return cur;
  return typeof why === 'string' ? { t: w.now, text: why, a: Math.round(a * 100) / 100 } : { t: w.now, text: why.text, f: why.id, a: Math.round(a * 100) / 100 };
}

// Foundation step 3 (Oct 2026): one door for how one man regards another (trust, respect, affection, fear), the same for everyone.
// A gain shrinks as the feeling nears its limit (the last stretch is the hardest: V89's rule for the player, now everyone's); trust
// and liking also grow with familiarity (you can't come to trust or like a man you barely know, however well he treats you); losses
// are not damped. What a man's regard rests on, the turn or the time that did most to raise it, is kept with it (bond), as a
// grudge keeps its reason. Familiarity itself (known) grows with time spent and things lived through together (knowMore).
export type Feeling = 'trust' | 'respect' | 'affection' | 'fear';
export const feel = (w: World, c: Character, other: Id, f: Feeling, amount: number, why?: Fact | string) => feelOn(w, rel(c, other), f, amount, why);
export function feelOn(w: World, r: Rel, f: Feeling, amount: number, why?: Fact | string): number {
  const v = r[f] ?? 0;
  let d = amount;
  if (amount > 0) {
    d = amount * Math.max(0.15, 1 - v);
    if (f === 'trust' || f === 'affection') d *= 0.4 + 0.6 * (r.known ?? 0);
  }
  const nv = clamp(v + d);
  r[f] = nv;
  if (nv !== v + d) d = nv - v; // (the change actually made, where the limit cut it short; otherwise exactly what was asked)
  if (d > 0 && why && (f === 'trust' || f === 'affection')) r.bond = pickWhy(w, r.bond, d, why);
  if (f === 'fear' && (r.fear ?? 0) < 0.02) delete r.fear;
  return d;
}
// Weekly, every man's feelings for others fade when nothing feeds them, by the same rules for every feeling: a grudge cools (a proud
// man nurses one longer: a few months against a few weeks), fear fades, liking and trust drift back towards nothing between men who
// no longer see each other, and so, slowly, does how well they know each other. Respect is a man's name as another knows it: between
// men who know each other it settles towards the other's standing (earned by deeds, core.DEED and repute), with something for the
// man above, the closer as they know each other better. Replaces the old grudge-only cooling and the separate fear pass.
const LIFE_RANK = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
export function feelingsWeek(w: World, c: Character) {
  const hold = 0.88 + temper(c).pride * 0.08, mine = LIFE_RANK.indexOf(c.rank);
  for (const [id, r] of Object.entries(c.rels)) {
    const o = w.chars[id];
    if (o?.alive && (r.known ?? 0) >= 0.2) {
      const above = Math.max(0, LIFE_RANK.indexOf(o.rank) - Math.max(0, mine)) * 0.05;
      r.respect = clamp(r.respect + (clamp(o.standing / 100 + above) - r.respect) * 0.05 * (r.known ?? 0));
    }
    easeOn(r, r.grudge < 0.05 ? 0 : hold);
    if (r.fear !== undefined) { r.fear *= 0.9; if (r.fear < 0.02) delete r.fear; }
    const apart = w.now - r.lastMet;
    if (apart > 14 * DAY) {
      r.trust = Math.max(0.1, r.trust * 0.94);
      r.affection = Math.max(0.1, r.affection * 0.94);
    }
    if (apart > 28 * DAY && r.known) r.known = Math.round(r.known * 0.99 * 1000) / 1000;
  }
}
// a feeling raised to at least a level, or set outright (a betrayal that leaves no trust at all)
export const feelAtLeast = (w: World, c: Character, other: Id, f: Feeling, level: number, why?: Fact | string) => { const r = rel(c, other); if ((r[f] ?? 0) < level) feelOn(w, r, f, level - (r[f] ?? 0), why); };
export const feelTo = (c: Character, other: Id, f: Feeling, value: number) => feelToOn(rel(c, other), f, value);
export function feelToOn(r: Rel, f: Feeling, value: number) { r[f] = clamp(value); if (f === 'fear' && value < 0.02) delete r.fear; }
export const feelAtLeastOn = (w: World, r: Rel, f: Feeling, level: number, why?: Fact | string) => { if ((r[f] ?? 0) < level) feelOn(w, r, f, level - (r[f] ?? 0), why); };
// what a man's regard rests on, when the gesture itself is recorded elsewhere (a favour owed: encounters.addFavour)
export function bondFor(w: World, c: Character, other: Id, size: number, why: Fact | string) { const r = rel(c, other); r.bond = pickWhy(w, r.bond, size, why); }
// familiarity: time together and things lived through together; both men come to know each other
export function knowMore(a: Character, b: Character, amount: number) {
  if (a.id === b.id) return;
  const ra = rel(a, b.id), rb = rel(b, a.id);
  ra.known = Math.round(clamp((ra.known ?? 0) + amount * (1 - (ra.known ?? 0))) * 1000) / 1000;
  rb.known = Math.round(clamp((rb.known ?? 0) + amount * (1 - (rb.known ?? 0))) * 1000) / 1000;
}
// How well two men get on, from who they are and where they stand: the agreeable and the sociable get on with most people; two
// proud men chafe, and a hot man and a cool one rub; wanting the same seat, an old grudge, or another family's colours get in the way.
// Between about -0.5 (they can't stand each other) and 0.6 (natural friends). Read whenever they spend time together (actions.ts).
export function compat(w: World, a: Character, b: Character): number {
  const ta = temper(a), tb = temper(b);
  let k = (ta.agreeable + tb.agreeable) * 0.3 + (a.traits.sociability + b.traits.sociability) * 0.12 - ta.pride * tb.pride * 0.55 - Math.abs(ta.volatility - tb.volatility) * 0.25 - 0.12;
  if (a.familyId && b.familyId && a.familyId !== b.familyId) k -= 0.1;
  if (a.familyId && a.familyId === b.familyId && a.rank === b.rank && a.rank !== 'civilian' && w.agency?.goals.some((g) => g.kind === 'advance' && g.who === a.id) && w.agency?.goals.some((g) => g.kind === 'advance' && g.who === b.id)) k -= 0.25; // after the same seat
  k -= Math.max(peek(a, b.id).grudge, peek(b, a.id).grudge) * 0.6;
  return clamp(k, -1, 1);
}

// V89: what a man thinks of the player is earned, not accumulated. Every gain in an NPC's regard for the player goes through
// here: it shrinks as the regard rises (the last stretch to complete trust is the hardest) and halves each time the same kind of
// gesture is repeated with the same man within a week (a third drink in a week buys almost nothing). Losses are not damped.
// Foundation step 3: the shrinking and the familiarity are everyone's now (feelOn); only the weekly repetition rule is the player's,
// so the per-man bookkeeping stays small.
export function regard(w: World, npc: Character, player: Character, field: 'trust' | 'respect' | 'affection', amount: number, kind: string): number {
  const r = rel(npc, player.id);
  if (amount <= 0) return feelOn(w, r, field, amount);
  const week = Math.floor(w.now / (7 * 1440));
  const key = `rg:${npc.id}:${kind}`;
  const seen = player.cooldown[key] ?? 0; // encoded as week * 100 + times this week
  const times = Math.floor(seen / 100) === week ? seen % 100 : 0;
  player.cooldown[key] = week * 100 + Math.min(99, times + 1);
  // (on top of the rules everyone's regard follows, core.feelOn: the same gesture repeated with the same man within a week counts for less)
  return feelOn(w, r, field, amount * Math.pow(0.5, times));
}

// Standing (reputation) is earned the same way: each gain shrinks as reputation climbs and as the same kind of deed repeats
// within a week. Losses are not damped: a name is quicker lost than made. Returns the change actually applied.
// Foundation (Oct 2026): the one door for anyone's standing, player or not. Deeds come here from addFact (DEED); a rise in rank
// from applyRank; everything else the game rewards or punishes calls it directly, with the kind of thing it was.
export function repute(w: World, p: Character, amount: number, kind: string): number {
  if (amount <= 0) { const before = p.standing; p.standing = clamp(p.standing + amount, 0, 100); return p.standing - before; }
  const week = Math.floor(w.now / (7 * 1440));
  const key = `st:${kind}`;
  const seen = p.cooldown[key] ?? 0;
  const times = Math.floor(seen / 100) === week ? seen % 100 : 0;
  p.cooldown[key] = week * 100 + Math.min(99, times + 1);
  const gain = amount * Math.pow(0.6, times) * Math.max(0.2, 1 - Math.max(0, p.standing - 40) / 70);
  const before = p.standing;
  p.standing = clamp(p.standing + gain, 0, 100);
  return p.standing - before;
}

export function link(a: Character, b: Character, trust: number) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as [Character, Character][]) {
    const r = rel(x, y.id);
    r.known = Math.max(r.known ?? 0, Math.round((0.3 + trust * 0.6) * 100) / 100); // (men who work together know each other better than neighbours do)
    r.trust = Math.max(r.trust, trust);
    r.affection = Math.max(r.affection, trust * 0.6);
    r.respect = Math.max(r.respect, 0.4);
  }
}

export function schedule(w: World, t: number, kind: 'think' | 'weekly' | 'daily', who?: Id) {
  const ev = { t, seq: w.seq++, kind, who };
  let lo = 0;
  let hi = w.queue.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    const q = w.queue[m];
    if (q.t < ev.t || (q.t === ev.t && q.seq < ev.seq)) lo = m + 1;
    else hi = m;
  }
  w.queue.splice(lo, 0, ev);
}

export function isAwake(c: Character, t: number): boolean {
  const tod = t % DAY;
  if (c.sleep <= 24) return tod >= c.wake * 60 && tod < c.sleep * 60;
  return tod >= c.wake * 60 || tod < (c.sleep - 24) * 60;
}
export function nextWake(c: Character, t: number): number {
  const base = Math.floor(t / DAY) * DAY + c.wake * 60;
  return base > t ? base : base + DAY;
}

// Every dollar is recorded against where it came from, so the books can say what a man earned and what he owes up.
export function record(c: Character, amt: number, src: string) {
  if (amt <= 0) return;
  c.weekIncome += amt;
  if (c.isPlayer) c.lifetimeGross = (c.lifetimeGross ?? 0) + amt;
  c.books.gross[src] = (c.books.gross[src] ?? 0) + amt;
}
export function earn(c: Character, amt: number, src = 'odd') {
  c.cash += amt;
  record(c, amt, src);
}

// Which business each owner has, cached and rebuilt once it is more than 30 minutes of game time old. ownerBiz is called millions of times a run,
// so the check must be cheap: it no longer counts w.biz on every call. Instead, whatever adds a business (world.ts) or
// moves one between owners (econ.ts) calls ownersChanged, and the next call rebuilds the map. Businesses are never removed
// (a closed one stays, with open = false), and every new one gets a new id, so this rebuilds at exactly the moments the
// old count check did.
const ownerCache = new WeakMap<World, { t: number; map: Map<Id, Business> }>();
export function ownersChanged(w: World) { ownerCache.delete(w); }
export function ownerBiz(w: World, id: Id): Business | undefined {
  let c = ownerCache.get(w);
  if (!c || w.now - c.t > 30 || w.now < c.t) {
    const map = new Map<Id, Business>();
    for (const b of Object.values(w.biz)) if (b.open && !map.has(b.ownerId)) map.set(b.ownerId, b);
    c = { t: w.now, map };
    ownerCache.set(w, c);
  }
  const b = c.map.get(id);
  return b && b.open ? b : undefined;
}
export const famName = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : 'independent');
// The same event, told the way people actually tell it. The variant is fixed by the fact, so a story never changes between looks.
const h32 = (x: string) => { let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return h >>> 0; };
const TELL: [RegExp, string[]][] = [
  [/^(.+) dropped (\$[\d,]+) at (.+)\.$/, ['$1 left $2 on the table at $3 and called it an evening.', '$1 went home from $3 $2 lighter and swearing he was due.', '$3 had a good night. $1 had a very bad one: $2.']],
  [/^(.+) lent (.+) (\$[\d,]+)\.$/, ['$1 put $3 in $2’s hand. It will come back with interest, one way or another.', '$2 walked out of $1’s place with $3 and a debt that never sleeps.']],
  [/^(.+) now collects (\$[\d,]+) a week from (.+)\.$/, ['$3 now pays $1 $2 a week for the comfort of being left alone.', '$1 has $3 on the books: $2 a week, starting now.']],
  [/^(.+) told (.+) to get out of (.+)\.$/, ['$1 sent $2 packing from $3. No envelope, no discussion.', '$2 asked $1 for a weekly payment at $3 and was shown the door.', '$1 refused to pay protection and ran $2 out of $3.']],
  [/^(.+) robbed (.+) of (\$[\d,]+)\.$/, ['$1 cleaned out $2: $3, gone in a night.', '$2 opened up to find $3 missing. $1 left a cold till and a hot rumour.']],
  [/^(.+) beat up (.+)\.$/, ['$1 put $2 in the dirt. It wasn’t a conversation.', '$2 got a lesson from $1, delivered with fists.']],
  [/^(.+) missed a (\$[\d,]+) payment to (.+)\.$/, ['$1 let a $2 payment to $3 slide. That kind of thing gets noticed.', '$3 is still waiting on $2 from $1. Patience is wearing thin.']],
  [/^(.+) is late with the (\$[\d,]+) he owes (.+) for (.+)\.$/, ['$1 is late with $2 to $3 for $4. The envelope isn’t going to fill itself.', '$4’s envelope is light. $1 owes $3 $2 and hasn’t come up with it.']],
  [/^(.+) cleared his debt to (.+)\.$/, ['$1 squared up with $2. Not many do it voluntarily.', '$2 got paid in full by $1. A rarity.']],
  [/^(.+) was arrested\.$/, ['The law picked up $1. His friends have started saying he’s a good man.', '$1 is in a cell tonight, and every friend he has is thinking about what he knows.']],
  [/^(.+) came up (\$[\d,]+) short on what he owes (.+)\.$/, ['$1 came up $2 short with $3. The kind of mistake that’s remembered.', '$3 counted it twice. $1 was $2 light.']],
];
export function flavour(f: Fact, text: string): string {
  if (text !== f.text) return text;
  for (const [re, vs] of TELL) {
    const m = re.exec(text);
    if (m) return text.replace(re, vs[h32(f.id) % vs.length]);
  }
  return text;
}
export const factText = (f: Fact, knowsActor: boolean) => flavour(f, knowsActor || !f.textHidden ? f.text : f.textHidden);

// ---------------------------------------------------------------- knowledge

// How much a victim resents the culprit when they learn about it.
// Foundation (Oct 2026): what an act does to the name of the man who did it and of the man it was done to. The same for
// everyone, player or not: equivalent deeds, equivalent reputation. Applied once, where the act is recorded (addFact), through
// repute (which damps the same kind of gain repeated in one week). A hidden hand earns nothing until it is known. Rising in rank
// is reputed where every rank change goes (rank.ts applyRank).
export const DEED: Partial<Record<FactKind, readonly [actor: number, victim: number]>> = {
  protection_started: [1.5, 0], // brought a shop in
  protection_refused: [0, -0.3], // the shopkeeper said no to him (the victim is the man refused)
  beating: [0.8, -1.5],
  vandalism: [0.3, -0.5],
  robbery: [0.3, -0.5],
  murder: [3, 0],
  attempt: [0.5, -1],
  poach: [1.5, -1.5], // took a shop from another family's man
  threat: [0.2, -0.3],
  discipline: [0.3, -2], // the boss called him to account
  shortfall: [-1, 0], // his envelope came up light
  debt_missed: [-0.5, 0],
  debt_default: [-4, 0],
  raid: [-1, 0],
  informant: [-20, 0], // found out talking to the police
  exposed: [-4, 2], // a false accusation came apart: the accuser loses, the accused is cleared
};
// and those who come to know of it think a little more, or less, of the men in it: respect follows deeds both ways
const HEARD = 0.01;
// violence: how much a man who hears of it comes to fear the man who did it, before his own courage (learn)
const VIOLENT: Partial<Record<FactKind, number>> = { beating: 0.04, vandalism: 0.02, robbery: 0.02, murder: 0.12, attempt: 0.06 };

const GRUDGE: Partial<Record<FactKind, number>> = {
  beating: 0.5,
  vandalism: 0.5,
  murder: 0.8,
  robbery: 0.4,
  poach: 0.4,
  debt_missed: 0.15,
  debt_default: 0.4,
  protection_refused: 0.2,
};

export function learn(w: World, cid: Id, fact: Fact, from: string, knowsActor: boolean) {
  const c = w.chars[cid];
  if (!c || c.known[fact.id]) return;
  c.known[fact.id] = { t: w.now, from, knowsActor };
  if (fact.kind === 'business_struggling' && fact.business) c.struggling[fact.business] = fact.t;
  if (!c.alive || !knowsActor || !fact.actor || fact.actor === cid) return;
  const d = DEED[fact.kind];
  const brave = temper(c).courage;
  if (d && !fact.minor && fact.victim !== cid) {
    if (d[0]) feel(w, c, fact.actor, 'respect', d[0] * HEARD);
    if (d[1] && fact.victim && fact.victim !== fact.actor) feel(w, c, fact.victim, 'respect', d[1] * HEARD);
    // Foundation step 3: and a man who hears what another can do learns to be wary of him, the more so the less brave he is
    if (VIOLENT[fact.kind]) feel(w, c, fact.actor, 'fear', VIOLENT[fact.kind]! * (1 - brave), fact);
  }
  const g = GRUDGE[fact.kind];
  if (!g) return;
  if (fact.victim === cid) {
    // done to him: a brave man answers it with a grudge, a timid one with fear (temper), and either way he trusts the man less
    const v = VIOLENT[fact.kind] !== undefined;
    bear(w, c, fact.actor, v ? g * (0.4 + 0.6 * brave) : g, fact);
    if (v) feel(w, c, fact.actor, 'fear', g * (1 - brave) * 0.8, fact);
    feel(w, c, fact.actor, 'trust', -g * 0.5);
  } else if (fact.victim) {
    const v = w.chars[fact.victim];
    const close = (c.rels[fact.victim]?.affection ?? 0) > 0.5 || (!!v?.familyId && v.familyId === c.familyId);
    if (close) bear(w, c, fact.actor, g * 0.3, fact);
  }
}

// Someone was hurt by an unknown party. They guess - and may guess wrong.
function suspect(w: World, c: Character, fact: Fact) {
  const myFam = c.familyId;
  let best: Character | null = null;
  let bs = 0.12;
  for (const x of Object.values(w.chars)) {
    if (!x.alive || x.id === c.id || !x.familyId || x.familyId === myFam) continue;
    const r = c.rels[x.id];
    const tension = myFam ? (w.fam[myFam].tension[x.familyId] ?? 0) : 0;
    const s = (r ? r.grudge : 0) + tension * 0.05;
    if (s > bs) {
      bs = s;
      best = x;
    }
  }
  if (best) {
    const r = rel(c, best.id);
    r.grudge = clamp(r.grudge + 0.3);
  }
}

export interface FactOpts {
  witnesses?: Id[];
  victimKnows?: boolean;
  broadcast?: Id[]; // people who hear about it (without learning who did it)
}

export function addFact(
  w: World,
  f: Omit<Fact, 'id' | 't' | 'district'> & { district?: string },
  o: FactOpts = {},
): Fact {
  const actor = f.actor ? w.chars[f.actor] : undefined;
  const victim = f.victim ? w.chars[f.victim] : undefined;
  const fact: Fact = {
    ...f,
    id: newId(w, 'f'),
    t: w.now,
    district: f.district ?? actor?.district ?? victim?.district ?? DISTRICTS[0],
  };
  w.facts[fact.id] = fact;
  // two men who were in it together, either side of it, now know each other better (core.knowMore)
  if (actor && victim && actor.id !== victim.id && !fact.hiddenActor && !fact.minor) knowMore(actor, victim, 0.03);
  const d = DEED[fact.kind];
  if (d && !fact.minor) {
    if (d[0] && actor && !fact.hiddenActor) repute(w, actor, d[0], 'deed:' + fact.kind);
    if (d[1] && victim && victim.id !== actor?.id) repute(w, victim, d[1], 'deed:' + fact.kind);
  }
  // Secrets leak. Sooner or later whoever was hurt usually finds out who did it.
  if (fact.hiddenActor && fact.actor && w.rng.chance(0.3)) (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(14, 56) * DAY, kind: 'reveal', fact: fact.id });
  const witnesses = o.witnesses ?? [];
  const knowers = new Set<Id>(witnesses);
  if (f.actor) knowers.add(f.actor);
  if (f.victim && o.victimKnows !== false) knowers.add(f.victim);
  for (const id of knowers) {
    const c = w.chars[id];
    if (!c || !c.alive) continue;
    const knowsActor = !fact.hiddenActor || id === f.actor || witnesses.includes(id);
    learn(w, id, fact, id === f.actor ? 'self' : 'witness', knowsActor);
    if (!knowsActor) suspect(w, c, fact);
  }
  for (const id of o.broadcast ?? []) {
    const c = w.chars[id];
    if (!c || !c.alive || c.known[fact.id]) continue;
    learn(w, id, fact, 'public', !fact.hiddenActor);
    if (fact.hiddenActor) suspect(w, c, fact);
  }
  // V89: events open matters (matters.ts listens here). Not re-entered: a matter's own tellings do not start new matters.
  const hooks = factHooks();
  if (hooks.length && !hooking) { hooking = true; try { for (const h of hooks) h(w, fact); } finally { hooking = false; } }
  return fact;
}
// (kept on the hoisted function, so a module may register while the import cycle is still loading this one)
export function factHooks(): ((w: World, f: Fact) => void)[] { const h = factHooks as unknown as { l?: ((w: World, f: Fact) => void)[] }; return (h.l ??= []); }
let hooking = false;

// Protected businessmen phone their protector when something happens.
// What a man should have passed up over the last month and did not (as far as the books show).
export function concealedGap(w: World, c: Character): number {
  const f = c.familyId ? w.fam[c.familyId] : undefined;
  const rate = c.kickRate + (f?.levy && f.levy.until > w.now ? f.levy.extra : 0);
  return Math.round(c.books.history.slice(-4).reduce((a, x) => a + Math.max(0, x.gross - x.declared), 0) * rate);
}

export function notifyProtector(w: World, b: Business, f: Fact) {
  const p = b.protection;
  if (!p) return;
  const pc = w.chars[p.collectorId];
  if (!pc || !pc.alive || pc.known[f.id]) return;
  learn(w, pc.id, f, b.ownerId, !f.hiddenActor);
  if (f.hiddenActor) suspect(w, pc, f);
}

export function witnessesAt(w: World, district: string, exclude: Id[], max = 3): Id[] {
  const out: Id[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.district !== district || exclude.includes(c.id) || c.jailedUntil > w.now) continue;
    if (!isAwake(c, w.now)) continue;
    if (w.rng.chance(0.25)) out.push(c.id);
  }
  while (out.length > max) out.splice(w.rng.int(0, out.length - 1), 1);
  return out;
}

// ------------------------------------------------------------------- debts

export function createDebt(
  w: World,
  creditor: Id,
  debtor: Id,
  principal: number,
  rate: number,
  reason: string,
  cause?: Id,
): Debt {
  const d: Debt = {
    id: newId(w, 'd'),
    creditor,
    debtor,
    principal,
    balance: principal,
    weeklyRate: rate,
    weeklyPayment: Math.round((principal * 0.12) / 5) * 5,
    nextDue: w.now + 7 * DAY,
    missed: 0,
    status: 'active',
    reason,
    cause,
  };
  w.debts.push(d);
  post(w, { from: creditor, to: debtor, amt: principal, flow: 'loan', note: reason });
  return d;
}

// Debtor pays from pocket first, then from their business till.
export function payDebt(w: World, d: Debt, amount: number) {
  const debtor = w.chars[d.debtor];
  const creditor = w.chars[d.creditor];
  let rest = amount;
  const fromCash = Math.min(debtor.cash, rest);
  debtor.cash -= fromCash;
  rest -= fromCash;
  if (rest > 0) {
    const b = ownerBiz(w, debtor.id);
    if (b) bizMove(w, b, -rest, 'debt', debtor.id);
  }
  earn(creditor, amount, 'loans');
  post(w, { from: debtor.id, to: creditor.id, amt: amount, flow: 'repay', note: d.reason });
  d.paid = (d.paid ?? 0) + amount;
  d.balance = Math.round(d.balance - amount);
  if (amount >= d.weeklyPayment || d.balance <= 0) d.missed = 0;
  if (d.balance <= 0) {
    d.status = 'paid';
    onDebtCleared(w, d);
    addFact(w, {
      kind: 'debt_paid',
      actor: debtor.id,
      victim: creditor.id,
      text: `${debtor.name} cleared his debt to ${creditor.name}.`,
      minor: true,
      cause: d.cause,
    });
  }
}

// ------------------------------------------------------------------- death

export function handleDeath(w: World, id: Id, o: { cause?: string; favoured?: Id } = {}) {
  const d = w.chars[id];
  d.alive = false;
  d.diedAt = w.now;
  goalsOnDeath(w, d); // a dead man's plans end with him
  for (const b of Object.values(w.biz)) {
    if (b.ownerId === id && b.open && !succeedOwner(w, b, d)) {
      b.open = false;
      addFact(w, {
        kind: 'business_failed',
        business: b.id,
        victim: id,
        text: `${b.name} shut its doors after ${d.name}'s death.`,
        minor: true,
        district: b.district,
      });
    }
    if (b.protection?.collectorId === id) delete b.protection;
  }
  for (const x of w.debts) if (x.status === 'active' && (x.debtor === id || x.creditor === id)) x.status = 'void';
  for (const q of w.disputes ?? []) if ((q.status === 'open' || q.status === 'violated') && (q.a === id || q.b === id)) { q.status = 'dropped'; q.history.push({ t: w.now, text: 'One of the two is gone. There is nobody left to argue with.' }); }
  const subs = Object.values(w.chars).filter((x) => x.alive && x.bossId === id);
  if (d.rank === 'boss' && d.familyId) {
    succeed(w, d.familyId, d, o.cause ?? 'death', { favoured: o.favoured });
  } else {
    for (const s of subs) s.bossId = d.bossId;
  }
  if (d.familyId) {
    const f = w.fam[d.familyId];
    if (f) { if (f.heir === id) delete f.heir; if (f.consigliere === id) delete f.consigliere; if (f.acting === id) delete f.acting; }
    repairHierarchy(w, d.familyId);
  }
}

// Whatever hung on a debt lets go of it when it is cleared: the jobs to collect it, the reminders, the grudge.
export function onDebtCleared(w: World, d: Debt) {
  for (const j of w.jobs) {
    if (j.debt !== d.id || (j.status !== 'offered' && j.status !== 'active')) continue;
    j.status = 'expired';
    j.notes = [...(j.notes ?? []), 'The debt was cleared.'];
  }
  for (const c of [w.chars[d.creditor], w.chars[d.debtor]]) {
    if (!c) continue;
    for (const m of c.memos) if (!m.done && m.ref && w.facts[m.ref]?.cause === d.cause && w.facts[m.ref]?.kind.startsWith('debt')) m.done = true;
  }
  const deb = w.chars[d.debtor], cre = w.chars[d.creditor];
  if (deb && cre) { rel(cre, deb.id).grudge = clamp(rel(cre, deb.id).grudge - 0.15); rel(cre, deb.id).trust = clamp(rel(cre, deb.id).trust + 0.05); }
  for (const e of w.enc) if (e.status === 'open' && e.data?.debt === d.id) e.status = 'lapsed';
}

// An event that described a situation which no longer exists. It stays in history; it stops being a live matter.
export function isResolved(w: World, f: Fact): boolean {
  const a = f.actor ? w.chars[f.actor] : undefined;
  const v = f.victim ? w.chars[f.victim] : undefined;
  switch (f.kind) {
    case 'loan':
    case 'debt_missed':
    case 'debt_default': {
      if (!a || !v) return false;
      return !w.debts.some((d) => d.status === 'active' && ((d.debtor === a.id && d.creditor === v.id) || (d.debtor === v.id && d.creditor === a.id)));
    }
    case 'shortfall': {
      if (!a || !v) return false;
      return a.books.arrears <= 0 && a.books.missed === 0 && !(v.books.flags[a.id]?.amt > 0);
    }
    case 'arrest': return !!a && a.jailedUntil <= w.now;
    case 'beating': return !!v && v.hurtUntil <= w.now && (w.disputes ?? []).some((d) => d.fact === f.id && d.status !== 'open' && d.status !== 'violated');
    case 'poach':
    case 'vandalism':
    case 'robbery': return (w.disputes ?? []).some((d) => d.fact === f.id && d.status !== 'open' && d.status !== 'violated');
    case 'protection_refused': { const b = f.business ? w.biz[f.business] : undefined; return !!b?.protection; }
    default: return false;
  }
}

export function recordCareer(w: World, c: Character | undefined, text: string, ok?: boolean) {
  if (!c) return;
  const k = (c.career ??= { done: 0, failed: 0, log: [] });
  if (ok === true) k.done++;
  if (ok === false) k.failed++;
  k.log.push({ t: w.now, text });
  if (k.log.length > 12) k.log.shift();
}
