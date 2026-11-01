// Backgrounds: D&D's answer to "what did you do before?", in place of classes. A background gives a man his training, ranks
// his attributes for a rolled character, and sets where his temperament leans.
import { assignScores, rollScores, type Attribute } from './attributes';
import { createCharacter, type Character, type Training } from './character';
import type { Roller } from './random';
import type { Skill } from './skills';
import { rollTemperament, type Temperament } from './temperament';

export const BACKGROUNDS = ['legbreaker', 'wheelman', 'shooter', 'earner', 'hustler', 'bookkeeper', 'shopkeeper', 'labourer'] as const;
export type BackgroundName = (typeof BACKGROUNDS)[number];

export interface Background {
  readonly name: string;
  readonly blurb: string;
  readonly trained: readonly Skill[];
  readonly expert: readonly Skill[];
  /** Every attribute, the one the trade needs most first. */
  readonly priorities: readonly Attribute[];
  readonly leanings: Partial<Temperament>;
}

export const BACKGROUND_INFO: { readonly [B in BackgroundName]: Background } = {
  legbreaker: {
    name: 'Leg-breaker',
    blurb: 'Collects what is owed and makes examples of those who don’t pay.',
    trained: ['intimidation', 'toughness'],
    expert: ['brawling'],
    priorities: ['str', 'con', 'cha', 'agi', 'wis', 'int'],
    leanings: { violence: 0.8, cruelty: 0.65, caution: 0.35, temper: 0.65 },
  },
  wheelman: {
    name: 'Wheelman',
    blurb: 'Drives the car, waits with the engine running, and loses the tail.',
    trained: ['reflexes', 'notice', 'mechanics'],
    expert: ['driving'],
    priorities: ['agi', 'wis', 'int', 'con', 'cha', 'str'],
    leanings: { caution: 0.6, courage: 0.6, temper: 0.35 },
  },
  shooter: {
    name: 'Shooter',
    blurb: 'Does the work nobody talks about, quietly and once.',
    trained: ['stealth', 'nerve', 'reflexes'],
    expert: ['firearms'],
    priorities: ['agi', 'wis', 'con', 'int', 'str', 'cha'],
    leanings: { violence: 0.7, temper: 0.25, sociability: 0.3, courage: 0.7, loyalty: 0.65 },
  },
  earner: {
    name: 'Earner',
    blurb: 'Brings in money: rackets, deals, a word in the right ear.',
    trained: ['streetwise', 'scheming', 'insight'],
    expert: ['persuasion'],
    priorities: ['cha', 'int', 'wis', 'con', 'agi', 'str'],
    leanings: { greed: 0.75, ambition: 0.75, sociability: 0.7 },
  },
  hustler: {
    name: 'Hustler',
    blurb: 'Lives on cards, cons and other people’s pockets.',
    trained: ['larceny', 'carousing', 'streetwise'],
    expert: ['deception'],
    priorities: ['cha', 'agi', 'int', 'wis', 'con', 'str'],
    leanings: { honesty: 0.2, vice: 0.75, caution: 0.35, greed: 0.65 },
  },
  bookkeeper: {
    name: 'Bookkeeper',
    blurb: 'Keeps the books, and knows where every dollar went.',
    trained: ['scheming', 'insight', 'deception'],
    expert: ['bookkeeping'],
    priorities: ['int', 'wis', 'cha', 'con', 'agi', 'str'],
    leanings: { caution: 0.75, violence: 0.2, courage: 0.35 },
  },
  shopkeeper: {
    name: 'Shopkeeper',
    blurb: 'Runs a shop, a bar or a betting office, and pays to be left alone.',
    trained: ['bookkeeping', 'persuasion', 'notice'],
    expert: [],
    priorities: ['int', 'cha', 'wis', 'con', 'agi', 'str'],
    leanings: { caution: 0.65, violence: 0.25, honesty: 0.6 },
  },
  labourer: {
    name: 'Labourer',
    blurb: 'Works the docks or a building site, and has done since he was fourteen.',
    trained: ['brawling', 'toughness', 'mechanics'],
    expert: [],
    priorities: ['str', 'con', 'wis', 'agi', 'cha', 'int'],
    leanings: { pride: 0.6, sociability: 0.6 },
  },
};

export function trainingFor(background: BackgroundName): Training {
  const { trained, expert } = BACKGROUND_INFO[background];
  return Object.fromEntries([...trained.map((s) => [s, 'trained']), ...expert.map((s) => [s, 'expert'])]);
}

/** A man of the background, rolled: 4d6-drop-lowest scores ranked as his trade needs them, and a temperament around its leanings. */
export function rollCharacter(name: string, background: BackgroundName, roller: Roller, options: { readonly proficiencyBonus?: number } = {}): Character {
  const info = BACKGROUND_INFO[background];
  return createCharacter({
    name,
    background,
    attributes: assignScores(rollScores(roller), info.priorities),
    training: trainingFor(background),
    temperament: rollTemperament(roller, info.leanings),
    ...options,
  });
}
