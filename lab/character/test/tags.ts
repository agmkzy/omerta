// The lab's kinds of test, as Vitest tags (declared in vitest.config.ts). Every test carries one, so a misspelt tag fails to compile.
declare module 'vitest' {
  interface TestTags {
    lab: 'unit' | 'property' | 'statistical';
  }
}
export {};
