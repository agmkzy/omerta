// Playground entry point: one tab per panel. The open tab is remembered in this browser.
import { charactersPanel } from './characters';
import { checkPanel } from './checkpanel';
import { fightPanel } from './fightpanel';
import { h } from './dom';
import { oddsPanel } from './odds';
import { onChange, storage } from './store';
import type { Panel } from './views';

const TAB_KEY = 'character-lab:tab';
const tabs: readonly { id: string; label: string; panel: Panel }[] = [
  { id: 'characters', label: 'Characters', panel: charactersPanel() },
  { id: 'check', label: 'Skill check', panel: checkPanel() },
  { id: 'fight', label: 'Fight', panel: fightPanel() },
  { id: 'odds', label: 'Dice and odds', panel: oddsPanel() },
];

const bar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' });
const content = h('div', { class: 'tab-content', role: 'tabpanel' });
let active = '';

function show(id: string): void {
  const tab = tabs.find((t) => t.id === id) ?? tabs[0]!;
  active = tab.id;
  for (const button of bar.querySelectorAll('button')) button.setAttribute('aria-selected', String(button.dataset.id === tab.id));
  tab.panel.render();
  content.replaceChildren(tab.panel.element);
  content.setAttribute('aria-label', tab.label);
  try {
    storage?.setItem(TAB_KEY, tab.id);
  } catch {
    // Remembering the tab is a convenience; ignore storage failures.
  }
}

bar.append(...tabs.map((t) => {
  const button = h('button', { type: 'button', role: 'tab', onclick: () => show(t.id) }, t.label);
  button.dataset.id = t.id;
  return button;
}));

// Re-render the open tab when another part of the page changes the roster.
onChange((source) => {
  if (source !== active) tabs.find((t) => t.id === active)?.panel.render();
});

document.getElementById('app')!.append(bar, content);
let remembered: string | null = null;
try {
  remembered = storage?.getItem(TAB_KEY) ?? null;
} catch {
  remembered = null;
}
show(remembered ?? 'characters');
