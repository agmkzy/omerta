// Every interaction the conversation can carry, by its base code (Gate 4). visit.ts offers what they offer and runs what is chosen
// through run.ts; nothing here knows about screens.
import type { Act } from '../kit';
import { PERSONAL } from './personal';
import { INFO } from './info';
import { BUSINESS } from './business';

export const ACTS: Record<string, Act> = {};
for (const a of [...PERSONAL, ...INFO, ...BUSINESS]) { if (ACTS[a.base]) throw new Error(`two interactions share the code ${a.base}`); ACTS[a.base] = a; }
