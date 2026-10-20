import { post } from './ledger';
import { bizMove, succeedOwner } from './econ';
import { applyRank, repairHierarchy } from './rank';
import { succeed } from './orgs';
import { Business, Character, DAY, Debt, Fact, FactKind, Id, Rel, World } from './types';
import { goalsOnDeath } from './goals';

export const DISTRICTS = ['Little Italy', 'Bensonhurst', 'Red Hook', "Hell's Kitchen", 'The Bronx', 'Staten Island', 'Astoria'];

export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const travelTime = (a: string, b: string) => (a === b ? 10 : 35);
export const dayNo = (t: number) => Math.floor(t / DAY) + 1;

// Day 0 is Monday 2 March 1970.
export function fmtTime(t: number): string {
  const d = new Date(Date.UTC(1970, 2, 2) + t * 60000);
  return d.toLocaleString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export function shortTime(t: number): string {
  const m = t % DAY;
  return `Day ${dayNo(t)} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function newId(w: World, prefix: string): Id {
  return prefix + w.nextId++;
}

export function rel(c: Character, id: Id): Rel {
  return (c.rels[id] ??= { trust: 0.1, respect: 0.3, affection: 0.1, grudge: 0, lastMet: -1e9 });
}

export function link(a: Character, b: Character, trust: number) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as [Character, Character][]) {
    const r = rel(x, y.id);
    r.trust = Math.max(r.trust, trust);
    r.affection = Math.max(r.affection, trust * 0.6);
    r.respect = Math.max(r.respect, 0.4);
  }
}

export function schedule(w: World, t: number, kind: 'think' | 'weekly' | 'daily', who?: Id) {
  const ev = { t, seq: w.seq++, kind, who };
  let lo = 0;
  let hi = w.queue.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    const q = w.queue[m];
    if (q.t < ev.t || (q.t === ev.t && q.seq < ev.seq)) lo = m + 1;
    else hi = m;
  }
  w.queue.splice(lo, 0, ev);
}

export function isAwake(c: Character, t: number): boolean {
  const tod = t % DAY;
  if (c.sleep <= 24) return tod >= c.wake * 60 && tod < c.sleep * 60;
  return tod >= c.wake * 60 || tod < (c.sleep - 24) * 60;
}
export function nextWake(c: Character, t: number): number {
  const base = Math.floor(t / DAY) * DAY + c.wake * 60;
  return base > t ? base : base + DAY;
}

// Every dollar is recorded against where it came from, so the books can say what a man earned and what he owes up.
export function record(c: Character, amt: number, src: string) {
  if (amt <= 0) return;
  c.weekIncome += amt;
  if (c.isPlayer) c.lifetimeGross = (c.lifetimeGross ?? 0) + amt;
  c.books.gross[src] = (c.books.gross[src] ?? 0) + amt;
}
export function earn(c: Character, amt: number, src = 'odd') {
  c.cash += amt;
  record(c, amt, src);
}

// Which business each owner has, cached and rebuilt once it is more than 30 minutes of game time old. ownerBiz is called millions of times a run,
// so the check must be cheap: it no longer counts w.biz on every call. Instead, whatever adds a business (world.ts) or
// moves one between owners (econ.ts) calls ownersChanged, and the next call rebuilds the map. Businesses are never removed
// (a closed one stays, with open = false), and every new one gets a new id, so this rebuilds at exactly the moments the
// old count check did.
const ownerCache = new WeakMap<World, { t: number; map: Map<Id, Business> }>();
export function ownersChanged(w: World) { ownerCache.delete(w); }
export function ownerBiz(w: World, id: Id): Business | undefined {
  let c = ownerCache.get(w);
  if (!c || w.now - c.t > 30 || w.now < c.t) {
    const map = new Map<Id, Business>();
    for (const b of Object.values(w.biz)) if (b.open && !map.has(b.ownerId)) map.set(b.ownerId, b);
    c = { t: w.now, map };
    ownerCache.set(w, c);
  }
  const b = c.map.get(id);
  return b && b.open ? b : undefined;
}
export const famName = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : 'independent');
// The same event, told the way people actually tell it. The variant is fixed by the fact, so a story never changes between looks.
const h32 = (x: string) => { let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return h >>> 0; };
const TELL: [RegExp, string[]][] = [
  [/^(.+) dropped (\$[\d,]+) at (.+)\.$/, ['$1 left $2 on the table at $3 and called it an evening.', '$1 went home from $3 $2 lighter and swearing he was due.', '$3 had a good night. $1 had a very bad one: $2.']],
  [/^(.+) lent (.+) (\$[\d,]+)\.$/, ['$1 put $3 in $2’s hand. It will come back with interest, one way or another.', '$2 walked out of $1’s place with $3 and a debt that never sleeps.']],
  [/^(.+) now collects (\$[\d,]+) a week from (.+)\.$/, ['$3 now pays $1 $2 a week for the comfort of being left alone.', '$1 has $3 on the books: $2 a week, starting now.']],
  [/^(.+) told (.+) to get out of (.+)\.$/, ['$1 sent $2 packing from $3. No envelope, no discussion.', '$2 asked $1 for a weekly payment at $3 and was shown the door.', '$1 refused to pay protection and ran $2 out of $3.']],
  [/^(.+) robbed (.+) of (\$[\d,]+)\.$/, ['$1 cleaned out $2: $3, gone in a night.', '$2 opened up to find $3 missing. $1 left a cold till and a hot rumour.']],
  [/^(.+) beat up (.+)\.$/, ['$1 put $2 in the dirt. It wasn’t a conversation.', '$2 got a lesson from $1, delivered with fists.']],
  [/^(.+) missed a (\$[\d,]+) payment to (.+)\.$/, ['$1 let a $2 payment to $3 slide. That kind of thing gets noticed.', '$3 is still waiting on $2 from $1. Patience is wearing thin.']],
  [/^(.+) is late with the (\$[\d,]+) he owes (.+) for (.+)\.$/, ['$1 is late with $2 to $3 for $4. The envelope isn’t going to fill itself.', '$4’s envelope is light. $1 owes $3 $2 and hasn’t come up with it.']],
  [/^(.+) cleared his debt to (.+)\.$/, ['$1 squared up with $2. Not many do it voluntarily.', '$2 got paid in full by $1. A rarity.']],
  [/^(.+) was arrested\.$/, ['The law picked up $1. His friends have started saying he’s a good man.', '$1 is in a cell tonight, and every friend he has is thinking about what he knows.']],
  [/^(.+) came up (\$[\d,]+) short on what he owes (.+)\.$/, ['$1 came up $2 short with $3. The kind of mistake that’s remembered.', '$3 counted it twice. $1 was $2 light.']],
];
export function flavour(f: Fact, text: string): string {
  if (text !== f.text) return text;
  for (const [re, vs] of TELL) {
    const m = re.exec(text);
    if (m) return text.replace(re, vs[h32(f.id) % vs.length]);
  }
  return text;
}
export const factText = (f: Fact, knowsActor: boolean) => flavour(f, knowsActor || !f.textHidden ? f.text : f.textHidden);

// ---------------------------------------------------------------- knowledge

// How much a victim resents the culprit when they learn about it.
const GRUDGE: Partial<Record<FactKind, number>> = {
  beating: 0.5,
  vandalism: 0.5,
  murder: 0.8,
  robbery: 0.4,
  poach: 0.4,
  debt_missed: 0.15,
  debt_default: 0.4,
  protection_refused: 0.2,
};

export function learn(w: World, cid: Id, fact: Fact, from: string, knowsActor: boolean) {
  const c = w.chars[cid];
  if (!c || c.known[fact.id]) return;
  c.known[fact.id] = { t: w.now, from, knowsActor };
  if (fact.kind === 'business_struggling' && fact.business) c.struggling[fact.business] = fact.t;
  if (!c.alive || !knowsActor || !fact.actor || fact.actor === cid) return;
  const g = GRUDGE[fact.kind];
  if (!g) return;
  if (fact.victim === cid) {
    const r = rel(c, fact.actor);
    r.grudge = clamp(r.grudge + g);
    r.trust = clamp(r.trust - g * 0.5);
  } else if (fact.victim) {
    const v = w.chars[fact.victim];
    const close = (c.rels[fact.victim]?.affection ?? 0) > 0.5 || (!!v?.familyId && v.familyId === c.familyId);
    if (close) {
      const r = rel(c, fact.actor);
      r.grudge = clamp(r.grudge + g * 0.3);
    }
  }
}

// Someone was hurt by an unknown party. They guess - and may guess wrong.
function suspect(w: World, c: Character, fact: Fact) {
  const myFam = c.familyId;
  let best: Character | null = null;
  let bs = 0.12;
  for (const x of Object.values(w.chars)) {
    if (!x.alive || x.id === c.id || !x.familyId || x.familyId === myFam) continue;
    const r = c.rels[x.id];
    const tension = myFam ? (w.fam[myFam].tension[x.familyId] ?? 0) : 0;
    const s = (r ? r.grudge : 0) + tension * 0.05;
    if (s > bs) {
      bs = s;
      best = x;
    }
  }
  if (best) {
    const r = rel(c, best.id);
    r.grudge = clamp(r.grudge + 0.3);
  }
}

export interface FactOpts {
  witnesses?: Id[];
  victimKnows?: boolean;
  broadcast?: Id[]; // people who hear about it (without learning who did it)
}

export function addFact(
  w: World,
  f: Omit<Fact, 'id' | 't' | 'district'> & { district?: string },
  o: FactOpts = {},
): Fact {
  const actor = f.actor ? w.chars[f.actor] : undefined;
  const victim = f.victim ? w.chars[f.victim] : undefined;
  const fact: Fact = {
    ...f,
    id: newId(w, 'f'),
    t: w.now,
    district: f.district ?? actor?.district ?? victim?.district ?? DISTRICTS[0],
  };
  w.facts[fact.id] = fact;
  // Secrets leak. Sooner or later whoever was hurt usually finds out who did it.
  if (fact.hiddenActor && fact.actor && w.rng.chance(0.3)) (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(14, 56) * DAY, kind: 'reveal', fact: fact.id });
  const witnesses = o.witnesses ?? [];
  const knowers = new Set<Id>(witnesses);
  if (f.actor) knowers.add(f.actor);
  if (f.victim && o.victimKnows !== false) knowers.add(f.victim);
  for (const id of knowers) {
    const c = w.chars[id];
    if (!c || !c.alive) continue;
    const knowsActor = !fact.hiddenActor || id === f.actor || witnesses.includes(id);
    learn(w, id, fact, id === f.actor ? 'self' : 'witness', knowsActor);
    if (!knowsActor) suspect(w, c, fact);
  }
  for (const id of o.broadcast ?? []) {
    const c = w.chars[id];
    if (!c || !c.alive || c.known[fact.id]) continue;
    learn(w, id, fact, 'public', !fact.hiddenActor);
    if (fact.hiddenActor) suspect(w, c, fact);
  }
  return fact;
}

// Protected businessmen phone their protector when something happens.
// What a man should have passed up over the last month and did not (as far as the books show).
export function concealedGap(w: World, c: Character): number {
  const f = c.familyId ? w.fam[c.familyId] : undefined;
  const rate = c.kickRate + (f?.levy && f.levy.until > w.now ? f.levy.extra : 0);
  return Math.round(c.books.history.slice(-4).reduce((a, x) => a + Math.max(0, x.gross - x.declared), 0) * rate);
}

export function notifyProtector(w: World, b: Business, f: Fact) {
  const p = b.protection;
  if (!p) return;
  const pc = w.chars[p.collectorId];
  if (!pc || !pc.alive || pc.known[f.id]) return;
  learn(w, pc.id, f, b.ownerId, !f.hiddenActor);
  if (f.hiddenActor) suspect(w, pc, f);
}

export function witnessesAt(w: World, district: string, exclude: Id[], max = 3): Id[] {
  const out: Id[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.district !== district || exclude.includes(c.id) || c.jailedUntil > w.now) continue;
    if (!isAwake(c, w.now)) continue;
    if (w.rng.chance(0.25)) out.push(c.id);
  }
  while (out.length > max) out.splice(w.rng.int(0, out.length - 1), 1);
  return out;
}

// ------------------------------------------------------------------- debts

export function createDebt(
  w: World,
  creditor: Id,
  debtor: Id,
  principal: number,
  rate: number,
  reason: string,
  cause?: Id,
): Debt {
  const d: Debt = {
    id: newId(w, 'd'),
    creditor,
    debtor,
    principal,
    balance: principal,
    weeklyRate: rate,
    weeklyPayment: Math.round((principal * 0.12) / 5) * 5,
    nextDue: w.now + 7 * DAY,
    missed: 0,
    status: 'active',
    reason,
    cause,
  };
  w.debts.push(d);
  post(w, { from: creditor, to: debtor, amt: principal, flow: 'loan', note: reason });
  return d;
}

// Debtor pays from pocket first, then from their business till.
export function payDebt(w: World, d: Debt, amount: number) {
  const debtor = w.chars[d.debtor];
  const creditor = w.chars[d.creditor];
  let rest = amount;
  const fromCash = Math.min(debtor.cash, rest);
  debtor.cash -= fromCash;
  rest -= fromCash;
  if (rest > 0) {
    const b = ownerBiz(w, debtor.id);
    if (b) bizMove(w, b, -rest, 'debt', debtor.id);
  }
  earn(creditor, amount, 'loans');
  post(w, { from: debtor.id, to: creditor.id, amt: amount, flow: 'repay', note: d.reason });
  d.paid = (d.paid ?? 0) + amount;
  d.balance = Math.round(d.balance - amount);
  if (amount >= d.weeklyPayment || d.balance <= 0) d.missed = 0;
  if (d.balance <= 0) {
    d.status = 'paid';
    onDebtCleared(w, d);
    addFact(w, {
      kind: 'debt_paid',
      actor: debtor.id,
      victim: creditor.id,
      text: `${debtor.name} cleared his debt to ${creditor.name}.`,
      minor: true,
      cause: d.cause,
    });
  }
}

// ------------------------------------------------------------------- death

export function handleDeath(w: World, id: Id, o: { cause?: string; favoured?: Id } = {}) {
  const d = w.chars[id];
  d.alive = false;
  d.diedAt = w.now;
  goalsOnDeath(w, d); // a dead man's plans end with him
  for (const b of Object.values(w.biz)) {
    if (b.ownerId === id && b.open && !succeedOwner(w, b, d)) {
      b.open = false;
      addFact(w, {
        kind: 'business_failed',
        business: b.id,
        victim: id,
        text: `${b.name} shut its doors after ${d.name}'s death.`,
        minor: true,
        district: b.district,
      });
    }
    if (b.protection?.collectorId === id) delete b.protection;
  }
  for (const x of w.debts) if (x.status === 'active' && (x.debtor === id || x.creditor === id)) x.status = 'void';
  for (const q of w.disputes ?? []) if ((q.status === 'open' || q.status === 'violated') && (q.a === id || q.b === id)) { q.status = 'dropped'; q.history.push({ t: w.now, text: 'One of the two is gone. There is nobody left to argue with.' }); }
  const subs = Object.values(w.chars).filter((x) => x.alive && x.bossId === id);
  if (d.rank === 'boss' && d.familyId) {
    succeed(w, d.familyId, d, o.cause ?? 'death', { favoured: o.favoured });
  } else {
    for (const s of subs) s.bossId = d.bossId;
  }
  if (d.familyId) {
    const f = w.fam[d.familyId];
    if (f) { if (f.heir === id) delete f.heir; if (f.consigliere === id) delete f.consigliere; if (f.acting === id) delete f.acting; }
    repairHierarchy(w, d.familyId);
  }
}

// Whatever hung on a debt lets go of it when it is cleared: the jobs to collect it, the reminders, the grudge.
export function onDebtCleared(w: World, d: Debt) {
  for (const j of w.jobs) {
    if (j.debt !== d.id || (j.status !== 'offered' && j.status !== 'active')) continue;
    j.status = 'expired';
    j.notes = [...(j.notes ?? []), 'The debt was cleared.'];
  }
  for (const c of [w.chars[d.creditor], w.chars[d.debtor]]) {
    if (!c) continue;
    for (const m of c.memos) if (!m.done && m.ref && w.facts[m.ref]?.cause === d.cause && w.facts[m.ref]?.kind.startsWith('debt')) m.done = true;
  }
  const deb = w.chars[d.debtor], cre = w.chars[d.creditor];
  if (deb && cre) { rel(cre, deb.id).grudge = clamp(rel(cre, deb.id).grudge - 0.15); rel(cre, deb.id).trust = clamp(rel(cre, deb.id).trust + 0.05); }
  for (const e of w.enc) if (e.status === 'open' && e.data?.debt === d.id) e.status = 'lapsed';
}

// An event that described a situation which no longer exists. It stays in history; it stops being a live matter.
export function isResolved(w: World, f: Fact): boolean {
  const a = f.actor ? w.chars[f.actor] : undefined;
  const v = f.victim ? w.chars[f.victim] : undefined;
  switch (f.kind) {
    case 'loan':
    case 'debt_missed':
    case 'debt_default': {
      if (!a || !v) return false;
      return !w.debts.some((d) => d.status === 'active' && ((d.debtor === a.id && d.creditor === v.id) || (d.debtor === v.id && d.creditor === a.id)));
    }
    case 'shortfall': {
      if (!a || !v) return false;
      return a.books.arrears <= 0 && a.books.missed === 0 && !(v.books.flags[a.id]?.amt > 0);
    }
    case 'arrest': return !!a && a.jailedUntil <= w.now;
    case 'beating': return !!v && v.hurtUntil <= w.now && (w.disputes ?? []).some((d) => d.fact === f.id && d.status !== 'open' && d.status !== 'violated');
    case 'poach':
    case 'vandalism':
    case 'robbery': return (w.disputes ?? []).some((d) => d.fact === f.id && d.status !== 'open' && d.status !== 'violated');
    case 'protection_refused': { const b = f.business ? w.biz[f.business] : undefined; return !!b?.protection; }
    default: return false;
  }
}

export function recordCareer(w: World, c: Character | undefined, text: string, ok?: boolean) {
  if (!c) return;
  const k = (c.career ??= { done: 0, failed: 0, log: [] });
  if (ok === true) k.done++;
  if (ok === false) k.failed++;
  k.log.push({ t: w.now, text });
  if (k.log.length > 12) k.log.shift();
}
