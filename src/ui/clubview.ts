// The social club screen: who is in, and who has come over to you. Sitting down with a man is the conversation (Stage 5C).
import { clubOf, clubOpen, clubPresent, topicsFor, waiting } from '../club';
import { fmtTime } from '../core';
import { sundayDue } from './sunday';
import { avatar, back } from './common';
import { choices, h, quiet, rows, type Pick, type Row } from './kit';
import { placeHead, waitPicks } from './views_b';
import { esc, lk, P, W } from './links';

// an hour as a man says it: '11 in the morning', '2 at night'
const clock = (h0: number) => { const h = h0 % 24; return h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 5 ? `${h} at night` : h < 12 ? `${h} in the morning` : h < 18 ? `${h - 12} in the afternoon` : `${h - 12} in the evening`; };
export function clubView(): string {
  const w = W(), p = P();
  const cl = clubOf(w, p.familyId);
  if (!cl) return back() + quiet('Your family has no club.');
  const owner = w.chars[cl.ownerId], open = clubOpen(w, cl), sid = 'li:club:' + p.familyId;
  const fam = p.familyId ? w.fam[p.familyId]?.name ?? '' : '';
  let out = back() + placeHead(`The ${fam} club · ${open ? `open till ${clock(cl.open[1])}` : 'shut'}`, cl.name, `Espresso, a card table in the back, and the men who matter.${owner ? ` ${owner.name} runs it.` : ''}`);
  const waits = waitPicks(w, p, sid);
  if (!open) return out + quiet(`The shutters are down. ${owner ? esc(owner.name.split(' ')[0]) + ' opens' : 'It opens'} at ${cl.open[0]}:00.`) + (waits.length ? h('Who comes in') + choices(waits, 'Who comes in') : '');
  const here = clubPresent(w, cl);
  const wait = waiting(w, p, cl, here);
  if (wait.length) out += h('Wants a word') + rows(wait.map(({ c, t }): Row => ({ face: avatar(c), title: esc(c.name), sub: esc(t.cue), tone: 'warn', a: `cscene:${c.id}` })));
  const others = here.filter((x) => !wait.some((y) => y.c.id === x.c.id));
  if (others.length) out += h('In the room', String(here.length)) + rows(others.map((x): Row => ({ face: avatar(x.c), title: esc(x.c.name), sub: `${esc(x.c.rank === 'capo' ? 'captain' : x.c.rank)} · ${esc(x.doing)}`, a: `cscene:${x.c.id}` })));
  else if (!wait.length) out += quiet('Nobody you know is in right now.');
  const doing: Pick[] = [];
  if (sundayDue()) doing.push({ a: 'sunday:', label: 'Take your men’s envelopes', hint: 'Sunday. They are bringing them in.' });
  doing.push({ a: 'club:sit', label: 'Sit and listen', hint: 'An hour or two. Things find you here.' }, ...waits);
  out += h('What you do') + choices(doing, 'What you do');
  void topicsFor; void fmtTime; void lk;
  return out;
}
