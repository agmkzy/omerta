// The Monday paper, the city's: everything the police blotter, the business page and the society page would carry that week, across
// all five boroughs and whoever was behind it, ranked as a reader would read it (the biggest stories, and the ones that touch him: his
// shops, his street, his family, men he knows, come first). It prints only what a paper could know: what happened, where, and to
// whom; never who ordered it, who collects from whom, or what was decided at a table. The paper's footer carries the real news of
// those same days in 1970 and after (real-world headlines by date), so the city of the game sits in the city of the time.
import { DAY, Fact, World } from './types';
import { pick } from './voice';

export interface Paper { t: number; lead: string; items: { head: string; body?: string; section?: 'city' | 'business' | 'society' }[]; filler: string[] }

// ------------------------------------------------------------------ the real news of those days
// Day 0 of a game is Monday 2 March 1970. Each entry is a real event, by the date it happened, said the way a brief would.
const START = Date.UTC(1970, 2, 2);
const REAL: [string, string][] = [
  ['1970-02-18', 'Chicago Seven acquitted of conspiracy; five convicted of crossing state lines to incite a riot.'],
  ['1970-03-05', 'Nuclear Non-Proliferation Treaty comes into force.'],
  ['1970-03-06', 'Explosion destroys a townhouse on West 11th Street in Greenwich Village; police say bombs were being made inside.'],
  ['1970-03-07', 'Total eclipse of the sun darkens the Eastern seaboard; crowds watch from rooftops.'],
  ['1970-03-18', 'Letter carriers walk out in Manhattan and the Bronx; mail piles up across the city.'],
  ['1970-03-18', 'Prince Sihanouk deposed in Cambodia while abroad; General Lon Nol takes power.'],
  ['1970-03-23', 'President Nixon declares a national emergency over the postal strike and orders troops to sort the mail in New York.'],
  ['1970-03-25', 'Postal strike ends; letter carriers return to work.'],
  ['1970-04-07', '“Midnight Cowboy” named best picture at the Academy Awards.'],
  ['1970-04-10', 'Paul McCartney says he is leaving the Beatles.'],
  ['1970-04-11', 'Apollo 13 lifts off for the moon.'],
  ['1970-04-13', 'Explosion aboard Apollo 13; the moon landing is called off and the crew turn for home.'],
  ['1970-04-17', 'Apollo 13 crew splash down safely in the Pacific; crowds watch on shop-window televisions.'],
  ['1970-04-22', 'First Earth Day: Fifth Avenue closed to traffic as thousands march for clean air.'],
  ['1970-04-25', 'Times reports police corruption charges brought by Patrolman Frank Serpico; City Hall promises an inquiry.'],
  ['1970-04-30', 'President Nixon announces American and South Vietnamese troops have entered Cambodia.'],
  ['1970-05-04', 'Four students shot dead by National Guardsmen at Kent State University in Ohio.'],
  ['1970-05-08', 'Construction workers attack anti-war marchers near Wall Street; dozens hurt.'],
  ['1970-05-08', 'Knicks win the championship; Willis Reed limps out for Game Seven at the Garden.'],
  ['1970-05-15', 'Two students killed by police gunfire at Jackson State College in Mississippi.'],
  ['1970-05-21', 'Mayor Lindsay names a commission under Whitman Knapp to look into police corruption.'],
  ['1970-06-29', 'Tens of thousands rally at Columbus Circle for the Italian-American Civil Rights League’s Unity Day.'],
  ['1970-08-10', 'Inmates riot at the Tombs, the Manhattan House of Detention, over crowding and delays.'],
  ['1970-08-26', 'Women march down Fifth Avenue in the Strike for Equality.'],
  ['1970-09-13', 'First New York City Marathon run in Central Park; 127 starters, 55 finish.'],
  ['1970-09-18', 'Jimi Hendrix found dead in London.'],
  ['1970-10-01', 'Inmates seize the Tombs again and take guards hostage.'],
  ['1970-10-04', 'Janis Joplin found dead in Hollywood.'],
  ['1970-10-15', 'President signs the Organized Crime Control Act; prosecutors gain a new law against racketeering.'],
  ['1970-11-03', 'Governor Rockefeller re-elected; James Buckley wins a Senate seat on the Conservative line.'],
  ['1970-12-23', 'North tower of the World Trade Center tops out at 1,368 feet.'],
  ['1971-01-14', 'Patrolmen stay off the streets in a wildcat strike over pay.'],
  ['1971-02-03', 'Patrolman Frank Serpico shot in the face during a drug raid in Brooklyn.'],
  ['1971-03-08', 'Frazier beats Ali at Madison Square Garden in the Fight of the Century.'],
  ['1971-06-13', 'The Times begins publishing the Pentagon Papers.'],
  ['1971-06-28', 'Joseph Colombo shot at the Unity Day rally at Columbus Circle.'],
  ['1971-09-13', 'State troopers retake Attica prison; thirty-nine dead.'],
  ['1971-10-18', 'Knapp Commission opens public hearings on police corruption.'],
  ['1972-03-14', '“The Godfather” opens in New York.'],
  ['1972-04-07', 'Joey Gallo shot dead at Umberto’s Clam House on Mulberry Street.'],
];
const GENERIC = ['Heavy rain is forecast for the weekend.', 'Bakery on Arthur Avenue celebrates fifty years.', 'Parish bazaar raises $4,000 for the new church roof.', 'Cab drivers threaten a strike over fares.', 'City council debates a new parking tax.', 'A stray dog adopted by a Bay Ridge firehouse.', 'Little Italy’s feast of San Gennaro plans a bigger parade.', 'Local butcher wins a prize for his sausage.'];
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** The real news of the week the paper covers (its date and the six days before), most recent first. */
export function realNews(t: number): string[] {
  const end = START + Math.floor(t / DAY) * 86_400_000, from = iso(end - 7 * 86_400_000), to = iso(end);
  return REAL.filter(([d]) => d > from && d <= to).reverse().map(([, x]) => x);
}

// ------------------------------------------------------------------ the city's news
type Section = 'city' | 'business' | 'society';
type Item = { head: string; body?: string; section: Section; weight: number; key: string };
const dist = (f: Fact) => f.district || 'the city';
function item(w: World, f: Fact): { head: string; body?: string; section: Section } | undefined {
  const v = f.victim ? w.chars[f.victim] : undefined, a = f.actor ? w.chars[f.actor] : undefined, b = f.business ? w.biz[f.business] : undefined;
  const made = (c?: { rank: string }) => !!c && c.rank !== 'civilian' && c.rank !== 'associate';
  switch (f.kind) {
    case 'murder': return { head: `${v ? v.name : 'A man'} found dead in ${dist(f)}`, body: made(v) ? 'Police describe the dead man as a figure in organised crime. They expect no witnesses.' : pick(['Police are treating the death as suspicious.', 'Neighbours report hearing nothing.', 'Friends say he “had no enemies”, which the police find hard to believe.'], f.id), section: 'city' };
    case 'attempt': return { head: `Shots fired in ${dist(f)}; ${v ? v.name : 'a man'} unhurt`, body: 'Police found shell casings and nobody willing to talk.', section: 'city' };
    case 'beating': return { head: `${v?.rank === 'civilian' ? v.name : 'Man'} hospitalised after assault in ${dist(f)}`, body: pick(['Police ask anyone with information to come forward.', 'Witnesses describe two men who left in a hurry.', 'Doctors say he will recover. He told police he fell.'], f.id), section: 'city' };
    case 'vandalism': return b ? { head: `${b.name} smashed up in ${dist(f)}`, body: pick(['The owner told reporters he had “no idea” who was responsible.', 'Glass on the pavement and a shutter torn off. The owner is not talking.'], f.id), section: 'city' } : undefined;
    case 'robbery': return { head: `${b ? b.name : 'Shop'} held up in ${dist(f)}`, body: f.amount ? `About $${f.amount.toLocaleString('en-US')} taken. The robbers escaped on foot.` : 'The robbers escaped in a waiting car.', section: 'city' };
    case 'burglary': case 'theft': return { head: /off the road|truck|trailer|load/i.test(f.textHidden ?? f.text) ? `Truck hijacked ${b ? `on its way to ${b.name}` : `in ${dist(f)}`}` : `${b ? b.name : 'Shop'} burgled in ${dist(f)}`, body: f.amount ? `Police put the loss at $${f.amount.toLocaleString('en-US')}.` : 'Police have no suspects.', section: 'city' };
    case 'arrest': return { head: `${a ? a.name : 'Man'} arrested in ${dist(f)}`, body: made(a) ? 'Detectives call him a member of a crime family. His lawyer calls him a businessman.' : 'Police say further charges may follow.', section: 'city' };
    case 'raid': {
      if (/Federal agents/.test(f.text)) return { head: 'Federal agents arrest reputed mob figures in early-morning sweep', body: 'The arrests follow months of work with a cooperating witness, sources say.', section: 'city' };
      const what = /raided the (.+?) in /.exec(f.text)?.[1];
      return { head: `Police raid ${what ? RAIDED[what] ?? what : 'gambling operation'} in ${dist(f)}`, body: / and took /.test(f.text) ? 'One man was held. Police say others are known to them.' : pick(['Several men were taken in for questioning and released.', 'Nobody was charged. Police say the investigation continues.'], f.id), section: 'city' };
    }
    case 'business_failed': return b ? { head: `${b.name} closes its doors`, body: 'The owner cited “a difficult year”.', section: 'business' } : undefined;
    case 'ownership': return b ? { head: `${b.name} changes hands`, body: a ? `The new owner is ${a.name}, neighbours say.` : undefined, section: 'business' } : undefined;
    case 'business_struggling': return b ? { head: `Hard times at ${b.name}`, body: 'The owner says business will pick up in the spring.', section: 'business' } : undefined;
    case 'scam': return { head: `Residents of ${dist(f)} warned of confidence trick`, section: 'city' };
    case 'event': return /married|christen|funeral|died|father/.test(f.text) ? { head: f.text.replace(/\.$/, ''), section: 'society' } : undefined;
    default: return undefined;
  }
}
// (what the paper calls each racket the police raid)
const RAIDED: Record<string, string> = { 'numbers bank': 'numbers bank', bookmaking: 'bookmaking parlour', 'jukeboxes and vending': 'jukebox route', 'pier loading racket': 'pier racket', 'union local': 'union local', 'street loans': 'loan-sharking ring', 'bootleg cigarettes': 'bootleg cigarette ring', 'a nightclub stake': 'nightclub', 'private carting': 'carting company', 'construction kickbacks': 'construction firm', 'trucking and cargo': 'trucking company', 'car-stealing outfit': 'stolen-car ring', 'fencing operation': 'fencing operation', 'a front business': 'storefront' };
const plural = (k: string) => k.replace(/y$/, 'ie').replace(/(ring|parlour|operation|bank|route|racket|local|nightclub|company|firm|storefront|ie)$/, (e) => e + 's');
const SEVERITY: Record<string, number> = { murder: 10, attempt: 7, raid: 6, arrest: 5, robbery: 4, beating: 3, burglary: 3, theft: 3, vandalism: 3, business_failed: 2, ownership: 2, event: 2, business_struggling: 1, scam: 1 };

export function makePaper(w: World): Paper {
  const p = w.playerId ? w.chars[w.playerId] : undefined, since = w.now - 7 * DAY;
  // (what touches the reader comes first: his shops, his street, his family's men, men he knows)
  const near = (f: Fact) => {
    if (!p) return 0;
    const ids = [f.actor, f.victim].filter(Boolean) as string[], b = f.business ? w.biz[f.business] : undefined;
    return (b?.protection?.collectorId === p.id || b?.ownerId === p.id ? 4 : 0) + (f.district === p.district ? 2 : 0)
      + (ids.some((id) => !!w.chars[id]?.familyId && w.chars[id].familyId === p.familyId) ? 2 : 0) + (ids.some((id) => (p.rels[id]?.known ?? 0) > 0.1) ? 1 : 0);
  };
  const raw: Item[] = [];
  for (const f of Object.values(w.facts)) {
    if (f.t < since || f.t > w.now || f.minor) continue;
    const i = item(w, f);
    if (i) raw.push({ ...i, key: f.id, weight: (SEVERITY[f.kind] ?? 1) + near(f) });
  }
  // (a war the city can see: two families whose men keep turning up hurt, as the paper would put it)
  // (a family feuding with several at once is one story, not one a pair)
  const wars: [string, string][] = [];
  for (const fa of Object.values(w.fam)) for (const [fb, t] of Object.entries(fa.tension)) if (fa.id < fb && t >= 6 && w.fam[fb]) wars.push([fa.id, fb]);
  const fronts = new Map<string, string[]>();
  for (const [a, b] of wars) { fronts.set(a, [...(fronts.get(a) ?? []), b]); fronts.set(b, [...(fronts.get(b) ?? []), a]); }
  const told = new Set<string>();
  for (const [f, xs] of [...fronts].filter(([, xs]) => xs.length >= 2).sort((a, b) => b[1].length - a[1].length)) {
    const left = xs.filter((x) => !told.has([f, x].sort().join()));
    if (left.length < 2) continue;
    for (const x of left) told.add([f, x].sort().join());
    const names = left.map((x) => w.fam[x].name), list = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    raw.push({ head: `Police fear the ${w.fam[f].name} crime family is at war on ${['', '', 'two', 'three', 'four'][Math.min(4, left.length)]} fronts`, body: `Detectives link beatings and smashed storefronts to feuds with the ${list} families.`, section: 'city', weight: 9, key: 'wars:' + f });
  }
  for (const [a, b] of wars) if (!told.has([a, b].sort().join())) raw.push({ head: `Police fear open war between the ${w.fam[a].name} and ${w.fam[b].name} crime families`, body: 'Detectives link a string of beatings and smashed storefronts to the feud.', section: 'city', weight: 8, key: 'war:' + a + b });
  // (the same story twice in a week is one story: "Two men hospitalised after assaults in Bensonhurst")
  const byHead = new Map<string, Item & { n: number }>();
  for (const x of raw) { const e = byHead.get(x.head); if (e) { e.n++; e.weight = Math.max(e.weight, x.weight) + 1.5; } else byHead.set(x.head, { ...x, n: 1 }); }
  const NUM = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const merged = [...byHead.values()].map((x) => x.n < 2 ? x : /^Man hospitalised after assault/.test(x.head) ? { ...x, head: x.head.replace(/^Man hospitalised after assault/, `${NUM[Math.min(6, x.n)]} men hospitalised after assaults`), body: 'None of them will say who did it. Police say they know the pattern.' }
    : /^Police raid /.test(x.head) ? { ...x, head: x.head.replace(/^Police raid (.+?) in /, (_m, k: string) => `Police raid ${NUM[Math.min(6, x.n)].toLowerCase()} ${plural(k)} in `), body: 'Several men were taken in; most were out by morning.' }
    : /^Hard times at /.test(x.head) ? x : { ...x, head: `${x.head}, ${NUM[Math.min(6, x.n)].toLowerCase()} times this week` });
  // (the same kind of raid in several neighbourhoods is one story: "Police raid stolen-car rings in Little Italy and Red Hook")
  for (let i = 0; i < merged.length; i++) {
    const m = /^Police raid (?:(?:two|three|four|five|six) )?(.+?) in (.+)$/.exec(merged[i].head);
    if (!m) continue;
    const kindOf = (h: string) => /^Police raid (?:(?:two|three|four|five|six) )?(.+?) in (.+)$/.exec(h);
    const same = merged.map((x, k) => ({ x, k, m: kindOf(x.head) })).filter((y) => y.k !== i && y.m && plural(y.m[1].replace(/s$/, '')) === plural(m[1].replace(/s$/, '')));
    if (!same.length) continue;
    const places = [m[2], ...same.map((y) => y.m![2])];
    merged[i] = { ...merged[i], head: `Police raid ${plural(m[1].replace(/s$/, ''))} in ${places.slice(0, -1).join(', ')} and ${places.at(-1)}`, body: 'Several men were taken in; most were out by morning.', weight: Math.max(merged[i].weight, ...same.map((y) => y.x.weight)) + 1 };
    for (const y of same.sort((a, b) => b.k - a.k)) merged.splice(y.k, 1);
  }
  // (a paper doesn't run the same business story week after week: what it ran in the last three issues is old news)
  const ran = new Set((w.papers ?? []).slice(-3).flatMap((q) => [q.lead, ...q.items.map((i) => i.head)]));
  const fresh = merged.filter((x) => !(x.section !== 'city' && ran.has(x.head)));
  fresh.sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1));
  // (the front page and the city pages, then the business page and the society page, each kept to what a paper would run)
  const city = fresh.filter((x) => x.section === 'city').slice(0, 8), society = fresh.filter((x) => x.section === 'society').slice(0, 2);
  // (one hard-times piece at most: the business page has other news)
  const business = [...fresh.filter((x) => x.section === 'business' && !/^Hard times/.test(x.head)), ...fresh.filter((x) => /^Hard times/.test(x.head)).slice(0, 1)].slice(0, 3);
  const lead = city[0]?.head ?? business[0]?.head ?? pick(['Quiet week in the five boroughs', 'City goes about its business', 'Calm in the neighbourhoods, say police'], 'l' + w.now);
  const items = [...city.slice(city.length ? 1 : 0), ...business.filter((x) => x.head !== lead), ...society].map(({ head, body, section }) => ({ head, body, section }));
  // the footer: the real news of the same days, then the city's small news when the week had little
  const real = realNews(w.now);
  const filler = [...real.slice(0, 3), ...(real.length < 2 ? [pick(GENERIC, 'g' + w.now), pick(GENERIC, 'h' + w.now + 3)] : [])].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  return { t: w.now, lead, items, filler };
}

export function paperTick(w: World) {
  (w.papers ??= []).push(makePaper(w));
  if (w.papers.length > 10) w.papers.shift();
}
