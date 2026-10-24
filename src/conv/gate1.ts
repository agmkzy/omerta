// Gate 1 (docs/CONVERSATION_SPEC.md §15): the language proof of concept. Every line below is produced by the engine from a
// decision and a meaning; nothing is a written scene. The player only ever picks a row that was on screen: the harness throws if
// it tries anything else. Run: npx tsx src/conv/gate1.ts  (writes docs/gate1/TRANSCRIPTS.md)
import { writeFileSync, mkdirSync } from 'node:fs';
import { createWorld } from '../world';
import { addFact, compat, learn, ownerBiz, rel } from '../core';
import { crewGround, setCollector } from '../econ';
import { DAY, type Character, type World } from '../types';
import { newSession, perceive, type Session } from './perception';
import { interpret } from './speech';
import { render } from './render';
import { Out, Visit, LEAVE, first, trace, traceLines, type Row } from './harness';
import { ClaimStore, believe, contradictions } from './beliefs';
import { Obligations, type ObType } from './obligations';
import { generalisation } from './gen';
import { createDebt, feel } from '../core';
import { prospects, recruitProspect } from '../orders';
import { onCollectionReport, onConfrontation, onDebtQuestion, onPromise, onPromiseSeenBroken, predictAcceptance } from './respond';
import { onAnnouncement, onArrival, onAuthorityClaim, onIntervention, onIntroduction, onLoanRequest, onProgressQuestion, onProtectionDemand, onReport, onReturnToPromisee, onUnknownTopic, onWait, onWhoQuestion, spendTimeAccount, type Captaincy, type Reply } from './respond';

let o = new Out();
const P = (x = '') => o.P(x);
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const famOf = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : '');
class V extends Visit { constructor(w: World, s: Session, henry: Character, him: Character, where: string, patience = 2) { super(o, w, s, henry, him, where, patience); } }

// ------------------------------------------------------------------ the bakery world and its five Franks
interface Profile { label: string; about: string; temper: Record<string, number>; arch: 'earnest' | 'proud' | 'bitter' | 'frightened' | 'schemer' | 'hothead' | 'cold'; setup: (w: World, s: Session, frank: Character, henry: Character) => void }
function bakeryWorld(seed: number) {
  const w = createWorld(seed, 'Henry Tedesco');
  const henry = w.chars[w.playerId!], s = newSession();
  const frank = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && ownerBiz(w, c.id)!.kind !== 'casino' && !ownerBiz(w, c.id)!.protection).sort(byId)[0];
  frank.name = 'Frank Russo';
  const b = ownerBiz(w, frank.id)!; b.name = 'Russo’s Bakery';
  w.now = 9 * DAY + 15 * 60;
  return { w, s, henry, frank, b };
}
const PROFILES: Profile[] = [
  { label: 'Cautious', about: 'Careful by nature; pays a Corrente soldier for protection already.', arch: 'earnest', temper: { caution: 0.8, courage: 0.55, pride: 0.4, agreeable: 0.5, volatility: 0.3 },
    setup: (w, _s, frank) => { const col = Object.values(w.chars).filter((c) => c.alive && c.familyId === w.chars[w.playerId!].familyId && c.rank === 'soldier' && !c.isPlayer).sort(byId)[0]; col.name = 'Tommy Conti'; setCollector(w, ownerBiz(w, frank.id)!, col.id, col.familyId!, { fee: 25 }); } },
  { label: 'Proud', about: 'Proud and quick to anger; nobody protects him and he likes it that way.', arch: 'hothead', temper: { pride: 0.85, volatility: 0.7, courage: 0.8, caution: 0.25, agreeable: 0.3 }, setup: () => {} },
  { label: 'Desperate', about: 'Three bad weeks running; almost no cash; nobody protects him.', arch: 'bitter', temper: { pride: 0.3, agreeable: 0.6, courage: 0.45, caution: 0.5, volatility: 0.3 },
    setup: (w, _s, frank) => { const b = ownerBiz(w, frank.id)!; b.distress = 3; frank.cash = 60; } },
  { label: 'Frightened', about: 'Timid; a shop on his street was smashed up last week, and he saw it.', arch: 'frightened', temper: { courage: 0.15, caution: 0.6, pride: 0.25, agreeable: 0.6, volatility: 0.2 },
    setup: (w, _s, frank) => { const b = ownerBiz(w, frank.id)!; const other = Object.values(w.biz).find((x) => x.id !== b.id && x.district === b.district && x.open)!; const owner = w.chars[other.ownerId]; const thug = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && !c.isPlayer).sort(byId)[1]; w.now -= 6 * DAY; addFact(w, { kind: 'vandalism', actor: thug.id, victim: owner.id, business: other.id, text: `${thug.name}'s people smashed up ${other.name}.`, district: b.district }, { witnesses: [frank.id] }); w.now += 6 * DAY; } },
  { label: 'Connected', about: 'His cousin is a soldier in another family; nobody else protects him.', arch: 'schemer', temper: { caution: 0.6, pride: 0.5, courage: 0.55, agreeable: 0.45, volatility: 0.35 },
    setup: (w, s, frank, henry) => { const cous = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId && c.familyId !== henry.familyId).sort(byId)[0]; cous.name = 'Sal Russo'; (s.kin[frank.id] ??= []).push({ id: cous.id, role: 'cousin' }); } },
];
const OPENING: Row[] = [{ key: 'introduce.self', note: 'Introduce yourself. He’ll know who you are from now on, for better or worse.' }, { key: 'compliment.business', note: 'Get to the point: protection. He doesn’t know you, and he owes you nothing.' }, { key: 'buy.small', note: 'Buy something and leave it there. Next time you’re a face he knows.' }, LEAVE];

function bakery() {
  P('## 1. The bakery: a first visit, five different men');
  P('');
  P('Henry Tedesco (an associate of the Corrente family) walks into Russo’s Bakery for the first time. Same Henry, same afternoon, same choices. Only the man behind the counter differs. Every reply is the engine’s, and every choice Henry makes is one of the rows on screen at that moment.');
  P('');
  for (const pr of PROFILES) {
    const { w, s, henry, frank } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
    P(`### ${pr.label} Frank`); P(`*${pr.about}*`); P('');
    const v = new V(w, s, henry, frank, 'Russo’s Bakery');
    P('*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*'); P('');
    v.him_(onArrival(perceive(w, s, frank), henry, 'three in the afternoon'));
    v.offer(OPENING);
    v.pick('introduce.self');
    s.told[frank.id] = { [henry.id]: { family: famOf(w, henry), name: henry.name, basis: { kind: 'claimed', ref: 'introduced himself' } } };
    v.him_(onIntroduction(perceive(w, s, frank), henry, famOf(w, henry)));
    v.offer([{ key: 'demand.protection', note: 'Put it to him plainly.', slots: { amt: '$40' } }, { key: 'buy.small', note: 'Leave it at an introduction.' }, LEAVE]);
    v.pick('demand.protection');
    const r = onProtectionDemand(perceive(w, s, frank), henry, 40, 'plain', v.mem);
    v.him_(r);
    const g = r.meaning.grounds;
    if (r.decision.chosen === 'refuse' || r.decision.chosen === 'dismiss') {
      v.offer([...r.followups.map((f) => ({ key: f.key, note: f.note, slots: { day: 'Friday' } })), LEAVE]);
      if (r.followups.some((f) => f.key === 'announce.return')) {
        v.pick('announce.return', { act: 'announce' });
        v.him_(onAnnouncement(perceive(w, s, frank), henry));
        v.card('card.refuse.' + (g ?? 'doesNotKnow'), { collectorFirst: 'Tommy' }, render({ key: 'card.intention.return', stance: 'flat', toward: 'speaker', slots: { day: 'Friday' } }, 'card', 'earnest'));
      } else v.card('card.refuse.' + (g ?? 'pride'), {});
    } else if (r.decision.chosen === 'counter') {
      v.offer([...r.followups.map((f) => ({ key: f.key, note: f.note, slots: { amt: `$${r.counterAmt}` } })), LEAVE]);
      v.pick('accept.counter');
      v.card('card.agreed.counter', { amt: `$${r.counterAmt}` });
    } else if (r.decision.chosen === 'accept') v.card(r.meaning.key === 'accept.protection.afraid' ? 'card.accept.protection.afraid' : 'card.accept.protection', { amt: '$40' });
    else if (r.decision.chosen === 'refer') v.card('card.refer.protection.kin', { kinFirst: r.meaning.slots?.kinFirst ?? '', kinFamily: r.meaning.slots?.kinFamily ?? '' });
  }
}

function compliment() {
  P('## 2. "Nice place. You must do well here."');
  P('');
  P('The same indirect remark, before Henry has said who he is. Whether Frank hears a demand depends only on what *he* knows. Henry’s real intention is never visible to him.');
  P('');
  for (const pr of PROFILES) {
    const { w, s, henry, frank } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
    P(`### ${pr.label} Frank`);
    const v = new V(w, s, henry, frank, 'Russo’s Bakery');
    v.offer(OPENING);
    const sp = v.pick('compliment.business', { act: 'compliment', explicit: 0 });
    const heard = interpret(perceive(w, s, frank), sp, henry);
    if (heard.act === 'demand.protection') v.him_(onProtectionDemand(perceive(w, s, frank), henry, 40, 'inferred', v.mem), { heard });
    else { v.him_({ decision: { by: frank.id, constraints: [], candidates: [], chosen: 'reply' }, meaning: { key: 'reply.compliment', stance: 'polite', toward: 'speaker' }, intent: 'remark', honest: true }, { heard }); P('*He took it as a compliment. To ask for anything now, Henry has to say it plainly.*'); P(''); }
  }
}

function doorAndClaims() {
  P('## 3. The door shut, "I’ll wait", and a claim of authority'); P('');
  for (const label of ['Cautious', 'Frightened']) {
    const pr = PROFILES.find((x) => x.label === label)!;
    const { w, s, henry, frank, b } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
    const other = Object.values(w.biz).find((x) => x.id !== b.id && x.district === b.district && x.open)!;
    const o = w.chars[other.ownerId];
    const f = addFact(w, { kind: 'protection_refused', actor: o.id, victim: henry.id, business: other.id, text: `${o.name} told ${henry.name} to get out of ${other.name}.`, district: b.district }, { witnesses: [] });
    learn(w, frank.id, f, o.id, true);
    P(`### ${label} Frank, who has heard what happened next door`);
    const v = new V(w, s, henry, frank, 'Russo’s Bakery');
    v.him_(onArrival(perceive(w, s, frank), henry, 'three in the afternoon'));
    v.offer([{ key: 'leave.another', note: 'Go, and come back another day.' }, { key: 'stay.wait', note: 'Stay where you are. He won’t like it.' }, LEAVE]);
    v.pick('stay.wait', { act: 'wait' });
    v.him_(onWait(perceive(w, s, frank), henry));
  }
  const pr = PROFILES[0];
  const { w, s, henry, frank } = bakeryWorld(3);
  s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
  const cap = captainOf(w, henry)!;
  P(`### A false claim: "${cap.name} sent me" (Cautious Frank)`);
  P('*Henry’s captain sent him nowhere. Frank can only judge the claim from what he knows.*'); P('');
  const v = new V(w, s, henry, frank, 'Russo’s Bakery');
  v.offer([{ key: 'claim.authority', note: 'Say your captain sent you. It isn’t true.', slots: { authority: cap.name } }, ...OPENING]);
  v.pick('claim.authority', { act: 'claim' });
  v.him_(onAuthorityClaim(perceive(w, s, frank), henry, cap), { trace: ['private (Henry): honest = false (his captain did not send him)'] });
}

function simple() {
  P('## 4. A straightforward question, and two evenings'); P('');
  const w = createWorld(7, 'Henry Tedesco'), s = newSession(), henry = w.chars[w.playerId!];
  const friend = Object.values(w.chars).filter((c) => c.alive && c.rank === 'associate' && !c.isPlayer && c.familyId === henry.familyId).sort(byId)[0];
  const thug = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId && c.familyId !== henry.familyId).sort(byId)[0];
  const shop = Object.values(w.biz).find((b) => b.open && b.district === friend.district)!;
  const f = addFact(w, { kind: 'vandalism', actor: thug.id, victim: shop.ownerId, business: shop.id, text: `${thug.name}'s people smashed the window at ${shop.name}.`, textHidden: `Someone smashed the window at ${shop.name}.`, hiddenActor: true, district: shop.district }, { witnesses: [friend.id] });
  rel(friend, henry.id).trust = 0.7; rel(friend, henry.id).known = 0.6;
  P(`### Scenario A: asking ${first(friend.name)}, whom you trust, who smashed the window at ${shop.name}`);
  P('*One choice, one answer, an outcome.*'); P('');
  const v = new V(w, s, henry, friend, shop.name);
  v.offer([{ key: 'ask.who', note: 'Ask what he knows.', slots: { shop: shop.name } }, { key: 'spend.time', note: 'Spend the evening with him.' }, LEAVE]);
  v.pick('ask.who');
  v.him_(onWhoQuestion(perceive(w, s, friend), henry, f.id, thug));
  v.card('card.answer.who.knows', { actorFirst: first(thug.name) });
  P(`### Spend time with ${first(friend.name)}`);
  const a = spendTimeAccount(perceive(w, s, henry), perceive(w, s, friend), friend, 'Fino’s', compat(w, henry, friend));
  P(`> ${a.text}`); P('');
  const cold = Object.values(w.chars).filter((c) => c.alive && c.rank !== 'civilian' && !c.isPlayer && compat(w, henry, c) < -0.12).sort(byId)[0];
  if (cold) { P(`### Spend time with ${first(cold.name)}, with whom it doesn’t take`); P(`> ${spendTimeAccount(perceive(w, s, henry), perceive(w, s, cold), cold, 'the club', compat(w, henry, cold)).text}`); P(''); }
}

// ------------------------------------------------------------------ a contested request, argued within one visit
function captainOf(w: World, c: Character): Character | undefined { let x: Character | undefined = c; for (let i = 0; i < 6 && x; i++) { x = x.bossId ? w.chars[x.bossId] : undefined; if (x?.rank === 'capo') return x; } return undefined; }
export function ferraraWorld() {
  const w = createWorld(3, 'Henry Tedesco'), s = newSession(), henry = w.chars[w.playerId!];
  const riz = captainOf(w, henry)!; riz.name = 'Vic Rizzo';
  const lou = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId === henry.familyId && captainOf(w, c) && captainOf(w, c)!.id !== riz.id).sort(byId)[0]; lou.name = 'Lou Valenti';
  const their = captainOf(w, lou)!; their.name = 'Joe Marchese';
  const ground = crewGround(w, riz);
  const nate = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection && ground.has(ownerBiz(w, c.id)!.district)).sort(byId)[0]
    ?? Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection).sort(byId)[0];
  nate.name = 'Nate Ferrara'; ownerBiz(w, nate.id)!.name = 'Ferrara’s Grocery';
  rel(riz, henry.id).trust = 0.5; rel(nate, henry.id).trust = 0.5; rel(nate, henry.id).known = 0.4;
  const k: Captaincy = { groundHasFor: ground.has(ownerBiz(w, nate.id)!.district), forProtected: false, knowsTrouble: false, theirCaptain: their, asked: 0, agreed: false, done: false };
  return { w, s, henry, riz, lou, their, nate, k };
}
const ARG: Record<string, Row> = {
  ground: { key: 'argue.ground', note: 'Say what’s in it for the crew. He may want to know how you know.', slots: { againstFirst: 'Lou' } },
  word: { key: 'argue.word', note: 'Put your own word on it. It’s worth what he thinks of you.', slots: { forFirst: 'Nate' } },
  money: { key: 'argue.money', note: 'Make it business.', slots: { forFirst: 'Nate' } },
};
function ferrara() {
  P('## 5. A contested request: your captain, Nate Ferrara and Lou Valenti'); P('');
  P('*Henry promised Nate Ferrara he would raise Lou Valenti’s shakedown with the family. Vic Rizzo is Henry’s captain; Joe Marchese is Lou’s. Within a visit Rizzo remembers what Henry has already argued; across visits, what has changed.*'); P('');
  const { w, s, henry, riz, lou, nate, k } = ferraraWorld();
  const slotsC = { forName: nate.name, againstName: lou.name };
  // Day 1: raising it, and arguing it
  P('### Day 1: raising it, and arguing it');
  let v = new V(w, s, henry, riz, 'the club', 2);
  v.offer([{ key: 'ask.intervention', note: 'Ask him to take it up with the family.', slots: slotsC }, { key: 'spend.time', note: 'Leave Nate for another day.' }, LEAVE]);
  v.pick('ask.intervention');
  let args: ('ground' | 'word' | 'money')[] = [];
  let r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, args, v.mem);
  v.him_(r);
  for (const arg of ['ground', 'word', 'money'] as const) {
    const avail = r.nextArgs.map((a) => ARG[a]);
    if (!avail.length) break;
    v.offer([...avail, { key: 'let.go', note: 'Let it go for now.' }]);
    v.pick(ARG[arg].key);
    v.mem.argued.push(arg); args = [...args, arg];
    r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, args, v.mem);
    const reply: Reply = r.meaning.key === 'refuse.intervention' ? { ...r, meaning: { ...r.meaning, key: r.argReplies.at(-1)!.key, grounds: undefined, slots: { ...r.meaning.slots, againstFirst: 'Lou', youFirst: first(henry.name) } } } : { ...r, meaning: { ...r.meaning, slots: { ...r.meaning.slots, youFirst: first(henry.name) } } };
    v.him_(reply);
    if (r.meaning.key === 'cutOff.argument') break;
  }
  v.card(r.meaning.key === 'cutOff.argument' ? 'card.cutOff.argument' : r.meaning.key === 'condition.intervention' ? 'card.condition.intervention' : 'card.refuse.intervention', { forFirst: 'Nate', againstFirst: 'Lou' });
  // Day 3: Nate, waiting
  w.now += 2 * DAY;
  P('### Day 3: Nate, still waiting');
  v = new V(w, s, henry, nate, 'Ferrara’s Grocery');
  v.him_(onReturnToPromisee(perceive(w, s, nate), henry, false, 2));
  v.offer([{ key: 'report.refusedSoFar', note: 'Tell him the truth: the captain won’t move yet.' }, { key: 'report.stall', note: 'Put him off.' }, LEAVE]);
  v.pick('report.refusedSoFar');
  v.him_(onReport(perceive(w, s, nate), henry, 'honest'));
  // something changes, without Henry
  w.now += 1 * DAY;
  const book = Object.values(w.biz).find((b) => b.open && b.protection && captainOf(w, w.chars[b.protection.collectorId])?.id === riz.id) ?? Object.values(w.biz).find((b) => b.open && b.protection?.collectorId === riz.id);
  if (book) {
    const f = addFact(w, { kind: 'vandalism', actor: lou.id, victim: book.ownerId, business: book.id, text: `${lou.name}'s people smashed up ${book.name}.`, district: book.district }, {});
    learn(w, riz.id, f, w.chars[book.protection!.collectorId].id, true);
    k.knowsTrouble = true; k.trouble = { shop: book.name };
    P(`*Day 4. Without Henry: Lou’s people smash up ${book.name}, a shop on Rizzo’s own book. The man who collects there tells Rizzo.*`); P('');
  }
  // Day 5: back to Rizzo
  w.now += 1 * DAY;
  P('### Day 5: back to Rizzo, after something has changed');
  v = new V(w, s, henry, riz, 'the club', 2);
  P('*He raises it before you can.*');
  v.him_({ decision: { by: riz.id, constraints: [], candidates: [], chosen: 'raise.newinfo', aim: 'his own: Lou on his book' }, meaning: { key: 'raise.newinfo', stance: 'cold', toward: 'third', slots: { hitShop: k.trouble?.shop ?? '', againstFirst: 'Lou' } }, intent: 'inform', honest: true });
  v.offer([{ key: 'raise.again', note: 'Bring Nate into it.', slots: { forFirst: 'Nate', againstFirst: 'Lou' } }, LEAVE]);
  v.pick('raise.again');
  r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, [], v.mem);
  v.him_(r);
  if (r.decision.chosen === 'accept') { k.agreed = true; v.card('card.accept.intervention.liable', { theirCaptainFirst: 'Joe' }); }
  // Days 7–9: asking again
  for (const [day, label] of [[7, 'Day 7: asking how it’s going'], [8, 'Day 8: asking again'], [9, 'Day 9: and again']] as [number, string][]) {
    w.now = 9 * DAY + day * DAY;
    P(`### ${label}`);
    v = new V(w, s, henry, riz, 'the club');
    k.asked++;
    v.offer([{ key: 'ask.progress', note: 'Ask whether he’s done it.', slots: { theirCaptainFirst: 'Joe', forFirst: 'Nate' } }, LEAVE]);
    v.pick('ask.progress');
    v.him_(onProgressQuestion(perceive(w, s, riz), henry, nate, lou, k));
  }
  k.done = true;
  P('### Day 11: word from Rizzo, and Nate');
  P('*Rizzo has spoken to Marchese, and Marchese to Lou. Henry learns it the way he would: Rizzo sends word with one of his men.*'); P('');
  P(`> *A message from Rizzo:* ${render({ key: 'answer.progress.done', stance: 'flat', toward: 'speaker', slots: { theirCaptainFirst: 'Joe', againstFirst: 'Lou', forFirst: 'Nate' } }, riz.id, perceive(w, s, riz).arch)}`); P('');
  v = new V(w, s, henry, nate, 'Ferrara’s Grocery');
  v.him_(onReturnToPromisee(perceive(w, s, nate), henry, true, 10));
  v.offer([{ key: 'report.done', note: 'Tell him you took it to the family.' }, LEAVE]);
  v.pick('report.done');
  v.him_(onReport(perceive(w, s, nate), henry, 'done'));
  v.card('card.kept', {});
}

// ------------------------------------------------------------------ an unfamiliar situation: a loan, and news he hasn't heard
function loan() {
  P('## 6. Unfamiliar ground: asking a man you barely know for a loan'); P('');
  P('*Not one of the worked examples. The same engine: what he can’t do, what each answer is worth to him from what he believes of Henry, a reason, and replies to that reason. Lines come from the general banks where no specific one exists.*'); P('');
  const w = createWorld(11, 'Henry Tedesco'), s = newSession(), henry = w.chars[w.playerId!];
  const lender = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId === henry.familyId && !c.isPlayer && c.cash > 1500).sort(byId)[0] ?? Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && !c.isPlayer).sort(byId)[0];
  lender.cash = Math.max(lender.cash, 2500);
  rel(lender, henry.id).known = 0.15; rel(lender, henry.id).trust = 0.2;
  P(`### ${lender.name}, a soldier Henry has met once`);
  const v = new V(w, s, henry, lender, 'the club');
  v.offer([{ key: 'ask.loan', note: 'Ask him for money, on the usual terms.', slots: { amt: '$500' } }, { key: 'tell.news', note: 'Tell him what happened at the Gilded Lily.', slots: { topic: 'the Gilded Lily' } }, LEAVE]);
  v.pick('ask.loan');
  let r = onLoanRequest(perceive(w, s, lender), henry, 500, v.mem);
  v.him_(r);
  v.offer([...r.followups.map((f) => ({ key: f.key, note: f.note, slots: f.slots })), LEAVE]);
  v.pick('argue.reputation');
  r = onLoanRequest(perceive(w, s, lender), henry, 500, v.mem, { reputation: true });
  v.him_(r);
  v.offer([...r.followups.map((f) => ({ key: f.key, note: f.note, slots: f.slots })), LEAVE]);
  v.pick('sweeten.rate');
  r = onLoanRequest(perceive(w, s, lender), henry, 500, v.mem, { reputation: true, rate: 0.08 });
  v.him_(r);
  if (r.counter) {
    v.offer([...r.followups.map((f) => ({ key: f.key, note: f.note, slots: f.slots })), LEAVE]);
    if (r.followups.some((f) => f.key === 'accept.counter.loan')) { v.pick('accept.counter.loan'); v.card('card.agreed.loan', { amt: `$${r.counter.amt}`, rate: String(Math.round(r.counter.rate * 100)) }); }
  } else if (r.decision.chosen === 'accept') v.card('card.agreed.loan', { amt: '$500', rate: '8' });
  else v.card('card.refuse.loan', { groundsWords: r.meaning.grounds === 'doesNotKnow' ? 'he doesn’t know you well enough' : r.meaning.grounds === 'cannotSpare' ? 'he hasn’t got it to spare' : 'he’d like to see his money again' });
  P(`### The same man, told something he hasn’t heard`);
  const v2 = new V(w, s, henry, lender, 'the club');
  v2.offer([{ key: 'tell.news', note: 'Tell him what happened at the Gilded Lily.', slots: { topic: 'the Gilded Lily' } }, LEAVE]);
  v2.pick('tell.news');
  v2.him_(onUnknownTopic(perceive(w, s, lender), henry, 'the window at the Gilded Lily'));
}


// ------------------------------------------------------------------ 7. deception, believed and then found out
// What follows a confrontation, as Henry can know it: an admission returns the money and costs the man more of Henry's trust than
// a denial does. A denial leaves Henry holding two accounts; the truth settles nothing here.
export function settleConfrontation(w: World, henry: Character, man: Character, admits: boolean, kept: number, otherFirst: string) {
  if (admits) { man.cash -= kept; henry.cash += kept; feel(w, henry, man.id, 'trust', -0.2, `${man.name} lied about ${otherFirst}'s money`); }
  else feel(w, henry, man.id, 'trust', -0.1, `${man.name}'s account and ${otherFirst}'s don't agree`);
}
export function deceptionWorld(pick: number, trouble: 0 | 1 | 2 = 2) {
  const w = createWorld(7, 'Henry Tedesco'), s = newSession(), henry = w.chars[w.playerId!], store = new ClaimStore();
  henry.cash = 5000; recruitProspect(w, henry, prospects(w, henry)[pick].c);
  const joey = Object.values(w.chars).find((c) => c.bossId === henry.id)!;
  const gino = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open).sort(byId)[2]; gino.name = 'Gino Bruno';
  createDebt(w, henry.id, gino.id, 400, 0.05, 'a private loan');
  // Joey's own trouble: money he owes and has missed (his reason, which only he knows)
  const shark = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId !== henry.familyId).sort(byId)[2];
  if (trouble) {
  createDebt(w, shark.id, joey.id, 300, 0.1, 'a private loan');
  addFact(w, { kind: 'debt_missed', actor: joey.id, victim: shark.id, amount: 60, text: `${joey.name} missed a $60 payment to ${shark.name}.`, district: joey.district }, { witnesses: [] });
  }
  if (trouble === 2) {
  addFact(w, { kind: 'debt_missed', actor: joey.id, victim: shark.id, amount: 60, text: `${joey.name} missed another payment to ${shark.name}.`, district: joey.district }, { witnesses: [] });
  joey.cash = 30;
  }
  rel(henry, joey.id).trust = 0.6; rel(henry, joey.id).known = 0.5; rel(henry, gino.id).trust = 0.35; rel(henry, gino.id).known = 0.3;
  return { w, s, henry, store, joey, gino, shark };
}
function deception() {
  P('## 7. Deception: a man with a reason to lie, believed, then found out'); P('');
  P('*Henry sends one of his men to collect $200 from a barber who owes him. The man he sends is in trouble of his own: he owes a loan shark and has missed two payments, and he has $30 on him. Whether he lies is his own decision, from his own state and temperament; nobody scripts it. What he says is a claim; Henry judges it from what Henry knows, which does not include the truth. Later the barber tells his side.*'); P('');
  P('### Who lies? The same job, given in turn to each of the six young men Henry could have taken on, with and without trouble of his own');
  P('*Each cell: what he does, and the margin between the two choices (skimming’s value minus honesty’s; above zero he skims).*'); P('');
  P('| Man | Manner | Greed | Empathy | No debts | Owes a shark, missed one payment | Missed two, $30 to his name |'); P('|---|---|---|---|---|---|---|');
  let liar = -1;
  const said = (r: ReturnType<typeof onCollectionReport>) => { const v = (m: string) => r.decision.candidates.find((c) => c.move === m)!.value; const d = Math.round((v('skim') - v('honest')) * 100) / 100; return `${r.honest ? 'all $200' : `**keeps $${r.keeps}**`} (${d >= 0 ? '+' : ''}${d})`; };
  for (let i = 0; i < 6; i++) {
    const [a, m, b] = ([0, 1, 2] as const).map((tr) => { const x = deceptionWorld(i, tr); x.joey.cash += 200; return { x, r: onCollectionReport(perceive(x.w, x.s, x.joey), x.henry, x.gino, 200) }; });
    if (!b.r.honest && liar < 0) liar = i;
    P(`| ${b.x.joey.name} | ${perceive(b.x.w, b.x.s, b.x.joey).arch} | ${b.x.joey.traits.greed.toFixed(2)} | ${perceive(b.x.w, b.x.s, b.x.joey).temper.empathy.toFixed(2)} | ${said(a.r)} | ${said(m.r)} | ${said(b.r)} |`);
  }
  P('');
  { const x = deceptionWorld(liar < 0 ? 0 : liar); x.joey.cash += 200; const r = onCollectionReport(perceive(x.w, x.s, x.joey), x.henry, x.gino, 200); traceLines(o, `the full decision, for ${x.joey.name} in the worst of it`, r.decision.candidates.map((c) => `${c.move === r.decision.chosen ? '▶' : ' '} ${c.move} = ${c.value}: ${c.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`)); }
  if (liar < 0) { P('*None of the six lied. (The sequence below needs one who does.)*'); return; }
  const { w, s, henry, store, joey, gino } = deceptionWorld(liar);
  P(`*Following ${joey.name}, the first of them who decides to skim.*`); P('');
  const fJ = first(joey.name);
  P('### Day 1: the job');
  let v = new V(w, s, henry, joey, 'the club');
  v.offer([{ key: 'order.collect', note: 'Send him to collect. He’ll come back and tell you how it went.', slots: { debtorFirst: 'Gino', amt: '$200' } }, LEAVE]);
  v.pick('order.collect');
  // the world: Gino pays $200, to ${fJ}; Henry is not there
  const paidFact = addFact(w, { kind: 'debt_paid', actor: gino.id, victim: henry.id, amount: 200, text: `${gino.name} paid ${joey.name} $200 against what he owes ${henry.name}.`, district: gino.district, minor: true }, { witnesses: [joey.id] });
  gino.cash = Math.max(0, gino.cash - 200); joey.cash += 200;
  P(`*That afternoon, in Henry’s absence: Gino pays ${fJ} $200. (A fact Gino and ${fJ} know; Henry doesn’t.)*`); P('');
  P(`### Day 1, evening: ${fJ} reports back`);
  v = new V(w, s, henry, joey, 'the club');
  const rep = onCollectionReport(perceive(w, s, joey), henry, gino, 200);
  v.him_(rep);
  joey.cash -= rep.says; henry.cash += rep.says;
  const c1 = store.add({ by: joey.id, to: henry.id, subject: 'paid:gino', value: rep.says, t: w.now, honest: rep.honest, words: 'Gino paid ' + rep.says });
  const b1 = believe(perceive(w, s, henry), store, c1, joey);
  traceLines(o, 'what Henry makes of it', [`Henry’s belief in ${fJ}’s account: ${b1.belief} (${b1.basis.join('; ')})`, `Henry has no access to what ${fJ} did; the truth ($200) is in Gino’s and ${fJ}’s knowledge only (fact ${paidFact.id})`]);
  v.offer([{ key: 'accept.report', note: 'Take his word for it.' }, { key: 'ask.again', note: 'Make him tell it again. A story told twice can slip.' }, LEAVE]);
  v.pick('accept.report');
  v.card('card.report.collection', { debtorFirst: 'Gino', amt: `$${rep.says}` });
  // Day 3: the other side of it
  w.now += 2 * DAY;
  P('### Day 3: Henry calls on Gino about the rest');
  v = new V(w, s, henry, gino, 'the barbershop');
  v.offer([{ key: 'ask.debt', note: 'Ask about what he owes.' }, LEAVE]);
  v.pick('ask.debt');
  v.him_(onDebtQuestion(perceive(w, s, gino), henry, 200, joey, 'Tuesday'));
  store.add({ by: gino.id, to: henry.id, subject: 'paid:gino', value: 200, t: w.now, honest: true, words: 'I paid your man 200' });
  const cx = contradictions(perceive(w, s, henry), store);
  traceLines(o, 'what Henry now holds', cx.length ? cx.map((x) => `contradiction on "${x.subject}": ${w.chars[x.a.by].name} says ${x.a.value}; ${w.chars[x.b.by].name} says ${x.b.value}. Henry holds both; which he believes is his own judgement (trust: ${fJ} ${rel(henry, joey.id).trust}, Gino ${rel(henry, gino.id).trust})`) : ['no contradiction: the two accounts agree']);
  v.card('card.answer.debt.paid', { amt: '$200', toFirst: fJ });
  // Day 4: the confrontation, offered only because Henry holds a contradiction
  w.now += 1 * DAY;
  P(`### Day 4: back to ${fJ}`);
  v = new V(w, s, henry, joey, 'the club');
  const rows: Row[] = [];
  if (contradictions(perceive(w, s, henry), store).length) rows.push({ key: 'confront.claim', note: 'Put Gino’s word to him.', slots: { otherFirst: 'Gino', amt: '$200' } });
  rows.push({ key: 'spend.time', note: 'Leave it. Have a drink with him instead.' }, LEAVE);
  v.offer(rows);
  v.pick('confront.claim');
  const cf = onConfrontation(perceive(w, s, joey), henry, !rep.honest, 0.6);
  v.him_(cf);
  settleConfrontation(w, henry, joey, cf.admits, rep.keeps, 'Gino');
  traceLines(o, 'consequences', cf.admits ? [`${fJ} hands over the $${rep.keeps} he kept`, `Henry’s trust in ${fJ} falls (core.feel, with the reason: he lied about Gino’s money)`, `The lie is on record as a false claim ${fJ} made to Henry`] : [`${fJ} holds to his story. Henry still holds two accounts that disagree, and his trust in ${fJ} falls (core.feel). Nothing is settled by the truth; Henry can check further, or let it go`]);
  v.card(cf.admits ? 'card.confront.admit' : 'card.confront.deny', { amt: `$${rep.keeps}` });
}

// ------------------------------------------------------------------ 8. four kinds of promise, and what makes each kept or broken
const PROMISE_ROWS: Row[] = [
  { key: 'promise.action', note: 'You’re promising to raise it with him, not that it will work.' },
  { key: 'promise.effort', note: 'You’re saying you’ll try, not that you’ll manage it.' },
  { key: 'promise.result', note: 'You’re promising it will stop. He’ll hold you to that.' },
  { key: 'promise.restraint', note: 'You won’t tell anyone he came to you.' },
  LEAVE,
];
function promiseRun(title: string, type: ObType, story: (ctx: { w: World; s: Session; henry: Character; riz: Character; lou: Character; nate: Character; k: Captaincy; obs: Obligations; ob: ReturnType<Obligations['make']>; log: (x: string) => void }) => void) {
  P(`### ${title}`);
  const { w, s, henry, riz, lou, nate, k } = ferraraWorld();
  w.now = 9 * DAY;
  const obs = new Obligations();
  const v = new V(w, s, henry, nate, 'Ferrara’s Grocery');
  v.him_({ decision: { by: nate.id, constraints: [], candidates: [], chosen: 'seekHelp', aim: 'get someone to make Lou stop' }, meaning: { key: 'seek.help', stance: 'pleading', toward: 'third' }, intent: 'ask', honest: true });
  v.offer(PROMISE_ROWS);
  v.pick('promise.' + type);
  v.him_(onPromise(perceive(w, s, nate), henry, type));
  const nateBiz = ownerBiz(w, nate.id)!;
  const spec = type === 'action' ? { kind: 'actionDone' as const, act: 'raise', target: riz.id, about: 'lou-nate' }
    : type === 'effort' ? { kind: 'effort' as const, acts: ['raise', 'warn', 'askOther'], about: 'lou-nate', floor: 0.15 }
    : type === 'result' ? { kind: 'noHostility' as const, actor: lou.id, target: nate.id, biz: nateBiz.id, days: 30 }
    : { kind: 'notDisclosedBy' as const, about: 'nate-complained' };
  const ob = obs.make({ type, obligor: henry.id, beneficiary: nate.id, spec, from: w.now, by: w.now + (type === 'result' ? 30 : 14) * DAY });
  const timeline: string[] = [`day ${Math.floor(w.now / DAY) - 9}: promise recorded (${type}); window to day ${Math.floor(ob.by / DAY) - 9}`];
  const log = (x: string) => timeline.push(`day ${Math.floor(w.now / DAY) - 9}: ${x}`);
  story({ w, s, henry, riz, lou, nate, k, obs, ob, log });
  traceLines(o, 'the promise, tracked (internal: none of this is on the player’s screen)', [...timeline, `status: ${ob.status}${ob.why ? ' (' + ob.why + ')' : ''}`]);
}
function promises() {
  P('## 8. Four kinds of promise, kept or broken by what happens'); P('');
  P('*Nate asks for help. Henry’s four possible answers are each a different promise, worded as a man would say it; the note under each says what he is undertaking, in plain words. What follows is the world: who does what, and when. The promise is judged by what it actually undertook (spec §6.3, §6.5).*'); P('');
  const day = (w: World, n: number) => { w.now = 9 * DAY + n * DAY; };
  const raise = (c: { w: World; s: Session; henry: Character; riz: Character; nate: Character; lou: Character; k: Captaincy; obs: Obligations; log: (x: string) => void }) => {
    const pred = predictAcceptance(perceive(c.w, c.s, c.henry), c.riz, false);
    const v = new V(c.w, c.s, c.henry, c.riz, 'the club');
    v.offer([{ key: 'ask.intervention', note: 'Ask him to take it up with the family.', slots: { forName: c.nate.name, againstName: c.lou.name } }, LEAVE]);
    v.pick('ask.intervention');
    const r = onIntervention(perceive(c.w, c.s, c.riz), c.henry, c.nate, c.lou, c.k, [], v.mem); v.him_(r);
    c.obs.did({ t: c.w.now, actor: c.henry.id, act: 'raise', target: c.riz.id, about: 'lou-nate', predicted: pred });
    c.log(`Henry raised it with Rizzo (Henry expected a ${pred} chance he would agree); Rizzo ${r.decision.chosen === 'accept' ? 'agreed' : 'refused'}`);
    return r;
  };
  promiseRun('An action promise, kept: “I’ll speak to my captain about it.” Rizzo says no; the promise was to speak to him, and Henry did', 'action', (c) => {
    day(c.w, 2); raise(c); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
  });
  promiseRun('An action promise, broken by a good outcome: Lou stops by himself, but Henry never spoke to his captain', 'action', (c) => {
    day(c.w, 6); c.log('Lou’s people stop coming round (no word from anyone; nothing happens at the shop)');
    day(c.w, 15); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
    day(c.w, 16);
    const v = new V(c.w, c.s, c.henry, c.nate, 'Ferrara’s Grocery');
    v.him_(onReturnToPromisee(perceive(c.w, c.s, c.nate), c.henry, true, 16));
    v.offer([{ key: 'report.admitNotDone', note: 'Tell him the truth: you never got to it.' }, { key: 'report.done', note: 'Take the credit. It isn’t true.' }, LEAVE]);
    v.pick('report.admitNotDone');
    v.him_(onReport(perceive(c.w, c.s, c.nate), c.henry, 'admitNotDone'));
    c.log('Nate had believed Henry did it (he saw Lou stop, and Henry had promised); the obligation was broken all the same, and now he knows');
  });
  promiseRun('An effort promise, kept by a failed attempt: “I’ll do what I can.” Rizzo refuses; Henry tried', 'effort', (c) => {
    day(c.w, 2); raise(c); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
  });
  promiseRun('An effort promise, not kept by a gesture: Henry only mentions it to a shopkeeper who has no say', 'effort', (c) => {
    day(c.w, 3);
    const shopkeeper = Object.values(c.w.chars).filter((x) => x.alive && x.rank === 'civilian' && x.id !== c.nate.id && ownerBiz(c.w, x.id)?.open).sort(byId)[3];
    c.obs.did({ t: c.w.now, actor: c.henry.id, act: 'askOther', target: shopkeeper.id, about: 'lou-nate', predicted: predictAcceptance(perceive(c.w, c.s, c.henry), shopkeeper, false) * 0.1 });
    c.log(`Henry mentions it to ${shopkeeper.name}, who has no say over Lou (Henry had no reason to think it would help)`);
    day(c.w, 24); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
  });
  promiseRun('A result promise, broken at the first violation: “I’ll make sure he leaves you alone.” Lou’s people are back on day 12', 'result', (c) => {
    day(c.w, 2); raise(c);
    day(c.w, 10); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`); c.log(`still ${c.ob.status}: ten clean days are not thirty`);
    day(c.w, 12);
    addFact(c.w, { kind: 'vandalism', actor: c.lou.id, victim: c.nate.id, business: ownerBiz(c.w, c.nate.id)!.id, text: `${c.lou.name}'s people smashed the window at Ferrara’s Grocery.`, district: ownerBiz(c.w, c.nate.id)!.district }, { witnesses: [c.nate.id] });
    c.log('Lou’s people smash the window at Ferrara’s Grocery');
    for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to} on day 12, not day 30: ${t.why}`);
    day(c.w, 13);
    const v = new V(c.w, c.s, c.henry, c.nate, 'Ferrara’s Grocery');
    v.him_(onPromiseSeenBroken(perceive(c.w, c.s, c.nate), c.henry));
  });
  promiseRun('A result promise, kept only when the whole period has passed', 'result', (c) => {
    day(c.w, 20); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`); c.log(`day 20, nothing has happened: still ${c.ob.status}`);
    day(c.w, 31); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
  });
  promiseRun('A restraint promise, kept although the secret got out another way: “I won’t tell a soul you came to me.”', 'restraint', (c) => {
    day(c.w, 4);
    const witness = Object.values(c.w.chars).filter((x) => x.alive && x.rank === 'civilian' && x.id !== c.nate.id).sort(byId)[5];
    addFact(c.w, { kind: 'rumour', actor: c.nate.id, text: `${c.nate.name} has been complaining about ${c.lou.name} to Henry Tedesco.`, district: ownerBiz(c.w, c.nate.id)!.district, minor: true }, { witnesses: [c.lou.id] });
    c.log(`${witness.name}’s cousin saw Nate and Henry together; it reaches Lou by itself. Henry told nobody`);
    for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
    day(c.w, 16); for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
  });
  promiseRun('A restraint promise, broken: Henry tells Lou himself', 'restraint', (c) => {
    day(c.w, 5);
    const v = new V(c.w, c.s, c.henry, c.lou, 'the club');
    v.offer([{ key: 'tell.secret', note: 'Tell him who complained. You gave Nate your word you wouldn’t.' }, LEAVE]);
    v.pick('tell.secret');
    v.him_({ decision: { by: c.lou.id, constraints: [], candidates: [], chosen: 'acknowledge', aim: 'remember it' }, meaning: { key: 'react.told', stance: 'cold', toward: 'third' }, intent: 'acknowledge', honest: true, changes: [`${c.lou.name} now knows Nate complained (from Henry)`] });
    c.obs.did({ t: c.w.now, actor: c.henry.id, act: 'inform', target: c.lou.id, about: 'nate-complained' });
    for (const t of c.obs.tick(c.w)) c.log(`→ ${t.to}: ${t.why}`);
  });
}

export function buildTranscripts(): string {
  o = new Out();
  P('# Gate 1: generated conversations (third pass)');
  P('');
  P('*Produced by `npx tsx src/conv/gate1.ts` from the proof-of-concept engine in `src/conv/`. Every line spoken by a character other than Henry is rendered from a decision and its meaning; every line of Henry’s is one of the rows that was on screen (the harness refuses anything else). Outcome cards say only what was said or seen, attributed. Names are fixtures; the men behind them are ordinary characters of a generated world.*');
  P('');
  bakery(); compliment(); doorAndClaims(); simple(); ferrara(); loan(); deception(); promises(); generalisation(o);
  return o.text();
}
if (process.argv[1]?.endsWith('gate1.ts')) {
  const text = buildTranscripts();
  mkdirSync('docs/gate1', { recursive: true });
  writeFileSync('docs/gate1/TRANSCRIPTS.md', text);
  console.log('wrote docs/gate1/TRANSCRIPTS.md', text.split('\n').length, 'lines');
}
