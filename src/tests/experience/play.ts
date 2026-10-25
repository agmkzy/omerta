// The player-experience harness (the coherence repair, docs/coherence/): conversations played the way the screen plays them, with
// what was said kept as structured turns, and the checks that tell a believable exchange from a broken one. The checks read the
// records behind the words (who a request names, whom a job is from, which choice was made before) wherever they can, and fall back
// on the words only for what has no record: a man naming the player as somebody else in the room.
import assert from 'node:assert';
import { begin, choose, everything, type Choice, type Visit } from '../../conv/visit';
import { social } from '../../conv/social';
import { DAY, type Character, type Id, type World } from '../../types';
import { createWorld } from '../../world';
import { P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
export const first = (c: Character) => c.name.split(' ')[0];

/** One exchange: what the player chose (its id and the words he said), and what came back. */
export interface Turn { id: string; label: string; again: boolean; his: string[]; narr: string[]; cards: string[]; choices: Choice[] }

/** A man accusing the player of saying it before, or brushing him off as going over old ground. */
export const REPEAT = /already (said|told|asked|answered|been over|gave|did this)|I already said|said that already|Keep up|We just did this|Short memory|We did that one|nothing more to say on it|heard it before|been over (that|this)|You keep saying|Again\? |Try another|said that already|Don’t ask twice|gave you my answer/i;

/** A conversation, played as the screen plays it: only what is on the screen (or one heading away) can be chosen. */
export class Talk {
  v: Visit; turns: Turn[] = []; picked: string[] = [];
  /** `seen`: what the player has already put to men earlier the same day (shared across conversations), so a second visit's ask is "again" */
  constructor(public w: World, public npc: Character, o: { approach?: Id; seen?: Set<string> } = {}) {
    this.seen = o.seen;
    const p = P(w); (p.intro ??= {})[npc.id] ??= w.now;
    this.v = begin(w, npc.id, o);
    this.turns.push({ id: '(opening)', label: '', again: false, ...this.split(0), choices: [...this.v.choices] });
  }
  seen?: Set<string>;
  get ended() { return !!this.v.ended; }
  private split(from: number) {
    const ls = this.v.lines.slice(from);
    return { his: ls.filter((l) => l.who === 'him').map((l) => l.text), narr: ls.filter((l) => l.who === 'narr').map((l) => l.text), cards: ls.filter((l) => l.who === 'card').map((l) => l.text) };
  }
  /** What can be said now, and under the headings (the full list, as "Something else…" and "Other…" open it). */
  reachable(): Choice[] { return this.ended ? [] : [...this.v.choices, ...everything(this.w, this.v)]; }
  find(m: RegExp | ((c: Choice) => boolean)): Choice | undefined {
    const hit = typeof m === 'function' ? m : (c: Choice) => m.test(c.label) || m.test(c.says ?? '') || m.test(c.id);
    return this.v.choices.find(hit) ?? this.reachable().find(hit);
  }
  has(m: RegExp | ((c: Choice) => boolean)) { return !!this.find(m); }
  /** Choose as a player would: on the screen, or by opening the heading it is under. */
  say(m: RegExp | string | ((c: Choice) => boolean), amount?: number): Turn {
    const hit = typeof m === 'string' ? (c: Choice) => c.id === m : typeof m === 'function' ? m : (c: Choice) => m.test(c.label) || m.test(c.says ?? '') || m.test(c.id);
    let c = this.v.choices.find(hit);
    if (!c && !this.ended) for (const k of ['business', 'personal', 'confront']) {
      choose(this.w, this.v, 'home');
      if (!this.v.choices.some((x) => x.id === 'u:' + k)) continue;
      choose(this.w, this.v, 'u:' + k); c = this.v.choices.find(hit);
      if (!c && this.v.choices.some((x) => x.id === 'all:' + k)) { choose(this.w, this.v, 'all:' + k); c = this.v.choices.find(hit); }
      if (c) break;
    }
    c ??= this.reachable().find(hit);
    assert.ok(c, `with ${this.npc.name}: nothing matching ${m} among: ${this.v.choices.map((x) => x.label).join(' | ')}`);
    const id = c.amount ? `${c.id}:${amount ?? c.amount.value}` : c.id;
    const key = `${this.npc.id}|${Math.floor(this.w.now / DAY)}|${id}`;
    const from = this.v.lines.length, again = this.picked.includes(id) || !!this.seen?.has(key);
    this.seen?.add(key);
    choose(this.w, this.v, id);
    this.picked.push(id);
    const t: Turn = { id, label: c.says ?? c.label, again, ...this.split(from), choices: [...this.v.choices] };
    // (the player's own words are the first line said; they are not his)
    this.turns.push(t);
    return t;
  }
  leave() { if (!this.ended) choose(this.w, this.v, 'leave'); }
  /** Everything he said in this conversation. */
  his() { return this.turns.flatMap((t) => t.his); }
  /** Replies that treat something the player had not said before in this conversation as a repetition. */
  falseRepeats(): Turn[] { return this.turns.filter((t) => !t.again && t.id !== '(opening)' && t.his.some((l) => REPEAT.test(l))); }
  transcript(): string {
    return this.turns.map((t) => [t.id === '(opening)' ? '' : `> ${t.label}  [${t.id}]`, ...t.narr.map((l) => `  (${l})`), ...t.his.map((l) => `  ${first(this.npc)}: ${l}`), ...t.cards.map((l) => `  [${l}]`)].filter(Boolean).join('\n')).join('\n');
  }
}

// ---------------------------------------------------------------- checks on what the records say

/** Requests that ask a man to act against himself: the man asked is the man it is against (or the one it is for, against himself). */
export function selfRequests(w: World) { return social(w).requests.filter((r) => (r.against && r.of === r.against) || (r.for && r.against && r.for === r.against)); }
/** Work offered by a man to himself. */
export function selfJobs(w: World) { return w.jobs.filter((j) => j.giver && j.giver === j.assignee); }
/** Promises the player made to act against himself. */
export function selfPromises(w: World) { const p = P(w); return social(w).obs.filter((o) => o.obligor === p.id && o.matter?.against === p.id); }

/**
 * Lines in which a man speaks of the player, to the player, as a third person in the matter: "Lawrence wants money off me",
 * "Lawrence’s people haven’t been back". Naming him in address ("Lawrence, sit down") is ordinary.
 */
export function thirdPersonSelf(w: World, lines: string[]): string[] {
  const p = P(w), f = first(p), full = p.name;
  const third = new RegExp(`\\b(${full}|${f})(’s|'s)?\\s+(wants|has|is|was|did|came|took|asked|said|won’t|doesn’t|didn’t|answers|people|men|boys|been|keeps|leans|knows|told)\\b`);
  return lines.filter((l) => third.test(l));
}
/** Choices whose words have the player speak of himself as another man ("Mickey’s having trouble with Lawrence Oliveri"). */
export function selfChoices(w: World, cs: Choice[]): Choice[] {
  const p = P(w), n = `(${p.name}|${first(p)})`;
  const third = new RegExp(`\\b${n}(’s|'s)?\\s+(wants|has|is|was|did|came|took|asked|said|won’t|doesn’t|didn’t|answers|people|men|been|keeps|leans|knows|told)\\b|\\b(with|against|from|by|between|and|about|to|answer to|over)\\s+${n}\\b`);
  return cs.filter((c) => third.test(c.label + ' ' + (c.says ?? '')));
}
/** Choices in which the player speaks of the man in front of him as somebody else ("What happened to Marty?", said to Marty). */
export function aboutHimToHim(npc: Character, cs: Choice[], w?: World): Choice[] {
  const f = first(npc), voc = new RegExp(`^[“"]?${f},`);
  // (by his first name only when nobody else the player could mean has it)
  const shared = !!w && Object.values(w.chars).some((c) => c.id !== npc.id && c.alive && first(c) === f);
  const named = (s: string) => s.includes(npc.name) || (!shared && new RegExp(`\\b${f}\\b`).test(s));
  return cs.filter((c) => [c.label, c.says ?? ''].some((s) => named(s) && !voc.test(s)));
}

// ---------------------------------------------------------------- worlds

/** World `seed` at day 0 with the player named as given (the playtest's names, so lines read the same). */
export const worldFor = (seed: number, name = 'Lawrence Oliveri') => createWorld(seed, name);
/** The player's captain: the man he answers to. */
export const captain = (w: World) => w.chars[P(w).bossId!];
/** Open shops owned by civilians that pay nobody, nearest the player's ground first (by id for determinism). */
export function freeShops(w: World) {
  return Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && !b.protection && w.chars[b.ownerId]?.alive && w.chars[b.ownerId].rank === 'civilian' && !w.chars[b.ownerId].isPlayer).sort(byId);
}
/** Men of the player's family other than his captain, by rank (soldiers first) then id. */
export function familyMen(w: World, rank?: Character['rank']) {
  const p = P(w);
  return Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.id !== p.bossId && (!rank || c.rank === rank)).sort(byId);
}
/** Set how a man stands with the player (and that they have met). */
export function standWith(w: World, c: Character, r: Partial<{ trust: number; respect: number; affection: number; grudge: number; fear: number; known: number }>) {
  const p = P(w); (p.intro ??= {})[c.id] ??= w.now;
  c.rels[p.id] = { trust: 0.3, respect: 0.3, affection: 0.2, grudge: 0, fear: 0, known: 0.4, lastMet: w.now, ...(c.rels[p.id] ?? {}), ...r } as never;
}
export const days = (n: number) => n * DAY;
