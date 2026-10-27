// The economy, played eight ways (the Economic World Expansion's test plan): each run sets up a player of one kind, lets the world go for
// the given days, and answers what reaches him by one plain policy, so what each kind of player meets can be read and compared.
// Usage: npx tsx src/tests/tools/economy.ts [seed] [days] [scenario]   (scenario 1..8, or all)
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { applyRank } from '../../rank';
import { startOp } from '../../rackets';
import { choose as encChoose } from '../../encounters';
import { approaches, resolve, takeJob } from '../../jobs';
import { transferBusiness } from '../../econ';
import { pathState } from '../../path';
import { audit } from '../../consistency';
import { onPaper, enterpriseLabel } from '../../enterprise';
import { DAY, WEEK, type Character, type World } from '../../types';

type Policy = (e: { kind: string; data?: Record<string, string | number>; opts: { code: string }[] }) => string | null;
interface Sc { name: string; setup: (w: World, p: Character) => void; policy: Policy; jobs: boolean; jailAt?: number; killAt?: number }
const crewOf = (w: World, p: Character, n: number) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'associate' && !c.bossId?.startsWith('x')).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n).map((c) => { c.bossId = p.id; return c; });
const keep: Policy = (e) => ({ hotcar: 'return', bighit: 'pay', hotgoods: 'return', buyer: 'lawyer', more: 'half', tribute: 'less', poach: 'win', own: 'cap', till: 'count', tab: 'ride', advance: 'give', offer: 'no' } as Record<string, string>)[String(e.data?.k)] ?? e.opts[0]?.code ?? null;
const bold: Policy = (e) => ({ hotcar: 'strip', bighit: 'part', hotgoods: 'move', buyer: 'nothing', more: 'no', tribute: 'no', poach: 'lean', own: 'lean', till: 'fire', tab: 'ask', advance: 'no', offer: 'no' } as Record<string, string>)[String(e.data?.k)] ?? e.opts[0]?.code ?? null;
const SC: Sc[] = [
  { name: '1. an associate with a little money and no enterprises', setup: () => {}, policy: keep, jobs: true },
  { name: '2. a soldier with one racket (a chop shop his man runs)', setup: (w, p) => { applyRank(w, p, 'soldier', { fact: false, career: false }); p.cash = 4000; const [m] = crewOf(w, p, 2); startOp(w, p, 'chop', p.district, m.id); }, policy: keep, jobs: true },
  { name: '3. a soldier with all four rackets', setup: (w, p) => { applyRank(w, p, 'soldier', { fact: false, career: false }); p.cash = 8000; const ms = crewOf(w, p, 4); (['chop', 'numbers', 'fencing', 'bookie'] as const).forEach((k, i) => startOp(w, p, k, p.district, ms[i]?.id ?? null)); }, policy: keep, jobs: true },
  { name: '4. a captain over earners who own their own rackets', setup: (w, p) => { applyRank(w, p, 'capo', { fact: false, career: false }); p.cash = 8000; for (const [i, m] of crewOf(w, p, 4).entries()) { m.cash += 3000; startOp(w, m, (['chop', 'numbers', 'fencing', 'bookie'] as const)[i], m.district, null); } }, policy: (e) => (e.data?.k === 'assign' ? e.opts[0]?.code ?? null : keep(e)), jobs: false, killAt: 40 },
  { name: '5. a soldier with a chop shop and a restaurant where his crew meets', setup: (w, p) => { applyRank(w, p, 'soldier', { fact: false, career: false }); p.cash = 6000; const [m] = crewOf(w, p, 3); startOp(w, p, 'chop', p.district, m.id); const r = Object.values(w.biz).filter((b) => b.open && (b.kind === 'restaurant' || b.kind === 'bar')).sort((a, b) => (a.id < b.id ? -1 : 1))[0]; transferBusiness(w, r, p.id, 'bought it'); pathState(w).meet = r.id; }, policy: keep, jobs: true },
  { name: '6. a soldier who delegates everything and answers nothing', setup: (w, p) => { applyRank(w, p, 'soldier', { fact: false, career: false }); p.cash = 8000; const ms = crewOf(w, p, 4); (['chop', 'numbers', 'fencing', 'bookie'] as const).forEach((k, i) => startOp(w, p, k, p.district, ms[i]?.id ?? null)); }, policy: () => null, jobs: false },
  { name: '7. a soldier pushing hard: every order taken, every quarrel met head on', setup: (w, p) => { applyRank(w, p, 'soldier', { fact: false, career: false }); p.cash = 8000; const ms = crewOf(w, p, 3); startOp(w, p, 'chop', p.district, ms[0].id); startOp(w, p, 'bookie', p.district, ms[1].id); }, policy: bold, jobs: true },
  { name: '8. a soldier who goes inside for two months, leaving a numbers bank', setup: (w, p) => { applyRank(w, p, 'soldier', { fact: false, career: false }); p.cash = 5000; const [m] = crewOf(w, p, 2); m.traits.ambition = 0.85; startOp(w, p, 'numbers', p.district, m.id); }, policy: keep, jobs: true, jailAt: 40 },
];

const seed = Number(process.argv[2] ?? 7), days = Number(process.argv[3] ?? 150), which = process.argv[4] ?? 'all';
for (const [i, sc] of SC.entries()) {
  if (which !== 'all' && Number(which) !== i + 1) continue;
  const w = createWorld(seed, 'Tony Marino'), p = w.chars[w.playerId!];
  sc.setup(w, p);
  const cash0 = p.cash, seen: string[] = [], answered: string[] = [];
  const ops0 = new Set(w.ops.filter((o) => o.owner === p.id).map((o) => o.id));
  for (let d = 0; d < days && p.alive; d++) {
    advance(w, d * DAY + 10 * 60);
    if (sc.jailAt === d) { p.jailedUntil = w.now + 60 * DAY; seen.push(`day ${d}: put inside for 60 days`); }
    if (sc.killAt === d) { const m = w.ops.find((o) => w.chars[o.owner]?.bossId === p.id && w.chars[o.owner]?.alive); if (m) { w.chars[m.owner].alive = false; answered.push(`day ${d}: ${w.chars[m.owner].name} was killed`); } }
    if (p.jailedUntil > w.now) continue;
    for (const e of w.enc.filter((x) => x.status === 'open' && (x.kind === 'ent' || x.kind === 'place'))) {
      if (!seen.includes(e.id)) { seen.push(e.id); answered.push(`day ${d}: ${e.title}`); }
      const code = sc.policy(e);
      if (code) { const r = encChoose(w, p, e, code); answered.push(`   → ${code}: ${r.lines.join(' ').slice(0, 160)}`); }
    }
    if (sc.jobs) for (const j of w.jobs.filter((q) => q.status === 'offered' && q.assignee === p.id && q.extra?.want)) { takeJob(w, j); answered.push(`day ${d}: took the order: ${j.title}`); }
    if (sc.jobs) for (const j of w.jobs.filter((q) => q.status === 'active' && q.assignee === p.id && q.extra?.want)) {
      let r = resolve(w, j, 'w_garage');
      if (r.moment) { answered.push('   (the owner came out)'); r = resolve(w, j, sc.policy === bold ? 'm_drive' : 'm_talk'); }
      answered.push(`   → ${r.lines.join(' ').slice(0, 160)}`);
    }
  }
  const mine = w.ops.filter((o) => ops0.has(o.id) || o.owner === p.id || (o.stakes ?? []).some((s) => s.holder === p.id) || w.chars[o.owner]?.bossId === p.id || (o.owners ?? []).some((x) => w.chars[x.id]?.bossId === p.id));
  console.log(`\n=== ${sc.name} (seed ${seed}, ${days} days)`);
  console.log(`cash ${cash0} → ${Math.round(p.cash)} · rank ${p.rank} · heat ${p.heat.toFixed(2)} · on paper ${JSON.stringify(onPaper(w, p))} · audit ${audit(w).length} problems`);
  for (const o of mine) {
    const r = o.runner ? w.chars[o.runner] : undefined, ow = w.chars[o.owner];
    console.log(`  ${enterpriseLabel(o)} (${o.state}) owner ${ow?.isPlayer ? 'YOU' : ow?.name}${o.owners?.length ? ` [was ${o.owners.map((x) => w.chars[x.id]?.name).join(', ')}]` : ''} · run by ${r?.name ?? '-'}${r ? ` (trust ${(r.rels[p.id]?.trust ?? 0).toFixed(2)}, grudge ${(r.rels[p.id]?.grudge ?? 0).toFixed(2)}${r.rels[p.id]?.why ? ` "${r.rels[p.id].why!.text}"` : ''})` : ''} · total ${o.total} in ${o.weeks}w · people ${(o.links ?? []).length} · stakes ${(o.stakes ?? []).map((s) => `${w.chars[s.holder]?.name} ${Math.round(s.share * 100)}%`).join(', ') || '-'}`);
    for (const h of (o.hist ?? []).slice(-4)) console.log(`     · ${h.text}`);
  }
  const cap = p.bossId ? w.chars[p.bossId] : undefined;
  if (cap) console.log(`  captain ${cap.name}: trust ${(cap.rels[p.id]?.trust ?? 0).toFixed(2)} grudge ${(cap.rels[p.id]?.grudge ?? 0).toFixed(2)}${cap.rels[p.id]?.why ? ` "${cap.rels[p.id].why!.text}"` : ''}`);
  const grudges = Object.values(w.chars).filter((c) => c.alive && (c.rels[p.id]?.grudge ?? 0) > 0.15 && /chop|book|numbers|fenc|racket|cut|till|tab|bar|shop|car|piece|leaned|gave him up|let him go|wouldn/i.test(c.rels[p.id]?.why?.text ?? ''));
  console.log(`  men holding something against him over business: ${grudges.length}${grudges.slice(0, 4).map((c) => `\n     · ${c.name}: "${c.rels[p.id].why!.text}"`).join('')}`);
  const fam = p.familyId ? w.fam[p.familyId] : undefined;
  if (fam) console.log(`  family tension: ${Object.entries(fam.tension).map(([k, v]) => `${w.fam[k]?.name} ${v.toFixed(1)}`).join(', ')}`);
  console.log(`  what reached him (${answered.filter((x) => x.startsWith('day')).length}):\n   ${answered.slice(0, 40).join('\n   ')}`);
}
void WEEK;
