// Painted, not drawn. Each face comes from the man's id; rank decides what he's wearing.
// The look is a loose oil sketch: colour in the shadows, rough edges, a canvas under it all.
import { Character, Look, Rank } from '../types';
import { famClass } from './links';
import { W } from './links';
import { PACK } from './portraits_pack';
import { FEMALE } from '../world';
const isFem = (c: Character) => FEMALE.includes(c.name.split(' ')[0]);
const FSUIT = ['#8a4a58', '#4f6b7a', '#7a6a8f', '#a0714e', '#5d7a64', '#9a3f4a', '#c9b79a', '#2f3a52'];
const FHAIR = ['#17120f', '#2a1c14', '#412a1b', '#6a3b22', '#8a5a2a', '#b08a4a', '#1b1b1f'];

const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const mk = (id: string) => { const s = hashOf(id); return (i: number) => { let x = (s + Math.imul(i + 1, 0x9e3779b9)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }; };
const pick = <T,>(r: number, a: T[]) => a[Math.min(a.length - 1, Math.floor(r * a.length))];

// ---- colour
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
const shadowOf = (c: string, t = 0.5) => mix(c, '#4a2a5a', t); // shadows go violet, never grey
const warmOf = (c: string, t = 0.4) => mix(c, '#ffd9a0', t);

export const SKIN_LIST = ['#efc9a6', '#e5b48a', '#d89f77', '#c58a63', '#a86f4c', '#7f503a'];
export const HAIR_LIST = ['#17120f', '#2a1c14', '#412a1b', '#5a3a22', '#6a3b22', '#8c8985'];
const SKIN = ['#efc9a6', '#e5b48a', '#d89f77', '#c58a63', '#a86f4c', '#7f503a'];
const HAIR = ['#17120f', '#2a1c14', '#412a1b', '#5a3a22', '#6a3b22', '#1b1b1f'];
const SUIT: Record<Rank, string[]> = {
  boss: ['#17171e', '#1b1a22'],
  underboss: ['#252831', '#2b2a34'],
  capo: ['#233559', '#34353d', '#3a2f2a'],
  soldier: ['#4d4a50', '#5a4538', '#3e5250', '#4e3c34'],
  associate: ['#c4912f', '#b0502c', '#76773c', '#47342b', '#2f7373', '#7a3f5c', '#8a877e'],
  civilian: ['#6f7f91', '#8d7c66', '#6c836b', '#9c9183'],
};
const TIE = ['#8a1624', '#64203a', '#233a68', '#8a6416', '#2f5a45', '#52264c'];

const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
export function portrait(c: Character): string {
  if (PACK.length) return packed(c);
  const lk: Look | undefined = c.look;
  const r = mk(lk?.seed ?? c.id);
  const uid = 'p' + hashOf(c.id).toString(36);
  const rank = c.rank;
  const fem = isFem(c);
  const hurt = safe(() => W().now < c.hurtUntil, false);
  const rankN = { civilian: 0, associate: 1, soldier: 2, capo: 3, underboss: 4, boss: 5 }[rank];
  const T = c.traits;
  const skin = lk?.skin != null ? SKIN[lk.skin] : pick(r(1), [SKIN[0], SKIN[1], SKIN[1], SKIN[2], SKIN[2], SKIN[3], SKIN[4], SKIN[5]]);
  const skinSh = shadowOf(skin, 0.55);
  const skinHi = warmOf(skin, 0.5);
  const age = Math.min(1, r(2) * 0.6 + rankN * 0.07);
  const base = lk?.hairColour != null ? HAIR_LIST[lk.hairColour] : pick(r(3), fem ? FHAIR : HAIR);
  const hair = lk?.hairColour != null ? base : age > 0.8 ? '#cdc8bd' : age > 0.62 ? '#8c8985' : base;
  const hairSh = shadowOf(hair, 0.5);
  const hairHi = mix(hair, '#e6cfa5', 0.35);
  // 0 slicked, 1 long, 2 receding, 3 bald. Older men go thin on top; most of the city slicks it back.
  const sr = r(5);
  const style = fem ? Math.min(3, Math.floor(r(5) * 4)) : lk?.style != null ? Math.max(0, Math.min(3, lk.style)) : age > 0.5 && sr < 0.4 ? 2 : sr < 0.1 + age * 0.1 ? 3 : sr < 0.72 ? 0 : sr < 0.88 ? 2 : 1;
  const bald = style === 3 && !fem;
  const L = r(30) < 0.5 ? -1 : 1; // which side the light comes from
  const fw = fem ? 9.6 + r(6) * 2 : 10.8 + r(6) * 2.8 + rankN * 0.4;
  const fh = 13.4 + r(7) * 1.8;
  const jaw = fem ? 3.4 + r(25) * 1.8 : lk?.jaw != null ? (lk.jaw === 0 ? 9.5 : lk.jaw === 1 ? 7 : 4.4) : 4.2 + (1 - Math.min(1, T.violence)) * 6.2;
  const x0 = 32 - fw, x1 = 32 + fw;
  const top = 29 - fh;
  const chin = top + 2 * fh;
  const suit = fem ? pick(r(8), FSUIT) : pick(r(8), SUIT[rank]);
  const suitSh = shadowOf(suit, 0.6), suitHi = warmOf(suit, 0.22);
  const tie = pick(r(9), TIE);
  const fam = safe(() => famClass(c.familyId), 'fx');
  const lit = L < 0 ? x0 : x1, dim = L < 0 ? x1 : x0;
  let b = ''; // background
  let f = ''; // figure
  let o = ''; // overlays

  // ---------------------------------------------------------- the room behind him
  b += `<rect width="64" height="64" fill="url(#${uid}bg)"/>`;
  b += `<ellipse cx="${32 - L * 16}" cy="22" rx="24" ry="28" fill="#e4dfd2" opacity=".4" filter="url(#${uid}blur)"/>`; // the one lamp in the room
  for (let i = 0; i < 3; i++) b += `<path d="M${r(40 + i) * 70 - 6} ${14 + r(44 + i) * 34} q${12 - r(48 + i) * 24} ${-6} ${r(52 + i) * 30 - 6} ${-2}" stroke="#bfb8aa" stroke-width="${4 + r(56 + i) * 5}" fill="none" opacity=".1" stroke-linecap="round" filter="url(#${uid}blur)"/>`; // smoke
  b += `<rect y="36" width="64" height="28" fill="url(#${uid}fl)"/>`;

  // ---------------------------------------------------------- shoulders and what covers them
  const sw = rankN * 0.6;
  f += `<path d="M${2 - sw} 64 Q5 46.5 32 45 Q59 46.5 ${62 + sw} 64Z" fill="${suit}"/>`;
  f += `<path d="M${dim === x0 ? 2 - sw : 62 + sw} 64 Q${dim === x0 ? 5 : 59} 46.5 32 45 L32 64Z" fill="${suitSh}" opacity=".6" filter="url(#${uid}blur)"/>`;
  f += `<path d="M${lit === x0 ? 6 : 58} 50 Q${lit === x0 ? 12 : 52} 46.5 ${lit === x0 ? 22 : 42} 45.6" stroke="${suitHi}" stroke-width=".9" fill="none" opacity=".4" stroke-linecap="round"/>`;
  if (fem) {
    const hl = style === 1 ? 52 : style === 2 ? 41 : style === 0 ? 38 : 33;
    const wd = style === 1 ? 6.4 : style === 2 ? 5.6 : style === 0 ? 5 : 3;
    f += `<path d="M${x0 - 2} 22 C${x0 - wd - 1} 32 ${x0 - wd} ${hl - 6} ${x0 - wd + 2} ${hl} Q32 ${hl + (style === 2 ? 3 : 1.4)} ${x1 + wd - 2} ${hl} C${x1 + wd} ${hl - 6} ${x1 + wd + 1} 32 ${x1 + 2} 22Z" fill="${hairSh}"/>`;
  }
  if (style === 1 && !fem) f += `<path d="M${x0 - 2} 24 C${x0 - 6.6} 34 ${x0 - 6} 43 ${x0 - 3.4} 48.6 Q${x0 - .4} 50.4 ${x0 + 3.6} 47 L${x1 - 3.6} 47 Q${x1 + .4} 50.4 ${x1 + 3.4} 48.6 C${x1 + 6} 43 ${x1 + 6.6} 34 ${x1 + 2} 24Z" fill="${hairSh}"/><path d="M${x0 - 3} 36 Q${x0 - 3.4} 44 ${x0 - 1} 50 M${x1 + 3} 36 Q${x1 + 3.4} 44 ${x1 + 1} 50" stroke="${hair}" stroke-width="1" fill="none" opacity=".5"/>`;
  // neck, with the jaw's shadow thrown down it
  f += `<path d="M27 36 L27.4 46 Q32 49 36.6 46 L37 36Z" fill="${skin}"/><path d="M27 36 L27.4 46 Q32 49 36.6 46 L37 36Z" fill="${skinSh}" opacity=".5"/>`;
  f += `<ellipse cx="32" cy="${chin - .2}" rx="${jaw + 3}" ry="3.2" fill="${shadowOf(skin, 0.75)}" opacity=".75" filter="url(#${uid}blur)"/>`;
  const shirtOn = (rankN >= 3) || (rank === 'soldier' && r(10) < 0.55);
  if (fem) {
    f += `<path d="M23.6 45.4 Q32 57.6 40.4 45.4Z" fill="${skin}"/><path d="M23.6 45.4 Q32 57.6 40.4 45.4Z" fill="${skinSh}" opacity=".35"/>`;
    f += `<path d="M22.4 46.6 Q32 59 41.6 46.6" stroke="${suitHi}" stroke-width="1.4" fill="none" opacity=".5"/><path d="M21 47.4 L29 51.6 L31 64 L19 64Z M43 47.4 L35 51.6 L33 64 L45 64Z" fill="${suitSh}" opacity=".5"/>`;
    if (r(14) < 0.65) for (let i = 0; i < 9; i++) { const tt = i / 8; const px = 25.4 + tt * 13.2, py = 47.2 + Math.sin(tt * Math.PI) * 5.6; f += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r=".95" fill="#efe9dc"/><circle cx="${(px - .25).toFixed(2)}" cy="${(py - .3).toFixed(2)}" r=".3" fill="#fff" opacity=".8"/>`; }
  } else if (shirtOn) {
    f += `<path d="M25.4 45.4 L32 59 L38.6 45.4Z" fill="#ece6d8"/><path d="M${dim === x0 ? 25.4 : 32} 45.4 L32 59 L${dim === x0 ? 32 : 38.6} 45.4Z" fill="${shadowOf('#ece6d8', 0.4)}" opacity=".6"/>`;
    f += `<path d="M25.8 45 L30.6 47.4 L29 50.4Z M38.2 45 L33.4 47.4 L35 50.4Z" fill="#fbf8ef"/>`;
    if (rank !== 'soldier' || r(11) < 0.6) f += `<path d="M31 47.2 L33 47.2 L33.9 50.2 L32.9 60 L32 62.4 L31.1 60 L30.1 50.2Z" fill="${tie}"/><path d="M32 47.4 L32.9 50.2 L32.5 60 L32 62Z" fill="${shadowOf(tie, .5)}" opacity=".7"/>`;
    f += `<path d="M21 47.4 L29.4 50.8 L31 64 L19 64Z M43 47.4 L34.6 50.8 L33 64 L45 64Z" fill="${suitSh}" opacity=".6"/><path d="M${L < 0 ? 22 : 42} 48 L${L < 0 ? 29 : 35} 51.4" stroke="${suitHi}" stroke-width=".8" opacity=".5"/>`;
    if (rankN >= 3 && r(12) < 0.8) f += `<path d="M38.6 52.4 l3.6 -.6 l.7 2.2 l-4.2 .3z" fill="#efe9dc"/>`;
  } else if (rank === 'soldier') {
    f += `<path d="M26 45.2 L32 55.4 L38 45.2Z" fill="${pick(r(13), ['#e2dac4', '#7d8ea6', '#b9a888'])}"/><path d="M21 47.4 L29.5 51 L31 64 L19 64Z M43 47.4 L34.5 51 L33 64 L45 64Z" fill="${suitSh}" opacity=".55"/>`;
  } else if (rank === 'associate') {
    const kind = Math.floor(r(14) * 3);
    if (kind === 0) {
      const sh = pick(r(15), ['#e6dcc3', '#d8b36a', '#9db3c4', '#c98a7a']);
      f += `<path d="M24 45.4 L32 61 L40 45.4Z" fill="${sh}"/><path d="M${dim === x0 ? 24 : 32} 45.4 L32 61 L${dim === x0 ? 32 : 40} 45.4Z" fill="${shadowOf(sh, .45)}" opacity=".55"/><path d="M24 45.4 L29 49 L26.4 52.4Z M40 45.4 L35 49 L37.6 52.4Z" fill="${warmOf(sh, .5)}" opacity=".9"/>`;
      if (r(16) < 0.6) f += `<path d="M28.4 49.8 Q32 56 35.6 49.8" stroke="#e0bc50" stroke-width="1.1" fill="none"/>`;
    } else if (kind === 1) {
      f += `<rect x="25.6" y="41.4" width="12.8" height="7" rx="3.4" fill="${suit}"/><rect x="25.6" y="41.4" width="12.8" height="2.4" rx="1.2" fill="${suitHi}" opacity=".35"/>`;
    } else {
      f += `<path d="M25 45.4 L32 64 L39 45.4Z" fill="#14121a"/><path d="M32 52 V64" stroke="#8a8794" stroke-width=".8"/><path d="M23.6 45.4 L28 49.4 L30.4 46Z M40.4 45.4 L36 49.4 L33.6 46Z" fill="#2b2833"/><path d="M${L < 0 ? 8 : 56} 52 Q${L < 0 ? 14 : 50} 48 ${L < 0 ? 22 : 42} 46.6" stroke="#6e6a7a" stroke-width="1.2" fill="none" opacity=".6"/>`;
    }
  } else {
    f += `<path d="M26 45.4 L32 52.6 L38 45.4Z" fill="#d6cfbf"/>`;
  }

  // ---------------------------------------------------------- the head
  const hat = !fem && ((rank === 'boss' && r(17) < 0.55) || (rank === 'capo' && r(17) < 0.3) || (rank === 'underboss' && r(17) < 0.2));
  f += `<ellipse cx="${x0 - .2}" cy="29.5" rx="2.4" ry="3.4" fill="${skin}"/><ellipse cx="${x1 + .2}" cy="29.5" rx="2.4" ry="3.4" fill="${skin}"/>`;
  f += `<ellipse cx="${x0 - .2}" cy="29.8" rx="1.1" ry="2" fill="${shadowOf(skin, .7)}" opacity=".6"/><ellipse cx="${x1 + .2}" cy="29.8" rx="1.1" ry="2" fill="${shadowOf(skin, .7)}" opacity=".6"/>`;
  if (fem && r(26) < 0.8) f += `<circle cx="${x0 - .4}" cy="32.4" r="1" fill="#d9b24a"/><circle cx="${x1 + .4}" cy="32.4" r="1" fill="#d9b24a"/>`;
  const headPath = `M${x0} ${top + 11} C${x0} ${top + 3.4} ${x0 + 2.6} ${top} 32 ${top} C${x1 - 2.6} ${top} ${x1} ${top + 3.4} ${x1} ${top + 11} L${x1} 29.5 Q${x1 - .2} ${chin - 3.4} ${32 + jaw} ${chin - .4} Q32 ${chin + 1.8} ${32 - jaw} ${chin - .4} Q${x0 + .2} ${chin - 3.4} ${x0} 29.5Z`;
  f += `<path d="${headPath}" fill="url(#${uid}sk)"/>`;
  f += `<clipPath id="${uid}hc"><path d="${headPath}"/></clipPath><g clip-path="url(#${uid}hc)">`;
  // the shadow side of the face, a plane of violet
  f += `<ellipse cx="${32 + L * 4.5}" cy="${top + 7}" rx="5" ry="3.4" fill="${skinHi}" opacity=".45" filter="url(#${uid}blur)"/>`; // forehead light
  f += `<ellipse cx="${32 + L * 7}" cy="33" rx="3.8" ry="2.6" fill="${skinHi}" opacity=".35" filter="url(#${uid}blur)"/>`; // cheekbone
  f += `<ellipse cx="${32 - L * 7}" cy="34" rx="3.4" ry="2.4" fill="#c4505a" opacity="${(fem ? .26 : .12) + T.vice * .12}" filter="url(#${uid}blur)"/>`; // flush
  f += `<ellipse cx="32" cy="${chin - 1}" rx="${jaw + 2}" ry="2.4" fill="${skinSh}" opacity=".45" filter="url(#${uid}blur)"/>`;
  // eye sockets
  f += `<ellipse cx="26" cy="28.6" rx="4.2" ry="2.9" fill="${skinSh}" opacity=".5" filter="url(#${uid}blur)"/><ellipse cx="38" cy="28.6" rx="4.2" ry="2.9" fill="${skinSh}" opacity=".5" filter="url(#${uid}blur)"/>`;
  // smears of the brush, across the grain of the face
  for (let i = 0; i < 4; i++) f += `<path d="M${x0 + 2 + r(60 + i) * (fw * 2 - 4)} ${top + 3 + r(64 + i) * (fh * 1.6)} q${3 - r(68 + i) * 6} ${2 - r(72 + i) * 4} ${4 - r(76 + i) * 8} ${5 - r(80 + i) * 8}" stroke="${i % 2 ? skinHi : skinSh}" stroke-width="${1.6 + r(84 + i)}" fill="none" opacity=".16" stroke-linecap="round"/>`;
  f += `</g>`;

  // ---------------------------------------------------------- hair, behind the hat
  if (fem) {
    const vol = style === 0 ? 7.4 : style === 3 ? 3.6 : 4.4;
    const out = `M${x0 - 1.8} 31 C${x0 - 3} ${top} ${x0 + 2} ${top - vol} 32 ${top - vol} C${x1 - 2} ${top - vol} ${x1 + 3} ${top} ${x1 + 1.8} 31`;
    const inner = `L${x1 - .8} 26 C${x1 - 1} 22 ${x1 - 4} 19.6 ${32 + 3} 18.6 Q${32 - 6} 19 ${x0 + 3.6} 22.4 Q${x0 + .8} 24 ${x0 + .8} 29Z`;
    const cap = out + inner;
    f += `<path d="${cap}" fill="${hair}"/><clipPath id="${uid}hr"><path d="${cap}"/></clipPath><g clip-path="url(#${uid}hr)"><rect x="${dim === x1 ? 32 : 0}" y="0" width="32" height="40" fill="${hairSh}" opacity=".5"/><path d="M${32 + L * 2} ${top - vol + 1} Q${32 + L * 8} ${top - vol + 2} ${32 + L * 11.4} 24" stroke="${hairHi}" stroke-width="2.2" opacity=".4" fill="none" stroke-linecap="round" filter="url(#${uid}soft)"/>`;
    for (let i = 0; i < 6; i++) f += `<path d="M${x0 + 2 + i * ((fw * 2 - 4) / 5)} 22 Q${32 + (i - 2.5) * 3.2} ${top - 2} ${32 + (i - 2.5) * 5} ${top - vol + 1}" stroke="${hairHi}" stroke-width=".5" fill="none" opacity=".35"/>`;
    f += `</g>`;
    // side curtains framing the face, by style
    const len = style === 1 ? 50 : style === 2 ? 40 : style === 0 ? 35 : 33;
    const cur = `M${x0 - 1.4} 25 C${x0 - 4.6} 31 ${x0 - 4.6} ${len - 5} ${x0 - 2.2 + (style === 2 ? 2.4 : 0)} ${len} L${x0 + 1.8} ${len - 4} C${x0 + .6} ${len - 10} ${x0 + .8} 32 ${x0 + .5} 26.4Z M${x1 + 1.4} 25 C${x1 + 4.6} 31 ${x1 + 4.6} ${len - 5} ${x1 + 2.2 - (style === 2 ? 2.4 : 0)} ${len} L${x1 - 1.8} ${len - 4} C${x1 - .6} ${len - 10} ${x1 - .8} 32 ${x1 - .5} 26.4Z`;
    f += `<path d="${cur}" fill="${hair}"/><clipPath id="${uid}hc2"><path d="${cur}"/></clipPath><g clip-path="url(#${uid}hc2)"><rect x="${dim === x1 ? 32 : 0}" y="0" width="32" height="60" fill="${hairSh}" opacity=".5"/><path d="M${x0 - 2.4} 28 Q${x0 - 3.4} ${len - 8} ${x0 - 1.2} ${len - 2} M${x1 + 2.4} 28 Q${x1 + 3.4} ${len - 8} ${x1 + 1.2} ${len - 2}" stroke="${hairHi}" stroke-width=".6" fill="none" opacity=".35"/></g>`;
    if (style === 3) for (let i = 0; i < 11; i++) { const a = Math.PI * (0.05 + (i / 10) * 0.9); f += `<circle cx="${(32 - Math.cos(a) * (fw + 1.2)).toFixed(2)}" cy="${(top + 9 - Math.sin(a) * (fh + 1.2) * 0.95).toFixed(2)}" r="2.2" fill="${hair}"/><circle cx="${(32 - Math.cos(a) * (fw + 1.2) + L * .5).toFixed(2)}" cy="${(top + 8.4 - Math.sin(a) * (fh + 1.2) * 0.95).toFixed(2)}" r="1" fill="${hairHi}" opacity=".35"/>`; }
    if (style === 0) f += `<ellipse cx="32" cy="${top - vol + 2}" rx="${fw - 3}" ry="2.6" fill="${hairHi}" opacity=".18" filter="url(#${uid}soft)"/>`;
    f += `<path d="M${32 - L * 1.6} 19 Q${32 - L * 5.4} 21 ${32 - L * 8} 27" stroke="${hairSh}" stroke-width=".7" fill="none"/>`;
  } else if (bald) {
    f += `<path d="M${x0 + .1} 30.4 Q${x0 - .8} 25.4 ${x0 + 2.6} 22 Q${x0 + 1.1} 26.4 ${x0 + 1.8} 30.6Z M${x1 - .1} 30.4 Q${x1 + .8} 25.4 ${x1 - 2.6} 22 Q${x1 - 1.1} 26.4 ${x1 - 1.8} 30.6Z" fill="${hairSh}" opacity=".85"/>`;
    f += `<ellipse cx="${32 + L * 3}" cy="${top + 3.4}" rx="4.8" ry="1.7" fill="${skinHi}" opacity=".55" filter="url(#${uid}blur)"/>`;
  } else {
    const out = `M${x0 - 1.2} 28 C${x0 - 1.8} ${top + 2} ${x0 + 2} ${top - 2.8} 32 ${top - 2.8} C${x1 - 2} ${top - 2.8} ${x1 + 1.8} ${top + 2} ${x1 + 1.2} 28`;
    const inner = style === 2
      ? `L${x1 - .5} 25.6 Q${x1 - 1.2} 22.4 ${x1 - 3.2} 21 Q${x1 - 5} 18.2 ${x1 - 7.6} 18.6 Q${x1 - 11} 19.6 32 21.2 Q${x0 + 11} 19.6 ${x0 + 7.6} 18.6 Q${x0 + 5} 18.2 ${x0 + 3.2} 21 Q${x0 + 1.2} 22.4 ${x0 + .5} 25.6Z`
      : style === 1
        ? `L${x1 - .6} 27 C${x1 - .2} 23.4 ${x1 - 2.6} 20.8 ${x1 - 5.4} 20 Q${32 + 1.4} 17.8 32 19.2 Q${32 - 1.4} 17.8 ${x0 + 5.4} 20 C${x0 + 2.6} 20.8 ${x0 + .2} 23.4 ${x0 + .6} 27Z`
        : `L${x1 - .5} 25.6 C${x1 - .6} 22.6 ${x1 - 2.6} 20.4 ${x1 - 5.4} 19.2 C${x1 - 9} 17.8 ${x0 + 9} 17.8 ${x0 + 5.4} 19.2 C${x0 + 2.6} 20.4 ${x0 + .6} 22.6 ${x0 + .5} 25.6Z`;
    const cap = out + inner;
    f += `<path d="${cap}" fill="${hair}"/><clipPath id="${uid}hr"><path d="${cap}"/></clipPath><g clip-path="url(#${uid}hr)">`;
    f += `<rect x="${dim === x1 ? 32 : 0}" y="0" width="32" height="40" fill="${hairSh}" opacity=".55"/>`;
    f += `<path d="M${32 + L * 2} ${top - 2.4} Q${32 + L * 8} ${top - 1.8} ${32 + L * 11.4} 24" stroke="${hairHi}" stroke-width="2.2" opacity=".35" fill="none" stroke-linecap="round" filter="url(#${uid}soft)"/>`;
    if (style !== 1) for (let i = 0; i < 5; i++) f += `<path d="M${x0 + 4 + i * ((fw * 2 - 8) / 4)} 21 Q${32 + (i - 2) * 2.6} ${top - 1} ${32 + (i - 2) * 4.4} ${top - 3}" stroke="${hairHi}" stroke-width=".5" fill="none" opacity=".4"/>`;
    f += `</g>`;
    if (style === 1) {
      const cur = `M${x0 - 1.2} 25 C${x0 - 4.8} 32 ${x0 - 5.6} 41 ${x0 - 2.6} 48 L${x0 + 1.8} 44.4 C${x0 + .4} 38.4 ${x0 + .8} 32 ${x0 + .5} 26.4Z M${x1 + 1.2} 25 C${x1 + 4.8} 32 ${x1 + 5.6} 41 ${x1 + 2.6} 48 L${x1 - 1.8} 44.4 C${x1 - .4} 38.4 ${x1 - .8} 32 ${x1 - .5} 26.4Z`;
      f += `<path d="${cur}" fill="${hair}"/><clipPath id="${uid}hc2"><path d="${cur}"/></clipPath><g clip-path="url(#${uid}hc2)"><rect x="${dim === x1 ? 32 : 0}" y="0" width="32" height="60" fill="${hairSh}" opacity=".5"/><path d="M${x0 - 2.4} 28 Q${x0 - 3.4} 38 ${x0 - 1.2} 46 M${x1 + 2.4} 28 Q${x1 + 3.4} 38 ${x1 + 1.2} 46 M${x0 - 1} 30 Q${x0 - 2} 38 ${x0 + .4} 44 M${x1 + 1} 30 Q${x1 + 2} 38 ${x1 - .4} 44" stroke="${hairHi}" stroke-width=".6" fill="none" opacity=".35"/></g>`;
      f += `<path d="M32 ${top - 2.6} Q${32 + L * .8} ${top + 1} 32 19.2" stroke="${hairSh}" stroke-width=".7" fill="none"/>`;
    }
  }

  // ---------------------------------------------------------- expression: the traits decide it
  const mean = T.violence - T.sociability * 0.5;
  const tilt = fem ? -.2 : mean > 0.2 ? 1.1 : mean < -0.2 ? -.6 : 0.2; // inner brow dips when he's hard
  const brow = fem ? .55 : .8 + T.violence * .8;
  const bc = hair === '#cdc8bd' ? '#9e9a94' : mix(base, '#000', .15);
  const eyeY = 28.4;
  f += `<path d="M21.8 ${eyeY - 3.2 + tilt * -.3} Q25 ${eyeY - 4.8} 29.2 ${eyeY - 3.2 + tilt}" stroke="${bc}" stroke-width="${brow}" fill="none" stroke-linecap="round"/><path d="M34.8 ${eyeY - 3.2 + tilt} Q39 ${eyeY - 4.8} 42.2 ${eyeY - 3.2 + tilt * -.3}" stroke="${bc}" stroke-width="${brow}" fill="none" stroke-linecap="round"/>`;
  const dark = lk?.glasses != null ? lk.glasses === 2 : r(18) < 0.1 + rankN * 0.05 && rankN >= 2;
  if (dark) {
    f += `<path d="M20.8 ${eyeY - 2.4} H31 L30 ${eyeY + 2.4} Q25.6 ${eyeY + 3.4} 21.4 ${eyeY + 2}Z M33 ${eyeY - 2.4} H43.2 L42.6 ${eyeY + 2} Q38.4 ${eyeY + 3.4} 34 ${eyeY + 2.4}Z" fill="#0d0c12"/><path d="M31 ${eyeY - 1.2} H33" stroke="#0d0c12" stroke-width="1.1"/><path d="M22 ${eyeY - 1.4} l4 -.2 M34.4 ${eyeY - 1.4} l4 -.2" stroke="#9fb6d4" stroke-width=".7" opacity=".5"/>`;
  } else {
    const iris = pick(r(23), ['#4e3a22', '#3a2a1c', '#4a5f5a', '#5d6f8a', '#2a2018']);
    for (const ex of [26, 38]) {
      f += `<path d="M${ex - 2.9} ${eyeY + .2} Q${ex} ${eyeY - 1.7} ${ex + 2.9} ${eyeY + .2} Q${ex} ${eyeY + 1.4} ${ex - 2.9} ${eyeY + .2}Z" fill="#cfc6b6"/>`;
      f += `<circle cx="${ex + L * .3}" cy="${eyeY}" r="1.15" fill="${iris}"/><circle cx="${ex + L * .3}" cy="${eyeY}" r=".62" fill="#0b0809"/><circle cx="${ex + L * .3 - .5}" cy="${eyeY - .5}" r=".42" fill="#fff" opacity=".85"/>`;
      f += `<path d="M${ex - 3.6} ${eyeY + .3} Q${ex} ${eyeY - 2.8} ${ex + 3.6} ${eyeY + .3}" stroke="#0f0a0b" stroke-width="${fem ? 2 : 1.4}" fill="none" stroke-linecap="round"/>${fem ? `<path d="M${ex + 3.4} ${eyeY - .4} l1.4 -1 M${ex - 3.4} ${eyeY - .4} l-1.4 -1" stroke="#0f0a0b" stroke-width=".6"/>` : ''}<path d="M${ex - 3} ${eyeY + 1.6} Q${ex} ${eyeY + 2.8} ${ex + 3} ${eyeY + 1.6}" stroke="${skinSh}" stroke-width=".7" fill="none" opacity=".7"/>`;
    }
  }
  if (age > 0.5) f += `<path d="M22 ${top + 4.4} Q32 ${top + 3.4} 42 ${top + 4.4} M23 ${top + 6.4} Q32 ${top + 5.6} 41 ${top + 6.4}" stroke="${skinSh}" stroke-width=".5" fill="none" opacity=".4"/><path d="M${25.4} ${eyeY + 3.8} q.6 2 -.4 3.2 M${38.6} ${eyeY + 3.8} q-.6 2 .4 3.2" stroke="${skinSh}" stroke-width=".6" fill="none" opacity=".45"/>`;
  // nose: a plane of light and a plane of shade
  const nw = 2.2 + r(24) * 1.4;
  f += `<path d="M${32 - L * .6} 27 Q${32 - L * 1.2} 33 ${32 - nw} 35.2 Q32 36.8 ${32 + nw} 35.2 Q${32 + L * 1.2} 33 ${32 + L * .4} 27Z" fill="${skinSh}" opacity=".35"/><path d="M${32 + L * .6} 27.6 Q${32 + L * 1.6} 33 ${32 + L * nw} 35" stroke="${skinHi}" stroke-width="1" fill="none" opacity=".55" stroke-linecap="round"/><path d="M${32 - nw} 35.4 Q32 37 ${32 + nw} 35.4" stroke="#3a1c20" stroke-width=".9" fill="none" opacity=".55" stroke-linecap="round"/><circle cx="${32 - nw + .6}" cy="35.2" r=".55" fill="#2a1216" opacity=".7"/><circle cx="${32 + nw - .6}" cy="35.2" r=".55" fill="#2a1216" opacity=".7"/>`;
  f += `<path d="M${32 - nw - 1.4} 33.6 Q${32 - nw - 3} 38 ${32 - nw - 1.8} 41.4 M${32 + nw + 1.4} 33.6 Q${32 + nw + 3} 38 ${32 + nw + 1.8} 41.4" stroke="${skinSh}" stroke-width=".7" fill="none" opacity="${.25 + age * .3}"/>`;
  // mouth
  const my = 39.6;
  const smile = T.sociability > .55 && T.violence < .6 ? 1.6 : mean > .25 ? -.5 : .6;
  const lipC = fem ? mix(skin, '#b0203a', .8) : mix(skin, '#8a3a40', .5);
  f += `<path d="M27.6 ${my} Q30 ${my - 1.6} 32 ${my - .8} Q34 ${my - 1.6} 36.4 ${my} Q32 ${my + smile} 27.6 ${my}Z" fill="${shadowOf(lipC, .25)}"/><path d="M27.8 ${my + .1} Q32 ${my + 1.8 + smile * .6} 36.2 ${my + .1} Q32 ${my + smile - .2} 27.8 ${my + .1}Z" fill="${lipC}"/><path d="M27.4 ${my} Q32 ${my + smile * .8} 36.6 ${my}" stroke="#2d1114" stroke-width=".8" fill="none" opacity=".8" stroke-linecap="round"/><ellipse cx="${32 + L * 1.2}" cy="${my + 1.9 + smile * .5}" rx="1.8" ry=".5" fill="${warmOf(lipC, .5)}" opacity=".55"/>`;
  // facial hair
  const fhr = fem ? 0.9 : lk?.beard != null ? [0.9, 0.1, 0.3, 0.4][lk.beard] : r(19);
  if (fhr < 0.2) f += `<path d="M26.4 ${my - 2} Q32 ${my - 3.8} 37.6 ${my - 2} Q35 ${my - 1.2} 32 ${my - 1.6} Q29 ${my - 1.2} 26.4 ${my - 2}Z" fill="${base}"/><path d="M28 ${my - 2.4} Q32 ${my - 3.8} 36 ${my - 2.4}" stroke="${hairHi}" stroke-width=".5" fill="none" opacity=".5"/>`;
  else if (fhr < 0.36) f += `<g filter="url(#${uid}grain)"><path d="M${x0 + 1} 33 Q32 ${chin + 2.4} ${x1 - 1} 33 Q${x1 - 3} ${my + 3.4} 32 ${my + 3.6} Q${x0 + 3} ${my + 3.4} ${x0 + 1} 33Z" fill="${shadowOf(base, .3)}" opacity=".7"/></g>`;
  else if (fhr < 0.43) f += `<path d="M29.6 ${my + 2} Q32 ${my + 5.6} 34.4 ${my + 2}Z" fill="${base}" opacity=".9"/>`;
  const sbk = lk?.beard === 4 ? 1 : lk?.beard === 5 ? 2 : 0;
  if (sbk) { const yb = sbk === 2 ? 39.5 : 34.5; f += `<path d="M${x0 + .1} 24.4 L${x0 + 1.7} 24.8 Q${x0 + 2.1} 30 ${x0 + (sbk === 2 ? 3.6 : 1.4)} ${yb} Q${x0 + .5} ${yb - 2} ${x0 + .1} 30Z M${x1 - .1} 24.4 L${x1 - 1.7} 24.8 Q${x1 - 2.1} 30 ${x1 - (sbk === 2 ? 3.6 : 1.4)} ${yb} Q${x1 - .5} ${yb - 2} ${x1 - .1} 30Z" fill="${base}" opacity=".92"/>`; }
  // a scar, if he's the type
  if (!fem && T.violence > 0.62 && r(20) < 0.55) f += `<path d="M38.8 ${eyeY - 6} L41 ${eyeY + 4.2}" stroke="#b36e5a" stroke-width="1" opacity=".9" stroke-linecap="round"/><path d="M38.4 ${eyeY - 6} L40.6 ${eyeY + 4.2}" stroke="#4a1c20" stroke-width=".3" opacity=".6"/>`;
  if (!dark && (lk?.glasses != null ? lk.glasses === 1 : r(21) < 0.14)) f += `<rect x="22" y="${eyeY - 2.9}" width="7.6" height="5.6" rx="1.6" fill="#cfe3f2" opacity=".1"/><rect x="22" y="${eyeY - 2.9}" width="7.6" height="5.6" rx="1.6" fill="none" stroke="#1d1b22" stroke-width=".8"/><rect x="34.4" y="${eyeY - 2.9}" width="7.6" height="5.6" rx="1.6" fill="#cfe3f2" opacity=".1"/><rect x="34.4" y="${eyeY - 2.9}" width="7.6" height="5.6" rx="1.6" fill="none" stroke="#1d1b22" stroke-width=".8"/><path d="M29.6 ${eyeY - .4} H34.4" stroke="#1d1b22" stroke-width=".7"/>`;
  if (!fem && rankN >= 2 && r(22) < 0.22) f += `<path d="M35 ${my + .8} L46 ${my + 3.8}" stroke="#7a4a22" stroke-width="2.3" stroke-linecap="round"/><path d="M35.4 ${my + .5} L45 ${my + 3}" stroke="#b07a42" stroke-width=".7" stroke-linecap="round" opacity=".7"/><circle cx="46.4" cy="${my + 4}" r="1.3" fill="#ee7a2a"/><circle cx="46.4" cy="${my + 4}" r="2.6" fill="#ee7a2a" opacity=".2" filter="url(#${uid}blur)"/>`;
  // hat
  if (hat) f += `<ellipse cx="32" cy="${top + 3.4}" rx="${fw + 7.4}" ry="3.4" fill="#1d1c24"/><path d="M${x0 - .6} ${top + 3.4} Q${x0} ${top - 9} 32 ${top - 9.4} Q${x1} ${top - 9} ${x1 + .6} ${top + 3.4}Z" fill="#2a2933"/><path d="M${dim} ${top + 3} Q${dim} ${top - 8} 32 ${top - 9} L32 ${top + 3}Z" fill="#14131a" opacity=".6"/><path d="M${x0 - .4} ${top + 1.4} H${x1 + .4}" stroke="${tie}" stroke-width="2.2"/><path d="M${x0 + 4} ${top - 7.4} Q32 ${top - 5.2} ${x1 - 4} ${top - 7.4}" stroke="#000" stroke-width=".7" fill="none" opacity=".45"/><path d="M${32 + L * 3} ${top - 8.8} Q${32 + L * 9} ${top - 6} ${32 + L * 10} ${top}" stroke="#6d6a7c" stroke-width="1" fill="none" opacity=".5" stroke-linecap="round"/><ellipse cx="32" cy="${top + 5}" rx="${fw + 6}" ry="1.8" fill="#000" opacity=".4" filter="url(#${uid}blur)"/>`;
  if (hurt) f += `<ellipse cx="38.8" cy="${eyeY + 1}" rx="3.6" ry="2.8" fill="#5c2b7e" opacity=".6" filter="url(#${uid}blur)"/><ellipse cx="38.8" cy="${eyeY + 1.6}" rx="2.4" ry="1.4" fill="#a8483c" opacity=".35" filter="url(#${uid}blur)"/><rect x="26" y="${top + 6.4}" width="6.6" height="2.6" rx=".7" fill="#ecdcc0" transform="rotate(-18 29 ${top + 7.6})"/><path d="M27 ${top + 7.6} h4.6" stroke="#b9a78a" stroke-width=".4" transform="rotate(-18 29 ${top + 7.6})"/>`;

  // ---------------------------------------------------------- the canvas over everything
  // hard light from one side, the other side nearly gone
  o += `<rect width="64" height="64" fill="url(#${uid}lt)"/>`;
  // venetian blinds across some of them
  if (r(33) < 0.22) { const ang = L * -14; let bl = ''; for (let k = -2; k < 11; k++) bl += `<rect x="-20" y="${k * 7 + r(34) * 3}" width="104" height="2.6" fill="#000"/>`; o += `<g transform="rotate(${ang} 32 32)" opacity=".3" filter="url(#${uid}soft)" style="mix-blend-mode:multiply">${bl}</g>`; }
  o += `<rect width="64" height="64" filter="url(#${uid}cv)" opacity=".32" style="mix-blend-mode:overlay"/>`;
  o += `<rect width="64" height="64" fill="url(#${uid}vg)"/>`;

  const defs = `<defs>
    <linearGradient id="${uid}bg" x1="0" y1="0" x2="${L < 0 ? 1 : 0}" y2="1"><stop offset="0" stop-color="${mix('#4a4a4c', '#5a554e', r(31))}"/><stop offset="1" stop-color="${mix('#0e0e11', '#1b1a1d', r(32))}"/></linearGradient>
    <radialGradient id="${uid}sk" cx="${L < 0 ? .38 : .62}" cy=".34" r=".8"><stop offset="0" stop-color="${skinHi}"/><stop offset=".5" stop-color="${skin}"/><stop offset="1" stop-color="${mix(skin, skinSh, .6)}"/></radialGradient>
    <radialGradient id="${uid}vg" cx=".5" cy=".46" r=".72"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
    <linearGradient id="${uid}fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
    <linearGradient id="${uid}lt" x1="${L < 0 ? 0 : 1}" y1=".15" x2="${L < 0 ? 1 : 0}" y2=".5"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset=".45" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
    <filter id="${uid}blur2" filterUnits="userSpaceOnUse" x="-12" y="-12" width="88" height="88"><feGaussianBlur stdDeviation="3.4"/></filter>
    <filter id="${uid}soft" filterUnits="userSpaceOnUse" x="-30" y="-30" width="124" height="124"><feGaussianBlur stdDeviation=".7"/></filter>
    <filter id="${uid}noir" x="0" y="0" width="100%" height="100%"><feColorMatrix type="saturate" values=".16"/><feComponentTransfer><feFuncR type="linear" slope="1.12" intercept="-.02"/><feFuncG type="linear" slope="1.1" intercept="-.02"/><feFuncB type="linear" slope="1.02" intercept="0"/></feComponentTransfer></filter>
    <filter id="${uid}blur" filterUnits="userSpaceOnUse" x="-12" y="-12" width="88" height="88"><feGaussianBlur stdDeviation="1.3"/></filter>
    <filter id="${uid}paint" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${hashOf(c.id) % 90}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1"/></filter>
    <filter id="${uid}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="3" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -4.2" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    <filter id="${uid}cv" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1 .8" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>`;
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-label="${c.name}" xmlns="http://www.w3.org/2000/svg">${defs}<g filter="url(#${uid}noir)"><g filter="url(#${uid}paint)">${b}${f}</g>${o}</g></svg>`;
}

// A pack of supplied portraits, when there is one, replaces the painted ones. Each is picked by rank tier and the man's id.
function packed(c: Character): string {
  const tier = c.rank === 'boss' || c.rank === 'underboss' ? 'top' : c.rank === 'capo' || c.rank === 'soldier' ? 'mid' : 'low';
  const pool = PACK.filter((p) => p.tier === tier);
  const use = pool.length ? pool : PACK;
  const p = use[hashOf(c.id) % use.length];
  const hurt = safe(() => W().now < c.hurtUntil, false);
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><image href="${p.src}" width="64" height="64" preserveAspectRatio="xMidYMid slice"/>${hurt ? '<ellipse cx="40" cy="30" rx="4" ry="3" fill="#5c2b7e" opacity=".5"/>' : ''}</svg>`;
}
