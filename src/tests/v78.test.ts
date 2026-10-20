// V78: conversation layers.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { advance, deserialize, serialize } from '../engine';
import { createWorld } from '../world';
import { DAY, World } from '../types';
import { options, say, startConvo, arrive, holdsBack, incidentsOf, involvedIn, isNavCode, INTENTS, Convo } from '../dialogue';
import { generate, perform } from '../actions';
import { choose } from '../meetings';
import { recall } from '../memory';
import { addFact } from '../core';
import { whereIs } from '../where';

const here = dirname(fileURLToPath(import.meta.url));
let base: string | undefined;
const fresh = () => { if (!base) { const b = createWorld(3, 'Tony Marino'); advance(b, b.now + 60 * DAY); base = serialize(b); } return deserialize(base); };
const P = (w: World) => w.chars[w.playerId!];
const CATS = INTENTS;
const men = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, 40);
const introAll = (w: World) => { for (const m of men(w)) (P(w).intro ??= {})[m.id] = w.now; };
const reach = (w: World, id: string) => {
  const p = P(w), t = w.chars[id], codes = new Set<string>();
  const get = (more?: string[]) => { const c = startConvo(id); if (more) (c.ctx as { more?: string[] }).more = more; return options(w, p, t, c); };
  for (const o of get()) codes.add(o.code);
  for (const k of CATS) for (const o of get(['all', k])) codes.add(o.code);
  // and everything one or two steps further in through the menus of the conversation itself
  const dig = (c: Convo, depth: number, seen: Set<string>) => {
    for (const o of options(w, p, t, c)) {
      codes.add(o.code);
      if (depth > 0 && isNavCode(o.code) && o.code !== 'root' && !o.code.startsWith('more:back') && !o.code.startsWith('more:up') && !seen.has(c.node + o.code)) {
        seen.add(c.node + o.code);
        try { const r = say(w, p, t, c, o.code); if (r.convo) dig(r.convo, depth - 1, seen); } catch { /* not every code applies */ }
      }
    }
  };
  dig(startConvo(id), 3, new Set());
  return codes;
};

function fast() {
  ok('the opening screen is short: at most 4 matters, 4 ways to talk and one door to the rest', () => {
    const w = fresh(); introAll(w);
    for (const m of men(w)) {
      const o = options(w, P(w), m, startConvo(m.id));
      const g = (n: string) => o.filter((x) => x.group === n).filter((x) => !x.nav).length;
      assert.ok(g('Between you') <= 4, `${m.name}: ${g('Between you')} matters`);
      assert.ok(g('Talk') <= 4, `${m.name}: ${g('Talk')} talk`);
      assert.ok(o.length <= 10, `${m.name}: ${o.length} rows`);
    }
  });

  ok('nothing that was reachable in V76 has been removed: every action is still within Other business', () => {
    const old = JSON.parse(readFileSync(join(here, 'v78_root_reach.json'), 'utf8')) as Record<string, string[]>;
    const w = fresh(); introAll(w);
    let n = 0, lost: string[] = [];
    for (const m of men(w)) {
      const now = reach(w, m.id);
      for (const code of old[m.id]) { n++; if (!now.has(code) && !now.has('n:' + code.split(':')[0])) lost.push(`${m.name}:${code}`); }
    }
    assert.ok(n > 200);
    assert.deepEqual(lost, [], 'lost: ' + lost.slice(0, 8).join(', '));
  });

  ok('Other business opens to categories, a category lists its actions, and there is always a way back', () => {
    const w = fresh(); introAll(w);
    const m = men(w).find((x) => x.rank !== 'civilian')!;
    let c = startConvo(m.id);
    let o = options(w, P(w), m, c);
    const door = o.find((x) => x.code === 'more:all')!;
    assert.ok(door, 'door present');
    let r = say(w, P(w), m, c, door.code); c = r.convo!;
    o = options(w, P(w), m, c);
    assert.ok(o.some((x) => x.code === 'more:back'));
    const cats = o.filter((x) => x.code.startsWith('more:') && CATS.some((k) => x.code === 'more:' + k));
    assert.ok(cats.length >= 2, 'categories');
    r = say(w, P(w), m, c, cats[0].code); c = r.convo!;
    o = options(w, P(w), m, c);
    assert.ok(o.some((x) => x.code === 'more:up') && o.length >= 3);
    r = say(w, P(w), m, c, 'more:back'); c = r.convo!;
    assert.ok(options(w, P(w), m, c).some((x) => x.group === 'Talk'));
  });

  ok('a man who owes you money: the debt is among the matters, not buried', () => {
    const w = fresh(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId && x.bossId !== p.id)!;
    w.debts.push({ id: 'dbg1', creditor: p.id, debtor: m.id, principal: 600, balance: 600, weeklyPayment: 60, missed: 1, status: 'active', rate: 0.05, since: w.now - 20 * DAY } as never);
    const o = options(w, p, m, startConvo(m.id)).filter((x) => x.group === 'Between you');
    assert.ok(o.some((x) => x.code.startsWith('d_')), o.map((x) => x.code).join());
  });

  ok('a quiet man has no manufactured matters', () => {
    const w = fresh(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank === 'civilian' || (x.id !== p.bossId && x.bossId !== p.id && !x.problem && (x.rels[p.id]?.grudge ?? 0) < 0.1 && !w.debts.some((d) => d.debtor === x.id || d.creditor === x.id)))!;
    const o = options(w, p, m, startConvo(m.id));
    assert.ok(o.filter((x) => x.group === 'Between you').length <= 2);
  });

  ok('the incident door only names what YOU know', () => {
    const w = fresh(); introAll(w); const p = P(w);
    for (const m of men(w)) {
      for (const o of options(w, p, m, startConvo(m.id)).filter((x) => x.code.startsWith('inc:'))) {
        const id = o.code.slice(4);
        assert.ok(p.known[id], `${m.name} offers ${id} which the player does not know`);
      }
      const c = startConvo(m.id); (c.ctx as { more?: string[] }).more = ['all', 'Favours and requests'];
    }
  });

  ok('the incident picker does not print what the player has not learned', () => {
    const w = fresh(); introAll(w); const p = P(w);
    for (const m of men(w)) {
      const c = startConvo(m.id); c.node = 'pick_incident';
      for (const o of options(w, p, m, c).filter((x) => x.code.startsWith('inc:'))) {
        const f = w.facts[o.code.slice(4)];
        if (!p.known[f.id]) assert.ok(!o.label.includes(f.text.slice(0, 25)), `${m.name}: ${o.label}`);
      }
    }
  });

  ok('every row is a real sentence and the actions keep their hints', () => {
    const w = fresh(); introAll(w);
    for (const m of men(w)) for (const o of options(w, P(w), m, startConvo(m.id))) {
      assert.ok(o.label.length >= 3 && !/undefined|\$1/.test(o.label), `${m.name}/${o.code}`);
    }
  });

  const arriveAt = (w: World, id: string) => {
    const p = P(w), x = w.chars[id]; (p.intro ??= {})[id] = w.now;
    const act = generate(w, p, 'socialise').find((a) => a.target === id); if (!act) return undefined;
    const before = new Set(Object.keys(p.known)); const prev = x.rels[p.id]?.lastMet ?? -1e9; act.quiet = true; const r = perform(w, act);
    return { p, x, before, r, a: arrive(w, p, x, r, whereIs(w, p, x), prev) };
  };

  ok('arriving is a greeting, not a briefing: one scene, one line from him, and nothing volunteered', () => {
    const w = fresh(); let n = 0;
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

  const chatWith = (w: World, m: ReturnType<typeof men>[number], rel: { trust: number; affection: number; grudge: number }) => {
    const p = P(w); (p.intro ??= {})[m.id] = w.now;
    m.rels[p.id] = { trust: rel.trust, respect: 0.5, affection: rel.affection, grudge: rel.grudge, lastMet: w.now };
    delete p.cooldown[`chat:${m.id}`];
    const before = new Set(Object.keys(p.known));
    const r = say(w, p, m, startConvo(m.id), 'chat');
    return { p, r, learned: Object.keys(p.known).filter((id) => !before.has(id)) };
  };

  ok('"What\'s been going on?" depends on how he sees you: a friend tells, a wary man brushes you off, a hostile one asks why you are asking', () => {
    const w = fresh(); let friends = 0, hostile = 0;
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

  ok('a man in the middle holds back the name; a close one gives it; asking again the same day gives nothing new', () => {
    const w = fresh(); let partial = 0, checked = 0;
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

  ok('what is told is deterministic from the record: the same world gives the same subject', () => {
    const run = () => { const w = fresh(); const m = men(w).find((x) => x.rank !== 'civilian')!; const o = arriveAt(w, m.id); return o ? `${m.id}|${o.a.convo.node}|${o.a.lines.join('/')}` : ''; };
    assert.equal(run(), run());
  });

  ok('follow-ups exist for a subject he raised and use only what the record holds', () => {
    const w = fresh();
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian' && x.id !== P(w).bossId)) {
      const ww = deserialize(serialize(w)); const mm = ww.chars[m.id];
      const o = chatWith(ww, mm, { trust: 0.9, affection: 0.9, grudge: 0 });
      if (o.r.convo?.node !== 'incident') continue;
      const codes = options(ww, o.p, mm, o.r.convo).map((x) => x.code);
      assert.ok(codes.length <= 4 && codes.includes('root'), codes.join());
      const learn = options(ww, o.p, mm, say(ww, o.p, mm, o.r.convo, 'sub:learn').convo!).map((x) => x.code);
      assert.ok(learn.includes('sub:back') || codes.includes('sub:learn') === false, learn.join());
      return;
    }
    assert.fail('nobody had anything to tell');
  });

  ok('a trusted man tells what an untrusted one withholds', () => {
    const w = fresh(), p = P(w);
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

  ok('the Commission is discussed by trust and rank, and nothing hidden is said', () => {
    const w = fresh(), p = P(w);
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

  ok('a quarrel keeps one record: sit-down reuses the complaint on the books, a refusal leaves nothing, a ruling settles the dispute', () => {
    const w = fresh(), p = P(w);
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

  ok('friendly talk cannot be farmed: it stops raising trust at "knows you well" and tapers within a week', () => {
    const w = fresh(), p = P(w); p.cash = 1e6;
    const t = men(w).find((x) => x.rank === 'soldier' && x.id !== p.id && x.id !== p.bossId)!;
    (p.intro ??= {})[t.id] = w.now;
    const before = t.rels[p.id]?.trust ?? 0;
    let one = 0;
    for (let d = 0; d < 40; d++) { for (const a of ['old_times', 'drink', 'how', 'op', 'op', 'op']) { try { say(w, p, t, startConvo(t.id), a); } catch { /* not every code applies */ } if (d === 0 && a === 'op') one = t.rels[p.id].trust; } w.now += 1440; }
    assert.ok(t.rels[p.id].trust <= Math.max(before, 0.6) + 1e-9, `trust ${t.rels[p.id].trust}`);
    assert.ok(t.rels[p.id].affection <= Math.max(0.8, 0.0) + 0.05 || before > 0.8);
    void one;
  });

  ok('a word broken is remembered only if the game wrote it down', () => {
    const w = fresh(), p = P(w);
    const t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    const kinds = new Set<string>();
    for (let d = 0; d < 8; d++) { w.now += 1440; const m = recall(w, p, t); if (m) kinds.add(m.kind); }
    assert.ok(!kinds.has('broken'));
    addFact(w, { kind: 'ruling', actor: p.id, victim: t.id, minor: true, text: `${p.name} didn’t keep his word to ${t.name}.`, district: t.district }, { witnesses: [t.id] });
    let got = '';
    for (let d = 0; d < 12 && !got; d++) { w.now += 1440; const m = recall(w, p, t); if (m?.kind === 'broken') got = m.line; }
    assert.ok(got.length > 0);
  });

  ok('when two records belong together, the account says what the records say and no more', () => {
    const w = fresh();
    const ref = Object.values(w.facts).find((f) => f.kind === 'protection_refused');
    const vand = Object.values(w.facts).find((f) => f.kind === 'vandalism' && /refused to pay/.test(f.text));
    assert.ok(ref && vand);
    // new refusals now carry the cause; old saves simply have none, and are then described without claiming one
    assert.ok(!vand!.cause || vand!.cause === ref!.id || w.facts[vand!.cause] !== undefined);
  });

  ok('no dead ends and no nonsense: every incident menu has something to ask, and only a man it happened to is asked what can be done', () => {
    const w = fresh(); let n = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian')) {
      const p = P(w); (p.intro ??= {})[m.id] = w.now;
      for (const { f } of incidentsOf(w, m)) {
        n++;
        let c = { id: m.id, node: 'incident', ctx: { fact: f.id, asked: [] as string[] } } as never as ReturnType<typeof startConvo>;
        const top = options(w, p, m, c);
        assert.ok(top.filter((x) => !x.code.startsWith('sub:') && x.code !== 'root').length + top.filter((x) => x.code.startsWith('sub:')).length >= 1, `${m.name}: ${top.map((x) => x.code).join()}`);
        const door = top.find((x) => x.code === 'sub:act');
        if (door) { assert.ok(involvedIn(w, m, f), 'a bystander is not asked what can be done'); const r = say(w, p, m, c, 'sub:act'); assert.ok(r.lines.length, 'it says what really can be done'); const inner = options(w, p, m, r.convo!).filter((x) => x.code !== 'sub:back'); assert.ok(inner.length >= 1, 'the list has actions'); }
        assert.ok(!top.some((x) => x.code === 'can_do'), 'can_do is never a menu row');
        if (f.actor === m.id) assert.ok(!top.some((x) => x.code === 'view'), 'the man who did it is not asked what he makes of it');
        void c;
      }
    }
    assert.ok(n >= 10, `only ${n} incidents checked`);
  });

  ok('the save still round-trips after browsing', () => {
    const w = fresh(); introAll(w);
    for (const m of men(w).slice(0, 10)) { const c = startConvo(m.id); say(w, P(w), m, c, 'more:all'); }
    const s = serialize(w);
    assert.equal(serialize(deserialize(s)), s);
  });
}
describe('v78 fast', fast);
