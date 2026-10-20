// Who you were before March 1970. Since V86 this is history only: it is written on the man's record and read back to him,
// and it changes nothing he starts with - no money, skills, standing, heat or acquaintances.
import { Character, World } from './types';

export interface Background { id: string; label: string; blurb: string }
export const BACKGROUNDS: Background[] = [
  { id: 'hustler', label: 'Street Hustler', blurb: 'You learned to make money on the corners, running errands and knowing who to avoid.' },
  { id: 'connected', label: 'Connected Family', blurb: 'You grew up around men who never explained exactly what they did for a living.' },
  { id: 'business', label: 'Small Businessman', blurb: 'You tried making an honest living. You discovered that honesty wasn’t always profitable.' },
  { id: 'union', label: 'Union Man', blurb: 'You worked alongside men who understood that influence could be worth more than wages.' },
  { id: 'bookmaker', label: 'Bookmaker', blurb: 'You took bets, kept records and learned that collecting money was harder than making it.' },
  { id: 'wheelman', label: 'Wheelman', blurb: 'You drove for men who paid well and preferred you didn’t ask questions.' },
];
// Saves from before V86 may carry one of the earlier backgrounds; they keep their name on the record.
const LEGACY: Record<string, string> = { boxer: 'Former boxer', convict: 'Ex-convict', driver: 'Driver' };
export const bgOf = (id?: string) => BACKGROUNDS.find((b) => b.id === id);
export const bgLabel = (id?: string) => bgOf(id)?.label ?? (id ? LEGACY[id] : undefined);

// Records the background. Deliberately nothing else: the world treats every new associate the same.
export function applyBackground(_w: World, p: Character, id: string) {
  p.bg = bgOf(id) ? id : BACKGROUNDS[0].id;
}
