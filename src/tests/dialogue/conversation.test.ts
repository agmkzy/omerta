// What people tell you: arriving is a greeting, what a man tells depends on how he sees you and what the record holds, news leads
// to follow-ups, and friendly talk cannot be farmed. From the V77 and V78 suites; since Gate 4, on the one conversation (conv/visit.ts).
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { deserialize, serialize } from '../../engine';
import { begin, choose as vChoose } from '../../conv/visit';
import { holdsBack } from '../../conv/acts/words';
import { choose } from '../../meetings';
import { world60, men, arriveAt, chatWith, talk } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });
const QS = ['source', 'who', 'how_much', 'witness', 'tell_more', 'involve', 'view', 'why', 'p_how', 'p_claim', 'p_owner', 'can_do', 'own', 'lie', 'press', 'drop'];

describe('what people tell you', () => {
  ok('arriving is a greeting, not a briefing: his first word is short, and nothing is volunteered', { tags: ['scenario'] }, () => {
    const w = world60(); let n = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian')) {
      const o = arriveAt(deserialize(serialize(w)), m.id); n++;
      const him = o.v.lines.filter((l) => l.who === 'him'), text = o.v.lines.map((l) => l.text).join(' ');
      assert.ok(him.length >= 1, `${m.name} said nothing: ${text}`);
      assert.ok(him[0].text.length < 160, him[0].text);
      assert.ok(!/undefined|\{\w+\}/.test(text), text);
      // (his own request, or work he offered, he raises at once: that is his business, not news)
      const learned = Object.keys(o.p.known).filter((id) => !o.before.has(id));
      assert.equal(learned.length, 0, `${m.name} volunteered something on arrival: ${text}`);
    }
    assert.ok(n >= 10, `only ${n} arrivals`);
  });
  ok('"What\'s new?" depends on how he sees you: a friend tells, a wary man gives a rumour at most, a hostile one tells nothing', { tags: ['scenario'] }, () => {
    const w = world60(); let friends = 0, hostile = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const h = chatWith(deserialize(serialize(w)), m, { trust: 0.1, affection: 0.1, grudge: 0.6 }); if (h.learned.length) hostile++;
      const b = chatWith(deserialize(serialize(w)), m, { trust: 0.05, affection: 0.05, grudge: 0 });
      for (const id of b.learned) assert.ok(!w.facts[id].actor || b.p.known[id].knowsActor === false || w.facts[id].actor === b.p.id, `${m.name}: a near-stranger gives a rumour, not names`);
      const f = chatWith(deserialize(serialize(w)), m, { trust: 0.9, affection: 0.9, grudge: 0 }); if (f.learned.length) friends++;
    }
    assert.equal(hostile, 0, 'a hostile man tells you nothing');
    assert.ok(friends >= 3, `only ${friends} friends had something to tell`);
  });
  ok('a man in the middle holds back the name; asking again the same day tells nothing already told', { tags: ['scenario'] }, () => {
    const w = world60(); let checked = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const ww = deserialize(serialize(w)); const mm = ww.chars[m.id];
      const mid = chatWith(ww, mm, { trust: 0.45, affection: 0.2, grudge: 0 });
      if (!mid.learned.length) continue; checked++;
      const again = chatWith(ww, mm, { trust: 0.45, affection: 0.2, grudge: 0 });
      for (const id of again.learned) assert.ok(!mid.learned.includes(id), 'the same news twice in a day');
    }
    assert.ok(checked >= 1);
  });
  ok('what is told is deterministic from the record: the same world gives the same opening', { tags: ['determinism'] }, () => {
    const run = () => { const w = world60(); const m = men(w).find((x) => x.rank !== 'civilian')!; const o = arriveAt(w, m.id); return `${m.id}|${o.v.lines.map((l) => l.text).join('/')}|${o.v.choices.map((c) => c.id).join()}`; };
    assert.equal(run(), run());
  });
  ok('news he passes on leads to questions about it, a few, and the way back', { tags: ['scenario'] }, () => {
    const w = world60();
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const ww = deserialize(serialize(w)); const mm = ww.chars[m.id];
      const o = chatWith(ww, mm, { trust: 0.9, affection: 0.9, grudge: 0 });
      if (!o.v.th.fact) continue;
      const codes = o.v.choices.map((x) => x.id.replace(/^a:/, ''));
      assert.ok(codes.length <= 7 && codes.includes('back') && codes.includes('leave'), codes.join());
      assert.ok(codes.some((c) => QS.includes(c.split(':')[0])), codes.join());
      return;
    }
    assert.fail('nobody had anything to tell');
  });
  ok('reminiscing that passes on news carries on from it, with questions about that news', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w);
    let seen = 0;
    for (const t of men(w, 70)) {
      if (t.rank === 'civilian') continue;
      (p.intro ??= {})[t.id] = w.now;
      t.rels[p.id] = { trust: 0.6, respect: 0.5, affection: 0.5, grudge: 0, lastMet: w.now };
      const r = talk(w, t.id, 'old_times');
      if (r.v.th.fact) {
        seen++;
        assert.ok(r.next.some((c) => QS.includes(c.split(':')[0])), `${t.name}: ${r.next.join()}`);
        if (seen >= 3) break;
      }
    }
    assert.ok(seen >= 1, 'at least one man had something to pass on');
  });
  ok('a trusted man tells what an untrusted one withholds', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w);
    let held = 0;
    for (const m of men(w).filter((x) => x.rank !== 'civilian')) {
      const f = { id: 'fy', t: w.now, kind: 'beating', actor: p.id === 'c1' ? 'c2' : 'c1', victim: m.id, text: 'x', district: m.district } as never;
      m.rels[p.id] = { trust: 0.1, respect: 0.2, affection: 0.1, grudge: 0, lastMet: w.now }; const low = holdsBack(w, m, p, f, 'who');
      m.rels[p.id] = { trust: 0.9, respect: 0.8, affection: 0.8, grudge: 0, lastMet: w.now }; const high = holdsBack(w, m, p, f, 'who');
      if (low) held++;
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
      m.rels[p.id] = { trust: 0.05, respect: 0.1, affection: 0.1, grudge: 0, lastMet: w.now };
      const cold = talk(deserialize(serialize(w)), m.id, 'involve', { fact: fact.id }).lines.join(' ');
      m.rels[p.id] = { trust: 0.9, respect: 0.8, affection: 0.8, grudge: 0, lastMet: w.now };
      const warm = talk(deserialize(serialize(w)), m.id, 'involve', { fact: fact.id }).lines.join(' ');
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
    const open0 = w.grievances.length;
    const r1 = talk(w, t.id, 'sitdown', { fact: d.fact });
    if (!r1.r.meeting) { assert.equal(w.grievances.length, open0, 'a refusal leaves nothing'); return; }
    assert.equal(w.grievances.length, open0 + 1);
    talk(w, t.id, 'sitdown', { fact: d.fact });
    assert.equal(w.grievances.length, open0 + 1, 'second ask reuses the grievance');
    assert.equal(w.disputes!.find((x) => x.id === d.id)!.status, 'open', 'asking changes nothing by itself');
    choose(w, p, r1.r.meeting as never, 'r_split');
    assert.equal(w.disputes!.find((x) => x.id === d.id)!.status, 'settled');
  });
  ok('friendly talk cannot be farmed: it stops raising trust at "knows you well" and tapers within a week', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w); p.cash = 1e6;
    const t = men(w).find((x) => x.rank === 'soldier' && x.id !== p.id && x.id !== p.bossId)!;
    (p.intro ??= {})[t.id] = w.now;
    const before = t.rels[p.id]?.trust ?? 0;
    for (let d = 0; d < 40; d++) {
      for (const a of ['old_times', 'how', 'op', 'op', 'op']) talk(w, t.id, a);
      const v = begin(w, t.id); vChoose(w, v, 'spend'); // (and an evening out)
      w.now += 1440;
    }
    assert.ok(t.rels[p.id].trust <= Math.max(before, 0.6) + 0.05, `trust ${t.rels[p.id].trust}`);
    assert.ok(t.rels[p.id].affection <= 0.85 || before > 0.8, `warmth ${t.rels[p.id].affection}`);
  });
  ok('when two records belong together, the account says what the records say and no more', { tags: ['unit'] }, () => {
    const w = world60();
    const ref = Object.values(w.facts).find((f) => f.kind === 'protection_refused');
    const vand = Object.values(w.facts).find((f) => f.kind === 'vandalism' && /refused to pay/.test(f.text));
    assert.ok(ref && vand);
    assert.ok(!vand!.cause || vand!.cause === ref!.id || w.facts[vand!.cause] !== undefined);
  });
});
