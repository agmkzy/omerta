// Every interaction the conversation can carry, by its base code (Gate 4). visit.ts offers what they offer and runs what is chosen
// through run.ts; nothing here knows about screens. (Built on first use: the interaction modules refer to one another through it.)
import type { Act } from '../kit';
import { PERSONAL } from './personal';
import { INFO } from './info';
import { BUSINESS } from './business';
import { ORG } from './org';
import { CONFRONT } from './confront';
import { SUBJECTS } from './subjects';

let reg: Record<string, Act> | undefined;
function all(): Record<string, Act> {
  if (reg) return reg;
  const r: Record<string, Act> = {};
  for (const a of [...PERSONAL, ...INFO, ...BUSINESS, ...ORG, ...CONFRONT, ...SUBJECTS]) { if (r[a.base]) throw new Error(`two interactions share the code ${a.base}`); r[a.base] = a; }
  return (reg = r);
}
export const ACTS: Record<string, Act> = new Proxy({} as Record<string, Act>, {
  get: (_t, k) => (typeof k === 'string' ? all()[k] : undefined),
  has: (_t, k) => typeof k === 'string' && k in all(),
  ownKeys: () => Reflect.ownKeys(all()),
  getOwnPropertyDescriptor: (_t, k) => { const d = Object.getOwnPropertyDescriptor(all(), k); return d ? { ...d, configurable: true } : undefined; },
});
