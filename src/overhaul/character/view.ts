// What one character can see of another. Everything about a character is private (their attributes, skills, temperament,
// feelings, knowledge, effects other than being hurt, and hidden items) except what anyone present can see of them. Odds,
// explanations and results given to a viewer count another character's private state only where the viewer knows it.
import type { CharacterRecord, Id } from './character';
import { conditionOf } from './condition';
import type { HeldItem } from './items';

/** How hurt a character visibly is. */
export type Looks = 'unhurt' | 'hurt' | 'unconscious';

/** What anyone present can see of a character. */
export interface Seen {
  readonly id: Id;
  readonly name: string;
  readonly looks: Looks;
  /** The items they show or wear. A carried item, and their cash, are private. */
  readonly items: readonly HeldItem[];
}

export function seen(c: CharacterRecord): Seen {
  const condition = conditionOf(c, c.condition);
  return {
    id: c.id,
    name: c.name,
    looks: condition.unconscious ? 'unconscious' : condition.hurt ? 'hurt' : 'unhurt',
    items: c.inventory.items.filter((h) => h.state !== 'carried'),
  };
}
