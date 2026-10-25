// Having things out (Gate 4, from the old engine's disputes, amends, memos and rival leaves, its approaches and encounters, and the
// standing follow-ups for a broken word and a warning): demanding an explanation, putting a lie to him, clearing the air, making good
// a broken word, what is outstanding between them, warning a rival's man off; and what he has come to ask the player, answered.
import { askBetween } from '../../asks';
import { brokenWord } from '../../memos';
import { temper } from '../../temper';
import { arch } from '../../voice';
import { addr } from '../subjects/life';
import { DAY, type Character } from '../../types';
import * as door from '../doors';
import { chance, settled, term } from '../decide';
import type { Act, Ctx, Offer } from '../kit';
import { first, line, out, R, T, tweak } from './common';
import { asksOf, askLead, BORING, isSuperior } from './words';
import { said } from './personal';
import { troubleHere } from './info';
import { ACTS } from '.';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const asked = (c: Ctx, k: string) => c.v.th.asked.includes(k);
const ask = (c: Ctx, k: string) => { c.v.th.asked.push(k); };
const rk = (c: Character) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.rank);
type Pool = Partial<Record<string, string[]>> & { _: string[] };
const pick = (c: Ctx, pool: Pool) => c.w.rng.pick(pool[arch(c.n)] ?? pool._);
const recent = (c: Ctx, key: string, days: number) => { const m = c.n.talk?.[key]; return !!m && Math.floor(c.w.now / DAY) - m.d <= days; };

// ---------------------------------------------------------------- an explanation demanded for something he did
const lieOf = (c: Ctx) => Object.values(c.w.facts).find((f) => f.actor === c.n.id && c.h.known[f.id]?.knowsActor && !BORING.has(f.kind) && c.w.now - f.t < 40 * DAY && ['beating', 'vandalism', 'robbery', 'burglary', 'scam', 'theft', 'poach', 'shortfall'].includes(f.kind));
const demand: Act = {
  base: 'demand', pane: 'confront',
  offers: (c) => { const f = troubleHere(c) ? lieOf(c) : undefined; return f ? [{ code: 'demand:' + f.id, label: said(c, 'demand', 'Demand an explanation'), note: `About: ${clip(f.text, 70)}`, kind: 'between' }] : []; },
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, f = w.facts[code.split(':')[1]];
    const tough = t.traits.violence > 0.6 && t.rank !== 'associate';
    // he answers to a man above him; otherwise, unless he is a hard man, as far as he trusts the player
    const d = isSuperior(w, p, t) ? settled(t.id, 'answers you', 'you are above him') : !tough ? chance(w, t.id, 'answers you', 'will not be called on it', [term('base', 0.5), term('his trust in you × 0.3', R(x).trust * 0.3)]) : settled(t.id, 'will not be called on it', 'a hard man');
    if (d.chosen === 'answers you') {
      const amt = door.giveBack(w, t, p, f);
      line(x, `${t.name} shifts. "All right. It got out of hand."${amt > 0 ? ` He hands over ${money(amt)}.` : ''}`, d);
      tweak(x, 0.02);
    } else {
      door.grudge(w, t, p.id, 0.15, `${p.name} called him on it`); tweak(x, -0.05, -0.04, -0.02);
      line(x, `${t.name} laughs without humour. "Who are you to ask me?"`, d);
      door.memo(w, t, p.id, 'threat', 'You demanded an explanation from him. He didn’t take it well.');
    }
    return out(20);
  },
};
// ---------------------------------------------------------------- he denied it, and the player knows better
const liedTo = (c: Ctx) => Object.keys(c.n.denied ?? {}).map((id) => c.w.facts[id]).find((f) => f && f.actor === c.n.id && c.h.known[f.id]?.knowsActor && c.h.known[f.id].from !== c.n.id);
const confront: Act = {
  base: 'confront', pane: 'confront',
  offers: (c) => { const f = liedTo(c); return f ? [{ code: 'confront:' + f.id, label: 'You told me it wasn’t you.', note: 'You know it was. How he takes it says a lot.', kind: 'between' }] : []; },
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, f = w.facts[code.split(':')[1]];
    if (!f) return out(3);
    door.undenied(t, f.id);
    const bold = t.traits.courage > 0.55 || arch(t) === 'proud' || arch(t) === 'hothead';
    c.v.lines.push({ who: 'narr', text: `You tell ${first(t)} you know it was him, whatever he said before.` });
    const d = !bold ? settled(t.id, 'owns it', 'not a bold man') : chance(w, t.id, 'owns it', 'takes it as an insult', [term('base', 0.2), term('his respect for you × 0.6', R(x).respect * 0.6)], 0.1, 0.8);
    if (d.chosen === 'owns it') { line(x, `${t.name} holds your eye for a moment, then lets out a breath. “All right. It was me. What was I going to say, with you standing there?”`, d); door.learnFrom(w, p, f, t.id, true); tweak(x, -0.03, 0, 0.03); }
    else { line(x, `“Careful, ${addr(w, t, p)}. You’re calling me a liar.”`, d); door.grudge(w, t, p.id, 0.1, `${p.name} as good as called him a liar`); tweak(x, -0.06, -0.03, -0.02); }
    return out(10);
  },
};
// ---------------------------------------------------------------- clearing the air: bad blood between them
const badBlood = (c: Ctx) => peek0(c) >= 0.25;
const peek0 = (c: Ctx) => R(T(c)).grudge;
const mineTo = (c: Ctx) => Object.values(c.w.facts).filter((f) => f.actor === c.h.id && f.victim === c.n.id && !BORING.has(f.kind) && c.n.known[f.id]?.knowsActor && c.w.now - f.t < 90 * DAY).sort((a, b) => b.t - a.t)[0];
const hisTo = (c: Ctx) => Object.values(c.w.facts).find((f) => f.actor === c.n.id && f.victim === c.h.id && !BORING.has(f.kind) && c.w.now - f.t < 120 * DAY);
const amendsRows = (c: Ctx): Offer[] => {
  const mine = mineTo(c), o: Offer[] = [];
  if (mine) {
    if (!asked(c, 'a_own')) o.push({ code: 'a_own:' + mine.id, label: said(c, 'a_own', 'Own up and say you were wrong'), note: clip(mine.text, 70) });
    if (hisTo(c) && !asked(c, 'a_start')) o.push({ code: 'a_start:' + mine.id, label: said(c, 'a_start', 'Remind him what he did first'), note: clip(hisTo(c)!.text, 70) });
    if (!asked(c, 'a_pay')) o.push({ code: 'a_pay:' + mine.id, label: said(c, 'a_pay', `Make it right with ${money(Math.max(200, Math.round((mine.amount ?? 0) * 1.2)))}`), note: 'Money talks, quietly.' });
    if (!asked(c, 'a_defy')) o.push({ code: 'a_defy:' + mine.id, label: said(c, 'a_defy', 'Tell him you would do it again'), note: 'He won’t forgive that.' });
  } else {
    if (!asked(c, 'a_ask')) o.push({ code: 'a_ask', label: said(c, 'a_ask', 'Ask what he has got against you'), note: 'He may have the wrong idea.' });
    if (!asked(c, 'a_gift')) o.push({ code: 'a_gift', label: said(c, 'a_gift', 'Buy him a drink and let it lie ($60)') });
  }
  return o;
};
const amendsDoor: Act = {
  base: 'amends', pane: 'confront', opens: true,
  offers: (c) => (badBlood(c) ? [{ code: 'amends', label: 'The bad blood between you', says: 'There’s bad blood between us. I don’t want it.', kind: 'between' }] : []),
  run: (c) => { const x = T(c), tp = temper(x.t), hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1; line(x, hot ? '“What about it?”' : soft ? '“Yes. Let’s talk about it.”' : '“All right.”'); return { minutes: 2, next: amendsRows(c) }; },
};
// (the old engine's "make it right" after owning up to an event: the same door)
const amendsOpen: Act = { ...amendsDoor, base: 'amends_open', offers: undefined };
// owning up, or paying for what he did: an offer of amends (asks.ts 'amends'), a matter between them
const aOwnPay = (pay: boolean): Act => ({
  base: pay ? 'a_pay' : 'a_own', pane: 'confront',
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, f = w.facts[code.split(':')[1]], k = pay ? 'a_pay' : 'a_own'; ask(c, k);
    const amt = pay ? Math.max(200, Math.round((f?.amount ?? 0) * 1.2)) : 0;
    if (amt && p.cash < amt) { c.v.lines.push({ who: 'narr', text: 'You reach for your money and come up short. Better to wait until you can do it properly.' }); c.v.th.asked.pop(); return out(5, amendsRows(c)); }
    const s = askBetween(w, 'amends', p.id, t.id) ?? door.offerAmends(w, p, t, { fact: f?.id, amt, why: `${p.name} came to make it right with ${t.name}` });
    if (!s) { line(x, '“We’ve been through it. Leave it a while.”'); return out(5, amendsRows(c)); }
    if (s.terms) door.raiseTerms(s, amt);
    c.v.lines.push({ who: 'narr', text: pay ? `You put ${money(amt)} on the table.` : '"I was wrong," you say.' });
    for (const l of door.matterMove(w, p, s.id, 'ask').lines) line(x, l);
    return out(20, [...(ACTS.m.offersFor?.(c, s.id) ?? []), ...amendsRows(c)]);
  },
});
const aStartDefy = (defy: boolean): Act => ({
  base: defy ? 'a_defy' : 'a_start', pane: 'confront',
  run: (c) => {
    const x = T(c), { w, p, t } = x; ask(c, defy ? 'a_defy' : 'a_start');
    door.amendsMade(w, p, t, defy ? 'defy' : 'start');
    if (!defy) {
      const d = t.traits.violence < 0.6 ? settled(t.id, 'takes it', 'not a violent man') : chance(w, t.id, 'takes it', 'turns it back on you', [term('a violent man, four times in ten', 0.4)]);
      const ok = d.chosen === 'takes it';
      line(x, ok ? `"You started it," you remind him. ${t.name} looks away. "Maybe. Maybe I did."` : `"You started it," you say. ${t.name}'s face hardens. "Don’t put this on me."`, d);
      door.grudge(w, t, p.id, ok ? -0.12 : 0.1, `${p.name} put the blame on him`); tweak(x, ok ? 0.02 : -0.03);
    } else {
      line(x, `"I would do it again," you tell him. ${t.name} nods once, slowly, the way a man does when he has decided something.`);
      door.grudge(w, t, p.id, 0.2, `${p.name} said he would do it again`); tweak(x, -0.1, -0.06, 0.02);
      door.memo(w, t, p.id, 'threat', 'You told him to his face you would do it again.');
    }
    return out(20, amendsRows(c));
  },
});
const aAsk: Act = { base: 'a_ask', pane: 'personal', run: (c) => { const x = T(c); ask(c, 'a_ask'); line(x, R(x).grudge >= 0.5 ? '"You know exactly what you did. Or what you allowed."' : `${x.t.name} shrugs. "Word got round that you were against me. Maybe it was wrong."`); door.softens(x.w, x.t, x.p, 0.07, 'talked'); tweak(x, 0.02); return out(15, amendsRows(c)); } };
const aGift: Act = {
  base: 'a_gift', pane: 'personal',
  conduct: (c, before) => { if (c.h.cash < before.cash) door.conduct(c.h, 'generous'); },
  run: (c) => { const x = T(c); ask(c, 'a_gift'); if (x.p.cash < 60) c.v.lines.push({ who: 'narr', text: 'You can’t spare it.' }); else { door.spend(x.w, x.p, 60, 'a round, to let it lie'); c.v.lines.push({ who: 'narr', text: `You buy a round and say nothing about it. ${x.t.name} says nothing back, which is a start.` }); door.softens(x.w, x.t, x.p, 0.05, 'a drink'); tweak(x, 0.02, 0.03); } return out(40, amendsRows(c)); },
};
// a promise the player did not keep: making it right is a matter between them (asks.ts 'amends')
const wordMake: Act = {
  base: 'word_make', pane: 'confront',
  offers: (c) => (brokenWord(c.w, c.h, c.n) && !askBetween(c.w, 'amends', c.h.id, c.n.id) ? [{ code: 'word_make', label: 'I let you down. I want to make it right.', note: 'It will cost you something, and he will remember that you came.', kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, f0 = brokenWord(w, p, t);
    if (!f0) { line(x, '“It’s done with. Let it be.”'); return out(3); }
    line(x, pick(c, { hothead: [`“You said you would. You didn’t. Talk is cheap, ${p.name.split(' ').slice(1).join(' ') || p.name}.”`], proud: ['“I don’t forget when a man gives his word and sits on it.”'], _: ['“You told me you’d see to it. Then nothing. I noticed.”'] }));
    const s = askBetween(w, 'amends', p.id, t.id) ?? door.offerAmends(w, p, t, { word: f0.id, why: `${p.name} came to make it right with ${t.name}` });
    return { minutes: 15, next: s ? ACTS.m.offersFor?.(c, s.id) : undefined };
  },
};
// ---------------------------------------------------------------- what is outstanding between them (memos), and what was found out
const RAISE: Record<string, string> = { promise: 'About what I promised you', agreement: 'About what we agreed', threat: 'About what I said to you before', question: 'About what you asked me to find out', favour: 'About the favour' };
const dueWords = (now: number, due: number) => { const d = Math.floor(due / 1440) - Math.floor(now / 1440); return d < 0 ? 'overdue' : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : d < 7 ? `due in ${d} days` : 'due next week or after'; };
const memoA: Act = {
  base: 'memo', pane: 'business',
  offers: (c) => c.n.memos.filter((m) => m.other === c.h.id && !m.done).map((m) => ({ code: 'memo:' + m.id, label: RAISE[m.kind] ?? 'About what’s between us', note: `${m.text}${m.due ? ` (${dueWords(c.w.now, m.due)})` : ''}`, kind: 'between' as const, pane: (m.kind === 'threat' ? 'confront' : 'business') as never })),
  run: (c, code) => {
    const x = T(c), { w, t } = x, m = t.memos.find((q) => q.id === code.split(':')[1]), r = R(x);
    if (!m) return out(2);
    if (m.kind === 'promise' && m.ref) { const j = w.jobs.find((q) => q.id === m.ref); line(x, j?.status === 'done' ? '"You came through. Thank you."' : '"You said you would see to it."'); if (j?.status === 'done') door.memoDone(m); }
    else { const tp = temper(t), hot = tp.volatility + tp.pride > 1.15; line(x, m.kind === 'agreement' ? (r.grudge >= 0.3 ? '“We had an understanding. I’m starting to wonder whether you remember it.”' : '“We have an understanding. Nothing’s changed on my side.”') : m.kind === 'threat' ? (hot ? '“I remember what you said. I haven’t forgotten, and I won’t.”' : tp.caution > 0.6 || r.fear ? '“I haven’t forgotten. I don’t want any trouble.”' : '“I remember. Let’s leave it there.”') : m.kind === 'question' ? '“Well? Did you find anything out?”' : m.kind === 'favour' ? '“I haven’t forgotten what I owe you.”' : '“I remember.”'); }
    return out(10);
  },
};
const answer: Act = {
  base: 'answer', pane: 'business',
  offers: (c) => c.n.memos.filter((m) => m.other === c.h.id && !m.done && m.kind === 'question' && m.ref && c.h.known[m.ref]?.knowsActor).map((m) => ({ code: 'answer:' + m.id, label: 'Tell him what you found out', note: clip(c.w.facts[m.ref!].text, 60), kind: 'between' as const })),
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, m = t.memos.find((q) => q.id === code.split(':')[1]);
    if (!m?.ref) return out(2);
    const f = w.facts[m.ref];
    door.learnFrom(w, t, f, p.id, true); door.memoDone(m); tweak(x, 0.1, 0.04, 0.05); door.repute(w, p, 1, 'told');
    if (f.actor) door.grudge(w, t, f.actor, 0.3, f);
    line(x, `${t.name} listens, then nods once. "You kept your word. I’ll remember that."`);
    return out(20);
  },
};
// ---------------------------------------------------------------- a rival family's man, warned off (flows.ts): his answer is his rank and nerve
const rivalMan = (c: Ctx) => !!c.n.familyId && !!c.h.familyId && c.n.familyId !== c.h.familyId && c.n.rank !== 'civilian';
const rvWarn: Act = {
  base: 'rv_warn', pane: 'confront',
  offers: (c) => { const tn = c.w.fam[c.h.familyId!]?.tension[c.n.familyId!] ?? 0; return rivalMan(c) && !asked(c, 'rv_warn') ? [{ code: 'rv_warn', label: said(c, 'rv_warn', 'Tell him to keep off our ground'), note: tn > 2 ? 'The air is already thick.' : 'It raises the temperature.' }] : []; },
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (recent(c, 'rv_warn', 7)) { line(x, '“You said that already. I’m still standing here.”'); return out(3); }
    door.talkStamp(w, t, 'rv_warn');
    const higher = rk(t) > rk(p), a = arch(t);
    if (a === 'frightened' || (!higher && temper(t).courage < 0.45)) { line(x, 'He holds up both hands. “I’m not looking for trouble. I’ll pass it on.” He does not like it, and he will say so only to his own.', settled(t.id, 'backs off', 'a frightened man, or one without the nerve or the rank')); tweak(x, -0.03, -0.02, 0.02); door.tension(w, p, t, 0.15); }
    else if (higher || a === 'hothead' || a === 'proud') { line(x, higher ? '“From you? Keep a civil tongue. You’re speaking out of turn to a man above you. I’ll pass your message on, and mine to your boss.”' : '“Our ground? Since when? Careful what you start.”', settled(t.id, 'throws it back', higher ? 'he outranks you' : 'a proud or hot-headed man')); tweak(x, -0.08, -0.05, -0.03); door.grudge(w, t, p.id, 0.1, `${p.name} spoke out of turn to him`); door.tension(w, p, t, 0.6); }
    else { line(x, '“Message received. Pass mine to your boss.” He smiles with no warmth.'); tweak(x, -0.06, -0.04, 0.03); door.tension(w, p, t, 0.4); }
    door.happened(w, { kind: 'threat', actor: p.id, victim: t.id, minor: true, text: `${p.name} warned ${t.name} off.`, district: t.district }, { witnesses: [] });
    return out(10, [{ code: 'rv_ease', label: '“I meant no insult by it.”', note: 'Takes some heat out. It also reads as weakness.' }, { code: 'fl_drop', label: '“Let’s leave it there.”' }]);
  },
};
const rvEase: Act = { base: 'rv_ease', pane: 'confront', run: (c) => { const x = T(c); door.tension(x.w, x.p, x.t, -0.2, true); tweak(x, 0.02, 0, -0.02); line(x, '“Fine. Fine. Let’s say it was a long day.” The air eases, a little.'); return out(5); } };
// ---------------------------------------------------------------- what he has come to ask the player (an encounter), and its answers
const encRows = (c: Ctx, id: string): Offer[] => { const e = asksOf(c.w, c.n).find((q) => q.id === id); return e ? [...e.opts.map((o) => ({ code: `enc:${e.id}:${o.code}`, label: o.label, note: o.hint })), ...(c.v.th.asked.includes('apx:wait:' + id) ? [] : [{ code: 'apx:wait:' + id, label: 'Can it wait?', note: 'He will wait. He will notice he had to.' }]), { code: 'apx:no:' + id, label: 'Not right now.', note: 'He will take it as it sounds.' }] : []; };
const encOpen: Act = {
  base: 'enc_open', pane: 'business', opens: true,
  offersFor: encRows,
  offers: (c) => asksOf(c.w, c.n).slice(0, 3).map((e, i) => ({ code: 'enc_open:' + e.id, label: `About what he asked: ${e.title}`, says: 'You wanted to ask me something?', note: i ? 'He is waiting on your answer.' : e.lines.at(-1)?.replace(/^[^“"]*(?=[“"])/, ''), kind: (i ? 'between' : 'his') as Offer['kind'] })),
  run: (c, code) => { const x = T(c), id = code.split(':')[1], e = asksOf(x.w, x.t).find((q) => q.id === id); if (!e) { line(x, 'He lets it go.'); return out(2); } c.v.th.raised.push(e.id); c.v.topic = 'enc:' + e.id; const l = e.lines.at(-1); if (l) line(x, l); return { minutes: 2, next: encRows(c, id) }; },
};
const enc: Act = {
  base: 'enc', pane: 'business',
  offersFor: encRows,
  run: (c, code) => {
    const x = T(c), [, eid, ecode] = code.split(':'), e = x.w.enc.find((q) => q.id === eid);
    if (!e || e.status !== 'open') { line(x, '“Forget it. It’s been dealt with.”'); return out(3); }
    const res = door.answerEncounter(x.w, x.p, e, ecode);
    for (const l of res.lines) line(x, l);
    return { minutes: res.minutes, next: e.status === 'open' ? encRows(c, eid) : undefined };
  },
};
// how the player takes being asked: what is it about, can it wait, not now
const apx: Act = {
  base: 'apx', pane: 'business',
  run: (c, code) => {
    const x = T(c), { w, t } = x, [, how, id] = code.split(':'), e = asksOf(w, t).find((q) => q.id === id), tp = temper(t), hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1;
    if (!e) { line(x, 'He lets it go.'); return out(2); }
    ask(c, code);
    if (how === 'what') { line(x, askLead(e)); return { minutes: 2, next: encRows(c, id) }; }
    if (how === 'wait') { door.putOff(w, e, w.now + 2 * DAY); door.regard(w, t, x.p.id, 'trust', -0.01); line(x, hot ? '“It won’t keep for ever.”' : soft ? '“Of course. When you have a minute.”' : '“All right. Don’t make me wait long.”'); c.v.topic = undefined; return out(2); }
    door.regard(w, t, x.p.id, 'respect', -0.02); door.regard(w, t, x.p.id, 'trust', -0.02);
    line(x, hot ? '“Fine. Remember you said that.”' : soft ? '“I understand. Another time.”' : '“Right.”');
    c.v.topic = undefined;
    return out(2);
  },
};

export const CONFRONT: Act[] = [demand, confront, amendsDoor, amendsOpen, aOwnPay(false), aOwnPay(true), aStartDefy(false), aStartDefy(true), aAsk, aGift, wordMake, memoA, answer, rvWarn, rvEase, encOpen, enc, apx];
