// Obligations (spec §6.3–6.5), minimal for Gate 1: the four kinds, judged on what they actually undertook and on the time rules.
//   action     kept when the act is done in the window (however things turn out); broken when the window closes without it
//   effort     kept by a good-faith attempt: one he had reason, when he made it, to think might work, even if it failed
//   result     over a period: kept only when the whole period has passed cleanly; broken at the first violation
//   restraint  kept when the window closes without the obligor doing the forbidden act; what others find out by themselves is not his
// Checked against the world's records (facts) and the record of acts done (the log). Fulfilment and credit are separate: who got
// the credit, as the beneficiary sees it, is his belief, not the obligation's status.
import type { Id, World } from '../types';
import { DAY } from '../types';

export type ObType = 'action' | 'effort' | 'result' | 'restraint';
export interface Act { t: number; actor: Id; act: string; target?: Id; about: string; predicted?: number; best?: boolean }
export type Spec =
  | { kind: 'actionDone'; act: string; target?: Id; about: string }
  | { kind: 'effort'; acts: string[]; about: string; floor: number }
  | { kind: 'noHostility'; actor: Id; target: Id; biz?: Id; days: number }
  | { kind: 'notDisclosedBy'; about: string };
export interface Obligation { id: string; type: ObType; obligor: Id; beneficiary: Id; spec: Spec; from: number; by: number; status: 'pending' | 'kept' | 'broken' | 'void'; settled?: number; why?: string }

const HOSTILE = new Set(['vandalism', 'beating', 'threat', 'robbery', 'protection_refused']);
export class Obligations {
  obs: Obligation[] = []; log: Act[] = []; private n = 0;
  make(o: Omit<Obligation, 'id' | 'status'>): Obligation { const x: Obligation = { ...o, id: 'ob' + ++this.n, status: 'pending' }; this.obs.push(x); return x; }
  did(a: Act) { this.log.push(a); }
  // the daily check (and after anything is done): settles what can be settled, by the rules above
  tick(w: World): { ob: Obligation; to: 'kept' | 'broken'; why: string }[] {
    const out: { ob: Obligation; to: 'kept' | 'broken'; why: string }[] = [];
    const settle = (ob: Obligation, to: 'kept' | 'broken', why: string) => { ob.status = to; ob.settled = w.now; ob.why = why; out.push({ ob, to, why }); };
    for (const ob of this.obs) {
      if (ob.status !== 'pending') continue;
      const s = ob.spec, inWin = (t: number) => t >= ob.from && t <= ob.by;
      if (s.kind === 'actionDone') {
        const a = this.log.find((x) => x.actor === ob.obligor && x.act === s.act && x.about === s.about && (!s.target || x.target === s.target) && inWin(x.t));
        if (a) settle(ob, 'kept', `he did it: ${a.act}${a.target ? ' with ' + (w.chars[a.target]?.name ?? a.target) : ''}`);
        else if (w.now > ob.by) settle(ob, 'broken', 'the time ran out and it was never done (whatever else happened)');
      } else if (s.kind === 'effort') {
        const a = this.log.find((x) => x.actor === ob.obligor && s.acts.includes(x.act) && x.about === s.about && inWin(x.t) && ((x.predicted ?? 0) >= s.floor || x.best));
        const hollow = this.log.find((x) => x.actor === ob.obligor && s.acts.includes(x.act) && x.about === s.about && inWin(x.t) && (x.predicted ?? 0) < s.floor && !x.best);
        if (a) settle(ob, 'kept', `a real attempt: ${a.act}${a.target ? ' with ' + (w.chars[a.target]?.name ?? a.target) : ''}, which he expected might work (${a.predicted}), whatever came of it`);
        else if (w.now > ob.by) settle(ob, 'broken', hollow ? 'only a gesture he had no reason to think would work' : 'no attempt was made');
      } else if (s.kind === 'noHostility') {
        const men = new Set([s.actor, ...Object.values(w.chars).filter((c) => c.bossId === s.actor).map((c) => c.id)]);
        const v = Object.values(w.facts).find((f) => HOSTILE.has(f.kind) && f.actor && men.has(f.actor) && (f.victim === s.target || (!!s.biz && f.business === s.biz)) && f.t > ob.from && f.t <= Math.min(w.now, ob.from + s.days * DAY));
        if (v) settle(ob, 'broken', `a violation inside the period: ${v.text}`);
        else if (w.now >= ob.from + s.days * DAY) settle(ob, 'kept', `the whole ${s.days} days passed cleanly`);
      } else if (s.kind === 'notDisclosedBy') {
        const told = this.log.find((x) => x.actor === ob.obligor && x.act === 'inform' && x.about === s.about && inWin(x.t));
        if (told) settle(ob, 'broken', `he told ${told.target ? w.chars[told.target]?.name ?? told.target : 'someone'}`);
        else if (w.now > ob.by) settle(ob, 'kept', 'the time passed and he never told anyone (what others found out for themselves is not his doing)');
      }
    }
    return out;
  }
}
