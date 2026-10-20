// Runs the regression suites (src/tests/**/*.test.ts) with Vitest. See docs/05-testing.md.
// Kept apart from vite.config.ts on purpose: that one builds the browser game with web/ as its root, while the tests run from the
// repository root and need none of its plugins. Vitest reads this file instead of vite.config.ts whenever it exists.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    // Every suite is found by name, so a new src/tests/vNN.test.ts runs in npm test, make test-all and CI without being listed anywhere.
    include: ['src/tests/**/*.test.ts'],
    // Files run in parallel, one worker each; the checks inside a file run in order. Some checks simulate a year of play, and
    // CI runners are slower than a laptop, so the limits are generous: they catch a hang, not a slow machine.
    testTimeout: 20 * 60_000,
    hookTimeout: 20 * 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The simulation is what the suites test. The browser UI, the terminal UI and the bots are entry points with no tests of their own.
      exclude: ['src/tests/**', 'src/web.ts', 'src/ui/**', 'src/cli.ts', 'src/bot.ts', 'src/stress.ts'],
      reporter: ['text-summary', 'html'],
      // About a point below what `npm run test:cov` measured when these were set (lines 59.05, statements 55.95, branches 53.96,
      // functions 62.57), so coverage can only go up. The margin absorbs small differences between Node versions. Raise them as
      // coverage rises. docs/05-testing.md has the background and the long-term target (80% of lines).
      thresholds: { lines: 58, statements: 55, branches: 53, functions: 62 },
    },
  },
});
