import type { Rng } from './rng';

export type Id = string;
export const HOUR = 60; // simulation time is in minutes
export const DAY = 1440;
export const WEEK = 10080;

export interface Traits {
  greed: number;
  violence: number;
  ambition: number;
  caution: number;
  sociability: number;
  vice: number; // gambling / indulgence
  courage: number;
}

export type Skill = 'muscle' | 'driving' | 'charm' | 'nerve' | 'brains';
export type Skills = Record<Skill, number>;
export type ProblemKind = 'gambling' | 'debt' | 'family' | 'drink' | 'house' | 'resentment' | 'woman';
export interface Problem {
  kind: ProblemKind;
  sev: number; // 0..1
  since: number;
  revealed?: boolean; // the player has been told the truth
}

export type Rank = 'civilian' | 'associate' | 'soldier' | 'capo' | 'underboss' | 'boss';

// How `a` feels about `b` (directional).
export interface Rel {
  trust: number;
  respect: number;
  affection: number;
  grudge: number;
  lastMet: number;
}

// A character only knows a fact if it is in their `known` map.
export interface Knowledge {
  t: number;
  from: string; // 'witness' | 'self' | 'public' | a character id (who told them)
  knowsActor: boolean; // some events (arson, robbery) hide who did it
}

// How a man's week with his superior really went. Several of these look the same from outside (he is short), which is the point.
export type Tone = 'paid' | 'downturn' | 'unable' | 'delayed' | 'underreported' | 'withheld' | 'jailed';
export interface WeekBook {
  week: number;
  gross: number; // true reckoned earnings
  declared: number; // what he told his superior
  due: number; // what that obliged him to pass up
  paid: number;
  expected: number; // what the superior could see for himself
  own?: number; crewGross?: number; // the player's statement: what he made, and what his crew made
  tone?: Tone; // the true reason this week went the way it did (the simulation's knowledge, never shown as such)
  expenses: number;
  received: number; // kick-ups received from below
  sources: Record<string, number>;
  why?: string; // the hidden reason, if he was short
  cause?: string; // plain-language reason this week was good or bad
}

export type HustleKind = 'numbers' | 'bookie' | 'loans' | 'cars' | 'fence' | 'vending' | 'shakedown' | 'odd';
export interface Hustle {
  kind: HustleKind;
  level: number; // 1 to 3: how big he has grown it
  since: number;
  gross: number; // last week
  costs: number;
  net: number;
  total: number; // lifetime net
  cause?: string; // why last week was what it was
  bad: number; // run of poor weeks
  stake: number; // capital tied up
  lull?: number; // keeping his head down until
}

export interface Books {
  gross: Record<string, number>; // this week, by source
  expenses: number;
  received: number;
  arrears: number; // owed upward and not yet paid
  missed: number; // consecutive short weeks
  honest: number; // consecutive clean weeks
  skim?: { until: number; frac: number }; // a decision to hold some back, for a while
  hide?: { until: number }; // a decision not to mention income the superior cannot see, for a while
  history: WeekBook[];
  flags: Record<Id, { amt: number; n: number; last: number }>; // discrepancies noticed about subordinates
  stance?: 'honest' | 'shave' | 'stall'; // the player's policy toward his own boss
  prepaid?: number; // handed to the boss this week already, ahead of the settlement
  side?: number; // weekly income of a hidden side operation
  sideKnown?: boolean;
}

// The face a man was given, or the one the player chose.
export interface Look { skin?: number; hairColour?: number; style?: number; beard?: number; glasses?: number; jaw?: number; seed?: string }
export interface Character {
  id: Id;
  look?: Look;
  want?: { kind: 'made' | 'gamble' | 'independent' | 'lieutenant' | 'rich' | 'respect'; since: number; why?: string }; // what he is after, privately
  nick?: string;
  bg?: string; // the player's background
  insight?: Record<Id, string[]>; // what the player has worked out about people ('want', 'tie:<id>', 'loan:<id>', 'leaving')
  rep?: { kept: number; broken: number; asked: number; ignored: number; favoured: Id | null }; // the player's record for keeping his word
  notes?: Record<Id, { tags: string[]; pin?: boolean }>; // your own contact book
  intro?: Record<Id, number>; // the people you have been introduced to, and when
  name: string;
  traits: Traits;
  cash: number;
  wage: number;
  familyId: Id | null;
  rank: Rank;
  bossId: Id | null;
  district: string;
  alive: boolean;
  jailedUntil: number;
  hurtUntil: number;
  heat: number; // police attention
  wake: number; // hour of day
  sleep: number; // hour of day (may exceed 24)
  rels: Record<Id, Rel>;
  known: Record<Id, Knowledge>;
  struggling: Record<Id, number>; // businessId -> when they learned it was struggling
  cooldown: Record<string, number>;
  talk?: Record<string, { d: number; sig: string; n: number }>; // what the player has already discussed with him: day, what the subject looked like then, how often asked (bounded)
  denied?: Record<Id, number>; // matters he has lied to the player about (fact -> day), so the lie is on record and can be put to him
  sponsor?: Id; // who vouched for him when he was made
  backer?: Id; // a captain who has recommended him for advancement
  weekIncome: number;
  lifetimeKick: number;
  lifetimeGross?: number; // everything the player has taken in, for the family's purposes
  isPlayer?: boolean;
  ambition?: { kind: string; since: number; done?: boolean; rank0?: string }; // what the player is currently working towards
  standing: number; // reputation, 0-100: what others believe about your conduct
  books: Books;
  memos: Memo[];
  kickRate: number; // share of declared earnings passed up
  skills: Skills;
  job?: DayJob;
  problem?: Problem;
  hustle?: Hustle; // his own line of work, independent of orders
  career?: { done: number; failed: number; log: { t: number; text: string }[] }; // what he has done for you and what has happened to him
  prospect?: boolean; // a hanger-on who might be taken on
  cars: number; // stolen cars on hand
  goods: number; // value of stolen goods on hand
  diedAt?: number;
  informant?: { since: number; evidence: number; agent: string; exposed?: boolean };
}

export interface Business {
  id: Id;
  name: string;
  kind: string;
  ownerId: Id;
  district: string;
  income: number; // weekly baseline
  expense: number; // weekly
  readonly cash: number; // changed only by econ.ts bizMove(), so the record of what moved can never disagree with the balance
  distress: number; // consecutive weeks in the red
  open: boolean;
  damaged: number; // weeks of reduced trade
  lastApproach?: number; // when anyone last tried to lean on this business
  // The agreed arrangement with whoever collects. `owed` is money that was due and not paid (the fee is the weekly agreement,
  // `late` counts the weeks missed in a row), and `why` is the true reason the last payment was short (see econ.ts).
  protection?: { collectorId: Id; familyId: Id; fee: number; late?: number; total?: number; since?: number; owed?: number; why?: PayWhy; hold?: number };
  guardedUntil?: number;
  informPrev?: { who: Id; fact: Id };
  // V73: who the place belongs to, who runs it, and who else has a claim on it. `ownerId` stays the actual owner.
  managerId?: Id; // runs it day to day; absent means the owner does
  stakes?: Stake[]; // other people's interests in it
  owners?: OwnerSpell[]; // everyone who has owned it before, oldest first
  invest?: number; // improvements that are still paying off (0..INVEST_CAP)
  rivals0?: number; // how many others of its kind were nearby when it was first measured
  acct?: WeekAcct[]; // its accounts for recent weeks, struck from the transaction record once a week (econ.ts)
}
// Someone else's share of a business: a revenue interest agreed by `how`.
export interface Stake { holder: Id; share: number; since: number; how: string; shaken?: number }
export interface OwnerSpell { id: Id; from: number; to: number; how: string }
// Why a payment was short. Only the simulation knows; everyone else has to work it out from what they can see.
export type PayWhy = 'unable' | 'delayed';
// Where a business's money went (see econ.ts: the only door a business's cash goes through).
export type TxKind = 'revenue' | 'expense' | 'protection' | 'draw' | 'inject' | 'invest' | 'theft' | 'damage' | 'fine' | 'stake' | 'gamble' | 'aid' | 'debt' | 'settle' | 'extort';
// One struck week of a business's accounts. Zero entries are left out. `close` is the cash at the end of it.
export interface WeekAcct { wk: number; t: number; revenue: number; expenses: number; protection?: number; stakes?: number; drawn?: number; injected?: number; invested?: number; lost?: number; net: number; close: number }
export interface Txn { t: number; k: TxKind; b: Id; d: number; bal: number; who?: Id } // d is signed, from the business's side

// V76: an organisation's significant changes (bounded), its treasury ledger (bounded) and what it has with the others.
export interface OrgEvent { t: number; kind: string; text: string; who?: Id }
export interface TreasuryTx { t: number; d: number; why: string; who?: Id }
export interface OrgRel { coop: number; comp: number; grievance: number; since: number; deals: { t: number; text: string }[] }
export interface Family {
  id: Id;
  name: string;
  bossId: Id;
  districts: string[];
  tension: Record<Id, number>;
  founded?: number; // minute the organisation came into being (negative: before the game began)
  history?: string; // one line of background, shown on its record
  leaderSince?: number;
  acting?: Id; // runs the family while the boss is inside
  standing?: number; // 0..100: how much weight the organisation carries in the city
  hist?: OrgEvent[];
  treasury?: number;
  tlog?: TreasuryTx[];
  tin?: number; tout?: number; // lifetime totals through the treasury door, so the balance can be proved
  rel?: Record<Id, OrgRel>;
  unrest?: { level: number; until: number }; // a contested succession leaves the house unsettled for a while
  hq?: Id; // club id
  lastChurn?: number; // last time a member left, came over or was put out (paces the churn)
  levy?: { extra: number; until: number };
  directive?: { kind: 'push' | 'quiet'; until: number };
  consigliere?: Id;
  heir?: Id;
  booksClosed?: boolean;
  lastPromo?: number;
  watch?: Record<Id, number>; // weeks a man has kept up the pace with no chair free for him
  capBonus?: Record<string, number>; // seats the boss has opened beyond the usual number
  seatNo?: Record<string, number>; // until when he won't hear another request for a seat
  hunt?: { target: Id; since: number; sev: number; why: string }; // the family has put out word on someone
}

// A quarrel between two sides that outlives the scene in which it started. It has a history, a status and, once settled, terms.
export interface Dispute {
  id: Id;
  kind: 'territory' | 'violence' | 'theft';
  a: Id; // the injured side
  b: Id; // the man who did it
  biz?: Id;
  fact: Id;
  claim: number;
  status: 'open' | 'settled' | 'dropped' | 'violated';
  history: { t: number; text: string }[];
  terms?: { text: string; by: number; barred?: Id; biz?: Id; cut?: number; to?: Id };
  created: number;
  next: number;
  older?: string; // an older understanding behind the quarrel, found only by looking
  found?: boolean;
  ignored?: boolean;
  seen?: boolean; // the player knows of it
  handled?: number; // the last time the player did something about it
}

export interface Debt {
  id: Id;
  creditor: Id;
  debtor: Id;
  principal: number;
  balance: number;
  weeklyRate: number;
  weeklyPayment: number;
  nextDue: number;
  missed: number;
  status: 'active' | 'paid' | 'defaulted' | 'void';
  reason: string;
  cause?: Id;
  paid?: number; // everything the creditor has had back so far
}

export type FactKind =
  | 'attempt'
  | 'loan'
  | 'debt_missed'
  | 'debt_paid'
  | 'debt_default'
  | 'protection_started'
  | 'protection_refused'
  | 'poach'
  | 'beating'
  | 'vandalism'
  | 'robbery'
  | 'murder'
  | 'business_struggling'
  | 'business_failed'
  | 'gambling_loss'
  | 'arrest'
  | 'promotion'
  | 'theft'
  | 'burglary'
  | 'scam'
  | 'raid'
  | 'ownership'
  | 'terms'
  | 'report'
  | 'shortfall'
  | 'discipline'
  | 'levy'
  | 'side_operation'
  | 'ruling'
  | 'sitdown'
  | 'gathering'
  | 'exposed'
  | 'trouble'
  | 'protection_late'
  | 'rumour'
  | 'favour'
  | 'event'
  | 'threat'
  | 'informant';

// Every significant event is a Fact. History and knowledge are the same thing.
export interface Fact {
  id: Id;
  t: number;
  kind: FactKind;
  actor?: Id;
  victim?: Id;
  business?: Id;
  amount?: number;
  text: string;
  textHidden?: string; // what people say when they don't know who did it
  cause?: Id; // the fact that led to this one
  story?: string; // the ongoing matter this belongs to: a dispute id, 'seat:rank'
  hiddenActor?: boolean;
  minor?: boolean; // minor facts don't spread by gossip or show in history
  heard?: number; // how many times gossip has carried it (see retain.ts gossipCap)
  district: string;
}

export type Kind = 'work' | 'socialise' | 'lend' | 'collect' | 'shakedown' | 'gamble' | 'retaliate' | 'wait';

export interface Action {
  kind: Kind;
  actor: Id;
  target?: Id;
  biz?: Id;
  debt?: Id;
  amount?: number;
  hours?: number;
  mode?: 'beat' | 'torch' | 'hit';
  approach?: string;
  approved?: boolean; // an intention that has come due
  quiet?: boolean; // the player is sitting down with him: nothing is volunteered, it comes up if he asks
  label: string;
  score: number;
}

export interface Ev {
  t: number;
  seq: number;
  kind: 'think' | 'weekly' | 'daily';
  who?: Id;
}

export type JobKind = 'collect' | 'lean' | 'handle' | 'hit' | 'boost' | 'burgle' | 'scam' | 'summons' | 'watch' | 'deliver' | 'message' | 'guard' | 'find' | 'shake' | 'fix' | 'gig';
export type Behaviour = 'clean' | 'skim' | 'gamble' | 'unavailable' | 'distracted' | 'confront' | 'mercy' | 'bungle';
export interface Report {
  text: string; // what he says happened
  truth: Behaviour; // what actually happened
  lie: boolean;
  found?: boolean; // the player has got the truth out of him
  amt?: number;
  by: Id;
}
export interface DayJob {
  kind: 'bartender' | 'driver' | 'doorman' | 'runner';
  biz?: Id;
  boss: Id;
  since: number;
  noticed: number; // 0..1
  shifts: number;
}
export type MeetingKind = 'crew' | 'accounts' | 'family' | 'sitdown' | 'social' | 'induction';

export interface Job {
  id: Id;
  kind: JobKind;
  title: string;
  brief: string;
  giver: Id | null;
  via: 'boss' | 'tip' | 'contract' | 'opportunity' | 'scheme' | 'order';
  assignee: Id;
  target?: Id;
  biz?: Id;
  debt?: Id;
  cause?: Id;
  pay: number;
  created: number;
  expires: number;
  due?: number;
  orders?: 'quiet' | 'hard';
  reported?: boolean; // the person who gave it has been told how it went
  reason?: string; // why the person who asked says it should be done
  why?: { motive: string; surface: string; deep: string; hidden?: boolean }; // in his own voice, see voice.ts
  claimTrue?: boolean; // whether that reason is actually true (hidden from the player)
  subject?: 'disloyal' | 'skimming' | 'wrong' | 'grudge';
  notes?: string[]; // what the player has found out
  checked?: string[];
  haggled?: boolean;
  disproved?: boolean;
  rep?: Report; // what the man you sent says happened
  acked?: boolean; // the player has seen the report
  meeting?: MeetingKind; // for summons
  extra?: Record<string, number | string>;
  status: 'offered' | 'active' | 'done' | 'failed' | 'declined' | 'expired';
}

// A complaint one member has about another. `valid` is the truth, which nobody can see directly.
export interface Grievance {
  id: Id;
  from: Id;
  about: Id;
  kind: 'skim' | 'violence' | 'territory' | 'money' | 'respect';
  text: string;
  claim: number;
  valid: boolean;
  cause?: Id;
  status: 'open' | 'ruled' | 'dropped';
  created: number;
  postponed: number;
}

// Something a character remembers about what was said between them and someone else.
export interface Memo {
  id: Id;
  t: number;
  other: Id;
  kind: 'promise' | 'threat' | 'agreement' | 'question' | 'favour';
  text: string;
  due?: number;
  done?: boolean;
  ref?: Id;
}

// Something that has not happened yet but will: the consequences of what people did, arriving late.
export interface Pending {
  id: Id;
  due: number;
  kind: 'reveal' | 'heat' | 'blackmail' | 'truth' | 'dispute' | 'seat' | 'intent' | 'plan' | 'hunt';
  fact?: Id;
  a?: Id;
  b?: Id;
  c?: Id;
  amount?: number;
  tries?: number;
  note?: string;
}

export interface Venture {
  id: Id;
  ownerId: Id;
  bizId: Id;
  hostId: Id;
  hostShare: number;
  stock: number;
  since: number;
  weeks: number;
  takings: number;
  open: boolean;
}

export type SitKind = 'money' | 'ambition' | 'turf' | 'org' | 'skim' | 'tribute' | 'debt' | 'partner' | 'grudge' | 'intel' | 'dispute' | 'crew';
export interface Situation {
  id: Id; who: Id; biz?: Id; since: number; weeks: number;
  stage: 'brewing' | 'handling' | 'asking' | 'resolved';
  kind?: SitKind; fam?: Id; rivalMan?: Id; rival?: Id; // rival: the business he is losing customers to
  cause: string; knows: boolean; told: boolean; helped?: boolean; asked?: number;
  resolvedAt?: number; how?: 'alone' | 'helped' | 'closed' | 'gone';
  // V75: the shared record. Every ongoing matter between people has the same shape, wherever it came from.
  parties?: { id: Id; role: string }[]; // everyone with a stake: roles are kind-specific ('boss', 'accused', 'owner', 'collector', ...)
  orgs?: Id[]; // families involved
  phase?: string; // where it stands, in the kind's own terms
  sev?: number; // 0..1: how serious
  next?: number; // when the people involved next do something about it
  key?: string; // what it is about (one open situation per key; a closed one is not reopened without a new cause)
  hist?: { t: number; text: string }[]; // important developments, newest last (bounded)
  k?: Record<Id, { l: 1 | 2; via: string; t: number }>; // who suspects (1) or knows (2), and how they came to
  claims?: { by: Id; text: string; honest: boolean; t: number }[]; // what people have said about it (honest is the simulation's own judgement)
  truth?: string; // what is actually the case (hidden from everybody)
  amt?: number;
  link?: { debt?: Id; dispute?: Id; griev?: Id };
  cons?: string[]; // what it left behind
  out?: string; // how it ended
  meet?: { chair: Id; parts: Id[]; pos: Record<Id, string>; held?: number };
  ask?: Id; // the encounter put to the player, if any
  m?: Record<string, number | string>; // kind-specific scratch (bounded, plain values)
}
export interface World {
  clubs?: Record<string, import('./clubdata').Club>; // the social clubs, one to a family
  scene?: import('./clubdata').Scene | null; // a conversation in progress, so a reload resumes it
  situations?: Situation[]; // things going on in the world, with or without the player
  sitcool?: Record<string, number>; // a matter that has closed is not reopened for a while (keyed like Situation.key)
  sitpace?: { lastMajor: number; lastVisible: number; weekVis: number; wk: number; sync?: number; weeks?: number; quiet?: number; busy?: number; stats?: Record<string, number> }; // quiet periods: how recently anything serious happened
  txns?: Txn[]; // every movement of a business's money, recent weeks (see econ.ts)
  ledger?: import('./ledger').LedgerEntry[]; // every movement of money inside the player's circle (see ledger.ts)
  bj?: import('./blackjack').BJ; // a hand of blackjack in progress, or the last one played
  seed: number;
  rng: Rng;
  now: number;
  seq: number;
  queue: Ev[];
  chars: Record<Id, Character>;
  biz: Record<Id, Business>;
  fam: Record<Id, Family>;
  debts: Debt[];
  facts: Record<Id, Fact>;
  nextId: number;
  playerId: Id | null;
  schema?: number;
  jobs: Job[];
  ventures: Venture[];
  grievances: Grievance[];
  pending: Pending[];
  disputes?: Dispute[];
  disputeScan?: number;
  expect?: { report: 'weekly' | 'asked'; trouble: 'tell' | 'handle'; invest: 'ask' | 'free' };
  enc: Enc[];
  favours: Favour[];
  threats: Record<Id, Threat>;
  events: LifeEvent[];
  sunday?: { t: number; tells: { who: Id; text: string; learn?: string }[]; seen?: boolean }; // what the crew brought in on Sunday
  papers?: { t: number; lead: string; items: { head: string; body?: string }[]; filler: string[] }[]; // the Monday paper, newest last
  snaps?: { t: number; cash: number; standing: number; heat: number; rank: string; kids: number }[]; // one per week, for the briefing
  ops: Op[];
  promo?: PromoCase;
  path?: PathState; // the road to the next rank: jobs counted, trials passed
  goals?: { done: Record<string, number> };
  agency?: Agency; // V74: what the NPCs are working towards (goals.ts)
  coup?: Coup;
  life?: Life;
  commissionAt?: number;
}

export interface Coup {
  fam: Id;
  plotter: Id;
  boss: Id;
  start: number;
  resolveAt: number;
  back: { plotter: Id[]; boss: Id[] };
}

export interface PathState { deeds: number; counted: Id[]; trial: Record<string, 'open' | 'passed'>; retry: Record<string, number>; hold?: Rank; latch?: Record<string, boolean>; fails?: Record<string, number>; kills?: number; turf?: string[]; book?: number; guar?: { who: Id; amt: number; due: number }[];
  ledger?: { t: number; kind: 'sponsor' | 'made' | 'chair' | 'backer'; who: Id; text: string }[];
  origin?: Id[]; // the men you started with
  life?: { home: number; car: number; hq: boolean; driver: boolean };
  stakes?: { biz: Id; share: number; since: number; shaken?: number }[]; // before V73 only; moved onto the businesses by the v4 migration
  comm?: { court: Record<Id, number>; allies: Id[]; cd: Record<string, number> };
  chest?: number; lieut?: Id; successor?: Id; favs?: Record<Id, number> }

export interface PromoCase {
  to: Rank;
  stage: number; // 0 sponsor, 1 rival, 2 the boss, 3 waiting, 4 decided
  since: number;
  next: number;
  sponsor: Id;
  rival?: Id;
  points: number;
  log: string[];
  result?: 'chosen' | 'passed';
}

export type OpKind = 'numbers' | 'bookie' | 'vending' | 'dock' | 'union' | 'front' | 'hijack' | 'shylock' | 'carting' | 'construction' | 'nightclub' | 'trucking' | 'cigarettes';
export interface Op {
  id: Id;
  kind: OpKind;
  owner: Id;
  runner: Id | null;
  district: string;
  since: number;
  state: 'running' | 'raided' | 'closed' | 'out' | 'done';
  until?: number;
  last: number; // last week's take
  total: number;
  skimmed: number; // what the runner has kept, unknown to you until you count
  crew?: Id[];
  due?: number;
  note?: string;
  weeks: number;
}

// Someone comes to you. A small scene with its own options; closes when you answer or it lapses.
export interface EncOpt {
  code: string;
  label: string;
  hint?: string;
}
export interface Enc {
  id: Id;
  kind: string;
  from: Id | null;
  about?: Id;
  t: number;
  expires: number;
  title: string;
  lines: string[];
  opts: EncOpt[];
  status: 'open' | 'done' | 'lapsed';
  data?: Record<string, string | number>;
}
// `from` did `to` a good turn and expects it back. `size` is how much it was worth, to him.
export interface Favour {
  id: Id;
  from: Id;
  to: Id;
  size: number;
  what: string;
  t: number;
  settled?: boolean;
  asked?: boolean;
}
export interface Threat {
  enemy: Id;
  level: number; // 0 none, 1 rumour, 2 warning, 3 menace, 4 attempt
  since: number;
  last: number;
  warned: number;
  truce: number;
  hidden: number;
  lethal: number;
}
export interface LifeEvent {
  id: Id;
  kind: 'wedding' | 'funeral' | 'christening' | 'dinner';
  t: number;
  host: Id;
  about?: Id;
  place: string;
  invited: Id[];
  done?: boolean;
}

export interface Kin {
  id: Id;
  role: 'mother' | 'father' | 'sister' | 'brother' | 'son' | 'daughter';
  warmth: number;
  lastSeen: number;
  sick?: number; // since
}
export interface Partner {
  id: Id;
  stage: 'seeing' | 'steady' | 'engaged' | 'married' | 'split';
  warmth: number;
  dates: number;
  since: number;
  lastSeen: number;
  note?: string;
  due?: number; // when a child is expected
  tried?: number; // last time you tried for a baby
  asked?: number; // last time you asked her something she said no to
}
export interface Life {
  kin: Kin[];
  partner?: Partner;
  pool?: { t: number; list: { id: Id; where: string; job: string }[] }; // who you could meet this week
  met: Id[]; // women you have been introduced to and passed on
  lastSunday: number;
  ex?: Id;
}

// ---- V74: NPC goals. One record per ambition an NPC is actively working on; ended ones are kept in a short ring for the record.
export type GoalKind = 'wealth' | 'business' | 'recruit' | 'advance' | 'debt' | 'independence';
export interface Goal {
  id: Id;
  who: Id;
  kind: GoalKind;
  target?: Id; // the business, prospect or debt it is about
  motive: string; // why he wants it (private)
  priority: number; // 0..1
  stage: string;
  need: number; // money the plan calls for
  have: number; // what he had when the stage began (progress is measured from here)
  next: string; // the step he plans to take next
  obstacle?: string;
  progress: number; // 0..1
  started: number;
  review: number; // when he next thinks about it
  deadline: number;
  tries: number; // refusals and setbacks so far
  mode?: 'buy' | 'stake';
  offer?: number;
  share?: number;
  owner?: Id; // who owned the target when he picked it (if that changes the plan is off)
  with?: Id; // the other party in the current step
  fin?: { by: Id; amt: number }; // money a partner or lender has already put up for this plan
  no?: Id[]; // targets he has given up on
  n?: number; // generic counter for the stage
  ask?: Id; // an open question to the player (an encounter id)
  paused?: number;
}
export interface GoalEnd { id: Id; who: Id; kind: GoalKind; target?: Id; t: number; how: 'done' | 'failed' | 'dropped'; why: string }
export interface Agency {
  goals: Goal[];
  ended: GoalEnd[]; // ring of the most recent endings (bounded)
  stats: Record<string, number>; // running counts under a fixed set of keys
  cool: Record<Id, number>; // when an NPC may form a new goal
  lastAsk: number; // when the player was last asked about one
}
