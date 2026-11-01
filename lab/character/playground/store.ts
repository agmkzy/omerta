// The two characters shared by the panels.
import { rollCharacter, type BackgroundName } from '../src/backgrounds';
import type { Character } from '../src/character';
import type { Side } from '../src/contest';
import { roller, seeded } from '../src/random';

type Listener = (side: Side, source: string) => void;

const dice = roller(seeded(1970));
const characters: Record<Side, Character> = {
  attacker: rollCharacter('Character 1', 'enforcer', dice),
  defender: rollCharacter('Character 2', 'shopkeeper', dice),
};
const listeners: Listener[] = [];

export const SIDE_LABEL: Readonly<Record<Side, string>> = { attacker: 'Attacker', defender: 'Defender' };

export function character(side: Side): Character {
  return characters[side];
}

/** Replaces a character. `source` identifies the panel making the change, so that panel can skip re-rendering itself. */
export function setCharacter(side: Side, c: Character, source: string): void {
  characters[side] = c;
  for (const l of listeners) l(side, source);
}

export function swapSides(source: string): void {
  [characters.attacker, characters.defender] = [characters.defender, characters.attacker];
  for (const l of listeners) {
    l('attacker', source);
    l('defender', source);
  }
}

export function onChange(listener: Listener): void {
  listeners.push(listener);
}

/** Rolls a new character from the session's seeded stream. */
export function rollNew(name: string, background: BackgroundName): Character {
  return rollCharacter(name, background, dice);
}
