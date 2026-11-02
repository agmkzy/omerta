// A small helper for building elements, so the playground needs no framework.
type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, '').toLowerCase(), value);
    else if (key === 'class') el.className = String(value);
    else if (key === 'style') el.setAttribute('style', String(value));
    else if (key in el && typeof value !== 'boolean') (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** The value of the input or select an event came from ('' for anything else). */
export function valueOf(e: Event): string {
  const t = e.currentTarget;
  return t instanceof HTMLInputElement || t instanceof HTMLSelectElement ? t.value : '';
}

/** Whether the checkbox an event came from is ticked. */
export function checkedOf(e: Event): boolean {
  return e.currentTarget instanceof HTMLInputElement && e.currentTarget.checked;
}

/** A row of buttons for picking one of a few values. */
export function segmented<T extends string>(options: readonly T[], current: T, pick: (v: T) => void, label: (v: T) => string = (v) => v): HTMLElement {
  return h('div', { class: 'segmented', role: 'group' }, ...options.map((o) => h('button', { type: 'button', 'aria-pressed': String(o === current), onclick: () => pick(o) }, label(o))));
}

/** A slider with its value shown beside it, and an optional explanation under the label. */
export function slider(
  label: string,
  value: number,
  min: number,
  max: number,
  change: (v: number) => void,
  show: (v: number) => string = String,
  hint?: string,
): HTMLElement {
  const out = h('output', { class: 'value' }, show(value));
  const input = h('input', { type: 'range', min, max, step: 1, value, 'aria-label': label });
  input.addEventListener('input', () => {
    out.textContent = show(Number(input.value));
    change(Number(input.value));
  });
  return h('label', { class: 'field' }, h('span', {}, label), hint ? h('span', { class: 'hint' }, hint) : null, h('div', { class: 'row' }, input, out));
}
