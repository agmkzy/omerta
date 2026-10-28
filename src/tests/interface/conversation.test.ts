// The conversation screen (src/ui/talk2.ts) as the player sees it: drawn from real visits, with the context box read only from records
// the player is a party to.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt } from '../../core';
import { addFavour } from '../../encounters';
import { begin, choose } from '../../conv/visit';
import { talk2View } from '../../ui/talk2';
import { between } from '../../ui/between';
import { S } from '../../ui/state';
import type { Character, World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const draw = (w: World, f: () => string) => { S.w = w; return f(); };
const soldier = (w: World): Character => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === P(w).familyId && c.rank === 'soldier').sort(byId)[0];
const meet = (w: World, t: Character) => { (P(w).intro ??= {})[t.id] = w.now; return begin(w, t.id); };

describe('the conversation screen', () => {
  ok('what you can say is numbered 1, 2, 3… in order, with the way out last and unnumbered', { tags: ['unit'] }, () => {
    const w = newWorld(7), t = soldier(w), v = meet(w, t);
    const html = draw(w, () => talk2View(v));
    const ns = [...html.matchAll(/data-n="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(ns, ns.map((_, i) => i + 1), 'numbered in order: ' + ns.join());
    assert.ok(ns.length >= 2, 'the subjects are choices');
    // (the way out is the last thing on the screen: under the subjects, beside the conversation)
    assert.ok(html.lastIndexOf('data-a="t2:leave"') > html.lastIndexOf('data-n="'), 'leave comes last');
    assert.ok(html.includes('data-a="t2:leave"'));
  });

  ok('the man, his rank, where and when, and how he sees you are in the header; his words are not', { tags: ['unit'] }, () => {
    const w = newWorld(7), t = soldier(w), v = meet(w, t);
    const html = draw(w, () => talk2View(v));
    const head = html.slice(html.indexOf('<header class="cx-head"'), html.indexOf('</header>'));
    assert.ok(head.includes(t.name) && /ui-chip[^>]*>soldier</.test(head) && head.includes(t.district), 'name, rank, district');
    assert.ok(head.includes('How he sees you') && head.includes(v.relation), 'how he sees you');
    for (const l of v.lines.filter((x) => x.who === 'him')) assert.ok(!head.includes(l.text), 'speech is not in the header');
  });

  ok('the context box says what stands between you, from the records, and nothing when there is nothing', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), t = soldier(w);
    const bare = draw(w, () => talk2View(meet(w, t)));
    assert.ok(!bare.includes('class="cx-ctx'), 'no box over nothing');
    const d = createDebt(w, p.id, t.id, 600, 0.05, 'a private loan');
    addFavour(w, p.id, t.id, 3, 'what you did for his brother');
    addFavour(w, p.id, t.id, 1, 'a word in the right ear');
    const html = draw(w, () => talk2View(meet(w, t)));
    const box = html.slice(html.indexOf('class="cx-ctx'), html.indexOf('</div>', html.indexOf('class="cx-ctx')));
    assert.ok(box.includes('$600') && box.includes(`at $${d.weeklyPayment} a week`), 'the money: ' + box);
    assert.ok(/owes you two favours, the largest a big one/.test(box), 'the favours, said once: ' + box);
    // the same facts read the same way on his page (both read ui/between.ts)
    assert.equal(between(w, p, t).filter((x) => x.kind === 'favour').length, 1);
  });

  ok('a figure to name is a group with its own inputs, reached by its number', { tags: ['unit'] }, () => {
    const w = newWorld(7), t = soldier(w), v = meet(w, t);
    v.choices = [{ id: 'a:nm:s1', label: 'Name your own figure', group: 'reply', amount: { value: 50, min: 10, max: 500, step: 5 } }, { id: 'leave', label: 'Leave', group: 'leave' }];
    const html = draw(w, () => talk2View(v));
    assert.ok(html.includes('role="group"') && html.includes('id="t2fig:a:nm:s1"') && html.includes('data-a="t2amt:a:nm:s1"'));
    assert.ok(html.includes('data-n="1"'), 'reached by 1');
  });

  ok('one short list, not subjects to browse: what you might say to him, the rest under "Something else", the way out last', { tags: ['scenario'] }, () => {
    const w = newWorld(7), t = soldier(w), v = meet(w, t);
    const home = draw(w, () => talk2View(v));
    const act = home.slice(home.indexOf('class="cx-act"'), home.indexOf('class="cx-side'));
    assert.ok(!/Work &amp; money|Work & money|data-a="cxs:/.test(home), 'no subjects to browse');
    assert.ok(/data-a="t2:a:|data-a="t2:(news|spend)/.test(act), 'what can be said, chosen as the engine’s own choices');
    const n = (act.match(/class="ui-choice[" ]/g) ?? []).length;
    assert.ok(n <= 9, `${n} rows`);
    assert.ok(!/“[^”]*”<\/span>/.test(act.replace(/ui-choice__hint[^<]*/g, '')), 'what the player says is printed without quotation marks');
    void choose;
  });

  ok('an ended conversation offers a way on and his page, nothing else', { tags: ['unit'] }, () => {
    const w = newWorld(7), t = soldier(w), v = meet(w, t);
    v.ended = true;
    const html = draw(w, () => talk2View(v));
    assert.ok(html.includes('data-a="back:"') && html.includes(`data-a="ent:${t.id}"`));
    assert.ok(!html.includes('data-a="t2:'), 'no more choices');
  });
});
