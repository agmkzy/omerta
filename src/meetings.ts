// Meetings: crew meetings, being called in over the money, family meetings, sit-downs and social gatherings.
// A meeting is a short queue of agenda items. What comes up is built from the world as it actually is:
// real complaints, real numbers, real facts. What you decide is written back into the world.
import { temper } from './temper';
import { noteDeal } from './orgs';
import { inductPlayer, sponsorOf, turnedDown } from './career';
import { RULINGS, effectiveRate, influence, react, rule, subordinates } from './books';
import { wontBorrowFrom, addFact, bear, bearOn, clamp, createDebt, ease, famName, feel, feelOn, isAwake, learn, money, recordCareer, rel, repute, shortTime } from './core';
import { mkJob, tipFrom, traitWords } from './jobs';
import { share } from './actions';
import { enterpriseLine, lineOf } from './rackets';
import { callSitdown, settleDispute } from './disputes';
import { addFavour } from './encounters';
import { Character, DAY, Grievance, Id, Job, MeetingKind, Rank, World } from './types';

export interface Opt {
  code: string;
  label: string;
  hint?: string;
}
export interface Item {
  id: string;
  kind: 'info' | 'earnings' | 'jobs' | 'grievance' | 'proposal' | 'accounts' | 'floor' | 'incident' | 'request' | 'sitdown' | 'induction' | 'concern' | 'expect';
  title: string;
  text: string[];
  opts: Opt[];
  data: Record<string, any>;
  done?: boolean;
}
export interface Meeting {
  kind: MeetingKind;
  title: string;
  attendees: Id[];
  items: Item[];
  idx: number;
  minutes: number;
  summary: string[];
  jobId?: Id;
}

const PL = (w: World) => w.chars[w.playerId!];
export const available = (w: World, c: Character) => c.alive && c.jailedUntil <= w.now && c.hurtUntil <= w.now && isAwake(c, w.now);
// why a man who sent for the player cannot see him right now, and when he can: said plainly, not "he isn't available"
export function notNowWhy(w: World, c: Character): string {
  if (c.jailedUntil > w.now) return `${c.name} has been picked up. Whatever he wanted will wait until he’s out.`;
  if (c.hurtUntil > w.now) return `${c.name} is laid up at home. He’ll send for you again when he’s on his feet.`;
  const h = c.wake % 24;
  return `${c.name} keeps his own hours, and this isn’t one of them. He’ll see you after ${h === 0 ? 'midnight' : h < 12 ? `${h} in the morning` : h === 12 ? 'noon' : `${h - 12} in the afternoon`}.`;
}
const pickN = <T>(w: World, xs: T[], n: number): T[] => {
  const a = xs.slice();
  const out: T[] = [];
  while (a.length && out.length < n) out.push(a.splice(w.rng.int(0, a.length - 1), 1)[0]);
  return out;
};
const noisy = (w: World, p: Character, truth: boolean) => (w.rng.chance(clamp(0.6 + p.traits.caution * 0.2, 0.6, 0.85)) ? truth : !truth);
let nextItem = 1;
const mkItem = (kind: Item['kind'], title: string, text: string[], opts: Opt[], data: Record<string, any> = {}): Item => ({ id: 'i' + nextItem++, kind, title, text, opts, data });
export const current = (m: Meeting): Item | undefined => m.items[m.idx];

// ----------------------------------------------------------- grievances

const concealed = (w: World, y: Character) => {
  const h = y.books.history.slice(-4);
  return Math.round(h.reduce((a, x) => a + Math.max(0, x.gross - x.declared), 0) * effectiveRate(w, y));
};
const grossOf = (c: Character) => c.books.history.slice(-4).reduce((a, x) => a + x.gross, 0);

// Complaints arise from things that really happened, or from envy and old resentments, which may be unfounded.
export function gatherGrievances(w: World, members: Character[], max = 2): Grievance[] {
  const out: Grievance[] = [];
  const pl = PL(w);
  if ((pl.cooldown.griev ?? 0) > w.now) return out;
  max = Math.min(max, 1);
  const open = (a: Id, b: Id) => w.grievances.some((g) => g.from === a && g.about === b && (g.status === 'open' || w.now - g.created < 60 * DAY)) || out.some((g) => g.from === a && g.about === b);
  const add = (g: Omit<Grievance, 'id' | 'status' | 'created' | 'postponed'>) => {
    const gr: Grievance = { ...g, id: 'g' + w.nextId++, status: 'open', created: w.now, postponed: 0 };
    out.push(gr);
    w.grievances.push(gr);
    pl.cooldown.griev = w.now + 12 * DAY;
  };
  for (const x of pickN(w, members, members.length)) {
    if (out.length >= max) break;
    const ids = new Set(members.map((c) => c.id));
    const family = members.filter((y) => y.alive && y.id !== x.id);
    // 1. A wrong done to him by a man from his own family, which he knows about.
    for (const [fid, k] of Object.entries(x.known)) {
      const f = w.facts[fid];
      if (!f || f.minor || f.victim !== x.id || !f.actor || !k.knowsActor || w.now - f.t > 45 * DAY) continue;
      if (!['beating', 'vandalism', 'robbery', 'poach', 'burglary', 'scam', 'theft'].includes(f.kind)) continue;
      const y = w.chars[f.actor];
      if (!y?.alive || !ids.has(y.id) || y.id === x.id || open(x.id, y.id) || w.grievances.some((g) => g.cause === f.id)) continue;
      add({ from: x.id, about: y.id, kind: f.kind === 'poach' ? 'territory' : 'violence', text: `${x.name} says ${y.name} wronged him: ${f.text}`, claim: f.amount ?? 0, valid: true, cause: f.id });
      break;
    }
    if (out.length >= max) break;
    // 2. Money a crewmate owes him.
    const d = w.debts.find((q) => q.status === 'active' && q.creditor === x.id && q.missed >= 1 && ids.has(q.debtor) && !open(x.id, q.debtor));
    if (d) {
      add({ from: x.id, about: d.debtor, kind: 'money', text: `${x.name} says ${w.chars[d.debtor].name} is behind on what he owes him (${money(d.balance)}).`, claim: d.balance, valid: true });
      continue;
    }
    // 3. Suspicion that someone is holding out on the crew, and plain resentment.
    for (const y of pickN(w, family, family.length)) {
      if (out.length >= max) break;
      const g = x.rels[y.id]?.grudge ?? 0;
      const envy = x.traits.ambition > 0.55 && grossOf(y) > Math.max(60, grossOf(x)) * 1.6;
      if (open(x.id, y.id) || !(g > 0.25 || envy) || !w.rng.chance(0.3)) continue;
      const gap = concealed(w, y);
      if (y.bossId === x.bossId || y.bossId === PL(w).id) {
        add({ from: x.id, about: y.id, kind: 'skim', text: `${x.name} says ${y.name} hasn’t been sharing what he earns.`, claim: gap, valid: gap > 40 });
      } else add({ from: x.id, about: y.id, kind: 'respect', text: `${x.name} says ${y.name} has been disrespecting him.`, claim: 0, valid: w.rng.chance(0.5) });
    }
  }
  return out;
}

function grievanceItem(w: World, g: Grievance): Item {
  const x = w.chars[g.from];
  const y = w.chars[g.about];
  return mkItem('grievance', `${x.name} against ${y.name}`, [g.text], [], { g: g.id, asked: [] });
}

function grievanceOpts(w: World, it: Item): Opt[] {
  const g = w.grievances.find((q) => q.id === it.data.g)!;
  const x = w.chars[g.from];
  const y = w.chars[g.about];
  const asked: string[] = it.data.asked;
  const o: Opt[] = [];
  if (!asked.includes('from')) o.push({ code: 'q_from', label: `Press ${x.name} for specifics` });
  if (!asked.includes('about')) o.push({ code: 'q_about', label: `Ask ${y.name} for his side` });
  if (!asked.includes('look') && (g.kind === 'skim' || g.cause || g.kind === 'money')) o.push({ code: 'look', label: 'Look into it', hint: 'Takes an hour.' });
  o.push({ code: 'r_from', label: `Rule for ${x.name}`, hint: g.claim > 0 ? `${y.name} makes it good.` : `${y.name} backs down.` });
  o.push({ code: 'r_about', label: `Rule for ${y.name}`, hint: `${x.name} is told to drop it.` });
  o.push({ code: 'r_split', label: 'Split the difference', hint: 'Neither is happy.' });
  o.push({ code: 'r_post', label: 'Put it off', hint: 'It will come back.' });
  o.push({ code: 'r_dismiss', label: 'Tell them both to grow up' });
  return o;
}

// Apply a ruling. `mediated` means the player is a go-between rather than the man they both answer to.
function ruleGrievance(w: World, p: Character, g: Grievance, code: string, lines: string[], mediated = false, wit: Id[] = []) {
  const x = w.chars[g.from];
  const y = w.chars[g.about];
  const T = g.valid;
  const rx = rel(x, p.id);
  const ry = rel(y, p.id);
  const pay = (from: Character, to: Character, amt: number) => {
    const a = Math.min(Math.round(amt), Math.max(0, from.cash));
    from.cash -= a;
    to.cash += a;
    return a;
  };
  const note = (winner: Character, loser: Character) =>
    addFact(w, { kind: 'ruling', actor: p.id, victim: loser.id, cause: g.cause, text: `${p.name} ruled in ${winner.name}'s favour against ${loser.name}.`, district: p.district }, { witnesses: [x.id, y.id] });
  const cross = x.familyId !== y.familyId;
  switch (code) {
    case 'r_from': {
      g.status = 'ruled';
      const a = g.claim > 0 ? pay(y, x, g.claim) : 0;
      feelOn(w, rx, 'trust', 0.08);
      feelOn(w, ry, 'trust', -0.06);
      if (T) {
        repute(w, p, 1, 'ruling');
        lines.push(`${y.name} takes it badly but knows it’s fair.${a ? ` He pays ${x.name} ${money(a)}.` : ''}`);
      } else {
        bearOn(w, ry, 0.15, `${p.name} ruled against him`);
        bear(w, y, x.id, 0.25, `${x.name} brought it to the table`);
        repute(w, p, -2, 'ruling');
        lines.push(`${y.name} says nothing, but the look he gives ${x.name} says plenty. It wasn’t true, and he knows you didn’t check.`);
      }
      if (cross) tension(w, x, y, T ? 0 : 1);
      note(x, y);
      break;
    }
    case 'r_about': {
      g.status = 'ruled';
      feelOn(w, ry, 'trust', 0.08);
      feelOn(w, rx, 'trust', -0.06);
      if (!T) {
        repute(w, p, 1, 'ruling');
        lines.push(`${x.name} backs down, a little embarrassed.`);
      } else {
        bear(w, x, y.id, 0.2, `${y.name} won it at the table`);
        bearOn(w, rx, 0.1, `${p.name} ruled against him`);
        repute(w, p, -2, 'ruling');
        lines.push(`${x.name} walks off. He was right, and he knows you knew it, or should have.`);
      }
      note(y, x);
      break;
    }
    case 'r_split': {
      g.status = 'ruled';
      const a = g.claim > 0 ? pay(y, x, g.claim / 2) : 0;
      feelOn(w, rx, 'trust', -0.02);
      feelOn(w, ry, 'trust', -0.02);
      ease(x, y.id, 0.5);
      ease(y, x.id, 0.5);
      lines.push(`You split it down the middle.${a ? ` ${y.name} pays ${x.name} ${money(a)}.` : ''} Nobody’s delighted, nobody walks out angry.`);
      if (cross) tension(w, x, y, -1);
      break;
    }
    case 'r_post':
      g.postponed++;
      feelOn(w, rx, 'trust', -0.03);
      lines.push(`You tell them it will wait. ${x.name} doesn’t like that.`);
      if (g.postponed >= 2) {
        bear(w, x, y.id, 0.15, `${y.name} still has not answered for it`);
        lines.push(`It has been put off twice. ${x.name} may take it into his own hands.`);
      }
      break;
    case 'r_dismiss':
      g.status = 'dropped';
      feelOn(w, rx, 'trust', -0.1);
      bear(w, x, y.id, 0.15, `${y.name} got away with it`);
      lines.push(`You send them both away. The matter isn’t settled; it’s just no longer your problem, until it is.`);
      break;
  }
  // A ruling on a quarrel that is also an open dispute between the same two men settles that dispute: one matter, one outcome.
  if (g.status === 'ruled') settleDispute(w, g.from, g.about, `${p.name} sat them down and ruled on it.`);
  // the room was watching
  const fair = (code === 'r_from' && T) || (code === 'r_about' && !T) || code === 'r_split';
  const seen = wit.map((id) => w.chars[id]).filter((c) => c?.alive);
  if (seen.length && ['r_from', 'r_about', 'r_split', 'r_dismiss'].includes(code)) {
    for (const c of seen) {
      const r = rel(c, p.id);
      feelOn(w, r, 'respect', (fair ? 0.05 : code === 'r_dismiss' ? -0.03 : -0.05));
      const res = Object.values(w.facts).filter((q) => q.kind === 'ruling' && q.actor === p.id).sort((a, b) => b.t - a.t)[0];
      if (res) learn(w, c.id, res, p.id, true);
    }
    lines.push(fair ? `${seen.map((c) => c.name).join(' and ')} watched the whole thing. Word will get round that you’re a man who listens before he rules.` : `${seen.map((c) => c.name).join(' and ')} watched it, and they didn’t like what they saw. A ruling that favours the wrong man gets repeated.`);
  }
  void mediated;
}
function tension(w: World, a: Character, b: Character, d: number) {
  if (a.familyId && b.familyId && a.familyId !== b.familyId) {
    w.fam[a.familyId].tension[b.familyId] = Math.max(0, (w.fam[a.familyId].tension[b.familyId] ?? 0) + d);
    w.fam[b.familyId].tension[a.familyId] = Math.max(0, (w.fam[b.familyId].tension[a.familyId] ?? 0) + d);
    if (d < 0) noteDeal(w, a.familyId, b.familyId, `${a.name} and ${b.name} settled a quarrel between their families`, 0.06);
  }
}

function lookInto(w: World, p: Character, g: Grievance, lines: string[]): boolean {
  const y = w.chars[g.about];
  const sure = w.rng.chance(0.85);
  if (g.kind === 'skim') {
    const gap = concealed(w, y);
    if (!sure) lines.push(`You go through ${y.name}'s dealings but can’t make the numbers say anything either way.`);
    else if (gap > 40) {
      lines.push(`You go through ${y.name}'s dealings. He has earned about ${money(gap)} more than he passed up. ${w.chars[g.from].name} was right.`);
      g.claim = gap;
      return true;
    } else lines.push(`You go through ${y.name}'s dealings. They hold up. ${w.chars[g.from].name} has no case.`);
    return !!sure;
  }
  if (g.cause || g.kind === 'money') {
    lines.push(sure ? `You check what happened. It’s as ${w.chars[g.from].name} says.` : `You ask around, but nobody will say anything for certain.`);
    return !!sure;
  }
  lines.push('There’s nothing to look at. It’s his word against the other man\'s.');
  return false;
}

// ----------------------------------------------------------------- opening

const INTERRUPTS = ['A car idles outside the window for a long minute. Nobody says anything until it moves on.', 'Somebody pounds on the door with news, and the room goes quiet.', 'A phone rings in the back and it’s not good.'];

function maybeInterrupt(w: World, m: Meeting, present: Character[]) {
  if (m.items.length < 3 || !w.rng.chance(0.12)) return;
  m.items = m.items.slice(0, w.rng.int(1, m.items.length - 1));
  m.summary.push(w.rng.pick(INTERRUPTS) + ' The meeting breaks up early.');
  for (const c of present) c.heat = clamp(c.heat + 0.04, 0, 1.5);
}

export function openCrewMeeting(w: World, p: Character, focus?: Grievance): Meeting | string {
  const crew = subordinates(w, p);
  const here = crew.filter((c) => available(w, c));
  if (!crew.length) return 'You have nobody to meet with.';
  if (here.length < Math.max(1, Math.ceil(crew.length / 2))) return 'Most of your men are asleep, laid up or locked up. Try again later.';
  const items: Item[] = [];
  items.push(mkItem('earnings', 'The week', [], [], {}));
  const open: Grievance[] = w.grievances.filter((g) => g.status === 'open' && here.some((c) => c.id === g.from) && w.chars[g.about]?.alive);
  const fresh = focus ? [focus] : [...open.slice(0, 1), ...gatherGrievances(w, here, open.length ? 1 : 2)];
  for (const g of fresh.slice(0, 2)) items.push(grievanceItem(w, g));
  const jobs = w.jobs.filter((j) => j.status === 'active' && here.some((c) => c.id === j.assignee));
  if (jobs.length) items.push(mkItem('jobs', 'Work in hand', [], [], {}));
  const ambitious = here.filter((c) => c.traits.ambition > 0.4);
  if (ambitious.length && w.rng.chance(0.55)) {
    const who = w.rng.pick(ambitious);
    const kinds = ['boost', 'burgle', 'scam'] as const;
    const kind = w.rng.pick(kinds.slice());
    const shops = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && w.chars[b.ownerId]?.alive && b.protection?.familyId !== p.familyId);
    const shop = shops.length ? w.rng.pick(shops) : undefined;
    const text = kind === 'boost' ? `${who.name} wants to go after some cars.` : kind === 'burgle' && shop ? `${who.name} has been watching ${shop.name} in ${shop.district} and wants to take it.` : kind === 'scam' && shop ? `${who.name} reckons ${w.chars[shop.ownerId].name} at ${shop.name} could be talked out of some money.` : `${who.name} has an idea.`;
    items.push(mkItem('proposal', `${who.name} has a proposal`, [text, `You would see ${money(Math.round(100))} or so of whatever he brings in, plus your usual share. If it goes wrong, it goes wrong on your crew.`], [], { who: who.id, kind: kind === 'boost' ? 'boost' : shop ? kind : 'boost', biz: shop?.id, target: shop ? shop.ownerId : undefined }));
  }
  // Matters the men raise for themselves, drawn from what is actually going on with them.
  const raised: Item[] = [];
  const ds = (w.disputes ?? []).filter((d) => (d.status === 'open' || d.status === 'violated') && here.some((c) => c.id === d.a));
  for (const c of pickN(w, here, here.length)) {
    if (raised.length >= 2) break;
    const h = lineOf(w, c);
    const name = c.name;
    const dd = ds.find((d) => d.a === c.id);
    if (dd) raised.push(mkItem('concern', `${name} reports interference`, [`${name}: "${w.chars[dd.b].name} of the ${famName(w, w.chars[dd.b])} family has been leaning on me${dd.biz ? ' over ' + w.biz[dd.biz]?.name : ''}. I haven’t answered. I wanted you to know first."`], [], { who: c.id, type: 'rival', dispute: dd.id }));
    else if (c.cash < 120 || c.books.arrears > 0 || c.problem?.revealed) raised.push(mkItem('concern', `${name} asks for help`, [`${name} looks at the table. "I’m short. ${h?.cause ? 'It was ' + h.cause + '. ' : ''}${c.books.arrears > 0 ? 'I owe you from before. ' : ''}If I can get through this month, I’ll be fine."`], [], { who: c.id, type: 'struggling' }));
    else if (h && ((h.level ?? 1) >= 2 || h.total > 1500) && c.traits.ambition > 0.4) raised.push(mkItem('concern', `${name} wants more room`, [`${name}: "I’ve built something with ${enterpriseLine(w, c)}. I pay what I’m supposed to. I’d like to be trusted to run it without a man looking over my shoulder."`], [], { who: c.id, type: 'earner' }));
    else if (c.heat > 0.55) raised.push(mkItem('concern', `${name} is being watched`, [`${name}: "There’s a car outside my place most mornings. I think it’s the law. I don’t know whether to carry on or keep my head down."`], [], { who: c.id, type: 'heat' }));
  }
  items.push(...raised);
  if (!w.goals?.done['g:expect'] && crew.length >= 2) items.push(mkItem('expect', 'How you want to be told things', ['The men are waiting to hear how you want things reported. Whatever you say, some will follow it to the letter and some will do as they please.'], [], {}));
  const m: Meeting = { kind: 'crew', title: 'Crew meeting', attendees: here.map((c) => c.id), items, idx: 0, minutes: 60, summary: [] };
  maybeInterrupt(w, m, here);
  prime(w, p, m);
  return m;
}

export function openAccountsMeeting(w: World, p: Character, job: Job): Meeting | string {
  const boss = job.giver ? w.chars[job.giver] : undefined;
  if (!boss || !boss.alive) return 'He’s not around any more.';
  if (!available(w, boss)) return notNowWhy(w, boss);
  const amt = Number(job.extra?.amt ?? 0);
  const kind = String(job.extra?.kind ?? 'short');
  const item = mkItem('accounts', `${boss.name}'s office`, [kind === 'missed' ? `${boss.name} doesn’t stand up. "You owe me ${money(Math.max(amt, p.books.arrears))}. I want to know when I get it."` : `${boss.name} turns a ledger around so you can read it. "About ${money(amt)} is missing from your end. Tell me where it went."`], [], { boss: boss.id, amt: Math.max(amt, p.books.arrears), kind });
  const m: Meeting = { kind: 'accounts', title: `${boss.name} wants a word`, attendees: [boss.id], items: [item], idx: 0, minutes: 60, summary: [], jobId: job.id };
  prime(w, p, m);
  return m;
}

export function openFamilyMeeting(w: World, p: Character, job?: Job): Meeting | string {
  if (!p.familyId) return 'You don’t belong to a family.';
  const fam = w.fam[p.familyId];
  const boss = w.chars[fam.bossId];
  if (!boss?.alive) return 'The family has no boss to call a meeting.';
  const top = Object.values(w.chars).filter((c) => c.alive && c.familyId === fam.id && ['underboss', 'capo'].includes(c.rank) && available(w, c));
  const news = Object.values(w.facts).filter((f) => !f.minor && w.now - f.t < 21 * DAY && ['levy', 'arrest', 'promotion', 'murder', 'poach', 'protection_started', 'beating', 'discipline'].includes(f.kind)).filter((f) => {
    const a = f.actor ? w.chars[f.actor] : undefined;
    const v = f.victim ? w.chars[f.victim] : undefined;
    return a?.familyId === fam.id || v?.familyId === fam.id;
  }).sort((a, b) => b.t - a.t).slice(0, 4);
  // the room, and where a man stands in it: the boss at the head, his captains along the table, associates against the wall
  const fn = (c: Character) => c.name.split(' ')[0];
  const club = Object.values(w.clubs ?? {}).find((c) => c.familyId === fam.id);
  const lines: string[] = [`The back room${club ? ` at ${club.name}` : ''}. ${boss.name} at the head of the table${top.length ? `, ${top.slice(0, 4).map(fn).join(', ')} along it` : ''}. ${p.rank === 'associate' ? 'Associates stand against the wall. You stand.' : p.rank === 'soldier' ? 'You take a chair near the end, where the soldiers sit.' : 'You take your place at the table.'}`];
  // the first time he lays eyes on a new man of the family
  const done = (w.goals ??= { done: {} }).done;
  if (!done['g:famMeet'] && p.rank === 'associate') {
    const cap = p.bossId ? w.chars[p.bossId] : undefined;
    lines.push(`${fn(boss)} looks along the wall and stops at you. "${cap ? `${fn(cap)}’s new one?` : 'Who’s this?'}"${cap ? ` ${fn(cap)} nods.` : ''} ${fn(boss)} looks at you a moment longer. "Eyes open, mouth shut. You’ll do fine." Then he moves on, and so does the room.`);
  }
  done['g:famMeet'] = w.now;
  // how the family stands, as the boss puts it
  const sd = fam.standing ?? 50;
  lines.push(sd >= 65 ? `"We’re doing good. Nobody in this city does better than us right now. That’s exactly when men get careless."` : sd < 35 ? `"We’re not where we were. There are people in this city who think we’ve gone soft. They’re wrong, and you’re going to show them."` : `"Things are steady. Steady is fine. Steady pays."`);
  if (fam.directive && fam.directive.until > w.now) lines.push(fam.directive.kind === 'push' ? `"This month, we push. Every crew brings in more than last month. I don’t want to hear why it can’t be done."` : `"Until I say different, nothing loud. Nobody gets hurt, nothing burns. Keep your heads down and your envelopes full."`);
  const light = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === fam.id && (c.books?.arrears ?? 0) > 0).length;
  if (light >= 2) lines.push(`"Some of you have been light on Sunday. You know who you are. Fix it before I have to."`);
  const raids = Object.values(w.facts).filter((f) => f.kind === 'raid' && w.now - f.t < 21 * DAY && fam.districts.includes(f.district ?? '')).length;
  if (raids) lines.push(`"The cops have been busy in ${fam.districts[0]}. Watch what you say on the phone, and who you say it in front of."`);
  for (const f of news) {
    lines.push(f.text);
    if (!p.known[f.id]) learn(w, p.id, f, boss.id, true);
  }
  const tens = Object.values(w.fam).filter((o) => o.id !== fam.id).map((o) => ({ o, t: fam.tension[o.id] ?? 0 })).filter(({ t }) => t >= 3);
  for (const { o, t } of tens) lines.push(`Things with the ${o.name} family are ${t >= 9 ? 'close to open war' : t >= 5 ? 'tense' : 'uneasy'}.`);
  if (fam.levy && fam.levy.until > w.now) lines.push(`The extra ${Math.round(fam.levy.extra * 100)}% stays until ${shortTime(fam.levy.until)}.`);
  const items = [mkItem('info', 'What’s on the table', lines, [{ code: 'ok', label: 'Listen' }]), mkItem('floor', 'The floor', [`${boss.name} looks around. "Anyone got something to say?"`], [], { boss: boss.id })];
  const m: Meeting = { kind: 'family', title: `${fam.name} family meeting`, attendees: [boss.id, ...top.map((c) => c.id)], items, idx: 0, minutes: 120, summary: [], jobId: job?.id };
  prime(w, p, m);
  return m;
}

export function openSitdown(w: World, p: Character, g: Grievance): Meeting | string {
  const x = w.chars[g.from];
  const y = w.chars[g.about];
  if (!x?.alive || !y?.alive) return 'One of them is gone.';
  if (!available(w, x) || !available(w, y)) return 'Both of them need to be around, awake and on their feet. Not today.';
  if (x.familyId !== y.familyId || x.familyId !== p.familyId) {
    // A man from another family only comes if he respects you enough, or fears what a refusal means.
    const inf = influence(w, p) / 100;
    const pr = clamp(0.3 + inf * 0.6 + rel(y, p.id).respect * 0.3 - y.traits.ambition * 0.2, 0.1, 0.95);
    if (!w.rng.chance(pr)) {
      feel(w, y, p.id, 'respect', -0.05);
      addFact(w, { kind: 'sitdown', actor: p.id, victim: y.id, minor: true, text: `${y.name} refused to sit down with ${x.name} when ${p.name} asked.`, district: p.district }, { witnesses: [x.id] });
      return `${y.name} sends word that he won’t be sitting down with anybody. That will get around.`;
    }
  }
  const wit = Object.values(w.chars).filter((c) => c.alive && c.id !== x.id && c.id !== y.id && c.id !== p.id && c.familyId === p.familyId && ['soldier', 'capo', 'underboss'].includes(c.rank) && available(w, c)).sort(() => w.rng.next() - 0.5).slice(0, w.rng.int(1, 2)).map((c) => c.id);
  const item = mkItem('sitdown', `${x.name} and ${y.name}`, [`You sit the two of them down. ${g.text}`, ...(wit.length ? [`${wit.map((id) => w.chars[id].name).join(' and ')} ${wit.length > 1 ? 'are' : 'is'} at the back of the room. Everything said here will be repeated.`] : [])], [], { g: g.id, asked: [], wit });
  const m: Meeting = { kind: 'sitdown', title: 'Sit-down', attendees: [x.id, y.id, ...wit], items: [item], idx: 0, minutes: 90, summary: [] };
  prime(w, p, m);
  return m;
}

export function openGathering(w: World, p: Character, guestIds: Id[], what: 'dinner' | 'celebration' = 'dinner'): Meeting | string {
  const guests = guestIds.map((id) => w.chars[id]).filter((c) => c && c.alive && c.id !== p.id);
  const here = guests.filter((c) => available(w, c));
  if (here.length < 2) return 'You need at least two guests who are awake and free. Try the evening.';
  const cost = what === 'dinner' ? 70 * here.length : 0;
  if (p.cash < cost) return `Dinner for ${here.length} costs ${money(cost)}. You don’t have it.`;
  p.cash -= cost;
  const items: Item[] = [];
  const lines: string[] = [];
  const all = [p, ...here];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const ra = rel(a, b.id);
      const rb = rel(b, a.id);
      feelOn(w, ra, 'trust', 0.03);
      feelOn(w, rb, 'trust', 0.03);
      feelOn(w, ra, 'affection', 0.03);
      feelOn(w, rb, 'affection', 0.03);
      ra.lastMet = rb.lastMet = w.now;
      if (w.rng.chance(0.5)) {
        share(w, a, b, lines);
        share(w, b, a, lines);
      }
    }
  const before = lines.length;
  if (!before) lines.push('Good food, a lot of talk, and nothing anyone will repeat.');
  items.push(mkItem('info', what === 'dinner' ? 'The evening' : 'The celebration', [`${here.map((c) => c.name).join(', ')} come${here.length === 1 ? 's' : ''}.`, ...lines], [{ code: 'ok', label: 'Carry on' }]));
  const feuds: [Character, Character][] = [];
  for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) if ((here[i].rels[here[j].id]?.grudge ?? 0) >= 0.3 || (here[j].rels[here[i].id]?.grudge ?? 0) >= 0.3) feuds.push([here[i], here[j]]);
  if (feuds.length && w.rng.chance(0.6)) {
    const [a, b] = w.rng.pick(feuds);
    items.push(mkItem('incident', `${a.name} and ${b.name}`, [`Across the table ${a.name} and ${b.name} start in on each other. Voices rise.`], [{ code: 'step_in', label: 'Step in and calm it down', hint: 'Depends on how much they listen to you.' }, { code: 'ignore', label: 'Let it play out' }], { a: a.id, b: b.id }));
  }
  const askers = here.filter((c) => c.cash < 200 && rel(c, p.id).trust > 0.3 && !wontBorrowFrom(c, p));
  if (askers.length && w.rng.chance(0.5)) {
    const c = w.rng.pick(askers);
    items.push(mkItem('request', `${c.name} has a favour to ask`, [`Later, ${c.name} takes you aside. "I’m short. Could you put me on to three hundred?"`], [{ code: 'lend', label: 'Lend him $300 (5% a week)' }, { code: 'no', label: 'Tell him you can’t' }], { who: c.id }));
  }
  for (const c of here) if (w.rng.chance(0.15)) tipFrom(w, c);
  const m: Meeting = { kind: 'social', title: what === 'dinner' ? 'Dinner' : 'Celebration', attendees: here.map((c) => c.id), items, idx: 0, minutes: 150, summary: [] };
  prime(w, p, m);
  return m;
}

// ----------------------------------------------------------- running it

function prime(w: World, p: Character, m: Meeting) {
  const it = current(m);
  if (!it || it.done) return;
  it.opts = optsFor(w, p, m, it);
  if (it.kind === 'earnings' && !it.text.length) {
    const crew = m.attendees.map((id) => w.chars[id]);
    for (const c of crew) {
      const h = c.books.history[c.books.history.length - 1];
      const fl = p.books.flags[c.id];
      it.text.push(`${c.name} (${traitWords(c)}): ${h ? `handed up ${money(h.paid)} last week (declared ${money(h.declared)})` : 'nothing on record yet'}${c.books.arrears > 0 ? `, owes ${money(c.books.arrears)}` : ''}${fl && fl.amt > 0 ? `, ${money(Math.round(fl.amt))} unaccounted for` : ''}.`);
    }
  }
  if (it.kind === 'jobs' && !it.text.length) {
    for (const j of w.jobs.filter((q) => q.status === 'active' && m.attendees.includes(q.assignee))) it.text.push(`${w.chars[j.assignee].name}: ${j.title}${j.due ? `, report due ${shortTime(j.due)}` : ''}.`);
  }
}

function optsFor(w: World, p: Character, m: Meeting, it: Item): Opt[] {
  switch (it.kind) {
    case 'induction':
      return it.opts;
    case 'info':
      return [{ code: 'ok', label: 'Go on' }];
    case 'earnings': {
      const o: Opt[] = [];
      const crew = m.attendees.map((id) => w.chars[id]);
      const top = crew.slice().sort((a, b) => (b.books.history.at(-1)?.paid ?? 0) - (a.books.history.at(-1)?.paid ?? 0))[0];
      if (top && (top.books.history.at(-1)?.paid ?? 0) > 0) o.push({ code: 'praise', label: `Praise ${top.name}`, hint: 'Loyalty, and a little envy from the others.' });
      for (const c of crew) {
        const fl = p.books.flags[c.id];
        if (fl && fl.amt > 0) o.push({ code: 'press:' + c.id, label: `Press ${c.name} on the missing ${money(Math.round(fl.amt))}`, hint: 'In front of the others.' });
      }
      o.push({ code: 'warn', label: 'Remind everyone the numbers matter' });
      o.push({ code: 'next', label: 'Move on' });
      return o.slice(0, 5);
    }
    case 'jobs':
      return [{ code: 'hurry', label: 'Tell them to hurry', hint: 'Reports come sooner. They resent it a little.' }, { code: 'next', label: 'Leave it' }];
    case 'grievance':
    case 'sitdown': {
      const g = w.grievances.find((q) => q.id === it.data.g)!;
      const o = grievanceOpts(w, it);
      if (it.kind === 'sitdown') {
        const x = w.chars[g.from];
        const y = w.chars[g.about];
        const asked: string[] = it.data.asked;
        const opts: Opt[] = [];
        if (!asked.includes('from')) opts.push({ code: 'q_from', label: `Hear ${x.name} out` });
        if (!asked.includes('about')) opts.push({ code: 'q_about', label: `Hear ${y.name} out` });
        opts.push({ code: 'r_split', label: 'Propose a compromise', hint: 'Each gives a little.' });
        opts.push({ code: 'r_from', label: `Back ${x.name}` });
        opts.push({ code: 'r_about', label: `Back ${y.name}` });
        opts.push({ code: 'r_dismiss', label: 'Walk away from it' });
        return opts;
      }
      return o;
    }
    case 'proposal':
      return [{ code: 'approve', label: 'Tell him to go ahead', hint: 'He does it quietly and reports back.' }, { code: 'wait', label: 'Tell him to wait' }, { code: 'refuse', label: 'Tell him no' }];
    case 'accounts': {
      const amt = Number(it.data.amt);
      const o: Opt[] = [];
      if (p.cash >= amt && amt > 0) o.push({ code: 'pay', label: `Pay ${money(amt)} now` });
      o.push({ code: 'promise', label: 'Promise to make it good', hint: 'It goes on your arrears, and he’ll remember.' });
      if (it.data.kind === 'short') o.push({ code: 'deny', label: 'Deny it', hint: 'Risky if he has been through the numbers.' });
      const worst = subordinates(w, p).filter((c) => c.alive).sort((a, b) => (a.rels[p.id]?.trust ?? 0) - (b.rels[p.id]?.trust ?? 0))[0];
      if (worst && it.data.kind === 'short') o.push({ code: 'blame:' + worst.id, label: `Say it was ${worst.name}`, hint: 'He won’t thank you.' });
      o.push({ code: 'time', label: 'Ask for more time' });
      return o;
    }
    case 'floor': {
      const o: Opt[] = [{ code: 'quiet', label: 'Say nothing' }, { code: 'support', label: 'Back the boss', hint: 'He notices who speaks up for him.' }];
      const sub = subordinates(w, p).find((c) => (p.books.flags[c.id]?.amt ?? 0) > 0);
      if (sub) o.push({ code: 'concern:' + sub.id, label: `Raise a concern about ${sub.name}'s money`, hint: 'If they listen, he gets disciplined.' });
      const wrong = Object.keys(p.known).map((id) => ({ f: w.facts[id], k: p.known[id] })).filter(({ f, k }) => f && ['beating', 'vandalism', 'robbery', 'poach'].includes(f.kind) && k.knowsActor && f.actor && w.chars[f.actor]?.alive && w.chars[f.actor].familyId !== p.familyId && w.chars[f.victim ?? '']?.familyId === p.familyId && w.now - f.t < 30 * DAY && !w.jobs.some((j) => j.cause === f.id)).sort((a, b) => b.f.t - a.f.t)[0];
      if (wrong) o.push({ code: 'propose:' + wrong.f.id, label: `Propose we answer ${w.chars[wrong.f.actor!].name}`, hint: 'Needs weight behind it.' });
      return o;
    }
    case 'concern': {
      const who = w.chars[it.data.who];
      switch (it.data.type) {
        case 'struggling': return [{ code: 'lend', label: 'Put $200 in his hand', hint: 'He’ll owe you more than money.' }, { code: 'ease', label: 'Lower his share for a month', hint: 'It costs you a little each week.' }, { code: 'no', label: 'Tell him everyone is short sometimes', hint: 'He won’t forget it.' }];
        case 'earner': return [{ code: 'trust', label: 'Lighten the leash and cut his share', hint: 'He’s earned it. Others will see.' }, { code: 'hold', label: 'Tell him not yet', hint: 'It makes him hungrier, or bitter.' }];
        case 'heat': return [{ code: 'lie', label: 'Tell him to lie low for a week', hint: `${who.name} stops earning and the heat fades.` }, { code: 'carry', label: 'Tell him to carry on', hint: 'Risky if they really are watching.' }];
        default: return [{ code: 'back', label: 'Say you’ll raise it with the other side', hint: 'Calls a sit-down. It takes a few days.' }, { code: 'handle', label: 'Tell him to deal with it himself', hint: 'He’s a man of his own kind. It could go either way.' }, { code: 'wait', label: 'Tell him to wait and see' }];
      }
    }
    case 'expect':
      return [{ code: 'strict', label: 'Everything reported, every week', hint: 'Trouble comes to you at once. Big money needs your say.' }, { code: 'balanced', label: 'Weekly numbers; small things they handle', hint: 'Fewer interruptions. More surprises.' }, { code: 'loose', label: 'Report when asked, spend as they see fit', hint: 'Quiet life, thin knowledge.' }, { code: 'next', label: 'Leave it as it is' }];
    case 'incident':
      return it.opts;
    case 'request':
      return it.opts;
  }
}

function finishItem(m: Meeting, w: World, p: Character) {
  const it = current(m)!;
  it.done = true;
  it.opts = [];
  m.minutes += 25;
  m.idx++;
  prime(w, p, m);
}

// Apply a choice. Returns the lines to show; the meeting is mutated and advances when an item is settled.
export function choose(w: World, p: Character, m: Meeting, code: string): string[] {
  const it = current(m);
  const lines: string[] = [];
  if (!it) return lines;
  if (m.kind === 'induction') return inductionChoose(w, p, m, code, w.jobs.find((q) => q.id === m.jobId) ?? (m as any).job);
  const [c0, arg] = code.split(':');
  const done = () => finishItem(m, w, p);
  switch (it.kind) {
    case 'induction':
      return lines;
    case 'info':
      done();
      return lines;
    case 'earnings': {
      if (c0 === 'praise') {
        const crew = m.attendees.map((id) => w.chars[id]);
        const top = crew.slice().sort((a, b) => (b.books.history.at(-1)?.paid ?? 0) - (a.books.history.at(-1)?.paid ?? 0))[0];
        feel(w, top, p.id, 'trust', 0.06);
        feel(w, top, p.id, 'affection', 0.04);
        for (const c of crew) if (c.id !== top.id) bear(w, c, top.id, (c.traits.ambition > 0.6 ? 0.04 : 0), `${top.name} got the praise`);
        lines.push(`You single out ${top.name} in front of the others. He stands a little straighter.`);
      } else if (c0 === 'press') {
        const c = w.chars[arg];
        const r = rule(w, p, c, 'demand');
        lines.push(`You put it to ${c.name} in front of the others. ${r.lines.join(' ')}`);
        feel(w, c, p.id, 'respect', -0.03);
      } else if (c0 === 'warn') {
        for (const id of m.attendees) feel(w, w.chars[id], p.id, 'trust', -0.01);
        lines.push('You make it clear that you can count.');
      }
      done();
      return lines;
    }
    case 'jobs': {
      if (c0 === 'hurry') {
        for (const j of w.jobs.filter((q) => q.status === 'active' && m.attendees.includes(q.assignee) && q.due)) {
          j.due = Math.max(w.now + 60, j.due! - DAY);
          feel(w, w.chars[j.assignee], p.id, 'trust', -0.01);
        }
        lines.push('You tell them to get on with it. Reports will come sooner.');
      }
      done();
      return lines;
    }
    case 'grievance':
    case 'sitdown': {
      const g = w.grievances.find((q) => q.id === it.data.g)!;
      const x = w.chars[g.from];
      const y = w.chars[g.about];
      const asked: string[] = it.data.asked;
      if (c0 === 'q_from') {
        asked.push('from');
        const sure = noisy(w, p, g.valid);
        lines.push(g.kind === 'skim' ? `${x.name}: "I see what he spends and I know what he brings in."` : g.cause ? `${x.name} tells it straight and in detail.` : `${x.name} talks about how it feels more than what happened.`);
        lines.push(sure ? `He sounds like a man who knows what he’s saying.` : `He keeps going back to the same two points. You’re not convinced.`);
      } else if (c0 === 'q_about') {
        asked.push('about');
        const admit = g.valid && w.rng.chance(0.2 + rel(y, p.id).trust * 0.4);
        if (admit) lines.push(`${y.name} holds your eye, then looks away. "All right. It happened."`);
        else {
          lines.push(`${y.name}: "That’s not how it was."`);
          lines.push(noisy(w, p, !g.valid) ? 'He looks genuinely put out.' : 'He answers a little too fast.');
        }
      } else if (c0 === 'look') {
        asked.push('look');
        lookInto(w, p, g, lines);
        m.minutes += 60;
      } else {
        const mediated = it.kind === 'sitdown';
        ruleGrievance(w, p, g, c0, lines, mediated, (it.data.wit as Id[]) ?? []);
        if (c0 === 'r_post') m.summary.push('You put one of the complaints off.');
        done();
        return lines;
      }
      it.opts = optsFor(w, p, m, it);
      return lines;
    }
    case 'expect': {
      const ex = (w.expect ??= { report: 'weekly', trouble: 'tell', invest: 'ask' });
      if (c0 === 'strict') Object.assign(ex, { report: 'weekly', trouble: 'tell', invest: 'ask' });
      else if (c0 === 'balanced') Object.assign(ex, { report: 'weekly', trouble: 'handle', invest: 'ask' });
      else if (c0 === 'loose') Object.assign(ex, { report: 'asked', trouble: 'handle', invest: 'free' });
      (w.goals ??= { done: {} }).done['g:expect'] = w.now;
      lines.push(c0 === 'next' ? 'You leave it as it stands.' : c0 === 'strict' ? 'You tell them everything comes to you. Some of them like that, and some start choosing their words more carefully.' : c0 === 'balanced' ? 'You tell them to keep the small stuff off your plate and bring the weekly numbers. It’s workable, and some will take it as a licence.' : 'You tell them you’ll ask if you want to know. The quiet is welcome. So is the ignorance, for a while.');
      done();
      return lines;
    }
    case 'concern': {
      const who = w.chars[it.data.who];
      const r = rel(who, p.id);
      const t = it.data.type as string;
      if (t === 'struggling') {
        if (c0 === 'lend') { if (p.cash < 200) { lines.push('You haven’t got it on you.'); return lines; } p.cash -= 200; who.cash += 200; feelOn(w, r, 'trust', 0.1); feelOn(w, r, 'affection', 0.06); addFavour(w, p.id, who.id, 1, 'put $200 in his hand when he was short'); lines.push(`${who.name} takes it like it weighs a ton. "I won’t forget this."`); }
        else if (c0 === 'ease') { who.kickRate = Math.max(0.05, who.kickRate - 0.05); feelOn(w, r, 'trust', 0.05); lines.push(`You cut ${who.name}’s share for the month. It’s not much and he treats it as if it were.`); }
        else { feelOn(w, r, 'trust', -0.05); feelOn(w, r, 'affection', -0.03); lines.push(`${who.name} nods slowly. "Right." He doesn’t ask again, and he won’t forget that he did.`); }
      } else if (t === 'earner') {
        if (c0 === 'trust') { who.kickRate = Math.max(0.05, who.kickRate - 0.03); feelOn(w, r, 'trust', 0.06); feelOn(w, r, 'respect', 0.04); lines.push(`${who.name} straightens in his chair. "You won’t regret it." The others notice, and some of them start thinking about what they could build.`); for (const o of m.attendees) if (o !== who.id) w.chars[o].traits.ambition = clamp(w.chars[o].traits.ambition + 0.01); }
        else { who.traits.ambition = clamp(who.traits.ambition + 0.02); feelOn(w, r, 'trust', -0.01); lines.push(`"Not yet," you tell ${who.name}. He says he understands, in the voice of a man doing sums.`); }
      } else if (t === 'heat') {
        if (c0 === 'lie') { who.heat = clamp(who.heat - 0.25, 0, 1.5); { const o = lineOf(w, who); if (o) o.lull = w.now + 7 * DAY; } feelOn(w, r, 'trust', 0.03); lines.push(`${who.name} will keep clear of his business for a week. It costs him money and keeps him out of a cell, maybe.`); }
        else { feelOn(w, r, 'trust', -0.01); lines.push(`${who.name} shrugs. "Your call." He’ll carry on, and keep checking the mirror.`); }
      } else {
        const d = (w.disputes ?? []).find((x) => x.id === it.data.dispute);
        if (c0 === 'back' && d) { lines.push(...callSitdown(w, p, d)); feelOn(w, r, 'trust', 0.05); }
        else if (c0 === 'handle') { feelOn(w, r, 'respect', 0.02); lines.push(`${who.name} nods. "I’ll sort it." He’s a man who might sort it quietly or loudly.`); if (d) d.next = w.now + DAY; }
        else { feelOn(w, r, 'trust', -0.02); lines.push(`${who.name} says nothing, which isn’t agreement.`); }
      }
      done();
      return lines;
    }
    case 'proposal': {
      const who = w.chars[it.data.who];
      const r = rel(who, p.id);
      if (c0 === 'approve') {
        const kind = it.data.kind as 'boost' | 'burgle' | 'scam';
        const job = mkJob(w, { kind, title: `${who.name}'s idea: ${kind === 'boost' ? 'cars' : kind === 'burgle' ? 'burgle ' + (it.data.biz ? w.biz[it.data.biz].name : 'a shop') : 'a con'}`, brief: it.text[0], giver: null, via: 'scheme', assignee: who.id, biz: it.data.biz, target: it.data.target, pay: 0, status: 'active', days: 5 });
        job.orders = temper(who).volatility > 0.6 ? 'hard' : 'quiet';
        job.due = w.now + w.rng.int(1, 3) * DAY;
        feelOn(w, r, 'trust', 0.04);
        lines.push(`${who.name} nods. He’ll see to it and report back.`);
      } else if (c0 === 'wait') {
        lines.push(`${who.name} shrugs. "Your call."`);
      } else {
        feelOn(w, r, 'trust', -0.02);
        who.traits.ambition = clamp(who.traits.ambition + 0.01);
        lines.push(`${who.name} doesn’t argue, but he doesn’t look like he has dropped the idea.`);
      }
      done();
      return lines;
    }
    case 'accounts': {
      const boss = w.chars[it.data.boss];
      const amt = Number(it.data.amt);
      const rb = rel(boss, p.id);
      const fl = (boss.books.flags[p.id] ??= { amt: 0, n: 0, last: 0 });
      const clear = () => {
        fl.amt = 0;
        fl.n = 0;
      };
      if (c0 === 'pay') {
        p.cash -= amt;
        boss.cash += amt;
        p.books.arrears = 0;
        p.books.missed = 0;
        clear();
        feelOn(w, rb, 'trust', 0.04);
        repute(w, p, 1, 'meeting');
        lines.push(`You count it out on his desk. ${boss.name} puts it away without a word. That’s as warm as he gets.`);
      } else if (c0 === 'promise') {
        p.books.arrears = Math.max(p.books.arrears, amt);
        boss.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'promise', text: `${p.name} promised to make good ${money(amt)}.`, due: w.now + 7 * DAY });
        clear();
        feelOn(w, rb, 'trust', -0.02);
        lines.push(`"One week," ${boss.name} says. "Not a day more."`);
      } else if (c0 === 'deny') {
        const pr = clamp(0.5 - temper(boss).caution * 0.4 - fl.n * 0.1 + p.traits.sociability * 0.3, 0.1, 0.8);
        if (w.rng.chance(pr)) {
          clear();
          lines.push(`${boss.name} studies you for a long time. "Fine. I’ll look again."`);
        } else {
          feelOn(w, rb, 'trust', -0.15);
          repute(w, p, -3, 'meeting');
          p.books.arrears += amt * 2;
          clear();
          lines.push(`${boss.name} doesn’t raise his voice. "Don’t lie to me." He turns a page. "Twice, then. Make it up."`);
        }
      } else if (c0 === 'blame') {
        const sub = w.chars[arg];
        const pr = clamp(0.45 - temper(boss).caution * 0.4 + p.traits.sociability * 0.2, 0.1, 0.7);
        if (w.rng.chance(pr)) {
          clear();
          sub.books.arrears += amt;
          feel(w, sub, p.id, 'trust', -0.2);
          bear(w, sub, p.id, 0.2, `${p.name} made him make up what he was short`);
          lines.push(`${boss.name} nods slowly. "I’ll talk to ${sub.name}." You don’t feel good about it.`);
        } else {
          feelOn(w, rb, 'trust', -0.12);
          repute(w, p, -3, 'meeting');
          p.books.arrears += amt;
          lines.push(`"${sub.name}?" ${boss.name} says. "A man who blames his own people doesn’t last." He doesn’t believe you.`);
        }
      } else {
        if (rb.trust > 0.35) {
          lines.push(`${boss.name} lets it ride a week. "I’m not asking again."`);
          clear();
        } else {
          feelOn(w, rb, 'trust', -0.04);
          lines.push(`"No," says ${boss.name}. "You have had your time."`);
        }
      }
      if (it.data.kind === 'missed') p.books.missed = 0;
      addFact(w, { kind: 'discipline', actor: boss.id, victim: p.id, minor: true, text: `${boss.name} called ${p.name} in over the money.`, district: boss.district }, { witnesses: [] });
      done();
      return lines;
    }
    case 'floor': {
      const boss = w.chars[it.data.boss];
      const inf = influence(w, p) / 100;
      if (c0 === 'support') {
        feel(w, boss, p.id, 'trust', 0.04);
        feel(w, boss, p.id, 'respect', 0.03);
        lines.push(`You say what everyone was thinking and put it on ${boss.name}'s side. He gives you a short nod.`);
      } else if (c0 === 'concern') {
        const sub = w.chars[arg];
        const pr = clamp(0.15 + inf * 0.7 + rel(boss, p.id).trust * 0.3, 0.1, 0.9);
        if (w.rng.chance(pr)) {
          const fl = p.books.flags[sub.id];
          lines.push(`${boss.name} listens. "I’ll look into ${sub.name}."`);
          if (fl) react(w, boss, sub, { amt: fl.amt, n: Math.max(2, fl.n), last: w.now }, 'meeting');
          fl.amt = 0;
          fl.n = 0;
          bear(w, sub, p.id, 0.2, `${p.name} called him to account over his envelope`);
          repute(w, p, 1, 'meeting');
        } else lines.push(`${boss.name} lets you finish. "Noted." Nothing in his voice says it will be acted on. Perhaps you don’t carry the weight yet.`);
      } else if (c0 === 'propose') {
        const f = w.facts[arg];
        const t = w.chars[f.actor!];
        const pr = clamp(0.1 + inf * 0.8 + rel(boss, p.id).trust * 0.3 - temper(boss).caution * 0.2, 0.05, 0.9);
        if (w.rng.chance(pr)) {
          mkJob(w, { kind: 'handle', title: `${boss.name} wants ${t.name} dealt with`, brief: `You made the case in front of the family: "${f.text}" ${boss.name} agreed. It’s yours to handle.`, giver: boss.id, via: 'boss', assignee: p.id, target: t.id, cause: f.id, pay: 400 });
          repute(w, p, 2, 'meeting');
          lines.push(`The table goes quiet. ${boss.name} nods. "Do it." The work is yours.`);
        } else {
          repute(w, p, -1, 'meeting');
          lines.push(`${boss.name} lets the silence sit. "Not now." Somebody across the table smirks.`);
        }
      } else lines.push('You say nothing. Nobody notices.');
      done();
      return lines;
    }
    case 'incident': {
      const a = w.chars[it.data.a];
      const b = w.chars[it.data.b];
      if (c0 === 'step_in') {
        const pr = clamp(0.25 + influence(w, p) / 100 * 0.6 + (rel(a, p.id).respect + rel(b, p.id).respect) * 0.2, 0.1, 0.9);
        if (w.rng.chance(pr)) {
          ease(a, b.id, 0.5);
          ease(b, a.id, 0.5);
          repute(w, p, 1, 'meeting');
          lines.push(`You put a hand on the table and say two words. They both sit back. It’s not over, but it’s quieter.`);
        } else {
          feel(w, a, p.id, 'respect', -0.03);
          lines.push(`They talk right over you. ${a.name} storms out first.`);
          bear(w, a, b.id, 0.05, `${b.name} would not hear him`);
        }
      } else {
        bear(w, a, b.id, 0.08, `${b.name} would not hear him`);
        bear(w, b, a.id, 0.08, `${a.name} would not hear him`);
        addFact(w, { kind: 'gathering', actor: a.id, victim: b.id, minor: true, text: `${a.name} and ${b.name} had words at a dinner.`, district: p.district }, { witnesses: [p.id] });
        lines.push('It burns itself out. Nothing is resolved.');
      }
      done();
      return lines;
    }
    case 'request': {
      const c = w.chars[it.data.who];
      if (c0 === 'lend' && p.cash >= 300) {
        p.cash -= 300;
        c.cash += 300;
        createDebt(w, p.id, c.id, 300, 0.05, 'a favour at dinner');
        feel(w, c, p.id, 'trust', 0.08);
        lines.push(`${c.name} takes it with both hands. "I won’t forget this."`);
      } else {
        feel(w, c, p.id, 'trust', -0.02);
        lines.push(`${c.name} says he understands. He doesn’t look like he does.`);
      }
      done();
      return lines;
    }
  }
}


export function closeMeeting(w: World, p: Character, m: Meeting): { minutes: number; lines: string[] } {
  const lines = m.summary.slice();
  if (m.kind === 'induction' && m.jobId) {
    turnedDown(w, p);
    const j = w.jobs.find((q) => q.id === m.jobId);
    if (j) j.status = 'declined';
    delete m.jobId;
    lines.push('You walked out in the middle of it. That will be remembered.');
  }
  if (m.jobId) {
    const j = w.jobs.find((q) => q.id === m.jobId);
    if (j) j.status = 'done';
  }
  if (m.kind === 'crew' || m.kind === 'social') {
    for (const id of m.attendees) {
      const c = w.chars[id];
      share(w, c, p, lines);
      share(w, p, c, []);
      const r = rel(c, p.id);
      feelOn(w, r, 'trust', 0.02);
      r.lastMet = w.now;
    }
  }
  const unresolved = m.items.slice(m.idx).filter((i) => !i.done).length;
  if (unresolved) lines.push(`You leave ${unresolved} thing${unresolved > 1 ? 's' : ''} on the table.`);
  addFact(w, { kind: 'gathering', actor: p.id, minor: true, text: `${p.name} held a ${m.title.toLowerCase()}.`, district: p.district }, { witnesses: m.attendees });
  return { minutes: m.minutes, lines };
}

// ------------------------------------------------------ NPC summons

export function summonsTick(w: World) {
  const p = PL(w);
  // (nobody sends for a man who is inside)
  if (!p || !p.alive || !p.familyId || p.jailedUntil > w.now) return;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const fam = w.fam[p.familyId];
  const open = w.jobs.some((j) => j.kind === 'summons' && j.status === 'offered');
  if (open) return;
  const cd = (k: string, days: number) => {
    if ((p.cooldown[k] ?? 0) > w.now) return false;
    p.cooldown[k] = w.now + days * DAY;
    return true;
  };
  if (boss?.alive && fam.levy && fam.levy.until - 4 * 7 * DAY > w.now - DAY && cd('summons:levy', 28)) {
    mkJob(w, { kind: 'summons', meeting: 'family', giver: boss.id, via: 'boss', assignee: p.id, pay: 0, days: 3, title: 'The family is meeting', brief: `${boss.name} has called everyone together. Money is the subject, and you’re expected to be there.` });
    return;
  }
  if (boss?.alive && w.rng.chance(1 / 40) && cd('summons:family', 21)) {
    mkJob(w, { kind: 'summons', meeting: 'family', giver: boss.id, via: 'boss', assignee: p.id, pay: 0, days: 3, title: 'A family meeting', brief: `${boss.name} is calling the family together. Attendance isn’t optional.` });
    return;
  }
  if (boss?.alive && w.rng.chance(1 / 45) && cd('summons:accounts', 28) && p.books.history.length) {
    const h = p.books.history.at(-1)!;
    mkJob(w, { kind: 'summons', meeting: 'accounts', giver: boss.id, via: 'boss', assignee: p.id, pay: 0, days: 3, title: 'Your recent earnings', brief: h.paid < h.due ? `${boss.name} has been looking at the numbers. He wants to talk about last week, and it isn’t a social visit.` : `${boss.name} wants to go through the numbers with you. It may be good news. With him you can’t tell.` });
    return;
  }
  if (boss?.alive && w.rng.chance(1 / 60) && cd('summons:coffee', 30)) {
    const rivalFam = Object.values(w.fam).find((f) => f.id !== p.familyId && (fam.tension[f.id] ?? 0) > 3);
    mkJob(w, { kind: 'summons', meeting: rivalFam ? 'family' : 'social', giver: boss.id, via: 'boss', assignee: p.id, pay: 0, days: 4, title: rivalFam ? `A complaint from the ${rivalFam.name} family` : 'Coffee at the club', brief: rivalFam ? `${boss.name} has had a visitor from the ${rivalFam.name} family, and it was not a pleasant conversation. He wants everyone who might know something in the room.` : `${boss.name} has invited you for coffee at the club. It’s not business. It’s always business.` });
    return;
  }
  const crew = subordinates(w, p).filter((c) => c.alive);
  if (crew.length && w.rng.chance(0.08) && cd('summons:request', 6)) {
    const gs = gatherGrievances(w, crew, 1);
    const g = gs[0] ?? w.grievances.find((q) => q.status === 'open' && q.postponed >= 1 && crew.some((c) => c.id === q.from));
    if (g) {
      const x = w.chars[g.from];
      mkJob(w, { kind: 'summons', meeting: 'sitdown', extra: { g: g.id }, giver: x.id, via: 'tip', assignee: p.id, pay: 0, days: 5, title: `${x.name} wants a word`, brief: g.text + ' He wants you to sort it out.' });
    }
  }
}

// ------------------------------------------------------ the ceremony

export function openInduction(w: World, p: Character, job: Job): Meeting | string {
  const to = (job.extra?.to as Rank) ?? 'soldier';
  const fam = w.fam[p.familyId!];
  const boss = to === 'boss' ? p : w.chars[fam.bossId];
  const sp = to === 'boss' ? boss : sponsorOf(w, p) ?? boss;
  if (!boss?.alive || !sp) return 'The people who would stand for you aren’t available. It will have to wait.';
  if (to !== 'boss' && (!available(w, boss) || !available(w, sp))) return !available(w, boss) ? notNowWhy(w, boss) : notNowWhy(w, sp);
  const witnesses = Object.values(w.chars).filter((c) => c.alive && c.familyId === p.familyId && ['capo', 'underboss'].includes(c.rank) && available(w, c) && c.id !== boss.id && c.id !== sp.id && c.id !== p.id).slice(0, 4);
  const mk = (id: string, title: string, text: string[], opts: Opt[]): Item => ({ id, kind: 'induction', title, text, opts, data: {} });
  const capNames = witnesses.map((c) => c.name.split(' ')[0]).join(', ') || 'the captains';
  let items: Item[];
  if (to === 'soldier') items = [
    mk('i1', 'The room', [`A back room, a table, a candle, a card with a saint on it. ${boss.name} sits at the head. ${sp.name} stands beside you.`, `${boss.name}: "${sp.name} says you’re a man we can trust. Is he wrong?"`], [{ code: 'sure', label: '"I won’t make him a liar."' }, { code: 'humble', label: '"I hope I’ve earned it."' }, { code: 'quiet', label: 'Say nothing. Look at him.' }]),
    mk('i2', 'What it means', [`${boss.name}: "This is for life. Your family comes first. Before your wife, before your God, before yourself. Do you understand?"`], [{ code: 'yes', label: '"I understand."' }, { code: 'ask', label: 'Ask what’s expected of you', hint: 'Honest, but not what they want to hear.' }, { code: 'out', label: 'Hesitate', hint: 'You can still walk away. You won’t be asked twice for a long time.' }]),
    mk('i3', 'Omertà', [`${boss.name}: "What you hear in this room, you do not repeat. Not to your wife, not to a priest, not to a judge. Men have gone to prison rather than say a name. Would you?"`], [{ code: 'sure', label: '"Without question."' }, { code: 'ask', label: '"And if they offer me a deal?"', hint: 'The wrong question to ask here.' }, { code: 'out', label: 'Hesitate' }]),
    mk('i4', 'The oath', [`${boss.name} pricks your finger and lets the blood fall on the saint. The card is lit and put in your hand.`, `"As burns this saint, so will I burn if I betray my friends."`], [{ code: 'swear', label: 'Hold it and swear' }, { code: 'out', label: 'Drop it' }]),
    mk('i5', 'The embrace', [`${boss.name} kisses you on both cheeks. One by one the men in the room do the same. ${capNames} are there, and every one of them will remember being there.`, `"Welcome. You’re one of us now."`], [{ code: 'yes', label: 'Take it in. Say nothing.' }, { code: 'humble', label: '"Thank you. I won’t forget it."' }]),
  ];
  else if (to === 'capo') items = [
    mk('i1', 'The offer', [`${boss.name}: "A crew needs someone who can carry it. ${sp.name} says that’s you."`], [{ code: 'sure', label: '"I’ll carry it."' }, { code: 'humble', label: '"I’ll do what’s needed."' }, { code: 'quiet', label: 'Nod' }]),
    mk('i2', 'The terms', [`${boss.name}: "What your men do, you answer for. What they earn, you answer for. Do you accept that?"`], [{ code: 'yes', label: '"I accept."' }, { code: 'ask', label: 'Ask who you inherit' }, { code: 'out', label: 'Turn it down' }]),
    mk('i3', 'Your men', [`Three men are brought in and told they answer to you now. They look at you the way men look at a new boss: carefully.`, `${boss.name}: "They’re yours. Treat them well, and they’ll die for you. Treat them badly, and they’ll sell you."`], [{ code: 'sure', label: 'Shake each hand and learn his name' }, { code: 'quiet', label: 'Say nothing. Let them watch you.' }, { code: 'humble', label: '"I’ll earn what you’ve given me."' }]),
    mk('i4', 'The ring', [`${boss.name} holds out his hand. The men present watch to see how you do it.`], [{ code: 'yes', label: 'Kiss his hand' }, { code: 'humble', label: 'Grip it in both of yours and bow your head' }]),
  ];
  else if (to === 'underboss') items = [
    mk('i1', 'The chair beside his', [`${boss.name} has the room cleared. "I need a man who can run this when I can’t. ${sp.name} says that’s you. I’ve watched. I think so too."`], [{ code: 'sure', label: '"I won’t let you down."' }, { code: 'humble', label: '"I’ll earn it every day."' }, { code: 'quiet', label: 'Nod' }]),
    mk('i2', 'What it costs', [`${boss.name}: "Every captain answers to you. When they fail, you answer to me. When I’m gone, they will look at you. Understand that."`], [{ code: 'yes', label: '"I understand."' }, { code: 'ask', label: 'Ask what happens to the man you replace' }, { code: 'out', label: 'Turn it down' }]),
    mk('i3', 'The captains', [`${capNames} are brought in. ${boss.name}: "This man speaks for me. If he speaks, I spoke."`, `One by one they come forward. Some mean it more than others.`], [{ code: 'sure', label: 'Greet each captain by name, and mean it' }, { code: 'quiet', label: 'Take their hands and say nothing' }, { code: 'humble', label: '"I’ll need every one of you."' }]),
    mk('i4', 'The first order', [`${boss.name}: "Before you leave, give an order. Any order. They need to see you do it."`], [{ code: 'sure', label: 'Tell a captain to see to something at once', hint: 'Shows you can be obeyed.' }, { code: 'humble', label: 'Ask one of them for his advice, then act on it', hint: 'Shows you listen.' }]),
  ];
  else items = [
    mk('i1', 'The room goes quiet', [`There is no one at the head of the table but you. Nobody says what happened, and nobody asks. It is understood.`], [{ code: 'sure', label: 'Sit down at the head of the table' }, { code: 'quiet', label: 'Stand until they’re all seated' }]),
    mk('i2', 'The captains come forward', [`${capNames} come forward one at a time. Each says the same four words in a slightly different way, and each looks at you as he says them.`], [{ code: 'sure', label: 'Hold each man’s eye until he looks away' }, { code: 'humble', label: 'Thank each man by name' }, { code: 'quiet', label: 'Nod and say nothing' }]),
    mk('i3', 'Your first act', [`Something has to be decided before anyone leaves the table. They’ll be watching to see what kind of boss you are.`], [{ code: 'sure', label: 'Pay every widow in the family for a year', hint: 'Generosity. They’ll remember.' }, { code: 'quiet', label: 'Name a rival whose time is over', hint: 'Fear. They’ll remember that too.' }, { code: 'humble', label: 'Ask each man what he needs, and write it down', hint: 'Listening. Rare.' }]),
    mk('i4', 'The toast', [`Someone raises a glass. The room follows.`, `"To the family."`], [{ code: 'yes', label: '"To the family."' }, { code: 'humble', label: '"To the ones who aren’t here."' }]),
  ];
  return { kind: 'induction', title: to === 'soldier' ? 'Becoming a made man' : to === 'capo' ? 'Taking a crew' : to === 'underboss' ? 'Second in the family' : 'The chair', attendees: [boss.id, sp.id, ...witnesses.map((c) => c.id)], items, idx: 0, minutes: 120, summary: [], jobId: job.id };
}

export function inductionChoose(w: World, p: Character, m: Meeting, code: string, job?: Job): string[] {
  const it = current(m)!;
  const boss = w.chars[w.fam[p.familyId!].bossId];
  const lines: string[] = [];
  const to = ((job?.extra?.to as Rank) ?? 'soldier') as Rank;
  const data = m as any;
  data.shown ??= 0;
  if (code === 'out') {
    turnedDown(w, p);
    if (job) job.status = 'declined';
    m.items = [];
    m.idx = 0;
    delete m.jobId;
    m.summary.push(`${boss.name} stands up. "Then we’re done here." Nobody looks at you on the way out. You have embarrassed the man who spoke for you.`);
    return lines;
  }
  if (code === 'sure') data.shown += 2;
  if (code === 'humble') data.shown += 1;
  if (code === 'ask') {
    lines.push(`${boss.name}: "That’s a fair question. Honest men ask it. The answer is whatever the family needs."`);
    data.shown -= 0;
  }
  const last = m.idx === m.items.length - 1;
  it.done = true;
  it.opts = [];
  m.idx++;
  if (last || m.idx >= m.items.length) {
    if (to === 'boss') { repute(w, p, data.shown, 'took the chair'); recordCareer(w, p, 'Took the chair of the family'); }
    else inductPlayer(w, p, to, data.shown);
    if (job) job.status = 'done';
    delete m.jobId;
    m.summary.push(to === 'soldier' ? `${boss.name} embraces you. "Welcome to the family. You’re a soldier now." Everyone present is now a witness.` : to === 'capo' ? `${boss.name}: "Congratulations, captain." You have a crew to answer for.` : to === 'underboss' ? `${boss.name} puts a hand on your shoulder. "Underboss." The captains stand, one at a time.` : 'The meal is brought. Nobody speaks about how it happened. The chair is yours, and so is everything that goes with it.');
  }
  return lines;
}
