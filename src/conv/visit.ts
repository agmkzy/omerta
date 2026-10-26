// Gate 3: a visit, as the conversation engine sees it. Interface-independent: it takes a world, the player and the man he has gone to
// see, and gives back structured state (who the man is to him, what has been said, what he can say next) and carries out what the
// player chooses through the same decisions and doors as everything else. A screen (ui/talk2.ts) only draws this; another screen could
// draw it differently without touching anything here.
//
// The shape of a visit (spec §8, §17): the man opens with what is on his mind as he sees it (a request he has decided to make of you,
// a promise of yours he is waiting on, something he believes you did, news of something he did for you), or a greeting that fits what
// you are to each other. Then two to four things worth saying now, "Something else…" for anything else plausible, and leaving. What he
// says next answers what you said; follow-ups answer his reply, not a menu. Nothing technical is shown: commitments are in the words.
import { money, ownerBiz, peek, wontBorrowFrom } from '../core';
import { crewGround } from '../econ';
import { askBetween, openAsk, openAsks } from '../asks';
import { whereIs } from '../where';
import { DAY, type Character, type Fact, type Id, type World } from '../types';
import { newSession, perceive, type Perception, type Session } from './perception';
import { render } from './render';
import { EncounterMemory } from './encounter';
import { onAnnouncement, onAnswersTo, onIntervention, onLoanRequest, onPromise, onPromiseSeenBroken, onProtectionDemand, onReport, onReturnToPromisee, onSeekHelp, onUnknownTopic, onWhoQuestion, predictAcceptance, spendTimeAccount, type Reply } from './respond';
import { HOSTILE, injured, offender, release, withdraw, type ObType, type Obligation } from './obligations';
import { addFavour } from '../encounters';
import { bear } from '../core';
import { note, social, type Request } from './social';
import { agreement, captaincyOf, promise, request } from './tick';
import { canLean, captainOf, chairFor, may, superiors } from './authority';
import { belief, judge, say } from './minds';
import { onConfrontation, onProgressAsked } from './respond';
import { compat } from '../core';
import * as door from './doors';
import { newThread, restate, unattributed, acquainted, agoWords, card, ctx, first, him, lastOf, line, memo, memOf, narr, plain, r2, relationOf, remember, talks, you, PANES, type Choice, type Ctx, type Pane, type Say, type TalkMemory, type Visit } from './kit';
export { acquainted, relationOf, PANES, type Choice, type Pane, type Say, type TalkMemory, type Visit } from './kit';
import type { Meeting } from '../meetings';
import { subjectsOf } from './subjects/life';
import { askedInPerson } from './pursuits';
import { candourOf, subjectsHeldBy } from './acts/subjects';
import { pathInfo } from '../path';
import { readiness } from '../career';
import { standingWord } from '../jobs';
import { brokenWord } from '../memos';
import { temper } from '../temper';
import { arch } from '../voice';
import { say as vsay } from '../voicesheet';
import { settled } from './decide';
import { actOf, offersNow, perform } from './run';
import { streetNews } from './acts/info';
import { strangerHere } from './acts/personal';
import { protectOwnedBy } from './acts/business';
import { speechFor } from './acts/words';
import { ACTS } from './acts';
import { says } from './kit';
import type { Offer } from './kit';

// ---------------------------------------------------------------- the matters between them, as each side knows them
const MY_CAPTAIN = (c: Ctx) => captainOf(c.w, c.h);
// a promise of the player's to this man, still open
const myPromiseTo = (c: Ctx) => social(c.w).obs.filter((o) => o.obligor === c.h.id && o.beneficiary === c.n.id && o.matter?.against !== c.h.id && (o.status === 'pending' || c.w.now - (o.settled ?? c.w.now) < 10 * DAY)).at(-1);
// something the player promised someone that needs this man: raise it with him
// (and, once his own captain has refused it, the man above that captain: going over his head, which the captain will feel)
const overHead = (c: Ctx, o: Obligation) => { const cap = MY_CAPTAIN(c), above = cap ? superiors(c.w, cap).find((x) => x.alive) : undefined; return !!cap && above?.id === c.n.id && (o.type === 'effort' || o.type === 'result') && lastOf(c.w, cap.id, mkey(o))?.out === 'refused'; };
const owedHere = (c: Ctx) => social(c.w).obs.filter((o) => o.obligor === c.h.id && o.status === 'pending' && o.matter?.against !== c.h.id && ((o.spec.kind === 'actionDone' && o.spec.target === c.n.id) || ((o.type === 'effort' || o.type === 'result') && MY_CAPTAIN(c)?.id === c.n.id) || overHead(c, o)) && !social(c.w).log.some((a) => a.actor === c.h.id && a.act === 'raise' && a.target === c.n.id && a.t >= o.from && social(c.w).requests.some((r) => r.by === c.h.id && r.of === c.n.id && r.status === 'agreed' && r.parent === o.id)));
// what he came to say, if he came looking for the player
const openFrom = (c: Ctx) => social(c.w).requests.filter((r) => r.by === c.n.id && r.of === c.h.id && r.status === 'open').sort((a, b) => b.t - a.t);
// his own promise to the player that has an outcome he has not yet told him
const newsOfMine = (c: Ctx) => social(c.w).obs.find((o) => o.obligor === c.n.id && o.beneficiary === c.h.id && !(talks(c.w)[c.n.id]?.topics ?? []).some((x) => x.k === 'told:' + o.id) && (o.status !== 'pending' || social(c.w).requests.some((r) => r.parent === o.id && r.status !== 'open')));
const henryKnowsTroubleBy = (c: Ctx, man: Id) => Object.values(c.w.facts).filter((f) => c.h.known[f.id] && HOSTILE.has(f.kind) && (offender(f) === man || c.w.chars[offender(f) ?? '']?.bossId === man)).sort((a, b) => b.t - a.t)[0];

// ---------------------------------------------------------------- beginning a visit
export function begin(w: World, npcId: Id, o: { approach?: Id } = {}): Visit {
  const h = w.chars[w.playerId!], n = w.chars[npcId];
  const wh = whereIs(w, h, n);
  // (a man who has come to find the player is where the player is, not at his own home)
  const v: Visit = { npc: npcId, where: o.approach ? `with you in ${h.district}` : wh.name, t0: w.now, lines: [], choices: [], relation: '', mem: { said: [], argued: [], pressed: 0, points: [], offered: {} }, approach: o.approach, th: newThread() };
  const c = ctx(w, v);
  const rel0 = relationOf(w, h, n);
  v.relation = rel0.words;
  if (o.approach) narr(c, `${n.name} has come to find you.`);
  // (calling on a man at home in the small hours is calling on a man who was asleep: he says so, and it costs a little)
  else if (wh.kind === 'home') { const hr = (w.now % DAY) / 60; if (hr >= 23 || hr < 6) { narr(c, n.rank === 'civilian' ? `${n.name.split(' ')[0]} comes to the door in his coat, blinking. It’s the middle of the night.` : `${n.name.split(' ')[0]} opens the door himself, not pleased. “Do you know what time it is?”`); door.regard(w, n, h.id, 'affection', -0.02, `${h.name} woke him in the night`); } }
  // he decides whether there is a conversation at all: a man who threw the player out today won't start another one
  if ((h.cooldown[`shut:${n.id}`] ?? 0) > w.now && !o.approach) {
    const tp = temper(n);
    says(c, tp.volatility + tp.pride > 1.15 ? '“I told you once today. Out.”' : tp.agreeable > 0.55 ? '“Not today. Please.”' : 'He turns his back on you. He has nothing to say today.', settled(n.id, 'will not talk', 'he threw you out earlier today'));
    v.th.shut = true; v.choices = [{ id: 'leave', label: 'Leave', group: 'leave' }];
    door.met(w, h, n);
    return v;
  }
  // (he sent for the player for coffee, and the player has come to him: that is what this is, and it is answered by coming)
  const coffee = w.jobs.find((j) => j.kind === 'summons' && j.meeting === 'social' && j.status === 'offered' && j.giver === n.id && j.assignee === h.id);
  if (coffee) { door.attended(w, coffee); narr(c, `He asked you to come by. He pours you a coffee before he says anything.`); }
  open(c, rel0.level);
  arrival(c);
  const m = memOf(w, n.id); m.visits++; m.last = w.now;
  door.introduce(w, h, n);
  // (they have met: the world's record of it, which the weekly fading of trust and liking between men who never see each other reads;
  // the old screen sets it on the way in, and without it every man the player sees here drifted as if they never met)
  door.met(w, h, n);
  return notNow(w, v);
}
// The man's first word: what is on his mind about the player, most pressing first, from his own beliefs; else a greeting that fits.
function open(c: Ctx, level: string) {
  const { w, h, n } = c, pn = c.pn();
  const req = openFrom(c);
  const confront = req.find((r) => r.wants === 'confront'), help = req.find((r) => r.wants === 'intervene'), progress = req.find((r) => r.wants === 'progress'), report = req.find((r) => r.wants === 'report');
  if (confront) return openConfront(c, confront);
  if (help) return openHelp(c, help);
  const mine = myPromiseTo(c);
  if (mine) {
    const bv = belief(w, n, 'ob:' + mine.id);
    const lied = (social(w).judged ?? []).some((j) => j.who === n.id && j.ob === mine.id && j.lied);
    if (lied || (bv.value === 'broken' && !lastOf(w, n.id, 'reproach:' + mine.id))) return openConfront(c, undefined, mine);
    const reported = [...(social(w).said ?? [])].reverse().find((x) => x.by === h.id && x.to === n.id && x.subject === 'ob:' + mine.id);
    if (progress || !reported || (reported.value === 'notYet' && w.now - reported.t > 3 * DAY)) return openProgress(c, mine, progress);
  }
  const news = newsOfMine(c);
  if (news || report) return openNews(c, news, report);
  // a greeting, as what they are to each other (the fact), in his manner (the style)
  const again = memOf(w, n.id).last > w.now - DAY && memOf(w, n.id).visits > 0;
  const atShop = !!ownerBiz(w, n.id) && whereIs(w, h, n).kind === 'shop';
  // (what last passed between them, when it bears on how he greets the player: a long absence, an evening, a refusal)
  const mm = memOf(w, n.id), last = mm.topics.at(-1), warm = level === 'friend' || level === 'acquaintance';
  const since = again || !warm || !mm.visits ? undefined : w.now - mm.last > 14 * DAY ? 'greet.since.long'
    : last && w.now - last.t < 5 * DAY && last.k === 'spend' && mm.last - last.t < DAY ? 'greet.since.evening' // (the last time they met was that evening)
    : last && w.now - last.t < 14 * DAY && last.k.startsWith('intervene:') && last.out === 'refused' ? 'greet.since.refused'
    : mm.topics.some((x) => x.t >= mm.last - DAY && w.now - x.t < 10 * DAY && confided(c, x.k.slice(5), x.sig ?? '')) ? 'greet.since.confided' : undefined;
  // (a slight the last time outweighs anything warmer: he has not forgotten it, and the greeting says so)
  const slighted = warm && mm.visits && mm.topics.some((x) => x.t >= mm.last - DAY && w.now - x.t < 10 * DAY && SLIGHT.test(x.k) && (!x.k.startsWith('accuse:') || !['admit', 'amends', 'accepted'].includes(x.out))); // (owned up and let off, or taken at his word: no slight) // (the last time, he told you something of himself)
  // (he has heard the player went over his head: that comes first, until it has been said)
  const over = mm.topics.find((x) => x.k === 'overhead' && x.t >= mm.last && w.now - x.t < 21 * DAY), aboveC = over ? w.chars[over.out] : undefined;
  if (over && aboveC) { him(c, plain(n.id, 'greet.since.overhead', { aboveFirst: first(aboveC.name) }, 'cold'), String(mm.visits)); general(c); raiseHis(c); return; }
  const key = slighted ? 'greet.since.slighted' : since ? since : again ? 'greet.again' : level === 'stranger' ? (atShop ? 'greet.customer' : 'greet.stranger') : level === 'hostile' ? 'greet.hostile' : level === 'cold' ? 'greet.cold' : level === 'friend' ? 'greet.friend' : atShop ? 'greet.known' : 'greet.acquaintance';
  him(c, plain(n.id, key, {}, level === 'hostile' || level === 'cold' ? 'cold' : 'polite'), String(mm.visits));
  jobNews(c);
  general(c);
  raiseHis(c);
  void pn;
}

// What comes up as he greets the player, unprompted, once (the old screen's arrival): a promise of the player's falling due soon, a
// good turn the player did him, a word the player broke; and what shows on him, if something is weighing on him and he has nothing
// to put to the player
function arrival(c: Ctx) {
  const { w, h: p, n: t } = c, day = Math.floor(w.now / DAY);
  const prm = t.memos.find((m) => m.kind === 'promise' && m.other === p.id && !m.done && m.due && m.due > w.now && m.due - w.now <= 5 * DAY && !t.talk?.['prm:' + m.id]);
  const words: string[] = [];
  if (prm) { door.talkStamp(w, t, 'prm:' + prm.id); words.push('“You said you’d see to it. Don’t leave it too long.”'); }
  const helped = w.favours.find((f) => !f.settled && f.from === p.id && f.to === t.id && w.now - f.t < 120 * DAY);
  if (helped && day - (t.talk?.['ack:' + helped.id]?.d ?? -99) >= 14) {
    door.talkStamp(w, t, 'ack:' + helped.id);
    const a0 = arch(t);
    words.push(a0 === 'proud' ? '“I don’t forget a thing like what you did. You know that.”' : a0 === 'cold' ? '“I remember what you did. I pay my debts.”' : a0 === 'jovial' ? '“There he is. The man who stood by me. Sit, sit.”' : a0 === 'frightened' ? '“I haven’t forgotten. What you did for me. I haven’t.”' : '“I haven’t forgotten what you did for me.”');
  }
  const broke = brokenWord(w, p, t);
  if (broke && !t.talk?.['said:' + broke.id]) { door.talkStamp(w, t, 'said:' + broke.id); words.push(({ hothead: '“You gave me your word. I’m still waiting.”', proud: '“I haven’t forgotten what you said you’d do. Neither should you.”', cold: '“You said you’d do something. You didn’t.”' } as Record<string, string>)[arch(t)] ?? '“About what you promised me. Nothing came of it.”'); }
  const shows = w.enc.some((e) => e.status === 'open' && e.from === t.id && e.expires > w.now && e.opts.length) ? undefined : subjectsOf(w, p, t).find((x) => x.nudge && x.weight >= 0.5)?.nudge;
  if (shows) narr(c, shows);
  for (const l of words) says(c, l);
}

// ---------------------------------------------------------------- he came for help
function openHelp(c: Ctx, r: Request) {
  const a = c.w.chars[r.against ?? ''];
  // (a request against the player himself is never his to answer: it is the trouble between them, not help he can give)
  if (a?.id === c.h.id) { r.status = 'lapsed'; note(r, c.w.now, 'it is against the man asked'); }
  if (!a || a.id === c.h.id) return general(c);
  c.v.topic = 'help:' + r.id;
  // he has been here before with this: he says so, and what he asks is what else can be done
  const before = social(c.w).obs.filter((o) => o.obligor === c.h.id && o.beneficiary === c.n.id && o.matter?.against === a.id && o.status !== 'pending').at(-1);
  // (what he says of it is what he believes the player did: tried, never said, or never went)
  const bb = before ? belief(c.w, c.n, 'ob:' + before.id).value : undefined, cap0 = MY_CAPTAIN(c);
  if (before) him(c, plain(c.n.id, bb === 'done' || bb === 'kept' ? 'seek.help.again' : bb === 'notDone' || bb === 'broken' ? 'seek.help.again.never' : 'seek.help.again.unheard', { againstFirst: first(a.name), captainFirst: cap0 ? first(cap0.name) : 'your captain' }, 'pleading'));
  else him(c, onSeekHelp(c.pn(), a));
  openHelpChoices(c, r, !!r.fact && !c.h.known[r.fact]);
}
function doPromise(c: Ctx, type: ObType, rid: Id) {
  const { w, h, n } = c, r = social(w).requests.find((x) => x.id === rid);
  const a = w.chars[r?.against ?? ''], cap = MY_CAPTAIN(c);
  if (!r || !a) return general(c);
  if (r.fact && w.facts[r.fact] && !h.known[r.fact]) door.inform(w, n, h, w.facts[r.fact], r.about);
  // (a man who has had this promise before, and seen it come to nothing or put off and put off, hears it as such: no warmth, no trust)
  const before = social(w).obs.filter((o) => o.obligor === h.id && o.beneficiary === n.id && o.matter?.against === a.id && o.id !== r.parent);
  const failed = before.some((o) => { const b = belief(w, n, 'ob:' + o.id).value; return o.status === 'broken' || o.status === 'withdrawn' || b === 'broken' || b === 'notDone'; }) || before.some((o) => memOf(w, n.id).topics.filter((x) => x.k === 'progress:' + o.id && x.out === 'notyet').length >= 2);
  if (failed) him(c, plain(n.id, 'react.promise.again', { captainFirst: cap ? first(cap.name) : 'them' }, 'cold'));
  else { him(c, onPromise(c.pn(), h, type, a)); door.regard(w, n, h.id, 'trust', { action: 0.03, effort: 0.02, result: 0.05, restraint: 0.03 }[type], `${h.name} promised to help`); }
  const g = agreement(w, [n.id, h.id], `${h.name} to ${n.name}: ${type === 'result' ? `${a.name} leaves him alone` : type === 'action' ? `he will raise it with ${cap?.name}` : `he will try to get ${a.name} to stop`}`, [n.id], r.id);
  const biz = r.biz ?? ownerBiz(w, n.id)?.id;
  promise(w, {
    type, obligor: h.id, beneficiary: n.id, promisee: n.id, from: w.now, by: w.now + (type === 'result' ? 30 : 10) * DAY, matter: { for: n.id, against: a.id, biz, fact: r.fact }, notify: [n.id], words: 'promise.' + type,
    spec: type === 'action' && cap ? { kind: 'actionDone', act: 'raise', target: cap.id, about: r.about } : type === 'result' ? { kind: 'noHostility', actor: a.id, target: n.id, biz, days: 30 } : { kind: 'effort', acts: ['raise'], about: r.about, floor: 0.15 },
  }, g);
  askedInPerson(w, n.id, a.id, r); // (his trouble is now in the player's hands: he waits on that, not asks again)
  r.status = 'agreed'; note(r, w.now, `${h.name} promised`);
  remember(w, n.id, 'help:' + r.id, 'promised');
  c.v.topic = undefined;
  general(c);
}

// ---------------------------------------------------------------- a promise of the player's, where it stands
function openProgress(c: Ctx, ob: Obligation, req?: Request) {
  const { w, h, n } = c, a = w.chars[ob.matter?.against ?? ''];
  c.v.topic = 'progress:' + ob.id;
  const since = Object.values(w.facts).some((f) => HOSTILE.has(f.kind) && !!a && (offender(f) === a.id || w.chars[offender(f) ?? '']?.bossId === a.id) && (injured(f) === n.id || f.business === ob.matter?.biz) && f.t > ob.from && n.known[f.id]);
  // (how often he has been told "not yet" on this promise, and when last: he asks as a man who remembers it)
  const delays = delaysOn(c, ob), lastDelay = delays.at(-1);
  const seenStop = !since && w.now - ob.from > 7 * DAY && !social(w).log.some((x) => x.actor === h.id && x.act === 'raise' && x.t >= ob.from);
  if (since && ob.type === 'result') him(c, onPromiseSeenBroken(c.pn(), h));
  else if (delays.length && !seenStop) him(c, plain(n.id, delays.length >= 2 ? 'followup.pending.again2' : 'followup.pending.again', { ago: agoWords(w.now, lastDelay!.t) }, 'cold'));
  else him(c, onReturnToPromisee(c.pn(), h, !since && w.now - ob.from > 7 * DAY, Math.floor((w.now - ob.from) / DAY), a));
  if (req) { req.status = 'done'; note(req, w.now, 'he asked'); }
  const did = social(w).log.some((x) => x.actor === h.id && x.act === 'raise' && x.about === (ob.spec as { about?: string }).about && x.t >= ob.from);
  const cap = MY_CAPTAIN(c);
  // he has seen the trouble stop and asks whether it was the player's doing: the replies answer that question
  if (!since && w.now - ob.from > 7 * DAY && !did) {
    c.v.choices = [{ id: `credit:no:${ob.id}`, label: line(c, 'credit.notMe'), group: 'reply' }, { id: `credit:lie:${ob.id}`, label: line(c, 'credit.claim'), note: 'You had nothing to do with it.', group: 'reply' }, { id: 'more', label: 'Something else…', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
    c.v.waiting = { q: 'whether it was you', choices: c.v.choices.filter((x) => x.group === 'reply') };
    return;
  }
  // (if he has heard how it went, his answer is the whole of it: that he went, and what came of it, in one breath)
  const how = did ? passOf(c, ob) : undefined;
  c.v.choices = (did
    ? [{ id: `report:done:${ob.id}${how ? ':' + how : ''}`, label: how ? passLine(c, ob, how) : line(c, 'report.raised', { captainFirst: cap ? first(cap.name) : 'the family' }), group: 'reply' }]
    : [{ id: `report:notyet:${ob.id}`, label: line(c, 'report.notYet'), group: 'reply' }, { id: `report:lie:${ob.id}`, label: line(c, 'report.raised', { captainFirst: cap ? first(cap.name) : 'the family' }), note: `You haven’t been to see ${cap ? first(cap.name) : 'anyone'}.`, group: 'reply' }, { id: `report:cannot:${ob.id}`, label: line(c, 'report.cannot'), group: 'reply' }]) as Choice[];
  c.v.waiting = { q: 'where it stands', choices: c.v.choices.filter((x) => x.group === 'reply') };
  c.v.choices.push({ id: 'more', label: 'Something else…', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' });
}
function doReport(c: Ctx, kind: 'done' | 'notyet' | 'lie' | 'cannot', obId: Id, pass?: 'done' | 'refused') {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (!ob) return general(c);
  if (kind === 'done' || kind === 'lie') say(w, h, n, 'ob:' + ob.id, 'done', 'own', kind === 'done', 'I took it to the family');
  else if (kind === 'notyet') say(w, h, n, 'ob:' + ob.id, w.now > ob.by ? 'notDone' : 'notYet', 'own', true, 'Not yet');
  else { withdraw(w, ob, `${h.name} told ${n.name} he couldn't do it`); say(w, h, n, 'ob:' + ob.id, 'withdrawn', 'own', true, 'I couldn’t get anywhere'); }
  judge(w, n, ob);
  if (kind === 'done' && pass) { remember(w, n.id, 'progress:' + ob.id, kind); c.v.topic = undefined; return doPass(c, ob.id, pass); }
  // (each "not yet" after the first costs more of his patience, and the third is the last he will take)
  const delays = delaysOn(c, ob).length;
  if (kind === 'notyet' && delays >= 1) door.regard(w, n, h.id, 'trust', delays >= 2 ? -0.06 : -0.03, `${h.name} put him off again`);
  him(c, kind === 'notyet' ? plain(n.id, delays >= 2 ? 'react.report.notYet.last' : delays === 1 ? 'react.report.notYet.again' : 'react.report.notYet', {}, delays ? 'cold' : 'flat') : kind === 'cannot' ? onReport(c.pn(), h, 'admitNotDone') : onReport(c.pn(), h, 'done'));
  remember(w, n.id, 'progress:' + ob.id, kind);
  c.v.topic = undefined;
  general(c);
}

// ---------------------------------------------------------------- he believes the player broke his word, or lied
function openConfront(c: Ctx, req?: Request, ob0?: Obligation) {
  const { w, h, n } = c, ob = ob0 ?? social(w).obs.find((o) => o.id === req?.parent);
  if (!ob) { if (req) req.status = 'lapsed'; return general(c); }
  const lied = (social(w).judged ?? []).some((j) => j.who === n.id && j.ob === ob.id && j.lied), cap = MY_CAPTAIN(c);
  c.v.topic = 'confront:' + ob.id;
  him(c, lied ? plain(n.id, 'confront.lie', { captainFirst: cap ? first(cap.name) : 'the family' }, 'cold') : onPromiseSeenBroken(c.pn(), h));
  if (req) { req.status = 'done'; note(req, w.now, 'he said it'); }
  remember(w, n.id, 'reproach:' + ob.id, lied ? 'lied' : 'broken');
  c.v.choices = [{ id: `confront:sorry:${ob.id}`, label: line(c, lied ? 'confront.sorry' : 'apologise.broken'), group: 'reply' }, ...(lied ? [{ id: `confront:insist:${ob.id}`, label: line(c, 'confront.insist', { captainFirst: cap ? first(cap.name) : 'him' }), note: 'You never went.', group: 'reply' as const }] : []), { id: 'leave', label: 'Leave', group: 'leave' }];
}
function doConfront(c: Ctx, kind: 'sorry' | 'insist', obId: Id) {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (kind === 'insist' && ob) { say(w, h, n, 'ob:' + ob.id, 'done', 'own', false, 'I spoke to him'); judge(w, n, ob); }
  else door.regard(w, n, h.id, 'affection', 0.02, `${h.name} owned up`);
  const b = ob ? belief(w, n, 'ob:' + ob.id) : undefined;
  him(c, plain(n.id, kind === 'sorry' ? 'react.sorry' : b?.value === 'done' && !b.uncertain ? 'react.insist.believed' : 'react.insist.doubted', {}, 'cold'));
  c.v.topic = undefined;
  general(c);
}

// ---------------------------------------------------------------- news he has for the player
function openNews(c: Ctx, ob?: Obligation, req?: Request) {
  const { w, h, n } = c, o = ob ?? social(w).obs.find((x) => x.id === req?.parent);
  if (!o) { if (req) req.status = 'lapsed'; him(c, plain(n.id, 'greet.acquaintance')); return general(c); }
  const asked = social(w).requests.find((r) => r.parent === o.id && r.by === n.id);
  const a = w.chars[o.matter?.against ?? ''], chair = w.chars[asked?.of ?? ''] ?? (a ? chairFor(w, a) : undefined), forC = w.chars[o.matter?.for ?? ''];
  const key = asked?.status === 'refused' ? 'report.refusedByChair' : asked?.rode?.out === 'agreed' || asked?.status === 'done' ? 'answer.progress.done' : o.status === 'kept' ? 'report.raisedIt' : o.status === 'withdrawn' ? 'report.couldNot' : 'answer.progress.pending';
  him(c, plain(n.id, key, { theirCaptainFirst: chair ? first(chair.name) : '', againstFirst: a ? first(a.name) : '', forFirst: forC ? first(forC.name) : '' }));
  say(w, n, h, 'credit:' + (o.parent ?? o.id), asked?.rode?.out === 'agreed' ? 'delegate' : 'none', 'own', true);
  if (req) { req.status = 'done'; note(req, w.now, 'he told him'); }
  remember(w, n.id, 'told:' + o.id, key);
  general(c);
  // what the player can say to it, before anything else
  c.v.choices.unshift({ id: 'thank:' + o.id, label: line(c, key === 'report.refusedByChair' ? 'thank.tried' : 'thank.done'), group: 'reply' });
}

// ---------------------------------------------------------------- the ordinary choices, and everything else
// What is worth saying now: anything the player has to raise with him, then the ordinary things men say, then "Something else…"
// and leaving. At most five on the screen, including those two.
// The player's three headings (presentation only: each maps to the intentions both engines already have). Business: money, work,
// jobs, orders, disputes, protection, favours, what is owed. Personal: how he is, what is new, an evening, what he knows of others.
// Confront: accusations, demands, a man's failings put to him. Under each, the subjects this man and this moment allow, the most
// pressing first; "Other…" opens the rest of what is plausible under that heading, never an action that is not there.
const PANE_WORD: Record<Pane, string> = { business: 'Business', personal: 'Personal', confront: 'Confront' };
const PANE_MORE: Record<Pane, string> = { business: 'Other business…', personal: 'Something else personal…', confront: 'Something else to have out…' };
// where one of the old engine's subjects belongs, by its code

// What can be raised under a heading: everything plausible (all), or what is worth raising now
function subjects(c: Ctx, k: Pane, all = false): Choice[] { return memo(c, `subj:${k}:${all}`, () => subjectsNow(c, k, all)); }
function subjectsNow(c: Ctx, k: Pane, all: boolean): Choice[] {
  const { w, h, n } = c, out: Choice[] = [];
  const pending = actRows(c, k, ['his', 'between', 'mind']);
  if (k === 'business') {
    for (const ob of owedHere(c)) {
      const prev = lastOf(w, n.id, mkey(ob)), same = prev?.out === 'refused' && prev.sig === interveneSig(c, ob);
      if (same && !all) continue; // refused, and nothing has changed: not offered as if it were new (it stays under "Other business…")
      out.push({ ...interveneChoice(c, ob, prev?.out === 'refused'), note: prev?.out === 'refused' ? `He said no ${agoWords(w.now, prev.t)}. ${same ? 'Nothing has changed since.' : 'Things have moved since.'}` : undefined });
    }
    // what the player has heard that the man he promised would want to know: how it went with the man he took it to
    const mine = myPromiseTo(c), how = mine ? passOf(c, mine) : undefined;
    if (mine && how) out.push({ id: 'pass:' + mine.id + ':' + how, label: passLine(c, mine, how), group: 'matter' });
    // (finished work of his, not yet reported to him, comes first: the old engine's report)
    if (unreported(c)) { const r = actRows(c, 'business', ['between']).find((x) => x.id === 'a:report'); if (r) out.push(r); }
    out.push(...pending);
    // what a man in your position would naturally put to him: work from your boss, orders to your own man
    out.push(...actRows(c, k, ['lead']));
    if (shopOf(c) && protectAvailable(c)) { const prev = lastOf(w, n.id, 'protect'); out.push({ id: 'protect', label: line(c, 'demand.protection', { amt: `$${feeOf(c)}` }), note: !prev ? undefined : prev.out === 'counter' ? `He offered less ${agoWords(w.now, prev.t)}.` : prev.out === 'agreed' ? undefined : `He turned you down ${agoWords(w.now, prev.t)}.`, group: 'matter' }); }
    if (all) {
      const ways = actRows(c, k, ['other']);
      // (not from a man who owes the player money himself: the player would be borrowing his own money back at interest)
      if ((n.rank !== 'civilian' || n.cash >= 600) && !wontBorrowFrom(h, n) && !ways.some((x) => x.id.startsWith('a:borrow')) && !w.debts.some((d) => d.status === 'active' && d.creditor === h.id && d.debtor === n.id)) out.push({ id: 'loan:500', label: line(c, 'ask.loan', { amt: '$500' }), group: 'matter' });
      // who a man answers to: the men troubling people the player has promised to help
      for (const id of new Set(social(w).obs.filter((o) => o.obligor === h.id && o.status === 'pending' && o.matter?.against).map((o) => o.matter!.against!))) { const m = w.chars[id]; if (m && m.id !== n.id && m.id !== h.id) out.push({ id: 'answers:' + m.id, label: line(c, 'ask.answersTo', { manFirst: first(m.name) }), group: 'matter' }); }
      out.push(...ways);
    }
  }
  if (k === 'personal') {
    // (what is on his mind first, then the two things men always say, then what the player knows that bears on him)
    out.push(...pending.slice(0, 2));
    // (a man who has turned cold on the player is in no mood for small talk: what is between them, and that is all)
    if (!c.v.mem.points.includes('news') && !c.v.th.cold) out.push({ id: 'news', label: line(c, 'ask.news'), group: 'social' });
    if (!c.v.mem.points.includes('spend') && !c.v.th.cold) out.push({ id: 'spend', label: line(c, acquainted(w, h, n) ? 'spend.time.' + partOfDay(w.now) : 'introduce.self'), note: acquainted(w, h, n) ? 'An evening with him. That’s the rest of the visit.' : undefined, group: 'social' });
    out.push(...pending.slice(2));
    // something the player knows that bears on this man: trouble on his street, or by his people
    for (const f of Object.values(w.facts).filter((f) => h.known[f.id] && !n.known[f.id] && !f.minor && HOSTILE.has(f.kind) && f.business && w.now - f.t < 21 * DAY && (f.district === (ownerBiz(w, n.id)?.district ?? n.district) || offender(f) === n.id || w.chars[offender(f) ?? '']?.bossId === n.id || crewGround(w, n).has(f.district))).sort((a, b) => b.t - a.t).slice(0, 1)) out.push({ id: 'tell:' + f.id, label: line(c, 'tell.news', { topic: w.biz[f.business!].name }), group: 'matter' });
    // who did something the player knows of but not who did it, where this man might know
    for (const f of Object.values(w.facts).filter((f) => h.known[f.id] && !h.known[f.id].knowsActor && HOSTILE.has(f.kind) && f.business && (f.district === n.district || ownerBiz(w, n.id)?.district === f.district)).sort((a, b) => b.t - a.t).slice(0, 1)) out.push({ id: 'who:' + f.id, label: line(c, 'ask.who', { shop: w.biz[f.business!].name }), group: 'matter' });
    out.push(...actRows(c, k, ['lead']));
    if (all) out.push(...actRows(c, k, ['other']));
  }
  if (k === 'confront') {
    // what the player can put to him from this layer's records: his word, not kept as the player sees it; something he knows he did
    for (const ob of hisWordToMe(c)) { const tg = c.w.chars[(ob.spec as { target?: Id }).target ?? '']; out.push({ id: 'hisword:' + ob.id, label: line(c, tg ? 'confront.hisWord' : 'confront.hisWord.plain', { targetFirst: tg ? first(tg.name) : '' }), group: 'matter' }); }
    // (what it was, said as it was: to the player himself, to one of his, or at a place)
    for (const f of knownAgainstMine(c)) { const vic = w.chars[injured(f) ?? '']; out.push({ id: 'accuse:' + f.id, label: line(c, vic?.id === h.id ? 'accuse.act.me' : f.business ? 'accuse.act' : 'accuse.act.man', { shop: f.business ? w.biz[f.business]?.name ?? '' : '', victimFirst: vic ? first(vic.name) : '' }), group: 'matter' }); }
    out.push(...pending, ...actRows(c, k, ['lead', 'other']));
  }
  return out.filter((x, i) => out.findIndex((y) => y.id === x.id) === i);
}
// One heading open: its subjects (at most four), the rest behind "Other…", the way back to the headings, and leaving
function pane(c: Ctx, k: Pane, all = false) {
  // ("Other…" is the others: what is already on the heading's own list is not repeated in it)
  const top = new Set(subjects(c, k).slice(0, 4).map((x) => x.id));
  const rows = subjects(c, k, all), shown = all ? rows.filter((x) => !top.has(x.id)) : rows.slice(0, 4);
  const rest = all ? 0 : subjects(c, k, true).filter((x) => !shown.some((y) => y.id === x.id)).length;
  c.v.pane = k; c.v.more = all; c.v.topic = undefined;
  if (!rows.length) return home(c);
  c.v.choices = [...shown, ...(rest ? [{ id: 'all:' + k, label: PANE_MORE[k], group: 'more' as const }] : []), ...(all ? [{ id: 'u:' + k, label: 'Back', group: 'more' as const }] : []), { id: 'home', label: 'Something else', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}
// The headings: what he brings up himself first (answered directly, no heading), then Business, Personal, Confront, and leaving
function home(c: Ctx) {
  c.v.pane = undefined; c.v.more = false; c.v.topic = undefined;
  // (what he asked and is still waiting on comes first, until it is answered: looking at something else does not unask it)
  const his = [...(c.v.waiting ? (c.v.waiting.choices.length === 1 ? c.v.waiting.choices : [{ id: 'answer', label: `Answer him: ${c.v.waiting.q}`, group: 'reply' as const }]) : []), ...actRows(c, undefined, ['his']).slice(0, 2)];
  const heads: Choice[] = PANES.filter((k) => subjects(c, k).length || subjects(c, k, true).length).map((k) => ({ id: 'u:' + k, label: PANE_WORD[k], group: 'intent' }));
  c.v.choices = [...his, ...heads, { id: 'leave', label: 'Leave', group: 'leave' }];
}
// After a subject has run its course the talk stays where it was: under the heading it was raised from, or at the headings
function general(c: Ctx) { c.memo.clear(); if (c.v.pane) pane(c, c.v.pane); else home(c); }
// Everything plausible, under all three headings (spec §8.2: filtered only for plausibility, never for relevance)
export function everything(w: World, v: Visit): Choice[] {
  const c = ctx(w, v), out: Choice[] = v.waiting ? [{ id: 'answer', label: `Answer him: ${v.waiting.q}`, group: 'reply' }] : [];
  for (const k of PANES) out.push(...subjects(c, k, true));
  if (!v.th.cold && !v.th.shut) out.push({ id: 'news', label: line(c, 'ask.news'), group: 'social' }, { id: 'spend', label: line(c, acquainted(w, c.h, c.n) ? 'spend.time.' + partOfDay(w.now) : 'introduce.self'), note: acquainted(w, c.h, c.n) ? 'An evening with him. That’s the rest of the visit.' : undefined, group: 'social' }); // (a man you haven't met is met first)
  out.push({ id: 'home', label: 'Never mind', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' });
  return out.filter((x, i) => out.findIndex((y) => y.id === x.id) === i);
}
// ---------------------------------------------------------------- the interactions (conv/acts), offered and carried through
// What the interactions offer under a heading (or under none), of the kinds asked for: what he brings up, what is between them, what
// is on his mind, what a man in the player's position would put to him first, and the rest
function actRows(c: Ctx, k: Pane | undefined, kinds: NonNullable<Offer['kind']>[]): Choice[] {
  if (c.v.th.shut) return [];
  // (what has been said in this visit is not offered again in it: it would change nothing until the player comes back)
  const said = new Set(c.v.th.used ?? []);
  const xs = memo(c, 'acts', () => offersNow(c)).filter((o) => kinds.includes(o.kind ?? 'other') && (!k || o.pane === k) && !(c.h.cash < (o.cost ?? 0)) && !said.has(o.code));
  // (a man who has turned cold on the player is in no mood for small talk or proposals: only what is between them)
  return xs.filter((o) => !c.v.th.cold || o.kind === 'his' || o.kind === 'between').map((o) => ({ id: 'a:' + o.code, label: o.label, says: o.says, note: o.note, group: o.kind === 'his' ? 'reply' : o.kind === 'between' || o.kind === 'mind' ? 'matter' : 'matter', pane: o.pane, ...(o.kind === 'lead' || o.kind === 'mind' ? { lead: true } : {}), ...(o.amount ? { amount: o.amount } : {}) }) as Choice);
}
// One of them said: carried through by the conversation's runner (run.ts), then what follows: his answers to it, or back to the talk
function doAct(c: Ctx, code: string, label: string): { minutes: number; meeting?: Meeting; settle?: Id } {
  if (c.v.topic?.startsWith('enc:') && !/^(enc|apx|enc_open):/.test(code)) c.v.topic = undefined; // (the player has turned to something else)
  const r = perform(c, code, label);
  c.memo.clear();
  if (r.end || r.meeting) { c.v.ended = true; c.v.choices = []; return { minutes: r.minutes, meeting: r.meeting }; }
  if (r.settle) return { minutes: r.minutes, settle: c.n.id };
  if (!afterAct(c, r.next ?? [], code.split(':')[0]) && !r.keepTopic) { c.v.th.fact = undefined; c.v.th.subject = undefined; c.v.th.denied = false; general(c); }
  else if (!c.v.choices.length) general(c);
  // (his money, his shop, his racket come up and he is short: a gift or a loan is what can be said next; and once a visit, a subject
  // of his own life that came back guarded says what he is to the player)
  if (/^tk:(racket|trouble|shop)$/.test(code)) offerHelp(c);
  guardedCue(c, code);
  return { minutes: r.minutes };
}
// what he has just said leaves the player these answers (not already given in this visit), the way back to the talk, and leaving
function afterAct(c: Ctx, offers: Offer[], topic: string): boolean {
  const next = offers.filter((o) => !(c.v.th.used ?? []).includes(o.code) && !(c.h.cash < (o.cost ?? 0)));
  if (!next.length) { general(c); return false; }
  // (five at most; all of them when they are the answers to what he came to ask, with how the player takes being asked)
  const most = next.every((o) => /^(enc|apx):/.test(o.code)) ? 8 : 5;
  c.v.choices = [...next.slice(0, most).map((o) => ({ id: 'a:' + o.code, label: o.label, says: o.says, note: o.note, group: 'reply' as const, ...(o.amount ? { amount: o.amount } : {}) })), { id: 'back', label: 'Talk about something else', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
  // (unless he has just broken in with something of his own: then that is what is in hand)
  if (!c.v.topic?.startsWith('enc:')) c.v.topic = 'act:' + topic;
  return true;
}
// What he keeps from the conversation as a subject of its own, once it has become something else between them: how he finds
// working for a boss he has just said he has no use for (the guarded answer would contradict him), and who has been leaning on him once
// he has brought it to the player as a matter (the matter is the subject now)
const soured = (c: Ctx) => { const b = c.w.chars[c.n.bossId ?? '']; return !!b && ((lastOf(c.w, c.n.id, 'mind:op:' + b.id)?.sig ?? '').startsWith('h') || (c.h.insight?.[c.n.id] ?? []).some((x) => x.startsWith(`n:Can’t stand ${b.name}.`))); };
const heldBack = (c: Ctx, code: string) => (code === 'tk:boss' && soured(c)) || (code.startsWith('tk:pressed:') && (!!myPromiseTo(c) || social(c.w).requests.some((r) => r.by === c.n.id && r.of === c.h.id && r.wants === 'intervene')));
subjectsHeldBy(heldBack);
// What he has come to ask of the player (an encounter, or work he has offered): he raises it himself, and the screen is his question
// with its answers, not a heading to find it under
function raiseHis(c: Ctx) {
  const his = actRows(c, undefined, ['his']).find((x) => /^a:(enc_open|job):/.test(x.id));
  if (his) doAct(c, his.id.slice(2), '');
}
// When his money has come up and he is short (the old engine offers a gift or a loan only then: less than $300, or his shop in the
// red), those are what the player can say next, beside whatever the subject itself allows
function offerHelp(c: Ctx) {
  if (c.v.topic?.startsWith('enc:') || c.v.choices.some((x) => /^a:(enc|apx):/.test(x.id))) return; // (his own request in hand: answered on its own)
  const help = actRows(c, undefined, ['between', 'lead', 'other']).filter((x) => /^a:(help_gift|help_loan|offer_loan|cr_cash)\b/.test(x.id) && !c.v.choices.some((y) => y.id === x.id)).slice(0, 2);
  if (!help.length) return;
  const i = c.v.choices.findIndex((x) => x.group === 'more' || x.group === 'leave' || x.group === 'intent');
  c.v.choices.splice(i < 0 ? c.v.choices.length : i, 0, ...help.map((x) => ({ ...x, group: 'reply' as const })));
}
// What a man holds back, said as what he is to the player (never as numbers): he knows you, but doesn't trust you with it; he likes
// you, but not that much yet; he respects you without liking you. Once a visit, when a subject about his own life came back guarded.
function guardedCue(c: Ctx, code: string) {
  // (each subject's own threshold, talk.ts: below it he gives the guarded answer)
  const gate = ({ trouble: 0.45, want: 0.4, racket: 0.3, boss: 0.4 } as Record<string, number>)[code.split(':')[1]];
  if (gate === undefined || code.split(':').length > 2 || c.v.mem.points.includes('cue') || candourOf(c) >= gate) return;
  const r = peek(c.n, c.h.id), known = r.known ?? 0;
  const cue = r.respect >= 0.5 && r.affection < 0.2 ? 'He’s civil with you. It’s respect, not friendship.' : r.affection >= 0.3 && r.trust < 0.3 ? 'He likes you well enough. He doesn’t trust you with that, not yet.' : known >= 0.45 ? 'He knows you by now. He keeps that to himself all the same.' : undefined;
  if (cue) { narr(c, cue); c.v.mem.points.push('cue'); }
}
// ---------------------------------------------------------------- work between them, as the world recorded it
// Work he gave the player that has come to an end since he last saw him: done (and not yet told), failed, or offered and never taken up.
// He says so, in his own words, once; the record is the job itself (jobs.ts), and what he made of it is the record's own consequence.
function jobNews(c: Ctx) {
  const { w, h, n } = c;
  const xs = w.jobs.filter((j) => j.giver === n.id && j.assignee === h.id && j.kind !== 'summons' && ['done', 'failed', 'expired'].includes(j.status) && w.now - j.created < 45 * DAY && !lastOf(w, n.id, 'job:' + j.id)); // (coming when he sent for you is not work to hear about)
  for (const j of xs.slice(-2)) {
    // (work the player took on and that stopped being needed is not work he turned his nose up at: he knows it was taken)
    const key = j.status === 'done' ? (j.reported ? 'job.ack.thanks' : 'job.ack.done') : j.status === 'failed' ? 'job.ack.failed' : j.accepted ? 'job.ack.moot' : j.status === 'declined' ? 'job.ack.declined' : 'job.ack.ignored';
    // (a man who has never met the player, whose work came to him by word of mouth, doesn't reproach him for it to his face)
    if (!acquainted(w, h, n) && /ignored|declined|moot/.test(key)) { remember(w, n.id, 'job:' + j.id, j.status); continue; }
    him(c, plain(n.id, key, { job: jobPhrase(w, j) }, j.status === 'done' ? 'warm' : 'cold'));
    remember(w, n.id, 'job:' + j.id, j.status);
    // (he has asked how it went: the answer is what the player can say first)
    if (key === 'job.ack.done') c.v.waiting = { q: 'how the job went', choices: [{ id: 'a:report', label: line(c, 'report.job'), group: 'reply' }] };
  }
}
// a job's title, as a man would refer to it ("the Costa's Deli delivery"), when it reads as a name; otherwise "that job"
// (by its place or its man, as men say it: "Palumbo's Tavern", "the business with Eddie"; never the record's own title)
const jobPhrase = (w: World, j: { title: string; biz?: Id; target?: Id }) => j.biz && w.biz[j.biz] ? w.biz[j.biz].name : j.target && w.chars[j.target] ? `the business with ${w.chars[j.target].name.split(' ')[0]}` : 'that job';
// Finished work of his not yet reported to him: the conversation's first business (the old engine's report, which he rewards)
const unreported = (c: Ctx) => c.w.jobs.some((j) => j.giver === c.n.id && j.assignee === c.h.id && j.kind !== 'summons' && j.status === 'done' && !j.reported);

const shopOf = (c: Ctx) => { const b = ownerBiz(c.w, c.n.id); return b?.open && c.n.rank === 'civilian' ? b : undefined; };
const feeOf = (c: Ctx) => { const b = shopOf(c)!; return Math.max(15, Math.round((b.income * 0.08) / 5) * 5); };
const protectAvailable = (c: Ctx) => { const b = shopOf(c); return !!b && canLean(c.w, c.h, b); }; // (the one rule: authority.leanable / canLean)
protectOwnedBy(protectAvailable);
function interveneChoice(c: Ctx, ob: Obligation, again: boolean): Choice {
  const forC = c.w.chars[ob.matter?.for ?? ''], a = c.w.chars[ob.matter?.against ?? ''];
  const cap = MY_CAPTAIN(c);
  if (overHead(c, ob) && cap) return { id: 'intervene:' + ob.id, label: line(c, 'raise.over', { captainFirst: first(cap.name), forFirst: forC ? first(forC.name) : '', againstFirst: a ? first(a.name) : '' }), note: `${first(cap.name)} won’t like you going over his head.`, group: 'matter' };
  return { id: 'intervene:' + ob.id, label: again ? line(c, 'raise.again', { forFirst: forC ? first(forC.name) : '', againstFirst: a ? first(a.name) : '' }) : line(c, 'ask.intervention', { forName: forC?.name ?? '', againstName: a?.name ?? '' }), group: 'matter' };
}
// what bears on whether the captain might answer differently now: what the player knows of the man's doings, and what the captain does
const mkey = (ob: Obligation) => 'intervene:' + (ob.matter?.for ?? '') + ':' + (ob.matter?.against ?? ob.id);
const interveneSig = (c: Ctx, ob: Obligation) => { const a = ob.matter?.against ?? '', k = captaincyOf(c.w, c.n, c.w.chars[ob.matter?.for ?? ''] ?? c.n, c.w.chars[a] ?? c.n); return `${Object.values(c.w.facts).filter((f) => c.h.known[f.id] && HOSTILE.has(f.kind) && offender(f) === a).length}:${k.knowsTrouble ? 1 : 0}`; };

// ---------------------------------------------------------------- choosing
// a choice that is a thing done, not said: told as what he does
const DEED = /^(Walk over|Ask around|Ask \w+ to |Ask to |Ask whether|Ask if|Offer to |Offer him |Offer a |Call in |Propose |Suggest |Remind him|Hand back|Hand him|Give him |Pay him |Halve |Forgive |Write off|Settle it|Put him |Make him |Say you’ll|Tell him (you|he|that|the|it)|Wreck |Send |Lean on|Bring in|Congratulate him|Welcome him|Find out|Check )/;
export function choose(w: World, v: Visit, id: string): { v: Visit; minutes: number; meeting?: Meeting; settle?: Id } {
  // (what the player has chosen in this visit: only a choice made before is "again"; moving between the headings is not saying anything)
  const picked = (v.th.picked ??= []), again = picked.includes(id), said = !/^(u|all):|^(home|more|back|leave)$/.test(id);
  const from = v.lines.length, r = chooseIn(w, v, id);
  if (said && !again) picked.push(id);
  // he does not say the same thing twice in a visit, whichever part of the conversation it came from: a long line he has already said
  // is left out; if that leaves him nothing to say, he restates it as a man does when asked about it once more, or, if the player really
  // is asking the same thing again, he says so
  const prev = new Set(v.lines.slice(0, from).filter((l) => l.who === 'him').map((l) => l.text)), mine = v.lines.slice(from);
  const kept = mine.filter((l) => !(l.who === 'him' && l.text.length > 30 && prev.has(l.text)));
  if (kept.length !== mine.length) {
    v.lines.splice(from); v.lines.push(...kept);
    if (!kept.some((l) => l.who === 'him')) {
      const dropped = mine.find((l) => l.who === 'him' && prev.has(l.text) && /^“/.test(l.text) && !/^“Like I said/.test(l.text));
      if (!again && dropped) v.lines.push({ ...dropped, text: prev.has(restate(dropped.text)) ? '“My answer’s the same.”' : restate(dropped.text) });
      else { const c = ctx(w, v), alr = unattributed(vsay(w, c.n, c.h, 'already'), c.n); v.lines.push(prev.has(alr) ? { who: 'narr', text: 'He has nothing more to say on it.' } : { who: 'him', text: alr }); }
    }
  }
  for (const l of r.v.lines.slice(from)) if (l.who === 'him') l.text = oneSpeech(l.text);
  return { ...r, v: notNow(w, r.v) };
}
// (his words in one breath: two quotations side by side are one speech, "“I wasn’t there.” “Not my business.”" read as two voices)
const oneSpeech = (t: string) => t.replace(/([.!?…—])”\s+“/g, '$1 ');
// While a man who came with something is still waiting on an answer, the way out is an answer: "Not now", said, not a silent exit
// (it puts him off: his request lapses, as it would unanswered, and he knows he was put off). Leaving otherwise is just leaving.
function notNow(w: World, v: Visit): Visit {
  const r = v.approach ? social(w).requests.find((x) => x.id === v.approach) : undefined;
  const open = r?.status === 'open';
  v.choices = v.choices.map((x) => (x.id === 'leave' ? { ...x, label: open ? 'Not now' : 'Leave' } : x));
  return v;
}
function chooseIn(w: World, v: Visit, id: string): { v: Visit; minutes: number; meeting?: Meeting; settle?: Id } {
  const c = ctx(w, v), [kind, a1, a2] = id.split(':');
  // (back to the question he is waiting on; or the question answered, by any of its answers)
  if (id === 'answer' && v.waiting) { v.choices = [...v.waiting.choices, { id: 'more', label: 'Something else…', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }]; return { v, minutes: 0 }; }
  if (v.waiting?.choices.some((x) => x.id === id)) v.waiting = undefined;
  // moving between the headings is not said aloud and takes no time
  if (kind === 'u' || kind === 'all') { if (PANES.includes(a1 as Pane)) pane(c, a1 as Pane, kind === 'all'); return { v, minutes: 0 }; }
  if (id === 'home' || id === 'more') { home(c); return { v, minutes: 0 }; }
  if (id === 'back') { v.th.fact = undefined; v.th.subject = undefined; v.th.denied = false; v.topic = undefined; general(c); return { v, minutes: 0 }; }
  // (a figure the player names goes after the choice it belongs to: o:<code>:<amount>[:<rate>])
  const base = [...v.choices, ...everything(w, v)].find((x) => x.id === id || (!!x.amount && id.startsWith(x.id + ':') && /^:\d+(:[\d.]+)?$/.test(id.slice(x.id.length))));
  const label = base?.label;
  // (where he stands: answered from the family's actual conditions, and against what he was told last time: see doAdvance)
  // (a figure is said as the figure: "$70 a week.", not the name of the button)
  const fig = base?.amount && id !== base.id ? id.slice(base.id.length + 1).split(':').map(Number) : undefined;
  const ak = fig ? openAsks(w).find((q) => q.id === base!.id.split(':')[2])?.ak : undefined;
  const figSaid = fig ? `“${money(fig[0])}${fig[1] !== undefined ? `, at ${Math.round(fig[1] * 100)} percent a week` : ak === 'protect' || ak === 'rate' ? ' a week' : ''}.”` : undefined;
  // (answering something he came about by doing it, "Go, with a modest envelope", is an act, told by what follows, not a line of speech)
  if (label && kind === 'a') {
    // what the player says, or, when the choice is a thing he does ("Walk over and say who you are", "Offer to lend him money"), what he
    // does, told as such; and not at all when the doing tells itself ("You walk over, give your name…")
    const spoken = figSaid ?? base?.says ?? label, at = v.lines.length;
    const deed = !figSaid && !base?.says && !/^[“"‘]/.test(label) && DEED.test(label);
    if ((a1 !== 'enc' || base?.says) && !/:force$/.test(id)) { if (deed) v.lines.push({ who: 'narr', text: `You ${label.charAt(0).toLowerCase()}${label.slice(1)}${/[.!?]$/.test(label) ? '' : '.'}` }); else you(c, spoken); }
    const r = doAct(c, id.slice(2), label);
    if (deed && v.lines[at]?.who === 'narr' && v.lines[at + 1]?.who === 'narr' && /^You /.test(v.lines[at + 1].text)) v.lines.splice(at, 1);
    return { v, ...r };
  }
  // (an approach is chosen by name and said in words: what the player says is the line it stands for)
  const spoken = base?.says ?? label;
  if (id === 'leave') {
    v.ended = true;
    if (v.waiting) { narr(c, 'You leave without answering him.'); door.regard(w, c.n, c.h.id, 'trust', -0.01, `${c.h.name} didn’t answer him`); remember(w, c.n.id, 'unanswered', v.waiting.q); v.waiting = undefined; }
    // (walking out on a refusal is taking it: he said no, and the matter is remembered as refused, as if the player had let it go)
    if (v.topic?.startsWith('intervene:')) { const ob = social(w).obs.find((o) => o.id === v.topic!.slice(10)); if (ob) { remember(w, c.n.id, mkey(ob), 'refused', interveneSig(c, ob)); const rq = social(w).requests.filter((x) => x.by === c.h.id && x.of === c.n.id && x.parent === ob.id && x.status === 'open').at(-1); if (rq) { rq.status = 'refused'; note(rq, w.now, 'he walked out on it'); } } }
    const r = v.approach ? social(w).requests.find((x) => x.id === v.approach) : undefined;
    if (r && r.status === 'open') { r.status = 'lapsed'; note(r, w.now, 'put off'); you(c, 'Not now.'); him(c, plain(c.n.id, 'react.putOff', {}, 'flat')); remember(w, c.n.id, 'putoff:' + r.id, r.wants); }
    return { v, minutes: 0 };
  }
  if (!label) return { v, minutes: 0 }; // (not on offer: refused, never invented)
  you(c, spoken!);
  let minutes = 10;
  switch (kind) {
    case 'promise': doPromise(c, a1 as ObType, a2); break;
    case 'help': if (a1 === 'details') helpDetails(c, a2); else helpRefuse(c, a2); break;
    case 'report': doReport(c, a1 as 'done', a2, id.split(':')[3] as 'done' | 'refused' | undefined); break;
    case 'confront': doConfront(c, a1 as 'sorry', a2); break;
    case 'intervene': doIntervene(c, a1, []); break;
    case 'argue': doIntervene(c, a2, [...new Set([...v.mem.argued, a1])] as never, a1); break;
    case 'letgo': { if (a1 === 'protect') { him(c, plain(c.n.id, 'react.letgo')); general(c); break; } const ob = social(w).obs.find((o) => o.id === a1)!; him(c, plain(c.n.id, 'react.letgo')); remember(w, c.n.id, mkey(ob), 'refused', interveneSig(c, ob)); general(c); break; }
    case 'protect': doProtect(c, a1 as 'plain'); break;
    case 'loan': doLoan(c, Number(a1) || 500, a2); break;
    case 'who': doWho(c, a1); break;
    case 'answers': doAnswers(c, a1); break;
    case 'tell': doTell(c, a1); break;
    case 'news': if (v.mem.points.includes('news')) { says(c, vsay(w, c.n, c.h, 'already')); general(c); minutes = 2; break; } doNews(c); break;
    case 'thank': him(c, plain(c.n.id, 'react.thanks')); general(c); break;
    case 'pass': doPass(c, a1, a2 as 'done' | 'refused'); break;
    case 'hisword': doHisWord(c, a1); break;
    case 'hw': doHoldWord(c, a1 as 'hold', a2); break;
    case 'cf': { const r = doConfrontMove(c, a1, a2); if (r.settle) return { v, minutes, settle: c.n.id }; break; }
    case 'accuse': doAccuse(c, a1); break;
    case 'credit': {
      const ob = social(w).obs.find((o) => o.id === a2);
      if (ob) { say(w, c.h, c.n, 'credit:' + ob.id, a1 === 'lie' ? 'self' : 'none', 'own', a1 !== 'lie'); if (a1 === 'lie') say(w, c.h, c.n, 'ob:' + ob.id, 'done', 'own', false); judge(w, c.n, ob); }
      him(c, plain(c.n.id, a1 === 'lie' ? 'react.credit.claimed' : 'react.credit.notMe', {}, a1 === 'lie' ? 'warm' : 'flat'));
      remember(w, c.n.id, 'credit:' + a2, a1); c.v.topic = undefined; general(c); break;
    }
    case 'spend': if (v.mem.points.includes('spend')) { says(c, vsay(w, c.n, c.h, 'already')); general(c); minutes = 2; break; } minutes = doSpend(c); break;
    default: general(c);
  }
  return { v, minutes };
}

function helpDetails(c: Ctx, rid: Id) {
  const { w, h, n } = c, r = social(w).requests.find((x) => x.id === rid), f = r?.fact ? w.facts[r.fact] : undefined, a = w.chars[r?.against ?? ''];
  if (f) door.inform(w, n, h, f, r!.about);
  him(c, plain(n.id, 'tell.happened', { againstFirst: a ? first(a.name) : 'They', did: f?.kind === 'vandalism' ? 'smashed the place up' : f?.kind === 'beating' ? 'gave me a beating' : f?.kind === 'threat' ? 'leaned on me' : 'came asking for money, and I said no', lastSeen: f ? agoWords(w.now, f.t) : '' }, 'pleading'));
  if (r) openHelpChoices(c, r); // (the same answers, now that he has said it)
}
function openHelpChoices(c: Ctx, r: Request, details = false) {
  const a = c.w.chars[r.against ?? ''], cap = MY_CAPTAIN(c);
  const ch: Choice[] = [];
  if (cap) ch.push({ id: `promise:action:${r.id}`, label: line(c, 'promise.action', { captainFirst: first(cap.name) }), group: 'reply' });
  ch.push({ id: `promise:effort:${r.id}`, label: line(c, 'promise.effort'), group: 'reply' }, { id: `promise:result:${r.id}`, label: line(c, 'promise.result', { againstFirst: a ? first(a.name) : '' }), group: 'reply' });
  if (details) ch.push({ id: `help:details:${r.id}`, label: line(c, 'ask.happened'), group: 'reply' });
  ch.push({ id: `help:refuse:${r.id}`, label: line(c, 'refuse.help'), group: 'reply' });
  // (four answers at most, then leaving: what happened comes first if he hasn't said)
  c.v.choices = [...(details ? [ch.find((x) => x.id.startsWith('help:details'))!] : []), ...ch.filter((x) => !x.id.startsWith('help:details'))].slice(0, 4);
  c.v.choices.push({ id: 'leave', label: 'Leave', group: 'leave' });
}
function helpRefuse(c: Ctx, rid: Id) {
  const { w, h, n } = c, r = social(w).requests.find((x) => x.id === rid);
  if (r) { if (r.against) askedInPerson(w, n.id, r.against, r); r.status = 'refused'; note(r, w.now, `${h.name} would not help`); }
  door.regard(w, n, h.id, 'trust', -0.03, `${h.name} would not help him`);
  him(c, plain(n.id, 'react.help.refused', {}, 'cold'));
  remember(w, n.id, 'help:' + rid, 'refused');
  c.v.topic = undefined;
  general(c);
}

function doIntervene(c: Ctx, obId: Id, args: ('ground' | 'word' | 'money')[], arg?: string) {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (!ob) return general(c);
  const forC = w.chars[ob.matter?.for ?? ''], a = w.chars[ob.matter?.against ?? ''];
  if (!forC || !a) return general(c);
  c.v.topic = 'intervene:' + ob.id;
  if (arg && !c.v.mem.argued.includes(arg)) c.v.mem.argued.push(arg);
  const mem = new EncounterMemory(2); mem.said = new Set(c.v.mem.points); mem.argued = [...c.v.mem.argued]; mem.pressed = c.v.mem.pressed;
  if (!arg) {
    // (over his captain's head: the captain hears of it, and thinks less of the man who went round him)
    const cap = MY_CAPTAIN(c);
    if (cap && cap.id !== n.id && overHead(c, ob)) { door.regard(w, cap, h.id, 'respect', -0.05, `${h.name} went over his head to ${n.name}`); remember(w, cap.id, 'overhead', n.id); }
    door.raise(w, h, n, (ob.spec as { about?: string }).about ?? 'matter', predictAcceptance(c.ph(), n, false), true);
    request(w, { by: h.id, of: n.id, wants: 'intervene', about: (ob.spec as { about?: string }).about ?? 'matter', for: forC.id, against: a.id, biz: ob.matter?.biz, fact: ob.matter?.fact, parent: ob.id });
  }
  // an argument that rests on something he can be shown: the player tells him what he knows
  if (arg === 'ground') { const f = henryKnowsTroubleBy(c, a.id); if (f) door.inform(w, h, n, f, 'matter'); }
  const k = captaincyOf(w, n, forC, a, h);
  const r = onIntervention(c.pn(), h, forC, a, k, args, mem);
  c.v.mem.points = [...mem.said]; c.v.mem.pressed = mem.pressed;
  const reply: Reply = r.meaning.key === 'refuse.intervention' && arg ? { ...r, meaning: { ...r.meaning, key: r.argReplies.at(-1)?.key ?? r.meaning.key, grounds: undefined } } : r;
  him(c, reply);
  const req = social(w).requests.filter((x) => x.by === h.id && x.of === n.id && x.parent === ob.id).at(-1);
  if (r.decision.chosen === 'accept') {
    const chair = chairFor(w, a, forC) ?? n;
    const g = agreement(w, [h.id, n.id], `${n.name} will speak to ${chair.name}`, [h.id], req?.id);
    promise(w, { type: 'action', obligor: n.id, beneficiary: h.id, promisee: h.id, spec: { kind: 'actionDone', act: 'raise', target: chair.id, about: (ob.spec as { about?: string }).about ?? 'matter' }, from: w.now, by: w.now + 7 * DAY, parent: ob.id, matter: ob.matter, notify: [h.id], liabilities: [{ who: h.id, by: n.id, feeling: 'trust', amount: 0.15, why: `it turned ugly over ${h.name}'s matter` }] }, g);
    if (req) req.status = 'agreed';
    remember(w, n.id, mkey(ob), 'agreed');
    c.v.topic = undefined;
    return general(c);
  }
  if (r.meaning.key === 'cutOff.argument' || !r.nextArgs.length) {
    if (req) req.status = 'refused';
    remember(w, n.id, mkey(ob), 'refused', interveneSig(c, ob));
    c.v.topic = undefined;
    return general(c);
  }
  // answers to his reason, not a menu: what the player can put to him, from what he knows
  const ch: Choice[] = [];
  for (const x of r.nextArgs) {
    if (x === 'ground') {
      // what he can tell him is what he knows, said as what it was (a demand refused is not a shop smashed up)
      const f = henryKnowsTroubleBy(c, a.id), vic = f ? w.chars[injured(f) ?? ''] : undefined;
      const key = !f || !f.business ? 'argue.ground' : f.kind === 'vandalism' ? 'tell.trouble' : 'tell.trouble.' + f.kind;
      ch.push({ id: `argue:ground:${ob.id}`, label: 'Persuade', note: f ? 'Tell him what you know of it.' : 'It’s our ground.', says: line(c, key, { againstFirst: first(a.name), shop: f?.business ? w.biz[f.business].name : '', victimFirst: vic ? first(vic.name) : '' }), group: 'reply' });
    }
    if (x === 'word') ch.push({ id: `argue:word:${ob.id}`, label: 'Appeal to your word', note: `You promised ${first(forC.name)}.`, says: line(c, 'argue.word', { forFirst: first(forC.name) }), group: 'reply' });
    if (x === 'money') ch.push({ id: `argue:money:${ob.id}`, label: 'Negotiate', note: 'Make it worth his while.', says: line(c, 'argue.money', { forFirst: first(forC.name) }), group: 'reply' });
  }
  c.v.choices = [...ch.slice(0, 3), { id: `letgo:${ob.id}`, label: 'Accept his decision', says: line(c, 'let.go'), group: 'reply' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}

function doProtect(c: Ctx, how: string) {
  const { w, h, n } = c, b = shopOf(c);
  if (!b) return general(c);
  const fee = Number(c.v.mem.offered.fee ?? feeOf(c));
  const mem = new EncounterMemory(2); mem.said = new Set(c.v.mem.points); mem.pressed = c.v.mem.pressed;
  if (how === 'press') { mem.pressed++; door.regard(w, n, h.id, 'fear', 0.05, `${h.name} pressed him`); }
  const s2 = c.s; if (h.familyId) s2.told[n.id] = { [h.id]: { family: w.fam[h.familyId].name, name: h.name, basis: { kind: 'claimed', ref: 'he said so' } } };
  const r = onProtectionDemand(perceive(w, s2, n), h, how === 'take' ? Number(c.v.mem.offered.counter) : fee, how === 'press' ? 'lean' : 'plain', mem);
  c.v.mem.points = [...mem.said]; c.v.mem.pressed = mem.pressed;
  if (how === 'take' && c.v.mem.offered.counter) { const sit = openAsk(w, 'protect', h, n, { biz: b.id, amt: Number(c.v.mem.offered.counter) }); if (sit) door.agree(w, sit, 'protect:' + n.id); narr(c, `${first(n.name)} nods.`); card(c, 'card.agreed.counter', { amt: `$${c.v.mem.offered.counter}` }); remember(w, n.id, 'protect', 'agreed'); return general(c); }
  if (how === 'return') { him(c, onAnnouncement(c.pn(), h, 'Friday')); remember(w, n.id, 'protect', 'refused', String(fee)); return general(c); }
  him(c, r);
  if (r.decision.chosen === 'accept') { const sit = openAsk(w, 'protect', h, n, { biz: b.id, amt: fee }); if (sit) door.agree(w, sit, 'protect:' + n.id); card(c, r.meaning.key === 'accept.protection.afraid' ? 'card.accept.protection.afraid' : 'card.accept.protection', { amt: `$${fee}` }); remember(w, n.id, 'protect', 'agreed'); return general(c); }
  remember(w, n.id, 'protect', r.decision.chosen, String(fee));
  if (r.decision.chosen === 'counter') c.v.mem.offered.counter = r.counterAmt ?? 0;
  const APPROACH: Record<string, [string, string?]> = { 'protect:take': ['Take his offer', `$${r.counterAmt ?? fee} a week.`], 'protect:press': ['Pressure', 'Make him think about it.'], 'tell.reputation': ['Tell him who you are', 'Your name, and who you are with.'], 'protect:return': ['Give him time'] };
  c.v.choices = [...r.followups.filter((f) => f.key !== 'ask.whoPays' || !c.v.mem.points.includes('named:collector')).map((f) => { const id = f.key === 'accept.counter' ? 'protect:take' : f.key === 'press.now' ? 'protect:press' : f.key === 'announce.return' ? 'protect:return' : f.key === 'tell.reputation' ? 'protect:press' : 'protect:return'; const ap = APPROACH[f.key] ?? APPROACH[id]; return { id, label: ap[0], note: ap[1], says: line(c, f.key, { amt: `$${r.counterAmt ?? fee}`, day: 'Friday' }), group: 'reply' as const }; }).filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i).slice(0, 3), { id: 'letgo:protect', label: 'Let it go', says: line(c, 'let.go'), group: 'reply' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}

function doLoan(c: Ctx, amt: number, how?: string) {
  const { w, h, n } = c;
  const mem = new EncounterMemory(2); mem.said = new Set(c.v.mem.points);
  // the negotiation in hand: every argument made in it, in order, and so every term now on the table (a new argument adds to them)
  const neg = (c.v.th.loan ??= { amt, made: [] });
  const arg = how === 'rep' || how === 'rate' || how === 'promise' ? how : undefined;
  if (arg) neg.made.push(arg);
  const made = neg.made;
  const offered = { ...(made.includes('rep') ? { reputation: true } : {}), ...(made.includes('rate') ? { rate: 0.08 } : {}), ...(made.includes('promise') ? { promise: 'the end of the month' } : {}) };
  if (how === 'take' && c.v.mem.offered.loan) { const sit = openAsk(w, 'borrow', h, n, { amt: Number(c.v.mem.offered.loan), rate: Number(c.v.mem.offered.rate ?? 5) / 100 }); if (sit) door.agree(w, sit, 'loan'); says(c, temper(n).agreeable > 0.55 ? '“Good. We understand each other.”' : '“Done. Don’t make me come looking for it.”', settled(n.id, 'agrees', 'you took his figure')); card(c, 'card.agreed.loan', { amt: `$${c.v.mem.offered.loan}`, rate: String(c.v.mem.offered.rate ?? 5) }); remember(w, n.id, 'loan', 'agreed'); return general(c); }
  const r = onLoanRequest(c.pn(), h, amt, mem, offered, arg, made);
  c.v.mem.points = [...mem.said];
  him(c, r);
  if (r.decision.chosen === 'accept') { const rate = offered.rate ? 8 : 5; const sit = openAsk(w, 'borrow', h, n, { amt, rate: rate / 100 }); if (sit) door.agree(w, sit, 'loan'); card(c, 'card.agreed.loan', { amt: `$${amt}`, rate: String(rate) }); remember(w, n.id, 'loan', 'agreed'); c.v.th.loan = undefined; return general(c); }
  remember(w, n.id, 'loan', r.decision.chosen);
  if (r.counter) { c.v.mem.offered.loan = r.counter.amt; c.v.mem.offered.rate = Math.round(r.counter.rate * 100); }
  c.v.choices = [...r.followups.slice(0, 3).map((f) => ({ id: `loan:${amt}:${f.key === 'accept.counter.loan' ? 'take' : f.key === 'argue.reputation' ? 'rep' : f.key === 'sweeten.rate' ? 'rate' : 'promise'}`, label: line(c, f.key, f.slots ?? {}), group: 'reply' as const })), { id: 'back', label: line(c, 'let.go'), group: 'reply' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}

function doWho(c: Ctx, fid: Id) {
  const { w, h, n } = c, f = w.facts[fid];
  if (!f) return general(c);
  const actor = f.actor ? w.chars[f.actor] : undefined, guess = n.known[f.id]?.blame ? w.chars[n.known[f.id].blame!] : undefined;
  const r = onWhoQuestion(c.pn(), h, f.id, actor, undefined, guess ? first(guess.name) : undefined);
  him(c, r);
  const named = r.meaning.slots?.named;
  if (named) { say(w, n, h, 'who:' + f.id, named, r.meaning.role === 'witness' || r.meaning.role === 'victim' ? 'seen' : 'rumour', r.honest); if (r.honest && n.known[f.id]?.knowsActor && r.decision.chosen === 'knows') door.inform(w, n, h, f, 'who'); }
  remember(w, n.id, 'who:' + fid, r.decision.chosen);
  general(c);
}
function doAnswers(c: Ctx, mid: Id) {
  const { w, h, n } = c, m = w.chars[mid];
  if (!m) return general(c);
  const held = belief(w, n, 'answersTo:' + m.id).value;
  const r = onAnswersTo(c.pn(), h, m, held);
  him(c, r.decision.chosen === 'tell' && held ? plain(n.id, 'answer.answersTo', { manFirst: first(m.name), chairName: w.chars[held]?.name ?? '' }) : r);
  if (r.decision.chosen === 'tell' && held) say(w, n, h, 'answersTo:' + m.id, held, n.familyId === m.familyId ? 'seen' : 'rumour', true);
  general(c);
}
function doTell(c: Ctx, fid: Id) {
  const { w, h, n } = c, f = w.facts[fid];
  if (!f) return general(c);
  const knew = !!n.known[f.id];
  door.inform(w, h, n, f, 'news');
  him(c, knew ? plain(n.id, 'answer.knewTopic') : onUnknownTopic(c.pn(), h, f.business ? w.biz[f.business].name : 'it'));
  remember(w, n.id, 'tell:' + fid, knew ? 'knew' : 'told');
  general(c);
}

// Passing on how it went: a claim the man weighs like any other (true here: the player says what he was told)
// His word to the player, as the player sees it: past its time, or broken, and not done as far as the player believes (never on
// what the player cannot know: the player's own belief decides it); not put to him again within the week
function hisWordToMe(c: Ctx): Obligation[] {
  const { w, h, n } = c;
  return social(w).obs.filter((o) => o.obligor === n.id && (o.beneficiary === h.id || o.promisee === h.id) && (o.status === 'pending' || o.status === 'broken') && !(lastOf(w, n.id, 'hisword:' + o.id) && w.now - lastOf(w, n.id, 'hisword:' + o.id)!.t < 7 * DAY)).filter((o) => {
    const b = belief(w, h, 'ob:' + o.id).value;
    return b !== 'done' && b !== 'kept' && (w.now > o.by || b === 'broken' || b === 'notDone');
  });
}
// Something the player knows this man did (and knows it was him), to the player or to the player's own: his man, a shop he collects
// from, a man he has promised to look after; recent, and not yet put to him
function knownAgainstMine(c: Ctx): Fact[] {
  const { w, h, n } = c;
  const mine = (id?: Id) => !!id && (id === h.id || w.chars[id]?.bossId === h.id || social(w).obs.some((o) => o.obligor === h.id && o.beneficiary === id && o.status === 'pending'));
  return Object.values(w.facts).filter((f) => HOSTILE.has(f.kind) && offender(f) === n.id && !!h.known[f.id]?.knowsActor && w.now - f.t < 30 * DAY && !lastOf(w, n.id, 'accuse:' + f.id)
    && (mine(injured(f)) || (!!f.business && w.biz[f.business]?.protection?.collectorId === h.id))).sort((a, b) => b.t - a.t).slice(0, 2);
}
// Put to him: he answers from what he did and his own nature (respond.onProgressAsked: the truth, or a lie to save face)
function doHisWord(c: Ctx, obId: Id) {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (!ob) return general(c);
  const sp = ob.spec as { kind: string; act?: string; target?: Id }, tg = w.chars[sp.target ?? ''];
  const did = ob.status === 'kept' || (sp.kind === 'actionDone' && social(w).log.some((x) => x.actor === n.id && x.act === sp.act && x.target === sp.target && x.t >= ob.from));
  const r = onProgressAsked(c.pn(), h, did, Math.ceil((ob.by - w.now) / DAY));
  say(w, n, h, 'ob:' + ob.id, r.says, 'own', r.honest);
  him(c, { ...r, meaning: { ...r.meaning, key: 'answer.word.' + r.says, slots: { targetFirst: tg ? first(tg.name) : 'him' } } });
  remember(w, n.id, 'hisword:' + ob.id, r.says);
  // (not done, by his own account: the player can hold him to it, or let it go; what he said stands either way)
  if (r.says === 'done') return general(c);
  const over = standingOf(c) === 'over';
  c.v.topic = 'hisword:' + ob.id;
  c.v.choices = [
    { id: 'hw:hold:' + ob.id, label: 'Hold him to it', note: over ? 'Politely. He outranks you.' : undefined, says: line(c, over ? 'hold.word.up' : 'hold.word'), group: 'reply' },
    { id: 'hw:release:' + ob.id, label: 'Let it go', says: line(c, 'release.word'), group: 'reply' },
    { id: 'back', label: 'Talk about something else', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' },
  ];
}
// Who he is to the player in the family's order: a man who answers to him, one he answers to, or neither (what may be said, and
// what it costs, differ: pressing a man above you is allowed, and remembered)
function standingOf(c: Ctx): 'under' | 'over' | 'peer' {
  const { w, h, n } = c;
  if (n.bossId === h.id || superiors(w, n).some((x) => x.id === h.id)) return 'under';
  if (h.bossId === n.id || superiors(w, h).some((x) => x.id === n.id)) return 'over';
  return 'peer';
}
function doHoldWord(c: Ctx, how: 'hold' | 'release', obId: Id) {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (!ob) return general(c);
  if (how === 'release') { release(w, ob, `${h.name} let it go`); door.regard(w, n, h.id, 'affection', 0.02, `${h.name} let him off`); him(c, plain(n.id, 'react.letgo')); remember(w, n.id, 'hisword:' + ob.id, 'released'); c.v.topic = undefined; return general(c); }
  // (held to it: a few more days to do it, and a man who answers to the player feels it; the man above him notes that he was pressed)
  ob.by = Math.max(ob.by, w.now + 5 * DAY);
  const st = standingOf(c);
  if (st === 'under') door.regard(w, n, h.id, 'fear', 0.04, `${h.name} held him to his word`);
  if (st === 'over') door.regard(w, n, h.id, 'respect', -0.02, `${h.name} pressed him on his word`);
  him(c, plain(n.id, st === 'over' ? 'react.held.up' : 'react.held', {}, 'flat'));
  remember(w, n.id, 'hisword:' + ob.id, 'held');
  c.v.topic = undefined;
  general(c);
}
// Accused of what the player knows he did: he admits, denies or defies, from what he thinks the player has on him and his nature
// (respond.onConfrontation). A denial to a man who knows is a lie on record (the old engine can put it to him: Character.denied).
function doAccuse(c: Ctx, fid: Id) {
  const { w, h, n } = c, f = w.facts[fid];
  if (!f) return general(c);
  const k = h.known[f.id], strong = k?.from === 'witness' || k?.from === 'self' ? 1 : 0.6; // (he saw it, or was told)
  answerAccusation(c, f, strong);
}
// He answers what is put to him (respond.onConfrontation: what he thinks the player has on him, his fear, pride and conscience), and
// the player answers that: the subject stays open until it is settled, dropped, or taken elsewhere
function answerAccusation(c: Ctx, f: Fact, evidence: number) {
  const { w, h, n } = c;
  const r = onConfrontation(c.pn(), h, true, evidence);
  him(c, { ...r, meaning: { ...r.meaning, key: 'accused.' + r.intent } });
  remember(w, n.id, 'accuse:' + f.id, r.intent);
  if (r.intent === 'admit') door.regard(w, n, h.id, 'fear', 0.03, `${h.name} knew what he did`);
  else if (r.intent === 'deny') (n.denied ??= {})[f.id] = Math.floor(w.now / DAY);
  else door.regard(w, n, h.id, 'affection', -0.04, `${h.name} accused him`);
  c.v.topic = 'accuse:' + f.id;
  const used = new Set(c.v.mem.argued), st = standingOf(c), k = h.known[f.id];
  const ch: Choice[] = [];
  if (r.intent === 'deny' && !used.has('cf:evidence')) ch.push({ id: 'cf:evidence:' + f.id, label: 'Tell him how you know', note: k?.from === 'witness' || k?.from === 'self' ? 'You saw it.' : `You heard it from ${w.chars[k?.from ?? '']?.name.split(' ')[0] ?? 'someone'}.`, says: line(c, k?.from === 'witness' || k?.from === 'self' ? 'accuse.saw' : 'accuse.heard'), group: 'reply' });
  if (r.intent !== 'admit' && !used.has('cf:press')) ch.push({ id: 'cf:press:' + f.id, label: 'Pressure', note: st === 'over' ? 'He outranks you. He will remember it.' : st === 'under' ? 'He answers to you.' : 'Make him think about it.', says: line(c, 'accuse.press.' + st), group: 'reply' });
  // (a man above the player is not put in his debt: he can be asked to leave the player's people alone, or let be)
  if (r.intent === 'admit' && st !== 'over') ch.push({ id: 'cf:amends:' + f.id, label: 'Give him a chance to make it right', note: 'He will owe you for it.', says: line(c, 'accuse.amends'), group: 'reply' });
  if (r.intent === 'admit') ch.push({ id: 'cf:warn:' + f.id, label: st === 'over' ? 'Ask him to leave yours alone' : 'Warn him', says: line(c, st === 'over' ? 'accuse.warn.up' : 'accuse.warn'), group: 'reply' });
  if (r.intent === 'defy') ch.push({ id: 'cf:settle:' + f.id, label: 'Settle it another way', note: 'Not with words.', says: line(c, 'accuse.settle'), group: 'reply' }, { id: 'cf:back:' + f.id, label: 'Back down', says: line(c, 'accuse.back'), group: 'reply' });
  if (r.intent === 'deny') ch.push({ id: 'cf:accept:' + f.id, label: 'Take his word for it', says: line(c, 'accuse.accept'), group: 'reply' });
  if (r.intent === 'admit') ch.push({ id: 'cf:accept:' + f.id, label: 'Leave it there', says: line(c, 'accuse.leave'), group: 'reply' });
  c.v.choices = [...ch.slice(0, 4), { id: 'back', label: 'Talk about something else', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}
// An approach to the accusation: the evidence, pressure (what it costs depends on who he is to the player), making it right, a warning,
// backing down, taking his word; or taking it out of the conversation (the old "take action against him" screen)
function doConfrontMove(c: Ctx, move: string, fid: Id): { settle?: boolean } {
  const { w, h, n } = c, f = w.facts[fid];
  if (!f) { general(c); return {}; }
  const st = standingOf(c), k = h.known[f.id], seen = k?.from === 'witness' || k?.from === 'self';
  c.v.mem.argued.push('cf:' + move);
  if (move === 'evidence') { answerAccusation(c, f, seen ? 1.6 : 1.1); return {}; }
  if (move === 'press') {
    door.regard(w, n, h.id, 'fear', st === 'under' ? 0.08 : st === 'peer' ? 0.05 : 0.02, `${h.name} pressed him`);
    if (st === 'over') { door.regard(w, n, h.id, 'respect', -0.06, `${h.name} pressed him, above his place`); bear(w, n, h.id, 0.1, `${h.name} leaned on him over ${f.text}`); }
    else if (st === 'peer') door.regard(w, n, h.id, 'affection', -0.04, `${h.name} leaned on him`);
    answerAccusation(c, f, seen ? 1.2 : 0.8); return {};
  }
  if (move === 'amends') { addFavour(w, h.id, n.id, 1, 'let it go when he owned up' /* (a short phrase: the old engine says a favour back as one, voicesheet {What}) */); him(c, plain(n.id, 'accused.amends', {}, 'flat')); remember(w, n.id, 'accuse:' + f.id, 'amends'); }
  else if (move === 'warn') { door.regard(w, n, h.id, 'fear', st === 'over' ? 0.01 : 0.05, `${h.name} warned him`); him(c, plain(n.id, st === 'over' ? 'accused.warned.up' : 'accused.warned', {}, 'flat')); remember(w, n.id, 'accuse:' + f.id, 'warned'); }
  else if (move === 'back') { door.regard(w, n, h.id, 'respect', -0.04, `${h.name} backed down`); him(c, plain(n.id, 'accused.backed', {}, 'flat')); remember(w, n.id, 'accuse:' + f.id, 'backed'); }
  else if (move === 'accept') { him(c, plain(n.id, 'react.letgo')); remember(w, n.id, 'accuse:' + f.id, 'accepted'); }
  else if (move === 'settle') { remember(w, n.id, 'accuse:' + f.id, 'settle'); c.v.ended = true; c.v.choices = []; return { settle: true }; }
  c.v.topic = undefined;
  general(c);
  return {};
}
// The "not yet"s he has had from the player on this matter, across every promise about it: a new promise does not wipe the slate
function delaysOn(c: Ctx, ob: Obligation) {
  const same = new Set(social(c.w).obs.filter((o) => o.obligor === ob.obligor && o.beneficiary === ob.beneficiary && (o.matter?.against ?? '') === (ob.matter?.against ?? '')).map((o) => 'progress:' + o.id));
  return memOf(c.w, c.n.id).topics.filter((x) => same.has(x.k) && x.out === 'notyet');
}
// what the player has heard of how it went with the man he took it to, not yet passed on to the man he promised
function passOf(c: Ctx, mine: Obligation): 'done' | 'refused' | undefined {
  if (lastOf(c.w, c.n.id, 'passed:' + mine.id)) return undefined;
  const heard = [...(social(c.w).said ?? [])].reverse().find((x) => x.to === c.h.id && x.subject === 'credit:' + mine.id);
  const via = social(c.w).obs.find((o) => o.parent === mine.id && o.beneficiary === c.h.id);
  const refused = via && social(c.w).requests.some((r) => r.parent === via.id && r.status === 'refused');
  return refused ? 'refused' : heard ? 'done' : undefined;
}
const passLine = (c: Ctx, mine: Obligation, how: 'done' | 'refused') => { const a = c.w.chars[mine.matter?.against ?? ''], cap = MY_CAPTAIN(c); return line(c, how === 'refused' ? 'pass.refused' : 'pass.done', { captainFirst: cap ? first(cap.name) : 'the family', againstFirst: a ? first(a.name) : '' }); };
function doPass(c: Ctx, obId: Id, how: 'done' | 'refused') {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (!ob) return general(c);
  say(w, h, n, 'credit:' + ob.id, how === 'done' ? 'delegate' : 'none', 'told', true);
  if (how === 'refused') door.regard(w, n, h.id, 'trust', 0.02, `${h.name} told him straight`);
  him(c, plain(n.id, how === 'done' ? 'react.pass.done' : 'react.pass.refused', {}, how === 'done' ? 'warm' : 'flat'));
  remember(w, n.id, 'passed:' + ob.id, how);
  general(c);
}
// What's new: what is on his mind, as he would tell it to the player (only what he knows, only if he would say it to him)
// What is on his mind (talk.ts: his troubles, his shop or racket, what he wants, the men he can't stand or admires, his family, the
// man he works for, who is leaning on him), worked out from the world as it is and remembered per subject. The heaviest that is fresh
// (not just been over, unchanged) and that this layer does not already carry is what he brings up himself, if anything is.
// Only his own life counts (not the street's news, which is "What's new?" itself), and what he has brought up lately waits its turn:
// a man with several things on his mind does not keep coming back to the same one.
const HIS_OWN = /^(trouble|shop|racket|want|op:|kin:|boss|pressed:)/;
function onHisMind(c: Ctx, floor: number): { key: string; weight: number; sig: string } | undefined {
  // (said already, and nothing about it has changed: he has nothing new to say of it, unless it is weighing on him)
  const stale = (x: { key: string; sig: string }) => { const l = lastOf(c.w, c.n.id, 'mind:' + x.key), a = lastOf(c.w, c.n.id, 'ans:tk:' + x.key); return (!!l && (l.sig === x.sig || c.w.now - l.t < 14 * DAY)) || (!!a && c.w.now - a.t < 14 * DAY); }; // (or asked about lately)
  const xs = subjectsOf(c.w, c.h, c.n).filter((x) => HIS_OWN.test(x.key) && x.weight >= floor && !heldBack(c, 'tk:' + x.key));
  const s = xs.find((x) => !stale(x)) ?? (xs[0] && xs[0].weight >= 0.5 ? xs[0] : undefined);
  return s ? { key: s.key, weight: s.weight, sig: s.sig } : undefined;
}
// what an evening turned on, in a few words, when it was what was on his mind
function aboutWords(c: Ctx, key: string): string {
  const k = key.split(':')[0], o = c.w.chars[key.split(':')[1] ?? ''], b = c.w.chars[c.n.bossId ?? ''], biz = ownerBiz(c.w, c.n.id);
  return k === 'want' ? 'what he wants out of all this' : (k === 'op' || k === 'kin') && o ? first(o.name) : k === 'pressed' ? 'who has been leaning on him' : k === 'boss' && b ? `working for ${first(b.name)}` : k === 'trouble' ? 'what is weighing on him' : k === 'family' ? 'his family' : k === 'shop' && biz ? biz.name : k === 'racket' ? 'his racket' : 'his own business';
}
// Asked what is new by the man who is leaning on him: the trouble on his mind is the man asking. He says so, in his manner and as far as
// he dares, and what can be said next is what can be said about the demand itself (the matter between them), not help against anyone.
function yourTrouble(c: Ctx, pid: Id) {
  const { w, h, n } = c, b = ownerBiz(w, n.id), sit = b ? askBetween(w, 'protect', h.id, n.id, b.id) : undefined, fear = peek(n, h.id).fear ?? 0;
  him(c, plain(n.id, fear >= 0.3 ? 'news.yourDemand.afraid' : 'news.yourDemand', { shop: b?.name ?? '' }, fear >= 0.3 ? 'afraid' : 'cold'));
  remember(w, n.id, 'trouble:' + pid, 'you');
  const next = sit ? ACTS.m?.offersFor?.(c, sit.id) ?? [] : [];
  if (next.length) return afterAct(c, next, 'news');
  general(c);
}
function doNews(c: Ctx) {
  const { w, h, n } = c, pn = c.pn(), r = peek(n, h.id);
  c.v.mem.points.push('news');
  const willTell = r.trust >= 0.15 || r.affection >= 0.25 || pn.temper.agreeable > 0.6 || candourOf(c) >= 0.25;
  // what is weighing on him comes first: trouble he is trying to get out of, if he trusts the player enough to mention it; the player
  // can then offer what he would have offered had he been asked
  const his = (social(w).pursuits ?? []).find((p) => p.who === n.id && p.status === 'active' && p.kind === 'stopTrouble');
  const a = his ? w.chars[his.against ?? ''] : undefined;
  // the trouble on his mind is the player himself: that is what he says, to his face, and the matter between them is what is in hand
  if (his && a?.id === h.id) return yourTrouble(c, his.id);
  if (his && a && willTell && !myPromiseTo(c) && !(talks(w)[n.id]?.topics ?? []).some((x) => x.k === 'trouble:' + his.id)) {
    him(c, onSeekHelp(pn, a));
    const req = social(w).requests.find((x) => x.by === n.id && x.of === h.id && x.status === 'open') ?? request(w, { by: n.id, of: h.id, wants: 'intervene', about: 'trouble:' + a.id, for: n.id, against: a.id, biz: ownerBiz(w, n.id)?.id, fact: his.fact });
    remember(w, n.id, 'trouble:' + his.id, 'told');
    askedInPerson(w, n.id, a.id, req);
    c.v.topic = 'help:' + req.id;
    return openHelpChoices(c, req, false);
  }
  // something heavy on his mind comes before the street's news; something lighter, only if the street has none
  const mind = willTell ? onHisMind(c, 0.12) : undefined;
  if (mind && mind.weight >= 0.5) return heRaises(c, mind.key, mind.sig, true);
  // what is going round, as he is willing to pass it on (the old "Heard anything?": once a day, as open as he is with the player);
  // if he tells something, the questions about it are what the player can say next
  if (willTell) {
    const sn = streetNews(c);
    if (sn.next?.length) return afterAct(c, sn.next, 'news');
    if (sn.told) return general(c);
  }
  const told = new Set((talks(w)[n.id]?.topics ?? []).filter((x) => x.k.startsWith('news:')).map((x) => x.k.slice(5)));
  const district = ownerBiz(w, n.id)?.district ?? n.district;
  const f = willTell ? pn.knownFacts((x) => !x.minor && w.now - x.t < 14 * DAY && !told.has(x.id) && x.actor !== n.id && ['vandalism', 'robbery', 'beating', 'arrest', 'murder', 'protection_started', 'promotion', 'business_failed'].includes(x.kind) && (x.district === district || x.victim === n.id || !!(x.business && w.biz[x.business]?.district === district))).sort((a, b) => b.t - a.t)[0] : undefined;
  if (f) {
    const k = n.known[f.id], who = f.actor && k?.knowsActor ? w.chars[f.actor] : undefined, vic = f.victim ? w.chars[f.victim] : undefined;
    him(c, plain(n.id, 'news.' + f.kind, { whoFirst: who ? first(who.name) : '', victimFirst: vic ? first(vic.name) : '', shop: f.business ? w.biz[f.business]?.name ?? '' : '', when: agoWords(w.now, f.t) }));
    door.inform(w, n, h, f, 'news');
    remember(w, n.id, 'news:' + f.id, 'told');
  } else if (mind) return heRaises(c, mind.key, mind.sig, true);
  else {
    const b = ownerBiz(w, n.id);
    him(c, plain(n.id, !willTell ? 'news.notForYou' : b && b.distress > 0 ? 'news.slow' : n.cash < 80 ? 'news.money' : 'news.quiet'));
  }
  general(c);
}
// What the player said that a man takes as a slight: told he is not ready, put on thin ice, leaned on, told to straighten himself out,
// loyalty to a boss he resents thrown at him, called a liar or worse
const SLIGHT = /^(said:tk:want:doubt|said:tk:trouble:straighten|said:tk:boss:loyal|said:cr_thin|said:sh_lean|said:demand|said:challenge|accuse:)/;
// whether what he raised was a confidence: a grudge, his boss gone sour on him, what he wants (when he said it), a trouble he admitted
function confided(c: Ctx, key: string, sig: string): boolean {
  const ins = c.h.insight?.[c.n.id] ?? [];
  return (key === 'boss' && sig === 'sour') || (key.startsWith('op:') && sig.startsWith('h')) || (key === 'want' && ins.includes('want')) || (key === 'trouble' && !!c.n.problem?.revealed);
}
// He brings it up himself: the subject's first exchange (talk.ts, through the old engine), with its answers
// (asked what is new, he gets onto it: said so, since what he says next is his side of a subject the player did not name)
function heRaises(c: Ctx, key: string, sig = '', lead = false) { remember(c.w, c.n.id, 'mind:' + key, 'raised', sig); if (lead) narr(c, `He gets onto ${aboutWords(c, key)}.`); doAct(c, 'tk:' + key, ''); }
// An evening together: what they talk about is what each of them knows and has lived lately, and what is between them
function doSpend(c: Ctx): number {
  const { w, h, n } = c;
  c.v.mem.points.push('spend');
  if (acquainted(w, h, n)) remember(w, n.id, 'spend', 'evening');
  // a man the player had not met: the introduction is his to accept or not (acts/personal.ts intro)
  if (strangerHere(c)) { const r = doAct(c, 'intro', ''); return r.minutes; }
  if (!acquainted(w, h, n)) { door.introduce(w, h, n); him(c, plain(n.id, 'react.introduction.neutral', { youName: h.name })); general(c); return 10; }
  // (an evening costs the round: the old engine's drink and the layer's evening are one thing now)
  if (h.cash < 40) { narr(c, 'You can’t stand the round tonight. You have a quick one and leave it at that.'); general(c); return 20; }
  door.spend(w, h, 40, 'an evening');
  // what is between them, as he knows it, is what the evening turns on; otherwise his own life and the street, as he knows them
  const mine = myPromiseTo(c), a0 = mine ? w.chars[mine.matter?.against ?? ''] : undefined;
  const his = (social(w).pursuits ?? []).find((p) => p.who === n.id && p.status === 'active' && p.kind === 'stopTrouble');
  const trouble = his ? w.chars[his.against ?? ''] : undefined;
  const bv = mine ? belief(w, n, 'ob:' + mine.id).value : undefined;
  const mind = !mine && !trouble ? onHisMind(c, 0.1) : undefined;
  const between = mind ? aboutWords(c, mind.key) : mine && a0 ? (bv === 'kept' ? `how quiet it has been since ${first(a0.name)} stopped coming round` : bv === 'done' ? `${first(a0.name)}, and whether what you did will be enough` : `${first(a0.name)}, and what you were going to do about him`) : trouble ? `${first(trouble.name)}, and not much else` : undefined;
  // (the hour it is: a coffee in the morning and a drink in the afternoon are part of the visit; an evening is the rest of the day)
  const part = partOfDay(w.now);
  const venue = n.rank === 'civilian' ? (ownerBiz(w, n.id) ? (part === 'evening' ? 'his place after closing' : 'the counter of his place') : part === 'morning' ? `a diner in ${n.district}` : `a bar in ${n.district}`) : part === 'morning' ? 'the club, over the morning papers' : 'the club';
  const r0 = peek(n, h.id), before = (r0.affection ?? 0) + r0.trust + (r0.known ?? 0) * 0.3;
  door.spendTime(w, h, n, 'visit');
  const r1 = peek(n, h.id), moved = (r1.affection ?? 0) + r1.trust + (r1.known ?? 0) * 0.3 - before;
  const a = spendTimeAccount(c.ph(), c.pn(), n, venue, compat(w, h, n), String(Math.floor(w.now / DAY)), between, moved, part);
  narr(c, a.text);
  // over the evening he passes on what he has heard (he only tells what he knows, and only a man he trusts enough or likes company)
  const heard: string[] = [], toldF = door.passOn(w, n, h, heard);
  for (const l of heard) says(c, speechFor(w, h, n, l));
  // what the evening turned on, he comes back to before you part: what he said of it, and what you say to that
  if (mind && subjectsOf(w, h, n).some((x) => x.key === mind.key)) { heRaises(c, mind.key, mind.sig); if (c.v.choices.some((x) => x.group === 'reply')) return 120; }
  const mins = part === 'morning' ? 45 : part === 'afternoon' ? 75 : 120;
  if (toldF.length) { c.v.th.fact = toldF[0].id; c.v.th.asked = []; afterAct(c, ACTS.inc.questions?.(c) ?? [], 'spend'); return mins; }
  // (an evening is the end of the day; over a coffee or an afternoon drink the talk can go on)
  if (part === 'evening') c.v.ended = true; else general(c);
  return mins;
}
// the part of the day a visit falls in, for what can be done in it: a morning, an afternoon, an evening (night counts as evening)
export function partOfDay(t: number): 'morning' | 'afternoon' | 'evening' { const hr = Math.floor((t % DAY) / 60); return hr >= 5 && hr < 12 ? 'morning' : hr >= 12 && hr < 17 ? 'afternoon' : 'evening'; }
export const engineVersion = 1;
void r2;
