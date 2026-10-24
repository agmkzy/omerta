// Business and money (Gate 4, from the old engine's business, shop, debt and envelope leaves, and its matters): how business is, what
// is earned and owed, a share passed up, partnerships, a shop's fee and its haggle, protection, loans either way, buying and selling, a
// debt, the boss's envelope; and a matter between them (asks.ts), with its moves, his points and the figure the player names. Each:
// what can be put to him now (the old engine's conditions), his decision in the layer's record, what it does through doors.ts.
import { ASKS, askBetween, openAsks, playerMoves, titleOf as mTitle } from '../../asks';
import { envelopeDue, envelopeText, kickWindow, rateView } from '../../books';
import { clamp, ownerBiz } from '../../core';
import { crewEnvelopesWaiting } from '../../crewlife';
import { evidence, owedOf, priceOf, stakeRoom } from '../../econ';
import { classOf, replies as exReplies } from '../../exchange';
import { jobSaid } from '../../jobs';
import { matterTitle, topicsWith } from '../../matters';
import { feePosition, goodFaith, r5 } from '../../negotiate';
import { lateOf } from '../../people';
import { OPS, lineOf } from '../../rackets';
import { askAbout as sitAsk, sitOf } from '../../situations';
import { temper } from '../../temper';
import { arch } from '../../voice';
import { subjectsOf } from '../../talk';
import { DAY, type Character, type Id, type Situation, type World } from '../../types';
import * as door from '../doors';
import { chance, settled, term } from '../decide';
import type { Act, Ctx, Offer } from '../kit';
import { first, line, out, R, T, tweak, voice } from './common';
import { incidentsOf, told } from './words';
import { said } from './personal';
import { ACTS } from '.';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const offer = (c: Ctx, code: string, label: string, note?: string, kind?: Offer['kind']): Offer => ({ code, label: said(c, code, label), note, kind });
const isBoss = (c: Ctx) => c.n.id === c.h.bossId;
const crewMan = (c: Ctx) => c.n.bossId === c.h.id;
const debtsWith = (c: Ctx) => c.w.debts.filter((d) => d.status === 'active' && ((d.creditor === c.h.id && d.debtor === c.n.id) || (d.creditor === c.n.id && d.debtor === c.h.id)));
const collector = (c: Ctx) => ownerBiz(c.w, c.n.id)?.protection?.collectorId === c.h.id;
const asked = (c: Ctx, k: string) => c.v.th.asked.includes(k);
const ask = (c: Ctx, k: string) => { c.v.th.asked.push(k); };

// ---------------------------------------------------------------- "How's business?": one way to ask, for whatever his business is
// (his shop or racket on his mind is a subject of his own, talk.ts; his trouble, if he hasn't told it; the shop that pays the player; his
// trade or racket; a man of the player's who brings him his money; or a man with no business of his own)
export function bizCode(c: Ctx): string {
  const { w, h: p, n: t } = c, b = ownerBiz(w, t.id), sit = sitOf(w, t.id);
  const subj = subjectsOf(w, p, t).slice(0, 6).find((x) => /^(shop|racket)\b/.test(x.key));
  const was = (c.v.th.used ?? []).find((u) => /^tk:(shop|racket)\b/.test(u) || ['sit_ask', 'sh_how', 'op', 'earn', 'biz_none'].includes(u));
  if (was) return was;
  if (subj) return 'tk:' + subj.key;
  if (sit && sit.kind !== 'ambition' && !sit.told && !sit.knows && (p.cooldown[`sitask:${t.id}`] ?? 0) <= w.now) return 'sit_ask';
  if (b?.protection?.collectorId === p.id) return 'sh_how';
  if (b || lineOf(w, t)) return 'op';
  return 'biz_none';
}
const howsBusiness = (c: Ctx, code: string): Offer[] => (bizCode(c) === code ? [offer(c, code, 'How’s business?', undefined, 'other')] : []);

const op: Act = {
  base: 'op', pane: 'business', social: true,
  repeat: { window: 6, sig: (c) => { const b = ownerBiz(c.w, c.n.id); return b ? [Math.floor(b.cash / 250), b.distress > 0, b.protection?.late ?? 0, b.protection?.collectorId ?? '', incidentsOf(c.w, c.n).length].join('|') : String(c.n.books.history.length); } },
  offers: (c) => howsBusiness(c, 'op'),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x), b = ownerBiz(w, t.id);
    if (b) {
      line(x, b.cash < 200 ? `"${b.name} is barely keeping up."` : `"${b.name} is doing all right."`);
      if (b.protection) {
        const col = w.chars[b.protection.collectorId];
        if (b.protection.collectorId === t.id || b.protection.fee <= 0) c.v.lines.push({ who: 'narr', text: w.rng.pick([`It’s a family place. Nobody leans on ${t.name} for it. He answers to his own people.`, `${b.name} is the family’s own. No envelope changes hands, only favours.`]) });
        else c.v.lines.push({ who: 'narr', text: w.rng.pick([`He pays ${col?.name ?? 'someone'} of the ${w.fam[b.protection.familyId].name} family ${money(b.protection.fee)} a week, and he says it like the weather.`, `Every week an envelope goes to ${col?.name ?? 'someone'}, ${w.fam[b.protection.familyId].name} family. ${money(b.protection.fee)}. He doesn’t enjoy it.`]) });
      }
      // trouble at his place, said to a man he trusts enough: the talk turns to it
      const inc = incidentsOf(w, t).find(({ f }) => f.business === b.id || f.victim === t.id);
      if (inc && r.trust >= 0.3) {
        const k = t.known[inc.f.id];
        line(x, `Then, almost as an afterthought: "${told(w, t, inc.f, k.knowsActor)}"`, settled(t.id, 'tells you', `he trusts you enough (${r.trust.toFixed(2)} ≥ 0.3)`));
        if (!p.known[inc.f.id]) door.learnFrom(w, p, inc.f, t.id, k.knowsActor);
        c.v.th.fact = inc.f.id; c.v.th.asked = []; c.v.th.denied = false;
        return { minutes: 30, next: incQuestions(c) };
      }
      const ls: string[] = []; door.confide(w, p, t, ls); for (const l of ls) line(x, l);
    } else {
      const hh = t.books.history.at(-1);
      line(x, voice(x, hh && hh.gross > 200 ? 'biz_good' : 'biz_quiet'));
      // a side line of his own, told only to a man he trusts a good deal, and then only half the time
      if (t.books.side && !t.books.sideKnown && r.trust > 0.6) {
        const d = chance(w, t.id, 'tells you about it', 'keeps it to himself', [term('a man he trusts (> 0.6), half the time', 0.5)]);
        if (d.yes) { line(x, 'Then he leans in. "I’ve got something going on the side. You didn’t hear it from me."', d); door.sideRevealed(w, t, p); }
      }
    }
    tweak(x, 0.01);
    return out(25);
  },
};
const incQuestions = (c: Ctx) => ACTS.inc?.questions?.(c) ?? [];
const bizNone: Act = {
  base: 'biz_none', pane: 'business',
  offers: (c) => howsBusiness(c, 'biz_none'),
  run: (c) => {
    const x = T(c), tp = temper(x.t);
    line(x, x.t.rank === 'civilian' ? (tp.agreeable > 0.55 ? '“Business? I work for other people. It pays the rent, mostly.”' : '“What business? I get by.”') : tp.caution > 0.6 ? '“I do what I’m asked. The less said, the better.”' : tp.pride > 0.62 ? '“Better than some people think.”' : '“I keep busy. You know how it is.”');
    return out(10);
  },
};
const earnA: Act = {
  base: 'earn', pane: 'business',
  repeat: { window: 7, sig: (c) => [c.n.books.history.length, c.n.books.arrears, c.h.books.arrears, c.w.debts.filter((d) => d.status === 'active' && (d.creditor === c.n.id || d.debtor === c.n.id)).reduce((a, d) => a + d.balance, 0)].join('|') },
  // (your own man's money is what Sunday and the crew screen show: not asked of him; your boss, or a man there is money owed with)
  offers: (c) => (!crewMan(c) && (isBoss(c) || debtsWith(c).length) ? [offer(c, 'earn', isBoss(c) ? 'Discuss earnings' : 'Discuss what’s owed')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (t.bossId === p.id) {
      const hh = t.books.history.slice(-2);
      line(x, hh.length ? voice(x, 'earn_paid', { X: money(hh[hh.length - 1].paid) }) : voice(x, 'earn_none'));
      if (t.books.arrears > 0) line(x, voice(x, 'earn_behind', { X: money(t.books.arrears) }));
      const fl = p.books.flags[t.id];
      if (fl?.amt) line(x, voice(x, 'earn_flag', { X: money(Math.round(fl.amt)) }));
    } else if (t.id === p.bossId) {
      const b = p.books;
      line(x, voice(x, 'earn_open'));
      line(x, `“${Math.round(p.kickRate * 100)} cents in the dollar comes to me. ${b.arrears > 0 ? `You’re behind by ${money(b.arrears)}. Fix it.` : 'You’re square with me.'}”`);
    } else for (const d of debtsWith(c)) line(x, d.creditor === p.id ? (d.missed ? `“I know. I’m behind. ${money(d.balance)} still. I’ll catch up.”` : `“${money(d.weeklyPayment)} a week, every week. I haven’t missed.”`) : `“You still owe me ${money(d.balance)}. Don’t forget it.”`);
    return out(25);
  },
};
// ---------------------------------------------------------------- a matter opened: what he says is in it, and what can be said back
// (rate, protect, borrow, buy, stake, run, sell, lend: each a matter between them, asks.ts; the old engine opened it the same way)
const rateAskA: Act = {
  base: 'rate_ask', pane: 'business',
  offers: (c) => (isBoss(c) && (c.h.cooldown['rate:ask'] ?? 0) <= c.w.now ? [offer(c, 'rate_ask', 'Ask for a smaller share', 'He may say yes. He remembers being asked.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (t.id !== p.bossId) return out(5);
    door.cool(p, 'rate:ask', w.now + 4 * 7 * DAY);
    const s = askBetween(w, 'rate', p.id, t.id) ?? door.askRate(w, p, t);
    if (!s) { c.v.lines.push({ who: 'narr', text: p.kickRate <= rateView(w, p, t).floor + 0.001 ? `${first(t)} points out you already pass up less than most. There's nothing left to give.` : `${first(t)}: “We had this conversation. Give it a while.”` }); return out(10); }
    for (const l of door.matterMove(w, p, s.id, 'ask').lines) line(x, l);
    return { minutes: 30, next: matterRows(c, s.id) };
  },
};
const partnerChop: Act = {
  base: 'partner_chop', pane: 'business',
  offers: (c) => { const b = ownerBiz(c.w, c.n.id); return b?.kind === 'garage' && !c.w.ventures.some((v) => v.open && v.ownerId === c.h.id) && c.h.cash >= 2000 ? [offer(c, 'partner_chop', 'Propose a chop shop partnership', '$2,000 up front; he gets 30%.')] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (p.cash < 2000) { c.v.lines.push({ who: 'narr', text: 'You don’t have $2,000.' }); return out(10); }
    const b = ownerBiz(w, t.id)!;
    const d = chance(w, t.id, 'takes it on', 'turns it down', [term('base', 0.85), term('his caution × −0.3', -t.traits.caution * 0.3)], 0.4, 0.9);
    if (d.yes) { door.chopShop(w, p, t, b); line(x, `${t.name} gives you the back bay at ${b.name}. Bring it cars; it clears two a week.`, d); }
    else line(x, `${t.name} thinks about it and shakes his head. "Too hot."`, d);
    return out(40);
  },
};
const partnerFence: Act = {
  base: 'partner_fence', pane: 'business',
  offers: (c) => (ownerBiz(c.w, c.n.id)?.kind === 'pawnshop' ? [offer(c, 'partner_fence', 'Ask if he would move some goods for you')] : []),
  run: (c) => { const x = T(c), { w, t } = x, n0 = w.jobs.length; door.fenceWork(w, t); line(x, w.jobs.length > n0 ? `${t.name} has something in mind. ${jobSaid(w.jobs.at(-1)!)}` : `${t.name} says it’s quiet at the moment.`); return out(25); },
};
// ---------------------------------------------------------------- the shop that pays the player: its fee, cut or raised, and the haggle
const termsCut: Act = {
  base: 'terms_cut', pane: 'business',
  offers: (c) => (collector(c) ? [offer(c, 'terms_cut', 'Offer to cut his protection fee 25%', 'Buys goodwill, costs money.')] : []),
  conduct: (c) => door.conduct(c.h, 'deals'),
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!;
    if ((p.cooldown['cut:' + b.id] ?? 0) > w.now) { line(x, '“You did that for me not long ago. Don’t spoil it.”'); return out(5); }
    const { now } = door.cutFee(w, p, t, b);
    tweak(x, 0.06, 0.04, 0.03);
    const A = arch(t);
    if (A === 'schemer' || A === 'proud' || A === 'bitter') {
      line(x, A === 'proud' ? '“I didn’t ask for charity.” He looks at the figure for a long moment. “I’ll take it. I won’t forget it.”' : A === 'schemer' ? `${t.name} turns it over. “Fine. What do you want for it?”` : `“Now it’s ${money(now)}. What’s the catch?”`);
      return out(20, [{ code: 'deal:nothing', label: 'Nothing. It’s fair', note: 'He’ll respect it.' }, { code: 'deal:remember', label: 'Just remember it when I ask', note: 'He owes you a favour. You can’t choose when.' }]);
    }
    line(x, `${t.name} didn’t expect that. “Fair enough. You won’t regret it.”`);
    return out(20);
  },
};
const termsRaise: Act = {
  base: 'terms_raise', pane: 'business',
  offers: (c) => (collector(c) ? [offer(c, 'terms_raise', 'Tell him the fee is going up 25%')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!;
    const fee = b.protection!.fee, want = r5(fee * 1.25), pos = feePosition(b), X = money(want);
    c.v.lines.push({ who: 'narr', text: `You tell ${first(t)} the fee is going up to ${X} a week.` });
    // whether the shop can bear it decides his answer (negotiate.feePosition): he takes it, offers less, or can't or won't
    if (want <= pos.cap) {
      door.setFee(w, p, t, b, want, 'agreement', `The weekly fee went from ${money(fee)} to ${X}.`, `${p.name} raised ${b.name}’s weekly fee from ${money(fee)} to ${X}.`);
      tweak(x, -0.04, -0.03, 0.01);
      line(x, voice(x, 'fee_accept', { X }), settled(t.id, 'accepts', `the shop can bear ${X} (up to ${money(pos.cap)})`));
      return out(15);
    }
    const counter = r5(Math.min(want - 5, Math.max(fee * 1.08, pos.cap)));
    c.v.th.deal = { kind: 'fee', biz: b.id, ask: want, old: fee };
    if (!pos.strained && counter > fee) {
      c.v.th.deal.offer = counter;
      line(x, voice(x, 'fee_counter', { X, Y: money(counter) }), settled(t.id, 'counters', `the shop bears ${money(pos.cap)}, not ${X}`));
      return out(10, [{ code: 'deal:take', label: `Settle at ${money(counter)}`, note: 'He keeps his dignity. You keep the peace.' }, { code: 'deal:hold', label: `It’s ${X}, or there’s trouble`, note: 'He may give in. He won’t forget it.' }, { code: 'deal:drop', label: 'Leave it as it is, then' }]);
    }
    line(x, voice(x, pos.strained ? 'fee_cant' : 'fee_wont'), settled(t.id, pos.strained ? 'cannot' : 'will not', pos.strained ? 'the shop is strained' : 'nothing between his fee and what you ask'));
    return out(10, [{ code: 'deal:hold', label: 'It isn’t a request', note: pos.strained ? 'He really may not have it.' : 'He may give in. He won’t forget it.' }, { code: 'deal:drop', label: 'All right. For now' }]);
  },
};
// the haggle's answers (nav: they belong to what was just said, and cost him no patience)
const deal: Act = {
  base: 'deal', pane: 'business', nav: true,
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, dl = c.v.th.deal, what = code.split(':')[1], r = R(x);
    // (as in the old engine, nothing is in hand after a fee is cut, so "nothing for it" and "remember it" only close the subject: the
    // favour the second promises is never written. Kept for parity; reported as a defect of the old engine, Gate 4 report §limitations)
    if (!dl) { line(x, temper(t).agreeable > 0.5 ? '“Whenever you’re ready. You don’t owe me anything.”' : 'He nods. “Another time.”'); return out(3); }
    if (what === 'nothing') { tweak(x, 0.03, 0.02, 0.03); line(x, `${t.name} nods, and the suspicion goes out of him a little. “Then thank you.”`); return out(5); }
    if (what === 'remember') { door.owe(w, p, t, 1, 'cut his weekly fee'); line(x, `“I’ll remember,” says ${t.name}, and you can see he means it.`); return out(5); }
    const b = dl.biz ? w.biz[dl.biz] : undefined;
    if (what === 'drop') { c.v.lines.push({ who: 'narr', text: `You let it lie. ${t.name} watches you do it.` }); c.v.th.deal = undefined; return out(5); }
    if (dl.kind === 'fee' && b?.protection) {
      const pos = feePosition(b);
      c.v.th.deal = undefined;
      if (what === 'take') {
        door.setFee(w, p, t, b, dl.offer!, 'agreement', `The weekly fee went from ${money(dl.old!)} to ${money(dl.offer!)}, after some haggling.`, `${p.name} and ${t.name} settled ${b.name}’s weekly fee at ${money(dl.offer!)}.`);
        tweak(x, 0.01, 0, 0.02);
        c.v.lines.push({ who: 'narr', text: `You settle on ${money(dl.offer!)}. ${t.name} lets out a breath and shakes your hand.` });
        return out(15);
      }
      // pressed: he gives in only if the shop can bear it and he fears or respects the player enough; otherwise he refuses, on record
      const bearable = dl.ask <= pos.cap * 1.3 && !pos.strained;
      const d = bearable ? chance(w, t.id, 'gives in', 'refuses', [term('base', 0.3), term('his respect for you − 0.3, × 0.6', (r.respect - 0.3) * 0.6), term('0.6 − his courage, × 0.5', (0.6 - t.traits.courage) * 0.5)], 0.1, 0.85) : settled(t.id, 'refuses', 'the shop could not bear it');
      if ((d as { yes?: boolean }).yes) {
        door.setFee(w, p, t, b, dl.ask, 'threat', `You leaned on him until the weekly fee went from ${money(dl.old!)} to ${money(dl.ask)}.`);
        tweak(x, -0.08, -0.05, 0.0); door.grudge(w, t, p.id, 0.08, `${p.name} leaned on him to pay more`);
        line(x, voice(x, 'fee_press_yes', { X: money(dl.ask) }), d);
      } else {
        tweak(x, -0.1, -0.06, -0.01); door.grudge(w, t, p.id, 0.15, `${p.name} leaned on him to pay more`);
        line(x, voice(x, 'fee_press_no'), d); door.refusedMore(w, t, p, b);
      }
      return out(15);
    }
    if (dl.kind === 'ext' && what === 'part') {
      const debt = w.debts.find((q) => q.id === dl.debt && q.status === 'active');
      if (!debt) return out(3);
      if (p.cash < dl.offer!) { c.v.lines.push({ who: 'narr', text: 'You haven’t got it on you.' }); return out(5); }
      door.payForTime(w, debt, dl.offer!);
      c.v.lines.push({ who: 'narr', text: `You put ${money(dl.offer!)} on the table. ${t.name} counts it, nods, and gives you the week.` });
      tweak(x, 0.02, 0, 0.02); c.v.th.deal = undefined;
      return out(10);
    }
    return out(3);
  },
};
// protection put to a shop the player may not take on as the layer's own (that is visit.doProtect): opened as a matter
const suggest: Act = {
  base: 'suggest', pane: 'business',
  offers: (c) => { const b = ownerBiz(c.w, c.n.id); return b && b.protection?.familyId !== c.h.familyId && c.n.rank === 'civilian' && !askBetween(c.w, 'protect', c.h.id, c.n.id, b.id) && !PROTECT_OWN(c) ? [offer(c, 'suggest', 'Suggest he could use some friends', 'Opens the protection conversation.')] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!;
    c.v.lines.push({ who: 'narr', text: 'You steer the conversation toward the neighbourhood and who watches over it.' });
    const s = askBetween(w, 'protect', p.id, t.id, b.id) ?? door.openMatter(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round((b.income * 0.07) / 5) * 5), why: `${p.name} offered to look after ${b.name}` });
    if (!s) { c.v.lines.push({ who: 'narr', text: `${t.name} has had enough people at his door this week.` }); return out(20); }
    for (const l of door.matterMove(w, p, s.id, 'ask').lines) line(x, l);
    return { minutes: 35, next: matterRows(c, s.id) };
  },
};
// (set by visit.ts: where protection may be put to this shop as the layer's own, "suggest" is not offered beside it)
let PROTECT_OWN: (c: Ctx) => boolean = () => false;
export const protectOwnedBy = (f: (c: Ctx) => boolean) => { PROTECT_OWN = f; };
const borrow: Act = {
  base: 'borrow', pane: 'business',
  offers: (c) => (c.n.rank !== 'civilian' && c.n.cash >= 1500 && (c.n.rels[c.h.id]?.trust ?? 0) >= 0.4 ? [offer(c, 'borrow', 'Ask to borrow money', 'You name the figure. He decides what he can spare, and on what terms.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (w.debts.some((d) => d.status === 'active' && d.creditor === t.id && d.debtor === p.id)) { line(x, voice(x, 'loan_first')); return out(10); }
    const open = askBetween(w, 'borrow', p.id, t.id);
    if (!open && (p.cooldown['borrow:' + t.id] ?? 0) > w.now) { line(x, voice(x, 'loan_again')); return out(10); }
    const s = open ?? door.openMatter(w, 'borrow', p, t, { amt: 1000, why: `${p.name} asked ${t.name} for a loan` });
    if (!s) { line(x, voice(x, 'loan_again')); return out(10); }
    door.cool(p, 'borrow:' + t.id, w.now + 14 * DAY);
    c.v.lines.push({ who: 'narr', text: `You ask ${first(t)} for ${money(s.terms?.amt ?? 1000)}.` });
    for (const l of door.matterMove(w, p, s.id, 'ask').lines) line(x, l);
    return { minutes: 25, next: matterRows(c, s.id) };
  },
};
const buyable = (c: Ctx) => { const b = ownerBiz(c.w, c.n.id); return b && b.open && b.kind !== 'casino' && b.ownerId === c.n.id && !askBetween(c.w, 'buy', c.h.id, c.n.id, b.id) ? b : undefined; };
const buyAsk = (stake: boolean): Act => ({
  base: stake ? 'stake_ask' : 'buy_ask', pane: 'business',
  offers: (c) => { const b = buyable(c); return !b ? [] : stake ? (stakeRoom(b) >= 0.25 ? [offer(c, 'stake_ask', 'Offer to buy a piece of it', 'A quarter of the place for money down: a share of what it makes every week.')] : []) : [offer(c, 'buy_ask', 'Ask whether he would sell the place', 'You name a price. He answers from what it is worth and what trouble he is in.')]; },
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!, share = stake ? 0.25 : undefined, full = priceOf(w, b), first0 = Math.round((share ? full * share : full) * 0.85 / 50) * 50;
    const s = door.openMatter(w, 'buy', p, t, { biz: b.id, amt: first0, share, why: `${p.name} wants to buy ${share ? 'a piece of ' : ''}${b.name}` });
    if (!s) { c.v.lines.push({ who: 'narr', text: `${first(t)} has too much on his mind for that today.` }); return out(10); }
    c.v.lines.push({ who: 'narr', text: share ? `You ask ${first(t)} whether he would sell a quarter of ${b.name}.` : `You ask ${first(t)} whether he would sell ${b.name}.` });
    line(x, `“${share ? 'A piece? What did you have in mind?' : 'Depends what you’re offering.'}”`);
    return { minutes: 25, next: matterRows(c, s.id) };
  },
});
const opOf = (c: Ctx) => c.w.ops.find((o) => o.owner === c.n.id && o.kind !== 'hijack' && o.state === 'running' && o.runner !== c.h.id);
const runAsk: Act = {
  base: 'run_ask', pane: 'business',
  offers: (c) => { const o = opOf(c); return o && !c.n.isPlayer && !askBetween(c.w, 'run', c.h.id, c.n.id) ? [offer(c, 'run_ask', `Offer to run his ${OPS[o.kind as keyof typeof OPS]?.label.toLowerCase() ?? 'operation'}`, 'You name your cut of the take. He weighs what he thinks of you and whether he has a man on it.')] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x, o = opOf(c);
    if (!o) return out(5);
    const s = door.openMatter(w, 'run', p, t, { what: o.id, about: o.id, amt: 15, why: `${p.name} offered to run ${t.name}'s operation` });
    if (!s) { c.v.lines.push({ who: 'narr', text: `${first(t)} has too much on his mind for that today.` }); return out(10); }
    c.v.lines.push({ who: 'narr', text: `You tell ${first(t)} you could run it for him.` });
    line(x, '“And what would you want for it?”');
    return { minutes: 20, next: matterRows(c, s.id) };
  },
};
const mineToSell = (c: Ctx) => Object.values(c.w.biz).find((b) => b.open && b.ownerId === c.h.id && b.kind !== 'casino');
const sellAsk: Act = {
  base: 'sell_ask', pane: 'business',
  offers: (c) => { const b = mineToSell(c); return b && c.n.cash >= 1000 && !c.n.isPlayer && !askBetween(c.w, 'sell', c.h.id, c.n.id, b.id) ? [offer(c, 'sell_ask', `Offer him ${b.name}`, 'You name a price. He weighs what it is worth to him and whether he has the money.')] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = mineToSell(c);
    if (!b) return out(5);
    const s = door.openMatter(w, 'sell', p, t, { biz: b.id, amt: Math.round(priceOf(w, b) * 1.1 / 50) * 50, why: `${p.name} offered ${t.name} ${b.name}` });
    if (!s) { c.v.lines.push({ who: 'narr', text: `${first(t)} has too much on his mind for that today.` }); return out(10); }
    c.v.lines.push({ who: 'narr', text: `You tell ${first(t)} ${b.name} could be his, for the right money.` });
    line(x, '“What are you asking?”');
    return { minutes: 25, next: matterRows(c, s.id) };
  },
};
const offerLoan: Act = {
  base: 'offer_loan', pane: 'business',
  offers: (c) => (ownerBiz(c.w, c.n.id) && c.n.rank === 'civilian' && c.h.cash >= 200 && !c.w.debts.some((d) => d.status === 'active' && d.debtor === c.n.id) ? [offer(c, 'offer_loan', 'Offer him a loan', 'You name the amount and the weekly rate. He takes it if he needs it and the terms are fair.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!;
    const need = Math.max(100, Math.min(p.cash, Math.round(Math.max(500, b.expense * 1.5 - b.cash) / 50) * 50));
    const s = door.openMatter(w, 'lend', p, t, { biz: b.id, amt: need, rate: 0.05, why: `${p.name} offered ${t.name} a loan` });
    if (!s) { line(x, '“I appreciate it. Not now.”'); return out(10); }
    c.v.lines.push({ who: 'narr', text: `You tell ${first(t)} you could lend him something, if it would help.` });
    line(x, '“What kind of terms?”');
    return { minutes: 20, next: matterRows(c, s.id) };
  },
};
// ---------------------------------------------------------------- the shop that pays the player: how it does, why it is late, what he
// hears, a week's envelope handed back, a week's grace, leaning on him
const shopBiz = (c: Ctx) => { const b = ownerBiz(c.w, c.n.id); return b?.protection?.collectorId === c.h.id ? b : undefined; };
const late = (c: Ctx) => { const b = shopBiz(c); return !!b && lateOf(b) > 0; };
const shHow: Act = {
  base: 'sh_how', pane: 'business',
  offers: (c) => (shopBiz(c) && !late(c) && !asked(c, 'sh_how') ? [...howsBusiness(c, 'sh_how'), ...(bizCode(c) === 'sh_how' ? [] : [{ ...offer(c, 'sh_how', 'Ask how the shop is doing'), kind: 'between' as const }])] : []),
  run: (c, code) => shopTalk(c, code.split(':')[0] as 'sh_how'),
};
const shWhy: Act = {
  base: 'sh_why', pane: 'confront',
  offers: (c) => (late(c) && !asked(c, 'sh_why') ? [{ ...offer(c, 'sh_why', 'Ask why it’s late'), kind: 'between' }] : []),
  run: (c) => shopTalk(c, 'sh_why'),
};
function shopTalk(c: Ctx, k: 'sh_how' | 'sh_why') {
  const x = T(c), { w, t } = x, b = ownerBiz(w, t.id)!; ask(c, k);
  // what he says is a choice: a man who truly could not pay says so; a man who could have may claim he could not. What the player can
  // see for himself (the till, the street, the shelves) is what tells the two apart.
  const why = b.protection!.why;
  const d = k === 'sh_why'
    ? why === 'unable' ? settled(t.id, 'pleads hardship', 'he could not pay') : why === 'delayed' ? chance(w, t.id, 'pleads hardship', 'owns it', [term('base', 0.35), term('his greed × 0.35', t.traits.greed * 0.35), term('his courage × −0.2', -t.traits.courage * 0.2)], 0.1, 0.8) : settled(t.id, 'owns it', 'he had it and spent it')
    : settled(t.id, b.distress > 0 || b.cash < b.protection!.fee ? 'pleads hardship' : 'brightens', 'how the shop is doing');
  const bad = d.chosen === 'pleads hardship', hard = t.traits.caution > 0.5;
  line(x, bad ? (hard ? `${t.name} looks at the floor. "It has been slow. I won’t lie to you, I was hoping you wouldn’t come this week."` : `${t.name} spreads his hands. "Look around. Nobody’s buying. You want blood from a stone?"`) : k === 'sh_why' ? `${t.name} avoids your eyes. "I had it. I spent it. Stupid. It won’t happen again."` : `${t.name} brightens. "Busy. Good busy. Your name gets mentioned, you know that? People come in, they see it’s looked after."`, d);
  const ev = evidence(w, b);
  if (ev.length) c.v.lines.push({ who: 'narr', text: `You look around while he talks. ${ev.join(' ')}` });
  tweak(x, 0.02);
  return out(15, shopRows(c));
}
const shopRows = (c: Ctx): Offer[] => [shWhy, shTime, shLean, shEars, shBack].flatMap((a) => a.offers!(c)).map((o) => ({ ...o, kind: undefined }));
const shEars: Act = {
  base: 'sh_ears', pane: 'business',
  offers: (c) => (shopBiz(c) && !late(c) && !asked(c, 'sh_ears') ? [{ ...offer(c, 'sh_ears', 'Ask whether anyone else has been around'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!; ask(c, 'sh_ears');
    const f = Object.values(w.facts).filter((q) => q.business === b.id && ['vandalism', 'robbery', 'burglary', 'shake'].includes(q.kind) && w.now - q.t < 60 * DAY)[0];
    if (f) { line(x, `${t.name} lowers his voice. "Funny you ask. ${told(w, t, f, !!f.actor && !f.hiddenActor)}"`); if (!p.known[f.id]) door.learnFrom(w, p, f, t.id, !f.hiddenActor); }
    else line(x, '"Nobody. Quiet as a church. That’s what I’m paying for, no?"');
    tweak(x, 0.02);
    return out(15, shopRows(c));
  },
};
const shBack: Act = {
  base: 'sh_back', pane: 'business',
  offers: (c) => { const b = shopBiz(c); return b && !late(c) && b.distress > 0 && !asked(c, 'sh_back') ? [{ ...offer(c, 'sh_back', `Hand back this week's ${money(b.protection!.fee)}`, 'It buys loyalty you can’t buy otherwise.'), kind: 'between' }] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!; ask(c, 'sh_back');
    if (!door.handBack(w, p, b)) c.v.lines.push({ who: 'narr', text: 'You can’t afford the gesture.' });
    else { c.v.lines.push({ who: 'narr', text: `You push the envelope back across. ${t.name} stares at it. "Nobody ever did that. Nobody." He means it.` }); tweak(x, 0.12, 0.1, 0.05); }
    return out(15, shopRows(c));
  },
};
const shTime: Act = {
  base: 'sh_time', pane: 'business',
  offers: (c) => (late(c) ? [{ ...offer(c, 'sh_time', 'Give him time', 'He’ll owe you for it.'), kind: 'between' }] : []),
  run: (c) => { const x = T(c), b = ownerBiz(x.w, x.t.id)!; door.graceWeek(x.w, x.p, b); c.v.lines.push({ who: 'narr', text: `"One week," you say. ${x.t.name} nods too fast. He’ll pay, and he’ll remember who gave him the week.` }); tweak(x, 0.06, 0.04, -0.01); return out(15, shopRows(c)); },
};
const shLean: Act = {
  base: 'sh_lean', pane: 'confront',
  offers: (c) => (late(c) ? [{ ...offer(c, 'sh_lean', 'Remind him it isn’t optional', 'He pays. He remembers.'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, b = ownerBiz(w, t.id)!;
    const pay = door.leanOnShop(w, p, b);
    c.v.lines.push({ who: 'narr', text: `You say it quietly, which is worse. ${t.name} finds ${money(pay)} you both know he didn’t have to spare.` });
    tweak(x, -0.05, -0.06, 0.03); door.grudge(w, t, p.id, 0.06, `${p.name} made him pay what he could not spare`);
    return out(20, shopRows(c));
  },
};
// ---------------------------------------------------------------- money owed, either way (while the debt is not the subject of its own
// conversation, threads.ts, which it is whenever he has it on his mind)
const owedToMe = (c: Ctx) => c.w.debts.find((d) => d.status === 'active' && d.creditor === c.h.id && d.debtor === c.n.id);
const iOwe = (c: Ctx) => c.w.debts.find((d) => d.status === 'active' && d.creditor === c.n.id && d.debtor === c.h.id);
const debtDoor = (c: Ctx) => !!(owedToMe(c) || iOwe(c)) && !subjectsOf(c.w, c.h, c.n).slice(0, 10).some((s) => s.key.startsWith('debt:'));
const dOffer = (c: Ctx, code: string, label: string, note?: string): Offer[] => (debtDoor(c) && !asked(c, code) ? [{ ...offer(c, code, label, note), kind: 'between' }] : []);
const debtRows = (c: Ctx): Offer[] => DEBT.flatMap((a) => a.offers!(c)).map((o) => ({ ...o, kind: undefined }));
const dRemind: Act = {
  base: 'd_remind', pane: 'confront',
  offers: (c) => { const d = owedToMe(c); return d && (d.missed > 0 || d.nextDue - c.w.now <= DAY) ? dOffer(c, 'd_remind', 'Remind him what he owes', `${money(d.balance)}${d.missed ? `, ${d.missed} payment${d.missed > 1 ? 's' : ''} missed` : ''}.`) : []; },
  run: (c) => {
    const x = T(c), { w, t } = x, d = owedToMe(c); ask(c, 'd_remind');
    if (!d) return out(5);
    const pay = Math.min(d.weeklyPayment, Math.max(0, t.cash)), A = arch(t);
    // whether he pays when reminded: only if he has most of it, and then as far as he trusts the player
    const dd = pay >= d.weeklyPayment * 0.8 ? chance(w, t.id, 'pays', 'does not', [term('base', 0.55), term('his trust in you × 0.3', R(x).trust * 0.3)]) : settled(t.id, 'does not', `he has ${money(pay)}, short of the week`);
    if ((dd as { yes?: boolean }).yes) {
      door.payDebt(w, d, pay);
      line(x, w.rng.pick(A === 'proud' ? [`${t.name} stiffens. "You didn’t need to remind me." He pays ${money(pay)} on the spot, counting it like it hurts.`] : A === 'frightened' ? [`${t.name} goes pale and finds ${money(pay)} in his coat. "I was going to bring it, I swear."`] : [`${t.name} sighs and pays ${money(pay)}. "Fine. Fine. It was on my mind."`]), dd);
      tweak(x, -0.01, -0.01);
    } else {
      line(x, w.rng.pick(A === 'hothead' ? [`"You come to me about money like I’m a dog?" He walks off.`] : A === 'bitter' ? [`${t.name} laughs without humour. "Everybody wants something from me. You’ll get yours."`] : [`${t.name} spreads his hands. "I haven’t got it. Not this week."`]), dd);
      tweak(x, -0.04, -0.03, 0.01);
    }
    return out(15, debtRows(c));
  },
};
const dTime: Act = {
  base: 'd_time', pane: 'business',
  offers: (c) => { const d = owedToMe(c); return d?.missed ? dOffer(c, 'd_time', 'Give him more time', 'Forgives one missed payment. He’ll remember it.') : []; },
  run: (c) => { const x = T(c), d = owedToMe(c); ask(c, 'd_time'); if (d) door.debtWeek(d); c.v.lines.push({ who: 'narr', text: `"One more week," you tell ${x.t.name}. He nods and hardly breathes. A man given time is a man who owes you something other than money.` }); tweak(x, 0.08, 0.05, -0.01); return out(10, debtRows(c)); },
};
const dHalf: Act = {
  base: 'd_half', pane: 'business', conduct: (c) => door.conduct(c.h, 'forgave', 0.5),
  offers: (c) => (owedToMe(c) ? dOffer(c, 'd_half', 'Halve his weekly payment', 'It takes longer. He survives it.') : []),
  run: (c) => { const x = T(c), d = owedToMe(c); ask(c, 'd_half'); if (d) door.debtHalved(d); c.v.lines.push({ who: 'narr', text: `You cut ${x.t.name}’s weekly payment in half. He says thank you the way a drowning man says it.` }); tweak(x, 0.06, 0.04); return out(10, debtRows(c)); },
};
const dFavour: Act = {
  base: 'd_favour', pane: 'business', conduct: (c) => door.conduct(c.h, 'forgave'),
  offers: (c) => { const d = owedToMe(c); return d && d.balance >= 300 ? dOffer(c, 'd_favour', 'Write off $300 for a favour', 'He’ll owe you one, and you can’t choose when.') : []; },
  run: (c) => { const x = T(c), d = owedToMe(c); ask(c, 'd_favour'); if (d) door.debtForFavour(x.w, d); c.v.lines.push({ who: 'narr', text: `"Three hundred comes off," you tell ${x.t.name}. "One day I’ll come asking." He doesn’t ask what for. He knows better.` }); tweak(x, 0.05, 0.02, 0.02); return out(10, debtRows(c)); },
};
const dForgive: Act = {
  base: 'd_forgive', pane: 'business', conduct: (c) => door.conduct(c.h, 'forgave'),
  offers: (c) => (owedToMe(c) ? dOffer(c, 'd_forgive', 'Forgive a quarter of it', 'Goodwill, or weakness. Depends who’s watching.') : []),
  run: (c) => { const x = T(c), d = owedToMe(c); ask(c, 'd_forgive'); if (d) door.debtQuarterOff(x.w, x.p, d); else door.repute(x.w, x.p, -0.5, 'gave way'); c.v.lines.push({ who: 'narr', text: `You knock a quarter off what ${x.t.name} owes. He looks at you like he’s waiting for the catch.` }); tweak(x, 0.07, 0.05, -0.01); return out(10, debtRows(c)); },
};
const dPay = (all: boolean): Act => ({
  base: all ? 'd_all' : 'd_pay', pane: 'business',
  offers: (c) => { const d = iOwe(c); return !d ? [] : all ? (c.h.cash >= d.balance ? dOffer(c, 'd_all', `Settle it: ${money(d.balance)}`, 'It clears the debt, and what he thinks of you.') : []) : c.h.cash >= d.weeklyPayment ? dOffer(c, 'd_pay', `Pay ${money(d.weeklyPayment)} now`, 'On time, and he notices.') : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x, d = iOwe(c); ask(c, all ? 'd_all' : 'd_pay');
    if (!d) return out(5);
    const amt = all ? d.balance : Math.min(d.weeklyPayment, d.balance);
    if (p.cash < amt) { c.v.lines.push({ who: 'narr', text: 'You’re short.' }); return out(5); }
    door.payDebt(w, d, amt);
    c.v.lines.push({ who: 'narr', text: all ? `You settle it in full. ${t.name} counts, nods, and says nothing, which is the nicest thing he’s ever said to you.` : `You pay ${money(amt)} on time. ${t.name} takes it without comment, and notes it.` });
    tweak(x, all ? 0.08 : 0.04, 0.02, 0.03);
    return out(10, debtRows(c));
  },
});
const dAsk: Act = {
  base: 'd_ask', pane: 'business',
  offers: (c) => (iOwe(c) ? dOffer(c, 'd_ask', 'Ask for more time', 'He may say no.') : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, d = iOwe(c), r = R(x); ask(c, 'd_ask');
    if (!d) return out(5);
    c.v.lines.push({ who: 'narr', text: `You ask ${first(t)} for more time on what you owe him.` });
    // he weighs what the player is worth to him against what a late payment says about him
    const terms = [term('his trust in you × 0.5', r.trust * 0.5), term('his respect for you × 0.35', r.respect * 0.35), term(d.missed === 0 ? 'you have never missed' : `${d.missed} missed`, d.missed === 0 ? 0.1 : -0.1 * d.missed)];
    const score = terms.reduce((a, q) => a + q.value, 0);
    if (score >= 0.45) { door.moreTime(d); line(x, '“One week. Don’t make me ask twice.”', settled(t.id, 'gives the week', `what you are worth to him (${score.toFixed(2)} ≥ 0.45)`)); tweak(x, 0.0, 0, -0.01); return out(10, debtRows(c)); }
    if (score >= 0.2) {
      const X = goodFaith(d.balance, d.weeklyPayment);
      line(x, voice(x, 'ext_counter', { X: money(X) }), settled(t.id, 'wants money down', `what you are worth to him (${score.toFixed(2)}, between 0.2 and 0.45)`));
      c.v.th.deal = { kind: 'ext', debt: d.id, ask: 0, offer: X };
      return out(10, [{ code: 'deal:part', label: `Put down ${money(X)} now`, note: p.cash >= X ? 'It buys the week, and he sees you’re serious.' : 'You haven’t got it on you.' }, { code: 'deal:drop', label: 'I’ll find it by the due date' }]);
    }
    line(x, `${t.name} shakes his head slowly. “No. A debt that waits is a debt that grows.”`, settled(t.id, 'refuses', `what you are worth to him (${score.toFixed(2)} < 0.2)`));
    tweak(x, -0.03, -0.02, -0.03);
    return out(10, debtRows(c));
  },
};
const DEBT: Act[] = [dRemind, dTime, dHalf, dFavour, dForgive, dPay(false), dPay(true), dAsk];
// ---------------------------------------------------------------- the boss's envelope, and money over and above it
const envelope: Act = {
  base: 'b_envelope', pane: 'business',
  offers: (c) => { const due = envelopeDue(c.w, c.h); return isBoss(c) && kickWindow(c.w, c.h) && !crewEnvelopesWaiting(c.w, c.h) && due >= 20 && c.h.cash >= 20 && !asked(c, 'b_envelope') ? [{ ...offer(c, 'b_envelope', `Hand him your envelope (${money(due)})`, 'Last week’s share, in person.'), kind: 'his' }] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x; ask(c, 'b_envelope');
    const due = envelopeDue(w, p);
    c.v.lines.push({ who: 'narr', text: envelopeText(w, p) });
    for (const l of door.handOver(w, p, t, due)) line(x, l);
    // a man who brings his envelope in person gets a conversation: news, work, or a word in his manner
    const rv = w.rng.next();
    const d = { by: t.id, constraints: [], candidates: [{ move: 'news', value: 0.4, terms: [term('four times in ten', 0.4)], crosses: [] }, { move: 'work', value: 0.25, terms: [term('a quarter of the time', 0.25)], crosses: [] }, { move: 'a word', value: 0.35, terms: [term('the rest', 0.35)], crosses: [] }, { move: `(the roll: ${rv.toFixed(2)})`, value: -10, terms: [], crosses: [] }], chosen: rv < 0.4 ? 'news' : rv < 0.65 ? 'work' : 'a word' };
    if (rv < 0.4) {
      const f = Object.entries(t.known).filter(([id]) => !p.known[id] && w.facts[id] && !w.facts[id].minor && w.now - w.facts[id].t < 45 * DAY).map(([id, k]) => ({ f: w.facts[id], k }))[0];
      if (f) { door.learnFrom(w, p, f.f, t.id, f.k.knowsActor); line(x, `${t.name} leans back, and for a moment he’s almost chatty. "Since you’re here. Something you should know: ${told(w, t, f.f, f.k.knowsActor)}"`, d); }
      else c.v.lines.push({ who: 'narr', text: `${t.name} asks after your men, one by one. He listens to the answers more carefully than he lets on.` });
    } else if (rv < 0.65) {
      const n0 = w.jobs.length;
      if (door.bossWork(w) || w.jobs.length > n0) { line(x, `${t.name} puts the envelope away. "Good. While you’re here, there’s something that wants doing."`, d); line(x, jobSaid(w.jobs.at(-1)!)); }
      else c.v.lines.push({ who: 'narr', text: `${t.name} says there’s nothing for you right now, and means it as a compliment.` });
    } else line(x, ({ cold: `"You’re on time," ${t.name} says. From him, that’s a speech.`, proud: `${t.name} nods slowly. "A man who respects the arrangement. We’ll remember that."`, jovial: `${t.name} pours two coffees and asks about your week as though the envelope were an afterthought.`, schemer: `${t.name} asks who’s been doing well and who hasn’t. He wants names. You can see him writing the page.`, earnest: `${t.name} thanks you, and it sounds like he means it.`, hothead: `${t.name} grunts. "Good. Some of them make me ask twice."`, bitter: `${t.name} counts nothing. "At least somebody remembers how this is supposed to work."`, frightened: `${t.name} takes it quickly and looks at the door. He’s glad you came.` } as Record<string, string>)[arch(t)], d);
    return out(25, [extra(false), extra(true)].flatMap((a) => a.offers!(c)).map((o) => ({ ...o, kind: undefined })));
  },
};
const extra = (big: boolean): Act => ({
  base: big ? 'b_extra2' : 'b_extra', pane: 'business',
  offers: (c) => (isBoss(c) && asked(c, 'b_envelope') && !asked(c, big ? 'b_extra2' : 'b_extra') && c.h.cash >= (big ? 1000 : 250) ? [offer(c, big ? 'b_extra2' : 'b_extra', big ? 'Add $1,000 for him personally' : 'Add $250 for him personally', big ? 'A real gesture. He’ll owe you one.' : 'Over and above what’s owed. It counts.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, amt = big ? 1000 : 250; ask(c, big ? 'b_extra2' : 'b_extra');
    if (p.cash < amt) { c.v.lines.push({ who: 'narr', text: 'You’re short.' }); return out(5); }
    door.tribute(w, p, t, amt, 'over and above the envelope');
    tweak(x, big ? 0.12 : 0.05, big ? 0.06 : 0.02, 0.03);
    door.repute(w, p, big ? 3 : 1, 'tribute');
    if (big) door.owe(w, p, t, 2, 'a thousand dollars pressed into his hand with no reason given');
    c.v.lines.push({ who: 'narr', text: big ? `You add another ${money(amt)}, unasked. ${t.name} looks at it, then at you. "That’s a lot of respect." He is very still. "I’ll remember it."` : `You add ${money(amt)} on top. ${t.name} raises an eyebrow, then lets it go. "Appreciated."` });
    return out(15);
  },
});
const tributeA: Act = {
  base: 'b_tribute', pane: 'business',
  offers: (c) => (isBoss(c) && !asked(c, 'b_tribute') && c.h.cash >= 300 ? [offer(c, 'b_tribute', 'Bring him $300 for nothing in particular', 'A gesture. Men remember them.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x; ask(c, 'b_tribute');
    if (p.cash < 300) { c.v.lines.push({ who: 'narr', text: 'You’re short.' }); return out(15); }
    door.tribute(w, p, t, 300, 'for nothing in particular');
    c.v.lines.push({ who: 'narr', text: `You leave an envelope on his table. ${t.name} doesn’t open it. "For what?" "For nothing." He almost smiles. "Nothing is a good reason."` });
    tweak(x, 0.07, 0.04, 0.03); door.repute(w, p, 1, 'gift');
    return out(15);
  },
};
// ---------------------------------------------------------------- a matter between them (asks.ts): opened, moved, answered, a figure named
// What a matter is called, and where it stands, said as men say it (never the numbers behind it)
function matterOpen(w: World, s: Situation, last?: string): string {
  const b = s.biz ? w.biz[s.biz]?.name : undefined, seen = !!last;
  const L: Record<string, [string, string]> = {
    protect: [`“I want to talk to you about ${b ?? 'the place'}. About keeping it in one piece.”`, last === 'stall' ? `“You’ve had time to think about ${b ?? 'it'}.”` : last === 'counter' ? '“I’ve thought about your figure.”' : `“About ${b ?? 'the place'}. I’d like a better answer than last time.”`],
    borrow: ['“I need to borrow some money.”', '“About the loan I asked you for.”'],
    lend: ['“I could help you out with some money.”', '“About the money I offered you.”'],
    recruit: ['“I’ve got a proposition for you. Come in with me.”', '“About what I said. Coming in with me.”'],
    collect: ['“We need to talk about what you owe.”', '“About the money. Again.”'],
    favour: ['“You remember that favour.”', '“About that favour.”'],
    amends: ['“I let you down. I want to put it right.”', '“About putting things right between us.”'],
    rate: ['“I want to talk about my share.”', '“About my share.”'],
    layoff: ['“About the business with your man.”', '“About what we talked about. Leaving it alone.”'],
  };
  const x = s.ak ? L[s.ak] : undefined;
  return x ? x[seen ? 1 : 0] : `“About ${mTitle(w, s).replace(/^./, (m) => m.toLowerCase())}.”`;
}
const matterWhere = (s: Situation, t: Character) => { const S0 = s.st?.[t.id]; return S0?.last === 'counter' ? 'He named his own terms.' : S0?.last === 'stall' ? 'He asked for time.' : S0?.last === 'no' ? 'He said no, for now.' : s.m?.help ? 'He went to someone about it.' : 'Waiting on his answer.'; };
const mine = (c: Ctx) => openAsks(c.w).filter((x) => x.terms?.by === c.h.id && x.terms?.of === c.n.id);
// what can be said to a matter in hand: answers to the point he has just made, then the plain moves that still make sense, the figure
export function matterRows(c: Ctx, sid: Id): Offer[] {
  const { w, h: p } = c, s = openAsks(w).find((x) => x.id === sid && x.terms?.by === p.id);
  if (!s) return [];
  const rs = exReplies(w, p, s), rows: Offer[] = rs.map((x) => ({ code: `x:${s.id}:${x.k}`, label: x.label, note: x.hint }));
  const keep = rs.length ? new Set(['take', 'pressure', 'wait', 'drop']) : undefined;
  rows.push(...playerMoves(w, p, s).filter((m) => (!keep || keep.has(m.move)) && !m.off).map((m) => ({ code: `mv:${s.id}:${m.move}`, label: m.label, note: m.hint })));
  const K0 = ASKS[s.ak ?? ''], fig0 = K0?.figure?.(w, s);
  const fig = fig0 && K0?.short ? { ...fig0, max: Math.min(fig0.max, Math.floor(p.cash / fig0.step) * fig0.step) } : fig0;
  const named = (p.cooldown[`askmv:${s.id}:name`] ?? -1) >= Math.floor(w.now / DAY); // (one figure a day: he has heard your number)
  if (fig && fig.max >= fig.min && !named) rows.splice(Math.min(1, rows.length), 0, { code: `nm:${s.id}`, label: 'Name your own figure', note: fig.rate ? 'How much, and how much a week on top. He answers what you put to him.' : 'Put a number to him. He answers it from what he has and what it is worth to him.', amount: { value: Math.round(clamp(s.terms?.amt ?? fig.min, fig.min, fig.max) / fig.step) * fig.step, min: fig.min, max: fig.max, step: fig.step, ...(fig.rate ? { rate: { value: s.terms?.rate ?? 0.05, min: fig.rate.min, max: fig.rate.max } } : {}) } });
  return rows;
}
const matterA: Act = {
  base: 'm', pane: 'business',
  offersFor: matterRows,
  offers: (c) => mine(c).slice(0, 3).map((s) => ({ code: 'm:' + s.id, label: `About ${mTitle(c.w, s).replace(/^(His|Her|The|What|Your|Protection|Trouble|Bad|Money|Loan|Debt|Stake|Arrangement|A)\b/, (q) => q.toLowerCase())}`, says: matterOpen(c.w, s, s.st?.[c.n.id]?.last).replace(/^“|”$/g, ''), note: matterWhere(s, c.n), kind: 'between' as const, pane: (s.ak === 'amends' ? 'confront' : 'business') as never })),
  run: (c, code) => {
    const x = T(c), { w, t } = x, sid = code.split(':')[1], s = openAsks(w).find((q) => q.id === sid);
    if (!s) return out(2);
    const last = s.st?.[t.id]?.last, tp = temper(t), hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1;
    const pickL = (xs: string[]) => xs[(t.id.charCodeAt(t.id.length - 1) + (w.now / 1440 | 0)) % xs.length];
    // the point he left it on, if he left it on one: he says it again, so what the player answers is in front of him
    const RESTATE: Record<string, string> = { money: hot ? '“Like I said. I haven’t got it.”' : '“Like I told you, I can’t afford it.”', doubt: '“Like I said, I don’t know you, or who you’re with.”', taken: '“I told you. I already pay someone.”', you: hot ? '“You know how I feel about you.”' : '“I told you how things are between us.”', pride: '“I told you. I stand on my own feet.”', time: '“I’m still thinking it over.”' };
    let him: string | undefined;
    if (classOf(s) === 'trade') { const TR: Record<string, string> = { money: s.ak === 'sell' ? '“Like I said, it isn’t worth that to me.”' : s.ak === 'run' ? '“Like I said, that cut is too rich for me.”' : '“Like I said, it’s worth more than that.”', taken: s.ak === 'run' ? '“I told you, I’ve got a man on it.”' : '“I told you, it isn’t for sale.”', doubt: RESTATE.doubt, you: RESTATE.you, pride: RESTATE.pride, time: RESTATE.time }; if (s.m?.beat === 'claim' && TR[String(s.m.claim)]) him = TR[String(s.m.claim)]; }
    if (!him && s.m?.caught && s.m?.claim === 'money') him = last === 'counter' ? '“You’ve seen enough. You know what I can do.”' : '“All right. You know I can pay something.”';
    if (!him && s.m?.beat === 'claim' && RESTATE[String(s.m.claim)]) him = RESTATE[String(s.m.claim)];
    him ??= last === 'no' ? (hot ? '“I gave you my answer.”' : soft ? '“I know. I’m sorry, it’s still the same.”' : '“Nothing’s changed.”') : last === 'stall' ? (hot ? '“I said I’d think about it.”' : '“I’ve been thinking about it. I have.”') : last === 'counter' ? '“You heard what I can do.”' : s.m?.help ? (hot ? '“I’ve got people now. Talk to them.”' : '“It’s not just me you’re dealing with any more.”') : pickL(['“Go on.”', '“I’m listening.”', '“Say what you came to say.”']);
    line(x, him);
    return { minutes: 2, next: matterRows(c, sid) };
  },
};
// (a move in it, an answer to his point, a figure named: asks.playerMove, exchange.reply, asks.nameFigure; the matter stays the subject)
const afterMove = (c: Ctx, sid: Id, minutes: number) => ({ minutes, next: matterRows(c, sid) });
const PUSH_MV = /^(pressure|force|leverage|senior)$/, PUSH_X = /^(assume|nochoice|notthere|now)$/;
const mv: Act = { base: 'mv', pane: 'business', run: (c, code) => { const x = T(c), [, sid, m] = code.split(':'); const r = door.matterMove(x.w, x.p, sid, m as never); for (const l of r.lines) line(x, l); return afterMove(c, sid, r.minutes); } };
const xA: Act = { base: 'x', pane: 'business', run: (c, code) => { const x = T(c), [, sid, k] = code.split(':'), s = openAsks(x.w).find((q) => q.id === sid && q.terms?.by === x.p.id); if (!s) { line(x, '“That’s settled.”'); return out(2); } const ls = door.answerPoint(x.w, x.p, s, k); for (const l of ls) line(x, l); if (!ls.length) line(x, voice(x, 'already')); return afterMove(c, sid, 15); } };
const nm: Act = { base: 'nm', pane: 'business', run: (c, code) => { const x = T(c), [, sid, amt, rate] = code.split(':'); const r = door.nameTheFigure(x.w, x.p, sid, Number(amt), rate !== undefined ? Number(rate) : undefined); for (const l of r.lines) line(x, l); return afterMove(c, sid, r.minutes); } };
export const isPushy = (code: string) => { const [k, , m] = code.split(':'); return k === 'mv' ? PUSH_MV.test(m ?? '') : k === 'x' ? PUSH_X.test(m ?? '') : false; };
// calling in a favour he owes the player: a matter between them (asks.ts 'favour')
const favcall: Act = {
  base: 'favcall', pane: 'business',
  offers: (c) => { const { w, h: p, n: t } = c; const f = !askBetween(w, 'favour', p.id, t.id) ? w.favours.find((q) => !q.settled && q.from === p.id && q.to === t.id && (w.sitcool?.[`ask:favour:${p.id}:${t.id}:${q.id}`] ?? 0) <= w.now) : undefined; return f ? [{ code: 'favcall:' + f.id, label: `Call in the favour he owes you: ${money(150 * Math.max(1, f.size))}`, note: 'He owes you. What he does about it says what he is.', kind: 'between' }] : []; },
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, f = w.favours.find((q) => q.id === code.slice(8) && !q.settled && q.from === p.id && q.to === t.id);
    const s = f ? door.callIn(w, p, t, f, 150 * Math.max(1, f.size)) : undefined;
    if (!f || !s) { line(x, '“We’ve been over that.”'); return out(3); }
    c.v.lines.push({ who: 'narr', text: `You remind ${first(t)} of the favour he owes you.` });
    const r = door.matterMove(w, p, s.id, 'ask');
    for (const l of r.lines) line(x, l);
    return { minutes: r.minutes, next: matterRows(c, s.id) };
  },
};
// ---------------------------------------------------------------- a matter he is in that the player knows of (matters.ts), and his trouble
const mtOpen: Act = {
  base: 'mt_open', pane: 'personal',
  offers: (c) => { const seen = new Set<string>(), out0: Offer[] = []; for (const { s } of topicsWith(c.w, c.h, c.n)) if (!seen.has(s.id)) { seen.add(s.id); out0.push({ code: 'mt_open:' + s.id, label: `About ${(matterTitle(c.w, s) ?? s.cause).replace(/^(His|Her|The|What|Your|Protection|Trouble|Bad|Money|Loan|Debt|Stake|Arrangement|A)\b/, (q) => q.toLowerCase())}`, says: `This business with ${(matterTitle(c.w, s) ?? s.cause).replace(/^./, (m) => m.toLowerCase())}…`, note: 'Something you both know about.', kind: 'between' }); } return out0; },
  offersFor: (c, sid) => topicsWith(c.w, c.h, c.n).filter((q) => q.s.id === sid).map(({ s, o }) => ({ code: `mt:${s.id}:${o.code}`, label: o.label, note: o.hint })),
  run: (c, code) => {
    const x = T(c), sid = code.split(':')[1], pickL = (xs: string[]) => xs[(x.t.id.charCodeAt(x.t.id.length - 1) + (x.w.now / 1440 | 0)) % xs.length];
    const l = pickL(['He waits to hear what you know.', '“What about it?”', 'He gives you a long look. “Go on.”']);
    if (l.startsWith('“')) line(x, l); else c.v.lines.push({ who: 'narr', text: l });
    return { minutes: 2, next: mtOpen.offersFor!(c, sid) };
  },
};
const mt: Act = { base: 'mt', pane: 'personal', run: (c, code) => { const x = T(c), [, sid, mc] = code.split(':'); const r = door.matterAct(x.w, x.p, sid, mc, x.t.id); for (const l of r.lines) line(x, l); return out(r.minutes); } };
// his trouble (situations.ts): asked about, then what the player can do about it once he has told it
const sitAskA: Act = {
  base: 'sit_ask', pane: 'personal',
  offers: (c) => howsBusiness(c, 'sit_ask'),
  run: (c) => { const x = T(c); for (const l of door.situationAsk(x.w, x.p, x.t)) line(x, l); return out(15, sitRows(c)); },
};
function sitRows(c: Ctx): Offer[] {
  const { w, h: p, n: t } = c, sit = sitOf(w, t.id);
  if (!sit || !(sit.told || sit.knows)) return [];
  const o: Offer[] = [];
  if (sit.rival && w.biz[sit.rival]?.open) o.push({ code: 'sit_rival', label: `“I’ll send word to ${w.biz[sit.rival].name}.”`, note: 'Nothing violent. A little heat, a grudge, and his customers come back.' });
  if (p.cash >= 600) o.push({ code: 'sit_cover', label: '“Let me cover what you’ve lost.” ($600)', note: 'No book, no vig. He won’t forget it.' });
  if (p.cash >= 400) o.push({ code: 'sit_lend', label: '“I can lend you $400. The usual terms.”', note: 'The usual weekly. He owes you.' });
  o.push({ code: 'sit_leave', label: '“You’ll have to sort this out yourself.”', note: 'He learns what he’s worth to you.' });
  return o;
}
const sitDoor: Act = {
  base: 'sit', pane: 'personal',
  offers: (c) => { const sit = sitOf(c.w, c.n.id); return sit && sit.kind !== 'ambition' && (sit.told || sit.knows) ? [{ code: 'sit', label: ownerBiz(c.w, c.n.id) ? `About his trouble at ${ownerBiz(c.w, c.n.id)!.name}` : 'About his trouble', says: 'About what you told me.', note: 'What he told you is going wrong.', kind: 'between' }] : []; },
  run: (c) => { const x = T(c), tp = temper(x.t), hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1; line(x, hot ? '“What about it?”' : soft ? '“Yes. Let’s talk about it.”' : '“All right.”'); return { minutes: 2, next: sitRows(c) }; },
};
const sitHelp = (how: 'cover' | 'lend' | 'leave' | 'rival'): Act => ({
  base: 'sit_' + how, pane: 'personal',
  conduct: how === 'cover' ? (c, before) => { if (c.h.cash < before.cash) door.conduct(c.h, 'generous'); } : undefined,
  run: (c) => { const x = T(c); for (const l of door.situationHelp(x.w, x.p, x.t, how)) line(x, l); return out(15); },
});

export const BUSINESS: Act[] = [op, bizNone, earnA, rateAskA, partnerChop, partnerFence, termsCut, termsRaise, deal, suggest, borrow, buyAsk(false), buyAsk(true), runAsk, sellAsk, offerLoan, shHow, shWhy, shEars, shBack, shTime, shLean, ...DEBT, envelope, extra(false), extra(true), tributeA, matterA, mv, xA, nm, favcall, mtOpen, mt, sitAskA, sitDoor, sitHelp('cover'), sitHelp('lend'), sitHelp('leave'), sitHelp('rival')];
void sitAsk; void owedOf;
