// Where a man stands (The Family, October 2026; docs/family/AUDIT.md). Three things the family keeps apart, and the three layers of a
// career, all read from the world's own record, the same for the player and for every other man:
//
//   status     civilian, associate (on the family's record through a made man, not made), or made
//   position   the office he holds: soldier, captain, underboss, consigliere, boss, or acting boss while the boss is away
//   role       what he does for whom: a crewman of another man's operation, the man running a racket, a collector, a manager
//
//   record     what he has demonstrated (earning, reliability, leadership, discretion, service, experience, reputation, influence)
//   regard     how the men who decide see him (his own superior, the captain, the underboss, the consigliere, the boss)
//   prospects  what the record and the regard make him a credible candidate for, and whether there is a seat
//
// Rank (`c.rank`) stays the one stored ladder (applyRank, repairHierarchy); offices that are not rungs (consigliere, acting boss) sit
// on the family record (fam.consigliere, fam.acting). Nothing here is a promotion; promotions are decisions someone makes (career.ts).
import type { Character, World } from './types';

export type Status = 'civilian' | 'associate' | 'made';
export type Position = 'boss' | 'acting boss' | 'underboss' | 'consigliere' | 'captain' | 'soldier' | 'associate' | 'crewman' | 'none';
const MADE = new Set(['soldier', 'capo', 'underboss', 'boss']);
export const statusOf = (c: Character): Status => (MADE.has(c.rank) ? 'made' : c.rank === 'associate' ? 'associate' : 'civilian');
export const isConsigliere = (w: World, c: Character) => !!c.familyId && w.fam[c.familyId]?.consigliere === c.id;
export const isActing = (w: World, c: Character) => !!c.familyId && w.fam[c.familyId]?.acting === c.id;

export function positionOf(w: World, c: Character): Position {
  if (!c.alive) return 'none';
  if (isActing(w, c)) return 'acting boss';
  if (isConsigliere(w, c)) return 'consigliere';
  if (c.rank === 'boss') return 'boss';
  if (c.rank === 'underboss') return 'underboss';
  if (c.rank === 'capo') return 'captain';
  if (c.rank === 'soldier') return 'soldier';
  if (c.rank === 'associate') return 'associate';
  // a civilian who answers to someone in the life works in that man's operation: a crewman
  return c.bossId && w.chars[c.bossId]?.alive ? 'crewman' : 'none';
}
// How senior an office is, for authority: the consigliere sits beside the underboss; an acting boss is the boss while it lasts.
export const SENIORITY: Record<Position, number> = { none: -1, crewman: -1, associate: 0, soldier: 1, captain: 2, consigliere: 3, underboss: 3, 'acting boss': 4, boss: 4 };
export const seniority = (w: World, c: Character) => SENIORITY[positionOf(w, c)];
export const POSITION_WORD: Record<Position, string> = { boss: 'Boss', 'acting boss': 'Acting boss', underboss: 'Underboss', consigliere: 'Consigliere', captain: 'Captain', soldier: 'Soldier', associate: 'Associate', crewman: 'Crewman', none: '' };

// What he does for whom, in words: the operational side of a man, apart from his status and his office.
export function roleOf(w: World, c: Character): string | undefined {
  const s = c.bossId ? w.chars[c.bossId] : undefined;
  const runs = w.ops.find((o) => o.runner === c.id && (o.state === 'running' || o.state === 'raided'));
  if (runs) return `runs ${w.chars[runs.owner]?.name.split(' ')[0] ?? 'a man'}’s ${({ chop: 'chop shop', numbers: 'numbers bank', fencing: 'fence', bookie: 'book' } as Record<string, string>)[runs.kind] ?? 'racket'}`;
  if (w.path?.lieut === c.id) return 'your right hand';
  const mgr = Object.values(w.biz).find((b) => b.open && b.managerId === c.id);
  if (mgr) return `manages ${mgr.name}`;
  if (s && (positionOf(w, c) === 'crewman' || (c.rank === 'associate' && s.rank !== 'capo'))) return `in ${s.isPlayer ? 'your' : s.name.split(' ')[0] + '’s'} crew`;
  if (Object.values(w.biz).some((b) => b.open && b.protection?.collectorId === c.id)) return 'collects protection';
  return undefined;
}
// Who a man's own people are, by what he is: a captain has his crew (the recognised crew of made men, and their people); below that a
// man has crewmen, whatever their status, men of his own operation; only a captain's is a crew in the family's sense.
export const peopleWord = (w: World, c: Character) => (c.rank === 'capo' || c.rank === 'underboss' || c.rank === 'boss' ? 'crew' : 'crewmen');

// ------------------------------------------------------------------------------------------------ the record: what he has shown
export interface Dim { key: string; label: string; v: number; word: string; note: string }
const WORDS: Record<string, string[]> = {
  earning: ['Small', 'Modest', 'Steady', 'Strong', 'Exceptional'],
  reliability: ['Unreliable', 'Patchy', 'Dependable', 'Respected', 'Never lets anyone down'],
  leadership: ['None yet', 'Developing', 'Proven with a few men', 'Proven', 'A natural'],
  discretion: ['Loud', 'Careless', 'Careful', 'Quiet', 'A closed book'],
  service: ['Little', 'Some', 'Regular', 'Valued', 'Indispensable'],
  experience: ['Green', 'Some', 'Seasoned', 'Hardened', 'Veteran'],
  reputation: ['Unknown', 'Known', 'Respected', 'Well respected', 'A name'],
  influence: ['Few friends', 'Some friends', 'Well liked', 'Connected', 'Men listen to him'],
};
const word = (k: string, v: number) => WORDS[k][Math.min(4, Math.floor(Math.max(0, v) * 5))];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// what a man of his place in the family is expected to bring in, a week, before kick-up
const EXPECT: Record<string, number> = { civilian: 120, associate: 180, soldier: 450, capo: 1000, underboss: 1600, boss: 2500 };

export function careerRecord(w: World, c: Character): Dim[] {
  const h = c.books.history.slice(-10);
  const rec = c.career ?? { done: 0, failed: 0, log: [] };
  const out: Dim[] = [];
  const d = (key: string, label: string, v: number, note: string) => out.push({ key, label, v: clamp01(v), word: word(key, clamp01(v)), note });
  // earning: what he has been bringing in lately against what a man in his place brings, and what he has passed up in all
  const avg = h.length ? h.reduce((a, x) => a + (x.gross ?? 0), 0) / h.length : 0;
  d('earning', 'Earning', avg / (EXPECT[c.rank] ?? 200) * 0.5 + Math.min(0.3, c.lifetimeKick / 40000), h.length ? `about $${Math.round(avg / 10) * 10} a week lately` : 'nothing on the books yet');
  // reliability: envelopes in full and on time, his word, his work
  const due = h.filter((x) => x.due > 0), full = due.filter((x) => x.paid >= x.due * 0.9).length;
  const kept = c.rep?.kept ?? 0, broke = c.rep?.broken ?? 0, jobs = rec.done + rec.failed;
  const parts = [due.length ? full / due.length : 0.6, kept + broke ? kept / (kept + broke) : 0.6, jobs ? rec.done / jobs : 0.6];
  d('reliability', 'Reliability', parts.reduce((a, x) => a + x, 0) / 3 - (c.books.missed > 1 ? 0.15 : 0), [due.length ? `${full} of ${due.length} envelopes in full` : '', broke ? `${broke} broken ${broke === 1 ? 'promise' : 'promises'}` : kept ? 'keeps his word' : '', jobs ? `${rec.done} of ${jobs} jobs done` : ''].filter(Boolean).join(', ') || 'not tested yet');
  // leadership: men led, for how long, and what they did on his word
  const now = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id).length;
  d('leadership', 'Leadership', Math.min(0.5, (rec.lw ?? 0) / 40) + Math.min(0.3, (rec.led ?? 0) / 25) + Math.min(0.2, (rec.ruled ?? 0) / 8), now || rec.lw ? `${now} ${now === 1 ? 'man' : 'men'} under him now${rec.lw ? `, ${rec.lw} weeks leading men` : ''}${rec.led ? `, ${rec.led} jobs done on his orders` : ''}` : 'has never led men');
  // discretion: heat kept down, never picked up, nothing said
  const arrests = Object.values(w.facts).filter((f) => f.kind === 'arrest' && f.actor === c.id).length;
  d('discretion', 'Discretion', 0.85 - c.heat * 0.5 - arrests * 0.15 - (c.informant ? 0.6 : 0), `${arrests ? `picked up ${arrests} ${arrests === 1 ? 'time' : 'times'}` : 'never picked up'}${c.heat > 0.35 ? ', and the police are watching him' : ''}`);
  // service: work done for the men above him, on their word
  d('service', 'Service to the family', Math.min(1, (rec.svc ?? 0) / 12), rec.svc ? `${rec.svc} ${rec.svc === 1 ? 'job' : 'jobs'} done for the men above him` : 'nothing done for the men above him yet');
  // experience: the work itself, the rough work and the family's hard work
  d('experience', 'Experience', Math.min(1, (rec.done + (rec.rough ?? 0) + (rec.hard ?? 0) * 3) / 30), `${rec.done} jobs${rec.rough ? `, ${rec.rough} rough` : ''}${rec.hard ? `, ${rec.hard} for the family's hard work` : ''}`);
  // reputation: what is said of him
  d('reputation', 'Reputation', c.standing / 70, c.standing >= 45 ? 'people speak well of him' : c.standing >= 25 ? 'known as a man who gets things done' : 'not much said yet');
  // influence: who trusts him, who owes him, made men among them
  const trusting = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && (x.rels[c.id]?.trust ?? 0) >= 0.45);
  const made = trusting.filter((x) => MADE.has(x.rank)).length;
  const owed = (w.favours ?? []).filter((f) => !f.settled && f.to === c.id).length;
  d('influence', 'Influence', Math.min(0.5, trusting.length / 16) + Math.min(0.3, made / 6) + Math.min(0.2, owed / 6), `${trusting.length} men trust him, ${made} of them made${owed ? `; ${owed} owe him` : ''}`);
  return out;
}

// ------------------------------------------------------------------------------------------------ regard: how the men who decide see him
export interface View { who: Character; role: string; word: string; v: number; known: boolean }
function viewOf(w: World, by: Character, c: Character): { v: number; word: string } {
  const r = by.rels[c.id];
  if (!r) return { v: 0, word: 'hardly knows him' };
  const v = r.trust * 0.5 + r.respect * 0.4 + (r.affection ?? 0) * 0.1 - r.grudge * 0.9;
  return { v, word: r.grudge > 0.3 ? 'holds something against him' : v > 0.6 ? 'thinks highly of him' : v > 0.4 ? 'rates him' : v > 0.22 ? 'hasn’t made up his mind' : (r.known ?? 0) < 0.15 ? 'hardly knows him' : 'has doubts about him' };
}
// The men whose view of him matters to his career, and whether he could know what each thinks (men he has dealt with).
export function regardOf(w: World, c: Character): View[] {
  if (!c.familyId) return [];
  const f = w.fam[c.familyId], boss = w.chars[f.bossId];
  const sup = c.bossId ? w.chars[c.bossId] : undefined;
  const cap = (() => { let x = sup; while (x && x.rank !== 'capo' && x.bossId) x = w.chars[x.bossId]; return x?.rank === 'capo' ? x : undefined; })();
  const ub = Object.values(w.chars).find((x) => x.alive && x.familyId === c.familyId && x.rank === 'underboss');
  const con = f.consigliere ? w.chars[f.consigliere] : undefined;
  const out: View[] = [];
  const add = (x: Character | undefined, role: string) => { if (!x?.alive || x.id === c.id || out.some((o) => o.who.id === x.id)) return; const v = viewOf(w, x, c); out.push({ who: x, role, word: v.word, v: v.v, known: (c.rels[x.id]?.known ?? 0) >= 0.2 || (x.rels[c.id]?.known ?? 0) >= 0.3 }); };
  add(sup, sup && sup.rank === 'capo' ? 'your captain' : 'the man you answer to');
  add(cap, 'your captain');
  add(ub, 'the underboss');
  add(con, 'the consigliere');
  add(boss, 'the boss');
  return out;
}
export const standingWordOf = (vs: View[]) => { if (!vs.length) return 'outside the family'; const t = vs.reduce((a, v) => a + v.v * (v.role === 'the boss' ? 1.5 : 1), 0) / vs.reduce((a, v) => a + (v.role === 'the boss' ? 1.5 : 1), 0); return t > 0.55 ? 'well regarded' : t > 0.38 ? 'in good standing' : t > 0.22 ? 'still to prove himself' : 'on thin ice'; };

// ------------------------------------------------------------------------------------------------ prospects: what he is credible for
export interface Prospect { office: string; credible: boolean; seat: boolean; strong: string[]; short: string[]; line: string }
const pick = (rec: Dim[], k: string) => rec.find((x) => x.key === k)!.v;
export function prospectsOf(w: World, c: Character): Prospect[] {
  if (!c.familyId) return [];
  const rec = careerRecord(w, c), vs = regardOf(w, c);
  const reg = vs.length ? vs.reduce((a, v) => a + v.v, 0) / vs.length : 0;
  const fam = w.fam[c.familyId];
  const members = Object.values(w.chars).filter((x) => x.alive && x.familyId === c.familyId);
  const capos = members.filter((x) => x.rank === 'capo' && fam.consigliere !== x.id).length;
  const want = (office: string, needs: [string, number][], regNeed: number, seat: boolean): Prospect => {
    const strong = needs.filter(([k, n]) => pick(rec, k) >= n).map(([k]) => rec.find((x) => x.key === k)!.label.toLowerCase());
    const short = needs.filter(([k, n]) => pick(rec, k) < n).map(([k]) => rec.find((x) => x.key === k)!.label.toLowerCase());
    const credible = short.length <= 1 && reg >= regNeed;
    const line = credible ? (seat ? `A credible candidate, and there is a seat.` : `A credible candidate, but no seat is open.`) : short.length ? `Still short on ${short.join(' and ')}${reg < regNeed ? ', and not yet well enough regarded' : ''}.` : `The record is there; the men who decide aren’t there yet.`;
    return { office, credible, seat, strong, short, line };
  };
  const out: Prospect[] = [];
  if (c.rank === 'associate') out.push(want('Being made', [['reliability', 0.5], ['service', 0.3], ['earning', 0.3], ['reputation', 0.35]], 0.3, true));
  if (c.rank === 'soldier') out.push(want('Captain', [['earning', 0.5], ['leadership', 0.35], ['reliability', 0.55], ['influence', 0.35]], 0.42, capos < Math.max(3, Math.ceil(members.length / 10))));
  if (c.rank === 'capo' && fam.consigliere !== c.id) out.push(want('Underboss', [['leadership', 0.55], ['reliability', 0.6], ['influence', 0.5], ['service', 0.4]], 0.55, !members.some((x) => x.rank === 'underboss')));
  if (MADE.has(c.rank) && c.rank !== 'boss' && fam.consigliere !== c.id) out.push(want('Consigliere', [['discretion', 0.6], ['reputation', 0.5], ['influence', 0.45], ['reliability', 0.6]], 0.55, !fam.consigliere || !w.chars[fam.consigliere]?.alive));
  return out;
}

// Once a week: every man with men under him has led them another week (the leadership a record reads).
export function recordWeek(w: World) {
  const under = new Map<string, number>();
  for (const c of Object.values(w.chars)) if (c.alive && c.bossId) under.set(c.bossId, (under.get(c.bossId) ?? 0) + 1);
  for (const [id] of under) { const c = w.chars[id]; if (c?.alive) { const r = (c.career ??= { done: 0, failed: 0, log: [] }); r.lw = (r.lw ?? 0) + 1; } }
}
// A quarrel between his men, or between men who came to him, settled by him: part of what a leader is known for.
export function noteRuling(c: Character) { const r = (c.career ??= { done: 0, failed: 0, log: [] }); r.ruled = (r.ruled ?? 0) + 1; }
