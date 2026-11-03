// Skills. Each is based on one attribute; some also allow an alternative attribute (e.g. Intimidation with Strength). A
// character's bonus in a skill is the attribute's modifier plus what their training adds.
import { ATTRIBUTE_INFO, abilityModifier, attributeScores, type Attribute, type AttributeScores } from './attributes';
import type { Modifier } from './check';

export const SKILLS = [
  'brawling', 'intimidation',
  'firearms', 'reflexes', 'driving', 'stealth', 'larceny',
  'toughness', 'carousing',
  'bookkeeping', 'planning', 'mechanics',
  'streetwise', 'insight', 'notice', 'nerve',
  'persuasion', 'deception',
] as const;
export type Skill = (typeof SKILLS)[number];

export interface SkillInfo {
  readonly name: string;
  readonly attribute: Attribute;
  /** Other attributes the skill can use. */
  readonly alternatives?: readonly Attribute[];
  readonly covers: string;
}

export const SKILL_INFO: { readonly [S in Skill]: SkillInfo } = {
  brawling: { name: 'Brawling', attribute: 'str', covers: 'Unarmed and improvised-weapon fighting.' },
  intimidation: { name: 'Intimidation', attribute: 'cha', alternatives: ['str'], covers: 'Coercing someone through threats.' },
  firearms: { name: 'Firearms', attribute: 'agi', covers: 'Using guns accurately under pressure.' },
  reflexes: { name: 'Reflexes', attribute: 'agi', covers: 'Reaction speed: dodging, grabbing, acting first.' },
  driving: { name: 'Driving', attribute: 'agi', covers: 'Driving under pressure: pursuits and evasion.' },
  stealth: { name: 'Stealth', attribute: 'agi', covers: 'Moving unseen and unheard.' },
  larceny: { name: 'Larceny', attribute: 'agi', covers: 'Lockpicking, safecracking, pickpocketing, hot-wiring.' },
  toughness: { name: 'Toughness', attribute: 'con', covers: 'Withstanding injury, pain and exhaustion.' },
  carousing: { name: 'Carousing', attribute: 'con', covers: 'Tolerance for alcohol and late nights.' },
  bookkeeping: { name: 'Bookkeeping', attribute: 'int', covers: 'Financial records, and spotting errors or fraud in them.' },
  planning: { name: 'Planning', attribute: 'int', alternatives: ['wis'], covers: 'Preparing a job or a move.' },
  mechanics: { name: 'Mechanics', attribute: 'int', covers: 'Repairing and operating engines, machines and electrics.' },
  streetwise: { name: 'Streetwise', attribute: 'wis', covers: 'Local knowledge: rumours, contacts, finding people.' },
  insight: { name: 'Insight', attribute: 'wis', covers: 'Reading people’s intentions and detecting lies.' },
  notice: { name: 'Notice', attribute: 'wis', covers: 'Perception: spotting details, surveillance and danger.' },
  nerve: { name: 'Nerve', attribute: 'wis', alternatives: ['con'], covers: 'Staying composed under threat or interrogation.' },
  persuasion: { name: 'Persuasion', attribute: 'cha', covers: 'Negotiation and convincing others.' },
  deception: { name: 'Deception', attribute: 'cha', covers: 'Lying convincingly.' },
};

/** The skills that can use an attribute: those based on it first, then those allowing it as an alternative. */
export function skillsUsing(attribute: Attribute): { readonly skill: Skill; readonly primary: boolean }[] {
  return [
    ...SKILLS.filter((s) => SKILL_INFO[s].attribute === attribute).map((skill) => ({ skill, primary: true })),
    ...SKILLS.filter((s) => SKILL_INFO[s].alternatives?.includes(attribute)).map((skill) => ({ skill, primary: false })),
  ];
}

/** The attributes a skill can use, its primary attribute first. */
export function attributesFor(skill: Skill): readonly Attribute[] {
  const info = SKILL_INFO[skill];
  return [info.attribute, ...(info.alternatives ?? [])];
}

/**
 * What a skill roll adds, in words, e.g. "Nerve (the higher of the Wisdom and Constitution modifiers, plus any Nerve
 * training)". `also` names anything else added, e.g. "temperament".
 */
export function describeSkillBonus(skill: Skill, also?: string): string {
  const names = attributesFor(skill).map((a) => ATTRIBUTE_INFO[a].name);
  const attribute = names.length === 1 ? `the ${names[0]} modifier` : `the higher of the ${names.slice(0, -1).join(', ')} and ${names.at(-1)} modifiers`;
  const name = SKILL_INFO[skill].name;
  return `${name} (${attribute}, plus any ${name} training${also ? ` and ${also}` : ''})`;
}

export const PROFICIENCIES = ['untrained', 'trained', 'expert'] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];
export type Training = Readonly<Partial<Record<Skill, Proficiency>>>;

export const PROFICIENCY_MIN = 2;
export const PROFICIENCY_MAX = 6;

/** An expert adds the proficiency bonus this many times. */
export const EXPERT_MULTIPLE = 2;

/** What a character's skill bonuses are worked out from. */
export interface Abilities {
  readonly attributes: AttributeScores;
  readonly training: Training;
  /** Added once to trained skills and EXPERT_MULTIPLE times to expert skills. Ranges from 2 to 6, as in D&D. */
  readonly proficiencyBonus: number;
}

/** Complete abilities: average attributes, no training and a proficiency bonus of 2 unless given. Throws RangeError for
 * anything out of range. */
export function abilities(given: Partial<Abilities> = {}): Abilities {
  const proficiencyBonus = given.proficiencyBonus ?? PROFICIENCY_MIN;
  if (!Number.isInteger(proficiencyBonus) || proficiencyBonus < PROFICIENCY_MIN || proficiencyBonus > PROFICIENCY_MAX)
    throw new RangeError(`the proficiency bonus runs from ${PROFICIENCY_MIN} to ${PROFICIENCY_MAX}, got ${proficiencyBonus}`);
  for (const [skill, level] of Object.entries(given.training ?? {})) {
    if (!SKILLS.includes(skill as Skill)) throw new RangeError(`unknown skill ${skill}`);
    if (!PROFICIENCIES.includes(level)) throw new RangeError(`unknown proficiency ${String(level)} for ${skill}`);
  }
  return { attributes: attributeScores(given.attributes ?? {}), training: { ...given.training }, proficiencyBonus };
}

/** The attribute used for a skill: the highest of those allowed, preferring the primary one on a tie. */
export function attributeUsed(a: Abilities, skill: Skill): Attribute {
  return attributesFor(skill).reduce((best, x) => (a.attributes[x] > a.attributes[best] ? x : best));
}

/**
 * The modifiers a skill roll adds: the attribute modifier and any proficiency bonus, each with a reason. Uses
 * `attributeUsed` unless a specific allowed attribute is given.
 */
export function skillModifiers(a: Abilities, skill: Skill, using?: Attribute): Modifier[] {
  if (using !== undefined && !attributesFor(skill).includes(using))
    throw new RangeError(`${SKILL_INFO[skill].name} cannot be done with ${ATTRIBUTE_INFO[using].name}`);
  const attribute = using ?? attributeUsed(a, skill);
  const score = a.attributes[attribute];
  const modifiers: Modifier[] = [{ value: abilityModifier(score), reason: `${ATTRIBUTE_INFO[attribute].name} ${score}` }];
  const training = trainingModifier(a, skill);
  return training ? [...modifiers, training] : modifiers;
}

/** What training in a skill adds: the proficiency bonus if trained, EXPERT_MULTIPLE times it if expert; null if untrained. */
export function trainingModifier(a: Abilities, skill: Skill): Modifier | null {
  const name = SKILL_INFO[skill].name;
  switch (a.training[skill] ?? 'untrained') {
    case 'trained':
      return { value: a.proficiencyBonus, reason: `Trained in ${name}` };
    case 'expert':
      return { value: EXPERT_MULTIPLE * a.proficiencyBonus, reason: `Expert at ${name}` };
    case 'untrained':
      return null;
  }
}
