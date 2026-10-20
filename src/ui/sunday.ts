// Sunday at the social club, all on one page. Each man comes in with his envelope. If it's light you can see it at once,
// look through his books without leaving, and decide what to say to him. Nothing here takes you to another screen,
// so you never lose your place or the other men waiting.
import { money } from '../core';
import { envelopeSum, kickWindow } from '../books';
import { crewOf, openSunday, WANT_SHORT, knows } from '../crewlife';
import { previous, statement } from '../ledger';
import { back } from './common';
import { toSide } from './layout';
import { esc, lk, P, pl, S, W } from './links';

export function sundayDue(): boolean {
  const w = W();
  const p = P();
  return !!w.sunday && (S.sundaySeen ?? 0) < w.sunday.t && crewOf(w, p).length > 0;
}

export const sKey = (id: string) => `${W().sunday?.t}:${id}`;

const BTN = (a: string, label: string, hint = '', cls = '') => `<button class="btn ${cls}" data-a="${a}"${hint ? ` title="${esc(hint)}"` : ''}>${label}</button>`;

function manCard(c: import('../types').Character): string {
  const w = W();
  const p = P();
  const key = sKey(c.id);
  const s = statement(w, c);
  const prev = previous(w, c);
  const settled = S.sundayRes[key];
  const checked = S.sundayBooks[key];
  const name = esc(c.name.split(' ')[0]);
  const light = s.light || c.books.missed > 1;
  const pill = settled ? '<span class="tag green">Settled</span>' : light ? `<span class="tag red">Light${s.short ? ' by ' + money(s.short) : ''}</span>` : '<span class="tag green">In order</span>';
  const d = prev ? s.handed - prev.handed : 0;
  const vs = prev ? ` &middot; <span class="${d > 0 ? 'good' : d < 0 ? 'warn' : 'muted'}">${d > 0 ? '+' : d < 0 ? '−' : ''}${money(Math.abs(d))} vs last week</span>` : '';
  let out = `<div class="card sunman${light && !settled ? ' light' : ''}"><div class="sunhead">${pl(c)}${pill}</div>`;
  out += `<p class="sunline">Handed up <b>${money(s.handed)}</b> of ${money(s.due)} due${vs}</p>`;
  if (c.books.missed > 1 && !settled) out += `<p class="muted sunline">${c.books.missed} short weeks in a row.</p>`;
  if (checked) out += `<div class="note">${checked.map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
  if (settled) return out + `<div class="note done">${settled.map((l) => `<p>${lk(l)}</p>`).join('')}</div></div>`;
  const row: string[] = [];
  if (!checked) row.push(BTN(`sbooks:${c.id}`, 'Check his books', 'Takes no time. A careful man is harder to read.'));
  if (!light) {
    if (checked && p.books.flags[c.id]?.amt > 0) row.push(BTN(`srule:${c.id}|demand`, `Make him pay the ${money(p.books.flags[c.id].amt)} he held back`, 'Adds it to what he owes.', 'bad'), BTN(`srule:${c.id}|shout`, 'Shout at him', 'Humiliate him in front of the room.', 'bad'), BTN(`srule:${c.id}|beat`, 'Have him beaten', 'Violence. The family hears.', 'bad'));
    row.push(BTN(`srule:${c.id}|accept`, 'Accept it', 'Takes it as it is.', 'primary'), BTN(`srule:${c.id}|keep`, 'Let him keep half', 'Costs you half of what he handed up. He won’t forget it.'), BTN(`srule:${c.id}|praise`, 'Tell him he’s doing right', 'A word costs nothing and he’ll work harder.'));
  } else {
    row.push(BTN(`srule:${c.id}|accept`, 'Take what’s here', `The ${money(s.short)} stays on his tab.`, 'primary'), BTN(`srule:${c.id}|warn`, 'Warn him', 'A quiet word. He knows you’re watching.'), BTN(`srule:${c.id}|demand`, `Make him pay the ${money(Math.max(s.short, p.books.flags[c.id]?.amt ?? 0))}`, 'Adds it to what he owes. He won’t like it.'), BTN(`srule:${c.id}|forgive`, 'Let it slide', 'Clears it. Some will take that as weakness.'));
    row.push(BTN(`srule:${c.id}|shout`, 'Shout at him', 'Humiliate him in front of the room. Others take note.', 'bad'), BTN(`srule:${c.id}|raise`, 'Raise his share (+5%)', 'He pays more from now on. He resents it.', 'bad'), BTN(`srule:${c.id}|beat`, 'Have him beaten', 'Violence. He won’t forget and the family hears.', 'bad'), BTN(`srule:${c.id}|cut`, 'Cut him loose', 'He’s out of your crew, and he knows what he knew.', 'bad'));
  }
  // The likeliest two answers in reach; the rest a tap away, so a room of men isn't a wall of buttons.
  out += `<div class="sunbtns">${row.slice(0, 2).join('')}</div>${row.length > 2 ? `<details class="fold sunmore"><summary class="more">More ways to answer him</summary><div class="sunbtns">${row.slice(2).join('')}</div></details>` : ''}</div>`;
  return out;
}

export function sundayView(): string {
  const w = W();
  const p = P();
  const s = w.sunday;
  const crew = crewOf(w, p);
  if (!S.sundayHeard || S.sundayHeard !== s?.t) { S.sundayLines = openSunday(w, p); S.sundayHeard = s?.t ?? 0; S.sundayRes = {}; S.sundayBooks = {}; S.sundayMine = []; }
  S.sundaySeen = s?.t ?? w.now;
  let out = back() + `<header class="g-meet"><h1 class="page">Sunday at the social club</h1><p class="g-just g-just--small"><span>Your men come in with an envelope each. Look through any man’s books and answer him, all from here.</span></p></header>`;

  // the table: what came in against what was due
  const stm = crew.map((c) => ({ c, s: statement(w, c) }));
  const got = stm.reduce((a, x) => a + x.s.handed, 0), due = stm.reduce((a, x) => a + x.s.due, 0);
  const lightN = stm.filter((x) => (x.s.light || x.c.books.missed > 1) && !S.sundayRes[sKey(x.c.id)]).length;
  out += `<h2 class="sect">The envelopes<small>${money(got)} of ${money(due)}${lightN ? ` &middot; ${lightN} light` : ' &middot; all in'}</small></h2>`;
  const easy = crew.filter((c) => { const x = statement(w, c); return !(x.light || c.books.missed > 1) && !S.sundayRes[sKey(c.id)]; });
  if (easy.length > 1) out += `<div class="card"><p class="muted">${easy.length} men are square. Nothing here needs you.</p>${BTN('saccall:', `Accept all ${easy.length} in order`, 'Takes every envelope that is in order and moves on.', 'primary')}</div>`;
  out += crew.map(manCard).join('');

  if (S.sundayLines?.length) out += `<h2 class="sect">Somebody has something to tell you</h2><div class="card">${S.sundayLines.map((l) => `<p class="say">${lk(l)}</p>`).join('')}</div>`;
  const rows = crew.map((c) => (knows(p, c.id, 'want') && c.want ? `<li><span>${esc(c.name.split(' ')[0])}</span><span class="v">${esc(WANT_SHORT[c.want.kind])}</span></li>` : '')).join('');
  if (rows) toSide(`<h2 class="sect">What you’ve worked out</h2><div class="card"><ul class="rows">${rows}</ul></div>`);

  // your own envelope, handed over right here
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  if (boss) {
    const e = envelopeSum(w, p);
    const st = p.books.stance ?? 'honest';
    const pill = (id: string, label: string) => `<button class="pill small ${st === id ? 'on' : ''}" data-a="stance:${id}">${label}</button>`;
    const pct = Math.round(e.rate * 100);
    const can = kickWindow(w, p) && e.due > 0;
    const half = Math.round(e.due / 2 / 5) * 5;
    out += `<h2 class="sect">Your envelope<small>to ${esc(boss.name.split(' ')[0])}</small></h2><div class="card">`;
    out += `<p>Last week you made <b>${money(e.own)}</b> and your crew handed you <b>${money(e.crew)}</b>. ${pct}% of ${money(e.own + e.crew)} is <b>${money(e.weekDue)}</b>${e.overdue ? `, plus <b>${money(e.overdue)}</b> still owed from before` : ''}.</p>`;
    out += e.due > 0 ? `<p class="sunline">Still to hand over: <b>${money(e.due)}</b></p>` : `<p class="sunline good">You’re square with ${esc(boss.name.split(' ')[0])}.</p>`;
    if (S.sundayMine?.length) out += `<div class="note done">${S.sundayMine.map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
    if (can) out += `<div class="sunbtns">${BTN('shand:all', `Hand over ${money(e.due)}`, '', 'primary')}${half >= 5 && half < e.due ? BTN('shand:half', `Hand over ${money(half)} now`, 'The rest stays owing.') : ''}</div>`;
    else if (e.due > 0) out += `<p class="muted">The kick-up window has closed. ${esc(boss.name.split(' ')[0])} will want it next Sunday, with interest in his patience.</p>`;
    out += `<p class="muted" style="margin-top:10px">How you report it next week:</p><div class="pills">${pill('honest', 'Honest')}${pill('shave', 'Shave it')}${pill('stall', 'Stall')}</div></div>`;
  }
  return out;
}
