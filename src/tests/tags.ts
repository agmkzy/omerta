// The kinds of test, as Vitest tags. Every test carries exactly one type tag (setup.ts checks it, skipped tests included),
// set on its describe() when the whole block is one kind, or on the test itself. `slow` is extra: it marks the opt-in long
// runs, which are skipped unless SLOW=1. Select by kind with --tagsFilter, e.g. `npx vitest run --tagsFilter unit` or
// `--tagsFilter 'scenario && !slow'`. See docs/05-testing.md.
import { SLOW } from './modes';

export const TYPES = ['unit', 'scenario', 'sim', 'determinism', 'compat', 'architecture', 'property'] as const;
export type TestType = (typeof TYPES)[number];

export const TAGS = [
  // A unit test runs in well under a second here, so one that takes longer has been misfiled. The limit is generous for a
  // slow CI runner with coverage.
  { name: 'unit', description: 'A direct call to one function or module. A world may be its fixture, but the clock never moves.', timeout: 10_000 },
  { name: 'scenario', description: 'A staged chain across systems: set up a situation, act, check the consequence.', timeout: 5 * 60_000 },
  { name: 'sim', description: 'Many simulated days, then invariants: the audit, the ledger, bounded growth, rates.' },
  { name: 'determinism', description: 'The same seed, or a save and a load, must give identical output.' },
  { name: 'compat', description: 'Saves from older builds, real or synthetic, load and play on.' },
  { name: 'architecture', description: 'Source scans: each kind of change has one door.' },
  { name: 'property', description: 'Random walks checked against rules (the conversation crawler).' },
  { name: 'slow', description: 'Opt-in long runs, skipped unless SLOW=1 (npm run test:slow; SEED, DAYS).', skip: !SLOW },
] as const satisfies readonly { name: string; description: string; timeout?: number; skip?: boolean }[];

export type TagName = (typeof TAGS)[number]['name'];

// Tag names are typed, so a misspelt tag is a compile error.
declare module 'vitest' {
  interface TestTags {
    omerta: TagName;
  }
}
