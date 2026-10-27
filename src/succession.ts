// Who the family means to raise (The Family, October 2026). Two things are kept apart, as the owner asked: whether a man is *ready*
// for a position (his record: standing.careerRecord) and whether he is the man the family *wants* (the people who decide, and why).
// Each office has its own way of being filled, from the same shared record:
//
//   induction      the family's line of associates it means to make, kept week to week (it doesn't reshuffle on a whim), and its
//                  books: closed, or open for a few men; when they open, the men at the head of the line are made, one at a time
//   captaincy      no queue: credible contenders, and when a crew needs a captain, the boss's choice among them, weighing the men he
//                  would command and the outgoing captain's own man
//   underboss      the boss's appointment, and the family's picture of who would be next
//   consigliere    the boss's appointment, for judgment, discretion and trust, not power
//   the chair      a recognised successor, named or understood; when the chair empties, politics decides (orgs.succeed)
//
// Every appointment is recorded with who made it, why, who was passed over and who backed it (fam.appts, the men's careers).
import { capOf, openSeatFor } from './career';
import { addFact, bear, rel } from './core';
import { consigliereChoice, logOrg, seatConsigliere } from './orgs';
import { careerRecord, regardOf } from './standing';
import { temper } from './temper';
import { WEEK, type Character, type Family, type Id, type World } from './types';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const live = (w: World, c?: Character) => !!c?.alive && c.jailedUntil <= w.now;
const membersOf = (w: World, fid: Id) => Object.values(w.chars).filter((c) => c.alive && c.familyId === fid);
const recV = (w: World, c: Character, keys: string[]) => { const r = careerRecord(w, c); return keys.reduce((a, k) => a + (r.find((x) => x.key === k)?.v ?? 0), 0) / keys.length; };
// how one man sees another, as the decision weighs it
const view = (by: Character | undefined, c: Character) => { const r = by?.rels[c.id]; return r ? r.trust * 0.5 + r.respect * 0.4 + (r.affection ?? 0) * 0.1 - r.grudge * 0.9 : 0; };

// ------------------------------------------------------------------------------------------------ the record of appointments
export interface Appt { t: number; office: string; who: Id; by?: Id; why: string; passed: Id[]; backers: Id[] }
export function recordAppt(w: World, fid: Id, a: Omit<Appt, 't'>) {
  const f = w.fam[fid];
  const x: Appt = { t: w.now, ...a };
  (f.appts ??= []).push(x);
  if (f.appts.length > 40) f.appts.splice(0, f.appts.length - 40);
  const c = w.chars[a.who], by = a.by ? w.chars[a.by] : undefined;
  if (c) (c.career ??= { done: 0, failed: 0, log: [] }).posts = [...(c.career.posts ?? []), { t: w.now, text: `${a.office}${by ? `, by ${by.name}` : ''}: ${a.why}`, by: a.by }];
  // the men passed over remember it, each as his nature takes it
  for (const id of a.passed) {
    const o = w.chars[id];
    if (!o?.alive || !c) continue;
    (o.career ??= { done: 0, failed: 0, log: [] }).posts = [...(o.career.posts ?? []), { t: w.now, text: `Passed over: ${c.name} was made ${a.office.toLowerCase()}`, by: a.by }];
    if (o.traits.ambition > 0.55 || temper(o).pride > 0.6) bear(w, o, c.id, 0.1 + o.traits.ambition * 0.1, `${c.name} was given what he wanted`);
    if (by && (o.traits.ambition > 0.7)) bear(w, o, by.id, 0.08, `${by.name} passed him over for ${c.name}`);
  }
}

// ------------------------------------------------------------------------------------------------ induction: the line and the books
// What the family thinks of an associate as a man to make: the men who decide (the boss, the underboss, his captain, whoever he works
// for), his record where it counts for this (reliability, service, earning, reputation), and the made men who would speak for him.
export function inductionStanding(w: World, c: Character): number {
  const vs = regardOf(w, c);
  const reg = vs.length ? vs.reduce((a, v) => a + v.v * (v.role === 'the boss' ? 1.4 : 1), 0) / vs.reduce((a, v) => a + (v.role === 'the boss' ? 1.4 : 1), 0) : 0;
  const backers = membersOf(w, c.familyId!).filter((x) => x.id !== c.id && ['soldier', 'capo', 'underboss', 'boss'].includes(x.rank) && rel(x, c.id).trust >= 0.4).length;
  return reg * 0.4 + recV(w, c, ['reliability', 'service', 'earning', 'reputation']) * 0.35 + Math.min(1, backers / 3) * 0.25;
}
// Is he someone the family would consider at all: on its record, free, not a hothead it has learned to distrust, with something shown.
const inductable = (w: World, c: Character) => c.rank === 'associate' && live(w, c) && !!c.familyId && recV(w, c, ['reliability', 'service', 'reputation']) >= 0.25 && !(c.informant?.exposed);
export function lineOf(w: World, fid: Id): Id[] { return (w.fam[fid]?.line ?? []).filter((id) => { const c = w.chars[id]; return !!c && c.alive && c.rank === 'associate' && c.familyId === fid; }); }

// Weekly: the line moves only when a man has clearly overtaken another (an intention held, not a ranking recomputed), and the books
// open when the family is short of made men and has men it wants, for as many as it needs.
export function inductionWeek(w: World, f: Family) {
  const boss = w.chars[f.bossId];
  if (!boss?.alive) return;
  const cands = membersOf(w, f.id).filter((c) => inductable(w, c));
  const score = new Map(cands.map((c) => [c.id, inductionStanding(w, c)] as const));
  let line = lineOf(w, f.id).filter((id) => score.has(id));
  for (const c of cands.sort(byId)) if (!line.includes(c.id) && (score.get(c.id) ?? 0) >= 0.25) line.push(c.id);
  // one pass of overtaking: a man moves ahead of the man before him only by a clear margin
  for (let i = 1; i < line.length; i++) if ((score.get(line[i]) ?? 0) > (score.get(line[i - 1]) ?? 0) + 0.06) [line[i - 1], line[i]] = [line[i], line[i - 1]];
  line = line.filter((id) => (score.get(id) ?? 0) >= 0.2).slice(0, 8);
  f.line = line;
  // the books open only for a reason the family has (The Family, owner 27 October: never as a reward for waiting): seats its shape has
  // room for; a captain whose crew is short of made men and says so; trouble with another family, when it wants more men it can count
  // on; a boss set on growing; or made men pressing for a man the boss himself thinks well of. The reason is said when they open.
  const head = line[0] ? w.chars[line[0]] : undefined;
  if (head?.id !== f.lineHead?.id) f.lineHead = head ? { id: head.id, since: w.now } : undefined;
  const why = booksReason(w, f, boss, head, score.get(head?.id ?? '') ?? 0);
  const open = booksOpen(w, f);
  if (!open && !f.booksClosed && why && line.length && (f.booksShut ?? 0) < w.now) {
    if (why.extra) openSeatFor(w, f.id, 'soldier');
    f.books = { since: w.now, until: w.now + 4 * WEEK, n: Math.min(2, why.n), made: 0, why: why.text };
    logOrg(w, f.id, 'books', `${boss.name} opened the books: ${why.text}.`);
    addFact(w, { kind: 'report', actor: boss.id, minor: false, text: `The ${f.name} family has opened its books: ${why.text}. ${f.books.n === 1 ? 'One man' : 'Two men'} will be made.`, district: boss.district }, { broadcast: membersOf(w, f.id).filter((c) => c.rank !== 'associate' || line.includes(c.id)).map((c) => c.id) });
  }
  if (open && (w.now > f.books!.until || f.books!.made >= f.books!.n)) { delete f.books; f.booksShut = w.now + 6 * WEEK; logOrg(w, f.id, 'books', `${boss.name} closed the books.`); }
}
// Why the books would open now, if they would: the family's own reasons, in the order a boss would meet them.
function booksReason(w: World, f: Family, boss: Character, head: Character | undefined, headStanding: number): { text: string; n: number; extra?: boolean } | undefined {
  const ms = membersOf(w, f.id);
  const soldiers = ms.filter((c) => c.rank === 'soldier').length;
  const room = Math.max(0, capOf(w, f.id, 'soldier') - soldiers);
  if (room > 0) return { text: room === 1 ? 'there is a seat to fill' : 'there are seats to fill', n: room };
  // a captain short of made men, who has asked for one
  const short = ms.filter((c) => c.rank === 'capo' && f.consigliere !== c.id && c.alive && ms.filter((x) => x.bossId === c.id && x.rank === 'soldier').length < 2);
  if (short.length && (f.cool?.['short'] ?? 0) < w.now) { (f.cool ??= {}).short = w.now + 10 * WEEK; return { text: `${short[0].name}’s crew is short of made men, and he asked`, n: 1, extra: true }; }
  // trouble with another family: a family at war wants men it can count on
  const war = Math.max(0, ...Object.values(f.tension));
  if (war >= 3 && (f.cool?.['war'] ?? 0) < w.now) { (f.cool ??= {}).war = w.now + 12 * WEEK; return { text: 'the trouble with another family needs men the family can count on', n: 1, extra: true }; }
  // made men pressing for a man the boss also thinks well of
  if (head && headStanding >= 0.4 && view(boss, head) >= 0.35 && (f.cool?.['press'] ?? 0) < w.now) {
    const backers = ms.filter((x) => ['soldier', 'capo', 'underboss'].includes(x.rank) && rel(x, head.id).trust >= 0.5 && x.id !== head.id);
    if (backers.length >= 2) { (f.cool ??= {}).press = w.now + 10 * WEEK; return { text: `${backers.slice(0, 2).map((x) => x.name).join(' and ')} have been pressing for ${head.name}`, n: 1, extra: true }; }
  }
  // a boss set on growing the family, with the money to carry more men
  if (boss.traits.ambition > 0.65 && (f.treasury ?? 0) > 2000 && (f.cool?.['grow'] ?? 0) < w.now) { (f.cool ??= {}).grow = w.now + 16 * WEEK; return { text: `${boss.name} wants the family bigger`, n: 1, extra: true }; }
  return undefined;
}
export const booksOpen = (w: World, f: Family) => !f.booksClosed && !!f.books && f.books.until > w.now && f.books.made < f.books.n;
// Who the family would make next, if the books are open: the first men in its line, as many as the books allow.
export function nextToMake(w: World, f: Family): Id[] { return booksOpen(w, f) ? lineOf(w, f.id).slice(0, f.books!.n - f.books!.made) : []; }
export function madeFromLine(w: World, f: Family, c: Character, by?: Character) {
  if (f.books) f.books.made++;
  const line = lineOf(w, f.id);
  f.line = line.filter((id) => id !== c.id);
  // (the boss authorises it; the man who put him forward is his backer)
  const rec = careerRecord(w, c).filter((d) => ['reliability', 'service', 'earning', 'reputation'].includes(d.key)).sort((a, b) => b.v - a.v)[0];
  const backers = membersOf(w, f.id).filter((x) => x.id !== c.id && ['soldier', 'capo', 'underboss'].includes(x.rank) && rel(x, c.id).trust >= 0.45);
  recordAppt(w, f.id, { office: 'Made', who: c.id, by: f.bossId, why: `${line[0] === c.id ? 'first in line' : 'in line'} when the books opened (${f.books?.why ?? 'the family needed men'}); ${rec ? `his ${rec.label.toLowerCase()} was ${rec.word.toLowerCase()}` : ''}${backers.length ? `, and ${backers.slice(0, 2).map((x) => x.name).join(' and ')} spoke for him` : ''}`, passed: [], backers: backers.map((x) => x.id) });
}
// The player's place in the line, as he could know it: told by a made man who trusts him (his sponsor, his captain), or not known.
export function lineAsTold(w: World, p: Character): { order: Id[]; by?: Id; t: number } | undefined { return w.path?.line; }
export function tellLine(w: World, p: Character, by: Character) { (w.path ??= { deeds: 0, counted: [], trial: {}, retry: {} }).line = { order: lineOf(w, p.familyId!).slice(0, 5), by: by.id, t: w.now }; }

// ------------------------------------------------------------------------------------------------ captaincy: contenders, not a queue
// How the boss weighs a soldier for a crew: his own view and his underboss's and consigliere's, the soldier's record where captaincy
// asks it (leadership, earning, reliability, influence), how the men he would command see him, and the outgoing captain's own man.
export function captaincyStanding(w: World, c: Character, crew?: Character[], outgoing?: Character): number {
  const f = w.fam[c.familyId!], boss = w.chars[f.bossId];
  const ub = membersOf(w, f.id).find((x) => x.rank === 'underboss'), con = f.consigliere ? w.chars[f.consigliere] : undefined;
  const fit = crew?.length ? crew.filter((x) => x.id !== c.id).reduce((a, x) => a + view(x, c), 0) / Math.max(1, crew.filter((x) => x.id !== c.id).length) : 0.3;
  const heir = outgoing && preferredSuccessor(w, outgoing)?.id === c.id ? 0.12 : 0;
  return view(boss, c) * 0.3 + view(ub, c) * 0.1 + view(con, c) * 0.05 + recV(w, c, ['leadership', 'earning', 'reliability', 'influence']) * 0.35 + fit * 0.2 + heir;
}
export interface Contender { c: Character; standing: number; word: string }
export function captaincyContenders(w: World, fid: Id): Contender[] {
  const f = w.fam[fid];
  return membersOf(w, fid).filter((c) => c.rank === 'soldier' && f.consigliere !== c.id && live(w, c) && recV(w, c, ['leadership', 'earning', 'reliability']) >= 0.3)
    .map((c) => ({ c, standing: captaincyStanding(w, c) })).sort((a, b) => b.standing - a.standing || byId(a.c, b.c))
    .map((x, i) => ({ ...x, word: i === 0 && x.standing > 0.35 ? 'the leading candidate' : x.standing > 0.3 ? 'a credible contender' : 'developing' })).slice(0, 6);
}
// A captain's own choice for his chair: the man in his crew he trusts most who could do it (the player names his: path.successor).
export function preferredSuccessor(w: World, capo: Character): Character | undefined {
  if (capo.isPlayer) { const id = w.path?.successor; return id ? w.chars[id] : undefined; }
  return Object.values(w.chars).filter((c) => c.alive && c.bossId === capo.id && c.rank === 'soldier').sort((a, b) => rel(capo, b.id).trust - rel(capo, a.id).trust || byId(a, b))[0];
}
// The boss's choice for a crew without a captain: the contender he weighs highest for these men.
export function chooseCaptain(w: World, fid: Id, crew: Character[], outgoing?: Character, not?: Id[]): { c: Character; passed: Character[] } | undefined {
  const cs = membersOf(w, fid).filter((c) => c.rank === 'soldier' && w.fam[fid].consigliere !== c.id && live(w, c) && !(not ?? []).includes(c.id) && recV(w, c, ['leadership', 'earning', 'reliability']) >= 0.25)
    .map((c) => ({ c, s: captaincyStanding(w, c, crew, outgoing) })).sort((a, b) => b.s - a.s || byId(a.c, b.c));
  if (!cs.length) return undefined;
  return { c: cs[0].c, passed: cs.slice(1, 4).filter((x) => x.s > cs[0].s - 0.15).map((x) => x.c) };
}

// ------------------------------------------------------------------------------------------------ underboss, consigliere, the chair
// The boss's picture of who would be his underboss: confidence first, the man's record for running captains, the captains' view of him,
// less how much his ambition and reach would threaten the man who appoints him.
export function underbossStanding(w: World, c: Character): number {
  const f = w.fam[c.familyId!], boss = w.chars[f.bossId];
  const caps = membersOf(w, f.id).filter((x) => x.rank === 'capo' && x.id !== c.id && f.consigliere !== x.id);
  const capView = caps.length ? caps.reduce((a, x) => a + view(x, c), 0) / caps.length : 0.3;
  const reach = recV(w, c, ['influence']);
  const threat = c.traits.ambition > 0.7 && reach > 0.55 ? 0.15 * (1 - temper(boss).caution * 0) : 0;
  return view(boss, c) * 0.45 + recV(w, c, ['leadership', 'reliability', 'influence', 'service']) * 0.3 + capView * 0.15 - threat;
}
export function underbossPicture(w: World, fid: Id): { current?: Character; preferred?: Character; others: Character[] } {
  const ms = membersOf(w, fid), f = w.fam[fid];
  const current = ms.find((x) => x.rank === 'underboss');
  const caps = ms.filter((x) => x.rank === 'capo' && f.consigliere !== x.id && live(w, x)).map((c) => ({ c, s: underbossStanding(w, c) })).sort((a, b) => b.s - a.s || byId(a.c, b.c));
  return { current, preferred: caps[0]?.c, others: caps.slice(1, 3).filter((x) => x.s > 0.2).map((x) => x.c) };
}
// What a consigliere is chosen for: judgment and discretion, standing, and the boss's trust; a violent or grasping man is not.
export function consigliereStanding(w: World, c: Character): number {
  const boss = w.chars[w.fam[c.familyId!].bossId];
  return view(boss, c) * 0.4 + recV(w, c, ['discretion', 'reputation', 'reliability', 'influence']) * 0.4 + temper(c).caution * 0.15 - (c.traits.violence > 0.7 ? 0.2 : 0) - (c.traits.greed > 0.75 ? 0.1 : 0);
}
// The recognised successor: named (fam.heir), or understood (the underboss, if the boss thinks well enough of him); and how the
// captains stand with him, the consigliere, and the man most likely to stand against him.
export function successionPicture(w: World, fid: Id) {
  const f = w.fam[fid], boss = w.chars[f.bossId];
  const ms = membersOf(w, fid);
  const ub = ms.find((x) => x.rank === 'underboss');
  const heir = (f.heir && w.chars[f.heir]?.alive ? w.chars[f.heir] : undefined) ?? (ub && view(boss, ub) > 0.3 ? ub : undefined);
  const caps = ms.filter((x) => x.rank === 'capo' && f.consigliere !== x.id);
  const support = heir && caps.length ? caps.filter((x) => x.id !== heir.id).reduce((a, x) => a + view(x, heir), 0) / Math.max(1, caps.filter((x) => x.id !== heir.id).length) : 0;
  const con = f.consigliere ? w.chars[f.consigliere] : undefined;
  const rival = caps.filter((x) => x.id !== heir?.id && x.traits.ambition > 0.6).sort((a, b) => recV(w, b, ['influence', 'earning']) - recV(w, a, ['influence', 'earning']) || byId(a, b))[0];
  return { boss, heir, named: !!f.heir, support, supportWord: support > 0.5 ? 'strong' : support > 0.3 ? 'fair' : support > 0.15 ? 'thin' : 'little', con, conWord: heir && con ? (view(con, heir) > 0.4 ? 'good' : view(con, heir) > 0.2 ? 'cool' : 'strained') : undefined, rival };
}

// Weekly, for every family: the line and the books; a boss without a named successor names one when he has a man he trusts; the
// player hears the line from his sponsor now and then (a credible source; he never sees the family's mind directly).
export function successionWeek(w: World) {
  for (const f of Object.values(w.fam).sort(byId)) {
    inductionWeek(w, f);
    const boss = w.chars[f.bossId];
    // a vacant consigliere's chair: the boss names the man he trusts (the player, as boss, names his own)
    if (boss?.alive && !boss.isPlayer && (!f.consigliere || !w.chars[f.consigliere]?.alive)) { const c = consigliereChoice(w, f.id); if (c) seatConsigliere(w, f.id, c, boss, 'the chair beside the boss was empty'); }
    if (boss?.alive && !boss.isPlayer && (!f.heir || !w.chars[f.heir]?.alive)) {
      const pic = successionPicture(w, f.id);
      if (pic.heir && view(boss, pic.heir) > 0.45 && w.rng.chance(0.15)) { f.heir = pic.heir.id; logOrg(w, f.id, 'heir', `${boss.name} let it be understood that ${pic.heir.name} would follow him.`, pic.heir.id); }
    }
  }
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (p?.alive && p.rank === 'associate' && p.familyId) {
    const s = p.backer && w.chars[p.backer]?.alive ? w.chars[p.backer] : p.bossId ? w.chars[p.bossId] : undefined;
    const t = w.path?.line?.t ?? -1e9;
    if (s?.alive && ['soldier', 'capo', 'underboss', 'boss'].includes(s.rank) && rel(s, p.id).trust >= 0.35 && w.now - t > 2 * WEEK) tellLine(w, p, s);
  }
}
