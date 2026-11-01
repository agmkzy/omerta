// Character sheets: roll a character from a background, or edit attributes, training and temperament directly.
import { ATTRIBUTES, ATTRIBUTE_INFO, SCORE_MAX, SCORE_MIN, abilityModifier } from '../src/attributes';
import { BACKGROUNDS, BACKGROUND_INFO, type BackgroundName } from '../src/backgrounds';
import { bonusOf } from '../src/check';
import { PROFICIENCIES, PROFICIENCY_MAX, PROFICIENCY_MIN, attributeUsed, createCharacter, skillModifiers, type Character, type Proficiency } from '../src/character';
import type { Side } from '../src/contest';
import { describeModifier, signed } from '../src/explain';
import { SKILLS, SKILL_INFO } from '../src/skills';
import { TRAITS, TRAIT_INFO, notableTraits } from '../src/temperament';
import { h, slider } from './dom';
import { SIDE_LABEL, character, onChange, rollNew, setCharacter } from './store';

const SOURCE = 'characters';

export function charactersPanel(): HTMLElement {
  return h('section', { class: 'panel', id: 'characters', 'aria-labelledby': 'characters-title' },
    h('h2', { id: 'characters-title' }, 'Characters'),
    h('p', { class: 'muted' }, 'Pick a background to roll a new character, or edit values directly. Hover a skill bonus for its breakdown.'),
    h('div', { class: 'grid two' }, sheet('attacker'), sheet('defender')),
  );
}

function sheet(side: Side): HTMLElement {
  const root = h('div', { class: 'sheet' });
  const skills = h('div');
  const summary = h('p', { class: 'summary' });
  const current = () => character(side);
  const update = (next: Character) => {
    setCharacter(side, next, SOURCE);
    refresh();
  };

  /** Re-renders the parts derived from the character, leaving the inputs alone so a slider can be dragged. */
  function refresh() {
    const c = current();
    const traits = notableTraits(c.temperament);
    summary.textContent = `Notable traits: ${traits.length ? traits.join(', ') : 'none'}.`;
    skills.replaceChildren(
      h('h3', {}, 'Skills'),
      h('table', { class: 'skills' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Skill'), h('th', {}, 'Attribute'), h('th', {}, 'Training'), h('th', {}, 'Bonus'))),
        h('tbody', {}, ...SKILLS.map((s) => {
          const mods = skillModifiers(c, s);
          const select = h('select', { 'aria-label': `${SKILL_INFO[s].name} training`, onchange: (e: Event) => {
            const p = (e.target as HTMLSelectElement).value as Proficiency;
            const training = { ...current().training };
            if (p === 'untrained') delete training[s];
            else training[s] = p;
            update(createCharacter({ ...current(), training }));
          } }, ...PROFICIENCIES.map((p) => h('option', { value: p, selected: (c.training[s] ?? 'untrained') === p }, p)));
          return h('tr', { class: c.training[s] ? 'trained' : '' },
            h('td', { title: SKILL_INFO[s].covers }, SKILL_INFO[s].name),
            h('td', { class: 'muted' }, ATTRIBUTE_INFO[attributeUsed(c, s)].short),
            h('td', {}, select),
            h('td', { title: mods.map(describeModifier).join('\n') }, signed(bonusOf(mods))));
        })),
      ),
    );
  }

  function build() {
    const c = current();
    root.replaceChildren(
      h('div', { class: 'sheet-head' },
        h('div', { class: 'muted' }, SIDE_LABEL[side]),
        h('div', { class: 'row' },
          h('input', { class: 'name', value: c.name, 'aria-label': 'Name', oninput: (e: Event) => update(createCharacter({ ...current(), name: (e.target as HTMLInputElement).value })) }),
          h('select', { 'aria-label': 'Background', onchange: (e: Event) => {
            setCharacter(side, rollNew(current().name, (e.target as HTMLSelectElement).value as BackgroundName), SOURCE);
            build();
          } }, ...BACKGROUNDS.map((b) => h('option', { value: b, selected: c.background === b }, BACKGROUND_INFO[b].name))),
          h('button', { type: 'button', onclick: () => {
            setCharacter(side, rollNew(current().name, current().background ?? 'labourer'), SOURCE);
            build();
          } }, 'Reroll'),
        ),
        c.background ? h('p', { class: 'muted description' }, BACKGROUND_INFO[c.background].description) : null,
        summary,
      ),
      h('div', { class: 'grid' },
        h('div', {},
          h('h3', {}, 'Attributes'),
          ...ATTRIBUTES.map((a) =>
            slider(`${ATTRIBUTE_INFO[a].name} (${ATTRIBUTE_INFO[a].short})`, c.attributes[a], SCORE_MIN, SCORE_MAX,
              (v) => update(createCharacter({ ...current(), attributes: { ...current().attributes, [a]: v } })),
              (v) => `${v} (${signed(abilityModifier(v))})`)),
          slider('Proficiency bonus', c.proficiencyBonus, PROFICIENCY_MIN, PROFICIENCY_MAX,
            (v) => update(createCharacter({ ...current(), proficiencyBonus: v })), signed),
        ),
        h('div', {},
          h('h3', {}, 'Temperament'),
          ...TRAITS.map((t) =>
            slider(`${TRAIT_INFO[t].name} (${TRAIT_INFO[t].low} – ${TRAIT_INFO[t].high})`, Math.round(c.temperament[t] * 100), 0, 100,
              (v) => update(createCharacter({ ...current(), temperament: { ...current().temperament, [t]: v / 100 } })),
              (v) => (v / 100).toFixed(2))),
        ),
      ),
      skills,
    );
    refresh();
  }

  onChange((changed, source) => {
    if (changed === side && source !== SOURCE) build();
  });
  build();
  return root;
}
