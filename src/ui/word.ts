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
  // favours, one row a man: how many either way, the latest of them, the largest
  const owed = of('owed'), owe = of('owing');
  const by = new Map<string, Commitment[]>();
  for (const r of [...owed, ...owe]) by.set(r.with, [...(by.get(r.with) ?? []), r]);
  const N = (k: number) => ['no', 'a', 'two', 'three', 'four', 'five', 'six', 'seven'][k] ?? String(k);
  const favRows = [...by].filter(([id]) => w.chars[id]).sort((a, b) => b[1].length - a[1].length).map(([id, xs]): Row => {
    const c = w.chars[id], them = xs.filter((r) => r.kind === 'owed'), you = xs.filter((r) => r.kind === 'owing');
    const latest = xs.sort((a, b) => b.since - a.since)[0];
    const big = Math.max(...xs.map((r) => w.favours.find((f) => f.id === r.ref)?.size ?? 0));
    const fv = (k: number) => `${N(k)} favour${k > 1 ? 's' : ''}`;
    const t = them.length ? `${c.name} owes you ${fv(them.length)}${you.length ? `; you owe him ${you.length === 1 ? 'one' : N(you.length)}` : ''}` : `You owe ${c.name} ${fv(you.length)}`;
    return { face: avatar(c), title: esc(t), sub: `Latest: ${esc(latest.text)}, ${esc(agoWord(w.now, latest.since))}`, end: big ? esc(favourWord(big)) : '', tone: you.length && !them.length ? 'warn' : 'good', a: `ent:${c.id}` };
  });
  out += h('Favours', favRows.length ? `${owed.length} owed you · ${owe.length} you owe` : '');
  out += favRows.length ? rows(favRows) : quiet('Nobody owes you a favour, and you owe nobody. Do a man a good turn and he will remember it.');
  // the rest only when there is any
  const group = (title: string, note: string, xs: Commitment[]) => (xs.length ? h(title, String(xs.length)) + rows(xs.map((r) => row(w, r))) + (note ? `<p class="ui-note">${note}</p>` : '') : '');
  const more = group('What you promised', 'A promise kept is remembered; one broken is remembered longer.', of('mine')) + group('What you were promised', '', of('theirs')) + group('Agreed terms', '', of('terms')) + group('Hard words', 'What was said in anger stays said.', of('threat'));
  out += more || `<p class="ui-note">No promises, terms or hard words outstanding either way.</p>`;
  return out;
}
