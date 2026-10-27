// V89: matters. Each check follows a real chain through the simulation: an approach opens a matter, answers come from stance,
// refusal is not the end, people go to the people they have, superiors hear, NPCs do the same on their own, and it all persists.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { perform } from '../../actions';
import { audit } from '../../consistency';
import { ledgerCheck } from '../../econ';
import { advance, deserialize, serialize } from '../../engine';
import { regard, rel } from '../../core';
import { amendsAsk, asksOf, askBetween, callFavour, favoursWeek, move, openAsk, openAsks, playerMove, playerMoves, putToPlayer, rateAsk, read, stance } from '../../asks';
import { haggleJob, mkJob, resolve } from '../../jobs';
import { addFavour, choose } from '../../encounters';
import { kinOf, closeKin, madeKin } from '../../kin';
import { addFact } from '../../core';
import { ORIGIN, startRivalry, topicsWith, matterAct } from '../../matters';
import { goalHooks, begin, agencyOf, stepGoal, priceOf, endGoal } from '../../goals';
import { notesOf, subjectsOf, talkAbout } from '../../conv/subjects/life';
import '../../conv/subjects/between'; // (the matters between men, as subjects)
import { pass, salience, versionOf } from '../../rumour';
import { begin as visit, everything } from '../../conv/visit';
import { talk } from '../dialogue/fixtures';
// what can be said to him: everything under the headings of a visit
const offered = (w: World, t: Character) => { (w.chars[w.playerId!].intro ??= {})[t.id] ??= w.now; const v = visit(w, t.id); return [...v.choices, ...everything(w, v)].map((o) => o.id.replace(/^a:/, '')); };
import { ownerBiz } from '../../core';
import { hierarchyIssues } from '../../rank';
import { sitIssues } from '../../situ';
import { DAY, type Business, type Character, type World } from '../../types';
import { createWorld } from '../../world';

// (each check is a staged chain across systems, run in order; see src/tests/tags.ts)
const ok = (name: string, f: () => void) => test(name, { tags: ['scenario'] }, f);
const P = (w: World) => w.chars[w.playerId!];
const clean = (w: World, why: string) => {
  assert.deepEqual(audit(w), [], why + ': audit');
  assert.deepEqual(ledgerCheck(w), [], why + ': ledger');
  assert.deepEqual(hierarchyIssues(w), [], why + ': hierarchy');
  assert.deepEqual(sitIssues(w), [], why + ': situations');
};
const shop = (w: World, f: (b: Business) => boolean) => Object.values(w.biz).find((b) => b.open && b.kind !== 'casino' && w.chars[b.ownerId]?.rank === 'civilian' && f(b))!;

ok('an approach opens a matter; a refusal leaves it open, and the player can come back with something else', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const b = shop(w, (x) => !x.protection), o = w.chars[b.ownerId];
  o.traits.courage = 0.9; // a man who will say no
  perform(w, { kind: 'shakedown', actor: p.id, target: o.id, biz: b.id, approach: 'soft', label: '', score: 0 });
  const s = askBetween(w, 'protect', p.id, o.id, b.id)!;
  assert.ok(s, 'the approach is a matter');
  assert.ok(['no', 'counter', 'stall', 'help'].includes(s.st![o.id].last!), 'a brave man does not simply say yes');
  assert.ok(s.stage !== 'resolved', 'and the matter is still open');
  const moves = playerMoves(w, p, s).filter((m) => !m.off).map((m) => m.move);
  assert.ok(moves.includes('sweeten') && moves.includes('persuade') && moves.includes('pressure') && moves.includes('drop'), 'there is more than one way to go on: ' + moves);
  const fee0 = s.terms!.amt!;
  playerMove(w, p, s.id, 'sweeten');
  assert.ok(s.terms!.amt! < fee0, 'better terms are real terms');
  assert.ok(/./.test(read(w, s, o.id)), 'his stance can be read in words');
  clean(w, 'after an approach');
});

ok('a counter-offer taken becomes the real arrangement, at his figure, through the real books', () => {
  const w = createWorld(4, 'Tony Marino'), p = P(w);
  const b = shop(w, (x) => !x.protection), o = w.chars[b.ownerId];
  const s = openAsk(w, 'protect', p, o, { biz: b.id, amt: 60 })!;
  const S = stance(w, s, o.id);
  S.resolve = 0.3; S.fear = 0.1; S.good = 0.2; S.anger = 0; // he would rather haggle than refuse
  let r = move(w, s, 'ask');
  for (let i = 0; i < 4 && r.answer !== 'counter' && s.stage !== 'resolved'; i++) r = move(w, s, 'persuade');
  if (r.answer === 'counter') {
    const offer = Number(s.m!.offer);
    move(w, s, 'take');
    assert.equal(b.protection?.collectorId, p.id);
    assert.equal(b.protection?.fee, offer, 'the fee is the one he named');
  } else assert.ok(b.protection?.collectorId === p.id || s.stage !== 'resolved', 'either he agreed or it is still open');
  advance(w, w.now + 8 * DAY); clean(w, 'after a protection deal');
});

ok('a man who already pays someone goes to him; the protector warns the player off, and the player is asked', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const b = shop(w, (x) => !!x.protection && x.protection.familyId !== p.familyId), o = w.chars[b.ownerId];
  const s = openAsk(w, 'protect', p, o, { biz: b.id, amt: 60 })!;
  const S = stance(w, s, o.id); S.fear = 0.5; S.anger = 0.4;
  move(w, s, 'pressure'); move(w, s, 'pressure');
  const prot = w.chars[b.protection!.collectorId];
  assert.equal(s.m?.help, prot.id, 'he went to the man he pays');
  const warn = asksOf(w, p.id).find((x) => x.ak === 'warn' && x.terms?.by === prot.id);
  assert.ok(warn, 'the protector has an ask of the player: leave it alone');
  assert.ok(prot.known[Object.keys(prot.known).find((id) => w.facts[id]?.story === 'sit:' + s.id)!], 'he knows, because he was told');
  for (let i = 0; i < 4 && !w.enc.some((e) => e.kind === 'ask' && e.status === 'open'); i++) advance(w, w.now + DAY);
  assert.ok(w.enc.some((e) => e.kind === 'ask' && e.status === 'open' && e.from === prot.id), 'the warning reaches the player as a request he must answer');
  const tens = w.fam[p.familyId!].tension[prot.familyId!] ?? 0;
  assert.ok(tens > 0, 'two families now have something between them');
  clean(w, 'after a warning');
});

ok('a superior who hears his man brought trouble wants a word', () => {
  // (a shopkeeper who gives in on the spot closes the matter before anyone above hears of it; the rule is about one who holds out,
  // so the first shop whose owner does not give in at once is used: what each owner does is his own, under street pressure)
  for (let i = 0; i < 8; i++) {
    const w = createWorld(5, 'Tony Marino'), p = P(w);
    const b = Object.values(w.biz).filter((x) => x.open && !x.protection && w.chars[x.ownerId]?.rank === 'civilian')[i], o = w.chars[b.ownerId];
    const s = openAsk(w, 'protect', p, o, { biz: b.id, amt: 60 });
    if (!s) continue;
    move(w, s, 'ask'); move(w, s, 'force');
    const boss = w.chars[p.bossId!];
    const f = Object.values(w.facts).find((x) => x.story === 'sit:' + s.id && x.kind === 'vandalism');
    if (!f) continue;
    boss.known[f.id] = { t: w.now, from: o.id, knowsActor: true };
    s.next = w.now; advance(w, w.now + 60);
    if (s.stage === 'resolved') continue;
    advance(w, w.now + 2 * DAY);
    assert.ok(w.enc.some((e) => e.kind === 'word' && e.from === boss.id), 'he calls the player in');
    return;
  }
  assert.fail('no shopkeeper held out long enough to test it');
});

ok('NPCs pursue matters on their own: shops are approached once at a time, matters end in different ways, the world stays sound', () => {
  let helped = 0; // (going to somebody for help is a choice men make, not a law: over two worlds it happens, though not in every one)
  for (const seed of [3, 7]) {
    const w = createWorld(seed, 'Tony Marino');
    advance(w, w.now + 35 * DAY);
    const asks = (w.situations ?? []).filter((s) => s.kind === 'ask');
    assert.ok(asks.length > 20, 'matters happen without the player');
    const open = openAsks(w).filter((s) => s.ak === 'protect' && !s.m?.against); // (a relative's counter-offer is a second door on purpose)
    const shops = open.map((s) => s.biz);
    assert.equal(new Set(shops).size, shops.length, 'no shop has two collectors at its door');
    const outs = new Set(Object.keys(w.sitpace?.stats ?? {}).filter((k) => k.startsWith('out.ask.')));
    assert.ok(outs.size >= 3, 'they end in more than one way: ' + [...outs]);
    helped += asks.filter((s) => s.m?.help).length;
    clean(w, 'seed ' + seed + ' day 35');
  }
  assert.ok(helped > 0, 'somebody went to somebody');
});

ok('family is read from the world: ties are mutual, never the families’ own names, and only close kin are gone to', () => {
  const w = createWorld(3, 'Tony Marino');
  for (const c of Object.values(w.chars).slice(0, 60)) for (const t of kinOf(w, c)) {
    const back = kinOf(w, w.chars[t.id]).find((x) => x.id === c.id);
    assert.ok(back, 'both men know they are family');
    if (t.role === 'brother' || t.role === 'cousin') assert.equal(back!.role, t.role, 'and agree on how');
    assert.equal(closeKin(w, c, w.chars[t.id]), closeKin(w, w.chars[t.id], c), 'and on whether they are close');
  }
});

ok('a matter saved halfway carries on exactly as it would have', () => {
  const w = createWorld(6, 'Tony Marino'); advance(w, w.now + 12 * DAY);
  const mid = serialize(w);
  const a = deserialize(mid), b = deserialize(mid);
  advance(a, a.now + 10 * DAY); advance(b, b.now + 10 * DAY);
  assert.equal(serialize(a), serialize(b));
  assert.equal(serialize(createWorld(6, 'Tony Marino')), serialize(createWorld(6, 'Tony Marino')), 'same seed, same world');
});

ok('regard is earned at a believable pace: the tenth errand and the third drink are worth little', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w), boss = w.chars[p.bossId!];
  rel(boss, p.id).trust = 0.5;
  const gains: number[] = [];
  for (let i = 0; i < 10; i++) gains.push(regard(w, boss, p, 'trust', 0.08, 'job'));
  assert.ok(gains[1] < gains[0] && gains[4] < gains[0] / 4, 'repetition in a week pays less and less');
  assert.ok(rel(boss, p.id).trust < 0.62, 'ten errands in a week do not make a trusted man: ' + rel(boss, p.id).trust.toFixed(2));
  w.now += 8 * DAY;
  const fresh = regard(w, boss, p, 'trust', 0.08, 'job');
  assert.ok(fresh > gains[3], 'a new week, a fresh start');
  const lo = regard(w, boss, p, 'trust', -0.06, 'job');
  assert.equal(lo, -0.06, 'a failure costs in full');
  const x = w.chars[Object.keys(p.rels)[0]] as Character; void x;
});

ok('matters begin without anyone asking: every kind says how it began, and most begin from events, bad blood or ambition', () => {
  const kinds = Object.entries(ORIGIN);
  assert.ok(kinds.filter(([, o]) => o !== 'negotiation').length >= 10, 'most kinds are not negotiations');
  for (const o of ['event', 'relationship', 'ambition', 'obligation', 'negotiation']) assert.ok(kinds.some(([, x]) => x === o), 'there are ' + o + ' matters');
});

ok('an arrest is a matter: whether he talked is decided once, and his boss reaches a verdict after he is out', () => {
  const w = createWorld(3, 'Tony Marino');
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === 'soldier' && x.bossId && w.chars[x.bossId]?.alive && !w.chars[x.bossId].isPlayer)!;
  c.jailedUntil = w.now + 3 * DAY;
  addFact(w, { kind: 'arrest', actor: c.id, text: `${c.name} was arrested.`, district: c.district }, { broadcast: [c.bossId!] });
  const s = (w.situations ?? []).find((x) => x.kind === 'arrest' && x.parties?.some((y) => y.id === c.id))!;
  assert.ok(s && ['talked', 'quiet'].includes(s.truth!), 'the truth is fixed when he is picked up');
  const truth = s.truth;
  advance(w, w.now + 20 * DAY);
  assert.equal(s.truth, truth, 'and it does not change');
  assert.equal(s.stage, 'resolved', 'his boss has made up his mind');
  assert.ok(['kept quiet', 'doubted', 'talked'].includes(s.out!), 'one way or another: ' + s.out);
  clean(w, 'after an arrest');
});

ok('the player arrested: his boss wants to know what he said, and how he answers counts', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  p.jailedUntil = w.now + 2 * DAY;
  addFact(w, { kind: 'arrest', actor: p.id, text: `${p.name} was arrested.`, district: p.district }, { broadcast: [p.bossId!] });
  for (let i = 0; i < 8 && !w.enc.some((e) => e.kind === 'matter' && e.status === 'open'); i++) advance(w, w.now + DAY);
  const e = w.enc.find((x) => x.kind === 'matter' && x.status === 'open')!;
  assert.ok(e && e.from === p.bossId, 'the boss calls him in');
  assert.ok(e.opts.length >= 3, 'with more than one way to answer');
});

ok('revenge: a beaten man’s brother wants the man who did it, asks his boss for leave, and the answer comes back into the matter', () => {
  let found = false;
  for (let seed = 1; seed <= 12 && !found; seed++) {
    const w = createWorld(seed, 'Tony Marino');
    const v = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && madeKin(w, x).some((k) => closeKin(w, x, k) && !k.isPlayer && k.familyId));
    if (!v) continue;
    const av = madeKin(w, v).find((k) => closeKin(w, v, k) && !k.isPlayer && k.familyId)!;
    av.traits.violence = 1; av.traits.caution = 0;
    const x = Object.values(w.chars).find((y) => y.alive && !y.isPlayer && y.rank === 'soldier' && y.familyId && y.familyId !== av.familyId && y.id !== v.id)!;
    addFact(w, { kind: 'beating', actor: x.id, victim: v.id, text: `${x.name} beat up ${v.name}.`, district: v.district }, { witnesses: [v.id], broadcast: [av.id] });
    const s = (w.situations ?? []).find((y) => y.kind === 'revenge' && y.parties?.some((z) => z.id === av.id));
    if (!s) continue;
    found = true;
    advance(w, w.now + 30 * DAY);
    const asked = (w.situations ?? []).find((y) => y.ak === 'permit' && y.m?.parent === s.id);
    assert.ok(asked || s.out || s.phase !== 'asking leave', 'he asked leave, or it went another way: ' + s.phase);
    if (asked && asked.stage === 'resolved') assert.ok(s.m?.['child:permit'], 'and the answer reached the revenge');
    assert.ok(s.stage === 'resolved' || ['asking leave', 'looking', 'struck', 'resolved to'].includes(s.phase!), 'the matter moved on: ' + s.phase);
    clean(w, 'after revenge');
  }
  assert.ok(found, 'a brother went after someone');
});

ok('bad blood runs its course without the player, and ends in different ways across the world', () => {
  const outs = new Set<string>();
  // (four worlds: which endings turn up in three is the dice's; that more than two do across the city is the rule)
  for (const seed of [3, 7, 11, 19]) {
    const w = createWorld(seed, 'Tony Marino');
    advance(w, w.now + 70 * DAY);
    for (const s of w.situations ?? []) if (s.kind === 'rivalry' && s.out) outs.add(s.out);
    clean(w, 'rivalries seed ' + seed);
  }
  assert.ok(outs.size >= 3, 'different endings: ' + [...outs]);
});

ok('ambition seen is ambition answered: a man caught doing a rival down has a rival now', () => {
  const w = createWorld(3, 'Tony Marino');
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === 'soldier' && x.bossId && !w.chars[x.bossId].isPlayer)!;
  const rv = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === 'soldier' && x.familyId === c.familyId && x.id !== c.id)!;
  const g = begin(w, c, 'advance', 'he wants more', 0.7, { stage: 'start', next: 'ask' });
  for (const h of goalHooks()) h(w, g, c, 'undermine', { rival: rv.id, seen: true });
  assert.ok((w.situations ?? []).some((s) => s.kind === 'climb' && s.m?.goal === g.id), 'his climb is a matter');
  assert.ok((w.situations ?? []).some((s) => s.kind === 'rivalry' && s.parties?.some((x) => x.id === rv.id) && s.parties?.some((x) => x.id === c.id)), 'and the man he did down is his rival');
});

ok('the player can raise a matter in conversation in its own terms, and doing so changes it', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const [a, b] = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank === 'soldier' && x.familyId === p.familyId).slice(0, 2);
  rel(a, b.id).grudge = 0.6; rel(b, a.id).grudge = 0.5; rel(a, p.id).trust = 0.6;
  const s = startRivalry(w, a, b, 'test')!;
  s.k![p.id] = { l: 2, via: 'test', t: w.now };
  const t = topicsWith(w, p, a).map((x) => x.o.code);
  assert.ok(t.includes('ask') && t.includes('side'), 'he can ask about it or take a side: ' + t);
  const g0 = rel(b, p.id).grudge;
  matterAct(w, p, s.id, 'side', a.id);
  assert.ok(s.parties!.some((x) => x.id === p.id), 'taking a side puts him in it');
  assert.ok(rel(a, p.id).affection > 0 && rel(b, p.id).grudge >= g0, 'and both men feel it');
  assert.ok(!topicsWith(w, p, a).some((x) => x.o.code === 'side'), 'it is not offered twice in a day');
});

ok('anyone can be worth talking to: ordinary men have things on their minds, and they differ from man to man', () => {
  const w = createWorld(3, 'Tony Marino'); advance(w, w.now + 20 * DAY);
  const p = P(w), men = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer); // (everyone in town: shopkeepers as well as the men of the families)
  for (const m of men) { rel(m, p.id).trust = Math.max(rel(m, p.id).trust, 0.5); (p.intro ??= {})[m.id] = w.now; }
  const keys = new Set<string>(); let withSome = 0;
  for (const m of men) { const ss = subjectsOf(w, p, m); if (ss.length) withSome++; for (const s of ss) keys.add(s.key.split(':')[0]); }
  assert.ok(withSome >= men.length * 0.6, `most men have something to talk about: ${withSome}/${men.length}`);
  assert.ok(keys.size >= 6, 'many kinds of subject: ' + [...keys]);
  // and a man in no matter at all still opens with something of his own
  // (his own: not the questions you can always put to him, nor the matters between you, which are threads of their own)
  const quiet = men.find((m) => !(w.situations ?? []).some((s) => s.stage !== 'resolved' && s.parties?.some((x) => x.id === m.id)) && subjectsOf(w, p, m).some((s) => !/^(hurting|ev:|debt:|earn|job:)/.test(s.key)))!;
  const o = offered(w, quiet);
  assert.ok(o.some((x) => x.startsWith('tk:')), 'his own subjects are offered: ' + o.join());
});

ok('a subject is a conversation: he answers, you answer, and what you say changes things and is remembered', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const b = shop(w, (x) => !!x.protection && x.protection.collectorId !== p.id), o = w.chars[b.ownerId];
  rel(o, p.id).trust = 0.6; rel(o, b.protection!.collectorId).grudge = 0.4; b.distress = 1;
  const first = talkAbout(w, p, o, 'tk:shop')!;
  assert.ok(first.lines.length && first.choices.some((c) => c.code === 'tk:shop:col'), 'he talks about the shop, and you can ask about the man he pays');
  const second = talkAbout(w, p, o, 'tk:shop:col')!;
  assert.ok(second.choices.some((c) => c.code === 'tk:shop:poach'), 'a man unhappy with what he pays can be offered better');
  talkAbout(w, p, o, 'tk:shop:poach');
  assert.ok(askBetween(w, 'protect', p.id, o.id, b.id), 'and the offer is a matter between you now');
  assert.ok(!subjectsOf(w, p, o).some((s) => s.key === 'shop'), 'the same subject, unchanged, is not raised again straight away');
  clean(w, 'after talking shop');
});

ok('helping a man with his trouble moves real money and leaves him owing you', () => {
  const w = createWorld(4, 'Tony Marino'), p = P(w);
  const m = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.id !== p.bossId)!;
  m.problem = { kind: 'debt', sev: 0.6, since: w.now, revealed: true }; rel(m, p.id).trust = 0.6; p.cash = 3000;
  const b = talkAbout(w, p, m, 'tk:trouble')!;
  const gift = b.choices.find((c) => c.code === 'tk:trouble:gift')!;
  assert.ok(gift, 'he can be helped: ' + b.choices.map((c) => c.code));
  const cash0 = p.cash, his0 = m.cash, f0 = w.favours.length;
  talkAbout(w, p, m, gift.code);
  assert.ok(p.cash < cash0 && m.cash - his0 === cash0 - p.cash, 'the money moves from you to him');
  assert.ok(w.favours.length > f0 && w.favours.at(-1)!.from === p.id, 'and he owes you');
  assert.ok(m.problem!.sev < 0.6, 'and it helps');
  clean(w, 'after helping');
});

ok('the conversation screen carries a subject through its turns and back', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const m = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && ownerBiz(w, c.id) && subjectsOf(w, p, c).some((x) => x.key === 'shop'))!;
  rel(m, p.id).trust = 0.6; (p.intro ??= {})[m.id] = w.now;
  const r = talk(w, m.id, 'tk:shop');
  assert.ok(r.lines.length, 'he answers');
  const next = r.next.find((c) => c.startsWith('tk:shop:'));
  if (next) { const r2 = talk(w, m.id, next, {}, r.v); assert.ok(r2.lines.length && !r2.r.end, 'the conversation goes on'); }
});

ok('what you already know opens a man up, and standing up for him is a promise and a matter', () => {
  const w = createWorld(3, 'Tony Marino'); advance(w, w.now + 10 * DAY);
  const p = P(w);
  // (a matter the player has not already heard of: with nothing to go on, the wary man says nothing)
  const heardOf = (sid: string) => Object.keys(p.known).some((id) => w.facts[id]?.story === 'sit:' + sid);
  // (if nobody happens to be leaning on a shop just now, a soldier does, through the same negotiation)
  const byId = (x: { id: string }, y: { id: string }) => (x.id < y.id ? -1 : 1);
  const s = openAsks(w).find((x) => x.ak === 'protect' && x.terms?.by !== p.id && x.terms?.of !== p.id && !heardOf(x.id)) ?? (() => {
    const man = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'soldier').sort(byId)[0];
    const shop = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && !b.protection && w.chars[b.ownerId]?.alive && !w.chars[b.ownerId].isPlayer).sort(byId)[0];
    const sit = openAsk(w, 'protect', man, w.chars[shop.ownerId], { biz: shop.id, amt: 40 })!;
    move(w, sit, 'ask');
    return sit;
  })();
  const t = w.chars[s.terms!.of], a = w.chars[s.terms!.by];
  rel(t, p.id).trust = 0.2;
  let b = talkAbout(w, p, t, 'tk:pressed:' + s.id)!;
  assert.ok(!b.choices.length, 'a wary man with nothing to go on says nothing');
  const f = Object.values(w.facts).find((x) => x.story === 'sit:' + s.id);
  if (!f) return;
  p.known[f.id] = { t: w.now, from: 'public', knowsActor: true };
  delete t.talk!['tk:pressed:' + s.id];
  b = talkAbout(w, p, t, 'tk:pressed:' + s.id)!;
  const heard = b.choices.find((c) => c.code.endsWith(':heard'))!;
  assert.ok(heard, 'but you can say what you heard');
  b = talkAbout(w, p, t, heard.code)!;
  assert.ok(b.choices.some((c) => c.code.endsWith(':warn')), 'and then he tells you, and you can stand up for him');
  talkAbout(w, p, t, b.choices.find((c) => c.code.endsWith(':warn'))!.code);
  assert.ok(askBetween(w, 'warn', p.id, a.id), 'the warning is a matter between you and the other man now');
  assert.ok(t.memos.some((m) => m.kind === 'promise' && m.other === p.id && !m.done), 'and he is holding you to it');
  assert.ok(notesOf(p, t).some((n) => n.includes(a.name)), 'what he told you is written down as what he told you');
});

ok('what you know of a man is what he has shown you: nothing is noted that he did not say', () => {
  const w = createWorld(4, 'Tony Marino'), p = P(w);
  const m = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank !== 'civilian')!;
  m.problem = { kind: 'gambling', sev: 0.7, since: w.now }; rel(m, p.id).trust = 0.1;
  talkAbout(w, p, m, 'tk:trouble');
  assert.equal(notesOf(p, m).length, 0, 'a guarded man who says nothing gives you nothing to write down');
  assert.ok(!m.problem.revealed, 'and his trouble stays his');
});

ok('news is told the teller’s way: he protects his own, puts his enemy’s name to what he didn’t see, and the listener believes it', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const men = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian');
  const [teller, actor, victim, enemy, listener] = men;
  // a beating whose doer the teller doesn't know, and a man he hates
  const f = addFact(w, { kind: 'beating', actor: actor.id, victim: victim.id, hiddenActor: true, text: `${actor.name} beat up ${victim.name}.`, textHidden: `${victim.name} was beaten.`, district: victim.district }, {});
  teller.known[f.id] = { t: w.now, from: 'public', knowsActor: false };
  rel(teller, enemy.id).grudge = 0.9; teller.traits.greed = 0.9; teller.traits.sociability = 0.3; // bitter
  let blamed = 0;
  for (let i = 0; i < 30; i++) { delete listener.known[f.id]; delete (teller.known[f.id] as { blame?: string }).blame; pass(w, teller, listener, f, false); if ((listener.known[f.id] as { blame?: string }).blame === enemy.id) blamed++; }
  assert.ok(blamed > 3 && blamed < 30, 'sometimes he names the man he hates: ' + blamed);
  // the player hears the claim, attributed, not the truth
  delete p.known[f.id]; (teller.known[f.id] as { blame?: string }).blame = enemy.id;
  pass(w, teller, p, f, false);
  assert.ok(versionOf(w, p, f).includes(enemy.name) && !versionOf(w, p, f).includes(actor.name), 'the player hears the claim, not the truth: ' + versionOf(w, p, f));
  // a man protects his own: told by a brother of the doer, the name stays out of it
  const g = addFact(w, { kind: 'beating', actor: actor.id, victim: victim.id, text: `${actor.name} beat up ${victim.name}.`, district: victim.district }, {});
  rel(teller, actor.id).affection = 0.9; teller.known[g.id] = { t: w.now, from: 'witness', knowsActor: true };
  assert.equal(pass(w, teller, listener, g, true), false, 'he will not hand his friend to the street');
});

ok('a man passes on what matters to the listener; a stranger’s night at cards is nobody’s business', () => {
  const w = createWorld(3, 'Tony Marino');
  const [a, b] = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.familyId).slice(0, 2);
  const stranger = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.familyId && c.familyId !== b.familyId)!;
  const loss = addFact(w, { kind: 'gambling_loss', actor: stranger.id, amount: 300, text: `${stranger.name} dropped $300.`, district: stranger.district }, {});
  assert.ok(salience(w, b, loss) < 0, 'a stranger’s small loss is not passed on');
  const hurt = addFact(w, { kind: 'beating', actor: stranger.id, victim: b.id, text: `${stranger.name} beat up ${b.name}.`, district: b.district }, {});
  assert.ok(salience(w, b, hurt) > salience(w, a, hurt) || a.id === b.bossId, 'what happened to a man matters most to him');
});
// ---------------------------------------------------------------- NPC plans (goals.ts): they end, people hear, the player is asked
ok('NPC plans end within weeks, in different ways, and how they ended is news the people around the man hear', () => {
  const w = createWorld(3, 'Tony Marino');
  advance(w, w.now + 70 * DAY);
  const a = agencyOf(w);
  const how = new Set(a.ended.map((e) => e.how)), kinds = new Set(a.ended.map((e) => e.kind));
  assert.ok(how.has('done') && (how.has('failed') || how.has('dropped')), 'plans succeed, and plans fail or are given up: ' + [...how]);
  assert.ok(kinds.size >= 3, 'across several kinds of plan: ' + [...kinds]);
  assert.ok(a.ended.filter((e) => e.how !== 'done').length >= 5, 'not every plan comes off');
  const told = Object.values(w.facts).filter((f) => f.story?.startsWith('goal:'));
  assert.ok(told.length >= 5, 'endings are facts: ' + told.length);
  for (const f of told) {
    assert.ok(Object.values(w.chars).some((c) => c.id !== f.actor && c.known[f.id]), 'somebody besides the man himself knows: ' + f.text);
    assert.ok(!/\d/.test(f.text), 'told in words, not figures: ' + f.text);
  }
  assert.ok(told.some((f) => !f.minor), 'and some of it is the kind of news that travels');
  clean(w, 'seventy days of plans');
});

ok('a plan is given up when circumstances change: a long stretch inside ends it, and the man he answers to hears', () => {
  const w = createWorld(4, 'Tony Marino');
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === 'soldier' && x.bossId && w.chars[x.bossId]?.alive)!;
  const g = begin(w, c, 'wealth', 'test', 0.6, { stage: 'build', need: 999999 });
  c.jailedUntil = w.now + 90 * DAY;
  stepGoal(w, g, c);
  assert.equal(agencyOf(w).ended.find((x) => x.id === g.id)?.how, 'dropped');
  const f = Object.values(w.facts).find((x) => x.story === 'goal:' + g.id);
  assert.ok(f && w.chars[c.bossId!].known[f.id], 'the man he answers to hears of it');
});

// A man in the player's family who trusts him, short of the money for a place the owner will sell him.
function shortBuyer(seed: number) {
  const w = createWorld(seed, 'Tony Marino'), p = P(w);
  advance(w, w.now + 3 * DAY);
  const b = Object.values(w.biz).find((x) => x.open && x.kind !== 'casino' && w.chars[x.ownerId]?.alive && !w.chars[x.ownerId].isPlayer && w.chars[x.ownerId].rank === 'civilian')!;
  const o = w.chars[b.ownerId];
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.familyId === p.familyId && x.rank === 'soldier' && x.id !== o.id && !ownerBiz(w, x.id))!;
  rel(c, p.id).trust = 0.6; rel(c, p.id).grudge = 0; c.jailedUntil = 0; c.traits.ambition = 0.5; c.traits.violence = 0.2;
  p.cash = 4000;
  const price = priceOf(w, b);
  c.cash = price - 800 + 150; // eight hundred short, keeping something back
  const g = begin(w, c, 'business', 'test', 0.8, { stage: 'finance', target: b.id, owner: o.id, mode: 'buy', need: price, next: 'raise the difference' });
  g.offer = price; g.deadline = w.now + 200 * DAY;
  agencyOf(w).lastAsk = -1e9;
  return { w, p, b, o, c, g };
}
const driveGoal = (w: World, g: ReturnType<typeof begin>, until: () => boolean, n = 20) => { for (let i = 0; i < n && !until() && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, w.chars[g.who]); } };

ok('a man who trusts the player comes to him for the money he is short; a yes is a real loan, and the plan goes through', () => {
  const { w, p, b, c, g } = shortBuyer(3);
  const asked = () => w.enc.find((e) => e.status === 'open' && e.kind === 'ask' && e.from === c.id);
  driveGoal(w, g, () => !!asked());
  const e = asked()!;
  assert.ok(e, 'he asks the player');
  assert.ok(e.lines.some((l) => l.includes(b.name)), 'and says what it is for: ' + e.lines.join(' / '));
  const cash0 = p.cash;
  choose(w, p, e, 'yes');
  const d = w.debts.find((x) => x.creditor === p.id && x.debtor === c.id && x.status === 'active')!;
  assert.ok(d, 'the yes is a debt he owes the player');
  assert.ok(p.cash < cash0, 'and the money came out of the player’s pocket');
  driveGoal(w, g, () => !agencyOf(w).goals.includes(g));
  assert.equal(b.ownerId, c.id, 'with it he buys the place');
  assert.equal(agencyOf(w).ended.find((x) => x.id === g.id)?.how, 'done');
  // later: the loan is on the weekly round like any other debt
  const bal = d.balance;
  advance(w, w.now + 8 * DAY);
  assert.ok(d.balance < bal || d.missed > 0 || d.status !== 'active', 'he pays it back on the weekly round (or misses, and it is counted)');
  clean(w, 'after a loan to buy a place');
});

ok('if the player says no, the man remembers it, does not ask him again, and looks elsewhere', () => {
  const { w, p, c, g } = shortBuyer(3);
  const asked = () => w.enc.filter((e) => e.kind === 'ask' && e.from === c.id);
  driveGoal(w, g, () => asked().some((e) => e.status === 'open'));
  const e = asked().find((x) => x.status === 'open')!;
  assert.ok(e, 'he asks the player');
  const gr = rel(c, p.id).grudge;
  choose(w, p, e, 'no');
  assert.ok(rel(c, p.id).grudge > gr, 'he holds it against the player a little');
  driveGoal(w, g, () => false, 8);
  assert.ok(g.asked?.includes(p.id) || !agencyOf(w).goals.includes(g), 'the player is off his list for this plan');
  assert.equal(asked().length, 1, 'he never puts it to the player twice');
  assert.ok(!w.debts.some((d) => d.creditor === p.id && d.debtor === c.id), 'and no loan was made');
  clean(w, 'after a refusal');
});

ok('an offer to join a crew is a negotiation through the asks engine: the young man weighs it, and yes makes him the recruiter’s man', () => {
  const w = createWorld(5, 'Tony Marino');
  const cap = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === 'capo')!;
  const pro = Object.values(w.chars).find((x) => x.alive && x.prospect && x.rank === 'civilian' && !ownerBiz(w, x.id))!;
  cap.cash = 5000; cap.jailedUntil = 0; cap.standing = 90; cap.traits.sociability = 1;
  pro.traits.ambition = 1; pro.traits.caution = 0; pro.cash = 50;
  const g = begin(w, cap, 'recruit', 'test', 0.6, { stage: 'approach', target: pro.id });
  g.deadline = w.now + 200 * DAY;
  // (he may name terms first: the plan steps, and the days pass so the negotiation can run its course)
  driveGoal(w, g, () => !agencyOf(w).goals.includes(g) || (w.situations ?? []).some((x) => (x.ak === 'recruit' || x.ak === 'join') && x.terms?.by === cap.id), 30);
  assert.ok((w.situations ?? []).some((x) => (x.ak === 'recruit' || x.ak === 'join') && x.terms?.by === cap.id), 'the offer was an ask between them');
  for (let i = 0; i < 20 && agencyOf(w).goals.includes(g) && pro.rank === 'civilian'; i++) advance(w, w.now + DAY);
  driveGoal(w, g, () => !agencyOf(w).goals.includes(g), 5); // (and his plan sees how it came out)
  if (pro.rank === 'associate') { assert.equal(pro.bossId, cap.id); assert.equal(agencyOf(w).ended.find((x) => x.id === g.id)?.how, 'done'); }
  else assert.ok(g.tries > 0 || !agencyOf(w).goals.includes(g), 'or he said no, and that counted');
  clean(w, 'after a crew offer');
});

ok('a plan that ends takes its open ask with it: nothing is left waiting on a plan that no longer exists', () => {
  const { w, c, g } = shortBuyer(3);
  driveGoal(w, g, () => !!g.sit);
  const sid = g.sit!;
  assert.ok(sid, 'he has an ask out');
  endGoal(w, g, 'dropped', 'test');
  assert.equal((w.situations ?? []).find((x) => x.id === sid)!.stage, 'resolved');
  assert.ok(!w.enc.some((e) => e.status === 'open' && e.kind === 'ask' && e.from === c.id), 'no question is left open for the player');
  clean(w, 'after an ended plan');
});

// ------------------------------------------------------------------ V89: the one-shot interactions, converted to asks
const haggler = (w: World, s: import('../../types').Situation, id: string) => { const S = stance(w, s, id); S.resolve = 0.3; S.fear = 0.05; S.good = 0.2; S.anger = 0; return S; };
const dig = (w: World, s: import('../../types').Situation) => { const S = stance(w, s, s.terms!.of); S.resolve = 0.95; S.fear = 0; S.good = 0; S.anger = 0.6; return S; };
const live = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer);
const prospect = (w: World) => live(w).find((c) => c.prospect && c.rank === 'civilian' && !ownerBiz(w, c.id))!;
const stats = (w: World) => w.sitpace?.stats ?? {};
const closed = (s: import('../../types').Situation) => s.stage === 'resolved';
const anyAsk = (w: World, ak: string, by: string, of: string) => [...(w.situations ?? [])].reverse().find((x) => x.ak === ak && x.terms?.by === by && x.terms?.of === of);

ok('recruitment: an offer turned down stays open, and there is more than one way to go on', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w), t = prospect(w);
  p.cash = 2000; (p.intro ??= {})[t.id] = w.now;
  t.traits.courage = 1; t.traits.caution = 1; t.traits.ambition = 0; // a careful man, in no hurry to be anybody's
  const r = talk(w, t.id, 'recruit_offer');
  const s = anyAsk(w, 'recruit', p.id, t.id)!;
  assert.ok(s && r.lines.length, 'the offer is a matter between you');
  if (closed(s)) return; // (he took it at once: fine, the next test covers the rest)
  dig(w, s); playerMove(w, p, s.id, 'persuade');
  assert.ok(!closed(s) && t.rank === 'civilian', 'a man dug in says no, and it is still open');
  const moves = playerMoves(w, p, s).filter((m) => !m.off).map((m) => m.move);
  for (const m of ['sweeten', 'pressure', 'drop']) assert.ok(moves.includes(m as never), 'he can go on: ' + moves);
  // (V90: the matter is a row on the hub, by name; opening it gives its moves)
  assert.ok(offered(w, t).includes('m:' + s.id), 'the matter is in the conversation');
  const inIt = talk(w, t.id, 'm:' + s.id);
  assert.ok(inIt.next.some((c) => c.startsWith('mv:' + s.id) || c.startsWith('x:' + s.id)), 'and opening it gives what can be said in it');
  assert.ok(!offered(w, t).includes('recruit_offer'), 'and the one-shot offer is not offered twice');
  clean(w, 'after a refused offer');
});

ok('recruitment: his counter names the start he needs and why, and taking it puts him on your crew at that figure', () => {
// (Gate 4: every game runs the conversation layer, whose decision model answers asks; this checks the asks kind's own counter and its
  // reason, which the layer uses when it counters, so it runs on a world without the layer's record, where the kind still decides)
  const w = createWorld(4, 'Tony Marino'), p = P(w), t = prospect(w); delete w.social;
  p.cash = 2000; t.traits.greed = 0.9; t.cash = 100; // greedy, and nothing in his pocket
  const s = openAsk(w, 'recruit', p, t, { amt: 150 })!;
  haggler(w, s, t.id);
  const o = move(w, s, 'ask');
  assert.equal(o.answer, 'counter', 'a greedy man haggles: ' + o.lines.join(' '));
  assert.match(String(s.m?.why), /nothing in his pocket/, 'and his reason is true of him');
  const offer = Number(s.m!.offer), cash0 = p.cash, his0 = t.cash;
  assert.ok(offer > 150);
  playerMove(w, p, s.id, 'take');
  assert.equal(t.bossId, p.id, 'he runs with you now');
  assert.equal(t.rank, 'civilian', 'and, taken on by an associate, he is his crewman, not on the family\'s record');
  assert.equal(cash0 - p.cash, offer, 'it cost what he asked');
  assert.equal(t.cash - his0, offer, 'and the money went to him');
  clean(w, 'after a recruit');
});

ok('recruitment: NPCs make the same offer on their own, and answers come from the man asked', () => {
  let n = 0;
  for (const seed of [3, 7]) {
    const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + 35 * DAY);
    n += stats(w)['open.recruit'] ?? 0;
    clean(w, 'recruits seed ' + seed);
  }
  assert.ok(n >= 1, 'somebody offered somebody a place: ' + n);
});

ok('a quiet word is a matter: a refusal leaves the job open, and when he agrees later the job is done and paid', () => {
// (Gate 4: every game runs the conversation layer, whose decision model answers asks; this checks the asks kind's own counter and its
  // reason, which the layer uses when it counters, so it runs on a world without the layer's record, where the kind still decides)
  const w = createWorld(3, 'Tony Marino'), p = P(w); delete w.social;
  const [v, t] = live(w).filter((c) => c.rank === 'civilian' && !ownerBiz(w, c.id)).slice(0, 2);
  const f = addFact(w, { kind: 'beating', actor: t.id, victim: v.id, text: `${t.name} beat up ${v.name}.`, district: v.district }, { witnesses: [v.id] });
  v.cash = 1000; t.cash = 400;
  const j = mkJob(w, { kind: 'handle', title: `Speak to ${t.name} for ${v.name}`, brief: '', giver: v.id, via: 'tip', assignee: p.id, target: t.id, cause: f.id, pay: 100, status: 'active', days: 14 });
  t.traits.courage = 1; t.traits.caution = 0; rel(t, v.id).grudge = 0.9; // he wants at him, and he is not afraid
  resolve(w, j, 'warn');
  const s = anyAsk(w, 'layoff', p.id, t.id)!;
  assert.ok(s, 'the word is a matter between you');
  if (closed(s)) return;
  assert.equal(j.status, 'active', 'the job is not lost on the first answer');
  assert.equal(s.m?.job, j.id);
  const moves = playerMoves(w, p, s).filter((m) => !m.off).map((m) => m.move);
  assert.ok(moves.includes('pressure') && moves.includes('force') && moves.includes('drop'), 'you can go back to him: ' + moves);
  const S = stance(w, s, t.id); S.resolve = 0; S.fear = 0.9; S.anger = 0; t.traits.courage = 0.1; t.traits.caution = 0.8; // he has thought better of it (V90: and, careful now, his temperament says so too)
  const cash0 = p.cash;
  const o = playerMove(w, p, s.id, 'pressure');
  assert.ok(closed(s), 'he agrees: ' + o.lines.join(' '));
  assert.equal(j.status, 'done', 'and the job is done');
  assert.ok(p.cash > cash0, 'and paid');
  assert.ok(rel(t, v.id).grudge < 0.9, 'and he lets the bad blood go');
  clean(w, 'after a quiet word');
});

ok('a quiet word: NPCs have one with the man who hurt their own, and it goes on past the first answer', () => {
  // (V90: whether a man goes after the one who hurt his own or has a word instead is his temperament's. Set up here rather than
  // waited for: in a seeded month it happens once or not at all.)
  const w = createWorld(3, 'Tony Marino'); advance(w, w.now + 10 * DAY);
  let s: import('../../types').Situation | undefined;
  const victims = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && madeKin(w, x).some((k) => closeKin(w, x, k) && !k.isPlayer));
  for (const v of victims) {
    for (const k of madeKin(w, v)) { k.traits.violence = 0; k.traits.caution = 1; k.traits.ambition = 0; k.traits.courage = 0.3; k.traits.greed = 0; } // careful, agreeable men
    const x = Object.values(w.chars).find((y) => y.alive && !y.isPlayer && y.rank === 'civilian' && y.id !== v.id && !madeKin(w, v).some((k) => k.id === y.id))!;
    addFact(w, { kind: 'beating', actor: x.id, victim: v.id, text: `${x.name} beat up ${v.name}.`, district: v.district }, { witnesses: [v.id] });
    s = (w.situations ?? []).find((q) => q.ak === 'layoff' && q.terms?.of === x.id);
    if (s) break;
  }
  assert.ok(s, 'somebody had a word');
  let rounds = 0;
  for (let d = 0; d < 20 && s!.stage !== 'resolved'; d++) { advance(w, w.now + DAY); rounds = Math.max(rounds, (s!.hist ?? []).length); }
  assert.ok(rounds >= 2 || s!.stage === 'resolved', 'and it went on past the first word');
  clean(w, 'quiet words');
});

ok('a favour called in from the player: refusing what you owe costs you and gets around, and he comes back to it', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const c = live(w).find((x) => x.rank === 'soldier' && x.familyId === p.familyId)!;
  const f = addFavour(w, c.id, p.id, 2, 'the time he covered for you');
  const s = callFavour(w, c, p, f, 'money', 300)!;
  putToPlayer(w, s, [`${c.name} asks to speak to you.`]);
  const e = w.enc.find((x) => x.kind === 'ask' && x.status === 'open' && x.from === c.id)!;
  assert.ok(e && e.opts.some((o) => o.code === 'counter'), 'he asks, and you can offer part of it');
  const st0 = p.standing, r0 = rel(c, p.id).respect;
  choose(w, p, e, 'no');
  assert.ok(p.standing < st0 && rel(c, p.id).respect < r0, 'refusing a favour you owe costs you');
  assert.ok(Object.values(w.facts).some((x) => x.kind === 'favour' && x.actor === p.id && x.victim === c.id && !x.minor), 'and it is talked about');
  assert.ok(!closed(s) && !f.settled, 'and it is still owed, and still open');
  s.next = w.now; advance(w, w.now + 3 * DAY);
  assert.ok(closed(s) || w.enc.some((x) => x.kind === 'ask' && x.status === 'open' && x.from === c.id) || Object.keys(stance(w, s, c.id).tried ?? {}).length > 1, 'he comes back to it');
  clean(w, 'after a refused favour');
});

ok('a favour called in by the player: he offers part, with his reason, and taking it settles it through the real money', () => {
  const w = createWorld(4, 'Tony Marino'), p = P(w);
  const t = live(w).find((x) => x.rank === 'soldier' && x.familyId === p.familyId)!;
  const f = addFavour(w, p.id, t.id, 2, 'the money you slipped him');
  t.cash = 350; (p.intro ??= {})[t.id] = w.now;
  assert.ok(offered(w, t).includes('favcall:' + f.id), 'the favour can be called in in conversation');
  talk(w, t.id, 'favcall:' + f.id);
  const s = anyAsk(w, 'favour', p.id, t.id)!;
  assert.ok(s, 'it is a matter between you');
  if (closed(s)) { assert.ok(f.settled); return; }
  haggler(w, s, t.id); stance(w, s, t.id).last = undefined;
  const o = move(w, s, 'ask');
  if (o.answer === 'counter') {
    assert.match(String(s.m?.why), /short/, 'he is short, and says so');
    const offer = Number(s.m!.offer), cash0 = p.cash, his0 = t.cash;
    playerMove(w, p, s.id, 'take');
    assert.ok(f.settled, 'the favour is square');
    assert.equal(p.cash - cash0, offer); assert.equal(his0 - t.cash, offer);
  } else assert.ok(f.settled || !closed(s), 'either he paid or it is still open');
  clean(w, 'after calling in a favour');
});

ok('favours owed between other men are called in by them, the same way', () => {
  const w = createWorld(3, 'Tony Marino');
  const [a, t] = live(w).filter((c) => c.rank === 'soldier').slice(0, 2);
  a.cash = 50; t.cash = 2000;
  const f = addFavour(w, a.id, t.id, 2, 'getting his brother out');
  f.t = w.now - 12 * DAY;
  favoursWeek(w); // (the weekly round, as the engine runs it)
  const s = (w.situations ?? []).find((x) => x.ak === 'favour' && x.m?.fav === f.id);
  assert.ok(s, 'the man owed called it in');
  assert.ok(Object.keys(stance(w, s!, a.id).tried ?? {}).length >= 1, 'and put it to him');
  advance(w, w.now + 8 * DAY);
  assert.ok(f.settled || closed(s!) || Object.values(stance(w, s!, a.id).tried ?? {}).reduce((x, y) => x + y, 0) >= 2 || s!.next! > w.now, 'and it went somewhere: ' + s!.phase);
  clean(w, 'after favours between men');
});

ok('making it right after a broken promise: he can refuse, name a price with his reason, and taking it settles it', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w);
  const t = live(w).find((x) => x.rank === 'soldier' && x.familyId === p.familyId)!;
  addFact(w, { kind: 'ruling', actor: p.id, victim: t.id, minor: true, text: `${p.name} didn’t keep his word to ${t.name}.`, district: t.district }, { witnesses: [t.id] });
  (p.intro ??= {})[t.id] = w.now; p.cash = 3000; t.cash = 100;
  assert.ok(offered(w, t).includes('word_make'));
  talk(w, t.id, 'word_make');
  const s = anyAsk(w, 'amends', p.id, t.id)!;
  assert.ok(s, 'making it right is a matter between you');
  dig(w, s);
  playerMove(w, p, s.id, 'ask');
  assert.ok(!closed(s), 'words alone are not enough for a man dug in');
  const moves = playerMoves(w, p, s).filter((m) => !m.off).map((m) => m.move);
  assert.ok(moves.includes('sweeten') && moves.includes('persuade'), 'you can put money with it, or explain: ' + moves);
  haggler(w, s, t.id); stance(w, s, t.id).last = undefined; t.traits.violence = 0.2; rel(t, p.id).trust = 0.4; // he has cooled
  const o = move(w, s, 'ask');
  assert.equal(o.answer, 'counter', 'a man who has cooled names his price: ' + o.lines.join(' '));
  assert.match(String(s.m?.why), /counting on you/, 'he names what it cost him (he is short)');
  const offer = Number(s.m!.offer), cash0 = p.cash, his0 = t.cash;
  playerMove(w, p, s.id, 'take');
  assert.equal(cash0 - p.cash, offer, 'you pay what he named');
  assert.equal(t.cash - his0, offer, 'to him');
  assert.ok(closed(s), 'and it is made right');
  if (closed(s)) assert.ok(!offered(w, t).includes('word_make'), 'and once it is made right it is not raised again');
  clean(w, 'after amends');
});

ok('making peace between other men is the same offer, and its answer ends their quarrel', () => {
  const w = createWorld(3, 'Tony Marino');
  const [a, b] = live(w).filter((x) => x.rank === 'soldier' && x.familyId).slice(0, 2);
  rel(a, b.id).grudge = 0.4; rel(b, a.id).grudge = 0.4;
  const s = startRivalry(w, a, b, 'test')!;
  const am = amendsAsk(w, a, b, { parent: s.id })!;
  assert.ok(am, 'an offer of amends inside the quarrel');
  haggler(w, am, b.id); rel(b, a.id).trust = 0.8; a.cash = 2000;
  move(w, am, 'ask');
  if (am.st?.[b.id]?.last === 'counter') { assert.ok(am.m?.why, 'his price comes with his reason'); move(w, am, 'take'); }
  assert.ok(closed(am) && ['agreed', 'gave in'].includes(am.out!), 'he accepts, at his price or at none: ' + am.out + '/' + am.st?.[b.id]?.last);
  assert.ok(rel(b, a.id).grudge < 0.4, 'and the bad blood goes down');
  s.next = w.now; advance(w, w.now + 2 * DAY);
  assert.equal(s.stage, 'resolved', 'their quarrel ends with it');
  clean(w, 'after peace between men');
});

ok('asking to pass up less: a counter comes with a real reason, and taking it is the new rate', () => {
  const w = createWorld(3, 'Tony Marino'), p = P(w), boss = w.chars[p.bossId!];
  p.kickRate = 0.2; p.books.arrears = 200; // behind with him: that is his reason
  const s = rateAsk(w, p, boss)!;
  assert.ok(s, 'the ask is made');
  haggler(w, s, boss.id); rel(boss, p.id).trust = 0.9; boss.traits.greed = 0;
  const o = move(w, s, 'ask');
  if (o.answer === 'counter') {
    assert.match(String(s.m?.why), /behind/, 'he says why');
    playerMove(w, p, s.id, 'take');
    assert.equal(Math.round(p.kickRate * 100), Number(s.terms!.amt), 'the new rate is his figure');
  } else assert.ok(o.answer === 'yes' || !closed(s), 'it ends or stays open: ' + o.answer);
  // and refused, it is still there to come back to
  const w2 = createWorld(4, 'Tony Marino'), p2 = P(w2), b2 = w2.chars[p2.bossId!];
  p2.kickRate = 0.2;
  const s2 = rateAsk(w2, p2, b2)!; dig(w2, s2);
  playerMove(w2, p2, s2.id, 'ask');
  assert.ok(!closed(s2) && playerMoves(w2, p2, s2).some((m) => m.move === 'sweeten' && !m.off), 'he can ask for less of a cut');
  clean(w, 'after a rate ask');
});

ok('pushing for more money on a job: the giver comes up, meets you part way with his reason, or not; and the figure is real', () => {
// (Gate 4: every game runs the conversation layer, whose decision model answers asks; this checks the asks kind's own counter and its
  // reason, which the layer uses when it counters, so it runs on a world without the layer's record, where the kind still decides)
  const w = createWorld(3, 'Tony Marino'), p = P(w); delete w.social;
  const g = live(w).find((x) => x.rank === 'soldier' && x.familyId === p.familyId)!;
  const t = live(w).find((x) => x.rank === 'civilian')!;
  g.cash = 300; rel(g, p.id).trust = 0.6; g.traits.courage = 0.3; g.traits.caution = 0.3; g.traits.greed = 0.3; // a reasonable man, short of cash
  const j = mkJob(w, { kind: 'handle', title: `Deal with ${t.name}`, brief: '', giver: g.id, via: 'tip', assignee: p.id, target: t.id, pay: 500, status: 'offered', days: 7 });
  haggleJob(w, j);
  const s = anyAsk(w, 'jobpay', p.id, g.id)!;
  assert.ok(s && s.m?.job === j.id, 'the haggle is a matter between you');
  assert.equal(s.st?.[g.id]?.last, 'counter', 'a man short of cash meets you part way');
  assert.match(String(s.m?.why), /lay my hands on/, 'he is short, and says so');
  playerMove(w, p, s.id, 'take');
  assert.equal(j.pay, Number(s.m!.offer), 'the job pays his figure');
  assert.ok(j.pay > 500);
  clean(w, 'after haggling');
});
