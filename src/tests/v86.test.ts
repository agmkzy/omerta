// V86: the opening. Names are plausible and safe, backgrounds are history only, and old backgrounds still read.
import assert from 'node:assert/strict';
import { applyBackground, BACKGROUNDS, bgLabel } from '../background';
import { serialize, deserialize } from '../engine';
import { cleanName, FIRST_NAMES, rollFirst, rollName, rollSurname, SURNAMES } from '../names';
import { createWorld, FEMALE, STANDARD_ORGS } from '../world';
import { Rng } from '../rng';

const ok = (name: string, f: () => void) => { f(); console.log('ok   ' + name); };
const rng = new Rng(86);
const rand = () => rng.next();

ok('the name lists are men’s names, unique, and free of the families’ surnames', () => {
  assert.equal(new Set(FIRST_NAMES).size, FIRST_NAMES.length);
  assert.equal(new Set(SURNAMES).size, SURNAMES.length);
  for (const f of FIRST_NAMES) assert.ok(!FEMALE.includes(f), f);
  for (const o of STANDARD_ORGS) assert.ok(!SURNAMES.includes(o.name), o.name);
  assert.ok(FIRST_NAMES.length >= 60 && SURNAMES.length >= 80);
});

ok('every generated name is complete, and re-rolling one half changes only that half', () => {
  for (let i = 0; i < 500; i++) {
    const n = rollName(rand);
    assert.ok(FIRST_NAMES.includes(n.first) && SURNAMES.includes(n.last));
    const f = rollFirst(rand, n.first), l = rollSurname(rand, n.last);
    assert.notEqual(f, n.first); assert.notEqual(l, n.last);
  }
});

ok('a whole new name avoids the names it is told are taken', () => {
  // a city's worth of men already named (far more than any world has), and none of the new names lands on one
  const taken = new Set(Array.from({ length: 2000 }, () => { const n = rollName(rand); return `${n.first} ${n.last}`; }));
  for (let i = 0; i < 500; i++) { const n = rollName(rand, taken); assert.ok(!taken.has(`${n.first} ${n.last}`)); }
});

ok('typed names keep letters, accents, apostrophes and hyphens, and lose anything that could break the page', () => {
  assert.equal(cleanName("D'Ercole"), "D'Ercole");
  assert.equal(cleanName('Niccolò-Maria'), 'Niccolò-Maria');
  assert.equal(cleanName('<b>"Sal"</b>&'), 'bSalb');
  assert.ok(cleanName('x'.repeat(40)).length <= 20);
});

ok('no stranger is generated with the player’s full name or surname (his own mother and sibling share it on purpose)', () => {
  for (let s = 1; s <= 5; s++) {
    const w = createWorld(s, 'Vincenzo Gargiulo');
    const kin = new Set((w.life?.kin ?? []).map((k) => k.id));
    const others = Object.values(w.chars).filter((c) => c.id !== w.playerId && !kin.has(c.id));
    assert.ok(!others.some((c) => c.name === 'Vincenzo Gargiulo' || c.name.endsWith(' Gargiulo')));
  }
});

ok('a background is history only: it changes nothing about the world but the record', () => {
  for (const b of BACKGROUNDS) {
    const a = createWorld(42, 'Anthony Rossi'), c = createWorld(42, 'Anthony Rossi');
    applyBackground(c, c.chars[c.playerId!], b.id);
    const pa = a.chars[a.playerId!], pc = c.chars[c.playerId!];
    assert.equal(pc.bg, b.id);
    assert.equal(pc.cash, 1500);
    delete pc.bg;
    assert.equal(serialize(c), serialize(a), b.id + ' changed the world');
    void pa;
  }
});

ok('the six V86 backgrounds exist, and earlier ones still have a name on old records', () => {
  assert.deepEqual(BACKGROUNDS.map((b) => b.label), ['Street Hustler', 'Connected Family', 'Small Businessman', 'Union Man', 'Bookmaker', 'Wheelman']);
  for (const id of ['boxer', 'convict', 'driver']) assert.ok(bgLabel(id));
  assert.equal(bgLabel(undefined), undefined);
});

ok('the chosen name, look and background survive save and load', () => {
  const w = createWorld(7, "Gaetano D'Agostino");
  const p = w.chars[w.playerId!];
  p.look = { skin: 3, hairColour: 1, style: 2, beard: 4, glasses: 1, jaw: 2, seed: 'you123' };
  applyBackground(w, p, 'union');
  const q = deserialize(serialize(w)).chars[w.playerId!];
  assert.equal(q.name, "Gaetano D'Agostino"); assert.equal(q.bg, 'union'); assert.deepEqual(q.look, p.look);
});
console.log('all passed');
