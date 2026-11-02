// Controls for choosing which saved characters take part in a check.
import { h, valueOf } from './dom';
import { setRole, type Role } from './roster';
import { change, getRoster } from './store';

/** Changes made through these controls use this source, so the active tab re-renders. */
export const PICKER = 'picker';

export function roleSelect(role: Role, label: string): HTMLElement {
  const r = getRoster();
  return h('label', { class: 'field' }, h('span', {}, label),
    h('select', { 'aria-label': label, onchange: (e: Event) => change((x) => setRole(x, role, valueOf(e)), PICKER) },
      ...r.entries.map((e) => h('option', { value: e.id, selected: e.id === r[role] }, e.character.name))));
}

