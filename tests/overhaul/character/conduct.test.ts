import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { cast, castOf, type Cast } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import { CONDUCT, CONDUCTS, CONDUCT_INTERVAL, FACT_CONDUCT, STEP, applySteps, assertConduct, conductSteps, currentTemperament, type ConductStep } from '../../../src/overhaul/character/conduct';
import { NEW_RELATIONSHIP } from '../../../src/overhaul/character/relationships';
import { TRAITS, temperament } from '../../../src/overhaul/character/temperament';
import { DAY } from '../../../src/overhaul/character/time';
import { scripted } from './support';

const close = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const step = (over: Partial<ConductStep> = {}): ConductStep => ({ conduct: 'lying', trait: 'honesty', direction: -1, at: 0, cause: { fact: 'f1' }, ...over });
const moves = (steps: readonly ConductStep[]) => steps.map((s) => `${s.trait} ${s.direction > 0 ? '+' : '-'}`);
const people = (...extra: { id: string; name: string; [k: string]: unknown }[]) =>
  cast({ characters: [{ id: 'sam', name: 'Sam', attributes: attributeScores({ cha: 14 }), training: { intimidation: 'trained' } }, { id: 'rico', name: 'Rico' }, { id: 'joe', name: 'Joe' }, ...extra] });

describe('the conduct tables', { tags: ['unit'] }, () => {
  test('have the plan’s rows, each moving real traits', () => {
    assert.equal(CONDUCTS.length, 25);
    const t = temperament({});
    for (const c of CONDUCTS) {
      assert.ok(CONDUCT[c].what, c);
      for (const [trait, d] of CONDUCT[c].moves(t, {})) assert.ok(TRAITS.includes(trait) && (d === 1 || d === -1), c);
    }
    assert.deepEqual(CONDUCT.robbing.moves(t, {}), [['greed', 1], ['violence', 1]]);
    assert.deepEqual(CONDUCT['giving-in-to-a-threat'].moves(t, {}), [['courage', -1], ['pride', -1]]);
  });

  test('make a brave victim more volatile, and anyone else more cautious', () => {
    assert.deepEqual(CONDUCT.beaten.moves(temperament({ courage: 0.8 }), {}), [['volatility', 1]]);
    assert.deepEqual(CONDUCT.beaten.moves(temperament({}), {}), [['caution', 1]]);
  });

  test('make drinking in company more sociable, and alone less', () => {
    assert.deepEqual(CONDUCT.drinking.moves(temperament({}), { inCompany: true }), [['vice', 1], ['sociability', 1]]);
    assert.deepEqual(CONDUCT.drinking.moves(temperament({}), {}), [['vice', 1], ['sociability', -1]]);
  });

  test('name the conduct recorded facts are for whoever did them and whoever they were done to', () => {
    assert.deepEqual(FACT_CONDUCT, { actor: { robbery: 'robbing', theft: 'stealing', burglary: 'stealing', scam: 'stealing' }, victim: { beating: 'beaten' } });
  });
});

describe('steps', { tags: ['unit'] }, () => {
  test('are 0.01 of the way to the end they move towards', () => {
    assert.equal(STEP, 0.01);
    const start = temperament({ honesty: 0.5, greed: 0.9 });
    close(applySteps(start, [step()]).honesty, 0.495);
    close(applySteps(start, [step({ trait: 'greed', direction: 1 })]).greed, 0.901);
    close(applySteps(start, [step({ trait: 'greed', direction: -1 })]).greed, 0.891);
  });

  test('take about a year of weekly steps to move a trait from neutral to low', () => {
    const weekly = Array.from({ length: 52 }, (_, i) => step({ trait: 'courage', at: i * 7 * DAY }));
    const after = (n: number) => applySteps(temperament({}), weekly.slice(0, n)).courage;
    assert.ok(after(50) > 0.3 && after(52) <= 0.3, `${after(50)} ${after(52)}`);
  });

  test('never take a trait outside 0 to 1', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ trait: fc.constantFrom(...TRAITS), direction: fc.constantFrom(1 as const, -1 as const) }), { maxLength: 300 }), (ss) => {
        const t = applySteps(temperament({}), ss.map((s, i) => step({ ...s, at: i })));
        return TRAITS.every((k) => t[k] >= 0 && t[k] <= 1);
      }),
    );
  });
});

describe('conductSteps', { tags: ['unit'] }, () => {
  const c = createCharacter({ id: 'sam', name: 'Sam' });

  test('moves each trait the row names, by the character’s current traits', () => {
    assert.deepEqual(moves(conductSteps(c, 'robbing', 0, { fact: 'f1' })), ['greed +', 'violence +']);
    assert.deepEqual(conductSteps(c, 'lying', 60, { fact: 'f2' }), [step({ at: 60, cause: { fact: 'f2' } })]);
  });

  test('moves a row at most once a week; different rows add together', () => {
    const lied = { ...c, conduct: [step({ at: 0 })] };
    assert.deepEqual(conductSteps(lied, 'lying', CONDUCT_INTERVAL - 1, { fact: 'f2' }), []);
    assert.equal(conductSteps(lied, 'lying', CONDUCT_INTERVAL, { fact: 'f2' }).length, 1);
    assert.equal(conductSteps(lied, 'robbing', 1, { fact: 'f2' }).length, 2);
  });

  test('refuses a time that is not whole minutes from 0', () => {
    assert.throws(() => conductSteps(c, 'lying', -1, { fact: 'f1' }), RangeError);
  });
});

describe('a character’s current traits', { tags: ['unit'] }, () => {
  test('are their starting traits moved by their conduct, worked out, not stored', () => {
    const c = createCharacter({ id: 'sam', name: 'Sam', startingTemperament: { honesty: 0.8 }, conduct: [step(), step({ at: 7 * DAY })] });
    close(currentTemperament(c).honesty, 0.8 * 0.99 * 0.99);
    assert.equal(c.startingTemperament.honesty, 0.8);
    assert.equal(currentTemperament(c), currentTemperament(c));
  });

  test('refuse conduct that is not valid steps in time order', () => {
    for (const bad of [[step({ conduct: 'juggling' as never })], [step({ trait: 'whimsy' as never })], [step({ direction: 2 as never })], [step({ at: -1 })], [step({ at: 10 }), step({ at: 5 })]])
      assert.throws(() => assertConduct(bad, 'x'), RangeError, JSON.stringify(bad));
    assert.throws(() => createCharacter({ id: 'x', name: 'X', conduct: [step({ at: 0.5 })] }), RangeError);
  });

  test('must have their causes recorded before them', () => {
    assert.throws(() => cast({ characters: [{ id: 'sam', name: 'Sam', conduct: [step()] }] }), RangeError);
    const c = people().record({ kind: 'theft', actor: 'sam' }, { now: 100 }).cast;
    const early = c.data.characters.map((x) => (x.id === 'sam' ? createCharacter({ ...x, conduct: [step({ cause: { fact: 'f1' }, at: 50 })] }) : x));
    assert.throws(() => castOf({ ...c.data, characters: early }), RangeError);
    assert.doesNotThrow(() => castOf({ ...c.data, characters: c.data.characters.map((x) => (x.id === 'sam' ? createCharacter({ ...x, conduct: [step({ cause: { item: 'bottle' } })] }) : x)) }));
  });
});

describe('conduct from recorded facts', { tags: ['unit'] }, () => {
  test('a robbery, theft, burglary or scam is the conduct of whoever did it', () => {
    const robbed = people().record({ kind: 'robbery', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 0 }).cast;
    assert.deepEqual(moves(robbed.character('sam').conduct), ['greed +', 'violence +']);
    assert.deepEqual(robbed.character('sam').conduct[0]!.cause, { fact: 'f1' });
    close(robbed.character('sam').temperament.greed, 0.505);
    assert.deepEqual(robbed.character('rico').conduct, []);
    for (const kind of ['theft', 'burglary', 'scam'] as const) assert.deepEqual(moves(people().record({ kind, actor: 'sam' }, { now: 0 }).cast.character('sam').conduct), ['greed +', 'honesty -']);
  });

  test('being beaten is the experience of whoever it was done to', () => {
    const beaten = people({ id: 'vic', name: 'Vic', startingTemperament: { courage: 0.9 } }).record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 0 }).cast;
    assert.deepEqual(moves(beaten.character('rico').conduct), ['caution +']);
    assert.deepEqual(beaten.character('sam').conduct, []);
    const brave = beaten.record({ kind: 'beating', actor: 'sam', victim: 'vic' }, { now: 10 }).cast;
    assert.deepEqual(moves(brave.character('vic').conduct), ['volatility +']);
  });

  test('a fact with no conduct, or one that never happened, moves no one', () => {
    assert.deepEqual(people().record({ kind: 'trouble', actor: 'sam', victim: 'rico' }, { now: 0 }).cast.characters.map((c) => c.conduct.length), [0, 0, 0]);
  });

  test('the same conduct twice in a week moves the traits once', () => {
    const twice = people().record({ kind: 'theft', actor: 'sam' }, { now: 0 }).cast.record({ kind: 'scam', actor: 'sam' }, { now: DAY }).cast;
    assert.equal(twice.character('sam').conduct.length, 2);
    const later = twice.record({ kind: 'theft', actor: 'sam' }, { now: 8 * DAY }).cast;
    assert.equal(later.character('sam').conduct.length, 4);
  });
});

describe('conduct from social rolls', { tags: ['unit'] }, () => {
  const roll = (c: Cast, action: 'intimidate' | 'persuade', active: number, passive: number) =>
    c.character('sam').social[action](c.character('rico')).roll(scripted(active, passive), { now: 0 });

  test('intimidating is violent; the target who gives in loses courage and pride, one who stands up gains them', () => {
    const gaveIn = roll(people(), 'intimidate', 14, 10).cast;
    assert.deepEqual(moves(gaveIn.character('sam').conduct), ['violence +']);
    assert.deepEqual(moves(gaveIn.character('rico').conduct), ['courage -', 'pride -']);
    const stood = roll(people(), 'intimidate', 10, 14).cast;
    assert.deepEqual(moves(stood.character('rico').conduct), ['courage +', 'pride +']);
  });

  test('a provoked target stands up to it and loses their temper', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam' }, { id: 'rico', name: 'Rico', startingTemperament: { volatility: 0.9 } }] });
    const out = roll(c, 'intimidate', 1, 18);
    assert.equal(out.truth.ending, 'provoked');
    assert.deepEqual(moves(out.cast.character('rico').conduct), ['courage +', 'pride +', 'volatility +']);
  });

  test('persuading makes the persuader more agreeable', () => {
    assert.deepEqual(moves(roll(people(), 'persuade', 2, 15).cast.character('sam').conduct), ['agreeable +']);
  });

  test('lying is dishonest, lying to someone who trusts the liar is disloyal, and being found out makes the target less agreeable', () => {
    const lie = (c: Cast, active: number, passive: number) =>
      c.character('sam').social.deceive(c.character('rico')).claim({ invented: { kind: 'theft', actor: 'joe' } }).roll(scripted(active, passive), { now: 0 });
    assert.deepEqual(moves(lie(people(), 15, 5).cast.character('sam').conduct), ['honesty -']);
    const trusting = people().data.characters.map((c) => (c.id === 'rico' ? createCharacter({ ...c, relationships: { sam: { ...NEW_RELATIONSHIP, trust: 0.8 } } }) : c));
    assert.deepEqual(moves(lie(castOf({ ...people().data, characters: trusting }), 15, 5).cast.character('sam').conduct), ['honesty -', 'loyalty -']);
    const caught = lie(people(), 1, 18).cast;
    assert.deepEqual(moves(caught.character('rico').conduct), ['agreeable -']);
  });

  test('moves later rolls: a persuader who has grown agreeable is no different to the target, but their traits have moved', () => {
    let c = people();
    for (let week = 0; week < 3; week++) c = c.character('sam').social.persuade(c.character('rico')).roll(scripted(10, 10), { now: week * 7 * DAY }).cast;
    close(c.character('sam').temperament.agreeable, 1 - 0.5 * 0.99 ** 3);
  });
});

describe('conduct from drinking', { tags: ['unit'] }, () => {
  const withBottle = () => cast({ characters: [{ id: 'sam', name: 'Sam', inventory: { items: ['bottle', 'bottle'] } }, { id: 'rico', name: 'Rico' }] });

  test('is indulgent, and sociable in company or solitary alone, caused by the bottle', () => {
    const alone = withBottle().character('sam').drink(scripted(15), { now: 0 }).cast.character('sam');
    assert.deepEqual(moves(alone.conduct), ['vice +', 'sociability -']);
    assert.deepEqual(alone.conduct[0]!.cause, { item: 'bottle' });
    const c = withBottle();
    const together = c.character('sam').drink(scripted(15), { now: 0, with: [c.character('rico')] }).cast.character('sam');
    assert.deepEqual(moves(together.conduct), ['vice +', 'sociability +']);
  });

  test('needs its company to be someone else in the cast', () => {
    const c = withBottle();
    assert.throws(() => c.character('sam').drink(scripted(15), { now: 0, with: [c.character('sam')] }), RangeError);
    assert.throws(() => c.character('sam').drink(scripted(15), { now: 0, with: [withBottle().character('rico')] }), RangeError);
  });
});
