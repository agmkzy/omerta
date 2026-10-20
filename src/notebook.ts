// The man's own contact book: tags and pins about people, kept by the player.
import { Character, Id, World } from './types';
export const TAGS = ['Owes me', 'I owe him', 'Good earner', 'Watch him', 'Trusted', 'Family matters', 'Dangerous', 'Useful contact'];
export function noteOf(p: Character, id: Id) { return p.notes?.[id]; }
export function toggleTag(p: Character, id: Id, i: number) {
  const n = ((p.notes ??= {})[id] ??= { tags: [] });
  const t = TAGS[i];
  n.tags = n.tags.includes(t) ? n.tags.filter((x) => x !== t) : [...n.tags, t];
  if (!n.tags.length && !n.pin) delete p.notes![id];
}
export function togglePin(p: Character, id: Id) {
  const n = ((p.notes ??= {})[id] ??= { tags: [] });
  n.pin = !n.pin;
  if (!n.tags.length && !n.pin) delete p.notes![id];
}
export const pinned = (w: World, p: Character) => Object.entries(p.notes ?? {}).filter(([id, n]) => n.pin && w.chars[id]?.alive).map(([id]) => w.chars[id]);
