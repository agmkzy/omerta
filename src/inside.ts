// The player's time inside, as an account rather than a jump (the coherence repair, phase 5). However he was picked up (the weekly
// heat, a job gone wrong, a raid, a federal sweep), the spell is opened the moment he is inside, with what he went in with; when he walks
// out it is closed with what he came out to: how long, why as far as he could tell, what it cost, and what changed while he was away
// (his share, his backer, the shops and rackets that stopped being his, the work and the promises that lapsed, what was done to him).
// Read from the records; nothing is changed here except the account itself. World shows it once, the first time he looks.
import { DAY, type Character, type World } from './types';
import { addFact, money } from './core';
import { social } from './conv/social';

const CRIMES = new Set(['robbery', 'burglary', 'theft', 'beating', 'vandalism', 'hijack', 'scam', 'murder', 'threat']);
const first = (c?: Character) => (c ? c.name.split(' ')[0] : 'someone');

// Why he was picked up, as far as the player could tell: the arrest itself if it said, else the work the police could tie to him.
function whyOf(w: World, p: Character, heat = false): string {
  const arrest = Object.values(w.facts).filter((f) => (f.kind === 'arrest' || f.kind === 'raid') && (f.actor === p.id || f.text.includes(p.name)) && w.now - f.t <= DAY).sort((a, b) => b.t - a.t)[0];
  if (arrest?.kind === 'raid') return arrest.text.includes('Federal') ? 'You were picked up in the federal sweep, with the others.' : `The police raided ${arrest.text.match(/raided the ([^.]+?) in/)?.[1] ?? 'the place'} and took you with it.`;
  const done = Object.values(w.facts).filter((f) => f.actor === p.id && CRIMES.has(f.kind) && w.now - f.t < 28 * DAY).sort((a, b) => b.t - a.t);
  if (arrest && /same sweep/.test(arrest.text)) return 'You were picked up in the same sweep as the others.';
  if (done.length) {
    const last = done[0], at = last.business ? w.biz[last.business]?.name : undefined;
    return `The police had been watching you. ${done.length > 1 ? `${done.length} jobs in a month` : 'One job too many'}, the last ${at ? `at ${at}` : 'of them a week or two back'}, and they had enough to hold you.`;
  }
  return heat || p.heat > 0.3 ? 'The police had been watching you a while, and they picked you up on the heat alone.' : 'They picked you up. Nobody told you on what.';
}

/** Where the arrest itself knows why (the weekly heat, a job gone wrong), it says so as it happens; otherwise the tick works it out. */
export function pickedUp(w: World, c: Character, why: string) {
  if (!c.isPlayer || c.jailedUntil <= w.now) return;
  open(w, c, why);
}
function open(w: World, p: Character, why: string) {
  p.inside = { from: w.now, until: p.jailedUntil, why, cash: p.cash, standing: p.standing, kickRate: p.kickRate, ...(p.backer ? { backer: p.backer } : {}), collects: Object.values(w.biz).filter((b) => b.protection?.collectorId === p.id).map((b) => b.id), ops: w.ops.filter((o) => o.owner === p.id && o.state !== 'closed' && o.state !== 'done').map((o) => o.id) };
}
// why the weekly heat put him away: the work the police could tie to him, as he knows it
export function heatWhy(w: World, p: Character): string { return whyOf(w, p, true); }

/** Opens the spell when he is picked up, keeps it to the date he will be out, and closes it with its account when he walks out. */
export function insideTick(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (!p?.alive) return;
  const sp = p.inside;
  if (p.jailedUntil > w.now) {
    if (!sp || sp.done) open(w, p, whyOf(w, p));
    else if (sp.until !== p.jailedUntil) sp.until = p.jailedUntil;
    return;
  }
  if (sp && !sp.done) close(w, p, sp);
}
function close(w: World, p: Character, sp: NonNullable<Character['inside']>) {
  const days = Math.max(1, Math.round((w.now - sp.from) / DAY)), out: string[] = [];
  out.push(`${days === 1 ? 'A night' : days < 14 ? `${days} days` : `${Math.round(days / 7)} weeks`} inside. ${sp.why}`);
  const dc = Math.round(p.cash - sp.cash);
  if (dc < -20) out.push(`You went in with ${money(sp.cash)} and came out with ${money(p.cash)}: lawyers, and the life going on without you.`);
  if (p.kickRate > sp.kickRate + 0.001) out.push(`Your share went up while you were away, to ${Math.round(p.kickRate * 100)} percent.`);
  if (sp.backer && p.backer !== sp.backer) out.push(`${w.chars[sp.backer]?.name ?? 'Your backer'} no longer speaks for you.`);
  for (const id of sp.collects) { const b = w.biz[id], col = b?.protection ? w.chars[b.protection.collectorId] : undefined; if (b && b.protection?.collectorId !== p.id) out.push(col ? `${b.name} pays ${col.name} now, not you.` : `${b?.name ?? 'A shop'} stopped paying you.`); }
  for (const id of sp.ops) { const o = w.ops.find((x) => x.id === id); if (!o || o.owner !== p.id || o.state === 'closed') out.push('One of your rackets did not wait for you.'); }
  for (const j of w.jobs.filter((x) => x.assignee === p.id && (x.status === 'expired' || x.status === 'declined' || x.status === 'failed') && x.created < w.now && x.created >= sp.from - 7 * DAY && x.kind !== 'summons')) out.push(`The work for ${first(w.chars[j.giver ?? ''])}, ${j.title.charAt(0).toLowerCase() + j.title.slice(1)}, went to somebody else.`);
  for (const o of social(w).obs.filter((x) => x.obligor === p.id && x.status === 'broken' && (x.settled ?? 0) >= sp.from)) out.push(`You could not keep your word to ${w.chars[o.beneficiary]?.name ?? 'a man'}. He knows why, and it counts against you all the same.`);
  for (const f of Object.values(w.facts).filter((f) => f.victim === p.id && f.t >= sp.from && ['discipline', 'ruling', 'poach', 'vandalism', 'robbery'].includes(f.kind)).sort((a, b) => a.t - b.t).slice(0, 3)) out.push(f.text.replace(new RegExp(p.name, 'g'), 'you').replace(/^you/, 'You'));
  const missed = w.debts.filter((d) => d.debtor === p.id && d.status === 'active' && d.missed > 0);
  if (missed.length) out.push(`You missed what you owed ${missed.map((d) => first(w.chars[d.creditor])).join(' and ')}. ${missed.length > 1 ? 'They' : 'He'} will have noticed.`);
  if (out.length === 1) out.push('Nothing much changed while you were away. Nothing much waited for you, either.');
  sp.done = true; sp.account = out;
  addFact(w, { kind: 'report', actor: p.id, victim: p.id, minor: false, text: `${p.name} is out after ${days} days inside. ${sp.why}`, district: p.district }, { witnesses: [p.id] });
}
