// Journal › Your word: every obligation between the player and another man, in one place, read from the records that own them
// (commitments.ts): work he has taken on, what he promised and what was promised him, favours either way, the terms agreed and the
// warnings given. What is settled or done is not listed. Each row leads to the man.
import { commitmentsOf, type Commitment } from '../commitments';
import { favourWord } from '../encounters';
import type { World } from '../types';
import { avatar } from './common';
import { h, quiet, rows, type Row } from './kit';
import { esc, P, W } from './links';
import { byWhenWord } from './when';
import { agoWord } from './lifeview';

const row = (w: World, r: Commitment, title?: string): Row => {
  const c = w.chars[r.with], due = r.due ? (r.due <= w.now ? 'it was due' : byWhenWord(w.now, r.due)) : '';
  const f = r.src === 'favour' ? w.favours.find((x) => x.id === r.ref) : undefined;
  return { face: avatar(c), title: esc(title ?? r.text), sub: `${esc(c.name)} · ${esc(agoWord(w.now, r.since))}${title ? ' · ' + esc(r.text) : ''}`, end: f ? esc(favourWord(f.size)) : due ? esc(due) : '', tone: r.kind === 'owed' ? 'good' : r.late ? 'bad' : r.due ? 'warn' : r.kind === 'owing' ? 'warn' : '', a: `talk:${c.id}` };
};

export function wordRoom(): string {
  const w = W(), p = P(), all = commitmentsOf(w, p);
  const of = (k: Commitment['kind']) => all.filter((r) => r.kind === k);
  let out = '';
  const work = of('work');
  if (work.length) out += h('Work you took on', String(work.length)) + rows(work.map((r) => row(w, r))) + '<p class="ui-note">It is done when what it asks for is done, however you go about it.</p>';
  const owed = of('owed'), owe = of('owing');
  out += h('Favours', owed.length + owe.length ? `${owed.length} owed you · ${owe.length} you owe` : '');
  if (!owed.length && !owe.length) out += quiet('Nobody owes you a favour, and you owe nobody. Do a man a good turn and he will remember it.');
  out += rows([...owed.map((r) => row(w, r, `${w.chars[r.with].name} owes you`)), ...owe.map((r) => row(w, r, `You owe ${w.chars[r.with].name}`))]);
  const group = (title: string, note: string, xs: Commitment[], empty: string) => h(title, xs.length ? String(xs.length) : '') + (xs.length ? rows(xs.map((r) => row(w, r))) : quiet(empty)) + (note && xs.length ? `<p class="ui-note">${note}</p>` : '');
  out += group('What you promised', 'A promise kept is remembered; one broken is remembered longer.', of('mine'), 'You have given nobody your word on anything still to do.');
  out += group('What you were promised', '', of('theirs'), 'Nobody has promised you anything that is still to come.');
  out += group('Agreed terms', '', of('terms'), 'No arrangements on record.');
  out += group('Hard words', 'What was said in anger stays said.', of('threat'), 'No threats or warnings between you and anyone.');
  return out;
}
