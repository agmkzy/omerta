// Items and what they do. An item's effects are rules data, like temperament's: each names the skill it applies to, a
// situation within that skill if it is that narrow, a value, and when it applies. An inventory records which items a
// character holds and which are shown or worn. Cash is not an item (transfers.ts). See docs/overhaul/plans/character/README.md
// (Inventory).
import type { Modifier } from './check';
import type { Skill } from './skills';

/** Situations within a skill that an item can be specific to. An effect with no situation applies to every check of its skill. */
export const SKILL_SITUATIONS = { locks: 'larceny', repairs: 'mechanics' } as const satisfies Readonly<Record<string, Skill>>;
export type SkillSituation = keyof typeof SKILL_SITUATIONS;

/** When an effect applies: while the item is held at all, while it is shown, while it is worn, or when it is used for the check. */
export type When = 'carried' | 'shown' | 'worn' | 'used';

export interface ItemEffect {
  readonly skill: Skill;
  readonly situation?: SkillSituation;
  readonly value: number;
  readonly when: When;
}

export const ITEMS = ['knife', 'pistol', 'lockpicks', 'toolkit', 'good-suit', 'bottle'] as const;
export type Item = (typeof ITEMS)[number];

export interface ItemInfo {
  readonly name: string;
  readonly effects: readonly ItemEffect[];
  /** A weapon is hidden while carried, and can be shown. What it does is in the weapons tables. */
  readonly weapon?: true;
  readonly wearable?: true;
  /** Used up when used: it leaves the inventory. */
  readonly usedUp?: true;
}

export const ITEM_INFO: { readonly [I in Item]: ItemInfo } = {
  knife: { name: 'Knife', effects: [], weapon: true },
  pistol: { name: 'Pistol', effects: [], weapon: true },
  lockpicks: { name: 'Lockpicks', effects: [{ skill: 'larceny', situation: 'locks', value: 2, when: 'used' }] },
  toolkit: { name: 'Toolkit', effects: [{ skill: 'mechanics', situation: 'repairs', value: 2, when: 'used' }] },
  'good-suit': { name: 'Good suit', effects: [{ skill: 'persuasion', value: 1, when: 'worn' }], wearable: true },
  bottle: { name: 'Bottle of spirits', effects: [], usedUp: true },
};

/** Drinking a bottle means a Carousing check against this DC; failing it makes the character drunk. */
export const DRINK_DC = 12;

export type ItemState = 'carried' | 'shown' | 'worn';

export interface HeldItem {
  readonly item: Item;
  readonly state: ItemState;
}

export interface InventoryRecord {
  /** Changed only by recorded transfers. */
  readonly cash: number;
  readonly items: readonly HeldItem[];
}

/** A complete, checked inventory: no cash and no items unless given, each item carried unless given a state. */
export function inventoryRecord(given: { readonly cash?: number; readonly items?: readonly (Item | HeldItem)[] } = {}): InventoryRecord {
  const cash = given.cash ?? 0;
  if (!Number.isInteger(cash) || cash < 0) throw new RangeError(`cash is a whole number from 0, got ${cash}`);
  const items = (given.items ?? []).map((i) => (typeof i === 'string' ? { item: i, state: 'carried' as const } : { item: i.item, state: i.state }));
  for (const { item, state } of items) {
    if (!ITEMS.includes(item)) throw new RangeError(`unknown item ${String(item)}`);
    if (state === 'shown' && !ITEM_INFO[item].weapon) throw new RangeError(`${ITEM_INFO[item].name} is not a weapon, so it cannot be shown`);
    if (state === 'worn' && !ITEM_INFO[item].wearable) throw new RangeError(`${ITEM_INFO[item].name} cannot be worn`);
    if (!['carried', 'shown', 'worn'].includes(state)) throw new RangeError(`unknown item state ${String(state)}`);
  }
  return { cash, items };
}

export interface ItemOptions {
  /** The situation the check is in, such as `locks` for a Larceny check to open a lock. */
  readonly situation?: SkillSituation;
  /** Items used for the check. */
  readonly using?: readonly Item[];
}

/**
 * The modifiers items give a skill roll, in inventory order: each held item's effects for the skill, where the situation
 * matches (or the effect has none) and the item is carried, shown, worn or used as the effect needs. An item held twice
 * counts once. Throws RangeError for a situation of another skill, or for using an item not held.
 */
export function itemModifiers(inventory: InventoryRecord, skill: Skill, options: ItemOptions = {}): Modifier[] {
  const { situation, using = [] } = options;
  if (situation !== undefined && SKILL_SITUATIONS[situation] !== skill) throw new RangeError(`${situation} is not a situation of ${skill}`);
  for (const item of using) if (!inventory.items.some((h) => h.item === item)) throw new RangeError(`${ITEM_INFO[item].name} is not held, so it cannot be used`);
  const applies = (h: HeldItem, when: When) => when === 'carried' || when === h.state || (when === 'used' && using.includes(h.item));
  const best = new Map<Item, HeldItem>();
  for (const h of inventory.items) if (!best.has(h.item) || h.state !== 'carried') best.set(h.item, h);
  return [...best.values()].flatMap((h) =>
    ITEM_INFO[h.item].effects
      .filter((e) => e.skill === skill && (e.situation === undefined || e.situation === situation) && applies(h, e.when))
      .map((e) => ({ value: e.value, reason: ITEM_INFO[h.item].name })),
  );
}
