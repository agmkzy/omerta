// Unassisted play-test harness. Seed 3, "Tony Marino". The only things that change the world are the ones a player can do:
// wait, talk (say), answer a request (enc), take or decline an offered job. Nothing here edits trust, cash, relationships or goals.
// State between commands lives in playtest/state.json; every command is appended to playtest/actions.log so the run can be replayed.
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { advance, deserialize, serialize } from '../src/engine';
import { createWorld } from '../src/world';
import { arrive, options, say, startConvo, introduced, Convo } from '../src/dialogue';
import { generate, perform } from '../src/actions';
import { choose as encChoose } from '../src/encounters';
import { takeJob, declineJob, staleReason, approaches, resolve } from '../src/jobs';
import { whereIs } from '../src/where';
import { money, shortTime } from '../src/core';
import { arch } from '../src/voice';
import { World } from '../src/types';
import { statement } from '../src/ledger';
import { crewOf } from '../src/crewlife';
import { clamp, rel as relOf } from '../src/core';
import { prospects, recruitProspect } from '../src/orders';
import { choose as mChoose, current as mCurrent, closeMeeting, openFamilyMeeting, openAccountsMeeting, openInduction, openSitdown, openCrewMeeting, Meeting } from '../src/meetings';

const DIR = '/home/claude/omerta/playtest';
const SF = DIR + '/state.json', LOG = DIR + '/actions.log';
const SEED = 3;
let w: World; let convo: Convo | null = null; let lastWait = 0; let meet: Meeting | null = null;
function load() {
  if (!existsSync(SF)) { w = createWorld(SEED, 'Tony Marino'); convo = null; save(); appendFileSync(LOG, `# seed ${SEED} name "Tony Marino" start day 0\n`); return; }
  const o = JSON.parse(readFileSync(SF, 'utf8')); w = deserialize(o.world); convo = o.convo; lastWait = o.lastWait ?? 0; meet = o.meet ?? null;
}
function save() { writeFileSync(SF, JSON.stringify({ world: serialize(w), convo, lastWait, meet })); }
const P = () => w.chars[w.playerId!];
const day = () => Math.floor(w.now / 1440);
const hhmm = () => { const m = w.now % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const stamp = () => `Day ${day()} ${hhmm()}`;
const find = (nm: string) => Object.values(w.chars).find((c) => c.alive && c.name.toLowerCase().includes(nm.toLowerCase()));
const attn = () => w.enc.filter((e) => e.status === 'open').length + w.jobs.filter((j) => j.status === 'offered' && !staleReason(w, j)).length;

function status() {
  const p = P();
  console.log(`\n=== ${stamp()} | ${p.name}, ${p.rank} of ${p.familyId ? w.fam[p.familyId].name : '-'} | cash ${money(p.cash)} | standing ${Math.round(p.standing)} | heat ${p.heat.toFixed(2)} | backer ${p.backer ? w.chars[p.backer].name : 'none'} | boss ${p.bossId ? w.chars[p.bossId].name : '-'}`);
  for (const e of w.enc.filter((x) => x.status === 'open')) console.log(`  [REQUEST ${e.id}] ${e.title} (${e.kind}) from ${e.from ? w.chars[e.from]?.name : '-'}, ${Math.max(0, Math.round((e.expires - w.now) / 1440))}d left :: ${e.opts.map((o) => `${o.code}="${o.label}"`).join(' | ')}`);
  for (const j of w.jobs.filter((x) => x.status === 'offered' && !staleReason(w, x))) console.log(`  [JOB ${j.id}] ${j.title} (${j.kind}, via ${j.via}) pay ${j.pay ?? '?'} giver ${j.giver ? w.chars[j.giver]?.name : '-'}`);
  for (const j of w.jobs.filter((x) => x.status === 'active' && x.assignee === p.id)) console.log(`  [ACTIVE ${j.id}] ${j.title}`);
  for (const d of w.debts.filter((x) => x.status === 'active' && (x.creditor === p.id || x.debtor === p.id))) console.log(`  [DEBT] ${w.chars[d.creditor].name} -> ${w.chars[d.debtor].name} ${money(d.balance)} @${d.weeklyRate} weekly ${money(d.weeklyPayment)} missed ${d.missed} due day ${Math.floor(d.nextDue / 1440)}`);
  for (const f of w.favours.filter((x) => !x.settled && (x.from === p.id || x.to === p.id))) console.log(`  [FAVOUR] ${w.chars[f.from].name} did one for ${w.chars[f.to].name} (size ${f.size}): ${f.text ?? ''}`);
  const memos = Object.values(w.chars).flatMap((c) => c.memos.filter((m) => m.other === p.id && !m.done).map((m) => `${c.name}: ${m.kind} "${m.text}"${m.due ? ` due in ${Math.round((m.due - w.now) / 1440)}d` : ''}`));
  for (const m of memos) console.log(`  [MEMO] ${m}`);
}
function menu() {
  if (!convo) return;
  const t = w.chars[convo.id];
  console.log('  OPTIONS: ' + options(w, P(), t, convo).map((o) => `${o.done ? '~' : ''}{${o.code}} ${o.label}`).join('\n           '));
}
function showMeet() {
  if (!meet) return; const it = mCurrent(meet);
  if (!it) { console.log('  (meeting finished: run mclose)'); return; }
  console.log(`  ITEM: ${(it as any).title ?? ''} ${(it as any).lines?.join(' ') ?? ''}`.trim());
  console.log('  CHOICES: ' + it.opts.map((o, i) => `{${o.code}} ${o.label}`).join('\n           '));
}
const args = process.argv.slice(2);
load();
const [cmd, ...rest] = args;
appendFileSync(LOG, `${stamp()} > ${args.join(' ')}\n`);
const p = P();
if (cmd === 'status') status();
else if (cmd === 'wait') {
  // Like the game's own wait: time passes until something wants your attention, or the time asked for is up.
  const target = w.now + Number(rest[0] ?? 1) * 1440; const a0 = attn(); const seenFacts = new Set(Object.keys(p.known));
  const sun0 = w.sunday?.t;
  while (w.now < target) { advance(w, Math.min(target, w.now + 60)); if (attn() > a0 || (w.sunday?.t !== sun0)) break; }
  console.log(`Time passes to ${stamp()}.`);
  const fresh = Object.keys(p.known).filter((id) => !seenFacts.has(id) && w.facts[id]).slice(0, 12);
  for (const id of fresh) console.log(`  news: ${w.facts[id].text}`);
  if (w.sunday?.t !== sun0) console.log('  (Sunday at the social club: your men bring their envelopes.)');
  convo = null; status();
}
else if (cmd === 'talk') {
  const x = find(rest.join(' ')); if (!x) { console.log('no such man'); process.exit(0); }
  const wh = whereIs(w, p, x);
  if (wh.kind === 'jail') { advance(w, w.now + 5); console.log(`${x.name} is locked up.`); }
  else if (!introduced(w, p, x)) { advance(w, w.now + (wh.mins ?? 15)); convo = startConvo(x.id); console.log(`You find ${x.name}: ${wh.line}\nYou have never met him.`); menu(); }
  else {
    const act = generate(w, p, 'socialise').find((a) => a.target === x.id);
    const prev = x.rels[p.id]?.lastMet ?? -1e9;
    let mins = wh.mins ?? 15; let lines0: { lines: string[] } = { lines: [] };
    if (act) { act.quiet = true; const r = perform(w, act); mins = r.minutes; lines0 = r; }
    advance(w, w.now + mins);
    const a = arrive(w, p, x, lines0, wh, prev); convo = a.convo;
    console.log(`[${stamp()}] ${x.name}: ${x.rank}, ${arch(x)}, ${wh.kind}`); console.log(a.lines.join('\n')); menu();
  }
}
else if (cmd === 'do' && convo) {
  const t = w.chars[convo.id]; const code = rest.join(' ');
  const os = options(w, p, t, convo); const o = os.find((q) => q.code === code) ?? os.find((q) => q.label.toLowerCase().includes(code.toLowerCase()));
  if (!o) { console.log('no such option'); menu(); process.exit(0); }
  const before = JSON.stringify([t.rels[p.id]?.trust, t.rels[p.id]?.respect, t.rels[p.id]?.affection, t.rels[p.id]?.grudge, p.cash, p.standing].map((n) => Math.round((n ?? 0) * 100) / 100));
  console.log(`> ${o.label}${o.done ? ' (already used)' : ''}`);
  const r = say(w, p, t, convo, o.code);
  advance(w, w.now + r.minutes);
  console.log(r.lines.join('\n'));
  if (r.meeting) console.log(typeof r.meeting === 'string' ? r.meeting : '[a sit-down / meeting is arranged]');
  convo = r.convo; if (!convo) console.log('[conversation ends]'); else menu();
}
else if (cmd === 'leave') { convo = null; console.log('You take your leave.'); }
else if (cmd === 'enc') {
  const e = w.enc.find((x) => x.id === rest[0]); if (!e) { console.log('no such request'); process.exit(0); }
  console.log(e.lines.join('\n')); if (rest[1]) { const r = encChoose(w, p, e, rest[1]); advance(w, w.now + r.minutes); console.log('> ' + (e.opts.find((o) => o.code === rest[1])?.label ?? rest[1])); console.log(r.lines.join('\n')); }
}
else if (cmd === 'take') { const j = w.jobs.find((x) => x.id === rest[0]); if (j) { console.log(j.title + '\n' + (j.brief ?? '')); if (rest[1] === 'yes') { takeJob(w, j); console.log('Taken.'); } else if (rest[1] === 'no') { declineJob(w, j); console.log('Declined.'); } } }
else if (cmd === 'job') {
  const j = w.jobs.find((x) => x.id === rest[0]); if (!j) { console.log('no such job'); process.exit(0); }
  if (!rest[1]) { console.log(`${j.title} [${j.status}]\n${j.brief ?? ''}`); for (const a of approaches(w, j)) console.log(`  {${a.code}} ${a.label} :: ${a.hint}`); }
  else { const r = resolve(w, j, rest[1]); advance(w, w.now + r.minutes); console.log(r.lines.join('\n')); }
}
else if (cmd === 'attend') {
  const j = w.jobs.find((x) => x.id === rest[0]); if (!j) { console.log('no such job'); process.exit(0); }
  if (j.status === 'offered') takeJob(w, j);
  const m = j.meeting === 'induction' ? openInduction(w, p, j) : j.meeting === 'accounts' ? openAccountsMeeting(w, p, j) : j.meeting === 'family' ? openFamilyMeeting(w, p, j) : j.meeting === 'sitdown' ? (w.grievances.find((g) => g.id === j.extra?.g) ? openSitdown(w, p, w.grievances.find((g) => g.id === j.extra?.g)!) : 'It has sorted itself out.') : openCrewMeeting(w, p);
  if (typeof m === 'string') { console.log(m); } else { meet = m; if (j.meeting === 'sitdown') j.status = 'done'; console.log(`MEETING: ${m.title}; with ${m.attendees.map((i) => w.chars[i]?.name).join(', ')}`); showMeet(); }
}
else if (cmd === 'mchoose' && meet) {
  const it = mCurrent(meet); const o = it?.opts.find((q) => q.code === rest[0]) ?? it?.opts[Number(rest[0])];
  if (!it || !o) { console.log('no such choice'); showMeet(); } else { console.log('> ' + o.label); console.log(mChoose(w, p, meet, o.code).join('\n')); showMeet(); }
}
else if (cmd === 'mclose' && meet) { const r = closeMeeting(w, p, meet); advance(w, w.now + r.minutes); console.log(r.lines.join('\n')); meet = null; }
else if (cmd === 'prospects') { for (const x of prospects(w, p)) console.log(`${x.c.name} (${x.c.district}) ${x.note}${x.vouch ? ', vouched' : ''}`); }
else if (cmd === 'sunday') {
  for (const c of crewOf(w, p)) { const s = statement(w, c); console.log(`${c.name}: handed ${money(s.handed)} of ${money(s.due)}${s.light ? ` LIGHT by ${money(s.short)}` : ''}; missed weeks ${c.books.missed}; arrears ${money(c.books.arrears)}`); }
}
else if (cmd === 'srule') {
  // the three plain answers a boss gives across the table; same effects as the game's Sunday screen
  const c = w.chars[rest[0]]; const code = rest[1]; const s = statement(w, c); const r = relOf(c, p.id); const first = c.name.split(' ')[0];
  if (code === 'accept') { r.trust = clamp(r.trust + (s.light ? 0 : 0.02)); r.respect = clamp(r.respect + (s.light ? -0.02 : 0.01)); console.log(s.light ? `You take it without a word. ${money(s.short)} stays on ${first}’s tab.` : `You take the envelope and nod. ${first} relaxes.`); }
  else if (code === 'praise') { r.trust = clamp(r.trust + 0.04); r.respect = clamp(r.respect + 0.02); console.log(`You tell ${first} he’s the kind of man this family needs.`); }
  else if (code === 'shout') { r.trust = clamp(r.trust - 0.1); r.respect = clamp(r.respect - 0.05); r.grudge = clamp(r.grudge + 0.06); if (s.short > 0) c.books.arrears += Math.round(s.short); console.log(`You raise your voice until the room goes quiet.`); }
}
else if (cmd === 'man') {
  const x = find(rest.join(' ')); if (!x) process.exit(0);
  const r = x.rels[p.id];
  console.log(`${x.name}: ${x.rank} ${arch(x)}, ${x.familyId ? w.fam[x.familyId].name : '-'}, cash ${money(x.cash)}; to me: trust ${r?.trust.toFixed(2)} respect ${r?.respect.toFixed(2)} warmth ${r?.affection.toFixed(2)} grudge ${r?.grudge.toFixed(2)}; boss ${x.bossId ? w.chars[x.bossId].name : '-'}; problem ${x.problem?.kind ?? '-'}; want ${x.want?.kind ?? '-'}`);
}
else if (cmd === 'who') {
  const met = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && introduced(w, p, c));
  console.log(met.map((c) => `${c.name} (${c.rank}${c.familyId === p.familyId ? '' : ', ' + (c.familyId ? w.fam[c.familyId].name : 'civ')})`).join('; '));
}
save();
process.exit(0);
