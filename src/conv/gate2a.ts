// Gate 2a transcripts: the Ferrara dispute end to end on real records (conv/ferrara.ts), its variants, and what happens across many
// worlds. Run: npx tsx src/conv/gate2a.ts (writes docs/gate2a/FERRARA.md). Deterministic: the same output every time.
import { writeFileSync, mkdirSync } from 'node:fs';
import { audit } from '../consistency';
import { ledgerCheck } from '../econ';
import { Out } from './harness';
import { cast, chain, type Run } from './ferrara';
import { offstage } from './tick';
import * as door from './doors';

export function buildFerrara(statSeeds = 12): string {
  const o = new Out(), P = (x = '') => o.P(x);
  const show = (title: string, about: string, r: Run) => {
    P(`## ${title}`); P(''); P(`*${about}*`); P('');
    for (const l of r.o.lines) P(l);
    const a = audit(r.c.w), l = ledgerCheck(r.c.w);
    P(`*World audit after the run: ${a.length ? a.join('; ') : 'clean'}. Business ledgers: ${l.length ? l.join('; ') : 'consistent'}.*`); P('');
  };
  P('# Gate 2a: the Ferrara dispute, on real records');
  P('');
  P('*Produced by `npx tsx src/conv/gate2a.ts`. A generated world (seed 3), its own people under their own names, nothing renamed and nothing set by hand except where a section says so. The trouble starts with the world’s own protection ask; every change after that goes through `src/conv/doors.ts` to a door the world already has; the days pass in the real engine (`engine.advance`), which now also runs the conversation layer’s daily tick. What Henry says is one of the rows on screen; what the others say is rendered from their decisions; what happens between the others has no text, only a trace. The record blocks show the requests, agreements and obligations as they stand in `World.social`.*');
  P('');
  show('1. Kept: Henry promises a result, the captains carry it, the man obeys', 'Henry promises Jimmy DeSantis that Richie Valenti will leave him alone (a result promise: beyond Henry’s own power, so it rests on others). His captain says no until Henry tells him what Richie’s people did on his ground; then he agrees, with a liability on Henry. Days later he takes it to Richie’s captain, who orders Richie; Richie agrees and means it, and lets his demand drop. Thirty clean days keep Henry’s promise, with the credit shared by delegation.', chain(cast(3, 0)!, 'result', { days: 45 }));
  { const c = cast(3, 1)!; door.grudge(c.w, c.lou, c.nate.id, 0.7, 'staged for this section: he wants at the shopkeeper');
    show('2. Broken: the man has a reason, refuses his captain, and strikes', 'The one staged input in this document: Sal Gallo is given a grudge against Jimmy (through the grudge door, core.bear) before anything happens, because in the natural runs below no man had one (see section 7). Everything after is the world’s: his captain orders him; he refuses (the world’s own “leave him alone” ask, answered by him); his grudge carries him back to the shop through the world’s own retaliation. Henry’s result promise breaks at the first violation, not at the end of the period; the liability his captain laid on him falls; Jimmy’s first word is a reproach.', chain(c, 'result', { days: 45 })); }
  show('3. An action promise, kept though the captain says no', 'Henry promised only to raise it. He does; the captain refuses (Henry doesn’t tell him what happened). The promise was to raise it, and it is kept the moment he does.', chain(cast(3, 0)!, 'action', { tell: false, days: 16 }));
  show('4. An effort promise, kept by a failed attempt', 'Henry promised to try. His captain refuses. The attempt counts, because Henry had reason to think it might work when he made it.', chain(cast(3, 0)!, 'effort', { tell: false, days: 16 }));
  show('5. A result kept with no credit', 'Henry’s captain takes it up, but the other captain won’t rein his man in. The man stays away anyway: Henry’s promise is kept, and nobody brought it about.', chain(cast(3, 2)!, 'result', { days: 45 }));
  show('6. An action promise broken by doing nothing', 'Henry promises to raise it and never does. Nothing happens to Jimmy either; the promise breaks when the time runs out, whatever else happened.', chain(cast(3, 0)!, 'action', { noRaise: true, days: 20 }));

  // ---------------------------------------------------------------- across many worlds, with nothing staged
  P('## 7. Across many worlds, with nothing staged'); P('');
  P(`*The same chain (a result promise, Henry tells his captain what happened) for each soldier of another crew, in seeds 1–${statSeeds}: whoever the world has. Counted from the records.*`); P('');
  const n = { runs: 0, noDispute: 0, captain: 0, ordered: 0, agreed: 0, meant: 0, broke: 0, o1kept: 0, o1broken: 0, delegate: 0, none: 0, liability: 0, audit: 0 };
  for (let seed = 1; seed <= statSeeds; seed++) for (let k = 0; k < 6; k++) {
    const c = cast(seed, k); if (!c) continue;
    const r = chain(c, 'result', { days: 45 }); n.runs++;
    if (!r.o1) { n.noDispute++; continue; }
    if (r.o2) n.captain++;
    if (offstage.some((e) => /tells .* to leave/.test(e.what) && e.reply?.decision.chosen === 'order')) n.ordered++;
    if (r.o3) { n.agreed++; if (r.o3.intends === 'keep') n.meant++; if (r.o3.status === 'broken') n.broke++; }
    if (r.o1.status === 'kept') { n.o1kept++; if (r.o1.credit === 'delegate') n.delegate++; else n.none++; } else if (r.o1.status === 'broken') n.o1broken++;
    if (r.o2?.liabilities?.some((l) => l.fell)) n.liability++;
    if (audit(c.w).length || ledgerCheck(c.w).length) n.audit++;
  }
  P('| | Runs |'); P('|---|---|');
  for (const [k, v] of Object.entries({ 'chains run': n.runs, 'no dispute (the shopkeeper paid)': n.noDispute, 'Henry’s captain took it up': n.captain, 'the other captain ordered his man': n.ordered, 'the man agreed': n.agreed, '…and meant it': n.meant, '…and broke it': n.broke, 'Henry’s promise kept': n.o1kept, '…with credit shared by delegation': n.delegate, '…with no credit (it held by itself)': n.none, 'Henry’s promise broken': n.o1broken, 'a liability fell on Henry': n.liability, 'runs with an audit or ledger failure': n.audit })) P(`| ${k} | ${v} |`);
  P('');
  return o.text();
}

if (process.argv[1]?.endsWith('gate2a.ts')) {
  mkdirSync('docs/gate2a', { recursive: true });
  const t = buildFerrara();
  writeFileSync('docs/gate2a/FERRARA.md', t + '\n');
  console.log('wrote docs/gate2a/FERRARA.md', t.split('\n').length, 'lines');
}
