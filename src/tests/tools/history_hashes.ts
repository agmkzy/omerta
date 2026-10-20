// Fingerprints of world histories, for proving that an engine change (a speed-up, a refactor) changes no history.
// Prints one line per snapshot, "<case> <label> <sha256 prefix of serialize()>". Run it before and after the change and diff:
//   npx tsx src/tests/tools/history_hashes.ts > before.txt     (all cases, about two minutes of CPU)
//   npx tsx src/tests/tools/history_hashes.ts seed3 orgs7      (only some cases)
// The cases cover eight seeds at days 30, 90 and 180, a seven-family world, a background with a business stake, and a save
// loaded at day 60 and played on (which starts with cold caches).
import { createHash } from 'node:crypto';
import { advance, deserialize, serialize } from '../../engine';
import { DAY } from '../../types';
import { createWorld, EXTRA_ORGS, STANDARD_ORGS } from '../../world';

type World = ReturnType<typeof createWorld>;
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const CASES: Record<string, (snap: (label: string, w: World) => void) => void> = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => [`seed${seed}`, (snap: (label: string, w: World) => void) => {
    const w = createWorld(seed, 'Tony Marino');
    for (const d of [30, 90, 180]) { advance(w, d * DAY); snap('d' + d, w); }
  }])),
  orgs7: (snap) => { const w = createWorld(5, 'Tony Marino', { orgs: [...STANDARD_ORGS, ...EXTRA_ORGS].slice(0, 7) }); advance(w, w.now + 60 * DAY); snap('d60', w); },
  business: (snap) => { const w = createWorld(3, 'Salvatore DeMarco', { bg: 'business' }); advance(w, w.now + 60 * DAY); snap('d60', w); },
  reload: (snap) => {
    const w = createWorld(11, 'Tony Marino'); advance(w, w.now + 60 * DAY);
    const l = deserialize(serialize(w)); advance(l, l.now + 60 * DAY); snap('loaded+60', l);
    advance(w, w.now + 60 * DAY); snap('live+60', w);
  },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
for (const name of names) {
  const run = CASES[name];
  if (!run) throw new Error(`unknown case ${name}; cases: ${Object.keys(CASES).join(' ')}`);
  run((label, w) => console.log(`${name} ${label} ${hash(serialize(w))}`));
}
