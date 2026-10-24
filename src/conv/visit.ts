// Gate 3: a visit, as the conversation engine sees it. Interface-independent: it takes a world, the player and the man he has gone to
// see, and gives back structured state (who the man is to him, what has been said, what he can say next) and carries out what the
// player chooses through the same decisions and doors as everything else. A screen (ui/talk2.ts) only draws this; another screen could
// draw it differently without touching anything here.
//
// The shape of a visit (spec §8, §17): the man opens with what is on his mind as he sees it (a request he has decided to make of you,
// a promise of yours he is waiting on, something he believes you did, news of something he did for you), or a greeting that fits what
// you are to each other. Then two to four things worth saying now, "Something else…" for anything else plausible, and leaving. What he
// says next answers what you said; follow-ups answer his reply, not a menu. Nothing technical is shown: commitments are in the words.
import { ownerBiz, peek } from '../core';
import { crewGround } from '../econ';
import { openAsk } from '../asks';
import { whereIs } from '../where';
import { DAY, type Character, type Fact, type Id, type World } from '../types';
import { newSession, perceive, type Perception, type Session } from './perception';
import { render } from './render';
import { EncounterMemory } from './encounter';
import { onAnnouncement, onAnswersTo, onIntervention, onLoanRequest, onPromise, onPromiseSeenBroken, onProtectionDemand, onReport, onReturnToPromisee, onSeekHelp, onUnknownTopic, onWhoQuestion, predictAcceptance, spendTimeAccount, type Reply } from './respond';
import { HOSTILE, injured, offender, withdraw, type ObType, type Obligation } from './obligations';
import { note, social, type Request } from './social';
import { agreement, captaincyOf, promise, request } from './tick';
import { captainOf, chairFor, may } from './authority';
import { belief, judge, say } from './minds';
import { compat } from '../core';
import * as door from './doors';
import { answered, groupOf, introduced, leadCodes, options as oldOptions, say as oldSay, startConvo, type Convo, type DOpt } from '../dialogue';
import type { Meeting } from '../meetings';

// ---------------------------------------------------------------- what the engine hands a screen
export interface Say { who: 'him' | 'you' | 'narr' | 'card'; text: string; trace?: string[] }
// label: what the button says (a line, or for an approach its name); says: what the player then says, when that is not the label
export interface Choice { id: string; label: string; says?: string; note?: string; group: 'reply' | 'matter' | 'social' | 'intent' | 'more' | 'leave'; amount?: DOpt['amount']; pane?: Pane }
export interface Visit {
  npc: Id; where: string; t0: number;
  lines: Say[];            // this visit so far
  choices: Choice[];       // what he can say now
  relation: string;        // who the man is to him, in a word or two (for the header)
  topic?: string;          // what is being talked about, if anything in particular
  ended?: boolean;
  more?: boolean;          // the full list is open ("Something else…")
  mem: { said: string[]; argued: string[]; pressed: number; points: string[]; offered: Record<string, number | boolean | string> };
  approach?: Id;           // the request he came to you with, when he came to you
  pane?: Pane;             // the heading the talk is under (Business, Personal, Confront), when it is under one
  old?: Convo;             // the rest of what is between you (work, jobs, envelopes, debts, the shop, standing) is still the V90 engine's
}
// What has passed between the player and a man across visits, as it bears on what is said next (kept small: World.social.talks)
export interface TalkMemory { visits: number; last: number; topics: { k: string; t: number; out: string; sig?: string }[]; heard: string[] }

const first = (n: string) => n.split(' ')[0];
const r2 = (x: number) => Math.round(x * 100) / 100;
const talks = (w: World) => (social(w).talks ??= {});
function memOf(w: World, id: Id): TalkMemory { return (talks(w)[id] ??= { visits: 0, last: -1e9, topics: [], heard: [] }); }
function remember(w: World, id: Id, k: string, out: string, sig?: string) { const m = memOf(w, id); m.topics.push({ k, t: w.now, out, sig }); if (m.topics.length > 14) m.topics.splice(0, m.topics.length - 14); }
const lastOf = (w: World, id: Id, k: string) => [...memOf(w, id).topics].reverse().find((x) => x.k === k);
const agoWords = (now: number, t: number) => { const d = Math.floor(now / DAY) - Math.floor(t / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : d < 14 ? 'last week' : `${Math.round(d / 7)} weeks ago`; };

// ---------------------------------------------------------------- context
interface Ctx { w: World; h: Character; n: Character; v: Visit; s: Session; pn: () => Perception; ph: () => Perception }
function ctx(w: World, v: Visit): Ctx {
  const h = w.chars[w.playerId!], n = w.chars[v.npc], s = newSession();
  // what he knows of who the player is: if they have met, the player's family is known to him
  if (acquainted(w, h, n) && h.familyId) s.told[n.id] = { [h.id]: { family: w.fam[h.familyId].name, name: h.name, basis: { kind: 'seen', ref: 'they have met' } } };
  return { w, h, n, v, s, pn: () => perceive(w, s, n), ph: () => perceive(w, s, h) };
}
// whether they know each other: a fact of the world, not a choice of greeting (spec §17; the Scenario G Marty Bellini fault)
export function acquainted(w: World, h: Character, n: Character): boolean {
  if (h.intro?.[n.id] != null || (talks(w)[n.id]?.visits ?? 0) > 0) return true;
  if (n.id === h.bossId || n.bossId === h.id || (h.bossId && n.bossId === h.bossId)) return true;
  return (peek(n, h.id).known ?? 0) >= 0.15;
}
// what he is to the player, as a fact (the header says it; the greeting is chosen from it, its wording only varies in style)
export function relationOf(w: World, h: Character, n: Character): { level: 'stranger' | 'acquaintance' | 'friend' | 'cold' | 'hostile'; words: string } {
  if (!acquainted(w, h, n)) return { level: 'stranger', words: 'You haven’t met.' };
  const r = peek(n, h.id);
  if (r.grudge >= 0.3) return { level: 'hostile', words: 'He has no love for you.' };
  if ((r.known ?? 0) > 0.25 && r.trust < 0.06) return { level: 'cold', words: 'He doesn’t trust you.' };
  if (r.affection >= 0.35 || r.trust >= 0.5) return { level: 'friend', words: 'He likes you.' };
  const m = talks(w)[n.id];
  return { level: 'acquaintance', words: m?.visits ? `You’ve been to see him ${m.visits === 1 ? 'once before' : m.visits < 5 ? 'a few times' : 'often'}.` : 'You know each other.' };
}

// ---------------------------------------------------------------- lines
function him(c: Ctx, r: Reply, salt = '') {
  const spoken = new Set([...c.v.mem.said, ...memOf(c.w, c.n.id).heard]);
  const text = render({ ...r.meaning, slots: { selfFirst: first(c.h.name), ...(r.meaning.slots ?? {}) } }, c.n.id, c.pn().arch, spoken, salt + c.v.lines.length);
  c.v.mem.said.push(text);
  const m = memOf(c.w, c.n.id); m.heard.push(text); if (m.heard.length > 12) m.heard.shift();
  const d = r.decision, trace = [...(d.constraints.length ? [`constraints: ${d.constraints.map((x) => x.kind + ' (' + x.source + ')').join('; ')}`] : []), ...[...d.candidates].sort((a, b) => b.value - a.value).filter((x) => x.value > -9).map((x) => `${x.move === d.chosen ? '▶' : ' '} ${x.move} ${x.value}: ${x.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`), `meaning ${r.meaning.key}${r.meaning.grounds ? '.' + r.meaning.grounds : ''}${r.meaning.role ? ' (' + r.meaning.role + ')' : ''}; ${r.honest ? 'honest' : 'NOT honest'}${r.aim ? '; aim: ' + r.aim : ''}`, ...(r.changes ?? [])];
  c.v.lines.push({ who: 'him', text, trace });
}
const plain = (by: Id, key: string, slots: Record<string, string> = {}, stance: Reply['meaning']['stance'] = 'flat'): Reply => ({ decision: { by, constraints: [], candidates: [], chosen: key }, meaning: { key, stance, toward: 'speaker', slots }, intent: key, honest: true });
function you(c: Ctx, label: string) { c.v.lines.push({ who: 'you', text: label }); }
function narr(c: Ctx, text: string) { c.v.lines.push({ who: 'narr', text }); }
function card(c: Ctx, key: string, slots: Record<string, string> = {}) { c.v.lines.push({ who: 'card', text: render({ key, stance: 'flat', toward: 'speaker', slots: { first: first(c.n.name), ...slots } }, 'card', 'earnest') }); }
const line = (c: Ctx, key: string, slots: Record<string, string> = {}) => render({ key, stance: 'flat', toward: 'speaker', slots: { selfName: c.h.name, selfFirst: first(c.h.name), selfFamily: c.h.familyId ? c.w.fam[c.h.familyId].name : '', ...slots } }, c.h.id, 'earnest');

// ---------------------------------------------------------------- the matters between them, as each side knows them
const MY_CAPTAIN = (c: Ctx) => captainOf(c.w, c.h);
// a promise of the player's to this man, still open
const myPromiseTo = (c: Ctx) => social(c.w).obs.filter((o) => o.obligor === c.h.id && o.beneficiary === c.n.id && (o.status === 'pending' || c.w.now - (o.settled ?? c.w.now) < 10 * DAY)).at(-1);
// something the player promised someone that needs this man: raise it with him
const owedHere = (c: Ctx) => social(c.w).obs.filter((o) => o.obligor === c.h.id && o.status === 'pending' && ((o.spec.kind === 'actionDone' && o.spec.target === c.n.id) || ((o.type === 'effort' || o.type === 'result') && MY_CAPTAIN(c)?.id === c.n.id)) && !social(c.w).log.some((a) => a.actor === c.h.id && a.act === 'raise' && a.target === c.n.id && a.t >= o.from && social(c.w).requests.some((r) => r.by === c.h.id && r.of === c.n.id && r.status === 'agreed' && r.parent === o.id)));
// what he came to say, if he came looking for the player
const openFrom = (c: Ctx) => social(c.w).requests.filter((r) => r.by === c.n.id && r.of === c.h.id && r.status === 'open').sort((a, b) => b.t - a.t);
// his own promise to the player that has an outcome he has not yet told him
const newsOfMine = (c: Ctx) => social(c.w).obs.find((o) => o.obligor === c.n.id && o.beneficiary === c.h.id && !(talks(c.w)[c.n.id]?.topics ?? []).some((x) => x.k === 'told:' + o.id) && (o.status !== 'pending' || social(c.w).requests.some((r) => r.parent === o.id && r.status !== 'open')));
const henryKnowsTroubleBy = (c: Ctx, man: Id) => Object.values(c.w.facts).filter((f) => c.h.known[f.id] && HOSTILE.has(f.kind) && (offender(f) === man || c.w.chars[offender(f) ?? '']?.bossId === man)).sort((a, b) => b.t - a.t)[0];

// ---------------------------------------------------------------- beginning a visit
export function begin(w: World, npcId: Id, o: { approach?: Id } = {}): Visit {
  const h = w.chars[w.playerId!], n = w.chars[npcId];
  const wh = whereIs(w, h, n);
  const v: Visit = { npc: npcId, where: wh.name, t0: w.now, lines: [], choices: [], relation: '', mem: { said: [], argued: [], pressed: 0, points: [], offered: {} }, approach: o.approach };
  const c = ctx(w, v);
  const rel0 = relationOf(w, h, n);
  v.relation = rel0.words;
  if (o.approach) narr(c, `${n.name} has come to find you.`);
  open(c, rel0.level);
  const m = memOf(w, n.id); m.visits++; m.last = w.now;
  door.introduce(w, h, n);
  return v;
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
    : last && w.now - last.t < 14 * DAY && last.k.startsWith('intervene:') && last.out === 'refused' ? 'greet.since.refused' : undefined;
  const key = since ? since : again ? 'greet.again' : level === 'stranger' ? (atShop ? 'greet.customer' : 'greet.stranger') : level === 'hostile' ? 'greet.hostile' : level === 'cold' ? 'greet.cold' : level === 'friend' ? 'greet.friend' : atShop ? 'greet.known' : 'greet.acquaintance';
  him(c, plain(n.id, key, {}, level === 'hostile' || level === 'cold' ? 'cold' : 'polite'), String(mm.visits));
  general(c);
  raiseHis(c);
  void pn;
}

// ---------------------------------------------------------------- he came for help
function openHelp(c: Ctx, r: Request) {
  const a = c.w.chars[r.against ?? ''];
  if (!a) return general(c);
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
  him(c, onPromise(c.pn(), h, type, a));
  door.regard(w, n, h.id, 'trust', { action: 0.03, effort: 0.02, result: 0.05, restraint: 0.03 }[type], `${h.name} promised to help`);
  const g = agreement(w, [n.id, h.id], `${h.name} to ${n.name}: ${type === 'result' ? `${a.name} leaves him alone` : type === 'action' ? `he will raise it with ${cap?.name}` : `he will try to get ${a.name} to stop`}`, [n.id], r.id);
  const biz = r.biz ?? ownerBiz(w, n.id)?.id;
  promise(w, {
    type, obligor: h.id, beneficiary: n.id, promisee: n.id, from: w.now, by: w.now + (type === 'result' ? 30 : 10) * DAY, matter: { for: n.id, against: a.id, biz, fact: r.fact }, notify: [n.id], words: 'promise.' + type,
    spec: type === 'action' && cap ? { kind: 'actionDone', act: 'raise', target: cap.id, about: r.about } : type === 'result' ? { kind: 'noHostility', actor: a.id, target: n.id, biz, days: 30 } : { kind: 'effort', acts: ['raise'], about: r.about, floor: 0.15 },
  }, g);
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
  if (since && ob.type === 'result') him(c, onPromiseSeenBroken(c.pn(), h));
  else him(c, onReturnToPromisee(c.pn(), h, !since && w.now - ob.from > 7 * DAY, Math.floor((w.now - ob.from) / DAY), a));
  if (req) { req.status = 'done'; note(req, w.now, 'he asked'); }
  const did = social(w).log.some((x) => x.actor === h.id && x.act === 'raise' && x.about === (ob.spec as { about?: string }).about && x.t >= ob.from);
  const cap = MY_CAPTAIN(c);
  // he has seen the trouble stop and asks whether it was the player's doing: the replies answer that question
  if (!since && w.now - ob.from > 7 * DAY && !did) {
    c.v.choices = [{ id: `credit:no:${ob.id}`, label: line(c, 'credit.notMe'), group: 'reply' }, { id: `credit:lie:${ob.id}`, label: line(c, 'credit.claim'), note: 'It isn’t true.', group: 'reply' }, { id: 'more', label: 'Something else…', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
    return;
  }
  c.v.choices = (did
    ? [{ id: `report:done:${ob.id}`, label: line(c, 'report.raised', { captainFirst: cap ? first(cap.name) : 'the family' }), group: 'reply' }]
    : [{ id: `report:notyet:${ob.id}`, label: line(c, 'report.notYet'), group: 'reply' }, { id: `report:lie:${ob.id}`, label: line(c, 'report.raised', { captainFirst: cap ? first(cap.name) : 'the family' }), note: 'It isn’t true.', group: 'reply' }, { id: `report:cannot:${ob.id}`, label: line(c, 'report.cannot'), group: 'reply' }]) as Choice[];
  c.v.choices.push({ id: 'more', label: 'Something else…', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' });
}
function doReport(c: Ctx, kind: 'done' | 'notyet' | 'lie' | 'cannot', obId: Id) {
  const { w, h, n } = c, ob = social(w).obs.find((o) => o.id === obId);
  if (!ob) return general(c);
  if (kind === 'done' || kind === 'lie') say(w, h, n, 'ob:' + ob.id, 'done', 'own', kind === 'done', 'I took it to the family');
  else if (kind === 'notyet') say(w, h, n, 'ob:' + ob.id, w.now > ob.by ? 'notDone' : 'notYet', 'own', true, 'Not yet');
  else { withdraw(w, ob, `${h.name} told ${n.name} he couldn't do it`); say(w, h, n, 'ob:' + ob.id, 'withdrawn', 'own', true, 'I couldn’t get anywhere'); }
  judge(w, n, ob);
  him(c, kind === 'notyet' ? plain(n.id, 'react.report.notYet', {}, 'flat') : kind === 'cannot' ? onReport(c.pn(), h, 'admitNotDone') : onReport(c.pn(), h, 'done'));
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
  c.v.choices = [{ id: `confront:sorry:${ob.id}`, label: line(c, lied ? 'confront.sorry' : 'apologise.broken'), group: 'reply' }, ...(lied ? [{ id: `confront:insist:${ob.id}`, label: line(c, 'confront.insist', { captainFirst: cap ? first(cap.name) : 'him' }), note: 'It isn’t true.', group: 'reply' as const }] : []), { id: 'leave', label: 'Leave', group: 'leave' }];
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
export type Pane = 'business' | 'personal' | 'confront';
export const PANES: Pane[] = ['business', 'personal', 'confront'];
const PANE_WORD: Record<Pane, string> = { business: 'Business', personal: 'Personal', confront: 'Confront' };
const PANE_MORE: Record<Pane, string> = { business: 'Other business…', personal: 'Something else personal…', confront: 'Something else to have out…' };
// where one of the old engine's subjects belongs, by its code
const CONFRONT = /^(confront:|f:amends|demand|challenge|a_defy|d_remind|cr_thin|cr_drop|cr_look|sh_lean|sh_why|rv_warn|refuse)/;
const PERSONAL = /^(inc:|word_make|f:sit|tk:(?!shop|racket|earn|debt:|job:)|how|old_times|congrats|welcome|help_gift|help_loan|a_gift|cr_money|cr_ask|a_ask|ask_|pick_member|leaders|about|rv_ears|rv_mood|f:think|pick_incident|suspect|sit_ask|b_stand)/;
export const paneOf = (code: string): Pane => (CONFRONT.test(code) ? 'confront' : PERSONAL.test(code) ? 'personal' : 'business');
const oldIn = (c: Ctx, k: Pane, xs: Choice[]) => xs.filter((x) => (x.pane ?? paneOf(x.id.slice(2))) === k);

// What can be raised under a heading: everything plausible (all), or what is worth raising now
function subjects(c: Ctx, k: Pane, all = false): Choice[] {
  const { w, h, n } = c, out: Choice[] = [];
  const pending = oldIn(c, k, oldRows(c, 'pending'));
  if (k === 'business') {
    for (const ob of owedHere(c)) {
      const prev = lastOf(w, n.id, mkey(ob)), same = prev?.out === 'refused' && prev.sig === interveneSig(c, ob);
      if (same && !all) continue; // refused, and nothing has changed: not offered as if it were new (it stays under "Other business…")
      out.push({ ...interveneChoice(c, ob, prev?.out === 'refused'), note: prev?.out === 'refused' ? `He said no ${agoWords(w.now, prev.t)}. ${same ? 'Nothing has changed since.' : 'Things have moved since.'}` : undefined });
    }
    // what the player has heard that the man he promised would want to know: how it went with the man he took it to
    const mine = myPromiseTo(c);
    if (mine && !lastOf(w, n.id, 'passed:' + mine.id)) {
      const heard = [...(social(w).said ?? [])].reverse().find((x) => x.to === h.id && x.subject === 'credit:' + mine.id);
      const via = social(w).obs.find((o) => o.parent === mine.id && o.beneficiary === h.id);
      const refused = via && social(w).requests.some((r) => r.parent === via.id && r.status === 'refused');
      if (heard || refused) { const a = w.chars[mine.matter?.against ?? ''], cap = MY_CAPTAIN(c); out.push({ id: 'pass:' + mine.id + ':' + (refused ? 'refused' : 'done'), label: line(c, refused ? 'pass.refused' : 'pass.done', { captainFirst: cap ? first(cap.name) : 'the family', againstFirst: a ? first(a.name) : '' }), group: 'matter' }); }
    }
    out.push(...pending);
    // what a man in your position would naturally put to him: work from your boss, orders to your own man
    out.push(...oldRows(c, 'lead'));
    if (shopOf(c) && protectAvailable(c)) { const prev = lastOf(w, n.id, 'protect'); out.push({ id: 'protect', label: line(c, 'demand.protection', { amt: `$${feeOf(c)}` }), note: !prev ? undefined : prev.out === 'counter' ? `He offered less ${agoWords(w.now, prev.t)}.` : prev.out === 'agreed' ? undefined : `He turned you down ${agoWords(w.now, prev.t)}.`, group: 'matter' }); }
    if (all) {
      const ways = oldGroups(c, ['business', 'org', 'settle']).filter((x) => paneOf(x.id.slice(2)) === 'business');
      if ((n.rank !== 'civilian' || n.cash >= 600) && !ways.some((x) => x.id.startsWith('o:borrow'))) out.push({ id: 'loan:500', label: line(c, 'ask.loan', { amt: '$500' }), group: 'matter' });
      // who a man answers to: the men troubling people the player has promised to help
      for (const id of new Set(social(w).obs.filter((o) => o.obligor === h.id && o.status === 'pending' && o.matter?.against).map((o) => o.matter!.against!))) { const m = w.chars[id]; if (m && m.id !== n.id) out.push({ id: 'answers:' + m.id, label: line(c, 'ask.answersTo', { manFirst: first(m.name) }), group: 'matter' }); }
      out.push(...ways);
    }
  }
  if (k === 'personal') {
    // (what is on his mind first, then the two things men always say, then what the player knows that bears on him)
    out.push(...pending.slice(0, 2));
    if (!c.v.mem.points.includes('news')) out.push({ id: 'news', label: line(c, 'ask.news'), group: 'social' });
    if (!c.v.mem.points.includes('spend')) out.push({ id: 'spend', label: line(c, acquainted(w, h, n) ? 'spend.time' : 'introduce.self'), group: 'social' });
    out.push(...pending.slice(2));
    // something the player knows that bears on this man: trouble on his street, or by his people
    for (const f of Object.values(w.facts).filter((f) => h.known[f.id] && !n.known[f.id] && !f.minor && HOSTILE.has(f.kind) && f.business && w.now - f.t < 21 * DAY && (f.district === (ownerBiz(w, n.id)?.district ?? n.district) || offender(f) === n.id || w.chars[offender(f) ?? '']?.bossId === n.id || crewGround(w, n).has(f.district))).sort((a, b) => b.t - a.t).slice(0, 1)) out.push({ id: 'tell:' + f.id, label: line(c, 'tell.news', { topic: w.biz[f.business!].name }), group: 'matter' });
    // who did something the player knows of but not who did it, where this man might know
    for (const f of Object.values(w.facts).filter((f) => h.known[f.id] && !h.known[f.id].knowsActor && HOSTILE.has(f.kind) && f.business && (f.district === n.district || ownerBiz(w, n.id)?.district === f.district)).sort((a, b) => b.t - a.t).slice(0, 1)) out.push({ id: 'who:' + f.id, label: line(c, 'ask.who', { shop: w.biz[f.business!].name }), group: 'matter' });
    if (all) out.push(...oldGroups(c, ['social', 'ask']).filter((x) => paneOf(x.id.slice(2)) === 'personal'));
  }
  if (k === 'confront') out.push(...pending, ...oldGroups(c, ['settle']).filter((x) => paneOf(x.id.slice(2)) === 'confront'));
  return out.filter((x, i) => out.findIndex((y) => y.id === x.id) === i);
}
// One heading open: its subjects (at most four), the rest behind "Other…", the way back to the headings, and leaving
function pane(c: Ctx, k: Pane, all = false) {
  const rows = subjects(c, k, all), shown = all ? rows : rows.slice(0, 4);
  const rest = all ? 0 : subjects(c, k, true).filter((x) => !shown.some((y) => y.id === x.id)).length;
  c.v.pane = k; c.v.more = all; c.v.topic = undefined;
  if (!rows.length) return home(c);
  c.v.choices = [...shown, ...(rest ? [{ id: 'all:' + k, label: PANE_MORE[k], group: 'more' as const }] : []), { id: 'home', label: 'Something else', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}
// The headings: what he brings up himself first (answered directly, no heading), then Business, Personal, Confront, and leaving
function home(c: Ctx) {
  c.v.pane = undefined; c.v.more = false; c.v.topic = undefined;
  const his = oldRows(c, 'pending').filter((x) => x.group === 'reply').slice(0, 2);
  const heads: Choice[] = PANES.filter((k) => subjects(c, k).length || subjects(c, k, true).length).map((k) => ({ id: 'u:' + k, label: PANE_WORD[k], group: 'intent' }));
  c.v.choices = [...his, ...heads, { id: 'leave', label: 'Leave', group: 'leave' }];
}
// After a subject has run its course the talk stays where it was: under the heading it was raised from, or at the headings
function general(c: Ctx) { if (c.v.pane) pane(c, c.v.pane); else home(c); }
// Everything plausible, under all three headings (spec §8.2: filtered only for plausibility, never for relevance)
export function everything(w: World, v: Visit): Choice[] {
  const c = ctx(w, v), out: Choice[] = [];
  for (const k of PANES) out.push(...subjects(c, k, true));
  out.push({ id: 'news', label: line(c, 'ask.news'), group: 'social' }, { id: 'spend', label: line(c, 'spend.time'), group: 'social' });
  out.push({ id: 'home', label: 'Never mind', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' });
  return out.filter((x, i) => out.findIndex((y) => y.id === x.id) === i);
}
// ---------------------------------------------------------------- the rest of the game's business (V90 engine, until the cut-over)
// The conversation layer decides promises, requests, disputes and what is new; everything else a man can take up with another (work,
// jobs, envelopes, debts, shops, rackets, standing, the crew, proposals) is still decided by dialogue.ts. The visit offers it in the
// same few choices: what is pending between you on the screen, the five ways into the rest under "Something else…". Choosing one
// runs dialogue.say, so its consequences are the old engine's own, unchanged.
const LAYERED = new Set(['chat', 'drink']); // (what is new, and an evening out, are the conversation layer's own)
// (protection put to a shop is the layer's own where it may be put; otherwise, as before, the old engine's)
// (and the trouble a man is under, once he has brought it to the player, is the matter between them: not asked about again as news)
const layered = (c: Ctx, code: string) => LAYERED.has(code.split(':')[0]) || (code === 'suggest' && protectAvailable(c)) || (code.startsWith('tk:pressed:') && (!!myPromiseTo(c) || social(c.w).requests.some((r) => r.by === c.n.id && r.of === c.h.id && r.wants === 'intervene')));
const oldConvo = (c: Ctx): Convo | undefined => (introduced(c.w, c.h, c.n) ? (c.v.old ??= startConvo(c.n.id)) : undefined);
function oldChoice(o: DOpt, group: Choice['group']): Choice { return { id: 'o:' + o.code, label: o.label, note: o.hint && (o.big || o.amount) ? o.hint : undefined, group, ...(o.amount ? { amount: o.amount } : {}) }; }
// The old engine keeps some matters behind a door of their own (his debt, his shop, your crew man, the bad blood, what is outstanding):
// opened here, so each thing under it is a subject in its own right and finds its heading (a light envelope is had out, not "business")
const DOOR = /^f:(debt|shop|crew|amends|memos|disputes|sit|more)$/;
const NAV = (o: DOpt) => o.code === 'root' || o.code === 'f:' || o.code.startsWith('f:g:') || o.done;
function opened(c: Ctx, cv: Convo, opts: DOpt[], depth = 0): DOpt[] {
  return opts.flatMap((o) => {
    if (!DOOR.test(o.code) || depth > 1) return [o];
    const inner = oldOptions(c.w, c.h, c.n, { ...cv, node: 'root', ctx: { ...cv.ctx, focus: o.code.slice(2), follow: undefined } }).filter((x) => !NAV(x));
    return inner.length ? opened(c, cv, inner, depth + 1).map((x) => ({ ...x, group: o.group })) : [];
  });
}
function oldRows(c: Ctx, which: 'pending' | 'ways' | 'lead'): Choice[] {
  const cv = oldConvo(c);
  if (!cv) return [];
  if (which === 'lead') return leadCodes(c.w, c.h, c.n).filter((k) => !layered(c, k)).flatMap((k) => {
    const o = oldOptions(c.w, c.h, c.n, { ...cv, node: 'root', ctx: { ...cv.ctx, focus: 'g:' + groupOf(k), follow: undefined } }).find((x) => x.code === k && !x.done);
    return o ? [oldChoice(o, 'matter')] : [];
  });
  const opts = oldOptions(c.w, c.h, c.n, { ...cv, node: 'root', ctx: { ...cv.ctx, focus: undefined, follow: undefined } }).filter((o) => !o.done && !layered(c, o.code));
  if (which === 'ways') return opts.filter((o) => o.code.startsWith('f:g:') && o.code !== 'f:g:social').map((o) => oldChoice(o, 'matter'));
  // (what is on his mind is a personal matter, whatever it is about)
  return opened(c, cv, opts.filter((o) => o.group === 'He brings it up' || o.group === 'Between you' || o.group === 'On his mind')).filter((o) => !layered(c, o.code)).map((o) => ({ ...oldChoice(o, o.group === 'He brings it up' ? 'reply' : 'matter'), ...(o.group === 'On his mind' ? { pane: 'personal' as const } : {}) }));
}
// the leaves of the old engine's five ways in (its business, social, ask, org and settle groups), each as a subject of its own
function oldGroups(c: Ctx, gs: string[]): Choice[] {
  const cv = oldConvo(c);
  if (!cv) return [];
  return gs.flatMap((g) => opened(c, cv, oldOptions(c.w, c.h, c.n, { ...cv, node: 'root', ctx: { ...cv.ctx, focus: 'g:' + g, follow: undefined } }).filter((o) => !NAV(o))).filter((o) => !layered(c, o.code)).map((o) => oldChoice(o, 'matter')));
}
// within one of the old engine's subjects: its answers, and back to the visit
function oldSubject(c: Ctx, all = false) {
  const cv = c.v.old!;
  const opts = oldOptions(c.w, c.h, c.n, cv).filter((o) => !o.done && !layered(c, o.code));
  const rows = opts.filter((o) => o.code !== 'root' && o.code !== 'f:').map((o) => oldChoice(o, 'reply'));
  if (!rows.length) return general(c);
  // (the four likeliest answers; the rest of what can be said to it, a figure or a threat, one step further)
  const shown = all ? rows : rows.slice(0, 4);
  c.v.choices = [...shown, ...(rows.length > shown.length ? [{ id: 'ways', label: 'Other ways to put it…', group: 'more' as const }] : []), { id: 'back', label: 'Talk about something else', group: 'more' }, { id: 'leave', label: 'Leave', group: 'leave' }];
  c.v.more = all;
}
// What he has come to ask of the player (the old engine's requests and offered work): he raises it himself, and the screen is his
// question with its answers, not a heading to find it under
function raiseHis(c: Ctx) {
  const his = oldRows(c, 'pending').find((x) => x.group === 'reply' && /^o:f:(enc|job):/.test(x.id));
  if (his) doOld(c, his.id.slice(2), '');
}
function doOld(c: Ctx, code: string, label: string): { minutes: number; meeting?: Meeting } {
  const cv = oldConvo(c);
  if (!cv) { general(c); return { minutes: 0 }; }
  const res = oldSay(c.w, c.h, c.n, cv, code);
  // (what he says is his; what happens is told; a card is a card. The old engine writes lines as text, so they are sorted by shape)
  const fn = first(c.n.name);
  if (label && res.q && res.q !== label) c.v.lines[c.v.lines.length - 1] = { who: 'you', text: res.q };
  for (const l0 of res.lines) {
    const l = l0.replace(/"([^"]*)"/g, '“$1”'); // (the old engine writes plain quotes)
    if (l.startsWith('⟡')) c.v.lines.push({ who: 'card', text: l.replace(/^⟡\s*/, '') });
    else c.v.lines.push({ who: /^[“"]/.test(l) || (answered(l, fn) && !/^You\b/.test(l)) ? 'him' : 'narr', text: l });
  }
  if (typeof res.meeting === 'string') narr(c, res.meeting);
  if (!res.convo) { c.v.old = startConvo(c.n.id); c.v.ended = true; c.v.choices = []; return { minutes: res.minutes, meeting: typeof res.meeting === 'object' ? res.meeting : undefined }; }
  c.v.old = res.convo;
  if (typeof res.meeting === 'object') { c.v.ended = true; c.v.choices = []; return { minutes: res.minutes, meeting: res.meeting }; }
  if (res.convo.node !== 'root' || res.convo.ctx.focus || res.convo.ctx.follow?.length) oldSubject(c); else general(c);
  return { minutes: res.minutes };
}
const shopOf = (c: Ctx) => { const b = ownerBiz(c.w, c.n.id); return b?.open && c.n.rank === 'civilian' ? b : undefined; };
const feeOf = (c: Ctx) => { const b = shopOf(c)!; return Math.max(15, Math.round((b.income * 0.08) / 5) * 5); };
const protectAvailable = (c: Ctx) => { const b = shopOf(c); return !!b && b.protection?.collectorId !== c.h.id && may(c.w, c.h, 'protect', c.n); };
function interveneChoice(c: Ctx, ob: Obligation, again: boolean): Choice {
  const forC = c.w.chars[ob.matter?.for ?? ''], a = c.w.chars[ob.matter?.against ?? ''];
  return { id: 'intervene:' + ob.id, label: again ? line(c, 'raise.again', { forFirst: forC ? first(forC.name) : '', againstFirst: a ? first(a.name) : '' }) : line(c, 'ask.intervention', { forName: forC?.name ?? '', againstName: a?.name ?? '' }), group: 'matter' };
}
// what bears on whether the captain might answer differently now: what the player knows of the man's doings, and what the captain does
const mkey = (ob: Obligation) => 'intervene:' + (ob.matter?.for ?? '') + ':' + (ob.matter?.against ?? ob.id);
const interveneSig = (c: Ctx, ob: Obligation) => { const a = ob.matter?.against ?? '', k = captaincyOf(c.w, c.n, c.w.chars[ob.matter?.for ?? ''] ?? c.n, c.w.chars[a] ?? c.n); return `${Object.values(c.w.facts).filter((f) => c.h.known[f.id] && HOSTILE.has(f.kind) && offender(f) === a).length}:${k.knowsTrouble ? 1 : 0}`; };

// ---------------------------------------------------------------- choosing
export function choose(w: World, v: Visit, id: string): { v: Visit; minutes: number; meeting?: Meeting } {
  const c = ctx(w, v), [kind, a1, a2] = id.split(':');
  // moving between the headings is not said aloud and takes no time
  if (kind === 'u' || kind === 'all') { if (PANES.includes(a1 as Pane)) pane(c, a1 as Pane, kind === 'all'); return { v, minutes: 0 }; }
  if (id === 'home' || id === 'more') { home(c); return { v, minutes: 0 }; }
  if (id === 'ways') { if (v.old) oldSubject(c, true); return { v, minutes: 0 }; }
  if (id === 'back') { if (v.old) v.old = { ...v.old, node: 'root', ctx: { ...v.old.ctx, focus: undefined, follow: undefined } }; general(c); return { v, minutes: 0 }; }
  // (a figure the player names goes after the choice it belongs to: o:<code>:<amount>[:<rate>])
  const base = [...v.choices, ...everything(w, v)].find((x) => x.id === id || (!!x.amount && id.startsWith(x.id + ':') && /^:\d+(:[\d.]+)?$/.test(id.slice(x.id.length))));
  const label = base?.label;
  if (label && kind === 'o') { you(c, label); const r = doOld(c, id.slice(2), label); return { v, ...r }; }
  // (an approach is chosen by name and said in words: what the player says is the line it stands for)
  const spoken = base?.says ?? label;
  if (id === 'leave') { v.ended = true; if (v.approach) { const r = social(w).requests.find((x) => x.id === v.approach); if (r && r.status === 'open') { r.status = 'lapsed'; note(r, w.now, 'he heard nothing from him'); } } return { v, minutes: 0 }; }
  if (!label) return { v, minutes: 0 }; // (not on offer: refused, never invented)
  you(c, spoken!);
  let minutes = 10;
  switch (kind) {
    case 'promise': doPromise(c, a1 as ObType, a2); break;
    case 'help': if (a1 === 'details') helpDetails(c, a2); else helpRefuse(c, a2); break;
    case 'report': doReport(c, a1 as 'done', a2); break;
    case 'confront': doConfront(c, a1 as 'sorry', a2); break;
    case 'intervene': doIntervene(c, a1, []); break;
    case 'argue': doIntervene(c, a2, [...new Set([...v.mem.argued, a1])] as never, a1); break;
    case 'letgo': { if (a1 === 'protect') { him(c, plain(c.n.id, 'react.letgo')); general(c); break; } const ob = social(w).obs.find((o) => o.id === a1)!; him(c, plain(c.n.id, 'react.letgo')); remember(w, c.n.id, mkey(ob), 'refused', interveneSig(c, ob)); general(c); break; }
    case 'protect': doProtect(c, a1 as 'plain'); break;
    case 'loan': doLoan(c, Number(a1) || 500, a2); break;
    case 'who': doWho(c, a1); break;
    case 'answers': doAnswers(c, a1); break;
    case 'tell': doTell(c, a1); break;
    case 'news': doNews(c); break;
    case 'thank': him(c, plain(c.n.id, 'react.thanks')); general(c); break;
    case 'pass': doPass(c, a1, a2 as 'done' | 'refused'); break;
    case 'credit': {
      const ob = social(w).obs.find((o) => o.id === a2);
      if (ob) { say(w, c.h, c.n, 'credit:' + ob.id, a1 === 'lie' ? 'self' : 'none', 'own', a1 !== 'lie'); if (a1 === 'lie') say(w, c.h, c.n, 'ob:' + ob.id, 'done', 'own', false); judge(w, c.n, ob); }
      him(c, plain(c.n.id, a1 === 'lie' ? 'react.credit.claimed' : 'react.credit.notMe', {}, a1 === 'lie' ? 'warm' : 'flat'));
      remember(w, c.n.id, 'credit:' + a2, a1); c.v.topic = undefined; general(c); break;
    }
    case 'spend': minutes = doSpend(c); break;
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
  if (r) { r.status = 'refused'; note(r, w.now, `${h.name} would not help`); }
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
  const APPROACH: Record<string, [string, string?]> = { 'protect:take': ['Take his offer', `$${r.counterAmt ?? fee} a week.`], 'protect:press': ['Pressure', 'Make him think about it.'], 'protect:return': ['Give him time'] };
  c.v.choices = [...r.followups.filter((f) => f.key !== 'ask.whoPays' || !c.v.mem.points.includes('named:collector')).map((f) => { const id = f.key === 'accept.counter' ? 'protect:take' : f.key === 'press.now' ? 'protect:press' : f.key === 'announce.return' ? 'protect:return' : f.key === 'tell.reputation' ? 'protect:press' : 'protect:return'; return { id, label: APPROACH[id][0], note: APPROACH[id][1], says: line(c, f.key, { amt: `$${r.counterAmt ?? fee}`, day: 'Friday' }), group: 'reply' as const }; }).filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i).slice(0, 3), { id: 'letgo:protect', label: 'Let it go', says: line(c, 'let.go'), group: 'reply' }, { id: 'leave', label: 'Leave', group: 'leave' }];
}

function doLoan(c: Ctx, amt: number, how?: string) {
  const { w, h, n } = c;
  const mem = new EncounterMemory(2); mem.said = new Set(c.v.mem.points);
  const offered = { ...(how === 'rep' ? { reputation: true } : {}), ...(how === 'rate' ? { rate: 0.08 } : {}), ...(how === 'promise' ? { promise: 'the end of the month' } : {}) };
  if (how === 'take' && c.v.mem.offered.loan) { const sit = openAsk(w, 'borrow', h, n, { amt: Number(c.v.mem.offered.loan) }); if (sit) door.agree(w, sit, 'loan'); card(c, 'card.agreed.loan', { amt: `$${c.v.mem.offered.loan}`, rate: String(c.v.mem.offered.rate ?? 5) }); remember(w, n.id, 'loan', 'agreed'); return general(c); }
  const r = onLoanRequest(c.pn(), h, amt, mem, offered);
  c.v.mem.points = [...mem.said];
  him(c, r);
  if (r.decision.chosen === 'accept') { const sit = openAsk(w, 'borrow', h, n, { amt }); if (sit) door.agree(w, sit, 'loan'); card(c, 'card.agreed.loan', { amt: `$${amt}`, rate: '5' }); remember(w, n.id, 'loan', 'agreed'); return general(c); }
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
function doNews(c: Ctx) {
  const { w, h, n } = c, pn = c.pn(), r = peek(n, h.id);
  c.v.mem.points.push('news');
  const willTell = r.trust >= 0.15 || r.affection >= 0.25 || pn.temper.agreeable > 0.6;
  // what is weighing on him comes first: trouble he is trying to get out of, if he trusts the player enough to mention it; the player
  // can then offer what he would have offered had he been asked
  const his = (social(w).pursuits ?? []).find((p) => p.who === n.id && p.status === 'active' && p.kind === 'stopTrouble');
  const a = his ? w.chars[his.against ?? ''] : undefined;
  if (his && a && willTell && !myPromiseTo(c) && !(talks(w)[n.id]?.topics ?? []).some((x) => x.k === 'trouble:' + his.id)) {
    him(c, onSeekHelp(pn, a));
    const req = social(w).requests.find((x) => x.by === n.id && x.of === h.id && x.status === 'open') ?? request(w, { by: n.id, of: h.id, wants: 'intervene', about: 'trouble:' + a.id, for: n.id, against: a.id, biz: ownerBiz(w, n.id)?.id, fact: his.fact });
    remember(w, n.id, 'trouble:' + his.id, 'told');
    c.v.topic = 'help:' + req.id;
    return openHelpChoices(c, req, false);
  }
  const told = new Set((talks(w)[n.id]?.topics ?? []).filter((x) => x.k.startsWith('news:')).map((x) => x.k.slice(5)));
  const district = ownerBiz(w, n.id)?.district ?? n.district;
  const f = willTell ? pn.knownFacts((x) => !x.minor && w.now - x.t < 14 * DAY && !told.has(x.id) && x.actor !== n.id && ['vandalism', 'robbery', 'beating', 'arrest', 'murder', 'protection_started', 'promotion', 'business_failed'].includes(x.kind) && (x.district === district || x.victim === n.id || !!(x.business && w.biz[x.business]?.district === district))).sort((a, b) => b.t - a.t)[0] : undefined;
  if (f) {
    const k = n.known[f.id], who = f.actor && k?.knowsActor ? w.chars[f.actor] : undefined, vic = f.victim ? w.chars[f.victim] : undefined;
    him(c, plain(n.id, 'news.' + f.kind, { whoFirst: who ? first(who.name) : '', victimFirst: vic ? first(vic.name) : '', shop: f.business ? w.biz[f.business]?.name ?? '' : '', when: agoWords(w.now, f.t) }));
    door.inform(w, n, h, f, 'news');
    remember(w, n.id, 'news:' + f.id, 'told');
  } else {
    const b = ownerBiz(w, n.id);
    him(c, plain(n.id, !willTell ? 'news.notForYou' : b && b.distress > 0 ? 'news.slow' : n.cash < 80 ? 'news.money' : 'news.quiet'));
  }
  general(c);
}
// An evening together: what they talk about is what each of them knows and has lived lately, and what is between them
function doSpend(c: Ctx): number {
  const { w, h, n } = c;
  c.v.mem.points.push('spend');
  if (acquainted(w, h, n)) remember(w, n.id, 'spend', 'evening');
  if (!acquainted(w, h, n)) { door.introduce(w, h, n); him(c, plain(n.id, 'react.introduction.neutral', { youName: h.name })); general(c); return 10; }
  // what is between them, as he knows it, is what the evening turns on; otherwise his own life and the street, as he knows them
  const mine = myPromiseTo(c), a0 = mine ? w.chars[mine.matter?.against ?? ''] : undefined;
  const his = (social(w).pursuits ?? []).find((p) => p.who === n.id && p.status === 'active' && p.kind === 'stopTrouble');
  const trouble = his ? w.chars[his.against ?? ''] : undefined;
  const bv = mine ? belief(w, n, 'ob:' + mine.id).value : undefined;
  const between = mine && a0 ? (bv === 'kept' ? `how quiet it has been since ${first(a0.name)} stopped coming round` : bv === 'done' ? `${first(a0.name)}, and whether what you did will be enough` : `${first(a0.name)}, and what you were going to do about him`) : trouble ? `${first(trouble.name)}, and not much else` : undefined;
  const venue = n.rank === 'civilian' ? (ownerBiz(w, n.id) ? 'his place after closing' : `a bar in ${n.district}`) : 'the club';
  const r0 = peek(n, h.id), before = (r0.affection ?? 0) + r0.trust + (r0.known ?? 0) * 0.3;
  door.spendTime(w, h, n, 'visit');
  const r1 = peek(n, h.id), moved = (r1.affection ?? 0) + r1.trust + (r1.known ?? 0) * 0.3 - before;
  const a = spendTimeAccount(c.ph(), c.pn(), n, venue, compat(w, h, n), String(Math.floor(w.now / DAY)), between, moved);
  narr(c, a.text);
  c.v.ended = true;
  return 120;
}
export const engineVersion = 1;
void r2;
