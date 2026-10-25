// Journal › Your word: every obligation on record between the player and another man, in one place. Favours either way, what you
// promised and what was promised you, the terms you agreed and the warnings given. Each is a record the player is a party to (memos
// kept by either man about the other, favours between them); what is settled or done is not listed. Each row leads to the man.
import { favourWord, owedTo, owing } from '../encounters';
import type { Character, Memo, World } from '../types';
import { avatar } from './common';
import { h, quiet, rows, type Row } from './kit';
import { esc, P, W } from './links';
import { byWhenWord } from './when';
import { agoWord } from './lifeview';

interface Rec { m: Memo; c: Character; mine: boolean } // mine: the player's own word (kept by the other man, about the player)

function records(w: World, p: Character): Rec[] {
  const out: Rec[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.id === p.id) continue;
    for (const m of c.memos) if (m.other === p.id && !m.done) out.push({ m, c, mine: true });
  }
  for (const m of p.memos) if (!m.done && w.chars[m.other]?.alive) out.push({ m, c: w.chars[m.other], mine: false });
  return out.filter((r) => r.m.kind !== 'question').sort((a, b) => (a.m.due ?? 1e12) - (b.m.due ?? 1e12) || b.m.t - a.m.t);
}

const row = (w: World, r: Rec): Row => {
  const due = r.m.due ? (r.m.due <= w.now ? 'it was due' : byWhenWord(w.now, r.m.due)) : '';
  return { face: avatar(r.c), title: esc(r.m.text), sub: `${esc(r.c.name)} · ${esc(agoWord(w.now, r.m.t))}`, end: due ? esc(due) : '', tone: r.m.due && r.m.due <= w.now ? 'bad' : r.m.due ? 'warn' : '', a: `talk:${r.c.id}` };
};

export function wordRoom(): string {
  const w = W(), p = P();
  let out = '';
  const owed = owedTo(w, p.id).filter((f) => w.chars[f.to]?.alive), owe = owing(w, p.id).filter((f) => w.chars[f.from]?.alive);
  out += h('Favours', owed.length + owe.length ? `${owed.length} owed you · ${owe.length} you owe` : '');
  if (!owed.length && !owe.length) out += quiet('Nobody owes you a favour, and you owe nobody. Do a man a good turn and he will remember it.');
  out += rows([
    ...owed.map((f): Row => ({ face: avatar(w.chars[f.to]), title: `${esc(w.chars[f.to].name)} owes you`, sub: `${esc(f.what)} · ${esc(agoWord(w.now, f.t))}`, end: esc(favourWord(f.size)), tone: 'good', a: `talk:${f.to}` })),
    ...owe.map((f): Row => ({ face: avatar(w.chars[f.from]), title: `You owe ${esc(w.chars[f.from].name)}`, sub: `${esc(f.what)} · ${esc(agoWord(w.now, f.t))}`, end: esc(favourWord(f.size)), tone: 'warn', a: `talk:${f.from}` })),
  ]);
  const rs = records(w, p);
  const group = (title: string, note: string, f: (r: Rec) => boolean, empty: string) => {
    const xs = rs.filter(f);
    return h(title, xs.length ? String(xs.length) : '') + (xs.length ? rows(xs.map((r) => row(w, r))) : quiet(empty)) + (note && xs.length ? `<p class="ui-note">${note}</p>` : '');
  };
  out += group('What you promised', 'A promise kept is remembered; one broken is remembered longer.', (r) => r.mine && r.m.kind === 'promise', 'You have given nobody your word on anything still to do.');
  out += group('What you were promised', '', (r) => !r.mine && r.m.kind === 'promise', 'Nobody has promised you anything that is still to come.');
  out += group('Agreed terms', '', (r) => r.m.kind === 'agreement' || r.m.kind === 'favour', 'No arrangements on record.');
  out += group('Hard words', 'What was said in anger stays said.', (r) => r.m.kind === 'threat', 'No threats or warnings between you and anyone.');
  return out;
}
