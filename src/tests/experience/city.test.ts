// Places and routines (Phase 1.6, the Little Italy slice): where a man who lives there is follows his life and the clock, is the same
// every time it is asked, and is what "where is he" says.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { ownerBiz } from '../../core';
import { routine, SLICE, spotById, spots } from '../../city';
import { whereIs } from '../../where';
import { DAY } from '../../types';
import { P } from '../helpers';
import { worldFor } from './play';

const at = (day: number, h: number) => day * DAY + h * 60; // (day 0 is a Monday)

describe('the district built properly', { tags: ['unit'] }, () => {
  ok('its places: the family club, the street’s own, and every open business', () => {
    const w = worldFor(3), all = spots(w);
    assert.ok(all.some((s) => s.kind === 'cafe') && all.some((s) => s.kind === 'church') && all.some((s) => s.kind === 'bar'));
    for (const b of Object.values(w.biz)) if (b.district === SLICE && b.open) assert.ok(all.some((s) => s.biz === b.id), b.name);
  });
  ok('a shopkeeper is in his shop on a weekday morning, not on a Sunday, and asleep at four', () => {
    const w = worldFor(3);
    const o = Object.values(w.chars).find((c) => c.alive && c.district === SLICE && ownerBiz(w, c.id)?.open && c.rank === 'civilian')!;
    assert.equal(routine(w, o, at(1, 11)), 'biz:' + ownerBiz(w, o.id)!.id);
    assert.notEqual(routine(w, o, at(6, 11)), 'biz:' + ownerBiz(w, o.id)!.id);
    assert.equal(routine(w, o, at(2, 4)), 'home');
  });
  ok('the same man, the same hour: the same place, every time; and that is where "where is he" says he is', () => {
    const w = worldFor(3), p = P(w);
    for (const c of Object.values(w.chars).filter((x) => x.alive && x.district === SLICE && x.rank !== 'civilian')) {
      const r = routine(w, c, w.now);
      assert.equal(routine(w, c, w.now), r);
      const s = r && r !== 'home' ? spotById(w, r) : undefined;
      if (s) assert.equal(whereIs(w, p, c).name, s.name);
    }
  });
  ok('a gambler goes to the track on a Saturday afternoon', () => {
    const w = worldFor(3);
    const g = Object.values(w.chars).find((c) => c.alive && c.district === SLICE && c.rank !== 'civilian' && c.traits.vice >= 0.55);
    if (g) assert.equal(routine(w, g, at(5, 15)), 'track');
  });
});
