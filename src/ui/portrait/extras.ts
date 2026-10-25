// What sits on the face: the fronts of his glasses, what is in his mouth, a woman's earrings, and a fresh beating.
import type { Face } from './face';
import { frameColour, lensGeom } from './head';
import { BRASS, dk, LW, s } from './util';

export function lensesOf(F: Face, g: number): string {
  if (!g) return '';
  const { cx, eyeY: ey } = F;
  const { gx, gw, gh, fw } = lensGeom(F, g);
  const aviator = g === 4 || g === 6, round = g === 7, browline = g === 5;
  const lens = (sx: number) => aviator
    ? s`M${cx + sx * 1.1} ${ey - gh}H${cx + sx * (gx + gw)}Q${cx + sx * (gx + gw + 0.3)} ${ey + gh + 0.5} ${cx + sx * gx} ${ey + gh + 0.6}Q${cx + sx * 1.2} ${ey + gh} ${cx + sx * 1.1} ${ey - gh}Z`
    : round
      ? s`M${cx + sx * (gx - gw)} ${ey}a${gw} ${gh + 0.1} 0 1 1 ${sx * 2 * gw} 0a${gw} ${gh + 0.1} 0 1 1 ${-sx * 2 * gw} 0Z`
      : s`M${cx + sx * (gx - gw)} ${ey - gh + 0.2}Q${cx + sx * gx} ${ey - gh - 0.3} ${cx + sx * (gx + gw)} ${ey - gh + 0.2}Q${cx + sx * (gx + gw + 0.2)} ${ey + gh} ${cx + sx * gx} ${ey + gh}Q${cx + sx * (gx - gw - 0.2)} ${ey + gh} ${cx + sx * (gx - gw)} ${ey - gh + 0.2}Z`;
  const frame = frameColour(g);
  const fill = g === 2 ? '#0d0b0c' : g === 4 ? '#3a2a20' : '#d8e4e8';
  const fo = g === 2 ? 0.95 : g === 4 ? 0.62 : 0.1;
  let det = '';
  for (const sx of [-1, 1]) det += `<path d="${lens(sx)}" fill="${fill}" opacity="${fo}"/><path d="${lens(sx)}" fill="none" stroke="${frame}" stroke-width="${fw}"/>`;
  // browline: a heavy top rim over a fine wire below (the accountant, the lawyer, the man who keeps the book)
  if (browline) for (const sx of [-1, 1]) det += s`<path d="M${cx + sx * (gx - gw)} ${ey - gh + 0.3}Q${cx + sx * gx} ${ey - gh - 0.3} ${cx + sx * (gx + gw)} ${ey - gh + 0.3}" stroke="#1e1512" stroke-width="1" fill="none"/>`;
  // the bridge
  det += aviator
    ? s`<path d="M${cx - 1.1} ${ey - gh}H${cx + 1.1}M${cx - 1.2} ${ey - 0.7}Q${cx} ${ey - 1.3} ${cx + 1.2} ${ey - 0.7}" stroke="${frame}" stroke-width="${LW.fine}" fill="none"/>`
    : s`<path d="M${cx - gx + gw - (round ? 0 : 0.1)} ${ey - 0.6}Q${cx} ${ey - 1.3} ${cx + gx - gw + (round ? 0 : 0.1)} ${ey - 0.6}" stroke="${frame}" stroke-width="${Math.min(0.6, fw)}" fill="none"/>`;
  if (g === 2 || g === 4) det += s`<path d="M${cx - gx - 1.2} ${ey - 1}l1.4 -.6M${cx + gx - 1.2} ${ey - 1}l1.4 -.6" stroke="#cfd6dc" stroke-width="${LW.mid}" opacity=".5" stroke-linecap="round"/>`;
  else det += s`<path d="M${cx - gx - 1} ${ey - 0.8}l1.2 -.7" stroke="#fff" stroke-width="${LW.fine}" opacity=".45" stroke-linecap="round"/>`;
  return det;
}

export function habitOf(F: Face, habit: number): string {
  const { cx, mw, my } = F;
  if (habit === 1) return s`<path d="M${cx + mw - 0.6} ${my + 0.3}L${cx + mw + 4.2} ${my + 2.6}" stroke="#e8e0d0" stroke-width=".9" stroke-linecap="round"/><path d="M${cx + mw + 3.6} ${my + 2.3}L${cx + mw + 4.4} ${my + 2.7}" stroke="#d2692a" stroke-width=".95" stroke-linecap="round"/><path d="M${cx + mw + 4.6} ${my + 1.8}q1 -2 -.2 -4q-1 -2 .6 -4.4" stroke="#cfc6b6" stroke-width="${LW.mid}" fill="none" opacity=".35" stroke-linecap="round"/>`;
  if (habit === 2) return s`<path d="M${cx + mw - 0.8} ${my + 0.2}L${cx + mw + 3.4} ${my + 1.6}" stroke="#d8c08a" stroke-width="${LW.fine}" stroke-linecap="round"/>`;
  if (habit === 3) return s`<path d="M${cx + mw - 0.8} ${my + 0.4}L${cx + mw + 4.6} ${my + 2.4}" stroke="#4a2c1a" stroke-width="1.7" stroke-linecap="round"/><path d="M${cx + mw - 0.4} ${my + 0.1}L${cx + mw + 4.4} ${my + 1.9}" stroke="#7a4a2a" stroke-width="${LW.line}" stroke-linecap="round"/><path d="M${cx + mw + 0.6} ${my}l.1 1.6" stroke="#b9965c" stroke-width=".7"/><circle cx="${cx + mw + 4.9}" cy="${my + 2.5}" r=".6" fill="#8a8580"/>`;
  return '';
}

export const earringsOf = (F: Face) => s`<circle cx="${F.cx - F.earX}" cy="${F.earY + F.earRy * 0.85}" r=".75" fill="${BRASS}"/><circle cx="${F.cx + F.earX}" cy="${F.earY + F.earRy * 0.85}" r=".75" fill="${dk(BRASS, 0.3)}"/>`;

export function bruiseOf(F: Face): string {
  const { cx, eyeY: ey, top, mw, my } = F;
  const bx = cx - F.eyeDX;
  let o = s`<ellipse cx="${bx}" cy="${ey + 0.6}" rx="3.1" ry="2.5" fill="#5a3350" opacity=".38"/><ellipse cx="${bx + 0.2}" cy="${ey + 1.1}" rx="2" ry="1.4" fill="#6e2f3a" opacity=".35"/>`;
  o += s`<g transform="rotate(-24 ${cx + 4.6} ${top + 7})"><rect x="${cx + 2.4}" y="${top + 6.1}" width="4.6" height="1.8" rx=".5" fill="#dccdb0"/><rect x="${cx + 4}" y="${top + 6.1}" width="1.4" height="1.8" fill="#c8b590"/></g>`;
  o += s`<path d="M${cx + mw - 1.2} ${my + 0.9}l.6 .5" stroke="#7a1f24" stroke-width=".7" stroke-linecap="round"/>`;
  return o;
}
