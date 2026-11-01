// Dice and odds panel: choose the dice, a bonus and a DC or opposing bonus, and compare the outcome probabilities across dice.
import { checkOdds, opposedOdds, resolveCheck, resolveOpposed, succeeded, type Odds, type Outcome, type Roll } from '../src/check';
import { DICE, DICE_NAMES, EDGES, EDGE_INFO, type DiceName, type Edge } from '../src/dice';
import { describeCheck, describeOpposed, percent, signed } from '../src/explain';
import { roller, seeded, type Roller } from '../src/random';
import { h, segmented, slider } from './dom';
import { hint, oddsView, outcomeGuide, outcomeTag, type Panel } from './views';

type Against = 'dc' | 'opponent';

interface State {
  dice: DiceName;
  against: Against;
  bonus: number;
  edge: Edge;
  dc: number;
  opponentBonus: number;
  opponentEdge: Edge;
  seed: number;
  log: { text: string; outcome: Outcome }[];
}


export function oddsPanel(): Panel {
  const state: State = { dice: 'd20', against: 'dc', bonus: 3, edge: 'none', dc: 13, opponentBonus: 2, opponentEdge: 'none', seed: 1, log: [] };
  let dice: Roller = roller(seeded(state.seed));

  const root = h('section', { class: 'panel', id: 'odds', 'aria-labelledby': 'odds-title' });
  const results = h('div');

  const active = (name: DiceName = state.dice): Roll => ({ dice: DICE[name], edge: state.edge, modifiers: [{ value: state.bonus, reason: 'Bonus' }] });
  const opponent = (name: DiceName = state.dice): Roll => ({ dice: DICE[name], edge: state.opponentEdge, modifiers: [{ value: state.opponentBonus, reason: 'Opponent bonus' }] });
  const odds = (name: DiceName = state.dice): Odds =>
    state.against === 'dc' ? checkOdds({ ...active(name), dc: state.dc }) : opposedOdds({ active: active(name), passive: opponent(name) });

  function roll(times: number) {
    for (let i = 0; i < times; i++) {
      if (state.against === 'dc') {
        const r = resolveCheck({ ...active(), dc: state.dc }, dice);
        state.log.unshift({ text: describeCheck(r), outcome: r.outcome });
      } else {
        const r = resolveOpposed({ active: active(), passive: opponent() }, dice);
        state.log.unshift({ text: describeOpposed(r), outcome: r.outcome });
      }
    }
    state.log.length = Math.min(state.log.length, 30);
    renderResults();
  }

  function renderResults() {
    results.replaceChildren(
      oddsView(odds()),
      outcomeGuide(),
      h('h3', {}, 'Comparison by dice'),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Dice'), h('th', {}, 'Success'), h('th', {}, 'Full success or better'), h('th', {}, 'Critical failure'))),
        h('tbody', {}, ...DICE_NAMES.map((name) => {
          const o = odds(name);
          return h('tr', { class: name === state.dice ? 'current' : '' },
            h('td', {}, name), h('td', {}, percent(o.partial + o.success + o['critical-success'])), h('td', {}, percent(o.success + o['critical-success'])), h('td', {}, percent(o['critical-failure'])));
        }))),
      h('h3', {}, 'Rolls'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', onclick: () => roll(1) }, 'Roll'),
        h('button', { type: 'button', onclick: () => roll(10) }, 'Roll 10'),
        h('label', { class: 'row muted' }, 'Seed', h('input', { type: 'number', value: state.seed, onchange: (e: Event) => {
          state.seed = Number((e.target as HTMLInputElement).value);
          dice = roller(seeded(state.seed));
          state.log = [];
          renderResults();
        } })),
        state.log.length ? h('span', { class: 'muted' }, `${state.log.filter((l) => succeeded(l.outcome)).length} of ${state.log.length} succeeded`) : null),
      h('ol', { class: 'log' }, ...state.log.map((l) => h('li', {}, outcomeTag(l.outcome), l.text))),
    );
  }

  function render() {
    const edge = (current: Edge, set: (e: Edge) => void) => segmented(EDGES, current, (e) => { set(e); render(); }, (e) => EDGE_INFO[e].name);
    root.replaceChildren(
      h('h2', { id: 'odds-title' }, 'Dice and odds'),
      hint('Explore how the dice, bonuses and difficulty affect the chances, independently of any character.'),
      h('div', { class: 'grid' },
        h('div', {},
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description)),
          h('div', { class: 'field' }, h('span', {}, 'Against'), segmented(['dc', 'opponent'] as const, state.against, (a) => { state.against = a; render(); },
            (a) => (a === 'dc' ? 'DC' : 'Opponent'))),
          slider('Bonus', state.bonus, -5, 15, (v) => { state.bonus = v; renderResults(); }, signed,
            'Everything added to the dice: attribute modifier, proficiency and situational modifiers. A typical trained skill is +2 to +7.'),
          h('div', { class: 'field' }, h('span', {}, 'Advantage'), edge(state.edge, (e) => (state.edge = e)), hint(EDGE_INFO[state.edge].description)),
          state.against === 'dc'
            ? slider('DC', state.dc, 0, 30, (v) => { state.dc = v; renderResults(); }, String,
                'Difficulty class: the total needed. Roughly 10 is easy, 15 moderate, 20 hard, 25 very hard.')
            : h('div', {},
                slider('Opponent bonus', state.opponentBonus, -5, 15, (v) => { state.opponentBonus = v; renderResults(); }, signed),
                h('div', { class: 'field' }, h('span', {}, 'Opponent advantage'), edge(state.opponentEdge, (e) => (state.opponentEdge = e)), hint(EDGE_INFO[state.opponentEdge].description)),
                h('p', { class: 'muted' }, 'The active side must beat the opponent’s total; ties fail.')),
        ),
        results,
      ),
    );
    renderResults();
  }

  render();
  return { element: root, render: () => undefined };
}
