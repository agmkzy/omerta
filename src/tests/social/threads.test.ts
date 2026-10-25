// The matters between you, as conversations (threads.ts, since Gate 4 conv/subjects/between.ts, on the one conversation): he answers with what is true of his world (or with a lie he is held to),
// the next things to say follow from what has been said, and what is agreed or claimed stays agreed or claimed.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, createDebt, learn, ownerBiz, rel } from '../../core';
import { advance } from '../../engine';
import { begin, everything } from '../../conv/visit';
import { talk, visitAt } from '../dialogue/fixtures';
import { addFavour } from '../../encounters';
import { openAsk, playerMove } from '../../asks';
import { memoTick } from '../../memos';
import { prospects, recruitProspect } from '../../orders';
import { priceOf } from '../../econ';
import { DAY, type Character, type World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const meet = (w: World, t: Character) => { (P(w).intro ??= {})[t.id] = w.now; return visitAt(w, t.id); };
// what can be raised with him now (everything under the headings)
const raised = (w: World, t: Character) => { (P(w).intro ??= {})[t.id] = w.now; const v = begin(w, t.id); return everything(w, v).map((o) => o.id.replace(/^a:/, '')); };
// one of the player's own men, whose last envelopes came up short
function shortMan(w: World, tone: 'downturn' | 'underreported'): Character {
  const p = P(w); p.cash = 5000;
  recruitProspect(w, p, prospects(w, p)[0].c);
  const m = Object.values(w.chars).find((c) => c.bossId === p.id)!;
  for (let i = 0; i < 3; i++) m.books.history.push({ week: i, gross: 400, declared: tone === 'downturn' ? 200 : 150, due: 80, paid: 30, expected: tone === 'downturn' ? 200 : 400, expenses: 0, received: 0, sources: {}, tone, cause: tone === 'downturn' ? 'two of his corner shops stopped taking bets' : undefined });
  m.books.arrears = 150; m.cash = 60;
  if (tone === 'underreported') { m.books.skim = { until: w.now + 30 * DAY, frac: 0.4 }; p.books.flags[m.id] = { amt: 250, n: 2, last: w.now }; }
  rel(m, p.id).trust = 0.3; m.traits.caution = 0.8;
  return m;
}

describe('the matters between you, as conversations', () => {
  ok('his money, coming up light: he explains from what is true, names real places, and a week\'s grace is his word with a date on it', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), m = shortMan(w, 'downturn');
    assert.ok(raised(w, m).includes('tk:earn'), 'it is between you: ' + raised(w, m).join());
    const v = meet(w, m);
    let r = talk(w, m.id, 'tk:earn', {}, v);
    assert.match(r.lines.join(' '), /corner shops stopped taking bets/i, 'the real reason');
    assert.ok(r.next.includes('tk:earn:which'));
    assert.ok(!r.next.includes('tk:earn:missing'), 'nothing you can see is missing, so you cannot say it is');
    r = talk(w, m.id, 'tk:earn:week', {}, v);
    const memo = p.memos.find((x) => x.other === m.id && x.kind === 'promise' && !x.done);
    assert.ok(memo && memo.due! > w.now, 'his promise, with a date');
    w.now = memo!.due! + 1; m.books.arrears = 150; memoTick(w);
    assert.ok(memo!.done && Object.values(w.facts).some((f) => f.actor === m.id && /didn’t keep his word/.test(f.text)), 'and a week later, unpaid, it is a promise broken');
  });

  ok('a man holding money back is pressed on what you can see: he breaks or he denies it, and his story is held against him', { tags: ['scenario'] }, () => {
    let broke = 0, denied = 0;
    for (let i = 0; i < 8; i++) {
      const w = newWorld(7 + i), p = P(w), m = shortMan(w, 'underreported');
      m.traits.caution = i % 2 ? 0.9 : 0.2;
      const v = meet(w, m);
      const r = talk(w, m.id, 'tk:earn', {}, v);
      if (!r.next.includes('tk:earn:missing')) continue; // (he owned it at once)
      talk(w, m.id, 'tk:earn:missing', {}, v);
      const claim = m.talk?.['claim:earn']?.sig;
      if (claim === 'admitted') { broke++; assert.ok(!m.books.skim, 'he stops'); } else { denied++; assert.equal(claim, 'denied'); }
      // later, it is put to him again: he stands by what he said, or not
      const again = talk(w, m.id, 'tk:earn');
      if (claim === 'denied') assert.match(again.lines.join(' '), /told you|said/i, 'he is held to it: ' + again.lines.join(' '));
    }
    assert.ok(broke + denied >= 4 && broke > 0, `some break, some deny (${broke} / ${denied})`);
  });

  ok('a debt: he answers with the sums, a week is a week, and he can be asked who else he owes', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const [a, b] = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian').sort(byId);
    const d = createDebt(w, p.id, a.id, 800, 0.05, 'a private loan'); d.missed = 2;
    createDebt(w, b.id, a.id, 300, 0.05, 'a private loan');
    rel(a, p.id).trust = 0.7;
    const v = meet(w, a);
    let r = talk(w, a.id, 'tk:debt:' + d.id, {}, v);
    assert.match(r.lines.join(' '), /\$800|2 payments/, r.lines.join(' '));
    const due = d.nextDue;
    talk(w, a.id, `tk:debt:${d.id}:week`, {}, v);
    assert.equal(d.nextDue, due + 7 * DAY); assert.equal(d.missed, 1);
    r = talk(w, a.id, `tk:debt:${d.id}:others`, {}, v);
    assert.match(r.lines.join(' '), new RegExp(b.name.split(' ')[0]), 'he names the other man he owes');
  });

  ok('something that happened: he answers from what he knows and how; who told him is his to give or keep', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const [a, v, t, src] = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId);
    t.district = v.district;
    const f = addFact(w, { kind: 'beating', actor: a.id, victim: v.id, text: `${a.name} beat up ${v.name}.`, district: v.district }, { witnesses: [src.id] });
    learn(w, t.id, f, src.id, true); (t.known[f.id] as { how?: string }).how = 't';
    learn(w, p.id, f, 'public', false);
    rel(t, p.id).trust = 0.7; t.traits.caution = 0.3;
    const key = 'tk:ev:' + f.id;
    const vv = meet(w, t);
    let r = talk(w, t.id, key, {}, vv);
    assert.match(r.lines.join(' '), /had it from a man who was there/i, 'he says how he knows: ' + r.lines.join(' '));
    r = talk(w, t.id, key + ':source', {}, vv);
    assert.match(r.lines.join(' '), new RegExp(src.name.split(' ')[0]), 'and who told him, to a man he trusts');
    talk(w, t.id, key + ':who', {}, vv);
    assert.ok(p.known[f.id].knowsActor, 'and now you know who did it');
  });

  ok('a man you helped says so when you see him', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), t = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian').sort(byId)[0];
    addFavour(w, p.id, t.id, 2, 'you covered him when things were bad');
    (p.intro ??= {})[t.id] = w.now;
    const a = begin(w, t.id);
    assert.ok(a.lines.some((l) => /forget|forgotten|remember|stood by me/i.test(l.text)), a.lines.map((l) => l.text).join(' | '));
  });

  ok('a low offer for a piece of a place is answered with the terms, and the answers to it change the terms', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const t = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort(byId)[0], b = ownerBiz(w, t.id)!;
    p.cash = 50000; meet(w, t); t.traits.greed = 0.9; rel(t, p.id).trust = 0.45; // (a man who knows him: the price is the point)
    const s = openAsk(w, 'buy', p, t, { biz: b.id, amt: Math.round(priceOf(w, b) * 0.3 * 0.4 / 50) * 50, share: 0.3 })!;
    const r = playerMove(w, p, s.id, 'ask');
    if (s.st?.[t.id]?.last === 'no') {
      assert.match(r.lines.join(' '), /percent|insult/i, 'he says the terms back: ' + r.lines.join(' '));
      const o = talk(w, t.id, 'm:' + s.id).next;
      assert.ok(o.includes(`x:${s.id}:manage`) && o.includes(`x:${s.id}:share`) && o.includes(`x:${s.id}:raise`), o.join());
      talk(w, t.id, `x:${s.id}:share`);
      assert.equal(s.terms?.share, 0.2, 'less of the place for the same money');
    }
    void advance;
  });
});
