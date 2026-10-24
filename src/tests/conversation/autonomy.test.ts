// Gate 2b acceptance (docs/CONVERSATION_SPEC.md §15): autonomous social behaviour and subjective beliefs, in worlds that run the
// conversation layer (World.social). One model of decision for asks; pursuits instead of automatic fulfilment; NPC-to-NPC requests by
// the player's rules; beliefs (contradiction, misinformation, verification, revision) deciding what men do and what they think of each
// other; orders down the hierarchy, kept or broken by each man's own judgement; the remaining obligation semantics; one door for money;
// and long runs: emergence, determinism, saves, size. Nothing here stages a betrayal: where a test needs a man's knowledge or feeling
// to be something, it is set as a fact of his situation, and what he does about it is his.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addFact, ownerBiz, peek, rel, transfer } from '../../core';
import { advance, deserialize, serialize } from '../../engine';
import { audit } from '../../consistency';
import { ledgerCheck } from '../../econ';
import { moneyTotal } from '../../goals';
import { layoffFor, openAsk, move as askMove } from '../../asks';
import { DAY, type World } from '../../types';
import { social } from '../../conv/social';
import { promise, request } from '../../conv/tick';
import { conflicts, injured, offender, release, settle, withdraw } from '../../conv/obligations';
import { belief, judge, say } from '../../conv/minds';
import { breakWish } from '../../conv/obey';
import { onKeepWord, onProtectionDemand } from '../../conv/respond';
import { newSession, perceive } from '../../conv/perception';
import { annals } from '../../conv/annals';
import { chainOf, emergence } from '../../conv/emergence';
import { scenarioG } from '../../conv/scenarioG';
import * as door from '../../conv/doors';
import { cast } from '../../conv/ferrara';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const civ = (w: World, n = 0) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection).sort(byId)[n];
const sol = (w: World, n = 0) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier').sort(byId)[n];

describe('one model of decision (priority 1)', () => {
  ok('in a world running the layer, a shopkeeper answers a collector by the same decision he would give the player', { tags: ['unit'] }, () => {
    const w = newWorld(3); social(w);
    const a = sol(w), t = civ(w), b = ownerBiz(w, t.id)!;
    const ss = newSession(); ss.told[t.id] = { [a.id]: { family: w.fam[a.familyId!].name, name: a.name, basis: { kind: 'claimed', ref: 'x' } } };
    const expect = onProtectionDemand(perceive(w, ss, t), a, 40, 'plain').decision.chosen;
    annals.length = 0;
    const s = openAsk(w, 'protect', a, t, { biz: b.id, amt: 40 })!;
    const out = askMove(w, s, 'ask');
    const e = annals.find((x) => x.who === t.id && x.with === a.id)!;
    assert.equal(e.reply!.decision.chosen, expect);
    assert.equal(out.answer, { accept: 'yes', counter: 'counter', refer: 'help' }[expect as string] ?? 'no');
  });
  ok('in a world without the layer, the ask decides as it always did (nothing of the layer runs)', { tags: ['unit'] }, () => {
    const w = newWorld(3); annals.length = 0;
    const s = openAsk(w, 'protect', sol(w), civ(w), { biz: ownerBiz(w, civ(w).id)!.id, amt: 40 })!;
    askMove(w, s, 'ask');
    assert.equal(annals.length, 0); assert.equal(w.social, undefined);
  });
});

describe('pursuits, not automatic fulfilment (priority 2)', () => {
  ok('a man who promised to act decides each day: it depends on what it costs him, whom he promised, and the time left', { tags: ['unit'] }, () => {
    const c = cast(3)!, p = perceive(c.w, newSession(), c.riz);
    const x = (cost: number, days: number) => onKeepWord(p, c.henry, cost, days, true).decision.chosen;
    assert.equal(x(0.1, 1), 'act', 'cheap, and due tomorrow');
    assert.notEqual(x(0.9, 6), 'act', 'dear, with time yet: he puts it off, asks to be let off, or lets it go');
    assert.equal(onKeepWord(p, c.henry, 0.1, 3, false).decision.chosen === 'act', false, 'he cannot act while he cannot');
  });
  const G = { acquainted: scenarioG('acquainted'), stranger: scenarioG('stranger') };
  ok('a refused demand starts the shopkeeper’s own pursuit; men who turned him down are not asked again; learning who the man answers to changes his plan', { tags: ['scenario'] }, () => {
    const t = G.stranger.o.text();
    assert.match(t, /starts a pursuit: make .* leave him alone/);
    assert.match(t, /changes his plan: .* because he now believes .* answers to/);
    const asks = [...t.matchAll(/asks (\w+ \w+) to take up his trouble/g)].map((m) => m[1]);
    assert.equal(new Set(asks).size, asks.length, `nobody asked twice: ${asks.join(', ')}`);
  });
  ok('relationships change what people initiate: the shopkeeper comes to Henry only if he knows him', { tags: ['scenario'] }, () => {
    assert.equal(G.acquainted.m.nateCame, true);
    assert.equal(G.stranger.m.nateCame, false);
  });
});

describe('beliefs decide (priority 4)', () => {
  // a smashed shop: its owner, a man who saw it, two men who did not
  function smashed() {
    const w = newWorld(3); social(w);
    const owner = civ(w), b = ownerBiz(w, owner.id)!, actor = sol(w, 0), wrong = sol(w, 1);
    const others = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && c.id !== owner.id).sort(byId);
    const f = addFact(w, { kind: 'vandalism', actor: actor.id, victim: owner.id, business: b.id, hiddenActor: true, text: 'x', district: b.district }, { witnesses: [others[0].id] });
    for (const c of others.slice(0, 3)) { rel(owner, c.id).trust = 0.6; rel(owner, c.id).known = 0.5; }
    return { w, owner, actor, wrong, saw: others[0], told: others[1], third: others[2], f };
  }
  ok('two accounts he trusts that disagree leave him uncertain, and he reserves judgement; a third settles it', { tags: ['unit'] }, () => {
    const { w, owner, actor, wrong, saw, told, third, f } = smashed();
    say(w, saw, owner, 'who:' + f.id, actor.id, 'seen', true);
    say(w, told, owner, 'who:' + f.id, wrong.id, 'seen', false);
    const b = belief(w, owner, 'who:' + f.id);
    assert.equal(b.uncertain, true, JSON.stringify(b));
    say(w, third, owner, 'who:' + f.id, actor.id, 'seen', true);
    assert.equal(belief(w, owner, 'who:' + f.id).value, actor.id); assert.equal(belief(w, owner, 'who:' + f.id).uncertain, false);
  });
  ok('misinformation and revision: he blames the wrong man on a story, then learns otherwise; the grudge moves with the belief, not the truth', { tags: ['unit'] }, () => {
    const { w, owner, actor, wrong, saw, told, f } = smashed();
    say(w, told, owner, 'who:' + f.id, wrong.id, 'rumour', true); // (honest: he believes it; it is wrong)
    assert.equal(belief(w, owner, 'who:' + f.id).value, wrong.id);
    assert.ok(peek(owner, wrong.id).grudge > 0, 'he holds it against the man he believes did it');
    const g0 = peek(owner, wrong.id).grudge;
    say(w, saw, owner, 'who:' + f.id, actor.id, 'seen', true);
    say(w, saw, owner, 'who:' + f.id, actor.id, 'seen', true);
    const b = belief(w, owner, 'who:' + f.id);
    if (b.value === actor.id) { assert.ok(peek(owner, wrong.id).grudge < g0, 'the wrong blame is let go'); assert.ok(peek(owner, actor.id).grudge > 0); }
    assert.ok(social(w).revisions!.some((r) => r.who === owner.id && r.subject === 'who:' + f.id && r.from === wrong.id));
  });
  ok('what a man thinks of another follows what he believes happened: a broken promise believed kept earns trust; found out, it costs more', { tags: ['unit'] }, () => {
    const c = cast(3)!, { w, henry, nate, riz } = c; social(w);
    const ob = promise(w, { type: 'action', obligor: henry.id, beneficiary: nate.id, promisee: nate.id, spec: { kind: 'actionDone', act: 'raise', target: riz.id, about: 'm' }, from: w.now, by: w.now + 7 * DAY });
    rel(nate, henry.id).known = 0.6; rel(nate, riz.id).known = 0.6; rel(nate, riz.id).trust = 0.7;
    const t0 = peek(nate, henry.id).trust;
    say(w, henry, nate, 'ob:' + ob.id, 'done', 'own', false, 'I took it to the family'); // (a lie: he never did)
    judge(w, nate, ob);
    assert.ok(peek(nate, henry.id).trust > t0, 'believed, it earns him trust');
    w.now += 8 * DAY; settle(w, social(w));
    assert.equal(ob.status, 'broken', 'in fact it was never done');
    say(w, riz, nate, 'ob:' + ob.id, 'notDone', 'own', true, 'He never came to me.');
    judge(w, nate, ob);
    const t1 = peek(nate, henry.id).trust;
    assert.equal(belief(w, nate, 'ob:' + ob.id).uncertain, true, 'two accounts he takes seriously: he cannot tell whom to believe');
    assert.equal(t1, peek(nate, henry.id).trust, 'and reserves judgement');
    // he checks with a third man who would know (the captain's man, who was there): now it is settled, and it was a lie
    const third = Object.values(w.chars).find((x) => x.alive && x.bossId === riz.id && !x.isPlayer)!;
    rel(nate, third.id).trust = 0.6; rel(nate, third.id).known = 0.5;
    say(w, third, nate, 'ob:' + ob.id, 'notDone', 'seen', true, 'Henry never came by.');
    judge(w, nate, ob);
    assert.equal(belief(w, nate, 'ob:' + ob.id).value, 'notDone'); assert.equal(belief(w, nate, 'ob:' + ob.id).uncertain, false);
    assert.ok(peek(nate, henry.id).trust < t0, 'found out, and lied to: below where he started');
    assert.ok(social(w).judged!.some((j) => j.ob === ob.id && j.lied));
  });
});

describe('organisational responsibility (priority 5)', () => {
  ok('an order to a man is passed to his own men, and whether each keeps it is his own judgement, made when the chance comes', { tags: ['scenario'] }, () => {
    const c = cast(3, 0)!, { w, lou, nate, biz, marchese } = c; social(w);
    const r = request(w, { by: marchese.id, of: marchese.id, wants: 'order', about: 'm', for: nate.id, against: lou.id, biz });
    const { sit } = door.order(w, marchese, lou, nate, 'm'); r.sit = sit?.id;
    advance(w, w.now + 6 * DAY);
    const o3 = social(w).obs.find((o) => o.order && o.obligor === lou.id);
    if (!o3) return void assert.ok(r.status === 'refused' || r.rode?.out, 'he refused his captain, through the ask');
    const men = Object.values(w.chars).filter((x) => x.alive && x.bossId === lou.id);
    assert.equal(social(w).obs.filter((o) => o.order && o.parent === o3.id).length, Math.min(6, men.length));
    // what tips a man towards breaking it is his situation, as he feels it: the same man weighs it differently with a grudge
    const before = breakWish(w, lou, nate.id, biz)!;
    door.grudge(w, lou, nate.id, 0.6, 'a grudge, as a fact of his situation');
    assert.ok(breakWish(w, lou, nate.id, biz)! > before);
  });
});

describe('obligation semantics (priority 6)', { tags: ['unit'] }, () => {
  const base = () => { const w = newWorld(3); social(w); return { w, p: P(w), t: civ(w), s: sol(w) }; };
  ok('released by the promisee: no break; withdrawn by the obligor: judged less harshly than a break', () => {
    const { w, p, t, s } = base();
    const a = promise(w, { type: 'action', obligor: s.id, beneficiary: t.id, spec: { kind: 'actionDone', act: 'raise', target: p.id, about: 'a' }, from: w.now, by: w.now + 7 * DAY });
    const b = promise(w, { type: 'action', obligor: s.id, beneficiary: t.id, spec: { kind: 'actionDone', act: 'raise', target: p.id, about: 'b' }, from: w.now, by: w.now + 7 * DAY });
    const c = promise(w, { type: 'action', obligor: s.id, beneficiary: t.id, spec: { kind: 'actionDone', act: 'raise', target: p.id, about: 'c' }, from: w.now, by: w.now + 7 * DAY });
    release(w, a, 'let off'); withdraw(w, b, 'cannot');
    say(w, s, t, 'ob:' + b.id, 'withdrawn', 'own', true);
    w.now += 8 * DAY; settle(w, social(w));
    assert.equal(a.status, 'released'); assert.equal(b.status, 'withdrawn'); assert.equal(c.status, 'broken');
    rel(t, s.id).known = 0.6; say(w, s, t, 'ob:' + c.id, 'notDone', 'own', true);
    judge(w, t, b); judge(w, t, c);
    const jb = social(w).judged!.find((j) => j.ob === b.id)!, jc = social(w).judged!.find((j) => j.ob === c.id)!;
    assert.ok(jb.applied > jc.applied, `withdrawn ${jb.applied} vs broken ${jc.applied}`);
  });
  ok('conflicts are found when the second is made: bound to leave a man alone, and bound to lean on him', () => {
    const { w, t, s } = base(), boss = w.chars[s.bossId!];
    const x = promise(w, { type: 'restraint', obligor: s.id, beneficiary: boss.id, spec: { kind: 'noHostility', actor: s.id, target: t.id, days: 30 }, from: w.now, by: w.now + 30 * DAY });
    const y = promise(w, { type: 'action', obligor: s.id, beneficiary: boss.id, spec: { kind: 'actionDone', act: 'demand', target: t.id, about: 'shop' }, from: w.now, by: w.now + 7 * DAY });
    assert.deepEqual(y.conflicts, [x.id]); assert.deepEqual(x.conflicts, [y.id]);
    assert.deepEqual(conflicts(social(w), x).map((o) => o.id), [y.id]);
  });
  ok('paid, knows, notKnows, all and any', () => {
    const { w, p, t, s } = base();
    const paid = promise(w, { type: 'result', obligor: p.id, beneficiary: t.id, spec: { kind: 'paid', from: p.id, to: t.id, amount: 100 }, from: w.now, by: w.now + 7 * DAY });
    const f = addFact(w, { kind: 'rumour', text: 'x', district: t.district }, { witnesses: [p.id] });
    const knows = promise(w, { type: 'result', obligor: p.id, beneficiary: t.id, spec: { kind: 'knows', who: s.id, fact: f.id }, from: w.now, by: w.now + 7 * DAY });
    const quiet = promise(w, { type: 'result', obligor: p.id, beneficiary: t.id, spec: { kind: 'notKnows', who: 'anyone', fact: f.id, except: [s.id] }, from: w.now - 1, by: w.now + 7 * DAY });
    const both = promise(w, { type: 'result', obligor: p.id, beneficiary: t.id, spec: { kind: 'all', of: [{ kind: 'paid', from: p.id, to: t.id, amount: 100 }, { kind: 'knows', who: s.id, fact: f.id }] }, from: w.now, by: w.now + 7 * DAY });
    const either = promise(w, { type: 'result', obligor: p.id, beneficiary: t.id, spec: { kind: 'any', of: [{ kind: 'paid', from: p.id, to: t.id, amount: 5000 }, { kind: 'knows', who: s.id, fact: f.id }] }, from: w.now, by: w.now + 7 * DAY });
    w.now += 1;
    door.pay(w, p, t, 100, 'owed'); door.inform(w, p, s, f, 'x');
    settle(w, social(w));
    assert.deepEqual([paid.status, knows.status, quiet.status, both.status, either.status], ['kept', 'kept', 'pending', 'kept', 'kept']);
    door.inform(w, p, t, f, 'x'); settle(w, social(w));
    assert.equal(quiet.status, 'broken', 'he told someone outside the few allowed');
  });
});

describe('one door for money (priority 7)', () => {
  ok('nothing in asks.ts or the conversation layer moves money between men except through core.transfer', { tags: ['architecture'] }, () => {
    const src = fileURLToPath(new URL('../../', import.meta.url)), bad: string[] = [];
    const files = ['asks.ts', ...readdirSync(src + 'conv').filter((f) => f.endsWith('.ts') && !['gate1.ts', 'gen.ts'].includes(f)).map((f) => 'conv/' + f)];
    for (const f of files) readFileSync(src + f, 'utf8').split('\n').forEach((l, i) => { if (/\.cash\s*[-+]=/.test(l) && !/\(to a business\)/.test(l) && !/\b(b|biz|shop)\.cash/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 90)}`); });
    assert.deepEqual(bad, []);
  });
  ok('a transfer conserves money, never exceeds what he has, and is on the ledger for the player’s circle', { tags: ['unit'] }, () => {
    const w = newWorld(3), p = P(w), boss = w.chars[p.bossId!], m0 = moneyTotal(w), l0 = (w.ledger ?? []).length;
    const have = Math.floor(p.cash), b0 = boss.cash;
    assert.equal(transfer(w, p, boss, have + 500, 'gift'), have, 'never more than he has');
    assert.equal(p.cash, 0); assert.equal(boss.cash, b0 + have);
    assert.equal(moneyTotal(w), m0); assert.equal((w.ledger ?? []).length, l0 + 1);
  });
});

describe('long runs (priority 8)', () => {
  const SEEDS = [3, 7, 11, 19];
  const runs = SEEDS.map((seed) => { annals.length = 0; const w = newWorld(seed); social(w); advance(w, w.now + 120 * DAY); return { seed, w, e: emergence(w) }; });
  ok('120 days, four seeds: the world audits clean, the records stay bounded and within the save budget', { tags: ['sim'] }, () => {
    for (const { seed, w } of runs) {
      assert.deepEqual(audit(w), [], `seed ${seed}`); assert.deepEqual(ledgerCheck(w), [], `seed ${seed}`);
      const kb = JSON.stringify(w.social).length / 1024;
      assert.ok(kb < 150, `seed ${seed}: ${Math.round(kb)} KB of the layer's records at day 120 (budget 150)`);
      assert.ok((w.social!.pursuits ?? []).filter((p) => p.status === 'active').length <= 120);
    }
  });
  ok('emergence floors (set from the first baseline, held as regressions): pursuits through two or more people, plans changed by what was learnt, requests answered between NPCs', { tags: ['sim'] }, () => {
    const sum = (k: 'throughTwo' | 'revisionsChangedPlan' | 'requests' | 'pursuits') => runs.reduce((a, r) => a + r.e[k], 0);
    assert.ok(sum('pursuits') >= 80, `${sum('pursuits')} pursuits`);
    assert.ok(sum('throughTwo') >= 8, `${sum('throughTwo')} through two or more people`);
    assert.ok(sum('revisionsChangedPlan') >= 4, `${sum('revisionsChangedPlan')} plans changed by a revision`);
    assert.ok(sum('requests') >= 80, `${sum('requests')} requests`);
  });
  ok('identity holds through every chain: each linked request carries the same victim and offender as the one it came from, and promises made for it the same', { tags: ['sim'] }, () => {
    for (const { seed, w } of runs) {
      const so = social(w);
      for (const r of so.requests) {
        const c = chainOf(w, r);
        for (const x of c) { assert.equal(x.for ?? c[0].for, c[0].for, `seed ${seed}: ${x.id} is for ${x.for}, its chain for ${c[0].for}`); assert.equal(x.against ?? c[0].against, c[0].against, `seed ${seed}: ${x.id} against ${x.against}, its chain against ${c[0].against}`); }
      }
      for (const o of so.obs) { const g = so.agreements.find((a) => a.id === o.agreement), r = g && so.requests.find((q) => q.id === g.madeIn); if (r && o.matter) { assert.equal(o.matter.for, r.for, `seed ${seed}: ${o.id}`); assert.equal(o.matter.against, r.against, `seed ${seed}: ${o.id}`); } }
    }
  });
  ok('a man ordered to leave alone the man who complained of him is never told he did nothing to him (the refusal names who caused the trouble)', { tags: ['sim'] }, () => {
    const w = newWorld(3), s = sol(w), t = civ(w);
    const f = addFact(w, { kind: 'protection_refused', actor: t.id, victim: s.id, business: ownerBiz(w, t.id)!.id, text: 'x', district: t.district }, {});
    assert.equal(offender(f), s.id); assert.equal(injured(f), t.id);
    social(w); annals.length = 0;
    const boss = Object.values(w.chars).find((c) => c.id === s.bossId)!;
    const sit = layoffFor(w, boss, s, t, f.id)!;
    askMove(w, sit, 'ask');
    const e = annals.find((x) => x.who === s.id && /to leave .* alone/.test(x.what))!;
    assert.ok(e, 'he answered his superior');
    assert.ok(!e.reply!.decision.candidates.some((c) => c.terms.some((tm) => tm.name.includes('never touched him'))), JSON.stringify(e.reply!.decision.candidates));
  });
  ok('the same seed gives the same society; saved halfway and loaded, it goes on exactly as it would have', { tags: ['determinism'] }, () => {
    const a = newWorld(7); social(a); advance(a, a.now + 30 * DAY);
    const b = deserialize(serialize(a));
    advance(a, a.now + 30 * DAY); advance(b, b.now + 30 * DAY);
    const c = newWorld(7); social(c); advance(c, c.now + 60 * DAY);
    const j = (x: World) => JSON.parse(JSON.stringify(x.social));
    assert.deepStrictEqual(j(b), j(a)); assert.deepStrictEqual(j(c), j(a));
  });
});

describe('Scenario G: thirty days with the same five people', () => {
  const L = scenarioG('liar'), A = scenarioG('acquainted');
  ok('memory: a refused request is not offered again unless something bearing on it changed; routine visits make nothing up', { tags: ['scenario'] }, () => {
    for (const r of [L, A]) { assert.equal(r.m.reoffered, 0); assert.equal(r.m.routineDevelopments, 0); assert.ok(r.m.routineVisits > 0); }
  });
  ok('lines reflect changing circumstances: the man in trouble opens differently as things change; the same evening out is not the same evening twice', { tags: ['scenario'] }, () => {
    const nate = A.c.nate.name;
    assert.ok(new Set(A.m.openings[nate]).size >= 3, JSON.stringify(A.m.openings[nate]));
    assert.ok(new Set(A.m.spendTexts).size >= A.m.spendTexts.length / 2, `${new Set(A.m.spendTexts).size} of ${A.m.spendTexts.length}`);
  });
  ok('a lie is a claim: believed, it is judged as the truth would have been (until something shows otherwise)', { tags: ['scenario'] }, () => {
    assert.ok(L.m.liesBelieved >= 1);
    const ob = social(L.c.w).obs.find((o) => o.obligor === L.c.henry.id)!;
    assert.equal(ob.status, 'broken', 'in fact he never raised it');
    assert.ok(['done', undefined].includes(belief(L.c.w, L.c.nate, 'ob:' + ob.id).value) || L.m.liesFound > 0);
  });
});

describe('a year (opt-in: SLOW=1)', () => {
  ok('365 days with the layer running: the records stay within the year budget, and the world audits clean', { tags: ['sim', 'slow'] }, () => {
    const w = newWorld(3); social(w); advance(w, w.now + 365 * DAY);
    const kb = JSON.stringify(w.social).length / 1024;
    assert.ok(kb < 250, `${Math.round(kb)} KB at day 365 (budget 250)`); assert.deepEqual(audit(w), []);
  });
});
