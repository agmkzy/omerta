// Ambition, in one module (V72). Two things live here, both about the player:
//   MILESTONES  - the ladder of goals each rank band expects (AMBITIONS). Automatic; meeting one pays a reward. Stored in w.goals.done.
//   CURRENT AMBITION - the one thing the player has chosen to pursue (AMBS). Stored on the character as p.ambition.
// They share their measures (crew, shops, cash) and one tick. Nothing here belongs to NPCs: what NPCs want is in people.ts / pulse.ts.
import { addFact, clamp, money, rel, repute } from './core';
import { owedTo } from './encounters';
import { pathInfo } from './path';
import { prospects } from './orders';
import { Character, Rank, World } from './types';

export type Band = 'associate' | 'made' | 'capo' | 'top';
export interface Ambition {
  key: string;
  band: Band;
  title: string;
  why: string;
  how: string;
  head?: boolean;
  measure: (w: World, p: Character) => [number, number];
  reward: { cash?: number; standing?: number };
}
export interface Prog { a: Ambition; have: number; need: number; pct: number; done: boolean; at?: number }

const ORDER: Rank[] = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const ri = (r: Rank) => ORDER.indexOf(r);
export const bandOf = (r: Rank): Band => (r === 'associate' || r === 'civilian' ? 'associate' : r === 'soldier' ? 'made' : r === 'capo' ? 'capo' : 'top');

const crew = (w: World, p: Character) => Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).length;
const shops = (w: World, p: Character) => Object.values(w.biz).filter((b) => b.open && b.protection?.collectorId === p.id && b.protection.fee > 0).length;
const ops = (w: World, p: Character) => w.ops.filter((o) => o.owner === p.id && o.kind !== 'hijack' && (o.state === 'running' || o.state === 'raided')).length;
const out = (w: World, p: Character) => w.debts.filter((d) => d.status === 'active' && d.creditor === p.id).reduce((a, d) => a + d.balance, 0);
const friends = (w: World, p: Character) => Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && (c.rels[p.id]?.trust ?? 0) >= 0.5).length;
const bossTrust = (w: World, p: Character) => { const b = p.bossId ? w.chars[p.bossId] : undefined; return b ? Math.round(rel(b, p.id).trust * 100) : 0; };

export const AMBITIONS: Ambition[] = [
  // ---- associate
  { key: 'earner', band: 'associate', title: 'Put $2,500 in your pocket', why: 'Money is the first language. A man with no cash can’t buy a runner, a favour or his way out of trouble.', how: 'Work jobs, collect, and keep what you earn. Don’t spend it on losing hands.', measure: (w, p) => [p.cash, 2500], reward: { standing: 2 } },
  { key: 'envelope', band: 'associate', title: 'Get a shop paying you every week', why: 'A weekly envelope is proof you can do the job, and it’s money that keeps coming while you sleep.', how: 'Open Rackets, then Protection, and lean on a shop. Pick one that isn’t already someone’s.', measure: (w, p) => [shops(w, p), 1], reward: { cash: 150, standing: 2 } },
  { key: 'friends', band: 'associate', title: 'Make five men who’d speak for you', why: 'To be made you need a sponsor, and sponsors only back men that other men speak well of.', how: 'Spend time with the family at the club. Do favours. Don’t take sides in small quarrels.', measure: (w, p) => [friends(w, p), 5], reward: { standing: 3 } },
  { key: 'bosstrust', band: 'associate', title: 'Earn your boss’s trust', why: 'Everything in the family runs through him. Until he trusts you, nothing opens.', how: 'Do what he asks, bring in what you owe, and don’t embarrass him.', measure: (w, p) => [bossTrust(w, p), 60], reward: { standing: 3 } },
  { key: 'crew6', band: 'associate', title: 'Put six men under you', why: 'A crew means you can be in three places at once. It’s also how the family sees you’re ready to lead.', how: 'Recruit under Family, Your men. Take men who owe you, or who are hungry.', measure: (w, p) => [crew(w, p), 6], reward: { cash: 100, standing: 2 } },
  { key: 'racket1', band: 'associate', title: 'Run a standing racket', why: 'A racket earns while you’re busy elsewhere. Numbers, vending machines, a front: any of them will do.', how: 'See Rackets, Standing rackets. Set one up and put a runner on it.', measure: (w, p) => [ops(w, p), 1], reward: { cash: 200, standing: 2 } },
  { key: 'favours3', band: 'associate', title: 'Be owed three favours', why: 'Favours are the real currency. Cash gets spent, and a favour is held in reserve.', how: 'Say yes when men ask for help, and name your price when it’s big.', measure: (w, p) => [owedTo(w, p.id).length, 3], reward: { standing: 2 } },
  { key: 'name', band: 'associate', title: 'Build a name men respect', why: 'Reputation gets you a seat at the table where the real decisions get made.', how: 'Finish jobs cleanly, pay your debts, and keep your word.', measure: (w, p) => [p.standing, 60], reward: { cash: 150 } },
  { key: 'made', band: 'associate', head: true, title: 'Get made', why: 'This is the line. Cross it and you’re a soldier, protected and answerable. The family has to want you and your sponsor has to vouch.', how: 'Follow “The road to being made” card under World: earn, finish jobs, build your name, win a sponsor, pass the trial. Then the family makes room.', measure: (w, p) => [ri(p.rank) >= 2 ? 1 : 0, 1], reward: { cash: 500, standing: 5 } },
  // ---- made
  { key: 'racket2', band: 'made', title: 'Run two rackets at once', why: 'One racket is a job. Two is an operation, and men start asking what you’re building.', how: 'Open a second racket in a different line, or in a different district.', measure: (w, p) => [ops(w, p), 2], reward: { cash: 300, standing: 2 } },
  { key: 'shops3', band: 'made', title: 'Have three shops paying you', why: 'Three envelopes a week is a steady wage, and a small kingdom.', how: 'Lean on shops that aren’t already paying anyone. Mind the late ones.', measure: (w, p) => [shops(w, p), 3], reward: { standing: 3 } },
  { key: 'crew5', band: 'made', title: 'Command five men', why: 'Five men is the size of a real crew. A capo has more.', how: 'Recruit, promote the reliable, drop the skimmers.', measure: (w, p) => [crew(w, p), 5], reward: { standing: 3 } },
  { key: 'cash10', band: 'made', title: 'Be worth $10,000', why: 'Capos get paid. They also get asked to lend.', how: 'Mix racket income, loans and jobs. Don’t let it all sit in your pocket.', measure: (w, p) => [p.cash, 10000], reward: { standing: 3 } },
  { key: 'loans2k', band: 'made', title: 'Have $2,000 out on the street', why: 'Money lent out earns every week, and it puts men in your debt.', how: 'Lend to men with steady income. See Loan sharking.', measure: (w, p) => [out(w, p), 2000], reward: { standing: 2 } },
  { key: 'capo', band: 'made', head: true, title: 'Become a capo', why: 'A capo runs a crew and answers only to the underboss. It’s the first real power in the family.', how: 'Earn for the family, keep your crew in line, and keep your boss happy.', measure: (w, p) => [ri(p.rank) >= 3 ? 1 : 0, 1], reward: { cash: 1000, standing: 6 } },
  // ---- capo
  { key: 'crew8', band: 'capo', title: 'Command eight men', why: 'A capo with a big crew can’t be ignored in a sit-down.', how: 'Recruit and keep them paid. Weak men are a liability.', measure: (w, p) => [crew(w, p), 8], reward: { standing: 3 } },
  { key: 'cash25', band: 'capo', title: 'Be worth $25,000', why: 'The top of the family doesn’t live on small money.', how: 'Docks, unions and a lot of envelopes.', measure: (w, p) => [p.cash, 25000], reward: { standing: 3 } },
  { key: 'ops3', band: 'capo', title: 'Run three rackets', why: 'Three lines of income means no single raid can ruin you.', how: 'Add docks or a union local if your boss allows it.', measure: (w, p) => [ops(w, p), 3], reward: { standing: 3 } },
  { key: 'underboss', band: 'capo', head: true, title: 'Become underboss', why: 'The underboss is the boss’s right hand. One step from the chair, and the target of everyone who wants it.', how: 'Follow the road card under World. The boss has to trust you, and your crew has to be big enough to matter.', measure: (w, p) => [ri(p.rank) >= 4 ? 1 : 0, 1], reward: { cash: 2500, standing: 8 } },
  // ---- top
  { key: 'rich50', band: 'top', title: 'Be worth $50,000', why: 'The boss is paid like one.', how: 'Everything above, a lot of it.', measure: (w, p) => [p.cash, 50000], reward: { standing: 3 } },
  { key: 'boss', band: 'top', head: true, title: 'Take the chair', why: 'The family is yours, and so is every enemy it has made.', how: 'The boss has to die, step down, or fall. You decide how much of that you want on your hands.', measure: (w, p) => [ri(p.rank) >= 5 ? 1 : 0, 1], reward: { standing: 10 } },
];

export function progress(w: World, p: Character): Prog[] {
  const band = bandOf(p.rank);
  const done = w.goals?.done ?? {};
  return AMBITIONS.filter((a) => a.band === band || done[a.key] !== undefined).map((a) => {
    const [have, need] = a.measure(w, p);
    return { a, have, need, pct: clamp(have / need), done: done[a.key] !== undefined, at: done[a.key] };
  });
}

// The few to show now: the headline, plus the three closest unfinished ones.
export function active(w: World, p: Character): { head?: Prog; list: Prog[] } {
  const band = bandOf(p.rank);
  const all = progress(w, p).filter((x) => x.a.band === band && !x.done);
  const head = all.find((x) => x.a.head);
  const list = all.filter((x) => !x.a.head).sort((a, b) => b.pct - a.pct).slice(0, 3);
  return { head, list };
}

export function ambitionTick(w: World) {
  const p = w.chars[w.playerId!];
  if (!p?.alive) return;
  currentAmbitionTick(w, p);
  w.goals ??= { done: {} };
  for (const a of AMBITIONS) {
    if (w.goals.done[a.key] !== undefined) continue;
    const [have, need] = a.measure(w, p);
    if (have < need) continue;
    // only count goals in your current band; earlier-band goals pass quietly
    const order: Band[] = ['associate', 'made', 'capo', 'top'];
    const quiet = order.indexOf(a.band) < order.indexOf(bandOf(p.rank));
    w.goals.done[a.key] = w.now;
    if (quiet) continue;
    if (a.reward.cash) p.cash += a.reward.cash;
    if (a.reward.standing) repute(w, p, a.reward.standing, 'milestone');
    const bits = [a.reward.cash ? `+${money(a.reward.cash)}` : '', a.reward.standing ? `standing +${a.reward.standing}` : ''].filter(Boolean).join(', ');
    addFact(w, { kind: 'report', actor: p.id, minor: true, text: `Ambition met: ${a.title}.${bits ? ' (' + bits + ')' : ''}`, district: p.district }, { witnesses: [p.id] });
  }
}

// At the start of a game, anything you already meet is simply behind you.
export function ambitionInit(w: World) {
  const p = w.chars[w.playerId!];
  w.goals = { done: {} };
  if (!p) return;
  for (const a of AMBITIONS) {
    if (a.band !== bandOf(p.rank)) continue;
    const [have, need] = a.measure(w, p);
    if (have >= need) w.goals.done[a.key] = w.now;
  }
}

export type AmbKind = 'made' | 'book' | 'crew' | 'shops' | 'rich' | 'respect';
export interface AmbDef { kind: AmbKind; label: string; blurb: string }
export const AMBS: AmbDef[] = [
  { kind: 'made', label: 'Rise in the family', blurb: 'Earn, finish work, win backers, and take the next rank.' },
  { kind: 'crew', label: 'Build a crew of five', blurb: 'Find men, take them on, and give them work.' },
  { kind: 'book', label: 'Run a betting operation', blurb: 'A numbers bank or a book, run by you or a trusted man.' },
  { kind: 'shops', label: 'Hold three shops', blurb: 'Three businesses paying you every week.' },
  { kind: 'rich', label: 'Save ten thousand dollars', blurb: 'Keep $10,000 in your own hands.' },
  { kind: 'respect', label: 'Become respected', blurb: 'Build a name men use without being asked.' },
];
export interface AmbProgress { frac: number; note: string; next: { text: string; a: string } }

const crewN = crew;
const shopsN = shops;
const betsN = (w: World, p: Character) => w.ops.filter((o) => o.owner === p.id && (o.kind === 'numbers' || o.kind === 'bookie') && o.state !== 'closed' && o.state !== 'done').length;

export function ambProgress(w: World, p: Character, kind: AmbKind): AmbProgress {
  switch (kind) {
    case 'crew': {
      const n = crewN(w, p), pr = prospects(w, p).length;
      return { frac: n / 5, note: `${Math.min(5, n)} of 5 men`, next: n >= 5 ? { text: 'You have your five.', a: 'tab:crew' } : pr ? { text: `${pr} men are looking for a start. Each costs $150.`, a: 'recruit:' } : { text: 'Nobody is looking for a start right now. Build a name and they will come.', a: 'tab:crew' } };
    }
    case 'book': {
      const n = betsN(w, p);
      return { frac: n ? 1 : p.cash >= 400 ? 0.4 : 0.1, note: n ? 'running' : p.cash >= 400 ? 'you can afford a start' : 'you need $400', next: n ? { text: 'It is running.', a: 'tab:rackets' } : { text: 'Start a bookmaking operation. $400 and a runner, or do it yourself.', a: 'way:bookie' } };
    }
    case 'shops': {
      const n = shopsN(w, p);
      return { frac: n / 3, note: `${Math.min(3, n)} of 3 paying`, next: n >= 3 ? { text: 'Three are paying.', a: 'tab:rackets' } : { text: 'Lean on a shop in your ground. Its owner must be someone who can pay.', a: 'way:protection' } };
    }
    case 'rich': return { frac: p.cash / 10000, note: `${money(p.cash)} of ${money(10000)}`, next: { text: 'Earn, collect, and don’t spend it.', a: 'tab:rackets' } };
    case 'respect': return { frac: p.standing / 75, note: `reputation ${Math.round(p.standing)} of 75`, next: { text: 'Keep your word, do favours, and be seen to pay your debts.', a: 'tab:life' } };
    default: {
      const i = pathInfo(w, p);
      if (!i) return { frac: 1, note: 'at the top', next: { text: 'There’s no higher rank.', a: 'tab:family' } };
      const open = i.goals.filter((g) => !g.done);
      const frac = i.goals.reduce((a, g) => a + g.frac, 0) / Math.max(1, i.goals.length);
      return { frac, note: `${i.goals.filter((g) => g.done).length} of ${i.goals.length} steps`, next: open[0] ? { text: `${open[0].label}: ${open[0].tip}`, a: 'tab:family' } : { text: 'Everything is done. Wait for word.', a: 'tab:family' } };
    }
  }
}

function currentAmbitionTick(w: World, p: Character) {
  const a = p.ambition;
  if (!a || a.done) return;
  const pr = ambProgress(w, p, a.kind as AmbKind);
  if (a.kind === 'made' && a.rank0 && a.rank0 !== p.rank) pr.frac = 1;
  if (pr.frac >= 1) {
    a.done = true;
    repute(w, p, 2, 'ambition');
    addFact(w, { kind: 'report', actor: p.id, minor: true, text: `${p.name} did what he set out to do: ${AMBS.find((x) => x.kind === a.kind)?.label.toLowerCase()}.`, district: p.district }, { witnesses: [p.id] });
  }
}
