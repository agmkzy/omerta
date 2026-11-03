import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { cast, type Cast } from '../../../src/overhaul/character/cast';
import { partOf } from '../../../src/overhaul/character/knowledge';
import { TELL_DC } from '../../../src/overhaul/character/tell';
import { scripted } from './support';

const close = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const reasons = (ms: readonly { value: number; reason: string }[]) => ms.map((m) => `${m.reason} ${m.value}`);
const people = () => cast({ characters: ['sam', 'rico', 'joe', 'vic', 'al'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })) });
/** Sam robs Vic unseen, with Joe watching, then lies to Rico (who was not there) that Joe did it. */
const lied = (): Cast => {
  const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'vic', hiddenActor: true }, { now: 0, witnesses: ['joe'] }).cast;
  return c.character('sam').social.deceive(c.character('rico')).claim({ about: 'f1', blame: 'joe' }).roll(scripted(15, 5), { now: 10 }).cast;
};

describe('telling someone something that contradicts what they believe', { tags: ['unit'] }, () => {
  test('is the teller’s Persuasion against DC 10, with what the listener knows of that part as a modifier', () => {
    assert.equal(TELL_DC, 10);
    const c = lied();
    const check = c.character('joe').social.tell(c.character('rico'), 'f1');
    // Rico was told who did it by Sam, as something Sam saw
    assert.deepEqual(reasons(check.explain({ for: c.character('rico') })), ['A witness told Rico who did it -4']);
    assert.deepEqual(reasons(check.explain({ for: c.character('joe') })), ['Charisma 10 0']);
    const out = check.roll(scripted(15), { now: 20 });
    assert.equal(out.truth.roll!.outcome, 'partial');
    assert.deepEqual(out.truth.changed, ['who']);
    assert.deepEqual(out.cast.character('rico').versionOf('f1')!.who, { how: 'told', teller: 'joe' });
    assert.equal(out.cast.character('rico').versionOf('f1')!.knowsActor, true);
  });

  test('that succeeds, overturning what a lie claimed, brings the lie out', () => {
    const c = lied();
    const out = c.character('joe').social.tell(c.character('rico'), 'f1').roll(scripted(15), { now: 20 });
    assert.deepEqual(out.truth.exposed, ['f2']);
    const rico = out.cast.character('rico');
    assert.deepEqual(rico.versionOf('f2'), { learnedAt: 20, source: 'witness', how: 'seen', knowsActor: true });
    close(rico.towards(out.cast.character('sam'))!.grudge, 0.05);
    assert.ok(rico.towards(out.cast.character('sam'))!.trust < 0.4);
    assert.deepEqual(rico.conduct.map((s) => s.conduct), ['lied-to']);
  });

  test('that fails changes nothing, but the two have met', () => {
    const c = lied();
    const out = c.character('joe').social.tell(c.character('rico'), 'f1').roll(scripted(5), { now: 20 });
    assert.deepEqual(out.truth.changed, []);
    assert.equal(out.cast.character('rico').versionOf('f1')!.blame, 'joe');
    assert.equal(out.cast.character('rico').towards(out.cast.character('joe'))!.lastMet, 20);
  });

  test('cannot overturn what they saw themselves', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'vic' }, { now: 0, witnesses: ['joe'] }).cast;
    const vic = c.character('sam').social.deceive(c.character('vic')).claim({ about: 'f1', exaggerated: true });
    assert.ok(reasons(vic.explain({ for: c.character('vic') }).actor).includes('Vic saw it themselves -100'));
  });

  test('brings no lie out when the belief overturned came second-hand from someone honestly mistaken', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'al', hiddenActor: true }, { now: 0, witnesses: ['joe'] }).cast;
    const toVic = c.character('sam').social.deceive(c.character('vic')).claim({ about: 'f1', blame: 'joe' }).roll(scripted(19, 1), { now: 5 }).cast;
    const toRico = toVic.character('vic').social.tell(toVic.character('rico'), 'f1').roll(scripted(), { now: 10 }).cast;
    assert.deepEqual(partOf(toRico.character('rico').versionOf('f1')!, 'who'), { how: 'heard', teller: 'vic' });
    const check = toRico.character('joe').social.tell(toRico.character('rico'), 'f1');
    assert.deepEqual(reasons(check.explain({ for: toRico.character('rico') })), ['Rico heard who did it -2']);
    const out = check.roll(scripted(19), { now: 20 });
    assert.deepEqual([out.truth.changed, out.truth.exposed], [['who'], []]);
  });

  test('brings no lie out when the part overturned is not the part the lie claimed', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'al', hiddenActor: true }, { now: 0, witnesses: ['joe'] }).cast;
    // Sam lies to Rico that it was exaggerated, then Rico hears from Vic, wrongly, that Joe did it
    const big = c.character('joe').social.tell(c.character('rico'), 'f1').roll(scripted(), { now: 1 }).cast;
    const lied1 = big.character('sam').social.deceive(big.character('rico')).claim({ about: 'f1', exaggerated: true }).roll(scripted(19, 1), { now: 2 }).cast;
    const out = lied1.character('joe').social.tell(lied1.character('rico'), 'f1').roll(scripted(19), { now: 3 });
    assert.deepEqual(out.truth.changed, ['size']);
    assert.deepEqual(out.truth.exposed, ['f2']);
  });
});

describe('a later lie', { tags: ['unit'] }, () => {
  test('reads the provenance of the part it changes, not of the version: a lie about who did it leaves how big it was as they saw it', () => {
    const c = people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 0, witnesses: ['joe'] }).cast;
    // Rico saw who beat him, so a lie about who did it cannot work; but Joe's lie that it was smaller is about a part Rico saw too
    const who = c.character('joe').social.deceive(c.character('rico')).claim({ about: 'f1', blame: 'vic' });
    assert.ok(reasons(who.explain({ for: c.character('rico') }).actor).includes('Rico saw it themselves -100'));
    const hidden = people().record({ kind: 'robbery', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 0 }).cast;
    const lied1 = hidden.character('sam').social.deceive(hidden.character('rico')).claim({ about: 'f1', blame: 'joe' }).roll(scripted(15, 5), { now: 5 }).cast;
    const size = lied1.character('sam').social.deceive(lied1.character('rico')).claim({ about: 'f1', exaggerated: true });
    assert.ok(reasons(size.explain({ for: lied1.character('rico') }).actor).includes('Rico saw it themselves -100'));
  });

  test('counts feelings once for each person blamed, however often the belief changes', () => {
    let c = people().record({ kind: 'beating', actor: 'sam', victim: 'vic', hiddenActor: true }, { now: 0 }).cast;
    const lie = (blame: string, now: number) => {
      c = c.character('sam').social.deceive(c.character('rico')).claim({ about: 'f1', blame }).roll(scripted(19, 1), { now }).cast;
    };
    lie('joe', 10);
    const once = c.character('rico').towards(c.character('joe'))!;
    lie('vic', 20);
    lie('joe', 30);
    lie('vic', 40);
    lie('joe', 50);
    const after = c.character('rico').towards(c.character('joe'))!;
    assert.equal(after.fear, once.fear);
    assert.equal(after.respect, once.respect);
    assert.deepEqual(c.character('rico').versionOf('f1')!.blamed, ['joe', 'vic']);
  });
});

describe('asking the odds of telling', { tags: ['unit'] }, () => {
  test('reveals nothing more of the listener’s version than a lie’s odds would', () => {
    const c = lied();
    const toRico = c.character('joe').social.tell(c.character('rico'), 'f1');
    const toAl = c.character('joe').social.tell(c.character('al'), 'f1');
    assert.deepEqual(toRico.odds({ for: c.character('joe') }), toAl.odds({ for: c.character('joe') }));
    assert.deepEqual(reasons(toRico.explain({ for: c.character('joe') })), ['Charisma 10 0']);
    assert.notDeepEqual(toRico.odds({ for: c.character('rico') }), toRico.odds({ for: c.character('joe') }));
  });

  test('a correction by someone who heard it second-hand is heard', () => {
    const c = lied();
    const heard = c.character('joe').social.tell(c.character('al'), 'f1').roll(scripted(), { now: 15 }).cast;
    const out = heard.character('al').social.tell(heard.character('rico'), 'f1').roll(scripted(19), { now: 20 });
    assert.deepEqual(out.cast.character('rico').versionOf('f1')!.who, { how: 'heard', teller: 'al' });
  });
});

describe('telling that cannot be done', { tags: ['unit'] }, () => {
  test('is refused for a fact the teller does not know or knows is false, to themselves, by or to someone unconscious, from another cast, or before they knew it', () => {
    const c = lied();
    assert.throws(() => c.character('al').social.tell(c.character('rico'), 'f1'), RangeError);
    assert.throws(() => c.character('joe').social.tell(c.character('joe'), 'f1'), RangeError);
    assert.throws(() => c.character('joe').social.tell(people().character('rico'), 'f1'), RangeError);
    const out = c.character('rico').damage(10);
    assert.throws(() => out.character('joe').social.tell(out.character('rico'), 'f1'), RangeError);
    const made = (() => {
      const p = people();
      return p.character('sam').social.deceive(p.character('rico')).claim({ invented: { kind: 'theft', actor: 'joe' } }).roll(scripted(2, 15), { now: 5 }).cast;
    })();
    assert.throws(() => made.character('sam').social.tell(made.character('vic'), 'f1'), RangeError);
    assert.throws(() => c.character('joe').social.tell(c.character('al'), 'f1').roll(scripted(), { now: -1 }), RangeError);
    const late = people().record({ kind: 'theft', actor: 'sam' }, { now: 100 }).cast;
    assert.throws(() => late.character('sam').social.tell(late.character('rico'), 'f1').roll(scripted(), { now: 50 }), RangeError);
    assert.throws(() => c.character('joe').social.tell(c.character('al'), 'f1').odds({ for: people().character('al') }), RangeError);
  });
});
