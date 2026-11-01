// Skill check tab: a character's skill against a DC or against an opponent's skill, with every modifier listed.
import { checkOdds, opposedOdds, resolveCheck, resolveOpposed, type Outcome, type Roll } from '../src/check';
import { rollFor } from '../src/character';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeCheck, describeOpposed, signed } from '../src/explain';
import { roller, seeded } from '../src/random';
import { SKILLS, SKILL_INFO, type Skill } from '../src/skills';
import { SITUATIONS, type Situation } from '../src/temperament';
import { h, segmented, slider } from './dom';
import { sideSelect } from './pickers';
import { sideCharacter } from './store';
import { modifiersView, oddsView, outcomeTag, type Panel } from './views';

interface State {
  dice: DiceName;
  skill: Skill;
  situations: Situation[];
  against: 'dc' | 'opponent';
  dc: number;
  opponentSkill: Skill;
  opponentSituations: Situation[];
  situational: number;
  log: { text: string; outcome: Outcome }[];
}

export function checkPanel(): Panel {
  const state: State = {
    dice: 'd20', skill: 'intimidation', situations: ['intimidate'], against: 'opponent', dc: 12,
    opponentSkill: 'nerve', opponentSituations: ['hold-nerve', 'resist-intimidation'], situational: 0, log: [],
  };
  const dice = roller(seeded(7));
  const root = h('section', { class: 'panel', id: 'check', 'aria-labelledby': 'check-title' });
  const results = h('div');

  const active = (): Roll => rollFor(sideCharacter('attacker'), state.skill, {
    dice: DICE[state.dice], situations: state.situations, modifiers: state.situational ? [{ value: state.situational, reason: 'Situational' }] : [],
  });
  const opponent = (): Roll => rollFor(sideCharacter('defender'), state.opponentSkill, { dice: DICE[state.dice], situations: state.opponentSituations });

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
        modifiersView(`${sideCharacter('attacker').name}: ${SKILL_INFO[state.skill].name}`, active().modifiers),
        state.against === 'opponent'
          ? modifiersView(`${sideCharacter('defender').name}: ${SKILL_INFO[state.opponentSkill].name}`, opponent().modifiers)
          : h('div', { class: 'muted' }, `DC ${state.dc}`),
      ),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: roll }, 'Roll')),
      h('ol', { class: 'log' }, ...state.log.map((l) => h('li', {}, outcomeTag(l.outcome), l.text))),
    );
  }

  const skillSelect = (value: Skill, set: (s: Skill) => void, label: string) =>
    h('select', { 'aria-label': label, onchange: (e: Event) => { set((e.target as HTMLSelectElement).value as Skill); renderResults(); } },
      ...SKILLS.map((s) => h('option', { value: s, selected: s === value }, SKILL_INFO[s].name)));

  const situationBoxes = (chosen: Situation[], label: string) => {
    const summary = h('summary', {});
    const describe = () => (summary.textContent = `${label} (${chosen.length ? chosen.join(', ') : 'none'})`);
    describe();
    return h('details', { class: 'situations' }, summary,
      ...SITUATIONS.map((s) => h('label', {}, h('input', { type: 'checkbox', checked: chosen.includes(s), onchange: (e: Event) => {
        const on = (e.target as HTMLInputElement).checked;
        const i = chosen.indexOf(s);
        if (on && i < 0) chosen.push(s);
        if (!on && i >= 0) chosen.splice(i, 1);
        describe();
        renderResults();
      } }), ' ', s)));
  };

  function render() {
    root.replaceChildren(
      h('h2', { id: 'check-title' }, 'Skill check'),
      h('div', { class: 'grid' },
        h('div', {},
          sideSelect('attacker', 'Character'),
          h('label', { class: 'field' }, h('span', {}, 'Skill'), skillSelect(state.skill, (s) => (state.skill = s), 'Skill')),
          h('div', { class: 'field' }, h('span', {}, 'Against'), segmented(['dc', 'opponent'] as const, state.against, (a) => { state.against = a; render(); },
            (a) => (a === 'dc' ? 'DC' : 'Opponent'))),
          state.against === 'dc'
            ? slider('DC', state.dc, 0, 30, (v) => { state.dc = v; renderResults(); })
            : h('div', {},
                sideSelect('defender', 'Opponent'),
                h('label', { class: 'field' }, h('span', {}, 'Opponent skill'), skillSelect(state.opponentSkill, (s) => (state.opponentSkill = s), 'Opponent skill'))),
          h('h3', {}, 'Options'),
          slider('Situational modifier', state.situational, -5, 5, (v) => { state.situational = v; renderResults(); }, signed),
          h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); })),
          situationBoxes(state.situations, 'Temperament situations'),
          state.against === 'opponent' ? situationBoxes(state.opponentSituations, 'Opponent temperament situations') : null,
        ),
        results,
      ),
    );
    renderResults();
  }

  return { element: root, render };
}
