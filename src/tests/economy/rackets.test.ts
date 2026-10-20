// Rackets: every racket in the catalogue has a sheet, a way in and a group the interface lists. From the V72 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { OPS, OP_GROUPS } from '../../rackets';
import { OP_SHEETS, WAYS } from '../../ways';

describe('rackets', { tags: ['unit'] }, () => {
  ok('every racket in OPS has a sheet, a way, and a group the interface lists', () => {
    for (const k of Object.keys(OPS) as (keyof typeof OPS)[]) {
      const way = WAYS.find((x) => x.op === k);
      assert.ok(way, 'way for ' + k); assert.equal(way!.kind, 'op');
      const s = OP_SHEETS[k]; for (const f of ['name', 'cat', 'pitch', 'pays', 'needs', 'risks', 'tip'] as const) assert.ok(String(s[f]).length > 3, `${k}.${f}`);
      assert.ok(s.how.length > 0);
      assert.ok((OP_GROUPS as readonly string[]).includes(OPS[k].group), 'group ' + OPS[k].group);
    }
    assert.equal(WAYS.filter((x) => x.kind === 'op').length, Object.keys(OPS).length);
    assert.equal(new Set(WAYS.map((x) => x.id)).size, WAYS.length, 'unique way ids');
  });
});
