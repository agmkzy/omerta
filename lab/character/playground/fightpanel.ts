// Fight tab, in two views. A fight is kept as the rolls made so far: Auto plays it out at once, Step through stops at
// every roll so the player can roll or choose the result, Back drops the last roll, and Play the rest finishes it. The
// fight stays when switching tabs.
// Set-up: click characters to add them to the left or right side; each fighter is shown once as a card
// with the numbers the fight uses. Fight: the same cards with how each fighter ended up, then the log, one short line per
// action, grouped by round, with the dice for each line in a column on the right.
import { SIMULATED_FIGHTS, assess, describeRisk, simulateFights, type FightTally } from '../src/assessment';
import { BACKGROUND_INFO } from '../src/backgrounds';
import { BASE_DEFENCE, type Character } from '../src/character';
import { DICE, DICE_NAMES, type Dice, type DiceName } from '../src/dice';
import { compactRoll, describeModifier, describeTotal, percent, signed } from '../src/explain';
import { bonusOf } from '../src/check';
import { DEFAULT_MAX_ROUNDS, FIGHTER_STATUS_INFO, UNARMED_DAMAGE_DIE, fightStats, runFight, type FightEvent, type FightSpec, type FighterStatus, type RollRequest } from '../src/fight';
import { describeFightEvent, describeRollRequest, explainRoll, fightRules, SIDE_NAME } from '../src/fight-log';
import { rollOdds, type RollOdds } from '../src/fight-odds';
import { facesForResult, resultOf, stepFight, withoutLastRoll } from '../src/fight-step';
import type { Side } from '../src/nerve';
import { replay } from '../src/random';
import { notableTraits } from '../src/temperament';
import { slowingDelays, sweepSequence } from './animation';
import { h, segmented, slider } from './dom';
import { assign, canFight, lineUp, type Parties } from './parties';
import { canSave, characterById, getRoster, storage } from './store';
import { hint, type Panel } from './views';
import { newDice } from './rolling';

/** The dice animation, a roulette-style sweep: at least this many steps (and more than once round), over this long, then a short rest on the result. */
const SWEEP_MIN_STEPS = 16;
const SWEEP_MS = 850;
const SETTLE_MS = 1200;
/** How long the round-limit slider must rest before the assessment is worked out again. */
const ASSESSMENT_DELAY_MS = 200;
/** Dice for the animation only (where the sweep starts), kept apart from the fight's dice so it can never change a result. */
const showDice = newDice();
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const SIDES = ['attacker', 'defender'] as const;

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
      status ? h('span', { class: `status status-${status}`, title: FIGHTER_STATUS_INFO[status].explanation }, FIGHTER_STATUS_INFO[status].label) : null,
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
      const { faces, modifier, total, minimumApplied } = e.damage;
      const sum = `${faces.join('+')}${modifier ? ` ${modifier < 0 ? '−' : '+'} ${Math.abs(modifier)}` : ''}`;
      const result = modifier || faces.length > 1 ? `${sum} = ${total}` : sum;
      lines.push(`damage ${faces.length}d${UNARMED_DAMAGE_DIE}: ${result}${minimumApplied ? ' (minimum 1)' : ''}`);
    }
    return lines;
  }
  if (e.kind === 'nerve') return [`${compactRoll(e.check.result.roll)} vs ${e.check.result.dc}`];
  if (e.kind === 'initiative') return e.order.map((o) => `${nameOf(o.id)}: ${compactRoll(o.roll)}`);
  return [];
}

export function fightPanel(): Panel {
  const state: State = { showOdds: false, view: 'setup', parties: { attackers: [], defenders: [] }, dice: 'd20', maxRounds: DEFAULT_MAX_ROUNDS, fight: null, tally: null };
  const dice = newDice();
  const root = h('section', { class: 'panel', id: 'fight', 'aria-labelledby': 'fight-title' });

  // The saved line-up; looking at it never saves, only a change made here does.
  const line = lineUp(storage, canSave);
  const syncParties = () => {
    state.parties = line.current(getRoster().entries.map((e) => e.id));
  };
  const setParties = (p: Parties) => {
    line.set(p);
    state.parties = p;
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
  /** Counts every change to the fight shown, so a roll animation that finishes after the fight changed is ignored. */
  let fightVersion = 0;
  const startFight = (how: 'auto' | 'step' | 'simulate') => {
    const s = spec();
    fightVersion++;
    state.fight = { spec: s, faces: how === 'step' ? [] : playOut(s, []) };
    state.tally = how === 'simulate' ? tallyFor(s) : null;
    state.view = 'fight';
    render();
  };
  const setFaces = (faces: number[]) => {
    if (!state.fight) return;
    fightVersion++;
    state.fight = { ...state.fight, faces };
    render();
  };
  const showSetup = () => {
    fightVersion++;
    state.view = 'setup';
    render();
  };

  /** The simulated fights for a line-up, worked out once for each line-up, dice and round limit (a few hundred milliseconds). */
  let simulated: { readonly key: string; readonly tally: FightTally } | null = null;
  const tallyFor = (s: FightSpec): FightTally => {
    const key = JSON.stringify(s);
    if (simulated?.key !== key) simulated = { key, tally: simulateFights(s) };
    return simulated.tally;
  };

  const guide = (dice: Dice) => {
    const rules = fightRules(dice);
    return h('details', { class: 'guide' }, h('summary', {}, 'How a fight works'),
      h('ul', {}, ...[rules.initiative, rules.attack, `${rules.extremes} ${rules.damage}`, `Ganging up: ${rules.gangingUp.charAt(0).toLowerCase()}${rules.gangingUp.slice(1)}`, rules.hitPoints, `${rules.nerveHurt} ${rules.nerveAlliesDown}`, rules.nerveFailure, rules.end].map((rule) => h('li', {}, rule))));
  };

  /** How the fight is likely to go for the left side, in words, estimated from simulated fights. */
  const assessmentBox = h('div', { class: 'assessment' });
  let assessmentTimer: ReturnType<typeof setTimeout> | undefined;
  function refreshAssessment() {
    if (!canFight(state.parties)) return;
    const risk = describeRisk(assess(tallyFor(spec())));
    assessmentBox.replaceChildren(
      h('h3', {}, 'How it is likely to go for the left side'),
      h('ul', {}, ...[risk.outcome, risk.hurt, risk.nerve, risk.mostAtRisk].filter((line): line is string => line !== null).map((line) => h('li', {}, line))),
      hint(`Estimated from ${SIMULATED_FIGHTS.toLocaleString()} simulated fights with this line-up: the same fights Simulate shows.`));
  }

  function renderSetup() {
    refreshAssessment();
    const inFight = new Set([...state.parties.attackers, ...state.parties.defenders]);
    const available = getRoster().entries.filter((e) => !inFight.has(e.id));
    const ready = canFight(state.parties);
    const lineNote = line.note();
    const optionsText = () => `Options: round limit ${state.maxRounds}, ${state.dice}`;
    const optionsSummary = h('summary', {}, optionsText());
    const sideColumn = (side: Side) =>
      h('div', { class: 'side' },
        h('h3', {}, `${SIDE_NAME[side]} ${side === 'attacker' ? '(attackers)' : '(defenders)'}`),
        ...members(side).map((id) => fighterCard(characterById(id), { onRemove: () => setParties(assign(state.parties, id, null)) })),
        members(side).length ? null : hint('Nobody yet.'),
        available.length
          ? h('div', { class: 'add' }, h('span', { class: 'hint' }, `Add to ${SIDE_NAME[side]}:`),
              h('div', { class: 'chips' }, ...available.map((e) => h('button', { type: 'button', class: 'chip', onclick: () => setParties(assign(state.parties, e.id, side)) }, `+ ${e.character.name}`))))
          : null);
    root.replaceChildren(
      h('h2', { id: 'fight-title' }, 'Fight set-up'),
      hint(available.length ? 'Click a name to add that character to a side, or × to remove them.' : 'Everyone saved is already in the fight. Create more characters in the Characters tab.'),
      h('div', { class: 'grid two sides' }, sideColumn('attacker'), sideColumn('defender')),
      ...(lineNote ? [h('p', { class: 'warning small', role: 'status' }, lineNote)] : []),
      ...(ready ? [assessmentBox] : []),
      h('details', { class: 'guide' }, optionsSummary,
        slider('Round limit', state.maxRounds, 1, 30, (v) => {
          state.maxRounds = v;
          optionsSummary.textContent = optionsText();
          // Working out the assessment takes a moment, so wait until the slider stops moving.
          clearTimeout(assessmentTimer);
          assessmentTimer = setTimeout(refreshAssessment, ASSESSMENT_DELAY_MS);
        }, String, 'The fight is a stalemate if both sides are still fighting after this many rounds.'),
        h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description))),
      guide(DICE[state.dice]),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', disabled: !ready, onclick: () => startFight('auto') }, 'Auto fight'),
        h('button', { type: 'button', disabled: !ready, onclick: () => startFight('step') }, 'Step through'),
        h('button', { type: 'button', disabled: !ready, onclick: () => startFight('simulate') }, `Simulate ${SIMULATED_FIGHTS.toLocaleString()} fights`),
        ready ? null : h('span', { class: 'hint' }, 'Put at least one character on each side.')),
    );
  }

  /** The roll the fight is waiting for: what it is, and buttons to roll it, choose its result, go back or finish. */
  function rollPanel(request: RollRequest, s: FightSpec, faces: number[], rollsMade: number): HTMLElement {
    const r = request.reason;
    // One choice per possible result of the whole roll (the totals of all its dice), marked where it would succeed.
    const odds = rollOdds(request);
    const choices = odds.bars;
    const choose = (result: number) => setFaces([...faces, ...facesForResult(request, result)]);
    const label = (result: number) => (r.kind === 'target' ? `${result}: ${r.options[result - 1]?.name}` : String(result));
    const buttons = choices.map((c) =>
      h('button', { type: 'button', class: `face${c.success === true ? ' good' : c.success === false ? ' bad' : ''}`, onclick: () => choose(c.result) }, label(c.result)));
    const show = (index: number, landed = false) =>
      buttons.forEach((b, i) => {
        b.classList.toggle('showing', i === index);
        b.classList.toggle('landed', landed && i === index);
      });

    /** Rolls all the dice at once, then sweeps left to right along the choices like a roulette wheel, slowing down onto the result. */
    const animatedRoll = async () => {
      const version = fightVersion;
      const rolled = Array.from({ length: r.of }, () => dice.roll(request.sides, r));
      const result = choices.findIndex((c) => c.result === resultOf(request, rolled));
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
      if (version === fightVersion) setFaces([...faces, ...rolled]);
    };

    const panel = h('div', { class: 'roll-panel' },
      h('div', { class: 'roll-count' }, `Roll ${rollsMade + 1}`),
      h('p', { class: 'prompt' }, describeRollRequest(request)),
      breakdown(request),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', onclick: () => void animatedRoll() }, 'Roll'),
        h('button', { type: 'button', onclick: () => setFaces(playOut(s, faces)) }, 'Play the rest'),
        h('button', { type: 'button', disabled: faces.length === 0, onclick: () => setFaces(withoutLastRoll(s, faces)) }, 'Back'),
        h('button', { type: 'button', 'aria-pressed': String(state.showOdds), onclick: () => { state.showOdds = !state.showOdds; render(); } }, state.showOdds ? 'Hide odds' : 'Show odds')),
      h('div', { class: 'hint' }, r.kind === 'attack' && r.edge === 'advantage' ? 'Or choose the higher of the two results:' : r.of > 1 ? `Or choose the total of the ${r.of} dice:` : 'Or choose the result:'),
      h('div', { class: 'faces' }, ...buttons),
      state.showOdds ? oddsView(odds, request) : null,
    );
    return panel;
  }

  /** What a roll is for and where its numbers come from: the roller's bonus and, for an attack, the target's Defence. */
  function breakdown(request: RollRequest): HTMLElement {
    const e = explainRoll(request);
    return h('div', { class: 'breakdown' },
      h('p', { class: 'hint' }, e.purpose),
      e.bonusLabel && e.bonus.length ? h('div', {}, h('strong', {}, `${e.bonusLabel} ${signed(bonusOf(e.bonus))}: `), e.bonus.map(describeModifier).join(', ')) : null,
      e.against ? h('div', {}, h('strong', {}, `${e.against.label} ${e.against.total}: `), describeTotal(e.against.parts)) : null);
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
      h('div', { class: 'odds-chart', role: 'img', 'aria-label': o.bars.map((b) => `${b.result}: ${percent(b.probability)}`).join(', ') },
        ...o.bars.map((b) =>
          h('div', { class: 'odds-col', title: `Roll ${b.result}${b.total !== b.result ? `, total ${b.total}` : ''}: ${percent(b.probability)}` },
            h('div', { class: 'odds-bar-wrap' }, h('div', { class: `odds-bar${b.success === true ? ' good' : b.success === false ? ' bad' : ''}`, style: `height:${(b.probability / tallest) * 100}%` })),
            h('div', { class: 'odds-label' }, String(b.result))))),
      h('ul', { class: 'odds-lines' }, ...lines.map((l) => h('li', {}, l))),
    );
  }

  function renderFight() {
    if (!state.fight) return renderSetup();
    const { spec: s, faces } = state.fight;
    const step = stepFight(s, faces);
    const events = step.done ? step.result.events : step.events;
    const fighters = step.done ? step.result.fighters : step.fighters;
    const sideNames = (side: Side) => fighters.filter((f) => f.side === side).map((f) => f.character.name).join(', ');
    const status = step.done
      ? step.result.winner ? `${SIDE_NAME[step.result.winner]} wins after ${step.result.rounds} ${step.result.rounds === 1 ? 'round' : 'rounds'}.` : `Stalemate after ${step.result.rounds} rounds.`
      : step.round ? `In progress: round ${step.round}.` : 'In progress: rolling initiative.';

    // The log: the turn order, then each round's lines under a heading.
    const rounds = new Map<number, FightEvent[]>();
    for (const e of events) if (e.kind !== 'initiative' && e.kind !== 'end') rounds.set(e.round, [...(rounds.get(e.round) ?? []), e]);
    const names = new Map(fighters.map((f) => [f.id, f.character.name]));
    const row = (e: FightEvent) =>
      h('tr', { class: `ev-${e.kind}` }, h('td', { class: 'action' }, describeFightEvent(e, fighters, { rolls: false })),
        h('td', { class: 'dice' }, ...eventDice(e, (id) => names.get(id) ?? id).map((d) => h('div', {}, d))));
    const initiative = events.find((e) => e.kind === 'initiative');

    root.replaceChildren(
      h('div', { class: 'fight-head' },
        h('h2', { id: 'fight-title' }, `${sideNames('attacker')} vs ${sideNames('defender')}`),
        h('div', { class: 'row' },
          ...(step.done
            ? [
                h('button', { type: 'button', class: 'primary', onclick: () => startFight('auto') }, 'Auto fight again'),
                h('button', { type: 'button', onclick: () => startFight('step') }, 'Step through again'),
                h('button', { type: 'button', onclick: () => setFaces(withoutLastRoll(s, faces)) }, 'Back one roll'),
                h('button', { type: 'button', onclick: () => startFight('simulate') }, `Simulate ${SIMULATED_FIGHTS.toLocaleString()} fights`),
              ]
            : []),
          h('button', { type: 'button', onclick: showSetup }, 'Change line-up'))),
      h('p', { class: 'result' }, status),
      h('div', { class: 'grid two sides' }, ...SIDES.map((side) =>
        h('div', { class: 'side' }, h('h3', {}, SIDE_NAME[side]),
          ...fighters.filter((f) => f.side === side).map((f) => fighterCard(f.character, { result: { hp: f.hp, status: f.status } }))))),
      ...(step.done ? [] : [rollPanel(step.request, s, faces, step.rollStarts.length)]),
      ...(state.tally ? [tallyView(state.tally)] : []),
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

  function tallyView(t: FightTally): HTMLElement {
    const share = (n: number) => percent(n / t.runs);
    return h('div', { class: 'simulation' },
      h('h3', {}, `${t.runs.toLocaleString()} simulated fights`),
      h('p', { class: 'result' }, [...SIDES.map((side) => `${SIDE_NAME[side]} wins ${share(t.wins[side])}`), ...(t.wins.stalemate ? [`stalemate ${share(t.wins.stalemate)}`] : [])].join(' · ')),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'How each fighter ended up'), h('th', { class: 'num' }, 'Still fighting'), h('th', { class: 'num' }, 'Knocked out'), h('th', { class: 'num' }, 'Lost their nerve'))),
        h('tbody', {},
          ...t.fighters.map((f) =>
            h('tr', {}, h('td', {}, `${f.name} `, h('span', { class: 'muted' }, `(${SIDE_NAME[f.side].toLowerCase()})`)),
              h('td', { class: 'num' }, share(f.statuses.fighting)), h('td', { class: 'num' }, share(f.statuses['knocked-out'])), h('td', { class: 'num' }, share(f.statuses.surrendered + f.statuses['backed-off'] + f.statuses.fled)))))));
  }

  function render() {
    if (state.view === 'fight') renderFight();
    else renderSetup();
  }

  return {
    element: root,
    // Coming back to the tab keeps the fight shown; the line-up follows any change to the saved characters.
    render() {
      syncParties();
      render();
    },
  };
}
