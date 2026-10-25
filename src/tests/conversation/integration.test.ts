// Gate 2a acceptance (docs/CONVERSATION_SPEC.md §15): the new records executing against the existing economy, hierarchy, knowledge
// and world tick. Every action calls an existing door (scan); the obligation time rules (§6.5) on world records; the Ferrara chain
// run headless against real records, end to end; the ledger and the audits; NPC behaviour reading an obligation; saves; determinism.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addFact, ownerBiz, peek } from '../../core';
import { advance, deserialize, serialize } from '../../engine';
import { audit } from '../../consistency';
import { ledgerCheck } from '../../econ';
import { generate } from '../../actions';
import { moneyTotal } from '../../goals';
import { askBetween } from '../../asks';
import { DAY, type World } from '../../types';
import { settle, type Obligation, type Spec } from '../../conv/obligations';
import { social, restrainedFrom } from '../../conv/social';
import { promise, socialDay } from '../../conv/tick';
import * as door from '../../conv/doors';
import { chairFor, may, reach } from '../../conv/authority';
import { cast, chain } from '../../conv/ferrara';
import { newWorld, P } from '../helpers';

const conv = fileURLToPath(new URL('../../conv/', import.meta.url));
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);

describe('every action goes through an existing door', { tags: ['architecture'] }, () => {
  // (gate1.ts and gen.ts are the Gate 1 proof of concept's fixtures, which set a scene by hand; they are not the integration)
  const FIXTURES = new Set(['gate1.ts', 'gen.ts']);
  ok('nothing in src/conv writes a world record directly, except doors.ts', () => {
    const bad: string[] = [];
    const WRITE = /\.(cash|trust|respect|affection|grudge|fear|heat|hurtUntil|protection|rank|bossId|familyId|known|balance|status)\s*[-+*]?=[^=]|\b(w|world)\.(debts|favours|jobs|enc|ledger|situations)\.push|\bw\.facts\[[^\]]+\]\s*=|\brel\(|\bfeelTo\(/;
    // (every file of the layer, its interaction modules in conv/acts included)
    for (const f of (readdirSync(conv, { recursive: true }) as string[]).filter((x) => x.endsWith('.ts') && !FIXTURES.has(x) && x !== 'doors.ts')) {
      readFileSync(conv + f, 'utf8').split('\n').forEach((l, i) => {
        if (!WRITE.test(l)) return;
        // the layer's own records (requests, obligations: r.status, ob.status, o3.intends) are its to write
        if (/\b(r\d?|ob|o3|x|req|run|p|low|j|prev|asking|o)\.status\s*=/.test(l) || /\.intends\s*=/.test(l)) return;
        bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`);
      });
    }
    assert.deepEqual(bad, []);
  });
  ok('every action in the catalogue calls a door the world already has', () => {
    const src = readFileSync(conv + 'doors.ts', 'utf8');
    const imported = new Set([...src.matchAll(/import \{([^}]+)\} from '\.\.\/\w+'/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(' as ').pop()!.replace(/^type /, ''))));
    const fns = [...src.matchAll(/export function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
    assert.ok(fns.length >= 8, `${fns.length} actions`);
    const without = fns.filter(([, , body]) => ![...imported].some((d) => new RegExp(`\\b${d}\\(`).test(body))).map(([, name]) => name);
    // (raise changes nothing in the world: it is the request itself, which is the layer's own record. Everything else does, through
    // a door. pay is the cash move and ledger.post, as spec §3.2 lists it.)
    assert.deepEqual(without, ['raise']);
  });
});

describe('obligation time rules on world records (§6.5)', { tags: ['unit'] }, () => {
  const make = (w: World, type: Obligation['type'], spec: Spec, days = 14, extra: Partial<Obligation> = {}) => promise(w, { type, obligor: P(w).id, beneficiary: shop(w).id, spec, from: w.now, by: w.now + days * DAY, ...extra });
  const shop = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort(byId)[0];
  const soldier = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier').sort(byId)[0];
  ok('action: kept the moment it is done, early or not; broken when the window closes without it', () => {
    const w = newWorld(3), cap = soldier(w);
    const a = make(w, 'action', { kind: 'actionDone', act: 'raise', target: cap.id, about: 'm' });
    const b = make(w, 'action', { kind: 'actionDone', act: 'raise', target: cap.id, about: 'm2' });
    door.raise(w, P(w), cap, 'm'); settle(w, social(w));
    assert.equal(a.status, 'kept'); assert.equal(b.status, 'pending');
    w.now += 15 * DAY; settle(w, social(w)); assert.equal(b.status, 'broken');
  });
  ok('effort: a failed attempt he expected might work keeps it; a gesture does not, and a man he may delegate to counts', () => {
    const w = newWorld(3), cap = soldier(w);
    const a = make(w, 'effort', { kind: 'effort', acts: ['raise'], about: 'm', floor: 0.15 });
    const b = make(w, 'effort', { kind: 'effort', acts: ['raise'], about: 'n', floor: 0.15 });
    door.raise(w, P(w), cap, 'm', 0.3); door.raise(w, P(w), cap, 'n', 0.02);
    w.now += 15 * DAY; settle(w, social(w));
    assert.equal(a.status, 'kept'); assert.equal(b.status, 'broken'); assert.match(b.why!, /gesture/);
  });
  ok('result over a period: pending while clean, broken at the first violation (by his men too), kept only at the end', () => {
    const w = newWorld(3), s = shop(w), b = ownerBiz(w, s.id)!, sol = soldier(w);
    const man = Object.values(w.chars).find((c) => c.bossId === sol.id && c.alive)!;
    const o = make(w, 'result', { kind: 'noHostility', actor: sol.id, target: s.id, biz: b.id, days: 30 }, 30);
    const k = make(w, 'result', { kind: 'noHostility', actor: sol.id, target: P(w).id, days: 30 }, 30);
    w.now += 10 * DAY; settle(w, social(w)); assert.equal(o.status, 'pending');
    w.now += 2 * DAY;
    // the hostile fact settles it at once (the addFact hook), not at the next morning's tick
    addFact(w, { kind: 'vandalism', actor: man.id, victim: s.id, business: b.id, text: 'x', district: b.district }, {});
    assert.equal(o.status, 'broken'); assert.equal(o.settled, w.now);
    w.now += 19 * DAY; settle(w, social(w)); assert.equal(k.status, 'kept');
  });
  ok('result by a date: kept the moment the demand is withdrawn; broken if the date passes with it standing', () => {
    const w = newWorld(3), s = shop(w), sol = soldier(w);
    const d = door.demand(w, sol, s, ownerBiz(w, s.id)!.id, 40, 'm');
    assert.ok(d.sit);
    const o = make(w, 'result', { kind: 'demandWithdrawn', sit: d.sit!.id }, 7);
    settle(w, social(w)); assert.equal(o.status, d.sit!.stage === 'resolved' ? 'kept' : 'pending');
    if (d.sit!.stage !== 'resolved') { door.withdraw(w, d.sit!, 'm'); settle(w, social(w)); assert.equal(o.status, 'kept'); }
  });
  ok('restraint: kept although others told; broken when he tells', () => {
    const w = newWorld(3), cap = soldier(w), f = addFact(w, { kind: 'rumour', text: 'x', district: 'Mulberry' }, { witnesses: [P(w).id] });
    const a = make(w, 'restraint', { kind: 'notDisclosedBy', about: 'secret' }), b = make(w, 'restraint', { kind: 'notDisclosedBy', about: 'other' });
    door.inform(w, P(w), cap, f, 'other'); settle(w, social(w)); assert.equal(b.status, 'broken');
    w.now += 15 * DAY; settle(w, social(w)); assert.equal(a.status, 'kept');
  });
  ok('void when the man it was for dies by nobody’s doing of his; broken all the same if his own people did it', () => {
    const w = newWorld(3), s = shop(w), cap = soldier(w);
    const a = make(w, 'action', { kind: 'actionDone', act: 'raise', target: cap.id, about: 'm' });
    s.alive = false; settle(w, social(w));
    assert.equal(a.status, 'void'); assert.match(a.why!, /no doing/);
    const w2 = newWorld(3), s2 = shop(w2), cap2 = soldier(w2);
    const b = make(w2, 'action', { kind: 'actionDone', act: 'raise', target: cap2.id, about: 'm' });
    addFact(w2, { kind: 'murder', actor: P(w2).id, victim: s2.id, text: 'x', district: s2.district }, {}); s2.alive = false;
    w2.now += 15 * DAY; settle(w2, social(w2)); assert.equal(b.status, 'broken');
  });
});

describe('authority routes the request', { tags: ['unit'] }, () => {
  ok('a captain can order his own men; for a civilian against a family man the chair is that man’s captain; an associate can order nobody', () => {
    const c = cast(3)!;
    assert.equal(may(c.w, c.marchese, 'order', c.lou), true);
    assert.equal(may(c.w, c.riz, 'order', c.lou), false);
    assert.equal(chairFor(c.w, c.lou, c.nate)?.id, c.marchese.id);
    assert.deepStrictEqual(reach(c.w, c.henry, c.lou), { can: false, via: c.marchese.id });
  });
});

const A = chain(cast(3, 0)!, 'result', { days: 40 });
describe('the Ferrara dispute end to end, on real records', () => {
  ok('the trouble is the world’s own: a real protection ask, refused, pressed with force', { tags: ['scenario'] }, () => {
    assert.ok(A.grievance, 'a vandalism fact by Lou at Nate’s shop');
    assert.equal(A.grievance!.actor, A.c.lou.id); assert.equal(A.grievance!.business, A.c.biz);
    assert.ok(A.c.nate.known[A.grievance!.id] && A.c.henry.known[A.grievance!.id]?.from === A.c.nate.id, 'Henry knows it because Nate told him');
  });
  ok('creation and delegation: O1 (Henry, result) → O2 (the captain, action, with a liability on Henry) → O3 (Lou, an order he accepted)', { tags: ['scenario'] }, () => {
    const s = social(A.c.w);
    assert.equal(A.o1!.type, 'result'); assert.equal(A.o1!.obligor, A.c.henry.id); assert.ok(A.o1!.agreement);
    assert.equal(A.o2!.obligor, A.c.riz.id); assert.equal(A.o2!.parent, A.o1!.id); assert.equal(A.o2!.liabilities![0].who, A.c.henry.id);
    assert.equal(A.o3!.obligor, A.c.lou.id); assert.equal(A.o3!.beneficiary, A.c.marchese.id); assert.equal(A.o3!.parent, A.o2!.id); assert.ok(A.o3!.order);
    const r3 = s.requests.find((r) => r.by === A.c.riz.id && r.of === A.c.marchese.id)!;
    assert.ok(r3.sit);
    assert.deepStrictEqual(r3.rode, { ak: 'layoff', out: 'agreed' }, 'the order rode on the world’s own "leave him alone" ask, and Lou agreed');
  });
  ok('fulfilment: the captain kept his word by acting; Lou kept the order; Henry’s result is kept, with the credit shared by delegation', { tags: ['scenario'] }, () => {
    assert.equal(A.o2!.status, 'kept'); assert.equal(A.o3!.status, 'kept'); assert.equal(A.o1!.status, 'kept'); assert.equal(A.o1!.credit, 'delegate');
    assert.equal(askBetween(A.c.w, 'protect', A.c.lou.id, A.c.nate.id, A.c.biz), undefined, 'Lou let his demand drop');
    assert.ok(A.c.w.favours.some((f) => f.from === A.c.nate.id && f.to === A.c.henry.id), 'Nate owes Henry a favour (encounters.addFavour)');
  });
  ok('the ledger and the world audits hold after it', { tags: ['scenario'] }, () => {
    assert.deepEqual(audit(A.c.w), []); assert.deepEqual(ledgerCheck(A.c.w), []);
  });
  ok('variants without new code: an action promise is kept by raising it though the captain says no; an effort promise by a real attempt', { tags: ['scenario'] }, () => {
    const act = chain(cast(3, 0)!, 'action', { tell: false, days: 16 }), eff = chain(cast(3, 0)!, 'effort', { tell: false, days: 16 });
    assert.equal(act.o2, undefined, 'the captain refused'); assert.equal(act.o1!.status, 'kept');
    assert.equal(eff.o2, undefined); assert.equal(eff.o1!.status, 'kept'); assert.match(eff.o1!.why!, /real attempt/);
  });
  ok('a result can be kept with no credit: the trouble stops, but not through anything Henry set going', { tags: ['scenario'] }, () => {
    // (whichever of the men the world has turns out this way: found, not chosen)
    let r: ReturnType<typeof chain> | undefined;
    for (let n = 0; n < 6 && !(r && r.o1?.status === 'kept' && r.o1.credit === 'none'); n++) { const c = cast(11, n); if (c) r = chain(c, 'result', { days: 40 }); }
    assert.equal(r!.o1!.status, 'kept'); assert.equal(r!.o1!.credit, 'none');
  });
});

describe('downstream systems read the records', () => {
  ok('a man bound to leave a shop alone, and meaning it, does not consider leaning on it; one who means to break it does', { tags: ['unit'] }, () => {
    const c = cast(3)!, { w, lou, nate, biz } = c;
    const ob = promise(w, { type: 'restraint', order: true, obligor: lou.id, beneficiary: c.marchese.id, spec: { kind: 'noHostility', actor: lou.id, target: nate.id, biz, days: 30 }, from: w.now, by: w.now + 30 * DAY, intends: 'keep' });
    assert.equal(restrainedFrom(w, lou.id, nate.id, biz), true);
    assert.ok(!generate(w, lou, 'shakedown').some((a) => a.biz === biz));
    ob.intends = 'break';
    assert.equal(restrainedFrom(w, lou.id, nate.id, biz), false);
  });
  // (Gate 4: no switch decides whether the layer runs. Every world carries its record from the start, and the tick keeps it)
  ok('every world has the conversation layer’s record from the start, and the tick keeps it', { tags: ['sim'] }, () => {
    const w = newWorld(7);
    assert.ok(w.social, 'a new game has it');
    advance(w, w.now + 10 * DAY);
    assert.ok(w.social && Array.isArray(w.social.obs) && Array.isArray(w.social.requests), 'and keeps it as the world runs');
  });
});

describe('economy, saves, determinism', () => {
  ok('paying through the door conserves money and is on the ledger for the player’s circle', { tags: ['unit'] }, () => {
    const w = newWorld(3), p = P(w), boss = w.chars[p.bossId!], m0 = moneyTotal(w), l0 = (w.ledger ?? []).length;
    assert.ok(door.pay(w, p, boss, 100, 'a gift'));
    assert.equal(moneyTotal(w), m0); assert.equal((w.ledger ?? []).length, l0 + 1);
    assert.equal(door.pay(w, p, boss, p.cash + 1, 'too much'), undefined, 'he cannot pay what he has not got');
  });
  ok('saved mid-dispute and loaded, the world goes on exactly as it would have', { tags: ['determinism'] }, () => {
    const a = cast(3, 0)!; chain(a, 'result', { days: 8 });
    const b = deserialize(serialize(a.w));
    advance(a.w, a.w.now + 26 * DAY); advance(b, b.now + 26 * DAY);
    // (compared as data: a field filled after a load serialises in a different place, which is not a difference)
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b.social)), JSON.parse(JSON.stringify(a.w.social)));
    assert.ok(b.social!.obs.some((o) => o.status === 'kept'));
  });
  ok('the same seed gives the same dispute, word for word', { tags: ['determinism'] }, () => {
    assert.equal(chain(cast(3, 0)!, 'result', { days: 40 }).o.text(), A.o.text());
  });
  ok('regard moved through the door: Nate trusts Henry more for a kept promise', { tags: ['scenario'] }, () => {
    const c0 = cast(3, 0)!;
    assert.ok(peek(A.c.nate, A.c.henry.id).trust > peek(c0.nate, c0.henry.id).trust);
    void socialDay;
  });
});
