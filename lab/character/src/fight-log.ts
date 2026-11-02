// Fights in words: one short line per event, what a roll the fight is waiting for is about, and the fight rules, all
// worded for the fight's dice and built from the rules' constants. Rounds are not repeated in each line (a log groups
// lines by round), and roll breakdowns are left to whoever shows the detail.
import { bonusOf, totalOf, type Modifier, type Total } from './check';
import { BASE_DEFENCE, BASE_HIT_POINTS, EXPERT_MULTIPLE } from './character';
import { extremeName, extremePhrase, type Dice } from './dice';
import { compactSum, percent } from './explain';
import { UNARMED_DAMAGE_DIE, type Damage, type Fighter, type FightEvent, type RollRequest } from './fight';
import { lowestHit, resultNeeded, successChanceOf } from './fight-odds';
import { FLEES_WHEN, NERVE_DC, type Side } from './nerve';
import { describeSkillBonus } from './skills';

/** How the sides are named in words. */
export const SIDE_NAME: Readonly<Record<Side, string>> = { attacker: 'Left', defender: 'Right' };

export interface DescribeOptions {
  /** Include roll totals and DCs. Leave them out when the dice are shown separately; natural 20s and 1s are still named. */
  readonly rolls?: boolean;
}

/** A name for each fighter id. Throws for an id that is not one of the fighters. */
function namesOf(fighters: readonly Fighter[]): (id: string) => string {
  const names = new Map(fighters.map((f) => [f.id, f.character.name]));
  return (id) => {
    const name = names.get(id);
    if (name === undefined) throw new RangeError(`no fighter ${id}`);
    return name;
  };
}

/** Describes an event, naming the fighters. */
export function describeFightEvent(event: FightEvent, fighters: readonly Fighter[], options: DescribeOptions = {}): string {
  const rolls = options.rolls ?? true;
  const numbers = (text: string) => (rolls ? ` (${text})` : '');
  const name = namesOf(fighters);
  switch (event.kind) {
    case 'initiative':
      return `Turn order: ${event.order.map((o) => `${name(o.id)}${numbers(String(o.roll.total))}`).join(', ')}.`;
    case 'attack': {
      const why = event.extreme ? ` (${extremeName(event.extreme, event.result.roll.dice)})` : numbers(`rolled ${event.result.roll.total} vs Defence ${event.result.dc}`);
      if (!event.damage) return `${name(event.by)} misses ${name(event.target)}${why}.`;
      const hits = event.outcome === 'critical' ? `lands a critical hit on ${name(event.target)}` : `hits ${name(event.target)}`;
      return `${name(event.by)} ${hits}: ${event.damage.total} damage, ${event.hp} HP left${why}.`;
    }
    case 'nerve': {
      const { result, passed } = event.check;
      return `${name(event.id)} ${SITUATION[event.trigger]} and ${passed ? 'holds' : 'loses'} their nerve${numbers(`rolled ${result.roll.total} vs ${result.dc}`)}.`;
    }
    case 'out':
      return `${name(event.id)} ${{ 'knocked-out': 'is knocked out', surrendered: 'surrenders', 'backed-off': 'backs off', fled: 'flees' }[event.status]}.`;
    case 'end':
      return event.winner === null ? 'Stalemate: the round limit was reached.' : `${SIDE_NAME[event.winner]} wins.`;
  }
}

/** A hit's damage dice in a few characters, e.g. "damage 2d4: 3+2 + 1 = 6", noting when the minimum of 1 applied. */
export function compactDamage(damage: Damage): string {
  return `damage ${damage.faces.length}d${UNARMED_DAMAGE_DIE}: ${compactSum(damage.faces, damage.modifier, damage.total)}${damage.minimumApplied ? ' (minimum 1)' : ''}`;
}

const SITUATION = { hurt: 'is at half HP', 'allies-down': 'sees half their side out of the fight' } as const;

const plus = (n: number) => (n < 0 ? ` − ${-n}` : ` + ${n}`);

/**
 * Describes a roll the fight is waiting for: what it is for, and for an attack or nerve check, what it needs and the
 * chance. On a d20 it gives the number needed; on other dice only the chance. Midway through a multi-dice roll (when
 * stepping die by die) it names the die and gives neither, as the earlier dice have already changed the odds.
 */
export function describeRollRequest(request: RollRequest): string {
  const { reason: r, dice } = request;
  const which = r.die > 1 ? ` (die ${r.die} of ${r.of})` : '';
  const d20 = dice.count === 1 && dice.sides === 20;
  const chance = () => percent(successChanceOf(request));
  switch (r.kind) {
    case 'initiative':
      return `${r.by.name} rolls initiative: ${dice.name}${plus(bonusOf(r.modifiers))}${which}.`;
    case 'target':
      return `${r.by.name} picks who to attack: ${r.options.map((o, i) => `${i + 1} = ${o.name}`).join(', ')}.`;
    case 'damage': {
      const modifier = bonusOf(r.modifiers) ? plus(bonusOf(r.modifiers)) : '';
      const what = r.critical ? 'damage for a critical hit' : 'damage';
      return `${r.by.name} rolls ${what} against ${r.target.name}: ${r.of}d${UNARMED_DAMAGE_DIE}${modifier}${which}.`;
    }
    case 'attack': {
      const advantage = r.edge === 'advantage' ? ' with advantage (someone else is already attacking them)' : '';
      const roll = `${r.by.name} attacks ${r.target.name}${advantage}: ${dice.name}${plus(bonusOf(r.modifiers))} against Defence ${totalOf(r.defence)}`;
      if (r.die > 1) return `${roll}${which}.`;
      if (!d20) return `${roll}. ${chance()} to hit.`;
      return `${roll}. Needs ${lowestHit(dice, bonusOf(r.modifiers), totalOf(r.defence), r.edge)} or more ${r.edge === 'advantage' ? 'on either die' : 'to hit'} (${chance()}).`;
    }
    case 'nerve': {
      const roll = `${r.by.name} ${SITUATION[r.trigger]} and must hold their nerve: ${dice.name}${plus(bonusOf(r.modifiers))} against ${r.dc}`;
      if (r.die > 1) return `${roll}${which}.`;
      const needed = resultNeeded(request);
      if (needed === 'always') return `${roll}. Holds whatever the roll.`;
      if (needed === 'never') return `${roll}. Cannot hold, whatever the roll.`;
      return d20 ? `${roll}. Needs ${needed} or more (${chance()}).` : `${roll}. ${chance()} to hold.`;
    }
  }
}

export interface RollExplanation {
  /** What the roll is for, in a sentence. */
  readonly purpose: string;
  /** Who rolls and what their bonus is called, e.g. "Sam’s attack bonus"; null for a roll with no bonus. */
  readonly bonusLabel: string | null;
  /** The parts of the roller's bonus, each with its reason: exactly the modifiers the roll adds. */
  readonly bonus: readonly Modifier[];
  /** For an attack, the target's Defence and its parts. */
  readonly against: { readonly label: string; readonly total: number; readonly parts: Total } | null;
}

/** Why a roll is being made and where its numbers come from, worded for the fight's dice. */
export function explainRoll(request: RollRequest): RollExplanation {
  const { reason: r, dice } = request;
  const rules = fightRules(dice);
  const own = (what: string) => `${r.by.name}’s ${what}`;
  switch (r.kind) {
    case 'initiative':
      return { purpose: rules.initiative, bonusLabel: own('initiative bonus'), bonus: r.modifiers, against: null };
    case 'target':
      return { purpose: 'Each fighter attacks a random enemy who is still fighting; the die picks which.', bonusLabel: null, bonus: [], against: null };
    case 'attack': {
      const advantage = r.edge === 'advantage' ? ` This attack has advantage, for ganging up. ${rules.gangingUp}` : '';
      return {
        purpose: `${rules.attack} ${rules.extremes}${advantage}`,
        bonusLabel: own('attack bonus'),
        bonus: r.modifiers,
        against: { label: `${r.target.name}’s Defence`, total: totalOf(r.defence), parts: r.defence },
      };
    }
    case 'damage':
      return { purpose: rules.damage, bonusLabel: own('damage bonus'), bonus: r.modifiers, against: null };
    case 'nerve':
      return { purpose: r.trigger === 'hurt' ? rules.nerveHurt : rules.nerveAlliesDown, bonusLabel: own('nerve bonus'), bonus: r.modifiers, against: null };
  }
}

/** The fight rules in words, one sentence or two each, for these dice. */
export interface FightRules {
  readonly initiative: string;
  readonly attack: string;
  readonly extremes: string;
  readonly damage: string;
  readonly gangingUp: string;
  readonly hitPoints: string;
  readonly nerveHurt: string;
  readonly nerveAlliesDown: string;
  readonly nerveFailure: string;
  readonly end: string;
}

export function fightRules(dice: Dice): FightRules {
  const nerve = `${dice.name} + ${describeSkillBonus('nerve', 'temperament')}`;
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return {
    initiative: `Initiative decides who acts first each round: everyone rolls ${dice.name} + ${describeSkillBonus('reflexes')}. The highest acts first, and so on down; on a tie, the right side first. The order is used every round.`,
    attack: `On their turn, each fighter attacks a random enemy who is still fighting: ${dice.name} + ${describeSkillBonus('brawling')} against the target’s Defence (${BASE_DEFENCE} + Reflexes). Meeting or beating it is a hit.`,
    extremes: `${capital(extremePhrase('highest', dice))} always hits and is a critical hit; ${extremePhrase('lowest', dice)} always misses.`,
    damage: `A hit deals 1d${UNARMED_DAMAGE_DIE} plus the Strength modifier, at least 1. A critical hit rolls the damage dice twice.`,
    gangingUp: 'If someone on the same side has already attacked a target this round, an attack on them has advantage (the dice are rolled twice and the higher result counts).',
    hitPoints: `Hit points are ${BASE_HIT_POINTS} + the Constitution modifier, plus the proficiency bonus if trained in Toughness (×${EXPERT_MULTIPLE} if expert). At 0 a fighter is knocked out.`,
    nerveHurt: `The first time a fighter drops to half their hit points, they make one nerve check: ${nerve} against ${NERVE_DC.hurt}.`,
    nerveAlliesDown: `The first time half a side is out of the fight, everyone left on it makes one nerve check: ${nerve} against ${NERVE_DC['allies-down']}.`,
    nerveFailure: `Failing a nerve check takes a fighter out of the fight: someone with ${FLEES_WHEN} flees; anyone else surrenders (right side) or backs off (left side).`,
    end: 'A side loses when nobody on it is still fighting. If both sides are still fighting at the round limit, it is a stalemate.',
  };
}
