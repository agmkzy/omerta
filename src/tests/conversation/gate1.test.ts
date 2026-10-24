// Gate 1 of the conversation rebuild (docs/CONVERSATION_SPEC.md, src/conv/): the rules the proof of concept has to keep. Choices
// are only what is on screen; a listener works from what was said and what he knows, never the truth; a man remembers what has
// passed within a visit; a lie has a reason, is judged without the truth, and can be found out; the four kinds of promise are kept
// or broken by what they undertook; and the engine holds up on people and requests nobody scripted.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, ownerBiz, rel } from '../../core';
import { DAY } from '../../types';
import { Out, Visit, LEAVE } from '../../conv/harness';
import { newSession, perceive } from '../../conv/perception';
import { interpret } from '../../conv/speech';
import { render } from '../../conv/render';
import { ClaimStore, believe, contradictions } from '../../conv/beliefs';
import { Obligations } from '../../conv/obligations';
import { onCollectionReport, onConfrontation, onIntervention, predictAcceptance } from '../../conv/respond';
import { buildTranscripts, deceptionWorld, ferraraWorld, settleConfrontation } from '../../conv/gate1';
import { generalisation } from '../../conv/gen';
import { newWorld, P } from '../helpers';

const shopkeeper = (seed: number) => { const w = newWorld(seed); return { w, c: Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open).sort((a, b) => (a.id < b.id ? -1 : 1))[0] }; };

describe('choices are only what is on screen', () => {
  ok('picking a row that was not offered throws, and so does offering more than five', { tags: ['unit'] }, () => {
    const { w, c } = shopkeeper(3), v = new Visit(new Out(), w, newSession(), P(w), c, 'the shop');
    v.offer([{ key: 'buy.small', note: '' }, LEAVE]);
    assert.throws(() => v.pick('demand.protection'), /was not on screen/);
    v.pick('buy.small');
    assert.throws(() => v.pick('buy.small'), /was not on screen/, 'a row is gone once picked');
    assert.throws(() => v.offer(Array.from({ length: 6 }, (_, i) => ({ key: 'k' + i, note: '' }))), /more than five/);
  });
});

describe('subjective knowledge', () => {
  ok('a shopkeeper does not know who Henry is until told; then he knows it as a claim', { tags: ['unit'] }, () => {
    const { w, c } = shopkeeper(3), s = newSession(), henry = P(w);
    assert.equal(perceive(w, s, c).identityOf(henry).known, false);
    s.told[c.id] = { [henry.id]: { family: w.fam[henry.familyId!].name, name: henry.name, basis: { kind: 'claimed', ref: 'introduced himself' } } };
    const id = perceive(w, s, c).identityOf(henry);
    assert.equal(id.known, true); assert.equal(id.basis[0].kind, 'claimed');
  });
  ok('an indirect remark is read from the listener’s own state: the same words, two different men, two readings', { tags: ['unit'] }, () => {
    const { w, c } = shopkeeper(3), s = newSession(), henry = P(w);
    const sp = { speaker: henry.id, listener: c.id, act: 'compliment', explicit: 0 as const, meaning: { key: 'compliment.business', stance: 'flat' as const, toward: 'speaker' as const }, where: 'the shop', at: w.now };
    const before = interpret(perceive(w, s, c), sp, henry);
    // he is given what would make him wary (a protector, and trouble on his street that he saw), nothing about Henry changes
    const b = ownerBiz(w, c.id)!, other = Object.values(w.biz).find((x) => x.id !== b.id && x.district === b.district && x.open)!;
    b.protection = { collectorId: Object.values(w.chars).find((x) => x.rank === 'soldier')!.id, familyId: henry.familyId!, fee: 25 } as typeof b.protection;
    addFact(w, { kind: 'vandalism', actor: Object.values(w.chars).find((x) => x.rank === 'soldier')!.id, victim: other.ownerId, business: other.id, text: 'x', district: b.district }, { witnesses: [c.id] });
    const after = interpret(perceive(w, s, c), sp, henry);
    assert.ok(after.confidence > before.confidence, `${before.confidence} -> ${after.confidence}`);
    assert.equal(after.act, 'demand.protection');
  });
  ok('a listener’s belief in a claim does not depend on whether it is true', { tags: ['unit'] }, () => {
    const { w, s, henry, joey } = deceptionWorld(0);
    const a = new ClaimStore(), b = new ClaimStore();
    const ca = a.add({ by: joey.id, to: henry.id, subject: 'paid:gino', value: 100, t: w.now, honest: true, words: '' });
    const cb = b.add({ by: joey.id, to: henry.id, subject: 'paid:gino', value: 100, t: w.now, honest: false, words: '' });
    assert.deepStrictEqual(believe(perceive(w, s, henry), a, ca, joey), believe(perceive(w, s, henry), b, cb, joey));
  });
});

describe('memory within a visit', () => {
  ok('a captain pressed with argument after argument moves to a condition, then cuts it off, without repeating himself', { tags: ['scenario'] }, () => {
    const { w, s, henry, riz, lou, nate, k } = ferraraWorld();
    const v = new Visit(new Out(), w, s, henry, riz, 'the club', 2), keys: string[] = [], lines = new Set<string>();
    const args: ('ground' | 'word' | 'money')[] = [];
    let r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, args, v.mem);
    keys.push(r.meaning.key);
    for (const a of ['ground', 'word', 'money'] as const) {
      if (!r.nextArgs.includes(a)) break;
      v.mem.argued.push(a); args.push(a);
      r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, args, v.mem);
      keys.push(r.meaning.key);
      const line = render(r.meaning, riz.id, perceive(w, s, riz).arch, lines);
      assert.ok(!line.startsWith('[missing'), line);
    }
    assert.ok(keys.includes('condition.intervention'), keys.join(' > '));
    assert.equal(keys.at(-1), 'cutOff.argument', keys.join(' > '));
  });
});

describe('deception', () => {
  const liar = () => { for (let i = 0; i < 6; i++) { const x = deceptionWorld(i); x.joey.cash += 200; if (!onCollectionReport(perceive(x.w, x.s, x.joey), x.henry, x.gino, 200).honest) return i; } return -1; };
  ok('a man lies only with a reason: in trouble he skims, out of it he does not', { tags: ['scenario'] }, () => {
    for (let i = 0; i < 6; i++) {
      const out = deceptionWorld(i, 0); out.joey.cash += 200;
      assert.ok(onCollectionReport(perceive(out.w, out.s, out.joey), out.henry, out.gino, 200).honest, `${out.joey.name} lied with no reason to`);
    }
    assert.ok(liar() >= 0, 'nobody lied even in trouble');
  });
  ok('the lie is believed, found out only through another man’s word, and has consequences', { tags: ['scenario'] }, () => {
    const { w, s, henry, store, joey, gino } = deceptionWorld(liar());
    joey.cash += 200;
    const rep = onCollectionReport(perceive(w, s, joey), henry, gino, 200);
    assert.equal(rep.honest, false); assert.ok(rep.says < 200);
    const c1 = store.add({ by: joey.id, to: henry.id, subject: 'paid:gino', value: rep.says, t: w.now, honest: false, words: '' });
    assert.ok(believe(perceive(w, s, henry), store, c1, joey).belief > 0.5, 'Henry believes his man');
    assert.equal(contradictions(perceive(w, s, henry), store).length, 0, 'nothing to go on yet: the truth is not his to see');
    w.now += 2 * DAY;
    store.add({ by: gino.id, to: henry.id, subject: 'paid:gino', value: 200, t: w.now, honest: true, words: '' });
    assert.equal(contradictions(perceive(w, s, henry), store).length, 1);
    assert.ok(believe(perceive(w, s, henry), store, c1, joey).belief < 0.65, 'doubt, once he has heard otherwise');
    const trust0 = rel(henry, joey.id).trust;
    const cf = onConfrontation(perceive(w, s, joey), henry, true, 0.6);
    assert.ok(['admit', 'deny', 'defy'].includes(cf.decision.chosen));
    assert.ok(cf.decision.candidates.length === 3 && cf.decision.candidates.every((c) => c.terms.length > 0), 'his own decision, with reasons');
    const cash0 = henry.cash;
    settleConfrontation(w, henry, joey, cf.admits, rep.keeps, 'Gino');
    assert.ok(rel(henry, joey.id).trust < trust0, 'Henry trusts him less');
    if (cf.admits) assert.equal(henry.cash, cash0 + rep.keeps, 'the money comes back');
  });
  ok('an honest report gives Henry nothing to confront', { tags: ['scenario'] }, () => {
    const { w, s, henry, store, joey, gino } = deceptionWorld(0, 0);
    joey.cash += 200;
    const rep = onCollectionReport(perceive(w, s, joey), henry, gino, 200);
    store.add({ by: joey.id, to: henry.id, subject: 'paid:gino', value: rep.says, t: w.now, honest: rep.honest, words: '' });
    store.add({ by: gino.id, to: henry.id, subject: 'paid:gino', value: 200, t: w.now, honest: true, words: '' });
    assert.equal(contradictions(perceive(w, s, henry), store).length, 0);
  });
});

describe('the four kinds of promise', () => {
  const setup = (type: 'action' | 'effort' | 'result' | 'restraint') => {
    const f = ferraraWorld(); f.w.now = 9 * DAY;
    const obs = new Obligations(), biz = ownerBiz(f.w, f.nate.id)!;
    const spec = type === 'action' ? { kind: 'actionDone' as const, act: 'raise', target: f.riz.id, about: 'lou-nate' }
      : type === 'effort' ? { kind: 'effort' as const, acts: ['raise', 'askOther'], about: 'lou-nate', floor: 0.15 }
      : type === 'result' ? { kind: 'noHostility' as const, actor: f.lou.id, target: f.nate.id, biz: biz.id, days: 30 }
      : { kind: 'notDisclosedBy' as const, about: 'nate-complained' };
    const ob = obs.make({ type, obligor: f.henry.id, beneficiary: f.nate.id, spec, from: f.w.now, by: f.w.now + (type === 'result' ? 30 : 14) * DAY });
    return { ...f, obs, ob, biz, at: (d: number) => { f.w.now = 9 * DAY + d * DAY; } };
  };
  ok('action: kept by doing it although the captain refused; broken by not doing it although things turned out well', { tags: ['scenario'] }, () => {
    const a = setup('action'); a.at(2);
    const r = onIntervention(perceive(a.w, a.s, a.riz), a.henry, a.nate, a.lou, a.k, []);
    assert.notEqual(r.decision.chosen, 'accept', 'the captain refuses');
    a.obs.did({ t: a.w.now, actor: a.henry.id, act: 'raise', target: a.riz.id, about: 'lou-nate' });
    a.obs.tick(a.w); assert.equal(a.ob.status, 'kept');
    const b = setup('action'); b.at(10); b.obs.tick(b.w); assert.equal(b.ob.status, 'pending');
    b.at(15); b.obs.tick(b.w);
    assert.equal(b.ob.status, 'broken', 'no hostility happened, Lou stopped, and it is broken all the same');
  });
  ok('effort: a failed attempt he had reason to think might work keeps it; a gesture does not', { tags: ['scenario'] }, () => {
    const a = setup('effort'); a.at(2);
    const pred = predictAcceptance(perceive(a.w, a.s, a.henry), a.riz, false);
    assert.ok(pred >= 0.15, `Henry's own expectation ${pred}`);
    a.obs.did({ t: a.w.now, actor: a.henry.id, act: 'raise', target: a.riz.id, about: 'lou-nate', predicted: pred });
    a.obs.tick(a.w); assert.equal(a.ob.status, 'kept');
    const b = setup('effort'); b.at(3);
    b.obs.did({ t: b.w.now, actor: b.henry.id, act: 'askOther', about: 'lou-nate', predicted: 0.02 });
    b.obs.tick(b.w); assert.equal(b.ob.status, 'pending', 'not settled by a gesture');
    b.at(24); b.obs.tick(b.w); assert.equal(b.ob.status, 'broken');
  });
  ok('result over a period: pending while clean, broken at the first violation, kept only when the whole period has passed', { tags: ['scenario'] }, () => {
    const a = setup('result'); a.at(10); a.obs.tick(a.w); assert.equal(a.ob.status, 'pending');
    a.at(12);
    addFact(a.w, { kind: 'vandalism', actor: a.lou.id, victim: a.nate.id, business: a.biz.id, text: 'x', district: a.biz.district }, { witnesses: [a.nate.id] });
    a.obs.tick(a.w); assert.equal(a.ob.status, 'broken'); assert.equal(a.ob.settled, 9 * DAY + 12 * DAY);
    const b = setup('result'); b.at(20); b.obs.tick(b.w); assert.equal(b.ob.status, 'pending');
    b.at(31); b.obs.tick(b.w); assert.equal(b.ob.status, 'kept');
  });
  ok('restraint: judged on his conduct only; kept although it got out another way, broken when he tells', { tags: ['scenario'] }, () => {
    const a = setup('restraint'); a.at(4);
    addFact(a.w, { kind: 'rumour', actor: a.nate.id, text: 'x', district: a.biz.district, minor: true }, { witnesses: [a.lou.id] });
    a.at(16); a.obs.tick(a.w); assert.equal(a.ob.status, 'kept');
    const b = setup('restraint'); b.at(5);
    b.obs.did({ t: b.w.now, actor: b.henry.id, act: 'inform', target: b.lou.id, about: 'nate-complained' });
    b.obs.tick(b.w); assert.equal(b.ob.status, 'broken');
  });
  ok('on screen, a promise is in a man’s words, never its type', { tags: ['unit'] }, () => {
    for (const t of ['action', 'effort', 'result', 'restraint']) {
      const line = render({ key: 'promise.' + t, stance: 'flat', toward: 'speaker' }, 'h', 'earnest');
      assert.ok(!line.startsWith('[missing'), line);
      assert.doesNotMatch(line, /action|effort|result|restraint|promise/i, line);
    }
  });
});

describe('generalisation and determinism', () => {
  ok('the Gate 1 transcripts are the same every time', { tags: ['determinism'] }, () => {
    assert.equal(buildTranscripts(), buildTranscripts());
  });
  const g = generalisation(new Out());
  ok('people and requests nobody scripted: no holes, no unfilled slots, and regard changes what men decide', { tags: ['scenario'] }, () => {
    assert.ok(g.visits >= 150, `${g.visits} visits`);
    assert.deepStrictEqual(g.missing, []); assert.deepStrictEqual(g.gaps, []);
    const kinds = (k: string) => Object.keys(g.decisions[k] ?? {});
    assert.ok(kinds('loan · knows and trusts him').length >= 2, 'a trusted man does not answer a loan one way');
    assert.notDeepStrictEqual(g.decisions['loan · as it stands'], g.decisions['loan · knows and trusts him']);
    assert.ok(kinds('protection · as it stands').length >= 2);
  });
  // A known failure (Gate 1 limitation): the meaning of an answer carries no place for what the speaker is to the matter, so the
  // man whose own shop was hit is given a bystander's line. Expected to fail until the meaning carries his role.
  ok.fails('a victim is never given a bystander’s line', { tags: ['scenario'] }, () => {
    assert.deepStrictEqual(g.roleMismatch, []);
  });
  // A known failure (Gate 1 limitation): some lines still carry the worked examples' particulars (a bakery, a window, a Tuesday,
  // "for years", "across the street") that the decision never established for this man.
  ok.fails('no line asserts a particular the decision did not establish', { tags: ['scenario'] }, () => {
    assert.deepStrictEqual(g.assumed, []);
  });
});
