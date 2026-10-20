// Browser save storage (V72). Pure logic over a Storage-like object so it can be tested without a browser.
//
// Guarantees:
//  - a save is only reported as saved after it has been read back and compared;
//  - a failed write never touches the last good save (and a write that lands corrupted is rolled back);
//  - snapshots are budgeted against the space the main save needs, oldest first, and the newest one is never
//    sacrificed to make room - if the main save still does not fit, the player is told;
//  - every outcome is returned as a SaveStatus the interface must show.
export interface StoreLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
export const KEY = 'omerta-save-v3';
export const SNAPS = 'omerta-snaps-v1';
export const SNAP_DAYS = 3; // game days between snapshots
export const MAX_SNAPS = 3;
// Browsers allow roughly 5 million characters per origin; stay well inside it for our own keys.
export const QUOTA = 5_000_000;
export const BUDGET = 4_200_000;
export const WARN_AT = 0.7;

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

export function readSnaps(st: StoreLike): Snap[] {
  try {
    const l = JSON.parse(st.getItem(SNAPS) || '[]');
    return Array.isArray(l) ? l.filter((x) => x && typeof x.key === 'string') : [];
  } catch { return []; }
}
const len = (st: StoreLike, k: string) => { try { return (st.getItem(k) ?? '').length; } catch { return 0; } };
export function usage(st: StoreLike): { bytes: number; used: number; snaps: Snap[] } {
  const snaps = readSnaps(st);
  const bytes = len(st, KEY);
  return { bytes, used: bytes + snaps.reduce((a, s) => a + len(st, s.key), 0) + len(st, SNAPS), snaps };
}
const msg = (e: unknown) => (e instanceof Error ? e.name === 'QuotaExceededError' || /quota/i.test(e.message) ? 'the browser’s storage is full' : e.message : 'storage is unavailable');
const writeSnaps = (st: StoreLike, l: Snap[]) => st.setItem(SNAPS, JSON.stringify(l));

// Shed the oldest snapshot (never the newest). Returns false when there is nothing left to shed.
function shed(st: StoreLike, snaps: Snap[]): boolean {
  if (snaps.length < 2) return false;
  const o = snaps.pop()!;
  try { st.removeItem(o.key); } catch { /* ignore */ }
  try { writeSnaps(st, snaps); } catch { /* the index is rebuilt from what exists next save */ }
  return true;
}

export function writeSave(st: StoreLike, s: string, day: number, label: string): SaveStatus {
  let prev: string | null = null;
  try { prev = st.getItem(KEY); } catch (e) { return { ok: false, available: false, bytes: 0, used: 0, snapshots: 0, error: msg(e) }; }
  let snaps = readSnaps(st);
  const fail = (error: string): SaveStatus => ({ ...usageStatus(st), ok: false, error, lastGood: prev ? 'the previous save is still stored' : undefined });

  // 1. Make room by trimming old snapshots only if the budget says we must, then write the main save.
  while (snaps.length > 1 && usage(st).used - len(st, KEY) + s.length > BUDGET) { shed(st, snaps); snaps = readSnaps(st); }
  let wrote = false;
  for (let tries = 0; tries < 6 && !wrote; tries++) {
    try { st.setItem(KEY, s); wrote = true; } catch (e) {
      snaps = readSnaps(st);
      if (!shed(st, snaps)) return fail(msg(e));
    }
  }
  if (!wrote) return fail('the browser’s storage is full');

  // 2. Read it back. A write that did not land intact is rolled back to the last good save.
  let back: string | null = null;
  try { back = st.getItem(KEY); } catch { /* handled below */ }
  if (back !== s) {
    if (prev !== null) { try { st.setItem(KEY, prev); } catch { /* nothing more to do */ } }
    return fail('the save did not read back correctly');
  }

  // 3. Snapshot, if one is due and fits. Failure here is not a failed save, but the main save stays untouched.
  snaps = readSnaps(st);
  try {
    if (!snaps.length || day - snaps[0].day >= SNAP_DAYS) {
      while (snaps.length >= MAX_SNAPS || (snaps.length > 1 && usage(st).used + s.length > BUDGET)) { shed(st, snaps); snaps = readSnaps(st); }
      if (usage(st).used + s.length <= BUDGET) {
        const key = 'omerta-snap-' + day;
        st.setItem(key, s);
        snaps.unshift({ day, key, label, size: s.length });
        writeSnaps(st, snaps);
      }
    }
  } catch {
    try { st.removeItem('omerta-snap-' + day); } catch { /* ignore */ }
    snaps = readSnaps(st);
  }
  return usageStatus(st);
}

export function usageStatus(st: StoreLike): SaveStatus {
  const u = usage(st);
  const frac = u.used / QUOTA;
  return {
    ok: true,
    available: true,
    bytes: u.bytes,
    used: u.used,
    snapshots: u.snaps.length,
    warn: frac >= WARN_AT ? `Your save is getting large (${(u.used / 1e6).toFixed(1)} MB of roughly 5 MB). Older snapshots will be dropped first.` : undefined,
  };
}
