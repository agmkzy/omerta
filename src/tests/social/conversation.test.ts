// The conversation (Stage 5C; since Gate 4, the one conversation: conv/visit.ts): what is real between you first, then the headings
// (Business, Personal, Confront) with what belongs under each, his answer, and a way on; a man who has come to you raises it himself and
// you choose how to take it. All of it over the same records and moves as everything else.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt, ownerBiz, payDebt, rel } from '../../core';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { PANES } from '../../conv/kit';
import { makeLoan } from '../../encounters';
import type { Character, World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const meet = (w: World, t: Character) => { const p = P(w); (p.intro ??= {})[t.id] = w.now; return begin(w, t.id); };
// everything under a heading: the four on it, and the rest behind "Other…"
const under = (w: World, v: Visit, k: string) => { choose(w, v, 'home'); choose(w, v, 'u:' + k); const top = v.choices.map((c) => c.id); if (v.choices.some((c) => c.id === 'all:' + k)) choose(w, v, 'all:' + k); return [...new Set([...top, ...v.choices.map((c) => c.id)])]; };

describe('the conversation', () => {
  ok('the headings are the same three with everyone, in the same order, each only when there is something under it', { tags: ['unit'] }, () => {
    const w = newWorld(7), p = P(w);
    const shop = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort(byId)[0];
    for (const t of [shop, w.chars[p.bossId!]]) {
      const v = meet(w, t), heads = v.choices.filter((c) => c.group === 'intent').map((c) => c.id.slice(2));
      assert.deepEqual(heads, PANES.filter((k) => heads.includes(k)));
      assert.ok(heads.includes('business') && heads.includes('personal'), `${t.name}: ${heads.join()}`);
      assert.equal(v.choices.at(-1)!.id, 'leave');
    }
  });

  ok('under a heading, only what belongs to it; and a way on to something else', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const shop = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection).sort(byId)[0];
    p.cash = 5000; rel(shop, p.id).trust = 0.5;
    const v = meet(w, shop), biz = under(w, v, 'business');
    assert.ok(biz.includes('a:buy_ask') && (biz.includes('protect') || biz.includes('a:suggest')), 'business with a shopkeeper: buying the place, his protection: ' + biz.join());
    assert.ok(!biz.some((x) => x === 'a:how' || x === 'news' || x === 'spend'), 'not small talk');
    assert.ok(biz.includes('home') && biz.includes('leave'), 'and a way on');
    const per = under(w, v, 'personal');
    assert.ok(per.includes('a:how') && per.includes('news'), 'from business to how he is, in the same conversation: ' + per.join());
  });

  ok('what is between you is real: money he owes you is there, and once it is paid it is gone', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const m = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.id !== p.bossId && c.bossId !== p.id).sort(byId)[0];
    const d = createDebt(w, p.id, m.id, 600, 0.05, 'a private loan'); d.missed = 1;
    const between = () => { const v = meet(w, m); return everything(w, v).map((o) => o.id); };
    assert.ok(between().includes('a:tk:debt:' + d.id), 'the money is there: ' + between().join());
    m.cash = 5000; payDebt(w, d, d.balance);
    assert.ok(!between().some((c) => c.startsWith('a:tk:debt:')), 'paid, and gone');
  });

  ok('a man who has come to you raises it; you choose how to take it, and each choice has its consequence', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const t = Object.values(w.chars).filter((c) => c.alive && c.familyId === p.familyId && c.rank === 'soldier').sort(byId)[0];
    makeLoan(w, p, t); const e = w.enc.at(-1)!;
    const a = meet(w, t);
    assert.ok(a.lines.some((l) => l.text === e.lines.at(-1)), 'he says what he came to say: ' + a.lines.map((l) => l.text).join(' | '));
    const codes = a.choices.map((o) => o.id);
    for (const c of ['apx:wait:' + e.id, 'apx:no:' + e.id]) assert.ok(codes.includes('a:' + c), c + ' in ' + codes.join());
    assert.ok(codes.some((c) => c.startsWith(`a:enc:${e.id}:`)), 'and his request’s own answers');
    // can it wait: it waits, and he notices
    const t0 = rel(t, p.id).trust, ex = e.expires;
    choose(w, meet(w, t), 'a:apx:wait:' + e.id);
    assert.ok(e.expires >= ex && rel(t, p.id).trust < t0, 'it keeps, and he noticed he had to wait');
    // not right now: he takes it as it sounds
    const r0 = rel(t, p.id).respect;
    choose(w, meet(w, t), 'a:apx:no:' + e.id);
    assert.ok(rel(t, p.id).respect < r0);
  });
});
