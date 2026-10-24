// What a long run produced (spec §11.6), counted from the records and the trace: pursuits that came about through two or more people,
// chains of three or more linked requests, broken agreements that had consequences, and belief revisions that changed a plan. Also
// the longest chains, as stories for a person to read.
import type { World } from '../types';
import { social, type Request } from './social';
import { annals } from './annals';

export interface Emergence { pursuits: number; throughTwo: number; chains3: number; brokenWithConsequence: number; revisionsChangedPlan: number; revisions: number; lies: number; uncertain: number; requests: number; obligations: number; broken: number; ordersAgreed: number; ordersMeantToBreak: number; longest: string[][] }
export function chainOf(w: World, r: Request): Request[] {
  const s = social(w), out = [r];
  let x: Request | undefined = r;
  for (let i = 0; i < 6 && x?.parent; i++) {
    const ob = s.obs.find((o) => o.id === x!.parent);
    const up = ob ? s.requests.find((q) => q.id === s.agreements.find((g) => g.id === ob.agreement)?.madeIn) : undefined;
    if (!up || out.includes(up)) break;
    out.unshift(up); x = up;
  }
  return out;
}
export function emergence(w: World): Emergence {
  const s = social(w), ps = s.pursuits ?? [];
  const throughTwo = ps.filter((p) => p.status === 'achieved' && (new Set(p.tried.map((t) => t.with).filter(Boolean)).size >= 2 || ['intercessor', 'chair', 'protector'].includes(p.route ?? ''))).length;
  const chains = s.requests.map((r) => chainOf(w, r)).filter((c) => c.length >= 3);
  const conseq = new Set([...(s.judged ?? []).filter((j) => j.verdict === 'broken').map((j) => j.ob), ...s.obs.filter((o) => o.liabilities?.some((l) => l.fell)).map((o) => o.id), ...s.log.filter((a) => a.act === 'discipline').map((a) => a.about)]);
  const brokenWithConsequence = s.obs.filter((o) => o.status === 'broken' && (conseq.has(o.id) || (s.judged ?? []).some((j) => j.ob === o.id && j.verdict === 'broken'))).length;
  const longest = [...chains].sort((a, b) => b.length - a.length).slice(0, 3).map((c) => c.map((r) => `${w.chars[r.by]?.name} → ${w.chars[r.of]?.name} (${r.wants}${r.rode ? ', ' + r.rode.ak + ': ' + r.rode.out : ''}): ${r.status}`));
  return {
    pursuits: ps.length, throughTwo, chains3: chains.length, brokenWithConsequence,
    revisionsChangedPlan: annals.filter((e) => e.what.includes('changes his plan')).length,
    revisions: (s.revisions ?? []).length, lies: (s.said ?? []).filter((x) => !x.honest).length, uncertain: (s.held ?? []).filter((h) => h.uncertain).length,
    requests: s.requests.length, obligations: s.obs.length, broken: s.obs.filter((o) => o.status === 'broken').length,
    ordersAgreed: annals.filter((e) => /he'll leave .* alone, and/.test(e.what)).length, ordersMeantToBreak: annals.filter((e) => /alone, and does not mean it/.test(e.what)).length,
    longest,
  };
}
