// Names for a new man in March 1970: Italian-born given names alongside the American ones their sons were christened with.
// Formal given names only, never nicknames (the city decides those). Men's names only: the painted portrait reads the first name.
// The family surnames are left out so a stranger is never read as the boss's kin; real crime families are left out too.

export const FIRST_NAMES = [
  // Italian-American, as written on a baptism certificate in Brooklyn or Little Italy around 1945
  'Anthony', 'Joseph', 'Vincent', 'Frank', 'Michael', 'Dominic', 'Louis', 'Peter', 'Paul', 'Nicholas',
  'Ralph', 'Robert', 'John', 'James', 'Thomas', 'Richard', 'Charles', 'Philip', 'Albert', 'Alfred',
  'Eugene', 'Edward', 'Daniel', 'Victor', 'Leonard', 'Raymond', 'Arthur', 'Carl', 'Gerald', 'Steven',
  'Andrew', 'Lawrence', 'Matthew', 'Ernest', 'Henry', 'Samuel',
  // Italian, as the old country and the old neighbourhood still had it
  'Salvatore', 'Carmine', 'Angelo', 'Carlo', 'Gennaro', 'Giuseppe', 'Giovanni', 'Vincenzo', 'Francesco', 'Antonio',
  'Pasquale', 'Rocco', 'Silvio', 'Aldo', 'Alfonso', 'Arturo', 'Benedetto', 'Bruno', 'Cosimo', 'Dante',
  'Emilio', 'Gaetano', 'Lorenzo', 'Luciano', 'Mario', 'Nunzio', 'Raffaele', 'Renato', 'Rosario', 'Sebastiano',
  'Stefano', 'Umberto', 'Calogero', 'Domenico', 'Saverio', 'Ignazio', 'Corrado', 'Ettore',
];

export const SURNAMES = [
  'Abate', 'Acampora', 'Albanese', 'Aquilino', 'Arena', 'Avellino', 'Barbieri', 'Basile', 'Battaglia', 'Bellomo',
  'Benedetti', 'Bertolini', 'Buscemi', 'Calabrese', 'Campisi', 'Cannizzaro', 'Carbone', 'Cardinale', 'Castiglione', 'Catalano',
  'Cavallaro', 'Cerulli', 'Colella', 'Coppola', 'Corsaro', 'Cuomo', "D'Agostino", "D'Amico", "D'Angelo", 'DeMarco',
  'DiBenedetto', 'DiNapoli', 'DiStefano', 'Donato', 'Ferraro', 'Ferrante', 'Fiorentino', 'Formisano', 'Gagliardi', 'Gargiulo',
  'Gentile', 'Grasso', 'Iacono', 'Iannucci', 'Lanza', 'LaRocca', 'Licata', 'LoCascio', 'Longo', 'Lombardo',
  'Maggio', 'Mancuso', 'Manzo', 'Marchese', 'Mazzola', 'Messina', 'Milano', 'Monaco', 'Napolitano', 'Nardone',
  'Notaro', 'Oliveri', 'Pagano', 'Palermo', 'Parisi', 'Pascale', 'Perrone', 'Piazza', 'Pizzuto', 'Puglisi',
  'Randazzo', 'Romano', 'Rossi', 'Ruggiero', 'Sabatino', 'Salerno', 'Sanfilippo', 'Scalise', 'Scarpa', 'Serra',
  'Sorrentino', 'Spinelli', 'Tedesco', 'Terranova', 'Tortora', 'Trapani', 'Tucci', 'Vaccaro', 'Vella', 'Zappala',
];

type Rand = () => number;
const pick = (rand: Rand, a: string[], not?: string) => {
  const pool = not ? a.filter((x) => x !== not) : a;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
};

// A different given name from the one he has now (when he has one from the list).
export const rollFirst = (rand: Rand, current?: string) => pick(rand, FIRST_NAMES, current);
export const rollSurname = (rand: Rand, current?: string) => pick(rand, SURNAMES, current);

// A whole new name, avoiding any full name already taken (other men in the city, or the one he had a moment ago).
export function rollName(rand: Rand, taken: Iterable<string> = []): { first: string; last: string } {
  const no = new Set(Array.from(taken, (s) => s.toLowerCase()));
  for (let i = 0; i < 50; i++) {
    const n = { first: rollFirst(rand), last: rollSurname(rand) };
    if (!no.has(`${n.first} ${n.last}`.toLowerCase())) return n;
  }
  return { first: rollFirst(rand), last: rollSurname(rand) };
}

// What a typed name may contain: letters (accents included), spaces, apostrophes, hyphens and full stops.
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{M}' ’.\-]/gu, '').replace(/\s+/g, ' ').slice(0, 20);
export const fullName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.trim();
