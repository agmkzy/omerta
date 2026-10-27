// Your career (The Family, October 2026): where you stand, what you have shown, how the men who decide see you, what you are credible
// for and whether there is a seat, what the family's line or picture is as far as you could know it, and what has happened in your
// career. Readiness and being chosen are kept apart, as the owner asked: the record says what you have shown; the family decides.
// Nothing here is a probability, and nothing is shown that the player couldn't know.
import { careerRecord, peopleWord, POSITION_WORD, positionOf, prospectsOf, regardOf, roleOf, standingWordOf, statusOf } from '../standing';
import { booksOpen, captaincyContenders, successionPicture, underbossPicture } from '../succession';
import { famName, shortTime } from '../core';
import { pathInfo } from '../path';
import { promoSteps } from '../career';
import { pathCard, powersCard } from './pathview';
import { ambitionCard } from './ambview';
import { avatar } from './common';
import { h, kv, rows, quiet, type KV, type Row } from './kit';
import { esc, lk, P, pl, W } from './links';
import type { Character, World } from '../types';

const date = (t: number) => shortTime(t).replace(/,? \d\d:\d\d$/, '');
const RESP: Record<string, string> = {
  associate: 'You have no say in the family’s affairs. You work for the men who will have you, and they answer for you.',
  crewman: 'You work in another man’s operation. He answers for you.',
  soldier: 'You answer to your captain, pay him his share every week, and may keep men of your own. You can’t make anyone a member.',
  captain: 'You command a recognised crew: its men answer to you, you answer for them, and you pass the crew’s share up.',
  underboss: 'You run the family’s business on the boss’s authority: the captains answer to you, and you answer to him.',
  consigliere: 'You advise the boss and settle what can’t be settled by orders. You command nobody; men listen because you are trusted.',
  'acting boss': 'You run the family while the boss can’t. The authority is his, lent to you, and everyone knows it.',
  boss: 'The family is yours: its appointments, its rules, its quarrels. Every man in it has plans of his own.',
};

export function careerRoom(): string {
  const w = W(), p = P();
  const pos = positionOf(w, p), status = statusOf(p), role = roleOf(w, p);
  const sup = p.bossId ? w.chars[p.bossId] : undefined;
  let out = `<header class="cr-head"><div class="cr-pos">${esc(POSITION_WORD[pos] || 'Outside the family')}</div><p class="cr-sub">${esc([status === 'made' ? 'Made' : status === 'associate' ? 'Not made' : '', p.familyId ? `the ${famName(w, p)} family` : '', role ?? ''].filter(Boolean).join(' · '))}</p><p class="cr-resp">${esc(RESP[pos] ?? '')}</p></header>`;
  const where: KV[] = [];
  if (sup) where.push(['You answer to', pl(sup)]);
  const men = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id);
  if (men.length) where.push([peopleWord(w, p) === 'crew' ? 'Your crew' : 'Your crewmen', `${men.length} ${men.length === 1 ? 'man' : 'men'}`]);
  if (where.length) out += kv(where);

  // what you have shown: the record, each in a word, with what it rests on
  const rec = careerRecord(w, p);
  out += h('Your record') + `<ul class="cr-rec">${rec.map((d) => `<li><span class="cr-rec__l">${esc(d.label)}</span><span class="cr-rec__w">${esc(d.word)}</span><i class="cr-rec__bar" style="--v:${Math.round(d.v * 100)}%"></i><small>${esc(d.note)}</small></li>`).join('')}</ul>`;

  // how the men who decide see you, as far as you could know it
  const vs = regardOf(w, p);
  if (vs.length) {
    out += h('How you’re regarded', esc(standingWordOf(vs.filter((v) => v.known)))) + rows(vs.map((v): Row => ({ face: avatar(v.who), kick: v.role, title: esc(v.who.name), sub: esc(v.known ? youWord(v.word) : 'you don’t know what he thinks of you'), tone: !v.known ? 'dim' : v.v < 0.15 ? 'warn' : '', a: `ent:${v.who.id}` })));
  }

  // prospects: what you are credible for, and whether there is a seat; the family's line or picture, as you could know it
  out += prospectsBlock(w, p);

  // the measurable road (milestones), folded under the prospects: progress you can see, not a promise
  const steps = promoSteps(w, p);
  if (steps || pathInfo(w, p)) out += `<details class="lf-fold"><summary>Milestones on the way</summary>${pathCard()}</details>`;
  out += ambitionCard();

  // the history
  const posts = (p.career?.posts ?? []).slice().reverse();
  const log = (p.career?.log ?? []).filter((x) => /Promoted|Became|Made|Took over|Put down|Named|appointed|sponsor/i.test(x.text)).slice(-6).reverse();
  if (posts.length || log.length) out += h('Your career') + `<ul class="op-hist">${[...posts.map((x) => ({ t: x.t, text: x.text })), ...log].sort((a, b) => b.t - a.t).slice(0, 10).map((x) => `<li><span>${esc(date(x.t))}</span><div>${lk(x.text)}</div></li>`).join('')}</ul>`;
  const pc = powersCard();
  if (pc) out += `<details class="lf-fold"><summary>What your position lets you do</summary>${pc}</details>`;
  return out;
}
const youWord = (s: string) => s.replace(/\bhim\b/g, 'you');

function prospectsBlock(w: World, p: Character): string {
  if (!p.familyId) return '';
  const f = w.fam[p.familyId];
  let out = '';
  const ps = prospectsOf(w, p);
  for (const x of ps) out += `<div class="cr-pro ${x.credible ? 'ok' : ''}"><b>${esc(x.office)}</b><p>${esc(x.line)}</p>${x.strong.length ? `<small>Strong: ${esc(x.strong.join(', '))}</small>` : ''}${x.short.length ? `<small>Still to show: ${esc(x.short.join(', '))}</small>` : ''}</div>`;
  if (out) out = h('Prospects') + out;
  // the induction line, as a made man who trusts you last told it
  if (p.rank === 'associate') {
    const told = w.path?.line, by = told?.by ? w.chars[told.by] : undefined;
    out += h('Next to be made', booksOpen(w, f) ? 'the books are open' : 'the books are closed');
    if (booksOpen(w, f) && f.books?.why) out += `<p class="cr-note">They opened because ${esc(f.books.why)}.</p>`;
    if (!told || !by) out += quiet('Nobody has told you where you stand. A made man who trusts you would know, and might say.');
    else {
      const mine = told.order.indexOf(p.id);
      out += `<p class="cr-note">As ${pl(by)} told it, ${esc(date(told.t))}:</p><ol class="cr-line">${told.order.map((id) => { const c = w.chars[id]; return `<li class="${id === p.id ? 'you' : ''}">${id === p.id ? '<b>You</b>' : c ? pl(c) : 'someone'}</li>`; }).join('')}</ol>`;
      if (mine < 0) out += `<p class="cr-note">You aren’t in it. Not yet.</p>`;
    }
  }
  // captaincy: the contenders a made man would know of
  if (p.rank === 'soldier') {
    const cs = captaincyContenders(w, f.id);
    const me = cs.find((x) => x.c.id === p.id);
    out += h('Who could be a captain') + (cs.length ? rows(cs.slice(0, 4).map((x): Row => ({ face: avatar(x.c), title: x.c.id === p.id ? '<b>You</b>' : esc(x.c.name), sub: esc(x.word), a: x.c.id === p.id ? undefined : `ent:${x.c.id}` }))) : quiet('Nobody in the family is talked of for a crew yet.'))
      + (me ? '' : `<p class="cr-note">You aren’t talked of for a crew yet.</p>`);
  }
  // the underboss's chair and the boss's, as a captain and above would know them
  if (['capo', 'underboss', 'boss'].includes(p.rank) || f.consigliere === p.id) {
    const u = underbossPicture(w, f.id);
    const r: KV[] = [];
    if (u.current) r.push(['Underboss', u.current.isPlayer ? 'you' : pl(u.current)]);
    if (u.preferred && u.preferred.id !== u.current?.id) r.push(['Thought of for it', u.preferred.isPlayer ? 'you' : pl(u.preferred)]);
    const s = successionPicture(w, f.id);
    if (s.heir) r.push([s.named ? 'Named successor' : 'Expected to succeed', s.heir.isPlayer ? 'you' : pl(s.heir)], ['The captains behind him', esc(s.supportWord)]);
    if (s.conWord) r.push(['With the consigliere', esc(s.conWord)]);
    if (s.rival && s.rival.id !== p.id) r.push(['Might stand against him', pl(s.rival)]);
    if (r.length) out += h('The chairs at the top') + kv(r);
  }
  return out;
}
