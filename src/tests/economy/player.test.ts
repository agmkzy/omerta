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
});
