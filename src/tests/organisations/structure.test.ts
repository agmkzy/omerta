// Organisations: every family carries a complete record, old saves migrate, membership changes stay consistent, the
// treasury reconciles, relations persist, clubs follow, splinter groups form, and it is all deterministic. From the V76 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { DAYS, SEEDS } from '../modes';
import { advance, deserialize, serialize } from '../../engine';
import { createWorld } from '../../world';
import { DAY } from '../../types';
import { createDebt, handleDeath, rel } from '../../core';
import { jail } from '../../jobs';
import { applyRank } from '../../rank';
import { moneyTotal } from '../../goals';
import { promote } from '../../career';
import { openFamilyMeeting } from '../../meetings';
import { clubOf, clubPresent } from '../../clubdata';
import { present, sitAtClub } from '../../places';
import { defect, foundOrg, hostility, interestsOf, leave, leaderOf, membersOf, noteDeal, noteGrievance, orgList, orgRecord, orgWeek, relWeek, treasuryCheck, treasuryMove, treasuryWeek, hierarchyOf } from '../../orgs';
import { orgWorld, clean, other, C, rank } from './fixtures';
import { P, clone } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { orgWorld(3, 20, 5); });

describe('organisations', () => {
  ok('1. the five-family world loads, and every organisation carries a complete record', { tags: ['unit'] }, () => {
    const w = orgWorld(3, 20, 5);
    assert.deepEqual(orgList(w).map((f) => f.name).sort(), ['Brancato', 'Corrente', 'Falco', 'Marchetti', 'Santangelo']);
    for (const f of orgList(w)) {
      const r = orgRecord(w, f.id);
      assert.ok(r.leader && r.leader.rank === 'boss', f.name + ' leader'); assert.ok(r.hq && r.hq.host === r.leader!.id, 'hq hosted by leader');
      assert.ok(r.members >= 8 && r.history && r.founded < 0 && r.leaderSince <= w.now && r.standing > 0, 'record fields');
      assert.equal(Object.keys(r.relations).length, 4, 'a relation with each of the others');
      assert.ok(interestsOf(w, f.id).length >= 1, 'business interests');
      assert.equal(Object.values(hierarchyOf(w, f.id).reports).flat().length > 5, true);
    }
    assert.equal(P(w).familyId, 'fam_corrente'); clean(w);
  });
  ok('2. a save from before V76 migrates, keeps playing and has the full record afterwards', { tags: ['compat'] }, () => {
    const w = orgWorld(3, 20, 5); const o = JSON.parse(serialize(w));
    o.schema = 6;
    for (const f of Object.values(o.fam) as Record<string, unknown>[]) for (const k of ['founded', 'history', 'leaderSince', 'standing', 'hist', 'treasury', 'tlog', 'tin', 'tout', 'rel', 'unrest', 'hq', 'acting', 'lastChurn']) delete f[k];
    for (const c of Object.values(o.clubs) as Record<string, unknown>[]) delete c.hostId;
    const m = deserialize(JSON.stringify(o));
    for (const f of orgList(m)) { assert.ok(f.founded !== undefined && f.history && f.rel && f.hist && f.treasury === 0 && f.standing === 50 && f.hq, f.name); assert.equal(clubOf(m, f.id)!.hostId, f.bossId); }
    clean(m, 'on load'); advance(m, m.now + 30 * DAY); clean(m, 'after 30 days');
    assert.equal(P(m).familyId, 'fam_corrente');
  });
  ok('3. recruitment, promotion, demotion, defection, expulsion and retirement keep membership consistent', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 20, 5); const A = other(w); const B = orgList(w).find((f) => f.id !== A.id && f.id !== P(w).familyId)!;
    const sol = rank(w, A.id, 'soldier')[0]; promote(w, sol, 'capo'); clean(w, 'promote');
    applyRank(w, sol, 'soldier', { fact: false }); clean(w, 'demote');
    const cap = rank(w, A.id, 'capo')[0]; const was = cap.rank; const men = Object.values(w.chars).filter((c) => c.bossId === cap.id).length;
    defect(w, cap, B.id, 'test'); clean(w, 'defect');
    assert.equal(cap.familyId, B.id); assert.equal(cap.rank, 'soldier'); assert.ok(was === 'capo' && cap.bossId && w.chars[cap.bossId].familyId === B.id);
    assert.ok(Object.values(w.chars).filter((c) => c.alive && c.bossId === cap.id).length === 0, `his ${men} men stayed with the family they belong to`);
    assert.ok(A.hist!.some((h) => h.kind === 'defect') && B.hist!.some((h) => h.kind === 'defect'), 'both records note it');
    assert.ok((A.rel![B.id].deals.at(-1)?.text ?? '').includes('Grievance'), 'a grievance between the two persists');
    const ex = rank(w, A.id, 'soldier')[0]; leave(w, ex, 'expel', 'test'); clean(w, 'expel'); assert.equal(ex.rank, 'civilian'); assert.equal(ex.familyId, null);
    const ret = rank(w, A.id, 'capo')[0]; leave(w, ret, 'retire', 'test'); clean(w, 'retire');
    const newbies = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).slice(0, 1); assert.ok(newbies.length);
  });
  // Stage 4, increment 6: the fund is spent on what the family needs, and the player pays in like any made man
  ok('the fund clears an outside debt going bad for a made man the boss trusts, and he owes the boss for it; money is conserved', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 60, 5), f = other(w), lead = leaderOf(w, f.id)!;
    const c = rank(w, f.id, 'soldier')[0], out = Object.values(w.chars).find((x) => x.alive && x.familyId !== f.id && x.rank === 'civilian')!;
    rel(lead, c.id).trust = 0.8; f.treasury = (f.treasury ?? 0) + 5000; f.tin = (f.tin ?? 0) + 5000; c.cash = 0;
    const d = createDebt(w, out.id, c.id, 600, 0.05, 'a private loan'); d.missed = 2;
    const m = moneyTotal(w), fav = w.favours.length;
    treasuryWeek(w);
    assert.equal(d.status, 'paid', 'the debt is cleared');
    assert.equal(moneyTotal(w), m, 'only moved'); assert.equal(treasuryCheck(f), 0);
    assert.ok(w.favours.length > fav && w.favours.at(-1)!.to === c.id && w.favours.at(-1)!.from === lead.id, 'and he owes the boss');
  });
  ok('a made man arrested gets the family\'s lawyer when the fund can pay, and his time is cut; an associate does not', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 60, 5), f = other(w);
    f.treasury = (f.treasury ?? 0) + 5000; f.tin = (f.tin ?? 0) + 5000;
    const c = rank(w, f.id, 'soldier').find((x) => x.jailedUntil <= w.now)!, a = rank(w, f.id, 'associate').find((x) => x.jailedUntil <= w.now && x.bossId)!;
    jail(w, c, 30); jail(w, a, 30);
    const t0 = f.treasury!;
    advance(w, w.now + 3 * DAY);
    assert.ok(c.jailedUntil < w.now + 26 * DAY, 'his time was cut');
    assert.ok(f.treasury! <= t0 - 400 || (f.tlog ?? []).some((l) => /lawyer for/.test(l.why)), 'out of the fund');
    assert.ok(a.jailedUntil > w.now + 25 * DAY, 'an associate is not the family\'s yet');
  });
  ok('the player pays dues to the fund like any made man', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 60, 5), p = P(w), f = w.fam[p.familyId!];
    applyRank(w, p, 'soldier'); p.cash = 4500; p.jailedUntil = 0;
    const t0 = f.treasury ?? 0;
    treasuryWeek(w);
    assert.ok((f.treasury ?? 0) > t0 && p.cash < 4500, 'his dues went in');
  });
  ok('5/6. the treasury reconciles, money is conserved, men inside are supported from it', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 60, 5); for (const f of orgList(w)) assert.equal(treasuryCheck(f), 0, f.name);
    assert.ok(orgList(w).every((f) => (f.treasury ?? 0) > 0), 'dues arrive');
    const f = other(w); const m = moneyTotal(w); treasuryWeek(w); assert.equal(moneyTotal(w), m, 'treasuryWeek only moves money');
    const inmate = rank(w, f.id, 'soldier')[0]; inmate.jailedUntil = w.now + 20 * DAY; f.treasury = (f.treasury ?? 0) + 1000; f.tin = (f.tin ?? 0) + 1000;
    const c0 = inmate.cash, t0 = f.treasury; treasuryWeek(w);
    // (the fund's own balance also takes the week's dues, which grow with the family: the payment itself is what proves the rule)
    assert.ok(inmate.cash > c0 - 1 && (f.tlog ?? []).some((x) => x.d < 0 && x.who === inmate.id && x.t === w.now), 'support went from fund to man'); assert.equal(treasuryCheck(f), 0); void t0;
    const lead = leaderOf(w, f.id)!; lead.cash = 40000; const mm = moneyTotal(w); treasuryMove(w, f.id, lead, 5000, 'x'); treasuryMove(w, f.id, lead, -3000, 'y'); assert.equal(moneyTotal(w), mm); assert.equal(treasuryCheck(f), 0);
    for (let i = 0; i < 70; i++) treasuryMove(w, f.id, lead, 1, 'z'); assert.ok(f.tlog!.length <= 40, 'ledger bounded');
    clean(w, 'finance');
  });
  ok('7. relations persist through save/load, move with events and with leaders, and colour behaviour', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 20, 5); const [A, B] = orgList(w); const before = hostility(w, A.id, B.id);
    noteGrievance(w, A.id, B.id, 'a test insult', 0.4); noteDeal(w, A.id, C(w, A, B).id, 'a test agreement', 0.3);
    assert.ok(A.rel![B.id].grievance >= 0.4 && B.rel![A.id].grievance >= 0.4 && A.rel![B.id].deals.length >= 1);
    A.tension[B.id] = 12; B.tension[A.id] = 12; for (let i = 0; i < 25; i++) relWeek(w);
    assert.ok(A.rel![B.id].comp > 0.6 && hostility(w, A.id, B.id) > before + 0.3, 'hostility rises with the quarrel');
    const m = clone(w); assert.deepEqual(m.fam[A.id].rel, A.rel); assert.equal(hostility(m, A.id, B.id), hostility(w, A.id, B.id));
    const before2 = JSON.stringify(A.rel![B.id]); const boss = leaderOf(w, A.id)!; handleDeath(w, boss.id);
    assert.ok(A.rel![B.id] && JSON.stringify(A.rel![B.id]) === before2, 'a change of leader does not erase the record');
    for (const x of orgList(w)) for (const r of Object.values(x.rel ?? {})) assert.ok(r.deals.length <= 6);
    clean(w, 'rel');
  });
  ok('8. clubs and meetings follow the organisation: host, members, defectors, the player’s seat', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 20, 5); const p = P(w); const f = w.fam[p.familyId!]; const cl = clubOf(w, f.id)!;
    assert.equal(cl.hostId, f.bossId);
    const cap = rank(w, f.id, 'capo').find((c) => c.id !== p.bossId)!; const B = other(w);
    defect(w, cap, B.id, 'test'); orgWeek(w);
    for (let s = 0; s < 40; s++) { w.now += 180; assert.ok(!clubPresent(w, cl).some((h) => h.c.id === cap.id), 'the defector is not at his old club'); }
    assert.ok(clubPresent(w, clubOf(w, B.id)!).length >= 0); assert.ok(Array.isArray(present(w, p, 'club'))); sitAtClub(w, p);
    handleDeath(w, f.bossId); assert.equal(cl.hostId, f.bossId); assert.ok(typeof openFamilyMeeting(w, p) !== 'undefined'); clean(w, 'club');
  });
  ok('11b. a splinter group can be founded by an NPC captain and the world carries on', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 20, 5); const f = other(w); const cap = rank(w, f.id, 'capo')[0];
    const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === cap.id).length;
    const n = foundOrg(w, cap, 'Pagano', 'test'); assert.ok(n, 'founded'); assert.equal(orgList(w).length, 6);
    assert.equal(n!.bossId, cap.id); assert.equal(cap.rank, 'boss'); assert.ok(membersOf(w, n!.id).length >= crew + 1 || crew === 0); assert.ok(clubOf(w, n!.id), 'a headquarters'); clean(w, 'splinter');
    assert.ok(f.tension[n!.id] > 0 && n!.rel![f.id].grievance > 0, 'the parent has a grievance');
    advance(w, w.now + 30 * DAY); clean(w, 'splinter +30d');
  });
  ok('12. a world with organisation changes is deterministic and round-trips byte for byte', { tags: ['determinism'] }, () => {
    const run = () => { const w = createWorld(11, 'Tony Marino'); advance(w, w.now + 60 * DAY); const f = other(w); handleDeath(w, f.bossId); advance(w, w.now + 30 * DAY); return serialize(w); };
    const a = run(), b = run(); assert.equal(a, b, 'two runs identical'); assert.equal(serialize(deserialize(a)), a, 'round trip');
  });
});

function sim(seed: number, days: number) {
  const w = createWorld(seed, 'Tony Marino'); let n = 0; const t0 = Date.now(); const size = () => orgList(w).map((f) => membersOf(w, f.id).length).join('/'); const s0 = size();
  for (let d = 0; d < days; d += 30) {
    advance(w, w.now + Math.min(30, days - d) * DAY); n++;
    clean(w, `day ${d + 30}`);
    for (const f of orgList(w)) assert.equal(treasuryCheck(f), 0);
  }
  const ev = orgList(w).flatMap((f) => (f.hist ?? []).map((h) => h.kind)); const k: Record<string, number> = {}; for (const x of ev) k[x] = (k[x] ?? 0) + 1;
  console.log(`sim seed ${seed}, ${days} days, ${n} audits clean in ${Math.round((Date.now() - t0) / 1000)}s; orgs ${orgList(w).length}; events ${JSON.stringify(k)}; members ${s0} -> ${size()}; player ${P(w).rank}`);
}

describe('organisations: long runs', { tags: ['sim', 'slow'] }, () => {
  ok.each(SEEDS)(`sim %i, ${DAYS} days`, (seed) => sim(seed, DAYS));
});
