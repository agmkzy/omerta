// Who the player has met, and who could introduce him (moved out of the old conversation engine, Gate 4: the world needs it, not a
// screen). A man you have been introduced to, your own boss and men, your kin, anyone who has come to you, a shop you collect from, a
// man you owe or who owes you, a man whose work you do, and a man you have put terms to, or who has put terms to you.
import { ownerBiz } from './core';
import type { Character, World } from './types';

// You can't talk business with a man you haven't met. Your own boss, your own men, your kin and anyone who's come to you already don't count as strangers.
export function introduced(w: World, p: Character, t: Character): boolean {
  if (t.id === p.id || p.intro?.[t.id] != null) return true;
  if (t.id === p.bossId || t.bossId === p.id || t.id === p.backer || t.id === p.sponsor) return true;
  if (p.bossId && t.bossId === p.bossId) return true; // (V90: men in the same crew know each other)
  if (w.life && (w.life.partner?.id === t.id || w.life.kin.some((k) => k.id === t.id))) return true;
  if (w.enc.some((e) => e.from === t.id)) return true;
  if (ownerBiz(w, t.id)?.protection?.collectorId === p.id) return true;
  if (w.debts.some((x) => (x.creditor === p.id && x.debtor === t.id) || (x.creditor === t.id && x.debtor === p.id))) return true;
  if (w.jobs.some((j) => j.giver === t.id && j.assignee === p.id)) return true;
  // (V90: a man you have put terms to, or who has put terms to you, has met you)
  if ((w.situations ?? []).some((s) => s.kind === 'ask' && ((s.terms?.by === p.id && s.terms?.of === t.id) || (s.terms?.by === t.id && s.terms?.of === p.id)))) return true;
  return false;
}
export function introducers(w: World, p: Character, t: Character): Character[] {
  const cand = [p.bossId, p.backer, p.sponsor].filter(Boolean).map((id) => w.chars[id!]).filter((c) => c?.alive && c.id !== t.id);
  return cand.filter((c) => c.bossId === t.id || t.bossId === c.id || (c.familyId && c.familyId === t.familyId) || (c.rels[t.id] && c.rels[t.id].lastMet > -1e8) || (c.familyId && t.rank === 'civilian' && w.fam[c.familyId]?.districts.includes(t.district))).slice(0, 2);
}
