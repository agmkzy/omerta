// Perception (spec §2.2): what one man believes, built for him alone. A man knows his own state truly; everything about others is
// belief with a basis. Decision code reads this, never the world.
import { ownerBiz, peek } from '../core';
import { temper, type Temper } from '../temper';
import { arch, type Arch } from '../voice';
import type { Character, Fact, Id, World } from '../types';
import { DAY } from '../types';
import type { Basis } from './types';

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
}

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
  };
}
