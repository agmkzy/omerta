// What a face is made of, and every choice the creator offers.
// The original keys keep their meaning (old saves): skin 0-5, hairColour 0-5, style 0-3 (slicked, long, receding, bald),
// beard 0-5 (clean, moustache, stubble, goatee, sideburns, mutton chops), glasses 0-2 (none, spectacles, dark), jaw 0-2
// (square, even, lean). V88 added build, nose, brows, age, mark and habit. Everything since is appended after the old values,
// is optional, and falls back to the man's seed when it is absent.
import type { Look } from '../../types';

export type LookX = Look & {
  build?: number; // 0 lean, 1 medium, 2 stocky, 3 heavy
  nose?: number; // 0 straight, 1 Roman, 2 broad, 3 boxer's, 4 small, 5 hooked, 6 upturned, 7 long
  brows?: number; // 0 heavy, 1 straight, 2 arched, 3 thin, 4 bushy, 5 low and flat
  age?: number; // 0 young, 1 prime, 2 seasoned (greying temples), 3 old (salt and pepper)
  mark?: number; // 0 none, 1 cheek scar, 2 brow scar, 3 mole, 4 pockmarked, 5 lip scar, 6 freckles
  habit?: number; // 0 none, 1 cigarette, 2 toothpick, 3 cigar, 4 gold chain
  // V92 (portraits rework): all optional, all derived from the seed when absent
  head?: number; // 0 oval, 1 round, 2 long, 3 broad, 4 narrow
  eyes?: number; // 0 almond, 1 deep-set, 2 hooded, 3 round, 4 narrow
  iris?: number; // index into IRIS_LIST
  mouth?: number; // 0 even, 1 thin, 2 full, 3 wide, 4 downturned
  hairline?: number; // 0 natural, 1 widow's peak, 2 high, 3 receding at the temples
  hairLen?: number; // 0 short, 1 medium, 2 long (sideburns and the back)
  texture?: number; // 0 straight, 1 wavy, 2 curly, 3 tight curls
  outfit?: number; // his taste in clothes (OUTFITS); his rank still decides how formal it has to be
  outfitColour?: number; // index into OUTFIT_COLOURS
  shirt?: number; // index into SHIRT_COLOURS
  tie?: number; // index into TIE_COLOURS
  hat?: number; // 0 none, 1 fedora, 2 trilby, 3 flat cap, 4 homburg, 5 watch cap
  jewel?: number; // 0 none, 1 gold chain, 2 crucifix, 3 cornicello, 4 saint's medal (a tie bar when he wears a tie)
};

// Index order is fixed forever (saves store the index); the creator shows them in tonal order instead (see `order` below).
export const SKIN_LIST = ['#efc9a6', '#e5b48a', '#d89f77', '#c58a63', '#a86f4c', '#7f503a', '#f3d6bd', '#dfa58a', '#b68558', '#5f3b2b'];
export const HAIR_LIST = ['#17120f', '#2a1c14', '#412a1b', '#5a3a22', '#6a3b22', '#8c8985', '#8f6c43', '#8a4223', '#4a4542', '#d3cec4'];
export const IRIS_LIST = ['#3b2618', '#4e3420', '#24180f', '#5a4a2a', '#4a5a50', '#4c5d72', '#5d666b'];
export const OUTFIT_COLOURS = ['#2f2e30', '#1c1b1e', '#23293a', '#45484a', '#3a2a20', '#5a4030', '#8a6e4c', '#4a4a32', '#2a3a2e', '#5a2a33', '#8d4a2b', '#d6cbb3'];
export const SHIRT_COLOURS = ['#ece6d8', '#e2d8c0', '#c9d4dc', '#d8cc9a', '#a89ab4', '#a8862f', '#8d4a2b', '#6b2a33', '#4a3527', '#1c1a1c'];
export const TIE_COLOURS = ['#6b1d27', '#7a2a2a', '#3b2440', '#1f2c44', '#2c3a2c', '#8a6a2a', '#6a6a72', '#151214'];

// His taste in clothes. `f` is how formal it is: 0 street, 1 a suit with the collar open, 2 a suit and tie, 3 the full dress
// of the top of a family. A rank has a floor (see dress.ts), so a promoted man dresses up, in the same taste.
export const OUTFITS: { label: string; f: number }[] = [
  { label: 'Leather jacket', f: 0 }, { label: 'Track jacket', f: 0 }, { label: 'Sport shirt', f: 0 }, { label: 'Turtleneck', f: 0 },
  { label: 'Bomber', f: 0 }, { label: 'Cardigan', f: 0 }, { label: 'Windbreaker', f: 0 }, { label: 'Suit, open collar', f: 1 },
  { label: 'Suit and tie', f: 2 }, { label: 'Three-piece', f: 3 }, { label: 'Car coat', f: 1 }, { label: 'Overcoat', f: 3 },
];

type Opt = { label: string; colour?: string };
export type LookGroup = 'Face' | 'Features' | 'Hair' | 'Clothes' | 'Details';
// `order` is the order the creator shows the options in (indices into `options`); absent means index order.
export type LookOption = { key: keyof LookX & string; label: string; group: LookGroup; kind: 'swatch' | 'choice'; options: Opt[]; order?: number[] };
export const LOOK_GROUPS: LookGroup[] = ['Face', 'Features', 'Hair', 'Clothes', 'Details'];
const ch = (...l: string[]): Opt[] => l.map((label) => ({ label }));
const sw = (list: string[], labels: string[]): Opt[] => labels.map((label, i) => ({ label, colour: list[i] }));

// Every control the creator offers. Option i sets look[key] = i.
export const LOOK_OPTIONS: LookOption[] = [
  { key: 'skin', label: 'Complexion', group: 'Face', kind: 'swatch', options: sw(SKIN_LIST, ['Fair', 'Light', 'Olive', 'Tan', 'Brown', 'Dark', 'Pale', 'Ruddy', 'Deep olive', 'Deep brown']), order: [6, 0, 1, 7, 2, 3, 8, 4, 5, 9] },
  { key: 'head', label: 'Face shape', group: 'Face', kind: 'choice', options: ch('Oval', 'Round', 'Long', 'Broad', 'Narrow') },
  { key: 'jaw', label: 'Jaw', group: 'Face', kind: 'choice', options: ch('Square', 'Even', 'Lean') },
  { key: 'build', label: 'Build', group: 'Face', kind: 'choice', options: ch('Lean', 'Medium', 'Stocky', 'Heavy') },
  { key: 'age', label: 'Age', group: 'Face', kind: 'choice', options: ch('Young', 'Prime', 'Seasoned', 'Old') },
  { key: 'eyes', label: 'Eyes', group: 'Features', kind: 'choice', options: ch('Almond', 'Deep-set', 'Hooded', 'Round', 'Narrow') },
  { key: 'iris', label: 'Eye colour', group: 'Features', kind: 'swatch', options: sw(IRIS_LIST, ['Brown', 'Warm brown', 'Dark brown', 'Hazel', 'Green', 'Blue', 'Grey']), order: [2, 0, 1, 3, 4, 6, 5] },
  { key: 'brows', label: 'Brows', group: 'Features', kind: 'choice', options: ch('Heavy', 'Straight', 'Arched', 'Thin', 'Bushy', 'Low') },
  { key: 'nose', label: 'Nose', group: 'Features', kind: 'choice', options: ch('Straight', 'Roman', 'Broad', 'Boxer’s', 'Small', 'Hooked', 'Upturned', 'Long') },
  { key: 'mouth', label: 'Mouth', group: 'Features', kind: 'choice', options: ch('Even', 'Thin', 'Full', 'Wide', 'Downturned') },
  { key: 'mark', label: 'Marks', group: 'Features', kind: 'choice', options: ch('None', 'Cheek scar', 'Brow scar', 'Mole', 'Pockmarked', 'Lip scar', 'Freckles') },
  { key: 'hairColour', label: 'Hair colour', group: 'Hair', kind: 'swatch', options: sw(HAIR_LIST, ['Black', 'Dark brown', 'Brown', 'Chestnut', 'Auburn', 'Grey', 'Sandy', 'Ginger', 'Salt and pepper', 'White']), order: [0, 1, 2, 3, 4, 7, 6, 8, 5, 9] },
  { key: 'style', label: 'Haircut', group: 'Hair', kind: 'choice', options: ch('Slicked back', 'Long', 'Receding', 'Bald', 'Side part', 'Pompadour', 'Curly', 'Crew cut', 'Shaggy', 'Ducktail', 'Afro', 'Comb-over', 'Blow-dried', 'Brushed forward') },
  { key: 'hairLen', label: 'Length', group: 'Hair', kind: 'choice', options: ch('Short', 'Medium', 'Long') },
  { key: 'texture', label: 'Texture', group: 'Hair', kind: 'choice', options: ch('Straight', 'Wavy', 'Curly', 'Tight curls') },
  { key: 'hairline', label: 'Hairline', group: 'Hair', kind: 'choice', options: ch('Natural', 'Widow’s peak', 'High', 'Receding') },
  { key: 'beard', label: 'Facial hair', group: 'Hair', kind: 'choice', options: ch('Clean', 'Moustache', 'Stubble', 'Goatee', 'Sideburns', 'Mutton chops', 'Full beard', 'Pencil moustache', 'Chevron', 'Horseshoe', 'Van Dyke', 'Short beard') },
  { key: 'outfit', label: 'Clothes', group: 'Clothes', kind: 'choice', options: OUTFITS.map((o) => ({ label: o.label })) },
  { key: 'outfitColour', label: 'Colour', group: 'Clothes', kind: 'swatch', options: sw(OUTFIT_COLOURS, ['Charcoal', 'Black', 'Navy', 'Slate', 'Brown', 'Tobacco', 'Camel', 'Olive', 'Bottle green', 'Burgundy', 'Rust', 'Cream']) },
  { key: 'shirt', label: 'Shirt', group: 'Clothes', kind: 'swatch', options: sw(SHIRT_COLOURS, ['White', 'Cream', 'Pale blue', 'Pale yellow', 'Lilac', 'Mustard', 'Rust', 'Burgundy', 'Brown', 'Black']) },
  { key: 'tie', label: 'Tie', group: 'Clothes', kind: 'swatch', options: sw(TIE_COLOURS, ['Burgundy', 'Red', 'Plum', 'Navy', 'Bottle green', 'Gold', 'Silver', 'Black']) },
  { key: 'hat', label: 'Hat', group: 'Details', kind: 'choice', options: ch('None', 'Fedora', 'Trilby', 'Flat cap', 'Homburg', 'Watch cap') },
  { key: 'glasses', label: 'Eyewear', group: 'Details', kind: 'choice', options: ch('None', 'Spectacles', 'Dark glasses', 'Horn-rims', 'Tinted aviators', 'Browline', 'Wire aviators', 'Round wire') },
  { key: 'jewel', label: 'Jewellery', group: 'Details', kind: 'choice', options: ch('None', 'Gold chain', 'Crucifix', 'Cornicello', 'Saint’s medal') },
  { key: 'habit', label: 'Habit', group: 'Details', kind: 'choice', options: ch('None', 'Cigarette', 'Toothpick', 'Cigar', 'Gold chain') },
];
export const LIMIT: Record<string, number> = Object.fromEntries(LOOK_OPTIONS.map((o) => [o.key, o.options.length]));

// A whole new face for the shuffle. The caller passes its own randomness (Math.random is fine in the UI). The dice are weighted
// so a shuffled man looks like somebody from the neighbourhood, and the parts agree with one another.
export function randomLook(rand: () => number): LookX {
  const i = (n: number) => Math.min(n - 1, Math.floor(rand() * n));
  const w = (ws: number[]) => { let x = rand() * ws.reduce((a, b) => a + b, 0); for (let k = 0; k < ws.length; k++) { x -= ws[k]; if (x < 0) return k; } return ws.length - 1; };
  const skin = w([1, 1.4, 1.6, 1.2, 0.7, 0.5, 0.5, 0.6, 0.8, 0.3]);
  const dark = skin === 4 || skin === 5 || skin === 9;
  const age = w([3, 3, 1.2, 0.4]);
  const texture = dark ? w([0.6, 0.8, 1.4, 3]) : w([5, 2.2, 1, 0.1]);
  const fair = skin === 0 || skin === 6 || skin === 7;
  const hairColour = age >= 3 ? w([0.4, 0.4, 0.2, 0, 0, 2, 0, 0, 1.6, 1]) : age === 2 ? w([2, 2, 1, 0.6, 0.2, 0.6, 0, 0, 1.6, 0]) : w([3, 3, 2, 1.4, 0.8, 0.1, fair ? 0.7 : 0.1, fair ? 0.5 : 0, 0, 0]);
  // haircuts that fit the hair: an Afro only on tight curls, curls on curly hair, the comb-over on an older man
  const style = texture === 3 ? w([1, 0, 0.6, 0.6, 1, 0, 0.8, 1.2, 0, 0, 2.6, 0, 0, 0.6])
    : w([3, 1, age >= 2 ? 1 : 0.3, 0.4, 2.4, 1.2, texture >= 2 ? 1.6 : 0.4, 0.8, 1.2, 0.6, 0, age >= 2 ? 0.6 : 0, 1, 0.8]);
  const outfit = w([3, 1.4, 1.6, 1.4, 1, 0.5, 0.6, 1.4, 0.6, 0.1, 0.6, 0.1]);
  return {
    skin, hairColour, style, beard: w([5, 2, 1.6, 0.6, 1.2, 0.4, 0.4, 0.4, 0.8, 0.3, 0.3, 0.4]), glasses: w([7, 0.8, 0.8, 0.6, 0.5, 0.4, 0.4, 0.3]), jaw: i(3),
    build: w([2, 3, 2, 0.8]), nose: w([3, 2, 1.6, 1, 1.2, 0.8, 0.6, 0.8]), brows: w([2, 3, 1.4, 1, 1, 0.8]), age, mark: w([5, 0.8, 0.6, 0.6, 0.4, 0.3, fair ? 0.5 : 0.1]), habit: w([4, 1.2, 0.8, 0.4, 1]),
    head: w([3, 1.4, 1.2, 1.2, 1]), eyes: w([3, 1, 1, 0.8, 1]), iris: fair ? w([2, 1, 1, 1.4, 1.2, 1.2, 0.8]) : w([3, 2, 3, 1, 0.4, 0.2, 0.2]), mouth: w([3, 1.4, 1.2, 1, 0.8]),
    hairline: age >= 2 ? w([2, 0.6, 1, 2]) : w([5, 1, 0.8, 0.4]), hairLen: w([1.4, 3, 1.4]), texture,
    outfit, outfitColour: i(12), shirt: w([2, 1.4, 1.2, 0.8, 0.5, 0.8, 0.6, 0.6, 0.5, 1]), tie: i(8),
    hat: w([10, 0.8, 0.8, 1, 0.1, 0.5]), jewel: w([4, 1.4, 0.8, 0.8, 0.5]),
    seed: 'you' + Math.floor(rand() * 1e6),
  };
}
