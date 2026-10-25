// What the player has taken on, and what he is owed, read from the records that own each kind (the coherence repair, phase 2). Nothing
// here is stored: each commitment lives where its own rules are kept, and this is the one place every screen reads them from.
//   work       jobs.ts (w.jobs): offered → accepted → done → reported; the job is the same record wherever it was taken
//   promises   the conversation layer's obligations (World.social.obs): his word, and other men's to him, with their deadlines and
//              how they ended; and the older engine's promise memos (Character.memos), which an old save still carries
//   favours    w.favours (encounters.addFavour): who owes whom; a favour memo from an older save is read as the favour it stood for
//   terms      agreements and warnings (memos of kind agreement and threat)
//   money      w.debts (core.createDebt), what is owed and on what terms
import { social } from './conv/social';
import type { Obligation } from './conv/obligations';
import { DAY, type Character, type Id, type World } from './types';

export type CommitKind = 'work' | 'mine' | 'theirs' | 'owed' | 'owing' | 'terms' | 'threat' | 'debt';
export interface Commitment {
  kind: CommitKind;            // work he took on; his word to a man; a man's word to him; a favour owed him; one he owes; terms; hard words; money
  with: Id;                    // the other man
  text: string;                // what it is, in plain words, as the player would put it
  due?: number;                // when it falls due, if it does
  since: number;
  late?: boolean;              // past its time and not done
  src: 'job' | 'obligation' | 'memo' | 'favour' | 'debt';
  ref: Id;
}

const nm = (w: World, id?: Id) => (id && w.chars[id] ? w.chars[id].name : 'someone');
const fn = (w: World, id?: Id) => nm(w, id).split(' ')[0];

/** A promise in the conversation layer's records, said plainly: what was undertaken, by whom, about whom. */
export function promiseWords(w: World, o: Obligation, p: Character): string {
  const mine = o.obligor === p.id, by = mine ? 'You' : fn(w, o.obligor);
  const forC = o.matter?.for, ag = o.matter?.against, sp = o.spec as { kind: string; target?: Id; amount?: number; to?: Id };
  const about = ag ? ` about ${fn(w, ag)}${forC && forC !== (mine ? o.beneficiary : p.id) ? ` and ${fn(w, forC)}` : ''}` : '';
  if (o.type === 'action' && sp.kind === 'actionDone') return mine ? `Speak to ${nm(w, sp.target)}${about}.` : `${by} said he would speak to ${nm(w, sp.target)}${about}.`;
  if (o.type === 'effort') return mine ? `Do what you can${ag ? ` about ${fn(w, ag)}` : ''}${forC ? ` for ${fn(w, forC)}` : ''}.` : `${by} said he would do what he could${about}.`;
  if (o.type === 'result') return mine ? `See that ${fn(w, ag)} leaves ${forC === o.beneficiary ? 'him' : fn(w, forC)} alone.` : `${by} said he would see that ${fn(w, ag)} leaves ${forC === p.id ? 'you' : fn(w, forC)} alone.`;
  if (o.type === 'restraint') return mine ? `Keep away from ${nm(w, sp.target)}.` : `${by} said he would keep away from ${sp.target === p.id ? 'you' : nm(w, sp.target)}.`;
  if (sp.kind === 'paid') return mine ? `Pay ${nm(w, sp.to)} $${sp.amount}.` : `${by} said he would pay you $${sp.amount}.`;
  return mine ? 'What you said you would do.' : `What ${by} said he would do.`;
}

/** Everything open between the player and other men, each read from its own record. */
export function commitmentsOf(w: World, p: Character): Commitment[] {
  const out: Commitment[] = [];
  const live = (id?: Id) => !!id && !!w.chars[id]?.alive;
  // work he has taken on (from anyone) and not finished
  for (const j of w.jobs) if (j.status === 'active' && j.assignee === p.id && j.kind !== 'summons' && j.giver && j.giver !== p.id && live(j.giver))
    out.push({ kind: 'work', with: j.giver, text: j.title, since: j.accepted ?? j.created, src: 'job', ref: j.id });
  // his word, and other men's to him, as the conversation layer holds them (pending, and those it has judged not yet settled)
  for (const o of social(w).obs) {
    if (o.status !== 'pending') continue;
    if (o.obligor === p.id && live(o.beneficiary) && o.beneficiary !== p.id) out.push({ kind: 'mine', with: o.beneficiary, text: promiseWords(w, o, p), due: o.by, since: o.from, late: w.now > o.by, src: 'obligation', ref: o.id });
    else if ((o.beneficiary === p.id || o.promisee === p.id) && o.obligor !== p.id && live(o.obligor) && !o.order) out.push({ kind: 'theirs', with: o.obligor, text: promiseWords(w, o, p), due: o.by, since: o.from, late: w.now > o.by, src: 'obligation', ref: o.id });
  }
  // the older engine's memos: kept by either man about the other
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.id === p.id) continue;
    for (const m of c.memos) {
      if (m.other !== p.id || m.done || m.kind === 'question') continue;
      const kind: CommitKind = m.kind === 'promise' ? 'mine' : m.kind === 'threat' ? 'threat' : m.kind === 'favour' ? 'owing' : 'terms';
      // (a favour memo is from before favours were one record: read as the favour it stood for, unless that favour is on record)
      if (m.kind === 'favour' && w.favours.some((f) => !f.settled && f.from === c.id && f.to === p.id)) continue;
      out.push({ kind, with: c.id, text: m.text, due: m.due, since: m.t, late: !!m.due && m.due <= w.now, src: 'memo', ref: m.id });
    }
  }
  for (const m of p.memos) if (!m.done && live(m.other) && m.kind !== 'question' && m.kind !== 'favour')
    out.push({ kind: m.kind === 'promise' ? 'theirs' : m.kind === 'threat' ? 'threat' : 'terms', with: m.other, text: m.text, due: m.due, since: m.t, late: !!m.due && m.due <= w.now, src: 'memo', ref: m.id });
  // favours either way
  for (const f of w.favours) {
    if (f.settled) continue;
    if (f.from === p.id && live(f.to)) out.push({ kind: 'owed', with: f.to, text: f.what, since: f.t, src: 'favour', ref: f.id });
    else if (f.to === p.id && live(f.from)) out.push({ kind: 'owing', with: f.from, text: f.what, since: f.t, src: 'favour', ref: f.id });
  }
  // money
  for (const d of w.debts) {
    if (d.status !== 'active') continue;
    if (d.creditor === p.id && live(d.debtor)) out.push({ kind: 'debt', with: d.debtor, text: `Owes you $${Math.round(d.balance)}, $${Math.round(d.weeklyPayment)} a week`, due: d.nextDue, since: w.now, late: d.missed > 0, src: 'debt', ref: d.id });
    else if (d.debtor === p.id && live(d.creditor)) out.push({ kind: 'debt', with: d.creditor, text: `You owe $${Math.round(d.balance)}, $${Math.round(d.weeklyPayment)} a week`, due: d.nextDue, since: w.now, late: d.missed > 0, src: 'debt', ref: d.id });
  }
  return out.sort((a, b) => (a.due ?? 1e12) - (b.due ?? 1e12) || b.since - a.since);
}

/** His own word falling due within `days` (or late by up to a week): what World puts in front of him. */
export const fallingDue = (w: World, p: Character, days = 3) => commitmentsOf(w, p).filter((c) => c.kind === 'mine' && !!c.due && c.due <= w.now + days * DAY && c.due >= w.now - 7 * DAY);
