// V89: asks. Most of what happens between people in this world is one man wanting something from another: a shop's money, a
// debt paid, a man to back off, a favour, a yes. An ask is a situation (situ.ts, kind 'ask') with terms and a stance for each side,
// and it does not end at the first answer. The asker can come back with better terms, an argument, leverage, pressure, force, a
// senior man, or simply time; the other side can say yes, name his own terms, stall, refuse, or go to the people he has (his
// family, his friends, whoever protects him, another family, the police). Those people may make asks of their own. Superiors hear
// about what their men are doing and have views. The player and the NPCs use exactly the same moves; NPCs choose theirs from who
// they are. Each kind of ask only says what is being asked, what it is worth to the man asked, and what yes does in the real world.
import { ASKS } from './askkinds'; // first: the registry must exist before anything below can reach matters.ts
import { addFact, bear, bearOn, clamp, createDebt, transfer, restructure, ease, easeOn, famName, feel, feelOn, money, notifyProtector, ownerBiz, payDebt, peek, regard, rel, repute, witnessesAt } from './core';
import { loanPosition } from './negotiate';
import { say as vsay } from './voicesheet';
import { bizMove, changedSince, giveTime, noteRefusal, priceOf, sellerFloor, sellTo, setCollector, stakeRoom } from './econ';
import { tension } from './actions';
import { addEnc, addFavour } from './encounters';
import { closeKin, kinOf, kinTie, madeKin } from './kin';
import { LADDER } from './rank';
import { closeSit, isOpen, know, registerStep, spawn, tell } from './situ';
import { RECRUIT_COST, recruitProspect } from './orders';
import { finishJob } from './jobs';
import { rateView } from './books';
import { quarrelsWith, settleBetween } from './disputes';
import { arch } from './voice';
import { OPS } from './rackets';
import { aptitude } from './people';
import { noteConduct, noteHard, temper, viewOf } from './temper';
import { speak, type Approach } from './react';
import { classOf, giveReason } from './exchange';
import { Business, Character, DAY, Enc, Favour, Id, Situation, Stance, World } from './types';

export type AskMove = 'ask' | 'sweeten' | 'persuade' | 'leverage' | 'pressure' | 'force' | 'senior' | 'take' | 'wait' | 'drop' | 'name';
export type Answer = 'yes' | 'counter' | 'stall' | 'no' | 'help';
export interface Outcome { answer?: Answer; lines: string[]; closed?: boolean }

export interface AskKind {
  id: string;
  sev: number; // how serious a matter of this kind is (rumour reach, superiors' interest)
  title: (w: World, s: Situation) => string;
  roles: [string, string]; // [the asker's role, the role of the man asked]
  valid: (w: World, s: Situation) => boolean; // it still means something (the shop is open, the debt exists...)
  lean: (w: World, s: Situation, a: Character, t: Character) => number; // -1..1: what the terms are worth to him, from real state
  yes: (w: World, s: Situation, a: Character, t: Character) => string; // carry it out in the real systems
  counter?: (w: World, s: Situation, a: Character, t: Character) => { amt: number; why: string } | undefined; // terms he could live with
  better?: (w: World, s: Situation) => number | undefined; // the asker's better offer (a lower amount), if there is room
  force?: (w: World, s: Situation, a: Character, t: Character) => string; // what force means here
  phrase: { ask: (w: World, s: Situation) => string; yes: string; no: string; counter: string; stall: string };
  max?: number; // most open at once between NPCs, so no one kind fills the world's share of matters
  ttl?: number; // days a matter of this kind is kept open before it fades (default 45): a loan offer or a warning does not hang for weeks
  cool?: number; // weeks before the same matter can be raised again once it has settled (default 6)
  onNo?: (w: World, s: Situation, a: Character, t: Character) => string | undefined; // what a refusal does in the world, if anything beyond the matter
  moves?: AskMove[]; // the moves that make sense in this kind of matter (default: all of them)
  sweeten?: (amt: number) => string; // how coming down is put, if not as a lower price
  voice?: Partial<Record<'no' | 'counter' | 'stall', (w: World, s: Situation, a: Character, t: Character) => string>>; // his own words, when he says it to the player
  // (V89, the kinds converted later) the asker wants the figure low (a start, a price, a cut): better terms raise it, his counter is higher
  low?: boolean;
  fmt?: (amt: number) => string; // how the figure is said, if not as money
  short?: (w: World, s: Situation, a: Character, amt: number) => string | undefined; // the player can't put these terms up right now
  take?: (amt: string) => string; // how taking his counter is put
  keepOnNo?: boolean; // when the player refuses him, the matter stays open (he can come back), even if the refusal cost something
  cant?: (w: World, s: Situation, t: Character) => string | undefined; // the player, asked, would say yes but can't (no money on him)
  askLabel?: (w: World, s: Situation) => string; // how putting the terms is put, if not "Make the offer"
  // Stage 4: the asker may name the figure himself (and, for a loan, the weekly rate): the range it can sensibly be put in
  figure?: (w: World, s: Situation) => { min: number; max: number; step: number; rate?: { min: number; max: number } } | undefined;
  fear0?: number; // how much of his usual fear of the asker the man asked starts with (a stranger offering a place is not a threat)
}
export { ASKS }; // (the registry lives in askkinds.ts, so it exists however the program is entered)
export const ASK_CAP: Record<string, number> = { protect: 24, warn: 18, lend: 18 }; // open NPC asks of one kind at once (default 12)

// ------------------------------------------------------------------ helpers
const first = (c: Character) => c.name.split(' ')[0];
const rk = (c: Character) => Math.max(0, LADDER.indexOf(c.rank));
const live = (w: World, id?: Id | null) => { const c = id ? w.chars[id] : undefined; return c?.alive ? c : undefined; };
const role = (s: Situation, r: string) => (s.parties ?? []).find((p) => p.role === r)?.id;
export const asker = (w: World, s: Situation) => live(w, s.terms?.by);
export const askee = (w: World, s: Situation) => live(w, s.terms?.of);
export const kindOf = (s: Situation) => (s.ak ? ASKS[s.ak] : undefined);
const jitter = (w: World, s: Situation, k: string) => { let h = 2166136261; const x = `${s.id}:${k}:${Math.floor(w.now / DAY)}`; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return ((h >>> 0) / 4294967296 - 0.5) * 0.16; };
const sits = (w: World) => (w.situations ??= []);
const fmtOf = (K: AskKind | undefined, amt: number) => (K?.fmt ? K.fmt(amt) : money(amt));
// The player's counter when he is asked: less than was asked of him, or, where the asker wants the figure low (an offer for his
// business), more.
const playerCounter = (K: AskKind, amt: number) => (K.low ? Math.round(amt * 1.3 / 50) * 50 : Math.round(amt * 0.6 / 5) * 5);
export const openAsks = (w: World) => sits(w).filter((s) => s.kind === 'ask' && isOpen(s));
export const asksOf = (w: World, id: Id) => openAsks(w).filter((s) => s.terms?.by === id || s.terms?.of === id || (s.parties ?? []).some((p) => p.id === id));
export const shopInPlay = (w: World, biz: Id) => openAsks(w).some((s) => s.ak === 'protect' && s.biz === biz);
export const askBetween = (w: World, ak: string, by: Id, of: Id, biz?: Id) => openAsks(w).find((s) => s.ak === ak && s.terms?.by === by && s.terms?.of === of && (!biz || s.biz === biz));

// What a man knows about the other side that would frighten him into it: something the other did that he would not want told,
// or a favour still owed. Real records only.
export function leverageOf(w: World, a: Character, t: Character): { what: string; favour?: Id } | undefined {
  const fav = (w.favours ?? []).find((f) => !f.settled && f.from === a.id && f.to === t.id);
  if (fav) return { what: `the favour he still owes`, favour: fav.id };
  const secret = Object.keys(a.known).map((id) => w.facts[id]).find((f) => f && f.actor === t.id && a.known[f.id]?.knowsActor && ['robbery', 'burglary', 'theft', 'scam', 'skim', 'beating', 'vandalism', 'murder'].includes(f.kind) && w.now - f.t < 120 * DAY);
  if (secret) return { what: `what he knows about ${secret.text.replace(/\.$/, '').toLowerCase().startsWith(t.name.toLowerCase()) ? 'that business' : secret.text.replace(/\.$/, '')}` };
  return undefined;
}

// How a man stands when the matter starts: from his temperament and how he sees the other man (temper.ts: their relationship,
// what he has seen and heard of him, their ranks, with fear kept apart from respect).
function freshStance(w: World, me: Character, other: Character, asking: boolean): Stance {
  const v = viewOf(w, me, other), t = temper(me), T = me.traits;
  const good = clamp(v.trust * 0.6 + v.affection * 0.4); // (goodwill is trust and liking; respect is not goodwill)
  if (asking) return { resolve: clamp(0.35 + T.ambition * 0.2 + T.greed * 0.15 + t.pride * 0.1), fear: 0, anger: clamp(v.resent), good, tried: {} };
  return {
    resolve: clamp(0.3 + t.courage * 0.3 + t.pride * 0.2 + t.caution * 0.05 - t.agreeable * 0.05),
    // (what he believes of you personally, plus what any man fears of a man of that rank and that name for violence; his own
    // courage stands against it)
    fear: clamp(0.06 + v.fear * 0.6 + rk(other) * 0.09 + other.traits.violence * 0.18 - t.courage * 0.25),
    anger: clamp(v.resent),
    good,
    tried: {},
  };
}
export function stance(w: World, s: Situation, id: Id): Stance {
  const m = (s.st ??= {});
  if (!m[id]) { const me = w.chars[id], other = w.chars[id === s.terms?.by ? s.terms!.of : s.terms!.by]; m[id] = freshStance(w, me, other, id === s.terms?.by); const f0 = kindOf(s)?.fear0; if (f0 !== undefined && id === s.terms?.of) m[id].fear *= f0; }
  return m[id];
}
const bumpTried = (x: Stance, k: string) => { (x.tried ??= {})[k] = (x.tried[k] ?? 0) + 1; return x.tried[k]; };
const tried = (x: Stance, k: string) => x.tried?.[k] ?? 0;

// ------------------------------------------------------------------ opening
// Whether the player could put this to him now (an ask just settled between them has its cooling-off: he won't hear it again yet),
// so nothing is offered that would only be turned away for that reason.
export function mayAsk(w: World, ak: string, a: Character, t: Character, biz?: Id): boolean {
  return !!askBetween(w, ak, a.id, t.id, biz) || (w.sitcool?.[`ask:${ak}:${a.id}:${t.id}:${biz ?? ''}`] ?? 0) <= w.now;
}
export function openAsk(w: World, ak: string, a: Character, t: Character, o: { biz?: Id; amt?: number; what?: string; about?: Id; why?: string; depth?: number; parent?: Id; m?: Situation['m']; rate?: number; share?: number } = {}): Situation | undefined {
  const K = ASKS[ak];
  if (!K || a.id === t.id) return undefined;
  const existing = askBetween(w, ak, a.id, t.id, o.biz);
  if (existing) return existing;
  if (K.max !== undefined && !a.isPlayer && !t.isPlayer && openAsks(w).filter((x) => x.ak === ak && x.terms?.by !== w.playerId).length >= K.max) return undefined;
  // no one kind of ask crowds out the others: each has its own share of the world's ceiling (SIT.cap.own.ask). What the player
  // himself asks always has room.
  if (!a.isPlayer && openAsks(w).filter((x) => x.ak === ak).length >= (ASK_CAP[ak] ?? 12)) return undefined;
  const key = `ask:${ak}:${a.id}:${t.id}:${o.biz ?? o.about ?? ''}`;
  const s = spawn(w, 'ask', key, a.id, {
    cause: o.why ?? `${a.name} wants something from ${t.name}`, sev: K.sev, phase: 'open', next: w.now + 2 * DAY,
    parties: [{ id: a.id, role: K.roles[0] }, { id: t.id, role: K.roles[1] }], biz: o.biz,
    orgs: [...new Set([a.familyId, t.familyId].filter(Boolean) as Id[])], m: o.m,
  });
  if (!s) return undefined;
  { const st = ((w.sitpace ??= { lastMajor: -1e9, lastVisible: -1e9, weekVis: 0, wk: 0 }).stats ??= {}); const k = `open.${ak}${a.isPlayer || t.isPlayer ? '.player' : ''}`; st[k] = (st[k] ?? 0) + 1; } // (V89: counted by kind, for the record)
  s.ak = ak;
  s.terms = { by: a.id, of: t.id, amt: o.amt, first: o.amt, what: o.what, ...(o.rate !== undefined ? { rate: o.rate } : {}), ...(o.share !== undefined ? { share: o.share } : {}) };
  if (o.about) s.m = { ...(s.m ?? {}), about: o.about };
  if (o.depth) s.m = { ...(s.m ?? {}), depth: o.depth };
  if (o.parent) s.m = { ...(s.m ?? {}), parent: o.parent };
  know(w, s, a.id, 2, 'his own'); know(w, s, t.id, 2, 'was asked');
  stance(w, s, a.id); stance(w, s, t.id);
  return s;
}

// ------------------------------------------------------------------ one move, one answer
// The asker makes a move; the man asked answers, from his stance and what the terms are worth to him. Shared by player and NPCs.
export function move(w: World, s: Situation, mv: AskMove): Outcome {
  const K = kindOf(s), a = asker(w, s), t = askee(w, s);
  const lines: string[] = [];
  if (!K || !a || !t || !isOpen(s)) return { lines: ['There is nothing left to talk about.'], closed: true };
  if (!K.valid(w, s)) { closeSit(w, s, 'moot', [], 2); return { lines: ['It doesn’t matter any more.'], closed: true }; }
  const S = stance(w, s, t.id), A = stance(w, s, a.id), tp = temper(t);
  // a man can't offer what he hasn't got in his pocket (the player only: an NPC's offers are checked by the kind itself)
  if (a.isPlayer && K.short && (mv === 'ask' || mv === 'take' || mv === 'sweeten' || mv === 'name')) {
    const amt = mv === 'take' ? Number(s.m?.offer ?? s.terms?.amt ?? 0) : mv === 'sweeten' ? K.better?.(w, s) : s.terms?.amt;
    const no = amt !== undefined ? K.short(w, s, a, amt) : undefined;
    if (no) return { lines: [no] };
  }
  s.m = { ...(s.m ?? {}), at: w.now, beat: '' }; // when it last moved (V90: and a new move supersedes the point he made before it) (the conversation shows a matter just raised as the thing to answer)
  const n = bumpTried(A, mv); // how often he has tried this on this man
  const wit = witnessesAt(w, t.district, [a.id, t.id], 2);
  if (s.biz && w.biz[s.biz]) w.biz[s.biz].lastApproach = w.now;
  switch (mv) {
    case 'name': // terms of his own: a new figure is a new offer, weighed as one (not the same thing said again)
      if (!a.isPlayer) lines.push(K.phrase.ask(w, s));
      break;
    case 'ask':
      if (n > 1 && S.last && S.last !== 'stall') { S.anger = clamp(S.anger + 0.02 + tp.pride * 0.04); S.resolve = clamp(S.resolve + 0.03); if (!a.isPlayer || t.isPlayer) lines.push(`${first(t)} has heard it before.`); }
      if (!a.isPlayer) lines.push(K.phrase.ask(w, s)); // (the player's own words are his choice; they are not narrated back to him)
      break;
    case 'sweeten': {
      const amt = K.better?.(w, s);
      if (amt === undefined) return { lines: ['There is no better offer to make.'] };
      s.terms!.amt = amt; S.good = clamp(S.good + 0.01 + tp.agreeable * 0.04);
      if (tp.pride > 0.66 && tp.agreeable < 0.5) S.anger = clamp(S.anger + 0.03); // a proud man can take a small sweetener as an insult
      noteConduct(a, 'deals', 0.5);
      if (!a.isPlayer) lines.push(K.low ? `${first(a)} goes to ${fmtOf(K, amt)}.` : `${first(a)} comes down to ${money(amt)}.`);
      break;
    }
    case 'persuade': {
      // reason works on a man who can be reached: the agreeable and the soft-hearted hear it, the proud resist being told
      const g = (0.05 + a.skills.charm * 0.1) * (0.6 + tp.agreeable * 0.45 + tp.empathy * 0.3 - tp.pride * 0.25) * Math.pow(0.55, n - 1);
      S.good = clamp(S.good + g); S.resolve = clamp(S.resolve - g * 0.6);
      if (n >= 3) S.anger = clamp(S.anger + 0.03 + tp.volatility * 0.04);
      if (!a.isPlayer) lines.push(n >= 3 ? `${first(t)} has heard every argument there is.` : `${first(a)} puts it to him as a sensible man would.`);
      break;
    }
    case 'leverage': {
      const lv = leverageOf(w, a, t);
      if (!lv) return { lines: ['There is nothing to hold over him.'] };
      S.fear = clamp(S.fear + 0.2 + tp.caution * 0.15); S.resolve = clamp(S.resolve - 0.25); S.anger = clamp(S.anger + 0.08 + tp.pride * 0.15);
      noteHard(w, a, t, 'threats', 0.5);
      if (lv.favour) { const f = w.favours.find((x) => x.id === lv.favour); if (f) f.settled = true; }
      tell(w, s, `${a.name} reminded ${t.name} of ${lv.what}.`, { actor: a.id, victim: t.id, minor: true });
      if (!a.isPlayer) lines.push(`${first(a)} reminds him of ${lv.what}.`);
      break;
    }
    case 'pressure': {
      // fear lands hardest on the cautious and least on the brave; the proud turn it into resentment and dig in
      const f = (0.1 + (a.skills.nerve + rk(a) * 0.15) * 0.14) * (0.55 + tp.caution * 0.7 - tp.courage * 0.6) * Math.pow(0.7, n - 1);
      S.fear = clamp(S.fear + f); S.anger = clamp(S.anger + 0.04 + tp.pride * 0.1 + tp.volatility * 0.06);
      // (a brave, proud man digs in; a timid, careful one's nerve goes: fear is what does it, so the more it lands the more it costs him)
      S.resolve = clamp(S.resolve + (tp.courage + tp.pride > 1.25 ? 0.06 : -0.04 - f * (0.6 + tp.caution * 0.8) * (1 - tp.courage)));
      feel(w, t, a.id, 'fear', f * 0.5); noteHard(w, a, t, 'threats');
      tell(w, s, `${a.name} leaned on ${t.name}${s.biz ? ` at ${w.biz[s.biz]?.name}` : ''}.`, { actor: a.id, victim: t.id, witnesses: wit, minor: true });
      if (!a.isPlayer) lines.push(`${first(a)} makes it clear what saying no would cost.`);
      break;
    }
    case 'force': {
      if (!K.force) return { lines: ['Force would settle nothing here.'] };
      lines.push(K.force(w, s, a, t));
      S.fear = clamp(S.fear + 0.25 + tp.caution * 0.15); S.anger = clamp(S.anger + 0.25 + tp.pride * 0.15); S.resolve = clamp(S.resolve + (tp.courage > 0.65 ? 0.05 : -0.12 - (1 - tp.courage) * tp.caution * 0.2));
      feel(w, t, a.id, 'fear', 0.2); noteHard(w, a, t, 'force');
      a.heat = clamp(a.heat + 0.08, 0, 1.5);
      break;
    }
    case 'senior': {
      const boss = a.bossId ? live(w, a.bossId) : undefined;
      if (!boss || peek(boss, a.id).trust < 0.45) return { lines: [`Nobody above ${a.isPlayer ? 'you' : first(a)} would put his name to this.`] };
      S.fear = clamp(S.fear + 0.12 + Math.max(0, rk(boss) - rk(t)) * 0.06); S.resolve = clamp(S.resolve - 0.1 + tp.pride * 0.05); S.anger = clamp(S.anger + tp.pride * 0.06);
      if (a.isPlayer) regard(w, boss, a, 'trust', -0.03, 'lean-on-me');
      know(w, s, boss.id, 2, 'was asked to weigh in');
      tell(w, s, `${boss.name} let it be known he is behind ${a.name} on this.`, { actor: boss.id, victim: t.id, witnesses: wit, minor: true });
      lines.push(`Word goes round that ${boss.name} is behind ${a.isPlayer ? 'you' : first(a)}.`);
      break;
    }
    case 'take': {
      if (S.last !== 'counter') return { lines: ['He hasn’t offered anything.'] };
      if (!a.isPlayer) lines.push(`${first(a)} takes his terms.`);
      else if (!t.isPlayer) lines.push(...speak(w, a, t, { ap: 'take', n, decision: 'yes', again: 0, cls: classOf(s), above: rk(t) > rk(a) })); // (he answers you taking his terms)
      noteConduct(a, 'deals');
      return finish(w, s, a, t, K, S, lines, false);
    }
    case 'wait':
      s.next = w.now + 4 * DAY; s.phase = 'waiting';
      lines.push(`${a.isPlayer ? 'You let' : `${first(a)} lets`} it sit a while.`);
      return { lines };
    case 'drop': {
      const seen = Object.keys(s.k ?? {}).length > 2;
      if (a.isPlayer && seen) repute(w, a, -1, 'dropped');
      tell(w, s, `${a.name} let the matter with ${t.name} drop.`, { actor: a.id, victim: t.id, minor: true });
      closeSit(w, s, 'dropped', [`${first(a)} walked away`], 4);
      lines.push(a.isPlayer ? 'You let it go.' : `${first(a)} lets it go.`);
      return { lines, closed: true };
    }
  }
  // (n for his words: how far into the matter you are, so each turn of it is said differently)
  return answer(w, s, a, t, K, S, lines, { ap: mv === 'name' ? 'ask' : mv === 'ask' && n > 1 ? 'again' : mv as Approach, n: Object.values(A.tried ?? {}).reduce((x, y) => x + y, 0) });
}

// How he answers. Several things at once: what it is worth to him, how afraid he is, how he feels about the man, how firmly he
// holds his ground. A trusted man can still be refused; a hated one can still be obeyed.
// (V90: said to the player, the answer is settled first and then put into words once (react.speak), from the same turn: the
// approach, his decision, his reason. `how` is how he was approached; without it (exchange.ts has already spoken for him) only the
// outcome is narrated.)
function answer(w: World, s: Situation, a: Character, t: Character, K: AskKind, S: Stance, lines: string[], how?: { ap: Approach; n: number }): Outcome {
  const v = K.lean(w, s, a, t), tp = temper(t);
  const toP = a.isPlayer && !t.isPlayer;
  const say = (decision: 'yes' | 'counter' | 'stall' | 'no' | 'help', o: { again?: number; reason?: string; terms?: string; coerced?: boolean } = {}) => { if (toP && how) lines.push(...speak(w, a, t, { ...how, decision, again: o.again ?? 0, cls: classOf(s), kind: s.ak, above: rk(t) > rk(a), claim: s.m?.claim ? String(s.m.claim) : undefined, ...o })); };
  // (Gate 2b: in a world running the conversation layer, the answer is that layer's decision, from the man's own perception; the
  // kind's weighing below is used only where no such decision exists)
  const D = w.social ? (DECIDERS.answer[s.ak ?? ''] ?? DECIDERS.answer['*'])?.(w, s, a, t) : undefined;
  const score = D ? 0 : v + S.fear * 0.7 * (1 - tp.courage * 0.6) + S.good * 0.45 - S.anger * 0.55 - S.resolve * 0.55 + jitter(w, s, 'ans' + tried(stance(w, s, a.id), 'ask'));
  if (D ? D.move === 'yes' : score > 0.12) { const coerced = S.fear > S.good + 0.1; say('yes', { coerced }); return finish(w, s, a, t, K, S, lines, coerced); }
  const kc = K.counter?.(w, s, a, t), c = D?.move === 'counter' && D.amt !== undefined ? { amt: D.amt, why: D.why ?? kc?.why ?? 'that is what I can do' } : kc;
  // an agreeable man looks for terms he could live with sooner than a proud one does
  if (c && S.last !== 'counter' && (D ? D.move === 'counter' : score > -0.12 - tp.agreeable * 0.14)) {
    S.last = 'counter'; s.m = { ...(s.m ?? {}), offer: c.amt };
    s.m.why = c.why; // the reason he gave, kept with the matter (what he said, not what is true)
    tell(w, s, K.low ? `${t.name} told ${a.name} what he wants instead: ${fmtOf(K, c.amt)}.` : `${t.name} offered ${a.name} ${money(c.amt)} instead.`, { actor: t.id, victim: a.id, minor: true });
    const terms = a.isPlayer && K.voice?.counter ? K.voice.counter(w, s, a, t) : K.phrase.counter.replace('{amt}', fmtOf(K, c.amt)).replace('{why}', c.why.charAt(0).toUpperCase() + c.why.slice(1));
    if (toP && how) say('counter', { terms }); else lines.push(terms);
    s.phase = 'counter'; s.next = w.now + 2 * DAY;
    giveReason(w, s, a, t, 'counter'); // (his terms carry his reason; it is the point in hand)
    return { answer: 'counter', lines };
  }
  // a man who already pays someone to stand behind him doesn't play for time: he sends for him
  // (V89 health: only when it is protection he is being asked for. A loan offer to a shop that pays someone used to bring the
  // protector in too, and the warnings that followed filled every negotiation slot in the city.)
  const b = s.biz ? w.biz[s.biz] : undefined;
  const backed = s.ak === 'protect' && !!b?.protection && b.protection.collectorId !== a.id && !!live(w, b.protection.collectorId);
  if (D ? D.move === 'stall' && tried(S, 'stalled') < 2 : !backed && S.fear > 0.35 && S.resolve < 0.6 && tried(S, 'stalled') < 2) {
    const before = tried(S, 'stalled'); bumpTried(S, 'stalled'); S.last = 'stall'; s.phase = 'stalled'; s.next = w.now + 3 * DAY;
    const why = giveReason(w, s, a, t, 'stall');
    if (toP) say('stall', { again: before, reason: before ? undefined : why ?? (K.voice?.stall ? K.voice.stall(w, s, a, t) : undefined) });
    else lines.push(K.phrase.stall);
    return { answer: 'stall', lines };
  }
  S.last = 'no'; s.phase = 'refused'; s.next = w.now + 2 * DAY;
  if (!tried(S, 'refusedRec')) { bumpTried(S, 'refusedRec'); bear(w, t, a.id, 0.05, `${a.name} wanted what he would not give`); }
  // refused before, he says so (the matter remembers); the first time, he says why, in his own way. To anyone but the player, in
  // the words of this kind of matter.
  const firstNo = !tried(S, 'no');
  // why he refuses, the first time: the point in hand from now on (his words for it are the kind's own, if it has them)
  const why = firstNo ? giveReason(w, s, a, t, 'no') ?? (toP && K.voice?.no ? K.voice.no(w, s, a, t) : undefined) : undefined;
  if (!toP) lines.push(K.phrase.no);
  { const x = K.onNo?.(w, s, a, t); if (x) lines.push(x); }
  // A man who is frightened or angry enough, or asked once too often, goes to someone.
  // (V90: only a man something is being demanded of goes to someone over it: nobody sends for his protector because he was
  // offered a loan, asked for one, or apologised to)
  if ((D ? D.move === 'help' : classOf(s) === 'demand' && (backed || S.fear + S.anger > 0.65 || tried(S, 'no') >= 2)) && !s.m?.help && Number(s.m?.depth ?? 0) < 2) {
    const h = seekHelp(w, s, a, t);
    if (h) { say('help', { again: tried(S, 'no'), reason: why }); lines.push(...h); return { answer: 'help', lines }; }
  }
  say('no', { again: tried(S, 'no'), reason: why });
  bumpTried(S, 'no');
  return { answer: 'no', lines };
}

// Gate 2b: who decides. In a world running the conversation layer (World.social), the answer to an ask and the asker's next move,
// for the kinds that layer covers (conv/deciders.ts), are its decisions: from each man's own perception, by the same rules whether the
// player or another man is asking. The ask carries them out exactly as before. Elsewhere, and in every world without the layer, the
// kinds' own weighing stands.
export interface Decided { move: Answer; amt?: number; why?: string }
export const DECIDERS: { answer: Record<string, (w: World, s: Situation, a: Character, t: Character) => Decided | undefined>; move: Record<string, (w: World, s: Situation, a: Character, t: Character) => AskMove | undefined> } = { answer: {}, move: {} };
export const askStance = (w: World, s: Situation, id: Id) => stance(w, s, id);
export const askTried = (S: Stance, k: string) => tried(S, k);

// Gate 2a: a yes decided elsewhere (the conversation layer's own decision, conv/respond.ts) carried out by the kind's own effects,
// exactly as any yes is: what agreeing to this kind of ask does in the world stays in one place.
export function agreeAsk(w: World, s: Situation): Outcome {
  const K = kindOf(s), a = asker(w, s), t = askee(w, s);
  if (!K || !a || !t || !isOpen(s)) return { lines: [], closed: true };
  return finish(w, s, a, t, K, stance(w, s, t.id), [], false);
}

// V90: he thinks again, on what has just been said (exchange.ts): the same decision as any answer, without a new move.
export function reconsider(w: World, s: Situation): Outcome {
  const K = kindOf(s), a = asker(w, s), t = askee(w, s);
  if (!K || !a || !t || !isOpen(s)) return { lines: [] };
  const S = stance(w, s, t.id);
  if (S.last === 'counter') S.last = undefined; // a fresh answer, not a second counter refused for being a repeat
  return answer(w, s, a, t, K, S, []); // (his words are the exchange's: only the outcome is narrated here)
}
function finish(w: World, s: Situation, a: Character, t: Character, K: AskKind, S: Stance, lines: string[], coerced: boolean): Outcome {
  if (s.m?.offer !== undefined && S.last === 'counter') s.terms!.amt = Number(s.m.offer);
  lines.push(K.yes(w, s, a, t));
  S.last = 'yes'; S.coerced = coerced; if (s.m?.beat) s.m.beat = '';
  // how he feels about it afterwards is part of the bargain: a frightened yes is resented, a willing one is not
  if (coerced) { bear(w, t, a.id, 0.12, `${a.name} forced his hand`); afterwards(w, s, a, t); }
  else if (a.isPlayer) regard(w, t, a, 'trust', 0.03, 'deal');
  else feel(w, t, a.id, 'trust', 0.03);
  closeSit(w, s, coerced ? 'gave in' : 'agreed', [coerced ? `${first(t)} agreed because he was afraid` : `${first(t)} agreed`], K.cool ?? 6);
  return { answer: 'yes', lines, closed: true };
}

// V90: a man who gave in out of fear does not leave it there, and what he does next is his temperament's, through the systems
// that already exist: he tells someone (a fact that travels as gossip and colours how others see the player), he turns to a friend
// in the life (whose grudge then counts in the retaliation the world already runs), or, proud and brave enough, he nurses it
// himself (the grudge that retaliation reads). A frightened man also tells the player less from now on (trust gates what he shares).
function afterwards(w: World, s: Situation, a: Character, t: Character) {
  const tp = temper(t), r = rel(t, a.id);
  feelOn(w, r, 'trust', -(0.04 - tp.caution * 0.04));
  const friend = Object.entries(t.rels).map(([id, x]) => ({ c: live(w, id), x })).filter((y) => y.c && !y.c.isPlayer && y.c.id !== a.id && y.x.trust > 0.35).sort((p, q) => (q.x.trust + q.x.affection) - (p.x.trust + p.x.affection))[0]?.c;
  // (between other men the same, without the talk: a story told about every frightened yes in the city would swamp the record)
  if (friend && a.isPlayer && tp.agreeable + tp.empathy + (1 - tp.pride) > 1.2) {
    addFact(w, { kind: 'threat', actor: a.id, victim: t.id, story: 'sit:' + s.id, business: s.biz, minor: false, text: `${t.name} told ${friend.name} that ${a.name} had squeezed him into it.`, district: t.district }, { witnesses: [friend.id] });
    if (friend.rank !== 'civilian') bear(w, friend, a.id, 0.04 + peek(friend, t.id).affection * 0.06, `${a.name} squeezed ${t.name}`);
  } else if (tp.pride > 0.6 && tp.courage > 0.5) bearOn(w, r, 0.08 + tp.volatility * 0.08, `${a.name} leaned on him`);
}

// ------------------------------------------------------------------ help
// Who a man turns to: whoever already protects him, the men of his own family who are in the life, close friends who are, another
// family glad of an excuse, or (a civilian with nobody) the police. Each of them acts with what they have, mostly by making an ask
// of their own of the man causing the trouble.
function seekHelp(w: World, s: Situation, a: Character, t: Character): string[] | undefined {
  const b = s.biz ? w.biz[s.biz] : undefined;
  const lines: string[] = [];
  const protector = b?.protection && b.protection.collectorId !== a.id ? live(w, b.protection.collectorId) : undefined;
  const kin = madeKin(w, t).filter((k) => k.id !== a.id && closeKin(w, t, k)).sort((x, y) => rk(y) - rk(x))[0];
  const friend = Object.entries(t.rels).map(([id, r]) => ({ c: live(w, id), r })).filter((x) => x.c && !x.c.isPlayer && x.c.id !== a.id && x.c.rank !== 'civilian' && x.r.affection > 0.55 && x.r.trust > 0.5).sort((x, y) => rk(y.c!) - rk(x.c!))[0]?.c;
  const helper = protector ?? kin ?? friend;
  s.m = { ...(s.m ?? {}), help: helper?.id ?? 'police' };
  if (helper?.isPlayer) {
    // he pays the player to stand behind him (or is the player's family): he comes to the player, and what the player does is up to him
    const h = openAsk(w, 'help', t, helper, { about: s.id, why: `${t.name} came to ${helper.name} about ${a.name}`, depth: Number(s.m?.depth ?? 0) + 1 });
    if (h) { h.next = w.now; tell(w, s, `${t.name} went to ${helper.name} about ${a.name}.`, { actor: t.id, victim: a.id, witnesses: [helper.id] }); }
    lines.push(`${first(t)} won’t be pushed. He is going to the man he pays.`);
    return lines;
  }
  if (helper) {
    const tie = kinTie(w, t, helper);
    const how = helper === protector ? 'the man he already pays' : tie ? `his ${tie}` : 'a friend';
    tell(w, s, `${t.name} went to ${helper.name}, ${how}, about ${a.name}.`, { actor: t.id, victim: a.id, witnesses: [helper.id] });
    (s.parties ??= []).push({ id: helper.id, role: 'helper' });
    know(w, s, helper.id, 2, 'was told');
    // he comes to the man making trouble, with an ask of his own: leave it alone
    const depth = Number(s.m?.depth ?? 0) + 1;
    const warn = openAsk(w, 'warn', helper, a, { about: s.id, why: `${t.name} asked ${helper.name} to make ${a.name} back off`, depth });
    if (warn) { warn.next = w.now + 1 * DAY; if (helper.familyId && a.familyId && helper.familyId !== a.familyId) tension(w, helper, a, 0.5); }
    // A man from another family who is asked to protect a shop sees an opening: his people will look after it, for less.
    if (b && s.ak === 'protect' && helper !== protector && helper.familyId && helper.familyId !== a.familyId && b.protection?.familyId !== helper.familyId) {
      const offer = openAsk(w, 'protect', helper, t, { biz: b.id, amt: Math.max(10, Math.round(feeOf(b) * 0.7 / 5) * 5), why: `${helper.name} offered to look after ${b.name} himself`, depth });
      if (offer) offer.m = { ...(offer.m ?? {}), against: s.id }; // a rival offer, made on purpose against the first one
      if (offer) { offer.next = w.now + 2 * DAY; stance(w, offer, t.id).good = clamp(stance(w, offer, t.id).good + 0.25); tell(w, s, `${helper.name}'s people let it be known that ${b.name} could be looked after by them.`, { actor: helper.id, victim: a.id, witnesses: [t.id] }); }
    }
    lines.push(`${first(t)} won’t be pushed. He has people, and he means to use them.`);
    return lines;
  }
  if (t.rank === 'civilian' && temper(t).caution > 0.5 && stance(w, s, t.id).fear > 0.35) {
    a.heat = clamp(a.heat + 0.25, 0, 1.5);
    tell(w, s, `${t.name} went to the police about ${a.name}.`, { actor: t.id, victim: a.id, witnesses: witnessesAt(w, t.district, [t.id, a.id], 2) });
    lines.push(`${first(t)} has had enough. Word is he talked to a cop.`);
    return lines;
  }
  return undefined;
}

// ------------------------------------------------------------------ the world moves
// Each open ask takes its next step when its clock comes round: an NPC asker makes his move; a man asked who has been left alone
// cools off; a superior who hears what his man is doing may have something to say.
function step(w: World, s: Situation) {
  const K = kindOf(s), a = asker(w, s), t = askee(w, s);
  if (!K || !a || !t) return closeSit(w, s, 'gone', [], 2);
  if (!K.valid(w, s)) return closeSit(w, s, 'moot', [], 2);
  superiors(w, s, a);
  if (!isOpen(s)) return;
  const S = stance(w, s, t.id);
  // time works on everyone: anger and fear fade a little; a man left alone softens or hardens by nature
  S.anger = clamp(S.anger - 0.03); S.fear = clamp(S.fear - 0.03);
  if (w.now - s.since > (K.ttl ?? 45) * DAY && s.terms?.by !== w.playerId) return closeSit(w, s, 'faded', [], 4);
  if (a.isPlayer) {
    // the player is asked through a request, if the man asked is waiting on him; otherwise the matter simply waits for him
    s.next = w.now + 3 * DAY;
    return;
  }
  if (t.isPlayer) return askPlayer(w, s, a, t, K);
  const mv = (w.social ? (DECIDERS.move[s.ak ?? ''] ?? DECIDERS.move['*'])?.(w, s, a, t) : undefined) ?? npcMove(w, s, a, t, S);
  move(w, s, mv);
  if (isOpen(s) && (s.next ?? 0) <= w.now) s.next = w.now + (2 + Math.floor((jitter(w, s, 'gap') + 0.08) * 25)) * DAY;
}
registerStep('ask', step);
// V89: a plan that is waiting on an ask (goals.ts) may take the asker's turn itself when it falls due, so a plan stepped on its own
// (as the tests do) still moves its ask along. The same step the daily tick takes; nothing extra.
export const askTurn = (w: World, s: Situation) => { if (isOpen(s) && (s.next ?? 0) <= w.now) step(w, s); };

// An NPC chooses his next move from who he is and how the last answer went.
function npcMove(w: World, s: Situation, a: Character, t: Character, S: Stance): AskMove {
  const T = a.traits, last = S.last, A = stance(w, s, a.id);
  const rounds = Object.values(A.tried ?? {}).reduce((x, y) => x + y, 0); // what he has put into it so far
  const K = kindOf(s)!;
  const offer = Number(s.m?.offer ?? 0), first0 = s.terms?.first ?? s.terms?.amt ?? 0;
  const fair = first0 && offer ? (K.low ? first0 / offer : offer / first0) : 1;
  const u: [AskMove, number][] = [
    ['ask', rounds === 0 ? 1 : last === 'stall' ? 0.45 : 0.05],
    ['take', last === 'counter' ? 0.25 + fair * 0.45 + T.caution * 0.2 - T.greed * 0.2 : -1],
    ['sweeten', last === 'counter' || last === 'no' ? (K.better?.(w, s) !== undefined ? 0.2 + T.caution * 0.2 - T.greed * 0.2 : -1) : -1],
    ['persuade', 0.15 + a.skills.charm * 0.35 + T.sociability * 0.15 - tried(A, 'persuade') * 0.2],
    ['pressure', 0.1 + T.violence * 0.35 + a.skills.nerve * 0.15 - tried(A, 'pressure') * 0.18],
    ['force', K.force && last === 'no' && tried(S, 'no') >= 1 ? T.violence * 0.6 - T.caution * 0.4 + (s.ak === 'protect' && tried(S, 'no') >= 2 && !tried(A, 'force') ? 0.15 : 0) - ((a.cooldown.restraint ?? 0) > w.now ? 1 : 0) : -1],
    ['leverage', leverageOf(w, a, t) && tried(A, 'leverage') === 0 ? 0.3 + T.caution * 0.2 : -1],
    ['wait', last === 'stall' ? 0.3 + T.caution * 0.3 : 0.05 + T.caution * 0.15],
    // a man told no again and again, or kept waiting for weeks, gives it up (or has already made his point by force)
    ['drop', 0.02 + T.caution * 0.2 + (rounds >= 7 ? 0.55 : rounds >= 5 ? 0.2 : 0) + (s.m?.help ? T.caution * 0.4 : 0) + (tried(S, 'no') >= 5 ? 0.7 : tried(S, 'no') >= 3 ? 0.35 : 0) + (w.now - s.since > 14 * DAY ? 0.4 : 0) - T.ambition * 0.12 - T.greed * 0.1],
  ];
  return u.filter(([m]) => !K.moves || K.moves.includes(m) || m === 'drop' || m === 'wait').map(([m, v]) => [m, v + jitter(w, s, m)] as [AskMove, number]).sort((x, y) => y[1] - x[1])[0][0];
}

// When the man is asking the player, the player is asked: once, with the same answers anyone has.
function askPlayer(w: World, s: Situation, a: Character, t: Character, K: AskKind, lead?: string[]) {
  if (s.ask && w.enc.some((e) => e.id === s.ask && e.status === 'open')) { s.next = w.now + DAY; return; }
  // the player named his own terms: he takes them, lets it go, or comes back with something else (V89)
  if (!s.ask && stance(w, s, t.id).last === 'counter') {
    const mv = npcMove(w, s, a, t, stance(w, s, t.id));
    if (mv === 'take') { move(w, s, 'take'); tell(w, s, `${a.name} took what ${t.name} offered.`, { actor: a.id, victim: t.id, witnesses: [t.id], minor: true }); return; }
    if (mv === 'drop') { move(w, s, 'drop'); return; }
    stance(w, s, t.id).last = 'no'; // he won't settle for it; he comes back to it below
  }
  if (s.ask) { // he asked and you said nothing: that is an answer too
    const S = stance(w, s, t.id); S.last = 'no'; bumpTried(S, 'no');
    delete s.ask;
    const mv = npcMove(w, s, a, t, S);
    if (mv === 'drop' || s.m?.once) { move(w, s, 'drop'); return; } // (a man who asks once, on a plan of his own, takes silence as no)
  }
  const S = stance(w, s, t.id);
  // (V90: your answers, as you would say them; what each does, in the hint)
  const opts = [{ code: 'yes', label: '“All right. You have it.”', hint: 'Do what he asks.' }, { code: 'no', label: '“No. I can’t do it.”', hint: 'Refuse. He will remember it.' }];
  if (K.counter && s.terms?.amt) opts.splice(1, 0, { code: 'counter', label: `“I can do ${fmtOf(K, playerCounter(K, s.terms.amt))}.”`, hint: K.low ? 'Ask more of him. Meet him part way.' : 'Name your own terms. Meet him part way.' });
  opts.push({ code: 'stall', label: '“Give me a few days.”', hint: 'Buy time. Not yes, not no. Not for ever.' });
  const e = addEnc(w, { kind: 'ask', from: a.id, title: K.title(w, s), days: 4, lines: lead ?? [...(s.m?.why ? [String(s.m.why)] : []), K.phrase.ask(w, s)], opts, data: { sit: s.id } });
  s.ask = e.id; s.next = e.expires; void S;
}
// An NPC puts an ask to the player now, in his own words the first time (the same answers as any later round).
export function putToPlayer(w: World, s: Situation, lead?: string[]) {
  const K = kindOf(s), a = asker(w, s), t = askee(w, s);
  if (K && a && t?.isPlayer && isOpen(s)) askPlayer(w, s, a, t, K, lead);
}

// The player answers an ask put to him (encounters.choose sends kind 'ask' here).
export function answerAsk(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const s = sits(w).find((x) => x.id === String(e.data?.sit));
  e.status = 'done';
  if (!s || !isOpen(s)) return { lines: ['It has already been settled.'], minutes: 5 };
  const K = kindOf(s)!, a = asker(w, s)!;
  const S = stance(w, s, p.id);
  delete s.ask;
  const above = rk(a) > rk(p);
  if (above) noteConduct(p, code === 'no' ? 'defied' : code === 'yes' && S.fear > 0.4 ? 'yielded' : 'deals', code === 'stall' ? 0.3 : 1);
  else if (code === 'counter') noteConduct(p, 'deals');
  if (code === 'yes') {
    const cant = K.cant?.(w, s, p);
    if (cant) { S.last = 'stall'; s.next = w.now + DAY; return { lines: [cant], minutes: 5 }; } // willing, but not able: it stays open
    const o = finish(w, s, a, p, K, S, [], false); return { lines: o.lines, minutes: 20 };
  }
  if (code === 'counter') { const amt = playerCounter(K, s.terms?.amt ?? 0); S.last = 'counter'; s.m = { ...(s.m ?? {}), offer: amt }; tell(w, s, `${p.name} offered ${a.name} ${money(amt)} instead.`, { actor: p.id, victim: a.id, minor: true }); s.next = w.now + DAY; return { lines: [`You offer ${money(amt)}. ${first(a)} says he will think about it.`], minutes: 20 }; }
  if (code === 'stall') { S.last = 'stall'; bumpTried(S, 'stalled'); s.next = w.now + 3 * DAY; return { lines: [`You tell ${first(a)} you need a few days. He gives you them, and no more.`], minutes: 15 }; }
  S.last = 'no'; bumpTried(S, 'no'); bear(w, a, p.id, 0.06, `${p.name} turned him down`);
  tell(w, s, `${p.name} turned ${a.name} down.`, { actor: p.id, victim: a.id, minor: true });
  { const x = K.onNo?.(w, s, a, p); if (x) { if (K.keepOnNo) s.next = w.now + 2 * DAY; else closeSit(w, s, 'refused', [`${first(p)} said no`], K.cool ?? 6); return { lines: [`You tell ${first(a)} no.`, x], minutes: 15 }; } }
  if (s.m?.once) { closeSit(w, s, 'refused', [`${first(p)} said no`], K.cool ?? 6); return { lines: [`You tell ${first(a)} no. He nods, and he won’t ask you again.`], minutes: 15 }; }
  s.next = w.now + 2 * DAY;
  return { lines: [`You tell ${first(a)} no. He doesn’t like it, and he doesn’t pretend to.`], minutes: 15 };
}

// ------------------------------------------------------------------ the men above
// A superior who learns that his man has brought the police, another family or open violence into a matter forms a view of it, once.
function superiors(w: World, s: Situation, a: Character) {
  const boss = a.bossId ? live(w, a.bossId) : undefined;
  if (!boss || s.m?.rx) return;
  const bad = Object.keys(boss.known).map((id) => w.facts[id]).filter((f) => f && f.story === 'sit:' + s.id && (/police|went to/.test(f.text) || f.kind === 'vandalism'));
  if (!bad.length) return;
  s.m = { ...(s.m ?? {}), rx: boss.id };
  const messy = bad.some((f) => /police/.test(f.text)) || !!s.m.help;
  if (a.isPlayer) {
    regard(w, boss, a, 'trust', messy ? -0.07 : -0.03, 'trouble');
    if (messy) repute(w, a, -2, 'trouble');
    const e = addEnc(w, { kind: 'word', from: boss.id, about: s.terms?.of, title: `${first(boss)} wants a word about ${titleOf(w, s)}`, days: 5,
      lines: [`${boss.name} has heard about ${titleOf(w, s).toLowerCase()}.`, messy ? '"You brought trouble to my door. Explain it to me."' : '"I hear you’re making noise. I don’t like noise."'],
      opts: [{ code: 'explain', label: 'Explain yourself', hint: 'Tell him how it is. He may or may not like it.' }, { code: 'sorry', label: 'Say it won’t happen again', hint: 'Swallow it. He’ll want you to mean it.' }], data: { sit: s.id } });
    void e;
  } else {
    feel(w, boss, a.id, 'trust', -((messy ? 0.06 : 0.02)));
    if (messy && boss.traits.caution > 0.5) { tell(w, s, `${boss.name} told ${a.name} to leave it alone.`, { actor: boss.id, victim: a.id, minor: true }); closeSit(w, s, 'called off', [`${first(boss)} called it off`], 6); }
  }
}
export const titleOf = (w: World, s: Situation) => kindOf(s)?.title(w, s) ?? s.cause;
export function answerWord(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const boss = e.from ? w.chars[e.from] : undefined;
  e.status = 'done';
  if (!boss) return { lines: ['He has moved on to other things.'], minutes: 5 };
  const s = sits(w).find((x) => x.id === String(e.data?.sit));
  noteConduct(p, code === 'sorry' ? 'yielded' : 'defied', 0.5); // (backing down to the boss, or standing by what you did)
  if (code === 'sorry') {
    regard(w, boss, p, 'trust', 0.02, 'apology');
    if (s && isOpen(s) && s.terms?.by === p.id) { tell(w, s, `${p.name} told ${boss.name} it would not happen again.`, { actor: p.id, victim: boss.id, minor: true }); closeSit(w, s, 'called off', [`${first(boss)} made you drop it`], 6); }
    return { lines: [`${first(boss)} looks at you a long moment. "Good. Then it’s finished." You let the matter go.`], minutes: 30 };
  }
  // explaining is a gamble on how he sees you and how well you argue
  const ok = peek(boss, p.id).trust * 0.6 + p.skills.charm * 0.4 + boss.traits.ambition * 0.2 - boss.traits.caution * 0.3 > 0.35;
  if (ok) { regard(w, boss, p, 'respect', 0.03, 'explained'); return { lines: [`You lay it out. ${first(boss)} hears you to the end. "All right. But finish it quietly."`], minutes: 30 }; }
  regard(w, boss, p, 'trust', -0.04, 'explained'); repute(w, p, -1, 'explained');
  return { lines: [`You lay it out. ${first(boss)} doesn’t like the sound of it. "I didn’t ask for a story. Fix it."`], minutes: 30 };
}

// ------------------------------------------------------------------ what the player can do in a matter he is pursuing
export interface PlayerMove { move: AskMove; label: string; hint: string; off?: string }
export function playerMoves(w: World, p: Character, s: Situation): PlayerMove[] {
  const K = kindOf(s), t = askee(w, s);
  if (!K || !t || s.terms?.by !== p.id || !isOpen(s)) return [];
  const S = stance(w, s, t.id);
  const out: PlayerMove[] = [];
  const done = (m: string) => (p.cooldown[`askmv:${s.id}:${m}`] ?? -1) >= Math.floor(w.now / DAY);
  const add = (move: AskMove, label: string, hint: string, off?: string) => (K.moves && !K.moves.includes(move)) || out.push({ move, label, hint, off: off ?? (done(move) ? 'You’ve tried that today.' : undefined) });
  // (V90: each is what you would say; the hint says what it does)
  const q = (x: string) => (/^[“"]/.test(x) ? x : `“${x}”`);
  if (S.last === 'counter') { const f = fmtOf(K, Number(s.m?.offer ?? 0)); add('take', K.take ? K.take(f) : q(`All right. ${f}${s.ak === 'protect' ? ' a week' : ''}.`), 'Settle on his terms.'); }
  if (!S.last || S.last === 'stall') add('ask', S.last === 'stall' ? '“Have you thought it over?”' : K.askLabel?.(w, s) ?? q(K.phrase.ask(w, s)), S.last === 'stall' ? 'He asked for time. Has he had enough?' : 'Put your terms to him plainly.');
  // (before he has heard your terms there is nothing to argue with or answer by force: you make the offer, or you don't)
  if (!S.last) { add('drop', '“Never mind. Forget I said anything.”', 'Walk away before it starts.'); return out; }
  const better = K.better?.(w, s);
  add('sweeten', better !== undefined ? K.sweeten?.(better) ?? q(`Call it ${money(better)}.`) : '“I can do better.”', K.low ? 'More from you, easier for him.' : 'Less for you, easier for him.', better === undefined ? (K.low ? 'You can’t go higher.' : 'You can’t go lower.') : undefined);
  add('persuade', s.ak === 'protect' ? '“Think about it. Who looks after you if something happens?”' : s.ak === 'amends' ? '“I was wrong. I want it put right between us.”' : s.ak === 'layoff' || s.ak === 'warn' ? '“He’s got enough trouble. Leave him be.”' : '“Be sensible. This is good for both of us.”', tried(S, 'persuade') >= 2 ? 'He’s heard your arguments.' : 'Reason with him.');
  const lv = leverageOf(w, p, t);
  add('leverage', lv ? q(`I know about ${lv.what}.`) : '“I know things about you.”', lv ? 'Remind him what you know. He won’t thank you for it.' : 'You need something on him first.', lv ? undefined : 'You have nothing on him.');
  // (what the player may do, and has the means to: a man above him in his own family is pressed at the player's own cost, and never
  // touched; "the boys" are men he actually has)
  const R = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'], above = t.familyId === p.familyId && R.indexOf(t.rank) > R.indexOf(p.rank), madeOfOurs = t.familyId === p.familyId && R.indexOf(t.rank) >= 2;
  const boys = Object.values(w.chars).some((c) => c.alive && c.bossId === p.id && c.jailedUntil <= w.now);
  add('pressure', s.ak === 'protect' ? '“It’d be a shame if something happened to the place.”' : s.ak === 'collect' ? '“I’d hate for this to get ugly.”' : above ? '“I’m asking you to think about it. Carefully.”' : '“I’d think hard before saying no to me.”', above ? 'He outranks you. He will remember being leaned on by you.' : 'Lean on him. Fear works. So does resentment, later.');
  if (K.force && tried(S, 'no') >= 1) add('force', s.ak === 'protect' ? (boys ? 'Send the boys in to wreck the place' : 'Wreck the place yourself') : boys ? 'Have him taught a lesson' : 'Teach him a lesson yourself', 'Make an example. Loud, and it will be talked about.', madeOfOurs && p.rank !== 'boss' ? 'He’s a made man of your own family. Nobody lays a hand on him without the boss’s say.' : undefined);
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  add('senior', boss ? q(`${first(boss)} is behind this, you know.`) : '“There are people behind this.”', 'Bring in your boss’s name. It costs you with him.', !boss || peek(boss, p.id).trust < 0.45 ? 'Nobody above you would put his name to this.' : undefined);
  add('drop', '“Forget it.”', 'Let it go. People notice.');
  return out;
}
// The player names his own figure (and, for a loan, the weekly rate), within what the kind allows, and puts it to him.
export function nameFigure(w: World, p: Character, sid: Id, amt: number, rate?: number): { lines: string[]; minutes: number } {
  const s = sits(w).find((x) => x.id === sid), K = s ? kindOf(s) : undefined, f = s && K?.figure?.(w, s);
  if (!s || !K || !f || s.terms?.by !== p.id || !isOpen(s)) return { lines: ['There is nothing to put a figure to.'], minutes: 5 };
  if (!Number.isFinite(amt)) amt = s.terms?.amt ?? f.min; // (nothing typed: the figure already on the table)
  const v = Math.round(clamp(amt, f.min, f.max) / f.step) * f.step;
  if ((p.cooldown[`askmv:${s.id}:name`] ?? -1) >= Math.floor(w.now / DAY)) return { lines: ['He has heard your figure today. Let it sit, or take what he said.'], minutes: 0 };
  p.cooldown[`askmv:${s.id}:name`] = Math.floor(w.now / DAY);
  { const v0 = Math.round(clamp(amt, f.min, f.max) / f.step) * f.step, no = K.short?.(w, s, p, v0); if (no) return { lines: [no], minutes: 0 }; } // (he can't put it up: nothing changes)
  s.terms!.amt = v;
  if (f.rate && rate !== undefined && Number.isFinite(rate)) s.terms!.rate = Math.round(clamp(rate, f.rate.min, f.rate.max) * 100) / 100;
  const o = move(w, s, 'name');
  return { lines: o.lines, minutes: 25 };
}
export function playerMove(w: World, p: Character, sid: Id, mv: AskMove): { lines: string[]; minutes: number } {
  const s = sits(w).find((x) => x.id === sid);
  if (!s) return { lines: ['There is nothing to talk about.'], minutes: 5 };
  p.cooldown[`askmv:${s.id}:${mv}`] = Math.floor(w.now / DAY);
  const o = move(w, s, mv);
  return { lines: o.lines, minutes: mv === 'force' ? 60 : mv === 'wait' || mv === 'drop' ? 5 : 30 };
}
// The words for how a man stands, as the player can read him (never the numbers).
export function read(w: World, s: Situation, id: Id): string {
  const S = stance(w, s, id);
  const bits: string[] = [];
  if (S.fear > 0.55) bits.push('frightened'); else if (S.fear > 0.3) bits.push('uneasy');
  if (S.anger > 0.55) bits.push('angry'); else if (S.anger > 0.3) bits.push('resentful');
  if (S.resolve > 0.65) bits.push('dug in'); else if (S.resolve < 0.3) bits.push('wavering');
  if (S.good > 0.5) bits.push('well disposed to you');
  return bits.length ? bits.join(', ') : 'giving nothing away';
}

// ================================================================== the kinds
// ---------------------------------------------------------------- protection: a shop asked to pay
const feeOf = (b: Business) => Math.max(15, Math.round((b.income * 0.08) / 5) * 5);
ASKS.protect = {
  id: 'protect', sev: 0.25, roles: ['collector', 'owner'],
  title: (w, s) => `Protection at ${w.biz[s.biz!]?.name ?? 'the shop'}`,
  valid: (w, s) => { const b = s.biz ? w.biz[s.biz] : undefined; return !!b?.open && b.ownerId === s.terms?.of && b.protection?.collectorId !== s.terms?.by; },
  lean: (w, s, a, t) => {
    const b = w.biz[s.biz!], fee = s.terms?.amt ?? feeOf(b);
    const afford = clamp(1 - fee / Math.max(20, b.income * 0.15), -1, 1); // can he carry it
    const covered = b.protection && b.protection.collectorId !== a.id ? -0.45 : 0; // he already pays someone
    const street = Object.keys(t.known).filter((id) => { const f = w.facts[id]; return f && f.kind === 'vandalism' && f.district === b.district && w.now - f.t < 21 * DAY; }).length;
    const before = changedSince(w, b, a) ? 0 : -0.1; // he has sent this man away before, and nothing has changed since
    return afford * 0.35 + covered + Math.min(0.25, street * 0.06) + before - 0.2;
  },
  yes: (w, s, a, t) => {
    const b = w.biz[s.biz!], fee = s.terms?.amt ?? feeOf(b), prev = b.protection;
    if (b.refused?.[a.id]) delete b.refused[a.id];
    setCollector(w, b, a.id, a.familyId!, { fee });
    if (prev && prev.collectorId !== a.id && w.chars[prev.collectorId]) {
      const pc = w.chars[prev.collectorId];
      const f = addFact(w, { kind: 'poach', actor: a.id, victim: pc.id, business: b.id, story: 'sit:' + s.id, text: `${a.name} (${famName(w, a)}) took ${b.name} from ${pc.name} (${famName(w, pc)}).`, district: b.district }, { witnesses: [t.id] });
      b.informPrev = { who: pc.id, fact: f.id };
      tension(w, a, pc, 2);
      return `${t.name} will pay ${money(fee)} a week, to ${a.isPlayer ? 'you' : first(a)} now. ${pc.name} will hear of it.`;
    }
    const rec = (a.career ??= { done: 0, failed: 0, log: [] }); rec.rough = (rec.rough ?? 0) + 1; // (rough work of his own: career.ts reads it as proof of him)
    addFact(w, { kind: 'protection_started', actor: a.id, victim: t.id, business: b.id, amount: fee, story: 'sit:' + s.id, text: `${a.name} now collects ${money(fee)} a week from ${b.name}.`, district: b.district }, { witnesses: witnessesAt(w, b.district, [a.id, t.id], 2) });
    return `${t.name} agrees to ${money(fee)} a week.`;
  },
  counter: (w, s, a, t) => {
    const b = w.biz[s.biz!], fee = s.terms?.amt ?? feeOf(b);
    if (b.protection && b.protection.collectorId !== a.id) return undefined; // he isn't haggling, he's taken
    const can = Math.round(Math.min(fee * 0.75, b.income * 0.05) / 5) * 5;
    if (can < 10 || can >= fee) return undefined;
    return { amt: can, why: b.distress > 0 || b.cash < 250 ? 'business is bad' : 'that’s what the place can carry' };
  },
  better: (w, s) => { const b = w.biz[s.biz!], fee = s.terms?.amt ?? feeOf(b), floor = Math.round(feeOf(b) * 0.5 / 5) * 5; const next = Math.round(fee * 0.8 / 5) * 5; return next >= floor && next < fee ? next : undefined; },
  force: (w, s, a, t) => {
    const b = w.biz[s.biz!];
    b.damaged = Math.max(b.damaged, 2); bizMove(w, b, -150, 'damage');
    a.cooldown.restraint = w.now + 10 * DAY;
    const f = tell(w, s, `${a.name}'s people smashed up ${b.name} after ${t.name} refused to pay.`, { kind: 'vandalism', actor: a.id, victim: t.id, witnesses: witnessesAt(w, b.district, [a.id, t.id], 3) });
    if (s.m?.refusal && w.facts[String(s.m.refusal)]) f.cause = String(s.m.refusal);
    notifyProtector(w, b, f);
    return `Chairs break, glass goes. ${b.name} will be shut a while.`;
  },
  // a refusal is an event in the world like any other (the first one is news; after that it is the same story going on)
  // (V89 health: only the first refusal is recorded as a refusal. Each one used to add to the collector's grudge, so three
  // no's in one negotiation made him beat the shopkeeper; repeats are now told as the same story going on.)
  onNo: (w, s, a, t) => {
    const b = w.biz[s.biz!];
    const f = tell(w, s, `${t.name} told ${a.name} to get out of ${b.name}.`, { kind: s.m?.refusal ? 'rumour' : 'protection_refused', actor: t.id, victim: a.id, witnesses: witnessesAt(w, b.district, [a.id, t.id], 2), minor: !!s.m?.refusal });
    if (!s.m?.refusal) noteRefusal(w, b, a); // the shop remembers whom it turned away
    s.m = { ...(s.m ?? {}), refusal: s.m?.refusal ?? f.id };
    return undefined;
  },
  phrase: {
    ask: (w, s) => { const b = w.biz[s.biz!]; return `${money(s.terms?.amt ?? feeOf(b))} a week, and nothing happens to ${b.name}.`; },
    yes: 'He agrees.', no: '“No. Get out of my shop.”', counter: '“I can do {amt} a week. Not a cent more. {why}.”', stall: '“Come back Friday. I need to think.”',
  },
};
// ---------------------------------------------------------------- warning a man off
ASKS.warn = {
  id: 'warn', sev: 0.35, roles: ['warns', 'warned'], ttl: 12, max: 12,
  title: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); const ot = o ? askee(w, o) : undefined; return ot ? `Leave ${first(ot)} alone` : 'A warning'; },
  valid: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); return !!o && isOpen(o); },
  lean: (w, s, a, t) => {
    const o = sits(w).find((x) => x.id === String(s.m?.about));
    const want = o ? stance(w, o, t.id).resolve : 0.5; // how much he wants the thing he is being warned off
    const outranked = (rk(a) - rk(t)) * 0.15;
    const sameFam = a.familyId && a.familyId === t.familyId ? 0.15 : 0;
    return outranked + sameFam - want * 0.4 + 0.4; // (V89 health: was +0.05; almost every warning was refused and half of them ended in a beating)
  },
  yes: (w, s, a, t) => {
    const o = sits(w).find((x) => x.id === String(s.m?.about));
    if (o && isOpen(o)) { tell(w, o, `${t.name} backed off after ${a.name} had a word.`, { actor: t.id, victim: a.id, minor: true }); closeSit(w, o, 'warned off', [`${first(a)} made ${first(t)} back off`], 8); }
    if (t.isPlayer) regard(w, a, t, 'respect', 0.02, 'backoff'); else feel(w, a, t.id, 'respect', 0.02);
    // the man he stood up for owes him for it (V89: a favour like any other, which can be called in)
    const helped = o ? askee(w, o) : undefined;
    if (helped && helped.id !== a.id && !a.isPlayer && !helped.isPlayer) npcFavour(w, a, helped, `making ${t.name} back off`);
    return `${t.isPlayer ? 'You back' : `${first(t)} backs`} off.`;
  },
  force: (w, s, a, t) => {
    t.hurtUntil = Math.max(t.hurtUntil, w.now + 3 * DAY);
    tell(w, s, `${a.name}'s people roughed up ${t.name} to make the point.`, { kind: 'beating', actor: a.id, victim: t.id, witnesses: witnessesAt(w, t.district, [a.id, t.id], 2) });
    if (a.familyId && t.familyId && a.familyId !== t.familyId) tension(w, a, t, 1);
    return `${t.isPlayer ? 'You are' : `${first(t)} is`} roughed up, to make the point.`;
  },
  phrase: {
    ask: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); const ot = o ? askee(w, o) : undefined; return `"${ot ? first(ot) : 'He'} is with me. Leave it alone."`; },
    yes: 'He backs off.', no: '“It’s none of your business.”', counter: '', stall: '“I’ll think about it.”',
  },
};
// ---------------------------------------------------------------- a debt that is due
ASKS.collect = {
  id: 'collect', sev: 0.2, roles: ['creditor', 'debtor'], cool: 0,
  title: (w, s) => { const t = askee(w, s); return t ? `What ${first(t)} owes` : 'A debt'; },
  valid: (w, s) => { const d = w.debts.find((x) => x.id === String(s.m?.debt)); return !!d && (d.status === 'active' || d.status === 'defaulted') && d.balance > 0; },
  lean: (w, s, a, t) => {
    const amt = s.terms?.amt ?? 0, b = ownerBiz(w, t.id);
    const can = t.cash + Math.max(0, (b?.cash ?? 0) - 200);
    return clamp(can / Math.max(1, amt) - 1, -1, 0.6) * 0.5 - 0.05;
  },
  yes: (w, s, a, t) => { const d = w.debts.find((x) => x.id === String(s.m?.debt))!; const amt = Math.min(d.balance, s.terms?.amt ?? d.weeklyPayment); payDebt(w, d, amt); return `${t.isPlayer ? 'You pay' : `${first(t)} pays`} ${money(amt)}.`; },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? 0, can = Math.round(Math.max(0, t.cash - 40) * 0.8 / 5) * 5; return can >= 10 && can < amt ? { amt: can, why: 'it’s all I have right now' } : undefined; },
  better: (w, s) => { const d = w.debts.find((x) => x.id === String(s.m?.debt)); if (!d || (s.terms?.amt ?? 0) <= d.weeklyPayment * 0.5) return undefined; return Math.max(5, Math.round((s.terms?.amt ?? 0) * 0.7 / 5) * 5); },
  force: (w, s, a, t) => {
    t.hurtUntil = Math.max(t.hurtUntil, w.now + 3 * DAY);
    const d = w.debts.find((x) => x.id === String(s.m?.debt));
    const take = Math.min(Math.max(0, t.cash - 20), d?.balance ?? 0);
    if (d && take > 0) payDebt(w, d, take);
    tell(w, s, `${a.name} had ${t.name} beaten over what he owes.`, { kind: 'beating', actor: a.id, victim: t.id, witnesses: witnessesAt(w, t.district, [a.id, t.id], 2) });
    return `${t.isPlayer ? 'You take' : `${first(t)} takes`} a beating${take ? `, and ${money(take)} comes out of his pockets` : ''}.`;
  },
  phrase: {
    ask: (w, s) => `"You owe. ${money(s.terms?.amt ?? 0)}, today."`,
    yes: 'He pays.', no: '“I don’t have it.”', counter: '“I can give you {amt}. {why}.”', stall: '“Friday. I swear to God, Friday.”',
  },
};
// When the debt itself is in arrears, a creditor who wants his money has a matter with the man.
export function collectAsk(w: World, a: Character, d: import('./types').Debt): Situation | undefined {
  const t = live(w, d.debtor);
  if (!t) return undefined;
  const amt = Math.min(d.balance, d.weeklyPayment * Math.max(1, d.missed + 1));
  const s = openAsk(w, 'collect', a, t, { amt, why: `${t.name} is behind with what he owes ${a.name}` });
  if (s) s.m = { ...(s.m ?? {}), debt: d.id };
  return s;
}
// ---------------------------------------------------------------- a man asking for help (the player is the one asked)
ASKS.help = {
  id: 'help', sev: 0.3, roles: ['asks', 'helper'], cool: 4,
  title: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); const trouble = o ? asker(w, o) : undefined; const t = asker(w, s); return t && trouble ? `${first(t)} wants help with ${first(trouble)}` : 'Someone wants help'; },
  valid: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); return !!o && isOpen(o); },
  lean: () => 0, // only ever put to the player, who decides for himself
  yes: (w, s, a, t) => {
    const o = sits(w).find((x) => x.id === String(s.m?.about))!;
    const trouble = asker(w, o)!;
    const warn = openAsk(w, 'warn', t, trouble, { about: o.id, why: `${t.name} said he would make ${trouble.name} back off`, depth: Number(s.m?.depth ?? 0) });
    if (a.rank === 'civilian') { if (t.isPlayer) regard(w, a, t, 'trust', 0.05, 'help'); }
    tell(w, o, `${t.name} told ${a.name} he would deal with ${trouble.name}.`, { actor: t.id, victim: trouble.id, witnesses: [a.id] });
    void warn;
    return `${t.isPlayer ? 'You tell him' : `${first(t)} tells him`} it will be handled. Now ${first(trouble)} has to be told.`;
  },
  onNo: (w, s, a, t) => {
    // a man who pays for protection and doesn't get it remembers, and stops being sure what he is paying for
    bear(w, a, t.id, 0.15, `${t.name} took his money and did not look after him`);
    feel(w, a, t.id, 'trust', -0.15);
    const o = sits(w).find((x) => x.id === String(s.m?.about));
    if (o && isOpen(o)) { const S = stance(w, o, a.id); S.resolve = clamp(S.resolve - 0.2); S.fear = clamp(S.fear + 0.1); }
    const b = o?.biz ? w.biz[o.biz] : undefined;
    if (b?.protection?.collectorId === t.id) b.protection.late = (b.protection.late ?? 0) + 1;
    return `${first(a)} looks at you as if he had paid for something and been handed nothing. He will be late with his next envelope, and he won’t be in a hurry to say sorry.`;
  },
  phrase: {
    ask: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); const trouble = o ? asker(w, o) : undefined; return `"${trouble ? trouble.name : 'Somebody'} has been at my door. I pay you so this doesn’t happen."`; },
    yes: '', no: '', counter: '', stall: '',
  },
};
// ---------------------------------------------------------------- asking a man for a loan
ASKS.borrow = {
  id: 'borrow', sev: 0.15, roles: ['borrower', 'lender'], cool: 2,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'leverage', 'wait', 'drop'], sweeten: (amt) => `Ask for ${money(amt)} instead`,
  title: (w, s) => { const t = askee(w, s); return t ? `A loan from ${first(t)}` : 'A loan'; },
  valid: (w, s) => !!askee(w, s) && !!asker(w, s),
  lean: (w, s, a, t) => {
    const amt = s.terms?.amt ?? 0, pos = loanPosition(w, t, a, amt);
    const family = kinTie(w, t, a) ? 0.2 : 0;
    if (pos.refuse === 'cash') return -0.8;
    if (pos.refuse === 'trust') return -0.45 + family;
    return (pos.can >= amt * 0.95 ? 0.3 : 0) + family;
  },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? 0, pos = loanPosition(w, t, a, amt); return !pos.refuse && pos.can >= 150 && pos.can < amt ? { amt: pos.can, why: 'that’s what I can spare' } : undefined; },
  better: (w, s) => { const amt = s.terms?.amt ?? 0, next = Math.round(amt * 0.7 / 50) * 50; return next >= 150 && next < amt ? next : undefined; },
  yes: (w, s, a, t) => {
    // (the rate agreed in the talk, when there was one, is the rate: what was shaken on is what is owed)
    const amt = Math.min(s.terms?.amt ?? 0, Math.floor(t.cash * 0.6)), pos0 = loanPosition(w, t, a, amt), pos = s.terms?.rate ? { ...pos0, rate: s.terms.rate } : pos0;
    transfer(w, t, a, amt, 'loan', 'a loan');
    const d = createDebt(w, t.id, a.id, amt, pos.rate, a.isPlayer ? 'a loan to you' : 'a private loan');
    const f = addFact(w, { kind: 'loan', actor: t.id, victim: a.id, amount: amt, story: 'sit:' + s.id, text: `${t.name} lent ${a.name} ${money(amt)}.`, district: t.district });
    d.cause = f.id;
    if (a.isPlayer) t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: a.id, kind: 'agreement', text: `You borrowed ${money(amt)} from him at ${Math.round(pos.rate * 100)}% a week.` });
    return a.isPlayer ? vsay(w, t, a, 'loan_yes') : `${first(t)} counts out ${money(amt)}. ${Math.round(pos.rate * 100)}% a week, and he will want it on time.`;
  },
  voice: {
    no: (w, s, a, t) => vsay(w, t, a, loanPosition(w, t, a, s.terms?.amt ?? 0).refuse === 'trust' ? 'loan_trust' : 'loan_cash'),
    counter: (w, s, a, t) => vsay(w, t, a, 'loan_counter', { X: money(s.terms?.amt ?? 0), Y: money(Number(s.m?.offer ?? 0)) }),
  },
  phrase: {
    ask: (w, s) => `${money(s.terms?.amt ?? 0)}, on the usual terms.`,
    yes: 'He lends it.', no: '“I can’t do it.”', counter: '“I can do {amt}. {why}.”', stall: '“Let me see what I have. Come back in a few days.”',
  },
};
// ---------------------------------------------------------------- offering a man a loan
// Stage 4: the weekly rate is a term of the offer. Named by the lender when he makes it; otherwise his own: a greedy, hard man asks
// more, a friend less.
export function lendRate(s: Situation, a: Character): number {
  if (s.terms?.rate !== undefined) return s.terms.rate;
  return Math.round((0.03 + a.traits.greed * 0.03 + a.traits.violence * 0.01) * 100) / 100;
}
ASKS.lend = {
  id: 'lend', sev: 0.12, roles: ['lender', 'borrower'], cool: 2, ttl: 7, max: 8,
  moves: ['take', 'ask', 'persuade', 'wait', 'drop'],
  title: (w, s) => { const t = askee(w, s); return t ? `A loan to ${first(t)}` : 'A loan'; },
  valid: (w, s) => { const a = asker(w, s); return !!a && a.cash >= (s.terms?.amt ?? 0) && !w.debts.some((d) => d.status === 'active' && d.debtor === s.terms?.of && d.creditor === s.terms?.by); },
  lean: (w, s, a, t) => {
    const b = ownerBiz(w, t.id);
    const need = b && (b.cash < 250 || b.distress > 0) ? 0.35 : t.cash < 150 ? 0.25 : 0;
    // Stage 4: the price of the money is part of the offer: dear money puts off a man who doesn't need it, less one who does
    const dear = Math.max(0, lendRate(s, a) - 0.04) * (need >= 0.25 ? 2 : 6);
    // (a man who doesn't need money doesn't borrow it at a vig; and nobody wants to owe the man who has just been leaning on him)
    const resent = viewOf(w, t, a).resent;
    return need > 0 ? need + (1 - t.traits.caution) * 0.15 + 0.4 - dear - resent * 0.5 : (1 - t.traits.caution) * 0.1 - 0.15 - dear - resent * 0.5;
  },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? 0, b = ownerBiz(w, t.id); return amt >= 1000 && !(b && b.distress > 0) ? { amt: 500, why: 'I don’t need more than that' } : undefined; },
  yes: (w, s, a, t) => {
    const amt = s.terms?.amt ?? 0, rate = lendRate(s, a), b = s.biz ? w.biz[s.biz] : undefined;
    // (money lent for a business goes into the business: econ.bizMove keeps its books; to the man himself, core.transfer)
    if (b && b.open && b.ownerId === t.id) { a.cash -= amt; bizMove(w, b, amt, 'aid', a.id); b.distress = 0; } else transfer(w, a, t, amt, 'loan', 'a loan'); // (to a business)
    const d = createDebt(w, a.id, t.id, amt, rate, b ? 'business loan' : 'a private loan');
    const f = addFact(w, { kind: 'loan', actor: a.id, victim: t.id, amount: amt, story: 'sit:' + s.id, text: `${a.name} lent ${t.name} ${money(amt)}.`, district: t.district });
    d.cause = f.id;
    return `${t.name} takes the ${money(amt)}. ${money(d.weeklyPayment)} a week, ${Math.round(rate * 100)} percent on top. He shakes on it and holds ${a.isPlayer ? 'your' : 'his'} hand a second too long.`;
  },
  // (what the lender says to his face: "if you need it")
  askLabel: (w, s) => `“${money(s.terms?.amt ?? 0)}, if you need it. ${Math.round((s.terms?.rate ?? 0.05) * 100)} percent a week.”`,
  phrase: {
    ask: (w, s) => `${money(s.terms?.amt ?? 0)}, if he needs it. ${Math.round((s.terms?.rate ?? 0.05) * 100)} percent a week.`,
    yes: 'He takes it.', no: '“Thanks. I’d rather not owe anybody.”', counter: '“{amt} would do it. {why}.”', stall: '“Let me think about it.”',
  },
};

// ================================================================== V89: the interactions converted from one-shot rolls
// Each was a single roll followed by a lockout. Now each is an ask: the first answer is not the last word, the man asked answers
// from what he has and wants, his counter gives a reason that is true of him, and the asker can come back with something else.

// A man refusing the same thing again does not say it the same way twice.
const again = (w: World, s: Situation, t: Character, pool: string[]) => pool[Math.min(pool.length - 1, tried(stance(w, s, t.id), 'no'))];

// ---------------------------------------------------------------- taking a man on (recruitment)
// What a prospect wants to start, and why: only real reasons raise it (his debts, his people at home, his greed, what he already makes).
export function startWant(t: Character): { amt: number; why?: string } {
  let amt = RECRUIT_COST; const why: string[] = [];
  const pr = t.problem && t.problem.sev > 0.3 ? t.problem.kind : undefined;
  if (pr === 'debt' || pr === 'gambling') { amt += 100; why.push('I owe a man who won’t wait'); }
  else if (pr === 'family' || pr === 'house') { amt += 100; why.push('I’ve got people at home to keep'); }
  if (t.traits.greed > 0.6) { amt += 150; why.push('a man with nothing in his pocket works for nobody'); }
  if (t.cash > 900) { amt += 100; why.push('I do all right as I am'); }
  return { amt: Math.min(amt, RECRUIT_COST * 3), why: why[0] };
}
ASKS.recruit = {
  id: 'recruit', sev: 0.15, roles: ['recruiter', 'prospect'], cool: 3, low: true, fear0: 0.3,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'leverage', 'pressure', 'senior', 'wait', 'drop'],
  sweeten: (amt) => `Offer him ${money(amt)} to start`, take: (f) => `Give him his ${f}`,
  title: (w, s) => { const t = w.chars[s.terms?.of ?? '']; return t ? `Taking ${first(t)} on` : 'Taking a man on'; },
  valid: (w, s) => {
    const a = asker(w, s), t = askee(w, s);
    return !!a && !!t && !!t.prospect && t.rank === 'civilian' && !ownerBiz(w, t.id) && a.rank !== 'civilian' && (a.isPlayer || a.cash >= (s.terms?.amt ?? RECRUIT_COST));
  },
  lean: (w, s, a, t) => {
    const amt = s.terms?.amt ?? RECRUIT_COST, want = startWant(t).amt;
    const pay = amt >= want ? 0.12 : -0.5 * (1 - amt / want); // what he is offered against what he needs
    const keen = t.traits.ambition * 0.35 - t.traits.caution * 0.25; // a hungry young man, or a careful one
    const name = clamp(a.standing / 100) * 0.3 + Math.min(rk(a), 3) * 0.04; // whose name he would be putting his to
    const hot = a.heat > 0.8 ? -0.12 : 0; // a man the police are watching is a bad man to start with
    return keen + pay + name + hot + 0.1;
  },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? RECRUIT_COST, x = startWant(t); return x.amt > amt && x.why ? { amt: x.amt, why: x.why } : undefined; },
  better: (w, s) => { const a = asker(w, s), amt = s.terms?.amt ?? RECRUIT_COST, next = amt + 50; return a && next <= RECRUIT_COST * 3 && (a.isPlayer || a.cash >= next + 50) ? next : undefined; },
  short: (w, s, a, amt) => (a.cash < amt ? `You haven’t got ${money(amt)} on you.` : undefined),
  yes: (w, s, a, t) => {
    const amt = Math.max(RECRUIT_COST, s.terms?.amt ?? RECRUIT_COST);
    const out = recruitProspect(w, a, t); // the existing mechanics: rank, place, crew, the $150 start, the fact
    if (t.bossId !== a.id) return out.join(' ');
    const extra = Math.max(0, Math.min(amt - RECRUIT_COST, a.cash));
    if (extra) transfer(w, a, t, extra, 'gift', 'to start');
    if (a.isPlayer) t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: a.id, kind: 'agreement', text: `You took him on with ${money(RECRUIT_COST + extra)} to start.` });
    return a.isPlayer ? out.join(' ') : `${t.name} shakes ${first(a)}'s hand. He runs with him now.`;
  },
  voice: {
    no: (w, s, a, t) => again(w, s, t, t.traits.caution > 0.6 ? ['“It’s a big thing, to put my name to yours. Not now.”', '“I said not now. I meant it.”', '“You keep asking. The answer keeps being the same.”'] : arch(t) === 'hothead' ? ['“Run errands for you? I’m nobody’s boy.”', '“What part of no didn’t you hear?”', '“Ask me again and see what happens.”'] : ['“Not for me. I’ve got my own life.”', '“Same answer as before. I’m doing all right as I am.”', '“I appreciate it. Still no.”']),
  },
  phrase: {
    ask: (w, s) => { const a = asker(w, s); return `${money(s.terms?.amt ?? RECRUIT_COST)} to start, and a place in ${a?.isPlayer ? 'your' : 'his'} crew.`; },
    yes: 'He shakes on it.', no: '“Not for me. I’ve got my own life.”', counter: '“{amt} to start, and I’m yours. {why}.”', stall: '“Let me think on it. A few days.”',
  },
};

// ---------------------------------------------------------------- "leave him alone" (a warning not tied to another ask)
// A man has a word with another on someone's behalf: a job to "have a quiet word", a friend of a beaten man. The warned man
// weighs who is asking, whether he did it at all, and how much he wants at the man he is being warned off.
const forOf = (w: World, s: Situation) => live(w, String(s.m?.for ?? ''));
ASKS.layoff = {
  id: 'layoff', sev: 0.3, roles: ['warns', 'warned'], cool: 4,
  moves: ['ask', 'persuade', 'leverage', 'pressure', 'force', 'senior', 'wait', 'drop'],
  title: (w, s) => { const v = forOf(w, s); return v ? `Leave ${first(v)} alone` : 'A warning'; },
  valid: (w, s) => { const j = s.m?.job ? w.jobs.find((x) => x.id === s.m!.job) : undefined; return !!forOf(w, s) && !!askee(w, s) && j?.status !== 'done'; },
  lean: (w, s, a, t) => {
    const v = forOf(w, s)!, f = s.m?.fact ? w.facts[String(s.m.fact)] : undefined;
    const guilty = f ? f.actor === t.id : true; // an innocent man takes being warned off as an insult
    const want = clamp(rel(t, v.id).grudge); // how much he wants at the man
    const outranked = (rk(a) - rk(t)) * 0.12;
    const fam = a.familyId && a.familyId === t.familyId ? 0.1 : 0;
    return (guilty ? 0.08 : -0.4) + outranked + fam - want * 0.45 + (t.traits.caution - 0.5) * 0.4;
  },
  yes: (w, s, a, t) => {
    const v = forOf(w, s)!, f = s.m?.fact ? w.facts[String(s.m.fact)] : undefined;
    const guilty = f ? f.actor === t.id : true;
    const r = rel(t, v.id); easeOn(r, 0.4); // he stays away: the bad blood that drove him is let go
    bear(w, t, a.id, 0.05, `${a.name} warned him off`);
    let line = `${t.isPlayer ? 'You agree' : `${first(t)} agrees`} to stay away from ${v.isPlayer ? 'you' : first(v)}.`;
    if (guilty && f) {
      // what he did to the man is what he makes good: what he took, if he took something; otherwise (an NPC) what he can spare
      const rest = Math.round(Math.min(f.amount ? f.amount : t.isPlayer ? 0 : 800, t.cash * 0.5) / 10) * 10;
      if (rest >= 50) { transfer(w, t, v, rest, 'gift', 'to make it right'); line = `${t.name} studies his shoes and agrees to make it right: ${money(rest)} to ${v.name}.`; }
    }
    tell(w, s, `${t.name} agreed to leave ${v.name} alone after ${a.name} had a word.`, { actor: t.id, victim: v.id, witnesses: [a.id, v.id], minor: true });
    if (!v.isPlayer && !a.isPlayer && a.id !== v.id) npcFavour(w, a, v, `having a word with ${t.name}`); // he owes the man who spoke for him
    const j = s.m?.job ? w.jobs.find((x) => x.id === s.m!.job) : undefined;
    if (j && j.status === 'active') { const r2 = finishJob(w, j, true, []); line += ' ' + r2.lines.join(' '); }
    return line.trim();
  },
  force: (w, s, a, t) => {
    t.hurtUntil = Math.max(t.hurtUntil, w.now + 3 * DAY);
    tell(w, s, `${a.name}'s people roughed up ${t.name} to make the point.`, { kind: 'beating', actor: a.id, victim: t.id, witnesses: witnessesAt(w, t.district, [a.id, t.id], 2) });
    if (a.familyId && t.familyId && a.familyId !== t.familyId) tension(w, a, t, 2);
    a.cooldown.restraint = w.now + 10 * DAY;
    return `${t.isPlayer ? 'You are' : `${first(t)} is`} roughed up, to make the point.`;
  },
  onNo: (w, s, a, t) => {
    if (!s.m?.told) { s.m = { ...(s.m ?? {}), told: 1 }; tell(w, s, `${t.name} told ${a.name} to mind his own business.`, { actor: t.id, victim: a.id, witnesses: witnessesAt(w, t.district, [a.id, t.id], 2), minor: true }); }
    return undefined;
  },
  voice: {
    no: (w, s, a, t) => { const f = s.m?.fact ? w.facts[String(s.m.fact)] : undefined; return f && f.actor !== t.id ? again(w, s, t, [`${first(t)} looks genuinely baffled. “I never touched him. Ask anybody.” You’re not sure you believe him.`, `“I told you. It wasn’t me. Go and find who it was.”`, `${first(t)} won’t even answer it this time.`]) : again(w, s, t, [`${first(t)} tells you to mind your own business. The door closes on the last word.`, `“I heard you the first time. It’s still none of yours.”`, `${first(t)} just looks at you until you stop talking.`]); },
  },
  phrase: {
    ask: (w, s) => { const v = forOf(w, s); return `“${v ? first(v) : 'He'} is a friend of mine. Leave him alone.”`; },
    yes: 'He backs off.', no: '“Mind your own business.”', counter: '', stall: '“I heard you. Let me think about it.”',
  },
};
// A man who will not go after the one who hurt his own does the next thing: has a word.
export function layoffFor(w: World, a: Character, t: Character, v: Character, fact?: Id): Situation | undefined {
  if (a.id === t.id || v.id === t.id || a.isPlayer) return undefined;
  const s = openAsk(w, 'layoff', a, t, { about: v.id, why: `${a.name} wants ${t.name} to leave ${v.name} alone` });
  if (s) { s.m = { ...(s.m ?? {}), for: v.id, ...(fact ? { fact } : {}) }; s.next = w.now + DAY; }
  return s;
}

// ---------------------------------------------------------------- a favour called in
// What is asked: money, a man standing beside him, or silence. What decides it: whether it is owed (and how big the debt), what it
// costs the man asked, and what is between them. Refusing a favour that is owed is not the end of it: it gets around.
const favOf = (w: World, s: Situation): Favour | undefined => (s.m?.fav ? w.favours.find((f) => f.id === s.m!.fav) : undefined);
ASKS.favour = {
  id: 'favour', sev: 0.2, roles: ['owed', 'owes'], cool: 4, keepOnNo: true, fear0: 0.6,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'pressure', 'senior', 'wait', 'drop'], // (not leverage: what he owes is the ask itself)
  sweeten: (amt) => `Ask for ${money(amt)} instead`,
  title: (w, s) => { const a = asker(w, s), t = askee(w, s); return a && t ? (t.isPlayer ? `${first(a)} calls in a favour` : `Calling in what ${first(t)} owes`) : 'A favour'; },
  valid: (w, s) => { const f = favOf(w, s); return !!asker(w, s) && !!askee(w, s) && !(f && f.settled); },
  lean: (w, s, a, t) => {
    const f = favOf(w, s), r = rel(t, a.id), amt = s.terms?.amt ?? 0, what = s.terms?.what;
    const owed = f ? 0.3 + f.size * 0.08 : -0.2; // what he owes, and how much
    const cost = what === 'money' ? -clamp(amt / Math.max(50, t.cash), 0, 1.5) * 0.35 : what === 'muscle' ? -t.traits.caution * 0.25 - (t.heat > 0.6 ? 0.1 : 0) : -0.05;
    return owed + cost + r.trust * 0.25 + r.affection * 0.1 - 0.05;
  },
  counter: (w, s, a, t) => {
    if (s.terms?.what !== 'money') return undefined;
    const amt = s.terms?.amt ?? 0, f = favOf(w, s);
    const can = Math.round(Math.min(amt * 0.5, Math.max(0, t.cash - 50)) / 10) * 10;
    if (can < 50 || can >= amt) return undefined;
    return { amt: can, why: t.cash < amt * 1.5 ? 'I’m short myself this month' : f && f.size <= 1 ? 'it was a small thing you did for me, and this is a small thing back' : 'half now is more than all of it never' };
  },
  better: (w, s) => { if (s.terms?.what !== 'money') return undefined; const next = Math.round((s.terms?.amt ?? 0) * 0.7 / 10) * 10; return next >= 50 && next < (s.terms?.amt ?? 0) ? next : undefined; },
  cant: (w, s, t) => (s.terms?.what === 'money' && t.cash < (s.terms?.amt ?? 0) ? 'You can’t cover it right now. He hears that as “not yet”, and he will be back.' : undefined),
  yes: (w, s, a, t) => {
    const f = favOf(w, s), what = s.terms?.what;
    let line = '';
    if (what === 'money') { const pay = transfer(w, t, a, s.terms?.amt ?? 0, 'gift', 'a favour called in'); line = `${t.isPlayer ? 'You put' : `${first(t)} puts`} ${money(pay)} in ${a.isPlayer ? 'your' : 'his'} hand.`; }
    else if (what === 'muscle') {
      t.heat = clamp(t.heat + 0.12, 0, 1.5);
      line = `${t.isPlayer ? 'You stand' : `${first(t)} stands`} beside ${a.isPlayer ? 'you' : first(a)} when it counts.`;
      // the man he has bad blood with sees who stands with him now, and holds it against him too
      const foe = Object.entries(a.rels).filter(([id, r]) => r.grudge > 0.3 && live(w, id) && id !== t.id).sort((x, y) => y[1].grudge - x[1].grudge)[0];
      const fc = foe ? w.chars[foe[0]] : undefined;
      if (fc) { bear(w, fc, t.id, 0.1, `${t.name} stood with ${a.name}`); feel(w, fc, a.id, 'respect', 0.04); }
      tell(w, s, `${t.name} stood beside ${a.name}${fc ? ` when he went to see ${fc.name}` : ' when it counted'}.`, { actor: t.id, victim: fc?.id ?? a.id, witnesses: [...new Set([a.id, ...(fc ? [fc.id] : []), ...witnessesAt(w, t.district, [a.id, t.id], 2)])], minor: true });
    }
    else line = `${t.isPlayer ? 'You keep' : `${first(t)} keeps`} it to ${t.isPlayer ? 'yourself' : 'himself'}.`;
    if (f) f.settled = true; else addFavour(w, t.id, a.id, 1, `what ${t.name} did when ${a.name} asked`); // a fresh favour done is a favour owed
    if (t.isPlayer) { regard(w, a, t, 'respect', 0.04, 'favour'); regard(w, a, t, 'trust', 0.04, 'favour'); } else { feel(w, a, t.id, 'respect', 0.04); feel(w, a, t.id, 'trust', 0.04); }
    return `${line} ${f ? (t.isPlayer ? '“We’re even. You’re a man who pays.”' : a.isPlayer ? 'You’re square now.' : 'They are square.') : ''}`.trim();
  },
  onNo: (w, s, a, t) => {
    const f = favOf(w, s);
    if (!f || s.m?.welsh) return undefined;
    s.m = { ...(s.m ?? {}), welsh: 1 };
    const r = rel(a, t.id); feelOn(w, r, 'respect', -0.1); feelOn(w, r, 'trust', -0.08); bearOn(w, r, 0.1, `${t.name} would not honour the favour he owed`);
    // not minor: a man who won't pay what he owes is talked about
    tell(w, s, `${t.name} refused ${a.name} a favour he owed him.`, { kind: 'favour', actor: t.id, victim: a.id, witnesses: [a.id], broadcast: witnessesAt(w, a.district, [a.id, t.id], 2) });
    if (t.isPlayer) { repute(w, t, -2, 'welsh'); return `${first(a)} doesn’t raise his voice. “I’ll remember you said that.” It will get around that you don’t pay what you owe.`; }
    return undefined;
  },
  phrase: {
    ask: (w, s) => { const what = s.terms?.what, f = favOf(w, s); return what === 'money' ? `${money(s.terms?.amt ?? 0)}, quietly${f ? ', for ' + f.what : ''}.` : what === 'muscle' ? '“There’s a man who needs persuading, and I want you standing beside me when it happens.”' : '“You saw nothing. Not to the boss, not to anyone.”'; },
    yes: 'He does it.', no: '“Not now. I can’t.”', counter: '“I can do {amt}. {why}.”', stall: '“Give me a few days.”',
  },
};
// A man owed a favour calls it in.
export function callFavour(w: World, a: Character, t: Character, f: Favour, what: 'money' | 'muscle' | 'silence', amt?: number): Situation | undefined {
  const s = openAsk(w, 'favour', a, t, { amt: what === 'money' ? amt : undefined, what, about: f.id, why: `${a.name} called in what ${t.name} owes him` });
  if (s) s.m = { ...(s.m ?? {}), fav: f.id };
  return s;
}
// Men owed favours by other men call them in when they need something: money when they are short, a man beside them when they
// have bad blood. Weekly, a few at a time.
const npcOnly = (w: World, f: Favour) => f.from !== w.playerId && f.to !== w.playerId;
// A favour between two men neither of whom is the player (bounded: the record of who owes whom among them stays small).
export function npcFavour(w: World, from: Character, to: Character, what: string) {
  if (w.favours.filter((f) => !f.settled && npcOnly(w, f)).length >= 120) return undefined;
  return addFavour(w, from.id, to.id, 1, what);
}
export function favoursWeek(w: World) {
  // settled favours between other men are forgotten after a while (the player's own are kept: they are his history)
  if (w.favours.some((f) => f.settled && npcOnly(w, f) && w.now - f.t > 60 * DAY)) w.favours = w.favours.filter((f) => !(f.settled && npcOnly(w, f) && w.now - f.t > 60 * DAY));
  let n = 0;
  for (const f of w.favours ?? []) {
    if (n >= 3) break;
    if (f.settled || f.asked || w.now - f.t < 10 * DAY) continue;
    const a = live(w, f.from), t = live(w, f.to);
    if (!a || !t || a.isPlayer || t.isPlayer || a.jailedUntil > w.now) continue;
    const short = a.cash < 150 && t.cash > 300;
    const feud = Object.values(a.rels).some((r) => r.grudge > 0.45);
    if (!short && !feud) continue;
    f.asked = true;
    const s = callFavour(w, a, t, f, short ? 'money' : 'muscle', short ? Math.min(100 + f.size * 100, Math.round(t.cash * 0.4 / 10) * 10) : undefined);
    if (s) { move(w, s, 'ask'); n++; }
  }
}

// ---------------------------------------------------------------- making it right (amends)
// After a broken promise, a quarrel, or bad blood: the man making amends offers his word, or money with it. The other man may
// accept, name his price (with the reason he has: what it cost him, what it did to him), or refuse.
const wordFact = (w: World, s: Situation) => (s.m?.word ? w.facts[String(s.m.word)] : undefined);
const hurtFact = (w: World, s: Situation) => (s.m?.fact ? w.facts[String(s.m.fact)] : undefined);
export function amendsPrice(w: World, s: Situation, t: Character, a: Character): { amt: number; why: string } {
  const f = hurtFact(w, s);
  if (f) {
    const base = Math.max(200, Math.round((f.amount ?? 0) * 1.2 / 10) * 10);
    if (f.amount) return { amt: base, why: `it cost me ${money(f.amount)}, and something for the trouble` };
    if (f.kind === 'beating') return { amt: Math.max(base, 300), why: 'I was laid up and couldn’t earn' };
    if (f.kind === 'vandalism') return { amt: Math.max(base, 300), why: 'fixing the place cost more than that' };
    return { amt: base, why: 'that’s what it cost me' };
  }
  const wf = wordFact(w, s);
  if (wf) {
    const seen = Object.values(w.chars).filter((c) => c.alive && c.id !== a.id && c.id !== t.id && c.known[wf.id]).length;
    if (t.cash < 200) return { amt: 250, why: 'I was counting on you, and it cost me money I didn’t have' };
    if (seen >= 2) return { amt: 300, why: 'people saw you let me down, and that costs a man' };
    return { amt: 150, why: 'my time was worth something' };
  }
  const g = rel(t, a.id).grudge;
  return { amt: g > 0.5 ? 300 : 150, why: g > 0.5 ? 'you know what you did' : 'words are cheap' };
}
ASKS.amends = {
  id: 'amends', sev: 0.2, roles: ['makes amends', 'wronged'], cool: 4, low: true, fear0: 0.5,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'wait', 'drop'],
  sweeten: (amt) => `Offer ${money(amt)} with it`, take: (f) => `Pay him ${f}`,
  askLabel: (w, s) => (s.terms?.amt ? `Offer him ${money(s.terms.amt)} and your word` : 'Own up to him, no excuses'),
  title: (w, s) => { const t = askee(w, s); return t ? `Making it right with ${first(t)}` : 'Making it right'; },
  valid: (w, s) => {
    const a = asker(w, s), t = askee(w, s);
    if (!a || !t) return false;
    const wf = wordFact(w, s);
    if (wf) return !t.talk?.['word:' + wf.id];
    const par = s.m?.parent ? sits(w).find((x) => x.id === s.m!.parent) : undefined;
    return (par ? isOpen(par) : false) || rel(t, a.id).grudge >= 0.05 || quarrelsWith(w, a, t).length > 0;
  },
  lean: (w, s, a, t) => {
    const r = rel(t, a.id), amt = s.terms?.amt ?? 0, pr = amendsPrice(w, s, t, a).amt;
    const pay = clamp(amt / pr, 0, 1.2) * 0.4 - 0.15; // words alone count for something; the money he thinks it is worth counts for more
    return 0.12 + pay + r.trust * 0.25 + r.respect * 0.1 + r.affection * 0.1 - t.traits.violence * 0.15 + (rk(a) > rk(t) ? 0.08 : 0);
  },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? 0, pr = amendsPrice(w, s, t, a); return pr.amt > amt ? pr : undefined; },
  better: (w, s) => {
    const a = asker(w, s), t = askee(w, s), amt = s.terms?.amt ?? 0;
    if (!a || !t) return undefined;
    const next = amt === 0 ? amendsPrice(w, s, t, a).amt : Math.round(amt * 1.5 / 50) * 50;
    return next <= 2000 && (a.isPlayer || a.cash >= next) ? next : undefined;
  },
  short: (w, s, a, amt) => (amt > 0 && a.cash < amt ? 'You reach for your money and come up short. Better to wait until you can do it properly.' : undefined),
  yes: (w, s, a, t) => {
    const amt = Math.max(0, Math.min(s.terms?.amt ?? 0, a.cash));
    if (amt) transfer(w, a, t, amt, 'gift', 'amends');
    const r = rel(t, a.id); easeOn(r, (amt ? 0.3 : 0.5)); feelOn(w, r, 'trust', 0.03);
    ease(a, t.id, 0.5);
    const wf = wordFact(w, s);
    if (wf) (t.talk ??= {})['word:' + wf.id] = { d: Math.floor(w.now / DAY), sig: 'x', n: 1 };
    const text = amt ? `${a.name} paid ${t.name} ${money(amt)} to make it right, and ${t.name} took it.` : `${a.name} owned up to ${t.name}, to his face, and ${t.name} accepted it.`;
    settleBetween(w, a, t, text);
    tell(w, s, text, { actor: a.id, victim: t.id, witnesses: witnessesAt(w, t.district, [a.id, t.id], 2), minor: true });
    if (a.isPlayer) return amt ? `${first(t)} counts it without picking it up. “We’re square. Mostly.”` : `${first(t)} says nothing for a while. “That cost you. I respect a man who says it.”`;
    return `${first(t)} accepts. It is finished between them.`;
  },
  voice: {
    no: (w, s, a, t) => again(w, s, t, arch(t) === 'hothead' ? ['“Words. You think words fix it?”', '“More words. Still not enough.”', '“Keep talking. It doesn’t change anything.”'] : arch(t) === 'proud' ? ['“I don’t forget a thing like that because a man asks me to.”', '“Asking twice doesn’t make it smaller.”', '“I told you how I see it. That hasn’t changed.”'] : ['“I heard you. It isn’t enough.”', '“It still isn’t enough. You know what would be.”', '“We’ve been over it. Not yet.”']),
  },
  phrase: {
    ask: (w, s) => (s.terms?.amt ? `${money(s.terms.amt)} for his trouble, and your word it won’t happen again.` : 'No excuses: you were wrong, and you say so to his face.'),
    yes: 'He accepts.', no: '“I heard you. It isn’t enough.”', counter: '“{amt}. {why}.”', stall: '“Let me think about whether I want anything from you.”',
  },
};
export function amendsAsk(w: World, a: Character, t: Character, o: { word?: Id; fact?: Id; amt?: number; parent?: Id; why?: string } = {}): Situation | undefined {
  const s = openAsk(w, 'amends', a, t, { amt: o.amt ?? 0, about: o.word ?? o.fact, parent: o.parent, why: o.why ?? `${a.name} wants to make it right with ${t.name}` });
  if (s && (o.word || o.fact)) s.m = { ...(s.m ?? {}), ...(o.word ? { word: o.word } : {}), ...(o.fact ? { fact: o.fact } : {}) };
  return s;
}

// ---------------------------------------------------------------- a smaller share (what a man passes up to his boss)
const pct = (x: number) => `${x}%`;
const curRate = (c: Character) => Math.round(c.kickRate * 100);
ASKS.rate = {
  id: 'rate', sev: 0.1, roles: ['earner', 'boss'], cool: 8, low: true, fmt: pct, fear0: 0,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'leverage', 'wait', 'drop'],
  sweeten: (x) => `Ask for ${x}% instead`, take: (f) => `Settle at ${f}`,
  title: () => 'A smaller share',
  valid: (w, s) => { const a = asker(w, s), t = askee(w, s); return !!a && !!t && a.bossId === t.id && (s.terms?.amt ?? 0) < curRate(a) && a.kickRate > rateView(w, a, t).floor + 0.001; },
  lean: (w, s, a, t) => { const v = rateView(w, a, t), cut = curRate(a) - (s.terms?.amt ?? curRate(a)); return v.score - 0.3 - Math.max(0, cut - 2) * 0.06; },
  counter: (w, s, a, t) => {
    const v = rateView(w, a, t), cur = curRate(a), amt = s.terms?.amt ?? cur, off = Math.max(amt + 1, Math.ceil(v.floor * 100), cur - 1);
    if (off >= cur || off <= amt || v.score < 0.05) return undefined;
    const why = v.levy ? 'the family is taking more from all of us this year' : v.short ? 'I’ve got my own people to pay, and it’s been thin' : v.behind ? 'you’ve been behind with me' : v.h.length < 4 ? 'you haven’t been with me long enough' : undefined;
    return why ? { amt: off, why } : undefined; // a counter only comes with a reason he really has
  },
  better: (w, s) => { const a = asker(w, s), amt = s.terms?.amt ?? 0; return a && amt + 1 < curRate(a) ? amt + 1 : undefined; },
  yes: (w, s, a, t) => {
    const cur = curRate(a), v = rateView(w, a, t);
    a.kickRate = Math.max(v.floor, (s.terms?.amt ?? cur) / 100);
    addFact(w, { kind: 'terms', actor: t.id, victim: a.id, minor: true, story: 'sit:' + s.id, text: `${t.name} agreed to take less from ${a.name}.`, district: a.district }, { witnesses: [] });
    return a.isPlayer ? `${vsay(w, t, a, 'rate_agree')} You pass up ${curRate(a)}% from now on, down from ${cur}%.` : `${first(t)} agrees to take less.`;
  },
  voice: {
    no: (w, s, a, t) => { const v = rateView(w, a, t); return vsay(w, t, a, v.steady ? 'rate_no_steady' : v.h.length < 4 ? 'rate_no_new' : 'rate_no_short'); },
  },
  phrase: {
    ask: (w, s) => { const a = asker(w, s); return `${s.terms?.amt ?? 0}% instead of ${a ? curRate(a) : 0}%.`; },
    yes: 'He agrees.', no: '“No. What you pass up is what you pass up.”', counter: '“{amt}, and that’s me being generous. {why}.”', stall: '“Let me look at the numbers. Ask me again.”',
  },
};
export function rateAsk(w: World, c: Character, boss: Character): Situation | undefined {
  const cur = curRate(c), floor = Math.ceil(rateView(w, c, boss).floor * 100);
  if (cur <= floor) return undefined;
  return openAsk(w, 'rate', c, boss, { amt: Math.max(floor, cur - 3), why: `${c.name} asked ${boss.name} to take less` });
}

// ---------------------------------------------------------------- more money for a job
const jobOf = (w: World, s: Situation) => w.jobs.find((x) => x.id === s.m?.job);
ASKS.jobpay = {
  id: 'jobpay', sev: 0.1, roles: ['doer', 'giver'], cool: 4, fear0: 0.3,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'leverage', 'wait', 'drop'],
  sweeten: (amt) => `Settle for ${money(amt)}`,
  title: (w, s) => { const j = jobOf(w, s); return j ? `The money for “${j.title}”` : 'The money for a job'; },
  valid: (w, s) => { const j = jobOf(w, s); return !!j && (j.status === 'offered' || j.status === 'active') && !!askee(w, s) && (s.terms?.amt ?? 0) > j.pay; },
  lean: (w, s, a, t) => {
    const j = jobOf(w, s)!, amt = s.terms?.amt ?? j.pay;
    const have = t.cash + Math.max(0, (ownerBiz(w, t.id)?.cash ?? 0) - 200);
    const afford = have >= amt * 2 ? 0.1 : -0.1; // can he pay it at all
    const worth = j.kind === 'hit' ? 0.15 : 0; // he knows what he is asking of you
    const name = clamp(a.standing / 100) * 0.25 + rel(t, a.id).respect * 0.2;
    return afford + worth + name - t.traits.greed * 0.25 - (amt / Math.max(1, j.pay) - 1) * 0.4 + 0.25; // (a man who offers work expects to be asked, and can be talked up)
  },
  counter: (w, s, a, t) => {
    const j = jobOf(w, s)!, amt = s.terms?.amt ?? j.pay;
    const mid = Math.round((j.pay + (amt - j.pay) / 2) / 50) * 50;
    if (mid <= j.pay || mid >= amt) return undefined;
    const have = t.cash + Math.max(0, (ownerBiz(w, t.id)?.cash ?? 0) - 200);
    const why = have < amt * 2 ? 'that’s what I can lay my hands on' : rel(t, a.id).trust < 0.35 ? 'I don’t know you well enough to pay over the odds' : t.traits.greed > 0.6 ? 'I didn’t get where I am by paying what I’m asked' : undefined;
    return why ? { amt: mid, why } : undefined; // a counter only comes with a reason he really has
  },
  better: (w, s) => { const j = jobOf(w, s); if (!j) return undefined; const next = Math.round(((s.terms?.amt ?? j.pay) + j.pay) / 2 / 50) * 50; return next > j.pay && next < (s.terms?.amt ?? 0) ? next : undefined; },
  yes: (w, s, a, t) => { const j = jobOf(w, s)!; j.pay = s.terms?.amt ?? j.pay; return `${first(t)} grumbles and comes up. It’s ${money(j.pay)} now.`; },
  onNo: (w, s, a, t) => { if (!s.m?.sore) { s.m = { ...(s.m ?? {}), sore: 1 }; feel(w, t, a.id, 'trust', -0.03); } return undefined; },
  phrase: {
    ask: (w, s) => `${money(s.terms?.amt ?? 0)} for it, not ${money(jobOf(w, s)?.pay ?? 0)}.`,
    yes: 'He comes up.', no: '“The price is the price.”', counter: '“{amt}. {why}.”', stall: '“Do the work. We’ll talk after.”',
  },
};
// ================================================================== Stage 4: the figures, and buying and selling a business
// The figure a man may name himself, where the matter is about money (asks.nameFigure): within what makes sense for it.
ASKS.protect.figure = (w, s) => { const b = s.biz ? w.biz[s.biz] : undefined; return b ? { min: 10, max: Math.max(50, Math.round(b.income * 0.3 / 5) * 5), step: 5 } : undefined; };
ASKS.lend.figure = (w, s) => { const a = asker(w, s); return a ? { min: 100, max: Math.max(100, Math.floor(a.cash / 50) * 50), step: 50, rate: { min: 0.01, max: 0.15 } } : undefined; };
ASKS.borrow.figure = () => ({ min: 100, max: 20000, step: 50 });
ASKS.jobpay.figure = (w, s) => { const j = jobOf(w, s); return j ? { min: j.pay + 50, max: Math.max(j.pay + 50, j.pay * 3), step: 50 } : undefined; };

// Buying a man's business, or a piece of it (terms.share). The owner answers from the rules every sale follows (econ.sellerFloor):
// what the place is worth, what trouble he is in, what kind of man he is, and what he thinks of the buyer. His counter is the least
// he would take, with his reason.
const pieceOf = (s: Situation) => s.terms?.share;
const fullOf = (w: World, s: Situation) => { const b = w.biz[s.biz!], p = priceOf(w, b), sh = pieceOf(s); return sh ? Math.round(p * sh / 50) * 50 : p; };
ASKS.buy = {
  id: 'buy', sev: 0.15, roles: ['buyer', 'owner'], cool: 4, ttl: 21, low: true, fear0: 0.3,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'leverage', 'pressure', 'senior', 'wait', 'drop', 'name'],
  title: (w, s) => { const b = s.biz ? w.biz[s.biz] : undefined; return !b ? 'A business' : pieceOf(s) ? `A piece of ${b.name}` : `Buying ${b.name}`; },
  valid: (w, s) => { const b = s.biz ? w.biz[s.biz] : undefined, a = asker(w, s); return !!b?.open && b.kind !== 'casino' && b.ownerId === s.terms?.of && !!a && (a.isPlayer || a.cash >= (s.terms?.amt ?? 0)) && (!pieceOf(s) || stakeRoom(b) >= pieceOf(s)! - 1e-9); },
  lean: (w, s, a, t) => { const b = w.biz[s.biz!], thr = sellerFloor(w, b, t, a, pieceOf(s) ? 'stake' : 'buy'); return clamp(((s.terms?.amt ?? 0) / Math.max(1, fullOf(w, s)) - thr) * 2.5 + 0.12, -1, 1); },
  counter: (w, s, a, t) => {
    const b = w.biz[s.biz!], full = fullOf(w, s), want = Math.round(full * sellerFloor(w, b, t, a, pieceOf(s) ? 'stake' : 'buy') / 50) * 50;
    if (want <= (s.terms?.amt ?? 0) || want > full * 1.5) return undefined;
    const why = b.distress > 0 ? 'business is slow, but it isn’t dead' : (t.rels[a.id]?.grudge ?? 0) > 0.2 ? 'for you, that’s the price' : t.traits.greed > 0.6 ? 'that’s what it’s worth to me' : 'that’s what the place is worth';
    return { amt: want, why };
  },
  better: (w, s) => { const amt = s.terms?.amt ?? 0, next = Math.round(amt * 1.1 / 50) * 50; return next > amt && next <= fullOf(w, s) * 1.6 ? next : undefined; },
  short: (w, s, a, amt) => (a.cash < amt ? `You haven’t got ${money(amt)} to put down.` : undefined),
  figure: (w, s) => { const f = fullOf(w, s); return { min: Math.max(50, Math.round(f * 0.3 / 50) * 50), max: Math.round(f * 2 / 50) * 50, step: 50 }; },
  yes: (w, s, a, t) => {
    const b = w.biz[s.biz!], amt = s.terms?.amt ?? 0, sh = pieceOf(s);
    if (!sellTo(w, a, b, amt, sh)) return 'The money isn’t there when it comes to it. It falls through.';
    feel(w, a, t.id, 'respect', 0.03);
    return sh ? `${first(t)} takes ${money(amt)} for ${Math.round(sh * 100)}% of ${b.name}. ${a.isPlayer ? 'You have' : `${first(a)} has`} a share of what it makes every week.` : `${first(t)} takes ${money(amt)}. ${b.name} is ${a.isPlayer ? 'yours' : `${first(a)}’s`} now.`;
  },
  phrase: {
    ask: (w, s) => { const b = w.biz[s.biz!], sh = pieceOf(s); return sh ? `${money(s.terms?.amt ?? 0)} for ${Math.round(sh * 100)}% of ${b.name}.` : `${money(s.terms?.amt ?? 0)} for ${b.name}, the whole thing.`; },
    yes: 'He shakes on it.', no: '“It’s not for sale. Not at that.”', counter: '“{amt}. {why}.”', stall: '“Let me think about it. It’s my living.”',
  },
};

// Selling one's own business, or a piece of it, to a man with money. He weighs it as any buyer does: what the place is worth to a
// man like him, whether he has the money, how many places he has already, and whether he trusts the seller.
const worthTo = (w: World, s: Situation, t: Character) => Math.round(fullOf(w, s) * (1.05 - t.traits.caution * 0.15 + t.traits.ambition * 0.05) / 50) * 50;
ASKS.sell = {
  id: 'sell', sev: 0.12, roles: ['seller', 'buyer'], cool: 4, ttl: 21, fear0: 0.3,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'leverage', 'pressure', 'senior', 'wait', 'drop', 'name'], sweeten: (amt) => `Come down to ${money(amt)}`,
  title: (w, s) => { const b = s.biz ? w.biz[s.biz] : undefined; return !b ? 'A sale' : pieceOf(s) ? `Selling a piece of ${b.name}` : `Selling ${b.name}`; },
  valid: (w, s) => { const b = s.biz ? w.biz[s.biz] : undefined; return !!b?.open && b.ownerId === s.terms?.by && !!askee(w, s) && (!pieceOf(s) || stakeRoom(b) >= pieceOf(s)! - 1e-9); },
  lean: (w, s, a, t) => {
    const amt = s.terms?.amt ?? 0, most = worthTo(w, s, t);
    if (t.cash < amt + 150) return -0.8; // he hasn't got it
    const many = Object.values(w.biz).filter((b) => b.open && b.ownerId === t.id).length >= 3 && !pieceOf(s) ? -0.4 : 0;
    return clamp((most / Math.max(1, amt) - 1) * 2.5 + 0.12 + (rel(t, a.id).trust - 0.3) * 0.2 + many, -1, 1);
  },
  counter: (w, s, a, t) => {
    const amt = s.terms?.amt ?? 0, can = Math.round(Math.min(worthTo(w, s, t), t.cash - 150) / 50) * 50;
    if (can >= amt || can < amt * 0.5) return undefined;
    return { amt: can, why: t.cash - 150 < worthTo(w, s, t) ? 'that’s all I can put together' : 'that’s what it’s worth to me' };
  },
  better: (w, s) => { const amt = s.terms?.amt ?? 0, next = Math.round(amt * 0.9 / 50) * 50; return next >= fullOf(w, s) * 0.3 && next < amt ? next : undefined; },
  figure: (w, s) => { const f = fullOf(w, s); return { min: Math.max(50, Math.round(f * 0.3 / 50) * 50), max: Math.round(f * 2.5 / 50) * 50, step: 50 }; },
  yes: (w, s, a, t) => {
    const b = w.biz[s.biz!], amt = s.terms?.amt ?? 0, sh = pieceOf(s);
    if (!sellTo(w, t, b, amt, sh)) return 'When it comes to it, the money isn’t there. It falls through.';
    return sh ? `${first(t)} pays ${money(amt)} for ${Math.round(sh * 100)}% of ${b.name}.` : `${first(t)} pays ${money(amt)}. ${b.name} is his now.`;
  },
  phrase: {
    ask: (w, s) => { const b = w.biz[s.biz!], sh = pieceOf(s); return sh ? `${Math.round(sh * 100)}% of ${b.name}, for ${money(s.terms?.amt ?? 0)}.` : `${b.name}, for ${money(s.terms?.amt ?? 0)}.`; },
    yes: 'He shakes on it.', no: '“Not for me. Not at that.”', counter: '“{amt}. {why}.”', stall: '“Let me look at the books first.”',
  },
};
// Running another man's enterprise for a cut of the take: the man who would run it asks; the owner weighs what he thinks of him, what
// he is good at, whether he has a man on it already, and the cut asked (named by the asker: asks.nameFigure).
const opOf = (w: World, s: Situation) => w.ops.find((o) => o.id === s.terms?.what);
ASKS.run = {
  id: 'run', sev: 0.1, roles: ['runner', 'owner'], cool: 4, ttl: 14, fear0: 0.3,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'senior', 'wait', 'drop', 'name'], fmt: (n) => `${n}%`, sweeten: (n) => `Settle for ${n}%`,
  title: (w, s) => { const o = opOf(w, s); return o ? `Running ${first(w.chars[o.owner])}’s ${OPS[o.kind as keyof typeof OPS]?.label.toLowerCase() ?? 'operation'}` : 'Running an operation'; },
  valid: (w, s) => { const o = opOf(w, s); return !!o && (o.state === 'running' || o.state === 'raided') && o.owner === s.terms?.of && o.runner !== s.terms?.by; },
  lean: (w, s, a, t) => {
    const o = opOf(w, s)!, d = OPS[o.kind as keyof typeof OPS];
    const has = o.runner && w.chars[o.runner]?.alive ? 0.35 : 0;
    const busy = LADDER.indexOf(t.rank) >= 2 ? 0.1 : 0; // a captain has no time to run it himself
    return clamp(rel(t, a.id).trust * 0.6 + aptitude(a, d?.skill ?? 'nerve') * 0.4 + busy - has - ((s.terms?.amt ?? 15) / 100 - 0.15) * 3 - 0.15, -1, 1);
  },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? 15; return amt > 15 && rel(t, a.id).trust >= 0.3 ? { amt: 15, why: 'fifteen is what a man gets for running it' } : undefined; },
  better: (w, s) => { const amt = s.terms?.amt ?? 15, next = amt - 3; return next >= 5 ? next : undefined; },
  figure: () => ({ min: 5, max: 40, step: 1 }),
  yes: (w, s, a, t) => {
    const o = opOf(w, s)!, d = OPS[o.kind as keyof typeof OPS], was = o.runner && o.runner !== a.id ? w.chars[o.runner] : undefined;
    o.runner = a.id; o.cut = (s.terms?.amt ?? 15) / 100;
    if (was?.alive) bear(w, was, a.id, 0.1, `${a.name} was given what he used to run`);
    addFact(w, { kind: 'report', actor: t.id, victim: a.id, story: 'sit:' + s.id, text: `${t.name} put ${a.name} in charge of his ${d?.label.toLowerCase() ?? 'operation'} in ${o.district}, for ${s.terms?.amt ?? 15}% of the take.`, district: o.district }, { witnesses: [t.id, a.id] });
    return `${first(t)} agrees. The ${d?.label.toLowerCase() ?? 'operation'} is ${a.isPlayer ? 'yours' : `${first(a)}’s`} to run, for ${s.terms?.amt ?? 15}% of what it takes.`;
  },
  phrase: {
    ask: (w, s) => { const o = opOf(w, s); return `Let me run your ${o ? OPS[o.kind as keyof typeof OPS]?.label.toLowerCase() : 'operation'}. ${s.terms?.amt ?? 15}% of the take.`; },
    yes: 'He agrees.', no: '“I’ve got it covered.”', counter: '“{amt}. {why}.”', stall: '“Let me see how it goes this month.”',
  },
};
// ================================================================== Stage 5: asking for more time on a debt
// A man who can't make his payments goes to the man he owes and asks for easier terms: a smaller weekly payment, named by him. The
// lender weighs what he thinks of him, whether he can see the money is really not there, his own greed and his own need.
const debtOf = (w: World, s: Situation) => w.debts.find((d) => d.id === s.terms?.what && d.status === 'active');
ASKS.time = {
  id: 'time', sev: 0.1, roles: ['debtor', 'creditor'], cool: 3, ttl: 10, low: true, fear0: 0.3,
  moves: ['take', 'ask', 'sweeten', 'persuade', 'wait', 'drop', 'name'], fmt: (n) => `${money(n)} a week`, sweeten: (n) => `Offer ${money(n)} a week`,
  title: (w, s) => { const t = askee(w, s); return t ? `More time from ${first(t)}` : 'More time'; },
  valid: (w, s) => { const d = debtOf(w, s); return !!d && d.debtor === s.terms?.by && d.creditor === s.terms?.of; },
  lean: (w, s, a, t) => {
    const d = debtOf(w, s)!, amt = s.terms?.amt ?? d.weeklyPayment;
    const r = rel(t, a.id), can = a.cash >= d.weeklyPayment ? -0.4 : 0; // he can see the money is there
    return clamp(r.trust * 0.4 + r.affection * 0.2 - t.traits.greed * 0.3 - d.missed * 0.08 + can + (amt / Math.max(5, d.weeklyPayment)) * 0.3 - (t.cash < 300 ? 0.2 : 0) - 0.05, -1, 1);
  },
  counter: (w, s, a, t) => { const d = debtOf(w, s)!, amt = s.terms?.amt ?? 0, want = Math.round(d.weeklyPayment * 0.75 / 5) * 5; return want > amt && want < d.weeklyPayment ? { amt: want, why: 'I can carry you a little, not that much' } : undefined; },
  better: (w, s) => { const d = debtOf(w, s); if (!d) return undefined; const next = Math.round((s.terms?.amt ?? 0) * 1.3 / 5) * 5; return next > (s.terms?.amt ?? 0) && next < d.weeklyPayment ? next : undefined; },
  figure: (w, s) => { const d = debtOf(w, s); return d ? { min: 5, max: Math.max(5, d.weeklyPayment - 5), step: 5 } : undefined; },
  yes: (w, s, a, t) => {
    const d = debtOf(w, s)!, amt = s.terms?.amt ?? Math.round(d.weeklyPayment / 2 / 5) * 5;
    restructure(d, { payment: amt }); d.missed = 0;
    addFact(w, { kind: 'terms', actor: t.id, victim: a.id, amount: amt, story: 'sit:' + s.id, cause: d.cause, text: `${t.name} gave ${a.name} more time on what he owes: ${money(amt)} a week now.`, district: a.district }, { witnesses: [a.id, t.id] });
    return `${first(t)} agrees to ${money(amt)} a week. ${a.isPlayer ? 'You have' : `${first(a)} has`} some room to breathe.`;
  },
  phrase: {
    ask: (w, s) => `More time. ${money(s.terms?.amt ?? 0)} a week until I’m back on my feet.`,
    yes: 'He gives him the time.', no: '“A debt is a debt.”', counter: '“{amt}. {why}.”', stall: '“Let me think about it.”',
  },
};
void kinOf;
