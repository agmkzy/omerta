// Hair: the cut, the hairline, the length at the sides and back, and the texture. Every shape is built from the head's anchors
// (half-width, crown, hairline), so it sits on any face. It reports how much it stands off the skull (`vol` above the crown,
// `side` beyond the temples) so a hat can be sized to cover it, and it is drawn inside the hat clip (`#<u>hc`): under a hat
// the hair shows only below the brim, so it never pokes through the crown.
import type { Face } from './face';
import { dk, GREY, lt, LW, mk, s } from './util';

export interface Hair { back: string; front: string; defs: string; vol: number; side: number; bald: boolean }

export function hairOf(F: Face, u: string): Hair {
  const { cx, hw, top, fem, hairC } = F;
  const hSh = dk(hairC, 0.45), hHi = lt(hairC, hairC === '#17120f' || hairC === '#1b1716' ? 0.22 : 0.3);
  const st = F.style;
  let back = '', shape = '', tex = '', bald = false, vol = 2, side = 1;
  const hl = F.hl; // hairline
  // the sideburn: trimmed high, medium, or long and wide (1970)
  const ys = [24.6, 26.2, 28.8][F.hairLen];
  const sbw = [0.9, 1.1, 1.7][F.hairLen];
  const rec0 = F.hairline === 3 ? 3.4 : 0;
  const peak = F.hairline === 1;
  const cap = (th: number, inner: string, sd = 1.1) => s`M${cx - hw - 0.4} ${ys}C${cx - hw - sd} ${top + 6} ${cx - hw * 0.72} ${top - th} ${cx} ${top - th}C${cx + hw * 0.72} ${top - th} ${cx + hw + sd} ${top + 6} ${cx + hw + 0.4} ${ys}` + inner;
  // the hairline, from the right sideburn over the forehead to the left one; a widow's peak meets in a point
  const line = (dip: number, rec = 0) => {
    const r = rec + rec0, yc = hl + dip + (peak ? 1.3 : 0);
    const R = s`L${cx + hw - sbw + 0.4} ${ys}C${cx + hw - sbw + 0.2 - r} ${hl + 1.2 - r} ${cx + hw * 0.5} ${hl - 0.3 - r * 0.5}`;
    const L = s`C${cx - hw * 0.5} ${hl - 0.3 - r * 0.5} ${cx - hw + sbw - 0.2 + r} ${hl + 1.2 - r} ${cx - hw + sbw - 0.4} ${ys}Z`;
    return peak
      ? R + s` ${cx + 1.8} ${hl + dip - 0.1}Q${cx + 0.6} ${hl + dip + 0.2} ${cx} ${yc}Q${cx - 0.6} ${hl + dip + 0.2} ${cx - 1.8} ${hl + dip - 0.1}` + L
      : R + s` ${cx} ${yc}` + L;
  };
  // blobs wound clockwise, the same way as the cap, so they add to it instead of punching holes
  const blob = (x: number, y: number, r: number) => s`M${x - r} ${y}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0`;
  const fuzz = (n: number, rx: number, ry: number, yc: number, rb: number, a0 = 0, a1 = 1) => { let p = ''; for (let i = 0; i <= n; i++) { const a = Math.PI * (a0 + (a1 - a0) * (i / n)); p += blob(cx - Math.cos(a) * rx, yc - Math.sin(a) * ry, rb); } return p; };
  const strands = (n: number, y0: number, y1: number, curve: number, sw = 0.4, o = 0.45) => { let t = ''; for (let i = 0; i < n; i++) { const x = cx - hw * 0.75 + (i / (n - 1)) * hw * 1.5; t += s`M${x} ${y0}Q${x + curve} ${(y0 + y1) / 2} ${x + curve * 0.4} ${y1}`; } return `<path d="${t}" stroke="${hHi}" stroke-width="${sw}" fill="none" opacity="${o}" stroke-linecap="round"/>`; };
  // texture laid over whatever the cut is: waves, curls, or tight curls
  const texture = (y0: number, y1: number) => {
    const tx = F.texture;
    if (tx === 1) { let t = ''; for (let i = 0; i < 5; i++) { const x = cx - hw * 0.72 + i * hw * 0.36, h = (y1 - y0) / 3; t += s`M${x} ${y0}q1.3 ${h * 0.5} 0 ${h}q-1.3 ${h * 0.5} 0 ${h}q1.3 ${h * 0.5} 0 ${h}`; } return `<path d="${t}" stroke="${hHi}" stroke-width="${LW.mid}" fill="none" opacity=".55"/>`; }
    if (tx >= 2) {
      // curls: little arcs of light; tight curls: a close grain of light and dark
      const pr = mk(F.seed + 'c'); let t = '', dd = ''; const n = tx === 3 ? 16 : 13;
      for (let i = 0; i < n; i++) { const x = cx - hw * 0.85 + pr(i) * hw * 1.7, y = y0 + pr(i + 40) * (y1 - y0), r = tx === 3 ? 0.55 : 0.8; t += s`M${x - r} ${y}q${r} ${-r * 1.2} ${r * 2} 0`; if (tx === 3) dd += s`M${x + 0.6} ${y + 0.9}h0`; }
      return `<path d="${t}" stroke="${hHi}" stroke-width="${LW.mid}" fill="none" opacity=".5"/>` + (dd ? `<path d="${dd}" stroke="${hSh}" stroke-width=".7" stroke-linecap="round" opacity=".7"/>` : '');
    }
    return '';
  };
  const curly = F.texture >= 2;
  if (!fem) {
    if (st === 0) { shape = cap(1.7, line(-0.2)); tex = curly ? texture(top - 1, hl) : strands(5, hl - 0.2, top - 1.4, 1.4, 0.35, 0.5); vol = 1.7; side = 0.6;
      tex += s`<path d="M${cx - hw * 0.55} ${top + 2.6}Q${cx - hw * 0.3} ${top - 0.4} ${cx + 1} ${top - 1}" stroke="${lt(hairC, 0.55)}" stroke-width=".7" fill="none" opacity=".35" stroke-linecap="round"/>`; // the shine of the pomade
    } else if (st === 1) {
      const yb = 36.5 + F.hairLen * 1.4;
      shape = cap(2.2, s`L${cx + hw + 1.6} ${yb}Q${cx + hw + 0.4} ${yb + 1.5} ${cx + hw - 0.6} ${yb - 0.5}L${cx + hw - 0.5} 28C${cx + hw - 1.2} ${hl} ${cx + 3} ${hl - 0.6} ${cx + 0.6} ${hl - 0.8}Q${cx - 4} ${hl + 1.6} ${cx - hw + 0.4} ${hl + 3.2}L${cx - hw + 0.5} 28L${cx - hw + 0.6} ${yb - 0.5}Q${cx - hw - 0.4} ${yb + 1.5} ${cx - hw - 1.6} ${yb}Z`, 1.6);
      back = s`<path d="M${cx - hw - 1.4} 30Q${cx - hw - 2.2} ${yb + 1.5} ${cx - hw + 0.4} ${yb + 5.5}H${cx + hw - 0.4}Q${cx + hw + 2.2} ${yb + 1.5} ${cx + hw + 1.4} 30Z" fill="${hSh}"/>`;
      tex = curly ? texture(top - 1.6, hl + 2) : strands(5, top - 1.6, hl + 1, -1.2, 0.35, 0.4); vol = 2.2; side = 1.6;
    } else if (st === 2) { shape = cap(1.2, line(0.8, 2.6)); tex = curly ? texture(top - 1, hl - 1) : strands(4, hl - 1, top - 1, 1, 0.3, 0.4); vol = 1.2; side = 0.4; }
    else if (st === 3) {
      bald = true; vol = 0; side = 0.6;
      const yb = 29.5 + (F.hairLen - 1) * 0.6;
      shape = s`M${cx - hw - 0.5} ${yb}C${cx - hw - 0.9} 25 ${cx - hw - 0.4} 21.5 ${cx - hw + 1.4} 19.6Q${cx - hw + 0.6} 24 ${cx - hw + 0.7} ${yb}ZM${cx + hw + 0.5} ${yb}C${cx + hw + 0.9} 25 ${cx + hw + 0.4} 21.5 ${cx + hw - 1.4} 19.6Q${cx + hw - 0.6} 24 ${cx + hw - 0.7} ${yb}Z`;
    } else if (st === 4) {
      // side part, swept across from the left
      shape = s`M${cx - hw - 0.4} ${ys}C${cx - hw - 1.1} ${top + 5} ${cx - hw * 0.8} ${top - 1} ${cx - 3.4} ${top - 1.4}C${cx + 2} ${top - 3.4} ${cx + hw + 1.6} ${top - 0.4} ${cx + hw + 0.4} ${ys}` + line(-0.4);
      tex = s`<path d="M${cx - 3.4} ${top - 1.2}L${cx - 3.8} ${hl - 0.6}" stroke="${hSh}" stroke-width="${LW.line}"/>` + (curly ? texture(top - 1.4, hl) : strands(5, top - 1.4, hl - 0.6, 2.4, 0.35, 0.45)); vol = 2.2; side = 0.9;
    } else if (st === 5) {
      // pompadour: a tall swept front
      shape = s`M${cx - hw - 0.4} ${ys}C${cx - hw - 1.1} ${top + 5} ${cx - hw * 0.8} ${top - 2} ${cx - 4} ${top - 3.6}C${cx - 1} ${top - 5.6} ${cx + 5} ${top - 5.2} ${cx + 6.4} ${top - 2.6}C${cx + hw + 1} ${top} ${cx + hw + 1.1} ${top + 6} ${cx + hw + 0.4} ${ys}` + line(-0.6);
      tex = strands(5, hl - 0.6, top - 3.4, 2.2, 0.4, 0.5); vol = 5.2; side = 1;
    } else if (st === 6) {
      // curly: a cap of curls, the edge broken into curls
      shape = cap(2.6, line(0.2), 1.6) + fuzz(10, hw + 0.8, 8, top + 5.6, 1.5);
      let ar = ''; for (let i = 0; i < 9; i++) { const x = cx - hw * 0.7 + (i % 5) * hw * 0.35, y = top + (i < 5 ? 0.6 : 3); ar += s`M${x - 0.7} ${y}q.7 -.9 1.4 0`; }
      tex = `<path d="${ar}" stroke="${hHi}" stroke-width="${LW.fine}" fill="none" opacity=".55"/>`; vol = 4; side = 2.4;
    } else if (st === 7) { shape = cap(0.6, line(-0.6, 0.6), 0.6); tex = ''; vol = 0.6; side = 0.4; }
    else if (st === 8) {
      // shaggy: a 1970 mop, a fringe to the brows, over the ears
      const yb = 31 + F.hairLen * 1.2;
      shape = cap(2.6, s`L${cx + hw + 1.4} ${yb}Q${cx + hw + 0.2} ${yb + 1.4} ${cx + hw - 0.6} ${yb - 0.4}L${cx + hw - 0.8} 24Q${cx + hw - 3} 23.6 ${cx + 4} ${hl + 3.6}Q${cx + 1} ${hl + 4.6} ${cx - 2} ${hl + 4}Q${cx - 5} ${hl + 4.4} ${cx - hw + 0.8} 24L${cx - hw + 0.6} ${yb - 0.4}Q${cx - hw - 0.2} ${yb + 1.4} ${cx - hw - 1.4} ${yb}Z`, 1.8);
      back = s`<path d="M${cx - hw - 1.4} 28Q${cx - hw - 1.8} ${yb + 5} ${cx - hw + 1} ${yb + 8}H${cx + hw - 1}Q${cx + hw + 1.8} ${yb + 5} ${cx + hw + 1.4} 28Z" fill="${hSh}"/>`;
      tex = s`<path d="M${cx - 5} ${hl + 3.6}l.6 -3.4M${cx - 1.4} ${hl + 4}l.3 -3.6M${cx + 2.2} ${hl + 3.8}l-.2 -3.6M${cx + 5.6} ${hl + 2.8}l-.6 -3" stroke="${hSh}" stroke-width="${LW.mid}" opacity=".7"/>` + (curly ? texture(top - 2, hl + 2) : strands(4, top - 2, hl + 1, -1.4, 0.35, 0.4)); vol = 2.6; side = 1.8;
    } else if (st === 9) {
      // ducktail: a greased quiff at the front, the sides swept back to a point
      shape = s`M${cx - hw - 0.4} ${ys}C${cx - hw - 1.2} ${top + 5} ${cx - hw * 0.8} ${top - 1.2} ${cx - 3} ${top - 2.4}C${cx - 0.6} ${top - 4} ${cx + 4} ${top - 3.8} ${cx + 4.6} ${top - 1.6}C${cx + hw} ${top - 0.6} ${cx + hw + 1.2} ${top + 5} ${cx + hw + 0.4} ${ys}` + line(-0.5);
      tex = s`<path d="M${cx - hw + 0.6} ${ys - 1}Q${cx - hw + 1} ${top + 4} ${cx - 2} ${top - 1.6}M${cx + hw - 0.6} ${ys - 1}Q${cx + hw - 1} ${top + 4} ${cx + 2} ${top - 1.4}M${cx - 2.4} ${hl}Q${cx - 1} ${top - 1} ${cx + 3.6} ${top - 2}" stroke="${hHi}" stroke-width="${LW.mid}" fill="none" opacity=".5"/>`;
      tex += s`<path d="M${cx - hw * 0.5} ${top + 2}Q${cx - hw * 0.25} ${top - 1} ${cx + 1} ${top - 2.2}" stroke="${lt(hairC, 0.55)}" stroke-width=".7" fill="none" opacity=".35" stroke-linecap="round"/>`;
      vol = 3.2; side = 0.9;
    } else if (st === 10) {
      // an Afro: a full round of tight curls, shaped and picked out
      const R = hw + 3.4 + F.hairLen * 0.5, yc = top + 7.2, ry = 12.2 + F.hairLen * 0.4;
      shape = s`M${cx - R + 0.4} ${yc + 8}C${cx - R - 1.2} ${yc - 2} ${cx - R * 0.7} ${yc - ry} ${cx} ${yc - ry}C${cx + R * 0.7} ${yc - ry} ${cx + R + 1.2} ${yc - 2} ${cx + R - 0.4} ${yc + 8}L${cx + hw - 0.2} ${yc + 8.4}` + s`L${cx + hw - sbw + 0.2} ${ys}C${cx + hw - 1.2} ${hl + 1} ${cx + hw * 0.5} ${hl - 0.4} ${cx} ${hl}C${cx - hw * 0.5} ${hl - 0.4} ${cx - hw + 1.2} ${hl + 1} ${cx - hw + sbw - 0.2} ${ys}L${cx - hw + 0.2} ${yc + 8.4}Z`;
      shape += fuzz(12, R - 0.2, ry - 0.6, yc, 1.3, -0.08, 1.08);
      back = s`<path d="M${cx - R + 0.4} ${yc}Q${cx - R} ${yc + 9} ${cx - hw} ${yc + 10}H${cx + hw}Q${cx + R} ${yc + 9} ${cx + R - 0.4} ${yc}Z" fill="${hSh}"/>`;
      tex = texture(yc - ry + 1, hl + 1); vol = ry - (yc - top) + 0.8; side = R - hw + 0.6;
    } else if (st === 11) {
      // a comb-over: a fringe at the sides and a few long strands laid across the crown from a low part
      bald = true; vol = 0.4; side = 0.6;
      const yb = 29 + (F.hairLen - 1) * 0.6;
      shape = s`M${cx - hw - 0.5} ${yb}C${cx - hw - 0.9} 25 ${cx - hw - 0.6} 20 ${cx - hw + 0.6} ${top + 4.2}Q${cx - hw + 0.8} 22 ${cx - hw + 0.7} ${yb}ZM${cx + hw + 0.5} ${yb}C${cx + hw + 0.9} 25 ${cx + hw + 0.4} 21.5 ${cx + hw - 1.4} 19.6Q${cx + hw - 0.6} 24 ${cx + hw - 0.7} ${yb}Z`;
      let cs = ''; for (let i = 0; i < 5; i++) cs += s`M${cx - hw + 0.5} ${top + 5.6 + i * 0.5}Q${cx - 2 + i * 0.4} ${top - 1.6 + i * 0.9} ${cx + hw - 1.4 - i * 0.3} ${top + 3 + i * 0.7}`;
      tex = `<path d="${cs}" stroke="${hairC}" stroke-width=".5" fill="none" opacity=".8" stroke-linecap="round"/>`;
    } else if (st === 12) {
      // blow-dried: full on top, a side-swept fringe, the sides over the tops of the ears
      const yb = Math.max(ys, 27.6);
      shape = cap(2.8, s`L${cx + hw + 1.2} ${yb}Q${cx + hw + 0.2} ${yb + 0.8} ${cx + hw - 0.7} ${yb - 0.6}L${cx + hw - 0.8} 24.4C${cx + hw - 1.4} ${hl + 0.6} ${cx + 4} ${hl - 0.8} ${cx + 1} ${hl - 0.6}Q${cx - 3.4} ${hl + 0.4} ${cx - hw + 1.2} ${hl + 3.4}L${cx - hw + 0.8} ${yb - 0.6}Q${cx - hw - 0.2} ${yb + 0.8} ${cx - hw - 1.2} ${yb}Z`, 1.9);
      tex = curly ? texture(top - 2, hl + 1) : strands(5, top - 2.2, hl + 1.6, 2.6, 0.4, 0.45);
      tex += s`<path d="M${cx + 1} ${hl - 0.4}Q${cx - 3} ${hl + 0.6} ${cx - hw + 1.4} ${hl + 3}" stroke="${hSh}" stroke-width="${LW.line}" fill="none" opacity=".6"/>`;
      vol = 2.8; side = 1.9;
    } else {
      // brushed forward: short, a straight fringe low on the forehead
      shape = cap(1, s`L${cx + hw - sbw + 0.4} ${ys}C${cx + hw - 1} ${hl + 1.6} ${cx + hw * 0.6} ${hl + 0.9} ${cx + 2} ${hl + 1.2}L${cx} ${hl + 0.8}L${cx - 2} ${hl + 1.3}C${cx - hw * 0.6} ${hl + 1} ${cx - hw + 1} ${hl + 1.6} ${cx - hw + sbw - 0.4} ${ys}Z`, 0.8);
      let t = ''; for (let i = 0; i < 7; i++) { const x = cx - hw * 0.7 + i * hw * 0.23; t += s`M${x} ${top + 0.4}L${x - 0.3} ${hl + 0.9}`; }
      tex = `<path d="${t}" stroke="${hHi}" stroke-width="${LW.fine}" opacity=".45"/>`; vol = 1; side = 0.6;
    }
  } else {
    // women: 1970 styles, set and sprayed or long and straight
    if (st === 0) {
      // bouffant with a flip at the jaw
      shape = s`M${cx - hw - 1} 26C${cx - hw - 4} ${top + 2} ${cx - hw * 0.6} ${top - 5.4} ${cx} ${top - 5.4}C${cx + hw * 0.6} ${top - 5.4} ${cx + hw + 4} ${top + 2} ${cx + hw + 1} 26C${cx + hw + 3} 33 ${cx + hw + 1.4} 37 ${cx + hw + 4} 39.6Q${cx + hw} 41 ${cx + hw - 1} 37L${cx + hw - 0.6} 27C${cx + hw - 1} ${hl} ${cx + 2} ${hl - 0.6} ${cx - 3} ${hl + 0.4}Q${cx - hw + 0.6} ${hl + 2} ${cx - hw + 0.6} 27L${cx - hw + 1} 37Q${cx - hw} 41 ${cx - hw - 4} 39.6C${cx - hw - 1.4} 37 ${cx - hw - 3} 33 ${cx - hw - 1} 26Z`;
      back = s`<path d="M${cx - hw - 2} 28Q${cx} 46 ${cx + hw + 2} 28Z" fill="${hSh}"/>`;
      tex = strands(5, hl, top - 4.6, -2, 0.4, 0.45); vol = 5.4; side = 3.4;
    } else if (st === 1) {
      // long and straight, parted in the middle, past the shoulders
      shape = s`M${cx} ${top - 1.6}C${cx - hw * 0.9} ${top - 1.6} ${cx - hw - 1.8} ${top + 4} ${cx - hw - 1.6} 30L${cx - hw - 2.4} 52H${cx - hw + 2.6}L${cx - hw + 1} 32Q${cx - hw + 0.8} ${hl + 1} ${cx - 0.4} ${hl - 0.6}H${cx + 0.4}Q${cx + hw - 0.8} ${hl + 1} ${cx + hw - 1} 32L${cx + hw - 2.6} 52H${cx + hw + 2.4}L${cx + hw + 1.6} 30C${cx + hw + 1.8} ${top + 4} ${cx + hw * 0.9} ${top - 1.6} ${cx} ${top - 1.6}Z`;
      back = s`<path d="M${cx - hw - 1.6} 28L${cx - hw - 1} 50H${cx + hw + 1}L${cx + hw + 1.6} 28Z" fill="${hSh}"/>`;
      tex = s`<path d="M${cx - hw - 1} 34L${cx - hw - 1.4} 50M${cx + hw + 1} 34L${cx + hw + 1.4} 50M${cx - 0.6} ${top - 1}Q${cx - 4} ${top} ${cx - hw + 1} ${hl + 3}" stroke="${hHi}" stroke-width=".4" fill="none" opacity=".45"/>`; vol = 1.6; side = 1.8;
    } else if (st === 2) {
      // shoulder-length flip with a side part
      shape = s`M${cx - hw - 0.8} 26C${cx - hw - 2.4} ${top + 2} ${cx - hw * 0.6} ${top - 3} ${cx - 2} ${top - 3}C${cx + hw * 0.7} ${top - 3.2} ${cx + hw + 2.6} ${top + 2} ${cx + hw + 1.2} 27C${cx + hw + 2.6} 36 ${cx + hw + 1} 42 ${cx + hw + 4.6} 44.6Q${cx + hw + 1} 46.4 ${cx + hw - 1.2} 42L${cx + hw - 0.8} 27C${cx + hw - 1.6} ${hl} ${cx} ${hl - 1.4} ${cx - 3.6} ${hl - 0.6}Q${cx - hw + 0.8} ${hl + 2.4} ${cx - hw + 0.8} 28L${cx - hw + 1.2} 42Q${cx - hw - 1} 46.4 ${cx - hw - 4.6} 44.6C${cx - hw - 1} 42 ${cx - hw - 2.6} 36 ${cx - hw - 0.8} 26Z`;
      back = s`<path d="M${cx - hw - 1.4} 28Q${cx - hw - 1} 42 ${cx} 43Q${cx + hw + 1} 42 ${cx + hw + 1.4} 28Z" fill="${hSh}"/>`;
      tex = s`<path d="M${cx - 3.6} ${top - 2.6}Q${cx - 3.4} ${top + 1} ${cx - 3.8} ${hl - 0.4}" stroke="${hSh}" stroke-width="${LW.line}" fill="none"/>` + strands(5, top - 2.4, hl + 1, 2.4, 0.35, 0.45); vol = 3; side = 2.6;
    } else if (st === 3) {
      // short set curls, the way the older women wear it
      shape = cap(2.2, s`L${cx + hw + 0.8} 31Q${cx + hw - 0.4} 31.6 ${cx + hw - 0.6} 29L${cx + hw - 0.8} 24C${cx + hw - 1.4} ${hl} ${cx + 3} ${hl - 0.4} ${cx} ${hl + 0.4}C${cx - 3} ${hl - 0.4} ${cx - hw + 1.4} ${hl} ${cx - hw + 0.8} 24L${cx - hw + 0.6} 29Q${cx - hw + 0.4} 31.6 ${cx - hw - 0.8} 31Z`, 2) + fuzz(12, hw + 1, 9, top + 7, 1.7, -0.12, 1.12);
      let ar = ''; for (let i = 0; i < 8; i++) { const x = cx - hw * 0.6 + (i % 4) * hw * 0.4, y = top + (i < 4 ? -0.6 : 2.2); ar += s`M${x - 0.8} ${y}q.8 -1 1.6 0`; }
      tex = `<path d="${ar}" stroke="${hHi}" stroke-width=".4" fill="none" opacity=".5"/>`; vol = 3.6; side = 2.6;
    } else if (st === 4) {
      // swept up into a chignon
      back = s`<circle cx="${cx + 1}" cy="${top - 2.8}" r="4.4" fill="${hSh}"/><circle cx="${cx}" cy="${top - 3.2}" r="3.8" fill="${hairC}"/>`;
      shape = cap(2, s`L${cx + hw - 0.6} ${ys}C${cx + hw - 1} ${hl} ${cx + 4} ${hl - 1} ${cx - 1} ${hl}Q${cx - hw + 1} ${hl + 2.6} ${cx - hw + 0.6} ${ys}Z`, 1.2);
      tex = strands(5, hl, top - 1.6, 1.6, 0.35, 0.45); vol = 7; side = 1.2;
    } else {
      // short and cropped with a wispy fringe
      shape = cap(1.6, s`L${cx + hw + 0.2} 29Q${cx + hw - 0.5} 29.4 ${cx + hw - 0.7} 27L${cx + hw - 0.8} 22Q${cx + 3} ${hl + 1} ${cx + 1} ${hl + 2.6}L${cx - 1} ${hl + 1.6}L${cx - 3} ${hl + 2.8}L${cx - 4.4} ${hl + 1.6}Q${cx - hw + 1} ${hl + 2} ${cx - hw + 0.8} 22L${cx - hw + 0.7} 27Q${cx - hw + 0.5} 29.4 ${cx - hw - 0.2} 29Z`, 1);
      tex = strands(5, top - 1.4, hl + 2, -1, 0.35, 0.45); vol = 1.6; side = 1;
    }
  }
  // curly and tightly curled hair breaks the smooth edge of any cut into curls
  if (!fem && F.texture >= 2 && !bald && st !== 6 && st !== 10 && st !== 3 && st !== 11) {
    const rb = F.texture === 3 ? (st === 7 ? 0.6 : 0.8) : 1.05;
    shape += fuzz(st === 7 ? 13 : 11, hw + (st === 7 ? 0 : 0.35), 5.6 + vol - rb * 0.6, top + 5.6, rb, 0.03, 0.97);
  }
  // long hair at the back of the neck, for the cuts that let it grow
  if (!fem && F.hairLen === 2 && !bald && st !== 1 && st !== 8 && st !== 10 && st !== 7)
    back += s`<path d="M${cx - hw - 0.6} 27Q${cx - hw - 1.2} 33 ${cx - hw + 0.8} 36.6H${cx + hw - 0.8}Q${cx + hw + 1.2} 33 ${cx + hw + 0.6} 27Z" fill="${hSh}"/>`;
  const defs = `<path id="${u}S" d="${shape}"/><clipPath id="${u}r"><use href="#${u}S"/></clipPath>`;
  const rc = `clip-path="url(#${u}r)"`;
  let front = '';
  if (bald) {
    front += s`<ellipse cx="${cx - 3}" cy="${top + 2.4}" rx="3.6" ry="1.3" fill="${lt(F.skin, 0.45)}" opacity=".5"/>`;
    front += `<use href="#${u}S" fill="${hairC}"/><use href="#${u}S" fill="${hSh}" opacity=".5" ${rc}/>`;
    front += tex;
  } else {
    front += `<use href="#${u}S" fill="${hairC}"${st === 7 && !fem ? ' opacity=".85"' : ''}/>`;
    front += tex.replace(/\/>/g, ` ${rc}/>`);
    front += s`<path d="M${cx + 2.6} 0Q${cx + 4.6} ${top + 4} ${cx + hw * 0.6} 30L${cx + hw * 0.4} 64H64V0Z" fill="${hSh}" opacity=".75" ${rc}/>`;
  }
  if (F.grey && !bald) { let g = ''; for (const sx of [-1, 1]) for (let i = 0; i < (F.grey === 2 ? 4 : 3); i++) g += s`M${cx + sx * (hw + 0.6 - i * 0.7)} ${Math.min(26, ys + 0.6) - i * 0.6}Q${cx + sx * (hw - 0.2 - i * 0.6)} ${top + 9 - i} ${cx + sx * (hw - 2.4 - i * 0.9)} ${top + 3 - i * 0.6}`; front += `<path d="${g}" stroke="${F.grey === 2 ? '#d2cec4' : '#a9a59c'}" stroke-width=".7" fill="none" opacity=".85" ${rc}/>`; }
  if (bald && F.grey) front += `<use href="#${u}S" fill="${GREY}" opacity=".6"/>`;
  const hc = `clip-path="url(#${u}hc)"`;
  return { back: back ? `<g ${hc}>${back}</g>` : '', front: `<g ${hc}>${front}</g>`, defs, vol, side, bald };
}
