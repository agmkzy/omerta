// Beliefs in the world (spec §5.2–5.3). What a man believes about something is computed from his own knowledge of it (facts he
// witnessed, was told of, or suffered, and what he has seen of people) and from the claims others have made to him, each weighed by
// his trust in the man who said it and by what the man said it rests on. The truth of a claim (`honest`) is the simulation's, kept for
// traces and tests; nothing here reads it. Two accounts he trusts that disagree leave him uncertain. When what he believes changes,
// that is a revision: recorded, and passed to whatever depends on it (his pursuits, his judgement of men who made him promises).
//
// What a man thinks of another for a promise follows what he BELIEVES happened (judge): kept, broken, never heard, lied to. A promise
// broken in fact and believed kept earns trust; the truth coming out later is a revision, and the trust goes, with more besides.
import { peek, rel } from '../core';
import { temper } from '../temper';
import type { Character, Id, World } from '../types';
import { DAY } from '../types';
import type { BasisKind } from './types';
import { social, sid } from './social';
import { HOSTILE, violation, type Obligation } from './obligations';
import { chairFor } from './authority';
import * as door from './doors';

export interface Said { id: Id; by: Id; to: Id; t: number; subject: string; value: string; basis: BasisKind; honest: boolean; words?: string }
export interface Belief { value?: string; conf: number; uncertain: boolean; sources: { by: Id | 'own'; value: string; weight: number }[] }
export interface Held { who: Id; subject: string; value?: string; conf: number; uncertain: boolean; t: number }
export interface Revision { id: Id; who: Id; subject: string; from?: string; to?: string; t: number; why: string }
export interface Judged { who: Id; ob: Id; verdict: string; credit?: string; applied: number; lied?: boolean }

const minds = (w: World) => { const s = social(w); s.said ??= []; s.held ??= []; s.revisions ??= []; s.judged ??= []; return s as Required<Pick<typeof s, 'said' | 'held' | 'revisions' | 'judged'>> & typeof s; };

// ---------------------------------------------------------------- what he has to go on himself
// Subjects: 'who:<fact>' (who did it), 'answersTo:<man>' (who he answers to), 'ob:<obligation>' (did it hold / was it done),
// 'credit:<obligation>' (who brought it about), 'did:<man>:<act>:<about>' (did he do what he says he did).
function own(w: World, c: Character, subject: string): { value: string; weight: number }[] {
  const [kind, a, b, d] = subject.split(':');
  if (kind === 'who') {
    const k = c.known[a], f = w.facts[a];
    if (!k || !f) return [];
    if (k.knowsActor && f.actor) return [{ value: f.actor, weight: 1 }];
    return k.blame ? [{ value: k.blame, weight: 0.3 }] : [];
  }
  if (kind === 'answersTo') {
    const man = w.chars[a];
    if (!man) return [];
    // a man in the life knows the shape of his own family; anyone who knows the man well enough knows who he runs with
    const inside = c.rank !== 'civilian' && c.familyId && c.familyId === man.familyId;
    const chair = chairFor(w, man);
    return chair && (inside || (peek(c, man.id).known ?? 0) >= 0.5 || (peek(c, chair.id).known ?? 0) >= 0.5) ? [{ value: chair.id, weight: 0.9 }] : [];
  }
  if (kind === 'ob') {
    const ob = social(w).obs.find((x) => x.id === a);
    if (!ob) return [];
    const sp = ob.spec;
    if (sp.kind === 'noHostility') {
      const v = violation(w, sp, ob.from, Math.min(w.now, ob.from + sp.days * DAY));
      if (v && c.known[v.id]) return [{ value: 'broken', weight: 1 }];
      // the man it was about would notice trouble at his own door; past the period with none he knows of, it held
      if ((c.id === sp.target || c.id === ob.beneficiary) && w.now >= ob.from + sp.days * DAY) return [{ value: 'kept', weight: 0.7 }];
      return [];
    }
    if (sp.kind === 'actionDone' && sp.target === c.id) {
      // he was the man it was to be done with: he knows whether it was
      const done = social(w).log.some((x) => x.actor === ob.obligor && x.act === sp.act && x.target === c.id && x.about === sp.about && x.t >= ob.from);
      return done ? [{ value: 'done', weight: 1 }] : w.now > ob.by ? [{ value: 'notDone', weight: 0.8 }] : [];
    }
    return [];
  }
  if (kind === 'did') {
    // did <a> do <b> about <d>: he knows if it was done to him
    const done = social(w).log.some((x) => x.actor === a && x.act === b && x.about === d && x.target === c.id);
    return done ? [{ value: 'yes', weight: 1 }] : [];
  }
  return [];
}
// How far he takes another man's word: trust, familiarity, his own caution, and what the man said it rests on (types.CLAIMABLE)
export function weigh(c: Character, by: Character, basis: BasisKind): number {
  const r = peek(c, by.id), t = temper(c);
  let x = 0.35 + r.trust * 0.5 + (r.known ?? 0) * 0.1 - t.caution * 0.1;
  if (basis === 'seen' || basis === 'own') x += 0.1; else if (basis === 'rumour' || basis === 'told') x -= 0.1;
  return Math.max(0.05, Math.min(1, x));
}
export function belief(w: World, c: Character, subject: string): Belief {
  const sources: Belief['sources'] = own(w, c, subject).map((x) => ({ by: 'own' as const, ...x }));
  // the latest thing each man told him about it is what that man says
  const latest = new Map<Id, Said>();
  for (const x of minds(w).said) if (x.to === c.id && x.subject === subject) latest.set(x.by, x);
  for (const x of latest.values()) { const by = w.chars[x.by]; if (by) sources.push({ by: x.by, value: x.value, weight: weigh(c, by, x.basis) * (sources.some((y) => y.by === 'own' && y.weight >= 0.9) ? 0.3 : 1) }); }
  if (!sources.length) return { conf: 0, uncertain: false, sources };
  const tally = new Map<string, number>();
  for (const x of sources) tally.set(x.value, (tally.get(x.value) ?? 0) + x.weight);
  const ranked = [...tally].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const [top, second] = ranked;
  const total = ranked.reduce((a, x) => a + x[1], 0);
  const conf = Math.round(Math.min(1, top[1]) * (top[1] / total) * 100) / 100;
  // two accounts he takes seriously that cannot both be true: he holds both, believes neither much
  const uncertain = !!second && second[1] >= 0.4 && second[1] >= top[1] * 0.6;
  return { value: top[0], conf: uncertain ? Math.round(conf * 0.6 * 100) / 100 : conf, uncertain, sources };
}

// ---------------------------------------------------------------- telling, and changing one's mind
type Listener = (w: World, r: Revision) => void;
export const onRevision: Listener[] = [];
// what he believes now, against what he believed last time it mattered: a change is a revision
export function refresh(w: World, c: Character, subject: string, why: string): Belief {
  const m = minds(w), b = belief(w, c, subject);
  const prev = m.held.find((h) => h.who === c.id && h.subject === subject);
  if (!prev) { m.held.push({ who: c.id, subject, value: b.value, conf: b.conf, uncertain: b.uncertain, t: w.now }); if (b.value) revise(w, c, subject, undefined, b.value, why); return b; }
  if (prev.value !== b.value) { const from = prev.value; Object.assign(prev, { value: b.value, conf: b.conf, uncertain: b.uncertain, t: w.now }); revise(w, c, subject, from, b.value, why); }
  else Object.assign(prev, { conf: b.conf, uncertain: b.uncertain });
  return b;
}
function revise(w: World, c: Character, subject: string, from: string | undefined, to: string | undefined, why: string) {
  const m = minds(w), r: Revision = { id: sid(m, 'v'), who: c.id, subject, from, to, t: w.now, why };
  m.revisions.push(r);
  if (m.revisions.length > 200) m.revisions.splice(0, m.revisions.length - 200);
  // a wrong blame is let go, with its reason; the right one is taken up (core.ease / core.bear through the doors)
  if (subject.startsWith('who:') && to && from !== to && w.chars[to]) {
    const f = w.facts[subject.slice(4)];
    if (f && (f.victim === c.id || (f.business && w.biz[f.business]?.ownerId === c.id))) {
      const g = from && w.chars[from] ? peek(c, from).grudge : 0;
      if (from && g > 0) door.grudge(w, c, from, -Math.min(g, 0.3), `it was not ${w.chars[from].name} after all`);
      door.grudge(w, c, to, 0.3, `${w.chars[to].name} did it, as he now believes`);
    }
  }
  for (const l of onRevision) l(w, r);
}
// A man tells another something: a claim, with what he says it rests on. The listener's belief is refreshed from it.
export function say(w: World, by: Character, to: Character, subject: string, value: string, basis: BasisKind, honest: boolean, words?: string): Said {
  const m = minds(w), x: Said = { id: sid(m, 'c'), by: by.id, to: to.id, t: w.now, subject, value, basis, honest, ...(words ? { words } : {}) };
  m.said.push(x);
  if (m.said.length > 240) m.said.splice(0, m.said.length - 240);
  refresh(w, to, subject, `${by.name} told him`);
  return x;
}

// ---------------------------------------------------------------- judging men by what he believes they did
// For each man an obligation was owed to, his verdict on it from his beliefs; regard moves by the difference from the verdict he had
// already acted on, so a later revision (he finds out) moves it again, and a promise he thought kept but finds was broken, with the
// obligor having told him otherwise, costs the liar more.
const WEIGHT = { kept: 0.08, broken: -0.15, unheard: -0.03, lied: -0.12, withdrawn: -0.05 };
export function judge(w: World, who: Character, ob: Obligation) {
  const m = minds(w), obligor = w.chars[ob.obligor];
  if (!obligor || who.id === ob.obligor) return;
  const b = refresh(w, who, 'ob:' + ob.id, 'what he knows of it');
  const closed = w.now > ob.by || ob.status !== 'pending';
  let verdict = b.value === 'kept' || b.value === 'done' ? 'kept' : b.value === 'broken' || (b.value === 'notDone' && closed) ? 'broken' : b.value === 'withdrawn' ? 'withdrawn' : b.value === 'released' ? 'released' : closed && b.value !== 'notYet' ? 'unheard' : 'open';
  if (verdict === 'released') return;
  if (b.uncertain) verdict = 'open'; // two accounts he can't choose between: he reserves judgement
  if (verdict === 'open') return;
  const credit = ob.type === 'result' && verdict === 'kept' ? belief(w, who, 'credit:' + ob.id).value ?? 'none' : undefined;
  // he was told it was done (by the obligor) and now believes it wasn't: lied to
  const lied = verdict === 'broken' && m.said.some((x) => x.by === ob.obligor && x.to === who.id && x.subject === 'ob:' + ob.id && (x.value === 'done' || x.value === 'kept'));
  const target = verdict === 'kept' ? WEIGHT.kept * ({ self: 1, delegate: 0.7, other: 0.3, none: 0.2 }[credit ?? 'self'] ?? 0.3) : verdict === 'broken' ? WEIGHT.broken + (lied ? WEIGHT.lied : 0) : verdict === 'withdrawn' ? WEIGHT.withdrawn : WEIGHT.unheard;
  let j = m.judged.find((x) => x.who === who.id && x.ob === ob.id);
  if (!j) { j = { who: who.id, ob: ob.id, verdict, applied: 0 }; m.judged.push(j); }
  const delta = Math.round((target - j.applied) * 1000) / 1000;
  if (Math.abs(delta) < 0.005) return;
  door.regard(w, who, ob.obligor, 'trust', delta, verdict === 'kept' ? `${obligor.name} kept his word` : lied ? `${obligor.name} lied to him about it` : verdict === 'broken' ? `${obligor.name} broke his word` : `${obligor.name} never said what came of it`);
  if (verdict === 'broken' && j.verdict !== 'broken') {
    door.regard(w, who, ob.obligor, 'respect', -0.06, `${obligor.name} broke his word`);
    // he says so, to the people around him: a claim, not the truth
    door.happened(w, { kind: 'rumour', actor: ob.obligor, victim: who.id, minor: true, text: `${who.name} says ${obligor.name} broke his word to him.` }, { witnesses: [who.id] });
    if (lied && obligor.isPlayer) (obligor.conduct ??= {} as NonNullable<Character['conduct']>).lies = (obligor.conduct?.lies ?? 0) + 1;
  }
  Object.assign(j, { verdict, credit, applied: Math.round(target * 1000) / 1000, lied });
  void rel; void HOSTILE;
}
