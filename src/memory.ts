// V77: a man remembers what happened between you.
//
// Everything here is read from records the game already keeps (favours, completed jobs, the sponsor ledger, facts he knows the
// actor of, your rank and standing). A memory is only spoken when that record exists, and it is spoken at most once a day per man
// and not in every conversation, so it stays an occasional remark and not a summary of the relationship.
import { hash } from './voice';
import { say, rk, surname } from './voicesheet';
import { ledgerOf } from './powers2';
import type { Character, Fact, World } from './types';

const DAY = 1440;
const HARM = new Set(['beating', 'vandalism', 'robbery', 'burglary', 'theft', 'scam', 'poach']);

// What was done, as the man it was done for would say it: "covering $200 of his envelope" -> "covering $200 of my envelope".
const mine = (s: string) => s.replace(/\bhis\b/g, 'my').replace(/\bhim\b/g, 'me').replace(/\bhe\b/g, 'I').replace(/\bhe’s\b/g, 'I’m');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface Memory { kind: 'broken' | 'harm' | 'favour' | 'owe' | 'sponsor' | 'made' | 'origin' | 'job' | 'rank' | 'name'; line: string }

// The one thing he might bring up today, if there is anything. Never invents: each branch needs its own record.
export function recall(w: World, p: Character, t: Character): Memory | undefined {
  if (t.id === p.id || !t.alive) return undefined;
  const day = Math.floor(w.now / DAY);
  if ((p.cooldown[`recall:${t.id}`] ?? -1) >= day) return undefined; // once a day per man
  const roll = hash(`${t.id}:${day}`) % 6; // and not every day: some conversations are just conversations

  // Each kind of memory comes up at most once a fortnight with the same man: a callback, not a refrain.
  const cool = (k: string) => (p.cooldown[`recallk:${t.id}:${k}`] ?? -1) >= day;
  const out = (kind: Memory['kind'], line: string): Memory => { p.cooldown[`recall:${t.id}`] = day; p.cooldown[`recallk:${t.id}:${kind}`] = day + 14; return { kind, line }; };

  // 1. something you did to him that he knows you did
  const harm = Object.values(w.facts).filter((f: Fact) => f.actor === p.id && f.victim === t.id && HARM.has(f.kind) && t.known[f.id]?.knowsActor && w.now - f.t < 120 * DAY).sort((a, b) => b.t - a.t)[0];
  if (harm && roll < 3 && !cool('harm')) return out('harm', say(w, t, p, 'recall_harm'));

  // 1b. a word you gave him and did not keep (the record the game itself wrote when the promise fell due)
  const broke = Object.values(w.facts).find((f: Fact) => f.kind === 'ruling' && f.actor === p.id && f.victim === t.id && /keep his word/.test(f.text) && w.now - f.t < 60 * DAY);
  if (broke && roll < 3 && !cool('broken')) return out('broken', say(w, t, p, 'recall_broken'));

  // 2. a favour either way
  const fav = w.favours.filter((f) => !f.settled && f.from === p.id && f.to === t.id).sort((a, b) => b.size - a.size)[0];
  if (fav && roll < 3 && !cool('favour')) {
    const what = mine(fav.what);
    return out('favour', say(w, t, p, 'recall_favour', { what, What: cap(what) }));
  }
  const owes = w.favours.find((f) => !f.settled && f.from === t.id && f.to === p.id);
  if (owes && roll === 0 && !cool('owe')) return out('owe', say(w, t, p, 'recall_owe'));

  if (roll > 2) return undefined;

  // 3. the people who stood for you, and the people you stood for
  const led = ledgerOf(w, t.id);
  if (!cool('sponsor') && led.some((e) => e.kind === 'sponsor' || e.kind === 'backer')) return out('sponsor', say(w, t, p, 'recall_sponsor'));
  if (!cool('made') && led.some((e) => e.kind === 'made')) return out('made', say(w, t, p, 'recall_made'));
  if (!cool('origin') && w.path?.origin?.includes(t.id) && t.bossId === p.id) return out('origin', say(w, t, p, 'recall_origin'));

  // 4. work he gave you that you did
  const done = w.jobs.filter((j) => j.status === 'done' && j.giver === t.id && j.assignee === p.id && w.now - j.created < 60 * DAY).length;
  if (done && !cool('job')) return out('job', say(w, t, p, 'recall_job'));

  // 5. how your position reads to him: only a man who is not a civilian, only when you outrank him, and your name as it stands
  if (!cool('rank') && t.rank !== 'civilian' && rk(p) > rk(t)) return out('rank', say(w, t, p, 'recall_rank_up', { S: surname(p) }));
  if (!cool('name') && t.rank !== 'civilian' && rk(t) >= 2 && p.standing >= 70) return out('name', say(w, t, p, 'recall_name_good'));
  if (!cool('name') && t.rank !== 'civilian' && rk(t) >= 2 && p.standing <= 30) return out('name', say(w, t, p, 'recall_name_bad'));
  return undefined;
}
