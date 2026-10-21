// What it costs to put hands on a man. Rank, family and permission decide who answers for it, and how hard.
import { temper } from './temper';
import { clamp, addFact, famName, rel } from './core';
import { LADDER, members } from './career';
import { isMade, sanctioned } from './politics';
import { threatOf } from './danger';
import { DAY, Character, Id, Rank, World } from './types';

const WEIGHT: Record<Rank, number> = { civilian: 0.5, associate: 1, soldier: 2, capo: 3, underboss: 4, boss: 5 };
const lad = (r: Rank) => LADDER.indexOf(r);
const first = (c: Character) => c.name.split(' ')[0];

// What the game says about it before you commit. Never hides the price.
export function warningFor(w: World, p: Character, x: Character, mode: 'beat' | 'hit'): string {
  const same = !!p.familyId && p.familyId === x.familyId;
  const up = same && lad(x.rank) > lad(p.rank);
  const made = isMade(x);
  const verb = mode === 'hit' ? 'Killing' : 'Beating';
  if (same && up) return `${verb} a man above you in your own family. ${mode === 'hit' ? 'The family will hunt you down.' : 'He won’t forget it, and neither will his friends.'}`;
  if (same && made) return `${verb} a made man of your own family. ${mode === 'hit' ? 'Expect to be hunted.' : 'Expect it to cost you with the boss.'}`;
  if (same) return `${verb} one of your own family. Your boss will want to know why.`;
  if (made && !sanctioned(w, p, x)) return `${verb} a made man without permission. ${mode === 'hit' ? 'His family will come for you.' : 'His family will answer.'}`;
  if (made) return `${verb} a made man with your boss’s blessing. Quiet, but not free.`;
  return mode === 'hit' ? 'Final. Heat follows. So does his family.' : 'Personal. He’ll know who.';
}

// The family puts out word. A few of its hardest men take it personally, and the ladder of danger starts moving.
export function startHunt(w: World, famId: Id, p: Character, sev: number, why: string, spare?: Id) {
  const fam = w.fam[famId];
  if (!fam || !p.alive) return;
  const cur = fam.hunt?.target === p.id ? fam.hunt.sev : 0;
  fam.hunt = { target: p.id, since: fam.hunt?.target === p.id ? fam.hunt.since : w.now, sev: Math.max(cur, sev), why };
  const hunters = members(w, famId)
    .filter((c) => c.id !== p.id && c.id !== spare && c.jailedUntil <= w.now)
    .sort((a, b) => b.traits.violence + WEIGHT[b.rank] * 0.12 - (a.traits.violence + WEIGHT[a.rank] * 0.12))
    .slice(0, Math.min(3, 1 + Math.floor(sev / 2)));
  hunters.forEach((h, i) => {
    const r = rel(h, p.id);
    r.grudge = Math.max(r.grudge, 0.85);
    r.trust = 0;
    r.respect = Math.min(r.respect, 0.05);
    const t = threatOf(w, h);
    t.level = Math.max(t.level, i === 0 && sev >= 3 ? 2 : 1);
    t.truce = 0;
    t.hidden = 0;
    t.last = w.now - 8 * DAY + i * 9 * DAY; // they don't all come at once
  });
  addFact(w, { kind: 'report', actor: p.id, minor: false, text: `The ${fam.name} family has put out word on you. ${why}`, story: 'hunt:' + famId, district: p.district }, { witnesses: [p.id] });
}

export function huntDue(w: World, q: import('./types').Pending) {
  const p = q.a ? w.chars[q.a] : undefined;
  const fid = q.c;
  if (!p?.alive || !fid || !w.fam[fid]) return;
  if (w.rng.chance(0.6)) startHunt(w, fid, p, q.amount ?? 1, q.note ?? '', q.b);
}

const standingLoss = (p: Character, n: number) => { p.standing = clamp(p.standing - n, 0, 100); };

// Called straight after the act. Returns what the player gets told.
export function aftermath(w: World, p: Character, x: Character, mode: 'beat' | 'hit'): string[] {
  const lines: string[] = [];
  const done = mode === 'hit' ? !x.alive : x.hurtUntil > w.now;
  if (!done) return lines;
  const sev = WEIGHT[x.rank];
  const same = !!p.familyId && p.familyId === x.familyId;
  const up = same && lad(x.rank) > lad(p.rank);
  const made = isMade(x);
  const sanc = sanctioned(w, p, x);
  const boss = p.bossId && p.bossId !== x.id ? w.chars[p.bossId] : undefined;
  const xBoss = x.bossId ? w.chars[x.bossId] : undefined;
  const kill = mode === 'hit';
  const hunt = (famId: Id, s: number, why: string, immediate: boolean) => {
    if (immediate) { startHunt(w, famId, p, s, why, x.id); return; }
    (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(3, 20) * DAY, kind: 'hunt', a: p.id, b: x.id, c: famId, amount: s, note: why });
  };
  const everyone = (famId: Id, trust: number, respect: number) => {
    for (const c of members(w, famId)) { if (c.id === p.id) continue; const r = rel(c, p.id); r.trust = clamp(r.trust + trust); r.respect = clamp(r.respect + respect); }
  };

  if (same && (up || made)) {
    const fid = p.familyId!;
    if (kill) {
      standingLoss(p, 40 + sev * 8);
      everyone(fid, -0.45, -0.3);
      hunt(fid, Math.min(5, sev + 1), `${x.name} was ${x.rank === 'boss' ? 'the head of' : 'one of'} the family. Nobody else had a reason.`, true);
      lines.push(`${x.name} was one of your own. The ${famName(w, p)} family won’t ask who. It will simply start looking.`);
    } else {
      standingLoss(p, 10 + sev * 5);
      everyone(fid, -0.15, -0.15);
      rel(x, p.id).grudge = 0.9; rel(x, p.id).trust = 0;
      if (xBoss?.alive && xBoss.id !== p.id) rel(xBoss, p.id).grudge = clamp(rel(xBoss, p.id).grudge + 0.3);
      if (up) {
        const t = threatOf(w, x); t.level = Math.max(t.level, 1); t.truce = 0; t.last = w.now - 6 * DAY;
        if (sev >= 3) hunt(fid, Math.round(sev / 2), `You put your hands on ${x.name}.`, true);
      }
      lines.push(up ? `A man above you in the family, and you put him on the floor. ${first(x)} will remember. So will everyone he drinks with.` : `${first(x)} is made, and so are the men who will hear about it. That’s a mark against you.`);
    }
    return lines;
  }
  if (same) {
    // a man of your own who isn't made: your boss and his crew will want an answer
    if (boss) { const r = rel(boss, p.id); r.trust = clamp(r.trust - (kill ? 0.3 : 0.1)); r.respect = clamp(r.respect - (kill ? 0.2 : 0.05)); }
    for (const c of Object.values(w.chars)) if (c.alive && c.bossId === p.id && c.id !== x.id) { const r = rel(c, p.id); r.trust = clamp(r.trust - (kill ? 0.3 : 0.1)); r.respect = clamp(r.respect - (kill ? 0.1 : 0)); }
    standingLoss(p, kill ? 25 : 6);
    if (kill) hunt(p.familyId!, 1, `${x.name} went missing and you were the last to see him.`, false);
    lines.push(kill ? `Your own man. Your crew will not forget how easily you did it.` : `He was one of yours. The men who work for you saw how you handle your own.`);
    return lines;
  }
  if (x.familyId && made) {
    const fid = x.familyId;
    if (!sanc) {
      if (boss) { const r = rel(boss, p.id); r.trust = clamp(r.trust - (kill ? 0.3 : 0.12)); }
      standingLoss(p, kill ? 15 + sev * 5 : 6);
      lines.push(`Nobody gave you leave to touch a made man. ${boss ? first(boss) + ' will hear before you can tell him.' : 'It will get back.'}`);
      if (kill) {
        if (sev >= 4) {
          for (const a of Object.values(w.fam)) if (a.id !== fid && p.familyId) { /* all other houses watch */ }
          if (p.familyId) { w.fam[p.familyId].tension[fid] = Math.max(w.fam[p.familyId].tension[fid] ?? 0, 9); w.fam[fid].tension[p.familyId] = Math.max(w.fam[fid].tension[p.familyId] ?? 0, 9); }
          lines.push(`This is no longer about you. The ${w.fam[fid].name} family will treat it as war.`);
        }
        hunt(fid, Math.min(5, sev + 1), `${x.name} is dead and they know where to look.`, sev >= 3);
      } else {
        rel(x, p.id).grudge = 0.9;
        if (xBoss?.alive) rel(xBoss, p.id).grudge = clamp(rel(xBoss, p.id).grudge + 0.25);
        if (sev >= 3) hunt(fid, 1, `You put ${x.name} in the hospital.`, false);
      }
    } else if (boss) { rel(boss, p.id).trust = clamp(rel(boss, p.id).trust + 0.04); }
    return lines;
  }
  // everyone else: associates and civilians. The kin and the boss, if he had one, will want it paid back.
  if (xBoss?.alive && xBoss.familyId && xBoss.familyId !== p.familyId && isMade(xBoss)) {
    rel(xBoss, p.id).grudge = clamp(rel(xBoss, p.id).grudge + (kill ? 0.5 : 0.25));
    if (kill) hunt(xBoss.familyId, 1, `${x.name} was theirs.`, false);
  }
  if (kill) p.heat = clamp(p.heat + 0.25, 0, 1.5);
  const kin = Object.values(w.chars).filter((y) => y.alive && y.id !== p.id && (y.rels[x.id]?.affection ?? 0) > 0.4 && temper(y).volatility + temper(y).pride * 0.3 > 0.5).slice(0, 2);
  for (const y of kin) {
    const r = rel(y, p.id); r.grudge = Math.max(r.grudge, kill ? 0.85 : 0.5);
    if (kill) { const t = threatOf(w, y); t.level = Math.max(t.level, 1); t.truce = 0; t.last = w.now - 6 * DAY; }
  }
  if (kin.length && kill) lines.push(`${x.name} had people who loved him. ${kin.map((y) => first(y)).join(' and ')} won’t let it lie.`);
  void DAY;
  return lines;
}

// ---- ways to kill a man: the quieter the method, the less likely it works, and the less likely anyone sees it.
export interface KillMethod { code: string; label: string; what: string; ok: number; seen: number; cost?: number }
const METHODS: { code: string; label: string; what: string; ok: number; seen: number; cost?: number }[] = [
  { code: 'open', label: 'Shoot him in the open', what: 'Walk up and do it. Fast and certain, and everyone on the street gets a look.', ok: 0.97, seen: 0.85 },
  { code: 'street', label: 'Hit him on the street', what: 'A drive-by or a doorway. Mostly works, and there is a fair chance someone sees.', ok: 0.88, seen: 0.6 },
  { code: 'ambush', label: 'Wait for him and ambush him', what: 'Patient work. He can slip you, but the quiet helps.', ok: 0.78, seen: 0.35 },
  { code: 'contract', label: 'Pay outside men', what: 'Strangers do it for $1,500. Nothing ties it to you directly, unless they talk.', ok: 0.7, seen: 0.2, cost: 1500 },
  { code: 'pro', label: 'Hire a professional', what: 'A real hitman from out of town. Expensive, and he almost never fails or gets seen. Nothing leads back to you.', ok: 0.94, seen: 0.04, cost: 0 },
  { code: 'accident', label: 'Arrange an accident', what: 'A fall, a fire, a car. Often it just does not take.', ok: 0.55, seen: 0.08 },
  { code: 'poison', label: 'Poison him', what: 'Slow and deniable. Easily botched, and nobody knows it was you.', ok: 0.45, seen: 0.03 },
];
export function killMethods(w: World, p: Character, x: Character): KillMethod[] {
  // the harder he is to reach, the worse every method does
  const guard = Object.values(w.chars).filter((c) => c.alive && c.bossId === x.id && c.id !== p.id).length;
  const hard = clamp(WEIGHT[x.rank] * 0.03 + guard * 0.02 + temper(x).caution * 0.05, 0, 0.3);
  const skill = (p.skills.muscle ?? 0) * 0.08;
  const crowd = Object.values(w.chars).filter((c) => c.alive && c.district === x.district && c.id !== p.id && c.id !== x.id).length;
  const busy = clamp(crowd / 80, 0, 0.12);
  return METHODS.map((m) => ({
    ...m,
    cost: m.code === 'pro' ? 4000 + WEIGHT[x.rank] * 2500 : m.cost,
    ok: Math.round(clamp(m.ok - hard + skill, 0.05, 0.99) * 100) / 100,
    seen: Math.round(clamp(m.seen + busy * (m.seen > 0.1 ? 1 : 0.2), 0.01, 0.97) * 100) / 100,
  }));
}
