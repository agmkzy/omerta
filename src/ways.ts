// The ways to make money, in plain words. Each has a sheet: what it is, how it pays, what it needs, what can go wrong.
import { OPS } from './rackets';
export type OpKey = keyof typeof OPS;
export type WayKind = 'op' | 'protection' | 'loans' | 'cars' | 'fence' | 'burglary' | 'hijack' | 'scams' | 'favours';
export interface Way {
  id: string;
  kind: WayKind;
  op?: OpKey;
  name: string;
  cat: string;
  icon: string;
  tone: 'g' | 'a' | 'b' | 'r';
  pitch: string;
  how: string[];
  pays: string;
  needs: string;
  risks: string;
  tip: string;
}

export const WAY_CATS = ['Standing rackets', 'Squeezing people', 'Stealing', 'Cons and favours'] as const;

export type Sheet = Omit<Way, 'id' | 'kind' | 'op'>;

// Every racket in rackets.ts OPS needs a sheet here: this is a Record over OpKey, so a racket added to OPS without one does not compile,
// and the list of ways below is generated from OPS rather than typed out a second time.
export const OP_SHEETS: Record<OpKey, Sheet> = {
  numbers: {
    name: 'Numbers racket', cat: 'Standing rackets', icon: 'cash', tone: 'a',
    pitch: 'Daily lottery on the street. Small bets, steady money.',
    how: ['Runners take nickel-and-dime bets in bars, barbershops and candy stores, and you pay the winners.', 'Almost everyone loses, so the house wins slowly and reliably. The more honest your runner, the more you keep.'],
    pays: 'Usually $200 to $500 a week once it settles.', needs: '$600 to set up. A runner you trust, or you do it yourself.',
    risks: 'Police raids close it for weeks. A runner can skim, and you only find out when you count the books.', tip: 'Put a runner with a good head for figures on it, then count behind him now and then.',
  },
  bookie: {
    name: 'Bookmaking', cat: 'Standing rackets', icon: 'cash', tone: 'a',
    pitch: 'Take bets on horses and ball games. Dangerous when a favourite wins.',
    how: ['You take bets and lay off nothing, so you are the house. Most weeks the losers pay for everything.', 'Some weeks a big favourite comes in and you pay out more than you took.'],
    pays: 'Usually $150 to $400 a week, with the odd ugly week where you lose money.', needs: '$400 to set up. A runner with a head for odds.',
    risks: 'A bad week can cost you hundreds. Raids, and runners who skim.', tip: 'Keep a cushion in your pocket. One bad Sunday can eat a week of takings.',
  },
  vending: {
    name: 'Jukeboxes and vending', cat: 'Standing rackets', icon: 'shop', tone: 'g',
    pitch: 'Put your machines in every bar in the district.',
    how: ['Jukeboxes, cigarette machines, pinball. The bar owners take them because the alternative is a lot of trouble.', 'Nobody gets rich, but it never stops.'],
    pays: 'Around $100 to $250 a week.', needs: '$800 for the machines. A runner who can talk to bar owners.',
    risks: 'Very low. A rival crew may try to muscle in.', tip: 'A good start for a man with a little capital and no appetite for risk.',
  },
  dock: {
    name: 'Pier tolls', cat: 'Standing rackets', icon: 'box', tone: 'b',
    pitch: 'Every crate off the boat pays a toll. Made men only, and only on the waterfront.',
    how: ['The foremen know who to see. Cargo moves, the toll gets paid, and your name keeps the unions quiet.', 'It is the best steady money in the family and everyone above you knows it.'],
    pays: 'Usually $400 to $850 a week.', needs: 'Made man. Red Hook or Staten Island, on your family’s ground. Your capo must trust you.',
    risks: 'The law watches the waterfront. Everyone above you wants a cut.', tip: 'You will not be offered this until your capo trusts you. Earn that first.',
  },
  union: {
    name: 'Union local', cat: 'Standing rackets', icon: 'box', tone: 'b',
    pitch: 'Dues, pension money and jobs for sale. Made men only.',
    how: ['You own a local and its officers. Dues come in, the pension fund can be borrowed from, and jobs go to whoever pays.', 'Quiet, respectable, and very profitable.'],
    pays: 'Usually $300 to $700 a week.', needs: 'Made man. $1,500. Hell’s Kitchen, the Bronx or Astoria, on your family’s ground.',
    risks: 'Investigators love unions. A scandal can end careers.', tip: 'Be seen to take care of the members. A happy local is a safe one.',
  },
  front: {
    name: 'Front business', cat: 'Standing rackets', icon: 'shop', tone: 'g',
    pitch: 'A laundromat or restaurant with clean books. It earns little, and it lets you explain your money.',
    how: ['A real business that can absorb cash you can’t explain. It brings in a modest steady income and a reason to be seen around.', 'It also lowers your heat, because a man with a business is just a businessman.'],
    pays: 'About $100 to $200 a week, and your heat falls.', needs: '$3,000 up front.',
    risks: 'Almost none, as long as you don’t overreach.', tip: 'Worth it once the heat is a real problem.',
  },
  shylock: {
    name: 'Street loans', cat: 'Standing rackets', icon: 'cash', tone: 'a',
    pitch: 'Cash lent by the week to people the banks won’t see.',
    how: ['You lend small sums at a weekly rate to men in trouble. Most pay, and the interest never stops.', 'The ones who can’t pay become your problem, or your favour.'],
    pays: 'Around $300 a week once it’s going.', needs: '$1,200 to lend out. Someone who can collect without breaking things.',
    risks: 'A man in debt can get desperate. A collector can lean too hard and the police hear of it.', tip: 'Lend to men with steady jobs. A cab driver is better than a gambler.',
  },
  cigarettes: {
    name: 'Bootleg cigarettes', cat: 'Standing rackets', icon: 'box', tone: 'a',
    pitch: 'Untaxed cartons sold from the back of every corner store.',
    how: ['You buy cartons cheap in the south and sell them at the usual price. The state tax is your profit.', 'Shopkeepers buy because it’s cheaper for them, too.'],
    pays: 'Around $230 a week.', needs: '$900 for the first load. A driver and a back room.',
    risks: 'Truck stops, tax inspectors, and rival suppliers who want the same corners.', tip: 'Spread it over many small shops. One big buyer is one big mistake.',
  },
  nightclub: {
    name: 'A nightclub stake', cat: 'Standing rackets', icon: 'shop', tone: 'g',
    pitch: 'Your name behind the bar of a place everyone wants to be seen.',
    how: ['You put in money and a few words with the owner. In return you have a table, a share of the door and a cash register that launders itself.', 'It also puts you in the room with every kind of person.'],
    pays: 'Around $330 a week, mostly clean.', needs: '$4,000 and a reason to be there most nights.',
    risks: 'Fights on the floor, a liquor board inspection, or an owner who sells the wrong person a share.', tip: 'Be seen, but not too often. The best owner is one who likes you.',
  },
  carting: {
    name: 'Private carting', cat: 'Standing rackets', icon: 'box', tone: 'b',
    pitch: 'Every restaurant pays to have its rubbish taken away, and nobody else may.',
    how: ['You control who collects from every shop on a route. They pay what you say, and no one else will touch their bins.', 'It is dull, steady, and violent to anyone who cuts in.'],
    pays: 'Around $440 a week.', needs: '$1,800 and made-man standing in your family’s ground.',
    risks: 'A rival hauler, an investigation, or a shopkeeper who talks.', tip: 'Treat the drivers well. They know every shop on the route.',
  },
  construction: {
    name: 'Construction kickbacks', cat: 'Standing rackets', icon: 'box', tone: 'b',
    pitch: 'Concrete, cranes and building inspectors. Everyone pays to keep the site moving.',
    how: ['A contractor who doesn’t pay finds his concrete late and his permits stuck.', 'You never touch a shovel. You touch the people who give out the paperwork.'],
    pays: 'Around $560 a week.', needs: '$2,500, made-man standing, and someone who can talk to inspectors.',
    risks: 'A new inspector, an honest foreman, or a federal task force.', tip: 'Pay the inspector first. Everything else is easier.',
  },
  trucking: {
    name: 'Trucking and cargo', cat: 'Standing rackets', icon: 'box', tone: 'b',
    pitch: 'Control the drivers and you control what gets delivered, and what gets lost.',
    how: ['You hold the local that supplies the drivers, and shippers pay to keep their loads moving.', 'A lost load is also a payday, if you know where it ended up.'],
    pays: 'Around $480 a week.', needs: '$2,200, made-man standing, and ground near the docks or the Bronx yards.',
    risks: 'Police interest in missing cargo, a hijacking that goes wrong, or a feud over routes.', tip: 'Know the schedule. Everything in trucking is timing.',
  },
};

const OTHER_WAYS: Way[] = [
  {
    id: 'protection', kind: 'protection', name: 'Protection', cat: 'Squeezing people', icon: 'shop', tone: 'g',
    pitch: 'A shop pays you every week to stay safe. From you.',
    how: ['You lean on a shop owner until he agrees to a weekly fee. After that the envelope arrives every week, or you send someone to find out why not.', 'Owners who pay on time are an asset. Owners who struggle are a risk and a story. A man who is already paying another family is a quarrel, not a customer.'],
    pays: 'Typically $50 to $150 per shop each week. It adds up.', needs: 'A shop that isn’t already under your family’s wing. Nerve, or a man with it.',
    risks: 'Refusals mean violence or a lost shop. Taking another family’s shop starts a war.', tip: 'Look at how the owner is doing before you lean. A man with no money has none to give.',
  },
  {
    id: 'loans', kind: 'loans', name: 'Loan sharking', cat: 'Squeezing people', icon: 'cash', tone: 'a',
    pitch: 'Lend to people who are short. They owe you for years.',
    how: ['You lend a man money at five percent a week. He pays a slice each week, and the interest keeps the debt alive.', 'Men who fall behind become collections, and the ones who default become problems. A man in your debt is also a man who owes you favours.'],
    pays: 'Interest of about 5% a week on whatever you have out.', needs: 'Cash to lend. A borrower, usually a man short at the wrong moment.',
    risks: 'Defaults. Lending to a friend who can’t pay. Violence over small money.', tip: 'Lend to men with steady income. A man who gambles is a loss waiting to happen.',
  },
  {
    id: 'cars', kind: 'cars', name: 'Car theft', cat: 'Stealing', icon: 'car', tone: 'b',
    pitch: 'Take cars off the street. Sell or chop them.',
    how: ['A quiet lot at night, the street, or a showroom if you are brave. The more you take, the more it pays and the more it hurts if it goes wrong.', 'Cars in your hands are heat, so move them quickly, to a garage owner who asks no questions or your own chop shop.'],
    pays: '$550 to $650 a car when sold to a dealer.', needs: 'A driver or a man with nerve. Somewhere to sell what you steal.',
    risks: 'Arrest if you hit a showroom. Cars sitting in your lot raise your heat.', tip: 'Never sit on stock. A shop that buys cars is worth more than the cars.',
  },
  {
    id: 'burglary', kind: 'burglary', name: 'Burglary', cat: 'Stealing', icon: 'box', tone: 'r',
    pitch: 'Break into a shop, take the stock and fence it.',
    how: ['Pick a shop that isn’t paying anyone’s protection. Go in quiet, or smash and grab for more.', 'What you take has to be sold. A pawnbroker pays about 40 cents on the dollar, a friendly fence a good deal more.'],
    pays: 'Goods worth a few hundred to a couple of thousand dollars, before fencing.', needs: 'A target and nerve. A fence for the goods.',
    risks: 'A protected shop starts a quarrel with whoever protects it. Smash and grab raises the heat.', tip: 'Check who is protecting a place before you rob it.',
  },
  {
    id: 'hijack', kind: 'hijack', name: 'Truck hijacking', cat: 'Stealing', icon: 'car', tone: 'r',
    pitch: 'Take a truck on the road. Two or three men, a quiet road, a big night.',
    how: ['You send a crew out and hear back in a couple of days. A good truck pays thousands, and a bad one is a dud.', 'Drivers and muscle do best. Whoever goes shares the take.'],
    pays: 'About $1,800 to $3,800 a load before the men’s share.', needs: 'At least two men you trust who are free to go.',
    risks: 'Arrests. Heat that lingers for weeks. Men who come back lighter than they should be.', tip: 'Pick men with driving or nerve. Their skills decide the odds.',
  },
  {
    id: 'fence', kind: 'fence', name: 'Selling stolen goods', cat: 'Stealing', icon: 'cash', tone: 'g',
    pitch: 'Turn the cars and goods in your pockets into cash.',
    how: ['Dealers buy cars at $550 each. Pawnbrokers pay 40 cents on the dollar. A chop shop earns more over time, at more risk.', 'The longer you hold it, the hotter you are.'],
    pays: 'About $550 a car, or 40% of what goods are worth.', needs: 'Stolen cars or goods in hand, and a buyer.',
    risks: 'Raids on a chop shop. Holding the goods raises heat.', tip: 'Sell fast. Stock is evidence.',
  },
  {
    id: 'scams', kind: 'scams', name: 'Cons and swindles', cat: 'Cons and favours', icon: 'mask', tone: 'a',
    pitch: 'Part a trusting man from his money with a good story.',
    how: ['A fake charity drive, a fake insurance man, a rigged game, a pyramid. You pick the mark and the story.', 'Smooth talkers do best. If it works, the mark never knows who you were. If it doesn’t, he remembers your face.'],
    pays: 'From a few dozen dollars to a thousand or more, depending on the con and the mark.', needs: 'A mark with money and a trusting nature. Charm helps.',
    risks: 'A mark who sees through it. A pyramid collapsing and landing on you.', tip: 'Look at the mark’s nature. Careful men are a waste of a good story.',
  },
  {
    id: 'favours', kind: 'favours', name: 'Favours and fixing', cat: 'Cons and favours', icon: 'eye', tone: 'b',
    pitch: 'Not money, but the currency that matters. Watch people, spring friends, guard what’s yours.',
    how: ['Follow a man to learn who he sees. Get a friend out of jail with a lawyer and an envelope. Stand guard over a shop that pays you.', 'None of it pays much directly. All of it buys trust, knowledge and people who owe you.'],
    pays: 'Little cash, and a lot of obligation.', needs: 'A man to send, or time of your own.',
    risks: 'Being noticed following someone. Paying to fix something that doesn’t stay fixed.', tip: 'Do these before you need them. A favour owed is worth more than money in a crisis.',
  },
];
export const wayById = (id: string) => WAYS.find((x) => x.id === id);

export const WAYS: Way[] = [
  ...(Object.keys(OPS) as OpKey[]).map((k): Way => ({ id: k, kind: 'op', op: k, ...OP_SHEETS[k] })),
  ...OTHER_WAYS,
];
