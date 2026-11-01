// Characters tab: the list of saved characters, and an editor for the selected one.
import { ATTRIBUTES, ATTRIBUTE_INFO, SCORE_MAX, SCORE_MIN, abilityModifier } from '../src/attributes';
import { BACKGROUNDS, BACKGROUND_INFO, type BackgroundName } from '../src/backgrounds';
import { bonusOf } from '../src/check';
import { PROFICIENCIES, PROFICIENCY_MAX, PROFICIENCY_MIN, attributeUsed, createCharacter, skillModifiers, type Character, type Proficiency } from '../src/character';
import { describeModifier, signed } from '../src/explain';
import { SKILLS, SKILL_INFO } from '../src/skills';
import { TRAITS, TRAIT_INFO, notableTraits } from '../src/temperament';
import { h, segmented, slider } from './dom';
import { addEntry, removeEntry, select, updateEntry } from './roster';
import { change, characterById, getRoster, newId, rollNew, saved } from './store';
import type { Panel } from './views';

const SOURCE = 'characters';
const SECTIONS = ['attributes', 'skills', 'temperament'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Readonly<Record<Section, string>> = { attributes: 'Attributes', skills: 'Skills', temperament: 'Temperament' };

export function charactersPanel(): Panel {
  let section: Section = 'attributes';
  let newBackground: BackgroundName = 'enforcer';
  let rerollBackground: BackgroundName | null = null;

  const list = h('div', { class: 'roster' });
  const editor = h('div', { class: 'editor' });
  const summary = h('div', { class: 'summary' });
  const body = h('div');
  const element = h('div', { class: 'characters-layout' }, list, editor);

  const selectedId = () => getRoster().selected;
  const current = () => characterById(selectedId());

  /** Saves an edit to the selected character and refreshes what depends on it, without rebuilding the inputs. */
  const update = (next: Character, rebuildBody = false) => {
    change((r) => updateEntry(r, selectedId(), next), SOURCE);
    renderList();
    renderSummary();
    if (rebuildBody) renderBody();
  };

  function renderList() {
    const r = getRoster();
    list.replaceChildren(
      h('h2', {}, `Saved characters (${r.entries.length})`),
      h('ul', { class: 'roster-list' }, ...r.entries.map((e) => {
        const role = e.id === r.attacker ? 'attacker' : e.id === r.defender ? 'defender' : '';
        return h('li', {},
          h('button', { type: 'button', class: e.id === r.selected ? 'roster-item selected' : 'roster-item', 'aria-current': e.id === r.selected ? 'true' : undefined,
            onclick: () => { change((x) => select(x, e.id), SOURCE); render(); } },
            h('span', { class: 'roster-name' }, e.character.name || '(unnamed)'),
            h('span', { class: 'muted roster-meta' }, [e.character.background ? BACKGROUND_INFO[e.character.background].name : 'No background', role].filter(Boolean).join(' · '))));
      })),
      h('div', { class: 'new-character' },
        h('label', { class: 'field' }, h('span', {}, 'New character'),
          h('select', { 'aria-label': 'Background for new character', onchange: (e: Event) => (newBackground = (e.target as HTMLSelectElement).value as BackgroundName) },
            ...BACKGROUNDS.map((b) => h('option', { value: b, selected: b === newBackground }, BACKGROUND_INFO[b].name)))),
        h('button', { type: 'button', class: 'primary', onclick: () => { change((x) => addEntry(x, { id: newId(), character: rollNew(newBackground) }), SOURCE); render(); } }, 'Create'),
      ),
      h('p', { class: 'muted small' }, saved() ? 'Saved in this browser.' : 'Could not save: browser storage is unavailable.'),
    );
  }

  function renderSummary() {
    const c = current();
    const best = [...SKILLS].map((s) => ({ s, bonus: bonusOf(skillModifiers(c, s)) })).sort((a, b) => b.bonus - a.bonus).slice(0, 3);
    const traits = notableTraits(c.temperament);
    summary.replaceChildren(
      h('div', {}, h('span', { class: 'muted' }, 'Background: '), c.background ? BACKGROUND_INFO[c.background].name : 'none'),
      h('div', {}, h('span', { class: 'muted' }, 'Best skills: '), best.map((b) => `${SKILL_INFO[b.s].name} ${signed(b.bonus)}`).join(', ')),
      h('div', {}, h('span', { class: 'muted' }, 'Notable traits: '), traits.length ? traits.join(', ') : 'none'),
    );
  }

  function renderBody() {
    const c = current();
    if (section === 'attributes') {
      body.replaceChildren(
        h('div', { class: 'grid' },
          h('div', {}, ...ATTRIBUTES.map((a) =>
            slider(`${ATTRIBUTE_INFO[a].name} (${ATTRIBUTE_INFO[a].short})`, c.attributes[a], SCORE_MIN, SCORE_MAX,
              (v) => update(createCharacter({ ...current(), attributes: { ...current().attributes, [a]: v } })),
              (v) => `${v} (${signed(abilityModifier(v))})`))),
          h('div', {},
            slider('Proficiency bonus', c.proficiencyBonus, PROFICIENCY_MIN, PROFICIENCY_MAX, (v) => update(createCharacter({ ...current(), proficiencyBonus: v })), signed),
            h('p', { class: 'muted small' }, 'Added once to trained skills and twice to expert skills.'),
            h('div', { class: 'field' }, h('span', {}, 'Reroll attributes, training and temperament'),
              h('div', { class: 'row' },
                h('select', { 'aria-label': 'Background to reroll as', onchange: (e: Event) => (rerollBackground = (e.target as HTMLSelectElement).value as BackgroundName) },
                  ...BACKGROUNDS.map((b) => h('option', { value: b, selected: b === (rerollBackground ?? c.background) }, BACKGROUND_INFO[b].name))),
                h('button', { type: 'button', onclick: () => {
                  update(rollNew(rerollBackground ?? current().background ?? 'labourer', current().name), true);
                  rerollBackground = null;
                } }, 'Reroll'))),
          ),
        ),
      );
    } else if (section === 'skills') {
      body.replaceChildren(
        h('table', { class: 'skills' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Skill'), h('th', {}, 'Attribute'), h('th', {}, 'Training'), h('th', {}, 'Bonus'))),
          h('tbody', {}, ...SKILLS.map((s) => {
            const mods = skillModifiers(c, s);
            return h('tr', { class: c.training[s] ? 'trained' : '' },
              h('td', { title: SKILL_INFO[s].covers }, SKILL_INFO[s].name),
              h('td', { class: 'muted' }, ATTRIBUTE_INFO[attributeUsed(c, s)].short),
              h('td', {}, h('select', { 'aria-label': `${SKILL_INFO[s].name} training`, onchange: (e: Event) => {
                const p = (e.target as HTMLSelectElement).value as Proficiency;
                const training = { ...current().training };
                if (p === 'untrained') delete training[s];
                else training[s] = p;
                update(createCharacter({ ...current(), training }), true);
              } }, ...PROFICIENCIES.map((p) => h('option', { value: p, selected: (c.training[s] ?? 'untrained') === p }, p)))),
              h('td', { class: 'num', title: mods.map(describeModifier).join('\n') }, signed(bonusOf(mods))));
          })),
        ),
        h('p', { class: 'muted small' }, 'Hover a bonus to see its breakdown.'),
      );
    } else {
      body.replaceChildren(
        h('div', { class: 'grid' }, ...TRAITS.map((t) =>
          slider(`${TRAIT_INFO[t].name} (${TRAIT_INFO[t].low} – ${TRAIT_INFO[t].high})`, Math.round(c.temperament[t] * 100), 0, 100,
            (v) => update(createCharacter({ ...current(), temperament: { ...current().temperament, [t]: v / 100 } })),
            (v) => (v / 100).toFixed(2)))),
      );
    }
  }

  function renderEditor() {
    const r = getRoster();
    const c = current();
    editor.replaceChildren(
      h('div', { class: 'editor-head' },
        h('input', { class: 'name', value: c.name, 'aria-label': 'Name', oninput: (e: Event) => update(createCharacter({ ...current(), name: (e.target as HTMLInputElement).value })) }),
        h('button', { type: 'button', onclick: () => {
          change((x) => addEntry(x, { id: newId(), character: createCharacter({ ...current(), name: `${current().name} (copy)` }) }), SOURCE);
          render();
        } }, 'Duplicate'),
        h('button', { type: 'button', disabled: r.entries.length <= 2, title: r.entries.length <= 2 ? 'At least two characters are needed' : undefined, onclick: () => {
          if (!confirm(`Delete ${current().name}?`)) return;
          change((x) => removeEntry(x, selectedId()), SOURCE);
          render();
        } }, 'Delete'),
      ),
      summary,
      segmented(SECTIONS, section, (s) => { section = s; renderEditor(); }, (s) => SECTION_LABEL[s]),
      body,
    );
    renderSummary();
    renderBody();
  }

  function render() {
    renderList();
    renderEditor();
  }

  return { element, render };
}
