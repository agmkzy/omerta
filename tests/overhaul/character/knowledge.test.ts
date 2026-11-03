import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ReplacedCastError, cast, castOf } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import { ADDED_FACT_KINDS, FACT_KINDS, GAME_FACT_KINDS, assertFact, auditFacts, type Fact } from '../../../src/overhaul/character/facts';
import { auditKnowledge, firstVersions, partOf, passOn, rebelieve, toldVersion, type Version } from '../../../src/overhaul/character/knowledge';
import { SUSPECT_GRUDGE } from '../../../src/overhaul/character/learning';
import { NEW_RELATIONSHIP } from '../../../src/overhaul/character/relationships';
import { DAY } from '../../../src/overhaul/character/time';
import { scripted } from './support';

const people = () => cast({ characters: ['sam', 'rico', 'joe', 'vic'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })) });
const fact = (over: Partial<Fact> = {}): Fact => ({ id: 'f1', kind: 'beating', actor: 'sam', victim: 'rico', at: 0, witnesses: [], ...over });
const ids = new Set(['sam', 'rico', 'joe']);
const seen = (source: Version['source'], knowsActor = true, at = 0): Version => ({ learnedAt: at, source, how: 'seen', knowsActor });

describe('fact kinds', { tags: ['unit'] }, () => {
  test('are the game’s, in its order, read from its source so the two cannot drift apart', () => {
    // (read as text, not imported: the overhaul imports nothing from the game)
    const types = readFileSync(new URL('../../../src/types.ts', import.meta.url), 'utf8');
    const union = /export type FactKind =([^;]*);/.exec(types)?.[1] ?? '';
    assert.deepEqual([...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), [...GAME_FACT_KINDS]);
  });

  test('add fight, persuasion and lie, which the game does not have', () => {
    assert.deepEqual(ADDED_FACT_KINDS, ['fight', 'persuasion', 'lie']);
    assert.deepEqual(FACT_KINDS, [...GAME_FACT_KINDS, ...ADDED_FACT_KINDS]);
    for (const k of ADDED_FACT_KINDS) assert.ok(!(GAME_FACT_KINDS as readonly string[]).includes(k), k);
  });
});

describe('assertFact and auditFacts', { tags: ['unit'] }, () => {
  test('accept a complete, consistent fact', () => {
    assert.doesNotThrow(() => assertFact(fact({ witnesses: ['joe'], amount: 40, where: 'the docks', story: 'fight-1' }), ids, new Set()));
    assert.doesNotThrow(() => assertFact(fact({ id: 'f2', cause: 'f1' }), ids, new Set(['f1'])));
    assert.doesNotThrow(() => assertFact(fact({ kind: 'lie', ending: 'provoked', claim: { blame: 'joe' } }), ids, new Set()));
  });

  test('refuse a fact that is incomplete or inconsistent', () => {
    for (const bad of [
      fact({ kind: 'picnic' as never }), fact({ at: -1 }), fact({ actor: 'nobody' }), fact({ witnesses: ['nobody'] }), fact({ witnesses: ['sam'] }),
      fact({ victim: 'sam' }), fact({ cause: 'f9' }), fact({ amount: -5 }), fact({ amount: 1.5 }), fact({ actor: undefined, hiddenActor: true } as never),
      fact({ invented: 'nobody' }), fact({ invented: 'joe', witnesses: ['joe'], actor: 'rico', victim: 'sam' }),
      fact({ ending: 'great' as never }), fact({ claim: { blame: 'joe' } }), fact({ kind: 'lie', claim: { blame: 'nobody' } }),
    ])
      assert.throws(() => assertFact(bad, ids, new Set()), RangeError, JSON.stringify(bad));
  });

  test('need facts in time order, with distinct ids made by the counter', () => {
    assert.doesNotThrow(() => auditFacts([fact(), fact({ id: 'f2', at: 5 })], ids, 3));
    assert.throws(() => auditFacts([fact({ id: 'f2', at: 5 }), fact({ at: 0 })], ids, 3), RangeError);
    assert.throws(() => auditFacts([fact(), fact()], ids, 3), RangeError);
    assert.throws(() => auditFacts([fact({ id: 'f3' })], ids, 3), RangeError);
    assert.throws(() => auditFacts([fact({ id: 'x1' })], ids, 3), RangeError);
    assert.throws(() => auditFacts([], ids, 0), RangeError);
  });
});

describe('firstVersions', { tags: ['unit'] }, () => {
  test('whoever did it, whoever it was done to and the witnesses learn it, all having seen it', () => {
    assert.deepEqual(firstVersions(fact({ witnesses: ['joe'], at: 30 })), [
      ['sam', seen('self', true, 30)],
      ['rico', seen('witness', true, 30)],
      ['joe', seen('witness', true, 30)],
    ]);
  });

  test('a victim does not learn who did it when the actor is hidden; a witness does', () => {
    assert.deepEqual(firstVersions(fact({ hiddenActor: true, witnesses: ['joe'] })), [['sam', seen('self')], ['rico', seen('witness', false)], ['joe', seen('witness')]]);
  });

  test('a fact no one did is learned by whoever it was done to and the witnesses', () => {
    assert.deepEqual(firstVersions(fact({ kind: 'event', actor: undefined, witnesses: ['joe'] } as never)), [['rico', seen('witness')], ['joe', seen('witness')]]);
  });

  test('nobody learns an invented fact by its being recorded', () => {
    assert.deepEqual(firstVersions(fact({ invented: 'joe' })), []);
  });
});

describe('toldVersion and rebelieve', { tags: ['unit'] }, () => {
  test('a witness’s telling is told; anyone else’s is heard, and passes on what the teller believes', () => {
    assert.deepEqual(toldVersion('joe', seen('witness'), 60), { learnedAt: 60, source: 'told', teller: 'joe', how: 'told', knowsActor: true });
    const second = toldVersion('vic', { learnedAt: 60, source: 'told', teller: 'joe', how: 'told', knowsActor: false, blame: 'joe', exaggerated: true }, 90);
    assert.deepEqual(second, { learnedAt: 90, source: 'told', teller: 'vic', how: 'heard', knowsActor: false, blame: 'joe', exaggerated: true });
  });

  test('a part passed on keeps how the teller came by it: a guess stays a guess', () => {
    const guessing: Version = { learnedAt: 60, source: 'witness', how: 'seen', knowsActor: false, blame: 'joe', who: { how: 'guessed' } };
    assert.deepEqual(toldVersion('vic', guessing, 90), { learnedAt: 90, source: 'told', teller: 'vic', how: 'told', knowsActor: false, blame: 'joe', who: { how: 'guessed', teller: 'vic' } });
    assert.deepEqual(passOn({ how: 'heard', teller: 'joe' }, 'vic'), { how: 'heard', teller: 'vic' });
  });

  test('naming who did it turns knowing into believing, with only that part’s provenance changed', () => {
    const changed = rebelieve(seen('witness', true, 10), { part: 'who', knowsActor: false, blame: 'vic', from: { how: 'told', teller: 'joe' } });
    assert.deepEqual(changed, { learnedAt: 10, source: 'witness', how: 'seen', knowsActor: false, blame: 'vic', who: { how: 'told', teller: 'joe' } });
    assert.deepEqual(partOf(changed, 'size'), { how: 'seen' });
    assert.deepEqual(partOf(changed, 'who'), { how: 'told', teller: 'joe' });
  });

  test('saying how big it was changes only that, keeping whom they blame and how they came by it', () => {
    const blaming: Version = { learnedAt: 10, source: 'told', teller: 'joe', how: 'told', knowsActor: false, blame: 'joe' };
    assert.deepEqual(rebelieve(blaming, { part: 'size', exaggerated: true, from: { how: 'told', teller: 'vic' } }), { ...blaming, exaggerated: true, size: { how: 'told', teller: 'vic' } });
    assert.deepEqual(rebelieve({ ...seen('witness'), exaggerated: true }, { part: 'size', exaggerated: false, from: { how: 'seen' } }), seen('witness'));
  });

  test('a part with no belief of its own has no provenance; one recorded where it differs is kept', () => {
    assert.equal(partOf(seen('witness', false), 'who'), undefined);
    assert.deepEqual(partOf({ ...seen('witness', false), blame: 'joe' }, 'who'), { how: 'seen' });
  });
});

describe('auditKnowledge', { tags: ['unit'] }, () => {
  const knowing = (id: string, knowledge: Record<string, Version>) => createCharacter({ id, name: id, knowledge });

  test('passes knowledge that fits the facts', () => {
    assert.doesNotThrow(() => auditKnowledge([knowing('sam', { f1: seen('self') }), knowing('rico', { f1: toldVersion('sam', seen('self'), 5) })], [fact()]));
    assert.doesNotThrow(() => auditKnowledge([knowing('joe', { f1: { ...seen('self'), knownFalse: true } }), knowing('sam', {})], [fact({ invented: 'joe', actor: 'sam', victim: undefined } as never)]));
  });

  test('fails knowledge of no recorded fact, learned before it happened, with a wrong teller or blame, or known false by someone else', () => {
    const one = (v: Version, f: Fact = fact()) => () => auditKnowledge([knowing('sam', { f1: v }), knowing('rico', {})], [f]);
    assert.throws(() => auditKnowledge([knowing('sam', { f9: seen('self') })], [fact()]), RangeError);
    assert.throws(one(seen('self', true, 0), fact({ at: 10 })), RangeError);
    assert.throws(one({ ...seen('self'), learnedAt: 0.5 }), RangeError);
    assert.throws(one({ ...seen('told') }), RangeError);
    assert.throws(one({ ...seen('witness'), teller: 'rico' }), RangeError);
    assert.throws(one({ ...seen('told'), teller: 'sam' }), RangeError);
    assert.throws(one({ ...seen('told'), teller: 'nobody' }), RangeError);
    assert.throws(one({ ...seen('witness'), blame: 'nobody' }), RangeError);
    assert.throws(one({ ...seen('self'), knownFalse: true }), RangeError);
  });
});

describe('recording facts', { tags: ['unit'] }, () => {
  test('stores the fact once, with an id from the counter, and gives each who learns it their own version', () => {
    const { fact: f, cast: after } = people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: DAY, witnesses: ['joe'] });
    assert.deepEqual(f, { kind: 'beating', actor: 'sam', victim: 'rico', id: 'f1', at: DAY, witnesses: ['joe'] });
    assert.deepEqual(after.facts, [f]);
    assert.equal(after.fact('f1'), f);
    assert.equal(after.data.nextId, 2);
    assert.deepEqual(after.character('sam').versionOf('f1'), seen('self', true, DAY));
    assert.deepEqual(after.character('rico').versionOf('f1'), seen('witness', true, DAY));
    assert.deepEqual(after.character('joe').versionOf('f1'), seen('witness', true, DAY));
    assert.equal(after.character('vic').versionOf('f1'), undefined);
    assert.deepEqual(after.character('vic').knowledge, {});
  });

  test('shares the records of those who do not learn it', () => {
    const before = people();
    const after = before.record({ kind: 'theft', actor: 'sam' }, { now: 0 }).cast;
    assert.notEqual(after.data.characters[0], before.data.characters[0]);
    assert.equal(after.data.characters[1], before.data.characters[1]);
  });

  test('refuses a fact naming someone not in the cast, a fact before the last one, or an unknown id', () => {
    const later = people().record({ kind: 'theft', actor: 'sam' }, { now: DAY }).cast;
    assert.throws(() => later.record({ kind: 'theft', actor: 'nobody' }, { now: DAY }), RangeError);
    assert.throws(() => later.record({ kind: 'theft', actor: 'sam' }, { now: 0 }), RangeError);
    assert.throws(() => later.fact('f9'), RangeError);
    assert.equal(later.current, true);
  });

  test('links a fact to the one that caused it', () => {
    const first = people().record({ kind: 'threat', actor: 'sam', victim: 'rico' }, { now: 0 });
    const second = first.cast.record({ kind: 'beating', actor: 'rico', victim: 'sam', cause: first.fact.id }, { now: 10 });
    assert.equal(second.fact.cause, 'f1');
    assert.equal(second.fact.id, 'f2');
  });

  test('from a replaced cast is refused', () => {
    const start = people();
    start.record({ kind: 'theft', actor: 'sam' }, { now: 0 });
    assert.throws(() => start.record({ kind: 'theft', actor: 'rico' }, { now: 0 }), ReplacedCastError);
  });
});

describe('telling', { tags: ['unit'] }, () => {
  const beaten = () => people().record({ kind: 'beating', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 0, witnesses: ['joe'] }).cast;

  test('passes on what the teller believes, as told by a witness or heard second-hand', () => {
    const c = beaten();
    const toldVic = c.character('joe').social.tell(c.character('vic'), 'f1').roll(scripted(), { now: 60 }).cast;
    assert.deepEqual(toldVic.character('vic').versionOf('f1'), { learnedAt: 60, source: 'told', teller: 'joe', how: 'told', knowsActor: true });
  });

  test('a teller who does not know who did it passes that on too', () => {
    const c = beaten();
    const told = c.character('rico').social.tell(c.character('vic'), 'f1').roll(scripted(), { now: 60 }).cast;
    assert.equal(told.character('vic').versionOf('f1')!.knowsActor, false);
    const second = told.character('vic').social.tell(told.character('joe'), 'f1').roll(scripted(), { now: 90 }).cast;
    assert.deepEqual(second.character('joe').versionOf('f1'), seen('witness'));
  });

  test('a second-hand telling is heard', () => {
    const c = beaten();
    const once = c.character('joe').social.tell(c.character('vic'), 'f1').roll(scripted(), { now: 60 }).cast;
    const twice = once.add({ id: 'al', name: 'Al' });
    assert.equal(twice.character('vic').social.tell(twice.character('al'), 'f1').roll(scripted(), { now: 90 }).cast.character('al').versionOf('f1')!.how, 'heard');
  });

  test('a listener who knows of it but not who did it has the gap filled, with no roll', () => {
    const c = beaten();
    const out = c.character('joe').social.tell(c.character('rico'), 'f1').roll(scripted(), { now: 60 });
    assert.deepEqual(out.cast.character('rico').versionOf('f1'), { ...seen('witness', true), who: { how: 'told', teller: 'joe' } });
    assert.deepEqual(out.truth, { roll: null, changed: ['who'], exposed: [] });
  });

  test('a listener who already believes it changes nothing', () => {
    const c = beaten();
    const out = c.character('joe').social.tell(c.character('sam'), 'f1').roll(scripted(), { now: 60 });
    assert.deepEqual(out.truth, { roll: null, changed: [], exposed: [] });
    assert.deepEqual(out.cast.character('sam').versionOf('f1'), seen('self'));
  });

  test('refuses telling what the teller does not know, before they knew it, themselves, or someone from another cast', () => {
    const c = beaten();
    assert.throws(() => c.character('vic').social.tell(c.character('sam'), 'f1').roll(scripted(), { now: 60 }).cast, RangeError);
    assert.throws(() => c.character('joe').social.tell(c.character('joe'), 'f1').roll(scripted(), { now: 60 }).cast, RangeError);
    assert.throws(() => c.character('joe').social.tell(people().character('vic'), 'f1'), RangeError);
    const late = people().record({ kind: 'theft', actor: 'sam' }, { now: DAY }).cast;
    assert.throws(() => late.character('sam').social.tell(late.character('vic'), 'f1').roll(scripted(), { now: 0 }).cast, RangeError);
    assert.throws(() => late.character('sam').social.tell(late.character('vic'), 'f1').roll(scripted(), { now: -1 }).cast, RangeError);
  });

  test('refuses telling a fact the teller knows is false: that would be a lie', () => {
    const data = people().data;
    const invented = castOf({
      ...data,
      facts: [{ id: 'f1', kind: 'robbery', actor: 'rico', invented: 'sam', at: 0, witnesses: [] }],
      nextId: 2,
      characters: data.characters.map((c) => (c.id === 'sam' ? createCharacter({ ...c, knowledge: { f1: { ...seen('self'), knownFalse: true } } }) : c)),
    });
    assert.throws(() => invented.character('sam').social.tell(invented.character('vic'), 'f1').roll(scripted(), { now: 10 }).cast, RangeError);
  });
});

describe('knowledge', { tags: ['property'] }, () => {
  test('passed from person to person always fits the facts, and no one learns what nobody told them', () => {
    const tell = fc.record({ from: fc.integer({ min: 0, max: 3 }), to: fc.integer({ min: 0, max: 3 }) });
    fc.assert(
      fc.property(fc.array(tell, { maxLength: 20 }), fc.boolean(), (tellings, hidden) => {
        const order = ['sam', 'rico', 'joe', 'vic'];
        let c = people().record({ kind: 'robbery', actor: 'sam', victim: 'rico', ...(hidden && { hiddenActor: true as const }) }, { now: 0 }).cast;
        const knew = new Set(['sam', 'rico']);
        tellings.forEach((t, i) => {
          const from = c.character(order[t.from]!);
          if (t.from !== t.to && from.versionOf('f1')) {
            c = from.social.tell(c.character(order[t.to]!), 'f1').roll(scripted(), { now: i + 1 }).cast;
            knew.add(order[t.to]!);
          }
        });
        assert.doesNotThrow(() => auditKnowledge(c.data.characters, c.data.facts));
        assert.deepEqual(order.filter((id) => c.character(id).versionOf('f1')), order.filter((id) => knew.has(id)));
        // (passing on the truth never needs a roll, and never makes anyone believe someone else did it)
        for (const id of order) {
          const v = c.character(id).versionOf('f1');
          if (v?.knowsActor || v?.blame) assert.ok(v.knowsActor && v.blame === undefined, id);
        }
      }),
    );
  });
});

describe('guessing a hidden actor', { tags: ['unit'] }, () => {
  /** Rico saw Joe beat Vic, and holds a grudge against Joe and against Al. */
  const suspicious = (grudges: Record<string, number>) => {
    const base = cast({
      characters: ['sam', 'rico', 'joe', 'vic', 'al'].map((id) => ({
        id,
        name: id[0]!.toUpperCase() + id.slice(1),
        ...(id === 'rico' && { relationships: Object.fromEntries(Object.entries(grudges).map(([who, grudge]) => [who, { ...NEW_RELATIONSHIP, grudge }])) }),
      })),
    });
    return base.record({ kind: 'beating', actor: 'joe', victim: 'vic' }, { now: 0, witnesses: ['rico'] }).cast;
  };

  test('the victim blames whoever they hold the biggest grudge against, of those they know to be violent, as a guess', () => {
    const c = suspicious({ joe: 0.4, al: 0.6 }).record({ kind: 'robbery', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 10 }).cast;
    const v = c.character('rico').versionOf('f2')!;
    assert.deepEqual([v.knowsActor, v.blame, v.who], [false, 'joe', { how: 'guessed' }]);
    assert.ok(c.character('rico').towards(c.character('joe'))!.grudge > 0.4);
  });

  test('no one is guessed below the grudge that makes a suspect, on a tie, or for a kind that changes no feelings', () => {
    const blame = (c: ReturnType<typeof suspicious>, kind: 'robbery' | 'poach' | 'theft') => c.record({ kind, actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 10 }).cast.character('rico').versionOf('f2')!.blame;
    assert.equal(SUSPECT_GRUDGE, 0.3);
    assert.equal(blame(suspicious({ joe: 0.29 }), 'robbery'), undefined);
    assert.equal(blame(suspicious({ joe: 0.5 }), 'theft'), undefined);
    assert.equal(blame(suspicious({ joe: 0.5, al: 0.5 }), 'poach'), undefined);
    // a kind that is not violent needs no one known to be violent
    assert.equal(blame(suspicious({ al: 0.5 }), 'poach'), 'al');
    assert.equal(blame(suspicious({ al: 0.5 }), 'robbery'), undefined);
  });

  test('a guess passed on is heard as a guess, and a witness can correct it with a roll, against no knowledge modifier', () => {
    const c = suspicious({ joe: 0.5 }).record({ kind: 'robbery', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 10, witnesses: ['al'] }).cast;
    const told = c.character('rico').social.tell(c.character('vic'), 'f2').roll(scripted(), { now: 20 }).cast;
    assert.deepEqual(partOf(told.character('vic').versionOf('f2')!, 'who'), { how: 'guessed', teller: 'rico' });
    const correcting = told.character('al').social.tell(told.character('rico'), 'f2');
    assert.deepEqual(correcting.explain({ for: told.character('rico') }), []);
    const out = correcting.roll(scripted(12), { now: 30 });
    assert.deepEqual([out.truth.changed, out.cast.character('rico').versionOf('f2')!.knowsActor], [['who'], true]);
  });
});

describe('public facts', { tags: ['unit'] }, () => {
  test('are heard by those they are made public to, who know who did it unless the actor is hidden, and do not guess', () => {
    const c = people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 5, public: ['vic'] }).cast;
    assert.deepEqual(c.character('vic').versionOf('f1'), { learnedAt: 5, source: 'public', how: 'heard', knowsActor: true });
    assert.deepEqual(c.fact('f1').witnesses, []);
    assert.equal(c.character('vic').towards(c.character('sam'))!.lastMet, undefined);
    const hidden = people().record({ kind: 'beating', actor: 'sam', victim: 'rico', hiddenActor: true }, { now: 5, public: ['vic'] }).cast;
    assert.deepEqual(hidden.character('vic').versionOf('f1'), { learnedAt: 5, source: 'public', how: 'heard', knowsActor: false });
  });

  test('are refused for anyone named in the fact, named twice, or not in the cast', () => {
    for (const heard of [['sam'], ['vic', 'vic'], ['nobody'], ['joe']])
      assert.throws(() => people().record({ kind: 'beating', actor: 'sam', victim: 'rico' }, { now: 0, witnesses: ['joe'], public: heard }), RangeError, JSON.stringify(heard));
  });
});

describe('who can be there', { tags: ['unit'] }, () => {
  test('a witness or whoever did it must be conscious and not resting; whoever it was done to need not be there', () => {
    const out = people().character('joe').damage(10);
    assert.throws(() => out.record({ kind: 'theft', actor: 'sam' }, { now: 0, witnesses: ['joe'] }), RangeError);
    const resting = () => people().character('joe').rest({ now: 0, hours: 8 });
    assert.throws(() => resting().record({ kind: 'theft', actor: 'sam' }, { now: 60, witnesses: ['joe'] }), RangeError);
    assert.throws(() => resting().record({ kind: 'theft', actor: 'joe' }, { now: 60 }), RangeError);
    assert.doesNotThrow(() => resting().record({ kind: 'theft', actor: 'sam', victim: 'joe' }, { now: 60 }));
    assert.doesNotThrow(() => resting().record({ kind: 'theft', actor: 'sam' }, { now: 8 * 60, witnesses: ['joe'] }));
    // a fact with no one known to have done it needs only its witnesses there
    assert.throws(() => resting().record({ kind: 'theft', victim: 'sam' }, { now: 60, witnesses: ['joe'] }), RangeError);
  });

  test('in a social roll, the two in it and any witnesses must be there', () => {
    const out = people().character('joe').damage(10);
    assert.throws(() => out.character('sam').social.persuade(out.character('rico')).roll(scripted(10, 10), { now: 0, witnesses: ['joe'] }), RangeError);
    const resting = people().character('rico').rest({ now: 0, hours: 8 });
    assert.throws(() => resting.character('sam').social.persuade(resting.character('rico')).roll(scripted(10, 10), { now: 60 }), RangeError);
    const p = people();
    assert.throws(() => p.character('sam').social.persuade(p.character('rico')).roll(scripted(10, 10), { now: 0, witnesses: ['nobody'] }), RangeError);
  });
});
