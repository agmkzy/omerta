// Menus: the opening screen is short, nothing reachable in V76 was removed, every row is a real sentence, the incident questions only
// name what you know, and browsing changes nothing in the save. From the V77 and V78 suites; since Gate 4, the same rules on the one
// conversation screen (conv/visit.ts: the headings Business, Personal and Confront, the subjects under them, his answers).
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../engine';
import { DAY } from '../../types';
import { begin, choose, everything } from '../../conv/visit';
import { ctx, PANES } from '../../conv/kit';
import { offersNow } from '../../conv/run';
import { ACTS } from '../../conv/acts';
import { incidentsOf, involvedIn } from '../../conv/acts/words';
import { world60, men, introAll, reach, talk, visitAt, BASELINES } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });
const fresh = (w: ReturnType<typeof world60>) => deserialize(serialize(w));

describe('menus', { timeout: 120_000 }, () => {
  ok('the opening screen is short: what he raises (two at most), the three headings in their order (each only when there is something under it), and leaving', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w)) {
      const v = begin(fresh(w), m.id);
      if (v.ended || v.th.shut) continue;
      const heads = v.choices.filter((x) => x.group === 'intent').map((x) => x.id.replace('u:', ''));
      assert.deepEqual(heads, PANES.filter((k) => heads.includes(k)), `${m.name}: the headings, always in the same order`);
      assert.ok(v.choices.length <= 9, `${m.name}: ${v.choices.length} rows`);
      assert.equal(v.choices.at(-1)!.group, 'leave', 'and there is always a way to leave');
      // (under a heading: four subjects at most, then "Other…", the way back, and leaving)
      for (const k of heads) { const w2 = fresh(w), v2 = begin(w2, m.id); choose(w2, v2, 'u:' + k); assert.ok(v2.choices.filter((x) => !['more', 'leave'].includes(x.group)).length <= 4, `${m.name} ${k}: ${v2.choices.length}`); }
    }
  });
  // (deliberately folded into another interaction by Gate 4: the old drink is the evening, "Heard anything?" is part of "What's new?";
  // and the old menus' doors are gone, their contents under the headings)
  const MERGED: Record<string, string> = { drink: 'spend', chat: 'news', cr_money: 'how' }; // (cr_money: folded into asking how he is keeping by V78)
  ok('nothing that was reachable in V76 has been removed: every kind of action the old engine offered is one of the conversation’s interactions', { tags: ['unit'] }, () => {
    const snap = JSON.parse(readFileSync(join(BASELINES, 'v76-option-codes.json'), 'utf8')) as Record<string, string[]>;
    const kinds = new Set(Object.values(snap).flat().map((x) => x.slice(0, x.indexOf('|')).split(':')[0]));
    const NAV = new Set(['root', 'n', 'more', 'f', 'sub']);
    const lost = [...kinds].filter((k) => !NAV.has(k) && !ACTS[k] && !MERGED[k]);
    assert.deepEqual(lost, [], 'lost: ' + lost.join(', '));
  });
  ok('and every interaction a man allows right now is reachable through the screen', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    let n = 0; const lost: string[] = [];
    for (const m of men(w, 25)) {
      const now = reach(w, m.id), w2 = fresh(w), v = begin(w2, m.id);
      if (v.th.shut) continue;
      for (const o of offersNow(ctx(w2, v))) { n++; if (!now.has(o.code)) lost.push(`${m.name}:${o.code}`); }
    }
    assert.ok(n > 150, 'offers checked: ' + n);
    assert.deepEqual(lost, [], 'lost: ' + lost.slice(0, 8).join(', '));
  });
  ok('every spoken label is a real sentence: not empty, no placeholder left over, costs still shown', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w)) {
      const w2 = fresh(w), v = begin(w2, m.id);
      for (const o of [...v.choices, ...everything(w2, v)]) {
        assert.ok(o.label.length >= 3, `${m.name}/${o.id}`);
        assert.ok(!/\$1\b|undefined|\{\w+\}/.test(o.label + (o.note ?? '')), `${o.id}: ${o.label} / ${o.note}`);
      }
    }
    // a gesture with a price still says it
    const t = Object.values(w.chars).find((m) => m.alive && m.rank !== 'civilian' && m.familyId && m.familyId !== P(w).familyId)!;
    const w2 = fresh(w), v = begin(w2, t.id);
    assert.ok(everything(w2, v).some((o) => /\$30/.test(o.label)), 'a drink across the line says what it costs');
  });
  ok('a matter between you opens to what belongs to it, and there is always a way back', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId && x.bossId !== p.id)!;
    w.debts.push({ id: 'dbg1', creditor: p.id, debtor: m.id, principal: 600, balance: 600, weeklyPayment: 60, missed: 1, status: 'active', rate: 0.05, since: w.now - 20 * DAY, nextDue: w.now + DAY } as never);
    const v = begin(w, m.id), row = everything(w, v).find((x) => x.id === 'a:tk:debt:dbg1');
    assert.ok(row, 'the debt is among the matters: ' + everything(w, v).map((x) => x.id).join());
    const n0 = v.lines.length; choose(w, v, row.id);
    assert.ok(v.lines.slice(n0).some((l) => /\$600/.test(l.text)), 'he answers with the sum: ' + v.lines.slice(n0).map((l) => l.text).join(' | '));
    assert.ok(v.choices.some((x) => /tk:debt:dbg1:(week|ease|forgive|manage)/.test(x.id)), 'and what can be done about the debt follows from it');
    assert.ok(v.choices.some((x) => x.id === 'back') && v.choices.some((x) => x.id === 'leave'), 'a way back and a way out');
    choose(w, v, 'back');
    assert.ok(v.choices.some((x) => x.group === 'intent' || x.id === 'home'), 'back to the talk');
  });
  ok('a quiet man has no manufactured matters', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank === 'civilian' || (x.id !== p.bossId && x.bossId !== p.id && !x.problem && (x.rels[p.id]?.grudge ?? 0) < 0.1 && !w.debts.some((d) => d.debtor === x.id || d.creditor === x.id)))!;
    // (one matter can have more than one thing to say to it: his trouble with a man is one matter, however it can be taken up)
    const MATTER: [RegExp, string][] = [[/^(pick_incident|suspect|mediate|demand)/, 'his trouble'], [/^sh_/, 'the shop'], [/^d_/, 'the debt'], [/^cr_/, 'your man'], [/^(a_|amends)/, 'bad blood']];
    const v = begin(w, m.id), b = new Set(offersNow(ctx(w, v)).filter((o) => o.kind === 'between').map((o) => MATTER.find(([re]) => re.test(o.code))?.[1] ?? o.code));
    assert.ok(b.size <= 2, [...b].join());
  });
  ok('an event is only ever named as what YOU know', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    for (const m of men(w)) {
      const w2 = fresh(w), v = begin(w2, m.id);
      for (const o of everything(w2, v).filter((x) => x.id.startsWith('a:inc:'))) assert.ok(w2.chars[w2.playerId!].known[o.id.slice(6)], `${m.name} offers ${o.id} which the player does not know`);
      // (and asked what he has heard, the ones the player does not know are one open question, never their contents)
      const r = talk(w2, m.id, 'pick_incident', {}, v);
      for (const code of r.next.filter((c) => c.startsWith('inc:'))) { const f = w2.facts[code.slice(4)], lab = r.r.next!.find((o) => o.code === code)!.label; if (!p.known[f.id]) assert.ok(!lab.includes(f.text.slice(0, 25)), `${m.name}: ${lab}`); }
    }
  });
  ok('no dead ends and no nonsense: every event in hand has something to ask, and only a man it happened to is asked what can be done', { tags: ['unit'] }, () => {
    const w = world60(); let n = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian')) {
      const p = P(w); (p.intro ??= {})[m.id] = w.now;
      for (const { f } of incidentsOf(w, m)) {
        n++;
        const v = visitAt(w, m.id, { fact: f.id }), qs = ACTS.inc.questions!(ctx(w, v)).map((o) => o.code);
        assert.ok(qs.length >= 1, `${m.name}: nothing to ask about ${f.id}`);
        if (qs.includes('can_do')) { const w2 = fresh(w), r = talk(w2, m.id, 'can_do', { fact: f.id }); assert.ok(r.lines.length, 'it says what really can be done'); assert.ok(r.next.length >= 1, 'and the things that can be'); }
        if (f.actor === m.id) assert.ok(!qs.includes('view'), 'the man who did it is not asked what he makes of it');
        if (!involvedIn(w, m, f)) assert.ok(!qs.some((c) => ['find', 'speak', 'sitdown'].includes(c)), 'a bystander is not offered to act on it');
      }
    }
    assert.ok(n >= 10, `only ${n} incidents checked`);
  });
  ok('the save still round-trips after browsing', { tags: ['determinism'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w).slice(0, 10)) { const v = begin(w, m.id); for (const k of PANES) { choose(w, v, 'u:' + k); choose(w, v, 'all:' + k); choose(w, v, 'home'); } }
    const s = serialize(w);
    assert.equal(serialize(deserialize(s)), s);
  });
  ok('the old save still round-trips after conversations (no new shape in the save)', { tags: ['determinism'] }, () => {
    const w = world60();
    for (const t of men(w, 10)) { (P(w).intro ??= {})[t.id] = w.now; talk(w, t.id, 'old_times'); }
    const s = serialize(w);
    assert.equal(serialize(deserialize(s)), s);
  });
});
