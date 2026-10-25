// What the player has taken on, and what was promised him (the coherence repair, phase 2): work accepted anywhere is the same work
// everywhere, done however it is done, and remembered by the man who gave it; a promise made in conversation is on the player's list;
// a question a man came to ask does not vanish because the player looked at something else; nobody gives work to himself.
// Each scenario reproduces a failure from the player-experience playtest (docs/playtest/REPORT.md, issues 2, 7, 13, 24).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { addFact } from '../../core';
import { mkJob, pruneJobs } from '../../jobs';
import { openAsk } from '../../asks';
import { pathInfo } from '../../path';
import { social } from '../../conv/social';
import * as door from '../../conv/doors';
import { S } from '../../ui/state';
import { needs } from '../../ui/views_a';
import { wordRoom } from '../../ui/word';
import type { World } from '../../types';
import { P } from '../helpers';
import { Talk, captain, days, freeShops, selfJobs, standWith, worldFor } from './play';

// The playtest's Rocco: his captain asks him to bring a shop under the family, the way every captain hands out that work (work.giveWork)
function captainsWork(seed: number) {
  const w = worldFor(seed), p = P(w), cap = captain(w), b = freeShops(w)[0], o = w.chars[b.ownerId];
  standWith(w, cap, { trust: 0.45, respect: 0.35, known: 0.5 });
  const j = mkJob(w, { kind: 'lean', title: `Bring ${b.name} under the family`, brief: `${b.name} is paying nobody. Put it on your book.`, giver: cap.id, via: 'boss', assignee: p.id, target: o.id, biz: b.id, pay: 0, days: 5 });
  return { w, p, cap, b, o, j };
}
const world = (w: World) => { S.w = w; return needs(); };
const deeds = (w: World) => pathInfo(w, P(w))?.goals.find((g) => g.key === 'deeds')?.note ?? '';

describe('work taken from the captain in conversation is the same work everywhere', { tags: ['scenario'] }, () => {
  for (const seed of [3, 7]) ok(`seed ${seed}: offered, accepted, shown, done by doing it, remembered as done, and counted`, () => {
    const { w, p, cap, b, o, j } = captainsWork(seed);
    const before = deeds(w);
    const t = new Talk(w, cap);
    // he raises it himself; the player takes it
    t.say(/I’ll take care of it/);
    assert.equal(j.status, 'active', 'accepted');
    t.leave();
    // it is on World while it is being done
    assert.ok(world(w).some((n) => n.title.includes(b.name)), `World shows the work in hand: ${world(w).map((n) => n.title).join(' | ')}`);
    // the player does it his own way: he puts it to the owner and the owner agrees
    const sit = openAsk(w, 'protect', p, o, { biz: b.id, amt: 40 });
    assert.ok(sit, 'the protection is put to him');
    door.agree(w, sit!, 'protect:' + o.id);
    assert.equal(b.protection?.collectorId, p.id, 'the shop pays the player');
    advance(w, w.now + days(1)); pruneJobs(w);
    assert.equal(j.status, 'done', `the job is done because what it asked for is done (status ${j.status}; ${j.notes?.join(' ') ?? ''})`);
    assert.notEqual(deeds(w), before, `it counts as work finished: ${before} → ${deeds(w)}`);
    // and the captain, next time, knows it was done (not refused, not ignored)
    const t2 = new Talk(w, cap);
    const said = t2.his().join(' ');
    assert.ok(!/didn’t want it|You didn’t want|too busy|ignored/i.test(said), `he remembers it wrongly:\n${t2.transcript()}`);
  });
  ok('a job the player has accepted is never offered to him again as new work', () => {
    const { w, cap } = captainsWork(3);
    const t = new Talk(w, cap); t.say(/I’ll take care of it/); t.leave();
    advance(w, w.now + days(1));
    const t2 = new Talk(w, cap);
    assert.ok(!t2.reachable().some((c) => /About what he asked/.test(c.label)), t2.reachable().map((c) => c.label).join(' | '));
    const r = t2.has(/anything you need done/) ? t2.say(/anything you need done/) : undefined;
    if (r) assert.ok(!r.choices.some((c) => /I’ll take care of it/.test(c.label)) || w.jobs.filter((x) => x.giver === cap.id && x.status === 'active').length <= 1, `he hands out more while the first is in hand:\n${t2.transcript()}`);
  });
});

describe('nobody gives work to himself', { tags: ['scenario'] }, () => {
  ok('the player, collecting from a shop, is never offered a job by that shop’s collector (himself)', () => {
    const w = worldFor(3), p = P(w);
    for (const b of freeShops(w)) b.protection = { collectorId: p.id, familyId: p.familyId!, fee: 40, since: w.now } as never;
    let escorts = 0;
    for (let d = 0; d < 60; d++) { advance(w, w.now + days(1)); escorts += w.jobs.filter((j) => j.extra?.gig === 'escort' && j.created > w.now - days(1)).length; assert.deepEqual(selfJobs(w).map((j) => j.title), [], `day ${d}`); }
    assert.ok(escorts > 0, 'the world offered him escort work on his own shops, so the check means something');
  });
});

describe('what the player promises in conversation is on his list', { tags: ['scenario'] }, () => {
  ok('a promise to a man in trouble shows under Your word, with whom and by when', () => {
    const w = worldFor(3), p = P(w), b = freeShops(w)[0], s = w.chars[b.ownerId];
    const [lout] = Object.values(w.chars).filter((c) => c.alive && c.rank === 'associate' && c.familyId && c.familyId !== p.familyId).sort((a, c) => (a.id < c.id ? -1 : 1));
    standWith(w, s, { trust: 0.4, affection: 0.35, known: 0.5 });
    door.demand(w, lout, s, b.id, 55, 'trouble:' + lout.id);
    addFact(w, { kind: 'protection_refused', actor: s.id, victim: lout.id, business: b.id, text: `${s.name} refused to pay ${lout.name}.`, district: b.district }, { witnesses: [s.id, lout.id] });
    advance(w, w.now + days(1));
    const t = new Talk(w, s);
    t.say(/What’s new/);
    t.say(/I’ll talk to|I’ll see what I can do|I’ll make sure/);
    const ob = social(w).obs.find((o) => o.obligor === p.id && o.beneficiary === s.id && o.status === 'pending');
    assert.ok(ob, 'the promise is on record');
    S.w = w;
    const room = wordRoom();
    assert.ok(room.includes(s.name) && !/You have given nobody your word/.test(room), `Your word does not show it:\n${room.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}`);
  });
  ok('a favour from a word put in is listed as a favour, and Favours does not say he owes nobody', () => {
    const w = worldFor(3), p = P(w), cap = captain(w);
    standWith(w, cap, { trust: 0.95, respect: 0.6, affection: 0.4, known: 0.7 });
    const t = new Talk(w, cap);
    const r = t.say(/put in a word/);
    if (!/word|speak|tell him/i.test(r.his.join(' '))) return;
    S.w = w;
    const room = wordRoom().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const owesMe = /you owe nobody/i.test(room), listed = /put in a word/i.test(room);
    assert.ok(!(owesMe && listed), `Your word contradicts itself: ${room}`);
  });
});

describe('a question he came to ask is still his question after the player looks elsewhere', { tags: ['scenario'] }, () => {
  ok('asked where a promise stands, "Something else…" and back does not lose his question', () => {
    const w = worldFor(3), p = P(w), b = freeShops(w)[0], s = w.chars[b.ownerId];
    const [lout] = Object.values(w.chars).filter((c) => c.alive && c.rank === 'associate' && c.familyId && c.familyId !== p.familyId).sort((a, c) => (a.id < c.id ? -1 : 1));
    standWith(w, s, { trust: 0.4, affection: 0.35, known: 0.5 });
    door.demand(w, lout, s, b.id, 55, 'trouble:' + lout.id);
    addFact(w, { kind: 'protection_refused', actor: s.id, victim: lout.id, business: b.id, text: `${s.name} refused to pay ${lout.name}.`, district: b.district }, { witnesses: [s.id, lout.id] });
    advance(w, w.now + days(1));
    const t = new Talk(w, s); t.say(/What’s new/); t.say(/I’ll talk to|I’ll see what I can do|I’ll make sure/); t.leave();
    assert.ok(social(w).obs.some((o) => o.obligor === p.id && o.beneficiary === s.id && o.status === 'pending'), `promised:\n${t.transcript()}`);
    advance(w, w.now + days(4));
    const t2 = new Talk(w, s);
    const asked = t2.v.choices.filter((c) => c.group === 'reply').map((c) => c.id);
    if (!asked.length) return; // (he did not ask, this time)
    // (a man who has been promised help is not asking for it all over again as if it were new)
    assert.ok(!t2.v.choices.some((c) => /^promise:/.test(c.id)), `he asks for the help already promised him, as new:\n${t2.transcript()}`);
    const away = t2.v.choices.find((c) => c.group === 'more');
    if (!away) return;
    t2.say(away.id);
    if (t2.v.choices.some((c) => c.id === 'home')) t2.say('home');
    assert.ok(t2.reachable().some((c) => asked.includes(c.id) || /what he asked|his question|Answer him/i.test(c.label)), `his question is gone:\n${t2.transcript()}\n${t2.reachable().map((c) => c.label).join(' | ')}`);
  });
});
