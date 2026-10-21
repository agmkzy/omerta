// The player becomes boss by the real road (promotion ceremonies, then asking for the chair or taking it), and it is a
// real change in the organisation's leadership and powers. From the V76 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY } from '../../types';
import { rel } from '../../core';
import { moneyTotal } from '../../goals';
import { chairAct, powerOptions, usePower } from '../../path';
import { openFamilyMeeting } from '../../meetings';
import { clubOf, clubPresent } from '../../clubdata';
import { setHeir, setConsigliere } from '../../powers2';
import { candidates, leaderOf, membersOf, orgRecord, treasuryCheck } from '../../orgs';
import { orgWorld, clean, rank, climb, playerRun } from './fixtures';
import { P } from '../helpers';

describe('the player becomes boss', { tags: ['scenario'] }, () => {
  ok('9/10. the player climbs to Boss by the real road, and it is a real change in the organisation’s leadership', () => {
    const { w, p, fam, old, log } = playerRun();
    assert.equal(fam.bossId, p.id); assert.equal(p.rank, 'boss'); assert.equal(p.bossId, null); assert.equal(leaderOf(w, fam.id)!.id, p.id);
    assert.equal(old.alive, true); assert.equal(old.rank, 'capo'); assert.equal(old.bossId, p.id);
    assert.ok(fam.hist!.some((h) => h.kind === 'succession' && h.who === p.id), 'the record names him'); assert.equal(fam.leaderSince! >= w.now - DAY, true);
    assert.equal(clubOf(w, fam.id)!.hostId, p.id); assert.equal(orgRecord(w, fam.id).leader!.id, p.id);
    for (const c of membersOf(w, fam.id)) if (c.id !== p.id) assert.ok(c.bossId && w.chars[c.bossId].alive, c.name + ' answers to someone');
    clean(w, 'boss'); log.push(`day ${Math.round(w.now / DAY)}: underboss -> boss (${old.name} steps down to captain)`);
    // the powers and the responsibilities of the chair
    const codes = powerOptions(w, p).map((o) => o.code);
    for (const c of ['tribute', 'levy', 'fund_out', 'fund_in', 'orgreview', 'commission', 'bonus', 'peace']) assert.ok(codes.includes(c), 'boss power ' + c);
    p.cash = 20000; const t0 = fam.treasury ?? 0;
    let r = usePower(w, p, 'fund_in'); assert.equal(fam.treasury, t0 + 2000); log.push('fund_in: ' + r[0]);
    r = usePower(w, p, 'orgreview'); assert.ok(r.length >= 2 && /family/.test(r[0])); log.push('orgreview: ' + r.join(' | '));
    const m = moneyTotal(w); r = usePower(w, p, 'fund_out'); assert.equal(moneyTotal(w), m, 'a draw only moves money'); assert.equal(treasuryCheck(fam), 0);
    const c0 = p.cash; r = usePower(w, p, 'tribute'); log.push('tribute: ' + r[0]); assert.ok(p.cash >= c0);
    usePower(w, p, 'levy'); assert.ok(fam.levy && fam.levy.until > w.now);
    const caps = rank(w, fam.id, 'capo'); const heir = caps[0]; setHeir(w, p, heir); setConsigliere(w, p, caps[1] ?? heir); assert.equal(fam.heir, heir.id);
    // his word decides the succession after him: a named heir with support takes the chair when he is gone
    for (const v of membersOf(w, fam.id)) if (!v.isPlayer) rel(v, heir.id).trust = 0.8;
    const cs = candidates(w, fam.id, p.id, { cause: 'death' }); assert.equal(cs[0].c.id, heir.id, 'the named heir is first in line');
    // the men look to him: they wait at the club
    const cl = clubOf(w, fam.id)!; w.now = Math.floor(w.now / DAY) * DAY + 20 * 60;
    const seatCount = () => { let n = 0; for (let s = 0; s < 40; s++) { w.now += 180; n += clubPresent(w, cl).filter((h) => h.c.rank === 'capo').length; } return n; };
    const withSeat = seatCount(); cl.hostId = undefined; const without = seatCount(); cl.hostId = p.id;
    assert.ok(withSeat > without, `captains come to the boss's club more (${withSeat} vs ${without})`);
    const opened = openFamilyMeeting(w, p); assert.ok(typeof opened !== 'string' || opened.length > 0);
    // and it goes on: sixty more days under him, with the audit watching
    advance(w, w.now + 60 * DAY); clean(w, 'sixty days under the new boss');
    assert.equal(p.rank, 'boss'); assert.ok((fam.treasury ?? 0) > 0 && treasuryCheck(fam) === 0, 'the fund keeps filling and reconciling');
  });
  ok('10b. the player taking the chair by force is the same change (move against the boss)', () => {
    const w = orgWorld(3, 20, 5); const p = P(w); climb(w); const fam = w.fam[p.familyId!]; const old = leaderOf(w, fam.id)!;
    const rc = w.rng.chance; w.rng.chance = () => true; p.cooldown = {}; chairAct(w, p, 'move'); w.rng.chance = rc;
    assert.equal(fam.bossId, p.id); assert.equal(old.alive, false); assert.equal(fam.hist!.filter((h) => h.kind === 'succession').at(-1)!.who, p.id); clean(w, 'move');
  });
});

describe('the player becomes boss: trace', { tags: ['scenario', 'slow'] }, () => {
  ok('trace: the player\'s road to boss', () => { const { w, p, log } = playerRun(); console.log(log.join('\n')); console.log(`${p.name} is boss of the ${w.fam[p.familyId!].name} family`); });
});
