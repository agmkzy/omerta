import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { ReplacedCastError, cast, castOf, type Cast } from '../../../src/overhaul/character/cast';
import { OUTCOMES, opposedOdds } from '../../../src/overhaul/character/check';
import { DICE } from '../../../src/overhaul/character/dice';
import { roller, seeded } from '../../../src/overhaul/character/random';
import { NEW_RELATIONSHIP, feel, meet } from '../../../src/overhaul/character/relationships';
import { AFTERMATH, ENDINGS, IMPOSSIBLE, SOCIAL_ACTION_INFO, socialCheck, trueOdds, type Ending } from '../../../src/overhaul/character/social';
import { scripted } from './support';

const close = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const reasons = (ms: readonly { value: number; reason: string }[]) => ms.map((m) => `${m.reason} ${m.value}`);
const sum = (odds: Readonly<Record<Ending, number>>) => ENDINGS.reduce((s, e) => s + odds[e], 0);

/** Sam: Charisma 14, trained in Intimidation, carrying a pistol. Rico, Joe and Vic are average. */
const people = (rico: Record<string, unknown> = {}) =>
  cast({
    characters: [
      { id: 'sam', name: 'Sam', attributes: attributeScores({ cha: 14 }), training: { intimidation: 'trained' }, inventory: { items: ['pistol'] } },
      { id: 'rico', name: 'Rico', ...rico },
      { id: 'joe', name: 'Joe' },
      { id: 'vic', name: 'Vic' },
    ],
  });
const who = (c: Cast) => ({ sam: c.character('sam'), rico: c.character('rico'), joe: c.character('joe'), vic: c.character('vic') });

describe('the social actions', { tags: ['unit'] }, () => {
  test('are the lab’s three opposed checks, each recording its own kind of fact', () => {
    assert.deepEqual(Object.entries(SOCIAL_ACTION_INFO).map(([a, i]) => [a, i.skill, i.resist, i.fact]), [
      ['intimidate', 'intimidation', 'nerve', 'threat'],
      ['persuade', 'persuasion', 'insight', 'persuasion'],
      ['deceive', 'deception', 'insight', 'lie'],
    ]);
    for (const i of Object.values(SOCIAL_ACTION_INFO)) for (const o of OUTCOMES) assert.ok(i.endings[o] && i.appearance[o], `${i.name} ${o}`);
  });

  test('have the plan’s aftermath', () => {
    assert.deepEqual(AFTERMATH.persuade.success, [{ whose: 'target', feeling: 'trust', amount: 0.05 }]);
    assert.deepEqual(AFTERMATH.persuade['critical-failure'], [{ whose: 'target', feeling: 'trust', amount: -0.02 }]);
    assert.deepEqual(AFTERMATH.deceive['critical-failure'], [{ whose: 'target', feeling: 'trust', amount: -0.15 }, { whose: 'target', feeling: 'grudge', amount: 0.05 }]);
    assert.equal(AFTERMATH.persuade.partial, undefined);
  });
});

describe('a social check before it is rolled', { tags: ['unit'] }, () => {
  test('explains to the actor their own modifiers, and nothing private of the target’s', () => {
    const { sam, rico } = who(people({ startingTemperament: { pride: 0.9 }, training: { nerve: 'trained' } }));
    const check = sam.social.intimidate(rico);
    assert.deepEqual(check.explain({ for: sam }), { actor: [{ value: 2, reason: 'Charisma 14' }, { value: 2, reason: 'Trained in Intimidation' }], target: [] });
    assert.deepEqual(reasons(check.explain({ for: rico }).target), ['Wisdom 10 0', 'Trained in Nerve 2', 'Proud 2']);
    assert.deepEqual(check.explain({ for: rico }).actor, []);
  });

  test('gives each viewer the odds they can judge, so the target’s private modifiers are hidden from the actor', () => {
    const { sam, rico, vic } = who(people({ startingTemperament: { pride: 0.9 } }));
    const check = sam.social.intimidate(rico);
    const truth = trueOdds(check);
    const samSees = check.odds({ for: sam });
    for (const odds of [truth, samSees, check.odds({ for: rico }), check.odds({ for: vic })]) close(sum(odds), 1);
    // (Sam does not know Rico is proud, so thinks the threat more likely to work than it is)
    assert.ok(samSees['critical-success'] > truth['critical-success']);
    // (Vic knows nothing private of either, so judges it a plain d20 against a d20)
    const plain = { dice: DICE.d20, edge: 'none' as const, modifiers: [] };
    assert.deepEqual(check.odds({ for: vic }), { ...opposedOdds({ active: plain, passive: plain }), provoked: 0 });
  });

  test('shows anyone present that the target is hurt, where it touches the skill they resist with', () => {
    const hurt = people().character('rico').damage(6);
    const { sam, rico } = who(hurt);
    // (Insight uses Wisdom, which hurt does not touch; Nerve with a higher Constitution does)
    assert.deepEqual(reasons(sam.social.persuade(rico).explain({ for: sam }).target), []);
    const tough = people({ attributes: attributeScores({ con: 14 }) }).character('rico').damage(7);
    assert.deepEqual(reasons(tough.character('sam').social.intimidate(tough.character('rico')).explain({ for: tough.character('vic') }).target), ['Hurt -2']);
  });

  test('keeps a target’s other effects private, and shows what they wear to everyone', () => {
    const shaken = people().character('rico').affect('shaken');
    const s = who(shaken);
    assert.deepEqual(reasons(s.sam.social.intimidate(s.rico).explain({ for: s.rico }).target), ['Wisdom 10 0', 'Shaken -2']);
    assert.deepEqual(reasons(s.sam.social.intimidate(s.rico).explain({ for: s.sam }).target), []);
    const suited = cast({ characters: [{ id: 'sam', name: 'Sam', inventory: { items: [{ item: 'good-suit', state: 'worn' }] } }, { id: 'rico', name: 'Rico' }] });
    assert.deepEqual(reasons(suited.character('sam').social.persuade(suited.character('rico')).explain({ for: suited.character('rico') }).actor), ['Good suit 1']);
  });

  test('counts the actor’s feelings only for the actor', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam', relationships: { rico: { ...NEW_RELATIONSHIP, affection: 0.9 } } }, { id: 'rico', name: 'Rico' }] });
    const threat = c.character('sam').social.intimidate(c.character('rico'));
    assert.deepEqual(reasons(threat.explain({ for: c.character('sam') }).actor).at(-1), 'Sam is fond of Rico -1');
    assert.deepEqual(threat.explain({ for: c.character('rico') }).actor, []);
  });

  test('takes situational modifiers, known to all, without changing the check they were added to', () => {
    const { sam, rico, vic } = who(people());
    const plain = sam.social.persuade(rico);
    const leaned = plain.with({ value: -3, reason: 'Rico has the police outside' });
    assert.deepEqual(reasons(leaned.explain({ for: vic }).actor), ['Rico has the police outside -3']);
    assert.deepEqual(plain.explain({ for: vic }).actor, []);
  });

  test('counts feelings only for the one who has them', () => {
    const c = people({ relationships: { sam: { ...NEW_RELATIONSHIP, fear: 0.8 } } });
    const { sam, rico, vic } = who(c);
    const check = sam.social.intimidate(rico);
    assert.deepEqual(reasons(check.explain({ for: rico }).actor), ['Rico fears Sam 2']);
    assert.ok(!reasons(check.explain({ for: sam }).actor).includes('Rico fears Sam 2'));
    assert.equal(check.explain({ for: vic }).actor.length, 0);
  });

  test('is refused on oneself, on or by someone unconscious, or on someone from another cast', () => {
    const { sam, rico } = who(people());
    assert.throws(() => sam.social.persuade(sam), RangeError);
    const out = people().character('rico').damage(10);
    assert.throws(() => out.character('sam').social.persuade(out.character('rico')), RangeError);
    assert.throws(() => out.character('rico').social.persuade(out.character('sam')), RangeError);
    assert.throws(() => sam.social.persuade(people().character('rico')), RangeError);
    assert.throws(() => sam.social.persuade(rico).odds({ for: people().character('vic') }), RangeError);
  });
});

describe('weapons on intimidation', { tags: ['unit'] }, () => {
  test('a shown weapon outclassing what the target carries is a modifier; a carried one is not', () => {
    const { sam, rico } = who(people());
    assert.equal(sam.social.intimidate(rico).explain({ for: sam }).actor.length, 2);
    const shown = people().character('sam').show('pistol');
    assert.deepEqual(reasons(shown.character('sam').social.intimidate(shown.character('rico')).explain({ for: shown.character('vic') }).actor), ['Pistol against no weapon 4']);
  });

  test('only the target knows they carry an answer to it; anyone else judges by what they show', () => {
    const armed = people({ inventory: { items: ['knife'] } }).character('sam').show('pistol');
    const { sam, rico } = who(armed);
    const check = sam.social.intimidate(rico);
    assert.deepEqual(reasons(check.explain({ for: sam }).actor).at(-1), 'Pistol against no weapon 4');
    assert.deepEqual(reasons(check.explain({ for: rico }).actor), ['Pistol against a knife 2']);
    const answered = people({ inventory: { items: ['pistol'] } }).character('sam').show('pistol');
    const both = who(answered);
    assert.deepEqual(both.sam.social.intimidate(both.rico).explain({ for: both.rico }).actor, []);
    assert.ok(trueOdds(both.sam.social.intimidate(both.rico))['critical-success'] < both.sam.social.intimidate(both.rico).odds({ for: both.sam })['critical-success']);
  });
});

describe('what the target knows on intimidation', { tags: ['unit'] }, () => {
  test('having seen the actor be violent is +2, known to the target and to anyone who saw it with them', () => {
    const c = people().record({ kind: 'beating', actor: 'sam', victim: 'vic' }, { now: 0, witnesses: ['rico', 'joe'] }).cast;
    const { sam, rico, joe, vic } = who(c);
    const check = sam.social.intimidate(rico);
    assert.ok(reasons(check.explain({ for: rico }).actor).includes('Rico has seen Sam being violent 2'));
    assert.ok(reasons(check.explain({ for: joe }).actor).includes('Rico has seen Sam being violent 2'));
    assert.ok(reasons(check.explain({ for: sam }).actor).includes('Rico has seen Sam being violent 2'));
    assert.ok(reasons(check.explain({ for: vic }).actor).includes('Rico has seen Sam being violent 2'));
  });

  test('having heard of it is +1, known to the target and to whoever told them', () => {
    const recorded = people().record({ kind: 'beating', actor: 'sam', victim: 'vic' }, { now: 0, witnesses: ['joe'] }).cast;
    const told = recorded.character('joe').social.tell(recorded.character('rico'), 'f1').roll(scripted(), { now: 10 }).cast;
    const { sam, rico, joe, vic } = who(told);
    const check = sam.social.intimidate(rico);
    assert.ok(reasons(check.explain({ for: rico }).actor).includes('Rico has heard of Sam being violent 1'));
    assert.ok(reasons(check.explain({ for: joe }).actor).includes('Rico has heard of Sam being violent 1'));
    assert.ok(!reasons(check.explain({ for: sam }).actor).some((r) => r.includes('violent')));
    assert.equal(check.explain({ for: vic }).actor.length, 0);
  });

  test('only the best counts, and a fact that is not violent counts nothing', () => {
    const c = people().record({ kind: 'beating', actor: 'sam', victim: 'vic' }, { now: 0, witnesses: ['rico'] }).cast.record({ kind: 'robbery', actor: 'sam', victim: 'joe' }, { now: 5, witnesses: ['rico'] }).cast;
    const told = c.record({ kind: 'theft', actor: 'sam', victim: 'joe' }, { now: 6, witnesses: ['rico'] }).cast;
    const { sam, rico } = who(told);
    assert.deepEqual(reasons(sam.social.intimidate(rico).explain({ for: rico }).actor).filter((r) => r.includes('violent')), ['Rico has seen Sam being violent 2']);
  });
});

describe('rolling an intimidation', { tags: ['unit'] }, () => {
  // Sam rolls d20 + 4 against Rico's d20 + 0, with Joe watching.
  const roll = (active: number, passive: number, rico: Record<string, unknown> = {}) => {
    const { sam, rico: r } = who(people(rico));
    return sam.social.intimidate(r).roll(scripted(active, passive), { now: 60, witnesses: ['joe'] });
  };

  test('a success: the target gives in and is shaken, fears the actor more and trusts them less; the actor respects them less', () => {
    const out = roll(14, 10);
    assert.equal(out.truth.ending, 'success');
    const { sam, rico, joe } = who(out.cast);
    assert.deepEqual(rico.condition.effects, ['shaken']);
    const ricoOnSam = rico.towards(sam)!;
    close(ricoOnSam.fear, 0.1);
    close(ricoOnSam.grudge, 0.05);
    close(ricoOnSam.trust, 0.45);
    close(sam.towards(rico)!.respect, 0.45);
    assert.deepEqual(ricoOnSam.grudgeReason, { fact: 'f1', at: 60, amount: ricoOnSam.grudge });
    assert.deepEqual(out.truth.facts, [{ kind: 'threat', actor: 'sam', victim: 'rico', ending: 'success', id: 'f1', at: 60, witnesses: ['joe'] }]);
    assert.deepEqual(joe.versionOf('f1'), { learnedAt: 60, source: 'witness', how: 'seen', knowsActor: true });
    close(joe.towards(sam)!.respect, 0.5 + 0.002 * 0.5);
  });

  test('a critical success frightens the target more and leaves no grudge', () => {
    const out = roll(17, 2);
    assert.equal(out.truth.ending, 'critical-success');
    const ricoOnSam = out.cast.character('rico').towards(out.cast.character('sam'))!;
    close(ricoOnSam.fear, 0.15);
    assert.equal(ricoOnSam.grudge, 0);
  });

  test('a failure: the target resists, respects the actor less, and the actor respects them more', () => {
    const out = roll(10, 14);
    assert.equal(out.truth.ending, 'failure');
    const { sam, rico } = who(out.cast);
    assert.deepEqual(rico.condition.effects, []);
    close(rico.towards(sam)!.respect, 0.45);
    close(sam.towards(rico)!.respect, 0.5 + 0.05 * 0.5);
  });

  test('a critical failure provokes a volatile target, who holds a grudge; the caller decides whether it comes to a fight', () => {
    const out = roll(1, 18, { startingTemperament: { volatility: 0.9 } });
    assert.equal(out.truth.ending, 'provoked');
    close(out.cast.character('rico').towards(out.cast.character('sam'))!.grudge, 0.1);
    assert.equal(roll(1, 18).truth.ending, 'critical-failure');
  });

  test('only the target can see that they could be provoked', () => {
    const { sam, rico, joe } = who(people({ startingTemperament: { volatility: 0.9 } }));
    const check = sam.social.intimidate(rico);
    assert.ok(check.odds({ for: rico }).provoked > 0);
    assert.equal(check.odds({ for: rico })['critical-failure'], 0);
    assert.equal(check.odds({ for: sam }).provoked, 0);
    assert.equal(check.odds({ for: joe }).provoked, 0);
    assert.ok(trueOdds(check).provoked > 0);
  });

  test('gives the target the exact ending, and anyone else how it looked', () => {
    const out = roll(11, 10);
    assert.equal(out.truth.ending, 'partial');
    const { sam, rico, joe } = who(out.cast);
    assert.equal(out.result({ for: rico }).ending, 'partial');
    assert.equal(out.result({ for: sam }).ending, 'gives in');
    assert.equal(out.result({ for: joe }).ending, 'gives in');
    assert.throws(() => out.result({ for: people().character('sam') }), RangeError);
  });

  test('is refused from a replaced cast', () => {
    const c = people();
    const check = c.character('sam').social.intimidate(c.character('rico'));
    check.roll(scripted(10, 10), { now: 0 });
    assert.throws(() => check.roll(scripted(10, 10), { now: 0 }), ReplacedCastError);
  });
});

describe('rolling a persuasion', { tags: ['unit'] }, () => {
  const roll = (active: number, passive: number) => {
    const { sam, rico } = who(people());
    return sam.social.persuade(rico).roll(scripted(active, passive), { now: 0 });
  };

  test('a success raises the target’s trust, damped by how little they know the persuader', () => {
    const out = roll(17, 2);
    assert.ok(['success', 'critical-success'].includes(out.truth.ending));
    const met = meet(NEW_RELATIONSHIP, 0);
    close(out.cast.character('rico').towards(out.cast.character('sam'))!.trust, feel(met, 'trust', 0.05, { now: 0 }).trust);
    assert.equal(out.truth.facts[0]!.kind, 'persuasion');
    assert.equal(out.result({ for: out.cast.character('sam') }).ending, 'agrees');
  });

  test('a critical failure lowers it; a partial success or failure leaves it', () => {
    const failed = roll(1, 18).cast;
    close(failed.character('rico').towards(failed.character('sam'))!.trust, 0.48);
    const partial = roll(11, 10);
    assert.equal(partial.truth.ending, 'partial');
    assert.equal(partial.cast.character('rico').towards(partial.cast.character('sam'))!.trust, 0.5);
  });
});

describe('a lie about who did it', { tags: ['unit'] }, () => {
  // Sam (Charisma 14, Deception +2) lies to Rico (Insight +0) that Joe robbed Vic, which Sam did.
  const robbed = () => people().record({ kind: 'robbery', actor: 'sam', victim: 'vic', hiddenActor: true }, { now: 0 }).cast;
  const lie = (c: Cast, active: number, passive: number) =>
    c.character('sam').social.deceive(c.character('rico')).claim({ about: 'f1', blame: 'joe' }).roll(scripted(active, passive), { now: 30, witnesses: ['vic'] });

  test('believed by someone who did not know of it: they learn it as told by the liar, and their feelings follow whom they blame', () => {
    const out = lie(robbed(), 15, 5);
    assert.ok(['success', 'critical-success'].includes(out.truth.ending));
    const { rico, joe } = who(out.cast);
    assert.deepEqual(rico.versionOf('f1'), { learnedAt: 30, source: 'told', teller: 'sam', how: 'told', knowsActor: false, blame: 'joe' });
    close(rico.towards(joe)!.fear, 0.02 * 0.5);
  });

  test('records the lie, known only to the liar, as caused by the fact it is about; witnesses learn nothing from it', () => {
    const out = lie(robbed(), 15, 5);
    const [made] = out.truth.facts;
    assert.deepEqual(made, { kind: 'lie', actor: 'sam', victim: 'rico', ending: out.truth.ending, cause: 'f1', claim: { blame: 'joe' }, id: 'f2', at: 30, witnesses: [] });
    const { sam, rico, vic } = who(out.cast);
    assert.ok(sam.versionOf('f2'));
    assert.equal(rico.versionOf('f2'), undefined);
    assert.equal(vic.versionOf('f2'), undefined);
    assert.equal(vic.towards(sam)!.lastMet, 30);
  });

  test('not believed: nothing changes but the lie being recorded; seen through: the target knows, trusts the liar less and holds a grudge', () => {
    const failed = lie(robbed(), 5, 9);
    assert.equal(failed.truth.ending, 'failure');
    assert.equal(failed.cast.character('rico').versionOf('f1'), undefined);
    assert.equal(failed.result({ for: failed.cast.character('sam') }).ending, 'no sign');
    const caught = lie(robbed(), 1, 18);
    assert.equal(caught.truth.ending, 'critical-failure');
    const { sam, rico } = who(caught.cast);
    assert.deepEqual(rico.versionOf('f2'), { learnedAt: 30, source: 'witness', how: 'seen', knowsActor: true });
    close(rico.towards(sam)!.trust, 0.35);
    close(rico.towards(sam)!.grudge, 0.05);
    assert.equal(caught.result({ for: sam }).ending, 'sees through it');
  });

  test('gets no modifier from someone who knows of it but not who did it, and blames no one', () => {
    const c = robbed();
    const check = c.character('sam').social.deceive(c.character('vic')).claim({ about: 'f1', blame: 'joe' });
    // (Vic would see any modifier from their own knowledge, and Sam's skill is private to Sam)
    assert.deepEqual(check.explain({ for: c.character('vic') }).actor, []);
  });

  test('cannot fool someone who saw it, and anyone who saw it with them knows that', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'vic' }, { now: 0, witnesses: ['rico'] }).cast;
    const { sam, rico, joe, vic } = who(c);
    const check = sam.social.deceive(rico).claim({ about: 'f1', blame: 'joe' });
    assert.ok(reasons(check.explain({ for: vic }).actor).includes(`Rico saw it themselves ${IMPOSSIBLE}`));
    assert.equal(check.explain({ for: joe }).actor.length, 0);
    for (const e of ['partial', 'success', 'critical-success'] as const) assert.equal(trueOdds(check)[e], 0);
  });

  test('is −4 against what a witness told them, −2 against what they heard, and +2 for matching what they believe', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'vic' }, { now: 0, witnesses: ['joe'] }).cast;
    const told = c.character('joe').social.tell(c.character('rico'), 'f1').roll(scripted(), { now: 5 }).cast;
    const { sam, rico, joe } = who(told);
    assert.deepEqual(reasons(sam.social.deceive(rico).claim({ about: 'f1', blame: 'joe' }).explain({ for: joe }).actor), ['A witness told Rico who did it -4']);
    const withAl = told.add({ id: 'al', name: 'Al' });
    const heard = withAl.character('rico').social.tell(withAl.character('al'), 'f1').roll(scripted(), { now: 6 }).cast;
    const h = heard.character('sam').social.deceive(heard.character('al')).claim({ about: 'f1', blame: 'joe' });
    assert.deepEqual(reasons(h.explain({ for: heard.character('al') }).actor).at(-1), 'Al heard who did it -2');
    const blaming = lie(robbed(), 15, 5).cast;
    const again = blaming.character('sam').social.deceive(blaming.character('rico')).claim({ about: 'f1', blame: 'joe' });
    assert.deepEqual(reasons(again.explain({ for: blaming.character('rico') }).actor).at(-1), 'The lie matches what Rico believes 2');
  });

  test('changes a belief someone already held, and their feelings turn on the one now blamed, without undoing the old', () => {
    const blaming = lie(robbed(), 15, 5).cast;
    const before = blaming.character('rico').towards(blaming.character('joe'))!;
    const turned = blaming.character('sam').social.deceive(blaming.character('rico')).claim({ about: 'f1', blame: 'vic' }).roll(scripted(15, 5), { now: 40 });
    assert.equal(turned.truth.ending, 'success');
    const { rico, joe } = who(turned.cast);
    assert.equal(rico.versionOf('f1')!.blame, 'vic');
    assert.deepEqual(rico.towards(joe), before);
    const fresh = lie(robbed(), 15, 5).cast;
    const other = fresh.character('sam').social.deceive(fresh.character('rico')).claim({ about: 'f1', exaggerated: true }).roll(scripted(19, 1), { now: 40 });
    assert.equal(other.cast.character('rico').versionOf('f1')!.exaggerated, true);
    assert.equal(other.cast.character('rico').versionOf('f1')!.blame, 'joe');
  });
});

describe('a lie about a fact that never happened', { tags: ['unit'] }, () => {
  test('records it as invented, known false only by the liar, and believed it is learned as told', () => {
    const { sam, rico } = who(people());
    const out = sam.social.deceive(rico).claim({ invented: { kind: 'robbery', actor: 'joe', victim: 'vic' } }).roll(scripted(15, 5), { now: 0 });
    const [invented, lie] = out.truth.facts;
    assert.deepEqual(invented, { kind: 'robbery', actor: 'joe', victim: 'vic', invented: 'sam', id: 'f1', at: 0, witnesses: [] });
    assert.equal(lie!.cause, 'f1');
    const c = who(out.cast);
    assert.equal(c.sam.versionOf('f1')!.knownFalse, true);
    assert.deepEqual(c.rico.versionOf('f1'), { learnedAt: 0, source: 'told', teller: 'sam', how: 'told', knowsActor: true });
    assert.equal(c.joe.versionOf('f1'), undefined);
    assert.equal(c.vic.versionOf('f1'), undefined);
    close(c.rico.towards(c.joe)!.fear, 0.01);
  });

  test('not believed, it is still recorded, and only the liar knows of it', () => {
    const { sam, rico } = who(people());
    const out = sam.social.deceive(rico).claim({ invented: { kind: 'theft', actor: 'joe' } }).roll(scripted(2, 15), { now: 0 });
    assert.equal(out.cast.facts.length, 2);
    assert.equal(out.cast.character('rico').versionOf('f1'), undefined);
  });

  test('cannot fool the one it claims was involved', () => {
    const { sam, rico } = who(people());
    const check = sam.social.deceive(rico).claim({ invented: { kind: 'robbery', actor: 'joe', victim: 'rico' } });
    assert.ok(reasons(check.explain({ for: sam }).actor).some((r) => r.startsWith('Rico would know')));
  });
});

describe('a lie that cannot be told', { tags: ['unit'] }, () => {
  test('is refused without a claim', () => {
    const c = people();
    const setup = { action: 'deceive' as const, data: c.data, actor: c.character('sam').data, target: c.character('rico').data, extra: [] };
    assert.throws(() => socialCheck(setup, c, () => c), RangeError);
  });

  test('is refused: no claim, a fact the liar does not know, the truth, a fact the liar invented, or an unknown kind or person', () => {
    const c = people().record({ kind: 'robbery', actor: 'sam', victim: 'vic' }, { now: 0 }).cast;
    const { sam, rico } = who(c);
    assert.throws(() => rico.social.deceive(sam).claim({ about: 'f1', blame: 'joe' }), RangeError);
    assert.throws(() => sam.social.deceive(rico).claim({ about: 'f1', blame: 'sam' }), RangeError);
    assert.throws(() => sam.social.deceive(rico).claim({ about: 'f1', exaggerated: false }), RangeError);
    assert.throws(() => sam.social.deceive(rico).claim({ about: 'f1', blame: 'nobody' }), RangeError);
    assert.throws(() => sam.social.deceive(rico).claim({ invented: { kind: 'picnic' as never } }), RangeError);
    assert.throws(() => sam.social.deceive(rico).claim({ about: 'f9', blame: 'joe' }), RangeError);
    const invented = sam.social.deceive(rico).claim({ invented: { kind: 'theft', actor: 'joe' } }).roll(scripted(2, 15), { now: 1 }).cast;
    assert.throws(() => invented.character('sam').social.deceive(invented.character('rico')).claim({ about: 'f2', blame: 'vic' }), RangeError);
  });
});

describe('social checks', { tags: ['property'] }, () => {
  test('give every viewer odds that add up to 1', () => {
    fc.assert(
      fc.property(fc.constantFrom('intimidate', 'persuade') , fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (action, pride, fear) => {
        const c = people({ startingTemperament: { pride, volatility: fear }, relationships: { sam: { ...NEW_RELATIONSHIP, fear } } });
        const { sam, rico, joe } = who(c);
        const check = sam.social[action](rico);
        for (const odds of [trueOdds(check), check.odds({ for: sam }), check.odds({ for: rico }), check.odds({ for: joe })]) close(Math.round(sum(odds) * 1e9) / 1e9, 1);
      }),
    );
  });
});

describe('social checks', { tags: ['statistical'] }, () => {
  test('end as often as their true odds say', () => {
    const c = people({ startingTemperament: { volatility: 0.9, pride: 0.8 }, inventory: { items: ['knife'] } }).character('sam').show('pistol');
    const check = c.character('sam').social.intimidate(c.character('rico'));
    const odds = trueOdds(check);
    const r = roller(seeded(5));
    const seen = Object.fromEntries(ENDINGS.map((e) => [e, 0])) as Record<Ending, number>;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      // (a roll replaces the cast it came from, so each sample rolls from a fresh cast over the same record)
      const fresh = castOf(c.data);
      seen[fresh.character('sam').social.intimidate(fresh.character('rico')).roll(r, { now: 0 }).truth.ending]++;
    }
    for (const e of ENDINGS) assert.ok(Math.abs(seen[e] / n - odds[e]) < 0.02, `${e}: seen ${seen[e] / n}, expected ${odds[e]}`);
  });
});
