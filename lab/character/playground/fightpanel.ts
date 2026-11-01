// Fight tab, in two views. Set-up: click characters to add them to Side A or Side B; each fighter is shown once as a card
// with the numbers the fight uses. Fight: the same cards with how each fighter ended up, then the log, one short line per
// action, grouped by round. Roll breakdowns are shown on hover rather than repeated in the log.
import { BACKGROUND_INFO } from '../src/backgrounds';
import { BASE_DEFENCE, BASE_HIT_POINTS, type Character } from '../src/character';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeRoll, percent, signed } from '../src/explain';
import { UNARMED_DAMAGE_DIE, fightStats, runFight, tallyFights, type FightEvent, type FightResult, type FightSpec, type FightTally, type FighterStatus } from '../src/fight';
import { describeFightEvent } from '../src/fight-log';
import { NERVE_DC, type Side } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { notableTraits } from '../src/temperament';
import { h, segmented, slider } from './dom';
import { assign, canFight, loadParties, reconcile, saveParties, type Parties } from './parties';
import { characterById, getRoster, storage } from './store';
import { hint, type Panel } from './views';

const RUNS = 1000;
const SIDES = ['attacker', 'defender'] as const;
const SIDE_TITLE: Readonly<Record<Side, string>> = { attacker: 'Side A', defender: 'Side B' };
const STATUS_LABEL: Readonly<Record<FighterStatus, string>> = {
  fighting: 'Still fighting', 'knocked-out': 'Knocked out', surrendered: 'Surrendered', 'backed-off': 'Backed off', fled: 'Fled',
};

interface State {
  view: 'setup' | 'fight';
  parties: Parties;
  dice: DiceName;
  maxRounds: number;
  fight: FightResult | null;
  tally: FightTally | null;
}

/** A fighter shown once, with the numbers the fight uses. After a fight, `result` gives their hit points and status. */
function fighterCard(c: Character, options: { result?: { hp: number; status: FighterStatus }; onRemove?: () => void } = {}): HTMLElement {
  const s = fightStats(c);
  const hp = options.result?.hp ?? s.hitPoints;
  const status = options.result?.status;
  const traits = notableTraits(c.temperament);
  const stat = (label: string, value: string, title: string) => h('div', { class: 'stat', title }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value));
  return h('div', { class: `fighter-card${status && status !== 'fighting' ? ' out' : ''}` },
    h('div', { class: 'fighter-head' },
      h('div', {}, h('div', { class: 'fighter-name' }, c.name), h('div', { class: 'hint' }, c.background ? BACKGROUND_INFO[c.background].name : '')),
      status ? h('span', { class: `status status-${status}` }, STATUS_LABEL[status]) : null,
      options.onRemove ? h('button', { type: 'button', class: 'remove', 'aria-label': `Remove ${c.name}`, onclick: options.onRemove }, '×') : null),
    h('div', { class: 'hp', title: 'Hit points' },
      h('div', { class: 'hp-bar' }, h('div', { class: 'hp-fill', style: `width:${(hp / s.hitPoints) * 100}%` })),
      h('span', { class: 'hp-text' }, `${hp}/${s.hitPoints} HP`)),
    h('div', { class: 'stats' },
      stat('Attack', signed(s.attack), 'Added to the d20 when attacking (Brawling).'),
      stat('Defence', String(s.defence), `What an attack must reach to hit (${BASE_DEFENCE} + Reflexes).`),
      stat('Damage', `1d${s.damageDie}${s.damageModifier ? ` ${signed(s.damageModifier)}` : ''}`, 'Damage per hit (Strength modifier added; at least 1).'),
      stat('Initiative', signed(s.initiative), 'Added to the d20 for turn order (Reflexes).'),
      stat('Nerve', signed(s.nerve), 'Added to the d20 for nerve checks, including temperament.')),
    traits.length ? h('div', { class: 'hint' }, traits.join(', ')) : null,
  );
}

/** The roll breakdown for an event, shown on hover. */
function eventDetail(e: FightEvent): string {
  if (e.kind === 'attack') return [`${describeRoll(e.result.roll)} vs Defence ${e.result.dc}`, e.damage ? `Damage: ${e.damage.faces.length}d${UNARMED_DAMAGE_DIE} [${e.damage.faces.join(' ')}] ${signed(e.damage.modifier)} Strength = ${e.damage.total}` : ''].filter(Boolean).join('\n');
  if (e.kind === 'nerve') return `${describeRoll(e.check.result.roll)} vs ${e.check.result.dc}`;
  if (e.kind === 'initiative') return e.order.map((o) => describeRoll(o.roll)).join('\n');
  return '';
}

export function fightPanel(): Panel {
  const state: State = { view: 'setup', parties: { attackers: [], defenders: [] }, dice: 'd20', maxRounds: 12, fight: null, tally: null };
  const dice = roller(seeded(2));
  const root = h('section', { class: 'panel', id: 'fight', 'aria-labelledby': 'fight-title' });

  /** Keeps the line-up in step with the roster. Starts from the saved line-up, or the 1st against the 2nd saved character. */
  let loaded = false;
  const syncParties = () => {
    const ids = getRoster().entries.map((e) => e.id);
    if (!loaded) {
      state.parties = (storage && loadParties(storage)) ?? state.parties;
      loaded = true;
    }
    state.parties = reconcile(state.parties, ids);
    if (!state.parties.attackers.length && !state.parties.defenders.length) state.parties = { attackers: [ids[0]!], defenders: [ids[1]!] };
    if (storage) saveParties(storage, state.parties);
  };
  const setParties = (p: Parties) => {
    state.parties = p;
    if (storage) saveParties(storage, p);
    render();
  };
  const members = (side: Side) => (side === 'attacker' ? state.parties.attackers : state.parties.defenders);
  const spec = (): FightSpec => ({ attackers: members('attacker').map(characterById), defenders: members('defender').map(characterById), dice: DICE[state.dice], maxRounds: state.maxRounds });
  const fight = (simulate: boolean) => {
    state.fight = runFight(spec(), dice);
    state.tally = simulate ? tallyFights(spec(), dice, RUNS) : null;
    state.view = 'fight';
    render();
  };

  const guide = () =>
    h('details', { class: 'guide' }, h('summary', {}, 'How a fight works'),
      h('ul', {},
        h('li', {}, 'Everyone rolls Initiative. The highest acts first, and so on down (on a tie, Side B first). This order is used every round.'),
        h('li', {}, `On their turn, each fighter attacks a random enemy who is still fighting: d20 + Attack against the target’s Defence. Meeting or beating it is a hit for their Damage (at least 1).`),
        h('li', {}, 'A natural 20 always hits and is a critical hit: the damage dice are rolled twice. A natural 1 always misses.'),
        h('li', {}, `Hit points are ${BASE_HIT_POINTS} + Constitution modifier, plus the proficiency bonus if trained in Toughness. At 0 a fighter is knocked out.`),
        h('li', {}, `Nerve: a fighter makes one nerve check (d20 + Nerve, DC ${NERVE_DC.hurt}) the first time they drop to half HP, and everyone left on a side makes one (DC ${NERVE_DC['allies-down']}) the first time half of that side is out. Failing takes them out: a timid or cautious fighter flees; otherwise they surrender (Side B) or back off (Side A).`),
        h('li', {}, 'A side loses when nobody on it is still fighting. If both sides are still fighting at the round limit, it is a stalemate.')));

  function renderSetup() {
    const inFight = new Set([...state.parties.attackers, ...state.parties.defenders]);
    const available = getRoster().entries.filter((e) => !inFight.has(e.id));
    const ready = canFight(state.parties);
    const sideColumn = (side: Side) =>
      h('div', { class: 'side' },
        h('h3', {}, `${SIDE_TITLE[side]} ${side === 'attacker' ? '(attackers)' : '(defenders)'}`),
        ...members(side).map((id) => fighterCard(characterById(id), { onRemove: () => setParties(assign(state.parties, id, null)) })),
        members(side).length ? null : hint('Nobody yet.'),
        available.length
          ? h('div', { class: 'add' }, h('span', { class: 'hint' }, `Add to ${SIDE_TITLE[side]}:`),
              h('div', { class: 'chips' }, ...available.map((e) => h('button', { type: 'button', class: 'chip', onclick: () => setParties(assign(state.parties, e.id, side)) }, `+ ${e.character.name}`))))
          : null);
    root.replaceChildren(
      h('h2', { id: 'fight-title' }, 'Fight set-up'),
      hint(available.length ? 'Click a name to add that character to a side, or × to remove them.' : 'Everyone saved is already in the fight. Create more characters in the Characters tab.'),
      h('div', { class: 'grid two sides' }, sideColumn('attacker'), sideColumn('defender')),
      h('details', { class: 'guide' }, h('summary', {}, `Options: round limit ${state.maxRounds}, ${state.dice}`),
        slider('Round limit', state.maxRounds, 1, 30, (v) => (state.maxRounds = v), String, 'The fight is a stalemate if both sides are still fighting after this many rounds.'),
        h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description))),
      guide(),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', disabled: !ready, onclick: () => fight(false) }, 'Start fight'),
        h('button', { type: 'button', disabled: !ready, onclick: () => fight(true) }, `Simulate ${RUNS.toLocaleString()} fights`),
        ready ? null : h('span', { class: 'hint' }, 'Put at least one character on each side.')),
    );
  }

  function renderFight() {
    const r = state.fight!;
    const names = (side: Side) => r.fighters.filter((f) => f.side === side).map((f) => f.character.name).join(', ');
    const result = r.winner ? `${SIDE_TITLE[r.winner]} wins after ${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'}.` : `Stalemate after ${r.rounds} rounds.`;

    // The log: the turn order, then each round's lines under a heading.
    const rounds = new Map<number, FightEvent[]>();
    for (const e of r.events) if (e.kind !== 'initiative' && e.kind !== 'end') rounds.set(e.round, [...(rounds.get(e.round) ?? []), e]);
    const line = (e: FightEvent) => h('li', { class: `ev-${e.kind}`, title: eventDetail(e) }, describeFightEvent(e, r));
    const initiative = r.events.find((e) => e.kind === 'initiative')!;

    root.replaceChildren(
      h('div', { class: 'fight-head' },
        h('h2', { id: 'fight-title' }, `${names('attacker')} vs ${names('defender')}`),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'primary', onclick: () => fight(false) }, 'Fight again'),
          h('button', { type: 'button', onclick: () => fight(true) }, `Simulate ${RUNS.toLocaleString()} fights`),
          h('button', { type: 'button', onclick: () => { state.view = 'setup'; render(); } }, 'Change line-up'))),
      h('p', { class: 'result' }, result),
      h('div', { class: 'grid two sides' }, ...SIDES.map((side) =>
        h('div', { class: 'side' }, h('h3', {}, SIDE_TITLE[side]),
          ...r.fighters.filter((f) => f.side === side).map((f) => fighterCard(f.character, { result: { hp: f.hp, status: f.status } }))))),
      ...(state.tally ? [tallyView(r)] : []),
      h('h3', {}, 'Log'),
      hint('Hover a line to see the dice.'),
      h('ul', { class: 'fight-log' }, line(initiative)),
      ...[...rounds].map(([round, events]) => h('div', { class: 'log-round' }, h('div', { class: 'round-head' }, `Round ${round}`), h('ul', { class: 'fight-log' }, ...events.map(line)))),
    );
  }

  function tallyView(r: FightResult): HTMLElement {
    const t = state.tally!;
    const share = (n: number) => percent(n / RUNS);
    return h('div', { class: 'simulation' },
      h('h3', {}, `${RUNS.toLocaleString()} simulated fights`),
      h('p', { class: 'result' }, [...SIDES.map((side) => `${SIDE_TITLE[side]} wins ${share(t.wins[side])}`), ...(t.wins.stalemate ? [`stalemate ${share(t.wins.stalemate)}`] : [])].join(' · ')),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'How each fighter ended up'), h('th', { class: 'num' }, 'Still fighting'), h('th', { class: 'num' }, 'Knocked out'), h('th', { class: 'num' }, 'Lost their nerve'))),
        h('tbody', {},
          ...r.fighters.map((f) => {
            const s = t.statuses[f.id]!;
            return h('tr', {}, h('td', {}, `${f.character.name} `, h('span', { class: 'muted' }, f.side === 'attacker' ? '(A)' : '(B)')),
              h('td', { class: 'num' }, share(s.fighting)), h('td', { class: 'num' }, share(s['knocked-out'])), h('td', { class: 'num' }, share(s.surrendered + s['backed-off'] + s.fled)));
          }))));
  }

  function render() {
    if (state.view === 'fight' && state.fight) renderFight();
    else renderSetup();
  }

  return {
    element: root,
    render() {
      syncParties();
      state.view = 'setup';
      state.fight = null;
      state.tally = null;
      render();
    },
  };
}
