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
import { EncounterMemory } from './encounter';
import { onAnnouncement, onArrival, onAuthorityClaim, onIntervention, onIntroduction, onLoanRequest, onProgressQuestion, onProtectionDemand, onReport, onReturnToPromisee, onUnknownTopic, onWait, onWhoQuestion, spendTimeAccount, type Captaincy, type Reply } from './respond';
import type { Meaning, Spoken } from './types';

const out: string[] = [];
const P = (s = '') => out.push(s);
const first = (n: string) => n.split(' ')[0];
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const famOf = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : '');
interface Row { key: string; note: string; slots?: Record<string, string>; leave?: boolean }

// One visit: its transcript, its memory, the lines already said (never twice), and the rows on screen right now.
class Visit {
  spoken = new Set<string>(); n = 0; rows: Row[] = []; mem: EncounterMemory;
  constructor(public w: World, public s: Session, public henry: Character, public him: Character, public where: string, patience = 2) { this.mem = new EncounterMemory(patience); }
  private slots(x: Record<string, string> = {}) { return { selfName: this.henry.name, selfFamily: famOf(this.w, this.henry), ...x }; }
  label(r: Row) { return r.leave ? 'Leave' : render({ key: r.key, stance: 'flat', toward: 'speaker', slots: this.slots(r.slots) }, this.henry.id, 'earnest'); }
  offer(rows: Row[]) {
    this.rows = rows.length > 5 ? rows.slice(0, 5) : rows;
    P(''); P('> **What you can say**');
    for (const r of this.rows) P(r.note ? `> - ${this.label(r)}  \n>   *${r.note}*` : `> - ${this.label(r)}`);
    P('');
  }
  // the player picks a row that is on screen, or the harness stops: a transcript is only valid if every choice was offered
  pick(key: string, opts: { act?: string; explicit?: 0 | 1 | 2 } = {}): Spoken {
    const r = this.rows.find((x) => x.key === key);
    if (!r) throw new Error(`choice "${key}" was not on screen (offered: ${this.rows.map((x) => x.key).join(', ')})`);
    const m: Meaning = { key: r.key, stance: 'flat', toward: 'speaker', slots: this.slots(r.slots) };
    P(`**You:** ${render(m, this.henry.id, 'earnest', this.spoken)}`);
    this.rows = [];
    return { speaker: this.henry.id, listener: this.him.id, act: opts.act ?? key, explicit: opts.explicit ?? 2, meaning: m, where: this.where, at: this.w.now + this.n++ };
  }
  him_(r: Reply, extra?: { heard?: ReturnType<typeof interpret>; trace?: string[] }) {
    const p = perceive(this.w, this.s, this.him);
    P(`**${first(this.him.name)}:** ${render(r.meaning, this.him.id, p.arch, this.spoken, String(this.n))}`);
    trace(r, extra);
  }
  card(key: string, slots: Record<string, string>, more = '') { P(`> **Outcome:** ${render({ key, stance: 'flat', toward: 'speaker', slots: { first: first(this.him.name), ...slots } }, 'card', 'earnest')}${more ? ' ' + more : ''}`); P(''); }
}
function trace(r: Reply, extra?: { heard?: ReturnType<typeof interpret>; trace?: string[] }) {
  const d = r.decision, lines: string[] = [];
  if (extra?.heard) { const h = extra.heard; lines.push(`heard as: ${h.act} (confidence ${h.confidence}${h.literal ? ', taken literally' : ''})`); for (const c of h.cues) lines.push(`  cue: ${c.kind} (${c.weight >= 0 ? '+' : ''}${c.weight}; basis: ${c.basis.kind}${c.basis.ref ? ' ' + c.basis.ref : ''})`); }
  if (d.constraints.length) lines.push(`constraints: ${d.constraints.map((c) => `${c.kind} (${c.source})`).join('; ')}`);
  for (const c of [...d.candidates].sort((a, b) => b.value - a.value)) if (c.value > -9) lines.push(`${c.move === d.chosen ? '▶' : ' '} ${c.move} = ${c.value}${c.crosses.length ? ` [would cross: ${c.crosses.join(', ')}]` : ''}: ${c.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`);
  if (d.grounds) lines.push(`reason given: ${d.grounds.factor}${d.grounds.honest ? '' : ' (a cover: not his real reason)'}`);
  lines.push(`meaning: ${r.meaning.key}${r.meaning.grounds ? '.' + r.meaning.grounds : ''} · ${r.meaning.stance} · toward ${r.meaning.toward}${r.meaning.implies && r.meaning.implies !== 'none' ? ` · implies ${r.meaning.implies}` : ''} · private intent: ${r.intent}${r.aim ? ` · aim: ${r.aim}` : ''}`);
  for (const c of r.changes ?? []) lines.push(`change: ${c}`);
  for (const t of extra?.trace ?? []) lines.push(t);
  P(''); P('<details><summary>trace</summary>'); P(''); P('```'); for (const l of lines) P(l); P('```'); P('</details>'); P('');
}
const LEAVE: Row = { key: 'leave', note: '', leave: true };

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
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
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
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
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
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
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
  const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
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
  const v = new Visit(w, s, henry, friend, shop.name);
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
function ferraraWorld() {
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
  let v = new Visit(w, s, henry, riz, 'the club', 2);
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
  v = new Visit(w, s, henry, nate, 'Ferrara’s Grocery');
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
  v = new Visit(w, s, henry, riz, 'the club', 2);
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
    v = new Visit(w, s, henry, riz, 'the club');
    k.asked++;
    v.offer([{ key: 'ask.progress', note: 'Ask whether he’s done it.', slots: { theirCaptainFirst: 'Joe', forFirst: 'Nate' } }, LEAVE]);
    v.pick('ask.progress');
    v.him_(onProgressQuestion(perceive(w, s, riz), henry, nate, lou, k));
  }
  k.done = true;
  P('### Day 11: word from Rizzo, and Nate');
  P('*Rizzo has spoken to Marchese, and Marchese to Lou. Henry learns it the way he would: Rizzo sends word with one of his men.*'); P('');
  P(`> *A message from Rizzo:* ${render({ key: 'answer.progress.done', stance: 'flat', toward: 'speaker', slots: { theirCaptainFirst: 'Joe', againstFirst: 'Lou', forFirst: 'Nate' } }, riz.id, perceive(w, s, riz).arch)}`); P('');
  v = new Visit(w, s, henry, nate, 'Ferrara’s Grocery');
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
  const v = new Visit(w, s, henry, lender, 'the club');
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
  const v2 = new Visit(w, s, henry, lender, 'the club');
  v2.offer([{ key: 'tell.news', note: 'Tell him what happened at the Gilded Lily.', slots: { topic: 'the Gilded Lily' } }, LEAVE]);
  v2.pick('tell.news');
  v2.him_(onUnknownTopic(perceive(w, s, lender), henry, 'the window at the Gilded Lily'));
}

P('# Gate 1: generated conversations (second pass)');
P('');
P('*Produced by `npx tsx src/conv/gate1.ts` from the proof-of-concept engine in `src/conv/`. Every line spoken by a character other than Henry is rendered from a decision and its meaning; every line of Henry’s is one of the rows that was on screen (the harness refuses anything else). Outcome cards say only what was said or seen, attributed. Names are fixtures; the men behind them are ordinary characters of a generated world.*');
P('');
bakery(); compliment(); doorAndClaims(); simple(); ferrara(); loan();
mkdirSync('docs/gate1', { recursive: true });
writeFileSync('docs/gate1/TRANSCRIPTS.md', out.join('\n'));
console.log('wrote docs/gate1/TRANSCRIPTS.md', out.length, 'lines');
