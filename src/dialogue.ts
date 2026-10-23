import './threads'; // (the matters between you, as conversations: registers its subjects with talk.ts)
import { OPS, enterpriseLine, lineOf } from './rackets';
import { matterAct, matterTitle, topicsWith } from './matters';
import { addr, note, nudgeOf, subjectRows, talkAbout } from './talk';
import { ASKS, amendsAsk, askBetween, callFavour, nameFigure, rateAsk, openAsk, openAsks as openMatters, playerMove, playerMoves, read as mRead, titleOf as mTitle, type AskMove } from './asks';
import { historyLines } from './powers2';
import { askAbout, helpWith, sitOf } from './situations';
// Conversations. Options are generated from what the other man knows, how he feels about you and what has happened.
// What you learn becomes available later: a name, an amount, a witness. What you promise is remembered.
import { readiness } from './career';
import { share, confide } from './actions';
import { react, envelopeDue, handOver, kickWindow, envelopeText, rateView } from './books';
import { addFact, bear, bearOn, clamp, createDebt, earn, ease, factText, famName, feel, feelAtLeast, feelOn, feelToOn, flavour, isResolved, learn, money, ownerBiz, payDebt, peek, rel, repute, restructure, shortTime, writeDown } from './core';
import { standingWord, mkJob, oppFrom, tipFrom, bossOffer, traitWords, jobSaid, takeJob, declineJob } from './jobs';
import { openSitdown, Meeting } from './meetings';
import { helpMan, lateOf, PROBLEM_LABEL } from './people';
import { bizMove, clearArrears, evidence, giveTime, owedOf, priceOf, setCollector, stakeRoom, takeFromBiz } from './econ';
import { addFavour } from './encounters';
import { arch } from './voice';
import { noteConduct, temper, viewOf } from './temper';
const rk0 = (c: Character) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.rank);
import { classOf, replies as exReplies, reply as exReply } from './exchange';
import { say as vsay, speak, surname } from './voicesheet';
import { choose as encChoose } from './encounters';
import { recall } from './memory';
import { flow, sitdownTalk, brokenWord } from './flows';
import { feePosition, loanPosition, goodFaith, r5 } from './negotiate';
import { WANT_LINE, wantFor, knows, learnAbout, repLines, crewEnvelopesWaiting } from './crewlife';
import { pathInfo } from './path';
import { amends, playerActed, touchDispute } from './disputes';
import { Character, DAY, Fact, Grievance, Id, Job, World } from './types';

export interface DOpt {
  code: string;
  label: string;
  hint?: string;
  story?: 'go' | 'end'; // moves a story on, or can settle one
  group?: string; // how the menu is laid out, Sims-style
  big?: boolean; // costs, risks or consequences worth a full card; otherwise a compact row
  nav?: boolean; // moves around the menu, does not act
  done?: boolean; // already used in this conversation: shown greyed, cannot be used again, and pays nothing if forced
  fixed?: boolean; // V90: worded the same every time (the four everyday questions), not put into his idiom
  // Stage 4: a figure the player names himself: the screen shows a field (and, for a loan, the weekly rate) and sends it with the code
  amount?: { value: number; min: number; max: number; step: number; rate?: { value: number; min: number; max: number } };
}
// The next things he has just made it natural to say. They come from the answer he gave, not from a fixed menu.
export interface FollowOpt { code: string; label: string; hint?: string; big?: boolean }
// A negotiation in progress: what was asked, what he offered back, and what each choice would do.
export interface Deal { kind: 'fee' | 'fee_cut' | 'loan' | 'ext' | 'back' | 'ears' | 'recruit' | 'word'; biz?: Id; debt?: Id; ask: number; offer?: number; rate?: number; old?: number }
export interface Convo {
  id: Id;
  node: string; // root | personal | business | family | disputes | orders | memos | incident | subject | pick_incident | pick_member | pick_concern
  ctx: { fact?: Id; subject?: Id; asked: string[]; denied?: boolean; worry?: string; sub?: string; follow?: FollowOpt[]; deal?: Deal; focus?: string; patience?: number; cold?: boolean; shut?: boolean; raised?: string[] }; // focus: V90, the subject in hand (see hub)
  used?: string[]; // everything said or done in this conversation so far; a new conversation starts empty
  spoken?: string[]; // what he has said aloud in this conversation, so he never says the same line twice
  named?: boolean; // he has already been named in this conversation, so the narration stops repeating his full name
}
// Moving around the menu is not something said, so it is never used up.
const LEGACY = ['personal', 'business', 'family', 'disputes', 'orders', 'memos', 'amends', 'shop', 'crew', 'debt', 'myboss', 'rival'];
export const isNavCode = (code: string) => code === 'root' || code.startsWith('f:') || code.startsWith('apx:what:') || code.startsWith('deal:') || code.startsWith('n:') || code.startsWith('sub') || ['pick_member', 'pick_concern', 'pick_incident', 'drop'].includes(code);
// Only questions about one particular matter are scoped to that matter; everything else is used up for the conversation as a whole.
const MATTER = new Set(['who', 'how_much', 'witness', 'source', 'view', 'tell_more', 'involve', 'can_do', 'p_how', 'p_claim', 'p_owner', 'why', 'press', 'find', 'speak', 'sitdown', 'own', 'lie', 'take']);
export const usedKey = (c: Convo, code: string) => `${MATTER.has(code) ? c.ctx.fact ?? '' : ''}|${code}`;
export interface Said {
  lines: string[];
  minutes: number;
  convo: Convo | null; // null: conversation over
  meeting?: Meeting | string;
  skipMemory?: boolean; // he gave nothing (a dodge): do not record the subject as discussed
  q?: string; // V90: what you said, when it is not the words of the option chosen (opening a subject is said in your own words)
}

const clip = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…');
const avgOf = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const r0 = (t: Character, p: Character) => t.rels[p.id]?.trust ?? 0.3;
const PL = (w: World) => w.chars[w.playerId!];
export const startConvo = (id: Id): Convo => ({ id, node: 'root', ctx: { asked: [] } });

const BORING = new Set(['loan', 'debt_paid', 'debt_missed', 'gambling_loss', 'business_struggling', 'report', 'gathering', 'promotion',
  // (V90: the record of who owns what, what terms were agreed and who did whom a favour is not "trouble" to be asked about)
  'ownership', 'terms', 'levy', 'favour']);

function opinion(w: World, a: Character, b: Character): string {
  const r = a.rels[b.id];
  if (!r) return `barely knows ${b.name}`;
  if (r.grudge >= 0.55) return `hates ${b.name}`;
  if (r.grudge >= 0.3) return `has a problem with ${b.name}`;
  if (r.trust > 0.7) return `trusts ${b.name} completely`;
  if (r.trust > 0.45) return `gets on well enough with ${b.name}`;
  if (r.trust > 0.25) return `is wary of ${b.name}`;
  return `doesn’t trust ${b.name}`;
}

// Only the people in a story can tell you its details: the man who did it, the man it was done to, the owner of the place, and anyone who was standing there.
export function involvedIn(w: World, t: Character, f: Fact): boolean {
  const b = ownerBiz(w, t.id);
  const k = t.known[f.id];
  return f.actor === t.id || f.victim === t.id || (!!b && f.business === b.id) || k?.from === 'witness' || k?.from === 'self';
}

export function incidentsOf(w: World, t: Character): { f: Fact; known: boolean }[] {
  const b = ownerBiz(w, t.id);
  return Object.entries(t.known)
    .map(([id, k]) => ({ f: w.facts[id], k }))
    .filter(({ f }) => f && !f.minor && !BORING.has(f.kind) && w.now - f.t < 40 * DAY && !isResolved(w, f))
    .sort((a, b2) => {
      const mine = (x: Fact) => (x.victim === t.id || x.actor === t.id || (b && x.business === b.id) ? 1 : 0);
      return mine(b2.f) - mine(a.f) || b2.f.t - a.f.t;
    })
    .slice(0, 4)
    .map(({ f, k }) => ({ f, known: k.knowsActor }));
}

const grudgeTarget = (w: World, t: Character) => Object.entries(t.rels).filter(([id, r]) => r.grudge >= 0.3 && id !== w.playerId && w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge)[0];
const isSuperior = (w: World, t: Character, p: Character) => {
  let c: Character | undefined = p;
  for (let i = 0; i < 6 && c; i++) {
    if (c.bossId === t.id) return true;
    c = c.bossId ? w.chars[c.bossId] : undefined;
  }
  return false;
};
// You can't talk business with a man you haven't met. Your own boss, your own men, your kin and anyone who's come to you already don't count as strangers.
export function introduced(w: World, p: Character, t: Character): boolean {
  if (t.id === p.id || p.intro?.[t.id] != null) return true;
  if (t.id === p.bossId || t.bossId === p.id || t.id === p.backer || t.id === p.sponsor) return true;
  if (p.bossId && t.bossId === p.bossId) return true; // (V90: men in the same crew know each other)
  if (w.life && (w.life.partner?.id === t.id || w.life.kin.some((k) => k.id === t.id))) return true;
  if (w.enc.some((e) => e.from === t.id)) return true;
  if (ownerBiz(w, t.id)?.protection?.collectorId === p.id) return true;
  if (w.debts.some((x) => (x.creditor === p.id && x.debtor === t.id) || (x.creditor === t.id && x.debtor === p.id))) return true;
  if (w.jobs.some((j) => j.giver === t.id && j.assignee === p.id)) return true;
  // (V90: a man you have put terms to, or who has put terms to you, has met you)
  if ((w.situations ?? []).some((s) => s.kind === 'ask' && ((s.terms?.by === p.id && s.terms?.of === t.id) || (s.terms?.by === t.id && s.terms?.of === p.id)))) return true;
  return false;
}
export function introducers(w: World, p: Character, t: Character): Character[] {
  const cand = [p.bossId, p.backer, p.sponsor].filter(Boolean).map((id) => w.chars[id!]).filter((c) => c?.alive && c.id !== t.id);
  return cand.filter((c) => c.bossId === t.id || t.bossId === c.id || (c.familyId && c.familyId === t.familyId) || (c.rels[t.id] && c.rels[t.id].lastMet > -1e8) || (c.familyId && t.rank === 'civilian' && w.fam[c.familyId]?.districts.includes(t.district))).slice(0, 2);
}
const inFamily = (p: Character, t: Character) => !!p.familyId && p.familyId === t.familyId;

// A man telling his own story says "me" and "my", not his own full name.
function inHisVoice(text: string, _t: Character, _own: boolean): string {
  return text; // the first-person and first-name rewrite is applied once, to every spoken line, by speechFor()
}

// ---------------------------------------------------------------- what he remembers being asked
// A subject you have already raised is not new the second time. What counts as "changed" is specific to the subject: his cash and
// health for how he is, his takings and arrears for business, who he is friendly or hostile with for his crew, and so on. The record
// is bounded and lives on him, so it survives leaving, coming back later, and saving.
interface TopicPolicy { window: number; sig: (w: World, p: Character, t: Character, arg: string) => string; kind?: 'round' }
const POLICY: Record<string, TopicPolicy> = {
  how: { window: 4, sig: (w, p, t) => { const b = ownerBiz(w, t.id); return [t.cash < 150, t.hurtUntil > w.now, (b?.distress ?? 0) > 0, Object.entries(t.rels).filter(([id, q]) => q.grudge >= 0.3 && id !== p.id && w.chars[id]?.alive).map(([id]) => id).sort().join(',')].join('|'); } },
  op: { window: 6, sig: (w, _p, t) => { const b = ownerBiz(w, t.id); return b ? [Math.floor(b.cash / 250), b.distress > 0, b.protection?.late ?? 0, b.protection?.collectorId ?? '', incidentsOf(w, t).length].join('|') : String(t.books.history.length); } },
  earn: { window: 7, sig: (w, p, t) => [t.books.history.length, t.books.arrears, p.books.arrears, w.debts.filter((d) => d.status === 'active' && (d.creditor === t.id || d.debtor === t.id)).reduce((a, d) => a + d.balance, 0)].join('|') },
  ask_want: { window: 40, sig: (_w, _p, t) => `${t.want?.kind ?? ''}|${t.rank}` },
  ask_crew: { window: 10, sig: (w, p, t) => Object.values(w.chars).filter((x) => x.alive && x.bossId === p.id && x.id !== t.id).map((x) => `${x.id}${(t.rels[x.id]?.trust ?? 0) > 0.4 ? '+' : (t.rels[x.id]?.grudge ?? 0) > 0.2 ? '-' : ''}`).join(',') },
  ask_rep: { window: 10, sig: (_w, p) => String(Math.round(p.standing / 4)) },
  ask_history: { window: 14, sig: (w, p) => String(Object.values(w.facts).filter((f) => f.actor === p.id).length) },
  ask_around: { window: 30, sig: (w, _p, t) => `${t.rank}|${ownerBiz(w, t.id)?.id ?? ''}` },
  about: { window: 14, sig: (w, p, t, arg) => String(Object.values(w.facts).filter((f) => f.actor === arg && t.known[f.id] && !p.known[f.id]).length) },
  leaders: { window: 20, sig: (w, _p, t) => `${t.bossId ?? ''}|${t.familyId ? w.fam[t.familyId].bossId : ''}` },
  old_times: { window: 1, sig: () => 'x' },
  drink: { window: 1, sig: () => 'x', kind: 'round' },
};
const topicKey = (code: string) => (code.startsWith('about:') ? code : code.split(':')[0]);
// His own name is used the first time he is mentioned in a conversation; after that he is "he", or his first name.
function lighten(t: Character, named: boolean, lines: string[]): { lines: string[]; named: boolean } {
  const first = t.name.split(' ')[0];
  const re = rx(t.name);
  let nm = named;
  const out = lines.map((l) => {
    if (!l.includes(t.name)) return l;
    if (!nm) { nm = true; return l; }
    return l.split(/(["“][^"“”]*["”])/).map((seg, i) => (i % 2 ? seg : seg.replace(new RegExp(`^${re}(?=:)`), first).replace(new RegExp(`^${re}[’']s\\b`), 'His').replace(new RegExp(`^${re}(?=[ ’'])`), 'He').split(t.name).join(first))).join('');
  });
  return { lines: out, named: nm };
}

// Everything a man says aloud is put in the way a man talks: his own name becomes "I", "me" and "my", and the people he mentions are
// called by their first names (their full names only where two of them would be confused). This is applied to every line he speaks,
// whichever part of the game produced it, so no conversation reads like a record being read out.
const SELF_VERB: Record<string, string> = { has: 'have', is: 'am', was: 'was', does: 'do', 'doesn’t': 'don’t', 'isn’t': 'am not', 'hasn’t': 'haven’t', had: 'had' };
const rx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function selfVerb(v: string): string {
  const l = v.toLowerCase();
  if (SELF_VERB[l]) return SELF_VERB[l];
  return l.length > 3 && l.endsWith('s') && !l.endsWith('ss') ? l.slice(0, -1) : l;
}
export function speechFor(w: World, p: Character, t: Character, line: string): string {
  if (!/["“]/.test(line)) return line;
  const found = Object.values(w.chars).filter((c) => c.id !== p.id && line.includes(c.name));
  if (!found.length) return line;
  const first = (n: string) => n.split(' ')[0];
  const count = new Map<string, number>();
  for (const c of found) count.set(first(c.name), (count.get(first(c.name)) ?? 0) + 1);
  return line.replace(/(["“])([^"“”]+)(["”])/g, (_m, a: string, body: string, z: string) => {
    let s = body;
    if (s.includes(t.name)) {
      const n = rx(t.name);
      s = s.replace(new RegExp(`${n}[’']s`, 'g'), 'my');
      // (his name is "I" only where it begins what he says or a clause of it; elsewhere it is "me": "Tony beat me up", not "beat I up")
      s = s.replace(new RegExp(`(^|[.!?;,—]\\s+|\\b(?:and|but|then|so|after|before|when|because|until|since|if|that|while) )${n} ((?:now |just |also |still |never |only )?)([A-Za-z’']+)`, 'g'), (_x, pre: string, adv: string, v: string) => `${pre}I ${adv}${selfVerb(v)}`);
      s = s.split(t.name).join('me');
    }
    for (const c of found) if (c.id !== t.id && s.includes(c.name) && count.get(first(c.name)) === 1 && introduced(w, p, c)) s = s.split(c.name).join(first(c.name));
    return `${a}${s}${z}`;
  });
}
// How a second account sits against the first, said only as far as the records go: a recorded cause is called a cause, and
// otherwise he gives the order and the gap and says he can't tell whether one led to the other.
function thenLine(f: Fact, g: Fact, text: string): string {
  const dt = g.t - f.t, n = Math.round(Math.abs(dt) / 1440);
  // (said the way a man says it, not as a dated record)
  const gap = Math.abs(dt) < 720 ? 'The same day,' : dt < 0 ? (n <= 1 ? 'The day before,' : n < 7 ? 'A few days before that,' : 'A while before that,') : n <= 1 ? 'The next day,' : n < 7 ? 'A few days later,' : 'Some time after,';
  if (g.cause === f.id) return `“It didn’t stop there. ${text}”`;
  if (f.cause === g.id) return `“That came out of something before it. ${text}”`;
  if (Math.abs(dt) < 720 && g.business && g.business === f.business) return `“Same day, same place: ${text}”`;
  return `“${gap} ${text} I couldn’t tell you whether the two are connected.”`;
}
// What else he has that is tied to the same matter and that you do not have yet.
function connected(w: World, t: Character, p: Character, f: Fact) {
  return Object.entries(t.known).map(([id, kk]) => ({ g: w.facts[id], kk })).find(({ g }) => g && g.id !== f.id && !p.known[g.id] && !g.minor && !BORING.has(g.kind) && w.now - g.t < 60 * DAY && (g.actor === f.actor || g.victim === f.victim || (!!g.business && g.business === f.business)) && g.actor !== p.id);
}
// What he makes of it: his own record with the people involved comes first, then his temper.
function takeOn(w: World, t: Character, p: Character, f: Fact): string {
  const h = [...f.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const pick = (xs: string[]) => xs[h % xs.length];
  if ((f.kind === 'ruling' && !f.actor) || f.kind === 'levy') {
    const pol: Record<string, string[]> = {
      cold: ['“A ruling is paper. What matters is who obeys it.”', '“Paper. Let’s see who it binds.”'], hothead: ['“Men with money sit down. Men who bleed don’t get asked.”', '“They talk, we pay. Same as ever.”'],
      jovial: ['“Somebody’s going to be unhappy, and it won’t be the men who made the rule. That’s politics.”', '“Everybody shakes hands. Nobody’s happy. A good ruling.”'], proud: ['“As it should be. There are people whose business this is, and people whose business it isn’t.”', '“It is for the houses to settle. And they have.”'],
      schemer: ['“Interesting who it favours. Always is.”', '“Read who gains by it. That’s the whole story.”'], bitter: ['“Rich men settle their quarrels. Poor men pay for them.”', '“It won’t be them who pays.”'],
      earnest: ['“I hope it holds. Too many good men have already been hurt.”', '“I’d like to believe it’ll hold.”'], frightened: ['“I don’t like it. When they start sitting down, it means it’s gotten bad.”', '“If they had to sit down, it was worse than we were told.”'],
    };
    return pick(pol[arch(t)] ?? ['“Not my business unless it becomes my business.”']);
  }
  const ac = f.actor ? w.chars[f.actor] : undefined;
  const vc = f.victim ? w.chars[f.victim] : undefined;
  const fa = ac && ac.id !== p.id ? ac.name.split(' ')[0] : '';
  const tension = ac?.familyId && vc?.familyId && ac.familyId !== vc.familyId ? (w.fam[ac.familyId].tension[vc.familyId] ?? 0) : 0;
  if (fa && (t.rels[ac!.id]?.grudge ?? 0) >= 0.3) return pick([`“${fa}? I’m not surprised. That one has it coming.”`, `“${fa}. Of course it was ${fa}.”`, `“I’ve been waiting for ${fa} to do something like that.”`]);
  if (fa && (t.rels[ac!.id]?.trust ?? 0) >= 0.4) return pick([`“Doesn’t sound like ${fa}. Somebody’s stirring.”`, `“I’d want to hear it from ${fa} before I believed it.”`]);
  if (vc && vc.familyId === t.familyId && vc.id !== t.id) return pick(['“That’s one of ours. It doesn’t get forgotten.”', '“He’s one of ours. Somebody will answer for it.”']);
  if (f.kind === 'poach' && tension >= 2) return pick(['“Reaching into another house’s collection is how it starts. Those two don’t need the excuse.”', '“Two houses already looking for a reason, and one hands it to them.”']);
  if (f.kind === 'poach') return pick(['“A man takes what another man was collecting, and nobody’s asked first. That never ends quietly.”', '“Somebody’s going to want that back.”']);
  if (f.kind === 'protection_started') return pick(['“Another envelope. That’s the neighbourhood now.”', '“It’s a living, if you’re the one holding the envelope.”', '“Somebody’s making a decent week out of that place.”']);
  if (t.traits.violence > 0.6) return pick(['“Some things you settle with a bat, not a conversation.”', '“If it were mine, there’d be nothing left to discuss.”']);
  if (t.traits.caution > 0.6) return pick(['“Best nobody in this room gets involved.”', '“I’d keep my head down and let it play out.”']);
  return pick(['“Not my business unless it becomes my business.”', '“I’ll know what I think when I know who it touches.”', '“I hear a lot. I don’t do much with it.”']);
}
// ---------------------------------------------------------------- arriving, and what a man will say
const BAND = (now: number) => { const h = (now % 1440) / 60; return h < 5 ? 'small hours' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'; };

// One short scene to open a conversation: where, when, how he receives you. The header already says who and which district.
// If he told you something while you sat, the conversation opens on that, and only that.
const pickBy = (t: Character) => ({ hothead: '“You gave me your word. I’m still waiting.”', proud: '“I haven’t forgotten what you said you’d do. Neither should you.”', cold: '“You said you’d do something. You didn’t.”' } as Record<string, string>)[arch(t)] ?? '“About what you promised me. Nothing came of it.”';
export function arrive(w: World, p: Character, t: Character, r: { lines: string[] }, wh: { kind: string; name: string; line: string }, prevMet: number): { lines: string[]; convo: Convo } {
  // (the time of day when you get there, not when you set out)
  const at = w.now + ((r as { minutes?: number }).minutes ?? 0);
  const venue = wh.kind === 'home' ? `His place, ${BAND(at)}` : wh.kind === 'hurt' ? wh.line.replace(/^He’s /, 'He is ').replace(/\.$/, '') : `${wh.name}, ${BAND(at)}`;
  // Nothing is volunteered on arrival: you are greeted, and what he knows comes out if you ask (see the 'chat' topic).
  const recent = w.now - prevMet < 4 * 1440;
  const asks = asksOf(w, t);
  // A man who has something to put to you does it at once, in his own words. The rest waits until you ask.
  // A promise you made him comes up unprompted, once: while there is still time, and again if it lapsed.
  const word: string[] = [];
  const open = t.memos.find((m) => m.kind === 'promise' && m.other === p.id && !m.done && m.due && m.due > w.now && m.due - w.now <= 5 * DAY && !t.talk?.['prm:' + m.id]);
  if (open) { (t.talk ??= {})['prm:' + open.id] = { d: Math.floor(w.now / 1440), sig: 'x', n: 1 }; word.push(`“You said you’d see to it. Don’t leave it too long.”`); }
  // a man you helped says so (a favour he owes you, for what you did), now and then, in his own manner; it is what lies between you
  const helped = w.favours.find((f) => !f.settled && f.from === p.id && f.to === t.id && w.now - f.t < 120 * DAY);
  if (helped && Math.floor(w.now / 1440) - (t.talk?.['ack:' + helped.id]?.d ?? -99) >= 14) {
    (t.talk ??= {})['ack:' + helped.id] = { d: Math.floor(w.now / 1440), sig: 'x', n: 1 };
    const a0 = arch(t);
    word.push(a0 === 'proud' ? '“I don’t forget a thing like what you did. You know that.”' : a0 === 'cold' ? '“I remember what you did. I pay my debts.”' : a0 === 'jovial' ? '“There he is. The man who stood by me. Sit, sit.”' : a0 === 'frightened' ? '“I haven’t forgotten. What you did for me. I haven’t.”' : '“I haven’t forgotten what you did for me.”');
  }
  const broke = brokenWord(w, p, t);
  if (broke && !t.talk?.['said:' + broke.id]) { (t.talk ??= {})['said:' + broke.id] = { d: Math.floor(w.now / 1440), sig: 'x', n: 1 }; word.push(pickBy(t)); }
  // V89: what shows on him before he says a word, if something is weighing on him (talk.ts)
  const shows = asks.length ? undefined : nudgeOf(w, p, t);
  const lines = [`${venue}. ${vsay(w, t, p, 'scene')}`, vsay(w, t, p, recent ? 'greet_again' : 'greet', { S: addr(w, t, p) }), ...(shows ? [shows] : []), ...word, ...r.lines, ...(asks.length ? [approachLine(t)] : [])];
  const convo: Convo = { ...startConvo(t.id), named: lines.some((l) => l.includes(t.name)) };
  // V90: he decides whether there is a conversation at all. A man who threw you out today won't start another one.
  if ((p.cooldown[`shut:${t.id}`] ?? 0) > w.now) { lines.splice(1); lines.push(shutLine(w, t)); convo.ctx = { ...convo.ctx, cold: true, shut: true }; }
  else if (asks.length) convo.ctx = { ...convo.ctx, focus: 'apx:' + asks[0].id, raised: [asks[0].id] }; // (Stage 5C: he asks for a minute, and you answer how you take it)
  return { lines, convo };
}
const shutLine = (w: World, t: Character) => { const tp = temper(t); return tp.volatility + tp.pride > 1.15 ? '“I told you once today. Out.”' : tp.agreeable > 0.55 ? '“Not today. Please.”' : 'He turns his back on you. He has nothing to say today.'; };

// What he has come to you about: any request or matter of his own that the world has put in front of you. These are the same records the
// Today tab shows, so answering here or there is the same act, and a matter dealt with in one place is gone from the other.
// Stage 5C: a man who has come to you with something asks for a minute first, in his own manner; you choose how to take it.
function approachLine(t: Character): string {
  const tp = temper(t), a = arch(t);
  return a === 'cold' ? '“A word.”' : tp.volatility + tp.pride > 1.15 ? '“We need to talk. Now.”' : a === 'frightened' ? '“Have you got a minute? It’s important.”' : a === 'jovial' ? '“Got a minute? There’s something I want to discuss.”' : '“Got a minute? There’s something I want to talk to you about.”';
}
export const asksOf = (w: World, t: Character) => w.enc.filter((e) => e.status === 'open' && e.from === t.id && e.expires > w.now && e.opts.length);
const askLead = (e: { lines: string[] }) => e.lines.filter((l) => /["“]/.test(l)).slice(-1)[0] ?? e.lines[e.lines.length - 1] ?? '';

// What a man wants, in his own mouth. The second line is how a guarded man puts it.
const WANT_SAY: Record<string, [string, string]> = {
  made: ['I want to be made. That’s all I think about, if I’m honest.', 'There’s a button I mean to earn. I’ll leave it there.'],
  gamble: ['I’d like a book of my own. A little room, a few regulars.', 'I have ideas about money. They’re mine.'],
  independent: ['I’m tired of somebody else’s hand in my pocket. I want out from under.', 'I want what I earn to stay where I put it.'],
  lieutenant: ['I want to be the man next to you when it matters.', 'A man should be near the people who count.'],
  rich: ['I want money. Real money. I don’t much care how it comes.', 'Everybody wants a bit more than they have.'],
  respect: ['I want to be listened to when I speak. Money’s second.', 'I want to be taken seriously. That’s all.'],
};

// How much he will say when you ask what's going on: what he knows, what he is willing to tell you, and what you asked are three things.
const RKN = (r: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(r);
export function openness(w: World, t: Character, p: Character): 'open' | 'partial' | 'general' | 'brush' | 'hostile' {
  const r = t.rels[p.id];
  const tr = r?.trust ?? 0, af = r?.affection ?? 0, gr = r?.grudge ?? 0;
  if (gr >= 0.3) return 'hostile';
  let s = tr * 0.6 + af * 0.4;
  if (t.traits.sociability > 0.65) s += 0.15; // a talker says more than he should
  if (t.traits.caution > 0.6 && RKN(t.rank) >= 3) s -= 0.15; // a careful capo gives nothing away, even to a friend
  if (RKN(t.rank) > RKN(p.rank) || t.id === p.bossId) s -= 0.08; // a superior tells you what he chooses to
  const a = arch(t);
  if (a === 'frightened') s += 0.08;
  if (a === 'cold') s -= 0.08;
  return s >= 0.55 ? 'open' : s >= 0.38 ? 'partial' : s >= 0.2 ? 'general' : 'brush';
}

// A fact as the man who knows it would say it. The record's own wording is for the news and the log; across a table he says "I" for
// himself, he doesn't read out a headline, and an arrangement he made is "taken on", not "put on the books".
export function told(w: World, t: Character, f: Fact, knows: boolean): string {
  const raw = knows || !f.textHidden ? f.text : f.textHidden;
  const n = [...f.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  let m = /^(.+) now collects (\$[\d,]+) a week from (.+)\.$/.exec(raw);
  if (m) {
    const [, a, fee, biz] = m;
    const owner = !!f.business && w.biz[f.business]?.ownerId === t.id;
    if (a === t.name) return [`${a} took on ${biz}. ${fee} a week.`, `${biz} is mine now, ${fee} a week.`][n % 2];
    if (owner) return `${a} collects ${fee} a week from ${biz} now. From me.`;
    return [`${a} has taken on ${biz}. ${fee} a week.`, `${a} is collecting from ${biz} now, ${fee} a week.`][n % 2];
  }
  m = /^(.+) \((.+)\) muscled in on (.+), which had been paying (.+) \((.+)\)\.$/.exec(raw);
  if (m) {
    const [, a, fa, biz, old] = m;
    if (old === t.name) return `${a} muscled in on ${biz}. It had been paying ${t.name}.`;
    if (a === t.name) return `${a} muscled in on ${biz}, which had been paying ${old}.`;
    return `${a}, one of the ${fa} crew, muscled in on ${biz}. It had been paying ${old}.`;
  }
  m = /^(.+) told (.+) to get out of (.+)\.$/.exec(raw);
  if (m && m[1] === t.name) return `${m[2]} came round to ${m[3]} wanting a weekly payment. ${m[1]} sent him out with nothing.`;
  m = /^(.+) robbed (.+) of (\$[\d,]+)\.$/.exec(raw);
  if (m && m[2] === t.name) return `${m[1]} robbed ${t.name} of ${m[3]}.`;
  m = /^(.+) beat up (.+)\.$/.exec(raw);
  if (m && m[2] === t.name) return `${m[1]} beat ${t.name} up.`;
  return flavour(f, raw);
}
const SCENE = new Set(['beating', 'murder', 'robbery', 'vandalism', 'theft', 'burglary', 'raid', 'attempt', 'threat']);
const first1 = (w: World, id: string) => (w.chars[id]?.name.split(' ')[0] ?? 'the owner');

// What he will put into words, by who he is. Not a secret flag: it follows his temperament, how far he trusts you, and whether
// the matter shames him. Returns undefined when he will say it, or the line he gives instead.
const HUMILIATING = new Set(['beating', 'robbery', 'scam', 'shake', 'theft', 'vandalism', 'poach']);
export function holdsBack(w: World, t: Character, p: Character, f: Fact, what: 'who' | 'cost' | 'witness'): string | undefined {
  const tr = t.rels[p.id]?.trust ?? 0;
  const a = arch(t);
  const shamed = f.victim === t.id && HUMILIATING.has(f.kind);
  const actor = f.actor ? w.chars[f.actor] : undefined;
  if (a === 'proud' && shamed && tr < 0.55) return `${t.name} draws himself up. "That is my business, and I’ll deal with it myself."`;
  if (a === 'cold' && tr < 0.35) return `${t.name} looks at you for a while. "Not with you."`;
  if (a === 'bitter' && tr < 0.25) return `${t.name} shrugs. "Why would I tell you? What did anyone ever do for me?"`;
  if (a === 'hothead' && what === 'who' && actor && actor.familyId === t.familyId && tr < 0.5) return `${t.name}: "I’ll handle him myself. I don’t need the whole house knowing."`;
  if (a === 'schemer' && what === 'who' && !((t.rels[actor?.id ?? '']?.grudge ?? 0) >= 0.2) && tr < 0.55) return `${t.name} smiles. "A name is worth something. Come back when we’re better friends."`;
  if (a === 'schemer' && what === 'cost' && tr < 0.4) return `${t.name} waves it off. "Enough. Let’s not make it sound like more than it was."`;
  return undefined;
}

// ---------------------------------------------------------------- options

export function options(w: World, p: Character, t: Character, c: Convo): DOpt[] {
  const at = c.node === 'root' && introduced(w, p, t);
  const raw = at ? (c.ctx.focus && focused(w, p, t, c)) || hub(w, p, t, { ...c, ctx: { ...c.ctx, focus: undefined } }) : markStories(w, p, t, c, optionsRaw(w, p, t, c));
  // V77: the actions, costs and hints are untouched; only the label is put in the words the player would actually say.
  const day = Math.floor(w.now / 1440);
  const doneToday = (code: string) => code === 'chat' && (p.cooldown[`chat:${t.id}`] ?? -1) >= day;
  const seenL = new Set<string>();
  return raw.map((o) => {
    // (V90: leaving a follow-up is always said the same way, so the way back is always where you expect it)
    if (o.code === 'root' && c.node !== 'root') return { ...o, label: 'Talk about something else' };
    const x0 = o.code === 'root' || o.fixed || o.nav || o.label === 'Who would know?' ? o : { ...o, label: speak(w, p, t, o.code, o.label) };
    // (your lines are shown as speech already: no quotation marks round them; a cost stays after them)
    const x = { ...x0, label: x0.label.replace(/^“([^“”]*)”(\s*\(.*\))?$/, (_m, a: string, b?: string) => a.replace(/\.$/, '') + (b ?? '')).replace(/([^.])\.$/, '$1') };
    return !isNavCode(o.code) && ((c.used ?? []).includes(usedKey(c, o.code)) || doneToday(o.code)) ? { ...x, done: true } : x;
  }).filter((o) => { if (isNavCode(o.code) || o.code === 'root') return true; if (seenL.has(o.label)) return false; seenL.add(o.label); return true; });
}

// What a proposal is for (V90: the headings inside "Put something to him").
export const INTENTS = ['Ask him about something', 'Do something for him', 'Ask him for something', 'Take something up with him', 'Business and what’s owed'];
const INTENT: Record<string, number> = {};
const intentList = (i: number, codes: string[]) => codes.forEach((c) => { INTENT[c] = i; });
intentList(0, ['ask_around', 'ask_history', 'pick_member', 'leaders', 'ask_want', 'ask_crew', 'ask_rep', 'pick_incident', 'suspect', 'sit_ask', 'how', 'old_times', 'chat', 'cr_money', 'sh_how', 'sh_ears', 'rv_ears', 'rv_mood', 'a_ask', 'cr_ask', 'b_stand', 'about']);
intentList(1, ['sell_ask', 'recruit_offer', 'help_gift', 'help_loan', 'welcome', 'congrats', 'drink', 'offer_loan', 'sit_cover', 'sit_lend', 'sit_rival', 'cr_cash', 'cr_duties', 'a_gift', 'rv_drink', 'rv_favour', 'sh_time', 'sh_back', 'terms_cut', 'pick_concern', 'd_time', 'd_half', 'd_favour', 'd_forgive', 'b_tribute']);
intentList(2, ['buy_ask', 'stake_ask', 'run_ask', 'borrow', 'work', 'recommend', 'rk_back', 'rk_back_ask', 'promo', 'rate_ask', 'partner_chop', 'partner_fence', 'd_ask', 'b_need', 'b_more', 'sit_leave', 'intro', 'intro_via']);
intentList(3, ['demand', 'mediate', 'mediate2', 'challenge', 'refuse', 'a_own', 'a_start', 'a_defy', 'a_pay', 'd_remind', 'cr_thin', 'cr_drop', 'cr_look', 'sh_lean', 'sh_why', 'rv_warn', 'terms_raise', 'suggest', 'memo', 'report']);
intentList(4, ['b_envelope', 'b_extra', 'b_extra2', 'd_pay', 'd_all', 'earn', 'op', 'assign_low', 'assign_hustle', 'rate_ask']);
const AUTO: Record<string, string> = {
  work: 'See what jobs he has for you.', pick_member: 'Hear his view of someone else.', leaders: 'Learn who runs what, and who’s rising.', pick_concern: 'Pass something on. It may come back on you.', promo: 'Learn what it takes to be made.', recommend: 'He may vouch for you.', pick_incident: 'Go over something that happened.', cr_money: 'Learn if he’s in trouble.', cr_duties: 'Less pressure on him; less for you.', partner_fence: 'He moves goods and keeps a cut.', suspect: 'Name a man you suspect.', memo: 'Settle something outstanding.',
  how: 'Learn how he’s really doing.', old_times: 'Warms him up a little.', drink: 'Costs $40. He likes you more.', op: 'Learn how his business is going.', earn: 'Find out what he makes.',
  ask_rep: 'Hear what people say about you.', ask_want: 'Find out what he’s after.', ask_crew: 'Learn who he trusts.', help_gift: 'Costs $200. He owes you.', welcome: 'He’ll remember it.', congrats: 'Small, but noticed.',
};
// ================================================================== V90: the conversation, arranged
// A conversation is in one of two places (docs/V90_CONVERSATION.md). The hub: what he raises himself, what is open between you
// (each matter one row, by name), four everyday questions, one door to proposals, and leaving. A subject: once a row is chosen the
// screen is about that one thing, his reply and the answers that follow from it, and "Talk about something else" back to the hub.
// Every capability lives in exactly one place. The old sub-menus (n:...) are only how the leaves are found; the player never
// browses them. ctx.focus names the subject in hand: 'm:<matter>' (yours with him), 'mt:<matter>' (one he is in), 'enc:<request>'
// (his request of you), a node ('debt', 'shop', 'crew', 'amends', 'memos', 'myboss', 'disputes', 'sit'), 'talk', 'think', 'put'.
type Item = { o: DOpt; cat: string };
// where each leaf of the old sub-menus lives now
const PLACE: Record<string, 'talk' | 'think' | 'put'> = {};
const place = (p: 'talk' | 'think' | 'put', codes: string[]) => codes.forEach((c) => { PLACE[c] = p; });
place('talk', ['old_times', 'rv_drink', 'how', 'op', 'chat', 'earn', 'sh_how', 'sit_ask', 'cr_money']);
place('think', ['b_stand', 'pick_member', 'leaders', 'ask_rep', 'ask_history', 'ask_want', 'ask_crew', 'rv_ears', 'rv_mood', 'rk_back_ask', 'about']);
// every other leaf of personal, business, family, orders and rival, and the root's proposals, is something you put to him
const OWN_NODES = ['debt', 'shop', 'crew', 'amends', 'memos', 'disputes'] as const; // (your boss is not a matter: what you ask of him is a proposal, where you stand a question)
// V90: nothing you say is met with silence. Where an action has no answer of its own, he acknowledges it, in his own temperament.
// a line in which he answers: his words, his reaction, or narration of him rather than of you
export const answered = (l: string, name?: string) => !l.startsWith('⟡') && (!/^You\b/.test(l) || /[“"]/.test(l) || /(^|[.!?]\s+)(He|His|Him)\b/.test(l) || (!!name && new RegExp(`(^|[.!?]\\s+)${name}\\b`).test(l)));
function ack(w: World, t: Character, p: Character, lines: string[], leaving = false, social = false): string[] {
  const said = lines.filter((l) => !l.startsWith('⟡'));
  if (said.some((l) => answered(l, t.name.split(' ')[0]) || answered(l, t.name))) return lines;
  const tp = temper(t), r = t.rels[p.id];
  // (what he does when what you did needs no words back: in keeping with what it was, and with how he is with you)
  const pool = leaving ? (tp.agreeable > 0.55 ? ['“Another time, then.”', 'He nods. “Another time.”'] : tp.volatility > 0.6 ? ['He shrugs.', '“Suit yourself.”'] : ['He nods.', '“Fine.”'])
    : (r?.grudge ?? 0) >= 0.4 ? ['He says nothing. He doesn’t have to.', 'He looks at you a long moment, and says nothing.']
    : social ? (tp.agreeable + tp.empathy > 1.1 ? ['He seems glad of the company.', 'He laughs, and some of the stiffness goes out of him.'] : tp.caution > 0.6 ? ['He listens more than he talks.', 'He keeps his own counsel, but he stays.'] : ['He nods along.', 'He seems to enjoy it, in his way.'])
    : tp.volatility + tp.pride > 1.15 ? ['He grunts.', '“Fine.”']
    : tp.agreeable + tp.empathy > 1.1 ? ['He nods. “Thank you.”', '“That’s fair.”']
    : tp.caution > 0.6 ? ['He nods slowly, giving nothing away.', '“I understand.”'] : ['He nods.', '“All right.”'];
  const l = pool[(said.length + t.id.length + Math.floor(w.now / 60)) % pool.length];
  const i = lines.findIndex((x) => x.startsWith('⟡'));
  return i < 0 ? [...lines, l] : [...lines.slice(0, i), l, ...lines.slice(i)];
}
const BIZ_SUBJ = /^tk:(shop|racket)\b/;
// the matters between you that are conversations of their own (threads.ts)
const THREAD = /^tk:(earn|debt:|job:|ev:)/;
// Stage 5C: five ways into the rest of a conversation, the same five with everyone: Business, Socialize, Ask About, Organization,
// Settle Matters. What is in each is what this man and this moment allow (only things that are true); each is opened in words that
// fit who he is to you, and he answers before you go on.
export const GROUPS = ['business', 'social', 'ask', 'org', 'settle'] as const;
export type Group = (typeof GROUPS)[number];
const GRP: Record<string, Group> = {};
const grp = (g: Group, codes: string[]) => codes.forEach((c) => { GRP[c] = g; });
grp('business', ['op', 'earn', 'sh_how', 'biz_none', 'rate_ask', 'buy_ask', 'stake_ask', 'sell_ask', 'run_ask', 'borrow', 'offer_loan', 'partner_chop', 'partner_fence', 'suggest', 'terms_cut', 'terms_raise', 'sh_ears', 'sh_time', 'sh_back', 'b_envelope', 'b_extra', 'b_extra2', 'd_pay', 'd_all', 'd_ask', 'rv_favour', 'assign_hustle']);
grp('social', ['how', 'old_times', 'drink', 'help_gift', 'help_loan', 'welcome', 'congrats', 'rv_drink', 'cr_money', 'cr_cash', 'a_gift', 'b_tribute', 'sit_ask']);
grp('ask', ['chat', 'f:think', 'ask_around', 'ask_history', 'pick_member', 'leaders', 'ask_want', 'ask_crew', 'ask_rep', 'pick_incident', 'suspect', 'about', 'rv_ears', 'rv_mood', 'a_ask', 'cr_ask', 'inc']);
grp('org', ['b_stand', 'b_need', 'b_more', 'promo', 'recommend', 'rk_back', 'rk_back_ask', 'work', 'cr_duties', 'assign_low', 'recruit_offer', 'intro', 'intro_via', 'pick_concern', 'report']);
grp('settle', ['demand', 'mediate', 'mediate2', 'challenge', 'refuse', 'a_own', 'a_start', 'a_defy', 'a_pay', 'd_remind', 'd_time', 'd_half', 'd_favour', 'd_forgive', 'cr_thin', 'cr_drop', 'cr_look', 'sh_lean', 'sh_why', 'rv_warn', 'memo', 'confront', 'word_make', 'favcall', 'sit_cover', 'sit_lend', 'sit_rival', 'sit_leave']);
export function groupOf(code: string, cat = 'root'): Group {
  const k = code.split(':')[0];
  if (k === 'tk') return BIZ_SUBJ.test(code) || /^tk:debt:/.test(code) ? 'business' : /^tk:earn/.test(code) ? 'settle' : /^tk:job:/.test(code) ? 'org' : /^tk:(ev:|hurting)/.test(code) ? 'ask' : 'social';
  if (k === 'f') return code === 'f:think' ? 'ask' : 'settle';
  if (GRP[k]) return GRP[k];
  if (cat === 'family' || cat === 'orders' || cat === 'myboss' || cat === 'crew') return 'org';
  const i = INTENT[k];
  return i === 0 ? 'ask' : i === 1 ? 'social' : i === 3 ? 'settle' : 'business';
}
// What counts as trouble between men (a quarrel, a wrong), as against the ordinary record of what was agreed or owned.
const TROUBLE = new Set(['beating', 'murder', 'robbery', 'vandalism', 'theft', 'burglary', 'raid', 'attempt', 'threat', 'poach', 'protection_refused', 'scam', 'exposed', 'discipline', 'arrest', 'debt_default']);
const TALKQ = new Set(['how', 'op', 'chat', 'earn', 'sh_how', 'sit_ask', 'old_times', 'drink', 'rv_drink']);
export const QUESTIONS = ['How are you keeping?', 'How’s business?', 'Heard anything?', 'What do you make of…?'];
const PUT_HEAD: Record<number, string> = { 1: 'Offer him something', 2: 'Ask him for something', 3: 'Take something up with him', 4: 'Money and what’s owed', 0: 'Ask him for something' };

function gather(w: World, p: Character, t: Character, c: Convo) {
  const raw = markStories(w, p, t, c, optionsRaw(w, p, t, c));
  const b0 = ownerBiz(w, t.id);
  const RK = (r: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(r);
  const superior = RK(t.rank) > RK(p.rank) || t.id === p.bossId;
  const crewMan = t.bossId === p.id;
  const hasRk = raw.some((o) => o.code === 'rk_back');
  const day = Math.floor(w.now / 1440), soc = p.cooldown[`soc:${t.id}`] ?? 0, talkedToday = Math.floor(soc / 10) === day ? soc % 10 : 0;
  // (V78's rules for what is worth offering at all, kept: one way to ask the same thing, nothing a man of his place can't answer)
  const hide = (code: string) => {
    const k = code.split(':')[0];
    if (k === 'cr_money') return true; // covered by asking how he's keeping
    if (k === 'earn' && crewMan) return true; // Sunday and the Crew tab show what a man hands up
    if (k === 'work' && (crewMan || t.id === p.bossId)) return true;
    if (k === 'leaders' || k === 'promo' || k === 'pick_concern') return !superior;
    if (k === 'recommend') return hasRk;
    if (k === 'ask_rep') return t.rank === 'civilian' || (p.cooldown[`rep:${t.id}`] ?? 0) > w.now;
    if (k === 'old_times') return rel(t, p.id).affection >= 0.8 || talkedToday >= 2;
    if (k === 'drink') return talkedToday >= 3;
    return false;
  };
  const leaves = (node: string) => markStories(w, p, t, { ...c, node }, optionsRaw(w, p, t, { ...c, node })).filter((o) => o.code !== 'root' && !o.code.startsWith('n:') && !hide(o.code));
  const items: Item[] = [];
  const have = (code: string) => items.some((x) => x.o.code === code);
  const add = (o: DOpt, cat: string) => { if (hide(o.code) || have(o.code)) return; items.push({ o: { ...o, hint: o.hint ?? AUTO[o.code.split(':')[0]] }, cat }); };
  for (const o of raw) if (o.code !== 'root' && !o.code.startsWith('n:')) add(o, 'root');
  for (const n of ['personal', 'business', 'family', 'orders', 'rival', 'myboss']) if (raw.some((o) => o.code === 'n:' + n)) for (const o of leaves(n)) add(o, n);
  if (t.prospect && t.rank === 'civilian' && RK(p.rank) >= 1 && !askBetween(w, 'recruit', p.id, t.id)) add({ code: 'recruit_offer', label: 'There’s a place for you with me, if you want it', hint: `Costs $150 to start. He becomes your responsibility.` }, 'root');
  return { raw, items, leaves, b0, superior, crewMan };
}

// The rows of the hub, each either a thing to say now or the door to a subject.
function hub(w: World, p: Character, t: Character, c: Convo, all = false): DOpt[] {
  if (c.ctx.shut) return [{ code: 'root', label: 'Take your leave' }];
  const g = gather(w, p, t, c);
  const out: DOpt[] = [];
  const door = (focus: string, label: string, hint: string | undefined, group: string, big = false): DOpt => ({ code: 'f:' + focus, label, hint, group, nav: true, big, story: 'go' });
  // 1. what he raises himself: a request he has of you, or (your boss, on a Sunday) the envelope
  const his = asksOf(w, t);
  const env = g.items.find((x) => x.o.code === 'b_envelope');
  if (his[0]) out.push(door('enc:' + his[0].id, his[0].title, his[0].lines.at(-1)?.replace(/^[^“"]*(?=[“"])/, ''), 'He brings it up', true));
  if (env) out.push({ ...env.o, group: his[0] ? 'Between you' : 'He brings it up', big: true });
  // work he has put your way and is waiting to hear about (V90: the same offer as on your list, raised by him in person)
  const job = w.jobs.find((j) => j.giver === t.id && j.status === 'offered' && (!j.assignee || j.assignee === p.id));
  if (job && !his[0]) out.push(door('job:' + job.id, job.title, `Pays ${money(job.pay ?? 0)}. He wants an answer.`, 'He brings it up', true));
  // nothing pressing: what is on his mind (talk.ts), if anything is
  if (!his[0] && !env && !job) for (const o of subjectRows(w, p, t, 6).filter((x) => !BIZ_SUBJ.test(x.code) && !THREAD.test(x.code) && x.code !== 'tk:hurting').slice(0, 1)) if (!(c.used ?? []).includes(usedKey(c, o.code))) out.push({ ...o, group: 'On his mind' });
  // 2. what is open between you, one row a matter, by name. The matters that are conversations of their own (threads.ts: his money,
  // a debt, a job, something that happened) come first, said the way you would open them.
  const bw = 'Between you';
  const threads = subjectRows(w, p, t, 10).filter((o) => THREAD.test(o.code) && !(c.used ?? []).includes(usedKey(c, o.code)));
  for (const o of threads) out.push({ ...o, group: bw, big: true, story: 'go' });
  for (const e of his.slice(1, 3)) out.push(door('enc:' + e.id, e.title, 'He is waiting on your answer.', bw, true));
  for (const s of openMatters(w).filter((x) => x.terms?.by === p.id && x.terms?.of === t.id).slice(0, 3)) out.push(door('m:' + s.id, mTitle(w, s), matterWhere(w, s, t), bw, true));
  const seenSit = new Set<string>();
  for (const { s } of topicsWith(w, p, t)) if (!seenSit.has(s.id)) { seenSit.add(s.id); out.push(door('mt:' + s.id, matterTitle(w, s) ?? s.cause, 'Something you both know about.', bw)); }
  const lied = Object.keys(t.denied ?? {}).map((id) => w.facts[id]).find((f) => f && f.actor === t.id && p.known[f.id]?.knowsActor && p.known[f.id].from !== t.id);
  if (lied) out.push({ code: 'confront:' + lied.id, label: 'You told me it wasn’t you.', hint: 'You know it was. How he takes it says a lot.', story: 'go', big: true, group: bw });
  if (brokenWord(w, p, t) && !askBetween(w, 'amends', p.id, t.id)) out.push({ code: 'word_make', label: 'I let you down. I want to make it right.', hint: 'It will cost you something, and he will remember that you came.', story: 'go', big: true, group: bw });
  const owesMe = !askBetween(w, 'favour', p.id, t.id) ? w.favours.find((f) => !f.settled && f.from === p.id && f.to === t.id && (w.sitcool?.[`ask:favour:${p.id}:${t.id}:${f.id}`] ?? 0) <= w.now) : undefined;
  if (owesMe) out.push({ code: 'favcall:' + owesMe.id, label: `Call in the favour he owes you: ${money(150 * Math.max(1, owesMe.size))}`, hint: 'He owes you. What he does about it says what he is.', story: 'go', group: bw });
  for (const n of OWN_NODES) {
    const r = g.raw.find((o) => o.code === 'n:' + n);
    if (!r || !g.leaves(n).length) continue;
    if (n === 'debt' && threads.some((o) => o.code.startsWith('tk:debt:'))) continue; // (the debt is a conversation of its own now)
    // (trouble he has heard of is what "Heard anything?" is for; it is between you only when it is his own, or yours)
    const trouble = incidentsOf(w, t).find(({ f }) => TROUBLE.has(f.kind) && p.known[f.id] && (f.victim === t.id || f.actor === t.id || f.actor === p.id || f.victim === p.id));
    if (n === 'disputes' && !grudgeTarget(w, t) && !trouble) continue;
    // (named for what it is about, and the hint is what happened, not a list of the kinds of thing it might be)
    out.push(door(n, doorLabel(w, p, t, n, r.label), n === 'disputes' && trouble ? clip(p.known[trouble.f.id]?.knowsActor ? trouble.f.text : trouble.f.textHidden ?? trouble.f.text, 70) : r.hint, bw, r.story === 'go'));
  }
  const sit = sitOf(w, t.id);
  if (sit && sit.kind !== 'ambition' && (sit.told || sit.knows)) out.push(door('sit', ownerBiz(w, t.id) ? `His trouble at ${ownerBiz(w, t.id)!.name}` : 'His trouble', 'What he told you is going wrong.', bw, true));
  const inc = incidentsOf(w, t).find(({ f }) => p.known[f.id] && involvedIn(w, t, f));
  if (inc && !g.raw.some((o) => o.code === 'n:disputes')) out.push({ code: 'inc:' + inc.f.id, label: inc.f.victim === t.id ? 'I heard you ran into some trouble. What happened?' : inc.f.actor === t.id ? 'There’s talk you had a hand in something. Is it true?' : 'I heard something about what went on at your place.', hint: 'He was there.', story: 'go', group: bw });
  // Between you is kept short: the most pressing three, and one row to the rest
  const between = out.filter((o) => o.group === bw).map((o, i) => ({ o, i, w: prio(o, g) })).sort((a, b) => b.w - a.w || a.i - b.i);
  const shown = new Set(between.slice(0, all ? 99 : 3).map((x) => x.o));
  const rest = out.filter((o) => o.group !== bw || shown.has(o));
  if (between.length > 3 && !all) rest.push({ code: 'f:more', label: `Other things between you (${between.length - 3})`, group: bw, nav: true });
  out.length = 0; out.push(...rest);
  // a man who is angry with you, or out of patience, is in no mood for small talk or proposals
  if (c.ctx.cold) return [...out, { code: 'root', label: 'Take your leave' }];
  // 3. the five ways into the rest of it, each only where there is something to say (Stage 5C)
  const say = openers(w, p, t);
  for (const k of GROUPS) if (groupRows(w, p, t, c, g, k).length) out.push({ code: 'f:g:' + k, label: say[k], group: 'Other subjects', nav: true, fixed: true });
  out.push({ code: 'root', label: say.leave, fixed: true });
  return out;
}
// What belongs in one of the five: the everyday questions, what he has on his mind, and what can be put to him, sorted by what it is.
function groupRows(w: World, p: Character, t: Character, c: Convo, g: ReturnType<typeof gather>, k: Group): DOpt[] {
  const rows: DOpt[] = [];
  const has = (code: string) => rows.some((r) => r.code === code);
  for (const o of talkRows(w, p, t, c, g)) if (groupOf(o.code) === k && !has(o.code)) rows.push({ ...o, group: undefined });
  for (const o of subjectRows(w, p, t, 4)) if (groupOf(o.code) === k && !has(o.code)) rows.push({ ...o, group: undefined });
  for (const x of g.items) if (groupOf(x.o.code, x.cat) === k && !has(x.o.code) && !(PLACE[x.o.code.split(':')[0]] === 'talk' && k !== 'social' && x.o.code !== 'earn')) rows.push({ ...x.o, group: undefined });
  // (what is between you is what straightening things out is about)
  if (k === 'settle') for (const o of hub(w, p, t, { ...c, ctx: { ...c.ctx, focus: undefined, cold: true } }, true).filter((o) => o.group === 'Between you')) if (!has(o.code) && o.code !== 'root' && o.code !== 'f:more') rows.push({ ...o, group: undefined }); // (the hub without its groups: no going round in circles)
  if (k === 'org' && !(p.familyId && (t.familyId || t.bossId === p.id))) return [];
  return rows;
}
// The words you open each with, by who he is to you: a stranger, a friend, the man above you, one of your own, a shopkeeper.
function openers(w: World, p: Character, t: Character): Record<Group | 'leave', string> {
  const RK = (r: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(r);
  const above = t.id === p.bossId || (!!t.familyId && t.familyId === p.familyId && RK(t.rank) > RK(p.rank));
  const mine = t.bossId === p.id, r = peek(t, p.id), close = r.trust >= 0.6 && r.affection >= 0.45, stranger = (p.rels[t.id]?.known ?? 0) < 0.25 && !close;
  const shop = t.rank === 'civilian' && !!ownerBiz(w, t.id), rival = !!t.familyId && !!p.familyId && t.familyId !== p.familyId;
  return {
    business: shop ? 'I’d like to talk about your business.' : above ? 'I wanted to discuss some business.' : mine ? 'We need to go over some business.' : close ? 'Got something I wanna run by you.' : stranger ? 'Mind if I talk business with you?' : 'Let’s talk business.',
    social: close ? 'How’ve you been keeping?' : above ? 'How are things with you?' : stranger ? 'How are things?' : 'How’ve you been?',
    ask: above ? 'Could I ask you something?' : close ? 'Can I ask you something?' : 'I wanted to ask you something.',
    org: mine ? 'Let’s talk about the crew.' : above ? 'I wanted to talk about where I stand.' : rival ? 'Let’s talk about how things stand between our people.' : 'Let’s talk about the family.',
    settle: above ? 'There’s something I need to raise with you.' : close ? 'We need to clear something up.' : 'There’s something we need to straighten out.',
    leave: above ? 'I’ll let you get on.' : mine ? 'That’s all for now.' : close ? 'I’ll catch you later.' : 'I’ll leave you to it.',
  };
}
// How pressing a row between you is: what he is waiting on, what has just moved, what is overdue, before what merely exists.
function prio(o: DOpt, g: ReturnType<typeof gather>): number {
  if (o.code.startsWith('f:enc:')) return 10;
  if (o.code === 'b_envelope') return 9.5;
  if (o.code.startsWith('f:m:')) return 9;
  if (THREAD.test(o.code)) return /^tk:(earn|debt:)/.test(o.code) ? 8.5 : 6.5;
  if (o.code.startsWith('confront:') || o.code === 'word_make') return 7;
  if (o.code === 'f:debt' || o.code === 'f:shop') return o.story === 'go' || /late|behind|missed/i.test(o.label + (o.hint ?? '')) ? 8 : 5;
  if (o.code.startsWith('f:mt:') || o.code.startsWith('inc:')) return 6;
  return o.story === 'go' ? 6 : 4;
  void g;
}
// What a man would naturally put to this man, given who he is to him: work and a bigger piece from your boss, protection to a
// shopkeeper, orders to your own man, a word to a man of another family. The rest of what is possible waits behind one row.
const ROLE_PUTS: Record<string, string[]> = {
  boss: ['b_need', 'promo', 'b_more'],
  above: ['rk_back', 'recommend', 'work', 'promo', 'borrow'],
  mine: ['assign_low', 'assign_hustle'],
  peer: ['work', 'borrow', 'rk_back'],
  shop: ['suggest', 'offer_loan', 'partner_chop', 'partner_fence'], // (changing a fee you have agreed is there, behind 'something else': it isn't the first thing to say)
  civilian: ['recruit_offer', 'offer_loan'],
  rival: ['rv_favour', 'rv_warn'],
};
function leadPuts(w: World, p: Character, t: Character, puts: DOpt[]): DOpt[] {
  const RK = (r: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(r);
  const role = t.id === p.bossId ? 'boss' : t.bossId === p.id ? 'mine' : t.rank === 'civilian' ? (ownerBiz(w, t.id) ? 'shop' : 'civilian')
    : t.familyId && p.familyId && t.familyId !== p.familyId ? 'rival' : RK(t.rank) > RK(p.rank) ? 'above' : 'peer';
  const want = ROLE_PUTS[role];
  return want.map((k) => puts.find((o) => o.code.split(':')[0] === k)).filter((o): o is DOpt => !!o).slice(0, 2);
}
// Everything between you, for the "other things" row (the hub shows only the most pressing three).
function hubBetween(w: World, p: Character, t: Character, c: Convo): DOpt[] {
  const full = hub(w, p, t, { ...c, ctx: { ...c.ctx, focus: undefined, cold: true } }, true);
  const shown = new Set(hub(w, p, t, { ...c, ctx: { ...c.ctx, focus: undefined } }).filter((o) => o.group === 'Between you' || o.group === 'He brings it up').map((o) => o.code));
  return full.filter((o) => (o.group === 'Between you' || o.group === 'He brings it up') && !shown.has(o.code)).map((o) => ({ ...o, group: undefined }));
}
// What a matter between you is called on the hub: what it is about, not which part of the game it belongs to.
function doorLabel(w: World, p: Character, t: Character, n: string, label: string): string {
  const b = ownerBiz(w, t.id);
  if (n === 'shop' && b) return /late/i.test(label) ? `The envelope from ${b.name} is late` : `The arrangement at ${b.name}`;
  if (n === 'amends') return 'The bad blood between you';
  if (n === 'memos') return 'What’s still outstanding between you';
  if (n === 'disputes') {
    const g = grudgeTarget(w, t);
    if (g) return `His trouble with ${w.chars[g[0]].name}`;
    const f = incidentsOf(w, t).map((x) => x.f).find((f) => TROUBLE.has(f.kind) && p.known[f.id] && (f.victim === t.id || f.actor === t.id || f.actor === p.id || f.victim === p.id));
    if (f) return f.actor === p.id ? (f.victim === t.id ? 'What you did to him' : 'What you did') : f.victim === p.id ? (f.actor === t.id ? 'What he did to you' : 'What happened to you') : f.business && w.biz[f.business] ? `What happened at ${w.biz[f.business].name}` : f.victim === t.id ? 'What happened to him' : 'What he did';
  }
  return label;
}
// Where a matter of yours with him stands, in a few words (never the numbers behind it).
function matterWhere(w: World, s: import('./types').Situation, t: Character): string {
  const S0 = s.st?.[t.id];
  return S0?.last === 'counter' ? 'He named his own terms.' : S0?.last === 'stall' ? 'He asked for time.' : S0?.last === 'no' ? 'He said no, for now.' : s.m?.help ? 'He went to someone about it.' : 'Waiting on his answer.';
}
// The four everyday questions, as the codes that answer them for this man. "How's business?" asks after whatever his business is.
function talkRows(w: World, p: Character, t: Character, c: Convo, g = gather(w, p, t, c)): DOpt[] {
  const sit = sitOf(w, t.id), b = g.b0;
  // (his shop or his racket, when it is on his mind, is what "How's business?" opens: one way to ask, with what follows from it)
  const subj = subjectRows(w, p, t, 6).find((x) => BIZ_SUBJ.test(x.code));
  const asked = (c.used ?? []).map((u) => u.slice(u.indexOf('|') + 1)).find((u) => BIZ_SUBJ.test(u) || ['sit_ask', 'sh_how', 'op', 'earn', 'biz_none'].includes(u)); // (asked already, however: it stays asked)
  const biz = asked ? asked : subj ? subj.code : sit && sit.kind !== 'ambition' && !sit.told && !sit.knows && (p.cooldown[`sitask:${t.id}`] ?? 0) <= w.now ? 'sit_ask'
    : b?.protection?.collectorId === p.id ? 'sh_how' : (b || lineOf(w, t)) ? 'op' : g.crewMan && g.items.some((x) => x.o.code === 'earn') ? 'earn' : 'biz_none'; // (your own man's business is what he brings you)
  const rows: DOpt[] = [
    { code: 'how', label: QUESTIONS[0], hint: 'How he really is.', fixed: true },
    { code: biz, label: QUESTIONS[1], hint: 'His trade, his racket, his money.', fixed: true },
    { code: 'chat', label: QUESTIONS[2], hint: 'What’s going round.', fixed: true },
    { code: 'f:think', label: QUESTIONS[3], hint: 'His view of a man, of the family, of you.', nav: true, fixed: true },
  ];
  return rows;
}
function putRows(w: World, p: Character, t: Character, g: ReturnType<typeof gather>): DOpt[] {
  return g.items.filter((x) => !PLACE[x.o.code.split(':')[0]] && x.o.code !== 'b_envelope' && !x.o.code.startsWith('n:')).map((x) => ({ ...x.o, group: PUT_HEAD[INTENT[x.o.code.split(':')[0]] ?? 2] }));
}
// The subject in hand: only what belongs to it, and the way back.
function focused(w: World, p: Character, t: Character, c: Convo): DOpt[] | undefined {
  const f = c.ctx.focus!;
  const [k, id] = [f.split(':')[0], f.slice(f.indexOf(':') + 1)];
  const g = gather(w, p, t, c);
  let rows: DOpt[] = [];
  if (k === 'm') { const s = openMatters(w).find((x) => x.id === id && x.terms?.by === p.id); if (s) {
    // the point he has just made comes first: answers to it, then only the plain moves that still make sense beside them
    const rs = exReplies(w, p, s);
    rows = rs.map((x) => ({ code: `x:${s.id}:${x.k}`, label: x.label, hint: x.hint, big: x.big, story: 'go' as const }));
    const keep = rs.length ? new Set(['take', 'pressure', 'wait', 'drop']) : undefined;
    rows.push(...playerMoves(w, p, s).filter((m) => !keep || keep.has(m.move)).map((m) => ({ code: `mv:${s.id}:${m.move}`, label: m.label, hint: m.off ?? m.hint, story: (m.move === 'drop' || m.move === 'take' ? 'end' : 'go') as 'end' | 'go', big: !m.off && ['force', 'pressure', 'leverage', 'take'].includes(m.move), done: !!m.off })));
    // (Stage 4: the figure is his to name, in a matter about money)
    const K0 = ASKS[s.ak ?? ''], fig0 = K0?.figure?.(w, s);
    // (where the figure is money he puts up, the field goes no higher than he has; if even the least is beyond him, it says so)
    const fig = fig0 && K0?.short ? { ...fig0, max: Math.min(fig0.max, Math.floor(p.cash / fig0.step) * fig0.step) } : fig0;
    if (fig && fig.max < fig.min) rows.splice(Math.min(1, rows.length), 0, { code: `nm:${s.id}`, label: 'Name your own figure', hint: 'You haven’t the money to put a figure to him.', done: true });
    else if (fig && fig.max >= fig.min) rows.splice(Math.min(1, rows.length), 0, { code: `nm:${s.id}`, label: 'Name your own figure', done: (p.cooldown[`askmv:${s.id}:name`] ?? -1) >= Math.floor(w.now / DAY) /* one figure a day: he has heard your number */, hint: fig.rate ? 'How much, and how much a week on top. He answers what you put to him.' : 'Put a number to him. He answers it from what he has and what it is worth to him.', big: true, story: 'go', amount: { value: Math.round(clamp(s.terms?.amt ?? fig.min, fig.min, fig.max) / fig.step) * fig.step, min: fig.min, max: fig.max, step: fig.step, ...(fig.rate ? { rate: { value: s.terms?.rate ?? 0.05, min: fig.rate.min, max: fig.rate.max } } : {}) } });
  } }
  else if (k === 'enc') { const e = asksOf(w, t).find((x) => x.id === id); if (e) rows = e.opts.map((o) => ({ code: `enc:${e.id}:${o.code}`, label: o.label, hint: o.hint, story: 'go' as const, big: true })); }
  else if (k === 'mt') rows = topicsWith(w, p, t).filter((x) => x.s.id === id).map(({ s, o }) => ({ code: `mt:${s.id}:${o.code}`, label: o.label, hint: o.hint, story: 'go' as const, big: o.big }));
  else if ((OWN_NODES as readonly string[]).includes(k)) rows = g.leaves(k);
  else if (k === 'sit') { const sit = sitOf(w, t.id); if (sit && (sit.told || sit.knows)) { if (sit.rival && w.biz[sit.rival]?.open) rows.push({ code: 'sit_rival', label: `“I’ll send word to ${w.biz[sit.rival].name}.”`, hint: 'Nothing violent. A little heat, a grudge, and his customers come back.', story: 'end' }); if (p.cash >= 600) rows.push({ code: 'sit_cover', label: '“Let me cover what you’ve lost.” ($600)', hint: 'No book, no vig. He won’t forget it.', story: 'end' }); if (p.cash >= 400) rows.push({ code: 'sit_lend', label: '“I can lend you $400. The usual terms.”', hint: 'The usual weekly. He owes you.', story: 'end' }); rows.push({ code: 'sit_leave', label: '“You’ll have to sort this out yourself.”', hint: 'He learns what he’s worth to you.', story: 'end' }); } }
  else if (k === 'job') { const j = w.jobs.find((x) => x.id === id && x.status === 'offered'); if (j) rows = [{ code: 'jobtake:' + j.id, label: 'I’ll take care of it', hint: `It’s yours. Pays ${money(j.pay ?? 0)}.`, big: true, story: 'go' }, { code: 'jobpass:' + j.id, label: 'Not this time', hint: 'He will think a little less of you for it.' }]; }
  else if (k === 'put') { const puts = putRows(w, p, t, g), lead = new Set(leadPuts(w, p, t, puts).map((o) => o.code)); rows = puts.filter((o) => !lead.has(o.code)).sort((a, b) => (INTENT[a.code.split(':')[0]] ?? 2) - (INTENT[b.code.split(':')[0]] ?? 2)).map((o) => ({ ...o, group: undefined })); } // (one plain list, offers before requests before complaints: no headings to read)
  else if (k === 'apx') { const e = asksOf(w, t).find((x) => x.id === id); if (e) { const heard = c.ctx.asked.includes('apx:what:' + id); rows = [{ code: 'f:enc:' + id, label: 'Sure. What’s going on?', story: 'go', big: true }, ...(heard ? [] : [{ code: 'apx:what:' + id, label: 'Depends what it’s about.' }, { code: 'apx:wait:' + id, label: 'Can it wait?', hint: 'He will wait. He will notice he had to.' }]), { code: 'apx:no:' + id, label: 'Not right now.', hint: 'He will take it as it sounds.' }]; return rows; } }
  else if (k === 'more') rows = hubBetween(w, p, t, c);
  else if (k === 'g') { rows = groupRows(w, p, t, c, g, id as Group); if (!rows.length) return undefined; return [...rows, { code: 'f:', label: 'Actually, something else', nav: true }, { code: 'root', label: openers(w, p, t).leave }]; }
  else if (k === 'think') {
    rows = g.items.filter((x) => PLACE[x.o.code.split(':')[0]] === 'think').map((x) => x.o);
    for (const o of subjectRows(w, p, t, 6)) if (!rows.some((r) => r.code === o.code)) rows.push(o);
  } else if (k === 'talk') {
    // after one of the everyday questions: what is on his mind, the small courtesies, and the other questions
    rows = [...subjectRows(w, p, t, 3), ...g.items.filter((x) => ['old_times', 'rv_drink'].includes(x.o.code)).map((x) => x.o), ...talkRows(w, p, t, c, g)];
  }
  rows = rows.filter((o, i, a) => a.findIndex((x) => x.code === o.code) === i);
  if (!rows.length) return undefined; // the subject has run its course (settled, withdrawn): back to the hub
  return [...rows, { code: 'f:', label: 'Talk about something else', nav: true }, { code: 'root', label: 'Take your leave' }];
}
// What the subject in hand is called, for the top of the choices.
export function focusTitle(w: World, p: Character, t: Character, c: Convo): string | undefined {
  const f = c.ctx.focus; if (!f) return undefined;
  const [k, id] = [f.split(':')[0], f.slice(f.indexOf(':') + 1)];
  if (k === 'm') { const s = openMatters(w).find((x) => x.id === id); return s ? mTitle(w, s) : undefined; }
  if (k === 'g') return ({ business: 'Business', social: 'Catching up', ask: 'Asking about something', org: 'The family', settle: 'Straightening something out' } as Record<string, string>)[id];
  if (k === 'enc') return w.enc.find((x) => x.id === id)?.title;
  if (k === 'mt') { const s = (w.situations ?? []).find((x) => x.id === id); return s ? matterTitle(w, s) ?? s.cause : undefined; }
  if (k === 'sit') return 'His trouble';
  if (k === 'job') return w.jobs.find((x) => x.id === id)?.title;
  if (k === 'put') return 'Putting something to him';
  if (k === 'think') return 'His view of things';
  if (k === 'talk') return undefined; // ordinary talk needs no label
  const r = optionsRaw(w, p, t, { ...c, node: 'root' }).find((o) => o.code === 'n:' + k);
  return r ? doorLabel(w, p, t, k, r.label) : undefined;
}
// How a man raises a matter he has with another, as he would say it: by what it is about, and where it got to last time.
function matterOpen(w: World, s: import('./types').Situation, last?: string): string {
  const b = s.biz ? w.biz[s.biz]?.name : undefined, seen = !!last;
  const L: Record<string, [string, string]> = { // [first time, again]
    protect: [`“I want to talk to you about ${b ?? 'the place'}. About keeping it in one piece.”`, last === 'stall' ? `“You’ve had time to think about ${b ?? 'it'}.”` : last === 'counter' ? '“I’ve thought about your figure.”' : `“About ${b ?? 'the place'}. I’d like a better answer than last time.”`],
    borrow: ['“I need to borrow some money.”', '“About the loan I asked you for.”'],
    lend: ['“I could help you out with some money.”', '“About the money I offered you.”'],
    recruit: ['“I’ve got a proposition for you. Come in with me.”', '“About what I said. Coming in with me.”'],
    collect: ['“We need to talk about what you owe.”', '“About the money. Again.”'],
    favour: ['“You remember that favour.”', '“About that favour.”'],
    amends: ['“I let you down. I want to put it right.”', '“About putting things right between us.”'],
    rate: ['“I want to talk about my share.”', '“About my share.”'],
    layoff: ['“About the business with your man.”', '“About what we talked about. Leaving it alone.”'],
  };
  const x = s.ak ? L[s.ak] : undefined;
  return x ? x[seen ? 1 : 0] : `“About ${mTitle(w, s).replace(/^./, (m) => m.toLowerCase())}.”`;
}
// Opening a subject is said, and answered: you name the matter, he answers from where it stands and who he is.
function openSubject(w: World, p: Character, t: Character, c: Convo, focus: string): string[] {
  const [k, id] = [focus.split(':')[0], focus.slice(focus.indexOf(':') + 1)];
  const tp = temper(t), hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1;
  const pickL = (xs: string[]) => xs[(t.id.charCodeAt(t.id.length - 1) + w.now / 1440 | 0) % xs.length];
  if (k === 'm') {
    const s = openMatters(w).find((x) => x.id === id); if (!s) return [];
    const last = s.st?.[t.id]?.last;
    const you = matterOpen(w, s, last);
    // the point he left it on, if he left it on one: he says it again, so what you answer is in front of you
    const RESTATE: Record<string, string> = { money: hot ? '“Like I said. I haven’t got it.”' : '“Like I told you, I can’t afford it.”', doubt: '“Like I said, I don’t know you, or who you’re with.”', taken: '“I told you. I already pay someone.”', you: hot ? '“You know how I feel about you.”' : '“I told you how things are between us.”', pride: '“I told you. I stand on my own feet.”', time: '“I’m still thinking it over.”' };
    // (a deal: the point he left it on is the price, the place, or you: asks 'buy', 'sell', 'run')
    if (classOf(s) === 'trade') { const T: Record<string, string> = { money: s.ak === 'sell' ? '“Like I said, it isn’t worth that to me.”' : s.ak === 'run' ? '“Like I said, that cut is too rich for me.”' : '“Like I said, it’s worth more than that.”', taken: s.ak === 'run' ? '“I told you, I’ve got a man on it.”' : '“I told you, it isn’t for sale.”', doubt: RESTATE.doubt, you: RESTATE.you, pride: RESTATE.pride, time: RESTATE.time }; if (s.m?.beat === 'claim' && T[String(s.m.claim)]) return [you, T[String(s.m.claim)]]; }
    if (s.m?.caught && s.m?.claim === 'money') return [you, last === 'counter' ? '“You’ve seen enough. You know what I can do.”' : '“All right. You know I can pay something.”']; // (what was found out stays found out)
    if (s.m?.beat === 'claim' && RESTATE[String(s.m.claim)]) return [you, RESTATE[String(s.m.claim)]];
    const him = last === 'no' ? (hot ? '“I gave you my answer.”' : soft ? '“I know. I’m sorry, it’s still the same.”' : '“Nothing’s changed.”')
      : last === 'stall' ? (hot ? '“I said I’d think about it.”' : '“I’ve been thinking about it. I have.”')
      : last === 'counter' ? '“You heard what I can do.”'
      : s.m?.help ? (hot ? '“I’ve got people now. Talk to them.”' : '“It’s not just me you’re dealing with any more.”')
      : pickL(['“Go on.”', '“I’m listening.”', '“Say what you came to say.”']);
    return [you, him];
  }
  if (k === 'job') { const j = w.jobs.find((x) => x.id === id); return j ? ['“You had something for me?”', jobSaid(j), ...(j.brief ? [j.brief] : [])] : []; }
  if (k === 'enc') { const e = w.enc.find((x) => x.id === id); return e ? ['“You wanted to ask me something?”', e.lines.at(-1) ?? ''].filter(Boolean) : []; }
  if (k === 'mt') { const s = (w.situations ?? []).find((x) => x.id === id); return s ? [`“This business with ${(matterTitle(w, s) ?? s.cause).replace(/^./, (m) => m.toLowerCase())}…”`, pickL(['He waits to hear what you know.', '“What about it?”', 'He gives you a long look. “Go on.”'])] : []; }
  if (k === 'g') {
    const say = openers(w, p, t), r = peek(t, p.id), close = r.trust >= 0.55, shy = tp.caution > 0.6 && r.trust < 0.3, trouble = !!sitOf(w, t.id);
    const his: Record<Group, string> = {
      business: hot ? '“What is it?”' : shy ? '“Depends what kind of business.”' : close || soft ? '“Sure. What’ve you got in mind?”' : '“Go on.”',
      social: trouble ? '“Could be better.”' : hot ? '“Fine. Why?”' : soft ? '“Can’t complain. You?”' : '“Getting by.”',
      ask: shy ? '“Depends what you’re asking.”' : soft ? '“Ask away.”' : '“Go ahead.”',
      org: t.bossId === p.id ? '“Sure. What do you need?”' : t.id === p.bossId ? '“What about it?”' : '“What about the family?”',
      settle: hot ? '“What now?”' : soft ? '“Go on. What is it?”' : '“I’m listening.”',
    };
    const gk = id as Group;
    return his[gk] ? [`“${say[gk]}”`, his[gk]] : [];
  }
  if (k === 'put') return [pickL(['“There’s something I want to put to you.”', '“I’ve got a proposition.”', '“Can I ask you something?”']), hot ? '“Make it quick.”' : soft ? '“Of course. What is it?”' : '“Go on.”'];
  if (k === 'think') return ['“I wanted your opinion on something.”', soft ? '“If I can help.”' : tp.caution > 0.6 ? '“Depends what you’re asking.”' : '“Ask.”'];
  if (k === 'debt' || k === 'shop' || k === 'amends' || k === 'memos' || k === 'myboss' || k === 'crew' || k === 'disputes' || k === 'sit') {
    const r = optionsRaw(w, p, t, { ...c, node: 'root' }).find((o) => o.code === 'n:' + k);
    const g = k === 'disputes' ? grudgeTarget(w, t) : undefined;
    const you = k === 'sit' ? '“About what you told me.”' : k === 'disputes' ? (g ? `“You and ${w.chars[g[0]].name.split(" ")[0]}. What’s going on?”` : '“About what happened.”')
      : k === 'debt' ? '“About the money.”' : k === 'amends' ? '“There’s bad blood between us. I don’t want it.”' : k === 'crew' ? '“How are you getting on?”' : k === 'shop' ? '“About our arrangement.”' : k === 'memos' ? '“There are a few things outstanding between us.”' : `“About ${doorLabel(w, p, t, k, r?.label ?? '').replace(/^./, (m) => m.toLowerCase())}.”`;
    return [you, hot ? '“What about it?”' : soft ? '“Yes. Let’s talk about it.”' : '“All right.”'];
  }
  return [];
}

// Which options are part of something that is going on between you and him. A ! moves it along; a tick can settle it.
function markStories(w: World, p: Character, t: Character, c: Convo, o: DOpt[]): DOpt[] {
  const crewStory = t.bossId === p.id && (!!t.problem || t.books.arrears > 0 || t.books.missed >= 2);
  const dispute = (w.disputes ?? []).some((x) => (x.status === 'open' || x.status === 'violated') && ((x.a === p.id && x.b === t.id) || (x.b === p.id && x.a === t.id)));
  const threat = rel(t, p.id).grudge >= 0.3 || rel(p, t.id).grudge >= 0.3;
  const debt = w.debts.some((x) => x.status === 'active' && ((x.creditor === p.id && x.debtor === t.id) || (x.creditor === t.id && x.debtor === p.id)) && (x.missed > 0 || x.balance > 0));
  const seat = t.id === p.bossId && !!readiness(w, p) && !readiness(w, p)!.openSeat;
  const go = new Set<string>(), end = new Set<string>();
  const key = (code: string) => code.split(':')[0];
  if (c.node === 'root') {
    if (crewStory) go.add('n:crew');
    if (dispute || threat) { go.add('n:disputes'); go.add('n:amends'); }
    if (debt) go.add('n:debt');
    if (seat) go.add('n:myboss');
    if (t.memos.some((m) => m.other === p.id && !m.done)) go.add('n:memos');
    go.add('rk_back');
  }
  const sets: Record<string, [string[], string[]]> = {
    crew: [['cr_ask', 'cr_drop', 'cr_look', 'cr_money', 'cr_thin'], ['cr_cash', 'cr_duties']],
    amends: [['a_start', 'a_defy', 'a_ask'], ['a_own', 'a_pay', 'a_gift']],
    disputes: [['pick_incident', 'suspect', 'demand'], ['mediate']],
    debt: [['d_remind', 'd_ask'], ['d_time', 'd_half', 'd_favour', 'd_forgive', 'd_pay', 'd_all']],
    myboss: [['b_stand', 'b_seat'], []],
  };
  const s = sets[c.node];
  if (s && (crewStory || dispute || threat || debt || seat)) { s[0].forEach((x) => go.add(x)); s[1].forEach((x) => end.add(x)); }
  return o.map((x) => { const k = key(x.code); return end.has(k) ? { ...x, story: 'end' as const } : go.has(k) ? { ...x, story: 'go' as const } : x; });
}

// The whole set of things a man allows right now, before the conversation arranges them (tests compare this with what is reachable).
export function optionsRaw(w: World, p: Character, t: Character, c: Convo): DOpt[] {
  const o: DOpt[] = [];
  const add = (code: string, label: string, hint?: string) => o.push({ code, label, hint });
  const back = () => add('root', c.node === 'root' ? 'Take your leave' : 'Change the subject');
  switch (c.node) {
    case 'root': {
      if (!introduced(w, p, t)) {
        const cd = (p.cooldown[`intro:${t.id}`] ?? 0) > w.now;
        add('intro', cd ? 'Introduce yourself (not now)' : 'Introduce yourself', cd ? 'He wasn’t interested. Try again tomorrow.' : 'Give your name and who you answer to.');
        for (const v of introducers(w, p, t)) add('intro_via:' + v.id, `Ask ${v.name.split(' ')[0]} to put in a word`, 'A name he trusts opens the door.');
        add('ask_around', 'Ask around about him first', 'What the street says.');
        back();
        break;
      }
      add('n:personal', 'Personal', 'How he is, what’s going on with him');
      add('n:business', 'Business', 'Operations, money, partnerships');
      if (inFamily(p, t)) add('n:family', 'Family business', 'Other members, leadership, your standing');
      if (incidentsOf(w, t).length || grudgeTarget(w, t)) add('n:disputes', 'Grievances', 'Recent incidents, suspicions, grievances');
      if (inFamily(p, t) || w.jobs.some((j) => j.giver === t.id && j.assignee === p.id && (j.status === 'active' || j.status === 'done'))) add('n:orders', 'Work and orders', 'Work, instructions, reporting');
      const memos = t.memos.filter((m) => m.other === p.id && !m.done);
      const asked = Object.values(w.facts).filter((f) => memos.some((m) => m.kind === 'question' && m.ref === f.id) && p.known[f.id]?.knowsActor);
      if (memos.length || asked.length) add('n:memos', 'Unfinished business', `${memos.length + asked.length} thing${memos.length + asked.length > 1 ? 's' : ''} outstanding`);
      const sb = ownerBiz(w, t.id);
      if (sb?.protection?.collectorId === p.id) add('n:shop', lateOf(sb) > 0 ? 'The envelope is late' : 'About the arrangement', lateOf(sb) > 0 ? `${lateOf(sb)} week${lateOf(sb) > 1 ? 's' : ''} behind.` : `${sb.name} pays you ${money(sb.protection.fee)} a week.`);
      if (t.familyId && p.familyId && t.familyId !== p.familyId && t.rank !== 'civilian') add('n:rival', `A man of the ${famName(w, t)} family`, 'Careful talk. Every word is repeated somewhere.');
      if (inFamily(p, t) && p.rank === 'associate' && t.rank !== 'associate' && t.rank !== 'civilian' && p.backer !== t.id && t.id !== p.bossId) add('rk_back', 'Ask him to back you', 'A made man’s word is how an associate gets made.');
      if (inFamily(p, t) && p.backer === t.id && p.rank === 'associate') add('rk_back_ask', 'Ask what he’s said about you', 'He’s your backer.');
      if (t.bossId === p.id && t.rank !== 'civilian') { if (!knows(p, t.id, 'want')) add('ask_want', 'Ask what he wants out of this', 'Men will tell you, if they trust you.'); add('ask_crew', 'Ask how he gets on with the others', 'Who he likes, and who he doesn’t.'); }
      add('ask_rep', 'Ask what people say about you', 'Not always flattering.');
      if (historyLines(w, p, t).length) add('ask_history', 'Bring up what’s between you', 'Some things are remembered.');
      if (t.bossId === p.id)  add('n:crew', 'How he’s getting on', t.problem && !t.problem.revealed ? 'Something is off with him.' : 'Your man.');
      const dts = w.debts.filter((d) => d.status === 'active' && ((d.creditor === p.id && d.debtor === t.id) || (d.creditor === t.id && d.debtor === p.id)));
      if (dts.length) {
        const mine = dts.filter((d) => d.creditor === p.id).reduce((a, d) => a + d.balance, 0);
        const his = dts.filter((d) => d.creditor === t.id).reduce((a, d) => a + d.balance, 0);
        add('n:debt', mine ? 'The money he owes you' : 'The money you owe him', mine ? `${money(mine)} outstanding${dts.some((d) => d.missed) ? ', and he’s behind' : ''}.` : `${money(his)} outstanding.`);
      }
      if (t.id === p.bossId) { const due = envelopeDue(w, p); if (kickWindow(w, p) && !crewEnvelopesWaiting(w, p) && due >= 20 && p.cash >= 20 && !c.ctx.asked.includes('b_envelope')) add('b_envelope', `Hand him your envelope (${money(due)})`, 'Last week’s share, in person.'); add('n:myboss', 'Where you stand with him', 'Ask, report, or ask for more.'); }
      if (rel(t, p.id).grudge >= 0.25) add('n:amends', 'Clear the air', 'There’s bad blood between you.');
      back();
      break;
    }
    case 'personal': {
      add('how', 'Ask how he’s holding up');
      const b = ownerBiz(w, t.id);
      if (t.cash < 300 || (b && (b.cash < 250 || b.distress > 0))) {
        add('help_gift', 'Slip him $200, no questions', 'He won’t forget it.');
        if (t.rank === 'civilian' || t.rank === 'associate') add('help_loan', 'Offer to lend him money', 'At a friend’s rate. You can change the amount and the rate.');
      }
      const back2 = Object.values(w.facts).find((f) => f.kind === 'arrest' && f.actor === t.id && w.now - f.t < 40 * DAY && t.jailedUntil <= w.now);
      if (back2) add('welcome', 'Welcome him back', 'He has been away.');
      const promo = Object.values(w.facts).find((f) => f.kind === 'promotion' && f.actor === t.id && w.now - f.t < 60 * DAY);
      if (promo) add('congrats', 'Congratulate him on being made');
      add('old_times', 'Reminisce');
      add('drink', 'Stand him a drink ($40)');
      back();
      break;
    }
    case 'business': {
      add('op', 'Ask how business is');
      if (t.id === p.bossId || t.bossId === p.id) add('earn', 'Discuss earnings');
      if (t.id === p.bossId && (p.cooldown['rate:ask'] ?? 0) <= w.now) add('rate_ask', 'Ask for a smaller share', 'He may say yes. He remembers being asked.');
      else if (w.debts.some((d) => d.status === 'active' && ((d.creditor === p.id && d.debtor === t.id) || (d.creditor === t.id && d.debtor === p.id)))) add('earn', 'Discuss what’s owed');
      const b = ownerBiz(w, t.id);
      if (b?.kind === 'garage' && !w.ventures.some((v) => v.open && v.ownerId === p.id) && p.cash >= 2000) add('partner_chop', 'Propose a chop shop partnership', '$2,000 up front; he gets 30%.'); // (V90: not offered without the money to put up)
      if (b?.kind === 'pawnshop') add('partner_fence', 'Ask if he would move some goods for you');
      if (b && b.protection?.collectorId === p.id) {
        add('terms_cut', "Offer to cut his protection fee 25%", 'Buys goodwill, costs money.');
        add('terms_raise', 'Tell him the fee is going up 25%');
      } else if (b && b.protection?.familyId !== p.familyId && t.rank === 'civilian' && !askBetween(w, 'protect', p.id, t.id, b.id)) add('suggest', 'Suggest he could use some friends', 'Opens the protection conversation.');
      if (t.rank !== 'civilian' && t.cash >= 1500 && (t.rels[p.id]?.trust ?? 0) >= 0.4) add('borrow', 'Ask to borrow money', 'You name the figure. He decides what he can spare, and on what terms.');
      if (b && t.rank === 'civilian' && p.cash >= 200 && !w.debts.some((d) => d.status === 'active' && d.debtor === t.id)) add('offer_loan', 'Offer him a loan', 'You name the amount and the weekly rate. He takes it if he needs it and the terms are fair.');
      // Stage 4: a business is bought and sold the way NPCs buy and sell (asks 'buy' and 'sell', econ.sellTo)
      if (b && b.open && b.kind !== 'casino' && b.ownerId === t.id && !askBetween(w, 'buy', p.id, t.id, b.id)) {
        add('buy_ask', 'Ask whether he would sell the place', 'You name a price. He answers from what it is worth and what trouble he is in.');
        if (stakeRoom(b) >= 0.25) add('stake_ask', 'Offer to buy a piece of it', 'A quarter of the place for money down: a share of what it makes every week.');
      }
      { const op = w.ops.find((o) => o.owner === t.id && o.kind !== 'hijack' && o.state === 'running' && o.runner !== p.id); if (op && !t.isPlayer && t.id !== p.id && !askBetween(w, 'run', p.id, t.id)) add('run_ask', `Offer to run his ${OPS[op.kind as keyof typeof OPS]?.label.toLowerCase() ?? 'operation'}`, 'You name your cut of the take. He weighs what he thinks of you and whether he has a man on it.'); }
      { const mine = Object.values(w.biz).find((x) => x.open && x.ownerId === p.id && x.kind !== 'casino'); if (mine && t.cash >= 1000 && !t.isPlayer && !askBetween(w, 'sell', p.id, t.id, mine.id)) add('sell_ask', `Offer him ${mine.name}`, 'You name a price. He weighs what it is worth to him and whether he has the money.'); }
      back();
      break;
    }
    case 'family': {
      add('pick_member', 'Ask about one of the others');
      add('leaders', 'Talk about the leadership');
      add('pick_concern', 'Tell him something about a man');
      add('promo', 'Talk about moving up');
      if (t.rank !== 'associate' && t.rank !== 'civilian') add('recommend', 'Ask him to put in a word for you');
      back();
      break;
    }
    case 'pick_member': {
      const mem = Object.values(w.chars).filter((x) => x.alive && x.id !== t.id && x.id !== p.id && x.familyId === t.familyId && t.rels[x.id]).sort((a, b) => (t.rels[b.id]?.trust ?? 0) + (t.rels[b.id]?.grudge ?? 0) - ((t.rels[a.id]?.trust ?? 0) + (t.rels[a.id]?.grudge ?? 0))).slice(0, 5);
      for (const x of mem) add('about:' + x.id, `Ask about ${x.name}`, `${x.rank}`);
      back();
      break;
    }
    case 'pick_concern': {
      const mem = Object.values(w.chars).filter((x) => x.alive && x.id !== t.id && x.id !== p.id && x.familyId === t.familyId && x.rank !== 'boss').sort((a, b) => (p.books.flags[b.id]?.amt ?? 0) - (p.books.flags[a.id]?.amt ?? 0) || (p.rels[b.id]?.grudge ?? 0) - (p.rels[a.id]?.grudge ?? 0)).slice(0, 5);
      for (const x of mem) add('concern:' + x.id, `Raise a concern about ${x.name}`, p.books.flags[x.id]?.amt ? `You have noticed ${money(Math.round(p.books.flags[x.id].amt))} missing.` : x.rank);
      back();
      break;
    }
    case 'disputes': {
      if (incidentsOf(w, t).length) add('pick_incident', 'Ask about a recent incident');
      if (grudgeTarget(w, t)) add('suspect', 'Ask who he suspects');
      const lie = Object.values(w.facts).find((f) => f.actor === t.id && p.known[f.id]?.knowsActor && !BORING.has(f.kind) && w.now - f.t < 40 * DAY && ['beating', 'vandalism', 'robbery', 'burglary', 'scam', 'theft', 'poach', 'shortfall'].includes(f.kind));
      if (lie) add('demand:' + lie.id, 'Demand an explanation', `About: ${clip(lie.text, 70)}`);
      const feud = Object.entries(t.rels).filter(([id, r]) => r.grudge >= 0.3 && id !== w.playerId && w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge)[0];
      if (feud) add('mediate', `Offer to mediate between him and ${w.chars[feud[0]].name}`, 'A sit-down. Both have to show up.');
      back();
      break;
    }
    case 'pick_incident': {
      // He brings subjects up the way a man does: the ones you already know of by what they were about, and everything else as one
      // open question. Nothing here names a record, a time or how he came to know it.
      const inc = incidentsOf(w, t);
      const first = (id?: string) => (id && w.chars[id] ? w.chars[id].name.split(' ')[0] : '');
      const topic = (f: Fact) => {
        const b = f.business ? w.biz[f.business] : undefined;
        const k = p.known[f.id];
        if (f.actor === p.id) return 'What have you heard about me?';
        if (b) return `What’s the story with ${b.name}?`;
        if (k?.knowsActor && f.actor && f.victim) return `What went on between ${first(f.actor)} and ${first(f.victim)}?`;
        if (f.victim && f.victim !== t.id) return `What happened to ${first(f.victim)}?`;
        return 'What’s that about?';
      };
      const seenTopic = new Set<string>();
      for (const { f } of inc.filter(({ f }) => p.known[f.id])) { const lab = topic(f); if (seenTopic.has(lab) || seenTopic.size >= 3) continue; seenTopic.add(lab); add('inc:' + f.id, lab); }
      const fresh = inc.find(({ f }) => !p.known[f.id]);
      if (fresh) add('inc:' + fresh.f.id, 'Anything else going round?');
      back();
      break;
    }
    case 'incident': {
      const f = w.facts[c.ctx.fact!];
      const k = t.known[f.id];
      const asked = c.ctx.asked;
      const pk = p.known[f.id];
      const inv = involvedIn(w, t, f);
      // He has denied it: nothing he knows is on the table. You can press him, or let it lie.
      if (c.ctx.denied) {
        add('press', 'Press him: people are saying it was you');
        add('drop', 'Let it drop');
        break;
      }
      if (k?.knowsActor && f.actor && f.actor !== p.id && !(pk?.knowsActor)) add('who', inv ? 'Ask who it was' : 'Ask who he’s heard it was');
      // V89: when it is between the two of you (you did it to him, or he to you), the bystander's questions make no sense
      const mineToHim = f.actor === p.id && f.victim === t.id, hisToMe = f.actor === t.id && f.victim === p.id;
      if (f.victim === t.id && f.amount && !mineToHim) add('how_much', 'What did it cost you?');
      if (inv && SCENE.has(f.kind)) add('witness', 'Who else was there?');
      if (!inv) add('source', 'Where did you hear it?');
      // What the player can ask depends on what has just been said and on who is saying it.
      const biz = f.business ? w.biz[f.business] : undefined;
      if (f.kind === 'protection_started' && biz) {
        if (f.actor === t.id) {
          add('p_how', 'How did you come by that arrangement?');
          add('p_claim', 'Does anyone else have a claim on it?');
          add('p_owner', 'How did the owner take it?');
        } else if (biz.ownerId === t.id) {
          add('p_how', 'How did it come about?');
          add('p_claim', 'Is anyone else leaning on you?');
        }
      } else if (f.actor === t.id && f.victim) add('why', 'Why did you do it?');
      if (f.actor === p.id) {
        if (!asked.includes('own')) add('own', 'Admit it was you', 'Better from you than from someone else.');
        if (!asked.includes('own') && !asked.includes('lie')) add('lie', 'Deny it', 'He may believe you. He may not.');
      }
      if (!k?.knowsActor && f.victim === t.id && f.actor !== p.id) add('find', "Tell him you’ll find out who did it");
      const actor = f.actor ? w.chars[f.actor] : undefined;
      if (actor?.alive && actor.id !== p.id && pk?.knowsActor && actor.id !== t.id && actor.familyId !== t.familyId && f.victim === t.id) add('speak', `Offer to speak with ${actor.familyId ? 'the ' + famName(w, actor) + ' family' : actor.name}`, 'You’re promising to act.');
      if (actor?.alive && actor.id !== p.id && pk?.knowsActor && actor.id !== t.id && f.victim === t.id) add('sitdown', 'Suggest arranging a sit-down', `With ${actor.name}.`);
      add('view', mineToHim ? 'Where does that leave us?' : hisToMe ? 'Are we square now?' : inv && f.victim === t.id ? 'What are you going to do about it?' : 'What do you make of it?');
      if (mineToHim && asked.includes('own')) add('n:amends', 'Offer to make it right', 'It will cost you something. He will remember that you came.');
      if (connected(w, t, p, f)) add('tell_more', 'Is there more to it?');
      if (!mineToHim && !hisToMe) add('involve', f.kind === 'ruling' && !f.actor ? 'Does this touch us?' : f.actor === t.id ? 'Will it get you trouble?' : f.actor && f.victim ? 'Will anyone do something about it?' : 'Does anyone know what’s behind it?');
      add('pick_incident', 'Ask about something else he’s heard');
      // Three directions to begin with: learn more, how he sees it, and what can be done. Everything else sits one step down.
      const LEARN = ['who', 'how_much', 'witness', 'source', 'tell_more', 'involve', 'pick_incident', 'p_how', 'p_claim', 'p_owner', 'why'];
      const ACT = ['speak', 'sitdown', 'find', 'own', 'lie'];
      const mine = f.actor === p.id;
      // A man who only heard about it cannot tell you what can be done: that is for the people it happened to.
      const all = o.splice(0).filter((x) => x.code !== 'root' && !(x.code === 'view' && f.actor === t.id));
      const whoKnows = !inv ? all.filter((x) => x.code === 'source') : [];
      const SPEC = ['p_how', 'p_claim', 'p_owner', 'why'];
      const spec = all.filter((x) => SPEC.includes(x.code));
      const learn = all.filter((x) => LEARN.includes(x.code.split(':')[0]) && !whoKnows.includes(x) && !spec.includes(x));
      const act = all.filter((x) => ACT.includes(x.code.split(':')[0]) && !(mine && ['own', 'lie'].includes(x.code)));
      const urgent = all.filter((x) => (mine && ['own', 'lie'].includes(x.code)) || x.code === 'n:amends');
      const view = all.filter((x) => x.code === 'view');
      // (V90: no menus inside the conversation. What can be done is a question he answers, and then those things are what you can
      // say; otherwise the questions themselves are on screen, the ones that follow from what he has just said first)
      if (c.ctx.sub === 'act' && act.length) { o.push(...act); back(); break; }
      c.ctx.sub = undefined;
      o.push(...urgent, ...spec, ...learn.filter((x) => x.code !== 'pick_incident').slice(0, 3), ...whoKnows.map((x) => ({ ...x, label: 'Who would know?', hint: undefined })), ...view);
      if (act.length) add('sub:act', 'What can be done about it?');
      if (learn.some((x) => x.code === 'pick_incident')) add('pick_incident', 'Ask about something else he’s heard');
      back();
      break;
    }
    case 'follow': {
      for (const f of c.ctx.follow ?? []) o.push({ code: f.code, label: f.label, hint: f.hint, big: f.big });
      back();
      break;
    }
    case 'subject': {
      const s = w.chars[c.ctx.subject!];
      const theirs = Object.values(w.facts).find((f) => f.actor === s.id && p.known[f.id]?.knowsActor && !t.known[f.id]?.knowsActor && !BORING.has(f.kind));
      if (theirs) add('tell:' + theirs.id, `Tell him what you know about ${s.name}`, clip(theirs.text, 70));
      const exon = Object.values(w.facts).find((f) => f.actor && f.actor !== s.id && p.known[f.id]?.knowsActor && f.victim === t.id && t.rels[s.id]?.grudge >= 0.3);
      if (exon) add('exon:' + exon.id, `Tell him it wasn’t ${s.name}`, 'You know who it was.');
      if (!c.ctx.asked.includes('handle') && s.rank !== 'boss' && s.rank !== 'underboss' && s.familyId !== p.familyId) add('handle', `Offer to deal with ${s.name}`);
      if (!c.ctx.asked.includes('mediate')) add('mediate2', `Offer to mediate`);
      back();
      break;
    }
    case 'amends': {
      const mine = Object.values(w.facts).filter((f) => f.actor === p.id && f.victim === t.id && !BORING.has(f.kind) && t.known[f.id]?.knowsActor && w.now - f.t < 90 * DAY).sort((a, b) => b.t - a.t)[0];
      const his = Object.values(w.facts).find((f) => f.actor === t.id && f.victim === p.id && !BORING.has(f.kind) && w.now - f.t < 120 * DAY);
      if (mine) {
        if (!c.ctx.asked.includes('a_own')) add('a_own:' + mine.id, 'Own up and say you were wrong', clip(mine.text, 70));
        if (his && !c.ctx.asked.includes('a_start')) add('a_start:' + mine.id, 'Remind him what he did first', clip(his.text, 70));
        if (!c.ctx.asked.includes('a_pay')) add('a_pay:' + mine.id, `Make it right with ${money(Math.max(200, Math.round((mine.amount ?? 0) * 1.2)))}`, 'Money talks, quietly.');
        if (!c.ctx.asked.includes('a_defy')) add('a_defy:' + mine.id, 'Tell him you would do it again', 'He won’t forgive that.');
      } else {
        if (!c.ctx.asked.includes('a_ask')) add('a_ask', 'Ask what he has got against you', 'He may have the wrong idea.');
        if (!c.ctx.asked.includes('a_gift')) add('a_gift', 'Buy him a drink and let it lie ($60)');
      }
      back();
      break;
    }
    case 'shop': {
      const b = ownerBiz(w, t.id);
      if (b?.protection?.collectorId !== p.id) { back(); break; }
      const a = c.ctx.asked;
      if (lateOf(b) > 0) {
        if (!a.includes('sh_why')) add('sh_why', 'Ask why it’s late');
        add('sh_time', 'Give him time', 'He’ll owe you for it.');
        add('sh_lean', 'Remind him it isn’t optional', 'He pays. He remembers.');
      } else {
        if (!a.includes('sh_how')) add('sh_how', 'Ask how the shop is doing');
        if (!a.includes('sh_ears')) add('sh_ears', 'Ask whether anyone else has been around');
        if (b.distress > 0 && !a.includes('sh_back')) add('sh_back', `Hand back this week's ${money(b.protection.fee)}`, 'It buys loyalty you can’t buy otherwise.');
      }
      back();
      break;
    }
    case 'crew': {
      const a = c.ctx.asked;
      if (t.problem && !t.problem.revealed && !a.includes('cr_ask')) add('cr_ask', 'Ask if something is wrong');
      if (t.problem?.revealed) {
        add('cr_cash', 'Put $400 in his hand', `About ${PROBLEM_LABEL[t.problem.kind]}.`);
        add('cr_duties', 'Lighten his duties for a while');
      }
      const hh = t.books.history.map((x) => x.paid);
      const fell = hh.length >= 4 && avgOf(hh.slice(-6, -3)) >= 40 && avgOf(hh.slice(-3)) < avgOf(hh.slice(-6, -3)) * 0.65;
      if (!a.includes('cr_drop') && (fell || t.books.arrears > 0 || t.books.missed >= 2)) add('cr_drop', 'Ask why his envelope has been light', `${money(avgOf(hh.slice(-3)))} a week lately.`);
      if (a.includes('cr_drop') && !a.includes('cr_look')) add('cr_look', 'Say you’ll look into it yourself', 'Takes a couple of hours and a few questions around his patch.');
      if (!a.includes('cr_money')) add('cr_money', 'Ask how he’s fixed for money');
      if (t.problem || (r0(t, p) < 0.4)) add('cr_thin', 'Tell him he’s on thin ice', 'Not a kindness.');
      back();
      break;
    }
    case 'rival': {
      const a = c.ctx.asked;
      const tn = w.fam[p.familyId!]?.tension[t.familyId!] ?? 0;
      if (!a.includes('rv_ears')) add('rv_ears', 'Trade a little gossip', 'What’s said in a bar stays in a bar. Mostly.');
      if (!a.includes('rv_drink')) add('rv_drink', 'Stand him a drink ($30)', 'Courtesy costs little.');
      if (!a.includes('rv_mood')) add('rv_mood', `Ask how things are between ${famName(w, p)} and ${famName(w, t)}`);
      if (!a.includes('rv_favour') && r0(t, p) > 0.45) add('rv_favour', 'Offer a favour across the line', 'It builds a bridge. It may also be noticed.');
      if (!a.includes('rv_warn')) add('rv_warn', 'Tell him to keep off our ground', tn > 2 ? 'The air is already thick.' : 'It raises the temperature.');
      back();
      break;
    }
    case 'debt': {
      const a = c.ctx.asked;
      const dts = w.debts.filter((d) => d.status === 'active' && ((d.creditor === p.id && d.debtor === t.id) || (d.creditor === t.id && d.debtor === p.id)));
      const owed = dts.find((d) => d.creditor === p.id);
      const owe = dts.find((d) => d.creditor === t.id);
      if (owed) {
        if (!a.includes('d_remind') && (owed.missed > 0 || owed.nextDue - w.now <= DAY)) add('d_remind', 'Remind him what he owes', `${money(owed.balance)}${owed.missed ? `, ${owed.missed} payment${owed.missed > 1 ? 's' : ''} missed` : ''}.`);
        if (owed.missed && !a.includes('d_time')) add('d_time', 'Give him more time', 'Forgives one missed payment. He’ll remember it.');
        if (!a.includes('d_half')) add('d_half', 'Halve his weekly payment', 'It takes longer. He survives it.');
        if (!a.includes('d_favour') && owed.balance >= 300) add('d_favour', 'Write off $300 for a favour', 'He’ll owe you one, and you can’t choose when.');
        if (!a.includes('d_forgive')) add('d_forgive', 'Forgive a quarter of it', 'Goodwill, or weakness. Depends who’s watching.');
      }
      if (owe) {
        if (!a.includes('d_pay') && p.cash >= owe.weeklyPayment) add('d_pay', `Pay ${money(owe.weeklyPayment)} now`, 'On time, and he notices.');
        if (!a.includes('d_all') && p.cash >= owe.balance) add('d_all', `Settle it: ${money(owe.balance)}`, 'It clears the debt, and what he thinks of you.');
        if (!a.includes('d_ask')) add('d_ask', 'Ask for more time', 'He may say no.');
      }
      back();
      break;
    }
    case 'myboss': {
      const a = c.ctx.asked;
      { const due = envelopeDue(w, p); if (kickWindow(w, p) && !crewEnvelopesWaiting(w, p) && due >= 20 && !a.includes('b_envelope') && p.cash >= 20) add('b_envelope', `Hand him your envelope (about ${money(due)})`, envelopeText(w, p)); }
      if (a.includes('b_envelope') && !a.includes('b_extra') && p.cash >= 250) add('b_extra', 'Add $250 for him personally', 'Over and above what’s owed. It counts.');
      if (a.includes('b_envelope') && !a.includes('b_extra2') && p.cash >= 1000) add('b_extra2', 'Add $1,000 for him personally', 'A real gesture. He’ll owe you one.');
      if (!a.includes('b_stand')) add('b_stand', 'Ask where you stand', 'He’ll tell you what he thinks, in his way.');
      if (!a.includes('b_need')) add('b_need', 'Ask what he needs done', 'It could be anything.');
      if (!a.includes('b_tribute') && p.cash >= 300) add('b_tribute', 'Bring him $300 for nothing in particular', 'A gesture. Men remember them.');
      if (!a.includes('b_more') && p.rank !== 'boss') add('b_more', 'Ask for a bigger piece', 'More ground and more risk.');
      back();
      break;
    }
    case 'orders': {
      add('work', 'Ask if there’s work');
      if (t.bossId === p.id) {
        add('assign_low', 'Tell him to keep his head down', 'Heat drops. He earns less.');
        add('assign_hustle', 'Tell him to find some extra income', 'It will show up in the books, and in the heat.');
      }
      const rep = w.jobs.filter((j) => j.status === 'done' && j.giver === t.id && j.assignee === p.id && !j.reported);
      if (rep.length) add('report', 'Report on the work you did', `${rep.length} job${rep.length > 1 ? 's' : ''} to report`);
      for (const j of w.jobs.filter((q) => q.status === 'active' && q.giver === t.id && q.assignee === p.id && (q.via === 'boss' || q.via === 'tip')).slice(0, 2)) {
        add('challenge:' + j.id, `Ask why: "${j.title}"`, 'Is it what he says it is?');
        add('refuse:' + j.id, `Refuse: "${j.title}"`, 'He won’t like it.');
      }
      back();
      break;
    }
    case 'memos': {
      // (V90: each said as you would raise it; what it is, and when it falls due, in the hint)
      const raise: Record<string, string> = { promise: 'About what I promised you', agreement: 'About what we agreed', threat: 'About what I said to you before', question: 'About what you asked me to find out', favour: 'About the favour' };
      for (const m of t.memos.filter((q) => q.other === p.id && !q.done)) add('memo:' + m.id, raise[m.kind] ?? 'About what’s between us', `${m.text}${m.due ? ` (${dueWords(w.now, m.due)})` : ''}`);
      for (const m of t.memos.filter((q) => q.other === p.id && !q.done && q.kind === 'question' && q.ref && p.known[q.ref]?.knowsActor)) add('answer:' + m.id, `Tell him what you found out`, clip(w.facts[m.ref!].text, 60));
      back();
      break;
    }
  }
  return o;
}

// ------------------------------------------------------------------- say

const NODES = ['personal', 'business', 'family', 'disputes', 'orders', 'memos', 'amends', 'shop', 'crew', 'debt', 'myboss', 'rival'];

// Whatever you say or do about a running matter goes on its record, so the story can show where it stands.
function storyKeyFor(w: World, p: Character, t: Character, node: string): string | undefined {
  if (node === 'crew') return 'man:' + t.id;
  if (node === 'debt') { const d = w.debts.find((x) => x.status === 'active' && ((x.creditor === p.id && x.debtor === t.id) || (x.creditor === t.id && x.debtor === p.id))); return d ? 'debt:' + d.id : undefined; }
  if (node === 'myboss') { const r = readiness(w, p); return r ? 'seat:' + r.to : undefined; }
  if (node === 'amends' || node === 'disputes') return (rel(t, p.id).grudge >= 0.3 || rel(p, t.id).grudge >= 0.3) ? 'threat:' + t.id : undefined;
  return undefined;
}
// when a promise falls due, in words
const dueWords = (now: number, due: number) => { const d = Math.floor(due / 1440) - Math.floor(now / 1440); return d < 0 ? 'overdue' : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : d < 7 ? `due in ${d} days` : 'due next week or after'; };
// V90: he has a say in the conversation too. Whatever was said, he answers it (sayOne); then he decides whether he wants to go on:
// each man has only so much patience for a conversation (his temperament, how he sees you), pressure and going over the same ground
// use it up, and when it runs low he turns cold (no more small talk) or ends it. A man with something of his own to raise breaks in.
export function say(w: World, p: Character, t: Character, c: Convo, code: string): Said {
  // a subject he won't discuss with you: he says so, and the more you push it the shorter he gets
  if (code.startsWith('f:') && ['think', 'put', 'talk'].includes(code.slice(2)) && openness(w, t, p) === 'hostile') {
    const n = (c.ctx.raised ?? []).filter((x) => x === 'refuse').length, tp = temper(t);
    const l = n === 0 ? (tp.volatility > 0.55 ? '“I’ve got nothing to say to you.”' : '“I’d rather not.”') : n === 1 ? '“I said no.”' : '“Are you deaf?”';
    return govern(w, p, t, c, 'refused', { lines: [l], minutes: 2, convo: { ...c, ctx: { ...c.ctx, raised: [...(c.ctx.raised ?? []), 'refuse'], cold: n >= 1 || c.ctx.cold } } });
  }
  return govern(w, p, t, c, code, sayOne(w, p, t, c, code));
}
const PUSHY = /^(mv:[^:]+:(pressure|force|leverage|senior)|x:[^:]+:(assume|nochoice|notthere|now)|demand|sh_lean|terms_raise|cr_thin|rv_warn|challenge|refused|deal:hold|a_defy)$/;
function govern(w: World, p: Character, t: Character, c: Convo, code: string, r: Said): Said {
  if (!r.convo) return r;
  const keep = { patience: c.ctx.patience, cold: c.ctx.cold || r.convo.ctx.cold, shut: c.ctx.shut || r.convo.ctx.shut, raised: [...new Set([...(c.ctx.raised ?? []), ...(r.convo.ctx.raised ?? [])])] };
  if (isNavCode(code) && !code.startsWith('f:')) return { ...r, convo: { ...r.convo, ctx: { ...r.convo.ctx, ...keep } } }; // (moving about costs him nothing)
  const tp = temper(t), v = viewOf(w, t, p);
  const start = c.ctx.patience ?? clamp(3.5 + tp.agreeable * 2 + v.trust * 2 + v.affection * 1.5 + v.fear * 1.5 - tp.volatility - v.resent * 2.5, 1.5, 9);
  const already = r.lines.some((l) => /already|nothing more to say|heard it before|We’ve been over this|You keep saying/.test(l));
  // (pressure and going over the same ground wear on a man; ordinary talk barely does, and opening a subject not at all)
  const cost = (PUSHY.test(code) ? 1.1 + tp.pride * 0.7 + tp.volatility * 0.7 + (/:force$/.test(code) ? 1.5 : 0) : code.startsWith('f:') ? 0 : 0.12) + (already ? 0.6 : 0);
  const left = start - cost;
  // (what he feels about this conversation outlasts whatever the last answer did to the conversation's own bookkeeping)
  const ctx = { ...r.convo.ctx, ...keep, patience: left };
  // angry with you over something in hand, or worn thin: no more small talk
  const angry = openMatters(w).some((s) => s.terms?.by === p.id && s.terms?.of === t.id && (s.st?.[t.id]?.anger ?? 0) > 0.45);
  if ((angry || left < 1) && !ctx.cold) {
    ctx.cold = true;
    // (how he shows he is done with you follows from what you have just done to him: after a threat, fear or anger, not impatience)
    if (left > 0 && !ctx.raised.includes('cold')) { ctx.raised.push('cold'); r.lines.push(PUSHY.test(code) ? (v.fear > 0.45 || tp.caution > 0.6 ? 'He says nothing. He is waiting for you to go.' : tp.volatility > 0.55 ? '“You’ve said your piece. Now go.”' : 'He has stopped looking at you.') : tp.agreeable > 0.55 ? '“Is there anything else? I have things to do.”' : tp.volatility > 0.55 ? '“Are we done here?”' : 'He has stopped looking at you.'); }
  }
  if (left <= 0) {
    // a frightened man doesn't throw you out; he goes quiet and waits for you to leave
    if (v.fear > 0.55) { r.lines.push('He says nothing more. He is waiting for you to go.'); return { ...r, convo: { ...r.convo, ctx: { ...ctx, shut: true } } }; }
    r.lines.push(tp.volatility + tp.pride > 1.15 ? '“That’s enough. Get out.”' : tp.agreeable > 0.55 ? '“I think we’ve said all there is to say today.”' : '“We’re finished. Good day.”');
    if (tp.volatility > 0.5 || v.resent > 0.3) p.cooldown[`shut:${t.id}`] = w.now + DAY;
    return { ...r, convo: null };
  }
  // he breaks in with what he came to say, once, if you haven't got to it
  const his = asksOf(w, t)[0];
  if (his && !(ctx.raised ?? []).includes(his.id) && ctx.focus !== 'enc:' + his.id && !code.startsWith('enc:')) {
    r.lines.push(tp.agreeable > 0.55 ? 'Before you can go on, he raises something of his own.' : 'He cuts across you.', his.lines.at(-1) ?? '');
    ctx.focus = 'enc:' + his.id; ctx.raised = [...(ctx.raised ?? []), his.id];
    return { ...r, convo: { ...r.convo, node: 'root', ctx } };
  }
  return { ...r, convo: { ...r.convo, ctx } };
}
function sayOne(w: World, p: Character, t: Character, c: Convo, code: string): Said {
  const node = c.node;
  // Something already said or done in this conversation cannot be said again for another reward: it changes nothing until you come back.
  if (!isNavCode(code) && (c.used ?? []).includes(usedKey(c, code))) return { lines: ['You’ve already been over that.'], minutes: 0, convo: c };
  // He remembers what you have already asked him about. If nothing has changed he says so, and it pays nothing.
  const day0 = Math.floor(w.now / 1440), base0 = code.split(':')[0], pol = POLICY[base0], tkey = topicKey(code);
  if (pol) {
    const mem = t.talk?.[tkey], arg0 = code.includes(':') ? code.slice(code.indexOf(':') + 1) : '';
    if (mem && mem.sig === pol.sig(w, p, t, arg0) && day0 - mem.d <= pol.window) {
      mem.n++;
      const ls = [vsay(w, t, p, pol.kind === 'round' ? 'round_enough' : mem.d === day0 ? 'already' : 'nochange')];
      if (mem.n >= 4 && !pol.kind && base0 !== 'old_times') { const q = rel(t, p.id); feelOn(w, q, 'trust', -0.01); ls.push(vsay(w, t, p, 'chat_brush')); } // he is tired of being asked
      const lt = lighten(t, !!c.named, ls);
      return { lines: lt.lines, minutes: 2, convo: { ...c, named: lt.named, used: [...(c.used ?? []), usedKey(c, code)] } };
    }
  }
  // V89 paths (subjects, matters, asks) keep the conversation's rules: something already said or done in this conversation gives
  // nothing more, and he never says the same line twice
  const already = () => { const l = vsay(w, t, p, 'already'); return (c.spoken ?? []).includes(l) ? 'He has nothing more to say on it.' : l; };
  if (/^(tk|mt|mv):/.test(code) && (c.used ?? []).includes(usedKey(c, code))) { const l = already(); return { lines: [l], minutes: 2, convo: { ...c, spoken: [...(c.spoken ?? []), l].slice(-60) } }; }
  const fresh = (r: Said): Said => {
    const prev = new Set(c.spoken ?? []);
    const kept = r.lines.filter((l) => l.length <= 30 || !prev.has(l));
    const lines = kept.some((l) => answered(l)) ? kept : [...kept, already()]; // (his answer is never lost to the no-repeats rule: if all he had was said before, he says so)
    return { ...r, lines, convo: r.convo ? { ...r.convo, spoken: [...(c.spoken ?? []), ...lines.filter((l) => l.length > 30)].slice(-60) } : r.convo };
  };
  if (code.startsWith('apx:')) { // Stage 5C: how you take a man who has come to you with something
    const [, how, id] = code.split(':');
    const e = asksOf(w, t).find((x) => x.id === id);
    const tp = temper(t), hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1;
    if (!e) return fresh({ lines: ['He lets it go.'], minutes: 2, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: undefined } } });
    if (how === 'what') return fresh({ lines: [askLead(e)], minutes: 2, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: 'apx:' + id, asked: [...c.ctx.asked, code] } } });
    if (how === 'wait') { e.expires = Math.max(e.expires, w.now + 2 * DAY); feel(w, t, p.id, 'trust', -0.01); return fresh({ lines: [hot ? '“It won’t keep for ever.”' : soft ? '“Of course. When you have a minute.”' : '“All right. Don’t make me wait long.”'], minutes: 2, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: undefined, asked: [...c.ctx.asked, code] } } }); }
    feel(w, t, p.id, 'respect', -0.02); feel(w, t, p.id, 'trust', -0.02);
    return fresh({ lines: [hot ? '“Fine. Remember you said that.”' : soft ? '“I understand. Another time.”' : '“Right.”'], minutes: 2, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: undefined, asked: [...c.ctx.asked, code] } } });
  }
  if (code.startsWith('f:')) { // V90: opening a subject (or going back to the rest of the conversation) is said, and answered
    const focus = code.slice(2) || undefined;
    const said = focus ? openSubject(w, p, t, c, focus) : [];
    // (the first line is yours, said as you open it; the rest is his answer)
    const q = said[0]?.replace(/^“|”$/g, ''), lines = said.slice(1).map((l) => speechFor(w, p, t, l));
    const r = fresh({ lines, minutes: focus ? 2 : 0, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus, follow: undefined } } });
    if (!lines.length) r.lines = []; // (going back says nothing; it is not an answer to be "already" given)
    return { ...r, q };
  }
  if (code === 'biz_none') { // "How's business?" asked of a man with no trade or racket of his own
    const tp = temper(t);
    const l = t.rank === 'civilian' ? (tp.agreeable > 0.55 ? '“Business? I work for other people. It pays the rent, mostly.”' : '“What business? I get by.”')
      : tp.caution > 0.6 ? '“I do what I’m asked. The less said, the better.”' : tp.pride > 0.62 ? '“Better than some people think.”' : '“I keep busy. You know how it is.”';
    return fresh({ lines: [l], minutes: 10, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: 'talk' }, used: [...(c.used ?? []), usedKey(c, code)] } });
  }
  if (code.startsWith('tk:')) { // V89: a subject on his mind (talk.ts), raised or followed up
    const b = talkAbout(w, p, t, code);
    if (b) {
      const used = [...(c.used ?? []), usedKey(c, code.split(':').slice(0, code.startsWith('tk:op:') || code.startsWith('tk:kin:') || code.startsWith('tk:tell:') ? 3 : 2).join(':')), usedKey(c, code)];
      const lines = ack(w, t, p, b.lines.map((l) => speechFor(w, p, t, l)), code.endsWith(':end'));
      if (b.go?.node === 'subject' && b.go.subject) return fresh({ lines, minutes: b.minutes ?? 15, convo: { ...c, node: 'subject', ctx: { ...c.ctx, subject: b.go.subject }, used } });
      if (b.choices.length) return fresh({ lines, minutes: b.minutes ?? 15, convo: { ...c, node: 'follow', ctx: { ...c.ctx, follow: b.choices.map((x) => ({ code: x.code, label: x.label, hint: x.hint, big: x.big })) }, used } });
      return fresh({ lines: lines.length ? lines : ack(w, t, p, ['You leave it there.'], true), minutes: b.minutes ?? 10, convo: { ...c, node: 'root', used } });
    }
  }
  if (code.startsWith('mt:')) { // V89: a matter he is in or knows of (matters.ts), raised in his own terms
    const [, sid, mc] = code.split(':');
    const r = matterAct(w, p, sid, mc, t.id);
    return fresh({ lines: r.lines.map((l) => speechFor(w, p, t, l)), minutes: r.minutes, convo: { ...c, node: 'root', used: [...(c.used ?? []), usedKey(c, code)] } });
  }
  if (code.startsWith('favcall:')) { // V89: calling in a favour he owes you (asks.ts 'favour')
    const f = w.favours.find((x) => x.id === code.slice(8) && !x.settled && x.from === p.id && x.to === t.id);
    const s = f ? callFavour(w, p, t, f, 'money', 150 * Math.max(1, f.size)) : undefined;
    if (!f || !s) return { lines: ['“We’ve been over that.”'], minutes: 3, convo: { ...c, node: 'root' } };
    const r = playerMove(w, p, s.id, 'ask');
    return { lines: [`You remind ${t.name.split(' ')[0]} of the favour he owes you.`, ...r.lines].map((l) => speechFor(w, p, t, l)), minutes: r.minutes, convo: { ...c, node: 'root', used: [...(c.used ?? []), usedKey(c, code)] } };
  }
  if (code.startsWith('jobtake:') || code.startsWith('jobpass:')) { // V90: answering, to his face, the work he offered
    const j = w.jobs.find((x) => x.id === code.slice(8) && x.status === 'offered');
    if (!j) return { lines: ['“That’s been dealt with.”'], minutes: 2, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: undefined } } };
    const take = code.startsWith('jobtake:'), tp = temper(t);
    if (take) takeJob(w, j); else declineJob(w, j);
    const l = take ? (tp.agreeable > 0.55 ? '“Good. I knew I could count on you.”' : '“Good. Don’t make a mess of it.”') : (tp.pride > 0.6 ? '“Fine. I’ll remember you were too busy.”' : '“All right. Somebody else, then.”');
    return fresh({ lines: [l], minutes: 5, convo: { ...c, node: 'root', ctx: { ...c.ctx, focus: undefined }, used: [...(c.used ?? []), usedKey(c, code)] } });
  }
  if (code.startsWith('x:')) { // V90: an answer to the point he has just made in a matter (exchange.ts)
    const [, sid, k] = code.split(':');
    const s = openMatters(w).find((x) => x.id === sid && x.terms?.by === p.id);
    if (!s) return { lines: ['“That’s settled.”'], minutes: 2, convo: { ...c, node: 'root' } };
    const lines = exReply(w, p, s, k).map((l) => speechFor(w, p, t, l));
    return fresh({ lines: lines.length ? lines : [vsay(w, t, p, 'already')], minutes: 15, convo: { ...c, node: 'root', used: [...(c.used ?? []), usedKey(c, code)] } });
  }
  if (code.startsWith('nm:')) { // a figure he has named: nm:<matter>:<amount>[:<weekly rate>]
    const [, sid, amt, rate] = code.split(':');
    const r = nameFigure(w, p, sid, Number(amt), rate !== undefined ? Number(rate) : undefined);
    return fresh({ lines: ack(w, t, p, r.lines.map((l) => speechFor(w, p, t, l))), minutes: r.minutes, convo: { ...c, node: 'root' } });
  }
  if (code.startsWith('mv:')) {
    const [, sid, mv] = code.split(':');
    const r = playerMove(w, p, sid, mv as AskMove);
    return fresh({ lines: ack(w, t, p, r.lines.map((l) => speechFor(w, p, t, l))), minutes: r.minutes, convo: { ...c, node: 'root', used: [...(c.used ?? []), usedKey(c, code)] } });
  }
  const opt = options(w, p, t, c).find((o) => o.code === code);
  const snap = () => { const q = rel(t, p.id), m = rel(p, t.id); return { tr: q.trust, af: q.affection, rs: q.respect, gr: q.grudge, cash: p.cash, st: p.standing, ht: p.heat, tc: t.cash }; };
  const before = snap();
  const social = ['how', 'old_times', 'drink', 'op'].includes(code);
  if (social) {
    // Two exchanges a day carry their full weight, and about six a week; past that it is the same ground gone over again.
    const k = `soc:${t.id}`, kw = `socw:${t.id}`;
    const day = Math.floor(w.now / 1440), wk = Math.floor(day / 7);
    const m = (p.cooldown[k] ?? 0); const same = Math.floor(m / 10) === day ? m % 10 : 0; p.cooldown[k] = day * 10 + same + 1;
    const mw = (p.cooldown[kw] ?? 0); const sameW = Math.floor(mw / 100) === wk ? mw % 100 : 0; p.cooldown[kw] = wk * 100 + Math.min(99, sameW + 1);
    (c.ctx as { dull?: boolean; dullWhy?: string }).dull = same >= 2 || sameW >= 6;
    (c.ctx as { dullWhy?: string }).dullWhy = same >= 2 ? 'day' : 'week';
  }
  const before0 = new Set(openMatters(w).filter((x) => x.terms?.by === p.id && x.terms?.of === t.id).map((x) => x.id));
  const r = sayRaw(w, p, t, c, code);
  r.lines = r.lines.map((l) => speechFor(w, p, t, l));
  // V90: the conversation goes on from where the answer leaves it. A proposal that has become a matter between you is now the
  // subject in hand; one of the everyday questions leads on to ordinary talk; anything else stays on the subject it was part of.
  // (an everyday question that leads on to a follow-up keeps ordinary talk as the place to come back to)
  if (r.convo && r.convo.node !== 'root' && !LEGACY.includes(r.convo.node) && TALKQ.has(code.split(':')[0])) r.convo.ctx = { ...r.convo.ctx, focus: 'talk' };
  if (r.convo && (r.convo.node === 'root' || LEGACY.includes(r.convo.node))) {
    const opened = openMatters(w).find((x) => x.terms?.by === p.id && x.terms?.of === t.id && !before0.has(x.id));
    if (opened) r.convo.ctx = { ...r.convo.ctx, focus: 'm:' + opened.id };
    else if (TALKQ.has(code.split(':')[0])) r.convo.ctx = { ...r.convo.ctx, focus: 'talk' };
    else if (c.ctx.focus && r.convo.ctx.focus === undefined && r.convo.ctx === c.ctx) r.convo.ctx = { ...r.convo.ctx, focus: c.ctx.focus };
  }
  { const lt = lighten(t, !!c.named, r.lines); r.lines = lt.lines; if (r.convo) r.convo.named = lt.named; }
  // V90: what this says about the kind of man you are, counted in context (temper.ts): money given away for nothing is generosity,
  // a debt eased is forgiveness, a boss's order refused is defiance. (Counted only when it happened: the money moved, the order stood.)
  { const k = code.split(':')[0];
    if (['help_gift', 'sit_cover', 'cr_cash', 'a_gift'].includes(k) && p.cash < before.cash) noteConduct(p, 'generous');
    else if (['d_forgive', 'd_favour', 'd_half'].includes(k)) noteConduct(p, 'forgave', k === 'd_half' ? 0.5 : 1);
    else if (['refuse', 'challenge'].includes(k) && rk0(t) > rk0(p)) noteConduct(p, 'defied');
    else if (['terms_cut'].includes(k)) noteConduct(p, 'deals'); }
  if (!isNavCode(code) && r.convo) r.lines = ack(w, t, p, r.lines, false, ['how', 'old_times', 'drink', 'rv_drink', 'welcome', 'congrats', 'chat'].includes(code.split(':')[0]));
  // A spoken line stands on its own: no script-style speaker label in front of it.
  r.lines = r.lines.map((l) => l.replace(new RegExp(`^(?:${rx(t.name)}|${rx(t.name.split(' ')[0])}): (?=[“"])`), ''));
  if (pol && r.lines.length && !r.skipMemory) {
    const m = (t.talk ??= {});
    m[tkey] = { d: day0, sig: pol.sig(w, p, t, code.includes(':') ? code.slice(code.indexOf(':') + 1) : ''), n: 1 };
    const keys = Object.keys(m);
    if (keys.length > 18) delete m[keys.sort((x, y) => m[x].d - m[y].d)[0]];
  }
  if (social && (c.ctx as { dull?: boolean }).dull) {
    const q = rel(t, p.id);
    feelToOn(q, 'trust', before.tr + (q.trust - before.tr) * 0.2); feelToOn(q, 'affection', before.af + (q.affection - before.af) * 0.2); feelToOn(q, 'respect', before.rs + (q.respect - before.rs) * 0.2);
    r.lines.push((c.ctx as { dullWhy?: string }).dullWhy === 'week' ? 'You’ve been over this ground all week. He has nothing new to give you, and he knows you know it.' : 'You’ve covered this ground today. It doesn’t land the way it did.');
  }
  // Friendly talk alone has a ceiling: past "knows you well" trust comes from what you do for people, not how often you drink with them.
  if (social) {
    const q = rel(t, p.id); let capped = false;
    if (q.trust > 0.6 && q.trust > before.tr) { feelToOn(q, 'trust', Math.max(before.tr, 0.6)); capped = true; }
    if (q.affection > 0.8 && q.affection > before.af) { feelToOn(q, 'affection', Math.max(before.af, 0.8)); capped = true; }
    if (capped && before.tr >= 0.55) r.lines.push('There’s a point past which talk doesn’t move a man. The rest has to be earned.');
  }
  // The old submenus are only ever entered through the opening screen now, so whatever an action leaves behind, the conversation goes on
  // from the opening screen (with what has changed), never from a one-purpose submenu.
  if (r.convo && LEGACY.includes(r.convo.node) && introduced(w, p, t)) r.convo = { ...r.convo, node: 'root' };
  const nav = code === 'root' || code.startsWith('n:') || code.startsWith('sub') || ['pick_member', 'pick_concern', 'pick_incident'].includes(code);
  // V77: now and then he mentions something that actually happened between you (see memory.ts), before he answers.
  if (!nav && c.node !== 'incident' && !c.ctx.focus && !/^(enc|x|mv|mt|favcall|confront):/.test(code) && r.lines.length && !(c.ctx as { dull?: boolean }).dull) { const m = recall(w, p, t); if (m) r.lines.unshift(m.line); } // (not in the middle of a matter: he answers what was asked)
  if (code !== 'root' && !code.startsWith('n:') && !code.startsWith('sub') && r.lines.length) {
    const a = snap(), bits: string[] = [];
    const arrow = (d: number, name: string, good = true) => { if (Math.abs(d) < 0.004) return; const big = Math.abs(d) >= 0.08; bits.push(`${name} ${d > 0 ? (big ? '▲▲' : '▲') : (big ? '▼▼' : '▼')}`); void good; };
    arrow(a.tr - before.tr, 'Trust'); arrow(a.af - before.af, 'Warmth'); arrow(a.rs - before.rs, 'Respect'); arrow(-(a.gr - before.gr), 'Goodwill');
    if (a.cash !== before.cash) bits.push(`${a.cash > before.cash ? '+' : '−'}${money(Math.abs(a.cash - before.cash))}`);
    if (a.st !== before.st) bits.push(`Standing ${a.st > before.st ? '▲' : '▼'}`);
    if (a.ht !== before.ht) bits.push(`Heat ${a.ht > before.ht ? '▲' : '▼'}`);
    if (bits.length) r.lines.push(`⟡ ${bits.join('  ·  ')}`);
  }
  if (opt?.story && !['cr_cash', 'cr_duties'].includes(code.split(':')[0])) {
    if (node === 'amends' || node === 'disputes') touchDispute(w, p, t, `${p.name} spoke to ${t.name}: “${opt.label}”.`);
    const key = storyKeyFor(w, p, t, node);
    if (key) addFact(w, { kind: 'favour', actor: p.id, victim: t.id, story: key, minor: true, text: `${p.name} spoke to ${t.name}: “${opt.label}”.`, district: t.district }, { witnesses: [p.id, t.id] });
  }
  if (r.convo) r.convo.used = isNavCode(code) ? c.used : [...(c.used ?? []), usedKey(c, code)];
  r.lines = r.lines.map((l) => l.replace(new RegExp(`^(?:${rx(t.name)}|${rx(t.name.split(' ')[0])}): (?=[“"])`), ''));
  // He does not repeat himself word for word: a line already said in this conversation is dropped, and if that leaves nothing he says so.
  { const prev = new Set(c.spoken ?? []); const kept = r.lines.filter((l) => l.startsWith('⟡') || l.length <= 30 || !prev.has(l));
    if (kept.length !== r.lines.length) { const alr = vsay(w, t, p, 'already'); r.lines = kept.some((l) => answered(l)) ? kept : [...kept.filter((l) => !l.startsWith('⟡')), prev.has(alr) ? 'He has nothing more to say on it.' : alr, ...kept.filter((l) => l.startsWith('⟡'))]; }
    if (r.convo) r.convo.spoken = [...(c.spoken ?? []), ...r.lines.filter((l) => !l.startsWith('⟡') && l.length > 30)].slice(-60); }
  return r;
}
function sayRaw(w: World, p: Character, t: Character, c: Convo, code: string): Said {
  const lines: string[] = [];
  const rng = w.rng;
  const stay = (node = c.node, minutes = 20): Said => ({ lines, minutes, convo: { id: c.id, node, ctx: c.ctx } });
  const r = rel(t, p.id);
  const rp = rel(p, t.id);
  const [c0, arg] = code.split(':');
  touchDispute(w, p, t);
  const tweak = (trust: number, aff = 0, resp = 0) => {
    feelOn(w, r, 'trust', trust);
    feelOn(w, r, 'affection', aff);
    feelOn(w, r, 'respect', resp);
  };
  if (c0 === 'sub') {
    c.ctx.sub = arg === 'back' ? undefined : arg;
    // Opening "what can be done" says what really can be, in his voice, and then lists those things. It is not a question of its own.
    if (arg === 'act') { const q = sayRaw(w, p, t, c, 'can_do'); return { lines: q.lines, minutes: 8, convo: { id: c.id, node: 'incident', ctx: c.ctx } }; }
    return stay('incident', 0);
  }
  if (code === 'root') return c.node === 'root' ? { lines: [vsay(w, t, p, 'leave')], minutes: 5, convo: null } : { lines, minutes: 5, convo: { id: c.id, node: 'root', ctx: { asked: [], focus: c.ctx.focus } } }; // (back to the subject it came from)
  if (c0 === 'n' && NODES.includes(arg)) return { lines, minutes: 5, convo: { id: c.id, node: arg, ctx: c.ctx } };
  if (['pick_member', 'pick_concern', 'pick_incident'].includes(code)) {
    // (V90: a question is answered, even when the answer is a question back)
    const tp = temper(t), hot = tp.volatility + tp.pride > 1.15;
    lines.push(code === 'pick_member' ? (hot ? '“Who? Spit it out.”' : tp.caution > 0.6 ? '“Depends who you mean.”' : '“Who did you have in mind?”')
      : code === 'pick_concern' ? (r.trust < 0.35 ? '“About who? Careful how you say it.”' : '“Go on. About who?”')
      : (hot ? '“Which business? There’s always something.”' : '“What, the business with…? Which one?”'));
    return { lines, minutes: 5, convo: { id: c.id, node: code, ctx: c.ctx } };
  }

  { const fx = flow(w, p, t, c, code); if (fx) return fx; }
  switch (c0) {
    // ---- personal
    case 'how': {
      const b = ownerBiz(w, t.id);
      if (t.hurtUntil > w.now) lines.push(`${t.name} winces. "Still sore."`);
      if (t.cash < 150) lines.push(`${t.name}: "Money is tight."`);
      else if (b && b.distress > 0) lines.push(`${t.name} admits ${b.name} has been losing money.`);
      const g = Object.entries(t.rels).filter(([id, q]) => q.grudge >= 0.3 && id !== w.playerId && w.chars[id]?.alive).sort((a, b2) => b2[1].grudge - a[1].grudge)[0];
      if (g && r.trust >= 0.35) {
        const s = w.chars[g[0]];
        lines.push(`He lowers his voice. "I have a problem with ${s.name}."`);
        c.ctx.subject = s.id;
        tweak(0.02, 0.02);
        return { lines, minutes: 25, convo: { id: c.id, node: 'subject', ctx: c.ctx } };
      }
      if (!lines.length) lines.push(vsay(w, t, p, 'how_fine'));
      tweak(0.01, 0.02);
      // What he has just said is what you can ask about next: a wound, money, the shop.
      const rows: FollowOpt[] = [];
      if (t.hurtUntil > w.now) rows.push({ code: 'f_hurt', label: 'What happened to you?' });
      if (b && b.distress > 0) rows.push({ code: 'f_biz', label: 'What’s going wrong at the shop?' });
      if (t.cash < 150 || (b && b.distress > 0)) rows.push({ code: 'f_help', label: 'Is there anything I can do?', hint: 'He may not want to say.' });
      if (rows.length) { c.ctx.follow = rows; return stay('follow', 20); }
      return stay('personal', 20);
    }
    case 'confront': {
      const f = w.facts[arg];
      if (!f) return stay('root', 3);
      delete t.denied?.[arg];
      const bold = t.traits.courage > 0.55 || arch(t) === 'proud' || arch(t) === 'hothead';
      lines.push(`You tell ${t.name.split(' ')[0]} you know it was him, whatever he said before.`);
      if (!bold || rng.chance(clamp(0.2 + r.respect * 0.6, 0.1, 0.8))) {
        lines.push(`${t.name} holds your eye for a moment, then lets out a breath. “All right. It was me. What was I going to say, with you standing there?”`);
        learn(w, p.id, f, t.id, true);
        tweak(-0.03, 0, 0.03);
      } else {
        lines.push(`${t.name}: “Careful, ${addr(w, t, p)}. You’re calling me a liar.”`);
        bearOn(w, r, 0.1, `${p.name} as good as called him a liar`);
        tweak(-0.06, -0.03, -0.02);
      }
      return stay('root', 10);
    }
    case 'f_rep_who': {
      const f = Object.values(w.facts).filter((q) => q.actor === p.id && t.known[q.id] && t.known[q.id].from !== 'self').sort((x, y) => y.t - x.t)[0];
      const k = f ? t.known[f.id] : undefined;
      const src = k && k.from !== 'public' && k.from !== 'witness' ? w.chars[k.from] : undefined;
      lines.push(src && src.id !== p.id ? `${t.name}: “${src.name} said something. I couldn’t tell you if he had it right.”` : k?.from === 'witness' ? `${t.name}: “I was there. I saw some of it.”` : `${t.name}: “It was going round. Nobody owns a story like that.”`);
      if (src && src.id !== p.id) feelAtLeast(w, p, src.id, 'trust', 0.1);
      return stay('root', 8);
    }
    case 'f_hurt': {
      const f = Object.values(w.facts).filter((q) => q.victim === t.id && !BORING.has(q.kind) && w.now - q.t < 20 * DAY && t.known[q.id]).sort((x, y) => y.t - x.t)[0];
      if (f && !holdsBack(w, t, p, f, 'who')) { const q = sayRaw(w, p, t, c, 'inc:' + f.id); return { lines: q.lines, minutes: q.minutes, convo: q.convo }; }
      lines.push(f ? `${t.name} looks away. “It’s mine to deal with.”` : `${t.name} shrugs, and winces doing it. “A fall. It’ll mend.”`);
      return stay('root', 8);
    }
    case 'f_biz': {
      const b = ownerBiz(w, t.id);
      if (!b) return stay('root', 3);
      const pos = feePosition(b);
      const fee = b.protection && b.protection.collectorId !== t.id ? b.protection.fee : 0;
      lines.push(b.damaged > 0 ? `${t.name}: “The place was knocked about. Trade hasn’t come back.”` : fee > pos.cap ? `${t.name}: “After the envelope there isn’t enough left to keep the place going.”` : `${t.name}: “It’s slow. It happens. I can’t say it’s anything more.”`);
      if (t.cash < 400 || b.distress > 1) c.ctx.follow = [{ code: 'f_help', label: 'Is there anything I can do?' }];
      return c.ctx.follow ? stay('follow', 10) : stay('root', 10);
    }
    case 'f_help': {
      const b = ownerBiz(w, t.id);
      const need = t.cash < 300 || (!!b && (b.cash < 250 || b.distress > 0));
      if (!need) { lines.push(`${t.name}: “I’m all right. Thank you for asking.”`); return stay('root', 3); }
      if (r.trust < 0.35 || (arch(t) === 'proud' && r.trust < 0.55)) { lines.push(`${t.name} looks at you a moment. “I’ll manage.”`); return stay('root', 5); }
      lines.push(`${t.name} hesitates, then says it plainly. “Some help wouldn’t hurt.”`);
      const rows: FollowOpt[] = [];
      if (p.cash >= 200) rows.push({ code: 'help_gift', label: 'Here. $200. No questions', hint: 'He won’t forget it.', big: true });
      if (p.cash >= 300 && (t.rank === 'civilian' || t.rank === 'associate')) rows.push({ code: 'help_loan', label: 'I can lend you something', hint: 'At a friend’s rate. You can change the amount and the rate.', big: true });
      rows.push({ code: 'deal:drop', label: 'It’ll keep. Let me think about it' });
      c.ctx.follow = rows;
      return stay('follow', 10);
    }
    case 'help_gift':
      if (p.cash < 200) lines.push('You can’t spare it.');
      else {
        p.cash -= 200;
        t.cash += 200;
        tweak(0.1, 0.08, 0.02);
        lines.push(vsay(w, t, p, 'gift_thanks'));
      }
      return stay('personal', 15);
    case 'help_loan': {
      // Stage 4: one way to lend (asks 'lend'): a friend's terms, which he can change
      if (p.cash < 100) { lines.push('You can’t spare it.'); return stay('personal', 5); }
      const s = openAsk(w, 'lend', p, t, { amt: Math.min(300, Math.floor(p.cash / 50) * 50), rate: 0.03, why: `${p.name} offered ${t.name} a loan as a friend` });
      if (!s) { lines.push(`${t.name}: “Not now. But thank you.”`); return stay('personal', 5); }
      lines.push(`You tell ${t.name.split(' ')[0]} you could lend him something, at a friend’s rate.`);
      lines.push(`${t.name}: “How much are we talking?”`);
      return { lines, minutes: 15, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'welcome':
      tweak(0.06, 0.05);
      lines.push(vsay(w, t, p, 'welcome_back'));
      return stay('personal', 20);
    case 'congrats':
      tweak(0.04, 0.05, 0.03);
      lines.push(vsay(w, t, p, 'congrats'));
      return stay('personal', 15);
    case 'old_times': {
      tweak(0.02, 0.04);
      feelOn(w, rp, 'affection', 0.03);
      const told = share(w, t, p, lines);
      share(w, p, t, []);
      if (!lines.length) lines.push(vsay(w, t, p, 'old_quiet'));
      // V77: when he passes something on, the conversation goes there. You can ask him about it, instead of being sent back to the menu.
      if (told.length) return { lines, minutes: 60, convo: { id: c.id, node: 'incident', ctx: { fact: told[0].id, asked: [] } } };
      return stay('personal', 60);
    }
    case 'drink': {
      if (p.cash < 40) {
        lines.push("You can't afford the round.");
        return stay('personal', 5);
      }
      p.cash -= 40;
      tweak(0.06, 0.06);
      feelOn(w, rp, 'trust', 0.04);
      lines.push(vsay(w, t, p, 'drink'));
      const toldD = share(w, t, p, lines);
      if (toldD.length) return { lines, minutes: 45, convo: { id: c.id, node: 'incident', ctx: { fact: toldD[0].id, asked: [] } } };
      return stay('personal', 45);
    }

    // ---- business
    case 'op': {
      const b = ownerBiz(w, t.id);
      if (b) {
        lines.push(b.cash < 200 ? `${t.name}: "${b.name} is barely keeping up."` : `${t.name}: "${b.name} is doing all right."`);
        if (b.protection) {
          const col = w.chars[b.protection.collectorId];
          if (b.protection.collectorId === t.id || b.protection.fee <= 0) lines.push(rng.pick([`It’s a family place. Nobody leans on ${t.name} for it. He answers to his own people.`, `${b.name} is the family’s own. No envelope changes hands, only favours.`]));
          else lines.push(rng.pick([`He pays ${col?.name ?? 'someone'} of the ${w.fam[b.protection.familyId].name} family ${money(b.protection.fee)} a week, and he says it like the weather.`, `Every week an envelope goes to ${col?.name ?? 'someone'}, ${w.fam[b.protection.familyId].name} family. ${money(b.protection.fee)}. He doesn’t enjoy it.`]));
        }
        const inc = incidentsOf(w, t).find(({ f }) => f.business === b.id || f.victim === t.id);
        if (inc && r.trust >= 0.3) {
          const k = t.known[inc.f.id];
          lines.push(`Then, almost as an afterthought: "${told(w, t, inc.f, k.knowsActor)}"`);
          if (!p.known[inc.f.id]) learn(w, p.id, inc.f, t.id, k.knowsActor);
          return { lines, minutes: 30, convo: { id: c.id, node: 'incident', ctx: { fact: inc.f.id, asked: [] } } };
        }
        confide(w, p, t, lines);
      } else {
        const h = t.books.history.at(-1);
        lines.push(vsay(w, t, p, h && h.gross > 200 ? 'biz_good' : 'biz_quiet'));
        if (t.books.side && !t.books.sideKnown && r.trust > 0.6 && rng.chance(0.5)) {
          lines.push(`Then he leans in. "I’ve got something going on the side. You didn’t hear it from me."`);
          t.books.sideKnown = true;
          addFact(w, { kind: 'side_operation', actor: t.id, victim: t.bossId ?? undefined, amount: t.books.side, text: `${t.name} has been running something on the side.`, district: t.district }, { witnesses: [p.id] });
        }
      }
      tweak(0.01);
      return stay('business', 25);
    }
    case 'earn': {
      if (t.bossId === p.id) {
        const h = t.books.history.slice(-2);
        lines.push(h.length ? `${t.name}: ${vsay(w, t, p, 'earn_paid', { X: money(h[h.length - 1].paid) })}` : vsay(w, t, p, 'earn_none'));
        if (t.books.arrears > 0) lines.push(vsay(w, t, p, 'earn_behind', { X: money(t.books.arrears) }));
        const fl = p.books.flags[t.id];
        if (fl?.amt) lines.push(vsay(w, t, p, 'earn_flag', { X: money(Math.round(fl.amt)) }));
      } else if (t.id === p.bossId) {
        const b = p.books;
        lines.push(vsay(w, t, p, 'earn_open'), `“${Math.round(p.kickRate * 100)} cents in the dollar comes to me. ${b.arrears > 0 ? `You’re behind by ${money(b.arrears)}. Fix it.` : 'You’re square with me.'}”`);
      } else {
        for (const d of w.debts.filter((q) => q.status === 'active' && ((q.creditor === p.id && q.debtor === t.id) || (q.creditor === t.id && q.debtor === p.id)))) {
          lines.push(d.creditor === p.id ? (d.missed ? `“I know. I’m behind. ${money(d.balance)} still. I’ll catch up.”` : `“${money(d.weeklyPayment)} a week, every week. I haven’t missed.”`) : `“You still owe me ${money(d.balance)}. Don’t forget it.”`);
        }
      }
      return stay('business', 25);
    }
    case 'rate_ask': {
      if (t.id !== p.bossId) return stay('business', 5);
      p.cooldown['rate:ask'] = w.now + 4 * 7 * DAY;
      // V89: asking to pass up less is a matter between you (asks.ts 'rate'): he may agree, meet you part way with the reason he has
      // (a levy, his own people to pay, your arrears), put you off, or refuse; you can ask for less of a cut, make your case, or drop it.
      const s = askBetween(w, 'rate', p.id, t.id) ?? rateAsk(w, p, t);
      if (!s) { lines.push(p.kickRate <= rateView(w, p, t).floor + 0.001 ? `${t.name.split(' ')[0]} points out you already pass up less than most. There's nothing left to give.` : `${t.name.split(' ')[0]}: “We had this conversation. Give it a while.”`); return stay('business', 10); }
      lines.push(...playerMove(w, p, s.id, 'ask').lines);
      return { lines, minutes: 30, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'partner_chop': {
      if (p.cash < 2000) {
        lines.push('You don’t have $2,000.');
        return stay('business', 10);
      }
      const b = ownerBiz(w, t.id)!;
      if (rng.chance(clamp(0.85 - t.traits.caution * 0.3, 0.4, 0.9))) {
        p.cash -= 2000;
        t.cash += 2000;
        w.ventures.push({ id: 'v' + w.nextId++, ownerId: p.id, bizId: b.id, hostId: t.id, hostShare: 0.3, stock: 0, since: w.now, weeks: 0, takings: 0, open: true });
        lines.push(`${t.name} gives you the back bay at ${b.name}. Bring it cars; it clears two a week.`);
        t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'agreement', text: `You agreed to run a chop shop out of ${b.name}; he takes 30%.` });
      } else lines.push(`${t.name} thinks about it and shakes his head. "Too hot."`);
      return stay('business', 40);
    }
    case 'partner_fence': {
      const before = w.jobs.length;
      oppFrom(w, t);
      lines.push(w.jobs.length > before ? `${t.name} has something in mind. ${jobSaid(w.jobs.at(-1)!)}` : `${t.name} says it’s quiet at the moment.`);
      return stay('business', 25);
    }
    case 'terms_cut': {
      const b = ownerBiz(w, t.id)!;
      if ((p.cooldown['cut:' + b.id] ?? 0) > w.now) { lines.push(`${t.name}: “You did that for me not long ago. Don’t spoil it.”`); return stay('business', 5); }
      p.cooldown['cut:' + b.id] = w.now + 30 * DAY;
      const old = b.protection!.fee, now = Math.max(5, r5(old * 0.75));
      b.protection = { ...b.protection!, fee: now };
      tweak(0.06, 0.04, 0.03);
      t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'agreement', text: `You cut his weekly fee from ${money(old)} to ${money(now)}.` });
      addFact(w, { kind: 'terms', actor: p.id, victim: t.id, business: b.id, minor: true, text: `${p.name} cut ${b.name}’s weekly fee from ${money(old)} to ${money(now)}.`, district: b.district }, { witnesses: [] });
      const A = arch(t);
      if (A === 'schemer' || A === 'proud' || A === 'bitter') {
        lines.push(A === 'proud' ? `${t.name}: “I didn’t ask for charity.” He looks at the figure for a long moment. “I’ll take it. I won’t forget it.”` : A === 'schemer' ? `${t.name} turns it over. “Fine. What do you want for it?”` : `${t.name}: “Now it’s ${money(now)}. What’s the catch?”`);
        c.ctx.follow = [{ code: 'deal:nothing', label: 'Nothing. It’s fair', hint: 'He’ll respect it.' }, { code: 'deal:remember', label: 'Just remember it when I ask', hint: 'He owes you a favour. You can’t choose when.', big: true }];
        return stay('follow', 20);
      }
      lines.push(`${t.name} didn’t expect that. “Fair enough. You won’t regret it.”`);
      return stay('business', 20);
    }
    case 'terms_raise': {
      const b = ownerBiz(w, t.id)!;
      const fee = b.protection!.fee, want = r5(fee * 1.25), pos = feePosition(b), X = money(want);
      lines.push(`You tell ${t.name.split(' ')[0]} the fee is going up to ${X} a week.`);
      if (want <= pos.cap) {
        b.protection = { ...b.protection!, fee: want };
        tweak(-0.04, -0.03, 0.01);
        lines.push(vsay(w, t, p, 'fee_accept', { X }));
        t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'agreement', text: `The weekly fee went from ${money(fee)} to ${X}.` });
        addFact(w, { kind: 'terms', actor: p.id, victim: t.id, business: b.id, minor: true, text: `${p.name} raised ${b.name}’s weekly fee from ${money(fee)} to ${X}.`, district: b.district }, { witnesses: [] });
        return stay('business', 15);
      }
      const counter = r5(Math.min(want - 5, Math.max(fee * 1.08, pos.cap)));
      c.ctx.deal = { kind: 'fee', biz: b.id, ask: want, old: fee };
      if (!pos.strained && counter > fee) {
        c.ctx.deal.offer = counter;
        lines.push(vsay(w, t, p, 'fee_counter', { X, Y: money(counter) }));
        c.ctx.follow = [
          { code: 'deal:take', label: `Settle at ${money(counter)}`, hint: 'He keeps his dignity. You keep the peace.', big: true },
          { code: 'deal:hold', label: `It’s ${X}, or there’s trouble`, hint: 'He may give in. He won’t forget it.', big: true },
          { code: 'deal:drop', label: 'Leave it as it is, then' },
        ];
      } else {
        lines.push(vsay(w, t, p, pos.strained ? 'fee_cant' : 'fee_wont'));
        c.ctx.follow = [
          { code: 'deal:hold', label: 'It isn’t a request', hint: pos.strained ? 'He really may not have it.' : 'He may give in. He won’t forget it.', big: true },
          { code: 'deal:drop', label: 'All right. For now' },
        ];
      }
      return stay('follow', 10);
    }
    case 'suggest': {
      const b = ownerBiz(w, t.id)!;
      lines.push('You steer the conversation toward the neighbourhood and who watches over it.');
      // V89: an offer opens a matter between you (matters.ts); whatever he says, it is still there next time you come in.
      const s = askBetween(w, 'protect', p.id, t.id, b.id) ?? openAsk(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round((b.income * 0.07) / 5) * 5), why: `${p.name} offered to look after ${b.name}` });
      if (!s) { lines.push(`${t.name} has had enough people at his door this week.`); return { lines, minutes: 20, convo: { id: c.id, node: 'root', ctx: c.ctx } }; }
      lines.push(...playerMove(w, p, s.id, 'ask').lines);
      return { lines, minutes: 35, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'borrow': {
      if (w.debts.some((d) => d.status === 'active' && d.creditor === t.id && d.debtor === p.id)) { lines.push(vsay(w, t, p, 'loan_first')); return stay('business', 10); }
      // V89: asking for money opens a matter between you (asks.ts 'borrow'). He may lend it, offer less, want time, or say no; and
      // whatever he says, you can come back to it: ask for less, make your case, remind him of something, or let it go.
      const open = askBetween(w, 'borrow', p.id, t.id);
      if (!open && (p.cooldown['borrow:' + t.id] ?? 0) > w.now) { lines.push(vsay(w, t, p, 'loan_again')); return stay('business', 10); }
      const s = open ?? openAsk(w, 'borrow', p, t, { amt: 1000, why: `${p.name} asked ${t.name} for a loan` });
      if (!s) { lines.push(vsay(w, t, p, 'loan_again')); return stay('business', 10); }
      p.cooldown['borrow:' + t.id] = w.now + 14 * DAY;
      lines.push(`You ask ${t.name.split(' ')[0]} for ${money(s.terms?.amt ?? 1000)}.`);
      lines.push(...playerMove(w, p, s.id, 'ask').lines);
      return { lines, minutes: 25, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'buy_ask': case 'stake_ask': {
      const b = ownerBiz(w, t.id)!, share = code === 'stake_ask' ? 0.25 : undefined, full = priceOf(w, b), first = Math.round((share ? full * share : full) * 0.85 / 50) * 50;
      const s = openAsk(w, 'buy', p, t, { biz: b.id, amt: first, share, why: `${p.name} wants to buy ${share ? 'a piece of ' : ''}${b.name}` });
      if (!s) { lines.push(`${t.name.split(' ')[0]} has too much on his mind for that today.`); return stay('business', 10); }
      lines.push(share ? `You ask ${t.name.split(' ')[0]} whether he would sell a quarter of ${b.name}.` : `You ask ${t.name.split(' ')[0]} whether he would sell ${b.name}.`);
      lines.push(`${t.name}: “${share ? 'A piece? What did you have in mind?' : 'Depends what you’re offering.'}”`); // (the figure is yours to name: nm:)
      return { lines, minutes: 25, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'run_ask': {
      const op = w.ops.find((o) => o.owner === t.id && o.kind !== 'hijack' && o.state === 'running' && o.runner !== p.id);
      if (!op) return stay('business', 5);
      const s = openAsk(w, 'run', p, t, { what: op.id, about: op.id, amt: 15, why: `${p.name} offered to run ${t.name}'s operation` });
      if (!s) { lines.push(`${t.name.split(' ')[0]} has too much on his mind for that today.`); return stay('business', 10); }
      lines.push(`You tell ${t.name.split(' ')[0]} you could run it for him.`);
      lines.push(`${t.name}: “And what would you want for it?”`);
      return { lines, minutes: 20, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'sell_ask': {
      const b = Object.values(w.biz).find((x) => x.open && x.ownerId === p.id && x.kind !== 'casino');
      if (!b) return stay('business', 5);
      const s = openAsk(w, 'sell', p, t, { biz: b.id, amt: Math.round(priceOf(w, b) * 1.1 / 50) * 50, why: `${p.name} offered ${t.name} ${b.name}` });
      if (!s) { lines.push(`${t.name.split(' ')[0]} has too much on his mind for that today.`); return stay('business', 10); }
      lines.push(`You tell ${t.name.split(' ')[0]} ${b.name} could be his, for the right money.`);
      lines.push(`${t.name}: “What are you asking?”`);
      return { lines, minutes: 25, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'offer_loan': {
      // Stage 4: one way to lend (asks 'lend'): he names the amount and the rate, and the man answers from his own need
      const b = ownerBiz(w, t.id)!;
      const need = Math.max(100, Math.min(p.cash, Math.round(Math.max(500, b.expense * 1.5 - b.cash) / 50) * 50));
      const s = openAsk(w, 'lend', p, t, { biz: b.id, amt: need, rate: 0.05, why: `${p.name} offered ${t.name} a loan` });
      if (!s) { lines.push(`${t.name}: “I appreciate it. Not now.”`); return stay('business', 10); }
      lines.push(`You tell ${t.name.split(' ')[0]} you could lend him something, if it would help.`);
      lines.push(`${t.name}: “What kind of terms?”`);
      return { lines, minutes: 20, convo: { id: c.id, node: 'root', ctx: c.ctx } };
    }
    case 'deal': {
      const dl = c.ctx.deal;
      const what = code.split(':')[1];
      c.ctx.follow = undefined;
      if (!dl) { lines.push(temper(t).agreeable > 0.5 ? '“Whenever you’re ready. You don’t owe me anything.”' : 'He nods. “Another time.”'); return stay('root', 3); }
      const b = dl.biz ? w.biz[dl.biz] : undefined;
      if (what === 'drop') { lines.push(dl.kind === 'loan' ? `You leave it at that.` : `You let it lie. ${t.name} watches you do it.`); return stay(dl.kind === 'loan' ? 'business' : 'business', 5); }
      if (what === 'nothing') { tweak(0.03, 0.02, 0.03); lines.push(`${t.name} nods, and the suspicion goes out of him a little. “Then thank you.”`); return stay('business', 5); }
      if (what === 'remember') { addFavour(w, p.id, t.id, 1, `cut his weekly fee`); lines.push(`“I’ll remember,” says ${t.name}, and you can see he means it.`); return stay('business', 5); }
      if (dl.kind === 'fee' && b?.protection) {
        const pos = feePosition(b);
        if (what === 'take') {
          b.protection = { ...b.protection, fee: dl.offer! };
          tweak(0.01, 0, 0.02);
          lines.push(`You settle on ${money(dl.offer!)}. ${t.name} lets out a breath and shakes your hand.`);
          t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'agreement', text: `The weekly fee went from ${money(dl.old!)} to ${money(dl.offer!)}, after some haggling.` });
          addFact(w, { kind: 'terms', actor: p.id, victim: t.id, business: b.id, minor: true, text: `${p.name} and ${t.name} settled ${b.name}’s weekly fee at ${money(dl.offer!)}.`, district: b.district }, { witnesses: [] });
          return stay('business', 15);
        }
        // pressed: he gives in only if he can bear it and fears or respects you enough; otherwise he refuses, and that is on record
        const bearable = dl.ask <= pos.cap * 1.3 && !pos.strained;
        const give = bearable && rng.chance(clamp(0.3 + (r.respect - 0.3) * 0.6 + (0.6 - t.traits.courage) * 0.5, 0.1, 0.85));
        if (give) {
          b.protection = { ...b.protection, fee: dl.ask };
          tweak(-0.08, -0.05, 0.0);
          bearOn(w, r, 0.08, `${p.name} leaned on him to pay more`);
          lines.push(vsay(w, t, p, 'fee_press_yes', { X: money(dl.ask) }));
          t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'threat', text: `You leaned on him until the weekly fee went from ${money(dl.old!)} to ${money(dl.ask)}.` });
        } else {
          tweak(-0.1, -0.06, -0.01);
          bearOn(w, r, 0.15, `${p.name} leaned on him to pay more`);
          lines.push(vsay(w, t, p, 'fee_press_no'));
          addFact(w, { kind: 'protection_refused', actor: t.id, victim: p.id, business: b.id, text: `${t.name} refused to pay ${p.name} more for ${b.name}.`, district: b.district }, { witnesses: [p.id] });
        }
        return stay('business', 15);
      }
      if (dl.kind === 'ext') {
        const debt = w.debts.find((x) => x.id === dl.debt && x.status === 'active');
        if (!debt) return stay('debt', 3);
        if (what === 'part') {
          if (p.cash < dl.offer!) { lines.push('You haven’t got it on you.'); return stay('debt', 5); }
          payDebt(w, debt, dl.offer!);
          debt.nextDue += 7 * DAY;
          lines.push(`You put ${money(dl.offer!)} on the table. ${t.name} counts it, nods, and gives you the week.`);
          tweak(0.02, 0, 0.02);
          return stay('debt', 10);
        }
      }
      return stay('root', 3);
    }
    // ---- family
    case 'about': {
      const x = w.chars[arg];
      // (V90: in his words: what is between them, then what kind of man he takes him for)
      const q = t.rels[x.id], nm = x.name.split(' ')[0], tw = traitWords(x);
      const rel0 = !q ? 'I hardly know him' : q.grudge >= 0.55 ? 'I can’t stand him' : q.grudge >= 0.3 ? 'He and I have our differences' : q.trust > 0.7 ? 'I’d trust him with anything' : q.trust > 0.45 ? 'We get on' : q.trust > 0.25 ? 'I keep an eye on him' : 'I don’t trust him';
      lines.push(`“${nm}? ${rel0}.${tw ? ` ${tw[0].toUpperCase() + tw.slice(1)}, I’d say.` : ''}”`);
      const f = Object.values(w.facts).filter((q) => !q.minor && q.actor === x.id && t.known[q.id] && !p.known[q.id] && !BORING.has(q.kind)).sort((a, b) => b.t - a.t)[0];
      if (f && r.trust >= 0.35) {
        lines.push(`${vsay(w, t, p, 'gossip')} ${told(w, t, f, t.known[f.id].knowsActor)}`);
        learn(w, p.id, f, t.id, t.known[f.id].knowsActor);
      }
      tweak(0.01);
      return stay(c.node === 'follow' ? 'root' : 'pick_member', 20);
    }
    case 'leaders': {
      const boss = t.bossId ? w.chars[t.bossId] : undefined;
      const top = w.chars[w.fam[t.familyId!].bossId];
      // (V90: said by him, about the men above him, in his own words)
      const says = (x: Character) => { const q = t.rels[x.id], n = x.name.split(' ')[0], who = x.id === top?.id ? `${n} runs the family` : `I answer to ${n}`;
        return !q ? `“${who}. I barely know the man.”` : q.grudge >= 0.55 ? `“${who}. Don’t get me started.”` : q.grudge >= 0.3 ? `“${who}. We have our differences.”` : q.trust > 0.7 ? `“${who}. I’d trust him with my life.”` : q.trust > 0.45 ? `“${who}. He’s all right. We get on.”` : q.trust > 0.25 ? `“${who}. I watch him, he watches me.”` : `“${who}. I don’t trust him, and he knows it.”`; };
      if (r.trust >= 0.35) for (const x of [boss, top].filter((y, i, a) => y && a.indexOf(y) === i && y.id !== t.id) as Character[]) lines.push(says(x));
      const unhappy = [boss, top].some((x) => x && (t.rels[x.id]?.grudge ?? 0) >= 0.3);
      if (unhappy && r.trust >= 0.5) lines.push(`"You didn’t hear that from me."`);
      else if (r.trust < 0.35) lines.push(`He changes the subject. “You ask a lot of questions for a man I hardly know.”`);
      return stay('family', 25);
    }
    case 'concern': {
      const x = w.chars[arg];
      const fl = p.books.flags[x.id];
      if (!isSuperior(w, x, t) && x.bossId !== t.id && t.rank === 'associate') {
        lines.push(`${t.name} shrugs. "I’m the wrong man to tell."`);
        return stay('family', 15);
      }
      if (x.bossId === t.id && fl?.amt) react(w, t, x, { amt: fl.amt, n: Math.max(2, fl.n), last: w.now }, 'dialogue');
      lines.push(vsay(w, t, p, 'concern_ok', { X: x.name.split(' ')[0] }));
      if (rng.chance(0.3)) bear(w, x, p.id, 0.1, `${p.name} raised doubts about him`);
      tweak(0.02, 0, 0.02);
      return stay('family', 25);
    }
    case 'promo': {
      lines.push(...promotionLines(w, p, t));
      return stay('family', 25);
    }
    case 'recommend': {
      if (rng.chance(clamp(r.trust * 0.9, 0.1, 0.9))) {
        const boss = w.chars[w.fam[t.familyId!].bossId];
        if (boss && boss.id !== t.id) feel(w, boss, p.id, 'respect', 0.05);
        t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'favour', text: `He put in a word for you. You owe him one.` });
        lines.push(vsay(w, t, p, 'recommend_yes'));
      } else lines.push(vsay(w, t, p, 'recommend_no'));
      return stay('family', 25);
    }

    // ---- disputes
    case 'intro': {
      if ((p.cooldown[`intro:${t.id}`] ?? 0) > w.now) { lines.push(`${t.name} doesn’t even look up. Not today.`); return stay('root', 5); }
      const same = !!p.familyId && p.familyId === t.familyId;
      const high = t.rank === 'capo' || t.rank === 'underboss' || t.rank === 'boss';
      const chance = clamp(0.5 + p.standing / 220 + p.skills.charm * 0.2 + (same ? 0.15 : 0) - (high ? 0.18 : 0) - (t.rank !== 'civilian' && p.rank === 'associate' && !same ? 0.1 : 0) - t.traits.caution * 0.08, 0.15, 0.92);
      lines.push(`You walk over, give your name and tell him who you answer to${p.bossId ? `: ${w.chars[p.bossId].name}` : ''}.`);
      if (rng.chance(chance)) {
        (p.intro ??= {})[t.id] = w.now;
        rp.lastMet = r.lastMet = w.now;
        tweak(0.05, 0.02, 0.02);
        lines.push(vsay(w, t, p, 'intro_ok'));
        return stay('root', 15);
      }
      p.cooldown[`intro:${t.id}`] = w.now + DAY;
      rp.lastMet = w.now;
      tweak(0, 0, -0.02);
      lines.push(vsay(w, t, p, high ? 'intro_no_high' : 'intro_no'));
      return stay('root', 10);
    }
    case 'intro_via': {
      const via = w.chars[arg];
      if (!via?.alive) { lines.push('He can’t help you with that any more.'); return stay('root', 5); }
      (p.intro ??= {})[t.id] = w.now;
      rp.lastMet = r.lastMet = w.now;
      tweak(0.1, 0.03, 0.03);
      feel(w, via, p.id, 'respect', 0.01);
      lines.push(`${via.name.split(' ')[0]} had a word with ${t.name} before you arrived.`, vsay(w, t, p, 'vouch', { V: via.name.split(' ')[0] }));
      return stay('root', 15);
    }
    case 'ask_want': {
      const tr = rel(t, p.id).trust;
      if (rng.chance(clamp(0.25 + tr * 0.7, 0.2, 0.9))) {
        learnAbout(p, t.id, 'want');
        const kind = (t.want ??= { kind: wantFor(t), since: w.now }).kind;
        lines.push(`${t.name} thinks about it. “You really want to know?”`, `“${WANT_SAY[kind][arch(t) === 'cold' || arch(t) === 'proud' || arch(t) === 'schemer' || arch(t) === 'frightened' ? 1 : 0]}”`);
        if (kind === 'rich' || kind === 'gamble' || kind === 'independent' || kind === 'made') { c.ctx.follow = [{ code: 'f_want', label: 'Is there anything I can do about that?' }]; return stay('follow', 20); }
      }
      else { lines.push(vsay(w, t, p, 'want_dodge')); return { ...stay('root', 20), skipMemory: true }; }
      return stay('root', 20);
    }
    case 'f_want': {
      const kind = t.want?.kind ?? wantFor(t);
      const warm = r.trust >= 0.5;
      const ans: Record<string, [string, string]> = {
        made: ['“Speak for me when it’s time. That’s all. I’ll do the rest.”', '“Don’t embarrass me. That would be enough.”'],
        rich: ['“Put me on to something good, when you hear of it.”', '“Keep your ears open. I’ll make it worth your while.”'],
        gamble: ['“A word to the right man, a bit of room. You’ll hear.”', '“Not yet. When there’s something to say, I’ll say it.”'],
        independent: ['“Stay out of my way, and tell them I’m worth leaving alone.”', '“Nothing. It’s a thing a man does himself.”'],
      };
      lines.push(`${t.name}: ${(ans[kind] ?? ans.rich)[warm ? 0 : 1]}`);
      if (warm) { t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'question', text: `He told you what he wants (${kind}), and you asked if you could help.`, due: w.now + 30 * DAY }); }
      return stay('root', 10);
    }
    case 'ask_crew': {
      const mates = Object.values(w.chars).filter((x) => x.alive && x.bossId === p.id && x.id !== t.id);
      const tr = rel(t, p.id).trust;
      if (!mates.length) { lines.push(`${t.name} shrugs. "There’s nobody else to get on with."`); return stay('root', 10); }
      const friend = mates.filter((x) => rel(t, x.id).trust > 0.4).sort((a, b) => rel(t, b.id).trust - rel(t, a.id).trust)[0];
      const foe = mates.filter((x) => rel(t, x.id).grudge > 0.2).sort((a, b) => rel(t, b.id).grudge - rel(t, a.id).grudge)[0];
      const loan = w.debts.find((x) => x.status === 'active' && (x.debtor === t.id || x.creditor === t.id) && mates.some((m) => m.id === (x.debtor === t.id ? x.creditor : x.debtor)));
      if (rng.chance(clamp(0.2 + tr * 0.7, 0.2, 0.9))) {
        lines.push(`${t.name} lowers his voice.`);
        if (friend) { lines.push(`"${friend.name.split(' ')[0]}’s all right. We talk."`); learnAbout(p, t.id, `tie:${friend.id}`); }
        if (foe) { lines.push(`"${foe.name.split(' ')[0]}? We don’t see eye to eye. I’d leave it at that."`); learnAbout(p, t.id, `rival:${foe.id}`); }
        if (loan) { const o = w.chars[loan.debtor === t.id ? loan.creditor : loan.debtor]; lines.push(loan.debtor === t.id ? `"I owe ${o.name.split(' ')[0]} a bit. It’s nothing."` : `"${o.name.split(' ')[0]}’s into me for a bit. He’ll pay."`); learnAbout(p, t.id, `loan:${o.id}`); }
        if (!friend && !foe && !loan) lines.push(vsay(w, t, p, 'crew_nothing'));
        const rows: FollowOpt[] = [];
        if (foe) rows.push({ code: 'about:' + foe.id, label: `What’s the trouble with ${foe.name.split(' ')[0]}?` });
        if (friend) rows.push({ code: 'about:' + friend.id, label: `What’s ${friend.name.split(' ')[0]} like?` });
        if (rows.length) { c.ctx.follow = rows; return stay('follow', 20); }
      } else { lines.push(`${t.name} gives you a careful look. "We all get along." You can tell there’s more.`); return { ...stay('root', 20), skipMemory: true }; }
      return stay('root', 20);
    }
    case 'ask_history': { lines.push(...historyLines(w, p, t)); feel(w, t, p.id, 'respect', 0.02); return stay('root', 5); }
    case 'enc': {
      const [, eid, ecode] = code.split(':');
      const e = w.enc.find((x) => x.id === eid);
      if (!e || e.status !== 'open') { lines.push(`${t.name}: “Forget it. It’s been dealt with.”`); return stay('root', 3); }
      const res = encChoose(w, p, e, ecode);
      lines.push(...res.lines);
      // (answered, it is done with; still open, as when you have only asked what it is really for, it stays the subject)
      return { lines, minutes: res.minutes, convo: { id: c.id, node: 'root', ctx: e.status === 'open' ? { asked: [], focus: 'enc:' + e.id, raised: [e.id] } : { asked: [] } } };
    }
    case 'sit_ask': { lines.push(...askAbout(w, p, t)); return stay('root', 15); }
    case 'sit_cover': case 'sit_lend': case 'sit_leave': case 'sit_rival': { lines.push(...helpWith(w, p, t, c0 === 'sit_cover' ? 'cover' : c0 === 'sit_lend' ? 'lend' : c0 === 'sit_rival' ? 'rival' : 'leave')); return stay('root', 15); }
    case 'ask_rep': {
      p.cooldown[`rep:${t.id}`] = w.now + 3 * DAY;
      // (what the street says, told as what the street says: he is passing it on, not saying it himself)
      const lead = ['People say', 'You’ll also hear', 'And some say'];
      lines.push(vsay(w, t, p, 'rep_open'), `“${repLines(w, p).slice(0, 3).map((l, i) => `${lead[i]}, ‘${l.replace(/^“|”$/g, '')}’`).join(' ')}”`);
      if (Object.values(w.facts).some((q) => q.actor === p.id && t.known[q.id] && t.known[q.id].from !== 'self')) { c.ctx.follow = [{ code: 'f_rep_who', label: 'Where did you hear that?' }]; return stay('follow', 10); }
      return stay('root', 10);
    }
    case 'ask_around': {
      const fam = t.familyId ? `the ${famName(w, t)} family` : 'nobody in particular';
      const rank = t.rank === 'civilian' ? (ownerBiz(w, t.id) ? `owns ${ownerBiz(w, t.id)!.name}` : 'is nobody you’d need to worry about') : `is ${t.rank === 'associate' ? 'an associate' : 'a ' + t.rank} of ${fam}`;
      const mood = t.traits.violence > 0.65 ? 'People step round him when he’s drinking.' : t.traits.sociability > 0.65 ? 'He’s well liked and he knows it.' : t.traits.greed > 0.65 ? 'He’s a man who counts everything twice.' : 'Nobody has anything much to say about him, which tells you something.';
      lines.push(`A couple of quiet questions later you know he ${rank}. ${mood}`);
      return stay('root', 30);
    }
    case 'inc': {
      const f = w.facts[arg];
      const k = t.known[arg];
      const nx: Convo = { id: c.id, node: 'incident', ctx: { fact: arg, asked: [] } };
      lines.push(`You ask ${t.name.split(' ')[0]} about it.`);
      if (f.actor === t.id) {
        const lie = rng.chance(clamp(0.3 + t.traits.caution * 0.35 - r.trust * 0.3, 0.05, 0.7));
        if (lie) {
          lines.push(vsay(w, t, p, 'inc_deny'));
          nx.ctx.denied = true;
          // The lie is on record: if you find out the truth some other way, you can put it to him.
          const dn = (t.denied ??= {});
          dn[arg] = Math.floor(w.now / 1440);
          const ks = Object.keys(dn);
          if (ks.length > 10) delete dn[ks.sort((x, y) => dn[x] - dn[y])[0]];
        } else {
          lines.push(vsay(w, t, p, 'inc_admit'));
          if (!p.known[arg]) learn(w, p.id, f, t.id, true);
          tweak(0.02);
        }
      } else {
        const inv = involvedIn(w, t, f);
        const pk = p.known[arg];
        const ac = f.actor ? w.chars[f.actor] : undefined;
        const vc = f.victim ? w.chars[f.victim] : undefined;
        const take = ac && ac.id !== p.id && (t.rels[ac.id]?.grudge ?? 0) >= 0.3 ? `"${ac.name.split(' ')[0]}? I’m not surprised. That one has it coming."`
          : ac && ac.id !== p.id && (t.rels[ac.id]?.trust ?? 0) >= 0.4 ? `"Doesn’t sound like ${ac.name.split(' ')[0]}. Somebody’s stirring."`
          : vc && vc.familyId === t.familyId && vc.id !== t.id ? `"That’s one of ours. It doesn’t get forgotten."`
          : temper(t).volatility > 0.6 ? `"Some things you settle with a bat, not a conversation."`
          : temper(t).caution > 0.6 ? `"Best nobody in this room gets involved."`
          : `"Not my business unless it becomes my business."`;
        if (inv) lines.push(`${t.name}: "${inHisVoice(told(w, t, f, k.knowsActor), t, f.victim === t.id)}"`);
        else lines.push(pk ? `${t.name} lifts a shoulder. "I wasn’t there. You know as much as I do." ${take}` : `${t.name} lifts a shoulder. "I wasn’t there. I only know what was going round." "${told(w, t, f, k.knowsActor)}"`); // (V90: what he thinks of it, when he has nothing new to tell)
        if (!pk) learn(w, p.id, f, t.id, k.knowsActor);
        if (!k.knowsActor && !pk) lines.push(`He doesn’t know who did it.`);
      }
      return { lines, minutes: 25, convo: nx };
    }
    case 'own': {
      c.ctx.asked.push('own');
      lines.push(`You tell ${t.name} straight that it was you. He takes a long moment. "At least you said it to my face."`);
      bearOn(w, r, -(0.08), 'owned up');
      tweak(0.03, 0, 0.03);
      return stay('incident', 15);
    }
    case 'lie': {
      c.ctx.asked.push('lie');
      const f = w.facts[c.ctx.fact!];
      if (rng.chance(clamp(0.35 + r.trust * 0.4 - (t.known[f.id]?.knowsActor ? 0.25 : 0), 0.1, 0.8))) {
        lines.push(`${t.name} studies you, then nods slowly. "All right. I hear you."`);
      } else {
        lines.push(`${t.name} doesn’t blink. "Don’t insult me. I know what I know."`);
        bearOn(w, r, 0.12, `${p.name} denied what he knows`);
        tweak(-0.08, -0.04, -0.03);
      }
      return stay('incident', 15);
    }
    case 'a_own':
    case 'a_pay': {
      // V89: owning up, or paying for what you did, is an offer of amends (asks.ts 'amends'): he may accept it, name what it would
      // take and why (what it cost him), or turn it away; and it stays between you, so you can come back with more.
      const f = w.facts[arg];
      c.ctx.asked.push(c0);
      const amt = c0 === 'a_pay' ? Math.max(200, Math.round((f?.amount ?? 0) * 1.2)) : 0;
      if (amt && p.cash < amt) { lines.push('You reach for your money and come up short. Better to wait until you can do it properly.'); c.ctx.asked.pop(); return stay('amends', 5); }
      const s = askBetween(w, 'amends', p.id, t.id) ?? amendsAsk(w, p, t, { fact: f?.id, amt, why: `${p.name} came to make it right with ${t.name}` });
      if (!s) { lines.push(`${t.name}: “We’ve been through it. Leave it a while.”`); return stay('amends', 5); }
      if (s.terms) s.terms.amt = Math.max(s.terms.amt ?? 0, amt);
      lines.push(c0 === 'a_own' ? '"I was wrong," you say.' : `You put ${money(amt)} on the table.`);
      lines.push(...playerMove(w, p, s.id, 'ask').lines);
      return stay('amends', 20);
    }
    case 'a_start':
    case 'a_defy': {
      c.ctx.asked.push(c0);
      amends(w, p, t, c0 === 'a_start' ? 'start' : 'defy');
      if (c0 === 'a_start') {
        const ok = t.traits.violence < 0.6 || rng.chance(0.4);
        lines.push(ok ? `"You started it," you remind him. ${t.name} looks away. "Maybe. Maybe I did."` : `"You started it," you say. ${t.name}'s face hardens. "Don’t put this on me."`);
        bearOn(w, r, (ok ? -0.12 : 0.1), `${p.name} put the blame on him`);
        tweak(ok ? 0.02 : -0.03);
      } else {
        lines.push(`"I would do it again," you tell him. ${t.name} nods once, slowly, the way a man does when he has decided something.`);
        bearOn(w, r, 0.2, `${p.name} said he would do it again`);
        tweak(-0.1, -0.06, 0.02);
        t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'threat', text: `You told him to his face you would do it again.` });
      }
      return stay('amends', 20);
    }
    case 'a_ask': {
      c.ctx.asked.push('a_ask');
      const g = r.grudge;
      lines.push(g >= 0.5 ? `${t.name}: "You know exactly what you did. Or what you allowed."` : `${t.name} shrugs. "Word got round that you were against me. Maybe it was wrong."`);
      bearOn(w, r, -(0.07), 'talked');
      tweak(0.02);
      return stay('amends', 15);
    }
    case 'a_gift': {
      c.ctx.asked.push('a_gift');
      if (p.cash < 60) lines.push('You can’t spare it.');
      else {
        p.cash -= 60;
        lines.push(`You buy a round and say nothing about it. ${t.name} says nothing back, which is a start.`);
        bearOn(w, r, -(0.05), 'a drink');
        tweak(0.02, 0.03);
      }
      return stay('amends', 40);
    }
    case 'sh_why':
    case 'sh_how': {
      const b = ownerBiz(w, t.id)!;
      c.ctx.asked.push(c0);
      // What he says is a choice. A man who truly could not pay says so; a man who could have paid may claim he could not.
      // What you can see for yourself (the till, the street, the shelves) is what lets you tell the two apart.
      const why = b.protection!.why;
      const bad = c0 === 'sh_why' ? (why === 'unable' || (why === 'delayed' && w.rng.chance(clamp(0.35 + t.traits.greed * 0.35 - t.traits.courage * 0.2, 0.1, 0.8)))) : (b.distress > 0 || b.cash < b.protection!.fee);
      const hard = t.traits.caution > 0.5;
      lines.push(bad
        ? (hard ? `${t.name} looks at the floor. "It has been slow. I won’t lie to you, I was hoping you wouldn’t come this week."` : `${t.name} spreads his hands. "Look around. Nobody’s buying. You want blood from a stone?"`)
        : (c0 === 'sh_why' ? `${t.name} avoids your eyes. "I had it. I spent it. Stupid. It won’t happen again."` : `${t.name} brightens. "Busy. Good busy. Your name gets mentioned, you know that? People come in, they see it’s looked after."`));
      { const ev = evidence(w, b); if (ev.length) lines.push(`You look around while he talks. ${ev.join(' ')}`); }
      tweak(0.02);
      return stay('shop', 15);
    }
    case 'sh_ears': {
      const b = ownerBiz(w, t.id)!;
      c.ctx.asked.push('sh_ears');
      const f = Object.values(w.facts).filter((x) => x.business === b.id && ['vandalism', 'robbery', 'burglary', 'shake'].includes(x.kind) && w.now - x.t < 60 * DAY)[0];
      if (f) {
        lines.push(`${t.name} lowers his voice. "Funny you ask. ${told(w, t, f, !!f.actor && !f.hiddenActor)}"`);
        if (!p.known[f.id]) learn(w, p.id, f, t.id, !f.hiddenActor);
      } else lines.push(`${t.name}: "Nobody. Quiet as a church. That’s what I’m paying for, no?"`);
      tweak(0.02);
      return stay('shop', 15);
    }
    case 'sh_back': {
      const b = ownerBiz(w, t.id)!;
      c.ctx.asked.push('sh_back');
      const fee = b.protection!.fee;
      if (p.cash < fee) lines.push('You can’t afford the gesture.');
      else {
        p.cash -= fee;
        bizMove(w, b, fee, 'aid', p.id);
        b.distress = Math.max(0, b.distress - 1);
        lines.push(`You push the envelope back across. ${t.name} stares at it. "Nobody ever did that. Nobody." He means it.`);
        tweak(0.12, 0.1, 0.05);
      }
      return stay('shop', 15);
    }
    case 'sh_time': {
      const b = ownerBiz(w, t.id)!;
      giveTime(b);
      lines.push(`"One week," you say. ${t.name} nods too fast. He’ll pay, and he’ll remember who gave him the week.`);
      tweak(0.06, 0.04, -0.01);
      repute(w, p, -0.5, 'gave way');
      return stay('shop', 15);
    }
    case 'sh_lean': {
      const b = ownerBiz(w, t.id)!;
      const fee = Math.max(b.protection!.fee, owedOf(b));
      const pay = takeFromBiz(w, b, fee, p.id, true);
      if (pay > 0) earn(p, pay, 'protection');
      clearArrears(b);
      lines.push(`You say it quietly, which is worse. ${t.name} finds ${money(pay)} you both know he didn’t have to spare.`);
      tweak(-0.05, -0.06, 0.03);
      bearOn(w, r, 0.06, `${p.name} made him pay what he could not spare`);
      return stay('shop', 20);
    }
    case 'cr_ask': {
      c.ctx.asked.push('cr_ask');
      const open = r.trust + r.affection * 0.5 + w.rng.next() * 0.3 > 0.7;
      if (open && t.problem) {
        t.problem.revealed = true;
        lines.push(`${t.name} rubs his face. "Since you ask... it’s ${PROBLEM_LABEL[t.problem.kind]}. I didn’t want it getting back."`);
        tweak(0.05, 0.04);
      } else {
        lines.push(`${t.name} says everything is fine, too quickly. You’ll have to earn that answer.`);
        tweak(0.01);
      }
      return stay('crew', 20);
    }
    case 'cr_cash':
    case 'cr_duties': {
      lines.push(...helpMan(w, p, t, c0 === 'cr_cash' ? 'cash' : 'duties'));
      return stay('crew', 20);
    }
    case 'cr_drop': {
      c.ctx.asked.push('cr_drop');
      const h = lineOf(w, t);
      const st = arch(t);
      const owedMe = w.debts.find((d) => d.status === 'active' && d.creditor === t.id && d.missed >= 1);
      const recentArrest = t.career?.log.find((e) => /Arrested/.test(e.text) && w.now - e.t < 21 * DAY);
      const concealing = !!t.problem && !t.problem.revealed;
      const hiding = (st === 'proud' || st === 'bitter' || st === 'frightened') && concealing && r.trust < 0.7;
      if (hiding) {
        lines.push(rng.pick([`${t.name} shrugs. "Slow patch. It happens."`, `${t.name} looks past you. "Nothing to tell. Money comes and goes."`, `"It’s fine," ${t.name} says, a little too quickly.`]));
        tweak(-0.01);
      } else if (concealing && r.trust >= 0.7) {
        t.problem!.revealed = true;
        lines.push(`${t.name} is quiet a moment. "You’d find out. It’s ${PROBLEM_LABEL[t.problem!.kind]}. That’s where it’s going." He hasn’t said that to anyone else.`);
        tweak(0.06, 0.03);
      } else if (recentArrest) {
        lines.push(`${t.name}: "I was inside part of that. You know that. It cost me the week, and the lawyer cost me more."`);
      } else if (owedMe) {
        lines.push(`${t.name}: "${w.chars[owedMe.debtor]?.name ?? 'A man'} stopped paying me. I’m out ${money(owedMe.balance)} and I’ve got your share to find from somewhere."`);
      } else if (h && (h.bad ?? 0) >= 1 && h.cause) {
        lines.push(`${t.name}: "It’s the ${h.kind === 'shylock' ? 'loans' : 'business'}. ${h.cause.charAt(0).toUpperCase() + h.cause.slice(1)}. It’ll come back."`);
      } else {
        lines.push(`${t.name} spreads his hands. "Nothing I can point to. Some weeks are thin."`);
      }
      return stay('crew', 20);
    }
    case 'cr_look': {
      c.ctx.asked.push('cr_look');
      const h = lineOf(w, t);
      // (what you found is kept with what you know about him: talk.note)
      if (t.problem && !t.problem.revealed) {
        t.problem.revealed = true;
        lines.push(`Asking round his patch, the answer comes fast: it’s ${PROBLEM_LABEL[t.problem.kind]}. He didn’t want to say, and now you know why.`);
        note(p, t, `You looked into it: he is ${PROBLEM_LABEL[t.problem.kind]}.`);
      } else if ((p.books.flags[t.id]?.amt ?? 0) > 0) {
        lines.push(`You go through what you can see of his business. It doesn’t add up: about ${money(Math.round(p.books.flags[t.id].amt))} you can’t account for.`);
        note(p, t, `You looked into it: about ${money(Math.round(p.books.flags[t.id].amt))} of his doesn’t add up.`);
      } else if (h) {
        lines.push(`Nobody has a bad word for him. ${h.cause ? `It checks out: ${h.cause}.` : 'The business is just thin.'}`);
        note(p, t, `You looked into it: his business checks out${h.cause ? ` (${h.cause})` : ''}.`);
        tweak(0.02);
      } else { lines.push('Nothing turns up. He’s just having a bad run.'); note(p, t, 'You looked into it: nothing turned up. A bad run.'); }
      return { lines, minutes: 120, convo: { ...c } };
    }
    case 'cr_money': {
      c.ctx.asked.push('cr_money');
      lines.push(t.cash < 200
        ? rng.pick([`${t.name} laughs without much in it. "Fixed? I’m held together with string."`, `${t.name} looks at his shoes. "I could use a week of Sundays, to be honest."`, `"Don't ask me that on a Tuesday," ${t.name} says.`])
        : t.cash > 2500
          ? rng.pick([`${t.name} shrugs, a man with more than he wants to explain. "I get by."`, `${t.name} smiles with half his mouth. "Don’t worry about me."`])
          : rng.pick([`${t.name}: "All right. Not great, not terrible."`, `${t.name} tips a hand side to side. "So-so. Rent gets paid."`]));
      if (lineOf(w, t)) {
        const h = lineOf(w, t)!;
        lines.push(`He works ${enterpriseLine(w, t)}. ${h.last > 0 ? `Last week it left him about ${money(h.last)} after costs` : 'Last week it cost him'}${h.cause ? `: ${h.cause}` : ''}.`);
      }
      return stay('crew', 10);
    }
    case 'cr_thin': {
      lines.push(`"I’m watching you," you tell ${t.name}. He nods, and for a few days he’ll be on time.`);
      tweak(-0.04, -0.04, 0.02);
      t.cooldown.restraint = Math.max(t.cooldown.restraint ?? 0, w.now);
      return stay('crew', 10);
    }
    case 'source': {
      const f = w.facts[c.ctx.fact!];
      const k = t.known[f.id];
      c.ctx.asked.push('source');
      const src = k && k.from !== 'public' && k.from !== 'witness' && k.from !== 'self' ? w.chars[k.from] : undefined;
      lines.push(src ? `${t.name} thinks. "${src.name}. He was closer to it than I was."` : `${t.name} spreads his hands. "It was going round. You know how it is. Nobody owns a story like that."`);
      if (src && src.id !== p.id) feelAtLeast(w, p, src.id, 'trust', 0.1);
      return stay('incident', 10);
    }
    case 'rk_back': {
      const ok = r.trust >= 0.5 && r.respect >= 0.35;
      if (ok) {
        p.backer = t.id;
        addFavour(w, t.id, p.id, 2, 'agreed to speak for you');
        lines.push(`${t.name} studies you for a long moment. "I’ll say your name when it matters. If you shame me, I’ll also say that."`);
        tweak(0.03, 0, 0.03);
      } else {
        lines.push(`${t.name} shakes his head. "I don’t know you well enough to put my name on you. Come back when I do."`);
        tweak(-0.01);
      }
      return stay('root', 20);
    }
    case 'rk_back_ask': {
      lines.push(r.trust >= 0.7 ? `${t.name}: "I told them you’re solid. Don't make a liar of me."` : `${t.name} shrugs. "I said you’re coming along. That’s all I’ve said."`);
      return stay('root', 10);
    }
    case 'rv_ears': {
      c.ctx.asked.push(c0);
      const pool = Object.values(w.facts).filter((f) => !p.known[f.id] && t.known[f.id] && !f.minor && f.kind !== 'report');
      if (pool.length && rng.chance(clamp(0.3 + r.trust * 0.4 + r.respect * 0.2, 0.15, 0.8))) {
        const f = rng.pick(pool);
        learn(w, p.id, f, t.id, false);
        lines.push(`${t.name} looks around, then lowers his voice. "You didn’t hear it from me." You have a new piece of news to think about.`);
        tweak(0.02, 0.01);
      } else lines.push(rng.pick([`${t.name} says a lot about the weather and the Mets, and nothing else.`, `"I hear nothing," ${t.name} says. "That’s why I’m still here."`]));
      return stay('rival', 20);
    }
    case 'rv_drink': {
      c.ctx.asked.push(c0);
      if (p.cash < 30) { lines.push('You’re short.'); return stay('rival', 5); }
      p.cash -= 30;
      lines.push(`You buy ${t.name} a drink. Two men from different families, one bar. For an hour nobody is anybody’s enemy.`);
      tweak(0.03, 0.05, 0.02);
      return stay('rival', 40);
    }
    case 'rv_mood': {
      c.ctx.asked.push(c0);
      const tn = w.fam[p.familyId!]?.tension[t.familyId!] ?? 0;
      lines.push(tn > 3 ? `${t.name} sucks his teeth. "Bad. Men on both sides are counting who owes who. Somebody’s going to do something stupid."` : tn > 1 ? `${t.name} tips a hand. "Tense. Not a war. Yet."` : `${t.name}: "Quiet. I like quiet."`);
      return stay('rival', 10);
    }
    case 'rv_favour': {
      c.ctx.asked.push(c0);
      addFavour(w, p.id, t.id, 1, 'did him a good turn across family lines');
      lines.push(`You send a small kindness ${t.name}’s way. A man of another family now owes you, quietly. Your own people may not like that.`);
      tweak(0.06, 0.03, 0.02);
      p.heat = clamp(p.heat + 0.02, 0, 1.5);
      return stay('rival', 15);
    }
    case 'rv_warn': {
      c.ctx.asked.push(c0);
      playerActed(w, p, t, 'warn');
      lines.push(`"Keep off our ground," you tell ${t.name}. He smiles without warmth. "Message received. Pass mine to your boss."`);
      tweak(-0.06, -0.04, 0.03);
      if (p.familyId && t.familyId) { const A = w.fam[p.familyId], B = w.fam[t.familyId]; A.tension[t.familyId] = (A.tension[t.familyId] ?? 0) + 0.4; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + 0.4; }
      return stay('rival', 10);
    }
    case 'd_remind': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === t.id);
      if (!d) return stay('debt', 5);
      const pay = Math.min(d.weeklyPayment, Math.max(0, t.cash));
      const A = arch(t);
      if (pay >= d.weeklyPayment * 0.8 && rng.chance(0.55 + r.trust * 0.3)) {
        payDebt(w, d, pay);
        lines.push(rng.pick(A === 'proud' ? [`${t.name} stiffens. "You didn’t need to remind me." He pays ${money(pay)} on the spot, counting it like it hurts.`] : A === 'frightened' ? [`${t.name} goes pale and finds ${money(pay)} in his coat. "I was going to bring it, I swear."`] : [`${t.name} sighs and pays ${money(pay)}. "Fine. Fine. It was on my mind."`]));
        tweak(-0.01, -0.01);
      } else {
        lines.push(rng.pick(A === 'hothead' ? [`${t.name}: "You come to me about money like I’m a dog?" He walks off.`] : A === 'bitter' ? [`${t.name} laughs without humour. "Everybody wants something from me. You’ll get yours."`] : [`${t.name} spreads his hands. "I haven’t got it. Not this week."`]));
        tweak(-0.04, -0.03, 0.01);
      }
      return stay('debt', 15);
    }
    case 'd_time': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === t.id);
      if (d) { d.missed = Math.max(0, d.missed - 1); d.nextDue += 7 * DAY; }
      lines.push(`"One more week," you tell ${t.name}. He nods and hardly breathes. A man given time is a man who owes you something other than money.`);
      tweak(0.08, 0.05, -0.01);
      return stay('debt', 10);
    }
    case 'd_half': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === t.id);
      if (d) restructure(d, { payment: Math.max(25, d.weeklyPayment / 2) });
      lines.push(`You cut ${t.name}’s weekly payment in half. He says thank you the way a drowning man says it.`);
      tweak(0.06, 0.04);
      return stay('debt', 10);
    }
    case 'd_favour': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === t.id);
      if (d) { writeDown(w, d, 300); addFavour(w, p.id, t.id, 2, `wiped $300 of his debt`); }
      lines.push(`"Three hundred comes off," you tell ${t.name}. "One day I’ll come asking." He doesn’t ask what for. He knows better.`);
      tweak(0.05, 0.02, 0.02);
      return stay('debt', 10);
    }
    case 'd_forgive': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === t.id);
      if (d) writeDown(w, d, d.balance * 0.25);
      lines.push(`You knock a quarter off what ${t.name} owes. He looks at you like he’s waiting for the catch.`);
      tweak(0.07, 0.05, -0.01);
      repute(w, p, -0.5, 'gave way');
      return stay('debt', 10);
    }
    case 'd_pay':
    case 'd_all': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === t.id && x.debtor === p.id);
      if (!d) return stay('debt', 5);
      const amt = c0 === 'd_all' ? d.balance : Math.min(d.weeklyPayment, d.balance);
      if (p.cash < amt) { lines.push('You’re short.'); return stay('debt', 5); }
      payDebt(w, d, amt);
      lines.push(c0 === 'd_all' ? `You settle it in full. ${t.name} counts, nods, and says nothing, which is the nicest thing he’s ever said to you.` : `You pay ${money(amt)} on time. ${t.name} takes it without comment, and notes it.`);
      tweak(c0 === 'd_all' ? 0.08 : 0.04, 0.02, 0.03);
      return stay('debt', 10);
    }
    case 'd_ask': {
      c.ctx.asked.push(c0);
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === t.id && x.debtor === p.id);
      if (!d) return stay('debt', 5);
      lines.push(`You ask ${t.name.split(' ')[0]} for more time on what you owe him.`);
      // He weighs what you are worth to him against what a late payment says about you.
      const score = r.trust * 0.5 + r.respect * 0.35 + (d.missed === 0 ? 0.1 : -0.1 * d.missed);
      if (score >= 0.45) {
        d.nextDue += 7 * DAY;
        lines.push(`${t.name} thinks. “One week. Don’t make me ask twice.”`);
        tweak(0.0, 0, -0.01);
      } else if (score >= 0.2) {
        const X = goodFaith(d.balance, d.weeklyPayment);
        lines.push(vsay(w, t, p, 'ext_counter', { X: money(X) }));
        c.ctx.deal = { kind: 'ext', debt: d.id, ask: 0, offer: X };
        c.ctx.follow = [
          { code: 'deal:part', label: `Put down ${money(X)} now`, hint: p.cash >= X ? 'It buys the week, and he sees you’re serious.' : 'You haven’t got it on you.', big: true },
          { code: 'deal:drop', label: 'I’ll find it by the due date' },
        ];
        return stay('follow', 10);
      } else {
        lines.push(`${t.name} shakes his head slowly. “No. A debt that waits is a debt that grows.”`);
        tweak(-0.03, -0.02, -0.03);
      }
      return stay('debt', 10);
    }
    case 'b_envelope': {
      c.ctx.asked.push(c0);
      const due = envelopeDue(w, p);
      lines.push(envelopeText(w, p));
      for (const l of handOver(w, p, t, due)) lines.push(l);
      // He doesn’t take it and send you off. A man who brings his envelope in person gets a conversation.
      const a2 = arch(t);
      const rv = rng.next();
      if (rv < 0.4) {
        const f = Object.entries(t.known).filter(([id, k]) => !p.known[id] && w.facts[id] && !w.facts[id].minor && w.now - w.facts[id].t < 45 * DAY).map(([id, k]) => ({ f: w.facts[id], k }))[0];
        if (f) { learn(w, p.id, f.f, t.id, f.k.knowsActor); lines.push(`${t.name} leans back, and for a moment he’s almost chatty. "Since you’re here. Something you should know: ${told(w, t, f.f, f.k.knowsActor)}"`); }
        else lines.push(`${t.name} asks after your men, one by one. He listens to the answers more carefully than he lets on.`);
      } else if (rv < 0.65) {
        const before = w.jobs.length;
        if (bossOffer(w, true) || w.jobs.length > before) lines.push(`${t.name} puts the envelope away. "Good. While you’re here, there’s something that wants doing."`, jobSaid(w.jobs.at(-1)!));
        else lines.push(`${t.name} says there’s nothing for you right now, and means it as a compliment.`);
      } else {
        lines.push({ cold: `"You’re on time," ${t.name} says. From him, that’s a speech.`, proud: `${t.name} nods slowly. "A man who respects the arrangement. We’ll remember that."`, jovial: `${t.name} pours two coffees and asks about your week as though the envelope were an afterthought.`, schemer: `${t.name} asks who’s been doing well and who hasn’t. He wants names. You can see him writing the page.`, earnest: `${t.name} thanks you, and it sounds like he means it.`, hothead: `${t.name} grunts. "Good. Some of them make me ask twice."`, bitter: `${t.name} counts nothing. "At least somebody remembers how this is supposed to work."`, frightened: `${t.name} takes it quickly and looks at the door. He’s glad you came.` }[a2]);
      }
      return stay('myboss', 25);
    }
    case 'b_extra':
    case 'b_extra2': {
      c.ctx.asked.push(c0);
      const amt = c0 === 'b_extra' ? 250 : 1000;
      if (p.cash < amt) { lines.push('You’re short.'); return stay('myboss', 5); }
      p.cash -= amt; t.cash += amt; p.lifetimeKick += amt;
      tweak(amt >= 1000 ? 0.12 : 0.05, amt >= 1000 ? 0.06 : 0.02, 0.03);
      repute(w, p, (amt >= 1000 ? 3 : 1), 'tribute');
      if (amt >= 1000) addFavour(w, p.id, t.id, 2, 'a thousand dollars pressed into his hand with no reason given');
      lines.push(amt >= 1000 ? `You add another ${money(amt)}, unasked. ${t.name} looks at it, then at you. "That’s a lot of respect." He is very still. "I’ll remember it."` : `You add ${money(amt)} on top. ${t.name} raises an eyebrow, then lets it go. "Appreciated."`);
      return stay('myboss', 15);
    }
    case 'b_stand': {
      c.ctx.asked.push(c0);
      const pi = pathInfo(w, p);
      if (!pi) lines.push(`${t.name} looks at you for a long moment. "You’re where you should be. There’s nowhere higher for you to ask about."`);
      else {
        const trust = Math.round(r.trust * 100);
        lines.push(`${t.name} leans back. "You want to know? ${trust >= 70 ? 'I trust you. That’s rare.' : trust >= 45 ? 'You’re all right. Not more than that yet.' : 'I’m still deciding about you.'}"`);
        const left = pi.goals.filter((x) => !x.done);
        if (left.length) lines.push(`"To be a ${pi.to}," he says, "${left[0].tip.charAt(0).toLowerCase() + left[0].tip.slice(1)}"`);
        else lines.push(`"You've done what was asked. You'll hear from me."`);
      }
      tweak(0.01);
      return stay('myboss', 20);
    }
    case 'b_need': {
      c.ctx.asked.push(c0);
      const before = w.jobs.length;
      if (bossOffer(w, true) || w.jobs.length > before) lines.push(`${t.name} thinks a moment.`, jobSaid(w.jobs.at(-1)!));
      else lines.push(`${t.name} waves a hand. "Nothing now. Don’t look for work. It finds you."`);
      return stay('myboss', 15);
    }
    case 'b_tribute': {
      c.ctx.asked.push(c0);
      if (p.cash < 300) lines.push('You’re short.');
      else {
        p.cash -= 300; t.cash += 300; p.lifetimeKick += 300;
        lines.push(`You leave an envelope on his table. ${t.name} doesn’t open it. "For what?" "For nothing." He almost smiles. "Nothing is a good reason."`);
        tweak(0.07, 0.04, 0.03);
        repute(w, p, 1, 'gift');
      }
      return stay('myboss', 15);
    }
    case 'b_more': {
      c.ctx.asked.push(c0);
      const rd = readiness(w, p);
      const ok = rng.chance(clamp(0.15 + r.trust * 0.5 + p.standing / 250 + (rd?.earn ?? 0) * 0.15, 0.1, 0.85));
      if (ok) {
        const before = w.jobs.length;
        bossOffer(w, true);
        lines.push(`${t.name} studies you. "You want more? Fine. Don’t make me regret it."${w.jobs.length > before ? ' He has something bigger in mind, and he’ll send word.' : ''}`);
        tweak(0.0, 0, 0.03);
      } else {
        lines.push(`${t.name}: "You’re not ready for more. A man who asks for more before he’s handled what he’s got is asking for trouble."`);
        tweak(-0.02, 0, -0.02);
      }
      return stay('myboss', 20);
    }
    case 'chat': {
      const day = Math.floor(w.now / 1440), key = `chat:${t.id}`;
      if ((p.cooldown[key] ?? -1) >= day) { lines.push(vsay(w, t, p, 'chat_none')); return stay('root', 5); }
      p.cooldown[key] = day;
      const tier = openness(w, t, p);
      if (tier === 'hostile') { lines.push(vsay(w, t, p, 'chat_hostile')); return stay('root', 5); }
      if (tier === 'brush') { lines.push(vsay(w, t, p, 'chat_brush')); return stay('root', 5); }
      if (tier === 'general') {
        lines.push(vsay(w, t, p, 'chat_general'));
        if (!rng.chance(0.4)) return stay('root', 10);
      }
      const sup = RKN(t.rank) > RKN(p.rank) || t.id === p.bossId;
      const heard = share(w, t, p, lines, { partial: tier !== 'open', avoidActor: sup ? t.id : undefined, say: (f, k) => { const base = told(w, t, f, k); const mine = p.known[f.id]; const b = !k && mine?.blame ? w.chars[mine.blame] : undefined; return b ? `${base.replace(/[.!]?$/, '.')} If you ask me, it was ${b.name}.` : base; }, exclude: (f) => (tier === 'general' && (f.victim === t.id || f.actor === t.id)) || (tier === 'partial' && f.victim === t.id && HUMILIATING.has(f.kind)) });
      if (!heard.length) { if (tier !== 'general') lines.push(vsay(w, t, p, 'chat_none')); return stay('root', 10); }
      return { lines, minutes: 15, convo: { id: c.id, node: 'incident', ctx: { fact: heard[0].id, asked: [] } } };
    }
    case 'view': {
      const f = w.facts[c.ctx.fact!];
      c.ctx.asked.push('view');
      lines.push(`${t.name}: ${takeOn(w, t, p, f)}`);
      if (!involvedIn(w, t, f)) {
        const vc = f.victim ? w.chars[f.victim] : undefined;
        if (vc?.alive && vc.id !== p.id && vc.id !== t.id) lines.push(`${t.name}: “If it’s the whole of it you want, ask ${vc.name.split(' ')[0]}. He was there.”`);
      }
      if (f.victim === t.id && f.actor && f.actor !== p.id) {
        // What he is actually doing about it, from what he has actually set in motion.
        const up = (w.pending ?? []).find((q) => q.kind === 'dispute' && q.a === t.id && q.b === f.actor);
        const intent = (w.pending ?? []).find((q) => q.kind === 'intent' && q.a === t.id && q.b === f.actor);
        if (up && w.chars[up.c!]?.alive) lines.push(`${t.name}: “I’ve taken it to ${w.chars[up.c!].name}. He’s said he’ll raise it.”`);
        else if (intent) lines.push(r.trust >= 0.5 ? `${t.name} lowers his voice. “I’m not letting it lie. I’ll answer it my own way, in my own time.”` : `${t.name} looks past you. “I’ll see what’s to be done.”`);
      }
      return stay('incident', 8);
    }
    case 'tell_more': {
      const f = w.facts[c.ctx.fact!];
      c.ctx.asked.push('tell_more');
      const m = connected(w, t, p, f);
      if (!m) { lines.push(`${t.name} spreads his hands. “That’s all I’ve got, same as you.”`); return stay('incident', 5); }
      lines.push(`${t.name} thinks for a second. ${thenLine(f, m.g, inHisVoice(told(w, t, m.g, m.kk.knowsActor), t, m.g.victim === t.id || m.g.actor === t.id))}`);
      learn(w, p.id, m.g, t.id, m.kk.knowsActor);
      return stay('incident', 12);
    }
    case 'involve': {
      const RK = (x: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(x);
      const f = w.facts[c.ctx.fact!];
      c.ctx.asked.push('involve');
      if (f.kind === 'ruling' && !f.actor) {
        // The Commission and the houses: what he says depends on how far he trusts you with it, and on who he is.
        const need = ({ cold: 0.45, proud: 0.45, schemer: 0.45, bitter: 0.4, hothead: 0.3, jovial: 0.25, earnest: 0.25, frightened: 0.2 } as Record<string, number>)[arch(t)] ?? 0.35;
        if ((r.trust < need) && RK(t.rank) > RK(p.rank)) {
          lines.push(({ cold: `${t.name} says nothing for a moment. “That isn’t for you.”`, proud: `${t.name}: “Matters between houses are not discussed with men of your standing.”`, schemer: `${t.name} smiles. “Everyone wants to know that. Ask me again when I know what you’d do with it.”`, bitter: `${t.name}: “What’s it to you? You’ll find out when you’re told.”` } as Record<string, string>)[arch(t)] ?? `${t.name} looks round the room. “Not here. Not yet.”`);
          return stay('incident', 5);
        }
        const fams = Object.values(w.fam).filter((fm) => f.text.includes(fm.name));
        const ours = fams.some((fm) => fm.id === p.familyId);
        const ten = fams.length >= 2 ? (w.fam[fams[0].id].tension[fams[1].id] ?? 0) : 0;
        lines.push(ours ? `${t.name}: “That’s us, as far as anyone’s concerned. Whatever the table said, our people will be watched to see they keep to it.”` : ten >= 3 ? `${t.name}: “The paper’s on the table, but those two still hate each other. If it breaks, every house gets asked whose side it’s on.”` : `${t.name}: “For now it holds. We’re not a party to it, and I’d like to keep it that way.”`);
        return stay('incident', 10);
      }
      const dsp = (w.disputes ?? []).find((x) => x.fact === f.id || (!!f.story && x.id === f.story));
      const ac = f.actor ? w.chars[f.actor] : undefined, vc = f.victim ? w.chars[f.victim] : undefined;
      const ten = ac?.familyId && vc?.familyId && ac.familyId !== vc.familyId ? (w.fam[ac.familyId].tension[vc.familyId] ?? 0) : 0;
      if (dsp && (dsp.status === 'open' || dsp.status === 'violated')) lines.push(dsp.status === 'violated' ? `${t.name}: “Whatever was agreed, somebody broke it. That doesn’t end quietly.”` : `${t.name}: “It’s still open. Neither side has given an inch, and neither has gone to anybody who could settle it.”`);
      else if (ten >= 3) lines.push(`${t.name}: “Between those two houses? There’s more bad blood than this one thing. People are watching.”`);
      else if (!f.actor || !f.victim) lines.push(`${t.name} shakes his head. “If anyone knows, they’re not saying.”`);
      else lines.push(`${t.name}: “Not that I’ve heard. Which doesn’t mean it’s over.”`);
      return stay('incident', 8);
    }
    case 'can_do': {
      const f = w.facts[c.ctx.fact!];
      c.ctx.asked.push('can_do');
      const b = f.business ? w.biz[f.business] : undefined;
      const mine = b?.protection?.collectorId === p.id;
      const ac = f.actor ? w.chars[f.actor] : undefined;
      const pk = p.known[f.id];
      const mineToFix = f.victim === t.id || (!!b && ownerBiz(w, t.id)?.id === b.id);
      if (f.kind === 'levy' && f.actor && w.chars[f.actor]?.familyId === p.familyId) lines.push(`${t.name}: “It comes out of every envelope in the house, yours too. Pay it and keep your head down.”`);
      else if (mine) lines.push(`${t.name}: “It’s your envelope. That’s yours to sort out, and people will notice how.”`);
      else if (mineToFix && ac && ac.id !== p.id && pk?.knowsActor) lines.push(`${t.name}: “You could have a word with ${ac.name.split(' ')[0]}, or put the two of us across a table. Either way you’re putting your name to it.”`);
      else if (mineToFix) lines.push(`${t.name}: “Find out who first. After that, we’ll see.”`);
      else lines.push(`${t.name} considers you. “It isn’t yours to fix. Keep your ears open and your mouth shut. That’s the most useful thing I can tell you.”`);
      return stay('incident', 8);
    }
    case 'press': {
      const f = w.facts[c.ctx.fact!];
      c.ctx.asked.push('press');
      const give = rng.chance(clamp(0.15 + r.trust * 0.6 - t.traits.caution * 0.2, 0.05, 0.85));
      if (give) {
        c.ctx.denied = false;
        learn(w, p.id, f, t.id, true);
        lines.push(`${t.name} says nothing for a while. “All right. It was me. I’d sooner you heard it from me than from the street.”`);
        tweak(0.02);
      } else {
        lines.push(`${t.name}: “You’re pushing, ${addr(w, t, p)}. I said what I said.”`);
        bearOn(w, r, 0.04, `${p.name} kept pushing him`);
        tweak(-0.03, 0, -0.02);
      }
      return stay('incident', 8);
    }
    case 'drop': {
      lines.push(`${t.name} watches you let it go. “Good.”`);
      tweak(0.01);
      return stay('root', 5);
    }
    case 'p_how': case 'p_claim': case 'p_owner': case 'why': {
      const f = w.facts[c.ctx.fact!];
      c.ctx.asked.push(code);
      const b = f.business ? w.biz[f.business] : undefined;
      const mine = f.actor === t.id;
      const tr = r.trust;
      const said = (x: string) => lines.push(`${t.name}: “${x}”`);
      if (code === 'why') {
        const g = f.cause ? w.facts[f.cause] : undefined;
        if (g && t.known[g.id]) said(`It came out of something before it. ${inHisVoice(told(w, t, g, true), t, true)}`);
        else if (tr < 0.4) said('That’s my business.');
        else if (arch(t) === 'hothead') said('Because he had it coming. I’m not going to apologise for it.');
        else if (arch(t) === 'cold') said('Because it needed doing. I don’t go in for explaining myself.');
        else said('Everyone has their reasons. I had mine, and I’d rather keep them.');
        return stay('incident', 8);
      }
      if (!b) { said('That’s all there is to it.'); return stay('incident', 5); }
      if (code === 'p_how') {
        const before = Object.values(w.facts).filter((g) => g.id !== f.id && g.business === b.id && g.t <= f.t && t.known[g.id] && ['protection_refused', 'poach', 'vandalism'].includes(g.kind)).sort((x, y) => y.t - x.t)[0];
        const o = first1(w, b.ownerId);
        if (tr < 0.35) said('That’s between him and me.');
        else if (before?.kind === 'poach' && before.actor === t.id) { const old = before.victim ? first1(w, before.victim) : 'someone else'; said(mine ? `It was paying ${old}. It pays me now. That’s how it works.` : `It was paying ${old}. That ended.`); }
        else if (before?.kind === 'protection_refused') said(mine ? `${o} turned me down the first time. I went back.` : `I turned him down the first time. He came back.`);
        else if (before?.kind === 'vandalism') said(mine ? `There was trouble at the place. I won’t say more than that.` : `There was trouble at the place first. After that I agreed.`);
        else said(mine ? 'It’s an arrangement, and it’s in place. How it came about is nobody else’s business.' : 'It’s in place. I’d rather not go over how.');
        return stay('incident', 8);
      }
      if (code === 'p_claim') {
        // Only what the records hold: whoever it was taken from, and whoever has since moved in on it.
        const ps = Object.values(w.facts).filter((g) => g.kind === 'poach' && g.business === b.id && t.known[g.id] && g.id !== f.id);
        const since = ps.find((g) => g.actor && g.actor !== t.id && g.t > f.t), before = ps.find((g) => g.actor === t.id && g.victim);
        const cl = since?.actor ? w.chars[since.actor] : undefined, old = before?.victim ? w.chars[before.victim] : undefined;
        if (cl?.alive) said(`${cl.name} has muscled in on it since${cl.familyId ? ', one of the ' + famName(w, cl) + ' men' : ''}. That’s a claim, whatever else it is.`);
        else if (old?.alive && old.id !== t.id) said(mine ? `${old.name} had it before me. He may still think it’s his.` : `${old.name} had it before. I couldn’t say if he’s let it go.`);
        else said(mine ? 'Not that I’ve heard. If somebody thinks so, they haven’t said it to me.' : 'Not that I know of.');
        return stay('incident', 8);
      }
      // p_owner
      const o = w.chars[b.ownerId], pr = b.protection;
      const gr = o?.rels[t.id]?.grudge ?? 0;
      if (pr?.late) said(`He’s ${pr.late} week${pr.late === 1 ? '' : 's'} behind. I’m not saying more than that until I know why.`);
      else if (gr >= 0.3) said('He pays. He looks at me like he’s counting the days.');
      else if ((o?.rels[t.id]?.trust ?? 0) >= 0.4) said('He pays on the day, no fuss. We understand each other.');
      else said('He pays. He doesn’t say much, and I don’t ask him to.');
      return stay('incident', 8);
    }
    case 'who': {
      const f = w.facts[c.ctx.fact!];
      const a = w.chars[f.actor!];
      const hb = holdsBack(w, t, p, f, 'who');
      if (hb) { lines.push(hb); c.ctx.asked.push('who'); return stay('incident', 8); }
      learn(w, p.id, f, t.id, true);
      lines.push(involvedIn(w, t, f) ? `${t.name}: "It was ${a.name}${a.familyId ? ' of the ' + famName(w, a) + ' family' : ''}."` : `${t.name}: "Word is it was ${a.name}. Don’t quote me, I only know what got back to me."`);
      c.ctx.asked.push('who');
      return stay('incident', 10);
    }
    case 'how_much': {
      const f = w.facts[c.ctx.fact!];
      const hb = holdsBack(w, t, p, f, 'cost');
      if (hb) { lines.push(hb); c.ctx.asked.push('how_much'); return stay('incident', 5); }
      lines.push(`"${money(f.amount ?? 0)}," says ${t.name}.`);
      c.ctx.asked.push('how_much');
      return stay('incident', 5);
    }
    case 'witness': {
      const f = w.facts[c.ctx.fact!];
      const hb = holdsBack(w, t, p, f, 'witness');
      if (hb) { lines.push(hb); c.ctx.asked.push('witness'); return stay('incident', 8); }
      const seen = Object.values(w.chars).filter((x) => x.alive && x.id !== t.id && x.id !== p.id && x.known[f.id]?.from === 'witness');
      if (seen.length) {
        const names = seen.slice(0, 2);
        lines.push(`${t.name}: "${names.map((x) => x.name).join(' and ')} ${names.length > 1 ? 'were' : 'was'} there."`);
        for (const x of names) feelAtLeast(w, p, x.id, 'trust', 0.1);
      } else lines.push(`${t.name}: "Nobody I know of."`);
      c.ctx.asked.push('witness');
      return stay('incident', 10);
    }
    case 'find': {
      const f = w.facts[c.ctx.fact!];
      t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'question', text: `You said you would find out who was behind it: ${f.text}`, ref: f.id, due: w.now + 14 * DAY });
      tweak(0.04);
      lines.push(`${t.name} nods slowly. "I would appreciate that."`);
      c.ctx.asked.push('find');
      return stay('incident', 10);
    }
    case 'speak': {
      const f = w.facts[c.ctx.fact!];
      const a = w.chars[f.actor!];
      const j = mkJob(w, { kind: 'handle', title: `Speak to ${a.name} for ${t.name}`, brief: `You told ${t.name} you would see to ${a.name}. ${f.text}`, giver: t.id, via: 'tip', assignee: p.id, target: a.id, cause: f.id, pay: 0, status: 'active', days: 14 });
      t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'promise', text: `You promised to deal with ${a.name}.`, ref: j.id, due: w.now + 10 * DAY });
      tweak(0.06, 0.03);
      lines.push(`${t.name} looks relieved. "I knew I could count on you." He’s counting on you now.`);
      c.ctx.asked.push('speak');
      return stay('incident', 15);
    }
    case 'sitdown': {
      const f = w.facts[c.ctx.fact!];
      const a = w.chars[f.actor!];
      // One record per quarrel: if this complaint is already on the books, sit them down over that one. A new one is written only
      // if the sit-down actually takes place (a man who refuses to come leaves nothing behind).
      const have = w.grievances.find((q) => q.status === 'open' && ((q.cause === f.id) || (q.from === t.id && q.about === a.id)));
      const g: Grievance = have ?? { id: 'g' + w.nextId++, from: t.id, about: a.id, kind: f.kind === 'poach' ? 'territory' : 'violence', text: `${t.name} says ${a.name} wronged him: ${f.text}`, claim: f.amount ?? 0, valid: true, cause: f.id, status: 'open', created: w.now, postponed: 0 };
      c.ctx.asked.push('sitdown');
      lines.push(...sitdownTalk(w, p, t, a));
      if (!have) w.grievances.push(g); // the meeting looks it up by id, so it has to be on the books while it is set up
      const m = openSitdown(w, p, g);
      if (!have && typeof m === 'string') w.grievances.splice(w.grievances.indexOf(g), 1); // he wouldn't come: nothing is left behind
      return { lines, minutes: 15, convo: { id: c.id, node: 'incident', ctx: c.ctx }, meeting: m };
    }
    case 'suspect': {
      const g = grudgeTarget(w, t);
      if (!g) return stay('disputes', 5);
      const s = w.chars[g[0]];
      lines.push(`${t.name}: "If you want to know, I think it was ${s.name}."`);
      c.ctx.subject = s.id;
      return { lines, minutes: 20, convo: { id: c.id, node: 'subject', ctx: c.ctx } };
    }
    case 'tell': {
      const f = w.facts[arg];
      const s = w.chars[f.actor!];
      learn(w, t.id, f, p.id, true);
      bearOn(w, r, 0.15, `${p.name} told him who did it`);
      bear(w, t, s.id, 0.15, f);
      tweak(0.04);
      lines.push(`${t.name} goes very still. "I didn’t know that."`);
      return stay('subject', 15);
    }
    case 'exon': {
      const f = w.facts[arg];
      const s = w.chars[c.ctx.subject!];
      const real = f.actor ? w.chars[f.actor] : undefined;
      ease(t, s.id, 0.4);
      if (real) {
        learn(w, t.id, f, p.id, true);
        bear(w, t, real.id, 0.25, f);
      }
      tweak(0.05);
      lines.push(`${t.name} frowns. "Then I’ve been looking at the wrong man."`);
      return stay('subject', 15);
    }
    case 'handle': {
      const s = w.chars[c.ctx.subject!];
      c.ctx.asked.push('handle');
      const j = mkJob(w, { kind: 'handle', title: `${t.name} wants ${s.name} dealt with`, brief: `${t.name} has a grudge against ${s.name}. You offered to see to it. He hasn’t said what ${s.name} actually did.`, giver: t.id, via: 'tip', assignee: p.id, target: s.id, pay: 200, status: 'active', days: 14 });
      t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'promise', text: `You offered to deal with ${s.name}.`, ref: j.id, due: w.now + 10 * DAY });
      tweak(0.05);
      lines.push(`${t.name} nods. "I would pay for that."`);
      return stay('subject', 15);
    }
    case 'mediate2':
    case 'mediate': {
      const sid = c0 === 'mediate2' ? c.ctx.subject! : Object.entries(t.rels).filter(([id, q]) => q.grudge >= 0.3 && w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge)[0]?.[0];
      if (!sid) return stay('disputes', 5);
      const s = w.chars[sid];
      const have = w.grievances.find((q) => q.status === 'open' && ((q.from === t.id && q.about === s.id) || (q.from === s.id && q.about === t.id)));
      const g: Grievance = have ?? { id: 'g' + w.nextId++, from: t.id, about: s.id, kind: 'respect', text: `${t.name} and ${s.name} have a problem with each other. ${t.name} asked you to settle it.`, claim: 0, valid: rng.chance(0.5), status: 'open', created: w.now, postponed: 0 };
      c.ctx.asked.push('mediate');
      if (!have) w.grievances.push(g);
      const mm = openSitdown(w, p, g);
      if (!have && typeof mm === 'string') w.grievances.splice(w.grievances.indexOf(g), 1);
      // (he answers the offer before the table is set, or before you learn it can't be)
      lines.push(typeof mm === 'string' ? (temper(t).agreeable > 0.5 ? '“I’d come. I don’t know that he would.”' : '“Good luck getting him to sit down.”') : temper(t).pride > 0.6 ? '“Fine. But I’m not the one who should be apologising.”' : '“All right. If he comes, I’ll come.”');
      return { lines, minutes: 15, convo: { id: c.id, node: c.node, ctx: c.ctx }, meeting: mm };
    }
    case 'demand': {
      const f = w.facts[arg];
      const tough = t.traits.violence > 0.6 && t.rank !== 'associate';
      if (isSuperior(w, p, t) || (!tough && rng.chance(0.5 + r.trust * 0.3))) {
        const amt = Math.min(f.amount ?? 0, Math.max(0, t.cash));
        if (amt > 0 && f.victim === p.id) {
          t.cash -= amt;
          p.cash += amt;
        }
        lines.push(`${t.name} shifts. "All right. It got out of hand."${amt > 0 && f.victim === p.id ? ` He hands over ${money(amt)}.` : ''}`);
        tweak(0.02);
      } else {
        bearOn(w, r, 0.15, `${p.name} called him on it`);
        tweak(-0.05, -0.04, -0.02);
        lines.push(`${t.name} laughs without humour. "Who are you to ask me?"`);
        t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind: 'threat', text: `You demanded an explanation from him. He didn’t take it well.` });
      }
      return stay('disputes', 20);
    }

    // ---- orders
    case 'work': {
      const before = w.jobs.length;
      if (t.id === p.bossId) bossOffer(w, true);
      else if (rng.chance(0.35 + r.trust * 0.5)) tipFrom(w, t) || oppFrom(w, t);
      lines.push(vsay(w, t, p, w.jobs.length > before ? 'work_some' : t.id === p.bossId ? 'work_boss_none' : 'work_none'));
      if (w.jobs.length > before) lines.push(jobSaid(w.jobs.at(-1)!)); // (V90: the work itself, said)
      return stay('orders', 25);
    }
    case 'assign_low': {
      t.heat = Math.max(0, t.heat - 0.2);
      tweak(-0.01);
      lines.push(`${t.name} nods. He’ll stay out of sight for a while.`);
      return stay('orders', 15);
    }
    case 'assign_hustle': {
      if (!t.books.side) t.books.side = rng.int(80, 220);
      t.books.sideKnown = true;
      t.heat = clamp(t.heat + 0.1, 0, 1.5);
      lines.push(`${t.name} grins. "I know a couple of things." It will show in his books from now on.`);
      return stay('orders', 15);
    }
    case 'report': {
      const rep = w.jobs.filter((j) => j.status === 'done' && j.giver === t.id && j.assignee === p.id && !j.reported).slice(0, 2);
      for (const j of rep) j.reported = true;
      tweak(0.03 * rep.length, 0, 0.02 * rep.length);
      repute(w, p, rep.length, 'report');
      lines.push(`You walk ${t.name} through what you did. He seems satisfied. (standing +${rep.length})`);
      return stay('orders', 20);
    }
    case 'challenge': {
      const j = w.jobs.find((q) => q.id === arg) as Job;
      const cause = j.cause ? w.facts[j.cause] : undefined;
      if (cause && j.target) {
        const k = t.known[cause.id];
        const s = w.chars[j.target];
        if (k?.knowsActor && cause.actor === s.id) lines.push(`${t.name}: "He did it. I’m certain." You believe him.`);
        else if (k && !k.knowsActor) lines.push(`${t.name} hesitates. "I can’t prove it was ${s.name}. But who else would it be?" He’s guessing.`);
        else lines.push(`${t.name} won’t say how he knows.`);
      } else lines.push(`${t.name}: "Because I said so." That’s all you get.`);
      tweak(-0.01);
      return stay('orders', 15);
    }
    case 'refuse': {
      const j = w.jobs.find((q) => q.id === arg) as Job;
      j.status = 'declined';
      tweak(-0.1, -0.04, -0.06);
      repute(w, p, -((j.via === 'boss' ? 5 : 2)), 'refused work');
      lines.push(`${t.name} doesn’t argue. That’s worse. "Noted."`);
      return stay('orders', 15);
    }

    // ---- memos
    case 'memo': {
      const m = t.memos.find((q) => q.id === arg)!;
      if (m.kind === 'promise' && m.ref) {
        const j = w.jobs.find((q) => q.id === m.ref);
        lines.push(j?.status === 'done' ? `${t.name}: "You came through. Thank you."` : `${t.name}: "You said you would see to it."`);
        if (j?.status === 'done') m.done = true;
      } else {
        // (V90: what he says about it, from what it is and how he is with you, not the record read back)
        const tp = temper(t), hot = tp.volatility + tp.pride > 1.15;
        lines.push(m.kind === 'agreement' ? (r.grudge >= 0.3 ? '“We had an understanding. I’m starting to wonder whether you remember it.”' : '“We have an understanding. Nothing’s changed on my side.”')
          : m.kind === 'threat' ? (hot ? '“I remember what you said. I haven’t forgotten, and I won’t.”' : tp.caution > 0.6 || r.fear ? '“I haven’t forgotten. I don’t want any trouble.”' : '“I remember. Let’s leave it there.”')
          : m.kind === 'question' ? '“Well? Did you find anything out?”'
          : m.kind === 'favour' ? '“I haven’t forgotten what I owe you.”' : '“I remember.”');
      }
      return stay('memos', 10);
    }
    case 'answer': {
      const m = t.memos.find((q) => q.id === arg)!;
      const f = w.facts[m.ref!];
      learn(w, t.id, f, p.id, true);
      m.done = true;
      tweak(0.1, 0.04, 0.05);
      repute(w, p, 1, 'told');
      if (f.actor) bear(w, t, f.actor, 0.3, f);
      lines.push(`${t.name} listens, then nods once. "You kept your word. I’ll remember that."`);
      return stay('root', 20);
    }
  }
  return stay();
}

// A soft first approach on a shopkeeper in conversation.
function softLean(w: World, p: Character, t: Character, bizId: Id, lines: string[]): { minutes: number } {
  const b = w.biz[bizId];
  b.lastApproach = w.now;
  const pr = clamp(0.3 + p.traits.sociability * 0.2 + rel(t, p.id).trust * 0.3 - t.traits.courage * 0.3, 0.1, 0.8);
  if (w.rng.chance(pr)) {
    const fee = Math.round((b.income * 0.07) / 5) * 5;
    setCollector(w, b, p.id, p.familyId!, { fee });
    lines.push(`${t.name} thinks about it. "Maybe it wouldn’t hurt to have friends." He agrees to ${money(fee)} a week.`);
    addFact(w, { kind: 'protection_started', actor: p.id, victim: t.id, business: b.id, amount: fee, text: `${p.name} now collects ${money(fee)} a week from ${b.name}.`, district: b.district }, { witnesses: [] });
  } else lines.push(`${t.name} smiles and says he’s fine as he is.`);
  return { minutes: 35 };
}

function promotionLines(w: World, p: Character, t: Character): string[] {
  const higher = ['soldier', 'capo', 'underboss', 'boss'].includes(t.rank);
  if (!higher) return [`${t.name} laughs. "I’m hardly the man to ask."`];
  const r = readiness(w, p);
  if (!r) return [`${t.name}: "There’s only one chair above you. Think carefully about what you’re asking."`];
  const out: string[] = [];
  if (r.earn < 1) out.push(`${t.name}: "You have passed up ${money(p.lifetimeKick)} so far. Nobody puts a name forward on that."`);
  else out.push(`${t.name}: "Your numbers are right."`);
  if (!r.sponsor) out.push(p.rank === 'associate' && p.bossId === t.id ? `"I have to be able to stand up and say you’re sound. I can’t say that yet."` : `"It’s not me you need to convince. It’s the man who answers for you."`);
  if (!r.openSeat) out.push(`"And there’s no room. Somebody has to die, retire or get locked up first."`);
  if (p.standing < 45) out.push(`"People are talking, and not well."`);
  out.push(`He thinks you’re ${standingWord(p.standing)}.`);
  return out;
}

// ----------------------------------------------------------------- memory

// Promises have a day of reckoning. A man who breaks his word is remembered for it.
export function memoTick(w: World) {
  for (const c of Object.values(w.chars)) {
    if (!c.alive || !c.memos.length) continue;
    for (const m of c.memos) {
      if (m.done || !m.due || m.due > w.now) continue;
      const p = w.chars[m.other];
      if (!p) continue;
      let kept = false;
      if (m.kind === 'promise' && m.ref) kept = w.jobs.find((j) => j.id === m.ref)?.status === 'done';
      else if (m.kind === 'promise') kept = p.books.arrears === 0;
      else if (m.kind === 'question' && m.ref) kept = !!p.known[m.ref]?.knowsActor && !!c.known[m.ref]?.knowsActor;
      m.done = true;
      if (kept) continue;
      feel(w, c, p.id, 'trust', -0.1);
      feel(w, c, p.id, 'respect', -0.06);
      if (p.isPlayer) repute(w, p, -1, 'broke word');
      addFact(w, { kind: 'ruling', actor: p.id, victim: c.id, minor: true, text: `${p.name} didn’t keep his word to ${c.name}.`, district: c.district }, { witnesses: [c.id] });
    }
    if (c.memos.length > 24) c.memos = c.memos.filter((m) => !m.done).slice(-24);
  }
}
