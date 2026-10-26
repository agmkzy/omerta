// The overhaul's acceptance, played: the conversation answers from the world and goes on from what was said, and every record that
// names a man leads to the conversation about it. (Scenarios 1, 3, 5 are played in threads.test.ts; 2 in economy/player.test.ts;
// 4, a man who comes to you with something of his own, in conversation.test.ts.)
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt, ownerBiz, rel } from '../../core';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { prospects, recruitProspect } from '../../orders';
import { giveWork, needsOf } from '../../work';
import { S } from '../../ui/state';
import { bizView } from '../../ui/views_a';
import { crewView, reportView } from '../../ui/views_b';

import { businessRoom } from '../../ui/business';
import type { Character, World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const meet = (w: World, t: Character) => { (P(w).intro ??= {})[t.id] = w.now; return begin(w, t.id); };
const screen = (w: World, f: () => string) => { S.w = w; return f(); };
// what the page's link does (web.ts talkTo): the conversation, and in it the matter itself, or the heading a way in belongs under
const HEAD: Record<string, string> = { business: 'business', org: 'business', social: 'personal', ask: 'personal', settle: 'confront' };
function follow(w: World, t: Character, code: string): { v: Visit; codes: string[] } {
  const v = meet(w, t);
  if (code.startsWith('g:')) { choose(w, v, 'u:' + (HEAD[code.slice(2)] ?? 'business')); return { v, codes: v.choices.map((o) => o.id.replace(/^a:/, '')) }; }
  return { v, codes: [...v.choices, ...everything(w, v)].map((o) => o.id.replace(/^a:/, '')) };
}
const links = (html: string) => [...html.matchAll(/data-a="talk:([^"|]+)\|([^"]+)"/g)].map((m) => ({ id: m[1], code: m[2] }));

describe('the overhaul, played', () => {
  ok('6. work you gave a man is a conversation: his report, told again, who else was there, and what you make of it', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w); p.cash = 5000;
    recruitProspect(w, p, prospects(w, p)[0].c);
    const m = Object.values(w.chars).find((c) => c.bossId === p.id)!;
    const debtor = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId)[0];
    createDebt(w, p.id, debtor.id, 400, 0.05, 'a private loan').missed = 2;
    const n = needsOf(w, p).find((x) => x.kind === 'collect' && x.target === debtor.id)!;
    rel(m, p.id).grudge = 0; m.jailedUntil = 0; m.hurtUntil = 0;
    const j = giveWork(w, p, m, n);
    assert.ok(typeof j !== 'string', 'he takes the work');
    j.status = 'done'; j.rep = { text: 'He paid what he had. Two hundred.', truth: 'skim', lie: true, amt: 200, by: m.id };
    // the report screen leads to him, on that job
    const l = links(screen(w, () => reportView(j, [])));
    assert.ok(l.some((x) => x.id === m.id && x.code === 'tk:job:' + j.id), 'the report offers the conversation about it');
    const { v, codes } = follow(w, m, 'tk:job:' + j.id);
    assert.ok(codes.includes('tk:job:' + j.id), codes.join());
    let n0 = v.lines.length; choose(w, v, 'a:tk:job:' + j.id);
    assert.match(v.lines.slice(n0).map((l) => l.text).join(' '), /Two hundred/, 'he gives his report');
    const next = v.choices.map((o) => o.id);
    assert.ok(next.includes(`a:tk:job:${j.id}:again`) && next.includes(`a:tk:job:${j.id}:who`), 'and what can follow it: ' + next.join());
    n0 = v.lines.length; choose(w, v, `a:tk:job:${j.id}:again`);
    assert.ok(v.lines.length > n0 + 1, 'told again, from the start');
  });

  ok('7. every record that names a man leads to the conversation about it: the matter is there to say when you get there', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w); p.cash = 5000;
    // one of your men coming up short, a man who owes you, a place with an owner
    recruitProspect(w, p, prospects(w, p)[0].c);
    const m = Object.values(w.chars).find((c) => c.bossId === p.id)!;
    m.books.history.push({ week: 0, gross: 300, declared: 300, due: 80, paid: 20, expected: 300, expenses: 0, received: 0, sources: {}, tone: 'downturn', cause: 'a slow month' });
    m.books.arrears = 60; m.books.missed = 1;
    const [a] = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId);
    const d = createDebt(w, p.id, a.id, 600, 0.05, 'a private loan'); d.missed = 1;
    const shop = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open && c.id !== a.id).sort(byId)[0];
    for (const t of [m, a, shop]) rel(t, p.id).trust = 0.5;

    const all = [
      ...links(screen(w, crewView)).filter((x) => x.id === m.id),
      ...links(screen(w, businessRoom)).filter((x) => x.id === a.id),
      ...links(screen(w, () => bizView(ownerBiz(w, shop.id)!.id))),
    ];
    assert.ok(all.some((x) => x.code === 'tk:earn'), 'your man: his money');
    assert.ok(all.some((x) => x.code === 'tk:debt:' + d.id), 'the man who owes you: the debt');
    assert.ok(all.some((x) => x.id === shop.id && x.code === 'g:business'), 'the place: business with its owner');
    for (const x of all) {
      const t = w.chars[x.id];
      const { v, codes } = follow(w, t, x.code);
      const want = x.code.startsWith('g:') ? v.pane === (HEAD[x.code.slice(2)] ?? 'business') && codes.length > 2 : codes.includes(x.code);
      assert.ok(want, `${x.code} with ${t.name}: ${codes.join(', ')}`);
    }
  });
});
