// The odds panel: pick the dice, a bonus and what it is up against, and see the chance of each outcome, on these dice and the others.
import { OUTCOMES, checkOdds, opposedOdds, resolveCheck, resolveOpposed, succeeded, type Odds, type Outcome, type Roll } from '../src/check';
import { DICE, DICE_NAMES, EDGES, type DiceName, type Edge } from '../src/dice';
import { describeCheck, describeOpposed, percent, signed } from '../src/explain';
import { roller, seeded, type Roller } from '../src/random';
import { h, segmented, slider } from './dom';

type Against = 'difficulty' | 'man';

interface State {
  dice: DiceName;
  against: Against;
  bonus: number;
  edge: Edge;
  dc: number;
  hisBonus: number;
  hisEdge: Edge;
  seed: number;
  log: { text: string; outcome: Outcome }[];
}

export function oddsPanel(): HTMLElement {
  const state: State = { dice: 'd20', against: 'difficulty', bonus: 3, edge: 'none', dc: 13, hisBonus: 2, hisEdge: 'none', seed: 1970, log: [] };
  let dice: Roller = roller(seeded(state.seed));

  const root = h('section', { class: 'panel', 'aria-labelledby': 'odds-title' });
  const results = h('div');

  const yours = (name: DiceName = state.dice): Roll => ({ dice: DICE[name], edge: state.edge, modifiers: [{ value: state.bonus, reason: 'Your bonus' }] });
  const his = (name: DiceName = state.dice): Roll => ({ dice: DICE[name], edge: state.hisEdge, modifiers: [{ value: state.hisBonus, reason: 'His bonus' }] });
  const odds = (name: DiceName = state.dice): Odds =>
    state.against === 'difficulty' ? checkOdds({ ...yours(name), dc: state.dc }) : opposedOdds({ active: yours(name), passive: his(name) });

  function roll(times: number) {
    for (let i = 0; i < times; i++) {
      const entry =
        state.against === 'difficulty'
          ? (() => {
              const r = resolveCheck({ ...yours(), dc: state.dc }, dice);
              return { text: describeCheck(r), outcome: r.outcome };
            })()
          : (() => {
              const r = resolveOpposed({ active: yours(), passive: his() }, dice);
              return { text: describeOpposed(r), outcome: r.outcome };
            })();
      state.log.unshift(entry);
    }
    state.log.length = Math.min(state.log.length, 30);
    renderResults();
  }

  function renderResults() {
    const now = odds();
    const done = now.partial + now.success + now.triumph;
    results.replaceChildren(
      h('div', { class: 'headline' }, percent(done), ' ', h('small', {}, 'chance it gets done (partial or better)')),
      h('div', { class: 'bar', role: 'img', 'aria-label': OUTCOMES.map((o) => `${o} ${percent(now[o])}`).join(', ') },
        ...OUTCOMES.map((o) => h('div', { class: `o-${o}`, style: `width:${now[o] * 100}%`, title: `${o}: ${percent(now[o])}` }))),
      h('div', { class: 'legend' }, ...OUTCOMES.map((o) => h('span', {}, h('i', { class: `o-${o}` }), `${o} ${percent(now[o])}`))),
      h('h3', {}, 'The same on other dice'),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Dice'), h('th', {}, 'Gets done'), h('th', {}, 'Clean or better'), h('th', {}, 'Botch'))),
        h('tbody', {}, ...DICE_NAMES.map((name) => {
          const o = odds(name);
          return h('tr', { class: name === state.dice ? 'current' : '' },
            h('td', {}, name), h('td', {}, percent(o.partial + o.success + o.triumph)), h('td', {}, percent(o.success + o.triumph)), h('td', {}, percent(o.botch)));
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
        state.log.length ? h('span', { class: 'muted' }, `${state.log.filter((l) => succeeded(l.outcome)).length} of ${state.log.length} got done`) : null),
      h('ol', { class: 'log' }, ...state.log.map((l) => h('li', {}, h('span', { class: `tag o-${l.outcome}` }, l.outcome), l.text))),
    );
  }

  function render() {
    const edge = (current: Edge, set: (e: Edge) => void) => segmented(EDGES, current, (e) => { set(e); render(); }, (e) => (e === 'none' ? 'Straight' : e[0]!.toUpperCase() + e.slice(1)));
    root.replaceChildren(
      h('h2', { id: 'odds-title' }, 'Dice and odds'),
      h('div', { class: 'grid' },
        h('div', {},
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); })),
          h('div', { class: 'field' }, h('span', {}, 'Up against'), segmented(['difficulty', 'man'] as const, state.against, (a) => { state.against = a; render(); },
            (a) => (a === 'difficulty' ? 'A difficulty' : 'Another man'))),
          slider('Your bonus (attribute + skill + situation)', state.bonus, -5, 15, (v) => { state.bonus = v; renderResults(); }, signed),
          h('div', { class: 'field' }, h('span', {}, 'Your edge'), edge(state.edge, (e) => (state.edge = e))),
          state.against === 'difficulty'
            ? slider('Difficulty (DC)', state.dc, 0, 30, (v) => { state.dc = v; renderResults(); })
            : h('div', {},
                slider('His bonus', state.hisBonus, -5, 15, (v) => { state.hisBonus = v; renderResults(); }, signed),
                h('div', { class: 'field' }, h('span', {}, 'His edge'), edge(state.hisEdge, (e) => (state.hisEdge = e))),
                h('p', { class: 'muted' }, 'You must beat his total; a tie leaves things as they were.')),
        ),
        results,
      ),
    );
    renderResults();
  }

  render();
  return root;
}
