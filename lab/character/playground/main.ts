// Playground entry point.
import { charactersPanel } from './characters';
import { checkPanel } from './checkpanel';
import { contestPanel } from './contestpanel';
import { h } from './dom';
import { oddsPanel } from './odds';

const sections = [['characters', 'Characters'], ['check', 'Skill check'], ['contest', 'Contest'], ['odds', 'Dice and odds']] as const;
const nav = h('nav', { class: 'nav' }, ...sections.map(([id, label]) => h('a', { href: `#${id}` }, label)));

document.getElementById('app')!.append(nav, charactersPanel(), checkPanel(), contestPanel(), oddsPanel());
