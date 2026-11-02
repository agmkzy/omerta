// UI components shared by the panels.
import { OUTCOMES, OUTCOME_INFO, describeMargins, type Modifier, type Odds, type Outcome } from '../src/check';
import { describeModifier, percent, signed } from '../src/explain';
import { h } from './dom';

export function outcomeLabel(o: Outcome): string {
  return o.replace('-', ' ');
}

/** Success chance as a headline, plus a stacked bar and legend for every outcome. */
export function oddsView(odds: Odds): HTMLElement {
  const success = odds.partial + odds.success + odds['critical-success'];
  return h('div', {},
    h('div', { class: 'headline' }, percent(success), ' ', h('small', {}, 'success (partial or better)')),
    h('div', { class: 'bar', role: 'img', 'aria-label': OUTCOMES.map((o) => `${outcomeLabel(o)} ${percent(odds[o])}`).join(', ') },
      ...OUTCOMES.map((o) => h('div', { class: `o-${o}`, style: `width:${odds[o] * 100}%`, title: `${outcomeLabel(o)}: ${percent(odds[o])}` }))),
    h('div', { class: 'legend' }, ...OUTCOMES.map((o) => h('span', {}, h('i', { class: `o-${o}` }), `${outcomeLabel(o)} ${percent(odds[o])}`))),
  );
}

/** A list of modifiers with reasons, and their total. */
export function modifiersView(title: string, modifiers: readonly Modifier[]): HTMLElement {
  const total = modifiers.reduce((s, m) => s + m.value, 0);
  return h('div', { class: 'modifiers' },
    h('div', { class: 'muted' }, title),
    h('ul', {}, ...modifiers.map((m) => h('li', {}, describeModifier(m)))),
    h('div', {}, h('strong', {}, `Total ${signed(total)}`)),
  );
}

/** A short explanation shown under a control or heading. */
export function hint(text: string): HTMLElement {
  return h('p', { class: 'hint' }, text);
}

/** A collapsible list explaining the five outcomes. */
export function outcomeGuide(): HTMLElement {
  return h('details', { class: 'guide' }, h('summary', {}, 'What the outcomes mean'),
    h('ul', {}, ...OUTCOMES.map((o) => h('li', {}, h('i', { class: `swatch o-${o}` }), h('strong', {}, OUTCOME_INFO[o].name), `: ${describeMargins(o)}; ${OUTCOME_INFO[o].effect}.`))));
}

/** A coloured tag showing an outcome. */
export function outcomeTag(o: Outcome): HTMLElement {
  return h('span', { class: `tag o-${o}` }, outcomeLabel(o));
}

/** A playground tab's content. `render` rebuilds it from the current state; it is called when the tab is shown. */
export interface Panel {
  readonly element: HTMLElement;
  render(): void;
}
