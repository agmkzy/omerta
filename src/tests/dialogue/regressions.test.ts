// V90 acceptance audit: one check per defect found while playing and exploring, each written as the rule that was broken, so the
// defect cannot come back in another form. (Since Gate 4, on the one conversation: conv/visit.ts.)
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { speechFor } from '../../conv/acts/words';
import { introduced } from '../../acquaint';
import { openAsk, move, askBetween, playerMove } from '../../asks';
import { addFact, ownerBiz, rel } from '../../core';
import { jobSaid, mkJob } from '../../jobs';
import { replies } from '../../exchange';
import { kinOf } from '../../kin';
import { makeLoan } from '../../encounters';
import { openSunday } from '../../crewlife';
import { FEMALE } from '../../names';
import { world60, talk } from './fixtures';
import { deserialize, serialize } from '../../engine';
import { DAY } from '../../types';
import { P } from '../helpers';
import type { Character, World } from '../../types';

const shops = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort((a, b) => (a.id < b.id ? -1 : 1));
const meet = (w: World, t: Character): Visit => { const p = P(w); (p.intro ??= {})[t.id] ??= w.now; return begin(w, t.id); };
const all = (w: World, v: Visit) => [...v.choices, ...everything(w, v)];
const after = (v: Visit, n: number) => v.lines.slice(n).map((l) => l.text);

describe('V90 audit regressions', { timeout: 60_000 }, () => {
  ok('his own name is "I" where it starts a clause and "me" where it is the object ("beat me up", "after I refused")', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), t = shops(w)[0];
    const n = t.name;
    assert.equal(speechFor(w, p, t, `“${p.name} beat ${n} up.”`).includes('beat me up'), true);
    assert.match(speechFor(w, p, t, `“They smashed the place after ${n} refused to pay.”`), /after I refused/);
    assert.match(speechFor(w, p, t, `“${n} owes money.”`), /“I owe money/);
  });
  ok('the record of who owns what is not trouble: it is not offered as a grievance, and a man is not asked what he will do about it', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w), t = shops(w)[1];
    const f = addFact(w, { kind: 'ownership', actor: t.id, victim: p.id, business: ownerBiz(w, t.id)!.id, text: `${p.name} owns a tenth of ${ownerBiz(w, t.id)!.name}.`, district: t.district }, { witnesses: [p.id, t.id] });
    const os = all(w, meet(w, t));
    assert.ok(!os.some((o) => o.id === 'a:inc:' + f.id || /What he did to you/.test(o.label)), os.map((o) => o.label).join(' | '));
  });
  ok('an apology refused is not refused like a business deal, and a man apologised to does not send for his protector', { tags: ['unit'] }, () => {
    for (const n of [2, 3, 4, 5]) {
      const w = world60(), p = P(w), t = shops(w)[n];
      rel(t, p.id).grudge = 0.7; Object.assign(t.traits, { courage: 1, ambition: 1, caution: 0, violence: 0.9 });
      const s = openAsk(w, 'amends', p, t, { amt: 50 }); if (!s) continue;
      const o = move(w, s, 'ask');
      const said = o.lines.join(' ');
      assert.ok(!/doing (this|business) with you|has people, and he means to use them|I already pay someone/.test(said), said);
      assert.notEqual(o.answer, 'help');
    }
  });
  ok('a man above you turning down your request does not throw you out of his conversation', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w), boss = w.chars[p.bossId!];
    const s = openAsk(w, 'rate', p, boss, { amt: Math.max(1, Math.round(p.kickRate * 100) - 5) });
    if (!s) return;
    const o = move(w, s, 'ask');
    assert.ok(!/Get out|Who do you think/.test(o.lines.join(' ')), o.lines.join(' '));
  });
  ok('recruiting: an eager line is only said by a man who is interested', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w); p.rank = 'soldier'; p.cash = 2000;
    for (const t of Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !ownerBiz(w, c.id)).slice(0, 12)) {
      t.prospect = true; (p.intro ??= {})[t.id] = w.now;
      const r = talk(w, t.id, 'recruit_offer');
      const s = askBetween(w, 'recruit', p.id, t.id);
      if (s && (s.st?.[t.id]?.last === 'no')) assert.ok(!/waiting for somebody to ask/.test(r.lines.join(' ')), r.lines.join(' / '));
    }
  });
  ok('having put terms to a man is having met him; a man in your own crew is known to you', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w), t = shops(w)[6];
    delete p.intro?.[t.id];
    openAsk(w, 'protect', p, t, { biz: ownerBiz(w, t.id)!.id, amt: 40 });
    assert.ok(introduced(w, p, t));
    const mate = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.bossId === p.bossId)!;
    if (mate) { delete p.intro?.[mate.id]; assert.ok(introduced(w, p, mate)); }
  });
  ok('once he has named his figure you are not offered "what can you manage?"; once caught out he is not called on it again', { tags: ['unit'] }, () => {
    let checked = 0;
    for (const t0 of shops(world60()).slice(0, 16)) for (const frac of [0.06, 0.1]) {
      const w = world60(), p = P(w), t = w.chars[t0.id];
      delete ownerBiz(w, t.id)!.protection; // (nobody else's claim on him: the point is the money)
      const s = openAsk(w, 'protect', p, t, { biz: ownerBiz(w, t.id)!.id, amt: Math.round(ownerBiz(w, t.id)!.income * frac / 5) * 5 + 10 }); if (!s) continue;
      playerMove(w, p, s.id, 'ask');
      if (s.st?.[t.id]?.last === 'counter') { checked++; assert.ok(!replies(w, p, s).some((r) => r.k === 'manage')); }
      s.m = { ...(s.m ?? {}), caught: 1, beat: 'claim', claim: 'money' };
      assert.ok(!replies(w, p, s).some((r) => r.k === 'doubt'));
    }
    assert.ok(checked >= 1);
  });
  ok('asked for work, he says what the work is', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w);
    const j = mkJob(w, { kind: 'collect', title: 'Collect from Sammy Costa', brief: '', giver: p.bossId!, via: 'boss', assignee: p.id, target: shops(w)[0].id, pay: 100, status: 'offered', days: 7 } as never);
    assert.match(jobSaid(j), /“I need somebody to collect from Sammy Costa\./);
  });
  ok('a woman of the same family line is a sister, not a brother', { tags: ['unit'] }, () => {
    const w = world60();
    for (const c of Object.values(w.chars).filter((x) => x.alive)) for (const k of kinOf(w, c)) {
      const kc = w.chars[k.id];
      if (kc && k.role === 'brother') assert.ok(!FEMALE.includes(kc.name.split(' ')[0]), `${kc.name} is called a brother`);
    }
  });
  ok('you raise a matter in your own voice; his answer is his', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w), t = shops(w)[7];
    const s = openAsk(w, 'protect', p, t, { biz: ownerBiz(w, t.id)!.id, amt: 40 })!;
    const v = meet(w, t), n0 = v.lines.length;
    choose(w, v, 'a:m:' + s.id);
    const mine = v.lines.slice(n0).find((l) => l.who === 'you');
    assert.ok(mine && !/^“/.test(mine.text), 'your line is given as yours: ' + mine?.text);
    assert.ok(v.lines.slice(n0).filter((l) => l.who === 'him').every((l) => l.text !== mine!.text));
  });
  ok('work he has offered you, he raises when you see him, and you answer it to his face', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w), t = shops(w)[8];
    const j = mkJob(w, { kind: 'collect', title: 'Collect from somebody', brief: 'He is owed and wants it back.', giver: t.id, via: 'tip', assignee: p.id, target: shops(w)[9].id, pay: 120, status: 'offered', days: 5 } as never);
    const v = meet(w, t);
    assert.ok(v.lines.some((l) => /I need somebody to collect/.test(l.text)), 'he raises it himself: ' + v.lines.map((l) => l.text).join(' / '));
    assert.ok(v.choices.some((o) => o.id === 'a:jobtake:' + j.id), 'and its answers are what the player can say');
    const n0 = v.lines.length; choose(w, v, 'a:jobtake:' + j.id);
    assert.equal(j.status, 'active'); assert.ok(after(v, n0).some((l) => /“/.test(l)));
  });
  ok('a man asking for money says why in a whole sentence, admits the truth in his own words, and his request stays the subject', { tags: ['scenario'] }, () => {
    const kinds = ['gambling', 'debt', 'family', 'drink', 'house', 'resentment', 'woman'] as const;
    for (let i = 0; i < 28; i++) {
      const w = world60(), p = P(w), t = shops(w)[i % 10];
      t.problem = { kind: kinds[i % 7], sev: 0.6 } as never; rel(t, p.id).trust = 1; p.cash = 5000; w.now += i * 61; // (each kind, each phrasing)
      makeLoan(w, p, t); const e = w.enc.at(-1)!;
      const asked = e.lines.at(-1)!;
      assert.ok(!/It’s (I|my|the|a man|we|there|rent|an) /i.test(asked) && !/It’s It’s/.test(asked), asked);
      const v = meet(w, t);
      assert.ok(v.choices.some((o) => o.id.startsWith(`a:enc:${e.id}:`)), 'he raises it himself, and its answers are on screen: ' + v.choices.map((o) => o.id).join());
      if (!v.choices.some((o) => o.id === `a:enc:${e.id}:ask`)) continue;
      const n0 = v.lines.length; choose(w, v, `a:enc:${e.id}:ask`);
      assert.ok(!/It’s (resentful|in debt|saving|drinking|a woman who)|”.*resentful/.test(after(v, n0).join(' ')), after(v, n0).join(' / '));
      assert.ok(v.choices.some((o) => o.id === `a:enc:${e.id}:lend`), 'having asked what it is for, you still have his request in front of you');
    }
  });
  ok('nothing is offered that he would only turn away for being asked too soon: "I’ll look after you myself" waits out the cooling-off', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), t = shops(w)[3], b = ownerBiz(w, t.id)!;
    const a = Object.values(w.chars).find((x) => x.alive && x.familyId && x.familyId !== p.familyId && x.rank === 'soldier')!;
    delete b.protection; openAsk(w, 'protect', a, t, { biz: b.id, amt: 60 }); rel(t, p.id).trust = 0.7;
    const pressedOpts = (cool: boolean) => {
      const x = deserialize(serialize(w)), px = P(x), tx = x.chars[t.id];
      if (cool) (x.sitcool ??= {})[`ask:protect:${px.id}:${tx.id}:${b.id}`] = x.now + 5 * DAY;
      const v = meet(x, tx), door = all(x, v).find((o) => /Anyone been bothering you/.test(o.label));
      assert.ok(door, 'he has a man leaning on him to talk about');
      choose(x, v, door!.id); void px;
      return v.choices.map((o) => o.id);
    };
    assert.ok(pressedOpts(false).some((c) => c.endsWith(':mine')), 'offered when he could be asked');
    assert.ok(!pressedOpts(true).some((c) => c.endsWith(':mine')), 'not offered while he would refuse to hear it');
  });
  ok('Sunday comes in order: a man with a crew takes his men’s envelopes before his boss will take his', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), boss = w.chars[p.bossId!];
    const sunday = (x: World) => { const px = P(x); x.sunday = { t: x.now, tells: [] }; px.cooldown.handed = 0; px.books.arrears = 120; px.cash = 3000; };
    // (if he opens with something of his own, the player turns to other business first, as he would at the table)
    const offered = (x: World) => all(x, meet(x, x.chars[boss.id])).some((o) => o.id === 'a:b_envelope');
    const alone = deserialize(serialize(w)); sunday(alone);
    assert.ok(offered(alone), 'a man with no crew hands his envelope straight up');
    const withCrew = deserialize(serialize(w)); sunday(withCrew);
    const man = Object.values(withCrew.chars).find((c) => c.alive && !c.isPlayer && c.rank === 'associate' && c.familyId === P(withCrew).familyId && c.id !== boss.id)!;
    man.bossId = P(withCrew).id;
    assert.ok(!offered(withCrew), 'with his men’s envelopes still to come in, his boss does not take his');
    const later = deserialize(serialize(withCrew)); // (and it holds across a save)
    openSunday(later, P(later));
    assert.ok(offered(deserialize(serialize(later))), 'once he has sat down with his men, his own goes up');
  });
});
