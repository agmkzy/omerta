// Gate 2a: breach, on real records. The natural runs (docs/gate2a/FERRARA.md §7) never produced one, because nothing in the world
// gives an ordered man a reason to break his word; these give him one, or take the decision as made, and check what follows.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { askBetween } from '../../asks';
import { peek } from '../../core';
import { DAY } from '../../types';
import { social } from '../../conv/social';
import { promise } from '../../conv/tick';
import * as door from '../../conv/doors';
import { cast, chain } from '../../conv/ferrara';

describe('breach and its consequences', () => {
  ok('a man with a grudge refuses his captain and strikes: Henry’s result breaks at the first violation, the liability falls on him, the shopkeeper reproaches him', { tags: ['scenario'] }, () => {
    const c = cast(3, 1)!; door.grudge(c.w, c.lou, c.nate.id, 0.7, 'staged: he wants at the shopkeeper');
    const r = chain(c, 'result', { days: 45 });
    assert.equal(r.o1!.status, 'broken'); assert.match(r.o1!.why!, /violation inside the period/);
    const strike = Object.values(c.w.facts).find((f) => f.actor === c.lou.id && f.victim === c.nate.id && ['beating', 'vandalism'].includes(f.kind) && f.t > r.o1!.from)!;
    assert.equal(r.o1!.settled, strike.t, 'broken the moment it happened (the addFact hook), not at the end of the period');
    assert.ok(r.o2!.liabilities![0].fell, 'the captain’s liability fell on Henry');
    assert.match(r.o.text(), /You said you’d make sure/);
  });
  ok('an order he decided to break: he presses his demand by the ask’s own force, the order and everything it served break, his captain holds it against him', { tags: ['scenario'] }, () => {
    const c = cast(3, 0)!, { w, henry, riz, lou, marchese, nate, biz } = c;
    const dm = door.demand(w, lou, nate, biz, 50, 'm');
    assert.ok(dm.sit && dm.answer !== 'yes');
    const o1 = promise(w, { type: 'result', obligor: henry.id, beneficiary: nate.id, spec: { kind: 'noHostility', actor: lou.id, target: nate.id, biz, days: 30 }, from: w.now, by: w.now + 30 * DAY });
    const o2 = promise(w, { type: 'action', obligor: riz.id, beneficiary: henry.id, spec: { kind: 'actionDone', act: 'raise', target: marchese.id, about: 'm' }, from: w.now, by: w.now + 7 * DAY, parent: o1.id, liabilities: [{ who: henry.id, by: riz.id, feeling: 'trust', amount: 0.15, why: 'it turned ugly' }] });
    const o3 = promise(w, { type: 'restraint', order: true, obligor: lou.id, beneficiary: marchese.id, spec: { kind: 'noHostility', actor: lou.id, target: nate.id, biz, days: 30 }, from: w.now, by: w.now + 30 * DAY, parent: o2.id, intends: 'break' });
    const g0 = peek(marchese, lou.id).grudge, t0 = peek(riz, henry.id).trust;
    advance(w, w.now + 4 * DAY);
    assert.ok(social(w).log.some((a) => a.actor === lou.id && a.act === 'harm'), 'he went back, through the ask’s own force');
    assert.equal(o3.status, 'broken'); assert.equal(o1.status, 'broken');
    assert.ok(peek(marchese, lou.id).grudge > g0, 'his captain holds it against him'); assert.ok(peek(riz, henry.id).trust < t0, 'the liability fell on Henry');
    void askBetween;
  });
  ok('a man who means to keep an order calls off what he had planned before it', { tags: ['scenario'] }, () => {
    // with a grudge and his own plan of revenge already in the world's queue, Richie is ordered, agrees, and means it: the plan is dropped
    const c = cast(3, 0)!; door.grudge(c.w, c.lou, c.nate.id, 0.7, 'staged: he wants at the shopkeeper');
    const r = chain(c, 'result', { days: 45 });
    assert.equal(r.o3!.intends, 'keep');
    assert.ok(!Object.values(c.w.facts).some((f) => f.actor === c.lou.id && f.victim === c.nate.id && f.kind === 'beating' && f.t > r.o3!.from), 'no beating after he agreed');
    assert.equal(r.o1!.status, 'kept');
  });
});
