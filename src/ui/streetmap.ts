// The city, drawn (the redesign, owner 26 October): each of the seven districts as an illustrated, static neighbourhood to pick a
// place from. Not a live map: nobody walks on it and nothing is tracked. Each district has its real streets and its own look
// (Little Italy's tenements, the el over 86th Street, Red Hook's piers, the avenues of Hell's Kitchen, Arthur Avenue, the houses and
// the ferry on Staten Island, the el over 31st Street in Astoria), drawn once from a fixed seed so it looks the same every visit.
// On it, a signboard for every place you could walk into: the family clubs, Little Italy's café, bar, barber and church, and every
// business in the district, coloured by whose it is as far as you know. Tapping one opens it.
import { DAY } from '../types';
import type { Business, Character, World } from '../types';
import { DISTRICTS } from '../core';
import { knowsProtection } from '../acquaint';
import { openAt, SLICE, spots, whoIsAt } from '../city';
import { esc, P, W } from './links';

// (a small seeded generator of its own: the drawing is decoration, and must not touch the world's random stream)
function seeded(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const f1 = (n: number) => Math.round(n * 10) / 10;

type Street = { n: string; at: number; w: number };
type Look = 'tenement' | 'houses' | 'warehouse';
interface District {
  ns: Street[]; ew: Street[];                       // streets running up the drawing, and across it
  look: (bx: number, by: number) => Look;           // what each block is built of
  water?: { x0: number; x1: number; y0: number; y1: number }[];
  el?: { ew?: string; ns?: string };                // an elevated line over a street
  mark?: { x: number; y: number; w: number; h: number; kind: 'church' | 'market' | 'terminal' };
  ang: number; wide: [number, number, number]; tall: [number, number, number]; // turn, and centre and scale for each framing
}
const st = (n: string, at: number, w = 32): Street => ({ n, at, w });
// Each district: real streets of the neighbourhood the game means, laid out as a grid around the view.
const CITY: Record<string, District> = {
  'Little Italy': {
    ns: [st('CENTRE ST', 100, 40), st('BAXTER ST', 330), st('MULBERRY ST', 560, 36), st('MOTT ST', 790), st('ELIZABETH ST', 1010, 30), st('THE BOWERY', 1240, 64)],
    ew: [st('KENMARE ST', -160, 42), st('BROOME ST', 80), st('GRAND ST', 320, 38), st('HESTER ST', 560), st('CANAL ST', 820, 60)],
    look: () => 'tenement', mark: { x: 354, y: 584, w: 128, h: 206, kind: 'church' },
    ang: -12, wide: [590, 430, 0.88], tall: [585, 425, 0.7],
  },
  Bensonhurst: {
    ns: [st('18TH AVE', 120, 40), st('19TH AVE', 380), st('20TH AVE', 640), st('BAY PKWY', 900, 56), st('21ST AVE', 1160)],
    ew: [st('81ST ST', -80, 28), st('82ND ST', 130, 28), st('83RD ST', 340, 28), st('84TH ST', 550, 28), st('85TH ST', 760, 28), st('86TH ST', 970, 52)],
    look: (bx, by) => (by > 860 || bx < 150 ? 'tenement' : 'houses'), el: { ew: '86TH ST' },
    ang: 16, wide: [600, 620, 0.78], tall: [560, 640, 0.62],
  },
  'Red Hook': {
    ns: [st('COLUMBIA ST', 360, 40), st('VAN BRUNT ST', 600, 36), st('CONOVER ST', 830), st('FERRIS ST', 1050)],
    ew: [st('SULLIVAN ST', 60), st('WOLCOTT ST', 260), st('DIKEMAN ST', 460), st('COFFEY ST', 660), st('KING ST', 860)],
    look: (bx) => (bx > 860 ? 'warehouse' : bx > 620 ? 'tenement' : 'houses'),
    water: [{ x0: 1180, x1: 1700, y0: -400, y1: 1400 }],
    ang: 8, wide: [760, 450, 0.8], tall: [800, 450, 0.64],
  },
  "Hell's Kitchen": {
    ns: [st('8TH AVE', 120, 50), st('9TH AVE', 420, 50), st('10TH AVE', 720, 50), st('11TH AVE', 1020, 50)],
    ew: [st('W 47TH ST', 0), st('W 46TH ST', 180), st('W 45TH ST', 360), st('W 44TH ST', 540), st('W 43RD ST', 720), st('W 42ND ST', 900, 46)],
    look: (bx) => (bx > 1000 ? 'warehouse' : 'tenement'),
    water: [{ x0: 1180, x1: 1700, y0: -400, y1: 1400 }],
    ang: -28, wide: [640, 470, 0.82], tall: [640, 470, 0.64],
  },
  'The Bronx': {
    ns: [st('BELMONT AVE', 160), st('HUGHES AVE', 400), st('ARTHUR AVE', 640, 40), st('CAMBRELENG AVE', 880), st('SOUTHERN BLVD', 1130, 56)],
    ew: [st('E 189TH ST', -60), st('E 188TH ST', 170), st('E 187TH ST', 400, 44), st('E 186TH ST', 630), st('CRESCENT AVE', 860, 40)],
    look: () => 'tenement', mark: { x: 668, y: 440, w: 170, h: 120, kind: 'market' },
    ang: -6, wide: [640, 420, 0.86], tall: [640, 420, 0.68],
  },
  'Staten Island': {
    ns: [st('JERSEY ST', 140), st('WESTERVELT AVE', 400), st('ST MARKS PL', 660), st('BAY ST', 900, 44)],
    ew: [st('RICHMOND TER', 40, 40), st('HAMILTON AVE', 280), st('VICTORY BLVD', 520, 44), st('CEBRA AVE', 760)],
    look: (bx) => (bx > 680 ? 'tenement' : 'houses'),
    water: [{ x0: 1000, x1: 1700, y0: -400, y1: 1400 }],
    mark: { x: 1000, y: 80, w: 190, h: 160, kind: 'terminal' },
    ang: 10, wide: [640, 420, 0.82], tall: [620, 420, 0.64],
  },
  Astoria: {
    ns: [st('29TH ST', 120), st('30TH ST', 360), st('31ST ST', 600, 44), st('STEINWAY ST', 860, 40), st('33RD ST', 1100)],
    ew: [st('DITMARS BLVD', -60, 50), st('23RD AVE', 180), st('24TH AVE', 410), st('ASTORIA BLVD', 650, 52), st('30TH AVE', 900, 40)],
    look: (bx, by) => (by < 640 && bx > 300 && bx < 900 ? 'tenement' : 'houses'), el: { ns: '31ST ST' },
    ang: -20, wide: [600, 430, 0.82], tall: [600, 430, 0.64],
  },
};
const B = { x0: -100, x1: 1400, y0: -300, y1: 1200 };
// where Little Italy's own places have their doors on the drawing
const DOOR: Record<string, [number, number]> = { club: [582, 200], 'li:cafe': [681, 293], 'li:bar': [442, 345], 'li:barber': [770, 472], 'li:church': [400, 640] };

type Frame = { VW: number; VH: number; CX: number; CY: number; S0: number; ang: number; px: number };
const frameOf = (d: District, tall: boolean): Frame => { const [CX, CY, S0] = tall ? d.tall : d.wide; return tall ? { VW: 400, VH: 460, CX, CY, S0, ang: d.ang, px: 0.95 } : { VW: 760, VH: 500, CX, CY, S0, ang: d.ang, px: 1.15 }; };
const at = (F: Frame, x: number, y: number) => { const r = (F.ang * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [F.VW / 2 + F.S0 * (c * (x - F.CX) - s * (y - F.CY)), F.VH / 2 + F.S0 * (s * (x - F.CX) + c * (y - F.CY))]; };

// ------------------------------------------------------------------ the drawing
function blocks(d: District) {
  const xs = [{ at: B.x0, w: 0 }, ...d.ns, { at: B.x1, w: 0 }], ys = [{ at: B.y0, w: 0 }, ...[...d.ew].sort((a, b) => a.at - b.at), { at: B.y1, w: 0 }];
  const out: { bx: number; bX: number; by: number; bY: number; edge: { n: boolean; s: boolean; w: boolean; e: boolean } }[] = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const bx = xs[i].at + xs[i].w / 2, bX = xs[i + 1].at - xs[i + 1].w / 2, by = ys[j].at + ys[j].w / 2, bY = ys[j + 1].at - ys[j + 1].w / 2;
    if (bX - bx > 30 && bY - by > 30) out.push({ bx, bX, by, bY, edge: { w: i > 0, e: i < xs.length - 2, n: j > 0, s: j < ys.length - 2 } });
  }
  return out;
}
const inWater = (d: District, x: number, y: number) => (d.water ?? []).some((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);

function draw(name: string, night: boolean): string {
  const d = CITY[name], r = seeded(hash(name)), R = (a: number, b: number) => a + (b - a) * r(), pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const C = night
    ? { ground: '#15110e', walk: '#2c251f', yard: '#100d0a', roofs: ['#2b241e', '#2f2721', '#262019', '#332a23', '#29221c', '#3a2f26', '#231d18'], edge: '#18130f', tree: '#1b231a', line: '#3a3128', water: '#0d161d', bit: '#4a3c30', ware: ['#2a2a2c', '#302c2a', '#26282a'] }
    : { ground: '#2a2520', walk: '#4a4239', yard: '#2f2a22', roofs: ['#5a4d40', '#62523f', '#4f4438', '#6a5847', '#584a3c', '#735f4b', '#4a4036'], edge: '#2c251e', tree: '#3d4a33', line: '#5c5247', water: '#2c4656', bit: '#806a55', ware: ['#5a5a5e', '#625c58', '#54585c'] };
  const o: string[] = [`<rect x="${B.x0}" y="${B.y0}" width="${B.x1 - B.x0}" height="${B.y1 - B.y0}" fill="${C.ground}"/>`];
  const shadows: string[] = [], roofs: string[] = [], bits: string[] = [], yards: string[] = [];
  const box = (x: number, y: number, w: number, h: number, fill: string, sh: number) => {
    shadows.push(`<rect x="${f1(x + sh)}" y="${f1(y + sh)}" width="${f1(w)}" height="${f1(h)}" fill="#000" opacity="${night ? 0.45 : 0.3}"/>`);
    roofs.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${fill}" stroke="${C.edge}" stroke-width="1.2"/>`);
  };
  for (const k of blocks(d)) {
    if (inWater(d, (k.bx + k.bX) / 2, (k.by + k.bY) / 2)) continue;
    o.push(`<rect x="${k.bx}" y="${k.by}" width="${k.bX - k.bx}" height="${k.bY - k.by}" fill="${C.walk}"/>`);
    const x0 = k.bx + 7, x1 = k.bX - 7, y0 = k.by + 7, y1 = k.bY - 7, W_ = x1 - x0, H_ = y1 - y0;
    yards.push(`<rect x="${x0}" y="${y0}" width="${W_}" height="${H_}" fill="${C.yard}"/>`);
    const look = d.look(k.bx, k.by);
    if (look === 'warehouse') {
      // a few big sheds, and crates in the yards
      let x = x0; while (x < x1 - 20) { const w = Math.min(R(60, 120), x1 - x); box(x, y0 + R(0, 10), w - 6, H_ * R(0.55, 0.9), pick(C.ware), R(4, 8)); for (let t = 0; t < 3; t++) bits.push(`<rect x="${f1(x + R(4, Math.max(5, w - 14)))}" y="${f1(y0 + R(6, Math.max(7, H_ - 14)))}" width="8" height="5" fill="${night ? '#3a3026' : '#7a644e'}"/>`); x += w; }
      continue;
    }
    if (look === 'houses') {
      // rows of small houses with yards behind, and trees
      for (const side of ['N', 'S']) { let x = x0; while (x < x1 - 10) { const w = Math.min(R(16, 24), x1 - x), h = R(20, 28); box(x + 1, side === 'N' ? y0 + 2 : y1 - h - 2, w - 3, h, pick(C.roofs), R(2, 4)); x += w; } }
      for (let t = 0; t < 7; t++) yards.push(`<circle cx="${f1(R(x0 + 8, x1 - 8))}" cy="${f1(R(y0 + 34, Math.max(y0 + 35, y1 - 34)))}" r="${f1(R(5, 10))}" fill="${C.tree}"/>`);
      continue;
    }
    // tenements: lots all round the block, roofs with water tanks, chimneys and lit skylights
    const dW = W_ * R(0.36, 0.42), dE = W_ * R(0.36, 0.42), dN = H_ * R(0.16, 0.2), dS = H_ * R(0.16, 0.2);
    const lot = (x: number, y: number, w: number, h: number) => {
      box(x, y, w, h, pick(C.roofs), R(2, 7));
      const q = r();
      if (q < 0.14 && w > 16 && h > 16) { const cx = x + R(0.3, 0.7) * w, cy = y + R(0.3, 0.7) * h; bits.push(`<circle cx="${f1(cx + 3)}" cy="${f1(cy + 3)}" r="5.5" fill="#000" opacity=".45"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="5" fill="${night ? '#45382c' : '#7a644e'}" stroke="${night ? '#5e4c3b' : '#8f7760'}"/>`); }
      else if (q < 0.4) bits.push(`<rect x="${f1(x + R(0.15, 0.75) * w)}" y="${f1(y + R(0.15, 0.75) * h)}" width="3.5" height="3.5" fill="${C.bit}"/>`);
      else if (q < 0.47 && night) bits.push(`<rect x="${f1(x + w * 0.3)}" y="${f1(y + h * 0.35)}" width="${f1(Math.min(8, w * 0.35))}" height="${f1(Math.min(5, h * 0.3))}" fill="#e6b45e" opacity=".55"/>`);
    };
    for (const side of ['W', 'E']) { let y = y0; while (y < y1 - 4) { const h = Math.min(R(15, 30), y1 - y), dd = (side === 'W' ? dW : dE) * R(0.82, 1); lot(side === 'W' ? x0 : x1 - dd, y, dd, h); y += h; } }
    for (const side of ['N', 'S']) { let x = x0 + dW; const end = x1 - dE; while (x < end - 4) { const w = Math.min(R(15, 28), end - x), dd = (side === 'N' ? dN : dS) * R(0.8, 1); lot(x, side === 'N' ? y0 : y1 - dd, w, dd); x += w; } }
    for (let t = 0; t < 2; t++) if (r() < 0.6) yards.push(`<circle cx="${f1(x0 + dW + R(10, Math.max(11, W_ - dW - dE - 10)))}" cy="${f1(y0 + dN + R(10, Math.max(11, H_ - dN - dS - 10)))}" r="${f1(R(5, 9))}" fill="${C.tree}"/>`);
  }
  o.push(...yards, ...shadows, ...roofs, ...bits);
  // the streets: centre lines, crossings, parked cars
  for (const s of d.ns) o.push(`<line x1="${s.at}" y1="${B.y0}" x2="${s.at}" y2="${B.y1}" stroke="${C.line}" stroke-dasharray="14 12"/>`);
  for (const s of d.ew) o.push(`<line x1="${B.x0}" y1="${s.at}" x2="${B.x1}" y2="${s.at}" stroke="${C.line}" stroke-dasharray="14 12"/>`);
  for (const a of d.ns) for (const b of d.ew) for (const k of [-1, 1]) o.push(`<rect x="${a.at - a.w / 2}" y="${b.at + k * (b.w / 2 + 5) - 4}" width="${a.w}" height="8" fill="url(#sm-zebra)"/><rect x="${a.at + k * (a.w / 2 + 5) - 4}" y="${b.at - b.w / 2}" width="8" height="${b.w}" fill="url(#sm-zebraV)"/>`);
  const cars = ['#5b3b2f', '#3e4a52', '#6a5a3a', '#2f3a2f', '#5c5650', '#4b2a2a', '#7a6a4a', '#2e3442', '#8a7a60'];
  for (const s of d.ns) for (const k of [-1, 1]) { let y = B.y0; while (y < B.y1) { y += R(24, 70); if (d.ew.some((e) => Math.abs(y - e.at) < e.w / 2 + 18) || inWater(d, s.at, y)) continue; o.push(`<rect x="${f1(s.at + k * (s.w / 2 - 7) - 5)}" y="${f1(y - 11)}" width="10" height="22" rx="3" fill="${pick(cars)}"/>`); } }
  for (const s of d.ew) for (const k of [-1, 1]) { let x = B.x0; while (x < B.x1) { x += R(24, 70); if (d.ns.some((e) => Math.abs(x - e.at) < e.w / 2 + 18) || inWater(d, x, s.at)) continue; o.push(`<rect x="${f1(x - 11)}" y="${f1(s.at + k * (s.w / 2 - 7) - 5)}" width="22" height="10" rx="3" fill="${pick(cars)}"/>`); } }
  // water, and the piers along it
  for (const q of d.water ?? []) {
    o.push(`<rect x="${q.x0}" y="${q.y0}" width="${q.x1 - q.x0}" height="${q.y1 - q.y0}" fill="${C.water}"/>`);
    for (let y = q.y0 + 60; y < q.y1; y += R(110, 170)) o.push(`<rect x="${q.x0 - 2}" y="${f1(y)}" width="${f1(R(160, 240))}" height="${f1(R(26, 40))}" fill="${night ? '#3a3027' : '#6e5c48'}" stroke="${C.edge}"/>`);
    for (let t = 0; t < 40; t++) { const x = R(q.x0 + 20, q.x1), y = R(q.y0, q.y1); o.push(`<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + 14)}" y2="${f1(y)}" stroke="${night ? '#22323d' : '#4d6878'}" stroke-width="1.5"/>`); }
  }
  // an el over the street: the trestle and its ties
  const el = (x0: number, y0: number, x1: number, y1: number) => o.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${night ? '#1f1c1a' : '#3a3633'}" stroke-width="22"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${night ? '#4b443d' : '#7a7068'}" stroke-width="18" stroke-dasharray="2 5"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${night ? '#6a6058' : '#9a8f86'}" stroke-width="1.5"/>`);
  if (d.el?.ew) { const s = d.ew.find((x) => x.n === d.el!.ew)!; el(B.x0, s.at, B.x1, s.at); }
  if (d.el?.ns) { const s = d.ns.find((x) => x.n === d.el!.ns)!; el(s.at, B.y0, s.at, B.y1); }
  // the lamps, at night
  if (night) {
    for (const s of d.ns) { let k = 0; for (let y = B.y0; y < B.y1; y += 88) { k++; const x = s.at + (k % 2 ? -1 : 1) * (s.w / 2 + 3); if (!inWater(d, x, y)) o.push(`<circle cx="${x}" cy="${y}" r="48" fill="url(#sm-lamp)"/><circle cx="${x}" cy="${y}" r="2" fill="#ffe2a0"/>`); } }
    for (const s of d.ew) { let k = 0; for (let x = B.x0 + 44; x < B.x1; x += 88) { k++; const y = s.at + (k % 2 ? -1 : 1) * (s.w / 2 + 3); if (!inWater(d, x, y)) o.push(`<circle cx="${x}" cy="${y}" r="48" fill="url(#sm-lamp)"/><circle cx="${x}" cy="${y}" r="2" fill="#ffe2a0"/>`); } }
  }
  // the landmark: a church in its garden, a market hall, the ferry terminal
  const m = d.mark;
  if (m?.kind === 'church') o.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${night ? '#16201a' : '#34442f'}"/><path d="M${m.x + 24} ${m.y + 14} h44 v34 h34 v30 h-34 v26 h-44 v-26 h-14 v-30 h14 z" fill="${night ? '#3a3a40' : '#6a6a72'}" stroke="${night ? '#56565e' : '#85858e'}"/>`);
  if (m?.kind === 'market') o.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${night ? '#3b2f25' : '#7d6348'}" stroke="${C.edge}" stroke-width="2"/><path d="${Array.from({ length: 6 }, (_, i) => `M${m.x + 12 + i * 26} ${m.y + 8} v${m.h - 16}`).join(' ')}" stroke="${night ? '#4d3e31' : '#957a5c'}" stroke-width="3"/>`);
  if (m?.kind === 'terminal') o.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${night ? '#33302c' : '#706860'}" stroke="${C.edge}" stroke-width="2"/><rect x="${m.x + m.w}" y="${m.y + 40}" width="120" height="70" fill="${night ? '#2a2622' : '#5e5750'}"/><path d="M${m.x + 20} ${m.y + 20} h${m.w - 40} v${m.h - 40} h-${m.w - 40} z" fill="none" stroke="${night ? '#4a453f' : '#8a8178'}" stroke-width="3"/>`);
  // Little Italy's awnings, lit at night
  if (name === SLICE) {
    const front = (x: number, y: number, w: number, h: number, pat: string, glow?: string, gr = 0) => { if (glow && night) o.push(`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${gr}" fill="url(#${glow})"/>`); o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pat})"/>`); };
    front(578, 186, 7, 30, 'sm-awnRed', 'sm-club', 120); front(668, 290, 26, 7, 'sm-awnGreen', 'sm-shop', 80); front(430, 341, 24, 7, 'sm-awnGold', 'sm-shop', 70); front(767, 462, 7, 20, 'sm-awnGrey');
  }
  for (const s of d.ns) for (const yy of [60, 520, 980]) if (!inWater(d, s.at, yy)) o.push(`<text x="${s.at + 4}" y="${yy}" transform="rotate(-90 ${s.at + 4} ${yy})" text-anchor="middle" class="sm-st">${s.n}</text>`);
  for (const s of d.ew) for (const xx of [240, 700, 1160]) if (!inWater(d, xx, s.at)) o.push(`<text x="${xx}" y="${s.at + 4}" text-anchor="middle" class="sm-st">${s.n}</text>`);
  return o.join('');
}
const DEFS = `<defs><radialGradient id="sm-lamp"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".26"/><stop offset=".5" stop-color="#ffb84f" stop-opacity=".08"/><stop offset="1" stop-color="#ffb84f" stop-opacity="0"/></radialGradient><radialGradient id="sm-shop"><stop offset="0" stop-color="#ffbb55" stop-opacity=".5"/><stop offset="1" stop-color="#ffbb55" stop-opacity="0"/></radialGradient><radialGradient id="sm-club"><stop offset="0" stop-color="#ff7a4f" stop-opacity=".55"/><stop offset=".6" stop-color="#c2443a" stop-opacity=".16"/><stop offset="1" stop-color="#c2443a" stop-opacity="0"/></radialGradient><radialGradient id="sm-vig" cx="50%" cy="50%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient><pattern id="sm-zebra" width="6" height="8" patternUnits="userSpaceOnUse"><rect width="3" height="8" fill="#8a7e6c" opacity=".35"/></pattern><pattern id="sm-zebraV" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#8a7e6c" opacity=".35"/></pattern><pattern id="sm-awnRed" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#efe1c8"/><rect width="3" height="6" fill="#b3352b"/></pattern><pattern id="sm-awnGold" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f2e3c0"/><rect width="3" height="6" fill="#8a6a2a"/></pattern><pattern id="sm-awnGreen" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f2e3c0"/><rect width="3" height="6" fill="#2f6b4a"/></pattern><pattern id="sm-awnGrey" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#5a524a"/><rect width="3" height="6" fill="#3a332c"/></pattern></defs>`;

// ------------------------------------------------------------------ the signboards
// A business's trade, in a word, for the quieter line under its name
const TRADE: Record<string, string> = { restaurant: 'Restaurant', bar: 'Bar', bakery: 'Bakery', deli: 'Deli', laundromat: 'Laundromat', garage: 'Garage', butcher: 'Butcher', tailor: 'Tailor', pawnshop: 'Pawnshop', newsstand: 'Newsstand', florist: 'Florist', barber: 'Barber', grocer: 'Grocer', cafe: 'Café', shoes: 'Shoe repair', hardware: 'Hardware store', fish: 'Fish market', candy: 'Candy store', jeweller: 'Jeweller', photo: 'Photo studio', funeral: 'Funeral home', billiards: 'Pool hall', cleaner: 'Dry cleaner', pharmacy: 'Pharmacy', club: 'Social club', casino: 'Card room', diner: 'Diner' };
export const tradeOf = (kind: string) => TRADE[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
export interface Pin { id: string; name: string; line: string; tone: 'club' | 'yours' | 'mens' | 'fam' | 'other' | 'plain' | 'shut'; big: boolean; door?: [number, number] }
// Every place in a district you could walk into, with what you know of it: whose it is, whether it's open, how many you know inside.
export function pinsOf(w: World, p: Character, name: string): Pin[] {
  const out: Pin[] = [];
  const knownIn = (id: string) => whoIsAt(w, id).filter((c) => (c.rels[p.id]?.known ?? 0) > 0 || c.familyId === p.familyId).length;
  if (name === SLICE) for (const sp of spots(w).filter((x) => x.kind !== 'biz')) {
    if (sp.kind === 'track' || (sp.kind === 'club' && sp.famId !== p.familyId)) continue;
    const open = openAt(sp, w.now), n = open ? knownIn(sp.id) : 0;
    out.push({ id: sp.id, name: sp.name, line: open ? (n ? `${n} you know inside` : 'open') : 'shut', tone: !open ? 'shut' : sp.kind === 'club' ? 'club' : 'plain', big: true, door: DOOR[sp.kind === 'club' ? 'club' : sp.id] });
  }
  // the family clubs elsewhere in the city
  for (const cl of Object.values(w.clubs ?? {})) if (cl.district === name && name !== SLICE) out.push({ id: cl.familyId === p.familyId ? 'club' : `club:${cl.familyId}`, name: cl.name, line: cl.familyId === p.familyId ? 'your family’s club' : `the ${w.fam[cl.familyId]?.name ?? ''} club`, tone: cl.familyId === p.familyId ? 'club' : 'other', big: true });
  // every business in the district, coloured by whose it is as far as you know
  const held = (b: Business) => (knowsProtection(w, p, b) && b.protection && b.protection.collectorId !== b.ownerId ? b.protection : undefined);
  for (const b of Object.values(w.biz).filter((x) => x.district === name).sort((a, c) => a.name.localeCompare(c.name))) {
    const pr = held(b), coll = pr ? w.chars[pr.collectorId] : undefined;
    const sp = name === SLICE ? spots(w).find((x) => x.biz === b.id) : undefined, shut = sp ? !openAt(sp, w.now) : false;
    const tone: Pin['tone'] = !b.open ? 'shut' : pr?.collectorId === p.id ? 'yours' : coll?.bossId === p.id ? 'mens' : pr && pr.familyId === p.familyId ? 'fam' : pr ? 'other' : shut ? 'shut' : 'plain';
    const line = !b.open ? 'closed down' : pr?.collectorId === p.id ? 'pays you' : coll?.bossId === p.id ? `pays ${coll.name.split(' ')[0]}` : pr ? `${w.fam[pr.familyId]?.name ?? ''}` : shut ? 'shut' : '';
    out.push({ id: sp ? sp.id : `biz:${b.id}`, name: b.name, line: [tradeOf(b.kind), line].filter(Boolean).join(' · '), tone, big: false });
  }
  return out;
}

// Where each sign goes: Little Italy's places at their own doors; everything else at a free place along a street frontage, chosen
// the same way every time for the same business, and never on top of another sign.
function placeSigns(d: District, F: Frame, pins: Pin[]) {
  const cands: [number, number][] = [];
  for (const k of blocks(d)) for (const [ex, ey, nx, ny, ok] of [[k.bx, 0, 0, 1, k.edge.w], [k.bX, 0, 0, 1, k.edge.e], [0, k.by, 1, 0, k.edge.n], [0, k.bY, 1, 0, k.edge.s]] as [number, number, number, number, boolean][]) {
    if (!ok) continue;
    const len = nx ? k.bX - k.bx : k.bY - k.by;
    for (let t = 30; t < len - 30; t += 46) { const x = nx ? k.bx + t : ex, y = ny ? k.by + t : ey; if (!inWater(d, x, y)) cands.push([x, y]); }
  }
  const taken: number[][] = [];
  const boxOf = (x: number, y: number, pn: Pin, left: boolean) => { const w = (Math.max(pn.name.length, pn.line.length * 0.85) * (pn.big ? 8.4 : 6.8) + 34) / F.px, h = (pn.big ? 42 : pn.line ? 34 : 24) / F.px, top = y - 12 / F.px; return left ? [x - w, top, x + 9 / F.px, top + h] : [x - 9 / F.px, top, x + w, top + h]; };
  const free = (b: number[]) => b[0] > 4 && b[2] < F.VW - 4 && b[1] > 4 && b[3] < F.VH - 4 && taken.every((t) => b[2] + 3 < t[0] || b[0] - 3 > t[2] || b[3] + 3 < t[1] || b[1] - 3 > t[3]);
  const out: { pin: Pin; x: number; y: number; left: boolean }[] = [];
  for (const pn of [...pins].sort((a, b) => Number(!!b.door) - Number(!!a.door) || Number(b.big) - Number(a.big))) {
    const order = pn.door ? [pn.door] : [...cands].sort((a, b) => hash(pn.id + a[0] + ':' + a[1]) - hash(pn.id + b[0] + ':' + b[1]));
    for (const c of order) {
      const [x, y] = at(F, c[0], c[1]);
      const left = x / F.VW > 0.58, b = boxOf(x, y, pn, left);
      if (!pn.door && !free(b)) continue;
      taken.push(b); out.push({ pin: pn, x, y, left }); break;
    }
  }
  return out;
}

const drawn = new Map<string, string>();
export const narrow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 899px)').matches;
export function streetMap(name: string, sel?: string): string {
  const w = W(), p = P(), d = CITY[name] ?? CITY[SLICE];
  const hr = (w.now % DAY) / 60, night = hr >= 19 || hr < 6;
  const F = frameOf(d, narrow());
  const key = `${name}|${night}`;
  if (!drawn.has(key)) drawn.set(key, draw(CITY[name] ? name : SLICE, night));
  const signs = placeSigns(d, F, pinsOf(w, p, name)).map(({ pin, x, y, left }) => `<button class="sm-pin is-${pin.tone}${pin.big ? ' is-big' : ''}${left ? ' is-left' : ''}${sel === pin.id ? ' is-sel' : ''}" style="left:${f1((x / F.VW) * 100)}%;top:${f1((y / F.VH) * 100)}%" data-a="spot:${esc(pin.id)}"><i aria-hidden="true"></i><span><b>${esc(pin.name)}</b>${pin.line ? `<small>${esc(pin.line)}</small>` : ''}</span></button>`).join('');
  return `<div class="sm${night ? ' is-night' : ''}" style="aspect-ratio:${F.VW} / ${F.VH}"><svg viewBox="0 0 ${F.VW} ${F.VH}" role="img" aria-label="${esc(name)}, drawn">${DEFS}<g transform="translate(${F.VW / 2} ${F.VH / 2}) scale(${F.S0}) rotate(${F.ang}) translate(${-F.CX} ${-F.CY})">${drawn.get(key)}</g><rect width="${F.VW}" height="${F.VH}" fill="url(#sm-vig)"/></svg>${signs}</div>`;
}

// The district switch above the drawing: every district of the city, your family's first.
export function districtBar(cur: string): string {
  const p = P(), fam = p.familyId ? W().fam[p.familyId] : undefined;
  const order = [...DISTRICTS].sort((a, b) => Number(!!fam?.districts.includes(b)) - Number(!!fam?.districts.includes(a)));
  return `<nav class="sm-dists" aria-label="Districts">${order.map((x) => `<button class="${x === cur ? 'on' : ''}" data-a="sdist:${esc(x)}" aria-current="${x === cur ? 'page' : 'false'}">${esc(x)}</button>`).join('')}</nav>`;
}
