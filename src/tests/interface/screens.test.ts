// The rebuilt section screens (docs/ui/AUDIT.md §3): they show what the simulation holds, agree with each other about money, and show
// nothing the player could not know.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, createDebt } from '../../core';
import { addFavour } from '../../encounters';
import { memo } from '../../deeds';
import { week, weekLine } from '../../ui/money';
import { businessRoom } from '../../ui/lifeview';
import { wordRoom } from '../../ui/word';
import { factView, personView, todayView } from '../../ui/views_a';
import { crewView, waitView } from '../../ui/views_b';
import { S } from '../../ui/state';
import { takeSide } from '../../ui/layout';
import type { Character, World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const draw = (w: World, f: () => string) => { S.w = w; takeSide(); const main = f(); return main + takeSide(); };
const civs = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian').sort(byId);
const soldier = (w: World): Character => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === P(w).familyId && c.rank === 'soldier').sort(byId)[0];

describe('the money, in one account', () => {
  ok('what comes in each week is the sum of the loans, the shops and the rackets, and every screen says the same figure', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const [a, b] = civs(w);
    createDebt(w, p.id, a.id, 600, 0.05, 'a loan');
    createDebt(w, p.id, b.id, 300, 0.05, 'a loan');
    const shop = Object.values(w.biz).filter((x) => x.open && !x.protection).sort(byId)[0];
    shop.protection = { collectorId: p.id, familyId: p.familyId!, fee: 50, since: w.now } as never;
    const wk = week(w, p);
    const lent = w.debts.filter((d) => d.creditor === p.id).reduce((s, d) => s + d.weeklyPayment, 0);
    assert.equal(wk.comingIn.find((f) => f.label === 'Loans')?.amt, lent);
    assert.equal(wk.comingIn.find((f) => f.label === 'Protection')?.amt, 50);
    assert.equal(wk.inTotal, wk.comingIn.reduce((s, f) => s + f.amt, 0));
    const line = weekLine(wk);
    assert.ok(line.includes(`$${wk.inTotal.toLocaleString('en-US')}`), line);
    assert.ok(draw(w, todayView).includes(line.replace(/’/g, '&#39;').replace(/;/g, ';')) || draw(w, todayView).includes(`$${wk.inTotal.toLocaleString('en-US')} a week`), 'World says it');
    assert.ok(draw(w, businessRoom).includes(`$${wk.inTotal.toLocaleString('en-US')} in`), 'Money says it');
  });
});

describe('a man’s page shows only what the player knows', () => {
  ok('money between him and a third man is not listed; money between him and the player is', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), t = soldier(w), other = civs(w)[3];
    (p.intro ??= {})[t.id] = w.now; p.rels[t.id] ??= { trust: 0.3, respect: 0.2, affection: 0.1, grudge: 0, fear: 0, known: 0.5 } as never;
    createDebt(w, t.id, other.id, 777, 0.05, 'his own business');
    createDebt(w, p.id, t.id, 400, 0.05, 'a loan');
    const html = draw(w, () => personView(t.id));
    assert.ok(!html.includes('$777'), 'his debts with others are his business');
    assert.ok(html.includes('$400'), 'what he owes you is between you');
  });
  ok('an event names the man who did it only when the player knows it was him', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), [victim, culprit] = civs(w);
    const f = addFact(w, { kind: 'beating', actor: culprit.id, victim: victim.id, text: `${culprit.name} beat up ${victim.name}.`, district: victim.district }, { witnesses: [] });
    f.textHidden = `Somebody beat up ${victim.name}.`; // (as the game records a crime: the version for those who don't know who did it)
    p.known[f.id] = { t: w.now, from: 'public', knowsActor: false } as never;
    const html = draw(w, () => factView(f.id));
    assert.ok(!html.includes(`data-a="ent:${culprit.id}"`) && !html.includes('Did it'), 'the culprit is not named');
    assert.ok(!html.includes('Who else knows'), 'nor who else knows');
    p.known[f.id].knowsActor = true;
    assert.ok(draw(w, () => factView(f.id)).includes(`data-a="ent:${culprit.id}"`), 'once he knows, he is');
  });
});

describe('your word', () => {
  ok('favours either way and promises on record are listed; what is done is not', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), t = soldier(w), u = civs(w)[2];
    addFavour(w, p.id, t.id, 3, 'covering a week’s payment');
    addFavour(w, u.id, p.id, 1, 'a word in the right ear');
    memo(w, t, p.id, 'promise', 'You said you would speak to his captain.', { due: w.now + 2 * 1440 });
    const done = memo(w, t, p.id, 'promise', 'You said you would find his brother work.');
    done.done = true;
    const html = draw(w, wordRoom);
    assert.ok(html.includes(`${t.name} owes you`) && html.includes(`You owe ${u.name}`));
    assert.ok(html.includes('You said you would speak to his captain.'));
    assert.ok(!html.includes('find his brother work'), 'a kept promise is not listed');
  });
});

describe('every decision is numbered', () => {
  ok('the screens that ask the player something use the numbered choices', { tags: ['unit'] }, () => {
    const w = newWorld(7), p = P(w);
    const men = Object.values(w.chars).filter((c) => c.alive && c.familyId === p.familyId && c.rank === 'associate' && !c.isPlayer).sort(byId).slice(0, 2);
    for (const m of men) m.bossId = p.id;
    for (const html of [draw(w, waitView), draw(w, crewView)]) assert.ok(html.includes('class="ui-choices"') || html.includes('class="ui-rows"'));
    assert.ok(draw(w, waitView).includes('data-n="1"'));
    assert.ok(!draw(w, crewView).includes('class="opt'), 'no old option lists');
  });
});
