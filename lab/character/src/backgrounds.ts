// Backgrounds replace D&D classes. A background sets a character's skill training, the order in which rolled attribute
// scores are assigned, and the centre values for a rolled temperament.
import { assignScores, rollScores, type Attribute } from './attributes';
import { createCharacter, type Character, type Training } from './character';
import type { Roller } from './random';
import type { Skill } from './skills';
import { rollTemperament, type Temperament } from './temperament';

export const BACKGROUNDS = ['enforcer', 'driver', 'gunman', 'racketeer', 'con-artist', 'bookkeeper', 'shopkeeper', 'labourer'] as const;
export type BackgroundName = (typeof BACKGROUNDS)[number];

export interface Background {
  readonly name: string;
  readonly description: string;
  readonly trained: readonly Skill[];
  readonly expert: readonly Skill[];
  /** All six attributes, most important first. */
  readonly priorities: readonly Attribute[];
  /** Centre values for a rolled temperament. */
  readonly temperament: Partial<Temperament>;
}

export const BACKGROUND_INFO: { readonly [B in BackgroundName]: Background } = {
  enforcer: {
    name: 'Enforcer',
    description: 'Collects debts and uses force when required.',
    trained: ['intimidation', 'toughness'],
    expert: ['brawling'],
    priorities: ['str', 'con', 'cha', 'agi', 'wis', 'int'],
    temperament: { violence: 0.8, cruelty: 0.65, caution: 0.35, temper: 0.65 },
  },
  driver: {
    name: 'Driver',
    description: 'Getaway and pursuit driving.',
    trained: ['reflexes', 'notice', 'mechanics'],
    expert: ['driving'],
    priorities: ['agi', 'wis', 'int', 'con', 'cha', 'str'],
    temperament: { caution: 0.6, courage: 0.6, temper: 0.35 },
  },
  gunman: {
    name: 'Gunman',
    description: 'Armed jobs and killings.',
    trained: ['stealth', 'nerve', 'reflexes'],
    expert: ['firearms'],
    priorities: ['agi', 'wis', 'con', 'int', 'str', 'cha'],
    temperament: { violence: 0.7, temper: 0.25, sociability: 0.3, courage: 0.7, loyalty: 0.65 },
  },
  racketeer: {
    name: 'Racketeer',
    description: 'Runs rackets and deals; earns money for the organisation.',
    trained: ['streetwise', 'scheming', 'insight'],
    expert: ['persuasion'],
    priorities: ['cha', 'int', 'wis', 'con', 'agi', 'str'],
    temperament: { greed: 0.75, ambition: 0.75, sociability: 0.7 },
  },
  'con-artist': {
    name: 'Con artist',
    description: 'Cons, card games and theft.',
    trained: ['larceny', 'carousing', 'streetwise'],
    expert: ['deception'],
    priorities: ['cha', 'agi', 'int', 'wis', 'con', 'str'],
    temperament: { honesty: 0.2, vice: 0.75, caution: 0.35, greed: 0.65 },
  },
  bookkeeper: {
    name: 'Bookkeeper',
    description: 'Keeps the accounts and launders money.',
    trained: ['scheming', 'insight', 'deception'],
    expert: ['bookkeeping'],
    priorities: ['int', 'wis', 'cha', 'con', 'agi', 'str'],
    temperament: { caution: 0.75, violence: 0.2, courage: 0.35 },
  },
  shopkeeper: {
    name: 'Shopkeeper',
    description: 'Runs a legitimate business such as a shop, bar or betting office.',
    trained: ['bookkeeping', 'persuasion', 'notice'],
    expert: [],
    priorities: ['int', 'cha', 'wis', 'con', 'agi', 'str'],
    temperament: { caution: 0.65, violence: 0.25, honesty: 0.6 },
  },
  labourer: {
    name: 'Labourer',
    description: 'Manual work such as the docks or construction.',
    trained: ['brawling', 'toughness', 'mechanics'],
    expert: [],
    priorities: ['str', 'con', 'wis', 'agi', 'cha', 'int'],
    temperament: { pride: 0.6, sociability: 0.6 },
  },
};

export function trainingFor(background: BackgroundName): Training {
  const { trained, expert } = BACKGROUND_INFO[background];
  return Object.fromEntries([...trained.map((s) => [s, 'trained']), ...expert.map((s) => [s, 'expert'])]);
}

/** Generates a character for a background: rolled attribute scores assigned by its priorities, its training, and a rolled temperament. */
export function rollCharacter(name: string, background: BackgroundName, roller: Roller, options: { readonly proficiencyBonus?: number } = {}): Character {
  const info = BACKGROUND_INFO[background];
  return createCharacter({
    name,
    background,
    attributes: assignScores(rollScores(roller), info.priorities),
    training: trainingFor(background),
    temperament: rollTemperament(roller, info.temperament),
    ...options,
  });
}
