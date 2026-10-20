// Loads genuine saves written by earlier builds and checks they load, play on and round-trip.
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, test as ok } from 'vitest';
import { advance, deserialize, serialize } from '../engine';
import { DAY } from '../types';
const dir = new URL('./fixtures/', import.meta.url);
describe('old saves', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.save'))) ok(f + ' loads, plays 3 days, round-trips', () => {
    const raw = readFileSync(new URL(f, dir), 'utf8');
    const w = deserialize(raw);
    const d0 = w.now;
    advance(w, w.now + 3 * DAY);
    assert.ok(w.now > d0, f + ' did not advance');
    assert.equal(serialize(deserialize(serialize(w))), serialize(w), f + ' round trip');
    console.log(f + ' (schema ' + JSON.parse(raw).schema + ') loads, plays 3 days, round-trips');
  });
});
