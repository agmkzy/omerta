import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { createCharacter, type Character } from '../src/character';
import { DICE } from '../src/dice';
import { type FightSpec, type RollRequest } from '../src/fight';
import { describeFightEvent, describeRollRequest, explainRoll, fightRules } from '../src/fight-log';
import { stepFight } from '../src/fight-step';
import { temperament } from '../src/temperament';
import { fightWith, type FightRolls } from './support';

const attacker = (name = 'A') => createCharacter({ name, training: { brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}, name = 'D'): Character => createCharacter({ name, temperament: temperament(t) });
const frail = (name: string) => createCharacter({ name, attributes: attributeScores({ con: 1 }) });
const duel = (over: Partial<FightSpec> = {}): FightSpec => ({ attackers: [attacker()], defenders: [defender()], maxRounds: 1, ...over });
const oneAgainstTwo: FightSpec = { attackers: [attacker()], defenders: [defender({}, 'C'), defender({}, 'E')], maxRounds: 1 };

function requestAt(s: FightSpec, ...faces: number[]): RollRequest {
  const step = stepFight(s, faces);
  if (step.done) throw new assert.AssertionError({ message: 'expected the fight to be waiting for a roll' });
  return step.request;
}
const ask = (s: FightSpec, ...faces: number[]) => describeRollRequest(requestAt(s, ...faces));
const explain = (s: FightSpec, ...faces: number[]) => explainRoll(requestAt(s, ...faces));
const log = (s: FightSpec, rolls: FightRolls, rollNumbers = true) => {
  const r = fightWith(s, rolls);
  return r.events.map((e) => describeFightEvent(e, r.fighters, { rolls: rollNumbers }));
};

describe('describeFightEvent', { tags: ['unit'] }, () => {
  test('says each thing once: turn order, hits, misses and the result', () => {
    assert.deepEqual(log(duel(), { initiative: [15, 10], attack: [8, 9], damage: [3] }), [
      'Turn order: A (15), D (10).',
      'A hits D: 3 damage, 7 HP left (rolled 10 vs Defence 10).',
      'D misses A (rolled 9 vs Defence 10).',
      'Stalemate: the round limit was reached.',
    ]);
  });

  test('names natural 20s and 1s instead of the total, and describes nerve checks', () => {
    assert.deepEqual(log(duel(), { initiative: [15, 10], attack: [20, 1], damage: [2, 3], nerve: [20] }).slice(1, 4), [
      'A lands a critical hit on D: 5 damage, 5 HP left (natural 20).',
      'D is at half HP and holds their nerve (rolled 20 vs 10).',
      'D misses A (natural 1).',
    ]);
    assert.equal(log(duel(), { initiative: [15, 10], attack: [20], damage: [2, 3], nerve: [1] })[2], 'D is at half HP and loses their nerve (rolled 1 vs 10).');
  });

  test('can leave out the numbers when the dice are shown separately, keeping natural 20s and 1s', () => {
    assert.deepEqual(log(duel(), { initiative: [15, 10], attack: [8, 9], damage: [3] }, false).slice(0, 3), ['Turn order: A, D.', 'A hits D: 3 damage, 7 HP left.', 'D misses A.']);
    assert.deepEqual(log(duel(), { initiative: [15, 10], attack: [20, 1], damage: [2, 3], nerve: [20] }, false).slice(1, 4), [
      'A lands a critical hit on D: 5 damage, 5 HP left (natural 20).',
      'D is at half HP and holds their nerve.',
      'D misses A (natural 1).',
    ]);
  });

  test('names the highest and lowest possible rolls on other dice', () => {
    assert.deepEqual(log(duel({ dice: DICE['3d6'] }), { initiative: [4, 4, 4, 3, 3, 3], attack: [6, 6, 6, 1, 1, 1], damage: [1, 1] }).slice(1, 3), [
      'A lands a critical hit on D: 2 damage, 8 HP left (highest possible roll (18)).',
      'D misses A (lowest possible roll (3)).',
    ]);
  });

  test('describes fighters leaving, the group nerve check and the winner', () => {
    const party = { attackers: [attacker()], defenders: [frail('F'), defender({}, 'D')], maxRounds: 2 };
    assert.deepEqual(log(party, { initiative: [15, 10, 10], target: [1], attack: [20], damage: [4, 4], nerve: [1] }).slice(2), [
      'F is knocked out.',
      'D sees half their side out of the fight and loses their nerve (rolled 1 vs 10).',
      'D surrenders.',
      'Left wins.',
    ]);
    assert.equal(log(duel(), { initiative: [5, 15], attack: [20], damage: [2, 3], nerve: [1] }).slice(-2).join(' '), 'A backs off. Right wins.');
    assert.equal(log(duel({ defenders: [defender({ courage: 0.1 })] }), { initiative: [15, 10], attack: [20], damage: [2, 3], nerve: [9] }).at(-2), 'D flees.');
  });

  test('throws for a fighter that is not in the fight', () => {
    const r = fightWith(duel(), { initiative: [15, 10], attack: [1, 1] });
    assert.throws(() => describeFightEvent(r.events[0]!, r.fighters.slice(0, 1)), RangeError);
  });
});

describe('describeRollRequest', { tags: ['unit'] }, () => {
  test('says what each roll is for, what it needs and the chance', () => {
    assert.equal(ask(duel()), 'A rolls initiative: d20 + 0.');
    assert.equal(ask(duel(), 15, 10), 'A attacks D: d20 + 2 against Defence 10. Needs 8 or more to hit (65%).');
    assert.equal(ask(duel(), 15, 10, 8), 'A rolls damage against D: 1d4.');
    assert.equal(ask(duel(), 15, 10, 20), 'A rolls damage for a critical hit against D: 2d4.');
    assert.equal(ask(duel(), 15, 10, 20, 2, 3), 'D is at half HP and must hold their nerve: d20 + 0 against 10. Needs 10 or more (55%).');
  });

  test('says when an attack has advantage, and why', () => {
    assert.equal(ask(oneAgainstTwo, 15, 10, 10, 2, 1, 1), 'E attacks A with advantage (someone else is already attacking them): d20 + 0 against Defence 10. Needs 10 or more on either die (80%).');
  });

  test('lists the options when choosing a target', () => {
    assert.equal(ask(oneAgainstTwo, 15, 10, 10), 'A picks who to attack: 1 = C, 2 = E.');
  });

  test('describes the group nerve check and damage with a modifier', () => {
    const strong = createCharacter({ name: 'S', attributes: attributeScores({ str: 16 }), training: { brawling: 'trained' } });
    assert.equal(ask(duel({ attackers: [strong] }), 15, 10, 8), 'S rolls damage against D: 1d4 + 3.');
    assert.equal(ask({ attackers: [attacker()], defenders: [frail('F'), defender({}, 'E')], maxRounds: 2 }, 15, 10, 10, 1, 20, 4, 4),
      'E sees half their side out of the fight and must hold their nerve: d20 + 0 against 10. Needs 10 or more (55%).');
  });

  test('gives the chance but no single number to roll on other dice, and nothing midway through a multi-dice roll', () => {
    assert.equal(ask(duel({ dice: DICE['3d6'] }), 4, 4, 4, 3, 3, 3), 'A attacks D: 3d6 + 2 against Defence 10. 84% to hit.');
    assert.equal(ask(duel({ dice: DICE['3d6'] }), 4, 4, 4, 3, 3, 3, 3), 'A attacks D: 3d6 + 2 against Defence 10 (die 2 of 3).');
  });

  test('shows a negative bonus as a subtraction', () => {
    const slow = createCharacter({ name: 'Slow', attributes: attributeScores({ agi: 8 }) });
    assert.equal(ask(duel({ attackers: [slow] })), 'Slow rolls initiative: d20 − 1.');
  });

  test('gives a nerve check on other dice as a chance, and nothing midway through the roll', () => {
    const s = duel({ dice: DICE['3d6'] }); // A hits with 18 (the highest roll) for 8: D drops to 2 HP
    assert.equal(ask(s, 4, 4, 4, 3, 3, 3, 6, 6, 6, 4, 4), 'D is at half HP and must hold their nerve: 3d6 + 0 against 10. 63% to hold.');
    assert.equal(ask(s, 4, 4, 4, 3, 3, 3, 6, 6, 6, 4, 4, 5), 'D is at half HP and must hold their nerve: 3d6 + 0 against 10 (die 2 of 3).');
  });

  test('says when a nerve check cannot fail, or cannot pass', () => {
    const steady = createCharacter({ name: 'Steady', attributes: attributeScores({ wis: 20 }), training: { nerve: 'expert' }, temperament: temperament({ courage: 0.9 }) }); // +11
    assert.equal(ask(duel({ defenders: [steady] }), 15, 10, 20, 4, 4), 'Steady is at half HP and must hold their nerve: d20 + 11 against 10. Holds whatever the roll.');
    const hopeless: RollRequest = { sides: 20, dice: DICE.d20, reason: { kind: 'nerve', by: { id: 'B1', name: 'D' }, trigger: 'hurt', modifiers: [{ value: -30, reason: 'Test' }], dc: 10, die: 1, of: 1 } };
    assert.equal(describeRollRequest(hopeless), 'D is at half HP and must hold their nerve: d20 − 30 against 10. Cannot hold, whatever the roll.');
  });
});

describe('explainRoll', { tags: ['unit'] }, () => {
  test('initiative: what it is for, and where the bonus comes from', () => {
    const slow = createCharacter({ name: 'Slow', attributes: attributeScores({ agi: 8 }), training: { reflexes: 'trained' } });
    const e = explain(duel({ attackers: [slow] }));
    assert.match(e.purpose, /^Initiative decides who acts first/);
    assert.deepEqual([e.bonusLabel, e.bonus, e.against], ['Slow’s initiative bonus', [{ value: -1, reason: 'Agility 8' }, { value: 2, reason: 'Trained in Reflexes' }], null]);
  });

  test('an attack: the Brawling bonus and the target’s Defence, each part with its reason', () => {
    const nimble = createCharacter({ name: 'Nimble', attributes: attributeScores({ agi: 14 }), training: { reflexes: 'trained' } });
    const e = explain(duel({ defenders: [nimble] }), 15, 10);
    assert.match(e.purpose, /Meeting or beating it is a hit/);
    assert.deepEqual([e.bonusLabel, e.bonus], ['A’s attack bonus', [{ value: 0, reason: 'Strength 10' }, { value: 2, reason: 'Trained in Brawling' }]]);
    assert.deepEqual(e.against, { label: 'Nimble’s Defence', total: 14, parts: { base: 10, modifiers: [{ value: 2, reason: 'Agility 14' }, { value: 2, reason: 'Trained in Reflexes' }] } });
  });

  test('the bonus is exactly the modifiers the roll adds', () => {
    const request = requestAt(duel(), 15, 10);
    assert.equal(explainRoll(request).bonus, request.reason.kind === 'attack' ? request.reason.modifiers : null);
  });

  test('damage: the Strength modifier', () => {
    const strong = createCharacter({ name: 'S', attributes: attributeScores({ str: 16 }), training: { brawling: 'trained' } });
    const e = explain(duel({ attackers: [strong] }), 15, 10, 8);
    assert.match(e.purpose, /^A hit deals 1d4 plus/);
    assert.deepEqual([e.bonusLabel, e.bonus], ['S’s damage bonus', [{ value: 3, reason: 'Strength 16' }]]);
  });

  test('a nerve check: Nerve and temperament', () => {
    const e = explain(duel({ defenders: [defender({ courage: 0.1 })] }), 15, 10, 20, 2, 3);
    assert.match(e.purpose, /drops to half their hit points/);
    assert.deepEqual([e.bonusLabel, e.bonus], ['D’s nerve bonus', [{ value: 0, reason: 'Wisdom 10' }, { value: -2, reason: 'Timid' }]]);
    const group = explain({ attackers: [attacker()], defenders: [frail('F'), defender({}, 'E')], maxRounds: 2 }, 15, 10, 10, 1, 20, 4, 4);
    assert.match(group.purpose, /half a side is out of the fight/);
  });

  test('an attack with advantage says why', () => {
    assert.match(explain(oneAgainstTwo, 15, 10, 10, 2, 1, 1).purpose, /This attack has advantage, for ganging up/);
  });

  test('names the fight’s dice, and on dice other than a d20 the highest and lowest possible rolls', () => {
    const d20 = explain(duel(), 15, 10).purpose;
    assert.match(d20, /d20 \+ Brawling/);
    assert.match(d20, /A natural 20 always hits/);
    const s = duel({ dice: DICE['3d6'] });
    assert.match(explain(s).purpose, /3d6 \+ Reflexes/);
    const attack = explain(s, 4, 4, 4, 3, 3, 3).purpose;
    assert.match(attack, /3d6 \+ Brawling/);
    assert.match(attack, /The highest possible roll \(18\) always hits and is a critical hit; the lowest possible roll \(3\) always misses/);
    assert.doesNotMatch(attack, /d20|natural/);
    assert.match(explain(s, 4, 4, 4, 3, 3, 3, 6, 6, 6, 4, 4).purpose, /3d6 \+ Nerve/);
  });

  test('choosing a target: no bonus', () => {
    const e = explain(oneAgainstTwo, 15, 10, 10);
    assert.match(e.purpose, /random enemy/);
    assert.deepEqual([e.bonusLabel, e.bonus], [null, []]);
  });
});

describe('fightRules', { tags: ['unit'] }, () => {
  test('are built from the rules’ constants, for the fight’s dice', () => {
    const rules = fightRules(DICE.d20);
    assert.match(rules.attack, /d20 \+ Brawling \(the Strength modifier, plus any Brawling training\) against the target’s Defence \(10 \+ Reflexes\)/);
    assert.match(rules.hitPoints, /^Hit points are 10 \+ the Constitution modifier, plus the proficiency bonus if trained in Toughness \(×2 if expert\)/);
    assert.match(rules.nerveHurt, /Nerve \(the higher of the Wisdom and Constitution modifiers, plus any Nerve training and temperament\) against 10/);
    assert.match(rules.nerveFailure, /someone with low courage or high caution flees/);
    assert.match(fightRules(DICE['2d10']).extremes, /^The highest possible roll \(20\) always hits and is a critical hit; the lowest possible roll \(2\) always misses\.$/);
  });
});
