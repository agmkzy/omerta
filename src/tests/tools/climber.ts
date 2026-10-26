// An ambitious player, played through the real conversation and job screens' code (no state edited by hand): each day he goes to
// his captain (envelope on Sunday, work when there is any, reports what he finished), puts protection to the shops he could lean on,
// and spends an evening with a made man of his family. Prints, week by week, where the road to being made stands and what is holding
// it up, so the pace of the climb can be judged from what a committed player could actually do.
// Usage: npx tsx src/tests/tools/climber.ts [seed] [days]
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { begin, choose, everything } from '../../conv/visit';
import { approaches, resolve, takeJob } from '../../jobs';
import { pathInfo } from '../../path';
import { leanable } from '../../conv/authority';
import { DAY, type Character } from '../../types';
import { choose as encChoose } from '../../encounters';
import { openInduction, current, choose as mChoose, closeMeeting } from '../../meetings';

const seed = Number(process.argv[2] ?? 3), days = Number(process.argv[3] ?? 120);
const w = createWorld(seed, 'Tony Marino'), p = w.chars[w.playerId!];
const say = (id: string, re: RegExp) => { const v = begin(w, id); (p.intro ??= {})[id] ??= w.now; for (let i = 0; i < 4 && !v.ended; i++) { const c = [...v.choices, ...everything(w, v)].find((x) => re.test(x.id) || re.test(x.label)); if (!c) break; choose(w, v, c.amount ? `${c.id}:${c.amount.value}` : c.id); } return v; };
const log: string[] = [];
// (DBG3: everything that reached the player each week, as he would see it: approaches, offers, and what he came to know)
const seenE = new Set<string>(), seenJ = new Set<string>(), seenF = new Set<string>();
const reached = () => { const out: string[] = [];
  for (const e of w.enc) if (!seenE.has(e.id)) { seenE.add(e.id); out.push('  approach: ' + e.title); }
  for (const j of w.jobs) if (j.assignee === p.id && !seenJ.has(j.id)) { seenJ.add(j.id); out.push(`  offer: ${j.title} (${w.chars[j.giver ?? '']?.name ?? 'tip'})`); }
  for (const [id, k] of Object.entries(p.known)) if (!seenF.has(id)) { seenF.add(id); const f = w.facts[id]; if (f && !f.minor && k.from !== 'self') out.push('  heard: ' + f.text.slice(0, 110)); }
  return out; };
let lastWeek = -1, made = -1;
for (let d = 0; d < days && p.alive; d++) {
  const day0 = d * DAY;
  if (w.now < day0 + 9 * 60) advance(w, day0 + 9 * 60);
  if (p.jailedUntil > w.now) continue;
  const cap = p.bossId ? w.chars[p.bossId] : undefined;
  if (cap?.alive) {
    say(cap.id, /b_envelope|a:report|b_need/);
    for (const j of w.jobs.filter((q) => q.status === 'offered' && q.giver === cap.id && q.assignee === p.id && q.kind !== 'summons')) takeJob(w, j);
  }
  // his own work, done his own way: the first approach on each job in hand
  for (const j of w.jobs.filter((q) => q.status === 'active' && q.assignee === p.id && q.kind !== 'summons')) { const a = approaches(w, j)[1] ?? approaches(w, j)[0]; if (a) resolve(w, j, a.code); }
  // take up a tip or an opportunity on offer, now and then
  for (const j of w.jobs.filter((q) => q.status === 'offered' && q.assignee === p.id && q.kind !== 'summons' && q.giver !== cap?.id).slice(0, 2)) { takeJob(w, j); const a = approaches(w, j)[0]; if (a) resolve(w, j, a.code); }
  // what is put to him: the trial, an invitation, the family's requests (the first answer that isn't refusing); the induction, attended
  for (const e of w.enc.filter((x) => x.status === 'open' && x.opts.length)) { const o = e.opts.find((x) => !/no|regrets|not/i.test(x.code + x.label)) ?? e.opts[0]; encChoose(w, p, e, o.code); }
  for (const j of w.jobs.filter((q) => q.kind === 'summons' && q.meeting === 'induction' && q.status === 'offered')) { const at = Number(j.extra?.at ?? 0); if (at > w.now) advance(w, at); const m = openInduction(w, p, j); if (typeof m !== 'string') { for (let i = 0; i < 20 && current(m); i++) mChoose(w, p, m, current(m)!.opts[0].code); closeMeeting(w, p, m); } }
  // protection
  for (const b of leanable(w, p).slice(0, 1)) say(b.ownerId, /^protect$|protect:take/);
  // an evening with a made man of his family
  // (an ambitious man cultivates a few made men, the ones who already think something of him, not the whole family)
  const made0 = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && ['soldier', 'capo'].includes(c.rank) && c.id !== p.bossId && c.jailedUntil <= w.now).sort((a, b) => (b.rels[p.id]?.trust ?? 0) - (a.rels[p.id]?.trust ?? 0) || (a.id < b.id ? -1 : 1)).slice(0, 3);
  const m = made0[d % Math.max(1, made0.length)];
  if (m && d % 2 === 0) { say(m.id, /^a:work$/); for (const j of w.jobs.filter((q) => q.status === 'offered' && q.giver === m.id && q.assignee === p.id)) takeJob(w, j); advance(w, day0 + 19 * 60); say(m.id, /^spend$/); }
  const wk = Math.floor(d / 7);
  if (wk !== lastWeek) {
    lastWeek = wk;
    const pi = pathInfo(w, p);
    if (process.env.DBG2) log.push('   made men trust: ' + Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && ['soldier','capo','underboss'].includes(c.rank)).map((c) => `${c.name.split(' ')[1]} ${(c.rels[p.id]?.trust ?? 0).toFixed(2)}`).join(', ') + ' | peer jobs ' + w.jobs.filter((j) => j.assignee === p.id && j.via === 'tip' && w.chars[j.giver ?? '']?.familyId === p.familyId).map((j) => j.status).join(','));
    if (process.env.DBG) log.push(`   hold=${w.path?.hold} wait=${w.path?.seatWait} promo=${JSON.stringify(w.promo ?? null)?.slice(0,160)} induct=${p.cooldown.induct} summons=${w.jobs.filter((j) => j.kind === 'summons').map((j) => j.meeting + ':' + j.status).join(',')} encs=${w.enc.filter((e) => e.status === 'open').map((e) => e.kind + ':' + (e.data?.stage ?? '')).join(',')}`);
    if (process.env.DBG3) log.push(...reached());
    log.push(`week ${wk}: ${p.rank} $${Math.round(p.cash)} standing ${Math.round(p.standing)} | ${pi ? pi.goals.map((g) => `${g.key} ${Math.round(g.frac * 100)}%`).join(', ') : 'top'} | shops ${Object.values(w.biz).filter((b) => b.protection?.collectorId === p.id).length} | done ${p.career?.done ?? 0}`);
  }
  if (p.rank !== 'associate' && made < 0) { made = d; log.push(`MADE on day ${d}`); }
  advance(w, day0 + DAY);
}
console.log(log.join('\n'));
void ({} as Character);
