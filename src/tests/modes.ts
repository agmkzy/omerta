// Which of the slower checks a test run includes. A plain `vitest run` (npm test) runs only the fast set; see docs/05-testing.md.
//   COMPAT=1               the synthetic schema-migration checks (v73/v74/v75): npm run test:compat
//   SLOW=1                 also the long simulations (stable, sim, roundtrip, growth, the full v87 seeds); implies COMPAT: npm run test:slow
//   SEED=3[,7,…] DAYS=180  the seeds the long simulations use, and how long a `sim` runs (make test-sim SEED=3 DAYS=180)
const on = (v: string | undefined) => !!v && v !== '0' && v !== 'false';

export const SLOW = on(process.env.SLOW);
export const COMPAT = SLOW || on(process.env.COMPAT);
export const SEEDS = (process.env.SEED ?? '3').split(',').map(Number);
export const DAYS = Number(process.env.DAYS ?? 180);
