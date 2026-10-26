// Shared UI state. One world, one current view, a back stack, and the little bits of text that live between actions.
import type { Meeting } from '../meetings';
import type { OrderOpt } from '../orders';
import type { Action, Id, Kind, World } from '../types';
import type { DayJobOpt } from '../orders';
import type { Move, SchemeOpt } from '../jobs';

// The five destinations (owner, 26 October): Street and People (the world you deal with) either side of Today (the present), then
// Business and Story (the life you're building). family, journal, life, rackets, crew and stories are older names: links and saved
// back-stacks that use them land in the section and room that now hold them.
export type Tab = 'street' | 'people' | 'today' | 'business' | 'story' | 'more' | 'family' | 'journal' | 'life' | 'rackets' | 'crew' | 'stories';

export type View =
  | { t: 'tab'; name: Tab }
  | { t: 'manage' }
  | { t: 'comm' }
  | { t: 'bj'; id?: string }
  | { t: 'person'; id: Id }
  | { t: 'biz'; id: Id }
  | { t: 'fact'; id: Id }
  | { t: 'tree'; fam: Id }
  | { t: 'menu'; kind: Kind }
  | { t: 'wait' }
  | { t: 'job'; id: Id }
  | { t: 'approach'; id: Id }
  | { t: 'delegate'; id: Id }
  | { t: 'sendorder'; id: Id; who: Id }
  | { t: 'plan'; idx: number; who?: Id }
  | { t: 'orders'; who: Id }
  | { t: 'recruit' }
  | { t: 'dayjob' }
  | { t: 'books'; id: Id; lines: string[] }
  | { t: 'meeting'; m: Meeting; lines: string[] }
  | { t: 'guests'; picked: Id[] }
  | { t: 'talk2'; v: import('../conv/visit').Visit } // (Gate 3: the new conversation screen, behind a switch: ui/talk2.ts)
  | { t: 'people' }
  | { t: 'brief' }
  | { t: 'sunday' }
  | { t: 'report'; id: Id; lines: string[] }
  | { t: 'grudges' }
  | { t: 'goals' }
  | { t: 'dispute'; id: string; lines: string[] }
  | { t: 'story'; id: string; lines?: string[] } // lines: what just happened, when he acted from the story
  | { t: 'way'; id: string; lines: string[] }
  | { t: 'settle'; id: Id; lines: string[]; kill?: boolean }
  | { t: 'place'; id: string }
  | { t: 'places' }
  | { t: 'help'; who: Id; lines: string[] }
  | { t: 'enc'; id: Id; lines: string[] }
  | { t: 'opstart'; kind: string }
  | { t: 'op'; id: Id; lines: string[]; found?: number }
  | { t: 'hijack'; picked: Id[] };

export const S = {
  w: null as World | null,
  view: { t: 'tab', name: 'today' } as View,
  stack: [] as View[],
  log: [] as string[],
  news: [] as string[],
  routine: 0,
  notice: '' as string, // a one-off message shown at the top of whatever screen you land on
  chips: [] as { t: string; tone: 'good' | 'bad' | '' }[],
  opts: [] as Action[],
  planOpts: [] as OrderOpt[],
  last: {} as Record<string, { view: View; stack: View[] }>, // where you were in each section, so going back to it picks up there
  cxSubject: undefined as string | undefined,
  cxLast: undefined as string | undefined, // the subject an exchange began from: when it is over, that subject is open again // the subject open in a conversation (presentation only: nothing is said)
  talkFrom: undefined as View | undefined, // where you were when a conversation began: leaving it takes you back there
  streetSel: undefined as string | undefined, // the place picked on the map (desktop: it opens beside the map)
  sub: {} as Record<string, string>, // which room of each section is open (family: men/org, business: rackets/money, journal: stories/known)
  worldFilter: 'all',
  look: { skin: 1, hairColour: 1, style: 0, beard: 0, glasses: 0, jaw: 1, seed: 'you1' } as import('./portrait').LookX,
  // The opening: the title screen, or the man being made. The draft lives until a game begins, so leaving and coming back keeps him.
  intro: 'title' as 'title' | 'create',
  draft: null as null | { first: string; last: string; bg: string; sec: 'name' | 'look' | 'history'; lg?: import('./portrait').LookGroup },
  confirmNew: false, // a saved game exists and the player has been told a new one will replace it
  introPlayed: false, // the title's entrance plays once per visit, not on every tap
  seenBrief: 0,
  paperAt: undefined as number | undefined, // which Herald edition is open (undefined: the latest)
  sundaySeen: 0,
  sundayHeard: 0,
  sundayLines: [] as string[],
  sundayDone: {} as Record<string, boolean>,
  sundayRes: {} as Record<string, string[]>, // what you said to each man on this Sunday
  sundayBooks: {} as Record<string, string[]>, // what you found in his books
  sundayMine: [] as string[],
  seen: {} as Record<string, number>, // when you last looked at each story
  seenTab: 0, // when you last opened the Stories list
  open: {} as Record<string, boolean>, // which banners are expanded
  confirmReset: false,
  save: null as import('../storage').SaveStatus | null, // outcome of the latest save
  saveGood: '' as string, // when the game was last saved successfully
  opDist: '' as string,
  opRunner: 'me' as string,
  treeFam: undefined as Id | undefined,
  moves: [] as Move[],
  schemeMoves: [] as SchemeOpt[],
  jobOpts: [] as DayJobOpt[],
};

export const W = () => S.w!;
export const P = () => S.w!.chars[S.w!.playerId!];
