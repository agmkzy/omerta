// Portraits: a noir illustration, flat planes of colour under one warm key light from the left.
// The face comes from the man's seed (his id, or the look he chose) and never changes; his rank decides how formally he
// dresses, so a promoted associate starts dressing like a soldier with the same face above the collar.
// No SVG filters: every shape is hard-edged, so the faces stay crisp at 36 px and cheap to draw by the dozen.
//
// The painter is layered, back to front, and every layer is fitted to anchors the face computes (portrait/face.ts):
//   background → hair behind the head → neck → clothes → head (ears, skin, features) → facial hair → glasses arms
//   → hair → glasses fronts, habits, earrings → jewellery → hat → bruises.
// A hat hands the hair a clip region (below its brim), so hair never shows through a crown; glasses arms run to the ear the
// face placed and sit under the hair; collars are cut to the neck's width.
import type { Character, Rank } from '../types';
import { W } from './state';
import { PACK } from './portraits_pack';
import { beardOf } from './portrait/beard';
import { dressOf, jewelOf } from './portrait/dress';
import { bruiseOf, earringsOf, habitOf, lensesOf } from './portrait/extras';
import { faceOf, seedOf } from './portrait/face';
import { hairOf } from './portrait/hair';
import { HAT_BY_INDEX, hatOf } from './portrait/hats';
import { armsOf, headOf, neckOf } from './portrait/head';
import { LIMIT, OUTFIT_COLOURS, SHIRT_COLOURS, TIE_COLOURS, type LookX } from './portrait/options';
import { clamp, esc, hashOf, mk, opt, safe, wpick } from './portrait/util';

export { HAIR_LIST, IRIS_LIST, LOOK_GROUPS, LOOK_OPTIONS, OUTFIT_COLOURS, OUTFITS, randomLook, SHIRT_COLOURS, SKIN_LIST, TIE_COLOURS } from './portrait/options';
export type { LookGroup, LookOption, LookX } from './portrait/options';

const RANKN: Record<Rank, number> = { civilian: 0, associate: 1, soldier: 2, capo: 3, underboss: 4, boss: 5 };

// ------------------------------------------------------------------ the portrait
let SEQ = 0;
export function portrait(c: Character): string {
  if (PACK.length) return packed(c);
  const u = 'q' + (++SEQ).toString(36) + '_';
  const p = paint(c, u);
  const body = (p.bg + p.back + p.neck + p.dress + p.face + p.hair + p.det + p.over).replace(/ fill="none"| stroke-linecap="round"/g, '');
  return `<svg viewBox="6 ${p.vy} 52 52" width="100%" height="100%" role="img" aria-label="${esc(c.name ?? '')}" xmlns="http://www.w3.org/2000/svg"><defs>${p.defs}</defs><g fill="none" stroke-linecap="round">${body}</g></svg>`;
}

// The layers of one portrait, exposed for tests: back, neck, face, hair and det come from the face alone, never the rank.
export function portraitParts(c: Character, u = 'x_') { return paint(c, u); }

// What his eyes, mouth and neck carry, decided by the seed (glasses, a habit) unless he chose them.
function trimmings(c: Character, fem: boolean, age: number) {
  const lk = (c.look ?? {}) as LookX;
  const gr = mk(seedOf(c) + 'g');
  const T = c.traits ?? ({} as Character['traits']);
  let glasses = opt(lk.glasses, LIMIT.glasses) ?? (fem ? (age >= 2 && gr(0) < 0.15 ? 1 : 0) : wpick(gr(0), age >= 2 ? [80, 8, 3, 7, 2] : [90, 3, 3, 2, 2]));
  if (lk.glasses == null && glasses === 1 && gr(3) < 0.4) glasses = gr(4) < 0.6 ? 5 : 7; // browlines and round wire frames
  if (lk.glasses == null && glasses === 4 && gr(3) < 0.4) glasses = 6;
  const habit = opt(lk.habit, LIMIT.habit) ?? (fem ? 0 : wpick(gr(1), [10, 1.4 + (T.vice ?? 0.3) * 2.4, 0.6, 0.7, 0]));
  return { glasses, habit, earrings: fem && gr(2) < 0.6 };
}

function paint(c: Character, u: string) {
  const F = faceOf(c);
  const rank: Rank = RANKN[c.rank] != null ? c.rank : 'civilian';
  const rn = RANKN[rank];
  const lk = (c.look ?? {}) as LookX;
  const seed = seedOf(c);
  const d = mk(seed + '/' + rank); // the wardrobe: re-rolled when his rank changes, nothing else
  const hurt = safe(() => W().now < c.hurtUntil, false);
  const { glasses, habit, earrings } = trimmings(c, F.fem, F.age);
  let defs = '';

  // ---- background: a dark room, warmer the higher he stands
  const BG: Record<Rank, [string, string]> = { civilian: ['#4a4e52', '#141516'], associate: ['#54473a', '#15120f'], soldier: ['#4a443e', '#121110'], capo: ['#4f4535', '#13110d'], underboss: ['#563a34', '#140e0d'], boss: ['#5e3a36', '#150d0d'] };
  const [b0, b1] = BG[rank];
  defs += `<radialGradient id="${u}g" cx=".56" cy=".32" r=".62"><stop offset="0" stop-color="${b0}"/><stop offset="1" stop-color="${b1}"/></radialGradient>`;
  const bg = `<rect width="64" height="64" fill="url(#${u}g)"/>`;

  // ---- the head outline every face layer is clipped to
  defs += `<path id="${u}H" d="${F.headPath}"/><clipPath id="${u}h"><use href="#${u}H"/></clipPath>`;
  const head = headOf(c, F, u);
  defs += head.defs;
  const face = head.face + beardOf(F, u) + armsOf(F, glasses);

  // ---- hair, clothes, and the hat that decides how much of the hair shows
  const H = hairOf(F, u);
  defs += H.defs;
  const D = dressOf(c, F, rank, rn, d, u);
  defs += D.defs;
  const hatStream = lk.hat != null ? mk(seed + '/hat') : d;
  const hat = D.hat ? hatOf(D.hat, F, H, hatStream, u) : null;
  defs += `<clipPath id="${u}hc"><path d="${hat ? hat.clip : 'M0 0H64V64H0Z'}"/></clipPath>`;

  // ---- what sits on the face, then over everything
  let det = lensesOf(F, glasses) + habitOf(F, habit);
  if (earrings) det += earringsOf(F);
  let over = jewelOf(F, D, D.jewel || (habit === 4 ? 1 : 0));
  if (hat) over += hat.svg;
  if (hurt) over += bruiseOf(F);
  const contentTop = hat ? hat.top : F.top - H.vol;
  const vy = clamp(contentTop - 1.6, 3.2, 5.6);
  // the anchors the layers were fitted to, so tests can check the fit without reading pixels
  const fit = {
    skullTop: F.top, hairTop: F.top - H.vol, hairSide: H.side, hatTop: hat?.top ?? null, band: hat?.band ?? null, crown: hat?.crown ?? null,
    skullAtBand: hat ? F.halfAt(hat.band) : null, eyeY: F.eyeY, eyeDX: F.eyeDX, earX: F.earX, earY: F.earY, earRy: F.earRy, browY: F.browY,
    neck: F.nw, chin: F.chin, mouthY: F.my, noseY: F.nb, glasses, vy,
  };
  return { defs, bg, back: H.back, neck: neckOf(F), dress: D.body, face, hair: H.front, det, over, vy, hat: D.hat, garment: D.garment, fit };
}

// ------------------------------------------------------------------ what the painter actually used
const TASTE_OF: Record<string, number> = { leather: 0, track: 1, sport: 2, turtleneck: 3, bomber: 4, cardigan: 5, windbreaker: 6, suitOpen: 7, suitTurtle: 7, suitTie: 8, threePiece: 9, carcoat: 10, overcoat: 11 };
// Every option of his look, resolved: what he chose where he chose it, what his seed gave him everywhere else. The creator uses
// it to show which option is in effect; it is also how an old save's face is fully defined from the fields it has.
export function resolveLook(c: Character): Required<Omit<LookX, 'seed'>> & { seed: string } {
  const F = faceOf(c);
  const lk = (c.look ?? {}) as LookX;
  const t = trimmings(c, F.fem, F.age);
  const rank: Rank = RANKN[c.rank] != null ? c.rank : 'civilian';
  const D = dressOf(c, F, rank, RANKN[rank], mk(seedOf(c) + '/' + rank), 'r_');
  const idx = (list: string[], k: keyof LookX) => opt(lk[k], list.length) ?? 0;
  return {
    seed: seedOf(c), skin: F.skinI, hairColour: F.hairI ?? 0, style: F.style, beard: F.beard, glasses: t.glasses, jaw: F.jaw,
    build: F.build, nose: F.nose, brows: F.brows, age: F.age, mark: F.mark, habit: t.habit,
    head: F.head, eyes: F.eyes, iris: F.irisI, mouth: F.mouth, hairline: F.hairline, hairLen: F.hairLen, texture: F.texture,
    outfit: opt(lk.outfit, LIMIT.outfit) ?? TASTE_OF[D.garment] ?? 7, outfitColour: idx(OUTFIT_COLOURS, 'outfitColour'), shirt: idx(SHIRT_COLOURS, 'shirt'), tie: idx(TIE_COLOURS, 'tie'),
    hat: Math.max(0, HAT_BY_INDEX.indexOf(D.hat === 'scarf' ? '' : D.hat)), jewel: D.jewel,
  };
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
