// The family's direction (The Family, October 2026): what the boss wants the family to be doing for now, said once to the captains, and
// read afterwards by the men's own choices. Not a button that changes numbers: each captain hears it through his own interests, and
// a captain it doesn't suit may let his crew go on as before, which is noticed.
//
//   earn        "make money": men with one racket are readier to start another (rackets.startEnterprises)
//   quiet       "keep your heads down": shakedowns and paybacks weigh less in every man's day (actions.generate)
//   hard        "nobody pushes us": paybacks against other families weigh more (actions.generate)
//   discipline  "clean house": a captain looks harder at a man's numbers (books.settleOne)
import { addFact, bear, feel, peek } from './core';
import { temper } from './temper';
import { WEEK, type Character, type Id, type World } from './types';

export type Policy = 'earn' | 'quiet' | 'hard' | 'discipline';
export const POLICY: Record<Policy, { label: string; said: string; hint: string }> = {
  earn: { label: 'Make money', said: 'This year we earn. Every crew opens something new.', hint: 'Men with one racket start a second sooner. The greedy like it; the cautious worry about heat.' },
  quiet: { label: 'Keep your heads down', said: 'For now nobody makes noise. No shakedowns, no paybacks, nothing the papers want.', hint: 'Fewer shakedowns and paybacks. The violent and the proud chafe at it.' },
  hard: { label: 'Nobody pushes us', said: 'Anybody from another family puts a hand on one of ours, he answers for it.', hint: 'Paybacks against other families come quicker. The cautious think it starts a war.' },
  discipline: { label: 'Clean house', said: 'Every envelope in full. A captain who isn’t watching his men’s numbers will answer to me.', hint: 'Captains look harder at their men’s numbers. Men who skim, and captains who let them, resent it.' },
};
const famOf = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId] : undefined);
// the direction a man is under, as he takes it: his captain's dissent means his crew goes on as before
export function policyFor(w: World, c: Character): Policy | undefined {
  const f = famOf(w, c), pol = f?.policy;
  if (!pol || pol.until <= w.now) return undefined;
  let cap: Character | undefined = c;
  for (let i = 0; cap && i < 4 && cap.rank !== 'capo'; i++) cap = cap.bossId ? w.chars[cap.bossId] : undefined;
  if (cap && (pol.deaf ?? []).includes(cap.id)) return undefined;
  return pol.kind as Policy;
}
// What it does to a captain's view of the boss, and whether he goes along: by what it costs his interests and nature
function takes(w: World, cap: Character, kind: Policy): number {
  const t = cap.traits, tp = temper(cap);
  return kind === 'earn' ? t.greed * 0.4 + t.ambition * 0.2 - tp.caution * 0.2
    : kind === 'quiet' ? tp.caution * 0.4 - t.violence * 0.4 - tp.pride * 0.15
      : kind === 'hard' ? t.violence * 0.4 + tp.pride * 0.2 - tp.caution * 0.35
        : -(cap.books.skim || cap.books.hide ? 0.4 : 0) + tp.agreeable * 0.2 - t.greed * 0.25;
}
export function setPolicy(w: World, boss: Character, kind: Policy): string[] {
  const f = famOf(w, boss);
  if (!f) return [];
  if (f.policy && f.policy.until > w.now && f.policy.kind === kind) return ['That is already the word.'];
  if (f.policy && w.now - f.policy.since < 3 * WEEK) return ['You only just told them otherwise. A boss who changes his mind every week isn’t listened to.'];
  const caps = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id && c.rank === 'capo' && f.consigliere !== c.id);
  const deaf: Id[] = [], warm: string[] = [], cold: string[] = [];
  for (const c of caps) {
    const v = takes(w, c, kind) + peek(c, boss.id).trust * 0.3 + (peek(c, boss.id).fear ?? 0) * 0.3;
    if (v < -0.05) { deaf.push(c.id); cold.push(c.name.split(' ')[0]); bear(w, c, boss.id, 0.04, `${boss.name}’s new word goes against how he runs his crew`); }
    else if (v > 0.3) { warm.push(c.name.split(' ')[0]); feel(w, c, boss.id, 'respect', 0.02); }
  }
  f.policy = { kind, since: w.now, until: w.now + 12 * WEEK, deaf };
  addFact(w, { kind: 'event', actor: boss.id, minor: false, text: `${boss.name} told the captains: “${POLICY[kind].said}”`, district: boss.district }, { broadcast: Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id).map((c) => c.id) });
  const out = [`You tell the captains: “${POLICY[kind].said}”`];
  if (warm.length) out.push(`${warm.join(' and ')} ${warm.length === 1 ? 'nods' : 'nod'} along.`);
  if (cold.length) out.push(`${cold.join(' and ')} ${cold.length === 1 ? 'says' : 'say'} nothing. Whether ${cold.length === 1 ? 'his crew goes' : 'their crews go'} along, you’ll see.`);
  return out;
}
// whether a captain who went along is in fact doing it: what the boss could see, without being told
export function policyReport(w: World, boss: Character): string[] {
  const f = famOf(w, boss), pol = f?.policy;
  if (!f || !pol || pol.until <= w.now) return [];
  const caps = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id && c.rank === 'capo' && f.consigliere !== c.id);
  return caps.filter((c) => (pol.deaf ?? []).includes(c.id) && peek(boss, c.id).trust < 0.7).map((c) => `${c.name}’s crew goes on as if you hadn’t said anything.`).slice(0, 2);
}
