// The parts of a roll, each a modifier as it truly is and as each viewer would count it, so odds, explanations and results can
// be given to a viewer without leaking private state. Social checks, skill checks and plans are built from these.
import type { CastRecord } from './cast';
import { DICE, type Edge } from './dice';
import type { Modifier, Roll } from './check';
import type { CharacterRecord, Id } from './character';
import { conditionOf, effectParts } from './condition';
import { currentTemperament } from './conduct';
import { itemParts, type ItemOptions } from './items';
import { planEffect, type JobId } from './jobs';
import { attributeUsed, skillModifiers, type Skill } from './skills';
import { temperamentModifiers, type Situation } from './temperament';

/** A modifier as it truly is (null if it truly is none), and how each viewer would count it: as it is, as they believe it to be, or not at all (null). */
export interface Part {
  readonly truth: Modifier | null;
  knownTo(viewer: Id): Modifier | null;
}

export const everyone = (modifier: Modifier): Part => ({ truth: modifier, knownTo: () => modifier });
export const knownBy = (ids: readonly (Id | undefined)[], modifier: Modifier): Part => ({ truth: modifier, knownTo: (v) => (ids.includes(v) ? modifier : null) });
/** A modifier of a character's own that anyone present can see, if `visible`, and otherwise only they know. */
export const ownPart = (visible: boolean, owner: Id, modifier: Modifier): Part => (visible ? everyone(modifier) : knownBy([owner], modifier));
/** Item effects that anyone present can see: those of items shown, worn or being used. */
const VISIBLE_ITEMS: readonly string[] = ['shown', 'worn', 'used'];

export const seenBy = (parts: readonly Part[], viewer: Id): Modifier[] => parts.flatMap((p) => p.knownTo(viewer) ?? []);
export const truthOf = (parts: readonly Part[]): Modifier[] => parts.flatMap((p) => p.truth ?? []);
export const d20 = (modifiers: readonly Modifier[], edge: Edge = 'none'): Roll => ({ dice: DICE.d20, edge, modifiers });

/** A skill roll's own parts: the skill, the effects (only hurt is visible), the items (those shown, worn or used are visible) and temperament. */
export function skillParts(c: CharacterRecord, skill: Skill, situations: readonly Situation[], items: ItemOptions = {}): Part[] {
  const condition = conditionOf(c, c.condition);
  return [
    ...skillModifiers(c, skill).map((m) => knownBy([c.id], m)),
    ...effectParts(condition, skill, attributeUsed(c, skill)).map((p) => ownPart(p.effect === 'hurt', c.id, p.modifier)),
    ...itemParts(c.inventory, skill, items).map((p) => ownPart(VISIBLE_ITEMS.includes(p.when), c.id, p.modifier)),
    ...temperamentModifiers(currentTemperament(c), situations).map((m) => knownBy([c.id], m)),
  ];
}

/** A roll's advantage from a plan: whether it truly has it, and whether a viewer knows it does. */
export interface PlanAdvantage {
  readonly truth: boolean;
  knownTo(viewer: Id): boolean;
  /** The job whose plan's advantage it uses. */
  readonly job?: JobId;
}

const NO_ADVANTAGE: PlanAdvantage = { truth: false, knownTo: () => false };

/**
 * A skill roll's parts in a cast: its own, and, for a roll made for a job they are taking part in, the job's plan, as it truly
 * is and as the job's members believe it; anyone outside the job knows nothing of it. With it, the plan's advantage if this
 * is the chosen check.
 */
export function rollParts(
  data: CastRecord,
  c: CharacterRecord,
  skill: Skill,
  situations: readonly Situation[],
  items: ItemOptions = {},
  job?: JobId,
): { readonly parts: Part[]; readonly advantage: PlanAdvantage } {
  const own = skillParts(c, skill, situations, items);
  const plan = planEffect(data.jobs, c.id, skill, job);
  if (plan === null) return { parts: own, advantage: NO_ADVANTAGE };
  const members = plan.job.members;
  const part: Part = { truth: plan.truth, knownTo: (v) => (members.includes(v) ? plan.believed : null) };
  return {
    parts: [...own, part],
    advantage: plan.advantage ? { truth: true, knownTo: (v) => members.includes(v), job: plan.job.id } : NO_ADVANTAGE,
  };
}
