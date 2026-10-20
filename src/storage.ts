// Browser save storage (V72, made asynchronous in V89 for IndexedDB). Pure logic over an async key-value store so it
// can be tested without a browser; the browser glue (IndexedDB, the localStorage fallback, flushing on page hide)
// lives in savestore.ts.
//
// Guarantees:
//  - a save is only reported as saved after it has been read back and compared;
//  - a failed write never touches the last good save (and a write that lands corrupted is rolled back);
//  - snapshots are bounded in number and budgeted against the space the main save needs, oldest first, and the
//    newest one is never sacrificed to make room - if the main save still does not fit, the player is told;
//  - writes are queued one at a time, the newest state always wins, and nothing in between is half-written;
//  - every outcome is returned as a SaveStatus the interface must show.
export interface StoreLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
export interface AsyncStore {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
  del(k: string): Promise<void>;
}
export const KEY = 'omerta-save-v3';
export const SNAPS = 'omerta-snaps-v1';

// How much a store may keep. localStorage is capped by the browser at roughly 5 million characters per origin;
// IndexedDB is limited only by the disk, so it keeps a snapshot for each of the last seven game days.
export interface Profile { snapDays: number; maxSnaps: number; budget: number; quota: number; warnAt: number }
export const LOCAL: Profile = { snapDays: 3, maxSnaps: 3, budget: 4_200_000, quota: 5_000_000, warnAt: 0.7 };
export const DEEP: Profile = { snapDays: 1, maxSnaps: 7, budget: 400_000_000, quota: 0, warnAt: 0 };
// Kept for older callers and tests.
export const SNAP_DAYS = LOCAL.snapDays;
export const MAX_SNAPS = LOCAL.maxSnaps;
export const QUOTA = LOCAL.quota;
export const BUDGET = LOCAL.budget;

export interface Snap { day: number; key: string; label: string; size?: number }
export interface SaveStatus {
  ok: boolean;
  available: boolean; // storage reachable at all
  bytes: number; // size of the main save
  used: number; // everything this game keeps
  snapshots: number;
  error?: string;
  warn?: string;
  lastGood?: string; // label of the last successful save, when this one failed
}

// A synchronous Storage (localStorage, or a test fake) seen through the async interface. Errors become rejections.
export function fromStorage(st: StoreLike): AsyncStore {
  return {
    get: async (k) => st.getItem(k),
    set: async (k, v) => st.setItem(k, v),
    del: async (k) => st.removeItem(k),
  };
}

export async function readSnaps(st: AsyncStore): Promise<Snap[]> {
  try {
    const l = JSON.parse((await st.get(SNAPS)) || '[]');
    return Array.isArray(l) ? l.filter((x) => x && typeof x.key === 'string') : [];
  } catch { return []; }
}
const msg = (e: unknown) => (e instanceof Error || (e && typeof e === 'object' && 'name' in e) ? (e as Error).name === 'QuotaExceededError' || /quota/i.test((e as Error).message ?? '') ? 'the browser’s storage is full' : (e as Error).message || 'storage is unavailable' : 'storage is unavailable');
const writeSnaps = (st: AsyncStore, l: Snap[]) => st.set(SNAPS, JSON.stringify(l));
async function sizeOf(st: AsyncStore, s: Snap): Promise<number> {
  if (typeof s.size === 'number') return s.size;
  try { return (await st.get(s.key))?.length ?? 0; } catch { return 0; }
}
async function snapUse(st: AsyncStore, snaps: Snap[]): Promise<number> {
  let n = JSON.stringify(snaps).length;
  for (const s of snaps) n += await sizeOf(st, s);
  return n;
}

// Shed the oldest snapshot (never the newest). Returns false when there is nothing left to shed.
async function shed(st: AsyncStore, snaps: Snap[]): Promise<boolean> {
  if (snaps.length < 2) return false;
  const o = snaps.pop()!;
  try { await st.del(o.key); } catch { /* ignore */ }
  try { await writeSnaps(st, snaps); } catch { /* the index is rebuilt from what exists next save */ }
  return true;
}

export function statusOf(bytes: number, snapsUsed: number, snapshots: number, prof: Profile): SaveStatus {
  const used = bytes + snapsUsed;
  const frac = prof.quota ? used / prof.quota : 0;
  return {
    ok: true, available: true, bytes, used, snapshots,
    warn: prof.warnAt && frac >= prof.warnAt ? `Your save is getting large (${(used / 1e6).toFixed(1)} MB of roughly ${(prof.quota / 1e6).toFixed(0)} MB). Older snapshots will be dropped first.` : undefined,
  };
}
export async function usageStatus(st: AsyncStore, prof: Profile = LOCAL): Promise<SaveStatus> {
  let bytes = 0;
  try { bytes = (await st.get(KEY))?.length ?? 0; } catch { /* counted as empty */ }
  const snaps = await readSnaps(st);
  return statusOf(bytes, await snapUse(st, snaps), snaps.length, prof);
}

export async function writeSave(st: AsyncStore, s: string, day: number, label: string, prof: Profile = LOCAL): Promise<SaveStatus> {
  let prev: string | null = null;
  try { prev = await st.get(KEY); } catch (e) { return { ok: false, available: false, bytes: 0, used: 0, snapshots: 0, error: msg(e) }; }
  let snaps = await readSnaps(st);
  const fail = async (error: string): Promise<SaveStatus> => ({ ...(await usageStatus(st, prof)), ok: false, error, lastGood: prev ? 'the previous save is still stored' : undefined });

  // 1. Make room by trimming old snapshots only if the budget says we must, then write the main save.
  while (snaps.length > 1 && (await snapUse(st, snaps)) + s.length > prof.budget) await shed(st, snaps);
  let wrote = false;
  for (let tries = 0; tries < 6 && !wrote; tries++) {
    try { await st.set(KEY, s); wrote = true; } catch (e) {
      if (!(await shed(st, snaps))) return fail(msg(e));
    }
  }
  if (!wrote) return fail('the browser’s storage is full');

  // 2. Read it back. A write that did not land intact is rolled back to the last good save.
  let back: string | null = null;
  try { back = await st.get(KEY); } catch { /* handled below */ }
  if (back !== s) {
    if (prev !== null) { try { await st.set(KEY, prev); } catch { /* nothing more to do */ } }
    return fail('the save did not read back correctly');
  }

  // 3. Snapshot, if one is due and fits. Failure here is not a failed save, but the main save stays untouched.
  const key = 'omerta-snap-' + day;
  try {
    if (!snaps.length || day - snaps[0].day >= prof.snapDays) {
      // a snapshot for this same day (after going back to an earlier one) is replaced, not duplicated
      const same = snaps.findIndex((x) => x.key === key);
      if (same >= 0) snaps.splice(same, 1);
      while (snaps.length >= prof.maxSnaps || (snaps.length > 1 && s.length + (await snapUse(st, snaps)) + s.length > prof.budget)) await shed(st, snaps);
      if (s.length + (await snapUse(st, snaps)) + s.length <= prof.budget) {
        await st.set(key, s);
        snaps.unshift({ day, key, label, size: s.length });
        await writeSnaps(st, snaps);
      }
    }
  } catch {
    try { await st.del(key); } catch { /* ignore */ }
    snaps = await readSnaps(st);
  }
  return statusOf(s.length, await snapUse(st, snaps), snaps.length, prof);
}

// ------------------------------------------------------------------ the save box
// The game is synchronous; storage is not. Everything the interface needs (is there a save, what it says, which
// earlier days exist) is read once at startup and then kept in memory. Each save is serialized at the moment it is
// asked for and queued; writes run one at a time and, when several pile up, only the newest is written.
export class SaveBox {
  main: string | null = null;
  snaps: Snap[] = [];
  status: SaveStatus | null = null;
  onDone: ((st: SaveStatus) => void) | null = null;
  // the day and label of the newest save asked for
  last: { day: number; label: string } | null = null;
  private pending: { s: string; day: number; label: string; seq: number } | null = null;
  private scheduled = false;
  private chain: Promise<void> = Promise.resolve();
  private seq = 0;
  private doneSeq = 0;
  private gen = 0; // bumped by erase: writes queued before it never pick up a save asked for after it
  constructor(readonly st: AsyncStore, readonly prof: Profile) {}

  static async open(st: AsyncStore, prof: Profile): Promise<SaveBox> {
    const b = new SaveBox(st, prof);
    b.main = await st.get(KEY);
    b.snaps = await readSnaps(st);
    b.status = statusOf(b.main?.length ?? 0, b.snaps.reduce((a, x) => a + (x.size ?? 0), 0), b.snaps.length, prof);
    return b;
  }
  hasSave() { return !!this.main; }
  // true while a save has been asked for that has not yet landed
  dirty() { return this.doneSeq < this.seq; }

  private queue(f: () => Promise<void>) {
    this.chain = this.chain.then(f).catch(() => { /* every task handles its own failure; the queue never stops */ });
  }
  put(s: string, day: number, label: string): void {
    this.main = s;
    this.last = { day, label };
    this.pending = { s, day, label, seq: ++this.seq };
    if (this.scheduled) return; // a write is already waiting to start: it will take this newer state
    this.scheduled = true;
    const g = this.gen;
    this.queue(() => this.drain(g));
  }
  private async drain(g: number): Promise<void> {
    if (g !== this.gen) return;
    this.scheduled = false;
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    let r: SaveStatus;
    try { r = await writeSave(this.st, p.s, p.day, p.label, this.prof); } catch (e) { r = { ok: false, available: false, bytes: 0, used: 0, snapshots: 0, error: msg(e) }; }
    this.snaps = await readSnaps(this.st);
    this.status = r;
    this.doneSeq = Math.max(this.doneSeq, p.seq);
    try { this.onDone?.(r); } catch { /* the interface must not stop the queue */ }
  }
  // Resolves once every save asked for so far has been written (or has failed).
  async idle(): Promise<SaveStatus | null> {
    let c: Promise<void>;
    do { c = this.chain; await c; } while (c !== this.chain);
    return this.status;
  }
  async readSnap(key: string): Promise<string | null> {
    if (!this.snaps.some((x) => x.key === key)) return null;
    try { return await this.st.get(key); } catch { return null; }
  }
  // Erase the game: the main save and every earlier day. Takes effect in memory at once; a save asked for afterwards
  // (a new game) is written after the erasing, never wiped by it.
  erase(): Promise<void> {
    this.gen++;
    this.pending = null;
    this.scheduled = false;
    this.doneSeq = this.seq;
    this.main = null;
    this.last = null;
    this.status = null;
    this.snaps = [];
    this.queue(async () => {
      const keys = [KEY, ...(await readSnaps(this.st)).map((x) => x.key), SNAPS];
      for (const k of keys) { try { await this.st.del(k); } catch { /* nothing to clear */ } }
      this.snaps = [];
    });
    return this.idle().then(() => undefined);
  }
}
