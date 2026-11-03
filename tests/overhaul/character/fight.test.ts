import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { BACKGROUNDS, rollCharacter } from '../../../src/overhaul/character/backgrounds';
import { ReplacedCastError, cast, castOf, squad } from '../../../src/overhaul/character/cast';
import { createCharacter, type CharacterInput } from '../../../src/overhaul/character/character';
import { NERVE_DC, WEAPON_USE, assertFight, fight, outclasses, type FightEvent, type FightResult, type FightSpec, type FighterResult } from '../../../src/overhaul/character/fight';
import { applyFight } from '../../../src/overhaul/character/fight-record';
import { BEATING_AT_LEAST } from '../../../src/overhaul/character/learning';
import { roller, seeded } from '../../../src/overhaul/character/random';
import { labelled, type FightRolls } from './support';

const close = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const rec = (id: string, over: Partial<CharacterInput> = {}) => createCharacter({ id, name: id[0]!.toUpperCase() + id.slice(1), ...over });
const play = (spec: FightSpec, rolls: FightRolls): FightResult => {
  const r = labelled(rolls);
  const result = fight(spec, r);
  assert.deepEqual(r.unused(), {}, 'not every scripted face was used');
  return result;
};
const statuses = (r: FightResult) => Object.fromEntries(r.fighters.map((f) => [f.id, f.status]));
const of = <K extends FightEvent['kind']>(r: FightResult, kind: K) => r.events.filter((e): e is Extract<FightEvent, { kind: K }> => e.kind === kind);
const fighter = (r: FightResult, id: string) => r.fighters.find((f) => f.id === id)!;

describe('the fight rules', { tags: ['unit'] }, () => {
  test('give each weapon its skill and damage, and rank them', () => {
    assert.deepEqual(WEAPON_USE, {
      none: { skill: 'brawling', count: 1, sides: 4, strength: true },
      knife: { skill: 'brawling', count: 1, sides: 6, strength: true },
      pistol: { skill: 'firearms', count: 2, sides: 6, strength: false },
    });
    assert.deepEqual([outclasses('knife', 'none'), outclasses('pistol', 'knife'), outclasses('knife', 'knife'), outclasses('none', 'knife')], [true, true, false, false]);
    assert.deepEqual([NERVE_DC.knife, NERVE_DC.pistol, NERVE_DC.hurt], [12, 15, 10]);
  });

  test('refuse a fight that cannot be fought', () => {
    const [a, b] = [rec('sam'), rec('rico')];
    assert.throws(() => assertFight({ attackers: [], defenders: [b], kind: 'real' }), RangeError);
    assert.throws(() => assertFight({ attackers: [a], defenders: [a], kind: 'real' }), RangeError);
    assert.throws(() => assertFight({ attackers: [a, a], defenders: [b], kind: 'real' }), RangeError);
    assert.throws(() => assertFight({ attackers: [a], defenders: [rec('rico', { condition: { hitPoints: 0 } })], kind: 'real' }), RangeError);
    assert.throws(() => assertFight({ attackers: [a], defenders: [b], kind: 'sparring', start: 'ambush' }), RangeError);
    assert.throws(() => assertFight({ attackers: [a], defenders: [b], kind: 'real', maxRounds: 0 }), RangeError);
    assert.doesNotThrow(() => assertFight({ attackers: [a], defenders: [rec('rico', { condition: { hitPoints: 0 } })], kind: 'sparring' }));
  });
});

describe('a real fight', { tags: ['unit'] }, () => {
  // Sam (Strength 14) against Rico (Constitution 6, so 8 hit points); everyone else is average.
  const sam = rec('sam', { attributes: attributeScores({ str: 14 }) });
  const rico = rec('rico', { attributes: attributeScores({ con: 6 }) });

  test('goes in initiative order; a hit deals 1d4 + Strength, and half health means a nerve check', () => {
    const r = play({ attackers: [sam], defenders: [rico], kind: 'real' }, { initiative: [15, 5], attack: [12], damage: [2], nerve: [5] });
    assert.deepEqual(of(r, 'initiative')[0]!.order, ['sam', 'rico']);
    assert.deepEqual(of(r, 'attack').map((e) => [e.by, e.hit, e.damage, e.hp]), [['sam', 'hit', 4, 4]]);
    assert.deepEqual(of(r, 'nerve').map((e) => [e.id, e.trigger, e.check.passed]), [['rico', 'hurt', false]]);
    assert.equal(r.winner, 'attacker');
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'beaten' });
    assert.deepEqual(fighter(r, 'rico'), { id: 'rico', side: 'defender', weapon: 'none', startHp: 8, hp: 4, maxHp: 8, status: 'beaten', attackedBy: [{ id: 'sam', damage: 4 }], endedAt: 3, lostNerve: true, reactions: ['giving-in-in-a-fight'] });
  });

  test('puts defenders first on a tied initiative', () => {
    const r = play({ attackers: [rec('sam')], defenders: [rec('rico')], kind: 'real', maxRounds: 1 }, { initiative: [9, 9], attack: [2, 2] });
    assert.deepEqual(of(r, 'initiative')[0]!.order, ['rico', 'sam']);
    assert.equal(r.winner, null);
  });

  test('the highest roll always hits and doubles the damage dice; the lowest always misses', () => {
    const mighty = rec('rico', { attributes: attributeScores({ str: 20 }), training: { brawling: 'expert' } });
    const r = play({ attackers: [sam], defenders: [mighty], kind: 'real', maxRounds: 1 }, { initiative: [15, 5], attack: [20, 1], damage: [1, 1] });
    assert.deepEqual(of(r, 'attack').map((e) => [e.by, e.hit, e.damage]), [['sam', 'critical', 4], ['rico', 'miss', 0]]);
  });

  test('a knife deals 1d6 + Strength with Brawling; a pistol 2d6 with Firearms, without Strength', () => {
    const knife = rec('sam', { attributes: attributeScores({ str: 14 }), inventory: { items: ['knife'] } });
    const k = play({ attackers: [knife], defenders: [rec('rico', { inventory: { items: ['knife'] } })], kind: 'real', maxRounds: 1 }, { initiative: [15, 5], attack: [10, 2], damage: [6], nerve: [15] });
    assert.deepEqual(of(k, 'attack')[0]!.damage, 8);
    const pistol = rec('sam', { attributes: attributeScores({ str: 14, agi: 14 }), inventory: { items: ['pistol'] } });
    const p = play({ attackers: [pistol], defenders: [rico], kind: 'real' }, { initiative: [15, 5], nerve: [15, 2], attack: [8], damage: [3, 4] });
    assert.deepEqual(of(p, 'attack').map((e) => [e.result.roll.modifiers.map((m) => m.reason), e.damage]), [[['Agility 14'], 7]]);
  });

  test('a minimum of 1 damage is dealt', () => {
    const weak = rec('sam', { attributes: attributeScores({ str: 3 }) });
    const r = play({ attackers: [weak], defenders: [rec('rico')], kind: 'real', maxRounds: 1 }, { initiative: [15, 5], attack: [15, 2], damage: [1] });
    assert.equal(of(r, 'attack')[0]!.damage, 1);
  });
});

describe('nerve at the start of a real fight', { tags: ['unit'] }, () => {
  test('anyone facing a weapon that outclasses theirs checks against the strongest: DC 12 for a knife, 15 for a pistol', () => {
    const dc = (attacker: CharacterInput['inventory'], defender: CharacterInput['inventory'], rolls: FightRolls) =>
      of(play({ attackers: [rec('sam', { inventory: attacker! })], defenders: [rec('rico', { inventory: defender! })], kind: 'real', maxRounds: 1 }, rolls), 'nerve').map((e) => [e.id, e.check.result.dc]);
    const misses = { initiative: [15, 5], attack: [2, 2] };
    assert.deepEqual(dc({ items: ['pistol'] }, {}, { ...misses, nerve: [15] }), [['rico', 15]]);
    assert.deepEqual(dc({ items: ['knife', 'pistol'] }, { items: ['knife'] }, { ...misses, nerve: [15] }), [['rico', 15]]);
    assert.deepEqual(dc({ items: ['knife'] }, {}, { ...misses, nerve: [15] }), [['rico', 12]]);
    assert.deepEqual(dc({ items: ['knife'] }, { items: ['knife'] }, misses), []);
    assert.deepEqual(dc({}, { items: ['pistol'] }, { ...misses, nerve: [15] }), [['sam', 15]]);
  });

  test('failing it, an average fighter gives in at once, with no damage taken', () => {
    const r = play({ attackers: [rec('sam', { inventory: { items: ['pistol'] } })], defenders: [rec('rico')], kind: 'real' }, { initiative: [15, 5], nerve: [14] });
    assert.equal(r.rounds, 0);
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'beaten' });
    assert.deepEqual(fighter(r, 'rico').attackedBy, []);
  });

  test('one already at half health checks at the start, and only once', () => {
    const r = play({ attackers: [rec('sam')], defenders: [rec('rico', { condition: { hitPoints: 5 } })], kind: 'real', maxRounds: 1 }, { initiative: [15, 5], nerve: [12], attack: [12, 2], damage: [1] });
    assert.deepEqual(of(r, 'nerve').map((e) => [e.trigger, e.check.result.dc]), [['start', 10]]);
  });

  test('set upon, a target checks at DC 10 plus 2 for each attacker beyond the first, in one check with any weapon’s', () => {
    const dc = (attackers: CharacterInput[]) =>
      of(play({ attackers: attackers.map((a) => rec(a.id, a)), defenders: [rec('rico')], kind: 'real', start: 'set-upon' }, { initiative: [15, 14, 13, 5].slice(-attackers.length - 1), nerve: [1] }), 'nerve').map((e) => e.check.result.dc);
    assert.deepEqual(dc([{ id: 'sam', name: 'Sam' }]), [10]);
    assert.deepEqual(dc([{ id: 'sam', name: 'Sam' }, { id: 'joe', name: 'Joe' }]), [12]);
    assert.deepEqual(dc([{ id: 'sam', name: 'Sam', inventory: { items: ['pistol'] } }, { id: 'joe', name: 'Joe' }]), [15]);
    assert.deepEqual(dc([{ id: 'sam', name: 'Sam' }, { id: 'joe', name: 'Joe' }, { id: 'vic', name: 'Vic' }]), [14]);
  });

  test('passing it, a volatile fighter loses their temper: advantage on their next attacks, and open to attack until their next turn', () => {
    const r = play(
      { attackers: [rec('sam', { inventory: { items: ['knife'] } })], defenders: [rec('rico', { startingTemperament: { volatility: 0.9 } })], kind: 'real', maxRounds: 1 },
      { initiative: [15, 5], nerve: [12], attack: [3, 4, 5, 6] },
    );
    assert.deepEqual(of(r, 'nerve').map((e) => e.temper), [true]);
    assert.deepEqual(of(r, 'attack').map((e) => [e.by, e.result.roll.edge]), [['sam', 'advantage'], ['rico', 'advantage']]);
    assert.deepEqual(fighter(r, 'rico').reactions, ['holding-their-nerve', 'losing-their-temper']);
  });
});

describe('nerve during a fight', { tags: ['unit'] }, () => {
  test('when half a squad is out, everyone left on it checks', () => {
    const r = play(
      { attackers: [rec('sam', { attributes: attributeScores({ str: 20 }) })], defenders: [rec('rico'), rec('vic')], kind: 'real' },
      { initiative: [15, 5, 4], target: [1], attack: [20], damage: [4, 4], nerve: [3] },
    );
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'knocked-out', vic: 'beaten' });
    assert.deepEqual(of(r, 'nerve').map((e) => [e.id, e.trigger]), [['vic', 'allies-down']]);
    assert.equal(fighter(r, 'rico').droppedBy, 'sam');
  });

  test('a second attacker on the same target this round has advantage', () => {
    const r = play({ attackers: [rec('sam'), rec('joe')], defenders: [rec('rico')], kind: 'real', maxRounds: 1 }, { initiative: [15, 14, 5], attack: [5, 5, 6, 5], target: [1] });
    assert.deepEqual(of(r, 'attack').map((e) => [e.by, e.result.roll.edge]), [['sam', 'none'], ['joe', 'advantage'], ['rico', 'none']]);
  });
});

describe('being set upon', { tags: ['unit'] }, () => {
  test('the attackers have advantage in the first round', () => {
    const r = play({ attackers: [rec('sam'), rec('joe')], defenders: [rec('rico')], kind: 'real', start: 'set-upon', maxRounds: 1 }, { initiative: [15, 14, 5], nerve: [15], attack: [2, 3, 2, 3, 2], target: [1] });
    assert.deepEqual(of(r, 'attack').map((e) => [e.by, e.result.roll.edge]), [['sam', 'advantage'], ['joe', 'advantage'], ['rico', 'none']]);
  });

  test('a target trying to flee must first break the holder’s grip: Brawling against the first attacker in initiative', () => {
    const r = play({ attackers: [rec('sam'), rec('joe')], defenders: [rec('rico', { startingTemperament: { courage: 0.1 } })], kind: 'real', start: 'set-upon' }, { initiative: [15, 14, 5], nerve: [5], escape: [15], chase: [5] });
    const [e] = of(r, 'escape');
    assert.deepEqual([e!.from, e!.result!.active.modifiers.map((m) => m.reason), e!.got], ['sam', ['Strength 10'], 'away']);
    assert.deepEqual(statuses(r), { sam: 'fighting', joe: 'fighting', rico: 'fled' });
    assert.deepEqual(fighter(r, 'rico').reactions, ['running']);
  });
});

describe('ambushes', { tags: ['unit'] }, () => {
  const ambush = (stealth: number[], rolls: FightRolls) => play({ attackers: [rec('sam'), rec('joe')], defenders: [rec('rico')], kind: 'real', start: 'ambush', maxRounds: 1 }, { initiative: [15, 14, 5], stealth, ...rolls });

  test('the squad’s lowest Stealth against each target’s passive Notice: a target who does not notice cannot act in the first round', () => {
    const r = ambush([12, 11], { attack: [2, 2, 2] });
    assert.deepEqual(of(r, 'ambush').map((e) => [e.stealth.total, e.surprised]), [[11, ['rico']]]);
    assert.deepEqual(of(r, 'attack').map((e) => e.by), ['sam', 'joe']);
  });

  test('a target who notices is not surprised', () => {
    const r = ambush([12, 9], { attack: [2, 2, 2, 2], target: [1] });
    assert.deepEqual(of(r, 'ambush')[0]!.surprised, []);
    assert.deepEqual(of(r, 'attack').map((e) => e.by), ['sam', 'joe', 'rico']);
  });
});

describe('fleeing', { tags: ['unit'] }, () => {
  const timid = rec('rico', { startingTemperament: { courage: 0.1 } });
  const knife = rec('sam', { inventory: { items: ['knife'] } });

  test('a partial escape gets away, after the chaser’s free attack', () => {
    const r = play({ attackers: [knife], defenders: [timid], kind: 'real' }, { initiative: [5, 15], nerve: [2], escape: [11], chase: [10], attack: [12], damage: [1] });
    assert.deepEqual(of(r, 'escape').map((e) => e.got), ['away-chased']);
    assert.deepEqual(of(r, 'attack').map((e) => [e.by, e.free]), [['sam', true]]);
    assert.deepEqual([fighter(r, 'rico').status, fighter(r, 'rico').hp], ['fled', 9]);
  });

  test('the free attack can knock them out before they get away', () => {
    const frail = rec('rico', { startingTemperament: { courage: 0.1 }, attributes: attributeScores({ con: 1 }) });
    const strong = rec('sam', { attributes: attributeScores({ str: 14 }), inventory: { items: ['knife'] } });
    const r = play({ attackers: [strong], defenders: [frail], kind: 'real' }, { initiative: [5, 15], nerve: [2], escape: [11], chase: [10], attack: [12], damage: [6] });
    assert.deepEqual([fighter(r, 'rico').status, fighter(r, 'rico').droppedBy], ['knocked-out', 'sam']);
  });

  test('a squad with no one left fighting loses at once, so a lone fighter who runs makes their one last escape', () => {
    const r = play({ attackers: [knife], defenders: [timid], kind: 'real' }, { initiative: [5, 15], nerve: [2], escape: [5], chase: [10] });
    assert.equal(r.rounds, 0);
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'beaten' });
  });

  test('caught while the rest of their squad fights on, they are open to attack until their next turn, when they try again', () => {
    const r = play(
      { attackers: [knife], defenders: [timid, rec('vic')], kind: 'real', maxRounds: 2 },
      { initiative: [15, 10, 5], nerve: [2, 15], target: [1, 1], attack: [2, 2, 2, 3, 2], escape: [5, 15], chase: [10, 2] },
    );
    assert.deepEqual(of(r, 'escape').map((e) => e.got), ['caught', 'away']);
    assert.deepEqual(of(r, 'attack').map((e) => [e.round, e.by, e.result.roll.edge]), [[1, 'sam', 'none'], [1, 'vic', 'none'], [2, 'sam', 'advantage'], [2, 'vic', 'none']]);
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'fled', vic: 'fighting' });
  });

  test('when their squad loses, anyone still fleeing makes one last escape, and is beaten if caught', () => {
    const r = play({ attackers: [knife], defenders: [timid, rec('vic')], kind: 'real' }, { initiative: [15, 10, 5], nerve: [2, 3], escape: [2], chase: [10] });
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'beaten', vic: 'beaten' });
    assert.deepEqual(fighter(r, 'rico').reactions, ['running', 'leaving-their-squad']);
  });

  test('in a stalemate, anyone still fleeing gets away, with no one left to chase them', () => {
    const r = play(
      { attackers: [knife], defenders: [timid, rec('vic')], kind: 'real', maxRounds: 1 },
      { initiative: [15, 10, 5], nerve: [2, 15], target: [1], attack: [2, 2], escape: [2], chase: [10] },
    );
    assert.equal(r.winner, null);
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'fled', vic: 'fighting' });
    assert.deepEqual(fighter(r, 'vic').reactions, ['holding-their-nerve', 'standing-by-their-squad']);
  });

  test('with no one left to chase them, they get away without a roll', () => {
    const r = play(
      { attackers: [rec('sam', { startingTemperament: { courage: 0.1 } }), rec('joe', { attributes: attributeScores({ str: 20 }) })], defenders: [rec('rico', { inventory: { items: ['knife'] } })], kind: 'real' },
      { initiative: [5, 15, 10], nerve: [15, 2], attack: [20], damage: [4, 4] },
    );
    assert.deepEqual(statuses(r), { sam: 'fled', joe: 'fighting', rico: 'knocked-out' });
    assert.deepEqual(of(r, 'escape').map((e) => [e.id, e.result]), [['sam', null]]);
  });
});

describe('sparring', { tags: ['unit'] }, () => {
  test('starts from full health, unarmed, with no nerve checks, and ends when the first fighter drops to half health', () => {
    const r = play(
      { attackers: [rec('sam', { attributes: attributeScores({ str: 14 }), inventory: { items: ['pistol'] } })], defenders: [rec('rico', { condition: { hitPoints: 3 } })], kind: 'sparring' },
      { initiative: [15, 5], attack: [12], damage: [3] },
    );
    assert.deepEqual([r.winner, fighter(r, 'sam').weapon, fighter(r, 'rico').startHp, fighter(r, 'rico').hp], ['attacker', 'none', 10, 5]);
    assert.deepEqual(statuses(r), { sam: 'fighting', rico: 'fighting' });
  });
});

/** A hand-made result, for testing what a fight leaves behind. */
const result = (fighters: Partial<FighterResult>[], over: Partial<FightResult> = {}): FightResult => ({
  kind: 'real',
  start: 'ordinary',
  events: [],
  winner: 'attacker',
  rounds: 1,
  ...over,
  fighters: fighters.map((f) => ({ id: 'x', side: 'attacker', weapon: 'none', startHp: 10, hp: 10, maxHp: 10, status: 'fighting', attackedBy: [], lostNerve: false, reactions: [], ...f })),
});
const four = () => cast({ characters: ['sam', 'joe', 'rico', 'vic'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })) });

describe('what a real fight leaves behind', { tags: ['unit'] }, () => {
  test('a beating for each who attacked the one beaten, with the damage each did, the other fighters and named witnesses as witnesses', () => {
    const c = four();
    const { data, facts } = applyFight(
      c.data,
      result([
        { id: 'sam' },
        { id: 'joe' },
        { id: 'rico', side: 'defender', status: 'beaten', hp: 3, attackedBy: [{ id: 'sam', damage: 5 }, { id: 'joe', damage: 2 }], lostNerve: true },
      ]),
      { now: 60, witnesses: ['vic'] },
    );
    assert.deepEqual(facts.map((f) => [f.kind, f.actor, f.victim, f.amount, f.story, f.witnesses]), [
      ['beating', 'sam', 'rico', 5, 'fight:1', ['joe', 'vic']],
      ['beating', 'joe', 'rico', 2, 'fight:1', ['sam', 'vic']],
    ]);
    const after = castOf(data);
    assert.deepEqual([after.character('rico').condition.hitPoints, after.character('rico').condition.effects], [3, ['shaken']]);
    assert.ok(after.character('vic').versionOf('f1'));
  });

  test('a fighter witnesses what happens to a loser only if not yet knocked out or gone; someone beaten is still there', () => {
    const { facts } = applyFight(
      four().data,
      result([
        { id: 'sam' },
        { id: 'joe', status: 'beaten', endedAt: 1, attackedBy: [{ id: 'vic', damage: 1 }] },
        { id: 'rico', side: 'defender', status: 'knocked-out', hp: 0, endedAt: 2, goneAt: 2, attackedBy: [{ id: 'sam', damage: 10 }], droppedBy: 'sam' },
        { id: 'vic', side: 'defender', status: 'fled', endedAt: 4, goneAt: 4, attackedBy: [{ id: 'sam', damage: 0 }] },
      ]),
      { now: 0 },
    );
    assert.deepEqual(facts.map((f) => [f.victim, f.witnesses]), [['joe', ['sam', 'rico']], ['rico', ['joe', 'vic']], ['vic', ['joe']]]);
  });

  test('everyone there meets once, however many facts the fight records', () => {
    const { data } = applyFight(four().data, result([{ id: 'sam' }, { id: 'joe' }, { id: 'rico', side: 'defender', status: 'beaten', attackedBy: [{ id: 'sam', damage: 1 }, { id: 'joe', damage: 1 }] }]), { now: 0 });
    const after = castOf(data);
    close(after.character('rico').towards(after.character('sam'))!.familiarity, 0.02);
  });

  test('the one beaten feels it by the share of their hit points each attacker took, never less than a successful intimidation', () => {
    const { data } = applyFight(four().data, result([{ id: 'sam' }, { id: 'joe' }, { id: 'rico', side: 'defender', status: 'beaten', hp: 5, attackedBy: [{ id: 'sam', damage: 5 }, { id: 'joe', damage: 0 }] }]), { now: 0 });
    const after = castOf(data);
    const onSam = after.character('rico').towards(after.character('sam'))!;
    close(onSam.grudge, 0.35 * 0.5);
    close(onSam.fear, 0.1);
    close(onSam.trust, 0.5 - 0.125);
    const onJoe = after.character('rico').towards(after.character('joe'))!;
    close(onJoe.grudge, BEATING_AT_LEAST.grudge!);
    close(onJoe.fear, BEATING_AT_LEAST.fear!);
    close(onJoe.trust, 0.5 + BEATING_AT_LEAST.trust!);
  });

  test('one who fled has a fight with each who attacked them, scaled with no minimum; one who gave in unattacked is beaten by everyone still fighting', () => {
    const { facts, data } = applyFight(
      four().data,
      result([{ id: 'sam' }, { id: 'joe' }, { id: 'rico', side: 'defender', status: 'fled', attackedBy: [{ id: 'sam', damage: 0 }] }, { id: 'vic', side: 'defender', status: 'beaten' }]),
      { now: 0 },
    );
    assert.deepEqual(facts.map((f) => [f.kind, f.actor, f.victim]), [['fight', 'sam', 'rico'], ['beating', 'sam', 'vic'], ['beating', 'joe', 'vic']]);
    const after = castOf(data);
    assert.equal(after.character('rico').towards(after.character('sam'))!.grudge, 0);
  });

  test('a knocked-out winner is beaten only by whoever dropped them; a stalemate is a fight between the first of each squad', () => {
    const won = applyFight(
      four().data,
      result([{ id: 'sam', status: 'knocked-out', hp: 0, droppedBy: 'rico', attackedBy: [{ id: 'rico', damage: 6 }, { id: 'vic', damage: 4 }] }, { id: 'joe' }, { id: 'rico', side: 'defender', status: 'beaten' , attackedBy: [{ id: 'joe', damage: 3 }] }, { id: 'vic', side: 'defender', status: 'beaten', attackedBy: [{ id: 'joe', damage: 2 }] }]),
      { now: 0 },
    );
    assert.deepEqual(won.facts.map((f) => [f.actor, f.victim]), [['rico', 'sam'], ['joe', 'rico'], ['joe', 'vic']]);
    const stale = applyFight(four().data, result([{ id: 'sam' }, { id: 'rico', side: 'defender' }], { winner: null }), { now: 0 });
    assert.deepEqual(stale.facts.map((f) => [f.kind, f.actor, f.victim]), [['fight', 'sam', 'rico']]);
  });

  test('links its facts to whatever caused the fight', () => {
    const c = four().record({ kind: 'threat', actor: 'rico', victim: 'sam' }, { now: 0 }).cast;
    const { facts } = applyFight(c.data, result([{ id: 'sam' }, { id: 'rico', side: 'defender', status: 'beaten', attackedBy: [{ id: 'sam', damage: 1 }] }]), { now: 10, cause: 'f1' });
    assert.equal(facts[0]!.cause, 'f1');
  });

  test('is the conduct of starting a fight, of each fighter’s reactions, and of beating someone who could not fight back', () => {
    const conduct = (r: FightResult, id: string, start = four()) => castOf(applyFight(start.data, r, { now: 0 }).data).character(id).conduct.map((s) => s.conduct);
    const beaten = { id: 'rico', side: 'defender' as const, status: 'beaten' as const, attackedBy: [{ id: 'sam', damage: 2 }], reactions: ['giving-in-in-a-fight' as const] };
    assert.deepEqual([...new Set(conduct(result([{ id: 'sam' }, beaten]), 'sam'))], ['starting-a-fight']);
    assert.deepEqual([...new Set(conduct(result([{ id: 'sam' }, beaten]), 'rico'))], ['beaten', 'giving-in-in-a-fight']);
    assert.ok(conduct(result([{ id: 'sam' }, beaten, { id: 'vic', side: 'defender' }]), 'sam').includes('starting-a-fight-outmatched'));
    assert.ok(conduct(result([{ id: 'sam' }, beaten, { id: 'vic', side: 'defender' }]), 'sam').includes('starting-a-fight-rashly'));
    assert.ok(conduct(result([{ id: 'sam', startHp: 4 }, beaten]), 'sam').includes('starting-a-fight-rashly'));
    assert.ok(conduct(result([{ id: 'sam' }, { ...beaten, weapon: 'knife' }]), 'sam').includes('starting-a-fight-outmatched'));
    assert.ok(conduct(result([{ id: 'sam' }, beaten], { start: 'ambush' }), 'sam').includes('setting-an-ambush'));
    assert.ok(conduct(result([{ id: 'sam', weapon: 'pistol' }, beaten]), 'sam').includes('beating-the-helpless'));
    assert.ok(conduct(result([{ id: 'sam' }, { id: 'joe' }, beaten], { start: 'set-upon' }), 'sam').includes('beating-the-helpless'));
    assert.ok(!conduct(result([{ id: 'sam' }, beaten], { start: 'set-upon' }), 'sam').includes('beating-the-helpless'));
  });

  test('a sparring match leaves nothing but the fighters having met', () => {
    const c = four();
    const { data, facts } = applyFight(c.data, result([{ id: 'sam', hp: 4 }, { id: 'rico', side: 'defender', hp: 5 }], { kind: 'sparring' }), { now: 30 });
    assert.deepEqual(facts, []);
    const after = castOf(data);
    assert.deepEqual([after.character('sam').condition.hitPoints, after.character('sam').conduct, after.facts], [10, [], []]);
    assert.equal(after.character('sam').towards(after.character('rico'))!.lastMet, 30);
  });
});

describe('fights in a cast', { tags: ['unit'] }, () => {
  test('are fought between squads, and change the cast as the fight went', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam', attributes: attributeScores({ str: 14 }) }, { id: 'rico', name: 'Rico', attributes: attributeScores({ con: 6 }) }, { id: 'joe', name: 'Joe' }] });
    const out = squad(c.character('sam')).fight(squad(c.character('rico')), { kind: 'real' }).roll(labelled({ initiative: [15, 5], attack: [12], damage: [2], nerve: [5] }), { now: 60, witnesses: ['joe'] });
    assert.equal(out.result.winner, 'attacker');
    assert.deepEqual(out.facts.map((f) => [f.kind, f.actor, f.victim, f.amount]), [['beating', 'sam', 'rico', 4]]);
    assert.deepEqual(out.cast.character('rico').condition.hitPoints, 4);
    assert.ok(out.cast.character('joe').versionOf('f1'));
  });

  test('one against one is the same as a squad of one each', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam' }, { id: 'rico', name: 'Rico' }] });
    const out = c.character('sam').fight(c.character('rico'), { kind: 'sparring' }).roll(labelled({ initiative: [15, 5], attack: [15, 15, 15], damage: [4, 1, 1] }), { now: 0 });
    assert.equal(out.result.kind, 'sparring');
    assert.deepEqual(out.facts, []);
  });

  test('are refused for an empty squad, squads from different casts, or a cast already replaced', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam' }, { id: 'rico', name: 'Rico' }] });
    assert.throws(() => squad(), RangeError);
    assert.throws(() => squad(c.character('sam'), cast({ characters: [{ id: 'joe', name: 'Joe' }] }).character('joe')), RangeError);
    assert.throws(() => squad(c.character('sam')).fight(squad(cast({ characters: [{ id: 'joe', name: 'Joe' }] }).character('joe')), { kind: 'real' }), RangeError);
    assert.throws(() => c.character('sam').fight(c.character('sam'), { kind: 'real' }), RangeError);
    const f = c.character('sam').fight(c.character('rico'), { kind: 'sparring' });
    f.roll(labelled({ initiative: [15, 5], attack: [20], damage: [4, 4] }), { now: 0 });
    assert.throws(() => f.roll(labelled({ initiative: [15, 5], attack: [20], damage: [4, 4] }), { now: 0 }), ReplacedCastError);
  });
});

describe('fights', { tags: ['statistical'] }, () => {
  test('always end with everyone in a final state, and leave a cast whose records all agree', () => {
    const r = roller(seeded(11));
    for (let i = 0; i < 300; i++) {
      const characters = Array.from({ length: 2 + (i % 3) }, (_, j) => {
        const c = rollCharacter(`c${j}`, `C${j}`, BACKGROUNDS[(i + j) % BACKGROUNDS.length]!, r);
        return { ...c, inventory: { items: (i + j) % 4 === 0 ? (['pistol'] as const) : (i + j) % 4 === 1 ? (['knife'] as const) : [] } };
      });
      const c = cast({ characters });
      const [first, ...rest] = c.characters;
      const split = Math.max(1, Math.floor(rest.length / 2));
      const kind = i % 4 === 0 ? 'sparring' : 'real';
      const start = kind === 'sparring' ? 'ordinary' : (['ordinary', 'set-upon', 'ambush'] as const)[i % 3]!;
      const out = squad(first!, ...rest.slice(split)).fight(squad(...rest.slice(0, split)), { kind, start }).roll(r, { now: i });
      for (const f of out.result.fighters) {
        assert.ok(f.hp >= 0 && f.hp <= f.maxHp);
        assert.notEqual(f.status, 'fleeing');
      }
      assert.doesNotThrow(() => castOf(out.cast.data));
    }
  });

  test('an average fighter facing a pistol bare-handed loses their nerve about 70% of the time, as a DC 15 check should', () => {
    const r = roller(seeded(3));
    const c = cast({ characters: [{ id: 'sam', name: 'Sam', inventory: { items: ['pistol'] } }, { id: 'rico', name: 'Rico' }] });
    const spec = { attackers: [c.character('sam').data], defenders: [c.character('rico').data], kind: 'real' as const, maxRounds: 1 };
    let lost = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) if (of(fight(spec, r), 'nerve').some((e) => e.trigger === 'start' && !e.check.passed)) lost++;
    assert.ok(Math.abs(lost / n - 0.7) < 0.03, `lost nerve ${lost / n}`);
  });
});
