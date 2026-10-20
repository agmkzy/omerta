import { AMBS, ambProgress, AmbKind } from '../ambition';
import { esc, P, W } from './links';

export function ambitionCard(): string {
  const w = W(), p = P();
  const a = p.ambition;
  const pick = `<div class="list">${AMBS.map((d) => `<button class="opt" data-a="amb:${d.kind}"><b>${esc(d.label)}</b><span class="because">${esc(d.blurb)}</span></button>`).join('')}</div>`;
  if (!a) return `<div class="card"><h2>What are you after?<small>pick one</small></h2><p class="muted">Choose a goal and the game will point you at the people and chances that serve it.</p>${pick}</div>`;
  const d = AMBS.find((x) => x.kind === a.kind)!;
  const pr = ambProgress(w, p, a.kind as AmbKind);
  if (a.done) return `<div class="card"><h2>Ambition<small>done</small></h2><p><b>${esc(d.label)}.</b> You did it.</p><details><summary class="muted">Choose the next one</summary>${pick}</details></div>`;
  return `<div class="card"><h2>Your ambition<small>${esc(pr.note)}</small></h2><p><b>${esc(d.label)}</b></p><div class="track" style="margin:6px 0 10px"><i style="width:${Math.round(Math.min(1, pr.frac) * 100)}%"></i></div><button class="need" data-a="${pr.next.a}"><span class="dot green"></span><span><span class="t">Next</span><span class="s" style="display:block">${esc(pr.next.text)}</span></span></button><details><summary class="muted">Change ambition</summary>${pick}</details></div>`;
}
