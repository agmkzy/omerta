import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { cast } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import type { Fact } from '../../../src/overhaul/character/facts';
import { DEED, GRUDGE, HEARD, LEARNED_AS, VIOLENT, learningChanges, meetings, type Learner } from '../../../src/overhaul/character/learning';
import {
  FEELINGS,
  FEELING_RULES,
  MEETING,
  NEW_RELATIONSHIP,
  assertRelationship,
  feel,
  feelingModifiers,
  meet,
  type Relationship,
} from '../../../src/overhaul/character/relationships';
import { DAY } from '../../../src/overhaul/character/time';
import { scripted } from './support';

const close = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const at = (over: Partial<Relationship> = {}): Relationship => ({ ...NEW_RELATIONSHIP, ...over });
const now = { now: 0 };

describe('a new relationship', { tags: ['unit'] }, () => {
  test('starts with trust, respect and affection in the middle, and no grudge, fear or familiarity', () => {
    assert.deepEqual(NEW_RELATIONSHIP, { trust: 0.5, respect: 0.5, affection: 0.5, grudge: 0, fear: 0, familiarity: 0 });
  });
});

describe('feel', { tags: ['unit'] }, () => {
  test('shrinks a gain as the feeling nears 1, but never below 15% of it', () => {
    close(feel(at({ respect: 0 }), 'respect', 0.2, now).respect, 0.2);
    close(feel(at({ respect: 0.5 }), 'respect', 0.2, now).respect, 0.6);
    close(feel(at({ respect: 0.9 }), 'respect', 0.2, now).respect, 0.93);
  });

  test('shrinks gains in trust and affection between people who barely know each other', () => {
    close(feel(at({ trust: 0, familiarity: 0 }), 'trust', 0.1, now).trust, 0.04);
    close(feel(at({ trust: 0, familiarity: 1 }), 'trust', 0.1, now).trust, 0.1);
    close(feel(at({ affection: 0, familiarity: 0.5 }), 'affection', 0.1, now).affection, 0.07);
    close(feel(at({ grudge: 0, familiarity: 0 }), 'grudge', 0.1, now).grudge, 0.1);
  });

  test('does not damp a loss, and keeps every feeling from 0 to 1', () => {
    close(feel(at({ trust: 0.9 }), 'trust', -0.3, now).trust, 0.6);
    assert.equal(feel(at({ fear: 0.1 }), 'fear', -0.5, now).fear, 0);
    assert.ok(feel(at({ respect: 0.99 }), 'respect', 5, now).respect <= 1);
  });

  test('keeps the fact that did most lately to raise a grudge, or the regard, as its reason', () => {
    const beaten = feel(at(), 'grudge', 0.4, { now: 0, why: 'f1' });
    assert.deepEqual(beaten.grudgeReason, { fact: 'f1', at: 0, amount: 0.4 });
    // a slight soon after does not replace it; a month later it does
    assert.equal(feel(beaten, 'grudge', 0.05, { now: DAY, why: 'f2' }).grudgeReason!.fact, 'f1');
    assert.equal(feel(beaten, 'grudge', 0.05, { now: 31 * DAY, why: 'f2' }).grudgeReason!.fact, 'f2');
    assert.equal(feel(beaten, 'grudge', 0.4, { now: DAY, why: 'f3' }).grudgeReason!.fact, 'f3');
    assert.equal(feel(at({ familiarity: 1 }), 'trust', 0.1, { now: 0, why: 'f4' }).regardReason!.fact, 'f4');
    assert.equal(feel(at(), 'respect', 0.1, { now: 0, why: 'f5' }).regardReason, undefined);
    assert.equal(feel(at(), 'grudge', 0.1, now).grudgeReason, undefined);
  });

  test('drops a grudge’s reason when the grudge is nearly gone', () => {
    const grudge = feel(at(), 'grudge', 0.3, { now: 0, why: 'f1' });
    assert.ok(feel(grudge, 'grudge', -0.1, now).grudgeReason);
    assert.equal('grudgeReason' in feel(grudge, 'grudge', -0.28, now), false);
  });
});

describe('feel', { tags: ['property'] }, () => {
  test('keeps every feeling from 0 to 1, and a gain never lowers it nor a loss raises it', () => {
    const value = fc.double({ min: 0, max: 1, noNaN: true });
    fc.assert(
      fc.property(fc.constantFrom(...FEELINGS), value, value, fc.double({ min: -2, max: 2, noNaN: true }), (feeling, v, familiarity, amount) => {
        const before = at({ [feeling]: v, ...(feeling !== 'familiarity' && { familiarity }) });
        const after = feel(before, feeling, amount, now)[feeling];
        assert.ok(after >= 0 && after <= 1);
        if (amount >= 0) assert.ok(after >= before[feeling]);
        else assert.ok(after <= before[feeling]);
      }),
    );
  });
});

describe('meet', { tags: ['unit'] }, () => {
  test('raises familiarity a little, damped, and records when they met', () => {
    assert.equal(MEETING, 0.02);
    const once = meet(NEW_RELATIONSHIP, 60);
    close(once.familiarity, 0.02);
    assert.equal(once.lastMet, 60);
    close(meet(once, 90).familiarity, 0.02 + 0.02 * 0.98);
  });
});

describe('feelingModifiers', { tags: ['unit'] }, () => {
  const sam = (towards?: Relationship) => ({ name: 'Sam', ...(towards && { towards }) });
  const rico = (towards?: Relationship) => ({ name: 'Rico', ...(towards && { towards }) });
  const list = (...args: Parameters<typeof feelingModifiers>) => feelingModifiers(...args).map((m) => `${m.reason} ${m.value}`);

  test('give the plan’s modifiers for how the target feels about the actor', () => {
    assert.deepEqual(list('persuade', sam(), rico(at({ trust: 0.8, affection: 0.7, grudge: 0.9 }))), ['Rico trusts Sam 2', 'Rico is fond of Sam 1', 'Rico bears a grudge against Sam -2']);
    assert.deepEqual(list('persuade', sam(), rico(at({ trust: 0.2 }))), ['Rico distrusts Sam -2']);
    assert.deepEqual(list('deceive', sam(), rico(at({ trust: 0.7, familiarity: 0.8, grudge: 0.7 }))), ['Rico trusts Sam 2', 'Rico knows Sam well -1', 'Rico bears a grudge against Sam -1']);
    assert.deepEqual(list('intimidate', sam(), rico(at({ fear: 0.7, respect: 0.7, grudge: 0.7 }))), ['Rico fears Sam 2', 'Rico respects Sam 1', 'Rico bears a grudge against Sam -1']);
  });

  test('give the plan’s modifiers for how the actor feels about the target, after the target’s', () => {
    assert.deepEqual(list('persuade', sam(at({ familiarity: 0.9 })), rico()), ['Sam knows Rico well 1']);
    assert.deepEqual(list('deceive', sam(at({ affection: 0.9 })), rico()), ['Sam is fond of Rico -1']);
    assert.deepEqual(list('intimidate', sam(at({ affection: 0.9, grudge: 0.9, fear: 0.9 })), rico(at({ fear: 0.9 }))), [
      'Rico fears Sam 2', 'Sam is fond of Rico -1', 'Sam bears a grudge against Rico 1', 'Sam fears Rico -2',
    ]);
  });

  test('give nothing between strangers, or for feelings in the middle', () => {
    for (const action of ['persuade', 'deceive', 'intimidate'] as const) {
      assert.deepEqual(feelingModifiers(action, sam(), rico()), []);
      assert.deepEqual(feelingModifiers(action, sam(at()), rico(at())), []);
    }
  });

  test('cover every feeling rule, the target’s first', () => {
    assert.equal(FEELING_RULES.length, 15);
    const whose = FEELING_RULES.map((r) => r.whose);
    assert.equal(whose.lastIndexOf('target') < whose.indexOf('actor'), true);
  });
});

describe('assertRelationship', { tags: ['unit'] }, () => {
  test('refuses a feeling outside 0 to 1 or a time that is not whole minutes', () => {
    assert.doesNotThrow(() => assertRelationship(at({ lastMet: 60 }), 'x'));
    assert.throws(() => assertRelationship(at({ trust: 1.5 }), 'x'), RangeError);
    assert.throws(() => assertRelationship(at({ lastMet: -1 }), 'x'), RangeError);
    assert.throws(() => assertRelationship(at({ grudgeReason: { fact: 'f1', at: 0.5, amount: 0.1 } }), 'x'), RangeError);
  });

  test('is checked on every character record, which cannot have a relationship with itself', () => {
    assert.throws(() => createCharacter({ id: 'sam', name: 'Sam', relationships: { rico: at({ fear: 2 }) } }), RangeError);
    assert.throws(() => createCharacter({ id: 'sam', name: 'Sam', relationships: { sam: at() } }), RangeError);
    assert.throws(() => cast({ characters: [{ id: 'sam', name: 'Sam', relationships: { rico: at() } }] }), RangeError);
  });
});

describe('the learning tables', { tags: ['unit'] }, () => {
  // (read as text, not imported: the overhaul imports nothing from the game)
  const core = readFileSync(new URL('../../../src/core.ts', import.meta.url), 'utf8');
  const block = (name: string) => new RegExp(`const ${name}[^=]*= \\{([^}]*)\\}`).exec(core)?.[1] ?? '';

  test('are the game’s, read from its source so the two cannot drift apart', () => {
    const deed = Object.fromEntries([...block('DEED').matchAll(/(\w+): \[(-?[\d.]+), (-?[\d.]+)\]/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));
    const pairs = (name: string) => Object.fromEntries([...block(name).matchAll(/(\w+): ([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
    assert.deepEqual(DEED, deed);
    assert.deepEqual(VIOLENT, pairs('VIOLENT'));
    assert.deepEqual(GRUDGE, pairs('GRUDGE'));
    assert.equal(HEARD, Number(/const HEARD = ([\d.]+);/.exec(core)?.[1]));
  });

  test('learn a fight someone fled from as a beating', () => {
    assert.deepEqual(LEARNED_AS, { fight: 'beating' });
  });
});

describe('learningChanges', { tags: ['unit'] }, () => {
  const beating: Fact = { id: 'f1', kind: 'beating', actor: 'sam', victim: 'rico', at: 0, witnesses: ['joe'] };
  const learner = (id: string, courage = 0.5, fond: Record<string, number> = {}): Learner => ({ id, courage, maxHitPoints: 10, affectionFor: (other) => fond[other] });
  const list = (f: Fact, l: Learner, actor: string | undefined = f.actor) => learningChanges(f, l, actor).map((c) => [c.towards, c.feeling, Math.round(c.amount * 10000) / 10000, c.why]);

  test('one who hears of a beating respects the one who did it more, the one beaten less, and fears the one who did it, more if timid', () => {
    assert.deepEqual(list(beating, learner('joe')), [['sam', 'respect', 0.008, 'f1'], ['rico', 'respect', -0.015, 'f1'], ['sam', 'fear', 0.02, 'f1']]);
    assert.deepEqual(list(beating, learner('joe', 0)).at(-1), ['sam', 'fear', 0.04, 'f1']);
  });

  test('the one beaten holds a grudge if brave and fears it if timid, and trusts the one who did it less either way', () => {
    assert.deepEqual(list(beating, learner('rico', 1)), [['sam', 'grudge', 0.5, 'f1'], ['sam', 'fear', 0, 'f1'], ['sam', 'trust', -0.25, 'f1']]);
    assert.deepEqual(list(beating, learner('rico', 0)), [['sam', 'grudge', 0.2, 'f1'], ['sam', 'fear', 0.4, 'f1'], ['sam', 'trust', -0.25, 'f1']]);
  });

  test('a grudge for what is not violent is not shaped by courage', () => {
    const missed: Fact = { id: 'f2', kind: 'debt_missed', actor: 'sam', victim: 'rico', at: 0, witnesses: [] };
    assert.deepEqual(list(missed, learner('rico', 0)), [['sam', 'grudge', 0.15, 'f2'], ['sam', 'trust', -0.075, 'f2']]);
    assert.deepEqual(list(missed, learner('joe')), [['sam', 'respect', -0.005, 'f2']]);
  });

  test('one fond of whoever it was done to (affection high) resents the one who did it a little', () => {
    assert.deepEqual(list(beating, learner('joe', 0.5, { rico: 0.7 })).at(-1), ['sam', 'grudge', 0.15, 'f1']);
    assert.equal(list(beating, learner('joe', 0.5, { rico: 0.69 })).length, 3);
  });

  test('follows whom the learner believes did it, and changes nothing if no one, or themselves', () => {
    assert.deepEqual(list(beating, learner('rico', 1), 'joe')[0], ['joe', 'grudge', 0.5, 'f1']);
    assert.deepEqual(learningChanges(beating, learner('rico'), undefined), []);
    assert.deepEqual(list(beating, learner('sam')), []);
  });

  test('a fact with no row changes nothing, and a fled fight is learned as a beating', () => {
    assert.deepEqual(list({ ...beating, kind: 'theft' }, learner('rico')), []);
    assert.deepEqual(list({ ...beating, kind: 'fight' }, learner('joe')), list(beating, learner('joe')));
    assert.deepEqual(list({ ...beating, kind: 'threat' }, learner('joe')), [['sam', 'respect', 0.002, 'f1'], ['rico', 'respect', -0.003, 'f1']]);
  });

  test('a deed that reflects only on whoever it was done to changes only the respect for them', () => {
    const refused: Fact = { id: 'f4', kind: 'protection_refused', actor: 'sam', victim: 'rico', at: 0, witnesses: [] };
    assert.deepEqual(list(refused, learner('joe')), [['rico', 'respect', -0.003, 'f4']]);
  });

  test('a deed with no one it was done to changes only the respect for whoever did it', () => {
    assert.deepEqual(list({ id: 'f3', kind: 'shortfall', actor: 'sam', at: 0, witnesses: [] }, learner('joe')), [['sam', 'respect', -0.01, 'f3']]);
  });
});

describe('meetings', { tags: ['unit'] }, () => {
  test('everyone a fact names meets everyone else it names', () => {
    assert.deepEqual([...meetings({ id: 'f1', kind: 'beating', actor: 'sam', victim: 'rico', at: 0, witnesses: ['joe'] })], [
      ['sam', ['rico', 'joe']], ['rico', ['sam', 'joe']], ['joe', ['sam', 'rico']],
    ]);
  });

  test('except whoever it was done to and a hidden actor, and no one over an invented fact', () => {
    assert.deepEqual([...meetings({ id: 'f1', kind: 'robbery', actor: 'sam', victim: 'rico', hiddenActor: true, at: 0, witnesses: ['joe'] })], [
      ['sam', ['joe']], ['rico', ['joe']], ['joe', ['sam', 'rico']],
    ]);
    assert.deepEqual([...meetings({ id: 'f1', kind: 'robbery', actor: 'sam', invented: 'joe', at: 0, witnesses: [] })], []);
  });
});

describe('relationships in a cast', { tags: ['unit'] }, () => {
  const people = () => cast({ characters: ['sam', 'rico', 'joe', 'vic'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })) });

  test('begin when characters meet or learn of each other; strangers have none', () => {
    const c = people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 60, witnesses: ['joe'] }).cast;
    const [sam, rico, joe, vic] = ['sam', 'rico', 'joe', 'vic'].map((id) => c.character(id));
    assert.equal(vic!.towards(sam!), undefined);
    assert.deepEqual(vic!.relationships, {});
    assert.equal(sam!.towards(rico!)!.lastMet, 60);
    close(joe!.towards(sam!)!.familiarity, MEETING);
  });

  test('change by the learning tables, damped, for each who learns a fact', () => {
    const c = people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 60, witnesses: ['joe'] }).cast;
    const [sam, rico, joe] = ['sam', 'rico', 'joe'].map((id) => c.character(id));
    const ricoOnSam = rico!.towards(sam!)!;
    close(ricoOnSam.grudge, 0.35);
    close(ricoOnSam.fear, 0.2);
    close(ricoOnSam.trust, 0.25);
    assert.deepEqual(ricoOnSam.grudgeReason, { fact: 'f1', at: 60, amount: ricoOnSam.grudge });
    close(joe!.towards(sam!)!.respect, 0.504);
    close(joe!.towards(rico!)!.respect, 0.485);
    close(joe!.towards(sam!)!.fear, 0.02);
    assert.deepEqual(sam!.towards(rico!), meet(NEW_RELATIONSHIP, 60));
  });

  test('begin, and change, for someone told of a fact, towards whom they are told did it', () => {
    const recorded = people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 60 }).cast;
    const told = recorded.character('rico').social.tell(recorded.character('vic'), 'f1').roll(scripted(), { now: 120 }).cast;
    const vic = told.character('vic');
    close(vic.towards(told.character('sam'))!.fear, 0.02);
    assert.equal(vic.towards(told.character('rico'))!.lastMet, undefined);
    assert.equal(vic.towards(told.character('rico'))!.familiarity, 0);
  });

  test('a victim of a hidden hand changes nothing towards anyone, knowing no one to blame', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 0 }).cast;
    assert.deepEqual(c.character('rico').relationships, {});
  });

  test('are asked of a character from the same cast', () => {
    assert.throws(() => people().character('sam').towards(people().character('rico')), RangeError);
  });
});
