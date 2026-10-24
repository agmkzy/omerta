// Gate 3: who is looking for the player, and why (spec §6.8, §17.6). Every one of these is a man who has decided, for his own reasons,
// to come to the player: a request of the player recorded by his pursuit or his follow-up. The player learns of it the way a man
// would: someone has come to find him. Nothing here is a notification of what the world is doing elsewhere.
import type { Character, Id, World } from '../types';
import { social } from './social';

export interface Approach { id: Id; who: Id; why: 'help' | 'progress' | 'confront' | 'report'; line: string; t: number }
const WHY: Record<string, Approach['why']> = { intervene: 'help', progress: 'progress', confront: 'confront', report: 'report' };
const WORDS: Record<Approach['why'], (c: Character) => string> = {
  help: (c) => `${c.name} came by looking for you. He wants a word.`,
  progress: (c) => `${c.name} has been asking for you.`,
  confront: (c) => `${c.name} is looking for you, and he isn’t smiling.`,
  report: (c) => `${c.name} sent word he has something to tell you.`,
};
export function approaches(w: World): Approach[] {
  if (!w.social || !w.playerId) return [];
  const out: Approach[] = [];
  for (const r of social(w).requests) {
    const c = w.chars[r.by];
    if (r.of !== w.playerId || r.status !== 'open' || !WHY[r.wants] || !c?.alive) continue;
    if (out.some((a) => a.who === r.by)) continue; // (one man, one visit: he brings everything with him)
    out.push({ id: r.id, who: r.by, why: WHY[r.wants], line: WORDS[WHY[r.wants]](c), t: r.t });
  }
  return out.sort((a, b) => b.t - a.t).slice(0, 4);
}
