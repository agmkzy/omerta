// One conversation, developing (the coherence repair, phase 3): what has been said in it is known to both men, a new argument gets an
// answer to that argument, a repeated one may be brushed off, and the first time something is raised is never "again". Each scenario
// reproduces a failure from the player-experience playtest (docs/playtest/REPORT.md, issues 4, 5 and 23).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { mkJob } from '../../jobs';
import { advance } from '../../engine';
import { P } from '../helpers';
import { Talk, captain, days, familyMen, freeShops, standWith, worldFor } from './play';

describe('the first time is not "again"', { tags: ['scenario'] }, () => {
  for (const seed of [3, 7]) ok(`seed ${seed}: coming back to the work he raised, after turning to something else, is not "short memory"`, () => {
    const w = worldFor(seed), p = P(w), cap = captain(w), b = freeShops(w)[0];
    standWith(w, cap, { trust: 0.45, respect: 0.35, known: 0.5 });
    mkJob(w, { kind: 'lean', title: `Bring ${b.name} under the family`, brief: `${b.name} is paying nobody.`, giver: cap.id, via: 'boss', assignee: p.id, target: b.ownerId, biz: b.id, pay: 0, days: 5 });
    const t = new Talk(w, cap);
    // (the screen he opens with is his question; the player turns to something else first, then back to it)
    const away = t.v.choices.find((c) => c.group === 'more' && c.id !== 'leave');
    if (away) t.say(away.id);
    t.say(/About what he asked|You had something for me/);
    assert.deepEqual(t.falseRepeats().map((x) => `${x.label} → ${x.his.join(' ')}`), [], t.transcript());
  });
});

describe('a negotiation develops: a new argument gets its own answer', { tags: ['scenario'] }, () => {
  for (const seed of [3, 7, 11]) ok(`seed ${seed}: asking a made man for a loan, every distinct argument is answered on its own terms, and none is offered twice`, () => {
    const w = worldFor(seed), [lender] = familyMen(w, 'soldier');
    lender.cash = 2500;
    standWith(w, lender, { trust: 0.1, respect: 0.2, affection: 0.1, known: 0.2 });
    const t = new Talk(w, lender);
    t.say((c) => c.id === 'loan:500' || /^a:borrow/.test(c.id));
    const made = new Set<string>();
    for (let i = 0; i < 6 && !t.ended; i++) {
      // the arguments on offer now: nothing already argued is offered again
      const args = t.v.choices.filter((c) => /^loan:\d+:(rep|rate|promise)$/.test(c.id));
      for (const a of args) assert.ok(!made.has(a.id.split(':')[2]), `an argument already made is offered again (${a.label}):\n${t.transcript()}`);
      const next = args[0];
      if (!next) break;
      made.add(next.id.split(':')[2]);
      t.say(next.id);
    }
    assert.ok(made.size >= 2, `the player could make more than one argument:\n${t.transcript()}`);
    assert.deepEqual(t.falseRepeats().map((x) => `${x.label} → ${x.his.join(' ')}`), [], t.transcript());
    // and no two different arguments got the very same words back
    const replies = t.turns.filter((x) => /^loan:\d+:/.test(x.id)).map((x) => x.his.join(' '));
    assert.equal(new Set(replies).size, replies.length, `the same answer to different arguments:\n${t.transcript()}`);
  });
  ok('the same argument made twice may be brushed off, and that is not a false repetition', () => {
    const w = worldFor(3), [lender] = familyMen(w, 'soldier');
    lender.cash = 2500; standWith(w, lender, { trust: 0.1, known: 0.2 });
    const t = new Talk(w, lender);
    t.say((c) => c.id === 'loan:500');
    t.say('loan:500');
    assert.ok(t.turns.at(-1)!.again, 'the harness knows it was said before');
    assert.deepEqual(t.falseRepeats(), []);
  });
});

describe('a scene happens at the hour it is in', { tags: ['scenario'] }, () => {
  ok('a drink in the morning is not an evening, and the visit does not end mid-matter for it', () => {
    const w = worldFor(3), cap = captain(w);
    standWith(w, cap, { trust: 0.4, affection: 0.3, known: 0.5 });
    advance(w, Math.floor(w.now / days(1)) * days(1) + days(1) + 8 * 60); // 08:00 the next day
    const t = new Talk(w, cap);
    const r = t.say(/buy you a drink|Let me buy/);
    const said = [...r.narr, ...r.his].join(' ');
    assert.ok(!/evening|tonight|after closing|night/i.test(said), `a drink at 08:00:\n${t.transcript()}`);
    assert.ok(!t.ended, 'a coffee does not end the visit');
  });
});
