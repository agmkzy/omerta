// The book, run (the made man's life, Phase 1.4: one racket made into a business with decisions). A player's bookmaking operation is
// more than a weekly number: a gambler wants a big bet on the favourite, and the book can carry it, lay it off with another book, or
// turn it down; a winner can come in bigger than the cash in the drawer; another book opens on his ground; the precinct wants its
// envelope. Each is a decision with consequences in the world's own records: the ledger, debts, favours, regard, family tension,
// facts, and the raid odds the weekly tick reads (rackets.enterpriseWeek reads op.pad).
import { addFact, bear, clamp, createDebt, feel, money, peek, repute, transfer } from './core';
import { addEnc, addFavour } from './encounters';
import { post } from './ledger';
import { temper } from './temper';
import { DAY, type Character, type Enc, type Op, type Pending, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const open = (w: World, kind: string, op: Op) => w.enc.some((e) => e.kind === kind && e.status === 'open' && e.data?.op === op.id);
const due = (p: Character, k: string, w: World) => (p.cooldown[k] ?? 0) <= w.now;
const fam = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId]?.name : undefined);

/** One decision at most a week, for a book the player owns. Called from enterpriseWeek before the week's take. */
export function bookWeek(w: World, op: Op, p: Character) {
  if (op.state !== 'running' || p.jailedUntil > w.now) return;
  const lvl = op.level ?? 1;
  // the precinct's envelope, while he pays it
  if ((op.pad ?? 0) > w.now) { const amt = 40 * lvl; p.cash -= amt; post(w, { from: p.id, to: 'world', amt, flow: 'spend', note: 'the precinct’s envelope' }); }
  if (w.enc.some((e) => ['bigbet', 'cantpay', 'rivalbook', 'pad'].includes(e.kind) && e.status === 'open')) return;
  // (October 2026: each of these comes from something that is so, not a roll of the week: a regular flush from a winning run, a book
  // that has actually opened on his ground, a book grown big enough for the precinct to have noticed it)
  const flush = (op.links ?? []).filter((l) => l.role === 'regular' && (l.bal ?? 0) > 0).map((l) => w.chars[l.id]).filter((c): c is Character => !!c?.alive && c.cash >= 500 && c.jailedUntil <= w.now && (c.cooldown['bet:' + op.id] ?? 0) <= w.now);
  if (flush.length && due(p, 'book:big', w)) return bigBet(w, op, p, lvl, flush);
  if (due(p, 'book:rival', w) && rivalBook(w, op, p)) return;
  if (due(p, 'book:pad', w) && !((op.pad ?? 0) > w.now) && op.weeks >= 3 && ((op.level ?? 1) >= 2 || p.heat > 0.35 || op.total > 3000)) return precinct(w, op, p, lvl);
}

// ------------------------------------------------------------ the big bet
function bigBet(w: World, op: Op, p: Character, lvl: number, only?: Character[]) {
  const f = p.familyId ? w.fam[p.familyId] : undefined;
  // (a gambler with money in his pocket, who hasn't had a big bet on this book in two months; any of them, more likely the keener; a
  // regular of the book's on a winning run first of all)
  const gs = only?.length ? only : Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.bossId !== p.id && c.traits.vice >= 0.5 && c.cash >= 500 && c.jailedUntil <= w.now && (c.cooldown['bet:' + op.id] ?? 0) <= w.now && (c.district === op.district || !!f?.districts.includes(c.district)));
  if (!gs.length) return;
  let r = w.rng.next() * gs.reduce((a, c) => a + c.traits.vice, 0);
  const g = gs.find((c) => (r -= c.traits.vice) <= 0) ?? gs[0];
  p.cooldown['book:big'] = w.now + 21 * DAY; g.cooldown['bet:' + op.id] = w.now + 60 * DAY;
  const amt = Math.max(300, Math.round(Math.min(g.cash * w.rng.range(0.25, 0.6), 1200 * lvl) / 50) * 50);
  const horse = ['Silent Partner', 'Mulberry Lady', 'Big Sal', 'Brooklyn Bridge', 'Second Chance', 'Lucky Seventh'][w.rng.int(0, 5)];
  const layer = layerFor(w, p, amt);
  const man = op.runner && w.chars[op.runner]?.alive ? 'your man' : 'you';
  // (the race is run on the coming Saturday afternoon, at least a day off)
  const today = Math.floor(w.now / DAY); let sat = (today + ((5 - (today % 7) + 7) % 7)) * DAY + 16 * 60; if (sat - w.now < DAY) sat += 7 * DAY;
  addEnc(w, {
    kind: 'bigbet', from: g.id, title: `${first(g)} wants ${money(amt)} on the favourite`, days: 2, data: { op: op.id, amt, horse, layer: layer?.id ?? '', at: sat },
    lines: [`${g.name}${g.rank !== 'civilian' ? `, ${fam(w, g) ? `of the ${fam(w, g)} family` : 'a man in the life'},` : ''} comes to ${man} with an envelope.`, `${money(amt)} on ${horse} to win, Saturday at Aqueduct. Even money. If it comes in, the book owes him ${money(amt * 2)}. ${p.cash < amt * 2 ? `You don’t have ${money(amt * 2)}.` : ''}`],
    opts: [
      { code: 'take', label: 'Take the whole bet', hint: `If ${horse} loses, ${money(amt)} is yours. If it wins, the book pays ${money(amt)} out of your pocket.` },
      ...(layer ? [
        { code: 'half', label: `Take half, lay the rest off with ${first(layer)}`, hint: `Half the risk. ${first(layer)} carries the other half, and remembers who sent it.` },
        { code: 'layoff', label: `Lay it all off with ${first(layer)}`, hint: `You keep the vig, a few dollars, and sleep. ${first(layer)} carries it, and you owe him the courtesy.` },
      ] : []),
      { code: 'no', label: 'Turn it down', hint: `${first(g)} takes it somewhere else, and says your book is small.` },
    ],
  });
}
// (another book that can carry it: a man with a book of his own and the cash to cover it, his own family's first)
function layerFor(w: World, p: Character, amt: number): Character | undefined {
  return w.ops.filter((o) => o.kind === 'bookie' && o.state === 'running' && o.owner !== p.id).map((o) => w.chars[o.owner]).filter((c): c is Character => !!c?.alive && c.cash >= amt * 2 && c.jailedUntil <= w.now)
    .sort((a, b) => Number(b.familyId === p.familyId) - Number(a.familyId === p.familyId) || peek(b, p.id).trust - peek(a, p.id).trust || (a.id < b.id ? -1 : 1))[0];
}

// ------------------------------------------------------------ another book on his ground
function rivalBook(w: World, op: Op, p: Character): boolean {
  const o = w.ops.find((x) => x.kind === 'bookie' && x.state === 'running' && x.owner !== p.id && x.district === op.district && w.now - x.since < 10 * 7 * DAY && w.chars[x.owner]?.alive && !w.chars[x.owner].isPlayer && w.chars[x.owner].rank !== 'capo');
  if (!o) return false;
  const r = w.chars[o.owner];
  p.cooldown['book:rival'] = w.now + 35 * DAY;
  const theirs = r.familyId && r.familyId !== p.familyId, ours = r.familyId === p.familyId;
  addEnc(w, {
    kind: 'rivalbook', from: r.id, title: `${first(r)} is taking bets on your ground`, days: 6, data: { op: op.id, rop: o.id },
    lines: [`${op.runner && w.chars[op.runner]?.alive ? 'Your man says' : 'You hear'} ${r.name}${theirs ? `, a ${fam(w, r)} man,` : ours ? ', one of ours,' : ''} has started taking bets in ${op.district}. Some of your regulars have been seen with his runner.`],
    opts: [
      { code: 'move', label: 'Tell him to take it somewhere else', hint: theirs ? 'Your ground is your ground. His family may not see it that way.' : ours ? `He’s one of ours: his captain will hear you leaned on him.` : 'He may go. He may not.' },
      ...(!theirs && r.rank === 'associate' ? [{ code: 'absorb', label: 'Offer to take him in: his book becomes yours, and he runs for you', hint: 'More customers, one more man. He keeps a cut.' }] : []),
      { code: 'live', label: 'Leave him be', hint: 'There’s enough for two. Not as much for each.' },
    ],
  });
  return true;
}

// ------------------------------------------------------------ the precinct
function precinct(w: World, op: Op, p: Character, lvl: number) {
  p.cooldown['book:pad'] = w.now + 42 * DAY;
  addEnc(w, {
    kind: 'pad', from: null, title: 'The precinct wants its envelope', days: 5, data: { op: op.id, amt: 40 * lvl },
    lines: [`A sergeant from the ${op.district} precinct stops ${op.runner && w.chars[op.runner]?.alive ? 'your man' : 'you'} on the street, friendly as you like.`, `“Nice little business. Be a shame if the captain had to notice it. ${money(40 * lvl)} a week, and he won’t.”`],
    opts: [
      { code: 'pay', label: `Pay it: ${money(40 * lvl)} a week`, hint: 'The police leave the book alone. Every week, out of your pocket.' },
      { code: 'no', label: 'Tell him the book pays nobody', hint: 'Cheaper, until it isn’t.' },
    ],
  });
}

// ------------------------------------------------------------ what he decides
export function bookChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  const op = w.ops.find((o) => o.id === e.data?.op);
  if (!op || op.state === 'closed') return { lines: ['The book is gone. It doesn’t matter now.'], minutes: 5 };
  if (e.kind === 'bigbet') return bigBetChoose(w, p, e, op, code);
  if (e.kind === 'cantpay') return cantPayChoose(w, p, e, code);
  if (e.kind === 'rivalbook') return rivalChoose(w, p, e, op, code);
  // the precinct
  if (code === 'pay') { op.pad = w.now + 365 * DAY; return { lines: ['The sergeant tips his hat. Nobody from the precinct comes near the book after that.'], minutes: 10 }; }
  op.pad = undefined;
  // (the police take a refusal personally: the book is noticed more for a while)
  p.heat = clamp(p.heat + 0.15, 0, 1.5);
  return { lines: ['The sergeant shrugs. “Your funeral.” He means it as a joke. Mostly.'], minutes: 10 };
}

function bigBetChoose(w: World, p: Character, e: Enc, op: Op, code: string) {
  const g = e.from ? w.chars[e.from] : undefined, amt = Number(e.data?.amt ?? 0), horse = String(e.data?.horse ?? 'the favourite'), layer = w.chars[String(e.data?.layer ?? '')];
  if (!g?.alive || g.cash < amt) return { lines: [`${g ? first(g) : 'He'} has changed his mind.`], minutes: 5 };
  if (code === 'no') { feel(w, g, p.id, 'respect', -0.03); return { lines: [`${first(g)} takes his envelope across the street. By Saturday everybody knows your book wouldn’t hold ${money(amt)}.`], minutes: 5 }; }
  const share = code === 'take' ? 1 : code === 'half' ? 0.5 : 0;
  const mine = Math.round(amt * share), laid = amt - mine;
  // the stake comes in now; what was laid off goes to the other book, less the vig the player keeps
  transfer(w, g, p, amt, 'wager', `${horse} to win`);
  if (laid && layer?.alive) {
    const vig = Math.round(laid * 0.05);
    transfer(w, p, layer, laid - vig, 'wager', `laid off: ${horse}`);
    addFavour(w, layer.id, p.id, 1, `carrying a bet off your book`);
    feel(w, layer, p.id, 'trust', 0.04);
  }
  (w.pending ??= []).push({ id: 'p' + w.nextId++, due: Math.max(w.now + DAY, Number(e.data?.at ?? w.now + 3 * DAY)), kind: 'bet', a: g.id, b: p.id, c: laid ? layer?.id : undefined, amount: amt, note: `${op.id}|${mine}|${horse}` });
  return { lines: [share === 1 ? `You take all of it. ${money(amt)} sits in your drawer until Saturday. So does the thought of ${money(amt * 2)}.` : share ? `You take half and send half to ${first(layer!)}. Whatever happens Saturday, it only half happens to you.` : `You send it all to ${first(layer!)} and keep the vig. Saturday is his problem.`], minutes: 20 };
}

/** Saturday: the race. A winner is paid by whoever carried him; a book that can't pay has a problem. */
export function betDue(w: World, q: Pending) {
  const g = w.chars[q.a ?? ''], p = w.chars[q.b ?? ''], layer = q.c ? w.chars[q.c] : undefined;
  const [opId, mineS, horse] = String(q.note ?? '').split('|'), mine = Number(mineS), amt = q.amount ?? 0, laid = amt - mine;
  if (!g || !p) return;
  // (the favourite wins a little under half the time; that is how books stay in business)
  const won = w.rng.chance(0.45);
  if (!won) {
    addFact(w, { kind: 'report', actor: p.id, minor: true, text: `${horse} ran fourth. ${g.name} lost ${money(amt)}${mine ? ` to ${p.name}’s book` : ''}.`, district: p.district }, { witnesses: [p.id, g.id] });
    return;
  }
  if (laid && layer?.alive) transfer(w, layer, g, laid * 2, 'wager', `${horse} came in`);
  if (!mine) { addFact(w, { kind: 'report', actor: g.id, minor: true, text: `${horse} came in. ${g.name} collected from ${layer?.name ?? 'another book'}.`, district: p.district }, { witnesses: [p.id] }); return; }
  const owed = mine * 2, paid = transfer(w, p, g, Math.min(owed, Math.max(0, p.cash)), 'wager', `${horse} came in`);
  if (paid >= owed) { addFact(w, { kind: 'report', actor: g.id, minor: true, text: `${horse} came in, and ${p.name}’s book paid ${g.name} ${money(owed)} on the nail.`, district: p.district }, { witnesses: [p.id, g.id] }); repute(w, p, 0.5, 'good work'); return; }
  const short = owed - paid;
  addEnc(w, {
    kind: 'cantpay', from: g.id, title: `${horse} came in, and you’re ${money(short)} short`, days: 4, data: { op: opId, short },
    lines: [`${horse} wins by a length. ${g.name} is at your door by Sunday morning.`, `You’ve paid him ${money(paid)}. He’s owed ${money(owed)}. He doesn’t look like a man who came for ${money(paid)}.`],
    opts: [
      { code: 'weeks', label: `Ask him to take the rest over a few weeks`, hint: 'It’s a debt now, and he’ll say so to anybody who asks.' },
      ...(p.bossId && w.chars[p.bossId]?.alive && w.chars[p.bossId].cash >= short ? [{ code: 'cap', label: `Go to ${first(w.chars[p.bossId])} for the money`, hint: 'He’ll cover it. He’ll also remember he had to.' }] : []),
      { code: 'stall', label: 'Tell him he’ll get it when he gets it', hint: g.rank !== 'civilian' ? 'He has people. They will take an interest.' : 'Your book’s name goes with it.' },
    ],
  });
}

function cantPayChoose(w: World, p: Character, e: Enc, code: string) {
  const g = e.from ? w.chars[e.from] : undefined, short = Number(e.data?.short ?? 0);
  if (!g?.alive) return { lines: ['He isn’t coming for it any more.'], minutes: 5 };
  if (code === 'weeks') {
    createDebt(w, g.id, p.id, short, 0, 'what the book owed him');
    feel(w, g, p.id, 'trust', -0.08); repute(w, p, -1, 'short weeks');
    return { lines: [`${first(g)} agrees, slowly. “Every week, then.” He tells the barber that afternoon, and the barber tells everybody.`], minutes: 20 };
  }
  if (code === 'cap' && p.bossId) {
    const cap = w.chars[p.bossId];
    transfer(w, cap, g, short, 'wager', 'covering the book');
    createDebt(w, cap.id, p.id, short, 0, 'covering your book');
    feel(w, cap, p.id, 'trust', -0.05); addFavour(w, cap.id, p.id, 1, 'covering your book when it couldn’t pay');
    feel(w, g, p.id, 'trust', 0.02);
    return { lines: [`${first(cap)} counts it out without a word, then says one: “Once.” ${first(g)} is paid in full by noon.`], minutes: 40 };
  }
  // stall: he takes it as it is, and so do his people (and the player is a man whose book didn't pay: his word)
  p.rep = { ...(p.rep ?? { kept: 0, broken: 0, asked: 0, ignored: 0, favoured: null }), broken: (p.rep?.broken ?? 0) + 1 };
  bear(w, g, p.id, 0.3, `${p.name}’s book wouldn’t pay him`); repute(w, p, -3, 'welshed');
  createDebt(w, g.id, p.id, short, 0, 'what the book owed him');
  const gb = g.bossId ? w.chars[g.bossId] : undefined;
  if (gb?.alive && g.familyId && g.familyId !== p.familyId && p.familyId) {
    bear(w, gb, p.id, 0.15, `${p.name}’s book stiffed one of his`);
    const A = w.fam[p.familyId], B = w.fam[g.familyId]; A.tension[g.familyId] = (A.tension[g.familyId] ?? 0) + 0.4; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + 0.4;
  }
  addFact(w, { kind: 'report', actor: p.id, victim: g.id, minor: false, text: `${p.name}’s book wouldn’t pay ${g.name} what it owed him.`, district: p.district }, { witnesses: [p.id, g.id, ...(gb ? [gb.id] : [])] });
  return { lines: [`${first(g)} looks at you for a long time. “You’ll get it when you get it,” he repeats. “I’ll remember you said that.”${gb && g.familyId !== p.familyId ? ` So will ${first(gb)}.` : ''}`], minutes: 15 };
}

function rivalChoose(w: World, p: Character, e: Enc, op: Op, code: string) {
  const r = e.from ? w.chars[e.from] : undefined, ro = w.ops.find((o) => o.id === e.data?.rop);
  if (!r?.alive || !ro || ro.state === 'closed') return { lines: ['He has packed it in on his own.'], minutes: 5 };
  if (code === 'live') return { lines: ['You let it be. There are enough losers in the district for two books. Not as many each.'], minutes: 5 };
  if (code === 'absorb') {
    // (an associate who would rather have a sure cut than a war: his book becomes part of the player's, and he runs for him)
    if (r.traits.ambition > 0.7 && w.rng.chance(0.5)) { feel(w, r, p.id, 'respect', 0.02); return { lines: [`${first(r)} thinks about it, and says no. He wants something of his own. You’ll be seeing his runners.`], minutes: 30 }; }
    ro.state = 'closed'; op.level = Math.min(3, (op.level ?? 1) + 1); op.runner ??= r.id; op.cut = op.cut ?? 0.1;
    r.bossId = p.id; r.familyId = p.familyId; feel(w, r, p.id, 'trust', 0.12);
    addFact(w, { kind: 'promotion', actor: r.id, minor: true, text: `${r.name} folded his book into ${p.name}’s and started running with him.`, district: op.district }, { witnesses: [p.id, r.id] });
    return { lines: [`${first(r)} shakes on it. His regulars are your regulars now, and he answers to you.`], minutes: 40 };
  }
  // told to move: a careful man goes; another family's man takes it to his own people; one of ours, to his captain
  const theirs = r.familyId && r.familyId !== p.familyId;
  if (temper(r).caution > 0.5 || w.rng.chance(0.4)) {
    ro.state = 'closed'; r.cooldown.ent = w.now + 4 * 7 * DAY;
    bear(w, r, p.id, 0.12, `${p.name} ran him off his ground`);
    repute(w, p, 1, 'stood up');
    return { lines: [`${first(r)} hears it out and goes. His runners are gone from ${op.district} by the end of the week.`], minutes: 30 };
  }
  bear(w, r, p.id, 0.25, `${p.name} tried to run him off`);
  const rb = r.bossId ? w.chars[r.bossId] : undefined;
  if (theirs && p.familyId && r.familyId) { const A = w.fam[p.familyId], B = w.fam[r.familyId]; A.tension[r.familyId] = (A.tension[r.familyId] ?? 0) + 0.5; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + 0.5; }
  else if (rb?.alive && rb.id !== p.id) bear(w, rb, p.id, 0.08, `${p.name} leaned on one of his`);
  addFact(w, { kind: 'threat', actor: p.id, victim: r.id, minor: false, text: `${p.name} told ${r.name} to stop taking bets in ${op.district}. ${r.name} didn’t.`, district: op.district }, { witnesses: [p.id, r.id, ...(rb ? [rb.id] : [])] });
  return { lines: [`${first(r)} listens, and smiles, and keeps taking bets.${theirs ? ` His family hears you leaned on him.` : rb ? ` ${first(rb)} hears you leaned on one of his.` : ''}`], minutes: 30 };
}
void DAY;
