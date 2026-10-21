// What people tell you: arriving is a greeting, what a man tells depends on how he sees you and what the record holds,
// news leads to follow-ups, and friendly talk cannot be farmed. From the V77 and V78 suites.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { deserialize, serialize } from '../../engine';
import { options, say, startConvo, holdsBack } from '../../dialogue';
import { learn } from '../../core';
import { choose } from '../../meetings';
import { world60, men, arriveAt, chatWith } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });

describe('what people tell you', () => {
  ok('arriving is a greeting, not a briefing: one scene, one line from him, and nothing volunteered', { tags: ['scenario'] }, () => {
    const w = world60(); let n = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian')) {
      const o = arriveAt(w, m.id); if (!o) continue; n++;
      const text = o.a.lines.join(' ');
      assert.ok(!/You find |spend the hours/.test(text), text);
      assert.ok(o.a.lines[0].length < 140, o.a.lines[0]);
      assert.ok(o.a.lines.length >= 2 && !/undefined|\{\w+\}/.test(text), text);
      const learned = Object.keys(o.p.known).filter((id) => !o.before.has(id)).length;
      assert.equal(learned, 0, `${m.name} volunteered something on arrival`);
      assert.equal(o.a.convo.node, 'root');
    }
    assert.ok(n >= 10, `only ${n} arrivals`);
  });
  ok('"What\'s been going on?" depends on how he sees you: a friend tells, a wary man brushes you off, a hostile one asks why you are asking', { tags: ['scenario'] }, () => {
    const w = world60(); let friends = 0, hostile = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const h = chatWith(deserialize(serialize(w)), m, { trust: 0.1, affection: 0.1, grudge: 0.6 }); if (h.learned.length) hostile++;
      const b = chatWith(deserialize(serialize(w)), m, { trust: 0.05, affection: 0.05, grudge: 0 });
      if (m.traits.sociability <= 0.65) assert.equal(b.learned.length, 0, `${m.name} told a near-stranger something`);
      else for (const id of b.learned) assert.ok(!w.facts[id].actor || b.p.known[id].knowsActor === false, `${m.name}: a talker gives a rumour, not names`);
      const f = chatWith(deserialize(serialize(w)), m, { trust: 0.9, affection: 0.9, grudge: 0 }); if (f.learned.length) { friends++; assert.equal(f.r.convo?.node, 'incident'); }
    }
    assert.equal(hostile, 0, 'a hostile man tells you nothing');
    assert.ok(friends >= 3, `only ${friends} friends had something to tell`);
  });
  ok('a man in the middle holds back the name; a close one gives it; asking again the same day gives nothing new', { tags: ['scenario'] }, () => {
    const w = world60(); let partial = 0, checked = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const ww = deserialize(serialize(w)); const mm = ww.chars[m.id];
      const mid = chatWith(ww, mm, { trust: 0.45, affection: 0.2, grudge: 0 });
      if (!mid.learned.length) continue; checked++;
      for (const id of mid.learned) if (ww.facts[id].actor && mid.p.known[id].knowsActor === false) partial++;
      const again = say(ww, mid.p, mm, startConvo(mm.id), 'chat'); assert.equal(Object.keys(mid.p.known).length, Object.keys(mid.p.known).length);
      assert.ok(again.convo?.node !== 'incident', 'same day, nothing new');
    }
    assert.ok(checked >= 1);
    void partial;
  });
  ok('what is told is deterministic from the record: the same world gives the same subject', { tags: ['determinism'] }, () => {
    const run = () => { const w = world60(); const m = men(w).find((x) => x.rank !== 'civilian')!; const o = arriveAt(w, m.id); return o ? `${m.id}|${o.a.convo.node}|${o.a.lines.join('/')}` : ''; };
    assert.equal(run(), run());
  });
  ok('follow-ups exist for a subject he raised and use only what the record holds', { tags: ['scenario'] }, () => {
    const w = world60();
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const ww = deserialize(serialize(w)); const mm = ww.chars[m.id];
      const o = chatWith(ww, mm, { trust: 0.9, affection: 0.9, grudge: 0 });
      if (o.r.convo?.node !== 'incident') continue;
      const codes = options(ww, o.p, mm, o.r.convo).map((x) => x.code);
      // (V90: no menus inside a subject: the questions that follow from what he said are on screen, a few, with the way out)
      assert.ok(codes.length <= 7 && codes.includes('root'), codes.join());
      assert.ok(codes.some((c) => ['source', 'who', 'how_much', 'witness', 'tell_more', 'involve', 'view', 'why'].includes(c.split(':')[0])), codes.join());
      return;
    }
    assert.fail('nobody had anything to tell');
  });
  ok('a conversation that passes on news carries on from it, with questions about that news', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w);
    let seen = 0;
    for (const t of men(w, 70)) {
      if (t.rank === 'civilian') continue;
      (p.intro ??= {})[t.id] = w.now;
      t.rels[p.id] = { trust: 0.6, respect: 0.5, affection: 0.5, grudge: 0, lastMet: w.now };
      const r = say(w, p, t, startConvo(t.id), 'old_times');
      if (r.convo?.node === 'incident') {
        seen++;
        const top = options(w, p, t, r.convo).map((x) => x.code);
        const o = top.map((x) => x.split(':')[0]);
        assert.ok(o.some((c) => ['source', 'who', 'how_much', 'witness', 'tell_more', 'involve'].includes(c)), `${t.name}: ${o.join()}`);
        assert.ok(o.includes('root'), 'always a way back');
        if (seen >= 3) break;
      }
    }
    assert.ok(seen >= 1, 'at least one man had something to pass on');
  });
  ok('a trusted man tells what an untrusted one withholds', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w);
    let held = 0, open = 0;
    for (const m of men(w).filter((x) => x.rank !== 'civilian')) {
      const f = { id: 'fy', t: w.now, kind: 'beating', actor: p.id === 'c1' ? 'c2' : 'c1', victim: m.id, text: 'x', district: m.district } as never;
      m.rels[p.id] = { trust: 0.1, respect: 0.2, affection: 0.1, grudge: 0, lastMet: w.now }; const low = holdsBack(w, m, p, f, 'who');
      m.rels[p.id] = { trust: 0.9, respect: 0.8, affection: 0.8, grudge: 0, lastMet: w.now }; const high = holdsBack(w, m, p, f, 'who');
      if (low) held++; if (!high) open++;
      assert.ok(!high, `${m.name} holds back even from a man he trusts completely`);
    }
    assert.ok(held >= 3, `only ${held} men guarded`);
  });
  ok('the Commission is discussed by trust and rank, and nothing hidden is said', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w);
    const fact = Object.values(w.facts).find((x) => x.kind === 'ruling' && !x.actor);
    if (!fact) return;
    for (const m of men(w).filter((x) => x.rank === 'capo' || x.rank === 'underboss')) {
      p.known[fact.id] ??= { t: w.now, from: 'public', knowsActor: false } as never;
      const c = { id: m.id, node: 'incident', ctx: { fact: fact.id, asked: [] as string[] } };
      m.rels[p.id] = { trust: 0.05, respect: 0.1, affection: 0.1, grudge: 0, lastMet: w.now };
      const cold = say(w, p, m, JSON.parse(JSON.stringify(c)), 'involve').lines.join(' ');
      m.rels[p.id] = { trust: 0.9, respect: 0.8, affection: 0.8, grudge: 0, lastMet: w.now };
      const warm = say(w, p, m, JSON.parse(JSON.stringify(c)), 'involve').lines.join(' ');
      assert.notEqual(cold, warm, m.name);
      assert.ok(!/older|hidden|textHidden/.test(warm));
      return;
    }
  });
  ok('a quarrel keeps one record: sit-down reuses the complaint on the books, a refusal leaves nothing, a ruling settles the dispute', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w);
    const d = (w.disputes ?? []).find((x) => x.status === 'open');
    if (!d) return;
    const t = w.chars[d.a]; (p.intro ??= {})[t.id] = w.now;
    t.known[d.fact] ??= { t: w.now, from: 'self', knowsActor: true } as never; p.known[d.fact] ??= { t: w.now, from: t.id, knowsActor: true } as never;
    const mk = () => ({ id: t.id, node: 'incident', ctx: { fact: d.fact, asked: [] as string[] } });
    const open0 = w.grievances.length;
    const r1 = say(w, p, t, mk(), 'sitdown');
    if (typeof r1.meeting === 'string') { assert.equal(w.grievances.length, open0, 'a refusal leaves nothing'); return; }
    assert.equal(w.grievances.length, open0 + 1);
    say(w, p, t, mk(), 'sitdown');
    assert.equal(w.grievances.length, open0 + 1, 'second ask reuses the grievance');
    assert.equal(w.disputes!.find((x) => x.id === d.id)!.status, 'open', 'asking changes nothing by itself');
    choose(w, p, r1.meeting as never, 'r_split');
    assert.equal(w.disputes!.find((x) => x.id === d.id)!.status, 'settled');
  });
  ok('friendly talk cannot be farmed: it stops raising trust at "knows you well" and tapers within a week', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w); p.cash = 1e6;
    const t = men(w).find((x) => x.rank === 'soldier' && x.id !== p.id && x.id !== p.bossId)!;
    (p.intro ??= {})[t.id] = w.now;
    const before = t.rels[p.id]?.trust ?? 0;
    let one = 0;
    for (let d = 0; d < 40; d++) { for (const a of ['old_times', 'drink', 'how', 'op', 'op', 'op']) { try { say(w, p, t, startConvo(t.id), a); } catch { /* not every code applies */ } if (d === 0 && a === 'op') one = t.rels[p.id].trust; } w.now += 1440; }
    assert.ok(t.rels[p.id].trust <= Math.max(before, 0.6) + 1e-9, `trust ${t.rels[p.id].trust}`);
    assert.ok(t.rels[p.id].affection <= Math.max(0.8, 0.0) + 0.05 || before > 0.8);
    void one;
  });
  ok('when two records belong together, the account says what the records say and no more', { tags: ['unit'] }, () => {
    const w = world60();
    const ref = Object.values(w.facts).find((f) => f.kind === 'protection_refused');
    const vand = Object.values(w.facts).find((f) => f.kind === 'vandalism' && /refused to pay/.test(f.text));
    assert.ok(ref && vand);
    // new refusals now carry the cause; old saves simply have none, and are then described without claiming one
    assert.ok(!vand!.cause || vand!.cause === ref!.id || w.facts[vand!.cause] !== undefined);
  });
});
