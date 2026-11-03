import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { ReplacedCastError, cast, castOf, type CastRecord } from '../../../src/overhaul/character/cast';
import { DRINK_DC, ITEMS, ITEM_INFO, SKILL_SITUATIONS, inventoryRecord, itemModifiers } from '../../../src/overhaul/character/items';
import { SKILLS } from '../../../src/overhaul/character/skills';
import { scripted } from './support';

const reasons = (...args: Parameters<typeof itemModifiers>) => itemModifiers(...args).map((m) => `${m.reason} ${m.value}`);

describe('the item catalogue', { tags: ['unit'] }, () => {
  test('has the plan’s items, each named, with effects on real skills', () => {
    assert.deepEqual(ITEMS, ['knife', 'pistol', 'lockpicks', 'toolkit', 'good-suit', 'bottle']);
    for (const i of ITEMS) {
      assert.ok(ITEM_INFO[i].name, i);
      for (const e of ITEM_INFO[i].effects) {
        assert.ok(SKILLS.includes(e.skill), `${i} affects ${e.skill}`);
        if (e.situation) assert.equal(SKILL_SITUATIONS[e.situation], e.skill, `${i}: ${e.situation} is not a situation of ${e.skill}`);
      }
    }
  });

  test('gives lockpicks +2 Larceny for locks and a toolkit +2 Mechanics for repairs when used, and a good suit +1 Persuasion while worn', () => {
    assert.deepEqual(ITEM_INFO.lockpicks.effects, [{ skill: 'larceny', situation: 'locks', value: 2, when: 'used' }]);
    assert.deepEqual(ITEM_INFO.toolkit.effects, [{ skill: 'mechanics', situation: 'repairs', value: 2, when: 'used' }]);
    assert.deepEqual(ITEM_INFO['good-suit'].effects, [{ skill: 'persuasion', value: 1, when: 'worn' }]);
  });

  test('marks the weapons, what can be worn and what is used up', () => {
    assert.deepEqual(ITEMS.filter((i) => ITEM_INFO[i].weapon), ['knife', 'pistol']);
    assert.deepEqual(ITEMS.filter((i) => ITEM_INFO[i].wearable), ['good-suit']);
    assert.deepEqual(ITEMS.filter((i) => ITEM_INFO[i].usedUp), ['bottle']);
    assert.equal(DRINK_DC, 12);
  });
});

describe('inventoryRecord', { tags: ['unit'] }, () => {
  test('defaults to no cash and nothing held, and carries an item given by name', () => {
    assert.deepEqual(inventoryRecord(), { cash: 0, items: [] });
    assert.deepEqual(inventoryRecord({ items: ['knife', { item: 'good-suit', state: 'worn' }] }).items, [
      { item: 'knife', state: 'carried' },
      { item: 'good-suit', state: 'worn' },
    ]);
  });

  test('throws for cash that is not a whole number from 0, an unknown item, or a state the item cannot be in', () => {
    for (const cash of [-1, 2.5]) assert.throws(() => inventoryRecord({ cash }), RangeError, String(cash));
    assert.throws(() => inventoryRecord({ items: ['crowbar' as never] }), RangeError);
    assert.throws(() => inventoryRecord({ items: [{ item: 'lockpicks', state: 'shown' }] }), RangeError);
    assert.throws(() => inventoryRecord({ items: [{ item: 'knife', state: 'worn' }] }), RangeError);
    assert.throws(() => inventoryRecord({ items: [{ item: 'knife', state: 'held' as never }] }), RangeError);
  });
});

describe('itemModifiers', { tags: ['unit'] }, () => {
  const kit = inventoryRecord({ items: ['lockpicks', 'toolkit', { item: 'good-suit', state: 'worn' }] });

  test('an item used for a check helps only in its situation', () => {
    assert.deepEqual(reasons(kit, 'larceny', { situation: 'locks', using: ['lockpicks'] }), ['Lockpicks 2']);
    assert.deepEqual(reasons(kit, 'larceny', { using: ['lockpicks'] }), []);
    assert.deepEqual(reasons(kit, 'larceny', { situation: 'locks' }), []);
    assert.deepEqual(reasons(kit, 'mechanics', { situation: 'repairs', using: ['toolkit'] }), ['Toolkit 2']);
  });

  test('a worn item helps every check of its skill, and only while worn', () => {
    assert.deepEqual(reasons(kit, 'persuasion'), ['Good suit 1']);
    assert.deepEqual(reasons(inventoryRecord({ items: ['good-suit'] }), 'persuasion'), []);
  });

  test('an item held twice counts once', () => {
    const two = inventoryRecord({ items: ['good-suit', { item: 'good-suit', state: 'worn' }, 'lockpicks', 'lockpicks'] });
    assert.deepEqual(reasons(two, 'persuasion'), ['Good suit 1']);
    assert.deepEqual(reasons(two, 'larceny', { situation: 'locks', using: ['lockpicks'] }), ['Lockpicks 2']);
  });

  test('refuses a situation of another skill, or using an item not held', () => {
    assert.throws(() => itemModifiers(kit, 'larceny', { situation: 'repairs' }), RangeError);
    assert.throws(() => itemModifiers(kit, 'stealth', { using: ['pistol'] }), RangeError);
  });
});

describe('items on a character', { tags: ['unit'] }, () => {
  const everyone = () =>
    cast({
      characters: [
        { id: 'sam', name: 'Sam', attributes: attributeScores({ agi: 14, cha: 12 }), training: { larceny: 'trained' }, inventory: { items: ['pistol', 'lockpicks', 'good-suit', 'bottle'] } },
        { id: 'rico', name: 'Rico' },
      ],
    });

  test('a skill in a situation, with the items used, lists every part', () => {
    const sam = everyone().character('sam');
    assert.deepEqual(sam.skill('larceny', { situation: 'locks', using: ['lockpicks'] }).modifiers.map((m) => m.reason), ['Agility 14', 'Trained in Larceny', 'Lockpicks']);
    assert.equal(sam.skill('larceny', { situation: 'locks', using: ['lockpicks'] }).bonus, 6);
    assert.equal(sam.skills.larceny.bonus, 4);
  });

  test('a weapon is hidden until shown, and anyone present can then see it', () => {
    const start = everyone();
    const seen = (c: typeof start) => c.character('sam').seenBy(c.character('rico')).items;
    assert.deepEqual(seen(start), []);
    const shown = start.character('sam').show('pistol');
    assert.deepEqual(seen(shown), [{ item: 'pistol', state: 'shown' }]);
    assert.deepEqual(seen(shown.character('sam').hide('pistol')), []);
  });

  test('a good suit helps Persuasion while worn, and anyone present can see it', () => {
    const worn = everyone().character('sam').wear('good-suit');
    assert.equal(worn.character('sam').skills.persuasion.bonus, 2);
    assert.deepEqual(worn.character('sam').seenBy(worn.character('rico')).items, [{ item: 'good-suit', state: 'worn' }]);
    assert.equal(worn.character('sam').takeOff('good-suit').character('sam').skills.persuasion.bonus, 1);
  });

  test('an item must be in the right state, and of the right kind, to be shown, hidden, worn or taken off', () => {
    const sam = everyone().character('sam');
    assert.throws(() => sam.hide('pistol'), RangeError);
    assert.throws(() => sam.takeOff('good-suit'), RangeError);
    assert.throws(() => sam.show('knife'), RangeError);
    assert.throws(() => sam.show('lockpicks'), RangeError);
    assert.throws(() => sam.wear('pistol'), RangeError);
    assert.equal(sam.cast.current, true);
  });

  test('drinking a bottle uses it up; failing the Carousing check makes the character drunk', () => {
    const passed = everyone().character('sam').drink(scripted(12), { now: 0 });
    assert.equal(passed.result.dc, DRINK_DC);
    assert.equal(passed.drunk, false);
    assert.deepEqual(passed.cast.character('sam').inventory.items.map((h) => h.item), ['pistol', 'lockpicks', 'good-suit']);
    assert.deepEqual(passed.cast.character('sam').condition.effects, []);
    const failed = everyone().character('sam').drink(scripted(11), { now: 0 });
    assert.equal(failed.drunk, true);
    assert.deepEqual(failed.cast.character('sam').condition.effects, ['drunk']);
  });

  test('someone already drunk stays drunk, whatever they roll', () => {
    const drunk = everyone().character('sam').affect('drunk');
    const again = drunk.character('sam').drink(scripted(20), { now: 0 });
    assert.equal(again.drunk, true);
    assert.deepEqual(again.cast.character('sam').condition.effects, ['drunk']);
  });

  test('drinking needs a bottle, and a character who can act', () => {
    assert.throws(() => everyone().character('rico').drink(scripted(10), { now: 0 }), RangeError);
    assert.throws(() => everyone().character('sam').damage(10).character('sam').drink(scripted(10), { now: 0 }), RangeError);
  });

  test('item changes from a replaced cast are refused', () => {
    const sam = everyone().character('sam');
    sam.show('pistol');
    assert.throws(() => sam.wear('good-suit'), ReplacedCastError);
    assert.throws(() => sam.drink(scripted(10), { now: 0 }), ReplacedCastError);
  });
});

describe('items changing hands', { tags: ['unit'] }, () => {
  const everyone = () => cast({ characters: [{ id: 'sam', name: 'Sam', inventory: { items: ['pistol', 'knife'] } }, { id: 'rico', name: 'Rico' }] });

  test('come to a character from the world at the start, recorded as transfers at the time given', () => {
    assert.deepEqual(everyone().data.transfers.map((t) => [t.from, t.to, t.item, t.at]), [['world', 'sam', 'knife', 0], ['world', 'sam', 'pistol', 0]]);
    const added = everyone().add({ id: 'joe', name: 'Joe', inventory: { items: ['bottle', 'bottle'] } }, { now: 60 });
    assert.deepEqual(added.data.transfers.at(-1), { from: 'world', to: 'joe', amount: 2, item: 'bottle', why: 'starting items', at: 60 });
    assert.throws(() => everyone().add({ id: 'joe', name: 'Joe', inventory: { items: ['bottle'] } }), RangeError);
    assert.doesNotThrow(() => everyone().add({ id: 'joe', name: 'Joe' }));
  });

  test('are handed over by giving, recorded as a transfer with its reason and any cause', () => {
    const c = everyone().record({ kind: 'threat', actor: 'rico', victim: 'sam' }, { now: 0 }).cast;
    const given = c.character('sam').give(c.character('rico'), 'pistol', { why: 'to keep the peace', now: 10, cause: 'f1' });
    assert.deepEqual(given.character('sam').inventory.items, [{ item: 'knife', state: 'carried' }]);
    assert.deepEqual(given.character('rico').inventory.items, [{ item: 'pistol', state: 'carried' }]);
    assert.deepEqual(given.data.transfers.at(-1), { from: 'sam', to: 'rico', amount: 1, item: 'pistol', why: 'to keep the peace', at: 10, cause: 'f1' });
    const back = given.character('rico').give(given.character('sam'), 'pistol', { why: 'returned', now: 20 });
    assert.equal('cause' in back.data.transfers.at(-1)!, false);
  });

  test('cannot be given unless carried and not shown, to oneself or someone from another cast, or by or to someone unable to be there', () => {
    const c = everyone();
    const sam = c.character('sam');
    const rico = c.character('rico');
    const why = { why: 'w', now: 0 };
    assert.throws(() => rico.give(sam, 'pistol', why), RangeError);
    assert.throws(() => sam.give(sam, 'pistol', why), RangeError);
    assert.throws(() => sam.give(cast({ characters: [{ id: 'rico', name: 'Rico' }] }).character('rico'), 'pistol', why), RangeError);
    const shown = everyone().character('sam').show('pistol');
    assert.throws(() => shown.character('sam').give(shown.character('rico'), 'pistol', why), RangeError);
    const resting = everyone().character('rico').rest({ now: 0, hours: 8 });
    assert.throws(() => resting.character('sam').give(resting.character('rico'), 'knife', { why: 'w', now: 60 }), /resting/);
    const out = everyone().character('sam').damage(10);
    assert.throws(() => out.character('sam').give(out.character('rico'), 'knife', why), /unconscious/);
  });

  test('are audited: a cast whose items disagree with the transfers, that gives an item not held, or names an unknown item is refused', () => {
    const data = everyone().data;
    const edited = (d: Partial<CastRecord>) => () => castOf({ ...data, ...d });
    const [sam, rico] = data.characters;
    assert.throws(edited({ characters: [sam!, { ...rico!, inventory: { ...rico!.inventory, items: [{ item: 'knife', state: 'carried' }] } }] }), RangeError);
    const fromRico = { from: 'rico', to: 'sam', amount: 1, item: 'bottle' as const, why: 'w', at: 0 };
    assert.throws(edited({ characters: [{ ...sam!, inventory: { ...sam!.inventory, items: [...sam!.inventory.items, { item: 'bottle', state: 'carried' }] } }, rico!], transfers: [...data.transfers, fromRico] }), /without holding/);
    assert.throws(edited({ transfers: [...data.transfers, { from: 'world', to: 'sam', amount: 1, item: 'crowbar' as never, why: 'w', at: 0 }] }), /unknown item/);
  });
});
