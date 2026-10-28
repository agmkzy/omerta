// What a man can know of another man without being told (invariant A, docs/architecture/INVARIANTS.md). Two sources only:
//   seen      what the men around him can see of his life: that he is spending like a man with money, or going without, or has been
//             hurt. Seen by the men who are around him (his captain, his own men, his crew, the people who work his places, the
//             family's made men who meet at the club), never by trust alone. What is seen is a sign, not a finding: "he's spending more
//             than he brings in", never "he's skimming".
//   known     facts the man holds (`known`), with how he came by them; what a third man has said or done in front of him.
// A man's private state (his books, his problem, a matter's hidden truth) drives his own behaviour, which others may then see; it is
// never read directly into another man's mouth.
import { peek } from '../core';
import type { Character, Fact, World } from '../types';

// whether `who` is around `him` enough to see how he lives
export function seesLifeOf(w: World, who: Character, him: Character): boolean {
  if (who.id === him.id || !who.alive || !him.alive) return false;
  if (who.id === him.bossId || him.id === who.bossId) return true;
  if (who.bossId && who.bossId === him.bossId) return true;
  const made = (c: Character) => ['soldier', 'capo', 'underboss', 'boss'].includes(c.rank);
  if (made(who) && made(him) && who.familyId && who.familyId === him.familyId && ['capo', 'underboss', 'boss'].includes(him.rank)) return true; // (the men at the club see the captains)
  if (w.ops.some((o) => o.owner === him.id && (o.links ?? []).some((l) => l.id === who.id))) return true; // (works his racket)
  return (peek(who, him.id).known ?? 0) >= 0.5; // (knows him well: they see each other)
}
// what he lives like, as seen: weekly what he passes up against what he spends
export type Sign = 'flush' | 'short' | 'hurt';
export function signsOf(w: World, who: Character, him: Character): Sign[] {
  if (!seesLifeOf(w, who, him)) return [];
  const out: Sign[] = [];
  const h = him.books.history.slice(-4), paid = h.length ? h.reduce((a, x) => a + x.paid, 0) / h.length : 0;
  if (him.cash > Math.max(600, paid * 6)) out.push('flush');
  else if (him.cash < 60) out.push('short');
  if (him.hurtUntil > w.now) out.push('hurt');
  return out;
}
// what he has seen or heard a man do or say against another: facts he holds with that man as the doer and the other as the one done to
export function heardAgainst(w: World, who: Character, doer: Character, against: Character): Fact | undefined {
  return Object.keys(who.known).map((id) => w.facts[id]).filter((f): f is Fact => !!f && f.actor === doer.id && f.victim === against.id && (who.known[f.id].knowsActor ?? true)).sort((a, b) => b.t - a.t)[0];
}
