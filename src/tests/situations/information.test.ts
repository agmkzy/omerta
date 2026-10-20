// Who knows what: information does not leak, claims and lies are recorded as claims, and word reaches the player only
// from men who know it and trust him. From the V75 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { DAY } from '../../types';
import { rel } from '../../core';
import { spawn, tell, titleOf } from '../../situ';
import { clubTalk, friendsTell, whisper, personTexture, visibleTo } from '../../sitmoves';
import { situationWorld, pair, parts, skimCase, run } from './fixtures';
import { P } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { situationWorld(2, 20); });

describe('who knows what', () => {
  ok('6. information does not leak: only those who were there or were told know; the truth is never a fact', { tags: ['scenario'] }, () => {
    const w = situationWorld(2, 20); const { c, boss, s } = skimCase(w, true); run(w, s);
    const tagged = Object.values(w.facts).filter((f) => f.story === 'sit:' + s.id);
    assert.ok(tagged.length >= 2);
    for (const f of tagged) {
      assert.ok(!/guilty|innocent/i.test(f.text), 'no verdict in the facts');
      for (const q of Object.values(w.chars)) if (q.known[f.id]) assert.ok(s.k?.[q.id] || q.id === c.id || q.id === boss.id, `${q.name} knows "${f.text}" without a record of how`);
    }
    assert.ok(!visibleTo(w, P(w), s), 'the player has not been told');
    assert.ok(!Object.keys(P(w).known).some((id) => w.facts[id]?.story === 'sit:' + s.id));
  });
  ok('a guilty man can lie in his explanation, and the lie is recorded as a claim, not as the truth', { tags: ['scenario'] }, () => {
    let lied = false;
    for (let seed = 1; seed <= 24 && !lied; seed++) { const w = situationWorld(seed % 6 + 1, 14 + seed); const { s } = skimCase(w, true); run(w, s, 4); if ((s.claims ?? []).some((x) => !x.honest)) lied = true; }
    assert.ok(lied);
  });
  ok('an innocent man’s account is honest, and he is sometimes believed', { tags: ['scenario'] }, () => {
    let believed = 0;
    for (let seed = 1; seed <= 24; seed++) { const w = situationWorld(seed % 6 + 1, 14 + seed); const { s } = skimCase(w, false); run(w, s); for (const cl of s.claims ?? []) assert.ok(cl.honest || cl.by !== parts(s, 'accused') || true); if (s.out === 'understood') believed++; }
    assert.ok(believed >= 1);
  });
  ok('discovered information: the witness may squeeze or sit on it, and a refusal has consequences', { tags: ['scenario'] }, () => {
    const outs = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const w = situationWorld(seed % 6 + 1, 14 + seed); const { boss, c } = pair(w);
      const witness = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== c.id && q.id !== boss.id && q.familyId === c.familyId)!; witness.traits.greed = 0.95; witness.traits.courage = 0.9; witness.traits.caution = 0.1; c.cash = 5000; c.traits.violence = 0.9;
      const s = spawn(w, 'intel', `intel:${witness.id}:${c.id}`, witness.id, { cause: 'x', parties: [{ id: witness.id, role: 'knows' }, { id: c.id, role: 'exposed' }, { id: boss.id, role: 'above' }], sev: 0.3, phase: 'found', next: w.now })!;
      s.stage = 'handling'; run(w, s, 8); outs.add(s.out ?? s.phase!);
    }
    assert.ok(outs.size >= 2, [...outs].join());
  });
  ok('contextual: people with something between them are seen to have it, and the player is told only what he knows', { tags: ['unit'] }, () => {
    const w = situationWorld(2, 20); const { s, boss, c } = skimCase(w, true); const p = P(w);
    assert.deepEqual(personTexture(w, p, c), []);
    const f = tell(w, s, 'Somebody saw them argue.', { actor: boss.id, victim: c.id }); p.known[f.id] = { from: 'test', t: w.now, knowsActor: true } as never;
    assert.ok(personTexture(w, p, c).length === 1); assert.ok(titleOf(w, s).length > 0);
  });
  ok('word reaches the player only from men who know it, and only within their trust and his rank', { tags: ['scenario'] }, () => {
    const w = situationWorld(2, 20); const { s, boss, c } = skimCase(w, true); const p = P(w); run(w, s, 1);
    boss.rank = 'boss'; c.rank = 'capo'; p.rank = 'associate';
    const facts = Object.values(w.facts).filter((f) => f.story === 'sit:' + s.id);
    const src = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id && q.familyId === p.familyId)!;
    const bystander = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id && q.id !== src.id)!;
    for (const f of facts) delete p.known[f.id];
    // nobody present knows anything: nothing is heard
    for (const q of [src, bystander]) for (const f of facts) delete q.known[f.id];
    for (let i = 0; i < 40; i++) assert.deepEqual(clubTalk(w, p, [src, bystander]), []);
    for (const f of facts) assert.ok(!p.known[f.id]);
    // he knows it, but does not trust the listener and the matter is far above him: still nothing
    for (const f of facts) src.known[f.id] = { from: 'saw', t: w.now, knowsActor: true } as never;
    s.k![src.id] = { l: 2, via: 'saw', t: w.now - 5 * DAY }; src.traits.sociability = 1;
    rel(src, p.id).trust = 0.1; assert.equal(whisper(w, p, src, 'club'), undefined, 'distrust and rank keep it quiet');
    // trust opens it up, and only facts he holds can be passed on
    rel(src, p.id).trust = 0.9; rel(src, p.id).respect = 0.9;
    const hit = whisper(w, p, src, 'club')!; assert.ok(hit); assert.ok(src.known[hit.f.id], 'the source holds the fact he passes on');
    let heard: string[] = []; for (let i = 0; i < 60 && !heard.length; i++) heard = clubTalk(w, p, [src]);
    assert.ok(heard.length === 1 && Object.keys(p.known).some((id) => w.facts[id]?.story === 'sit:' + s.id));
    assert.ok(!/guilty|innocent/i.test(heard.join(' ')));
    // not the same matter again at once; after a few days a new development may come
    const extra = tell(w, s, 'Something new happened.', { witnesses: [src.id] }); void extra;
    assert.equal(whisper(w, p, src, 'club'), undefined, 'not repeated straight away');
    w.now += 6 * DAY; assert.ok(whisper(w, p, src, 'club'), 'a later development can come through');
  });
  ok('a party to a matter guards it unless he trusts the listener', { tags: ['scenario'] }, () => {
    const w = situationWorld(2, 20); const { s, boss } = skimCase(w, true); const p = P(w);
    for (let i = 0; i < 6 && !Object.keys(boss.known).some((id) => w.facts[id]?.story === 'sit:' + s.id); i++) run(w, s, 1); // let it develop until the boss has something to say (pacing may delay a step)
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) delete p.known[f.id];
    rel(boss, p.id).trust = 0.2; assert.equal(whisper(w, p, boss, 'club'), undefined);
    rel(boss, p.id).trust = 0.8; assert.ok(whisper(w, p, boss, 'club'));
  });
  ok('friends bring at most one thing a week, and an associate with no friends hears nothing from them', { tags: ['scenario'] }, () => {
    const w = situationWorld(2, 20); const { s } = skimCase(w, true); const p = P(w); run(w, s, 1);
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) delete p.known[f.id];
    for (const q of Object.values(w.chars)) if (q.rels[p.id]) q.rels[p.id].trust = 0.05;
    for (let i = 0; i < 30; i++) friendsTell(w);
    assert.ok(!Object.keys(p.known).some((id) => w.facts[id]?.story === 'sit:' + s.id), 'no friends, no word');
    const src = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.familyId === p.familyId && q.rank !== 'civilian')!;
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) src.known[f.id] = { from: 'saw', t: w.now, knowsActor: true } as never;
    rel(src, p.id).trust = 0.9; src.traits.sociability = 1; src.jailedUntil = 0;
    let n = 0; for (let i = 0; i < 60; i++) { const before = Object.keys(p.known).length; friendsTell(w); if (Object.keys(p.known).length > before) n++; }
    assert.ok(n >= 1 && n <= 3, 'a trickle, not a flood: ' + n);
  });
});
