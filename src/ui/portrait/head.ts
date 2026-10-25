// The head: ears, skin, the planes of light, eyes, brows, nose, mouth, the years and the marks. One warm key light from the
// left; the right of the face falls into a hard shadow plane. Every feature is placed from the anchors in face.ts.
import type { Character } from '../../types';
import type { Face } from './face';
import { BRASS, dk, INK, LW, mix, mk, pick, s } from './util';

export interface Temper { tilt: number; smile: number; squint: number }
export function temperOf(c: Character, F: Face): Temper {
  const T = c.traits ?? ({} as Character['traits']);
  const hard = Math.max(-0.5, Math.min(0.8, (T.violence ?? 0.4) - (T.sociability ?? 0.5) * 0.5));
  const tilt = F.fem ? -0.1 : hard > 0.15 ? 0.25 + hard * 0.9 : hard < -0.2 ? -0.3 : 0.1;
  let smile = F.fem ? 0.35 : (T.sociability ?? 0.5) > 0.55 && (T.violence ?? 0.4) < 0.6 ? 0.55 : hard > 0.25 ? -0.4 : 0.05;
  if (F.mouth === 4) smile -= 0.75;
  const squint = (T.caution ?? 0.5) > 0.7 || hard > 0.45 ? 0.82 : 1;
  return { tilt, smile, squint };
}

export function neckOf(F: Face): string {
  const { cx, nw, chin, chinW, sk, skin } = F;
  let n = s`<path d="M${cx - nw} ${F.jawY - 3.4}L${cx - nw - 0.4} 48H${cx + nw + 0.4}L${cx + nw} ${F.jawY - 3.4}Z" fill="${skin}"/>`;
  n += s`<path d="M${cx + nw * 0.25} 38Q${cx + nw * 0.6} 42 ${cx + nw * 0.4} 48H${cx + nw + 0.4}L${cx + nw} ${F.jawY - 3.4}Z" fill="${sk.sh}"/>`;
  // the jaw's shadow falls on the throat
  n += s`<path d="M${cx - nw} 37Q${cx} ${chin + 3.2} ${cx + nw} 37V${F.jawY - 3.4}H${cx - nw}Z" fill="${sk.dp}" opacity=".7"/>`;
  if (!F.fem && F.build >= 3) n += s`<path d="M${cx - chinW - 2.5} ${chin + 0.4}Q${cx} ${chin + 2.6} ${cx + chinW + 2.5} ${chin + 0.4}" stroke="${sk.dp}" stroke-width="${LW.line}" fill="none" opacity=".6"/>`;
  return n;
}

export function headOf(c: Character, F: Face, u: string): { face: string; defs: string } {
  const { cx, fem, skin, hw, top, chin, jawW, chinW, sk } = F;
  const { tilt, smile, squint } = temperOf(c, F);
  const hc = `clip-path="url(#${u}h)"`;
  let face = '';
  // ---- ears, one crease line for both, on the ear line the face gives them
  const erx = F.earRx, ery = F.earRy, exl = cx - F.earX, exr = cx + F.earX, ey0 = F.earY;
  face += s`<ellipse cx="${exl}" cy="${ey0}" rx="${erx}" ry="${ery}" fill="${skin}"/><ellipse cx="${exr}" cy="${ey0}" rx="${erx}" ry="${ery}" fill="${sk.sh}"/>`;
  face += s`<path d="M${exl - 0.2} ${ey0 - ery * 0.7}Q${exl - 1} ${ey0 - 0.1} ${exl - 0.2} ${ey0 + ery * 0.7}M${exr + 0.2} ${ey0 - ery * 0.7}Q${exr + 1} ${ey0 - 0.1} ${exr + 0.2} ${ey0 + ery * 0.7}" stroke="${sk.dp}" stroke-width="${LW.mid}" fill="none" opacity=".7"/>`;
  face += `<use href="#${u}H" fill="${skin}"/>`;
  // the shadow side: a hard plane down the right of the face
  face += s`<path d="M${cx + 2.6} ${top - 1}C${cx + 4.6} ${top + 6} ${cx + hw * 0.62} 22 ${cx + hw * 0.56} 28C${cx + hw * 0.52} 33 ${cx + 4} 36 ${cx + 2.4} 40.6L${cx + 0.6} ${chin + 1}H64V${top - 1}Z" fill="${sk.sh}" ${hc}/>`;
  // cheekbone hollows (deeper on lean, long and old faces) and, on round and heavy faces, the fullness of the cheek
  const hollow = F.build === 0 || F.jaw === 2 || F.age >= 2 || F.head === 2 || F.head === 4 ? 0.22 : 0.1;
  face += s`<path d="M${cx - F.cheekW + 0.6} 31.6Q${cx - hw * 0.62} 34.6 ${cx - hw * 0.45} 35.2Q${cx - hw * 0.7} 33.2 ${cx - F.cheekW + 0.6} 31.6Z" fill="${sk.sh}" opacity="${hollow}"/>`;
  face += s`<ellipse cx="${cx - hw * 0.55}" cy="${F.nb - 0.6}" rx="${hw * 0.22}" ry="1.3" fill="${sk.hi}" opacity="${F.head === 1 || F.build >= 2 ? 0.12 : 0.07}"/>`;
  if (F.build >= 3) face += s`<path d="M${cx - jawW - 0.6} 35Q${cx - jawW + 0.6} 39.4 ${cx - chinW - 1} ${chin - 0.6}M${cx + jawW + 0.6} 35Q${cx + jawW - 0.6} 39.4 ${cx + chinW + 1} ${chin - 0.6}" stroke="${sk.dp}" stroke-width="${LW.line}" fill="none" opacity=".45"/>`;
  // eye sockets: deep-set eyes sit in real shadow
  const sock = F.eyes === 1 ? 0.55 : 0.32;
  const ey = F.eyeY, ew = F.ew, eh = F.eh * squint;
  face += s`<ellipse cx="${cx - F.eyeDX}" cy="${ey - 0.3}" rx="${ew + 1.1}" ry="${F.eh + 0.9}" fill="${sk.sh}" opacity="${sock}"/><ellipse cx="${cx + F.eyeDX}" cy="${ey - 0.3}" rx="${ew + 1.1}" ry="${F.eh + 0.9}" fill="${sk.dp}" opacity="${sock + 0.03}"/>`;
  // a warm rim of light down the shadow edge
  face += s`<path d="M${cx + hw} 22C${cx + hw} 31.5 ${cx + F.cheekW * 0.97} 34 ${cx + jawW} ${F.jawY}" stroke="${BRASS}" stroke-width=".7" fill="none" opacity=".28" ${hc}/>`;

  // ---- eyes: each kind of mark is one path for both eyes
  const iry = Math.min(0.92, eh * (F.eyes === 3 ? 0.7 : 0.62)), irx = F.eyes === 3 ? 1 : 0.95;
  const oval = (x: number, y: number, rx: number, ry: number) => s`M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
  let iris = '', pup = '', glint = '', lid = '', flick = '', crease = '', lower = '', open = '';
  const lidCover = F.eyes === 2 ? 0.25 : 0; // hooded: the lid hangs over the top of the iris
  for (const sx of [-1, 1]) {
    const ex = cx + sx * F.eyeDX, ix = ex + 0.15;
    const o = s`M${ex - ew} ${ey}Q${ex} ${ey - eh * 1.5} ${ex + ew} ${ey}Q${ex} ${ey + eh} ${ex - ew} ${ey}Z`;
    open += o;
    face += `<path d="${o}" fill="${sx < 0 ? mix(skin, '#e9e0cf', 0.5) : mix(skin, '#b8ab98', 0.45)}"/>`;
    iris += oval(ix, ey - 0.05 + lidCover * 0.5, irx, iry); pup += s`M${ix} ${ey - 0.05 + lidCover * 0.5}h0`; glint += s`M${ix - 0.35} ${ey - 0.35 + lidCover}h0`;
    lid += s`M${ex - ew - 0.25} ${ey + 0.15}Q${ex} ${ey - eh * (1.62 - lidCover * 1.6)} ${ex + ew + 0.25} ${ey - 0.05}`;
    if (fem) flick += s`M${ex + sx * (ew + 0.1)} ${ey}L${ex + sx * (ew + 1)} ${ey - 0.7}`;
    crease += F.hooded && !fem ? s`M${ex - ew + 0.2} ${ey - eh * 0.9}Q${ex} ${ey - eh * 1.9} ${ex + ew} ${ey - eh * 0.75}` : F.eyes === 1 ? s`M${ex - ew - 0.2} ${ey - eh * 1.2}Q${ex} ${ey - eh * 2.6} ${ex + ew + 0.2} ${ey - eh * 1.1}` : s`M${ex - ew + 0.5} ${ey - eh * 1.35}Q${ex} ${ey - eh * 2.2} ${ex + ew - 0.2} ${ey - eh * 1.2}`;
    lower += s`M${ex - ew + 0.4} ${ey + eh * 0.75}Q${ex} ${ey + eh * 1.2} ${ex + ew - 0.3} ${ey + eh * 0.6}`;
  }
  // clip the iris to the eye opening so a round or hooded eye never shows iris on skin
  const defs = `<clipPath id="${u}e"><path d="${open}"/></clipPath>`;
  face += `<g clip-path="url(#${u}e)"><path d="${iris}" fill="${F.iris}"/><path d="${pup}" stroke="#0e0909" stroke-width=".84" stroke-linecap="round"/></g><path d="${glint}" stroke="#f4ead8" stroke-width=".44" opacity=".8" stroke-linecap="round"/>`;
  if (lidCover) for (const sx of [-1, 1]) { const ex = cx + sx * F.eyeDX; face += s`<path d="M${ex - ew - 0.2} ${ey + 0.1}Q${ex} ${ey - eh * 1.7} ${ex + ew + 0.2} ${ey}Q${ex} ${ey - eh * 0.7} ${ex - ew - 0.2} ${ey + 0.1}Z" fill="${sx < 0 ? skin : sk.sh}"/>`; }
  face += `<path d="${lid}" stroke="${INK}" stroke-width="${fem ? 0.8 : 0.7}" fill="none" stroke-linecap="round"/>`;
  if (fem) face += `<path d="${flick}" stroke="${INK}" stroke-width=".55" stroke-linecap="round"/>`;
  face += `<path d="${crease}" stroke="${sk.dp}" stroke-width="${F.hooded && !fem ? LW.mid : LW.fine}" fill="none" opacity="${F.hooded && !fem ? 0.75 : F.eyes === 1 ? 0.7 : 0.45}"/>`;
  if (F.age >= 2 || F.eyes === 1) face += s`<path d="${lower}" stroke="${sk.dp}" stroke-width="${LW.fine}" fill="none" opacity="${0.35 + F.age * 0.12}"/>`;

  // ---- brows: tapered strokes, thick at the inner end
  const bt = [1.55, 1, 0.85, 0.45, 1.9, 1.25][F.brows] * (fem ? 0.75 : 1);
  const arch = [0.3, 0.15, 0.9, 0.6, 0.4, 0][F.brows];
  const by = F.browY;
  const bTilt = F.brows === 5 ? tilt * 0.5 : tilt;
  let brow = '';
  for (const sx of [-1, 1]) {
    const ix = cx + sx * (F.brows === 4 ? 1.2 : 1.5), ox = cx + sx * (F.eyeDX + ew + 1.1), iy = by + bTilt * 0.8, oy = by + 0.5 - bTilt * 0.2, mx = cx + sx * (F.eyeDX + 0.4), myy = by - arch;
    brow += s`M${ix} ${iy + bt * 0.5}Q${mx} ${myy + bt * 0.6} ${ox} ${oy + 0.2}Q${mx} ${myy - bt * 0.55} ${ix} ${iy - bt * 0.55}Z`;
  }
  face += `<path d="${brow}" fill="${F.brow}"/>`;

  // ---- nose: a lit ridge, a shadowed flank, a dark underside. The shape is what tells one man from another.
  const nb = F.nb, nwd = F.nwd;
  const nx = F.nose === 3 ? 0.55 : 0; // a boxer's nose sits a little off true
  const drop = [0.55, 1.1, 0.5, 0.35, 0.15, 1.5, -0.15, 0.9][F.nose];
  const bump = F.nose === 1 ? 1 : F.nose === 5 ? 1.5 : 0;
  face += s`<path d="M${cx + 0.5} 27.3Q${cx + 1.3 + bump} 30 ${cx + nx + nwd * 0.85} ${nb - 0.4}L${cx + nx + 0.3} ${nb - 0.7}Q${cx + 0.5 + nx * 0.5} 30 ${cx} 27.5Z" fill="${sk.sh}"/>`;
  if (F.nose === 1 || F.nose === 5) face += s`<path d="M${cx + 0.6} 28.2Q${cx + 1 + bump} 29.6 ${cx + 1.2} ${31.4 + (F.nose === 5 ? 0.6 : 0)}" stroke="${sk.dp}" stroke-width="${LW.line}" fill="none" opacity=".7"/>`;
  if (F.nose === 3) face += s`<path d="M${cx - 0.6} 29.4l1 .5" stroke="${sk.dp}" stroke-width="${LW.mid}" opacity=".7"/>`;
  face += s`<path d="M${cx - 0.5} 27.8Q${cx - 0.9 + nx} 30.4 ${cx - 0.7 + nx} ${nb - 1.6}" stroke="${sk.lt}" stroke-width="${LW.line}" fill="none" opacity=".7" stroke-linecap="round"/>`;
  face += s`<ellipse cx="${cx + nx - 0.3}" cy="${nb - 0.6 + (F.nose === 6 ? -0.2 : 0)}" rx="${nwd * 0.42}" ry=".6" fill="${sk.lt}" opacity=".45"/>`;
  face += s`<path d="M${cx + nx - nwd} ${nb - 0.3}Q${cx + nx - nwd - 0.4} ${nb + 0.4} ${cx + nx - nwd * 0.45} ${nb + 0.55}Q${cx + nx} ${nb + drop + 0.4} ${cx + nx + nwd * 0.45} ${nb + 0.55}Q${cx + nx + nwd + 0.4} ${nb + 0.4} ${cx + nx + nwd} ${nb - 0.3}Q${cx + nx} ${nb + 0.2} ${cx + nx - nwd} ${nb - 0.3}Z" fill="${sk.dp}" opacity=".8"/>`;
  face += s`<path d="M${cx + nx - nwd} ${nb - 0.4}Q${cx + nx - nwd - 0.6} ${nb - 1.4} ${cx + nx - nwd + 0.4} ${nb - 2}M${cx + nx + nwd} ${nb - 0.4}Q${cx + nx + nwd + 0.6} ${nb - 1.4} ${cx + nx + nwd - 0.4} ${nb - 2}" stroke="${sk.dp}" stroke-width="${LW.mid}" fill="none" opacity=".8"/>`;
  if (F.nose === 6) face += s`<path d="M${cx + nx - nwd * 0.5} ${nb + 0.1}h0M${cx + nx + nwd * 0.5} ${nb + 0.1}h0" stroke="${dk(skin, 0.75)}" stroke-width=".7" stroke-linecap="round" opacity=".7"/>`;
  // the nose throws its shadow down and to the right
  face += s`<path d="M${cx + nx + 0.4} ${nb + 0.9}Q${cx + nx + 2.2} ${nb + 1.2} ${cx + nx + 3} ${nb + 0.1}Q${cx + nx + 2} ${nb + 1.9} ${cx + nx + 0.4} ${nb + 0.9}Z" fill="${sk.dp}" opacity=".35"/>`;

  // ---- the years, one path
  const ln = (dd: string, o: number, w = 0.4) => s`<path d="${dd}" stroke="${sk.dp}" stroke-width="${w}" fill="none" opacity="${fem ? o * 0.55 : o}"/>`;
  let lines = '';
  if (F.age >= (fem ? 2 : 1)) lines += s`M${cx - nwd - 0.5} ${nb - 0.3}Q${cx - nwd - 1.7} ${nb + 1.6} ${cx - F.mw - 0.5} ${F.my + 0.4}M${cx + nwd + 0.5} ${nb - 0.3}Q${cx + nwd + 1.7} ${nb + 1.6} ${cx + F.mw + 0.5} ${F.my + 0.4}`;
  if (F.age >= 2) lines += (F.age >= 3 ? s`M${cx - 4.6} ${top + 5.6}Q${cx} ${top + 5} ${cx + 4.6} ${top + 5.6}M${cx - 3.6} ${top + 7}Q${cx} ${top + 6.6} ${cx + 3.6} ${top + 7}` : s`M${cx - 4} ${top + 6.2}Q${cx} ${top + 5.7} ${cx + 4} ${top + 6.2}`) + s`M${cx - F.eyeDX - 1} ${ey + 1.7}Q${cx - F.eyeDX} ${ey + 2.6} ${cx - F.eyeDX + 1.4} ${ey + 2}M${cx + F.eyeDX - 1.4} ${ey + 2}Q${cx + F.eyeDX} ${ey + 2.6} ${cx + F.eyeDX + 1} ${ey + 1.7}`;
  if (F.age >= 3) lines += s`M${cx - F.eyeDX - ew - 0.5} ${ey}l-1.3 -.5M${cx - F.eyeDX - ew - 0.5} ${ey + 0.5}l-1.3 .4M${cx + F.eyeDX + ew + 0.5} ${ey}l1.3 -.5M${cx + F.eyeDX + ew + 0.5} ${ey + 0.5}l1.3 .4M${cx - jawW + 1} ${F.jawY - 1.8}q.6 1.6 1.8 2.2M${cx + jawW - 1} ${F.jawY - 1.8}q-.6 1.6 -1.8 2.2`;
  if (lines) face += ln(lines, [0, 0.22, 0.34, 0.45][F.age]);
  if (tilt > 0.75) face += ln(s`M${cx - 0.6} ${by - 0.4}l-.2 1.6M${cx + 0.6} ${by - 0.4}l.2 1.6`, 0.55); // the furrow of a hard man

  // ---- mouth
  const my = F.my, mw = F.mw, lw = F.lipW;
  const lipD = fem ? pick(mk(F.seed + 'l')(0), ['#9a3a3c', '#a2433f', '#8a3040', '#b05a4a']) : mix(skin, '#6e3030', F.mouth === 2 ? 0.42 : 0.34);
  const lipL = fem ? mix(lipD, '#f6e7cc', 0.12) : mix(skin, '#9a5048', F.mouth === 2 ? 0.3 : 0.2);
  face += s`<path d="M${cx - mw} ${my}Q${cx - mw * 0.45} ${my - 1.15 * lw} ${cx} ${my - 0.65 * lw}Q${cx + mw * 0.45} ${my - 1.15 * lw} ${cx + mw} ${my}Q${cx} ${my + smile * 0.7} ${cx - mw} ${my}Z" fill="${dk(lipD, 0.15)}"/>`;
  face += s`<path d="M${cx - mw * 0.82} ${my + 0.15}Q${cx} ${my + 1.7 * lw + smile * 0.3} ${cx + mw * 0.82} ${my + 0.15}Q${cx} ${my + smile * 0.6} ${cx - mw * 0.82} ${my + 0.15}Z" fill="${lipL}"/>`;
  face += s`<path d="M${cx - mw - 0.2} ${my - smile * 0.25}Q${cx} ${my + smile * 0.85} ${cx + mw + 0.2} ${my - smile * 0.25}" stroke="${INK}" stroke-width="${LW.line}" fill="none" opacity=".85" stroke-linecap="round"/>`;
  face += s`<path d="M${cx - 1.6} ${my + 2.3 * lw + 0.2}Q${cx} ${my + 2.9} ${cx + 1.6} ${my + 2.3 * lw + 0.2}" stroke="${sk.dp}" stroke-width="${LW.line}" fill="none" opacity=".45"/>`;
  if (fem) face += s`<path d="M${cx - mw * 0.4} ${my + 0.9}Q${cx - mw * 0.1} ${my + 1.3} ${cx + mw * 0.1} ${my + 1}" stroke="#f4dccb" stroke-width="${LW.fine}" fill="none" opacity=".5"/>`;
  if (F.mouth === 4) face += ln(s`M${cx - mw - 0.3} ${my + 0.2}l-.4 1.1M${cx + mw + 0.3} ${my + 0.2}l.4 1.1`, 0.5);
  // a chin cleft for some square jaws
  if (!fem && F.jaw === 0) face += ln(s`M${cx} ${chin - 1.4}v.9`, 0.45);

  // ---- marks
  const scar = mix(skin, '#f0cdb8', 0.6);
  if (F.mark === 1) face += s`<path d="M${cx - F.cheekW * 0.68} ${F.nb - 2.3}L${cx - F.cheekW * 0.45} ${F.nb + 2.7}" stroke="${sk.dp}" stroke-width="1.3" opacity=".55"/><path d="M${cx - F.cheekW * 0.7} ${F.nb - 2.5}L${cx - F.cheekW * 0.47} ${F.nb + 2.5}" stroke="${scar}" stroke-width=".75"/>`;
  if (F.mark === 2) face += s`<path d="M${cx - F.eyeDX - 0.2} ${by - 2}L${cx - F.eyeDX - 1} ${ey - 0.9}M${cx - F.eyeDX - 1.2} ${ey + 1.1}L${cx - F.eyeDX - 1.6} ${ey + 2.6}" stroke="${scar}" stroke-width=".8"/>`;
  if (F.mark === 3) face += s`<circle cx="${cx - mw - 1.1}" cy="${my - 1.6}" r=".45" fill="${dk(skin, 0.7)}"/>`;
  if (F.mark === 4) { const pr = mk(F.seed + 'p'); let pm = ''; for (let i = 0; i < 10; i++) pm += s`M${cx + (i % 2 ? 1 : -1) * (3.4 + pr(i) * 4)} ${F.nb - 2.3 + pr(i + 20) * 5.4}h0`; face += `<path d="${pm}" stroke="${sk.dp}" stroke-width=".8" opacity=".6" stroke-linecap="round"/>`; }
  if (F.mark === 5) face += s`<path d="M${cx + mw * 0.35} ${my - 1.9 * lw}L${cx + mw * 0.45} ${my + 1.6 * lw}" stroke="${scar}" stroke-width=".6" opacity=".9"/>`;
  if (F.mark === 6) { const pr = mk(F.seed + 'f'); let pm = ''; for (let i = 0; i < 16; i++) { const sx = i % 2 ? 1 : -1; pm += s`M${cx + sx * (1.4 + pr(i) * 4.6)} ${F.nb - 3 + pr(i + 30) * 2.8}h0`; } face += `<path d="${pm}" stroke="${dk(skin, 0.35)}" stroke-width=".5" opacity=".7" stroke-linecap="round"/>`; }

  return { face, defs };
}

// Glasses arms run from the lens to the top of the ear; they are painted under the hair, so long hair covers them.
export function armsOf(F: Face, glasses: number): string {
  if (!glasses) return '';
  const g = lensGeom(F, glasses), { cx } = F;
  return s`<path d="M${cx - g.gx - g.gw} ${F.eyeY - 0.9}L${cx - F.earX + 0.2} ${F.earY - F.earRy * 0.55}M${cx + g.gx + g.gw} ${F.eyeY - 0.9}L${cx + F.earX - 0.2} ${F.earY - F.earRy * 0.55}" stroke="${frameColour(glasses)}" stroke-width="${Math.min(0.6, g.fw)}" fill="none"/>`;
}

export const frameColour = (g: number) => (['', '#8f8676', '#141012', '#1e1512', '#b59a62', '#1e1512', '#b8a273', '#9a8a6a'] as const)[g] ?? '#8f8676';
export const lensGeom = (F: Face, g: number) => ({ gx: F.eyeDX + (g === 4 || g === 6 ? 0.1 : 0), gw: F.ew + (g === 7 ? 0.7 : 1.1), gh: g === 3 ? 2.1 : g === 7 ? 1.7 : 1.9, fw: [0, 0.4, 0.7, 0.85, 0.4, 0.45, 0.35, 0.35][g] ?? 0.4 });
