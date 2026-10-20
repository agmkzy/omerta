// Where the browser keeps the game (V89). IndexedDB first: it has room for a long game and a week of earlier days.
// If the browser will not give us IndexedDB (some private windows, a blocked or broken database), the game falls back
// to localStorage with the old, smaller limits and says so plainly.
import { DEEP, fromStorage, LOCAL, SaveBox, type AsyncStore } from './storage';

const DB = 'omerta';
const OS = 'kv';
// A save that was asked for but had not landed when the page was hidden or closed is copied here synchronously, and
// written properly on the next start. Only used with IndexedDB (with localStorage every write lands at once).
export const FLUSH = 'omerta-flush-v1';

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) return rej(new Error('IndexedDB is not available'));
    const t = setTimeout(() => rej(new Error('IndexedDB did not answer')), 4000);
    let r: IDBOpenDBRequest;
    try { r = indexedDB.open(DB, 1); } catch (e) { clearTimeout(t); return rej(e); }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(OS)) r.result.createObjectStore(OS); };
    r.onsuccess = () => { clearTimeout(t); const db = r.result; db.onversionchange = () => db.close(); res(db); };
    r.onerror = () => { clearTimeout(t); rej(r.error ?? new Error('IndexedDB could not be opened')); };
    r.onblocked = () => { clearTimeout(t); rej(new Error('IndexedDB is blocked')); };
  });
}
function idbStore(db: IDBDatabase): AsyncStore {
  // A write resolves only when its transaction has committed, so "written" means written.
  const write = (f: (s: IDBObjectStore) => IDBRequest) => new Promise<void>((res, rej) => {
    const tx = db.transaction(OS, 'readwrite');
    f(tx.objectStore(OS));
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error('the write was abandoned'));
  });
  return {
    get: async (k) => { const v = await req(db.transaction(OS, 'readonly').objectStore(OS).get(k)); return typeof v === 'string' ? v : null; },
    set: (k, v) => write((s) => s.put(v, k)),
    del: (k) => write((s) => s.delete(k)),
  };
}

let box: SaveBox | null = null;
let deep = false;
let note = '';
let ls: Storage | null = null;
try { ls = typeof localStorage !== 'undefined' ? localStorage : null; } catch { ls = null; }

export const saveBox = (): SaveBox | null => box;
export const deepStorage = () => deep;
// A plain word to the player when saving is not what it should be; empty when all is well.
export const storageNote = () => note;
export const savedRaw = (): string | null => box?.main ?? null;

// Called once, before the first screen is drawn.
export async function openSaves(): Promise<SaveBox | null> {
  try {
    const st = idbStore(await openDb());
    // Some browsers hand out a database that refuses every write; find out now rather than on the first save.
    await st.set('omerta-probe', '1');
    await st.del('omerta-probe');
    box = await SaveBox.open(st, DEEP);
    deep = true;
    // A save that was still on its way when the page last closed is the newest there is: finish writing it.
    let f: { s: string; day: number; label: string } | null = null;
    try { const raw = ls?.getItem(FLUSH); if (raw) f = JSON.parse(raw); } catch { f = null; }
    if (f && typeof f.s === 'string') box.put(f.s, f.day, f.label);
    else { try { ls?.removeItem(FLUSH); } catch { /* ignore */ } }
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back to localStorage', e);
    deep = false;
    try {
      if (!ls) throw new Error('no localStorage');
      box = await SaveBox.open(fromStorage(ls), LOCAL);
      note = 'This browser won’t give the game its proper strongbox, so your saves are kept in a small drawer instead: about 5 MB and three earlier days at most. A long game can outgrow it. Download a backup file now and then.';
    } catch {
      box = null;
      note = 'This browser won’t let the game keep anything. Nothing you do will be saved when the page closes; download a backup file before you leave.';
    }
  }
  if (box) {
    const b = box;
    b.onDone = (st) => {
      // once everything asked for has landed, the emergency copy is no longer needed
      if (deep && st.ok && !b.dirty()) { try { ls?.removeItem(FLUSH); } catch { /* ignore */ } }
      listener?.(st);
    };
  }
  return box;
}
let listener: ((st: import('./storage').SaveStatus) => void) | null = null;
// The interface hears about every write that finishes.
export const onSaved = (f: (st: import('./storage').SaveStatus) => void) => { listener = f; };

// The page is going away (or into the background, where a phone may kill it): if a save has not landed yet, keep a
// synchronous copy so a reload right after an action never loses it.
function flush() {
  if (!box || !deep || !box.dirty() || !box.main) return;
  const p = box.last;
  try { ls?.setItem(FLUSH, JSON.stringify({ s: box.main, day: p?.day ?? 0, label: p?.label ?? '' })); } catch { /* too big or blocked: the database write may still land */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
