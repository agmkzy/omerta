// What an NPC does with his time, in a world running the conversation layer (Gate 2b completion). The world still says what there is
// to do and what each thing is worth by its own measure (actions.generate: a shift's pay, a debt due, a shop on his ground, a grudge
// to settle); the choice is made by respond.onDay with the motives every other decision of his uses: what he is pursuing (he goes to
// see the man he has promised to see), what binds him (an order or his word, weighed as he weighs it: conv/obey), and whom he is
// avoiding (the man troubling him). Execution is the world's own (actions.perform).
import { dayDecider } from '../actions';
import type { Action, Character, World } from '../types';
import { newSession, perceive } from './perception';
import { onDay, type DayOption } from './respond';
import { breakWish } from './obey';
import { social } from './social';

dayDecider.f = (w: World, c: Character, all: Action[]): Action => {
  if (!all.length) return { kind: 'wait', actor: c.id, hours: 1, label: '', score: 0 };
  const s = social(w), mine = (s.pursuits ?? []).filter((p) => p.who === c.id && p.status === 'active');
  const owesVisit = new Set(s.obs.filter((o) => o.status === 'pending' && o.obligor === c.id && o.spec.kind === 'actionDone' && o.spec.target).map((o) => (o.spec as { target: string }).target));
  const troubles = new Set(mine.filter((p) => p.kind === 'stopTrouble').map((p) => p.against));
  const opts: DayOption[] = all.map((a, i) => {
    const t = a.target ? w.chars[a.target] : undefined;
    const harm = a.kind === 'shakedown' || a.kind === 'retaliate';
    const wish = harm && t ? breakWish(w, c, t.id, a.biz) : undefined;
    return {
      key: `${i}:${a.kind}${t ? ':' + t.id : ''}`, kind: a.kind, worth: a.score, target: t, bound: wish,
      serves: a.kind === 'socialise' && t && owesVisit.has(t.id) ? `he has something to raise with ${t.name}` : undefined,
      avoids: t && troubles.has(t.id) && a.kind === 'socialise' ? `${t.name} is the man troubling him` : undefined,
    };
  });
  const d = onDay(perceive(w, newSession(), c), opts, () => w.rng.next() * 0.12);
  return all[d.pick];
};
