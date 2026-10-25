// Stories (V89): every matter the player knows of, as he knows it. A story is a situation (situ.ts), a debt, a man in trouble, a
// quarrel, a seat at the table, or someone who wants him gone. The list says what needs him now, what he is in, and what he has only
// heard of; each story says where it stands in words, what he knows in order (when he learned each thing, and from whom), who is in
// it, what he can do, and, honestly, what he does not know. Nothing here is read from what the world knows privately: only facts the
// player has seen or been told (p.known), the records he is himself a party to, and the words the matters give for where they stand.
import { choices, h, kv, note, quiet, rows, title, type KV, type Pick, type Row } from './kit';
import { classOf } from '../exchange';
import { asker, askee, playerMoves, read as mRead, titleOf as mTitle } from '../asks';
import { factText, fmtTime, money } from '../core';
import { versionOf, youText } from '../rumour';
import { dangerLevel, LADDER_WORDS } from '../danger';
import { matterKind, matterOpts, matterStage, matterTitle, ORIGIN } from '../matters';
import { PROBLEM_LABEL } from '../people';
import { isParty, movesFor } from '../sitmoves';
import { isOpen, titleOf } from '../situ';
import { DAY, Character, Enc, Fact, Id, Knowledge, Situation, World } from '../types';
import { avatar, back } from './common';
import { toSide } from './layout';
import { esc, lk, P, pl, S, W } from './links';
import { myDisputes, seatStoryKeys, seatStage, stageOf, playerMoved } from './views_c';

type Tone = 'red' | 'amber' | 'blue' | 'green' | '';
export type Group = 'now' | 'in' | 'heard';
// One thing the player knows about a story: when it happened, and (for what he was told or saw) when he learned it and from whom.
export interface Entry { t: number; text: string; learned?: number; k?: Knowledge; mine?: boolean }
export interface Act { a: string; label: string; hint: string; off?: string; big?: boolean }
export interface Story {
  key: string;
  kind: 'dispute' | 'seat' | 'debt' | 'crew' | 'threat' | 'hunt' | 'turf' | 'matter';
  title: string;
  stage: string; // where it stands, in words
  tone: Tone;
  closed?: boolean;
  last: number; // when the player last learned something about it
  lastText: string;
  timeline: Entry[]; // newest first
  blurb?: string;
  why?: string; // why it is on your list at all
  actions?: Act[];
  // V89
  group?: Group; // needs you now / you are in it / you have heard of it
  origin?: string; // how it began, as a man would say it ("Began with an arrest", "Bad blood", "Money owed")
  people?: { id: Id; role: string }[]; // the people in it that the player knows to be in it
  unknown?: string[]; // what he does not know, said plainly
  pending?: Enc; // a question put to him about it, still waiting on his answer
  terms?: [string, string][]; // an ask: what is on the table, his answer, how he seems
  waiting?: string; // when nothing is his to do: whose move it is
  extra?: string; // kind-specific html (a settled quarrel's terms)
}

// ------------------------------------------------------------------ what the player knows
const first = (c: Character) => c.name.split(' ')[0];
const V89_OWN = new Set(['rivalry', 'arrest', 'revenge', 'climb']);
// The facts the player knows, by the story they belong to (one pass over what he knows, not one per story).
function knownByStory(w: World, p: Character): Map<string, Fact[]> {
  const m = new Map<string, Fact[]>();
  for (const id of Object.keys(p.known)) {
    const f = w.facts[id];
    if (!f?.story) continue;
    const l = m.get(f.story);
    if (l) l.push(f); else m.set(f.story, [f]);
  }
  for (const l of m.values()) l.sort((a, b) => b.t - a.t);
  return m;
}
const known = (w: World, p: Character, f: (x: Fact) => boolean) =>
  Object.keys(p.known).map((id) => w.facts[id]).filter((x) => x && f(x)).sort((a, b) => b.t - a.t);
const entry = (p: Character, f: Fact): Entry => {
  const k = p.known[f.id];
  return { t: f.t, text: k ? versionOf(W(), p, f) : youText(p, f.text), learned: k?.t, k, mine: f.actor === p.id };
};
// Does the player know of this matter at all? He has seen or been told something of it, it is his own doing, he has been asked
// about it, or (for the older kinds, which only ever put a man in a matter by telling him) he is in it. Being the man somebody
// means to go after is not the same as knowing it.
export function knowsMatter(w: World, p: Character, s: Situation, facts?: Fact[]): boolean {
  if (!s.kind || !s.key) return false;
  if ((facts ?? Object.keys(p.known).map((id) => w.facts[id]).filter((f) => f?.story === 'sit:' + s.id)).length) return true;
  if (s.k?.[p.id] || s.who === p.id || s.terms?.by === p.id || s.terms?.of === p.id) return true;
  return isParty(s, p.id) && !V89_OWN.has(s.kind);
}
// The open question put to the player about a matter, if there is one.
const pendingOf = (w: World, s: Situation): Enc | undefined =>
  w.enc.find((e) => e.status === 'open' && e.expires > w.now && (e.id === s.ask || e.data?.sit === s.id || e.data?.sid === s.id));

// ------------------------------------------------------------------ how it began, in words
const ORIGIN_WORD: Record<string, string> = { event: 'Began with something that happened', relationship: 'Bad blood', ambition: 'Ambition', obligation: 'Money owed', negotiation: 'A request' };
function originOf(w: World, p: Character, s: Situation): string {
  switch (s.kind) {
    case 'arrest': return 'Began with an arrest';
    case 'revenge': {
      const root = w.facts[String(s.m?.fact ?? '')];
      return root && p.known[root.id] ? (root.kind === 'murder' ? 'Began with a killing' : 'Began with a beating') : 'Payback';
    }
    case 'skim': return 'Began with missing money';
    case 'intel': return 'Began with a secret';
    case 'rivalry': return 'Bad blood';
    case 'dispute': return 'A quarrel';
    case 'crew': return 'Trouble in the crew';
    case 'partner': return 'A partnership gone sour';
    case 'grudge': return 'A man passed over';
    case 'climb': return 'Ambition';
    case 'debt': case 'tribute': return 'Money owed';
    case 'ask': return s.ak === 'warn' ? 'A warning' : s.ak === 'collect' ? 'Money owed' : s.ak === 'permit' ? 'A man asking leave' : s.ak === 'protect' ? 'Protection' : ({ demand: 'A demand', request: 'A request', offer: 'An offer', claim: 'Something owed' } as Record<string, string>)[classOf(s)];
  }
  const o = s.kind ? ORIGIN[s.kind] : undefined;
  return o ? ORIGIN_WORD[o] : 'Something going on';
}

// ------------------------------------------------------------------ who is in it, in words
const ROLE: Record<string, string> = {
  rival: 'bad blood', held: 'was picked up', boss: 'the boss', above: 'his boss', avenger: 'wants payback', wronged: 'was hurt',
  target: 'the man he blames', climber: 'wants to rise', accused: 'accused', injured: 'the injured party', complainant: 'has a complaint',
  collector: 'collecting', owner: 'the owner', creditor: 'is owed', debtor: 'owes', partner: 'the partner', winner: 'got the step',
  knows: 'knows something', exposed: 'in it', 'asks leave': 'asking leave', lender: 'the lender', borrower: 'the borrower',
  warns: 'giving the warning', warned: 'being warned off', asks: 'asking for help', helper: 'asked to help',
};
const roleWord = (w: World, r: string) => (r.startsWith('with:') ? `with ${w.chars[r.slice(5)] ? first(w.chars[r.slice(5)]) : 'him'}` : ROLE[r] ?? r);
function peopleOf(w: World, p: Character, s: Situation, facts: Fact[], title: string): { id: Id; role: string }[] {
  const named = new Set<Id>();
  for (const f of facts) {
    if (f.victim) named.add(f.victim);
    if (f.actor && (p.known[f.id]?.knowsActor || f.actor === p.id)) named.add(f.actor);
  }
  const inIt = isParty(s, p.id) || s.terms?.by === p.id || s.terms?.of === p.id;
  const out: { id: Id; role: string }[] = [];
  for (const x of s.parties ?? []) {
    const c = w.chars[x.id];
    if (!c || c.id === p.id || out.some((o) => o.id === c.id)) continue;
    // the man somebody blames is only shown once the player has heard who it is
    const ok = named.has(c.id) || (x.role !== 'target' && (inIt || title.includes(first(c))));
    if (ok) out.push({ id: c.id, role: roleWord(w, x.role) });
  }
  return out;
}

// Where a matter he has only heard of stands, as far as what he has heard goes. (The matter's own words for its stage can run ahead
// of what has reached him: a man asking his boss for leave in private is not something the street knows.)
function heardStage(w: World, p: Character, s: Situation, facts: Fact[]): string {
  const hurt = facts.some((f) => ['beating', 'murder', 'vandalism', 'arson'].includes(f.kind) && f.t > s.since);
  switch (s.kind) {
    case 'rivalry': return hurt ? 'It has come to blows' : 'Bad blood between them';
    case 'revenge': { const t = s.m?.target as string | undefined; return hurt ? 'He has struck' : t && facts.some((f) => f.victim === t) ? (t === p.id ? 'He has named you' : 'He has named the man he wants') : 'He wants whoever did it'; }
    case 'arrest': return (s.parties ?? []).some((x) => x.role === 'held' && w.chars[x.id]?.jailedUntil > w.now) ? 'He is still inside, as far as you know' : 'People are wondering what he said';
    case 'climb': return facts.some((f) => /put .* name forward/.test(f.text) && !/not yet/.test(f.text)) ? 'His boss is behind him' : 'Making his case';
  }
  return 'You’ve heard about it';
}

// ------------------------------------------------------------------ what he does not know
const WHO_DID: Record<string, string> = { beating: 'who did the beating', vandalism: 'who smashed the place up', arson: 'who set the fire', robbery: 'who did the robbery', burglary: 'who broke in', murder: 'who did the killing', theft: 'who took it' };
function unknownOf(w: World, p: Character, s: Situation | undefined, facts: Fact[], inIt: boolean): string[] {
  const out: string[] = [];
  const hid = facts.find((f) => f.actor && f.actor !== p.id && p.known[f.id] && !p.known[f.id].knowsActor && (f.textHidden || f.hiddenActor));
  if (hid) out.push(`You don’t know ${WHO_DID[hid.kind] ?? 'who was behind it'}.`);
  if (!s || !isOpen(s)) return out;
  const named = (id?: Id) => !!id && facts.some((f) => f.victim === id || (f.actor === id && p.known[f.id]?.knowsActor));
  switch (s.kind) {
    case 'arrest': {
      const held = (s.parties ?? []).find((x) => x.role === 'held')?.id;
      if (held !== p.id) out.push(s.k?.[p.id]?.l === 2 ? 'He says he told them nothing. Only he knows for sure.' : 'Nobody knows what he said inside, except him.');
      break;
    }
    case 'revenge': {
      const root = w.facts[String(s.m?.fact ?? '')];
      if (root && !p.known[root.id] && !hid) out.push('You don’t know exactly what was done to his family.');
      const t = s.m?.target as string | undefined;
      if (!t || !named(t)) out.push('You don’t know who he means to go after.');
      else if (t !== p.id && (!root || !p.known[root.id]?.knowsActor)) out.push('You don’t know whether he has the right man.');
      break;
    }
    case 'rivalry': out.push(inIt ? 'You don’t know how far he will take it.' : 'You don’t know how far either of them will take it.'); break;
    case 'climb': if (!/behind him/.test(matterStage(w, s, p) ?? '')) out.push('You don’t know whether his boss will back him.'); break;
    case 'skim': out.push('You don’t know whether the numbers are honest.'); break;
    case 'intel': out.push('You don’t know who else knows.'); break;
    case 'ask': {
      const mine = s.terms?.by === p.id, his = s.terms?.of === p.id;
      if (!mine && !his) out.push('You don’t know how he will answer.');
      if (mine && (s.m?.help || s.st?.[s.terms!.of]?.last === 'help')) out.push('You don’t know who he went to, or what they will do about it.');
      break;
    }
  }
  if (!inIt && s.claims?.length) out.push('What you have is what people say, and people say what suits them.');
  return out;
}

// ------------------------------------------------------------------ the kinds of story
function debtStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const d of w.debts ?? []) {
    if (d.creditor !== p.id && d.debtor !== p.id) continue;
    if (d.status !== 'active' && d.status !== 'defaulted') continue;
    const mine = d.creditor === p.id;
    const other = w.chars[mine ? d.debtor : d.creditor];
    if (!other) continue;
    const facts = known(w, p, (f) => /^(loan|debt_)/.test(f.kind) && [f.actor, f.victim].includes(other.id) && [f.actor, f.victim].includes(p.id) && w.now - f.t < 120 * DAY);
    const stage = d.status === 'defaulted' ? 'He has stopped paying' : d.missed > 0 ? (mine ? `He has missed ${d.missed > 1 ? 'payments' : 'a payment'}` : `You have missed ${d.missed > 1 ? 'payments' : 'a payment'}`) : mine ? 'He is paying on time' : 'You are paying on time';
    const tl = facts.map((f) => entry(p, f));
    out.push({
      key: 'debt:' + d.id, kind: 'debt', title: mine ? `${first(other)} owes you` : `You owe ${first(other)}`, origin: 'Money owed',
      stage, tone: d.status === 'defaulted' || d.missed > 1 ? 'red' : d.missed ? 'amber' : 'green',
      group: !mine && (d.missed > 0 || d.status === 'defaulted') ? 'now' : 'in',
      last: tl[0]?.learned ?? d.nextDue - 7 * DAY, lastText: tl[0]?.text ?? `${mine ? 'You lent' : 'You borrowed'} ${money(d.principal)} (${d.reason}).`,
      timeline: tl, people: [{ id: other.id, role: mine ? 'owes you' : 'is owed' }],
      blurb: `${mine ? 'You lent' : 'You borrowed'} ${money(d.principal)} (${d.reason}).`,
      terms: [['Still owing', money(d.balance)], ['Each week', money(d.weeklyPayment)], ['Next due', fmtDay(d.nextDue)]],
      actions: [{ a: `talk:${other.id}|tk:debt:${d.id}`, label: `Go and see ${first(other)}`, hint: mine ? 'Remind him, give him time, or lean on him.' : 'Talk terms before it gets worse.' }],
    });
  }
  return out;
}

function crewStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.bossId !== p.id) continue;
    const prob = c.problem?.revealed ? c.problem : undefined;
    const flag = p.books.flags[c.id];
    const recent = !!c.cooldown.helped && w.now - c.cooldown.helped < 14 * DAY;
    if (!prob && !flag?.amt && !recent) continue;
    const settled = !prob && !flag?.amt;
    const facts = known(w, p, (f) => ((f.actor === c.id || f.victim === c.id) && w.now - f.t < 90 * DAY && f.kind !== 'report') || f.story === 'man:' + c.id);
    const tl = facts.map((f) => entry(p, f));
    const bits: string[] = [];
    if (prob) bits.push(`You know he’s ${PROBLEM_LABEL[prob.kind]}.`);
    if (flag?.amt) bits.push(`About ${money(flag.amt)} doesn’t add up in what he hands over.`);
    const helped = !!c.cooldown.helped && w.now - c.cooldown.helped < 45 * DAY;
    out.push({
      key: 'man:' + c.id, kind: 'crew', title: `Trouble with ${first(c)}`, origin: flag?.amt ? 'Began with missing money' : 'One of your men',
      closed: settled, group: flag?.amt ? 'now' : 'in',
      stage: settled ? 'Resolved. He’s back on his feet' : flag?.amt ? 'Money is missing' : helped ? (prob && prob.sev > 0.5 ? 'You helped. It’s still bad' : 'You helped. It’s easing') : 'You know. He may not know you know',
      tone: settled ? 'green' : flag?.amt ? 'red' : helped ? 'blue' : 'amber',
      last: tl[0]?.learned ?? (prob?.since ?? w.now), lastText: tl[0]?.text ?? bits[0] ?? '', timeline: tl, blurb: bits.join(' '),
      people: [{ id: c.id, role: 'one of your men' }],
      unknown: flag?.amt ? ['You don’t know where the money went.'] : [],
      actions: [{ a: `talk:${c.id}|tk:earn`, label: `Talk to ${first(c)}`, hint: 'Face to face. How you handle it sets what he does next.' }, ...(flag?.amt ? [{ a: `books:${c.id}`, label: 'Go through his books', hint: 'See what he handed up, week by week.' }] : [])],
    });
  }
  return out;
}

function threatStories(w: World, p: Character): Story[] {
  const dg = dangerLevel(w);
  if (dg.level < 1 || !dg.who) return [];
  const e = dg.who;
  const facts = known(w, p, (f) => f.actor === e.id && f.victim === p.id && w.now - f.t < 90 * DAY);
  const tl = facts.map((f) => entry(p, f));
  return [{
    key: 'threat:' + e.id, kind: 'threat', title: `${first(e)} is after you`, origin: 'Bad blood', group: 'now',
    stage: `${LADDER_WORDS[dg.level][0].toUpperCase()}${LADDER_WORDS[dg.level].slice(1)}`, tone: 'red',
    last: tl[0]?.learned ?? w.threats[e.id]?.last ?? w.now, lastText: tl[0]?.text ?? `${e.name} wants you gone.`, timeline: tl,
    blurb: 'It doesn’t stop by itself. Each step is closer to the last one.', people: [{ id: e.id, role: 'wants you gone' }],
    unknown: ['You don’t know when he will move next.'],
    actions: [{ a: `talk:${e.id}`, label: `Find ${first(e)} and talk`, hint: 'Make amends, or make it worse.' }, { a: 'grudges:', label: 'Settle a score', hint: 'End it on your terms.' }],
  }];
}

function huntStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const f of Object.values(w.fam)) {
    const h = f.hunt;
    if (!h || h.target !== p.id) continue;
    const hunters = Object.values(w.threats).map((t) => w.chars[t.enemy]).filter((c) => c?.alive && c.familyId === f.id && (w.threats[c.id]?.level ?? 0) > 0);
    const facts = known(w, p, (x) => x.story === 'hunt:' + f.id || (x.victim === p.id && hunters.some((c) => c.id === x.actor)));
    const tl = facts.map((x) => entry(p, x));
    const sev = h.sev >= 4 ? 'They mean to kill you' : h.sev >= 2 ? 'They want you gone' : 'They want an answer';
    out.push({
      key: 'hunt:' + f.id, kind: 'hunt', title: `The ${f.name} family wants you`, origin: 'A family’s anger', group: 'now', stage: sev, tone: 'red',
      last: tl[0]?.learned ?? h.since, lastText: tl[0]?.text ?? h.why, timeline: tl,
      blurb: `${h.why} It runs until it’s answered, bought off, or it finds you.`,
      people: hunters.map((c) => ({ id: c.id, role: 'closest to you' })),
      unknown: ['You don’t know who they will send, or when.'],
      actions: [
        ...(f.id !== p.familyId && p.bossId && w.chars[p.bossId]?.alive ? [{ a: `talk:${p.bossId}`, label: 'Go to your boss', hint: 'He may speak for you. It won’t be free.' }] : []),
        ...hunters.slice(0, 2).map((c) => ({ a: `talk:${c.id}`, label: `Face ${first(c)}`, hint: 'Make amends, buy time, or make it worse.' })),
        { a: 'grudges:', label: 'Move first', hint: 'Hurt them before they hurt you.' },
      ],
    });
  }
  return out;
}

function turfStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const s of w.situations ?? []) {
    if (s.kind !== 'turf' || !s.biz || !s.fam) continue;
    const closed = s.stage === 'resolved';
    if (closed && w.now - (s.resolvedAt ?? 0) > 30 * DAY) continue;
    const b = w.biz[s.biz], rv = s.rivalMan ? w.chars[s.rivalMan] : undefined, fam = w.fam[s.fam];
    if (!b || !fam) continue;
    const facts = known(w, p, (f) => f.business === b.id && w.now - f.t < 60 * DAY && f.kind !== 'gambling_loss');
    const tl = facts.map((f) => entry(p, f));
    const stage = closed ? (s.how === 'closed' ? `Lost to the ${fam.name} family` : s.how === 'helped' ? 'You held it' : 'Settled') : s.stage === 'asking' ? 'Waiting on your answer' : 'They’re testing the line';
    out.push({
      key: 'turf:' + s.id, kind: 'turf', title: `${b.name}: the ${fam.name} family`, origin: 'A move on your ground', stage, closed,
      tone: closed ? '' : s.stage === 'asking' ? 'red' : 'amber', group: s.stage === 'asking' ? 'now' : 'in',
      last: tl[0]?.learned ?? s.since, lastText: tl[0]?.text ?? s.cause, timeline: tl,
      blurb: `${s.cause.replace(/^./, (m) => m.toUpperCase())}.`,
      why: 'It’s a shop that pays you or your family, and someone is trying to take it.',
      people: [...(rv ? [{ id: rv.id, role: `the ${fam.name} family’s man` }] : []), ...(w.chars[b.ownerId] ? [{ id: b.ownerId, role: 'the owner' }] : [])],
      pending: pendingOf(w, s),
      actions: rv ? [{ a: `talk:${rv.id}`, label: `Find ${first(rv)} and talk`, hint: 'Parley, pay him off, or tell him what happens next.' }, { a: `talk:${b.ownerId}`, label: 'See the owner', hint: 'Keep him steady.' }] : [],
    });
  }
  return out;
}

// V89: an ask as the player sees it. The terms on the table, his answer, how he seems, and the moves open to the man asking.
function askStory(w: World, p: Character, s: Situation, closed: boolean, facts: Fact[]): Story | undefined {
  const a = asker(w, s), t = askee(w, s);
  if (!a || !t) return undefined;
  const mine = a.id === p.id, his = t.id === p.id, other = mine ? t : his ? a : undefined;
  const St = s.st?.[mine ? t.id : a.id];
  const tl = facts.map((f) => entry(p, f));
  const pending = his ? pendingOf(w, s) : undefined;
  const answer = St?.last === 'counter' ? `He offered ${money(Number(s.m?.offer ?? 0))}` : St?.last === 'stall' ? 'He asked for time' : St?.last === 'no' ? 'He turned you down' : St?.last === 'help' || s.m?.help ? 'He went to someone' : St?.last === 'yes' ? 'He agreed' : '';
  const mineSaid = his ? s.st?.[p.id]?.last : undefined; // what the player himself last answered, when it is put to him
  const yours = mineSaid === 'stall' ? 'You asked him for time' : mineSaid === 'counter' ? `You offered ${money(Number(s.m?.offer ?? 0))}` : mineSaid === 'no' ? 'You turned him down' : '';
  const where = closed ? (s.out === 'agreed' || s.out === 'gave in' ? 'Settled' : mine || his ? 'Over' : 'Gone quiet')
    : his ? (pending ? 'Waiting on your answer' : yours || 'He wants something from you')
    : mine ? (answer || 'Waiting on his answer')
    : 'You’ve heard about it';
  const terms: [string, string][] = [];
  if (mine || his) {
    if (s.terms?.amt) terms.push(['On the table', `${money(s.terms.amt)}${s.ak === 'protect' ? ' a week' : ''}${s.terms.first && s.terms.first !== s.terms.amt ? `, down from ${money(s.terms.first)}` : ''}`]);
    else if (s.terms?.what) terms.push(['What is asked', s.terms.what]);
    if (mine && answer) terms.push(['His answer', answer]);
    if (his && yours) terms.push(['Your answer', yours]);
    if (mine && !closed && St) terms.push(['How he seems', mRead(w, s, t.id)]);
  }
  // (V90: what you say about it, you say to him: the page shows where it stands, and the way to him. Only letting it drop can be
  // done from a distance.)
  const moves: Act[] = mine && !closed ? playerMoves(w, p, s).filter((m) => m.move === 'drop').map((m) => ({ a: `am:${s.id}|${m.move}`, label: 'Let it drop', hint: m.hint })) : [];
  return {
    key: 'sit:' + s.id, kind: 'matter', title: mTitle(w, s), closed, stage: where, origin: originOf(w, p, s),
    group: pending || (mine && !closed && ['counter', 'no', 'stall'].includes(St?.last ?? '')) ? 'now' : mine || his ? 'in' : 'heard',
    tone: closed ? '' : pending || (mine && s.m?.help) ? 'red' : mine || his ? 'amber' : 'blue', last: tl[0]?.learned ?? s.since, lastText: tl[0]?.text ?? s.cause, timeline: tl,
    blurb: his ? `${s.cause.replace(/^./, (m) => m.toUpperCase())}.` : undefined,
    why: mine ? 'You started it.' : his ? 'It is put to you.' : 'It concerns people around you.',
    people: peopleOf(w, p, s, facts, mTitle(w, s)), terms, pending,
    unknown: unknownOf(w, p, s, facts, mine || his),
    waiting: !closed && mine && !answer ? `It is with ${first(t)}. He will answer in his own time.` : !closed && !mine && !his ? `It is between ${first(a)} and ${first(t)}.` : undefined,
    actions: closed ? [] : [...(other ? [{ a: mine ? `talkm:${other.id}|${s.id}` : `talk:${other.id}`, label: `Go and see ${first(other)}`, hint: mine ? 'Take it up with him face to face.' : 'Hear him out.' }] : []), ...moves],
  };
}

// Matters between people that you are in or have been told about. Only what you know is shown, never how it will end.
function matterStories(w: World, p: Character, byStory: Map<string, Fact[]>): Story[] {
  const out: Story[] = [];
  for (const s of w.situations ?? []) {
    if (!s.kind || !s.key || s.kind === 'dispute' || s.kind === 'crew' || s.kind === 'turf' || s.kind === 'org') continue;
    const facts = byStory.get('sit:' + s.id) ?? [];
    if (!knowsMatter(w, p, s, facts)) continue;
    const closed = !isOpen(s);
    if (closed && w.now - (s.resolvedAt ?? 0) > 30 * DAY) continue;
    if (!facts.length && closed) continue;
    if (s.kind === 'ask') { const st = askStory(w, p, s, closed, facts); if (st) out.push(st); continue; }
    const tl = facts.map((f) => entry(p, f));
    const inIt = isParty(s, p.id);
    const pending = pendingOf(w, s);
    const asking = s.stage === 'asking' || !!pending;
    const title = matterTitle(w, s) ?? titleOf(w, s);
    const base = {
      key: 'sit:' + s.id, kind: 'matter' as const, title, closed, origin: originOf(w, p, s), pending,
      last: tl[0]?.learned ?? s.since, lastText: tl[0]?.text ?? s.cause, timeline: tl,
      // how it began: the cause, if he is in it; otherwise the first thing he heard
      blurb: inIt ? `${s.cause.replace(/^./, (m) => m.toUpperCase())}.` : tl.at(-1)?.text,
      why: inIt ? 'You’re in it.' : 'You’ve heard about it, and it concerns people around you.',
      people: peopleOf(w, p, s, facts, title), unknown: unknownOf(w, p, s, facts, inIt),
      group: (asking ? 'now' : inIt ? 'in' : 'heard') as Group,
    };
    // V89: the matters that grow from events, bad blood and ambition: their own stage, and what the player can do about them from
    // where he stands (in it, close to someone in it, or only hearing of it), besides going to see the people in it
    if (matterKind(s)) {
      const people = base.people.map((x) => w.chars[x.id]).filter((c) => c?.alive && !c.isPlayer && (inIt || Object.keys(c.rels).includes(p.id))).slice(0, 2);
      const opts = closed ? [] : matterOpts(w, s, p).map((m) => ({ a: `mt:${s.id}|${m.code}|${m.who ?? ''}`, label: m.label, hint: m.hint, big: m.big }));
      out.push({
        ...base,
        stage: closed ? (inIt ? (s.cons?.at(-1) ?? 'Over').replace(/^./, (m) => m.toUpperCase()) : 'Gone quiet') : inIt || s.k?.[p.id]?.l === 2 ? matterStage(w, s, p) ?? 'Open' : heardStage(w, p, s, facts),
        tone: closed ? '' : asking ? 'red' : inIt ? 'amber' : 'blue',
        waiting: !closed && !opts.length ? (inIt ? 'Nothing is yours to do about it today. It will move when they move.' : 'It isn’t yours to settle. From where you stand, you can only hear them out.') : undefined,
        actions: closed ? [] : [...opts, ...people.filter((c) => !opts.some((o) => o.a.endsWith('|' + c.id))).map((c) => ({ a: `talk:${c.id}`, label: `Go and see ${first(c)}`, hint: 'Hear what he has to say about it.' }))].slice(0, 7),
      });
      continue;
    }
    const mv = closed ? [] : movesFor(w, p, s).map((m) => ({ a: `mv:${s.id}|${m.code}|${m.who ?? ''}`, label: m.label, hint: m.hint }));
    out.push({
      ...base,
      stage: closed ? (inIt ? 'Over' : 'Gone quiet') : asking ? 'Waiting on your answer' : inIt ? 'You’re in it' : 'You’ve heard about it',
      tone: closed ? '' : asking ? 'red' : 'amber',
      waiting: !closed && !mv.length && !pending ? 'Nothing is yours to do about it right now.' : undefined,
      actions: mv,
    });
  }
  return out;
}

function disputeStory(w: World, p: Character, d: import('../types').Dispute): Story {
  const a = w.chars[d.a], b = w.chars[d.b];
  const closed = d.status === 'settled' || d.status === 'dropped';
  const opp = d.a === p.id || a?.bossId === p.id ? b : a;
  const stage = stageOf(w, d);
  const facts = Object.keys(p.known).map((id) => w.facts[id]).filter((f) => f && f.story === d.id);
  const tl: Entry[] = [...d.history.map((h) => ({ t: h.t, text: h.text })), ...facts.filter((f) => !d.history.some((h) => h.t === f.t && h.text === f.text)).map((f) => entry(p, f))].sort((x, y) => y.t - x.t);
  const biz = d.biz ? w.biz[d.biz] : undefined;
  const nm = (x: Character) => (x.id === p.id ? 'You' : x.name);
  const open = (d.status === 'open' || d.status === 'violated') && opp?.alive;
  const o = (code: string, label: string, hint: string) => ({ a: `dv:${code}|${d.id}`, label, hint });
  return {
    key: d.id, kind: 'dispute', title: `${biz ? biz.name : 'A quarrel'}: ${a ? first(a) : '?'} and ${b ? first(b) : '?'}`, origin: 'A quarrel',
    stage, tone: d.status === 'violated' ? 'red' : d.status === 'open' ? 'amber' : closed ? '' : 'green', closed,
    group: d.status === 'violated' || (d.status === 'open' && !playerMoved(w, d) && !d.ignored && !/Waiting/.test(stage)) ? 'now' : 'in',
    last: Math.max(d.history.at(-1)?.t ?? d.created, ...facts.map((f) => p.known[f.id].t)), lastText: d.history.at(-1)?.text ?? '', timeline: tl,
    blurb: a && b ? `${nm(a)} against ${nm(b)}${biz ? `, over ${biz.name}` : ''}.` : undefined,
    people: [a, b].filter((c): c is Character => !!c && c.id !== p.id).map((c) => ({ id: c.id, role: c.id === d.a ? 'brought it' : 'answering for it' })),
    unknown: d.found ? [] : ['You don’t know what is really behind it.'],
    extra: (d.terms && d.status === 'settled' ? `<p class="st-callout">Agreed: ${esc(d.terms.text)}. Good until ${esc(fmtDay(d.terms.by))}.</p>` : '')
      + (d.status === 'violated' ? `<p class="st-callout bad">The agreement has been broken. It’s open again.</p>` : '')
      + (d.found ? `<p class="st-callout">${d.older ? `What you found: ${esc(d.older)}.` : 'You looked into it and found no real claim behind it.'}</p>` : ''),
    actions: open && opp ? [
      o('talk', `Find ${opp.name} and talk`, 'Face to face. He’ll answer for himself.'),
      ...(!d.found ? [o('look', 'Find out what’s behind it', 'Ask around. It takes a couple of hours.')] : []),
      ...(opp.familyId !== p.familyId ? [o('sit', `Call a sit-down with ${opp.name}`, 'A formal meeting with terms. It takes a few days to arrange.')] : []),
      o('settle', 'Other ways: superiors, force, or letting it go', 'Take it to a boss, send a message, or end it.'),
      ...(!d.ignored ? [o('ignore', 'Leave it alone for now', 'It won’t go away by itself, but you stop pressing.')] : []),
    ] : [],
  };
}
function disputeStories(w: World, p: Character): Story[] {
  const list = myDisputes(w).concat((w.disputes ?? []).filter((d) => d.status === 'dropped' && (d.a === p.id || w.chars[d.a]?.bossId === p.id) && w.now - (d.history.at(-1)?.t ?? 0) < 30 * DAY));
  return list.filter((d) => !((d.status === 'settled' || d.status === 'dropped') && w.now - (d.history.at(-1)?.t ?? 0) > 30 * DAY)).filter((d) => w.chars[d.a] && w.chars[d.b]).map((d) => disputeStory(w, p, d));
}

function seatStory(w: World, p: Character, k: string): Story {
  const rank = k.slice(5);
  const facts = known(w, p, (x) => x.story === k);
  const fam = p.familyId ? w.fam[p.familyId] : undefined;
  const boss = fam ? w.chars[fam.bossId] : undefined;
  const q = (w.pending ?? []).find((x) => x.kind === 'seat' && x.a === p.id);
  const backer = q?.c ? w.chars[q.c] : undefined;
  const tl = facts.map((f) => entry(p, f));
  return {
    key: k, kind: 'seat', title: 'A seat at the table', origin: 'Ambition', stage: seatStage(w, p, rank), tone: 'blue', group: 'in',
    last: tl[0]?.learned ?? w.now, lastText: tl[0]?.text ?? 'You’ve asked for a seat.', timeline: tl,
    blurb: `The family can only carry so many ${rank}s. More seats mean more rank for the men waiting, and more mouths to feed out of the same take.`,
    people: [...(boss && boss.id !== p.id ? [{ id: boss.id, role: 'decides' }] : []), ...(backer ? [{ id: backer.id, role: 'put your name forward' }] : [])],
    unknown: ['You don’t know who else is being considered.'],
    actions: [
      ...(boss && boss.id !== p.id ? [{ a: `talk:${boss.id}`, label: `Go and see ${boss.name}`, hint: 'He decides. Ask him in person, or make your case.' }] : []),
      ...(backer ? [{ a: `talk:${backer.id}`, label: `Talk to ${backer.name}`, hint: 'He’s the one who put your name forward.' }] : []),
      { a: 'tab:family', label: 'See who else is waiting', hint: 'The family tree shows who’s ahead of you.' },
    ],
  };
}

// Every story the player knows of: grouped, newest first within each group. Records he is party to come first, matters he has
// only heard of after them, and anything that has ended stays in the list for a month, folded away.
export function storiesOf(w: World): Story[] {
  const p = w.chars[w.playerId!];
  const byStory = knownByStory(w, p);
  const out: Story[] = [...huntStories(w, p), ...threatStories(w, p), ...turfStories(w, p), ...disputeStories(w, p), ...crewStories(w, p), ...debtStories(w, p), ...matterStories(w, p, byStory)];
  for (const k of seatStoryKeys(w, p)) out.push(seatStory(w, p, k));
  // what you did about each one goes on its record, and until the other side answers the story says it is waiting
  for (const s of out) {
    const tagged = byStory.get(s.key)?.filter((f) => f.t > w.now - 120 * DAY) ?? [];
    if (!tagged.length) continue;
    const have = new Set(s.timeline.map((x) => x.t + x.text));
    for (const f of tagged) { const e = entry(p, f); if (!have.has(f.t + f.text) && !have.has(e.t + e.text)) s.timeline.push(e); }
    s.timeline.sort((a, b) => b.t - a.t);
    s.last = Math.max(s.last, ...tagged.map((f) => p.known[f.id].t));
    const mine = tagged.find((f) => f.actor === p.id && f.kind === 'favour');
    if (!mine || s.closed) continue;
    const theirs = s.timeline.some((x) => x.t > mine.t && !x.mine);
    if (!theirs && w.now - mine.t < 21 * DAY && s.kind !== 'seat' && s.group !== 'now') { s.stage = `You acted ${ago(w.now, mine.t)}. Waiting on the other side`; if (s.tone === 'amber') s.tone = 'blue'; }
  }
  const WHY: Record<Story['kind'], string> = { dispute: 'It’s a quarrel you or your men are in.', seat: 'You asked for it, and it decides your future.', debt: 'Money is owed between you and him.', crew: 'He’s one of your men.', threat: 'He wants you gone.', hunt: 'They’re looking for you.', turf: 'A shop that pays you is being taken.', matter: 'You’ve heard about it.' };
  for (const s of out) { s.last = Math.min(s.last, w.now); s.why ??= WHY[s.kind]; s.group ??= s.tone === 'red' ? 'now' : 'in'; if (s.pending) s.group = 'now'; }
  const rank = (s: Story) => (s.closed ? 3 : s.group === 'now' ? 0 : s.group === 'in' ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || b.last - a.last);
}
export const isNew = (s: Story) => s.last > (S.seen[s.key] ?? 0) && !s.closed;
// The tab badge counts running stories that moved since you last looked at the list or the story itself.
export const newStories = (w: World) => storiesOf(w).filter((s) => !s.closed && s.last > Math.max(S.seen[s.key] ?? 0, S.seenTab ?? 0)).length;
// Whether a story key leads anywhere (the "follow this" links in the news).
export function storyKnown(w: World, key: string): boolean {
  if (key.startsWith('sit:')) {
    const s = (w.situations ?? []).find((x) => x.id === key.slice(4));
    return !!s && s.kind !== 'turf' && knowsMatter(w, w.chars[w.playerId!], s);
  }
  return storiesOf(w).some((s) => s.key === key);
}

// ------------------------------------------------------------------ words for time and sources
const ago = (now: number, t: number) => { const d = Math.floor(now / DAY) - Math.floor(t / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d} days ago` : d < 60 ? `${Math.round(d / 7)} weeks ago` : `${Math.round(d / 30)} months ago`; };
const fmtDay = (t: number) => fmtTime(t).replace(/,?\s*\d\d:\d\d$/, '').replace(/,?\s*19\d\d$/, '').replace(/^(\w+),/, '$1');
const later = (t: number, l: number) => { const d = Math.floor(l / DAY) - Math.floor(t / DAY); return d <= 0 ? '' : d === 1 ? ', the day after' : d < 14 ? `, ${d} days later` : `, ${Math.round(d / 7)} weeks later`; };
// How he came to know it, in words: who told him and when, if it reached him later.
function sourceOf(w: World, e: Entry): string {
  const k = e.k;
  if (!k) return '';
  const when = later(e.t, k.t);
  const told = (id: string) => { const c = w.chars[id]; return c ? `${pl(c)} told you${when}` : `Someone told you${when}`; };
  if (k.from === 'self') return 'Your own doing';
  if (k.from === 'witness') return 'You were there';
  if (k.from === 'public') return `Word on the street${when}`;
  if (k.from === 'informant') return `An informant’s word${when}`;
  if (k.from === 'family') return `Your family told you${when}`;
  if (k.from.startsWith('told:')) return told(k.from.slice(5));
  if (k.from === 'told') return `Someone told you${when}`;
  if (w.chars[k.from]) return told(k.from);
  return `You heard it${when}`;
}

// ------------------------------------------------------------------ the list
const GROUPS: [Group | 'done', string, string][] = [
  ['now', 'Needs you', 'Someone is waiting on you, or it is your move.'],
  ['in', 'You’re in it', 'Your money, your men, your name.'],
  ['heard', 'Around you', 'Other men’s business that has reached you.'],
];
function row(w: World, s: Story): Row {
  const last = s.lastText ? lk(s.lastText.length > 120 ? s.lastText.slice(0, 117) + '…' : s.lastText).replace(/<a [^>]*>(.*?)<\/a>/g, '$1') : '';
  const when = `${isNew(s) ? 'new · ' : ''}${s.timeline.length ? `heard ${ago(w.now, s.last)}` : ago(w.now, s.last)}`;
  return { mark: s.closed ? 'dead' : s.tone || 'green', kick: `${s.origin ?? ''}${s.origin ? ' · ' : ''}${when}`, title: esc(s.title), sub: `${esc(s.stage)}${last ? `<br><i>${last}</i>` : ''}`, a: `story:${s.key}` };
}
export function storiesTab(): string {
  const w = W(), p = P();
  const all = storiesOf(w);
  const run = all.filter((s) => !s.closed), done = all.filter((s) => s.closed);
  const need = run.filter((s) => s.group === 'now').length;
  let out = title('Stories', `${run.length ? `${run.length} running${need ? `, <b>${need} ${need > 1 ? 'need' : 'needs'} you</b>` : ''}.` : 'Nothing is running.'} Only what you have seen or been told.`);
  if (!all.length) out += quiet('Nothing is unfolding that you know of. Matters start when something happens to you, your men or your shops, or when word of other men’s business reaches you. They show up here, and you can follow each one from the beginning.');
  for (const [g, hd, sub] of GROUPS) {
    const xs = run.filter((s) => s.group === g);
    if (xs.length) out += h(hd, sub) + rows(xs.map((s) => row(w, s)));
  }
  if (done.length) out += `<details class="ui-fold"><summary>Ended or gone quiet (${done.length})</summary>${rows(done.map((s) => row(w, s)))}</details>`;
  S.seenTab = w.now;
  // beside the list: how to read it, and the names that keep coming up in what you are following
  const count = new Map<Id, number>();
  for (const s of run) for (const x of s.people ?? []) count.set(x.id, (count.get(x.id) ?? 0) + 1);
  const names = [...count.entries()].filter(([id, n]) => n >= 2 && w.chars[id] && id !== p.id).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let side = h('How to read this') + note('A story is what you know of a matter, in the order you learned it. Men act on their own time; a story can move while you are elsewhere, and you hear of it only when someone tells you.');
  if (names.length) side += h('Names that keep coming up') + rows(names.map(([id, n]): Row => ({ face: avatar(w.chars[id]), title: esc(w.chars[id].name), sub: `in ${n} of your stories`, a: `ent:${id}` })));
  toSide(side);
  return out;
}

// ------------------------------------------------------------------ one story
function timeline(w: World, s: Story): string {
  const tl = s.timeline.slice().reverse(); // in order, as it happened
  if (!tl.length) return `<p class="st-quiet">Nothing has reached you yet beyond what is above.</p>`;
  const seen = before[s.key] ?? 0;
  const one = (e: Entry) => `<li class="st-k${e.learned && e.learned > seen && seen ? ' st-k--new' : ''}"><span class="st-k__when">${esc(fmtDay(e.t))}</span><p class="st-k__text">${lk(e.text)}</p>${e.k ? `<span class="st-k__src">${sourceOf(w, e)}</span>` : ''}</li>`;
  const older = tl.slice(0, Math.max(0, tl.length - 6)), recent = tl.slice(older.length);
  return (older.length ? `<details class="st-older"><summary>Earlier (${older.length})</summary><ol class="st-tl">${older.map(one).join('')}</ol></details>` : '') + `<ol class="st-tl">${recent.map(one).join('')}</ol>`;
}
// the people in it: each one a tap from a conversation (his page is a tap from there)
function peopleRows(w: World, s: Story): string {
  const ps = (s.people ?? []).map((x) => ({ c: w.chars[x.id], role: x.role })).filter((x) => x.c);
  return rows(ps.map(({ c, role }): Row => ({ face: avatar(c), title: esc(c.name), sub: `${esc(role)}${c.alive ? '' : ' · dead'}${c.alive && !c.isPlayer ? ' · go and see him' : ''}`, a: c.alive && !c.isPlayer ? `talk:${c.id}` : `ent:${c.id}` })));
}
const actPick = (x: Act): Pick => ({ a: x.a, label: x.label.replace(/<[^>]+>/g, ''), hint: x.off ?? x.hint, off: !!x.off, kind: x.big ? 'lead' : '' });

export function storyPage(key: string, lines: string[] = []): string {
  const s = storiesOf(W()).find((x) => x.key === key);
  if (!s) return back() + `<p class="st-empty">That matter is over, or nobody is talking about it any more.</p>`;
  return render(s, lines);
}
// A quarrel has its own page (reached from the crew screen too); it is laid out like any other story.
export function disputePage(id: string, lines: string[]): string | undefined {
  const w = W(), d = (w.disputes ?? []).find((x) => x.id === id);
  if (!d || !w.chars[d.a] || !w.chars[d.b]) return undefined;
  return render(disputeStory(w, P(), d), lines);
}
// When he last looked at each story before this visit (the page renders more than once a visit; this stays put until time moves).
const before: Record<string, number> = {};
function render(s: Story, lines: string[]): string {
  const w = W(), key = s.key;
  if ((S.seen[key] ?? 0) < w.now) { before[key] = S.seen[key] ?? 0; S.seen[key] = w.now; }
  const wasSeen = before[key] ?? 0;
  let out = back();
  out += `<header class="st-head"><p class="ui-label">${esc(s.origin ?? '')}${s.closed ? ' · ended' : ''}</p>${title(s.title)}`
    + `<p class="st-stage"><span class="ui-mark ${s.tone || 'green'}" aria-hidden="true"></span>${esc(s.stage)}</p>`
    + `${s.blurb && !s.timeline.some((e) => e.text === s.blurb) ? `<p class="st-blurb">${lk(s.blurb)}</p>` : ''}${s.why ? note(esc(s.why)) : ''}</header>`;
  // what just happened, when he has just done something about it
  if (lines.length) out += `<div class="sc-said">${lines.map((l) => `<p class="${/[“"]/.test(l) ? 'sc-say' : 'sc-narr'}">${lk(l)}</p>`).join('')}</div>`;
  // a question put to him about it comes first: it is waiting on him
  if (s.pending) {
    const e = s.pending, c = e.from ? w.chars[e.from] : undefined;
    out += h('Waiting on your answer', `${c ? first(c) + ' · ' : ''}until ${fmtDay(e.expires)}`) + `<div class="sc-said">${e.lines.map((l) => `<p class="${/[“"]/.test(l) ? 'sc-say' : 'sc-narr'}">${lk(l)}</p>`).join('')}</div>`
      + choices(e.opts.map((o) => ({ a: `echoose:${e.id}|${o.code}`, label: o.label, hint: o.hint })), 'How you answer');
  }
  if (s.terms?.length) out += kv(s.terms.map(([k, v]): KV => [k, esc(v)]));
  if (s.extra) out += s.extra;
  out += h('What you know', 'in order, and how you came to know it') + timeline(w, s);
  if (s.unknown?.length) out += h('What you don’t know') + s.unknown.map((u) => quiet(esc(u))).join('');
  if (!s.closed) {
    out += h('What you can do');
    if (s.waiting || !s.actions?.length) out += quiet(esc(s.waiting ?? 'Nothing is yours to do about it right now.'));
    if (s.actions?.length && !s.pending) out += choices(s.actions.map(actPick), 'What you can do');
    else if (s.actions?.length) out += rows(s.actions.filter((x) => !x.off).map((x): Row => ({ title: esc(x.label.replace(/<[^>]+>/g, '')), sub: esc(x.hint), a: x.a })));
  }
  // the people in it: under the story on a phone, beside it on a desktop
  const people = peopleRows(w, s);
  if (people) out += `<div class="st-inline">${h('Who is in it')}${people}</div>`;
  const since = wasSeen ? (s.timeline.some((e) => (e.learned ?? 0) > wasSeen) ? `You have heard ${s.timeline.filter((e) => (e.learned ?? 0) > wasSeen).length === 1 ? 'one new thing' : 'new things'} since you last looked, ${esc(ago(w.now, wasSeen).replace(/^today$/, 'earlier today'))}.` : `Nothing new since you last looked, ${esc(ago(w.now, wasSeen).replace(/^today$/, 'earlier today'))}.`) : 'You haven’t opened this one before.';
  toSide(`${people ? h('Who is in it') + people : ''}${h('Since you last looked')}${note(since)}${s.timeline.length ? note(`First heard ${esc(ago(w.now, Math.min(...s.timeline.map((e) => e.learned ?? e.t))))}; last ${esc(ago(w.now, s.last))}.`) : ''}`);
  return out;
}
