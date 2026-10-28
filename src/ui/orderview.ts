// Having it done (The Family, October 2026): on the settle screen, under what you could do yourself, what you could have done by one of
// your men, whose word it needs, and asking for it. Nothing here is a chance: whose word it is is a rule the player could know; what the
// man sent will say is his to say when he is asked.
import { leaveFor, sendable, onOrder, type Deed } from '../command';
import { ownerBiz } from '../core';
import { POSITION_WORD, positionOf } from '../standing';
import { choices, context, type Pick } from './kit';
import { esc } from './links';
import type { Business, Character, World } from '../types';

const DEED_LABEL: Record<Deed, (n: string) => string> = { beat: (n) => `Have ${n} beaten`, wreck: (n) => `Have ${n} wrecked`, kill: (n) => `Have ${n} killed` };
export const orderTarget = (w: World, x: Character, deed: Deed, biz?: string): Character | Business | undefined => (deed === 'wreck' ? (biz ? w.biz[biz] : ownerBiz(w, x.id)) : x);

// on the settle screen: one way in, so the list stays short
export function orderEntry(w: World, p: Character, x: Character, biz?: string): Pick[] {
  const n = sendable(w, p, x).length;
  if (!n || !orderPicks(w, p, x, biz).length) return [];
  return [{ a: `sv:sd:pick:${biz ?? ''}|${x.id}`, label: 'Have one of your men see to it', hint: `A beating, his place wrecked, or worse. ${n === 1 ? 'You have one man you can send' : `You have ${n} men you can send`}; whose word it needs depends on who he is.`, kind: 'more' }];
}
// the deeds open against this man (and his place), each with whose word it needs
export function orderPicks(w: World, p: Character, x: Character, biz?: string): Pick[] {
  if (!sendable(w, p, x).length) return [];
  const out: Pick[] = [];
  for (const deed of ['beat', 'wreck', 'kill'] as Deed[]) {
    const t = orderTarget(w, x, deed, biz);
    if (!t || (deed === 'wreck' && (!(t as Business).open || (t as Business).ownerId === p.id))) continue;
    if (deed === 'beat' && x.hurtUntil > w.now) continue;
    const l = leaveFor(w, p, deed, t);
    const word = l.have ? (l.need === 'none' ? 'Your call.' : 'You have the word for it.') : l.need === 'breach' ? `Nobody can allow it: ${l.why}.` : `It needs ${l.from?.name ?? 'someone'}’s word: ${l.why}.`;
    out.push({ a: `sv:sd:${deed}:${biz ?? ''}|${x.id}`, label: DEED_LABEL[deed](t.name), hint: `Send one of your men. ${word}`, kind: 'danger' });
    if (!l.have && l.from?.alive && l.from.id !== p.id && l.need !== 'breach' && !((p.cooldown[`asked:${deed}:${t.id}`] ?? 0) > w.now)) out.push({ a: `sv:ask:${deed}:${biz ?? ''}|${x.id}`, label: `Ask ${l.from.name} for his word`, hint: `${deed === 'kill' ? 'Ask to have him killed' : deed === 'wreck' ? `Ask to have ${t.name} wrecked` : 'Ask to have him given a beating'}. He’ll decide by how he sees you, and him.`, kind: 'more' });
  }
  return out;
}
// The second step: which man to send. What he is to you, never what he will say.
export function sendPicks(w: World, p: Character, x: Character, deed: Deed, biz?: string): string {
  const t = orderTarget(w, x, deed, biz);
  if (!t) return context(['There’s nothing there to wreck any more.']);
  const l = leaveFor(w, p, deed, t);
  const men = sendable(w, p, x);
  const lead = l.have ? '' : l.need === 'breach' ? `Nobody can allow this: ${esc(l.why)}. If it’s done, it’s done against the family.` : `Nobody with the right has allowed it: ${esc(l.why)}. If you go ahead, ${esc(l.from?.name ?? 'he')} will know you went around him.`;
  const picks: Pick[] = men.map((m) => {
    const what = [m.bossId === p.id ? `your ${(POSITION_WORD[positionOf(w, m)] || 'man').toLowerCase()}` : `${w.chars[m.bossId ?? '']?.name.split(' ')[0] ?? 'one of your men'}’s ${(POSITION_WORD[positionOf(w, m)] || 'man').toLowerCase()}`, m.nick ? `“${m.nick}”` : '', onOrder(w, m) ? 'already out on something for you' : ''].filter(Boolean).join(' · ');
    return { a: `sv:sm:${deed}:${m.id}:${biz ?? ''}|${x.id}`, label: `Send ${m.name}`, hint: what, kind: onOrder(w, m) ? 'more' : 'danger' };
  });
  picks.push({ a: `sv:back|${x.id}`, label: 'Think better of it', hint: 'Go back.' });
  return (lead ? context([lead], true) : '') + choices(picks, 'Whom you send');
}
// a man already sent after him, as the player knows it (he sent him)
export function sentAfter(w: World, p: Character, x: Character): string {
  const q = (w.pending ?? []).find((o) => o.kind === 'order' && o.by === p.id && (o.b === x.id));
  const m = q?.a ? w.chars[q.a] : undefined;
  return m ? context([`You’ve sent ${esc(m.name)} to see to it${q!.note === 'kill' ? ', for good' : q!.note === 'wreck' ? ': his place' : ''}. You’ll hear in a day or two.`]) : '';
}
