// A score you play (the made man's life, Phase 1.5: one score, the truck hijack, played as a sequence rather than one roll). A tip
// comes from somebody with a reason; the player prepares as he chooses (case the route, get the driver in on it, find out whose load
// it is, set up the fence, choose who comes); the moment offers the ways in that his preparation opened, told as odds he would judge;
// sometimes it goes sideways and he decides there and then; and the after is the world's: the fence's money, his men's cut and the
// driver's, heat, an arrest, what the driver tells the police, and a protector who wants to know who robbed his client. It is all
// one encounter that moves through its stages (kind 'score', data.stage), and writes only through the world's doors.
import { addFact, clamp, feel, money, notifyProtector, peek, repute, transfer, writeDown } from './core';
import { addEnc } from './encounters';
import { aptitude } from './people';
import { jail } from './jobs';
import { temper } from './temper';
import { DAY, type Business, type Character, type Enc, type EncOpt, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const CARGO = [
  { what: 'a trailer of television sets', from: 'the Bush Terminal', value: 3600 },
  { what: 'a truck of untaxed cigarettes', from: 'a bonded warehouse in Elizabeth', value: 2600 },
  { what: 'a load of fur coats', from: 'the garment district', value: 4200 },
  { what: 'a truck of Scotch whisky', from: 'the piers at Red Hook', value: 3000 },
  { what: 'a load of men’s suits', from: 'a factory on Seventh Avenue', value: 2200 },
];
const odds = (x: number) => (x >= 0.8 ? 'It should go smoothly.' : x >= 0.62 ? 'Good odds.' : x >= 0.45 ? 'It could go either way.' : 'Long odds.');
const crewOf = (w: World, p: Character) => Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.jailedUntil <= w.now && c.hurtUntil <= w.now);
const flag = (e: Enc, k: string) => Number(e.data?.[k] ?? 0);
const menOf = (w: World, e: Enc) => String(e.data?.men ?? '').split(',').map((id) => w.chars[id]).filter((c): c is Character => !!c?.alive);

/** Who might bring the player a truck, and why: a man who owes him (and has a cousin who drives), or one of his own men. */
export function scoreTip(w: World, p: Character): { giver: Character; src: 'owes' | 'crew' } | undefined {
  if (p.jailedUntil > w.now || p.standing < 30 || (p.cooldown['score'] ?? 0) > w.now || w.enc.some((e) => e.kind === 'score' && e.status === 'open')) return undefined;
  const owes = w.debts.filter((d) => d.status === 'active' && d.creditor === p.id).map((d) => w.chars[d.debtor]).find((c) => c?.alive && !c.isPlayer && c.jailedUntil <= w.now);
  if (owes) return { giver: owes, src: 'owes' };
  const man = crewOf(w, p).sort((a, b) => aptitude(b, 'hijack') - aptitude(a, 'hijack') || (a.id < b.id ? -1 : 1))[0];
  return man ? { giver: man, src: 'crew' } : undefined;
}

export function makeScore(w: World, p: Character, giver: Character, src: 'owes' | 'crew') {
  p.cooldown['score'] = w.now + 30 * DAY;
  const c = CARGO[w.rng.int(0, CARGO.length - 1)];
  // (bound for a real place in the city: whose load it is is a question the player can ask)
  const b = Object.values(w.biz).filter((x) => x.open && x.income >= 150).sort((a, b2) => (a.id < b2.id ? -1 : 1))[w.rng.int(0, Object.values(w.biz).filter((x) => x.open && x.income >= 150).length - 1)];
  const value = Math.round(c.value * w.rng.range(0.8, 1.2) / 50) * 50;
  // (Thursday night at eleven, at least a day off)
  const today = Math.floor(w.now / DAY); let at = (today + ((3 - (today % 7) + 7) % 7)) * DAY + 23 * 60; if (at - w.now < DAY) at += 7 * DAY;
  const said = src === 'owes' ? `“I know I owe you. Maybe this squares it. My cousin drives for a carrier. Thursday night he takes ${c.what} out of ${c.from}, bound for ${b?.name ?? 'a store uptown'}. He stops for coffee on Third Avenue. Every time.”`
    : `“There’s ${c.what} coming out of ${c.from} Thursday night, bound for ${b?.name ?? 'a store uptown'}. One driver. I’ve watched it twice.”`;
  addEnc(w, {
    kind: 'score', from: giver.id, title: `${first(giver)} knows about a truck`, days: 6, data: { stage: 'tip', what: c.what, value, biz: b?.id ?? '', src, at },
    lines: [`${giver.name} finds you where nobody else is listening.`, said, `Worth ${money(value)} at the door, maybe. A fence pays a third of that.`],
    opts: [{ code: 'plan', label: 'Start planning it', hint: 'Nothing’s decided until you go.' }, { code: 'pass', label: 'Let it go by', hint: 'There’ll be other trucks.' }],
  });
}

// ------------------------------------------------------------ the stages
function prepOpts(w: World, p: Character, e: Enc): EncOpt[] {
  const o: EncOpt[] = [];
  if (!flag(e, 'cased')) o.push({ code: 'case', label: 'Case the route yourself', hint: 'Two hours in a parked car. You learn where he stops and who else is on the road.' });
  if (!flag(e, 'driver')) o.push({ code: 'driver', label: 'Have a word with the driver', hint: e.data?.src === 'owes' ? 'The cousin. He may give it up for a cut, and then it’s easy.' : 'A driver who gives it up is the safest way. A driver who says no may say so to somebody else.' });
  if (!e.data?.whose) o.push({ code: 'whose', label: 'Find out whose load it is', hint: 'Robbing a store that pays a family is robbing the family.' });
  const fence = fenceFor(w, p);
  if (!e.data?.fence && fence) o.push({ code: 'fence', label: `Set it up with ${first(fence)} first`, hint: 'A fence who knows it’s coming pays better and faster.' });
  const men = menOf(w, e).map((m) => m.id), free = crewOf(w, p).filter((c) => !men.includes(c.id));
  if (men.length < 2) for (const c of free.slice(0, 3)) o.push({ code: 'man:' + c.id, label: `Bring ${c.name}`, hint: `${aptitude(c, 'hijack') > 0.55 ? 'Good at this.' : aptitude(c, 'hijack') > 0.35 ? 'He’ll do.' : 'Not his line.'} ${temper(c).volatility > 0.6 ? 'A hothead.' : temper(c).caution > 0.6 ? 'Steady.' : ''}`.trim() });
  o.push({ code: 'go', label: 'Thursday night: go', hint: 'Choose how when you get there.' }, { code: 'pass', label: 'Call it off', hint: 'Nothing lost but the time.' });
  return o;
}
function chances(w: World, e: Enc): Record<string, number> {
  const men = menOf(w, e), skill = men.length ? men.reduce((a, m) => a + aptitude(m, 'hijack'), 0) / men.length : 0;
  const out: Record<string, number> = {};
  if (flag(e, 'cased')) out.diner = 0.82;
  if (men.length) out.road = clamp(0.5 + skill * 0.35, 0.4, 0.8);
  if (flag(e, 'driver') === 1) out.giveup = 0.93;
  out.depot = clamp(0.32 + skill * 0.25 + men.length * 0.05, 0.25, 0.6);
  return out;
}
function momentOpts(w: World, e: Enc): EncOpt[] {
  const c = chances(w, e), o: EncOpt[] = [];
  if (c.diner) o.push({ code: 'diner', label: 'Take it while he eats', hint: `Quiet, the way you saw it done. ${odds(c.diner)}` });
  if (c.road) o.push({ code: 'road', label: 'Stop him on the road', hint: `Fast and loud, and he sees your faces. ${odds(c.road)}` });
  if (c.giveup) o.push({ code: 'giveup', label: 'The driver hands it over and reports a robbery', hint: `The safest there is. He takes his cut. ${odds(c.giveup)}` });
  o.push({ code: 'depot', label: 'The depot at night: the whole load and the one next to it', hint: `Half as much again, if it goes. ${odds(c.depot)}` });
  o.push({ code: 'pass', label: 'Walk away', hint: 'It doesn’t feel right.' });
  return o;
}
const fenceFor = (w: World, p: Character) => w.ops.filter((o) => o.kind === 'fencing' && o.state === 'running' && o.owner !== p.id).map((o) => w.chars[o.owner]).filter((c): c is Character => !!c?.alive && c.cash >= 600)
  .sort((a, b) => Number(b.familyId === p.familyId) - Number(a.familyId === p.familyId) || peek(b, p.id).trust - peek(a, p.id).trust || (a.id < b.id ? -1 : 1))[0];

export function scoreChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const giver = e.from ? w.chars[e.from] : undefined, b = w.biz[String(e.data?.biz ?? '')], what = String(e.data?.what ?? 'the truck');
  // (the encounter stays open and moves on: what was learned is added to it, and the choices are those the new state allows)
  const stay = (lines: string[], minutes: number, opts: EncOpt[] | null, data: Record<string, string | number> = {}) => { e.status = 'open'; e.data = { ...(e.data ?? {}), ...data }; e.opts = opts ?? prepOpts(w, p, e); e.lines.push(...lines); return { lines: [], minutes }; };
  if (code === 'pass') { e.status = 'done'; return { lines: [e.data?.stage === 'moment' ? 'You sit in the car and watch it go by. Some nights you just know.' : 'You let it go by. Somebody else will have it, or nobody will.'], minutes: 10 }; }
  if (e.data?.stage === 'tip') return stay([], 5, null, { stage: 'prep' });
  if (e.data?.stage === 'prep') {
    if (code === 'case') {
      // (casing it also shows whether anyone else is on the road: an escort makes it go sideways more often if he goes in blind)
      const escort = w.rng.chance(0.3);
      return stay([`You sit two hours in a parked car on Third Avenue. He stops at the diner at ten past eleven, leaves the engine running, and is inside twenty minutes.${escort ? ' A car follows the truck at a distance: somebody is minding it.' : ' Nobody follows him.'}`], 120, null, { cased: 1, escort: escort ? 1 : 0 });
    }
    if (code === 'driver') {
      const yes = e.data?.src === 'owes' ? w.rng.chance(0.75) : w.rng.chance(0.35);
      return stay([yes ? '“Fifteen percent,” the driver says, “and you tie me up so it looks right.” He’s in.' : 'The driver hears you out and says nothing at all. You don’t know who he’ll tell.'], 60, null, { driver: yes ? 1 : -1 });
    }
    if (code === 'whose') {
      const fam = b?.protection ? w.fam[b.protection.familyId] : undefined;
      const whose = !b?.protection ? 'none' : b.protection.familyId === p.familyId ? 'ours' : 'theirs';
      return stay([!fam ? `${b?.name ?? 'The store'} pays nobody. Nobody will come looking but the police.` : whose === 'ours' ? `${b!.name} pays our own family. Robbing it is robbing ${w.chars[b!.protection!.collectorId]?.name ?? 'one of ours'}.` : `${b!.name} pays the ${fam.name} family. They will want to know who did it.`], 30, null, { whose });
    }
    if (code === 'fence') { const f = fenceFor(w, p); return stay([f ? `${f.name} says he’ll take the lot at forty cents on the dollar, Friday morning, no questions.` : 'Nobody will commit before they see it.'], 40, null, { fence: f?.id ?? '' }); }
    if (code.startsWith('man:')) { const m = w.chars[code.slice(4)]; const men = [...menOf(w, e).map((x) => x.id), m.id]; return stay([`${first(m)} is in.`], 10, null, { men: men.join(',') }); }
    // (going is waiting for Thursday night: the time until then passes)
    if (code === 'go') { e.data = { ...(e.data ?? {}), stage: 'moment' }; e.expires = Math.max(e.expires, flag(e, 'at') + DAY); return stay([`Thursday night. ${menOf(w, e).length ? `${menOf(w, e).map(first).join(' and ')} in the car with you.` : 'You go alone.'}`], Math.max(30, flag(e, 'at') - w.now), momentOpts(w, e)); }
    e.opts = prepOpts(w, p, e); return { lines: [], minutes: 0 };
  }
  if (e.data?.stage === 'moment') {
    const c = chances(w, e)[code] ?? 0.3;
    // (sometimes it goes sideways: more likely blind, more likely at the depot, more likely with a car minding the truck)
    const side = clamp(0.18 + (flag(e, 'cased') ? -0.1 : 0.08) + (code === 'depot' ? 0.15 : 0) + (flag(e, 'escort') && !flag(e, 'cased') ? 0.15 : 0) - (code === 'giveup' ? 0.12 : 0), 0.04, 0.5);
    if (w.rng.chance(side)) return stay([`It starts the way it should. Then a patrol car turns into the street, slow, its spotlight on the shopfronts.`], 20, [
      { code: 'abort', label: 'Abort. Walk away now', hint: 'Nothing gained. Nobody caught.' },
      { code: 'push', label: 'Push on. Get it done before he’s level with you', hint: `All or nothing. ${odds(c * 0.6)}` },
      ...(menOf(w, e).length ? [{ code: 'improvise', label: `Let ${first(best(w, e))} handle the cop`, hint: `${temper(best(w, e)).volatility > 0.6 ? 'He’s a hothead.' : 'He keeps his head.'}` }] : []),
    ], { stage: 'side', how: code, p: Math.round(c * 100) });
    return finish(w, p, e, code, w.rng.chance(c), giver, b, what);
  }
  // sideways
  const how = String(e.data?.how ?? 'road'), c0 = flag(e, 'p') / 100;
  if (code === 'abort') { e.status = 'done'; return { lines: ['You leave it. The patrol car goes by, and so does the truck. Your heart doesn’t slow down until Canal Street.'], minutes: 20 }; }
  if (code === 'push') return finish(w, p, e, how, w.rng.chance(c0 * 0.6), giver, b, what, true);
  const m = best(w, e), hot = temper(m).volatility > 0.6;
  if (hot) {
    addFact(w, { kind: 'beating', actor: m.id, minor: false, hiddenActor: true, text: `${m.name} beat a patrolman who stumbled on a hijacking.`, textHidden: `A patrolman was beaten on Third Avenue.`, district: p.district }, { witnesses: [] });
    p.heat = clamp(p.heat + 0.5, 0, 1.5); m.heat = clamp(m.heat + 0.6, 0, 1.5);
    return finish(w, p, e, how, w.rng.chance(c0 * 0.8), giver, b, what, true, [`${first(m)} is out of the car before you can stop him. The patrolman goes down and doesn’t get up for a while. Every cop in the city will be looking for this truck.`]);
  }
  return finish(w, p, e, how, w.rng.chance(clamp(c0 + 0.1, 0, 0.95)), giver, b, what, false, [`${first(m)} walks over to the patrol car with a map, asks the way to the Belt Parkway, and keeps the cop busy for five long minutes.`]);
}
const best = (w: World, e: Enc) => menOf(w, e).sort((a, b) => aptitude(b, 'hijack') + temper(b).caution - aptitude(a, 'hijack') - temper(a).caution)[0];

// ------------------------------------------------------------ the after
function finish(w: World, p: Character, e: Enc, how: string, ok: boolean, giver: Character | undefined, b: Business | undefined, what: string, loud = false, pre: string[] = []) {
  e.status = 'done';
  const men = menOf(w, e), lines = [...pre];
  const heat = { diner: 0.12, giveup: 0.08, road: 0.3, depot: 0.4 }[how] ?? 0.3;
  p.heat = clamp(p.heat + heat + (loud ? 0.15 : 0), 0, 1.5);
  if (!ok) {
    const caught = w.rng.chance(how === 'depot' || loud ? 0.5 : 0.25);
    if (caught) { jail(w, p, w.rng.int(7, 25), `picked up near ${what} that never got where it was going`); for (const m of men) if (w.rng.chance(0.5)) jail(w, m, w.rng.int(7, 25)); }
    lines.push(caught ? 'It goes wrong all at once: a whistle, headlights, a hand on your collar. You’re in the back of a car before you can think.' : 'It goes wrong: the driver won’t stop, a dog, a light coming on. You get away with nothing but the shakes.');
    return { lines, minutes: 120 };
  }
  const value = Math.round(Number(e.data?.value ?? 2500) * (how === 'depot' ? 1.5 : 1) / 50) * 50;
  const f = addFact(w, { kind: 'theft', actor: p.id, victim: b?.ownerId, business: b?.id, amount: value, hiddenActor: true, text: `${p.name} took ${what} off the road.`, textHidden: `${what[0].toUpperCase() + what.slice(1)} was taken off the road${b ? `, bound for ${b.name}` : ''}.`, district: p.district }, { witnesses: [p.id, ...men.map((m) => m.id)] });
  if (b) notifyProtector(w, b, f);
  // (the driver's cut, if he was in on it; what he saw, if he wasn't, goes to the police with his statement)
  const fence = w.chars[String(e.data?.fence ?? '')];
  let cash = 0;
  if (fence?.alive) { cash = transfer(w, fence, p, Math.round(value * 0.4), 'earn', `${what}, fenced`); lines.push(`${first(fence)} takes the lot on Friday morning and counts out ${money(cash)}.`); }
  else { p.goods += value; lines.push(`It’s in a garage in Canarsie, worth ${money(value)} to somebody. You still have to move it.`); }
  if (flag(e, 'driver') === 1 && how === 'giveup' && giver?.alive) { const cut = transfer(w, p, giver, Math.round(Math.max(cash, value * 0.3) * 0.15), 'gift', 'the driver’s end'); lines.push(`The driver’s end, ${money(cut)}, goes through his cousin.`); }
  for (const m of men) { const cut = transfer(w, p, m, Math.round(Math.max(cash, value * 0.3) * 0.1), 'gift', 'his end of the truck'); feel(w, m, p.id, 'trust', 0.05); if (cut) lines.push(`${first(m)} gets his end: ${money(cut)}.`); }
  if (giver?.alive && e.data?.src === 'owes') { const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === giver.id); if (d) { writeDown(w, d, Math.round(value * 0.1)); lines.push(`What ${first(giver)} owes you comes down for the tip.`); } }
  if (how === 'road') addFact(w, { kind: 'report', actor: p.id, minor: true, hiddenActor: true, text: `The driver gave the police a description of the men who stopped him.`, textHidden: `The driver gave the police a description of the men who stopped him.`, district: p.district }, { witnesses: [] });
  repute(w, p, 1, 'good work');
  lines.unshift(how === 'giveup' ? 'The driver hands you the keys, and you tie him to the steering wheel the way he asked.' : how === 'diner' ? 'He’s halfway through his eggs when the truck pulls away from the kerb.' : how === 'road' ? 'You box him in at a light on Flatbush. He doesn’t argue with what’s in your hand.' : 'The depot’s night man is asleep. You take two trailers instead of one.');
  if (e.data?.whose === 'ours' && b?.protection) lines.push(`${b.name} pays our own family. Somebody is going to ask who robbed it.`);
  return { lines, minutes: 240 };
}
