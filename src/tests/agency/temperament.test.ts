// V90 acceptance: temperament, measured. Men are taken from the real population of several worlds by the temperament they actually
// have (not forced), grouped into profiles, and put through identical circumstances: the same protection demand made plainly, under
// pressure, and with reasoning; and, for men in the life, the same autonomous choices (going after a man he has a grudge against,
// talking when arrested, carrying on a feud, making peace). TEMPER=file writes the comparison tables. Opt-in (slow).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createWorld } from '../../world';
import { deserialize, serialize } from '../../engine';
import { openAsk, move, stance } from '../../asks';
import { ownerBiz, rel, peek } from '../../core';
import { temper, viewOf, type Temper } from '../../temper';
import { generate } from '../../actions';
import { reconcile, rivalChoice, talkChance } from '../../matters';
import type { Character, Situation, World } from '../../types';

type Pick = (t: Temper, c: Character) => boolean;
const hi = (x: number) => x >= 0.6, lo = (x: number) => x <= 0.4;
const PROFILES: [string, Pick][] = [
  ['proud and courageous', (t) => hi(t.pride) && hi(t.courage)],
  ['proud and cowardly', (t) => hi(t.pride) && lo(t.courage)],
  ['cautious and ambitious', (t, c) => hi(t.caution) && c.traits.ambition >= 0.6],
  ['volatile and empathetic', (t) => hi(t.volatility) && hi(t.empathy)],
  ['agreeable and ruthless', (t) => hi(t.agreeable) && lo(t.empathy)],
  ['courageous and cautious', (t) => hi(t.courage) && hi(t.caution)],
  ['sociable and manipulative', (t, c) => c.traits.sociability >= 0.6 && lo(t.empathy) && lo(t.agreeable)],
  ['meek (cautious, timid)', (t) => hi(t.caution) && lo(t.courage)],
  ['hot (volatile, brave)', (t) => hi(t.volatility) && hi(t.courage)],
  ['everyone', () => true],
];
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '–');

describe('temperament, measured (opt-in)', { tags: ['scenario', 'slow'] }, () => {
  ok('the same circumstances, different temperaments', { timeout: 30 * 60_000 }, () => {
    const out: string[] = ['# V90 temperament: controlled comparisons', ''];
    const worlds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => serialize(createWorld(seed, 'Tony Marino')));
    // ---------------------------------------------------------------- a protection demand, three ways
    type Row = { first: string; then: Record<string, string>; mood: Record<string, string>; dGrudge: Record<string, number>; dFear: Record<string, number>; dTrust: Record<string, number> };
    const rows: { t: Temper; c: Character; r: Row }[] = [];
    for (const save of worlds) {
      const base = deserialize(save), p0 = base.chars[base.playerId!];
      const shop = Object.values(base.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && ownerBiz(base, c.id)?.open);
      for (const c0 of shop) {
        const r: Row = { first: '', then: {}, mood: {}, dGrudge: {}, dFear: {}, dTrust: {} };
        for (const how of ['ask', 'pressure', 'persuade'] as const) {
          const w = deserialize(save), p = w.chars[w.playerId!], c = w.chars[c0.id], b = ownerBiz(w, c.id)!;
          delete b.protection; (p.intro ??= {})[c.id] = w.now;
          const g0 = peek(c, p.id).grudge, f0 = peek(c, p.id).fear ?? 0, t0 = peek(c, p.id).trust;
          const s = openAsk(w, 'protect', p, c, { biz: b.id, amt: Math.max(15, Math.round(b.income * 0.09 / 5) * 5) });
          if (!s) continue;
          const o1 = move(w, s, 'ask');
          if (how === 'ask') r.first = o1.answer ?? 'none';
          let o2 = o1;
          if (how !== 'ask' && !o1.closed) o2 = move(w, s, how);
          r.then[how] = o2.answer ?? (s.stage === 'resolved' ? s.out ?? 'closed' : 'none');
          if (s.stage === 'resolved' && s.out === 'gave in') r.then[how] = 'gave in';
          const words = o2.lines.filter((l) => /^“/.test(l)).join(' ');
          r.mood[how] = words.slice(0, 70);
          r.dGrudge[how] = peek(c, p.id).grudge - g0; r.dFear[how] = (peek(c, p.id).fear ?? 0) - f0; r.dTrust[how] = peek(c, p.id).trust - t0;
          void stance;
        }
        rows.push({ t: temper(c0), c: c0, r });
      }
      void p0;
    }
    out.push('## A protection demand (the same fee relative to his takings), three ways', '', `${rows.length} shopkeepers from 8 worlds. "First" is his answer to the plain offer; the other columns are his answer after the second move.`, '',
      '| Profile | n | First: yes / counter / stall / no | After pressure: yes·gave in / counter / stall / no·help | After reasoning: yes / counter / stall / no | Grudge after pressure | Fear after pressure | Trust after reasoning |', '|---|---|---|---|---|---|---|---|');
    const tally = (xs: string[], ks: string[][]) => ks.map((k) => pct(xs.filter((x) => k.includes(x)).length, xs.length)).join(' / ');
    for (const [name, f] of PROFILES) {
      const g = rows.filter((x) => f(x.t, x.c));
      if (g.length < 4) { out.push(`| ${name} | ${g.length} | (too few) | | | | | |`); continue; }
      out.push(`| ${name} | ${g.length} | ${tally(g.map((x) => x.r.first), [['yes'], ['counter'], ['stall'], ['no', 'help']])} | ${tally(g.map((x) => x.r.then.pressure ?? ''), [['yes', 'gave in'], ['counter'], ['stall'], ['no', 'help']])} | ${tally(g.map((x) => x.r.then.persuade ?? ''), [['yes'], ['counter'], ['stall'], ['no', 'help']])} | ${avg(g.map((x) => x.r.dGrudge.pressure ?? 0))} | ${avg(g.map((x) => x.r.dFear.pressure ?? 0))} | ${avg(g.map((x) => x.r.dTrust.persuade ?? 0))} |`);
    }
    out.push('', '### What they said under pressure (a few from each profile)', '');
    for (const [name, f] of PROFILES.slice(0, -1)) {
      const g = rows.filter((x) => f(x.t, x.c)).slice(0, 4);
      if (g.length) out.push(`- **${name}:** ${g.map((x) => `${x.r.then.pressure}: ${x.r.mood.pressure || '(no words)'}`).join(' · ')}`);
    }
    // ---------------------------------------------------------------- men in the life, on their own
    const men: { t: Temper; c: Character; ret: number; talk: number; feud: Record<string, number>; peace: number }[] = [];
    for (const save of worlds) {
      const w = deserialize(save);
      const made = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.rank !== 'associate' && c.bossId);
      for (const c of made) {
        const foe = Object.values(w.chars).find((x) => x.alive && x.rank !== 'civilian' && x.familyId && x.familyId !== c.familyId)!;
        const w2 = deserialize(save), c2 = w2.chars[c.id], foe2 = w2.chars[foe.id];
        rel(c2, foe2.id).grudge = 0.95;
        // going after him: how strongly hurting the man he hates competes with everything else he might do today (the margin of the
        // best way of hurting him over his best other choice; above zero, it is what he would do)
        const opts = (['work', 'socialise', 'lend', 'collect', 'shakedown', 'gamble', 'retaliate'] as const).flatMap((k) => generate(w2, c2, k));
        const bestR = Math.max(-1, ...opts.filter((a) => a.kind === 'retaliate').map((a) => a.score)), bestO = Math.max(-1, ...opts.filter((a) => a.kind !== 'retaliate').map((a) => a.score));
        const ret = bestR; void bestO;
        const boss = w2.chars[c2.bossId!];
        const talk = boss ? talkChance(w2, c2, boss) : 0;
        const feud: Record<string, number> = {};
        const s = { id: 'x', kind: 'rivalry', m: { heat: 0.6 }, weeks: 2 } as unknown as Situation;
        for (let i = 0; i < 20; i++) { const k = rivalChoice(w2, s, c2, foe2); feud[k] = (feud[k] ?? 0) + 1; }
        let peace = 0; for (let i = 0; i < 10; i++) { const w3 = deserialize(save), a3 = w3.chars[foe.id], t3 = w3.chars[c.id]; rel(t3, a3.id).grudge = 0.4; if (reconcile(w3, s, a3, t3, 100)) peace++; }
        men.push({ t: temper(c), c, ret: ret / 20, talk, feud, peace: peace / 10 });
      }
    }
    out.push('', '## Men in the life, on their own', '', `${men.length} made men from 8 worlds, each with the same grudge against the same kind of man, the same feud, the same offer of peace.`, '',
      '| Profile | n | Urge to hurt the man he hates (score of his best way to hurt him; ordinary days score 0.4–0.7) | Would talk if arrested (chance) | In a feud: strike / slight / undermine / ally / upstairs / peace / nothing | Accepts an offer of peace |', '|---|---|---|---|---|---|');
    for (const [name, f] of PROFILES) {
      const g = men.filter((x) => f(x.t, x.c));
      if (g.length < 4) { out.push(`| ${name} | ${g.length} | (too few) | | | |`); continue; }
      const fk = ['strike', 'slight', 'undermine', 'ally', 'upstairs', 'peace', 'nothing'].map((k) => pct(g.reduce((a, x) => a + (x.feud[k] ?? 0), 0), g.length * 20)).join(' / ');
      out.push(`| ${name} | ${g.length} | ${avg(g.map((x) => x.ret))} | ${avg(g.map((x) => x.talk))} | ${fk} | ${pct(g.reduce((a, x) => a + x.peace, 0), g.length)} |`);
    }
    if (process.env.TEMPER) writeFileSync(process.env.TEMPER, out.join('\n'));
    assert.ok(rows.length > 50 && men.length > 30, `population: ${rows.length} shopkeepers, ${men.length} made men`);
    void viewOf;
  });
});
