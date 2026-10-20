// One world, one truth. Things that reference other things are checked against them when the day turns, and repaired where they have drifted.
// audit() is also what the tests use to prove nothing contradicts anything else.
import { economyIssues } from './econ';
import { agencyIssues } from './goals';
import { sitIssues } from './situ';
import { isResolved } from './core';
import { DAY, World } from './types';
import { hierarchyIssues } from './rank';
import { orgIssues } from './orgs';

export function audit(w: World): string[] {
  const bad: string[] = [];
  const act = new Map<string, number>();
  for (const j of w.jobs) {
    if (j.status === 'active' && j.kind !== 'summons') act.set(j.assignee, (act.get(j.assignee) ?? 0) + 1);
    if ((j.status === 'offered' || j.status === 'active') && j.debt) { const d = w.debts.find((q) => q.id === j.debt); if (!d || d.status !== 'active') bad.push(`job ${j.id} (${j.title}) still open on a settled debt`); }
    if (j.status === 'active' && !w.chars[j.assignee]?.alive) bad.push(`job ${j.id} assigned to a dead man`);
  }
  for (const [id, n] of act) if (n > 1 && id !== w.playerId) bad.push(`${w.chars[id]?.name} has ${n} active jobs`);
  const seen = new Set<string>();
  for (const j of w.jobs) if (j.status === 'active' && j.kind !== 'summons' && j.kind !== 'boost' && j.kind !== 'watch') { const k = `${j.kind}|${j.target}|${j.biz}`; if (seen.has(k)) bad.push(`duplicate active job ${k}`); seen.add(k); }
  for (const d of w.debts) {
    if (d.status === 'active' && d.balance <= 0) bad.push(`debt ${d.id} has no balance but is still active`);
    if (d.status === 'paid' && d.balance > 0) bad.push(`debt ${d.id} is paid with a balance`);
  }
  for (const g of w.grievances) if (g.status === 'open' && (!w.chars[g.from]?.alive || !w.chars[g.about]?.alive)) bad.push(`grievance ${g.id} between dead men`);
  for (const c of Object.values(w.chars)) {
    if (!c.alive) continue;
    if (c.bossId && !w.chars[c.bossId]?.alive) bad.push(`${c.name} answers to a dead man`);
    if (c.jailedUntil > w.now && w.jobs.some((j) => j.status === 'active' && j.assignee === c.id && j.due !== undefined && j.due < w.now - 5 * DAY)) bad.push(`${c.name} is jailed with a job long overdue`);
  }
  bad.push(...hierarchyIssues(w));
  bad.push(...orgIssues(w));
  bad.push(...economyIssues(w));
  bad.push(...agencyIssues(w));
  bad.push(...sitIssues(w));
  for (const d of w.disputes ?? []) if ((d.status === 'open' || d.status === 'violated') && (!w.chars[d.a]?.alive || !w.chars[d.b]?.alive)) bad.push(`dispute ${d.id} between dead men`);
  return bad;
}

// Daily repairs. Each one fixes the cause, not the message.
export function reconcile(w: World) {
  for (const g of w.grievances) {
    if (g.status !== 'open') continue;
    const gone = !w.chars[g.from]?.alive || !w.chars[g.about]?.alive;
    const cause = g.cause ? w.facts[g.cause] : undefined;
    const paid = g.kind === 'money' && !w.debts.some((d) => d.status === 'active' && d.creditor === g.from && d.debtor === g.about);
    if (gone || paid || (cause && isResolved(w, cause))) g.status = 'dropped';
  }
  for (const c of Object.values(w.chars)) for (const m of c.memos) {
    if (m.done || !m.ref) continue;
    const f = w.facts[m.ref];
    if (f && isResolved(w, f)) m.done = true;
  }
  // two men on the same piece of work: the first keeps it
  const keep = new Map<string, string>();
  for (const j of w.jobs) {
    if (j.status !== 'active' || j.kind === 'summons' || j.kind === 'boost' || j.kind === 'watch') continue;
    const k = `${j.kind}|${j.target}|${j.biz}`;
    if (keep.has(k)) { j.status = 'expired'; j.notes = [...(j.notes ?? []), 'Somebody else was already on it.']; } else keep.set(k, j.id);
  }
  // a man with several jobs does the earliest and the rest are handed back
  const first = new Map<string, string>();
  for (const j of w.jobs) {
    if (j.status !== 'active' || j.kind === 'summons' || j.assignee === w.playerId) continue;
    if (first.has(j.assignee)) { j.status = 'expired'; j.notes = [...(j.notes ?? []), 'He was already busy, so it was dropped.']; } else first.set(j.assignee, j.id);
  }
}
