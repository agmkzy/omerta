// What kind of criminal you have become, read from what you have actually done. Nothing here is chosen or spent.
import { stakesOf } from './econ';
import { Character, World } from './types';

export type Spec = 'earner' | 'operator' | 'negotiator' | 'enforcer';
export const SPEC_LABEL: Record<Spec, string> = { earner: 'The Earner', operator: 'The Operator', negotiator: 'The Negotiator', enforcer: 'The Enforcer' };
export const SPEC_PERK: Record<Spec, string> = {
  earner: 'Your standing rackets pay about 12% more.',
  operator: 'Offers for gig work reach you more often.',
  negotiator: 'When you take a quarrel up the chain, it is far more likely to stop.',
  enforcer: 'When you show up with men to hold a street, it is more likely to work.',
};
export const TIER_WORD = ['Unproven', 'Known for it', 'Established', 'A master'];

export function specScores(w: World, p: Character): Record<Spec, number> {
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).length;
  const ops = w.ops.filter((o) => o.owner === p.id && o.state !== 'closed' && o.state !== 'done').length;
  const shops = Object.values(w.biz).filter((b) => b.open && b.protection?.collectorId === p.id).length;
  const stakes = stakesOf(w, p.id).length;
  const close = Object.values(p.rels).filter((r) => r.trust > 0.6).length;
  const m = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
  return {
    earner: m(ops * 14 + shops * 8 + stakes * 12 + (p.lifetimeGross ?? p.lifetimeKick) / 2500),
    operator: m((p.career?.done ?? 0) * 3 + crew * 8 + (w.path?.deeds ?? 0) * 1.5),
    negotiator: m((p.rep?.kept ?? 0) * 5 + close * 3 + p.standing / 4),
    enforcer: m((w.path?.kills ?? 0) * 25 + p.skills.muscle * 15 + p.skills.nerve * 10),
  };
}
export const tierOf = (score: number) => (score >= 75 ? 3 : score >= 45 ? 2 : score >= 20 ? 1 : 0);
export const specTier = (w: World, p: Character, s: Spec) => tierOf(specScores(w, p)[s]);
export const hasPerk = (w: World, p: Character, s: Spec) => !!p && specTier(w, p, s) >= 2;
