// The five sections (the overhaul, increment D): World, People, Family, Business, Journal. Your own page opens from your portrait.
// Each section is the rooms that belong together, under one heading; nothing that was reachable before is lost:
//   World     the street today: what wants you, what has happened, where you can go           (was Today)
//   People    everyone you know, and the people at home                                      (was Life > People)
//   Family    your men, and the family you belong to                                         (was Crew, Family)
//   Business  your rackets, and the money: the envelope, what is owed either way             (was Rackets, Life > Business)
//   Journal   the stories you are following, and everything you have seen or been told      (was Stories, Life > What you know)
import { todayView } from './views_a';
import { crewList, crewView, familyTab } from './views_b';
import { racketsView } from './views_c';
import { storiesTab } from './stories';
import { businessRoom, knownRoom, peopleRoom, youRoom } from './lifeview';
import { P, S } from './links';
import type { Tab } from './state';

type Room = [id: string, label: string, view: () => string];
const ROOMS: Partial<Record<Tab, Room[]>> = {
  family: [['men', 'Your men', crewView], ['org', 'The family', familyTab]],
  business: [['rackets', 'Rackets', racketsView], ['money', 'Money', businessRoom]],
  journal: [['stories', 'Stories', storiesTab], ['known', 'What you know', knownRoom]],
};
// Where an older name lands: the section, and the room in it.
export const LEGACY: Partial<Record<Tab, [Tab, string]>> = { rackets: ['business', 'rackets'], crew: ['family', 'men'], stories: ['journal', 'stories'] };

export function openSection(name: Tab): Tab {
  const l = LEGACY[name];
  if (l) { S.sub[l[0]] = l[1]; return l[0]; }
  return name;
}

// A section's first room: your men when you have any, otherwise the family; the rest open on their first.
function roomIn(name: Tab): Room | undefined {
  const rs = ROOMS[name];
  if (!rs) return undefined;
  const want = S.sub[name] ?? (name === 'family' && !crewList().length && P().familyId ? 'org' : rs[0][0]);
  return rs.find((r) => r[0] === want) ?? rs[0];
}

export function sectionView(raw: Tab): string {
  const name = LEGACY[raw]?.[0] ?? raw;
  if (raw !== name) S.sub[name] = LEGACY[raw]![1];
  if (name === 'today') return todayView();
  if (name === 'people') return peopleRoom();
  if (name === 'life') return youRoom();
  const rs = ROOMS[name]!, cur = roomIn(name)!;
  const nav = `<nav class="lf-nav" aria-label="${name}">${rs.map(([id, label]) => `<button class="${cur[0] === id ? 'on' : ''}" data-a="sub:${name}.${id}" aria-current="${cur[0] === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>`;
  return nav + cur[2]();
}
