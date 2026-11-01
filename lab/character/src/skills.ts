// Skills. Each is based on one attribute; some also allow an alternative attribute (e.g. Intimidation with Strength).
import type { Attribute } from './attributes';

export const SKILLS = [
  'brawling', 'intimidation',
  'firearms', 'reflexes', 'driving', 'stealth', 'larceny',
  'toughness', 'carousing',
  'bookkeeping', 'scheming', 'mechanics',
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
  bookkeeping: { name: 'Bookkeeping', attribute: 'int', covers: 'Accounts, laundering and detecting fraud.' },
  scheming: { name: 'Scheming', attribute: 'int', covers: 'Planning and anticipating others.' },
  mechanics: { name: 'Mechanics', attribute: 'int', covers: 'Engines, electrics, arson and explosives.' },
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
