// The family (Gate 4, from the old engine's family, orders, boss, crew and recruitment leaves and its standing follow-ups): work and
// orders, work he offers and work done, where the player stands and what it would take to move up, a word put in, a man to back him, a
// concern about a man, the player's own men (what is wrong, help, a light envelope, looking into it, thin ice, keeping low, finding more),
// and taking a man on. Each: offered under the old engine's conditions, decided in the layer's record, done through doors.ts.
import { askBetween } from '../../asks';
import { readiness } from '../../career';
import { clamp, peek } from '../../core';
import { jobSaid, staleReason, standingWord } from '../../jobs';
import { pathInfo } from '../../path';
import { PROBLEM_LABEL } from '../../people';
import { RECRUIT_COST } from '../../orders';
import { lineOf } from '../../rackets';
import { temper, viewOf } from '../../temper';
import { arch } from '../../voice';
import { DAY, type Character, type Id, type Job, type World } from '../../types';
import * as door from '../doors';
import { chance, settled, term } from '../decide';
import { agoWords, him, lastOf, line as mine, plain, remember, type Act, type Ctx, type Offer } from '../kit';
import { first, line, out, R, T, tweak, voice } from './common';
import { inFamily, isSuperior } from './words';
import { said } from './personal';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const RANKS = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const rk = (c: Character) => RANKS.indexOf(c.rank);
const offer = (c: Ctx, code: string, label: string, note?: string, kind?: Offer['kind']): Offer => ({ code, label: said(c, code, label), note, kind });
const isBoss = (c: Ctx) => c.n.id === c.h.bossId;
const crewMan = (c: Ctx) => c.n.bossId === c.h.id;
const superior = (c: Ctx) => rk(c.n) > rk(c.h) || c.n.id === c.h.bossId;
const asked = (c: Ctx, k: string) => c.v.th.asked.includes(k);
const ask = (c: Ctx, k: string) => { c.v.th.asked.push(k); };
type Pool = Partial<Record<string, string[]>> & { _: string[] };
const pick = (w: World, t: Character, pool: Pool) => w.rng.pick(pool[arch(t)] ?? pool._);
const drop: Offer = { code: 'fl_drop', label: '“Let’s leave it there.”' };
// where the player and he stand: over him, under him, peers, of another family, or he is outside the life
function stanceOf(w: World, p: Character, t: Character): 'over' | 'under' | 'peer' | 'rival' | 'outside' {
  if (t.rank === 'civilian') return 'outside';
  if (p.familyId && t.familyId && p.familyId !== t.familyId) return 'rival';
  const chain = (x: Character) => { const o = new Set<Id>(); let q: Character | undefined = x; for (let i = 0; i < 6 && q?.bossId; i++) { o.add(q.bossId); q = w.chars[q.bossId]; } return o; };
  if (chain(t).has(p.id) || rk(p) > rk(t)) return 'over';
  if (chain(p).has(t.id) || rk(t) > rk(p)) return 'under';
  return 'peer';
}
const stamp = (w: World, t: Character, key: string) => { (t.talk ??= {})[key] = { d: Math.floor(w.now / DAY), sig: 'x', n: 1 }; };
const recent = (w: World, t: Character, key: string, days: number) => { const m = t.talk?.[key]; return !!m && Math.floor(w.now / DAY) - m.d <= days; };
const orders = (c: Ctx) => inFamily(c.h, c.n) || c.w.jobs.some((j) => j.giver === c.n.id && j.assignee === c.h.id && (j.status === 'active' || j.status === 'done'));

// ---------------------------------------------------------------- work
const work: Act = {
  base: 'work', pane: 'business',
  offers: (c) => (orders(c) && !crewMan(c) && !isBoss(c) ? [offer(c, 'work', 'Ask if there’s work')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, n0 = w.jobs.length;
    if (t.id === p.bossId) door.bossWork(w);
    // (a made man of the family has his own affairs, and what they need is what he puts the player's way: work.needsOf)
    else if (inFamily(p, t) && ['soldier', 'capo', 'underboss'].includes(t.rank)) door.peerWork(w, t, p);
    else { const d = chance(w, t.id, 'puts something your way', 'has nothing', [term('base', 0.35), term('his trust in you × 0.5', R(x).trust * 0.5)]); if (d.yes) door.offerWork(w, t, false, true); }
    line(x, voice(x, w.jobs.length > n0 ? 'work_some' : t.id === p.bossId ? 'work_boss_none' : 'work_none'));
    // (work he has just put to the player is answered now, to his face: take it or not)
    if (w.jobs.length > n0) { const j = w.jobs.at(-1)!; line(x, jobSaid(j)); if (j.status === 'offered' && j.giver === t.id) { c.v.th.raised.push('job:' + j.id); return { minutes: 25, next: jobOffer.offersFor!(c, j.id) }; } }
    return out(25);
  },
};
const bNeed: Act = {
  base: 'b_need', pane: 'business',
  offers: (c) => (isBoss(c) && !asked(c, 'b_need') ? [offer(c, 'b_need', 'Ask what he needs done', 'It could be anything.')] : []),
  run: (c) => { const x = T(c), { w, t } = x, n0 = w.jobs.length; ask(c, 'b_need'); const held = inHandFrom(c); if (held) { line(x, `"You’ve still got ${held.title.length <= 48 ? `‘${held.title}’` : 'what I gave you'}. Finish that first."`); return out(5); } if (door.bossWork(w) || w.jobs.length > n0) { const j = [...w.jobs].reverse().find((q) => q.giver === t.id && q.status === 'offered' && q.assignee === x.p.id) ?? w.jobs.at(-1)!; /* (his work: the job may be one already on the books, not the newest record) */ c.v.lines.push({ who: 'narr', text: `${t.name} thinks a moment.` }); line(x, jobSaid(j)); c.v.th.raised.push('job:' + j.id); return { minutes: 15, next: jobOffer.offersFor!(c, j.id) }; } else line(x, `${t.name} waves a hand. "Nothing now. Don’t look for work. It finds you."`); return out(15); },
};
const bMore: Act = {
  base: 'b_more', pane: 'business',
  // (a man asks for more once he has shown what he does with what he has: work finished, or money passed up)
  offers: (c) => (isBoss(c) && !asked(c, 'b_more') && c.h.rank !== 'boss' && ((c.h.career?.done ?? 0) >= 1 || c.h.lifetimeKick > 0) ? [offer(c, 'b_more', 'Ask for a bigger piece', 'More ground and more risk.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, rd = readiness(w, p); ask(c, 'b_more');
    const d = chance(w, t.id, 'gives you more', 'says you are not ready', [term('base', 0.15), term('his trust in you × 0.5', R(x).trust * 0.5), term('your standing / 250', p.standing / 250), term('what you have passed up, × 0.15', (rd?.earn ?? 0) * 0.15)], 0.1, 0.85);
    if (d.yes) { const n0 = w.jobs.length; door.bossWork(w); line(x, `${t.name} studies you. "You want more? Fine. Don’t make me regret it."${w.jobs.length > n0 ? ' He has something bigger in mind, and he’ll send word.' : ''}`, d); tweak(x, 0.0, 0, 0.03); }
    else { line(x, '"You’re not ready for more. A man who asks for more before he’s handled what he’s got is asking for trouble."', d); tweak(x, -0.02, 0, -0.02); }
    return out(20);
  },
};
// work he has put the player's way and is waiting to hear about: raised by him, answered to his face
// (a summons is not work to take care of: it is attended, where it is called; coffee he asked the player to is this conversation)
const offered = (c: Ctx) => c.w.jobs.find((j) => j.giver === c.n.id && j.status === 'offered' && j.kind !== 'summons' && (!j.assignee || j.assignee === c.h.id) && !staleReason(c.w, j));
// work of his the player already has in hand: he does not hand out more on top of it, and says so
const inHandFrom = (c: Ctx) => c.w.jobs.find((j) => j.giver === c.n.id && j.status === 'active' && j.assignee === c.h.id && j.kind !== 'summons');
const hasAsk = (c: Ctx) => c.w.enc.some((e) => e.status === 'open' && e.from === c.n.id && e.expires > c.w.now && e.opts.length);
const jobOffer: Act = {
  base: 'job', pane: 'business', opens: true,
  // (once he has put it to the player in this visit, coming back to it is "about that work", not asking whether he has any)
  offers: (c) => { const j = offered(c); return j && !hasAsk(c) ? [{ code: 'job:' + j.id, label: (() => { const k = workTo(c, j); return k ? `About the work he wants done: ${k.rest}` : `About what he asked: ${j.title}`; })(), says: c.v.th.raised.includes('job:' + j.id) ? 'About that work you mentioned.' : 'You had something for me?', note: `${j.pay ? `Pays ${money(j.pay)}. ` : ''}He wants an answer.`, kind: 'his' }] : []; },
  offersFor: (c, id) => { const j = c.w.jobs.find((q) => q.id === id && q.status === 'offered'); return j ? [{ code: 'jobtake:' + j.id, label: 'I’ll take care of it', note: j.pay ? `It’s yours. Pays ${money(j.pay)}.` : j.kind === 'lean' ? 'It’s yours. Nothing up front: once he pays, the shop is on your book and the weekly money comes to you.' : 'It’s yours. There’s no money in it; it’s for him.' }, { code: 'jobpass:' + j.id, label: 'Not this time', note: 'He will think a little less of you for it.' }] : []; },
  run: (c, code) => {
    const x = T(c), id = code.split(':')[1], j = c.w.jobs.find((q) => q.id === id);
    if (!j) return out(2);
    // (said once in a visit; asked about again, he wants his answer)
    if (c.v.th.raised.includes('job:' + id)) line(x, temper(x.t).volatility > 0.55 ? '“So? Are you taking it or not?”' : '“So. Will you take care of it?”');
    else { line(x, jobSaid(j)); if (j.brief) line(x, j.brief); c.v.th.raised.push('job:' + id); }
    return { minutes: 2, next: jobOffer.offersFor!(c, id) };
  },
};
const jobAnswer = (take: boolean): Act => ({
  base: take ? 'jobtake' : 'jobpass', pane: 'business',
  run: (c, code) => {
    const x = T(c), { w, t } = x, j = w.jobs.find((q) => q.id === code.slice(8) && q.status === 'offered');
    if (!j) { line(x, '“That’s been dealt with.”'); return out(2); }
    const tp = temper(t);
    if (take) door.takeWork(w, j); else door.passWork(w, j);
    line(x, take ? (tp.agreeable > 0.55 ? '“Good. I knew I could count on you.”' : '“Good. Don’t make a mess of it.”') : tp.pride > 0.6 ? '“Fine. I’ll remember you were too busy.”' : '“All right. Somebody else, then.”');
    return out(5);
  },
});
// work done, told to the man it was done for (he rewards it: the old engine's report)
const unreported = (c: Ctx) => c.w.jobs.filter((j) => j.status === 'done' && j.kind !== 'summons' && j.giver === c.n.id && j.assignee === c.h.id && !j.reported);
const report: Act = {
  base: 'report', pane: 'business',
  offers: (c) => (orders(c) && unreported(c).length ? [{ code: 'report', label: 'Tell him how the job went', says: mine(c, 'report.job'), kind: 'between' }] : []),
  run: (c) => { const x = T(c); door.reportJobs(x.w, x.p, x.t); c.v.lines.push({ who: 'narr', text: `You walk ${x.t.name.split(' ')[0]} through what you did. He seems satisfied.` }); return out(20); },
};
const activeOrders = (c: Ctx) => c.w.jobs.filter((q) => q.status === 'active' && q.giver === c.n.id && q.assignee === c.h.id && (q.via === 'boss' || q.via === 'tip')).slice(0, 2);
// the work, said to the man who gave it: "he wants Vito dealt with", never his own name back at him ("Frankie wants Vito dealt with")
const workTo = (c: Ctx, j: Job) => { const g = j.giver ? c.w.chars[j.giver] : undefined, m = g ? new RegExp(`^${g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (wants|says) `).exec(j.title) : null; return m ? { verb: m[1] === 'says' ? 'say' : 'want', rest: j.title.slice(m[0].length) } : undefined; };
const challenge: Act = {
  base: 'challenge', pane: 'confront',
  offers: (c) => (orders(c) ? activeOrders(c).map((j) => { const k = workTo(c, j); return offer(c, 'challenge:' + j.id, k ? `Ask why you ${k.verb} ${k.rest}` : `Ask why: "${j.title}"`, 'Is it what he says it is?'); }) : []),
  conduct: (c) => { if (rk(c.n) > rk(c.h)) door.conduct(c.h, 'defied'); },
  run: (c, code) => {
    const x = T(c), { w, t } = x, j = w.jobs.find((q) => q.id === code.split(':')[1]) as Job, cause = j?.cause ? w.facts[j.cause] : undefined;
    if (cause && j.target) {
      const k = t.known[cause.id], s = w.chars[j.target];
      if (k?.knowsActor && cause.actor === s.id) line(x, `"He did it. I’m certain." You believe him.`);
      else if (k && !k.knowsActor) line(x, `${t.name} hesitates. "I can’t prove it was ${s.name}. But who else would it be?" He’s guessing.`);
      else line(x, `${t.name} won’t say how he knows.`);
    } else line(x, '"Because I said so." That’s all you get.');
    tweak(x, -0.01);
    return out(15);
  },
};
const refuse: Act = {
  base: 'refuse', pane: 'confront',
  offers: (c) => (orders(c) ? activeOrders(c).map((j) => { const k = workTo(c, j); return offer(c, 'refuse:' + j.id, k ? 'Tell him you won’t do it' : `Refuse: "${j.title}"`, k ? `${k.rest.charAt(0).toUpperCase() + k.rest.slice(1)}. He won’t like it.` : 'He won’t like it.'); }) : []),
  conduct: (c) => { if (rk(c.n) > rk(c.h)) door.conduct(c.h, 'defied'); },
  run: (c, code) => { const x = T(c), j = x.w.jobs.find((q) => q.id === code.split(':')[1]) as Job; door.refuseJob(x.w, x.p, j); tweak(x, -0.1, -0.04, -0.06); line(x, `${x.t.name} doesn’t argue. That’s worse. "Noted."`); return out(15); },
};
// ---------------------------------------------------------------- where the player stands
const bStand: Act = {
  base: 'b_stand', pane: 'personal',
  offers: (c) => (isBoss(c) && !asked(c, 'b_stand') ? [offer(c, 'b_stand', 'Ask where you stand', 'He’ll tell you what he thinks, in his way.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, pi = pathInfo(w, p); ask(c, 'b_stand');
    if (!pi) line(x, `${t.name} looks at you for a long moment. "You’re where you should be. There’s nowhere higher for you to ask about."`);
    else {
      const trust = Math.round(R(x).trust * 100);
      line(x, `${t.name} leans back. "You want to know? ${trust >= 70 ? 'I trust you. That’s rare.' : trust >= 45 ? 'You’re all right. Not more than that yet.' : 'I’m still deciding about you.'}"`);
      const left = pi.goals.filter((g) => !g.done);
      line(x, left.length ? `"To be a ${pi.to}," he says, "${left[0].tip.charAt(0).toLowerCase() + left[0].tip.slice(1)}"` : '"You\'ve done what was asked. You\'ll hear from me."');
    }
    tweak(x, 0.01);
    return out(20);
  },
};
// What a man who can speak to it says when asked about moving up: from the road the family actually holds him to (path.ts), the gaps
// that matter most first, and against what he said the last time: what has come on since, or that nothing has (Gate 3's doAdvance)
const GOAL_RANK: Record<string, number> = { earn: 0, sponsor: 1, deeds: 2, kills: 3, name: 4, trial: 5 };
// how far off he is on one part of the road, as a captain would say it: no figures, no tally, only what it amounts to
function howFar(g: { key: string; frac: number }, h: Character, w: World): string {
  const f = g.frac, sp = g.key === 'sponsor';
  if (g.key === 'earn') return f < 0.1 ? 'You’ve hardly passed anything up.' : f < 0.4 ? 'You’ve started passing money up. It’s a start, not more.' : f < 0.75 ? 'You’re passing up a fair amount. Not enough yet.' : 'You’re close on the money.';
  if (g.key === 'deeds') return f < 0.01 ? 'I haven’t seen you finish anything for me.' : f < 0.5 ? 'You’ve done a job or so. Not enough to talk about.' : 'You’re getting there with the work.';
  if (sp) { const s = h.backer && w.chars[h.backer]?.alive ? w.chars[h.backer] : undefined; return f < 0.34 ? (s ? `${s.name.split(' ')[0]}’s word on its own isn’t enough.` : 'Right now nobody would.') : f < 0.99 ? 'A man or two would. It wants more than that.' : 'You’ve the men. Now one of them has to put your name forward.'; }
  return '';
}
const GOAL_WORD: Record<string, string> = { earn: 'the money you pass up', deeds: 'the work', kills: 'the hard work', name: 'what people say of you', sponsor: 'the men who would back you', trial: 'your proof' };
const promo: Act = {
  base: 'promo', pane: 'business',
  offers: (c) => (inFamily(c.h, c.n) && superior(c) ? [offer(c, 'promo', 'Talk about moving up')] : []),
  run: (c) => {
    const { w, h, n } = c;
    const canSay = ['capo', 'underboss', 'boss'].includes(n.rank) || n.id === h.bossId;
    const info = canSay ? pathInfo(w, h) : undefined, rd = canSay ? readiness(w, h) : undefined;
    if (!canSay || !info) { him(c, plain(n.id, canSay ? 'advance.top' : 'advance.notMe')); return out(15); }
    const lvl = (g: { done: boolean; frac: number }) => (g.done ? 4 : Math.floor(g.frac * 4));
    const sig = info.goals.map((g) => `${g.key}=${lvl(g)}`).join(',') + `|${standingWord(h.standing)}|${Math.round(h.standing)}`;
    const prev = lastOf(w, n.id, 'advance'), was = Object.fromEntries((prev?.sig ?? '').split('|')[0].split(',').filter(Boolean).map((q) => q.split('=')));
    const gaps = info.goals.filter((g) => !g.done).sort((a, b) => (GOAL_RANK[a.key] ?? 9) - (GOAL_RANK[b.key] ?? 9) || a.frac - b.frac);
    const better = prev ? info.goals.filter((g) => was[g.key] !== undefined && lvl(g) > Number(was[g.key])) : [];
    const worse = prev ? info.goals.filter((g) => was[g.key] !== undefined && lvl(g) < Number(was[g.key])) : [];
    const word = standingWord(h.standing), wordWas = prev?.sig?.split('|')[1], stWas = Number(prev?.sig?.split('|')[2] ?? h.standing);
    const nameUp = wordWas && wordWas !== word && h.standing > stWas, nameDown = wordWas && wordWas !== word && h.standing < stWas;
    if (prev && (prev.sig ?? '').split('|').slice(0, 2).join('|') === sig.split('|').slice(0, 2).join('|')) him(c, plain(n.id, 'advance.same', { ago: agoWords(w.now, prev.t) }, 'flat'));
    else if (prev && (worse.length || nameDown) && !better.length && !nameUp) him(c, plain(n.id, 'advance.worse', { ago: agoWords(w.now, prev.t), what: worse.length ? GOAL_WORD[worse[0].key] ?? 'the work' : `what people call you: ${word} now, not ${wordWas}` }, 'cold'));
    else if (prev && (better.length || nameUp)) him(c, plain(n.id, 'advance.better', { ago: agoWords(w.now, prev.t), what: better.length ? GOAL_WORD[better[0].key] ?? 'the work' : `what people call you: ${word} now` }, 'warm'));
    else him(c, plain(n.id, 'advance.open', { standing: word }, 'flat'));
    if (!gaps.length) him(c, plain(n.id, rd?.openSeat ? 'advance.ready' : 'advance.noSeat'));
    for (const g of gaps.slice(0, 2)) him(c, plain(n.id, 'advance.gap.' + (g.key === 'trial' && g.note.startsWith('waiting') ? 'trialOpen' : g.key), { how: howFar(g, h, w), standing: word, label: g.label }, 'flat'));
    remember(w, n.id, 'advance', 'asked', sig);
    return out(15);
  },
};
// a word put in for the player with the family's boss: his decision, on how far he trusts the player
const rkOffered = (c: Ctx) => inFamily(c.h, c.n) && c.h.rank === 'associate' && c.n.rank !== 'associate' && c.n.rank !== 'civilian' && c.h.backer !== c.n.id && c.n.id !== c.h.bossId;
const recommend: Act = {
  base: 'recommend', pane: 'business',
  offers: (c) => (inFamily(c.h, c.n) && c.n.rank !== 'associate' && c.n.rank !== 'civilian' && !rkOffered(c) ? [offer(c, 'recommend', 'Ask him to put in a word for you')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    const d = chance(w, t.id, 'puts in a word', 'will not', [term('his trust in you × 0.9', R(x).trust * 0.9)], 0.1, 0.9);
    if (d.yes) { const boss = w.chars[w.fam[t.familyId!].bossId]; if (boss && boss.id !== t.id) door.regard(w, boss, p.id, 'respect', 0.05); door.owe(w, t, p, 1, 'put in a word for you'); line(x, voice(x, 'recommend_yes'), d); }
    else line(x, voice(x, 'recommend_no'), d);
    return out(25);
  },
};
// ---------------------------------------------------------------- being backed (flows.ts): he answers from his own position
const rkBack: Act = {
  base: 'rk_back', pane: 'business',
  offers: (c) => (rkOffered(c) ? [offer(c, 'rk_back', 'Ask him to back you', 'A made man’s word is how an associate gets made.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x);
    if (p.backer === t.id) { line(x, '“I’m already speaking for you. Don’t ask twice.”'); return out(5); }
    if (recent(w, t, 'rk_back_no', 5) && !(r.trust >= 0.5 && r.respect >= 0.35)) { line(x, '“I gave you my answer. Nothing’s changed since.”'); return out(5); }
    const trustOk = r.trust >= 0.5, respectOk = r.respect >= 0.35;
    // a favour he owes the player is the best reason there is: he can repay it with his word
    const owedFav = w.favours.find((q) => !q.settled && q.from === p.id && q.to === t.id);
    if (owedFav && r.respect >= 0.3) {
      line(x, pick(w, t, { proud: ['“You got Nicky out when you didn’t have to. I keep my debts. My name is yours, once.”'], hothead: ['“You did right by me. I don’t forget. Fine. I’ll say your name.”'], _: ['“I owe you. This is a fair way to square it. I’ll speak for you.”'] }), settled(t.id, 'repays the favour', 'he owes you, and respects you enough (≥ 0.3)'));
      return out(15, [{ code: 'back_call', label: '“You owe me one. I’m calling it in.”', note: 'He speaks for you and the debt is cleared. You can only spend it once.' }, ...(trustOk && respectOk ? [{ code: 'back_take', label: '“Keep it. I’ll owe you one instead.”', note: 'He speaks for you. You owe him, and he still owes you.' }] : []), drop]);
    }
    if (!trustOk || !respectOk) {
      // (each man refuses as himself: what his name is worth to him, how he puts things, and how well he knows the player)
      const met = (r.known ?? 0) >= 0.4;
      line(x, !trustOk ? pick(w, t, {
        cold: ['“I don’t put my name on men I haven’t watched. I haven’t watched you.”', '“No. I don’t know what you’d do with it.”'],
        proud: ['“My name is worth something. I don’t spend it on a man I barely know.”', '“Men have earned less than my name and asked for it. No.”'],
        frightened: ['“If it goes wrong, it goes wrong on me. I can’t. Not yet.”'],
        hothead: [met ? '“I’ve seen you around. Seeing isn’t trusting. No.”' : '“Who are you to ask me that? Earn it first.”'],
        jovial: [met ? '“Ha. Buy me a few more drinks first, my friend. Then we’ll see.”' : '“You don’t waste time, do you? Let me get to know you first.”'],
        schemer: ['“And what would it do for me, if you turned out wrong? Let’s wait and see what you turn out to be.”'],
        bitter: ['“Men asked me that before. Some of them I regret. Not yet.”'],
        earnest: ['“I’d want to be sure of you before I say your name to anyone. I’m not sure yet. I’m sorry.”'],
        _: [met ? '“I know you a little. Not enough to put my name on you. Give it time.”' : '“I don’t know you well enough to put my name on you. Come back when I do.”'],
      }) : pick(w, t, {
        cold: ['“I like you fine. But nobody I’d say your name to would take it seriously yet.”'],
        proud: ['“You’re all right. But nobody’s heard of you. My name next to yours would look like charity.”'],
        hothead: ['“Do something people talk about. Then come and ask.”'],
        jovial: ['“You’re a good kid. Nobody upstairs knows it yet, that’s the trouble.”'],
        schemer: ['“Trust isn’t the problem. Nobody owes you anything yet. Make them owe you.”'],
        _: ['“It isn’t that I don’t trust you. It’s that you haven’t been seen doing much yet.”', '“People don’t know what you’re worth. Make them know, then ask me.”'],
      }), settled(t.id, 'not yet', !trustOk ? `he does not trust you enough (${r.trust.toFixed(2)} < 0.5)` : `you have not earned his respect (${r.respect.toFixed(2)} < 0.35)`));
      stamp(w, t, 'rk_back_no');
      return out(15, [{ code: 'back_what', label: '“What would you need to see from me?”' }, drop]);
    }
    line(x, pick(w, t, { proud: ['“I’ll say your name when it matters. A man who speaks for another is owed for it, though. You’ll understand that.”'], cold: ['“I can do it. It puts you in my pocket a little. That’s how it works.”'], jovial: ['“Sure, I’ll put in a word. Don’t forget who did, that’s all.”'], _: ['“I’ll speak for you. But if I put my name on you, you owe me. Fair?”'] }), settled(t.id, 'will, for a debt', 'he trusts (≥ 0.5) and respects (≥ 0.35) you'));
    return out(20, [{ code: 'back_take', label: '“All right. I’ll owe you one.”', note: 'He speaks for you. You owe him a favour, and he can call it in.' }, { code: 'back_press', label: '“I’d rather not owe anybody.”', note: 'He may do it for less. He may not like being haggled with.' }, drop]);
  },
};
// (what he would need to see, said as things the player can actually do and he will actually notice: his envelope handed over in
// person on Sunday, work done for him or his captain, his word kept. The agreement it leaves says the same, so Your word shows it.)
// (what he'd need to see: his own captain watches the envelope he is handed; any other made man watches the work he puts the player's
// way, and hears the rest from the player's captain)
const backWhat: Act = { base: 'back_what', pane: 'business', run: (c) => { const x = T(c), r = R(x), mine = x.p.bossId === x.t.id, cap = x.p.bossId ? x.w.chars[x.p.bossId] : undefined;
  if (!mine && r.trust < 0.5) {
    line(x, pick(x.w, x.t, { cold: [`“When I have work, I’ll put some your way. Finish it. The rest I’ll hear from ${cap ? cap.name.split(' ')[0] : 'your captain'}.”`], jovial: [`“Do a thing or two for me when I need a hand, and do it right. And keep ${cap ? cap.name.split(' ')[0] : 'your captain'} happy. He talks, you know.”`], _: [`“Do some work for me when I have it, and finish it. Keep your word. ${cap ? cap.name.split(' ')[0] : 'Your captain'} and I talk.”`] }));
    door.memoOnce(x.w, x.t, x.p.id, 'agreement', `He wants to see you finish work he puts your way, and hear well of you from ${cap ? cap.name : 'your captain'}, before he’ll speak for you.`);
    return out(10);
  }
  line(x, r.trust < 0.5 ? pick(x.w, x.t, { cold: ['“Your envelope, in person, every Sunday. Work finished when you say it will be. Do that and I’ll notice.”'], jovial: ['“Bring your envelope in yourself on Sundays, finish what you’re given, don’t make a liar of yourself. I’ll be watching, friend.”'], _: ['“Hand your envelope over in person, Sunday after Sunday. Finish the work you’re given. Keep your word to people. I’ll hear about it either way.”'] }) : pick(x.w, x.t, { _: ['“Do something people notice. Finish a job for the family, or stand up for one of ours. Then I’ll have something to say.”'] })); door.memoOnce(x.w, x.t, x.p.id, 'agreement', r.trust < 0.5 ? 'He wants to see your envelope in person on Sundays, your work finished and your word kept, before he’ll speak for you.' : 'He wants to see you finish a job for the family, or stand up for one of ours, before he’ll speak for you.'); return out(10); } };
const backCall: Act = { base: 'back_call', pane: 'business', run: (c) => { const x = T(c), { w, p, t } = x; if (!door.settleFavour(w, p.id, t.id)) { line(x, '“There’s nothing outstanding between us.”'); return out(3); } door.setBacker(p, t); door.memoOnce(w, t, p.id, 'agreement', 'He repaid what he owed you by agreeing to speak for you.'); tweak(x, 0.02, 0, 0.04); line(x, '“Done. We’re square, and I’ll say your name when it matters.”'); return out(15); } };
const backTake: Act = { base: 'back_take', pane: 'business', run: (c) => { const x = T(c), { w, p, t } = x; door.setBacker(p, t); door.owe(w, t, p, 2, 'agreed to speak for you'); tweak(x, 0.03, 0, 0.03); line(x, '“Done. I’ll say your name when it matters. If you shame me, I’ll say that too.”'); return out(15); } };
const backPress: Act = {
  base: 'back_press', pane: 'business',
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x);
    const d = chance(w, t.id, 'does it for less', 'will not haggle over his name', [term('base', 0.2), term('his respect − 0.35, × 0.9', (r.respect - 0.35) * 0.9), term('his trust − 0.5, × 0.4', (r.trust - 0.5) * 0.4), term('your standing / 400', p.standing / 400)], 0.1, 0.8);
    if (d.yes) { door.setBacker(p, t); door.owe(w, t, p, 1, 'agreed to speak for you, for a smaller debt'); tweak(x, 0.02, 0, 0.04); line(x, 'He weighs you up. “You drive a hard bargain for a man asking a favour. All right. A small one.”', d); return out(15); }
    tweak(x, -0.04, -0.02, -0.03);
    line(x, '“Then we’re done. I don’t haggle over my name.” He is not angry, only closed to it.', d);
    stamp(w, t, 'rk_back_no');
    return out(10, [{ code: 'back_take', label: '“All right. Your terms.”', note: 'He may still do it, with a worse taste in his mouth.' }, drop]);
  },
};
const rkBackAsk: Act = {
  base: 'rk_back_ask', pane: 'personal',
  offers: (c) => (inFamily(c.h, c.n) && c.h.backer === c.n.id && c.h.rank === 'associate' ? [offer(c, 'rk_back_ask', 'Ask what he’s said about you', 'He’s your backer.')] : []),
  run: (c) => { const x = T(c); line(x, R(x).trust >= 0.7 ? '“I told them you’re solid. Don’t make a liar of me.”' : '“I said you’re coming along. That’s all I’ve said, and all I’ll say.”'); return out(10); },
};
const flDrop: Act = { base: 'fl_drop', pane: 'business', run: (c) => { c.v.lines.push({ who: 'narr', text: 'You leave it at that.' }); return out(3); } };
// ---------------------------------------------------------------- a concern about a man, told to a man above him
// What the player actually has on a man, if anything: money he has seen go missing, or something the man did that the player knows he
// did, against the family or what it looks after. A grudge of his own is an opinion, not something to tell (it is offered, and heard as
// such). Only men he has something on are named: telling tales with nothing in them is not a way to win a captain's trust.
function onHim(c: Ctx, y: Character): { what: string; evidence: boolean } | undefined {
  const { w, h: p } = c, fl = p.books.flags[y.id];
  if (fl?.amt) return { what: `You have noticed ${money(Math.round(fl.amt))} missing.`, evidence: true };
  const f = Object.values(w.facts).filter((f) => f.actor === y.id && p.known[f.id]?.knowsActor && ['beating', 'vandalism', 'robbery', 'theft', 'burglary', 'poach', 'scam'].includes(f.kind) && w.now - f.t < 45 * DAY && (w.chars[f.victim ?? '']?.familyId === p.familyId || (!!f.business && w.biz[f.business]?.protection?.familyId === p.familyId))).sort((a, b) => b.t - a.t)[0];
  if (f) return { what: `You know what he did: ${f.text.replace(/\.$/, '')}.`, evidence: true };
  if ((p.rels[y.id]?.grudge ?? 0) >= 0.3) return { what: 'You have no time for him. It is your word against his.', evidence: false };
  return undefined;
}
const concernMen = (c: Ctx) => Object.values(c.w.chars).filter((y) => y.alive && y.id !== c.n.id && y.id !== c.h.id && y.familyId === c.n.familyId && y.rank !== 'boss' && !!onHim(c, y)).sort((a, b) => Number(!!onHim(c, b)?.evidence) - Number(!!onHim(c, a)?.evidence) || (a.id < b.id ? -1 : 1)).slice(0, 5);
const pickConcern: Act = {
  base: 'pick_concern', pane: 'business', opens: true,
  offers: (c) => (inFamily(c.h, c.n) && superior(c) && concernMen(c).length ? [offer(c, 'pick_concern', 'Tell him something about a man')] : []),
  run: (c) => {
    const x = T(c);
    line(x, R(x).trust < 0.35 ? '“About who? Careful how you say it.”' : '“Go on. About who?”');
    return { minutes: 5, next: concernMen(c).map((y) => ({ code: 'concern:' + y.id, label: `About ${y.name}`, note: onHim(c, y)?.what })) };
  },
};
const concern: Act = {
  base: 'concern', pane: 'business',
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, y = w.chars[code.split(':')[1]], fl = p.books.flags[y.id], has = onHim(c, y);
    if (!isSuperior(w, y, t) && y.bossId !== t.id && t.rank === 'associate') { line(x, `${t.name} shrugs. "I’m the wrong man to tell."`); return out(15); }
    // (nothing but his own opinion: heard, and weighed as that, and a man who carries tales about men he simply dislikes is noted)
    if (!has?.evidence) { line(x, pick(w, t, { cold: ['“That’s what you think of him. Bring me something I can use.”'], proud: ['“I don’t deal in what one man thinks of another.”'], _: ['“So you don’t like him. That isn’t news, and it isn’t a reason.”', '“Come back when you have more than a feeling.”'] })); tweak(x, 0, 0, -0.01); return out(15); }
    // (told once is told: the same thing about the same man again, within a fortnight, is a man repeating himself)
    if (recent(w, t, 'concern:' + y.id, 14)) { line(x, `“You told me about ${first(y)}. I heard you the first time.”`); return out(5); }
    stamp(w, t, 'concern:' + y.id);
    if (y.bossId === t.id && fl?.amt) door.reportSkimming(w, t, y, { amt: fl.amt, n: Math.max(2, fl.n), last: w.now });
    line(x, voice(x, 'concern_ok', { X: first(y) }));
    // (whether word gets back to the man: three times in ten, as it always has)
    if (chance(w, t.id, 'it gets back to him', 'it stays between you', [term('three in ten', 0.3)]).yes) door.grudge(w, y, p.id, 0.1, `${p.name} raised doubts about him`);
    tweak(x, 0.02, 0, 0.02);
    return out(25);
  },
};
// ---------------------------------------------------------------- the player's own men
const crewRows = (c: Ctx): Offer[] => CREW.flatMap((a) => a.offers?.(c) ?? []).map((o) => ({ ...o, kind: undefined }));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const crAsk: Act = {
  base: 'cr_ask', pane: 'personal',
  offers: (c) => (crewMan(c) && c.n.problem && !c.n.problem.revealed && !asked(c, 'cr_ask') ? [{ ...offer(c, 'cr_ask', 'Ask if something is wrong'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, t } = x, r = R(x); ask(c, 'cr_ask');
    // whether he opens up: trust, liking, and the moment (the rule reads the roll from the top)
    const d = chance(w, t.id, 'opens up', 'says it is fine', [term('his trust in you / 0.3', (r.trust + r.affection * 0.5 - 0.4) / 0.3)], 0, 1, undefined, true);
    if (d.yes && t.problem) { door.revealProblem(t); line(x, `${t.name} rubs his face. "Since you ask... it’s ${PROBLEM_LABEL[t.problem.kind]}. I didn’t want it getting back."`, d); tweak(x, 0.05, 0.04); }
    else { line(x, `${t.name} says everything is fine, too quickly. You’ll have to earn that answer.`, d); tweak(x, 0.01); }
    return out(20, crewRows(c));
  },
};
const crHelp = (how: 'cash' | 'duties'): Act => ({
  base: how === 'cash' ? 'cr_cash' : 'cr_duties', pane: 'business',
  offers: (c) => (crewMan(c) && c.n.problem?.revealed ? [how === 'cash' ? { ...offer(c, 'cr_cash', 'Put $400 in his hand', `About ${PROBLEM_LABEL[c.n.problem.kind]}.`), kind: 'between' as const } : { ...offer(c, 'cr_duties', 'Lighten his duties for a while'), kind: 'between' as const }] : []),
  conduct: how === 'cash' ? (c, before) => { if (c.h.cash < before.cash) door.conduct(c.h, 'generous'); } : undefined,
  run: (c) => { const x = T(c); for (const l of door.helpMan(x.w, x.p, x.t, how)) line(x, l); return out(20, crewRows(c)); },
});
const fell = (t: Character) => { const hh = t.books.history.map((q) => q.paid); return hh.length >= 4 && avg(hh.slice(-6, -3)) >= 40 && avg(hh.slice(-3)) < avg(hh.slice(-6, -3)) * 0.65; };
const crDrop: Act = {
  base: 'cr_drop', pane: 'confront',
  offers: (c) => (crewMan(c) && !asked(c, 'cr_drop') && (fell(c.n) || c.n.books.arrears > 0 || c.n.books.missed >= 2) ? [{ ...offer(c, 'cr_drop', 'Ask why his envelope has been light', `${money(avg(c.n.books.history.map((q) => q.paid).slice(-3)))} a week lately.`), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, t } = x, r = R(x); ask(c, 'cr_drop');
    const h = lineOf(w, t), st = arch(t);
    const owedMe = w.debts.find((d) => d.status === 'active' && d.creditor === t.id && d.missed >= 1);
    const recentArrest = t.career?.log.find((e) => /Arrested/.test(e.text) && w.now - e.t < 21 * DAY);
    const concealing = !!t.problem && !t.problem.revealed;
    const hiding = (st === 'proud' || st === 'bitter' || st === 'frightened') && concealing && r.trust < 0.7;
    if (hiding) { line(x, w.rng.pick([`${t.name} shrugs. "Slow patch. It happens."`, `${t.name} looks past you. "Nothing to tell. Money comes and goes."`, `"It’s fine," ${t.name} says, a little too quickly.`]), settled(t.id, 'hides it', 'a proud, bitter or frightened man who does not trust you enough (< 0.7)')); tweak(x, -0.01); }
    else if (concealing && r.trust >= 0.7) { door.revealProblem(t); line(x, `${t.name} is quiet a moment. "You’d find out. It’s ${PROBLEM_LABEL[t.problem!.kind]}. That’s where it’s going." He hasn’t said that to anyone else.`, settled(t.id, 'tells you', 'he trusts you (≥ 0.7)')); tweak(x, 0.06, 0.03); }
    else if (recentArrest) line(x, '"I was inside part of that. You know that. It cost me the week, and the lawyer cost me more."');
    else if (owedMe) line(x, `"${w.chars[owedMe.debtor]?.name ?? 'A man'} stopped paying me. I’m out ${money(owedMe.balance)} and I’ve got your share to find from somewhere."`);
    else if (h && (h.bad ?? 0) >= 1 && h.cause) line(x, `"It’s the ${h.kind === 'shylock' ? 'loans' : 'business'}. ${h.cause.charAt(0).toUpperCase() + h.cause.slice(1)}. It’ll come back."`);
    else line(x, `${t.name} spreads his hands. "Nothing I can point to. Some weeks are thin."`);
    return out(20, crewRows(c));
  },
};
const crLook: Act = {
  base: 'cr_look', pane: 'confront',
  offers: (c) => (crewMan(c) && asked(c, 'cr_drop') && !asked(c, 'cr_look') ? [{ ...offer(c, 'cr_look', 'Say you’ll look into it yourself', 'Takes a couple of hours and a few questions around his patch.'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, h = lineOf(w, t); ask(c, 'cr_look');
    if (t.problem && !t.problem.revealed) { door.revealProblem(t); c.v.lines.push({ who: 'narr', text: `Asking round his patch, the answer comes fast: it’s ${PROBLEM_LABEL[t.problem.kind]}. He didn’t want to say, and now you know why.` }); door.noteOn(p, t, `You looked into it: he is ${PROBLEM_LABEL[t.problem.kind]}.`); }
    else if ((p.books.flags[t.id]?.amt ?? 0) > 0) { c.v.lines.push({ who: 'narr', text: `You go through what you can see of his business. It doesn’t add up: about ${money(Math.round(p.books.flags[t.id].amt))} you can’t account for.` }); door.noteOn(p, t, `You looked into it: about ${money(Math.round(p.books.flags[t.id].amt))} of his doesn’t add up.`); }
    else if (h) { c.v.lines.push({ who: 'narr', text: `Nobody has a bad word for him. ${h.cause ? `It checks out: ${h.cause}.` : 'The business is just thin.'}` }); door.noteOn(p, t, `You looked into it: his business checks out${h.cause ? ` (${h.cause})` : ''}.`); tweak(x, 0.02); }
    else { c.v.lines.push({ who: 'narr', text: 'Nothing turns up. He’s just having a bad run.' }); door.noteOn(p, t, 'You looked into it: nothing turned up. A bad run.'); }
    return out(120, crewRows(c));
  },
};
// thin ice (flows.ts): he submits, pleads, or defies, as his nature and his fear of the player have it
const crThin: Act = {
  base: 'cr_thin', pane: 'confront',
  offers: (c) => (crewMan(c) && (!!c.n.problem || peek(c.n, c.h.id).trust < 0.4) ? [{ ...offer(c, 'cr_thin', 'Tell him he’s on thin ice', 'Not a kindness.'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x);
    if (recent(w, t, 'thin', 6)) { line(x, '“You told me already. I heard.”'); return out(3); }
    stamp(w, t, 'thin');
    const a = arch(t), over = stanceOf(w, p, t) === 'over', tp = temper(t);
    const fear = clamp(0.4 + (0.5 - tp.courage) * 0.7 + viewOf(w, t, p).fear * 0.3 + (over ? 0.15 : -0.15) - r.grudge * 0.3 * tp.pride * 2, 0.05, 0.95);
    // (a hothead defies; a frightened man is frightened; anyone else is afraid of the player as far as the odds say)
    const d = a === 'hothead' ? settled(t.id, 'defies you', 'a hothead') : a === 'frightened' ? settled(t.id, 'pleads', 'a frightened man') : chance(w, t.id, a === 'earnest' ? 'pleads' : 'submits', 'defies you', [term('fear of you (his courage, how he sees you, who is over whom, his grudge and pride)', fear)]);
    const mood = d.chosen === 'defies you' ? 'defy' : d.chosen === 'pleads' ? 'plead' : 'submit';
    door.memoOnce(w, t, p.id, 'threat', 'You told him he’s on thin ice.');
    if (mood === 'submit') {
      line(x, pick(w, t, { cold: ['He holds your eye a second too long, then nods. “Understood.”'], proud: ['“I hear you.” He says it flatly, like a man swallowing something.'], _: ['“All right. I know where I stand.”'] }), d);
      tweak(x, -0.04, -0.04, 0.02); door.restrain(w, t);
      return out(10, [{ code: 'th_ease', label: '“I’d sooner settle this with a good week.”', note: 'Takes the edge off. He’ll try to earn it back.' }, drop]);
    }
    if (mood === 'plead') {
      const why = t.problem ? PROBLEM_LABEL[t.problem.kind] : lineOf(w, t)?.cause ?? 'a bad stretch';
      line(x, `He goes pale and keeps his voice low. “It isn’t what you think. It’s ${why}. Give me a little time and I’ll put it right.”`, d);
      tweak(x, -0.02, -0.02, -0.01);
      return out(15, [{ code: 'th_hear', label: '“Go on. I’m listening.”', note: 'He may tell you what is really wrong.' }, { code: 'th_hold', label: '“It stands. I’m not changing it.”', note: 'Fear works, for a while.' }]);
    }
    line(x, pick(w, t, { hothead: ['“Thin ice? You come to me with that?” He doesn’t step back. “Say it plain, or don’t say it.”'], _: ['He gives a short, humourless laugh. “You’re threatening me? I’ve been in this longer than you think.”'] }), d);
    tweak(x, -0.1, -0.06, -0.05); door.grudge(w, t, p.id, 0.12, `${p.name} told him he was on thin ice`);
    return out(15, [{ code: 'th_back', label: '“All right. Let’s calm down.”', note: 'You lose face. You lose less than a fight.' }, { code: 'th_push', label: '“Don’t make me say it twice.”', note: 'He may break, or the two of you may. Others will hear.' }]);
  },
};
const thEase: Act = { base: 'th_ease', pane: 'confront', run: (c) => { const x = T(c); tweak(x, 0.03, 0.02, 0); line(x, '“Then I’ll give you one.” He means it, mostly.'); return out(5); } };
const thHear: Act = { base: 'th_hear', pane: 'confront', run: (c) => { const x = T(c), t = x.t; door.revealProblem(t); tweak(x, 0.05, 0.03, 0); line(x, t.problem ? `“It’s ${PROBLEM_LABEL[t.problem.kind]}. I didn’t want it getting back to you.”` : '“I’m not skimming. I’ve just not had the work. That’s the truth.”'); return out(15); } };
const thHold: Act = { base: 'th_hold', pane: 'confront', run: (c) => { const x = T(c); tweak(x, -0.05, -0.03, 0.01); c.v.lines.push({ who: 'narr', text: 'He looks at the floor. “You’ll have it.” Nothing more.' }); return out(5); } };
const thBack: Act = { base: 'th_back', pane: 'confront', run: (c) => { const x = T(c); tweak(x, 0.0, 0, -0.03); line(x, '“Good,” he says, as if he’d decided it. You both let it go. It will not be forgotten.'); return out(5); } };
const thPush: Act = {
  base: 'th_push', pane: 'confront',
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    const d = temper(t).courage < 0.55 ? chance(w, t.id, 'breaks', 'stands his ground', [term('a man without much courage, a little more than half the time', 0.55)]) : settled(t.id, 'stands his ground', 'his courage');
    if ((d as { yes?: boolean }).yes) { tweak(x, -0.05, -0.04, 0.04); line(x, 'Something in his face gives. “All right. All right. Whatever you want.”', d); }
    else { tweak(x, -0.1, -0.08, -0.04); door.grudge(w, t, p.id, 0.2, `${p.name} pushed him in front of others`); line(x, '“Then do it,” he says quietly. Nobody moves. You have made an enemy without winning anything.', d); }
    door.happened(w, { kind: 'threat', actor: p.id, victim: t.id, minor: true, text: `${p.name} had hard words with ${t.name}.`, district: t.district }, { witnesses: [] });
    return out(10);
  },
};
// orders to the player's own man: keep his head down, find some extra income; he may push back, and the player may insist
const assign = (low: boolean): Act => ({
  base: low ? 'assign_low' : 'assign_hustle', pane: 'business',
  offers: (c) => (orders(c) && crewMan(c) ? [low ? offer(c, 'assign_low', 'Tell him to keep his head down', 'Heat drops. He earns less.') : offer(c, 'assign_hustle', 'Tell him to find some extra income', 'It will show up in the books, and in the heat.')] : []),
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, k = code.split(':')[0];
    const d = low ? ((t.books.arrears > 0 || t.cash < 150) ? chance(w, t.id, 'pushes back', 'goes along', [term('a man behind or short, six times in ten', 0.6)]) : settled(t.id, 'goes along', 'not behind, not short')) : (arch(t) === 'frightened' || temper(t).caution > 0.65) ? chance(w, t.id, 'pushes back', 'goes along', [term('a careful or frightened man', 0.65)]) : settled(t.id, 'goes along', 'not a careful man');
    if ((d as { yes?: boolean }).yes && stanceOf(w, p, t) === 'over' && !recent(w, t, 'ord:' + k, 1)) {
      stamp(w, t, 'ord:' + k);
      line(x, low ? '“Keep my head down? That’s money I need. I’m behind as it is, and you know it.”' : '“Another angle? I’d be drawing eyes. If it goes bad it goes bad on both of us.”', d);
      return out(10, [{ code: 'ord_insist:' + k, label: '“It isn’t a request.”', note: 'He does it. He remembers being told.' }, { code: 'ord_ok:' + k, label: '“Forget it.”', note: 'No change. He sees you listen.' }]);
    }
    return doOrder(c, k, false);
  },
});
function doOrder(c: Ctx, k: string, forced: boolean) {
  const x = T(c), { w, p, t } = x;
  if (forced) { door.regard(w, t, p.id, 'trust', -0.04); door.regard(w, t, p.id, 'respect', 0.02); door.grudge(w, t, p.id, 0.05, `${p.name} gave him an order he did not like`); }
  if (k === 'assign_low') { door.keepLow(t); line(x, forced ? 'He nods once and says nothing more. He will stay out of sight, and he will not forget how it was put.' : '“All right. I’ll be quiet a while.”'); }
  else { door.sideIncome(w, t); line(x, forced ? 'He nods. “I’ll find something.” It will show in his books from now on, and so will the heat.' : '“I know a couple of things.” It will show in his books from now on.'); }
  return out(15);
}
const ordInsist: Act = { base: 'ord_insist', pane: 'business', run: (c, code) => doOrder(c, code.split(':')[1], true) };
const ordOk: Act = { base: 'ord_ok', pane: 'business', run: (c) => { const x = T(c); tweak(x, 0.02, 0, 0.01); line(x, '“Thanks for hearing me.” He relaxes a little.'); return out(5); } };
// ---------------------------------------------------------------- taking a man on (asks.ts 'recruit'): he answers as a matter between them
const recruit: Act = {
  base: 'recruit_offer', pane: 'business',
  offers: (c) => (c.n.prospect && c.n.rank === 'civilian' && rk(c.h) >= 1 && !askBetween(c.w, 'recruit', c.h.id, c.n.id) ? [{ code: 'recruit_offer', label: 'There’s a place for you with me, if you want it', note: 'Costs $150 to start. He becomes your responsibility.' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x;
    if (!t.prospect || t.rank !== 'civilian') { line(x, '“Not for me. I’ve got my own life.”'); return out(5); }
    if (rk(p) < 1) { line(x, '“You? You’re nobody yet. Come back when you are somebody.”'); return out(5); }
    if (p.cash < RECRUIT_COST) { c.v.lines.push({ who: 'narr', text: `You need ${money(RECRUIT_COST)} to bring a man on properly.` }); return out(3); }
    const open = askBetween(w, 'recruit', p.id, t.id);
    const s = open ?? door.openMatter(w, 'recruit', p, t, { amt: RECRUIT_COST, why: `${p.name} offered ${t.name} a place` });
    if (!s) { line(x, '“I gave you my answer. Ask when something’s different.”'); return out(3); }
    const bold = t.traits.ambition > 0.6;
    const r = door.matterMove(w, p, s.id, 'ask'), last = s.st?.[t.id]?.last;
    if (!open && (last === 'counter' || last === 'yes' || last === 'stall')) line(x, bold ? '“I’ve been waiting for somebody to ask. I want to know what I’m getting, and who I answer to.”' : '“It’s a big thing, to put my name to yours. I want to know what you expect.”');
    for (const l of r.lines) line(x, l);
    return out(20);
  },
};

const CREW: Act[] = [crAsk, crHelp('cash'), crHelp('duties'), crDrop, crLook, crThin];
export const ORG: Act[] = [work, bNeed, bMore, jobOffer, jobAnswer(true), jobAnswer(false), report, challenge, refuse, bStand, promo, recommend, rkBack, backWhat, backCall, backTake, backPress, rkBackAsk, flDrop, pickConcern, concern, ...CREW, thEase, thHear, thHold, thBack, thPush, assign(true), assign(false), ordInsist, ordOk, recruit];
