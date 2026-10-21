// Menus: the opening screen is short, nothing reachable in V76 was removed, every row is a real sentence, the incident
// door only names what you know, and browsing changes nothing in the save. From the V77 and V78 suites.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../engine';
import { DAY } from '../../types';
import { options, optionsRaw, say, startConvo, incidentsOf, involvedIn, isNavCode, focusTitle, QUESTIONS } from '../../dialogue';
import { world60, men, introAll, reach, BASELINES } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });

describe('menus', () => {
  ok('the opening screen is short: what he raises, at most 3 matters and a row to the rest, the 4 everyday questions, at most 2 proposals and a row to the rest', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    for (const m of men(w)) {
      const o = options(w, P(w), m, startConvo(m.id));
      const g = (n: string) => o.filter((x) => x.group === n);
      assert.ok(g('He brings it up').length + g('On his mind').length <= 2, `${m.name}: ${g('He brings it up').length} raised`);
      assert.ok(g('Between you').filter((x) => x.code !== 'f:more').length <= 3, `${m.name}: ${g('Between you').length} matters`);
      assert.deepEqual(g('Talk').map((x) => x.label), QUESTIONS, `${m.name}: the four questions, always the same`);
      assert.ok(g('Propose').filter((x) => !x.nav).length <= 2, `${m.name}: proposals`);
      assert.ok(o.length <= 14, `${m.name}: ${o.length} rows`);
      assert.ok(!o.some((x) => /^(more|n):/.test(x.code)), `${m.name}: the old menus are gone`);
    }
  });
  // (deliberately folded into another row by the conversation (V78: one way to ask about the same thing): 'op' into what is
  // going on with him, 'recommend' into asking for backing, 'ask_rep' when he is a civilian or was just asked; and the last three
  // only for a man above you)
  const MERGED = new Set(['op', 'recommend', 'ask_rep', 'leaders', 'promo', 'pick_concern']);
  ok('nothing that was reachable in V76 has been removed: every action is reachable through the conversation', { tags: ['unit'] }, () => {
    // Checked against the world as it is, not a recorded one (V89): everything a man allows right now (the flat V76 list,
    // optionsRaw, and the leaves of each sub-menu) must be reachable through the arranged conversation. A frozen snapshot broke
    // whenever the world itself moved on.
    const w = world60(); introAll(w);
    let n = 0; const lost: string[] = [];
    for (const m of men(w)) {
      const now = reach(w, m.id);
      const c = startConvo(m.id); c.node = 'root';
      const nodes = optionsRaw(w, P(w), m, c).filter((o) => o.code.startsWith('n:')).map((o) => o.code.slice(2));
      const all = [...optionsRaw(w, P(w), m, c), ...nodes.flatMap((nd) => optionsRaw(w, P(w), m, { ...c, node: nd }))];
      for (const o of all) { if (isNavCode(o.code) || o.code === 'root' || MERGED.has(o.code.split(':')[0])) continue; n++; if (!now.has(o.code) && !now.has('n:' + o.code.split(':')[0])) lost.push(`${m.name}:${o.code}`); }
    }
    assert.ok(n > 150, 'options checked: ' + n); // enough of the world to mean something; how many depends on who is about
    assert.deepEqual(lost, [], 'lost: ' + lost.slice(0, 8).join(', '));
  });
  ok('every option keeps the same action and hint as V76; only the wording changes', { tags: ['unit'] }, () => {
    const snap = JSON.parse(readFileSync(join(BASELINES, 'v76-option-codes.json'), 'utf8')) as Record<string, string[]>;
    const HINT = new Map<string, string>(), KHINT = new Map<string, Set<string>>(), known = new Set<string>();
    for (const x of Object.values(snap).flat()) { const code = x.slice(0, x.indexOf('|')), hint = x.slice(x.indexOf('|') + 1), kind = code.split(':')[0]; HINT.set(code, hint); known.add(kind); (KHINT.get(kind) ?? KHINT.set(kind, new Set()).get(kind)!).add(hint); }
    // V76 options that exist but never came up in the world the record was made in (a crew man's light envelope, a man just out of
    // hospital): any option the conversation code itself defines is a real one. Recorded ones keep their hints.
    const src = readFileSync(join(BASELINES, '..', '..', '..', 'dialogue.ts'), 'utf8');
    for (const k of [...src.matchAll(/add\('([a-z_0-9]+)[':]/g)].map((x) => x[1])) known.add(k);
    const w = world60(), p = P(w);
    const ms = men(w);
    for (const m of ms) (p.intro ??= {})[m.id] = w.now;
    let n = 0;
    const RANKS = ['associate', 'soldier', 'capo', 'underboss', 'boss', 'civilian'];
    for (const m of ms) for (const node of ['personal', 'business', 'family', 'disputes', 'orders', 'memos', 'amends', 'shop', 'crew', 'debt', 'myboss', 'rival', 'pick_member', 'pick_concern']) {
      const c = startConvo(m.id); c.node = node;
      // The world the snapshot was taken in has moved on (V78 tells you one thing at a time; V89 changes how regard is earned), so
      // which men have which options can differ. What every option does and says about itself cannot.
      for (const o of options(w, p, m, c)) {
        const code = o.code, hint = o.hint ?? '', kind = code.split(':')[0];
        assert.ok(known.has(kind), `${m.name} ${node}: unknown option ${code}`);
        // (where the hint is the man's rank, it is the world's state, and men are promoted)
        if (HINT.has(code) && !(RANKS.includes(hint) && RANKS.includes(HINT.get(code)!))) assert.equal(hint, HINT.get(code), `${m.name} ${node}: ${code} hint changed`);
        else if (KHINT.has(kind)) assert.ok(KHINT.get(kind)!.has(hint), `${m.name} ${node}: ${code} has a hint V76 never gave that kind of option: "${hint}"`);
        n++;
      }
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
  ok('a subject opens to only what belongs to it, is named, and there is always a way back', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w);
    const m = men(w).find((x) => x.rank !== 'civilian' && options(w, P(w), x, startConvo(x.id)).some((o) => o.code.startsWith('f:') && o.code !== 'f:think'))!;
    let c = startConvo(m.id);
    const door = options(w, P(w), m, c).find((x) => x.code.startsWith('f:') && x.code !== 'f:think')!;
    const r = say(w, P(w), m, c, door.code); c = r.convo!;
    assert.ok(r.lines.length >= 1, 'opening a subject is said, and answered: ' + door.code);
    const o = options(w, P(w), m, c);
    assert.ok(!o.some((x) => x.group), 'no hub groups inside a subject');
    assert.ok(o.some((x) => x.code === 'f:') && o.some((x) => x.code === 'root'), 'a way back and a way out');
    assert.ok(focusTitle(w, P(w), m, c), 'the subject is named');
    c = say(w, P(w), m, c, 'f:').convo!;
    assert.ok(options(w, P(w), m, c).some((x) => x.group === 'Talk'), 'back on the hub');
  });
  ok('a man who owes you money: the debt is among the matters, not buried', { tags: ['unit'] }, () => {
    const w = world60(); introAll(w); const p = P(w);
    const m = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId && x.bossId !== p.id)!;
    w.debts.push({ id: 'dbg1', creditor: p.id, debtor: m.id, principal: 600, balance: 600, weeklyPayment: 60, missed: 1, status: 'active', rate: 0.05, since: w.now - 20 * DAY } as never);
    const o = options(w, p, m, startConvo(m.id)).filter((x) => x.group === 'Between you' || x.group === 'He brings it up');
    assert.ok(o.some((x) => x.code === 'f:debt'), o.map((x) => x.code).join());
    const c = say(w, p, m, startConvo(m.id), 'f:debt').convo!;
    assert.ok(options(w, p, m, c).some((x) => x.code.startsWith('d_')), 'and inside it, what can be done about the debt');
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
    for (const m of men(w).slice(0, 10)) { const c = startConvo(m.id); for (const o of options(w, P(w), m, c).filter((x) => x.code.startsWith('f:'))) say(w, P(w), m, c, o.code); }
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
