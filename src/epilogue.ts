// The end, told (the made man's life, Phase 1.7: a clear end and an account of the life). When the player dies, the game says how it
// ended (and who the street says did it, if anyone knows), what his life came to, who came to the funeral and who was not sorry, and
// how the Herald put it. Everything is read from the world's own records: the facts of his death and who knows them, his career and
// rank, his crew and his book, and what the men who knew him felt about him (regard and grudges). It writes nothing.
import { fmtTime, money, peek } from './core';
import { standingWord } from './jobs';
import { DAY, type Character, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const RANK: Record<string, string> = { associate: 'an associate', soldier: 'a soldier', capo: 'a captain', underboss: 'the underboss', boss: 'the boss' };

export interface Epilogue { how: string; who?: string; life: string[]; mourners: Character[]; glad: Character[]; herald: string }

export function epilogue(w: World, p: Character): Epilogue {
  const fam = p.familyId ? w.fam[p.familyId] : undefined, died = p.diedAt ?? w.now;
  const f = Object.values(w.facts).filter((x) => x.victim === p.id && ['murder', 'attempt', 'beating'].includes(x.kind) && x.t <= died + DAY).sort((a, b) => b.t - a.t)[0];
  // (who the street says did it: a man of his own family who knows, and what he knows, not what is true)
  const knower = f?.actor ? Object.values(w.chars).find((c) => c.alive && c.familyId === p.familyId && c.known[f.id]?.knowsActor) : undefined;
  const killer = knower && f?.actor ? w.chars[f.actor] : undefined;
  const how = f?.kind === 'murder' ? `${p.name} was killed on ${fmtTime(died).split(',').slice(0, 2).join(',')}.` : `${p.name} died on ${fmtTime(died).split(',').slice(0, 2).join(',')}.`;
  const days = Math.floor(died / DAY);
  const crew = Object.values(w.chars).filter((c) => c.bossId === p.id);
  const book = w.ops.find((o) => o.owner === p.id && o.kind === 'bookie');
  const life: string[] = [
    `${days} days in the life. He died ${RANK[p.rank] ?? 'a man'} of the ${fam?.name ?? ''} family. ${({ 'on thin ice': 'By the end, few men would vouch for him.', unproven: 'He never quite made his name.', trusted: 'Men trusted him.', respected: 'Men respected him.', 'a rising name': 'His name was rising.' } as Record<string, string>)[standingWord(p.standing)] ?? ''}`,
    ...(crew.length ? [`${crew.length === 1 ? 'One man' : `${crew.length} men`} answered to him: ${crew.map((c) => c.name).join(', ')}.`] : []),
    ...(book && book.total > 0 ? [`His book took in ${money(Math.max(0, book.total))} while he ran it.`] : []),
    `He left ${money(Math.max(0, p.cash))}${p.goods ? `, and ${money(p.goods)} in goods nobody will find` : ''}.`,
    ...(p.career?.log ?? []).slice(-4).map((l) => l.text),
  ];
  // the funeral: the men who trusted or liked him came; the men who held something against him were not sorry
  const mourners = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && (peek(c, p.id).trust >= 0.4 || peek(c, p.id).affection >= 0.45)).sort((a, b) => peek(b, p.id).trust - peek(a, p.id).trust || (a.id < b.id ? -1 : 1)).slice(0, 8);
  const glad = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && peek(c, p.id).grudge >= 0.5).sort((a, b) => peek(b, p.id).grudge - peek(a, p.id).grudge || (a.id < b.id ? -1 : 1)).slice(0, 4);
  const herald = f?.kind === 'murder'
    ? `${p.name}, ${p.rank === 'associate' ? 'whom police describe as an associate of' : 'whom police describe as a member of'} the ${fam?.name ?? 'city’s'} crime family, was found shot in ${p.district}. Police say they have no suspects. Neighbours say he was quiet and kept to himself.`
    : `${p.name} of ${p.district} has died. He is survived by his family. A Mass will be said at Most Precious Blood.`;
  return { how, who: killer ? `The street says it was ${killer.name}${killer.familyId && killer.familyId !== p.familyId ? `, of the ${w.fam[killer.familyId]?.name} family` : ''}. ${knower ? `${first(knower)} is one of the men who would know.` : ''}` : f?.kind === 'murder' ? 'Nobody says who did it. Nobody who knows is saying.' : undefined, life, mourners, glad, herald };
}
