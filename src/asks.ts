// V89: asks. Most of what happens between people in this world is one man wanting something from another: a shop's money, a
// debt paid, a man to back off, a favour, a yes. An ask is a situation (situ.ts, kind 'ask') with terms and a stance for each side,
// and it does not end at the first answer. The asker can come back with better terms, an argument, leverage, pressure, force, a
// senior man, or simply time; the other side can say yes, name his own terms, stall, refuse, or go to the people he has (his
// family, his friends, whoever protects him, another family, the police). Those people may make asks of their own. Superiors hear
// about what their men are doing and have views. The player and the NPCs use exactly the same moves; NPCs choose theirs from who
// they are. Each kind of ask only says what is being asked, what it is worth to the man asked, and what yes does in the real world.
import { addFact, clamp, createDebt, famName, money, notifyProtector, ownerBiz, payDebt, regard, rel, repute, witnessesAt } from './core';
import { loanPosition } from './negotiate';
import { say as vsay } from './voicesheet';
import { bizMove, giveTime, setCollector } from './econ';
import { tension } from './actions';
import { addEnc } from './encounters';
import { closeKin, kinOf, kinTie, madeKin } from './kin';
import { LADDER } from './rank';
import { closeSit, isOpen, know, registerStep, spawn, tell } from './situ';
import { Business, Character, DAY, Enc, Id, Situation, Stance, World } from './types';

export type AskMove = 'ask' | 'sweeten' | 'persuade' | 'leverage' | 'pressure' | 'force' | 'senior' | 'take' | 'wait' | 'drop';
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
  cool?: number; // weeks before the same matter can be raised again once it has settled (default 6)
  onNo?: (w: World, s: Situation, a: Character, t: Character) => string | undefined; // what a refusal does in the world, if anything beyond the matter
  moves?: AskMove[]; // the moves that make sense in this kind of matter (default: all of them)
  sweeten?: (amt: number) => string; // how coming down is put, if not as a lower price
  voice?: Partial<Record<'no' | 'counter' | 'stall', (w: World, s: Situation, a: Character, t: Character) => string>>; // his own words, when he says it to the player
}
export const ASKS: Record<string, AskKind> = {};

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

// How a man stands when the matter starts: from his nature, what he knows of the other man, and what is already between them.
function freshStance(w: World, me: Character, other: Character, asking: boolean): Stance {
  const r = rel(me, other.id), T = me.traits;
  if (asking) return { resolve: clamp(0.4 + T.ambition * 0.2 + T.greed * 0.2), fear: 0, anger: clamp(r.grudge), good: clamp(r.trust * 0.6 + r.affection * 0.4), tried: {} };
  const hard = Object.keys(me.known).some((id) => { const f = w.facts[id]; return f && f.actor === other.id && ['beating', 'vandalism', 'murder'].includes(f.kind) && me.known[id].knowsActor; });
  return {
    resolve: clamp(0.3 + T.courage * 0.4 + T.caution * 0.1),
    fear: clamp(0.1 + rk(other) * 0.1 + other.traits.violence * 0.2 + (hard ? 0.2 : 0) - T.courage * 0.3),
    anger: clamp(r.grudge),
    good: clamp(r.trust * 0.6 + r.affection * 0.4),
    tried: {},
  };
}
export function stance(w: World, s: Situation, id: Id): Stance {
  const m = (s.st ??= {});
  if (!m[id]) { const me = w.chars[id], other = w.chars[id === s.terms?.by ? s.terms!.of : s.terms!.by]; m[id] = freshStance(w, me, other, id === s.terms?.by); }
  return m[id];
}
const bumpTried = (x: Stance, k: string) => { (x.tried ??= {})[k] = (x.tried[k] ?? 0) + 1; return x.tried[k]; };
const tried = (x: Stance, k: string) => x.tried?.[k] ?? 0;

// ------------------------------------------------------------------ opening
export function openAsk(w: World, ak: string, a: Character, t: Character, o: { biz?: Id; amt?: number; what?: string; about?: Id; why?: string; depth?: number; parent?: Id; m?: Situation['m'] } = {}): Situation | undefined {
  const K = ASKS[ak];
  if (!K || a.id === t.id) return undefined;
  const existing = askBetween(w, ak, a.id, t.id, o.biz);
  if (existing) return existing;
  const key = `ask:${ak}:${a.id}:${t.id}:${o.biz ?? o.about ?? ''}`;
  const s = spawn(w, 'ask', key, a.id, {
    cause: o.why ?? `${a.name} wants something from ${t.name}`, sev: K.sev, phase: 'open', next: w.now + 2 * DAY,
    parties: [{ id: a.id, role: K.roles[0] }, { id: t.id, role: K.roles[1] }], biz: o.biz,
    orgs: [...new Set([a.familyId, t.familyId].filter(Boolean) as Id[])], m: o.m,
  });
  if (!s) return undefined;
  s.ak = ak;
  s.terms = { by: a.id, of: t.id, amt: o.amt, first: o.amt, what: o.what };
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
  const S = stance(w, s, t.id), A = stance(w, s, a.id);
  s.m = { ...(s.m ?? {}), at: w.now }; // when it last moved (the conversation shows a matter just raised as the thing to answer)
  const n = bumpTried(A, mv); // how often he has tried this on this man
  const wit = witnessesAt(w, t.district, [a.id, t.id], 2);
  if (s.biz && w.biz[s.biz]) w.biz[s.biz].lastApproach = w.now;
  switch (mv) {
    case 'ask':
      if (n > 1 && S.last && S.last !== 'stall') { S.anger = clamp(S.anger + 0.04); S.resolve = clamp(S.resolve + 0.03); lines.push(`${first(t)} has heard it before.`); }
      { const terms = K.phrase.ask(w, s); lines.push(a.isPlayer && !/^[“"]/.test(terms) ? `You put your terms to him: ${terms.charAt(0).toLowerCase() + terms.slice(1)}` : terms); }
      break;
    case 'sweeten': {
      const amt = K.better?.(w, s);
      if (amt === undefined) return { lines: ['There is no better offer to make.'] };
      s.terms!.amt = amt; S.good = clamp(S.good + 0.03);
      lines.push(`${a.isPlayer ? 'You come down' : `${first(a)} comes down`} to ${money(amt)}.`);
      break;
    }
    case 'persuade': {
      const g = (0.05 + a.skills.charm * 0.1) * Math.pow(0.55, n - 1);
      S.good = clamp(S.good + g); S.resolve = clamp(S.resolve - g * 0.6);
      if (n >= 3) S.anger = clamp(S.anger + 0.05);
      lines.push(n >= 3 ? `${first(t)} has heard every argument there is.` : `${a.isPlayer ? 'You put' : `${first(a)} puts`} it to him as a sensible man would.`);
      break;
    }
    case 'leverage': {
      const lv = leverageOf(w, a, t);
      if (!lv) return { lines: ['There is nothing to hold over him.'] };
      S.fear = clamp(S.fear + 0.3); S.resolve = clamp(S.resolve - 0.25); S.anger = clamp(S.anger + 0.15);
      if (lv.favour) { const f = w.favours.find((x) => x.id === lv.favour); if (f) f.settled = true; }
      tell(w, s, `${a.name} reminded ${t.name} of ${lv.what}.`, { actor: a.id, victim: t.id, minor: true });
      lines.push(`${a.isPlayer ? 'You remind' : `${first(a)} reminds`} him of ${lv.what}. He goes quiet.`);
      break;
    }
    case 'pressure': {
      const f = (0.08 + (a.skills.nerve + rk(a) * 0.15) * 0.12) * (1 - t.traits.courage * 0.5) * Math.pow(0.7, n - 1);
      S.fear = clamp(S.fear + f); S.anger = clamp(S.anger + 0.08 + t.traits.courage * 0.1);
      S.resolve = clamp(S.resolve + (t.traits.courage > 0.6 ? 0.06 : -0.06));
      tell(w, s, `${a.name} leaned on ${t.name}${s.biz ? ` at ${w.biz[s.biz]?.name}` : ''}.`, { actor: a.id, victim: t.id, witnesses: wit, minor: true });
      lines.push(`${a.isPlayer ? 'You make' : `${first(a)} makes`} it clear what saying no would cost.`);
      break;
    }
    case 'force': {
      if (!K.force) return { lines: ['Force would settle nothing here.'] };
      lines.push(K.force(w, s, a, t));
      S.fear = clamp(S.fear + 0.35); S.anger = clamp(S.anger + 0.35); S.resolve = clamp(S.resolve + (t.traits.courage > 0.65 ? 0.05 : -0.12));
      a.heat = clamp(a.heat + 0.08, 0, 1.5);
      break;
    }
    case 'senior': {
      const boss = a.bossId ? live(w, a.bossId) : undefined;
      if (!boss || rel(boss, a.id).trust < 0.45) return { lines: [`Nobody above ${a.isPlayer ? 'you' : first(a)} would put his name to this.`] };
      S.fear = clamp(S.fear + 0.12 + Math.max(0, rk(boss) - rk(t)) * 0.06); S.resolve = clamp(S.resolve - 0.1);
      if (a.isPlayer) regard(w, boss, a, 'trust', -0.03, 'lean-on-me');
      know(w, s, boss.id, 2, 'was asked to weigh in');
      tell(w, s, `${boss.name} let it be known he is behind ${a.name} on this.`, { actor: boss.id, victim: t.id, witnesses: wit, minor: true });
      lines.push(`Word goes round that ${boss.name} is behind ${a.isPlayer ? 'you' : first(a)}.`);
      break;
    }
    case 'take': {
      if (S.last !== 'counter') return { lines: ['He hasn’t offered anything.'] };
      lines.push(`${a.isPlayer ? 'You take' : `${first(a)} takes`} his terms.`);
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
  return answer(w, s, a, t, K, S, lines);
}

// How he answers. Several things at once: what it is worth to him, how afraid he is, how he feels about the man, how firmly he
// holds his ground. A trusted man can still be refused; a hated one can still be obeyed.
function answer(w: World, s: Situation, a: Character, t: Character, K: AskKind, S: Stance, lines: string[]): Outcome {
  const v = K.lean(w, s, a, t);
  const score = v + S.fear * 0.7 * (1 - t.traits.courage * 0.6) + S.good * 0.45 - S.anger * 0.55 - S.resolve * 0.55 + jitter(w, s, 'ans' + tried(stance(w, s, a.id), 'ask'));
  if (score > 0.12) return finish(w, s, a, t, K, S, lines, S.fear > S.good + 0.1);
  const c = K.counter?.(w, s, a, t);
  if (score > -0.18 && c && S.last !== 'counter') {
    S.last = 'counter'; s.m = { ...(s.m ?? {}), offer: c.amt };
    tell(w, s, `${t.name} offered ${a.name} ${money(c.amt)} instead.`, { actor: t.id, victim: a.id, minor: true });
    lines.push(a.isPlayer && K.voice?.counter ? K.voice.counter(w, s, a, t) : K.phrase.counter.replace('{amt}', money(c.amt)).replace('{why}', c.why.charAt(0).toUpperCase() + c.why.slice(1)));
    s.phase = 'counter'; s.next = w.now + 2 * DAY;
    return { answer: 'counter', lines };
  }
  // a man who already pays someone to stand behind him doesn't play for time: he sends for him
  const b = s.biz ? w.biz[s.biz] : undefined;
  const backed = !!b?.protection && b.protection.collectorId !== a.id && !!live(w, b.protection.collectorId);
  if (!backed && S.fear > 0.35 && S.resolve < 0.6 && tried(S, 'stalled') < 2) {
    bumpTried(S, 'stalled'); S.last = 'stall'; s.phase = 'stalled'; s.next = w.now + 3 * DAY;
    lines.push(a.isPlayer && K.voice?.stall ? K.voice.stall(w, s, a, t) : K.phrase.stall);
    return { answer: 'stall', lines };
  }
  S.last = 'no'; s.phase = 'refused'; s.next = w.now + 2 * DAY;
  if (!tried(S, 'refusedRec')) { bumpTried(S, 'refusedRec'); rel(t, a.id).grudge = clamp(rel(t, a.id).grudge + 0.05); }
  lines.push(a.isPlayer && K.voice?.no ? K.voice.no(w, s, a, t) : K.phrase.no);
  { const x = K.onNo?.(w, s, a, t); if (x) lines.push(x); }
  // A man who is frightened or angry enough, or asked once too often, goes to someone.
  if ((backed || S.fear + S.anger > 0.65 || tried(S, 'no') >= 2) && !s.m?.help && Number(s.m?.depth ?? 0) < 2) {
    const h = seekHelp(w, s, a, t);
    if (h) { lines.push(...h); return { answer: 'help', lines }; }
  }
  bumpTried(S, 'no');
  return { answer: 'no', lines };
}

function finish(w: World, s: Situation, a: Character, t: Character, K: AskKind, S: Stance, lines: string[], coerced: boolean): Outcome {
  if (s.m?.offer !== undefined && S.last === 'counter') s.terms!.amt = Number(s.m.offer);
  lines.push(K.yes(w, s, a, t));
  S.last = 'yes'; S.coerced = coerced;
  // how he feels about it afterwards is part of the bargain: a frightened yes is resented, a willing one is not
  if (coerced) rel(t, a.id).grudge = clamp(rel(t, a.id).grudge + 0.12);
  else if (a.isPlayer) regard(w, t, a, 'trust', 0.03, 'deal');
  else rel(t, a.id).trust = clamp(rel(t, a.id).trust + 0.03);
  closeSit(w, s, coerced ? 'gave in' : 'agreed', [coerced ? `${first(t)} agreed because he was afraid` : `${first(t)} agreed`], K.cool ?? 6);
  return { answer: 'yes', lines, closed: true };
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
    if (warn) { warn.next = w.now + 1 * DAY; if (helper.familyId && a.familyId && helper.familyId !== a.familyId) tension(w, helper, a, 1); }
    // A man from another family who is asked to protect a shop sees an opening: his people will look after it, for less.
    if (b && s.ak === 'protect' && helper !== protector && helper.familyId && helper.familyId !== a.familyId && b.protection?.familyId !== helper.familyId) {
      const offer = openAsk(w, 'protect', helper, t, { biz: b.id, amt: Math.max(10, Math.round(feeOf(b) * 0.7 / 5) * 5), why: `${helper.name} offered to look after ${b.name} himself`, depth });
      if (offer) offer.m = { ...(offer.m ?? {}), against: s.id }; // a rival offer, made on purpose against the first one
      if (offer) { offer.next = w.now + 2 * DAY; stance(w, offer, t.id).good = clamp(stance(w, offer, t.id).good + 0.25); tell(w, s, `${helper.name}'s people let it be known that ${b.name} could be looked after by them.`, { actor: helper.id, victim: a.id, witnesses: [t.id] }); }
    }
    lines.push(`${first(t)} won’t be pushed. He has people, and he means to use them.`);
    return lines;
  }
  if (t.rank === 'civilian' && t.traits.caution > 0.5 && stance(w, s, t.id).fear > 0.35) {
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
  if (w.now - s.since > 45 * DAY) return closeSit(w, s, 'faded', [], 4);
  if (a.isPlayer) {
    // the player is asked through a request, if the man asked is waiting on him; otherwise the matter simply waits for him
    s.next = w.now + 3 * DAY;
    return;
  }
  if (t.isPlayer) return askPlayer(w, s, a, t, K);
  const mv = npcMove(w, s, a, t, S);
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
  const fair = first0 ? offer / first0 : 1;
  const u: [AskMove, number][] = [
    ['ask', rounds === 0 ? 1 : last === 'stall' ? 0.45 : 0.05],
    ['take', last === 'counter' ? 0.25 + fair * 0.45 + T.caution * 0.2 - T.greed * 0.2 : -1],
    ['sweeten', last === 'counter' || last === 'no' ? (K.better?.(w, s) !== undefined ? 0.2 + T.caution * 0.2 - T.greed * 0.2 : -1) : -1],
    ['persuade', 0.15 + a.skills.charm * 0.35 + T.sociability * 0.15 - tried(A, 'persuade') * 0.2],
    ['pressure', 0.1 + T.violence * 0.35 + a.skills.nerve * 0.15 - tried(A, 'pressure') * 0.18],
    ['force', K.force && last === 'no' && tried(S, 'no') >= 1 ? T.violence * 0.6 - T.caution * 0.4 - ((a.cooldown.restraint ?? 0) > w.now ? 1 : 0) : -1],
    ['leverage', leverageOf(w, a, t) && tried(A, 'leverage') === 0 ? 0.3 + T.caution * 0.2 : -1],
    ['wait', last === 'stall' ? 0.3 + T.caution * 0.3 : 0.05 + T.caution * 0.15],
    ['drop', 0.02 + T.caution * 0.2 + (rounds >= 7 ? 0.55 : rounds >= 5 ? 0.2 : 0) + (s.m?.help ? T.caution * 0.4 : 0) - T.ambition * 0.12 - T.greed * 0.1],
  ];
  // (a kind that names its moves is held to them: nobody pressures a man into a loan he is asking for)
  return u.filter(([m]) => !K.moves || K.moves.includes(m)).map(([m, v]) => [m, v + jitter(w, s, m)] as [AskMove, number]).sort((x, y) => y[1] - x[1])[0][0];
}

// When the man is asking the player, the player is asked: once, with the same answers anyone has.
function askPlayer(w: World, s: Situation, a: Character, t: Character, K: AskKind) {
  if (s.ask && w.enc.some((e) => e.id === s.ask && e.status === 'open')) { s.next = w.now + DAY; return; }
  if (s.ask) { // he asked and you said nothing: that is an answer too
    const S = stance(w, s, t.id); S.last = 'no'; bumpTried(S, 'no');
    delete s.ask;
    const mv = npcMove(w, s, a, t, S);
    if (mv === 'drop' || s.m?.once) { move(w, s, 'drop'); return; } // (a man who asks once, on a plan of his own, takes silence as no)
  }
  const S = stance(w, s, t.id);
  const opts = [{ code: 'yes', label: 'Agree', hint: 'Do what he asks.' }, { code: 'no', label: 'Refuse', hint: 'He will remember it.' }];
  if (K.counter && s.terms?.amt) opts.splice(1, 0, { code: 'counter', label: 'Name your own terms', hint: 'Meet him part way.' });
  opts.push({ code: 'stall', label: 'Buy time', hint: 'Not yes, not no. Not for ever.' });
  const e = addEnc(w, { kind: 'ask', from: a.id, title: K.title(w, s), days: 4, lines: [...(s.m?.why ? [String(s.m.why)] : []), K.phrase.ask(w, s)], opts, data: { sit: s.id } });
  s.ask = e.id; s.next = e.expires; void S;
}

// The player answers an ask put to him (encounters.choose sends kind 'ask' here).
export function answerAsk(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const s = sits(w).find((x) => x.id === String(e.data?.sit));
  e.status = 'done';
  if (!s || !isOpen(s)) return { lines: ['It has already been settled.'], minutes: 5 };
  const K = kindOf(s)!, a = asker(w, s)!;
  const S = stance(w, s, p.id);
  delete s.ask;
  if (code === 'yes') { const o = finish(w, s, a, p, K, S, [], false); return { lines: o.lines, minutes: 20 }; }
  if (code === 'counter') { const amt = Math.round((s.terms?.amt ?? 0) * 0.6 / 5) * 5; S.last = 'counter'; s.m = { ...(s.m ?? {}), offer: amt }; tell(w, s, `${p.name} offered ${a.name} ${money(amt)} instead.`, { actor: p.id, victim: a.id, minor: true }); s.next = w.now + DAY; return { lines: [`You offer ${money(amt)}. ${first(a)} says he will think about it.`], minutes: 20 }; }
  if (code === 'stall') { S.last = 'stall'; bumpTried(S, 'stalled'); s.next = w.now + 3 * DAY; return { lines: [`You tell ${first(a)} you need a few days. He gives you them, and no more.`], minutes: 15 }; }
  S.last = 'no'; bumpTried(S, 'no'); rel(a, p.id).grudge = clamp(rel(a, p.id).grudge + 0.06);
  tell(w, s, `${p.name} turned ${a.name} down.`, { actor: p.id, victim: a.id, minor: true });
  { const x = K.onNo?.(w, s, a, p); if (x) { closeSit(w, s, 'refused', [`${first(p)} said no`], K.cool ?? 6); return { lines: [`You tell ${first(a)} no.`, x], minutes: 15 }; } }
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
    rel(boss, a.id).trust = clamp(rel(boss, a.id).trust - (messy ? 0.06 : 0.02));
    if (messy && boss.traits.caution > 0.5) { tell(w, s, `${boss.name} told ${a.name} to leave it alone.`, { actor: boss.id, victim: a.id, minor: true }); closeSit(w, s, 'called off', [`${first(boss)} called it off`], 6); }
  }
}
export const titleOf = (w: World, s: Situation) => kindOf(s)?.title(w, s) ?? s.cause;
export function answerWord(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const boss = e.from ? w.chars[e.from] : undefined;
  e.status = 'done';
  if (!boss) return { lines: ['He has moved on to other things.'], minutes: 5 };
  const s = sits(w).find((x) => x.id === String(e.data?.sit));
  if (code === 'sorry') {
    regard(w, boss, p, 'trust', 0.02, 'apology');
    if (s && isOpen(s) && s.terms?.by === p.id) { tell(w, s, `${p.name} told ${boss.name} it would not happen again.`, { actor: p.id, victim: boss.id, minor: true }); closeSit(w, s, 'called off', [`${first(boss)} made you drop it`], 6); }
    return { lines: [`${first(boss)} looks at you a long moment. "Good. Then it’s finished." You let the matter go.`], minutes: 30 };
  }
  // explaining is a gamble on how he sees you and how well you argue
  const ok = rel(boss, p.id).trust * 0.6 + p.skills.charm * 0.4 + boss.traits.ambition * 0.2 - boss.traits.caution * 0.3 > 0.35;
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
  if (S.last === 'counter') add('take', `Take his ${money(Number(s.m?.offer ?? 0))}`, 'Settle on his terms.');
  if (!S.last || S.last === 'stall') add('ask', S.last === 'stall' ? 'Ask again' : 'Make the offer', S.last === 'stall' ? 'He asked for time. Has he had enough?' : 'Put it to him plainly.');
  const better = K.better?.(w, s);
  add('sweeten', better !== undefined ? K.sweeten?.(better) ?? `Come down to ${money(better)}` : 'Offer better terms', 'Less for you, easier for him.', better === undefined ? 'You can’t go lower.' : undefined);
  add('persuade', 'Reason with him', tried(S, 'persuade') >= 2 ? 'He’s heard your arguments.' : 'Make him see sense.');
  const lv = leverageOf(w, p, t);
  add('leverage', 'Remind him what you know', lv ? `Use ${lv.what}.` : 'You need something on him first.', lv ? undefined : 'You have nothing on him.');
  add('pressure', 'Lean on him', 'Fear works. So does resentment, later.');
  if (K.force) add('force', 'Make an example', 'Loud, and it will be talked about.');
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  add('senior', boss ? `Let him know ${first(boss)} is behind you` : 'Bring in someone senior', 'It costs you with your boss.', !boss || rel(boss, p.id).trust < 0.45 ? 'Nobody above you would put his name to this.' : undefined);
  add('drop', 'Let it go', 'Walk away. People notice.');
  return out;
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
    return afford * 0.35 + covered + Math.min(0.25, street * 0.06) - 0.2;
  },
  yes: (w, s, a, t) => {
    const b = w.biz[s.biz!], fee = s.terms?.amt ?? feeOf(b), prev = b.protection;
    setCollector(w, b, a.id, a.familyId!, { fee });
    if (prev && prev.collectorId !== a.id && w.chars[prev.collectorId]) {
      const pc = w.chars[prev.collectorId];
      const f = addFact(w, { kind: 'poach', actor: a.id, victim: pc.id, business: b.id, story: 'sit:' + s.id, text: `${a.name} (${famName(w, a)}) took ${b.name} from ${pc.name} (${famName(w, pc)}).`, district: b.district }, { witnesses: [t.id] });
      b.informPrev = { who: pc.id, fact: f.id };
      tension(w, a, pc, 2);
      return `${t.name} will pay ${money(fee)} a week, to ${a.isPlayer ? 'you' : first(a)} now. ${pc.name} will hear of it.`;
    }
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
  onNo: (w, s, a, t) => {
    const b = w.biz[s.biz!];
    const f = tell(w, s, `${t.name} told ${a.name} to get out of ${b.name}.`, { kind: 'protection_refused', actor: t.id, victim: a.id, witnesses: witnessesAt(w, b.district, [a.id, t.id], 2), minor: !!s.m?.refusal });
    s.m = { ...(s.m ?? {}), refusal: s.m?.refusal ?? f.id };
    return undefined;
  },
  phrase: {
    ask: (w, s) => { const b = w.biz[s.biz!]; return `${money(s.terms?.amt ?? feeOf(b))} a week, and nothing happens to ${b.name}.`; },
    yes: 'He agrees.', no: '"No. Get out of my shop."', counter: '"I can do {amt} a week. Not a cent more. {why}."', stall: '"Come back Friday. I need to think."',
  },
};
// ---------------------------------------------------------------- warning a man off
ASKS.warn = {
  id: 'warn', sev: 0.35, roles: ['warns', 'warned'],
  title: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); const ot = o ? askee(w, o) : undefined; return ot ? `Leave ${first(ot)} alone` : 'A warning'; },
  valid: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); return !!o && isOpen(o); },
  lean: (w, s, a, t) => {
    const o = sits(w).find((x) => x.id === String(s.m?.about));
    const want = o ? stance(w, o, t.id).resolve : 0.5; // how much he wants the thing he is being warned off
    const outranked = (rk(a) - rk(t)) * 0.15;
    const sameFam = a.familyId && a.familyId === t.familyId ? 0.15 : 0;
    return outranked + sameFam - want * 0.4 + 0.05;
  },
  yes: (w, s, a, t) => {
    const o = sits(w).find((x) => x.id === String(s.m?.about));
    if (o && isOpen(o)) { tell(w, o, `${t.name} backed off after ${a.name} had a word.`, { actor: t.id, victim: a.id, minor: true }); closeSit(w, o, 'warned off', [`${first(a)} made ${first(t)} back off`], 8); }
    if (t.isPlayer) regard(w, a, t, 'respect', 0.02, 'backoff'); else rel(a, t.id).respect = clamp(rel(a, t.id).respect + 0.02);
    return `${t.isPlayer ? 'You back' : `${first(t)} backs`} off.`;
  },
  force: (w, s, a, t) => {
    t.hurtUntil = Math.max(t.hurtUntil, w.now + 3 * DAY);
    tell(w, s, `${a.name}'s people roughed up ${t.name} to make the point.`, { kind: 'beating', actor: a.id, victim: t.id, witnesses: witnessesAt(w, t.district, [a.id, t.id], 2) });
    if (a.familyId && t.familyId && a.familyId !== t.familyId) tension(w, a, t, 2);
    return `${t.isPlayer ? 'You are' : `${first(t)} is`} roughed up, to make the point.`;
  },
  phrase: {
    ask: (w, s) => { const o = sits(w).find((x) => x.id === String(s.m?.about)); const ot = o ? askee(w, o) : undefined; return `"${ot ? first(ot) : 'He'} is with me. Leave it alone."`; },
    yes: 'He backs off.', no: '"It’s none of your business."', counter: '', stall: '"I’ll think about it."',
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
    yes: 'He pays.', no: '"I don’t have it."', counter: '"I can give you {amt}. {why}."', stall: '"Friday. I swear to God, Friday."',
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
    rel(a, t.id).grudge = clamp(rel(a, t.id).grudge + 0.15);
    rel(a, t.id).trust = clamp(rel(a, t.id).trust - 0.15);
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
    const amt = Math.min(s.terms?.amt ?? 0, Math.floor(t.cash * 0.6)), pos = loanPosition(w, t, a, amt);
    t.cash -= amt; a.cash += amt;
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
    yes: 'He lends it.', no: '"I can’t do it."', counter: '"I can do {amt}. {why}."', stall: '"Let me see what I have. Come back in a few days."',
  },
};
// ---------------------------------------------------------------- offering a man a loan
ASKS.lend = {
  id: 'lend', sev: 0.12, roles: ['lender', 'borrower'], cool: 2,
  moves: ['take', 'ask', 'persuade', 'wait', 'drop'],
  title: (w, s) => { const t = askee(w, s); return t ? `A loan to ${first(t)}` : 'A loan'; },
  valid: (w, s) => { const a = asker(w, s); return !!a && a.cash >= (s.terms?.amt ?? 0) && !w.debts.some((d) => d.status === 'active' && d.debtor === s.terms?.of && d.creditor === s.terms?.by); },
  lean: (w, s, a, t) => {
    const b = ownerBiz(w, t.id);
    const need = b && (b.cash < 250 || b.distress > 0) ? 0.35 : t.cash < 150 ? 0.25 : 0.05;
    return need + (1 - t.traits.caution) * 0.15 - 0.3;
  },
  counter: (w, s, a, t) => { const amt = s.terms?.amt ?? 0, b = ownerBiz(w, t.id); return amt >= 1000 && !(b && b.distress > 0) ? { amt: 500, why: 'I don’t need more than that' } : undefined; },
  yes: (w, s, a, t) => {
    const amt = s.terms?.amt ?? 0;
    a.cash -= amt; t.cash += amt;
    const d = createDebt(w, a.id, t.id, amt, 0.05, 'business loan');
    const f = addFact(w, { kind: 'loan', actor: a.id, victim: t.id, amount: amt, story: 'sit:' + s.id, text: `${a.name} lent ${t.name} ${money(amt)}.`, district: t.district });
    d.cause = f.id;
    return `${t.name} takes the ${money(amt)}. ${money(d.weeklyPayment)} a week, five percent on top. He shakes on it and holds ${a.isPlayer ? 'your' : 'his'} hand a second too long.`;
  },
  phrase: {
    ask: (w, s) => `${money(s.terms?.amt ?? 0)}, if he needs it. Five percent a week.`,
    yes: 'He takes it.', no: '"Thanks. I’d rather not owe anybody."', counter: '"{amt} would do it. {why}."', stall: '"Let me think about it."',
  },
};
void kinOf;
