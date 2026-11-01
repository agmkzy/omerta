// Fight tab: put saved characters on Side A (attackers) and Side B (defenders), then run the fight once to read it attack
// by attack, or many times to see how often each side wins and how each fighter tends to end up.
import { BACKGROUND_INFO } from '../src/backgrounds';
import { BASE_DEFENCE, BASE_HIT_POINTS } from '../src/character';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeRoll, percent } from '../src/explain';
import { FIGHTER_STATUS_INFO, UNARMED_DAMAGE_DIE, runFight, tallyFights, type FightResult, type FightSpec, type FightTally } from '../src/fight';
import { describeFightEvent } from '../src/fight-log';
import { NERVE_DC, type Side } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { h, segmented, slider } from './dom';
import { assign, canFight, loadParties, reconcile, saveParties, sideOf, type Parties } from './parties';
import { characterById, getRoster, storage } from './store';
import { hint, type Panel } from './views';

const RUNS = 1000;
const SIDE_NAME: Readonly<Record<Side, string>> = { attacker: 'Side A (attackers)', defender: 'Side B (defenders)' };
const CHOICES = ['attacker', 'out', 'defender'] as const;
type Choice = (typeof CHOICES)[number];

interface State {
  parties: Parties;
  dice: DiceName;
  maxRounds: number;
  run: FightResult | null;
  tally: { fighters: { id: string; name: string; side: Side }[]; tally: FightTally } | null;
}

export function fightPanel(): Panel {
  const state: State = { parties: { attackers: [], defenders: [] }, dice: 'd20', maxRounds: 12, run: null, tally: null };
  const dice = roller(seeded(2));
  const root = h('section', { class: 'panel', id: 'fight', 'aria-labelledby': 'fight-title' });
  const results = h('div');

  /**
   * Brings the line-up in step with the roster: starts from the saved line-up the first time, drops deleted characters, and
   * if nobody is lined up at all, puts the roster's attacker and defender opposite each other.
   */
  let loaded = false;
  const syncParties = () => {
    const r = getRoster();
    if (!loaded) {
      state.parties = (storage && loadParties(storage)) ?? state.parties;
      loaded = true;
    }
    state.parties = reconcile(state.parties, r.entries.map((e) => e.id));
    if (!state.parties.attackers.length && !state.parties.defenders.length) state.parties = { attackers: [r.attacker], defenders: [r.defender] };
    if (storage) saveParties(storage, state.parties);
  };
  const setParties = (p: Parties) => {
    state.parties = p;
    if (storage) saveParties(storage, p);
    state.run = null;
    state.tally = null;
    render();
  };

  const spec = (): FightSpec => ({
    attackers: state.parties.attackers.map(characterById),
    defenders: state.parties.defenders.map(characterById),
    dice: DICE[state.dice],
    maxRounds: state.maxRounds,
  });

  function tallyView(): HTMLElement[] {
    const { fighters, tally } = state.tally!;
    const share = (n: number) => percent(n / RUNS);
    const nerve = (id: string) => {
      const s = tally.statuses[id]!;
      return s.surrendered + s['backed-off'] + s.fled;
    };
    return [
      h('h3', {}, `Results of ${RUNS.toLocaleString()} fights`),
      h('table', { class: 'tally' }, h('tbody', {},
        ...(['attacker', 'defender'] as const).map((side) =>
          h('tr', {}, h('td', {}, `${SIDE_NAME[side]} wins`), h('td', { class: 'num' }, share(tally.wins[side])),
            h('td', { class: 'barcell' }, h('div', { class: `fill ${side === 'attacker' ? 'win' : 'loss'}`, style: `width:${(tally.wins[side] / RUNS) * 100}%` })))),
        h('tr', {}, h('td', {}, 'Stalemate'), h('td', { class: 'num' }, share(tally.wins.stalemate)), h('td', {})))),
      h('h3', {}, 'How each fighter ended up'),
      h('table', { class: 'fighters' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Fighter'), h('th', { class: 'num' }, 'Still fighting'), h('th', { class: 'num' }, 'Knocked out'), h('th', { class: 'num' }, 'Lost their nerve'))),
        h('tbody', {}, ...fighters.map((f) => {
          const s = tally.statuses[f.id]!;
          return h('tr', {}, h('td', {}, `${f.name} `, h('span', { class: 'muted' }, f.side === 'attacker' ? '(A)' : '(B)')),
            h('td', { class: 'num' }, share(s.fighting)), h('td', { class: 'num' }, share(s['knocked-out'])), h('td', { class: 'num' }, share(nerve(f.id))));
        }))),
      hint('Lost their nerve: failed a nerve check and surrendered (defenders), backed off (attackers) or fled.'),
    ];
  }

  function runView(r: FightResult): HTMLElement[] {
    return [
      h('h3', {}, 'One fight, step by step'),
      h('ul', { class: 'final-state' }, ...r.fighters.map((f) =>
        h('li', {}, `${f.character.name} `, h('span', { class: 'muted' }, `(${f.id[0]}) ${f.hp}/${f.maxHp} HP, ${FIGHTER_STATUS_INFO[f.status].title.toLowerCase()}`)))),
      h('ol', { class: 'event-log' }, ...r.events.map((e) =>
        h('li', { class: `ev-${e.kind}` }, describeFightEvent(e, r),
          e.kind === 'attack' ? h('div', { class: 'detail' }, `${describeRoll(e.result.roll)} against Defence ${e.result.dc}`) : null,
          e.kind === 'attack' && e.damage
            ? h('div', { class: 'detail' }, `Damage: ${e.damage.faces.length}d${UNARMED_DAMAGE_DIE} [${e.damage.faces.join(' ')}] ${e.damage.modifier >= 0 ? '+' : ''}${e.damage.modifier} Strength = ${e.damage.total}`)
            : null,
          e.kind === 'nerve' ? h('div', { class: 'detail' }, describeRoll(e.check.result.roll)) : null))),
    ];
  }

  function renderResults() {
    const parts: HTMLElement[] = [];
    if (state.tally) parts.push(...tallyView());
    if (state.run) parts.push(...runView(state.run));
    if (!parts.length) parts.push(hint(canFight(state.parties) ? 'Run a fight to see the results here.' : 'Put at least one character on each side.'));
    results.replaceChildren(...parts);
  }

  function lineUp(): HTMLElement {
    const r = getRoster();
    const label = (c: Choice) => (c === 'attacker' ? 'Side A' : c === 'defender' ? 'Side B' : 'Not fighting');
    return h('div', { class: 'line-up' },
      h('h3', {}, 'Line-up'),
      h('table', {}, h('tbody', {}, ...r.entries.map((e) => {
        const side = sideOf(state.parties, e.id);
        return h('tr', {},
          h('td', {}, e.character.name, h('div', { class: 'hint' }, e.character.background ? BACKGROUND_INFO[e.character.background].name : '')),
          h('td', {}, segmented(CHOICES, side ?? 'out', (c) => setParties(assign(state.parties, e.id, c === 'out' ? null : c)), label)));
      }))),
      hint('Characters are created and edited in the Characters tab.'),
    );
  }

  function render() {
    const ready = canFight(state.parties);
    root.replaceChildren(
      h('h2', { id: 'fight-title' }, 'Fight'),
      h('details', { class: 'guide' }, h('summary', {}, 'How a fight works'),
        h('ul', {},
          h('li', {}, 'At the start, everyone rolls Reflexes. The highest acts first, and so on down (on a tie, defenders go first). This order is used every round.'),
          h('li', {}, `On their turn, each fighter attacks a random enemy who is still fighting: d20 + Brawling bonus against the target’s Defence (${BASE_DEFENCE} + Reflexes bonus). Meeting or beating it is a hit for 1d${UNARMED_DAMAGE_DIE} + Strength modifier damage (at least 1).`),
          h('li', {}, 'A natural 20 always hits and is a critical hit: the damage dice are rolled twice. A natural 1 always misses.'),
          h('li', {}, `Each fighter has hit points: ${BASE_HIT_POINTS} + Constitution modifier, plus their proficiency bonus if trained in Toughness (twice if expert). At 0 they are knocked out.`),
          h('li', {}, `Nerve (D&D’s optional morale rules): a fighter makes one nerve check (DC ${NERVE_DC.hurt}) the first time they drop to half hit points or below, and everyone left on a side makes one (DC ${NERVE_DC['allies-down']}) the first time half of that side is out of the fight. Failing takes them out: a timid or cautious fighter flees; otherwise a defender surrenders or an attacker backs off.`),
          h('li', {}, 'A side loses when nobody on it is still fighting. If both sides are still fighting at the round limit, it is a stalemate.'))),
      h('div', { class: 'grid' },
        h('div', {},
          lineUp(),
          h('h3', {}, 'Options'),
          slider('Round limit', state.maxRounds, 1, 30, (v) => (state.maxRounds = v), String, 'The fight is a stalemate if both sides are still fighting after this many rounds.'),
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description)),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'primary', disabled: !ready, onclick: () => {
              state.run = runFight(spec(), dice);
              renderResults();
            } }, 'Run once'),
            h('button', { type: 'button', disabled: !ready, onclick: () => {
              const s = spec();
              const fighters = [...state.parties.attackers.map((id, i) => ({ id: `A${i + 1}`, name: characterById(id).name, side: 'attacker' as const })),
                ...state.parties.defenders.map((id, i) => ({ id: `B${i + 1}`, name: characterById(id).name, side: 'defender' as const }))];
              state.tally = { fighters, tally: tallyFights(s, dice, RUNS) };
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
      syncParties();
      state.tally = null;
      state.run = null;
      render();
    },
  };
}
