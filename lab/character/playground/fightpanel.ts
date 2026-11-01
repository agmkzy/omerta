// Fight tab: a fight between two saved characters. Run it once to read it attack by attack, or many times to see how often
// each side wins and how.
import { BASE_DEFENCE, BASE_HIT_POINTS } from '../src/character';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeRoll, percent } from '../src/explain';
import { FIGHT_ENDING_INFO, UNARMED_DAMAGE_DIE, runFight, tallyFights, type FightEnding, type FightResult, type FightSpec } from '../src/fight';
import { describeFightEvent } from '../src/fight-log';
import { NERVE_DC, otherSide, type Side } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { h, segmented, slider } from './dom';
import { sideSelect, swapButton } from './pickers';
import { sideCharacter } from './store';
import { hint, type Panel } from './views';

const RUNS = 1000;

interface State {
  dice: DiceName;
  maxRounds: number;
  run: { spec: FightSpec; result: FightResult } | null;
  tally: { spec: FightSpec; counts: Record<string, number> } | null;
}

export function fightPanel(): Panel {
  const state: State = { dice: 'd20', maxRounds: 12, run: null, tally: null };
  const dice = roller(seeded(2));
  const root = h('section', { class: 'panel', id: 'fight', 'aria-labelledby': 'fight-title' });
  const results = h('div');

  const spec = (): FightSpec => ({ attacker: sideCharacter('attacker'), defender: sideCharacter('defender'), dice: DICE[state.dice], maxRounds: state.maxRounds });

  /** Parses a tally key ("surrenders:defender") back into an ending. */
  const endingOf = (key: string): FightEnding => {
    const [how, loser] = key.split(':');
    return loser ? ({ how, loser } as FightEnding) : { how: 'stalemate', loser: null };
  };

  function tallyView(s: FightSpec, counts: Record<string, number>): HTMLElement[] {
    const share = (n: number) => percent(n / RUNS);
    const section = (winner: Side) => {
      const loser = otherSide(winner);
      const rows = Object.entries(counts).filter(([k]) => endingOf(k).loser === loser).sort((a, b) => b[1] - a[1]);
      return h('div', { class: 'outcome-group' },
        h('div', { class: 'outcome-head' }, h('strong', {}, `${s[winner].name} wins`), h('span', { class: 'num' }, share(rows.reduce((sum, [, n]) => sum + n, 0)))),
        rows.length
          ? h('ul', {}, ...rows.map(([k, n]) => {
              const info = FIGHT_ENDING_INFO[endingOf(k).how];
              return h('li', {},
                h('div', { class: 'outcome-row' }, h('span', {}, `${s[loser].name}: ${info.title.toLowerCase()}`), h('span', { class: 'num' }, share(n)),
                  h('div', { class: 'barcell' }, h('div', { class: `fill ${winner === 'attacker' ? 'win' : 'loss'}`, style: `width:${(n / RUNS) * 100}%` }))),
                h('div', { class: 'hint' }, info.explanation));
            }))
          : hint('Never.'));
    };
    return [
      h('h3', {}, `Results of ${RUNS.toLocaleString()} fights`),
      section('attacker'),
      section('defender'),
      h('div', { class: 'outcome-group' },
        h('div', { class: 'outcome-head' }, h('strong', {}, 'Stalemate'), h('span', { class: 'num' }, share(counts.stalemate ?? 0))),
        h('div', { class: 'hint' }, FIGHT_ENDING_INFO.stalemate.explanation)),
    ];
  }

  function renderResults() {
    const parts: HTMLElement[] = [];
    if (state.tally) parts.push(...tallyView(state.tally.spec, state.tally.counts));
    if (state.run) {
      const { spec: s, result } = state.run;
      const hpLine = (['attacker', 'defender'] as const).map((side) => `${s[side].name} ${result.hp[side]}/${result.maxHp[side]} HP`).join(' · ');
      parts.push(
        h('h3', {}, 'One fight, attack by attack'),
        hint(`At the end: ${hpLine}.`),
        h('ol', { class: 'event-log' }, ...result.events.map((e) =>
          h('li', { class: `ev-${e.kind}` }, describeFightEvent(e, s),
            e.kind === 'initiative' ? h('div', { class: 'detail' }, `${describeRoll(e.result.active)} vs ${describeRoll(e.result.passive)}`) : null,
            e.kind === 'attack' ? h('div', { class: 'detail' }, `${describeRoll(e.result.roll)} against Defence ${e.result.dc}`) : null,
            e.kind === 'attack' && e.damage
              ? h('div', { class: 'detail' }, `Damage: ${e.damage.faces.length}d${UNARMED_DAMAGE_DIE} [${e.damage.faces.join(' ')}] ${e.damage.modifier >= 0 ? '+' : ''}${e.damage.modifier} Strength = ${e.damage.total}`)
              : null,
            e.kind === 'nerve' ? h('div', { class: 'detail' }, describeRoll(e.check.result.roll)) : null))),
      );
    }
    if (!parts.length) parts.push(hint('Run a fight to see the results here.'));
    results.replaceChildren(...parts);
  }

  function render() {
    root.replaceChildren(
      h('h2', { id: 'fight-title' }, 'Fight'),
      h('details', { class: 'guide', open: true }, h('summary', {}, 'How a fight works'),
        h('ul', {},
          h('li', {}, 'At the start, both characters roll Reflexes. The higher roll acts first every round (a tie goes to the defender).'),
          h('li', {}, `Each round, each character attacks in turn: d20 + Brawling bonus against the other’s Defence (${BASE_DEFENCE} + Reflexes bonus). Meeting or beating it is a hit for 1d${UNARMED_DAMAGE_DIE} + Strength modifier damage (at least 1).`),
          h('li', {}, 'A natural 20 always hits and is a critical hit: the damage dice are rolled twice. A natural 1 always misses.'),
          h('li', {}, `Each character has hit points: ${BASE_HIT_POINTS} + Constitution modifier, plus their proficiency bonus if trained in Toughness (twice if expert). At 0 they are knocked out and do not act.`),
          h('li', {}, `The first time a character drops to half hit points or below, they make one nerve check (DC ${NERVE_DC.hurt}): fight or flight. If they pass, they fight on with no further checks. If they fail, a timid or cautious character flees; otherwise the defender surrenders or the attacker backs off. This follows D&D’s optional morale rule.`),
          h('li', {}, 'If nobody has won by the round limit, it is a stalemate.'))),
      h('div', { class: 'grid' },
        h('div', {},
          h('div', { class: 'row sides' }, sideSelect('attacker', 'Attacker'), swapButton(), sideSelect('defender', 'Defender')),
          slider('Round limit', state.maxRounds, 1, 30, (v) => (state.maxRounds = v), String, 'The fight is a stalemate if nobody has won after this many rounds.'),
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description)),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'primary', onclick: () => {
              const s = spec();
              state.run = { spec: s, result: runFight(s, dice) };
              renderResults();
            } }, 'Run once'),
            h('button', { type: 'button', onclick: () => {
              const s = spec();
              state.tally = { spec: s, counts: tallyFights(s, dice, RUNS) };
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
