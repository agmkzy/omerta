// Gate 2a's two mandatory corrections, as regressions. (1) A line says no particular of its own: the kind of business, a day, how
// long, where a man stood, evidence, a name all come through slots filled from the speaker's perception, and a line whose slot he
// cannot fill is never used. (2) The meaning carries what the speaker is to the event (victim, witness, hearsay, actor), which
// decides the words he is given and what he can honestly claim.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, ownerBiz, rel } from '../../core';
import { DAY, type Character, type World } from '../../types';
import { bankText, lastRender, PARTICULARS, render } from '../../conv/render';
import { newSession, perceive } from '../../conv/perception';
import { onIntervention, onIntroduction, onReturnToPromisee, onSeekHelp, onWhoQuestion } from '../../conv/respond';
import { ClaimStore, believe } from '../../conv/beliefs';
import { CLAIMABLE } from '../../conv/types';
import { ferraraWorld } from '../../conv/gate1';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const owners = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open).sort(byId);
// a smashed shop, with its owner, a man who saw it, a man who was told, and a man who knows nothing of it
function smashed(seed = 3) {
  const w = newWorld(seed), owner = owners(w)[0], b = ownerBiz(w, owner.id)!;
  const thug = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier').sort(byId)[0];
  const others = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.id !== owner.id && c.id !== thug.id && c.rank === 'civilian').sort(byId);
  const [saw, told, none] = [others[0], others[1], others[2]];
  const f = addFact(w, { kind: 'vandalism', actor: thug.id, victim: owner.id, business: b.id, text: 'x', district: b.district }, { witnesses: [saw.id] });
  told.known[f.id] = { t: w.now, from: saw.id, knowsActor: true } as Character['known'][string];
  for (const c of [owner, saw, told, none]) { rel(c, P(w).id).trust = 0.7; rel(c, P(w).id).known = 0.6; }
  return { w, owner, b, thug, saw, told, none, f };
}

describe('correction 1: particulars come from perception, or are not said', () => {
  ok('no line in the library carries a particular in its own words', { tags: ['unit'] }, () => {
    const bad = bankText().filter((x) => PARTICULARS.test(x.line));
    assert.deepStrictEqual(bad, []);
  });
  ok('a line naming something the speaker cannot fill is never used', { tags: ['unit'] }, () => {
    const m = { key: 'react.introduction.warnOff.otherFamily', stance: 'polite' as const, toward: 'third' as const, slots: { collectorFamily: 'Santangelo', since: '' } };
    for (let i = 0; i < 20; i++) assert.doesNotMatch(render(m, 'c' + i, 'earnest'), /Have been/);
    const seen = new Set(Array.from({ length: 20 }, (_, i) => render({ ...m, slots: { ...m.slots, since: '3 months' } }, 'c' + i, 'earnest')));
    assert.ok([...seen].some((l) => l.includes('Have been for 3 months')), [...seen].join(' / '));
    // and when nothing at a key is usable, the next, more general key is used, never a line with a hole in it
    const l = render({ key: 'answer.debt.paid', stance: 'firm', toward: 'third', slots: { amt: '$200', when: '' } }, 'x', 'earnest');
    assert.equal(l, '“I paid your man $200. Ask him.”');
  });
  ok('how long a man has paid is said only when his arrangement’s record says so', { tags: ['unit'] }, () => {
    const w = newWorld(3), henry = P(w), s = newSession();
    const owner = owners(w).find((c) => ownerBiz(w, c.id)!.protection && ownerBiz(w, c.id)!.protection!.familyId !== henry.familyId);
    assert.ok(owner, 'a shop protected by another family');
    const pr = ownerBiz(w, owner!.id)!.protection!;
    s.told[owner!.id] = { [henry.id]: { family: w.fam[henry.familyId!].name, name: henry.name, basis: { kind: 'claimed', ref: 'x' } } };
    const r = onIntroduction(perceive(w, s, owner!), henry, w.fam[henry.familyId!].name);
    const since = perceive(w, s, owner!).particulars.protectedSince();
    assert.equal(r.meaning.slots?.since ?? '', since ?? '');
    assert.equal(since === undefined, pr.since === undefined || w.now - pr.since < 14 * DAY);
  });
  ok('the kind of a shop is the shop’s own kind, as the speaker sees it (whatever a fixture has named it)', { tags: ['unit'] }, () => {
    const { w, s, henry, riz, lou, nate, k } = ferraraWorld();
    const r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, ['money']);
    const kind = ownerBiz(w, nate.id)!.kind;
    assert.equal(r.meaning.slots?.forNoun, perceive(w, s, riz).particulars.shopNoun(ownerBiz(w, nate.id)!.id));
    assert.ok(r.meaning.slots?.forNoun, `a noun for ${kind}`);
  });
  ok('when he last saw them is from a fact he knows; without one he does not say when', { tags: ['unit'] }, () => {
    const { w, s, henry, lou, nate } = ferraraWorld();
    assert.equal(onSeekHelp(perceive(w, s, nate), lou).meaning.slots?.lastSeen, '');
    assert.doesNotMatch(render(onSeekHelp(perceive(w, s, nate), lou).meaning, nate.id, 'earnest'), /were in/);
    const b = ownerBiz(w, nate.id)!;
    addFact(w, { kind: 'threat', actor: lou.id, victim: nate.id, business: b.id, text: 'x', district: b.district }, {});
    w.now += 2 * DAY;
    assert.equal(onSeekHelp(perceive(w, s, nate), lou).meaning.slots?.lastSeen, '2 days ago');
    assert.equal(onReturnToPromisee(perceive(w, s, nate), henry, false, 2, lou).meaning.slots?.againstFirst, 'Lou');
  });
});

describe('correction 2: what the speaker is to the event', () => {
  ok('his role comes from his own knowledge: the man it was done to is the victim, however the world recorded his learning of it', { tags: ['unit'] }, () => {
    const { w, owner, thug, saw, told, none, f } = smashed();
    const s = newSession(), role = (c: Character) => perceive(w, s, c).roleIn(f);
    assert.equal(owner.known[f.id].from, 'witness', 'the world records the owner as having learnt of it like a witness');
    assert.deepStrictEqual([role(owner), role(saw), role(told), role(none), role(thug)], ['victim', 'witness', 'hearsay', 'none', 'actor']);
  });
  ok('each role is given its own words, and the meaning carries the role', { tags: ['unit'] }, () => {
    const { w, owner, thug, saw, told, none, f } = smashed();
    const s = newSession(), henry = P(w);
    for (const [c, role] of [[owner, 'victim'], [saw, 'witness'], [told, 'hearsay'], [none, 'none']] as const) {
      const r = onWhoQuestion(perceive(w, s, c), henry, f.id, thug);
      assert.equal(r.meaning.role, role);
      render(r.meaning, c.id, perceive(w, s, c).arch);
      if (role !== 'none') assert.ok(lastRender.info!.key.endsWith('.' + role), `${role}: ${lastRender.info!.key}`);
    }
    assert.doesNotMatch(render(onWhoQuestion(perceive(w, s, told), henry, f.id, thug).meaning, told.id, 'earnest'), /I saw/);
    assert.match(render(onWhoQuestion(perceive(w, s, told), henry, f.id, thug).meaning, told.id, 'earnest', new Set()), /didn’t see it myself/);
  });
  ok('what he can honestly claim follows his role: a witness saying he saw nothing is lying; a victim keeping quiet is not', { tags: ['unit'] }, () => {
    const { w, owner, thug, saw, f } = smashed();
    const s = newSession(), henry = P(w);
    for (const c of [owner, saw]) rel(c, henry.id).trust = 0.1; // not enough to tell him
    const v = onWhoQuestion(perceive(w, s, owner), henry, f.id, thug), x = onWhoQuestion(perceive(w, s, saw), henry, f.id, thug);
    assert.equal(v.decision.chosen, 'withhold'); assert.equal(v.honest, true);
    assert.doesNotMatch(render(v.meaning, owner.id, 'earnest'), /didn’t see/);
    assert.equal(x.decision.chosen, 'withhold'); assert.equal(x.honest, false, 'he saw it and says he saw nothing');
    assert.deepStrictEqual(CLAIMABLE.hearsay.includes('seen'), false);
  });
  ok('a claim that rests on seeing it is believed more than the same claim heard second-hand', { tags: ['unit'] }, () => {
    const { w, saw } = smashed();
    const s = newSession(), henry = P(w), st = new ClaimStore();
    const a = st.add({ by: saw.id, to: henry.id, subject: 'who:x', value: 'Lou', t: w.now, honest: true, words: '', basis: 'seen' });
    const b = new ClaimStore().add({ by: saw.id, to: henry.id, subject: 'who:x', value: 'Lou', t: w.now, honest: true, words: '', basis: 'rumour' });
    assert.ok(believe(perceive(w, s, henry), st, a, saw).belief > believe(perceive(w, s, henry), new ClaimStore(), b, saw).belief);
  });
});
