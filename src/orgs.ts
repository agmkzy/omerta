// V76: criminal organisations as records of their own (replaces the old "five fixed families" assumption).
//
// An organisation is a Family record in w.fam, with a stable id. Its membership and hierarchy are NOT stored a second time:
// they are read from the characters (familyId, bossId, rank), which stay the one source of truth (rank.ts keeps them valid).
// What this file adds on top of that:
//   * the record itself: history, leader and since when, standing, headquarters, treasury, relations with other organisations
//   * leadership: a scored succession (rank, authority, the support of the men who matter, reputation, a named heir) for death,
//     long imprisonment, retirement, a stepping-down and a successful plot, and the consequences that stay behind
//   * membership churn: defection, expulsion, retirement; and the rare splinter group founded by a passed-over captain
//   * money: dues up, support for men inside down, every movement through one door that keeps a ledger which reconciles
//   * relations: cooperation / competition / grievance between organisations as persistent state that the world reads back
// Nothing in here knows how many organisations there are or what any of them is called.
import { bossBack } from './direction';
import { temper } from './temper';
import { addFact, bear, clamp, feel, feelOn, feelTo, money, payDebt, peek, recordCareer, rel, repute } from './core';
import { addFavour } from './encounters';
import { applyRank, LADDER, rankIdx, repairHierarchy, WAGE } from './rank';
import { ensureClubs, clubOf } from './clubdata';
import { Character, DAY, Family, Id, OrgRel, Rank, WEEK, World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const HIST_MAX = 40, TLOG_MAX = 40, DEALS_MAX = 6;
export const MAX_ORGS = 9;

// ---------------------------------------------------------------- reading the record
export const orgList = (w: World): Family[] => Object.values(w.fam).sort((a, b) => (a.id < b.id ? -1 : 1));
export const membersOf = (w: World, fid: Id): Character[] => Object.values(w.chars).filter((c) => c.alive && c.familyId === fid && c.rank !== 'civilian');
export const leaderOf = (w: World, fid: Id): Character | undefined => { const c = w.chars[w.fam[fid]?.bossId]; return c?.alive && c.familyId === fid ? c : undefined; };
// Whoever is actually running things today: the acting man while the boss is away, otherwise the boss.
export const runningOf = (w: World, fid: Id): Character | undefined => { const a = w.fam[fid]?.acting ? w.chars[w.fam[fid].acting!] : undefined; return a?.alive && a.familyId === fid ? a : leaderOf(w, fid); };
export const orgOf = (w: World, c: Character): Family | undefined => (c.familyId ? w.fam[c.familyId] : undefined);
// The reporting lines as a tree: who answers to whom, read straight off the characters.
export function hierarchyOf(w: World, fid: Id): { leader?: Character; reports: Record<Id, Id[]>; depth: Record<string, number> } {
  const reports: Record<Id, Id[]> = {};
  const depth: Record<string, number> = {};
  for (const c of membersOf(w, fid)) { depth[c.rank] = (depth[c.rank] ?? 0) + 1; if (c.bossId) (reports[c.bossId] ??= []).push(c.id); }
  for (const k of Object.keys(reports)) reports[k].sort();
  return { leader: leaderOf(w, fid), reports, depth };
}
// Everything a made man of this organisation owns, protects or holds a share in: its business interests.
export function interestsOf(w: World, fid: Id) {
  const mine = new Set(membersOf(w, fid).map((c) => c.id));
  return Object.values(w.biz).filter((b) => b.open && (mine.has(b.ownerId) || (b.protection && (b.protection.familyId === fid || mine.has(b.protection.collectorId))) || (b.stakes ?? []).some((s) => mine.has(s.holder))));
}
export function logOrg(w: World, fid: Id, kind: string, text: string, who?: Id) {
  const f = w.fam[fid];
  if (!f) return;
  const h = (f.hist ??= []);
  h.push(who ? { t: w.now, kind, text, who } : { t: w.now, kind, text });
  if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX);
}
export function orgRecord(w: World, fid: Id) {
  const f = w.fam[fid];
  const cl = clubOf(w, fid);
  const ms = membersOf(w, fid);
  return {
    id: f.id, name: f.name, history: f.history ?? '', founded: f.founded ?? 0,
    leader: leaderOf(w, fid), acting: f.acting ? w.chars[f.acting] : undefined, leaderSince: f.leaderSince ?? 0,
    members: ms.length, ranks: hierarchyOf(w, fid).depth, hq: cl ? { id: cl.id, name: cl.name, district: cl.district, host: cl.hostId } : undefined,
    treasury: f.treasury ?? 0, interests: interestsOf(w, fid).length, standing: f.standing ?? 50, districts: f.districts, relations: f.rel ?? {}, hist: f.hist ?? [],
  };
}

// ---------------------------------------------------------------- the treasury: one door, one ledger
// Money moves between a man's pocket and the treasury, never appears or disappears. tin - tout is always the balance.
export function treasuryMove(w: World, fid: Id, c: Character, amt: number, why: string): number {
  const f = w.fam[fid];
  amt = Math.round(amt);
  if (!f || !amt) return 0;
  if (amt > 0) { // into the treasury
    amt = Math.min(amt, c.cash);
    if (amt <= 0) return 0;
    c.cash -= amt; f.treasury = (f.treasury ?? 0) + amt; f.tin = (f.tin ?? 0) + amt;
  } else { // out of it
    const out = Math.min(-amt, f.treasury ?? 0);
    if (out <= 0) return 0;
    c.cash += out; f.treasury = (f.treasury ?? 0) - out; f.tout = (f.tout ?? 0) + out; amt = -out;
  }
  const l = (f.tlog ??= []);
  l.push({ t: w.now, d: amt, why, who: c.id });
  if (l.length > TLOG_MAX) l.splice(0, l.length - TLOG_MAX);
  return amt;
}
export const treasuryCheck = (f: Family): number => (f.tin ?? 0) - (f.tout ?? 0) - (f.treasury ?? 0);

export const DUES_FLOOR: Record<string, number> = { soldier: 1500, capo: 4000, underboss: 8000 };
const SUPPORT: Record<string, number> = { associate: 0, soldier: 120, capo: 200, underboss: 300, boss: 400 };
export function treasuryWeek(w: World) {
  for (const f of orgList(w)) {
    const lead = leaderOf(w, f.id);
    const ms = membersOf(w, f.id).sort((a, b) => (a.id < b.id ? -1 : 1));
    // income from subordinates: a small tithe on what a made man holds above his floor
    for (const c of ms) {
      const floor = DUES_FLOOR[c.rank];
      if (!floor || c.jailedUntil > w.now) continue;
      const due = Math.round(Math.min(c.cash - floor, 3000) * 0.03);
      if (due >= 10 && treasuryMove(w, f.id, c, due, `dues from ${c.name}`) && c.isPlayer) addFact(w, { kind: 'report', actor: c.id, minor: true, text: `Your dues to the family fund this week: ${money(due)}.`, district: c.district }, { witnesses: [c.id] });
    }
    // a rich boss puts something in of his own
    if (lead && !lead.isPlayer && lead.cash > 20000) treasuryMove(w, f.id, lead, Math.min(1500, Math.round((lead.cash - 20000) * 0.08)), `${lead.name} puts in`);
    // obligations: a made man inside is looked after, his family is not left to the street
    let short = 0;
    for (const c of ms) {
      if (c.jailedUntil <= w.now) continue;
      const need = SUPPORT[c.rank] ?? 0;
      if (!need) continue;
      if ((f.treasury ?? 0) >= need) treasuryMove(w, f.id, c, -need, `support for ${c.name} inside`);
      else short++;
    }
    if (short && lead) {
      for (const c of ms) if (c.id !== lead.id && !c.isPlayer && c.rank !== 'associate') feel(w, c, lead.id, 'trust', -(0.004 * short));
      if (!(f.hist ?? []).some((h) => h.kind === 'fund' && w.now - h.t < 8 * WEEK)) logOrg(w, f.id, 'fund', `The fund could not cover the men inside. Their families noticed.`);
    }
    // Stage 4 (money with a purpose): a made man who is going under to someone outside the family is not left to it. If the man at the
    // top trusts him, the fund clears the debt before it goes bad, and the man owes him for it (a favour, which is called in later).
    if (lead && !lead.isPlayer) for (const d of w.debts) {
      if (d.status !== 'active' || d.missed < 2) continue;
      const c = w.chars[d.debtor], cr = w.chars[d.creditor];
      if (!c?.alive || c.familyId !== f.id || LADDER.indexOf(c.rank) < 1 || !cr || cr.familyId === f.id || c.id === lead.id) continue;
      if (d.balance > (f.treasury ?? 0) * 0.25 || peek(lead, c.id).trust < 0.4) continue;
      const got = -treasuryMove(w, f.id, c, -d.balance, `${c.name}'s debt to ${cr.name}`); // (out of the fund comes back negative)
      if (got <= 0) continue;
      payDebt(w, d, got);
      addFavour(w, lead.id, c.id, 2, `the family cleared his debt to ${cr.name}`);
      addFact(w, { kind: 'report', actor: lead.id, victim: c.id, amount: got, text: `The ${f.name} family cleared ${money(got)} ${c.name} owed ${cr.name}. He owes ${lead.name} for it.`, district: c.district }, { witnesses: [lead.id, c.id, cr.id] });
    }
    // a greedy NPC leader helps himself when the fund runs fat
    if (lead && !lead.isPlayer && lead.traits.greed > 0.65 && (f.treasury ?? 0) > 15000) {
      const take = Math.round(((f.treasury ?? 0) - 15000) * 0.3);
      if (treasuryMove(w, f.id, lead, -take, `${lead.name} draws`)) for (const c of ms) if (c.rank === 'capo' || c.rank === 'underboss') if (c.id !== lead.id) feel(w, c, lead.id, 'trust', -0.01);
    }
  }
}

// ---------------------------------------------------------------- leadership: who takes the chair
export interface Cand { c: Character; score: number; support: number; parts: Record<string, number> }
const RANK_W: Record<string, number> = { boss: 1.2, underboss: 1.0, capo: 0.55, soldier: 0.2, associate: 0.03 };
const VOTE_W: Record<string, number> = { underboss: 2, capo: 1.5, soldier: 0.6, associate: 0.15 };
export interface SuccOpts { favoured?: Id; cause?: string }

export function candidates(w: World, fid: Id, not?: Id, o: SuccOpts = {}): Cand[] {
  const f = w.fam[fid];
  const pool = membersOf(w, fid).filter((x) => x.id !== not && !x.prospect);
  // authority: how many men answer to him, directly or through others
  const kids: Record<Id, Id[]> = {};
  for (const c of pool) if (c.bossId) (kids[c.bossId] ??= []).push(c.id);
  const reach = (id: Id, seen = new Set<Id>()): number => { let n = 0; for (const k of kids[id] ?? []) if (!seen.has(k)) { seen.add(k); n += 1 + reach(k, seen); } return n; };
  const voters = pool.filter((x) => x.rank !== 'associate' && !x.isPlayer);
  const totalW = voters.reduce((a, v) => a + (VOTE_W[v.rank] ?? 0.5), 0) || 1;
  const out: Cand[] = [];
  for (const c of pool) {
    let sup = 0;
    for (const v of voters) {
      if (v.id === c.id) continue;
      const r = rel(v, c.id);
      let s = r.trust * 0.5 + r.respect * 0.3 - r.grudge * 0.5;
      if (v.bossId === c.id) s += 0.25;
      if (c.bossId === v.id) s += 0.1;
      sup += (VOTE_W[v.rank] ?? 0.5) * s;
    }
    sup = sup / totalW;
    const parts: Record<string, number> = {
      rank: RANK_W[c.rank] ?? 0.5,
      authority: Math.min(1, reach(c.id) / 10) * 0.6,
      support: sup * 1.6,
      reputation: (c.standing / 100) * 0.4 + Math.min(1, c.lifetimeKick / 20000) * 0.15 + c.traits.courage * 0.08,
      will: c.traits.ambition * 0.1,
    };
    if (f.heir === c.id) parts.named = 1.6 * clamp(0.6 + sup, 0.1, 1); // the boss's word counts for a lot, unless the house is against it
    if (f.consigliere === c.id) parts.counsel = 0.1;
    const prev = not ? w.chars[not] : undefined;
    if (prev && o.cause === 'death') parts.loyal = rel(c, prev.id).trust * 0.15; // the dead man's trusted lieutenant
    if (c.jailedUntil > w.now) parts.inside = c.jailedUntil - w.now > 3 * WEEK ? -0.8 : -0.3;
    if (c.hurtUntil > w.now) parts.hurt = -0.1;
    if (o.favoured === c.id) parts.mandate = 1.5;
    out.push({ c, score: Object.values(parts).reduce((a, x) => a + x, 0), support: sup, parts });
  }
  return out.sort((a, b) => b.score - a.score || (a.c.id < b.c.id ? -1 : 1));
}
// Pure: no randomness, no writes. Also what rank.successor() now uses.
export function chooseLeader(w: World, fid: Id, not?: Id, o: SuccOpts = {}): Character | undefined {
  const cs = candidates(w, fid, not, o);
  if (o.favoured) { const f = cs.find((x) => x.c.id === o.favoured); if (f) return f.c; }
  return cs[0]?.c;
}

const CAUSE: Record<string, string> = {
  death: 'died', coup: 'was removed', imprisonment: 'was put on the shelf by a long sentence', retirement: 'retired', stepped: 'stepped aside', repair: 'left the chair empty',
};
// What a change of leadership leaves behind. The new man must already be installed (fam.bossId, rank).
export function leaderChanged(w: World, fid: Id, winner: Character, oldId: Id | undefined, cause: string, cs?: Cand[]) {
  const f = w.fam[fid];
  const old = oldId ? w.chars[oldId] : undefined;
  cs ??= candidates(w, fid, oldId, { cause });
  const top = cs.find((x) => x.c.id === winner.id);
  const rivals = cs.filter((x) => x.c.id !== winner.id && rankIdx(x.c.rank) >= 2 && x.score >= (top?.score ?? 0) * 0.7 && !x.c.isPlayer);
  const margin = top && cs.length > 1 ? clamp((top.score - (cs.find((x) => x.c.id !== winner.id)?.score ?? 0)) / Math.max(0.5, top.score)) : 1;
  f.leaderSince = w.now;
  delete f.acting;
  if (f.heir === winner.id || (f.heir && !w.chars[f.heir]?.alive)) delete f.heir;
  if (f.consigliere === winner.id || (f.consigliere && !w.chars[f.consigliere]?.alive)) delete f.consigliere;
  const ms = membersOf(w, fid);
  // those who stood with him are owed; those who stood against him are remembered
  let backers = 0;
  for (const v of ms) {
    if (v.id === winner.id || v.isPlayer || v.rank === 'associate') continue;
    const r = rel(v, winner.id);
    if (r.trust >= 0.55) { backers++; feelOn(w, r, 'trust', 0.06); feel(w, winner, v.id, 'trust', 0.08); }
    else if (r.grudge >= 0.4) bear(w, winner, v.id, 0.12, `${v.name} would not back him`);
  }
  let note = '';
  for (const r of rivals) {
    bear(w, r.c, winner.id, 0.25, `${winner.name} took the chair over him`);
    feel(w, r.c, winner.id, 'trust', -0.15);
    repute(w, r.c, -2, 'lost the chair');
    note = ` ${first(r.c)} was passed over and has not forgotten it.`;
  }
  // a thin or violent win leaves the house unsettled for a while, and a clean one steadies it
  const sharp = cause === 'coup' || margin < 0.25 || rivals.length > 0;
  if (sharp) f.unrest = { level: clamp(0.35 + (1 - margin) * 0.5 + (cause === 'coup' ? 0.15 : 0)), until: w.now + 10 * WEEK };
  f.standing = clamp((f.standing ?? 50) + (cause === 'coup' ? -5 : sharp ? -2 : 1), 5, 95);
  // the new man may put a rival in his place
  for (const r of rivals) {
    if (temper(winner).pride + temper(winner).volatility > 1.1 && r.c.rank === 'capo' && rel(r.c, winner.id).grudge >= 0.4 && w.rng.chance(0.4)) {
      applyRank(w, r.c, 'soldier', { fact: false, repair: false, career: `Put down to soldier by ${winner.name} after the succession`, wage: WAGE.soldier });
      note += ` ${first(winner)} put ${first(r.c)} down to soldier.`;
    }
  }
  logOrg(w, fid, 'succession', `${winner.name} took the chair${old ? ` after ${old.name} ${CAUSE[cause] ?? cause}` : ''} (${backers} of ${ms.length} made men behind him).${note}`, winner.id);
  recordCareer(w, winner, `Took over the ${f.name} family (${CAUSE[cause] ?? cause})`);
  // the club is his
  const cl = clubOf(w, fid);
  if (cl) cl.hostId = winner.id;
  if (cl) logOrg(w, fid, 'hq', `${cl.name} is ${winner.name}'s seat now.`, winner.id);
  repairHierarchy(w, fid);
}

// Who else hears that the chair has changed hands (contest.ts registers: a close race may not be over)
export const onSucceed: ((w: World, fid: Id, cand: Character, cs: Cand[], cause: string) => void)[] = [];
// Install a successor and say what happened. `old` is the man leaving the chair (dead, jailed, retiring or stepping aside).
export function succeed(w: World, fid: Id, old: Character | undefined, cause: string, o: SuccOpts = {}): Character | undefined {
  const f = w.fam[fid];
  const cs = candidates(w, fid, old?.id, { ...o, cause });
  const cand = (o.favoured && cs.find((x) => x.c.id === o.favoured)?.c) || cs[0]?.c;
  if (!cand) return undefined;
  const kin = membersOf(w, fid).map((x) => x.id);
  const subs = Object.values(w.chars).filter((x) => x.alive && x.bossId === old?.id && x.id !== cand.id);
  f.bossId = cand.id;
  applyRank(w, cand, 'boss', {
    repair: false,
    place: (x) => { x.bossId = null; for (const s of subs) s.bossId = x.id; },
    fact: { actor: cand.id, text: `${cand.name} takes over the ${f.name} family.`, broadcast: kin },
  });
  leaderChanged(w, fid, cand, old?.id, cause, cs);
  for (const h of onSucceed) h(w, fid, cand, cs, cause);
  return cand;
}

// ---------------------------------------------------------------- leaving the organisation
// One door for leaving: retirement and expulsion both end with a man who is no longer made and no longer anyone's.
export function leave(w: World, c: Character, kind: 'retire' | 'expel', why: string) {
  const fid = c.familyId;
  if (!fid) return;
  const lead = leaderOf(w, fid);
  const wasLead = lead?.id === c.id;
  const subs = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id);
  if (wasLead) { succeed(w, fid, c, 'retirement'); }
  applyRank(w, c, 'civilian', { fact: false, repair: false, career: false, wage: 0 });
  c.familyId = null; c.bossId = null;
  for (const s of subs) if (s.bossId === c.id) s.bossId = w.chars[w.fam[fid].bossId]?.id ?? null;
  const f = w.fam[fid];
  if (f.heir === c.id) delete f.heir;
  if (f.consigliere === c.id) delete f.consigliere;
  if (f.acting === c.id) delete f.acting;
  recordCareer(w, c, kind === 'retire' ? `Retired from the ${f.name} family` : `Put out of the ${f.name} family`);
  for (const b of Object.values(w.biz)) if (b.protection?.collectorId === c.id && kind === 'expel') delete b.protection; // the racket stays with the family, not with a man put out
  addFact(w, { kind: 'promotion', actor: c.id, text: kind === 'retire' ? `${c.name} has retired from the ${f.name} family. ${why}` : `${c.name} has been put out of the ${f.name} family. ${why}`, district: c.district, minor: kind === 'retire' }, { broadcast: membersOf(w, fid).map((x) => x.id) });
  logOrg(w, fid, kind, `${c.name} ${kind === 'retire' ? 'retired' : 'was put out'}. ${why}`, c.id);
  f.lastChurn = w.now;
  repairHierarchy(w, fid);
  ensureClubs(w);
}
export function defect(w: World, c: Character, to: Id, why: string) {
  const from = c.familyId!;
  const F = w.fam[from], T = w.fam[to];
  const lead = leaderOf(w, from);
  const next: Rank = c.rank === 'underboss' ? 'capo' : c.rank === 'capo' ? 'soldier' : c.rank;
  const subs = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id);
  if (F.heir === c.id) delete F.heir;
  if (F.consigliere === c.id) delete F.consigliere;
  if (F.acting === c.id) delete F.acting;
  const upper = c.bossId;
  c.familyId = to; c.bossId = null;
  for (const s of subs) s.bossId = upper; // his men stay with the family they belong to; repair gives them a captain
  if (next !== c.rank) applyRank(w, c, next, { fact: false, repair: false, career: `Came over to the ${T.name} family as a ${next}`, wage: WAGE[next] });
  else recordCareer(w, c, `Came over to the ${T.name} family`);
  for (const b of Object.values(w.biz)) if (b.protection?.collectorId === c.id) b.protection.familyId = to;
  if (lead) { bear(w, lead, c.id, 0.5, `${c.name} went over to the ${T.name} family`); feelTo(lead, c.id, 'trust', 0); }
  addFact(w, { kind: 'promotion', actor: c.id, text: `${c.name} has gone over to the ${T.name} family. ${why}`, district: c.district }, { broadcast: [...membersOf(w, from), ...membersOf(w, to)].map((x) => x.id) });
  logOrg(w, from, 'defect', `${c.name} left for the ${T.name}. ${why}`, c.id);
  logOrg(w, to, 'defect', `${c.name} came over from the ${F.name}.`, c.id);
  noteGrievance(w, from, to, `${c.name} went over`, 0.25);
  F.tension[to] = (F.tension[to] ?? 0) + 1; T.tension[from] = (T.tension[from] ?? 0) + 1;
  F.lastChurn = w.now;
  F.standing = clamp((F.standing ?? 50) - 2, 5, 95); T.standing = clamp((T.standing ?? 50) + 1, 5, 95);
  repairHierarchy(w, from); repairHierarchy(w, to);
  ensureClubs(w);
}

const SPLINTER_NAMES = ['Pagano', 'Donato', 'Grasso', 'Ferraro', 'Cappello', 'Lombardo', 'Sabella', 'Tedesco'];
// An NPC captain with men of his own and a grievance takes them out and sets up on his own. Never the player; never more than MAX_ORGS.
export function foundOrg(w: World, leader: Character, name: string, why: string): Family | undefined {
  const parent = leader.familyId && w.fam[leader.familyId];
  const id = 'fam_' + name.toLowerCase().replace(/[^a-z]/g, '');
  if (!parent || w.fam[id] || Object.keys(w.fam).length >= MAX_ORGS) return undefined;
  const followers: Character[] = [];
  const walk = (cid: Id) => { for (const x of Object.values(w.chars)) if (x.alive && x.bossId === cid && x.familyId === parent.id && !x.isPlayer && x.rank !== 'civilian') { followers.push(x); walk(x.id); } };
  walk(leader.id);
  const lead0 = leaderOf(w, parent.id);
  const fam: Family = { id, name, bossId: leader.id, districts: [leader.district], tension: {}, founded: w.now, history: `Founded by ${leader.name}, who took his men out of the ${parent.name} family.`, leaderSince: w.now, standing: 25, hist: [], rel: {} };
  w.fam[id] = fam;
  for (const o of Object.values(w.fam)) if (o.id !== id) { o.tension[id] = 0; fam.tension[o.id] = 0; }
  leader.familyId = id; leader.bossId = null;
  applyRank(w, leader, 'boss', { fact: false, repair: false, career: `Founded the ${name} family`, wage: WAGE.boss });
  for (const x of followers) x.familyId = id;
  for (const b of Object.values(w.biz)) if (b.protection && (b.protection.collectorId === leader.id || followers.some((x) => x.id === b.protection!.collectorId))) b.protection.familyId = id;
  if (lead0) { bear(w, lead0, leader.id, 0.6, `${leader.name} broke away and took men with him`); feelTo(lead0, leader.id, 'trust', 0); }
  parent.tension[id] = 3; fam.tension[parent.id] = 3;
  noteGrievance(w, parent.id, id, `${leader.name} took his men and left`, 0.6);
  logOrg(w, id, 'founded', fam.history!, leader.id);
  logOrg(w, parent.id, 'splinter', `${leader.name} and ${followers.length} men broke away and formed the ${name} family. ${why}`, leader.id);
  parent.standing = clamp((parent.standing ?? 50) - 6, 5, 95);
  parent.lastChurn = w.now;
  addFact(w, { kind: 'promotion', actor: leader.id, text: `${leader.name} has broken with the ${parent.name} family and taken ${followers.length} men with him. They are calling themselves the ${name} family.`, district: leader.district }, { broadcast: [...membersOf(w, parent.id), ...membersOf(w, id)].map((x) => x.id) });
  repairHierarchy(w, parent.id); repairHierarchy(w, id);
  ensureClubs(w);
  ensureOrgs(w);
  return fam;
}

// ---------------------------------------------------------------- relations between organisations
const relOf = (f: Family, other: Id, now: number): OrgRel => ((f.rel ??= {})[other] ??= { coop: 0, comp: 0, grievance: 0, since: now, deals: [] });
export function noteDeal(w: World, a: Id, b: Id, text: string, coop = 0.1) {
  for (const [x, y] of [[a, b], [b, a]] as [Id, Id][]) {
    const f = w.fam[x]; if (!f || !w.fam[y] || x === y) continue;
    const r = relOf(f, y, w.now);
    r.coop = clamp(r.coop + coop); r.grievance = clamp(r.grievance - coop * 0.5);
    if (r.deals.length && w.now - r.deals[r.deals.length - 1].t < WEEK) continue; // the numbers move; the record keeps only what is distinct
    r.deals.push({ t: w.now, text }); if (r.deals.length > DEALS_MAX) r.deals.shift();
  }
}
export function noteGrievance(w: World, a: Id, b: Id, text: string, amt = 0.15) {
  for (const [x, y] of [[a, b], [b, a]] as [Id, Id][]) {
    const f = w.fam[x]; if (!f || !w.fam[y] || x === y) continue;
    const r = relOf(f, y, w.now);
    r.grievance = clamp(r.grievance + amt); r.coop = clamp(r.coop - amt * 0.5);
    if (r.deals.length && w.now - r.deals[r.deals.length - 1].t < WEEK) continue;
    r.deals.push({ t: w.now, text: `Grievance: ${text}` }); if (r.deals.length > DEALS_MAX) r.deals.shift();
  }
}
// How much the relationship between two organisations should colour a chance of trouble between their men: about 0.4 .. 2.
export function hostility(w: World, a?: Id | null, b?: Id | null): number {
  if (!a || !b || a === b) return 1;
  const r = w.fam[a]?.rel?.[b];
  return r ? clamp(1 + r.comp * 0.8 + r.grievance * 0.8 - r.coop * 0.7, 0.4, 2) : 1;
}
export function relWeek(w: World) {
  const fs = orgList(w);
  const crossDisputes: Record<string, number> = {};
  for (const d of w.disputes ?? []) {
    if (d.status !== 'open' && d.status !== 'violated') continue;
    const A = w.chars[d.a]?.familyId, B = w.chars[d.b]?.familyId;
    if (A && B && A !== B) { const k = [A, B].sort().join('|'); crossDisputes[k] = (crossDisputes[k] ?? 0) + 1; }
  }
  const arr: Record<string, number> = {};
  for (const b of Object.values(w.biz)) {
    if (!b.open) continue;
    const o = w.chars[b.ownerId]?.familyId, p = b.protection ? w.chars[b.protection.collectorId]?.familyId : undefined;
    if (o && p && o !== p) { const k = [o, p].sort().join('|'); arr[k] = (arr[k] ?? 0) + 1; }
    for (const s of b.stakes ?? []) { const h = w.chars[s.holder]?.familyId; if (o && h && o !== h) { const k = [o, h].sort().join('|'); arr[k] = (arr[k] ?? 0) + 1; } }
  }
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const A = fs[i], B = fs[j];
    const la = leaderOf(w, A.id), lb = leaderOf(w, B.id);
    const tn = ((A.tension[B.id] ?? 0) + (B.tension[A.id] ?? 0)) / 2;
    const shared = A.districts.filter((d) => B.districts.includes(d)).length;
    const pers = la && lb ? (rel(la, lb.id).trust + rel(lb, la.id).trust) / 2 : 0;
    const gr = la && lb ? Math.max(rel(la, lb.id).grudge, rel(lb, la.id).grudge) : 0;
    const k = [A.id, B.id].sort().join('|');
    const compT = clamp(tn / 8 + shared * 0.1);
    const coopT = clamp(pers * 0.5 + Math.min(0.4, (arr[k] ?? 0) * 0.1));
    const grT = clamp(gr * 0.6 + (crossDisputes[k] ?? 0) * 0.15 + tn / 14);
    for (const [x, y] of [[A, B], [B, A]] as [Family, Family][]) {
      const r = relOf(x, y.id, w.now);
      r.comp = clamp(r.comp + (compT - r.comp) * 0.15);
      r.coop = clamp(r.coop + (coopT - r.coop) * 0.15);
      r.grievance = clamp(r.grievance + (grT - r.grievance) * 0.15);
    }
  }
  // round so saved text stays short and stable
  for (const f of fs) for (const r of Object.values(f.rel ?? {})) { r.coop = Math.round(r.coop * 1000) / 1000; r.comp = Math.round(r.comp * 1000) / 1000; r.grievance = Math.round(r.grievance * 1000) / 1000; }
}

// ---------------------------------------------------------------- the weekly pass
function standingWeek(w: World) {
  for (const f of orgList(w)) {
    const ms = membersOf(w, f.id);
    const lead = leaderOf(w, f.id);
    const target = clamp(20 + Math.min(30, ms.length * 0.6) + f.districts.length * 6 + Math.min(15, interestsOf(w, f.id).length * 0.8) + (lead ? 0 : -15) + (lead && lead.jailedUntil > w.now ? -8 : 0) - (f.unrest && f.unrest.until > w.now ? 6 : 0), 5, 95);
    const was = f.standing ?? 50;
    f.standing = Math.round(clamp((f.standing ?? 50) + (target - (f.standing ?? 50)) * 0.05, 5, 95) * 10) / 10;
    // Foundation step 2: a boss's own name rises and falls with his family's (he rarely acts in person, so his deeds are the family's)
    if (lead && f.standing !== was) repute(w, lead, (f.standing - was) * 0.5, 'family fortunes');
    if (f.unrest && f.unrest.until <= w.now) delete f.unrest;
  }
}
function leadershipWeek(w: World) {
  for (const f of orgList(w)) {
    const boss = leaderOf(w, f.id);
    if (!boss) continue;
    if (f.heir && (!w.chars[f.heir]?.alive || w.chars[f.heir].familyId !== f.id)) delete f.heir;
    if (f.consigliere && (!w.chars[f.consigliere]?.alive || w.chars[f.consigliere].familyId !== f.id)) delete f.consigliere;
    const inside = boss.jailedUntil > w.now ? boss.jailedUntil - w.now : 0;
    if (inside > 21 * DAY && !f.acting) {
      const act = candidates(w, f.id, boss.id).find((x) => x.c.jailedUntil <= w.now && rankIdx(x.c.rank) >= 2 && (!x.c.isPlayer || x.c.rank === 'underboss'))?.c; // (the player too, as underboss: The Family's acting boss)
      if (act) { f.acting = act.id; logOrg(w, f.id, 'acting', `${boss.name} is inside. ${act.name} is running things.`, act.id); addFact(w, { kind: 'promotion', actor: act.id, text: `${boss.name} is away. ${act.name} is running the ${f.name} family until he is back.`, district: act.district, minor: true }, { broadcast: membersOf(w, f.id).map((x) => x.id) }); }
    }
    if (f.acting && inside === 0) { logOrg(w, f.id, 'acting', `${boss.name} is back. ${w.chars[f.acting]?.name ?? 'The acting boss'} steps back.`); if (w.chars[f.acting]?.isPlayer) bossBack(w, boss, w.chars[f.acting]); delete f.acting; }
    if (f.acting && (!w.chars[f.acting]?.alive || w.chars[f.acting].familyId !== f.id)) delete f.acting;
    // a very long sentence ends a reign (never the player's)
    if (inside > 120 * DAY && !boss.isPlayer) {
      const next = succeed(w, f.id, boss, 'imprisonment');
      if (next && next.id !== boss.id) {
        applyRank(w, boss, 'capo', { fact: false, repair: false, career: `Put on the shelf while inside`, wage: WAGE.capo, place: (x) => { x.bossId = next.id; } });
        bear(w, boss, next.id, 0.2, `${next.name} took his chair while he was inside`);
        repairHierarchy(w, f.id);
      }
      continue;
    }
    // an old, careful boss with a quiet house may step down
    if (!boss.isPlayer && f.leaderSince !== undefined && w.now - f.leaderSince > 156 * WEEK && temper(boss).caution > 0.6 && boss.cash > 12000 && w.rng.chance(0.006)) {
      const heirOk = candidates(w, f.id, boss.id)[0];
      if (heirOk && !heirOk.c.isPlayer) { const next = succeed(w, f.id, boss, 'retirement'); if (next) leave(w, boss, 'retire', `He has had enough, and ${next.name} has the family's blessing.`); }
    }
  }
}
function churnWeek(w: World) {
  const fs = orgList(w);
  for (const f of fs) {
    const lead = leaderOf(w, f.id);
    if (!lead || (f.lastChurn !== undefined && w.now - f.lastChurn < 6 * WEEK)) continue;
    const unrest = f.unrest && f.unrest.until > w.now ? f.unrest.level : 0;
    const ms = membersOf(w, f.id).filter((c) => !c.isPlayer && c.id !== lead.id && c.jailedUntil <= w.now && c.rank !== 'associate' && c.id !== f.acting).sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const c of ms) {
      const r = rel(c, lead.id);
      const disc = discontent(w, c, lead, unrest);
      // expulsion: a man the boss has stopped tolerating
      if (rel(lead, c.id).grudge >= 0.6 && rankIdx(c.rank) <= 2 && w.rng.chance(0.03)) { leave(w, c, 'expel', `${lead.name} wanted him gone.`); break; }
      // defection: a man who has had enough, and has somewhere to go
      if (disc >= 0.5 && w.rng.chance(clamp((disc - 0.45) * 0.01, 0, 0.03))) {
        const dest = fs.filter((o) => o.id !== f.id && leaderOf(w, o.id)).map((o) => { const ol = leaderOf(w, o.id)!; return { o, s: rel(c, ol.id).trust + (o.standing ?? 50) / 200 - (o.rel?.[f.id]?.grievance ?? 0) * 0.2 + (f.rel?.[o.id]?.coop ?? 0) * 0.1 }; }).sort((a, b) => b.s - a.s || (a.o.id < b.o.id ? -1 : 1))[0];
        if (dest && dest.s > 0.2) { defect(w, c, dest.o.id, `He and ${lead.name} had stopped seeing eye to eye.`); break; }
      }
      // splinter: a captain with his own men and a grievance, in an unsettled house
      if (c.rank === 'capo' && unrest > 0 && disc >= 0.7 && fs.length < MAX_ORGS && w.rng.chance(0.02)) {
        const crew = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.familyId === f.id).length;
        const name = SPLINTER_NAMES.find((n) => !w.fam['fam_' + n.toLowerCase()]);
        if (crew >= 3 && name && foundOrg(w, c, name, `${c.name} had been passed over.`)) break;
      }
      void r;
    }
  }
}
// How much a made man has had of the way he is led: old grudges, no trust, ambition with nowhere to go, an unsettled house.
export function discontent(w: World, c: Character, lead: Character, unrest = 0): number {
  const r = rel(c, lead.id);
  const ceiling = c.rank === 'soldier' ? 1 : c.rank === 'capo' ? 0.7 : 0.4;
  return clamp(r.grudge * 1.2 + Math.max(0, 0.35 - r.trust) + c.traits.ambition * 0.4 * ceiling + unrest * 0.5, 0, 1.5);
}
// Retirement of the ordinary kind: a careful man with money puts his feet up.
function retireWeek(w: World) {
  for (const f of orgList(w)) {
    if (f.lastChurn !== undefined && w.now - f.lastChurn < 6 * WEEK) continue;
    const lead = leaderOf(w, f.id);
    for (const c of membersOf(w, f.id).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (c.isPlayer || c.id === lead?.id || c.jailedUntil > w.now || rankIdx(c.rank) < 1 || rankIdx(c.rank) > 3) continue;
      if (temper(c).caution > 0.6 && c.cash > ({ soldier: 3500, capo: 5500, underboss: 9000 } as Record<string, number>)[c.rank] && w.rng.chance(0.004)) { leave(w, c, 'retire', 'He has the money and the nerve for a quiet life.'); break; }
    }
  }
}
export function orgWeek(w: World) {
  ensureClubs(w);
  leadershipWeek(w);
  for (const f of orgList(w)) { const cl = clubOf(w, f.id); if (cl && f.hq !== cl.id) f.hq = cl.id; if (cl && cl.hostId !== f.bossId && leaderOf(w, f.id)) cl.hostId = f.bossId; }
  treasuryWeek(w);
  relWeek(w);
  standingWeek(w);
  churnWeek(w);
  retireWeek(w);
}

// ---------------------------------------------------------------- one-time shaping (new worlds and older saves)
export function ensureOrgs(w: World) {
  const names = new Set<string>();
  for (const f of Object.values(w.fam)) {
    f.founded ??= -(8 + (f.id.length * 3) % 20) * 52 * WEEK; // before the game began: the setting's families are old
    f.history ??= `The ${f.name} family.`;
    f.treasury ??= 0; f.tin ??= 0; f.tout ??= 0;
    f.hist ??= []; f.rel ??= {};
    f.standing ??= 50;
    f.leaderSince ??= -((f.id.charCodeAt(f.id.length - 1) % 6) + 2) * 52 * WEEK; // the setting's bosses have held the chair a while
    names.add(f.name);
  }
  for (const f of Object.values(w.fam)) for (const o of Object.values(w.fam)) if (o.id !== f.id) { f.tension[o.id] ??= 0; relOf(f, o.id, w.now); }
  for (const f of Object.values(w.fam)) { const cl = clubOf(w, f.id); if (cl) { f.hq = cl.id; cl.hostId ??= f.bossId; } }
  // (The Family: every family has a consigliere; one that has none, new or loaded, has the boss's choice: a careful soldier he trusts)
  // once only: after that a vacant chair is the boss's to fill (succession.successionWeek), so a loaded world and a running one agree
  for (const f of Object.values(w.fam)) {
    if (f.consSeated) continue;
    f.consSeated = true;
    if (!f.consigliere || !w.chars[f.consigliere]?.alive) { const c = consigliereChoice(w, f.id); if (c) seatConsigliere(w, f.id, c, undefined, 'the family has always had a man beside the boss'); }
  }
}
// The boss's choice of consigliere: a made man he trusts, careful and well thought of, not the underboss, and not a captain with a crew
// to run (a captain chosen gives his crew up). Pure: no randomness, so a new world and a loaded one choose alike.
export function consigliereChoice(w: World, fid: Id, not?: Id): Character | undefined {
  const boss = w.chars[w.fam[fid]?.bossId];
  if (!boss?.alive) return undefined;
  const score = (c: Character) => rel(boss, c.id).trust * 1.2 + temper(c).caution * 0.6 + c.standing / 100 + (c.rank === 'soldier' ? 0.2 : 0) - (c.traits.violence > 0.7 ? 0.3 : 0);
  // (a soldier he trusts, as a rule: a captain is taken off his crew only when there is no soldier to choose)
  const pool = (r: string) => Object.values(w.chars).filter((c) => c.alive && c.familyId === fid && c.rank === r && c.id !== not && c.jailedUntil <= w.now && !c.isPlayer).sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1));
  return pool('soldier')[0] ?? pool('capo')[0];
}
// One door for the consigliere's seat: he sits beside the boss and answers to him, commands no crew (a captain's men go to another
// captain), and the appointment is recorded in his career and the family's.
export function seatConsigliere(w: World, fid: Id, c: Character, by: Character | undefined, why: string) {
  const f = w.fam[fid], boss = w.chars[f.bossId];
  if (!f || !boss) return;
  f.consigliere = c.id;
  if (c.rank === 'capo') { applyRank(w, c, 'soldier', { fact: false, career: false, wage: WAGE.capo, repair: false, place: (x) => { x.bossId = boss.id; } }); for (const m of Object.values(w.chars)) if (m.alive && m.bossId === c.id && m.rank === 'soldier') m.bossId = null; }
  c.bossId = boss.id; c.wage = Math.max(c.wage, WAGE.capo);
  (c.career ??= { done: 0, failed: 0, log: [] }).posts = [...(c.career.posts ?? []), { t: w.now, text: `Named consigliere${by ? ` by ${by.name}` : ''}: ${why}`, by: by?.id }];
  if (by) { logOrg(w, fid, 'appointment', `${by.name} named ${c.name} consigliere.`, c.id); addFact(w, { kind: 'promotion', actor: by.id, victim: c.id, text: `${by.name} named ${c.name} consigliere of the ${f.name} family.`, district: c.district }, { broadcast: Object.values(w.chars).filter((x) => x.alive && x.familyId === fid).map((x) => x.id) }); }
  repairHierarchy(w, fid);
}

// ---------------------------------------------------------------- the integrity check (also read by audit())
export function orgIssues(w: World): string[] {
  const bad: string[] = [];
  const ids = Object.keys(w.fam);
  const names = new Set<string>();
  for (const f of Object.values(w.fam)) {
    if (names.has(f.name)) bad.push(`${f.name}: two organisations share a name`);
    names.add(f.name);
    const live = membersOf(w, f.id);
    if (live.length) {
      const lead = w.chars[f.bossId];
      if (!lead?.alive || lead.familyId !== f.id || lead.rank !== 'boss') bad.push(`${f.name}: no valid leader`);
      const bosses = live.filter((c) => c.rank === 'boss');
      if (bosses.length !== 1) bad.push(`${f.name}: ${bosses.length} bosses`);
    }
    if (f.heir && (!w.chars[f.heir]?.alive || w.chars[f.heir].familyId !== f.id)) bad.push(`${f.name}: heir is not a living member`);
    if (f.consigliere && (!w.chars[f.consigliere]?.alive || w.chars[f.consigliere].familyId !== f.id)) bad.push(`${f.name}: consigliere is not a living member`);
    if (f.acting && (!w.chars[f.acting]?.alive || w.chars[f.acting].familyId !== f.id || f.acting === f.bossId)) bad.push(`${f.name}: acting boss is invalid`);
    if ((f.treasury ?? 0) < 0) bad.push(`${f.name}: treasury is negative`);
    if (treasuryCheck(f) !== 0) bad.push(`${f.name}: treasury does not reconcile (${treasuryCheck(f)})`);
    if ((f.hist?.length ?? 0) > HIST_MAX || (f.tlog?.length ?? 0) > TLOG_MAX) bad.push(`${f.name}: history is not bounded`);
    const cl = clubOf(w, f.id);
    if (live.length && !cl) bad.push(`${f.name}: no headquarters`);
    if (cl && (cl.familyId !== f.id || (f.hq && f.hq !== cl.id))) bad.push(`${f.name}: headquarters belongs to someone else`);
    if (cl?.hostId && w.chars[cl.hostId]?.alive && w.chars[cl.hostId].familyId !== f.id) bad.push(`${f.name}: headquarters host is not a member`);
    for (const [k, r] of Object.entries(f.rel ?? {})) {
      if (!ids.includes(k) || k === f.id) bad.push(`${f.name}: relation with unknown organisation ${k}`);
      else for (const v of [r.coop, r.comp, r.grievance]) if (!(v >= 0 && v <= 1)) bad.push(`${f.name}: relation value out of range`);
    }
  }
  for (const c of Object.values(w.chars)) {
    if (!c.alive) continue;
    if (c.familyId && !w.fam[c.familyId]) bad.push(`${c.name} belongs to an organisation that does not exist`);
    if (c.rank !== 'civilian' && !c.familyId) bad.push(`${c.name} is a ${c.rank} with no organisation`);
    if (c.rank === 'civilian' && c.familyId) bad.push(`${c.name} is a civilian with an organisation`);
  }
  return bad;
}
