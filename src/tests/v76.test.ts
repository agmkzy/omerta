// V76 suite: dynamic criminal organisations. Usage: tsx src/tests/v76.test.ts fast | sim:<seed>[:days] | det | trace
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { advance, deserialize, serialize } from '../engine';
import { createWorld, EXTRA_ORGS, STANDARD_ORGS } from '../world';
import { DAY, WEEK, Character, World } from '../types';
import { audit } from '../consistency';
import { rel, handleDeath } from '../core';
import { hierarchyIssues, applyRank } from '../rank';
import { moneyTotal } from '../goals';
import { promote } from '../career';
import { chairAct, chairOptions, pathState, powerOptions, trialChoose, usePower } from '../path';
import { promoChoose } from '../career';
import { openInduction, choose as mchoose, closeMeeting, openFamilyMeeting } from '../meetings';
import { politicsCoup } from '../politics';
import { clubOf, clubPresent } from '../clubdata';
import { present, sitAtClub } from '../places';
import { setHeir, setConsigliere } from '../powers2';
import { candidates, chooseLeader, defect, foundOrg, hostility, interestsOf, leave, leaderOf, membersOf, noteDeal, noteGrievance, orgIssues, orgList, orgRecord, orgWeek, relWeek, succeed, treasuryCheck, treasuryMove, treasuryWeek, hierarchyOf } from '../orgs';

let failed = 0;
const ok = (name: string, f: () => void) => {
  try { f(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + (e as Error).message.split('\n').slice(0, 6).join(' ')); }
};
const P = (w: World) => w.chars[w.playerId!];
const clone = (w: World) => deserialize(serialize(w));
const cache = new Map<string, string>();
const fresh = (seed = 3, days = 20, orgs = 5) => {
  const k = `${seed}:${days}:${orgs}`;
  if (!cache.has(k)) { const defs = orgs === 5 ? undefined : [...STANDARD_ORGS, ...EXTRA_ORGS].slice(0, orgs); const b = createWorld(seed, 'Tony Marino', { orgs: defs }); advance(b, b.now + days * DAY); cache.set(k, serialize(b)); }
  return deserialize(cache.get(k)!);
};
const clean = (w: World, label = '') => { assert.deepEqual(audit(w), [], 'audit ' + label); assert.deepEqual(orgIssues(w), [], 'orgs ' + label); assert.deepEqual(hierarchyIssues(w), [], 'hierarchy ' + label); };
const other = (w: World) => orgList(w).find((f) => f.id !== P(w).familyId)!;
const C = (w: World, A: { id: string }, B: { id: string }) => orgList(w).find((f) => f.id !== A.id && f.id !== B.id)!;
const rank = (w: World, fid: string, r: string) => membersOf(w, fid).filter((c) => c.rank === r && !c.isPlayer);

// the real road: promotions through the game's own ceremonies, with the player's numbers set to what each step asks for
function climb(w: World, log: string[] = []) {
  const p = P(w), st = pathState(w);
  for (let step = 0; step < 3; step++) {
    const r0 = p.rank;
    for (let d = 0; d < 60 && p.rank === r0; d++) {
      p.lifetimeKick = 1e6; st.deeds = 999; st.kills = 9; p.standing = 90; p.heat = 0;
      for (const c of Object.values(w.chars)) if (c.alive && c.familyId === p.familyId && c.id !== p.id) { rel(c, p.id).trust = 0.9; rel(c, p.id).respect = 0.8; }
      advance(w, (Math.floor(w.now / DAY) + 1) * DAY + 13 * 60);
      for (const e of w.enc.filter((e) => e.status === 'open' && e.kind === 'promo')) { e.data?.stage === 'trial' ? trialChoose(w, p, e, e.opts![0].code) : promoChoose(w, p, e, e.opts![0].code); e.status = 'done'; }
      const j = w.jobs.find((q) => q.kind === 'summons' && q.meeting === 'induction' && q.status === 'offered');
      if (j) { const m = openInduction(w, p, j); if (typeof m === 'string') continue; for (let i = 0; i < 12 && m.items.length && m.idx < m.items.length; i++) mchoose(w, p, m, 'sure'); closeMeeting(w, p, m); }
    }
    log.push(`day ${Math.round(w.now / DAY)}: ${r0} -> ${p.rank}`);
    assert.notEqual(p.rank, r0, 'the road led somewhere from ' + r0);
  }
  return log;
}

function fast() {
  ok('1. the five-family world loads, and every organisation carries a complete record', () => {
    const w = fresh();
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

  ok('2. a save from before V76 migrates, keeps playing and has the full record afterwards', () => {
    const w = fresh(); const o = JSON.parse(serialize(w));
    o.schema = 6;
    for (const f of Object.values(o.fam) as Record<string, unknown>[]) for (const k of ['founded', 'history', 'leaderSince', 'standing', 'hist', 'treasury', 'tlog', 'tin', 'tout', 'rel', 'unrest', 'hq', 'acting', 'lastChurn']) delete f[k];
    for (const c of Object.values(o.clubs) as Record<string, unknown>[]) delete c.hostId;
    const m = deserialize(JSON.stringify(o));
    for (const f of orgList(m)) { assert.ok(f.founded !== undefined && f.history && f.rel && f.hist && f.treasury === 0 && f.standing === 50 && f.hq, f.name); assert.equal(clubOf(m, f.id)!.hostId, f.bossId); }
    clean(m, 'on load'); advance(m, m.now + 30 * DAY); clean(m, 'after 30 days');
    assert.equal(P(m).familyId, 'fam_corrente');
  });

  ok('3. recruitment, promotion, demotion, defection, expulsion and retirement keep membership consistent', () => {
    const w = fresh(); const A = other(w); const B = orgList(w).find((f) => f.id !== A.id && f.id !== P(w).familyId)!;
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

  ok('4a. succession is scored, not the oldest or richest: a trusted captain beats a resented, wealthy underboss', () => {
    const w = fresh(); const f = other(w); const boss = leaderOf(w, f.id)!;
    const ub = rank(w, f.id, 'underboss')[0], cap = rank(w, f.id, 'capo')[0];
    ub.cash = 90000; ub.lifetimeKick = 90000;
    for (const v of membersOf(w, f.id)) { if (v.id === ub.id || v.id === cap.id || v.isPlayer) continue; rel(v, ub.id).trust = 0.05; rel(v, ub.id).grudge = 0.7; rel(v, cap.id).trust = 0.95; rel(v, cap.id).respect = 0.8; }
    cap.standing = 80; cap.bossId = ub.id; ub.standing = 35; // (resented: his name has suffered for it, whatever the world did before)
    const cs = candidates(w, f.id, boss.id, { cause: 'death' });
    assert.equal(cs[0].c.id, cap.id, 'captain ranks first: ' + cs.slice(0, 3).map((x) => `${x.c.rank}:${x.score.toFixed(2)}`));
    handleDeath(w, boss.id);
    assert.equal(f.bossId, cap.id); assert.equal(cap.rank, 'boss'); clean(w, 'after');
  });
  ok('4b. a loved underboss still wins, and the choice leaves consequences behind', () => {
    const w = fresh(); const f = other(w); const boss = leaderOf(w, f.id)!;
    const ub = rank(w, f.id, 'underboss')[0], cap = rank(w, f.id, 'capo')[0];
    for (const v of membersOf(w, f.id)) { if (v.isPlayer) continue; rel(v, ub.id).trust = 0.9; rel(v, cap.id).trust = 0.1; rel(v, cap.id).respect = 0.2; }
    cap.standing = 70; cap.traits.ambition = 0.9;
    const cs = candidates(w, f.id, boss.id, { cause: 'death' }); assert.equal(cs[0].c.id, ub.id);
    handleDeath(w, boss.id);
    assert.equal(f.bossId, ub.id); assert.equal(f.leaderSince, w.now); assert.ok(f.hist!.some((h) => h.kind === 'succession' && h.who === ub.id), 'history');
    assert.equal(clubOf(w, f.id)!.hostId, ub.id, 'the club is his seat now');
    clean(w, 'after');
  });
  ok('4c. a passed-over rival holds a grudge; a contested win leaves the house unsettled', () => {
    const w = fresh(); const f = other(w); const boss = leaderOf(w, f.id)!;
    const ub = rank(w, f.id, 'underboss')[0], cap = rank(w, f.id, 'capo')[0];
    for (const v of membersOf(w, f.id)) { if (v.isPlayer) continue; rel(v, ub.id).trust = 0.6; rel(v, cap.id).trust = 0.6; rel(v, cap.id).respect = 0.5; rel(v, ub.id).respect = 0.5; }
    cap.standing = 90; cap.bossId = ub.id; const before = rel(cap, ub.id).grudge;
    handleDeath(w, boss.id);
    const win = leaderOf(w, f.id)!; const lose = [ub, cap].find((c) => c.id !== win.id)!;
    assert.ok(rel(lose, win.id).grudge > before || lose.rank === 'soldier', 'the loser remembers');
    assert.ok(f.unrest && f.unrest.until > w.now, 'unsettled');
    clean(w, 'after');
  });
  ok('4d. a boss inside is replaced by an acting boss, and a very long sentence ends his reign', () => {
    const w = fresh(); const f = other(w); const boss = leaderOf(w, f.id)!;
    boss.jailedUntil = w.now + 40 * DAY; orgWeek(w);
    assert.ok(f.acting && f.acting !== boss.id, 'acting boss named'); assert.equal(f.bossId, boss.id); clean(w, 'acting');
    boss.jailedUntil = w.now + 200 * DAY; orgWeek(w);
    assert.notEqual(f.bossId, boss.id, 'a new boss'); assert.equal(boss.rank, 'capo'); assert.equal(boss.bossId, f.bossId); assert.equal(f.acting, undefined); clean(w, 'removed');
    assert.ok(f.hist!.some((h) => /took the chair after/.test(h.text)));
  });
  ok('4e. retirement and a successful plot both change the chair for real', () => {
    const w = fresh(); const f = other(w); const boss = leaderOf(w, f.id)!;
    leave(w, boss, 'retire', 'he is tired'); assert.equal(boss.rank, 'civilian'); assert.notEqual(f.bossId, boss.id); clean(w, 'retire');
    const g = orgList(w).find((x) => x.id !== f.id && x.id !== P(w).familyId)!; const b2 = leaderOf(w, g.id)!; const u = rank(w, g.id, 'underboss')[0];
    w.coup = { fam: g.id, plotter: u.id, boss: b2.id, start: w.now - 40 * DAY, resolveAt: w.now - 1, back: { plotter: [], boss: [] } };
    const rc = w.rng.chance; w.rng.chance = () => true; politicsCoup(w); w.rng.chance = rc;
    assert.equal(g.bossId, u.id); assert.equal(b2.alive, false); assert.ok(g.hist!.some((h) => /was removed/.test(h.text))); clean(w, 'coup');
  });

  ok('5/6. the treasury reconciles, money is conserved, men inside are supported from it', () => {
    const w = fresh(3, 60); for (const f of orgList(w)) assert.equal(treasuryCheck(f), 0, f.name);
    assert.ok(orgList(w).every((f) => (f.treasury ?? 0) > 0), 'dues arrive');
    const f = other(w); const m = moneyTotal(w); treasuryWeek(w); assert.equal(moneyTotal(w), m, 'treasuryWeek only moves money');
    const inmate = rank(w, f.id, 'soldier')[0]; inmate.jailedUntil = w.now + 20 * DAY; f.treasury = (f.treasury ?? 0) + 1000; f.tin = (f.tin ?? 0) + 1000;
    const c0 = inmate.cash, t0 = f.treasury; treasuryWeek(w);
    // (the fund also takes in the week's dues, so its balance alone proves nothing: the support itself is on its ledger)
    assert.ok(inmate.cash > c0 && (f.tlog ?? []).some((e) => e.who === inmate.id && e.d < 0), 'support went from fund to man'); void t0; assert.equal(treasuryCheck(f), 0);
    const lead = leaderOf(w, f.id)!; lead.cash = 40000; const mm = moneyTotal(w); treasuryMove(w, f.id, lead, 5000, 'x'); treasuryMove(w, f.id, lead, -3000, 'y'); assert.equal(moneyTotal(w), mm); assert.equal(treasuryCheck(f), 0);
    for (let i = 0; i < 70; i++) treasuryMove(w, f.id, lead, 1, 'z'); assert.ok(f.tlog!.length <= 40, 'ledger bounded');
    clean(w, 'finance');
  });

  ok('7. relations persist through save/load, move with events and with leaders, and colour behaviour', () => {
    const w = fresh(); const [A, B] = orgList(w); const before = hostility(w, A.id, B.id);
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

  ok('8. clubs and meetings follow the organisation: host, members, defectors, the player’s seat', () => {
    const w = fresh(); const p = P(w); const f = w.fam[p.familyId!]; const cl = clubOf(w, f.id)!;
    assert.equal(cl.hostId, f.bossId);
    const cap = rank(w, f.id, 'capo').find((c) => c.id !== p.bossId)!; const B = other(w);
    defect(w, cap, B.id, 'test'); orgWeek(w);
    for (let s = 0; s < 40; s++) { w.now += 180; assert.ok(!clubPresent(w, cl).some((h) => h.c.id === cap.id), 'the defector is not at his old club'); }
    assert.ok(clubPresent(w, clubOf(w, B.id)!).length >= 0); assert.ok(Array.isArray(present(w, p, 'club'))); sitAtClub(w, p);
    handleDeath(w, f.bossId); assert.equal(cl.hostId, f.bossId); assert.ok(typeof openFamilyMeeting(w, p) !== 'undefined'); clean(w, 'club');
  });

  ok('11. no general logic names a family or counts five: other-sized worlds run clean', () => {
    for (const n of [4, 7]) {
      const w = fresh(5, 40, n); assert.equal(orgList(w).length, n); clean(w, n + ' orgs');
      advance(w, w.now + 30 * DAY); clean(w, n + ' orgs +30d');
    }
    const files = readdirSync(new URL('..', import.meta.url).pathname).filter((x) => x.endsWith('.ts') && x !== 'world.ts');
    for (const x of files) { const s = readFileSync(new URL('../' + x, import.meta.url), 'utf8'); assert.ok(!/fam_(corrente|marchetti|falco|brancato|santangelo)/.test(s), x + ' names a family id'); assert.ok(!/(fam(ilies)?|orgs?)\.length\s*[=!]==?\s*5/.test(s), x + ' counts five'); }
  });
  ok('11b. a splinter group can be founded by an NPC captain and the world carries on', () => {
    const w = fresh(); const f = other(w); const cap = rank(w, f.id, 'capo')[0];
    const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === cap.id).length;
    const n = foundOrg(w, cap, 'Pagano', 'test'); assert.ok(n, 'founded'); assert.equal(orgList(w).length, 6);
    assert.equal(n!.bossId, cap.id); assert.equal(cap.rank, 'boss'); assert.ok(membersOf(w, n!.id).length >= crew + 1 || crew === 0); assert.ok(clubOf(w, n!.id), 'a headquarters'); clean(w, 'splinter');
    assert.ok(f.tension[n!.id] > 0 && n!.rel![f.id].grievance > 0, 'the parent has a grievance');
    advance(w, w.now + 30 * DAY); clean(w, 'splinter +30d');
  });
}

function playerRun(log: string[] = []) {
  const w = fresh(3, 20); const p = P(w); climb(w, log);
  assert.equal(p.rank, 'underboss'); clean(w, 'underboss');
  const fam = w.fam[p.familyId!]; const old = leaderOf(w, fam.id)!;
  rel(old, p.id).trust = 1; rel(old, p.id).respect = 1; old.traits.ambition = 0; old.traits.greed = 0; p.cooldown = {};
  for (let i = 0; i < 40 && fam.bossId !== p.id; i++) { p.cooldown = {}; const o = chairOptions(w, p).find((x) => x.code === 'ask'); if (!o) throw new Error('no chair option'); chairAct(w, p, 'ask'); }
  return { w, p, fam, old, log };
}
function don() {
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
    const w = fresh(3, 20); const p = P(w); climb(w); const fam = w.fam[p.familyId!]; const old = leaderOf(w, fam.id)!;
    const rc = w.rng.chance; w.rng.chance = () => true; p.cooldown = {}; chairAct(w, p, 'move'); w.rng.chance = rc;
    assert.equal(fam.bossId, p.id); assert.equal(old.alive, false); assert.equal(fam.hist!.filter((h) => h.kind === 'succession').at(-1)!.who, p.id); clean(w, 'move');
  });
}

function det() {
  ok('12. a world with organisation changes is deterministic and round-trips byte for byte', () => {
    const run = () => { const w = createWorld(11, 'Tony Marino'); advance(w, w.now + 60 * DAY); const f = other(w); handleDeath(w, f.bossId); advance(w, w.now + 30 * DAY); return serialize(w); };
    const a = run(), b = run(); assert.equal(a, b, 'two runs identical'); assert.equal(serialize(deserialize(a)), a, 'round trip');
  });
}

function sim(seed: number, days: number) {
  const w = createWorld(seed, 'Tony Marino'); let n = 0; const t0 = Date.now(); const size = () => orgList(w).map((f) => membersOf(w, f.id).length).join('/'); const s0 = size();
  for (let d = 0; d < days; d += 30) {
    advance(w, w.now + Math.min(30, days - d) * DAY); n++;
    try { clean(w, `day ${d + 30}`); } catch (e) { failed++; console.log('FAIL sim audit: ' + (e as Error).message.slice(0, 400)); return; }
    for (const f of orgList(w)) assert.equal(treasuryCheck(f), 0);
  }
  const ev = orgList(w).flatMap((f) => (f.hist ?? []).map((h) => h.kind)); const k: Record<string, number> = {}; for (const x of ev) k[x] = (k[x] ?? 0) + 1;
  console.log(`ok   sim seed ${seed}, ${days} days, ${n} audits clean in ${Math.round((Date.now() - t0) / 1000)}s; orgs ${orgList(w).length}; events ${JSON.stringify(k)}; members ${s0} -> ${size()}; player ${P(w).rank}`);
}

const mode = process.argv[2] ?? 'fast';
if (mode === 'fast') { fast(); don(); det(); }
else if (mode === 'trace') { const { w, p, log } = playerRun(); console.log(log.join('\n')); console.log(`${p.name} is boss of the ${w.fam[p.familyId!].name} family`); }
else if (mode.startsWith('sim')) { const [, s, d] = mode.split(':'); sim(Number(s ?? 3), Number(d ?? 180)); }
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
