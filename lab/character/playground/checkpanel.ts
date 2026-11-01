// Skill check panel: one character's skill against a DC or against the other character's skill, with every modifier listed.
import { checkOdds, opposedOdds, resolveCheck, resolveOpposed, type Outcome, type Roll } from '../src/check';
import { rollFor } from '../src/character';
import type { Side } from '../src/contest';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeCheck, describeOpposed, signed } from '../src/explain';
import { roller, seeded } from '../src/random';
import { SKILLS, SKILL_INFO, type Skill } from '../src/skills';
import { SITUATIONS, type Situation } from '../src/temperament';
import { h, segmented, slider } from './dom';
import { character, onChange } from './store';
import { modifiersView, oddsView, outcomeTag } from './views';

interface State {
  dice: DiceName;
  roller: Side;
  skill: Skill;
  situations: Situation[];
  against: 'dc' | 'opponent';
  dc: number;
  opponentSkill: Skill;
  opponentSituations: Situation[];
  situational: number;
  log: { text: string; outcome: Outcome }[];
}

export function checkPanel(): HTMLElement {
  const state: State = {
    dice: 'd20', roller: 'attacker', skill: 'intimidation', situations: ['intimidate'], against: 'opponent', dc: 12,
    opponentSkill: 'nerve', opponentSituations: ['hold-nerve', 'resist-intimidation'], situational: 0, log: [],
  };
  const dice = roller(seeded(7));
  const root = h('section', { class: 'panel', id: 'check', 'aria-labelledby': 'check-title' });
  const results = h('div');
  const opponentSide = (): Side => (state.roller === 'attacker' ? 'defender' : 'attacker');

  const active = (): Roll => rollFor(character(state.roller), state.skill, {
    dice: DICE[state.dice], situations: state.situations, modifiers: state.situational ? [{ value: state.situational, reason: 'Situational' }] : [],
  });
  const opponent = (): Roll => rollFor(character(opponentSide()), state.opponentSkill, { dice: DICE[state.dice], situations: state.opponentSituations });

  function roll() {
    if (state.against === 'dc') {
      const r = resolveCheck({ ...active(), dc: state.dc }, dice);
      state.log.unshift({ text: describeCheck(r), outcome: r.outcome });
    } else {
      const r = resolveOpposed({ active: active(), passive: opponent() }, dice);
      state.log.unshift({ text: describeOpposed(r), outcome: r.outcome });
    }
    state.log.length = Math.min(state.log.length, 20);
    renderResults();
  }

  function renderResults() {
    const odds = state.against === 'dc' ? checkOdds({ ...active(), dc: state.dc }) : opposedOdds({ active: active(), passive: opponent() });
    results.replaceChildren(
      oddsView(odds),
      h('div', { class: 'grid' },
        modifiersView(`${character(state.roller).name}: ${SKILL_INFO[state.skill].name}`, active().modifiers),
        state.against === 'opponent'
          ? modifiersView(`${character(opponentSide()).name}: ${SKILL_INFO[state.opponentSkill].name}`, opponent().modifiers)
          : h('div', { class: 'muted' }, `DC ${state.dc}`),
      ),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: roll }, 'Roll')),
      h('ol', { class: 'log' }, ...state.log.map((l) => h('li', {}, outcomeTag(l.outcome), l.text))),
    );
  }

  const skillSelect = (value: Skill, set: (s: Skill) => void, label: string) =>
    h('select', { 'aria-label': label, onchange: (e: Event) => { set((e.target as HTMLSelectElement).value as Skill); renderResults(); } },
      ...SKILLS.map((s) => h('option', { value: s, selected: s === value }, SKILL_INFO[s].name)));

  const situationBoxes = (chosen: Situation[], label: string) =>
    h('fieldset', { class: 'situations' }, h('legend', {}, label),
      ...SITUATIONS.map((s) => h('label', {}, h('input', { type: 'checkbox', checked: chosen.includes(s), onchange: (e: Event) => {
        const on = (e.target as HTMLInputElement).checked;
        const i = chosen.indexOf(s);
        if (on && i < 0) chosen.push(s);
        if (!on && i >= 0) chosen.splice(i, 1);
        renderResults();
      } }), ' ', s)));

  function render() {
    root.replaceChildren(
      h('h2', { id: 'check-title' }, 'Skill check'),
      h('div', { class: 'grid' },
        h('div', {},
          h('div', { class: 'field' }, h('span', {}, 'Roller'), segmented(['attacker', 'defender'] as const, state.roller, (s) => { state.roller = s; render(); }, (s) => character(s).name)),
          h('label', { class: 'field' }, h('span', {}, 'Skill'), skillSelect(state.skill, (s) => (state.skill = s), 'Skill')),
          situationBoxes(state.situations, 'Temperament situations'),
          slider('Situational modifier', state.situational, -5, 5, (v) => { state.situational = v; renderResults(); }, signed),
          h('div', { class: 'field' }, h('span', {}, 'Against'), segmented(['dc', 'opponent'] as const, state.against, (a) => { state.against = a; render(); },
            (a) => (a === 'dc' ? 'DC' : character(opponentSide()).name))),
          state.against === 'dc'
            ? slider('DC', state.dc, 0, 30, (v) => { state.dc = v; renderResults(); })
            : h('div', {},
                h('label', { class: 'field' }, h('span', {}, 'Opponent skill'), skillSelect(state.opponentSkill, (s) => (state.opponentSkill = s), 'Opponent skill')),
                situationBoxes(state.opponentSituations, 'Opponent temperament situations')),
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); })),
        ),
        results,
      ),
    );
    renderResults();
  }

  onChange(() => render());
  render();
  return root;
}
