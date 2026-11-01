// Skills: what a man has learned. Each rests on an attribute; a few can be done another way (a big man intimidates with his size).
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
  /** Other attributes the skill can be done with. */
  readonly alternatives?: readonly Attribute[];
  readonly covers: string;
}

export const SKILL_INFO: { readonly [S in Skill]: SkillInfo } = {
  brawling: { name: 'Brawling', attribute: 'str', covers: 'Fists, boots and whatever is to hand: a beating, a bar fight.' },
  intimidation: { name: 'Intimidation', attribute: 'cha', alternatives: ['str'], covers: 'Making a man afraid enough to do as he is told.' },
  firearms: { name: 'Firearms', attribute: 'agi', covers: 'Drawing and shooting straight when it counts.' },
  reflexes: { name: 'Reflexes', attribute: 'agi', covers: 'Reacting first: ducking, grabbing, getting out of the way.' },
  driving: { name: 'Driving', attribute: 'agi', covers: 'Getaways, tails and losing one.' },
  stealth: { name: 'Stealth', attribute: 'agi', covers: 'Going unseen and unheard, on foot.' },
  larceny: { name: 'Larceny', attribute: 'agi', covers: 'Locks, safes, pockets and hot-wiring.' },
  toughness: { name: 'Toughness', attribute: 'con', covers: 'Staying on your feet: a beating, a wound, an interrogation.' },
  carousing: { name: 'Carousing', attribute: 'con', covers: 'Holding your drink and keeping up through the night.' },
  bookkeeping: { name: 'Bookkeeping', attribute: 'int', covers: 'Ledgers, skims, laundering, and spotting someone else’s skim.' },
  scheming: { name: 'Scheming', attribute: 'int', covers: 'Planning a job and thinking three moves ahead.' },
  mechanics: { name: 'Mechanics', attribute: 'int', covers: 'Engines, wiring, fires and things that go bang.' },
  streetwise: { name: 'Streetwise', attribute: 'wis', covers: 'Rumours, who is who, and where to find a man.' },
  insight: { name: 'Insight', attribute: 'wis', covers: 'Reading a man: a lie, a fear, what he really wants.' },
  notice: { name: 'Notice', attribute: 'wis', covers: 'Spotting the tail, the cop, the wrong detail.' },
  nerve: { name: 'Nerve', attribute: 'wis', alternatives: ['con'], covers: 'Holding together under threat, under fire, under questioning.' },
  persuasion: { name: 'Persuasion', attribute: 'cha', covers: 'Charm, deals and talking a man round.' },
  deception: { name: 'Deception', attribute: 'cha', covers: 'Lies, alibis and a straight face.' },
};

/** The attributes a skill can be done with, its own first. */
export function attributesFor(skill: Skill): readonly Attribute[] {
  const info = SKILL_INFO[skill];
  return [info.attribute, ...(info.alternatives ?? [])];
}
