// Pursuits (spec §7): what an NPC is trying to bring about, and how he goes about it, decided by him from what he believes. Nothing is
// carried out automatically: a man who promised to raise a matter decides each day whether to do it, wait, ask to be let off, or let it
// go; a shopkeeper being leaned on looks for a way to make it stop among the routes he can see (his protector, a man in the life he
// trusts, the man's own captain if he knows who that is, paying, putting up with it), ranks them by what he expects each man would
// say (a prediction from his own picture of that man, which can be wrong), tries the best, and reviews when it fails, when he runs out
// of patience, or when he learns something that opens a better route. A man who doesn't know who did something to him asks around,
// and may be lied to. Every exchange between them is the same respond as the player's, on each man's own perception.
import { factHooks, ownerBiz, peek } from '../core';
import { askBetween, openAsk, move as askMove } from '../asks';
import { hash } from '../voice';
import type { Temper } from '../temper';
import type { Character, Fact, Id, World } from '../types';
import { DAY } from '../types';
import { newSession, perceive, type Perception } from './perception';
import { onAnswersTo, onIntervention, onKeepWord, onOrderRequest, onProgressAsked, onRenegotiate, onWhoQuestion, type Reply } from './respond';
import { HOSTILE, injured, offender, release, withdraw, type Obligation } from './obligations';
import { note, sid, social, type Request } from './social';
import { agreement, captaincyOf, hooks, onPromise, promise, request } from './tick';
import { captainOf, chairFor, may } from './authority';
import { belief, onRevision, refresh, say, judge } from './minds';
import { enter } from './annals';
import * as door from './doors';

export type PKind = 'stopTrouble' | 'keepWord' | 'learnWho' | 'followUp';
export interface Step { t: number; route: string; with?: Id; result: string }
export interface Pursuit {
  id: Id; who: Id; kind: PKind; motive: 'change' | 'understand' | 'obligation';
  against?: Id; ob?: Id; fact?: Id; biz?: Id;
  route?: string; with?: Id; waitingOn?: Id; value?: number;
  tried: Step[]; asked?: Id[]; patience: number; next: number; since: number; waitedFrom?: number;
  status: 'active' | 'achieved' | 'abandoned';
  why?: string;
  revised?: string;   // what he learnt that made him look again (cleared when he has)
  turnedDown?: string[]; // 'route:man' he has been refused on: never asked again in this pursuit (kept apart from the bounded history)
}
const P = (w: World) => (social(w).pursuits ??= []) as Pursuit[];
const r2 = (x: number) => Math.round(x * 100) / 100;
const sig = (x: number) => 1 / (1 + Math.exp(-x * 4));
const live = (w: World, id?: Id) => (id && w.chars[id]?.alive ? w.chars[id] : undefined);
const PRIORITY: Record<PKind, number> = { keepWord: 4, stopTrouble: 3, followUp: 2, learnWho: 1 };

export function pursue(w: World, x: Omit<Pursuit, 'id' | 'tried' | 'status' | 'since' | 'next'> & { next?: number }): Pursuit | undefined {
  const all = P(w), mine = all.filter((p) => p.who === x.who && p.status === 'active');
  // one pursuit per thing: the same trouble from the same man is one matter, however many times it comes up
  if (mine.some((p) => p.kind === x.kind && (x.kind === 'stopTrouble' ? p.against === x.against : p.ob === x.ob && p.fact === x.fact))) return undefined;
  // at most three at once for a man (spec §7.5: two social pursuits, plus what he owes): the least pressing gives way
  if (mine.length >= 3) { const low = [...mine].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])[0]; if (PRIORITY[low.kind] >= PRIORITY[x.kind]) return undefined; low.status = 'abandoned'; low.why = 'other things pressed harder'; }
  if (all.filter((p) => p.status === 'active').length >= 120) return undefined;
  const p: Pursuit = { ...x, id: sid(social(w), 'p'), tried: [], status: 'active', since: w.now, next: x.next ?? w.now + DAY };
  all.push(p);
  enter({ t: w.now, who: p.who, what: `${w.chars[p.who].name} starts a pursuit: ${describe(w, p)}`, chain: p.id });
  return p;
}
export function describe(w: World, p: Pursuit): string {
  const n = (id?: Id) => (id ? w.chars[id]?.name ?? '?' : '?');
  return p.kind === 'stopTrouble' ? `make ${n(p.against)} leave him alone` : p.kind === 'learnWho' ? `find out who was behind ${w.facts[p.fact ?? '']?.textHidden ?? 'it'}` : p.kind === 'keepWord' ? `do what he promised (${p.ob})` : `see that ${n(social(w).obs.find((o) => o.id === p.ob)?.obligor)} does what he promised (${p.ob})`;
}
function done(w: World, p: Pursuit, status: 'achieved' | 'abandoned', why: string) {
  p.status = status; p.why = why;
  enter({ t: w.now, who: p.who, what: `${w.chars[p.who].name} ${status === 'achieved' ? 'has what he wanted' : 'gives up'}: ${describe(w, p)} (${why})`, chain: p.id });
  if (status === 'abandoned') door.happened(w, { kind: 'rumour', minor: true, actor: p.who, text: `${w.chars[p.who].name} has given up trying to ${describe(w, p)}.` }, { witnesses: [p.who] });
}
const tried = (p: Pursuit, route: string, withId?: Id) => (p.turnedDown ?? []).includes(`${route}:${withId ?? ''}`) || p.tried.some((x) => x.route === route && x.with === withId && x.result !== 'pending');
function log(w: World, p: Pursuit, route: string, withId: Id | undefined, result: string) {
  p.tried.push({ t: w.now, route, with: withId, result }); if (p.tried.length > 6) p.tried.splice(0, p.tried.length - 6);
  if (result !== 'pending' && route !== 'askAround') { (p.turnedDown ??= []).push(`${route}:${withId ?? ''}`); if (p.turnedDown.length > 16) p.turnedDown.shift(); }
}

// ---------------------------------------------------------------- predicting another man (spec §7.3: prediction is not decision)
// His picture of the other man: the temperament he has seen of him, blurred towards the ordinary by how little he knows him; the
// other's regard for him as he himself feels it (he assumes it runs both ways); what the other knows, only as far as he knows it too.
export function modelOf(w: World, by: Character, of: Character): Perception {
  const real = perceive(w, newSession(), of), mine = perceive(w, newSession(), by), k = peek(by, of.id).known ?? 0;
  const temper = Object.fromEntries(Object.entries(real.temper).map(([a, v]) => [a, r2(v * k + 0.5 * (1 - k))])) as unknown as Temper;
  return { ...real, temper, feelingFor: (o) => (o.id === by.id ? mine.feelingFor(of) : real.feelingFor(o)), knownFacts: (pred) => real.knownFacts((f) => pred(f) && !!by.known[f.id]) };
}
const margin = (r: Reply, yes: string) => { const c = r.decision.candidates, y = c.find((x) => x.move === yes)?.value ?? -1, n = Math.max(...c.filter((x) => x.move !== yes).map((x) => x.value), -1); return y - n; };

// ---------------------------------------------------------------- making a man leave him alone
interface Route { route: string; with?: Id; value: number; why: string }
function demandOf(w: World, v: Character, a: Character) { const b = ownerBiz(w, v.id); return b ? askBetween(w, 'protect', a.id, v.id, b.id) : undefined; }
function troubleRoutes(w: World, p: Pursuit, v: Character, a: Character): Route[] {
  const pv = perceive(w, newSession(), v), t = pv.temper, out: Route[] = [];
  const b = ownerBiz(w, v.id), dem = demandOf(w, v, a), fact = p.fact ? w.facts[p.fact] : undefined;
  // what has already gone wrong weighs on what he tries next: every man who said no makes the next ask feel less worth it (less so for
  // a proud man, who takes a refusal as a reason to push harder), and makes waiting, paying or putting up with it look better
  const failures = (p.turnedDown ?? []).length, discouraged = failures * 0.1 * (1 - t.pride * 0.5);
  const inLife = v.rank !== 'civilian';
  // his protector, if he has one other than the man himself
  const prot = live(w, b?.protection?.collectorId);
  if (prot && prot.id !== a.id && dem && !tried(p, 'protector', prot.id)) out.push({ route: 'protector', with: prot.id, value: r2(0.4 + peek(v, prot.id).trust * 0.3 + t.caution * 0.15 - discouraged), why: `${prot.name} looks after the place` });
  // the man's own captain, if he believes he knows who that is and has any standing with him
  const chairB = belief(w, v, 'answersTo:' + a.id), chair = live(w, chairB.value);
  if (chair && chairB.conf >= 0.4 && !tried(p, 'chair', chair.id)) {
    const r = onOrderRequest(modelOf(w, v, chair), v, a, v);
    out.push({ route: 'chair', with: chair.id, value: r2(sig(margin(r, 'order')) * (0.4 + (peek(v, chair.id).known ?? 0)) + t.pride * 0.1 + (inLife ? 0.1 : 0) - 0.1 - discouraged), why: `${chair.name} is over ${a.name}, as he understands it` });
  } else if (!chair && (p.asked ?? []).length < 3) { // (he asks around, but not the whole city: three men at most
    // finding out is worth what it would open (spec §7.3: information unlocks routes): going to the man's captain is what a man does
    // when he has a name to go to, more so a proud man or one in the life; a careful man asks before he acts
    const opens = 0.3 + t.pride * 0.1 + (inLife ? 0.1 : 0);
    out.push({ route: 'askAround', value: r2(opens * 0.8 + t.caution * 0.15 - discouraged * 0.5), why: `he doesn't know who ${a.name} answers to, and that would open a way` });
  }
  // a man in the life he knows, who might take it up for him (the player among them): the one he trusts most, not everyone in turn
  const known = Object.values(w.chars).filter((x) => x.alive && x.id !== v.id && x.id !== a.id && x.bossId !== a.id && x.rank !== 'civilian' && (peek(v, x.id).known ?? 0) >= 0.2 && peek(v, x.id).trust >= 0.1 && peek(v, x.id).grudge < 0.3 && !tried(p, 'intercessor', x.id)).sort((x, y) => (peek(v, y.id).trust - peek(v, x.id).trust) || (x.id < y.id ? -1 : 1)).slice(0, 2);
  for (const x of known) {
    const k = captaincyOf(w, x, v, a, v); k.knowsTrouble = k.knowsTrouble || !!fact; // he would tell him what happened
    const r = onIntervention(modelOf(w, v, x), v, v, a, k, []);
    out.push({ route: 'intercessor', with: x.id, value: r2(sig(margin(r, 'accept')) * 0.8 + peek(v, x.id).trust * 0.3 + (peek(v, x.id).known ?? 0) * 0.2 + t.agreeable * 0.1 - 0.1 - discouraged), why: `${x.name} is in the life, and he knows him` });
  }
  // pay, and have it over with: what a frightened man does, and a proud one won't
  if (dem) { const fee = dem.terms?.amt ?? 0, burden = fee / Math.max(20, (b?.income ?? 100) * 0.1); out.push({ route: 'pay', value: r2(0.2 + (1 - t.courage) * 0.3 - burden * 0.25 - t.pride * 0.35 + failures * 0.06 * (1 - t.pride)), why: `$${fee} a week, and it stops` }); }
  // a man in the life answers it himself (the world's own retaliation takes it from there, with the grudge he now means to settle)
  if (inLife && !tried(p, 'retaliate')) out.push({ route: 'retaliate', value: r2(t.pride * 0.25 + t.volatility * 0.25 + v.traits.violence * 0.2 - t.caution * 0.2 + failures * 0.05 - 0.15), why: 'he will deal with it himself' });
  // wait and see whether it blows over: a careful man's choice, more so after asking has got him nowhere
  if (!tried(p, 'wait')) out.push({ route: 'wait', value: r2(0.05 + t.caution * 0.2 + failures * 0.08 * t.caution - (dem ? 0.05 : 0)), why: 'see whether it blows over' });
  // or put up with it
  out.push({ route: 'endure', value: r2(0.04 + failures * 0.04 + (1 - t.pride) * 0.05 - t.pride * 0.05), why: 'nothing he can do' });
  return out.sort((x, y) => y.value - x.value || (x.route < y.route ? -1 : 1));
}
function stopTrouble(w: World, p: Pursuit) {
  const v = live(w, p.who), a = live(w, p.against);
  if (!v || !a) return done(w, p, 'abandoned', 'the man is gone');
  const b = ownerBiz(w, v.id), dem = demandOf(w, v, a);
  const last = Object.values(w.facts).filter((f) => HOSTILE.has(f.kind) && !!offender(f) && (offender(f) === a.id || w.chars[offender(f)!]?.bossId === a.id) && (injured(f) === v.id || (!!b && f.business === b.id)) && v.known[f.id]).reduce((m, f) => Math.max(m, f.t), p.since);
  if (!dem && w.now - last > 21 * DAY) return done(w, p, 'achieved', `${a.name} has left him alone for three weeks`);
  // waiting on something already set going
  if (p.waitingOn) {
    const s = social(w), r = s.requests.find((x) => x.id === p.waitingOn), ob = s.obs.find((x) => x.id === p.waitingOn);
    const sit = (w.situations ?? []).find((x) => x.id === p.waitingOn);
    // his request was agreed to: from now on he is waiting on the promise that came of it
    if (r && r.status === 'agreed') { const g = s.agreements.find((x) => x.madeIn === r.id), o2 = g && s.obs.find((x) => g.obligations.includes(x.id)); if (o2) { p.waitingOn = o2.id; p.waitedFrom = w.now; p.next = w.now + 2 * DAY; return; } }
    const settledBad = (r && (r.status === 'refused' || r.status === 'lapsed' || r.status === 'referred')) || (ob && (['broken', 'notDone', 'withdrawn', 'released'].includes(belief(w, v, 'ob:' + ob.id).value ?? '') || ob.status === 'void')) || (sit && sit.stage === 'resolved' && sit.out !== 'agreed' && sit.out !== 'gave in' && !!dem);
    const patient = w.now - (p.waitedFrom ?? p.since) < p.patience * DAY;
    if (!settledBad && patient) { p.next = w.now + 2 * DAY; return; }
    log(w, p, p.route ?? '?', p.with, settledBad ? 'it came to nothing' : 'he ran out of patience waiting');
    enter({ t: w.now, who: v.id, with: p.with, what: `${v.name}: ${settledBad ? `going to ${w.chars[p.with ?? '']?.name ?? 'them'} came to nothing` : `tired of waiting on ${w.chars[p.with ?? '']?.name ?? 'them'}`}; he thinks again`, chain: p.id });
    p.waitingOn = undefined; p.route = undefined;
    // he takes a day or more to think, longer the more it has gone wrong
    const pause = Math.min(4, 1 + Math.floor((p.turnedDown ?? []).length / 2));
    if (pause > 1) { p.next = w.now + pause * DAY; return; }
  }
  const routes = troubleRoutes(w, p, v, a), top = routes[0];
  enter({ t: w.now, who: v.id, what: `${v.name} weighs what to do about ${a.name}: ${routes.map((x) => `${x.route}${x.with ? ' (' + w.chars[x.with].name + ')' : ''} ${x.value}`).join(', ')}`, chain: p.id });
  if (!top || top.route === 'endure') return done(w, p, 'abandoned', 'there is nothing more he can do');
  const before = p.tried.at(-1);
  if (p.revised && before && (before.route !== top.route || before.with !== top.with)) enter({ t: w.now, who: v.id, what: `${v.name} changes his plan: ${before.route}${before.with ? ' (' + w.chars[before.with]?.name + ')' : ''} → ${top.route}${top.with ? ' (' + w.chars[top.with]?.name + ')' : ''}, because ${p.revised}`, chain: p.id });
  p.revised = undefined;
  p.route = top.route; p.with = top.with; p.value = top.value; p.waitedFrom = w.now;
  const x = top.with ? w.chars[top.with] : undefined, fact = p.fact ? w.facts[p.fact] : undefined;
  if (top.route === 'protector' && x && dem) {
    const h = openAsk(w, 'help', v, x, { about: dem.id, why: `${v.name} wants ${x.name} to deal with ${a.name}` });
    if (h) { askMove(w, h, 'ask'); p.waitingOn = dem.id; log(w, p, 'protector', x.id, 'pending'); }
    else log(w, p, 'protector', x.id, 'could not reach him');
  } else if (top.route === 'chair' && x) {
    if (fact) door.inform(w, v, x, fact, 'trouble:' + a.id);
    const r = request(w, { by: v.id, of: x.id, wants: 'order', about: 'trouble:' + a.id, for: v.id, against: a.id, biz: b?.id, fact: fact?.id, next: w.now + DAY });
    door.raise(w, v, x, 'trouble:' + a.id);
    p.waitingOn = r.id; log(w, p, 'chair', x.id, 'pending');
  } else if (top.route === 'intercessor' && x) {
    if (fact) door.inform(w, v, x, fact, 'trouble:' + a.id);
    const r = request(w, { by: v.id, of: x.id, wants: 'intervene', about: 'trouble:' + a.id, for: v.id, against: a.id, biz: b?.id, fact: fact?.id });
    door.raise(w, v, x, 'trouble:' + a.id);
    p.waitingOn = r.id; log(w, p, 'intercessor', x.id, 'pending');
    if (!x.isPlayer) answerIntervention(w, r); // (the player answers his own, when they next meet)
  } else if (top.route === 'askAround') {
    const y = Object.values(w.chars).filter((z) => z.alive && z.id !== v.id && z.id !== a.id && z.rank !== 'civilian' && !z.isPlayer && (peek(v, z.id).known ?? 0) >= 0.15 && !(p.asked ?? []).includes(z.id)).sort((m, n) => peek(v, n.id).trust - peek(v, m.id).trust || (m.id < n.id ? -1 : 1))[0];
    if (!y) { log(w, p, 'askAround', undefined, 'nobody to ask'); p.next = w.now + 3 * DAY; return; }
    (p.asked ??= []).push(y.id);
    const held = belief(w, y, 'answersTo:' + a.id).value;
    const r = onAnswersTo(perceive(w, newSession(), y), v, a, held);
    enter({ t: w.now, who: y.id, with: v.id, what: `${v.name} asks ${y.name} who ${a.name} answers to: ${r.decision.chosen}`, reply: r, chain: p.id });
    if (r.decision.chosen === 'tell' && held) say(w, y, v, 'answersTo:' + a.id, held, y.familyId === a.familyId ? 'seen' : 'rumour', true, `${a.name} is with ${w.chars[held].name}`);
    log(w, p, 'askAround', y.id, r.decision.chosen === 'tell' ? 'told' : 'got nothing');
  } else if (top.route === 'wait') {
    log(w, p, 'wait', undefined, 'waited');
    enter({ t: w.now, who: v.id, what: `${v.name} decides to wait and see whether it blows over`, chain: p.id });
    p.next = w.now + Math.round(3 + perceive(w, newSession(), v).temper.caution * 5) * DAY; return;
  } else if (top.route === 'retaliate') {
    door.grudge(w, v, a.id, 0.35, `he means to answer ${a.name} himself`);
    log(w, p, 'retaliate', undefined, 'his own way');
    return done(w, p, 'abandoned', 'he will settle it his own way');
  } else if (top.route === 'pay' && dem) {
    door.agree(w, dem, 'trouble:' + a.id);
    log(w, p, 'pay', a.id, 'paid');
    return done(w, p, 'achieved', `he pays ${a.name} now`);
  }
  p.next = w.now + DAY;
}

// A man in the life asked by someone in trouble to take it up: the same decision as the player's captain makes (onIntervention), on
// his own perception; yes is his promise to raise it with the man over the one causing it.
export function answerIntervention(w: World, r: Request) {
  // (asked by `asker`, on behalf of `forC`: the shopkeeper himself, or a man passing it up the line for him)
  const asker = w.chars[r.by], x = w.chars[r.of], a = live(w, r.against), forC = w.chars[r.for ?? r.by];
  if (!asker || !x || !a || !forC) return;
  const k = captaincyOf(w, x, forC, a, asker);
  const d = onIntervention(perceive(w, newSession(), x), asker, forC, a, k, []);
  enter({ t: w.now, who: x.id, with: asker.id, what: `${asker.name} asks ${x.name} to take up ${forC.id === asker.id ? 'his' : forC.name + '’s'} trouble with ${a.name}: ${d.decision.chosen}`, reply: d, chain: r.id });
  if (d.decision.chosen !== 'accept') { r.status = 'refused'; note(r, w.now, `${x.name} refused`); return; }
  // whom he takes it to is the hierarchy's: a man who can order the one causing it does so himself; a captain goes to the other man's
  // captain; anyone below a captain goes to his own captain first, who decides for himself whether to take it further
  const own = captainOf(w, x), chairA = chairFor(w, a, forC) ?? captainOf(w, a);
  const chair = may(w, x, 'order', a) ? x : x.rank === 'capo' || !own || own.id === chairA?.id ? chairA : own;
  r.status = 'agreed'; note(r, w.now, `${x.name} agreed`);
  const g = agreement(w, [asker.id, x.id], `${x.name} will raise it with ${chair?.name ?? 'someone'}`, [asker.id], r.id);
  if (chair && chair.id === x.id) {
    const { sit } = door.order(w, x, a, forC, r.about, r.fact);
    const o = request(w, { by: x.id, of: x.id, wants: 'order', about: r.about, for: forC.id, against: a.id, biz: r.biz, fact: r.fact, sit: sit?.id, parent: r.parent });
    note(o, w.now, `${x.name} told ${a.name} himself`);
    if (!sit) { o.status = 'lapsed'; note(o, w.now, 'the word never reached him'); }
    return;
  }
  if (!chair) return;
  promise(w, { type: 'action', obligor: x.id, beneficiary: asker.id, promisee: asker.id, spec: { kind: 'actionDone', act: 'raise', target: chair.id, about: r.about }, from: w.now, by: w.now + 7 * DAY, parent: r.parent, matter: { for: forC.id, against: a.id, biz: r.biz, fact: r.fact }, notify: [asker.id], words: `${x.name} said he would raise it with ${chair.name}` }, g);
}

// ---------------------------------------------------------------- doing what he promised (an NPC's own word)
function keepWord(w: World, p: Pursuit) {
  const s = social(w), ob = s.obs.find((o) => o.id === p.ob), x = live(w, p.who);
  if (!ob || !x) return done(w, p, 'abandoned', 'nothing to keep');
  if (ob.status !== 'pending') return done(w, p, ob.status === 'kept' ? 'achieved' : 'abandoned', `the promise is ${ob.status}`);
  if (ob.spec.kind !== 'actionDone' || ob.spec.act !== 'raise') { p.next = w.now + 3 * DAY; return; }
  const to = live(w, ob.spec.target), prom = live(w, ob.promisee ?? ob.beneficiary), m = ob.matter, a = live(w, m?.against);
  const canAct = !!to && !!a && x.jailedUntil <= w.now && x.hurtUntil <= w.now && (to?.jailedUntil ?? 0) <= w.now;
  const daysLeft = Math.floor((ob.by - w.now) / DAY);
  // what it costs him: trouble with another captain over someone else's matter, less if it's trouble on his own ground
  const k = a && to && prom ? captaincyOf(w, x, prom, a, prom) : undefined;
  const cost = r2(0.2 + (to && to.rank !== 'civilian' && to.id !== x.bossId ? 0.15 + perceive(w, newSession(), x).temper.caution * 0.15 : 0) - (k?.knowsTrouble ? 0.2 : 0) + (ob.conflicts?.length ? 0.3 : 0));
  if (!prom) return done(w, p, 'abandoned', 'the man he promised is gone');
  // (he is seeing the man anyway: they met in the last day, as men in the same crew or the same streets do)
  const seesHim = !!to && w.now - (x.rels[to.id]?.lastMet ?? -1e9) < DAY;
  const d = onKeepWord(perceive(w, newSession(), x), prom, cost, daysLeft, canAct, { window: Math.round((ob.by - ob.from) / DAY), seesHim });
  const ch = d.decision.chosen;
  enter({ t: w.now, who: x.id, with: prom.id, what: `${x.name}, on his promise to ${prom.name} (${daysLeft} days left): ${ch}`, reply: d, chain: p.id });
  if (ch === 'act' && to && a && m) {
    door.raise(w, x, to, ob.spec.about);
    const r = request(w, { by: x.id, of: to.id, wants: may(w, to, 'order', a) ? 'order' : 'intervene', about: ob.spec.about, for: m.for, against: m.against, biz: m.biz, fact: m.fact, parent: ob.id, next: w.now + DAY });
    if (m.fact && w.facts[m.fact] && x.known[m.fact]) door.inform(w, x, to, w.facts[m.fact], ob.spec.about);
    note(r, w.now, `${x.name} took it to ${to.name}`);
    return done(w, p, 'achieved', `he took it to ${to.name}`);
  }
  if (ch === 'renegotiate' && !tried(p, 'renegotiate')) {
    log(w, p, 'renegotiate', prom.id, 'asked');
    if (prom.isPlayer) { request(w, { by: x.id, of: prom.id, wants: 'intervene', about: 'release:' + ob.id, parent: ob.id }); p.next = w.now + 2 * DAY; return; }
    const stakes = 1; // (what it means to the man promised: his trouble, for these matters)
    const rr = onRenegotiate(perceive(w, newSession(), prom), x, stakes);
    enter({ t: w.now, who: prom.id, with: x.id, what: `${x.name} asks ${prom.name} to let him off, or give him time: ${rr.decision.chosen}`, reply: rr, chain: p.id });
    if (rr.decision.chosen === 'release') { release(w, ob, `${prom.name} let him off`); say(w, x, prom, 'ob:' + ob.id, 'released', 'own', true); return done(w, p, 'achieved', 'released'); }
    if (rr.decision.chosen === 'extend') { ob.by += 7 * DAY; say(w, x, prom, 'ob:' + ob.id, 'later', 'own', true); }
    p.next = w.now + DAY; return;
  }
  if (ch === 'abandon') {
    // an honest man says so (withdrawn: less than a broken word); another simply lets it lapse
    const t = perceive(w, newSession(), x).temper;
    if (t.agreeable + t.empathy > 1) { withdraw(w, ob, `${x.name} told ${prom.name} he couldn't do it`); say(w, x, prom, 'ob:' + ob.id, 'withdrawn', 'own', true); return done(w, p, 'abandoned', 'he told him he could not do it'); }
    return done(w, p, 'abandoned', 'he lets it lapse');
  }
  p.next = w.now + DAY;
}

// ---------------------------------------------------------------- waiting on someone else's promise
function followUp(w: World, p: Pursuit) {
  const s = social(w), ob = s.obs.find((o) => o.id === p.ob), b = live(w, p.who), o = live(w, ob?.obligor);
  if (!ob || !b) return done(w, p, 'abandoned', 'nothing to follow');
  judge(w, b, ob);
  const bel = belief(w, b, 'ob:' + ob.id), bv = bel.value;
  // found out he was lied to, by the player: he will say so to his face
  if (o?.isPlayer && (s.judged ?? []).some((j) => j.who === b.id && j.ob === ob.id && j.lied) && !s.requests.some((r) => r.by === b.id && r.wants === 'confront' && r.parent === ob.id)) {
    request(w, { by: b.id, of: o.id, wants: 'confront', about: 'lie', parent: ob.id });
    enter({ t: w.now, who: b.id, with: o.id, what: `${b.name} goes to find ${o.name}: he knows now he was lied to`, chain: p.id });
  }
  // what settles his question depends on what was promised (spec §6.3): told credibly that the thing was done settles a promise to
  // do it, or to try; a promise of a result, or to stay away, is settled by the result, not by the man saying he did his part
  const deed = ob.type === 'action' || ob.type === 'effort';
  if (!bel.uncertain && ((deed && bv === 'done') || bv === 'kept' || bv === 'released')) return done(w, p, 'achieved', `as he believes it: ${bv}`);
  if (!bel.uncertain && (bv === 'broken' || bv === 'notDone' || bv === 'withdrawn')) return done(w, p, 'abandoned', `as he believes it: ${bv}`);
  if (ob.status !== 'pending' && w.now > ob.by + 10 * DAY) return done(w, p, 'abandoned', 'nothing came of it that he knows of');
  // verification (spec §5.3): told it was done, and yet the trouble goes on, he checks with the man it was supposed to be done with
  const said = (s.said ?? []).filter((x) => x.to === b.id && x.subject === 'ob:' + ob.id && x.by === ob.obligor);
  const told = said.filter((x) => x.value === 'done').at(-1), m = ob.matter, spec = ob.spec;
  const after = told && m?.against ? Object.values(w.facts).some((f) => HOSTILE.has(f.kind) && f.t > told.t && offender(f) !== undefined && (offender(f) === m.against || w.chars[offender(f) ?? '']?.bossId === m.against) && (injured(f) === b.id || f.business === m.biz) && b.known[f.id]) : false;
  const check = spec.kind === 'actionDone' ? live(w, spec.target) : undefined;
  if (told && after && check && !(p.asked ?? []).includes(check.id) && !check.isPlayer) {
    (p.asked ??= []).push(check.id);
    const did = s.log.some((x) => x.actor === ob.obligor && x.act === (spec as { act: string }).act && x.target === check.id && x.t >= ob.from);
    const willSay = peek(check, b.id).trust + (1 - perceive(w, newSession(), check).temper.caution) * 0.3 > 0.3;
    enter({ t: w.now, who: b.id, with: check.id, what: `${b.name}, told it was done and seeing the trouble go on, asks ${check.name} whether ${o?.name} ever came to him: ${willSay ? (did ? 'yes' : 'no') : 'he won’t say'}`, chain: p.id });
    if (willSay) say(w, check, b, 'ob:' + ob.id, did ? 'done' : 'notDone', 'own', true, did ? 'He came to me.' : 'He never came to me.');
    judge(w, b, ob);
    p.next = w.now + DAY; return;
  }
  // asking him how it stands: only with a reason to (spec §6.7). Not when he has already been told and has no cause to doubt it; not
  // twice for the same reason. Reasons: he has heard nothing at all and his patience is spent; the deadline is on them and he has
  // heard nothing since he last asked; he was told "not yet" and has waited his patience again
  const daysLeft = Math.floor((ob.by - w.now) / DAY), last = said.at(-1);
  const heardSinceAsked = !!last && last.t >= (p.waitedFrom ?? ob.from);
  const quietFor = Math.floor((w.now - (last?.t ?? ob.from)) / DAY);
  const reason = !last && quietFor >= p.patience ? 'he has heard nothing'
    : last?.value === 'notYet' && quietFor >= p.patience ? 'he was told “not yet”, and has waited'
    : daysLeft <= 1 && daysLeft >= 0 && !heardSinceAsked && !(deed && last?.value === 'done') ? 'the time is nearly up'
    : undefined;
  // the player is asked in person: he comes to find him (a request of the player, which the player answers when they meet)
  if (o?.isPlayer && reason && !(last && last.value === 'done') && !s.requests.some((r) => r.by === b.id && r.of === o.id && r.wants === 'progress' && r.parent === ob.id && (r.status === 'open' || w.now - r.t < p.patience * DAY))) {
    p.waitedFrom = w.now;
    request(w, { by: b.id, of: o.id, wants: 'progress', about: (ob.spec as { about?: string }).about ?? 'promise', parent: ob.id, for: ob.matter?.for, against: ob.matter?.against });
    enter({ t: w.now, who: b.id, with: o.id, what: `${b.name} goes to find ${o.name}, to ask where his promise stands (${reason})`, chain: p.id });
  }
  if (o && reason && !o.isPlayer && !(last && last.value === 'done')) {
    p.waitedFrom = w.now;
    const did = spec.kind === 'actionDone' ? s.log.some((x) => x.actor === ob.obligor && x.act === (spec as { act: string }).act && x.about === (spec as { about: string }).about && x.t >= ob.from) : false;
    const r = onProgressAsked(perceive(w, newSession(), o), b, did, daysLeft);
    enter({ t: w.now, who: o.id, with: b.id, what: `${b.name} asks ${o.name} whether he has done it (${reason}): he says ${r.says}${r.honest ? '' : ' (a lie)'}`, reply: r, chain: p.id });
    say(w, o, b, 'ob:' + ob.id, r.says, 'own', r.honest);
    judge(w, b, ob);
  }
  p.next = w.now + DAY;
}

// ---------------------------------------------------------------- finding out who did it
function learnWho(w: World, p: Pursuit) {
  const v = live(w, p.who), f = p.fact ? w.facts[p.fact] : undefined;
  if (!v || !f) return done(w, p, 'abandoned', 'nothing to find out');
  const b = refresh(w, v, 'who:' + f.id, 'asking around');
  if (b.value && b.conf >= 0.5 && !b.uncertain) {
    done(w, p, 'achieved', `he believes it was ${w.chars[b.value]?.name}`);
    // what he does about it is his: a man he believes did it to him, and is in the life, is trouble to be stopped
    const culprit = live(w, b.value);
    if (culprit && culprit.rank !== 'civilian' && v.rank === 'civilian') pursue(w, { who: v.id, kind: 'stopTrouble', motive: 'change', against: culprit.id, fact: f.id, patience: 6 });
    return;
  }
  if (w.now - p.since > p.patience * DAY) return done(w, p, 'abandoned', b.uncertain ? 'he heard two stories and could not settle it' : 'nobody would say');
  // ask the people who might know: around the place it happened, men he knows; one or two a day, nobody twice
  const asked = new Set(p.asked ?? []);
  const cands = Object.values(w.chars).filter((x) => x.alive && x.id !== v.id && !x.isPlayer && !asked.has(x.id) && (x.district === f.district || (peek(v, x.id).known ?? 0) >= 0.25)).sort((x, y) => (hash(p.id + x.id) % 997) - (hash(p.id + y.id) % 997)).slice(0, b.uncertain ? 2 : 1);
  for (const x of cands) {
    (p.asked ??= []).push(x.id); if (p.asked.length > 16) p.asked.shift();
    const actor = f.actor ? w.chars[f.actor] : undefined;
    // a man who would cover for the one who did it, and has a grudge against someone plausible, may name him instead
    const scape = actor ? Object.entries(x.rels).filter(([id, r]) => r.grudge >= 0.3 && id !== actor.id && id !== v.id && w.chars[id]?.alive && w.chars[id].rank !== 'civilian').sort((m, n) => n[1].grudge - m[1].grudge)[0] : undefined;
    const guess = x.known[f.id]?.blame ? w.chars[x.known[f.id].blame!] : undefined;
    const r = onWhoQuestion(perceive(w, newSession(), x), v, f.id, actor, scape ? w.chars[scape[0]] : undefined, guess?.name.split(' ')[0]);
    enter({ t: w.now, who: x.id, with: v.id, what: `${v.name} asks ${x.name} who was behind it: ${r.decision.chosen}${r.honest ? '' : ' (not the truth)'}`, reply: r, chain: p.id });
    const named = r.meaning.slots?.named;
    if (named) say(w, x, v, 'who:' + f.id, named, r.meaning.role === 'witness' ? 'seen' : 'rumour', r.honest);
  }
  if (!cands.length) p.next = w.now + 3 * DAY; else p.next = w.now + DAY;
}

// ---------------------------------------------------------------- the day
export function pursuitsDay(w: World) {
  const all = P(w);
  for (const p of [...all].filter((x) => x.status === 'active' && x.next <= w.now).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (p.kind === 'stopTrouble') stopTrouble(w, p);
    else if (p.kind === 'keepWord') keepWord(w, p);
    else if (p.kind === 'followUp') followUp(w, p);
    else learnWho(w, p);
  }
  // finished ones are kept a while for the record, then go
  const keep = all.filter((p) => p.status === 'active' || w.now - (p.tried.at(-1)?.t ?? p.since) < 21 * DAY);
  social(w).pursuits = keep.slice(-120);
}

// where pursuits come from: what happens to a man, and promises made by him or to him
export function startFrom(w: World, f: Fact) {
  if (!w.social || !HOSTILE.has(f.kind)) return;
  // a demand on his shop that he has turned down is trouble already (spec §7.1): he wants it to stop before it gets worse
  if (f.kind === 'protection_refused') {
    const v = f.actor ? w.chars[f.actor] : undefined, a = f.victim ? w.chars[f.victim] : undefined;
    if (v?.alive && !v.isPlayer && v.rank === 'civilian' && a && a.rank !== 'civilian') { const t = perceive(w, newSession(), v).temper; pursue(w, { who: v.id, kind: 'stopTrouble', motive: 'change', against: a.id, fact: f.id, biz: f.business, patience: Math.round(4 + t.caution * 5 + t.agreeable * 3 - t.pride * 2) }); }
    return;
  }
  const v = f.victim ? w.chars[f.victim] : f.business ? w.chars[w.biz[f.business]?.ownerId] : undefined;
  if (!v || !v.alive || v.isPlayer || !f.actor) return;
  const k = v.known[f.id];
  if (!k) return;
  const t = perceive(w, newSession(), v).temper;
  if (k.knowsActor) { const a = w.chars[f.actor]; if (a && a.rank !== 'civilian' && v.rank === 'civilian') pursue(w, { who: v.id, kind: 'stopTrouble', motive: 'change', against: a.id, fact: f.id, biz: f.business, patience: Math.round(4 + t.caution * 5 + t.agreeable * 3 - t.pride * 2) }); }
  else pursue(w, { who: v.id, kind: 'learnWho', motive: 'understand', fact: f.id, patience: Math.round(8 + t.caution * 6) });
}
hooks.day.push(pursuitsDay);
hooks.intervene = (w, r) => answerIntervention(w, r);
factHooks().push((w, f) => startFrom(w, f));
onPromise.push((w, ob) => {
  const x = w.chars[ob.obligor], b = w.chars[ob.beneficiary];
  if (x && !x.isPlayer && ob.spec.kind === 'actionDone' && ob.type === 'action') pursue(w, { who: x.id, kind: 'keepWord', motive: 'obligation', ob: ob.id, patience: 7, next: w.now + DAY });
  if (b && !b.isPlayer && !ob.order) { const t = perceive(w, newSession(), b).temper; pursue(w, { who: b.id, kind: 'followUp', motive: 'obligation', ob: ob.id, patience: Math.round(3 + t.caution * 4 + t.agreeable * 3 - t.pride * 2) }); }
});
// what he learns can open a better route (spec §7.4): his pursuits look again tomorrow, not at their next scheduled turn
onRevision.push((w, r) => {
  // a follow-up settled on his belief reopens when he comes to believe otherwise (a lie found out, the result failing): a new reason
  for (const p of P(w)) if (p.status !== 'active' && p.kind === 'followUp' && p.who === r.who && r.subject === 'ob:' + p.ob && ['broken', 'notDone'].includes(r.to ?? '') && p.why?.includes('as he believes it: done')) {
    p.status = 'active'; p.why = `reopened: he now believes ${r.to} (${r.why})`; p.next = w.now + DAY;
    enter({ t: w.now, who: r.who, what: `${w.chars[r.who].name} takes it up again: he now believes it was ${r.to === 'notDone' ? 'never done' : 'broken'} (${r.why})`, chain: p.id });
  }
  for (const p of P(w)) if (p.status === 'active' && p.who === r.who && ((r.subject.startsWith('answersTo:') && p.kind === 'stopTrouble' && r.subject.endsWith(p.against ?? '#')) || (r.subject === 'ob:' + p.ob) || (r.subject === 'who:' + p.fact))) {
    p.next = Math.min(p.next, w.now + DAY); p.revised = `he now believes ${r.subject.startsWith('answersTo:') ? `${w.chars[r.subject.split(':')[1]]?.name} answers to ${w.chars[r.to ?? '']?.name}` : `${r.subject} is ${r.to}`}`;
    enter({ t: w.now, who: r.who, what: `${w.chars[r.who].name} now believes ${r.subject.split(':')[0] === 'answersTo' ? `${w.chars[r.subject.split(':')[1]]?.name} answers to ${w.chars[r.to ?? '']?.name}` : `${r.subject}: ${r.to}`} (${r.why}); he will think again`, chain: p.id });
  }
});
export type { Obligation };
