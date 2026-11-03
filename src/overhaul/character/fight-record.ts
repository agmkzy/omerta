// What a fight leaves behind, applied to a cast's record. A sparring match leaves nothing but the fighters having met. A real
// fight leaves its damage, everyone who lost their nerve shaken, its facts, and its conduct. See
// docs/overhaul/plans/character/README.md (How a fight ends).
//
// Facts: one for each fighter who did not finish fighting and each member of the other squad who attacked them (if no one did,
// every member of the other squad), a `beating` for anyone beaten or knocked out and a `fight` for anyone who fled. A
// knocked-out winner is beaten only by whoever dropped them. A stalemate is also a `fight` between the first fighter of each
// squad. A fact's amount is the hit points that attacker took from them, which scales how the one beaten comes to feel. Every
// fact of one fight shares a story id, has the other fighters and the named witnesses as its witnesses, and everyone there
// meets once.
import type { CastRecord } from './cast';
import { createCharacter, type Id } from './character';
import { withConduct, type Conduct } from './conduct';
import type { Fact, FactId, FactInput } from './facts';
import { outclasses, type FightResult, type FighterResult } from './fight';
import { meetPeople } from './learning';
import { allMeet, recordFact, withCharacter } from './records';

export interface FightRecordOptions {
  readonly now: number;
  readonly witnesses?: readonly Id[];
  /** The fact that led to the fight, such as a threat that provoked it. */
  readonly cause?: FactId;
}

/** The record after a fight, and the facts it recorded. */
export function applyFight(data: CastRecord, result: FightResult, options: FightRecordOptions): { readonly data: CastRecord; readonly facts: readonly Fact[] } {
  const { now, witnesses = [] } = options;
  const everyone = [...result.fighters.map((f) => f.id), ...witnesses.filter((w) => !result.fighters.some((f) => f.id === w))];
  if (result.kind === 'sparring') {
    const meets = allMeet(result.fighters.map((f) => f.id));
    return { data: { ...data, characters: data.characters.map((c) => (meets.has(c.id) ? createCharacter(meetPeople(c, meets.get(c.id)!, now)) : c)) }, facts: [] };
  }
  let d = data;
  for (const f of result.fighters)
    d = withCharacter(d, f.id, (c) => ({ ...c, condition: { ...c.condition, hitPoints: f.hp, effects: f.lostNerve ? [...c.condition.effects, 'shaken'] : c.condition.effects } }));

  const facts: Fact[] = [];
  const story = `fight:${d.nextId}`;
  const record = (input: Omit<FactInput, 'story'>) => {
    const named = [input.actor, input.victim];
    const recorded = recordFact(d, { ...input, story, ...(options.cause !== undefined && { cause: options.cause }) }, {
      now,
      witnesses: everyone.filter((id) => !named.includes(id)),
      meets: facts.length === 0 ? allMeet(everyone) : new Map(),
    });
    d = recorded.data;
    facts.push(recorded.fact);
    return recorded.fact;
  };

  const helpless = (actor: FighterResult, victim: FighterResult) =>
    (result.start === 'set-upon' && result.fighters.filter((f) => f.side === 'attacker').length > 1) || (victim.weapon === 'none' && outclasses(actor.weapon, 'none'));
  const byId = new Map(result.fighters.map((f) => [f.id, f]));
  for (const f of result.fighters) {
    if (f.status === 'fighting' || f.status === 'fleeing') continue;
    const others = result.fighters.filter((o) => o.side !== f.side);
    const attackers =
      f.status === 'knocked-out' && result.winner === f.side
        ? [f.droppedBy!]
        : f.attackedBy.length
          ? f.attackedBy.map((a) => a.id)
          : (others.some((o) => o.status === 'fighting') ? others.filter((o) => o.status === 'fighting') : others).map((o) => o.id);
    for (const actor of attackers) {
      const amount = f.attackedBy.find((a) => a.id === actor)?.damage ?? 0;
      const made = record({ kind: f.status === 'fled' ? 'fight' : 'beating', actor, victim: f.id, amount });
      if (made.kind === 'beating' && helpless(byId.get(actor)!, f)) d = withCharacter(d, actor, (c) => withConduct(c, 'beating-the-helpless', now, { fact: made.id }));
    }
  }
  if (result.winner === null) {
    const [a, b] = [result.fighters.find((f) => f.side === 'attacker')!, result.fighters.find((f) => f.side === 'defender')!];
    record({ kind: 'fight', actor: a.id, victim: b.id });
  }

  // conduct: starting the fight, for the attacking squad, and how each fighter reacted
  const cause = { fact: facts[0]!.id };
  const attackers = result.fighters.filter((f) => f.side === 'attacker');
  const defenders = result.fighters.filter((f) => f.side === 'defender');
  for (const f of result.fighters) {
    const conduct: Conduct[] = [];
    if (f.side === 'attacker') {
      const outnumbered = defenders.length > attackers.length;
      conduct.push('starting-a-fight');
      if (outnumbered || defenders.some((o) => outclasses(o.weapon, f.weapon))) conduct.push('starting-a-fight-outmatched');
      if (outnumbered || f.startHp * 2 <= f.maxHp) conduct.push('starting-a-fight-rashly');
      if (result.start === 'ambush') conduct.push('setting-an-ambush');
    }
    conduct.push(...f.reactions);
    for (const k of conduct) d = withCharacter(d, f.id, (c) => withConduct(c, k, now, cause));
  }
  return { data: d, facts };
}
