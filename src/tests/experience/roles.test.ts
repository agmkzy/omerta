// Who is speaking to whom, about what (the coherence repair, phase 4): a man never asks the player for help against the player, a victim
// speaks as the man it was done to, and a line is only used in the situation it was written for. Each scenario reproduces a failure
// from the player-experience playtest (docs/playtest/REPORT.md, issues 1 and 9) through the real conversation.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { addFact } from '../../core';
import { social } from '../../conv/social';
import * as door from '../../conv/doors';
import { P } from '../helpers';
import { talk } from '../dialogue/fixtures';
import { Talk, aboutHimToHim, captain, days, familyMen, first, freeShops, selfChoices, selfPromises, selfRequests, standWith, thirdPersonSelf, worldFor } from './play';

// The playtest's Mickey: a shopkeeper the player has leaned on, who has turned him down and wants the trouble to stop.
function leanedOn(seed: number) {
  const w = worldFor(seed), p = P(w), b = freeShops(w)[0], s = w.chars[b.ownerId];
  standWith(w, s, { trust: 0.35, affection: 0.3, known: 0.5 });
  const r = door.demand(w, p, s, b.id, 60, 'protect:' + s.id);
  // (whatever he answered on the spot, he has refused it: the record the trouble starts from)
  addFact(w, { kind: 'protection_refused', actor: s.id, victim: p.id, business: b.id, text: `${s.name} refused to pay ${p.name}.`, district: b.district }, { witnesses: [s.id, p.id] });
  advance(w, w.now + days(2));
  return { w, p, b, s, answer: r.answer };
}

describe('nobody asks the player for help against the player', { tags: ['scenario'] }, () => {
  for (const seed of [3, 7, 11]) ok(`seed ${seed}: the shopkeeper he leaned on, asked what is new, never makes him the man to go to about himself`, () => {
    const { w, s } = leanedOn(seed);
    const pursuit = (social(w).pursuits ?? []).find((x) => x.who === s.id && x.kind === 'stopTrouble');
    assert.ok(pursuit && pursuit.against === P(w).id, 'the refusal starts his wanting the trouble to stop');
    const t = new Talk(w, s);
    if (t.has(/What’s new/)) t.say(/What’s new/);
    for (const c of t.reachable().filter((x) => x.group !== 'leave')) assert.ok(!selfChoices(w, [c]).length, `the player would speak of himself as another man: ${c.label} / ${c.says ?? ''}\n${t.transcript()}`);
    assert.deepEqual(thirdPersonSelf(w, t.his()), [], t.transcript());
    assert.deepEqual(selfRequests(w).map((r) => `${r.wants} ${r.about}`), [], 'no request names the man asked as the man it is against');
    // whatever the player could answer, nothing he promises is a promise to act against himself
    const promise = t.find(/I’ll talk to|I’ll see what I can do|I’ll make sure/);
    if (promise) t.say(promise.id);
    assert.deepEqual(selfPromises(w).map((o) => o.words), []);
  });
  ok('his own captain is never offered the player’s trouble with a shopkeeper as somebody else’s', () => {
    const { w } = leanedOn(3), cap = captain(w);
    standWith(w, cap, { trust: 0.5, respect: 0.4 });
    const t = new Talk(w, cap);
    assert.deepEqual(selfChoices(w, t.reachable()).map((c) => c.label), [], t.transcript());
  });
});

describe('a victim speaks as the man it was done to', { tags: ['scenario'] }, () => {
  ok('asked what he is going to do about it, a man who was beaten does not answer as an onlooker', () => {
    const w = worldFor(3), p = P(w);
    const [victim, actor] = familyMen(w, 'soldier');
    standWith(w, victim, { trust: 0.5, affection: 0.4, known: 0.6 });
    const f = addFact(w, { kind: 'beating', actor: actor.id, victim: victim.id, text: `${actor.name} beat ${victim.name}.`, district: victim.district }, { witnesses: [victim.id, actor.id] });
    door.learnFrom(w, p, f, victim.id, true);
    const t = new Talk(w, victim);
    t.say((c) => c.id === `a:inc:${f.id}` || /recent (incident|trouble)|What went on between/.test(c.label));
    if (t.has((c) => c.id === `a:inc:${f.id}`)) t.say((c) => c.id === `a:inc:${f.id}`);
    assert.deepEqual(aboutHimToHim(victim, t.reachable(), w).map((c) => c.label), [], 'the player asks him about himself as if he were someone else');
    const r = t.say(/What are you going to do about it/);
    const ONLOOKER = /If it were mine|Not my business|Best nobody in this room|I hear a lot|keep my head down and let it play out|I’ll know what I think when I know who it touches/;
    assert.ok(!r.his.some((l) => ONLOOKER.test(l)), `he speaks of his own beating as a bystander would:\n${t.transcript()}`);
  });
});

describe('a line is used only in the situation it was written for', { tags: ['scenario'] }, () => {
  ok('a shop newly under protection is not talked about as an unsolved crime', () => {
    const w = worldFor(3), p = P(w), cap = captain(w), b = freeShops(w)[0];
    const [taker] = familyMen(w, 'soldier');
    standWith(w, cap, { trust: 0.5, known: 0.6 });
    cap.rels[taker.id] = { ...(cap.rels[taker.id] ?? {}), trust: 0.6, respect: 0.5, affection: 0.4, grudge: 0 } as never;
    const f = addFact(w, { kind: 'protection_started', actor: taker.id, business: b.id, text: `${taker.name} has taken on ${b.name}.`, district: b.district }, { witnesses: [taker.id, p.id] });
    door.learnFrom(w, cap, f, taker.id, true); // (he heard; he wasn't there)
    // (asked about it, however he came to be: what he says, and the questions it leaves the player)
    const r = talk(w, cap.id, 'inc:' + f.id);
    const labels = (r.r.next ?? []).map((o) => o.label);
    const CRIME = /Somebody’s stirring|Who have you heard it was|Who was it\?|I’ll find out who did it|What did it cost you|what’s behind it/;
    assert.ok(!r.lines.some((l) => CRIME.test(l)) && !labels.some((l) => CRIME.test(l)), `an arrangement is talked of as a crime:\n${r.lines.join('\n')}\n${labels.join(' | ')}`);
  });
  ok('an apology for a broken word is not answered as an offer with a catch', () => {
    const w = worldFor(3), p = P(w), [t0] = familyMen(w, 'associate').length ? familyMen(w, 'associate') : familyMen(w);
    standWith(w, t0, { trust: 0.3, affection: 0.3, known: 0.5 });
    addFact(w, { kind: 'ruling', actor: p.id, victim: t0.id, minor: true, text: `${p.name} didn’t keep his word to ${t0.name}.`, district: t0.district }, { witnesses: [t0.id] });
    const t = new Talk(w, t0);
    t.say(/I let you down/);
    // (and then whatever the player can answer, each in turn, as far as it goes)
    for (let i = 0; i < 4; i++) { const c = t.v.choices.find((x) => x.group === 'reply' && !/drop|Forget/.test(x.id + x.label)); if (!c) break; t.say(c.id); }
    const NEG = /What’s the catch|Nobody offers something for nothing|There’s always a catch|I don’t need your help|I manage\. I always have|good for both of us|I’m offering|No catch/;
    const all = [...t.his(), ...t.turns.flatMap((x) => x.choices.map((c) => c.label + ' ' + (c.says ?? '')))];
    assert.deepEqual(all.filter((l) => NEG.test(l)), [], `an apology handled as an offer someone is selling:\n${t.transcript()}`);
    assert.deepEqual(t.falseRepeats().map((x) => x.his.join(' ')), [], t.transcript());
  });
});
void first;
