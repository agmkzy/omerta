// The character lab's tests. Kept apart from the game's suites (the root vitest.config.ts only includes src/tests): the lab
// imports nothing from src/ and the game imports nothing from the lab until a deliberate refactor joins them.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['test/**/*.test.ts'],
    tags: [
      { name: 'unit', description: 'One function or module, called directly.', timeout: 2_000 },
      { name: 'property', description: 'A rule checked over many generated inputs (fast-check).', timeout: 10_000 },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'playground/roster.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
    },
  },
});
