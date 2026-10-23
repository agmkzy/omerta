// Shared UI state. One world, one current view, a back stack, and the little bits of text that live between actions.
import type { Convo, DOpt } from '../dialogue';
import type { Meeting } from '../meetings';
import type { OrderOpt } from '../orders';
import type { Action, Id, Kind, World } from '../types';
import type { DayJobOpt } from '../orders';
import type { Move, SchemeOpt } from '../jobs';

export type Tab = 'today' | 'rackets' | 'crew' | 'family' | 'life' | 'stories';
// V89: four rooms (see ui/lifeview.ts). Older names still arrive from links and are mapped there (roomOf).
export type LifeSub = 'you' | 'people' | 'business' | 'known';

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
  | { t: 'talk'; convo: Convo; lines: string[]; q?: string; history?: { q?: string; lines: string[] }[]; ended?: boolean }
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
  dopts: [] as DOpt[],
  planOpts: [] as OrderOpt[],
  lifeSub: 'you' as LifeSub,
  worldFilter: 'all',
  look: { skin: 1, hairColour: 1, style: 0, beard: 0, glasses: 0, jaw: 1, seed: 'you1' } as import('./portrait').LookX,
  // The opening: the title screen, or the man being made. The draft lives until a game begins, so leaving and coming back keeps him.
  intro: 'title' as 'title' | 'create',
  draft: null as null | { first: string; last: string; bg: string; sec: 'name' | 'look' | 'history'; lg?: 'Face' | 'Hair' | 'Details' },
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
