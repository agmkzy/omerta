// Fight tab, in two views. A fight is kept as the rolls made so far: Auto plays it out at once, Step through stops at
// every roll so the player can roll or choose the result, Back drops the last roll, and Play the rest finishes it.
// Set-up: click characters to add them to the left or right side; each fighter is shown once as a card
// with the numbers the fight uses. Fight: the same cards with how each fighter ended up, then the log, one short line per
// action, grouped by round, with the dice for each line in a column on the right.
import { assessFight, describeRisk } from '../src/assessment';
import { BACKGROUND_INFO } from '../src/backgrounds';
import { BASE_DEFENCE, BASE_HIT_POINTS, type Character } from '../src/character';
import { DICE, DICE_NAMES, type Dice, type DiceName } from '../src/dice';
import { compactRoll, describeModifier, percent, signed } from '../src/explain';
import { bonusOf } from '../src/check';
import { UNARMED_DAMAGE_DIE, facesForResult, fightStats, resultOf, rollOdds, runFight, stepFight, tallyFights, type FightEvent, type FightSpec, type FightTally, type Fighter, type FighterStatus, type RollOdds, type RollRequest } from '../src/fight';
import { describeFightEvent, describeRollRequest, explainRoll } from '../src/fight-log';
import { NERVE_DC, type Side } from '../src/nerve';
import { replay, roller, seeded } from '../src/random';
import { notableTraits } from '../src/temperament';
import { slowingDelays, sweepSequence } from './animation';
import { h, segmented, slider } from './dom';
import { assign, canFight, loadParties, reconcile, saveParties, type Parties } from './parties';
import { canSave, characterById, getRoster, storage } from './store';
import { hint, type Panel } from './views';

const RUNS = 1000;
/** The dice animation, a roulette-style sweep: at least this many steps (and more than once round), over this long, then a short rest on the result. */
const SWEEP_MIN_STEPS = 16;
const SWEEP_MS = 850;
const SETTLE_MS = 1200;
/** Dice for the animation only (where the sweep starts), kept apart from the fight's dice so it can never change a result. */
const showDice = roller(seeded(Date.now() >>> 0));
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const SIDES = ['attacker', 'defender'] as const;
const SIDE_TITLE: Readonly<Record<Side, string>> = { attacker: 'Left', defender: 'Right' };
const STATUS_LABEL: Readonly<Record<FighterStatus, string>> = {
  fighting: 'Still fighting', 'knocked-out': 'Knocked out', surrendered: 'Surrendered', 'backed-off': 'Backed off', fled: 'Fled',
};

interface State {
  view: 'setup' | 'fight';
  parties: Parties;
  dice: DiceName;
  maxRounds: number;
  /** Whether the roll panel shows the odds of the roll. Stays as set across rolls. */
  showOdds: boolean;
  /** The fight in progress or finished: its line-up and every roll so far. */
  fight: { spec: FightSpec; faces: number[] } | null;
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
      stat('Attack', signed(s.attack), 'Added to the dice when attacking (Brawling).'),
      stat('Defence', String(s.defence), `What an attack must reach to hit (${BASE_DEFENCE} + Reflexes).`),
      stat('Damage', `1d${s.damageDie}${s.damageModifier ? ` ${signed(s.damageModifier)}` : ''}`, 'Damage per hit (Strength modifier added; at least 1).'),
      stat('Initiative', signed(s.initiative), 'Added to the dice for turn order (Reflexes).'),
      stat('Nerve', signed(s.nerve), 'Added to the dice for nerve checks, including temperament.')),
    traits.length ? h('div', { class: 'hint' }, traits.join(', ')) : null,
  );
}

/** The dice behind an event, in short form, for the right-hand column of the log. */
function eventDice(e: FightEvent, nameOf: (id: string) => string): string[] {
  if (e.kind === 'attack') {
    const lines = [`${compactRoll(e.result.roll)} vs ${e.result.dc}`];
    if (e.damage) {
      const { faces, modifier, total } = e.damage;
      const sum = `${faces.join('+')}${modifier ? ` ${modifier < 0 ? '−' : '+'} ${Math.abs(modifier)}` : ''}`;
      const result = modifier || faces.length > 1 ? `${sum} = ${total}` : sum;
      lines.push(`damage ${faces.length}d${UNARMED_DAMAGE_DIE}: ${result}${total !== faces.reduce((a, b) => a + b, 0) + modifier ? ' (minimum 1)' : ''}`);
    }
    return lines;
  }
  if (e.kind === 'nerve') return [`${compactRoll(e.check.result.roll)} vs ${e.check.result.dc}`];
  if (e.kind === 'initiative') return e.order.map((o) => `${nameOf(o.id)}: ${compactRoll(o.roll)}`);
  return [];
}

export function fightPanel(): Panel {
  const state: State = { showOdds: false, view: 'setup', parties: { attackers: [], defenders: [] }, dice: 'd20', maxRounds: 12, fight: null, tally: null };
  const dice = roller(seeded(2));
  const root = h('section', { class: 'panel', id: 'fight', 'aria-labelledby': 'fight-title' });

  /**
   * Keeps the line-up in step with the roster. Starts from the saved line-up, or the 1st against the 2nd saved character.
   * Only a change made here is saved, so opening the tab never saves over the stored line-up.
   */
  let loaded = false;
  const syncParties = () => {
    const ids = getRoster().entries.map((e) => e.id);
    if (!loaded) {
      state.parties = (storage && loadParties(storage)) ?? state.parties;
      loaded = true;
    }
    state.parties = reconcile(state.parties, ids);
    if (!state.parties.attackers.length && !state.parties.defenders.length) state.parties = { attackers: [ids[0]!], defenders: [ids[1]!] };
  };
  const setParties = (p: Parties) => {
    state.parties = p;
    if (storage && canSave()) saveParties(storage, p);
    render();
  };
  const members = (side: Side) => (side === 'attacker' ? state.parties.attackers : state.parties.defenders);
  const spec = (): FightSpec => ({ attackers: members('attacker').map(characterById), defenders: members('defender').map(characterById), dice: DICE[state.dice], maxRounds: state.maxRounds });
  /** Plays a fight to the end with random dice, from the given rolls on, recording every roll. */
  const playOut = (s: FightSpec, faces: readonly number[]): number[] => {
    const rolls = replay(faces, dice);
    runFight(s, rolls);
    return rolls.faces;
  };
  const startFight = (how: 'auto' | 'step' | 'simulate') => {
    const s = spec();
    state.fight = { spec: s, faces: how === 'step' ? [] : playOut(s, []) };
    state.tally = how === 'simulate' ? tallyFights(s, dice, RUNS) : null;
    state.view = 'fight';
    render();
  };
  const setFaces = (faces: number[]) => {
    state.fight = { ...state.fight!, faces };
    render();
  };

  const guide = (dice: Dice) =>
    h('details', { class: 'guide' }, h('summary', {}, 'How a fight works'),
      h('ul', {},
        h('li', {}, 'Everyone rolls Initiative. The highest acts first, and so on down (on a tie, the right side first). This order is used every round.'),
        h('li', {}, `On their turn, each fighter attacks a random enemy who is still fighting: ${dice.name} + Attack against the target’s Defence. Meeting or beating it is a hit for their Damage (at least 1).`),
        h('li', {}, dice.count === 1 && dice.sides === 20
          ? 'A natural 20 always hits and is a critical hit: the damage dice are rolled twice. A natural 1 always misses.'
          : `The highest possible roll (${dice.count * dice.sides}) always hits and is a critical hit: the damage dice are rolled twice. The lowest (${dice.count}) always misses.`),
        h('li', {}, 'Ganging up: if someone on your side has already attacked a target this round, your attack on them has advantage (the dice are rolled twice and the higher result counts).'),
        h('li', {}, `Hit points are ${BASE_HIT_POINTS} + Constitution modifier, plus the proficiency bonus if trained in Toughness. At 0 a fighter is knocked out.`),
        h('li', {}, `Nerve: a fighter makes one nerve check (${dice.name} + Nerve, DC ${NERVE_DC.hurt}) the first time they drop to half HP, and everyone left on a side makes one (DC ${NERVE_DC['allies-down']}) the first time half of that side is out. Failing takes them out: a timid or cautious fighter flees; otherwise they surrender (right side) or back off (left side).`),
        h('li', {}, 'A side loses when nobody on it is still fighting. If both sides are still fighting at the round limit, it is a stalemate.')));

  /** How the fight is likely to go for the left side, in words, estimated from simulated fights. */
  const ASSESSMENT_RUNS = 2000;
  const assessmentBox = h('div', { class: 'assessment' });
  function refreshAssessment() {
    if (!canFight(state.parties)) return;
    const risk = describeRisk(assessFight(spec(), ASSESSMENT_RUNS));
    assessmentBox.replaceChildren(
      h('h3', {}, 'How it is likely to go for the left side'),
      h('ul', {}, ...[risk.outcome, risk.hurt, risk.nerve, risk.mostAtRisk].filter((line): line is string => line !== null).map((line) => h('li', {}, line))),
      hint(`Estimated from ${ASSESSMENT_RUNS.toLocaleString()} simulated fights with this line-up.`));
  }

  function renderSetup() {
    refreshAssessment();
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
      ...(ready ? [assessmentBox] : []),
      h('details', { class: 'guide' }, h('summary', {}, `Options: round limit ${state.maxRounds}, ${state.dice}`),
        slider('Round limit', state.maxRounds, 1, 30, (v) => { state.maxRounds = v; refreshAssessment(); }, String, 'The fight is a stalemate if both sides are still fighting after this many rounds.'),
        h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description))),
      guide(DICE[state.dice]),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', disabled: !ready, onclick: () => startFight('auto') }, 'Auto fight'),
        h('button', { type: 'button', disabled: !ready, onclick: () => startFight('step') }, 'Step through'),
        h('button', { type: 'button', disabled: !ready, onclick: () => startFight('simulate') }, `Simulate ${RUNS.toLocaleString()} fights`),
        ready ? null : h('span', { class: 'hint' }, 'Put at least one character on each side.')),
    );
  }

  /**
   * Where each whole roll starts in a fight's faces: a roll of several dice (3d6, or 2d4 on a critical hit) is one roll,
   * chosen or rolled as a total and undone together.
   */
  const rollStarts = (s: FightSpec, faces: readonly number[]): number[] =>
    faces.map((_, i) => i).filter((i) => {
      const step = stepFight(s, faces.slice(0, i));
      return !step.done && step.request.reason.die === 1;
    });
  /** The faces with the last whole roll removed. */
  const backOneRoll = (s: FightSpec, faces: readonly number[]) => faces.slice(0, rollStarts(s, faces).at(-1) ?? 0);

  /** The roll the fight is waiting for: what it is, and buttons to roll it, choose its result, go back or finish. */
  function rollPanel(request: RollRequest, fighters: readonly Fighter[], s: FightSpec, faces: number[]): HTMLElement {
    const fightDice = s.dice ?? DICE.d20;
    const r = request.reason;
    const name = (id: string) => fighters.find((f) => f.id === id)!.character.name;
    // One choice per possible result of the whole roll (the totals of all its dice), marked where it would succeed.
    const choices = rollOdds(request, fighters, fightDice).bars;
    const choose = (result: number) => setFaces([...faces, ...facesForResult(request, result)]);
    const label = (total: number) => (r.kind === 'target' ? `${total}: ${name(r.options[total - 1]!)}` : String(total));
    const buttons = choices.map((c) =>
      h('button', { type: 'button', class: `face${c.success === true ? ' good' : c.success === false ? ' bad' : ''}`, onclick: () => choose(c.dice) }, label(c.dice)));
    const show = (index: number, landed = false) =>
      buttons.forEach((b, i) => {
        b.classList.toggle('showing', i === index);
        b.classList.toggle('landed', landed && i === index);
      });

    /** Rolls all the dice at once, then sweeps left to right along the choices like a roulette wheel, slowing down onto the result. */
    const animatedRoll = async () => {
      const rolled = Array.from({ length: r.of }, () => dice.roll(request.sides, r));
      const result = choices.findIndex((c) => c.dice === resultOf(request, rolled));
      if (!reduceMotion()) {
        for (const b of panel.querySelectorAll('button')) b.disabled = true;
        const sequence = sweepSequence(choices.length, showDice.roll(choices.length), result + 1, Math.max(SWEEP_MIN_STEPS, choices.length + 4));
        const delays = slowingDelays(sequence.length, SWEEP_MS);
        for (const [i, position] of sequence.entries()) {
          show(position - 1);
          await wait(delays[i]!);
        }
        show(result, true);
        await wait(SETTLE_MS);
      }
      setFaces([...faces, ...rolled]);
    };

    const panel = h('div', { class: 'roll-panel' },
      h('div', { class: 'roll-count' }, `Roll ${rollStarts(s, faces).length + 1}`),
      h('p', { class: 'prompt' }, describeRollRequest(request, fighters, fightDice)),
      breakdown(request, fighters, fightDice),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', onclick: () => void animatedRoll() }, 'Roll'),
        h('button', { type: 'button', onclick: () => setFaces(playOut(s, faces)) }, 'Play the rest'),
        h('button', { type: 'button', disabled: faces.length === 0, onclick: () => setFaces(backOneRoll(s, faces)) }, 'Back'),
        h('button', { type: 'button', 'aria-pressed': String(state.showOdds), onclick: () => { state.showOdds = !state.showOdds; render(); } }, state.showOdds ? 'Hide odds' : 'Show odds')),
      h('div', { class: 'hint' }, r.kind === 'attack' && r.edge === 'advantage' ? 'Or choose the higher of the two results:' : r.of > 1 ? `Or choose the total of the ${r.of} dice:` : 'Or choose the result:'),
      h('div', { class: 'faces' }, ...buttons),
      state.showOdds ? oddsView(rollOdds(request, fighters, fightDice), request) : null,
    );
    return panel;
  }

  /** What a roll is for and where its numbers come from: the roller's bonus and, for an attack, the target's Defence. */
  function breakdown(request: RollRequest, fighters: readonly Fighter[], dice: Dice): HTMLElement {
    const e = explainRoll(request, fighters, dice);
    const r = request.reason;
    const who = fighters.find((f) => f.id === r.id)!.character.name;
    const kind = { initiative: 'initiative bonus', attack: 'attack bonus', damage: 'damage bonus', nerve: 'nerve bonus', target: '' }[r.kind];
    const parts = (mods: readonly { value: number; reason: string }[]) => mods.map(describeModifier).join(', ');
    return h('div', { class: 'breakdown' },
      h('p', { class: 'hint' }, e.purpose),
      e.bonus.length ? h('div', {}, h('strong', {}, `${who}’s ${kind} ${signed(bonusOf(e.bonus))}: `), parts(e.bonus)) : null,
      e.against
        ? h('div', {}, h('strong', {}, `${e.against.label} ${e.against.total}: `),
            [`${e.against.parts[0]!.value} ${e.against.parts[0]!.reason.toLowerCase()}`, parts(e.against.parts.slice(1))].filter(Boolean).join(', '))
        : null);
  }

  /** The odds of the roll: a bar for every possible result, then the averages and chances in words. */
  function oddsView(o: RollOdds, request: RollRequest): HTMLElement {
    const r = request.reason;
    const n = (x: number) => String(Number(x.toFixed(1)));
    const tallest = Math.max(...o.bars.map((b) => b.probability));
    const lines: string[] = [];
    if (o.success) lines.push(`Chance ${o.success.label}: ${percent(o.success.chance)}${o.critical !== null ? ` (critical hit: ${percent(o.critical)})` : ''}.`);
    if (r.kind === 'target') lines.push(`Each is equally likely (${percent(1 / o.bars.length)}).`);
    else if (r.kind === 'damage') lines.push(`Average damage: ${n(o.average)} (from ${o.bars[0]!.total} to ${o.bars.at(-1)!.total}).`);
    else lines.push(`Average total: ${n(o.average)}.`);
    if (o.damage) {
      lines.push(`Damage if it hits: ${n(o.damage.average)} on average (${n(o.damage.criticalAverage)} on a critical hit).`);
      lines.push(`Expected damage from this attack: ${n(o.damage.expected)}.`);
    }
    return h('div', { class: 'odds-view' },
      h('div', { class: 'odds-chart', role: 'img', 'aria-label': o.bars.map((b) => `${b.dice}: ${percent(b.probability)}`).join(', ') },
        ...o.bars.map((b) =>
          h('div', { class: 'odds-col', title: `Roll ${b.dice}${b.total !== b.dice ? `, total ${b.total}` : ''}: ${percent(b.probability)}` },
            h('div', { class: 'odds-bar-wrap' }, h('div', { class: `odds-bar${b.success === true ? ' good' : b.success === false ? ' bad' : ''}`, style: `height:${(b.probability / tallest) * 100}%` })),
            h('div', { class: 'odds-label' }, String(b.dice))))),
      h('ul', { class: 'odds-lines' }, ...lines.map((l) => h('li', {}, l))),
    );
  }

  function renderFight() {
    const { spec: s, faces } = state.fight!;
    const step = stepFight(s, faces);
    const events = step.done ? step.result.events : step.events;
    const fighters = step.done ? step.result.fighters : step.fighters;
    const names = (side: Side) => fighters.filter((f) => f.side === side).map((f) => f.character.name).join(', ');
    const lastRound = events.reduce((n, e) => ('round' in e ? Math.max(n, e.round) : n), 0);
    const status = step.done
      ? step.result.winner ? `${SIDE_TITLE[step.result.winner]} wins after ${step.result.rounds} ${step.result.rounds === 1 ? 'round' : 'rounds'}.` : `Stalemate after ${step.result.rounds} rounds.`
      : step.round ? `In progress: round ${step.round}.` : 'In progress: rolling initiative.';

    // The log: the turn order, then each round's lines under a heading.
    const forLog = { events, fighters, winner: null, rounds: lastRound };
    const rounds = new Map<number, FightEvent[]>();
    for (const e of events) if (e.kind !== 'initiative' && e.kind !== 'end') rounds.set(e.round, [...(rounds.get(e.round) ?? []), e]);
    const nameOf = (id: string) => fighters.find((f) => f.id === id)!.character.name;
    const row = (e: FightEvent) =>
      h('tr', { class: `ev-${e.kind}` }, h('td', { class: 'action' }, describeFightEvent(e, forLog, { rolls: false })),
        h('td', { class: 'dice' }, ...eventDice(e, nameOf).map((d) => h('div', {}, d))));
    const initiative = events.find((e) => e.kind === 'initiative');

    root.replaceChildren(
      h('div', { class: 'fight-head' },
        h('h2', { id: 'fight-title' }, `${names('attacker')} vs ${names('defender')}`),
        h('div', { class: 'row' },
          ...(step.done
            ? [
                h('button', { type: 'button', class: 'primary', onclick: () => startFight('auto') }, 'Auto fight again'),
                h('button', { type: 'button', onclick: () => startFight('step') }, 'Step through again'),
                h('button', { type: 'button', onclick: () => setFaces(backOneRoll(s, faces)) }, 'Back one roll'),
                h('button', { type: 'button', onclick: () => startFight('simulate') }, `Simulate ${RUNS.toLocaleString()} fights`),
              ]
            : []),
          h('button', { type: 'button', onclick: () => { state.view = 'setup'; render(); } }, 'Change line-up'))),
      h('p', { class: 'result' }, status),
      h('div', { class: 'grid two sides' }, ...SIDES.map((side) =>
        h('div', { class: 'side' }, h('h3', {}, SIDE_TITLE[side]),
          ...fighters.filter((f) => f.side === side).map((f) => fighterCard(f.character, { result: { hp: f.hp, status: f.status } }))))),
      ...(step.done ? [] : [rollPanel(step.request, fighters, s, faces)]),
      ...(state.tally ? [tallyView(fighters)] : []),
      h('h3', {}, 'Log'),
      events.length
        ? h('table', { class: 'fight-log' },
            h('thead', {}, h('tr', {}, h('th', {}, 'What happened'), h('th', { class: 'dice' }, 'Dice'))),
            ...(initiative ? [h('tbody', {}, row(initiative))] : []),
            ...[...rounds].map(([round, roundEvents]) =>
              h('tbody', {}, h('tr', { class: 'round-head' }, h('td', { colspan: 2 }, `Round ${round}`)), ...roundEvents.map(row))))
        : hint('Nothing has happened yet: everyone is rolling initiative.'),
    );
  }

  function tallyView(fighters: readonly Fighter[]): HTMLElement {
    const t = state.tally!;
    const share = (n: number) => percent(n / RUNS);
    return h('div', { class: 'simulation' },
      h('h3', {}, `${RUNS.toLocaleString()} simulated fights`),
      h('p', { class: 'result' }, [...SIDES.map((side) => `${SIDE_TITLE[side]} wins ${share(t.wins[side])}`), ...(t.wins.stalemate ? [`stalemate ${share(t.wins.stalemate)}`] : [])].join(' · ')),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'How each fighter ended up'), h('th', { class: 'num' }, 'Still fighting'), h('th', { class: 'num' }, 'Knocked out'), h('th', { class: 'num' }, 'Lost their nerve'))),
        h('tbody', {},
          ...fighters.map((f) => {
            const s = t.statuses[f.id]!;
            return h('tr', {}, h('td', {}, `${f.character.name} `, h('span', { class: 'muted' }, f.side === 'attacker' ? '(left)' : '(right)')),
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
