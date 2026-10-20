// Parameters for the opt-in long runs, read from the environment. Which tests are long runs is a tag (`slow`, see tags.ts).
//   SLOW=1                 run the long simulations (stable, sim, roundtrip, growth, the trace, v87's full seeds): npm run test:slow
//   SEED=3[,7,…] DAYS=180  the seeds the long simulations use, and how long a `sim` runs (make test-sim SEED=3 DAYS=180)
const on = (v: string | undefined) => !!v && v !== '0' && v !== 'false';

export const SLOW = on(process.env.SLOW);
export const SEEDS = (process.env.SEED ?? '3').split(',').map(Number);
export const DAYS = Number(process.env.DAYS ?? 180);
