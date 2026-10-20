// NPC goals: their shape, how they end, their bounds, and that a world full of plans conserves money, stays sound and
// survives a save. From the V74 suite.
import assert from 'node:assert';
import { beforeAll, afterEach, describe, test as ok } from 'vitest';
import { DAYS, SEEDS } from '../modes';
import { SCHEMA, advance, deserialize, serialize } from '../../engine';
import { createWorld } from '../../world';
import { DAY, WEEK } from '../../types';
import { audit } from '../../consistency';
import { ledgerCheck } from '../../econ';
import { AGENCY, agencyIssues, agencyOf, agencyWeek, begin, endGoal, goalsOf, stepGoal, wealthReport } from '../../goals';
import { agencyWorld, npcs, pair, aimed } from './fixtures';

// Some checks switch on the per-step money audit; a failing one must not leave it on for the next.
const AUDIT = AGENCY.audit;
afterEach(() => { AGENCY.audit = AUDIT; });

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { agencyWorld(7, 20); });

describe('goals', () => {
  ok('a goal carries the specified structure', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0];
    const g = begin(w, c, 'wealth', 'why', 0.5, { stage: 'build', need: 900 });
    for (const k of ['id', 'who', 'kind', 'motive', 'priority', 'stage', 'need', 'have', 'next', 'progress', 'started', 'review', 'deadline', 'tries']) assert.ok(k in g, k);
    assert.equal(g.who, c.id); assert.equal(agencyOf(w).stats['started.wealth'], 1);
  });
  ok('a new world and an old one both have an agency (shape + schema)', { tags: ['compat'] }, () => {
    const w = createWorld(3); assert.deepEqual(w.agency!.goals, []);
    const o = JSON.parse(serialize(w)); delete o.agency; o.schema = 4;
    const l = deserialize(JSON.stringify(o)); assert.equal(l.schema, SCHEMA); assert.deepEqual(l.agency!.goals, []);
    advance(l, l.now + 14 * DAY); assert.deepEqual(audit(l), []);
  });
  ok('a man who loses his savings or goes to prison for long drops the plan (reprioritises)', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); const { b, buyer } = pair(w);
    const g = aimed(w, buyer, b, 'save'); g.have = 40000; buyer.cash = 2000; g.need = 30000; stepGoal(w, g, buyer);
    assert.equal(agencyOf(w).ended.at(-1)!.how, 'dropped'); assert.match(agencyOf(w).ended.at(-1)!.why, /savings/);
    const g2 = aimed(w, buyer, b, 'save'); buyer.jailedUntil = w.now + 120 * DAY; stepGoal(w, g2, buyer);
    assert.equal(agencyOf(w).ended.at(-1)!.how, 'dropped'); assert.match(agencyOf(w).ended.at(-1)!.why, /locked up/);
  });
  ok('goals end when the man dies; nothing is left behind', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0]; begin(w, c, 'wealth', 'x', 0.5, { stage: 'build', need: 1e6 });
    c.alive = false; agencyWeek(w); assert.equal(goalsOf(w, c.id).length, 0); assert.equal(agencyOf(w).ended.at(-1)!.why, 'he died');
  });
  ok('the ended ring and the per-man cap are bounded', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0];
    for (let i = 0; i < 200; i++) { const g = begin(w, c, 'wealth', 'x', 0.5, { stage: 'build' }); endGoal(w, g, 'dropped', 't' + i); }
    assert.equal(agencyOf(w).ended.length, AGENCY.caps.ended);
    for (let i = 0; i < 40; i++) { agencyOf(w).cool = {}; agencyWeek(w); w.now += WEEK; }
    for (const x of Object.values(w.chars)) assert.ok(goalsOf(w, x.id).length <= AGENCY.caps.perMan);
  });
  ok('the audit catches a broken goal', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0]; const g = begin(w, c, 'debt', 'x', 0.5, { target: 'nope' });
    assert.ok(agencyIssues(w).length >= 1); endGoal(w, g, 'dropped', 'x'); assert.deepEqual(agencyIssues(w), []);
  });
  ok('a 60-day run: money conserved by every goal step, audit clean, deterministic', { tags: ['sim'] }, () => {
    const run = () => { const w = createWorld(5, 'Tony Marino'); AGENCY.audit = true; advance(w, w.now + 60 * DAY); AGENCY.audit = false; return w; };
    const a = run(), b = run();
    assert.equal(agencyOf(a).stats.leak ?? 0, 0); assert.deepEqual(audit(a), []); assert.deepEqual(ledgerCheck(a), []);
    assert.equal(serialize(a), serialize(b));
  });
  ok('save and load in the middle of live plans changes nothing', { tags: ['determinism'] }, () => {
    const w = createWorld(11, 'Tony Marino'); advance(w, w.now + 70 * DAY);
    const live = agencyOf(w).goals.filter((g) => !['plan', 'scout', 'spot'].includes(g.stage));
    assert.ok(live.length >= 3, 'plans in flight: ' + live.length);
    const s = serialize(w); const l = deserialize(s); assert.equal(serialize(l), s);
    advance(w, w.now + 40 * DAY); advance(l, l.now + 40 * DAY);
    assert.equal(serialize(l), serialize(w));
  });
});

describe('goals: compat', { tags: ['compat'] }, () => {
  ok('a V73 save (schema 4) loads, NPCs start forming goals, and nothing breaks', () => {
    const w = createWorld(9, 'Tony Marino'); advance(w, w.now + 30 * DAY);
    const o = JSON.parse(serialize(w)); o.schema = 4; delete o.agency;
    const l = deserialize(JSON.stringify(o)); assert.equal(l.schema, SCHEMA); assert.equal(l.agency!.goals.length, 0);
    advance(l, l.now + 60 * DAY); assert.ok(l.agency!.goals.length > 0); assert.deepEqual(audit(l), []); assert.deepEqual(ledgerCheck(l), []);
    assert.equal(serialize(deserialize(serialize(l))), serialize(l));
  });
});

function sim(seed: number, days: number) {
  const w = createWorld(seed, 'Tony Marino'); AGENCY.audit = true;
  const peak = { goals: 0, enc: 0, facts: 0, ended: 0, txns: 0 }; const wk: string[] = []; let asks = 0, lastAsk = -1e9, minGap = 1e9;
  for (let d = 1; d <= days; d++) {
    advance(w, w.now + DAY);
    const a = agencyOf(w); peak.goals = Math.max(peak.goals, a.goals.length); peak.enc = Math.max(peak.enc, w.enc.length); peak.facts = Math.max(peak.facts, Object.keys(w.facts).length); peak.ended = Math.max(peak.ended, a.ended.length); peak.txns = Math.max(peak.txns, w.txns!.length);
    if (a.lastAsk !== lastAsk) { asks++; minGap = Math.min(minGap, a.lastAsk - lastAsk); lastAsk = a.lastAsk; }
    if (d % 60 === 0) assert.deepEqual([...agencyIssues(w), ...audit(w)].slice(0, 5), [], 'day ' + d);
    if (d % 90 === 0) wk.push(`d${d} ` + JSON.stringify(wealthReport(w)));
  }
  const a = agencyOf(w);
  console.log(`seed ${seed} ${days}d`); console.log(wk.join('\n'));
  console.log('stats', JSON.stringify(Object.fromEntries(Object.entries(a.stats).sort())));
  console.log('peak', JSON.stringify(peak), 'asks', asks, 'minGapDays', minGap > 1e8 ? '-' : Math.round(minGap / DAY), 'saveKB', Math.round(serialize(w).length / 1024));
  assert.equal(a.stats.leak ?? 0, 0, 'no money leaked by any goal step');
  assert.ok(peak.ended <= AGENCY.caps.ended && peak.goals <= Object.keys(w.chars).length * AGENCY.caps.perMan);
  assert.deepEqual(audit(w), []); assert.deepEqual(ledgerCheck(w), []);
}

function roundtrip(seed: number) {
  const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + 90 * DAY);
  const s = serialize(w); const l = deserialize(s); assert.equal(serialize(l), s);
  advance(w, w.now + 60 * DAY); advance(l, l.now + 60 * DAY); assert.equal(serialize(l), serialize(w));
  console.log(`seed ${seed}: round trip OK mid-plans (${goalsOf(w, '').length}+${agencyOf(w).goals.length} goals, ${(s.length / 1024).toFixed(0)} KB)`);
}

describe('goals: long runs', { tags: ['sim', 'slow'] }, () => {
  ok.each(SEEDS)(`sim %i, ${DAYS} days`, (seed) => sim(seed, DAYS));
});

describe('goals: long round trips', { tags: ['determinism', 'slow'] }, () => {
  ok.each(SEEDS)('roundtrip %i', roundtrip);
});
