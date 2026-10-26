// The conversation's shared kit (Gate 4): what a visit is, how a man's words are said and remembered, and the shape of an interaction
// (an Act): what can be put to him now (offers), and what happens when it is (run: his decision, made through the layer's decision
// records, then what it does to the world, through doors.ts only, then his words). visit.ts runs the conversation; conv/acts/* hold
// the interactions themselves, by domain.
import { peek } from '../core';
import { DAY, type Character, type Id, type World } from '../types';
import type { Meeting } from '../meetings';
import { newSession, perceive, type Perception, type Session } from './perception';
import { render } from './render';
import type { Reply } from './respond';
import { social } from './social';
import { speechFor } from './acts/words';
import type { Decision } from './types';

export type Pane = 'business' | 'personal' | 'confront';
export const PANES: Pane[] = ['business', 'personal', 'confront'];
// a figure the player names himself: the amount (and for a loan the weekly rate), within what the matter allows
export interface Amount { value: number; min: number; max: number; step: number; rate?: { value: number; min: number; max: number } }
// What this conversation is on, and what has passed in it (not saved: a visit is over when the player leaves)
export interface Thread {
  fact?: Id; subject?: Id;   // the event, or the man, the talk has turned to
  deal?: Deal;               // a figure being haggled over
  asked: string[];           // what has been put to him in this visit (an approach made is not made twice)
  denied?: boolean;          // he has denied the event in hand
  patience?: number; cold?: boolean; shut?: boolean; raised: string[]; // how much more of this he will take (see visit.govern)
  spoken: string[];          // long lines he has said in this visit, not said twice
  used?: string[];           // what has been said or done in this visit (it gives nothing the second time)
  loan?: { amt: number; made: string[] }; // a loan being asked for in this visit: the arguments made for it, in order
  picked?: string[];         // every choice the player has made in this visit: a reply may call a choice "again" only if it is in here
}
export interface Deal { kind: 'fee' | 'ext'; biz?: Id; debt?: Id; ask: number; offer?: number; old?: number }
// Something the player can say now: its code (an act's base, and what it is about), the words, and where it belongs
export interface Offer { code: string; label: string; note?: string; amount?: Amount; says?: string; kind?: 'his' | 'between' | 'mind' | 'lead' | 'other'; pane?: Pane; cost?: number } // (cost: what it takes out of the player's pocket; not offered if he hasn't it)
// What an interaction leads to: the next things it is natural to say (answers to what he just said), or the end of the visit
export interface Out { minutes?: number; next?: Offer[]; end?: boolean; meeting?: Meeting; settle?: boolean; skip?: boolean; keepTopic?: boolean }
export interface Act {
  base: string; pane: Pane;
  offers?: (c: Ctx) => Offer[];          // what can be put to him now; none: it is only ever an answer to what he has said
  run: (c: Ctx, code: string) => Out | void;
  nav?: boolean;                         // an answer within what is in hand (a haggle's terms): no patience spent, not 'said' for the visit
  opens?: boolean;                       // it opens a subject (a matter, his trouble, what he asked): it can be come back to; it costs no patience
  social?: boolean;                      // ordinary talk: worth less the third time in a day, the seventh in a week, and only so much
  repeat?: { window: number; sig: (c: Ctx, arg: string) => string; round?: boolean }; // asked again, unchanged, within the window
  conduct?: (c: Ctx, before: { cash: number }) => void; // what doing it says about the kind of man the player is
  offersFor?: (c: Ctx, id: string) => Offer[];          // the answers to a matter or a request of his, by its id
  questions?: (c: Ctx) => Offer[];                      // what can be asked next about the subject in hand
}

// ---------------------------------------------------------------- what the engine hands a screen
export interface Say { who: 'him' | 'you' | 'narr' | 'card'; text: string; trace?: string[] }
// label: what the button says (a line, or for an approach its name); says: what the player then says, when that is not the label
export interface Choice { id: string; label: string; says?: string; note?: string; group: 'reply' | 'matter' | 'social' | 'intent' | 'more' | 'leave'; amount?: Amount; pane?: Pane }
export interface Visit {
  npc: Id; where: string; t0: number;
  lines: Say[];            // this visit so far
  choices: Choice[];       // what he can say now
  relation: string;        // who the man is to him, in a word or two (for the header)
  topic?: string;          // what is being talked about, if anything in particular
  ended?: boolean;
  more?: boolean;          // the full list is open ("Something else…")
  mem: { said: string[]; argued: string[]; pressed: number; points: string[]; offered: Record<string, number | boolean | string> };
  approach?: Id;           // the request he came to you with, when he came to you
  pane?: Pane;             // the heading the talk is under (Business, Personal, Confront), when it is under one
  th: Thread;              // what this conversation is on
  waiting?: { q: string; choices: Choice[] }; // a question he put to the player and is still waiting on: it stays his until answered
}
// What has passed between the player and a man across visits, as it bears on what is said next (kept small: World.social.talks)
export interface TalkMemory { visits: number; last: number; topics: { k: string; t: number; out: string; sig?: string }[]; heard: string[] }

export const first = (n: string) => n.split(' ')[0];
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const talks = (w: World) => (social(w).talks ??= {});
export function memOf(w: World, id: Id): TalkMemory { return (talks(w)[id] ??= { visits: 0, last: -1e9, topics: [], heard: [] }); }
export function remember(w: World, id: Id, k: string, out: string, sig?: string) { const m = memOf(w, id); m.topics.push({ k, t: w.now, out, sig }); if (m.topics.length > 24) m.topics.splice(0, m.topics.length - 24); } // (enough to hold a refusal and what has been said since)
export const lastOf = (w: World, id: Id, k: string) => [...memOf(w, id).topics].reverse().find((x) => x.k === k);
export const agoWords = (now: number, t: number) => { const d = Math.floor(now / DAY) - Math.floor(t / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : d < 14 ? 'last week' : `${Math.round(d / 7)} weeks ago`; };

// ---------------------------------------------------------------- context
export interface Ctx { w: World; h: Character; n: Character; v: Visit; s: Session; pn: () => Perception; ph: () => Perception; memo: Map<string, unknown> }
// (what one screen asks of the engines more than once, asked once: cleared whenever the world may have moved, see general)
export const memo = <T>(c: Ctx, k: string, f: () => T): T => { if (!c.memo.has(k)) c.memo.set(k, f()); return c.memo.get(k) as T; };
export function ctx(w: World, v: Visit): Ctx {
  const h = w.chars[w.playerId!], n = w.chars[v.npc], s = newSession();
  // what he knows of who the player is: if they have met, the player's family is known to him
  if (acquainted(w, h, n) && h.familyId) s.told[n.id] = { [h.id]: { family: w.fam[h.familyId].name, name: h.name, basis: { kind: 'seen', ref: 'they have met' } } };
  return { w, h, n, v, s, pn: () => perceive(w, s, n), ph: () => perceive(w, s, h), memo: new Map() };
}
// whether they know each other: a fact of the world, not a choice of greeting (spec §17; the Scenario G Marty Bellini fault)
export function acquainted(w: World, h: Character, n: Character): boolean {
  if (h.intro?.[n.id] != null || (talks(w)[n.id]?.visits ?? 0) > 0) return true;
  if (n.id === h.bossId || n.bossId === h.id || (h.bossId && n.bossId === h.bossId)) return true;
  return (peek(n, h.id).known ?? 0) >= 0.15;
}
// what he is to the player, as a fact (the header says it; the greeting is chosen from it, its wording only varies in style)
export function relationOf(w: World, h: Character, n: Character): { level: 'stranger' | 'acquaintance' | 'friend' | 'cold' | 'hostile'; words: string } {
  if (!acquainted(w, h, n)) return { level: 'stranger', words: 'You haven’t met.' };
  const r = peek(n, h.id);
  if (r.grudge >= 0.3) return { level: 'hostile', words: 'He has no love for you.' };
  if ((r.known ?? 0) > 0.25 && r.trust < 0.06) return { level: 'cold', words: 'He doesn’t trust you.' };
  // (what he is to the player, said as how he behaves: trust and liking are not the same thing, nor respect and liking, nor knowing
  // a man and confiding in him)
  if (r.trust >= 0.5 && r.affection < 0.25) return { level: 'friend', words: 'He trusts you. It isn’t friendship.' };
  if (r.affection >= 0.35 && r.trust < 0.3) return { level: 'friend', words: 'He likes you. He doesn’t trust you yet.' };
  if (r.affection >= 0.35 || r.trust >= 0.5) return { level: 'friend', words: 'He likes you.' };
  if ((r.fear ?? 0) >= 0.3) return { level: 'acquaintance', words: 'He’s wary of you.' };
  if (r.respect >= 0.55 && r.affection < 0.2) return { level: 'acquaintance', words: 'He respects you. He doesn’t much like you.' };
  if ((r.known ?? 0) >= 0.5 && r.trust < 0.3) return { level: 'acquaintance', words: 'He knows you well, and keeps his own counsel.' };
  const m = talks(w)[n.id];
  return { level: 'acquaintance', words: m?.visits ? `You’ve been to see him ${m.visits === 1 ? 'once before' : m.visits < 5 ? 'a few times' : 'often'}.` : 'You know each other.' };
}

// ---------------------------------------------------------------- lines
export function him(c: Ctx, r: Reply, salt = '') {
  const heard = memOf(c.w, c.n.id).heard, m0 = { ...r.meaning, slots: { selfFirst: first(c.h.name), ...(r.meaning.slots ?? {}) } };
  let text = render(m0, c.n.id, c.pn().arch, new Set([...c.v.mem.said, ...heard]), salt + c.v.lines.length);
  // (every way he has of saying it has been heard lately: the one heard longest ago, not his favourite again)
  for (let k = heard.length - 1; k >= 0 && heard.includes(text); k--) text = render(m0, c.n.id, c.pn().arch, new Set([...c.v.mem.said, ...heard.slice(k)]), salt + c.v.lines.length);
  c.v.mem.said.push(text);
  const m = memOf(c.w, c.n.id); m.heard.push(text); if (m.heard.length > 12) m.heard.shift();
  text = speechFor(c.w, c.h, c.n, text);
  const d = r.decision, trace = [...(d.constraints.length ? [`constraints: ${d.constraints.map((x) => x.kind + ' (' + x.source + ')').join('; ')}`] : []), ...[...d.candidates].sort((a, b) => b.value - a.value).filter((x) => x.value > -9).map((x) => `${x.move === d.chosen ? '▶' : ' '} ${x.move} ${x.value}: ${x.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`), `meaning ${r.meaning.key}${r.meaning.grounds ? '.' + r.meaning.grounds : ''}${r.meaning.role ? ' (' + r.meaning.role + ')' : ''}; ${r.honest ? 'honest' : 'NOT honest'}${r.aim ? '; aim: ' + r.aim : ''}`, ...(r.changes ?? [])];
  c.v.lines.push({ who: 'him', text, trace });
}
export const plain = (by: Id, key: string, slots: Record<string, string> = {}, stance: Reply['meaning']['stance'] = 'flat'): Reply => ({ decision: { by, constraints: [], candidates: [], chosen: key }, meaning: { key, stance, toward: 'speaker', slots }, intent: key, honest: true });
export function you(c: Ctx, label: string) { c.v.lines.push({ who: 'you', text: label }); }
export function narr(c: Ctx, text: string) { c.v.lines.push({ who: 'narr', text }); }
export function card(c: Ctx, key: string, slots: Record<string, string> = {}) { c.v.lines.push({ who: 'card', text: render({ key, stance: 'flat', toward: 'speaker', slots: { first: first(c.n.name), ...slots } }, 'card', 'earnest') }); }
export const line = (c: Ctx, key: string, slots: Record<string, string> = {}) => render({ key, stance: 'flat', toward: 'speaker', slots: { selfName: c.h.name, selfFirst: first(c.h.name), selfFamily: c.h.familyId ? c.w.fam[c.h.familyId].name : '', ...slots } }, c.h.id, 'earnest');

// He says something the decision has already settled, in words from the world's shared voice (voicesheet) or the old pools: the
// decision is kept with the line, for the developer view, as with every line he says
export function says(c: Ctx, text: string, d?: Decision) {
  // (in front of him, a line is not attributed by his full name, as if read from a record: "…,” says Louie Costa." is "…,” he says.")
  const t = speechFor(c.w, c.h, c.n, text).replace(new RegExp(`([,.!?]?["”]) says ${c.n.name}([.,])`, 'g'), '$1 he says$2').replace(new RegExp(`says ${c.n.name}\\.`, 'g'), 'he says.').replace(/"([^"]*)"/g, '“$1”').replace(new RegExp(`^(${c.n.name}|${first(c.n.name)}): (?=“)`), '');
  c.v.mem.said.push(t);
  const m = memOf(c.w, c.n.id); m.heard.push(t); if (m.heard.length > 12) m.heard.shift();
  c.v.lines.push({ who: /^“/.test(t) || new RegExp(`^(He|His|${first(c.n.name)}|${c.n.name})\\b[^“]{0,80}“`).test(t) ? 'him' : 'narr', text: t.replace(new RegExp(`^${c.n.name} `), 'He '), trace: d ? traceOf(d) : undefined });
}
export const traceOf = (d: Decision) => [...(d.constraints.length ? [`constraints: ${d.constraints.map((x) => x.kind + ' (' + x.source + ')').join('; ')}`] : []), ...[...d.candidates].sort((a, b) => b.value - a.value).filter((x) => x.value > -9).map((x) => `${x.move === d.chosen ? '▶' : ' '} ${x.move} ${x.value}: ${x.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`), ...(d.aim ? [`aim: ${d.aim}`] : [])];
export const newThread = (): Thread => ({ asked: [], raised: [], spoken: [] });
// What he says when the player comes back to something he has already said in this visit, for the first time (not a repeat of the
// player's: a turn back to it): the same point, put as a man puts a thing he has said once already, never as "you're repeating yourself"
export function restate(text: string): string {
  const m = /^“([^”]+)”(.*)$/.exec(text);
  if (!m) return text;
  const body = m[1].charAt(0) === 'I' && /^I\b/.test(m[1]) ? m[1] : m[1].charAt(0).toLowerCase() + m[1].slice(1);
  return `“Like I said, ${body}”${m[2]}`;
}
