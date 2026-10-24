// Promises, threats, agreements and questions between men, and the day each falls due (moved out of the old conversation engine,
// Gate 4: the engine calls memoTick every day). A promise not kept costs the man who made it trust, respect and his name.
import { addFact, feel, repute } from './core';
import { DAY, type Character, type World } from './types';

// Promises have a day of reckoning. A man who breaks his word is remembered for it.
export function memoTick(w: World) {
  for (const c of Object.values(w.chars)) {
    if (!c.alive || !c.memos.length) continue;
    for (const m of c.memos) {
      if (m.done || !m.due || m.due > w.now) continue;
      const p = w.chars[m.other];
      if (!p) continue;
      let kept = false;
      if (m.kind === 'promise' && m.ref) kept = w.jobs.find((j) => j.id === m.ref)?.status === 'done';
      else if (m.kind === 'promise') kept = p.books.arrears === 0;
      else if (m.kind === 'question' && m.ref) kept = !!p.known[m.ref]?.knowsActor && !!c.known[m.ref]?.knowsActor;
      m.done = true;
      if (kept) continue;
      feel(w, c, p.id, 'trust', -0.1);
      feel(w, c, p.id, 'respect', -0.06);
      if (p.isPlayer) repute(w, p, -1, 'broke word');
      addFact(w, { kind: 'ruling', actor: p.id, victim: c.id, minor: true, text: `${p.name} didn’t keep his word to ${c.name}.`, district: c.district }, { witnesses: [c.id] });
    }
    if (c.memos.length > 24) c.memos = c.memos.filter((m) => !m.done).slice(-24);
  }
}

// A promise to him that lapsed unkept, and that he has not yet been dealt with over.
export function brokenWord(w: World, p: Character, t: Character) {
  return Object.values(w.facts).find((f) => f.kind === 'ruling' && f.actor === p.id && f.victim === t.id && /keep his word/.test(f.text) && w.now - f.t < 30 * DAY && !t.talk?.['word:' + f.id]);
}
