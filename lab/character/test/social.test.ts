import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { BACKGROUNDS, rollCharacter } from '../src/backgrounds';
import { OUTCOMES, opposedOdds } from '../src/check';
import { createCharacter, rollFor } from '../src/character';
import { DICE } from '../src/dice';
import { roller, seeded } from '../src/random';
import { SOCIAL_ACTIONS, SOCIAL_ACTION_INFO, describeSocial, resolveSocial, socialOdds, socialResultKey, type SocialSpec } from '../src/social';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// The actor: Intimidation +2, Persuasion +2, Deception +0. The target: Nerve +0, Insight +0. Average temperaments.
const actor = createCharacter({ name: 'A', training: { intimidation: 'trained', persuasion: 'trained' } });
const target = (t: Parameters<typeof temperament>[0] = {}) => createCharacter({ name: 'T', temperament: temperament(t) });
const spec = (over: Partial<SocialSpec> = {}): SocialSpec => ({ actor, target: target(), action: 'intimidate', ...over });
const reasons = (mods: readonly { reason: string }[]) => mods.map((m) => m.reason);

describe('resolveSocial', { tags: ['unit'] }, () => {
  test('intimidate is Intimidation against the target’s Nerve, graded like any opposed check', () => {
    const r = resolveSocial(spec(), scripted(15, 10)); // 17 vs 10
    assert.deepEqual(r.ending, { kind: 'check', outcome: 'success' });
    assert.ok(r.check && reasons(r.check.active.modifiers).includes('Trained in Intimidation'));
    assert.deepEqual(reasons(r.check!.passive.modifiers), ['Wisdom 10']);
    assert.equal(r.nerve, null);
  });

  test('persuade is Persuasion against Insight; deceive is Deception against Insight', () => {
    const p = resolveSocial(spec({ action: 'persuade' }), scripted(10, 10));
    assert.ok(reasons(p.check!.active.modifiers).includes('Trained in Persuasion'));
    assert.deepEqual(reasons(p.check!.passive.modifiers), ['Wisdom 10']);
    assert.equal(p.check!.passive.dice, DICE.d20);
    const d = resolveSocial(spec({ action: 'deceive' }), scripted(10, 10));
    assert.deepEqual(reasons(d.check!.active.modifiers), ['Charisma 10']);
  });

  test('applies temperament: a proud target resists intimidation, an honest actor lies badly', () => {
    const proud = resolveSocial(spec({ target: target({ pride: 0.9 }) }), scripted(10, 10));
    assert.ok(reasons(proud.check!.passive.modifiers).includes('Proud'));
    const honest = createCharacter({ name: 'H', temperament: temperament({ honesty: 0.9 }) });
    assert.ok(reasons(resolveSocial(spec({ actor: honest, action: 'deceive' }), scripted(10, 10)).check!.active.modifiers).includes('Honest'));
  });

  test('adds situational modifiers to the actor', () => {
    const r = resolveSocial(spec({ modifiers: [{ value: -2, reason: 'Outnumbered' }] }), scripted(10, 10));
    assert.deepEqual(r.check!.active.modifiers.at(-1), { value: -2, reason: 'Outnumbered' });
  });

  test('a critical failure at intimidating a hot-tempered target provokes a fight', () => {
    assert.deepEqual(resolveSocial(spec({ target: target({ temper: 0.9 }) }), scripted(1, 20)).ending, { kind: 'provoked' });
    assert.deepEqual(resolveSocial(spec(), scripted(1, 20)).ending, { kind: 'check', outcome: 'critical-failure' });
  });

  test('only intimidation provokes: a failed persuasion is just a critical failure', () => {
    assert.deepEqual(resolveSocial(spec({ action: 'persuade', target: target({ temper: 0.9 }) }), scripted(1, 20)).ending, { kind: 'check', outcome: 'critical-failure' });
  });
});

describe('resolveSocial: armed intimidation', { tags: ['unit'] }, () => {
  test('the target first makes a DC 12 nerve check; failing it, an average target complies at once', () => {
    const r = resolveSocial(spec({ armed: true }), scripted(9));
    assert.equal(r.nerve?.result.dc, 12);
    assert.deepEqual(r.ending, { kind: 'nerve', response: 'yields' });
    assert.equal(r.check, null);
  });

  test('a timid target flees; a hot-tempered one fights back', () => {
    assert.deepEqual(resolveSocial(spec({ armed: true, target: target({ courage: 0.1 }) }), scripted(9)).ending, { kind: 'nerve', response: 'flees' });
    assert.deepEqual(resolveSocial(spec({ armed: true, target: target({ temper: 0.9 }) }), scripted(9)).ending, { kind: 'nerve', response: 'fights' });
  });

  test('if the target holds their nerve, the intimidation is rolled with advantage', () => {
    const r = resolveSocial(spec({ armed: true }), scripted(12, 3, 15, 10));
    assert.equal(r.nerve?.passed, true);
    assert.equal(r.check?.active.edge, 'advantage');
    assert.equal(r.check?.active.thrown.kept, 15);
  });

  test('only intimidation can be armed', () => {
    assert.throws(() => resolveSocial(spec({ action: 'persuade', armed: true }), scripted()), RangeError);
    assert.throws(() => socialOdds(spec({ action: 'deceive', armed: true })), RangeError);
  });
});

describe('socialOdds', { tags: ['unit'] }, () => {
  test('unarmed, they are the opposed check’s odds', () => {
    const odds = socialOdds(spec());
    const expected = opposedOdds({ active: rollFor(actor, 'intimidation', { situations: ['intimidate'] }), passive: rollFor(target(), 'nerve', { situations: ['hold-nerve', 'resist-intimidation'] }) });
    for (const o of OUTCOMES) assert.ok(Math.abs(odds[o] - expected[o]) < 1e-12, o);
    assert.equal(odds['nerve:yields'], 0);
  });

  test('armed, an average target fails the DC 12 nerve check 11 times in 20', () => {
    const odds = socialOdds(spec({ armed: true }));
    assert.ok(Math.abs(odds['nerve:yields'] - 11 / 20) < 1e-12);
    assert.equal(odds['nerve:flees'], 0);
  });

  test('a hot-tempered target turns critical failures into a fight', () => {
    const calm = socialOdds(spec());
    const hot = socialOdds(spec({ target: target({ temper: 0.9 }) }));
    assert.equal(hot['critical-failure'], 0);
    assert.ok(Math.abs(hot.provoked - calm['critical-failure']) < 1e-12);
  });
});

describe('social descriptions', { tags: ['unit'] }, () => {
  test('every action has a name, a description and a meaning for every outcome', () => {
    for (const a of SOCIAL_ACTIONS) {
      const info = SOCIAL_ACTION_INFO[a];
      assert.ok(info.name && info.description, a);
      for (const o of OUTCOMES) assert.ok(info.outcomes[o], `${a} ${o}`);
    }
  });

  test('socialResultKey names how it ended', () => {
    assert.equal(socialResultKey({ kind: 'check', outcome: 'partial' }), 'partial');
    assert.equal(socialResultKey({ kind: 'nerve', response: 'flees' }), 'nerve:flees');
    assert.equal(socialResultKey({ kind: 'provoked' }), 'provoked');
  });

  test('describeSocial explains the result in words', () => {
    assert.equal(describeSocial(resolveSocial(spec(), scripted(15, 10)), spec()), 'A rolled 17 for Intimidation against T’s 10 for Nerve: success. T complies.');
    assert.equal(describeSocial(resolveSocial(spec({ armed: true }), scripted(9)), spec({ armed: true })), 'T faces a weapon and fails a nerve check (needed 12, rolled 9). T complies at once.');
    assert.equal(describeSocial(resolveSocial(spec({ armed: true, target: target({ temper: 0.9 }) }), scripted(9)), spec()), 'T faces a weapon and fails a nerve check (needed 12, rolled 9). T fights back: it becomes a fight.');
    assert.equal(describeSocial(resolveSocial(spec({ armed: true, target: target({ courage: 0.1 }) }), scripted(9)), spec()), 'T faces a weapon and fails a nerve check (needed 12, rolled 7). T runs.');
    assert.equal(describeSocial(resolveSocial(spec({ target: target({ temper: 0.9 }) }), scripted(1, 20)), spec()), 'A rolled 3 for Intimidation against T’s 20 for Nerve: critical failure. T takes offence and starts a fight.');
  });
});

describe('socialOdds', { tags: ['property'] }, () => {
  test('sum to 1 for any pair of characters and action', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...BACKGROUNDS), fc.constantFrom(...BACKGROUNDS), fc.constantFrom(...SOCIAL_ACTIONS), fc.boolean(), (seed, a, t, action, armed) => {
        const r = roller(seeded(seed));
        const odds = socialOdds({ actor: rollCharacter('A', a, r), target: rollCharacter('T', t, r), action, armed: armed && action === 'intimidate' });
        return Math.abs(Object.values(odds).reduce((x, y) => x + y, 0) - 1) < 1e-9;
      }),
    );
  });

  test('match sampled frequencies', () => {
    const r = roller(seeded(5));
    const s = spec({ armed: true, target: target({ temper: 0.9 }) });
    const odds = socialOdds(s);
    const seen: Record<string, number> = {};
    const n = 40_000;
    for (let i = 0; i < n; i++) {
      const key = socialResultKey(resolveSocial(s, r).ending);
      seen[key] = (seen[key] ?? 0) + 1;
    }
    for (const [key, p] of Object.entries(odds)) assert.ok(Math.abs((seen[key] ?? 0) / n - p) < 0.01, `${key}: seen ${(seen[key] ?? 0) / n}, expected ${p}`);
  });
});
