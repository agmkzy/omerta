import { answerAsk, answerWord, callFavour, putToPlayer } from './asks';
import { answerMatter } from './matters';
// People come to you. Each approach is a small scene in the man's own voice, with choices that carry weight:
// a loan is a debt, a favour is a debt of another kind, a no is remembered. Nothing here is a menu of numbers.
import { newOffer } from './jobs';
import { helpMan, lateOf, PROBLEM_LABEL } from './people';
import { bizMove, clearArrears, evidence, giveTime, owedOf, takeFromBiz } from './econ';
import { sitdownChoose, callSitdown } from './disputes';
import { investChoose } from './reports';
import { addFact, clamp, createDebt, earn, factText, learn, money, newId, ownerBiz, payDebt, rel, shortTime } from './core';
import { DAY, Character, Enc, EncOpt, Fact, Favour, Id, LifeEvent, World } from './types';
import { Arch, arch, hash, pick } from './voice';

const PL = (w: World) => w.chars[w.playerId!];
type VMap = Partial<Record<Arch, string[]>> & { _?: string[] };
const by = (c: Character, seed: string, m: VMap) => pick(m[arch(c)] ?? m._ ?? (Object.values(m).flat() as string[]), seed + c.id);
const first = (c: Character) => c.name.split(' ')[0];
const wk = (w: World, t: number) => Math.floor(t / DAY);

export function addEnc(w: World, e: Omit<Enc, 'id' | 't' | 'status' | 'expires'> & { days?: number }): Enc {
  const { days, ...rest } = e;
  const enc: Enc = { ...rest, id: newId(w, 'e'), t: w.now, expires: w.now + (days ?? 4) * DAY, status: 'open' };
  w.enc.push(enc);
  return enc;
}
const openOf = (w: World) => w.enc.filter((e) => e.status === 'open');
const pending = (w: World, kind: string, from?: Id) => openOf(w).some((e) => e.kind === kind && (!from || e.from === from));

// ------------------------------------------------------------ favours

export function owedTo(w: World, id: Id) {
  return w.favours.filter((f) => !f.settled && f.from === id);
}
export function owing(w: World, id: Id) {
  return w.favours.filter((f) => !f.settled && f.to === id);
}
export function addFavour(w: World, from: Id, to: Id, size: number, what: string): Favour {
  const f: Favour = { id: newId(w, 'v'), from, to, size, what, t: w.now };
  w.favours.push(f);
  return f;
}
export const favourWord = (n: number) => (n >= 3 ? 'a big one' : n === 2 ? 'a real one' : 'a small one');

// ------------------------------------------------------------ the generators

interface Cand {
  weight: number;
  make: () => void;
  key?: string; // the template it comes from, so the same one doesn't keep coming back
}

function loanAsk(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  if (out.length === 0) return out; // loan requests now come from situations (src/situations.ts)
  const pool = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && c.rank !== 'boss' && (c.problem && c.problem.sev > 0.3 || (ownerBiz(w, c.id)?.distress ?? 0) >= 2) && (c.rels[p.id]?.trust ?? 0) >= 0.3 && !pending(w, 'loan', c.id));
  for (const c of pool.slice(0, 4)) {
    out.push({ weight: c.bossId === p.id ? 1.4 : 1, make: () => makeLoan(w, p, c) });
  }
  return out;
}
export function makeLoan(w: World, p: Character, c: Character) {
  const amt = Math.round((c.rank === 'civilian' ? w.rng.int(200, 700) : w.rng.int(250, 900)) / 50) * 50;
  const pr = c.problem?.kind;
  const stated: Record<string, string[]> = {
    gambling: ['my brother-in-law got into something and I said I would cover it', 'the car is finished and I need it for work', 'a hospital bill, my wife\'s sister'],
    debt: ['I’m behind on something I shouldn’t be behind on', 'a man I owe is getting impatient'],
    family: ['my mother needs looking after and it costs more than I make', 'my kid needs something I can’t say no to'],
    drink: ['rent, and I don’t want to talk about how it got this far', 'I got behind. It happens'],
    house: ['the roof, the landlord, the whole building is coming down on us', 'we lost the lease and I have to put money down somewhere new'],
    woman: ['a family matter, I would rather not say', 'there’s someone I have to look after, and I’ll leave it there'],
    resentment: ['an opportunity, a thing that needs front money', 'I have a way to turn it over, I just need the stake'],
  };
  const reason = pick(stated[pr ?? 'resentment'] ?? stated.resentment, c.id + w.now);
  const lead = by(c, 'loan' + w.now, {
    proud: [`I don’t ask. You know I don’t ask.`, `I wouldn’t come to you if there were another way.`],
    bitter: [`Everybody says friends help each other. Let’s see.`, `I put in my time. Now I’m asking for something.`],
    schemer: [`There’s a way this works for both of us. First I need ${money(amt)}.`, `You scratch my back. I’ll remember it, and so will you.`],
    earnest: [`I hate asking. I really do.`, `I’m sorry to bother you with this.`],
    hothead: [`Look, I’m short and I’m not going to dress it up.`, `I need money. There. I said it.`],
    cold: [`I need ${money(amt)}. I’ll pay it back.`, `I’m asking once.`],
    jovial: [`Tony, my friend, you’re going to laugh at me, but I need a favour.`, `I wouldn’t trouble a man like you, but you have a good heart.`],
    frightened: [`I don’t know who else to ask. Please don’t say anything to anyone.`, `I’m in trouble. A little trouble. Not the bad kind. Yet.`],
  });
  addEnc(w, {
    kind: 'loan', from: c.id, title: `${first(c)} needs money`,
    lines: [`${c.name} catches you alone.`, `"${lead} It’s ${reason}. ${money(amt)}, and I’ll make it right."`],
    opts: [
      { code: 'lend', label: `Lend him ${money(amt)}`, hint: 'On the book, with the usual weekly. He owes you, and so does his word.' },
      { code: 'give', label: 'Give it to him. Call it nothing.', hint: 'No book, no vig. Worth more than money, if he’s the type to remember.' },
      { code: 'half', label: `Lend half`, hint: `${money(amt / 2)}. He’ll understand what that says.` },
      { code: 'ask', label: 'What’s it really for?', hint: 'Make him say it to your face.' },
      { code: 'no', label: 'Turn him down' },
    ],
    about: undefined,
    data: { amt, reason, real: pr ?? '' },
    days: 4,
  });
}

function favourAsk(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  if ((p.cooldown.favask ?? 0) > w.now) return out;
  const pool = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && c.rank !== 'civilian' && c.rank !== 'boss' && (c.rels[p.id]?.trust ?? 0) >= 0.3 && (c.rels[p.id]?.respect ?? 0) >= 0.3 && !pending(w, 'favour_ask', c.id));
  const jailed = Object.values(w.chars).filter((x) => x.alive && x.jailedUntil > w.now && x.familyId !== p.familyId);
  for (const c of pool.slice(0, 3)) {
    const boss = c.bossId ? w.chars[c.bossId] : undefined;
    if (boss && boss.id !== p.id && p.rank !== 'associate') out.push({ weight: 1, key: 'word', make: () => makeWord(w, p, c, boss) });
    const deed = Object.values(w.facts).filter((f) => f.actor === c.id && !f.minor && ['beating', 'robbery', 'theft', 'burglary', 'vandalism', 'scam', 'poach'].includes(f.kind) && w.now - f.t < 12 * DAY && !f.victim?.startsWith?.('zz')).sort((a, b) => b.t - a.t)[0];
    if (deed) out.push({ weight: 0.7, key: 'alibi', make: () => makeCover(w, p, c, deed) });
    if (jailed.length) out.push({ weight: 0.5, key: 'release', make: () => makeRelease(w, p, c, jailed[0]) });
  }
  return out;
}
function makeWord(w: World, p: Character, c: Character, boss: Character) {
  const lead = by(c, 'word' + w.now, {
    proud: [`I have done the work. Nobody says otherwise. But a man needs somebody to say it in the right room.`],
    schemer: [`${boss.name} listens to you. I would be very grateful if my name came up, in passing, at the right moment.`],
    bitter: [`I have been passed over for men with less to show. A word from you would remind them I exist.`],
    earnest: [`I don’t want to put you out. But if you could mention me to ${first(boss)}, I wouldn’t forget it.`],
    hothead: [`They keep looking past me. Put my name in front of ${first(boss)}, would you? Before I do it myself, badly.`],
    jovial: [`You and ${first(boss)} are like this, yes? So say something nice about your friend.`],
  });
  addEnc(w, {
    kind: 'favour_ask', from: c.id, about: boss.id, title: `${first(c)} wants a word put in`,
    lines: [`${c.name} walks you out to the street.`, `"${lead}"`],
    opts: [
      { code: 'do', label: `Speak to ${first(boss)} for him`, hint: 'Your name goes with his. If he disappoints, it costs you.' },
      { code: 'price', label: 'Do it, and name a price', hint: 'A favour is a favour. Make it clear what kind.' },
      { code: 'soft', label: 'Say you’ll see', hint: 'Not a no. Not a yes. He’ll know the difference.' },
      { code: 'no', label: 'Tell him it’s not your place' },
    ],
    data: { kind: 'word' },
  });
}
// When something happened, the way a man says it: not a date and a time.
export function whenWords(now: number, t: number): string {
  const h = (t % 1440) / 60, band = h < 5 ? 'in the small hours' : h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : h < 21 ? 'in the evening' : 'at night';
  const d = Math.floor(now / 1440) - Math.floor(t / 1440);
  return d <= 0 ? `this ${band.replace('in the ', '').replace('at ', '')}` : d === 1 ? `yesterday ${band.replace('in the ', '').replace('at ', '')}` : d < 7 ? `${d} days ago, ${band}` : `on ${shortTime(t)}`;
}
function makeCover(w: World, p: Character, c: Character, deed: Fact) {
  const when = whenWords(w.now, deed.t);
  const where = deed.business ? w.biz[deed.business]?.name : deed.district;
  const lead = by(c, 'cover' + w.now, {
    proud: [`If anyone asks where I was ${when}, I was with you. Playing cards. That’s all I need from you.`],
    cold: [`${when[0].toUpperCase() + when.slice(1)}. You and I were at the club. Cards. That’s the whole thing.`],
    frightened: [`Somebody might ask where I was ${when}. I need to have been with you. Please.`],
    jovial: [`${when[0].toUpperCase() + when.slice(1)}, my friend. You and me, cards, a lot of wine. We both had a terrific time.`],
  });
  addEnc(w, {
    kind: 'favour_ask', from: c.id, title: `${first(c)} needs an alibi`,
    lines: [`${c.name} finds you before you have finished your coffee.`, `"${lead}"`],
    opts: [
      { code: 'do', label: 'You were with him', hint: 'Heat may find you. He’ll remember it for years.' },
      { code: 'ask', label: 'Where was he really?', hint: 'You’re not putting your name to something you can’t see.' },
      { code: 'no', label: 'Not for anyone' },
    ],
    data: { kind: 'cover', fact: deed.id, when, where: where ?? '' },
  });
}
function makeRelease(w: World, p: Character, c: Character, jailed: Character) {
  addEnc(w, {
    kind: 'favour_ask', from: c.id, about: jailed.id, title: `${first(c)} asks about ${first(jailed)}`,
    lines: [`${c.name} sits down across from you without being asked.`, `"${jailed.name} is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it."`],
    opts: [
      { code: 'do', label: 'Make a call, put up $300', hint: 'A man who gets out remembers who got him out.' },
      { code: 'no', label: 'It’s not your business' },
    ],
    data: { kind: 'release', jailed: jailed.id },
  });
}

function mediate(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  for (const a of Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id)) {
    for (const [id, r] of Object.entries(a.rels)) {
      const b = w.chars[id];
      if (!b?.alive || b.id === p.id || r.grudge < 0.22 || b.familyId !== p.familyId || b.rank === 'civilian' || pending(w, 'mediate', a.id)) continue;
      out.push({
        weight: 1.1,
        make: () => {
          const lead = by(a, 'med' + w.now, {
            hothead: [`${b.name} and I are going to have a problem. I’m telling you now so you can’t say I didn’t.`],
            proud: [`${b.name} showed me disrespect in front of people. I won’t let that stand, but I wanted you to hear it from me first.`],
            bitter: [`${b.name} has been working against me for months. You can ask anybody.`],
            earnest: [`I don’t want trouble with ${b.name}. But he’s making it very hard not to.`],
            frightened: [`${b.name} has been looking at me wrong. I don’t know what I did.`],
            cold: [`${b.name} is a problem. I can make it go away or you can make it go away. That’s the choice.`],
          });
          addEnc(w, {
            kind: 'mediate', from: a.id, about: b.id, title: `${first(a)} and ${first(b)}`,
            lines: [`${a.name} is waiting outside your door.`, `"${lead}"`],
            opts: [
              { code: 'a', label: `Back ${first(a)}`, hint: `${first(b)} is told to back off. ${first(b)} won’t like it.` },
              { code: 'b', label: `Side with ${first(b)}`, hint: `${first(a)} is told to drop it.` },
              { code: 'split', label: 'Sit them both down', hint: 'Each gives a little. Nobody’s happy. Nobody gets hurt.' },
              { code: 'leave', label: 'Tell them to sort it out themselves', hint: 'They might.' },
            ],
          });
        },
      });
      break;
    }
  }
  return out;
}

function shopBegs(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  for (const b of Object.values(w.biz).filter((x) => x.open && x.protection?.collectorId === p.id && lateOf(x) > 0 && !pending(w, 'shop', x.ownerId))) {
    const o = w.chars[b.ownerId];
    out.push({
      weight: 1.3,
      make: () => {
        // What he says depends on what is true. A man who has the money and is sitting on it does not plead poverty to your face
        // unless he is willing to lie; the till, the shelves and the street tell you which kind you are talking to.
        const lead = b.protection?.why === 'delayed'
          ? by(o, 'shop' + w.now, {
            frightened: [`It slipped my mind. It won’t happen again. Please.`],
            earnest: [`A misunderstanding. I wasn’t sure who the envelope was meant for, with everything going on.`],
            proud: [`You’ll have it. I don’t like being rushed.`],
            bitter: [`You want your money? You’ll get your money. Don’t stand in my shop like you own it.`],
          })
          : by(o, 'shop' + w.now, {
          frightened: [`I have it. I’ll have it. I just don’t have it today. Please don’t send anyone.`],
          earnest: [`It has been a terrible month. The delivery man, the stove, my wife in the hospital. Give me a week.`],
          proud: [`I have never been late in my life. I’m asking you for time, not mercy.`],
          bitter: [`You people take and take. Fine. But you can’t take what isn’t there.`],
        });
        const ev = evidence(w, b);
        addEnc(w, {
          kind: 'shop', from: o.id, about: undefined, title: `${o.name} at ${b.name}`,
          lines: [`${o.name} is behind the counter, and he doesn’t pretend to be glad to see you.`, `"${lead}"`, ...(ev.length ? [ev.join(' ')] : [])],
          opts: [
            { code: 'week', label: 'Give him a week', hint: 'He’ll pay it. He’ll remember it was you who let him.' },
            { code: 'half', label: 'Forgive half, take the rest Friday', hint: 'It costs you, and it buys more than it costs.' },
            { code: 'hard', label: 'No. Today.', hint: 'Fear collects. It doesn’t keep.' },
          ],
          data: { biz: b.id },
        });
      },
    });
  }
  return out;
}

// What a tip is about, without the names. That is what you are paying for.
function teaser(w: World, f: Fact): string {
  const biz = f.business ? w.biz[f.business]?.name : undefined;
  const t = {
    beating: 'a beating', vandalism: biz ? `a smash-up at ${biz}` : 'a smash-up', robbery: biz ? `a robbery at ${biz}` : 'a robbery', burglary: biz ? `a break-in at ${biz}` : 'a break-in',
    theft: 'a theft', scam: 'a swindle', poach: biz ? `someone muscling in on ${biz}` : 'someone muscling in on a shop', murder: 'a killing', protection_refused: biz ? `${biz} refusing to pay` : 'a shop refusing to pay',
    protection_late: biz ? `${biz} falling behind on its envelope` : 'a late envelope', side_operation: 'a man’s side business', arrest: 'an arrest', discipline: 'a man being put in his place', loan: 'money changing hands',
  }[f.kind as string] ?? 'something that happened';
  return `${t} in ${f.district}`;
}
const implication = (f: Fact) =>
  ({ beating: 'Now you know whose fists to watch for.', vandalism: 'Somebody wants a message read. Now you can read it back.', robbery: 'A man who robs one till will rob another.', burglary: 'A man who breaks in once breaks in twice.', scam: 'A man who can talk a stranger out of money is worth knowing about.',
    poach: 'Somebody is taking what isn’t theirs. That gets men killed, or gets you thanked.', protection_refused: 'A shop that says no is a shop somebody has to answer for.', protection_late: 'A shop that’s short is a shop you can help, or squeeze.', side_operation: 'A man with a side business has money that isn’t in the books.',
  } as Record<string, string>)[f.kind] ?? 'File it away. Here, information is the only thing worth more than cash.';

// A tip is only worth a conversation if it tells you something you can use. Rare, and it costs real money.
function tipSale(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  if ((p.cooldown.tipsale ?? 0) > w.now) return out;
  const sellers = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && !['boss', 'underboss', 'capo'].includes(c.rank) && (c.traits.greed > 0.5 || c.problem?.kind === 'debt') && (c.rels[p.id]?.trust ?? 0) >= 0.2 && !pending(w, 'tip', c.id));
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id);
  const hidden = crew.filter((c) => c.books.side && !c.books.sideKnown);
  const troubled = crew.filter((c) => c.problem && !c.problem.revealed && c.problem.sev > 0.3);
  const leaving = crew.filter((c) => c.want?.kind === 'independent' && !p.known['leave:' + c.id]);
  for (const c of sellers.slice(0, 2)) {
    const who = hidden.find((x) => x.id !== c.id) ?? troubled.find((x) => x.id !== c.id) ?? leaving.find((x) => x.id !== c.id);
    const kind = who ? (hidden.includes(who) ? 'side' : troubled.includes(who) ? 'trouble' : 'leaving') : 'score';
    out.push({
      weight: 0.08,
      make: () => {
        const price = Math.round(w.rng.int(100, 300) / 10) * 10;
        const about = kind === 'side' ? `one of your own men has money you don’t know about` : kind === 'trouble' ? `one of your men is in trouble he isn’t telling you about` : kind === 'leaving' ? `somebody under you is talking about going out on his own` : `a place where money is lying around, and not many people know`;
        p.cooldown.tipsale = w.now + 30 * DAY;
        addEnc(w, {
          kind: 'tip', from: c.id, title: `${first(c)} has something to sell`,
          lines: [`${c.name} finds you away from the others.`, `"I know something you’d want to know. ${money(price)}, and it’s about ${about}."`],
          opts: [
            { code: 'buy', label: `Pay ${money(price)}`, hint: `You learn ${kind === 'score' ? 'where the money is' : 'who, and what'}.` },
            { code: 'haggle', label: `Offer half (${money(Math.round(price / 20) * 10)})`, hint: 'He may take it. He may walk.' },
            { code: 'no', label: 'No thanks' },
          ],
          data: { price, kind, who: who?.id ?? '' },
          days: 4,
        });
      },
    });
  }
  return out;
}

function callIn(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  for (const f of owing(w, p.id).filter((x) => w.now - x.t > 8 * DAY && !x.asked)) {
    const c = w.chars[f.from];
    if (!c?.alive || pending(w, 'callin', c.id)) continue;
    out.push({
      weight: 2,
      make: () => {
        f.asked = true;
        const ask = pick(['money', 'muscle', 'silence'], f.id);
        const lead = by(c, 'call' + f.id, {
          proud: [`I don’t collect. But there’s something that needs doing, and you owe me ${favourWord(f.size)}.`],
          schemer: [`Remember ${f.what}? I’m calling it in.`],
          cold: [`${f.what}. Now I need something.`],
          jovial: [`My friend, remember ${f.what}? It’s time to be friends in the other direction.`],
          earnest: [`I hate to do this. But after ${f.what}, I have nobody else to ask.`],
        });
        const txt = ask === 'money' ? 'He needs $300 and he needs it quietly.' : ask === 'muscle' ? 'There’s a man who needs to be persuaded, and he wants you standing beside him when it happens.' : 'He needs you to say nothing about something you saw. Not to the boss, not to anyone.';
        // V89: calling in a favour is a matter between you (asks.ts 'favour'): you can agree, offer part of it, ask for time or
        // refuse, and he comes back to it in his own way; refusing what you owe costs you, and gets around.
        const s = callFavour(w, c, p, f, ask as 'money' | 'muscle' | 'silence', ask === 'money' ? 300 : undefined);
        if (s) { putToPlayer(w, s, [`${c.name} asks to speak to you.`, `"${lead}"`, txt]); return; }
        addEnc(w, {
          kind: 'callin', from: c.id, title: `${first(c)} calls in a favour`,
          lines: [`${c.name} asks to speak to you.`, `"${lead}"`, txt],
          opts: [
            { code: 'pay', label: ask === 'money' ? 'Pay it' : ask === 'muscle' ? 'Stand beside him' : 'Say nothing', hint: `Settles it. He’ll know what you’re worth.` },
            { code: 'bargain', label: 'Do half of it, and ask him to call it square', hint: 'He can say no.' },
            { code: 'stall', label: 'Not now', hint: 'It won’t go away. It will get heavier.' },
          ],
          data: { ask, fav: f.id },
          days: 5,
        });
      },
    });
  }
  return out;
}

function witnessTell(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  for (const c of Object.values(w.chars).filter((x) => x.alive && x.id !== p.id && (x.rels[p.id]?.trust ?? 0) >= 0.5 && !pending(w, 'tell', x.id)).slice(0, 12)) {
    const f = Object.entries(c.known).map(([id, k]) => [w.facts[id], k] as const).find(([q, k]) => q && !q.minor && k.knowsActor && !p.known[q.id] && q.victim && (w.chars[q.victim]?.bossId === p.id || q.victim === p.id) && w.now - q.t < 20 * DAY);
    if (!f) continue;
    out.push({
      weight: 0.7,
      make: () => {
        const [q] = f;
        learn(w, p.id, q, c.id, true);
        addEnc(w, {
          kind: 'tell', from: c.id, title: `${first(c)} tells you what he saw`,
          lines: [`${c.name} isn’t a talker, and he has come to you anyway.`, `"I was there. ${q.text} I thought you would want to hear it from somebody who doesn’t have a reason to lie."`],
          opts: [{ code: 'thanks', label: 'Thank him. Ask who else knows' }, { code: 'quiet', label: 'Tell him to keep it to himself' }],
          data: { fact: q.id },
          days: 3,
        });
      },
    });
  }
  return out;
}

// A man behind on a loan from somebody else asks you to speak for him.
function debtorAsk(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  for (const d of w.debts.filter((x) => x.status === 'active' && x.missed >= 1 && x.creditor !== p.id && x.debtor !== p.id).slice(0, 6)) {
    const c = w.chars[d.debtor], cr = w.chars[d.creditor];
    if (!c?.alive || !cr?.alive || c.rank === 'civilian' && (c.rels[p.id]?.trust ?? 0) < 0.2 || pending(w, 'debtor', c.id)) continue;
    if ((c.rels[p.id]?.trust ?? 0) < 0.25) continue;
    out.push({ weight: 0.9, key: 'debtor', make: () => addEnc(w, {
      kind: 'debtor', from: c.id, about: cr.id, title: `${first(c)} is behind with ${first(cr)}`,
      lines: [`${c.name} has been avoiding the place he usually drinks.`, `"I owe ${cr.name} ${money(d.balance)}. I’m ${d.missed} payment${d.missed > 1 ? 's' : ''} behind, and I know what that sounds like. If you spoke to him, he’d listen. He wouldn’t listen to me."`],
      opts: [
        { code: 'speak', label: `Speak to ${first(cr)} for him`, hint: 'Buys him a week. Your name goes with his.' },
        { code: 'cover', label: `Cover this week’s ${money(d.weeklyPayment)} yourself`, hint: 'The debt stays. You become his creditor too, in a way.' },
        { code: 'no', label: 'Tell him it’s his debt' },
      ],
      data: { debt: d.id }, days: 4,
    }) });
  }
  return out;
}

// A shop under your wing is being leaned on by another family: the owner comes to you.
function shopHelp(w: World, p: Character): Cand[] {
  const out: Cand[] = [];
  for (const d of (w.disputes ?? []).filter((x) => x.status === 'open' && x.biz && w.biz[x.biz!]?.protection?.collectorId === p.id && x.b !== p.id && x.a !== p.id)) {
    const b = w.biz[d.biz!], o = w.chars[b.ownerId], x = w.chars[d.b];
    if (!o?.alive || !x?.alive || pending(w, 'shophelp', o.id)) continue;
    out.push({ weight: 1.2, key: 'shophelp', make: () => addEnc(w, {
      kind: 'shophelp', from: o.id, about: x.id, title: `${first(o)} says ${first(x)} is back`,
      lines: [`${o.name} is waiting at the back of ${b.name}.`, `"${x.name} was in again. He says I’ll be paying his people soon. I’ve paid you, I’ve been loyal. What are you going to do about it?"`],
      opts: [
        { code: 'look', label: 'Say you’ll look into it', hint: 'Opens it as a dispute you can pursue.' },
        { code: 'sit', label: `Promise a sit-down with ${first(x)}`, hint: 'It will take a few days to set up.' },
        { code: 'no', label: 'Tell him to hold on', hint: 'He may start looking for someone else to pay.' },
      ],
      data: { dispute: d.id }, days: 4,
    }) });
  }
  return out;
}

const GENERATORS = [loanAsk, favourAsk, mediate, shopBegs, tipSale, callIn, witnessTell, debtorAsk, shopHelp];

// ------------------------------------------------------------ the tick

// A scene that no longer makes sense just goes away.
function pruneEnc(w: World, p: Character) {
  for (const e of w.enc) {
    if (e.status !== 'open') continue;
    const c = e.from ? w.chars[e.from] : undefined;
    let gone = !!e.from && !c?.alive;
    const about = e.about ? w.chars[e.about] : undefined;
    if (e.kind === 'shop') { const b = w.biz[String(e.data?.biz)]; gone = gone || !b?.open || !b.protection || lateOf(b) < 1; }
    else if (e.kind === 'mediate') gone = gone || !about?.alive || (c?.rels[about.id]?.grudge ?? 0) < 0.08;
    else if (e.kind === 'favour_ask' && e.data?.kind === 'release') { const j = w.chars[String(e.data?.jailed)]; gone = gone || !j?.alive || j.jailedUntil <= w.now; }
    else if (e.kind === 'tip') gone = gone || !!p.known[String(e.data?.fact)];
    else if (e.kind === 'callin') gone = gone || !!w.favours.find((f) => f.id === e.data?.fav)?.settled;
    else if (e.kind === 'threat') { const t = w.threats[String(e.data?.enemy)]; gone = !t || !w.chars[t.enemy]?.alive || w.now < t.truce; }
    else if (e.kind === 'invite') { const ev = w.events.find((x) => x.id === e.data?.ev); gone = gone || !ev || w.now > ev.t + DAY; }
    else if (e.kind === 'debtor') gone = gone || w.debts.find((d) => d.id === e.data?.debt)?.status !== 'active';
    else if (e.kind === 'shophelp') gone = gone || (w.disputes ?? []).find((d) => d.id === e.data?.dispute)?.status !== 'open';
    else if (e.kind === 'squeeze') gone = gone || w.ops.find((o) => o.id === e.data?.op)?.state === 'closed';
    else if (e.kind === 'suspect') gone = gone || !w.chars[String(e.data?.sus)]?.alive;
    if (gone) e.status = 'lapsed';
  }
}

export function encounterTick(w: World) {
  const p = PL(w);
  if (!p?.alive || !p.familyId) return;
  pruneEnc(w, p);
  // lapse
  for (const e of w.enc.filter((x) => x.status === 'open' && x.expires <= w.now)) lapse(w, p, e);
  w.enc = w.enc.filter((e) => e.status === 'open' || w.now - e.t < 20 * DAY);
  const open = openOf(w).length;
  if (open >= 4) return;
  const rankBonus = { associate: 0, soldier: 0.1, capo: 0.2, underboss: 0.2, boss: 0.2, civilian: 0 }[p.rank];
  if (!w.rng.chance(0.4 + rankBonus + clamp(p.standing / 400, 0, 0.2))) return;
  const cands = GENERATORS.flatMap((g) => g(w, p)).map((c) => ({ ...c, weight: c.weight / (1 + recentOf(w, c.key) * 1.5) }));
  if (!cands.length) return;
  const total = cands.reduce((a, c) => a + c.weight, 0);
  let x = w.rng.next() * total;
  for (const c of cands) {
    x -= c.weight;
    if (x <= 0) { const before = w.enc.length; c.make(); if (w.enc.slice(before).some((n) => n.kind === 'favour_ask')) p.cooldown.favask = w.now + 6 * DAY; return; }
  }
}

// How many of the same template the player has seen lately.
function recentOf(w: World, key?: string): number {
  if (!key) return 0;
  return w.enc.filter((e) => w.now - e.t < 25 * DAY && (e.data?.kind === key || e.kind === key || (key === 'alibi' && e.data?.kind === 'cover'))).length;
}

// Used by places: someone has been waiting for you to walk in.
export function forceEncounter(w: World): boolean {
  const p = PL(w);
  if (openOf(w).length >= 4) return false;
  const cands = GENERATORS.flatMap((g) => g(w, p));
  if (!cands.length) return false;
  const total = cands.reduce((a, c) => a + c.weight, 0);
  let x = w.rng.next() * total;
  for (const c of cands) {
    x -= c.weight;
    if (x <= 0) {
      c.make();
      return true;
    }
  }
  return false;
}

function lapse(w: World, p: Character, e: Enc) {
  e.status = 'lapsed';
  const c = e.from ? w.chars[e.from] : undefined;
  if (!c?.alive) return;
  const r = rel(c, p.id);
  if (['loan', 'favour_ask', 'tell'].includes(e.kind)) {
    r.respect = clamp(r.respect - 0.04);
    r.trust = clamp(r.trust - 0.03);
  } else if (e.kind === 'callin') {
    r.respect = clamp(r.respect - 0.1);
    r.grudge = clamp(r.grudge + 0.08);
    addFact(w, { kind: 'favour', actor: p.id, victim: c.id, minor: true, text: `${p.name} let ${c.name} wait on a favour he was owed.`, district: c.district }, { witnesses: [c.id] });
  } else if (e.kind === 'mediate' && e.about && w.chars[e.about]) {
    rel(c, e.about).grudge = clamp(rel(c, e.about).grudge + 0.1);
  } else if (e.kind === 'invite') {
    const h = w.chars[e.from!];
    if (h) {
      rel(h, p.id).respect = clamp(rel(h, p.id).respect - 0.06);
      p.standing = clamp(p.standing - 0.5, 0, 100);
    }
  } else if (e.kind === 'threat') {
    // an unanswered warning is still a warning
  }
}

// ------------------------------------------------------------ answering

export function choose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const c = e.from ? w.chars[e.from] : undefined;
  const lines: string[] = [];
  const done = (m = 20) => {
    e.status = 'done';
    return { lines, minutes: m };
  };
  const keep = (m = 15) => ({ lines, minutes: m }); // stays open
  if (e.kind === 'threat' && e.from) { const o = e.opts.find((x) => x.code === code); addFact(w, { kind: 'favour', actor: p.id, victim: e.from, story: 'threat:' + e.from, minor: true, text: `${p.name} answered ${w.chars[e.from]?.name ?? 'him'}: “${o?.label ?? code}”.`, district: p.district }, { witnesses: [p.id] }); }
  if (e.kind === 'ask') return answerAsk(w, p, e, code); // V89: the player answering an ask (matters.ts)
  if (e.kind === 'word') return answerWord(w, p, e, code); // V89: a superior's word about trouble
  if (e.kind === 'matter') return answerMatter(w, p, e, code); // V89: someone in a matter wants the player's answer
  if (e.kind === 'crew') { lines.push(...crewChoose(w, p, e, code)); return { lines, minutes: 25 }; }
  if (e.kind === 'loan' && c) return loan(w, p, e, c, code, lines, done, keep);
  if (e.kind === 'favour_ask' && c) return favourReply(w, p, e, c, code, lines, done, keep);
  if (e.kind === 'mediate' && c) return mediateReply(w, p, e, c, code, lines, done);
  if (e.kind === 'shop' && c) return shopReply(w, p, e, c, code, lines, done);
  if (e.kind === 'tip' && c) return tipReply(w, p, e, c, code, lines, done, keep);
  if (e.kind === 'callin' && c) return callReply(w, p, e, c, code, lines, done);
  if (e.kind === 'tell' && c) {
    const r = rel(c, p.id);
    if (code === 'thanks') {
      r.trust = clamp(r.trust + 0.05);
      const f = w.facts[String(e.data?.fact)];
      const others = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && f && x.known[f.id]).slice(0, 4);
      lines.push(`${c.name} thinks. "${others.length ? others.map((o) => o.name).join(', ') + ' know.' : 'Nobody I know of.'} I didn’t hear it from anybody. I saw it."`);
    } else lines.push(`${c.name} nods once. "Not a word."`);
    return done(10);
  }
  if (e.kind === 'squeeze' && c) {
    const op = w.ops.find((o) => o.id === e.data?.op);
    if (code === 'pay') {
      if (p.cash < 300) { lines.push('You can’t cover it.'); return keep(5); }
      p.cash -= 300;
      c.cash += 300;
      rel(c, p.id).respect = clamp(rel(c, p.id).respect + 0.04);
      lines.push(`${c.name}'s man takes the envelope and counts none of it. "He’ll be pleased." You know it’s not a one-time thing.`);
    } else if (code === 'boss') {
      const boss = p.bossId ? w.chars[p.bossId] : undefined;
      if (boss && w.rng.chance(0.5 + rel(boss, p.id).trust * 0.3)) lines.push(`${boss.name} has a quiet word with the right man. Nothing more is heard. You owe ${boss.name.split(' ')[0]} something now.`);
      else { lines.push(`${boss?.name ?? 'Nobody'} won’t stand up for a ${op ? 'racket' : 'side thing'} this small. You’re on your own.`); }
    } else {
      rel(c, p.id).grudge = clamp(rel(c, p.id).grudge + 0.2);
      // He may well send someone. Whether, and when, depends on how he feels and what else is going on.
      if (op) (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(2, 7) * DAY, kind: 'intent', a: c.id, b: p.id, c: op.id, note: 'raidop' });
      lines.push(`The man leaves without a word. Whatever ${c.name} makes of it, you’ll find out in his own time.`);
    }
    return done(30);
  }
  if (['meet', 'partner', 'kin'].includes(e.kind) && w.life) {
    const r = lifeChoose(w, p, e, code);
    lines.push(...r.lines);
    e.status = 'done';
    return { lines, minutes: r.minutes };
  }
  if (e.kind === 'suspect' || e.kind === 'side') {
    lines.push(...politicsChoose(w, p, e, code));
    return done(code === 'watch' ? 72 * 60 : 30);
  }
  if (e.kind === 'promo') {
    lines.push(...promoChoose(w, p, e, code));
    return done(40);
  }
  if (e.kind === 'debtor' && c) {
    const d = w.debts.find((q) => q.id === e.data?.debt);
    const cr = w.chars[String(e.about)];
    if (!d || d.status !== 'active') { lines.push(`${c.name} laughs, relieved. "I sorted it out. Forget I asked."`); return done(5); }
    if (code === 'speak' && cr) {
      const ok = w.rng.chance(clamp(0.35 + rel(cr, p.id).respect * 0.4 + p.standing / 300, 0.15, 0.85));
      if (ok) { d.nextDue += 7 * DAY; d.missed = Math.max(0, d.missed - 1); addFavour(w, p.id, c.id, 1, `speaking for him to ${cr.name}`); rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.1); lines.push(`${cr.name} listens, thinks, and gives ${c.name} a week. "For you," he says. ${c.name} will know whose week it was.`); }
      else { rel(cr, p.id).respect = clamp(rel(cr, p.id).respect - 0.03); lines.push(`${cr.name} shakes his head. "Money is money." You’ve spent a favour of your own and got nothing for it.`); }
      return done(45);
    }
    if (code === 'cover') {
      const amt = Math.min(d.weeklyPayment, p.cash);
      if (amt < d.weeklyPayment) { lines.push('You haven’t got that on you.'); return keep(5); }
      p.cash -= amt; c.cash += amt; payDebt(w, d, amt);
      addFavour(w, p.id, c.id, 2, `covering a week’s payment`);
      rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.15);
      lines.push(`You hand ${c.name} the money and watch him walk it over himself. The debt stays where it is, except that he owes you, too.`);
      return done(30);
    }
    rel(c, p.id).trust = clamp(rel(c, p.id).trust - 0.04);
    lines.push(`${c.name} nods. "Sure. It’s my debt."`);
    return done(10);
  }
  if (e.kind === 'shophelp' && c) {
    const d = (w.disputes ?? []).find((q) => q.id === e.data?.dispute);
    if (!d || d.status !== 'open') { lines.push(`${c.name} brightens. "It’s over. Whatever you did, thank you."`); return done(5); }
    if (code === 'look') { d.seen = true; lines.push(`"I’ll look into it," you tell ${c.name}. It’s now on your list under Disputes.`); rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.03); return done(15); }
    if (code === 'sit') { lines.push(...callSitdown(w, p, d)); return done(20); }
    rel(c, p.id).trust = clamp(rel(c, p.id).trust - 0.08);
    lines.push(`${c.name} says nothing. A man who’s been told to wait starts counting who else he could pay.`);
    return done(10);
  }
  if (e.kind === 'invest') { lines.push(...investChoose(w, p, e, code)); return done(15); }
  if (e.kind === 'sitdown') { lines.push(...sitdownChoose(w, p, e, code)); return done(90); }
  if (e.kind === 'invite') return inviteReply(w, p, e, code, lines, done);
  if (e.kind === 'threat') return threatReply(w, p, e, code, lines, done);
  lines.push('Nothing comes of it.');
  return done(5);
}

type Done = (m?: number) => { lines: string[]; minutes: number };

function loan(w: World, p: Character, e: Enc, c: Character, code: string, lines: string[], done: Done, keep: Done) {
  const amt = Number(e.data?.amt);
  const r = rel(c, p.id);
  const real = String(e.data?.real);
  if (code === 'ask') {
    if (e.data) e.data.asked = 1;
    const pr = clamp(0.3 + r.trust * 0.4 + (['earnest', 'frightened'].includes(arch(c)) ? 0.2 : arch(c) === 'proud' ? -0.15 : 0), 0.1, 0.9);
    if (real && w.rng.chance(pr) && c.problem) {
      c.problem.revealed = true;
      lines.push(`${c.name} looks at the floor. ${by(c, 'real' + e.id, {
        proud: [`"It’s ${PROBLEM_LABEL[c.problem.kind]}. I should have come sooner."`],
        frightened: [`"${PROBLEM_LABEL[c.problem.kind]}. I didn’t want you to know. Please don’t think less of me."`],
        earnest: [`"It’s ${PROBLEM_LABEL[c.problem.kind]}. I didn’t want to say."`],
        _: [`"It’s ${PROBLEM_LABEL[c.problem.kind]}. Now you know."`],
      })}`);
      e.opts = e.opts.filter((o) => o.code !== 'ask');
      return keep(15);
    }
    r.trust = clamp(r.trust - 0.04);
    lines.push(`${c.name} stiffens. "I told you what it’s for." You’re not sure whether that was the truth or just his pride.`);
    e.opts = e.opts.filter((o) => o.code !== 'ask');
    return keep(15);
  }
  if (code === 'no') {
    r.respect = clamp(r.respect - 0.02);
    r.trust = clamp(r.trust - 0.05);
    lines.push(by(c, 'no' + e.id, {
      proud: [`${c.name} takes it like a man who has been refused before. "Understood."`],
      bitter: [`"Of course." He says it the way a man says a thing he’ll remember.`],
      frightened: [`${c.name} swallows. "Right. I understand. Forget I asked."`],
      hothead: [`${c.name} nods too many times and leaves without saying goodbye.`],
      _: [`${c.name} nods. "I understand."`],
    }));
    return done(10);
  }
  const give = code === 'give' ? amt : code === 'half' ? Math.round(amt / 2) : amt;
  if (p.cash < give) {
    lines.push(`You reach for it and it’s not there. You can’t cover ${money(give)} right now.`);
    return keep(10);
  }
  p.cash -= give;
  const sit = (w.situations ?? []).find((x) => x.who === c.id && x.stage !== 'resolved');
  const sb = sit?.biz ? w.biz[sit.biz] : undefined;
  if (sb) bizMove(w, sb, give, 'aid', p.id); else c.cash += give; // money goes to where the trouble is, once
  if (c.problem) c.problem.sev = clamp(c.problem.sev - 0.15);
  if (sit) { sit.helped = true; sit.knows = true; sit.stage = 'handling'; if (sb) sb.distress = Math.max(0, sb.distress - 1); }
  if (code === 'give') {
    addFavour(w, p.id, c.id, 2, `the ${money(give)} you slipped him and never mentioned again`);
    r.trust = clamp(r.trust + 0.12);
    r.affection = clamp(r.affection + 0.12);
    lines.push(by(c, 'give' + e.id, {
      proud: [`${c.name} doesn’t say thank you. He puts a hand on your arm and holds it there a moment. That’s thanks.`],
      earnest: [`${c.name}'s eyes are wet. "I’ll never forget this." You believe he means it.`],
      jovial: [`${c.name} embraces you. "A man like you, I would take a bullet." You hope it doesn’t come to that.`],
      schemer: [`${c.name} puts the money away carefully. "Consider me yours." It’s exactly what he says to everybody.`],
      _: [`${c.name} pockets it and nods. "I’ll remember."`],
    }));
  } else {
    createDebt(w, p.id, c.id, give, 0.05, 'a loan from you');
    addFact(w, { kind: 'loan', actor: p.id, victim: c.id, amount: give, minor: true, text: `${p.name} lent ${c.name} ${money(give)}.`, district: c.district }, { witnesses: [c.id] });
    r.trust = clamp(r.trust + (code === 'half' ? 0.02 : 0.06));
    lines.push(code === 'half' ? `${c.name} takes ${money(give)}. "It’s something." He’s working out how much of what he needed is still missing.` : `${c.name} takes the money and the weekly with it. "You’re a decent man. You’ll have it back."`);
  }
  return done(20);
}

function favourReply(w: World, p: Character, e: Enc, c: Character, code: string, lines: string[], done: Done, keep: Done) {
  const r = rel(c, p.id);
  const kind = String(e.data?.kind);
  if (code === 'no') {
    r.respect = clamp(r.respect - 0.03);
    r.trust = clamp(r.trust - 0.04);
    lines.push(`${c.name} takes it with a nod that means he heard it. "Another time."`);
    return done(10);
  }
  if (code === 'soft') {
    r.trust = clamp(r.trust - 0.01);
    lines.push(`"We will see." ${c.name} knows what that means. He thanks you anyway.`);
    return done(10);
  }
  if (code === 'ask' && kind === 'cover') {
    const df = w.facts[String(e.data?.fact)];
    if (df) { learn(w, p.id, df, c.id, true); lines.push(`${c.name} hesitates, then says it. "${factText(df, true)}" He has told you more than he wanted to, and now you know exactly what you’d be lying about.`); }
    else lines.push(`${c.name} won’t say.`);
    e.opts = e.opts.filter((o) => o.code !== 'ask');
    return keep(10);
  }
  if (kind === 'word') {
    const boss = w.chars[String(e.about)];
    const cap = clamp(0.25 + p.standing / 150 + (boss ? rel(boss, p.id).trust * 0.3 : 0) - (c.problem && c.problem.sev > 0.5 ? 0.15 : 0));
    const ok = w.rng.chance(cap);
    if (ok && boss) {
      rel(boss, c.id).respect = clamp(rel(boss, c.id).respect + 0.08);
      c.backer = p.id;
      addFavour(w, p.id, c.id, code === 'price' ? 3 : 2, `putting in a word with ${boss.name}`);
      lines.push(`${boss.name} listens, and says: "I’ll keep it in mind." That’s yes, from him. ${c.name} will hear it was you.`);
    } else {
      p.standing = clamp(p.standing - 1.5, 0, 100);
      lines.push(`${boss?.name ?? 'He'} hears you out, and then says: "I have my own opinion of ${c.name}." You come away thinking you spent something and bought nothing.`);
      r.trust = clamp(r.trust + 0.02);
    }
    if (code === 'price') r.respect = clamp(r.respect - 0.02);
    return done(40);
  }
  if (kind === 'cover') {
    if (code !== 'do') return done(5);
    p.heat = clamp(p.heat + 0.08, 0, 1.5);
    addFavour(w, p.id, c.id, 2, `saying you were with him ${String(e.data?.when ?? 'that night')}`);
    r.trust = clamp(r.trust + 0.1);
    const df2 = w.facts[String(e.data?.fact)];
    if (df2) { df2.hiddenActor = true; if (df2.victim) for (const x of Object.values(w.chars)) if (x.known[df2.id] && x.id !== p.id && x.id !== c.id) x.known[df2.id].knowsActor = false; }
    lines.push(`"Cards at the club, ${String(e.data?.when ?? 'that night')}." You say it twice so it will sound like something you remember. ${c.name} exhales.`);
    return done(20);
  }
  if (kind === 'release') {
    if (p.cash < 300) {
      lines.push('You don’t have it right now. You tell him you’ll see what you can do. You both know what that means.');
      return keep(5);
    }
    p.cash -= 300;
    const j = w.chars[String(e.data?.jailed)];
    if (j) j.jailedUntil = Math.min(j.jailedUntil, w.now + 2 * DAY);
    addFavour(w, p.id, c.id, 3, `getting ${j?.name ?? 'his man'} out`);
    r.trust = clamp(r.trust + 0.15);
    lines.push(`A call, a clerk, an envelope. ${j?.name ?? 'The man'} is out in two days, and ${c.name} will remember whose phone it was.`);
    return done(60);
  }
  return done(5);
}

function mediateReply(w: World, p: Character, e: Enc, a: Character, code: string, lines: string[], done: Done) {
  const b = w.chars[String(e.about)];
  if (!b) return done(5);
  const ra = rel(a, p.id);
  const rb = rel(b, p.id);
  if (code === 'a') {
    ra.trust = clamp(ra.trust + 0.08);
    rb.trust = clamp(rb.trust - 0.07);
    rb.respect = clamp(rb.respect - 0.04);
    rel(a, b.id).grudge = clamp(rel(a, b.id).grudge - 0.1);
    addFavour(w, p.id, a.id, 1, `taking his side against ${b.name}`);
    lines.push(`You tell ${b.name} it’s over. He hears it as what it is. ${a.name} walks away lighter. ${b.name} walks away with a note he won’t forget.`);
  } else if (code === 'b') {
    rb.trust = clamp(rb.trust + 0.08);
    ra.trust = clamp(ra.trust - 0.07);
    ra.respect = clamp(ra.respect - 0.04);
    rel(a, b.id).grudge = clamp(rel(a, b.id).grudge + 0.04);
    addFavour(w, p.id, b.id, 1, `siding with him against ${a.name}`);
    lines.push(`You tell ${a.name} to drop it. His jaw does something and he nods. He’ll do as he’s told, which isn’t the same as agreeing.`);
  } else if (code === 'split') {
    rel(a, b.id).grudge = clamp(rel(a, b.id).grudge - 0.2);
    rel(b, a.id).grudge = clamp(rel(b, a.id).grudge - 0.2);
    ra.respect = clamp(ra.respect + 0.03);
    rb.respect = clamp(rb.respect + 0.03);
    p.standing = clamp(p.standing + 1, 0, 100);
    lines.push(`You put them at one table with a bottle between them. It takes two hours. Neither of them gets what he came for, which is how you know it’s fair.`);
    return done(120);
  } else {
    if (w.rng.chance(0.35)) {
      b.hurtUntil = w.now + 2 * DAY;
      addFact(w, { kind: 'beating', actor: a.id, victim: b.id, text: `${a.name} beat up ${b.name} over something between them.`, district: a.district }, { witnesses: [p.id] });
      p.standing = clamp(p.standing - 1, 0, 100);
      lines.push(`You leave it with them. Two days later ${b.name} is laid up. That one was on you.`);
    } else lines.push(`You tell them to sort it out like grown men. Maybe they do.`);
  }
  return done(30);
}

function shopReply(w: World, p: Character, e: Enc, o: Character, code: string, lines: string[], done: Done) {
  const b = w.biz[String(e.data?.biz)];
  if (!b?.protection) return done(5);
  const r = rel(o, p.id);
  if (code === 'week') {
    giveTime(b); // the arrears stand; he is not nagged about them for now
    r.trust = clamp(r.trust + 0.1);
    r.respect = clamp(r.respect + 0.04);
    lines.push(`${o.name} exhales like a man put down from a ladder. "A week." He’ll be on time. Probably.`);
  } else if (code === 'half') {
    { const half = Math.round(owedOf(b) / 2); const got = takeFromBiz(w, b, half, p.id); if (got > 0) earn(p, got, 'protection'); }
    r.trust = clamp(r.trust + 0.05);
    p.standing = clamp(p.standing + 0.5, 0, 100);
    lines.push(`"Half, and Friday for the rest." ${o.name} nods. He doesn’t smile. A man doesn’t smile at that.`);
  } else {
    r.trust = clamp(r.trust - 0.1);
    r.grudge = clamp(r.grudge + 0.1);
    const amt = takeFromBiz(w, b, Math.max(b.protection.fee, owedOf(b)), p.id, true);
    if (amt > 0) earn(p, amt, 'protection');
    clearArrears(b);
    lines.push(`${o.name} goes to the back and comes out with ${money(amt)} in an envelope that’s not his. He doesn’t look at you. The room is a little colder afterwards.`);
  }
  return done(20);
}

function tipReply(w: World, p: Character, e: Enc, c: Character, code: string, lines: string[], done: Done, keep: Done) {
  const price = Number(e.data?.price);
  const f = w.facts[String(e.data?.fact)];
  const r = rel(c, p.id);
  if (code === 'no') return done(5);
  let pay = price;
  if (code === 'haggle') {
    // V89 (the V85 bug: haggling with no reason was taken too easily). He takes half only if he needs the money now, and says so;
    // otherwise he names his own figure with the reason he has, or, a greedy man who doesn't need it, walks.
    const need = c.cash < price || (!!c.problem && ['debt', 'gambling'].includes(c.problem.kind) && c.problem.sev > 0.3);
    const kind = String(e.data?.kind);
    if (need && c.traits.greed <= 0.7) {
      pay = Math.round(price / 2);
      lines.push(`${c.name} looks at the money a long moment. "${c.cash < price ? 'I need it more than I need to argue.' : 'I owe a man who doesn’t wait.'} All right."`);
    } else if (c.traits.greed > 0.6 && !need && rel(c, p.id).trust < 0.5) {
      lines.push(`${c.name} shrugs and finishes his drink. "I don’t need your money that badly. Another time, then." The offer is gone.`);
      return done(10);
    } else {
      const counter = Math.round(price * 0.75 / 10) * 10;
      const why = kind === 'side' || kind === 'trouble' || kind === 'leaving' ? 'It’s about one of your own men. That’s worth more than half.' : 'There’s real money at the end of it, more than this.';
      e.data = { ...(e.data ?? {}), counter };
      e.opts = [{ code: 'counter', label: `Pay his ${money(counter)}`, hint: 'His figure. He told you why.' }, { code: 'buy', label: `Pay the ${money(price)} after all`, hint: 'What he asked in the first place.' }, { code: 'no', label: 'No thanks' }];
      lines.push(`${c.name} shakes his head. "${money(counter)}. ${why}"`);
      return keep(10);
    }
  }
  if (code === 'counter') pay = Number(e.data?.counter ?? price);
  if (p.cash < pay) {
    lines.push('You don’t have that on you.');
    return keep(5);
  }
  p.cash -= pay;
  c.cash += pay;
  r.trust = clamp(r.trust + 0.02);
  const kind = String(e.data?.kind);
  const who = e.data?.who ? w.chars[String(e.data.who)] : undefined;
  if (kind === 'side' && who) { who.books.sideKnown = true; addFact(w, { kind: 'side_operation', actor: who.id, minor: false, text: `${who.name} has a side business of about ${money(who.books.side ?? 0)} a week that isn’t in his envelope.`, district: who.district }, { witnesses: [p.id] }); lines.push(`${c.name} leans close. "${who.name}. He has something on the side, about ${money(who.books.side ?? 0)} a week, and none of it comes to you." You can ask him about it, or let it ride.`); }
  else if (kind === 'trouble' && who?.problem) { who.problem.revealed = true; lines.push(`${c.name} tells you ${who.name} is in trouble: ${({ gambling: 'he owes a bookmaker', debt: 'he’s behind on money he owes', family: 'there’s something wrong at home', drink: 'the drinking is getting worse', house: 'he needs a place to live', woman: 'there’s a woman who costs him', resentment: 'he thinks you’re squeezing him' } as Record<string, string>)[who.problem.kind] ?? 'something is wrong'}. Now you know what he hasn’t said.`); }
  else if (kind === 'leaving' && who) { p.known['leave:' + who.id] = { t: w.now, from: c.id, knowsActor: true }; lines.push(`${c.name} says ${who.name} has been talking to people about leaving you and working for himself. It isn’t gossip. He’s sounding men out.`); }
  else { const n = w.jobs.length; newOffer(w); lines.push(w.jobs.length > n ? `${c.name} gives you a place and a time. It’s on your Today screen. It’s a real one.` : `${c.name} has nothing solid after all. He gives half your money back.`); if (w.jobs.length <= n) { p.cash += Math.round(pay / 2); c.cash -= Math.round(pay / 2); } }
  void f;
  return done(20);
}

function callReply(w: World, p: Character, e: Enc, c: Character, code: string, lines: string[], done: Done) {
  const fav = w.favours.find((f) => f.id === e.data?.fav);
  const r = rel(c, p.id);
  const ask = String(e.data?.ask);
  if (code === 'stall') {
    if (fav) fav.asked = false;
    r.respect = clamp(r.respect - 0.05);
    lines.push(`${c.name} nods slowly. "A man who puts it off is telling me something." It will come around again.`);
    return done(10);
  }
  const half = code === 'bargain';
  const ok = !half || w.rng.chance(0.5 + r.trust * 0.2);
  if (!ok) {
    r.respect = clamp(r.respect - 0.08);
    if (fav) fav.asked = false;
    lines.push(`${c.name} looks at you for a long moment. "No. Square is square." He walks away, and what you owe him is still owed.`);
    return done(15);
  }
  if (ask === 'money') {
    const amt = half ? 150 : 300;
    if (p.cash < amt) {
      lines.push('You can’t cover it right now.');
      if (fav) fav.asked = false;
      return done(5);
    }
    p.cash -= amt;
    c.cash += amt;
  } else if (ask === 'muscle') {
    p.heat = clamp(p.heat + (half ? 0.05 : 0.12), 0, 1.5);
  } else {
    p.standing = clamp(p.standing - 0.5, 0, 100);
  }
  if (fav) fav.settled = true;
  r.trust = clamp(r.trust + 0.08);
  r.respect = clamp(r.respect + 0.04);
  lines.push(half ? `${c.name} considers it. "Fine. We’re square."` : `${c.name} takes it as a man takes what he’s owed. "We’re even. You’re a man who pays." That’s worth more than it sounds.`);
  return done(40);
}

// ------------------------------------------------------------ life events

export function eventTick(w: World) {
  const p = PL(w);
  if (!p?.alive || !p.familyId) return;
  // funerals
  for (const d of Object.values(w.chars)) {
    if (d.alive || !d.diedAt || w.now - d.diedAt > 3 * DAY || !d.familyId || !['soldier', 'capo', 'underboss', 'boss'].includes(d.rank)) continue;
    if (w.events.some((e) => e.about === d.id)) continue;
    const host = d.bossId && w.chars[d.bossId]?.alive ? w.chars[d.bossId] : Object.values(w.chars).find((c) => c.alive && c.familyId === d.familyId && c.rank === 'boss');
    if (!host) continue;
    const ev: LifeEvent = { id: newId(w, 'ev'), kind: 'funeral', t: w.now + 2 * DAY, host: host.id, about: d.id, place: pick(["St. Anthony's", 'a funeral home on Court Street', 'the chapel on Arthur Avenue'], d.id), invited: [] };
    w.events.push(ev);
    invite(w, p, ev, d.familyId === p.familyId || (p.rels[d.id]?.trust ?? 0) > 0.3);
  }
  // happy occasions
  if (w.rng.chance(0.035)) {
    const fam = w.fam[p.familyId];
    const host = w.rng.pick(Object.values(w.chars).filter((c) => c.alive && c.familyId === fam.id && ['soldier', 'capo', 'underboss'].includes(c.rank)));
    if (host && !w.events.some((e) => e.host === host.id && w.now - e.t < 90 * DAY)) {
      const kind = w.rng.chance(0.55) ? 'wedding' : 'christening';
      const ev: LifeEvent = { id: newId(w, 'ev'), kind, t: w.now + 4 * DAY, host: host.id, place: pick(['the hall on Bay Ridge Avenue', 'Our Lady of Pity', "the club's back room", 'a restaurant on Mulberry Street'], host.id + w.now), invited: [] };
      w.events.push(ev);
      invite(w, p, ev, true);
    }
  }
}

function invite(w: World, p: Character, ev: LifeEvent, yes: boolean) {
  if (!yes || pending(w, 'invite')) return;
  const host = w.chars[ev.host];
  const dead = ev.about ? w.chars[ev.about] : undefined;
  const lead = ev.kind === 'funeral'
    ? `"${dead?.name ?? 'He'} is being buried ${ev.place}. It would mean something if you were there."`
    : by(host, 'inv' + ev.id, {
        jovial: [`"My ${ev.kind === 'wedding' ? 'daughter is getting married' : 'grandson is being christened'} ${ev.place}, and I want everyone I like in the room. You’re on that list."`],
        proud: [`"My family is holding a ${ev.kind} at ${ev.place}. I expect to see you."`],
        _: [`"There’s a ${ev.kind} at ${ev.place}. Come. Bring something."`],
      });
  addEnc(w, {
    kind: 'invite', from: host.id, title: ev.kind === 'funeral' ? `A funeral: ${dead?.name ?? ''}` : `A ${ev.kind}`,
    lines: [`${host.name} sends word.`, lead],
    opts: [
      { code: 'big', label: `Go, with a $250 envelope`, hint: 'People see the thickness of it.' },
      { code: 'mid', label: 'Go, with $100', hint: 'The right amount.' },
      { code: 'small', label: 'Go, with $40', hint: 'Somebody will notice. Maybe not out loud.' },
      { code: 'no', label: 'Send regrets', hint: 'A man who doesn’t turn up is noticed.' },
    ],
    data: { ev: ev.id },
    days: 5,
  });
}

function inviteReply(w: World, p: Character, e: Enc, code: string, lines: string[], done: Done) {
  const ev = w.events.find((x) => x.id === e.data?.ev);
  const host = w.chars[e.from!];
  if (!ev || !host) return done(5);
  if (code === 'no') {
    rel(host, p.id).respect = clamp(rel(host, p.id).respect - 0.08);
    p.standing = clamp(p.standing - 0.8, 0, 100);
    lines.push(`You send your regrets. ${host.name} accepts them in the way people do when they’ll think about it later.`);
    return done(5);
  }
  const amt = { big: 250, mid: 100, small: 40 }[code] ?? 100;
  if (p.cash < amt) {
    lines.push('You don’t have that to put in an envelope. Nobody should find that out.');
    return { lines, minutes: 5 };
  }
  p.cash -= amt;
  ev.done = true;
  p.district = host.district;
  const guests = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && c.familyId && (c.familyId === host.familyId || (ev.kind === 'funeral' && c.rank === 'boss' && w.rng.chance(0.5))) && c.rank !== 'associate').slice(0, 14);
  const rh = rel(host, p.id);
  lines.push(ev.kind === 'funeral' ? `The church smells of wax and wet wool. Everyone is here, and everyone is watching who else is.` : ev.kind === 'wedding' ? `Wine, a band that has played this wedding forty times, and a table of men who aren’t dancing.` : `Babies, wine, and a priest who has the sense not to ask where the envelopes come from.`);
  if (code === 'big') {
    rh.respect = clamp(rh.respect + 0.06);
    p.standing = clamp(p.standing + 1.2, 0, 100);
    lines.push(`Your envelope is thick, and a man at the next table notices. By the end of the night so does everyone else.`);
  } else if (code === 'small') {
    rh.respect = clamp(rh.respect - 0.03);
    lines.push(`${host.name} doesn’t look at the envelope. That’s how you know he knows how much was in it.`);
  } else {
    rh.respect = clamp(rh.respect + 0.02);
    rh.trust = clamp(rh.trust + 0.03);
  }
  // vignettes
  const attendees = guests.filter((g) => w.rng.chance(0.6));
  const boss = host.familyId ? w.chars[w.fam[host.familyId].bossId] : undefined;
  if (boss?.alive && boss.id !== p.id && code !== 'small' && w.rng.chance(0.65)) {
    rel(boss, p.id).respect = clamp(rel(boss, p.id).respect + 0.04);
    rel(boss, p.id).trust = clamp(rel(boss, p.id).trust + 0.03);
    lines.push(`${boss.name} kisses your cheek in front of a room full of people. It’s a small thing and it will be talked about.`);
  }
  const intro = attendees.find((g) => !p.rels[g.id]);
  if (intro) {
    rel(p, intro.id).trust = 0.28;
    rel(intro, p.id).trust = 0.28;
    lines.push(`Somebody makes the introduction. ${intro.name}, ${intro.rank}, ${intro.district}. You talk about nothing for twenty minutes, which is how it’s done.`);
  }
  const talker = attendees.find((g) => g.id !== intro?.id);
  if (talker) {
    const f = Object.keys(talker.known).map((id) => w.facts[id]).find((q) => q && !q.minor && !p.known[q.id] && w.now - q.t < 40 * DAY);
    if (f) {
      learn(w, p.id, f, talker.id, true);
      lines.push(`Wine makes ${talker.name} careless, and he says it where you can hear: ${f.text}`);
    }
  }
  const cold = guests.find((g) => (g.rels[p.id]?.grudge ?? 0) >= 0.3);
  if (cold) lines.push(`${cold.name} watches you from across the room and doesn’t raise a glass when you do. Not here. Not today.`);
  if (ev.kind === 'funeral' && ev.about) {
    const d = w.chars[ev.about];
    const widowGift = amt >= 100;
    lines.push(widowGift ? `You press the envelope into the widow's hand and she holds on to it, and to you, a moment too long.` : `You say what people say to the widow, and it’s not enough, and nothing would be.`);
    void d;
  }
  return done(240);
}

// ------------------------------------------------------------ threat replies (see danger.ts)

import { threatChoose } from './danger';
import { promoChoose } from './career';
import { crewChoose } from './crewlife';
import { lifeChoose } from './life';
import { politicsChoose } from './politics';
function threatReply(w: World, p: Character, e: Enc, code: string, lines: string[], done: Done) {
  lines.push(...threatChoose(w, p, e, code));
  return done(code === 'hide' ? 8 * 24 * 60 : 30);
}

void (null as unknown as EncOpt);
