// Plumbing shared by every layer of the painted portrait: seeded streams, number formatting and colour.
// Nothing here reads the clock or Math.random: the same seed always paints the same man.

export const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// A seeded stream: r(i) is a fixed number in [0, 1) for each channel i. Channels never shift, so adding a new feature on a new
// channel leaves every older feature exactly as it was.
export type Stream = (i: number) => number;
export const mk = (id: string): Stream => { const s = hashOf(id); return (i: number) => { let x = (s + Math.imul(i + 1, 0x9e3779b9)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }; };
export const pick = <T,>(r: number, a: T[]) => a[Math.min(a.length - 1, Math.floor(r * a.length))];
export const wpick = (r: number, ws: number[]) => { let x = r * ws.reduce((a, b) => a + b, 0); for (let k = 0; k < ws.length; k++) { x -= ws[k]; if (x < 0) return k; } return ws.length - 1; };
export const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
export const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]!);
// A chosen option, clamped into range; undefined when absent or not a number (an old save, or a hand-edited one).
export const opt = (v: unknown, n: number): number | undefined => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(n - 1, Math.round(v))) : undefined;
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// Numbers in path data, rounded to a tenth: small strings and no "NaN" surprises.
export const fm = (x: number) => { if (!isFinite(x)) x = 0; const r = Math.round(x * 10) / 10; return r === 0 ? '0' : String(r).replace(/^(-?)0\./, '$1.'); };
export const s = (strs: TemplateStringsArray, ...v: (number | string)[]) => { let o = strs[0]; for (let i = 0; i < v.length; i++) o += (typeof v[i] === 'number' ? fm(v[i] as number) : v[i]) + strs[i + 1]; return o; };

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
export const lum = (c: string) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export const SHADE = '#2a1a1e'; // shadows lean to oxblood, not grey
export const dk = (c: string, t = 0.4) => mix(c, SHADE, t);
export const lt = (c: string, t = 0.25) => mix(c, '#f6e7cc', t);
export const BRASS = '#d6b981';
export const GOLD = '#c9a24a';
export const INK = '#1a1213';
export const GREY = '#9a9790';

// One line weight scale for every layer, so a frame, a crease and a seam read as drawn by the same hand.
export const LW = { hair: 0.3, fine: 0.35, mid: 0.45, line: 0.55, bold: 0.8 };

// A point on a cubic Bézier, for fitting one part to the curve of another.
export const bez = (t: number, a: number, b: number, c: number, d: number) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
