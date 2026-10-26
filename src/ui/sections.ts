// The five destinations (owner, 26 October), Today at the centre:
//   Street    where you go: the places, who is in them, what you can do there
//   People    who matters: your men and the family first, then everyone you know
//   Today     the present: what needs you, what has reached you, what you could do next
//   Business  what you run: rackets and the money
//   Story     who you are becoming: the stories, your life and road, your word, what you know
import { todayView } from './views_a';
import { crewList, crewView, familyTab, placesView } from './views_b';
import { storiesTab } from './stories';
import { peopleRoom, roadRoom, youRoom } from './lifeview';
import { businessRoom, workRoom } from './business';
import { P, S } from './links';
import { wordRoom } from './word';
import { moreView } from './more';
import type { Tab } from './state';

type Room = [id: string, label: string, view: () => string];
const ROOMS: Partial<Record<Tab, Room[]>> = {
  business: [['run', 'What you run', businessRoom], ['work', 'Work going', workRoom]],
  people: [['men', 'Your men', crewView], ['org', 'The family', familyTab], ['all', 'Everyone', peopleRoom]],
  story: [['stories', 'Stories', storiesTab], ['road', 'Your road', roadRoom], ['life', 'Your life', youRoom], ['word', 'Your word', wordRoom]],
};
// Where an older name lands: the section, and the room in it (none: the section's own first room).
export const LEGACY: Partial<Record<Tab, [Tab, string | undefined]>> = {
  rackets: ['business', 'run'], crew: ['people', 'men'], family: ['people', 'org'],
  stories: ['story', 'stories'], journal: ['story', undefined], life: ['story', 'life'],
};

export function openSection(name: Tab): Tab {
  const l = LEGACY[name];
  if (l) { if (l[1]) S.sub[l[0]] = l[1]; return l[0]; }
  if (name === 'more') S.sub.more = 'menu'; // (More always opens on its menu)
  return name;
}

// A section's first room: in People, your men when you have any, otherwise the family you belong to, otherwise everyone; the rest
// open on their first.
// (Your men is always there, even before the first man: it is where a crew is started)
const roomsOf = (name: Tab) => ROOMS[name] ?? [];
function roomIn(name: Tab): Room | undefined {
  const rs = roomsOf(name);
  if (!rs.length) return undefined;
  const want = S.sub[name] ?? (name === 'people' && !crewList().length ? (P().familyId ? 'org' : 'all') : rs[0][0]);
  return rs.find((r) => r[0] === want) ?? rs[0];
}

export function sectionView(raw: Tab): string {
  const name = LEGACY[raw]?.[0] ?? raw;
  if (raw !== name && LEGACY[raw]![1]) S.sub[name] = LEGACY[raw]![1]!;
  if (name === 'today') return todayView();
  if (name === 'street') return placesView(true);
  if (name === 'more') return moreView();
  const rs = roomsOf(name), cur = roomIn(name)!;
  const nav = `<nav class="lf-nav" aria-label="${name}">${rs.map(([id, label]) => `<button class="${cur[0] === id ? 'on' : ''}" data-a="sub:${name}.${id}" aria-current="${cur[0] === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>`;
  return nav + cur[2]();
}
