// The conversation overhaul (docs/conversations/): what was wrong, held right. Every seat, every kind of man, every opening choice,
// played on a copy of the world (src/tests/tools/convaudit.ts), and the rules the audit found broken checked on what comes back:
// nobody names himself, nobody names the player to his face, nothing goes unanswered, nothing leaks from the code into the words; the
// opening list is short; what is asked of a man fits what he is to the player; and the family's matters can be carried in person.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { auditRun } from '../tools/convaudit';
import { createWorld } from '../../world';
import { advance } from '../../engine';
import { begin, choose, everything } from '../../conv/visit';
import { tieOf } from '../../conv/relation';
import { DAY, type World } from '../../types';

const run = auditRun(3);
const P = (w: World) => w.chars[w.playerId!];

describe('the conversation, audited at every seat', { tags: ['property'] }, () => {
  ok('nothing the audit looks for is found: self-naming, the player named to his face, no answer, code in the words, errors', () => {
    assert.deepEqual(run.flags.slice(0, 8), []);
  });
  ok('the opening list is short: a dozen things or fewer to a man, on average, at every seat', () => {
    const n = run.probes.reduce((a, p) => a + p.choices.length, 0) / run.probes.length;
    assert.ok(n <= 13, `${n.toFixed(1)} choices per conversation`);
    for (const p of run.probes) assert.ok(p.choices.length <= 18, `${p.start} → ${p.npc}: ${p.choices.length} choices`);
  });
  ok('every answer is followed by something to say, or by the way back', () => {
    for (const p of run.probes) for (const r of p.runs) assert.ok(!r.empty, `${p.start} → ${p.npc}: “${r.label}” got no answer`);
  });
});

describe('what may be said to whom', { tags: ['unit'] }, () => {
  for (const start of ['soldier', 'capo', 'underboss', 'consigliere', 'boss'] as const) ok(`${start}: requests go up, orders go down, and nobody is asked about himself`, () => {
    const w = createWorld(5, 'Tony Marino', { start }); advance(w, w.now + 5 * DAY); w.now = Math.floor(w.now / DAY) * DAY + 14 * 60;
    const p = P(w), f = w.fam[p.familyId!];
    for (const t of Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.jailedUntil <= w.now).slice(0, 25)) {
      const v = begin(w, t.id), ids = everything(w, v).map((c) => c.id.split(':').slice(0, 2).join(':')), tie = tieOf(w, p, t);
      if (ids.includes('a:recommend')) assert.ok((tie === 'superior' || tie === 'above') && f.bossId !== t.id, `asked ${t.name} (${tie}) to put in a word`);
      if (ids.includes('a:leaders')) assert.ok(f.bossId !== t.id, 'asked the boss who runs the family');
      if (ids.includes('a:run_ask')) assert.ok(t.bossId !== p.id, `offered to run his own man’s racket (${t.name})`);
      if (ids.includes('a:assign_low') || ids.includes('a:assign_hustle')) assert.ok(t.rank === 'associate' || t.rank === 'soldier', `street orders to a ${t.rank}`);
      if (ids.includes('a:promo')) assert.ok(tie === 'superior' || tie === 'above', `asked where he stands of a man who is ${tie}`);
    }
  });
});

describe('the family’s matters, carried in person', { tags: ['scenario'] }, () => {
  ok('the consigliere gives the boss his finding to his face, and the boss decides on it', () => {
    const w = createWorld(7, 'Tony Marino', { start: 'consigliere' }), p = P(w), boss = w.chars[w.fam[p.familyId!].bossId];
    let s; for (let d = 0; d < 90 && !s; d++) { advance(w, w.now + DAY); s = (w.situations ?? []).find((q) => q.kind === 'hearing' && q.stage !== 'resolved'); }
    assert.ok(s, 'the boss asked for an inquiry');
    for (const e of w.enc.filter((e) => e.status === 'open')) e.status = 'done';
    w.now = Math.floor(w.now / DAY) * DAY + 14 * 60;
    const v = begin(w, boss.id);
    const ask = everything(w, v).find((c) => c.id === 'a:fam_counsel');
    assert.ok(ask, 'the consigliere can ask the boss what he wants his view on');
    const r = choose(w, v, ask!.id);
    const adv = r.v.choices.find((c) => c.id.includes(':adv:'));
    assert.ok(adv, `the boss asks for the finding, and the advice can be given: ${r.v.choices.map((c) => c.label).join(' / ')}`);
    choose(w, r.v, adv!.id);
    assert.equal(s!.stage, 'resolved', 'the boss decided on what he was told');
  });
  ok('the underboss puts the boss’s business to a captain in person, and the captain’s answer is on the record', () => {
    const w = createWorld(5, 'Tony Marino', { start: 'underboss' }), p = P(w);
    let s; for (let d = 0; d < 90 && !s; d++) { advance(w, w.now + DAY); s = (w.situations ?? []).find((q) => q.kind === 'charge' && q.stage !== 'resolved'); }
    assert.ok(s, 'the boss set a charge');
    w.now = Math.floor(w.now / DAY) * DAY + 14 * 60;
    const capId = (s!.parties ?? []).filter((x) => x.role === 'cap').map((x) => x.id).find((id) => !s!.m?.['st:' + id] && w.chars[id]?.alive && w.chars[id].jailedUntil <= w.now && (s!.m?.kind !== 'crew' || s!.m?.cap === id));
    assert.ok(capId, 'a captain not yet asked');
    const v = begin(w, capId!);
    const open = everything(w, v).find((c) => c.id.startsWith('a:mt_open:' + s!.id));
    assert.ok(open, 'the charge can be raised with him');
    const r = choose(w, v, open!.id);
    const lean = r.v.choices.find((c) => c.id.includes(':lean:') || c.id.includes(':ask:'));
    assert.ok(lean, `what can be put to him: ${r.v.choices.map((c) => c.label).join(' / ')}`);
    choose(w, r.v, lean!.id);
    assert.ok(s!.m?.['st:' + capId], 'his answer is recorded on the charge');
  });
});

describe('trying to break it', { tags: ['scenario'] }, () => {
  const soldier = () => { const w = createWorld(5, 'Tony Marino', { start: 'soldier' }); advance(w, w.now + 5 * DAY); w.now = Math.floor(w.now / DAY) * DAY + 14 * 60; return w; };
  ok('asked the same thing again, he says it was asked, and when', () => {
    const w = soldier(), p = P(w), cap = w.chars[p.bossId!];
    const ask = () => { const v = begin(w, cap.id); const o = everything(w, v).find((c) => c.id === 'a:promo'); assert.ok(o, 'where he stands can be asked'); const r = choose(w, v, o!.id); return r.v.lines.filter((l) => l.who === 'him').map((l) => l.text).join(' '); };
    ask(); w.now += 3 * 60;
    assert.match(ask(), /asked|same|again|nothing’s moved|hasn’t changed/i);
  });
  ok('a man already working for you is not offered work with you', () => {
    const w = createWorld(5, 'Tony Marino', { start: 'capo' }); advance(w, w.now + 5 * DAY); w.now = Math.floor(w.now / DAY) * DAY + 14 * 60;
    const p = P(w);
    for (const m of Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).slice(0, 4)) assert.ok(!everything(w, begin(w, m.id)).some((c) => c.id.startsWith('a:recruit')), `offered to recruit ${m.name}, who already works for him`);
  });
  ok('a man who changed sides is spoken to as what he is now', () => {
    const w = soldier(), p = P(w), old = w.chars[p.bossId!];
    const other = Object.values(w.chars).find((c) => c.alive && c.familyId === p.familyId && c.rank === 'capo' && c.id !== old.id)!;
    p.bossId = other.id;
    assert.notEqual(tieOf(w, p, old), 'superior');
    assert.equal(tieOf(w, p, other), 'superior');
  });
  ok('a hearing once decided cannot be reopened, and nobody is judge or investigator in his own case', () => {
    for (const start of ['capo', 'consigliere', 'boss'] as const) {
      const w = createWorld(7, 'Tony Marino', { start }); const p = P(w);
      let s; for (let d = 0; d < 90 && !s; d++) { advance(w, w.now + DAY); s = (w.situations ?? []).find((q) => q.kind === 'hearing'); }
      if (!s) continue;
      const role = (r: string) => (s!.parties ?? []).find((x) => x.role === r)?.id;
      assert.notEqual(role('def'), role('judge')); assert.notEqual(role('def'), role('inq')); assert.notEqual(role('acc'), role('def'));
      assert.notEqual(role('def'), p.id, 'the player is never the accused in a case he decides');
    }
  });
});

describe('what was said is kept', { tags: ['scenario'] }, () => {
  ok('asked to put in a word a second time within the month, he has already answered, and it pays nothing again', () => {
    const w = createWorld(5, 'Tony Marino', { start: 'soldier' }); advance(w, w.now + 5 * DAY); w.now = Math.floor(w.now / DAY) * DAY + 14 * 60;
    const p = P(w), cap = w.chars[p.bossId!];
    const once = () => { const v = begin(w, cap.id); const o = everything(w, v).find((c) => c.id === 'a:recommend'); if (!o) return undefined; return choose(w, v, o.id).v.lines.filter((l) => l.who === 'him').map((l) => l.text).join(' '); };
    const first = once(); if (first === undefined) return;
    const favours = w.favours.length; w.now += DAY;
    const again = once();
    assert.equal(w.favours.length, favours, 'no second favour for the same word');
    assert.ok(again === undefined || again !== first, 'he does not simply say it all again');
  });
});

describe('what arrives, audited at every seat', { tags: ['property'] }, () => {
  ok('what men come to the player with, and what they answer, passes the same checks as the conversation', async () => {
    const { encAudit } = await import('../tools/encaudit');
    const r = encAudit(3, 60);
    assert.ok(r.n > 50, `${r.n} encounters`);
    assert.deepEqual(r.flags.slice(0, 6), []);
  }, 300_000);
});

describe('men decide for themselves, and know only what reached them', { tags: ['scenario'] }, () => {
  const consig = () => { const w = createWorld(7, 'Tony Marino', { start: 'consigliere' }); advance(w, w.now + 5 * DAY); w.now = Math.floor(w.now / DAY) * DAY + 15 * 60; for (const e of w.enc) e.status = 'done'; return w; };
  ok('a consigliere does not name a captain’s money from his books, only from what he can see; a grievance only if he heard it', async () => {
    const { rel, addFact } = await import('../../core');
    const w = consig(), p = P(w), f = w.fam[p.familyId!], boss = w.chars[f.bossId];
    // the boss asking: play as the boss would (the player is the consigliere; the question is the boss's), so measure the rule itself
    const { signsOf, heardAgainst } = await import('../../conv/notice');
    const cap = Object.values(w.chars).find((c) => c.alive && c.familyId === f.id && c.rank === 'capo')!;
    cap.books.skim = { until: w.now + 30 * DAY, frac: 0.3 }; cap.cash = 50;
    assert.ok(!signsOf(w, p, cap).includes('flush'), 'holding out on his books, but living like a poor man: nothing to see');
    cap.cash = 5000;
    assert.ok(signsOf(w, p, cap).includes('flush'), 'living well: that can be seen');
    rel(cap, boss.id).grudge = 0.6;
    assert.equal(heardAgainst(w, p, cap, boss), undefined, 'a grudge he keeps to himself is not heard');
    addFact(w, { kind: 'rumour', actor: cap.id, victim: boss.id, minor: true, text: `${cap.name} ran the boss down at the club.`, district: cap.district }, { witnesses: [p.id] });
    assert.ok(heardAgainst(w, p, cap, boss), 'said in front of him, it is heard');
  });
  ok('the boss weighs the consigliere’s advice: fond of the accused, he can refuse it, and the record says what he decided', () => {
    const w = consig(), p = P(w), boss = w.chars[w.fam[p.familyId!].bossId];
    let s; for (let d = 0; d < 90 && !s; d++) { advance(w, w.now + DAY); s = (w.situations ?? []).find((q) => q.kind === 'hearing' && q.stage !== 'resolved'); }
    assert.ok(s);
    for (const e of w.enc) e.status = 'done'; w.now = Math.floor(w.now / DAY) * DAY + 15 * 60;
    const def = w.chars[s!.parties!.find((x) => x.role === 'def')!.id];
    Object.assign(boss.rels[def.id] ??= { trust: 0, respect: 0, affection: 0, grudge: 0, lastMet: 0 }, { trust: 0.85, affection: 0.8 });
    Object.assign(boss.rels[p.id] ??= { trust: 0, respect: 0, affection: 0, grudge: 0, lastMet: 0 }, { trust: 0.45 });
    let v = begin(w, boss.id); v = choose(w, v, everything(w, v).find((c) => c.id === 'a:fam_counsel')!.id).v;
    const guilty = v.choices.find((c) => /did it/.test(c.label))!; v = choose(w, v, guilty.id).v;
    assert.equal(s!.stage, 'resolved'); assert.equal(s!.out, 'the charge thrown out', 'he decided against the advice, and that is what happened');
  });
  ok('a man who denies is not recorded as having confessed; one who admits is', () => {
    const run = (fear: number) => {
      const w = createWorld(3, 'Tony Marino', { start: 'capo' }); advance(w, w.now + 20 * DAY); w.now = Math.floor(w.now / DAY) * DAY + 15 * 60; for (const e of w.enc) e.status = 'done';
      const p = P(w), m = Object.values(w.chars).find((c) => c.name === 'Ralphie Russo')!;
      m.books.skim = { until: w.now + 30 * DAY, frac: 0.2 }; Object.assign(m.rels[p.id] ??= { trust: 0, respect: 0, affection: 0, grudge: 0, lastMet: 0 }, { fear, respect: fear >= 0.3 ? 0.6 : 0.3, trust: 0.4, grudge: 0 });
      let v = begin(w, m.id); for (const re of [/at your end/, /not what your envelope/, /asking you/]) { const c = [...v.choices, ...everything(w, v)].find((x) => re.test(x.label)); if (!c) break; v = choose(w, v, c.id).v; }
      return Object.values(w.facts).some((f) => f.actor === m.id && /admitted to .* he had been keeping money back/.test(f.text));
    };
    assert.equal(run(0.05), false, 'he denied it: no confession on the record');
    assert.equal(run(0.5), true, 'he owned it: on the record');
  });
});
