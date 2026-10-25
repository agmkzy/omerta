// The conversation walked across worlds (the coherence repair, phase 1): several seeds, several dates, every kind of man the player
// meets (his captain, made men of his family, shopkeepers, men of other families), each conversation played turn by turn along a
// different path. The rules checked are the ones a player would notice at once, read from the records where there are records:
//   nobody is asked to act against himself, or offered work by himself; nobody speaks of the player to his face as a third man in the
//   matter; the player never speaks of himself, or of the man in front of him, as somebody else; a thing said for the first time is not
//   "again"; and a man does not say the same long line twice in one conversation.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY, type Character, type World } from '../../types';
import { P } from '../helpers';
import { Talk, aboutHimToHim, selfChoices, selfJobs, selfRequests, thirdPersonSelf, worldFor } from './play';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
function cast(w: World): Character[] {
  const p = P(w), all = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.jailedUntil <= w.now).sort(byId);
  const cap = w.chars[p.bossId!];
  const fam = all.filter((c) => c.familyId === p.familyId && c.id !== cap?.id).slice(0, 4);
  const shops = all.filter((c) => c.rank === 'civilian' && Object.values(w.biz).some((b) => b.ownerId === c.id && b.open)).slice(0, 4);
  const rivals = all.filter((c) => c.familyId && c.familyId !== p.familyId && c.rank !== 'boss').slice(0, 2);
  return [...(cap?.alive ? [cap] : []), ...fam, ...shops, ...rivals];
}
// a path through a conversation: at each turn the k-th thing that can be said (skipping the ways out), so different walks go different ways
function walk(w: World, n: Character, k: number, problems: string[], seen: Set<string>) {
  const t = new Talk(w, n, { seen });
  for (let i = 0; i < 6 && !t.ended; i++) {
    const cs = t.v.choices.filter((c) => c.group !== 'leave' && !/^(home|back|u:|all:)/.test(c.id) && !c.amount);
    const heads = t.v.choices.filter((c) => /^u:/.test(c.id));
    const c = cs.length ? cs[(k + i) % cs.length] : heads[(k + i) % Math.max(1, heads.length)];
    if (!c) break;
    t.say(c.id);
  }
  const where = `${n.name} (${n.rank}), walk ${k}, day ${Math.floor(w.now / DAY)}`;
  for (const l of thirdPersonSelf(w, t.his())) problems.push(`${where}: speaks of the player as a third man: ${l}`);
  for (const c of selfChoices(w, t.turns.flatMap((x) => x.choices))) problems.push(`${where}: the player would speak of himself as another man: ${c.label}`);
  for (const c of aboutHimToHim(n, t.turns.flatMap((x) => x.choices), w)) problems.push(`${where}: the player would ask him about himself as another man: ${c.label}`);
  for (const x of t.falseRepeats()) problems.push(`${where}: "again" to something said for the first time: ${x.label} → ${x.his.join(' ')}`);
  const long = t.his().filter((l) => l.length > 40), once = new Set<string>();
  for (const l of long) { if (once.has(l)) problems.push(`${where}: says the same thing twice: ${l}`); once.add(l); }
  t.leave();
}

describe('conversations walked across seeds and dates', { tags: ['property'] }, () => {
  for (const seed of [3, 7, 11]) ok(`seed ${seed}: days 0, 20 and 45`, () => {
    const w = worldFor(seed), problems: string[] = [], seen = new Set<string>();
    for (const day of [0, 20, 45]) {
      advance(w, Math.max(w.now, day * DAY));
      for (const n of cast(w)) for (const k of [0, 1, 2]) walk(w, n, k, problems, seen);
      for (const r of selfRequests(w)) problems.push(`day ${day}: a request asks ${w.chars[r.of]?.name} to act against himself (${r.wants} ${r.about})`);
      for (const j of selfJobs(w)) problems.push(`day ${day}: work offered by a man to himself: ${j.title}`);
    }
    assert.deepEqual([...new Set(problems)].slice(0, 40), []);
  });
});
