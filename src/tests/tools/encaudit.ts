// What arrives (docs/conversations/): every encounter that reaches the player at each seat over a hundred days, its words and its
// choices, checked by the same lint as the conversation (convaudit.lint): the man who comes naming himself, the player named to his
// face, code in the words. Run: npx tsx src/tests/tools/encaudit.ts [seed] [days]
import { createWorld, type StartAt } from '../../world';
import { advance } from '../../engine';
import { choose } from '../../encounters';
import { DAY } from '../../types';
import { lint, type Flag } from './convaudit';

export function encAudit(seed: number, days = 100): { n: number; flags: Flag[]; kinds: Record<string, number> } {
  const flags: Flag[] = [], kinds: Record<string, number> = {};
  let n = 0;
  for (const start of ['associate', 'soldier', 'capo', 'underboss', 'consigliere', 'boss'] as StartAt[]) {
    const w = createWorld(seed, 'Tony Marino', { start }), p = w.chars[w.playerId!], seen = new Set<string>();
    for (let d = 0; d < days; d++) {
      advance(w, w.now + DAY);
      for (const e of w.enc.filter((x) => x.status === 'open' && !seen.has(x.id))) {
        seen.add(e.id); n++; kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
        const from = e.from ? w.chars[e.from] : undefined, where = `${start} · ${e.kind} · ${e.title}`;
        if (from) for (const l of e.lines) flags.push(...lint(l, /[“"]/.test(l) ? 'him' : 'narr', from, p, where));
        for (const o of e.opts ?? []) if (/undefined|NaN|\[object/.test(o.label + (o.hint ?? ""))) flags.push({ kind: 'template-leak', text: o.label, where });
        try { if (e.opts?.length) { const r = choose(w, p, e, e.opts[0].code); if (from) for (const l of r.lines) flags.push(...lint(l, /[“"]/.test(l) ? 'him' : 'narr', from, p, `${where} → ${e.opts[0].label}`).filter((x) => x.kind !== 'self-named')); /* (in an answer another man may be the one speaking) */ } } catch (err) { flags.push({ kind: 'error', text: String(err).slice(0, 160), where }); }
      }
    }
  }
  return { n, flags, kinds };
}
if (process.argv[1]?.endsWith('encaudit.ts')) {
  const r = encAudit(Number(process.argv[2] ?? 3), Number(process.argv[3] ?? 100));
  const k: Record<string, number> = {}; for (const f of r.flags) k[f.kind] = (k[f.kind] ?? 0) + 1;
  console.log(`${r.n} encounters`, r.kinds, 'flags', k);
  for (const f of r.flags.slice(0, 40)) console.log(`- [${f.kind}] ${f.where}: ${f.text.slice(0, 220)}`);
}
