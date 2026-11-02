// Skill check tab: either a social action (intimidate, persuade, deceive) with the meaning and exact chance of each result,
// or any skill against a DC or an opponent's skill. Every modifier is listed.
import { OUTCOME_INFO, checkOdds, opposedOdds, resolveCheck, resolveOpposed, type Outcome, type Roll } from '../src/check';
import { rollFor } from '../src/character';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeCheck, describeOpposed, percent, signed } from '../src/explain';
import { NERVE_DC, nerveCheckSpec } from '../src/nerve';
import { SOCIAL_ACTIONS, SOCIAL_ACTION_INFO, describeEnding, describeSocial, endingOf, goesAlong, resolveSocial, socialOdds, socialRolls, type SocialAction, type SocialChance, type SocialEnding, type SocialSpec } from '../src/social';
import { SKILLS, SKILL_INFO, type Skill } from '../src/skills';
import { ATTRIBUTE_INFO } from '../src/attributes';
import { attributesFor } from '../src/skills';
import { SITUATIONS, SITUATION_INFO, type Situation } from '../src/temperament';
import { checkedOf, h, segmented, slider, valueOf } from './dom';
import { roleSelect } from './pickers';
import { roleCharacter } from './store';
import { hint, modifiersView, oddsView, outcomeGuide, type Panel } from './views';
import { newDice } from './rolling';

type Mode = 'skill' | SocialAction;
const MODES: readonly Mode[] = [...SOCIAL_ACTIONS, 'skill'];

interface State {
  mode: Mode;
  armed: boolean;
  dice: DiceName;
  skill: Skill;
  situations: Situation[];
  against: 'dc' | 'opponent';
  dc: number;
  opponentSkill: Skill;
  opponentSituations: Situation[];
  situational: number;
  log: { text: string; tag: string; label: string }[];
}

/** Endings in the order shown: failing the nerve check first, then the check from best to worst, then a provoked fight. */
function byKind(odds: readonly SocialChance[]): SocialChance[] {
  const of = (kind: SocialEnding['kind']) => odds.filter((c) => c.ending.kind === kind);
  return [...of('nerve'), ...of('check').reverse(), ...of('provoked')];
}

/** The colour class and label for how a social action ended. */
function endingTag(ending: SocialEnding): { tag: string; label: string } {
  if (ending.kind === 'check') return { tag: `o-${ending.outcome}`, label: OUTCOME_INFO[ending.outcome].name.toLowerCase() };
  if (ending.kind === 'provoked' || ending.response === 'fights') return { tag: 'o-critical-failure', label: 'fight' };
  return ending.response === 'yields' ? { tag: 'o-success', label: 'gave in to the weapon' } : { tag: 'o-partial', label: 'fled' };
}

export function checkPanel(): Panel {
  const state: State = {
    mode: 'intimidate', armed: false, dice: 'd20', skill: 'stealth', situations: ['intimidate'], against: 'opponent', dc: 12,
    opponentSkill: 'notice', opponentSituations: [], situational: 0, log: [],
  };
  const dice = newDice();
  const root = h('section', { class: 'panel', id: 'check', 'aria-labelledby': 'check-title' });
  const results = h('div');

  const active = (): Roll => rollFor(roleCharacter('actor'), state.skill, {
    dice: DICE[state.dice], situations: state.situations, modifiers: state.situational ? [{ value: state.situational, reason: 'Situational' }] : [],
  });
  const opponent = (): Roll => rollFor(roleCharacter('target'), state.opponentSkill, { dice: DICE[state.dice], situations: state.opponentSituations });

  const social = (action: SocialAction): SocialSpec => ({
    actor: roleCharacter('actor'), target: roleCharacter('target'), action, armed: action === 'intimidate' && state.armed, dice: DICE[state.dice],
    modifiers: state.situational ? [{ value: state.situational, reason: 'Situational' }] : [],
  });
  const outcomeLog = (text: string, outcome: Outcome) => ({ text, tag: `o-${outcome}`, label: OUTCOME_INFO[outcome].name.toLowerCase() });

  function roll() {
    if (state.mode !== 'skill') {
      const r = resolveSocial(social(state.mode), dice);
      state.log.unshift({ text: describeSocial(r), ...endingTag(endingOf(r)) });
    } else if (state.against === 'dc') {
      const r = resolveCheck({ ...active(), dc: state.dc }, dice);
      state.log.unshift(outcomeLog(describeCheck(r), r.outcome));
    } else {
      const r = resolveOpposed({ active: active(), passive: opponent() }, dice);
      state.log.unshift(outcomeLog(describeOpposed(r), r.outcome));
    }
    state.log.length = Math.min(state.log.length, 20);
    renderResults();
  }

  const logView = () => h('ol', { class: 'log' }, ...state.log.map((l) => h('li', {}, h('span', { class: `tag ${l.tag}` }, l.label), l.text)));

  function renderSocialResults(action: SocialAction) {
    const s = social(action);
    const info = SOCIAL_ACTION_INFO[action];
    const odds = socialOdds(s);
    const target = s.target.name;
    const nerveSpec = nerveCheckSpec(s.target, 'weapon-drawn', DICE[state.dice]);
    const { active, passive } = socialRolls(s);
    results.replaceChildren(
      h('div', { class: 'headline' }, percent(goesAlong(odds)), ' ', h('small', {}, `chance ${target} goes along with it`)),
      h('table', { class: 'social-odds' }, h('tbody', {}, ...byKind(odds).map(({ ending, chance }) =>
        h('tr', {}, h('td', {}, h('i', { class: `swatch ${endingTag(ending).tag}` })), h('td', {}, describeEnding(ending, action)), h('td', { class: 'num' }, percent(chance)))))),
      h('div', { class: 'grid' },
        modifiersView(`${s.actor.name}: ${SKILL_INFO[info.skill].name}${s.armed ? ' (with advantage)' : ''}`, active.modifiers),
        modifiersView(`${target}: ${SKILL_INFO[info.resist].name}`, passive.modifiers),
        s.armed ? modifiersView(`${target}: nerve check against the weapon (DC ${NERVE_DC['weapon-drawn']})`, nerveSpec.modifiers) : null,
      ),
      outcomeGuide(),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: roll }, 'Roll')),
      logView(),
    );
  }

  function renderResults() {
    if (state.mode !== 'skill') return renderSocialResults(state.mode);
    const odds = state.against === 'dc' ? checkOdds({ ...active(), dc: state.dc }) : opposedOdds({ active: active(), passive: opponent() });
    results.replaceChildren(
      oddsView(odds),
      h('div', { class: 'grid' },
        modifiersView(`${roleCharacter('actor').name}: ${SKILL_INFO[state.skill].name}`, active().modifiers),
        state.against === 'opponent'
          ? modifiersView(`${roleCharacter('target').name}: ${SKILL_INFO[state.opponentSkill].name}`, opponent().modifiers)
          : h('div', { class: 'muted' }, `DC ${state.dc}`),
      ),
      outcomeGuide(),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: roll }, 'Roll')),
      logView(),
    );
  }

  const skillSelect = (value: Skill, set: (s: Skill) => void, label: string) =>
    h('select', { 'aria-label': label, onchange: (e: Event) => { set(valueOf(e) as Skill); renderResults(); } },
      ...SKILLS.map((s) => h('option', { value: s, selected: s === value }, SKILL_INFO[s].name)));

  const situationBoxes = (chosen: Situation[], label: string) => {
    const summary = h('summary', {});
    const describe = () => (summary.textContent = `${label} (${chosen.length ? chosen.map((c) => SITUATION_INFO[c].name.toLowerCase()).join(', ') : 'none'})`);
    describe();
    return h('details', { class: 'situations' }, summary,
      ...SITUATIONS.map((s) => h('label', {}, h('input', { type: 'checkbox', checked: chosen.includes(s), onchange: (e: Event) => {
        const on = checkedOf(e);
        const i = chosen.indexOf(s);
        if (on && i < 0) chosen.push(s);
        if (!on && i >= 0) chosen.splice(i, 1);
        describe();
        renderResults();
      } }), ' ', SITUATION_INFO[s].name, h('span', { class: 'hint' }, ` – ${SITUATION_INFO[s].description}`))),
      hint('Ticked situations apply the character’s temperament modifiers (e.g. a proud character resisting intimidation gets +2).'));
  };

  const skillHint = (s: Skill) => `${SKILL_INFO[s].covers} Based on ${attributesFor(s).map((a) => ATTRIBUTE_INFO[a].name).join(' or ')}.`;

  const modeLabel = (m: Mode) => (m === 'skill' ? 'Any skill' : SOCIAL_ACTION_INFO[m].name);

  function renderSocialControls(action: SocialAction): HTMLElement {
    return h('div', {},
      roleSelect('actor', 'Character'),
      roleSelect('target', 'Target'),
      action === 'intimidate'
        ? h('label', { class: 'field checkbox' },
            h('span', {}, h('input', { type: 'checkbox', checked: state.armed, onchange: (e: Event) => { state.armed = checkedOf(e); renderResults(); } }), ' Armed: draws a weapon'),
            hint(`The target first makes a DC ${NERVE_DC['weapon-drawn']} nerve check. If they fail, they give in at once, run, or (if hot-tempered) fight back. If they hold, the intimidation is rolled with advantage.`))
        : null,
      h('h3', {}, 'Options'),
      slider('Situational modifier', state.situational, -5, 5, (v) => { state.situational = v; renderResults(); }, signed,
        'Any other bonus or penalty for the character, e.g. +2 for leverage over the target, −2 for being outnumbered.'),
      h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description)),
    );
  }

  function renderSkillControls(): HTMLElement {
    return h('div', {},
      roleSelect('actor', 'Character'),
      h('label', { class: 'field' }, h('span', {}, 'Skill'), skillSelect(state.skill, (s) => { state.skill = s; render(); }, 'Skill'), hint(skillHint(state.skill))),
      h('div', { class: 'field' }, h('span', {}, 'Against'), segmented(['dc', 'opponent'] as const, state.against, (a) => { state.against = a; render(); },
        (a) => (a === 'dc' ? 'DC' : 'Opponent'))),
      state.against === 'dc'
        ? slider('DC', state.dc, 0, 30, (v) => { state.dc = v; renderResults(); }, String,
            'Difficulty class: the total needed. Roughly 10 is easy, 15 moderate, 20 hard, 25 very hard.')
        : h('div', {},
            roleSelect('target', 'Opponent'),
            h('label', { class: 'field' }, h('span', {}, 'Opponent skill'), skillSelect(state.opponentSkill, (s) => { state.opponentSkill = s; render(); }, 'Opponent skill'),
              hint(skillHint(state.opponentSkill))),
            hint('Both roll. The character must beat the opponent’s total; a tie goes to the opponent.')),
      h('h3', {}, 'Options'),
      slider('Situational modifier', state.situational, -5, 5, (v) => { state.situational = v; renderResults(); }, signed,
        'Any other bonus or penalty, e.g. +2 for a good plan, −2 for being outnumbered.'),
      h('div', { class: 'field' }, h('span', {}, 'Dice'), segmented(DICE_NAMES, state.dice, (d) => { state.dice = d; render(); }), hint(DICE[state.dice].description)),
      situationBoxes(state.situations, 'Temperament situations'),
      state.against === 'opponent' ? situationBoxes(state.opponentSituations, 'Opponent temperament situations') : null,
    );
  }

  function render() {
    const intro = state.mode === 'skill'
      ? 'A single roll: the character’s skill against a fixed difficulty (DC) or against another character’s roll.'
      : SOCIAL_ACTION_INFO[state.mode].description;
    root.replaceChildren(
      h('h2', { id: 'check-title' }, 'Skill check'),
      h('div', { class: 'field' }, h('span', {}, 'What is the character doing?'),
        segmented(MODES, state.mode, (m) => { state.mode = m; state.log = []; render(); }, modeLabel), hint(intro)),
      h('div', { class: 'grid' }, state.mode === 'skill' ? renderSkillControls() : renderSocialControls(state.mode), results),
    );
    renderResults();
  }

  return { element: root, render };
}
