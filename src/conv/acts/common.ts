// What every interaction module shares: the two men, how he feels about the player (read only: peek), his changes of regard (through
// doors.ts), and the small ways a result is put together. Moved from the old engine's sayRaw preamble (tweak, stay) without its menus.
import { peek } from '../../core';
import { say as vsay } from '../../voicesheet';
import type { Character, World } from '../../types';
import * as door from '../doors';
import type { Ctx, Offer, Out } from '../kit';
import { says as sayLine } from '../kit';
import type { Decision } from '../types';
import { speechFor } from './words';

export interface T { c: Ctx; w: World; p: Character; t: Character }
export const T = (c: Ctx): T => ({ c, w: c.w, p: c.h, t: c.n });
// how he stands with the player, and the player with him (as each feels it now)
export const R = (x: T) => peek(x.t, x.p.id);
export const RP = (x: T) => peek(x.p, x.t.id);
// what he thinks of the player moves: trust, liking, respect, in that order (the old engine's tweak, through the one door for regard)
export function tweak(x: T, trust: number, aff = 0, resp = 0, why?: string) {
  door.regard(x.w, x.t, x.p.id, 'trust', trust, why);
  door.regard(x.w, x.t, x.p.id, 'affection', aff, why);
  door.regard(x.w, x.t, x.p.id, 'respect', resp, why);
}
// a line of his, or of what happens (in his own idiom where the world's voice has one: voicesheet), with the decision that led to it
export function line(x: T, text: string, d?: Decision) { sayLine(x.c, speechFor(x.w, x.p, x.t, text), d); }
export const voice = (x: T, key: string, sub?: Record<string, string>) => vsay(x.w, x.t, x.p, key, sub);
export const first = (c: Character) => c.name.split(' ')[0];
// offers of a single act, when it applies
export const one = (cond: unknown, o: Offer): Offer[] => (cond ? [o] : []);
export const out = (minutes: number, next?: Offer[]): Out => ({ minutes, ...(next?.length ? { next } : {}) });
