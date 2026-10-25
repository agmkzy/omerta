// What he wears. His rank decides how formal it has to be (an associate dresses for the street, a capo wears a tie, the top of a
// family wears three pieces and an overcoat); his work decides it for a civilian (the butcher's apron, the mechanic's
// coveralls); and the player's own taste picks the garment and its colours within what his rank allows. A promoted man keeps
// his taste: a leather-jacket associate becomes a soldier in a leather car coat over his suit.
import type { Character, Rank } from '../../types';
import type { Face } from './face';
import type { HatKind } from './hats';
import { HAT_BY_INDEX } from './hats';
import { LIMIT, OUTFIT_COLOURS, OUTFITS, SHIRT_COLOURS, TIE_COLOURS, type LookX } from './options';
import { BRASS, dk, GOLD, lt, lum, LW, mk, opt, pick, s, safe, SHADE, type Stream } from './util';
import { W } from '../state';

export type Neckline = 'open' | 'turtle' | 'tie' | 'zip' | 'crew' | 'none';
export interface Dress { defs: string; body: string; hat: HatKind | ''; neckline: Neckline; vDepth: number; jewel: number; garment: string }

const SUITS: Record<string, string[]> = {
  soldier: ['#2f2e30', '#3a3129', '#45484a', '#2a2b2f', '#3c3a33', '#4a4a50'],
  capo: ['#252b38', '#2c2c30', '#3a3028', '#33363a', '#2a2e2a'],
  top: ['#1d1d22', '#23252c', '#2a2624', '#1f2026'],
};
const SHIRT_OPEN = ['#e8e0cf', '#e8e0cf', '#1c1a1c', '#c9b48a', '#9fb0c0', '#6b2a33', '#d9cdb4'];
const TIES = ['#6b1d27', '#3b2440', '#1f2c44', '#5e4a22', '#2c3a2c', '#7a2a2a', '#4a4a50'];
const CASUAL = ['#a8862f', '#8d4a2b', '#5f6236', '#2f5d5c', '#6b2a33', '#26314a', '#9a7a52', '#4a3527', '#c4b48e', '#6e7f8c'];

// What a civilian does all day, if the world knows: the business he owns, or the job the family found him.
let occCache: { w: unknown; n: number; map: Map<string, string> } | null = null;
function occupationOf(c: Character): string {
  if (c.job?.kind) return c.job.kind;
  return safe(() => {
    const w = W();
    const n = Object.keys(w.biz).length;
    if (!occCache || occCache.w !== w || occCache.n !== n) {
      const map = new Map<string, string>();
      for (const b of Object.values(w.biz)) map.set(b.ownerId, b.kind);
      occCache = { w, n, map };
    }
    return occCache.map.get(c.id) ?? '';
  }, '');
}

const FLOOR: Record<Rank, number> = { civilian: 0, associate: 0, soldier: 1, capo: 2, underboss: 3, boss: 3 };

export function dressOf(c: Character, F: Face, rank: Rank, rn: number, d: Stream, u: string): Dress {
  const lk = (c.look ?? {}) as LookX;
  const o = (k: keyof LookX & string) => opt(lk[k], LIMIT[k]);
  const fem = F.fem, nw = F.nw, cx = F.cx;
  let defs = '', body = '';
  let hat: HatKind | '' = '';
  let neckline: Neckline = 'none';
  let vDepth = 52;
  const pad = fem ? 0 : rn >= 4 ? 1.6 : rn === 2 ? 1.2 : rn === 3 ? 0.8 : 0;
  const sw = fem ? 20.5 : 24 + F.build * 1.2 + pad;
  const ny = 44.6 + Math.max(0, F.chin - 42.6) * 0.6; // the collar line, a touch lower under a long face
  const n0 = nw + 1.1;
  const torso = s`M${cx - sw - 3} 64L${cx - sw} 53Q${cx - sw + 1} 48.2 ${cx - sw + 7.5} 47L${cx - n0} ${ny}H${cx + n0}L${cx + sw - 7.5} 47Q${cx + sw - 1} 48.2 ${cx + sw} 53L${cx + sw + 3} 64Z`;
  defs += `<path id="${u}T" d="${torso}"/><clipPath id="${u}t"><use href="#${u}T"/></clipPath>`;
  const tc = `clip-path="url(#${u}t)"`;
  // ---------------------------------------------------------------- the tailor's kit
  const shadeR = (op = 0.42) => s`<path d="M${cx + 5} ${ny}Q${cx + 9} 54 ${cx + 7.5} 64H64V${ny}Z" fill="${SHADE}" opacity="${op}" ${tc}/>`;
  const arms = (col: string) => s`<path d="M${cx - sw + 6} 52Q${cx - sw + 5.4} 58 ${cx - sw + 6.4} 64M${cx + sw - 6} 52Q${cx + sw - 5.4} 58 ${cx + sw - 6.4} 64" stroke="${dk(col, 0.5)}" stroke-width="${LW.line}" fill="none" opacity=".8"/>`;
  const base = (col: string) => `<use href="#${u}T" fill="${col}"/>` + arms(col);
  const Vp = (w: number, yb: number) => s`M${cx - w} ${ny - 0.3}L${cx} ${yb}L${cx + w} ${ny - 0.3}Z`;
  let vi = 0;
  const inV = (w: number, yb: number, inner: string) => { const id = `${u}v${vi++}`; defs += `<clipPath id="${id}"><path d="${Vp(w, yb)}"/></clipPath>`; return `<g clip-path="url(#${id})">${inner}</g>`; };
  const fillAll = (col: string) => `<rect x="0" y="38" width="64" height="26" fill="${col}"/>`;
  const lapels = (w: number, yb: number, lw: number, col: string, peak = false) => {
    const L = (sx: number) => s`M${cx + sx * w} ${ny - 0.4}L${cx + sx * 0.3} ${yb}L${cx + sx * (lw + 1.2)} ${yb - 5.6}L${cx + sx * (w + lw * 0.85)} ${peak ? 49.2 : 50.2}L${cx + sx * (w + lw * (peak ? 1.2 : 0.4))} ${peak ? 47.8 : 49.3}L${cx + sx * (w + lw * 0.75)} 46.8Z`;
    return `<path d="${L(-1)}" fill="${lt(col, 0.08)}"/><path d="${L(1)}" fill="${dk(col, 0.35)}"/>` + s`<path d="M${cx - 0.3} ${yb}L${cx - lw - 1.2} ${yb - 5.6}L${cx - w - lw * 0.85} ${peak ? 49.2 : 50.2}" stroke="${dk(col, 0.5)}" stroke-width="${LW.fine}" fill="none"/><path d="M${cx - w - 0.2} ${ny}L${cx - 0.6} ${yb - 0.5}" stroke="${lt(col, 0.25)}" stroke-width="${LW.fine}" opacity=".6"/>`;
  };
  const shirtV = (col: string) => fillAll(col) + s`<path d="M${cx + 0.2} ${ny}L${cx + 0.2} 64H64V${ny}Z" fill="${SHADE}" opacity=".18"/>`;
  const tieCollar = (shirt: string) => s`<path d="M${cx - nw - 0.2} ${ny - 2.4}L${cx - 0.4} ${ny + 2.6}L${cx - 2.6} ${ny + 4.4}L${cx - nw - 1.4} ${ny + 0.6}Z" fill="${lt(shirt, 0.2)}"/><path d="M${cx + nw + 0.2} ${ny - 2.4}L${cx + 0.4} ${ny + 2.6}L${cx + 2.6} ${ny + 4.4}L${cx + nw + 1.4} ${ny + 0.6}Z" fill="${dk(shirt, 0.22)}"/>`;
  // a band of shirt behind the collar points, so no skin shows between the collar and the throat
  const collarBand = (shirt: string) => s`<path d="M${cx - nw - 0.3} ${ny - 2.6}Q${cx} ${ny - 1.4} ${cx + nw + 0.3} ${ny - 2.6}L${cx + nw + 0.5} ${ny + 0.4}H${cx - nw - 0.5}Z" fill="${dk(shirt, 0.1)}"/>`;
  const tie = (col: string, yb: number, pin = false) => {
    let t = s`<path d="M${cx - 1.15} ${ny + 2.1}H${cx + 1.15}L${cx + 0.8} ${ny + 4}H${cx - 0.8}Z" fill="${dk(col, 0.15)}"/><path d="M${cx - 0.8} ${ny + 4}H${cx + 0.8}L${cx + 2} ${yb + 2}L${cx} ${yb + 3.4}L${cx - 2} ${yb + 2}Z" fill="${col}"/><path d="M${cx + 0.1} ${ny + 4}H${cx + 0.8}L${cx + 2} ${yb + 2}L${cx + 0.1} ${yb + 3.4}Z" fill="${SHADE}" opacity=".3"/>`;
    if (pin) t += s`<path d="M${cx - 1.4} ${ny + 8}H${cx + 1.4}" stroke="${BRASS}" stroke-width="${LW.mid}"/>`;
    return t;
  };
  const bowTie = (col: string) => s`<path d="M${cx} ${ny + 2.6}L${cx - 2.6} ${ny + 1.4}V${ny + 4.2}ZM${cx} ${ny + 2.6}L${cx + 2.6} ${ny + 1.4}V${ny + 4.2}Z" fill="${col}"/><circle cx="${cx}" cy="${ny + 2.7}" r=".7" fill="${dk(col, 0.3)}"/>`;
  const square = (col: string) => s`<path d="M${cx + 8.4} 55.4L${cx + 9.6} 53.8L${cx + 10.4} 55L${cx + 11.4} 53.9L${cx + 12} 55.6Z" fill="${col}"/><path d="M${cx + 8} 55.6H${cx + 12.4}" stroke="${SHADE}" stroke-width="${LW.fine}" opacity=".6"/>`;
  const openCollar = (shirt: string, deep = 52) => {
    // the shirt collar spread out over the jacket, chest showing, very 1970
    vDepth = deep;
    let r = s`<path d="M${cx - nw} ${ny - 1}L${cx} ${deep}L${cx + nw} ${ny - 1}Z" fill="${F.skin}"/><path d="M${cx + nw * 0.4} ${ny - 1}L${cx + 0.4} ${deep - 0.6}L${cx} ${deep}L${cx + nw} ${ny - 1}Z" fill="${dk(F.skin, 0.42)}"/><path d="M${cx - 1.2} ${ny + 0.6}q1.2 1 2.4 0" stroke="${dk(F.skin, 0.6)}" stroke-width="${LW.fine}" fill="none" opacity=".5"/>`;
    r += s`<path d="M${cx - nw - 0.4} ${ny - 2.2}L${cx} ${deep}L${cx + nw + 0.4} ${ny - 2.2}" stroke="${SHADE}" stroke-width="1" fill="none" opacity=".35"/>`;
    r += s`<path d="M${cx - nw - 0.4} ${ny - 2.2}Q${cx - nw - 0.8} ${ny + 1} ${cx - 2} ${deep - 1.6}L${cx - n0 - 4.6} ${ny + 5.6}L${cx - n0 - 2.6} ${ny + 0.4}Z" fill="${lt(shirt, 0.12)}"/>`;
    r += s`<path d="M${cx + nw + 0.4} ${ny - 2.2}Q${cx + nw + 0.8} ${ny + 1} ${cx + 2} ${deep - 1.6}L${cx + n0 + 4.6} ${ny + 5.6}L${cx + n0 + 2.6} ${ny + 0.4}Z" fill="${dk(shirt, 0.3)}"/>`;
    return r;
  };
  const zipLine = (col: string, y0 = ny) => s`<path d="M${cx} ${y0}V64" stroke="${dk(col, 0.55)}" stroke-width="${LW.line}"/><path d="M${cx + 0.25} ${y0}V64" stroke="#a8a294" stroke-width=".25" opacity=".6"/>`;
  const knitBand = (col: string, y0: number, y1: number, w: number) => { let k = s`<path d="M${cx - w} ${y0}Q${cx} ${y0 - 1} ${cx + w} ${y0}L${cx + w + 0.6} ${y1}Q${cx} ${y1 + 0.8} ${cx - w - 0.6} ${y1}Z" fill="${col}"/>`; let r = ''; for (let x = -w + 0.8; x < w; x += 1.1) r += s`M${cx + x} ${y0}v${y1 - y0}`; k += `<path d="${r}" stroke="${dk(col, 0.35)}" stroke-width=".25" opacity=".6"/>` + s`<path d="M${cx + 1} ${y0}Q${cx + w} ${y0} ${cx + w + 0.6} ${y1}H${cx + 1}Z" fill="${SHADE}" opacity=".3"/>`; return k; };
  // the turtleneck's collar wraps the neck itself, so its top is the neck's width and sits under the jaw
  const turtle = (col: string) => { const t0 = ny - 5; return s`<path d="M${cx - nw - 0.6} ${t0}Q${cx} ${t0 + 1} ${cx + nw + 0.6} ${t0}L${cx + nw + 1.6} ${ny + 0.6}Q${cx} ${ny + 2} ${cx - nw - 1.6} ${ny + 0.6}Z" fill="${col}"/><path d="M${cx - nw - 1} ${t0 + 2}Q${cx} ${t0 + 3.2} ${cx + nw + 1} ${t0 + 2}M${cx - nw - 1.2} ${t0 + 3.6}Q${cx} ${t0 + 4.8} ${cx + nw + 1.2} ${t0 + 3.6}" stroke="${dk(col, 0.4)}" stroke-width="${LW.fine}" fill="none"/><path d="M${cx + 1.6} ${t0 + 0.8}Q${cx + nw} ${t0 + 0.6} ${cx + nw + 0.6} ${t0}L${cx + nw + 1.6} ${ny + 0.6}Q${cx + 3} ${ny + 1.6} ${cx + 1.6} ${ny + 1.4}Z" fill="${SHADE}" opacity=".35"/>`; };
  const dots = (pts: string, col: string, w: number) => `<path d="${pts}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; // zero-length strokes with round caps
  const buttons = (ys: number[], col: string) => dots(ys.map((y) => s`M${cx} ${y}h0`).join(''), col, 0.9);
  const vstripes = (gap: number, col: string, w: number, op: number) => s`<path d="M0 54.3H64" stroke="${col}" stroke-width="19.4" stroke-dasharray="${w} ${gap - w}" opacity="${op}" ${tc}/>`;
  const pinstripe = (col: string) => vstripes(2.4, lt(col, 0.35), 0.18, 0.35);
  const sheen = (col: string) => s`<path d="M${cx - sw + 4} 52Q${cx - sw + 6} 48.4 ${cx - 12} 47.6M${cx - 14} 56Q${cx - 13} 52 ${cx - 9.6} 50" stroke="${lt(col, 0.5)}" stroke-width=".8" fill="none" opacity=".35" stroke-linecap="round"/>`;
  const pocketShirt = (col: string) => s`<path d="M${cx - 10} 53.4h5.6v4.4h-5.6zM${cx + 4.4} 53.4h5.6v4.4h-5.6z" fill="none" stroke="${dk(col, 0.35)}" stroke-width="${LW.fine}"/>`;
  const spreadCollar = (col: string) => s`<path d="M${cx - nw - 0.4} ${ny - 2}L${cx - 1} ${ny + 3.6}L${cx - n0 - 3.6} ${ny + 4.6}Z" fill="${lt(col, 0.1)}"/><path d="M${cx + nw + 0.4} ${ny - 2}L${cx + 1} ${ny + 3.6}L${cx + n0 + 3.6} ${ny + 4.6}Z" fill="${dk(col, 0.25)}"/>`;
  const undershirt = () => s`<path d="M${cx - n0 + 0.6} ${ny}Q${cx} ${ny + 3} ${cx + n0 - 0.6} ${ny}Z" fill="#e4dccb"/>`;

  // ---------------------------------------------------------------- women
  if (fem) {
    const col = pick(d(1), rn >= 3 ? ['#1d1b1f', '#3a1c24', '#26314a', '#2a2826'] : CASUAL);
    const kind = rn >= 3 ? 5 : pick(d(2), [0, 0, 1, 1, 2, 3, 4]);
    body += base(col) + shadeR();
    if (kind === 0) {
      // a blouse with a rounded collar, under a cardigan
      const bl = pick(d(3), ['#e6dcc6', '#d8c8a8', '#c9d0d0', '#e0c8c0']);
      body += inV(n0 + 1, 58, shirtV(bl) + buttons([50, 53, 56], dk(bl, 0.3)));
      body += s`<path d="M${cx - 0.2} ${ny + 0.4}Q${cx - 3.6} ${ny + 3.6} ${cx - n0 - 1.6} ${ny + 0.6}Q${cx - n0} ${ny - 1.2} ${cx - 0.2} ${ny + 0.4}Z" fill="${lt(bl, 0.3)}"/><path d="M${cx + 0.2} ${ny + 0.4}Q${cx + 3.6} ${ny + 3.6} ${cx + n0 + 1.6} ${ny + 0.6}Q${cx + n0} ${ny - 1.2} ${cx + 0.2} ${ny + 0.4}Z" fill="${bl}"/>`;
      body += buttons([60, 62.6], lt(col, 0.4));
      neckline = 'crew';
    } else if (kind === 1) {
      // a shift dress, high round neck, a string of pearls
      body += s`<path d="M${cx - n0} ${ny}Q${cx} ${ny + 3.4} ${cx + n0} ${ny}" stroke="${dk(col, 0.4)}" stroke-width="${LW.line}" fill="none"/>`;
      if (d(4) < 0.6) { let pr = ''; for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); pr += s`M${cx - Math.cos(a) * (n0 - 0.4)} ${ny + 0.4 + Math.sin(a) * 3.2}h0`; } body += dots(pr, '#e9e1cf', 1); }
    } else if (kind === 2) {
      body += turtle(col); neckline = 'turtle';
      if (d(4) < 0.5) body += s`<path d="M${cx - 2.6} ${ny + 1}Q${cx} 52 ${cx + 2.6} ${ny + 1}" stroke="${BRASS}" stroke-width="${LW.fine}" fill="none"/><circle cx="${cx}" cy="51.4" r=".9" fill="${BRASS}"/>`;
    } else if (kind === 3) {
      // a scoop neck with a little scarf knotted at the throat
      const sc = pick(d(5), ['#c9a24a', '#a83a3a', '#e3d6bd', '#3d6b6a']);
      body += s`<path d="M${cx - n0} ${ny - 0.4}Q${cx} ${ny + 5.4} ${cx + n0} ${ny - 0.4}Z" fill="${F.skin}"/><path d="M${cx - nw - 0.4} ${ny - 1.6}Q${cx} ${ny + 2} ${cx + nw + 0.4} ${ny - 1.6}L${cx + nw + 1} ${ny}Q${cx} ${ny + 3.6} ${cx - nw - 1} ${ny}Z" fill="${sc}"/><path d="M${cx + 1} ${ny + 1.4}L${cx + 3.4} ${ny + 6}L${cx + 1.6} ${ny + 6.4}Z" fill="${dk(sc, 0.25)}"/>`;
    } else if (kind === 4) {
      // a buttoned cardigan, the plainest thing in the closet
      body += s`<path d="M${cx - n0} ${ny}Q${cx} ${ny + 2.4} ${cx + n0} ${ny}" stroke="${dk(col, 0.4)}" stroke-width=".8" fill="none"/><path d="M${cx} ${ny + 2}V64" stroke="${dk(col, 0.4)}" stroke-width="${LW.line}"/>` + buttons([50, 54, 58, 62], lt(col, 0.5));
    } else {
      // the wife of a made man: dark silk, a fur collar, pearls
      const fur = pick(d(6), ['#5a4636', '#2a2420', '#8a7a66']);
      body += s`<path d="M${cx - n0} ${ny}Q${cx} ${ny + 4} ${cx + n0} ${ny}" stroke="${dk(col, 0.4)}" stroke-width="${LW.line}" fill="none"/>`;
      body += s`<path d="M${cx - n0 - 0.4} ${ny - 0.6}Q${cx - n0 - 6} ${ny + 2} ${cx - sw + 5} 52Q${cx - n0 - 3} ${ny + 6} ${cx - 2.4} 58Q${cx - n0} ${ny + 4} ${cx - n0 - 0.4} ${ny - 0.6}ZM${cx + n0 + 0.4} ${ny - 0.6}Q${cx + n0 + 6} ${ny + 2} ${cx + sw - 5} 52Q${cx + n0 + 3} ${ny + 6} ${cx + 2.4} 58Q${cx + n0} ${ny + 4} ${cx + n0 + 0.4} ${ny - 0.6}Z" fill="${fur}"/><path d="M${cx + n0 + 0.4} ${ny - 0.6}Q${cx + n0 + 6} ${ny + 2} ${cx + sw - 5} 52Q${cx + n0 + 3} ${ny + 6} ${cx + 2.4} 58Z" fill="${SHADE}" opacity=".35"/>`;
      let pr = ''; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; pr += s`M${cx - Math.cos(a) * (n0 - 0.4)} ${ny + 0.4 + Math.sin(a) * 3.4}h0`; } body += dots(pr, '#e9e1cf', 1);
    }
    if (F.age >= 2 && rn === 0 && d(7) < 0.3) hat = 'scarf';
    return { defs, body, hat, neckline, vDepth, jewel: 0, garment: 'fem' + kind };
  }

  // ---------------------------------------------------------------- the garments
  // each paints the whole torso; `m` is the main colour, `sh` the shirt, `tc0` the tie
  type G = (m: string, sh: string, tc0: string) => void;
  const G: Record<string, G> = {
    cardigan: (m, sh, tc0) => {
      const withTie = d(5) < 0.5;
      body += base(m) + shadeR() + inV(n0 + 1.2, 56, shirtV(sh) + (withTie ? tie(tc0, 56) : '')) + tieCollar(sh);
      body += s`<path d="M${cx - n0 - 1.2} ${ny}L${cx - 0.4} 56.4V64M${cx + n0 + 1.2} ${ny}L${cx + 0.4} 56.4" stroke="${dk(m, 0.4)}" stroke-width=".7" fill="none"/>` + buttons([58.4, 61.6], lt(m, 0.4));
      neckline = withTie ? 'tie' : 'open'; vDepth = 50;
    },
    workshirt: (m) => {
      // chambray or khaki, two pockets, an undershirt at the neck
      body += base(m) + shadeR(0.32) + undershirt() + spreadCollar(m);
      body += s`<path d="M${cx} ${ny + 3}V64" stroke="${dk(m, 0.35)}" stroke-width="${LW.line}"/>` + pocketShirt(m) + buttons([51, 55, 59, 63], '#d8d0c0');
      neckline = 'crew';
    },
    windbreaker: (m, sh) => {
      body += base(m) + shadeR() + s`<path d="M${cx - n0} ${ny}L${cx} 50L${cx + n0} ${ny}Z" fill="${sh}"/>` + tieCollar(sh) + knitBand(dk(m, 0.1), ny - 1.4, ny + 1.2, n0 + 2.2) + zipLine(m, 50);
      neckline = 'crew';
    },
    flannel: (m) => {
      body += base(m) + shadeR(0.35);
      const pl = (c0: string, w: number, op: number, off = 0) => vstripes(3.2, c0, w, op).replace('M0 54.3H64', s`M${off} 54.3H64`) + s`<path d="M${30 + off} 44.6V64" stroke="${c0}" stroke-width="64" stroke-dasharray="${w} ${3.2 - w}" opacity="${op}" ${tc}/>`;
      body += pl(dk(m, 0.55), 0.8, 0.55) + pl(lt(m, 0.4), 0.2, 0.5, 0.9);
      body += s`<path d="M${cx - n0 + 0.6} ${ny}L${cx} 50L${cx + n0 - 0.6} ${ny}Z" fill="${F.skin}"/>` + spreadCollar(m);
      neckline = 'open'; vDepth = 50;
    },
    clerk: (m, sh, tc0) => {
      // a sweater vest, shirt and tie
      body += base(sh) + shadeR(0.25);
      body += s`<path d="M${cx - sw + 8} 64L${cx - sw + 7.6} 50Q${cx - sw + 9} 47.6 ${cx - n0 - 0.6} ${ny + 0.4}L${cx} 55L${cx + n0 + 0.6} ${ny + 0.4}Q${cx + sw - 9} 47.6 ${cx + sw - 7.6} 50L${cx + sw - 8} 64Z" fill="${m}"/>`;
      body += tieCollar(sh) + tie(tc0, 54) + s`<path d="M${cx - n0 - 0.6} ${ny + 0.4}L${cx} 55L${cx + n0 + 0.6} ${ny + 0.4}" stroke="${dk(m, 0.35)}" stroke-width=".8" fill="none"/>` + shadeR(0.3);
      neckline = 'tie';
    },
    shopkeeper: (_m, sh, tc0) => {
      // white shirt, dark tie, an apron
      body += base(sh) + shadeR(0.25) + tieCollar(sh) + tie(tc0, 54);
      const ap = pick(d(5), ['#e8e2d4', '#d4cdbd', '#c9d0d4']);
      body += s`<path d="M${cx - 8.4} 54.4H${cx + 8.4}L${cx + 9} 64H${cx - 9}Z" fill="${ap}"/><path d="M${cx - 8} 54.6L${cx - n0 - 0.6} ${ny}M${cx + 8} 54.6L${cx + n0 + 0.6} ${ny}" stroke="${dk(ap, 0.15)}" stroke-width=".9"/><path d="M${cx + 1} 54.4H${cx + 8.4}L${cx + 9} 64H${cx + 1}Z" fill="${SHADE}" opacity=".18"/>`;
      if (d(8) < 0.4) body += s`<path d="M${cx - 8.4} 56h16.8M${cx - 8.6} 58h17.2M${cx - 8.7} 60h17.4M${cx - 8.8} 62h17.6" stroke="#7a8aa0" stroke-width="${LW.line}" opacity=".7"/>`;
      neckline = 'tie';
    },
    butcher: () => {
      // a white coat buttoned to the neck and a long apron, a little the worse for the day
      const wc = '#e6e0d2';
      body += base(wc) + shadeR(0.3) + undershirt() + s`<path d="M${cx - nw - 0.4} ${ny - 1.8}L${cx} ${ny + 2.4}L${cx + nw + 0.4} ${ny - 1.8}L${cx + n0 + 1.6} ${ny + 1.2}L${cx} ${ny + 4.6}L${cx - n0 - 1.6} ${ny + 1.2}Z" fill="${lt(wc, 0.15)}"/>`;
      body += s`<path d="M${cx - 9} 53H${cx + 9}L${cx + 9.6} 64H${cx - 9.6}Z" fill="#f0ece2"/><path d="M${cx - 8.6} 53.2L${cx - n0 - 0.2} ${ny + 1}M${cx + 8.6} 53.2L${cx + n0 + 0.2} ${ny + 1}" stroke="#cfc8b8" stroke-width=".7"/><path d="M${cx + 1} 53H${cx + 9}L${cx + 9.6} 64H${cx + 1}Z" fill="${SHADE}" opacity=".16"/>`;
      body += s`<path d="M${cx - 4} 57.4l1.2 .8M${cx + 3} 59.6l.8 .9M${cx - 1.6} 61.4l.6 .4" stroke="#8a3a34" stroke-width=".6" opacity=".55" stroke-linecap="round"/>`;
      neckline = 'crew';
    },
    whites: () => {
      // the baker's or the barber's tunic, high-collared, buttoned on the shoulder
      const wc = '#ece8de';
      body += base(wc) + shadeR(0.28) + s`<path d="M${cx - nw - 0.4} ${ny - 2.4}Q${cx} ${ny - 1.4} ${cx + nw + 0.4} ${ny - 2.4}L${cx + nw + 0.8} ${ny + 0.6}Q${cx} ${ny + 1.8} ${cx - nw - 0.8} ${ny + 0.6}Z" fill="${lt(wc, 0.2)}"/>`;
      body += s`<path d="M${cx + 3} ${ny + 1}L${cx + 4.4} 64" stroke="${dk(wc, 0.2)}" stroke-width="${LW.line}"/>` + dots(s`M${cx + 3.4} 50h0M${cx + 3.7} 54h0M${cx + 4} 58h0`, '#bdb6a6', 0.9);
      neckline = 'none';
    },
    coveralls: (m) => {
      // the garage: coveralls, a name over the pocket
      const cv = pick(d(5), ['#3d4a5a', '#5a5a4a', '#2f3a44', '#4a3f33']);
      body += base(cv) + shadeR(0.35) + undershirt() + spreadCollar(cv) + zipLine(cv, ny + 3) + pocketShirt(cv);
      body += s`<path d="M${cx - 9.6} 52.4h4.4v1.4h-4.4z" fill="#e6e0d2"/><path d="M${cx - 9} 53.1h3.2" stroke="#8a2a2a" stroke-width=".35"/>`;
      body += s`<path d="M${cx + 6} 59l2.4 .6" stroke="#1a1716" stroke-width=".8" opacity=".35" stroke-linecap="round"/>`;
      void m; neckline = 'crew';
    },
    whitecoat: (_m, sh, tc0) => {
      // the pharmacist: a white coat over a shirt and tie
      const wc = '#eae6dc';
      body += base(wc) + shadeR(0.3) + inV(n0 + 2.2, 58, shirtV(sh) + tie(tc0, 58)) + tieCollar(sh) + lapels(n0 + 2.2, 58, 3.2, wc);
      body += s`<path d="M${cx - 11} 55.4h4.6" stroke="${dk(wc, 0.25)}" stroke-width="${LW.fine}"/><path d="M${cx - 10.4} 55.4v-1.8" stroke="#2a2a3a" stroke-width=".5"/>`;
      neckline = 'tie';
    },
    bartender: (_m, sh) => {
      // white shirt, a black waistcoat, a bow tie
      const wc = '#1c1b1e';
      body += base(sh) + shadeR(0.25);
      body += s`<path d="M${cx - 13} 64L${cx - 13} ${ny + 2}H${cx - n0 + 0.4}L${cx} 55L${cx + n0 - 0.4} ${ny + 2}H${cx + 13}V64Z" fill="${wc}"/><path d="M${cx + 0.2} 55L${cx + n0 - 0.4} ${ny + 2}H${cx + 13}V64H${cx + 0.2}Z" fill="${SHADE}" opacity=".35"/>` + buttons([57.4, 60, 62.6], '#8a8580');
      body += collarBand(sh) + tieCollar(sh) + bowTie('#151214');
      neckline = 'tie';
    },
    tailor: (m, sh) => {
      // shirtsleeves and a waistcoat, the tape round his neck
      body += base(sh) + shadeR(0.25) + collarBand(sh) + tieCollar(sh);
      body += s`<path d="M${cx - 13} 64L${cx - 13} ${ny + 3}H${cx - n0}L${cx} 56L${cx + n0} ${ny + 3}H${cx + 13}V64Z" fill="${m}"/><path d="M${cx + 0.2} 56L${cx + n0} ${ny + 3}H${cx + 13}V64H${cx + 0.2}Z" fill="${SHADE}" opacity=".35"/>` + buttons([58.4, 61], lt(m, 0.4));
      body += s`<path d="M${cx - nw - 0.6} ${ny - 1.6}L${cx - 3} 64M${cx + nw + 0.6} ${ny - 1.6}L${cx + 3.2} 64" stroke="#d8c46a" stroke-width="1.1" fill="none"/><path d="M${cx - nw - 0.4} ${ny}l.5 .1M${cx - nw + 0.2} ${ny + 3}l.5 .1M${cx + nw + 0.8} ${ny + 1}l.5 .1" stroke="#3a3020" stroke-width=".3"/>`;
      neckline = 'none';
    },
    track: (m) => {
      // a track jacket, zipped to the throat, stripes down the sleeves
      const st = pick(d(4), ['#e8e0cf', '#c9a24a', '#e8e0cf']);
      body += base(m) + shadeR();
      body += s`<path d="M${cx - n0 - 3} 47.4Q${cx - sw + 3} 48.6 ${cx - sw + 0.6} 54L${cx - sw - 0.8} 64M${cx + n0 + 3} 47.4Q${cx + sw - 3} 48.6 ${cx + sw - 0.6} 54L${cx + sw - 0.8} 64" stroke="${st}" stroke-width=".7" fill="none" opacity=".9"/><path d="M${cx - n0 - 3.4} 48.6Q${cx - sw + 3.6} 50 ${cx - sw + 1.8} 55L${cx - sw + 0.6} 64M${cx + n0 + 3.4} 48.6Q${cx + sw - 3.6} 50 ${cx + sw - 1.8} 55L${cx + sw - 0.6} 64" stroke="${st}" stroke-width=".7" fill="none" opacity=".9"/>`;
      const t0 = ny - 4.2;
      body += s`<path d="M${cx - nw - 0.8} ${t0}Q${cx} ${t0 + 1.2} ${cx + nw + 0.8} ${t0}L${cx + n0 + 0.8} ${ny + 0.8}Q${cx} ${ny + 2} ${cx - n0 - 0.8} ${ny + 0.8}Z" fill="${m}"/><path d="M${cx - nw - 0.6} ${t0 + 1.2}Q${cx} ${t0 + 2.4} ${cx + nw + 0.6} ${t0 + 1.2}" stroke="${st}" stroke-width=".4" fill="none" opacity=".7"/><path d="M${cx + 1} ${t0 + 1}Q${cx + nw} ${t0 + 0.6} ${cx + nw + 0.8} ${t0}L${cx + n0 + 0.8} ${ny + 0.8}Q${cx + 3} ${ny + 1.8} ${cx + 1} ${ny + 1.6}Z" fill="${SHADE}" opacity=".35"/>` + zipLine(m, t0 + 1) + s`<rect x="${cx - 0.5}" y="${t0 + 2.6}" width="1" height="2" rx=".3" fill="#b8b2a4"/>`;
      neckline = 'zip';
    },
    leather: (m, sh) => {
      // a leather jacket, wide collar, over an open shirt or a turtleneck
      const under = lk.outfit == null ? (d(4) < 0.45 ? 'turtle' : 'open') : sh === SHIRT_COLOURS[9] ? 'turtle' : 'open';
      body += base(m) + shadeR(0.45) + sheen(m);
      body += inV(n0 + 2, 60, shirtV(sh));
      body += lapels(n0 + 2, 60, 4.6, m, true);
      body += under === 'turtle' ? turtle(sh) : openCollar(sh, 53);
      neckline = under;
    },
    bomber: (m, sh) => {
      // a bomber with a ribbed collar, a T-shirt under it
      body += base(m) + shadeR() + s`<path d="M${cx - n0 - 0.6} ${ny - 0.6}Q${cx} ${ny + 6.4} ${cx + n0 + 0.6} ${ny - 0.6}Z" fill="${sh}"/><path d="M${cx - nw} ${ny - 0.6}Q${cx} ${ny + 3.6} ${cx + nw} ${ny - 0.6}" stroke="${dk(sh, 0.3)}" stroke-width=".7" fill="none"/>` + s`<path d="M${cx - n0 - 0.6} ${ny - 0.6}L${cx - 1.6} 64M${cx + n0 + 0.6} ${ny - 0.6}L${cx + 1.6} 64" stroke="${dk(m, 0.5)}" stroke-width=".7" fill="none"/>` + knitBand(dk(m, 0.25), ny - 1.4, ny + 0.8, n0 + 3.2);
      body += s`<path d="M${cx - 11} 55.6h6M${cx + 5} 55.6h6" stroke="${dk(m, 0.45)}" stroke-width=".6"/>`;
      neckline = 'crew';
    },
    turtleneck: (m) => { body += base(m) + shadeR(0.4) + turtle(m); neckline = 'turtle'; },
    sport: (m) => {
      // an open sport shirt, collar spread wide
      body += base(m) + shadeR(0.35);
      if (d(5) < 0.4) body += vstripes(2.2, dk(m, 0.35), 0.45, 0.5);
      body += openCollar(m, 53.6) + buttons([56, 60, 63.6], lt(m, 0.4));
      body += s`<path d="M${cx} 53.6V64" stroke="${dk(m, 0.4)}" stroke-width="${LW.mid}"/>`;
      neckline = 'open';
    },
    suitOpen: (m, sh) => {
      // a suit, but the collar is open and the tie stayed home
      const under = lum(sh) < 0.2 && lk.outfit != null ? 'turtle' : lk.outfit == null && d(5) < 0.3 ? 'turtle' : 'open';
      body += base(m) + shadeR(0.45);
      body += inV(n0 + 1.6, 59, shirtV(sh));
      body += lapels(n0 + 1.6, 59, 3.8, m);
      body += under === 'turtle' ? turtle(sh) : openCollar(sh, 52);
      neckline = under;
    },
    suitTurtle: (m, sh) => {
      body += base(m) + shadeR(0.45) + inV(n0 + 1.6, 59, shirtV(sh)) + lapels(n0 + 1.6, 59, 3.8, m) + turtle(sh);
      neckline = 'turtle';
    },
    carcoat: (m, sh) => {
      // a leather car coat over an open-collared suit
      const suit = pick(d(3), SUITS.soldier);
      body += base(m) + shadeR(0.45) + sheen(m);
      body += inV(n0 + 3, 62, fillAll(suit) + inV(n0 + 1.2, 59, shirtV(sh)) + lapels(n0 + 1.2, 59, 2.8, suit));
      body += lapels(n0 + 3, 62, 4.6, m, true);
      body += openCollar(sh, 52);
      neckline = 'open';
    },
    suitTie: (m, sh, tc0) => {
      // a proper suit and tie
      body += base(m) + (d(5) < 0.4 ? pinstripe(m) : '') + shadeR(0.45);
      body += inV(n0 + 1.2, 58, shirtV(sh) + tie(tc0, 58, d(7) < 0.35)) + collarBand(sh) + tieCollar(sh);
      body += lapels(n0 + 1.2, 58, 3.6, m) + (d(8) < 0.8 ? square(pick(d(9), ['#ece6d8', '#ece6d8', '#c9a24a', '#8a2a34'])) : '');
      neckline = 'tie';
    },
    mourning: () => {
      // the undertaker: black suit, white shirt, black tie
      G.suitTie('#18171a', '#ece6d8', '#0e0d0f');
    },
    threePiece: (m, sh, tc0) => {
      const vest = (yb: number) => s`<path d="M${cx - 14} 64L${cx - 14} ${ny}H${cx - n0 + 0.4}L${cx} ${yb}L${cx + n0 - 0.4} ${ny}H${cx + 14}V64Z" fill="${m}"/><path d="M${cx + 0.2} ${yb}L${cx + n0 - 0.4} ${ny}H${cx + 14}V64H${cx + 0.2}Z" fill="${SHADE}" opacity=".35"/>` + buttons([yb + 2.2, yb + 4.6, yb + 7], lt(m, 0.35));
      body += base(m) + (d(9) < 0.35 ? pinstripe(m) : '') + shadeR(0.45);
      body += inV(n0 + 1.2, 60, shirtV(sh) + tie(tc0, 57, rank === 'boss') + vest(52.6)) + collarBand(sh) + tieCollar(sh) + lapels(n0 + 1.2, 60, 3.8, m, rank === 'boss');
      body += square(pick(d(10), ['#ece6d8', '#ece6d8', '#c9a24a', '#8a2a34']));
      neckline = 'tie';
    },
    overcoat: (m, sh, tc0) => {
      // the top of the family: an overcoat over three pieces, sometimes a white silk scarf
      const suit = pick(d(3), SUITS.top);
      const vest = (yb: number) => s`<path d="M${cx - 14} 64L${cx - 14} ${ny}H${cx - n0 + 0.4}L${cx} ${yb}L${cx + n0 - 0.4} ${ny}H${cx + 14}V64Z" fill="${suit}"/>` + buttons([yb + 2.2, yb + 4.6], lt(suit, 0.35));
      body += base(m) + shadeR(0.45);
      body += inV(n0 + 3.4, 66, fillAll(suit) + inV(n0 + 1, 60, shirtV(sh) + tie(tc0, 57, rank === 'boss') + vest(52.6)) + collarBand(sh) + tieCollar(sh) + lapels(n0 + 1, 60, 2.8, suit));
      body += lapels(n0 + 3.4, 66, 6, m, true);
      if (d(8) < 0.3) body += s`<path d="M${cx - n0 - 3} ${ny - 0.4}L${cx - 4} 64H${cx - 7.4}L${cx - n0 - 4.6} ${ny + 2}ZM${cx + n0 + 3} ${ny - 0.4}L${cx + 4} 64H${cx + 7.4}L${cx + n0 + 4.6} ${ny + 2}Z" fill="#e6dfd0"/><path d="M${cx + n0 + 3} ${ny - 0.4}L${cx + 4} 64H${cx + 7.4}L${cx + n0 + 4.6} ${ny + 2}Z" fill="${SHADE}" opacity=".25"/>`;
      neckline = 'tie';
    },
  };

  // ---------------------------------------------------------------- what he puts on
  const chosen = o('outfit');
  const mC = o('outfitColour'), shC = o('shirt'), tiC = o('tie');
  let garment: string;
  let m: string, sh: string, tc0: string;
  const top = rank === 'underboss' || rank === 'boss';
  if (chosen != null) {
    // the player's taste, dressed up to what his rank demands (and an associate is never overdressed)
    const f = OUTFITS[chosen].f, floor = FLOOR[rank] ?? 0;
    const TASTE = ['leather', 'track', 'sport', 'turtleneck', 'bomber', 'cardigan', 'windbreaker', 'suitOpen', 'suitTie', 'threePiece', 'carcoat', 'overcoat'];
    garment = TASTE[chosen];
    if (rank === 'associate' && f > 2) garment = 'suitTie';
    else if (f < floor) {
      if (floor === 1) garment = chosen === 0 ? 'carcoat' : chosen === 3 ? 'suitTurtle' : 'suitOpen';
      else if (floor === 2) garment = chosen === 3 ? 'suitTurtle' : 'suitTie';
      else garment = chosen === 0 || chosen === 10 || chosen === 11 ? 'overcoat' : 'threePiece';
    }
    m = mC != null ? OUTFIT_COLOURS[mC] : pick(d(3), garment.startsWith('suit') || garment === 'threePiece' ? SUITS.capo : CASUAL);
    sh = shC != null ? SHIRT_COLOURS[shC] : pick(d(4), SHIRT_OPEN);
    tc0 = tiC != null ? TIE_COLOURS[tiC] : pick(d(6), TIES);
    // a turtleneck man keeps his turtleneck in his colour and puts a dark suit over it
    if (garment === 'suitTurtle' && chosen === 3) { sh = m; m = pick(d(3), SUITS.soldier); }
  } else if (rank === 'civilian') {
    const occ = occupationOf(c);
    const OCC: Record<string, string> = { butcher: 'butcher', deli: 'butcher', fish: 'butcher', grocer: 'shopkeeper', bakery: 'whites', barber: 'whites', garage: 'coveralls', pharmacy: 'whitecoat', bartender: 'bartender', bar: 'bartender', driver: 'leather', doorman: 'suitTie', tailor: 'tailor', funeral: 'mourning', jeweller: 'suitTie', porter: 'workshirt', hardware: 'shopkeeper', candy: 'shopkeeper', newsstand: 'cardigan', pawnshop: 'clerk', photo: 'clerk', cleaner: 'clerk', laundromat: 'workshirt', shoes: 'workshirt', florist: 'cardigan', restaurant: 'suitTie', diner: 'shopkeeper', cafe: 'cardigan' };
    garment = OCC[occ] ?? pick(d(2), ['cardigan', 'workshirt', 'workshirt', 'windbreaker', 'shopkeeper', 'flannel', 'clerk']);
    m = pick(d(3), garment === 'workshirt' ? ['#5c6e82', '#7a8a96', '#8a7d5e', '#6e6a5e', '#4c5a66'] : garment === 'windbreaker' ? ['#26314a', '#8a7a5e', '#6e3a2a', '#3f4a3a', '#5a5a5e'] : garment === 'flannel' ? ['#6e2a24', '#3a4a36', '#2a344a', '#7a5a2a'] : garment === 'suitTie' ? SUITS.soldier : ['#5a4a3a', '#8a7a5e', '#4f5a44', '#6b5a4a', '#3e4652', '#7a6a50']);
    sh = pick(d(4), ['#e2dac6', '#cdd3d4', '#d9cfb4']);
    tc0 = pick(d(6), ['#1f2c44', '#3a2a24', '#5a2a2a', '#2a2a2a', ...TIES]);
    if (garment === 'workshirt' || garment === 'windbreaker' || garment === 'flannel' || garment === 'coveralls') { if (d(7) < (occ === 'fish' || occ === 'porter' ? 0.45 : 0.25)) hat = occ === 'fish' || occ === 'porter' || d(12) < 0.3 ? 'watch' : 'cap'; }
    if (!hat && F.age >= 2 && d(9) < 0.18) hat = occ === 'funeral' ? 'homburg' : 'fedora';
  } else if (rank === 'associate') {
    // young and on the street: no tie, nothing pressed
    garment = pick(d(2), ['track', 'leather', 'leather', 'bomber', 'turtleneck', 'sport']);
    m = garment === 'track' ? pick(d(3), ['#26314a', '#6b2a33', '#2a3a2e', '#1c1b1e', '#5a2a3a', '#2f5d5c'])
      : garment === 'leather' ? pick(d(3), ['#1a1716', '#2e2019', '#3a2418', '#1e1c1e', '#4a2a1e'])
      : garment === 'bomber' ? pick(d(3), ['#4a4a32', '#26314a', '#6e5a3a', '#3a3a3e', '#6b2a24'])
      : garment === 'turtleneck' ? pick(d(3), ['#1c1a1c', '#2a2628', '#d6cbb3', '#4a3527', '#5a2a2a', '#26314a'])
      : pick(d(3), ['#a8862f', '#8d4a2b', '#c4b48e', '#9fb0c0', '#5f6236', '#d9cdb4', '#6e3a2a']);
    sh = garment === 'leather' ? pick(d(5), ['#e8e0cf', '#c9b48a', '#9fb0c0', '#a8862f', '#6b2a33', '#1c1a1c', '#3a3530']) : garment === 'bomber' ? pick(d(4), ['#e4dccb', '#1c1a1c', '#8a7a5e']) : '#e8e0cf';
    tc0 = TIES[0];
    if (d(10) < 0.3) hat = d(13) < 0.6 ? 'cap' : d(13) < 0.75 ? 'watch' : 'trilby';
  } else if (rank === 'soldier') {
    const coat = d(4) < 0.15;
    garment = coat ? 'carcoat' : 'suitOpen';
    m = coat ? pick(d(7), ['#2a1e18', '#1a1716', '#3a2a20']) : pick(d(3), SUITS.soldier);
    sh = d(5) < 0.3 ? pick(d(6), ['#1c1a1c', '#2a2628', '#3a1c22']) : pick(d(6), SHIRT_OPEN);
    tc0 = TIES[0];
    if (d(8) < 0.18) hat = d(14) < 0.55 ? 'fedora' : 'trilby';
  } else if (rank === 'capo') {
    garment = 'suitTie';
    m = pick(d(3), SUITS.capo); sh = pick(d(4), ['#ece6d8', '#ece6d8', '#c9d4dc', '#e2d8c0']); tc0 = pick(d(6), TIES);
    if (d(10) < 0.25) hat = d(15) < 0.2 ? 'homburg' : 'fedora';
  } else {
    const coat = d(5) < (rank === 'boss' ? 0.65 : 0.25);
    garment = coat ? 'overcoat' : 'threePiece';
    m = coat ? pick(d(7), ['#8a6e4c', '#1a1919', '#2e2e32', '#1e2230', '#6e5a44']) : pick(d(3), SUITS.top);
    sh = pick(d(4), ['#ece6d8', '#ece6d8', '#e4dccb']);
    tc0 = pick(d(6), rank === 'boss' ? ['#4a1820', '#5a5a60', '#1f2c44', '#3a2a40'] : TIES);
    if (d(11) < (rank === 'boss' ? 0.55 : 0.35)) hat = d(16) < 0.3 ? 'homburg' : 'fedora';
  }
  void top;
  G[garment](m, sh, tc0);

  // his own hat, if he chose one, whatever his rank
  const hatI = o('hat');
  if (hatI != null) hat = HAT_BY_INDEX[hatI];

  // jewellery: chosen, or the soldier's and the associate's gold chain, a saint's medal on a pious man
  let jewel = o('jewel') ?? 0;
  if (lk.jewel == null) {
    const jr = mk(F.seed + '/j');
    if (d(20) < (rank === 'soldier' ? 0.45 : rank === 'associate' ? 0.3 : 0)) jewel = 1;
    else if (jr(0) < (rank === 'civilian' ? 0.08 : 0.1)) jewel = pick(jr(1), [2, 2, 3, 4]);
  }
  return { defs, body, hat, neckline, vDepth, jewel, garment };
}

// Jewellery at the throat, to suit the neckline: a chain in an open collar or over a turtleneck, a tie bar on a tie.
export function jewelOf(F: Face, D: Dress, kind: number): string {
  if (!kind || D.neckline === 'zip' || D.neckline === 'none') return '';
  const cx = F.cx, n0 = F.nw + 1.1, ny = 44.6 + Math.max(0, F.chin - 42.6) * 0.6;
  if (D.neckline === 'tie') return s`<path d="M${cx - 1.6} ${ny + 8}H${cx + 1.6}" stroke="${GOLD}" stroke-width=".55"/><path d="M${cx - 1.6} ${ny + 7.8}H${cx}" stroke="#f0d9a0" stroke-width=".2" opacity=".8"/>`;
  const turtle = D.neckline === 'turtle';
  const yb = turtle ? ny + 6.6 : D.neckline === 'crew' ? ny + 3.4 : Math.min(D.vDepth - 1.2, ny + 7.2);
  const w = turtle ? n0 + 0.4 : D.neckline === 'crew' ? n0 - 1 : F.nw * 0.8; // in an open collar the chain lies inside the V, under the collar points
  let j = s`<path d="M${cx - w} ${ny - (turtle ? -0.6 : 0.2)}Q${cx} ${yb + 0.6} ${cx + w} ${ny - (turtle ? -0.6 : 0.2)}" stroke="${GOLD}" stroke-width=".55" fill="none"/><path d="M${cx - w + 0.4} ${ny + (turtle ? 0.8 : 0)}Q${cx - w * 0.4} ${yb - 0.4} ${cx + 0.4} ${yb + 0.3}" stroke="#f0d9a0" stroke-width=".2" fill="none" opacity=".8"/>`;
  const py = yb + 0.5;
  if (kind === 2) j += s`<path d="M${cx} ${py}v3M${cx - 0.9} ${py + 0.9}h1.8" stroke="${GOLD}" stroke-width=".55"/>`;
  else if (kind === 3) j += s`<path d="M${cx - 0.3} ${py}Q${cx - 0.6} ${py + 1.8} ${cx + 0.7} ${py + 3}Q${cx + 0.2} ${py + 1.6} ${cx + 0.4} ${py}Z" fill="#b8322c"/><path d="M${cx - 0.4} ${py}h.9" stroke="${GOLD}" stroke-width=".5"/>`;
  else if (kind === 4) j += s`<ellipse cx="${cx}" cy="${py + 1.1}" rx=".95" ry="1.15" fill="${GOLD}"/><ellipse cx="${cx - 0.2}" cy="${py + 0.9}" rx=".45" ry=".55" fill="#f0d9a0" opacity=".6"/>`;
  else if (turtle) j += s`<circle cx="${cx}" cy="${py + 0.4}" r=".8" fill="${GOLD}"/>`;
  return j;
}
