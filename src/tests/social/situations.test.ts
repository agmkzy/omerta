// Persistent situations (Stage 5D): what goes wrong in the work and money of Stage 4 becomes a matter with people in it, a history
// and an end; and the player hears of what concerns him from the people who would know.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { startOp } from '../../rackets';
import { delegate, menOf } from '../../work';
import { rel } from '../../core';
import { DAY, WEEK, type Character, type World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const capWithMan = (w: World): Character => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && menOf(w, c).filter((m) => !m.isPlayer).length >= 2).sort(byId)[0];

describe('situations that come of the work', () => {
  ok('a runner keeps part of the take; the owner notices; it becomes a matter that runs its course and leaves a history', { tags: ['scenario'] }, () => {
    let seen = 0, ended = 0;
    for (let i = 0; i < 6; i++) {
      const w = newWorld(7 + i), cap = capWithMan(w);
      cap.cash = 5000; cap.traits.caution = 1;
      startOp(w, cap, 'numbers', cap.district, null);
      const op = w.ops.find((o) => o.owner === cap.id && o.kind === 'numbers')!;
      delegate(w, cap);
      op.skimmed = 400;
      for (let k = 0; k < 6; k++) delegate(w, cap);
      const s = (w.situations ?? []).find((x) => x.kind === 'skim' && x.m?.op === op.id);
      if (!s) continue;
      seen++;
      advance(w, w.now + 6 * WEEK);
      if (s.stage === 'resolved') { ended++; assert.ok((s.hist ?? []).length >= 2, 'it has a history: ' + JSON.stringify(s.hist)); }
    }
    assert.ok(seen >= 3, `noticed in ${seen} of 6`);
    assert.ok(ended >= 1, 'and it ends one way or another');
  });

  ok('the player hears it from someone who would know when the man running his enterprise is keeping part of the take', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    p.cash = 5000;
    const m = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'associate').sort(byId)[0];
    const friend = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.id !== m.id).sort(byId)[0];
    rel(friend, m.id).affection = 0.6; rel(friend, p.id).trust = 0.6;
    startOp(w, p, 'numbers', w.fam[p.familyId!].districts[0], m.id);
    const op = w.ops.find((o) => o.owner === p.id)!;
    op.skimmed = 300; op.pad = w.now + 365 * DAY; // (the precinct is looked after: a raid in its first fortnight is not what this is about)
    advance(w, w.now + 2 * WEEK + DAY);
    const told = Object.keys(p.known).map((id) => w.facts[id]).find((f) => f && /coming up light/.test(f.text));
    if (op.runner === m.id) assert.ok(told, 'someone told him');
  });
});
