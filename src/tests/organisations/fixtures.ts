// Fixtures for the organisation and succession checks (from the V76 suite).
import assert from 'node:assert';
import { advance, deserialize, serialize } from '../../engine';
import { createWorld, EXTRA_ORGS, STANDARD_ORGS } from '../../world';
import { DAY, World } from '../../types';
import { audit } from '../../consistency';
import { rel } from '../../core';
import { hierarchyIssues } from '../../rank';
import { promoChoose } from '../../career';
import { chairAct, chairOptions, pathState, trialChoose } from '../../path';
import { openInduction, choose as mchoose, closeMeeting } from '../../meetings';
import { leaderOf, membersOf, orgIssues, orgList } from '../../orgs';
import { P } from '../helpers';

const cache = new Map<string, string>();

/** World `seed` with `orgs` organisations (5 is the standard set), run for `days` days; built once per file and cached as
 * a save. */
export const orgWorld = (seed: number, days: number, orgs: number) => {
  const k = `${seed}:${days}:${orgs}`;
  if (!cache.has(k)) { const defs = orgs === 5 ? undefined : [...STANDARD_ORGS, ...EXTRA_ORGS].slice(0, orgs); const b = createWorld(seed, 'Tony Marino', { orgs: defs }); advance(b, b.now + days * DAY); cache.set(k, serialize(b)); }
  return deserialize(cache.get(k)!);
};

export const clean = (w: World, label = '') => { assert.deepEqual(audit(w), [], 'audit ' + label); assert.deepEqual(orgIssues(w), [], 'orgs ' + label); assert.deepEqual(hierarchyIssues(w), [], 'hierarchy ' + label); };

export const other = (w: World) => orgList(w).find((f) => f.id !== P(w).familyId)!;

export const C = (w: World, A: { id: string }, B: { id: string }) => orgList(w).find((f) => f.id !== A.id && f.id !== B.id)!;

export const rank = (w: World, fid: string, r: string) => membersOf(w, fid).filter((c) => c.rank === r && !c.isPlayer);

// the real road: promotions through the game's own ceremonies, with the player's numbers set to what each step asks for
export function climb(w: World, log: string[] = []) {
  const p = P(w), st = pathState(w);
  for (let step = 0; step < 3; step++) {
    const r0 = p.rank;
    for (let d = 0; d < 60 && p.rank === r0; d++) {
      p.lifetimeKick = 1e6; st.deeds = 999; st.kills = 9; p.standing = 90; p.heat = 0;
      for (const c of Object.values(w.chars)) if (c.alive && c.familyId === p.familyId && c.id !== p.id) { rel(c, p.id).trust = 0.9; rel(c, p.id).respect = 0.8; }
      advance(w, (Math.floor(w.now / DAY) + 1) * DAY + 13 * 60);
      for (const e of w.enc.filter((e) => e.status === 'open' && e.kind === 'promo')) { e.data?.stage === 'trial' ? trialChoose(w, p, e, e.opts![0].code) : promoChoose(w, p, e, e.opts![0].code); e.status = 'done'; }
      const j = w.jobs.find((q) => q.kind === 'summons' && q.meeting === 'induction' && q.status === 'offered');
      if (j) { const m = openInduction(w, p, j); if (typeof m === 'string') continue; for (let i = 0; i < 12 && m.items.length && m.idx < m.items.length; i++) mchoose(w, p, m, 'sure'); closeMeeting(w, p, m); }
    }
    log.push(`day ${Math.round(w.now / DAY)}: ${r0} -> ${p.rank}`);
    assert.notEqual(p.rank, r0, 'the road led somewhere from ' + r0);
  }
  return log;
}

export function playerRun(log: string[] = []) {
  const w = orgWorld(3, 20, 5); const p = P(w); climb(w, log);
  assert.equal(p.rank, 'underboss'); clean(w, 'underboss');
  const fam = w.fam[p.familyId!]; const old = leaderOf(w, fam.id)!;
  rel(old, p.id).trust = 1; rel(old, p.id).respect = 1; old.traits.ambition = 0; old.traits.greed = 0; p.cooldown = {};
  for (let i = 0; i < 40 && fam.bossId !== p.id; i++) { p.cooldown = {}; const o = chairOptions(w, p).find((x) => x.code === 'ask'); if (!o) throw new Error('no chair option'); chairAct(w, p, 'ask'); }
  return { w, p, fam, old, log };
}
