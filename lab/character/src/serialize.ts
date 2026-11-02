// Saving and loading characters as plain JSON. Loading validates every known field and defaults anything missing, so data
// saved before a field (e.g. a new trait) existed still loads. Unknown attributes, traits and skills are ignored rather
// than rejected, so data saved before one was removed still loads; renames are handled by migrations.
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

/** Throws TypeError for data of the wrong shape and RangeError for out-of-range values. */
export function loadCharacter(data: unknown): Character {
  const d = { ...record(data, 'a saved character') };
  if (typeof d.format !== 'number') throw new TypeError('a saved character needs a numeric format');
  if (d.format > CHARACTER_FORMAT) throw new TypeError(`saved with a newer format (${d.format}) than this version reads (${CHARACTER_FORMAT})`);
  if (typeof d.name !== 'string') throw new TypeError('a saved character needs a name');
  if (d.format < 2) migrateFrom1(d);
  if (d.background !== undefined && !BACKGROUNDS.includes(d.background as BackgroundName)) throw new RangeError(`unknown background ${String(d.background)}`);
  if (d.proficiencyBonus !== undefined && typeof d.proficiencyBonus !== 'number') throw new TypeError('proficiencyBonus must be a number');
  return createCharacter({
    name: d.name,
    ...(d.background !== undefined && { background: d.background as BackgroundName }),
    ...(d.attributes !== undefined && { attributes: attributeScores(numbers(d.attributes, 'attributes', ATTRIBUTES)) }),
    ...(d.training !== undefined && { training: training(d.training) }),
    ...(d.proficiencyBonus !== undefined && { proficiencyBonus: d.proficiencyBonus }),
    ...(d.temperament !== undefined && { temperament: temperament(numbers(d.temperament, 'temperament', TRAITS)) }),
  });
}

/** Renames format-1 background ids in place. */
function migrateFrom1(d: Record<string, unknown>): void {
  if (typeof d.background === 'string') d.background = RENAMED_BACKGROUNDS[d.background] ?? d.background;
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${what} must be an object`);
  return value as Record<string, unknown>;
}

/** The known keys of an object of numbers; unknown keys are ignored. */
function numbers<K extends string>(value: unknown, what: string, keys: readonly K[]): Partial<Record<K, number>> {
  const r = record(value, what);
  const out: Partial<Record<K, number>> = {};
  for (const k of keys) {
    if (r[k] === undefined) continue;
    if (typeof r[k] !== 'number') throw new TypeError(`${what}.${k} must be a number`);
    out[k] = r[k];
  }
  return out;
}

function training(value: unknown): Training {
  const out: Partial<Record<Skill, Proficiency>> = {};
  for (const [skill, level] of Object.entries(record(value, 'training'))) {
    if (!SKILLS.includes(skill as Skill)) continue;
    if (!PROFICIENCIES.includes(level as Proficiency)) throw new RangeError(`unknown proficiency ${String(level)} for ${skill}`);
    if (level !== 'untrained') out[skill as Skill] = level as Proficiency;
  }
  return out;
}
