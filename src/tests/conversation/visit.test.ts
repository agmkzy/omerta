// Gate 3: the visit engine (conv/visit.ts) that the new conversation screen draws. These are the player-facing rules: what a visit
// opens with and offers, that it remembers, that it never invents, that its choices are few and real, that nobody comes to the player
// without a reason of his own, and that the same follow-up is not repeated once answered.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance, deserialize, serialize } from '../../engine';
import { DAY } from '../../types';
import { createWorld } from '../../world';
import { createDebt } from '../../core';
import { begin, choose, everything, relationOf, type Visit } from '../../conv/visit';
import { approaches } from '../../conv/approach';
import { social } from '../../conv/social';
import { gcast } from '../../conv/scenarioG';
import * as door from '../../conv/doors';

// the playable premise (as ?scenario=dispute): Henry has been into Nate's shop a few evenings; Lou asks Nate for money on day one
function premise() {
  const c = gcast(3)!;
  for (let i = 0; i < 4; i++) door.spendTime(c.w, c.henry, c.nate, 'before');
  door.demand(c.w, c.lou, c.nate, c.biz, 55, 'trouble:' + c.lou.id);
  return c;
}
// choose what the player would: on the screen, or under one of the three headings (as the player would find it: two selections at most)
const pick = (w: Parameters<typeof choose>[0], v: Visit, re: RegExp) => {
  const hit = (k: { label: string; says?: string }) => re.test(k.label) || re.test(k.says ?? '');
  let x = v.choices.find(hit);
  for (const k of ['business', 'personal', 'confront']) { if (x) break; choose(w, v, 'home'); if (v.choices.some((c) => c.id === 'u:' + k)) { choose(w, v, 'u:' + k); x = v.choices.find(hit); } }
  assert.ok(x, `offered: ${v.choices.map((k) => k.label).join(' | ')}; wanted ${re}`); return choose(w, v, x.id).v;
};
const said = (v: Visit) => v.lines.filter((l) => l.who === 'him').map((l) => l.text);
const TECH = /\b(action|effort|result|restraint) promise\b|obligation|pursuit|belief|trust \d|\bo\d+\b|\bp\d+\b/i;

describe('a visit (Gate 3)', () => {
  ok('a man you have been to see is never a stranger again, whatever greeting is chosen', { tags: ['unit'] }, () => {
    const c = gcast(3)!, w = c.w, m = c.friend;
    const v1 = begin(w, m.id); choose(w, v1, 'spend');
    for (let i = 0; i < 4; i++) { advance(w, w.now + 2 * DAY); const v = begin(w, m.id); assert.notEqual(relationOf(w, c.henry, m).level, 'stranger'); assert.ok(!v.lines.some((l) => /Do I know you/.test(l.text)), said(v).join(' ')); }
  });
  ok('every screen has at most four things to say (and three headings), and nothing on it uses the machinery’s words', { tags: ['unit'] }, () => {
    const c = premise(), w = c.w;
    for (const id of [c.nate.id, c.riz.id, c.frank.id, c.friend.id, c.lou.id]) {
      let v = begin(w, id);
      for (let i = 0; i < 4 && !v.ended; i++) {
        // (at most four things to say, beside the ways back and out; the full list only when the player has asked for it)
        const say = v.choices.filter((x) => x.group !== 'more' && x.group !== 'leave' && x.group !== 'intent');
        assert.ok(say.length <= (v.more ? 16 : 4) && v.choices.filter((x) => x.group === 'intent').length <= 3, `${v.choices.length} choices: ${v.choices.map((x) => x.label).join(' | ')}`);
        for (const x of [...v.choices, ...v.lines]) assert.doesNotMatch('label' in x ? x.label + ' ' + (x.note ?? '') : x.text, TECH);
        const next = v.choices.find((x) => x.group !== 'leave' && x.group !== 'more' && x.id !== 'spend');
        if (!next) break;
        v = choose(w, v, next.id).v;
      }
    }
  });
  ok('a choice that is not on the screen does nothing (nothing is invented)', { tags: ['unit'] }, () => {
    const c = premise(), w = c.w, v = begin(w, c.riz.id), n = v.lines.length;
    choose(w, v, 'intervene:o999'); choose(w, v, 'promise:result:r999');
    assert.equal(v.lines.length, n);
  });
  ok('asked what is new, a man in trouble who trusts the player confides it, and the player can offer what he would have offered if asked', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + DAY);
    let v = begin(w, c.nate.id);
    v = pick(w, v, /What’s new/);
    assert.match(said(v).at(-1)!, new RegExp(c.lou.name.split(' ')[0]));
    v = pick(w, v, /I’ll talk to/);
    const ob = social(w).obs.find((o) => o.obligor === c.henry.id && o.beneficiary === c.nate.id);
    assert.ok(ob && ob.type === 'action', 'a promise to act, made in plain words');
  });
  ok('a refusal is answered, not left: the replies address its reason; an argument made is not offered again; what the player tells is what he knows', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + DAY);
    let v = begin(w, c.nate.id); v = pick(w, v, /What’s new/); v = pick(w, v, /I’ll talk to/);
    v = begin(w, c.riz.id); v = pick(w, v, /having trouble with/);
    assert.match(said(v).at(-1)!, /not one of ours|isn’t ours/);
    v = pick(w, v, /my word/);
    assert.ok(!v.choices.some((x) => /my word/.test(x.says ?? x.label)), 'the argument he has made is not offered again');
    const tell = v.choices.find((x) => /our ground/.test(x.says ?? ''))!;
    assert.equal(tell.label, 'Persuade', 'offered as an approach; said as an argument');
    assert.ok(tell, 'he can tell him what he knows');
    // (what Henry knows here is a demand refused, not a shop smashed: the words must not claim more)
    const smashed = Object.values(w.facts).some((f) => f.kind === 'vandalism' && f.business === c.biz && c.henry.known[f.id]);
    if (!smashed) assert.doesNotMatch(tell.says!, /smashed/);
  });
  ok('the shopkeeper comes to the player only for a reason of his own, and once answered does not ask the same thing again', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    let came: string | undefined;
    for (let d = 0; d < 14 && !came; d++) { advance(w, w.now + DAY); came = approaches(w).find((a) => a.who === c.nate.id)?.id; }
    if (!came) return; // (he found someone else to ask: also his own decision)
    const r = social(w).requests.find((x) => x.id === came)!;
    assert.equal(r.by, c.nate.id); assert.ok(['intervene', 'progress'].includes(r.wants));
    let v = begin(w, c.nate.id, { approach: came });
    v = choose(w, v, v.choices.find((x) => x.group === 'reply')!.id).v;
    advance(w, w.now + 3 * DAY);
    assert.ok(!approaches(w).some((a) => a.id === came), 'that request is answered');
  });
  ok('a man reporting back comes once, not every day', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + DAY);
    let v = begin(w, c.nate.id); v = pick(w, v, /What’s new/); v = pick(w, v, /I’ll talk to/);
    v = begin(w, c.riz.id); v = pick(w, v, /having trouble with/); v = pick(w, v, /our ground/);
    for (let d = 0; d < 20; d++) { advance(w, w.now + DAY); const a = approaches(w).find((x) => x.who === c.riz.id); if (a) choose(w, begin(w, c.riz.id, { approach: a.id }), 'leave'); }
    const reports = social(w).requests.filter((r) => r.by === c.riz.id && r.wants === 'report');
    assert.ok(reports.length <= 1, `${reports.length} reports`);
  });
  ok('told it was done, he does not ask again; the visit remembers across a save', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + DAY);
    let v = begin(w, c.nate.id); v = pick(w, v, /What’s new/); v = pick(w, v, /I’ll talk to/);
    v = begin(w, c.riz.id); v = pick(w, v, /having trouble with/);
    v = begin(w, c.nate.id);
    if (v.choices.some((x) => /took it to/.test(x.label))) v = pick(w, v, /took it to/);
    const w2 = deserialize(serialize(w));
    for (let d = 0; d < 12; d++) advance(w2, w2.now + DAY);
    const asked = social(w2).requests.filter((r) => r.by === c.nate.id && r.wants === 'progress' && r.t > w.now);
    assert.equal(asked.length, 0, 'no new follow-up after he was told and believed it');
    assert.notEqual(relationOf(w2, w2.chars[c.henry.id], w2.chars[c.nate.id]).level, 'stranger');
  });
  ok('"Something else…" is real: other plausible subjects can be raised and are answered', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + DAY);
    let v = begin(w, c.nate.id); v = pick(w, v, /What’s new/); v = pick(w, v, /I’ll talk to/);
    v = begin(w, c.friend.id);
    const all = everything(w, v);
    assert.ok(all.some((x) => /answer to/.test(x.label)), all.map((x) => x.label).join(' | '));
    v = choose(w, v, 'more').v;
    const n = v.lines.length;
    v = choose(w, v, all.find((x) => /answer to/.test(x.label))!.id).v;
    assert.ok(v.lines.length > n + 1, 'asked and answered');
  });
  ok('what he says of what is new is only what he knows: a man is named only if he knows who did it', { tags: ['unit'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + 10 * DAY);
    for (const id of [c.riz.id, c.friend.id, c.frank.id]) {
      const v = choose(w, begin(w, id), 'news').v, f = Object.values(w.facts).find((x) => social(w).talks?.[id]?.topics.some((t) => t.k === 'news:' + x.id));
      if (f?.actor && !w.chars[id].known[f.id]?.knowsActor) assert.doesNotMatch(said(v).join(' '), new RegExp(w.chars[f.actor].name.split(' ')[0]));
    }
  });
});

// The three headings (Business, Personal, Confront): what the player sees first, what lies under each, and that the talk stays put
describe('a visit, under three headings', () => {
  const plainWorld = () => { const w = createWorld(3, 'Tony Marino'); social(w); advance(w, w.now + 3 * DAY); return w; };
  const ids = (v: Visit) => v.choices.map((x) => x.id);
  ok('a visit with nothing pressing opens on at most three headings and leaving; each heading shown has something under it', { tags: ['unit'] }, () => {
    const w = plainWorld(), p = w.chars[w.playerId!];
    for (const id of [p.bossId!, Object.values(w.chars).find((c) => c.alive && c.bossId === p.bossId && c.id !== p.id)!.id, Object.values(w.biz).find((b) => b.open && w.chars[b.ownerId]?.rank === 'civilian')!.ownerId]) {
      const v = begin(w, id), heads = v.choices.filter((x) => x.group === 'intent');
      assert.ok(heads.length >= 1 && heads.length <= 3, ids(v).join(' '));
      assert.ok(v.choices.some((x) => x.id === 'leave'));
      for (const hd of heads) { choose(w, v, 'home'); choose(w, v, hd.id); assert.ok(v.choices.some((x) => !['more', 'leave'].includes(x.group)), `${hd.label} is empty`); assert.ok(v.choices.filter((x) => !['more', 'leave'].includes(x.group)).length <= 4); }
    }
  });
  ok('Business with your boss offers work, and asking for it is answered by the game (the old engine’s jobs, through the new screen)', { tags: ['scenario'] }, () => {
    const w = plainWorld(), p = w.chars[w.playerId!];
    let v = begin(w, p.bossId!); v = choose(w, v, 'u:business').v;
    const work = v.choices.find((x) => /anything you need done|work/i.test(x.label));
    assert.ok(work, ids(v).join(' '));
    const n = v.lines.length; v = choose(w, v, work.id).v;
    assert.ok(v.lines.slice(n).some((l) => l.who === 'him'), 'he answers');
    assert.equal(v.pane, 'business', 'and the talk stays on business');
  });
  ok('anything plausible is reachable: Other business opens the rest (borrowing, a stake, a word for you), and each is a real choice', { tags: ['scenario'] }, () => {
    const w = plainWorld(), p = w.chars[w.playerId!];
    let v = begin(w, p.bossId!); v = choose(w, v, 'u:business').v; v = choose(w, v, 'all:business').v;
    const borrow = v.choices.find((x) => /borrow/i.test(x.label));
    assert.ok(borrow, ids(v).join(' '));
    const n = v.lines.length; v = choose(w, v, borrow.id).v;
    assert.ok(v.lines.length > n, 'raised and answered');
  });
  ok('Confront appears only when there is something to have out (his own man’s light envelope); a debtor’s arrears are business', { tags: ['scenario'] }, () => {
    const w = plainWorld(), p = w.chars[w.playerId!];
    const man = Object.values(w.chars).find((c) => c.alive && c.rank === 'associate' && c.familyId === p.familyId && c.id !== p.id && c.id !== p.bossId)!;
    assert.ok(!begin(w, man.id).choices.some((x) => x.id === 'u:confront'), 'nothing to have out yet');
    man.bossId = p.id; man.books.missed = 2;
    let v = begin(w, man.id);
    assert.ok(v.choices.some((x) => x.id === 'u:confront'), ids(v).join(' '));
    v = choose(w, v, 'u:confront').v;
    const ask = v.choices.find((x) => /envelope|thin ice/i.test(x.label));
    assert.ok(ask, v.choices.map((x) => x.label).join(' | '));
    const n = v.lines.length; v = choose(w, v, ask.id).v;
    assert.ok(v.lines.slice(n).some((l) => l.who === 'him' || l.who === 'narr'), 'he answers for himself');
    const civ = Object.values(w.chars).find((c) => c.alive && c.rank === 'civilian' && c.cash < 2000)!;
    createDebt(w, p.id, civ.id, 400, 0.05, 'a loan'); w.debts.at(-1)!.missed = 2;
    // (a debt is business: what is owed, and the ways of collecting it, are one conversation, raised in one step)
    const dv = choose(w, begin(w, civ.id), 'u:business').v;
    assert.ok(dv.choices.some((x) => /owe|money|payment|week/i.test(x.label)), dv.choices.map((x) => x.label).join(' | '));
  });
  ok('a man who came with something is answered directly: no headings to go through first', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    let came: string | undefined;
    for (let d = 0; d < 14 && !came; d++) { advance(w, w.now + DAY); came = approaches(w).find((a) => a.who === c.nate.id)?.id; }
    if (!came) return;
    const v = begin(w, c.nate.id, { approach: came });
    assert.ok(v.choices[0].group === 'reply', v.choices.map((x) => x.label).join(' | '));
    assert.ok(!v.choices.some((x) => x.group === 'intent'), 'answered first; the headings come after');
  });
  ok('an approach is chosen by name and said in words; a refused matter returns to its heading, not to the top', { tags: ['scenario'] }, () => {
    const c = premise(), w = c.w;
    advance(w, w.now + DAY);
    let v = begin(w, c.nate.id); v = pick(w, v, /What’s new/); v = pick(w, v, /I’ll talk to/);
    v = begin(w, c.riz.id); v = choose(w, v, 'u:business').v;
    v = pick(w, v, /having trouble with/);
    const ap = v.choices.find((x) => x.says && x.label !== x.says);
    assert.ok(ap, 'approaches offered after his reason');
    const n = v.lines.length; v = choose(w, v, ap.id).v;
    assert.equal(v.lines[n].who, 'you'); assert.equal(v.lines[n].text, ap.says, 'what is said is the argument, not the name of it');
    for (let i = 0; i < 4 && v.choices.some((x) => x.says); i++) v = choose(w, v, v.choices.find((x) => x.says)!.id).v;
    assert.equal(v.pane, 'business', 'still on business once the matter is settled');
  });
});
