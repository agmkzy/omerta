import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { BACKGROUNDS, rollCharacter } from '../../../src/overhaul/character/backgrounds';
import { CAST_FORMAT, cast, castOf } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import { roller, seeded } from '../../../src/overhaul/character/random';
import { NEW_RELATIONSHIP } from '../../../src/overhaul/character/relationships';
import { WORLD } from '../../../src/overhaul/character/transfers';
import { MIGRATIONS, NewerFormatError, loadCast, migrate, readCast, type Migration } from '../../../src/overhaul/character/save';
import { scripted } from './support';

const everyone = cast({
  characters: [
    { id: 'sam', name: 'Sam', background: 'driver', attributes: attributeScores({ agi: 16 }), training: { driving: 'expert', notice: 'trained' }, proficiencyBonus: 3, startingTemperament: { caution: 0.8 } },
    { id: 'rico', name: 'Rico' },
  ],
});
const throughJson = (data: unknown): unknown => JSON.parse(JSON.stringify(data));
const one = (character: Record<string, unknown>) => ({ format: CAST_FORMAT, characters: [character] });
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('loadCast', { tags: ['unit'] }, () => {
  test('restores a saved cast through JSON', () => {
    assert.deepEqual(loadCast(throughJson(everyone.data)).data, everyone.data);
  });

  test('reports nothing ignored for a cast this version saved', () => {
    assert.deepEqual(readCast(throughJson(everyone.data)).ignored, []);
  });

  test('gives a current cast, whatever the saved one was', () => {
    everyone.add({ id: 'joe', name: 'Joe' });
    assert.equal(loadCast(throughJson(everyone.data)).current, true);
  });

  test('defaults missing optional fields', () => {
    assert.deepEqual(loadCast({ format: 1 }).data, cast().data);
    assert.deepEqual(loadCast(one({ id: 'm', name: 'Minimal' })).data.characters[0], createCharacter({ id: 'm', name: 'Minimal' }));
  });

  test('defaults individual missing attributes and traits, so new fields can be added later', () => {
    const c = loadCast(one({ id: 'p', name: 'Partial', attributes: { str: 14 }, startingTemperament: { greed: 0.9 } })).data.characters[0]!;
    assert.equal(c.attributes.str, 14);
    assert.equal(c.attributes.cha, 10);
    assert.equal(c.startingTemperament.greed, 0.9);
    assert.equal(c.startingTemperament.pride, 0.5);
  });

  test('treats an explicit untrained entry as no training', () => {
    assert.deepEqual(loadCast(one({ id: 'x', name: 'X', training: { driving: 'untrained', notice: 'trained' } })).data.characters[0]!.training, { notice: 'trained' });
  });

  test('leaves out anything it does not recognise, and reports where it was, so the caller can keep the original', () => {
    const { cast: loaded, ignored } = readCast({
      format: 1, notes: 'unused',
      characters: [{
        id: 'x', name: 'X', background: 'astronaut', notes: 'unused',
        training: { juggling: 'expert', driving: 'trained' }, attributes: { luck: 18, str: 14 }, startingTemperament: { whimsy: 0.9, greed: 0.2 },
      }],
    });
    assert.deepEqual(loaded.data.characters[0], createCharacter({ id: 'x', name: 'X', training: { driving: 'trained' }, attributes: attributeScores({ str: 14 }), startingTemperament: { greed: 0.2 } }));
    assert.deepEqual([...ignored].sort(), [
      'characters[0].attributes.luck', 'characters[0].background', 'characters[0].notes',
      'characters[0].startingTemperament.whimsy', 'characters[0].training.juggling', 'notes',
    ]);
  });

  test('rejects data that is not a saved cast', () => {
    for (const bad of [null, 'text', 42, [], { characters: [] }, { format: 0 }, { format: 1.5 }, { format: 1, characters: {} }, one({ name: 'No id' }), one({ id: 'x' }), one({ id: 'x', name: 7 }), { format: 1, characters: [null] }])
      assert.throws(() => loadCast(bad), TypeError, JSON.stringify(bad));
  });

  test('rejects a newer format', () => {
    assert.throws(() => loadCast({ format: CAST_FORMAT + 1 }), NewerFormatError);
  });

  test('rejects invalid values, and two characters with one id', () => {
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', attributes: { str: 30 } })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', attributes: { str: '12' } })), TypeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', training: { driving: 'master' } })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', startingTemperament: { greed: 2 } })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', proficiencyBonus: 9 })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', training: [] })), TypeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', proficiencyBonus: '3' })), TypeError);
    assert.throws(() => loadCast({ format: 1, characters: [{ id: 'x', name: 'X' }, { id: 'x', name: 'Y' }] }), RangeError);
  });

  test('loads a cast saved in format 1, which must keep loading: its characters are at full health', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format1.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.characters.map((c) => c.name), ['Sam', 'Rico']);
    assert.equal(loaded.character('sam').skills.deception.bonus, 2 + 4);
    assert.equal(loaded.character('rico').temperament.volatility, 0.75);
    assert.deepEqual(loaded.characters.map((c) => [c.condition.hitPoints, c.condition.maxHitPoints, c.condition.effects]), [[10, 10, []], [12, 12, []]]);
  });

  test('loads a cast saved in format 2, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format2.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.character('sam').condition, { hitPoints: 4, effects: ['drunk'], maxHitPoints: 10, hurt: true, unconscious: false });
    assert.equal(loaded.character('rico').restingAt(1500), true);
  });

  test('restores a character’s condition, and leaves out effects and fields it does not recognise', () => {
    const hurt = loadCast(throughJson(everyone.data)).character('sam').damage(6).character('sam').affect('shaken').character('sam').rest({ now: 60, hours: 1 }).character('sam').damage(2);
    assert.deepEqual(loadCast(throughJson(hurt.data)).data, hurt.data);
    const { cast: loaded, ignored } = readCast(one({ id: 'x', name: 'X', condition: { hitPoints: 3, effects: ['sober', 'shaken'], mood: 'bad' } }));
    assert.deepEqual(loaded.character('x').data.condition, { hitPoints: 3, effects: ['shaken'] });
    assert.deepEqual([...ignored].sort(), ['characters[0].condition.effects.sober', 'characters[0].condition.mood']);
  });

  test('loads a cast saved in format 3, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format3.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.characters.map((c) => c.cash), [70, 50]);
    assert.deepEqual(loaded.character('sam').seenBy(loaded.character('rico')).items, [{ item: 'good-suit', state: 'worn' }]);
    assert.equal(loaded.data.transfers.filter((t) => t.item === undefined).length, 3);
    assert.deepEqual(loaded.data.transfers.filter((t) => t.item !== undefined).map((t) => [t.to, t.item, t.amount, t.at]), [['sam', 'lockpicks', 1, 0], ['sam', 'good-suit', 1, 0], ['sam', 'pistol', 1, 0], ['rico', 'knife', 1, 0]]);
  });

  test('restores cash, items and transfers, and leaves out items and fields it does not recognise', () => {
    const funded = loadCast(throughJson(everyone.data)).transfer({ from: WORLD, to: 'sam', amount: 40, why: 'opening balance', now: 0 });
    const paid = funded.character('sam').pay(funded.character('rico'), 15, { why: 'a debt', now: 30 });
    assert.deepEqual(loadCast(throughJson(paid.data)).data, paid.data);
    // (format 7, before items had transfers: the migration gives them from the world)
    const { cast: loaded, ignored } = readCast({
      format: 7,
      characters: [{ id: 'x', name: 'X', inventory: { cash: 5, items: [{ item: 'knife', state: 'shown', polish: 1 }, { item: 'bottle' }], wallet: 'brown' } }],
      transfers: [{ from: WORLD, to: 'x', amount: 5, why: 'found it', at: 0, note: 'lucky' }],
    });
    assert.deepEqual(loaded.character('x').inventory, { cash: 5, items: [{ item: 'knife', state: 'shown' }, { item: 'bottle', state: 'carried' }] });
    assert.deepEqual([...ignored].sort(), ['characters[0].inventory.items[0].polish', 'characters[0].inventory.wallet', 'transfers[2].note']);
  });

  test('rejects inventories and transfers of the wrong shape, and cash that disagrees with the transfers', () => {
    for (const inventory of [[], { cash: '5' }, { items: 'knife' }, { items: ['knife'] }])
      assert.throws(() => loadCast(one({ id: 'x', name: 'X', inventory })), TypeError, JSON.stringify(inventory));
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', inventory: { items: [{ item: 'knife', state: 'worn' }] } })), RangeError);
    const transfer = { from: WORLD, to: 'x', amount: 5, why: 'found it', at: 0 };
    const withTransfers = (transfers: unknown) => ({ format: CAST_FORMAT, characters: [{ id: 'x', name: 'X', inventory: { cash: 5 } }], transfers });
    assert.doesNotThrow(() => loadCast(withTransfers([transfer])));
    for (const transfers of [{}, [null], [{ ...transfer, from: 3 }], [{ ...transfer, why: null }], [{ ...transfer, amount: '5' }], [{ ...transfer, at: undefined }]])
      assert.throws(() => loadCast(withTransfers(transfers)), TypeError, JSON.stringify(transfers));
    assert.throws(() => loadCast(withTransfers([])), RangeError);
    assert.throws(() => loadCast(withTransfers([{ ...transfer, amount: 6 }])), RangeError);
  });

  test('loads a cast saved in format 4, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format4.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.facts.map((f) => [f.id, f.kind]), [['f1', 'beating'], ['f2', 'robbery']]);
    assert.equal(loaded.data.nextId, 3);
    assert.deepEqual(loaded.character('rico').versionOf('f1'), { learnedAt: 1440, source: 'witness', how: 'seen', knowsActor: true });
    assert.deepEqual(loaded.character('sam').versionOf('f2'), { learnedAt: 2000, source: 'told', teller: 'rico', how: 'told', knowsActor: false, blame: 'rico', exaggerated: true });
  });

  test('restores facts and knowledge, and leaves out fields it does not recognise', () => {
    const recorded = loadCast(throughJson(everyone.data)).record({ kind: 'beating', actor: 'sam', victim: 'rico', amount: 3, where: 'the docks', story: 's1', hiddenActor: true }, { now: 10 });
    const told = recorded.cast.character('sam').social.tell(recorded.cast.character('rico'), 'f1').roll(scripted(), { now: 20 }).cast;
    const caused = told.record({ kind: 'threat', actor: 'rico', victim: 'sam', cause: 'f1', business: 'b1' }, { now: 30 }).cast;
    assert.deepEqual(loadCast(throughJson(caused.data)).data, caused.data);
    const { cast: loaded, ignored } = readCast({
      format: CAST_FORMAT,
      characters: [{ id: 'x', name: 'X', knowledge: { f1: { learnedAt: 0, source: 'self', how: 'seen', knowsActor: true, mood: 'proud' } } }],
      facts: [{ id: 'f1', kind: 'theft', actor: 'x', at: 0, witnesses: [], weather: 'rain' }],
      nextId: 2,
    });
    assert.deepEqual(loaded.character('x').versionOf('f1'), { learnedAt: 0, source: 'self', how: 'seen', knowsActor: true });
    assert.deepEqual([...ignored].sort(), ['characters[0].knowledge.f1.mood', 'facts[0].weather']);
  });

  test('rejects facts and knowledge of the wrong shape, and knowledge that does not fit the facts', () => {
    const f = { id: 'f1', kind: 'theft', actor: 'x', at: 0, witnesses: [] };
    const withFacts = (facts: unknown, nextId: unknown = 2) => ({ format: CAST_FORMAT, characters: [{ id: 'x', name: 'X' }], facts, nextId });
    assert.doesNotThrow(() => loadCast(withFacts([f])));
    for (const [facts, nextId] of [[{}, 2], [[null], 2], [[{ ...f, id: 1 }], 2], [[{ ...f, kind: 'picnic' }], 2], [[{ ...f, at: '0' }], 2], [[{ ...f, witnesses: 'x' }], 2],
      [[{ ...f, witnesses: [1] }], 2], [[{ ...f, actor: 1 }], 2], [[{ ...f, amount: '5' }], 2], [[{ ...f, hiddenActor: 'yes' }], 2], [[f], '2']] as const)
      assert.throws(() => loadCast(withFacts(facts, nextId)), TypeError, JSON.stringify(facts));
    assert.throws(() => loadCast(withFacts([f], 1)), RangeError);
    const v = { learnedAt: 0, source: 'self', how: 'seen', knowsActor: true };
    const knowing = (knowledge: unknown) => ({ ...withFacts([f]), characters: [{ id: 'x', name: 'X', knowledge }] });
    assert.doesNotThrow(() => loadCast(knowing({ f1: v })));
    for (const knowledge of [[], { f1: null }, { f1: { ...v, learnedAt: '0' } }, { f1: { ...v, source: 'dream' } }, { f1: { ...v, how: 'felt' } },
      { f1: { ...v, knowsActor: 'yes' } }, { f1: { ...v, blame: 3 } }, { f1: { ...v, teller: 3 } }, { f1: { ...v, exaggerated: 1 } }, { f1: { ...v, knownFalse: false } }])
      assert.throws(() => loadCast(knowing(knowledge)), TypeError, JSON.stringify(knowledge));
    assert.throws(() => loadCast(knowing({ f2: v })), RangeError);
    const invented = { format: CAST_FORMAT, characters: [{ id: 'x', name: 'X', knowledge: { f1: { ...v, knownFalse: true } } }], facts: [{ ...f, invented: 'x' }], nextId: 2 };
    assert.deepEqual(loadCast(invented).character('x').versionOf('f1'), { ...v, knownFalse: true });
  });

  test('loads a cast saved in format 5, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format5.json'));
    assert.deepEqual(ignored, []);
    const ricoOnSam = loaded.character('rico').towards(loaded.character('sam'))!;
    assert.equal(ricoOnSam.grudge, 0.35);
    assert.deepEqual(ricoOnSam.grudgeReason, { fact: 'f1', at: 1440, amount: 0.35 });
    assert.equal(loaded.character('sam').towards(loaded.character('rico'))!.lastMet, 1440);
  });

  test('restores relationships, filling in feelings not saved, and leaves out fields it does not recognise', () => {
    const recorded = loadCast(throughJson(everyone.data)).record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 10 }).cast;
    assert.deepEqual(loadCast(throughJson(recorded.data)).data, recorded.data);
    const { cast: loaded, ignored } = readCast({
      format: CAST_FORMAT,
      characters: [{ id: 'x', name: 'X', relationships: { y: { fear: 0.4, mood: 'wary', regardReason: { fact: 'f1', at: 0, amount: 0.1, note: 'kind' } } } }, { id: 'y', name: 'Y' }],
    });
    assert.deepEqual(loaded.character('x').towards(loaded.character('y')), { ...NEW_RELATIONSHIP, fear: 0.4, regardReason: { fact: 'f1', at: 0, amount: 0.1 } });
    assert.deepEqual([...ignored].sort(), ['characters[0].relationships.y.mood', 'characters[0].relationships.y.regardReason.note']);
  });

  test('rejects relationships of the wrong shape, out of range, or with someone not in the cast', () => {
    const relating = (relationships: unknown) => ({ format: CAST_FORMAT, characters: [{ id: 'x', name: 'X', relationships }, { id: 'y', name: 'Y' }] });
    for (const relationships of [[], { y: null }, { y: { trust: '1' } }, { y: { lastMet: '0' } }, { y: { grudgeReason: { at: 0, amount: 1 } } }, { y: { grudgeReason: { fact: 'f1', at: '0', amount: 1 } } }])
      assert.throws(() => loadCast(relating(relationships)), TypeError, JSON.stringify(relationships));
    for (const relationships of [{ y: { trust: 2 } }, { z: {} }, { x: {} }])
      assert.throws(() => loadCast(relating(relationships)), RangeError, JSON.stringify(relationships));
  });

  test('loads a cast saved in format 6, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format6.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.character('sam').conduct.map((c) => [c.conduct, c.trait, c.direction]), [['robbing', 'greed', 1], ['robbing', 'violence', 1], ['drinking', 'vice', 1], ['drinking', 'sociability', -1]]);
    assert.equal(loaded.character('sam').temperament.greed, 0.5 + 0.01 * 0.5);
  });

  test('restores conduct, and leaves out steps of kinds and fields it does not recognise', () => {
    const robbed = loadCast(throughJson(everyone.data)).record({ kind: 'robbery', actor: 'sam', victim: 'rico' }, { now: 10 }).cast;
    assert.deepEqual(loadCast(throughJson(robbed.data)).data, robbed.data);
    const step = { conduct: 'lying', trait: 'honesty', direction: -1, at: 0, cause: { item: 'bottle' } };
    const { cast: loaded, ignored } = readCast(one({ id: 'x', name: 'X', conduct: [{ ...step, conduct: 'juggling' }, { ...step, mood: 'sly' }] }));
    assert.deepEqual(loaded.character('x').conduct, [step]);
    assert.deepEqual([...ignored].sort(), ['characters[0].conduct[0]', 'characters[0].conduct[1].mood']);
  });

  test('rejects conduct of the wrong shape, or whose cause is not recorded', () => {
    const step = { conduct: 'lying', trait: 'honesty', direction: -1, at: 0, cause: { item: 'bottle' } };
    for (const conduct of [{}, [null], [{ ...step, trait: 'whimsy' }], [{ ...step, direction: 0 }], [{ ...step, at: '0' }], [{ ...step, cause: null }], [{ ...step, cause: { item: 'crowbar' } }]])
      assert.throws(() => loadCast(one({ id: 'x', name: 'X', conduct })), TypeError, JSON.stringify(conduct));
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', conduct: [{ ...step, cause: { fact: 'f1' } }] })), RangeError);
  });

  test('loads a cast saved in format 7, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format7.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.job('j3').plan!.outcome, 'critical-success');
    assert.deepEqual(loaded.character('sam').conduct.at(-1)!.cause, { job: 'j3' });
  });

  test('restores jobs and their plans, and leaves out fields it does not recognise', () => {
    const started = loadCast(throughJson(everyone.data)).startJob({ kind: 'burglary', dc: 20, members: ['sam', 'rico'], now: 0 });
    const planned = started.cast.character('sam').planning.plan(started.job, { advantageOn: { member: 'rico', skill: 'stealth' } }).helpedBy('rico').roll(scripted(20, 20), { now: 5 }).cast;
    const ended = planned.endJob('j1', { now: 50 });
    assert.deepEqual(loadCast(throughJson(ended.data)).data, ended.data);
    const job = { id: 'j1', kind: 'scam', members: ['x'], dc: 10, startedAt: 0, note: 'quick', plan: { planner: 'x', outcome: 'success', margin: 5, at: 0, advantageUsed: true, mood: 'sure' } };
    const { cast: loaded, ignored } = readCast({ format: CAST_FORMAT, characters: [{ id: 'x', name: 'X' }], jobs: [job], nextId: 2 });
    assert.equal(loaded.job('j1').plan!.advantageUsed, true);
    assert.deepEqual([...ignored].sort(), ['jobs[0].note', 'jobs[0].plan.mood']);
  });

  test('rejects jobs of the wrong shape or that do not fit the cast', () => {
    const job = { id: 'j1', kind: 'scam', members: ['x'], dc: 10, startedAt: 0 };
    const plan = { planner: 'x', outcome: 'success', margin: 5, at: 0 };
    const withJobs = (jobs: unknown) => ({ format: CAST_FORMAT, characters: [{ id: 'x', name: 'X' }], jobs, nextId: 2 });
    for (const jobs of [{}, [null], [{ ...job, id: 1 }], [{ ...job, members: 'x' }], [{ ...job, dc: '10' }], [{ ...job, endedAt: '5' }],
      [{ ...job, plan: { ...plan, planner: 1 } }], [{ ...job, plan: { ...plan, helper: 1 } }], [{ ...job, plan: { ...plan, outcome: 'great' } }], [{ ...job, plan: { ...plan, at: '0' } }],
      [{ ...job, plan: { ...plan, advantageUsed: false } }], [{ ...job, plan: { ...plan, advantageOn: { member: 'x', skill: 'juggling' } } }]])
      assert.throws(() => loadCast(withJobs(jobs)), TypeError, JSON.stringify(jobs));
    for (const jobs of [[{ ...job, members: ['y'] }], [{ ...job, id: 'j5' }], [job, { ...job, id: 'j1' }]])
      assert.throws(() => loadCast(withJobs(jobs)), RangeError, JSON.stringify(jobs));
  });

  test('rejects a condition of the wrong shape or out of range', () => {
    for (const condition of [[], { hitPoints: '3' }, { effects: 'shaken' }, { rest: { from: 0 } }, { rest: 5 }])
      assert.throws(() => loadCast(one({ id: 'x', name: 'X', condition })), TypeError, JSON.stringify(condition));
    for (const condition of [{ hitPoints: 99 }, { rest: { from: 9, until: 3 } }])
      assert.throws(() => loadCast(one({ id: 'x', name: 'X', condition })), RangeError, JSON.stringify(condition));
  });
});

describe('migrations', { tags: ['unit'] }, () => {
  test('there is one for each format after the first', () => {
    assert.equal(MIGRATIONS.length, CAST_FORMAT - 1);
  });

  test('1 to 2 gives each character an empty condition, which loads as full health with no effects', () => {
    const d: Record<string, unknown> = { format: 1, characters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', condition: { hitPoints: 2 } }, null] };
    migrate(d, 1, MIGRATIONS.slice(0, 1));
    assert.deepEqual(d.characters, [{ id: 'a', name: 'A', condition: {} }, { id: 'b', name: 'B', condition: { hitPoints: 2 } }, null]);
    const notAList: Record<string, unknown> = { format: 1, characters: 'none' };
    migrate(notAList, 1, MIGRATIONS.slice(0, 1));
    assert.equal(notAList.characters, 'none');
  });

  test('2 to 3 gives each character an empty inventory, and the cast no transfers', () => {
    const d: Record<string, unknown> = { format: 2, characters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', inventory: { cash: 0 } }, null] };
    migrate(d, 2, MIGRATIONS.slice(0, 2));
    assert.deepEqual(d, { format: 2, characters: [{ id: 'a', name: 'A', inventory: {} }, { id: 'b', name: 'B', inventory: { cash: 0 } }, null], transfers: [] });
    const notAList: Record<string, unknown> = { format: 2, characters: 'none', transfers: ['kept'] };
    migrate(notAList, 2, MIGRATIONS.slice(0, 2));
    assert.deepEqual(notAList, { format: 2, characters: 'none', transfers: ['kept'] });
  });

  test('3 to 4 gives the cast no facts and an id counter at 1, and each character no knowledge', () => {
    const d: Record<string, unknown> = { format: 3, characters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', knowledge: {} }, null], transfers: [] };
    migrate(d, 3, MIGRATIONS.slice(0, 3));
    assert.deepEqual(d, { format: 3, characters: [{ id: 'a', name: 'A', knowledge: {} }, { id: 'b', name: 'B', knowledge: {} }, null], transfers: [], facts: [], nextId: 1 });
    const notAList: Record<string, unknown> = { format: 3, characters: 'none', facts: ['kept'], nextId: 7 };
    migrate(notAList, 3, MIGRATIONS.slice(0, 3));
    assert.deepEqual(notAList, { format: 3, characters: 'none', facts: ['kept'], nextId: 7 });
  });

  test('4 to 5 gives each character no relationships', () => {
    const d: Record<string, unknown> = { format: 4, characters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', relationships: {} }, null] };
    migrate(d, 4, MIGRATIONS.slice(0, 4));
    assert.deepEqual(d, { format: 4, characters: [{ id: 'a', name: 'A', relationships: {} }, { id: 'b', name: 'B', relationships: {} }, null] });
    const notAList: Record<string, unknown> = { format: 4, characters: 'none' };
    migrate(notAList, 4, MIGRATIONS.slice(0, 4));
    assert.deepEqual(notAList, { format: 4, characters: 'none' });
  });

  test('5 to 6 gives each character no conduct', () => {
    const d: Record<string, unknown> = { format: 5, characters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', conduct: [] }, null] };
    migrate(d, 5, MIGRATIONS.slice(0, 5));
    assert.deepEqual(d, { format: 5, characters: [{ id: 'a', name: 'A', conduct: [] }, { id: 'b', name: 'B', conduct: [] }, null] });
    const notAList: Record<string, unknown> = { format: 5, characters: 'none' };
    migrate(notAList, 5, MIGRATIONS.slice(0, 5));
    assert.deepEqual(notAList, { format: 5, characters: 'none' });
  });

  test('6 to 7 gives the cast no jobs', () => {
    const d: Record<string, unknown> = { format: 6 };
    migrate(d, 6, MIGRATIONS.slice(0, 6));
    assert.deepEqual(d, { format: 6, jobs: [] });
  });

  test('run in order from the saved format to the newest', () => {
    const steps: Migration[] = [(d) => void ((d.seen as string[]).push('1 to 2')), (d) => void ((d.seen as string[]).push('2 to 3'))];
    const from = (format: number) => {
      const d = { seen: [] as string[] };
      migrate(d, format, steps);
      return d.seen;
    };
    assert.deepEqual(from(1), ['1 to 2', '2 to 3']);
    assert.deepEqual(from(2), ['2 to 3']);
    assert.deepEqual(from(3), []);
  });
});

describe('saving and loading', { tags: ['property'] }, () => {
  test('round-trip any cast of rolled characters through JSON', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.constantFrom(...BACKGROUNDS), { maxLength: 4 }), fc.integer({ min: 2, max: 6 }), (seed, backgrounds, pb) => {
        const r = roller(seeded(seed));
        const data = { format: CAST_FORMAT, characters: backgrounds.map((b, i) => rollCharacter(`c${i}`, `C${i}`, b, r, { proficiencyBonus: pb })), transfers: [], facts: [], jobs: [], nextId: 1 };
        assert.deepEqual(loadCast(throughJson(castOf(data).data)).data, data);
      }),
    );
  });
});
