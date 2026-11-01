// Contest tab: configure a contest between two saved characters, run it once to read the round-by-round log, or many
// times to see how often each side wins and what decides it.
import { APPROACHES, APPROACH_INFO, ENDING_INFO, POINTS_PER_LEAD, runContest, tally, type Approach, type ContestResult, type ContestSpec, type Ending, type Side } from '../src/contest';
import { describeEvent } from '../src/contest-log';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeOpposed, percent } from '../src/explain';
import { roller, seeded } from '../src/random';
import { h, segmented, slider } from './dom';
import { sideSelect, swapButton } from './pickers';
import { sideCharacter } from './store';
import { hint, type Panel } from './views';

const RUNS = 1000;

interface State {
  approach: Approach;
  dice: DiceName;
  winningLead: number;
  withdrawAt: number; // 0 = never
  maxRounds: number;
  run: { spec: ContestSpec; result: ContestResult } | null;
  tally: { spec: ContestSpec; counts: Record<string, number> } | null;
}

export function contestPanel(): Panel {
  const state: State = { approach: 'intimidation', dice: 'd20', winningLead: 5, withdrawAt: 0, maxRounds: 12, run: null, tally: null };
  const dice = roller(seeded(2));
  const root = h('section', { class: 'panel', id: 'contest', 'aria-labelledby': 'contest-title' });
  const results = h('div');

  const spec = (): ContestSpec => ({
    attacker: sideCharacter('attacker'), defender: sideCharacter('defender'), approach: state.approach, dice: DICE[state.dice],
    winningLead: state.winningLead, maxRounds: state.maxRounds, ...(state.withdrawAt ? { withdrawAt: state.withdrawAt } : {}),
  });

  /** Parses a tally key ("gives-up:defender") back into an ending. */
  const endingOf = (key: string): Ending => {
    const [how, loser] = key.split(':');
    return loser ? ({ how, loser } as Ending) : { how: 'stalemate', loser: null };
  };

  function tallyView(s: ContestSpec, counts: Record<string, number>): HTMLElement[] {
    const share = (n: number) => percent(n / RUNS);
    const wins = (winner: Side) => Object.entries(counts).filter(([k]) => endingOf(k).loser === (winner === 'attacker' ? 'defender' : 'attacker'));
    const total = (rows: [string, number][]) => rows.reduce((sum, [, n]) => sum + n, 0);
    const section = (winner: Side) => {
      const rows = wins(winner).sort((a, b) => b[1] - a[1]);
      const loserName = s[winner === 'attacker' ? 'defender' : 'attacker'].name;
      return h('div', { class: 'outcome-group' },
        h('div', { class: 'outcome-head' }, h('strong', {}, `${s[winner].name} wins`), h('span', { class: 'num' }, share(total(rows)))),
        rows.length
          ? h('ul', {}, ...rows.map(([k, n]) => {
              const info = ENDING_INFO[endingOf(k).how];
              return h('li', {},
                h('div', { class: 'outcome-row' }, h('span', {}, `${loserName}: ${info.title.toLowerCase()}`), h('span', { class: 'num' }, share(n)),
                  h('div', { class: 'barcell' }, h('div', { class: `fill ${winner === 'attacker' ? 'win' : 'loss'}`, style: `width:${(n / RUNS) * 100}%` }))),
                h('div', { class: 'hint' }, info.explanation));
            }))
          : hint('Never.'));
    };
    const stalemates = counts.stalemate ?? 0;
    return [
      h('h3', {}, `Results of ${RUNS.toLocaleString()} contests`),
      section('attacker'),
      section('defender'),
      h('div', { class: 'outcome-group' },
        h('div', { class: 'outcome-head' }, h('strong', {}, 'Stalemate'), h('span', { class: 'num' }, share(stalemates))),
        h('div', { class: 'hint' }, ENDING_INFO.stalemate.explanation)),
    ];
  }

  function renderResults() {
    const parts: HTMLElement[] = [];
    if (state.tally) parts.push(...tallyView(state.tally.spec, state.tally.counts));
    if (state.run) {
      const { spec: s, result } = state.run;
      parts.push(
        h('h3', {}, 'One contest, round by round'),
        h('ol', { class: 'event-log' }, ...result.events.map((e) =>
          h('li', { class: `ev-${e.kind}` }, describeEvent(e, s),
            e.kind === 'round' ? h('div', { class: 'detail' }, describeOpposed(e.result)) : null,
            e.kind === 'nerve' ? h('div', { class: 'detail' }, e.result.roll.modifiers.map((m) => `${m.value >= 0 ? '+' : ''}${m.value} ${m.reason}`).join(', ')) : null))),
      );
    }
    if (!parts.length) parts.push(hint('Run a contest to see the results here.'));
    results.replaceChildren(...parts);
  }

  function render() {
    root.replaceChildren(
      h('h2', { id: 'contest-title' }, 'Contest'),
      h('details', { class: 'guide', open: true }, h('summary', {}, 'How a contest works'),
        h('ul', {},
          h('li', {}, `It is played in rounds. Each round both characters roll, and whoever rolls higher gains lead points: 1 point for every ${POINTS_PER_LEAD} points they rolled higher by (rounded up). A tie changes nothing.`),
          h('li', {}, 'A character wins outright when their lead reaches the winning lead.'),
          h('li', {}, 'A character can also lose their nerve. They make a nerve check when they fall behind by half the winning lead (DC 10, once per contest), take a hit in a fight (DC 10 + 2 per hit), or have a weapon drawn on them (DC 12).'),
          h('li', {}, 'Failing a nerve check ends the contest: a hot-tempered character escalates to a fight instead (once); a timid or cautious one flees; anyone else gives up.'),
          h('li', {}, 'If neither side has won by the round limit, it is a stalemate.'))),
      h('div', { class: 'grid' },
        h('div', {},
          h('div', { class: 'row sides' }, sideSelect('attacker', 'Attacker'), swapButton(), sideSelect('defender', 'Defender')),
          h('div', { class: 'field' }, h('span', {}, 'Approach'), segmented(APPROACHES, state.approach, (a) => { state.approach = a; render(); }, (a) => APPROACH_INFO[a].name),
            hint(APPROACH_INFO[state.approach].description)),
          slider('Winning lead', state.winningLead, 1, 10, (v) => {
            state.winningLead = v;
            state.withdrawAt = Math.min(state.withdrawAt, v);
            render();
          }, String, 'How many points ahead a character must get to win. Higher values make contests longer and less dependent on one lucky roll.'),
          slider('Attacker withdraws when behind by (0 = never)', state.withdrawAt, 0, state.winningLead, (v) => (state.withdrawAt = v), String,
            'Lets the attacker cut their losses instead of fighting on.'),
          slider('Round limit', state.maxRounds, 1, 30, (v) => (state.maxRounds = v), String, 'The contest is a stalemate if nobody has won after this many rounds.'),
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description)),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'primary', onclick: () => {
              const s = spec();
              state.run = { spec: s, result: runContest(s, dice) };
              renderResults();
            } }, 'Run once'),
            h('button', { type: 'button', onclick: () => {
              const s = spec();
              state.tally = { spec: s, counts: tally(s, dice, RUNS) };
              renderResults();
            } }, `Run ${RUNS.toLocaleString()} times`),
          ),
        ),
        results,
      ),
    );
    renderResults();
  }

  return {
    element: root,
    render() {
      state.tally = null;
      state.run = null;
      render();
    },
  };
}
