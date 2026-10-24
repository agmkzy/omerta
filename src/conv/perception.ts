// Perception (spec §2.2): what one man believes, built for him alone. A man knows his own state truly; everything about others is
// belief with a basis. Decision code reads this, never the world.
import { ownerBiz, peek } from '../core';
import { temper, type Temper } from '../temper';
import { arch, type Arch } from '../voice';
import type { Character, Fact, Id, World } from '../types';
import { DAY } from '../types';
import type { Basis, Role } from './types';

// What a scene has established that the world does not record yet (introductions said aloud, claims heard, kin a fixture declares).
// In the full engine these are claims and knowledge records (spec §5); here they live on the session.
export interface Session {
  told: Record<Id, Record<Id, { family?: string; name?: string; basis: Basis }>>; // listener -> speaker -> what he has said of himself
  claims: { by: Id; to: Id; says: string; value?: string; honest: boolean }[];
  kin: Record<Id, { id: Id; role: string }[]>;
  asked: Record<string, number>;     // `${by}>${of}:${request}` -> times asked
  history: Record<string, string[]>; // `${a}>${b}` -> what has passed between them, as event keys
  // (Gate 1 fixtures only: a profile's temperament and manner set outright, so the five shopkeepers differ exactly as specified)
  temper: Record<Id, Partial<Temper>>;
  arch: Record<Id, Arch>;
}
export const newSession = (): Session => ({ told: {}, claims: [], kin: {}, asked: {}, history: {}, temper: {}, arch: {} });

export interface Identity { known: boolean; family?: string; rank?: string; name: string; basis: Basis[] }
export interface Arrangement { collector: string; family: string; fee: number; collectorId: Id }
export interface Perception {
  self: Character;
  at: number;
  temper: Temper;
  arch: Arch;
  // his own state, always true to him
  own: { cash: number; shop?: { name: string; income: number; distress: number; district: string; id: Id }; arrangement?: Arrangement; kin: { id: Id; role: string; name: string; inLife: boolean; family?: string }[] };
  // about others: belief
  identityOf(other: Character): Identity;
  feelingFor(other: Character): { trust: number; affection: number; grudge: number; fear: number; respect: number; known: number };
  streetPressure(): { n: number; basis: Basis[] };
  knownFacts(pred: (f: Fact) => boolean): Fact[];
  // what he is to an event, from his own knowledge of it: the world records a victim as having learnt of it like a witness, so
  // being the one it was done to (or the owner of the place it was done to) is checked first
  roleIn(f: Fact): Role;
  // particulars he can speak of, each from something he perceives; undefined when he has no basis for it (the line needing it is not used)
  particulars: Particulars;
}
export interface Particulars {
  shopNoun(bizId?: Id): string | undefined;          // what kind of place a shop is: its sign says so (public)
  shopNounOf(owner: Id): string | undefined;          // what kind of place another man's shop is (public)
  ownShopNoun(): string | undefined;
  protectedSince(): string | undefined;               // how long his own arrangement has run, from its record (his own)
  lastAt(kinds: string[], by?: Id): string | undefined; // when he last knew of such a thing at his place, from a fact he knows
  smallBuy(bizId?: Id): string | undefined;           // something small a customer would buy there (what the shop sells: public)
}
const NOUN: Record<string, string> = { grocer: 'grocery', barber: 'barber shop', cleaner: 'dry cleaner', deli: 'deli', cafe: 'café', newsstand: 'newsstand', restaurant: 'restaurant', bakery: 'bakery', funeral: 'funeral home', fish: 'fish market', club: 'social club', diner: 'diner', hardware: 'hardware store', billiards: 'pool hall', pawnshop: 'pawnshop', candy: 'candy store', photo: 'photo studio', tailor: 'tailor’s', jeweller: 'jeweller’s', florist: 'florist', butcher: 'butcher’s', bar: 'bar', pharmacy: 'pharmacy', shoes: 'shoe repair', garage: 'garage', laundromat: 'laundromat', casino: 'card room' };
const BUY: Record<string, string> = { grocer: 'a few things', bakery: 'a loaf', newsstand: 'the paper', cafe: 'a coffee', deli: 'a sandwich', candy: 'a bag of these', pharmacy: 'some aspirin', florist: 'a few of those', butcher: 'a pound of sausage', fish: 'a couple of those', bar: 'a beer', diner: 'a coffee to go', restaurant: 'a coffee', hardware: 'a box of nails', laundromat: 'change for the machines', cleaner: 'my shirts back', tailor: 'a collar stay', shoes: 'a tin of polish' };
const ago = (now: number, t: number) => { const d = Math.floor(now / DAY) - Math.floor(t / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : d < 14 ? 'last week' : d < 60 ? `${Math.round(d / 7)} weeks ago` : undefined; };
const howLong = (now: number, t: number) => { const d = Math.floor((now - t) / DAY); return d < 14 ? undefined : d < 60 ? `${Math.round(d / 7)} weeks` : d < 730 ? `${Math.round(d / 30)} months` : `${Math.round(d / 365)} years`; };

export function perceive(w: World, s: Session, c: Character): Perception {
  const b = ownerBiz(w, c.id);
  const fam = (id?: string | null) => (id ? w.fam[id]?.name : undefined);
  const arrangement = b?.protection ? (() => { const x = w.chars[b.protection!.collectorId]; return { collector: x?.name ?? 'someone', collectorId: b.protection!.collectorId, family: fam(b.protection!.familyId) ?? '', fee: b.protection!.fee }; })() : undefined;
  const kin = (s.kin[c.id] ?? []).map((k) => { const x = w.chars[k.id]; return { id: k.id, role: k.role, name: x?.name ?? '', inLife: !!x && x.rank !== 'civilian', family: fam(x?.familyId) }; });
  const known = (pred: (f: Fact) => boolean) => Object.keys(c.known).map((id) => w.facts[id]).filter((f): f is Fact => !!f && pred(f));
  return {
    self: c, at: w.now, temper: { ...temper(c), ...(s.temper[c.id] ?? {}) }, arch: s.arch[c.id] ?? arch(c),
    own: { cash: c.cash, shop: b ? { name: b.name, income: b.income, distress: b.distress, district: b.district, id: b.id } : undefined, arrangement, kin },
    identityOf(o) {
      // what he believes o is: what o has told him, what he has seen of him in the family, or nothing
      const said = s.told[c.id]?.[o.id];
      if (said) return { known: !!said.family, family: said.family, name: said.name ?? o.name, basis: [said.basis] };
      if (c.familyId && c.familyId === o.familyId && c.rank !== 'civilian') return { known: true, family: fam(o.familyId), rank: o.rank, name: o.name, basis: [{ kind: 'seen', ref: 'same family' }] };
      if ((c.rels[o.id]?.known ?? 0) >= 0.3) return { known: !!o.familyId, family: fam(o.familyId), rank: o.rank, name: o.name, basis: [{ kind: 'seen', ref: 'knows him' }] };
      return { known: false, name: o.name, basis: [] };
    },
    feelingFor(o) { const r = peek(c, o.id); return { trust: r.trust, affection: r.affection, grudge: r.grudge, fear: r.fear ?? 0, respect: r.respect, known: r.known ?? 0 }; },
    streetPressure() {
      const district = b?.district ?? c.district;
      const fs = known((f) => ['vandalism', 'protection_started', 'protection_refused', 'beating', 'threat'].includes(f.kind) && f.district === district && w.now - f.t < 21 * DAY);
      return { n: fs.length, basis: fs.map((f) => ({ kind: (c.known[f.id].from === 'witness' ? 'seen' : 'told') as Basis['kind'], ref: f.id })) };
    },
    knownFacts: known,
    roleIn(f) {
      if (f.actor === c.id) return 'actor';
      if (f.victim === c.id || (f.business && w.biz[f.business]?.ownerId === c.id)) return 'victim';
      const k = c.known[f.id];
      if (!k) return 'none';
      return k.from === 'witness' || k.from === 'self' ? 'witness' : 'hearsay';
    },
    particulars: {
      shopNoun: (id) => (id && w.biz[id] ? NOUN[w.biz[id].kind] : undefined),
      shopNounOf: (id) => { const x = ownerBiz(w, id); return x ? NOUN[x.kind] : undefined; },
      ownShopNoun: () => (b ? NOUN[b.kind] : undefined),
      protectedSince: () => (b?.protection?.since !== undefined ? howLong(w.now, b.protection.since) : undefined),
      lastAt: (kinds, by) => { const fs = known((f) => kinds.includes(f.kind) && !!b && (f.business === b.id || f.victim === c.id) && (!by || f.actor === by || w.chars[f.actor ?? '']?.bossId === by)).sort((x, y) => y.t - x.t); return fs[0] ? ago(w.now, fs[0].t) : undefined; },
      smallBuy: (id) => (id && w.biz[id] ? BUY[w.biz[id].kind] : undefined),
    },
  };
}
