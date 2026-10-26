// How one thing the player says is carried through (Gate 4): the conversation's own management, around whichever interaction (Act) it
// is. Before: has it been said already in this visit; has it been asked lately with nothing changed since (he says so, and it pays
// nothing). Then the act itself (its decision, its doors, its words). After: ordinary talk is worth less the third time in a day and
// past a point it moves a man no further; what it says of the player's conduct; a running matter it moves on goes on that matter's
// record; now and then he recalls something real between them; what changed is shown as a card; and his patience: pressure and going
// over old ground use it up, and when it runs out he turns cold or ends it. A man with something of his own to raise breaks in.
import { readiness } from '../career';
import { clamp, peek } from '../core';
import { temper, viewOf } from '../temper';
import { say as vsay } from '../voicesheet';
import { openAsks } from '../asks';
import { reached } from '../jobs';
import type { Character, World } from '../types';
import * as door from './doors';
import { agoWords, him, lastOf, plain, remember, restate, says, type Act, type Ctx, type Offer, type Out } from './kit';
import { answered, asksOf, speechFor } from './acts/words';
import { ACTS } from './acts';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

// what wears on him: pressure (a threat, a demand, a hard line in a haggle)
const PUSHY = /^(mv:[^:]+:(pressure|force|leverage|senior)|x:[^:]+:(assume|nochoice|notthere|now)|demand|sh_lean|terms_raise|cr_thin|rv_warn|challenge|deal:hold|a_defy)$/;
// the running matters an act belongs to, and whether it moves the matter on or settles it (its record: see story below)
const STORY: Record<string, [string, 'go' | 'end']> = {};
for (const [node, go, end] of [
  ['crew', ['cr_ask', 'cr_drop', 'cr_look', 'cr_money', 'cr_thin'], ['cr_cash', 'cr_duties']],
  ['amends', ['a_start', 'a_defy', 'a_ask'], ['a_own', 'a_pay', 'a_gift']],
  ['disputes', ['suspect', 'demand'], ['mediate']],
  ['debt', ['d_remind', 'd_ask'], ['d_time', 'd_half', 'd_favour', 'd_forgive', 'd_pay', 'd_all']],
  ['myboss', ['b_stand', 'b_seat'], []],
] as [string, string[], string[]][]) { for (const k of go) STORY[k] = [node, 'go']; for (const k of end) STORY[k] = [node, 'end']; }
// (ordinary talk: the old engine's TALKQ answers that need no reply get one in keeping with the evening)
const SOCIAL_ACK = new Set(['how', 'old_times', 'drink', 'rv_drink', 'welcome', 'congrats', 'chat', 'spend', 'news']);

export const actOf = (code: string): Act | undefined => ACTS[code.split(':')[0]];
const ACT_OPENS = (code: string) => !!actOf(code)?.opens;
// What can be put to him now, by every interaction that has something to offer (each by its own conditions)
// (and, of the rest, the two a man in the player's position would naturally put to this man first, by who he is to him: work and a
// bigger piece from the boss, protection to a shopkeeper, orders to the player's own man, a word to a man of another family)
const ROLE_PUTS: Record<string, string[]> = {
  boss: ['b_need', 'promo', 'b_more'], above: ['rk_back', 'recommend', 'work', 'promo', 'borrow'], mine: ['assign_low', 'assign_hustle'], peer: ['work', 'borrow', 'rk_back'],
  shop: ['suggest', 'offer_loan', 'partner_chop', 'partner_fence'], civilian: ['recruit_offer', 'offer_loan'], rival: ['rv_favour', 'rv_warn'],
};
const RK = (r: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(r);
export function roleOf(c: Ctx): string {
  const { w, h: p, n: t } = c;
  return t.id === p.bossId ? 'boss' : t.bossId === p.id ? 'mine' : t.rank === 'civilian' ? (Object.values(w.biz).some((b) => b.ownerId === t.id && b.open) ? 'shop' : 'civilian') : t.familyId && p.familyId && t.familyId !== p.familyId ? 'rival' : RK(t.rank) > RK(p.rank) ? 'above' : 'peer';
}
export function offersNow(c: Ctx): Offer[] {
  const out: Offer[] = [];
  for (const a of Object.values(ACTS)) if (a.offers) for (const o of a.offers(c)) out.push({ pane: a.pane, ...o });
  const lead = ROLE_PUTS[roleOf(c)].map((k) => out.find((o) => (o.kind ?? 'other') === 'other' && o.code.split(':')[0] === k)).filter((o): o is Offer => !!o).slice(0, 2);
  for (const o of lead) o.kind = 'lead';
  return out;
}

function storyKey(c: Ctx, node: string): string | undefined {
  const { w, h: p, n: t } = c;
  if (node === 'crew') return 'man:' + t.id;
  if (node === 'debt') { const d = w.debts.find((x) => x.status === 'active' && ((x.creditor === p.id && x.debtor === t.id) || (x.creditor === t.id && x.debtor === p.id))); return d ? 'debt:' + d.id : undefined; }
  if (node === 'myboss') { const r = readiness(w, p); return r ? 'seat:' + r.to : undefined; }
  if (node === 'amends' || node === 'disputes') return peek(t, p.id).grudge >= 0.3 || peek(p, t.id).grudge >= 0.3 ? 'threat:' + t.id : undefined;
  return undefined;
}
// whether something is running between them that a story act would move: his trouble as your man, a quarrel, bad blood, a debt, a seat
function storyLive(c: Ctx): boolean {
  const { w, h: p, n: t } = c;
  const crew = t.bossId === p.id && (!!t.problem || t.books.arrears > 0 || t.books.missed >= 2);
  const dispute = (w.disputes ?? []).some((x) => (x.status === 'open' || x.status === 'violated') && ((x.a === p.id && x.b === t.id) || (x.b === p.id && x.a === t.id)));
  const threat = peek(t, p.id).grudge >= 0.3 || peek(p, t.id).grudge >= 0.3;
  const debt = w.debts.some((x) => x.status === 'active' && ((x.creditor === p.id && x.debtor === t.id) || (x.creditor === t.id && x.debtor === p.id)) && (x.missed > 0 || x.balance > 0));
  const seat = t.id === p.bossId && !!readiness(w, p) && !readiness(w, p)!.openSeat;
  return crew || dispute || threat || debt || seat;
}

export interface Done extends Out { minutes: number; cold?: boolean }
// The player says it (the label is what he said, already on the screen); the act answers; the conversation does its part.
export function perform(c: Ctx, code: string, label: string): Done {
  const { w, h: p, n: t, v } = c, act = actOf(code);
  if (!act) return { minutes: 0 };
  const [base] = code.split(':'), arg = code.includes(':') ? code.slice(code.indexOf(':') + 1) : '';
  door.footing(w, p, t);
  const used = (v.th.used ??= []), key = code, picked0 = [...(v.th.picked ?? [])];
  // said or done already in this visit: it changes nothing until the player comes back
  if (!act.nav && !act.opens && used.includes(key) && act.repeat?.round !== true) { says(c, 'You’ve already been over that.'); return { minutes: 0 }; }
  // asked lately, and nothing has changed since: he says so, and it pays nothing; asked over and over, he tires of it
  const day0 = Math.floor(w.now / 1440), tkey = base === 'about' ? code : base;
  if (act.repeat) {
    const m = t.talk?.[tkey];
    if (m && m.sig === act.repeat.sig(c, arg) && day0 - m.d <= act.repeat.window) {
      m.n++;
      says(c, vsay(w, t, p, act.repeat.round ? 'round_enough' : m.d === day0 ? 'already' : 'nochange'));
      if (m.n >= 4 && !act.repeat.round && base !== 'old_times') { door.regard(w, t, p.id, 'trust', -0.01); says(c, vsay(w, t, p, 'chat_brush')); }
      used.push(key);
      return { minutes: 2 };
    }
  }
  const snap = () => { const q = peek(t, p.id); return { tr: q.trust, af: q.affection, rs: q.respect, gr: q.grudge, cash: p.cash, st: p.standing, ht: p.heat }; };
  const before = snap();
  // ordinary talk: two exchanges a day carry their full weight, about six a week; past that it is the same ground gone over again
  let dull: 'day' | 'week' | undefined;
  if (act.social) {
    const k = `soc:${t.id}`, kw = `socw:${t.id}`, day = day0, wk = Math.floor(day / 7);
    const m = p.cooldown[k] ?? 0, same = Math.floor(m / 10) === day ? m % 10 : 0;
    const mw = p.cooldown[kw] ?? 0, sameW = Math.floor(mw / 100) === wk ? mw % 100 : 0;
    door.cool(p, k, day * 10 + same + 1); door.cool(p, kw, wk * 100 + Math.min(99, sameW + 1));
    dull = same >= 2 ? 'day' : sameW >= 6 ? 'week' : undefined;
  }
  // (what the player said is remembered across visits, so the next one can answer to it: a slight, see visit.SLIGHT)
  if (label) remember(w, t.id, 'said:' + code.split(':').slice(0, 3).join(':'), 'said');
  const from = v.lines.length, inSubject = !!v.th.fact;
  const open0 = new Set(openAsks(w).filter((x) => x.terms?.by === p.id && x.terms?.of === t.id).map((x) => x.id));
  const r: Out = act.run(c, code) ?? {};
  // a proposal that has become a matter between them is now the subject in hand: what can be said to it comes next
  if (!r.next && !r.end && !r.meeting) { const opened = openAsks(w).find((x) => x.terms?.by === p.id && x.terms?.of === t.id && !open0.has(x.id)); if (opened) r.next = ACTS.m?.offersFor?.(c, opened.id); }
  // (what he says is said as a man talks: his own name is "I", the men he names by their first names)
  for (let i = from; i < v.lines.length; i++) if (v.lines[i].who !== 'you' && v.lines[i].who !== 'card') v.lines[i].text = speechFor(w, p, t, v.lines[i].text);
  if (dull) {
    const a = snap();
    door.regardTo(w, t, p.id, 'trust', before.tr + (a.tr - before.tr) * 0.2); door.regardTo(w, t, p.id, 'affection', before.af + (a.af - before.af) * 0.2); door.regardTo(w, t, p.id, 'respect', before.rs + (a.rs - before.rs) * 0.2);
    says(c, dull === 'week' ? 'You’ve been over this ground all week. He has nothing new to give you, and he knows you know it.' : 'You’ve covered this ground today. It doesn’t land the way it did.');
  }
  // friendly talk alone has a ceiling: past "knows you well", trust comes from what is done for a man, not how often you drink with him
  if (act.social) {
    const q = peek(t, p.id); let capped = false;
    if (q.trust > 0.6 && q.trust > before.tr) { door.regardTo(w, t, p.id, 'trust', Math.max(before.tr, 0.6)); capped = true; }
    if (q.affection > 0.8 && q.affection > before.af) { door.regardTo(w, t, p.id, 'affection', Math.max(before.af, 0.8)); capped = true; }
    if (capped && before.tr >= 0.55) says(c, 'There’s a point past which talk doesn’t move a man. The rest has to be earned.');
  }
  act.conduct?.(c, before);
  // now and then he mentions something that really happened between them, before his answer (not in the middle of a matter)
  if (!dull && !inSubject && !/^(enc|x|mv|mt|nm|favcall|confront|tk|apx|jobtake|jobpass|m|mt_open|job|enc_open)(:|$)/.test(code) && !['biz_none', 'sit', 'amends', 'think', 'b_envelope'].includes(code) && v.lines.length > from) {
    const m = door.recall(w, p, t);
    if (m) v.lines.splice(from, 0, { who: 'him', text: m.line });
  }
  // a matter running between them: what was said goes on its record, so where it stands can be shown
  const st = STORY[base];
  if (st && storyLive(c)) {
    if (st[0] === 'amends' || st[0] === 'disputes') door.touched(w, p, t, `${p.name} spoke to ${t.name}: “${label}”.`);
    const k = storyKey(c, st[0]);
    if (k && !['cr_cash', 'cr_duties'].includes(base)) door.happened(w, { kind: 'favour', actor: p.id, victim: t.id, story: k, minor: true, text: `${p.name} spoke to ${t.name}: “${label}”.`, district: t.district }, { witnesses: [p.id, t.id] });
  }
  // he does not say the same thing twice in a visit: a long line already said is dropped, and if that leaves no answer he says so
  // (only a thing the player has already put to him in this visit is "again"; coming back to something he raised himself, or making a
  // new point that happens to get the same answer, gets the answer said as a man restates himself)
  {
    const prev = new Set(v.th.spoken), mine = v.lines.slice(from), kept = mine.filter((l) => l.who === 'you' || l.who === 'card' || l.text.length <= 30 || !prev.has(l.text));
    if (kept.length !== mine.length) {
      v.lines.splice(from); v.lines.push(...kept);
      if (!kept.some((l) => l.who === 'him')) {
        const again = picked0.includes('a:' + code), dropped = mine.find((l) => l.who === 'him' && prev.has(l.text));
        if (!again && dropped) v.lines.push({ ...dropped, text: prev.has(restate(dropped.text)) ? '“My answer’s the same.”' : restate(dropped.text) });
        else { const alr = vsay(w, t, p, 'already'); says(c, prev.has(alr) ? 'He has nothing more to say on it.' : alr); }
      }
    }
    v.th.spoken = [...v.th.spoken, ...v.lines.slice(from).filter((l) => l.who === 'him' && l.text.length > 30).map((l) => l.text)].slice(-60);
  }
  // asked the same thing and answered the same way, with nothing changed since: he says that, not the same words again (only what the
  // player asked: a man raising his own matter again says it again)
  {
    const saidNow = v.lines.slice(from).filter((l) => l.who === 'him').map((l) => l.text).join(' '), ak = 'ans:' + code.split(':').slice(0, 3).join(':'), was = lastOf(w, t.id, ak);
    if (label && saidNow && was && was.sig === saidNow.slice(0, 120) && w.now - was.t < 21 * 1440 && w.now - was.t > 60) {
      const keep = v.lines.slice(from).filter((l) => l.who !== 'him');
      v.lines.splice(from); v.lines.push(...keep); him(c, plain(t.id, 'again.same', { ago: agoWords(w.now, was.t) }, 'flat'));
    }
    if (saidNow) remember(w, t.id, ak, 'said', saidNow.slice(0, 120));
  }
  // what needs no words back still gets an answer, in keeping with what it was and how he is with the player
  if (!r.end && !act.nav && !act.opens && !v.lines.slice(from).some((l) => l.who === 'him' || answered(l.text, t.name.split(' ')[0]))) says(c, ackLine(w, t, p, v.lines.length - from, SOCIAL_ACK.has(base)));
  // what changed, as a card
  {
    const a = snap(), bits: string[] = [];
    const arrow = (d: number, name: string) => { if (Math.abs(d) < 0.004) return; const big = Math.abs(d) >= 0.08; bits.push(`${name} ${d > 0 ? (big ? '▲▲' : '▲') : big ? '▼▼' : '▼'}`); };
    arrow(a.tr - before.tr, 'Trust'); arrow(a.af - before.af, 'Warmth'); arrow(a.rs - before.rs, 'Respect'); arrow(-(a.gr - before.gr), 'Goodwill');
    if (a.cash !== before.cash) bits.push(`${a.cash > before.cash ? '+' : '−'}${money(Math.abs(a.cash - before.cash))}`);
    if (a.st !== before.st) bits.push(`Standing ${a.st > before.st ? '▲' : '▼'}`);
    if (a.ht !== before.ht) bits.push(`Heat ${a.ht > before.ht ? '▲' : '▼'}`);
    if (bits.length && v.lines.length > from) v.lines.push({ who: 'card', text: bits.join('  ·  ') });
  }
  // he remembers what he was asked, and what it stood on, for next time
  if (act.repeat && v.lines.length > from && !r.skip) (t.talk ??= {})[tkey] = { d: day0, sig: act.repeat.sig(c, arg), n: 1 };
  { const m = t.talk ?? {}, ks = Object.keys(m); if (ks.length > 18) delete m[ks.sort((x, y) => m[x].d - m[y].d)[0]]; }
  if (!act.nav && !act.opens) used.push(key);
  reached(w); // (what was said may have done what a man's work asked for: an owner agreeing to pay)
  if (r.end || r.meeting || act.nav) return { ...r, minutes: r.minutes ?? 10 };
  return { ...r, minutes: r.minutes ?? 10, ...govern(c, code, from) };
}

// His patience with this conversation: his temperament and how he sees the player set how much he will take; pressure, and going over
// the same ground, use it up; ordinary talk barely does. Worn thin, or angry over a matter in hand, he turns cold; used up, he ends it.
function govern(c: Ctx, code: string, from: number): { end?: boolean; cold?: boolean; next?: Offer[] } {
  const { w, h: p, n: t, v } = c, th = v.th, tp = temper(t), vw = viewOf(w, t, p);
  const start = th.patience ?? clamp(3.5 + tp.agreeable * 2 + vw.trust * 2 + vw.affection * 1.5 + vw.fear * 1.5 - tp.volatility - vw.resent * 2.5, 1.5, 9);
  const already = v.lines.slice(from).some((l) => /already|nothing more to say|heard it before|We’ve been over this|You keep saying/.test(l.text));
  const cost = (PUSHY.test(code) ? 1.1 + tp.pride * 0.7 + tp.volatility * 0.7 + (/:force$/.test(code) ? 1.5 : 0) : ACT_OPENS(code) ? 0 : 0.12) + (already ? 0.6 : 0);
  const left = start - cost;
  th.patience = left;
  const angry = openAsks(w).some((s) => s.terms?.by === p.id && s.terms?.of === t.id && (s.st?.[t.id]?.anger ?? 0) > 0.45);
  if ((angry || left < 1) && !th.cold) {
    th.cold = true;
    if (left > 0 && !th.raised.includes('cold')) { th.raised.push('cold'); says(c, PUSHY.test(code) ? (vw.fear > 0.45 || tp.caution > 0.6 ? 'He says nothing. He is waiting for you to go.' : tp.volatility > 0.55 ? '“You’ve said your piece. Now go.”' : 'He has stopped looking at you.') : tp.agreeable > 0.55 ? '“Is there anything else? I have things to do.”' : tp.volatility > 0.55 ? '“Are we done here?”' : 'He has stopped looking at you.'); }
  }
  if (left <= 0) {
    if (vw.fear > 0.55) { says(c, 'He says nothing more. He is waiting for you to go.'); th.shut = true; return { cold: true }; }
    says(c, tp.volatility + tp.pride > 1.15 ? '“That’s enough. Get out.”' : tp.agreeable > 0.55 ? '“I think we’ve said all there is to say today.”' : '“We’re finished. Good day.”');
    if (tp.volatility > 0.5 || vw.resent > 0.3) door.cool(p, `shut:${t.id}`, w.now + 1440);
    return { end: true };
  }
  // he breaks in with what he came to say, once, if the player has not got to it
  const his = asksOf(w, t)[0];
  if (his && !th.raised.includes(his.id) && v.topic !== 'enc:' + his.id && !code.startsWith('enc:')) {
    says(c, tp.agreeable > 0.55 ? 'Before you can go on, he raises something of his own.' : 'He cuts across you.');
    if (his.lines.at(-1)) says(c, his.lines.at(-1)!);
    th.raised.push(his.id);
    v.topic = 'enc:' + his.id;
    return { next: ACTS.enc?.offersFor?.(c, his.id) };
  }
  return {};
}

// what he does when what was said needs no words back (the old engine's ack)
function ackLine(w: World, t: Character, p: Character, n: number, social: boolean): string {
  const tp = temper(t), r = t.rels[p.id];
  const pool = (r?.grudge ?? 0) >= 0.4 ? ['He says nothing. He doesn’t have to.', 'He looks at you a long moment, and says nothing.']
    : social ? (tp.agreeable + tp.empathy > 1.1 ? ['He seems glad of the company.', 'He laughs, and some of the stiffness goes out of him.'] : tp.caution > 0.6 ? ['He listens more than he talks.', 'He keeps his own counsel, but he stays.'] : ['He nods along.', 'He seems to enjoy it, in his way.'])
    : tp.volatility + tp.pride > 1.15 ? ['He grunts.', '“Fine.”']
    : tp.agreeable + tp.empathy > 1.1 ? ['He nods. “Thank you.”', '“That’s fair.”']
    : tp.caution > 0.6 ? ['He nods slowly, giving nothing away.', '“I understand.”'] : ['He nods.', '“All right.”'];
  return pool[(n + t.id.length + Math.floor(w.now / 60)) % pool.length];
}
