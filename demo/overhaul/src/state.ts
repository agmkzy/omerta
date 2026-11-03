// The demo's state: one cast, the clock, a seeded dice roller and a history of what happened. The cast is never made reactive
// in depth (a reactive proxy would break the cast's identity checks), only swapped whole in a shallow ref.
import { computed, ref, shallowRef } from 'vue';
import { BACKGROUND_INFO, rollCharacter, type BackgroundName } from '../../../src/overhaul/character/backgrounds';
import { cast, type Cast, type Character } from '../../../src/overhaul/character/cast';
import type { Id } from '../../../src/overhaul/character/character';
import type { Fact } from '../../../src/overhaul/character/facts';
import type { Item } from '../../../src/overhaul/character/items';
import { roller, seeded, type Roller } from '../../../src/overhaul/character/random';
import { DAY, HOUR } from '../../../src/overhaul/character/time';
import { WORLD } from '../../../src/overhaul/character/transfers';

/** The demo's characters: who they are, what kind of character, and what they start with. */
const PEOPLE: readonly { id: Id; name: string; background: BackgroundName; items: readonly Item[]; cash: number }[] = [
  { id: 'sam', name: 'Sam', background: 'fighter', items: ['knife'], cash: 120 },
  { id: 'rico', name: 'Rico', background: 'negotiator', items: ['good-suit', 'bottle'], cash: 300 },
  { id: 'joe', name: 'Joe', background: 'trickster', items: ['lockpicks', 'bottle'], cash: 80 },
  { id: 'vic', name: 'Vic', background: 'shopkeeper', items: [], cash: 450 },
  { id: 'al', name: 'Al', background: 'marksman', items: ['pistol'], cash: 150 },
];

/** One thing that happened, as the history shows it. */
export interface Entry {
  readonly at: number;
  readonly title: string;
  /** What really happened, for the simulation. */
  readonly truth: readonly string[];
  /** How each person there saw it, if that differs from the truth. */
  readonly seen: readonly { readonly who: string; readonly text: string }[];
}

export const seed = ref(7);
let dice: Roller = roller(seeded(seed.value));
export const current = shallowRef<Cast>(newCast());
export const now = ref(9 * HOUR);
export const viewerId = ref<Id>('sam');
export const selectedId = ref<Id>('sam');
export const history = ref<Entry[]>([]);
export const problem = ref<string | null>(null);

function newCast(): Cast {
  let c = cast({
    characters: PEOPLE.map((p) => ({ ...rollCharacter(p.id, p.name, p.background, dice), inventory: { items: p.items } })),
  });
  for (const p of PEOPLE) c = c.transfer({ from: WORLD, to: p.id, amount: p.cash, why: 'starting cash', now: 0 });
  return c;
}

/** A new world from the seed. */
export function reset(): void {
  dice = roller(seeded(seed.value));
  current.value = newCast();
  now.value = 9 * HOUR;
  history.value = [];
  problem.value = null;
}

export const characters = computed(() => current.value.characters);
export const person = (id: Id): Character => current.value.character(id);
export const nameOf = (id: Id | undefined): string => (id === undefined ? 'no one' : id === WORLD ? 'the world' : (current.value.data.characters.find((c) => c.id === id)?.name ?? id));
export const backgroundOf = (c: Character): string => (c.data.background ? BACKGROUND_INFO[c.data.background].name : 'none');
export const facts = computed((): readonly Fact[] => current.value.facts);

/** The clock, as a day and a time. */
export function clock(t: number): string {
  const day = Math.floor(t / DAY) + 1;
  const minutes = t % DAY;
  return `Day ${day}, ${String(Math.floor(minutes / HOUR)).padStart(2, '0')}:${String(minutes % HOUR).padStart(2, '0')}`;
}

export function advance(minutes: number): void {
  now.value += minutes;
}

/** A kind of fact or a status, in words. */
export const words = (s: string): string => s.replace(/[-_]/g, ' ');

/** A fact in a line: what happened, by whom, to whom. */
export function describeFact(f: Fact): string {
  const by = f.actor === undefined ? '' : ` by ${nameOf(f.actor)}`;
  const to = f.victim === undefined ? '' : ` to ${nameOf(f.victim)}`;
  return `${words(f.kind)}${by}${to}`;
}

/**
 * Does something to the cast: refused actions show their reason and change nothing. `act` returns the new cast and what to
 * add to the history.
 */
export function run(act: (c: Cast, dice: Roller, now: number) => { readonly cast: Cast; readonly entry: Omit<Entry, 'at'> }): boolean {
  try {
    const { cast: next, entry } = act(current.value, dice, now.value);
    current.value = next;
    history.value = [{ at: now.value, ...entry }, ...history.value];
    problem.value = null;
    return true;
  } catch (e) {
    problem.value = e instanceof Error ? e.message : String(e);
    return false;
  }
}

/** Something read from the cast that may be refused, such as a check that cannot be made: its value, or why not. */
export function attempt<T>(read: () => T): { readonly value: T; readonly refused: null } | { readonly value: null; readonly refused: string } {
  try {
    return { value: read(), refused: null };
  } catch (e) {
    return { value: null, refused: e instanceof Error ? e.message : String(e) };
  }
}
