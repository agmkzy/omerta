// The overhaul's kinds of test, as Vitest tags (declared in vitest.overhaul.config.ts). Every test carries exactly one (setup.ts
// checks it), and tag names are typed, so a misspelt tag fails to compile.
export const KINDS = ['unit', 'property', 'statistical', 'architecture'] as const;
export type Kind = (typeof KINDS)[number];

export const TAGS = [
  { name: 'unit', description: 'One function or module, called directly.', timeout: 2_000 },
  { name: 'property', description: 'A rule checked over many generated inputs (fast-check).', timeout: 10_000 },
  { name: 'statistical', description: 'A seeded simulation whose rates are checked against what the rules should give.', timeout: 10_000 },
  { name: 'architecture', description: "Source scans: the overhaul's boundary with the game.", timeout: 10_000 },
] as const satisfies readonly { name: Kind; description: string; timeout: number }[];

declare module 'vitest' {
  interface TestTags {
    overhaul: Kind;
  }
}
