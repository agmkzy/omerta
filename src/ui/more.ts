// More (the redesign, owner 26 October): everything worth having that isn't play itself, out of the way of the five destinations.
// The city's paper, the full record, your milestones and old scores, honest work, and the game's own saves.
import { knownRoom, savesFold } from './lifeview';
import { cityShops } from './views_b';
import { rows, title, type Row } from './kit';
import { P, S, W } from './links';

const group = (name: string, rs: Row[]) => `<h2 class="ui-h">${name}</h2>` + rows(rs);

export function moreView(): string {
  if (S.sub.more === 'known') return `<button class="ui-back" data-a="sub:more.menu">‹ More</button>` + knownRoom();
  if (S.sub.more === 'shops') return `<button class="ui-back" data-a="sub:more.menu">‹ More</button>` + cityShops();
  if (S.sub.more === 'saves') return `<button class="ui-back" data-a="sub:more.menu">‹ More</button>` + title('Saves and backups') + savesFold(true);
  const w = W(), p = P();
  const papers = (w.papers ?? []).length;
  let out = title('More');
  out += group('The city', [
    { title: 'The Herald', sub: papers ? `${papers} ${papers === 1 ? 'edition' : 'editions'}. The city’s paper, every Monday.` : 'The first edition comes out on Monday.', a: 'brief:' },
    { title: 'Who’s where', sub: 'Everyone you know, and where they are right now.', a: 'people:' },
    { title: 'The city’s shops', sub: 'Every shop, and which family holds it, as far as you know.', a: 'sub:more.shops' },
  ]);
  out += group('Your record', [
    { title: 'What you know', sub: 'Everything you have seen or been told, newest first.', a: 'sub:more.known' },
    { title: 'Milestones', sub: `What a man is expected to manage as ${p.rank === 'associate' ? 'an' : 'a'} ${p.rank === 'capo' ? 'captain' : p.rank}.`, a: 'goals:' },
    { title: 'Scores to settle', sub: 'The men who have crossed you, and what you could do about it.', a: 'grudges:' },
  ]);
  out += group('Work', [
    { title: p.job ? 'Your job' : 'Honest work', sub: p.job ? `${p.job.kind}. Shifts, pay, and cover.` : 'A clean job buys cover, and a little money.', a: 'dayjob:' },
  ]);
  out += group('The game', [
    { title: 'Saves and backups', sub: 'Save, download a copy, go back a day, or start a new life.', a: 'sub:more.saves' },
  ]);
  return out;
}
