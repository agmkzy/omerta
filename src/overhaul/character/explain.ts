// Text descriptions of rolls and checks: the dice faces, each modifier with its reason, the total and the outcome.
import { OUTCOME_INFO, type CheckResult, type Modifier, type OpposedResult, type RollResult, type Total } from './check';

export function signed(n: number): string {
  return n < 0 ? `−${-n}` : `+${n}`;
}

export function percent(p: number): string {
  if (p <= 0) return '0%';
  if (p >= 1) return '100%';
  if (p < 0.005) return '<1%';
  if (p > 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}

export function describeModifier(m: Modifier): string {
  return `${signed(m.value)} ${m.reason}`;
}

/** A total's parts, e.g. "10 base, −1 Agility 9". */
export function describeTotal(t: Total): string {
  return [`${t.base} base`, ...t.modifiers.map(describeModifier)].join(', ');
}

export function describeRoll(roll: RollResult): string {
  const { throws, kept } = roll.thrown;
  const faces = throws.map((t) => `[${t.join(' ')}]`).join(' ');
  const thrown = roll.edge === 'none' ? `${roll.dice.name} ${faces} = ${kept}` : `${roll.dice.name} with ${roll.edge} ${faces} keeps ${kept}`;
  return [thrown, ...roll.modifiers.map(describeModifier)].join(', ') + `: ${roll.total}`;
}

export function describeCheck(result: CheckResult): string {
  return `${describeRoll(result.roll)} against ${result.dc}: ${OUTCOME_INFO[result.outcome].name.toLowerCase()} (${byHowMuch(result.margin)})`;
}

export function describeOpposed(result: OpposedResult): string {
  const lead = result.active.total - result.passive.total;
  return `${describeRoll(result.active)} against ${describeRoll(result.passive)}: ${OUTCOME_INFO[result.outcome].name.toLowerCase()} (${describeLead(lead)})`;
}

/** How far the acting side's total is ahead of the other's. A tie goes to the side resisting. */
function describeLead(lead: number): string {
  return lead > 0 ? `ahead by ${lead}` : lead === 0 ? 'a tie' : `behind by ${-lead}`;
}

function byHowMuch(margin: number): string {
  return margin >= 0 ? `by ${margin}` : `short by ${-margin}`;
}

/** A roll in a few characters: the faces, the total bonus and the result, e.g. "d20: 6 + 6 = 12". */
export function compactRoll(roll: RollResult): string {
  const { throws, kept } = roll.thrown;
  if (roll.edge === 'none') return `${roll.dice.name}: ${compactSum(throws.flat(), roll.bonus, roll.total)}`;
  return `${roll.dice.name} with ${roll.edge}: ${throws.map((t) => t.join('+')).join(' or ')} → ${kept}${withBonus(roll.bonus, roll.total)}`;
}

/** " + 2 = 15" after a dice result, or nothing when there is no bonus. */
function withBonus(bonus: number, total: number): string {
  return bonus === 0 ? '' : ` ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)} = ${total}`;
}

/** Faces, a bonus and the total, e.g. "2+5+6 + 2 = 15" or "4+4 = 8"; a single die with no bonus is just its face. */
export function compactSum(faces: readonly number[], bonus: number, total: number): string {
  const dice = faces.join('+');
  if (bonus !== 0) return `${dice}${withBonus(bonus, total)}`;
  return faces.length > 1 ? `${dice} = ${total}` : dice;
}
