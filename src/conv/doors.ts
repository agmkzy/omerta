// The action catalogue (spec §3.2): everything the conversation layer does to the world goes through here, and everything here goes
// through a door the world already has. Nothing in src/conv writes a world record directly (architecture test: conv/integration).
// Each action leaves an act record (social.log) that obligations are kept or broken by, and, where the world records it, a fact.
import { addFact, bear, clamp, compat, ease as coreEase, feel, feelAtLeast, feelToOn, knowMore, learn, payDebt as corePayDebt, regard as coreRegard, rel, repute as coreRepute, transfer, writeDown as coreWriteDown } from '../core';
import * as deeds from '../deeds';
import { share, confide as tellAbout } from '../actions';
import { handOver as booksHandOver, react as booksReact } from '../books';
import { bossOffer, declineJob, mkJob, oppFrom, takeJob, tipFrom } from '../jobs';
import { choose as encChoose } from '../encounters';
import { askAbout as sitAskAbout, helpWith as sitHelpWith } from '../situations';
import { matterAct as mAct } from '../matters';
import { reply as exReply } from '../exchange';
import { amends as disputeAmends, playerActed, touchDispute } from '../disputes';
import { helpMan as peopleHelpMan } from '../people';
import { openSitdown } from '../meetings';
import { questionReport } from '../orders';
import { recall as memoryRecall } from '../memory';
import { noteConduct, noteHard } from '../temper';
import { know as situKnow } from '../situ';
import { wantFor } from '../crewlife';
import { addFavour } from '../encounters';
import { discipline as booksDiscipline } from '../books';
import { agreeAsk, amendsAsk, askBetween, callFavour, layoffFor, move as askMove, nameFigure, openAsk, playerMove, rateAsk, stance, type AskMove } from '../asks';
import type { Business, Character, Debt, Enc, Fact, Grievance, Id, Job, Memo, Situation, World } from '../types';
import type { Act } from './obligations';
import { social, sid } from './social';

function record(w: World, a: Omit<Act, 'id' | 't'>): Act {
  const s = social(w), x: Act = { ...a, id: sid(s, 'a'), t: w.now };
  s.log.push(x);
  return x;
}

// inform: he tells another what he knows of an event (core.learn: the listener now knows it, from him, as far as the teller did)
export function inform(w: World, teller: Character, listener: Character, f: Fact, about: string): Act {
  learn(w, listener.id, f, teller.id, teller.known[f.id]?.knowsActor ?? !f.hiddenActor);
  return record(w, { actor: teller.id, act: 'inform', target: listener.id, about, fact: f.id });
}
// raise: he takes a matter to a man (the request itself is the act; conv/requests records it)
export function raise(w: World, asker: Character, of: Character, about: string, predicted?: number, best?: boolean): Act {
  return record(w, { actor: asker.id, act: 'raise', target: of.id, about, predicted, best });
}
// order: a superior tells his man to leave someone alone (asks.layoffFor: the world's own "have a word"; its lifecycle decides
// whether the man agrees, and what agreeing does)
export function order(w: World, superior: Character, man: Character, forC: Character, about: string, fact?: Id): { act: Act; sit?: Situation } {
  const sit = layoffFor(w, superior, man, forC, fact);
  return { act: record(w, { actor: superior.id, act: 'order', target: man.id, about }), sit };
}
// demand: a collector asks a shop to pay (asks.openAsk 'protect' and the asker's first move)
export function demand(w: World, collector: Character, owner: Character, bizId: Id, fee: number, about: string): { act: Act; sit?: Situation; answer?: string } {
  const sit = askBetween(w, 'protect', collector.id, owner.id, bizId) ?? openAsk(w, 'protect', collector, owner, { biz: bizId, amt: fee, why: `${collector.name} wants ${owner.name} to pay him` });
  const out = sit ? askMove(w, sit, 'ask') : undefined;
  return { act: record(w, { actor: collector.id, act: 'demand', target: owner.id, about }), sit, answer: out?.answer };
}
// harm, by pressing a demand with force (the ask kind's own force: damage, a fact, the protector told)
export function force(w: World, sit: Situation, about: string): Act | undefined {
  const by = sit.terms?.by, of = sit.terms?.of;
  if (!by || !of) return undefined;
  askMove(w, sit, 'force');
  return record(w, { actor: by, act: 'harm', target: of, about });
}
// withdraw: he lets a demand drop (the asker's own move)
export function withdraw(w: World, sit: Situation, about: string): Act | undefined {
  const by = sit.terms?.by;
  if (!by) return undefined;
  askMove(w, sit, 'drop');
  return record(w, { actor: by, act: 'withdraw', target: sit.terms?.of, about });
}
// agree: a yes decided by the conversation layer, carried out by the ask kind's own effects (asks.agreeAsk)
export function agree(w: World, sit: Situation, about: string): Act | undefined {
  const by = sit.terms?.of;
  if (!by) return undefined;
  agreeAsk(w, sit);
  return record(w, { actor: by, act: 'agree', target: sit.terms?.by, about });
}
// pay: money from one man to another (core.transfer: the one door for it)
export function pay(w: World, from: Character, to: Character, amt: number, why: string, about = ''): Act | undefined {
  if (Math.round(amt) <= 0 || from.cash < Math.round(amt)) return undefined;
  const x = transfer(w, from, to, amt, 'gift', why);
  return record(w, { actor: from.id, act: 'pay', target: to.id, about, amt: x });
}
// favour: one man now owes another (encounters.addFavour)
export function favour(w: World, from: Character, to: Character, size: number, what: string, about = ''): Act {
  addFavour(w, from.id, to.id, size, what);
  return record(w, { actor: from.id, act: 'favour', target: to.id, about });
}
// what a man thinks of another moves (core.feel / core.bear): the one door for regard and grudges
export const regard = (w: World, who: Character, about: Id, f: 'trust' | 'respect' | 'affection' | 'fear', amt: number, why?: string) => feel(w, who, about, f, amt, why);
export const grudge = (w: World, who: Character, against: Id, amt: number, why: string | Fact) => bear(w, who, against, amt, why);
// something that happened between men, on record for those who were there (core.addFact)
export const happened = addFact;
// discipline: a superior punishes a man for going against him (books.discipline: what the family does to a man who crosses it)
export function discipline(w: World, boss: Character, man: Character, cause: Id, amt: number, about = ''): Act {
  booksDiscipline(w, boss, man, cause, amt);
  return record(w, { actor: boss.id, act: 'discipline', target: man.id, about });
}
// spend time: an evening together (core.knowMore, and liking by how well they get on: core.compat)
export function spendTime(w: World, a: Character, b: Character, about = ''): Act {
  knowMore(a, b, 0.08);
  const c = compat(w, a, b);
  if (Math.abs(c) > 0.1) { feel(w, b, a.id, 'affection', c * 0.1, 'an evening together'); feel(w, a, b.id, 'affection', c * 0.1, 'an evening together'); }
  if (c > 0.15) feel(w, b, a.id, 'trust', 0.03, 'an evening together');
  return record(w, { actor: a.id, act: 'spendTime', target: b.id, about });
}
// met: two men have met (the world's record of it, Rel.lastMet, which the weekly fading of trust and liking reads, core.feelingsWeek)
export function met(w: World, a: Character, b: Character): void { rel(a, b.id).lastMet = rel(b, a.id).lastMet = w.now; }
// introduce: the player and a man now know each other by name (the player's record of who he has met; core.knowMore)
export function introduce(w: World, p: Character, t: Character): void {
  if (!p.intro?.[t.id]) (p.intro ??= {})[t.id] = w.now;
  if ((t.rels[p.id]?.known ?? 0) < 0.1) knowMore(p, t, 0.1);
}

// ================================================================== Gate 4: what the old conversation engine did inline, now each a door
// (the world's own actions, deeds.ts, and the systems the old engine called: asks, jobs, encounters, situations, matters, books, disputes)

// ---- money
export function spend(w: World, c: Character, amt: number, note: string): number { return deeds.spend(w, c, amt, note); }
export function tribute(w: World, p: Character, boss: Character, amt: number, why: string): number { return deeds.tribute(w, p, boss, amt, why); }
export function giveBack(w: World, t: Character, p: Character, f: Fact): number { return deeds.giveBack(w, t, p, f); }
export function payDebt(w: World, d: Debt, amt: number): void { corePayDebt(w, d, amt); }
export function gift(w: World, from: Character, to: Character, amt: number, why: string): number { return deeds.gift(w, from, to, amt, why); }
export function friendLoan(w: World, p: Character, t: Character, amt: number, rate: number, why: string): Debt | undefined { return deeds.friendLoan(w, p, t, amt, rate, why); }
// ---- regard: at least so much (a witness he now has reason to trust), set outright (talk that has gone stale gives back what it gave), eased
export function trustAtLeast(w: World, who: Character, about: Id, level: number): void { feelAtLeast(w, who, about, 'trust', level); }
// two men who have spoken have a footing with each other, both ways, whatever it is (the record other things read: who he has views on)
export function footing(w: World, a: Character, b: Character): void { rel(a, b.id); rel(b, a.id); }
export function regardTo(w: World, who: Character, about: Id, f: 'trust' | 'affection' | 'respect', v: number): void { feelToOn(rel(who, about), f, v); }
export function softens(w: World, who: Character, about: Character, amt: number, why: string): void { deeds.softens(w, who, about, amt, why); }
export function easeGrudge(w: World, who: Character, about: Id, factor: number): void { coreEase(who, about, factor); }
export function repute(w: World, p: Character, amt: number, kind: string): void { coreRepute(w, p, amt, kind); }
export function conduct(p: Character, k: Parameters<typeof noteConduct>[1], n = 1): void { noteConduct(p, k, n); }
// ---- knowledge
export function learnFrom(w: World, listener: Character, f: Fact, from: Id, knowsActor: boolean): void { learn(w, listener.id, f, from, knowsActor); }
export function passOn(w: World, from: Character, to: Character, lines: string[], opt?: Parameters<typeof share>[4]): Fact[] { return share(w, from, to, lines, opt); }
export function confide(w: World, c: Character, t: Character, lines: string[]): void { tellAbout(w, c, t, lines); }
export function recall(w: World, p: Character, t: Character): ReturnType<typeof memoryRecall> { return memoryRecall(w, p, t); }
export function insight(p: Character, about: Id, tag: string): void { deeds.insight(p, about, tag); }
export function noteOn(p: Character, t: Character, text: string): void { deeds.noteOn(p, t, text); }
export function tagOn(p: Character, t: Id, tag: string): void { deeds.tagOn(p, t, tag); }
// ---- memos, cooldowns, introductions, what he wants, his troubles
export function memo(w: World, holder: Character, other: Id, kind: Memo['kind'], text: string, o: { due?: number; ref?: Id; done?: boolean } = {}): Memo { return deeds.memo(w, holder, other, kind, text, o); }
export function memoOnce(w: World, holder: Character, other: Id, kind: Memo['kind'], text: string, due?: number): void { deeds.memoOnce(w, holder, other, kind, text, due); }
export function memoDone(m: Memo): void { deeds.memoDone(m); }
export function denied(w: World, t: Character, fact: Id): void { deeds.denied(w, t, fact); }
export function undenied(t: Character, fact: Id): void { deeds.undenied(t, fact); }
export function cool(c: Character, key: string, until: number): void { deeds.cool(c, key, until); }
export function introduced(w: World, p: Character, t: Character): void { deeds.introduced(w, p, t); }
export function turnedAway(w: World, p: Character, t: Character): void { deeds.turnedAway(w, p, t); }
export function settleWant(w: World, t: Character): NonNullable<Character['want']>['kind'] { return deeds.settleWant(w, t, wantFor(t)); }
export function revealProblem(t: Character): void { deeds.revealProblem(t); }
export function restrain(w: World, t: Character): void { deeds.restrain(w, t); }
export function keepLow(t: Character): void { deeds.keepLow(t); }
export function sideIncome(w: World, t: Character): void { deeds.sideIncome(w, t); }
export function sideRevealed(w: World, t: Character, p: Character): void { deeds.sideRevealed(w, t, p); }
export function heat(c: Character, d: number): void { deeds.heat(c, d); }
export function tension(w: World, a: Character, b: Character, d: number, floor = false): void { deeds.tension(w, a, b, d, floor); }
// ---- work
export function offerWork(w: World, from: Character, boss: boolean, chance: boolean): boolean { return boss ? bossOffer(w, true) : chance ? tipFrom(w, from) || oppFrom(w, from) : false; }
export function bossWork(w: World): boolean { return bossOffer(w, true); }
export function fenceWork(w: World, t: Character): boolean { return oppFrom(w, t); }
export function takeWork(w: World, j: Job): void { takeJob(w, j); }
export function passWork(w: World, j: Job): void { declineJob(w, j); }
export function reportJobs(w: World, p: Character, t: Character): number { return deeds.reportJobs(w, p, t); }
export function refuseJob(w: World, p: Character, j: Job): void { deeds.refuseJob(w, p, j); }
export function promiseToHandle(w: World, p: Character, t: Character, target: Character, o: Parameters<typeof deeds.promiseToHandle>[4]): Job { return deeds.promiseToHandle(w, p, t, target, o, mkJob as never); }
// ---- standing, favours, sit-downs
export function setBacker(p: Character, t: Character): void { deeds.setBacker(p, t); }
export function settleFavour(w: World, from: Id, to: Id): boolean { return deeds.settleFavour(w, from, to); }
export function draftGrievance(w: World, g: Parameters<typeof deeds.draftGrievance>[1]): Grievance { return deeds.draftGrievance(w, g); }
export function sitdown(w: World, p: Character, g: Grievance, isNew: boolean): ReturnType<typeof openSitdown> {
  if (isNew) deeds.grievance(w, g); // (the meeting looks the grievance up by id, so it is on the books while it is set up)
  const m = openSitdown(w, p, g);
  if (isNew && typeof m === 'string') deeds.dropGrievance(w, g); // (he would not come: nothing is left behind)
  return m;
}
export function reportSkimming(w: World, boss: Character, man: Character, fl: { amt: number; n: number; last: number }): void { booksReact(w, boss, man, fl, 'dialogue'); }
// ---- a shop the player collects from
export function setFee(w: World, p: Character, t: Character, b: Business, fee: number, kind: Memo['kind'], memoText: string, factText?: string): void { deeds.setFee(w, p, t, b, fee, kind, memoText, factText); }
export function cutFee(w: World, p: Character, t: Character, b: Business): { old: number; now: number } { return deeds.cutFee(w, p, t, b); }
export function refusedMore(w: World, t: Character, p: Character, b: Business): void { deeds.refusedMore(w, t, p, b); }
export function handBack(w: World, p: Character, b: Business): boolean { return deeds.handBack(w, p, b); }
export function graceWeek(w: World, p: Character, b: Business): void { deeds.graceWeek(w, p, b); }
export function leanOnShop(w: World, p: Character, b: Business): number { return deeds.leanOnShop(w, p, b); }
export function chopShop(w: World, p: Character, t: Character, b: Business): void { deeds.chopShop(w, p, t, b); }
// ---- debts
export function debtWeek(d: Debt): void { deeds.debtWeek(d); }
export function debtHalved(d: Debt): void { deeds.debtHalved(d); }
export function debtForFavour(w: World, d: Debt): void { deeds.debtForFavour(w, d); }
export function debtQuarterOff(w: World, p: Character, d: Debt): void { deeds.debtQuarterOff(w, p, d); }
export function payForTime(w: World, d: Debt, amt: number): void { deeds.payForTime(w, d, amt); }
export function moreTime(d: Debt): void { deeds.moreTime(d); }
// ---- the envelope, the crew
export function handOver(w: World, p: Character, boss: Character, amt: number): string[] { return booksHandOver(w, p, boss, amt); }
export function helpMan(w: World, p: Character, c: Character, how: 'cash' | 'duties' | 'leave'): string[] { return peopleHelpMan(w, p, c, how); }
// ---- matters between men (asks.ts): opened, moved, a figure named, a favour called in, a rate asked, amends offered
export function openMatter(w: World, kind: string, a: Character, t: Character, o: Parameters<typeof openAsk>[4]): Situation | undefined { return openAsk(w, kind as never, a, t, o); }
export function matterMove(w: World, p: Character, sid: Id, mv: AskMove): { lines: string[]; minutes: number } { return playerMove(w, p, sid, mv); }
export function nameTheFigure(w: World, p: Character, sid: Id, amt: number, rate?: number): { lines: string[]; minutes: number } { return nameFigure(w, p, sid, amt, rate); }
export function answerPoint(w: World, p: Character, s: Situation, k: string): string[] { return exReply(w, p, s, k); }
export function callIn(w: World, p: Character, t: Character, f: Parameters<typeof callFavour>[3], amt: number): Situation | undefined { return callFavour(w, p, t, f, 'money', amt); }
export function askRate(w: World, p: Character, t: Character): Situation | undefined { return rateAsk(w, p, t); }
export function offerAmends(w: World, p: Character, t: Character, o: Parameters<typeof amendsAsk>[3]): Situation | undefined { return amendsAsk(w, p, t, o); }
// ---- disputes, encounters, situations, matters he is in
export function amendsMade(w: World, p: Character, t: Character, how: 'own' | 'pay' | 'start' | 'defy'): void { disputeAmends(w, p, t, how); }
export function actedOn(w: World, p: Character, t: Character, how: string): void { playerActed(w, p, t, how); }
export function touched(w: World, p: Character, t: Character, text?: string): void { touchDispute(w, p, t, text); }
export function answerEncounter(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } { return encChoose(w, p, e, code); }
export function putOff(w: World, e: Enc, until: number): void { deeds.putOffEnc(e, until); }
export function situationAsk(w: World, p: Character, c: Character): string[] { return sitAskAbout(w, p, c); }
export function situationHelp(w: World, p: Character, c: Character, how: 'cover' | 'lend' | 'leave' | 'rival'): string[] { return sitHelpWith(w, p, c, how); }
export function matterAct(w: World, p: Character, sid: Id, code: string, who?: Id): { lines: string[]; minutes: number } { return mAct(w, p, sid, code, who); }

// ---- Gate 4 Stage D: what the subjects of a man's life (conv/subjects) do
// a favour owed, on the record and nothing more (the layer's own record of acts, favour(), is for what the layer itself decides)
export function owe(w: World, from: Character, to: Character, size: number, what: string): void { addFavour(w, from.id, to.id, size, what); }
// regard that grows less the more often the same kind of thing is done in a week (core.regard)
export function esteem(w: World, who: Character, about: Character, f: 'trust' | 'respect' | 'affection', amt: number, kind: string): number { return coreRegard(w, who, about, f, amt, kind); }
export function talkNote(w: World, t: Character, key: string, sig: string): void { deeds.talkNote(w, t, key, sig); }
export function talkStamp(w: World, t: Character, key: string, sig = 'x'): void { deeds.talkStamp(w, t, key, sig); }
export function easeProblem(t: Character, d: number): void { deeds.easeProblem(t, d); }
export function skimOwned(t: Character): void { deeds.skimOwned(t); }
export function madeUp(w: World, t: Character, p: Character, amt: number): number { return deeds.madeUp(w, t, p, amt); }
export function toldDirect(w: World, c: Character, f: Fact, from: Id): void { deeds.toldDirect(w, c, f, from); }
export function knowsWho(p: Character, f: Fact): void { deeds.knowsWho(p, f); }
export function introducedThrough(w: World, p: Character, o: Character, trust: number): void { deeds.introducedThrough(w, p, o, trust); }
export function hardWith(w: World, p: Character, t: Character, k: 'threats' | 'force', n = 1): void { noteHard(w, p, t, k, n); }
export function writeOff(w: World, d: Debt, amt: number): void { coreWriteDown(w, d, amt); }
export function lean(w: World, s: Situation, id: Id, good: number, resolve: number): void { const S = stance(w, s, id); S.good = clamp(S.good + good); S.resolve = clamp(S.resolve + resolve); }
export function heardOf(s: Situation, id: Id): void { s.m = { ...(s.m ?? {}), ['heard:' + id]: 1 }; }
export function learnsOf(w: World, s: Situation, id: Id, l: 1 | 2, via: string): void { situKnow(w, s, id, l, via); }
export function work(w: World, spec: Parameters<typeof mkJob>[1]): Job { return mkJob(w, spec); }
// a man's account of a job put to him again (orders.questionReport: he may hold to it, or it may come apart)
export function questionAgain(w: World, j: Job): string[] { return questionReport(w, j); }
// an offer of amends that comes with money: what is on the table is at least that
export function raiseTerms(s: Situation, amt: number): void { if (s.terms) s.terms.amt = Math.max(s.terms.amt ?? 0, amt); }
