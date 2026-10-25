// Portraits: deterministic, well-formed, save-compatible, cheap, and the face survives a promotion.
import assert from 'node:assert';
import { test } from 'vitest';
import { portrait, portraitParts, LOOK_OPTIONS, LOOK_GROUPS, OUTFITS, randomLook, resolveLook, SKIN_LIST, HAIR_LIST, LookX } from '../../ui/portrait';
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
  ok(LOOK_OPTIONS.length >= 20 && LOOK_OPTIONS.length <= 30, 'between 20 and 30 controls');
  for (const k of ['skin', 'hairColour', 'style', 'beard', 'glasses', 'jaw', 'build', 'nose', 'brows', 'age', 'mark', 'habit']) {
    const o = LOOK_OPTIONS.find((x) => x.key === k);
    ok(!!o, 'old key offered: ' + k);
  }
  const labels = (k: string, n: number) => LOOK_OPTIONS.find((x) => x.key === k)!.options.slice(0, n).map((o) => o.label).join();
  ok(labels('style', 4) === 'Slicked back,Long,Receding,Bald', 'old styles keep their order');
  ok(labels('beard', 6) === 'Clean,Moustache,Stubble,Goatee,Sideburns,Mutton chops', 'old beards keep their order');
  ok(labels('glasses', 3) === 'None,Spectacles,Dark glasses', 'old eyewear keeps its order');
  ok(labels('jaw', 3) === 'Square,Even,Lean', 'old jaws keep their order');
  ok(labels('style', 9) === 'Slicked back,Long,Receding,Bald,Side part,Pompadour,Curly,Crew cut,Shaggy', 'V88 haircuts keep their order');
  ok(labels('nose', 5) === 'Straight,Roman,Broad,Boxer’s,Small' && labels('brows', 4) === 'Heavy,Straight,Arched,Thin' && labels('habit', 5) === 'None,Cigarette,Toothpick,Cigar,Gold chain', 'V88 options keep their order');
  // the old palettes keep their colours at their old indices (a saved index paints what it always painted)
  ok(SKIN_LIST.slice(0, 6).join() === '#efc9a6,#e5b48a,#d89f77,#c58a63,#a86f4c,#7f503a', 'old complexions unchanged');
  ok(HAIR_LIST.slice(0, 6).join() === '#17120f,#2a1c14,#412a1b,#5a3a22,#6a3b22,#8c8985', 'old hair colours unchanged');
  for (const o of LOOK_OPTIONS) {
    ok((LOOK_GROUPS as string[]).includes(o.group), 'group of ' + o.key);
    if (o.order) ok([...o.order].sort((a, b) => a - b).join() === o.options.map((_, i) => i).join(), 'display order of ' + o.key + ' is a permutation');
    if (o.kind === 'swatch') ok(o.options.every((x) => /^#[0-9a-f]{6}$/.test(x.colour ?? '')), 'swatch colours of ' + o.key);
  }
  ok(LOOK_GROUPS.every((g) => LOOK_OPTIONS.some((o) => o.group === g)), 'every group has controls');
  for (let i = 0; i < 50; i++) {
    let n = i + 1; const rand = () => (n = (n * 16807) % 2147483647) / 2147483647;
    const lk = randomLook(rand);
    for (const o of LOOK_OPTIONS) { const v = (lk as Record<string, unknown>)[o.key]; ok(typeof v === 'number' && v >= 0 && v < o.options.length && Number.isInteger(v), 'randomLook ' + o.key + '=' + v); }
    ok(typeof lk.seed === 'string', 'randomLook gives a seed');
    // a shuffled face hangs together: an Afro only on tight curls, curls only on curly hair
    ok(lk.style !== 10 || lk.texture === 3, 'randomLook: an Afro has tight curls');
    ok(lk.texture !== 3 || ![5, 9, 12].includes(lk.style!), 'randomLook: tight curls are never greased into a pompadour, ducktail or blow-dry');
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
  // (V92: textures, fitted hats, eye clipping and jewellery cost about 0.7 KB a face over the V88 budget of 6 KB)
  ok(total / 300 < 7 * 1024, 'average size under 7 KB');
  ok(max < 10 * 1024, 'largest under 10 KB');
  ok(!cs.some((c) => /<filter|feTurbulence/.test(portrait(c))), 'no SVG filters');
});

section('8. Deterministic without Math.random, for every option', () => {
  const real = Math.random;
  Math.random = () => { throw new Error('Math.random called while painting'); };
  try {
    for (const o of LOOK_OPTIONS) for (let v = 0; v < o.options.length; v++) for (const r of ['associate', 'boss'] as Rank[]) {
      const look = { seed: 'd' + v, [o.key]: v } as LookX;
      const a = norm(portrait(mk('p', MAN, r, look))), b = norm(portrait(mk('p', MAN, r, JSON.parse(JSON.stringify(look)))));
      ok(a === b, `${o.key}=${v} ${r}: same look, same face (and a saved-and-loaded look paints the same)`);
    }
    for (let i = 0; i < 60; i++) ok(norm(portrait(mk('n' + i, i % 4 ? MAN : WOMAN, RANKS[i % 6]))) === norm(portrait(mk('n' + i, i % 4 ? MAN : WOMAN, RANKS[i % 6]))), 'npc n' + i);
  } catch (e) { ok(false, String(e)); } finally { Math.random = real; }
});

section('9. An old look is still a whole face', () => {
  const OLD: LookX[] = [{ skin: 1, hairColour: 1, style: 0, beard: 0, glasses: 0, jaw: 1, seed: 'you1' }, { skin: 5, hairColour: 4, style: 3, beard: 5, glasses: 2, jaw: 0, seed: 'you77' }, { seed: 'bare' }, {}];
  for (const lk of OLD) for (const r of RANKS) {
    const R = resolveLook(mk('p1', MAN, r, lk)) as unknown as Record<string, unknown>;
    for (const o of LOOK_OPTIONS) { const v = R[o.key]; ok(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < o.options.length, `${JSON.stringify(lk)} ${r}: ${o.key} resolved (${v})`); }
    for (const k of ['skin', 'hairColour', 'style', 'beard', 'glasses', 'jaw'] as const) if (lk[k] != null) ok(R[k] === lk[k], `${k} keeps its saved value`);
  }
  // a player with an old look keeps exactly the face he had: the new fields fall back to his seed, and do not move
  const a = norm(portrait(mk('p1', MAN, 'capo', OLD[0]))), b = norm(portrait(mk('p1', MAN, 'capo', { ...OLD[0] })));
  ok(a === b, 'old look paints the same twice');
});

// The renderer before the V92 rework, its seeded channels copied here: a man from an older save, who has no stored look, must
// keep the complexion, jaw, haircut, beard and eyewear the old dice gave him (newer cuts only stand in within the same family).
const oldHash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const oldMk = (id: string) => { const s = oldHash(id); return (i: number) => { let x = (s + Math.imul(i + 1, 0x9e3779b9)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }; };
const oldW = (r: number, ws: number[]) => { let x = r * ws.reduce((a, b) => a + b, 0); for (let k = 0; k < ws.length; k++) { x -= ws[k]; if (x < 0) return k; } return ws.length - 1; };
section('10. NPCs from older saves keep the face the old dice gave them', () => {
  const FAM: Record<string, Record<number, number[]>> = { style: { 0: [0, 9], 4: [4, 12, 13], 8: [8, 12], 2: [2, 11], 7: [7, 13], 6: [6, 10] }, beard: { 1: [1, 7, 8, 9], 3: [3, 10], 6: [6, 11] }, glasses: { 1: [1, 5, 7], 4: [4, 6] } };
  let changed = 0;
  for (let i = 0; i < 400; i++) {
    const id = 'c' + i, r = oldMk(id), gr = oldMk(id + 'g');
    const age = oldW(r(2), [2.6, 3.2, 2.4, 1.4]);
    const old = {
      skin: oldW(r(1), [1.2, 2, 2.4, 1.4, 0.6, 0.4]), jaw: oldW(r(5), [1, 1.2, 1]),
      style: oldW(r(11), age >= 2 ? [3, 0.4, 2.4, 1, 2.4, 0.4, 0.5, 1.2, 0.2] : [3, 1, 0.3, 0.1, 2.4, 1.3, 1.2, 0.8, 1.2]),
      beard: oldW(r(12), [12, 3.4, 2, 0.5, 1.4, 0.4, 0.5]), glasses: oldW(gr(0), age >= 2 ? [80, 8, 3, 7, 2] : [90, 3, 3, 2, 2]),
    };
    const now = resolveLook(mk(id, MAN, RANKS[i % 6]));
    ok(now.skin === old.skin && now.jaw === old.jaw && now.age === age, `${id}: complexion, jaw and age as before`);
    for (const k of ['style', 'beard', 'glasses'] as const) {
      const fam = FAM[k][old[k]] ?? [old[k]];
      ok(fam.includes(now[k]), `${id}: ${k} ${now[k]} is of the old ${k} ${old[k]}'s kind`);
      if (now[k] !== old[k]) changed++;
    }
  }
  ok(changed > 20 && changed < 200, `the newer cuts, beards and frames appear among NPCs, but rarely replace (${changed} of 1200)`);
});

section('11. Parts fit the face: hats over every haircut, on every head', () => {
  for (let hat = 1; hat <= 5; hat++) for (let st = 0; st < 14; st++) for (const head of [0, 1, 2, 3, 4]) for (const build of [0, 3]) {
    const lk: LookX = { seed: 'f' + st, hat, style: st, head, build, texture: st === 10 ? 3 : 0, hairLen: 2 };
    const p = portraitParts(mk('p', MAN, 'capo', lk));
    const f = p.fit, tag = `hat ${hat} style ${st} head ${head} build ${build}`;
    ok(f.hatTop != null && f.hatTop <= f.skullTop - 0.9, `${tag}: the crown clears the top of the skull`);
    ok(f.crown != null && f.skullAtBand != null && f.crown >= f.skullAtBand + 0.4, `${tag}: the crown is wider than the skull at the band`);
    ok(f.band != null && f.band <= f.browY - 1.5, `${tag}: the hat sits above the brows`);
    ok(f.vy <= (f.hatTop ?? 0) - 0.4, `${tag}: the hat is inside the frame`);
    ok(/clip-path="url\(#x_hc\)"/.test(p.hair) && p.defs.includes('<clipPath id="x_hc"><path d="M0 ' + fmt(f.band! - (hat === 3 ? 0.4 : hat === 5 ? -0.4 : 0.2))), `${tag}: the hair is clipped below the brim`);
  }
  for (let st = 0; st < 14; st++) for (const head of [0, 1, 2, 3, 4]) {
    const f = portraitParts(mk('p', MAN, 'associate', { seed: 'h', style: st, head, hat: 0, texture: st === 10 ? 3 : 0 })).fit;
    ok(f.vy <= f.hairTop - 0.4, `style ${st} head ${head}: the hair is inside the frame`);
    ok(f.earY - f.earRy <= f.browY + 1.2 && f.earY + f.earRy >= f.noseY - 0.6, `head ${head}: the ears run from the brow to the nose`);
    ok(f.mouthY > f.noseY + 2.5 && f.mouthY < f.chin - 2, `head ${head}: the mouth sits between the nose and the chin`);
  }
});

section('12. His rank sets how formal his own taste has to be', () => {
  const F: Record<string, number> = { leather: 0, track: 0, sport: 0, turtleneck: 0, bomber: 0, cardigan: 0, windbreaker: 0, suitOpen: 1, suitTurtle: 1, carcoat: 1, suitTie: 2, threePiece: 3, overcoat: 3 };
  const FLOOR: Record<Rank, number> = { civilian: 0, associate: 0, soldier: 1, capo: 2, underboss: 3, boss: 3 };
  for (let o = 0; o < OUTFITS.length; o++) for (const r of RANKS) {
    const g = portraitParts(mk('p', MAN, r, { seed: 'o', outfit: o })).garment;
    ok(F[g] != null && F[g] >= FLOOR[r] - (r === 'capo' && g === 'suitTurtle' ? 1 : 0), `${OUTFITS[o].label} at ${r}: ${g} is formal enough`);
    if (r === 'associate') ok(F[g] <= 2, `${OUTFITS[o].label}: an associate is never overdressed (${g})`);
    if (OUTFITS[o].f >= FLOOR[r] && !(r === 'associate' && OUTFITS[o].f > 2)) ok(F[g] === OUTFITS[o].f, `${OUTFITS[o].label} at ${r} is worn as chosen`);
  }
  // NPCs: the street for associates, a tie from capo up
  for (let i = 0; i < 40; i++) {
    ok(F[portraitParts(mk('n' + i, MAN, 'associate')).garment] === 0, 'npc associates dress for the street');
    ok(F[portraitParts(mk('n' + i, MAN, 'capo')).garment] >= 2 && F[portraitParts(mk('n' + i, MAN, 'boss')).garment] === 3, 'npc capos wear ties, bosses three pieces');
  }
});
const fmt = (x: number) => { const r = Math.round(x * 10) / 10; return r === 0 ? '0' : String(r).replace(/^(-?)0\./, '$1.'); };
