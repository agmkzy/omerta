import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { BACKGROUNDS, rollCharacter } from '../src/backgrounds';
import { OUTCOMES, opposedOdds } from '../src/check';
import { createCharacter } from '../src/character';
import { DICE } from '../src/dice';
import { roller, seeded } from '../src/random';
import { SOCIAL_ACTIONS, SOCIAL_ACTION_INFO, describeEnding, describeSocial, endingKey, endingOf, goesAlong, resolveSocial, socialOdds, socialRolls, type SocialChance, type SocialResult, type SocialSpec } from '../src/social';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// The actor: Intimidation +2, Persuasion +2, Deception +0. The target: Nerve +0, Insight +0. Average temperaments.
const actor = createCharacter({ name: 'A', training: { intimidation: 'trained', persuasion: 'trained' } });
const target = (t: Parameters<typeof temperament>[0] = {}) => createCharacter({ name: 'T', temperament: temperament(t) });
const spec = (over: Partial<SocialSpec> = {}): SocialSpec => ({ actor, target: target(), action: 'intimidate', ...over });
const reasons = (mods: readonly { reason: string }[]) => mods.map((m) => m.reason);

/** The result, after checking it was decided by the opposed check (not a failed nerve check). */
function checked(result: SocialResult) {
  if (result.kind === 'nerve') throw new assert.AssertionError({ message: 'expected the opposed check to be rolled' });
  return result.check;
}
const chanceOf = (chances: readonly SocialChance[], key: string) => chances.find((c) => endingKey(c.ending) === key)?.chance;

describe('resolveSocial', { tags: ['unit'] }, () => {
  test('intimidate is Intimidation against the target’s Nerve, graded like any opposed check', () => {
    const r = resolveSocial(spec(), scripted(15, 10)); // 17 vs 10
    assert.deepEqual(endingOf(r), { kind: 'check', outcome: 'success' });
    assert.deepEqual(reasons(checked(r).active.modifiers), ['Charisma 10', 'Trained in Intimidation']);
    assert.deepEqual(reasons(checked(r).passive.modifiers), ['Wisdom 10']);
    assert.equal(r.nerve, null);
  });

  test('persuade is Persuasion against Insight; deceive is Deception against Insight', () => {
    const p = checked(resolveSocial(spec({ action: 'persuade' }), scripted(10, 10)));
    assert.deepEqual([reasons(p.active.modifiers), reasons(p.passive.modifiers), p.passive.dice], [['Charisma 10', 'Trained in Persuasion'], ['Wisdom 10'], DICE.d20]);
    assert.deepEqual(reasons(checked(resolveSocial(spec({ action: 'deceive' }), scripted(10, 10))).active.modifiers), ['Charisma 10']);
  });

  test('applies temperament: a proud target resists intimidation, an honest actor lies badly', () => {
    assert.ok(reasons(checked(resolveSocial(spec({ target: target({ pride: 0.9 }) }), scripted(10, 10))).passive.modifiers).includes('Proud'));
    const honest = createCharacter({ name: 'H', temperament: temperament({ honesty: 0.9 }) });
    assert.ok(reasons(checked(resolveSocial(spec({ actor: honest, action: 'deceive' }), scripted(10, 10))).active.modifiers).includes('Honest'));
  });

  test('adds situational modifiers to the actor', () => {
    assert.deepEqual(checked(resolveSocial(spec({ modifiers: [{ value: -2, reason: 'Outnumbered' }] }), scripted(10, 10))).active.modifiers.at(-1), { value: -2, reason: 'Outnumbered' });
  });

  test('a critical failure at intimidating a hot-tempered target provokes a fight', () => {
    const hot = resolveSocial(spec({ target: target({ temper: 0.9 }) }), scripted(1, 20));
    assert.deepEqual([hot.kind, endingOf(hot)], ['provoked', { kind: 'provoked' }]);
    assert.deepEqual(endingOf(resolveSocial(spec(), scripted(1, 20))), { kind: 'check', outcome: 'critical-failure' });
  });

  test('only intimidation provokes: a failed persuasion is just a critical failure', () => {
    assert.deepEqual(endingOf(resolveSocial(spec({ action: 'persuade', target: target({ temper: 0.9 }) }), scripted(1, 20))), { kind: 'check', outcome: 'critical-failure' });
  });

  test('keeps what was attempted with the result', () => {
    const s = spec({ action: 'persuade' });
    assert.equal(resolveSocial(s, scripted(10, 10)).spec, s);
  });
});

describe('resolveSocial: armed intimidation', { tags: ['unit'] }, () => {
  test('the target first makes a DC 12 nerve check; failing it, an average target complies at once and no check is rolled', () => {
    const r = resolveSocial(spec({ armed: true }), scripted(9));
    assert.deepEqual([r.kind, r.nerve?.result.dc, endingOf(r)], ['nerve', 12, { kind: 'nerve', response: 'yields' }]);
  });

  test('a timid target flees; a hot-tempered one fights back', () => {
    assert.deepEqual(endingOf(resolveSocial(spec({ armed: true, target: target({ courage: 0.1 }) }), scripted(9))), { kind: 'nerve', response: 'flees' });
    assert.deepEqual(endingOf(resolveSocial(spec({ armed: true, target: target({ temper: 0.9 }) }), scripted(9))), { kind: 'nerve', response: 'fights' });
  });

  test('if the target holds their nerve, the intimidation is rolled with advantage', () => {
    const r = resolveSocial(spec({ armed: true }), scripted(12, 3, 15, 10));
    assert.deepEqual([r.nerve?.passed, checked(r).active.edge, checked(r).active.thrown.kept], [true, 'advantage', 15]);
  });

  test('only intimidation can be armed', () => {
    assert.throws(() => resolveSocial(spec({ action: 'persuade', armed: true }), scripted()), RangeError);
    assert.throws(() => socialOdds(spec({ action: 'deceive', armed: true })), RangeError);
  });
});

describe('socialRolls', { tags: ['unit'] }, () => {
  test('are the rolls resolveSocial makes: the actor’s skill and the target’s resisting skill, with advantage if armed', () => {
    const { active, passive } = socialRolls(spec({ armed: true }));
    assert.deepEqual([active.edge, reasons(active.modifiers), reasons(passive.modifiers)], ['advantage', ['Charisma 10', 'Trained in Intimidation'], ['Wisdom 10']]);
    assert.equal(socialRolls(spec()).active.edge, 'none');
  });
});

describe('socialOdds', { tags: ['unit'] }, () => {
  test('unarmed, they are the opposed check’s odds, one for each outcome', () => {
    const odds = socialOdds(spec());
    const expected = opposedOdds(socialRolls(spec()));
    assert.deepEqual(odds.map((c) => c.ending), OUTCOMES.map((outcome) => ({ kind: 'check', outcome })));
    for (const o of OUTCOMES) assert.ok(Math.abs((chanceOf(odds, o) ?? -1) - expected[o]) < 1e-12, o);
  });

  test('armed, an average target fails the DC 12 nerve check 11 times in 20, and gives in', () => {
    const odds = socialOdds(spec({ armed: true }));
    assert.ok(Math.abs((chanceOf(odds, 'nerve:yields') ?? -1) - 11 / 20) < 1e-12);
    assert.equal(chanceOf(odds, 'nerve:flees'), undefined);
  });

  test('a hot-tempered target turns critical failures into a fight', () => {
    const calm = socialOdds(spec());
    const hot = socialOdds(spec({ target: target({ temper: 0.9 }) }));
    assert.equal(chanceOf(hot, 'critical-failure'), undefined);
    assert.ok(Math.abs((chanceOf(hot, 'provoked') ?? -1) - (chanceOf(calm, 'critical-failure') ?? -1)) < 1e-12);
    assert.equal(chanceOf(calm, 'provoked'), undefined);
  });

  test('goesAlong adds a partial success or better and giving in to a weapon', () => {
    const odds = socialOdds(spec({ armed: true }));
    const expected = ['partial', 'success', 'critical-success', 'nerve:yields'].reduce((sum, k) => sum + (chanceOf(odds, k) ?? 0), 0);
    assert.ok(Math.abs(goesAlong(odds) - expected) < 1e-12);
    assert.equal(goesAlong(socialOdds(spec({ armed: true, target: target({ courage: 0.1 }) }))) < goesAlong(odds), true);
  });
});

describe('social descriptions', { tags: ['unit'] }, () => {
  test('every action has a name, a description and a meaning for every outcome', () => {
    for (const a of SOCIAL_ACTIONS) {
      const info = SOCIAL_ACTION_INFO[a];
      assert.deepEqual([info.name !== '', info.description !== ''], [true, true], a);
      for (const o of OUTCOMES) assert.notEqual(info.outcomes[o], '', `${a} ${o}`);
    }
  });

  test('endingKey names how it ended', () => {
    assert.deepEqual([endingKey({ kind: 'check', outcome: 'partial' }), endingKey({ kind: 'nerve', response: 'flees' }), endingKey({ kind: 'provoked' })], ['partial', 'nerve:flees', 'provoked']);
  });

  test('describeEnding says what each ending means for the action', () => {
    assert.equal(describeEnding({ kind: 'check', outcome: 'partial' }, 'intimidate'), 'Partial success: complies, but resents it and may make trouble later.');
    assert.equal(describeEnding({ kind: 'nerve', response: 'flees' }, 'intimidate'), 'Fails the nerve check against the weapon and runs.');
    assert.equal(describeEnding({ kind: 'provoked' }, 'intimidate'), 'Critical failure: takes offence and starts a fight (hot-tempered).');
  });

  test('describeSocial explains the result in words', () => {
    assert.equal(describeSocial(resolveSocial(spec(), scripted(15, 10))), 'A rolled 17 for Intimidation against T’s 10 for Nerve: success. T complies.');
    assert.equal(describeSocial(resolveSocial(spec({ armed: true }), scripted(9))), 'T faces a weapon and fails a nerve check (needed 12, rolled 9). T complies at once.');
    assert.equal(describeSocial(resolveSocial(spec({ armed: true, target: target({ temper: 0.9 }) }), scripted(9))), 'T faces a weapon and fails a nerve check (needed 12, rolled 9). T fights back: it becomes a fight.');
    assert.equal(describeSocial(resolveSocial(spec({ armed: true, target: target({ courage: 0.1 }) }), scripted(9))), 'T faces a weapon and fails a nerve check (needed 12, rolled 7). T runs.');
    assert.equal(describeSocial(resolveSocial(spec({ target: target({ temper: 0.9 }) }), scripted(1, 20))), 'A rolled 3 for Intimidation against T’s 20 for Nerve: critical failure. T takes offence and starts a fight.');
  });
});

describe('socialOdds', { tags: ['property'] }, () => {
  test('sum to 1 for any pair of characters and action', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...BACKGROUNDS), fc.constantFrom(...BACKGROUNDS), fc.constantFrom(...SOCIAL_ACTIONS), fc.boolean(), (seed, a, t, action, armed) => {
        const r = roller(seeded(seed));
        const odds = socialOdds({ actor: rollCharacter('A', a, r), target: rollCharacter('T', t, r), action, armed: armed && action === 'intimidate' });
        assert.ok(Math.abs(odds.reduce((sum, c) => sum + c.chance, 0) - 1) < 1e-9);
      }),
    );
  });
});

describe('socialOdds', { tags: ['statistical'] }, () => {
  test('match sampled frequencies', () => {
    const r = roller(seeded(5));
    const s = spec({ armed: true, target: target({ temper: 0.9 }) });
    const seen: Record<string, number> = {};
    const n = 40_000;
    for (let i = 0; i < n; i++) {
      const key = endingKey(endingOf(resolveSocial(s, r)));
      seen[key] = (seen[key] ?? 0) + 1;
    }
    for (const { ending, chance } of socialOdds(s)) {
      const key = endingKey(ending);
      assert.ok(Math.abs((seen[key] ?? 0) / n - chance) < 0.01, `${key}: seen ${(seen[key] ?? 0) / n}, expected ${chance}`);
    }
  });
});
