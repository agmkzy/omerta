// Plays the game with a simple policy to check the job system works end to end.
// Usage: tsx src/bot.ts [seed] [days]
import { money } from './core';
import { advance } from './engine';
import { RULINGS, auditMember, influence, rule, setStance } from './books';
import { choose, closeMeeting, current, openAccountsMeeting, openCrewMeeting, openFamilyMeeting, openGathering, openSitdown } from './meetings';
import { approaches, assign, crewMoves, performMove, resolve, schemes, startScheme, takeJob, topicOptions } from './jobs';
import { createWorld } from './world';

const seed = Number(process.argv[2] ?? 3);
const days = Number(process.argv[3] ?? 120);
const w = createWorld(seed);
const p = w.chars[w.playerId!];
const stats: Record<string, number> = {};
const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1);

function runMeeting(m: ReturnType<typeof openCrewMeeting>): number {
  if (typeof m === 'string') return 0;
  let guard = 0;
  while (current(m) && guard++ < 30) {
    const it = current(m)!;
    if (!it.opts.length) break;
    choose(w, p, m, w.rng.pick(it.opts).code);
  }
  return closeMeeting(w, p, m).minutes;
}

while (w.now < days * 1440 && p.alive) {
  for (const j of w.jobs.filter((q) => q.kind === 'summons' && q.status === 'offered')) {
    if (w.rng.chance(0.2)) continue;
    const m = j.meeting === 'accounts' ? openAccountsMeeting(w, p, j) : j.meeting === 'family' ? openFamilyMeeting(w, p, j) : j.meeting === 'sitdown' ? (w.grievances.find((g) => g.id === j.extra?.g) ? openSitdown(w, p, w.grievances.find((g) => g.id === j.extra?.g)!) : 'gone') : openCrewMeeting(w, p);
    if (j.meeting === 'sitdown') j.status = 'done';
    if (typeof m !== 'string') bump('summons:' + j.meeting);
    runMeeting(m);
  }
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.jailedUntil <= w.now);
  let spent = 0;
  const open = w.jobs.filter((j) => j.status === 'offered');
  for (const j of open) {
    const roll = w.rng.next();
    if (roll < 0.25) continue; // ignore (it will expire)
    if (j.kind === 'hit' && roll < 0.8) {
      j.status = 'declined';
      bump('decline');
      continue;
    }
    if (crew.length && roll > 0.55) {
      assign(w, j, w.rng.pick(crew).id, w.rng.chance(0.5) ? 'quiet' : 'hard');
      bump('delegate:' + j.kind);
    } else {
      const ap = approaches(w, j);
      if (!ap.length) continue;
      takeJob(w, j);
      const r = resolve(w, j, w.rng.pick(ap).code);
      spent += r.minutes;
      bump((r.ok ? 'ok:' : 'fail:') + j.kind);
    }
  }
  if (w.rng.chance(0.3)) {
    const s = schemes(w, p);
    const o = w.rng.pick(s);
    if (o.job) {
      const j = startScheme(w, p, o.job);
      const r = resolve(w, j, w.rng.pick(approaches(w, j)).code);
      spent += r.minutes;
      bump((r.ok ? 'scheme-ok:' : 'scheme-fail:') + j.kind);
    } else if (o.move) {
      spent += performMove(w, o.move).minutes;
      bump('move:' + o.move.kind);
    }
  }
  if (w.rng.chance(0.1)) setStance(p, w.rng.pick(['honest', 'honest', 'shave', 'stall'] as const));
  if (crew.length && w.rng.chance(0.25)) {
    const sub = w.rng.pick(crew);
    spent += auditMember(w, p, sub).minutes;
    if (p.books.flags[sub.id]?.amt) spent += rule(w, p, sub, w.rng.pick(RULINGS).code).minutes;
    bump('audit');
  }
  if (w.rng.chance(0.2)) {
    const m = openCrewMeeting(w, p);
    if (typeof m !== 'string') bump('crew-meeting');
    spent += runMeeting(m);
  }
  if (w.rng.chance(0.05)) {
    const guests = Object.keys(p.rels).filter((id) => w.chars[id]?.alive && w.chars[id].rank !== 'civilian').slice(0, 4);
    const m = openGathering(w, p, guests);
    if (typeof m !== 'string') bump('dinner');
    spent += runMeeting(m);
  }
  if (w.rng.chance(0.2)) {
    const t = w.chars[w.rng.pick(Object.keys(p.rels))];
    if (t?.alive) {
      const tops = topicOptions(w, p, t);
      spent += performMove(w, w.rng.pick(tops)).minutes;
      bump('topic');
    }
  }
  advance(w, w.now + Math.max(spent, 12 * 60));
}
const kinds: Record<string, number> = {};
for (const f of Object.values(w.facts)) if (!f.minor) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
const dead = Object.values(w.chars).filter((c) => !c.alive).length;
console.log(`seed ${seed}: day ${Math.floor(w.now / 1440)}, cash ${money(p.cash)}, standing ${p.standing}, influence ${influence(w, p)}, arrears ${p.books.arrears}, heat ${p.heat.toFixed(2)}, dead ${dead}`);
console.log('player:', JSON.stringify(stats));
console.log('world:', JSON.stringify(kinds));
console.log('jobs:', JSON.stringify(w.jobs.reduce((a: Record<string, number>, j) => ((a[j.status] = (a[j.status] ?? 0) + 1), a), {})), 'ventures', w.ventures.length);
