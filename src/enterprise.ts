// The economy's people (October 2026, the Economic World Expansion; docs/economy/AUDIT.md). An enterprise is a record in w.ops
// (rackets.ts runs the week for every one, the player's and every NPC's alike); this is what the four pilot rackets are made of
// beyond a number: the men and places they depend on, the stolen cars that pass through a chop shop, their history, who else has a
// claim on them, and what arises from all of it.
//
// The rule the owner set: the business creates the circumstances, the people create the gameplay. So nothing here asks the player
// anything on a schedule. A racket runs itself; the week's take is what its people did. Something reaches the player only when it
// has actually happened (a car that belonged to the wrong man, a buyer in a cell, the number everybody played came in, a captain who
// has noticed how well it is doing), and then through the people concerned. An NPC owner meets the same circumstances and answers
// them himself, by his temper.
import { addFact, bear, clamp, createDebt, earn, feel, learn, money, ownerBiz, rel, transfer } from './core';
import { addEnc, addFavour } from './encounters';
import { aptitude, grow } from './people';
import { mkJob } from './jobs';
import { motives, pressed, toldOf } from './establishments';
import { isFemale } from './life';
import { noteRuling } from './standing';
import { temper } from './temper';
import { arch } from './voice';
import { DAY, WEEK, type Business, type Car, type Character, type Enc, type Id, type Op, type OpLink, type OpRole, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const ok = (w: World, c?: Character) => !!c?.alive && c.jailedUntil <= w.now;
const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const famName = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId]?.name : undefined);
export const PILOT = new Set(['chop', 'numbers', 'fencing', 'bookie']);

// ------------------------------------------------------------------------------------------------ the year's cars
// What was on the streets of New York in 1970, and what a car is worth stripped for parts. A model year never runs past the
// current year of the game.
interface Model { make: string; model: string; from: number; value: number; w: number }
export const MODELS: Model[] = [
  { make: 'Cadillac', model: 'Coupe de Ville', from: 1959, value: 1500, w: 5 },
  { make: 'Cadillac', model: 'Fleetwood', from: 1959, value: 1450, w: 2 },
  { make: 'Lincoln', model: 'Continental', from: 1961, value: 1350, w: 4 },
  { make: 'Buick', model: 'Electra 225', from: 1959, value: 1050, w: 5 },
  { make: 'Oldsmobile', model: 'Toronado', from: 1966, value: 1000, w: 3 },
  { make: 'Chrysler', model: 'New Yorker', from: 1959, value: 900, w: 3 },
  { make: 'Pontiac', model: 'GTO', from: 1964, value: 950, w: 4 },
  { make: 'Dodge', model: 'Charger', from: 1966, value: 950, w: 3 },
  { make: 'Chevrolet', model: 'Chevelle SS', from: 1964, value: 850, w: 3 },
  { make: 'Ford', model: 'Mustang', from: 1965, value: 800, w: 5 },
  { make: 'Mercury', model: 'Cougar', from: 1967, value: 800, w: 2 },
  { make: 'Chevrolet', model: 'Impala', from: 1958, value: 650, w: 10 },
  { make: 'Ford', model: 'LTD', from: 1965, value: 650, w: 7 },
  { make: 'Ford', model: 'Galaxie 500', from: 1959, value: 550, w: 6 },
  { make: 'Pontiac', model: 'Bonneville', from: 1959, value: 700, w: 3 },
  { make: 'Plymouth', model: 'Fury', from: 1959, value: 600, w: 7 },
  { make: 'Volkswagen', model: 'Beetle', from: 1949, value: 300, w: 4 },
  { make: 'Ford', model: 'Econoline van', from: 1961, value: 550, w: 3 },
  { make: 'Dodge', model: 'A100 van', from: 1964, value: 500, w: 2 },
  { make: 'Chevrolet', model: 'C10 pickup', from: 1960, value: 500, w: 2 },
];
export const gameYear = (t: number) => new Date(Date.UTC(1970, 2, 2) + t * 60000).getUTCFullYear();
export const carName = (c: Car) => `${c.year} ${c.make} ${c.model}`;
export const carShort = (c: Car) => `’${String(c.year).slice(2)} ${c.make}`;
const COND: Record<Car['cond'], number> = { rough: 0.6, fair: 0.85, clean: 1, mint: 1.2 };

function pickModel(w: World, fury = false): Model {
  if (fury) return MODELS.find((m) => m.model === 'Fury')!;
  let r = w.rng.next() * MODELS.reduce((a, m) => a + m.w, 0);
  return MODELS.find((m) => (r -= m.w) <= 0) ?? MODELS[0];
}
// A car taken off the street by `thief` for `op`: whose it was is the world's (most are nobody the player will ever meet; now and then
// it is a made man's, or the police department's).
export function stealCar(w: World, op: Op, thief: Character | undefined, want?: string): Car {
  const yr = gameYear(w.now);
  const roll = w.rng.next();
  const wanted = want ? MODELS.find((x) => `${x.make}|${x.model}` === want) : undefined;
  const police = !wanted && roll < 0.012;
  const m = wanted ?? pickModel(w, police);
  // (a car to order is the year he asked for: two years old at most)
  const year = Math.max(m.from, wanted ? yr - Math.floor(w.rng.next() * 3) : yr - Math.floor(w.rng.next() ** 2 * 9));
  const cond = (['rough', 'fair', 'clean', 'mint'] as const)[Math.min(3, Math.floor(w.rng.next() * 4 * (year >= yr - 1 ? 1.3 : 1)))];
  const value = Math.round(m.value * Math.max(0.35, 1 - 0.07 * (yr - year)) * COND[cond] / 10) * 10;
  const car: Car = { id: 'car' + w.nextId++, make: m.make, model: m.model, year, cond, value, thief: thief?.id, op: op.id, t: w.now, status: 'stock' };
  if (police) { car.hot = 'police'; car.whose = 'an unmarked car out of the precinct'; }
  else if (roll < 0.07 && (m.value >= 900)) {
    // (a good car belongs to somebody: now and then a man in the life)
    const men = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId && c.rank !== 'associate' && c.id !== op.owner && (c.district === op.district || w.rng.chance(0.3))).sort(byId);
    const o = men.length ? men[w.rng.int(0, men.length - 1)] : undefined;
    if (o) { car.owner = o.id; car.hot = o.familyId === w.chars[op.owner]?.familyId ? 'family' : 'made'; }
  }
  if (!car.whose && !car.owner) car.whose = WHOSE[w.rng.int(0, WHOSE.length - 1)] + ' in ' + op.district;
  (w.cars ??= []).push(car);
  return car;
}
const WHOSE = ['a dentist', 'a schoolteacher', 'a salesman', 'a widow', 'a doctor on call', 'a couple at the pictures', 'a bus driver', 'a priest', 'a shoe-store manager', 'a man visiting his mother', 'an accountant', 'a nurse on nights'];
// (sold and gone a season since: the record of it is pruned so a long game's save doesn't grow with every car)
export function pruneCars(w: World) {
  if (!w.cars) return;
  const pl = w.playerId;
  w.cars = w.cars.filter((c) => { if (c.status === 'stock' || c.hot) return true; const op = w.ops.find((o) => o.id === c.op); const keep = op && (op.owner === pl || op.runner === pl) ? 120 : 10; return w.now - (c.out ?? c.t) < keep * DAY; });
  if (w.cars.length > 400) w.cars = w.cars.slice(-400);
}

// ------------------------------------------------------------------------------------------------ the people
export const linksOf = (op: Op, role: OpRole) => (op.links ?? []).filter((l) => l.role === role);
export function opNote(w: World, op: Op, text: string, who?: Id) {
  (op.hist ??= []).push({ t: w.now, text, who });
  if (op.hist.length > 30) op.hist.splice(0, op.hist.length - 30);
}
const SPOT_KINDS = new Set(['candy', 'barber', 'newsstand', 'bar', 'deli', 'cafe', 'billiards', 'grocer', 'diner', 'laundromat', 'cleaner', 'shoes', 'bakery', 'butcher', 'florist', 'fish', 'tailor', 'hardware', 'pharmacy']);
const CAR_BUYERS = new Set(['garage', 'hardware', 'pawnshop']);
const GOODS_BUYERS = new Set(['pawnshop', 'jeweller', 'hardware', 'photo', 'tailor', 'shoes']);
const WANT: Record<string, Partial<Record<OpRole, number>>> = {
  chop: { thief: 3, buyer: 1 }, numbers: { runner: 2, spot: 2 }, fencing: { thief: 3, buyer: 2 }, bookie: { regular: 4 },
};
const want = (op: Op, role: OpRole) => { const base = WANT[op.kind]?.[role]; if (!base) return 0; const g = (op.level ?? 1) - 1; return base + (role === 'buyer' ? Math.floor(g / 2) : role === 'regular' ? 2 * g : g); };

// Who an enterprise might take on, for a role: men of the owner's own first (his crew), then men of the district or the family's
// ground who suit the work. A man already in the same role for a rival is still a candidate; a man is never taken twice.
function candidates(w: World, op: Op, role: OpRole): (Character | Business)[] {
  const owner = w.chars[op.owner], fam = owner?.familyId ? w.fam[owner.familyId] : undefined;
  const near = (d: string) => d === op.district || !!fam?.districts.includes(d);
  const taken = new Set((op.links ?? []).map((l) => l.id));
  if (role === 'spot') {
    const held = new Set(w.ops.filter((o) => o !== op && o.kind === 'numbers' && o.state !== 'closed').flatMap((o) => linksOf(o, 'spot').map((l) => l.id)));
    return Object.values(w.biz).filter((b) => b.open && SPOT_KINDS.has(b.kind) && b.district === op.district && !taken.has(b.id) && !held.has(b.id)).sort(byId);
  }
  // (a runner works for one bank; a thief brings what he takes to two outfits at most, a gambler bets with two books)
  const busy = new Map<Id, number>();
  for (const o of w.ops) if (o !== op && o.state !== 'closed') for (const l of o.links ?? []) if (l.role === role) busy.set(l.id, (busy.get(l.id) ?? 0) + 1);
  const free = (c: Character) => (busy.get(c.id) ?? 0) < (role === 'runner' ? 1 : role === 'buyer' ? 3 : 2);
  const men = Object.values(w.chars).filter((c) => ok(w, c) && !c.isPlayer && c.id !== op.owner && c.id !== op.runner && !taken.has(c.id) && c.rank !== 'boss' && c.rank !== 'underboss' && free(c)).sort(byId);
  // (men who steal and carry slips for a racket are its owner's own people or nobody's: another family's associate works for his own)
  const ours = (c: Character) => !c.familyId || c.familyId === owner?.familyId;
  if (role === 'thief') return men.filter((c) => ours(c) && !isFemale(c) && (c.rank === 'civilian' && !ownerBiz(w, c.id) || c.rank === 'associate') && near(c.district) && c.traits.violence + c.skills.nerve + c.traits.greed > 0.95)
    .sort((a, b) => Number(b.bossId === op.owner) - Number(a.bossId === op.owner) || debtTo(w, b) - debtTo(w, a) || byId(a, b));
  if (role === 'runner') return men.filter((c) => ours(c) && (c.rank === 'civilian' && !ownerBiz(w, c.id) || c.rank === 'associate') && near(c.district) && c.traits.sociability > 0.35)
    .sort((a, b) => Number(b.bossId === op.owner) - Number(a.bossId === op.owner) || byId(a, b));
  if (role === 'regular') return men.filter((c) => c.traits.vice >= 0.5 && near(c.district) && c.id !== op.runner);
  // buyers: a man with a trade that can use what comes through, or a man in the life with an outlet of his own
  const trade = op.kind === 'chop' ? CAR_BUYERS : GOODS_BUYERS;
  return men.filter((c) => { const b = ownerBiz(w, c.id); return (b && trade.has(b.kind)) || (c.familyId && c.rank === 'soldier' && c.traits.greed > 0.55); })
    .sort((a, b) => Number(!!ownerBiz(w, b.id)) - Number(!!ownerBiz(w, a.id)) || byId(a, b));
}
// (what a man owes on the books around him: a gambler in deep to a book is the first to say yes to stealing a car)
const debtTo = (w: World, c: Character) => w.debts.filter((d) => d.status === 'active' && d.debtor === c.id).reduce((a, d) => a + d.balance, 0);

// An enterprise's people: dead or long gone men leave it; it takes on whom it needs, a few at a time, from those who would come.
export function staff(w: World, op: Op) {
  if (!PILOT.has(op.kind)) return;
  const owner = w.chars[op.owner];
  op.links = (op.links ?? []).filter((l) => {
    if (l.role === 'spot') { const b = w.biz[l.id]; return !!b?.open; }
    const c = w.chars[l.id];
    if (!c?.alive) { if (owner?.isPlayer) opNote(w, op, `${c?.name ?? 'One of the men'} is dead. He won’t be coming round any more.`, l.id); return false; }
    if (c.jailedUntil > w.now + 30 * DAY) { opNote(w, op, `${c.name} is inside for a long stretch. Somebody else will have to do what he did.`, l.id); return false; }
    return true;
  });
  // the chop shop's garage, the numbers bank's back room
  if (!op.base && (op.kind === 'chop' || op.kind === 'numbers')) {
    const kind = op.kind === 'chop' ? 'garage' : 'candy';
    // (a place houses one operation of a kind: a second chop shop works out of a lot, not the same garage)
    const housed = new Set(w.ops.filter((o) => o !== op && o.kind === op.kind && o.base && o.state !== 'closed').map((o) => o.base));
    const b = Object.values(w.biz).filter((x) => x.open && x.kind === kind && x.district === op.district && !housed.has(x.id)).sort(byId)[0];
    if (b) op.base = b.id;
  }
  for (const role of ['thief', 'buyer', 'runner', 'spot', 'regular'] as OpRole[]) {
    const n = want(op, role);
    let have = linksOf(op, role).length;
    if (have >= n) continue;
    const cs = candidates(w, op, role);
    // (one or two a week, not a full staff overnight; the first week fills it)
    for (let i = 0; i < cs.length && have < n && (op.weeks <= 1 || i < 1); i++) {
      const pickAt = role === 'spot' ? i : Math.min(cs.length - 1, Math.floor(w.rng.next() ** 1.6 * Math.min(cs.length, 6)));
      const x = cs.splice(pickAt, 1)[0];
      if (!x) break;
      (op.links ??= []).push({ id: x.id, role, since: w.now });
      have++;
      if ('rels' in x && owner) { const a = rel(x, owner.id), b = rel(owner, x.id); a.known = Math.max(a.known ?? 0, 0.3); b.known = Math.max(b.known ?? 0, 0.3); a.lastMet = b.lastMet = w.now; if (owner.isPlayer) (owner.intro ??= {})[x.id] ??= w.now; }
      if (op.weeks > 1 && owner?.isPlayer) opNote(w, op, joinLine(w, op, role, x), x.id);
    }
  }
}
function joinLine(w: World, op: Op, role: OpRole, x: Character | Business): string {
  const n = 'name' in x ? x.name : '';
  if (role === 'spot') return `${n} takes slips for the bank now.`;
  if (role === 'thief') return op.kind === 'chop' ? `${n} has started bringing cars in.` : `${n} has started bringing goods in.`;
  if (role === 'buyer') return op.kind === 'chop' ? `${n} takes parts now.` : `${n} buys from the fence now.`;
  if (role === 'runner') return `${n} has started running slips.`;
  return `${n} has started betting with the book.`;
}

// ------------------------------------------------------------------------------------------------ the week, by its people
// What each pilot racket did this week, from what its people did. `mult` is the rest of the world on it (the man running it, the
// family's directive, whose ground it is, how crowded the trade is), as rackets.ts works it out for every enterprise.
export function pilotWeek(w: World, op: Op, owner: Character, doer: Character, mult: number): { take: number; cause: string } | undefined {
  staff(w, op);
  // (the men who do its work see the man whose it is, and he them: a little more known each week, a little more trusted by an honest one)
  for (const l of op.links ?? []) { const c = w.chars[l.id]; if (!c?.alive || l.role === 'spot') continue; const r = rel(c, owner.id); r.known = Math.min(1, (r.known ?? 0) + 0.02); if (r.grudge < 0.2) feel(w, c, owner.id, 'trust', 0.004); }
  if (op.kind === 'chop') return chopWeek(w, op, owner, doer, mult);
  if (op.kind === 'numbers') return numbersWeek(w, op, owner, doer, mult);
  if (op.kind === 'fencing') return fenceWeek(w, op, owner, doer, mult);
  if (op.kind === 'bookie') return bookWeekPeople(w, op, owner, mult);
  return undefined;
}

// The chop shop: its thieves bring cars in (and are paid for each), it strips what it can, and its buyers take the parts.
function chopWeek(w: World, op: Op, owner: Character, doer: Character, mult: number): { take: number; cause: string } {
  const lvl = op.level ?? 1;
  let paid = 0, sales = 0, came = 0;
  const stock = () => (w.cars ?? []).filter((c) => c.op === op.id && c.status === 'stock');
  for (const l of linksOf(op, 'thief')) {
    const t = w.chars[l.id];
    if (!ok(w, t)) continue;
    const n = w.rng.chance(0.45 + aptitude(t, 'boost') * 0.4) ? (w.rng.chance(0.4) ? 2 : 1) : 0;
    for (let i = 0; i < n && stock().length < 4 + lvl * 2; i++) {
      const car = stealCar(w, op, t);
      const pay = Math.round((50 + car.value * 0.1) / 10) * 10;
      earn(t, pay, 'boost'); paid += pay; l.n = (l.n ?? 0) + 1; came++;
      grow(t, 'boost', 0.01);
      t.heat = clamp(t.heat + 0.03, 0, 1.5);
      if (car.owner) { const o = w.chars[car.owner]; const f = addFact(w, { kind: 'theft', actor: t.id, victim: o.id, hiddenActor: true, text: `${t.name} stole ${o.name}’s ${carName(car)}.`, textHidden: `${o.name}’s ${carName(car)} was stolen in ${op.district}.`, district: op.district }, { witnesses: [t.id] }); car.fact = f.id; }
      if (car.hot) hotCar(w, op, owner, car, t);
    }
  }
  // (a hot car nobody decided about is stripped with the rest after a week, and whether it is traced is the world's)
  for (const car of stock().filter((c) => c.hot && w.now - c.t > 7 * DAY)) {
    const th = car.thief ? w.chars[car.thief] : undefined;
    if (car.hot === 'police') owner.heat = clamp(owner.heat + 0.2, 0, 1.5);
    else if (car.owner && th && w.rng.chance(0.4)) carFound(w, op, owner, car, th);
    car.hot = undefined;
  }
  // stripping: a garage clears more than a back lot; a hot car stays in the bay until somebody decides what to do with it
  const cap = 2 + lvl + (op.base ? 1 : 0);
  const buyers = linksOf(op, 'buyer').map((l) => w.chars[l.id]).filter((c): c is Character => ok(w, c));
  let done = 0;
  for (const car of stock().filter((c) => !c.hot).slice(0, cap)) {
    // (a buyer of its own pays properly; without one, the scrap men under the expressway take parts at their price)
    const b = buyers.length ? buyers[done % buyers.length] : undefined;
    // (a crowded trade pays a little less a car: every shop on the ground is selling the same fenders)
    const price = Math.round(car.value * (b ? 0.5 + aptitude(doer, 'boost') * 0.1 + Math.min(0.08, rel(b, owner.id).trust * 0.1) : 0.28) * (0.7 + 0.3 * mult) / 10) * 10;
    car.status = 'sold'; car.buyer = b?.id; car.price = price; car.out = w.now;
    if (!b) { sales += price; done++; continue; }
    const bl = (op.links ?? []).find((l) => l.id === b.id && l.role === 'buyer'); if (bl) bl.n = (bl.n ?? 0) + 1;
    sales += price; done++;
    feel(w, b, owner.id, 'trust', 0.005);
  }
  const take = sales - paid;
  const cause = done ? `${done} ${done === 1 ? 'car' : 'cars'} stripped and gone${came ? `, ${came} more brought in` : ''}` : came ? `${came} ${came === 1 ? 'car' : 'cars'} brought in, nothing sold yet` : 'a quiet week in the bay';
  return { take, cause };
}

// The numbers: the spots take the slips, the runners carry them, the bank pays the hits. Most weeks the bank keeps about a quarter
// of what is bet; now and then the number everybody played comes in.
function numbersWeek(w: World, op: Op, owner: Character, doer: Character, mult: number): { take: number; cause: string } {
  const runners = linksOf(op, 'runner').map((l) => ({ l, c: w.chars[l.id] })).filter((x) => ok(w, x.c));
  const spots = linksOf(op, 'spot').map((l) => ({ l, b: w.biz[l.id] })).filter((x) => x.b?.open);
  const covered = spots.slice(0, Math.max(1, runners.length * 2));
  let action = 0;
  for (const s of covered) { const a = Math.round((150 + s.b.income * 0.4) * w.rng.range(0.8, 1.2)); action += a; s.l.n = (s.l.n ?? 0) + a; }
  // (and on the street, at the factory gate, on the stoops: every runner has his own players besides the counters)
  action += runners.reduce((a) => a + Math.round(w.rng.range(350, 600)), 0) + (runners.length ? 0 : 250);
  action = Math.round(action * (0.75 + aptitude(doer, 'numbers') * 0.5));
  if (!action) return { take: 0, cause: 'no spots taking slips' };
  // the runners' end: a fifth of what they carry
  let skim = 0;
  for (const r of runners) {
    const share = Math.round(action / Math.max(1, runners.length) * 0.2);
    earn(r.c, share, 'numbers'); grow(r.c, 'numbers', 0.01); r.l.n = (r.l.n ?? 0) + 1;
    if ((['schemer', 'bitter'].includes(arch(r.c)) || r.c.traits.greed > 0.75) && rel(r.c, owner.id).trust < 0.4 && w.rng.chance(0.15)) { const x = Math.round(share * w.rng.range(0.3, 0.8)); skim += x; r.c.cash += x; op.skimmed += x; }
  }
  const comm = Math.round(action * 0.2);
  let hits = Math.round(action * 0.55 * w.rng.range(0.55, 1.35));
  let cause = 'the slips came in and the hits were ordinary';
  // the number everybody played (a date in the paper, a hymn number, a funeral's plot): the bank's exposure on one number
  if (w.rng.chance(0.018)) {
    hits = Math.round(action * w.rng.range(1.6, 2.8));
    cause = 'the number everybody played came in';
    const loss = hits + comm - action;
    if (loss > 0 && owner.cash + (op.float ?? 0) < loss) bigHit(w, op, owner, loss);
  }
  const take = Math.round((action - comm - hits) * mult) - skim;
  return { take, cause };
}

// The fence: thieves bring what they've taken (a man's real goods when he has some, otherwise the week's ordinary loads), he pays a
// third, and his buyers take it at a little over half. Goods out of a protected shop are another matter.
function fenceWeek(w: World, op: Op, owner: Character, doer: Character, mult: number): { take: number; cause: string } {
  const buyers = linksOf(op, 'buyer').map((l) => w.chars[l.id]).filter((c): c is Character => ok(w, c));
  let bought = 0, paid = 0, n = 0;
  for (const l of linksOf(op, 'thief')) {
    const t = w.chars[l.id];
    if (!ok(w, t)) continue;
    let value = 0;
    if (t.goods > 0) { value = t.goods; t.goods = 0; }
    else if (w.rng.chance(0.6 + aptitude(t, 'burgle') * 0.3)) value = Math.round(w.rng.int(400, 1300) / 50) * 50;
    if (!value) continue;
    // (what he brings from a job the world knows of: a burglary of his, lately)
    const job = Object.values(w.facts).filter((f) => f.kind === 'burglary' && f.actor === t.id && w.now - f.t < 14 * DAY && !(op.cool?.['lot:' + f.id])).sort((a, b) => b.t - a.t)[0];
    const pay = Math.round(value * 0.3);
    earn(t, pay, 'burgle'); paid += pay; bought += value; n++; l.n = (l.n ?? 0) + value;
    if (job) {
      (op.cool ??= {})['lot:' + job.id] = w.now;
      const shop = job.business ? w.biz[job.business] : undefined;
      if (shop?.protection && shop.protection.familyId !== owner.familyId) hotGoods(w, op, owner, t, shop, value, job.id);
    }
  }
  // (what the owner and his own men brought in themselves: no thief's third to pay on it)
  if (op.held) { bought += op.held; n++; op.held = 0; }
  if (!bought) return { take: 0, cause: 'nothing came in this week' };
  // (buyers of its own pay a little over half; without them, the pawnbrokers who ask no questions pay what they like)
  const sold = Math.round(bought * (buyers.length ? 0.5 + aptitude(doer, 'scam') * 0.15 : 0.38) * (0.7 + 0.3 * mult));
  for (const [i, b] of buyers.entries()) { const bl = (op.links ?? []).find((l) => l.id === b.id && l.role === 'buyer'); if (bl) bl.n = (bl.n ?? 0) + Math.round(sold / buyers.length); if (i === 0) feel(w, b, owner.id, 'trust', 0.005); }
  return { take: sold - paid, cause: `${n} ${n === 1 ? 'load' : 'loads'} in and moved on` };
}

// The book, by its regulars: each bets what he can afford and his habit makes him bet; most weeks the book is ahead; a man who loses
// more than he has signs a marker; a man on a winning run comes in bigger (book.ts: the big bet, from the man himself).
function bookWeekPeople(w: World, op: Op, owner: Character, mult: number): { take: number; cause: string } {
  const lvl = op.level ?? 1;
  let net = 0, bets = 0, markers = 0;
  for (const l of linksOf(op, 'regular')) {
    const g = w.chars[l.id];
    if (!ok(w, g)) continue;
    const stake = Math.round(Math.min(Math.max(30, g.cash * 0.25 * g.traits.vice), 300 * lvl) / 10) * 10;
    if (stake < 20) continue;
    bets++;
    if (w.rng.chance(0.56)) {
      // he loses: cash if he has it, a marker if he hasn't
      const got = Math.min(stake, Math.max(0, Math.floor(g.cash)));
      g.cash -= got; net += got; l.bal = (l.bal ?? 0) - stake;
      if (got < stake) {
        markers++;
        const f = addFact(w, { kind: 'loan', actor: owner.id, victim: g.id, amount: stake - got, minor: true, text: `${g.name} ran up a ${money(stake - got)} marker on ${owner.name}’s book.`, district: op.district }, { witnesses: [owner.id, g.id] });
        createDebt(w, owner.id, g.id, stake - got, 0.1, 'a marker on the book', f.id);
      }
    } else { const win = Math.round(stake * 0.9); g.cash += win; net -= win; l.bal = (l.bal ?? 0) + win; }
  }
  // (the regulars are the men worth knowing; the counter takes everybody else's action too, and the book's edge on it is a few points a
  // week, some weeks the other way)
  const handle = Math.round(2400 * (0.6 + aptitude(w.chars[op.runner ?? ''] ?? owner, 'numbers') * 0.8) * (1 + (lvl - 1) * 0.5));
  net += Math.round(handle * w.rng.range(-0.15, 0.4));
  const take = Math.round(net * (net > 0 ? mult : 1));
  const cause = !bets ? 'the counter action, and no regulars to speak of' : take < 0 ? 'the regulars had a good week' : markers ? `${markers} ${markers === 1 ? 'regular' : 'regulars'} into the book for more than they had` : 'the regulars lost about what they usually lose';
  return { take, cause };
}

// ------------------------------------------------------------------------------------------------ what arises
// Each of these is a circumstance that has actually come about; the player's enterprises bring it to him through the man concerned
// (an encounter, with options that do things in the world); an NPC owner meets the same thing and answers it himself.
const coolOk = (w: World, op: Op, k: string) => (op.cool?.[k] ?? 0) <= w.now;
const cool = (w: World, op: Op, k: string, days: number) => { (op.cool ??= {})[k] = w.now + days * DAY; };
const mine = (w: World, op: Op) => !!w.chars[op.owner]?.isPlayer;
const hasOpen = (w: World, op: Op, k: string) => w.enc.some((e) => e.status === 'open' && e.kind === 'ent' && e.data?.k === k && e.data?.op === op.id);

// A car that belonged to the wrong man (another family's, one of our own, or the police department's).
function hotCar(w: World, op: Op, owner: Character, car: Car, thief: Character) {
  opNote(w, op, `${thief.name} brought in a ${carName(car)}${car.owner ? ` that belongs to ${w.chars[car.owner].name}` : car.hot === 'police' ? ' with a police radio under the dash' : ''}.`, thief.id);
  if (!mine(w, op)) {
    // an NPC owner: a careful man sends it back or dumps it; a reckless one strips it and hopes
    if (temper(owner).caution > 0.5 || car.hot === 'family') { car.status = car.owner ? 'returned' : 'dumped'; car.out = w.now; return; }
    if (car.owner && w.rng.chance(0.35)) carFound(w, op, owner, car, thief);
    car.hot = undefined;
    return;
  }
  const o = car.owner ? w.chars[car.owner] : undefined;
  const lines = car.hot === 'police'
    ? [`${first(thief)} is pale. The ${carName(car)} he brought in last night has a police radio under the dash and a nightstick on the back seat.`, `It’s an unmarked car out of the precinct. Somebody there is going to want it back very badly.`]
    : [`${first(thief)} comes to see you. The ${carName(car)} in the bay belongs to ${o!.name}${car.hot === 'made' ? `, of the ${famName(w, o!)} family` : ', one of our own'}.`, `He didn’t know whose it was when he took it. He knows now, and so may ${first(o!)}, soon.`];
  addEnc(w, {
    kind: 'ent', from: thief.id, title: car.hot === 'police' ? `A police car in the bay` : `${first(o!)}’s ${car.make}`, days: 3, data: { k: 'hotcar', op: op.id, car: car.id },
    lines,
    opts: car.hot === 'police' ? [
      { code: 'dump', label: 'Have it driven into the river tonight', hint: 'It costs you the car. Nobody can tie it to the shop.' },
      { code: 'strip', label: 'Strip it, fast', hint: 'A police car is worth a lot in parts. If they trace it, they come for the shop.' },
    ] : [
      { code: 'return', label: `Have it left outside ${first(o!)}’s place, washed`, hint: `You lose the car. ${first(o!)} may take it as respect.` },
      { code: 'strip', label: 'Strip it like any other', hint: `Its parts are worth ${money(Math.round(car.value * 0.5))}. If ${first(o!)} learns where it went, it becomes a matter between you.` },
      { code: 'give', label: `Tell ${first(o!)} who took it`, hint: `${first(thief)} answers for it himself. He will know you gave him up.` },
    ],
  });
}
// The man whose car it was learns where it went (the thief's name, the shop's).
export function carFound(w: World, op: Op, owner: Character, car: Car, thief: Character) {
  const o = car.owner ? w.chars[car.owner] : undefined;
  if (!o?.alive) return;
  bear(w, o, owner.id, 0.25, `his ${car.make} went through ${owner.name}’s chop shop`);
  bear(w, o, thief.id, 0.2, `${thief.name} took his ${car.make}`);
  if (o.familyId && owner.familyId && o.familyId !== owner.familyId) {
    const A = w.fam[owner.familyId], B = w.fam[o.familyId];
    A.tension[o.familyId] = (A.tension[o.familyId] ?? 0) + 0.4; B.tension[owner.familyId] = (B.tension[owner.familyId] ?? 0) + 0.4;
  }
  addFact(w, { kind: 'theft', actor: owner.id, victim: o.id, text: `${o.name}’s ${carName(car)} went through ${owner.name}’s chop shop. ${o.name} knows it.`, district: op.district }, { witnesses: [o.id, owner.id, thief.id, ...(o.bossId ? [o.bossId] : [])] });
}

// The number everybody played came in, and the bank hasn't got it.
export function bigHit(w: World, op: Op, owner: Character, loss: number) {
  opNote(w, op, `The number everybody played came in. The bank is ${money(loss)} short of the hits.`);
  if (!mine(w, op)) {
    // an NPC banker covers what he can and owes the rest to his own superior, or welshes
    const boss = owner.bossId ? w.chars[owner.bossId] : undefined;
    if (boss?.alive && boss.isPlayer) { coverAsk(w, op, owner, loss, boss); return; }
    if (boss?.alive && !boss.isPlayer && boss.cash > loss) { transfer(w, boss, owner, loss, 'loan', 'covering the bank'); createDebt(w, boss.id, owner.id, loss, 0, 'covering the numbers bank'); }
    else { op.bad = (op.bad ?? 0) + 2; addFact(w, { kind: 'report', actor: owner.id, minor: true, text: `${owner.name}’s numbers bank couldn’t pay its hits in full.`, district: op.district }, { witnesses: [owner.id] }); }
    return;
  }
  const boss = owner.bossId ? w.chars[owner.bossId] : undefined;
  addEnc(w, {
    kind: 'ent', from: op.runner ?? null, title: `The number came in, and the bank is ${money(loss)} short`, days: 3, data: { k: 'bighit', op: op.id, amt: loss },
    lines: [`${op.runner && w.chars[op.runner] ? first(w.chars[op.runner]) : 'Your man'} has the slips spread on the table. Half the neighbourhood played the same three numbers, and they came in.`, `The hits come to ${money(loss)} more than the bank has. The spots have people at the counter waiting to be paid.`],
    opts: [
      { code: 'pay', label: `Pay every hit, out of your own pocket`, hint: 'It hurts. Your bank’s name is worth more than this week.' },
      ...(boss?.alive && boss.cash >= loss ? [{ code: 'cap', label: `Go to ${first(boss)} for it`, hint: 'He’ll cover it. He’ll own a piece of you for a while.' }] : []),
      { code: 'part', label: 'Pay half now, the rest over the month', hint: 'The spots will grumble. Some players will take their slips elsewhere.' },
    ],
  });
}

// Goods out of a shop another family protects.
function hotGoods(w: World, op: Op, owner: Character, thief: Character, shop: Business, value: number, fact: Id) {
  const prot = shop.protection ? w.chars[shop.protection.collectorId] : undefined;
  opNote(w, op, `${thief.name} brought in ${money(value)} of goods out of ${shop.name}${prot ? `, which pays ${prot.name}` : ''}.`, thief.id);
  if (!prot?.alive) return;
  if (!mine(w, op)) {
    if (w.rng.chance(0.3)) { bear(w, prot, owner.id, 0.15, `${owner.name}’s fence moved what came out of ${shop.name}`); }
    return;
  }
  addEnc(w, {
    kind: 'ent', from: thief.id, title: `Goods out of ${shop.name}`, days: 4, data: { k: 'hotgoods', op: op.id, prot: prot.id, shop: shop.id, value, fact },
    lines: [`${first(thief)}’s load this week came out of ${shop.name}, in ${shop.district}.`, `${shop.name} pays ${prot.name}${prot.familyId ? ` of the ${famName(w, prot)} family` : ''}. ${first(prot)} will be asking around for what was taken.`],
    opts: [
      { code: 'move', label: 'Move it on like anything else', hint: 'It sells. If it turns up and is traced to you, it’s between you and him.' },
      { code: 'return', label: `Send it back to ${first(prot)}, with your compliments`, hint: `You lose the load. ${first(prot)} owes you for it.` },
      { code: 'give', label: `Give ${first(prot)} the name of the man who took it`, hint: `${first(thief)} answers for it. He’ll know who gave him up.` },
    ],
  });
}

// One of its buyers has been arrested: he knows where the cars (or the goods) come from.
function buyerTaken(w: World, op: Op, owner: Character, b: Character, l: OpLink) {
  l.off = w.now;
  opNote(w, op, `${b.name} was picked up by the police. He knows where his ${op.kind === 'chop' ? 'parts' : 'stock'} came from.`, b.id);
  const talks = () => temper(b).caution * 0.4 + (1 - rel(b, owner.id).trust) * 0.4 + (b.familyId ? -0.2 : 0.1);
  if (!mine(w, op)) { if (w.rng.chance(clamp(talks() * 0.5, 0.05, 0.6))) owner.heat = clamp(owner.heat + 0.35, 0, 1.5); return; }
  addEnc(w, {
    kind: 'ent', from: null, about: b.id, title: `${first(b)} is in a cell`, days: 4, data: { k: 'buyer', op: op.id, who: b.id },
    lines: [`${b.name}, who takes ${op.kind === 'chop' ? 'your parts' : 'your goods'}, was picked up yesterday. He’s being held at the precinct.`, `He knows the ${op.kind === 'chop' ? 'shop' : 'back room'}, and he knows ${op.runner && w.chars[op.runner] ? first(w.chars[op.runner]) : 'you'}.`],
    opts: [
      { code: 'lawyer', label: 'Send him a lawyer, and pay for it ($300)', hint: 'He knows you looked after him. A man looked after is a man who keeps quiet.' },
      { code: 'quiet', label: 'Shut it down for a few weeks', hint: 'Nothing to find if they come looking. No money while it’s shut.' },
      { code: 'nothing', label: 'Do nothing', hint: 'He may keep his mouth shut. He may not.' },
    ],
  });
  void talks;
}

// The man who runs it wants more of what he makes for you.
function wantsMore(w: World, op: Op, owner: Character) {
  const r = op.runner ? w.chars[op.runner] : undefined;
  if (!ok(w, r) || r!.isPlayer || !coolOk(w, op, 'more') || hasOpen(w, op, 'more')) return;
  const cut = op.cut ?? 0, earned = (op.hist ?? []).length >= 0 ? op.total : 0;
  if (op.weeks < 8 || earned < 2500 || cut >= 0.25 || op.last <= 0) return;
  // (he asks because something presses on him: a debt, a want of his own, a grudge, or a nature that always wants more; a contented
  // man paid fairly doesn't, however well the racket does)
  const ms = motives(w, r!, owner);
  if (pressed(ms) + cut * -2 < 0.55) return;
  cool(w, op, 'more', 60);
  const why = owner.isPlayer ? toldOf(motives(w, r!, owner, owner)) : undefined;
  const ask = Math.round((cut + 0.05) * 100);
  if (!mine(w, op)) {
    if (w.rng.chance(0.5 + rel(owner, r!.id).trust * 0.3)) op.cut = ask / 100; else bear(w, r!, owner.id, 0.1, `${owner.name} wouldn’t give him a bigger cut`);
    return;
  }
  addEnc(w, {
    kind: 'ent', from: r!.id, title: `${first(r!)} wants a bigger cut`, days: 5, data: { k: 'more', op: op.id, to: ask },
    lines: [`${first(r!)} catches you alone. “I’ve run it ${op.weeks} weeks. It’s made you ${money(op.total)}. I’m the one out on the street with it.”`, `“${ask}%. That’s all I’m asking. ${cut ? `${Math.round(cut * 100)} isn’t enough for what I do.` : 'Right now I get nothing but my envelope.'}”`, ...(why ? [why] : [])],
    opts: [
      { code: 'yes', label: `Give him ${ask}%`, hint: 'Less for you every week. A man who feels paid fairly stays honest longer.' },
      { code: 'half', label: `Meet him halfway: ${Math.round((cut + 0.025) * 100)}%`, hint: 'He may take it. He may think you’re cheap.' },
      { code: 'no', label: 'Tell him he’s paid enough', hint: 'It costs you nothing today. He’ll remember it.' },
    ],
  });
}

// His captain has noticed how well it is doing, and wants a piece of it on top of the envelope.
function captainWants(w: World, op: Op, owner: Character) {
  const cap = owner.bossId ? w.chars[owner.bossId] : undefined;
  if (!ok(w, cap) || cap!.isPlayer || !coolOk(w, op, 'tribute') || hasOpen(w, op, 'tribute') || (owner.cooldown['tribute:' + cap!.id] ?? 0) > w.now) return;
  if ((op.stakes ?? []).some((s) => s.holder === cap!.id)) return;
  const recent = op.last;
  // (he hears what it makes from what he can see of it, and he wants more when he is greedy or short)
  if (op.weeks < 10 || recent < 350 || (op.level ?? 1) < 2 && op.total < 5000) return;
  if (cap!.traits.greed + (cap!.cash < 1500 ? 0.3 : 0) + w.rng.next() * 0.3 < 0.85) { cool(w, op, 'tribute', 30); return; }
  cool(w, op, 'tribute', 120); owner.cooldown['tribute:' + cap!.id] = w.now + 45 * DAY;
  const share = cap!.traits.greed > 0.75 ? 0.15 : 0.1;
  const capWhy = cap!.cash < 1500 ? 'Word is he’s short himself this season.' : cap!.traits.greed > 0.75 ? 'He has always liked a piece of what men under him build.' : (cap!.bossId && w.chars[cap!.bossId]?.alive ? `${first(w.chars[cap!.bossId])} has been leaning on him for more.` : '');
  if (!mine(w, op)) {
    if (temper(owner).caution > 0.4 || rel(owner, cap!.id).trust > 0.5) (op.stakes ??= []).push({ holder: cap!.id, share, since: w.now, how: 'his captain asked for it' });
    else bear(w, cap!, owner.id, 0.15, `${owner.name} wouldn’t give him a piece of his ${op.kind}`);
    return;
  }
  addEnc(w, {
    kind: 'ent', from: cap!.id, title: `${first(cap!)} wants a piece of it`, days: 6, data: { k: 'tribute', op: op.id, share },
    lines: [`${first(cap!)} has heard how well your ${labelOf(op)} is doing. He says so, and lets it sit.`, `“${Math.round(share * 100)}%. Off the top, every week, on top of your envelope. It’s my ground it runs on.”`, ...(capWhy ? [capWhy] : [])],
    opts: [
      { code: 'yes', label: `Give him ${Math.round(share * 100)}%`, hint: 'It costs you every week. A captain who eats from your plate looks after the plate.' },
      { code: 'less', label: `Offer him ${Math.round(share * 50)}%`, hint: 'He may take it. He may take it as an insult.' },
      { code: 'no', label: 'Tell him the envelope is what he gets', hint: 'He won’t forget it. Captains have ways of moving rackets to men who say yes.' },
    ],
  });
}

// A rival of the same trade on the same ground takes one of its people.
function poach(w: World, op: Op, owner: Character) {
  if (!coolOk(w, op, 'poach') || hasOpen(w, op, 'poach')) return;
  const rivals = w.ops.filter((o) => o !== op && o.kind === op.kind && o.district === op.district && o.state === 'running' && o.owner !== op.owner && w.chars[o.owner]?.alive).sort(byId);
  if (!rivals.length) return;
  const ro = rivals[w.rng.int(0, rivals.length - 1)], rival = w.chars[ro.owner];
  if (pressed(motives(w, rival, owner)) < 0.35) return;
  const role: OpRole = op.kind === 'numbers' ? 'spot' : op.kind === 'bookie' ? 'regular' : 'buyer';
  const ls = linksOf(op, role);
  if (ls.length < 2 || !w.rng.chance(0.06 + (ro.level ?? 1) * 0.03)) return;
  cool(w, op, 'poach', 45);
  const l = ls[w.rng.int(0, ls.length - 1)];
  const who = role === 'spot' ? w.biz[l.id]?.name : w.chars[l.id]?.name;
  if (!who) return;
  op.links = (op.links ?? []).filter((x) => x !== l);
  (ro.links ??= []).push({ id: l.id, role, since: w.now });
  opNote(w, op, `${who} has gone over to ${rival.name}.`, l.id);
  { const cap = owner.bossId ? w.chars[owner.bossId] : undefined; if (cap?.isPlayer && rival.bossId === cap.id && !owner.isPlayer) { quarrelAsk(w, op, ro, owner, rival, l.id, role); return; } }
  if (!mine(w, op)) { if (temper(owner).volatility > 0.6) bear(w, owner, rival.id, 0.15, `${rival.name} took one of his ${role === 'spot' ? 'spots' : 'people'}`); return; }
  const theirs = rival.familyId && rival.familyId !== owner.familyId;
  addEnc(w, {
    kind: 'ent', from: rival.id, title: `${who} has gone over to ${first(rival)}`, days: 6, data: { k: 'poach', op: op.id, rop: ro.id, link: l.id, role },
    lines: [`${role === 'spot' ? `${who} is taking slips for ${rival.name}’s bank now, not yours.` : role === 'regular' ? `${who} has been betting with ${rival.name}’s book.` : `${who} is buying from ${rival.name} now.`}`, `${rival.name}${theirs ? `, a ${famName(w, rival)} man,` : ''} works the same trade in ${op.district}.`],
    opts: [
      { code: 'win', label: `Win ${role === 'spot' ? 'the spot' : 'him'} back ($200)`, hint: 'Money in a hand, and a word. It may hold.' },
      { code: 'lean', label: `Lean on ${first(rival)}`, hint: theirs ? 'Your ground. His family may see it differently.' : 'He’s one of ours: his captain will hear.' },
      { code: 'let', label: 'Let it go', hint: 'There’s enough for two. A little less for you.' },
    ],
  });
}
const labelOf = (op: Op) => ({ chop: 'chop shop', numbers: 'numbers bank', fencing: 'fencing', bookie: 'book' } as Record<string, string>)[op.kind] ?? 'operation';

// Each week, after the take: what has come about.
export function developments(w: World, op: Op) {
  if (!PILOT.has(op.kind) || op.state !== 'running') return;
  const owner = w.chars[op.owner];
  if (!owner?.alive) return;
  for (const l of linksOf(op, 'buyer')) { const b = w.chars[l.id]; if (b?.alive && b.jailedUntil > w.now && (l.off ?? 0) < b.jailedUntil - 60 * DAY && (l.off ?? -1) < w.now - 30 * DAY) buyerTaken(w, op, owner, b, l); }
  buyerWants(w, op, owner);
  goesOwnWay(w, op, owner);
  wantsMore(w, op, owner);
  captainWants(w, op, owner);
  poach(w, op, owner);
}

// ------------------------------------------------------------------------------------------------ hands
// Who an enterprise belongs to changes for reasons the world understands: the owner dies (his runner takes it on, or his captain gives
// it to somebody), goes inside for a long stretch (his captain gives it to the man running it, or keeps it himself), or sells it.
export function transferOp(w: World, op: Op, to: Id, how: string) {
  const was = w.chars[op.owner], now = w.chars[to];
  if (!now || to === op.owner) return;
  (op.owners ??= []).push({ id: op.owner, from: op.since, to: w.now, how });
  op.owner = to;
  if (op.runner === to) op.runner = null;
  op.cut = op.runner ? op.cut : undefined;
  op.stakes = (op.stakes ?? []).filter((s) => s.holder !== to);
  opNote(w, op, `${now.name} has it now${was ? `, after ${was.name}` : ''}: ${how}.`, to);
  addFact(w, { kind: 'report', actor: to, victim: was?.id, minor: !now.isPlayer && !was?.isPlayer, text: `${now.name} took over ${was ? `${was.name}’s` : 'a'} ${labelOf(op)} in ${op.district}: ${how}.`, district: op.district }, { witnesses: [to, ...(was ? [was.id] : []), ...(now.bossId ? [now.bossId] : [])] });
}
// (whose it should be when the owner is gone: the man who has been running it, if his captain trusts him; otherwise the captain gives it
// to the man he favours: his own blood first, then the man under him he trusts most who has no line of his own)
export function heirOf(w: World, op: Op, gone: Character): Character | undefined {
  const r = op.runner ? w.chars[op.runner] : undefined, cap = gone.bossId ? w.chars[gone.bossId] : undefined;
  if (ok(w, r) && r!.familyId === gone.familyId && (!cap || rel(cap, r!.id).trust >= 0.3)) return r;
  if (!ok(w, cap)) return ok(w, r) ? r : undefined;
  const pool = Object.values(w.chars).filter((c) => ok(w, c) && c.bossId === cap!.id && c.id !== gone.id && (c.rank === 'soldier' || c.rank === 'associate')).sort(byId);
  const blood = (c: Character) => Number(c.name.split(' ').at(-1) === cap!.name.split(' ').at(-1));
  return pool.sort((a, b) => blood(b) - blood(a) || rel(cap!, b.id).trust - rel(cap!, a.id).trust || byId(a, b))[0] ?? cap;
}
export function opsChangeHands(w: World) {
  for (const op of w.ops) {
    if (!PILOT.has(op.kind) || (op.state !== 'running' && op.state !== 'raided')) continue;
    const o = w.chars[op.owner];
    if (!o) continue;
    // (one of the player's own men: the player, as his captain, says who has it now)
    const capP = o.bossId ? w.chars[o.bossId] : undefined;
    if (capP?.isPlayer && capP.alive && (!o.alive || o.jailedUntil > w.now + 45 * DAY) && (op.cool?.['assign'] ?? 0) < w.now) { (op.cool ??= {}).assign = w.now + 365 * DAY; assignAsk(w, op, o, capP); continue; }
    if (w.enc.some((e) => e.status === 'open' && e.kind === 'ent' && e.data?.k === 'assign' && e.data?.op === op.id)) continue;
    if (!o.alive) { const h = heirOf(w, op, o); if (h) transferOp(w, op, h.id, `${o.name} is dead, and ${h.rank === 'capo' ? 'his captain took it' : 'it went to the man who would keep it going'}`); else op.state = 'closed'; continue; }
    // a long stretch inside: his captain won't leave a racket without a man; the player's goes the same way, and he hears why
    if (o.jailedUntil > w.now + 45 * DAY && (op.cool?.['inside'] ?? 0) < o.jailedUntil) {
      (op.cool ??= {}).inside = o.jailedUntil;
      const cap = o.bossId ? w.chars[o.bossId] : undefined;
      if (ok(w, op.runner ? w.chars[op.runner] : undefined) && (!cap || rel(cap, op.runner!).trust >= 0.3)) { opNote(w, op, `${o.name} is inside. ${w.chars[op.runner!].name} keeps it going for him.`); continue; }
      const h = heirOf(w, op, o);
      if (h && h.id !== o.id) transferOp(w, op, h.id, `${o.name} went inside for a long stretch, and ${cap ? `${cap.name}` : 'the family'} gave it to ${h.isPlayer ? 'you' : h.name}`);
    }
  }
}

// ------------------------------------------------------------------------------------------------ the player answers
export function entChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  const op = w.ops.find((o) => o.id === e.data?.op);
  if (!op || op.state === 'closed') return { lines: ['It doesn’t matter now. That’s finished.'], minutes: 5 };
  const k = String(e.data?.k);
  if (k === 'hotcar') {
    const car = (w.cars ?? []).find((c) => c.id === e.data?.car), thief = e.from ? w.chars[e.from] : undefined;
    if (!car || car.status !== 'stock') return { lines: ['The car is already gone.'], minutes: 5 };
    const o = car.owner ? w.chars[car.owner] : undefined;
    if (code === 'dump') { car.status = 'dumped'; car.out = w.now; opNote(w, op, `The ${carName(car)} went into the river.`); return { lines: [`It goes off the end of a pier in Red Hook at three in the morning. The precinct will never know where it went.`], minutes: 30 }; }
    if (code === 'return' && o) {
      car.status = 'returned'; car.out = w.now; feel(w, o, p.id, 'respect', 0.05); addFavour(w, p.id, o.id, 1, `returning his ${car.make}`);
      opNote(w, op, `The ${carName(car)} went back to ${o.name}, washed.`);
      return { lines: [`The ${car.make} is outside ${first(o)}’s place in the morning, washed, with a full tank. Word gets to him who sent it back.`], minutes: 40 };
    }
    if (code === 'give' && o && thief) {
      car.status = 'returned'; car.out = w.now; feel(w, o, p.id, 'respect', 0.04); bear(w, o, thief.id, 0.3, `${thief.name} took his ${car.make}`);
      bear(w, thief, p.id, 0.35, `${p.name} gave him up to ${o.name}`);
      opNote(w, op, `${thief.name} was given up to ${o.name} over the ${car.make}.`, thief.id);
      return { lines: [`You send word to ${first(o)}: the car will come back, and the man who took it is ${thief.name}. ${first(thief)} hears about it before the day is out.`], minutes: 30 };
    }
    // strip it: the parts are sold with the rest; whether anyone learns is the world's
    car.hot = undefined; opNote(w, op, `The ${carName(car)} was stripped with the rest.`);
    if (car.status === 'stock' && o && w.rng.chance(0.4)) carFound(w, op, p, car, thief ?? p);
    if (!o) p.heat = clamp(p.heat + 0.25, 0, 1.5);
    return { lines: [o ? `By morning it’s fenders and a transmission in three different garages. Whether that’s the end of it depends on who talks.` : 'By morning there’s nothing left of it that a policeman would recognise. The precinct turns the district upside down looking.'], minutes: 30 };
  }
  if (k === 'bighit') {
    const amt = Number(e.data?.amt ?? 0), boss = p.bossId ? w.chars[p.bossId] : undefined;
    if (code === 'pay') { p.cash -= Math.min(amt, Math.max(0, p.cash)); feel(w, p, p.id, 'respect', 0); opNote(w, op, `Every hit was paid. ${money(amt)} out of pocket.`); return { lines: ['Every winner is paid at the counter by noon. It’s a bad week. It’s a good name.'], minutes: 60 }; }
    if (code === 'cap' && boss) { transfer(w, boss, p, amt, 'loan', 'covering the bank'); createDebt(w, boss.id, p.id, amt, 0, 'covering your numbers bank'); addFavour(w, boss.id, p.id, 1, 'covering your bank'); opNote(w, op, `${boss.name} covered the hits. You owe him.`); return { lines: [`${first(boss)} counts it out and says nothing about it, which says plenty.`], minutes: 40 }; }
    op.bad = (op.bad ?? 0) + 1;
    const spots = linksOf(op, 'spot'); if (spots.length > 1 && w.rng.chance(0.5)) { const lost = spots[spots.length - 1]; op.links = (op.links ?? []).filter((x) => x !== lost); opNote(w, op, `${w.biz[lost.id]?.name ?? 'A spot'} stopped taking slips for the bank after the hits came late.`); }
    p.cash -= Math.min(Math.round(amt / 2), Math.max(0, p.cash));
    return { lines: ['Half now, and the rest by the end of the month. The players grumble. Some of them take their slips across the street.'], minutes: 40 };
  }
  if (k === 'hotgoods') {
    const prot = w.chars[String(e.data?.prot ?? '')], thief = e.from ? w.chars[e.from] : undefined, value = Number(e.data?.value ?? 0);
    if (code === 'return' && prot?.alive) { p.cash -= Math.min(Math.round(value * 0.3), Math.max(0, p.cash)); feel(w, prot, p.id, 'respect', 0.05); addFavour(w, p.id, prot.id, 1, 'returning what was taken from his shop'); opNote(w, op, `The goods went back to ${prot.name}.`); return { lines: [`The goods go back to ${first(prot)} in the van they came in. He owes you for it, and he knows it.`], minutes: 40 }; }
    if (code === 'give' && prot?.alive && thief) { bear(w, prot, thief.id, 0.35, `${thief.name} robbed a shop that pays him`); bear(w, thief, p.id, 0.35, `${p.name} gave him up`); feel(w, prot, p.id, 'respect', 0.04); return { lines: [`You give ${first(prot)} the name. ${first(thief)} will have a visit, and will know where it came from.`], minutes: 20 }; }
    if (prot?.alive && w.rng.chance(0.35)) { bear(w, prot, p.id, 0.2, `${p.name}’s fence moved goods out of a shop he protects`); if (prot.familyId && p.familyId && prot.familyId !== p.familyId) { const A = w.fam[p.familyId], B = w.fam[prot.familyId]; A.tension[prot.familyId] = (A.tension[prot.familyId] ?? 0) + 0.3; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + 0.3; } }
    return { lines: ['It goes out with everything else. Whether it turns up somewhere it shouldn’t is out of your hands.'], minutes: 15 };
  }
  if (k === 'buyer') {
    const b = w.chars[String(e.data?.who ?? '')];
    if (code === 'lawyer' && b) { const paid = transfer(w, p, b, 300, 'gift', 'a lawyer'); if (paid) feel(w, b, p.id, 'trust', 0.15); return { lines: [`A lawyer is at the precinct by the afternoon, on your money. ${first(b)} knows who sent him.`], minutes: 30 }; }
    if (code === 'quiet') { op.lull = w.now + 3 * WEEK; opNote(w, op, 'Shut for three weeks while it blows over.'); return { lines: ['The doors are locked and the bay is swept. For three weeks there is nothing to find, and nothing coming in.'], minutes: 20 }; }
    if (b && w.rng.chance(clamp(temper(b).caution * 0.3 + (1 - rel(b, p.id).trust) * 0.4, 0.05, 0.6))) { p.heat = clamp(p.heat + 0.35, 0, 1.5); opNote(w, op, `${b.name} talked.`); }
    return { lines: ['You wait, and watch who comes down the street.'], minutes: 10 };
  }
  if (k === 'more') {
    const r = e.from ? w.chars[e.from] : undefined, to = Number(e.data?.to ?? 15) / 100;
    if (!r) return { lines: [], minutes: 5 };
    if (code === 'yes') { op.cut = to; feel(w, r, p.id, 'trust', 0.08); opNote(w, op, `${r.name}’s cut went to ${Math.round(to * 100)}%.`); return { lines: [`${first(r)} nods. “That’s fair.” He means it.`], minutes: 15 }; }
    if (code === 'half') { const half = Math.round(((op.cut ?? 0) + 0.025) * 1000) / 1000; if (r.traits.greed > 0.7 && w.rng.chance(0.5)) { bear(w, r, p.id, 0.1, `${p.name} met him halfway`); op.cut = half; return { lines: [`${first(r)} takes it, the way a man takes change he was owed.`], minutes: 15 }; } op.cut = half; feel(w, r, p.id, 'trust', 0.03); return { lines: [`${first(r)} thinks, and shakes on it.`], minutes: 15 }; }
    bear(w, r, p.id, 0.15, `${p.name} wouldn’t give him a bigger cut`);
    return { lines: [`${first(r)} doesn’t argue. He says “All right,” the way men say it when it isn’t.`], minutes: 10 };
  }
  if (k === 'tribute') {
    const cap = e.from ? w.chars[e.from] : undefined, share = Number(e.data?.share ?? 0.1);
    if (!cap) return { lines: [], minutes: 5 };
    if (code === 'yes') { (op.stakes ??= []).push({ holder: cap.id, share, since: w.now, how: 'his captain asked for it' }); feel(w, cap, p.id, 'trust', 0.06); opNote(w, op, `${cap.name} takes ${Math.round(share * 100)}% of it, every week.`); return { lines: [`${first(cap)} puts a hand on your shoulder. “You’re a good earner. I look after good earners.”`], minutes: 20 }; }
    if (code === 'less') {
      if (cap.traits.greed < 0.7 || w.rng.chance(0.4)) { (op.stakes ??= []).push({ holder: cap.id, share: share / 2, since: w.now, how: 'his captain asked for it' }); opNote(w, op, `${cap.name} takes ${Math.round(share * 50)}% of it, every week.`); return { lines: [`${first(cap)} looks at you a while, and takes it.`], minutes: 20 }; }
      bear(w, cap, p.id, 0.12, `${p.name} haggled with him over what he’s owed`);
      return { lines: [`“I didn’t come here to haggle.” ${first(cap)} leaves it there. You’ll hear more about it.`], minutes: 15 };
    }
    bear(w, cap, p.id, 0.2, `${p.name} wouldn’t give him a piece of his ${labelOf(op)}`); feel(w, cap, p.id, 'trust', -0.08);
    opNote(w, op, `You told ${cap.name} the envelope is what he gets.`);
    return { lines: [`${first(cap)} smiles with half his face. “The envelope. Sure.”`], minutes: 15 };
  }
  if (k === 'own') return ownWayChoose(w, p, op, e, code);
  if (k === 'cover' || k === 'quarrel') return captainChoose(w, p, op, e, code);
  if (k === 'assign') return assignChoose(w, p, op, code);
  if (k === 'poach') {
    const ro = w.ops.find((o) => o.id === e.data?.rop), rival = ro ? w.chars[ro.owner] : undefined, role = String(e.data?.role) as OpRole, id = String(e.data?.link);
    if (code === 'win') {
      const back = w.rng.chance(0.6);
      p.cash -= Math.min(200, Math.max(0, p.cash));
      if (back && ro) { ro.links = (ro.links ?? []).filter((x) => x.id !== id); (op.links ??= []).push({ id, role, since: w.now }); opNote(w, op, `${role === 'spot' ? w.biz[id]?.name : w.chars[id]?.name} came back.`); return { lines: ['A word and an envelope. They come back, for now.'], minutes: 30 }; }
      return { lines: ['They take the money and stay where they are. Some men can be bought twice.'], minutes: 30 };
    }
    if (code === 'lean' && rival?.alive && ro) {
      const theirs = rival.familyId && rival.familyId !== p.familyId;
      if (temper(rival).caution > 0.55) { ro.links = (ro.links ?? []).filter((x) => x.id !== id); (op.links ??= []).push({ id, role, since: w.now }); bear(w, rival, p.id, 0.12, `${p.name} leaned on him`); return { lines: [`${first(rival)} gives it up without a fight.`], minutes: 30 }; }
      bear(w, rival, p.id, 0.25, `${p.name} leaned on him`);
      if (theirs && p.familyId && rival.familyId) { const A = w.fam[p.familyId], B = w.fam[rival.familyId]; A.tension[rival.familyId] = (A.tension[rival.familyId] ?? 0) + 0.4; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + 0.4; }
      addFact(w, { kind: 'threat', actor: p.id, victim: rival.id, text: `${p.name} leaned on ${rival.name} over the ${labelOf(op)} trade in ${op.district}.`, district: op.district }, { witnesses: [p.id, rival.id, ...(rival.bossId ? [rival.bossId] : [])] });
      return { lines: [`${first(rival)} hears you out and keeps what he took.${theirs ? ' His family hears you leaned on him.' : ''}`], minutes: 30 };
    }
    return { lines: ['You let it go.'], minutes: 5 };
  }
  return { lines: [], minutes: 5 };
}

// ------------------------------------------------------------------------------------------------ the chop shop that was a venture
// Before October 2026 a chop shop in a garage was a separate record (w.ventures). An open one becomes the chop shop it always was: an
// op housed in that garage, the host's share his stake, its cars still in the bay. The venture record stays, closed, for older code.
export function foldVentures(w: World) {
  for (const v of w.ventures ?? []) {
    if (!v.open) continue;
    v.open = false;
    const owner = w.chars[v.ownerId], b = w.biz[v.bizId];
    if (!owner?.alive || !b) continue;
    const op: Op = { id: 'op' + w.nextId++, kind: 'chop', owner: owner.id, runner: null, district: b.district, since: v.since, state: 'running', last: 0, total: v.takings, skimmed: 0, weeks: v.weeks, base: b.id, stakes: v.hostId && w.chars[v.hostId] ? [{ holder: v.hostId, share: v.hostShare, since: v.since, how: 'his garage houses it' }] : undefined };
    w.ops.push(op);
    for (let i = 0; i < v.stock; i++) stealCar(w, op, undefined);
  }
}
// What a man's stake in an enterprise pays him this week (the captain's piece, the garage owner's share): out of the owner's take.
export function payOpStakes(w: World, op: Op, net: number) {
  if (net <= 0 || !op.stakes?.length) return 0;
  const owner = w.chars[op.owner];
  let out = 0;
  for (const s of op.stakes) {
    const h = w.chars[s.holder];
    if (!h?.alive) continue;
    out += transfer(w, owner, h, Math.round(net * s.share), 'stake', `a share of ${labelOf(op)}`);
  }
  return out;
}
export const enterpriseLabel = labelOf;
// A chop shop opened in a man's garage: an op housed there, his share a stake (the old venture, the same shop).
export function openChopShop(w: World, p: Character, host: Character, b: Business, share: number, how: string): Op {
  const op: Op = { id: 'op' + w.nextId++, kind: 'chop', owner: p.id, runner: null, district: b.district, since: w.now, state: 'running', last: 0, total: 0, skimmed: 0, weeks: 0, base: b.id, stakes: [{ holder: host.id, share, since: w.now, how }] };
  w.ops.push(op);
  opNote(w, op, `${host.name} gave you the back bay at ${b.name}: ${how}.`, host.id);
  return op;
}
export const chopOf = (w: World, c: Character) => w.ops.find((o) => o.kind === 'chop' && o.owner === c.id && (o.state === 'running' || o.state === 'raided'));
// Stolen cars brought to a chop shop by a man who took them (the player, or one of his crew back from a job).
export function deliverCars(w: World, op: Op, n: number, by: Character): Car[] {
  const out: Car[] = [];
  for (let i = 0; i < n; i++) { const car = stealCar(w, op, by); out.push(car); if (car.hot && !by.isPlayer) hotCar(w, op, w.chars[op.owner], car, by); }
  if (n) opNote(w, op, `${by.isPlayer ? 'You' : by.name} brought in ${n === 1 ? 'a car' : `${n} cars`}: ${out.map(carShort).join(', ')}.`, by.id);
  return out;
}
// The owner puts one of his men in charge of it, for a cut of the take (or takes it back into his own hands).
export function setRunner(w: World, p: Character, op: Op, id: Id | null): string[] {
  const was = op.runner ? w.chars[op.runner] : undefined, c = id ? w.chars[id] : undefined;
  if (!c) {
    op.runner = null; op.cut = undefined;
    if (was?.alive) { bear(w, was, p.id, 0.08, `${p.name} took the ${labelOf(op)} back from him`); opNote(w, op, `You took it back from ${was.name}.`, was.id); }
    return [was ? `You tell ${first(was)} you’ll run it yourself from now on. He takes it the way men take that.` : 'You run it yourself.'];
  }
  op.runner = c.id; op.cut = 0.15;
  feel(w, c, p.id, 'trust', 0.06);
  if (was?.alive && was.id !== c.id) bear(w, was, p.id, 0.1, `${p.name} gave what he ran to ${c.name}`);
  opNote(w, op, `${c.name} runs it now, for 15% of the take.`, c.id);
  return [`${first(c)} runs it from today, for fifteen percent. ${was && was.id !== c.id ? `${first(was)} hears about it before you’ve told him.` : 'He shakes your hand on it.'}`];
}
export const fenceOf = (w: World, c: Character) => w.ops.find((o) => o.kind === 'fencing' && o.owner === c.id && (o.state === 'running' || o.state === 'raided'));
// Goods brought to a man's own fence, by him or one of his crew: moved on with the week's loads, with no thief to pay.
export function deliverGoods(w: World, op: Op, value: number, by: Character) {
  op.held = (op.held ?? 0) + value;
  opNote(w, op, `${by.isPlayer ? 'You' : by.name} brought in ${money(value)} in goods.`, by.id);
}

// ------------------------------------------------------------------------------------------------ money on paper, and money that isn't
// What a man can show for himself (his businesses' takings, his wages, a front's books) against what he can't (everything else). Kick-ups
// from below are racket money too. A man living on the second and showing only the first is noticed, slowly.
const CLEAN = new Set(['business', 'odd', 'front']);
export function onPaper(w: World, p: Character): { clean: number; dirty: number; weeks: number } {
  const hs = p.books.history.slice(-8);
  let clean = 0, dirty = 0;
  for (const x of hs) for (const [k, v] of Object.entries(x.sources ?? {})) { if (CLEAN.has(k)) clean += v; else dirty += v; }
  const since = w.now - Math.max(1, hs.length) * WEEK;
  void since;
  for (const b of Object.values(w.biz)) if (b.ownerId === p.id) clean += (b.acct ?? []).slice(-hs.length).reduce((a, x) => a + Math.abs(x.drawn ?? 0), 0);
  const n = Math.max(1, hs.length);
  return { clean: Math.round(clean / n), dirty: Math.round(dirty / n), weeks: hs.length };
}
export const onPaperWord = (x: { clean: number; dirty: number }) => x.dirty <= x.clean ? 'what you show covers what you spend' : x.dirty <= x.clean * 3 + 200 ? 'more comes in than you could explain, but not so much a man would ask' : 'most of what you live on has no paper behind it';

// The place his crew meets: men talk where they drink, so what the regulars and his own men know reaches him; his men like having a
// place; and when the police are interested in him, they are interested in it.
const MEET_KINDS = new Set(['bar', 'restaurant', 'cafe', 'diner', 'billiards', 'club']);
export const canMeetAt = (w: World, p: Character, b: Business) => b.open && MEET_KINDS.has(b.kind) && (b.ownerId === p.id || (b.stakes ?? []).some((s) => s.holder === p.id));
export function meetWeek(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined, id = w.path?.meet;
  if (!p?.alive || !id) return;
  const b = w.biz[id];
  if (!b || !canMeetAt(w, p, b)) { delete w.path!.meet; return; }
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).sort(byId);
  const there = [...crew, ...(b.managerId && w.chars[b.managerId]?.alive ? [w.chars[b.managerId]] : []), ...Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.district === b.district && c.traits.sociability > 0.6 && c.familyId === p.familyId).sort(byId).slice(0, 4)];
  for (const c of crew) feel(w, c, p.id, 'affection', 0.004);
  // one thing worth knowing, from someone who drinks there
  for (const c of there) {
    const f = Object.entries(c.known).map(([fid, k]) => ({ f: w.facts[fid], k })).filter(({ f, k }) => f && !f.minor && !p.known[f.id] && w.now - f.t < 14 * DAY && f.actor !== p.id && k.from !== 'self').sort((a, b) => b.f.t - a.f.t)[0];
    if (f) { learn(w, p.id, f.f, c.id, f.k.knowsActor); break; }
  }
  if (p.heat > 0.7 && w.rng.chance(0.1)) {
    b.damaged = Math.max(b.damaged, 1);
    addFact(w, { kind: 'raid', actor: p.id, business: b.id, text: `Police came through ${b.name} on a Friday night, asking after ${p.name}’s people. Business was bad for a week.`, district: b.district }, { witnesses: [p.id, b.ownerId, ...crew.map((c) => c.id)] });
  }
}
export function paperWeek(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (!p?.alive) return;
  const x = onPaper(w, p);
  if (x.weeks >= 4 && p.cash > 5000 && x.dirty > x.clean * 3 + 300) p.heat = clamp(p.heat + 0.01, 0, 1.5);
}

// ------------------------------------------------------------------------------------------------ a car to order
// A buyer the shop has dealt with long enough, who trusts it, wants one car in particular: that is work, offered to the man whose shop
// it is (he can take it himself or send one of his men), and it pays better than a car off the street.
const LIKED = ['Cadillac|Coupe de Ville', 'Lincoln|Continental', 'Buick|Electra 225', 'Pontiac|GTO', 'Dodge|Charger', 'Oldsmobile|Toronado', 'Chevrolet|Chevelle SS', 'Ford|Mustang'];
function buyerWants(w: World, op: Op, owner: Character) {
  if (op.kind !== 'chop' || !owner.isPlayer || !coolOk(w, op, 'order')) return;
  const bl = linksOf(op, 'buyer').filter((l) => (l.n ?? 0) >= 4 && ok(w, w.chars[l.id]) && rel(w.chars[l.id], owner.id).trust >= 0.02).sort((a, b) => (b.n ?? 0) - (a.n ?? 0))[0];
  if (!bl || w.jobs.some((j) => j.status !== 'done' && j.status !== 'failed' && j.extra?.op === op.id && j.extra?.want)) return;
  if (!w.rng.chance(0.25)) { cool(w, op, 'order', 10); return; }
  cool(w, op, 'order', 40);
  const b = w.chars[bl.id], want = bl.want ?? LIKED[w.rng.int(0, LIKED.length - 1)];
  bl.want = want;
  const m = MODELS.find((x) => `${x.make}|${x.model}` === want)!, yr = gameYear(w.now);
  const pay = Math.round(m.value * 0.75 / 50) * 50;
  const why = ownerBiz(w, b.id) ? `a customer of his wants one, no paperwork` : 'he has a man in Jersey asking';
  mkJob(w, { kind: 'boost', title: `${first(b)} wants ${/^[AEIOU]/.test(m.make) ? 'an' : 'a'} ${m.make}`, brief: `${b.name} wants ${/^[AEIOU]/.test(m.make) ? 'an' : 'a'} ${m.make} ${m.model}, ${yr - 2} or newer, by the end of the week: ${why}. ${money(pay)} for the right car, through your shop. Take it yourself or send one of your men.`, giver: b.id, via: 'opportunity', assignee: owner.id, pay, days: 6, extra: { want, op: op.id } });
  opNote(w, op, `${b.name} asked for ${/^[AEIOU]/.test(m.make) ? 'an' : 'a'} ${m.make} ${m.model}.`, b.id);
}
// The car he asked for, taken: it goes through the shop to him, and the shop keeps the record of it.
export function carToOrder(w: World, opId: string | number | undefined, want: string, thief: Character, buyer: Character, price: number): Car | undefined {
  const op = w.ops.find((o) => o.id === opId);
  if (!op) return undefined;
  const car = stealCar(w, op, thief, want);
  car.status = 'sold'; car.buyer = buyer.id; car.price = price; car.out = w.now;
  const bl = (op.links ?? []).find((l) => l.id === buyer.id && l.role === 'buyer'); if (bl) { bl.n = (bl.n ?? 0) + 1; bl.want = undefined; }
  feel(w, buyer, op.owner, 'trust', 0.04);
  opNote(w, op, `${thief.isPlayer ? 'You' : thief.name} took the ${carName(car)} ${buyer.name} asked for${car.whose ? `, from ${car.whose}` : car.owner ? `. It was ${w.chars[car.owner].name}’s` : ''}.`, thief.id);
  if (car.owner && car.hot) { const o = w.chars[car.owner]; const f = addFact(w, { kind: 'theft', actor: thief.id, victim: o.id, hiddenActor: true, text: `${thief.name} stole ${o.name}’s ${carName(car)}.`, textHidden: `${o.name}’s ${carName(car)} was stolen.`, district: op.district }, { witnesses: [thief.id] }); car.fact = f.id; if (w.rng.chance(0.35)) carFound(w, op, w.chars[op.owner], car, thief); }
  return car;
}

// ------------------------------------------------------------------------------------------------ the man who goes his own way
// The man running it has the people's trust and a reason to leave: he holds something against the owner (a cut refused, a public
// humiliation), he wants something of his own, and the owner isn't there to stop him (inside, laid up) or isn't a man he fears. He sets
// up the same trade on the same ground and takes with him whoever trusts him more than the owner.
function goesOwnWay(w: World, op: Op, owner: Character) {
  const r = op.runner ? w.chars[op.runner] : undefined;
  if (!ok(w, r) || r!.isPlayer || op.weeks < 12 || !coolOk(w, op, 'own') || hasOpen(w, op, 'own')) return;
  const ms = motives(w, r!, owner), grudge = ms.find((m) => m.kind === 'grudge')?.weight ?? 0;
  const away = owner.jailedUntil > w.now || owner.hurtUntil > w.now;
  const fear = (r!.rels[owner.id]?.fear ?? 0) + (RANK_I(owner) - RANK_I(r!)) * 0.1;
  const reason = grudge * 1.2 + (r!.want?.kind === 'independent' || r!.want?.kind === 'rich' ? 0.35 : 0) + r!.traits.ambition * 0.4 + (away ? 0.3 : 0) - fear - rel(r!, owner.id).trust * 0.6;
  if (reason < 0.75 || !w.rng.chance(0.25)) return;
  cool(w, op, 'own', 120);
  // whom he takes: the people who trust him more than the man whose racket it is
  const going = (op.links ?? []).filter((l) => l.role !== 'spot' && w.chars[l.id] && rel(w.chars[l.id], r!.id).trust > rel(w.chars[l.id], owner.id).trust + 0.05).concat((op.links ?? []).filter((l) => l.role === 'spot').slice(0, 1));
  const own: Op = { id: 'op' + w.nextId++, kind: op.kind, owner: r!.id, runner: null, district: op.district, since: w.now, state: 'running', last: 0, total: 0, skimmed: 0, weeks: 0, links: going.map((l) => ({ ...l, since: w.now })) };
  w.ops.push(own);
  op.links = (op.links ?? []).filter((l) => !going.includes(l));
  op.runner = null; op.cut = undefined;
  const why = ms.find((m) => m.kind === 'grudge') ? (r!.rels[owner.id]?.why?.text ?? 'what was between them') : r!.want?.kind === 'independent' ? 'he wanted something of his own' : 'he thought he could';
  opNote(w, op, `${r!.name} walked out and set up on his own${going.length ? `, and took ${going.length === 1 ? 'one of its people' : `${going.length} of its people`} with him` : ''}.`, r!.id);
  opNote(w, own, `${r!.name} set it up himself, out of ${owner.name}’s ${labelOf(op)}.`, r!.id);
  addFact(w, { kind: 'report', actor: r!.id, victim: owner.id, text: `${r!.name} walked out on ${owner.name}’s ${labelOf(op)} in ${op.district} and set up the same trade himself.`, district: op.district }, { witnesses: [r!.id, owner.id, ...(owner.bossId ? [owner.bossId] : []), ...going.map((l) => l.id).filter((id) => !!w.chars[id])] });
  bear(w, owner, r!.id, 0.3, `${r!.name} walked out on him and took his people`);
  if (!owner.isPlayer) return;
  const cap = owner.bossId ? w.chars[owner.bossId] : undefined;
  addEnc(w, {
    kind: 'ent', from: r!.id, title: `${first(r!)} has gone his own way`, days: 7, data: { k: 'own', op: op.id, rop: own.id },
    lines: [`${r!.name}, who ran your ${labelOf(op)}, has set up the same trade on the same streets${going.length ? `, and ${going.length === 1 ? 'one of your people has' : `${going.length} of your people have`} gone with him` : ''}.`, `${away ? 'He waited until you weren’t there to stop him. ' : ''}As far as anyone can tell, ${why.replace(/[.!?]?$/, '')}.`],
    opts: [
      ...(cap?.alive && !cap.isPlayer ? [{ code: 'cap', label: `Take it to ${first(cap)}`, hint: `Let your captain rule on it. He’ll weigh you against him.` }] : []),
      { code: 'lean', label: `Lean on ${first(r!)}`, hint: 'He may fold. He may not, and then it’s a matter between you.' },
      { code: 'let', label: 'Let him go', hint: 'There are other men. People will say you let one walk.' },
    ],
  });
}
const RANK_I = (c: Character) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.rank);
// the player's answer to a man who went his own way
export function ownWayChoose(w: World, p: Character, op: Op, e: Enc, code: string): { lines: string[]; minutes: number } {
  const ro = w.ops.find((o) => o.id === e.data?.rop), r = e.from ? w.chars[e.from] : undefined;
  if (!ro || !r?.alive || ro.state === 'closed') return { lines: ['It has settled itself.'], minutes: 5 };
  const back = () => { op.links = [...(op.links ?? []), ...(ro.links ?? []).map((l) => ({ ...l, since: w.now }))]; ro.state = 'closed'; };
  if (code === 'let') { feel(w, p, p.id, 'respect', 0); return { lines: [`You let him go. On the street they say ${first(r)} walked out on you and nothing happened.`], minutes: 5 }; }
  if (code === 'cap') {
    const cap = w.chars[p.bossId!];
    const forYou = rel(cap, p.id).trust + rel(cap, p.id).respect - rel(cap, r.id).trust - rel(cap, r.id).respect + (RANK_I(p) - RANK_I(r)) * 0.15;
    if (forYou > 0) { back(); bear(w, r, p.id, 0.2, `${p.name} took it to ${cap.name}`); feel(w, cap, p.id, 'respect', 0.02); opNote(w, op, `${cap.name} ruled for you: ${r.name} closed up.`, cap.id); return { lines: [`${first(cap)} hears you both out, and rules for you. ${first(r)} closes up and his people come back. He doesn’t look at you on the way out.`], minutes: 60 }; }
    bear(w, p, cap.id, 0.1, `${cap.name} let ${r.name} keep what he took`); opNote(w, op, `${cap.name} let ${r.name} keep it.`, cap.id);
    return { lines: [`${first(cap)} shrugs. “He built it as much as you did. Let him have it.” That’s the end of it, as far as he’s concerned.`], minutes: 60 };
  }
  if (temper(r).caution > 0.55 || (r.rels[p.id]?.fear ?? 0) > 0.3) { back(); bear(w, r, p.id, 0.2, `${p.name} leaned on him`); return { lines: [`${first(r)} hears you out and folds. His people are back by the end of the week.`], minutes: 40 }; }
  bear(w, r, p.id, 0.3, `${p.name} leaned on him`);
  addFact(w, { kind: 'threat', actor: p.id, victim: r.id, text: `${p.name} leaned on ${r.name} to close up the trade he took from him. ${r.name} didn’t.`, district: op.district }, { witnesses: [p.id, r.id, ...(r.bossId ? [r.bossId] : [])] });
  return { lines: [`${first(r)} listens, and doesn’t move. “It’s a free country.” It’s a matter between you now.`], minutes: 40 };
}

// ------------------------------------------------------------------------------------------------ when the player is the captain
// His men's rackets are theirs, but he is who they come to: for the money when the bank can't cover its hits, and for a ruling when two of
// his own men are fighting over the same trade. And, as any captain may, he can ask a man for a piece of what he has built.
function coverAsk(w: World, op: Op, owner: Character, loss: number, cap: Character) {
  addEnc(w, {
    kind: 'ent', from: owner.id, title: `${first(owner)} needs ${money(loss)} for his hits`, days: 3, data: { k: 'cover', op: op.id, amt: loss },
    lines: [`${owner.name}’s numbers bank got caught: the number everybody played came in. He is ${money(loss)} short of what the winners are owed.`, `He has come to you because you are his captain. If the bank doesn’t pay, it has no name left.`],
    opts: [
      { code: 'lend', label: `Lend it to him`, hint: 'He pays you back out of the bank, every week. He owes you more than the money.' },
      { code: 'gift', label: `Cover it, and forget it`, hint: 'It costs you. A man you carried through a bad week doesn’t forget it.' },
      { code: 'no', label: 'Tell him it’s his bank', hint: 'He has to find it, or welsh. Either way it was your man who couldn’t pay.' },
    ],
  });
  void cap;
}
function quarrelAsk(w: World, op: Op, ro: Op, owner: Character, rival: Character, id: Id, role: OpRole) {
  const who = role === 'spot' ? w.biz[id]?.name : w.chars[id]?.name;
  addEnc(w, {
    kind: 'ent', from: owner.id, about: rival.id, title: `${first(owner)} and ${first(rival)}: ${who}`, days: 6, data: { k: 'quarrel', op: op.id, rop: ro.id, link: id, role },
    lines: [`${owner.name} comes to you about ${rival.name}. Both are yours. ${who} ${role === 'spot' ? 'took slips for ' + first(owner) + '’s bank' : 'dealt with ' + first(owner)}, and now deals with ${first(rival)}.`, `${first(owner)} says ${first(rival)} went behind his back. He wants you to say so.`],
    opts: [
      { code: 'owner', label: `Rule for ${first(owner)}: it goes back to him`, hint: `${first(rival)} won’t like it.` },
      { code: 'rival', label: `Rule for ${first(rival)}: he keeps it`, hint: `${first(owner)} came to you for nothing.` },
      { code: 'both', label: 'Tell them both to stop fighting over scraps', hint: 'Nobody wins. Nobody loses face either.' },
    ],
  });
}
// The captain asks one of his men for a piece of a racket: the man weighs what he owes him, what he fears, and what he can spare.
export function askPiece(w: World, p: Character, op: Op): string[] {
  const o = w.chars[op.owner];
  if (!o?.alive || o.bossId !== p.id || (op.stakes ?? []).some((s) => s.holder === p.id)) return ['That isn’t yours to ask for.'];
  const lean = rel(o, p.id).trust * 0.6 + (o.rels[p.id]?.fear ?? 0) * 0.6 + temper(o).caution * 0.3 - o.traits.greed * 0.4 - (pressed(motives(w, o, p)) * 0.2);
  if (lean > 0.15) {
    (op.stakes ??= []).push({ holder: p.id, share: 0.1, since: w.now, how: 'his captain asked for it' });
    opNote(w, op, `${p.name} takes 10% of it, every week.`, p.id);
    feel(w, o, p.id, 'trust', -0.02);
    return [`${first(o)} doesn’t argue. “Ten percent. It’s your ground.” You’ll see it every week, off the top.`];
  }
  bear(w, o, p.id, 0.15, `${p.name} wanted a piece of what he built`);
  return [`${first(o)} looks at you a long time. “With respect, it’s mine. I built it.” He’s refused his captain, and you both know what that means.`];
}
export function captainChoose(w: World, p: Character, op: Op, e: Enc, code: string): { lines: string[]; minutes: number } {
  const k = String(e.data?.k), o = e.from ? w.chars[e.from] : undefined;
  if (!o?.alive) return { lines: ['It has settled itself.'], minutes: 5 };
  if (k === 'cover') {
    const amt = Number(e.data?.amt ?? 0);
    if (code === 'lend') { const x = transfer(w, p, o, amt, 'loan', 'covering his bank'); if (x) createDebt(w, p.id, o.id, x, 0, 'covering his numbers bank'); feel(w, o, p.id, 'trust', 0.08); return { lines: [`You count it out. ${first(o)} pays his winners by noon, and you by the month.`], minutes: 30 }; }
    if (code === 'gift') { transfer(w, p, o, amt, 'gift', 'covering his bank'); feel(w, o, p.id, 'trust', 0.15); feel(w, o, p.id, 'affection', 0.08); addFavour(w, p.id, o.id, 2, 'covering his bank when it couldn’t pay'); return { lines: [`“Forget it,” you tell him. He won’t. Nobody who hears about it will either.`], minutes: 30 }; }
    op.bad = (op.bad ?? 0) + 2; bear(w, o, p.id, 0.1, `${p.name} let his bank go under`);
    addFact(w, { kind: 'report', actor: o.id, minor: false, text: `${o.name}’s numbers bank couldn’t pay its hits, and his captain ${p.name} didn’t cover it.`, district: op.district }, { witnesses: [o.id, p.id, ...(p.bossId ? [p.bossId] : [])] });
    return { lines: [`${first(o)} goes back to his bank empty-handed. By the end of the week the street knows it welshed.`], minutes: 15 };
  }
  // the quarrel between two of his men
  noteRuling(p);
  const ro = w.ops.find((x) => x.id === e.data?.rop), r = e.about ? w.chars[e.about] : undefined, id = String(e.data?.link), role = String(e.data?.role) as OpRole;
  if (code === 'owner' && ro && r) { ro.links = (ro.links ?? []).filter((x) => x.id !== id); (op.links ??= []).push({ id, role, since: w.now }); bear(w, r, p.id, 0.12, `${p.name} ruled against him`); feel(w, o, p.id, 'trust', 0.06); return { lines: [`You rule for ${first(o)}. ${first(r)} takes it, because you’re his captain.`], minutes: 30 }; }
  if (code === 'rival' && r) { bear(w, o, p.id, 0.12, `${p.name} ruled against him`); feel(w, r, p.id, 'trust', 0.06); return { lines: [`You rule for ${first(r)}. ${first(o)} came to you and got nothing.`], minutes: 30 }; }
  if (r) { feel(w, o, p.id, 'respect', 0.02); feel(w, r, p.id, 'respect', 0.02); }
  return { lines: ['You tell them both you have better things to do than referee over a candy store. They shut up about it, for now.'], minutes: 20 };
}

// One of his men is dead, or inside for a long stretch: his racket needs a man, and the player, his captain, decides who.
function assignAsk(w: World, op: Op, o: Character, cap: Character) {
  const r = op.runner ? w.chars[op.runner] : undefined;
  const men = Object.values(w.chars).filter((c) => ok(w, c) && c.bossId === cap.id && c.id !== o.id && c.id !== r?.id).sort((a, b) => rel(cap, b.id).trust - rel(cap, a.id).trust || byId(a, b)).slice(0, 2);
  addEnc(w, {
    kind: 'ent', from: null, about: o.id, title: `${first(o)}’s ${labelOf(op)} needs a man`, days: 7, data: { k: 'assign', op: op.id },
    lines: [`${o.name} is ${o.alive ? 'inside, and won’t be out for a long time' : 'dead'}. His ${labelOf(op)} in ${op.district} is still running, for now, on habit.`, 'It’s yours to say who has it. Whoever you choose will know you chose him, and so will the men you didn’t.'],
    opts: [
      ...(ok(w, r) && !r!.isPlayer ? [{ code: 'g:' + r!.id, label: `Give it to ${r!.name}, who has been running it`, hint: 'He knows the people. He’ll be grateful.' }] : []),
      ...men.map((c) => ({ code: 'g:' + c.id, label: `Give it to ${c.name}`, hint: 'One of your own. The others will notice whom you favoured.' })),
      { code: 'me', label: 'Take it yourself', hint: 'More money for you. Your men will see what you did.' },
      ...(o.alive ? [{ code: 'hold', label: `Keep it going for ${first(o)} until he’s out`, hint: 'He’ll remember it. His runner keeps it in the meantime.' }] : []),
    ],
  });
}
export function assignChoose(w: World, p: Character, op: Op, code: string): { lines: string[]; minutes: number } {
  const o = w.chars[op.owner];
  if (code === 'hold' && o) { feel(w, o, p.id, 'trust', 0.12); feel(w, o, p.id, 'affection', 0.06); opNote(w, op, `${p.name} kept it for ${o.name} while he was inside.`, p.id); return { lines: [`You let it be known: it’s ${first(o)}’s, and it will be his when he comes out. Word gets to him inside.`], minutes: 20 }; }
  const to = code === 'me' ? p : w.chars[code.slice(2)];
  if (!to) return { lines: [], minutes: 5 };
  transferOp(w, op, to.id, `${p.name} gave it to ${to.isPlayer ? 'himself' : to.name}`);
  if (!to.isPlayer) { feel(w, to, p.id, 'trust', 0.1); feel(w, to, p.id, 'respect', 0.04); }
  for (const c of Object.values(w.chars).filter((x) => x.alive && x.bossId === p.id && x.id !== to.id && x.id !== o?.id)) if (to.isPlayer) bear(w, c, p.id, 0.03, `${p.name} kept ${o?.name ?? 'a man'}’s racket for himself`);
  if (o?.alive && o.id !== to.id) bear(w, o, p.id, 0.25, `${p.name} gave his ${labelOf(op)} away while he was inside`);
  return { lines: [to.isPlayer ? `You take it into your own hands. Your men see it, and say nothing, which is its own kind of saying.` : `${to.name} has it now. He shakes your hand like a man who knows what he’s been given.`], minutes: 20 };
}
