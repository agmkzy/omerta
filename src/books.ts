import { arch } from './voice';
import { skimNoticed } from './situ';
import { temper, viewOf } from './temper';
import { move as askMove, rateAsk } from './asks';
import { say as vsay } from './voicesheet';
// Kick-ups and financial records.
// Every dollar a character earns is recorded against a source (c.books.gross). Once a week each member
// declares what he earned and passes an agreed share to his superior. He may conceal income, skim, stall or
// refuse; the superior compares what he got with what he can see, and may warn, demand, punish or ignore.
import { setCollector } from './econ';
import { perform } from './actions';
import { addFact, bear, bearOn, clamp, feel, feelOn, money, rel, repute, travelTime } from './core';
import { mkJob } from './jobs';
import { post, refreshHistory, statement, wkOf } from './ledger';
import { Books, Character, Id, Rank, Tone, WEEK, World } from './types';

export const emptyBooks = (): Books => ({ gross: {}, expenses: 0, received: 0, arrears: 0, missed: 0, honest: 0, history: [], flags: {} });

// The share each rank passes up by default.
export const BASE_RATE: Record<Rank, number> = { civilian: 0, associate: 0.2, soldier: 0.2, capo: 0.2, underboss: 0.1, boss: 0 };

// How much of each income source a superior can see for himself. Hidden income is where skimming lives.
const VIS: Record<string, number> = {
  protection: 1, business: 1, loans: 0.9, odd: 1, kickups: 0.7, delegated: 0.6, cut: 1,
  handle: 0.4, hit: 0.3, scheme: 0.15, boost: 0.15, burgle: 0.15, scam: 0.15, side: 0,
  numbers: 0.5, bookie: 0.5, vending: 0.8, dock: 0.6, union: 0.7, hijack: 0.1, front: 1,
};
// Only the interest part of loan repayments is income.
const WEIGHT: Record<string, number> = { loans: 0.3 };

export const SOURCE_LABEL: Record<string, string> = {
  protection: 'Protection', business: 'Business', loans: 'Loan interest', odd: 'Errands and odd jobs', kickups: 'Kick-ups from below',
  delegated: 'Crew jobs', cut: "Crew's cut", handle: 'Rough work for others', hit: 'Contracts', scheme: 'Schemes',
  boost: 'Stolen cars', burgle: 'Burglary', scam: 'Scams', side: 'Side operation',
  numbers: 'Numbers', bookie: 'Bookmaking', vending: 'Jukeboxes and vending', dock: 'The docks', union: 'The union', hijack: 'Hijackings', front: 'Front business',
};

const LIVING: Record<string, number> = { civilian: 70, associate: 100, soldier: 170, capo: 330, underboss: 520, boss: 900 };
const wt = (s: string) => WEIGHT[s] ?? 1;
const reckoned = (g: Record<string, number>) => Object.entries(g).reduce((a, [s, v]) => a + v * wt(s), 0);
const seen = (c: Character, s: string) => (s === 'side' && c.books.sideKnown ? 1 : VIS[s] ?? 0.5);

export const visibleSources = (c: Character, s: Record<string, number>) => Object.entries(s).filter(([k, v]) => v > 0 && seen(c, k) >= 0.5).map(([k]) => k);

export function effectiveRate(w: World, c: Character): number {
  const f = c.familyId ? w.fam[c.familyId] : undefined;
  const lv = f?.levy && f.levy.until > w.now ? f.levy.extra : 0;
  return c.kickRate + lv;
}

export function subordinates(w: World, c: Character): Character[] {
  return Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.familyId === c.familyId);
}

// ---------------------------------------------------------------- the envelope
// What you would be passing up if the week ended now: your takings so far, times the rate, plus anything you still owe.
// The envelope goes across the table on Sunday, in the kick-up phase, and not at any other time.
export function kickWindow(w: World, p: Character): boolean {
  const s = w.sunday;
  return !!s && w.now - s.t < 2 * 1440 && (p.cooldown.handed ?? 0) < s.t;
}
// The sum, laid out the way a man would say it out loud.
export function envelopeSum(w: World, p: Character) {
  const s = statement(w, p);
  const rate = effectiveRate(w, p);
  const overdue = Math.max(0, p.books.arrears - s.weekDue);
  return { own: s.own, crew: s.crew, rate, weekDue: s.weekDue, overdue, due: envelopeDue(w, p) };
}
export function envelopeText(w: World, p: Character): string {
  const e = envelopeSum(w, p);
  const pct = Math.round(e.rate * 100);
  if (e.due <= 0) return 'You’re square with him. Nothing to hand over.';
  return `Last week you made ${money(e.own)} and your crew handed you ${money(e.crew)}. ${pct}% of ${money(e.own + e.crew)} is ${money(e.weekDue)}${e.overdue ? `, plus ${money(e.overdue)} you still owe from before` : ''}. Total ${money(e.due)}.`;
}
export function envelopeDue(w: World, p: Character): number {
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  if (!boss?.alive) return 0;
  return Math.max(0, p.books.arrears);
}
// Hand it over in person. He sees you did it; nobody has to chase you.
export function handOver(w: World, p: Character, boss: Character, amt: number): string[] {
  amt = Math.min(Math.round(amt), Math.floor(p.cash));
  if (amt <= 0) return ['You haven’t got it.'];
  if (w.sunday) p.cooldown.handed = w.sunday.t;
  post(w, { from: p.id, to: boss.id, amt, flow: 'kickup', note: 'in person', wk: w.sunday ? wkOf(w.sunday.t) : undefined });
  { const h = p.books.history.at(-1); if (h) { if (statement(w, p, h.week).has) refreshHistory(w, p); else h.paid += amt; } }
  const owedBefore = p.books.arrears;
  p.cash -= amt; boss.cash += amt;
  boss.books.received += amt; boss.weekIncome += amt;
  boss.books.gross.kickups = (boss.books.gross.kickups ?? 0) + amt;
  p.lifetimeKick += amt;
  p.books.prepaid = (p.books.prepaid ?? 0) + amt;
  const r = rel(boss, p.id);
  feelOn(w, r, 'trust', 0.02 + (owedBefore > 0 ? 0.03 : 0));
  feelOn(w, r, 'respect', 0.01);
  if (owedBefore > 0) p.books.arrears = Math.max(0, owedBefore - amt);
  // (each man takes it his own way: how he handles money in front of another man, and what he says, are his)
  const a = arch(boss), late = p.books.missed > 0; // (late is a week missed, not this week's envelope brought on time)
  const take = ({ cold: `${boss.name} takes it without looking at it and puts it away.`, proud: `${boss.name} lets it sit on the table a moment before he picks it up.`, jovial: `${boss.name} slaps it against his palm and grins.`, schemer: `${boss.name} thumbs the edge of it, counting without seeming to.`, hothead: `${boss.name} takes it and shoves it in his jacket.`, bitter: `${boss.name} weighs it in his hand like he expected it lighter.`, frightened: `${boss.name} takes it quickly and glances at the door.`, earnest: `${boss.name} takes it and nods his thanks.` } as Record<string, string>)[a] ?? `${boss.name} doesn’t count it in front of you. He weighs it in his hand.`;
  const said = late ? ({ cold: '“About time.”', proud: '“That’s what I wanted to see. Don’t make me wait again.”', jovial: '“There it is! I was starting to worry about you.”', hothead: '“Late. Don’t let it happen again.”', bitter: '“Late, but here. I’ll take it.”' } as Record<string, string>)[a] ?? '“That’s what I wanted to see.”' : ({ cold: '“Good.”', proud: '“Good. That’s how it’s done.”', jovial: '“Like clockwork. I like that in a man.”', schemer: '“In person. People notice that. So do I.”', hothead: '“Good. Some of them I have to chase.”', earnest: '“Thank you. Truly.”' } as Record<string, string>)[a] ?? '“Good. That’s how it’s done.”';
  return [`You put an envelope on the table. ${take} ${said}`, `${money(amt)} handed up. Last week is settled.`];
}

// ---------------------------------------------------------------- weekly

export function settleWeek(w: World) {
  const rng = w.rng;
  const chars = Object.values(w.chars);
  const kin = (familyId: Id | null) => chars.filter((x) => x.alive && x.familyId === familyId).map((x) => x.id);

  // The family needs money for something big: everyone owes extra for a month.
  for (const f of Object.values(w.fam)) {
    if (f.levy && f.levy.until <= w.now) delete f.levy;
    const boss = w.chars[f.bossId];
    if (!f.levy && boss?.alive && rng.chance(0.04)) {
      f.levy = { extra: 0.07, until: w.now + 4 * WEEK };
      addFact(w, { kind: 'levy', actor: boss.id, text: `The ${f.name} family is financing a big venture. Everyone owes 7% extra for the next four weeks.`, district: boss.district }, { broadcast: kin(f.id) });
    }
  }

  // Greedy superiors who are short of cash lean harder on their own men; the squeeze fades when they are flush again.
  for (const c of chars) {
    if (!c.alive || c.isPlayer || !['soldier', 'capo', 'underboss'].includes(c.rank)) continue;
    const subs = subordinates(w, c);
    if (!subs.length) continue;
    if (c.traits.greed > 0.7 && c.cash < LIVING[c.rank] * 3 && rng.chance(0.12)) {
      const hit = subs.filter((s) => s.kickRate < 0.3);
      for (const s of hit) s.kickRate = Math.min(0.3, s.kickRate + 0.05);
      if (hit.length) addFact(w, { kind: 'levy', actor: c.id, text: `${c.name} is leaning harder on his crew for money.`, district: c.district }, { broadcast: hit.map((s) => s.id) });
    } else if (c.cash > LIVING[c.rank] * 4) for (const s of subs) if (s.kickRate > BASE_RATE[s.rank]) s.kickRate = Math.max(BASE_RATE[s.rank], s.kickRate - 0.01);
  }

  // Ambitious men quietly build something of their own.
  for (const c of chars) {
    if (!c.alive || c.isPlayer || c.books.side || !['soldier', 'capo'].includes(c.rank) || c.traits.ambition < 0.7) continue;
    if (rng.chance(0.03)) c.books.side = rng.int(150, 400);
  }
  for (const c of chars) if (c.alive && c.books.side) {
    c.books.side = Math.round(c.books.side * rng.range(0.9, 1.1));
    c.cash += c.books.side;
    c.weekIncome += c.books.side;
    c.books.gross.side = (c.books.gross.side ?? 0) + c.books.side;
  }

  // Settle from the bottom of the chain up, so a man's own takings include what his people just passed to him.
  const height = new Map<Id, number>();
  const h = (c: Character, depth = 0): number => {
    if (height.has(c.id)) return height.get(c.id)!;
    if (depth > 8) return 0;
    const v = 1 + Math.max(-1, ...subordinates(w, c).map((s) => h(s, depth + 1)));
    height.set(c.id, v);
    return v;
  };
  const order = chars.filter((c) => c.alive && c.familyId).sort((a, b) => h(a) - h(b));
  for (const c of order) settleOne(w, c);
  rateTalks(w);
  for (const c of chars) {
    c.books.gross = {};
    c.books.expenses = 0;
    c.books.received = 0;
    c.weekIncome = 0;
  }
}

// How this week's visible income compares with what he has been making over the last two months (1 = the same, 0.5 = half). It is
// what any superior can check, because it is built only from the sources he can see. A bad patch counts as a bad patch for a while;
// after that it is simply what he makes now.
export function visibleSlump(c: Character): number {
  const vis = (src: Record<string, number>) => Object.entries(src).reduce((a, [s, v]) => a + v * wt(s) * seen(c, s), 0);
  const past = c.books.history.slice(-8);
  if (past.length < 3) return 1;
  const avg = past.reduce((a, x) => a + vis(x.sources), 0) / past.length;
  return avg > 50 ? vis(c.books.gross) / avg : 1;
}

function pushHistory(w: World, c: Character, gross: number, declared: number, due: number, paid: number, expected: number) {
  c.books.history.push({ week: Math.floor(w.now / WEEK), gross: Math.round(gross), declared: Math.round(declared), due, paid, expected, expenses: c.books.expenses, received: c.books.received, sources: { ...c.books.gross } });
  if (c.books.history.length > 8) c.books.history.shift();
}

export function settleOne(w: World, c: Character) {
  const rng = w.rng;
  const b = c.books;
  const boss = c.bossId ? w.chars[c.bossId] : undefined;
  const gross = reckoned(b.gross);
  if (!boss || !boss.alive || !c.familyId || boss.familyId !== c.familyId) {
    pushHistory(w, c, gross, 0, 0, 0, 0);
    return;
  }
  const rate = effectiveRate(w, c);
  const T = c.traits;
  const trust = rel(c, boss.id).trust;
  const stall = c.isPlayer && b.stance === 'stall';
  const refuse = !c.isPlayer && ((rel(c, boss.id).respect < 0.15 && T.ambition > 0.75 && rng.chance(0.15)) || (c.problem?.kind === 'resentment' && c.problem.sev > 0.5 && rng.chance(0.2)));

  // What he reports. Hidden sources are reported only if he feels like it; visible ones can be skimmed.
  // Whether he mentions income his superior cannot see is a decision that lasts a few weeks, not a coin tossed every Friday.
  const pOpen = clamp(0.5 + trust * 0.4 - T.greed * 0.35 - (rate > 0.25 ? 0.15 : 0), 0.05, 0.95);
  if (b.hide && b.hide.until <= w.now) delete b.hide;
  if (!c.isPlayer && !b.hide && rng.chance((1 - pOpen) * 0.25)) b.hide = { until: w.now + rng.int(2, 6) * WEEK };
  const honestHidden = !b.hide;
  const pr = c.problem;
  const pushed = pr ? (pr.kind === 'house' ? 0.35 : pr.kind === 'resentment' ? 0.25 : pr.kind === 'gambling' || pr.kind === 'debt' ? 0.3 : 0.12) * (0.5 + pr.sev) : 0;
  // Skimming is a deliberate, uncommon choice: it takes real pressure on top of a greedy nature.
  const pressure = (c.cash < LIVING[c.rank] * 1.5 ? 0.12 : 0) + (rate > 0.25 ? 0.12 : 0) + pushed * 0.6 + ((c.cooldown.friction ?? 0) > w.now ? 0.04 : 0);
  const wantPush = c.want?.kind === 'rich' ? 0.06 : c.want?.kind === 'gamble' ? 0.08 : c.want?.kind === 'independent' ? 0.03 : 0;
  // (V90: a man who only fears the man he hands up to, and doesn't respect him, does what he can behind his back)
  const vb = boss ? viewOf(w, c, boss) : undefined;
  const pSkim = clamp((T.greed > 0.6 ? (T.greed - 0.6) * 0.3 : 0) + wantPush + pressure - trust * 0.3 - temper(c).caution * 0.12 + (vb ? Math.max(0, vb.fear - vb.respect) * 0.1 : 0), 0, 0.5);
  // Skimming is a decision, not a weekly dice roll: a man decides to hold some back, keeps doing it for a few weeks, then stops or is caught.
  let skim = 0;
  if (b.skim && (b.skim.until <= w.now || pSkim < 0.02)) delete b.skim;
  if (!c.isPlayer && b.skim) skim = b.skim.frac;
  else if (!c.isPlayer && pSkim > 0.04 && rng.chance(pSkim * 0.35)) { b.skim = { until: w.now + rng.int(2, 6) * WEEK, frac: rng.range(0.2, 0.5) }; skim = b.skim.frac; }
  let declared = 0, kickDeclared = 0, concealedHidden = false;
  for (const [s, v0] of Object.entries(b.gross)) {
    const v = v0 * wt(s);
    const hidden = seen(c, s) < 0.5;
    const share = c.isPlayer ? (b.stance === 'shave' ? 0.7 : 1) : refuse ? 0 : hidden ? (honestHidden ? 1 : 0) : 1 - skim;
    if (!c.isPlayer && hidden && !honestHidden && v > 0) concealedHidden = true;
    declared += v * share;
    if (s === 'kickups') kickDeclared += v * share;
  }
  // Your own takings are taxed at the rate. What your crew passes up to you goes straight on, whole.
  let ownG = 0, crewG = 0;
  if (c.isPlayer) {
    for (const [k, v] of Object.entries(b.gross)) if (k !== 'kickups') ownG += v * wt(k);
    crewG = b.gross.kickups ?? 0; // only what his men actually put in his hand
  }
  const due = c.isPlayer ? Math.round(((declared - kickDeclared) + crewG) * rate) : Math.round(declared * rate);
  const jailed = c.jailedUntil > w.now;
  // The player doesn’t get docked automatically: the week’s share waits on the table for him to hand over on Sunday.
  const carried = c.isPlayer ? b.arrears : Math.max(0, b.arrears - (b.prepaid ?? 0));
  const owed = c.isPlayer ? due + carried : Math.max(0, due + b.arrears - (b.prepaid ?? 0));
  const able = Math.max(0, c.cash - 40);
  // A man who could pay and puts it off a week, because money trouble has made him cling to it. A decision, and a rare one.
  const delaying = !c.isPlayer && !jailed && !refuse && owed > 0 && able >= owed && pushed > 0 && rng.chance(clamp(pushed * 0.2 - trust * 0.08, 0, 0.1));
  const pay = c.isPlayer || jailed || stall || delaying ? 0 : Math.min(owed, able);
  b.prepaid = 0;
  b.arrears = Math.min(2500, owed - pay); // beyond this it is written off or forgotten
  if (pay > 0) {
    c.cash -= pay;
    boss.cash += pay;
    boss.books.received += pay;
    boss.weekIncome += pay;
    boss.books.gross.kickups = (boss.books.gross.kickups ?? 0) + pay;
    if (boss.isPlayer) boss.lifetimeGross = (boss.lifetimeGross ?? 0) + pay;
    c.lifetimeKick += pay;
  }
  const missedNow = !jailed && (c.isPlayer ? carried > 0 : pay < owed);
  b.missed = missedNow ? b.missed + 1 : 0;

  // What the superior can see for himself.
  const expected = Math.round(Object.entries(b.gross).reduce((a, [s, v]) => a + v * wt(s) * seen(c, s), 0) * rate);
  // Why the week went as it did. Only the simulation knows this. It decides how the superior reacts to what he can SEE: a man who is
  // short because trade is down looks short, but his visible income fell too, and that is the evidence a fair boss weighs.
  const slump = visibleSlump(c);
  const tone: Tone = jailed ? 'jailed' : refuse || stall ? 'withheld' : skim > 0 || concealedHidden ? 'underreported' : delaying ? 'delayed' : !c.isPlayer && pay < owed ? 'unable' : slump < 0.75 ? 'downturn' : 'paid';
  const understood = tone === 'unable' && (slump < 0.75 || c.hurtUntil > w.now);
  // Everything above goes on the ledger, once, here. History is only a copy of it.
  for (const [s, v0] of Object.entries(b.gross)) post(w, { from: 'world', to: c.id, amt: v0 * wt(s), flow: 'earn', src: s });
  post(w, { from: c.id, to: boss.id, amt: expected, flow: 'expect' });
  post(w, { from: c.id, to: boss.id, amt: due, flow: 'owe', src: 'week' });
  post(w, { from: c.id, to: boss.id, amt: carried, flow: 'owe', src: 'carry' });
  if (pay > 0) post(w, { from: c.id, to: boss.id, amt: pay, flow: 'kickup' });
  pushHistory(w, c, gross, declared, due, pay, expected);
  c.books.history[c.books.history.length - 1].tone = tone;
  if (c.isPlayer) { const h = c.books.history[c.books.history.length - 1]; h.own = Math.round(ownG); h.crewGross = Math.round(crewG); }
  if (c.problem && (missedNow || skim > 0)) c.books.history[c.books.history.length - 1].why = c.problem.kind;

  if (missedNow) {
    const f = addFact(w, { kind: 'shortfall', actor: c.id, victim: boss.id, amount: owed - pay, minor: b.missed < 2, text: refuse ? `${c.name} refused to pass up his share to ${boss.name}.` : stall ? `${c.name} held back what he owed ${boss.name}.` : `${c.name} came up ${money(owed - pay)} short on what he owes ${boss.name}.`, district: c.district }, { witnesses: [] });
    // A boss does not punish a man whose trade has visibly collapsed, or who is laid up, the way he punishes one whose trade is fine.
    // He is also slower to lose patience with a man he trusts.
    feel(w, boss, c.id, 'trust', -((understood ? 0.005 : 0.03)));
    // A boss who can see a man's trade has collapsed, and who trusts him, eases the load rather than waiting to punish him.
    if (understood && !boss.isPlayer && !c.isPlayer && b.missed >= 3 && rel(boss, c.id).trust > 0.3 && (c.cooldown.forbear ?? 0) <= w.now) {
      c.cooldown.forbear = w.now + 8 * WEEK;
      b.arrears = Math.round(b.arrears / 2);
      c.kickRate = Math.max(Math.max(0.05, BASE_RATE[c.rank] - 0.1), c.kickRate - 0.02);
      b.missed = 0;
      addFact(w, { kind: 'terms', actor: boss.id, victim: c.id, cause: f.id, minor: true, text: `${boss.name} gave ${c.name} room to get back on his feet.`, district: c.district }, { witnesses: [] });
    }
    const patience = (rel(boss, c.id).trust > 0.6 ? 5 : 3);
    if (!boss.isPlayer && !understood && b.missed >= patience && !c.isPlayer && b.missed % patience === 0) discipline(w, boss, c, f.id, Math.min(due, 300));
    if (b.missed >= 2) {
      repute(w, c, -2, 'short weeks');
      if (c.isPlayer && !boss.isPlayer) summonPlayer(w, boss, c, 'missed', owed - pay);
    }
  }

  // Concealment: what he should have paid on income the superior can see, against what he declared.
  const gap = jailed ? 0 : Math.max(0, expected - due);
  if (gap > Math.max(40, expected * 0.15)) {
    const fl = (boss.books.flags[c.id] ??= { amt: 0, n: 0, last: 0 });
    const p = clamp(0.3 + temper(boss).caution * 0.4 + (gap / Math.max(1, expected)) * 0.5, 0.15, 0.95);
    if (rng.chance(p)) {
      fl.amt += gap;
      fl.n++;
      fl.last = w.now;
      const f = addFact(w, { kind: 'shortfall', actor: c.id, victim: boss.id, amount: gap, minor: gap < 100, text: `${boss.name} noticed ${c.name}'s numbers don't add up. About ${money(gap)} has gone missing.`, district: c.district }, { witnesses: [] });
      if (!boss.isPlayer) {
        if (c.isPlayer) summonPlayer(w, boss, c, 'short', Math.round(fl.amt));
        else if (!skimNoticed(w, boss, c, fl, f.id)) react(w, boss, c, fl, f.id);
      }
    }
  }
  if (!missedNow && gap <= Math.max(40, expected * 0.15)) {
    b.honest++;
    if (b.honest % 4 === 0) repute(w, c, 1, 'honest weeks');
  } else b.honest = 0;

  // A man who is asked for too much, or kept on a short leash, resents it.
  const r = rel(c, boss.id);
  if (rate > 0.25) {
    feelOn(w, r, 'trust', -((rate - 0.25) * 0.5));
    feelOn(w, r, 'respect', -((rate - 0.25) * 0.3));
  } else if (rate < BASE_RATE[c.rank] - 0.01) feelOn(w, r, 'trust', 0.02);

  // Superiors sometimes go through a man's books and find the side business.
  if (b.side && !b.sideKnown && rng.chance(0.06 * (temper(boss).caution + 0.5))) discoverSide(w, boss, c);
}

// ----------------------------------------------------------------------------------------------- talking about the share
// A man can ask his superior to take less. The superior weighs what he can see: whether the man has paid steadily, whether he
// trusts him, whether the family is under a levy, whether he needs the money himself. He agrees, meets him part way, or says no.
// (This is the one place a rate changes by agreement. The older one-way version - a crewman asking the PLAYER for a lower share -
// is the 'rate' event in pulse.ts and still works; the player and the NPCs now ask upward too.)
// How a boss sees a man's request to pass up less, from the real books: whether he has paid steadily, whether a slump shows, whether
// the family is levying everyone, whether the boss himself is short. Shared by the old one-shot answer and the V89 ask ('rate').
export function rateView(w: World, c: Character, boss: Character) {
  const fam = c.familyId ? w.fam[c.familyId] : undefined;
  const levy = !!(fam?.levy && fam.levy.until > w.now);
  const h = c.books.history.slice(-6);
  const steady = h.length >= 4 && h.filter((x) => x.tone === 'paid' || x.tone === 'downturn' || x.tone === undefined).length >= h.length - 0 && c.books.missed === 0 && c.books.arrears <= 0;
  const slump = visibleSlump(c) < 0.75;
  const floor = Math.max(0.05, BASE_RATE[c.rank] - 0.1);
  const short = boss.cash < LIVING[boss.rank] * 3;
  const score = 0.2 + rel(boss, c.id).trust * 0.45 - boss.traits.greed * 0.4 + (steady ? 0.2 : -0.15) + (slump ? 0.1 : 0) - (levy ? 0.2 : 0) - (short ? 0.1 : 0);
  return { levy, h, steady, slump, floor, short, score, behind: c.books.missed > 0 || c.books.arrears > 0 };
}
export function askRate(w: World, c: Character, boss: Character, byPlayer = false): { outcome: 'agree' | 'counter' | 'refuse'; lines: string[] } {
  const rng = w.rng;
  const { h, steady, floor, score } = rateView(w, c, boss);
  const bf = boss.name.split(' ')[0];
  const now = Math.round(c.kickRate * 100);
  if (c.kickRate <= floor + 0.001) return { outcome: 'refuse', lines: [`${bf} points out you already pass up less than most. There's nothing left to give.`] };
  const r = rel(c, boss.id);
  const roll = rng.next();
  const p = clamp(score, 0.05, 0.85);
  if (roll < p) {
    c.kickRate = Math.max(floor, c.kickRate - 0.03);
    feelOn(w, r, 'trust', 0.04);
    addFact(w, { kind: 'terms', actor: boss.id, victim: c.id, minor: true, text: `${boss.name} agreed to take less from ${c.name}.`, district: c.district }, { witnesses: [] });
    return { outcome: 'agree', lines: byPlayer ? [vsay(w, boss, c, 'rate_agree'), `You pass up ${Math.round(c.kickRate * 100)}% from now on, down from ${now}%.`] : [] };
  }
  if (roll < p + 0.25 && score > 0.1) {
    c.kickRate = Math.max(floor, c.kickRate - 0.015);
    return { outcome: 'counter', lines: byPlayer ? [vsay(w, boss, c, 'rate_counter'), `You pass up ${Math.round(c.kickRate * 100)}%, down from ${now}%.`] : [] };
  }
  feelOn(w, r, 'trust', -0.03);
  return { outcome: 'refuse', lines: byPlayer ? [vsay(w, boss, c, steady ? 'rate_no_steady' : h.length < 4 ? 'rate_no_new' : 'rate_no_short')] : [] };
}

// NPCs raise it with each other now and then: a man who has paid steadily and has not asked lately.
function rateTalks(w: World) {
  const rng = w.rng;
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || !c.bossId || !['associate', 'soldier', 'capo', 'underboss'].includes(c.rank) || c.jailedUntil > w.now) continue;
    const boss = w.chars[c.bossId];
    if (!boss?.alive || boss.isPlayer) continue;
    if ((c.cooldown['rate:ask'] ?? 0) > w.now || c.books.history.length < 5 || c.books.missed > 0) continue;
    if (!rng.chance(0.012 + (c.traits.ambition > 0.6 ? 0.01 : 0))) continue;
    c.cooldown['rate:ask'] = w.now + 8 * WEEK;
    // V89: the same ask the player makes (asks.ts 'rate'): it goes on in its own time, with the same answers
    const s = rateAsk(w, c, boss);
    if (s) askMove(w, s, 'ask'); else askRate(w, c, boss); // (no room in the world's matters: the old single answer stands in)
  }
}

// When the player's own numbers draw attention, his superior calls him in rather than acting behind his back.
function summonPlayer(w: World, boss: Character, p: Character, kind: 'short' | 'missed', amt: number) {
  if (w.jobs.some((j) => j.kind === 'summons' && j.meeting === 'accounts' && (j.status === 'offered' || j.status === 'active'))) return;
  if ((p.cooldown['summons:accounts'] ?? 0) > w.now) return;
  p.cooldown['summons:accounts'] = w.now + 10 * 1440;
  mkJob(w, {
    kind: 'summons', meeting: 'accounts', extra: { amt, kind }, giver: boss.id, via: 'boss', assignee: p.id, pay: 0, days: 3,
    title: `${boss.name} wants to see you about the money`,
    brief: kind === 'missed' ? `You have come up short on what you owe ${boss.name}, and he has noticed. He wants you in front of him.` : `${boss.name} has been through the numbers and something doesn’t add up. He wants an explanation.`,
  });
}

function discoverSide(w: World, boss: Character, c: Character) {
  c.books.sideKnown = true;
  const f = addFact(w, { kind: 'side_operation', actor: c.id, victim: boss.id, amount: c.books.side, text: `${boss.name} found out ${c.name} has been running something on the side.`, district: c.district }, { witnesses: [boss.id] });
  if (boss.isPlayer) return;
  const fl = (boss.books.flags[c.id] ??= { amt: 0, n: 0, last: 0 });
  fl.amt += Math.round((c.books.side ?? 0) * 4 * 0.5);
  fl.n = Math.max(fl.n, 2);
  react(w, boss, c, fl, f.id);
}

// An NPC superior's response to repeated shortfalls: a warning, then a demand, then punishment.
export function react(w: World, boss: Character, c: Character, fl: { amt: number; n: number; last: number }, cause: Id) {
  if (fl.n <= 1) {
    feel(w, c, boss.id, 'trust', -0.03);
    addFact(w, { kind: 'discipline', actor: boss.id, victim: c.id, cause, minor: true, text: `${boss.name} warned ${c.name} that his numbers don't add up.`, district: c.district }, { witnesses: [] });
    return;
  }
  if (fl.n === 2) {
    c.books.arrears += Math.round(fl.amt);
    feel(w, c, boss.id, 'trust', -0.06);
    bear(w, c, boss.id, 0.05, `${boss.name} made him make up what he was short`);
    addFact(w, { kind: 'discipline', actor: boss.id, victim: c.id, cause, text: `${boss.name} told ${c.name} to make up ${money(Math.round(fl.amt))}.`, district: c.district }, { witnesses: [] });
    return;
  }
  discipline(w, boss, c, cause, Math.round(fl.amt));
  fl.n = 0;
  fl.amt = 0;
}

export function discipline(w: World, boss: Character, c: Character, cause: Id, amt: number) {
  const protectedShops = Object.values(w.biz).filter((s) => s.protection?.collectorId === c.id);
  if (temper(boss).volatility > 0.55 && c.hurtUntil <= w.now) {
    c.hurtUntil = w.now + 3 * DAYS;
    boss.heat = clamp(boss.heat + 0.1, 0, 1.5);
    bear(w, c, boss.id, 0.25, `${boss.name} had him roughed up over his envelope`);
    addFact(w, { kind: 'discipline', actor: boss.id, victim: c.id, cause, text: `${boss.name} had ${c.name} beaten for skimming.`, district: c.district }, { witnesses: [], broadcast: subordinates(w, boss).map((x) => x.id) });
  } else if (protectedShops.length) {
    const s = protectedShops[0];
    setCollector(w, s, boss.id, boss.familyId!, { keepOwed: true }); // the arrangement, and anything owed under it, goes up a level
    feel(w, c, boss.id, 'trust', -0.15);
    addFact(w, { kind: 'discipline', actor: boss.id, victim: c.id, cause, text: `${boss.name} took ${s.name} away from ${c.name} over the missing money.`, district: s.district }, { witnesses: [], broadcast: subordinates(w, boss).map((x) => x.id) });
  } else {
    c.books.arrears += amt;
    c.kickRate = Math.min(0.3, c.kickRate + 0.05);
    feel(w, c, boss.id, 'trust', -0.12);
    addFact(w, { kind: 'discipline', actor: boss.id, victim: c.id, cause, text: `${boss.name} doubled ${c.name}'s debt and raised his share.`, district: c.district }, { witnesses: [] });
  }
}
const DAYS = 1440;

// --------------------------------------------------------------- influence

const RW: Record<Rank, number> = { civilian: 0, associate: 1, soldier: 3, capo: 6, underboss: 10, boss: 15 };

// Rank is formal position, reputation (standing) is what people believe about you,
// influence is how much you can actually move people: who backs you, who listens, what you control.
// It is measured against everyone else in the organisation, so it means the same on day 1 and day 300.
function rawInfluence(w: World, c: Character): number {
  let support = 0;
  let access = 0;
  for (const x of Object.values(w.chars)) {
    if (!x.alive || x.id === c.id) continue;
    const r = x.rels[c.id];
    if (!r) continue;
    if (r.trust >= 0.6) support += RW[x.rank] * ((r.trust + r.respect) / 2);
    if (RW[x.rank] > RW[c.rank]) access += RW[x.rank] * Math.max(0, r.respect - 0.45);
  }
  const holdings = Object.values(w.biz).filter((b) => b.protection?.collectorId === c.id || b.ownerId === c.id).length;
  const wealth = Math.min(15, Math.max(0, c.cash) / 800);
  return RW[c.rank] * 5 + support * 2 + access * 2 + holdings * 3 + wealth + c.standing * 0.2;
}
const medians = new Map<string, number>();
function medianRaw(w: World): number {
  const key = `${w.seed}:${Math.floor(w.now / 1440)}`;
  let m = medians.get(key);
  if (m === undefined) {
    const xs = Object.values(w.chars).filter((c) => c.alive && c.familyId).map((c) => rawInfluence(w, c)).sort((a, b) => a - b);
    m = xs[Math.floor(xs.length / 2)] ?? 1;
    if (medians.size > 20) medians.clear();
    medians.set(key, m);
  }
  return Math.max(4, m);
}
export function influence(w: World, c: Character): number {
  const raw = rawInfluence(w, c);
  return Math.round((100 * raw) / (raw + medianRaw(w) * 1.8));
}
export const influenceWord = (n: number) => (n < 15 ? 'nobody yet' : n < 30 ? 'known' : n < 50 ? 'has pull' : n < 70 ? 'well connected' : 'a power');

// -------------------------------------------------------------- the player

export function setStance(c: Character, s: 'honest' | 'shave' | 'stall') {
  c.books.stance = s;
}

// Go through a man's books. He may not like it. A careful man is harder to read.
export function auditMember(w: World, p: Character, sub: Character): { minutes: number; lines: string[] } {
  const lines: string[] = [];
  const minutes = travelTime(p.district, sub.district) + 60;
  p.district = sub.district;
  const r = rel(sub, p.id);
  const pr = clamp(0.5 + p.traits.caution * 0.25 - temper(sub).caution * 0.35 + r.trust * 0.2, 0.15, 0.9);
  if (!w.rng.chance(pr)) {
    feelOn(w, r, 'trust', -0.05);
    lines.push(`${sub.name} is vague and keeps changing the subject. You leave knowing nothing you could prove, and he knows you were checking.`);
    return { minutes, lines };
  }
  const h = sub.books.history.slice(-4);
  // Only what you could see for yourself is in the books you are shown. Income from sources you cannot see is not on the page,
  // so a man with a quiet side income and an honest set of books looks exactly like an honest man.
  const visible = (x: { sources: Record<string, number> }) => Object.entries(x.sources).reduce((a, [s, v]) => a + (seen(sub, s) >= 0.5 ? v * wt(s) : 0), 0);
  const gross = h.reduce((a, x) => a + visible(x), 0);
  if (!h.length) lines.push('There’s nothing to go through yet.');
  else {
    const totals: Record<string, number> = {};
    for (const x of h) for (const [s, v] of Object.entries(x.sources)) if (seen(sub, s) >= 0.5) totals[s] = (totals[s] ?? 0) + v * wt(s);
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, v]) => `${SOURCE_LABEL[s] ?? s} ${money(v)}`).join(', ');
    const due = h.reduce((a, x) => a + x.due, 0);
    lines.push(`Last ${h.length} week${h.length > 1 ? 's' : ''}: from what you can see he made about ${money(gross)}${top ? ` (${top})` : ''}. He owed you ${money(due)} on it.`);
    const slump = visibleSlump(sub);
    if (slump < 0.75) lines.push('His takings this week are well down on his last month. A light envelope would not be a surprise.');
    const gap = Math.max(0, h.reduce((a, x) => a + Math.max(0, x.expected - x.due), 0));
    if (gap > 40) {
      const fl = (p.books.flags[sub.id] ??= { amt: 0, n: 0, last: 0 });
      fl.amt = Math.max(fl.amt, gap);
      fl.n = Math.max(fl.n, 1);
      fl.last = w.now;
      lines.push(`That’s ${money(gap)} he should have passed up and didn’t.`);
    } else lines.push('The numbers hold up.');
  }
  if (sub.books.side && !sub.books.sideKnown) {
    sub.books.sideKnown = true;
    addFact(w, { kind: 'side_operation', actor: sub.id, victim: p.id, amount: sub.books.side, text: `${p.name} found out ${sub.name} has been running something on the side.`, district: sub.district }, { witnesses: [] });
    lines.push(`And there’s something he hasn’t mentioned: he’s running a side operation worth about ${money(sub.books.side)} a week.`);
  }
  return { minutes, lines };
}

export const RULINGS: { code: string; label: string; hint: string }[] = [
  { code: 'warn', label: 'Warn him', hint: 'A quiet word. He knows you’re watching.' },
  { code: 'demand', label: 'Make him pay it back', hint: 'Adds what he owes to his arrears.' },
  { code: 'beat', label: 'Have him beaten', hint: 'He won’t forget it. The others will hear.' },
  { code: 'raise', label: 'Raise his share (+5%)', hint: 'More for you, resentment for him.' },
  { code: 'lower', label: 'Lower his share (-5%)', hint: 'Buys loyalty and costs money.' },
  { code: 'forgive', label: 'Let it slide', hint: 'Clears the flag. Some will take it as weakness.' },
];

export function rule(w: World, p: Character, sub: Character, code: string): { minutes: number; lines: string[] } {
  const lines: string[] = [];
  const fl = (p.books.flags[sub.id] ??= { amt: 0, n: 0, last: 0 });
  const r = rel(sub, p.id);
  switch (code) {
    case 'warn':
      feelOn(w, r, 'trust', -0.03);
      lines.push(`You tell ${sub.name} his numbers need to be better. He nods.`);
      break;
    case 'demand':
      sub.books.arrears += Math.round(fl.amt);
      feelOn(w, r, 'trust', -0.06);
      bearOn(w, r, 0.05, `${p.name} made him make up what he was short`);
      lines.push(`${sub.name} owes you an extra ${money(Math.round(fl.amt))}, to be paid as he can.`);
      fl.amt = 0;
      fl.n = 0;
      break;
    case 'beat': {
      const a = perform(w, { kind: 'retaliate', mode: 'beat', actor: p.id, target: sub.id, label: '', score: 0 });
      lines.push(...a.lines);
      repute(w, p, -1, 'audited');
      fl.amt = 0;
      fl.n = 0;
      return { minutes: a.minutes, lines };
    }
    case 'raise':
      sub.kickRate = Math.min(0.35, sub.kickRate + 0.05);
      feelOn(w, r, 'trust', -0.08);
      feelOn(w, r, 'respect', -0.04);
      lines.push(`${sub.name} will now pass up ${Math.round(sub.kickRate * 100)}%. He doesn’t look happy.`);
      break;
    case 'lower':
      sub.kickRate = Math.max(0.05, sub.kickRate - 0.05);
      feelOn(w, r, 'trust', 0.08);
      feelOn(w, r, 'affection', 0.05);
      lines.push(`${sub.name} will now pass up ${Math.round(sub.kickRate * 100)}%. He’s grateful.`);
      break;
    case 'forgive':
      fl.amt = 0;
      fl.n = 0;
      feelOn(w, r, 'trust', 0.03);
      lines.push(`You let it go. ${sub.name} will remember that.`);
      break;
  }
  addFact(w, { kind: 'discipline', actor: p.id, victim: sub.id, minor: true, text: `${p.name} dealt with ${sub.name} over money (${code}).`, district: sub.district }, { witnesses: [] });
  return { minutes: 30, lines };
}


// A look through a man's books, done across the table on Sunday. It takes no time. A careful man is harder to read.
export function checkBooks(w: World, p: Character, sub: Character): string[] {
  const s = statement(w, sub);
  const r = rel(sub, p.id);
  const pr = clamp(0.62 + p.traits.caution * 0.2 - temper(sub).caution * 0.3 + r.trust * 0.15, 0.2, 0.92);
  if (!w.rng.chance(pr)) { feelOn(w, r, 'trust', -0.02); return [`${sub.name.split(' ')[0]} is vague about his numbers and watches you read them. You learn nothing you could prove.`]; }
  const lines: string[] = [];
  lines.push(`He passed up ${money(s.handed)} of ${money(s.due)} due${s.carry ? ` (${money(s.carry)} of that was left over from before)` : ''}.`);
  const gap = Math.max(0, s.expected - s.weekDue);
  if (s.expected > 0) lines.push(`From what you can see for yourself (shops, collections, his regular work) he should have passed up about ${money(s.expected)}.`);
  const fl = (p.books.flags[sub.id] ??= { amt: 0, n: 0, last: 0 });
  if (gap > Math.max(40, s.expected * 0.15)) {
    fl.amt = Math.max(fl.amt, gap); fl.n = Math.max(fl.n, 1); fl.last = w.now;
    lines.push(`That is about ${money(gap)} more than he declared. Either he’s skimming or you’re not seeing the whole picture.`);
  } else if (s.short > 0) lines.push(visibleSlump(sub) < 0.75 ? `He’s ${money(s.short)} light, but the numbers he gave you match what you can see, and what you can see is a bad week. He ran short.` : `He’s ${money(s.short)} light, though his numbers match what you can see. Nothing in the books says why.`);
  else lines.push('The numbers add up. Nothing hidden that you can see.');
  if (sub.problem?.revealed) lines.push(`You know he’s ${PROBLEM_WORD[sub.problem.kind] ?? 'in trouble'}. That would explain a light week.`);
  return lines;
}
const PROBLEM_WORD: Record<string, string> = { gambling: 'gambling too much', debt: 'in debt', family: 'having family trouble', drink: 'drinking', house: 'having trouble with his home', woman: 'tangled up with a woman', resentment: 'sore at you' };
