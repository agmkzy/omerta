// Rank, in one place (V72).
//
// Before this file, nine different pieces of code assigned `c.rank` directly, each with its own idea of what else
// should change. Now there is one door:
//   applyRank()        every rank change goes through it: rank, wage, career record, the historical fact, and a hierarchy repair
//   repairHierarchy()  invariants: a living boss who is the family's head, every member answers to a living, senior
//                      man of his own family, and nothing loops
//   successor()        who takes a vacant chair (used by death, by the weekly repair, by the player's own succession)
//   hierarchyIssues()  the same invariants, read-only, for audit() and tests
// Eligibility has one door too: career.readiness(). For NPCs it is the family's rule of thumb; for the player it reads
// the road in path.ts (see career.ts), so the screen, the dialogue and the actual promotion can never disagree.
import { BASE_RATE } from './books';
import { addFact, recordCareer, repute } from './core';
import { chooseLeader, logOrg } from './orgs';
import type { Character, Id, Rank, World } from './types';

export const LADDER: Rank[] = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
export const WAGE: Record<string, number> = { soldier: 150, capo: 300, underboss: 600, boss: 1000 };
export const rankIdx = (r: Rank) => LADDER.indexOf(r);
const members = (w: World, fid: Id) => Object.values(w.chars).filter((c) => c.alive && c.familyId === fid);

export interface RankFact {
  text: string;
  actor?: Id;
  victim?: Id;
  story?: string;
  minor?: boolean;
  broadcast?: Id[];
  witnesses?: Id[];
}
export interface RankOpts {
  by?: Character;
  fact?: RankFact | false; // the historical record; omit for a standard one, false when the caller records it itself
  place?: (c: Character) => void; // where he sits afterwards: set bossId and move his men
  wage?: number;
  career?: string | false; // line for his own career log (false: the caller has written one)
  repair?: false; // skip the hierarchy repair while a larger change is still half done; the caller repairs afterwards
}

// Returns false (and changes nothing) if he already holds that rank, so a promotion can never be applied twice.
export function applyRank(w: World, c: Character, to: Rank, o: RankOpts = {}): boolean {
  const from = c.rank;
  if (from === to) return false;
  const up = rankIdx(to) > rankIdx(from);
  c.rank = to;
  c.wage = o.wage ?? (to === 'associate' ? 80 : WAGE[to] ?? c.wage);
  // a civilian taken into the life starts on the usual share (he paid nobody before, so he was on nothing)
  if (from === 'civilian' && to !== 'civilian' && c.kickRate < BASE_RATE[to]) c.kickRate = BASE_RATE[to];
  const label = (r: Rank) => (r === 'capo' ? 'captain' : r);
  if (o.career !== false) recordCareer(w, c, o.career ?? (rankIdx(from) < 0 || from === 'civilian' ? `Became ${to}` : up ? `Promoted from ${from} to ${to}` : `Put down from ${label(from)} to ${label(to)}`));
  o.place?.(c);
  // a step up is a name made, a step down a name lost; the same for everyone (core.repute)
  if (from !== 'civilian' && to !== 'civilian') repute(w, c, up ? 6 : -6, 'rank');
  else if (from === 'civilian') repute(w, c, 2, 'rank');
  if (o.fact !== false && to !== 'civilian') {
    const f = o.fact ?? { text: up ? `${c.name} was made ${to === 'soldier' ? 'a soldier' : 'a ' + to}.` : `${c.name} was put down to ${to}.` };
    addFact(w, { kind: 'promotion', actor: f.actor ?? c.id, victim: f.victim, story: f.story, minor: f.minor, text: f.text, district: c.district }, { broadcast: f.broadcast, witnesses: f.witnesses });
  }
  if (o.repair !== false && c.familyId) repairHierarchy(w, c.familyId);
  return true;
}

// Who takes an empty chair. Scored, not automatic: rank, authority, the support of the men who matter, reputation and any named
// heir all count (orgs.ts). Kept here under its old name because several callers use it.
export function successor(w: World, fid: Id, not?: Id): Character | undefined {
  return chooseLeader(w, fid, not);
}

// A valid superior is alive, in the same family, and senior to him - or, for a man running for another associate, an associate.
function validSuperior(w: World, c: Character, s?: Character): boolean {
  if (!s || !s.alive || s.id === c.id || s.familyId !== c.familyId) return false;
  if (rankIdx(s.rank) > rankIdx(c.rank)) return true;
  return c.rank === 'associate' && s.rank === 'associate';
}

function nextSuperior(w: World, c: Character, reports: Map<Id, number>): Character | undefined {
  const fam = members(w, c.familyId!);
  for (let r = rankIdx(c.rank) + 1; r < LADDER.length; r++) {
    // (the consigliere sits beside the boss and commands nobody: no man is handed to him)
    const pool = fam.filter((x) => x.rank === LADDER[r] && !x.prospect && w.fam[c.familyId!]?.consigliere !== x.id);
    // spread the load: the man with the fewest direct reports, ties by id
    const x = pool.sort((a, b) => (reports.get(a.id) ?? 0) - (reports.get(b.id) ?? 0) || (a.id < b.id ? -1 : 1))[0];
    if (x) return x;
  }
  return undefined;
}

// Enforce the invariants. Returns a description of every repair so tests (and the curious) can see what was needed.
// Diagnostics only (not saved, never read by the simulation): what repairHierarchy had to fix. Tests read it to see whether
// something upstream is still producing broken hierarchies.
export const REPAIRS: string[] = [];

export function repairHierarchy(w: World, fid: Id): string[] {
  const done: string[] = [];
  const fam = w.fam[fid];
  if (!fam) return done;
  // 1. The chair.
  const head = w.chars[fam.bossId];
  if (!head || !head.alive || head.familyId !== fid || head.rank !== 'boss') {
    const x = successor(w, fid, head && !head.alive ? head.id : undefined);
    if (x) {
      const was = x.rank;
      x.rank = 'boss'; x.bossId = null; x.wage = WAGE.boss;
      fam.bossId = x.id; fam.leaderSince = w.now; delete fam.acting;
      logOrg(w, fid, 'succession', `${x.name} took the chair (the seat had been left empty).`, x.id);
      recordCareer(w, x, `Took over the family (was ${was})`);
      if (was !== 'boss') addFact(w, { kind: 'promotion', actor: x.id, text: `${x.name} takes over the ${fam.name} family.`, district: x.district }, { broadcast: members(w, fid).map((y) => y.id) });
      done.push(`chair -> ${x.name}`);
    }
  }
  const bossNow = w.chars[fam.bossId];
  // A second man calling himself boss is put back to underboss.
  for (const c of members(w, fid)) if (c.rank === 'boss' && c.id !== fam.bossId && bossNow?.alive) { c.rank = 'underboss'; c.wage = WAGE.underboss; done.push(`extra boss ${c.name} -> underboss`); }
  // 2. Everyone answers to someone valid.
  const reports = new Map<Id, number>();
  for (const c of members(w, fid)) if (c.bossId) reports.set(c.bossId, (reports.get(c.bossId) ?? 0) + 1);
  for (const c of members(w, fid).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (c.id === fam.bossId && c.rank === 'boss') { if (c.bossId) { c.bossId = null; done.push(`${c.name} no longer answers to anyone`); } continue; }
    if (c.rank === 'civilian') continue;
    const s = c.bossId ? w.chars[c.bossId] : undefined;
    if (validSuperior(w, c, s)) continue;
    // His old superior's own superior is the natural place to go; otherwise the nearest senior man.
    const up = s && s.familyId === fid && s.alive ? undefined : (s ? w.chars[s.bossId ?? ''] : undefined);
    const to = up && validSuperior(w, c, up) ? up : nextSuperior(w, c, reports);
    if (to && to.id !== c.bossId) {
      if (c.bossId) reports.set(c.bossId, Math.max(0, (reports.get(c.bossId) ?? 1) - 1));
      c.bossId = to.id; reports.set(to.id, (reports.get(to.id) ?? 0) + 1);
      done.push(`${c.name} -> answers to ${to.name}`);
    }
  }
  // 3. No loops (only possible among associates running for associates).
  for (const c of members(w, fid)) {
    const seen = new Set<Id>([c.id]);
    let x = c.bossId ? w.chars[c.bossId] : undefined;
    while (x && x.alive) {
      if (seen.has(x.id)) { c.bossId = bossNow?.id ?? null; done.push(`loop broken at ${c.name}`); break; }
      seen.add(x.id);
      x = x.bossId ? w.chars[x.bossId] : undefined;
    }
  }
  if (done.length && REPAIRS.length < 5000) REPAIRS.push(...done.map((d) => `${fam.name} d${Math.floor(w.now / 1440)}: ${d}`));
  return done;
}

// Diagnostics only (not saved, never read by the simulation): what repairHierarchy had to fix. Tests read it to see whether
// something upstream is still producing broken hierarchies.
export function repairAll(w: World): string[] {
  return Object.keys(w.fam).flatMap((fid) => repairHierarchy(w, fid));
}

// A man stops answering to his superior - cut loose, or walking out to another family. He keeps his rank; the hierarchy
// then gives him a valid place (his own family's nearest senior man, or the new family's).
export function leaveCrew(w: World, c: Character, toFamily?: Id) {
  const old = c.familyId;
  c.bossId = null;
  if (toFamily && w.fam[toFamily] && toFamily !== old) c.familyId = toFamily;
  if (old) repairHierarchy(w, old);
  if (c.familyId && c.familyId !== old) repairHierarchy(w, c.familyId);
}

// Read-only version of the same rules.
export function hierarchyIssues(w: World): string[] {
  const bad: string[] = [];
  for (const fam of Object.values(w.fam)) {
    const live = members(w, fam.id);
    const head = w.chars[fam.bossId];
    if (!live.length) continue; // an extinct family has no chair to check
    if (!head) bad.push(`${fam.name}: head ${fam.bossId} does not exist`);
    else if (!head.alive) bad.push(`${fam.name}: its boss ${head.name} is dead`);
    else if (head.rank !== 'boss') bad.push(`${fam.name}: ${head.name} heads the family but is a ${head.rank}`);
    else if (head.familyId !== fam.id) bad.push(`${fam.name}: its boss belongs to another family`);
    const bosses = live.filter((c) => c.rank === 'boss');
    if (bosses.length > 1) bad.push(`${fam.name}: ${bosses.length} men hold the rank of boss`);
    for (const c of live) {
      if (c.rank === 'civilian') continue;
      if (c.id === fam.bossId) { if (c.bossId) bad.push(`${c.name} is boss but answers to someone`); continue; }
      const s = c.bossId ? w.chars[c.bossId] : undefined;
      if (!c.bossId) bad.push(`${c.name} (${c.rank}) answers to nobody`);
      else if (!s) bad.push(`${c.name} answers to ${c.bossId}, who does not exist`);
      else if (!s.alive) bad.push(`${c.name} answers to ${s.name}, who is dead`);
      else if (!validSuperior(w, c, s)) bad.push(`${c.name} (${c.rank}) answers to ${s.name} (${s.rank}, ${s.familyId === c.familyId ? 'same' : 'other'} family)`);
      const seen = new Set<Id>([c.id]);
      for (let x = s; x; x = x.bossId ? w.chars[x.bossId] : undefined) { if (seen.has(x.id)) { bad.push(`hierarchy loop through ${c.name}`); break; } seen.add(x.id); }
    }
  }
  for (const c of Object.values(w.chars)) {
    if (!c.alive || !c.familyId) continue;
    if (!w.fam[c.familyId]) bad.push(`${c.name} belongs to a family that does not exist`);
  }
  return bad;
}
