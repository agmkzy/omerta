// The matters between you, as conversations (Gate 4: threads.ts, moved into the conversation layer; what it does to the world goes
// through doors.ts) (the overhaul of the conversation, after Stage 5). Each is a subject in the sense of
// talk.ts (he says something, you answer, he answers that), worked out from the world as it is and from what has already been said:
// his money coming up light, a debt either way, a piece of work he did for you, something that happened that you have both heard
// of, which places are hurting. What he tells you is specific: the places, the sums, the names, the man who told him. What he says
// may not be true, and what he said stays said: a man who told you it was a slow month is held to it when the books say otherwise.
//
// Nothing here is a separate system. A week's grace is a promise with a date on it (dialogue.memoTick holds him to it); what he
// pays, he pays (core.payDebt, the books); what he admits is what he did (Books.skim); a question about a story is answered from
// what he knows of it and how (rumour.ts); a name he gives you is learned (core.learn). The player only ever sees what he could.
import { money, peek } from '../../core';
import { lineOf, OPS } from '../../rackets';
import { knowing, versionOf } from '../../rumour';
import { temper } from '../../temper';
import { by, ch, done, lastSaid, MORE, note, q, said, trust, type Beat, type Choice, type Subject, type X } from './life';
import { DAY, type Character, type Debt, type Fact, type World } from '../../types';
import * as door from '../doors';

const first = (c: Character) => c.name.split(' ')[0];
const end = (key: string, label = '“We’ll talk about this another time.”'): Choice => ({ ...done(key), label });
const claimOf = (t: Character, key: string) => t.talk?.['claim:' + key]?.sig;
const setClaim = (w: World, t: Character, key: string, v: string) => door.talkStamp(w, t, 'claim:' + key, v);
const hot = (t: Character) => temper(t).volatility + temper(t).pride > 1.15;

// ================================================================== his money, coming up light
// What the player can see of a man's envelopes (his statements: what was due, what came, what he could see for himself), and what
// was true (the week's tone, kept by the books, never shown). The man explains from the truth, or lies; the player can press only
// on what he can see.
const RECENT = 4;
function lightOf(w: World, t: Character) {
  const h = t.books.history.slice(-RECENT);
  const short = h.filter((x) => x.due > 0 && x.paid < x.due * 0.9);
  const owed = Math.round(t.books.arrears);
  const last = short.at(-1);
  const gap = Math.round(short.reduce((a, x) => a + (x.expected - x.declared > 0 ? (x.expected - x.declared) * 0.2 : 0), 0));
  return { short, owed, last, gap };
}
function earnings(x: X): Subject | undefined {
  const { w, p, t } = x;
  if (t.bossId !== p.id || t.isPlayer) return undefined;
  const L = lightOf(w, t);
  if (!L.short.length && L.owed < 20) return undefined;
  const key = 'earn';
  const flagged = (p.books.flags[t.id]?.amt ?? 0) > 0 || L.gap > 0; // what you can see does not add up
  const guilty = L.short.some((h) => h.tone === 'underreported' || h.tone === 'withheld') || !!t.books.skim || !!t.books.hide;
  const claim = claimOf(t, key);
  return {
    key, sig: `${L.short.length}:${L.owed}`, weight: 0.75 + Math.min(0.2, L.owed / 1000),
    label: '“Your money’s been light lately.”',
    hint: `${L.short.length} of his last ${Math.min(RECENT, t.books.history.length)} envelopes came up short${L.owed ? `; he owes ${money(L.owed)} up` : ''}.`,
    open: (x) => {
      // he said something about it before: it is put to him again, and he stands by it or doesn't
      if (claim && claim !== 'admitted') return { lines: [q(t, by(t, { proud: `I told you before. ${claim === 'slow' ? 'Business is slow.' : 'It’s coming.'}`, frightened: `It’s like I said. ${claim === 'slow' ? 'Slow.' : 'I’m getting it.'}`, _: `Same as I told you. ${claim === 'slow' ? 'It’s been slow.' : 'You’ll have it.'}` }))], choices: menu(x, key, L, flagged, guilty) };
      return explain(x, key, L, guilty, flagged);
    },
    reply: (x, code) => turn(x, key, code, L, flagged, guilty),
  };
}
function explain(x: X, key: string, L: ReturnType<typeof lightOf>, guilty: boolean, flagged: boolean): Beat {
  const { w, p, t } = x, tp = temper(t), tone = L.last?.tone;
  // a man holding back decides whether to own it: trust and an easy conscience say yes; caution, pride and a hard stare say no
  const owns = guilty && trust(x) * 0.6 + tp.agreeable * 0.3 - tp.caution * 0.3 - tp.pride * 0.2 + (flagged ? 0.15 : 0) > 0.35;
  if (owns) { setClaim(w, t, key, 'admitted'); note(p, t, 'He admitted he had been keeping some back.'); return { lines: [q(t, by(t, { earnest: 'I’ve been holding some back. I’m not proud of it. I’ll make it right.', bitter: 'All right. I kept some. I figured I was owed it.', frightened: 'I— I kept a little. Just to get by. I’ll put it back, I swear.', _: 'I kept some of it back. I’ll make it up.' }))], choices: menu(x, key, L, flagged, guilty, true) }; }
  let say: string;
  if (tone === 'jailed') say = 'I was inside, you know that. You can’t earn from a cell.';
  else if (tone === 'unable') {
    const owedHim = w.debts.find((d) => d.status === 'active' && d.creditor === t.id && d.missed > 0);
    say = owedHim ? `${w.chars[owedHim.debtor]?.name ?? 'A man'} stopped paying me. I’m out ${money(owedHim.balance)}, and your share has to come from somewhere.` : t.problem && t.problem.sev > 0.3 && tp.agreeable > 0.5 ? `I haven’t got it. Things are bad. I’ll tell you if you want to know.` : 'I haven’t got it. Not this week.';
  } else if (tone === 'delayed') say = 'You’ll have it. It’s coming. I needed it for a few days.';
  else {
    // a slow patch: the real cause if it is real, or the one he gives if it is not (his own trade's bad week, said as the reason)
    const op = lineOf(w, t), cause = (L.last?.cause && tone === 'downturn' ? L.last.cause : op?.cause) || 'a couple of places are struggling';
    say = `Business hasn’t been what it was. ${cause.charAt(0).toUpperCase() + cause.slice(1)}.`;
  }
  setClaim(w, t, key, tone === 'delayed' ? 'coming' : 'slow');
  return { lines: [q(t, say)], choices: menu(x, key, L, flagged, guilty) };
}
function menu(x: X, key: string, L: ReturnType<typeof lightOf>, flagged: boolean, guilty: boolean, admitted = false): Choice[] {
  const { w, p, t } = x;
  const asked = (c: string) => lastSaid(t, key + ':' + c) === String(Math.floor(w.now / DAY));
  const out: Choice[] = [];
  if (!admitted && claimOf(t, key) === 'slow' && !asked('which')) out.push(ch(key, 'which', '“Which places?”', 'Make him name them.'));
  if (!admitted && flagged && !asked('missing')) out.push(ch(key, 'missing', '“That doesn’t explain the missing money.”', 'What you can see doesn’t match what he says.', true));
  if (!admitted && knowsGambling(w, p, t) && !asked('gamble')) out.push(ch(key, 'gamble', '“I heard you’ve been gambling.”', 'Say what you know. He’ll want to know how.', true));
  if (L.owed > 0) out.push(ch(key, 'makeup', `“You need to make up the ${money(L.owed)}.”`, 'He pays what he can; the rest he owes.'));
  if (!asked('week')) out.push(ch(key, 'week', '“I’ll give you another week.”', 'He promises to make it up by then. You’ll hold him to it.'));
  out.push(ch(key, 'warn', '“Don’t let it happen again.”', 'A warning. He’ll take it in his own way.'));
  out.push(end(key));
  return out;
  void guilty;
}
const knowsGambling = (w: World, p: Character, t: Character) =>
  (t.problem?.kind === 'gambling' && (t.problem.revealed || (p.insight?.[t.id] ?? []).includes('problem'))) ||
  Object.keys(p.known).some((id) => { const f = w.facts[id]; return f && f.kind === 'gambling_loss' && f.actor === t.id && w.now - f.t < 60 * DAY; });
function turn(x: X, key: string, code: string, L: ReturnType<typeof lightOf>, flagged: boolean, guilty: boolean): Beat {
  const { w, p, t } = x, tp = temper(t), r = peek(t, p.id);
  said(w, t, key + ':' + code, String(Math.floor(w.now / DAY)));
  const admitted = claimOf(t, key) === 'admitted';
  const again = (lines: string[]): Beat => ({ lines, choices: menu(x, key, lightOf(w, t), flagged, guilty, claimOf(t, key) === 'admitted') });
  switch (code) {
    case 'which': {
      // the places he names are real: the shops on his book and his own trade. A man telling the truth names the ones really behind;
      // a man covering names his places anyway, and says they're slow.
      const shops = Object.values(w.biz).filter((b) => b.open && b.protection?.collectorId === t.id);
      const op = lineOf(w, t);
      const named: string[] = [];
      for (const b of shops.slice(0, 3)) { const late = b.protection?.late ?? 0; if (late > 0 || guilty || b.distress > 0) named.push(`${b.name}${late > 0 ? `, ${late} week${late > 1 ? 's' : ''} behind with me` : b.distress > 0 ? ', barely open' : ', quiet'}`); }
      if (op) named.push(`the ${OPS[op.kind as keyof typeof OPS]?.label.toLowerCase() ?? 'business'} in ${op.district}${op.cause ? `: ${op.cause}` : ''}`);
      if (!named.length) return again([q(t, 'Nothing I can point to. Some weeks are thin.')]);
      note(p, t, `He said these were slow: ${named.map((s) => s.split(',')[0].split(':')[0]).join('; ')}.`);
      return again([q(t, named.length > 1 ? `${named.slice(0, -1).join('. ')}. And ${named.at(-1)}.` : `${named[0]}.`)]);
    }
    case 'missing': {
      // what you can see doesn't add up. A guilty man breaks or digs in (his nerve, his care for you, how plain it is); an honest one
      // is insulted, and remembers being called a thief.
      if (!guilty) { door.grudge(w, t, p.id, 0.06, `${p.name} as good as called him a thief`); return again([q(t, hot(t) ? 'You calling me a thief? After everything?' : 'There’s nothing missing. I’ve told you how it is. Look for yourself.')]); }
      const cracks = (p.books.flags[t.id]?.amt ?? L.gap) / 300 + trust(x) * 0.3 + (1 - tp.courage) * 0.3 - tp.pride * 0.25 > 0.45;
      if (cracks) {
        setClaim(w, t, key, 'admitted'); door.skimOwned(t);
        door.esteem(w, t, p, 'respect', 0.03, 'saw-through'); note(p, t, 'He admitted he had been keeping some back.');
        return again([q(t, by(t, { proud: 'All right. I took some. I won’t insult you by lying about it twice.', frightened: 'Please. I kept some back. I’ll pay it, all of it.', _: 'All right. I held some back. I’ll make it right.' }))]);
      }
      setClaim(w, t, key, 'denied'); door.regard(w, p, t.id, 'trust', -0.03);
      return again([q(t, hot(t) ? 'I said it was slow. You want to count it yourself, count it.' : 'It is what it is. I don’t know what else to tell you.'), `He holds your eye a moment too long.`]);
    }
    case 'gamble': {
      const real = t.problem?.kind === 'gambling';
      if (real && (trust(x) > 0.45 || tp.agreeable > 0.6)) { door.revealProblem(t); return again([q(t, by(t, { proud: 'Who told you? …Fine. Cards. I can handle it.', frightened: 'It’s gotten away from me. I know it has.', _: `It’s the cards. I can’t leave them alone.` }))]); }
      door.grudge(w, t, p.id, real ? 0.03 : 0.08, `${p.name} accused him of gambling the money away`);
      return again([q(t, real ? 'Who’s been talking about me?' : 'Gambling? Who told you that? I haven’t been near a game.')]);
    }
    case 'makeup': {
      const pay = Math.min(Math.max(0, Math.floor(t.cash)), L.owed);
      if (pay > 0) door.madeUp(w, t, p, pay);
      const left = Math.max(0, L.owed - pay);
      if (!left) return { lines: [q(t, admitted ? 'Here. All of it.' : 'Here. All of it. Don’t say I never paid.'), `He counts ${money(pay)} into your hand.`], choices: [end(key, '“Good.”')] };
      return again([pay ? `He counts out ${money(pay)}. ${money(left)} still owed.` : '', q(t, pay ? 'That’s what I’ve got on me.' : 'I haven’t got it. Not today.')].filter(Boolean));
    }
    case 'week': {
      // his word, with a date on it: dialogue.memoTick holds him to it (he owes nothing up by then, or it is a promise broken)
      door.memo(w, p, t.id, 'promise', `${t.name} promised to make up what he owes by next week.`, { due: w.now + 7 * DAY, done: false });
      door.regard(w, t, p.id, 'trust', 0.03);
      return { lines: [q(t, by(t, { earnest: 'You won’t regret it. A week.', proud: 'A week. You’ll have it.', frightened: 'Thank you. A week. I swear.', _: 'A week. You’ll have it.' }))], choices: [end(key, '“See that I do.”')] };
    }
    case 'warn': {
      door.hardWith(w, p, t, 'threats', 0.5);
      if (tp.pride > 0.65 && tp.courage > 0.5) { door.grudge(w, t, p.id, 0.04, `${p.name} talked down to him`); return { lines: [q(t, 'I heard you.'), 'He says it flat, and doesn’t look away.'], choices: [end(key, '“Good.”')] }; }
      door.regard(w, t, p.id, 'fear', 0.05);
      return { lines: [q(t, 'It won’t. You have my word.')], choices: [end(key, '“Good.”')] };
    }
  }
  return { lines: [], choices: [] };
}

// ================================================================== money owed, either way
function debtTalk(x: X): Subject | undefined {
  const { w, p, t } = x;
  const d = w.debts.find((z) => z.status === 'active' && ((z.creditor === p.id && z.debtor === t.id) || (z.creditor === t.id && z.debtor === p.id)));
  if (!d) return undefined;
  const mine = d.creditor === p.id, key = 'debt:' + d.id;
  return {
    key, sig: `${d.balance}:${d.missed}`, weight: mine ? 0.6 + d.missed * 0.1 : 0.55 + d.missed * 0.15,
    label: mine ? '“About the money you owe me.”' : '“About what I owe you.”',
    hint: mine ? `${money(d.balance)} left; ${money(d.weeklyPayment)} a week${d.missed ? `; ${d.missed} missed` : ''}.` : `${money(d.balance)}; ${money(d.weeklyPayment)} a week${d.missed ? `; you have missed ${d.missed}` : ''}.`,
    open: () => (mine ? owedOpen(x, d, key) : oweOpen(x, d, key)),
    reply: (x, code) => (mine ? owedTurn(x, d, key, code) : oweTurn(x, d, key, code)),
  };
}
const canPay = (t: Character, d: Debt) => Math.min(Math.max(0, Math.floor(t.cash)), d.balance);
// whether anything is owed yet: a payment missed, one due within the day, or the loan already being paid down
const dueNow = (w: World, d: Debt) => d.missed > 0 || d.nextDue - w.now <= DAY || (d.paid ?? 0) > 0;
function owedMenu(x: X, d: Debt, key: string): Choice[] {
  const { w, t } = x;
  const asked = (c: string) => lastSaid(t, key + ':' + c) === String(Math.floor(w.now / DAY));
  return [
    ...(!asked('manage') ? [ch(key, 'manage', '“How much can you manage?”', 'He tells you, or he doesn’t.')] : []),
    // (money lent is not called back before anything is due: a loan is its terms, and he has them)
    ...(canPay(t, d) > 0 && dueNow(w, d) ? [ch(key, 'now', '“Pay what you can now.”', 'Cash today, and the rest on the book.')] : []),
    ...(!asked('week') ? [ch(key, 'week', '“I’ll give you another week.”', 'The next payment moves on a week. He owes you for it.')] : []),
    ...(d.weeklyPayment >= 30 && !asked('ease') ? [ch(key, 'ease', '“Let’s make the payments easier.”', `Half: ${money(Math.max(25, Math.round(d.weeklyPayment / 2 / 5) * 5))} a week. It takes longer.`)] : []),
    ...(!asked('forgive') ? [ch(key, 'forgive', '“Take a quarter off. Call it a favour.”', 'Goodwill, or weakness. Depends who’s watching.')] : []),
    ...(!asked('lean') && dueNow(w, d) ? [ch(key, 'lean', '“Pay up, or there’ll be trouble.”', 'Fear works, if he has it to give. So does resentment, later.', true)] : []),
    ...(!asked('others') ? [ch(key, 'others', '“Who else do you owe?”', 'A man who owes everybody pays nobody.')] : []),
    end(key),
  ];
}
function owedOpen(x: X, d: Debt, key: string): Beat {
  const { w, t } = x, can = canPay(t, d);
  const behind = d.missed ? `I know. I’m ${d.missed} payment${d.missed > 1 ? 's' : ''} behind.` : 'I’m paying, aren’t I?';
  const line = can >= d.weeklyPayment ? by(t, { proud: `${money(d.balance)} left. ${behind} You’ll get it.`, _: `${money(d.balance)}, last I counted. ${behind}` }) : by(t, { frightened: `${behind} I haven’t got it. Not right now.`, hothead: `${behind} You think I’ve got it hidden somewhere?`, _: `${behind} Things are tight.` });
  return { lines: [q(t, line)], choices: owedMenu(x, d, key) };
  void w;
}
function owedTurn(x: X, d: Debt, key: string, code: string): Beat {
  const { w, p, t } = x, tp = temper(t), r = peek(t, p.id);
  said(w, t, key + ':' + code, String(Math.floor(w.now / DAY)));
  const again = (lines: string[]): Beat => (d.status === 'active' ? { lines, choices: owedMenu(x, d, key) } : { lines, choices: [end(key, '“Good.”')] });
  const can = canPay(t, d);
  switch (code) {
    case 'manage': {
      // the truth, if he trusts you or is no good at lying; a little less than the truth, if he is greedy and careful
      const says = tp.caution > 0.6 && t.traits.greed > 0.55 && r.trust < 0.6 ? Math.round(can * 0.5 / 10) * 10 : can;
      return again([q(t, says >= d.weeklyPayment ? `I could do ${money(says)} today.` : says > 0 ? `${money(says)}. That’s what there is.` : 'Nothing. Not today.')]);
    }
    case 'now': {
      if (can <= 0) return again([q(t, 'I’ve got nothing on me.')]);
      door.payDebt(w, d, can);
      return again([`He counts out ${money(can)}.`, q(t, d.status === 'active' ? `${money(d.balance)} to go.` : 'That’s the lot. We’re square.')]);
    }
    case 'week': door.debtWeek(d); door.regard(w, t, p.id, 'trust', 0.06); door.regard(w, t, p.id, 'affection', 0.04); return again([q(t, by(t, { proud: 'A week. I won’t need longer.', frightened: 'Thank you. Thank you.', _: 'A week. I appreciate it.' }))]);
    case 'ease': door.debtHalved(d); door.regard(w, t, p.id, 'trust', 0.05); return again([q(t, `${money(d.weeklyPayment)} a week. I can do that.`)]);
    case 'forgive': { const off = Math.round(d.balance * 0.25); door.writeOff(w, d, off); door.esteem(w, t, p, 'affection', 0.05, 'forgave'); door.conduct(p, 'generous'); return again([q(t, by(t, { proud: 'I didn’t ask for that. …Thank you.', bitter: 'What’s the catch?', _: `${money(off)} off? I won’t forget it.` }))]); }
    case 'lean': {
      door.hardWith(w, p, t, 'threats');
      if (can >= d.weeklyPayment && (tp.courage < 0.6 || r.fear && r.fear > 0.3)) { door.payDebt(w, d, Math.min(can, d.weeklyPayment * 2)); door.regard(w, t, p.id, 'fear', 0.08); door.grudge(w, t, p.id, 0.04, `${p.name} threatened him over money`); return again([`He finds the money quickly.`, q(t, 'There. There. No need for that.')]); }
      door.grudge(w, t, p.id, 0.08, `${p.name} threatened him over money`);
      return again([q(t, can ? 'Threaten me all you like. It won’t make it come faster.' : 'There’s nothing to take. Do what you have to.')]);
    }
    case 'others': {
      const mine = w.debts.filter((z) => z.status === 'active' && z.debtor === t.id && z.id !== d.id);
      if (r.trust < 0.4 && tp.caution > 0.4) return again([q(t, 'That’s my business.')]);
      if (!mine.length) return again([q(t, 'Just you. You’re the only one I owe.')]);
      const list = mine.slice(0, 3).map((z) => `${w.chars[z.creditor]?.name ?? 'a man'}, ${money(z.balance)}`);
      note(x.p, t, `He owes: ${list.join('; ')}.`);
      return again([q(t, `${list.join('. ')}. And you.`)]);
    }
  }
  return { lines: [], choices: [] };
}
function oweOpen(x: X, d: Debt, key: string): Beat {
  const { w, p, t } = x;
  const due = d.nextDue - w.now, when = due <= 0 ? 'It was due already.' : due <= DAY ? 'Next one’s due tomorrow.' : `Next one’s due in ${Math.round(due / DAY)} days.`;
  return { lines: [q(t, `${money(d.balance)} left. ${money(d.weeklyPayment)} a week. ${when}${d.missed ? ` You’re ${d.missed} behind.` : ''}`)], choices: oweMenu(x, d, key) };
  void p;
}
function oweMenu(x: X, d: Debt, key: string): Choice[] {
  const { p } = x;
  return [
    ...(p.cash >= Math.min(d.weeklyPayment, d.balance) ? [ch(key, 'pay', `“Here’s this week’s ${money(Math.min(d.weeklyPayment, d.balance))}.”`, 'On time, and he notices.')] : []),
    ...(p.cash >= d.balance ? [ch(key, 'all', `“I can settle all of it: ${money(d.balance)}.”`, 'It clears the debt.')] : []),
    ch(key, 'time', '“I need easier terms.”', 'Name a weekly payment you could make. He weighs it.'),
    end(key, '“That’s all. I just wanted to be straight with you.”'),
  ];
}
function oweTurn(x: X, d: Debt, key: string, code: string): Beat {
  const { w, p, t } = x;
  if (code === 'pay' || code === 'all') {
    const amt = code === 'all' ? d.balance : Math.min(d.weeklyPayment, d.balance);
    if (p.cash < amt) return { lines: ['You’re short.'], choices: oweMenu(x, d, key) };
    door.payDebt(w, d, amt); door.esteem(w, t, p, 'trust', code === 'all' ? 0.08 : 0.04, 'paid');
    return { lines: [q(t, d.status === 'active' ? 'Good. On time.' : 'We’re square. Good.')], choices: [end(key, '“Good.”')] };
  }
  if (code === 'time') {
    // the negotiation for easier terms (asks 'time'): you name a weekly payment, he answers it
    const s = door.openMatter(w, 'time', p, t, { what: d.id, about: d.id, amt: Math.max(5, Math.round(d.weeklyPayment / 2 / 5) * 5), why: `${p.name} asked ${t.name} for easier terms` });
    return { lines: [q(t, s ? 'Easier how? What did you have in mind?' : 'Not now.')], choices: [], go: s ? { node: 'root' } : undefined };
  }
  return { lines: [], choices: [] };
}

// ================================================================== work he did for you
function jobTalk(x: X): Subject | undefined {
  const { w, p, t } = x;
  const j = w.jobs.filter((z) => z.assignee === t.id && (z.giver === null || z.giver === p.id) && z.rep && (z.status === 'done' || z.status === 'failed') && w.now - z.created < 30 * DAY).sort((a, b) => b.created - a.created)[0];
  if (!j || !j.rep) return undefined;
  const key = 'job:' + j.id;
  return {
    key, sig: j.status + (j.rep.found ? ':f' : ''), weight: 0.6,
    label: '“What happened with that job?”', hint: `“${j.title}”: ${j.status === 'done' ? 'done, he says' : 'it didn’t come off'}.`,
    open: () => ({ lines: [q(t, j.rep!.text)], choices: jobMenu(x, key, j.rep!.found) }),
    reply: (x, code) => {
      said(w, t, key + ':' + code, String(Math.floor(w.now / DAY)));
      if (code === 'again') { const ls = door.questionAgain(w, j); return { lines: ls, choices: jobMenu(x, key, true) }; }
      if (code === 'who') {
        const near = Object.values(w.facts).filter((f) => f.actor === t.id && Math.abs(f.t - (j.due ?? j.created)) < 2 * DAY && !f.minor);
        const names = [...new Set(near.flatMap((f) => [f.victim]).filter((id): id is string => !!id && id !== p.id).map((id) => w.chars[id]?.name).filter(Boolean))];
        for (const f of near) door.learnFrom(w, p, f, t.id, true);
        return { lines: [q(t, names.length ? `${names.join(', ')}. Nobody else that matters.` : j.target && w.chars[j.target] ? `${w.chars[j.target].name}. Just him.` : 'Nobody. It was quiet.')], choices: jobMenu(x, key, j.rep!.found) };
      }
      if (code === 'good') { door.esteem(w, t, p, 'trust', 0.03, 'praised'); return { lines: [q(t, 'Any time.')], choices: [end(key, '“Good.”')] }; }
      if (code === 'bad') { door.regard(w, t, p.id, 'affection', -0.04); if (temper(t).pride > 0.6) door.grudge(w, t, p.id, 0.03, `${p.name} found fault with his work`); return { lines: [q(t, temper(t).pride > 0.6 ? 'I did what could be done.' : 'Next time. I’ll do better.')], choices: [end(key, '“See that you do.”')] }; }
      return { lines: [], choices: [] };
    },
  };
}
const jobMenu = (x: X, key: string, found?: boolean): Choice[] => [
  ...(!found ? [ch(key, 'again', '“Tell me again. From the start.”', 'A story told twice is a different story, if it isn’t true.', true)] : []),
  ch(key, 'who', '“Who else was there?”', 'Names. Whatever he did, you hear of it.'),
  ch(key, 'good', '“Good work.”'), ch(key, 'bad', '“That’s not good enough.”'),
  end(key),
];

// ================================================================== something that happened, that you have heard of
// The player asks what he knows of an event the player has heard of. He answers from what he knows and how (rumour.knowing): he
// saw it, he was told, it is going round, he has a name he can't prove, or it is old news. He may give up who told him, or not.
function event(x: X): Subject | undefined {
  const { w, p, t } = x;
  if (t.rank === 'boss' && t.id !== p.bossId) return undefined;
  const f = Object.keys(p.known).map((id) => w.facts[id]).filter((g): g is Fact => !!g && !g.minor && ['beating', 'vandalism', 'robbery', 'murder', 'raid', 'arrest', 'poach', 'burglary', 'theft'].includes(g.kind) && w.now - g.t < 30 * DAY && g.actor !== p.id && g.victim !== p.id && (g.district === t.district || (!!g.actor && !!t.rels[g.actor]) || (!!g.victim && !!t.rels[g.victim]))).sort((a, b) => b.t - a.t)[0];
  if (!f) return undefined;
  const key = 'ev:' + f.id;
  const short = versionOf(w, p, f).replace(/\.$/, '');
  return {
    key, sig: String(f.id), weight: 0.4,
    // (asked of the man it happened to, it is his own story: "what happened to you", not to him by name)
    label: f.victim === t.id ? '“What happened to you?”' : f.actor === t.id ? '“What was that business you were in?”' : `“What do you know about what happened${f.business && w.biz[f.business] ? ` at ${w.biz[f.business].name}` : f.victim && w.chars[f.victim] ? ` to ${first(w.chars[f.victim])}` : ''}?”`,
    hint: short.length > 70 ? short.slice(0, 68).replace(/\s+\S*$/, '') + '…' : short,
    open: () => evOpen(x, f, key),
    reply: (x, code) => evTurn(x, f, key, code),
  };
}
function evMenu(x: X, f: Fact, key: string): Choice[] {
  const { w, p, t } = x, k = t.known[f.id], how = knowing(w, t, f);
  const asked = (c: string) => lastSaid(t, key + ':' + c) === String(Math.floor(w.now / DAY));
  return [
    ...(k && how !== 'seen' && !asked('source') ? [ch(key, 'source', '“Who told you that?”', 'A name, if he’ll give it.')] : []),
    ...(k && f.actor && !p.known[f.id]?.knowsActor && !asked('who') ? [ch(key, 'who', '“Who did it?”', 'If he knows, and if he’ll say.', true)] : []),
    ...(how === 'suspected' && !asked('sure') ? [ch(key, 'sure', `“Are you sure it was ${first(w.chars[(k as { blame?: string }).blame!])}?”`, 'A name nobody saw.')] : []),
    end(key, '“All right. That’s all.”'),
  ];
}
function evOpen(x: X, f: Fact, key: string): Beat {
  const { w, p, t } = x, k = t.known[f.id], how = knowing(w, t, f);
  if (!k) { door.learnFrom(w, t, f, p.id, !!p.known[f.id]?.knowsActor); return { lines: [q(t, 'First I’ve heard of it.'), 'He files it away. Now he knows.'], choices: [end(key, '“Forget I mentioned it.”')] }; }
  const body = versionOf(w, t, f).replace(/^./, (m) => m.toUpperCase());
  const lead = how === 'seen' ? 'I was there. ' : how === 'told' ? 'I had it from a man who was there. ' : how === 'stale' ? 'Last I heard: ' : how === 'suspected' ? 'Here’s what I think. ' : 'Only what’s going round. ';
  return { lines: [q(t, lead + body)], choices: evMenu(x, f, key) };
  void p;
}
function evTurn(x: X, f: Fact, key: string, code: string): Beat {
  const { w, p, t } = x, k = t.known[f.id] as (typeof t.known)[string] & { blame?: string }, tp = temper(t);
  said(w, t, key + ':' + code, String(Math.floor(w.now / DAY)));
  if (code === 'source') {
    const src = k.from !== 'public' && k.from !== 'witness' && k.from !== 'self' ? w.chars[k.from] : undefined;
    if (!src) return { lines: [q(t, 'Nobody. Everybody. It was all over the street.')], choices: evMenu(x, f, key) };
    // he gives up a name to a man he trusts, unless it would hurt a man he protects
    const protects = src.id === t.bossId || peek(t, src.id).affection >= 0.6;
    if (protects || trust(x) < 0.35 || tp.caution > 0.75) return { lines: [q(t, protects ? 'A friend. That’s all you need.' : 'I don’t give up names. You wouldn’t want me giving up yours.')], choices: evMenu(x, f, key) };
    note(p, t, `He heard about it from ${src.name}.`);
    return { lines: [q(t, `${src.name}. He was closer to it than I was.`)], choices: evMenu(x, f, key) };
  }
  if (code === 'who') {
    if (!k.knowsActor) return { lines: [q(t, k.blame && w.chars[k.blame] ? `Nobody saw. People are saying ${w.chars[k.blame].name}.` : 'Nobody knows. Or nobody’s saying.')], choices: evMenu(x, f, key) };
    const a = w.chars[f.actor!];
    const protects = !!a && (a.id === t.bossId || peek(t, a.id).affection >= 0.6 || (!!t.familyId && a.familyId === t.familyId && p.familyId !== t.familyId));
    if (protects || trust(x) < 0.4) return { lines: [q(t, protects ? 'I couldn’t say.' : 'Ask somebody else.'), 'He knows. He isn’t saying.'], choices: evMenu(x, f, key) };
    door.learnFrom(w, p, f, t.id, true); door.knowsWho(p, f);
    return { lines: [q(t, `${a.name}. You didn’t hear it from me.`)], choices: evMenu(x, f, key) };
  }
  if (code === 'sure') {
    const b = k.blame ? w.chars[k.blame] : undefined;
    return { lines: [q(t, by(t, { bitter: `It’s ${b ? first(b) : 'him'}. It’s always ${b ? first(b) : 'him'}.`, cold: 'No. Nobody is.', _: `Sure? No. That’s what people are saying.` }))], choices: evMenu(x, f, key) };
  }
  return { lines: [], choices: [] };
}

// ================================================================== which places are hurting
// What he knows of the businesses around him: his own, the ones he collects from, and the ones the street knows are struggling.
function hurting(x: X): Subject | undefined {
  const { w, t } = x;
  if (t.isPlayer) return undefined;
  const key = 'hurting';
  const known = new Set(Object.keys(t.known).map((id) => w.facts[id]).filter((f) => f && f.kind === 'business_struggling' && f.business && w.now - f.t < 45 * DAY).map((f) => f!.business!));
  for (const b of Object.values(w.biz)) if (b.open && b.distress >= 1 && (b.ownerId === t.id || b.protection?.collectorId === t.id || b.managerId === t.id)) known.add(b.id);
  return {
    key, sig: [...known].sort().join(','), weight: 0.2,
    label: '“Which places around here are hurting?”', hint: 'Who is struggling, as far as he knows.',
    open: () => {
      const list = [...known].map((id) => w.biz[id]).filter((b) => b?.open).slice(0, 3);
      if (!list.length) return { lines: [q(t, 'Nobody’s crying that I know of.')], choices: [end(key, '“Good to know.”')] };
      for (const b of list) note(x.p, t, `He said ${b.name} is struggling.`);
      const words = list.map((b) => `${b.name}${b.distress >= 3 ? ', in a bad way' : b.distress >= 2 ? ', behind on everything' : ', slow'}`);
      return { lines: [q(t, words.length > 1 ? `${words.slice(0, -1).join('. ')}. And ${words.at(-1)}.` : `${words[0]}.`)], choices: [end(key, '“Good to know.”')] };
    },
    reply: () => ({ lines: [], choices: [] }),
  };
}

MORE.push(earnings, debtTalk, jobTalk, event, hurting);
