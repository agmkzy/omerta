// Skill check tab: either a social action (intimidate, persuade, deceive) with the meaning and exact chance of each result,
// or any skill against a DC or an opponent's skill. Every modifier is listed.
import { OUTCOMES, OUTCOME_INFO, checkOdds, opposedOdds, resolveCheck, resolveOpposed, type Outcome, type Roll } from '../src/check';
import { rollFor } from '../src/character';
import { DICE, DICE_NAMES, type DiceName } from '../src/dice';
import { describeCheck, describeOpposed, percent, signed } from '../src/explain';
import { NERVE_DC, nerveCheckSpec } from '../src/nerve';
import { ARMED_NERVE_RESPONSE, PROVOKED, SOCIAL_ACTIONS, SOCIAL_ACTION_INFO, describeSocial, resolveSocial, socialOdds, socialResultKey, type SocialAction, type SocialResultKey, type SocialSpec } from '../src/social';
import { roller, seeded } from '../src/random';
import { SKILLS, SKILL_INFO, type Skill } from '../src/skills';
import { ATTRIBUTE_INFO } from '../src/attributes';
import { attributesFor } from '../src/skills';
import { SITUATIONS, SITUATION_INFO, type Situation } from '../src/temperament';
import { h, segmented, slider } from './dom';
import { sideSelect } from './pickers';
import { sideCharacter } from './store';
import { hint, modifiersView, oddsView, outcomeGuide, type Panel } from './views';

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

/** The colour class and label for a result. */
function resultTag(key: SocialResultKey): { tag: string; label: string } {
  if (key === 'nerve:yields') return { tag: 'o-success', label: 'gave in to the weapon' };
  if (key === 'nerve:flees') return { tag: 'o-partial', label: 'fled' };
  if (key === 'nerve:fights' || key === 'provoked') return { tag: 'o-critical-failure', label: 'fight' };
  return { tag: `o-${key}`, label: OUTCOME_INFO[key].name.toLowerCase() };
}

export function checkPanel(): Panel {
  const state: State = {
    mode: 'intimidate', armed: false, dice: 'd20', skill: 'stealth', situations: ['intimidate'], against: 'opponent', dc: 12,
    opponentSkill: 'notice', opponentSituations: [], situational: 0, log: [],
  };
  const dice = roller(seeded(7));
  const root = h('section', { class: 'panel', id: 'check', 'aria-labelledby': 'check-title' });
  const results = h('div');

  const active = (): Roll => rollFor(sideCharacter('attacker'), state.skill, {
    dice: DICE[state.dice], situations: state.situations, modifiers: state.situational ? [{ value: state.situational, reason: 'Situational' }] : [],
  });
  const opponent = (): Roll => rollFor(sideCharacter('defender'), state.opponentSkill, { dice: DICE[state.dice], situations: state.opponentSituations });

  const social = (action: SocialAction): SocialSpec => ({
    actor: sideCharacter('attacker'), target: sideCharacter('defender'), action, armed: action === 'intimidate' && state.armed, dice: DICE[state.dice],
    modifiers: state.situational ? [{ value: state.situational, reason: 'Situational' }] : [],
  });
  const outcomeLog = (text: string, outcome: Outcome) => ({ text, tag: `o-${outcome}`, label: OUTCOME_INFO[outcome].name.toLowerCase() });

  function roll() {
    if (state.mode !== 'skill') {
      const s = social(state.mode);
      const r = resolveSocial(s, dice);
      state.log.unshift({ text: describeSocial(r, s), ...resultTag(socialResultKey(r.ending)) });
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
    const wins = odds['nerve:yields'] + OUTCOMES.filter((o) => o === 'partial' || o === 'success' || o === 'critical-success').reduce((sum, o) => sum + odds[o], 0);
    const meaning = (key: SocialResultKey): string => {
      if (key === 'nerve:yields' || key === 'nerve:flees' || key === 'nerve:fights') return `Fails the nerve check against the weapon and ${ARMED_NERVE_RESPONSE[key.slice(6) as 'yields']}.`;
      if (key === 'provoked') return `Critical failure: ${PROVOKED} (hot-tempered).`;
      return `${OUTCOME_INFO[key].name}: ${info.outcomes[key]}.`;
    };
    const nerveKeys: SocialResultKey[] = s.armed ? ['nerve:yields', 'nerve:flees', 'nerve:fights'] : [];
    const keys = [...nerveKeys, ...[...OUTCOMES].reverse(), 'provoked' as const].filter((k) => odds[k] > 0 || (OUTCOMES as readonly string[]).includes(k));
    const nerveSpec = nerveCheckSpec(s.target, 'weapon-drawn', DICE[state.dice]);
    const active = rollFor(s.actor, info.skill, { dice: DICE[state.dice], situations: info.actorSituations, modifiers: s.modifiers ?? [], edges: s.armed ? ['advantage'] : [] });
    const passive = rollFor(s.target, info.resist, { dice: DICE[state.dice], situations: info.targetSituations });
    results.replaceChildren(
      h('div', { class: 'headline' }, percent(wins), ' ', h('small', {}, `chance ${target} goes along with it`)),
      h('table', { class: 'social-odds' }, h('tbody', {}, ...keys.map((k) => {
        const t = resultTag(k);
        return h('tr', {}, h('td', {}, h('i', { class: `swatch ${t.tag}` })), h('td', {}, meaning(k)), h('td', { class: 'num' }, percent(odds[k])));
      }))),
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
        modifiersView(`${sideCharacter('attacker').name}: ${SKILL_INFO[state.skill].name}`, active().modifiers),
        state.against === 'opponent'
          ? modifiersView(`${sideCharacter('defender').name}: ${SKILL_INFO[state.opponentSkill].name}`, opponent().modifiers)
          : h('div', { class: 'muted' }, `DC ${state.dc}`),
      ),
      outcomeGuide(),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: roll }, 'Roll')),
      logView(),
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
      } }), ' ', SITUATION_INFO[s].name, h('span', { class: 'hint' }, ` – ${SITUATION_INFO[s].description}`))),
      hint('Ticked situations apply the character’s temperament modifiers (e.g. a proud character resisting intimidation gets +2).'));
  };

  const skillHint = (s: Skill) => `${SKILL_INFO[s].covers} Based on ${attributesFor(s).map((a) => ATTRIBUTE_INFO[a].name).join(' or ')}.`;

  const modeLabel = (m: Mode) => (m === 'skill' ? 'Any skill' : SOCIAL_ACTION_INFO[m].name);

  function renderSocialControls(action: SocialAction): HTMLElement {
    return h('div', {},
      sideSelect('attacker', 'Character'),
      sideSelect('defender', 'Target'),
      action === 'intimidate'
        ? h('label', { class: 'field checkbox' },
            h('span', {}, h('input', { type: 'checkbox', checked: state.armed, onchange: (e: Event) => { state.armed = (e.target as HTMLInputElement).checked; renderResults(); } }), ' Armed: draws a weapon'),
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
      sideSelect('attacker', 'Character'),
      h('label', { class: 'field' }, h('span', {}, 'Skill'), skillSelect(state.skill, (s) => { state.skill = s; render(); }, 'Skill'), hint(skillHint(state.skill))),
      h('div', { class: 'field' }, h('span', {}, 'Against'), segmented(['dc', 'opponent'] as const, state.against, (a) => { state.against = a; render(); },
        (a) => (a === 'dc' ? 'DC' : 'Opponent'))),
      state.against === 'dc'
        ? slider('DC', state.dc, 0, 30, (v) => { state.dc = v; renderResults(); }, String,
            'Difficulty class: the total needed. Roughly 10 is easy, 15 moderate, 20 hard, 25 very hard.')
        : h('div', {},
            sideSelect('defender', 'Opponent'),
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
