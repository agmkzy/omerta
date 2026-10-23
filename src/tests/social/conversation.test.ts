// The conversation (Stage 5C): what is real between you first, then five ways into the rest (Business, Socialize, Ask About,
// Organization, Settle Matters) opened in words that fit who he is to you, his answer, only what belongs, and a way on; a man who
// has come to you asks for a minute and you choose how to take it. All of it over the same records and moves as everything else.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt, ownerBiz, payDebt, rel } from '../../core';
import { options, say, startConvo, arrive, type Convo } from '../../dialogue';
import { makeLoan } from '../../encounters';
import { whereIs } from '../../where';
import type { Character, World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const meet = (w: World, t: Character) => { const p = P(w); (p.intro ??= {})[t.id] = w.now; return startConvo(t.id); };
const label = (w: World, t: Character, c: Convo, code: string) => options(w, P(w), t, c).find((o) => o.code === code)?.label;

describe('the conversation', () => {
  ok('the five ways in are opened in words that fit who he is to you', { tags: ['unit'] }, () => {
    const w = newWorld(7), p = P(w);
    const shop = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort(byId)[0];
    const boss = w.chars[p.bossId!];
    const friend = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'associate').sort(byId)[0];
    rel(friend, p.id).trust = 0.8; rel(friend, p.id).affection = 0.7;
    assert.equal(label(w, shop, meet(w, shop), 'f:g:business'), 'I’d like to talk about your business');
    assert.equal(label(w, boss, meet(w, boss), 'f:g:business'), 'I wanted to discuss some business');
    assert.equal(label(w, friend, meet(w, friend), 'f:g:social'), 'How’ve you been keeping?');
    assert.equal(label(w, boss, meet(w, boss), 'root'), 'I’ll let you get on');
    assert.ok(!options(w, p, shop, meet(w, shop)).some((o) => o.code === 'f:g:org'), 'a shopkeeper outside the life has no family business to talk about');
  });

  ok('opening one: he answers, only what belongs to it is offered, and there is a way on to something else', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const shop = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection).sort(byId)[0];
    p.cash = 5000; rel(shop, p.id).trust = 0.5;
    const r = say(w, p, shop, meet(w, shop), 'f:g:business');
    assert.ok(r.lines.length >= 1, 'he answers: ' + r.lines.join(' | '));
    const o = options(w, p, shop, r.convo!);
    assert.ok(o.some((x) => x.code === 'buy_ask') && o.some((x) => x.code === 'suggest'), 'business with a shopkeeper: buying the place, his protection');
    assert.ok(!o.some((x) => x.code === 'how' || x.code === 'chat'), 'not small talk');
    assert.ok(o.some((x) => x.code === 'f:') && o.some((x) => x.code === 'root'), 'and a way on');
    // moving from one to another without leaving
    const r2 = say(w, p, shop, r.convo!, 'f:');
    const r3 = say(w, p, shop, r2.convo!, 'f:g:social');
    assert.ok(options(w, p, shop, r3.convo!).some((x) => x.code === 'how'), 'from business to how he is, in the same conversation');
  });

  ok('on your mind is what is real between you: money he owes you is there, and once it is paid it is gone', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const m = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.id !== p.bossId && c.bossId !== p.id).sort(byId)[0];
    const d = createDebt(w, p.id, m.id, 600, 0.05, 'a private loan'); d.missed = 1;
    const mind = () => options(w, p, m, meet(w, m)).filter((o) => o.group === 'Between you').map((o) => o.code);
    assert.ok(mind().includes('f:debt'), 'the money is there: ' + mind().join());
    m.cash = 5000; payDebt(w, d, d.balance);
    assert.ok(!mind().includes('f:debt'), 'paid, and gone');
  });

  ok('a man who has come to you asks for a minute; you choose how to take it, and each choice has its consequence', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const t = Object.values(w.chars).filter((c) => c.alive && c.familyId === p.familyId && c.rank === 'soldier').sort(byId)[0];
    makeLoan(w, p, t); const e = w.enc.at(-1)!;
    const open = () => arrive(w, p, t, { lines: [] }, whereIs(w, p, t), -1e9);
    const a = open();
    assert.ok(a.lines.some((l) => /minute|word|talk/i.test(l)), 'he asks for a minute: ' + a.lines.join(' | '));
    const codes = options(w, p, t, a.convo).map((o) => o.code);
    for (const c of ['f:enc:' + e.id, 'apx:what:' + e.id, 'apx:wait:' + e.id, 'apx:no:' + e.id]) assert.ok(codes.includes(c), c);
    // what it is about: he says, and you still choose
    const what = say(w, p, t, a.convo, 'apx:what:' + e.id);
    assert.ok(what.lines.join(' ').length > 10 && options(w, p, t, what.convo!).some((o) => o.code === 'f:enc:' + e.id));
    // can it wait: it waits, and he notices
    const t0 = rel(t, p.id).trust, ex = e.expires;
    say(w, p, t, open().convo, 'apx:wait:' + e.id);
    assert.ok(e.expires >= ex && rel(t, p.id).trust < t0, 'it keeps, and he noticed he had to wait');
    // not right now: he takes it as it sounds
    const r0 = rel(t, p.id).respect;
    say(w, p, t, open().convo, 'apx:no:' + e.id);
    assert.ok(rel(t, p.id).respect < r0);
    // sure: what he came to say is the subject
    const s = say(w, p, t, open().convo, 'f:enc:' + e.id);
    assert.equal(s.convo?.ctx.focus, 'enc:' + e.id);
  });
});
