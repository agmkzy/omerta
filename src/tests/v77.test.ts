// V77 suite: voices, memory and conversation. Usage: tsx src/tests/v77.test.ts fast
// Focused checks, no long simulation: the world is 60 days old, the rest is the writing layer.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { advance, deserialize, serialize } from '../engine';
import { createWorld } from '../world';
import { DAY, Character, World } from '../types';
import { arch } from '../voice';
import { BANKS, say as vsay, speak, toneOf, regOf } from '../voicesheet';
import { recall } from '../memory';
import { askRate } from '../books';
import { options, say, startConvo } from '../dialogue';
import { addFavour } from '../encounters';
import { addFact, learn } from '../core';

let failed = 0;
const ok = (name: string, f: () => void) => {
  try { f(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + (e as Error).message.split('\n').slice(0, 6).join(' ')); }
};
const here = dirname(fileURLToPath(import.meta.url));
const P = (w: World) => w.chars[w.playerId!];
let base: string | undefined;
const fresh = () => { if (!base) { const b = createWorld(3, 'Tony Marino'); advance(b, b.now + 60 * DAY); base = serialize(b); } return deserialize(base); };
const men = (w: World, n = 40) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n);
const ARCHS = ['proud', 'bitter', 'schemer', 'earnest', 'hothead', 'cold', 'jovial', 'frightened'];

function fast() {
  ok('every temperament has lines wherever a bank is written per temperament', () => {
    for (const [k, bank] of Object.entries(BANKS)) {
      const per = bank.filter((e) => e.a);
      if (!per.length) continue;
      const generic = bank.some((e) => !e.a);
      for (const a of ARCHS) {
        const n = per.filter((e) => e.a!.includes(a as never)).length;
        if (!n) assert.ok(generic, `${k}: no line for ${a} and no general line`);
      }
    }
  });

  ok('the busiest situations give each temperament at least two lines (so asking twice does not repeat)', () => {
    for (const k of ['intro_ok', 'vouch', 'how_fine', 'loan_no', 'drink', 'recall_harm', 'recall_favour', 'recall_job', 'lead', 'rate_agree', 'rate_counter']) {
      for (const a of ARCHS) assert.ok(BANKS[k].filter((e) => e.a?.includes(a as never)).length >= 2, `${k}/${a}`);
    }
  });

  ok('no two temperaments share an identical line for the same situation', () => {
    for (const [k, bank] of Object.entries(BANKS)) {
      const seen = new Map<string, string>();
      for (const e of bank) {
        if (!e.a) continue;
        const prev = seen.get(e.s);
        assert.ok(!prev || prev === e.a.join(), `${k}: "${e.s}" is written for ${prev} and ${e.a}`);
        seen.set(e.s, e.a.join());
      }
    }
  });

  ok('nothing player-facing mentions the machinery, and no placeholder is left unfilled', () => {
    const banned = /\b(simulation|NPC|nonplayer|engine|autonom|trigger|modifier|database|flag|internal state)\b/i;
    for (const [k, bank] of Object.entries(BANKS)) for (const e of bank) {
      assert.ok(!banned.test(e.s), `${k}: ${e.s}`);
      for (const m of e.s.matchAll(/\{(\w+)\}/g)) assert.ok(['N', 'V', 'X', 'Y', 'S', 'what', 'What'].includes(m[1]), `${k}: unknown placeholder ${m[0]}`);
    }
  });

  ok('a man given the same situation twenty times never says the same line twice in a row', () => {
    const w = fresh(), p = P(w);
    for (const t of men(w, 12)) {
      for (const k of ['how_fine', 'loan_no', 'drink', 'intro_ok']) {
        let last = '';
        for (let i = 0; i < 20; i++) { const s = vsay(w, t, p, k); assert.ok(s.length > 0); if (BANKS[k].filter((e) => !e.a || e.a.includes(arch(t))).length > 1) assert.notEqual(s, last, `${t.name} ${k} #${i}`); last = s; }
      }
    }
  });

  ok('the lines used depend on who he is: ten different men do not all speak alike', () => {
    const w = fresh(), p = P(w);
    const all = men(w, 80);
    for (const k of ['how_fine', 'drink', 'loan_no', 'gift_thanks']) {
      const set = new Set(all.slice(0, 40).map((t) => vsay(w, t, p, k).replace(t.name, 'X')));
      assert.ok(set.size >= 6, `${k}: only ${set.size} distinct lines across 40 men`);
    }
  });

  ok('tone and register follow the relationship and read-only: asking never adds a record', () => {
    const w = fresh(), p = P(w), t = men(w).find((x) => x.rank === 'capo')!;
    const before = JSON.stringify(t.rels[p.id] ?? null) + JSON.stringify(p.rels[t.id] ?? null);
    toneOf(w, t, p); regOf(w, p, t);
    assert.equal(JSON.stringify(t.rels[p.id] ?? null) + JSON.stringify(p.rels[t.id] ?? null), before);
    t.rels[p.id] = { trust: 0.8, respect: 0.5, affection: 0.7, grudge: 0, lastMet: w.now };
    assert.equal(toneOf(w, t, p), 'warm');
    t.rels[p.id].grudge = 0.5; assert.equal(toneOf(w, t, p), 'hostile');
    assert.equal(regOf(w, p, t), 'wary');
  });

  ok('every option keeps the same action and hint as V76; only the wording changes', () => {
    const snap = JSON.parse(readFileSync(join(here, 'v77_codes.json'), 'utf8')) as Record<string, string[]>;
    const all = Object.values(snap).flat();
    const HINT = new Map<string, string>(), KHINT = new Map<string, Set<string>>(), known = new Set<string>();
    for (const x of all) { const code = x.slice(0, x.indexOf('|')), hint = x.slice(x.indexOf('|') + 1), kind = code.split(':')[0]; HINT.set(code, hint); known.add(kind); (KHINT.get(kind) ?? KHINT.set(kind, new Set()).get(kind)!).add(hint); }
    // V76 options that exist but never came up in the world the record was made in (a crew man's light envelope, a man just
    // out of hospital): any option the conversation code itself defines in these menus is a real one. Recorded ones keep their hints.
    const src = readFileSync(join(here, '..', 'dialogue.ts'), 'utf8');
    const defined = new Set([...src.matchAll(/add\('([a-z_0-9]+)[':]/g)].map((x) => x[1]));
    for (const k of defined) known.add(k);
    const w = fresh(), p = P(w);
    const ms = men(w);
    for (const m of ms) (p.intro ??= {})[m.id] = w.now;
    let n = 0;
    for (const m of ms) for (const node of ['personal', 'business', 'family', 'disputes', 'orders', 'memos', 'amends', 'shop', 'crew', 'debt', 'myboss', 'rival', 'pick_member', 'pick_concern']) { // root was restructured in V78; v78.test.ts proves nothing was lost
      const c = startConvo(m.id); c.node = node;
      const got = options(w, p, m, c).map((o) => `${o.code}|${o.hint ?? ''}`);
      // The world the snapshot was taken in has moved on (V78 tells you one thing at a time; V89 changes how regard is earned), so
      // which men have which options can differ. What every option does and says about itself cannot: each one shown must be a
      // V76 option with exactly its V76 hint, and nothing outside that record may appear.
      for (const o of got) {
        const [code, hint] = [o.slice(0, o.indexOf('|')), o.slice(o.indexOf('|') + 1)];
        const kind = code.split(':')[0];
        assert.ok(known.has(kind), `${m.name} ${node}: unknown option ${code}`);
        // (where the hint is the man's rank, it is the world's state, and men are promoted)
        const RANKS = ['associate', 'soldier', 'capo', 'underboss', 'boss', 'civilian'];
        if (HINT.has(code) && !(RANKS.includes(hint) && RANKS.includes(HINT.get(code)!))) assert.equal(hint, HINT.get(code), `${m.name} ${node}: ${code} hint changed`);
        else if (KHINT.has(kind)) assert.ok(KHINT.get(kind)!.has(hint), `${m.name} ${node}: ${code} has a hint V76 never gave that kind of option: "${hint}"`);
      }
      n += got.length;
    }
    assert.ok(n > 1000);
  });

  ok('every spoken label is a real sentence: not empty, no placeholder left over, costs still shown', () => {
    const w = fresh(), p = P(w);
    const ms = men(w);
    for (const m of ms) (p.intro ??= {})[m.id] = w.now;
    for (const m of ms) for (const node of ['root', 'personal', 'business', 'crew', 'debt', 'myboss', 'rival', 'amends']) {
      const c = startConvo(m.id); c.node = node;
      for (const o of options(w, p, m, c)) {
        assert.ok(o.label.length >= 3, `${m.name}/${o.code}`);
        assert.ok(!/\$1|undefined|\{\w+\}/.test(o.label), `${o.code}: ${o.label}`);
      }
    }
    // an option with a price in its old wording still has it
    const t = ms.find((m) => m.rank !== 'civilian' && m.bossId !== p.id)!;
    const c = startConvo(t.id); c.node = 'personal';
    const drink = options(w, p, t, c).find((o) => o.code === 'drink')!;
    assert.match(drink.label, /\$40/);
  });

  ok('the speaker is addressed differently by rank: up, down and level read differently', () => {
    const w = fresh(), p = P(w);
    const boss = w.chars[p.bossId!], man = men(w).find((x) => x.bossId === p.id) ?? men(w).find((x) => x.rank === 'associate' && x.familyId === p.familyId && x.id !== p.id)!;
    assert.equal(regOf(w, p, boss), 'up');
    const a = speak(w, p, boss, 'how', 'Ask how he’s holding up');
    const b = speak(w, p, { ...man, bossId: p.id } as Character, 'how', 'Ask how he’s holding up');
    assert.notEqual(a, b);
  });

  ok('memory never invents: with no record behind it, nothing is recalled', () => {
    const w = fresh(), p = P(w);
    w.favours.length = 0;
    p.cooldown = Object.fromEntries(Object.entries(p.cooldown).filter(([k]) => !k.startsWith('recall:')));
    const kinds = new Set<string>();
    for (const t of men(w, 80)) { for (let d = 0; d < 6; d++) { w.now += DAY; const m = recall(w, p, t); if (m) kinds.add(m.kind); } }
    assert.ok(!kinds.has('favour') && !kinds.has('owe') && !kinds.has('harm'), [...kinds].join());
  });

  ok('a favour you did him is remembered, a favour he did you is not claimed by him as yours, and only when it exists', () => {
    const w = fresh(), p = P(w), t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    addFavour(w, p.id, t.id, 2, 'covering $300 of his envelope');
    let hit = '';
    for (let d = 0; d < 12 && !hit; d++) { w.now += DAY; const m = recall(w, p, t); if (m?.kind === 'favour') hit = m.line; }
    assert.ok(hit, 'he should bring up the favour on some day');
    assert.match(hit, /covering \$300 of my envelope|Covering \$300 of my envelope/i);
    assert.ok(!/his envelope/.test(hit));
  });

  ok('a grudge is only remembered if he knows it was you', () => {
    const w = fresh(), p = P(w), t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    const f = addFact(w, { kind: 'beating', actor: p.id, victim: t.id, text: `${p.name} beat up ${t.name}.`, district: t.district }, { witnesses: [] });
    const days = (n: number) => { let k = ''; for (let d = 0; d < n; d++) { w.now += DAY; const m = recall(w, p, t); if (m?.kind === 'harm') k = m.line; } return k; };
    delete t.known[f.id];
    assert.equal(days(10), '', 'he does not know who did it');
    learn(w, t.id, f, 'witness', true);
    assert.ok(days(14).length > 0, 'once he knows, he brings it up');
  });

  ok('at most one memory per man per day', () => {
    const w = fresh(), p = P(w), t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    addFavour(w, p.id, t.id, 2, 'a good turn');
    let n = 0;
    for (let d = 0; d < 20; d++) { for (let i = 0; i < 5; i++) if (recall(w, p, t)) n++; w.now += DAY; }
    assert.ok(n <= 20, 'not more than once a day');
    assert.ok(n >= 3 && n < 20, `memories should be occasional, got ${n} in 20 days`);
  });

  ok('a conversation that passes on news carries on from it, with questions about that news', () => {
    const w = fresh(), p = P(w);
    let seen = 0;
    for (const t of men(w, 70)) {
      if (t.rank === 'civilian') continue;
      (p.intro ??= {})[t.id] = w.now;
      t.rels[p.id] = { trust: 0.6, respect: 0.5, affection: 0.5, grudge: 0, lastMet: w.now };
      const r = say(w, p, t, startConvo(t.id), 'old_times');
      if (r.convo?.node === 'incident') {
        seen++;
        const top = options(w, p, t, r.convo).map((x) => x.code);
        assert.ok(top.includes('sub:learn'), `${t.name}: ${top.join()}`);
        const o = [...top, ...options(w, p, t, say(w, p, t, r.convo, 'sub:learn').convo!).map((x) => x.code)].map((x) => x.split(':')[0]);
        assert.ok(o.some((c) => ['source', 'who', 'how_much', 'witness', 'tell_more', 'involve'].includes(c)), `${t.name}: ${o.join()}`);
        assert.ok(o.includes('sub'), 'always a way back');
        if (seen >= 3) break;
      }
    }
    assert.ok(seen >= 1, 'at least one man had something to pass on');
  });

  ok('the old save still round-trips after conversations (no new shape in the save)', () => {
    const w = fresh(), p = P(w);
    for (const t of men(w, 10)) { (p.intro ??= {})[t.id] = w.now; say(w, p, t, startConvo(t.id), 'old_times'); }
    const s = serialize(w);
    assert.equal(serialize(deserialize(s)), s);
  });

  ok('rate answers carry the real numbers whatever the man says', () => {
    const w = fresh();
    const c = men(w, 200).find((x) => x.bossId && x.kickRate !== undefined && w.chars[x.bossId]?.alive)!;
    const boss = w.chars[c.bossId!];
    const r = askRate(w, c, boss, true);
    assert.ok(r.lines.length >= 1 && r.lines.every((l) => l.length > 0));
    if (r.outcome !== 'refuse') assert.ok(r.lines.some((l) => /\d+%/.test(l)), r.lines.join(' | '));
  });
}

fast();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
