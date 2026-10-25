// Hats. Each one is fitted to this head: the band sits at a fixed height above the brows, the crown is as wide as the skull at
// that height plus the hair under it, and the brim follows the crown. Each hat also returns the region the hair may still show
// in (below the brim), which the hair layer is clipped to, so a pompadour or an Afro never pushes through a crown.
import type { Face } from './face';
import type { Hair } from './hair';
import { clamp, dk, lt, LW, pick, s, type Stream } from './util';

export type HatKind = 'fedora' | 'trilby' | 'homburg' | 'cap' | 'watch' | 'scarf';
export const HAT_BY_INDEX: (HatKind | '')[] = ['', 'fedora', 'trilby', 'cap', 'homburg', 'watch'];
export interface Hat { svg: string; clip: string; top: number; band: number; crown: number } // band: the y of the band at the front; crown: half its width there

export function hatOf(kind: HatKind, F: Face, H: Hair, d: Stream, u: string): Hat {
  const { cx, hw, top } = F;
  const hc = `clip-path="url(#${u}h)"`;
  if (kind === 'scarf') {
    // a headscarf, knotted under the chin; the hair shows only inside it
    const col = pick(d(63), ['#6b2a33', '#5f6236', '#2f5d5c', '#8a6a3a', '#4b4a5e']);
    let h = s`<path d="M${cx - hw - 1.6} 34C${cx - hw - 3} ${top} ${cx - 4} ${top - 2.6} ${cx} ${top - 2.6}C${cx + 4} ${top - 2.6} ${cx + hw + 3} ${top} ${cx + hw + 1.6} 34L${cx + hw - 0.4} 33C${cx + hw} ${top + 6} ${cx + 3} ${top + 4} ${cx} ${top + 4.2}C${cx - 3} ${top + 4} ${cx - hw} ${top + 6} ${cx - hw + 0.4} 33Z" fill="${col}"/>`;
    h += s`<path d="M${cx + 1} ${top - 2.6}C${cx + 4} ${top - 2.6} ${cx + hw + 3} ${top} ${cx + hw + 1.6} 34L${cx + hw - 0.4} 33C${cx + hw} ${top + 6} ${cx + 3} ${top + 4} ${cx + 1} ${top + 4.2}Z" fill="#000" opacity=".3"/>`;
    h += s`<path d="M${cx - 5} ${top + 1}Q${cx} ${top - 0.4} ${cx + 5} ${top + 1}M${cx - 7} ${top + 4}Q${cx} ${top + 2} ${cx + 7} ${top + 4}" stroke="${lt(col, 0.4)}" stroke-width="${LW.line}" fill="none" opacity=".45" stroke-dasharray="1 1"/>`;
    h += s`<path d="M${cx - 1.6} ${F.chin + 0.6}l1.6 1.4l1.6 -1.4l-1.6 -1z" fill="${dk(col, 0.2)}"/>`;
    const clip = s`M0 64V34.5H${cx - hw - 1.6}L${cx - hw + 0.4} 33C${cx - hw} ${top + 6} ${cx - 3} ${top + 4} ${cx} ${top + 4.2}C${cx + 3} ${top + 4} ${cx + hw} ${top + 6} ${cx + hw - 0.4} 33L${cx + hw + 1.6} 34.5H64V64Z`;
    return { svg: h, clip, top: top - 2.6, band: top + 4.2, crown: hw + 1.6 };
  }
  // where the band sits: above the brows, never over the eyes
  // (a fixed distance above the brows, so it sits as low on a long face as on a round one)
  const seat = { fedora: 2.5, trilby: 2.6, homburg: 2.6, cap: 2.3, watch: 2.2 }[kind];
  const by = Math.max(top + 5.4, F.browY - seat);
  // the crown takes the skull at that height and the hair under it, within reason
  const cb = Math.min(F.halfAt(by) + clamp(H.side * 0.85, 0.5, 3) + 0.35, hw + 3.4);
  const lift = clamp(H.vol - 2, 0, 3) * 0.35; // big hair raises the crown a little; the rest is squashed under it
  // the brim's shadow over his brow, down to the eyes and no further
  const shadow = (o: number, drop: number) => s`<path d="M0 0H64V${by + 1.4}Q${cx} ${Math.min(by + drop, F.eyeY - 0.3)} 0 ${by + 1.4}Z" fill="#0a0707" opacity="${o}" ${hc}/>`;

  if (kind === 'cap') {
    // a flat cap: a soft slab sloping forward over a short peak
    const col = pick(d(62), ['#4a4238', '#3d3a35', '#5a4e3e', '#35383a', '#4e3f33', '#5c5446']);
    const yt = Math.min(by - 6.6, top - 1.4) - lift, w = cb + 1.5;
    let h = shadow(0.35, 3.8);
    h += s`<path d="M${cx - cb + 0.6} ${by}Q${cx} ${by + 3.4} ${cx + cb - 0.6} ${by}Z" fill="${dk(col, 0.5)}"/>`;
    h += s`<path d="M${cx - w} ${by - 0.4}C${cx - w - 1} ${by - 4.6} ${cx - hw + 1} ${yt + 0.4} ${cx} ${yt}C${cx + hw - 1} ${yt + 0.4} ${cx + w + 1} ${by - 4.6} ${cx + w} ${by - 0.4}Q${cx} ${by + 1.6} ${cx - w} ${by - 0.4}Z" fill="${col}"/>`;
    h += s`<path d="M${cx + 1.6} ${yt}C${cx + hw - 1} ${yt + 0.4} ${cx + w + 1} ${by - 4.6} ${cx + w} ${by - 0.4}Q${cx + 5} ${by + 1} ${cx + 3} ${by + 1}Z" fill="#000" opacity=".28"/>`;
    h += s`<path d="M${cx - w + 0.2} ${by - 0.6}Q${cx} ${by + 1.2} ${cx + w - 0.2} ${by - 0.6}" stroke="${dk(col, 0.45)}" stroke-width="${LW.line}" fill="none"/>`;
    // the seam where the top is sewn to the peak, and a little tweed
    h += s`<path d="M${cx - w + 1.2} ${by - 1.6}Q${cx} ${by - 0.2} ${cx + w - 1.2} ${by - 1.6}" stroke="${dk(col, 0.3)}" stroke-width="${LW.fine}" fill="none" opacity=".7"/>`;
    h += s`<path d="M${cx - 6} ${by - 2.2}l2.4 -1.6M${cx - 3} ${by - 3.4}l2.4 -1.6M${cx - 8} ${by - 4}l2.4 -1.6M${cx + 1} ${by - 2}l2.4 -1.6" stroke="${lt(col, 0.35)}" stroke-width="${LW.fine}" opacity=".5"/>`;
    const clip = s`M0 ${by - 0.4}H${cx - w}Q${cx} ${by + 2.4} ${cx + w} ${by - 0.4}H64V64H0Z`;
    return { svg: h, clip, top: yt, band: by, crown: w };
  }
  if (kind === 'watch') {
    // a knitted watch cap with the cuff rolled up: the docks, the fish market, a cold night on a stakeout
    const col = pick(d(64), ['#1f2433', '#2e2e32', '#4a2226', '#3a3a2c', '#5a5a5e']);
    const w = cb + 0.5, yt = top - 2.2 - lift;
    let h = s`<path d="M${cx - w} ${by - 1}C${cx - w - 0.4} ${by - 6.4} ${cx - w * 0.6} ${yt} ${cx} ${yt}C${cx + w * 0.6} ${yt} ${cx + w + 0.4} ${by - 6.4} ${cx + w} ${by - 1}Z" fill="${col}"/>`;
    h += s`<path d="M${cx + 1.4} ${yt}C${cx + w * 0.6} ${yt} ${cx + w + 0.4} ${by - 6.4} ${cx + w} ${by - 1}H${cx + 2.6}Z" fill="#000" opacity=".3"/>`;
    let rib = ''; for (let x = -w + 1; x < w - 0.4; x += 1.2) rib += s`M${cx + x} ${by - 2.8 + Math.abs(x) * 0.04}v3.1`;
    h += s`<path d="M${cx - w - 0.3} ${by - 3.1}Q${cx} ${by - 4.3} ${cx + w + 0.3} ${by - 3.1}L${cx + w + 0.2} ${by + 0.4}Q${cx} ${by + 1.2} ${cx - w - 0.2} ${by + 0.4}Z" fill="${dk(col, 0.12)}"/>`;
    h += `<path d="${rib}" stroke="${dk(col, 0.45)}" stroke-width="${LW.fine}" opacity=".8"/>`;
    h += s`<path d="M${cx + 1.4} ${by - 3.8}Q${cx + w} ${by - 3.6} ${cx + w + 0.2} ${by - 3}L${cx + w + 0.2} ${by + 0.4}Q${cx + 3} ${by + 1} ${cx + 1.4} ${by + 1}Z" fill="#000" opacity=".25"/>`;
    const clip = s`M0 ${by + 0.4}H${cx - w - 0.2}Q${cx} ${by + 1.2} ${cx + w + 0.2} ${by + 0.4}H64V64H0Z`;
    return { svg: h, clip, top: yt, band: by, crown: w };
  }
  // felt hats: a crown, a band, a brim
  const felt = kind === 'homburg' ? ['#1a191c', '#26252a', '#2e2a26', '#3b3c3d'] : kind === 'trilby' ? ['#5a5650', '#4a4438', '#6a6052', '#3b3c3d', '#2e2a26'] : ['#26242a', '#2e2a26', '#3a332b', '#3b3c3d', '#1c1b1e', '#4a4038', '#5a5046'];
  const col = pick(d(60), felt);
  const band = pick(d(61), kind === 'homburg' ? ['#0e0c0d', '#121014'] : ['#120f10', '#3b1a1f', '#1a1f2a', '#120f10', '#2a2018']);
  const ch = (kind === 'trilby' ? 7.2 : kind === 'homburg' ? 9 : 8.6) + lift;
  // the crown always clears the top of the skull, and is wide enough at its shoulders to cover it
  const yt = Math.min(by - ch, top - 1.3 - lift);
  const ct = Math.min(cb - 0.6, Math.max(cb - (kind === 'trilby' ? 2.2 : kind === 'homburg' ? 1.2 : 1.6), F.halfAt(yt + 1.8) + 0.5));
  const bw = cb + (kind === 'trilby' ? 3 : kind === 'homburg' ? 4.2 : 5.4);
  const snap = kind === 'trilby' ? 2.3 : kind === 'homburg' ? 1.7 : 2.9; // how far the front of the brim drops
  let h = shadow(0.4, 4.4);
  // the back of the brim, seen over the shoulders of the crown
  h += s`<path d="M${cx - bw} ${by - 0.2}Q${cx} ${by - 3.2} ${cx + bw} ${by - 0.2}Q${cx} ${by + 0.8} ${cx - bw} ${by - 0.2}Z" fill="${dk(col, 0.25)}"/>`;
  if (kind === 'homburg') h += s`<path d="M${cx - bw} ${by - 0.2}Q${cx} ${by - 3.2} ${cx + bw} ${by - 0.2}" stroke="${lt(col, 0.25)}" stroke-width="${LW.mid}" fill="none" opacity=".6"/>`;
  // the crown: a pinched front for the fedora and the trilby, one long crease down the top of the homburg
  const dent = kind === 'homburg' ? 0.7 : 1.3;
  h += s`<path d="M${cx - cb} ${by}L${cx - ct} ${yt + 1.4}Q${cx - ct + 0.3} ${yt} ${cx - ct * 0.45} ${yt + 0.1}Q${cx} ${yt + dent} ${cx + ct * 0.45} ${yt + 0.1}Q${cx + ct - 0.3} ${yt} ${cx + ct} ${yt + 1.4}L${cx + cb} ${by}Q${cx} ${by + 1.2} ${cx - cb} ${by}Z" fill="${col}"/>`;
  h += s`<path d="M${cx + 1} ${yt + dent * 0.6}Q${cx + ct * 0.45} ${yt + 0.1} ${cx + ct * 0.45} ${yt + 0.1}Q${cx + ct - 0.3} ${yt} ${cx + ct} ${yt + 1.4}L${cx + cb} ${by}Q${cx + 4} ${by + 1.1} ${cx + 1.8} ${by + 1}Z" fill="#000" opacity=".3"/>`;
  if (kind === 'homburg') h += s`<path d="M${cx} ${yt + dent}Q${cx - 0.3} ${yt + 2.6} ${cx - 0.1} ${by - 2.8}" stroke="${dk(col, 0.6)}" stroke-width="${LW.line}" fill="none"/>`;
  else h += s`<path d="M${cx - ct * 0.3} ${yt + 0.9}Q${cx - ct * 0.5} ${yt + 2.6} ${cx - ct * 0.3} ${yt + 3.6}Q${cx - ct * 0.15} ${yt + 2.2} ${cx - ct * 0.3} ${yt + 0.9}ZM${cx + ct * 0.3} ${yt + 0.9}Q${cx + ct * 0.5} ${yt + 2.6} ${cx + ct * 0.3} ${yt + 3.6}Q${cx + ct * 0.15} ${yt + 2.2} ${cx + ct * 0.3} ${yt + 0.9}Z" fill="${dk(col, 0.55)}" opacity=".7"/>`;
  // a lit edge down the left of the crown
  h += s`<path d="M${cx - ct + 0.5} ${yt + 1.6}L${cx - cb + 0.6} ${by - 2.6}" stroke="${lt(col, 0.35)}" stroke-width="${LW.mid}" fill="none" opacity=".55"/>`;
  // the band
  const bh = kind === 'homburg' ? 2.6 : kind === 'trilby' ? 1.6 : 2.2;
  h += s`<path d="M${cx - cb + 0.08} ${by - 0.1}L${cx - cb + 0.08 + bh * 0.12} ${by - bh}Q${cx} ${by - bh + 1.1} ${cx + cb - 0.08 - bh * 0.12} ${by - bh}L${cx + cb - 0.08} ${by - 0.1}Q${cx} ${by + 1.1} ${cx - cb + 0.08} ${by - 0.1}Z" fill="${band}"/>`;
  if (kind !== 'homburg') h += s`<path d="M${cx - cb + 1.4} ${by - bh * 0.5}l-1 .9" stroke="${lt(band, 0.3)}" stroke-width="${LW.mid}" opacity=".6"/>`; // the bow
  // the front of the brim, snapped down
  const lower = s`C${cx - bw * 0.6} ${by + snap * 0.55} ${cx - cb * 0.6} ${by + snap} ${cx} ${by + snap}C${cx + cb * 0.6} ${by + snap} ${cx + bw * 0.6} ${by + snap * 0.55} ${cx + bw} ${by - 0.2}`;
  h += s`<path d="M${cx - bw} ${by - 0.2}${lower}Q${cx} ${by + 1.4} ${cx - bw} ${by - 0.2}Z" fill="${dk(col, 0.22)}"/>`;
  h += s`<path d="M${cx + 2} ${by + 1.2}Q${cx + bw * 0.6} ${by + 1.2} ${cx + bw} ${by - 0.2}C${cx + bw * 0.6} ${by + snap * 0.55} ${cx + cb * 0.6} ${by + snap} ${cx + 2} ${by + snap}Z" fill="#000" opacity=".25"/>`;
  h += s`<path d="M${cx - bw} ${by - 0.2}` + lower + `" stroke="${kind === 'homburg' ? lt(col, 0.3) : dk(col, 0.5)}" stroke-width="${kind === 'homburg' ? LW.line : LW.mid}" fill="none"/>`;
  const clip = s`M0 ${by - 0.2}H${cx - bw}` + lower + s`H64V64H0Z`;
  return { svg: h, clip, top: yt - 0.3, band: by, crown: cb };
}
