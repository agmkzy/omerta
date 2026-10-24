// Gate 1 (docs/CONVERSATION_SPEC.md §15): the language proof of concept. Every line below is produced by the engine from a
// decision and a meaning; nothing is a written scene. Run: npx tsx src/conv/gate1.ts  (writes docs/gate1/TRANSCRIPTS.md)
import { writeFileSync, mkdirSync } from 'node:fs';
import { createWorld } from '../world';
import { addFact, compat, learn, ownerBiz, rel } from '../core';
import { crewGround, setCollector } from '../econ';
import { DAY, type Character, type World } from '../types';
import { newSession, perceive, type Session } from './perception';
import { interpret } from './speech';
import { render } from './render';
import { onAnnouncement, onArrival, onAuthorityClaim, onIntervention, onIntroduction, onProgressQuestion, onProtectionDemand, onWait, onWhoQuestion, spendTimeAccount, type Captaincy, type Reply } from './respond';
import type { Meaning, Spoken } from './types';

const out: string[] = [];
const P = (s = '') => out.push(s);
const first = (n: string) => n.split(' ')[0];
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const famOf = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : '');

// One visit: the transcript, and the lines already said (no line is ever said twice in a visit).
class Visit {
  spoken = new Set<string>(); n = 0;
  constructor(public w: World, public s: Session, public henry: Character, public him: Character, public where: string) {}
  private sp(speaker: Character, listener: Character, act: string, explicit: 0 | 1 | 2, meaning: Meaning): Spoken { return { speaker: speaker.id, listener: listener.id, act, explicit, meaning, where: this.where, at: this.w.now + this.n++ }; }
  // the player says something: rendered from its meaning like anyone's line
  you(key: string, slots: Record<string, string> = {}, opts: { act?: string; explicit?: 0 | 1 | 2; note?: string } = {}): Spoken {
    const m: Meaning = { key, stance: 'flat', toward: 'speaker', slots: { selfName: this.henry.name, selfFamily: famOf(this.w, this.henry), ...slots } };
    const line = render(m, this.henry.id, 'earnest', this.spoken);
    P(`**You:** ${line}`);
    return this.sp(this.henry, this.him, opts.act ?? key, opts.explicit ?? 2, m);
  }
  // he answers: the decision's meaning, rendered in his manner, with the trace beneath it
  him_(r: Reply, extra?: { heard?: ReturnType<typeof interpret>; trace?: string[] }) {
    const p = perceive(this.w, this.s, this.him);
    const line = render(r.meaning, this.him.id, p.arch, this.spoken, String(this.n));
    P(`**${first(this.him.name)}:** ${line}`);
    trace(r, extra);
  }
  choices(rows: [string, string][]) {
    P('');
    P('> **What you can say**');
    for (const [l, n] of rows) P(n ? `> - ${l}  \n>   *${n}*` : `> - ${l}`);
    P('');
  }
}
function trace(r: Reply, extra?: { heard?: ReturnType<typeof interpret>; trace?: string[] }) {
  const d = r.decision, lines: string[] = [];
  if (extra?.heard) { const h = extra.heard; lines.push(`heard as: **${h.act}** (confidence ${h.confidence}${h.literal ? ', taken literally' : ''})`); for (const c of h.cues) lines.push(`  cue: ${c.kind} (${c.weight >= 0 ? '+' : ''}${c.weight}; basis: ${c.basis.kind}${c.basis.ref ? ' ' + c.basis.ref : ''})`); }
  if (d.constraints.length) lines.push(`constraints: ${d.constraints.map((c) => `${c.kind} (${c.source})`).join('; ')}`);
  for (const c of [...d.candidates].sort((a, b) => b.value - a.value)) if (c.value > -9) lines.push(`${c.move === d.chosen ? '▶' : ' '} ${c.move} = ${c.value}${c.crosses.length ? ` [would cross: ${c.crosses.join(', ')}]` : ''}: ${c.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`);
  if (d.grounds) lines.push(`reason given: ${d.grounds.factor}${d.grounds.honest ? '' : ' (a cover: not his real reason)'}`);
  lines.push(`meaning: ${r.meaning.key} · ${r.meaning.stance} · toward ${r.meaning.toward}${r.meaning.implies && r.meaning.implies !== 'none' ? ` · implies ${r.meaning.implies}` : ''} · private intent: ${r.intent}${r.aim ? ` · aim: ${r.aim}` : ''}`);
  for (const c of r.changes ?? []) lines.push(`change: ${c}`);
  for (const t of extra?.trace ?? []) lines.push(t);
  P('');
  P('<details><summary>trace</summary>');
  P('');
  P('```');
  for (const l of lines) P(l);
  P('```');
  P('</details>');
  P('');
}
const card = (text: string) => { P(`> **Outcome:** ${text}`); P(''); };

// ------------------------------------------------------------------ the bakery world and its five Franks
interface Profile { label: string; about: string; temper: Record<string, number>; arch: 'earnest' | 'proud' | 'bitter' | 'frightened' | 'schemer' | 'hothead' | 'cold'; setup: (w: World, s: Session, frank: Character, henry: Character) => void; then?: 'announce' | 'counter' | 'none' }
function bakeryWorld(seed: number) {
  const w = createWorld(seed, 'Henry Tedesco');
  const henry = w.chars[w.playerId!], s = newSession();
  const frank = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && ownerBiz(w, c.id)!.kind !== 'casino' && !ownerBiz(w, c.id)!.protection).sort(byId)[0];
  frank.name = 'Frank Russo';
  const b = ownerBiz(w, frank.id)!; b.name = 'Russo’s Bakery';
  w.now = 9 * DAY + 15 * 60; // a Tuesday afternoon
  return { w, s, henry, frank, b };
}
const PROFILES: Profile[] = [
  { label: 'Cautious', about: 'Careful by nature; pays a Corrente soldier for protection already.', arch: 'earnest', temper: { caution: 0.8, courage: 0.55, pride: 0.4, agreeable: 0.5, volatility: 0.3 },
    setup: (w, _s, frank) => { const col = Object.values(w.chars).filter((c) => c.alive && c.familyId === w.chars[w.playerId!].familyId && c.rank === 'soldier' && !c.isPlayer).sort(byId)[0]; col.name = 'Tommy Conti'; setCollector(w, ownerBiz(w, frank.id)!, col.id, col.familyId!, { fee: 25 }); }, then: 'announce' },
  { label: 'Proud', about: 'Proud and quick to anger; nobody protects him and he likes it that way.', arch: 'hothead', temper: { pride: 0.85, volatility: 0.7, courage: 0.8, caution: 0.25, agreeable: 0.3 }, setup: () => {} },
  { label: 'Desperate', about: 'Three bad weeks running; almost no cash; nobody protects him.', arch: 'bitter', temper: { pride: 0.3, agreeable: 0.6, courage: 0.45, caution: 0.5, volatility: 0.3 },
    setup: (w, _s, frank) => { const b = ownerBiz(w, frank.id)!; b.distress = 3; frank.cash = 60; }, then: 'counter' },
  { label: 'Frightened', about: 'Timid; a shop on his street was smashed up last week, and he saw it.', arch: 'frightened', temper: { courage: 0.15, caution: 0.6, pride: 0.25, agreeable: 0.6, volatility: 0.2 },
    setup: (w, _s, frank) => { const b = ownerBiz(w, frank.id)!; const other = Object.values(w.biz).find((x) => x.id !== b.id && x.district === b.district && x.open)!; const owner = w.chars[other.ownerId]; const thug = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && !c.isPlayer).sort(byId)[1]; w.now -= 6 * DAY; addFact(w, { kind: 'vandalism', actor: thug.id, victim: owner.id, business: other.id, text: `${thug.name}'s people smashed up ${other.name}.`, district: b.district }, { witnesses: [frank.id] }); w.now += 6 * DAY; } },
  { label: 'Connected', about: 'His cousin is a soldier in another family; nobody else protects him.', arch: 'schemer', temper: { caution: 0.6, pride: 0.5, courage: 0.55, agreeable: 0.45, volatility: 0.35 },
    setup: (w, s, frank, henry) => { const cous = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId && c.familyId !== henry.familyId).sort(byId)[0]; cous.name = 'Sal Russo'; (s.kin[frank.id] ??= []).push({ id: cous.id, role: 'cousin' }); } },
];

function bakery() {
  P('## 1. The bakery: a first visit, five different men');
  P('');
  P('Henry Tedesco (an associate of the Corrente family) walks into Russo’s Bakery for the first time. The same Henry, the same afternoon, the same words. Only the man behind the counter differs, as described. Every reply is the engine’s: a decision made from Frank’s own perception, then put into words.');
  P('');
  for (const pr of PROFILES) {
    const { w, s, henry, frank } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch;
    pr.setup(w, s, frank, henry);
    P(`### ${pr.label} Frank`);
    P(`*${pr.about}*`);
    P('');
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
    P(`*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*`);
    P('');
    v.him_(onArrival(perceive(w, s, frank), henry, 'three in the afternoon'));
    v.choices([['“Henry Tedesco. I’m with the Corrente family.”', 'Introduce yourself. He’ll know who you are from now on, for better or worse.'], ['“Nice place. You must do well here.”', 'Get to the point: protection. He doesn’t know you, and he owes you nothing.'], ['“Just a loaf, thanks.”', 'Buy something and leave it there. Next time you’re a face he knows.'], ['Leave', '']]);
    const intro = v.you('introduce.self');
    s.told[frank.id] = { [henry.id]: { family: famOf(w, henry), name: henry.name, basis: { kind: 'claimed', ref: 'introduced himself' } } };
    void intro;
    v.him_(onIntroduction(perceive(w, s, frank), henry, famOf(w, henry)));
    v.you('demand.protection', { amt: '$40' });
    const r = onProtectionDemand(perceive(w, s, frank), henry, 40, 'plain');
    v.him_(r);
    if (r.followups.length) v.choices(r.followups.map((f) => [render({ key: f.key, stance: 'flat', toward: 'speaker', slots: { selfName: henry.name, selfFamily: famOf(w, henry), day: 'Friday', amt: r.counterAmt ? `$${r.counterAmt}` : '' } }, henry.id, 'earnest'), f.note] as [string, string]).concat([['Leave', '']]));
    if (r.decision.chosen === 'refuse' && pr.then === 'announce') {
      v.you('announce.return', { day: 'Friday' }, { act: 'announce' });
      v.him_(onAnnouncement(perceive(w, s, frank), henry));
      card(`Frank turned you down. He says ${r.decision.grounds?.factor.startsWith('hasArrangement') ? 'he already has an arrangement' : 'he doesn’t know you'}. You said you’d be back Friday.`);
    } else if (r.decision.chosen === 'counter') {
      v.you('accept.counter', { amt: `$${r.counterAmt}` });
      card(`Agreed: $${r.counterAmt} a week from Russo’s Bakery, Fridays. He’ll expect the street to stay quiet.`);
    } else if (r.decision.chosen === 'accept') card('Agreed: $40 a week, Fridays. He agreed because he was afraid, and he won’t forget it.');
    else if (r.decision.chosen === 'refer') card('Frank sent you to his cousin Sal. Anything about the bakery goes through the Marchetti people, he says.');
    else card(`Frank refused. ${r.decision.chosen === 'dismiss' || r.meaning.grounds === 'pride' ? 'He told you to get out.' : 'He says he doesn’t know you.'}`);
  }
}

// ------------------------------------------------------------------ the indirect demand, read differently by different men
function compliment() {
  P('## 2. "Nice place. You must do well here."');
  P('');
  P('The same indirect remark, before Henry has said who he is. Whether Frank hears a demand depends only on what *he* knows: whether he pays someone, whether he has been asked before, what has happened on his street, how suspicious he is. Henry’s real intention is never visible to him.');
  P('');
  for (const pr of PROFILES) {
    const { w, s, henry, frank } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
    P(`### ${pr.label} Frank`);
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
    const sp = v.you('compliment.business', {}, { act: 'compliment', explicit: 0 });
    const heard = interpret(perceive(w, s, frank), sp, henry);
    if (heard.act === 'demand.protection') { const r = onProtectionDemand(perceive(w, s, frank), henry, 40, 'inferred'); v.him_(r, { heard }); }
    else { const p = perceive(w, s, frank); const r: Reply = { decision: { by: frank.id, constraints: [], candidates: [], chosen: 'reply' }, meaning: { key: 'reply.compliment', stance: 'polite', toward: 'speaker' }, intent: 'remark', honest: true }; void p; v.him_(r, { heard }); P('*He took it as a compliment. To ask for anything now, Henry has to say it plainly.*'); P(''); }
  }
}

// ------------------------------------------------------------------ turned away, and staying anyway; a false claim of authority
function doorAndClaims() {
  P('## 3. The door shut, "I’ll wait", and a claim of authority');
  P('');
  for (const label of ['Cautious', 'Frightened']) {
    const pr = PROFILES.find((x) => x.label === label)!;
    const { w, s, henry, frank, b } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
    // he has heard that Henry was turned away at the shop next door, and what followed
    const other = Object.values(w.biz).find((x) => x.id !== b.id && x.district === b.district && x.open)!;
    const o = w.chars[other.ownerId];
    addFact(w, { kind: 'protection_refused', actor: o.id, victim: henry.id, business: other.id, text: `${o.name} told ${henry.name} to get out of ${other.name}.`, district: b.district }, { witnesses: [] });
    learn(w, frank.id, Object.values(w.facts).find((f) => f.kind === 'protection_refused' && f.victim === henry.id)!, o.id, true);
    P(`### ${label} Frank, who has heard what happened next door`);
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
    v.him_(onArrival(perceive(w, s, frank), henry, 'three in the afternoon'));
    v.choices([['“Another time, then.”', 'Go, and come back another day.'], ['“I’ll wait.”', 'Stay where you are. He won’t like it.'], ['Leave', '']]);
    v.you('stay.wait', {}, { act: 'wait' });
    v.him_(onWait(perceive(w, s, frank), henry));
  }
  {
    const pr = PROFILES[0];
    const { w, s, henry, frank } = bakeryWorld(3);
    s.temper[frank.id] = pr.temper; s.arch[frank.id] = pr.arch; pr.setup(w, s, frank, henry);
    const cap = captainOf(w, henry)!;
    P(`### A false claim: "${cap.name} sent me" (Cautious Frank)`);
    P(`*Henry’s captain sent him nowhere. Frank can’t know that; he can only judge the claim from what he knows.*`);
    P('');
    const v = new Visit(w, s, henry, frank, 'Russo’s Bakery');
    v.you('claim.authority', { authority: cap.name }, { act: 'claim' });
    v.him_(onAuthorityClaim(perceive(w, s, frank), henry, cap), { trace: ['private (Henry): honest = false (his captain did not send him)'] });
  }
}

// ------------------------------------------------------------------ a straightforward request (simplicity scenario A) and an evening together
function simple() {
  P('## 4. A straightforward question, and an evening together');
  P('');
  const w = createWorld(7, 'Henry Tedesco'), s = newSession(), henry = w.chars[w.playerId!];
  const friend = Object.values(w.chars).filter((c) => c.alive && c.rank === 'associate' && !c.isPlayer && c.familyId === henry.familyId).sort(byId)[0];
  const thug = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId && c.familyId !== henry.familyId).sort(byId)[0];
  const shop = Object.values(w.biz).find((b) => b.open && b.district === friend.district)!;
  const f = addFact(w, { kind: 'vandalism', actor: thug.id, victim: shop.ownerId, business: shop.id, text: `${thug.name}'s people smashed the window at ${shop.name}.`, textHidden: `Someone smashed the window at ${shop.name}.`, hiddenActor: true, district: shop.district }, { witnesses: [friend.id] });
  rel(friend, henry.id).trust = 0.7; rel(friend, henry.id).known = 0.6;
  P(`### Scenario A: asking ${first(friend.name)}, whom you trust, who smashed the window at ${shop.name}`);
  P('*One choice, one answer, an outcome. No approach to pick and no follow-up menu.*');
  P('');
  const v = new Visit(w, s, henry, friend, shop.name);
  v.you('ask.who', { shop: shop.name });
  v.him_(onWhoQuestion(perceive(w, s, friend), henry, f.id, thug));
  card(`${first(friend.name)} says it was ${thug.name}’s people. He saw it.`);
  P(`### Spend time with ${first(friend.name)}`);
  const a = spendTimeAccount(perceive(w, s, henry), perceive(w, s, friend), friend, 'Fino’s', compat(w, henry, friend));
  P(`> ${a.text}`);
  P('');
  P(`<details><summary>trace</summary>\n\n\`\`\`\ncompatibility ${Math.round(compat(w, henry, friend) * 100) / 100}\n${a.changes.map((c) => 'change: ' + c).join('\n')}\n\`\`\`\n</details>\n`);
  const cold = Object.values(w.chars).filter((c) => c.alive && c.rank !== 'civilian' && !c.isPlayer && compat(w, henry, c) < -0.12).sort(byId)[0];
  if (cold) {
    P(`### Spend time with ${first(cold.name)}, with whom it doesn’t take`);
    const b = spendTimeAccount(perceive(w, s, henry), perceive(w, s, cold), cold, 'the club', compat(w, henry, cold));
    P(`> ${b.text}`);
    P('');
  }
}

// ------------------------------------------------------------------ the captain, over two weeks
function captainOf(w: World, c: Character): Character | undefined { let x: Character | undefined = c; for (let i = 0; i < 6 && x; i++) { x = x.bossId ? w.chars[x.bossId] : undefined; if (x?.rank === 'capo') return x; } return undefined; }
function rizzo() {
  P('## 5. Your captain, over two weeks: one unresolved matter, five visits');
  P('');
  const w = createWorld(3, 'Henry Tedesco'), s = newSession(), henry = w.chars[w.playerId!];
  const riz = captainOf(w, henry)!; riz.name = 'Vic Rizzo';
  const lou = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId === henry.familyId && captainOf(w, c) && captainOf(w, c)!.id !== riz.id).sort(byId)[0];
  lou.name = 'Lou Valenti';
  const their = captainOf(w, lou)!; their.name = 'Joe Marchese';
  const ground = crewGround(w, riz);
  const nate = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection && ground.has(ownerBiz(w, c.id)!.district)).sort(byId)[0]
    ?? Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection).sort(byId)[0];
  nate.name = 'Nate Ferrara'; ownerBiz(w, nate.id)!.name = 'Ferrara’s Grocery';
  rel(riz, henry.id).trust = 0.5;
  const k: Captaincy = { groundHasFor: ground.has(ownerBiz(w, nate.id)!.district), forProtected: false, knowsTrouble: false, theirCaptain: their, asked: 0, agreed: false, done: false };
  P(`*Henry promised Nate Ferrara he would raise Lou Valenti’s shakedown with the family. Vic Rizzo is Henry’s captain; Joe Marchese is Lou’s.*`);
  P('');
  // visit 1
  P('### Day 1: raising it');
  let v = new Visit(w, s, henry, riz, 'the club');
  v.you('ask.intervention', { forName: nate.name, againstName: lou.name });
  let r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, []);
  v.him_(r);
  v.choices([['“Lou’s making trouble on our streets.”', 'Say what’s in it for the crew. He may want to know how you know.'], ['“I gave Nate my word I’d raise it.”', 'Put your own word on it. It’s worth what he thinks of you.'], ['“There’s money in bringing Nate under our protection.”', 'Make it business.'], ['“All right. I’ll leave it.”', 'Let it go.']]);
  v.you('argue.ground', { againstFirst: 'Lou' });
  r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, ['ground']);
  P(`**${first(riz.name)}:** ${render({ key: r.argReplies[0].key, stance: 'flat', toward: 'request', slots: { againstFirst: 'Lou' } }, riz.id, perceive(w, s, riz).arch, v.spoken)}`);
  trace(r);
  v.you('argue.word', { forFirst: 'Nate' });
  r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, ['ground', 'word']);
  P(`**${first(riz.name)}:** ${render({ key: 'reject.argument.word', stance: 'firm', toward: 'speaker', slots: {} }, riz.id, perceive(w, s, riz).arch, v.spoken)}`);
  trace(r);
  card('Rizzo won’t take it up. He says Nate isn’t one of ours. Your word to Nate stands.');
  // between visits: something reaches Rizzo on his own
  w.now += 3 * DAY;
  const book = Object.values(w.biz).find((b) => b.open && b.protection && captainOf(w, w.chars[b.protection.collectorId]) ?.id === riz.id) ?? Object.values(w.biz).find((b) => b.open && b.protection?.collectorId === riz.id);
  if (book) {
    const f = addFact(w, { kind: 'vandalism', actor: lou.id, victim: book.ownerId, business: book.id, text: `${lou.name}'s people smashed up ${book.name}.`, district: book.district }, {});
    learn(w, riz.id, f, w.chars[book.protection!.collectorId].id, true);
    k.knowsTrouble = true; k.trouble = { shop: book.name };
    P(`*Day 4. Without Henry: Lou’s people smash up ${book.name}, a shop on Rizzo’s own book. The man who collects there tells Rizzo.*`);
    P('');
  }
  // visit 2
  P('### Day 5: going back, after something has changed');
  v = new Visit(w, s, henry, riz, 'the club');
  const opener: Reply = { decision: { by: riz.id, constraints: [], candidates: [], chosen: 'raise.newinfo', aim: 'his own: anger at Lou' }, meaning: { key: 'raise.newinfo', stance: 'cold', toward: 'third', slots: { hitShop: k.trouble?.shop ?? '', againstFirst: 'Lou' } }, intent: 'inform', honest: true };
  P('*He raises it before you can.*');
  v.him_(opener);
  v.you('raise.again', { forFirst: 'Nate', againstFirst: 'Lou' });
  r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, []);
  v.him_(r);
  if (r.decision.chosen === 'accept') { k.agreed = true; card('Rizzo will speak to Joe Marchese. If it turns ugly, it’s on you.'); }
  // visits 3–5: asking again
  for (const [day, label] of [[7, 'Day 7: asking how it’s going'], [8, 'Day 8: asking again'], [9, 'Day 9: and again']] as [number, string][]) {
    w.now = 9 * DAY + day * DAY;
    P(`### ${label}`);
    v = new Visit(w, s, henry, riz, 'the club');
    k.asked++;
    v.you('ask.progress', { theirCaptainFirst: 'Joe', forFirst: 'Nate' });
    v.him_(onProgressQuestion(perceive(w, s, riz), henry, nate, lou, k));
  }
  k.done = true;
  P('### Day 11: what reaches Henry, without asking');
  P(`*Rizzo has spoken to Marchese, and Marchese to Lou. Henry learns of it the way he would: Rizzo sends word with one of his men.*`);
  P('');
  P(`> *A message from Rizzo:* ${render({ key: 'answer.progress.done', stance: 'flat', toward: 'speaker', slots: { theirCaptainFirst: 'Joe', againstFirst: 'Lou', forFirst: 'Nate' } }, riz.id, perceive(w, s, riz).arch)}`);
  P('');
  card('Your word to Nate is kept: it was raised with the family, and Lou is to stay away. Nate will hear it from you, or from the street.');
}

P('# Gate 1: generated conversations');
P('');
P('*Produced by `npx tsx src/conv/gate1.ts` from the proof-of-concept engine in `src/conv/` (docs/CONVERSATION_SPEC.md §15, Gate 1). Every line spoken by a character other than Henry is rendered from a decision and its meaning; the trace beneath each shows what he heard, what he weighed and what he meant. Henry’s own lines are rendered the same way, from what the player chose. Names are fixtures (Frank, Nate, Lou, Rizzo, Marchese); the men behind them are ordinary characters of a generated world.*');
P('');
bakery(); compliment(); doorAndClaims(); simple(); rizzo();
mkdirSync('docs/gate1', { recursive: true });
writeFileSync('docs/gate1/TRANSCRIPTS.md', out.join('\n'));
console.log('wrote docs/gate1/TRANSCRIPTS.md', out.length, 'lines');
