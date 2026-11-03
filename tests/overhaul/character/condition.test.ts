import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { ReplacedCastError, cast } from '../../../src/overhaul/character/cast';
import {
  BASE_HIT_POINTS,
  EFFECT_INFO,
  EFFECT_RULES,
  STORED_EFFECTS,
  conditionOf,
  conditionRecord,
  effectModifiers,
  hitPoints,
  maxHitPoints,
  type Condition,
} from '../../../src/overhaul/character/condition';
import { SKILLS, abilities, attributesFor } from '../../../src/overhaul/character/skills';
import { DAY, HOUR, assertTime } from '../../../src/overhaul/character/time';

const average = abilities();
const at = (hitPoints: number, effects: Condition['effects'] = [], a = average) => conditionOf(a, conditionRecord(a, { hitPoints, effects }));
const reasons = (c: Condition, skill: Parameters<typeof effectModifiers>[1], attribute: Parameters<typeof effectModifiers>[2], inFight = false) =>
  effectModifiers(c, skill, attribute, { inFight }).map((m) => `${m.reason} ${m.value}`);

describe('hit points', { tags: ['unit'] }, () => {
  test('are 10 plus the Constitution modifier', () => {
    assert.equal(BASE_HIT_POINTS, 10);
    assert.equal(maxHitPoints(average), 10);
    assert.equal(maxHitPoints(abilities({ attributes: attributeScores({ con: 16 }) })), 13);
    assert.equal(maxHitPoints(abilities({ attributes: attributeScores({ con: 6 }) })), 8);
  });

  test('add the proficiency bonus for Toughness training, twice for expertise', () => {
    assert.equal(maxHitPoints(abilities({ training: { toughness: 'trained' } })), 12);
    assert.equal(maxHitPoints(abilities({ training: { toughness: 'expert' }, proficiencyBonus: 3 })), 16);
  });

  test('are listed with reasons', () => {
    const a = abilities({ attributes: attributeScores({ con: 14 }), training: { toughness: 'trained' } });
    assert.deepEqual(hitPoints(a), { base: 10, modifiers: [{ value: 2, reason: 'Constitution 14' }, { value: 2, reason: 'Trained in Toughness' }] });
  });

  test('are 5 at the lowest Constitution score', () => {
    assert.equal(maxHitPoints(abilities({ attributes: attributeScores({ con: 1 }) })), 5);
  });
});

describe('conditionOf', { tags: ['unit'] }, () => {
  test('is hurt at or below half hit points, read from them', () => {
    assert.deepEqual([10, 6, 5, 1].map((hp) => at(hp).hurt), [false, false, true, true]);
    const hardy = abilities({ attributes: attributeScores({ con: 16 }) }); // 13 hit points
    assert.deepEqual([7, 6].map((hp) => at(hp, [], hardy).hurt), [false, true]);
  });

  test('is unconscious at 0 hit points', () => {
    assert.deepEqual([1, 0].map((hp) => at(hp).unconscious), [false, true]);
  });

  test('gives the maximum alongside what is stored', () => {
    assert.deepEqual(at(4, ['drunk']), { hitPoints: 4, effects: ['drunk'], maxHitPoints: 10, hurt: true, unconscious: false });
  });
});

describe('conditionRecord', { tags: ['unit'] }, () => {
  test('defaults to full health and no effects', () => {
    assert.deepEqual(conditionRecord(average), { hitPoints: 10, effects: [] });
  });

  test('keeps each effect once, in a fixed order', () => {
    assert.deepEqual(conditionRecord(average, { effects: ['drunk', 'shaken', 'drunk'] }).effects, ['shaken', 'drunk']);
  });

  test('keeps a rest', () => {
    assert.deepEqual(conditionRecord(average, { rest: { from: 0, until: 480 } }).rest, { from: 0, until: 480 });
  });

  test('throws for anything out of range', () => {
    for (const hitPoints of [-1, 11, 2.5]) assert.throws(() => conditionRecord(average, { hitPoints }), RangeError, String(hitPoints));
    assert.throws(() => conditionRecord(average, { effects: ['hurt' as never] }), RangeError);
    for (const rest of [{ from: 10, until: 10 }, { from: 10, until: 5 }, { from: -1, until: 5 }, { from: 0, until: 1.5 }, { from: 0.5, until: 5 }])
      assert.throws(() => conditionRecord(average, { rest }), RangeError, JSON.stringify(rest));
  });
});

describe('effects', { tags: ['unit'] }, () => {
  test('are each named and described', () => {
    for (const e of ['hurt', ...STORED_EFFECTS] as const) assert.ok(EFFECT_INFO[e].name && EFFECT_INFO[e].description, e);
  });

  test('hurt gives −2 to skills using Strength, Agility or Constitution, and to nothing else', () => {
    const hurt = at(5);
    assert.deepEqual(reasons(hurt, 'brawling', 'str'), ['Hurt -2']);
    assert.deepEqual(reasons(hurt, 'larceny', 'agi'), ['Hurt -2']);
    assert.deepEqual(reasons(hurt, 'toughness', 'con'), ['Hurt -2']);
    assert.deepEqual(reasons(hurt, 'bookkeeping', 'int'), []);
    assert.deepEqual(reasons(hurt, 'persuasion', 'cha'), []);
  });

  test('hurt never applies during a fight', () => {
    assert.deepEqual(reasons(at(5), 'brawling', 'str', true), []);
    assert.deepEqual(reasons(at(5, ['shaken']), 'nerve', 'wis', true), ['Shaken -2']);
  });

  test('shaken gives −2 to Nerve only', () => {
    assert.deepEqual(reasons(at(10, ['shaken']), 'nerve', 'wis'), ['Shaken -2']);
    assert.deepEqual(reasons(at(10, ['shaken']), 'intimidation', 'cha'), []);
  });

  test('drunk gives −2 to skills using Agility or Intelligence and to Insight and Notice, and +2 to Nerve', () => {
    const drunk = at(10, ['drunk']);
    assert.deepEqual(reasons(drunk, 'firearms', 'agi'), ['Drunk -2']);
    assert.deepEqual(reasons(drunk, 'mechanics', 'int'), ['Drunk -2']);
    assert.deepEqual(reasons(drunk, 'insight', 'wis'), ['Drunk -2']);
    assert.deepEqual(reasons(drunk, 'notice', 'wis'), ['Drunk -2']);
    assert.deepEqual(reasons(drunk, 'nerve', 'wis'), ['Drunk 2']);
    assert.deepEqual(reasons(drunk, 'persuasion', 'cha'), []);
  });

  test('give each skill, with any attribute it can use, at most one modifier per effect', () => {
    for (const skill of SKILLS)
      for (const attribute of attributesFor(skill))
        for (const effect of ['hurt', ...STORED_EFFECTS] as const) {
          const n = EFFECT_RULES.filter((r) => r.effect === effect && (r.attributes?.includes(attribute) || r.skills?.includes(skill))).length;
          assert.ok(n <= 1, `${effect} gives ${skill} with ${attribute} ${n} modifiers`);
        }
  });

  test('different effects add together', () => {
    assert.deepEqual(reasons(at(5, ['shaken', 'drunk']), 'nerve', 'con'), ['Hurt -2', 'Shaken -2', 'Drunk 2']);
  });

  test('follow the attribute actually used', () => {
    assert.deepEqual(reasons(at(5), 'intimidation', 'str'), ['Hurt -2']);
    assert.deepEqual(reasons(at(5), 'intimidation', 'cha'), []);
    assert.deepEqual(reasons(at(10, ['drunk']), 'planning', 'int'), ['Drunk -2']);
    assert.deepEqual(reasons(at(10, ['drunk']), 'planning', 'wis'), []);
  });
});

describe('effects', { tags: ['property'] }, () => {
  test('are the same whatever order they were given in', () => {
    fc.assert(
      fc.property(fc.subarray([...STORED_EFFECTS]), fc.constantFrom(...SKILLS), (effects, skill) => {
        const forwards = at(10, effects);
        const backwards = at(10, [...effects].reverse());
        const attribute = attributesFor(skill)[0]!;
        assert.deepEqual(effectModifiers(forwards, skill, attribute), effectModifiers(backwards, skill, attribute));
      }),
    );
  });
});

describe('time', { tags: ['unit'] }, () => {
  test('is in minutes, as in the game', () => {
    assert.equal(HOUR, 60);
    assert.equal(DAY, 1440);
  });

  test('is a whole number of minutes from 0', () => {
    assert.doesNotThrow(() => assertTime(0));
    for (const bad of [-1, 1.5, Number.NaN]) assert.throws(() => assertTime(bad), RangeError, String(bad));
  });
});

describe('condition on a character', { tags: ['unit'] }, () => {
  const everyone = () => cast({ characters: [{ id: 'sam', name: 'Sam', attributes: attributeScores({ agi: 14 }), training: { larceny: 'trained' } }, { id: 'rico', name: 'Rico' }] });

  test('starts at full health with no effects', () => {
    const sam = everyone().character('sam');
    assert.deepEqual(sam.condition, { hitPoints: 10, effects: [], maxHitPoints: 10, hurt: false, unconscious: false });
    assert.equal(sam.canAct, true);
  });

  test('damage lowers hit points, down to 0, and hurt shows in the skills it affects', () => {
    const hurt = everyone().character('sam').damage(5).character('sam');
    assert.equal(hurt.condition.hitPoints, 5);
    assert.deepEqual(hurt.skills.larceny.modifiers.map((m) => m.reason), ['Agility 14', 'Trained in Larceny', 'Hurt']);
    assert.equal(hurt.skills.larceny.bonus, 2);
    assert.equal(hurt.skills.bookkeeping.bonus, 0);
    const out = hurt.damage(20).character('sam');
    assert.equal(out.condition.hitPoints, 0);
    assert.equal(out.canAct, false);
  });

  test('damage is a whole number from 1', () => {
    for (const bad of [0, -3, 1.5]) assert.throws(() => everyone().character('sam').damage(bad), RangeError, String(bad));
  });

  test('effects are added and cleared, and an effect does not stack with itself', () => {
    const shaken = everyone().character('sam').affect('shaken').character('sam').affect('shaken').character('sam');
    assert.deepEqual(shaken.condition.effects, ['shaken']);
    assert.equal(shaken.skills.nerve.bonus, -2);
    assert.deepEqual(shaken.clear('shaken').character('sam').condition.effects, []);
    assert.throws(() => everyone().character('sam').affect('hurt' as never), RangeError);
  });

  test('resting restores full hit points, clears shaken and drunk, and records when the character rests', () => {
    const worn = everyone().character('sam').damage(9).character('sam').affect('drunk').character('sam').affect('shaken').character('sam');
    const rested = worn.rest({ now: 3 * DAY, hours: 8 }).character('sam');
    assert.deepEqual(rested.condition, { hitPoints: 10, effects: [], rest: { from: 3 * DAY, until: 3 * DAY + 8 * HOUR }, maxHitPoints: 10, hurt: false, unconscious: false });
    assert.deepEqual([3 * DAY - 1, 3 * DAY, 3 * DAY + 8 * HOUR - 1, 3 * DAY + 8 * HOUR].map((t) => rested.restingAt(t)), [false, true, true, false]);
    assert.equal(worn.restingAt(0), false);
  });

  test('a rest takes a time and a duration of whole minutes', () => {
    const sam = everyone().character('sam');
    assert.throws(() => sam.rest({ now: -1, hours: 8 }), RangeError);
    for (const hours of [0, -1, 1 / 120]) assert.throws(() => sam.rest({ now: 0, hours }), RangeError, String(hours));
    assert.throws(() => sam.restingAt(0.5), RangeError);
    assert.deepEqual(sam.rest({ now: 0, hours: 0.5 }).character('sam').condition.rest, { from: 0, until: 30 });
  });

  test('changes only that character, sharing everyone else’s record', () => {
    const before = everyone();
    const after = before.character('sam').damage(3);
    assert.equal(after.data.characters[1], before.data.characters[1]);
    assert.notEqual(after.data.characters[0], before.data.characters[0]);
  });

  test('changes from a replaced cast are refused', () => {
    const before = everyone();
    const sam = before.character('sam');
    sam.damage(1);
    assert.throws(() => sam.damage(1), ReplacedCastError);
    assert.throws(() => sam.rest({ now: 0, hours: 8 }), ReplacedCastError);
  });

  test('anyone present can see whether a character is hurt or unconscious, and nothing more of their condition', () => {
    const seen = (c: ReturnType<typeof everyone>) => c.character('sam').seenBy(c.character('rico')).looks;
    const start = everyone();
    assert.equal(seen(start), 'unhurt');
    const hurt = start.character('sam').damage(5);
    assert.equal(seen(hurt), 'hurt');
    const drunk = hurt.character('sam').rest({ now: 0, hours: 8 }).character('sam').affect('drunk');
    assert.equal(seen(drunk), 'unhurt');
    assert.equal(seen(drunk.character('sam').damage(10)), 'unconscious');
  });
});
