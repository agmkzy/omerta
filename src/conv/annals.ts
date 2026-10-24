// What happened between NPCs, as a trace (spec §10, §7.6): who decided what, with whom, and why. For transcripts and the emergence
// counts; not saved and never shown to the player (he learns what happens through facts, reports and gossip).
import type { Id } from '../types';
import type { Reply } from './respond';

export interface Entry { t: number; who: Id; with?: Id; what: string; reply?: Reply; chain?: Id }
export const annals: Entry[] = [];
export function enter(e: Entry) { annals.push(e); if (annals.length > 4000) annals.splice(0, 1000); }
