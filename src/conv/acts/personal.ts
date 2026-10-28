// Personal: how he is, what he wants, who he gets on with, what people say, an introduction, a kindness, a rival family's man over a
// drink (Gate 4, from the old engine's personal, family-talk and rival leaves). Each: what can be said now (offers, the old engine's
// own conditions), his decision in the layer's record (decide.ts), what it does through doors.ts, and his words.
import { wantSaid } from '../subjects/life';
import { isFamilyBoss } from '../relation';
import { feePosition } from '../../negotiate';
import { ownerBiz } from '../../core';
import { historyLines } from '../../powers2';
import { knows, repLines } from '../../crewlife';
import { traitWords } from '../../jobs';
import { arch } from '../../voice';
import { speak } from '../../voicesheet';
import { temper } from '../../temper';
import { DAY } from '../../types';
import type { Character } from '../../types';
import * as door from '../doors';
import { chance, settled, term } from '../decide';
import type { Act, Ctx, Offer } from '../kit';
import { first, line, one, out, R, T, tweak, voice } from './common';
import { BORING, holdsBack, inFamily, told, WANT_SAY } from './words';
import { ACTS } from '.';
import { introduced, introducers } from '../../acquaint';

// the player's words for an offer, as the old screen put them (voicesheet.speak), without the quotation marks round them
export const said = (c: Ctx, code: string, label: string) => speak(c.w, c.h, c.n, code, label).replace(/^“([^“”]*)”(\s*\(.*\))?$/, (_m, a: string, b?: string) => a.replace(/\.$/, '') + (b ?? '')).replace(/([^.])\.$/, '$1');
const offer = (c: Ctx, code: string, label: string, note?: string, kind?: Offer['kind']): Offer => ({ code, label: said(c, code, label), note, kind });
const acquaintedHere = (c: Ctx) => introduced(c.w, c.h, c.n);
// (a man the player had not met when the visit began, and has not yet been introduced to in it)
export const strangerHere = (c: Ctx) => c.v.relation === 'You haven’t met.' && !c.v.th.asked.includes('met');
const crewMan = (c: Ctx) => c.n.bossId === c.h.id;
const superior = (c: Ctx) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.n.rank) > ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.h.rank) || c.n.id === c.h.bossId;
const short = (c: Ctx) => { const b = ownerBiz(c.w, c.n.id); return c.n.cash < 300 || (!!b && (b.cash < 250 || b.distress > 0)); };

// ---------------------------------------------------------------- how he is keeping, and what follows from it
const how: Act = {
  base: 'how', pane: 'personal', social: true,
  repeat: { window: 4, sig: (c) => { const b = ownerBiz(c.w, c.n.id); return [c.n.cash < 150, c.n.hurtUntil > c.w.now, (b?.distress ?? 0) > 0, Object.entries(c.n.rels).filter(([id, q]) => q.grudge >= 0.3 && id !== c.h.id && c.w.chars[id]?.alive).map(([id]) => id).sort().join(',')].join('|'); } },
  offers: (c) => [offer(c, 'how', 'Ask how he’s holding up')],
  run: (c) => {
    const x = T(c), { w, t } = x, b = ownerBiz(w, t.id), n0 = c.v.lines.length;
    if (t.hurtUntil > w.now) line(x, `${t.name} winces. "Still sore."`);
    if (t.cash < 150) line(x, `${t.name}: "Money is tight."`);
    else if (b && b.distress > 0) line(x, `${t.name} admits ${b.name} has been losing money.`);
    // a man he has a problem with, said to a man he trusts enough: the talk turns to that man
    const g = Object.entries(t.rels).filter(([id, q]) => q.grudge >= 0.3 && id !== w.playerId && w.chars[id]?.alive).sort((a, b2) => b2[1].grudge - a[1].grudge)[0];
    if (g && R(x).trust >= 0.35) {
      const s = w.chars[g[0]];
      line(x, `He lowers his voice. "I have a problem with ${s.name}."`, settled(t.id, 'confides', `he trusts you enough (${R(x).trust.toFixed(2)} ≥ 0.35)`));
      c.v.th.subject = s.id;
      tweak(x, 0.02, 0.02);
      return { minutes: 25, next: ACTS.subject.questions?.(c) };
    }
    if (c.v.lines.length === n0) line(x, voice(x, 'how_fine'));
    tweak(x, 0.01, 0.02);
    const next: Offer[] = [];
    if (t.hurtUntil > w.now) next.push({ code: 'f_hurt', label: 'What happened to you?' });
    if (b && b.distress > 0) next.push({ code: 'f_biz', label: 'What’s going wrong at the shop?' });
    if (t.cash < 150 || (b && b.distress > 0)) next.push({ code: 'f_help', label: 'Is there anything I can do?', note: 'He may not want to say.' });
    return out(20, next);
  },
};
const fHurt: Act = {
  base: 'f_hurt', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, t } = x;
    const f = Object.values(w.facts).filter((q) => q.victim === t.id && !BORING.has(q.kind) && w.now - q.t < 20 * DAY && t.known[q.id]).sort((a, b) => b.t - a.t)[0];
    if (f && !holdsBack(w, t, x.p, f, 'who')) return ACTS.inc.run(c, 'inc:' + f.id) ?? undefined;
    line(x, f ? `${t.name} looks away. “It’s mine to deal with.”` : `${t.name} shrugs, and winces doing it. “A fall. It’ll mend.”`);
    return out(8);
  },
};
const fBiz: Act = {
  base: 'f_biz', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, t } = x, b = ownerBiz(w, t.id);
    if (!b) return out(3);
    const pos = feePosition(b), fee = b.protection && b.protection.collectorId !== t.id ? b.protection.fee : 0;
    line(x, b.damaged > 0 ? `${t.name}: “The place was knocked about. Trade hasn’t come back.”` : fee > pos.cap ? `${t.name}: “After the envelope there isn’t enough left to keep the place going.”` : `${t.name}: “It’s slow. It happens. I can’t say it’s anything more.”`);
    return out(10, t.cash < 400 || b.distress > 1 ? [{ code: 'f_help', label: 'Is there anything I can do?' }] : undefined);
  },
};
const fHelp: Act = {
  base: 'f_help', pane: 'personal',
  run: (c) => {
    const x = T(c), { p, t } = x, r = R(x);
    if (!short(c)) { line(x, `${t.name}: “I’m all right. Thank you for asking.”`); return out(3); }
    // whether he will take help from the player: trust, and a proud man's pride
    const proud = arch(t) === 'proud';
    if (r.trust < 0.35 || (proud && r.trust < 0.55)) { line(x, `${t.name} looks at you a moment. “I’ll manage.”`, settled(t.id, 'manages', proud ? 'too proud to take it from you yet' : 'he does not trust you enough to say')); return out(5); }
    line(x, `${t.name} hesitates, then says it plainly. “Some help wouldn’t hurt.”`, settled(t.id, 'accepts', 'he trusts you enough to say so'));
    const next: Offer[] = [];
    if (p.cash >= 200) next.push({ code: 'help_gift', label: 'Here. $200. No questions', note: 'He won’t forget it.' });
    if (p.cash >= 300 && (t.rank === 'civilian' || t.rank === 'associate')) next.push({ code: 'help_loan', label: 'I can lend you something', note: 'At a friend’s rate.' });
    next.push({ code: 'leave_it', label: 'It’ll keep. Let me think about it' });
    return out(10, next);
  },
};
const leaveIt: Act = { base: 'leave_it', pane: 'personal', run: (c) => { const x = T(c); line(x, temper(x.t).agreeable > 0.5 ? '“Whenever you’re ready. You don’t owe me anything.”' : 'He nods. “Another time.”'); return out(3); } };
// ---------------------------------------------------------------- kindnesses
const helpGift: Act = {
  base: 'help_gift', pane: 'personal',
  offers: (c) => one(short(c) && c.h.cash >= 200, offer(c, 'help_gift', 'Slip him $200, no questions', 'He won’t forget it.')),
  conduct: (c, before) => { if (c.h.cash < before.cash) door.conduct(c.h, 'generous'); },
  run: (c) => {
    const x = T(c);
    if (x.p.cash < 200) { line(x, 'You can’t spare it.'); return out(15); }
    door.gift(x.w, x.p, x.t, 200, 'a gift, no questions');
    tweak(x, 0.1, 0.08, 0.02);
    line(x, voice(x, 'gift_thanks'));
    return out(15);
  },
};
const helpLoan: Act = {
  base: 'help_loan', pane: 'personal',
  offers: (c) => one(short(c) && (c.n.rank === 'civilian' || c.n.rank === 'associate'), offer(c, 'help_loan', 'Offer to lend him money', 'At a friend’s rate.')),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (p.cash < 100) { line(x, 'You can’t spare it.'); return out(5); }
    // (one way to lend: asks 'lend', at a friend's terms, which he can change; it becomes a matter between them)
    const s = door.openMatter(w, 'lend', p, t, { amt: Math.min(300, Math.floor(p.cash / 50) * 50), rate: 0.03, why: `${p.name} offered ${t.name} a loan as a friend` });
    if (!s) { line(x, `${t.name}: “Not now. But thank you.”`); return out(5); }
    line(x, `You tell ${first(t)} you could lend him something, at a friend’s rate.`);
    line(x, `${t.name}: “How much are we talking?”`);
    return { minutes: 15, next: ACTS.m?.offersFor?.(c, s.id) };
  },
};
const welcome: Act = {
  base: 'welcome', pane: 'personal',
  offers: (c) => one(Object.values(c.w.facts).some((f) => f.kind === 'arrest' && f.actor === c.n.id && c.w.now - f.t < 40 * DAY && c.n.jailedUntil <= c.w.now), offer(c, 'welcome', 'Welcome him back', 'He has been away.')),
  run: (c) => { const x = T(c); tweak(x, 0.06, 0.05); line(x, voice(x, 'welcome_back')); return out(20); },
};
const congrats: Act = {
  base: 'congrats', pane: 'personal',
  offers: (c) => one(Object.values(c.w.facts).some((f) => f.kind === 'promotion' && f.actor === c.n.id && c.w.now - f.t < 60 * DAY), offer(c, 'congrats', 'Congratulate him on being made')),
  run: (c) => { const x = T(c); tweak(x, 0.04, 0.05, 0.03); line(x, voice(x, 'congrats')); return out(15); },
};
// reminiscing: liking both ways, and what each has heard passes between them; if he tells something, the talk goes to it
const oldTimes: Act = {
  base: 'old_times', pane: 'personal', social: true,
  repeat: { window: 1, sig: () => 'x' },
  // (not offered to a man who could hardly like the player more, nor a third time in a day: see run.ts on ordinary talk)
  offers: () => [], // (folded into "How are you keeping?" and an evening together in the conversation overhaul)
  run: (c) => {
    const x = T(c), { w, p, t } = x, lines: string[] = [];
    tweak(x, 0.02, 0.04);
    door.regard(w, p, t.id, 'affection', 0.03, 'old times');
    const toldF = door.passOn(w, t, p, lines);
    door.passOn(w, p, t, []);
    for (const l of lines) line(x, l);
    if (!lines.length) line(x, voice(x, 'old_quiet'));
    if (toldF.length) { c.v.th.fact = toldF[0].id; c.v.th.asked = []; return { minutes: 60, next: ACTS.inc.questions?.(c) }; }
    return out(60);
  },
};
// ---------------------------------------------------------------- what he wants; how he gets on with the others; another man
const askWant: Act = {
  base: 'ask_want', pane: 'personal',
  repeat: { window: 40, sig: (c) => `${c.n.want?.kind ?? ''}|${c.n.rank}` },
  offers: (c) => one(crewMan(c) && c.n.rank !== 'civilian' && !knows(c.h, c.n.id, 'want'), offer(c, 'ask_want', 'Ask what he wants out of this', 'Men will tell you, if they trust you.')),
  run: (c) => {
    const x = T(c), { w, p, t } = x, tr = R(x).trust;
    const d = chance(w, t.id, 'tells you', 'keeps it to himself', [term('base', 0.25), term('his trust in you × 0.7', tr * 0.7)], 0.2, 0.9);
    if (!d.yes) { line(x, voice(x, 'want_dodge'), d); return { minutes: 20, skip: true }; }
    door.insight(p, t.id, 'want');
    const kind = door.settleWant(w, t);
    line(x, `${t.name} thinks about it. “You really want to know?”`, d);
    line(x, `“${wantSaid(kind, arch(t)) ?? WANT_SAY[kind][arch(t) === 'cold' || arch(t) === 'proud' || arch(t) === 'schemer' || arch(t) === 'frightened' ? 1 : 0]}”`);
    return out(20, kind === 'rich' || kind === 'gamble' || kind === 'independent' || kind === 'made' ? [{ code: 'f_want', label: 'Is there anything I can do about that?' }] : undefined);
  },
};
const fWant: Act = {
  base: 'f_want', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, kind = t.want?.kind ?? 'rich', warm = R(x).trust >= 0.5;
    const ans: Record<string, [string, string]> = {
      made: ['“Speak for me when it’s time. That’s all. I’ll do the rest.”', '“Don’t embarrass me. That would be enough.”'],
      rich: ['“Put me on to something good, when you hear of it.”', '“Keep your ears open. I’ll make it worth your while.”'],
      gamble: ['“A word to the right man, a bit of room. You’ll hear.”', '“Not yet. When there’s something to say, I’ll say it.”'],
      independent: ['“Stay out of my way, and tell them I’m worth leaving alone.”', '“Nothing. It’s a thing a man does himself.”'],
    };
    line(x, `${t.name}: ${(ans[kind] ?? ans.rich)[warm ? 0 : 1]}`, settled(t.id, warm ? 'asks' : 'declines', warm ? 'he trusts you (≥ 0.5)' : 'not yet trusted'));
    if (warm) door.memo(w, t, p.id, 'question', `He told you what he wants (${kind}), and you asked if you could help.`, { due: w.now + 30 * DAY });
    return out(10);
  },
};
const askCrew: Act = {
  base: 'ask_crew', pane: 'personal',
  repeat: { window: 10, sig: (c) => Object.values(c.w.chars).filter((y) => y.alive && y.bossId === c.h.id && y.id !== c.n.id).map((y) => `${y.id}${(c.n.rels[y.id]?.trust ?? 0) > 0.4 ? '+' : (c.n.rels[y.id]?.grudge ?? 0) > 0.2 ? '-' : ''}`).join(',') },
  offers: (c) => one(crewMan(c) && c.n.rank !== 'civilian', offer(c, 'ask_crew', 'Ask how he gets on with the others', 'Who he likes, and who he doesn’t.')),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    const mates = Object.values(w.chars).filter((y) => y.alive && y.bossId === p.id && y.id !== t.id);
    if (!mates.length) { line(x, `${t.name} shrugs. "There’s nobody else to get on with."`); return out(10); }
    const tr = (id: string) => t.rels[id]?.trust ?? 0.1, gr = (id: string) => t.rels[id]?.grudge ?? 0;
    const friend = mates.filter((y) => tr(y.id) > 0.4).sort((a, b) => tr(b.id) - tr(a.id))[0];
    const foe = mates.filter((y) => gr(y.id) > 0.2).sort((a, b) => gr(b.id) - gr(a.id))[0];
    const loan = w.debts.find((y) => y.status === 'active' && (y.debtor === t.id || y.creditor === t.id) && mates.some((m) => m.id === (y.debtor === t.id ? y.creditor : y.debtor)));
    const d = chance(w, t.id, 'opens up', 'keeps it close', [term('base', 0.2), term('his trust in you × 0.7', R(x).trust * 0.7)], 0.2, 0.9);
    if (!d.yes) { line(x, `${t.name} gives you a careful look. "We all get along." You can tell there’s more.`, d); return { minutes: 20, skip: true }; }
    line(x, `${t.name} lowers his voice.`, d);
    if (friend) { line(x, `"${first(friend)}’s all right. We talk."`); door.insight(p, t.id, `tie:${friend.id}`); }
    if (foe) { line(x, `"${first(foe)}? We don’t see eye to eye. I’d leave it at that."`); door.insight(p, t.id, `rival:${foe.id}`); }
    if (loan) { const o = w.chars[loan.debtor === t.id ? loan.creditor : loan.debtor]; line(x, loan.debtor === t.id ? `"I owe ${first(o)} a bit. It’s nothing."` : `"${first(o)}’s into me for a bit. He’ll pay."`); door.insight(p, t.id, `loan:${o.id}`); }
    if (!friend && !foe && !loan) line(x, voice(x, 'crew_nothing'));
    const next: Offer[] = [];
    if (foe) next.push({ code: 'about:' + foe.id, label: `What’s the trouble with ${first(foe)}?` });
    if (friend) next.push({ code: 'about:' + friend.id, label: `What’s ${first(friend)} like?` });
    return out(20, next);
  },
};
// his view of another man of the family, in his words; and something he knows of him that the player doesn't, if he trusts him
const members = (c: Ctx) => Object.values(c.w.chars).filter((y) => y.alive && y.id !== c.n.id && y.id !== c.h.id && y.familyId === c.n.familyId && c.n.rels[y.id]).sort((a, b) => (c.n.rels[b.id]?.trust ?? 0) + (c.n.rels[b.id]?.grudge ?? 0) - ((c.n.rels[a.id]?.trust ?? 0) + (c.n.rels[a.id]?.grudge ?? 0))).slice(0, 5);
const about: Act = {
  base: 'about', pane: 'personal',
  repeat: { window: 14, sig: (c, arg) => String(Object.values(c.w.facts).filter((f) => f.actor === arg && c.n.known[f.id] && !c.h.known[f.id]).length) },

  run: (c, code) => {
    const x = T(c), { w, p, t } = x, y = w.chars[code.split(':')[1]];
    if (!y) return out(3);
    const q = t.rels[y.id], nm = first(y), tw = traitWords(y);
    const rel0 = !q ? 'I hardly know him' : q.grudge >= 0.55 ? 'I can’t stand him' : q.grudge >= 0.3 ? 'He and I have our differences' : q.trust > 0.7 ? 'I’d trust him with anything' : q.trust > 0.45 ? 'We get on' : q.trust > 0.25 ? 'I keep an eye on him' : 'I don’t trust him';
    // (what he is, said as a man sums another up: "Violent, and reckless. That’s Mario.", not a list of qualities)
    const ws = tw ? tw.split(/,\s*/).filter(Boolean).slice(0, 2) : [];
    const sum = ws.length ? `${ws[0][0].toUpperCase() + ws[0].slice(1)}${ws[1] ? `, and ${ws[1]}` : ''}. That’s ${nm}.` : '';
    line(x, `“${nm}? ${rel0}.”${sum ? ` He thinks about it. “${sum}”` : ''}`);
    const f = Object.values(w.facts).filter((g) => !g.minor && g.actor === y.id && t.known[g.id] && !p.known[g.id] && !BORING.has(g.kind)).sort((a, b) => b.t - a.t)[0];
    if (f && R(x).trust >= 0.35) {
      line(x, `${voice(x, 'gossip')} ${told(w, t, f, t.known[f.id].knowsActor)}`, settled(t.id, 'tells', 'he trusts you enough (≥ 0.35)'));
      door.learnFrom(w, p, f, t.id, t.known[f.id].knowsActor);
    }
    tweak(x, 0.01);
    return out(20);
  },
};
// which man: he asks the player who, and the men of the family he has views on are what can be asked
const pickMember: Act = {
  base: 'pick_member', pane: 'personal', opens: true,
  offers: (c) => one(inFamily(c.h, c.n) && !!c.n.familyId && members(c).length > 0, offer(c, 'pick_member', 'Ask about one of the others')),
  run: (c) => {
    const x = T(c), tp = temper(x.t), hot = tp.volatility + tp.pride > 1.15;
    line(x, hot ? '“Who? Spit it out.”' : tp.caution > 0.6 ? '“Depends who you mean.”' : '“Who did you have in mind?”');
    return { minutes: 5, next: members(c).map((y) => ({ code: 'about:' + y.id, label: `What do you make of ${y.name}?`, note: y.rank })) };
  },
};
const leaders: Act = {
  base: 'leaders', pane: 'personal',
  repeat: { window: 20, sig: (c) => `${c.n.bossId ?? ''}|${c.n.familyId ? c.w.fam[c.n.familyId].bossId : ''}` },
  offers: (c) => one(inFamily(c.h, c.n) && superior(c) && !isFamilyBoss(c.w, c.n), offer(c, 'leaders', 'Talk about the leadership', 'Who runs what, and who’s rising.')), // (not the boss: he is what runs it)
  run: (c) => {
    const x = T(c), { w, t } = x, r = R(x);
    const boss = t.bossId ? w.chars[t.bossId] : undefined, top = t.familyId ? w.chars[w.fam[t.familyId].bossId] : undefined;
    const says = (y: Character) => { const q = t.rels[y.id], n = first(y), who = y.id === top?.id ? `${n} runs the family` : `I answer to ${n}`;
      return !q ? `“${who}. I barely know the man.”` : q.grudge >= 0.55 ? `“${who}. Don’t get me started.”` : q.grudge >= 0.3 ? `“${who}. We have our differences.”` : q.trust > 0.7 ? `“${who}. I’d trust him with my life.”` : q.trust > 0.45 ? `“${who}. He’s all right. We get on.”` : q.trust > 0.25 ? `“${who}. I watch him, he watches me.”` : `“${who}. I don’t trust him, and he knows it.”`; };
    if (r.trust >= 0.35) for (const y of [boss, top].filter((z, i, a) => z && a.indexOf(z) === i && z.id !== t.id) as Character[]) line(x, says(y), settled(t.id, 'tells', 'he trusts you enough (≥ 0.35)'));
    const unhappy = [boss, top].some((y) => y && (t.rels[y.id]?.grudge ?? 0) >= 0.3);
    if (unhappy && r.trust >= 0.5) line(x, `"You didn’t hear that from me."`);
    else if (r.trust < 0.35) line(x, `He changes the subject. “You ask a lot of questions for a man I hardly know.”`, settled(t.id, 'changes the subject', 'he hardly knows you'));
    return out(25);
  },
};
// ---------------------------------------------------------------- what people say of the player; what is between them
const askRep: Act = {
  base: 'ask_rep', pane: 'personal',
  repeat: { window: 10, sig: (c) => String(Math.round(c.h.standing / 4)) },
  offers: (c) => one(c.n.rank !== 'civilian' && (c.h.cooldown[`rep:${c.n.id}`] ?? 0) <= c.w.now, offer(c, 'ask_rep', 'Ask what people say about you', 'Not always flattering.')),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    door.cool(p, `rep:${t.id}`, w.now + 3 * DAY);
    const lead = ['People say', 'You’ll also hear', 'And some say'];
    line(x, voice(x, 'rep_open'));
    line(x, `“${repLines(w, p).slice(0, 3).map((l, i) => `${lead[i]}, ‘${l.replace(/^“|”$/g, '')}’`).join(' ')}”`);
    return out(10, Object.values(w.facts).some((q) => q.actor === p.id && t.known[q.id] && t.known[q.id].from !== 'self') ? [{ code: 'f_rep_who', label: 'Where did you hear that?' }] : undefined);
  },
};
const repWho: Act = {
  base: 'f_rep_who', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    const f = Object.values(w.facts).filter((q) => q.actor === p.id && t.known[q.id] && t.known[q.id].from !== 'self').sort((a, b) => b.t - a.t)[0];
    const k = f ? t.known[f.id] : undefined, src = k && k.from !== 'public' && k.from !== 'witness' ? w.chars[k.from] : undefined;
    line(x, src && src.id !== p.id ? `${t.name}: “${src.name} said something. I couldn’t tell you if he had it right.”` : k?.from === 'witness' ? `${t.name}: “I was there. I saw some of it.”` : `${t.name}: “It was going round. Nobody owns a story like that.”`);
    if (src && src.id !== p.id) door.trustAtLeast(w, p, src.id, 0.1);
    return out(8);
  },
};
const askHistory: Act = {
  base: 'ask_history', pane: 'personal',
  repeat: { window: 14, sig: (c) => String(Object.values(c.w.facts).filter((f) => f.actor === c.h.id).length) },
  offers: (c) => one(historyLines(c.w, c.h, c.n).length > 0, offer(c, 'ask_history', 'Bring up what’s between you', 'Some things are remembered.')),
  run: (c) => { const x = T(c); for (const l of historyLines(x.w, x.p, x.t)) line(x, l); door.regard(x.w, x.t, x.p.id, 'respect', 0.02, 'remembered together'); return out(5); },
};
// ---------------------------------------------------------------- a man the player has not met
const askAround: Act = {
  base: 'ask_around', pane: 'personal',
  repeat: { window: 30, sig: (c) => `${c.n.rank}|${ownerBiz(c.w, c.n.id)?.id ?? ''}` },
  offers: () => [], // (asking around about a man is not something said to him: removed from the conversation in the overhaul)
  run: (c) => {
    const x = T(c), { w, t } = x;
    const fam = t.familyId ? `the ${w.fam[t.familyId].name} family` : 'nobody in particular';
    const rank = t.rank === 'civilian' ? (ownerBiz(w, t.id) ? `owns ${ownerBiz(w, t.id)!.name}` : 'is nobody you’d need to worry about') : `is ${t.rank === 'associate' ? 'an associate' : 'a ' + t.rank} of ${fam}`;
    const mood = t.traits.violence > 0.65 ? 'People step round him when he’s drinking.' : t.traits.sociability > 0.65 ? 'He’s well liked and he knows it.' : t.traits.greed > 0.65 ? 'He’s a man who counts everything twice.' : 'Nobody has anything much to say about him, which tells you something.';
    c.v.th.asked.push('ask_around');
    c.v.lines.push({ who: 'narr', text: `A couple of quiet questions later you know he ${rank}. ${mood}` });
    return out(30);
  },
};
const intro: Act = {
  base: 'intro', pane: 'personal',
  offers: (c) => { if (!strangerHere(c)) return []; const cd = (c.h.cooldown[`intro:${c.n.id}`] ?? 0) > c.w.now; return cd ? [] : [offer(c, 'intro', 'Introduce yourself', 'Give your name and who you answer to.', 'lead')]; },
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if ((p.cooldown[`intro:${t.id}`] ?? 0) > w.now) { line(x, `${t.name} doesn’t even look up. Not today.`); return out(5); }
    const same = !!p.familyId && p.familyId === t.familyId, high = t.rank === 'capo' || t.rank === 'underboss' || t.rank === 'boss';
    c.v.lines.push({ who: 'narr', text: `You walk over, give your name and tell him who you answer to${p.bossId ? `: ${w.chars[p.bossId].name}` : ''}.` });
    // whether he will know the player: the player's name and manner, the family they share, how high he sits, his caution
    const d = chance(w, t.id, 'takes your hand', 'turns you away', [term('base', 0.5), term('your standing / 220', p.standing / 220), term('your charm × 0.2', p.skills.charm * 0.2), term(same ? 'the same family' : 'another family or none', same ? 0.15 : 0), term(high ? 'a man of his rank' : 'his rank', high ? -0.18 : 0), term('an associate of another family', t.rank !== 'civilian' && p.rank === 'associate' && !same ? -0.1 : 0), term('his caution × 0.08', -t.traits.caution * 0.08)], 0.15, 0.92);
    if (d.yes) { door.introduced(w, p, t); c.v.th.asked.push('met'); tweak(x, 0.05, 0.02, 0.02); line(x, voice(x, 'intro_ok'), d); return out(15); }
    door.turnedAway(w, p, t); tweak(x, 0, 0, -0.02);
    line(x, voice(x, high ? 'intro_no_high' : 'intro_no'), d);
    return { minutes: 10, end: !!c.v.relation };
  },
};
const introVia: Act = {
  base: 'intro_via', pane: 'personal',
  offers: (c) => (!strangerHere(c) ? [] : introducers(c.w, c.h, c.n).map((v) => offer(c, 'intro_via:' + v.id, `“${v.name} sent me.”`, 'A name he trusts opens the door.', 'lead'))),
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, via = w.chars[code.split(':')[1]];
    if (!via?.alive) { line(x, 'He can’t help you with that any more.'); return out(5); }
    door.introduced(w, p, t); c.v.th.asked.push('met'); tweak(x, 0.1, 0.03, 0.03); door.regard(w, via, p.id, 'respect', 0.01);
    c.v.lines.push({ who: 'narr', text: `${first(via) === first(t) ? via.name : first(via)} had a word with ${t.name} before you arrived.` });
    line(x, voice(x, 'vouch', { V: first(via) === first(t) ? via.name : first(via) }), settled(t.id, 'takes your hand', `${first(via)} vouched for you`));
    return out(15);
  },
};
// ---------------------------------------------------------------- a man of another family
const rival = (c: Ctx) => !!c.n.familyId && !!c.h.familyId && c.n.familyId !== c.h.familyId && c.n.rank !== 'civilian';
const famName = (c: Ctx, ch: Character) => (ch.familyId ? c.w.fam[ch.familyId].name : '');
const rvDrink: Act = {
  base: 'rv_drink', pane: 'personal',
  offers: (c) => one(rival(c) && !c.v.th.asked.includes('rv_drink'), offer(c, 'rv_drink', 'Stand him a drink ($30)', 'Courtesy costs little.')),
  run: (c) => {
    const x = T(c); c.v.th.asked.push('rv_drink');
    if (x.p.cash < 30) { line(x, 'You’re short.'); return out(5); }
    door.spend(x.w, x.p, 30, 'a drink across the line');
    c.v.lines.push({ who: 'narr', text: `You buy ${x.t.name} a drink. Two men from different families, one bar. For an hour nobody is anybody’s enemy.` });
    tweak(x, 0.03, 0.05, 0.02);
    return out(40);
  },
};
const rvMood: Act = {
  base: 'rv_mood', pane: 'personal',
  offers: (c) => one(rival(c) && !c.v.th.asked.includes('rv_mood'), offer(c, 'rv_mood', `Ask how things are between ${famName(c, c.h)} and ${famName(c, c.n)}`)),
  run: (c) => {
    const x = T(c); c.v.th.asked.push('rv_mood');
    const tn = c.w.fam[c.h.familyId!]?.tension[c.n.familyId!] ?? 0;
    line(x, tn > 3 ? `${x.t.name} sucks his teeth. "Bad. Men on both sides are counting who owes who. Somebody’s going to do something stupid."` : tn > 1 ? `${x.t.name} tips a hand. "Tense. Not a war. Yet."` : `${x.t.name}: "Quiet. I like quiet."`);
    return out(10);
  },
};
const rvFavour: Act = {
  base: 'rv_favour', pane: 'personal',
  offers: (c) => one(rival(c) && !c.v.th.asked.includes('rv_favour') && R(T(c)).trust > 0.45, offer(c, 'rv_favour', 'Offer a favour across the line', 'It builds a bridge. It may also be noticed.')),
  run: (c) => {
    const x = T(c), { w, p, t } = x; c.v.th.asked.push('rv_favour');
    door.owe(w, p, t, 1, 'did him a good turn across family lines');
    c.v.lines.push({ who: 'narr', text: `You send a small kindness ${t.name}’s way. A man of another family now owes you, quietly. Your own people may not like that.` });
    tweak(x, 0.06, 0.03, 0.02);
    door.heat(p, 0.02);
    return out(15);
  },
};
// gossip with a rival's man: he gives what he hears, or wants a trade first (flows.ts rv_ears)
const rvEars: Act = {
  base: 'rv_ears', pane: 'personal',
  offers: (c) => one(rival(c), offer(c, 'rv_ears', 'Trade a little gossip', 'What’s said in a bar stays in a bar. Mostly.')),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x);
    const stamp = (t.talk ?? {})['rv_ears'];
    if (stamp && Math.floor(w.now / DAY) - stamp.d <= 3) { line(x, '“We did that already. I haven’t heard anything since.”'); return out(3); }
    const give = Object.values(w.facts).filter((f) => !p.known[f.id] && t.known[f.id] && !f.minor && f.kind !== 'report');
    const swap = Object.values(w.facts).filter((f) => p.known[f.id] && !t.known[f.id] && !f.minor && f.kind !== 'report');
    (t.talk ??= {})['rv_ears'] = { d: Math.floor(w.now / DAY), sig: 'x', n: 1 };
    if (!give.length) { line(x, '“Nothing worth a drink.” He shrugs.'); return out(15); }
    if (r.trust < 0.4 && swap.length) {
      line(x, w.rng.pick({ schemer: ['“You want what I hear? Everyone does. What do you have for me?”'], cold: ['“I don’t give. I trade. Bring me something.”'] }[arch(t) as 'schemer'] ?? ['“A fair swap, then. Something I haven’t heard, and I’ll find you something.”']), settled(t.id, 'trades', `he does not trust you enough to give (${r.trust.toFixed(2)} < 0.4)`));
      return out(15, [{ code: 'rv_trade', label: '“Here’s something you didn’t hear from me.”', note: 'He hears it, and so may his people.' }, { code: 'rv_pass', label: '“It isn’t worth it.”' }]);
    }
    const d = chance(w, t.id, 'tells you', 'hears nothing', [term('base', 0.25), term('his trust × 0.5', r.trust * 0.5)], 0.15, 0.8);
    if (d.yes) { const f = w.rng.pick(give); door.learnFrom(w, p, f, t.id, false); line(x, 'He looks around, then lowers his voice. “You didn’t hear it from me.” You have something new to think about.', d); tweak(x, 0.02, 0.01); }
    else line(x, '“I hear nothing,” he says. “That’s why I’m still here.”', d);
    return out(20);
  },
};
const rvTrade: Act = {
  base: 'rv_trade', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    const swap = Object.values(w.facts).filter((f) => p.known[f.id] && !t.known[f.id] && !f.minor && f.kind !== 'report');
    const give = Object.values(w.facts).filter((f) => !p.known[f.id] && t.known[f.id] && !f.minor && f.kind !== 'report');
    if (!swap.length || !give.length) { line(x, '“Nothing there I can use.” The swap does not happen.'); return out(5); }
    const a = w.rng.pick(swap), b = w.rng.pick(give);
    door.learnFrom(w, t, a, p.id, true); door.learnFrom(w, p, b, t.id, false);
    tweak(x, 0.03, 0.01, 0.02);
    line(x, 'He listens without a flicker, then nods. “That’s fair.” And he gives you his in return.');
    return out(20);
  },
};
const rvPass: Act = { base: 'rv_pass', pane: 'personal', run: (c) => { line(T(c), '“Suit yourself.” He goes back to his drink.'); return out(5); } };

export const PERSONAL: Act[] = [how, fHurt, fBiz, fHelp, leaveIt, helpGift, helpLoan, welcome, congrats, oldTimes, askWant, fWant, askCrew, pickMember, about, leaders, askRep, repWho, askHistory, askAround, intro, introVia, rvDrink, rvMood, rvFavour, rvEars, rvTrade, rvPass];
