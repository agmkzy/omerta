// What is on a man's mind, and the matters between him and the player that are conversations of their own (Gate 4: talk.ts and
// threads.ts, now conv/subjects): raised by the player or by him, each a short exchange that answers what was just said. And "What
// do you make of…?": the questions about his view of things, of men, of the player.
import { peek } from '../../core';
import { temper } from '../../temper';
import { settled } from '../decide';
import type { Act, Ctx, Offer } from '../kit';
import { line, out, T } from './common';
import { openness } from './words';
import { subjectsOf, talkAbout, withCandour } from '../subjects/life';
import '../subjects/between'; // (registers the matters between them as subjects)
import { bizCode } from './business';
import { ACTS } from '.';

// How freely he talks about his own life (not his secrets, not favours: those are trust) to a man he has been getting to know: what
// he thinks of him, how well they know each other, how much he likes him, his own nature; a grudge against him shuts it
export function candourOf(c: Ctx): number {
  const r = peek(c.n, c.h.id), t = c.pn().temper;
  return r.trust + 0.5 * (r.known ?? 0) + 0.25 * (r.affection ?? 0) + 0.15 * (c.n.traits.sociability - 0.5) - 0.1 * (t.caution - 0.5) - (r.grudge ?? 0);
}
const BIZ = /^(shop|racket)\b/, THREAD = /^(earn|debt:|job:|ev:)/;
const paneFor = (key: string) => (/^(shop|racket|earn|debt:|job:)/.test(key) ? 'business' : 'personal') as Offer['pane'];
const usedHere = (c: Ctx, key: string) => (c.v.th.used ?? []).includes('tk:' + key);
const hisAsk = (c: Ctx) => c.w.enc.some((e) => e.status === 'open' && e.from === c.n.id && e.expires > c.w.now && e.opts.length);
// (set by visit.ts: a subject that has become something else between them is not offered as one of its own)
let HELD: (c: Ctx, code: string) => boolean = () => false;
export const subjectsHeldBy = (f: (c: Ctx, code: string) => boolean) => { HELD = f; };
export function subjectOffers(c: Ctx): Offer[] {
  const { w, h: p, n: t } = c, xs = subjectsOf(w, p, t).filter((s) => !HELD(c, 'tk:' + s.key)), out0: Offer[] = [];
  // on his mind: the one subject heaviest on it, of his own life (when he has nothing more pressing to raise)
  const env = ACTS.b_envelope?.offers?.(c).length, job = ACTS.job?.offers?.(c).length;
  const mind = !hisAsk(c) && !env && !job ? xs.slice(0, 6).filter((s) => !BIZ.test(s.key) && !THREAD.test(s.key) && s.key !== 'hurting').slice(0, 1) : [];
  for (const s of mind) if (!usedHere(c, s.key)) out0.push({ code: 'tk:' + s.key, label: s.label.replace(/^“|”$/g, ''), note: s.hint, kind: 'mind', pane: 'personal' });
  // the matters between them that are conversations of their own: his money, a debt, a job, something that happened
  for (const s of xs.slice(0, 10).filter((y) => THREAD.test(y.key))) if (!usedHere(c, s.key)) out0.push({ code: 'tk:' + s.key, label: s.label.replace(/^“|”$/g, ''), note: s.hint, kind: 'between', pane: paneFor(s.key) });
  // his shop or racket is what "How's business?" opens; the rest of what is on his mind, under its heading
  const biz = bizCode(c);
  for (const s of xs.slice(0, 4)) {
    if (out0.some((o) => o.code === 'tk:' + s.key)) continue;
    if (BIZ.test(s.key)) { if (biz === 'tk:' + s.key) out0.push({ code: 'tk:' + s.key, label: 'How’s business?', kind: 'other', pane: 'business' }); continue; }
    out0.push({ code: 'tk:' + s.key, label: s.label.replace(/^“|”$/g, ''), note: s.hint, kind: 'other', pane: paneFor(s.key) });
  }
  return out0;
}
const tk: Act = {
  base: 'tk', pane: 'personal',
  offers: subjectOffers,
  run: (c, code) => {
    const x = T(c), { w, p, t } = x;
    // (talking about his own life, he is as candid as he is with this man)
    const b = withCandour(t.id, candourOf(c), () => talkAbout(w, p, t, code));
    if (!b) { line(x, 'He has moved on to something else.'); return out(2); }
    const key = code.split(':').slice(0, code.startsWith('tk:op:') || code.startsWith('tk:kin:') || code.startsWith('tk:tell:') || code.startsWith('tk:debt:') || code.startsWith('tk:job:') || code.startsWith('tk:ev:') || code.startsWith('tk:pressed:') ? 3 : 2).join(':');
    (c.v.th.used ??= []).push(key); // (a subject raised is raised: not opened again in this visit)
    for (const l of b.lines) if (l) line(x, l);
    const minutes = b.minutes ?? 15;
    if (b.go?.node === 'subject' && b.go.subject) { c.v.th.subject = b.go.subject; c.v.th.asked = []; return { minutes, next: ACTS.subject.questions?.(c) }; }
    if (b.choices.length) return { minutes, next: b.choices.map((q) => ({ code: q.code, label: q.label.replace(/^“|”$/g, ''), note: q.hint })) };
    if (!b.lines.length) c.v.lines.push({ who: 'narr', text: 'You leave it there.' });
    return out(minutes);
  },
};
// "What do you make of…?": his view of a man, of the family, of the player; a man who will not discuss things with the player says so
const THINK = ['b_stand', 'pick_member', 'leaders', 'ask_rep', 'ask_history', 'ask_want', 'ask_crew', 'rv_ears', 'rv_mood', 'rk_back_ask', 'about'];
const think: Act = {
  base: 'think', pane: 'personal',
  offers: (c) => [{ code: 'think', label: 'What do you make of…?', note: 'His view of a man, of the family, of you.' }],
  run: (c) => {
    const x = T(c), { w, p, t } = x, tp = temper(t);
    if (openness(w, t, p) === 'hostile') {
      const n = c.v.th.raised.filter((q) => q === 'refuse').length;
      line(x, n === 0 ? (tp.volatility > 0.55 ? '“I’ve got nothing to say to you.”' : '“I’d rather not.”') : n === 1 ? '“I said no.”' : '“Are you deaf?”', settled(t.id, 'refuses', 'he has nothing to say to you (openness: hostile)'));
      c.v.th.raised.push('refuse');
      if (n >= 1) c.v.th.cold = true;
      return out(2);
    }
    line(x, tp.agreeable + tp.empathy > 1.1 ? '“If I can help.”' : tp.caution > 0.6 ? '“Depends what you’re asking.”' : '“Ask.”');
    const mine = Object.values(ACTS).flatMap((a) => (THINK.includes(a.base) && a.offers ? a.offers(c) : [])).map((o) => ({ ...o, kind: undefined }));
    const subs = subjectOffers(c).filter((o) => !mine.some((m) => m.code === o.code)).map((o) => ({ ...o, kind: undefined }));
    return { minutes: 2, next: [...mine, ...subs] };
  },
};
export const SUBJECTS: Act[] = [tk, think];
