import { social } from './conv/social';
import { foldVentures } from './enterprise';
import { ensureOrgs } from './orgs';
import { FEMALE } from './names';
import { ensureClubs } from './clubdata';
import { ambitionInit } from './ambition';
import { BASE_RATE, emptyBooks } from './books';
import { rollProblem, rollSkills } from './people';
import { addFact, createDebt, link, money, ownersChanged, schedule } from './core';
import { DISTRICTS } from './core';
import { Rng } from './rng';
import { lifeInit } from './life';
import { applyBackground } from './background';
import { Business, Character, DAY, Family, HOUR, Id, Rank, SCHEMA, Traits, WEEK, World } from './types';

const FIRST = [
  'Vincent', 'Sal', 'Carmine', 'Tony', 'Frankie', 'Paulie', 'Nicky', 'Joey', 'Richie', 'Sonny',
  'Gino', 'Mario', 'Lou', 'Angelo', 'Dom', 'Marty', 'Eddie', 'Johnny', 'Tommy', 'Bobby',
  'Peter', 'Sammy', 'Louie', 'Vito', 'Rocco', 'Artie', 'Benny', 'Charlie', 'Danny', 'Freddie',
  'Georgie', 'Hank', 'Jimmy', 'Lenny', 'Mickey', 'Nate', 'Patsy', 'Ralphie', 'Stevie', 'Teddy',
];
const LAST = [
  'Moretti', 'Lombardi', 'DeLuca', 'Bianchi', 'Ricci', 'Esposito', 'Greco', 'Conti', 'Barone', 'Vitale',
  'Rizzo', 'Costa', 'Fontana', 'Gallo', 'Mancini', 'Palumbo', 'Santoro', 'Caruso', 'Ferrara', 'Giordano',
  'Leone', 'Marino', 'Orsini', 'Pellegrino', 'Russo', 'Silvestri', 'Testa', 'Valenti', 'Zito', 'Amato',
  'Bruno', 'Cassano', 'DeSantis', 'Fiore', 'Galante', 'Lucchese', 'Neri', 'Sorrento', 'Lupo', 'Bellini',
];

export interface OrgDef { name: string; districts: string[]; casino: string; capos?: number }
export const STANDARD_ORGS: OrgDef[] = [
  { name: 'Corrente', districts: ['Little Italy', 'Bensonhurst'], casino: 'The Gilded Lily', capos: 3 },
  { name: 'Marchetti', districts: ['Red Hook', "Hell's Kitchen"], casino: 'Club Sorrento', capos: 3 },
  { name: 'Falco', districts: ['The Bronx', "Hell's Kitchen"], casino: 'The Blue Parrot', capos: 3 },
  { name: 'Brancato', districts: ['Staten Island', 'Red Hook'], casino: 'The Silver Anchor' },
  { name: 'Santangelo', districts: ['Astoria', 'The Bronx'], casino: 'Club Vesuvio' },
];

// Extra organisations for worlds that are not the standard five (tests, and anyone who wants a different city).
export const EXTRA_ORGS: OrgDef[] = [
  { name: 'Lucchesi', districts: ['Astoria', 'Little Italy'], casino: 'The Gold Coin' },
  { name: 'Barzini', districts: ['Bensonhurst', 'Staten Island'], casino: 'Club Napoli' },
];

const BIZ_KINDS: { kind: string; label: string; income: number }[] = [
  { kind: 'restaurant', label: 'Trattoria', income: 1400 },
  { kind: 'restaurant', label: 'Ristorante', income: 1500 },
  { kind: 'bar', label: 'Tavern', income: 1100 },
  { kind: 'bar', label: 'Lounge', income: 1000 },
  { kind: 'bakery', label: 'Bakery', income: 700 },
  { kind: 'deli', label: 'Deli', income: 600 },
  { kind: 'laundromat', label: 'Laundromat', income: 800 },
  { kind: 'garage', label: 'Auto Repair', income: 900 },
  { kind: 'butcher', label: 'Meats', income: 650 },
  { kind: 'tailor', label: 'Tailors', income: 450 },
  { kind: 'pawnshop', label: 'Pawn', income: 700 },
  { kind: 'newsstand', label: 'News & Tobacco', income: 350 },
  { kind: 'florist', label: 'Florist', income: 400 },
  { kind: 'barber', label: 'Barber Shop', income: 450 },
  { kind: 'grocer', label: 'Grocery', income: 750 },
  { kind: 'cafe', label: 'Caffè', income: 600 },
  { kind: 'shoes', label: 'Shoe Repair', income: 380 },
  { kind: 'hardware', label: 'Hardware', income: 650 },
  { kind: 'fish', label: 'Fish Market', income: 700 },
  { kind: 'candy', label: 'Candy Store', income: 400 },
  { kind: 'jeweller', label: 'Jewellers', income: 900 },
  { kind: 'photo', label: 'Photo Studio', income: 420 },
  { kind: 'funeral', label: 'Funeral Home', income: 1200 },
  { kind: 'billiards', label: 'Billiard Hall', income: 850 },
  { kind: 'cleaner', label: 'Dry Cleaners', income: 560 },
  { kind: 'pharmacy', label: 'Pharmacy', income: 1000 },
  { kind: 'club', label: 'Social Club', income: 750 },
  { kind: 'diner', label: 'Diner', income: 950 },
];

const r2 = (rng: Rng, a: number, b: number) => Math.round(rng.range(a, b) * 100) / 100;

function mk(
  w: World,
  used: Set<string>,
  o: { rank: Rank; familyId: string | null; bossId: string | null; district: string; cash: number; last?: string; name?: string },
): Character {
  const rng = w.rng;
  const made = o.rank !== 'civilian';
  let name = o.name ?? '';
  if (!name) {
    do {
      name = `${rng.pick(FIRST)} ${o.last ?? rng.pick(LAST)}`;
    } while (used.has(name) || (!o.name && !o.last && used.has('last:' + name.split(' ').slice(1).join(' ').toLowerCase())));
  }
  used.add(name);
  const traits: Traits = made
    ? {
        greed: r2(rng, 0.3, 1), violence: r2(rng, 0.3, 0.95), ambition: r2(rng, 0.2, 1), caution: r2(rng, 0.1, 0.8),
        sociability: r2(rng, 0.2, 0.9), vice: r2(rng, 0, 0.9), courage: r2(rng, 0.5, 1),
      }
    : {
        greed: r2(rng, 0.2, 0.7), violence: r2(rng, 0, 0.25), ambition: r2(rng, 0.1, 0.5), caution: r2(rng, 0.3, 0.9),
        sociability: r2(rng, 0.3, 0.9), vice: r2(rng, 0, 0.7), courage: r2(rng, 0.1, 0.65),
      };
  const wage = { civilian: 110, associate: 80, soldier: 150, capo: 300, underboss: 600, boss: 1000 }[o.rank];
  const c: Character = {
    id: 'c' + w.nextId++,
    name,
    traits,
    cash: o.cash,
    wage,
    familyId: o.familyId,
    rank: o.rank,
    bossId: o.bossId,
    district: o.district,
    alive: true,
    jailedUntil: 0,
    hurtUntil: 0,
    heat: 0,
    wake: made ? 10 : 7,
    sleep: made ? 26 : 22,
    rels: {},
    known: {},
    struggling: {},
    cooldown: {},
    weekIncome: 0,
    lifetimeKick: 0,
    standing: 40,
    books: emptyBooks(),
    memos: [],
    kickRate: BASE_RATE[o.rank],
    skills: rollSkills(rng, o.rank),
    cars: 0,
    goods: 0,
  };
  if (made && o.rank !== 'boss' && rng.chance(0.16)) c.problem = rollProblem(w, c);
  w.chars[c.id] = c;
  return c;
}

const LADY_USED = new Set<string>();
export { FEMALE }; // (V90: the list lives in names.ts, so modules that only need the names don't load the world generator)
export function spawnCivilian(w: World, name: string, district: string, cash = 120): Character {
  const used = new Set(Object.values(w.chars).map((c) => c.name));
  let n = name;
  for (let i = 2; used.has(n); i++) n = `${name} ${i}`;
  const c = mk(w, used, { rank: 'civilian', familyId: null, bossId: null, district, cash, name: n });
  delete c.problem;
  return c;
}

// `bg` is the player's background (background.ts). It shapes the start of a new game once, here, and never again.
export function createWorld(seed: number, playerName = 'Tony Marino', opts: { orgs?: OrgDef[]; bg?: string; start?: StartAt } = {}): World {
  const ORGS = opts.orgs ?? STANDARD_ORGS;
  const rng = new Rng(seed);
  // (the version is recorded from the start, where a loaded world keeps it, so a world that never stopped and one saved and loaded
  // put whatever they create later in the same place, and serialise alike)
  const w: World = {
    seed, schema: SCHEMA, rng, now: 8 * HOUR, seq: 0, queue: [], chars: {}, biz: {}, fam: {}, debts: [], facts: {}, nextId: 1, playerId: null, jobs: [], ventures: [], grievances: [], pending: [], enc: [], favours: [], threats: {}, events: [], ops: [], goals: { done: {} },
  };
  // nobody else in the city carries the player's surname unless he gives it to them, so no stranger reads as kin
  const used = new Set<string>([playerName, 'last:' + playerName.trim().split(/\s+/).slice(1).join(' ').toLowerCase()]);
  const cash = (a: number, b: number) => Math.round(rng.range(a, b) / 10) * 10;

  // --- families
  const members: Record<string, Character[]> = {};
  const famCapos: Record<string, Character[]> = {};
  for (const def of ORGS) {
    const fid = 'fam_' + def.name.toLowerCase();
    const d = () => rng.pick(def.districts);
    const boss = mk(w, used, { rank: 'boss', familyId: fid, bossId: null, district: d(), cash: cash(8000, 15000), last: def.name });
    // (the family's fund: years of dues, the money that looks after men inside; recorded through the fund's own door: orgs.treasuryMove)
    const fund = 4000 + (def.name.length * 700) % 5000; // (no draw from the world's dice: every other world is generated as it always was)
    const fam: Family = { id: fid, name: def.name, bossId: boss.id, districts: def.districts, tension: {}, treasury: fund, tin: fund, tout: 0 };
    w.fam[fid] = fam;
    const under = mk(w, used, { rank: 'underboss', familyId: fid, bossId: boss.id, district: d(), cash: cash(4000, 7000) });
    link(boss, under, 0.7);
    const all = [boss, under];
    const capos: Character[] = [];
    const nCapos = def.capos ?? 2;
    for (let i = 0; i < nCapos; i++) {
      const capo = mk(w, used, { rank: 'capo', familyId: fid, bossId: under.id, district: d(), cash: cash(2000, 4000) });
      link(under, capo, 0.6);
      capos.push(capo);
      all.push(capo);
      for (let j = 0; j < rng.int(2, 3); j++) {
        const sol = mk(w, used, { rank: 'soldier', familyId: fid, bossId: capo.id, district: d(), cash: cash(600, 1800) });
        link(capo, sol, 0.55);
        all.push(sol);
        for (let k = 0; k < rng.int(0, 2); k++) {
          const as = mk(w, used, { rank: 'associate', familyId: fid, bossId: sol.id, district: d(), cash: cash(150, 500) });
          link(sol, as, 0.5);
          all.push(as);
        }
      }
    }
    members[fid] = all;
    famCapos[fid] = capos;
  }
  for (const a of Object.keys(w.fam)) for (const b of Object.keys(w.fam)) if (a !== b) w.fam[a].tension[b] = 0;

  // --- casinos (family-run, owned by a capo)
  ORGS.forEach((def, i) => {
    const fid = 'fam_' + def.name.toLowerCase();
    const owner = famCapos[fid][0];
    const b: Business = {
      id: 'b' + w.nextId++, name: def.casino, kind: 'casino', ownerId: owner.id, district: def.districts[0],
      income: 2200, expense: 1900, cash: 3000, distress: 0, open: true, damaged: 0,
      protection: { collectorId: owner.id, familyId: fid, fee: 0 },
    };
    w.biz[b.id] = b; ownersChanged(w);
    void i;
  });

  // --- the player and their small crew
  const corrente = 'fam_' + ORGS[0].name.toLowerCase(); // the player starts in the first organisation of the city
  const mentor = famCapos[corrente][1];
  // (The Family: a game can start at any of the six positions. Above associate, the player takes a seat the family already has: the
  // man who held it becomes him, with his crew, his relationships and the record of how he came to it: seatPlayer)
  const start = opts.start ?? 'associate';
  const player = start === 'associate' ? mk(w, used, { rank: 'associate', familyId: corrente, bossId: mentor.id, district: 'Little Italy', cash: 1500, name: playerName }) : seatPlayer(w, used, members[corrente], famCapos[corrente], start as Exclude<StartAt, 'associate'>, playerName);
  player.isPlayer = true;
  player.intro = {}; // nobody has been introduced yet; saves from before V72 are backfilled in deserialize
  delete player.problem;
  delete player.want;
  player.traits = { greed: 0.5, violence: 0.5, ambition: 0.7, caution: 0.5, sociability: 0.6, vice: 0.3, courage: 0.7 };
  player.wake = 9;
  w.playerId = player.id;
  if (start === 'associate') { link(mentor, player, 0.5); members[corrente].push(player); }
  else for (const c of members[corrente]) if (c.id !== player.id && ((c.rels[player.id]?.known ?? 0) > 0 || c.familyId === corrente)) player.intro[c.id] = 0; // (he knows his own family)
  // You start with nobody under you. Taking men on is the first thing you have to do.

  // A man from a connected family has an older brother already made in the Corrente family: a soldier in another captain's
  // crew, made here like every other soldier so that the rest of the world (protection, loans, clubs, ambitions) counts him.
  let brother: Character | undefined;
  if (opts.bg === 'connected') {
    const capo = rng.pick(famCapos[corrente].filter((c) => c.id !== mentor.id));
    const mine = playerName.trim().split(/\s+/)[0].toLowerCase();
    const surname = playerName.trim().split(/\s+/).slice(1).join(' ') || playerName.trim();
    const given = rng.pick(['Sal', 'Carmine', 'Vinnie', 'Frankie', 'Sonny', 'Richie', 'Paulie', 'Gino', 'Nicky', 'Dom'].filter((n) => n.toLowerCase() !== mine));
    brother = mk(w, used, { rank: 'soldier', familyId: corrente, bossId: capo.id, district: capo.district, cash: cash(600, 1800), name: `${given} ${surname}` });
    link(capo, brother, 0.55);
    members[corrente].push(brother);
  }

  // --- civilians and their businesses
  const kinds = [...BIZ_KINDS];
  for (let i = 0; i < 40; i++) {
    if (!kinds.length) kinds.push(...BIZ_KINDS);
    const k = kinds.splice(rng.int(0, kinds.length - 1), 1)[0];
    const district = rng.pick(DISTRICTS);
    const owner = mk(w, used, { rank: 'civilian', familyId: null, bossId: null, district, cash: cash(200, 800) });
    const last = owner.name.split(' ')[1];
    const b: Business = {
      id: 'b' + w.nextId++, name: `${last}'s ${k.label}`, kind: k.kind, ownerId: owner.id, district,
      income: k.income, expense: Math.round((k.income * 0.88) / 5) * 5, cash: 300, distress: 0, open: true, damaged: 0,
    };
    w.biz[b.id] = b; ownersChanged(w);
  }
  for (let i = 0; i < 14; i++) mk(w, used, { rank: 'civilian', familyId: null, bossId: null, district: rng.pick(DISTRICTS), cash: cash(100, 500) });
  for (let i = 0; i < 12; i++) {
    const nm = `${rng.pick(FEMALE.filter((n) => !LADY_USED.has(n)))} ${rng.pick(LAST)}`;
    if (used.has(nm)) continue;
    mk(w, used, { rank: 'civilian', familyId: null, bossId: null, district: rng.pick(DISTRICTS), cash: cash(60, 300), name: nm });
  }
  for (let i = 0; i < 9; i++) {
    const pr = mk(w, used, { rank: 'civilian', familyId: null, bossId: null, district: rng.pick(DISTRICTS), cash: cash(20, 200) });
    pr.prospect = true;
    pr.traits.ambition = r2(rng, 0.45, 0.95);
    pr.traits.violence = r2(rng, 0.2, 0.7);
    pr.traits.courage = r2(rng, 0.45, 0.9);
  }

  // --- everyone knows a few neighbours
  const all = Object.values(w.chars);
  for (const c of all) {
    const near = all.filter((x) => x.id !== c.id && x.district === c.district);
    for (let i = 0; i < 4 && near.length; i++) link(c, near.splice(rng.int(0, near.length - 1), 1)[0], 0.2);
  }

  // --- some existing protection arrangements
  for (const b of Object.values(w.biz)) {
    if (b.kind === 'casino' || !rng.chance(0.55)) continue;
    const fams = Object.values(w.fam).filter((f) => f.districts.includes(b.district));
    if (!fams.length) continue;
    const fam = rng.pick(fams);
    const pool = members[fam.id].filter((m) => (m.rank === 'soldier' || m.rank === 'associate') && !m.isPlayer);
    const collector = rng.pick(pool);
    b.protection = { collectorId: collector.id, familyId: fam.id, fee: Math.round((b.income * 0.08) / 5) * 5 };
    link(collector, w.chars[b.ownerId], 0.15);
  }

  // --- some existing loans
  const lenders = Object.values(w.chars).filter((c) => (c.rank === 'soldier' || c.rank === 'capo') && !c.isPlayer);
  const owners = Object.values(w.biz).filter((b) => b.kind !== 'casino');
  for (let i = 0; i < 8; i++) {
    const lender = rng.pick(lenders);
    const b = rng.pick(owners);
    const o = w.chars[b.ownerId];
    if (w.debts.some((d) => d.debtor === o.id)) continue;
    const principal = rng.pick([500, 1000, 1500]);
    const d = createDebt(w, lender.id, o.id, principal, 0.05, 'business loan');
    d.nextDue = w.now + rng.int(1, 6) * DAY;
    link(lender, o, 0.25);
    addFact(w, { kind: 'loan', actor: lender.id, victim: o.id, amount: principal, text: `${lender.name} lent ${o.name} ${money(principal)}.`, district: o.district });
  }

  // --- time starts
  schedule(w, 6 * DAY + 20 * HOUR, 'weekly');
  schedule(w, 1 * DAY + 9 * HOUR, 'daily');
  for (const c of Object.values(w.chars)) if (!c.isPlayer) schedule(w, w.now + rng.int(0, 180), 'think', c.id);
  lifeInit(w, player, brother);
  ambitionInit(w);
  void WEEK;
  ensureShape(w);
  if (opts.bg) applyBackground(w, player, opts.bg);
  // (a captain who starts the game has a crew to govern: three or four made men, topped up last, so nothing else in the world changes)
  if (start === 'capo') for (let k = Object.values(w.chars).filter((c) => c.alive && c.bossId === player.id && c.rank === 'soldier').length; k < 4; k++) {
    const sol = mk(w, used, { rank: 'soldier', familyId: player.familyId, bossId: player.id, district: player.district, cash: cash(600, 1800) });
    link(player, sol, 0.55); player.intro![sol.id] = 0;
    schedule(w, w.now + rng.int(0, 180), 'think', sol.id);
  }
  return w;
}

// The collections every world carries. A new world gets them at creation and an older save gets them on load, so the two
// have exactly the same shape (and so exactly the same saved text) once the game has run.
export function ensureShape(w: World) {
  w.jobs ??= [];
  // (Gate 4: the conversation layer's record is part of every world, new or loaded: who has promised what, who asked whom, what was
  // said. An older save gets an empty one and the layer takes over from there: no feature switch decides it any more)
  social(w);
  ensureClubs(w);
  ensureOrgs(w);
  w.ventures ??= [];
  foldVentures(w); // (October 2026: an open venture is a chop shop op housed in its garage)
  w.grievances ??= [];
  w.pending ??= [];
  w.enc ??= [];
  w.favours ??= [];
  w.threats ??= {};
  w.events ??= [];
  w.ops ??= [];
  w.goals ??= { done: {} };
  w.disputes ??= [];
  w.txns ??= [];
  w.situations ??= [];
  w.sitcool ??= {};
  w.sitpace ??= { lastMajor: -1e9, lastVisible: -1e9, weekVis: 0, wk: 0 };
  w.agency ??= { goals: [], ended: [], stats: {}, cool: {}, lastAsk: -1e9 };
}

// Add shops and the people who run them to a world that already exists (older saves, or a city that has grown).
export function addShops(w: World, n: number): Id[] {
  const rng = w.rng;
  const used = new Set(Object.values(w.chars).map((c) => c.name));
  const ids: Id[] = [];
  for (let i = 0; i < n; i++) {
    const k = rng.pick(BIZ_KINDS.slice(16));
    const district = rng.pick(DISTRICTS);
    const owner = mk(w, used, { rank: 'civilian', familyId: null, bossId: null, district, cash: Math.round(rng.range(200, 800) / 10) * 10 });
    delete owner.problem;
    const last = owner.name.split(' ')[1];
    const b: Business = { id: 'b' + w.nextId++, name: `${last}'s ${k.label}`, kind: k.kind, ownerId: owner.id, district, income: k.income, expense: Math.round((k.income * 0.88) / 5) * 5, cash: 300, distress: 0, open: true, damaged: 0 };
    w.biz[b.id] = b; ownersChanged(w);
    for (const x of Object.values(w.chars).filter((c) => c.alive && c.district === district && c.id !== owner.id).slice(0, 4)) link(owner, x, 0.2);
    schedule(w, w.now + rng.int(0, 180), 'think', owner.id);
    ids.push(owner.id);
  }
  return ids;
}

// ------------------------------------------------------------------------------------------------ starting at a seat (The Family)
export type StartAt = 'associate' | 'soldier' | 'capo' | 'underboss' | 'consigliere' | 'boss';
// The man who holds the seat becomes the player: his name is the player's, everything else of his is kept (his crew answer to him, his
// boss knows him, what he owns is his). His career is given the history of how he came to the seat, and his money and name what a man
// of that seat would have after years in it.
function seatPlayer(w: World, used: Set<string>, fam: Character[], capos: Character[], start: Exclude<StartAt, 'associate'>, name: string): Character {
  const boss = fam.find((c) => c.rank === 'boss')!, ub = fam.find((c) => c.rank === 'underboss')!;
  const mentor = capos[1] ?? capos[0];
  const soldiers = fam.filter((c) => c.rank === 'soldier');
  const seat = start === 'boss' ? boss : start === 'underboss' ? ub : start === 'capo' ? mentor
    : start === 'soldier' ? soldiers.filter((c) => c.bossId === mentor.id).sort((a, b) => (a.id < b.id ? -1 : 1))[0] ?? soldiers[0]
    : soldiers.filter((c) => c.bossId !== mentor.id).sort((a, b) => (a.id < b.id ? -1 : 1))[0] ?? soldiers[0]; // the consigliere
  used.delete(seat.name);
  const was = seat.name;
  seat.name = name; used.add(name);
  const Y = 365 * DAY, since = { soldier: -3 * Y, capo: -6 * Y, underboss: -4 * Y, consigliere: -5 * Y, boss: -7 * Y }[start];
  const f = w.fam[seat.familyId!];
  const posts: { t: number; text: string; by?: string }[] = [];
  posts.push({ t: since - 4 * Y, text: 'Made, after years as an associate', by: boss.id });
  if (start === 'capo' || start === 'underboss' || start === 'boss') posts.push({ t: since - (start === 'capo' ? 0 : 3 * Y), text: 'Captain, given a crew of his own', by: boss.id });
  if (start === 'underboss' || start === 'boss') posts.push({ t: start === 'boss' ? since - Y : since, text: 'Underboss, named by the boss of the day' });
  if (start === 'boss') posts.push({ t: since, text: 'Took the chair when the old boss stepped down' });
  if (start === 'consigliere') posts.push({ t: since, text: 'Consigliere, named for his judgment', by: boss.id });
  seat.career = { done: 30 + Math.round(-since / Y) * 6, failed: 2, log: [], lw: start === 'soldier' || start === 'consigliere' ? 20 : Math.round(-since / WEEK), svc: 14, ruled: start === 'soldier' ? 1 : 8, posts };
  seat.standing = { soldier: 40, capo: 55, underboss: 65, consigliere: 62, boss: 75 }[start];
  seat.cash = { soldier: 4000, capo: 9000, underboss: 15000, consigliere: 12000, boss: 25000 }[start];
  seat.lifetimeKick = { soldier: 8000, capo: 25000, underboss: 45000, consigliere: 30000, boss: 60000 }[start];
  if (start === 'consigliere') { f.consigliere = seat.id; seat.bossId = boss.id; seat.wage = 300; link(boss, seat, 0.75); }
  if (start === 'boss') f.leaderSince = since;
  void was;
  return seat;
}
