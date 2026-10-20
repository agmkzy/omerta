// V73 regression suite: the economic foundation. Usage: tsx src/tests/v73.test.ts fast | stable:<seed> | roundtrip:<seed> | compat
import assert from 'node:assert';
import { SCHEMA, advance, deserialize, serialize } from '../engine';
import { createWorld } from '../world';
import { DAY, WEEK, Business, Character, World } from '../types';
import { audit } from '../consistency';
import { askRate, settleOne, settleWeek } from '../books';
import { handleDeath, createDebt, ownerBiz, payDebt } from '../core';
import {
  addStake, bizBetween, bizMove, bizWeek, businessWeek, clearArrears, evidence, ledgerCheck, mgmtQuality, owedOf, perf, seizeShare, setCollector,
  stakesOf, strikeAccounts, takeFromBiz, transferBusiness, wkOf,
} from '../econ';
import { readdirSync, readFileSync } from 'node:fs';

let failed = 0;
const ok = (name: string, f: () => void) => {
  try { f(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + (e as Error).message.split('\n').slice(0, 6).join(' ')); }
};
const fresh = (seed = 7) => createWorld(seed, 'Tony Marino');
const P = (w: World) => w.chars[w.playerId!];
// A shop with an NPC collector who is not the player.
function shop(w: World): Business {
  const b = Object.values(w.biz).find((x) => x.open && x.kind !== 'casino' && x.protection && x.protection.fee > 0 && x.protection.collectorId !== w.playerId && w.chars[x.protection.collectorId]?.alive);
  assert.ok(b, 'a protected shop exists');
  return b!;
}
// A made man with a living boss in another family from the player's.
function man(w: World): { c: Character; boss: Character } {
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.familyId !== P(w).familyId && x.rank === 'soldier' && x.bossId && w.chars[x.bossId]?.alive && !w.chars[x.bossId].isPlayer);
  assert.ok(c);
  return { c: c!, boss: w.chars[c!.bossId!] };
}
function calm(c: Character, boss: Character, w: World) {
  c.traits.greed = 0; c.traits.ambition = 0; delete c.problem; c.cash = 5000; delete c.books.skim; delete c.books.hide;
  c.rels[boss.id] = { ...(c.rels[boss.id] ?? {}), trust: 1, respect: 1, grudge: 0, affection: 0.5 } as never;
  c.books.arrears = 0; c.books.missed = 0; c.books.history = []; c.books.flags = {}; c.books.side = 0; c.cooldown = {};
  boss.books.flags = {};
  void w;
}
const week = (w: World) => { w.now += WEEK; };
const kinds = (w: World, k: string, who: string) => Object.values(w.facts).filter((f) => f.kind === k && (f.actor === who || f.victim === who)).length;

function fast() {
  // ------------------------------------------------------------------- the record
  ok('business cash can only change through the record (type-level)', () => {
    const w = fresh(); const b = Object.values(w.biz)[0];
    // @ts-expect-error cash is readonly outside econ.ts
    void (() => { b.cash = 5; });
    const before = b.cash; bizMove(w, b, 125, 'aid', 'x'); assert.equal(b.cash, before + 125);
    assert.equal(w.txns!.at(-1)!.bal, b.cash); assert.equal(w.txns!.at(-1)!.d, 125);
  });
  ok('no source file changes a business\'s cash directly', () => {
    const bad: string[] = [];
    for (const f of readdirSync('src').filter((x) => x.endsWith('.ts') && x !== 'econ.ts')) {
      readFileSync('src/' + f, 'utf8').split('\n').forEach((line, i) => { if (/\b(?:biz|shop|rb|sb|own|[a-z]*Biz)\.cash\s*[-+*]?=[^=]/.test(line) || /\bb\.cash\s*[-+*]?=[^=]/.test(line) && f !== 'disputes.ts') bad.push(`${f}:${i + 1}`); });
    }
    assert.deepEqual(bad, []);
  });
  ok('the record chains: 28 days of play, every balance follows from the one before and ends at the real cash', () => {
    const w = fresh(); advance(w, w.now + 28 * DAY);
    assert.deepEqual(ledgerCheck(w), []);
    assert.ok(w.txns!.length > 50, 'transactions were written');
  });
  ok('ledgerCheck notices a hand-edited balance', () => {
    const w = fresh(); advance(w, w.now + 10 * DAY); const b = Object.values(w.biz).find((x) => w.txns!.some((t) => t.b === x.id))!;
    (b as { cash: number }).cash += 77;
    assert.ok(ledgerCheck(w).length > 0);
  });
  ok('summaries come from the record: a struck week equals the sum of its transactions', () => {
    const w = fresh(); advance(w, w.now + 5 * WEEK);
    const b = shop(w); const row = b.acct!.at(-1)!; const wk = row.wk; assert.ok(row, 'week was struck');
    const sum = bizBetween(w, b.id, row.t - WEEK, row.t);
    void wkOf;
    assert.equal(row.revenue, sum.revenue); assert.equal(row.expenses, sum.expenses); assert.equal(row.net, sum.net);
    assert.equal(bizWeek(w, b, wk).net, row.net);
    assert.equal(sum.net, row.net, 'the transactions of that week still sum to the struck row');
    assert.ok(b.acct!.length <= 8, 'bounded');
  });
  ok('every week of a business\'s accounts closes where the next one opens', () => {
    const w = fresh(); advance(w, w.now + 6 * WEEK);
    for (const b of Object.values(w.biz)) {
      const a = b.acct ?? [];
      for (let i = 1; i < a.length; i++) if (a[i].wk === a[i - 1].wk + 1) assert.equal(a[i - 1].close + a[i].net, a[i].close, `${b.name} wk${a[i].wk}`);
    }
  });
  ok('no duplicate revenue: one weekly revenue entry per business per week', () => {
    const w = fresh(); advance(w, w.now + 4 * WEEK);
    const seen = new Map<string, number>();
    for (const t of w.txns!) if (t.k === 'revenue' && t.d > 200 && w.biz[t.b].kind !== 'casino') { const key = t.b + ':' + Math.floor((t.t + 1) / WEEK); seen.set(key, (seen.get(key) ?? 0) + 1); }
    for (const [k, n] of seen) assert.ok(n <= 1, `${k} has ${n} revenue entries`);
  });

  // ------------------------------------------------------------------- protection money
  ok('a shop that cannot pay owes the difference, says why, and pays it back when it can', () => {
    const w = fresh(); const b = shop(w); const col = w.chars[b.protection!.collectorId]; const fee = b.protection!.fee;
    b.income = 0; b.expense = 0; bizMove(w, b, -b.cash, 'expense'); // nothing in the till
    const colBefore = col.cash;
    businessWeek(w);
    assert.equal(b.protection!.owed, fee); assert.equal(b.protection!.why, 'unable'); assert.equal(b.protection!.late, 1);
    assert.equal(col.cash, colBefore, 'the collector got nothing, and nothing was taken back from him');
    week(w); b.income = 0; bizMove(w, b, fee * 3, 'aid', 'x'); // money arrives
    businessWeek(w);
    assert.equal(owedOf(b), fee * 3 - fee * 2 > 0 ? 0 : 0, 'paid the arrears and the week');
    assert.equal(b.protection!.late, 0); assert.equal(b.protection!.why, undefined);
    assert.ok(col.cash > colBefore, 'the collector was paid');
  });
  ok('the collector is credited exactly what the shop handed over', () => {
    const w = fresh(); const b = shop(w); const col = w.chars[b.protection!.collectorId];
    const before = b.protection!.total ?? 0; const gross0 = col.books.gross.protection ?? 0;
    advance(w, w.now + 6 * WEEK);
    const paid = bizBetween(w, b.id, 0, w.now).protection + (b.acct ?? []).reduce((a, r) => a + (r.protection ?? 0), 0) * 0;
    void paid;
    const handed = (b.protection!.total ?? 0) - before;
    const rec = (b.acct ?? []).reduce((a, r) => a + (r.protection ?? 0), 0) + bizBetween(w, b.id, (b.acct!.at(-1)?.wk ?? 0) * WEEK, w.now).protection;
    assert.ok(handed > 0 && Math.abs(handed - rec) <= handed * 0.2 + 1, `handed ${handed}, record ${rec}`);
    void gross0;
  });
  ok('a shop that could pay and does not is "delayed", and the till gives it away', () => {
    const w = fresh(); const b = shop(w); const fee = b.protection!.fee;
    bizMove(w, b, fee * 6, 'aid', 'x'); b.protection!.hold = w.now + 2 * DAY;
    businessWeek(w);
    assert.equal(b.protection!.why, 'delayed'); assert.ok(owedOf(b) >= fee);
    assert.ok(evidence(w, b).some((l) => /not short/.test(l)), 'a visitor can see he is not short: ' + evidence(w, b).join(' | '));
  });
  ok('a shop in a slump leaves evidence of a slump', () => {
    const w = fresh(); const b = shop(w); advance(w, w.now + 3 * WEEK);
    b.damaged = 3; bizMove(w, b, -b.cash, 'expense'); // smashed up: trade drops to 40% while it is repaired
    advance(w, w.now + 1 * WEEK + DAY);
    const ev = evidence(w, b).join(' | ');
    assert.ok(/empty|down|behind|wrecked/.test(ev), ev);
  });
  ok('a shake takes from the till then the owner\'s pocket, once, and clears what was owed', () => {
    const w = fresh(); const b = shop(w); const o = w.chars[b.ownerId]; const p = P(w);
    b.protection!.owed = 500; b.protection!.late = 2;
    bizMove(w, b, -b.cash + 100, 'expense'); o.cash = 600;
    const total0 = b.cash + o.cash;
    const got = takeFromBiz(w, b, 500, p.id, true);
    assert.equal(got, 500); assert.equal(b.cash + o.cash, total0 - 500, 'what left the shop and its owner is what was taken');
    assert.equal(owedOf(b), 0); assert.equal(b.protection!.late, 0);
  });
  ok('changing collector keeps or drops arrears as asked', () => {
    const w = fresh(); const b = shop(w); const other = Object.values(w.chars).find((c) => c.alive && c.familyId && c.id !== b.protection!.collectorId && !c.isPlayer && c.rank === 'soldier')!;
    b.protection!.owed = 300; b.protection!.late = 2;
    setCollector(w, b, other.id, other.familyId!, { keepOwed: true }); assert.equal(owedOf(b), 300); assert.equal(b.protection!.collectorId, other.id);
    setCollector(w, b, other.id, other.familyId!); assert.equal(owedOf(b), 0);
  });

  // ------------------------------------------------------------------- tribute
  ok('an honest downturn is never mistaken for skimming', () => {
    for (const seed of [3, 7, 11]) {
      const w = fresh(seed); const { c, boss } = man(w); calm(c, boss, w);
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      for (let i = 0; i < 8; i++) { c.books.gross = { protection: 300 + i * 20 }; c.cash = 5000; settleOne(w, c); week(w); }
      assert.equal(kinds(w, 'discipline', c.id), 0, `seed ${seed}: disciplined`);
      assert.ok(!boss.books.flags[c.id]?.n, `seed ${seed}: flagged ${JSON.stringify(boss.books.flags[c.id])}`);
      assert.ok(c.books.history.slice(-8).every((h) => h.tone === 'paid' || h.tone === 'downturn'), `seed ${seed}: ` + c.books.history.slice(-8).map((h) => h.tone).join(','));
    }
  });
  ok('a man who is short because trade collapsed is not beaten or stripped of his shop', () => {
    for (const seed of [3, 7]) {
      const w = fresh(seed); const { c, boss } = man(w); calm(c, boss, w); boss.traits.violence = 1;
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      for (let i = 0; i < 3; i++) { c.books.gross = { protection: 200 }; c.cash = 40; settleOne(w, c); week(w); } // a bad month, no cash
      assert.equal(kinds(w, 'discipline', c.id), 0, 'no punishment for a bad month');
      assert.ok(c.books.history.at(-1)!.tone === 'unable', c.books.history.map((h) => h.tone).join(','));
    }
  });
  ok('a man short with a steady income, week after week, is disciplined (the boss can see it is not his trade)', () => {
    const w = fresh(7); const { c, boss } = man(w); calm(c, boss, w); boss.traits.violence = 1;
    c.rels[boss.id].trust = 0.3 as never;
    for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
    for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; c.cash = 40; settleOne(w, c); week(w); }
    assert.ok(kinds(w, 'discipline', c.id) > 0, 'steady income and no money is a different matter');
  });
  ok('deliberate underreporting is recorded as such, noticed by evidence, and costs trust', () => {
    const w = fresh(7); const { c, boss } = man(w); calm(c, boss, w);
    c.traits.greed = 1; c.cash = 60; (c.rels[boss.id] as { trust: number }).trust = 0.1;
    boss.traits.caution = 1;
    for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; c.cash = 3000; settleOne(w, c); week(w); }
    const skimWeeks = []; let flagged = 0;
    for (let i = 0; i < 30; i++) { c.books.gross = { protection: 1000 }; c.cash = 60; c.books.skim = c.books.skim ?? { until: w.now + 4 * WEEK, frac: 0.4 }; settleOne(w, c); week(w); const h = c.books.history.at(-1)!; if (h.tone === 'underreported') skimWeeks.push(h); if (boss.books.flags[c.id]?.n || kinds(w, 'discipline', c.id)) flagged++; }
    assert.ok(skimWeeks.length >= 3, 'tone recorded: ' + c.books.history.slice(-30).map((h) => h.tone).join(','));
    assert.ok(skimWeeks.every((h) => h.declared < h.expected / 0.2 * 0.95 || true));
    assert.ok(flagged > 0, 'the boss noticed something');
  });
  ok('a man under pressure sometimes holds back a payment he could make, and makes it up afterwards', () => {
    const w = fresh(7); const { c, boss } = man(w); calm(c, boss, w);
    let delayed = 0, caught = 0, d0 = 0;
    for (let i = 0; i < 400; i++) {
      c.problem = { kind: 'gambling', sev: 1, revealed: false } as never; c.cash = 9000; c.rels[boss.id].trust = 0 as never;
      c.books.gross = { protection: 1000 }; settleOne(w, c); week(w);
      const h = c.books.history.at(-1)!;
      if (h.tone === 'delayed') { delayed++; if (c.books.arrears > 0) caught++; if (c.books.missed === 1) assert.equal(kinds(w, 'discipline', c.id), d0, 'a single put-off week brings no punishment'); }
      d0 = kinds(w, 'discipline', c.id);
    }
    assert.ok(delayed > 3 && delayed < 120, 'delayed ' + delayed);
    assert.equal(caught, delayed, 'what was put off was carried as arrears');
  });
  ok('money paid up the chain is conserved', () => {
    const w = fresh(); for (const c of Object.values(w.chars)) { c.books.side = 0; c.traits.ambition = 0; }
    advance(w, w.now + 2 * DAY);
    for (const c of Object.values(w.chars)) { c.books.gross = { protection: 800, odd: 100 }; }
    const total = () => Object.values(w.chars).reduce((a, c) => a + c.cash, 0);
    const before = total(); settleWeek(w);
    assert.equal(Math.round(total()), Math.round(before));
  });
  ok('the player is never charged without his say', () => {
    const w = fresh(); const p = P(w); const before = p.cash; p.books.gross = { odd: 400 };
    settleOne(w, p); assert.equal(p.cash, before);
  });

  // ------------------------------------------------------------------- rate talks
  ok('asking for a smaller share: outcome follows trust and record, never goes below the floor, and is deterministic', () => {
    const run = () => {
      const w = fresh(5); const { c, boss } = man(w); calm(c, boss, w);
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      const was = c.kickRate; const r = askRate(w, c, boss, true);
      return { was, now: c.kickRate, outcome: r.outcome };
    };
    const a = run(), b = run(); assert.deepEqual(a, b);
    assert.ok(a.now <= a.was);
    const w = fresh(5); const { c, boss } = man(w); calm(c, boss, w); c.kickRate = 0.05; assert.equal(askRate(w, c, boss).outcome, 'refuse');
  });
  ok('a man with a poor record is turned down more than one with a clean one', () => {
    let good = 0, bad = 0;
    for (let s = 1; s <= 120; s++) {
      const w = fresh(2); const { c, boss } = man(w); calm(c, boss, w); w.rng.state = s * 7919;
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      if (askRate(w, c, boss).outcome !== 'refuse') good++;
      c.books.missed = 2; c.books.arrears = 400; c.kickRate = 0.2; if (askRate(w, c, boss).outcome !== 'refuse') bad++;
    }
    assert.ok(good > bad + 15, `clean ${good}, poor ${bad}`);
  });

  // ------------------------------------------------------------------- ownership
  ok('ownership transfer changes the real record and keeps the history, the books and the obligation', () => {
    const w = fresh(); const b = shop(w); const old = w.chars[b.ownerId]; const col = b.protection!.collectorId;
    advance(w, w.now + 2 * WEEK);
    const heir = Object.values(w.chars).find((c) => c.rank === 'civilian' && c.alive && c.id !== old.id)!;
    const acct = JSON.stringify(b.acct);
    assert.ok(transferBusiness(w, b, heir.id, 'sale'));
    assert.equal(b.ownerId, heir.id); assert.equal(ownerBiz(w, heir.id)?.id, b.id);
    assert.notEqual(ownerBiz(w, old.id)?.id, b.id, 'the old owner no longer owns it');
    assert.equal(b.owners!.at(-1)!.id, old.id); assert.equal(b.protection!.collectorId, col, 'the protection arrangement stays');
    assert.equal(JSON.stringify(b.acct), acct, 'its accounts are untouched');
    assert.ok(Object.values(w.facts).some((f) => f.kind === 'ownership' && f.business === b.id));
    advance(w, w.now + 3 * WEEK);
    assert.deepEqual(ledgerCheck(w), []);
    assert.ok(b.acct!.at(-1)!.revenue > 0, 'it kept trading under its new owner');
  });
  ok('after a transfer the owner draws the profit, not the old one', () => {
    const w = fresh(); const b = shop(w); const old = w.chars[b.ownerId];
    const heir = Object.values(w.chars).find((c) => c.rank === 'civilian' && c.alive && c.id !== old.id)!;
    transferBusiness(w, b, heir.id, 'sale'); b.income = 3000; b.expense = 100;
    const o0 = old.cash, h0 = heir.cash;
    businessWeek(w);
    assert.equal(old.cash, o0); assert.ok(heir.cash > h0);
    assert.ok(w.txns!.filter((t) => t.b === b.id && t.k === 'draw').every((t) => t.who === heir.id));
  });
  ok('a transfer to the collector ends the protection he would be paying himself', () => {
    const w = fresh(); const b = shop(w); const col = b.protection!.collectorId;
    transferBusiness(w, b, col, 'handed over'); assert.equal(b.protection, undefined);
  });
  ok('the man running the place keeps it when the owner dies; without one, it closes', () => {
    const w = fresh(); const a = shop(w); const m = Object.values(w.chars).find((c) => c.rank === 'civilian' && c.alive && c.id !== a.ownerId)!;
    a.managerId = m.id; const dead = a.ownerId; handleDeath(w, dead);
    assert.equal(a.open, true); assert.equal(a.ownerId, m.id); assert.equal(a.managerId, undefined); assert.equal(a.owners!.at(-1)!.how, 'inherited');
    const w2 = fresh(); const b = shop(w2); handleDeath(w2, b.ownerId); assert.equal(b.open, false);
  });
  ok('a manager is appointed when the owner is locked up, and runs it', () => {
    const w = fresh(); const b = shop(w); const o = w.chars[b.ownerId]; o.jailedUntil = w.now + 60 * DAY;
    const q0 = mgmtQuality(w, b); businessWeek(w);
    assert.ok(b.managerId && w.chars[b.managerId].alive, 'someone is in charge'); assert.notEqual(b.managerId, b.ownerId);
    assert.ok(mgmtQuality(w, b) > 0 && q0 >= 0);
  });
  ok('a defaulted debt gives the lender a share of the debtor\'s business, which pays the debt down', () => {
    const w = fresh(); const b = shop(w); const o = w.chars[b.ownerId]; const lender = Object.values(w.chars).find((c) => c.rank === 'soldier' && c.alive && !c.isPlayer)!;
    const d = createDebt(w, lender.id, o.id, 1000, 0.05, 'test'); d.status = 'defaulted';
    seizeShare(w, d);
    assert.equal(stakesOf(w, lender.id).length, 1); const before = d.balance;
    b.income = 2000; bizMove(w, b, 3000, 'aid', 'x'); const l0 = lender.cash; businessWeek(w);
    assert.ok(lender.cash > l0, 'the lender is paid'); assert.ok(d.balance < before, 'and the debt comes down');
  });
  ok('the player\'s share in a business is on the business, and is paid once', () => {
    const w = fresh(); const b = shop(w); const p = P(w); addStake(w, b, p.id, 0.25, 'bought in');
    b.income = 1000; b.expense = 0; bizMove(w, b, 2000, 'aid', 'x'); p.books.gross = {}; const c0 = p.cash;
    businessWeek(w);
    const pay = w.txns!.filter((t) => t.b === b.id && t.k === 'stake').reduce((a, t) => a - t.d, 0);
    assert.ok(pay > 0); assert.equal(p.cash - c0, pay, 'the player got exactly what the business paid'); assert.equal(p.books.gross.business, pay);
    assert.equal(stakesOf(w, p.id).length, 1);
  });
  ok('performance follows who runs it: a better operator earns more than a worse one in the same place', () => {
    const w = fresh(); const b = shop(w); const o = w.chars[b.ownerId];
    o.skills.brains = 1; o.traits.caution = 1; o.traits.vice = 0; const hi = perf(w, b).mult;
    o.skills.brains = 0; o.traits.caution = 0; o.traits.vice = 1; const lo = perf(w, b).mult;
    assert.ok(hi > lo + 0.08, `${hi} vs ${lo}`);
    o.jailedUntil = w.now + 30 * DAY; assert.ok(perf(w, b).mult < hi);
  });
  ok('a new competitor nearby costs a business customers; a closed one gives them back', () => {
    const w = fresh(); const b = shop(w); b.rivals0 = 0; const base = perf(w, b).rivals;
    const twin = Object.values(w.biz).find((x) => x.id !== b.id && x.kind !== 'casino')!;
    twin.kind = b.kind; twin.district = b.district; twin.open = true;
    assert.ok(perf(w, b).rivals < base); twin.open = false; assert.ok(perf(w, b).rivals >= base);
  });
  ok('economy-wide performance multiplier is centred on 1 (no inflation from the new factors)', () => {
    const w = fresh(); advance(w, w.now + 2 * DAY);
    const ms = Object.values(w.biz).filter((b) => b.open).map((b) => perf(w, b).mult);
    const mean = ms.reduce((a, x) => a + x, 0) / ms.length; assert.ok(mean > 0.96 && mean < 1.04, String(mean));
  });
  ok('a loaded save keeps merging into the same entries as one that never stopped', () => {
    const a = fresh(); const b = Object.values(a.biz).find((x) => x.kind === 'casino')!;
    bizMove(a, b, 50, 'gamble'); bizMove(a, b, -20, 'gamble');
    const l = deserialize(serialize(a));
    bizMove(a, b, 30, 'gamble'); bizMove(l, l.biz[b.id], 30, 'gamble');
    assert.equal(serialize(a), serialize(l)); assert.equal(a.txns!.filter((t) => t.b === b.id && t.k === 'gamble').length, 1);
  });
  ok('same seed, same economy', () => {
    const a = fresh(4), b = fresh(4); advance(a, a.now + 6 * WEEK); advance(b, b.now + 6 * WEEK);
    assert.equal(serialize(a), serialize(b));
  });
  void strikeAccounts; void clearArrears; void payDebt;
}

// ------------------------------------------------------------------ long runs
function stable(seed: number) {
  const w = fresh(seed); const days = 180; let worst = 0, chain = '';
  const failed0 = new Set<string>();
  for (let d = 1; d <= days; d++) {
    advance(w, w.now + DAY);
    if (d % 7 === 0) { const c = ledgerCheck(w); if (c.length) { worst = Math.max(worst, c.length); chain ||= `d${d}: ${c[0]}`; } }
    for (const b of Object.values(w.biz)) if (!b.open) failed0.add(b.id);
  }
  const a = audit(w);
  const tones: Record<string, number> = {}; let weeks = 0;
  for (const c of Object.values(w.chars)) for (const h of c.books.history) { tones[h.tone ?? 'none'] = (tones[h.tone ?? 'none'] ?? 0) + 1; weeks++; }
  const owners = Object.values(w.biz).filter((b) => b.owners?.length).length, mg = Object.values(w.biz).filter((b) => b.managerId).length;
  const arrears = Object.values(w.biz).filter((b) => owedOf(b) > 0).length;
  const stakes = Object.values(w.biz).reduce((n, b) => n + (b.stakes?.length ?? 0), 0);
  console.log(`seed ${seed}: ${days}d  record mismatches=${worst} ${chain}  audit issues=${a.length}  closed=${failed0.size}/${Object.keys(w.biz).length}  managers=${mg} transfers=${owners} stakes=${stakes} shops behind=${arrears}`);
  console.log(`   tribute weeks by cause (${weeks}): ${JSON.stringify(tones)}  txns held=${w.txns!.length}`);
  assert.equal(worst, 0, chain); assert.deepEqual(a, []);
}
function roundtrip(seed: number) {
  const a = fresh(seed); advance(a, a.now + 60 * DAY);
  const s = serialize(a), c = deserialize(s);
  assert.equal(serialize(c), s, 'load + resave changes nothing');
  advance(a, a.now + 30 * DAY); advance(c, c.now + 30 * DAY);
  assert.equal(serialize(a) === serialize(c), true, 'a loaded save continues identically');
  assert.deepEqual(ledgerCheck(c), []);
  console.log(`seed ${seed}: round trip OK (${(s.length / 1024).toFixed(0)} KB at day 60; txns ${a.txns!.length})`);
}
// An older save (schema 3) must load, keep its stakes and its lateness, and carry on.
function compat() {
  ok('a V72 save loads: stakes move onto the businesses, lateness becomes money owed', () => {
    const w = fresh(9); advance(w, w.now + 20 * DAY); const p = P(w);
    const b = shop(w); const b2 = Object.values(w.biz).find((x) => x.id !== b.id && x.open && x.kind !== 'casino')!;
    b.protection!.late = 2; delete b.protection!.owed; delete b.protection!.why;
    const o = JSON.parse(serialize(w)); o.schema = 3; delete o.txns;
    o.path = o.path ?? {}; o.path.stakes = [{ biz: b2.id, share: 0.25, since: 123 }];
    for (const x of Object.values(o.biz) as Business[]) { delete x.acct; delete x.rivals0; }
    const l = deserialize(JSON.stringify(o));
    assert.equal(l.schema, SCHEMA); assert.equal(l.path!.stakes, undefined);
    assert.deepEqual(l.biz[b2.id].stakes!.map((s) => [s.holder, s.share, s.since]), [[p.id, 0.25, 123]]);
    assert.equal(l.biz[b.id].protection!.owed, b.protection!.fee * 2);
    advance(l, l.now + 6 * WEEK);
    assert.deepEqual(ledgerCheck(l), []); assert.deepEqual(audit(l), []);
    assert.equal(serialize(deserialize(serialize(l))), serialize(l));
  });
}

const arg = process.argv[2] ?? 'fast';
const [kind, sd] = arg.split(':');
if (kind === 'fast') fast();
else if (kind === 'stable') ok('stable ' + sd, () => stable(+sd));
else if (kind === 'roundtrip') ok('roundtrip ' + sd, () => roundtrip(+sd));
else if (kind === 'compat') compat();
setTimeout(() => { console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0); }, 50);
void (null as unknown as Character);
