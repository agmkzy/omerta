// The Monday paper. Written from what actually happened, in the voice of a paper that only knows what it can print:
// the police blotter, the society page, and not much about who did it.
import { famName, ownerBiz } from './core';
import { DAY, Fact, World } from './types';
import { pick } from './voice';

export interface Paper { t: number; lead: string; items: { head: string; body?: string }[]; filler: string[] }

const ERA: Record<number, string[]> = {
  1970: ['Mayor Lindsay says the city is “on the mend” despite the sanitation strike.', 'Apollo 13 crew safe; crowds watch splashdown on shop-window televisions.', 'Knicks fans pack Madison Square Garden as the team chases a first title.', 'Subway fare rumoured to rise again; riders unimpressed.', 'Nixon speaks of “law and order”; the Bronx wonders what it will cost.'],
  1971: ['Attica prisoners ask for better conditions; state says it will not negotiate.', 'Heat wave grips the five boroughs; hydrants opened in Bed-Stuy.', 'The Godfather rumoured to begin filming on Staten Island.'],
  1972: ['Gas lines lengthen; drivers wait hours.', 'The Mets sign a new manager to cheering and some doubt.'],
};
const GENERIC = ['Heavy rain is forecast for the weekend.', 'Bakery on Arthur Avenue celebrates fifty years.', 'Parish bazaar raises $4,000 for the new church roof.', 'Cab drivers threaten a strike over fares.', 'City council debates a new parking tax.', 'A stray dog adopted by a Bay Ridge firehouse.', 'Little Italy’s feast of San Gennaro plans a bigger parade.', 'Local butcher wins a prize for his sausage.'];

const dist = (f: Fact) => f.district || 'the city';
function item(w: World, f: Fact): { head: string; body?: string } | undefined {
  const v = f.victim ? w.chars[f.victim] : undefined;
  const a = f.actor ? w.chars[f.actor] : undefined;
  const b = f.business ? w.biz[f.business] : undefined;
  const vn = v && v.rank === 'civilian' ? v.name : v ? v.name : 'A man';
  switch (f.kind) {
    case 'murder': return { head: `${vn} found dead in ${dist(f)}`, body: pick(['Police are treating the death as suspicious.', 'Neighbours report hearing nothing.', 'Detectives decline to comment on possible motives.', 'Friends say he “had no enemies”, which the police find hard to believe.'], f.id) };
    case 'beating': return { head: `${v?.rank === 'civilian' ? vn : 'Man'} hospitalised after assault in ${dist(f)}`, body: 'Police ask anyone with information to come forward.' };
    case 'vandalism': return b ? { head: `${b.name} hit by vandals`, body: 'The owner told reporters he had “no idea” who was responsible.' } : undefined;
    case 'robbery': case 'burglary': case 'theft': return { head: `${b ? b.name : 'Shop'} robbed in ${dist(f)}`, body: 'The thieves escaped in a stolen car.' };
    case 'arrest': return { head: `${f.actor && a ? a.name : 'Man'} arrested in ${dist(f)}`, body: 'Police say further charges may follow.' };
    case 'raid': return { head: `Police raid gambling operation in ${dist(f)}`, body: 'Several men were taken in for questioning.' };
    case 'business_failed': return b ? { head: `${b.name} closes its doors`, body: 'The owner cited “a difficult year”.' } : undefined;
    case 'protection_started': return undefined;
    case 'scam': return { head: `Residents of ${dist(f)} warned of confidence trick` };
    case 'event': return /married|father/.test(f.text) ? { head: f.text.replace(/\.$/, '') } : undefined;
    case 'promotion': return undefined;
    default: return undefined;
  }
}

export function makePaper(w: World): Paper {
  const since = w.now - 7 * DAY;
  const facts = Object.values(w.facts).filter((f) => f.t >= since && f.t <= w.now && !f.minor);
  const items = facts.map((f) => ({ f, i: item(w, f) })).filter((x) => x.i) as { f: Fact; i: { head: string; body?: string } }[];
  const rank = (k: Fact['kind']) => ({ murder: 5, raid: 4, arrest: 4, beating: 3, vandalism: 2, robbery: 2, burglary: 2, business_failed: 2 } as Record<string, number>)[k] ?? 1;
  items.sort((a, b) => rank(b.f.kind) - rank(a.f.kind) || b.f.t - a.f.t);
  const era = ERA[Math.floor(w.now / (365 * DAY)) + 1970] ?? GENERIC;
  const filler = [pick(era, 'e' + w.now), pick(GENERIC, 'g' + w.now), pick(GENERIC, 'h' + w.now + 3)].filter((x, i, a) => a.indexOf(x) === i);
  const picks = items.slice(0, 5).map((x) => x.i);
  const lead = picks.length ? picks[0].head : pick(['Quiet week in the five boroughs', 'City goes about its business', 'Calm in the neighbourhoods, say police'], 'l' + w.now);
  const paper: Paper = { t: w.now, lead, items: picks.slice(picks.length ? 1 : 0), filler };
  void famName; void ownerBiz;
  return paper;
}

export function paperTick(w: World) {
  (w.papers ??= []).push(makePaper(w));
  if (w.papers.length > 10) w.papers.shift();
}
