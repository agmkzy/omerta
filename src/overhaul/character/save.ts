// Saving and loading a cast as plain JSON. A cast's record is already plain data, so saving is JSON.stringify(cast.data).
// Loading checks every known field and defaults anything missing, so data saved before a field existed still loads.
// Anything this version does not recognise (a field, a background, an attribute, a skill or a trait) is left out rather than
// rejected, and reported, so the caller can keep the original before saving over it. Each change to the saved shape raises
// CAST_FORMAT and adds a migration from the format before; migrations are never deleted.
import { ATTRIBUTES, attributeScores } from './attributes';
import { OUTCOMES, type Outcome } from './check';
import { BACKGROUNDS, type BackgroundName } from './backgrounds';
import { CAST_FORMAT, castOf, type Cast } from './cast';
import { createCharacter, type CharacterRecord } from './character';
import { STORED_EFFECTS, type ConditionRecord, type StoredEffect } from './condition';
import { CONDUCT, type Cause, type Conduct, type ConductStep } from './conduct';
import { FACT_ENDINGS, FACT_KINDS, type Fact, type FactEnding, type FactKind, type LieClaim } from './facts';
import { ITEMS, type HeldItem, type InventoryRecord, type Item } from './items';
import type { Job, Plan } from './jobs';
import type { How, Knowledge, PartHow, PartSource, Source, Version } from './knowledge';
import { FEELINGS, NEW_RELATIONSHIP, type Reason, type Relationship, type Relationships } from './relationships';
import type { Transfer } from './transfers';
import { PROFICIENCIES, SKILLS, type Proficiency, type Skill, type Training } from './skills';
import { TRAITS, type Trait } from './temperament';

/** Changes saved data in place from one format to the next. */
export type Migration = (data: Record<string, unknown>) => void;

/** MIGRATIONS[0] takes format 1 to 2, MIGRATIONS[1] format 2 to 3, and so on: one for each format after the first. */
export const MIGRATIONS: readonly Migration[] = [
  // 1 to 2: characters gained a condition. Format 1 had none, so each character starts with an empty one: full health, no effects.
  (d) => {
    for (const c of Array.isArray(d.characters) ? d.characters : [])
      if (typeof c === 'object' && c !== null && !('condition' in c)) (c as Record<string, unknown>).condition = {};
  },
  // 2 to 3: characters gained an inventory, and the cast a list of cash transfers. Format 2 had neither: no one held anything.
  (d) => {
    d.transfers ??= [];
    for (const c of Array.isArray(d.characters) ? d.characters : [])
      if (typeof c === 'object' && c !== null && !('inventory' in c)) (c as Record<string, unknown>).inventory = {};
  },
  // 3 to 4: the cast gained facts and an id counter, and characters their knowledge of the facts. Format 3 had no facts.
  (d) => {
    d.facts ??= [];
    d.nextId ??= 1;
    for (const c of Array.isArray(d.characters) ? d.characters : [])
      if (typeof c === 'object' && c !== null && !('knowledge' in c)) (c as Record<string, unknown>).knowledge = {};
  },
  // 4 to 5: characters gained relationships. Format 4 had none: everyone was a stranger.
  (d) => {
    for (const c of Array.isArray(d.characters) ? d.characters : [])
      if (typeof c === 'object' && c !== null && !('relationships' in c)) (c as Record<string, unknown>).relationships = {};
  },
  // 5 to 6: characters gained conduct, which moves their traits. Format 5 had none: everyone's traits were as they started.
  (d) => {
    for (const c of Array.isArray(d.characters) ? d.characters : [])
      if (typeof c === 'object' && c !== null && !('conduct' in c)) (c as Record<string, unknown>).conduct = [];
  },
  // 6 to 7: the cast gained jobs. Format 6 had none.
  (d) => {
    d.jobs ??= [];
  },
  // 7 to 8: items came to change hands only by recorded transfers, as cash does. Whatever a format-7 character held, the world
  // gave them at the start. (Versions gained each part's provenance, and social facts their ending; both may be absent.)
  (d) => {
    const given: unknown[] = [];
    for (const c of Array.isArray(d.characters) ? (d.characters as unknown[]) : []) {
      const items = (c as { id?: unknown; inventory?: { items?: unknown } } | null)?.inventory?.items;
      if (!Array.isArray(items)) continue;
      const counts = new Map<unknown, number>();
      for (const h of items) counts.set((h as { item?: unknown } | null)?.item, (counts.get((h as { item?: unknown } | null)?.item) ?? 0) + 1);
      for (const [item, amount] of counts) given.push({ from: 'world', to: (c as { id: unknown }).id, amount, item, why: 'starting items', at: 0 });
    }
    d.transfers = [...given, ...(Array.isArray(d.transfers) ? d.transfers : [])];
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
  inventory: true, knowledge: true, relationships: true, conduct: true,
} satisfies Record<keyof CharacterRecord, true>);
const STEP_FIELDS: readonly string[] = Object.keys({ conduct: true, trait: true, direction: true, at: true, cause: true } satisfies Record<keyof ConductStep, true>);

const CONDITION_FIELDS: readonly string[] = Object.keys({ hitPoints: true, effects: true, rest: true } satisfies Record<keyof ConditionRecord, true>);

const INVENTORY_FIELDS: readonly string[] = Object.keys({ cash: true, items: true } satisfies Record<keyof InventoryRecord, true>);
const TRANSFER_FIELDS: readonly string[] = Object.keys({ from: true, to: true, amount: true, item: true, why: true, at: true, cause: true } satisfies Record<keyof Transfer, true>);
const FACT_FIELDS: readonly string[] = Object.keys({
  id: true, kind: true, actor: true, victim: true, business: true, amount: true, at: true, where: true, cause: true, story: true,
  hiddenActor: true, invented: true, witnesses: true, ending: true, claim: true,
} satisfies Record<keyof Fact, true>);
const VERSION_FIELDS: readonly string[] = Object.keys({
  learnedAt: true, source: true, teller: true, how: true, knowsActor: true, blame: true, exaggerated: true, knownFalse: true,
  who: true, size: true, blamed: true,
} satisfies Record<keyof Version, true>);
const RELATIONSHIP_FIELDS: readonly string[] = Object.keys({
  trust: true, respect: true, affection: true, grudge: true, fear: true, familiarity: true, lastMet: true, grudgeReason: true, regardReason: true,
} satisfies Record<keyof Relationship, true>);
const SOURCES: readonly Source[] = ['self', 'witness', 'public', 'told'];
const HOWS: readonly How[] = ['seen', 'told', 'heard'];
const PART_HOWS: readonly PartHow[] = [...HOWS, 'guessed'];
const ending = (value: unknown, path: string): FactEnding => {
  if (!FACT_ENDINGS.includes(value as FactEnding)) throw new TypeError(`${path} must be an ending`);
  return value as FactEnding;
};
const JOB_FIELDS: readonly string[] = Object.keys({ id: true, kind: true, members: true, dc: true, startedAt: true, endedAt: true, plan: true } satisfies Record<keyof Job, true>);
const PLAN_FIELDS: readonly string[] = Object.keys({ planner: true, helper: true, outcome: true, margin: true, at: true, advantageOn: true, advantageUsed: true } satisfies Record<keyof Plan, true>);
const CAST_FIELDS: readonly string[] = ['format', 'characters', 'transfers', 'facts', 'jobs', 'nextId'];

/** Throws TypeError for data of the wrong shape (NewerFormatError for a newer format) and RangeError for out-of-range values. */
export function readCast(data: unknown): ReadCast {
  const d = { ...object(data, 'a saved cast') };
  if (typeof d.format !== 'number' || !Number.isInteger(d.format) || d.format < 1) throw new TypeError('a saved cast needs a format number of 1 or more');
  if (d.format > CAST_FORMAT) throw new NewerFormatError(`saved with a newer format (${d.format}) than this version reads (${CAST_FORMAT})`);
  migrate(d, d.format);
  const ignored = Object.keys(d).filter((k) => !CAST_FIELDS.includes(k));
  if (d.characters !== undefined && !Array.isArray(d.characters)) throw new TypeError('characters must be a list');
  const characters = ((d.characters ?? []) as unknown[]).map((c, i) => readCharacter(c, `characters[${i}]`, ignored));
  if (d.transfers !== undefined && !Array.isArray(d.transfers)) throw new TypeError('transfers must be a list');
  const transfers = ((d.transfers ?? []) as unknown[]).map((t, i) => readTransfer(t, `transfers[${i}]`, ignored));
  if (d.facts !== undefined && !Array.isArray(d.facts)) throw new TypeError('facts must be a list');
  const facts = ((d.facts ?? []) as unknown[]).map((f, i) => readFact(f, `facts[${i}]`, ignored));
  if (d.jobs !== undefined && !Array.isArray(d.jobs)) throw new TypeError('jobs must be a list');
  const jobs = ((d.jobs ?? []) as unknown[]).map((j, i) => readJob(j, `jobs[${i}]`, ignored));
  if (d.nextId !== undefined && typeof d.nextId !== 'number') throw new TypeError('nextId must be a number');
  return { cast: castOf({ format: CAST_FORMAT, characters, transfers, facts, jobs, nextId: d.nextId ?? 1 }), ignored };
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
    ...(d.inventory !== undefined && { inventory: inventory(d.inventory, `${path}.inventory`, ignored) }),
    ...(d.knowledge !== undefined && { knowledge: knowledge(d.knowledge, `${path}.knowledge`, ignored) }),
    ...(d.relationships !== undefined && { relationships: relationships(d.relationships, `${path}.relationships`, ignored) }),
    ...(d.conduct !== undefined && { conduct: conduct(d.conduct, `${path}.conduct`, ignored) }),
  });
}

/**
 * A character's conduct. A step of a kind of conduct this version does not know is left out, and reported, like anything
 * else it does not recognise; their current traits then lose that step.
 */
function conduct(value: unknown, path: string, ignored: string[]): ConductStep[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be a list`);
  return value.flatMap((v: unknown, i): ConductStep[] => {
    const d = object(v, `${path}[${i}]`);
    ignored.push(...Object.keys(d).filter((k) => !STEP_FIELDS.includes(k)).map((k) => `${path}[${i}].${k}`));
    if (typeof d.conduct !== 'string' || !(d.conduct in CONDUCT)) {
      ignored.push(`${path}[${i}]`);
      return [];
    }
    if (!TRAITS.includes(d.trait as Trait)) throw new TypeError(`${path}[${i}].trait must be a trait`);
    if (d.direction !== 1 && d.direction !== -1) throw new TypeError(`${path}[${i}].direction is 1 or -1`);
    if (typeof d.at !== 'number') throw new TypeError(`${path}[${i}].at must be a number`);
    const c = object(d.cause, `${path}[${i}].cause`);
    const cause: Cause | undefined =
      typeof c.fact === 'string' ? { fact: c.fact } : typeof c.job === 'string' ? { job: c.job } : ITEMS.includes(c.item as Item) ? { item: c.item as Item } : undefined;
    if (cause === undefined) throw new TypeError(`${path}[${i}].cause must be a fact, an item or a job`);
    return [{ conduct: d.conduct as Conduct, trait: d.trait as Trait, direction: d.direction, at: d.at, cause }];
  });
}

function relationships(value: unknown, path: string, ignored: string[]): Relationships {
  return Object.fromEntries(Object.entries(object(value, path)).map(([id, r]) => [id, relationship(r, `${path}.${id}`, ignored)]));
}

/** A relationship, with any feeling not saved at its value for a new relationship. */
function relationship(value: unknown, path: string, ignored: string[]): Relationship {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !RELATIONSHIP_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  const feelings = numbers(Object.fromEntries(FEELINGS.filter((f) => f in d).map((f) => [f, d[f]])), path, FEELINGS, ignored);
  if (d.lastMet !== undefined && typeof d.lastMet !== 'number') throw new TypeError(`${path}.lastMet must be a number`);
  return {
    ...NEW_RELATIONSHIP,
    ...feelings,
    ...(d.lastMet !== undefined && { lastMet: d.lastMet }),
    ...(d.grudgeReason !== undefined && { grudgeReason: reason(d.grudgeReason, `${path}.grudgeReason`, ignored) }),
    ...(d.regardReason !== undefined && { regardReason: reason(d.regardReason, `${path}.regardReason`, ignored) }),
  };
}

function reason(value: unknown, path: string, ignored: string[]): Reason {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !['fact', 'at', 'amount'].includes(k)).map((k) => `${path}.${k}`));
  if (typeof d.fact !== 'string') throw new TypeError(`${path}.fact must be text`);
  if (typeof d.at !== 'number' || typeof d.amount !== 'number') throw new TypeError(`${path} needs a time and an amount`);
  return { fact: d.fact, at: d.at, amount: d.amount };
}

function readJob(value: unknown, path: string, ignored: string[]): Job {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !JOB_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  if (typeof d.id !== 'string' || typeof d.kind !== 'string') throw new TypeError(`${path} needs an id and a kind`);
  if (!Array.isArray(d.members) || !d.members.every((m) => typeof m === 'string')) throw new TypeError(`${path}.members must be a list of ids`);
  if (typeof d.dc !== 'number' || typeof d.startedAt !== 'number') throw new TypeError(`${path} needs a DC and a start`);
  if (d.endedAt !== undefined && typeof d.endedAt !== 'number') throw new TypeError(`${path}.endedAt must be a number`);
  return {
    id: d.id,
    kind: d.kind,
    members: d.members as string[],
    dc: d.dc,
    startedAt: d.startedAt,
    ...(d.endedAt !== undefined && { endedAt: d.endedAt }),
    ...(d.plan !== undefined && { plan: readPlan(d.plan, `${path}.plan`, ignored) }),
  };
}

function readPlan(value: unknown, path: string, ignored: string[]): Plan {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !PLAN_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  if (typeof d.planner !== 'string') throw new TypeError(`${path}.planner must be an id`);
  if (d.helper !== undefined && typeof d.helper !== 'string') throw new TypeError(`${path}.helper must be an id`);
  if (!OUTCOMES.includes(d.outcome as Outcome)) throw new TypeError(`${path}.outcome must be an outcome`);
  if (typeof d.margin !== 'number' || typeof d.at !== 'number') throw new TypeError(`${path} needs a margin and a time`);
  if (d.advantageUsed !== undefined && d.advantageUsed !== true) throw new TypeError(`${path}.advantageUsed is true or absent`);
  let advantageOn: Plan['advantageOn'];
  if (d.advantageOn !== undefined) {
    const a = object(d.advantageOn, `${path}.advantageOn`);
    if (typeof a.member !== 'string' || !SKILLS.includes(a.skill as Skill)) throw new TypeError(`${path}.advantageOn needs a member and a skill`);
    advantageOn = { member: a.member, skill: a.skill as Skill };
  }
  return {
    planner: d.planner,
    ...(d.helper !== undefined && { helper: d.helper }),
    outcome: d.outcome as Outcome,
    margin: d.margin,
    at: d.at,
    ...(advantageOn && { advantageOn }),
    ...(d.advantageUsed === true && { advantageUsed: true }),
  };
}

function readFact(value: unknown, path: string, ignored: string[]): Fact {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !FACT_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  if (typeof d.id !== 'string') throw new TypeError(`${path}.id must be text`);
  if (typeof d.kind !== 'string' || !FACT_KINDS.includes(d.kind as FactKind)) throw new TypeError(`${path}.kind must be a kind of fact`);
  if (typeof d.at !== 'number') throw new TypeError(`${path}.at must be a number`);
  if (!Array.isArray(d.witnesses) || !d.witnesses.every((w) => typeof w === 'string')) throw new TypeError(`${path}.witnesses must be a list of ids`);
  const text = (k: 'actor' | 'victim' | 'business' | 'where' | 'cause' | 'story' | 'invented') => {
    if (d[k] !== undefined && typeof d[k] !== 'string') throw new TypeError(`${path}.${k} must be text`);
    return d[k] === undefined ? {} : { [k]: d[k] as string };
  };
  if (d.amount !== undefined && typeof d.amount !== 'number') throw new TypeError(`${path}.amount must be a number`);
  if (d.hiddenActor !== undefined && d.hiddenActor !== true) throw new TypeError(`${path}.hiddenActor is true or absent`);
  return {
    id: d.id,
    kind: d.kind as FactKind,
    ...text('actor'),
    ...text('victim'),
    ...text('business'),
    ...(d.amount !== undefined && { amount: d.amount }),
    at: d.at,
    ...text('where'),
    ...text('cause'),
    ...text('story'),
    ...(d.hiddenActor === true && { hiddenActor: true }),
    ...text('invented'),
    witnesses: d.witnesses as string[],
    ...(d.ending !== undefined && { ending: ending(d.ending, `${path}.ending`) }),
    ...(d.claim !== undefined && { claim: claim(d.claim, `${path}.claim`) }),
  };
}

function knowledge(value: unknown, path: string, ignored: string[]): Knowledge {
  return Object.fromEntries(Object.entries(object(value, path)).map(([id, v]) => [id, version(v, `${path}.${id}`, ignored)]));
}

function version(value: unknown, path: string, ignored: string[]): Version {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !VERSION_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  if (typeof d.learnedAt !== 'number') throw new TypeError(`${path}.learnedAt must be a number`);
  if (!SOURCES.includes(d.source as Source)) throw new TypeError(`${path}.source must be one of ${SOURCES.join(', ')}`);
  if (!HOWS.includes(d.how as How)) throw new TypeError(`${path}.how must be one of ${HOWS.join(', ')}`);
  if (typeof d.knowsActor !== 'boolean') throw new TypeError(`${path}.knowsActor must be true or false`);
  for (const k of ['teller', 'blame'] as const) if (d[k] !== undefined && typeof d[k] !== 'string') throw new TypeError(`${path}.${k} must be text`);
  for (const k of ['exaggerated', 'knownFalse'] as const) if (d[k] !== undefined && d[k] !== true) throw new TypeError(`${path}.${k} is true or absent`);
  return {
    learnedAt: d.learnedAt,
    source: d.source as Source,
    ...(d.teller !== undefined && { teller: d.teller as string }),
    how: d.how as How,
    knowsActor: d.knowsActor,
    ...(d.blame !== undefined && { blame: d.blame as string }),
    ...(d.exaggerated === true && { exaggerated: true }),
    ...(d.knownFalse === true && { knownFalse: true }),
    ...(d.who !== undefined && { who: partSource(d.who, `${path}.who`) }),
    ...(d.size !== undefined && { size: partSource(d.size, `${path}.size`) }),
    ...(d.blamed !== undefined && { blamed: ids(d.blamed, `${path}.blamed`) }),
  };
}

function partSource(value: unknown, path: string): PartSource {
  const d = object(value, path);
  if (!PART_HOWS.includes(d.how as PartHow)) throw new TypeError(`${path}.how must be one of ${PART_HOWS.join(', ')}`);
  if (d.teller !== undefined && typeof d.teller !== 'string') throw new TypeError(`${path}.teller must be text`);
  return { how: d.how as PartHow, ...(d.teller !== undefined && { teller: d.teller }) };
}

function ids(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw new TypeError(`${path} must be a list of ids`);
  return value as string[];
}

function claim(value: unknown, path: string): LieClaim {
  const d = object(value, path);
  if (typeof d.blame === 'string') return { blame: d.blame };
  if (typeof d.exaggerated === 'boolean') return { exaggerated: d.exaggerated };
  if (d.invented === true) return { invented: true };
  throw new TypeError(`${path} must claim who did it, how big it was, or a fact invented`);
}

function inventory(value: unknown, path: string, ignored: string[]): { cash?: number; items: HeldItem[] } {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !INVENTORY_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  if (d.cash !== undefined && typeof d.cash !== 'number') throw new TypeError(`${path}.cash must be a number`);
  if (d.items !== undefined && !Array.isArray(d.items)) throw new TypeError(`${path}.items must be a list`);
  const items: HeldItem[] = [];
  ((d.items ?? []) as unknown[]).forEach((value, i) => {
    const h = object(value, `${path}.items[${i}]`);
    ignored.push(...Object.keys(h).filter((k) => k !== 'item' && k !== 'state').map((k) => `${path}.items[${i}].${k}`));
    if (ITEMS.includes(h.item as Item)) items.push({ item: h.item as Item, state: (h.state ?? 'carried') as HeldItem['state'] });
    else ignored.push(`${path}.items[${i}]`);
  });
  return { ...(d.cash !== undefined && { cash: d.cash }), items };
}

function readTransfer(value: unknown, path: string, ignored: string[]): Transfer {
  const d = object(value, path);
  ignored.push(...Object.keys(d).filter((k) => !TRANSFER_FIELDS.includes(k)).map((k) => `${path}.${k}`));
  for (const k of ['from', 'to', 'why'] as const) if (typeof d[k] !== 'string') throw new TypeError(`${path}.${k} must be text`);
  for (const k of ['amount', 'at'] as const) if (typeof d[k] !== 'number') throw new TypeError(`${path}.${k} must be a number`);
  if (d.item !== undefined && !ITEMS.includes(d.item as Item)) throw new TypeError(`${path}.item must be an item`);
  if (d.cause !== undefined && typeof d.cause !== 'string') throw new TypeError(`${path}.cause must be a fact id`);
  return {
    from: d.from as string,
    to: d.to as string,
    amount: d.amount as number,
    ...(d.item !== undefined && { item: d.item as Item }),
    why: d.why as string,
    at: d.at as number,
    ...(d.cause !== undefined && { cause: d.cause as string }),
  };
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
