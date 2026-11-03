// Jobs and their plans. A job is a record in the cast: its kind, its members, the DC a plan for it rolls against, its plan if
// it has one, and when it started and ended. While a job is open, every skill check by a member, other than fight rolls,
// includes the plan's modifier, which none of them can dodge. The planner, and everyone following the plan, believe what the
// plan seems to give: a critical failure looks to them like a failure. See docs/overhaul/plans/character/README.md (Planning).
import type { Bands, Modifier, Outcome } from './check';
import type { Id } from './character';
import { SKILLS, type Skill } from './skills';
import { assertTime } from './time';

export type JobId = string;

/** A job's id, made from the cast's counter, which facts share. */
export const jobId = (n: number): JobId => `j${n}`;

/** A plan's result, as it truly is. */
export interface Plan {
  readonly planner: Id;
  readonly helper?: Id;
  readonly outcome: Outcome;
  readonly margin: number;
  /** When it was made, in minutes. */
  readonly at: number;
  /** The one check a critical success gives advantage on, chosen when planning: the first of this skill by this member. */
  readonly advantageOn?: { readonly member: Id; readonly skill: Skill };
  /** That advantage has been used. */
  readonly advantageUsed?: true;
}

export interface Job {
  readonly id: JobId;
  readonly kind: string;
  readonly members: readonly Id[];
  /** The DC a plan for it rolls against: for example 10 for a simple job, 15 for a tricky one, 20 for a hard one. */
  readonly dc: number;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly plan?: Plan;
}

/** A plan's own bands: a critical failure needs a margin of −11 or worse, rather than the usual −6. */
export const PLAN_BANDS: Bands = { criticalSuccess: 10, success: 5, partial: 0, failure: -10 };

/** What each outcome of a plan does to the job's checks. A critical success also gives advantage on one chosen check. */
export const PLAN_EFFECT: { readonly [O in Outcome]: Modifier | null } = {
  'critical-success': { value: 2, reason: 'A very good plan' },
  success: { value: 2, reason: 'A good plan' },
  partial: { value: 1, reason: 'A rough plan' },
  failure: null,
  'critical-failure': { value: -2, reason: 'A bad plan' },
};

/** How a plan's outcome looks to its planner and anyone following it: a critical failure looks like a failure. */
export const believedOutcome = (o: Outcome): Outcome => (o === 'critical-failure' ? 'failure' : o);

/** A job at least this hard is a hard job, which moves its members' ambition. */
export const HARD_JOB_DC = 20;

/** The open job a character belongs to, if any. */
export function openJobOf(jobs: readonly Job[], id: Id): Job | undefined {
  return jobs.find((j) => j.endedAt === undefined && j.members.includes(id));
}

/** What a character's open job's plan does to one of their checks: truly, and as its members believe it. */
export interface PlanEffect {
  readonly job: Job;
  readonly truth: Modifier | null;
  readonly believed: Modifier | null;
  /** The plan's advantage applies to this check: the chosen member's first check of the chosen skill. */
  readonly advantage: boolean;
}

export function planEffect(jobs: readonly Job[], id: Id, skill: Skill): PlanEffect | null {
  const job = openJobOf(jobs, id);
  const plan = job?.plan;
  if (job === undefined || plan === undefined) return null;
  const advantage = plan.outcome === 'critical-success' && !plan.advantageUsed && plan.advantageOn?.member === id && plan.advantageOn.skill === skill;
  return { job, truth: PLAN_EFFECT[plan.outcome], believed: PLAN_EFFECT[believedOutcome(plan.outcome)], advantage };
}

/** The jobs with a plan's advantage marked used. */
export function usingAdvantage(jobs: readonly Job[], job: JobId): Job[] {
  return jobs.map((j) => (j.id === job && j.plan ? { ...j, plan: { ...j.plan, advantageUsed: true } } : j));
}

/**
 * Throws RangeError unless the jobs are valid: distinct ids made by the counter, members in the cast and named once, at most
 * one open job each, a whole DC from 1, an end no earlier than the start, and a plan by one member, helped by another.
 */
export function assertJobs(jobs: readonly Job[], characters: ReadonlySet<Id>, nextId: number): void {
  const ids = new Set<JobId>();
  const open = new Set<Id>();
  for (const j of jobs) {
    const n = /^j(\d+)$/.exec(j.id)?.[1];
    if (n === undefined || Number(n) >= nextId || ids.has(j.id)) throw new RangeError(`job id ${j.id} was not made by the counter, or is used twice`);
    ids.add(j.id);
    if (!j.members.length || new Set(j.members).size !== j.members.length) throw new RangeError(`job ${j.id} needs its members, each named once`);
    for (const m of j.members) if (!characters.has(m)) throw new RangeError(`job ${j.id} names ${m}, who is not in the cast`);
    if (!Number.isInteger(j.dc) || j.dc < 1) throw new RangeError(`a job's DC is a whole number from 1, got ${j.dc}`);
    assertTime(j.startedAt, 'a job’s start');
    if (j.endedAt !== undefined && !(Number.isInteger(j.endedAt) && j.endedAt >= j.startedAt)) throw new RangeError(`job ${j.id} ends before it starts`);
    if (j.endedAt === undefined)
      for (const m of j.members) {
        if (open.has(m)) throw new RangeError(`${m} is in two open jobs`);
        open.add(m);
      }
    const p = j.plan;
    if (p === undefined) continue;
    if (!j.members.includes(p.planner)) throw new RangeError(`job ${j.id}'s planner ${p.planner} is not one of its members`);
    if (p.helper !== undefined && (p.helper === p.planner || !j.members.includes(p.helper))) throw new RangeError(`job ${j.id}'s helper must be another of its members`);
    if (p.advantageOn !== undefined && (!j.members.includes(p.advantageOn.member) || !SKILLS.includes(p.advantageOn.skill))) throw new RangeError(`job ${j.id}'s chosen check must be a member's skill`);
    assertTime(p.at, 'a plan’s time');
  }
}
