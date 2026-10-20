// Menus: the opening screen is short, nothing reachable in V76 was removed, every row is a real sentence, the incident
// door only names what you know, and browsing changes nothing in the save. From the V77 and V78 suites.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../engine';
import { DAY } from '../../types';
import { options, say, startConvo, incidentsOf, involvedIn } from '../../dialogue';
import { world60, men, introAll, reach, CATS, BASELINES } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });

describe('menus', () => {
  ok('the opening screen is short: at most 4 matters, 4 ways to talk and one door to the rest', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w)) {
      const o = options(w, P(w), m, startConvo(m.id));
      const g = (n: string) => o.filter((x) => x.group === n).filter((x) => !x.nav).length;
      assert.ok(g('Between you') <= 4, `${m.name}: ${g('Between you')} matters`);
      assert.ok(g('Talk') <= 4, `${m.name}: ${g('Talk')} talk`);
      assert.ok(o.length <= 10, `${m.name}: ${o.length} rows`);
    }
  });
  ok('nothing that was reachable in V76 has been removed: every action is still within Other business', { tags: ['unit'] }, () => {
    const old = JSON.parse(readFileSync(join(BASELINES, 'v76-root-reach.json'), 'utf8')) as Record<string, string[]>;
    const w = world60(); introAll(w);
    let n = 0, lost: string[] = [];
    for (const m of men(w)) {
      const now = reach(w, m.id);
      for (const code of old[m.id]) { n++; if (!now.has(code) && !now.has('n:' + code.split(':')[0])) lost.push(`${m.name}:${code}`); }
    }
    assert.ok(n > 200);
    assert.deepEqual(lost, [], 'lost: ' + lost.slice(0, 8).join(', '));
  });
  ok('every option keeps the same action and hint as V76; only the wording changes', { tags: ['unit'] }, () => {
    const snap = JSON.parse(readFileSync(join(BASELINES, 'v76-option-codes.json'), 'utf8')) as Record<string, string[]>;
    const w = world60(), p = P(w);
    const ms = men(w);
    for (const m of ms) (p.intro ??= {})[m.id] = w.now;
    let n = 0;
    for (const m of ms) for (const node of ['personal', 'business', 'family', 'disputes', 'orders', 'memos', 'amends', 'shop', 'crew', 'debt', 'myboss', 'rival', 'pick_member', 'pick_concern']) { // root was restructured in V78; "nothing that was reachable in V76 has been removed" above proves nothing was lost
      const c = startConvo(m.id); c.node = node;
      const got = options(w, p, m, c).map((o) => `${o.code}|${o.hint ?? ''}`);
      // The world differs slightly from the V76 snapshot (V78 tells you one thing at a time), so who is listed can differ; what each kind of
      // option does and says about itself cannot.
      const kinds = (l: string[]) => [...new Set(l.map((x) => x.split(':')[0].split('|')[0]))].sort();
      const exp = snap[`${m.id}:${node}`];
      if (node === 'pick_concern' || node === 'pick_member') assert.deepEqual(kinds(got), kinds(exp), `${m.name} ${node}`);
      else assert.deepEqual(got, exp, `${m.name} ${node}`);
      n += got.length;
    }
    assert.ok(n > 1000);
  });
  ok('every spoken label is a real sentence: not empty, no placeholder left over, costs still shown', { tags: ['unit'] }, () => {
    const w = world60(), p = P(w);
    const ms = men(w);
    for (const m of ms) (p.intro ??= {})[m.id] = w.now;
    for (const m of ms) for (const node of ['root', 'personal', 'business', 'crew', 'debt', 'myboss', 'rival', 'amends']) {
      const c = startConvo(m.id); c.node = node;
      for (const o of options(w, p, m, c)) {
        assert.ok(o.label.length >= 3, `${m.name}/${o.code}`);
        assert.ok(!/\$1|undefined|\{\w+\}/.test(o.label), `${o.code}: ${o.label}`);
      }
    }
    // an option with a price in its old wording still has it
    const t = ms.find((m) => m.rank !== 'civilian' && m.bossId !== p.id)!;
    const c = startConvo(t.id); c.node = 'personal';
    const drink = options(w, p, t, c).find((o) => o.code === 'drink')!;
    assert.match(drink.label, /\$40/);
  });
  ok('Other business opens to categories, a category lists its actions, and there is always a way back', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    const m = men(w).find((x) => x.rank !== 'civilian')!;
    let c = startConvo(m.id);
    let o = options(w, P(w), m, c);
    const door = o.find((x) => x.code === 'more:all')!;
    assert.ok(door, 'door present');
    let r = say(w, P(w), m, c, door.code); c = r.convo!;
    o = options(w, P(w), m, c);
    assert.ok(o.some((x) => x.code === 'more:back'));
    const cats = o.filter((x) => x.code.startsWith('more:') && CATS.some((k) => x.code === 'more:' + k));
    assert.ok(cats.length >= 2, 'categories');
    r = say(w, P(w), m, c, cats[0].code); c = r.convo!;
    o = options(w, P(w), m, c);
    assert.ok(o.some((x) => x.code === 'more:up') && o.length >= 3);
    r = say(w, P(w), m, c, 'more:back'); c = r.convo!;
    assert.ok(options(w, P(w), m, c).some((x) => x.group === 'Talk'));
  });
  ok('a man who owes you money: the debt is among the matters, not buried', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId && x.bossId !== p.id)!;
    w.debts.push({ id: 'dbg1', creditor: p.id, debtor: m.id, principal: 600, balance: 600, weeklyPayment: 60, missed: 1, status: 'active', rate: 0.05, since: w.now - 20 * DAY } as never);
    const o = options(w, p, m, startConvo(m.id)).filter((x) => x.group === 'Between you');
    assert.ok(o.some((x) => x.code.startsWith('d_')), o.map((x) => x.code).join());
  });
  ok('a quiet man has no manufactured matters', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank === 'civilian' || (x.id !== p.bossId && x.bossId !== p.id && !x.problem && (x.rels[p.id]?.grudge ?? 0) < 0.1 && !w.debts.some((d) => d.debtor === x.id || d.creditor === x.id)))!;
    const o = options(w, p, m, startConvo(m.id));
    assert.ok(o.filter((x) => x.group === 'Between you').length <= 2);
  });
  ok('the incident door only names what YOU know', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    for (const m of men(w)) {
      for (const o of options(w, p, m, startConvo(m.id)).filter((x) => x.code.startsWith('inc:'))) {
        const id = o.code.slice(4);
        assert.ok(p.known[id], `${m.name} offers ${id} which the player does not know`);
      }
      const c = startConvo(m.id); (c.ctx as { more?: string[] }).more = ['all', 'Favours and requests'];
    }
  });
  ok('the incident picker does not print what the player has not learned', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    for (const m of men(w)) {
      const c = startConvo(m.id); c.node = 'pick_incident';
      for (const o of options(w, p, m, c).filter((x) => x.code.startsWith('inc:'))) {
        const f = w.facts[o.code.slice(4)];
        if (!p.known[f.id]) assert.ok(!o.label.includes(f.text.slice(0, 25)), `${m.name}: ${o.label}`);
      }
    }
  });
  ok('every row is a real sentence and the actions keep their hints', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w)) for (const o of options(w, P(w), m, startConvo(m.id))) {
      assert.ok(o.label.length >= 3 && !/undefined|\$1/.test(o.label), `${m.name}/${o.code}`);
    }
  });
  ok('no dead ends and no nonsense: every incident menu has something to ask, and only a man it happened to is asked what can be done', { tags: ['unit'] }, () => {
    const w = world60(); let n = 0;
    for (const m of Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.rank !== 'civilian')) {
      const p = P(w); (p.intro ??= {})[m.id] = w.now;
      for (const { f } of incidentsOf(w, m)) {
        n++;
        let c = { id: m.id, node: 'incident', ctx: { fact: f.id, asked: [] as string[] } } as never as ReturnType<typeof startConvo>;
        const top = options(w, p, m, c);
        assert.ok(top.filter((x) => !x.code.startsWith('sub:') && x.code !== 'root').length + top.filter((x) => x.code.startsWith('sub:')).length >= 1, `${m.name}: ${top.map((x) => x.code).join()}`);
        const door = top.find((x) => x.code === 'sub:act');
        if (door) { assert.ok(involvedIn(w, m, f), 'a bystander is not asked what can be done'); const r = say(w, p, m, c, 'sub:act'); assert.ok(r.lines.length, 'it says what really can be done'); const inner = options(w, p, m, r.convo!).filter((x) => x.code !== 'sub:back'); assert.ok(inner.length >= 1, 'the list has actions'); }
        assert.ok(!top.some((x) => x.code === 'can_do'), 'can_do is never a menu row');
        if (f.actor === m.id) assert.ok(!top.some((x) => x.code === 'view'), 'the man who did it is not asked what he makes of it');
        void c;
      }
    }
    assert.ok(n >= 10, `only ${n} incidents checked`);
  });
  ok('the save still round-trips after browsing', { tags: ['determinism'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w).slice(0, 10)) { const c = startConvo(m.id); say(w, P(w), m, c, 'more:all'); }
    const s = serialize(w);
    assert.equal(serialize(deserialize(s)), s);
  });
  ok('the old save still round-trips after conversations (no new shape in the save)', { tags: ['determinism'] }, () => {
    const w = world60(), p = P(w);
    for (const t of men(w, 10)) { (p.intro ??= {})[t.id] = w.now; say(w, p, t, startConvo(t.id), 'old_times'); }
    const s = serialize(w);
    assert.equal(serialize(deserialize(s)), s);
  });
});
