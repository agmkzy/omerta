// What happens to the player reaches the player (the coherence repair, phase 5): money taken from him, a decision made over his head,
// a punishment, a month inside. Each is told to him with its reason, where he will see it, at the time. Each scenario reproduces a
// failure from the player-experience playtest (docs/playtest/REPORT.md, issues 3 and 11).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { addFact } from '../../core';
import { daily, mkJob } from '../../jobs';
import { recall } from '../../memory';
import { DAY, type World } from '../../types';
import { P } from '../helpers';
import { captain, days, familyMen, worldFor } from './play';

/** What the player has come to know since `t0`, as he knows it. */
const heardSince = (w: World, t0: number) => Object.entries(P(w).known).filter(([id, k]) => k.t >= t0 && w.facts[id]).map(([id]) => w.facts[id].text);

describe('a decision made over the player’s head is told to him', { tags: ['scenario'] }, () => {
  ok('when a captain settles a quarrel against the player with the player’s money, the player learns what was paid, to whom, and why', () => {
    // (the settlement is the captain's to make; whether it comes off is a roll, so it is tried on fresh copies until it does)
    for (const seed of [3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61]) {
      const w = worldFor(seed), p = P(w), [victim] = familyMen(w, 'associate').length ? familyMen(w, 'associate') : familyMen(w, 'soldier');
      const mid = w.chars[victim.bossId ?? ''] ?? captain(w);
      p.cash = 2000;
      const f = addFact(w, { kind: 'beating', actor: p.id, victim: victim.id, text: `${p.name} beat ${victim.name}.`, district: victim.district }, { witnesses: [p.id, victim.id] });
      void f;
      (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + 60, kind: 'dispute', a: victim.id, b: p.id, c: mid.id });
      const t0 = w.now, cash0 = p.cash, v0 = victim.cash;
      advance(w, w.now + 7 * DAY);
      const paid = Math.round(cash0 - p.cash - 0);
      if (paid < 100 || victim.cash - v0 < 100) continue; // (it did not come off this way on this seed)
      const heard = heardSince(w, t0);
      assert.ok(heard.some((x) => x.includes(`$${paid}`) || /paid|pay|settled|out of your/i.test(x)), `$${paid} left his pocket and he was told: ${heard.join(' | ') || 'nothing'}`);
      return;
    }
    assert.fail('no seed produced a settlement paid by the player; the scenario needs a seed where it does');
  });
});

describe('a punishment is told, with its reason', { tags: ['scenario'] }, () => {
  ok('when his captain raises his share for ignoring him, the player knows it and why', () => {
    const w = worldFor(3), p = P(w), cap = captain(w);
    cap.traits.violence = 0.1; // (a man who raises a share rather than sending someone round)
    const t0 = w.now;
    for (let i = 0; i < 2; i++) mkJob(w, { kind: 'summons', title: `${cap.name} wants to see you`, brief: 'Come by.', giver: cap.id, via: 'boss', assignee: p.id, pay: 0, days: 1 });
    advance(w, w.now + 2 * DAY); daily(w);
    if (p.kickRate <= 0.15 && !Object.values(w.facts).some((f) => f.kind === 'discipline' && f.victim === p.id)) return; // (he let it go this time)
    const heard = heardSince(w, t0);
    assert.ok(heard.some((x) => /share|ignor/i.test(x)), `his share went to ${p.kickRate} and he was told: ${heard.join(' | ') || 'nothing'}`);
  });
});

describe('a month inside is an account, not a jump', { tags: ['scenario'] }, () => {
  ok('arrested for heat, the player learns why he was picked up, how long he was inside, and what it cost', () => {
    const w = worldFor(3), p = P(w);
    let t0 = w.now;
    for (let wk = 0; wk < 12 && p.jailedUntil <= w.now; wk++) { p.heat = 1.4; t0 = w.now; advance(w, w.now + 7 * DAY); }
    assert.ok(p.jailedUntil > w.now || Object.values(w.facts).some((f) => f.kind === 'arrest' && f.actor === p.id), 'the heat put him inside');
    advance(w, Math.max(w.now, p.jailedUntil) + DAY);
    const heard = heardSince(w, t0);
    assert.ok(heard.some((x) => /\d+ (days|weeks)|a month|weeks? inside/i.test(x) && /heat|police|picked up|charge|arrest/i.test(x)), `what he was told about it: ${heard.join(' | ') || 'nothing'}`);
  });
});
void days;

describe('the world notices what happens to the player', { tags: ['scenario'] }, () => {
  ok('a man of his family who has heard he was beaten says so the next time they talk, once, and a man who has not heard says nothing', () => {
    const w = worldFor(3), p = P(w), [a, b] = familyMen(w, 'soldier'), cap = captain(w);
    const f = addFact(w, { kind: 'beating', actor: cap.id, victim: p.id, text: `Somebody beat ${p.name}.`, district: p.district }, { witnesses: [a.id] });
    assert.ok(f && a.known[f.id] && !b.known[f.id]);
    assert.equal(recall(w, p, a)?.kind, 'news');
    w.now += DAY;
    assert.notEqual(recall(w, p, a)?.kind, 'news', 'it is said once');
    assert.notEqual(recall(w, p, b)?.kind, 'news', 'he never heard it');
  });
});
