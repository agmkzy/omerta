// Voices: every temperament has lines, no two share a line, nothing talks like the machinery, and who a man is and how
// he stands with you changes what he says. From the V77 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { Character } from '../../types';
import { arch } from '../../voice';
import { BANKS, say as vsay, speak, toneOf, regOf } from '../../voicesheet';
import { askRate } from '../../books';
import { world60, men, ARCHS } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });

describe('voices', { tags: ['unit'] }, () => {
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
    const w = world60(), p = P(w);
    for (const t of men(w, 12)) {
      for (const k of ['how_fine', 'loan_no', 'drink', 'intro_ok']) {
        let last = '';
        for (let i = 0; i < 20; i++) { const s = vsay(w, t, p, k); assert.ok(s.length > 0); if (BANKS[k].filter((e) => !e.a || e.a.includes(arch(t))).length > 1) assert.notEqual(s, last, `${t.name} ${k} #${i}`); last = s; }
      }
    }
  });
  ok('the lines used depend on who he is: ten different men do not all speak alike', () => {
    const w = world60(), p = P(w);
    const all = men(w, 80);
    for (const k of ['how_fine', 'drink', 'loan_no', 'gift_thanks']) {
      const set = new Set(all.slice(0, 40).map((t) => vsay(w, t, p, k).replace(t.name, 'X')));
      assert.ok(set.size >= 6, `${k}: only ${set.size} distinct lines across 40 men`);
    }
  });
  ok('tone and register follow the relationship and read-only: asking never adds a record', () => {
    const w = world60(), p = P(w), t = men(w).find((x) => x.rank === 'capo')!;
    const before = JSON.stringify(t.rels[p.id] ?? null) + JSON.stringify(p.rels[t.id] ?? null);
    toneOf(w, t, p); regOf(w, p, t);
    assert.equal(JSON.stringify(t.rels[p.id] ?? null) + JSON.stringify(p.rels[t.id] ?? null), before);
    t.rels[p.id] = { trust: 0.8, respect: 0.5, affection: 0.7, grudge: 0, lastMet: w.now };
    assert.equal(toneOf(w, t, p), 'warm');
    t.rels[p.id].grudge = 0.5; assert.equal(toneOf(w, t, p), 'hostile');
    assert.equal(regOf(w, p, t), 'wary');
  });
  ok('the speaker is addressed differently by rank: up, down and level read differently', () => {
    const w = world60(), p = P(w);
    const boss = w.chars[p.bossId!], man = men(w).find((x) => x.bossId === p.id) ?? men(w).find((x) => x.rank === 'associate' && x.familyId === p.familyId && x.id !== p.id)!;
    // with nothing between them (a grudge makes it wary, tested above), a man speaks up to his superior
    if (p.rels[boss.id]) { p.rels[boss.id].grudge = 0; delete p.rels[boss.id].why; }
    assert.equal(regOf(w, p, boss), 'up');
    const a = speak(w, p, boss, 'how', 'Ask how he’s holding up');
    const b = speak(w, p, { ...man, bossId: p.id } as Character, 'how', 'Ask how he’s holding up');
    assert.notEqual(a, b);
  });
  ok('rate answers carry the real numbers whatever the man says', () => {
    const w = world60();
    const c = men(w, 200).find((x) => x.bossId && x.kickRate !== undefined && w.chars[x.bossId]?.alive)!;
    const boss = w.chars[c.bossId!];
    const r = askRate(w, c, boss, true);
    assert.ok(r.lines.length >= 1 && r.lines.every((l) => l.length > 0));
    if (r.outcome !== 'refuse') assert.ok(r.lines.some((l) => /\d+%/.test(l)), r.lines.join(' | '));
  });
});
