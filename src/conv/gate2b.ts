// Gate 2b transcripts: Scenario G (thirty days, the same five people, three runs) and the autonomous chains that four generated worlds
// produce by themselves over 180 days, each shown with the decisions that made it and their reasons. Run: npx tsx src/conv/gate2b.ts
// (writes docs/gate2b/SCENARIO_G.md and docs/gate2b/CHAINS.md). Deterministic.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createWorld } from '../world';
import { advance } from '../engine';
import { audit } from '../consistency';
import { ledgerCheck } from '../econ';
import { DAY, type World } from '../types';
import { Out } from './harness';
import { social, type Request } from './social';
import { annals, type Entry } from './annals';
import { chainOf, emergence } from './emergence';
import { scenarioG, type Variant } from './scenarioG';

const why = (e: Entry) => {
  if (!e.reply) return '';
  const d = e.reply.decision, c = [...d.candidates].sort((a, b) => b.value - a.value);
  const top = c[0], next = c[1];
  const terms = (x: typeof top) => x.terms.filter((t) => Math.abs(t.value) >= 0.05).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3).map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ');
  return `  [${top.move} ${top.value}: ${terms(top)}${next ? `; against ${next.move} ${next.value}` : ''}]${e.reply.honest ? '' : ' (not honest)'}`;
};
const line = (w: World, t0: number, e: Entry) => `day ${Math.floor((e.t - t0) / DAY)}: ${e.what}${why(e)}`;

export function buildScenarioG(): string {
  const o = new Out(), P = (x = '') => o.P(x);
  P('# Gate 2b: Scenario G, thirty days with the same five people'); P('');
  P('*Produced by `npx tsx src/conv/gate2b.ts`. Seed 3, run three times. The only thing set going is one man’s demand on a shopkeeper on day 1; Henry’s choices are scripted (spec §17.9: “run headless at Gate 2b, with the player’s choices scripted”); everything anyone else does is his own, in the real engine. The runs differ in one thing each: whether Henry knew the shopkeeper before the trouble, and, when the shopkeeper comes to him, whether Henry keeps his word or lies about it. Traces are folded under each line; the off-stage block at the end of each run shows what the others did that Henry never saw.*'); P('');
  P('| Run | Visits | Refused requests re-offered without a change | Routine visits | …that manufactured a development | Did the shopkeeper come to Henry? | Lies told / found out | Shopkeeper’s trust in Henry, every 5 days |'); P('|---|---|---|---|---|---|---|---|');
  const runs = (['acquainted', 'stranger', 'liar'] as Variant[]).map((v) => ({ v, r: scenarioG(v) }));
  for (const { v, r } of runs) P(`| ${v} | ${r.m.visits} | ${r.m.reoffered} | ${r.m.routineVisits} | ${r.m.routineDevelopments} | ${r.m.nateCame ? 'yes' : 'no'} | ${r.m.liesBelieved} / ${r.m.liesFound} | ${r.m.trustNate.join(' → ')} |`);
  P('');
  for (const { r } of runs) { for (const l of r.o.lines) P(l.replace(/^# Scenario G/, '## Scenario G')); P(''); }
  return o.text();
}

export function buildChains(seeds = [3, 7, 11, 19], days = 180): string {
  const o = new Out(), P = (x = '') => o.P(x);
  P('# Gate 2b: what four worlds did by themselves'); P('');
  P(`*Produced by \`npx tsx src/conv/gate2b.ts\`. Seeds ${seeds.join(', ')}, ${days} days each, with the conversation layer running and nobody scripted: no player choices, nothing staged. Every request, promise, order, breach, lie and change of mind below is a character’s own decision from his own perception, made by the same respond functions the player meets. Each line carries the decision’s top terms (what weighed most) and the next-best alternative.*`); P('');
  const rows: string[] = [];
  const stories: { seed: number; title: string; lines: string[] }[] = [];
  for (const seed of seeds) {
    annals.length = 0;
    const w = createWorld(seed, 'Henry Tedesco'); social(w);
    const t0 = w.now;
    advance(w, w.now + days * DAY);
    const e = emergence(w), s = social(w), A = [...annals];
    rows.push(`| ${seed} | ${e.pursuits} | ${e.throughTwo} | ${e.requests} | ${e.chains3} | ${e.ordersAgreed} (${e.ordersMeantToBreak} not meant) | ${e.broken} (${e.brokenWithConsequence} with consequences) | ${e.revisions} (${e.revisionsChangedPlan} changed a plan) | ${e.lies} | ${Math.round(JSON.stringify(s).length / 1024)} KB | ${audit(w).length + ledgerCheck(w).length ? 'failures' : 'clean'} |`);
    // the longest chain of linked requests, with everything its people decided around it
    const chain = s.requests.map((r) => chainOf(w, r)).sort((a, b) => b.length - a.length)[0];
    if (chain && chain.length >= 2) {
      const who = new Set(chain.flatMap((r: Request) => [r.by, r.of, r.for, r.against].filter(Boolean) as string[]));
      const from = chain[0].t - 3 * DAY, to = chain.at(-1)!.t + 40 * DAY;
      stories.push({ seed, title: `The longest chain: ${chain.map((r) => `${w.chars[r.by]?.name} → ${w.chars[r.of]?.name}`).join(' ⇒ ')}`, lines: A.filter((x) => x.t >= from && x.t <= to && (who.has(x.who) || (x.with && who.has(x.with))) && !/next move|answers .*demand|asked by .* for \$/.test(x.what)).slice(0, 30).map((x) => line(w, t0, x)) });
    }
    // an order broken, and what the superior did when he came to believe it
    const dis = A.find((x) => /went against his order/.test(x.what));
    if (dis) {
      const man = dis.with!, boss = dis.who;
      stories.push({ seed, title: `An order broken: ${w.chars[man]?.name} and ${w.chars[boss]?.name}`, lines: A.filter((x) => (x.who === man || x.with === man || x.who === boss) && x.t <= dis.t + DAY && x.t >= dis.t - 40 * DAY && /alone|order|leave|went against/.test(x.what)).slice(-12).map((x) => line(w, t0, x)) });
    }
    // a plan changed by something learnt
    const ch = A.find((x) => x.what.includes('changes his plan'));
    if (ch) stories.push({ seed, title: `A plan changed by what he learnt: ${w.chars[ch.who]?.name}`, lines: A.filter((x) => x.chain === ch.chain || (x.who === ch.who && Math.abs(x.t - ch.t) < 3 * DAY)).slice(0, 14).map((x) => line(w, t0, x)) });
    // a lie
    const lie = A.find((x) => x.reply && !x.reply.honest && /says done|misdirect|who was behind/.test(x.what));
    if (lie) stories.push({ seed, title: `A lie: ${w.chars[lie.who]?.name} to ${w.chars[lie.with ?? '']?.name}`, lines: A.filter((x) => x.chain === lie.chain || x === lie).slice(0, 10).map((x) => line(w, t0, x)) });
    // a promise someone thought better of
    const kw = A.find((x) => /on his promise to .*: (renegotiate|abandon|delay)/.test(x.what));
    if (kw) stories.push({ seed, title: `A promise weighed day by day: ${w.chars[kw.who]?.name}`, lines: A.filter((x) => x.chain === kw.chain).slice(0, 12).map((x) => line(w, t0, x)) });
  }
  P('| Seed | Pursuits | …through two or more people | Requests | Chains of 3+ linked requests | Orders agreed | Obligations broken | Belief revisions | Lies | Layer records | Audits |'); P('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) P(r);
  P('');
  const seen = new Set<string>();
  for (const st of stories) {
    const k = st.title.split(':')[0] + st.seed;
    if (seen.has(k) || !st.lines.length) continue; seen.add(k);
    P(`## Seed ${st.seed}. ${st.title}`); P(''); P('```'); for (const l of st.lines) P(l); P('```'); P('');
  }
  return o.text();
}

if (process.argv[1]?.endsWith('gate2b.ts')) {
  mkdirSync('docs/gate2b', { recursive: true });
  writeFileSync('docs/gate2b/SCENARIO_G.md', buildScenarioG() + '\n');
  writeFileSync('docs/gate2b/CHAINS.md', buildChains() + '\n');
  console.log('wrote docs/gate2b/SCENARIO_G.md and docs/gate2b/CHAINS.md');
}
