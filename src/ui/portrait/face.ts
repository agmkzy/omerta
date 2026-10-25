// The face: every feature resolved to a number, and the anchors every other layer fits itself to.
// It comes from the man's seed (his id, or the look he chose) and never from his rank, so a promotion changes his clothes and
// never his face. Old channels keep their numbers: an NPC from an older save keeps his complexion, hair, haircut, beard and jaw.
import type { Character } from '../../types';
import { FEMALE } from '../../names';
import { HAIR_LIST, IRIS_LIST, LIMIT, SKIN_LIST, type LookX } from './options';
import { bez, dk, fm, GREY, lt, mix, mk, opt, pick, wpick } from './util';

const NPC_HAIR = ['#17120f', '#1b1716', '#2a1c14', '#2a1c14', '#412a1b', '#5a3a22', '#6d4b2c', '#6a3b22'];
const FEM_HAIR = ['#17120f', '#2a1c14', '#412a1b', '#5a3a22', '#6a3b22', '#8a5a2a', '#a8854e', '#7a3b22'];

export interface Face {
  fem: boolean; seed: string;
  // features, every one resolved
  skinI: number; skin: string; sk: { sh: string; dp: string; lt: string; hi: string };
  hairBase: string; hairC: string; brow: string; grey: number; hairI: number | null;
  style: number; beard: number; build: number; jaw: number; head: number; nose: number; brows: number; age: number; mark: number;
  eyes: number; irisI: number; iris: string; mouth: number; hairline: number; hairLen: number; texture: number;
  // anchors (64 x 64 canvas, centre line x = 32)
  cx: number; hw: number; top: number; cheekW: number; jawW: number; jawY: number; chinW: number; chin: number;
  eyeY: number; eyeDX: number; ew: number; eh: number; browY: number; nb: number; nwd: number; mw: number; my: number; lipW: number;
  earX: number; earY: number; earRx: number; earRy: number; nw: number; hl: number; nl: number; bo: number; hooded: boolean;
  headPath: string;
  halfAt: (y: number) => number; // half the width of the skull at height y (above the ears)
}

export const isFem = (c: Character) => FEMALE.includes((c.name || '').split(' ')[0]);
export const seedOf = (c: Character) => ((c.look ?? {}) as LookX).seed ?? c.id ?? 'x';

export function faceOf(c: Character): Face {
  const lk = (c.look ?? {}) as LookX;
  const seed = seedOf(c);
  const r = mk(seed);
  const fem = isFem(c);
  const o = (k: keyof LookX & string) => opt(lk[k], LIMIT[k]);
  // ---- the original channels (1-26), unchanged
  const skinI = o('skin') ?? wpick(r(1), [1.2, 2, 2.4, 1.4, 0.6, 0.4]);
  const skin = SKIN_LIST[skinI];
  // an old save chose a hair colour but never an age: keep him as he was chosen, not greyed by the dice
  const age = o('age') ?? (lk.hairColour != null ? 1 : wpick(r(2), fem ? [3, 3, 2, 1.2] : [2.6, 3.2, 2.4, 1.4]));
  const build = o('build') ?? (fem ? wpick(r(3), [3, 3, 1, 0]) : Math.min(3, wpick(r(3), [2.4, 3.4, 2, 0.8]) + (age >= 2 && r(4) < 0.35 ? 1 : 0)));
  const jaw = o('jaw') ?? (fem ? 2 : wpick(r(5), [1, 1.2, 1]));
  // (the newer noses, brows and marks also stand in only for an older one of the same kind)
  const nose0 = o('nose') ?? (fem ? pick(r(6), [0, 0, 4, 4, 1, 6]) : wpick(r(6), [3, 2.4, 2, 1, 1.6]));
  const nose = lk.nose != null || fem || r(48) >= 0.3 ? nose0 : ({ 0: 7, 1: 5, 4: 6 } as Record<number, number>)[nose0] ?? nose0;
  const brows0 = o('brows') ?? (fem ? pick(r(7), [2, 2, 3]) : wpick(r(7), [2, 3, 1.4, 1]));
  const brows = lk.brows != null || fem || r(50) >= 0.3 ? brows0 : ({ 0: 4, 1: 5 } as Record<number, number>)[brows0] ?? brows0;
  const mark0 = o('mark') ?? (fem ? (r(8) < 0.06 ? 3 : 0) : wpick(r(8), [16, 1.2, 0.8, 1, 0.7]));
  const mark = lk.mark != null || fem || r(52) >= 0.4 ? mark0 : mark0 === 1 ? 5 : mark0;
  const hci = o('hairColour');
  const fair = skinI === 0 || skinI === 6 || skinI === 7;
  let hairBase = hci != null ? HAIR_LIST[hci] : pick(r(9), fem ? FEM_HAIR : NPC_HAIR);
  // a fair man dealt one of the lighter browns may be sandy or ginger instead
  if (hci == null && fair && !fem && ['#5a3a22', '#6d4b2c', '#6a3b22'].includes(hairBase) && r(47) < 0.45) hairBase = pick(r(54), [HAIR_LIST[6], HAIR_LIST[7]]);
  if (hci === 8) hairBase = '#2a2420'; // salt and pepper: a dark base, greyed below
  // Greying follows age: the temples go first, then the rest.
  const grey = hci === 5 || hci === 9 ? 0 : hci === 8 ? 2 : age >= 3 ? 2 : age === 2 && (lk.age != null || r(10) < 0.6) ? 1 : 0;
  const hairC = grey === 2 ? mix(hairBase, GREY, 0.55) : hairBase;
  const dark = skinI === 4 || skinI === 5 || skinI === 9;
  const MSTYLE = age >= 2 ? [3, 0.4, 2.4, 1, 2.4, 0.4, 0.5, 1.2, 0.2] : [3, 1, 0.3, 0.1, 2.4, 1.3, 1.2, 0.8, 1.2];
  let style: number, texture: number;
  if (fem) { style = age >= 3 ? pick(r(11), [3, 3, 4, 0]) : age === 2 ? pick(r(11), [0, 2, 3, 4, 5]) : pick(r(11), [0, 1, 1, 2, 2, 4, 5]); texture = o('texture') ?? 0; }
  else {
    // the old dice first, so a man from an older save keeps his haircut; the newer cuts only ever stand in for a cut of the
    // same kind (a slicked-back man may wear it as a ducktail, a side part may be blow-dried, a receding man may comb it over)
    const chosen = o('style');
    style = chosen ?? wpick(r(11), MSTYLE);
    texture = o('texture') ?? (style === 6 ? (dark ? 3 : 2) : dark ? wpick(r(45), [0.6, 0.8, 1.6, 3]) : wpick(r(45), [6, 2.2, 0.9, 0.1]));
    if (chosen == null) {
      const v = r(46);
      if (style === 0 && v < 0.2) style = 9;
      else if (style === 4 && v < 0.3) style = v < 0.18 ? 12 : 13;
      else if (style === 8 && v < 0.25) style = 12;
      else if (style === 2 && age >= 2 && v < 0.35) style = 11;
      else if (style === 7 && v < 0.2) style = 13;
      else if (style === 6 && texture === 3 && age < 2 && v < 0.55) style = 10;
    }
  }
  const beard0 = fem ? 0 : o('beard') ?? wpick(r(12), [12, 3.4, 2, 0.5, 1.4, 0.4, 0.5]);
  // the newer beards stand in for an old one of the same kind: a moustache stays a moustache
  let beard = beard0;
  if (!fem && lk.beard == null) {
    const v = r(57);
    if (beard0 === 1 && v < 0.4) beard = pick(r(58), [7, 8, 8, 9]);
    else if (beard0 === 3 && v < 0.35) beard = 10;
    else if (beard0 === 6 && v < 0.4) beard = 11;
  }
  const head = o('head') ?? (fem ? wpick(r(40), [4, 2, 1, 0, 1.4]) : wpick(r(40), [4, 1.6, 1.6, 1.4, 1]));
  const hooded = r(22) < (age >= 2 ? 0.6 : 0.25);
  const eyes = o('eyes') ?? (fem ? wpick(r(41), [4, 0, 0, 2, 0]) : hooded ? 2 : wpick(r(41), [4, 1.2, 0, 1, 1.2]));
  const irisI = o('iris') ?? Math.min(5, Math.floor(r(16) * 6));
  const mouth = o('mouth') ?? (fem ? wpick(r(42), [3, 0, 2, 1, 0]) : wpick(r(42), [4, 1.6, 1.2, 1, age >= 2 ? 1.4 : 0.6]));
  const hairline = o('hairline') ?? (fem ? 0 : age >= 2 ? wpick(r(43), [2, 0.6, 1.2, 2.4]) : wpick(r(43), [6, 1, 0.8, 0.3]));
  const hairLen = o('hairLen') ?? (fem ? 1 : wpick(r(44), age >= 2 ? [3, 3, 0.6] : [2, 3, 2]));

  // ---- proportions
  const cx = 32;
  const headW = [0, 0.8, -0.6, 1.2, -1.1][head];
  let hw = fem ? 9.1 + r(13) * 0.6 : 9.5 + build * 0.8 + r(13) * 0.5;
  hw += headW;
  const top = (fem ? 13.4 : 12.4 + r(14) * 0.5) + [0, 0.5, -1.2, 0.2, -0.3][head];
  const chin = (fem ? 40.8 + r(15) * 0.5 : 41.3 + r(15) * 1 + (jaw === 2 ? 0.3 : 0)) + [0, -1.2, 1.5, -0.3, 0.6][head];
  const jawK = (fem ? 0.64 : [0.92, 0.78, 0.62][jaw] + build * 0.015) + [0, 0.1, -0.05, 0.08, -0.06][head];
  const chinW = (fem ? 2.3 : [4.5, 3.2, 2.1][jaw] + build * 0.3) + [0, 0.8, -0.3, 0.8, -0.5][head];
  const cheekW = hw * ([0.99, 1.04, 0.95, 1.01, 0.94][head]) + (head === 1 || build >= 3 ? 0.2 : 0);
  const jawY = (fem ? 37.6 : 38.4) + [0, -0.9, 1.1, -0.2, 0.5][head];
  const eyeY = (fem ? 27.1 : 26.9) + (r(26) - 0.5) * 0.6 + [0, 0.1, 0.25, 0, 0.1][head];
  const eyeDX = (fem ? 4.0 : 3.95) + r(17) * (fem ? 0.4 : 0.8) + (head === 3 ? 0.2 : head === 4 ? -0.15 : 0);
  const ew = ((fem ? 2.05 : 1.95) + r(18) * 0.3) * [1, 0.94, 1.02, 1.0, 1.1][eyes];
  const eh = (fem ? 1.2 : 0.95 + r(19) * 0.25) * [1, 0.85, 0.82, 1.22, 0.72][eyes];
  const nl = (r(24) - 0.5) * 0.9 + (nose === 7 ? 0.8 : nose === 6 ? -0.3 : 0) + (head === 2 ? 0.3 : 0);
  const nb = [32.9, 33.7, 33.1, 33.1, 32.1, 33.5, 32.4, 33.6][nose] - (fem ? 0.4 : 0) + nl;
  const nwd = [1.8, 1.9, 2.8, 2.5, 1.4, 2.0, 1.6, 1.8][nose] * (fem ? 0.85 : 1);
  const mw = (fem ? 2.9 + r(20) * 0.4 : 3.1 + r(20) * 0.7 + build * 0.1) * [1, 0.94, 1.04, 1.3, 1][mouth];
  const my = Math.max(nb + 2.9, fem ? 36.5 : 36.9 + (chin - 42) * 0.25);
  const lipW = (fem ? 1 : 0.8 + r(23) * 0.3) * [1, 0.5, 1.6, 0.95, 0.9][mouth];
  const ear = 1 + r(21) * 0.25;
  const browY = eyeY - [2.45, 2.75, 3.0, 2.9, 2.5, 2.2][brows] - (fem ? 0.35 : 0) + (r(25) - 0.5) * 0.7;
  // the ear runs from the brow line to the base of the nose, wherever those are on this face
  const earTop = browY + 0.6, earBot = nb + 0.4;
  const earY = (earTop + earBot) / 2, earRy = ((earBot - earTop) / 2) * ear, earRx = 1.5 * ear;
  const nw = fem ? 3.3 : 4 + build * 0.9;
  const hl = top + (fem ? 4.6 : 5.2) + [0, -0.2, 2, 0.9][hairline] + (age >= 3 && !fem ? 0.4 : 0);

  // the outline of the head, from the temples over the crown, then the cheek, the jaw corner and the chin
  const H = (k: number) => cx + k;
  const side = 26.5;
  const headPath = `M${fm(H(-hw))} ${side}C${fm(H(-hw))} ${fm(top + 4)} ${fm(H(-hw * 0.62))} ${fm(top)} ${cx} ${fm(top)}C${fm(H(hw * 0.62))} ${fm(top)} ${fm(H(hw))} ${fm(top + 4)} ${fm(H(hw))} ${side}`
    + `C${fm(H(cheekW))} 31.5 ${fm(H(cheekW * 0.97))} 34 ${fm(H(jawW(hw, jawK)))} ${fm(jawY)}Q${fm(H(chinW + (fem ? 2 : 1.4)))} ${fm(chin - 0.2)} ${fm(H(chinW * 0.45))} ${fm(chin)}Q${cx} ${fm(chin + 0.35)} ${fm(H(-chinW * 0.45))} ${fm(chin)}`
    + `Q${fm(H(-chinW - (fem ? 2 : 1.4)))} ${fm(chin - 0.2)} ${fm(H(-jawW(hw, jawK)))} ${fm(jawY)}C${fm(H(-cheekW * 0.97))} 34 ${fm(H(-cheekW))} 31.5 ${fm(H(-hw))} ${side}Z`;
  // the skull's half-width at a height, read off the same curve the outline uses
  const halfAt = (y: number) => {
    if (y >= side) return hw;
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; const yy = bez(m, side, top + 4, top, top); if (yy > y) lo = m; else hi = m; }
    return Math.abs(bez(lo, -hw, -hw, -hw * 0.62, 0));
  };
  const fh = fem;
  return {
    fem: fh, seed, skinI, skin, sk: { sh: dk(skin, 0.42), dp: dk(skin, 0.62), lt: lt(skin, 0.3), hi: lt(skin, 0.5) },
    hairBase, hairC, brow: grey === 2 || hci === 5 || hci === 9 ? mix(hairBase === '#2a2420' ? '#4a4542' : hairBase, GREY, 0.5) : mix(hairBase, '#000000', 0.1), grey, hairI: hci ?? null,
    style, beard, build, jaw, head, nose, brows, age, mark, eyes, irisI, iris: IRIS_LIST[irisI], mouth, hairline, hairLen, texture,
    cx, hw, top, cheekW, jawW: jawW(hw, jawK), jawY, chinW, chin, eyeY, eyeDX, ew, eh, browY, nb, nwd, mw, my, lipW,
    earX: hw + 0.2, earY, earRx, earRy, nw, hl, nl, bo: 0, hooded: eyes === 2, headPath, halfAt,
  };
}
const jawW = (hw: number, k: number) => hw * k;
