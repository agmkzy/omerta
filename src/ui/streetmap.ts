// The street, drawn (the redesign, owner 26 October): Little Italy as an illustrated, static neighbourhood to pick a place from.
// Not a live map: nobody walks on it and nothing is tracked. The real grid (Centre, Baxter, Mulberry, Mott, Elizabeth, the Bowery;
// Kenmare, Broome, Grand, Hester, Canal), tenement roofs, lamps and parked cars, drawn once from a fixed seed so the street looks the
// same every visit; then a signboard for each place, saying whether it is open and how many you know inside. Tapping one opens it.
import { DAY } from '../types';
import { openAt, spots, whoIsAt, type Spot } from '../city';
import { esc, P, W } from './links';

// (a small seeded generator of its own: the drawing is decoration, and must not touch the world's random stream)
function seeded(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (n: number) => Math.round(n * 10) / 10;

const NS = [{ n: 'CENTRE ST', x: 100, w: 40 }, { n: 'BAXTER ST', x: 330, w: 32 }, { n: 'MULBERRY ST', x: 560, w: 36 }, { n: 'MOTT ST', x: 790, w: 32 }, { n: 'ELIZABETH ST', x: 1010, w: 30 }, { n: 'THE BOWERY', x: 1240, w: 64 }];
const EW = [{ n: 'KENMARE ST', y: -160, w: 42 }, { n: 'BROOME ST', y: 80, w: 32 }, { n: 'GRAND ST', y: 320, w: 38 }, { n: 'HESTER ST', y: 560, w: 32 }, { n: 'CANAL ST', y: 820, w: 60 }];
const B = { x0: 0, x1: 1220, y0: -200, y1: 1000 };
// the view: centred on Mulberry and Grand, turned a little as the Manhattan grid is; wide on a desktop, closer and taller on a phone
const ANG = -12, rad = (ANG * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
type Frame = { VW: number; VH: number; CX: number; CY: number; S0: number };
const WIDE: Frame = { VW: 760, VH: 500, CX: 590, CY: 430, S0: 0.88 }, TALL: Frame = { VW: 400, VH: 460, CX: 585, CY: 425, S0: 0.7 };
const at = (F: Frame, x: number, y: number) => [F.VW / 2 + F.S0 * (cos * (x - F.CX) - sin * (y - F.CY)), F.VH / 2 + F.S0 * (sin * (x - F.CX) + cos * (y - F.CY))];
// where each place's door is on the drawing
const DOOR: Record<string, [number, number]> = { club: [582, 200], 'li:cafe': [681, 293], 'li:bar': [442, 345], 'li:barber': [770, 472], 'li:church': [400, 640] };

let drawn: { night: string; day: string } | undefined;
function draw(night: boolean): string {
  const r = seeded(1970), R = (a: number, b: number) => a + (b - a) * r(), pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const o: string[] = [`<rect x="${B.x0}" y="${B.y0}" width="${B.x1 - B.x0}" height="${B.y1 - B.y0}" fill="${night ? '#15110e' : '#2a2520'}"/>`];
  const xs = [{ x: B.x0, w: 0 }, ...NS, { x: B.x1, w: 0 }], ys = [{ y: B.y0, w: 0 }, ...EW, { y: B.y1, w: 0 }];
  const roofsN = ['#2b241e', '#2f2721', '#262019', '#332a23', '#29221c', '#3a2f26', '#231d18'], roofsD = ['#5a4d40', '#62523f', '#4f4438', '#6a5847', '#584a3c', '#735f4b', '#4a4036'];
  const shadows: string[] = [], roofs: string[] = [], bits: string[] = [], yards: string[] = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const bx = xs[i].x + xs[i].w / 2, bX = xs[i + 1].x - xs[i + 1].w / 2, by = ys[j].y + ys[j].w / 2, bY = ys[j + 1].y - ys[j + 1].w / 2;
    if (bX - bx < 20 || bY - by < 20) continue;
    o.push(`<rect x="${bx}" y="${by}" width="${bX - bx}" height="${bY - by}" fill="${night ? '#2c251f' : '#4a4239'}"/>`);
    const x0 = bx + 7, x1 = bX - 7, y0 = by + 7, y1 = bY - 7, W_ = x1 - x0, H_ = y1 - y0;
    yards.push(`<rect x="${x0}" y="${y0}" width="${W_}" height="${H_}" fill="${night ? '#100d0a' : '#2f2a22'}"/>`);
    const dW = W_ * R(0.36, 0.42), dE = W_ * R(0.36, 0.42), dN = H_ * R(0.16, 0.2), dS = H_ * R(0.16, 0.2);
    const lot = (x: number, y: number, w: number, h: number) => {
      const k = Math.floor(r() * roofsN.length), sh = R(2, 7);
      shadows.push(`<rect x="${f1(x + sh)}" y="${f1(y + sh)}" width="${f1(w)}" height="${f1(h)}" fill="#000" opacity="${night ? 0.45 : 0.3}"/>`);
      roofs.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${(night ? roofsN : roofsD)[k]}" stroke="${night ? '#18130f' : '#2c251e'}" stroke-width="1.2"/>`);
      const q = r();
      if (q < 0.14 && w > 16 && h > 16) { const cx = x + R(0.3, 0.7) * w, cy = y + R(0.3, 0.7) * h; bits.push(`<circle cx="${f1(cx + 3)}" cy="${f1(cy + 3)}" r="5.5" fill="#000" opacity=".45"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="5" fill="${night ? '#45382c' : '#7a644e'}" stroke="${night ? '#5e4c3b' : '#8f7760'}"/>`); }
      else if (q < 0.4) bits.push(`<rect x="${f1(x + R(0.15, 0.75) * w)}" y="${f1(y + R(0.15, 0.75) * h)}" width="3.5" height="3.5" fill="${night ? '#4a3c30' : '#806a55'}"/>`);
      else if (q < 0.47 && night) bits.push(`<rect x="${f1(x + w * 0.3)}" y="${f1(y + h * 0.35)}" width="${f1(Math.min(8, w * 0.35))}" height="${f1(Math.min(5, h * 0.3))}" fill="#e6b45e" opacity=".55"/>`);
    };
    for (const side of ['W', 'E']) { let y = y0; while (y < y1 - 4) { const h = Math.min(R(15, 30), y1 - y), d = (side === 'W' ? dW : dE) * R(0.82, 1); lot(side === 'W' ? x0 : x1 - d, y, d, h); y += h; } }
    for (const side of ['N', 'S']) { let x = x0 + dW; const end = x1 - dE; while (x < end - 4) { const w = Math.min(R(15, 28), end - x), d = (side === 'N' ? dN : dS) * R(0.8, 1); lot(x, side === 'N' ? y0 : y1 - d, w, d); x += w; } }
    for (let k = 0; k < 3; k++) if (r() < 0.6) yards.push(`<circle cx="${f1(x0 + dW + R(10, Math.max(11, W_ - dW - dE - 10)))}" cy="${f1(y0 + dN + R(10, Math.max(11, H_ - dN - dS - 10)))}" r="${f1(R(5, 9))}" fill="${night ? '#1b231a' : '#3d4a33'}"/>`);
  }
  o.push(...yards, ...shadows, ...roofs, ...bits);
  // the street itself: centre lines, crossings, parked cars, lamps
  for (const s of NS) o.push(`<line x1="${s.x}" y1="${B.y0}" x2="${s.x}" y2="${B.y1}" stroke="${night ? '#3a3128' : '#5c5247'}" stroke-dasharray="14 12"/>`);
  for (const s of EW) o.push(`<line x1="${B.x0}" y1="${s.y}" x2="${B.x1}" y2="${s.y}" stroke="${night ? '#3a3128' : '#5c5247'}" stroke-dasharray="14 12"/>`);
  for (const a of NS) for (const b of EW) for (const d of [-1, 1]) o.push(`<rect x="${a.x - a.w / 2}" y="${b.y + d * (b.w / 2 + 5) - 4}" width="${a.w}" height="8" fill="url(#sm-zebra)"/><rect x="${a.x + d * (a.w / 2 + 5) - 4}" y="${b.y - b.w / 2}" width="8" height="${b.w}" fill="url(#sm-zebraV)"/>`);
  const carC = ['#5b3b2f', '#3e4a52', '#6a5a3a', '#2f3a2f', '#5c5650', '#4b2a2a', '#7a6a4a', '#2e3442', '#8a7a60'];
  for (const s of NS) for (const side of [-1, 1]) { let y = B.y0; while (y < B.y1) { y += R(24, 70); if (EW.some((e) => Math.abs(y - e.y) < e.w / 2 + 18)) continue; o.push(`<rect x="${f1(s.x + side * (s.w / 2 - 7) - 5)}" y="${f1(y - 11)}" width="10" height="22" rx="3" fill="${pick(carC)}"/>`); } }
  for (const s of EW) for (const side of [-1, 1]) { let x = B.x0; while (x < B.x1) { x += R(24, 70); if (NS.some((e) => Math.abs(x - e.x) < e.w / 2 + 18)) continue; o.push(`<rect x="${f1(x - 11)}" y="${f1(s.y + side * (s.w / 2 - 7) - 5)}" width="22" height="10" rx="3" fill="${pick(carC)}"/>`); } }
  if (night) {
    for (const s of NS) { let k = 0; for (let y = B.y0; y < B.y1; y += 88) { k++; const x = s.x + (k % 2 ? -1 : 1) * (s.w / 2 + 3); o.push(`<circle cx="${x}" cy="${y}" r="48" fill="url(#sm-lamp)"/><circle cx="${x}" cy="${y}" r="2" fill="#ffe2a0"/>`); } }
    for (const s of EW) { let k = 0; for (let x = B.x0 + 44; x < B.x1; x += 88) { k++; const y = s.y + (k % 2 ? -1 : 1) * (s.w / 2 + 3); o.push(`<circle cx="${x}" cy="${y}" r="48" fill="url(#sm-lamp)"/><circle cx="${x}" cy="${y}" r="2" fill="#ffe2a0"/>`); } }
  }
  // Most Precious Blood in its garden on Baxter
  o.push(`<rect x="354" y="584" width="128" height="206" fill="${night ? '#16201a' : '#34442f'}"/><path d="M378 598 h44 v34 h34 v30 h-34 v26 h-44 v-26 h-14 v-30 h14 z" fill="${night ? '#3a3a40' : '#6a6a72'}" stroke="${night ? '#56565e' : '#85858e'}"/>`);
  // the awnings of the places on the drawing, and their light at night
  const front = (x: number, y: number, w: number, h: number, pat: string, glow?: string, gr = 0) => { if (glow && night) o.push(`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${gr}" fill="url(#${glow})"/>`); o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pat})"/>`); };
  front(578, 186, 7, 30, 'sm-awnRed', 'sm-club', 120); front(668, 290, 26, 7, 'sm-awnGreen', 'sm-shop', 80); front(430, 341, 24, 7, 'sm-awnGold', 'sm-shop', 70); front(767, 462, 7, 20, 'sm-awnGrey');
  for (const s of NS) for (const yy of [200, 690]) o.push(`<text x="${s.x + 4}" y="${yy}" transform="rotate(-90 ${s.x + 4} ${yy})" text-anchor="middle" class="sm-st">${s.n}</text>`);
  for (const s of EW) for (const xx of [215, 675, 1125]) o.push(`<text x="${xx}" y="${s.y + 4}" text-anchor="middle" class="sm-st">${s.n}</text>`);
  return o.join('');
}
const DEFS = `<defs><radialGradient id="sm-lamp"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".26"/><stop offset=".5" stop-color="#ffb84f" stop-opacity=".08"/><stop offset="1" stop-color="#ffb84f" stop-opacity="0"/></radialGradient><radialGradient id="sm-shop"><stop offset="0" stop-color="#ffbb55" stop-opacity=".5"/><stop offset="1" stop-color="#ffbb55" stop-opacity="0"/></radialGradient><radialGradient id="sm-club"><stop offset="0" stop-color="#ff7a4f" stop-opacity=".55"/><stop offset=".6" stop-color="#c2443a" stop-opacity=".16"/><stop offset="1" stop-color="#c2443a" stop-opacity="0"/></radialGradient><radialGradient id="sm-vig" cx="50%" cy="50%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient><pattern id="sm-zebra" width="6" height="8" patternUnits="userSpaceOnUse"><rect width="3" height="8" fill="#8a7e6c" opacity=".35"/></pattern><pattern id="sm-zebraV" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#8a7e6c" opacity=".35"/></pattern><pattern id="sm-awnRed" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#efe1c8"/><rect width="3" height="6" fill="#b3352b"/></pattern><pattern id="sm-awnGold" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f2e3c0"/><rect width="3" height="6" fill="#8a6a2a"/></pattern><pattern id="sm-awnGreen" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f2e3c0"/><rect width="3" height="6" fill="#2f6b4a"/></pattern><pattern id="sm-awnGrey" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#5a524a"/><rect width="3" height="6" fill="#3a332c"/></pattern></defs>`;

// The drawing with its signboards: one for each place, saying whether it is open and how many you know inside.
export function streetMap(): string {
  const w = W(), p = P();
  const h = (w.now % DAY) / 60, night = h >= 19 || h < 6;
  const F = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 899px)').matches ? TALL : WIDE, { VW, VH } = F;
  drawn ??= { night: draw(true), day: draw(false) };
  const all = spots(w).filter((x) => x.kind !== 'biz');
  const pin = (sp: Spot) => {
    const door = DOOR[sp.kind === 'club' ? 'club' : sp.id];
    if (!door) return '';
    const [x, y] = at(F, door[0], door[1]);
    const open = openAt(sp, w.now), mine = sp.kind === 'club' && sp.famId === p.familyId;
    const n = open ? whoIsAt(w, sp.id).filter((c) => (c.rels[p.id]?.known ?? 0) > 0 || c.familyId === p.familyId).length : 0;
    const line = open ? (n ? `${n} you know inside` : 'open') : 'shut';
    return `<button class="sm-pin${mine ? ' is-club' : ''}${open ? '' : ' is-shut'}${x / VW > 0.58 ? ' is-left' : ''}" style="left:${f1((x / VW) * 100)}%;top:${f1((y / VH) * 100)}%" data-a="place:${esc(sp.id)}"><i aria-hidden="true"></i><span><b>${esc(sp.name)}</b><small>${esc(line)}</small></span></button>`;
  };
  return `<div class="sm${night ? ' is-night' : ''}" style="aspect-ratio:${VW} / ${VH}"><svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Little Italy: Baxter, Mulberry and Mott, crossed by Broome, Grand and Hester">${DEFS}<g transform="translate(${VW / 2} ${VH / 2}) scale(${F.S0}) rotate(${ANG}) translate(${-F.CX} ${-F.CY})">${night ? drawn.night : drawn.day}</g><rect width="${VW}" height="${VH}" fill="url(#sm-vig)"/></svg>${all.map(pin).join('')}</div>`;
}
