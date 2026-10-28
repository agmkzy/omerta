// Who is who in what is said (the conversation overhaul, October 2026). Every line has a speaker and a listener; anyone else is a third
// party. A third party is called by his first name, the way men talk, unless that name is also the speaker's, the listener's or the
// player's, in which case he is called by his full name, so that "Charlie" never means two men in one sentence. The speaker never
// names himself, and nobody names the man he is talking to as if he were someone else.
import type { Character, Id, World } from '../types';

const first = (n: string) => n.split(' ')[0];
// the name a third party goes by in a line between `speaker` and `listener`
export function nameIn(w: World, id: Id | undefined, speaker: Character, listener: Character): string {
  const c = id ? w.chars[id] : undefined;
  if (!c) return 'someone';
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  const taken = new Set([speaker, listener, ...(p ? [p] : [])].filter((x) => x.id !== c.id).map((x) => first(x.name)));
  return taken.has(first(c.name)) ? c.name : first(c.name);
}
// a man named by the speaker to the listener: "I"/"me" for the speaker, "you" for the listener, his name otherwise
export function ref(w: World, id: Id | undefined, speaker: Character, listener: Character, role: 'subject' | 'object' = 'subject'): string {
  if (id === speaker.id) return role === 'subject' ? 'I' : 'me';
  if (id === listener.id) return 'you';
  return nameIn(w, id, speaker, listener);
}
export function possessive(w: World, id: Id | undefined, speaker: Character, listener: Character): string {
  if (id === speaker.id) return 'my';
  if (id === listener.id) return 'your';
  const n = nameIn(w, id, speaker, listener);
  return n.endsWith('s') ? `${n}’` : `${n}’s`;
}
// straight quotation marks as the book prints them: opening after a space or the start, closing otherwise (some lines were written
// with straight quotes and printed beside curly ones)
export const curly = (s: string) => s.replace(/(^|[\s(—–-])"/g, '$1“').replace(/"/g, '”');
// "a" or "an" before a word, by its sound (a underboss → an underboss; a one-man → a one-man)
export const article = (word: string) => (/^(one|uni|use|eu|u[rs][aeiou])/i.test(word) ? 'a' : /^[aeiou]/i.test(word) ? 'an' : 'a');
