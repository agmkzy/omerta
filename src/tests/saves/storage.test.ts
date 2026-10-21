// Saving, through the asynchronous store (IndexedDB in the browser) and the localStorage fallback (V89). One scenario, many checks.
import assert from 'node:assert';
import { describe, test } from 'vitest';
import { writeSave, readSnaps, fromStorage, SaveBox, KEY, SNAPS, BUDGET, LOCAL, DEEP, type StoreLike, type AsyncStore } from '../../storage';

// A localStorage-like store with a quota (the fallback), seen through the async interface.
class Fake implements StoreLike {
  m = new Map<string, string>(); cap = Infinity; corrupt = false;
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) {
    const used = [...this.m].filter(([x]) => x !== k).reduce((a, [, y]) => a + y.length, 0);
    if (used + v.length > this.cap) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    const bad = this.corrupt && k === KEY; if (bad) this.corrupt = false; // corrupts one write only
    this.m.set(k, bad ? v.slice(1) : v);
  }
  removeItem(k: string) { this.m.delete(k); }
}
// An IndexedDB-like store: every call really is asynchronous (a macrotask later), and writes are counted.
class Slow implements AsyncStore {
  m = new Map<string, string>(); writes = 0; cap = Infinity;
  private tick = () => new Promise<void>((r) => setTimeout(r, 1));
  async get(k: string) { await this.tick(); return this.m.get(k) ?? null; }
  async set(k: string, v: string) {
    await this.tick();
    const used = [...this.m].filter(([x]) => x !== k).reduce((a, [, y]) => a + y.length, 0);
    if (used + v.length > this.cap) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    this.writes++; this.m.set(k, v);
  }
  async del(k: string) { await this.tick(); this.m.delete(k); }
}
const blob = (n: number, c = 'a') => c.repeat(n);

async function main() {
  // 1. Normal saves succeed, snapshots every 3 days, at most 3, never beyond the budget (localStorage fallback).
  {
    const f = new Fake(); const st = fromStorage(f);
    for (let d = 0; d < 30; d++) { const r = await writeSave(st, blob(400_000, String(d % 10)), d, 'day ' + d, LOCAL); assert.ok(r.ok, 'save ok'); assert.equal(f.getItem(KEY)!.length, 400_000); }
    const sn = await readSnaps(st); assert.ok(sn.length >= 1 && sn.length <= 3, 'snapshots ' + sn.length);
    const used = [...f.m].reduce((a, [, y]) => a + y.length, 0); assert.ok(used <= BUDGET + 1000, 'within budget ' + used);
    console.log('ok  normal saves + snapshot budget (' + sn.length + ' snaps, ' + used + ' chars)');
  }
  // 2. Big save: snapshots shed oldest first, newest kept, main save still lands.
  {
    const f = new Fake(); const st = fromStorage(f);
    for (let d = 0; d < 12; d += 3) await writeSave(st, blob(900_000, 'x'), d, 'd' + d);
    const before = (await readSnaps(st)).map((s) => s.key);
    const r = await writeSave(st, blob(1_900_000, 'y'), 15, 'd15'); assert.ok(r.ok);
    assert.equal(f.getItem(KEY)!.length, 1_900_000);
    const after = await readSnaps(st);
    assert.ok(after.length >= 1 && after.some((s) => s.key === before[0] || s.day === 15), 'newest snapshot kept');
    console.log('ok  large save sheds snapshots (' + before.length + ' -> ' + after.length + ')');
  }
  // 3. Quota failure: reported, last good save intact, newest snapshot not destroyed.
  {
    const f = new Fake(); const st = fromStorage(f); const good = blob(500_000, 'g');
    assert.ok((await writeSave(st, good, 0, 'd0')).ok);
    f.cap = 600_000;
    const r = await writeSave(st, blob(900_000, 'n'), 1, 'd1');
    assert.equal(r.ok, false, 'must report failure'); assert.ok(r.error);
    assert.equal(f.getItem(KEY), good, 'last good save untouched');
    assert.equal((await readSnaps(st)).length, 1, 'newest snapshot kept');
    console.log('ok  quota failure surfaced, last good save preserved: "' + r.error + '"');
  }
  // 4. Silent corruption: write reads back wrong -> rolled back and reported.
  {
    const f = new Fake(); const st = fromStorage(f); const good = blob(1000, 'g'); await writeSave(st, good, 0, 'd0');
    f.corrupt = true; const r = await writeSave(st, blob(2000, 'n'), 1, 'd1');
    assert.equal(r.ok, false);
    assert.equal(f.getItem(KEY), good, 'rolled back');
    console.log('ok  read-back verification catches a bad write');
  }
  // 5. Storage entirely blocked.
  {
    const st: StoreLike = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    const r = await writeSave(fromStorage(st), 'x', 0, 'd'); assert.equal(r.ok, false); assert.equal(r.available, false);
    console.log('ok  blocked storage reported as unavailable');
  }
  // 6. IndexedDB profile: big saves (well past localStorage's 5 MB) keep one snapshot per day for the last 7 days.
  {
    const st = new Slow();
    for (let d = 0; d < 20; d++) { const r = await writeSave(st, blob(2_500_000, String(d % 10)), d, 'day ' + d, DEEP); assert.ok(r.ok, 'deep save ok'); assert.equal(r.warn, undefined); }
    const sn = await readSnaps(st);
    assert.deepEqual(sn.map((s) => s.day), [19, 18, 17, 16, 15, 14, 13], 'one per day, newest first, bounded at 7');
    assert.equal([...st.m.keys()].filter((k) => k.startsWith('omerta-snap-')).length, 7, 'shed snapshots are deleted');
    assert.equal(st.m.get(KEY)!.length, 2_500_000);
    console.log('ok  deep storage: 2.5 MB saves, 7 daily snapshots (' + sn.map((s) => s.day).join(',') + ')');
  }
  // 7. Going back to an earlier day and saving on it replaces that day's snapshot rather than listing it twice.
  {
    const st = new Slow();
    for (let d = 0; d < 4; d++) await writeSave(st, blob(10, String(d)), d, 'day ' + d, DEEP);
    await writeSave(st, blob(10, 'r'), 1, 'day 1 again', DEEP); // restored to day 1: not due (1 - 3 < 1)
    await writeSave(st, blob(10, 'z'), 5, 'day 5', DEEP);
    const sn = await readSnaps(st);
    assert.equal(new Set(sn.map((s) => s.key)).size, sn.length, 'no duplicate snapshot keys');
    console.log('ok  snapshot index stays free of duplicates');
  }
  // 8. The save box: opens what is stored, coalesces a burst of saves into few writes, and the newest always wins.
  {
    const st = new Slow();
    await writeSave(st, 'old', 0, 'day 0', DEEP);
    const b = await SaveBox.open(st, DEEP);
    assert.equal(b.main, 'old'); assert.equal(b.snaps.length, 1); assert.ok(b.hasSave());
    const seen: boolean[] = []; b.onDone = (r) => seen.push(r.ok);
    const w0 = st.writes;
    for (let i = 1; i <= 10; i++) b.put('state ' + i, 1, 'day 1'); // ten actions in one burst
    assert.equal(b.main, 'state 10', 'memory has the newest at once'); assert.ok(b.dirty());
    const r = await b.idle();
    assert.ok(r?.ok); assert.ok(!b.dirty());
    assert.equal(st.m.get(KEY), 'state 10', 'newest landed');
    assert.ok(st.writes - w0 <= 4, 'burst coalesced (' + (st.writes - w0) + ' writes)');
    assert.ok(seen.length >= 1 && seen.every(Boolean));
    // a save asked for while one is being written is not lost
    b.put('A', 2, 'day 2'); await new Promise((r2) => setTimeout(r2, 2)); b.put('B', 3, 'day 3');
    await b.idle();
    assert.equal(st.m.get(KEY), 'B');
    assert.equal(await b.readSnap(b.snaps[0].key), 'B', 'snapshot readable');
    assert.equal(await b.readSnap('omerta-snap-999'), null);
    console.log('ok  save box: burst of 10 saves -> ' + (st.writes - w0) + ' writes, newest kept, snapshots ' + b.snaps.map((s) => s.day).join(','));
  }
  // 9. Erasing then starting a new game: the old game and its days are gone, the new save is not wiped by the erase.
  {
    const st = new Slow();
    const b = await SaveBox.open(st, DEEP);
    for (let d = 0; d < 4; d++) b.put('old ' + d, d, 'day ' + d);
    void b.erase();
    assert.ok(!b.hasSave(), 'erased at once in memory');
    b.put('new game', 0, 'day 0');
    await b.idle();
    assert.equal(st.m.get(KEY), 'new game');
    const sn = await readSnaps(st);
    assert.deepEqual(sn.map((s) => s.key), ['omerta-snap-0']);
    assert.equal(st.m.get('omerta-snap-0'), 'new game');
    await b.erase();
    assert.equal(st.m.size, 0, 'erase leaves nothing: ' + [...st.m.keys()].join(','));
    console.log('ok  erase + new game');
  }
  // 10. A failing write in the box: reported through onDone, previous save untouched, the queue keeps going.
  {
    const st = new Slow();
    const b = await SaveBox.open(st, DEEP);
    b.put(blob(100, 'g'), 0, 'd0'); await b.idle();
    st.cap = 150;
    let last = null as boolean | null; b.onDone = (r) => { last = r.ok; };
    b.put(blob(500, 'n'), 1, 'd1'); const r = await b.idle();
    assert.equal(r?.ok, false); assert.equal(last, false); assert.ok(r?.error);
    assert.equal(st.m.get(KEY), blob(100, 'g'));
    st.cap = Infinity;
    b.put(blob(500, 'n'), 1, 'd1'); assert.equal((await b.idle())?.ok, true);
    assert.equal(st.m.get(KEY), blob(500, 'n'));
    console.log('ok  failed write reported, last good kept, later write recovers');
  }
  // 11. The fallback store goes through the same box.
  {
    const f = new Fake(); f.cap = 3_000_000;
    const b = await SaveBox.open(fromStorage(f), LOCAL);
    for (let d = 0; d < 12; d++) b.put(blob(600_000, String(d % 10)), d, 'd' + d);
    const r = await b.idle();
    assert.ok(r?.ok); assert.ok(b.snaps.length <= 3);
    assert.equal(f.getItem(KEY)!.length, 600_000);
    assert.ok(JSON.parse(f.getItem(SNAPS)!).length === b.snaps.length);
    console.log('ok  localStorage fallback through the save box (' + b.snaps.length + ' snaps)');
  }
  console.log('storage tests passed');
}

describe('storage', () => {
  test('saves land, snapshots stay bounded, failures keep the last good save, the async box and the fallback behave', { tags: ['scenario'] }, async () => { await main(); });
});
