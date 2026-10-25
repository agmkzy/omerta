// V90 acceptance: the player's own temperament and reputation, privacy of what nobody saw, persistence across days and saves, and
// attempts to break the conversation. Each check is a rule, run on real state through the real conversation (since Gate 4, the one
// conversation: conv/visit.ts).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance, deserialize, serialize } from '../../engine';
import { DAY, type Character, type World } from '../../types';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { openAsk, playerMove, askBetween, stance } from '../../asks';
import { addFact, ownerBiz, rel } from '../../core';
import { characterWords, conductOf, noteHard, temper, viewOf } from '../../temper';
import { world60 } from './fixtures';
import { newWorld, P } from '../helpers';

const shop = (w: World, n = 0) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort((a, b) => (a.id < b.id ? -1 : 1))[n];
const meet = (w: World, t: Character): Visit => { const p = P(w); (p.intro ??= {})[t.id] ??= w.now; return begin(w, t.id); };
// what can be said: on the screen now, and everything under the headings
const codes = (w: World, v: Visit) => [...new Set([...v.choices, ...(v.ended || v.th.shut ? [] : everything(w, v))].map((o) => o.id.replace(/^a:/, '')))];
const said = (v: Visit, from: number) => v.lines.slice(from).map((l) => l.text);

describe('the player’s temperament and reputation', () => {
  ok('it is not chosen: a new man has none to speak of, and it grows from what he does, in context', { tags: ['scenario'] }, () => {
    // a man just arrived has shown nothing (sixty days in he may already have: ignoring a summons is something shown)
    assert.match(characterWords(P(newWorld(7))).join(' '), /haven’t shown/, 'nothing shown yet');
    const w = world60();
    const bully = deserialize(serialize(w)), avenger = deserialize(serialize(w)), dealer = deserialize(serialize(w)), giver = deserialize(serialize(w));
    const victim = (x: World) => Object.values(x.chars).find((c) => c.alive && c.rank === 'civilian')!;
    for (let i = 0; i < 8; i++) noteHard(bully, P(bully), victim(bully), 'force');
    // the same violence against a man who had wronged him first is retribution, not a temper
    const v2 = victim(avenger); addFact(avenger, { kind: 'beating', actor: v2.id, victim: P(avenger).id, text: 'x', district: v2.district }, { witnesses: [P(avenger).id] });
    for (let i = 0; i < 8; i++) noteHard(avenger, P(avenger), v2, 'force');
    for (let i = 0; i < 8; i++) conductOf(P(dealer)).deals++;
    for (let i = 0; i < 8; i++) conductOf(P(giver)).generous++;
    const tb = temper(P(bully)), ta = temper(P(avenger)), td = temper(P(dealer)), tg = temper(P(giver));
    assert.ok(tb.volatility > ta.volatility + 0.15, `unprovoked force reads as temper (${tb.volatility.toFixed(2)}) more than retribution (${ta.volatility.toFixed(2)})`);
    assert.ok(ta.pride > tb.pride, 'answering a wrong reads as pride');
    assert.ok(td.agreeable > tb.agreeable + 0.2 && tg.empathy > tb.empathy + 0.2, 'deals read as agreeable, gifts as empathy');
    assert.match(characterWords(P(bully)).join(' '), /force/);
    assert.match(characterWords(P(dealer)).join(' '), /deal/);
  });
  ok('it never limits what he can do: the same man, the same moment, the same choices whatever he has been', { tags: ['unit'] }, () => {
    const w = world60(), t = shop(w, 3);
    const a = deserialize(serialize(w)), b = deserialize(serialize(w));
    for (let i = 0; i < 20; i++) { conductOf(P(a)).force++; conductOf(P(b)).deals++; }
    for (const x of [a, b]) { const s = openAsk(x, 'protect', P(x), x.chars[t.id], { biz: ownerBiz(x, t.id)!.id, amt: 40 })!; playerMove(x, P(x), s.id, 'ask'); }
    const ca = meet(a, a.chars[t.id]), cb = meet(b, b.chars[t.id]);
    assert.deepEqual(codes(a, ca).map((c) => c.split(':')[0]).sort(), codes(b, cb).map((c) => c.split(':')[0]).sort());
  });
  ok('what nobody saw stays private until it travels; fear, respect and trust stay separate things', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), victim = shop(w, 4), bystander = shop(w, 5);
    const before = viewOf(w, bystander, p).danger;
    const f = addFact(w, { kind: 'beating', actor: p.id, victim: victim.id, text: `${p.name} beat up ${victim.name}.`, district: victim.district }, { witnesses: [victim.id] });
    assert.equal(viewOf(w, bystander, p).danger, before, 'a man who did not see it and was not told knows nothing of it');
    bystander.known[f.id] = { t: w.now, from: victim.id, knowsActor: true } as never;
    assert.ok(viewOf(w, bystander, p).danger > before, 'once he has heard, he knows what you can do');
    const r = rel(bystander, p.id); r.fear = 0.8; r.respect = 0.05; r.trust = 0.6;
    const v = viewOf(w, bystander, p);
    assert.ok(v.fear > 0.5 && v.respect < 0.1 && v.trust > 0.5, 'afraid of you, thinks little of you, and still trusts you: three different things');
  });
});

describe('persistence', () => {
  ok('a negotiation survives leaving, days passing and a save: he restates his point, and the answers to it are still there', { tags: ['scenario'] }, () => {
    let tested = 0;
    for (let n = 0; n < 12 && tested < 2; n++) {
      let w = world60(); const t0 = shop(w, n);
      const s0 = openAsk(w, 'protect', P(w), t0, { biz: ownerBiz(w, t0.id)!.id, amt: Math.max(60, Math.round(ownerBiz(w, t0.id)!.income * 0.25 / 5) * 5) });
      if (!s0) continue;
      playerMove(w, P(w), s0.id, 'ask');
      const claim = s0.m?.claim;
      if (s0.m?.beat !== 'claim') continue; // (he said yes outright: nothing to carry over)
      w = deserialize(serialize(w)); advance(w, w.now + 3 * DAY);
      const t = w.chars[t0.id], s = askBetween(w, 'protect', P(w).id, t.id);
      if (!s || s.stage === 'resolved' || s.m?.beat !== 'claim') continue; // (he moved on it himself in the meantime)
      assert.equal(s.m?.claim, claim, 'the point he made is kept with the matter');
      const v = meet(w, t), row = everything(w, v).find((o) => o.id === 'a:m:' + s.id)!, n0 = v.lines.length;
      assert.match(row.label, /protection/i, 'the matter is named for what it is');
      choose(w, v, row.id);
      assert.ok(said(v, n0).some((l) => /Like I said|I told you|still thinking|You know how|You heard/.test(l)), 'he restates where he left it: ' + said(v, n0).join(' / '));
      assert.ok(v.choices.some((x) => x.id.startsWith('a:x:')), 'and what you can answer to it is offered');
      tested++;
    }
    assert.ok(tested >= 1, 'at least one negotiation was carried over and checked');
  });
  ok('ending it badly is remembered for the day, not for ever', { tags: ['scenario'] }, () => {
    let tested = 0;
    for (let n = 0; n < 12 && !tested; n++) {
      const w = world60(), t = shop(w, n);
      Object.assign(t.traits, { courage: 1, caution: 0, violence: 1, ambition: 1, greed: 1 });
      const s = openAsk(w, 'protect', P(w), t, { biz: ownerBiz(w, t.id)!.id, amt: 200 });
      if (!s) continue;
      const v = meet(w, t);
      choose(w, v, 'a:m:' + s.id);
      for (let i = 0; i < 10 && !v.ended; i++) {
        const o = v.choices.find((x) => /^a:(mv:[^:]+:(ask|pressure|force)|x:[^:]+:(nochoice|assume|now|notthere))$/.test(x.id));
        if (!o) break;
        choose(w, v, o.id);
      }
      if (!v.ended || (P(w).cooldown[`shut:${t.id}`] ?? 0) <= w.now) continue; // (he gave in, or went quiet rather than throwing you out)
      assert.deepEqual(meet(w, t).choices.map((o) => o.id), ['leave'], 'the same day, he will not talk');
      advance(w, w.now + 2 * DAY);
      assert.ok(meet(w, t).choices.length > 1, 'days later, he will');
      tested++;
    }
    assert.ok(tested, 'a man was pushed until he threw you out');
  });
});

describe('trying to break it', () => {
  ok('the same subject, again and again: used answers grey out, nothing pays twice, the way out is always there', { tags: ['scenario'] }, () => {
    const w = world60(), t = shop(w, 8), v = meet(w, t);
    const cash0 = P(w).cash;
    let gain = -1;
    for (let i = 0; i < 12 && !v.ended; i++) {
      assert.ok(v.choices.some((o) => o.id === 'leave'), 'always a way out');
      const tr = t.rels[P(w).id]?.trust ?? 0;
      if (!everything(w, v).some((o) => o.id === 'a:how')) break;
      choose(w, v, 'a:how');
      if (i >= 1) gain = Math.max(gain, (t.rels[P(w).id]?.trust ?? 0) - tr);
    }
    assert.equal(P(w).cash, cash0);
    assert.ok(gain <= 0.0001, 'asked again in the same visit, it pays nothing: ' + gain);
  });
  ok('switching subjects in the middle of a negotiation and coming back keeps the point in hand', { tags: ['scenario'] }, () => {
    const w = world60(), t = shop(w, 9);
    const s = openAsk(w, 'protect', P(w), t, { biz: ownerBiz(w, t.id)!.id, amt: 120 })!;
    const v = meet(w, t);
    choose(w, v, 'a:m:' + s.id);
    choose(w, v, `a:mv:${s.id}:ask`);
    const beat = s.m?.beat;
    choose(w, v, 'back');
    if (!v.ended) choose(w, v, 'news');
    assert.equal(s.m?.beat, beat, 'talking about something else does not touch the matter');
    if (v.ended || s.stage === 'resolved') return;
    choose(w, v, 'home');
    if (!everything(w, v).some((o) => o.id === 'a:m:' + s.id)) return;
    choose(w, v, 'a:m:' + s.id);
    if (beat === 'claim') assert.ok(v.choices.some((x) => x.id.startsWith('a:x:')), 'back on it, the answers to his point are there');
    void stance;
  });
  ok('a man shut out offers nothing but the door, whatever was open', { tags: ['unit'] }, () => {
    const w = world60(), t = shop(w, 10);
    P(w).cooldown[`shut:${t.id}`] = w.now + DAY;
    const v = meet(w, t);
    assert.ok(v.th.shut);
    assert.deepEqual(v.choices.map((o) => o.id), ['leave']);
  });
  ok('he cannot be asked about what the player does not know', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w);
    for (const t of Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).slice(0, 40)) {
      (p.intro ??= {})[t.id] = w.now;
      const w2 = deserialize(serialize(w)), v = begin(w2, t.id);
      for (const o of codes(w2, v)) if (o.startsWith('inc:')) assert.ok(p.known[o.slice(4)], `${t.name}: ${o}`);
    }
  });
});
