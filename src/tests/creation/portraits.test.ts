// Portraits: deterministic, well-formed, save-compatible, cheap, and the face survives a promotion.
import assert from 'node:assert';
import { test } from 'vitest';
import { portrait, portraitParts, LOOK_OPTIONS, randomLook, SKIN_LIST, HAIR_LIST, LookX } from '../../ui/portrait';
import { S } from '../../ui/state';
import { Character, Rank } from '../../types';

// Each numbered section below is one Vitest check. Inside it every condition is still evaluated, and the check fails at the end
// with all the conditions that did not hold.
let failed: string[] = [];
const ok = (cond: boolean, msg: string) => { if (!cond) failed.push(msg); };
const section = (name: string, f: () => void) => test(name, { tags: ['unit'] }, () => { failed = []; f(); assert.deepEqual(failed, [], `${failed.length} failed`); });

const RANKS: Rank[] = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const traits = { greed: 0.5, violence: 0.5, ambition: 0.5, caution: 0.5, sociability: 0.5, vice: 0.3, courage: 0.5 };
const mk = (id: string, name: string, rank: Rank, look?: LookX, extra: Partial<Character> = {}) =>
  ({ id, name, rank, traits: { ...traits }, look, hurtUntil: 0, familyId: null, ...extra } as unknown as Character);
const MAN = 'Tony Marino', WOMAN = 'Rosa Marino';
const norm = (svg: string) => svg.replace(/q[0-9a-z]+_/g, 'ID_');

// A well-formed SVG: one root, balanced tags, nothing undefined.
function wellFormed(svg: string): string | null {
  if (!svg.startsWith('<svg ') || !svg.endsWith('</svg>')) return 'not a single <svg> root';
  if (/NaN|undefined|Infinity|\[object/.test(svg)) return 'contains NaN/undefined';
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null, roots = 0;
  while ((m = re.exec(svg))) {
    const [, close, tag, , self] = m;
    if (self) { if (!stack.length) roots++; continue; }
    if (close) { if (stack.pop() !== tag) return 'unbalanced </' + tag + '>'; }
    else { if (!stack.length) roots++; stack.push(tag); }
  }
  if (stack.length) return 'unclosed ' + stack.join(',');
  if (roots !== 1) return roots + ' roots';
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]);
  if (new Set(ids).size !== ids.length) return 'duplicate id inside one svg';
  for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) if (!ids.includes(ref[1])) return 'dangling url(#' + ref[1] + ')';
  return null;
}

section('1. Determinism', () => {
  for (const r of RANKS) for (const name of [MAN, WOMAN]) {
    const a = portrait(mk('c42', name, r)), b = portrait(mk('c42', name, r));
    ok(a !== b, 'two renders get different instance ids');
    ok(norm(a) === norm(b), `deterministic ${r} ${name}`);
  }
});

section('2. Every rank x gender x option value renders well-formed SVG (and some seeds)', () => {
  let count = 0;
  for (const r of RANKS) for (const name of [MAN, WOMAN]) {
    for (let i = 0; i < 40; i++) { const e = wellFormed(portrait(mk('c' + i * 31, name, r))); ok(!e, `npc ${r} ${name} c${i * 31}: ${e}`); count++; }
    for (const o of LOOK_OPTIONS) for (let v = 0; v < o.options.length; v++) {
      const e = wellFormed(portrait(mk('player', name, r, { seed: 'you9', [o.key]: v })));
      ok(!e, `option ${o.key}=${v} ${r} ${name}: ${e}`); count++;
    }
  }
  // hurt, with and without a world
  (S as unknown as { w: unknown }).w = { now: 100 };
  for (const r of RANKS) { const svg = portrait(mk('c7', MAN, r, undefined, { hurtUntil: 200 })); ok(!wellFormed(svg) && svg.includes('#5a3350'), 'hurt shows a bruise ' + r); }
  ok(!portrait(mk('c7', MAN, 'soldier', undefined, { hurtUntil: 50 })).includes('#5a3350'), 'healed shows no bruise');
  (S as unknown as { w: unknown }).w = undefined;
  ok(!wellFormed(portrait(mk('c7', MAN, 'boss', undefined, { hurtUntil: 200 }))), 'renders with no world (title screen)');
  // odd inputs: out-of-range indices, missing traits, an unknown rank, a name with markup
  ok(!wellFormed(portrait(mk('x', MAN, 'capo', { skin: 99, hairColour: -3, style: 42, beard: 1.7, glasses: NaN, jaw: 7 } as LookX))), 'clamps out-of-range look values');
  ok(!wellFormed(portrait({ id: 'y', name: '<b>"Joe"</b>', rank: 'mystery', hurtUntil: 0 } as unknown as Character)), 'survives missing traits, unknown rank, markup in name');
  console.log(`rendered ${count} option/rank/gender combinations`);
});

section('3. Old saves: looks with only the original keys', () => {
  const OLD: LookX[] = [
    { skin: 1, hairColour: 1, style: 0, beard: 0, glasses: 0, jaw: 1, seed: 'you1' }, // the default in ui/state.ts
    ...Array.from({ length: 6 }, (_, i) => ({ skin: i, hairColour: 5 - i, style: i % 4, beard: i, glasses: i % 3, jaw: i % 3, seed: 'you' + i * 7 })),
    {}, { skin: 3 },
  ];
  for (const lk of OLD) for (const r of RANKS) { const e = wellFormed(portrait(mk('p1', MAN, r, lk))); ok(!e, 'old look ' + JSON.stringify(lk) + ' ' + r + ': ' + e); }
  // old keys keep their meaning: the chosen skin and hair colours are the ones painted
  for (let i = 0; i < 6; i++) {
    ok(portraitParts(mk('p', MAN, 'associate', { skin: i, seed: 's' })).face.includes(`fill="${SKIN_LIST[i]}"`), 'skin index ' + i + ' paints ' + SKIN_LIST[i]);
    ok(portraitParts(mk('p', MAN, 'associate', { hairColour: i, style: 0, age: 0, seed: 's' })).hair.includes(`fill="${HAIR_LIST[i]}"`), 'hair index ' + i + ' paints ' + HAIR_LIST[i]);
  }
  // bald (style 3) shows no hair cap; dark glasses (2) are dark; facial hair 0 vs 1 differ
  const P = (lk: LookX) => portraitParts(mk('p', MAN, 'associate', { seed: 's', ...lk }));
  ok(P({ style: 3 }).hair !== P({ style: 0 }).hair, 'style 3 (bald) differs from slicked');
  ok(P({ glasses: 2 }).det.includes('#0d0b0c'), 'glasses 2 are dark glasses');
  ok(P({ beard: 1 }).face !== P({ beard: 0 }).face, 'beard 1 (moustache) shows');
});

section('4. ids unique across two renders of the same character on one page', () => {
  const a = portrait(mk('c9', MAN, 'boss')), b = portrait(mk('c9', MAN, 'boss'));
  const ia = [...a.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]), ib = [...b.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]);
  ok(ia.length > 0 && ia.every((x) => !ib.includes(x)), 'ids unique across renders');
});

section('5. Rank changes the clothes, never the face', () => {
  for (const id of ['c1', 'c22', 'c303', 'player']) for (const name of [MAN, WOMAN]) {
    const look = id === 'player' ? randomLook(((n) => () => (n = (n * 9301 + 49297) % 233280) / 233280)(7)) : undefined;
    const parts = RANKS.map((r) => portraitParts(mk(id, name, r, look)));
    const face = (p: ReturnType<typeof portraitParts>) => p.back + p.neck + p.face + p.hair + p.det;
    for (const p of parts) ok(face(p) === face(parts[0]), `face of ${id} ${name} unchanged by rank`);
    ok(new Set(parts.map((p) => p.dress)).size >= (name === WOMAN ? 2 : 5), `clothes of ${id} ${name} vary by rank (${new Set(parts.map((p) => p.dress)).size} distinct)`);
    // and the face really is in the rendered svg
    const full = norm(portrait(mk(id, name, 'boss', look)));
    ok(full.includes(norm(portraitParts(mk(id, name, 'boss', look), 'q0_').face).replace(/ fill="none"| stroke-linecap="round"/g, '')), 'face part is what is rendered');
  }
  // the associate's top tier: no tie on associates, a tie on capos
  for (let i = 0; i < 30; i++) {
    const a = portraitParts(mk('c' + i, MAN, 'associate')), c = portraitParts(mk('c' + i, MAN, 'capo'));
    ok(a.dress !== c.dress, 'associate and capo dress differently ' + i);
  }
});

section("6. The creator's data", () => {
  ok(LOOK_OPTIONS.length >= 8 && LOOK_OPTIONS.length <= 12, 'between 8 and 12 controls');
  for (const k of ['skin', 'hairColour', 'style', 'beard', 'glasses', 'jaw']) {
    const o = LOOK_OPTIONS.find((x) => x.key === k);
    ok(!!o, 'old key offered: ' + k);
  }
  ok(LOOK_OPTIONS.find((x) => x.key === 'style')!.options.slice(0, 4).map((o) => o.label).join() === 'Slicked back,Long,Receding,Bald', 'old styles keep their order');
  ok(LOOK_OPTIONS.find((x) => x.key === 'beard')!.options.slice(0, 6).map((o) => o.label).join() === 'Clean,Moustache,Stubble,Goatee,Sideburns,Mutton chops', 'old beards keep their order');
  for (let i = 0; i < 50; i++) {
    let n = i + 1; const rand = () => (n = (n * 16807) % 2147483647) / 2147483647;
    const lk = randomLook(rand);
    for (const o of LOOK_OPTIONS) { const v = (lk as Record<string, unknown>)[o.key]; ok(typeof v === 'number' && v >= 0 && v < o.options.length && Number.isInteger(v), 'randomLook ' + o.key + '=' + v); }
    ok(typeof lk.seed === 'string', 'randomLook gives a seed');
  }
});

section('7. Performance and size', () => {
  const cs: Character[] = [];
  for (let i = 0; i < 300; i++) cs.push(mk('n' + i, i % 5 === 0 ? WOMAN : MAN, RANKS[i % 6]));
  for (const c of cs.slice(0, 30)) portrait(c); // warm up
  const t0 = performance.now();
  let total = 0, max = 0;
  for (const c of cs) { const svg = portrait(c); total += svg.length; max = Math.max(max, svg.length); }
  const ms = performance.now() - t0;
  console.log(`300 portraits: ${ms.toFixed(1)} ms, average ${(total / 300 / 1024).toFixed(2)} KB, largest ${(max / 1024).toFixed(2)} KB`);
  ok(ms < 150, '300 portraits well under 300 ms (' + ms.toFixed(1) + ')');
  ok(total / 300 < 6 * 1024, 'average size under 6 KB');
  ok(max < 8 * 1024, 'largest under 8 KB');
  ok(!cs.some((c) => /<filter|feTurbulence/.test(portrait(c))), 'no SVG filters');
});
