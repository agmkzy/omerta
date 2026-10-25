// The portrait regression gallery. Run: npx tsx docs/portraits/build.ts
// Writes two static pages next to this file:
//   gallery.html  - every option of the painter, in the grids that catch fitting defects (hair under every hat, every face
//                   shape in every complexion, facial hair on every jaw, clothes at every rank, extremes, every game size)
//   compare.html  - the same seeded characters painted by the renderer before the rework (git show <base>:src/ui/portrait.ts)
//                   beside the current one
// Both are deterministic: the same code paints the same pages.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAIR_LIST, LOOK_OPTIONS, OUTFITS, portrait, resolveLook, SKIN_LIST, type LookX } from '../../src/ui/portrait';
import { S } from '../../src/ui/state';
import type { Character, Rank } from '../../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const RANKS: Rank[] = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const traits = { greed: 0.5, violence: 0.5, ambition: 0.5, caution: 0.5, sociability: 0.5, vice: 0.3, courage: 0.5 };
const man = (id: string, rank: Rank = 'associate', look?: LookX, extra: Partial<Character> = {}) =>
  ({ id, name: 'Tony Marino', rank, traits: { ...traits }, look, hurtUntil: 0, familyId: null, ...extra }) as unknown as Character;
const woman = (id: string, rank: Rank = 'civilian') => ({ ...man(id, rank), name: 'Rosa Marino' }) as Character;
const label = (key: string, v: number) => LOOK_OPTIONS.find((o) => o.key === key)!.options[v]?.label ?? String(v);
const escH = (t: string) => t.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

// One cell: the portrait at a size, square like the creator preview or round like the game's avatars.
type Paint = (c: Character) => string;
const cell = (svg: string, cap = '', size = 120, round = false) => `<figure class="c${round ? ' r' : ''}" style="--s:${size}px"><div class="p">${svg}</div>${cap ? `<figcaption>${escH(cap)}</figcaption>` : ''}</figure>`;
const row = (title: string, cells: string[], note = '') => `<section><h3>${escH(title)}</h3>${note ? `<p class="n">${escH(note)}</p>` : ''}<div class="g">${cells.join('')}</div></section>`;
const page = (title: string, intro: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
:root{color-scheme:dark;--bg:#121110;--ink:#e9e1cf;--mut:#9a907e;--line:#2c2723}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:20px 16px 60px}
h1{font:600 22px Georgia,serif;margin:0 0 4px}h2{font:600 17px Georgia,serif;margin:34px 0 6px;padding-top:14px;border-top:1px solid var(--line)}h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:18px 0 8px}
p{max-width:820px;color:var(--mut)}.n{margin:-4px 0 8px;font-size:12px}
.g{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
figure.c{margin:0;width:calc(var(--s) * var(--k,1));display:flex;flex-direction:column;gap:3px}
.p{width:calc(var(--s) * var(--k,1));height:calc(var(--s) * var(--k,1));background:#0b0a09;border:1px solid #2c2723;overflow:hidden}
.p svg{display:block;width:100%;height:100%}
.game .p svg{filter:sepia(.28) saturate(.82) contrast(1.04)}
figure.r .p{border-radius:50%}
figcaption{font-size:10.5px;color:var(--mut);line-height:1.25;word-break:break-word}
.pair{display:flex;gap:6px;padding:6px;border:1px solid var(--line);border-radius:4px}
.pair b{display:block;font-size:10px;color:var(--mut);font-weight:500;margin-bottom:2px}
label{display:inline-flex;gap:6px;align-items:center;color:var(--mut);margin:6px 0}
</style></head><body><h1>${title}</h1><p>${intro}</p>
<label>Zoom <input type="range" id="zoom" min="1" max="4" step=".5" value="1"></label> &nbsp; <label><input type="checkbox" id="game" checked> Show with the game's avatar filter (sepia, as <code>.avatar.pt svg</code> draws them)</label>
<div id="all" class="game">${body}</div>
<script>document.getElementById('zoom').addEventListener('input',function(e){document.documentElement.style.setProperty('--k',e.target.value)});document.getElementById('game').addEventListener('change',function(e){document.getElementById('all').classList.toggle('game',e.target.checked)})</script>
</body></html>`;

// ------------------------------------------------------------------ the gallery
function gallery(P: Paint): string {
  let h = '';
  const base: LookX = { seed: 'g1', skin: 2, hairColour: 1, age: 1, build: 1, head: 0, jaw: 1, beard: 0, glasses: 0, habit: 0, mark: 0, hat: 0, jewel: 0, outfit: 0, outfitColour: 1, shirt: 0, tie: 0 };
  const L = (o: LookX, rank: Rank = 'associate') => P(man('p', rank, { ...base, ...o }));

  // every size the game draws
  h += '<h2>Every size the game shows</h2><p>36–44 px: top bar, list rows, family-tree nodes. 48–64 px: rail and rows. 88–120 px: person page, conversation header. 176–380 px: the creation preview. Avatars in the game are round.</p>';
  const sample = [man('c12', 'boss'), man('c40', 'capo'), man('c77', 'soldier'), man('c3', 'associate'), man('c91', 'civilian'), woman('c5')];
  for (const sz of [36, 44, 48, 64, 88, 120]) h += row(`${sz} px`, sample.map((c) => cell(P(c), '', sz, true)));
  h += row('176 px and 380 px (creation preview)', [cell(L({ style: 4, beard: 1, glasses: 3, outfit: 0 }), '', 176), cell(L({ style: 5, hat: 0, outfit: 7, outfitColour: 2, jewel: 1 }), '', 380)]);

  // hair under every hat, with a pair of glasses cycling through the rows
  h += '<h2>Every haircut under every hat</h2><p>Hair must never show through a crown; it shows only below the brim. Glasses cycle so every frame meets every hat.</p>';
  const hats = [0, 1, 2, 3, 4, 5];
  for (let st = 0; st < 14; st++) h += row(label('style', st), hats.map((ht, i) => cell(L({ style: st, hat: ht, glasses: (st + i) % 8, hairLen: st % 3, texture: st === 10 ? 3 : st === 6 ? 2 : 0 }), `${label('hat', ht)} · ${label('glasses', (st + i) % 8)}`, 110)));

  // hairline x length x texture on a plain cut
  h += '<h2>Hairline, length and texture</h2>';
  for (let tx = 0; tx < 4; tx++) h += row(label('texture', tx), [0, 1, 2, 3].flatMap((hl) => [0, 2].map((ln) => cell(L({ style: tx === 3 ? 7 : 4, texture: tx, hairline: hl, hairLen: ln, hairColour: tx + 1 }), `${label('hairline', hl)} · ${label('hairLen', ln)}`, 96))));
  h += row('Hair colours', HAIR_LIST.map((_, i) => cell(L({ style: 12, hairColour: i, age: i === 8 ? 2 : 1 }), label('hairColour', i), 96)));

  // face shapes in every complexion
  h += '<h2>Every face shape in every complexion</h2>';
  for (let hd = 0; hd < 5; hd++) h += row(label('head', hd), SKIN_LIST.map((_, sk) => cell(L({ head: hd, skin: sk, jaw: hd % 3, style: [0, 4, 12, 13, 7][hd], hairColour: sk >= 8 ? 0 : sk % 4, texture: sk === 5 || sk === 9 ? 3 : 0 }), label('skin', sk), 96)));
  h += row('Build', [0, 1, 2, 3].map((b) => cell(L({ build: b, style: 0 }, 'capo'), label('build', b), 110)));
  h += row('Age', [0, 1, 2, 3].map((a) => cell(L({ age: a, style: 4, hairColour: undefined as unknown as number }), label('age', a), 110)));

  // features
  h += '<h2>Features</h2>';
  h += row('Eyes', [0, 1, 2, 3, 4].map((e) => cell(L({ eyes: e, iris: e + 1 }), `${label('eyes', e)} · ${label('iris', e + 1)}`, 110)));
  h += row('Brows', [0, 1, 2, 3, 4, 5].map((b) => cell(L({ brows: b }), label('brows', b), 110)));
  h += row('Noses', [0, 1, 2, 3, 4, 5, 6, 7].map((n) => cell(L({ nose: n }), label('nose', n), 110)));
  h += row('Mouths', [0, 1, 2, 3, 4].map((m) => cell(L({ mouth: m }), label('mouth', m), 110)));
  h += row('Marks', [0, 1, 2, 3, 4, 5, 6].map((m) => cell(L({ mark: m, skin: 1 }), label('mark', m), 110)));

  // facial hair on every jaw, with the mouths cycling
  h += '<h2>Facial hair on every jaw and mouth</h2>';
  for (let b = 0; b < 12; b++) h += row(label('beard', b), [0, 1, 2].flatMap((j) => [b % 5, (b + 2) % 5].map((m) => cell(L({ beard: b, jaw: j, mouth: m, head: (b + j) % 5, build: j + 1, hairColour: b % 2 ? 0 : 3, age: b === 9 ? 2 : 1 }), `${label('jaw', j)} jaw · ${label('mouth', m)}`, 96))));

  // clothes: the player's taste at every rank
  h += '<h2>Clothes: his taste, dressed for his rank</h2><p>Each row is one choice of clothes; each column a rank. Below a rank\'s floor the same taste is dressed up (a leather jacket becomes a car coat over a suit), and an associate is never overdressed.</p>';
  for (let o = 0; o < OUTFITS.length; o++) h += row(OUTFITS[o].label, RANKS.map((r) => cell(L({ outfit: o, outfitColour: (o * 5) % 12, shirt: (o * 3) % 10, tie: o % 8, style: 4 }, r), r, 96)));
  h += row('Colours (leather jacket)', Array.from({ length: 12 }, (_, i) => cell(L({ outfit: 0, outfitColour: i, shirt: i % 10 }), label('outfitColour', i), 84)));
  h += row('Shirts (suit, open collar)', Array.from({ length: 10 }, (_, i) => cell(L({ outfit: 7, outfitColour: 0, shirt: i }, 'soldier'), label('shirt', i), 84)));
  h += row('Ties (suit and tie)', Array.from({ length: 8 }, (_, i) => cell(L({ outfit: 8, outfitColour: 2, shirt: 0, tie: i }, 'capo'), label('tie', i), 84)));

  // accessories
  h += '<h2>Eyewear, jewellery, habits</h2>';
  h += row('Eyewear', Array.from({ length: 8 }, (_, g) => cell(L({ glasses: g, style: 4 }), label('glasses', g), 110)));
  h += row('Jewellery, open collar', [0, 1, 2, 3, 4].map((j) => cell(L({ jewel: j, outfit: 2, outfitColour: 6 }), label('jewel', j), 110)));
  h += row('Jewellery, turtleneck and tie', [1, 2, 3, 4].flatMap((j) => [cell(L({ jewel: j, outfit: 3, outfitColour: 1 }), label('jewel', j) + ' · turtleneck', 96), cell(L({ jewel: j, outfit: 8 }, 'capo'), label('jewel', j) + ' · tie', 96)]));
  h += row('Habits', [0, 1, 2, 3, 4].map((x) => cell(L({ habit: x, outfit: 2 }), label('habit', x), 110)));

  // NPCs as the world makes them
  h += '<h2>NPCs as the world deals them</h2><p>No look stored: everything comes from the id, coherent with rank (dress), age and complexion.</p>';
  for (const r of RANKS) h += row(r, Array.from({ length: 16 }, (_, i) => cell(P(man('n' + (i * 53 + r.length * 7), r)), '', 88)));
  h += row('women', Array.from({ length: 16 }, (_, i) => cell(P(woman('w' + i * 31, i % 5 === 4 ? 'capo' : 'civilian')), '', 88)));

  // civilians by trade
  const kinds = ['butcher', 'deli', 'fish', 'grocer', 'bakery', 'barber', 'garage', 'pharmacy', 'bar', 'tailor', 'funeral', 'jeweller', 'hardware', 'newsstand', 'pawnshop', 'restaurant', 'diner', 'cafe'];
  const w = { now: 0, biz: Object.fromEntries(kinds.map((k, i) => ['b' + i, { id: 'b' + i, kind: k, ownerId: 'o' + i }])) };
  (S as unknown as { w: unknown }).w = w;
  h += row('Civilians by trade (the business they own)', kinds.map((k, i) => cell(P(man('o' + i, 'civilian')), k, 96)));
  h += row('Day jobs', (['bartender', 'driver', 'doorman', 'porter'] as const).map((k) => cell(P(man('j' + k, 'civilian', undefined, { job: { kind: k } } as never)), k, 96)));
  (S as unknown as { w: unknown }).w = { now: 100, biz: {} };
  h += row('Hurt', RANKS.map((r) => cell(P(man('h' + r, r, undefined, { hurtUntil: 200 })), r, 96)));
  (S as unknown as { w: unknown }).w = null;

  // extremes
  h += '<h2>Extreme combinations</h2>';
  const X: [string, LookX, Rank][] = [
    ['Afro, homburg, full beard, aviators, heavy', { style: 10, texture: 3, hat: 4, beard: 6, glasses: 4, build: 3, skin: 9, hairLen: 2 }, 'boss'],
    ['Pompadour, fedora, chevron, long face', { style: 5, hat: 1, beard: 8, head: 2, jaw: 2 }, 'soldier'],
    ['Shaggy, long, flat cap, round wire', { style: 8, hairLen: 2, hat: 3, glasses: 7, beard: 9 }, 'associate'],
    ['Long hair, watch cap, mutton chops', { style: 1, hairLen: 2, hat: 5, beard: 5 }, 'associate'],
    ['Bald, old, heavy, cigar, broad', { style: 3, age: 3, build: 3, habit: 3, head: 3, jaw: 0 }, 'boss'],
    ['Comb-over, browline, Van Dyke, narrow', { style: 11, age: 3, glasses: 5, beard: 10, head: 4, build: 0 }, 'civilian'],
    ['Curly, tight curls, trilby, horseshoe', { style: 6, texture: 3, hat: 2, beard: 9, skin: 5 }, 'soldier'],
    ['Blow-dried, round face, dark glasses, chain', { style: 12, head: 1, glasses: 2, jewel: 1, outfit: 2 }, 'associate'],
    ['Lean, young, crew cut, pencil moustache', { style: 7, age: 0, build: 0, beard: 7, head: 4 }, 'capo'],
    ['Old, white hair, horn-rims, overcoat', { style: 2, age: 3, hairColour: 9, glasses: 3, outfit: 11 }, 'underboss'],
    ['Ducktail, widow\'s peak, sideburns, leather', { style: 9, hairline: 1, beard: 4, hairLen: 2, outfit: 0 }, 'associate'],
    ['Afro under a flat cap', { style: 10, texture: 3, hat: 3, skin: 5, hairLen: 2 }, 'associate'],
  ];
  h += row('Pushing the fit', X.map(([t, o, r]) => cell(L(o, r), t, 140)));
  return h;
}

// ------------------------------------------------------------------ old against new
async function legacy(): Promise<Paint> {
  const ref = execSync('git merge-base HEAD main', { cwd: root }).toString().trim();
  let src = execSync(`git show ${ref}:src/ui/portrait.ts`, { cwd: root, maxBuffer: 1 << 24 }).toString();
  const abs = (p: string) => resolve(root, 'src/ui', p).replace(/\\/g, '/');
  src = src.replace(/from '(\.\.?\/[^']+)'/g, (_m, p) => `from '${abs(p)}'`);
  const dir = resolve(here, '.legacy');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, '.gitignore'), '*\n');
  writeFileSync(resolve(dir, 'portrait_old.ts'), `// generated from ${ref}:src/ui/portrait.ts by docs/portraits/build.ts\n` + src);
  const mod = await import(resolve(dir, 'portrait_old.ts'));
  return mod.portrait as Paint;
}

function compare(oldP: Paint, newP: Paint): string {
  let h = '';
  const pair = (c: Character, sz: number) => `<div class="pair"><div><b>before</b>${cell(oldP(c), '', sz, sz < 88)}</div><div><b>after</b>${cell(newP(c), '', sz, sz < 88)}</div></div>`;
  h += '<h2>NPCs from the world (no stored look)</h2><p>Complexion, hair colour, haircut, beard, glasses and jaw come from the same seeded channels as before, so each man is recognisably the same person; the rest is new and also seeded.</p>';
  for (const r of RANKS) h += row(r, Array.from({ length: 8 }, (_, i) => pair(man('c' + (i * 37 + r.length), r), 120)));
  h += row('women', Array.from({ length: 6 }, (_, i) => pair(woman('w' + i * 13), 120)));
  h += '<h2>Saved players (only the original look fields)</h2><p>Old saves store skin, hairColour, style, beard, glasses, jaw and a seed. Those keep their meaning.</p>';
  const OLD: LookX[] = [
    { skin: 1, hairColour: 1, style: 0, beard: 0, glasses: 0, jaw: 1, seed: 'you1' },
    ...Array.from({ length: 7 }, (_, i) => ({ skin: i % 6, hairColour: 5 - (i % 6), style: i % 4, beard: i % 6, glasses: i % 3, jaw: i % 3, seed: 'you' + i * 7 })),
  ];
  for (const r of ['associate', 'capo'] as Rank[]) h += row('player · ' + r, OLD.map((lk) => pair(man('player', r, lk), 120)));
  h += row('V88 looks (with build, nose, brows, age, mark, habit)', Array.from({ length: 8 }, (_, i) => pair(man('player', 'soldier', { skin: i % 6, hairColour: i % 6, style: i, beard: i % 7, glasses: i % 5, jaw: i % 3, build: i % 4, nose: i % 5, brows: i % 4, age: i % 4, mark: i % 5, habit: i % 5, seed: 'v' + i }), 120)));
  h += row('At list size (44 px)', Array.from({ length: 10 }, (_, i) => pair(man('c' + i * 11, RANKS[i % 6]), 44)));
  return h;
}

const newP: Paint = portrait;
writeFileSync(resolve(here, 'gallery.html'), page('Omertà portraits: gallery', 'Every option of the painted portrait, in the grids that show fitting defects. Generated by <code>npx tsx docs/portraits/build.ts</code>; deterministic.', gallery(newP)));
const oldP = await legacy();
writeFileSync(resolve(here, 'compare.html'), page('Omertà portraits: before and after', 'The same seeded characters painted by the renderer before the rework (left) and now (right).', compare(oldP, newP)));
void resolveLook;
console.log('wrote docs/portraits/gallery.html and docs/portraits/compare.html');
