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
