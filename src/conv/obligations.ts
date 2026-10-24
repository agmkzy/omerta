// Obligations (spec §6.3–6.5): the four kinds, judged on what they actually undertook and on the time rules.
//   action     kept when the act is done in the window (by him, or a man he named, if the promise allows); broken when it closes without it
//   effort     kept by a good-faith attempt: one he had reason, when he made it, to think might work, even if it failed
//   result     over a period: kept only when the whole period has passed cleanly; broken at the first violation. By a date: kept the
//              moment the condition holds, broken if the date passes without it
//   restraint  kept when the window closes without the obligor doing the forbidden act; what others do or find out is not his
// Void, not broken, when it becomes impossible by something he neither caused nor could have foreseen (§6.5).
// Checked against the world's records (facts, asks) and the record of acts done. Fulfilment and credit are separate: who brought a
// result about is recorded with it; how the beneficiary sees that is his belief, not the obligation's status.
// The rules are the same whether the store is the world's (conv/social.ts) or a Gate 1 harness's own.
import type { Fact, Id, World } from '../types';
import { DAY } from '../types';

export type ObType = 'action' | 'effort' | 'result' | 'restraint';
// an act done, as the obligation rules see it: who, what, to whom, about which matter, and (for good faith) what he expected of it
export interface Act { id?: string; t: number; actor: Id; act: string; target?: Id; about: string; predicted?: number; best?: boolean; fact?: Id; amt?: number }
export type Spec =
  | { kind: 'actionDone'; act: string; target?: Id; about: string; delegable?: boolean }
  | { kind: 'effort'; acts: string[]; about: string; floor: number }
  | { kind: 'noHostility'; actor: Id; target: Id; biz?: Id; days: number }
  | { kind: 'notDisclosedBy'; about: string }
  | { kind: 'demandWithdrawn'; sit: Id }
  | { kind: 'paid'; from: Id; to: Id; amount: number }                 // money handed over, by the date (core.transfer, through doors.pay)
  | { kind: 'knows'; who: Id; fact: Id }                               // he has come to know it
  | { kind: 'notKnows'; who: Id | 'anyone'; fact: Id; except?: Id[] }  // nobody (or he) learns it: a guarantee, so a result
  | { kind: 'all' | 'any'; of: Spec[] };                              // at most two levels (spec §3.3)
// what follows for someone else if this obligation is broken: "if this turns ugly, it's on you" (§6.4)
export interface Liability { who: Id; by: Id; feeling: 'trust' | 'respect'; amount: number; why: string; fell?: number }
export interface Obligation {
  id: string; type: ObType; obligor: Id; beneficiary: Id; promisee?: Id; agreement?: Id;
  spec: Spec; from: number; by: number;
  status: 'pending' | 'kept' | 'broken' | 'void' | 'released' | 'withdrawn'; settled?: number; why?: string;
  parent?: Id;                  // the obligation this one was taken on to serve (delegation: O2 serves O1, O3 serves O2)
  delegatedTo?: Id[];           // men who may do it for him, when the promise allows
  notify?: Id[];                // who learns how it ended
  liabilities?: Liability[];
  credit?: 'self' | 'delegate' | 'other' | 'none';
  order?: boolean;              // an order from a superior (§6.6): broken knowingly only by his own choice to violate it
  intends?: 'keep' | 'break';   // (the obligor's own, private: what he has decided to do about it)
  words?: string;               // what was said that made it, for the record
  matter?: { for?: Id; against?: Id; biz?: Id; fact?: Id }; // what it is about, for the man who must act on it
  conflicts?: Id[];             // his other obligations this one cannot be kept alongside (found when it was made)
}
export interface Store { obs: Obligation[]; log: Act[]; n: number }
export const newStore = (): Store => ({ obs: [], log: [], n: 0 });
export interface Settlement { ob: Obligation; to: 'kept' | 'broken' | 'void'; why: string }

export const HOSTILE = new Set(['vandalism', 'beating', 'threat', 'robbery', 'protection_refused', 'murder']);
// a man's people: himself and the men who answer to him
const menOf = (w: World, id: Id) => new Set([id, ...Object.values(w.chars).filter((c) => c.bossId === id).map((c) => c.id)]);
const nameOf = (w: World, id?: Id) => (id ? w.chars[id]?.name ?? id : 'someone');

// the first act by him (or a man he may delegate to) matching what he undertook, within the window
function doneBy(w: World, s: Store, ob: Obligation, acts: string[], about: string, target?: Id, goodFaith?: number): Act | undefined {
  const who = new Set([ob.obligor, ...(ob.delegatedTo ?? [])]);
  return s.log.find((x) => who.has(x.actor) && acts.includes(x.act) && x.about === about && (!target || x.target === target) && x.t >= ob.from && x.t <= ob.by && (goodFaith === undefined || (x.predicted ?? 0) >= goodFaith || !!x.best));
}
// hostility by his people against the man (or his place) inside the period
export function violation(w: World, sp: Extract<Spec, { kind: 'noHostility' }>, from: number, until: number): Fact | undefined {
  const men = menOf(w, sp.actor);
  return Object.values(w.facts).find((f) => HOSTILE.has(f.kind) && f.actor && men.has(f.actor) && (f.victim === sp.target || (!!sp.biz && f.business === sp.biz)) && f.t > from && f.t <= until);
}
// impossible, by nobody's doing he could be blamed for: the man it was for is dead, or the place it was about is gone
function impossible(w: World, ob: Obligation): string | undefined {
  const b = w.chars[ob.beneficiary];
  if (b && !b.alive) {
    const byHim = Object.values(w.facts).some((f) => f.kind === 'murder' && f.victim === b.id && menOf(w, ob.obligor).has(f.actor ?? ''));
    if (!byHim) return `${b.name} is dead, by no doing of ${nameOf(w, ob.obligor)}`;
  }
  const sp = ob.spec;
  if (sp.kind === 'noHostility' && sp.biz && w.biz[sp.biz] && !w.biz[sp.biz].open && ob.type === 'result') return `${w.biz[sp.biz].name} has closed`;
  return undefined;
}
// who brought a result about: his own acts, a man he set to it (an obligation serving his that was kept), someone else, or nobody
function creditOf(s: Store, ob: Obligation): Obligation['credit'] {
  const sp = ob.spec, about = 'about' in sp ? sp.about : undefined;
  const served = (id: Id): boolean => s.obs.some((x) => x.parent === id && (x.status === 'kept' || x.status === 'pending') && (x.type === 'restraint' || served(x.id)));
  if (served(ob.id)) return 'delegate';
  if (about && s.log.some((x) => x.actor === ob.obligor && x.about === about && x.t >= ob.from)) return 'self';
  return 'none';
}

// What one condition says now, for this obligation's window and type: kept, broken, void or still pending.
type State = { state: 'kept' | 'broken' | 'void' | 'pending'; why: string };
function evaluate(w: World, s: Store, ob: Obligation, sp: Spec, depth = 0): State {
  const closed = w.now > ob.by, imp = impossible(w, ob);
  const pending: State = { state: 'pending', why: '' };
  switch (sp.kind) {
    case 'actionDone': {
      const a = doneBy(w, s, ob, [sp.act], sp.about, sp.target);
      if (a) return { state: 'kept', why: `${a.actor === ob.obligor ? 'he' : nameOf(w, a.actor) + ', for him,'} did it: ${a.act}${a.target ? ' with ' + nameOf(w, a.target) : ''}` };
      if (imp) return { state: 'void', why: imp };
      return closed ? { state: 'broken', why: 'the time ran out and it was never done (whatever else happened)' } : pending;
    }
    case 'effort': {
      const a = doneBy(w, s, ob, sp.acts, sp.about, undefined, sp.floor), hollow = doneBy(w, s, ob, sp.acts, sp.about);
      if (a) return { state: 'kept', why: `a real attempt: ${a.act}${a.target ? ' with ' + nameOf(w, a.target) : ''}, which he expected might work (${a.predicted ?? 'his best route'}), whatever came of it` };
      if (imp) return { state: 'void', why: imp };
      return closed ? { state: 'broken', why: hollow ? 'only a gesture he had no reason to think would work' : 'no attempt was made' } : pending;
    }
    case 'noHostility': {
      const end = ob.from + sp.days * DAY, v = violation(w, sp, ob.from, Math.min(w.now, end));
      if (v) return { state: 'broken', why: `a violation inside the period: ${v.text}` };
      if (imp) return { state: 'void', why: imp };
      return w.now >= end ? { state: 'kept', why: `the whole ${sp.days} days passed cleanly` } : pending;
    }
    case 'notDisclosedBy': {
      const told = s.log.find((x) => x.actor === ob.obligor && x.act === 'inform' && x.about === sp.about && x.t >= ob.from && x.t <= ob.by);
      if (told) return { state: 'broken', why: `he told ${nameOf(w, told.target)}` };
      return closed ? { state: 'kept', why: 'the time passed and he never told anyone (what others found out for themselves is not his doing)' } : pending;
    }
    case 'demandWithdrawn': {
      const sit = (w.situations ?? []).find((x) => x.id === sp.sit);
      if (!sit || sit.stage === 'resolved') return { state: 'kept', why: `the demand is withdrawn${sit?.out ? ` (${sit.out})` : ''}` };
      return closed ? { state: 'broken', why: 'the demand still stands' } : pending;
    }
    case 'paid': {
      const got = s.log.filter((x) => x.act === 'pay' && x.actor === sp.from && x.target === sp.to && x.t >= ob.from && x.t <= ob.by).reduce((a, x) => a + (x.amt ?? 0), 0);
      if (got >= sp.amount) return { state: 'kept', why: `$${got} handed over` };
      return closed ? { state: 'broken', why: got ? `only $${got} of $${sp.amount}` : 'nothing was paid' } : pending;
    }
    case 'knows': {
      const k = w.chars[sp.who]?.known[sp.fact];
      if (k) return { state: 'kept', why: `${nameOf(w, sp.who)} knows it now` };
      return closed ? { state: 'broken', why: `${nameOf(w, sp.who)} never learnt it` } : pending;
    }
    case 'notKnows': {
      const ok = new Set([ob.obligor, ...(sp.except ?? [])]);
      const who = Object.values(w.chars).find((c) => !ok.has(c.id) && (sp.who === 'anyone' || c.id === sp.who) && (c.known[sp.fact]?.t ?? -1) > ob.from);
      if (who) return { state: 'broken', why: `${who.name} found out` };
      return closed ? { state: 'kept', why: 'nobody found out' } : pending;
    }
    case 'all': case 'any': {
      if (depth >= 2) return pending;
      const xs = sp.of.map((x) => evaluate(w, s, ob, x, depth + 1));
      const n = (st: State['state']) => xs.filter((x) => x.state === st);
      if (sp.kind === 'all') {
        if (n('broken').length) return n('broken')[0];
        if (n('void').length) return n('void')[0];
        return n('kept').length === xs.length ? { state: 'kept', why: xs.map((x) => x.why).join('; ') } : pending;
      }
      if (n('kept').length) return n('kept')[0];
      return n('broken').length + n('void').length === xs.length ? (n('broken')[0] ?? n('void')[0]) : pending;
    }
  }
}

// The check: settles what can be settled now, by the rules above. Returns what changed.
export function settle(w: World, s: Store): Settlement[] {
  const out: Settlement[] = [];
  for (const ob of s.obs) {
    if (ob.status !== 'pending') continue;
    const r = evaluate(w, s, ob, ob.spec);
    if (r.state === 'pending') continue;
    ob.status = r.state; ob.settled = w.now; ob.why = r.why;
    if (r.state === 'kept' && ob.type === 'result') ob.credit = creditOf(s, ob);
    out.push({ ob, to: r.state, why: r.why });
  }
  return out;
}

// Freed by the man it was promised to: no break, and no credit either.
export function release(w: World, ob: Obligation, why: string) { if (ob.status === 'pending') { ob.status = 'released'; ob.settled = w.now; ob.why = why; } }
// Taken back by the man who promised, before it fell due: a smaller thing than breaking it (the promisee judges it so: conv/minds.ts).
export function withdraw(w: World, ob: Obligation, why: string) { if (ob.status === 'pending') { ob.status = 'withdrawn'; ob.settled = w.now; ob.why = why; } }

// Obligations of one man that cannot both be kept (spec §6.4): bound to leave a man alone and bound to lean on him; bound to keep
// something quiet and bound to tell it. Found when the second is made; which gives way is his choice when the time comes.
const HARM_ACTS = new Set(['harm', 'demand', 'collect', 'force']);
export function conflicts(s: Store, ob: Obligation): Obligation[] {
  const leaveAlone = (x: Obligation) => (x.spec.kind === 'noHostility' && (x.type === 'restraint' || x.spec.actor === x.obligor) ? x.spec.target : undefined);
  const leanOn = (x: Obligation) => (x.spec.kind === 'actionDone' && HARM_ACTS.has(x.spec.act) ? x.spec.target : undefined);
  const quiet = (x: Obligation) => (x.spec.kind === 'notDisclosedBy' ? x.spec.about : undefined);
  const tell = (x: Obligation) => (x.spec.kind === 'actionDone' && x.spec.act === 'inform' ? x.spec.about : undefined);
  return s.obs.filter((x) => x.id !== ob.id && x.obligor === ob.obligor && x.status === 'pending' && (
    (!!leaveAlone(x) && leaveAlone(x) === leanOn(ob)) || (!!leanOn(x) && leanOn(x) === leaveAlone(ob)) ||
    (!!quiet(x) && quiet(x) === tell(ob)) || (!!tell(x) && tell(x) === quiet(ob))));
}

// Gate 1's harness store: the same rules, its own records.
export class Obligations {
  constructor(public store: Store = newStore()) {}
  get obs() { return this.store.obs; }
  get log() { return this.store.log; }
  make(o: Omit<Obligation, 'id' | 'status'>): Obligation { const x: Obligation = { ...o, id: 'ob' + ++this.store.n, status: 'pending' }; this.store.obs.push(x); return x; }
  did(a: Act) { this.store.log.push(a); }
  tick(w: World): { ob: Obligation; to: 'kept' | 'broken' | 'void'; why: string }[] { return settle(w, this.store); }
}
