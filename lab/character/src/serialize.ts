// Saving and loading characters as plain JSON. Loading validates every known field and defaults anything missing, so data
// saved before a field (e.g. a new trait) existed still loads. Anything this version does not recognise (a field, a
// background, an attribute, a skill or a trait) is ignored rather than rejected, and reported, so the caller can keep
// the original before saving over it. Renames are handled by migrations, as format 1 to 2 renamed the backgrounds.
import { ATTRIBUTES, attributeScores, type AttributeScores } from './attributes';
import { BACKGROUNDS, type BackgroundName } from './backgrounds';
import { PROFICIENCIES, createCharacter, type Character, type Proficiency, type Training } from './character';
import { SKILLS, type Skill } from './skills';
import { TRAITS, temperament, type Temperament } from './temperament';

/** Increment when the saved shape changes in a way older code cannot read, and add a migration below. */
export const CHARACTER_FORMAT = 2;

/** Format 1 to 2: backgrounds were renamed. */
const RENAMED_BACKGROUNDS: Readonly<Record<string, BackgroundName>> = {
  enforcer: 'fighter', gunman: 'marksman', racketeer: 'negotiator', 'con-artist': 'trickster', bookkeeper: 'accountant',
};

export interface SavedCharacter {
  readonly format: number;
  readonly name: string;
  readonly background?: BackgroundName;
  readonly attributes: AttributeScores;
  readonly training: Training;
  readonly proficiencyBonus: number;
  readonly temperament: Temperament;
}

export function saveCharacter(c: Character): SavedCharacter {
  return {
    format: CHARACTER_FORMAT,
    name: c.name,
    ...(c.background && { background: c.background }),
    attributes: { ...c.attributes },
    training: { ...c.training },
    proficiencyBonus: c.proficiencyBonus,
    temperament: { ...c.temperament },
  };
}

/** Thrown for a character saved by a newer version, which this version does not read. */
export class NewerFormatError extends TypeError {}

/** A loaded character, and what in the saved data was not recognised and so is not in it. */
export interface ReadCharacter {
  readonly character: Character;
  /** Paths such as "training.juggling" or "background"; they are lost if the character is saved again. */
  readonly ignored: readonly string[];
}

/** Every field of SavedCharacter; the type check fails if one is missing or misspelt. */
const SAVED_FIELDS: readonly string[] = Object.keys({
  format: true, name: true, background: true, attributes: true, training: true, proficiencyBonus: true, temperament: true,
} satisfies Record<keyof SavedCharacter, true>);

/** Throws TypeError for data of the wrong shape (NewerFormatError for a newer format) and RangeError for out-of-range values. */
export function readCharacter(data: unknown): ReadCharacter {
  const d = { ...record(data, 'a saved character') };
  if (typeof d.format !== 'number' || !Number.isInteger(d.format) || d.format < 1) throw new TypeError('a saved character needs a format number of 1 or more');
  if (d.format > CHARACTER_FORMAT) throw new NewerFormatError(`saved with a newer format (${d.format}) than this version reads (${CHARACTER_FORMAT})`);
  if (typeof d.name !== 'string') throw new TypeError('a saved character needs a name');
  if (d.format < 2) migrateFrom1(d);
  if (d.proficiencyBonus !== undefined && typeof d.proficiencyBonus !== 'number') throw new TypeError('proficiencyBonus must be a number');
  const ignored = Object.keys(d).filter((k) => !SAVED_FIELDS.includes(k));
  const background = d.background === undefined || BACKGROUNDS.includes(d.background as BackgroundName) ? (d.background as BackgroundName | undefined) : undefined;
  if (d.background !== undefined && background === undefined) ignored.push('background');
  const character = createCharacter({
    name: d.name,
    ...(background !== undefined && { background }),
    ...(d.attributes !== undefined && { attributes: attributeScores(numbers(d.attributes, 'attributes', ATTRIBUTES, ignored)) }),
    ...(d.training !== undefined && { training: training(d.training, ignored) }),
    ...(d.proficiencyBonus !== undefined && { proficiencyBonus: d.proficiencyBonus }),
    ...(d.temperament !== undefined && { temperament: temperament(numbers(d.temperament, 'temperament', TRAITS, ignored)) }),
  });
  return { character, ignored };
}

/** As readCharacter, for callers that do not need to know what was ignored. */
export function loadCharacter(data: unknown): Character {
  return readCharacter(data).character;
}

/** Renames format-1 background ids in place. */
function migrateFrom1(d: Record<string, unknown>): void {
  if (typeof d.background === 'string') d.background = RENAMED_BACKGROUNDS[d.background] ?? d.background;
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${what} must be an object`);
  return value as Record<string, unknown>;
}

/** The known keys of an object of numbers; unknown keys are added to `ignored`. */
function numbers<K extends string>(value: unknown, what: string, keys: readonly K[], ignored: string[]): Partial<Record<K, number>> {
  const r = record(value, what);
  const out: Partial<Record<K, number>> = {};
  for (const k of Object.keys(r)) if (!keys.includes(k as K)) ignored.push(`${what}.${k}`);
  for (const k of keys) {
    if (r[k] === undefined) continue;
    if (typeof r[k] !== 'number') throw new TypeError(`${what}.${k} must be a number`);
    out[k] = r[k];
  }
  return out;
}

function training(value: unknown, ignored: string[]): Training {
  const out: Partial<Record<Skill, Proficiency>> = {};
  for (const [skill, level] of Object.entries(record(value, 'training'))) {
    if (!SKILLS.includes(skill as Skill)) {
      ignored.push(`training.${skill}`);
      continue;
    }
    if (!PROFICIENCIES.includes(level as Proficiency)) throw new RangeError(`unknown proficiency ${String(level)} for ${skill}`);
    if (level !== 'untrained') out[skill as Skill] = level as Proficiency;
  }
  return out;
}
