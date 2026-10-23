// Work down the hierarchy (Stage 4, increment 4): one way for a superior to give a man work, for NPC captains, the player's boss
// and the player alike. Work comes from what a superior actually needs done; a man may refuse, do it, botch it or lie about it; his
// superior weighs what he is told.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt, rel } from '../../core';
import { advance } from '../../engine';
import { bossOffer } from '../../jobs';
import { orderMenu } from '../../orders';
import { startOp } from '../../rackets';
import { delegate, giveWork, judge, menOf, needsOf, workWeek } from '../../work';
import { DAY, type Character, type World } from '../../types';
import { clone, newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
// a captain with men under him, and a civilian who owes him and has stopped paying
function owed(w: World): { cap: Character; debtor: Character } {
  const cap = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && menOf(w, c).some((m) => !m.isPlayer)).sort(byId)[0];
  const debtor = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId)[0];
  const d = createDebt(w, cap.id, debtor.id, 600, 0.05, 'a private loan');
  d.missed = 2;
  return { cap, debtor };
}

describe('work down the hierarchy', () => {
  ok('what a superior needs done comes from his affairs: no debt gone bad, no collection', { tags: ['unit'] }, () => {
    const w = newWorld(7);
    const cap = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo').sort(byId)[0];
    assert.ok(!needsOf(w, cap).some((n) => n.kind === 'collect'), 'nothing owed him, nothing to collect');
    const { cap: c2, debtor } = owed(w);
    const n = needsOf(w, c2).find((x) => x.kind === 'collect');
    assert.ok(n && n.target === debtor.id, 'a man who stopped paying him is work');
  });

  ok('a captain hands it to one of his men, who goes, and comes back with a story; the captain weighs it', { tags: ['scenario'] }, () => {
    const w = newWorld(7), { cap, debtor } = owed(w);
    for (const m of menOf(w, cap)) rel(m, cap.id).grudge = 0; // nothing against him: the rule here is the giving, not refusing
    debtor.cash = 0; // (a man who catches up on his own is no longer work: the job would be called off)
    workWeek(w);
    const j = w.jobs.find((x) => x.giver === cap.id && x.target === debtor.id && x.kind === 'collect')!;
    assert.ok(j, 'he gave the collection to someone');
    assert.equal(j.via, 'order');
    assert.equal(w.chars[j.assignee].bossId, cap.id, 'one of his own men');
    assert.equal(j.status, 'active');
    advance(w, w.now + 4 * DAY);
    assert.ok(j.status === 'done' || j.status === 'failed', 'it was carried out');
    assert.ok(j.rep, 'and the man reported back');
  });

  ok('the player is one of his superior\'s men: what he is offered is what his superior actually needs', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), boss = w.chars[p.bossId!];
    const debtor = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId)[0];
    createDebt(w, boss.id, debtor.id, 500, 0.05, 'a private loan').missed = 1;
    w.jobs = w.jobs.filter((j) => j.assignee !== p.id);
    assert.ok(bossOffer(w, true));
    const j = w.jobs.find((x) => x.assignee === p.id && x.giver === boss.id && x.status === 'offered')!;
    assert.ok(j, 'he has something for the player');
    assert.equal(j.target, debtor.id, 'and it is the man who owes him');
  });

  ok('a man with something against his superior may refuse, and that is on the record with its reason', { tags: ['scenario'] }, () => {
    let refused = 0;
    for (let i = 0; i < 12; i++) {
      const w = newWorld(7 + i), { cap, debtor } = owed(w);
      const m = menOf(w, cap).find((x) => !x.isPlayer)!;
      rel(m, cap.id).grudge = 1; rel(m, cap.id).respect = 0; delete rel(m, cap.id).fear; m.jailedUntil = 0; m.hurtUntil = 0;
      const n = needsOf(w, cap).find((x) => x.kind === 'collect' && x.target === debtor.id)!;
      const r = giveWork(w, cap, m, n);
      if (typeof r === 'string') {
        refused++;
        assert.ok(rel(cap, m.id).grudge > 0 && /refused/.test(rel(cap, m.id).why?.text ?? ''), 'his superior holds it against him, and why');
        assert.ok(Object.values(w.facts).some((f) => f.actor === m.id && f.victim === cap.id && /refused/.test(f.text)), 'and it happened');
      }
    }
    assert.ok(refused >= 3, `a man who hates his captain often says no (${refused} of 12)`);
  });

  ok('a lie may be found out: a careful superior checks money owed him, and what he finds is a grudge with its reason', { tags: ['scenario'] }, () => {
    let caught = 0;
    for (let i = 0; i < 10; i++) {
      const w = newWorld(7), { cap, debtor } = owed(w);
      for (let k = 0; k < i; k++) w.rng.next();
      cap.traits.caution = 1;
      const m = menOf(w, cap).find((x) => !x.isPlayer)!;
      const n = needsOf(w, cap).find((x) => x.kind === 'collect' && x.target === debtor.id)!;
      rel(m, cap.id).grudge = 0; m.jailedUntil = 0; m.hurtUntil = 0;
      const j = giveWork(w, cap, m, n);
      if (typeof j === 'string') continue;
      j.status = 'done'; j.rep = { text: 'Short week for him.', truth: 'skim', lie: true, amt: 100, by: m.id };
      judge(w, j);
      if (j.rep.found) {
        caught++;
        assert.ok(Object.values(w.facts).some((f) => f.kind === 'discipline' && f.actor === cap.id && f.victim === m.id), 'it is on the record');
        assert.ok(rel(cap, m.id).grudge > 0);
      }
    }
    assert.ok(caught >= 3, `a careful man checks (${caught} of 10)`);
  });

  ok('a senior man puts one of his men in charge of his enterprise, and a light take becomes a matter between them', { tags: ['scenario'] }, () => {
    let found = 0;
    for (let i = 0; i < 10; i++) {
      const w = newWorld(7), { cap } = owed(w);
      for (let k = 0; k < i; k++) w.rng.next();
      cap.cash = 5000;
      startOp(w, cap, 'numbers', cap.district, null);
      const op = w.ops.find((o) => o.owner === cap.id && o.kind === 'numbers')!;
      delegate(w, cap);
      assert.ok(op.runner && w.chars[op.runner].bossId === cap.id, 'he gave it to one of his men to run');
      op.skimmed = 400; cap.traits.caution = 1;
      for (let k = 0; k < 6; k++) delegate(w, cap);
      // (Stage 5D: his suspicion is a matter, the same one as a gap in a man's numbers: situ.ts 'skim')
      const m = (w.situations ?? []).find((x) => x.kind === 'skim' && x.m?.op === op.id);
      if (m) { found++; assert.equal(m.truth, 'guilty', 'and it is true: he was keeping it'); }
    }
    assert.ok(found >= 5, `a careful owner notices (${found} of 10)`);
  });

  ok('the player\'s own orders come from the same list: his affairs, the same needs an NPC superior hands out from', { tags: ['unit'] }, () => {
    const w = newWorld(7), p = P(w);
    const debtor = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId)[0];
    createDebt(w, p.id, debtor.id, 300, 0.05, 'a private loan').missed = 1;
    const menu = orderMenu(w, p);
    const need = needsOf(w, p).find((n) => n.kind === 'collect' && n.target === debtor.id)!;
    assert.ok(need && menu.some((o) => o.need.kind === 'collect' && o.need.target === debtor.id), 'the money owed him is on his order menu');
    void clone;
  });
});
