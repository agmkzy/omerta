// What a man has on his mind (Gate 4: talk.ts, moved into the conversation layer; everything it does to the world goes through
// doors.ts). V89: what a man has on his mind. Everyone in the city has things worth talking about, whether or not he is caught up in anything:
// his troubles, his shop or his racket, what he wants out of life, the men he can't stand and the men he admires, his family, the
// man he works for. Each is worked out from the world as it is (his books, his debts, his grudges, his kin, his plans), so no two
// men have the same conversation, and the same man has a different one when his life has moved on.
//
// A subject is a short exchange: he says something, you answer, he answers that, and so on for a turn or two. What you say does
// something real: it moves how he feels about you, it teaches you what he knows, and it can put something new in the world: a
// loan, a favour owed, a promise you will be held to, an introduction, an offer for his shop, a rival made by a careless word.
// He remembers how it went, and the next time you raise it he picks up where you left off.
import { lineOf } from '../../rackets';
import { FEMALE } from '../../names';
import { temper } from '../../temper';
import { askBetween, mayAsk, openAsks } from '../../asks';
import { money, ownerBiz, peek, rel } from '../../core';
import { agencyOf } from '../../goals';
import { closeKin, kinOf, kinTie } from '../../kin';
import { feePosition } from '../../negotiate';
import { LADDER } from '../../rank';
import { isOpen } from '../../situ';
import { Character, DAY, Id, World } from '../../types';
import { arch, type Arch } from '../../voice';
import { surname } from '../../voicesheet';
import * as door from '../doors';
import { chance, term } from '../decide';

export interface Choice { code: string; label: string; hint?: string; big?: boolean }
export interface Beat { lines: string[]; choices: Choice[]; minutes?: number; go?: { node: string; subject?: Id; fact?: Id } }
export interface X { w: World; p: Character; t: Character }
export interface Subject {
  key: string;
  weight: number; // how much it is on his mind (and how much he would say to you about it)
  sig: string; // what it looks like now; if it has changed since you last talked about it, it is news again
  label: string; hint: string; // how you bring it up
  nudge?: string; // what he lets slip on his own when it is weighing on him
  open: (x: X) => Beat;
  reply: (x: X, code: string) => Beat;
}

// ------------------------------------------------------------------ helpers
const first = (c: Character) => c.name.split(' ')[0];
const rk = (c: Character) => Math.max(0, LADDER.indexOf(c.rank));
const live = (w: World, id?: Id | null) => { const c = id ? w.chars[id] : undefined; return c?.alive ? c : undefined; };
export const by = (t: Character, m: Partial<Record<Arch, string>> & { _: string }) => m[arch(t)] ?? m._;
export const q = (t: Character, s: string) => `${first(t)}: “${s}”`;
// (V90: one man's way of saying a thing, out of several: the same man says it the same way each time, two men rarely alike)
export const vary = (t: Character, salt: string, xs: string[]) => { let h = 2166136261; for (const ch of t.id + '~' + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return xs[(h >>> 0) % xs.length]; };
// what he calls you: family by your first name, everyone else by your surname
export const addr = (w: World, t: Character, p: Character) => (kinTie(w, t, p) ? first(p) : surname(p));
const day = (w: World) => Math.floor(w.now / DAY);
export const mem = (t: Character, k: string) => t.talk?.[k];
export const remember = (w: World, t: Character, k: string, sig: string) => door.talkNote(w, t, k, sig);
export const said = (w: World, t: Character, key: string, code: string) => remember(w, t, 'tkc:' + key, code);
export const lastSaid = (t: Character, key: string) => mem(t, 'tkc:' + key)?.sig;
export const done = (key: string): Choice => ({ code: `tk:${key}:end`, label: '“Let’s leave it there.”' });
export const ch = (key: string, code: string, label: string, hint?: string, big?: boolean): Choice => ({ code: `tk:${key}:${code}`, label, hint, big });
export const trust = (x: X) => Math.max(peek(x.t, x.p.id).trust, candour.who === x.t.id ? candour.v : 0);
// Gate 3: how freely a man talks about his own life to someone he has been getting to know, set by the new conversation screen
// while he talks (conv/visit.ts candourOf); unset, it is trust alone, as before
const candour = { who: '', v: 0 };
export function withCandour<T>(who: Id, v: number, f: () => T): T { const was = { ...candour }; candour.who = who; candour.v = v; try { return f(); } finally { Object.assign(candour, was); } }
const warm = (x: X, amt: number, kind: string) => door.esteem(x.w, x.t, x.p, 'affection', amt, kind);
// What he has told you, in plain words, kept with what you know about him (shown beside the conversation). Only ever what he said
// or showed you, never what the world knows about him privately. Bounded: the latest few.
export function note(p: Character, t: Character, text: string) { door.noteOn(p, t, text); }
export const notesOf = (p: Character, t: Character) => (p.insight?.[t.id] ?? []).filter((x) => x.startsWith('n:')).map((x) => x.slice(2));
const knowsPlayer = (w: World, a: Character, b: Character) => !!a.rels[b.id] || !!b.intro?.[a.id];

// ================================================================== his troubles
const TROUBLE: Record<string, { hidden: string; told: (x: X) => string; need?: (x: X) => number }> = {
  gambling: { hidden: 'Cards. Horses. You know how it goes.', told: (x) => by(x.t, { proud: 'I’m into a book for more than I make in a month. I’ll win it back. I always do.', frightened: 'I owe the book. A lot. They’ve stopped being polite about it.', jovial: 'The horses hate me. I keep going back anyway. It’s getting expensive.', _: 'I’m behind with the book. Further than I like.' }), need: (x) => Math.round((200 + x.t.problem!.sev * 500) / 50) * 50 },
  debt: { hidden: 'Money. Everybody’s got money trouble.', told: (x) => by(x.t, { frightened: 'I borrowed from the wrong man, and he wants it back faster than I can earn it.', proud: 'I took money from somebody I shouldn’t have. I’ll handle it.', _: 'I owe the wrong people. They know where I live.' }), need: (x) => Math.round((300 + x.t.problem!.sev * 600) / 50) * 50 },
  family: { hidden: 'Home. Never mind.', told: (x) => by(x.t, { earnest: 'My wife’s mother is sick, and my wife is with her, and the kids are with me. I haven’t slept.', cold: 'Things at home are bad. That’s all.', _: 'It’s my family. Somebody’s sick, and I’m stretched thin.' }) },
  drink: { hidden: 'I’m fine. A little tired.', told: (x) => by(x.t, { proud: 'I drink a little more than I should. I can stop when I want.', bitter: 'A man has to get through the night somehow.', _: 'I’ve been drinking too much. I know it.' }) },
  house: { hidden: 'Plans. Just plans.', told: (x) => by(x.t, { schemer: 'I’m putting money aside. A house out of the city, a different life. Don’t repeat it.', _: 'I want a house in Jersey. A yard. I’m saving every dollar.' }) },
  resentment: { hidden: 'Nothing. Forget it.', told: (x) => { const b = live(x.w, x.t.bossId); return by(x.t, { bitter: `I carry more than my share and somebody else counts it. ${b ? first(b) + ' knows what I mean.' : ''}`, hothead: 'I’m sick of being the one who does the work while other men get the credit.', _: 'I don’t get what I’m worth. That’s the long and the short of it.' }); } },
  woman: { hidden: 'Don’t ask.', told: (x) => by(x.t, { jovial: 'There’s a girl. She’s not my wife. She’s expensive and she’s worth it, mostly.', frightened: 'There’s a woman, and if my wife finds out I’m finished.', _: 'There’s a woman I shouldn’t be seeing. It costs.' }), need: () => 250 },
};
function trouble(x: X): Subject | undefined {
  const { w, p, t } = x, pr = t.problem;
  if (!pr || t.isPlayer) return undefined;
  const T = TROUBLE[pr.kind];
  if (!T) return undefined;
  const key = 'trouble';
  const sig = pr.kind + ':' + Math.round(pr.sev * 4);
  const before = mem(t, 'tk:' + key);
  const helped = lastSaid(t, key);
  return {
    key, sig, weight: 0.35 + pr.sev * 0.5 + (arch(t) === 'frightened' || arch(t) === 'earnest' ? 0.1 : 0),
    label: pr.revealed ? `“How are you managing with ${pr.kind === 'gambling' ? 'the book' : pr.kind === 'debt' ? 'what you owe' : pr.kind === 'family' ? 'things at home' : pr.kind === 'drink' ? 'the drinking' : pr.kind === 'house' ? 'the money for the place' : pr.kind === 'woman' ? 'the woman' : 'it all'}?”` : '“What’s weighing on you?”',
    hint: pr.revealed ? 'He told you before. See where it stands.' : 'Something is. He may not say.',
    nudge: pr.sev > 0.55 && trust(x) >= 0.4 ? by(t, { frightened: `${first(t)} keeps looking at the door.`, proud: `${first(t)} is trying hard to look like a man with nothing on his mind.`, _: `${first(t)} looks like he hasn’t slept.` }) : undefined,
    open: (x) => {
      if (before && before.sig === sig && helped) return { lines: [q(t, helped === 'gift' || helped === 'lend' ? 'Still the same. But what you did helped. I haven’t forgotten it.' : helped === 'straighten' ? 'I’m trying. Like you said.' : 'Same as it was.')], choices: [done(key)], minutes: 10 };
      if (!pr.revealed && trust(x) < 0.45) return { lines: [q(t, T.hidden)], choices: [ch(key, 'press', '“Something’s wrong. I can see it.”', 'He may open up. He may resent being pushed.'), done(key)] };
      return reveal(x);
    },
    reply: (x, code) => {
      if (code === 'press') {
        const ok = p.skills.charm * 0.5 + trust(x) * 0.6 + (arch(t) === 'earnest' || arch(t) === 'frightened' ? 0.15 : 0) - (arch(t) === 'proud' || arch(t) === 'cold' ? 0.2 : 0) > 0.42;
        if (!ok) { door.regard(w, t, p.id, 'respect', -0.02); return { lines: [q(t, by(t, { proud: 'I said it’s nothing. Leave it.', hothead: 'You deaf? Drop it.', _: 'Another time, maybe.' }))], choices: [] }; }
        return reveal(x);
      }
      const amt = T.need?.(x) ?? 0;
      if (code === 'gift' && p.cash >= amt) {
        door.conduct(p, 'generous'); // (V90: it shows what kind of man you are)
        door.gift(w, p, t, amt, 'to help him'); door.easeProblem(t, -0.3); said(w, t, key, 'gift');
        door.owe(w, p, t, amt >= 400 ? 2 : 1, `you helped him when he was ${pr.kind === 'debt' || pr.kind === 'gambling' ? 'in over his head' : 'short'}`);
        warm(x, 0.08, 'helped'); door.esteem(w, t, p, 'trust', 0.05, 'helped');
        // a gambler with money in his pocket is a gambler
        if (pr.kind === 'gambling' && t.traits.vice > 0.65) door.easeProblem(t, 0.2);
        return { lines: [`You count ${money(amt)} into his hand.`, q(t, by(t, { proud: 'I’ll pay you back. Every cent. I want you to know that.', jovial: 'You’re a prince. A real prince.', cold: 'I won’t forget this.', _: 'I don’t know what to say. Thank you.' })), 'He owes you now, and he knows it.'], choices: [] };
      }
      if (code === 'lend' && p.cash >= amt && !w.debts.some((d) => d.status === 'active' && d.creditor === p.id && d.debtor === t.id)) {
        door.easeProblem(t, -0.25); said(w, t, key, 'lend');
        const d = door.friendLoan(w, p, t, amt, 0.04, 'a loan between friends')!;
        warm(x, 0.04, 'helped');
        return { lines: [`You lend him ${money(amt)}, four percent a week.`, q(t, `${money(d.weeklyPayment)} a week. You’ll have it. You have my word.`)], choices: [] };
      }
      if (code === 'straighten') {
        said(w, t, key, 'straighten');
        const takes = arch(t) === 'earnest' || arch(t) === 'frightened' || t.traits.caution > 0.6;
        if (takes) { door.easeProblem(t, -0.1); door.regard(w, t, p.id, 'respect', 0.03); return { lines: [q(t, 'You’re right. I know you’re right.')], choices: [] }; }
        door.grudge(w, t, p.id, 0.04, `${p.name} told him to straighten himself out`);
        return { lines: [q(t, by(t, { proud: 'I didn’t ask for a sermon.', hothead: 'Who are you to tell me?', _: 'Easy for you to say.' }))], choices: [] };
      }
      if (code === 'listen') { said(w, t, key, 'listen'); warm(x, 0.05, 'listened'); return { lines: [`You let him talk. He talks for a long time, and seems lighter for it.`], choices: [], minutes: 40 }; }
      if (code === 'time') {
        said(w, t, key, 'time'); door.cool(t, 'leave', w.now + 7 * DAY); warm(x, 0.07, 'leave'); door.esteem(w, t, p, 'trust', 0.04, 'leave');
        return { lines: ['You tell him to take the week. The crew will cover.', q(t, 'I won’t forget this.')], choices: [] };
      }
      return { lines: [], choices: [] };
    },
  };
  function reveal(x: X): Beat {
    const { w, p, t } = x, pr = t.problem!;
    door.revealProblem(t); door.insight(p, t.id, 'problem');
    note(p, t, ({ gambling: 'In deep with a bookmaker.', debt: 'Owes money to the wrong people.', family: 'Trouble at home. Someone is sick.', drink: 'Drinks more than he should, and knows it.', house: 'Saving every dollar for a house out of the city.', resentment: 'Feels he isn’t paid what he’s worth.', woman: 'Seeing a woman who isn’t his wife.' } as Record<string, string>)[pr.kind] ?? 'Has troubles of his own.');
    const amt = T.need?.(x) ?? 0;
    const cs: Choice[] = [];
    const owes = w.debts.some((d) => d.status === 'active' && d.creditor === p.id && d.debtor === t.id);
    if (amt && p.cash >= amt) { cs.push(ch('trouble', 'gift', `“Here. ${money(amt)}. No strings.”`, 'He will owe you, and he will know it.', true)); if (!owes) cs.push(ch('trouble', 'lend', `“I can lend you ${money(amt)}.”`, 'Four percent a week. A friend’s rate, and a debt all the same.', true)); }
    if (pr.kind === 'family' && t.bossId === p.id) cs.push(ch('trouble', 'time', '“Take a week. Sort it out.”', 'He earns nothing for you while he is gone. He will remember it.'));
    if (pr.kind !== 'house') cs.push(ch('trouble', 'straighten', '“You need to straighten yourself out.”', 'Some men need to hear it. Some men hate hearing it.'));
    cs.push(ch('trouble', 'listen', '“Go on. I’m listening.”', 'Sometimes that is all a man wants.'));
    void w;
    return { lines: [q(t, T.told(x))], choices: cs };
  }
}

// ================================================================== his shop
function shop(x: X): Subject | undefined {
  const { w, p, t } = x, b = ownerBiz(w, t.id);
  if (!b || !b.open || b.kind === 'casino') return undefined;
  const key = 'shop';
  const acct = (b.acct ?? []).slice(-3);
  const trend = acct.length >= 2 ? acct[acct.length - 1].revenue - acct[0].revenue : 0;
  const col = b.protection ? live(w, b.protection.collectorId) : undefined;
  const fee = b.protection && b.protection.collectorId !== t.id ? b.protection.fee : 0;
  const heavy = fee > 0 && fee > feePosition(b).cap;
  const sore = col ? peek(t, col.id).grudge > 0.15 || heavy : false;
  const rival = Object.values(w.biz).find((o) => o.open && o.id !== b.id && o.kind === b.kind && o.district === b.district && (o.acct?.at(-1)?.revenue ?? o.income) > (b.acct?.at(-1)?.revenue ?? b.income));
  const sig = `${b.distress}:${Math.sign(Math.round(trend / 50))}:${fee}:${b.damaged > 0}`;
  return {
    key, sig, weight: 0.3 + (b.distress > 0 ? 0.25 : 0) + (heavy ? 0.15 : 0) + (b.damaged > 0 ? 0.2 : 0),
    label: `“How’s the place doing?”`, hint: 'His trade, his costs, his worries. A man talks about his business.',
    nudge: b.damaged > 0 ? `${first(t)} is still sweeping glass at ${b.name}.` : b.distress > 1 ? `${first(t)} looks like a man doing sums in his head.` : undefined,
    open: () => {
      const how = b.damaged > 0 ? 'Since they smashed the place, people walk past. They think it could happen while they’re eating.'
        : b.distress > 1 ? 'I’m behind on everything. The supplier, the rent, all of it.'
        : trend < -40 ? 'Slower every week. I don’t know where they’ve all gone.'
        : trend > 40 ? by(t, { jovial: 'Busy! Run off my feet. Can’t complain, so I won’t.', bitter: 'Better. Not that anybody lets me keep it.', _: 'Better than it was. Touch wood.' })
        : 'Steady. Nothing to write home about.';
      const lines = [q(t, how)];
      note(p, t, b.damaged > 0 ? `${b.name} was smashed up, and trade hasn’t come back.` : b.distress > 1 ? `${b.name} is behind on everything.` : trend < -40 ? `Says trade at ${b.name} is falling off.` : trend > 40 ? `Says ${b.name} is doing better.` : `Says ${b.name} is steady.`);
      if (fee && col) note(p, t, sore ? `Pays ${col.name} ${money(fee)} a week, and doesn’t hide that he minds.` : `Pays ${col.name} ${money(fee)} a week.`);
      if (fee && col) lines.push(sore ? `He mentions the envelope for ${first(col)} without being asked, and his mouth goes thin.` : `The envelope goes to ${first(col)} every week. He says it like the weather.`);
      const cs: Choice[] = [];
      if (rival) cs.push(ch(key, 'rival', '“Who’s taking your trade?”', 'He will have a name.'));
      if (fee && col && col.id !== p.id && col.familyId !== null) cs.push(ch(key, 'col', `“How do you get on with ${first(col)}?”`, 'How a man feels about who he pays is worth knowing.'));
      // a shop nobody of yours looks after is an opening, raised as part of talking about the place
      if (p.familyId && b.protection?.familyId !== p.familyId && !(fee && col && sore) && t.rank === 'civilian') cs.push(ch(key, 'friends', '“A place like this could use some friends.”', b.protection ? 'He pays someone already. You would be asking him to change.' : 'Nobody looks after him. Yet.', true));
      if ((b.distress > 0 || b.cash < 300) && p.cash >= 500) cs.push(ch(key, 'invest', '“I could put some money in.”', 'A loan, on the books. He may want less, or nothing.'));
      cs.push(done(key));
      return { lines, choices: cs };
    },
    reply: (x, code) => {
      if (code === 'rival' && rival) {
        const o = w.chars[rival.ownerId];
        said(w, t, key, 'rival');
        const cs: Choice[] = [];
        if (o?.alive && o.id !== p.id && p.familyId) cs.push(ch(key, 'word', `“Want me to have a word with ${first(o)}?”`, 'A promise. He will hold you to it.', true));
        cs.push(done(key));
        if (o) note(p, t, `Says ${o.name} at ${rival.name} is taking his trade.`);
        return { lines: [q(t, `${rival.name}, on the next block. ${o ? first(o) : 'He'} undercuts me and smiles about it.`)], choices: cs };
      }
      if (code === 'word' && rival) {
        const o = w.chars[rival.ownerId];
        door.promiseToHandle(w, p, t, o, { title: `Speak to ${o.name} for ${t.name}`, brief: `${t.name} says ${o.name} at ${rival.name} is taking his trade. You said you would have a word.`, pay: 0, memo: `You said you would have a word with ${o.name} at ${rival.name}.` });
        door.grudge(w, t, o.id, 0.05, `he has taken ${t.name}'s trade`); said(w, t, key, 'word'); warm(x, 0.04, 'promised');
        return { lines: [q(t, 'You’d do that? I’d owe you.'), 'You have given your word. It is on your list.'], choices: [] };
      }
      if (code === 'col' && b.protection) {
        const c = live(w, b.protection.collectorId);
        said(w, t, key, 'col');
        if (!c) return { lines: [], choices: [] };
        if (!sore || trust(x) < 0.35) return { lines: [q(t, by(t, { frightened: 'Fine. Fine. Everything’s fine with him.', _: `${first(c)}? We get along. I pay, he goes.` }))], choices: [] };
        note(p, t, `Says the ${money(b.protection.fee)} a week to ${c.name} is more than the place can carry.`);
        const cs: Choice[] = [];
        if (p.familyId && c.id !== p.id) cs.push(ch(key, 'poach', '“I could look after you better. For less.”', `Taking a shop from ${first(c)} is taking it from his family. They will notice.`, true));
        cs.push(done(key));
        return { lines: [q(t, by(t, { bitter: `${money(b.protection.fee)} a week, and for what? When they smashed the window, where was he?`, frightened: 'I can’t say anything against him. But it’s a lot. It’s too much.', _: `It’s ${money(b.protection.fee)} a week. More than the place can carry, some weeks.` }))], choices: cs };
      }
      if (code === 'poach') {
        said(w, t, key, 'poach');
        // an offer he has half asked for: it opens as a matter between you, starting from how he feels about the man he pays now
        const s = door.openMatter(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round(fee * 0.8 / 5) * 5), why: `${t.name} let ${p.name} know he is unhappy with what he pays` });
        if (!s) return { lines: [q(t, 'Not now. Too many people asking.')], choices: [] };
        door.lean(w, s, t.id, 0.25, -0.15);
        return { lines: [q(t, 'Less? And you’d actually come when I called?'), 'He hasn’t said yes. He hasn’t said no. It is between you now.'], choices: [], go: { node: 'root' } };
      }
      if (code === 'friends') {
        said(w, t, key, 'friends');
        const s = door.openMatter(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round((b.income * 0.07) / 5) * 5), why: `${p.name} offered to look after ${b.name}` });
        if (!s) return { lines: [q(t, 'Not now. Too many people asking.')], choices: [] };
        return { lines: [`You let it be known that ${b.name} could do with friends in the neighbourhood.`, q(t, by(t, { frightened: 'Friends. I see. How much do friends cost?', hothead: 'I look after my own place.', jovial: 'Everybody needs friends! What do they cost these days?', _: 'And what would that cost me?' })), 'It’s on the table now, between the two of you.'], choices: [], go: { node: 'root' } };
      }
      if (code === 'invest') {
        said(w, t, key, 'invest');
        const s = door.openMatter(w, 'lend', p, t, { amt: 500, biz: b.id, why: `${p.name} offered to put money into ${b.name}` });
        if (!s) return { lines: [], choices: [] };
        return { lines: [q(t, 'You mean it?'), 'He’s thinking about it. You can see him doing the sums.'], choices: [], go: { node: 'root' } };
      }
      return { lines: [], choices: [] };
    },
  };
}

// ================================================================== his racket
const HUSTLE_ASK: Record<string, string> = { numbers: '“How are the numbers doing?”', bookie: '“How’s the book?”', shylock: '“How are your loans doing?”', cars: '“How’s the car business?”', fence: '“What’s moving through the back room?”', vending: '“How are the machines doing?”', shakedown: '“How are the collections going?”', odd: '“What are you doing for money these days?”' };
const HUSTLE_TALK: Record<string, { name: string; good: string; bad: string }> = {
  numbers: { name: 'the numbers', good: 'Everybody plays a number. Some weeks it feels like everybody plays mine.', bad: 'A man hit for big money last week. I’m still paying it out.' },
  bookie: { name: 'his book', good: 'The favourites keep losing. God bless the favourites.', bad: 'Too many winners. Something’s not right, and I mean to find out what.' },
  shylock: { name: 'his loans', good: 'Money goes out, more money comes back. That’s the trick of it.', bad: 'Half of them are late, and the other half are lying to me.' },
  cars: { name: 'the cars', good: 'Buyers are lining up. Good cars, no questions.', bad: 'The cops are watching the chop shops. I’m sitting on metal.' },
  fence: { name: 'what he moves', good: 'Things come in, things go out. People always want a bargain.', bad: 'Nobody’s buying. I’ve got a back room full of television sets.' },
  vending: { name: 'the machines', good: 'Cigarettes, jukeboxes. Pennies, but pennies add up.', bad: 'Somebody keeps putting their machines in my places.' },
  shakedown: { name: 'his collections', good: 'People pay. People are sensible.', bad: 'Shopkeepers have got brave lately. Somebody’s been telling them they can say no.' },
  odd: { name: 'what he’s doing', good: 'A bit of this, a bit of that. It pays the rent.', bad: 'Odd jobs, and fewer of them.' },
};
function racket(x: X): Subject | undefined {
  const { w, p, t } = x, h = lineOf(w, t);
  if (!h || t.bossId === p.id) return undefined; // your own men's earnings are a matter for Sunday
  const H = HUSTLE_TALK[h.kind] ?? HUSTLE_TALK.odd;
  const key = 'racket';
  const good = h.last > 150 * (h.level ?? 1);
  const late = w.debts.filter((d) => d.status === 'active' && d.creditor === t.id && d.missed > 0).map((d) => live(w, d.debtor)).filter((c): c is Character => !!c && !c.isPlayer)[0];
  return {
    key, sig: `${h.kind}:${good}:${late?.id ?? ''}`, weight: 0.25 + (h.level ?? 1) * 0.08 + (late ? 0.1 : 0),
    label: HUSTLE_ASK[h.kind] ?? HUSTLE_ASK.odd, hint: trust(x) >= 0.4 ? 'He may tell you more than he tells most.' : 'He may not tell you much.',
    open: () => {
      if (trust(x) < 0.3) return { lines: [q(t, 'It goes. Why do you ask?')], choices: [] };
      const cs: Choice[] = [];
      if (late && (h.kind === 'shylock' || h.kind === 'bookie' || h.kind === 'numbers')) cs.push(ch(key, 'late', '“Who’s been slow to pay?”', 'Someone always is.'));
      if (h.kind === 'shylock' && !w.debts.some((d) => d.status === 'active' && d.creditor === t.id && d.debtor === p.id)) cs.push(ch(key, 'borrow', '“What would you lend me?”', 'His rate, his terms. It becomes a matter between you.'));
      if (!(p.notes?.[t.id]?.tags ?? []).includes('ears')) cs.push(ch(key, 'ears', '“Keep your ears open for me, will you?”', 'A man in his line hears things. You would owe him the courtesy.'));
      cs.push(done(key));
      return { lines: [q(t, good ? H.good : H.bad)], choices: cs };
    },
    reply: (x, code) => {
      if (code === 'late' && late) {
        said(w, t, key, 'late');
        const cs: Choice[] = p.familyId ? [ch(key, 'collect', `“Want me to remind ${first(late)}?”`, 'For a cut of what comes back. He may say yes.', true), done(key)] : [done(key)];
        door.insight(p, late.id, 'loan:' + t.id);
        note(p, t, `${late.name} owes him money and has stopped paying.`);
        return { lines: [q(t, `${late.name}. Sweet as you like when he borrowed it. Now I can’t find him.`)], choices: cs };
      }
      if (code === 'collect' && late) {
        said(w, t, key, 'collect');
        const d = w.debts.find((z) => z.status === 'active' && z.creditor === t.id && z.debtor === late.id);
        if (!d) return { lines: [], choices: [] };
        const yes = trust(x) + (rk(p) - rk(t)) * 0.1 + t.traits.greed * 0.1 > 0.45; // (his decision: what he thinks of you, who outranks whom, his greed)
        if (!yes) return { lines: [q(t, 'I collect my own. No offence.')], choices: [] };
        const cut = Math.round(Math.min(d.balance, 600) * 0.25 / 10) * 10;
        door.work(w, { kind: 'collect', title: `Collect from ${late.name} for ${t.name}`, brief: `${late.name} owes ${t.name} ${money(d.balance)} and has stopped paying. ${t.name} will give you ${money(cut)} of whatever you bring back.`, giver: t.id, via: 'tip', assignee: p.id, target: late.id, pay: cut, status: 'active', days: 14, debt: d.id } as never);
        return { lines: [q(t, `Twenty-five on the dollar. Bring me the rest.`), 'It is on your list.'], choices: [] };
      }
      if (code === 'borrow') {
        said(w, t, key, 'borrow');
        const s = door.openMatter(w, 'borrow', p, t, { amt: 1000, why: `${p.name} asked ${t.name} about a loan` });
        if (!s) return { lines: [], choices: [] };
        return { lines: [q(t, 'For you? We can talk. Tell me what you need.'), 'It’s on the table now, between the two of you.'], choices: [], go: { node: 'root' } };
      }
      if (code === 'ears') {
        said(w, t, key, 'ears');
        if (trust(x) < 0.45) return { lines: [q(t, 'I hear plenty. I keep most of it.')], choices: [] };
        door.tagOn(p, t.id, 'ears');
        door.owe(w, t, p, 1, 'agreed to pass on what he hears');
        note(p, t, 'Has agreed to pass on what he hears.');
        return { lines: [q(t, 'If I hear something with your name on it, you’ll hear it from me.')], choices: [] };
      }
      return { lines: [], choices: [] };
    },
  };
}

// ================================================================== what he wants
// what he wants, in his own temperament; and, when he says why, the reason is the one the world gave him (pulse.ts)
const WANT: Record<string, Partial<Record<Arch, string>> & { _: string }> = {
  made: { proud: 'I want my button. I’ve earned it twice over.', frightened: 'I’d like to be made one day. If they’ll have me.', schemer: 'A button opens doors. I mean to have one.', jovial: 'Made! Can you see it? Me, in a good suit, at the table.', _: 'I want to be made. That’s the whole of it.' },
  gamble: { schemer: 'A game of my own. A back room, a few regulars, the house always wins.', jovial: 'A card room. Somewhere warm, good company, and the house takes a little off every hand.', bitter: 'Every other man in this city has a book. Why not me?', _: 'A room of my own. A game, a book, regulars.' },
  independent: { hothead: 'I’m sick of asking permission to breathe.', schemer: 'A man should own what he builds. I’m building.', bitter: 'I want to answer to nobody. Is that so much?', _: 'Something of my own, that nobody takes a cut of.' },
  lieutenant: { proud: 'I want to stand next to the man who decides.', schemer: 'Close to the top is where the weather’s decided.', _: 'I’d like to be somebody they ask before they decide.' },
  rich: { jovial: 'Money! A boat. A blonde. In that order, maybe.', cold: 'Enough money that I never have to count it.', frightened: 'Enough put by that nobody can squeeze me.', _: 'Money. Real money.' },
  respect: { proud: 'I want men to stop talking when I come in.', hothead: 'Respect. And I’ll take it if I’m not given it.', _: 'I want to be taken seriously. That’s all.' },
};
const WHY: Record<string, string> = { 'money has been tight': 'Money’s been tight. A man starts thinking.', 'he keeps being passed over': 'I keep getting passed over.', 'he took a beating to his pride': 'After what happened to me, I’m done being nobody.', 'he has money and wants the name that goes with it': 'I’ve got the money. I want the name to go with it.', 'he’s been trusted and wants more of it': 'They trust me. I want them to need me.', 'was punished unfairly': 'They punished me for something I didn’t do. I won’t forget it.' };
function wants(x: X): Subject | undefined {
  const { w, p, t } = x;
  const g = agencyOf(w).goals.find((y) => y.who === t.id && y.kind === 'advance');
  const kind = t.want?.kind ?? (g ? 'made' : undefined);
  if (!kind || t.isPlayer || t.rank === 'boss' || rk(t) >= rk(p) + 2) return undefined; // a boss does not tell an associate his dreams
  const key = 'want';
  const boss = live(w, t.bossId);
  return {
    key, sig: kind + ':' + t.rank, weight: 0.2 + t.traits.ambition * 0.35,
    label: '“What do you want out of all this?”', hint: 'Ambitious men like to be asked. Guarded men don’t.',
    open: () => {
      if (trust(x) < 0.4) return { lines: [q(t, by(t, { schemer: 'What everybody wants. A little more than I’ve got.', cold: 'That’s my business.', _: 'Oh, the usual things.' }))], choices: [] };
      door.insight(p, t.id, 'want');
      note(p, t, 'Wants ' + (({ made: 'to be made', gamble: 'a game of his own', independent: 'to answer to nobody', lieutenant: 'to be close to the top', rich: 'money, real money', respect: 'to be taken seriously' } as Record<string, string>)[kind] ?? 'more') + '.');
      const cs: Choice[] = [];
      if (kind === 'made' && t.rank === 'associate' && rk(p) >= 2) cs.push(ch(key, 'forward', '“I’ll put your name forward.”', 'Your name behind his. If he lets you down, you wear it.', true));
      else if ((kind === 'made' || kind === 'lieutenant' || kind === 'respect') && boss && !boss.isPlayer && boss.id !== p.id && p.familyId) cs.push(ch(key, 'word', `“I’ll put in a word with ${first(boss)}.”`, 'He will owe you. You will have said it.'));
      if (kind === 'independent') cs.push(ch(key, 'careful', '“Be careful who you say that to.”', 'Good advice. He will know you could repeat it.'));
      if ((kind === 'rich' || kind === 'gamble') && rk(t) <= rk(p) && t.cash < 1500) cs.push(ch(key, 'stake', '“What would it take to get you started?”', 'He may have a number in mind.'));
      cs.push(ch(key, 'doubt', '“You’re not ready.”', 'True or not, he will hear it.'));
      cs.push(done(key));
      const why = t.want?.why ? WHY[t.want.why] : undefined;
      return { lines: [q(t, by(t, WANT[kind] ?? WANT.rich) + (why ? ' ' + why : ''))], choices: cs };
    },
    reply: (x, code) => {
      said(w, t, key, code);
      if (code === 'forward') { door.setBacker(t, p); warm(x, 0.08, 'sponsor'); door.esteem(w, t, p, 'trust', 0.06, 'sponsor'); return { lines: [q(t, 'From you, that means something. I won’t make you sorry.'), 'Your name is behind his now.'], choices: [] }; }
      if (code === 'word' && boss) {
        door.regard(w, boss, t.id, 'trust', 0.02 + p.standing / 2000);
        door.owe(w, p, t, 1, `you spoke up for him to ${boss.name}`);
        door.happened(w, { kind: 'favour', actor: p.id, victim: t.id, minor: true, text: `${p.name} spoke up for ${t.name} to ${boss.name}.`, district: p.district }, { witnesses: [t.id, boss.id] });
        warm(x, 0.05, 'spoke-up');
        return { lines: [q(t, 'I owe you one.')], choices: [] };
      }
      if (code === 'careful') { door.esteem(w, t, p, 'trust', 0.04, 'advice'); door.insight(p, t.id, 'leaving'); return { lines: [q(t, 'I know who I’m talking to. I hope.')], choices: [] }; }
      if (code === 'stake') {
        const amt = Math.max(500, Math.round(t.traits.greed * 2000 / 100) * 100);
        const cs: Choice[] = p.cash >= amt && !w.debts.some((d) => d.status === 'active' && d.creditor === p.id && d.debtor === t.id) ? [ch(key, 'fund', `“I’ll stake you ${money(amt)}.”`, 'A loan at five a week. A man with a start remembers who gave it him.', true), done(key)] : [done(key)];
        return { lines: [q(t, `${money(amt)}, maybe. Enough to start.`)], choices: cs };
      }
      if (code === 'fund') {
        const amt = Math.max(500, Math.round(t.traits.greed * 2000 / 100) * 100);
        if (p.cash < amt || w.debts.some((d) => d.status === 'active' && d.creditor === p.id && d.debtor === t.id)) return { lines: [p.cash < amt ? 'You can’t spare it.' : 'He still owes you from the last time.'], choices: [] };
        door.friendLoan(w, p, t, amt, 0.05, 'a stake'); warm(x, 0.06, 'stake');
        door.owe(w, p, t, 2, 'you staked him when nobody else would');
        return { lines: [`You give him ${money(amt)}. He looks at it a long time before he puts it away.`, q(t, 'You’ll see it back. With interest.')], choices: [] };
      }
      if (code === 'doubt') {
        if (arch(t) === 'hothead' || arch(t) === 'proud') { door.grudge(w, t, p.id, 0.08, `${p.name} said he was not ready`); return { lines: [q(t, 'Funny. I was going to say the same about you.')], choices: [] }; }
        door.regard(w, t, p.id, 'respect', 0.02); return { lines: [q(t, 'Maybe. Maybe not yet.')], choices: [] };
      }
      return { lines: [], choices: [] };
    },
  };
}

// ================================================================== the men he can't stand, and the ones he looks up to
function opinion(x: X): Subject | undefined {
  const { w, p, t } = x;
  const cand = Object.entries(t.rels).map(([id, r]) => ({ c: live(w, id), r })).filter((y) => y.c && !y.c.isPlayer && y.c.id !== t.id && knowsPlayer(w, y.c, p) && (y.r.grudge >= 0.3 || y.r.affection >= 0.65 && y.r.respect >= 0.5));
  const pick = cand.sort((a, b) => Math.max(b.r.grudge, b.r.affection - 0.3) - Math.max(a.r.grudge, a.r.affection - 0.3))[0];
  if (!pick) return undefined;
  const o = pick.c!, hate = pick.r.grudge >= 0.3;
  const key = 'op:' + o.id;
  // what he holds against him, if there is something real
  const wrong = hate ? Object.values(w.facts).filter((f) => f.actor === o.id && f.victim === t.id && t.known[f.id]?.knowsActor && !f.minor).sort((a, b) => b.t - a.t)[0] : undefined;
  return {
    key, sig: hate ? 'h' + Math.round(pick.r.grudge * 4) : 'a', weight: hate ? 0.2 + pick.r.grudge * 0.5 + (arch(t) === 'hothead' ? 0.15 : 0) : 0.15,
    label: `“What do you make of ${first(o)}?”`, hint: hate ? 'You have a feeling you know.' : 'He seems to rate him.',
    nudge: hate && pick.r.grudge > 0.6 && arch(t) === 'hothead' ? `${first(t)} says ${first(o)}’s name like he is spitting out a seed.` : undefined,
    open: () => {
      note(p, t, hate ? `Can’t stand ${o.name}.${wrong ? ' Says he has reason.' : ''}` : `Thinks highly of ${o.name}.`);
      if (!hate) {
        const cs: Choice[] = [];
        if (!p.intro?.[o.id] && peek(p, o.id).trust < 0.3) cs.push(ch(key, 'intro', `“Could you introduce me to ${first(o)}?”`, 'A friend of a friend starts better than a stranger.'));
        cs.push(done(key));
        const n = first(o), tp = temper(t);
        const pool = tp.agreeable + tp.empathy > 1.15 ? [`${n}? Salt of the earth. I’d trust him with my sister.`, `${n} looked after me when nobody else would.`, `I’d go through a door for ${n}.`]
          : tp.caution > 0.6 ? [`${n} does what he says. There aren’t many.`, `${n}’s careful. I like careful.`, `You can count on ${n}. That’s rare.`]
          : tp.pride > 0.6 ? [`${n}’s one of the few I’d call an equal.`, `You want to learn something, watch ${n}.`, `${n} has never once let me down.`]
          : [`${n} is a good man. One of the few.`, `${n}’s straight. You can’t say that about many.`, `I’ve got a lot of time for ${n}.`];
        return { lines: [q(t, vary(t, 'adm' + o.id, pool))], choices: cs };
      }
      const why = wrong ? ` After what he did, ${wrong.kind === 'beating' ? 'putting his hands on me' : wrong.kind === 'poach' ? 'taking what was mine' : 'that business'}, what do you think?` : '';
      const cs: Choice[] = [ch(key, 'agree', `“I never liked ${first(o)} either.”`, `He will warm to you. ${first(o)} may hear of it.`), ch(key, 'defend', `“${first(o)}’s all right. Give him a chance.”`, 'He may respect it. He may not.')];
      if (wrong || pick.r.grudge > 0.45) cs.push(ch(key, 'more', '“What’s really between you two?”', 'There’s a story. You might do something about it.'));
      cs.push(done(key));
      return { lines: [q(t, by(t, { hothead: `${first(o)}? I’d like to break his face.${why}`, bitter: `${first(o)} smiles at you and counts your pockets.${why}`, cold: `I don’t think about ${first(o)}. When I do, it isn’t kindly.${why}`, frightened: `I keep away from ${first(o)}. That’s all I’ll say.`, _: `I’ve no use for ${first(o)}.${why}` }))], choices: cs };
    },
    reply: (x, code) => {
      said(w, t, key, code);
      if (code === 'intro') {
        if (trust(x) < 0.4) return { lines: [q(t, 'I don’t make introductions lightly.')], choices: [] };
        door.introducedThrough(w, p, o, 0.3); door.trustAtLeast(w, o, p.id, 0.25 + peek(o, t.id).trust * 0.15);
        door.happened(w, { kind: 'favour', actor: t.id, victim: p.id, minor: true, text: `${t.name} introduced ${p.name} to ${o.name}.`, district: t.district }, { witnesses: [p.id, o.id] });
        return { lines: [q(t, `I’ll tell ${first(o)} you’re all right. After that it’s up to you.`), `You can go and see ${first(o)} as a friend of ${first(t)}’s.`], choices: [] };
      }
      if (code === 'agree') {
        warm(x, 0.05, 'shared-enemy');
        // a careless word travels
        if (chance(w, t.id, 'passes it on', 'keeps it to himself', [term('base', 0.2), term('how much he talks × 0.3', t.traits.sociability * 0.3)]).yes) {
          door.grudge(w, o, p.id, 0.1, `${p.name} talked against him`);
          door.happened(w, { kind: 'rumour', actor: p.id, victim: o.id, minor: true, text: `${p.name} and ${t.name} were running ${o.name} down.`, district: t.district }, { witnesses: [o.id] });
        }
        return { lines: [q(t, 'I knew you had sense.')], choices: [] };
      }
      if (code === 'defend') {
        if (arch(t) === 'hothead' || arch(t) === 'bitter' || arch(t) === 'proud') { door.grudge(w, t, p.id, 0.05, `${p.name} ran down a man he likes`); door.regard(w, t, p.id, 'respect', 0.01); return { lines: [q(t, 'Then you don’t know him like I do.')], choices: [] }; }
        door.regard(w, t, p.id, 'respect', 0.03); door.grudge(w, t, o.id, -(0.04), 'spoke for him');
        return { lines: [q(t, 'Maybe. Maybe I’ve been hard on him.')], choices: [] };
      }
      if (code === 'more') {
        if (wrong && t.known[wrong.id]) door.learnFrom(w, p, wrong, t.id, t.known[wrong.id].knowsActor);
        return { lines: [q(t, wrong ? wrong.text.replace(t.name, 'me').replace(/\.$/, '. I haven’t forgotten.') : `Years of it. Little things. They add up.`)], choices: [], go: { node: 'subject', subject: o.id } };
      }
      return { lines: [], choices: [] };
    },
  };
}

// ================================================================== his family
function family(x: X): Subject | undefined {
  const { w, p, t } = x;
  const ties = kinOf(w, t).map((k) => ({ k, c: w.chars[k.id] })).filter((y) => y.c && !y.c.isPlayer && y.c.alive && (y.k.role === 'brother' || y.k.role === 'cousin') && closeKin(w, t, y.c));
  const pk = kinTie(w, t, p);
  if (!ties.length || pk) return undefined;
  const { k, c: kin } = ties.sort((a, b) => rk(b.c) - rk(a.c))[0];
  const key = 'kin:' + kin.id;
  const hurt = Object.values(w.facts).filter((f) => f.victim === kin.id && (f.kind === 'beating' || f.kind === 'vandalism') && w.now - f.t < 30 * DAY && t.known[f.id]).sort((a, b) => b.t - a.t)[0];
  const venge = (w.situations ?? []).find((s) => s.kind === 'revenge' && isOpen(s) && s.parties?.some((y) => y.id === t.id && y.role === 'avenger'));
  const fam = kin.familyId ? w.fam[kin.familyId].name : '';
  const what = kin.rank === 'civilian' ? (ownerBiz(w, kin.id) ? `has ${ownerBiz(w, kin.id)!.name}` : vary(t, 'kw' + kin.id, ['works straight, God help him', 'has a regular job and a regular life', 'keeps out of all this, thank God']))
    : kin.familyId !== t.familyId ? vary(t, 'kf' + kin.id, [`is with the ${fam} people, which makes Christmas interesting`, `went with the ${fam} people. We don’t talk business at the table`, `is a ${fam} man. Blood’s blood, but I watch what I say`])
    : vary(t, 'ks' + kin.id, [`is with us, with the ${fam} people`, `is one of ours. I keep an eye on him`, `came in with the ${fam} people same as me`]);
  return {
    key, sig: `${kin.rank}:${hurt?.id ?? ''}:${venge?.id ?? ''}`, weight: 0.15 + (hurt ? 0.35 : 0) + (arch(t) === 'jovial' || arch(t) === 'earnest' ? 0.1 : 0),
    label: hurt ? `“How’s ${first(kin)}? After what happened.”` : `“How’s your ${k.role} ${first(kin)}?”`, hint: hurt ? 'It is fresh.' : 'Family is what men talk about when they trust you.',
    open: () => {
      door.insight(p, t.id, 'tie:' + kin.id);
      note(p, t, `His ${k.role} is ${kin.name}${kin.rank === 'civilian' ? (ownerBiz(w, kin.id) ? `, who has ${ownerBiz(w, kin.id)!.name}` : ', who is not in the life') : `, with the ${fam} people`}.`);
      if (hurt) {
        const cs: Choice[] = [];
        if (venge) { door.learnsOf(w, venge, p.id, 2, 'told by ' + t.id); cs.push(ch(key, 'calm', '“Don’t do anything stupid.”', 'He is going to do something. You might stop him.')); }
        cs.push(ch(key, 'help', '“If you need anything, you know where I am.”', 'A man remembers who came by.'));
        cs.push(done(key));
        return { lines: [q(t, venge ? `My ${k.role}. They put him in the hospital. I know who did it, and I’m not going to sit here.` : `They hurt my ${k.role}. He says leave it. I don’t know if I can.`)], choices: cs };
      }
      const cs: Choice[] = [];
      if (!p.intro?.[kin.id] && peek(p, kin.id).trust < 0.3 && trust(x) >= 0.4) cs.push(ch(key, 'meet', `“I’d like to meet ${first(kin)}.”`, 'Family vouches for family.'));
      cs.push(done(key));
      return { lines: [q(t, `${first(kin)}? My ${k.role}. ${FEMALE.includes(first(kin)) ? 'She' : 'He'} ${what}.`), peek(t, kin.id).grudge > 0.3 ? 'They don’t seem to speak much.' : peek(t, kin.id).affection > 0.6 ? vary(t, 'kk' + kin.id, ['He tells you a story about the two of them and a stolen ice cream truck. You suspect it has grown over the years.', 'He says it with some pride.', 'His face softens when he says the name.']) : vary(t, 'kn' + kin.id, ['He leaves it there.', 'He says it the way you mention the weather.'])], choices: cs };
    },
    reply: (x, code) => {
      said(w, t, key, code);
      if (code === 'meet') { door.introducedThrough(w, p, kin, 0.3); return { lines: [q(t, `I’ll tell him you’re a friend. Go and see him.`)], choices: [] }; }
      if (code === 'help') { warm(x, 0.06, 'kin-hurt'); door.esteem(w, t, p, 'trust', 0.03, 'kin-hurt'); return { lines: [q(t, 'I know. Thank you.')], choices: [] }; }
      if (code === 'calm' && venge) return { lines: [q(t, 'Then talk me out of it. Go on.')], choices: [], go: { node: 'root' } };
      return { lines: [], choices: [] };
    },
  };
}

// ================================================================== the man he works for
function hisBoss(x: X): Subject | undefined {
  const { w, p, t } = x, b = live(w, t.bossId);
  if (!b || b.isPlayer || t.rank === 'civilian' || b.id === p.id || t.id === p.bossId) return undefined;
  const r = peek(t, b.id), sour = r.grudge > 0.25 || t.want?.kind === 'independent' || t.problem?.kind === 'resentment';
  const key = 'boss';
  return {
    key, sig: sour ? 'sour' : 'ok', weight: 0.12 + (sour ? 0.3 : 0),
    label: `“How do you find working for ${first(b)}?”`, hint: 'He may tell you. He may tell him you asked.',
    open: () => {
      if (trust(x) >= 0.4 && !sour) note(p, t, `Speaks well of ${b.name}.`);
      if (trust(x) < 0.4 || !sour) return { lines: [q(t, by(t, { proud: `${first(b)} is a man you can follow.`, cold: `He pays, I work.`, jovial: `${first(b)}? Never a dull day.`, _: `${first(b)}’s fair, mostly.` }))], choices: [] };
      door.insight(p, t.id, 'sour:' + b.id);
      note(p, t, `Has no love for ${b.name}.`);
      return { lines: [q(t, by(t, { bitter: `${first(b)} eats first, eats most, and tells us we’re family.`, hothead: `One of these days I’ll tell ${first(b)} what I think of him.`, schemer: `${first(b)} won’t be there forever. Men should think about that.`, _: `Between us? I’ve had better.` }))], choices: [ch(key, 'same', '“I’d feel the same.”', 'He will trust you more. You have agreed to something.'), ch(key, 'loyal', `“${first(b)} deserves better than that.”`, 'Loyalty, said aloud. He will remember which side you took.'), done(key)] };
    },
    reply: (x, code) => {
      said(w, t, key, code);
      if (code === 'same') { warm(x, 0.04, 'grumble'); door.esteem(w, t, p, 'trust', 0.05, 'grumble'); if (t.want?.kind === 'independent') door.insight(p, t.id, 'leaving'); return { lines: [q(t, 'I thought you might.')], choices: [] }; }
      if (code === 'loyal') {
        door.regard(w, t, p.id, 'trust', -0.04);
        if (chance(w, t.id, 'it gets back to him', 'it stays here', [term('base', 0.25), term('how much he talks × 0.2', t.traits.sociability * 0.2)]).yes) door.regard(w, b, p.id, 'respect', 0.02); // it may get back to him, in a good way
        return { lines: [q(t, 'Sure. Sure he does.')], choices: [] };
      }
      return { lines: [], choices: [] };
    },
  };
}

// ================================================================== something on his mind about one of yours
// What you know about his people that he does not: a man of his who wants out, a man of his who is in trouble. Telling him is a
// choice with consequences for the man you tell on.
function tellOn(x: X): Subject | undefined {
  const { w, p, t } = x;
  const man = Object.entries(p.insight ?? {}).map(([id, tags]) => ({ c: live(w, id), tags })).find((y) => y.c && y.c.bossId === t.id && !y.c.isPlayer && y.tags.includes('leaving') && !t.talk?.['told:' + y.c.id]);
  if (!man || rk(t) < 2) return undefined;
  const c = man.c!;
  const key = 'tell:' + c.id;
  return {
    key, sig: 'x', weight: 0.25,
    label: `“I heard something about ${first(c)}.”`, hint: `${first(c)} has been talking about going his own way. Telling ${first(t)} is a choice.`,
    open: () => ({ lines: [`You could tell ${first(t)} what ${first(c)} said to you. Once it is said, it is said.`], choices: [ch(key, 'tell', `“${first(c)} is looking for a way out.”`, `${first(t)} will be grateful. ${first(c)} will not, if he finds out.`, true), ch(key, 'end', '“Never mind. It’s nothing.”')] }),
    reply: (x, code) => {
      if (code !== 'tell') return { lines: [], choices: [] };
      door.talkStamp(w, t, 'told:' + c.id);
      door.regard(w, t, c.id, 'trust', -0.15); door.esteem(w, t, p, 'trust', 0.05, 'told-on');
      const f = door.happened(w, { kind: 'rumour', actor: p.id, victim: c.id, minor: true, text: `${p.name} told ${t.name} that ${c.name} is looking for a way out.`, district: t.district }, { witnesses: [t.id] });
      if (chance(w, t.id, 'word gets back to him', 'it does not', [term('three in ten', 0.3)]).yes) { door.toldDirect(w, c, f, t.id); door.grudge(w, c, p.id, 0.3, f); }
      return { lines: [q(t, `Is he. Thank you for telling me.`), `${first(t)} doesn’t say what he’ll do. He doesn’t have to.`], choices: [] };
    },
  };
}

// ================================================================== somebody leaning on him
// Another man wants his money. He may say so, if he trusts you, and that is an opening: stand between them, or take him on yourself.
function pressed(x: X): Subject | undefined {
  const { w, p, t } = x;
  const s = openAsks(w).find((y) => y.ak === 'protect' && y.terms?.of === t.id && y.terms?.by !== p.id);
  const a = s ? live(w, s.terms?.by) : undefined;
  if (!s || !a || a.id === p.id) return undefined;
  const key = 'pressed:' + s.id, b = s.biz ? w.biz[s.biz] : undefined;
  const last = s.st?.[t.id]?.last;
  const sit = s, ag = a;
  return {
    key, sig: String(last ?? ''), weight: 0.55 + (arch(t) === 'frightened' ? 0.15 : 0),
    label: '“Anyone been bothering you?”', hint: 'He looks like a man waiting for someone to come back.',
    nudge: arch(t) === 'frightened' || last === 'no' ? `${first(t)} looks past you at the door when it opens.` : undefined,
    open: () => {
      // what you already know can open him up: a man who sees you know is a man with less to hide
      const heard = Object.keys(p.known).some((id) => w.facts[id]?.story === 'sit:' + s.id);
      if (trust(x) < 0.3 && !(heard && s.m?.['heard:' + p.id])) return { lines: [q(t, 'Nobody. Why? What have you heard?')], choices: heard ? [ch(key, 'heard', `“I heard ${first(a)} came round.”`, 'He will know it is out. He may be glad to say it.')] : [] };
      return tell();
    },
    reply: (x, code) => {
      if (code === 'heard') { door.heardOf(s, p.id); warm(x, 0.02, 'heard'); const b2 = tell(); return { ...b2, lines: [q(t, 'So it’s all over the street. Fine.'), ...b2.lines] }; }
      return reply0(x, code);
    },
  };
  function tell(): Beat {
      door.learnsOf(w, sit, p.id, 2, 'told by ' + t.id);
      note(p, t, `${ag.name} has been leaning on him for ${money(sit.terms?.amt ?? 0)} a week${b ? ` for ${b.name}` : ''}.`);
      const cs: Choice[] = [];
      if (p.familyId) {
        if (!b || mayAsk(w, 'protect', p, t, b.id)) cs.push(ch(key, 'mine', '“I’ll look after you myself.”', `Then ${first(ag)} is your problem, and his people will notice.`, true));
        cs.push(ch(key, 'warn', `“I’ll tell ${first(ag)} to leave you alone.”`, 'A promise. And a conversation you will have to have.', true));
      }
      cs.push(done(key));
      return { lines: [q(t, last === 'no' ? `${ag.name} came in. ${money(sit.terms?.amt ?? 0)} a week, or else. I told him where to go. Now I wait for the or else.` : last === 'stall' ? `${ag.name} wants ${money(sit.terms?.amt ?? 0)} a week. I told him I’d think about it. I’m thinking.` : `${ag.name} has been coming round. You know what he wants.`)], choices: cs };
  }
  function reply0(x: X, code: string): Beat {
      said0(code);
      if (code === 'mine' && b) {
        const m = door.openMatter(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round((sit.terms?.amt ?? 40) * 0.8 / 5) * 5), why: `${t.name} turned to ${p.name} when ${ag.name} leaned on him` });
        if (!m) return { lines: [q(t, askBetween(w, 'protect', p.id, t.id) ? 'You already made me an offer. I’m still thinking about it.' : 'Not now. Too many people want something from me this week.')], choices: [] }; // (he answers, even when nothing can come of it today)
        door.lean(w, m, t.id, 0.3, -0.2);
        return { lines: [q(t, 'You? And what happens when he comes back?'), 'It’s on the table now, between the two of you.'], choices: [], go: { node: 'root' } };
      }
      if (code === 'warn') {
        const m = door.openMatter(w, 'warn', p, ag, { about: sit.id, why: `${p.name} said he would tell ${ag.name} to leave ${t.name} alone` });
        if (!m) return { lines: [q(t, 'You’ve already said you would. I’m holding you to it.')], choices: [] };
        door.memo(w, t, p.id, 'promise', `You said you would tell ${ag.name} to leave him alone.`, { due: w.now + 7 * DAY });
        warm(x, 0.06, 'stood-up'); door.esteem(w, t, p, 'trust', 0.05, 'stood-up');
        return { lines: [q(t, 'You’d do that for me?'), `You will have to go and see ${first(ag)}. It is on your list, and ${first(t)} is counting on it.`], choices: [] };
      }
      return { lines: [], choices: [] };
  }
  function said0(code: string) { said(w, t, key, code); }
}

// ------------------------------------------------------------------ the conversation
const ALL = [pressed, trouble, shop, racket, wants, opinion, family, hisBoss, tellOn];
// (Stage 6 of the conversation: the matters between you are subjects too, registered from threads.ts)
export const MORE: ((x: X) => Subject | undefined)[] = [];
const every = () => [...MORE, ...ALL];
const ALLOW_COOLED = 7; // days before the same subject, unchanged, is worth raising again
export function subjectsOf(w: World, p: Character, t: Character): Subject[] {
  if (t.isPlayer || !t.alive) return [];
  const x = { w, p, t };
  const out: Subject[] = [];
  for (const f of every()) { const s = f(x); if (s) out.push(s); }
  // a subject you have just been over, that hasn't changed, has nothing new in it
  const fresh = out.filter((s) => { const m = mem(t, 'tk:' + s.key); return !m || m.sig !== s.sig || day(w) - m.d >= ALLOW_COOLED; });
  return fresh.sort((a, b) => b.weight - a.weight);
}
export const subjectRows = (w: World, p: Character, t: Character, n = 3) => subjectsOf(w, p, t).slice(0, n).map((s) => ({ code: 'tk:' + s.key, label: s.label, hint: s.hint }));
// what he lets slip on his own when you arrive: the subject heaviest on his mind, if it shows
export function nudgeOf(w: World, p: Character, t: Character): string | undefined { return subjectsOf(w, p, t).find((s) => s.nudge && s.weight >= 0.5)?.nudge; }

// Raise a subject ('tk:<key>') or answer within one ('tk:<key>:<choice>').
export function talkAbout(w: World, p: Character, t: Character, code: string): Beat | undefined {
  const parts = code.split(':');
  // (ranks: associate 0, soldier 1, capo 2...) keys may carry an id ('op:c12'), so the choice is the part after the key
  const all = subjectsOf(w, p, t).concat(every().map((f) => f({ w, p, t })).filter((s): s is Subject => !!s));
  const s = all.find((y) => code === 'tk:' + y.key || code.startsWith('tk:' + y.key + ':'));
  if (!s) return parts.length > 2 ? { lines: ['He has moved on to something else.'], choices: [] } : undefined;
  const rest = code.slice(('tk:' + s.key).length + 1);
  if (!rest) { remember(w, t, 'tk:' + s.key, s.sig); const b = s.open({ w, p, t }); return { minutes: 20, ...b }; }
  if (rest === 'end') return { lines: [], choices: [], minutes: 2 };
  return { minutes: 15, ...s.reply({ w, p, t }, rest) };
}
