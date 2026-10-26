// What the player's character knows, and what the screens agree on (the coherence repair, phases 9 and 10). From the playtest
// (docs/playtest/REPORT.md, issues 12, 16, 18, 23, 26, 28, 30).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { shortTime } from '../../core';
import { leanable } from '../../conv/authority';
import { knowsProtection } from '../../acquaint';
import { relationOf } from '../../conv/visit';
import { S } from '../../ui/state';
import { treeView, needs } from '../../ui/views_a';
import { openAsk } from '../../asks';
import { DAY, type World } from '../../types';
import { createWorld } from '../../world';
import { P } from '../helpers';
import { Talk, freeShops, standWith, worldFor } from './play';

const draw = (w: World, f: () => string) => { S.w = w; return f(); };

describe('another family is seen from outside', { tags: ['scenario'] }, () => {
  ok('its boss and underboss by name; its captains and men only as far as the player knows them; no succession, no other houses’ quarrels', () => {
    const w = worldFor(3), p = P(w), rival = Object.values(w.fam).find((f) => f.id !== p.familyId)!;
    const html = draw(w, () => treeView(rival.id));
    const theirs = Object.values(w.chars).filter((c) => c.alive && c.familyId === rival.id && (c.rank === 'soldier' || c.rank === 'associate'));
    const named = theirs.filter((c) => html.includes(c.name) && !p.rels[c.id] && !Object.keys(p.known).some((k) => w.facts[k]?.actor === c.id || w.facts[k]?.victim === c.id));
    assert.deepEqual(named.map((c) => c.name), [], 'men the player has never met or heard of are named');
    assert.ok(!/in line/.test(html), 'another family’s order of succession is shown');
    const others = Object.values(w.fam).filter((f) => f.id !== p.familyId && f.id !== rival.id);
    assert.ok(!others.some((f) => html.includes(`${f.name}: `)), 'how two other families stand is shown');
  });
  ok('who looks after a shop across the city is not known until something puts it on his map', () => {
    const w = worldFor(3), p = P(w);
    const far = Object.values(w.biz).find((b) => b.open && b.protection && !w.fam[p.familyId!].districts.includes(b.district) && !p.intro?.[b.ownerId]);
    if (!far) return;
    assert.equal(knowsProtection(w, p, far), false);
  });
});

describe('the screens agree', { tags: ['scenario'] }, () => {
  ok('every shop Rackets lists to lean on is one the conversation lets him pitch, and the other way round', () => {
    const w = worldFor(3), p = P(w);
    for (const b of leanable(w, p).slice(0, 4)) {
      const o = w.chars[b.ownerId]; standWith(w, o, { trust: 0.2, known: 0.3 });
      const t = new Talk(w, o);
      assert.ok(t.has((c) => c.id === 'protect'), `${b.name} is listed but can't be pitched`);
      t.leave();
    }
    const listed = new Set(leanable(w, p).map((b) => b.id));
    for (const b of freeShops(w).filter((x) => !listed.has(x.id)).slice(0, 4)) {
      const o = w.chars[b.ownerId]; standWith(w, o, { trust: 0.2, known: 0.3 });
      const t = new Talk(w, o);
      assert.ok(!t.has((c) => c.id === 'protect'), `${b.name} can be pitched but isn't listed`);
      t.leave();
    }
  });
  ok('a request of the player’s that was turned down is not something that needs him', () => {
    const w = worldFor(3), p = P(w), b = freeShops(w)[0], o = w.chars[b.ownerId];
    const s = openAsk(w, 'protect', p, o, { biz: b.id, amt: 60 })!;
    s.phase = 'refused'; s.st = { ...(s.st ?? {}), [o.id]: { ...(s.st?.[o.id] ?? {}), last: 'no' } } as never;
    S.w = w;
    const row = needs().find((n) => n.a === `story:sit:${s.id}`);
    if (row) assert.notEqual(row.dot, 'red'); if (row) assert.notEqual(row.dot, 'amber');
  });
  ok('one way of saying a date', () => {
    assert.match(shortTime(0), /^Mon 2 Mar, 00:00$/);
    assert.match(shortTime(69 * DAY + 9 * 60), /^\w{3} \d{1,2} \w{3}, 09:00$/);
  });
  ok('a man his background says he has dealt with for years is not a stranger', () => {
    for (const seed of [3, 7, 11, 13]) {
      const w = createWorld(seed, 'Pasquale Castiglione', { bg: 'bookmaker' } as never), p = P(w);
      const d = w.debts.find((x) => x.creditor === p.id && x.status === 'active');
      if (!d) continue;
      assert.notEqual(relationOf(w, p, w.chars[d.debtor]).level, 'stranger');
      return;
    }
  });
  ok('a night job happens that night: taken up early, the hours pass first; the night gone, it is gone', async () => {
    const { gigStale } = await import('../../gigs');
    const w = worldFor(3);
    const j = { id: 'jx', kind: 'gig', title: 'A truck', brief: '', giver: null, via: 'tip', assignee: P(w).id, pay: 100, created: w.now, expires: w.now + 5 * DAY, status: 'offered', extra: { gig: 'shipment', at: w.now + 2 * DAY } } as never;
    assert.equal(gigStale(w, j), null);
    advance(w, w.now + 3 * DAY);
    assert.match(String(gigStale(w, j)), /came and went/);
  });
});
