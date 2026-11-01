// Controls for choosing which saved characters take part in a check or contest.
import type { Side } from '../src/contest';
import { h } from './dom';
import { setSide, swapSides } from './roster';
import { change, getRoster } from './store';

/** Changes made through these controls use this source, so the active tab re-renders. */
export const PICKER = 'picker';

export function sideSelect(side: Side, label: string): HTMLElement {
  const r = getRoster();
  return h('label', { class: 'field' }, h('span', {}, label),
    h('select', { 'aria-label': label, onchange: (e: Event) => change((x) => setSide(x, side, (e.target as HTMLSelectElement).value), PICKER) },
      ...r.entries.map((e) => h('option', { value: e.id, selected: e.id === r[side] }, e.character.name))));
}

export function swapButton(): HTMLElement {
  return h('button', { type: 'button', onclick: () => change(swapSides, PICKER) }, 'Swap');
}
