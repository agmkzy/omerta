// The overhaul's tests (tests/overhaul/). Kept apart from the game's suites (the root vitest.config.ts only includes src/tests):
// the overhaul imports nothing from the rest of src/ and the game imports nothing from it until it is slotted in, which
// tests/overhaul/boundary.test.ts enforces. See docs/overhaul/plans/character/README.md.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { TAGS } from './tests/overhaul/tags';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['tests/overhaul/**/*.test.ts'],
    tags: [...TAGS],
    setupFiles: ['tests/overhaul/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/overhaul/**/*.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/overhaul',
      thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
    },
  },
});
