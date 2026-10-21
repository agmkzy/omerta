// What each rank can do, cumulatively. Promotions never take an ability away; they widen what the ones before can reach.
// Also: the ledger of who made whom, the way a man of rank lives, the underboss's agenda and the Commission.
import { temper } from './temper';
import { noteDeal } from './orgs';
import { addStake, bizMove, stakesOf } from './econ';
import { orgRecord, treasuryMove } from './orgs';
import { addFact, clamp, earn, factText, learn, money, rel } from './core';
import { addEnc, addFavour } from './encounters';
import { members, LADDER } from './career';
import { newOffer } from './jobs';
import { Character, DAY, Enc, Id, PathState, Rank, WEEK, World } from './types';
import { pathState, underlings } from './path';
import { applyRank, repairHierarchy } from './rank';
import { post } from './ledger';
import { hasPerk } from './specs';

const first = (c: Character) => c.name.split(' ')[0];
const pick = <T,>(w: World, l: T[]): T => l[w.rng.int(0, l.length - 1)];
const ri = (r: Rank) => LADDER.indexOf(r);
const PL = (w: World) => w.chars[w.playerId!];

// ================================================================ the ledger
export function ledgerAdd(w: World, kind: 'sponsor' | 'made' | 'chair' | 'backer', who: Id, text: string) {
  const st = pathState(w);
  (st.ledger ??= []).push({ t: w.now, kind, who, text });
  if (st.ledger.length > 40) st.ledger.shift();
}
export function ledgerOf(w: World, who: Id) { return (w.path?.ledger ?? []).filter((e) => e.who === who); }

// What the two of you share, in a line or two, if there’s anything.
export function historyLines(w: World, p: Character, t: Character): string[] {
  const out: string[] = [];
  const led = ledgerOf(w, t.id);
  const made = led.find((e) => e.kind === 'made');
  const sp = led.find((e) => e.kind === 'sponsor' || e.kind === 'backer');
  const orig = !!w.path?.origin?.includes(t.id);
  if (sp) out.push(`${t.name}: "I put my name behind you when you were nobody. ${ri(t.rank) >= 3 ? 'Look at us now.' : 'I haven’t forgotten it.'}"`);
  if (made) out.push(`${t.name}: "You made me. I haven’t forgotten, and neither has anybody else who was watching."`);
  if (orig) out.push(`${t.name}: "I was one of your first men. ${ri(t.rank) >= 2 ? 'Nobody else gets to say that.' : 'I’m still here.'}"`);
  return out;
}
export function ledgerLine(w: World, p: Character, c: Character): string {
  const l = historyLines(w, p, c)[0];
  return l ? l.replace(/^[^:]+: "/, '').replace(/"$/, '') : '';
}

function ledgerTick(w: World) {
  const p = PL(w);
  for (const e of w.path?.ledger ?? []) {
    if (e.kind !== 'made') continue;
    const c = w.chars[e.who];
    if (!c?.alive || ri(c.rank) < 1) continue;
    if (c.traits.ambition > 0.75 && w.rng.chance(0.03)) {
      rel(c, p.id).trust = clamp(rel(c, p.id).trust - 0.08);
      addFact(w, { kind: 'rumour', actor: c.id, minor: true, text: `${c.name} has started saying he got where he is on his own. People who were there aren’t convinced.`, district: c.district }, { witnesses: [p.id] });
    } else if (rel(c, p.id).trust > 0.6 && w.rng.chance(0.03)) {
      const g = w.rng.int(2, 6) * 100;
      c.cash = Math.max(0, c.cash - g); earn(p, g, 'cut');
      addFact(w, { kind: 'report', actor: c.id, minor: false, text: `${c.name} sent an envelope with no reason given, just a note: “for what you did.” ${money(g)}.`, district: c.district }, { witnesses: [p.id] });
    }
  }
}

// ================================================================ how a man of rank lives
export interface LifeItem { code: string; label: string; hint: string; cost: number; upkeep: number; min: Rank; have: (l: NonNullable<PathState['life']>) => boolean; need?: (l: NonNullable<PathState['life']>) => boolean }
const LIFE: LifeItem[] = [
  { code: 'home1', label: 'A decent apartment', hint: 'A real address. A man can think.', cost: 2500, upkeep: 40, min: 'associate', have: (l) => l.home >= 1 },
  { code: 'home2', label: 'A house in the suburbs', hint: 'A lawn, a garage, a wife who is glad of it. The police find you harder to watch.', cost: 15000, upkeep: 150, min: 'soldier', have: (l) => l.home >= 2, need: (l) => l.home >= 1 },
  { code: 'home3', label: 'An estate', hint: 'Walls, a gate, a man at the gate. People come to you.', cost: 80000, upkeep: 500, min: 'underboss', have: (l) => l.home >= 3, need: (l) => l.home >= 2 },
  { code: 'car1', label: 'A Cadillac', hint: 'It says something before you do.', cost: 5000, upkeep: 60, min: 'soldier', have: (l) => l.car >= 1 },
  { code: 'car2', label: 'A Lincoln and a man to wash it', hint: 'The kind of car people recognise from a block away.', cost: 20000, upkeep: 150, min: 'capo', have: (l) => l.car >= 2, need: (l) => l.car >= 1 },
  { code: 'hq', label: 'A social club of your own', hint: 'Your crew works out of it. They earn about a tenth more, and they like being there.', cost: 25000, upkeep: 300, min: 'capo', have: (l) => l.hq },
  { code: 'driver', label: 'A driver', hint: 'Nobody gets to you in the street. Heat falls a little every week.', cost: 8000, upkeep: 250, min: 'underboss', have: (l) => l.driver },
];
export const lifeOf = (w: World) => (pathState(w).life ??= { home: 0, car: 0, hq: false, driver: false });
export function lifeOptions(w: World, p: Character): (LifeItem & { owned: boolean; ok: boolean; why: string })[] {
  const l = lifeOf(w);
  return LIFE.filter((x) => ri(p.rank) >= ri(x.min) || x.have(l)).map((x) => {
    const owned = x.have(l);
    const need = !x.need || x.need(l);
    return { ...x, owned, ok: !owned && need && p.cash >= x.cost && ri(p.rank) >= ri(x.min), why: owned ? 'yours' : !need ? 'you need the one before it first' : p.cash < x.cost ? `needs ${money(x.cost)}` : '' };
  });
}
export function buyLife(w: World, p: Character, code: string): string[] {
  const x = lifeOptions(w, p).find((o) => o.code === code);
  if (!x || !x.ok) return [x?.why ? `Not yet: ${x.why}.` : 'Not available.'];
  const l = lifeOf(w);
  p.cash -= x.cost;
  if (code.startsWith('home')) l.home = Number(code.slice(4));
  else if (code.startsWith('car')) l.car = Number(code.slice(3));
  else if (code === 'hq') l.hq = true;
  else if (code === 'driver') l.driver = true;
  p.standing = clamp(p.standing + 2, 0, 100);
  return [`${x.label}. ${money(x.cost)}, and ${money(x.upkeep)} a week to keep it. ${x.hint}`];
}
function lifeWeek(w: World) {
  const p = PL(w);
  const l = w.path?.life;
  if (!p?.alive || !l) return;
  let up = 0;
  for (const x of LIFE) if (x.have(l)) up += x.upkeep;
  // houses are bought in order: only the best one costs money
  if (l.home >= 2) up -= 40 + (l.home >= 3 ? 150 : 0);
  if (l.car >= 2) up -= 60;
  p.cash = Math.max(0, p.cash - up); p.books.expenses += up;
  p.heat = Math.max(0, p.heat - 0.02 * l.home - (l.driver ? 0.05 : 0));
  if (l.home >= 3) p.standing = clamp(p.standing + 0.15, 0, 100);
  if (l.hq) for (const c of underlings(w, p)) { rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.01); rel(c, p.id).affection = clamp(rel(c, p.id).affection + 0.005); }
}
export const hasHQ = (w: World) => !!w.path?.life?.hq;

// ================================================================ the powers table
export interface Power2 { code: string; label: string; hint: string; off?: boolean; rank: Rank }
const cdLeft = (w: World, p: Character, k: string) => Math.max(0, Math.ceil(((p.cooldown[`pw:${k}`] ?? 0) - w.now) / DAY));
const TURF_CAP: Record<string, number> = { soldier: 1, capo: 2, underboss: 3, boss: 5 };
const nextTurf = (w: World, p: Character) => w.fam[p.familyId!].districts.find((d) => !(w.path?.turf ?? []).includes(d));

export function powerOptions(w: World, p: Character): Power2[] {
  if (!p.familyId || ri(p.rank) < 0) return [];
  const fam = w.fam[p.familyId];
  const st = pathState(w);
  const out: Power2[] = [];
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.rank !== 'civilian');
  const caps = members(w, p.familyId).filter((c) => c.rank === 'capo' && c.id !== p.id);
  const grow = crew.filter((c) => c.hustle && c.hustle.level < 3);
  const turf = st.turf ?? [];
  const book = st.book ?? 0;
  const at = (min: Rank) => ri(p.rank) >= ri(min);
  const add = (rank: Rank, code: string, label: string, hint: string, extra = false) => {
    const left = cdLeft(w, p, code.split(':')[0]);
    out.push({ code, rank, label, hint: left ? `Ready again in ${left} day${left > 1 ? 's' : ''}.` : hint, off: left > 0 || extra });
  };
  const levyOn = !!(fam.levy && fam.levy.until > w.now);
  const dirOn = !!(fam.directive && fam.directive.until > w.now);
  // associate
  const cands = Object.values(w.biz).filter((b) => b.open && b.distress >= 1 && !(b.stakes ?? []).some((x) => x.holder === p.id)).sort((a, c) => c.distress - a.distress).slice(0, 3);
  if (!cands.length) add('associate', 'proposition:none', 'Back a struggling business', 'Nobody in the neighbourhood is losing money right now. Walk the streets and one will turn up.', true);
  for (const b of cands) add('associate', 'proposition:' + b.id, `Back ${b.name}`, `${w.chars[b.ownerId]?.name ?? 'The owner'} has been in the red ${b.distress} week${b.distress > 1 ? 's' : ''}. You put in $2,000 and take a quarter of what it makes, and he owes you. It pays out each week.`, p.cash < 2000);
  const patron = p.bossId ? w.chars[p.bossId] : undefined;
  add('associate', 'errand', `Do ${patron ? patron.name.split(' ')[0] + ' ' : 'your captain '}a favour`, 'Run something for the man above you, no questions and no pay. He owes you after, and he thinks better of you. Once a week.', !patron);
  add('associate', 'tipoff', 'Buy a tip from a cop', 'Costs $200. Heat drops and you hear which way the police are looking. Once a week.', p.cash < 200 || p.heat < 0.1);
  add('associate', 'findscore', 'Find a score', 'Spend a few days asking around. One or two new jobs turn up on your Today screen, same as any other job. Every five days.');
  add('associate', 'sidearr', 'Make a side arrangement', `Put $800 into a deal outside the family’s books. It adds about $120 a week to your own money, and it never counts in your envelope. Your boss can find it${p.books.side ? ` (you already have ${money(p.books.side)} a week running)` : ''}, and then you’ll have some explaining to do.`, p.cash < 800 || (p.books.side ?? 0) >= 360);
  const owed = w.favours.filter((f) => f.to === p.id && !f.settled && w.chars[f.from]?.alive).sort((a, b) => b.size - a.size).slice(0, 3);
  if (!owed.length) add('associate', 'favour:none', 'Collect on a favour', 'Nobody owes you yet. Help men out, and they will.', true);
  for (const f of owed) add('associate', 'favour:' + f.id, `Collect from ${w.chars[f.from].name}`, `He owes you for ${f.what}. Cash from him now, and you lose the hold.`);
  if (at('soldier')) {
    add('soldier', 'squeeze', 'Squeeze the men who are short', 'Collect what your men owe you now, in cash. It lands in your pocket and in the ledger. They won’t like it.', !crew.some((c) => c.books.arrears > 0 && c.cash > 20));
    add('soldier', 'lawyer', 'Call the family’s lawyer', 'A made man has one. Heat drops to nothing, and if you’re locked up, you’re out. Every two weeks.');
    add('soldier', 'courtesy', 'Collect a courtesy', 'Shops on your ground show a made man respect. A few hundred, no questions.');
    add('soldier', 'piece', 'Request a piece', 'Ask your captain for a share of something the family already runs. His trust in you decides. Once a month.');
    add('soldier', 'stand', 'Stand for one of your men', 'Put your name behind a loan so he can expand. If he does well, you share it. If he defaults, you pay.', !grow.length);
    add('soldier', 'protect', 'Invoke family protection', 'Someone is leaning on your interests. Take it up the chain, and it stops, if the man above you thinks you’re worth it.', !(w.disputes ?? []).some((d) => (d.status === 'open' || d.status === 'violated') && (d.a === p.id || d.b === p.id)));
    add('soldier', 'blame', 'Take responsibility for one of your men', 'Cover a man’s shortfall out of your own pocket. It costs standing. He will not forget it.', !crew.some((c) => c.books.arrears > 0 || c.books.missed > 0));
    add('soldier', 'book', `Open a loan book${book ? ` (${book} running)` : ''}`, `Put ${money((book + 1) * 1500)} out on the street. It pays every week, quietly. Up to three.`, p.cash < (book + 1) * 1500 || book >= 3);
    add('soldier', 'claim', `Claim a district${turf.length ? ` (${turf.length} held)` : ''}`, nextTurf(w, p) ? `Put ${nextTurf(w, p)} under your name. Every shop there pays you a little every week. Costs $1,500.` : 'There’s nothing left in the family’s ground to claim.', p.cash < 1500 || !nextTurf(w, p) || turf.length >= (TURF_CAP[p.rank] ?? 1));
  }
  if (at('capo')) {
    add('capo', 'crewscore', 'Send the crew on a score', 'Everyone under you works one big job together. Pays by the head. Risk of heat, and of somebody getting picked up.', !crew.length);
    add('capo', 'award', 'Award a racket', 'Hand one of your men something big to run. He earns more and owes you for it. He may also get ideas.', !grow.length);
    add('capo', 'court', 'Hold court', 'A weekly sit-down with your men. Their troubles come out, and you hear what they want.', !crew.length);
    add('capo', 'dinner', 'Throw a dinner for the crew', 'It costs $400. Men who eat at your table stay yours.', p.cash < 400 || !crew.length);
    add('capo', 'crew_down', 'Ease your crew’s kick-up (−5 points)', 'They keep more. They like you more. You get less.', !crew.length);
    add('capo', 'crew_up', 'Squeeze your crew’s kick-up (+5 points)', 'You get more. They resent it.', !crew.length);
    add('capo', 'lieut', 'Appoint a lieutenant', 'Pick the man you trust most to chase what’s owed. He’ll collect a little more, and he’ll be looking at your chair.', !crew.some((c) => ri(c.rank) >= 1 || c.rank === 'associate'));
    add('capo', 'successor', 'Develop a successor', 'Name the man you’d want in your seat. When you move up, he gets a crew of his own.', !crew.length);
    add('capo', 'chest_in', 'Put $2,000 in the war chest', 'Money in the chest can’t be spent on suits and friends. It’s there for legal bills and bad weeks.', p.cash < 2000);
    add('capo', 'chest_out', `Take the war chest out${st.chest ? ` (${money(st.chest)})` : ''}`, 'All of it, in cash.', !st.chest);
  }
  if (at('capo')) { add('capo', 'ear', 'Listen at the keyholes', 'Pay a bartender, a barber, a cop. You hear two things you didn’t know. Costs $250.', p.cash < 250); }
  if (at('underboss')) {
    add('underboss', 'tax', 'Tax the captains', 'Every captain pays a cut upward. Good money. They won’t love it.', !caps.length);
    add('underboss', 'review', 'Go through the captains’ books', 'See who has been keeping something back. Anything hidden comes out.');
    add('underboss', 'quiet', 'Order every crew to keep its head down', 'For two weeks the whole family earns a little less and attracts a lot less attention.', dirOn);
    add('underboss', 'push', 'Order every crew to push harder', 'For two weeks everyone earns more, and the police notice.', dirOn);
    add('underboss', 'council', 'Convene the family council', 'Bring the captains together. $500 for the table. They leave feeling heard, and a little more yours.', p.cash < 500 || !caps.length);
    add('underboss', 'allocate', 'Allocate family resources', 'Send $3,000 of the boss’s money to one captain’s crew. He’ll remember who sent it.', !caps.length);
    add('underboss', 'replace', 'Recommend a change of captain', 'Tell the boss one of the captains has had his day. If he agrees, the man is a soldier again and a seat is open.', caps.length < 2);
    add('underboss', 'counsel', 'Whisper in the boss’s ear', 'Quietly lean the boss your way. His trust goes up, and your name with it.');
    add('underboss', 'lean', 'Lean on another family’s racket', 'Take a piece of what’s theirs. Big money, and it raises the temperature between families.');
    add('underboss', 'peace', 'Broker a peace', 'Spend $1,000 to take the heat out of the worst quarrel between families.', p.cash < 1000);
  }
  if (at('boss')) {
    add('boss', 'tribute', 'Collect the family’s tribute', 'Everyone sends something up on the first of the month. This is where the real money is.');
    add('boss', 'rules_down', 'Rewrite the rules: ease the kick-up', 'Everyone passes up 5 points less, for good. Your men are delighted. The treasury shrinks.');
    add('boss', 'rules_up', 'Rewrite the rules: tighten the kick-up', 'Everyone passes up 5 points more, for good. The treasury grows. So does the resentment.');
    add('boss', 'books', fam.booksClosed ? 'Open the books' : 'Close the books', fam.booksClosed ? 'The family may induct new soldiers again. Two more seats open.' : 'No new soldiers until you say so. The ambitious get impatient.');
    add('boss', 'levy', 'Call a levy', 'Everybody owes 7% extra for four weeks. A big pay-out. Nobody’s happy.', levyOn);
    add('boss', 'emergency', 'Declare a family emergency', 'For two weeks, everyone pays 10% extra and the lawyers work for free. The heat comes off. The captains grumble.', levyOn);
    add('boss', 'dispense', 'Grant a dispensation', 'Forgive the biggest debt anyone in the family owes upward. He’s yours for life.', !members(w, p.familyId).some((c) => c.books.arrears > 100));
    add('boss', 'grant', 'Grant a captain exclusive territory', 'Name a captain and give him a neighbourhood outright. He earns more, and passes it up. The others notice.', !caps.length);
    add('boss', 'fund_out', `Draw from the family fund (${money(fam.treasury ?? 0)})`, 'Dues from the made men sit in the fund to look after the men inside. You can take some of it for yourself, and everyone can see the level drop.', (fam.treasury ?? 0) < 500);
    add('boss', 'fund_in', 'Put $2,000 into the family fund', 'The captains see the boss pay his share. The fund looks after the men inside.', p.cash < 2000);
    add('boss', 'orgreview', 'Review the state of the family', 'Who is with you, who is not, what the fund holds, and how the other families see you.');
    add('boss', 'bonus', 'Christmas envelopes', 'Give every made man something. Costs $200 a head. Loyalty money.');
    add('boss', 'commission', 'Sit with the Commission', 'A seat at the table with the other families. Quiets the heat.');
    add('boss', 'peace', 'Broker a peace', 'Spend $1,000 to take the heat out of the worst quarrel between families.', p.cash < 1000);
  }
  const seen = new Set<string>();
  return out.filter((o) => (seen.has(o.code) ? false : (seen.add(o.code), true)));
}

// ================================================================ the powers that only live here
export function usePower2(w: World, p: Character, codeIn: string): string[] | undefined {
  let code = codeIn;
  const rng = w.rng;
  const st = pathState(w);
  const set = (d: number) => { p.cooldown[`pw:${code.split(':')[0]}`] = w.now + d * DAY; };
  const arg = code.split(':')[1];
  code = code.split(':')[0];
  const fam = w.fam[p.familyId!];
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.rank !== 'civilian');
  const caps = members(w, p.familyId!).filter((c) => c.rank === 'capo' && c.id !== p.id);
  const boss = w.chars[fam.bossId];
  switch (code) {
    case 'fund_out': {
      const amt = Math.min(5000, fam.treasury ?? 0);
      const got = treasuryMove(w, fam.id, p, -amt, `${p.name} draws`);
      if (!got) return ['The fund is empty.'];
      set(7);
      for (const c of caps) rel(c, p.id).respect = clamp(rel(c, p.id).respect - 0.01);
      return [`You take ${money(-got)} out of the family fund. It is yours to take. The captains know exactly what the level was last week.`];
    }
    case 'fund_in': {
      const got = treasuryMove(w, fam.id, p, 2000, `${p.name} puts in`);
      if (!got) return ['You don’t have it.'];
      set(7);
      for (const c of caps) rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.02);
      p.books.expenses += got;
      return [`${money(got)} goes into the fund. Nobody says anything. Everybody notices.`];
    }
    case 'orgreview': {
      const r = orgRecord(w, fam.id);
      const rivals = Object.entries(fam.rel ?? {}).filter(([id]) => w.fam[id]).map(([id, x]) => ({ f: w.fam[id], x })).sort((a, b) => b.x.grievance + b.x.comp - a.x.grievance - a.x.comp);
      const lines = [`The ${fam.name} family: ${r.members} made men and associates, ${r.interests} business interests, the fund holds ${money(r.treasury)}. In the city it counts for ${Math.round(r.standing)} out of 100.`];
      if (fam.unrest && fam.unrest.until > w.now) lines.push('The house is still unsettled from the last change at the top.');
      for (const { f, x } of rivals.slice(0, 2)) lines.push(`The ${f.name}: ${x.coop > x.comp + 0.15 ? 'friendly' : x.grievance > 0.35 ? 'a grievance between you' : x.comp > 0.3 ? 'competing for the same ground' : 'no particular quarrel'}.${x.deals.length ? ' ' + x.deals[x.deals.length - 1].text.replace(/^Grievance: /, 'Last: ') + '.' : ''}`);
      const h = r.hist.slice(-2).map((e) => e.text);
      return [...lines, ...h];
    }
    case 'proposition': {
      const b = w.biz[arg];
      if (!b || !b.open) return ['Nobody’s in trouble that you can see.'];
      p.cash -= 2000; bizMove(w, b, 1600, 'aid', p.id); b.distress = 0;
      addStake(w, b, p.id, 0.25, 'bought in');
      set(10);
      return [`${w.chars[b.ownerId]?.name ?? 'The owner'} has been losing money at ${b.name} for weeks. You put in $2,000 for a quarter of what it makes. He signs without reading, which is how you know how bad it was.`, 'If it turns around, you’ll be the man who made it work. A man in your position may notice, and so may others.'];
    }
    case 'errand': {
      const b = p.bossId ? w.chars[p.bossId] : undefined;
      if (!b || !b.alive) return ['There’s nobody above you to do a favour for.'];
      set(7);
      rel(b, p.id).trust = clamp(rel(b, p.id).trust + 0.05); rel(b, p.id).respect = clamp(rel(b, p.id).respect + 0.03);
      p.standing = clamp(p.standing + 0.5, 0, 100);
      addFavour(w, p.id, b.id, 1, 'an errand you ran and never mentioned');
      addFact(w, { kind: 'favour', actor: p.id, victim: b.id, minor: true, text: `${p.name} ran an errand for ${b.name}.`, district: p.district }, { witnesses: [b.id] });
      return [`You carry something across town for ${b.name} and ask nothing. He notices that you didn’t ask.`, 'He owes you one now, and he knows it.'];
    }
    case 'tipoff': {
      p.cash -= 200; set(7);
      p.heat = clamp(p.heat - 0.12, 0, 1);
      return ['A desk sergeant takes an envelope and tells you, without being asked, which streets to avoid this month.', 'Your heat drops.'];
    }
    case 'squeeze': {
      set(7);
      let got = 0; const names: string[] = [];
      for (const c of crew.filter((x) => x.books.arrears > 0 && x.cash > 20)) {
        const take = Math.min(c.books.arrears, Math.floor(c.cash * 0.8)); if (take <= 0) continue;
        c.cash -= take; c.books.arrears -= take; got += take; names.push(c.name.split(' ')[0]);
        rel(c, p.id).trust = clamp(rel(c, p.id).trust - 0.06); rel(c, p.id).grudge = clamp(rel(c, p.id).grudge + 0.03);
        post(w, { from: c.id, to: p.id, amt: take, flow: 'kickup', src: 'arrears', note: 'squeezed' });
      }
      if (!got) return ['Nobody has anything to give you right now.'];
      earn(p, got, 'cut');
      return [`You go round and collect from ${names.join(', ')}. ${money(got)} in all. Nobody argues, and nobody’s glad to see you next time.`];
    }
    case 'findscore': {
      const before = new Set(w.jobs.map((j) => j.id));
      newOffer(w); newOffer(w);
      set(5);
      const fresh = w.jobs.filter((j) => !before.has(j.id));
      return fresh.length ? ['You spend a few days asking the right people the right questions.', ...fresh.map((j) => `A lead: “${j.title}”. It’s under Needs you on your Today screen. Take it or leave it; the job system handles it from there.`)] : ['Nobody knows of anything right now. Try again later.'];
    }
    case 'sidearr': {
      p.cash -= 800; p.books.side = (p.books.side ?? 0) + 120; set(14);
      return ['A handshake, no paper, no names. About $120 a week, outside your crew and out of anybody’s books.', 'It’s yours as long as nobody upstairs finds out.'];
    }
    case 'favour': {
      const f = w.favours.find((x) => x.id === arg && x.to === p.id && !x.settled);
      if (!f) return ['Nobody owes you anything worth calling in.'];
      f.settled = true;
      const c = w.chars[f.from];
      const amt = f.size * 400 + 200;
      if (c?.alive) { const take = Math.min(Math.max(0, c.cash), amt); c.cash -= take; earn(p, take, 'cut'); rel(c, p.id).respect = clamp(rel(c, p.id).respect + 0.02); set(7); return [`You remind ${c.name} of ${f.what}. He doesn’t pretend to forget. ${money(take)} arrives by the end of the week, with a handshake instead of a receipt.`]; }
      return ['The man who owed you is gone. The favour went with him.'];
    }
    case 'protect': {
      const d = (w.disputes ?? []).find((x) => (x.status === 'open' || x.status === 'violated') && (x.a === p.id || x.b === p.id));
      set(14);
      if (!d) return ['Nobody is leaning on you.'];
      const b = p.bossId ? w.chars[p.bossId] : undefined;
      const ok = b && rng.chance(clamp(0.3 + rel(b, p.id).trust * 0.6 + (hasPerk(w, p, 'negotiator') ? 0.15 : 0), 0.15, 0.95));
      if (!ok) return [`${b?.name ?? 'Your captain'} listens and says he’ll look into it. He doesn’t sound like he will. The family will protect what it thinks is worth protecting.`];
      d.status = 'dropped'; d.history.push({ t: w.now, text: `${p.name} took it to his captain, and the family made it stop.` });
      return [`You put it to ${b!.name} as a matter of respect for the family. A word goes to the other side. By the weekend it’s over, as though it had never been started.`];
    }
    case 'blame': {
      const c = crew.filter((x) => x.books.arrears > 0 || x.books.missed > 0).sort((a, b) => b.books.arrears - a.books.arrears)[0];
      if (!c) return ['Nobody’s short.'];
      const pay = Math.min(p.cash, Math.max(150, c.books.arrears));
      p.cash -= pay; c.books.arrears = Math.max(0, c.books.arrears - pay); c.books.missed = 0;
      p.standing = clamp(p.standing - 2, 0, 100);
      rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.2); rel(c, p.id).affection = clamp(rel(c, p.id).affection + 0.08);
      set(10);
      return [`${c.name} was short, and everyone knew it. You told ${p.bossId ? w.chars[p.bossId]?.name : 'the man upstairs'} it was your oversight, and covered ${money(pay)}.`, `${first(c)} won’t say anything about it. That’s how you know he won’t forget.`];
    }
    case 'court': {
      set(7);
      const lines: string[] = ['Your men come in one at a time. You listen. Mostly it’s money, and sometimes it’s something else.'];
      for (const c of crew.sort(() => rng.next() - 0.5).slice(0, 3)) {
        rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.03);
        if (c.problem && !c.problem.revealed) { c.problem.revealed = true; lines.push(`${c.name} finally says it: he’s struggling with ${c.problem.kind === 'gambling' ? 'the horses' : c.problem.kind === 'debt' ? 'a debt' : c.problem.kind === 'family' ? 'trouble at home' : c.problem.kind === 'drink' ? 'drink' : c.problem.kind === 'house' ? 'money for a house' : c.problem.kind === 'woman' ? 'a woman who costs him' : 'resentment'}.`); }
        else if (c.want) lines.push(`${c.name} tells you what he’s after, in his way: ${c.want.kind === 'made' ? 'he wants to be made' : c.want.kind === 'gamble' ? 'he wants a book of his own' : c.want.kind === 'independent' ? 'he wants to stop answering to anyone' : c.want.kind === 'lieutenant' ? 'he wants to be your right hand' : c.want.kind === 'rich' ? 'he wants money, plainly' : 'he wants to be respected'}.`);
        const k = ((p.insight ??= {})[c.id] ??= []); if (!k.includes('want')) k.push('want');
      }
      return lines;
    }
    case 'crew_up':
    case 'crew_down': {
      const d = code === 'crew_down' ? -0.05 : 0.05;
      for (const c of crew) { c.kickRate = clamp(c.kickRate + d, 0.05, 0.35); rel(c, p.id).trust = clamp(rel(c, p.id).trust + (d < 0 ? 0.07 : -0.07)); }
      set(21);
      return [d < 0 ? 'You tell them they’re keeping five points more. They look at each other, then at you. Nobody argues.' : 'You tell them five points more. Nobody says anything. That’s what nobody says anything sounds like.'];
    }
    case 'lieut': {
      const c = crew.filter((x) => x.rank === 'soldier' || x.rank === 'associate').sort((a, b) => rel(b, p.id).trust - rel(a, p.id).trust)[0];
      if (!c) return ['Nobody who could do it.'];
      st.lieut = c.id; rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.2); c.traits.ambition = clamp(c.traits.ambition + 0.05);
      if (c.want) c.want = { kind: 'respect', since: w.now };
      set(30);
      return [`${c.name} is your lieutenant now. From this week he chases what’s owed, and he’s good at it. He’s also standing a little closer to you than he used to.`];
    }
    case 'successor': {
      const c = crew.filter((x) => ri(x.rank) >= 1 || x.rank === 'associate').sort((a, b) => b.lifetimeKick - a.lifetimeKick)[0];
      if (!c) return ['Nobody yet.'];
      st.successor = c.id; rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.15); set(45);
      return [`You tell ${c.name}, privately, that when you move up, he’ll have a crew. He says nothing and works harder.`];
    }
    case 'chest_in': { p.cash -= 2000; st.chest = (st.chest ?? 0) + 2000; set(1); return ['Into a locked drawer in a room nobody’s seen. It’s there if you need it. It’s not there to be spent.']; }
    case 'chest_out': { const n = st.chest ?? 0; p.cash += n; st.chest = 0; set(1); return [`${money(n)} comes out of the drawer.`]; }
    case 'council': {
      p.cash -= 500; set(21);
      for (const c of caps) { rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.05); rel(c, p.id).respect = clamp(rel(c, p.id).respect + 0.03); }
      for (const c of caps) for (const d of caps) if (c.id !== d.id) rel(c, d.id).trust = clamp(rel(c, d.id).trust + 0.02);
      return [`${caps.map(first).join(', ')} sit at one table and talk through the family’s week. Nothing is decided and everyone leaves feeling it was theirs.`];
    }
    case 'allocate': {
      const c = caps.sort((a, b) => rel(a, p.id).trust - rel(b, p.id).trust)[0];
      if (!c || !boss) return ['Nobody to send it to.'];
      if (rel(boss, p.id).trust < 0.4) return [`${boss.name} won’t release it. “Not on your say.”`];
      const amt = Math.min(3000, Math.max(0, boss.cash));
      boss.cash -= amt; c.cash += amt; rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.1);
      for (const x of Object.values(w.chars)) if (x.alive && x.bossId === c.id && x.hustle) x.cash += Math.round(amt / 8);
      const k = (st.favs ??= {}); k[c.id] = (k[c.id] ?? 0) + 1; noticeFavour(w, p, c);
      set(10);
      return [`${money(amt)} of the family’s money goes to ${c.name}’s crew, and it goes with your name on it.`];
    }
    case 'replace': {
      if (!boss || caps.length < 2) return ['It isn’t the time.'];
      set(30);
      const worst = caps.sort((a, b) => a.lifetimeKick - b.lifetimeKick)[0];
      if (!rng.chance(clamp(0.2 + rel(boss, p.id).trust * 0.6, 0.1, 0.85))) return [`${boss.name} hears you out. “He stays. For now.”`];
      applyRank(w, worst, 'soldier', { wage: 150, fact: false, repair: false, place: (x) => { x.bossId = p.id; } });
      for (const x of Object.values(w.chars)) if (x.alive && x.bossId === worst.id) x.bossId = p.id;
      rel(worst, p.id).grudge = clamp(rel(worst, p.id).grudge + 0.4); rel(worst, p.id).trust = clamp(rel(worst, p.id).trust - 0.3);
      addFact(w, { kind: 'promotion', actor: boss.id, victim: worst.id, text: `${worst.name} has been put back to soldier. ${boss.name} didn’t say why. Everyone has a theory, and most of them involve ${p.name}.`, district: worst.district }, { broadcast: members(w, fam.id).map((c) => c.id) });
      repairHierarchy(w, p.familyId!);
      return [`${boss.name} makes the decision the way he makes them, in one sentence. ${worst.name} is a soldier again, and a captain’s seat is open.`, 'He knows who spoke.'];
    }
    case 'books': {
      fam.booksClosed = !fam.booksClosed; set(20);
      if (!fam.booksClosed) fam.capBonus = { ...(fam.capBonus ?? {}), soldier: (fam.capBonus?.soldier ?? 0) + 2 };
      return [fam.booksClosed ? 'You close the books. No new soldiers until further notice. A lot of ambitious men are going to find out about it tonight.' : 'You open the books. Two more places. Every associate who ever wanted it now has a reason to try.'];
    }
    case 'emergency': {
      fam.levy = { extra: 0.1, until: w.now + 14 * DAY }; set(60);
      for (const c of members(w, fam.id)) { c.heat = Math.max(0, c.heat - 0.4); if (c.id !== p.id) rel(c, p.id).trust = clamp(rel(c, p.id).trust - 0.04); }
      addFact(w, { kind: 'levy', actor: p.id, text: `${p.name} has declared an emergency. Everyone owes 10% extra for two weeks, and the family’s lawyers are on call.`, district: p.district }, { broadcast: members(w, fam.id).map((c) => c.id) });
      return ['You say the word, and for two weeks the family answers to one person. The lawyers start making calls. Everyone pays more, and nobody argues.'];
    }
    case 'dispense': {
      const c = members(w, fam.id).filter((x) => x.books.arrears > 100).sort((a, b) => b.books.arrears - a.books.arrears)[0];
      if (!c) return ['Nobody owes anything worth forgiving.'];
      const n = c.books.arrears; c.books.arrears = 0; c.books.missed = 0;
      rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.25); rel(c, p.id).affection = clamp(rel(c, p.id).affection + 0.1);
      addFavour(w, p.id, c.id, 2, `forgiving ${money(n)} he owed upward`);
      set(14);
      return [`You tell ${c.name} the ${money(n)} is forgotten. He doesn’t say anything, because there’s nothing to say. Everyone hears about it by evening.`];
    }
    case 'grant': {
      const c = caps.sort((a, b) => rel(b, p.id).trust - rel(a, p.id).trust)[0];
      if (!c) return ['Nobody to give it to.'];
      c.books.side = (c.books.side ?? 0) + 350; c.books.sideKnown = true; rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.15);
      for (const o of caps) if (o.id !== c.id) rel(o, p.id).trust = clamp(rel(o, p.id).trust - 0.03);
      set(21);
      return [`${c.name} is told a whole neighbourhood is his, in so many words. He’ll earn much more, and pass a lot of it up. The other captains hear it by lunch.`];
    }
    default: return undefined;
  }
}

function noticeFavour(w: World, p: Character, c: Character) {
  const st = pathState(w);
  const k = st.favs ?? {};
  if ((k[c.id] ?? 0) >= 3) {
    for (const o of members(w, p.familyId!).filter((x) => x.rank === 'capo' && x.id !== c.id && x.id !== p.id)) rel(o, p.id).trust = clamp(rel(o, p.id).trust - 0.04);
    k[c.id] = 0;
    addFact(w, { kind: 'rumour', actor: p.id, minor: true, text: `The other captains have noticed that ${p.name} keeps looking after ${c.name}.`, district: p.district }, { witnesses: [] });
  }
}

// ================================================================ business stakes and the made man who wants a piece
function stakeWeek(w: World) {
  const p = PL(w);
  const mine = p?.alive ? stakesOf(w, p.id) : [];
  if (!p?.alive || !mine.length) return;
  // The share itself is paid out of the till with the rest of the week's accounts (econ.ts businessWeek). What is left here is what
  // having a stake in the place does for it, and what other people make of it.
  for (const { b, s } of mine) {
    if (!b.open) continue;
    b.distress = Math.max(0, b.distress - 1);
    if (w.now - s.since > 6 * WEEK && !s.shaken && ri(p.rank) <= 1 && w.rng.chance(0.08) && !w.enc.some((e) => e.kind === 'crew' && e.status === 'open')) {
      const rivals = Object.values(w.chars).filter((c) => c.alive && ri(c.rank) >= 2 && c.familyId && c.familyId !== p.familyId);
      const x = rivals.length ? pick(w, rivals) : undefined;
      if (!x) continue;
      s.shaken = w.now;
      addEnc(w, {
        kind: 'crew', from: x.id, title: `${first(x)} wants a piece of ${b.name}`, days: 8,
        lines: [`${x.name}, of the ${w.fam[x.familyId!].name} family, finds you.`, `"I hear ${b.name} is doing very well. I hear you’re in it. It would be a shame if it were someone’s business whose it was. Ten percent seems fair."`],
        opts: [
          { code: 'pay', label: 'Give him what he asks', hint: 'You keep the peace. Your share drops.' },
          { code: 'confront', label: 'Tell him no, to his face', hint: 'He’s a made man. You’re not. Think about it.' },
          { code: 'sponsor', label: 'Take it to your sponsor', hint: 'It uses up some of his goodwill, and he’ll want it repaid.' },
        ],
        data: { what: 'shake', biz: b.id },
      });
    }
  }
}

// ================================================================ the underboss's agenda
function agendaTick(w: World) {
  const p = PL(w);
  if (!p?.alive || p.rank !== 'underboss' || w.enc.some((e) => e.kind === 'crew' && e.status === 'open') || !w.rng.chance(0.4)) return;
  const caps = members(w, p.familyId!).filter((c) => c.rank === 'capo' && c.id !== p.id && c.jailedUntil <= w.now);
  if (!caps.length) return;
  const c = pick(w, caps);
  const kind = pick(w, caps.length > 1 ? ['expand', 'territory', 'funds'] : ['expand', 'funds']);
  const f2 = pick(w, Object.values(w.fam).filter((f) => f.id !== p.familyId));
  if (kind === 'expand') addEnc(w, { kind: 'crew', from: c.id, title: `${first(c)} wants to expand`, days: 8, lines: [`${c.name} has a proposal.`, `"There’s ground on the ${f2.name} border that nobody’s working properly. I want it. I need your support, and I need the Don to hear about it. You decide how."`], opts: [{ code: 'don', label: 'Bring it to the Don', hint: 'Depends on how the boss feels about you.' }, { code: 'private', label: 'Back him quietly, with $1,000', hint: 'It stays between you. The border gets warmer.' }, { code: 'postpone', label: 'Tell him to wait', hint: 'He’ll wait. He’ll notice.' }], data: { what: 'agenda_expand', fam: f2.id } });
  else if (kind === 'territory') { const d = pick(w, caps.filter((x) => x.id !== c.id)); addEnc(w, { kind: 'crew', from: c.id, about: d.id, title: `${first(c)} and ${first(d)} disagree about territory`, days: 8, lines: [`${c.name} comes to you first.`, `"${d.name} has been working a block that’s mine. I’m not going to the Don over it. I’m going to you."`], opts: [{ code: 'for', label: `Side with ${first(c)}`, hint: `${first(c)} is grateful. ${first(d)} isn’t.` }, { code: 'against', label: `Side with ${first(d)}`, hint: `The other way round.` }, { code: 'table', label: 'Put them at one table, $300 for the meal', hint: 'Slower. Nobody loses face.' }], data: { what: 'agenda_territory' } }); }
  else addEnc(w, { kind: 'crew', from: c.id, title: `${first(c)} wants family money`, days: 8, lines: [`${c.name} asks for ten minutes.`, `"I have something that would make everyone money. I need $3,000 from the family to start it. You have the Don’s ear."`], opts: [{ code: 'don', label: 'Put it to the Don', hint: 'If he trusts you, he’ll pay.' }, { code: 'give', label: 'Give $1,500 of your own', hint: 'He’ll owe you.' }, { code: 'refuse', label: 'Tell him no', hint: 'Better he hears it from you.' }], data: { what: 'agenda_funds' } });
}

export function agendaChoose(w: World, p: Character, e: Enc, code: string): string[] | undefined {
  const what = String(e.data?.what ?? '');
  const c = e.from ? w.chars[e.from] : undefined;
  if (!c || !(what.startsWith('agenda') || what === 'shake')) return undefined;
  const rc = rel(c, p.id);
  const boss = w.chars[w.fam[p.familyId!].bossId];
  const st = pathState(w);
  const fav = () => { const k = (st.favs ??= {}); k[c.id] = (k[c.id] ?? 0) + 1; noticeFavour(w, p, c); p.rep ??= { kept: 0, broken: 0, asked: 0, ignored: 0, favoured: null }; p.rep.favoured = c.id; };
  if (what === 'shake') {
    const b = w.biz[String(e.data?.biz)];
    const s = stakesOf(w, p.id).find((x) => x.b.id === b?.id)?.s;
    if (code === 'pay') { if (s) s.share = Math.max(0.1, s.share - 0.1); return [`${c.name} nods. "Sensible." You keep a smaller share of something you built. You also keep your teeth.`]; }
    if (code === 'confront') {
      if (w.rng.chance(clamp(0.25 + p.traits.violence * 0.25 + p.traits.courage * 0.2 + p.standing / 400, 0.15, 0.7))) { p.standing = clamp(p.standing + 4, 0, 100); rel(c, p.id).respect = clamp(rel(c, p.id).respect + 0.15); return [`You don’t raise your voice. ${c.name} measures you, and finds something he didn’t expect. He leaves. Word gets round that you can’t be leaned on.`]; }
      p.hurtUntil = w.now + 5 * DAY; p.standing = clamp(p.standing - 3, 0, 100); if (s) s.share = Math.max(0.1, s.share - 0.1);
      return [`${c.name} has two men with him. It’s over quickly. You’re hurt for a few days, and your share is smaller anyway.`];
    }
    const sp = p.bossId ? w.chars[p.bossId] : undefined;
    if (sp && rel(sp, p.id).trust >= 0.35) { rel(sp, p.id).trust = clamp(rel(sp, p.id).trust - 0.03); addFavour(w, p.id, sp.id, 1, `stepping in when ${c.name} came for ${b?.name ?? 'the business'}`); return [`${sp.name} has a word with ${c.name}’s captain. The matter goes away. ${sp.name} doesn’t say you owe him. He doesn’t have to.`]; }
    return [`${sp?.name ?? 'Your sponsor'} doesn’t know you well enough to stick his neck out. You’re on your own, and ${c.name} knows it.`];
  }
  if (what === 'agenda_expand') {
    if (code === 'don') {
      const ok = boss && w.chars[w.fam[p.familyId!].bossId] && w.rng.chance(clamp(0.2 + rel(boss, p.id).trust * 0.7, 0.15, 0.9));
      fav();
      if (ok) { rc.trust = clamp(rc.trust + 0.12); const f2 = w.fam[String(e.data?.fam)]; if (f2) { w.fam[p.familyId!].tension[f2.id] = (w.fam[p.familyId!].tension[f2.id] ?? 0) + 1; f2.tension[p.familyId!] = (f2.tension[p.familyId!] ?? 0) + 1; } c.cash += 1500; return [`${boss!.name} hears you out and nods. “Do it, carefully.” ${c.name} is grateful. The ${f2?.name ?? 'other'} people will find out soon enough.`]; }
      rc.trust = clamp(rc.trust - 0.04); return [`${boss?.name ?? 'The Don'} says no. ${first(c)} takes it badly, because you were the one who had to tell him.`];
    }
    if (code === 'private') { if (p.cash < 1000) return ['You haven’t got it.']; p.cash -= 1000; c.cash += 1000; rc.trust = clamp(rc.trust + 0.1); fav(); const f2 = w.fam[String(e.data?.fam)]; if (f2) { w.fam[p.familyId!].tension[f2.id] = (w.fam[p.familyId!].tension[f2.id] ?? 0) + 1; } return [`${first(c)} gets what he needs without anyone upstairs knowing. He knows who to thank.`]; }
    rc.trust = clamp(rc.trust - 0.05); return [`${first(c)} says he understands. He’ll be back, and he won’t ask nicely.`];
  }
  if (what === 'agenda_territory') {
    const d = e.about ? w.chars[e.about] : undefined;
    if (!d) return ['It has settled itself.'];
    if (code === 'for') { rc.trust = clamp(rc.trust + 0.12); rel(d, p.id).trust = clamp(rel(d, p.id).trust - 0.12); rel(d, c.id).grudge = clamp(rel(d, c.id).grudge + 0.2); fav(); return [`${first(c)} keeps the block. ${first(d)} doesn’t say anything, which is worse.`]; }
    if (code === 'against') { rel(d, p.id).trust = clamp(rel(d, p.id).trust + 0.12); rc.trust = clamp(rc.trust - 0.12); rc.grudge = clamp(rc.grudge + 0.08); return [`${first(d)} keeps the block. ${first(c)} tells you it’s a mistake, and that he’ll remember.`]; }
    if (p.cash < 300) return ['You can’t even cover dinner.'];
    p.cash -= 300; rc.trust = clamp(rc.trust + 0.03); rel(d, p.id).trust = clamp(rel(d, p.id).trust + 0.03); rel(c, d.id).trust = clamp(rel(c, d.id).trust + 0.08); rel(d, c.id).trust = clamp(rel(d, c.id).trust + 0.08);
    return ['A long dinner, a bottle, and two men who both want to be seen as reasonable. They split it. Neither is happy. Neither is angry.'];
  }
  if (what === 'agenda_funds') {
    if (code === 'don') { const ok = boss && w.rng.chance(clamp(0.2 + rel(boss, p.id).trust * 0.7, 0.15, 0.9)); fav(); if (ok) { boss!.cash -= Math.min(3000, Math.max(0, boss!.cash)); c.cash += 3000; rc.trust = clamp(rc.trust + 0.1); return [`${boss!.name} approves it with a nod. ${first(c)} has his money and knows exactly whose word got it for him.`]; } rc.trust = clamp(rc.trust - 0.04); return [`${boss?.name ?? 'The Don'} says no. ${first(c)} looks at you as if you’d failed him personally.`]; }
    if (code === 'give') { if (p.cash < 1500) return ['You haven’t got it.']; p.cash -= 1500; c.cash += 1500; rc.trust = clamp(rc.trust + 0.12); addFavour(w, p.id, c.id, 2, 'family money he needed'); fav(); return [`${first(c)} takes it without a word. He owes you now.`]; }
    rc.trust = clamp(rc.trust - 0.03); return [`${first(c)} thanks you for being straight. He won’t ask you again.`];
  }
  return undefined;
}

// ================================================================ the Commission
export interface CommState { court: Record<Id, number>; allies: Id[]; cd: Record<string, number> }
export const commOf = (w: World): CommState => ((pathState(w).comm ??= { court: {}, allies: [], cd: {} }));
export function supportOf(w: World, p: Character, fid: Id): number {
  const f = w.fam[fid], mine = w.fam[p.familyId!];
  const b = w.chars[f.bossId];
  if (!b?.alive) return 0.3;
  const cm = commOf(w);
  return clamp(0.5 - (mine.tension[fid] ?? 0) * 0.07 + rel(b, p.id).trust * 0.3 + (cm.court[fid] ?? 0) + (cm.allies.includes(fid) ? 0.25 : 0), 0.05, 0.95);
}
export const supportWord = (s: number) => s > 0.75 ? 'Behind you' : s > 0.55 ? 'Open' : s > 0.35 ? 'Cool' : 'Hostile';
export function courtBoss(w: World, p: Character, fid: Id): string[] {
  const cm = commOf(w);
  if ((cm.cd[`court:${fid}`] ?? 0) > w.now) return ['You were with him recently. Give it time.'];
  if (p.cash < 2000) return ['A gesture of that kind is $2,000. You haven’t got it.'];
  p.cash -= 2000; cm.cd[`court:${fid}`] = w.now + 14 * DAY;
  cm.court[fid] = Math.min(0.3, (cm.court[fid] ?? 0) + 0.15);
  const b = w.chars[w.fam[fid].bossId];
  if (b) rel(b, p.id).trust = clamp(rel(b, p.id).trust + 0.08);
  return [`A dinner, a gift, a conversation about nothing. ${b?.name ?? 'He'} leaves in a better mood than he arrived.`];
}
export interface Proposal { code: string; label: string; hint: string; cost: number; fam?: Id }
export function proposals(w: World, p: Character): Proposal[] {
  const others = Object.values(w.fam).filter((f) => f.id !== p.familyId);
  const out: Proposal[] = [
    { code: 'peace', label: 'A family-wide peace', hint: 'Every family eases off. If it passes, tension drops with everyone.', cost: 0 },
    { code: 'invest', label: 'A joint investment', hint: 'Everyone puts in. Costs you $8,000. If it passes, it pays well.', cost: 8000 },
    { code: 'recognise', label: 'Recognition of your leadership', hint: 'The other bosses formally acknowledge you. Your name travels.', cost: 0 },
    { code: 'collective', label: 'A collective response to the heat', hint: 'Every family pulls back for a month. Police pressure eases. $1,000.', cost: 1000 },
  ];
  for (const f of others) out.push({ code: 'alliance', fam: f.id, label: `An alliance with the ${f.name} family`, hint: (commOf(w).allies.includes(f.id) ? 'You already have one.' : 'Needs their boss to want it. Allies pay each other a little and fight each other less.'), cost: 0 });
  return out;
}
export function propose(w: World, p: Character, code: string, fid?: Id): string[] {
  const cm = commOf(w);
  const key = code + (fid ?? '');
  if ((cm.cd[key] ?? 0) > w.now) return ['That was put to the table recently. Nobody wants to hear it again.'];
  const prop = proposals(w, p).find((x) => x.code === code && x.fam === fid);
  if (!prop) return ['No such proposal.'];
  if (p.cash < prop.cost) return [`That costs ${money(prop.cost)}. You haven’t got it.`];
  if (code === 'alliance' && cm.allies.includes(fid!)) return ['You’re already allied.'];
  cm.cd[key] = w.now + 21 * DAY;
  const others = Object.values(w.fam).filter((f) => f.id !== p.familyId && (code !== 'alliance' || f.id === fid));
  const lines: string[] = [];
  let yes = 0;
  for (const f of others) {
    const b = w.chars[f.bossId];
    let s = supportOf(w, p, f.id);
    if (b) { if (code === 'peace' && temper(b).volatility > 0.7) s -= 0.2; if (code === 'peace' && temper(b).agreeable > 0.65) s += 0.1; if (code === 'invest' && b.traits.greed > 0.7) s += 0.1; if (code === 'recognise' && b.traits.ambition > 0.7) s -= 0.15; }
    const ok = w.rng.chance(clamp(s, 0.05, 0.95));
    if (ok) yes++;
    lines.push(`${b?.name ?? f.name}: ${ok ? 'for' : 'against'}.`);
  }
  const passed = code === 'alliance' ? yes >= 1 : yes * 2 >= others.length;
  p.cash -= prop.cost;
  const mine = w.fam[p.familyId!];
  if (!passed) {
    p.standing = clamp(p.standing - 2, 0, 100);
    if (code === 'invest') { earn(p, 0, 'business'); p.cash += 4000; }
    if (code === 'alliance' && fid) { mine.tension[fid] = (mine.tension[fid] ?? 0) + 1; }
    return [...lines, 'It doesn’t pass. Nobody says why. You’ll have to work out who to speak to before next time.'];
  }
  if (code === 'peace') for (const f of others) { mine.tension[f.id] = Math.max(0, (mine.tension[f.id] ?? 0) - 3); f.tension[mine.id] = Math.max(0, (f.tension[mine.id] ?? 0) - 3); noteDeal(w, mine.id, f.id, 'a peace agreed at the Commission', 0.15); }
  else if (code === 'invest') { earn(p, 14000, 'business'); for (const f of others) { mine.tension[f.id] = Math.max(0, (mine.tension[f.id] ?? 0) - 1); } }
  else if (code === 'recognise') { p.standing = clamp(p.standing + 8, 0, 100); for (const c of members(w, mine.id)) rel(c, p.id).respect = clamp(rel(c, p.id).respect + 0.03); }
  else if (code === 'collective') { for (const c of Object.values(w.chars)) if (c.alive && c.familyId) c.heat = Math.max(0, c.heat - 0.4); mine.directive = { kind: 'quiet', until: w.now + 28 * DAY }; }
  else if (code === 'alliance' && fid) { cm.allies.push(fid); mine.tension[fid] = 0; w.fam[fid].tension[mine.id] = 0; }
  p.standing = clamp(p.standing + 2, 0, 100);
  return [...lines, code === 'peace' ? `It passes. For a while, ${others.length + 1} families want the same thing.` : code === 'invest' ? 'It passes. The money moves, and your cut is considerable.' : code === 'recognise' ? 'It passes. Your name is said differently in rooms you’ve never been in.' : code === 'collective' ? 'It passes. For a month, the city is a little quieter.' : 'It passes. You have an ally, and so do they.'];
}
function commissionWeek(w: World) {
  const p = PL(w);
  const cm = w.path?.comm;
  if (!p?.alive || !cm) return;
  for (const k of Object.keys(cm.court)) { cm.court[k] = Math.max(0, cm.court[k] - 0.02); }
  for (const fid of cm.allies) {
    const f = w.fam[fid], mine = w.fam[p.familyId!];
    if (!f || !mine) continue;
    mine.tension[fid] = Math.max(0, (mine.tension[fid] ?? 0) - 1); f.tension[mine.id] = Math.max(0, (f.tension[mine.id] ?? 0) - 1);
    if (p.rank === 'boss') earn(p, 500, 'business');
  }
}

// ================================================================ consigliere, heir, crews
export function setConsigliere(w: World, p: Character, c: Character): string[] {
  if (p.rank !== 'boss' || c.familyId !== p.familyId) return ['Not yours to name.'];
  const fam = w.fam[p.familyId!];
  fam.consigliere = c.id;
  rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.2);
  addFact(w, { kind: 'promotion', actor: p.id, minor: true, text: `${c.name} has been named consigliere of the ${fam.name} family. He’ll sit in on the Don’s decisions.`, district: c.district }, { broadcast: members(w, fam.id).map((x) => x.id) });
  return [`${c.name} is your consigliere. He has no men, and everyone else’s attention.`];
}
export function setHeir(w: World, p: Character, c: Character): string[] {
  if (p.rank !== 'boss' || c.familyId !== p.familyId) return ['Not yours to name.'];
  const fam = w.fam[p.familyId!];
  fam.heir = c.id;
  rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.1);
  for (const o of members(w, fam.id)) if (o.rank === 'capo' && o.id !== c.id && o.id !== p.id) rel(o, p.id).trust = clamp(rel(o, p.id).trust - 0.04);
  return [`${c.name} is named as your successor, privately. Some people will guess. They won’t love it.`];
}
export function setBoss(w: World, p: Character, c: Character, to: Character): string[] {
  if (ri(p.rank) < 3 || c.familyId !== p.familyId || to.familyId !== p.familyId || to.rank !== 'capo' || c.rank === 'capo' || c.rank === 'underboss' || c.rank === 'boss') return ['That isn’t yours to move.'];
  c.bossId = to.id;
  rel(c, p.id).trust = clamp(rel(c, p.id).trust - 0.02);
  return [`${c.name} now answers to ${to.name}.`];
}
function consigTick(w: World) {
  const p = PL(w);
  if (!p?.alive || p.rank !== 'boss') return;
  const fam = w.fam[p.familyId!];
  const c = fam.consigliere ? w.chars[fam.consigliere] : undefined;
  if (!c?.alive || c.familyId !== fam.id) return;
  rel(c, p.id).trust = clamp(rel(c, p.id).trust + 0.005);
  const fresh = Object.entries(c.known).filter(([id]) => !p.known[id] && w.facts[id] && !w.facts[id].minor).map(([id, k]) => ({ f: w.facts[id], k }))[0];
  if (fresh) { learn(w, p.id, fresh.f, c.id, fresh.k.knowsActor); addFact(w, { kind: 'report', actor: c.id, minor: false, text: `${c.name} brings you word: ${factText(fresh.f, fresh.k.knowsActor)}`, district: c.district }, { witnesses: [p.id] }); }
}

// ================================================================ weekly
export function rankWeek(w: World) {
  const p = PL(w);
  if (!p?.alive) return;
  const st = pathState(w);
  if (!st.origin) st.origin = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.id !== p.id).map((c) => c.id);
  if (p.books.side) p.cash += p.books.side; // off the books on purpose
  ledgerTick(w); lifeWeek(w); stakeWeek(w); agendaTick(w); commissionWeek(w); consigTick(w);
}
