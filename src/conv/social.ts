// The conversation layer's records in the world (spec §6): requests, agreements, obligations and the acts that keep or break them.
// Plain serialisable data on World.social (optional: a world without it has none, and saves from before it load as they always did).
// Bounded: closed obligations and agreements are kept 180 days, acts 120, with rings as a ceiling (spec §12.1).
import type { Id, World } from '../types';
import { DAY } from '../types';
import type { Store } from './obligations';

export interface Agreement { id: Id; t: number; parties: Id[]; terms: string; madeIn?: Id; witnesses: Id[]; obligations: Id[] }
export type Wants = 'intervene' | 'order';
// A request (spec §6.1): one man asking another for something, on someone's behalf or his own, serving an obligation or not. Where
// the world already has an ask for it (asks.ts), the request rides on it (`sit`), and the ask's own lifecycle carries it.
export interface Request {
  id: Id; t: number; by: Id; of: Id; wants: Wants; about: string;
  for?: Id; against?: Id; biz?: Id; fact?: Id;
  parent?: Id;                 // the obligation it serves
  sit?: Id;                    // the world's ask it rides on
  rode?: { ak?: string; out?: string }; // what that ask was and how it ended (the world sweeps closed asks; the request keeps this)
  status: 'open' | 'agreed' | 'refused' | 'referred' | 'lapsed' | 'done';
  next?: number;               // when the man asked answers (NPC to NPC)
  hist: { t: number; event: string }[];
}
export interface Social extends Store {
  agreements: Agreement[]; requests: Request[];
  // Gate 2b (all optional: a store from Gate 2a loads as it is)
  said?: import('./minds').Said[]; held?: import('./minds').Held[]; revisions?: import('./minds').Revision[]; judged?: import('./minds').Judged[];
  pursuits?: import('./pursuits').Pursuit[];
}
export const social = (w: World): Social => (w.social ??= { obs: [], log: [], n: 0, agreements: [], requests: [] });
export const sid = (s: Social, p: string) => p + ++s.n;
export function note(r: Request, t: number, event: string) { r.hist.push({ t, event }); if (r.hist.length > 4) r.hist.splice(0, r.hist.length - 4); }

// keep it small: what is closed and old goes; anything an open obligation rests on stays
export function prune(w: World) {
  const s = w.social;
  if (!s) return;
  const old = (t?: number) => t !== undefined && w.now - t > 180 * DAY;
  s.obs = s.obs.filter((o) => o.status === 'pending' || !old(o.settled));
  if (s.obs.length > 400) { const open = s.obs.filter((o) => o.status === 'pending'), closed = s.obs.filter((o) => o.status !== 'pending'); s.obs = [...closed.slice(-200), ...open]; }
  const live = new Set(s.obs.map((o) => o.agreement).filter(Boolean));
  s.agreements = s.agreements.filter((a) => live.has(a.id) || !old(a.t)).slice(-200);
  // (a finished request is kept 60 days, or while an obligation that came of it is open: what was asked, and who said no, is what
  // later decisions rest on)
  const madeIn = new Set(s.agreements.filter((a) => s.obs.some((o) => o.status === 'pending' && a.obligations.includes(o.id))).map((a) => a.madeIn));
  s.requests = s.requests.filter((r) => r.status === 'open' || madeIn.has(r.id) || w.now - r.t <= 60 * DAY).slice(-100);
  // beliefs and judgements: kept while what they are about is still on record
  const obs = new Set(s.obs.map((o) => o.id));
  if (s.judged) s.judged = s.judged.filter((j) => obs.has(j.ob));
  if (s.held) s.held = s.held.filter((h) => !h.subject.startsWith('ob:') || obs.has(h.subject.slice(3))).slice(-300);
  if (s.said) s.said = s.said.filter((x) => w.now - x.t <= 90 * DAY).slice(-150);
  if (s.revisions) s.revisions = s.revisions.filter((x) => w.now - x.t <= 90 * DAY).slice(-100);
  // (acts within the window of any open obligation are what keep or break it; beyond that, 90 days)
  const since = Math.min(w.now - 90 * DAY, ...s.obs.filter((o) => o.status === 'pending').map((o) => o.from));
  s.log = s.log.filter((a) => a.t >= since).slice(-250);
}

// Is he bound not to touch this man or his place? An open restraint he means to keep (an order he has accepted, a promise to stay
// away). Read by the NPC action scorer (actions.ts): a man who has decided to keep his word does not go looking for trouble there.
export function restrainedFrom(w: World, actor: Id, target: Id, biz?: Id): boolean {
  return restraintsOn(w, actor, target, biz).some((o) => o.intends !== 'break');
}
// the open restraints (orders accepted, promises to stay away) that bind him from this man or his place
export function restraintsOn(w: World, actor: Id, target: Id, biz?: Id) {
  const s = w.social;
  if (!s) return [];
  return s.obs.filter((o) => o.status === 'pending' && o.type === 'restraint' && o.obligor === actor && o.spec.kind === 'noHostility' && (o.spec.target === target || (!!biz && o.spec.biz === biz)));
}
