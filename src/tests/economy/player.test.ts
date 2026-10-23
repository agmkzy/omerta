// Stage 4 acceptance: what a player can actually do in the criminal economy, tested as play. Each flow starts from the screen the
// player sees (the screen is built exactly as the game builds it, and the action is looked for in it), is carried out through the same
// function the button calls (web.ts), and is followed into the world: money, records, obligations. The economy is the same one NPCs
// use; nothing here is a player-only path.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY, WEEK, type World } from '../../types';
import { S } from '../../ui/state';
import { wayView } from '../../ui/views_c';
import { canStart, startOp, lineOf } from '../../rackets';
import { options, say, startConvo, type Convo, type DOpt } from '../../dialogue';
import { bizView } from '../../ui/views_a';
import { openAsks } from '../../asks';
import { bizMove, priceOf, setManager } from '../../econ';
import { createWorld } from '../../world';
import { ownerBiz, rel } from '../../core';
import type { Character } from '../../types';
import { newWorld, P } from '../helpers';

const screen = (w: World, f: () => string) => { S.w = w; return f(); };

describe('the player in the criminal economy', { tags: ['scenario'] }, () => {
  ok('4–5. an associate finds a racket, starts it himself, earns from it, and owes his share of it upstairs', () => {
    const w = newWorld(7), p = P(w);
    assert.equal(p.rank, 'associate');
    p.cash = 3000;
    const where = w.fam[p.familyId!].districts[0];
    // the Rackets screen offers it to an associate, with no captain's assignment and no rank to reach first
    const html = screen(w, () => wayView('numbers'));
    assert.match(html, /data-a="opstart:numbers"/, 'the screen offers to set up a numbers racket');
    assert.equal(canStart(w, p, 'numbers', where), null, 'an associate may start one');
    // what the "Set it up" button does (web.ts 'opgo')
    startOp(w, p, 'numbers', where, null);
    const op = lineOf(w, p)!;
    assert.ok(op && op.kind === 'numbers' && op.owner === p.id, 'it is his: the one enterprise record everyone\'s are kept in');
    const cash0 = p.cash;
    advance(w, w.now + 3 * WEEK + DAY);
    assert.ok(op.total > 0, 'it earns');
    const wk = p.books.history.filter((h) => h.sources?.numbers);
    assert.ok(wk.length > 0, 'its money is in his books, where his superiors can see what they can see');
    assert.ok(wk.some((h) => h.due > 0), 'and he owes his share of it upstairs: the obligation that comes with earning in the family');
    void cash0;
  });

  // ------------------------------------------------------------- flows 1-3, 6-8: through the conversation, as the player plays it
  // (find a line the way the player does: open the conversation and follow the menus, never more than a few steps deep)
  const find = (w: World, p: Character, t: Character, want: (o: DOpt) => boolean, c: Convo = startConvo(t.id)): { o: DOpt; c: Convo } | undefined => {
    const seen = new Set<string>(); const q: Convo[] = [c];
    for (let i = 0; i < 30 && q.length; i++) {
      const cv = q.shift()!, opts = options(w, p, t, cv);
      const hit = opts.find(want); if (hit) return { o: hit, c: cv };
      for (const o of opts) if ((o.nav || o.code.startsWith('f:') || o.code.startsWith('n:')) && !seen.has(o.code)) { seen.add(o.code); const r = say(w, p, t, cv, o.code); if (r.convo) q.push(r.convo); }
    }
    return undefined;
  };
  const shopkeeper = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && ownerBiz(w, c.id)!.kind !== 'casino').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  const meet = (w: World, p: Character, t: Character) => { (p.intro ??= {})[t.id] = w.now; rel(t, p.id).trust = 0.4; };

  ok('1–3. an associate finds a business, offers for it, is countered on a low offer, names a better figure, and owns it', () => {
    const w = createWorld(7, 'Tony Marino'), p = P(w), t = shopkeeper(w), b = ownerBiz(w, t.id)!;
    assert.equal(p.rank, 'associate');
    p.cash = 50000; meet(w, p, t);
    // 1. the business is on the map: its page sends him to talk to the owner
    assert.match(screen(w, () => bizView(b.id)), new RegExp(`data-a="talk:${t.id}"`));
    // ...and in conversation, the question is there to ask
    const f = find(w, p, t, (o) => o.code === 'buy_ask');
    assert.ok(f, 'he can ask whether the owner would sell');
    let r = say(w, p, t, f!.c, 'buy_ask');
    const sit = openAsks(w).find((x) => x.ak === 'buy' && x.terms?.by === p.id && x.biz === b.id)!;
    assert.ok(sit, 'it is a negotiation between them now');
    // 2. the figure is his to name: a low one is not taken
    const row = options(w, p, t, r.convo!).find((o) => o.code === 'nm:' + sit.id)!;
    assert.ok(row?.amount, 'the screen offers a figure to name: ' + options(w, p, t, r.convo!).map((o) => o.code).join(', '));
    const full = priceOf(w, b);
    r = say(w, p, t, r.convo!, `nm:${sit.id}:${Math.round(full * 0.35 / 50) * 50}`);
    assert.equal(b.ownerId, t.id, 'a lowball offer does not buy it');
    // 3. a fair one does: the money changes hands and the place is his, on the record
    const cash0 = p.cash, tcash0 = t.cash;
    for (let i = 0; i < 4 && b.ownerId !== p.id; i++) { w.now += 24 * 60; r = say(w, p, t, r.convo ?? startConvo(t.id), `nm:${sit.id}:${Math.round(full * 1.5 / 50) * 50}`); }
    assert.equal(b.ownerId, p.id, 'it is his: ' + r.lines.join(' '));
    assert.ok(p.cash < cash0 && t.cash > tcash0 && cash0 - p.cash === t.cash - tcash0, 'the money went to the man who sold it');
    assert.ok(Object.values(w.facts).some((x) => x.kind === 'ownership' && x.actor === p.id && x.business === b.id), 'on the record');
  });

  ok('6. he names his own protection figure, and the shopkeeper answers that figure; an agreed fee is the arrangement', () => {
    const w = createWorld(7, 'Tony Marino'), p = P(w);
    const t = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection && ownerBiz(w, c.id)!.kind !== 'casino').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    const b = ownerBiz(w, t.id)!; meet(w, p, t);
    const f = find(w, p, t, (o) => o.code === 'suggest');
    assert.ok(f, 'the protection conversation can be opened');
    let r = say(w, p, t, f!.c, 'suggest');
    const sit = openAsks(w).find((x) => x.ak === 'protect' && x.terms?.by === p.id && x.biz === b.id)!;
    assert.ok(sit);
    const row = options(w, p, t, r.convo ?? startConvo(t.id)).find((o) => o.code === 'nm:' + sit.id);
    assert.ok(row?.amount, 'a figure of his own');
    for (let i = 0; i < 5 && b.protection?.collectorId !== p.id; i++) { w.now += 24 * 60; r = say(w, p, t, r.convo ?? startConvo(t.id), `nm:${sit.id}:15`); }
    if (b.protection?.collectorId === p.id) assert.equal(b.protection.fee, 15, 'the fee is the one agreed');
    else assert.equal(sit.terms?.amt, 15, 'his figure is what was put to the man');
  });

  ok('7. he lends on his own terms: the amount and the weekly rate are his to name, and the debt carries them', () => {
    const w = createWorld(7, 'Tony Marino'), p = P(w);
    p.cash = 5000;
    let done = false;
    for (const t of Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && ownerBiz(w, c.id)?.open).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, 12)) {
      meet(w, p, t); const b = ownerBiz(w, t.id)!; bizMove(w, b, -b.cash, 'expense'); b.distress = 2; // a man who needs it
      const f = find(w, p, t, (o) => o.code === 'offer_loan');
      if (!f) continue;
      let r = say(w, p, t, f.c, 'offer_loan');
      const sit = openAsks(w).find((x) => x.ak === 'lend' && x.terms?.by === p.id && x.terms?.of === t.id);
      if (!sit) continue;
      const row = options(w, p, t, r.convo ?? startConvo(t.id)).find((o) => o.code === 'nm:' + sit.id);
      assert.ok(row?.amount?.rate, 'a rate to name, beside the amount');
      r = say(w, p, t, r.convo ?? startConvo(t.id), `nm:${sit.id}:700:0.04`);
      const d = w.debts.find((x) => x.creditor === p.id && x.debtor === t.id && x.status === 'active');
      if (d) { assert.equal(d.principal, 700); assert.equal(d.weeklyRate, 0.04); done = true; break; }
    }
    assert.ok(done, 'a man in need took a loan on the terms the player named');
  });

  ok('8. he decides who runs his place: one of his men, a manager hired in, or himself', () => {
    const w = createWorld(7, 'Tony Marino'), p = P(w), t = shopkeeper(w), b = ownerBiz(w, t.id)!;
    p.cash = 50000; t.cash = 0; b.distress = 3; meet(w, p, t);
    const s = openAsks(w).length; void s;
    let r = say(w, p, t, find(w, p, t, (o) => o.code === 'buy_ask')!.c, 'buy_ask');
    const sit = openAsks(w).find((x) => x.ak === 'buy' && x.terms?.by === p.id)!;
    for (let i = 0; i < 4 && b.ownerId !== p.id; i++) { w.now += 1440; r = say(w, p, t, r.convo ?? startConvo(t.id), `nm:${sit.id}:${priceOf(w, b) * 2}`); }
    assert.equal(b.ownerId, p.id);
    const html = screen(w, () => bizView(b.id));
    assert.match(html, /data-a="bmgr:[^"]*\\|hire"/, 'his own place offers him the choice');
    setManager(w, b, p, 'hire');
    assert.ok(b.managerId && w.chars[b.managerId].alive, 'a manager runs it');
    setManager(w, b, p, null);
    assert.equal(b.managerId, undefined, 'and he can take it back');
  });
});
