// Contest panel: configure a contest between the two characters, run it once to see the event log, or many times for the
// distribution of endings.
import { APPROACHES, runContest, tally, type Approach, type ContestResult, type ContestSpec, type Ending } from '../src/contest';
import { describeEnding, describeEvent } from '../src/contest-log';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeOpposed, percent } from '../src/explain';
import { roller, seeded } from '../src/random';
import { h, segmented, slider } from './dom';
import { character, onChange, swapSides } from './store';

const APPROACH_LABEL: Readonly<Record<Approach, string>> = { intimidate: 'Intimidate', gunpoint: 'Gunpoint', brawl: 'Brawl' };
const RUNS = 1000;

interface State {
  approach: Approach;
  dice: DiceName;
  track: number;
  walkAwayAt: number; // 0 = off
  maxRounds: number;
  run: { spec: ContestSpec; result: ContestResult } | null;
  tally: Record<string, number> | null;
}

export function contestPanel(): HTMLElement {
  const state: State = { approach: 'intimidate', dice: 'd20', track: 5, walkAwayAt: 0, maxRounds: 12, run: null, tally: null };
  const dice = roller(seeded(1931));
  const root = h('section', { class: 'panel', id: 'contest', 'aria-labelledby': 'contest-title' });
  const results = h('div');

  const spec = (): ContestSpec => ({
    attacker: character('attacker'), defender: character('defender'), approach: state.approach, dice: DICE[state.dice],
    track: state.track, maxRounds: state.maxRounds, ...(state.walkAwayAt ? { walkAwayAt: state.walkAwayAt } : {}),
  });

  /** Parses a tally key back into an ending, to describe it. */
  const endingOf = (key: string): Ending => {
    const [how, loser] = key.split(':');
    return loser ? ({ how, loser } as Ending) : { how: 'stalemate', loser: null };
  };

  function renderResults() {
    const parts: HTMLElement[] = [];
    if (state.tally) {
      const s = spec();
      const rows = Object.entries(state.tally).sort((a, b) => b[1] - a[1]);
      const attackerWins = rows.filter(([k]) => k.endsWith(':defender')).reduce((sum, [, n]) => sum + n, 0);
      parts.push(
        h('h3', {}, `${RUNS} runs`),
        h('div', { class: 'headline' }, percent(attackerWins / RUNS), ' ', h('small', {}, `attacker (${s.attacker.name}) wins`)),
        h('table', { class: 'tally' }, h('tbody', {}, ...rows.map(([k, n]) =>
          h('tr', {}, h('td', {}, describeEnding(endingOf(k), s)), h('td', { class: 'num' }, percent(n / RUNS)),
            h('td', { class: 'barcell' }, h('div', { class: k.endsWith(':defender') ? 'fill win' : k === 'stalemate' ? 'fill draw' : 'fill loss', style: `width:${(n / RUNS) * 100}%` })))))),
      );
    }
    if (state.run) {
      const { spec: s, result } = state.run;
      parts.push(
        h('h3', {}, 'Single run'),
        h('ol', { class: 'event-log' }, ...result.events.map((e) =>
          h('li', { class: `ev-${e.kind}` }, describeEvent(e, s),
            e.kind === 'exchange' ? h('div', { class: 'detail' }, describeOpposed(e.result)) : null,
            e.kind === 'nerve' ? h('div', { class: 'detail' }, e.result.roll.modifiers.map((m) => `${m.value >= 0 ? '+' : ''}${m.value} ${m.reason}`).join(', ')) : null))),
      );
    }
    results.replaceChildren(...parts);
  }

  function render() {
    root.replaceChildren(
      h('h2', { id: 'contest-title' }, 'Contest'),
      h('p', { class: 'muted' }, `Attacker: ${character('attacker').name}. Defender: ${character('defender').name}. Rounds resolve automatically; nerve checks are triggered by events, and a failed check ends the contest according to temperament.`),
      h('div', { class: 'grid' },
        h('div', {},
          h('div', { class: 'field' }, h('span', {}, 'Approach'), segmented(APPROACHES, state.approach, (a) => { state.approach = a; render(); }, (a) => APPROACH_LABEL[a])),
          slider('Track length (steps each way)', state.track, 1, 10, (v) => {
            state.track = v;
            state.walkAwayAt = Math.min(state.walkAwayAt, v);
            render();
          }),
          slider('Attacker walk-away line (0 = off)', state.walkAwayAt, 0, state.track, (v) => (state.walkAwayAt = v)),
          slider('Max rounds', state.maxRounds, 1, 30, (v) => (state.maxRounds = v)),
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); })),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'primary', onclick: () => {
              const s = spec();
              state.run = { spec: s, result: runContest(s, dice) };
              renderResults();
            } }, 'Run once'),
            h('button', { type: 'button', onclick: () => {
              state.tally = tally(spec(), dice, RUNS);
              renderResults();
            } }, `Run ${RUNS} times`),
            h('button', { type: 'button', onclick: () => swapSides('contest') }, 'Swap sides'),
          ),
        ),
        results,
      ),
    );
    renderResults();
  }

  onChange(() => {
    state.tally = null;
    render();
  });
  render();
  return root;
}
