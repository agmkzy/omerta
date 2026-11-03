// What one character can see of another. Everything about a character is private (their attributes, skills, temperament,
// feelings, knowledge, effects and hidden items) except what anyone present can see of them. Odds, explanations and results
// given to a viewer count another character's private state only where the viewer knows it.
import type { CharacterRecord, Id } from './character';

/** What anyone present can see of a character. Items shown or worn, and being visibly hurt, join it with inventory and condition. */
export interface Seen {
  readonly id: Id;
  readonly name: string;
}

export function seen(c: CharacterRecord): Seen {
  return { id: c.id, name: c.name };
}
