// Crew and authority (the made man's life, Phase 1.2). A man with men under him is someone men come to: to be taken on, with
// their quarrels, and, when one of them does something he shouldn't, to answer for it. What he decides is remembered by each man
// it touches (regard, grudges, facts with witnesses), and the crew's loyalty (orders.reliability, crewlife's restless men going
// over his head) reads it. Everything goes through the world's own doors: regard, grudges, facts, favours, the ledger, imposed.
import { addFact, bear, bearOn, clamp, feel, feelOn, money, peek, recordCareer, rel, repute, transfer } from './core';
import { addEnc } from './encounters';
import { applyRank } from './rank';
import { temper } from './temper';
import { DAY, type Character, type Enc, type Fact, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const MADE = ['soldier', 'capo', 'underboss', 'boss'];
const crewOf = (w: World, p: Character) => Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.id !== p.id);
const open = (w: World, kind: string) => w.enc.some((e) => e.kind === kind && e.status === 'open');
const HOSTILE = new Set(['vandalism', 'beating', 'robbery', 'burglary', 'theft', 'poach']);

/** The weekly turn: who comes to the player, and what comes up to him. Called from crewTick. */
export function authorityWeek(w: World, p: Character) {
  if (!p.alive || p.jailedUntil > w.now || !p.familyId) return;
  const crew = crewOf(w, p);
  if (MADE.includes(p.rank)) handedAMan(w, p, crew) || comesToYou(w, p, crew);
  answerUpstairs(w, p, crew);
}

// ------------------------------------------------------------ men come to him

/** Made, and nobody under him: his captain gives him a man to bring along (once). */
function handedAMan(w: World, p: Character, crew: Character[]): boolean {
  const cap = p.bossId ? w.chars[p.bossId] : undefined;
  if (crew.length || p.cooldown['givenMan'] || !cap?.alive) return false;
  // one of the captain's own associates, the steadiest he can spare; or a hopeful from the street, taken on for the player
  const spare = Object.values(w.chars).filter((c) => c.alive && c.bossId === cap.id && c.rank === 'associate' && c.jailedUntil <= w.now).sort((a, b) => b.traits.caution - a.traits.caution || (a.id < b.id ? -1 : 1))[0]
    ?? Object.values(w.chars).filter((c) => c.alive && c.prospect && c.rank === 'civilian').sort((a, b) => (b.district === p.district ? 1 : 0) - (a.district === p.district ? 1 : 0) || (a.id < b.id ? -1 : 1))[0];
  if (!spare) return false;
  p.cooldown['givenMan'] = w.now;
  takeOn(w, p, spare);
  feelOn(w, rel(spare, p.id), 'trust', 0.1);
  addEnc(w, {
    kind: 'cometo', from: cap.id, about: spare.id, title: `${first(cap)} gives you ${first(spare)}`, days: 5, data: { stage: 'handed' },
    lines: [`${cap.name} puts a hand on the shoulder of ${spare.name}.`, `“A made man needs somebody to send. Take ${first(spare)}. ${temper(spare).caution > 0.55 ? 'He’s careful, and he listens.' : spare.traits.ambition > 0.6 ? 'He’s hungry. Point him the right way.' : 'He’s green, but he shows up.'} What he does is on you now.”`],
    opts: [{ code: 'ok', label: `Thank ${first(cap)} and take him`, hint: `${first(spare)} answers to you from today.` }],
  });
  return true;
}

/** Somebody asks to run with him, for his own reasons. A made man with room for more, now and then. */
function comesToYou(w: World, p: Character, crew: Character[]): boolean {
  const room = 1 + Math.floor(p.standing / 25);
  if (crew.length >= room || (p.cooldown['cometo'] ?? 0) > w.now || open(w, 'cometo') || !w.rng.chance(0.4)) return false;
  // an associate whose own man is gone, inside or sour on him; or a hopeful on the player's street who has heard of him
  const why = (c: Character): string | undefined => {
    const b = c.bossId ? w.chars[c.bossId] : undefined;
    if (c.rank === 'associate' && c.familyId === p.familyId && c.bossId !== p.id && !b?.isPlayer) {
      if (!b?.alive) return 'gone';
      if (b.jailedUntil > w.now) return 'inside';
      if (peek(c, b.id).grudge >= 0.3 && peek(c, p.id).grudge < 0.1) return 'sour';
    }
    if (c.rank === 'civilian' && c.prospect && c.district === p.district && p.standing >= 30) return c.traits.ambition > 0.6 ? 'made' : 'money';
    return undefined;
  };
  const c = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.jailedUntil <= w.now && !!why(x)).sort((a, b) => peek(b, p.id).trust - peek(a, p.id).trust || b.traits.ambition - a.traits.ambition || (a.id < b.id ? -1 : 1))[0];
  if (!c) return false;
  p.cooldown['cometo'] = w.now + 21 * DAY;
  const r = why(c)!, b = c.bossId ? w.chars[c.bossId] : undefined;
  const said = r === 'gone' ? `“${b ? first(b) : 'The man I ran with'} is gone, and nobody’s told me who I answer to now. I’d rather it was you than whoever they give me.”`
    : r === 'inside' ? `“${first(b!)} is away for a while. I can’t sit on my hands till he’s out. I need somebody to work for, and people say you’re straight.”`
    : r === 'sour' ? `“I won’t say anything against ${first(b!)}. But I’m wasted where I am, and he knows it. Let me run with you.”`
    : r === 'made' ? '“I want to be somebody. I know nobody gets there on his own. I’d work for you, and I’d work hard.”'
    : '“I need the work. I’ve got a mother and two sisters and a landlord. Whatever you need done, I’ll do it.”';
  addEnc(w, {
    kind: 'cometo', from: c.id, title: `${first(c)} wants to run with you`, days: 7, data: { stage: 'asks', why: r },
    lines: [`${c.name} has been waiting for you outside the club.`, said],
    opts: [
      { code: 'take', label: `Take him on${c.rank === 'civilian' ? ` ($150 to set him up)` : ''}`, hint: r === 'sour' ? `He answers to you from today. ${first(b!)} won’t thank you for it.` : 'He answers to you from today, and what he does is on you.' },
      { code: 'prove', label: 'Tell him to show you something first', hint: 'He may come back with something. He may not come back.' },
      { code: 'no', label: 'Tell him you’re full', hint: 'Nothing lost. He’ll look elsewhere.' },
    ],
  });
  return true;
}

/** He is put under the player: an associate moved across, or a hopeful brought into the life. */
function takeOn(w: World, p: Character, c: Character) {
  recordCareer(w, c, `Taken on by ${p.name}`);
  if (c.rank === 'civilian') { c.prospect = false; applyRank(w, c, 'associate', { fact: false, career: false, place: (x) => { x.familyId = p.familyId; x.bossId = p.id; } }); }
  else c.bossId = p.id;
  feelOn(w, rel(c, p.id), 'trust', 0.15); rel(c, p.id).lastMet = w.now;
  addFact(w, { kind: 'promotion', actor: c.id, minor: true, text: `${c.name} has started running with ${p.name}.`, district: c.district }, { witnesses: [p.id, c.id] });
}

// ------------------------------------------------------------ quarrels brought to him

/** Two of his men have fallen out (crewlife's falling-out): it comes to him to settle. */
export function quarrel(w: World, p: Character, a: Character, b: Character, about: 'money' | 'credit' | 'words') {
  if (open(w, 'quarrel')) return false;
  // (the one with more to say for himself speaks first: the greedier man over money, the prouder over credit)
  const amt = about === 'money' ? Math.round((40 + Math.min(260, Math.max(a.cash, b.cash) * 0.05)) / 10) * 10 : 0;
  const lines = about === 'money' ? [`${first(a)} says ${first(b)} kept ${money(amt)} of what they made together. ${first(b)} says it was his end and ${first(a)} can count.`]
    : about === 'credit' ? [`${first(a)} says ${first(b)} has been telling people a piece of work was his. ${first(b)} says he did the hard part and everybody knows it.`]
    : [`Something was said at the club. ${first(a)} wants it taken back. ${first(b)} says he meant every word.`];
  // (one of them is in the wrong, as the crew mostly know: the greedier over money, the prouder over credit, the hotter over words)
  const score = (c: Character) => (about === 'money' ? c.traits.greed : about === 'credit' ? c.traits.ambition : temper(c).volatility);
  const wrong = score(a) >= score(b) ? a : b;
  addEnc(w, {
    kind: 'quarrel', from: a.id, about: b.id, title: `${first(a)} and ${first(b)} want you to settle it`, days: 5, data: { about, amt, wrong: wrong.id },
    lines: [`${a.name} and ${b.name} are both waiting for you, at opposite ends of the bar.`, ...lines],
    opts: [
      { code: 'hear', label: 'Hear them out, one at a time', hint: 'It takes an hour. A man’s story can change the second time he tells it.' },
      { code: 'a', label: `Back ${first(a)}`, hint: `${first(a)} will remember it. So will ${first(b)}.` },
      { code: 'b', label: `Back ${first(b)}`, hint: `${first(b)} will remember it. So will ${first(a)}.` },
      ...(about === 'money' && p.cash >= amt ? [{ code: 'pay', label: `Pay ${first(a)} the ${money(amt)} yourself and end it`, hint: 'Nobody loses face. It comes out of your pocket.' }] : []),
      { code: 'shake', label: 'Sit them down and make them shake hands', hint: 'If they respect you enough, it ends here. If not, it doesn’t.' },
      { code: 'leave', label: 'Tell them to sort it out themselves', hint: 'Grown men. Sometimes grown men settle things badly.' },
    ],
  });
  return true;
}

// ------------------------------------------------------------ answering upstairs

/** One of his men has hit a place the family looks after, or one of its men: his captain wants to know what he means to do. */
function answerUpstairs(w: World, p: Character, crew: Character[]) {
  const cap = p.bossId ? w.chars[p.bossId] : undefined;
  if (!cap?.alive || open(w, 'answer')) return;
  const ours = (f: Fact) => {
    const b = f.business ? w.biz[f.business] : undefined, v = f.victim ? w.chars[f.victim] : undefined;
    return (b?.protection?.familyId === p.familyId && b.protection.collectorId !== f.actor) || (!!v && v.familyId === p.familyId && v.rank !== 'civilian' && v.id !== p.id);
  };
  const f = Object.values(w.facts).filter((x) => HOSTILE.has(x.kind) && w.now - x.t < 10 * DAY && crew.some((c) => c.id === x.actor) && cap.known[x.id]?.knowsActor && !(cap.cooldown[`answered:${x.id}`]) && ours(x)).sort((a, b) => b.t - a.t)[0];
  if (!f) return;
  cap.cooldown[`answered:${f.id}`] = w.now;
  const man = w.chars[f.actor!], v = f.victim ? w.chars[f.victim] : undefined, place = f.business ? w.biz[f.business] : undefined;
  const what = place ? `${place.name} pays us. ${first(man)} ${f.kind === 'robbery' || f.kind === 'burglary' || f.kind === 'theft' ? 'robbed it' : f.kind === 'vandalism' ? 'smashed it up' : 'went in there and made trouble'}.` : `${v ? v.name : 'One of ours'} is one of ours, and ${first(man)} ${f.kind === 'beating' ? 'put him in the hospital' : 'took what was his'}.`;
  const owed = f.amount ? Math.min(800, Math.round(f.amount / 10) * 10) : f.kind === 'vandalism' ? 150 : 100;
  addEnc(w, {
    kind: 'answer', from: cap.id, about: man.id, title: `${first(cap)} wants to know about ${first(man)}`, days: 4, data: { fact: f.id, owed },
    lines: [`${cap.name} doesn’t ask you to sit.`, `“${what} He’s yours. What are you going to do about it?”`],
    opts: [
      { code: 'side', label: `Hear ${first(man)}’s side first`, hint: `${first(cap)} can wait an hour. What ${first(man)} says may change what you do.` },
      { code: 'pay', label: `Make it right: ${money(owed)} back, from ${first(man)}`, hint: `The family is squared. ${first(man)} pays, and won’t like it. If he can’t, you do.` },
      { code: 'rough', label: `Have ${first(man)} taught a lesson`, hint: `${first(cap)} will be satisfied. ${first(man)} will remember who ordered it. So will your other men.` },
      { code: 'stand', label: `Stand up for him: he had his reasons`, hint: `${first(man)} won’t forget it. Neither will ${first(cap)}.` },
      { code: 'out', label: `Put ${first(man)} out`, hint: 'You’re rid of the problem, and of him. He won’t be grateful.' },
    ],
  });
}

// ------------------------------------------------------------ what he decides

export function authorityChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  if (e.kind === 'cometo') return cometoChoose(w, p, e, code);
  if (e.kind === 'quarrel') return quarrelChoose(w, p, e, code);
  return answerChoose(w, p, e, code);
}

function cometoChoose(w: World, p: Character, e: Enc, code: string) {
  if (e.data?.stage === 'handed') { const s = e.about ? w.chars[e.about] : undefined; return { lines: [s ? `${first(s)} nods to you. “Whatever you need.”` : 'He has gone his own way.'], minutes: 10 }; }
  const c = e.from ? w.chars[e.from] : undefined;
  if (!c?.alive || c.jailedUntil > w.now) return { lines: ['He has gone his own way.'], minutes: 5 };
  if (code === 'take') {
    if (c.rank === 'civilian') { if (p.cash < 150) { e.status = 'open'; return { lines: ['You need $150 to set a man up properly.'], minutes: 0 }; } p.cash -= 150; c.cash += 150; }
    const old = c.bossId ? w.chars[c.bossId] : undefined;
    takeOn(w, p, c);
    repute(w, p, 0.5, 'took a man on');
    // (a man taken from another man's crew is taken from him: he may feel it, and the captain hears)
    if (old?.alive && !old.isPlayer && e.data?.why === 'sour') bear(w, old, p.id, 0.15, `${p.name} took ${c.name} off him`);
    return { lines: [`${first(c)} shakes your hand and holds it a second longer than he needs to. He answers to you now.`], minutes: 20 };
  }
  if (code === 'prove') { feel(w, c, p.id, 'respect', 0.04); c.cooldown['proving'] = w.now; p.cooldown['cometo'] = w.now + 10 * DAY; return { lines: [`“Fair,” ${first(c)} says. “You’ll hear about me.”`], minutes: 10 }; }
  feel(w, c, p.id, 'respect', -0.02);
  return { lines: [`${first(c)} shrugs. “If you change your mind.”`], minutes: 10 };
}

function quarrelChoose(w: World, p: Character, e: Enc, code: string) {
  const a = e.from ? w.chars[e.from] : undefined, b = e.about ? w.chars[e.about] : undefined;
  if (!a?.alive || !b?.alive) return { lines: ['By the time you get there, it has gone quiet.'], minutes: 10 };
  const amt = Number(e.data?.amt ?? 0), ra = rel(a, p.id), rb = rel(b, p.id), wrong = w.chars[String(e.data?.wrong ?? '')];
  if (code === 'hear') {
    // (he hears each man alone; the one in the wrong tells it differently the second time, and the player now knows it)
    e.status = 'open'; e.opts = e.opts.filter((o) => o.code !== 'hear'); e.data = { ...(e.data ?? {}), heard: 1 };
    const liar = wrong ?? a, honest = liar === a ? b : a;
    e.lines.push(`You take them one at a time in the back room. ${first(honest)} tells it the same way twice. ${first(liar)} doesn’t: the second time, ${e.data.about === 'money' ? 'the money was a loan' : e.data.about === 'credit' ? 'he only said he helped' : 'he never said it like that'}.`);
    return { lines: [], minutes: 60 };
  }
  const crew = crewOf(w, p).filter((c) => c.id !== a.id && c.id !== b.id);
  const settled = (text: string, how: string) => addFact(w, { kind: 'report', actor: p.id, minor: true, text: `${p.name} settled it between ${a.name} and ${b.name}: ${how}.`, district: p.district }, { witnesses: [p.id, a.id, b.id, ...crew.map((c) => c.id)] }) && text;
  if (code === 'a' || code === 'b') {
    const win = code === 'a' ? a : b, lose = code === 'a' ? b : a;
    feelOn(w, rel(win, p.id), 'trust', 0.1); feelOn(w, rel(lose, p.id), 'trust', -0.1); bearOn(w, rel(lose, p.id), 0.12, `${p.name} took ${win.name}’s side against him`);
    if (amt) transfer(w, code === 'a' ? b : a, code === 'a' ? a : b, amt, 'gift', 'settled by ' + p.name);
    // (the rest of the crew mostly know who was in the right: backing him is respected; backing the other man is noticed)
    const fair = !wrong || win.id !== wrong.id;
    for (const c of crew) feelOn(w, rel(c, p.id), 'respect', fair ? (temper(c).agreeable > 0.5 ? 0.04 : 0.02) : -0.03);
    if (!fair) { bearOn(w, rel(lose, p.id), 0.1, `${p.name} backed ${win.name} when he was in the wrong`); feelOn(w, rel(win, p.id), 'respect', -0.03); }
    return { lines: [settled(`You hear them both out and say it plainly: ${first(win)} is in the right.${amt ? ` ${first(lose)} hands over ${money(amt)} without looking at either of you.` : ''} ${first(win)} nods. ${first(lose)} says nothing at all.`, `he backed ${win.name}`)], minutes: 40 };
  }
  if (code === 'pay') {
    if (p.cash < amt) { e.status = 'open'; return { lines: ['You haven’t got it on you.'], minutes: 0 }; }
    transfer(w, p, a, amt, 'gift', 'to end a quarrel');
    for (const [x, y] of [[a, b], [b, a]] as const) { const r = rel(x, y.id); r.grudge = Math.max(0, r.grudge - 0.2); }
    feelOn(w, ra, 'trust', 0.05); feelOn(w, rb, 'trust', 0.05);
    return { lines: [settled(`You count ${money(amt)} onto the bar in front of ${first(a)}. “That’s the end of it.” It is. They both know what it cost you, and that you paid it.`, 'he paid it out of his own pocket')], minutes: 30 };
  }
  if (code === 'shake') {
    const weight = (peek(a, p.id).respect + peek(b, p.id).respect) / 2 + (p.standing - 40) / 200 - (temper(a).volatility + temper(b).volatility) / 4;
    if (w.rng.chance(clamp(weight + 0.25, 0.15, 0.9))) {
      for (const [x, y] of [[a, b], [b, a]] as const) { const r = rel(x, y.id); r.grudge = Math.max(0, r.grudge - 0.3); feelOn(w, r, 'trust', 0.05); }
      feelOn(w, ra, 'respect', 0.05); feelOn(w, rb, 'respect', 0.05);
      return { lines: [settled(`You sit them down at the same table and don’t let either of them leave until they’ve shaken on it. They do. It takes a while.`, 'he made them shake hands')], minutes: 50 };
    }
    feelOn(w, ra, 'respect', -0.04); feelOn(w, rb, 'respect', -0.04);
    for (const [x, y] of [[a, b], [b, a]] as const) bearOn(w, rel(x, y.id), 0.1, `${y.name} wouldn’t let it go`);
    return { lines: [`You sit them down. ${first(temper(a).volatility > temper(b).volatility ? a : b)} gets up before you’ve finished. It isn’t over, and now they both know you couldn’t end it.`], minutes: 40 };
  }
  // left to themselves: the hotter one may settle it his way
  for (const [x, y] of [[a, b], [b, a]] as const) bearOn(w, rel(x, y.id), 0.08, `nobody settled it with ${y.name}`);
  const hot = temper(a).volatility >= temper(b).volatility ? a : b, other = hot === a ? b : a;
  if (w.rng.chance(clamp(temper(hot).volatility * 0.6, 0.1, 0.55))) {
    other.hurtUntil = Math.max(other.hurtUntil, w.now + 3 * DAY);
    addFact(w, { kind: 'beating', actor: hot.id, victim: other.id, minor: false, text: `${hot.name} beat up ${other.name} over a quarrel nobody settled.`, district: hot.district }, { witnesses: [p.id, ...crew.map((c) => c.id)] });
    repute(w, p, -1.5, 'let down');
    return { lines: [`They sort it out themselves. ${first(other)} won’t be working for a few days, and everybody in the crew knows you could have stopped it.`], minutes: 10 };
  }
  return { lines: [`You tell them you’ve got better things to do. They go back to opposite ends of the bar.`], minutes: 10 };
}

function answerChoose(w: World, p: Character, e: Enc, code: string) {
  const cap = e.from ? w.chars[e.from] : undefined, man = e.about ? w.chars[e.about] : undefined;
  if (!cap?.alive || !man?.alive) return { lines: ['It has stopped mattering.'], minutes: 5 };
  const owed = Number(e.data?.owed ?? 100), f = w.facts[String(e.data?.fact ?? '')];
  const victim = f?.business ? w.chars[w.biz[f.business]?.ownerId ?? ''] : f?.victim ? w.chars[f.victim] : undefined;
  const crew = crewOf(w, p).filter((c) => c.id !== man.id);
  // (his side, from what is true of him: a debt or a habit, bad blood with the owner, not knowing the place paid, or plain greed)
  const why = (): { k: string; said: string } => {
    const pr = man.problem, owner = victim;
    if (pr && ['gambling', 'debt'].includes(pr.kind)) return { k: 'owes', said: `“I owe ${pr.kind === 'gambling' ? 'the book' : 'the wrong people'}. They gave me till Friday. I didn’t know where else to get it.”` };
    if (owner && peek(man, owner.id).grudge >= 0.2) return { k: 'grudge', said: `“${first(owner)} has had it coming for a long time. You don’t know what he said to me.”` };
    if (!man.known[f?.id ?? ''] || !Object.values(w.facts).some((x) => x.kind === 'protection_started' && x.business === f?.business && man.known[x.id])) return { k: 'didnt-know', said: '“Nobody told me it was ours. I swear on my mother. If I’d known, I’d never have gone near it.”' };
    return { k: 'greed', said: `“It was there. I took it.” ${first(man)} shrugs. He doesn’t seem to think it needs more than that.` };
  };
  if (code === 'side') {
    const r = why();
    e.status = 'open'; e.opts = e.opts.filter((o) => o.code !== 'side'); e.data = { ...(e.data ?? {}), reason: r.k };
    e.lines.push(`You find ${first(man)} before you go back to ${first(cap)}. ${r.said}`);
    return { lines: [], minutes: 60 };
  }
  const seen = (how: string) => addFact(w, { kind: 'discipline', actor: p.id, victim: man.id, minor: false, text: `${p.name} ${how}.`, district: p.district }, { witnesses: [p.id, man.id, cap.id, ...crew.map((c) => c.id)] });
  if (code === 'pay') {
    const from = man.cash >= owed ? man : p;
    if (from === p && p.cash < owed) { e.status = 'open'; return { lines: [`${first(man)} hasn’t got it, and neither have you. ${first(cap)} is waiting.`], minutes: 0 }; }
    if (victim?.alive) transfer(w, from, victim, owed, 'gift', 'made right'); else transfer(w, from, cap, owed, 'gift', 'made right');
    feel(w, cap, p.id, 'trust', 0.05); feel(w, cap, p.id, 'respect', 0.04);
    if (from === man) { feelOn(w, rel(man, p.id), 'trust', -0.05); bear(w, man, p.id, 0.05, `${p.name} made him pay it back`); }
    else feelOn(w, rel(man, p.id), 'trust', 0.06);
    seen(`made ${man.name} pay back what he did${from === p ? ', and paid it himself when he couldn’t' : ''}`);
    return { lines: [`${money(owed)} goes back where it belongs${from === p ? `, out of your own pocket, because ${first(man)} hasn’t got it` : `, out of ${first(man)}’s pocket`}. ${first(cap)} nods. “Good. Keep him on a shorter leash.”`], minutes: 40 };
  }
  if (code === 'rough') {
    man.hurtUntil = Math.max(man.hurtUntil, w.now + 3 * DAY);
    feel(w, cap, p.id, 'trust', 0.08); feel(w, cap, p.id, 'respect', 0.06);
    bear(w, man, p.id, 0.22, `${p.name} had him beaten for what he did`); feelOn(w, rel(man, p.id), 'trust', -0.1);
    // (the rest of the crew read it by temperament: a hard man respects it, an easy one fears it)
    for (const c of crew) { if (temper(c).volatility > 0.5 || c.traits.violence > 0.6) feelOn(w, rel(c, p.id), 'respect', 0.05); else feelOn(w, rel(c, p.id), 'affection', -0.03); }
    seen(`had ${man.name} roughed up for what he did`);
    return { lines: [`Two men from the club pay ${first(man)} a visit. They don’t break anything that won’t mend. ${first(cap)} hears of it by evening. ${first(man)} hears who sent them.`], minutes: 30 };
  }
  if (code === 'stand') {
    // (standing up for a man who truly didn't know is an argument a captain can accept; for a greedy one it is taking his side)
    const fair = e.data?.reason === 'didnt-know';
    feel(w, cap, p.id, 'trust', fair ? -0.03 : -0.1); if (!fair) { bear(w, cap, p.id, 0.08, `${p.name} stood up for ${man.name} when he was in the wrong`); repute(w, p, -1, 'gave way'); }
    feelOn(w, rel(man, p.id), 'trust', 0.15); feelOn(w, rel(man, p.id), 'affection', 0.1);
    for (const c of crew) feelOn(w, rel(c, p.id), 'trust', 0.04);
    if (fair) return { lines: [`“Nobody told him it was ours,” you say. “That’s on me, not him. It won’t happen again.” ${first(cap)} thinks about it. “See that it doesn’t.” ${first(man)} hears what you said for him.`], minutes: 20 };
    return { lines: [`“He had his reasons,” you say, “and I’ll answer for them.” ${first(cap)} looks at you for a long moment. “Then you will.” Your men hear about it by the end of the day. So does everybody else.`], minutes: 20 };
  }
  // put out
  // (a made man put out of a crew goes back to his captain; an associate is out of the life)
  if (man.rank === 'associate') applyRank(w, man, 'civilian', { fact: false, career: false, place: (x) => { x.familyId = null; x.bossId = null; x.prospect = false; } });
  else man.bossId = cap.id;
  bear(w, man, p.id, 0.4, `${p.name} put him out`); feel(w, cap, p.id, 'trust', 0.04);
  for (const c of crew) feelOn(w, rel(c, p.id), 'trust', -0.03);
  seen(`put ${man.name} out of his crew`);
  return { lines: [`You tell ${first(man)} he’s finished with you. He takes it without a word, which is worse than any word would have been. ${first(cap)} says you did what you had to. Your other men are very quiet that week.`], minutes: 30 };
}
