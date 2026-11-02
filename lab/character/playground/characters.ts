// Characters tab: the list of saved characters, and an editor for the selected one.
import { ATTRIBUTES, ATTRIBUTE_INFO, AVERAGE_SCORE, SCORE_MAX, SCORE_MIN, abilityModifier, type Attribute } from '../src/attributes';
import { BACKGROUNDS, BACKGROUND_INFO, type BackgroundName } from '../src/backgrounds';
import { bonusOf } from '../src/check';
import { EXPERT_MULTIPLE, PROFICIENCIES, PROFICIENCY_MAX, PROFICIENCY_MIN, attributeUsed, createCharacter, defence, defenceOf, hitPoints, maxHitPoints, skillModifiers, skillsByScore, type Character, type Proficiency, type SkillByScore } from '../src/character';
import { describeModifier, describeTotal, signed } from '../src/explain';
import { NERVE_FAILURE } from '../src/nerve';
import { SKILLS, SKILL_INFO, attributesFor, skillsUsing } from '../src/skills';
import { HIGH, LOW, SITUATION_INFO, TRAITS, TRAIT_INFO, effectsOf, notableTraits, type Trait } from '../src/temperament';
import { h, segmented, slider, valueOf } from './dom';
import { addEntry, removeEntry, select, updateEntry } from './roster';
import { canSave, change, characterById, getRoster, loadWarning, newId, rollNew, saved, storage } from './store';
import { hint, type Panel } from './views';

/** The background a character without one is rerolled as, unless another is chosen. */
const REROLL_WITHOUT_BACKGROUND: BackgroundName = 'labourer';

const SOURCE = 'characters';

/** One attribute's table: the modifier and each skill using it, at each score, with the character's current score marked. */
function growthTable(c: Character, a: Attribute): HTMLElement {
  const scores = tableScores(c.attributes[a]);
  const cell = (score: number, text: string, header = false) => h(header ? 'th' : 'td', { class: score === c.attributes[a] ? 'num current' : 'num' }, text);
  const rows = skillsByScore(c, a, scores);
  // Where a skill would use another, higher attribute instead, say which.
  const notes = rows.filter((r) => r.bonuses.includes(null)).map((r) => {
    const others = attributesFor(r.skill).filter((x) => x !== a).map((x) => `${ATTRIBUTE_INFO[x].name} ${c.attributes[x]}`);
    const main = ATTRIBUTE_INFO[SKILL_INFO[r.skill].attribute].name;
    return `– ${SKILL_INFO[r.skill].name} uses ${others.join(' or ')} instead at these scores: a skill uses the better of its attributes, ${main} on a tie.`;
  });
  const training = (r: SkillByScore) => (c.training[r.skill] ? ` (${c.training[r.skill]})` : '');
  return h('div', { class: 'growth' },
    h('h3', {}, `${ATTRIBUTE_INFO[a].name} (currently ${c.attributes[a]})`),
    h('div', { class: 'scroll' },
      h('table', { class: 'growth-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Score'), ...scores.map((s) => cell(s, String(s), true)))),
        h('tbody', {},
          h('tr', { class: 'modifier' }, h('td', {}, 'Modifier'), ...scores.map((s) => cell(s, signed(abilityModifier(s))))),
          ...rows.map((r) => h('tr', {}, h('td', {}, `${SKILL_INFO[r.skill].name}${training(r)}`), ...r.bonuses.map((b, i) => cell(scores[i]!, b === null ? '–' : signed(b)))))))),
    ...notes.map((n) => hint(n)));
}
const SECTIONS = ['attributes', 'skills', 'growth', 'temperament'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Readonly<Record<Section, string>> = { attributes: 'Attributes', skills: 'Skills', growth: 'Attributes and skills', temperament: 'Temperament' };
const SECTION_INTRO: Readonly<Record<Section, string>> = {
  attributes: `Natural ability, scored ${SCORE_MIN}–${SCORE_MAX} (${AVERAGE_SCORE} is average). Each score gives a modifier, shown in brackets, that is added to rolls of the skills using it.`,
  skills: `Learned abilities. A skill’s bonus is its attribute’s modifier, plus the proficiency bonus if trained, or the proficiency bonus ×${EXPERT_MULTIPLE} if expert.`,
  growth: 'How this character’s skills would change with each attribute: every table shows each skill that uses the attribute, and its bonus if the attribute had that score, with this character’s training and proficiency bonus. Their current score is highlighted. Every 2 points of an attribute add 1 to its modifier, and so to each skill using it.',
  temperament: `Personality, from 0 to 1 (0.5 is average). Values of ${LOW} or below count as low and ${HIGH} or above as high. Temperament mainly drives behaviour; where it also changes rolls, that is noted.`,
};

/** The scores the attribute tables show: 1, every even score (where the modifier changes) and the character's own. */
function tableScores(current: number): number[] {
  const scores = new Set([SCORE_MIN, ...Array.from({ length: SCORE_MAX / 2 }, (_, i) => 2 * (i + 1)), current]);
  return [...scores].sort((a, b) => a - b);
}

/** Which skills an attribute feeds, e.g. "Used by: Brawling; alternative for Intimidation." */
function attributeUse(a: (typeof ATTRIBUTES)[number]): string {
  const uses = skillsUsing(a);
  const primary = uses.filter((u) => u.primary).map((u) => SKILL_INFO[u.skill].name);
  const alternative = uses.filter((u) => !u.primary).map((u) => SKILL_INFO[u.skill].name);
  const hp = a === 'con' ? ' Also adds to hit points.' : '';
  return `Used by: ${primary.join(', ')}${alternative.length ? `; alternative for ${alternative.join(', ')}` : ''}.${hp}`;
}

/** What a trait does to rolls and fights, if anything. */
function traitEffects(t: Trait): string {
  const rolls = effectsOf(t).map((e) => `${e.when === 'high' ? 'High' : 'Low'}: ${signed(e.value)} when ${SITUATION_INFO[e.situation].name.toLowerCase()}.`);
  return [...rolls, NERVE_FAILURE[t] ?? ''].filter(Boolean).join(' ');
}

export function charactersPanel(): Panel {
  let section: Section = 'attributes';
  let newBackground: BackgroundName = 'fighter';
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
        const role = e.id === r.actor ? 'skill check: character' : e.id === r.target ? 'skill check: target' : '';
        return h('li', {},
          h('button', { type: 'button', class: e.id === r.selected ? 'roster-item selected' : 'roster-item', 'aria-current': e.id === r.selected ? 'true' : undefined,
            onclick: () => { change((x) => select(x, e.id), SOURCE); render(); } },
            h('span', { class: 'roster-name' }, e.character.name || '(unnamed)'),
            h('span', { class: 'muted roster-meta' }, [e.character.background ? BACKGROUND_INFO[e.character.background].name : 'No background', role].filter(Boolean).join(' · '))));
      })),
      h('div', { class: 'new-character' },
        h('label', { class: 'field' }, h('span', {}, 'New character'),
          h('select', { 'aria-label': 'Background for new character', onchange: (e: Event) => {
            newBackground = valueOf(e) as BackgroundName;
            renderList();
          } }, ...BACKGROUNDS.map((b) => h('option', { value: b, selected: b === newBackground }, BACKGROUND_INFO[b].name)))),
        hint(`${BACKGROUND_INFO[newBackground].description} Rolls attributes, sets training and rolls a temperament to suit.`),
        h('button', { type: 'button', class: 'primary', onclick: () => { change((x) => addEntry(x, { id: newId(), character: rollNew(newBackground) }), SOURCE); render(); } }, 'Create'),
      ),
      h('p', { class: 'muted small' }, savedNote()),
    );
  }

  function renderSummary() {
    const c = current();
    const best = [...SKILLS].map((s) => ({ s, bonus: bonusOf(skillModifiers(c, s)) })).sort((a, b) => b.bonus - a.bonus).slice(0, 3);
    const traits = notableTraits(c.temperament);
    summary.replaceChildren(
      h('div', {}, h('span', { class: 'muted' }, 'Background: '), c.background ? `${BACKGROUND_INFO[c.background].name}. ${BACKGROUND_INFO[c.background].description}` : 'none'),
      h('div', {}, h('span', { class: 'muted' }, 'Hit points: '), `${maxHitPoints(c)} `,
        h('span', { class: 'muted' }, `(${describeTotal(hitPoints(c))})`)),
      h('div', {}, h('span', { class: 'muted' }, 'Defence: '), `${defence(c)} `,
        h('span', { class: 'muted' }, `(${describeTotal(defenceOf(c))}; what an attack must reach to hit)`)),
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
              (v) => `${v} (${signed(abilityModifier(v))})`,
              `${ATTRIBUTE_INFO[a].covers} ${attributeUse(a)}`))),
          h('div', {},
            slider('Proficiency bonus', c.proficiencyBonus, PROFICIENCY_MIN, PROFICIENCY_MAX, (v) => update(createCharacter({ ...current(), proficiencyBonus: v })), signed,
              `Experience. Added once to trained skills and ×${EXPERT_MULTIPLE} to expert skills. Ranges from ${signed(PROFICIENCY_MIN)} (new) to ${signed(PROFICIENCY_MAX)} (veteran).`),
            h('div', { class: 'field' }, h('span', {}, 'Reroll attributes, training and temperament'),
              h('span', { class: 'hint' }, 'Replaces this character’s values with a new roll for the chosen background. The name is kept.'),
              h('div', { class: 'row' },
                h('select', { 'aria-label': 'Background to reroll as', onchange: (e: Event) => (rerollBackground = valueOf(e) as BackgroundName) },
                  ...BACKGROUNDS.map((b) => h('option', { value: b, selected: b === (rerollBackground ?? c.background) }, BACKGROUND_INFO[b].name))),
                h('button', { type: 'button', onclick: () => {
                  update(rollNew(rerollBackground ?? current().background ?? REROLL_WITHOUT_BACKGROUND, current().name), true);
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
            const options = attributesFor(s);
            return h('tr', { class: c.training[s] ? 'trained' : '' },
              h('td', {}, h('div', { class: 'skill-name' }, SKILL_INFO[s].name), h('div', { class: 'hint' }, SKILL_INFO[s].covers)),
              h('td', { class: 'muted', title: options.length > 1 ? `Uses the higher of ${options.map((a) => ATTRIBUTE_INFO[a].name).join(' and ')}` : undefined },
                ATTRIBUTE_INFO[attributeUsed(c, s)].short, options.length > 1 ? h('div', { class: 'hint' }, `best of ${options.map((a) => ATTRIBUTE_INFO[a].short).join('/')}`) : null),
              h('td', {}, h('select', { 'aria-label': `${SKILL_INFO[s].name} training`, onchange: (e: Event) => {
                const p = valueOf(e) as Proficiency;
                const training = { ...current().training };
                if (p === 'untrained') delete training[s];
                else training[s] = p;
                update(createCharacter({ ...current(), training }), true);
              } }, ...PROFICIENCIES.map((p) => h('option', { value: p, selected: (c.training[s] ?? 'untrained') === p }, p)))),
              h('td', { class: 'num', title: mods.map(describeModifier).join('\n') }, signed(bonusOf(mods))));
          })),
        ),
        hint('Hover a bonus to see its breakdown.'),
      );
    } else if (section === 'growth') {
      body.replaceChildren(...ATTRIBUTES.map((a) => growthTable(c, a)));
    } else {
      body.replaceChildren(
        h('div', { class: 'grid' }, ...TRAITS.map((t) =>
          slider(`${TRAIT_INFO[t].name} (${TRAIT_INFO[t].low} – ${TRAIT_INFO[t].high})`, Math.round(c.temperament[t] * 100), 0, 100,
            (v) => update(createCharacter({ ...current(), temperament: { ...current().temperament, [t]: v / 100 } })),
            (v) => (v / 100).toFixed(2),
            [TRAIT_INFO[t].description, traitEffects(t)].filter(Boolean).join(' ')))),
      );
    }
  }

  function renderEditor() {
    const r = getRoster();
    const c = current();
    editor.replaceChildren(
      h('div', { class: 'editor-head' },
        h('input', { class: 'name', value: c.name, 'aria-label': 'Name', oninput: (e: Event) => update(createCharacter({ ...current(), name: valueOf(e) })) }),
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
      hint(SECTION_INTRO[section]),
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

function savedNote(): string {
  if (saved()) return 'Saved in this browser.';
  if (storage === null) return 'Not saved: browser storage is unavailable.';
  if (!canSave()) return 'Not saved, to protect the saved data (see the warning at the top of the page).';
  if (loadWarning()) return 'Not saved yet: the first change will be saved (the warning at the top of the page says where the original is kept).';
  return 'Not saved: the browser refused to store it (its storage may be full).';
}
