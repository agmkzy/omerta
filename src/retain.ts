// Information retention (V72).
//
// Facts and per-character knowledge used to grow without limit (~54 KB/day). The rule here is NOT "delete
// old things". A fact survives while anything can still use it:
//   permanent  - promotions, deaths, rulings, failures, informants...: the fact is never dropped
//   active     - anything an open structure still points at (debt, dispute, pending event, memo, encounter,
//                scene, a later fact's `cause`): kept whatever its age
//   expired    - routine observations nobody refers to any more: fact and every copy of it in `known` go
// Knowledge of ageing significant facts is also thinned out for bystanders (never for the people involved).
// The sweep runs once a week, over the facts only; it is not part of the per-tick path.
import type { Fact, FactKind, Id, World } from './types';
import { DAY } from './types';

export const PERMANENT = new Set<FactKind>([
  'murder', 'promotion', 'ruling', 'sitdown', 'event', 'business_failed', 'debt_default',
  'exposed', 'informant', 'side_operation', 'levy', 'raid', 'ownership',
]);
// Observations that stop mattering once nobody is acting on them.
export const ROUTINE = new Set<FactKind>([
  'gambling_loss', 'protection_refused', 'protection_late', 'report', 'business_struggling',
  'gathering', 'rumour', 'debt_paid', 'debt_missed', 'attempt', 'trouble', 'loan', 'terms',
]);

// Diagnostics: tests switch retention off to reproduce the pre-V72 growth for before/after measurements. Never touched by the game.
export const RETENTION = { on: true };

export const ROUTINE_DAYS = 21;
export const PLAYER_ROUTINE_DAYS = 60; // what happened to you is remembered a little longer
export const SIGNIFICANT_DAYS = 150;
export const PLAYER_SIGNIFICANT_DAYS = 365;
export const BYSTANDER_DAYS = 60; // bystanders forget significant facts after this long

export const tierOf = (k: FactKind): 'permanent' | 'routine' | 'significant' =>
  PERMANENT.has(k) ? 'permanent' : ROUTINE.has(k) ? 'routine' : 'significant';

// How far a fact may travel by gossip: routine news barely leaves the room.
export function gossipCap(f: Fact): number {
  if (!RETENTION.on) return 1e9;
  const t = tierOf(f.kind);
  return t === 'permanent' ? 1e9 : t === 'significant' ? 14 : 3;
}
export function gossipFresh(w: World, f: Fact): boolean {
  return !RETENTION.on || tierOf(f.kind) === 'permanent' || w.now - f.t < (tierOf(f.kind) === 'routine' ? 10 : 45) * DAY;
}

const FACT_ID = /^f\d+$/;

// Every fact id that a live structure still points at. Walks everything except the fact store and the
// knowledge maps themselves, so a new field that stores a fact id is protected without anyone remembering to list it.
export function referencedFacts(w: World): Set<Id> {
  const out = new Set<Id>();
  const seen = new Set<object>();
  const walk = (v: unknown, key?: string) => {
    if (typeof v === 'string') { if (FACT_ID.test(v)) out.add(v); return; }
    if (!v || typeof v !== 'object' || seen.has(v as object)) return;
    seen.add(v as object);
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const o = v as Record<string, unknown>;
    // Closed business: a settled debt, a dropped dispute or a finished job no longer needs its facts.
    if (typeof o.status === 'string' && ['paid', 'void', 'settled', 'dropped'].includes(o.status) && ('balance' in o || 'claim' in o)) return;
    for (const [k, x] of Object.entries(o)) walk(x, k);
  };
  for (const [k, v] of Object.entries(w)) {
    if (k === 'facts' || k === 'rng' || k === 'queue') continue;
    if (k === 'chars') {
      for (const c of Object.values(w.chars)) for (const [ck, cv] of Object.entries(c)) if (ck !== 'known') walk(cv, ck);
      continue;
    }
    walk(v, k);
  }
  for (const q of w.queue) walk(q);
  return out;
}

export interface SweepStats { facts: number; known: number; before: number; after: number }

export function sweep(w: World): SweepStats {
  if (!RETENTION.on) return { facts: 0, known: 0, before: 0, after: 0 };
  const before = Object.keys(w.facts).length;
  const refs = referencedFacts(w);
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  const openStory = new Set<Id>();
  for (const d of w.disputes ?? []) if (d.status === 'open' || d.status === 'violated') openStory.add(d.id);
  // A kept fact keeps what it was caused by.
  const keep = new Set<Id>();
  const mark = (id: Id) => {
    for (let guard = 0; id && !keep.has(id) && guard < 50; guard++) {
      const f = w.facts[id];
      if (!f) return;
      keep.add(id);
      id = f.cause as Id;
    }
  };
  const drop: Id[] = [];
  for (const f of Object.values(w.facts)) {
    const tier = tierOf(f.kind);
    const age = (w.now - f.t) / DAY;
    const mine = !!p && (f.actor === p.id || f.victim === p.id);
    const live = refs.has(f.id) || (f.story ? openStory.has(f.story) : false);
    const limit = tier === 'routine' ? (mine ? PLAYER_ROUTINE_DAYS : ROUTINE_DAYS) : mine ? PLAYER_SIGNIFICANT_DAYS : SIGNIFICANT_DAYS;
    if (tier === 'permanent' || live || age < limit) mark(f.id);
    else drop.push(f.id);
  }
  let known = 0;
  const dropSet = new Set(drop.filter((id) => !keep.has(id)));
  for (const id of dropSet) delete w.facts[id];
  for (const c of Object.values(w.chars)) {
    const deadLong = !c.alive;
    for (const id of Object.keys(c.known)) {
      const f = w.facts[id];
      if (!f) {
        if (FACT_ID.test(id)) { delete c.known[id]; known++; } // fact is gone
        continue; // non-fact keys ('leave:...') belong to other systems
      }
      if (tierOf(f.kind) === 'permanent' || c.isPlayer) continue;
      const involved = f.actor === c.id || f.victim === c.id;
      const old = (w.now - f.t) / DAY > BYSTANDER_DAYS;
      if (!involved && !refs.has(id) && (old || deadLong)) { delete c.known[id]; known++; }
    }
  }
  return { facts: dropSet.size, known, before, after: Object.keys(w.facts).length };
}
