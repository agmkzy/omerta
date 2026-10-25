// Facial hair, fitted to the jaw, the chin, the mouth and the base of the nose of this particular face. Shapes that follow the
// cheek are clipped to the head outline, so a beard never hangs off the side of the face.
import type { Face } from './face';
import { dk, GREY, mix, s } from './util';

export function beardOf(F: Face, u: string): string {
  if (!F.beard) return '';
  const { cx, hw, jawW, jawY, chinW, chin, my, mw, nb } = F;
  const fh = F.grey === 2 ? mix(F.hairC, GREY, 0.3) : F.grey === 1 ? mix(F.hairC, GREY, 0.25) : F.hairC;
  const fhSh = dk(fh, 0.35);
  const hc = `clip-path="url(#${u}h)"`;
  const earTop = F.earY - F.earRy, cheekY = (F.eyeY + nb) / 2 + 0.6;
  // the moustache: from the base of the nose to the top lip, wider than the mouth
  const mous = (thick = 0, wide = 0) => {
    const mt = nb + 1.5 - thick, w = mw + wide, yb = my + 0.1 + thick * 0.4;
    return s`<path d="M${cx - w - 0.3} ${yb}Q${cx - w} ${mt + 0.2} ${cx - 0.9} ${mt}Q${cx} ${mt + 0.3} ${cx + 0.9} ${mt}Q${cx + w} ${mt + 0.2} ${cx + w + 0.3} ${yb}Q${cx + w * 0.5} ${my - 0.6 + thick * 0.3} ${cx} ${my - 0.5 + thick * 0.3}Q${cx - w * 0.5} ${my - 0.6 + thick * 0.3} ${cx - w - 0.3} ${yb}Z" fill="${fh}"/><path d="M${cx + 0.4} ${mt + 0.1}Q${cx + w} ${mt + 0.2} ${cx + w + 0.3} ${yb}Q${cx + w * 0.5} ${my - 0.6 + thick * 0.3} ${cx + 0.4} ${my - 0.5 + thick * 0.3}Z" fill="${fhSh}"/>`;
  };
  // the whole lower face below the cheekbones, up the sides to the ears; the mouth and nose left clear
  const muzzle = s`M${cx - hw + 0.4} ${cheekY}C${cx - hw + 0.2} 35 ${cx - jawW - 0.4} ${jawY - 0.8} ${cx - jawW} ${jawY + 0.2}Q${cx - chinW - 1.6} ${chin + 0.2} ${cx} ${chin + 0.4}Q${cx + chinW + 1.6} ${chin + 0.2} ${cx + jawW} ${jawY + 0.2}C${cx + jawW + 0.4} ${jawY - 0.8} ${cx + hw - 0.2} 35 ${cx + hw - 0.4} ${cheekY}L${cx + hw - 2.2} ${cheekY + 1.1}Q${cx + 3.6} ${nb + 0.3} ${cx} ${nb + 0.6}Q${cx - 3.6} ${nb + 0.3} ${cx - hw + 2.2} ${cheekY + 1.1}Z`;
  const goatee = (w: number, drop: number) => s`<path d="M${cx - mw * w} ${my + 1.5}Q${cx - chinW * w - 0.4} ${chin - 1} ${cx - chinW * 0.5 * w} ${chin + 0.4 + drop * 0.5}Q${cx} ${chin + 1.1 + drop} ${cx + chinW * 0.5 * w} ${chin + 0.4 + drop * 0.5}Q${cx + chinW * w + 0.4} ${chin - 1} ${cx + mw * w} ${my + 1.5}Q${cx} ${my + 2.4} ${cx - mw * w} ${my + 1.5}Z" fill="${fh}"/><path d="M${cx + 0.3} ${my + 2.3}Q${cx + mw * w} ${my + 2} ${cx + mw * w} ${my + 1.5}Q${cx + chinW * w + 0.4} ${chin - 1} ${cx + chinW * 0.5 * w} ${chin + 0.4 + drop * 0.5}Q${cx + 0.3} ${chin + 1 + drop} ${cx + 0.3} ${chin + 1 + drop}Z" fill="${fhSh}" opacity=".7"/>`;
  const burns = (yb: number, ww: number, chops: boolean) => {
    let b = '';
    for (const sx of [-1, 1]) b += s`<path d="M${cx + sx * (hw + 0.3)} ${earTop}L${cx + sx * (hw - 1.5)} ${earTop + 0.2}Q${cx + sx * (hw - ww)} ${yb - 3} ${cx + sx * (hw - ww - (chops ? 1.6 : 0))} ${yb}Q${cx + sx * (hw - 0.6)} ${yb - 1} ${cx + sx * (hw + 0.3)} ${cheekY}Z" fill="${sx < 0 ? fh : fhSh}" ${hc}/>`;
    return b;
  };
  // a full beard: the jaw and chin to the ears, the mouth left clear; `ext` is how far it hangs below the chin
  const full = (ext: number, o: number) => {
    const k = ext / 2.2, sd = 0.2 * k;
    return s`<g opacity="${o}"><path d="M${cx - hw - sd} ${earTop + 2.6}C${cx - hw - sd} 34 ${cx - jawW - 1 * k} ${jawY - 0.2} ${cx - jawW + 0.2} ${jawY + 1.2 * k}Q${cx - chinW - 1} ${chin + ext} ${cx} ${chin + ext}Q${cx + chinW + 1} ${chin + ext} ${cx + jawW - 0.2} ${jawY + 1.2 * k}C${cx + jawW + 1 * k} ${jawY - 0.2} ${cx + hw + sd} 34 ${cx + hw + sd} ${earTop + 2.6}L${cx + hw - 1.4} ${earTop + 3.2}Q${cx + hw - 2.2} ${cheekY + 1.5} ${cx + mw + 0.8} ${my + 0.6}Q${cx} ${my + 2.6} ${cx - mw - 0.8} ${my + 0.6}Q${cx - hw + 2.2} ${cheekY + 1.5} ${cx - hw + 1.4} ${earTop + 3.2}Z" fill="${fh}"/><path d="M${cx + 1.6} ${chin + ext - 0.1}Q${cx + jawW} ${chin} ${cx + jawW - 0.2} ${jawY + 1.2 * k}C${cx + jawW + 1 * k} ${jawY - 0.2} ${cx + hw + sd} 34 ${cx + hw + sd} ${earTop + 2.6}L${cx + hw - 1.4} ${earTop + 3.2}Q${cx + hw - 2.2} ${cheekY + 1.5} ${cx + mw + 0.8} ${my + 0.6}Z" fill="${fhSh}"/></g>`;
  };
  switch (F.beard) {
    case 1: return mous();
    case 2: return `<path d="${muzzle}" fill="${fh}" opacity=".22" ${hc}/>`;
    case 3: return goatee(0.6, 0) + mous();
    case 4: return burns(cheekY + 1.2, 1.4, false);
    case 5: return burns(jawY, 3.4, true) + mous();
    case 6: return full(2.2, 1) + mous();
    case 7: { // a pencil moustache, a thin line with the philtrum shaved clear
      const y = my - 0.95;
      return s`<path d="M${cx - 0.5} ${y - 0.15}Q${cx - mw * 0.6} ${y - 0.45} ${cx - mw + 0.1} ${y + 0.35}M${cx + 0.5} ${y - 0.15}Q${cx + mw * 0.6} ${y - 0.45} ${cx + mw - 0.1} ${y + 0.35}" stroke="${fh}" stroke-width=".75" fill="none" stroke-linecap="round"/>`;
    }
    case 8: return mous(0.5, 0.8); // the chevron: thick, wide, over the lip
    case 9: { // the horseshoe: a moustache with bars down past the corners of the mouth to the jaw
      const bars = s`<path d="M${cx - mw - 1.1} ${my - 0.2}L${cx - mw - 1.2} ${chin - 0.4}H${cx - mw + 0.1}L${cx - mw + 0.2} ${my + 0.4}ZM${cx + mw + 1.1} ${my - 0.2}L${cx + mw + 1.2} ${chin - 0.4}H${cx + mw - 0.1}L${cx + mw - 0.2} ${my + 0.4}Z" fill="${fh}" ${hc}/>`;
      return bars + mous(0.3, 0.6);
    }
    case 10: return goatee(0.45, 1.6) + mous(0, -0.3); // a Van Dyke: a pointed chin beard and a separate moustache
    case 11: return full(0.7, 0.92) + mous(0.2, 0.2); // a short, close-trimmed beard
  }
  return '';
}
