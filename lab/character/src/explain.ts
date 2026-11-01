// Text descriptions of rolls and checks: the dice faces, each modifier with its reason, the total and the outcome.
import type { CheckResult, Modifier, OpposedResult, RollResult } from './check';

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

export function describeRoll(roll: RollResult): string {
  const { throws, kept } = roll.thrown;
  const faces = throws.map((t) => `[${t.join(' ')}]`).join(' ');
  const thrown = roll.edge === 'none' ? `${roll.dice.name} ${faces} = ${kept}` : `${roll.dice.name} with ${roll.edge} ${faces} keeps ${kept}`;
  return [thrown, ...roll.modifiers.map(describeModifier)].join(', ') + `: ${roll.total}`;
}

export function describeCheck(result: CheckResult): string {
  return `${describeRoll(result.roll)} against ${result.dc}: ${result.outcome} (${byHowMuch(result.margin)})`;
}

export function describeOpposed(result: OpposedResult): string {
  return `${describeRoll(result.active)} against ${describeRoll(result.passive)}: ${result.outcome} (${byHowMuch(result.margin)})`;
}

function byHowMuch(margin: number): string {
  return margin >= 0 ? `by ${margin}` : `short by ${-margin}`;
}
