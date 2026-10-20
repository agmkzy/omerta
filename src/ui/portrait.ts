// Portraits: a noir illustration, flat planes of colour under one warm key light from the left.
// The face comes from the man's seed (his id, or the look he chose) and never changes; his rank decides
// what he wears, so a promoted associate starts dressing like a soldier with the same face above the collar.
// No SVG filters: every shape is hard-edged, so the faces stay crisp at 40 px and cheap to draw by the dozen.
import { Character, Look, Rank } from '../types';
import { W } from './links';
import { PACK } from './portraits_pack';
import { FEMALE } from '../world';

// ------------------------------------------------------------------ the options a face is made of
// The original keys keep their meaning (old saves): skin 0-5, hairColour 0-5, style 0-3 (slicked, long, receding, bald),
// beard 0-5 (clean, moustache, stubble, goatee, sideburns, mutton chops), glasses 0-2 (none, spectacles, dark), jaw 0-2 (square, even, lean).
// Everything new is optional and falls back to the seed.
export type LookX = Look & {
  build?: number; // 0 lean, 1 medium, 2 stocky, 3 heavy
  nose?: number; // 0 straight, 1 Roman, 2 broad, 3 boxer's, 4 small
  brows?: number; // 0 heavy, 1 straight, 2 arched, 3 thin
  age?: number; // 0 young, 1 prime, 2 seasoned (greying temples), 3 old (salt and pepper)
  mark?: number; // 0 none, 1 cheek scar, 2 brow scar, 3 mole, 4 pockmarked
  habit?: number; // 0 none, 1 cigarette, 2 toothpick, 3 cigar, 4 gold chain
};

export const SKIN_LIST = ['#efc9a6', '#e5b48a', '#d89f77', '#c58a63', '#a86f4c', '#7f503a'];
export const HAIR_LIST = ['#17120f', '#2a1c14', '#412a1b', '#5a3a22', '#6a3b22', '#8c8985'];

type Opt = { label: string; colour?: string };
export type LookOption = { key: keyof LookX & string; label: string; group: 'Face' | 'Hair' | 'Details'; kind: 'swatch' | 'choice'; options: Opt[] };
const ch = (...l: string[]): Opt[] => l.map((label) => ({ label }));
// Every control the creator offers, in order. Option i sets look[key] = i.
export const LOOK_OPTIONS: LookOption[] = [
  { key: 'skin', label: 'Complexion', group: 'Face', kind: 'swatch', options: ['Fair', 'Light', 'Olive', 'Tan', 'Brown', 'Dark'].map((label, i) => ({ label, colour: SKIN_LIST[i] })) },
  { key: 'build', label: 'Build', group: 'Face', kind: 'choice', options: ch('Lean', 'Medium', 'Stocky', 'Heavy') },
  { key: 'jaw', label: 'Jaw', group: 'Face', kind: 'choice', options: ch('Square', 'Even', 'Lean') },
  { key: 'nose', label: 'Nose', group: 'Face', kind: 'choice', options: ch('Straight', 'Roman', 'Broad', 'Boxer’s', 'Small') },
  { key: 'brows', label: 'Brows', group: 'Face', kind: 'choice', options: ch('Heavy', 'Straight', 'Arched', 'Thin') },
  { key: 'age', label: 'Age', group: 'Face', kind: 'choice', options: ch('Young', 'Prime', 'Seasoned', 'Old') },
  { key: 'hairColour', label: 'Hair colour', group: 'Hair', kind: 'swatch', options: ['Black', 'Dark brown', 'Brown', 'Chestnut', 'Auburn', 'Grey'].map((label, i) => ({ label, colour: HAIR_LIST[i] })) },
  { key: 'style', label: 'Haircut', group: 'Hair', kind: 'choice', options: ch('Slicked back', 'Long', 'Receding', 'Bald', 'Side part', 'Pompadour', 'Curly', 'Crew cut', 'Shaggy') },
  { key: 'beard', label: 'Facial hair', group: 'Hair', kind: 'choice', options: ch('Clean', 'Moustache', 'Stubble', 'Goatee', 'Sideburns', 'Mutton chops', 'Full beard') },
  { key: 'glasses', label: 'Eyewear', group: 'Details', kind: 'choice', options: ch('None', 'Spectacles', 'Dark glasses', 'Horn-rims', 'Tinted aviators') },
  { key: 'mark', label: 'Marks', group: 'Details', kind: 'choice', options: ch('None', 'Cheek scar', 'Brow scar', 'Mole', 'Pockmarked') },
  { key: 'habit', label: 'Habit', group: 'Details', kind: 'choice', options: ch('None', 'Cigarette', 'Toothpick', 'Cigar', 'Gold chain') },
];
const LIMIT: Record<string, number> = Object.fromEntries(LOOK_OPTIONS.map((o) => [o.key, o.options.length]));

// A whole new face for the shuffle. The caller passes its own randomness (Math.random is fine in the UI).
export function randomLook(rand: () => number): LookX {
  const i = (n: number) => Math.min(n - 1, Math.floor(rand() * n));
  const w = (ws: number[]) => { let x = rand() * ws.reduce((a, b) => a + b, 0); for (let k = 0; k < ws.length; k++) { x -= ws[k]; if (x < 0) return k; } return ws.length - 1; };
  return {
    skin: i(6), hairColour: w([3, 3, 2, 1.4, 0.8, 0.3]), style: w([3, 1, 0.8, 0.4, 2.4, 1.2, 1.2, 0.8, 1.2]),
    beard: w([5, 2, 1.6, 0.6, 1.2, 0.4, 0.4]), glasses: w([7, 0.8, 0.8, 0.6, 0.5]), jaw: i(3),
    build: w([2, 3, 2, 0.8]), nose: i(5), brows: i(4), age: w([3, 3, 1.2, 0.4]), mark: w([5, 0.8, 0.6, 0.6, 0.4]), habit: w([4, 1.2, 0.8, 0.4, 1]),
    seed: 'you' + Math.floor(rand() * 1e6),
  };
}

// ------------------------------------------------------------------ plumbing
const isFem = (c: Character) => FEMALE.includes((c.name || '').split(' ')[0]);
const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const mk = (id: string) => { const s = hashOf(id); return (i: number) => { let x = (s + Math.imul(i + 1, 0x9e3779b9)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }; };
const pick = <T,>(r: number, a: T[]) => a[Math.min(a.length - 1, Math.floor(r * a.length))];
const wpick = (r: number, ws: number[]) => { let x = r * ws.reduce((a, b) => a + b, 0); for (let k = 0; k < ws.length; k++) { x -= ws[k]; if (x < 0) return k; } return ws.length - 1; };
const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]!);
const opt = (v: unknown, n: number): number | undefined => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(n - 1, Math.round(v))) : undefined;
// Numbers in path data, rounded to a tenth: small strings and no "NaN" surprises.
const fm = (x: number) => { const r = Math.round(x * 10) / 10; return r === 0 ? '0' : String(r).replace(/^(-?)0\./, '$1.'); };
const s = (strs: TemplateStringsArray, ...v: (number | string)[]) => { let o = strs[0]; for (let i = 0; i < v.length; i++) o += (typeof v[i] === 'number' ? fm(v[i] as number) : v[i]) + strs[i + 1]; return o; };

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
const SHADE = '#2a1a1e'; // shadows lean to oxblood, not grey
const dk = (c: string, t = 0.4) => mix(c, SHADE, t);
const lt = (c: string, t = 0.25) => mix(c, '#f6e7cc', t);
const BRASS = '#d6b981';
const INK = '#1a1213';

const RANKN: Record<Rank, number> = { civilian: 0, associate: 1, soldier: 2, capo: 3, underboss: 4, boss: 5 };
const NPC_HAIR = ['#17120f', '#1b1716', '#2a1c14', '#2a1c14', '#412a1b', '#5a3a22', '#6d4b2c', '#6a3b22'];
const FEM_HAIR = ['#17120f', '#2a1c14', '#412a1b', '#5a3a22', '#6a3b22', '#8a5a2a', '#a8854e', '#7a3b22'];
const IRIS = ['#3b2618', '#4e3420', '#24180f', '#5a4a2a', '#4a5a50', '#4c5d72'];
const GREY = '#9a9790';

// ------------------------------------------------------------------ the face: seed only, never rank
interface Face {
  fem: boolean; skin: string; hairC: string; brow: string; grey: number; style: number; beard: number; build: number; jaw: number; nose: number; brows: number; age: number; mark: number;
  iris: string; nl: number; bo: number; hw: number; top: number; chin: number; jawW: number; chinW: number; eyeY: number; eyeDX: number; ew: number; eh: number; mw: number; my: number; nw: number; neck: number; ear: number; hooded: boolean; lipW: number;
}
function faceOf(c: Character): Face {
  const lk = (c.look ?? {}) as LookX;
  const r = mk(lk.seed ?? c.id);
  const fem = isFem(c);
  const skinI = opt(lk.skin, 6) ?? wpick(r(1), [1.2, 2, 2.4, 1.4, 0.6, 0.4]);
  const skin = SKIN_LIST[skinI];
  // an old save chose a hair colour but never an age: keep him as he was chosen, not greyed by the dice
  const age = opt(lk.age, 4) ?? (lk.hairColour != null ? 1 : wpick(r(2), fem ? [3, 3, 2, 1.2] : [2.6, 3.2, 2.4, 1.4]));
  const build = opt(lk.build, 4) ?? (fem ? wpick(r(3), [3, 3, 1, 0]) : Math.min(3, wpick(r(3), [2.4, 3.4, 2, 0.8]) + (age >= 2 && r(4) < 0.35 ? 1 : 0)));
  const jaw = opt(lk.jaw, 3) ?? (fem ? 2 : wpick(r(5), [1, 1.2, 1]));
  const nose = opt(lk.nose, 5) ?? (fem ? pick(r(6), [0, 0, 4, 4, 1]) : wpick(r(6), [3, 2.4, 2, 1, 1.6]));
  const brows = opt(lk.brows, 4) ?? (fem ? pick(r(7), [2, 2, 3]) : wpick(r(7), [2, 3, 1.4, 1]));
  const mark = opt(lk.mark, 5) ?? (fem ? (r(8) < 0.06 ? 3 : 0) : wpick(r(8), [16, 1.2, 0.8, 1, 0.7]));
  const hci = opt(lk.hairColour, 6);
  const hairBase = hci != null ? HAIR_LIST[hci] : pick(r(9), fem ? FEM_HAIR : NPC_HAIR);
  // Greying follows age: the temples go first, then the rest.
  const grey = hci === 5 ? 0 : age >= 3 ? 2 : age === 2 && (lk.age != null || r(10) < 0.6) ? 1 : 0;
  const hairC = grey === 2 ? mix(hairBase, GREY, 0.55) : hairBase;
  const MSTYLE = age >= 2 ? [3, 0.4, 2.4, 1, 2.4, 0.4, 0.5, 1.2, 0.2] : [3, 1, 0.3, 0.1, 2.4, 1.3, 1.2, 0.8, 1.2];
  const style = fem ? (age >= 3 ? pick(r(11), [3, 3, 4, 0]) : age === 2 ? pick(r(11), [0, 2, 3, 4, 5]) : pick(r(11), [0, 1, 1, 2, 2, 4, 5])) : opt(lk.style, 9) ?? wpick(r(11), MSTYLE);
  const beard = fem ? 0 : opt(lk.beard, 7) ?? wpick(r(12), [12, 3.4, 2, 0.5, 1.4, 0.4, 0.5]);
  const hw = fem ? 9.1 + r(13) * 0.6 : 9.5 + build * 0.8 + r(13) * 0.5;
  const top = fem ? 13.4 : 12.4 + r(14) * 0.5;
  const chin = fem ? 40.8 + r(15) * 0.5 : 41.3 + r(15) * 1 + (jaw === 2 ? 0.3 : 0);
  const jawK = fem ? 0.64 : [0.92, 0.78, 0.62][jaw] + build * 0.015;
  const chinW = fem ? 2.3 : [4.5, 3.2, 2.1][jaw] + build * 0.3;
  return {
    fem, skin, hairC, brow: grey === 2 || hci === 5 ? mix(hairBase, GREY, 0.5) : mix(hairBase, '#000000', 0.1), grey, style, beard, build, jaw, nose, brows, age, mark,
    iris: pick(r(16), IRIS), hw, top, chin, jawW: hw * jawK, chinW, eyeY: (fem ? 27.1 : 26.9) + (r(26) - 0.5) * 0.6, eyeDX: (fem ? 4.0 : 3.95) + r(17) * (fem ? 0.4 : 0.8), nl: (r(24) - 0.5) * 0.9, bo: (r(25) - 0.5) * 0.7,
    ew: (fem ? 2.05 : 1.95) + r(18) * 0.3, eh: fem ? 1.2 : 0.95 + r(19) * 0.25, mw: fem ? 2.9 + r(20) * 0.4 : 3.1 + r(20) * 0.7 + build * 0.1, my: fem ? 36.5 : 36.9 + (chin - 42) * 0.25,
    nw: fem ? 3.3 : 4 + build * 0.9, neck: 0, ear: 1 + r(21) * 0.25, hooded: r(22) < (age >= 2 ? 0.6 : 0.25), lipW: fem ? 1 : 0.8 + r(23) * 0.3,
  };
}

// ------------------------------------------------------------------ the portrait
let SEQ = 0;
export function portrait(c: Character): string {
  if (PACK.length) return packed(c);
  const u = 'q' + (++SEQ).toString(36) + '_';
  const p = paint(c, u);
  const body = (p.bg + p.back + p.neck + p.dress + p.face + p.hair + p.det + p.over).replace(/ fill="none"| stroke-linecap="round"/g, "");
  return `<svg viewBox="6 ${p.vy} 52 52" width="100%" height="100%" role="img" aria-label="${esc(c.name ?? "")}" xmlns="http://www.w3.org/2000/svg"><defs>${p.defs}</defs><g fill="none" stroke-linecap="round">${body}</g></svg>`;
}

// The layers of one portrait, exposed for tests: back, neck, face and hair come from the face alone.
export function portraitParts(c: Character, u = 'x_') { return paint(c, u); }

function paint(c: Character, u: string) {
  const F = faceOf(c);
  const rank: Rank = RANKN[c.rank] != null ? c.rank : 'civilian';
  const rn = RANKN[rank];
  const lk = (c.look ?? {}) as LookX;
  const d = mk((lk.seed ?? c.id) + '/' + rank); // the wardrobe: re-rolled when his rank changes, nothing else
  const T = c.traits ?? { violence: 0.4, sociability: 0.5, caution: 0.5, vice: 0.3 } as Character['traits'];
  const hurt = safe(() => W().now < c.hurtUntil, false);
  const cx = 32;
  const { fem, skin, hw, top, chin, jawW, chinW, eyeY, nw } = F;
  const skSh = dk(skin, 0.42), skDp = dk(skin, 0.62), skLt = lt(skin, 0.3);
  let defs = '';

  // ---------------------------------------------------------------- background: a dark room, warmer the higher he stands
  const BG: Record<Rank, [string, string]> = { civilian: ['#4a4e52', '#141516'], associate: ['#54473a', '#15120f'], soldier: ['#4a443e', '#121110'], capo: ['#4f4535', '#13110d'], underboss: ['#563a34', '#140e0d'], boss: ['#5e3a36', '#150d0d'] };
  const [b0, b1] = BG[rank];
  defs += s`<radialGradient id="${u}g" cx=".56" cy=".32" r=".62"><stop offset="0" stop-color="${b0}"/><stop offset="1" stop-color="${b1}"/></radialGradient>`;
  const bg = `<rect width="64" height="64" fill="url(#${u}g)"/>`;

  // ---------------------------------------------------------------- the head outline
  const hx = (k: number) => cx + k; // offsets from centre
  const head = s`M${hx(-hw)} 26.5C${hx(-hw)} ${top + 4}${' '}${hx(-hw * 0.62)} ${top} ${cx} ${top}C${hx(hw * 0.62)} ${top} ${hx(hw)} ${top + 4} ${hx(hw)} 26.5`
    + s`C${hx(hw)} 31.5 ${hx(hw * 0.97)} 34 ${hx(jawW)} ${fem ? 37.6 : 38.4}Q${hx(chinW + (fem ? 2 : 1.4))} ${chin - 0.2} ${hx(chinW * 0.45)} ${chin}Q${cx} ${chin + 0.35} ${hx(-chinW * 0.45)} ${chin}`
    + s`Q${hx(-chinW - (fem ? 2 : 1.4))} ${chin - 0.2} ${hx(-jawW)} ${fem ? 37.6 : 38.4}C${hx(-hw * 0.97)} 34 ${hx(-hw)} 31.5 ${hx(-hw)} 26.5Z`;
  defs += `<path id="${u}H" d="${head}"/><clipPath id="${u}h"><use href="#${u}H"/></clipPath>`;
  const hc = `clip-path="url(#${u}h)"`;

  // ---------------------------------------------------------------- neck
  let neck = s`<path d="M${cx - nw} 35L${cx - nw - 0.4} 47H${cx + nw + 0.4}L${cx + nw} 35Z" fill="${skin}"/>`;
  neck += s`<path d="M${cx + nw * 0.25} 38Q${cx + nw * 0.6} 42 ${cx + nw * 0.4} 47H${cx + nw + 0.4}L${cx + nw} 35Z" fill="${skSh}"/>`;
  neck += s`<path d="M${cx - nw} 37Q${cx} ${chin + 3.2} ${cx + nw} 37V35H${cx - nw}Z" fill="${skDp}" opacity=".7"/>`;
  if (!fem && F.build >= 3) neck += s`<path d="M${cx - chinW - 2.5} ${chin + 0.4}Q${cx} ${chin + 2.6} ${cx + chinW + 2.5} ${chin + 0.4}" stroke="${skDp}" stroke-width=".5" fill="none" opacity=".6"/>`;

  // ---------------------------------------------------------------- face
  let face = '';
  // ears, with one crease line for both
  const er = 1.5 * F.ear, erY = 2.9 * F.ear, exl = cx - hw - 0.2, exr = cx + hw + 0.2;
  face += s`<ellipse cx="${exl}" cy="28.6" rx="${er}" ry="${erY}" fill="${skin}"/><ellipse cx="${exr}" cy="28.6" rx="${er}" ry="${erY}" fill="${skSh}"/><path d="M${exl - 0.2} 26.6Q${exl - 1} 28.4 ${exl - 0.2} 30.6M${exr + 0.2} 26.6Q${exr + 1} 28.4 ${exr + 0.2} 30.6" stroke="${skDp}" stroke-width=".45" fill="none" opacity=".7"/>`;
  face += `<use href="#${u}H" fill="${skin}"/>`;
  // the shadow side, a hard plane down the right of the face
  face += s`<path d="M${cx + 2.6} ${top - 1}C${cx + 4.6} ${top + 6} ${cx + hw * 0.62} 22 ${cx + hw * 0.56} 28C${cx + hw * 0.52} 33 ${cx + 4} 36 ${cx + 2.4} 40.6L${cx + 0.6} ${chin + 1}H64V${top - 1}Z" fill="${skSh}" ${hc}/>`;
  // cheekbone hollows and the brow ridge
  face += s`<path d="M${cx - hw + 0.6} 31.6Q${cx - hw * 0.62} 34.6 ${cx - hw * 0.45} 35.2Q${cx - hw * 0.7} 33.2 ${cx - hw + 0.6} 31.6Z" fill="${skSh}" opacity="${F.build === 0 || F.jaw === 2 || F.age >= 2 ? 0.2 : 0.1}"/>`;
  if (F.build >= 3) face += s`<path d="M${cx - jawW - 0.6} 35Q${cx - jawW + 0.6} 39.4 ${cx - chinW - 1} ${chin - 0.6}M${cx + jawW + 0.6} 35Q${cx + jawW - 0.6} 39.4 ${cx + chinW + 1} ${chin - 0.6}" stroke="${skDp}" stroke-width=".5" fill="none" opacity=".45"/>`;
  // eye sockets
  face += s`<ellipse cx="${cx - F.eyeDX}" cy="${eyeY - 0.3}" rx="${F.ew + 1.1}" ry="${F.eh + 0.9}" fill="${skSh}" opacity=".32"/><ellipse cx="${cx + F.eyeDX}" cy="${eyeY - 0.3}" rx="${F.ew + 1.1}" ry="${F.eh + 0.9}" fill="${skDp}" opacity=".35"/>`;
  // a warm rim of light down the shadow edge
  face += s`<path d="M${cx + hw} 22C${cx + hw} 31.5 ${cx + hw * 0.97} 34 ${cx + jawW} 38.4" stroke="${BRASS}" stroke-width=".7" fill="none" opacity=".28" ${hc}/>`;

  // expression, from the man's temper
  const hard = Math.max(-0.5, Math.min(0.8, (T.violence ?? 0.4) - (T.sociability ?? 0.5) * 0.5));
  const tilt = fem ? -0.1 : hard > 0.15 ? 0.25 + hard * 0.9 : hard < -0.2 ? -0.3 : 0.1;
  const smile = fem ? 0.35 : (T.sociability ?? 0.5) > 0.55 && (T.violence ?? 0.4) < 0.6 ? 0.55 : hard > 0.25 ? -0.4 : 0.05;
  const squint = (T.caution ?? 0.5) > 0.7 || hard > 0.45 ? 0.82 : 1;

  // eyes: each kind of mark is one path for both eyes
  const ey = eyeY, ew = F.ew, eh = F.eh * squint, iry = Math.min(0.92, eh * 0.62);
  const oval = (x: number, y: number, rx: number, ry: number) => s`M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
  let iris = '', pup = '', glint = '', lid = '', flick = '', crease = '', lower = '';
  for (const sx of [-1, 1]) {
    const ex = cx + sx * F.eyeDX, ix = ex + 0.15;
    face += s`<path d="M${ex - ew} ${ey}Q${ex} ${ey - eh * 1.5} ${ex + ew} ${ey}Q${ex} ${ey + eh} ${ex - ew} ${ey}Z" fill="${sx < 0 ? mix(skin, '#e9e0cf', 0.5) : mix(skin, '#b8ab98', 0.45)}"/>`;
    iris += oval(ix, ey - 0.05, 0.95, iry); pup += s`M${ix} ${ey - 0.05}h0`; glint += s`M${ix - 0.35} ${ey - 0.35}h0`;
    lid += s`M${ex - ew - 0.25} ${ey + 0.15}Q${ex} ${ey - eh * 1.62} ${ex + ew + 0.25} ${ey - 0.05}`;
    if (fem) flick += s`M${ex + sx * (ew + 0.1)} ${ey}L${ex + sx * (ew + 1)} ${ey - 0.7}`;
    crease += F.hooded && !fem ? s`M${ex - ew + 0.2} ${ey - eh * 0.9}Q${ex} ${ey - eh * 1.9} ${ex + ew} ${ey - eh * 0.75}` : s`M${ex - ew + 0.5} ${ey - eh * 1.35}Q${ex} ${ey - eh * 2.2} ${ex + ew - 0.2} ${ey - eh * 1.2}`;
    lower += s`M${ex - ew + 0.4} ${ey + eh * 0.75}Q${ex} ${ey + eh * 1.2} ${ex + ew - 0.3} ${ey + eh * 0.6}`;
  }
  face += `<path d="${iris}" fill="${F.iris}"/><path d="${pup}" stroke="#0e0909" stroke-width=".84" stroke-linecap="round"/><path d="${glint}" stroke="#f4ead8" stroke-width=".44" opacity=".8" stroke-linecap="round"/>`;
  face += `<path d="${lid}" stroke="${INK}" stroke-width="${fem ? 0.8 : 0.65}" fill="none" stroke-linecap="round"/>`;
  if (fem) face += `<path d="${flick}" stroke="${INK}" stroke-width=".55" stroke-linecap="round"/>`;
  face += `<path d="${crease}" stroke="${skDp}" stroke-width="${F.hooded && !fem ? 0.45 : 0.35}" fill="none" opacity="${F.hooded && !fem ? 0.75 : 0.45}"/>`;
  if (F.age >= 2) face += s`<path d="${lower}" stroke="${skDp}" stroke-width=".35" fill="none" opacity="${0.35 + F.age * 0.12}"/>`;
  // brows: tapered strokes, thick at the inner end
  const bt = [1.55, 1, 0.85, 0.45][F.brows] * (fem ? 0.75 : 1);
  const arch = [0.3, 0.15, 0.9, 0.6][F.brows];
  const by = ey - [2.45, 2.75, 3.0, 2.9][F.brows] - (fem ? 0.35 : 0) + F.bo;
  let brow = '';
  for (const sx of [-1, 1]) {
    const ix = cx + sx * 1.5, ox = cx + sx * (F.eyeDX + F.ew + 1.1), iy = by + tilt * 0.8, oy = by + 0.5 - tilt * 0.2, mx = cx + sx * (F.eyeDX + 0.4), myy = by - arch;
    brow += s`M${ix} ${iy + bt * 0.5}Q${mx} ${myy + bt * 0.6} ${ox} ${oy + 0.2}Q${mx} ${myy - bt * 0.55} ${ix} ${iy - bt * 0.55}Z`;
  }
  face += `<path d="${brow}" fill="${F.brow}"/>`;
  // nose: a lit ridge, a shadowed flank, a dark underside. The shape is what tells one man from another.
  const nb = [32.9, 33.7, 33.1, 33.1, 32.1][F.nose] - (fem ? 0.4 : 0) + F.nl;
  const nwd = [1.8, 1.9, 2.8, 2.5, 1.4][F.nose] * (fem ? 0.85 : 1);
  const nx = F.nose === 3 ? 0.55 : 0; // a boxer's nose sits a little off true
  const drop = [0.55, 1.1, 0.5, 0.35, 0.15][F.nose];
  face += s`<path d="M${cx + 0.5} 27.3Q${cx + 1.3 + (F.nose === 1 ? 1 : 0)} 30 ${cx + nx + nwd * 0.85} ${nb - 0.4}L${cx + nx + 0.3} ${nb - 0.7}Q${cx + 0.5 + nx * 0.5} 30 ${cx} 27.5Z" fill="${skSh}"/>`;
  if (F.nose === 1) face += s`<path d="M${cx + 0.6} 28.2Q${cx + 2} 29.6 ${cx + 1.2} 31.4" stroke="${skDp}" stroke-width=".5" fill="none" opacity=".7"/>`;
  if (F.nose === 3) face += s`<path d="M${cx - 0.6} 29.4l1 .5" stroke="${skDp}" stroke-width=".45" opacity=".7"/>`;
  face += s`<path d="M${cx - 0.5} 27.8Q${cx - 0.9 + nx} 30.4 ${cx - 0.7 + nx} ${nb - 1.6}" stroke="${skLt}" stroke-width=".55" fill="none" opacity=".7" stroke-linecap="round"/>`;
  face += s`<ellipse cx="${cx + nx - 0.3}" cy="${nb - 0.6}" rx="${nwd * 0.42}" ry=".6" fill="${skLt}" opacity=".45"/>`;
  face += s`<path d="M${cx + nx - nwd} ${nb - 0.3}Q${cx + nx - nwd - 0.4} ${nb + 0.4} ${cx + nx - nwd * 0.45} ${nb + 0.55}Q${cx + nx} ${nb + drop + 0.4} ${cx + nx + nwd * 0.45} ${nb + 0.55}Q${cx + nx + nwd + 0.4} ${nb + 0.4} ${cx + nx + nwd} ${nb - 0.3}Q${cx + nx} ${nb + 0.2} ${cx + nx - nwd} ${nb - 0.3}Z" fill="${skDp}" opacity=".8"/>`;
  face += s`<path d="M${cx + nx - nwd} ${nb - 0.4}Q${cx + nx - nwd - 0.6} ${nb - 1.4} ${cx + nx - nwd + 0.4} ${nb - 2}M${cx + nx + nwd} ${nb - 0.4}Q${cx + nx + nwd + 0.6} ${nb - 1.4} ${cx + nx + nwd - 0.4} ${nb - 2}" stroke="${skDp}" stroke-width=".45" fill="none" opacity=".8"/>`;
  // the nose throws its shadow down and to the right
  face += s`<path d="M${cx + nx + 0.4} ${nb + 0.9}Q${cx + nx + 2.2} ${nb + 1.2} ${cx + nx + 3} ${nb + 0.1}Q${cx + nx + 2} ${nb + 1.9} ${cx + nx + 0.4} ${nb + 0.9}Z" fill="${skDp}" opacity=".35"/>`;
  // age: lines that come with the years
  const ln = (dd: string, o: number, w = 0.4) => s`<path d="${dd}" stroke="${skDp}" stroke-width="${w}" fill="none" opacity="${fem ? o * 0.55 : o}"/>`;
  let lines = ''; // the years, one path
  if (F.age >= (fem ? 2 : 1)) lines += (s`M${cx - nwd - 0.5} ${nb - 0.3}Q${cx - nwd - 1.7} ${nb + 1.6} ${cx - F.mw - 0.5} ${F.my + 0.4}M${cx + nwd + 0.5} ${nb - 0.3}Q${cx + nwd + 1.7} ${nb + 1.6} ${cx + F.mw + 0.5} ${F.my + 0.4}`);
  if (F.age >= 2) lines += (F.age >= 3 ? s`M${cx - 4.6} ${top + 5.6}Q${cx} ${top + 5} ${cx + 4.6} ${top + 5.6}M${cx - 3.6} ${top + 7}Q${cx} ${top + 6.6} ${cx + 3.6} ${top + 7}` : s`M${cx - 4} ${top + 6.2}Q${cx} ${top + 5.7} ${cx + 4} ${top + 6.2}`) + (s`M${cx - F.eyeDX - 1} ${ey + 1.7}Q${cx - F.eyeDX} ${ey + 2.6} ${cx - F.eyeDX + 1.4} ${ey + 2}M${cx + F.eyeDX - 1.4} ${ey + 2}Q${cx + F.eyeDX} ${ey + 2.6} ${cx + F.eyeDX + 1} ${ey + 1.7}`);
  if (F.age >= 3) lines += (s`M${cx - F.eyeDX - F.ew - 0.5} ${ey}l-1.3 -.5M${cx - F.eyeDX - F.ew - 0.5} ${ey + 0.5}l-1.3 .4M${cx + F.eyeDX + F.ew + 0.5} ${ey}l1.3 -.5M${cx + F.eyeDX + F.ew + 0.5} ${ey + 0.5}l1.3 .4M${cx - jawW + 1} 36.6q.6 1.6 1.8 2.2M${cx + jawW - 1} 36.6q-.6 1.6 -1.8 2.2`);
  if (lines) face += ln(lines, [0, 0.22, 0.34, 0.45][F.age]);
  if (tilt > 0.75) face += ln(s`M${cx - 0.6} ${by - 0.4}l-.2 1.6M${cx + 0.6} ${by - 0.4}l.2 1.6`, 0.55); // the furrow of a hard man
  // mouth
  const my = F.my, mw = F.mw;
  const lipD = fem ? pick(mk((lk.seed ?? c.id) + 'l')(0), ['#9a3a3c', '#a2433f', '#8a3040', '#b05a4a']) : mix(skin, '#6e3030', 0.32);
  const lipL = fem ? lt(lipD, 0.12) : mix(skin, '#9a5048', 0.2);
  face += s`<path d="M${cx - mw} ${my}Q${cx - mw * 0.45} ${my - 1.15 * F.lipW} ${cx} ${my - 0.65 * F.lipW}Q${cx + mw * 0.45} ${my - 1.15 * F.lipW} ${cx + mw} ${my}Q${cx} ${my + smile * 0.7} ${cx - mw} ${my}Z" fill="${dk(lipD, 0.15)}"/>`;
  face += s`<path d="M${cx - mw * 0.82} ${my + 0.15}Q${cx} ${my + 1.7 * F.lipW + smile * 0.3} ${cx + mw * 0.82} ${my + 0.15}Q${cx} ${my + smile * 0.6} ${cx - mw * 0.82} ${my + 0.15}Z" fill="${lipL}"/>`;
  face += s`<path d="M${cx - mw - 0.2} ${my - smile * 0.25}Q${cx} ${my + smile * 0.85} ${cx + mw + 0.2} ${my - smile * 0.25}" stroke="${INK}" stroke-width=".5" fill="none" opacity=".85" stroke-linecap="round"/>`;
  face += s`<path d="M${cx - 1.6} ${my + 2.3 * F.lipW + 0.2}Q${cx} ${my + 2.9} ${cx + 1.6} ${my + 2.3 * F.lipW + 0.2}" stroke="${skDp}" stroke-width=".5" fill="none" opacity=".45"/>`;
  if (fem) face += s`<path d="M${cx - mw * 0.4} ${my + 0.9}Q${cx - mw * 0.1} ${my + 1.3} ${cx + mw * 0.1} ${my + 1}" stroke="#f4dccb" stroke-width=".35" fill="none" opacity=".5"/>`;
  // a chin cleft for some square jaws
  if (!fem && F.jaw === 0) face += ln(s`M${cx} ${chin - 1.4}v.9`, 0.45);
  // marks
  if (F.mark === 1) face += s`<path d="M${cx - 6.6} 30.6L${cx - 4.4} 35.6" stroke="${skDp}" stroke-width="1.3" opacity=".55"/><path d="M${cx - 6.9} 30.4L${cx - 4.6} 35.4" stroke="${mix(skin, "#f0cdb8", 0.6)}" stroke-width=".75"/>`;
  if (F.mark === 2) face += s`<path d="M${cx - F.eyeDX - 0.2} ${by - 2}L${cx - F.eyeDX - 1} ${ey - 0.9}M${cx - F.eyeDX - 1.2} ${ey + 1.1}L${cx - F.eyeDX - 1.6} ${ey + 2.6}" stroke="${mix(skin, "#f0cdb8", 0.6)}" stroke-width=".8"/>`;
  if (F.mark === 3) face += s`<circle cx="${cx - mw - 1.1}" cy="${my - 1.6}" r=".45" fill="${dk(skin, 0.7)}"/>`;
  if (F.mark === 4) { const pr = mk((lk.seed ?? c.id) + "p"); let pm = ""; for (let i = 0; i < 10; i++) pm += s`M${cx + (i % 2 ? 1 : -1) * (3.4 + pr(i) * 4)} ${30.6 + pr(i + 20) * 5.4}h0`; face += `<path d="${pm}" stroke="${skDp}" stroke-width=".8" opacity=".6" stroke-linecap="round"/>`; }

  // facial hair, drawn over the mouth where it grows over it
  const fh = F.grey === 2 ? mix(F.hairC, GREY, 0.3) : F.grey === 1 ? mix(F.hairC, GREY, 0.25) : F.hairC;
  const fhSh = dk(fh, 0.35);
  const mt = nb + 1.5; const mous = () => s`<path d="M${cx - mw - 0.3} ${my + 0.1}Q${cx - mw} ${mt + 0.2} ${cx - 0.9} ${mt}Q${cx} ${mt + 0.3} ${cx + 0.9} ${mt}Q${cx + mw} ${mt + 0.2} ${cx + mw + 0.3} ${my + 0.1}Q${cx + mw * 0.5} ${my - 0.6} ${cx} ${my - 0.5}Q${cx - mw * 0.5} ${my - 0.6} ${cx - mw - 0.3} ${my + 0.1}Z" fill="${fh}"/><path d="M${cx + 0.4} ${mt + 0.1}Q${cx + mw} ${mt + 0.2} ${cx + mw + 0.3} ${my + 0.1}Q${cx + mw * 0.5} ${my - 0.6} ${cx + 0.4} ${my - 0.5}Z" fill="${fhSh}"/>`;
  const muzzle = s`M${cx - hw + 0.4} 30.5C${cx - hw + 0.2} 35 ${cx - jawW - 0.4} 37.6 ${cx - jawW} 38.6Q${cx - chinW - 1.6} ${chin + 0.2} ${cx} ${chin + 0.4}Q${cx + chinW + 1.6} ${chin + 0.2} ${cx + jawW} 38.6C${cx + jawW + 0.4} 37.6 ${cx + hw - 0.2} 35 ${cx + hw - 0.4} 30.5L${cx + hw - 2.2} 31.6Q${cx + 3.6} ${nb + 0.3} ${cx} ${nb + 0.6}Q${cx - 3.6} ${nb + 0.3} ${cx - hw + 2.2} 31.6Z`;
  if (F.beard === 1) face += mous();
  if (F.beard === 2) face += `<path d="${muzzle}" fill="${fh}" opacity=".22" ${hc}/>`;
  if (F.beard === 3) face += s`<path d="M${cx - mw * 0.6} ${my + 1.5}Q${cx - chinW - 0.4} ${chin - 1} ${cx - chinW * 0.5} ${chin + 0.4}Q${cx} ${chin + 1.1} ${cx + chinW * 0.5} ${chin + 0.4}Q${cx + chinW + 0.4} ${chin - 1} ${cx + mw * 0.6} ${my + 1.5}Q${cx} ${my + 2.4} ${cx - mw * 0.6} ${my + 1.5}Z" fill="${fh}"/>` + mous();
  if (F.beard === 4 || F.beard === 5) {
    const yb = F.beard === 5 ? 38.4 : 33.6, ww = F.beard === 5 ? 3.4 : 1.4;
    for (const sx of [-1, 1]) face += s`<path d="M${cx + sx * (hw + 0.3)} 24.6L${cx + sx * (hw - 1.5)} 24.8Q${cx + sx * (hw - ww)} ${yb - 3} ${cx + sx * (hw - ww - (F.beard === 5 ? 1.6 : 0))} ${yb}Q${cx + sx * (hw - 0.6)} ${yb - 1} ${cx + sx * (hw + 0.3)} 30.6Z" fill="${sx < 0 ? fh : fhSh}" ${hc}/>`;
    if (F.beard === 5) face += mous();
  }
  if (F.beard === 6) face += s`<path d="M${cx - hw - 0.2} 27.4C${cx - hw - 0.2} 34 ${cx - jawW - 1} 38.2 ${cx - jawW + 0.2} 39.6Q${cx - chinW - 1} ${chin + 2.2} ${cx} ${chin + 2.2}Q${cx + chinW + 1} ${chin + 2.2} ${cx + jawW - 0.2} 39.6C${cx + jawW + 1} 38.2 ${cx + hw + 0.2} 34 ${cx + hw + 0.2} 27.4L${cx + hw - 1.4} 28Q${cx + hw - 2.2} 32 ${cx + mw + 0.8} ${my + 0.6}Q${cx} ${my + 2.6} ${cx - mw - 0.8} ${my + 0.6}Q${cx - hw + 2.2} 32 ${cx - hw + 1.4} 28Z" fill="${fh}"/><path d="M${cx + 1.6} ${chin + 2.1}Q${cx + jawW} ${chin} ${cx + jawW - 0.2} 39.6C${cx + jawW + 1} 38.2 ${cx + hw + 0.2} 34 ${cx + hw + 0.2} 27.4L${cx + hw - 1.4} 28Q${cx + hw - 2.2} 32 ${cx + mw + 0.8} ${my + 0.6}Z" fill="${fhSh}"/>` + mous();

  // ---------------------------------------------------------------- hair
  const H = hairOf(F, cx, u);
  defs += H.defs;

  // ---------------------------------------------------------------- what he wears
  const W0 = dressOf(c, F, rank, rn, d, u, cx);
  defs += W0.defs;

  // ---------------------------------------------------------------- over the top: glasses, habits, hats, bruises
  let det = '', over = ''; // det: eyewear, habits, earrings - his own, never his rank's
  const gr = mk((lk.seed ?? c.id) + 'g');
  const glasses = opt(lk.glasses, 5) ?? (fem ? (F.age >= 2 && gr(0) < 0.15 ? 1 : 0) : wpick(gr(0), F.age >= 2 ? [80, 8, 3, 7, 2] : [90, 3, 3, 2, 2]));
  if (glasses) {
    const gx = F.eyeDX, gw = F.ew + 1.1, gh = glasses === 3 ? 2.1 : 1.9;
    const lens = (sx: number) => glasses === 4
      ? s`M${cx + sx * 1.1} ${ey - gh}H${cx + sx * (gx + gw)}Q${cx + sx * (gx + gw + 0.3)} ${ey + gh + 0.5} ${cx + sx * gx} ${ey + gh + 0.6}Q${cx + sx * 1.2} ${ey + gh} ${cx + sx * 1.1} ${ey - gh}Z`
      : s`M${cx + sx * (gx - gw)} ${ey - gh + 0.2}Q${cx + sx * gx} ${ey - gh - 0.3} ${cx + sx * (gx + gw)} ${ey - gh + 0.2}Q${cx + sx * (gx + gw + 0.2)} ${ey + gh} ${cx + sx * gx} ${ey + gh}Q${cx + sx * (gx - gw - 0.2)} ${ey + gh} ${cx + sx * (gx - gw)} ${ey - gh + 0.2}Z`;
    const frame = glasses === 3 ? '#1e1512' : glasses === 2 ? '#141012' : glasses === 4 ? '#b59a62' : '#8f8676';
    const fw = glasses === 3 ? 0.85 : glasses === 2 ? 0.7 : 0.4;
    const fill = glasses === 2 ? '#0d0b0c' : glasses === 4 ? '#3a2a20' : '#d8e4e8';
    const fo = glasses === 2 ? 0.95 : glasses === 4 ? 0.62 : 0.1;
    for (const sx of [-1, 1]) det += `<path d="${lens(sx)}" fill="${fill}" opacity="${fo}"/><path d="${lens(sx)}" fill="none" stroke="${frame}" stroke-width="${fw}"/>`;
    det += s`<path d="M${cx - 1.2} ${ey - 0.6}Q${cx} ${ey - 1.3} ${cx + 1.2} ${ey - 0.6}M${cx - gx - gw} ${ey - 1}L${cx - hw} ${ey - 0.5}M${cx + gx + gw} ${ey - 1}L${cx + hw} ${ey - 0.5}" stroke="${frame}" stroke-width="${Math.min(0.6, fw)}" fill="none"/>`;
    if (glasses === 2 || glasses === 4) det += s`<path d="M${cx - gx - 1.2} ${ey - 1}l1.4 -.6M${cx + gx - 1.2} ${ey - 1}l1.4 -.6" stroke="#cfd6dc" stroke-width=".45" opacity=".5" stroke-linecap="round"/>`;
    else det += s`<path d="M${cx - gx - 1} ${ey - 0.8}l1.2 -.7" stroke="#fff" stroke-width=".35" opacity=".45" stroke-linecap="round"/>`;
  }
  const habit = opt(lk.habit, 5) ?? (fem ? 0 : wpick(gr(1), [10, 1.4 + (T.vice ?? 0.3) * 2.4, 0.6, 0.7, 0]));
  if (habit === 1) det += s`<path d="M${cx + mw - 0.6} ${my + 0.3}L${cx + mw + 4.2} ${my + 2.6}" stroke="#e8e0d0" stroke-width=".9" stroke-linecap="round"/><path d="M${cx + mw + 3.6} ${my + 2.3}L${cx + mw + 4.4} ${my + 2.7}" stroke="#d2692a" stroke-width=".95" stroke-linecap="round"/><path d="M${cx + mw + 4.6} ${my + 1.8}q1 -2 -.2 -4q-1 -2 .6 -4.4" stroke="#cfc6b6" stroke-width=".45" fill="none" opacity=".35" stroke-linecap="round"/>`;
  if (habit === 2) det += s`<path d="M${cx + mw - 0.8} ${my + 0.2}L${cx + mw + 3.4} ${my + 1.6}" stroke="#d8c08a" stroke-width=".35" stroke-linecap="round"/>`;
  if (habit === 3) det += s`<path d="M${cx + mw - 0.8} ${my + 0.4}L${cx + mw + 4.6} ${my + 2.4}" stroke="#4a2c1a" stroke-width="1.7" stroke-linecap="round"/><path d="M${cx + mw - 0.4} ${my + 0.1}L${cx + mw + 4.4} ${my + 1.9}" stroke="#7a4a2a" stroke-width=".5" stroke-linecap="round"/><path d="M${cx + mw + 0.6} ${my}l.1 1.6" stroke="#b9965c" stroke-width=".7"/><circle cx="${cx + mw + 4.9}" cy="${my + 2.5}" r=".6" fill="#8a8580"/>`;
  if (fem && gr(2) < 0.6) det += s`<circle cx="${cx - hw - 0.2}" cy="31.8" r=".75" fill="${BRASS}"/><circle cx="${cx + hw + 0.2}" cy="31.8" r=".75" fill="${dk(BRASS, 0.3)}"/>`;
  over += W0.over(habit === 4);
  if (W0.hat) over += hatOf(W0.hat, F, cx, d, u);
  if (hurt) {
    const bx = cx - F.eyeDX;
    over += s`<ellipse cx="${bx}" cy="${ey + 0.6}" rx="3.1" ry="2.5" fill="#5a3350" opacity=".38"/><ellipse cx="${bx + 0.2}" cy="${ey + 1.1}" rx="2" ry="1.4" fill="#6e2f3a" opacity=".35"/>`;
    over += s`<g transform="rotate(-24 ${cx + 4.6} ${top + 7})"><rect x="${cx + 2.4}" y="${top + 6.1}" width="4.6" height="1.8" rx=".5" fill="#dccdb0"/><rect x="${cx + 4}" y="${top + 6.1}" width="1.4" height="1.8" fill="#c8b590"/></g>`;
    over += s`<path d="M${cx + mw - 1.2} ${my + 0.9}l.6 .5" stroke="#7a1f24" stroke-width=".7" stroke-linecap="round"/>`;
  }
  // a soft vignette of the room closing in
  return { defs, bg, back: H.back, neck, dress: W0.body, face, hair: H.front, det, over, vy: W0.hat === "fedora" ? 3.8 : 5.6 };
}

// ------------------------------------------------------------------ hair
function hairOf(F: Face, cx: number, u: string): { back: string; front: string; defs: string } {
  const { hw, top, fem, hairC } = F;
  const hSh = dk(hairC, 0.45), hHi = lt(hairC, hairC === HAIR_LIST[0] || hairC === NPC_HAIR[1] ? 0.22 : 0.3);
  const st = F.style;
  let back = '', shape = '', tex = '', bald = false;
  const hl = top + (fem ? 4.6 : 5.2); // hairline
  const ys = 25.4; // where the sideburn ends
  const cap = (th: number, inner: string, side = 1.1) => s`M${cx - hw - 0.4} ${ys}C${cx - hw - side} ${top + 6} ${cx - hw * 0.72} ${top - th} ${cx} ${top - th}C${cx + hw * 0.72} ${top - th} ${cx + hw + side} ${top + 6} ${cx + hw + 0.4} ${ys}` + inner;
  const line = (dip: number, rec = 0) => s`L${cx + hw - 0.7} ${ys}C${cx + hw - 0.9 - rec} ${hl + 1.2 - rec} ${cx + hw * 0.5} ${hl - 0.3 - rec * 0.5} ${cx} ${hl + dip}C${cx - hw * 0.5} ${hl - 0.3 - rec * 0.5} ${cx - hw + 0.9 + rec} ${hl + 1.2 - rec} ${cx - hw + 0.7} ${ys}Z`;
  const blob = (x: number, y: number, r: number) => s`M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const strands = (n: number, y0: number, y1: number, curve: number, sw = 0.4, o = 0.45) => { let t = ''; for (let i = 0; i < n; i++) { const x = cx - hw * 0.75 + (i / (n - 1)) * hw * 1.5; t += s`M${x} ${y0}Q${x + curve} ${(y0 + y1) / 2} ${x + curve * 0.4} ${y1}`; } return `<path d="${t}" stroke="${hHi}" stroke-width="${sw}" fill="none" opacity="${o}" stroke-linecap="round"/>`; };
  if (!fem) {
    if (st === 0) { shape = cap(1.7, line(-0.2)); tex = strands(5, hl - 0.2, top - 1.4, 1.4, 0.35, 0.5); }
    else if (st === 1) {
      shape = cap(2.2, s`L${cx + hw + 1.6} 38.5Q${cx + hw + 0.4} 40 ${cx + hw - 0.6} 38L${cx + hw - 0.5} 28C${cx + hw - 1.2} ${hl} ${cx + 3} ${hl - 0.6} ${cx + 0.6} ${hl - 0.8}Q${cx - 4} ${hl + 1.6} ${cx - hw + 0.4} ${hl + 3.2}L${cx - hw + 0.5} 28L${cx - hw + 0.6} 38Q${cx - hw - 0.4} 40 ${cx - hw - 1.6} 38.5Z`, 1.6);
      back = s`<path d="M${cx - hw - 1.4} 30Q${cx - hw - 2.2} 40 ${cx - hw + 0.4} 44H${cx + hw - 0.4}Q${cx + hw + 2.2} 40 ${cx + hw + 1.4} 30Z" fill="${hSh}"/>`;
      tex = strands(5, top - 1.6, hl + 1, -1.2, 0.35, 0.4);
    } else if (st === 2) { shape = cap(1.2, line(0.8, 2.6)); tex = strands(4, hl - 1, top - 1, 1, 0.3, 0.4); }
    else if (st === 3) {
      bald = true;
      shape = s`M${cx - hw - 0.5} 29.5C${cx - hw - 0.9} 25 ${cx - hw - 0.4} 21.5 ${cx - hw + 1.4} 19.6Q${cx - hw + 0.6} 24 ${cx - hw + 0.7} 29.5ZM${cx + hw + 0.5} 29.5C${cx + hw + 0.9} 25 ${cx + hw + 0.4} 21.5 ${cx + hw - 1.4} 19.6Q${cx + hw - 0.6} 24 ${cx + hw - 0.7} 29.5Z`;
    } else if (st === 4) {
      // side part, swept across from the left
      shape = s`M${cx - hw - 0.4} ${ys}C${cx - hw - 1.1} ${top + 5} ${cx - hw * 0.8} ${top - 1} ${cx - 3.4} ${top - 1.4}C${cx + 2} ${top - 3.4} ${cx + hw + 1.6} ${top - 0.4} ${cx + hw + 0.4} ${ys}` + line(-0.4);
      tex = s`<path d="M${cx - 3.4} ${top - 1.2}L${cx - 3.8} ${hl - 0.6}" stroke="${hSh}" stroke-width=".5"/>` + strands(5, top - 1.4, hl - 0.6, 2.4, 0.35, 0.45);
    } else if (st === 5) {
      // pompadour: a tall swept front
      shape = s`M${cx - hw - 0.4} ${ys}C${cx - hw - 1.1} ${top + 5} ${cx - hw * 0.8} ${top - 2} ${cx - 4} ${top - 3.6}C${cx - 1} ${top - 5.6} ${cx + 5} ${top - 5.2} ${cx + 6.4} ${top - 2.6}C${cx + hw + 1} ${top} ${cx + hw + 1.1} ${top + 6} ${cx + hw + 0.4} ${ys}` + line(-0.6);
      tex = strands(5, hl - 0.6, top - 3.4, 2.2, 0.4, 0.5);
    } else if (st === 6) {
      // curly: a cap of tight curls
      shape = cap(2.6, line(0.2), 1.6);
      let cur = '';
      for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); cur += blob(cx - Math.cos(a) * (hw + 0.8), top + 5.6 - Math.sin(a) * 8, 1.5); }
      shape += cur; tex = "";
      let ar = ''; for (let i = 0; i < 9; i++) { const x = cx - hw * 0.7 + (i % 5) * hw * 0.35, y = top + (i < 5 ? 0.6 : 3); ar += s`M${x - 0.7} ${y}q.7 -.9 1.4 0`; }
      tex += `<path d="${ar}" stroke="${hHi}" stroke-width=".35" fill="none" opacity=".55"/>`;
    } else if (st === 7) { shape = cap(0.6, line(-0.6, 0.6), 0.6); tex = ''; }
    else {
      // shaggy: a 1970 mop, a fringe to the brows, over the ears
      shape = cap(2.6, s`L${cx + hw + 1.4} 33Q${cx + hw + 0.2} 34.4 ${cx + hw - 0.6} 32.6L${cx + hw - 0.8} 24Q${cx + hw - 3} 23.6 ${cx + 4} ${hl + 3.6}Q${cx + 1} ${hl + 4.6} ${cx - 2} ${hl + 4}Q${cx - 5} ${hl + 4.4} ${cx - hw + 0.8} 24L${cx - hw + 0.6} 32.6Q${cx - hw - 0.2} 34.4 ${cx - hw - 1.4} 33Z`, 1.8);
      back = s`<path d="M${cx - hw - 1.4} 28Q${cx - hw - 1.8} 38 ${cx - hw + 1} 41H${cx + hw - 1}Q${cx + hw + 1.8} 38 ${cx + hw + 1.4} 28Z" fill="${hSh}"/>`;
      tex = s`<path d="M${cx - 5} ${hl + 3.6}l.6 -3.4M${cx - 1.4} ${hl + 4}l.3 -3.6M${cx + 2.2} ${hl + 3.8}l-.2 -3.6M${cx + 5.6} ${hl + 2.8}l-.6 -3" stroke="${hSh}" stroke-width=".45" opacity=".7"/>` + strands(4, top - 2, hl + 1, -1.4, 0.35, 0.4);
    }
  } else {
    // women: 1970 styles, set and sprayed or long and straight
    if (st === 0) {
      // bouffant with a flip at the jaw
      shape = s`M${cx - hw - 1} 26C${cx - hw - 4} ${top + 2} ${cx - hw * 0.6} ${top - 5.4} ${cx} ${top - 5.4}C${cx + hw * 0.6} ${top - 5.4} ${cx + hw + 4} ${top + 2} ${cx + hw + 1} 26C${cx + hw + 3} 33 ${cx + hw + 1.4} 37 ${cx + hw + 4} 39.6Q${cx + hw} 41 ${cx + hw - 1} 37L${cx + hw - 0.6} 27C${cx + hw - 1} ${hl} ${cx + 2} ${hl - 0.6} ${cx - 3} ${hl + 0.4}Q${cx - hw + 0.6} ${hl + 2} ${cx - hw + 0.6} 27L${cx - hw + 1} 37Q${cx - hw} 41 ${cx - hw - 4} 39.6C${cx - hw - 1.4} 37 ${cx - hw - 3} 33 ${cx - hw - 1} 26Z`;
      back = s`<path d="M${cx - hw - 2} 28Q${cx} 46 ${cx + hw + 2} 28Z" fill="${hSh}"/>`;
      tex = strands(5, hl, top - 4.6, -2, 0.4, 0.45);
    } else if (st === 1) {
      // long and straight, parted in the middle, past the shoulders
      shape = s`M${cx} ${top - 1.6}C${cx - hw * 0.9} ${top - 1.6} ${cx - hw - 1.8} ${top + 4} ${cx - hw - 1.6} 30L${cx - hw - 2.4} 52H${cx - hw + 2.6}L${cx - hw + 1} 32Q${cx - hw + 0.8} ${hl + 1} ${cx - 0.4} ${hl - 0.6}H${cx + 0.4}Q${cx + hw - 0.8} ${hl + 1} ${cx + hw - 1} 32L${cx + hw - 2.6} 52H${cx + hw + 2.4}L${cx + hw + 1.6} 30C${cx + hw + 1.8} ${top + 4} ${cx + hw * 0.9} ${top - 1.6} ${cx} ${top - 1.6}Z`;
      back = s`<path d="M${cx - hw - 1.6} 28L${cx - hw - 1} 50H${cx + hw + 1}L${cx + hw + 1.6} 28Z" fill="${hSh}"/>`;
      tex = s`<path d="M${cx - hw - 1} 34L${cx - hw - 1.4} 50M${cx + hw + 1} 34L${cx + hw + 1.4} 50M${cx - 0.6} ${top - 1}Q${cx - 4} ${top} ${cx - hw + 1} ${hl + 3}" stroke="${hHi}" stroke-width=".4" fill="none" opacity=".45"/>`;
    } else if (st === 2) {
      // shoulder-length flip with a side part
      shape = s`M${cx - hw - 0.8} 26C${cx - hw - 2.4} ${top + 2} ${cx - hw * 0.6} ${top - 3} ${cx - 2} ${top - 3}C${cx + hw * 0.7} ${top - 3.2} ${cx + hw + 2.6} ${top + 2} ${cx + hw + 1.2} 27C${cx + hw + 2.6} 36 ${cx + hw + 1} 42 ${cx + hw + 4.6} 44.6Q${cx + hw + 1} 46.4 ${cx + hw - 1.2} 42L${cx + hw - 0.8} 27C${cx + hw - 1.6} ${hl} ${cx} ${hl - 1.4} ${cx - 3.6} ${hl - 0.6}Q${cx - hw + 0.8} ${hl + 2.4} ${cx - hw + 0.8} 28L${cx - hw + 1.2} 42Q${cx - hw - 1} 46.4 ${cx - hw - 4.6} 44.6C${cx - hw - 1} 42 ${cx - hw - 2.6} 36 ${cx - hw - 0.8} 26Z`;
      back = s`<path d="M${cx - hw - 1.4} 28Q${cx - hw - 1} 42 ${cx} 43Q${cx + hw + 1} 42 ${cx + hw + 1.4} 28Z" fill="${hSh}"/>`;
      tex = s`<path d="M${cx - 3.6} ${top - 2.6}Q${cx - 3.4} ${top + 1} ${cx - 3.8} ${hl - 0.4}" stroke="${hSh}" stroke-width=".5" fill="none"/>` + strands(5, top - 2.4, hl + 1, 2.4, 0.35, 0.45);
    } else if (st === 3) {
      // short set curls, the way the older women wear it
      shape = cap(2.2, s`L${cx + hw + 0.8} 31Q${cx + hw - 0.4} 31.6 ${cx + hw - 0.6} 29L${cx + hw - 0.8} 24C${cx + hw - 1.4} ${hl} ${cx + 3} ${hl - 0.4} ${cx} ${hl + 0.4}C${cx - 3} ${hl - 0.4} ${cx - hw + 1.4} ${hl} ${cx - hw + 0.8} 24L${cx - hw + 0.6} 29Q${cx - hw + 0.4} 31.6 ${cx - hw - 0.8} 31Z`, 2);
      let cur = ''; for (let i = 0; i <= 12; i++) { const a = Math.PI * (-0.12 + 1.24 * (i / 12)); cur += blob(cx - Math.cos(a) * (hw + 1), top + 7 - Math.sin(a) * 9, 1.7); }
      shape += cur; tex = "";
      let ar = ''; for (let i = 0; i < 8; i++) { const x = cx - hw * 0.6 + (i % 4) * hw * 0.4, y = top + (i < 4 ? -0.6 : 2.2); ar += s`M${x - 0.8} ${y}q.8 -1 1.6 0`; }
      tex += `<path d="${ar}" stroke="${hHi}" stroke-width=".4" fill="none" opacity=".5"/>`;
    } else if (st === 4) {
      // swept up into a chignon
      back = s`<circle cx="${cx + 1}" cy="${top - 2.8}" r="4.4" fill="${hSh}"/><circle cx="${cx}" cy="${top - 3.2}" r="3.8" fill="${hairC}"/>`;
      shape = cap(2, s`L${cx + hw - 0.6} ${ys}C${cx + hw - 1} ${hl} ${cx + 4} ${hl - 1} ${cx - 1} ${hl}Q${cx - hw + 1} ${hl + 2.6} ${cx - hw + 0.6} ${ys}Z`, 1.2);
      tex = strands(5, hl, top - 1.6, 1.6, 0.35, 0.45);
    } else {
      // short and cropped with a wispy fringe
      shape = cap(1.6, s`L${cx + hw + 0.2} 29Q${cx + hw - 0.5} 29.4 ${cx + hw - 0.7} 27L${cx + hw - 0.8} 22Q${cx + 3} ${hl + 1} ${cx + 1} ${hl + 2.6}L${cx - 1} ${hl + 1.6}L${cx - 3} ${hl + 2.8}L${cx - 4.4} ${hl + 1.6}Q${cx - hw + 1} ${hl + 2} ${cx - hw + 0.8} 22L${cx - hw + 0.7} 27Q${cx - hw + 0.5} 29.4 ${cx - hw - 0.2} 29Z`, 1);
      tex = strands(5, top - 1.4, hl + 2, -1, 0.35, 0.45);
    }
  }
  const defs = `<path id="${u}S" d="${shape}"/><clipPath id="${u}r"><use href="#${u}S"/></clipPath>`;
  const hc = `clip-path="url(#${u}r)"`;
  let front = '';
  if (bald) {
    front += s`<ellipse cx="${cx - 3}" cy="${top + 2.4}" rx="3.6" ry="1.3" fill="${lt(F.skin, 0.45)}" opacity=".5"/>`;
    front += `<use href="#${u}S" fill="${hairC}"/><use href="#${u}S" fill="${hSh}" opacity=".5" ${hc}/>`;
  } else {
    if (st === 7 && !fem) front += `<use href="#${u}S" fill="${hairC}" opacity=".85"/>`;
    else front += `<use href="#${u}S" fill="${hairC}"/>`;
    front += tex.replace(/\/>/g, ` ${hc}/>`);
    front += s`<path d="M${cx + 2.6} 0Q${cx + 4.6} ${top + 4} ${cx + hw * 0.6} 30L${cx + hw * 0.4} 64H64V0Z" fill="${hSh}" opacity=".75" ${hc}/>`;
  }
  if (F.grey && !bald) { let g = ''; for (const sx of [-1, 1]) for (let i = 0; i < (F.grey === 2 ? 4 : 3); i++) g += s`M${cx + sx * (hw + 0.6 - i * 0.7)} ${26 - i * 0.6}Q${cx + sx * (hw - 0.2 - i * 0.6)} ${top + 9 - i} ${cx + sx * (hw - 2.4 - i * 0.9)} ${top + 3 - i * 0.6}`; front += `<path d="${g}" stroke="${F.grey === 2 ? '#d2cec4' : '#a9a59c'}" stroke-width=".7" fill="none" opacity=".85" ${hc}/>`; }
  if (bald && F.grey) front += `<use href="#${u}S" fill="${GREY}" opacity=".6"/>`;
  return { back, front, defs };
}

// ------------------------------------------------------------------ hats
function hatOf(kind: 'fedora' | 'cap' | 'scarf', F: Face, cx: number, d: (i: number) => number, u: string): string {
  const { hw, top } = F;
  // a hat sits on whatever hair is under it
  const vol = F.fem ? [5.4, 1.6, 3, 2.2, 2, 1.6][F.style] ?? 2 : [1.7, 2.2, 1.2, 0, 1.6, 5.4, 4, 0.6, 2.6][F.style] ?? 2;
  const lift = Math.max(0, vol - 1.6) * 0.8;
  const hc = `clip-path="url(#${u}h)"`;
  if (kind === 'fedora') {
    const col = pick(d(60), ['#26242a', '#2e2a26', '#3a332b', '#3b3c3d', '#1c1b1e', '#4a4038']);
    const band = pick(d(61), ['#120f10', '#3b1a1f', '#1a1f2a', '#120f10']);
    const by = top + 4.4 + lift * 0.25, bw = hw + 5.2, yt = by - 9 - lift, cw = hw + 0.6;
    let h = s`<path d="M0 0H64V${by + 1.4}Q${cx} ${by + 4.4} 0 ${by + 1.4}Z" fill="#0a0707" opacity=".42" ${hc}/>`; // the brim's shadow over his brow
    h += s`<path d="M${cx - bw} ${by + 0.2}Q${cx} ${by - 2.6} ${cx + bw} ${by + 0.2}Q${cx} ${by + 2.6} ${cx - bw} ${by + 0.2}Z" fill="${dk(col, 0.2)}"/>`;
    h += s`<path d="M${cx - cw} ${by + 0.4}L${cx - cw + 1.1} ${yt + 1}Q${cx - hw * 0.45} ${yt - 1.2} ${cx} ${yt + 0.9}Q${cx + hw * 0.45} ${yt - 1.2} ${cx + cw - 1.1} ${yt + 1}L${cx + cw} ${by + 0.4}Q${cx} ${by + 1.6} ${cx - cw} ${by + 0.4}Z" fill="${col}"/>`;
    h += s`<path d="M${cx + 1.4} ${yt + 0.7}Q${cx + hw * 0.45} ${yt - 1.2} ${cx + cw - 1.1} ${yt + 1}L${cx + cw} ${by + 0.4}Q${cx + 4} ${by + 1.4} ${cx + 2.4} ${by + 1.3}Z" fill="#000" opacity=".32"/>`;
    h += s`<path d="M${cx - cw + 0.1} ${by - 0.2}L${cx - cw + 0.4} ${by - 2.4}Q${cx} ${by - 1.4} ${cx + cw - 0.4} ${by - 2.4}L${cx + cw - 0.1} ${by - 0.2}Q${cx} ${by + 1} ${cx - cw + 0.1} ${by - 0.2}Z" fill="${band}"/>`;
    h += s`<path d="M${cx - bw} ${by + 0.2}Q${cx} ${by + 2.6} ${cx + bw} ${by + 0.2}Q${cx} ${by + 1.4} ${cx - bw} ${by + 0.2}Z" fill="${dk(col, 0.45)}"/>`;
    h += s`<path d="M${cx - 0.3} ${yt + 1.2}Q${cx - 0.6} ${yt + 3.4} ${cx - 0.2} ${by - 2.6}M${cx - bw + 1} ${by - 0.1}Q${cx - hw} ${by - 1.6} ${cx - cw - 0.2} ${by - 1.4}M${cx - cw + 1.3} ${yt + 2}L${cx - cw + 0.5} ${by - 2.8}" stroke="${lt(col, 0.35)}" stroke-width=".4" fill="none" opacity=".6"/>`;
    return h;
  }
  if (kind === 'cap') {
    const col = pick(d(62), ['#4a4238', '#3d3a35', '#5a4e3e', '#35383a', '#4e3f33']);
    const by = top + 5.2, yt = top - 2.2 - lift;
    let h = s`<path d="M0 0H64V${by + 1}Q${cx} ${by + 3.6} 0 ${by + 1}Z" fill="#0a0707" opacity=".35" ${hc}/>`;
    h += s`<path d="M${cx - hw + 0.6} ${by}Q${cx} ${by + 3.2} ${cx + hw - 0.6} ${by}Z" fill="${dk(col, 0.5)}"/>`;
    h += s`<path d="M${cx - hw - 1.6} ${by - 0.4}C${cx - hw - 2.6} ${by - 4.6} ${cx - hw + 1} ${yt + 0.4} ${cx} ${yt}C${cx + hw - 1} ${yt + 0.4} ${cx + hw + 2.6} ${by - 4.6} ${cx + hw + 1.6} ${by - 0.4}Q${cx} ${by + 1.6} ${cx - hw - 1.6} ${by - 0.4}Z" fill="${col}"/>`;
    h += s`<path d="M${cx + 1.6} ${yt}C${cx + hw - 1} ${yt + 0.4} ${cx + hw + 2.6} ${by - 4.6} ${cx + hw + 1.6} ${by - 0.4}Q${cx + 5} ${by + 1} ${cx + 3} ${by + 1}Z" fill="#000" opacity=".28"/>`;
    h += s`<path d="M${cx - hw - 1.4} ${by - 0.6}Q${cx} ${by + 1.2} ${cx + hw + 1.4} ${by - 0.6}" stroke="${dk(col, 0.45)}" stroke-width=".5" fill="none"/><path d="M${cx - 6} ${by - 2}l2.4 -1.6M${cx - 3} ${by - 3.2}l2.4 -1.6M${cx - 8} ${by - 4.4}l2.4 -1.6M${cx + 1} ${by - 1.6}l2.4 -1.6" stroke="${lt(col, 0.35)}" stroke-width=".35" opacity=".5"/>`;
    return h;
  }
  // a headscarf, knotted under the chin
  const col = pick(d(63), ['#6b2a33', '#5f6236', '#2f5d5c', '#8a6a3a', '#4b4a5e']);
  let h = s`<path d="M${cx - hw - 1.6} 34C${cx - hw - 3} ${top} ${cx - 4} ${top - 2.6} ${cx} ${top - 2.6}C${cx + 4} ${top - 2.6} ${cx + hw + 3} ${top} ${cx + hw + 1.6} 34L${cx + hw - 0.4} 33C${cx + hw} ${top + 6} ${cx + 3} ${top + 4} ${cx} ${top + 4.2}C${cx - 3} ${top + 4} ${cx - hw} ${top + 6} ${cx - hw + 0.4} 33Z" fill="${col}"/>`;
  h += s`<path d="M${cx + 1} ${top - 2.6}C${cx + 4} ${top - 2.6} ${cx + hw + 3} ${top} ${cx + hw + 1.6} 34L${cx + hw - 0.4} 33C${cx + hw} ${top + 6} ${cx + 3} ${top + 4} ${cx + 1} ${top + 4.2}Z" fill="#000" opacity=".3"/>`;
  h += s`<path d="M${cx - 5} ${top + 1}Q${cx} ${top - 0.4} ${cx + 5} ${top + 1}M${cx - 7} ${top + 4}Q${cx} ${top + 2} ${cx + 7} ${top + 4}" stroke="${lt(col, 0.4)}" stroke-width=".5" fill="none" opacity=".45" stroke-dasharray="1 1"/>`;
  return h;
}

// ------------------------------------------------------------------ wardrobe
const SUITS: Record<string, string[]> = {
  soldier: ['#2f2e30', '#3a3129', '#45484a', '#2a2b2f', '#3c3a33', '#4a4a50'],
  capo: ['#252b38', '#2c2c30', '#3a3028', '#33363a', '#2a2e2a'],
  top: ['#1d1d22', '#23252c', '#2a2624', '#1f2026'],
};
const SHIRT_OPEN = ['#e8e0cf', '#e8e0cf', '#1c1a1c', '#c9b48a', '#9fb0c0', '#6b2a33', '#d9cdb4'];
const TIES = ['#6b1d27', '#3b2440', '#1f2c44', '#5e4a22', '#2c3a2c', '#7a2a2a', '#4a4a50'];
const CASUAL = ['#a8862f', '#8d4a2b', '#5f6236', '#2f5d5c', '#6b2a33', '#26314a', '#9a7a52', '#4a3527', '#c4b48e', '#6e7f8c'];

function dressOf(c: Character, F: Face, rank: Rank, rn: number, d: (i: number) => number, u: string, cx: number) {
  const fem = F.fem, nw = F.nw;
  const build = F.build;
  let defs = '', body = '';
  let hat: 'fedora' | 'cap' | 'scarf' | '' = '';
  let neckline: 'open' | 'turtle' | 'tie' | 'zip' | 'none' = 'none';
  const pad = fem ? 0 : rn >= 4 ? 1.6 : rn === 2 ? 1.2 : rn === 3 ? 0.8 : 0;
  const sw = fem ? 20.5 : 24 + build * 1.2 + pad;
  const ny = 44.6;
  const n0 = nw + 1.1;
  const torso = s`M${cx - sw - 3} 64L${cx - sw} 53Q${cx - sw + 1} 48.2 ${cx - sw + 7.5} 47L${cx - n0} ${ny}H${cx + n0}L${cx + sw - 7.5} 47Q${cx + sw - 1} 48.2 ${cx + sw} 53L${cx + sw + 3} 64Z`;
  defs += `<path id="${u}T" d="${torso}"/><clipPath id="${u}t"><use href="#${u}T"/></clipPath>`;
  const tc = `clip-path="url(#${u}t)"`;
  const shadeR = (o = 0.42) => s`<path d="M${cx + 5} ${ny}Q${cx + 9} 54 ${cx + 7.5} 64H64V${ny}Z" fill="${SHADE}" opacity="${o}" ${tc}/>`;
  const arms = (col: string) => s`<path d="M${cx - sw + 6} 52Q${cx - sw + 5.4} 58 ${cx - sw + 6.4} 64M${cx + sw - 6} 52Q${cx + sw - 5.4} 58 ${cx + sw - 6.4} 64" stroke="${dk(col, 0.5)}" stroke-width=".6" fill="none" opacity=".8"/>`;
  const base = (col: string) => `<use href="#${u}T" fill="${col}"/>` + arms(col);
  const Vp = (w: number, yb: number) => s`M${cx - w} ${ny - 0.3}L${cx} ${yb}L${cx + w} ${ny - 0.3}Z`;
  let vi = 0;
  const inV = (w: number, yb: number, inner: string) => { const id = `${u}v${vi++}`; defs += `<clipPath id="${id}"><path d="${Vp(w, yb)}"/></clipPath>`; return `<g clip-path="url(#${id})">${inner}</g>`; };
  const fillAll = (col: string) => `<rect x="0" y="40" width="64" height="24" fill="${col}"/>`;
  const lapels = (w: number, yb: number, lw: number, col: string, peak = false) => {
    const L = (sx: number) => s`M${cx + sx * w} ${ny - 0.4}L${cx + sx * 0.3} ${yb}L${cx + sx * (lw + 1.2)} ${yb - 5.6}L${cx + sx * (w + lw * 0.85)} ${peak ? 49.2 : 50.2}L${cx + sx * (w + lw * (peak ? 1.2 : 0.4))} ${peak ? 47.8 : 49.3}L${cx + sx * (w + lw * 0.75)} 46.8Z`;
    return `<path d="${L(-1)}" fill="${lt(col, 0.08)}"/><path d="${L(1)}" fill="${dk(col, 0.35)}"/>` + s`<path d="M${cx - 0.3} ${yb}L${cx - lw - 1.2} ${yb - 5.6}L${cx - w - lw * 0.85} ${peak ? 49.2 : 50.2}" stroke="${dk(col, 0.5)}" stroke-width=".4" fill="none"/><path d="M${cx - w - 0.2} ${ny}L${cx - 0.6} ${yb - 0.5}" stroke="${lt(col, 0.25)}" stroke-width=".35" opacity=".6"/>`;
  };
  const shirtV = (col: string) => fillAll(col) + s`<path d="M${cx + 0.2} ${ny}L${cx + 0.2} 64H64V${ny}Z" fill="${SHADE}" opacity=".18"/>`;
  const tieCollar = (shirt: string) => s`<path d="M${cx - nw - 0.2} ${ny - 2.4}L${cx - 0.4} ${ny + 2.6}L${cx - 2.6} ${ny + 4.4}L${cx - nw - 1.4} ${ny + 0.6}Z" fill="${lt(shirt, 0.2)}"/><path d="M${cx + nw + 0.2} ${ny - 2.4}L${cx + 0.4} ${ny + 2.6}L${cx + 2.6} ${ny + 4.4}L${cx + nw + 1.4} ${ny + 0.6}Z" fill="${dk(shirt, 0.22)}"/>`;
  const tie = (col: string, yb: number, pin = false) => {
    let t = s`<path d="M${cx - 1.15} ${ny + 2.1}H${cx + 1.15}L${cx + 0.8} ${ny + 4}H${cx - 0.8}Z" fill="${dk(col, 0.15)}"/><path d="M${cx - 0.8} ${ny + 4}H${cx + 0.8}L${cx + 2} ${yb + 2}L${cx} ${yb + 3.4}L${cx - 2} ${yb + 2}Z" fill="${col}"/><path d="M${cx + 0.1} ${ny + 4}H${cx + 0.8}L${cx + 2} ${yb + 2}L${cx + 0.1} ${yb + 3.4}Z" fill="${SHADE}" opacity=".3"/>`;
    if (pin) t += s`<path d="M${cx - 1.4} ${ny + 8}H${cx + 1.4}" stroke="${BRASS}" stroke-width=".45"/>`;
    return t;
  };
  const square = (col: string) => s`<path d="M${cx + 8.4} 55.4L${cx + 9.6} 53.8L${cx + 10.4} 55L${cx + 11.4} 53.9L${cx + 12} 55.6Z" fill="${col}"/><path d="M${cx + 8} 55.6H${cx + 12.4}" stroke="${SHADE}" stroke-width=".4" opacity=".6"/>`;
  const openCollar = (shirt: string, deep = 52) => {
    // the shirt collar spread out over the jacket, chest showing, very 1970
    let o = s`<path d="M${cx - nw} ${ny - 1}L${cx} ${deep}L${cx + nw} ${ny - 1}Z" fill="${F.skin}"/><path d="M${cx + nw * 0.4} ${ny - 1}L${cx + 0.4} ${deep - 0.6}L${cx} ${deep}L${cx + nw} ${ny - 1}Z" fill="${dk(F.skin, 0.42)}"/><path d="M${cx - 1.2} ${ny + 0.6}q1.2 1 2.4 0" stroke="${dk(F.skin, 0.6)}" stroke-width=".4" fill="none" opacity=".5"/>`;
    o += s`<path d="M${cx - nw - 0.4} ${ny - 2.2}L${cx} ${deep}L${cx + nw + 0.4} ${ny - 2.2}" stroke="${SHADE}" stroke-width="1" fill="none" opacity=".35"/>`;
    o += s`<path d="M${cx - nw - 0.4} ${ny - 2.2}Q${cx - nw - 0.8} ${ny + 1} ${cx - 2} ${deep - 1.6}L${cx - n0 - 4.6} ${ny + 5.6}L${cx - n0 - 2.6} ${ny + 0.4}Z" fill="${lt(shirt, 0.12)}"/>`;
    o += s`<path d="M${cx + nw + 0.4} ${ny - 2.2}Q${cx + nw + 0.8} ${ny + 1} ${cx + 2} ${deep - 1.6}L${cx + n0 + 4.6} ${ny + 5.6}L${cx + n0 + 2.6} ${ny + 0.4}Z" fill="${dk(shirt, 0.3)}"/>`;
    return o;
  };
  const zipLine = (col: string, y0 = ny) => s`<path d="M${cx} ${y0}V64" stroke="${dk(col, 0.55)}" stroke-width=".55"/><path d="M${cx + 0.25} ${y0}V64" stroke="#a8a294" stroke-width=".25" opacity=".6"/>`;
  const knitBand = (col: string, y0: number, y1: number, w: number) => { let k = s`<path d="M${cx - w} ${y0}Q${cx} ${y0 - 1} ${cx + w} ${y0}L${cx + w + 0.6} ${y1}Q${cx} ${y1 + 0.8} ${cx - w - 0.6} ${y1}Z" fill="${col}"/>`; let r = ''; for (let x = -w + 0.8; x < w; x += 1.1) r += s`M${cx + x} ${y0}v${y1 - y0}`; k += `<path d="${r}" stroke="${dk(col, 0.35)}" stroke-width=".25" opacity=".6"/>` + s`<path d="M${cx + 1} ${y0}Q${cx + w} ${y0} ${cx + w + 0.6} ${y1}H${cx + 1}Z" fill="${SHADE}" opacity=".3"/>`; return k; };
  const turtle = (col: string) => s`<path d="M${cx - nw - 0.6} ${39.6}Q${cx} ${40.6} ${cx + nw + 0.6} 39.6L${cx + nw + 1.6} ${ny + 0.6}Q${cx} ${ny + 2} ${cx - nw - 1.6} ${ny + 0.6}Z" fill="${col}"/><path d="M${cx - nw - 1} 41.6Q${cx} 42.8 ${cx + nw + 1} 41.6M${cx - nw - 1.2} 43.2Q${cx} 44.4 ${cx + nw + 1.2} 43.2" stroke="${dk(col, 0.4)}" stroke-width=".4" fill="none"/><path d="M${cx + 1.6} 40.4Q${cx + nw} 40.2 ${cx + nw + 0.6} 39.6L${cx + nw + 1.6} ${ny + 0.6}Q${cx + 3} ${ny + 1.6} ${cx + 1.6} ${ny + 1.4}Z" fill="${SHADE}" opacity=".35"/>`;
  const dots = (pts: string, col: string, w: number) => `<path d="${pts}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; // zero-length strokes with round caps
  const buttons = (ys: number[], col: string) => dots(ys.map((y) => s`M${cx} ${y}h0`).join(""), col, 0.9);
  const vstripes = (gap: number, col: string, w: number, o: number) => s`<path d="M0 54.3H64" stroke="${col}" stroke-width="19.4" stroke-dasharray="${w} ${gap - w}" opacity="${o}" ${tc}/>`;
  const pinstripe = (col: string) => vstripes(2.4, lt(col, 0.35), 0.18, 0.35);
  const sheen = (col: string) => s`<path d="M${cx - sw + 4} 52Q${cx - sw + 6} 48.4 ${cx - 12} 47.6M${cx - 14} 56Q${cx - 13} 52 ${cx - 9.6} 50" stroke="${lt(col, 0.5)}" stroke-width=".8" fill="none" opacity=".35" stroke-linecap="round"/>`;

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
      neckline = 'open';
    } else if (kind === 1) {
      // a shift dress, high round neck, a string of pearls
      body += s`<path d="M${cx - n0} ${ny}Q${cx} ${ny + 3.4} ${cx + n0} ${ny}" stroke="${dk(col, 0.4)}" stroke-width=".5" fill="none"/>`;
      if (d(4) < 0.6) { let pr = ''; for (let i = 0; i <= 10; i++) { const t = i / 10, a = Math.PI * t; pr += s`M${cx - Math.cos(a) * (n0 - 0.4)} ${ny + 0.4 + Math.sin(a) * 3.2}h0`; } body += dots(pr, "#e9e1cf", 1); }
    } else if (kind === 2) {
      body += turtle(col); neckline = 'turtle';
      if (d(4) < 0.5) body += s`<path d="M${cx - 2.6} ${ny + 1}Q${cx} 52 ${cx + 2.6} ${ny + 1}" stroke="${BRASS}" stroke-width=".35" fill="none"/><circle cx="${cx}" cy="51.4" r=".9" fill="${BRASS}"/>`;
    } else if (kind === 3) {
      // a scoop neck with a little scarf knotted at the throat
      const sc = pick(d(5), ['#c9a24a', '#a83a3a', '#e3d6bd', '#3d6b6a']);
      body += s`<path d="M${cx - n0} ${ny - 0.4}Q${cx} ${ny + 5.4} ${cx + n0} ${ny - 0.4}Z" fill="${F.skin}"/><path d="M${cx - nw - 0.4} ${ny - 1.6}Q${cx} ${ny + 2} ${cx + nw + 0.4} ${ny - 1.6}L${cx + nw + 1} ${ny}Q${cx} ${ny + 3.6} ${cx - nw - 1} ${ny}Z" fill="${sc}"/><path d="M${cx + 1} ${ny + 1.4}L${cx + 3.4} ${ny + 6}L${cx + 1.6} ${ny + 6.4}Z" fill="${dk(sc, 0.25)}"/>`;
      neckline = 'open';
    } else if (kind === 4) {
      // a buttoned cardigan, the plainest thing in the closet
      body += s`<path d="M${cx - n0} ${ny}Q${cx} ${ny + 2.4} ${cx + n0} ${ny}" stroke="${dk(col, 0.4)}" stroke-width=".8" fill="none"/><path d="M${cx} ${ny + 2}V64" stroke="${dk(col, 0.4)}" stroke-width=".5"/>` + buttons([50, 54, 58, 62], lt(col, 0.5));
    } else {
      // the wife of a made man: dark silk, a fur collar
      const fur = pick(d(6), ['#5a4636', '#2a2420', '#8a7a66']);
      body += s`<path d="M${cx - n0} ${ny}Q${cx} ${ny + 4} ${cx + n0} ${ny}" stroke="${dk(col, 0.4)}" stroke-width=".5" fill="none"/>`;
      body += s`<path d="M${cx - n0 - 0.4} ${ny - 0.6}Q${cx - n0 - 6} ${ny + 2} ${cx - sw + 5} 52Q${cx - n0 - 3} ${ny + 6} ${cx - 2.4} 58Q${cx - n0} ${ny + 4} ${cx - n0 - 0.4} ${ny - 0.6}ZM${cx + n0 + 0.4} ${ny - 0.6}Q${cx + n0 + 6} ${ny + 2} ${cx + sw - 5} 52Q${cx + n0 + 3} ${ny + 6} ${cx + 2.4} 58Q${cx + n0} ${ny + 4} ${cx + n0 + 0.4} ${ny - 0.6}Z" fill="${fur}"/><path d="M${cx + n0 + 0.4} ${ny - 0.6}Q${cx + n0 + 6} ${ny + 2} ${cx + sw - 5} 52Q${cx + n0 + 3} ${ny + 6} ${cx + 2.4} 58Z" fill="${SHADE}" opacity=".35"/>`;
      let pr = ''; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; pr += s`M${cx - Math.cos(a) * (n0 - 0.4)} ${ny + 0.4 + Math.sin(a) * 3.4}h0`; } body += dots(pr, "#e9e1cf", 1);
    }
    if (F.age >= 2 && rn === 0 && d(7) < 0.3) hat = 'scarf';
    return { defs, body, hat, over: (_chain: boolean) => '' };
  }

  if (rank === 'civilian') {
    const kind = pick(d(2), [0, 1, 1, 2, 3, 4, 5]);
    if (kind === 0) {
      // cardigan over a collared shirt, sometimes a tie
      const col = pick(d(3), ['#5a4a3a', '#8a7a5e', '#4f5a44', '#6b5a4a', '#3e4652', '#7a6a50']);
      const sh = pick(d(4), ['#e2dac6', '#cdd3d4', '#d9cfb4']);
      body += base(col) + shadeR() + inV(n0 + 1.2, 56, shirtV(sh) + (d(5) < 0.5 ? tie(pick(d(6), TIES), 56) : '')) + tieCollar(sh);
      body += s`<path d="M${cx - n0 - 1.2} ${ny}L${cx - 0.4} 56.4V64M${cx + n0 + 1.2} ${ny}L${cx + 0.4} 56.4" stroke="${dk(col, 0.4)}" stroke-width=".7" fill="none"/>` + buttons([58.4, 61.6], lt(col, 0.4));
      neckline = d(5) < 0.5 ? 'tie' : 'open';
    } else if (kind === 1) {
      // a work shirt: chambray or khaki, two pockets, an undershirt at the neck
      const col = pick(d(3), ['#5c6e82', '#7a8a96', '#8a7d5e', '#6e6a5e', '#4c5a66']);
      body += base(col) + shadeR(0.32);
      body += s`<path d="M${cx - n0 + 0.6} ${ny}Q${cx} ${ny + 3} ${cx + n0 - 0.6} ${ny}Z" fill="#e4dccb"/>`;
      body += s`<path d="M${cx - nw - 0.4} ${ny - 2}L${cx - 1} ${ny + 3.6}L${cx - n0 - 3.6} ${ny + 4.6}Z" fill="${lt(col, 0.1)}"/><path d="M${cx + nw + 0.4} ${ny - 2}L${cx + 1} ${ny + 3.6}L${cx + n0 + 3.6} ${ny + 4.6}Z" fill="${dk(col, 0.25)}"/>`;
      body += s`<path d="M${cx} ${ny + 3}V64" stroke="${dk(col, 0.35)}" stroke-width=".5"/><path d="M${cx - 10} 53.4h5.6v4.4h-5.6zM${cx + 4.4} 53.4h5.6v4.4h-5.6z" fill="none" stroke="${dk(col, 0.35)}" stroke-width=".4"/>` + buttons([51, 55, 59, 63], '#d8d0c0');
      neckline = 'open';
      if (d(7) < 0.25) hat = 'cap';
    } else if (kind === 2) {
      // a zip windbreaker over a shirt
      const col = pick(d(3), ['#26314a', '#8a7a5e', '#6e3a2a', '#3f4a3a', '#5a5a5e']);
      const sh = pick(d(4), ['#e2dac6', '#cdd3d4']);
      body += base(col) + shadeR() + s`<path d="M${cx - n0} ${ny}L${cx} 50L${cx + n0} ${ny}Z" fill="${sh}"/>` + tieCollar(sh) + knitBand(dk(col, 0.1), ny - 1.4, ny + 1.2, n0 + 2.2).replace(/^/, '') + zipLine(col, 50);
      neckline = 'open';
      if (d(7) < 0.3) hat = 'cap';
    } else if (kind === 3) {
      // the shopkeeper: white shirt, dark tie, an apron
      const sh = '#e6e0d2';
      body += base(sh) + shadeR(0.25) + tieCollar(sh) + tie(pick(d(6), ['#1f2c44', '#3a2a24', '#5a2a2a', '#2a2a2a']), 54);
      const ap = pick(d(5), ['#e8e2d4', '#d4cdbd', '#c9d0d4']);
      body += s`<path d="M${cx - 8.4} 54.4H${cx + 8.4}L${cx + 9} 64H${cx - 9}Z" fill="${ap}"/><path d="M${cx - 8} 54.6L${cx - n0 - 0.6} ${ny}M${cx + 8} 54.6L${cx + n0 + 0.6} ${ny}" stroke="${dk(ap, 0.15)}" stroke-width=".9"/><path d="M${cx + 1} 54.4H${cx + 8.4}L${cx + 9} 64H${cx + 1}Z" fill="${SHADE}" opacity=".18"/>`;
      if (d(8) < 0.4) body += s`<path d="M${cx - 8.4} 56h16.8M${cx - 8.6} 58h17.2M${cx - 8.7} 60h17.4M${cx - 8.8} 62h17.6" stroke="#7a8aa0" stroke-width=".5" opacity=".7"/>`;
      neckline = 'tie';
    } else if (kind === 4) {
      // a plaid flannel shirt
      const col = pick(d(3), ['#6e2a24', '#3a4a36', '#2a344a', '#7a5a2a']);
      body += base(col) + shadeR(0.35);
      const pl = (c0: string, w: number, o: number, off = 0) => vstripes(3.2, c0, w, o).replace('M0 54.3H64', s`M${off} 54.3H64`) + s`<path d="M${30 + off} 44.6V64" stroke="${c0}" stroke-width="64" stroke-dasharray="${w} ${3.2 - w}" opacity="${o}" ${tc}/>`;
      body += pl(dk(col, 0.55), 0.8, 0.55) + pl(lt(col, 0.4), 0.2, 0.5, 0.9);
      body += s`<path d="M${cx - n0 + 0.6} ${ny}L${cx} 50L${cx + n0 - 0.6} ${ny}Z" fill="${F.skin}"/>` + s`<path d="M${cx - nw - 0.4} ${ny - 2}L${cx - 1} ${ny + 4}L${cx - n0 - 3.6} ${ny + 4.6}Z" fill="${lt(col, 0.1)}"/><path d="M${cx + nw + 0.4} ${ny - 2}L${cx + 1} ${ny + 4}L${cx + n0 + 3.6} ${ny + 4.6}Z" fill="${dk(col, 0.25)}"/>`;
      neckline = 'open';
      if (d(7) < 0.2) hat = 'cap';
    } else {
      // the clerk: a sweater vest, shirt and tie
      const col = pick(d(3), ['#6a5a40', '#4a4f5a', '#5a3a30', '#3f4a40']);
      const sh = pick(d(4), ['#e2dac6', '#cdd3d4']);
      body += base(sh) + shadeR(0.25);
      body += s`<path d="M${cx - sw + 8} 64L${cx - sw + 7.6} 50Q${cx - sw + 9} 47.6 ${cx - n0 - 0.6} ${ny + 0.4}L${cx} 55L${cx + n0 + 0.6} ${ny + 0.4}Q${cx + sw - 9} 47.6 ${cx + sw - 7.6} 50L${cx + sw - 8} 64Z" fill="${col}"/>`;
      body += tieCollar(sh) + tie(pick(d(6), TIES), 54) + s`<path d="M${cx - n0 - 0.6} ${ny + 0.4}L${cx} 55L${cx + n0 + 0.6} ${ny + 0.4}" stroke="${dk(col, 0.35)}" stroke-width=".8" fill="none"/>` + shadeR(0.3);
      neckline = 'tie';
    }
    if (!hat && F.age >= 2 && d(9) < 0.18) hat = 'fedora';
  } else if (rank === 'associate') {
    // young and on the street: no tie, nothing pressed
    const kind = pick(d(2), [0, 1, 1, 2, 3, 4]);
    if (kind === 0) {
      // a track jacket, zipped to the throat, stripes down the sleeves
      const col = pick(d(3), ['#26314a', '#6b2a33', '#2a3a2e', '#1c1b1e', '#5a2a3a', '#2f5d5c']);
      const st = pick(d(4), ['#e8e0cf', '#c9a24a', '#e8e0cf']);
      body += base(col) + shadeR();
      body += s`<path d="M${cx - n0 - 3} 47.4Q${cx - sw + 3} 48.6 ${cx - sw + 0.6} 54L${cx - sw - 0.8} 64M${cx + n0 + 3} 47.4Q${cx + sw - 3} 48.6 ${cx + sw - 0.6} 54L${cx + sw - 0.8} 64" stroke="${st}" stroke-width=".7" fill="none" opacity=".9"/><path d="M${cx - n0 - 3.4} 48.6Q${cx - sw + 3.6} 50 ${cx - sw + 1.8} 55L${cx - sw + 0.6} 64M${cx + n0 + 3.4} 48.6Q${cx + sw - 3.6} 50 ${cx + sw - 1.8} 55L${cx + sw - 0.6} 64" stroke="${st}" stroke-width=".7" fill="none" opacity=".9"/>`;
      body += s`<path d="M${cx - nw - 0.8} 40.4Q${cx} 41.6 ${cx + nw + 0.8} 40.4L${cx + n0 + 0.8} ${ny + 0.8}Q${cx} ${ny + 2} ${cx - n0 - 0.8} ${ny + 0.8}Z" fill="${col}"/><path d="M${cx - nw - 0.6} 41.6Q${cx} 42.8 ${cx + nw + 0.6} 41.6" stroke="${st}" stroke-width=".4" fill="none" opacity=".7"/><path d="M${cx + 1} 41.4Q${cx + nw} 41 ${cx + nw + 0.8} 40.4L${cx + n0 + 0.8} ${ny + 0.8}Q${cx + 3} ${ny + 1.8} ${cx + 1} ${ny + 1.6}Z" fill="${SHADE}" opacity=".35"/>` + zipLine(col, 41.4) + s`<rect x="${cx - 0.5}" y="43" width="1" height="2" rx=".3" fill="#b8b2a4"/>`;
      neckline = 'zip';
    } else if (kind === 1) {
      // a leather jacket, wide collar, over an open shirt or a turtleneck
      const col = pick(d(3), ['#1a1716', '#2e2019', '#3a2418', '#1e1c1e', '#4a2a1e']);
      const under = d(4) < 0.45 ? 'turtle' : 'open';
      const sh = pick(d(5), under === 'turtle' ? ['#1c1a1c', '#e2dac6', '#5a2a2a', '#3a3530'] : ['#e8e0cf', '#c9b48a', '#9fb0c0', '#a8862f', '#6b2a33']);
      body += base(col) + shadeR(0.45) + sheen(col);
      body += inV(n0 + 2, 60, shirtV(sh));
      body += lapels(n0 + 2, 60, 4.6, col, true);
      body += under === 'turtle' ? turtle(sh) : openCollar(sh, 53);
      neckline = under;
    } else if (kind === 2) {
      // a bomber with a ribbed collar
      const col = pick(d(3), ['#4a4a32', '#26314a', '#6e5a3a', '#3a3a3e', '#6b2a24']);
      const tee = pick(d(4), ['#e4dccb', '#1c1a1c', '#8a7a5e']);
      body += base(col) + shadeR() + s`<path d="M${cx - n0 - 0.6} ${ny - 0.6}Q${cx} ${ny + 6.4} ${cx + n0 + 0.6} ${ny - 0.6}Z" fill="${tee}"/><path d="M${cx - nw} ${ny - 0.6}Q${cx} ${ny + 3.6} ${cx + nw} ${ny - 0.6}" stroke="${dk(tee, 0.3)}" stroke-width=".7" fill="none"/>` + s`<path d="M${cx - n0 - 0.6} ${ny - 0.6}L${cx - 1.6} 64M${cx + n0 + 0.6} ${ny - 0.6}L${cx + 1.6} 64" stroke="${dk(col, 0.5)}" stroke-width=".7" fill="none"/>` + knitBand(dk(col, 0.25), ny - 1.4, ny + 0.8, n0 + 3.2);
      body += s`<path d="M${cx - 11} 55.6h6M${cx + 5} 55.6h6" stroke="${dk(col, 0.45)}" stroke-width=".6"/>`;
      neckline = 'open';
    } else if (kind === 3) {
      // a turtleneck on its own
      const col = pick(d(3), ['#1c1a1c', '#2a2628', '#d6cbb3', '#4a3527', '#5a2a2a', '#26314a']);
      body += base(col) + shadeR(0.4) + turtle(col);
      neckline = 'turtle';
    } else {
      // an open sport shirt, collar spread wide
      const col = pick(d(3), ['#a8862f', '#8d4a2b', '#c4b48e', '#9fb0c0', '#5f6236', '#d9cdb4', '#6e3a2a']);
      body += base(col) + shadeR(0.35);
      if (d(5) < 0.4) body += vstripes(2.2, dk(col, 0.35), 0.45, 0.5);
      body += openCollar(col, 53.6) + buttons([56, 60, 63.6], lt(col, 0.4));
      body += s`<path d="M${cx} 53.6V64" stroke="${dk(col, 0.4)}" stroke-width=".45"/>`;
      neckline = 'open';
    }
    if (d(10) < 0.3) hat = 'cap';
  } else if (rank === 'soldier') {
    // a suit, but the collar is open and the tie stayed home
    const col = pick(d(3), SUITS.soldier);
    const coat = d(4) < 0.15;
    const under = d(5) < 0.3 ? 'turtle' : 'open';
    const sh = pick(d(6), under === 'turtle' ? ['#1c1a1c', '#2a2628', '#3a1c22'] : SHIRT_OPEN);
    const jc = coat ? pick(d(7), ['#2a1e18', '#1a1716', '#3a2a20']) : col;
    body += base(jc) + shadeR(0.45) + (coat ? sheen(jc) : '');
    body += inV(n0 + 1.6, 59, shirtV(sh));
    body += lapels(n0 + 1.6, 59, coat ? 4.6 : 3.8, jc, coat);
    body += under === 'turtle' ? turtle(sh) : openCollar(sh, 52);
    neckline = under;
    if (d(8) < 0.1) hat = 'fedora';
  } else if (rank === 'capo') {
    // a proper suit and tie
    const col = pick(d(3), SUITS.capo);
    const sh = pick(d(4), ['#ece6d8', '#ece6d8', '#c9d4dc', '#e2d8c0']);
    body += base(col) + (d(5) < 0.4 ? pinstripe(col) : '') + shadeR(0.45);
    body += inV(n0 + 1.2, 58, shirtV(sh) + tie(pick(d(6), TIES), 58, d(7) < 0.35)) + tieCollar(sh);
    body += lapels(n0 + 1.2, 58, 3.6, col) + (d(8) < 0.8 ? square(pick(d(9), ['#ece6d8', '#ece6d8', '#c9a24a', '#8a2a34'])) : '');
    neckline = 'tie';
    if (d(10) < 0.25) hat = 'fedora';
  } else {
    // the top of the family: three pieces, an overcoat, the hat
    const col = pick(d(3), SUITS.top);
    const sh = pick(d(4), ['#ece6d8', '#ece6d8', '#e4dccb']);
    const tc0 = pick(d(6), rank === 'boss' ? ['#4a1820', '#5a5a60', '#1f2c44', '#3a2a40'] : TIES);
    const coat = d(5) < (rank === 'boss' ? 0.65 : 0.25);
    const coatC = pick(d(7), ['#8a6e4c', '#1a1919', '#2e2e32', '#1e2230', '#6e5a44']);
    const scarf = coat && d(8) < 0.3;
    const vest = (yb: number) => s`<path d="M${cx - 14} 64L${cx - 14} ${ny}H${cx - n0 + 0.4}L${cx} ${yb}L${cx + n0 - 0.4} ${ny}H${cx + 14}V64Z" fill="${col}"/><path d="M${cx + 0.2} ${yb}L${cx + n0 - 0.4} ${ny}H${cx + 14}V64H${cx + 0.2}Z" fill="${SHADE}" opacity=".35"/>` + buttons([yb + 2.2, yb + 4.6, yb + 7], lt(col, 0.35));
    const suitInner = shirtV(sh) + tie(tc0, 57, rank === 'boss') + vest(52.6);
    if (coat) {
      body += base(coatC) + shadeR(0.45);
      body += inV(n0 + 3.4, 66, fillAll(col) + inV(n0 + 1, 60, suitInner) + tieCollar(sh) + lapels(n0 + 1, 60, 2.8, col));
      body += lapels(n0 + 3.4, 66, 6, coatC, true);
      if (scarf) body += s`<path d="M${cx - n0 - 3} ${ny - 0.4}L${cx - 4} 64H${cx - 7.4}L${cx - n0 - 4.6} ${ny + 2}ZM${cx + n0 + 3} ${ny - 0.4}L${cx + 4} 64H${cx + 7.4}L${cx + n0 + 4.6} ${ny + 2}Z" fill="#e6dfd0"/><path d="M${cx + n0 + 3} ${ny - 0.4}L${cx + 4} 64H${cx + 7.4}L${cx + n0 + 4.6} ${ny + 2}Z" fill="${SHADE}" opacity=".25"/>`;
    } else {
      body += base(col) + (d(9) < 0.35 ? pinstripe(col) : '') + shadeR(0.45);
      body += inV(n0 + 1.2, 60, suitInner) + tieCollar(sh) + lapels(n0 + 1.2, 60, 3.8, col, rank === 'boss');
      body += square(pick(d(10), ['#ece6d8', '#ece6d8', '#c9a24a', '#8a2a34']));
    }
    neckline = 'tie';
    if (d(11) < (rank === 'boss' ? 0.55 : 0.35)) hat = 'fedora';
  }
  const chainOn = d(20) < (rank === 'soldier' ? 0.45 : rank === 'associate' ? 0.3 : 0);
  const over = (chain: boolean) => {
    if (!(chain || chainOn) || neckline === 'tie') return '';
    if (neckline === 'open') return s`<path d="M${cx - n0 + 1} ${ny - 0.2}Q${cx} 52.6 ${cx + n0 - 1} ${ny - 0.2}" stroke="${BRASS}" stroke-width=".55" fill="none"/><path d="M${cx - n0 + 1.4} ${ny}Q${cx} 52 ${cx + 0.4} 51.6" stroke="#f0d9a0" stroke-width=".2" fill="none" opacity=".8"/>`;
    return s`<path d="M${cx - n0} ${ny + 0.4}Q${cx} 52.4 ${cx + n0} ${ny + 0.4}" stroke="${BRASS}" stroke-width=".55" fill="none"/><circle cx="${cx}" cy="51.8" r=".8" fill="${BRASS}"/>`;
  };
  return { defs, body, hat, over };
}

// A pack of supplied portraits, when there is one, replaces the painted ones. Each is picked by rank tier and the man's id.
function packed(c: Character): string {
  const tier = c.rank === 'boss' || c.rank === 'underboss' ? 'top' : c.rank === 'capo' || c.rank === 'soldier' ? 'mid' : 'low';
  const pool = PACK.filter((p) => p.tier === tier);
  const use = pool.length ? pool : PACK;
  const p = use[hashOf(c.id) % use.length];
  const hurt = safe(() => W().now < c.hurtUntil, false);
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-label="${esc(c.name ?? '')}" xmlns="http://www.w3.org/2000/svg"><image href="${p.src}" width="64" height="64" preserveAspectRatio="xMidYMid slice"/>${hurt ? '<ellipse cx="27" cy="28" rx="3.6" ry="2.8" fill="#5a3350" opacity=".45"/>' : ''}</svg>`;
}
