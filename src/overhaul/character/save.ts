// Saving and loading a cast as plain JSON. A cast's record is already plain data, so saving is JSON.stringify(cast.data).
// Loading checks every known field and defaults anything missing, so data saved before a field existed still loads.
// Anything this version does not recognise (a field, a background, an attribute, a skill or a trait) is left out rather than
// rejected, and reported, so the caller can keep the original before saving over it. Each change to the saved shape raises
// CAST_FORMAT and adds a migration from the format before; migrations are never deleted.
import { ATTRIBUTES, attributeScores } from './attributes';
import { BACKGROUNDS, type BackgroundName } from './backgrounds';
import { CAST_FORMAT, castOf, type Cast } from './cast';
import { createCharacter, type CharacterRecord } from './character';
import { STORED_EFFECTS, type ConditionRecord, type StoredEffect } from './condition';
import { PROFICIENCIES, SKILLS, type Proficiency, type Skill, type Training } from './skills';
import { TRAITS } from './temperament';

/** Changes saved data in place from one format to the next. */
export type Migration = (data: Record<string, unknown>) => void;

/** MIGRATIONS[0] takes format 1 to 2, MIGRATIONS[1] format 2 to 3, and so on: one for each format after the first. */
export const MIGRATIONS: readonly Migration[] = [
  // 1 to 2: characters gained a condition. Format 1 had none, so each character starts with an empty one: full health, no effects.
  (d) => {
    for (const c of Array.isArray(d.characters) ? d.characters : [])
      if (typeof c === 'object' && c !== null && !('condition' in c)) (c as Record<string, unknown>).condition = {};
  },
];

/** Brings data saved in format `from` up to the newest of `migrations`, in order. */
export function migrate(data: Record<string, unknown>, from: number, migrations: readonly Migration[] = MIGRATIONS): void {
  for (const m of migrations.slice(from - 1)) m(data);
}

/** Thrown for a cast saved by a newer version, which this version does not read. */
export class NewerFormatError extends TypeError {}

/** A loaded cast, and what in the saved data was not recognised and so is not in it. */
export interface ReadCast {
  readonly cast: Cast;
  /** Paths such as "characters[0].training.juggling"; they are lost if the cast is saved again. */
  readonly ignored: readonly string[];
}

/** Every field of a saved character; the type check fails if one is missing or misspelt. */
const CHARACTER_FIELDS: readonly string[] = Object.keys({
  id: true, name: true, background: true, attributes: true, training: true, proficiencyBonus: true, startingTemperament: true, condition: true,
} satisfies Record<keyof CharacterRecord, true>);

const CONDITION_FIELDS: readonly string[] = Object.keys({ hitPoints: true, effects: true, rest: true } satisfies Record<keyof ConditionRecord, true>);

const CAST_FIELDS: readonly string[] = ['format', 'characters'];

/** Throws TypeError for data of the wrong shape (NewerFormatError for a newer format) and RangeError for out-of-range values. */
export function readCast(data: unknown): ReadCast {
  const d = { ...object(data, 'a saved cast') };
  if (typeof d.format !== 'number' || !Number.isInteger(d.format) || d.format < 1) throw new TypeError('a saved cast needs a format number of 1 or more');
  if (d.format > CAST_FORMAT) throw new NewerFormatError(`saved with a newer format (${d.format}) than this version reads (${CAST_FORMAT})`);
  migrate(d, d.format);
  const ignored = Object.keys(d).filter((k) => !CAST_FIELDS.includes(k));
  if (d.characters !== undefined && !Array.isArray(d.characters)) throw new TypeError('characters must be a list');
  const characters = ((d.characters ?? []) as unknown[]).map((c, i) => readCharacter(c, `characters[${i}]`, ignored));
  return { cast: castOf({ format: CAST_FORMAT, characters }), ignored };
}

/** As readCast, for callers that do not need to know what was ignored. */
export function loadCast(data: unknown): Cast {
  return readCast(data).cast;
}

function readCharacter(data: unknown, path: string, ignored: string[]): CharacterRecord {
  const d = object(data, path);
  if (typeof d.id !== 'string') throw new TypeError(`${path} needs an id`);
  if (typeof d.name !== 'string') throw new TypeError(`${path} needs a name`);
  if (d.proficiencyBonus !== undefined && typeof d.proficiencyBonus !== 'number') throw new TypeError(`${path}.proficiencyBonus must be a number`);
  ignored.push(...Object.keys(d).filter((k) => !CHARACTER_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  const background = BACKGROUNDS.includes(d.background as BackgroundName) ? (d.background as BackgroundName) : undefined;
  if (d.background !== undefined && background === undefined) ignored.push(`${path}.background`);
  return createCharacter({
    id: d.id,
    name: d.name,
    ...(background !== undefined && { background }),
    ...(d.attributes !== undefined && { attributes: attributeScores(numbers(d.attributes, `${path}.attributes`, ATTRIBUTES, ignored)) }),
    ...(d.training !== undefined && { training: training(d.training, `${path}.training`, ignored) }),
    ...(d.proficiencyBonus !== undefined && { proficiencyBonus: d.proficiencyBonus }),
    ...(d.startingTemperament !== undefined && { startingTemperament: numbers(d.startingTemperament, `${path}.startingTemperament`, TRAITS, ignored) }),
    ...(d.condition !== undefined && { condition: condition(d.condition, `${path}.condition`, ignored) }),
  });
}

function condition(value: unknown, path: string, ignored: string[]): Partial<ConditionRecord> {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !CONDITION_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  if (d.hitPoints !== undefined && typeof d.hitPoints !== 'number') throw new TypeError(`${path}.hitPoints must be a number`);
  if (d.effects !== undefined && !Array.isArray(d.effects)) throw new TypeError(`${path}.effects must be a list`);
  const effects: StoredEffect[] = [];
  for (const e of (d.effects ?? []) as unknown[]) {
    if (STORED_EFFECTS.includes(e as StoredEffect)) effects.push(e as StoredEffect);
    else ignored.push(`${path}.effects.${String(e)}`);
  }
  return {
    ...(d.hitPoints !== undefined && { hitPoints: d.hitPoints }),
    effects,
    ...(d.rest !== undefined && { rest: rest(d.rest, `${path}.rest`, ignored) }),
  };
}

function rest(value: unknown, path: string, ignored: string[]): { from: number; until: number } {
  const { from, until } = numbers(value, path, ['from', 'until'] as const, ignored);
  if (from === undefined || until === undefined) throw new TypeError(`${path} needs a start and an end`);
  return { from, until };
}

function object(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${what} must be an object`);
  return value as Record<string, unknown>;
}

/** The known keys of an object of numbers; unknown keys are added to `ignored`. */
function numbers<K extends string>(value: unknown, path: string, keys: readonly K[], ignored: string[]): Partial<Record<K, number>> {
  const r = object(value, path);
  const out: Partial<Record<K, number>> = {};
  for (const k of Object.keys(r)) if (!keys.includes(k as K)) ignored.push(`${path}.${k}`);
  for (const k of keys) {
    if (r[k] === undefined) continue;
    if (typeof r[k] !== 'number') throw new TypeError(`${path}.${k} must be a number`);
    out[k] = r[k];
  }
  return out;
}

function training(value: unknown, path: string, ignored: string[]): Training {
  const out: Partial<Record<Skill, Proficiency>> = {};
  for (const [skill, level] of Object.entries(object(value, path))) {
    if (!SKILLS.includes(skill as Skill)) {
      ignored.push(`${path}.${skill}`);
      continue;
    }
    if (!PROFICIENCIES.includes(level as Proficiency)) throw new RangeError(`unknown proficiency ${String(level)} for ${skill}`);
    if (level !== 'untrained') out[skill as Skill] = level as Proficiency;
  }
  return out;
}
