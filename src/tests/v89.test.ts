// V89: matters. Each check follows a real chain through the simulation: an approach opens a matter, answers come from stance,
// refusal is not the end, people go to the people they have, superiors hear, NPCs do the same on their own, and it all persists.
import assert from 'node:assert/strict';
import { perform } from '../actions';
import { audit } from '../consistency';
import { ledgerCheck } from '../econ';
import { advance, deserialize, serialize } from '../engine';
import { regard, rel } from '../core';
import { asksOf, askBetween, move, openAsk, openAsks, playerMove, playerMoves, read, stance } from '../matters';
import { kinOf, closeKin } from '../kin';
import { hierarchyIssues } from '../rank';
import { sitIssues } from '../situ';
import { DAY, type Business, type Character, type World } from '../types';
import { createWorld } from '../world';

const ok = (name: string, f: () => void) => { f(); console.log('ok   ' + name); };
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
  const w = createWorld(5, 'Tony Marino'), p = P(w);
  const b = shop(w, (x) => !x.protection), o = w.chars[b.ownerId];
  const s = openAsk(w, 'protect', p, o, { biz: b.id, amt: 60 })!;
  move(w, s, 'ask'); move(w, s, 'force');
  const boss = w.chars[p.bossId!];
  const f = Object.values(w.facts).find((x) => x.story === 'sit:' + s.id && x.kind === 'vandalism')!;
  boss.known[f.id] = { t: w.now, from: o.id, knowsActor: true };
  s.next = w.now; advance(w, w.now + 2 * DAY);
  assert.ok(w.enc.some((e) => e.kind === 'word' && e.from === boss.id), 'he calls the player in');
});

ok('NPCs pursue matters on their own: shops are approached once at a time, matters end in different ways, the world stays sound', () => {
  for (const seed of [3, 7]) {
    const w = createWorld(seed, 'Tony Marino');
    advance(w, w.now + 35 * DAY);
    const asks = (w.situations ?? []).filter((s) => s.kind === 'ask');
    assert.ok(asks.length > 20, 'matters happen without the player');
    const open = openAsks(w).filter((s) => s.ak === 'protect');
    const shops = open.map((s) => s.biz);
    assert.equal(new Set(shops).size, shops.length, 'no shop has two collectors at its door');
    const outs = new Set(Object.keys(w.sitpace?.stats ?? {}).filter((k) => k.startsWith('out.ask.')));
    assert.ok(outs.size >= 3, 'they end in more than one way: ' + [...outs]);
    assert.ok(asks.some((s) => s.m?.help), 'somebody went to somebody');
    clean(w, 'seed ' + seed + ' day 35');
  }
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
console.log('all passed');
