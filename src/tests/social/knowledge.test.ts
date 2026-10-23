// Knowledge and social memory (Stage 5B): a man knows what he saw or was told, and knows how he knows it; news travels up the
// hierarchy through the men who have it; what is believed never changes what happened; and news can go out of date.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, createDebt, learn, ownerBiz, payDebt, rel } from '../../core';
import { intentsOf } from '../../intent';
import { knowing, versionOf } from '../../rumour';
import { share } from '../../actions';
import { menOf } from '../../work';
import type { Character, World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const civ = (w: World, n = 0) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId)[n];
const capWithMan = (w: World): { cap: Character; m: Character } => {
  const cap = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && menOf(w, c).some((m) => !m.isPlayer)).sort(byId)[0];
  return { cap, m: menOf(w, cap).find((x) => !x.isPlayer)! };
};

describe('knowledge and social memory', () => {
  ok('a shopkeeper refuses a collector; the collector tells his captain; the player, who was not told, does not know', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), { cap, m } = capWithMan(w);
    const b = Object.values(w.biz).filter((x) => x.open && x.protection?.familyId === cap.familyId).sort(byId)[0], o = w.chars[b.ownerId];
    const f = addFact(w, { kind: 'protection_refused', actor: o.id, victim: m.id, business: b.id, text: `${o.name} told ${m.name} to get out of ${b.name}.`, district: b.district }, { witnesses: [m.id, o.id] });
    delete cap.known[f.id]; delete p.known[f.id];
    m.cooldown = {}; m.jailedUntil = 0; m.hurtUntil = 0;
    intentsOf(w, m).find((i) => i.kind === 'report')?.act();
    assert.equal(cap.known[f.id]?.from, m.id, 'the captain has it, from his man');
    assert.ok(!p.known[f.id], 'the player was told nothing');
  });

  ok('he knows how he knows it: seen, told, rumour, suspected', { tags: ['unit'] }, () => {
    const w = newWorld(7), [a, b, c, d] = [civ(w, 0), civ(w, 1), civ(w, 2), civ(w, 3)];
    const f = addFact(w, { kind: 'beating', actor: a.id, victim: b.id, text: `${a.name} beat up ${b.name}.`, district: b.district }, { witnesses: [c.id] });
    assert.equal(knowing(w, c, f), 'seen');
    learn(w, d.id, f, c.id, true); (d.known[f.id] as { how?: string }).how = 't';
    assert.equal(knowing(w, d, f), 'told');
    const e = civ(w, 4); learn(w, e.id, f, 'public', false);
    assert.equal(knowing(w, e, f), 'rumour');
    (e.known[f.id] as { blame?: string }).blame = d.id;
    assert.equal(knowing(w, e, f), 'suspected', 'he believes a name he never saw');
    assert.equal(f.actor, a.id, 'what is believed does not change what happened');
  });

  ok('news goes out of date: a missed payment since paid is told as something that may have moved on', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), [a, b] = [civ(w, 0), civ(w, 1)];
    a.cash = 0; b.cash = 5000;
    const d = createDebt(w, b.id, a.id, 500, 0.05, 'a private loan');
    const f = addFact(w, { kind: 'debt_missed', actor: a.id, victim: b.id, cause: d.cause, amount: 60, text: `${a.name} missed a payment to ${b.name}.`, district: a.district }, { witnesses: [p.id] });
    d.missed = 1;
    assert.equal(knowing(w, p, f), 'seen');
    a.cash = 5000; payDebt(w, d, d.balance);
    assert.equal(knowing(w, p, f), 'stale');
    assert.match(versionOf(w, p, f), /moved on/);
  });

  ok('a man who saw it says so when he tells you; a man who only heard it says that', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w), [a, b, c] = [civ(w, 0), civ(w, 1), civ(w, 2)];
    const f = addFact(w, { kind: 'vandalism', actor: a.id, victim: b.id, business: ownerBiz(w, b.id)?.id, text: `${a.name} smashed up ${b.name}'s place.`, district: b.district }, { witnesses: [c.id] });
    delete p.known[f.id];
    rel(c, p.id).trust = 0.9; c.traits.sociability = 0.9;
    const lines: string[] = [];
    share(w, c, p, lines);
    if (p.known[f.id]) assert.ok(lines.some((l) => /I saw it myself/.test(l)), lines.join(' | '));
  });
});
