// Who you were before March 1970, and what you carried in with you. A background is applied once, when a new world is made
// (createWorld), and never again: after that every piece of it belongs to the ordinary simulation. The skills grow like anyone's,
// the share is paid out of a real till, the debt is a real debt, the job pays from a real business, the car sells like any car,
// and the brother is a soldier who lives his own life. Nothing here runs each day, and nothing here is checked again later.
import { addFact, createDebt, money, ownerBiz, rel } from './core';
import { FEMALE } from './world';
import { addStake } from './econ';
import { SKILLS } from './people';
import { Business, Character, DAY, Skill, World } from './types';

export interface Background {
  id: string;
  label: string;
  blurb: string; // the history, as the player reads it
  skills: [Skill, Skill]; // what that life taught him, strongest first
  cash: number;
  life: string[]; // what he brings, in plain words. Each line describes what applyBackground actually does.
}

// The packages are meant to be worth about the same in the first month, held in different forms: cash in hand, stock to move,
// a share that pays weekly, a wage that costs time, a debt that may or may not come in, a car with the police behind it,
// or a brother. None of them is a rank, a crew, a sponsor or a shortcut through the early weeks.
export const BACKGROUNDS: Background[] = [
  {
    id: 'hustler', label: 'Street Hustler', skills: ['charm', 'nerve'], cash: 1150,
    blurb: 'You learned to make money on the corners: running errands, moving whatever fell off a truck, and knowing who to avoid. Nobody ever gave you anything. You talked your way into most of it.',
    life: ['$1,150 in your pocket', '$700 of stolen goods still to move. A pawnshop pays forty cents on the dollar'],
  },
  {
    id: 'connected', label: 'Connected Family', skills: ['nerve', 'muscle'], cash: 1250,
    blurb: 'You grew up around men who never explained what they did for a living. Your older brother is one of them now, made in the Corrente family. His name opens doors, and he will hear about everything you do.',
    life: ['$1,250 in your pocket', 'An older brother, a made soldier in another Corrente crew. He answers to his own captain, not to you'],
  },
  {
    id: 'business', label: 'Small Businessman', skills: ['brains', 'charm'], cash: 1000,
    blurb: 'You tried making an honest living behind a counter. You learned the books, the customers and the suppliers, and that honesty wasn’t always profitable. You sold up, but you kept a piece.',
    life: ['$1,000 in your pocket', 'A tenth share of the shop you sold. It pays out of the weekly takings, when there are any'],
  },
  {
    id: 'union', label: 'Union Man', skills: ['muscle', 'charm'], cash: 1150,
    blurb: 'You worked the loading floors alongside men who understood that influence could be worth more than wages. You still carry the card, and the early shift is still yours if you want it.',
    life: ['$1,150 in your pocket', 'A union porter’s job: four hours before dawn, $75 a shift out of the owner’s till'],
  },
  {
    id: 'bookmaker', label: 'Bookmaker', skills: ['brains', 'nerve'], cash: 900,
    blurb: 'You took bets, kept records and learned that collecting money was harder than making it. One of your old customers still owes you. He pays, slowly, and you have never once let him forget it.',
    life: ['$900 in your pocket', '$500 still owed by an old customer: about $60 a week with interest, for as long as his luck holds'],
  },
  {
    id: 'wheelman', label: 'Wheelman', skills: ['driving', 'nerve'], cash: 950,
    blurb: 'You drove for men who paid well and preferred you didn’t ask questions. The last job left you with a car that isn’t yours, and a description the police would like to match.',
    life: ['$950 in your pocket', 'A stolen car that has to go. A garage will pay $550 for it', 'The police have noticed you'],
  },
];
// Saves from before V86 may carry one of the earlier backgrounds; they keep their name on the record.
const LEGACY: Record<string, string> = { boxer: 'Former boxer', convict: 'Ex-convict', driver: 'Driver' };
export const bgOf = (id?: string) => BACKGROUNDS.find((b) => b.id === id);
export const bgLabel = (id?: string) => bgOf(id)?.label ?? (id ? LEGACY[id] : undefined);

// ------------------------------------------------------------------ skills
// Every man rolls his own skills (people.ts rollSkills). A background decides which of those rolls land where: his best two
// go to what his old life taught him, and the other three keep their own order. If the best two are weak, the lead is topped
// up from the other three, so the total stays what he rolled: a background shapes a man, it never makes him better overall.
export const LEAD = 0.62, SECOND = 0.5, FLOOR = 0.2;
export function shapeSkills(p: Character, [a, b]: [Skill, Skill]) {
  const s = { ...p.skills };
  const vals = SKILLS.map((k) => s[k]).sort((x, y) => y - x);
  const rest = SKILLS.filter((k) => k !== a && k !== b).sort((x, y) => s[y] - s[x]);
  s[a] = vals[0];
  s[b] = vals[1];
  rest.forEach((k, i) => (s[k] = vals[2 + i]));
  // A strong lead can spare its surplus for the second skill; otherwise the other three pay, down to the floor.
  if (s[b] < SECOND && s[a] > LEAD) { const x = Math.min(SECOND - s[b], s[a] - LEAD); s[a] -= x; s[b] += x; }
  const need = Math.max(0, LEAD - s[a]) + Math.max(0, SECOND - s[b]);
  const spare = rest.reduce((t, k) => t + Math.max(0, s[k] - FLOOR), 0);
  const give = Math.min(need, spare);
  if (give > 0) {
    for (const k of rest) s[k] -= (Math.max(0, s[k] - FLOOR) / spare) * give;
    const toA = Math.min(give, Math.max(0, LEAD - s[a]));
    s[a] += toA;
    s[b] += give - toA;
  }
  for (const k of SKILLS) s[k] = Math.round(s[k] * 1000) / 1000;
  p.skills = s;
}

// ------------------------------------------------------------------ the starting life
const isFemale = (c: Character) => FEMALE.includes(c.name.split(' ')[0]);
const surnameOf = (p: Character) => p.name.split(' ').slice(1).join(' ') || p.name;
const kinIds = (w: World) => new Set((w.life?.kin ?? []).map((k) => k.id));
const civilianShops = (w: World, kinds: string[]) => {
  const kin = kinIds(w);
  return Object.values(w.biz).filter((b) => b.open && kinds.includes(b.kind) && !b.stakes?.length && w.chars[b.ownerId]?.alive && w.chars[b.ownerId].rank === 'civilian' && !kin.has(b.ownerId));
};

// He sold his shop and kept a tenth of it. The shop carries his name still; its new owner pays his share from the till each week.
function soldShop(w: World, p: Character): boolean {
  const pool = civilianShops(w, ['deli', 'bakery', 'grocer', 'hardware', 'tailor', 'barber', 'cafe', 'butcher', 'candy', 'shoes', 'florist']);
  if (!pool.length) return false;
  const b = w.rng.pick(pool);
  const o = w.chars[b.ownerId];
  const at = b.name.indexOf("'s ");
  if (at > 0) b.name = `${surnameOf(p)}'s ${b.name.slice(at + 3)}`;
  (b.owners ??= []).push({ id: p.id, from: w.now - 9 * 365 * DAY, to: w.now - 200 * DAY, how: 'sold' });
  addStake(w, b, p.id, 0.1, 'kept a share when he sold up');
  meet(w, p, o, 0.35);
  addFact(w, { kind: 'ownership', actor: o.id, victim: p.id, business: b.id, text: `${o.name} bought ${b.name} from ${p.name}, who kept a tenth of it.`, district: b.district });
  return true;
}

// Union scale on a loading floor: a real job at a real business (orders.ts workShift pays it from that business's till).
function unionJob(w: World, p: Character): boolean {
  for (const kinds of [['fish'], ['grocer', 'hardware', 'butcher', 'bakery'], ['garage', 'laundromat', 'deli']]) {
    const pool = civilianShops(w, kinds);
    if (!pool.length) continue;
    const b = w.rng.pick(pool);
    const o = w.chars[b.ownerId];
    p.job = { kind: 'porter', biz: b.id, boss: o.id, since: w.now, noticed: 0, shifts: 0 };
    meet(w, p, o, 0.35);
    return true;
  }
  return false;
}

// What is left of the book: one customer who still owes, chosen from the men in the city who gamble hardest and have no shop
// behind them, so each week's payment comes out of his own pocket. Most weeks it does; the debt system decides the rest.
function oldDebt(w: World, p: Character): boolean {
  const kin = kinIds(w);
  const owes = (c: Character) => w.debts.some((d) => d.status === 'active' && d.debtor === c.id);
  const men = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.prospect && !kin.has(c.id) && !isFemale(c) && !owes(c));
  const pocket = men.filter((c) => !ownerBiz(w, c.id));
  const pool = (pocket.length ? pocket : men).sort((x, y) => y.traits.vice - x.traits.vice).slice(0, 4);
  if (!pool.length) return false;
  const c = w.rng.pick(pool);
  // The money left his hands long ago (it is not in his $1,000), so nothing moves now: only the debt is written down.
  const d = createDebt(w, p.id, c.id, 500, 0.05, 'a gambling debt');
  d.nextDue = w.now + w.rng.int(2, 5) * DAY;
  const f = addFact(w, { kind: 'loan', actor: p.id, victim: c.id, amount: 500, text: `${c.name} owes ${p.name} ${money(500)} from the book ${p.name} used to run.`, district: c.district });
  d.cause = f.id;
  return true;
}

// Somebody he already knows: introduced, and no more than that. Trust is earned in play.
function meet(w: World, p: Character, o: Character, trust: number) {
  (p.intro ??= {})[o.id] = w.now;
  for (const [x, y] of [[p, o], [o, p]] as [Character, Character][]) {
    const r = rel(x, y.id);
    r.trust = Math.max(r.trust, trust);
    r.respect = Math.max(r.respect, 0.3);
    r.lastMet = w.now - 10 * DAY;
  }
}

// Applied once, by createWorld, to a brand-new player. (The Connected Family brother is made there too, with the other soldiers.)
export function applyBackground(w: World, p: Character, id: string) {
  const b = bgOf(id);
  if (!b) return;
  p.bg = b.id;
  shapeSkills(p, b.skills);
  p.cash = b.cash;
  switch (b.id) {
    case 'hustler': p.goods += 700; break;
    case 'business': if (!soldShop(w, p)) p.cash += 500; break; // no shop to have sold: the money stayed in the bank
    case 'union': if (!unionJob(w, p)) p.cash += 300; break;
    case 'bookmaker': if (!oldDebt(w, p)) p.cash += 500; break;
    case 'wheelman': p.cars += 1; p.heat = Math.max(p.heat, 0.2); break;
  }
}

// ------------------------------------------------------------------ telling him
// The first lines of a new game: where his old life left him, read from the world as it now stands.
export function startingLines(w: World, p: Character): string[] {
  const kin = w.life?.kin ?? [];
  switch (p.bg) {
    case 'hustler':
      return p.goods ? [`You’re sitting on ${money(p.goods)} of goods from the last thing you moved. A pawnshop will take them off your hands, at a price.`] : [];
    case 'connected': {
      const bro = kin.map((k) => w.chars[k.id]).find((c) => c && c.rank !== 'civilian' && c.familyId === p.familyId);
      const cap = bro?.bossId ? w.chars[bro.bossId] : undefined;
      return bro ? [`Your brother ${bro.name} is a soldier in ${cap ? `${cap.name}’s crew` : 'the family'}. He vouched for nothing and promised nothing, but he will hear about everything you do.`] : [];
    }
    case 'business': {
      const x = Object.values(w.biz).find((b) => b.stakes?.some((s) => s.holder === p.id));
      return x ? [`You still own a tenth of ${x.name}. ${w.chars[x.ownerId].name} runs it now and pays your share out of the week’s takings, when there are takings.`] : [];
    }
    case 'union': {
      const b: Business | undefined = p.job?.biz ? w.biz[p.job.biz] : undefined;
      return b && p.job ? [`Your union card still gets you the early shift at ${b.name}, for ${w.chars[p.job.boss].name}. Four hours, union scale, paid out of his till.`] : [];
    }
    case 'bookmaker': {
      const d = w.debts.find((x) => x.creditor === p.id && x.status === 'active');
      return d ? [`${w.chars[d.debtor].name} still owes you ${money(d.balance)} from the book you used to run. ${money(d.weeklyPayment)} a week, if he pays.`] : [];
    }
    case 'wheelman':
      return p.cars ? [`There’s a stolen car parked off a side street with your prints on the wheel. A garage will take it. The police would like a word with whoever drove it.`] : [];
  }
  return [];
}
