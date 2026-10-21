// V75: situations. One shared record for anything going on between people that has a cause, a state, a history and a way out.
// A situation starts from something real in the world (a business behind on its payments, a gap in someone's numbers, a man
// passed over for promotion), develops over days and weeks through what the people in it decide, and ends in a way that
// leaves traces: money moved, a share taken, a trust broken, a man cut loose. The player may be in it, may be asked to
// settle it, or may never hear of it. What anyone knows comes only from facts they witnessed or were told (core.addFact);
// what the simulation knows to be true (`truth`) is never shown to anybody.
import { discipline, influence } from './books';
import { addFact, clamp, createDebt, ownerBiz, payDebt, rel } from './core';
import { addStake, clearArrears, evidence, giveTime, seizeShare, transferBusiness } from './econ';
import { LADDER, leaveCrew } from './rank';
import { begin as beginGoal, goalsOf, priceOf } from './goals';
import { addEnc } from './encounters';
import { Business, Character, DAY, Debt, Enc, Fact, FactKind, Id, Situation, SitKind, WEEK, World } from './types';

export const SIT = { on: true, cap: { open: 30, asks: 45, climbs: 10, plans: 40, own: { ask: 45, climb: 10, rivalry: 14, arrest: 10, revenge: 12 } as Partial<Record<SitKind, number>>, closedOwn: 40, closed: 60, hist: 8, claims: 3, cons: 5 } };
const first = (c: Character) => c.name.split(' ')[0];
const P = (w: World) => w.chars[w.playerId ?? ''];
export const isOpen = (s: Situation) => s.stage !== 'resolved';
// what counts as the player having heard of something serious, among the V89 kinds
const SERIOUS = new Set<string>(['beating', 'murder', 'arrest', 'informant', 'raid']);
const sits = (w: World) => (w.situations ??= []);
const pace = (w: World) => (w.sitpace ??= { lastMajor: -1e9, lastVisible: -1e9, weekVis: 0, wk: 0 });
export const sitsFor = (w: World, id: Id) => sits(w).filter((s) => isOpen(s) && (s.who === id || (s.parties ?? []).some((p) => p.id === id)));
const live = (w: World, id?: Id | null) => { const c = id ? w.chars[id] : undefined; return c?.alive ? c : undefined; };
const rk = (c: Character) => LADDER.indexOf(c.rank);
const bump = (w: World, k: string, n = 1) => { const st = (pace(w).stats ??= {}); st[k] = (st[k] ?? 0) + n; };

// ---------------------------------------------------------------- lifecycle

// Serious matters do not pile up: only so many at once, and not hard on the heels of the last one that reached the player.
function allowMajor(w: World, touchesPlayer: boolean): boolean {
  const sp = pace(w);
  if (sits(w).filter((s) => isOpen(s) && (s.sev ?? 0) >= 0.5 && !(s.kind && SIT.cap.own[s.kind] !== undefined)).length >= 5) return false;
  if (w.now - sp.lastMajor < 3 * DAY) return false;
  if (touchesPlayer && w.now - sp.lastVisible < 7 * DAY) return false;
  return true;
}
interface Init { cause: string; parties: { id: Id; role: string }[]; sev: number; phase: string; next: number; orgs?: Id[]; biz?: Id; truth?: string; amt?: number; m?: Situation['m']; link?: Situation['link'] }
export function spawn(w: World, kind: SitKind, key: string, who: Id, o: Init): Situation | undefined {
  if (!SIT.on) return undefined;
  const l = sits(w);
  if (l.some((s) => s.key === key && isOpen(s))) return undefined;
  const mirror = kind === 'dispute' || kind === 'crew'; // mirrors of records that exist elsewhere follow their source, not a cooling-off period
  if (!mirror && (w.sitcool?.[key] ?? 0) > w.now) return undefined;
  // asks (V89) are many and small; they have their own ceiling and do not crowd out the other kinds
  // (ambitions too: a man wanting to rise is common, and is counted among his kind)
  // (V89: so do the matters that grow from events, bad blood and ambition; none of them crowds out the V75 kinds)
  const own = (k?: SitKind) => !!k && SIT.cap.own[k] !== undefined;
  // (whatever the player himself starts always has room: the ceilings are for the world's own business)
  const mine = o.parties.some((x) => x.id === w.playerId) && who === w.playerId;
  // (an ask made on an NPC's plan (goals.ts) has a ceiling of its own: plans are already bounded per man, and the world's other asks
  // must not crowd them out, nor they the others)
  const plan = kind === 'ask' && !!o.m?.goal;
  if (plan) { if (l.filter((x) => isOpen(x) && x.kind === 'ask' && x.m?.goal).length >= SIT.cap.plans) return undefined; }
  else if (own(kind) ? !mine && l.filter((x) => isOpen(x) && x.kind === kind && !(x.kind === 'ask' && x.m?.goal)).length >= SIT.cap.own[kind]! : !mirror && l.filter((x) => isOpen(x) && x.kind !== 'dispute' && x.kind !== 'crew' && !own(x.kind)).length >= SIT.cap.open) return undefined;
  const major = o.sev >= 0.5 && !own(kind); // (the V89 kinds are paced by their own ceilings, not by the V75 pacing)
  if (major && !allowMajor(w, o.parties.some((p) => p.id === w.playerId))) return undefined;
  const s: Situation = { id: 's' + w.nextId++, kind, who, since: w.now, weeks: 0, stage: 'brewing', cause: o.cause, knows: false, told: false, parties: o.parties, phase: o.phase, sev: Math.round(o.sev * 100) / 100, next: o.next, key, hist: [], k: {}, claims: [], cons: [] };
  if (o.orgs?.length) s.orgs = o.orgs;
  if (o.biz) s.biz = o.biz;
  if (o.truth) s.truth = o.truth;
  if (o.amt !== undefined) s.amt = o.amt;
  if (o.m) s.m = o.m;
  if (o.link) s.link = o.link;
  if (major) pace(w).lastMajor = w.now;
  l.push(s);
  bump(w, 'start.' + kind);
  // keep the record bounded: closed ones go first
  // (asks are many and short; they are pruned among themselves, so they never push older situations out of the record)
  const drop = new Set<Id>();
  const ownK = (x: Situation) => !!x.kind && SIT.cap.own[x.kind] !== undefined;
  for (const [pool, cap] of [[l.filter((x) => !isOpen(x) && x.kind === 'ask'), 15], [l.filter((x) => !isOpen(x) && ownK(x) && x.kind !== 'ask'), SIT.cap.closedOwn], [l.filter((x) => !isOpen(x) && !ownK(x)), SIT.cap.closed]] as [Situation[], number][])
    if (pool.length > cap) for (const x of pool.slice(0, pool.length - cap)) drop.add(x.id);
  if (drop.size) w.situations = l.filter((x) => !drop.has(x.id));
  return s;
}
export function know(w: World, s: Situation, id: Id, l: 1 | 2, via: string) {
  const k = (s.k ??= {});
  if (!k[id] || k[id].l < l) k[id] = { l, via, t: w.now };
}
// Something happens that people can know about. It becomes a fact tagged with the situation; only those who were there (or are told) learn it.
export function tell(w: World, s: Situation, text: string, o: { kind?: FactKind; actor?: Id; victim?: Id; witnesses?: Id[]; broadcast?: Id[]; minor?: boolean } = {}): Fact {
  const f = addFact(w, { kind: o.kind ?? 'rumour', actor: o.actor, victim: o.victim, business: s.biz, story: 'sit:' + s.id, minor: o.minor ?? false, text }, { witnesses: o.witnesses ?? [], broadcast: o.broadcast });
  for (const id of new Set([...(o.witnesses ?? []), ...(o.broadcast ?? []), ...(o.actor ? [o.actor] : []), ...(o.victim ? [o.victim] : [])])) if (w.chars[id]?.known[f.id]) know(w, s, id, 2, 'witness');
  (s.hist ??= []).push({ t: w.now, text });
  if (s.hist.length > SIT.cap.hist) s.hist.splice(0, s.hist.length - SIT.cap.hist);
  const p = P(w);
  // (the small doings of the V89 kinds, a slight or a word in an ear, do not count as the player having heard of something serious)
  const small = !!s.kind && SIT.cap.own[s.kind] !== undefined && (f.minor || !SERIOUS.has(f.kind));
  if (p?.known[f.id]) { s.knows = true; if (!small) { const sp = pace(w); sp.weekVis++; sp.lastVisible = w.now; } }
  return f;
}
export function claim(w: World, s: Situation, by: Id, text: string, honest: boolean) {
  const c = (s.claims ??= []);
  c.push({ by, text, honest, t: w.now });
  if (c.length > SIT.cap.claims) c.splice(0, c.length - SIT.cap.claims);
}
export function closeSit(w: World, s: Situation, out: string, cons: string[] = [], coolWeeks = 8) {
  if (!isOpen(s)) return;
  s.stage = 'resolved'; s.resolvedAt = w.now; s.how = 'alone'; s.out = out; s.phase = 'closed';
  s.cons = [...(s.cons ?? []), ...cons].slice(-SIT.cap.cons);
  delete s.ask; delete s.next;
  if (s.key) (w.sitcool ??= {})[s.key] = w.now + coolWeeks * WEEK;
  // a settled matter between other men keeps its story, not its private workings (the save stays small)
  if (s.kind === 'ask' && !(s.parties ?? []).some((x) => x.id === w.playerId)) { delete s.st; delete s.k; delete s.claims; }
  // V89: a matter opened inside a larger one (an ask for permission inside a revenge, say) reports back to it, and the larger one
  // moves on at its next step with the answer in hand
  const par = s.m?.parent ? sits(w).find((x) => x.id === s.m!.parent) : undefined;
  if (par && isOpen(par)) { par.m = { ...(par.m ?? {}), ['child:' + (s.ak ?? s.kind)]: out }; par.next = Math.min(par.next ?? w.now + DAY, w.now + DAY); }
  bump(w, 'end.' + (s.kind ?? 'x')); bump(w, 'out.' + (s.kind ?? 'x') + '.' + out);
}
const phase = (s: Situation, ph: string, days: number, w: World) => { s.phase = ph; s.next = w.now + Math.round(days * DAY); if (s.stage === 'brewing') s.stage = 'handling'; };

// ---------------------------------------------------------------- who sits above whom

function chainUp(w: World, c: Character): Character[] {
  const out: Character[] = [];
  let x: Character | undefined = c;
  for (let i = 0; i < 6 && x?.bossId; i++) { x = live(w, x.bossId); if (!x || out.includes(x)) break; out.push(x); }
  return out;
}
// The lowest man both answer to: the one who would be asked to settle it.
export function commonSuper(w: World, a: Character, b: Character): Character | undefined {
  const ca = [a, ...chainUp(w, a)], cb = [b, ...chainUp(w, b)];
  return ca.find((x) => cb.includes(x) && x.id !== a.id && x.id !== b.id) ?? undefined;
}

// ---------------------------------------------------------------- sit-downs: several people, each with a stake, one man who decides

interface Kit {
  opts: string[];
  label: Record<string, string>;
  util: (w: World, s: Situation, id: Id, code: string) => number; // how much this person likes this outcome (-1..1)
  apply: (w: World, s: Situation, code: string, chair: Character) => string; // makes it so; returns what is said
}
const KITS: Partial<Record<SitKind, Kit>> = {};
export const kitOf = (s: Situation) => (s.kind ? KITS[s.kind] : undefined);
export const attendees = (s: Situation): Id[] => [...new Set([...(s.meet?.parts ?? []), ...(s.parties ?? []).map((p) => p.id)])];

export function stanceOf(w: World, s: Situation, id: Id): { want: string; flex: number } {
  const kit = kitOf(s)!, c = w.chars[id];
  let want = kit.opts[0], best = -9;
  for (const o of kit.opts) { const u = kit.util(w, s, id, o); if (u > best) { best = u; want = o; } }
  const flex = c ? clamp(0.18 + (1 - c.traits.ambition) * 0.14 + c.traits.caution * 0.1 + (1 - c.traits.violence) * 0.06, 0.1, 0.5) : 0.2;
  return { want, flex };
}
const weightOf = (w: World, s: Situation, id: Id) => {
  const c = w.chars[id];
  let wt = 0.7 + (c ? influence(w, c) / 100 : 0) + Number(s.m?.['sup:' + id] ?? 0);
  // the more certain the case against a man, the less his own preference counts at the table
  if (s.kind === 'skim' && (s.parties ?? []).some((p) => p.role === 'accused' && p.id === id)) wt *= 1 - clamp(Number(s.m?.cert ?? 0) / 150, 0, 0.7);
  return wt;
};
// What the man in the chair would settle on, being himself and knowing only what he knows.
export function chairPick(w: World, s: Situation, chair: Character): string {
  const kit = kitOf(s)!;
  const ids = attendees(s).filter((id) => id !== chair.id && live(w, id));
  let pick = kit.opts[0], best = -1e9;
  for (const o of kit.opts) {
    // a chair who is himself a party (the boss whose money it is) decides mostly for himself; a neutral one weighs the table
    let sc = ((s.parties ?? []).some((p) => p.id === chair.id) ? 3 : 1) * kit.util(w, s, chair.id, o);
    for (const id of ids) {
      const st = stanceOf(w, s, id), u = kit.util(w, s, id, o), uw = kit.util(w, s, id, st.want);
      sc += weightOf(w, s, id) * u - 0.5 * weightOf(w, s, id) * Math.max(0, uw - u - st.flex);
    }
    sc += (chair.traits.violence - 0.4) * (o === 'punish' || o === 'enforce' ? 0.3 : 0) + w.rng.range(-0.05, 0.05);
    if (sc > best) { best = sc; pick = o; }
  }
  return pick;
}
export interface Verdict { code: string; accepted: Id[]; opposed: Id[]; said: string }
export function hold(w: World, s: Situation, chair: Character, code: string): Verdict {
  const kit = kitOf(s)!;
  const accepted: Id[] = [], opposed: Id[] = [];
  const ids = attendees(s).filter((id) => id !== chair.id && live(w, id));
  for (const id of ids) {
    const st = stanceOf(w, s, id);
    (kit.util(w, s, id, code) >= kit.util(w, s, id, st.want) - st.flex ? accepted : opposed).push(id);
  }
  const said = kit.apply(w, s, code, chair);
  // everyone present is affected by what was decided
  for (const id of ids) {
    const c = w.chars[id], r = rel(c, chair.id);
    const got = kit.util(w, s, id, code) >= kit.util(w, s, id, stanceOf(w, s, id).want) - 0.02;
    if (opposed.includes(id)) { r.respect = clamp(r.respect - 0.05); r.trust = clamp(r.trust - 0.03); for (const j of ids) if (j !== id && kit.util(w, s, j, code) > kit.util(w, s, j, stanceOf(w, s, j).want) - 0.05) rel(c, j).grudge = clamp(rel(c, j).grudge + 0.06); }
    else { r.trust = clamp(r.trust + 0.02); if (got) r.respect = clamp(r.respect + 0.03); }
    if (opposed.includes(id) && r.respect < 0.35 && c.traits.ambition > 0.55) s.cons = [...(s.cons ?? []), `${first(c)} did not accept it`].slice(-SIT.cap.cons);
  }
  s.meet = { chair: chair.id, parts: ids, pos: Object.fromEntries(ids.map((id) => [id, stanceOf(w, s, id).want])), held: w.now };
  tell(w, s, said, { kind: 'sitdown', actor: chair.id, witnesses: ids });
  bump(w, 'sitdown');
  return { code, accepted, opposed, said };
}
// Nobody asks the player: an NPC chair settles it. Returns false if there is nobody to chair.
function settleByNpc(w: World, s: Situation, chair: Character): boolean {
  if (!kitOf(s)) return false;
  hold(w, s, chair, chairPick(w, s, chair));
  return true;
}

// If the man who would chair it is the player, he is asked (once, with a deadline); otherwise the senior man settles it himself.
function convene(w: World, s: Situation, chair: Character | undefined, back: Character | undefined): 'asked' | 'held' | 'none' {
  const p = P(w);
  const boss = chair ?? back;
  if (!boss) return 'none';
  if (boss.id === p?.id) {
    if (w.enc.some((e) => e.status === 'open' && e.data?.what === 'sit75') || (p.cooldown.sit75 ?? 0) > w.now) { return 'none'; }
    p.cooldown.sit75 = w.now + 10 * DAY;
    const e = sitdownEnc(w, s, p);
    s.stage = 'asking'; s.ask = e.id; s.next = w.now + 8 * DAY; s.phase = 'asked';
    return 'asked';
  }
  settleByNpc(w, s, boss);
  return 'held';
}

// ---------------------------------------------------------------- the player at a sit-down

export function describeStance(w: World, s: Situation, id: Id): string {
  const c = w.chars[id], kit = kitOf(s)!;
  return `${c.name} would choose: “${kit.label[stanceOf(w, s, id).want] ?? stanceOf(w, s, id).want}”.`;
}
function sitdownEnc(w: World, s: Situation, p: Character): Enc {
  const kit = kitOf(s)!;
  const names = (s.parties ?? []).filter((x) => x.id !== p.id).map((x) => w.chars[x.id]?.name).filter(Boolean).join(' and ');
  return addEnc(w, {
    kind: 'crew', from: (s.parties ?? [])[0]?.id ?? null, title: `They want you to settle it: ${titleOf(w, s)}`, days: 8,
    lines: [`${names} have brought it to you.`, s.cause.replace(/^./, (m) => m.toUpperCase()) + '.', 'Nobody senior to you is going to decide this. If you don’t, they will find their own way.'],
    opts: [...kit.opts.map((o) => ({ code: 'p:' + o, label: kit.label[o] ?? o, hint: hintFor(w, s, o) })), { code: 'listen', label: 'Hear them out first', hint: 'See where each of them stands.' }, { code: 'pass', label: 'Tell them to sort it out themselves', hint: 'They will. You may not like how.' }],
    data: { what: 'sit75', sid: s.id },
  });
}
function hintFor(w: World, s: Situation, code: string): string {
  const kit = kitOf(s)!;
  const ids = attendees(s).filter((id) => live(w, id) && id !== w.playerId);
  const pleased = ids.filter((id) => kit.util(w, s, id, code) >= kit.util(w, s, id, stanceOf(w, s, id).want) - stanceOf(w, s, id).flex).map((id) => w.chars[id].name);
  const sour = ids.filter((id) => !pleased.includes(w.chars[id].name)).map((id) => w.chars[id].name);
  return pleased.length ? `${pleased.join(', ')} can live with it.${sour.length ? ` ${sour.join(', ')} won’t.` : ''}` : 'Nobody will like it.';
}
export function titleOf(w: World, s: Situation): string {
  const [a, b] = (s.parties ?? []).map((p) => w.chars[p.id]);
  const bz = s.biz ? w.biz[s.biz] : undefined;
  switch (s.kind) {
    case 'skim': return `${a ? a.name : 'He'} and ${b ? b.name : 'him'}: the numbers`;
    case 'tribute': return bz ? `${bz.name}: behind on payments` : 'Behind on payments';
    case 'debt': return `${a ? a.name : 'He'} and ${b ? b.name : 'him'}: a debt`;
    case 'partner': return bz ? `${bz.name}: the partnership` : 'A partnership';
    case 'grudge': return `${b ? b.name : 'He'}: passed over`;
    case 'intel': return 'Something somebody knows';
    default: return s.cause;
  }
}
export function sitChoose75(w: World, p: Character, e: Enc, code: string): string[] | undefined {
  if (e.data?.what !== 'sit75') return undefined;
  const s = sits(w).find((x) => x.id === e.data?.sid);
  if (!s || !isOpen(s)) { e.status = 'done'; return ['It has been settled without you.']; }
  const kit = kitOf(s)!;
  if (code === 'listen') {
    e.data = { ...(e.data ?? {}), hold: 1 };
    const lines = attendees(s).filter((id) => live(w, id) && id !== p.id).map((id) => describeStance(w, s, id));
    return [...lines, 'That is what they will say to your face. What they think is another matter.'];
  }
  delete e.data!.hold; e.status = 'done'; delete s.ask;
  if (code === 'pass') {
    s.m = { ...(s.m ?? {}), passed: 1 };
    const sup = chainUp(w, p)[0];
    const alt = sup ?? (s.parties ?? []).map((x) => w.chars[x.id]).filter((c) => c?.alive).sort((x, y) => rk(y) - rk(x))[0];
    if (alt) settleByNpc(w, s, alt);
    return ['You tell them to sort it out. They go to someone else.', ...(s.hist ?? []).slice(-1).map((h) => h.text)];
  }
  const pick = code.replace(/^p:/, '');
  const v = hold(w, s, p, pick);
  p.standing = clamp(p.standing + (v.opposed.length ? 0 : 1), 0, 100);
  return [v.said, v.opposed.length ? `${v.opposed.map((id) => first(w.chars[id])).join(', ')} did not like it.` : 'Everyone at the table can live with it.'];
}

// ---------------------------------------------------------------- SKIM: a gap in the numbers

// Called by the books when a boss notices a shortfall. Returns true if a situation now owns what happens next.
export function skimNoticed(w: World, boss: Character, c: Character, fl: { amt: number; n: number }, factId: Id): boolean {
  if (!SIT.on || boss.isPlayer || c.isPlayer) return false;
  const key = `skim:${boss.id}:${c.id}`;
  const open = sits(w).find((s) => s.key === key && isOpen(s));
  if (open) { // new evidence on a matter already being looked at
    open.amt = Math.round(fl.amt); open.m = { ...(open.m ?? {}), cert: Math.min(100, Number(open.m?.cert ?? 0) + 10) };
    return true;
  }
  const guilty = !!(c.books.skim || c.books.hide);
  const s = spawn(w, 'skim', key, c.id, {
    cause: `${boss.name} has noticed ${c.name}’s numbers don’t add up`, parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }],
    sev: clamp(0.3 + fl.amt / 700, 0.3, 0.85), phase: 'noticed', next: w.now + 4 * DAY, orgs: c.familyId ? [c.familyId] : [], truth: guilty ? 'guilty' : 'innocent', amt: Math.round(fl.amt), m: { cert: 25, g: 0 },
  });
  if (!s) return false;
  const f = w.facts[factId];
  if (f) { f.story = 'sit:' + s.id; (s.hist ??= []).push({ t: w.now, text: f.text }); }
  know(w, s, boss.id, 1, 'numbers'); know(w, s, c.id, 2, 'self');
  s.stage = 'handling';
  return true;
}
const skimUtil = (w: World, s: Situation, id: Id, code: string): number => {
  const boss = w.chars[(s.parties ?? []).find((p) => p.role === 'boss')!.id], c = w.chars[(s.parties ?? []).find((p) => p.role === 'accused')!.id];
  const g = clamp(Number(s.m?.cert ?? 30) / 100, 0, 1), guilty = s.truth === 'guilty';
  if (id === boss.id) {
    const value = clamp(c.lifetimeKick / 8000, 0, 0.4);
    return code === 'repay' ? 0.35 + 0.4 * g : code === 'punish' ? 0.5 * g - 0.25 * (1 - g) + 0.4 * (boss.traits.violence - 0.3) + clamp((s.amt ?? 0) / 800, 0, 0.4) - 0.1 : code === 'overlook' ? 0.25 - 0.5 * g + value : 0.25 * g - 0.35 - value * 0.5;
  }
  if (id === c.id) {
    return guilty ? ({ repay: 0.15, punish: -0.8, overlook: 0.9, expel: -0.6 } as Record<string, number>)[code] ?? 0 : ({ repay: -0.4, punish: -0.9, overlook: 0.4, expel: -0.85 } as Record<string, number>)[code] ?? 0;
  }
  const grudge = rel(w.chars[id], c.id).grudge;
  return grudge > 0.15 ? ({ repay: 0.1, punish: 0.4, overlook: -0.4, expel: 0.5 } as Record<string, number>)[code] ?? 0 : ({ repay: 0.1, punish: -0.1, overlook: 0.1, expel: -0.2 } as Record<string, number>)[code] ?? 0;
};
KITS.skim = {
  opts: ['repay', 'punish', 'overlook', 'expel'],
  label: { repay: 'Make it right and put it behind them', punish: 'Punish him', overlook: 'Let it go', expel: 'Cut him loose' },
  util: skimUtil,
  apply: (w, s, code, chair) => {
    const c = w.chars[(s.parties ?? []).find((p) => p.role === 'accused')!.id];
    const boss = chair, amt = s.amt ?? 0, guilty = s.truth === 'guilty';
    if (guilty && s.m?.vouched && P(w) && P(w).id !== boss.id) { P(w).standing = clamp(P(w).standing - 3, 0, 100); rel(boss, P(w).id).trust = clamp(rel(boss, P(w).id).trust - 0.1); s.cons = [...(s.cons ?? []), 'the man you vouched for was guilty'].slice(-SIT.cap.cons); }
    if (code === 'repay') {
      c.books.arrears += guilty ? amt : Math.round(amt * 0.5);
      c.kickRate = Math.min(0.3, c.kickRate + 0.02);
      rel(c, boss.id).trust = clamp(rel(c, boss.id).trust - 0.05);
      closeSit(w, s, 'repay', guilty ? [`${first(c)} made it up`] : [`${first(c)} paid for a gap that was not his doing`], 8);
      if (!guilty) rel(c, boss.id).grudge = clamp(rel(c, boss.id).grudge + 0.1);
      return `${boss.name} settled it. ${c.name} makes up the difference and passes up a little more.`;
    }
    if (code === 'punish') {
      discipline(w, boss, c, 'sit:' + s.id, amt);
      closeSit(w, s, 'punish', guilty ? [] : [`${first(c)} was punished for something he did not do`], 12);
      if (!guilty) { rel(c, boss.id).grudge = clamp(rel(c, boss.id).grudge + 0.25); c.want = { kind: 'independent', since: w.now, why: 'was punished unfairly' }; }
      return `${boss.name} punished ${c.name}.`;
    }
    if (code === 'expel') {
      leaveCrew(w, c);
      rel(c, boss.id).trust = 0; rel(c, boss.id).grudge = clamp(rel(c, boss.id).grudge + 0.3);
      closeSit(w, s, 'expel', [`${first(c)} no longer answers to ${first(boss)}`], 16);
      return `${boss.name} cut ${c.name} loose.`;
    }
    closeSit(w, s, 'overlook', guilty ? ['the money was never recovered'] : [], 6);
    return `${boss.name} decided to let it go.`;
  },
};
function skimStep(w: World, s: Situation) {
  const boss = live(w, (s.parties ?? []).find((p) => p.role === 'boss')?.id), c = live(w, (s.parties ?? []).find((p) => p.role === 'accused')?.id);
  if (!boss || !c) return closeSit(w, s, 'gone');
  if (c.familyId !== boss.familyId || c.bossId !== boss.id && !chainUp(w, c).includes(boss)) return closeSit(w, s, 'moved');
  const guilty = s.truth === 'guilty';
  const m = (s.m ??= {});
  const cert = () => Number(m.cert ?? 0);
  if (s.phase === 'noticed') { return phase(s, 'explain', 3 + w.rng.int(0, 3), w); }
  if (s.phase === 'explain') {
    const lie = guilty && w.rng.chance(clamp(0.5 + c.traits.caution * 0.3 - c.traits.courage * 0.2, 0.2, 0.85));
    const owns = guilty && !lie;
    const cause = c.problem ? ({ gambling: 'a bad run at the tables', debt: 'money he owes', family: 'trouble at home', drink: 'a rough few weeks', house: 'the house', resentment: 'a bad month', woman: 'a woman' } as Record<string, string>)[c.problem.kind] ?? 'a bad month' : 'a slow few weeks';
    const text = owns ? `${c.name} told ${boss.name} he fell short and would make it up.` : `${c.name} told ${boss.name} it was ${cause}.`;
    claim(w, s, c.id, text, !lie);
    tell(w, s, text, { actor: c.id, victim: boss.id });
    if (owns) { m.cert = 60; return phase(s, 'confront', 2, w); }
    // does he believe it? A man he trusts, with a trade that really did dip, is believed; a careful boss is harder to convince.
    const plaus = guilty ? 0.3 : 0.7;
    const p = clamp(plaus * (0.5 + rel(boss, c.id).trust * 0.7) * (1 - boss.traits.caution * 0.35), 0.05, 0.85);
    if (w.rng.chance(p)) {
      closeSit(w, s, 'understood', guilty ? ['the gap was never explained'] : [`${first(boss)} accepted ${first(c)}’s word`], 8);
      if (!guilty) rel(c, boss.id).trust = clamp(rel(c, boss.id).trust + 0.02);
      return;
    }
    m.cert = clamp(cert() + 15, 0, 100);
    return phase(s, 'doubt', 4, w);
  }
  if (s.phase === 'doubt') {
    // someone else becomes suspicious: a man who works under him sees it; a rival who dislikes him imagines it
    const subs = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.id !== boss.id);
    const rivals = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.bossId === boss.id && x.id !== c.id && rel(x, c.id).grudge >= 0.15);
    const witness = guilty ? subs[0] : undefined;
    const accuser = witness ?? rivals.sort((a, b) => rel(b, c.id).grudge - rel(a, c.id).grudge)[0];
    if (witness && !witness.isPlayer) {
      know(w, s, witness.id, 2, 'saw it');
      const loyalty = rel(witness, boss.id).trust - rel(witness, c.id).trust;
      const t = witness.traits;
      if (loyalty > 0.1 && w.rng.chance(0.6)) { // goes to the boss
        const text = `${witness.name} told ${boss.name} he has seen ${c.name}’s money go missing.`;
        claim(w, s, witness.id, text, true); tell(w, s, text, { actor: witness.id, victim: boss.id, witnesses: [] });
        m.cert = clamp(cert() + 40, 0, 100); rel(witness, c.id).trust = clamp(rel(witness, c.id).trust - 0.1);
      } else if (t.greed + t.ambition > 1.0 && w.rng.chance(0.5)) { // keeps it, and sees what it is worth
        const it = spawn(w, 'intel', `intel:${witness.id}:${c.id}`, witness.id, { cause: `${witness.name} knows ${c.name} is stealing from ${boss.name}`, parties: [{ id: witness.id, role: 'knows' }, { id: c.id, role: 'exposed' }, { id: boss.id, role: 'above' }], sev: 0.3, phase: 'found', next: w.now + 2 * DAY, link: undefined, m: { skim: s.id } });
        if (it) { know(w, it, witness.id, 2, 'saw it'); it.stage = 'handling'; }
      }
    } else if (accuser) {
      know(w, s, accuser.id, 1, 'dislikes him');
      if (w.rng.chance(0.55)) { // voices suspicion, true or not
        const text = `${accuser.name} told ${boss.name} he doesn’t think ${c.name} is straight.`;
        claim(w, s, accuser.id, text, guilty); tell(w, s, text, { actor: accuser.id, victim: boss.id });
        m.cert = clamp(cert() + (guilty ? 20 : 12), 0, 100);
      }
    }
    return phase(s, 'inquiry', 3, w);
  }
  if (s.phase === 'inquiry') {
    // the boss asks someone close to the books
    const eye = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.id !== boss.id)[0];
    const found = guilty ? (eye ? 0.75 : 0.4) : 0.15;
    if (w.rng.chance(found)) m.cert = clamp(cert() + 35, 0, 100); else m.cert = clamp(cert() - 15, 0, 100);
    tell(w, s, `${boss.name} had someone look into ${c.name}’s numbers.`, { actor: boss.id, witnesses: eye ? [eye.id] : [] });
    return phase(s, 'confront', 3, w);
  }
  if (s.phase === 'confront') {
    if (cert() < 30) { // not enough to act on
      tell(w, s, `${boss.name} decided there was nothing to it.`, { actor: boss.id, victim: c.id });
      if (!guilty) rel(c, boss.id).trust = clamp(rel(c, boss.id).trust - 0.02);
      return closeSit(w, s, 'dropped', [], 6);
    }
    const r = convene(w, s, boss, undefined);
    if (r === 'none') return phase(s, 'confront', 7, w);
    return;
  }
}

// ---------------------------------------------------------------- INTEL: a man who knows something about someone above him

function intelStep(w: World, s: Situation) {
  const who = live(w, (s.parties ?? []).find((p) => p.role === 'knows')?.id), c = live(w, (s.parties ?? []).find((p) => p.role === 'exposed')?.id), boss = live(w, (s.parties ?? []).find((p) => p.role === 'above')?.id);
  if (!who || !c || !boss) return closeSit(w, s, 'gone');
  const sk = sits(w).find((x) => x.id === s.m?.skim);
  if (sk && !isOpen(sk) && s.phase !== 'squeeze') return closeSit(w, s, 'moot', [], 4); // the matter was settled without him
  if (s.phase === 'found') {
    // what does he do with it? Greed and nerve decide.
    const t = who.traits;
    const p = clamp(0.2 + t.greed * 0.4 + t.courage * 0.25 - who.traits.caution * 0.3, 0.1, 0.8);
    if (w.rng.chance(p)) {
      const ask = Math.max(50, Math.min(Math.round(c.cash * 0.25 / 10) * 10, 400));
      tell(w, s, `${who.name} let ${c.name} know he knows, and what it would cost for him to forget it.`, { actor: who.id, victim: c.id });
      s.amt = ask; know(w, s, c.id, 2, 'was told');
      return phase(s, 'squeeze', 2, w);
    }
    // keeps it to himself, for now; or tells the player if he is the sort who would
    return phase(s, 'sitting', 14, w);
  }
  if (s.phase === 'squeeze') {
    const ask = s.amt ?? 100;
    const resist = clamp(c.traits.violence * 0.5 + c.traits.courage * 0.3 + (c.cash < ask ? 0.5 : 0), 0, 1);
    if (!w.rng.chance(resist)) { // pays
      const pay = Math.min(c.cash, ask);
      c.cash -= pay; who.cash += pay;
      rel(c, who.id).grudge = clamp(rel(c, who.id).grudge + 0.15);
      tell(w, s, `${c.name} paid ${who.name} to keep quiet.`, { actor: c.id, victim: who.id });
      s.m = { ...(s.m ?? {}), paid: (Number(s.m?.paid ?? 0)) + pay };
      return phase(s, 'sitting', 14, w);
    }
    // refuses and hits back
    who.hurtUntil = Math.max(who.hurtUntil, w.now + 3 * DAY);
    rel(c, who.id).grudge = clamp(rel(c, who.id).grudge + 0.3); rel(who, c.id).grudge = clamp(rel(who, c.id).grudge + 0.3);
    tell(w, s, `${c.name} had ${who.name} beaten for what he said.`, { kind: 'beating', actor: c.id, victim: who.id });
    // a beaten man with something to say goes to the boss
    if (sk && isOpen(sk)) { sk.m = { ...(sk.m ?? {}), cert: Math.min(100, Number(sk.m?.cert ?? 0) + 30) }; know(w, sk, who.id, 2, 'saw it'); }
    return closeSit(w, s, 'hit', [`${first(who)} and ${first(c)} are enemies now`], 12);
  }
  if (s.phase === 'sitting') {
    if (w.now - s.since > 8 * WEEK) return closeSit(w, s, 'faded', [], 12);
    return phase(s, 'sitting', 14, w);
  }
}

// ---------------------------------------------------------------- TRIBUTE: a shop behind on what it owes

function tributeStep(w: World, s: Situation) {
  const b = s.biz ? w.biz[s.biz] : undefined;
  const col = live(w, (s.parties ?? []).find((p) => p.role === 'collector')?.id), o = live(w, (s.parties ?? []).find((p) => p.role === 'owner')?.id);
  if (!b?.open || !col || !o || b.ownerId !== o.id || b.protection?.collectorId !== col.id) return closeSit(w, s, 'changed', [], 6);
  const pr = b.protection;
  if (!(pr.owed && pr.owed > 0) && !(pr.late && pr.late > 0)) {
    tell(w, s, `${b.name} is square with ${col.name} again.`, { actor: o.id, victim: col.id });
    return closeSit(w, s, 'paid', [], 6);
  }
  s.amt = pr.owed ?? s.amt;
  const delayed = s.truth === 'delayed';
  if (s.phase === 'late') {
    // the collector asks; the owner answers. An owner who could pay may say he can't.
    const lie = delayed && w.rng.chance(0.65);
    const text = delayed && !lie ? `${o.name} told ${col.name} he would pay Friday.` : `${o.name} told ${col.name} the place has been dead and he can’t find it.`;
    claim(w, s, o.id, text, !lie); tell(w, s, text, { actor: o.id, victim: col.id });
    // the collector looks at the place. He can see the till, not the owner’s mind.
    const ev = evidence(w, b), richLooking = ev.some((l) => /money in the till/.test(l)), deadLooking = ev.some((l) => /nearly empty|behind with his own/.test(l));
    const believe = clamp(0.55 + (deadLooking ? 0.3 : 0) - (richLooking ? 0.45 : 0) + rel(col, o.id).trust * 0.2 - col.traits.violence * 0.2, 0.05, 0.9);
    know(w, s, col.id, 1, 'looked at the place');
    if (w.rng.chance(believe)) { giveTime(b); tell(w, s, `${col.name} gave ${o.name} until the end of the month.`, { kind: 'terms', actor: col.id, victim: o.id }); return phase(s, 'time', 14, w); }
    return phase(s, 'press', 4, w);
  }
  if (s.phase === 'time') return phase(s, 'press', 3, w);
  if (s.phase === 'press') {
    // pressure: a visit, a smashed window. A violent collector does more of it.
    const loud = col.traits.violence > 0.55 && w.rng.chance(0.6);
    if (loud) {
      b.damaged = Math.max(b.damaged, 2); col.heat = Math.min(1.5, col.heat + 0.05);
      tell(w, s, `${col.name}’s men smashed up ${b.name} to make a point.`, { kind: 'vandalism', actor: col.id, victim: o.id, broadcast: [o.id] });
    } else tell(w, s, `${col.name} came by ${b.name} and made it clear he won’t wait for ever.`, { actor: col.id, victim: o.id });
    rel(o, col.id).grudge = clamp(rel(o, col.id).grudge + (loud ? 0.2 : 0.08));
    // the owner looks for someone to speak for him
    const patron = col.bossId ? live(w, col.bossId) : undefined;
    if (patron && o.traits.courage + o.traits.sociability > 0.8 || (patron && (pr.owed ?? 0) > pr.fee * 3)) return phase(s, 'appeal', 3, w);
    s.m = { ...(s.m ?? {}), rounds: Number(s.m?.rounds ?? 0) + 1 };
    if (Number(s.m.rounds) >= 3) return phase(s, 'appeal', 2, w);
    return phase(s, 'press', 6, w);
  }
  if (s.phase === 'appeal') {
    const patron = col.bossId ? live(w, col.bossId) : undefined;
    if (!patron) return closeSit(w, s, 'unsettled', [], 6);
    s.meet = { chair: patron.id, parts: [col.id, o.id], pos: {} };
    know(w, s, patron.id, 2, 'was told');
    const r = convene(w, s, patron, undefined);
    if (r === 'none') return phase(s, 'appeal', 7, w);
    return;
  }
}
KITS.tribute = {
  opts: ['extend', 'waive', 'share', 'enforce', 'takeover'],
  label: { extend: 'Give him more time', waive: 'Wipe it and move on', share: 'Take a share of the place instead', enforce: 'Make him pay', takeover: 'Take the place' },
  util: (w, s, id, code) => {
    const b = w.biz[s.biz!]; const col = (s.parties ?? []).find((p) => p.role === 'collector')!.id;
    const owedBig = (s.amt ?? 0) > (b.protection?.fee ?? 50) * 3;
    const able = evidence(w, b).some((l) => /money in the till/.test(l));
    if (id === col) { const v = w.chars[col].traits.violence; return ({ extend: 0.15, waive: -0.6, share: 0.55, enforce: 0.3 + v * 0.3, takeover: owedBig ? 0.5 : 0.1 } as Record<string, number>)[code] ?? 0; }
    if (id === b.ownerId) return ({ extend: 0.7, waive: 0.9, share: -0.3, enforce: -0.8, takeover: -0.9 } as Record<string, number>)[code] ?? 0;
    return ({ extend: able ? -0.1 : 0.3, waive: -0.2, share: 0.3, enforce: -0.3, takeover: -0.1 } as Record<string, number>)[code] ?? 0;
  },
  apply: (w, s, code, chair) => {
    const b = w.biz[s.biz!], col = w.chars[(s.parties ?? []).find((p) => p.role === 'collector')!.id], o = w.chars[b.ownerId];
    if (code === 'extend') { giveTime(b); closeSit(w, s, 'extended', ['he has until it is paid'], 3); return `${chair.name} told ${col.name} to give ${o.name} more time.`; }
    if (code === 'waive') { clearArrears(b); if (b.protection) b.protection.fee = Math.round(b.protection.fee * 0.9); closeSit(w, s, 'waived', [`${first(col)} lost what he was owed`], 10); return `${chair.name} wiped what ${b.name} owes and cut its payment.`; }
    if (code === 'share') {
      const room = 0.6 - (b.stakes ?? []).reduce((a, x) => a + x.share, 0);
      clearArrears(b); if (room >= 0.15) addStake(w, b, col.id, 0.15, 'arrears');
      closeSit(w, s, 'share', [`${first(col)} now has a piece of ${b.name}`], 12);
      return `${chair.name} settled it: ${col.name} takes a piece of ${b.name} and the arrears are forgotten.`;
    }
    if (code === 'takeover') {
      if (transferBusiness(w, b, col.id, 'arrears', `${col.name} took ${b.name} from ${o.name} over what was owed.`)) { closeSit(w, s, 'takeover', [`${first(o)} lost ${b.name}`], 16); rel(o, col.id).grudge = clamp(rel(o, col.id).grudge + 0.4); return `${chair.name} let ${col.name} take ${b.name}.`; }
    }
    b.damaged = Math.max(b.damaged, 2); o.hurtUntil = Math.max(o.hurtUntil, w.now + 3 * DAY); rel(o, col.id).grudge = clamp(rel(o, col.id).grudge + 0.3);
    closeSit(w, s, 'enforced', [`${first(o)} was made to pay`], 10);
    return `${chair.name} told ${col.name} to collect. ${o.name} will pay, one way or another.`;
  },
};

// ---------------------------------------------------------------- DEBT: someone cannot or will not pay

function debtStep(w: World, s: Situation) {
  const d = w.debts.find((x) => x.id === s.link?.debt);
  const cr = live(w, (s.parties ?? []).find((p) => p.role === 'creditor')?.id), db = live(w, (s.parties ?? []).find((p) => p.role === 'debtor')?.id);
  if (!d || !cr || !db) return closeSit(w, s, 'gone');
  if (d.status !== 'active') return closeSit(w, s, d.status === 'paid' ? 'paid' : d.status === 'defaulted' ? 'defaulted' : 'void', [], 6);
  if (d.missed === 0) { tell(w, s, `${db.name} is straight with ${cr.name} again.`, { actor: db.id, victim: cr.id }); return closeSit(w, s, 'caught up', [], 6); }
  if (s.phase === 'missed') {
    const willful = s.truth === 'willful';
    const text = willful && w.rng.chance(0.5) ? `${db.name} told ${cr.name} he’s a bit short this week.` : `${db.name} told ${cr.name} he’ll have it soon.`;
    claim(w, s, db.id, text, !willful); tell(w, s, text, { actor: db.id, victim: cr.id });
    return phase(s, 'pressed', 6, w);
  }
  if (s.phase === 'pressed') {
    rel(db, cr.id).grudge = clamp(rel(db, cr.id).grudge + 0.07);
    tell(w, s, `${cr.name} let ${db.name} know he wants his money.`, { actor: cr.id, victim: db.id });
    s.m = { ...(s.m ?? {}), rounds: Number(s.m?.rounds ?? 0) + 1 };
    if (Number(s.m.rounds) >= 2 || d.missed >= 3) {
      const chair = commonSuper(w, cr, db) ?? chainUp(w, cr)[0];
      if (!chair) { // nobody to ask: they work it out themselves
        d.nextDue += 14 * DAY; d.missed = 0;
        return closeSit(w, s, 'worked out', ['they agreed more time between themselves'], 6);
      }
      s.meet = { chair: chair.id, parts: [cr.id, db.id], pos: {} };
      const r = convene(w, s, chair, undefined);
      if (r === 'none') return phase(s, 'pressed', 7, w);
      return;
    }
    return phase(s, 'pressed', 7, w);
  }
}
KITS.debt = {
  opts: ['extend', 'restructure', 'writedown', 'share', 'enforce'],
  label: { extend: 'Two more weeks', restructure: 'Smaller payments, lower interest', writedown: 'Write part of it off', share: 'Take a share of his business', enforce: 'Make him pay' },
  util: (w, s, id, code) => {
    const d = w.debts.find((x) => x.id === s.link?.debt)!;
    const cr = d.creditor, db = d.debtor, hasBiz = !!ownerBiz(w, db);
    if (id === cr && s.truth === 'willful') return ({ extend: -0.3, restructure: 0.0, writedown: -0.7, share: hasBiz ? 0.5 : -0.3, enforce: 0.5 + w.chars[cr].traits.violence * 0.3 } as Record<string, number>)[code] ?? 0;
    if (id === cr) return ({ extend: 0.1, restructure: 0.35, writedown: -0.5, share: hasBiz ? 0.45 : -0.3, enforce: 0.3 + w.chars[cr].traits.violence * 0.3 } as Record<string, number>)[code] ?? 0;
    if (id === db) return ({ extend: 0.8, restructure: 0.7, writedown: 0.95, share: hasBiz ? -0.5 : 0, enforce: -0.9 } as Record<string, number>)[code] ?? 0;
    // anyone else sides with the man he trusts more, and with whoever has the stronger case
    const lean = rel(w.chars[id], db).trust - rel(w.chars[id], cr).trust, willful = s.truth === 'willful';
    const base = ({ extend: 0.15, restructure: 0.1, writedown: -0.2, share: 0.0, enforce: -0.2 } as Record<string, number>)[code] ?? 0;
    const soft = code === 'writedown' ? 1.4 : code === 'extend' ? 1.0 : code === 'restructure' ? 0.7 : 0;
    return base + (soft ? soft * lean - (willful ? 0.2 : 0) : (code === 'enforce' ? -1.1 : -0.5) * lean + (willful ? 0.3 : 0));
  },
  apply: (w, s, code, chair) => {
    const d = w.debts.find((x) => x.id === s.link?.debt)!, cr = w.chars[d.creditor], db = w.chars[d.debtor];
    if (code === 'extend') { d.nextDue += 14 * DAY; d.missed = 0; closeSit(w, s, 'extended', [], 5); return `${chair.name} gave ${db.name} two more weeks.`; }
    if (code === 'restructure') { d.weeklyPayment = Math.max(10, Math.round(d.weeklyPayment * 0.5 / 5) * 5); d.weeklyRate = Math.max(0.005, Math.round(d.weeklyRate * 0.7 * 1000) / 1000); d.missed = 0; closeSit(w, s, 'restructured', [], 8); return `${chair.name} cut what ${db.name} pays each week and what it costs him.`; }
    if (code === 'writedown') { d.balance = Math.round(d.balance * 0.6); d.missed = 0; closeSit(w, s, 'written down', [`${first(cr)} took a loss`], 10); rel(cr, chair.id).respect = clamp(rel(cr, chair.id).respect - 0.03); return `${chair.name} told ${cr.name} to take a loss. ${db.name} owes ${d.balance} now.`; }
    if (code === 'share' && ownerBiz(w, db.id)) { seizeShare(w, d); d.missed = 0; closeSit(w, s, 'share', [`${first(cr)} has a piece of ${first(db)}’s business`], 12); return `${chair.name} let ${cr.name} take a piece of ${db.name}’s business against the debt.`; }
    const pay = Math.min(Math.round(db.cash * 0.6), d.balance);
    if (pay > 0) payDebt(w, d, pay);
    db.hurtUntil = Math.max(db.hurtUntil, w.now + 2 * DAY); rel(db, cr.id).grudge = clamp(rel(db, cr.id).grudge + 0.3); d.missed = Math.max(0, d.missed - 1);
    closeSit(w, s, 'enforced', [`${first(db)} was squeezed`], 10);
    return `${chair.name} told ${cr.name} to collect. ${db.name} paid what he had.`;
  },
};

// ---------------------------------------------------------------- PARTNER: an investment that has gone sour

function partnerStep(w: World, s: Situation) {
  const b = s.biz ? w.biz[s.biz] : undefined;
  const o = live(w, (s.parties ?? []).find((p) => p.role === 'owner')?.id), h = live(w, (s.parties ?? []).find((p) => p.role === 'partner')?.id);
  const st = b?.stakes?.find((x) => x.holder === h?.id);
  if (!b?.open || !o || !h || !st || b.ownerId !== o.id) return closeSit(w, s, 'changed', [], 6);
  if (s.phase === 'complaint') {
    const text = `${h.name} told ${o.name} he isn’t seeing what his share is worth.`;
    tell(w, s, text, { actor: h.id, victim: o.id }); claim(w, s, h.id, text, true);
    return phase(s, 'response', 5, w);
  }
  if (s.phase === 'response') {
    const slumping = s.truth === 'weak';
    const text = slumping ? `${o.name} told ${h.name} trade has been poor and there is nothing to share.` : `${o.name} told ${h.name} to be patient.`;
    claim(w, s, o.id, text, slumping); tell(w, s, text, { actor: o.id, victim: h.id });
    if (rel(h, o.id).trust > 0.55 && slumping && w.rng.chance(0.6)) { tell(w, s, `${h.name} accepted that it is a bad patch.`, { actor: h.id }); return closeSit(w, s, 'patience', [], 8); }
    return phase(s, 'backing', 4, w);
  }
  if (s.phase === 'backing') {
    const chair = commonSuper(w, o, h) ?? chainUp(w, h)[0] ?? chainUp(w, o)[0];
    if (!chair) return closeSit(w, s, 'unsettled', [], 8);
    s.meet = { chair: chair.id, parts: [o.id, h.id], pos: {} };
    know(w, s, chair.id, 2, 'was told');
    const r = convene(w, s, chair, undefined);
    if (r === 'none') return phase(s, 'backing', 7, w);
  }
}
const stakeValue = (w: World, s: Situation) => { const b = w.biz[s.biz!], h = (s.parties ?? []).find((p) => p.role === 'partner')!.id, st = b.stakes?.find((x) => x.holder === h); return Math.round(priceOf(w, b) * (st?.share ?? 0.15)); };
KITS.partner = {
  opts: ['buyout', 'sellout', 'dissolve', 'stay'],
  label: { buyout: 'He buys the partner out', sellout: 'The partner buys him out', dissolve: 'End it, split the loss', stay: 'Both stay, nothing changes' },
  util: (w, s, id, code) => {
    const b = w.biz[s.biz!], o = w.chars[b.ownerId], h = (s.parties ?? []).find((p) => p.role === 'partner')!.id;
    const price = stakeValue(w, s), full = priceOf(w, b);
    if (id === o.id) return ({ buyout: o.cash >= price * 0.85 ? 0.5 : 0, sellout: -0.7, dissolve: 0.2, stay: 0.6 } as Record<string, number>)[code] ?? 0;
    if (id === h) return ({ buyout: 0.6, sellout: w.chars[h].cash >= full * 0.5 ? 0.55 : -0.5, dissolve: 0.1, stay: -0.4 } as Record<string, number>)[code] ?? 0;
    return ({ buyout: 0.3, sellout: 0, dissolve: 0.1, stay: 0.1 } as Record<string, number>)[code] ?? 0;
  },
  apply: (w, s, code, chair) => {
    const b = w.biz[s.biz!], o = w.chars[b.ownerId], h = w.chars[(s.parties ?? []).find((p) => p.role === 'partner')!.id];
    const drop = () => { b.stakes = (b.stakes ?? []).filter((x) => x.holder !== h.id); if (!b.stakes.length) delete b.stakes; };
    const pay = Math.round(stakeValue(w, s) * 0.85);
    if (code === 'buyout') {
      const now = Math.min(Math.max(0, o.cash), pay); o.cash -= now; h.cash += now;
      if (pay - now > 20) createDebt(w, h.id, o.id, pay - now, 0.01, `buying out ${first(h)}’s share of ${b.name}`);
      drop(); closeSit(w, s, 'buyout', [`${first(h)} is out of ${b.name}`], 14); return `${chair.name} settled it: ${o.name} buys ${h.name} out of ${b.name} for ${pay}.`;
    }
    if (code === 'sellout') {
      const cost = Math.round(priceOf(w, b) * 0.85);
      if (h.cash >= cost) { h.cash -= cost; o.cash += cost; if (transferBusiness(w, b, h.id, 'bought out', `${h.name} bought ${o.name} out of ${b.name}.`)) { closeSit(w, s, 'sellout', [`${first(h)} owns ${b.name} now`], 16); return `${chair.name} settled it: ${h.name} takes over ${b.name}.`; } h.cash += cost; o.cash -= cost; }
    }
    if (code === 'dissolve') {
      const now = Math.min(Math.max(0, o.cash), Math.round(pay * 0.5)); o.cash -= now; h.cash += now; drop();
      closeSit(w, s, 'dissolved', [`${first(h)} took a loss and left`], 12); return `${chair.name} ended the partnership. ${h.name} gets ${now} and leaves.`;
    }
    rel(h, o.id).trust = clamp(rel(h, o.id).trust - 0.1);
    closeSit(w, s, 'stay', [`${first(h)} is stuck in ${b.name}`], 10); return `${chair.name} told them both to carry on.`;
  },
};

// ---------------------------------------------------------------- GRUDGE: a man passed over

// Called when a man is made. The strongest rival who feels it keeps it.
export function promotedOver(w: World, winner: Character, was: string) {
  if (!SIT.on || !winner.familyId) return;
  const boss = live(w, winner.bossId) ?? live(w, w.fam[winner.familyId]?.bossId);
  const rivals = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.id !== winner.id && x.familyId === winner.familyId && x.rank === was && x.traits.ambition >= 0.6 && rel(x, winner.id).grudge >= 0.1);
  const y = rivals.sort((a, b) => rel(b, winner.id).grudge - rel(a, winner.id).grudge)[0];
  if (!y || !boss || boss.id === y.id) return;
  const s = spawn(w, 'grudge', `grudge:${y.id}:${winner.id}`, y.id, { cause: `${y.name} was passed over when ${winner.name} was made`, parties: [{ id: boss.id, role: 'boss' }, { id: y.id, role: 'rival' }, { id: winner.id, role: 'winner' }], sev: 0.35, phase: 'sulk', next: w.now + 7 * DAY, orgs: [winner.familyId] });
  if (s) { know(w, s, y.id, 2, 'self'); s.stage = 'handling'; }
}
function grudgeStep(w: World, s: Situation) {
  const boss = live(w, (s.parties ?? []).find((p) => p.role === 'boss')?.id), y = live(w, (s.parties ?? []).find((p) => p.role === 'rival')?.id), x = live(w, (s.parties ?? []).find((p) => p.role === 'winner')?.id);
  if (!boss || !y || !x || y.familyId !== boss.familyId) return closeSit(w, s, 'gone');
  if (rel(y, x.id).grudge < 0.04) return closeSit(w, s, 'faded', [], 8);
  if (s.phase === 'sulk') {
    // does he find others who feel the same?
    const allies = Object.values(w.chars).filter((c) => c.alive && c.id !== y.id && c.id !== x.id && c.familyId === y.familyId && !c.isPlayer && rel(c, x.id).grudge >= 0.1 && rel(y, c.id).trust >= 0.3);
    s.m = { ...(s.m ?? {}), allies: allies.length };
    if (allies.length) { tell(w, s, `${y.name} has been talking to ${allies[0].name} about ${x.name}.`, { actor: y.id, witnesses: [allies[0].id] }); allies.slice(0, 2).forEach((a) => know(w, s, a.id, 2, 'was told')); }
    return phase(s, 'airing', 6, w);
  }
  if (s.phase === 'airing') {
    const bold = y.traits.ambition + y.traits.courage > 1.1 || Number(s.m?.allies ?? 0) > 0;
    if (!bold && w.rng.chance(0.6)) { tell(w, s, `${y.name} swallowed it.`, { actor: y.id }); rel(y, x.id).grudge = clamp(rel(y, x.id).grudge * 0.7); return closeSit(w, s, 'swallowed', [`${first(y)} still resents ${first(x)}`], 12); }
    tell(w, s, `${y.name} went to ${boss.name} and said he deserved better than he got.`, { actor: y.id, victim: boss.id, witnesses: [] });
    know(w, s, boss.id, 2, 'was told');
    s.meet = { chair: boss.id, parts: [y.id, x.id], pos: {} };
    const r = convene(w, s, boss, undefined);
    if (r === 'none') return phase(s, 'airing', 7, w);
  }
}
KITS.grudge = {
  opts: ['placate', 'dismiss', 'reprimand'],
  label: { placate: 'Give him something to keep him sweet', dismiss: 'Tell him his time will come', reprimand: 'Tell him to know his place' },
  util: (w, s, id, code) => {
    const y = (s.parties ?? []).find((p) => p.role === 'rival')!.id, x = (s.parties ?? []).find((p) => p.role === 'winner')!.id;
    if (id === y) return ({ placate: 0.8, dismiss: -0.5, reprimand: -0.85 } as Record<string, number>)[code] ?? 0;
    if (id === x) return ({ placate: 0.1, dismiss: 0.5, reprimand: 0.6 } as Record<string, number>)[code] ?? 0;
    return ({ placate: 0.3 - w.chars[id].traits.greed * 0.3, dismiss: 0.15, reprimand: 0 } as Record<string, number>)[code] ?? 0;
  },
  apply: (w, s, code, chair) => {
    const y = w.chars[(s.parties ?? []).find((p) => p.role === 'rival')!.id];
    let said = '';
    if (code === 'placate') {
      const gift = Math.max(0, Math.min(Math.round(chair.cash * 0.1 / 10) * 10, 400));
      if (gift > 0) { chair.cash -= gift; y.cash += gift; }
      y.backer = chair.id; rel(y, chair.id).trust = clamp(rel(y, chair.id).trust + 0.1);
      closeSit(w, s, 'placated', [`${first(y)} was bought off`], 14); said = `${chair.name} gave ${y.name} ${gift > 0 ? '$' + gift + ' and ' : ''}his backing.`;
    } else if (code === 'dismiss') {
      rel(y, chair.id).trust = clamp(rel(y, chair.id).trust - 0.05); closeSit(w, s, 'dismissed', [], 10); said = `${chair.name} told ${y.name} to wait his turn.`;
    } else {
      y.standing = clamp(y.standing - 2, 0, 100); rel(y, chair.id).trust = clamp(rel(y, chair.id).trust - 0.12); rel(y, chair.id).grudge = clamp(rel(y, chair.id).grudge + 0.1);
      closeSit(w, s, 'reprimanded', [`${first(y)} was put in his place`], 14); said = `${chair.name} told ${y.name} to know his place.`;
    }
    // what a man does with a no: ambitious ones start looking at their own way up (V74 goals)
    if (code !== 'placate' && y.traits.ambition > 0.65 && goalsOf(w, y.id).length < 2 && !goalsOf(w, y.id).some((g) => g.kind === 'independence')) {
      beginGoal(w, y, 'independence', 'he was passed over and shown no respect', 0.85, { stage: 'income', next: 'get some money of his own', n: 0, have: Math.round(y.kickRate * 1000) });
      s.cons = [...(s.cons ?? []), `${first(y)} is looking for a way out`].slice(-SIT.cap.cons);
    }
    return said;
  },
};

// ---------------------------------------------------------------- emerging from the world

function tributeScan(w: World) {
  for (const b of Object.values(w.biz)) {
    const pr = b.protection;
    if (!b.open || !pr || !(pr.late && pr.late >= 2) || !(pr.owed && pr.owed > 0)) continue;
    const o = live(w, b.ownerId), col = live(w, pr.collectorId);
    if (!o || !col || o.isPlayer || col.isPlayer || o.id === col.id) continue;
    if ((w.disputes ?? []).some((d) => (d.status === 'open' || d.status === 'violated') && d.biz === b.id)) continue;
    if (!w.rng.chance(0.5)) continue;
    const s = spawn(w, 'tribute', `tribute:${b.id}`, o.id, { cause: `${b.name} is behind on what it owes ${col.name}`, parties: [{ id: col.id, role: 'collector' }, { id: o.id, role: 'owner' }], sev: clamp(0.3 + pr.owed / Math.max(1, pr.fee * 8) * 0.3, 0.3, 0.6), phase: 'late', next: w.now + 3 * DAY, biz: b.id, truth: pr.why ?? 'unable', amt: pr.owed, orgs: pr.familyId ? [pr.familyId] : [] });
    if (s) { know(w, s, col.id, 2, 'owed'); know(w, s, o.id, 2, 'owes'); s.stage = 'handling'; }
  }
}
function debtScan(w: World) {
  for (const d of w.debts) {
    if (d.status !== 'active' || d.missed < 2) continue;
    const cr = live(w, d.creditor), db = live(w, d.debtor);
    if (!cr || !db || cr.isPlayer || db.isPlayer || cr.rank === 'civilian' && db.rank === 'civilian') continue;
    if (!w.rng.chance(0.4)) continue;
    const s = spawn(w, 'debt', `debt:${d.id}`, db.id, { cause: `${db.name} is behind on what he owes ${cr.name}`, parties: [{ id: cr.id, role: 'creditor' }, { id: db.id, role: 'debtor' }], sev: clamp(0.25 + d.balance / 6000, 0.25, 0.55), phase: 'missed', next: w.now + 3 * DAY, truth: db.cash > d.weeklyPayment * 2 ? 'willful' : 'unable', amt: d.balance, link: { debt: d.id }, orgs: cr.familyId ? [cr.familyId] : [] });
    if (s) { know(w, s, cr.id, 2, 'owed'); know(w, s, db.id, 2, 'owes'); s.stage = 'handling'; }
  }
}
function partnerScan(w: World) {
  for (const b of Object.values(w.biz)) {
    if (!b.open || !b.stakes?.length) continue;
    const o = live(w, b.ownerId);
    if (!o || o.isPlayer) continue;
    for (const st of b.stakes) {
      const h = live(w, st.holder);
      if (!h || h.isPlayer || h.id === o.id || st.share < 0.15 || w.now - st.since < 4 * WEEK) continue;
      const weak = b.distress >= 2 || (b.acct ?? []).slice(-3).filter((r) => r.revenue > 0 && r.revenue < b.income * 0.7).length >= 2;
      const sour = rel(h, o.id).grudge >= 0.25;
      if (!(weak || sour) || !w.rng.chance(0.2)) continue;
      const s = spawn(w, 'partner', `partner:${b.id}:${h.id}`, o.id, { cause: `${h.name} is unhappy with his share of ${b.name}`, parties: [{ id: o.id, role: 'owner' }, { id: h.id, role: 'partner' }], sev: 0.35, phase: 'complaint', next: w.now + 4 * DAY, biz: b.id, truth: weak ? 'weak' : 'dodging' });
      if (s) { know(w, s, h.id, 2, 'self'); know(w, s, o.id, 1, 'heard grumbling'); s.stage = 'handling'; }
    }
  }
}

// The old kinds that already live elsewhere (disputes, crew grievances) are mirrored here, one source for "what is going on".
function syncLinks(w: World) {
  const l = sits(w);
  pace(w).sync = w.now;
  for (const d of w.disputes ?? []) {
    const mine = l.find((s) => s.link?.dispute === d.id);
    const open = d.status === 'open' || d.status === 'violated';
    if (open && !mine && w.now - d.created > 2 * DAY) {
      const a = live(w, d.a), b = live(w, d.b);
      if (!a || !b) continue;
      const s = spawn(w, 'dispute', `dispute:${d.id}`, d.a, { cause: d.history[0]?.text ?? 'a quarrel', parties: [{ id: d.a, role: 'injured' }, { id: d.b, role: 'accused' }], sev: 0.3, phase: d.status, next: w.now + 7 * DAY, biz: d.biz, link: { dispute: d.id } });
      if (s) s.stage = 'handling';
    } else if (mine && isOpen(mine)) {
      if (!open) closeSit(w, mine, d.status, [], 4);
      else mine.phase = d.status;
    } else if (mine && open) { // a settled quarrel was broken: that is a real new cause, and it is the same dispute, so it reopens rather than starting a second record
      mine.stage = 'handling'; mine.phase = d.status; delete mine.resolvedAt; delete mine.how; delete mine.out; mine.next = w.now + 7 * DAY;
      if (mine.key && w.sitcool) delete w.sitcool[mine.key];
      bump(w, 'reopen.dispute');
    }
  }
  for (const g of w.grievances) {
    const mine = l.find((s) => s.link?.griev === g.id);
    if (g.status === 'open' && !mine && w.now - g.created > 1 * DAY && live(w, g.from) && live(w, g.about)) {
      const s = spawn(w, 'crew', `crew:${g.id}`, g.from, { cause: g.text, parties: [{ id: g.from, role: 'complainant' }, { id: g.about, role: 'accused' }], sev: 0.25, phase: 'open', next: w.now + 7 * DAY, link: { griev: g.id } });
      if (s) s.stage = 'handling';
    } else if (mine && isOpen(mine) && g.status !== 'open') closeSit(w, mine, g.status, [], 4);
    else if (mine && !isOpen(mine) && g.status === 'open') { mine.stage = 'handling'; mine.phase = 'open'; delete mine.resolvedAt; delete mine.how; delete mine.out; mine.next = w.now + 7 * DAY; bump(w, 'reopen.crew'); }
  }
  // stamp every mirror that now agrees with its source, so the audit can tell "not synced yet" from "contradicting"
  for (const x of l) {
    if (x.link?.dispute) { const d = (w.disputes ?? []).find((q) => q.id === x.link!.dispute); if (!d || ((d.status === 'open' || d.status === 'violated') === isOpen(x))) (x.m ??= {}).chk = w.now; }
    else if (x.link?.griev) { const g = w.grievances.find((q) => q.id === x.link!.griev); if (!g || ((g.status === 'open') === isOpen(x))) (x.m ??= {}).chk = w.now; }
  }
}

// ---------------------------------------------------------------- word gets around

// A man who knows something and likes talking passes it to someone he trusts. He repeats what he was told or saw, not what is true.
function leak(w: World) {
  const p = P(w);
  for (const s of sits(w)) {
    if (!isOpen(s) || !s.kind || !STEP[s.kind] || (s.sev ?? 0) < 0.3) continue;
    for (const [id, k] of Object.entries(s.k ?? {})) {
      const c = live(w, id);
      if (!c || c.isPlayer || k.l < 2 || w.now - k.t < 2 * DAY) continue;
      if (!w.rng.chance(0.06 + c.traits.sociability * 0.12)) continue;
      const known = Object.keys(c.known).map((x) => w.facts[x]).filter((f) => f && f.story === 'sit:' + s.id).sort((a, b) => b.t - a.t);
      const f = known[0];
      if (!f || f.kind === 'sitdown' && w.now - f.t > 10 * DAY) continue;
      const friends = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && !s.k?.[x.id] && !isParty2(s, x.id) && rel(c, x.id).trust >= 0.3 && x.familyId === c.familyId);
      const pl = p && friends.find((x) => x.id === p.id);
      const hear = pl && w.rng.chance(0.4) ? pl : friends.sort((a, b) => rel(c, b.id).trust - rel(c, a.id).trust)[0];
      if (!hear) continue;
      // the secret kinds stay secret unless the teller is the sort who spreads them
      if (s.kind === 'intel' && c.traits.sociability < 0.7) continue;
      const g = addFact(w, { kind: 'rumour', actor: c.id, story: 'sit:' + s.id, business: s.biz, minor: true, text: `${c.name} says: ${f.text}` }, { witnesses: [hear.id] });
      know(w, s, hear.id, 1, 'heard from ' + first(c));
      if (p && hear.id === p.id) { pace(w).weekVis++; pace(w).lastVisible = w.now; s.knows = true; }
      void g;
      bump(w, 'leak');
      break;
    }
  }
}
const isParty2 = (s: Situation, id: Id) => s.who === id || (s.parties ?? []).some((x) => x.id === id);

// Word in the crew: a man hears when trouble touches his own crew or the man he answers to.
function crewWord(w: World) {
  const p = P(w);
  if (!p?.alive || w.now - pace(w).lastVisible < 7 * DAY) return;
  for (const s of sits(w)) {
    if (!isOpen(s) || !s.kind || !STEP[s.kind] || (s.sev ?? 0) < 0.3 || s.k?.[p.id] || isParty2(s, p.id)) continue;
    const mates = (s.parties ?? []).map((x) => w.chars[x.id]).filter((c) => c?.alive && !c.isPlayer && c.familyId === p.familyId);
    const near = mates.filter((c) => c.bossId === p.id || c.id === p.bossId || (!!p.bossId && c.bossId === p.bossId));
    // trouble in his own crew reaches him quickly; trouble elsewhere in the family only sometimes, and only if it is serious
    const chance = near.some((c) => c.bossId === p.id || c.id === p.bossId) ? 0.5 : near.length ? 0.25 : (s.sev ?? 0) >= 0.4 ? 0.1 : 0;
    if (!mates.length || !w.rng.chance(chance)) continue;
    if (!near.length) near.push(mates[0]);
    const last = [...(s.hist ?? [])].pop();
    const who = near[0];
    const f = addFact(w, { kind: 'rumour', actor: who.id, story: 'sit:' + s.id, business: s.biz, minor: true, text: `Word in the crew: ${last?.text ?? s.cause}` }, { witnesses: [p.id] });
    know(w, s, p.id, 1, 'word in the crew');
    s.knows = true; pace(w).weekVis++; pace(w).lastVisible = w.now; bump(w, 'word');
    void f;
    return; // one at a time
  }
}

// ---------------------------------------------------------------- the clock

const STEP: Partial<Record<SitKind, (w: World, s: Situation) => void>> = { skim: skimStep, intel: intelStep, tribute: tributeStep, debt: debtStep, partner: partnerStep, grudge: grudgeStep };
// V89: other modules add kinds of their own (matters.ts registers 'ask') without this file having to know them. The table lives on
// the (hoisted) function itself, so a module may register while the import cycle is still loading this one.
export function registerStep(kind: SitKind, f: (w: World, s: Situation) => void) { ((registerStep as unknown as { steps?: Partial<Record<SitKind, (w: World, s: Situation) => void>> }).steps ??= {})[kind] = f; }
const extraStep = (k: SitKind) => (registerStep as unknown as { steps?: Partial<Record<SitKind, (w: World, s: Situation) => void>> }).steps?.[k];
// Daily: whatever is due moves one step. Most days nothing is.
export function sitDay(w: World) {
  if (!SIT.on) return;
  syncLinks(w);
  for (const s of [...sits(w)]) {
    if (!isOpen(s) || !s.kind) continue;
    if (s.stage === 'asking') { // waiting on the player; when the time is up it goes to someone else
      const e = s.ask ? w.enc.find((x) => x.id === s.ask) : undefined;
      if (e && e.status === 'open' && w.now < (s.next ?? 0)) continue;
      if (e && e.status === 'open') e.status = 'lapsed';
      delete s.ask; s.stage = 'handling';
      const chair = chainUp(w, P(w))[0] ?? (s.parties ?? []).map((p) => w.chars[p.id]).filter((c) => c?.alive && !c.isPlayer).sort((a, b) => rk(b) - rk(a))[0];
      if (chair && kitOf(s)) { settleByNpc(w, s, chair); continue; }
    }
    if ((s.next ?? 1e18) > w.now) continue;
    const f = STEP[s.kind] ?? extraStep(s.kind);
    if (f) f(w, s);
    else if (s.kind !== 'money' && s.kind !== 'ambition' && s.kind !== 'turf' && s.kind !== 'org' && s.kind !== 'dispute' && s.kind !== 'crew') closeSit(w, s, 'unknown');
  }
}
// Weekly: look at the world for things that have started, and keep the books on quiet and noise.
export function sitWeek(w: World) {
  if (!SIT.on) return;
  const sp = pace(w);
  sp.weeks = (sp.weeks ?? 0) + 1;
  // anything about a situation that reached the player this week, by whatever road (a leak, the crew, the club, ordinary rumour)
  const pl = P(w);
  const smallK = new Set(sits(w).filter((s) => s.kind && SIT.cap.own[s.kind] !== undefined).map((s) => 'sit:' + s.id));
  if (pl) { const seen = Object.keys(pl.known).filter((id) => { const f = w.facts[id]; return f?.story?.startsWith('sit:') && pl.known[id].t > w.now - WEEK && !((f.minor || !SERIOUS.has(f.kind)) && smallK.has(f.story)); }).length; sp.weekVis = Math.max(sp.weekVis, seen); if (seen) sp.lastVisible = Math.max(sp.lastVisible, w.now); }
  if (sp.weekVis === 0) sp.quiet = (sp.quiet ?? 0) + 1;
  if (sp.weekVis >= 3) sp.busy = (sp.busy ?? 0) + 1;
  sp.weekVis = 0;
  for (const s of sits(w)) if (isOpen(s)) s.weeks++;
  syncLinks(w);
  // cooling-off periods that have run out are forgotten
  if (w.sitcool) for (const [k, t] of Object.entries(w.sitcool)) if (t <= w.now) delete w.sitcool[k];
  leak(w);
  crewWord(w);
  tributeScan(w);
  debtScan(w);
  partnerScan(w);
  // a matter nobody has touched for months and that has no clock simply fades
  for (const s of sits(w)) if (isOpen(s) && s.kind && STEP[s.kind] && w.now - s.since > 20 * WEEK) closeSit(w, s, 'faded', [], 8);
}

// ---------------------------------------------------------------- inspection

export function sitIssues(w: World): string[] {
  const out: string[] = [];
  const l = w.situations ?? [];
  const keys = new Set<string>();
  let open = 0;
  for (const s of l) {
    if (isOpen(s)) {
      open++;
      if (s.key) { if (keys.has(s.key)) out.push(`situation ${s.id}: two open with key ${s.key}`); keys.add(s.key); }
      for (const p of s.parties ?? []) if (!w.chars[p.id]) out.push(`situation ${s.id}: no such party ${p.id}`);
      if (s.kind && STEP[s.kind] && s.next === undefined && s.stage !== 'asking') out.push(`situation ${s.id}: ${s.kind} has no clock`);
      if (s.key && s.stage === 'asking' && !(s.ask && w.enc.some((e) => e.id === s.ask)) && w.now > (s.next ?? 0) + 2 * DAY) out.push(`situation ${s.id}: waiting on a question that is gone`);
      if (s.biz && s.kind && ['tribute', 'partner'].includes(s.kind) && !w.biz[s.biz]) out.push(`situation ${s.id}: business ${s.biz} does not exist`);
    } else if (s.next !== undefined || s.ask) out.push(`situation ${s.id}: closed but still has a clock`);
    if ((s.hist?.length ?? 0) > SIT.cap.hist || (s.claims?.length ?? 0) > SIT.cap.claims) out.push(`situation ${s.id}: record not bounded`);
    for (const [id, k] of Object.entries(s.k ?? {})) if (!w.chars[id]) out.push(`situation ${s.id}: knowledge held by missing ${id}`); else if (k.l !== 1 && k.l !== 2) out.push(`situation ${s.id}: bad knowledge level`);
    // the mirrors never disagree with what they mirror
    if (s.link?.dispute) { const d = (w.disputes ?? []).find((x) => x.id === s.link!.dispute); if (d && (d.status === 'open' || d.status === 'violated') !== isOpen(s) && w.now - Number(s.m?.chk ?? s.since) > 3 * DAY && (w.sitpace?.sync ?? -1e9) > Math.max(d.created, ...d.history.map((h) => h.t))) out.push(`situation ${s.id}: ${isOpen(s) ? 'open' : 'closed'} but dispute ${d.id} is ${d.status}`); }
    if (s.link?.griev) { const g = w.grievances.find((x) => x.id === s.link!.griev); if (g && (g.status === 'open') !== isOpen(s) && w.now - Number(s.m?.chk ?? s.since) > 3 * DAY) out.push(`situation ${s.id}: ${isOpen(s) ? 'open' : 'closed'} but grievance ${g.id} is ${g.status}`); }
    if (s.link?.debt) { const d = w.debts.find((x) => x.id === s.link!.debt); if (d && d.status !== 'active' && isOpen(s) && w.now - (d.paid ? s.since : s.since) > 10 * DAY) out.push(`situation ${s.id}: open but debt is ${d.status}`); }
  }
  const nonMirror = l.filter((x) => isOpen(x) && x.kind !== 'dispute' && x.kind !== 'crew' && !(x.kind && SIT.cap.own[x.kind] !== undefined)).length;
  if (nonMirror > SIT.cap.open) out.push(`${nonMirror} open situations`);
  const asks = l.filter((x) => isOpen(x) && x.kind === 'ask' && x.who !== w.playerId && !x.m?.goal).length; // V89: asks have a ceiling of their own
  if (asks > SIT.cap.asks) out.push(`${asks} open asks`);
  const plans = l.filter((x) => isOpen(x) && x.kind === 'ask' && x.m?.goal).length; // (and the asks NPC plans make, another)
  if (plans > SIT.cap.plans) out.push(`${plans} open asks on plans`);
  for (const [k, cap] of Object.entries(SIT.cap.own)) { const n = l.filter((x) => isOpen(x) && x.kind === k && x.who !== w.playerId && !(k === 'ask' && x.m?.goal)).length; if (n > cap!) out.push(`${n} open ${k}`); }
  // one dispute, one story: a quarrel cannot be open in one place and resolved in another
  for (const d of w.disputes ?? []) if ((d.status === 'open' || d.status === 'violated') && w.now - d.created > 10 * DAY && !l.some((s) => s.link?.dispute === d.id) && live(w, d.a) && live(w, d.b) && d.created + 3 * DAY < (w.sitpace?.sync ?? -1e9) && Math.max(d.created, ...d.history.map((h) => h.t)) < (w.sitpace?.sync ?? -1e9)) out.push(`dispute ${d.id}: open with no matching situation (${d.status}, created d${Math.floor(d.created / DAY)}, synced d${Math.floor((w.sitpace?.sync ?? 0) / DAY)}, now d${Math.floor(w.now / DAY)}, ${d.a === w.playerId || d.b === w.playerId ? 'player' : 'npcs'})`);
  return out;
}
void ({} as Business); void ({} as Debt);
