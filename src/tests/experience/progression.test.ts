// The road to being made, as a player walks it (the compelling-RPG stage): made men of the family have work of their own, put it the
// player's way when asked or when they need a hand, and doing it is how they come to trust him; a man who has done everything is not
// left waiting on a funeral for a seat; the ceremony is held on a night, and he can get to it.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { needsOf } from '../../work';
import { approaches, resolve, takeJob } from '../../jobs';
import { DAY } from '../../types';
import { P } from '../helpers';
import { Talk, familyMen, freeShops, standWith, worldFor } from './play';

describe('made men have work of their own, and doing it is how they come to trust you', { tags: ['scenario'] }, () => {
  ok('a soldier with shops on his book needs his envelopes carried up; asked, he puts it the player’s way; done, he trusts him more', () => {
    const w = worldFor(3), p = P(w), [s] = familyMen(w, 'soldier');
    for (const b of freeShops(w).slice(0, 2)) b.protection = { collectorId: s.id, familyId: s.familyId!, fee: 50, since: w.now } as never;
    assert.ok(needsOf(w, s).some((n) => n.kind === 'deliver'), `his needs: ${needsOf(w, s).map((n) => n.title).join(' | ')}`);
    standWith(w, s, { trust: 0.25, known: 0.4 });
    const t = new Talk(w, s);
    const r = t.say(/anything I can do for you/);
    const j = w.jobs.find((q) => q.giver === s.id && q.assignee === p.id && q.status === 'offered');
    assert.ok(j, `he had nothing to give:\n${t.transcript()}`);
    assert.ok(r.choices.some((c) => /take care of it/.test(c.label)), 'and the player can take it there and then');
    takeJob(w, j!);
    const before = s.rels[p.id].trust;
    resolve(w, j!, approaches(w, j!)[0].code);
    if (j!.status === 'done') assert.ok(s.rels[p.id].trust > before, 'done, it counts with him');
  });
  ok('a made man who knows the player, with work and nobody of his own to do it, comes to him with it', () => {
    const w = worldFor(7), p = P(w);
    const men = familyMen(w, 'soldier').slice(0, 4);
    for (const [i, m] of men.entries()) { for (const b of freeShops(w).slice(i * 2, i * 2 + 2)) b.protection = { collectorId: m.id, familyId: m.familyId!, fee: 50, since: w.now } as never; standWith(w, m, { trust: 0.35, known: 0.5 }); }
    advance(w, w.now + 21 * DAY);
    assert.ok(w.jobs.some((j) => j.assignee === p.id && j.via === 'tip' && men.some((m) => m.id === j.giver)), 'nobody asked him in three weeks');
  });
});
