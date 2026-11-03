// Skill checks against a DC, and the Planning roll that makes a job's plan. Like social checks, both give their odds,
// explanations and results to a viewer, counting another character's private state only where the viewer knows it, and a
// job's plan only for its members, as they believe it. See docs/overhaul/plans/character/README.md (Planning).
import type { CastRecord } from './cast';
import { checkOdds, resolveCheck, type CheckResult, type Modifier, type Odds, type Outcome } from './check';
import type { CharacterRecord, Id } from './character';
import { withConduct } from './conduct';
import type { ItemOptions } from './items';
import { PLAN_BANDS, believedOutcome, usingAdvantage, type Job, type JobId } from './jobs';
import { d20, everyone, rollParts, seenBy, truthOf, type Part, type PlanAdvantage } from './parts';
import type { Roller } from './random';
import { withCharacter } from './records';
import { SKILLS, type Skill } from './skills';
import { assertTime } from './time';

/** Just what a check needs of a cast and a character handle, so this module does not depend on cast.ts at run time. */
export interface CastLike {
  readonly data: CastRecord;
}
export interface Viewer {
  readonly id: Id;
  readonly name: string;
  readonly cast: CastLike;
}
type Commit<C> = (next: (data: CastRecord) => CastRecord) => C;

const viewerIn = (v: Viewer, ...casts: CastLike[]) => {
  if (!casts.includes(v.cast)) throw new RangeError(`${v.name} is from another cast`);
  return v.id;
};
const edgeFor = (a: PlanAdvantage, viewer: Id | null) => ((viewer === null ? a.truth : a.knownTo(viewer)) ? 'advantage' : 'none');
const marking = (a: PlanAdvantage) => (d: CastRecord): CastRecord => (a.truth && a.job ? { ...d, jobs: usingAdvantage(d.jobs, a.job) } : d);

export interface SkillCheck<C extends CastLike> {
  readonly skill: Skill;
  readonly dc: number;
  /** The same check with a situational modifier, which anyone present knows of. */
  with(modifier: Modifier): SkillCheck<C>;
  odds(o: { readonly for: Viewer }): Odds;
  explain(o: { readonly for: Viewer }): readonly Modifier[];
  /** Rolls it: refused if the cast it came from has been replaced. A plan's advantage, if this is its chosen check, is used up. */
  roll(roller: Roller, when: { readonly now: number }): { readonly cast: C; readonly truth: CheckResult; result(o: { readonly for: Viewer }): { readonly outcome: Outcome; readonly explanation: readonly Modifier[] } };
}

interface SkillSetup {
  readonly data: CastRecord;
  readonly c: CharacterRecord;
  readonly skill: Skill;
  readonly dc: number;
  readonly items: ItemOptions;
  readonly extra: readonly Modifier[];
}

function skillPartsOf(s: SkillSetup): { parts: Part[]; advantage: PlanAdvantage } {
  const { parts, advantage } = rollParts(s.data, s.c, s.skill, [], s.items);
  return { parts: [...parts, ...s.extra.map(everyone)], advantage };
}

/** A skill check against a DC by a character, in a situation and with items used, as for a character's own `skills`. */
export function skillCheck<C extends CastLike>(setup: SkillSetup, owner: C, commit: Commit<C>): SkillCheck<C> {
  if (!Number.isInteger(setup.dc)) throw new RangeError(`a DC is a whole number, got ${setup.dc}`);
  if (setup.c.condition.hitPoints === 0) throw new RangeError(`${setup.c.name} is unconscious`);
  const { parts, advantage } = skillPartsOf(setup);
  return {
    skill: setup.skill,
    dc: setup.dc,
    with: (modifier) => skillCheck({ ...setup, extra: [...setup.extra, modifier] }, owner, commit),
    odds: ({ for: v }) => {
      const id = viewerIn(v, owner);
      return checkOdds({ ...d20(seenBy(parts, id), edgeFor(advantage, id)), dc: setup.dc });
    },
    explain: ({ for: v }) => seenBy(parts, viewerIn(v, owner)),
    roll(roller, { now }) {
      assertTime(now);
      const truth = resolveCheck({ ...d20(truthOf(parts), edgeFor(advantage, null)), dc: setup.dc }, roller);
      const cast = commit(marking(advantage));
      return { cast, truth, result: ({ for: v }) => ({ outcome: truth.outcome, explanation: seenBy(parts, viewerIn(v, owner, cast)) }) };
    },
  };
}

export interface PlanCheck<C extends CastLike> {
  /** The same plan, with another member of the job helping: advantage on the roll. More helpers add nothing more. */
  helpedBy(helper: Viewer | Id): PlanCheck<C>;
  odds(o: { readonly for: Viewer }): Odds;
  explain(o: { readonly for: Viewer }): readonly Modifier[];
  /**
   * Rolls Planning against the job's DC and records the plan on its job. The planner, and anyone following it, see the plan
   * as they believe it to be: a critical failure looks like a failure. Anyone outside the job knows nothing of it (null).
   */
  roll(roller: Roller, when: { readonly now: number }): { readonly cast: C; readonly truth: CheckResult; result(o: { readonly for: Viewer }): { readonly outcome: Outcome | null } };
}

interface PlanSetup {
  readonly data: CastRecord;
  readonly planner: CharacterRecord;
  readonly job: Job;
  readonly helper?: Id;
  readonly advantageOn?: { readonly member: Id; readonly skill: Skill };
}

/** Throws RangeError for a plan that cannot be made: of a job that has ended or already has one, by or helped by someone not in it. */
function assertPlan(s: PlanSetup): void {
  const { job, planner, helper, advantageOn } = s;
  if (job.endedAt !== undefined) throw new RangeError(`job ${job.id} has ended`);
  if (job.plan !== undefined) throw new RangeError(`job ${job.id} has a plan already, and cannot be replanned`);
  if (!job.members.includes(planner.id)) throw new RangeError(`${planner.name} is not taking part in job ${job.id}`);
  if (helper !== undefined && (helper === planner.id || !job.members.includes(helper))) throw new RangeError(`a helper must be another member of job ${job.id}`);
  if (advantageOn !== undefined && (!job.members.includes(advantageOn.member) || !SKILLS.includes(advantageOn.skill))) throw new RangeError('the chosen check must be a member’s skill');
  if (planner.condition.hitPoints === 0) throw new RangeError(`${planner.name} is unconscious`);
}

/** A plan for a job, by one of its members: a Planning roll against the job's DC, with the plan's own bands. */
export function planCheck<C extends CastLike>(setup: PlanSetup, owner: C, commit: Commit<C>): PlanCheck<C> {
  assertPlan(setup);
  const { parts } = rollParts(setup.data, setup.planner, 'planning', []);
  const edge = setup.helper === undefined ? 'none' : 'advantage';
  const roll = (modifiers: readonly Modifier[]) => ({ ...d20(modifiers, edge), dc: setup.job.dc, bands: PLAN_BANDS });
  return {
    helpedBy: (helper) => planCheck({ ...setup, helper: typeof helper === 'string' ? helper : helper.id }, owner, commit),
    odds: ({ for: v }) => checkOdds(roll(seenBy(parts, viewerIn(v, owner)))),
    explain: ({ for: v }) => seenBy(parts, viewerIn(v, owner)),
    roll(roller, { now }) {
      assertTime(now);
      const truth = resolveCheck(roll(truthOf(parts)), roller);
      const { job, planner, helper, advantageOn } = setup;
      const cast = commit((d) => {
        const plan = { planner: planner.id, ...(helper !== undefined && { helper }), outcome: truth.outcome, margin: truth.margin, at: now, ...(advantageOn && { advantageOn }) };
        const planned: CastRecord = { ...d, jobs: d.jobs.map((j) => (j.id === job.id ? { ...j, plan } : j)) };
        return withCharacter(planned, planner.id, (c) => withConduct(c, 'planning', now, { job: job.id }));
      });
      return { cast, truth, result: ({ for: v }) => ({ outcome: job.members.includes(viewerIn(v, owner, cast)) ? believedOutcome(truth.outcome) : null }) };
    },
  };
}

/** The job a character can plan: given, or by id, among the cast's jobs. Throws RangeError for a job not recorded. */
export function jobIn(data: CastRecord, job: Job | JobId): Job {
  const id = typeof job === 'string' ? job : job.id;
  const found = data.jobs.find((j) => j.id === id);
  if (found === undefined) throw new RangeError(`no job has the id ${id}`);
  return found;
}
