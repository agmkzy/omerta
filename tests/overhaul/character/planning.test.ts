import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { ReplacedCastError, cast, castOf, squad, type Cast } from '../../../src/overhaul/character/cast';
import { OUTCOMES, checkOdds } from '../../../src/overhaul/character/check';
import { DICE } from '../../../src/overhaul/character/dice';
import { HARD_JOB_DC, PLAN_BANDS, PLAN_EFFECT, assertJobs, believedOutcome, type Job } from '../../../src/overhaul/character/jobs';
import { DAY } from '../../../src/overhaul/character/time';
import { labelled, scripted } from './support';

const reasons = (ms: readonly { value: number; reason: string }[]) => ms.map((m) => `${m.reason} ${m.value}`);
/** Sam (Intelligence 14, trained in Planning) and Joe plan a burglary; Rico and Vic are not in it. */
const people = () =>
  cast({
    characters: [
      { id: 'sam', name: 'Sam', attributes: attributeScores({ int: 14, agi: 14 }), training: { planning: 'trained', larceny: 'trained' }, inventory: { items: ['bottle'] } },
      { id: 'joe', name: 'Joe' },
      { id: 'rico', name: 'Rico' },
      { id: 'vic', name: 'Vic' },
    ],
  });
const started = (dc = 15, c = people()) => c.startJob({ kind: 'burglary', dc, members: ['sam', 'joe'], now: 0 });
/** A burglary planned with the given faces for Sam's Planning roll (+4: Intelligence 14, trained). */
const planned = (...faces: number[]): Cast => {
  const s = started();
  const plan = s.cast.character('sam').planning.plan(s.job, { advantageOn: { member: 'sam', skill: 'larceny' } });
  return (faces.length > 1 ? plan.helpedBy(s.cast.character('joe')) : plan).roll(scripted(...faces), { now: 10 }).cast;
};

describe('the planning rules', { tags: ['unit'] }, () => {
  test('give each outcome its effect, with a plan’s own bands', () => {
    assert.deepEqual(PLAN_BANDS, { criticalSuccess: 10, success: 5, partial: 0, failure: -10 });
    assert.deepEqual(OUTCOMES.map((o) => PLAN_EFFECT[o]?.value ?? 0), [-2, 0, 1, 2, 2]);
    assert.deepEqual(OUTCOMES.map(believedOutcome), ['failure', 'failure', 'partial', 'success', 'critical-success']);
    assert.equal(HARD_JOB_DC, 20);
  });

  test('reproduce the plan’s table of the expected modifier on each check', () => {
    const expected = (bonus: number, dc: number, helped: boolean) => {
      const odds = checkOdds({ dice: DICE.d20, edge: helped ? 'advantage' : 'none', modifiers: [{ value: bonus, reason: 'x' }], dc, bands: PLAN_BANDS });
      return OUTCOMES.reduce((sum, o) => sum + odds[o] * (PLAN_EFFECT[o]?.value ?? 0), 0) + odds['critical-success'] * 0.5;
    };
    const table: [number, number[]][] = [
      [0, [0.88, -0.05, 0.53, -0.85, -0.31]],
      [2, [1.13, 0.35, 0.9, -0.55, 0.03]],
      [4, [1.38, 0.75, 1.19, -0.25, 0.31]],
      [7, [1.75, 1.13, 1.66, 0.35, 0.9]],
    ];
    for (const [bonus, row] of table) {
      const got = [expected(bonus, 10, false), expected(bonus, 15, false), expected(bonus, 15, true), expected(bonus, 20, false), expected(bonus, 20, true)];
      got.forEach((g, i) => assert.ok(Math.abs(g - row[i]!) < 0.006, `+${bonus}, column ${i}: ${g} against ${row[i]}`));
    }
  });
});

describe('jobs', { tags: ['unit'] }, () => {
  test('are records in the cast, with ids from the counter facts share', () => {
    const c = people().record({ kind: 'theft', actor: 'rico' }, { now: 0 }).cast;
    const { job, cast: after } = c.startJob({ kind: 'burglary', dc: 15, members: ['sam', 'joe'], now: DAY });
    assert.deepEqual(job, { id: 'j2', kind: 'burglary', members: ['sam', 'joe'], dc: 15, startedAt: DAY });
    assert.deepEqual(after.jobs, [job]);
    assert.equal(after.job('j2'), after.jobs[0]);
    assert.throws(() => after.job('j9'), RangeError);
  });

  test('end when the caller ends them, and a member can be in one open job at a time', () => {
    const { cast: c } = started();
    assert.throws(() => c.startJob({ kind: 'scam', dc: 10, members: ['joe', 'vic'], now: 5 }), RangeError);
    const ended = c.endJob('j1', { now: 50 });
    assert.equal(ended.job('j1').endedAt, 50);
    assert.throws(() => ended.endJob('j1', { now: 60 }), RangeError);
    assert.doesNotThrow(() => ended.startJob({ kind: 'scam', dc: 10, members: ['joe', 'vic'], now: 60 }));
  });

  test('are refused with no members, someone not in the cast, someone named twice, or a DC that is not a whole number from 1', () => {
    const c = people();
    for (const bad of [{ members: [] }, { members: ['nobody'] }, { members: ['sam', 'sam'] }, { dc: 0 }, { dc: 2.5 }])
      assert.throws(() => c.startJob({ kind: 'scam', dc: 10, members: ['sam'], now: 0, ...bad }), RangeError, JSON.stringify(bad));
    assert.throws(() => c.startJob({ kind: 'scam', dc: 10, members: ['sam'], now: -1 }), RangeError);
    assert.equal(c.current, true);
  });

  test('that are hard make their members more ambitious', () => {
    const hard = started(20).cast;
    assert.deepEqual(hard.character('joe').conduct.map((s) => [s.conduct, s.trait, s.cause]), [['taking-a-hard-job', 'ambition', { job: 'j1' }]]);
    assert.deepEqual(started(15).cast.character('joe').conduct, []);
  });

  test('are checked when a cast is made', () => {
    const job: Job = { id: 'j1', kind: 'x', members: ['sam'], dc: 10, startedAt: 0 };
    const ids = new Set(['sam', 'joe']);
    assert.doesNotThrow(() => assertJobs([job], ids, 2));
    for (const bad of [
      [{ ...job, id: 'j2' }], [{ ...job, id: 'x1' }], [job, job], [{ ...job, members: ['nobody'] }], [{ ...job, endedAt: -5 }], [job, { ...job, id: 'j0' }],
      [{ ...job, plan: { planner: 'joe', outcome: 'success', margin: 5, at: 0 } }], [{ ...job, plan: { planner: 'sam', helper: 'sam', outcome: 'success', margin: 5, at: 0 } }],
      [{ ...job, plan: { planner: 'sam', outcome: 'success', margin: 5, at: 0, advantageOn: { member: 'joe', skill: 'larceny' } } }],
    ] as Job[][])
      assert.throws(() => assertJobs(bad, ids, 2), RangeError, JSON.stringify(bad));
  });
});

describe('a plan', { tags: ['unit'] }, () => {
  test('is a Planning roll against the job’s DC, recorded on the job, and makes the planner more cautious and ambitious', () => {
    const c = planned(8);
    const plan = c.job('j1').plan!;
    assert.deepEqual(plan, { planner: 'sam', outcome: 'failure', margin: -3, at: 10, advantageOn: { member: 'sam', skill: 'larceny' } });
    assert.deepEqual(c.character('sam').conduct.map((s) => s.trait), ['caution', 'ambition']);
  });

  test('uses Planning with the better of Intelligence and Wisdom, and a helper gives advantage', () => {
    const s = started();
    const plan = s.cast.character('sam').planning.plan(s.job);
    assert.deepEqual(reasons(plan.explain({ for: s.cast.character('sam') })), ['Intelligence 14 2', 'Trained in Planning 2']);
    const helped = plan.helpedBy('joe').roll(scripted(3, 18), { now: 0 });
    assert.equal(helped.truth.roll.edge, 'advantage');
    assert.equal(helped.cast.job('j1').plan!.helper, 'joe');
    assert.ok(plan.helpedBy('joe').odds({ for: s.cast.character('sam') }).success > plan.odds({ for: s.cast.character('sam') }).success);
  });

  test('looks like a failure to its planner, and anyone following it, when it is a critical failure; anyone outside the job knows nothing of it', () => {
    const s = started(20);
    const out = s.cast.character('sam').planning.plan(s.job).roll(scripted(1), { now: 0 });
    assert.equal(out.truth.outcome, 'critical-failure');
    assert.equal(out.result({ for: out.cast.character('sam') }).outcome, 'failure');
    assert.equal(out.result({ for: out.cast.character('joe') }).outcome, 'failure');
    assert.equal(out.result({ for: out.cast.character('vic') }).outcome, null);
  });

  test('is refused for a job that has ended or has a plan already, or by or with someone not in it', () => {
    const s = started();
    const sam = s.cast.character('sam');
    assert.throws(() => s.cast.character('rico').planning.plan(s.job), RangeError);
    assert.throws(() => sam.planning.plan(s.job).helpedBy('rico'), RangeError);
    assert.throws(() => sam.planning.plan(s.job).helpedBy('sam'), RangeError);
    assert.throws(() => sam.planning.plan(s.job, { advantageOn: { member: 'rico', skill: 'larceny' } }), RangeError);
    assert.throws(() => sam.planning.plan('j9'), RangeError);
    const once = planned(12);
    assert.throws(() => once.character('sam').planning.plan('j1'), RangeError);
    const ended = started().cast.endJob('j1', { now: 5 });
    assert.throws(() => ended.character('sam').planning.plan('j1'), RangeError);
    const out = started().cast.character('sam').damage(10);
    assert.throws(() => out.character('sam').planning.plan('j1'), RangeError);
  });

  test('is refused from a replaced cast', () => {
    const s = started();
    const plan = s.cast.character('sam').planning.plan(s.job);
    plan.roll(scripted(10), { now: 0 });
    assert.throws(() => plan.roll(scripted(10), { now: 0 }), ReplacedCastError);
  });
});

describe('a plan’s effect on the job’s checks', { tags: ['unit'] }, () => {
  test('is on every member’s skill check while the job is open, as they believe it; anyone outside it knows nothing of it', () => {
    const c = planned(12); // 16 against 15: partial success
    const joe = c.character('joe');
    const check = joe.check('stealth', 12);
    assert.deepEqual(reasons(check.explain({ for: joe })), ['Agility 10 0', 'A rough plan 1']);
    assert.deepEqual(reasons(check.explain({ for: c.character('sam') })), ['A rough plan 1']);
    assert.deepEqual(check.explain({ for: c.character('vic') }), []);
    assert.equal(check.roll(scripted(11), { now: 20 }).truth.outcome, 'partial');
    assert.deepEqual(reasons(c.character('rico').check('stealth', 12).explain({ for: c.character('rico') })), ['Agility 10 0']);
  });

  test('counts for real on a critical failure, though its members do not see it', () => {
    const s = started(20);
    const c = s.cast.character('sam').planning.plan(s.job).roll(scripted(1), { now: 0 }).cast;
    const check = c.character('joe').check('stealth', 10);
    assert.deepEqual(reasons(check.explain({ for: c.character('joe') })), ['Agility 10 0']);
    assert.equal(check.roll(scripted(11), { now: 5 }).truth.outcome, 'failure');
  });

  test('gives a critical success’s advantage on the chosen check once', () => {
    const s = started(10);
    const c = s.cast.character('sam').planning.plan(s.job, { advantageOn: { member: 'sam', skill: 'larceny' } }).roll(scripted(19), { now: 10 }).cast; // 23 against 10
    const sam = c.character('sam');
    const first = sam.check('larceny', 15, { situation: 'locks' }).roll(scripted(4, 17), { now: 20 });
    assert.equal(first.truth.roll.edge, 'advantage');
    assert.equal(first.cast.job('j1').plan!.advantageUsed, true);
    const second = first.cast.character('sam').check('larceny', 15).roll(scripted(4), { now: 30 });
    assert.equal(second.truth.roll.edge, 'none');
    assert.equal(second.cast.character('joe').check('larceny', 15).roll(scripted(4), { now: 40 }).truth.roll.edge, 'none');
    assert.equal(sam.check('larceny', 15).odds({ for: sam })['critical-success'] > sam.check('larceny', 15).odds({ for: c.character('vic') })['critical-success'], true);
  });

  test('ends with the job', () => {
    const c = planned(12).endJob('j1', { now: 50 });
    assert.deepEqual(reasons(c.character('joe').check('stealth', 12).explain({ for: c.character('joe') })), ['Agility 10 0']);
  });

  test('counts on social rolls, on drinking and on an ambush’s Stealth, but not on fight rolls', () => {
    const c = planned(16); // 20 against 15: success
    const { sam, rico } = { sam: c.character('sam'), rico: c.character('rico') };
    assert.ok(reasons(sam.social.persuade(rico).explain({ for: sam }).actor).includes('A good plan 2'));
    assert.ok(reasons(rico.social.persuade(sam).explain({ for: sam }).target).includes('A good plan 2'));
    const drunk = sam.drink(scripted(10), { now: 20 });
    assert.equal(drunk.result.roll.total, 10 + 0 + 2);
    const after = drunk.cast;
    const fought = squad(after.character('sam'), after.character('joe'))
      .fight(squad(after.character('rico')), { kind: 'real', start: 'ambush' })
      .roll(labelled({ initiative: [15, 14, 5], stealth: [8, 8], attack: [20], damage: [4, 4], nerve: [2] }), { now: 20 });
    const ambush = fought.result.events.find((e) => e.kind === 'ambush')!;
    assert.ok(ambush.kind === 'ambush' && ambush.stealth.modifiers.some((m) => m.reason === 'A good plan'));
    const attacks = fought.result.events.filter((e) => e.kind === 'attack');
    for (const a of attacks) assert.ok(a.kind === 'attack' && !a.result.roll.modifiers.some((m) => m.reason.includes('plan')));
  });

  test('gives its advantage to the chosen social roll, drink or ambush roll, and uses it up', () => {
    const plan = (skill: 'persuasion' | 'carousing' | 'stealth') => {
      const s = started(10);
      return s.cast.character('sam').planning.plan(s.job, { advantageOn: { member: 'sam', skill } }).roll(scripted(19), { now: 0 }).cast;
    };
    const persuaded = plan('persuasion');
    const p = persuaded.character('sam').social.persuade(persuaded.character('rico')).roll(scripted(3, 18, 10), { now: 5 });
    assert.equal(p.truth.check.active.edge, 'advantage');
    assert.equal(p.cast.job('j1').plan!.advantageUsed, true);
    const drinking = plan('carousing');
    const d = drinking.character('sam').drink(scripted(3, 18), { now: 5 });
    assert.equal(d.result.roll.edge, 'advantage');
    assert.equal(d.cast.job('j1').plan!.advantageUsed, true);
    const ambushing = plan('stealth');
    const f = squad(ambushing.character('sam')).fight(squad(ambushing.character('rico')), { kind: 'real', start: 'ambush' }).roll(labelled({ initiative: [15, 5], stealth: [2, 18], attack: [20], damage: [4, 4], nerve: [2] }), { now: 5 });
    assert.equal(f.cast.job('j1').plan!.advantageUsed, true);
  });
});

describe('two jobs at once', { tags: ['unit'] }, () => {
  test('keep their plans, advantages and ends apart', () => {
    const a = people().startJob({ kind: 'burglary', dc: 10, members: ['sam', 'joe'], now: 0 });
    const b = a.cast.startJob({ kind: 'scam', dc: 10, members: ['rico', 'vic'], now: 0 });
    const planned = b.cast.character('sam').planning.plan('j1', { advantageOn: { member: 'sam', skill: 'larceny' } }).helpedBy(b.cast.character('joe')).roll(scripted(19, 2), { now: 1 }).cast;
    assert.equal(planned.job('j2').plan, undefined);
    const used = planned.character('sam').check('larceny', 10).roll(scripted(5, 6), { now: 2 }).cast;
    assert.deepEqual([used.job('j1').plan!.advantageUsed, used.job('j2').plan], [true, undefined]);
    const ended = used.endJob('j1', { now: 3 });
    assert.deepEqual([ended.job('j1').endedAt, ended.job('j2').endedAt], [3, undefined]);
  });

  test('a failed plan adds nothing to an ambush’s Stealth', () => {
    const s = started(20);
    const c = s.cast.character('sam').planning.plan(s.job).roll(scripted(8), { now: 0 }).cast;
    const f = squad(c.character('sam')).fight(squad(c.character('rico')), { kind: 'real', start: 'ambush' }).roll(labelled({ initiative: [15, 5], stealth: [12], attack: [20], damage: [4, 4], nerve: [2] }), { now: 1 });
    const ambush = f.result.events.find((e) => e.kind === 'ambush')!;
    assert.ok(ambush.kind === 'ambush' && ambush.stealth.modifiers.every((m) => !m.reason.includes('plan')));
  });

  test('conduct naming a job must have it started first', () => {
    const c = started(20).cast;
    const joe = c.data.characters.find((x) => x.id === 'joe')!;
    const early = { ...c.data, characters: c.data.characters.map((x) => (x.id === 'joe' ? { ...joe, conduct: [{ ...joe.conduct[0]!, cause: { job: 'j9' } }] } : x)) };
    assert.throws(() => castOf(early), RangeError);
  });
});

describe('skill checks', { tags: ['unit'] }, () => {
  test('roll a character’s skill against a DC, in a situation and with items used', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam', attributes: attributeScores({ agi: 14 }), training: { larceny: 'trained' }, inventory: { items: ['lockpicks'] } }, { id: 'rico', name: 'Rico' }] });
    const sam = c.character('sam');
    const check = sam.check('larceny', 15, { situation: 'locks', using: ['lockpicks'] });
    assert.deepEqual(reasons(check.explain({ for: sam })), ['Agility 14 2', 'Trained in Larceny 2', 'Lockpicks 2']);
    assert.deepEqual(reasons(check.explain({ for: c.character('rico') })), ['Lockpicks 2']);
    assert.ok(check.odds({ for: sam }).success > check.odds({ for: c.character('rico') }).success);
    const out = check.with({ value: 1, reason: 'A quiet street' }).roll(scripted(9), { now: 0, witnesses: ['rico'] });
    assert.deepEqual([out.truth.roll.total, out.truth.outcome], [16, 'partial']);
    assert.deepEqual(out.result({ for: out.cast.character('rico') }), { outcome: 'partial', explanation: [{ value: 2, reason: 'Lockpicks' }, { value: 1, reason: 'A quiet street' }] });
  });

  test('give their result only to the one who made it and whoever watched', () => {
    const people = () => cast({ characters: ['sam', 'rico', 'joe'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })) });
    const out = people().character('sam').check('stealth', 10).roll(scripted(15), { now: 0, witnesses: ['rico'] });
    assert.equal(out.result({ for: out.cast.character('sam') }).outcome, 'success');
    assert.equal(out.result({ for: out.cast.character('rico') }).outcome, 'success');
    assert.deepEqual(out.result({ for: out.cast.character('joe') }), { outcome: null, explanation: null });
    assert.throws(() => people().character('sam').check('stealth', 10).roll(scripted(15), { now: 0, witnesses: ['nobody'] }), RangeError);
    const resting = people().character('rico').rest({ now: 0, hours: 8 });
    assert.throws(() => resting.character('sam').check('stealth', 10).roll(scripted(15), { now: 60, witnesses: ['rico'] }), /resting/);
  });

  test('are refused by someone unconscious, against a DC that is not a whole number, for a viewer from another cast, or from a replaced cast', () => {
    const c = cast({ characters: [{ id: 'sam', name: 'Sam' }] });
    assert.throws(() => c.character('sam').check('stealth', 10.5), RangeError);
    const out = c.character('sam').damage(10);
    assert.throws(() => out.character('sam').check('stealth', 10), RangeError);
    const fresh = cast({ characters: [{ id: 'sam', name: 'Sam' }] });
    const check = fresh.character('sam').check('stealth', 10);
    assert.throws(() => check.odds({ for: cast({ characters: [{ id: 'sam', name: 'Sam' }] }).character('sam') }), RangeError);
    assert.throws(() => check.roll(scripted(10), { now: -1 }), RangeError);
    check.roll(scripted(10), { now: 0 });
    assert.throws(() => check.roll(scripted(10), { now: 0 }), ReplacedCastError);
  });
});
