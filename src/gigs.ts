import { hasPerk } from './specs';
// Opportunities: work that turns up because of what is going on around you, not because a list says it's time.
// Each one is tied to real people and real places (a shop owner, a truck going to a real address, a bookie's actual bag),
// and what you do about it changes how those people feel and what the families make of you.
import { bizMove } from './econ';
import { addFact, clamp, earn, money, notifyProtector, ownerBiz, rel, witnessesAt } from './core';
import { addFavour } from './encounters';
import { bump, jail, mkJob, paid } from './jobs';
import { Approach, Result } from './jobs';
import { Character, DAY, Id, Job, World } from './types';

export type GigKind = 'muscle' | 'shipment' | 'escort' | 'courier' | 'inspector';
export const GIG_LABEL: Record<GigKind, string> = { muscle: 'Muscle', shipment: 'A truck to hit', escort: 'Ride shotgun', courier: 'A bag to carry', inspector: 'Inspector problem' };
export const GIG_HELP: Record<GigKind, string> = {
  muscle: 'A man needs somebody big standing behind him while he asks for what he’s owed.',
  shipment: 'A delivery is coming to a shop. Take it, take a piece of it, or sell the warning to the people who protect the shop.',
  escort: 'Your own family’s shop has a delivery coming in. Ride along and make sure it arrives.',
  courier: 'A bookie’s weekly money needs to get from one place to another without anyone looking at it.',
  inspector: 'An inspector is making a shop owner’s life difficult. Pay him, or persuade him.',
};
const PL = (w: World) => w.chars[w.playerId!];
const first = (c: Character) => c.name.split(' ')[0];
const pick = <T,>(w: World, l: T[]): T => l[w.rng.int(0, l.length - 1)];
const gigOf = (j: Job) => String(j.extra?.gig ?? '') as GigKind;
export const isGig = (j: Job) => j.kind === 'gig';
const open = (w: World, g: GigKind) => w.jobs.some((j) => j.kind === 'gig' && gigOf(j) === g && (j.status === 'offered' || j.status === 'active'));
const GOODS: Record<string, string> = { bar: 'liquor', restaurant: 'meat and wine', deli: 'cured meat and cheese', grocer: 'produce and canned goods', butcher: 'sides of beef', fish: 'a morning’s catch', jeweller: 'a case of watches', pharmacy: 'prescription stock', hardware: 'power tools', garage: 'car parts', candy: 'cigarettes and candy', newsstand: 'cartons of cigarettes', cafe: 'coffee and pastries', bakery: 'flour and sugar' };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const when = (w: World, days: number) => WEEKDAY[Math.floor((w.now + days * DAY) / DAY + 4) % 7];

// ---------------------------------------------------------------- offers
export function gigOffer(w: World): boolean {
  const p = PL(w);
  const bag: (() => boolean)[] = [() => muscleGig(w, p), () => shipmentGig(w, p), () => escortGig(w, p), () => courierGig(w, p), () => inspectorGig(w, p)];
  for (let i = 0; i < 6 && bag.length; i++) if (bag.splice(w.rng.int(0, bag.length - 1), 1)[0]()) return true;
  return false;
}
// The world throws these up on its own. They are there whether or not you go looking.
export function gigTick(w: World) {
  const p = PL(w);
  if (!p?.alive || !p.familyId) return;
  const offered = w.jobs.filter((j) => j.kind === 'gig' && j.status === 'offered').length;
  if (offered >= 2) return;
  if (w.rng.chance(w.chars[w.playerId!] && hasPerk(w, w.chars[w.playerId!], 'operator') ? 0.32 : 0.2)) gigOffer(w);
}

function nearby(w: World, p: Character, c: Character) { return c.alive && c.id !== p.id && !c.isPlayer; }

function muscleGig(w: World, p: Character): boolean {
  if (open(w, 'muscle')) return false;
  const marks = Object.values(w.debts).filter((d) => d.status === 'active' && d.missed >= 1 && d.creditor !== p.id && d.debtor !== p.id && nearby(w, p, w.chars[d.debtor]) && w.chars[d.creditor]?.alive);
  const pool = marks.length ? marks.map((d) => ({ giver: w.chars[d.creditor], target: w.chars[d.debtor], owed: d.balance, kind: 'debt' })) : [];
  if (!pool.length) {
    // no real debt on the books: a shop owner with a customer who won't settle his tab
    const shops = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && w.chars[b.ownerId]?.alive && b.ownerId !== p.id);
    const civs = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.isPlayer);
    if (!shops.length || !civs.length) return false;
    const b = pick(w, shops);
    const t = pick(w, civs.filter((c) => c.id !== b.ownerId));
    if (!t) return false;
    pool.push({ giver: w.chars[b.ownerId], target: t, owed: w.rng.int(3, 9) * 100, kind: 'tab' });
  }
  const x = pick(w, pool);
  const pay = Math.max(150, Math.min(450, Math.round(x.owed * 0.25 / 25) * 25));
  mkJob(w, {
    kind: 'gig', title: `${first(x.giver)} needs somebody to stand behind him`, giver: x.giver.id, via: 'opportunity', assignee: p.id, target: x.target.id, pay, days: 5,
    brief: `${x.giver.name} is owed ${money(x.owed)} by ${x.target.name}${x.kind === 'tab' ? `, who has stopped coming up with excuses and started avoiding him` : `, and the man is dodging`}. ${first(x.giver)} would like a big, quiet man standing behind him when he asks one more time. It pays ${money(pay)}.`,
    extra: { gig: 'muscle', owed: x.owed },
  });
  return true;
}

function deliveryShops(w: World) {
  return Object.values(w.biz).filter((b) => b.open && GOODS[b.kind] && w.chars[b.ownerId]?.alive && b.income >= 450);
}
function shipmentGig(w: World, p: Character): boolean {
  if (open(w, 'shipment')) return false;
  const shops = deliveryShops(w).filter((b) => b.protection?.familyId !== p.familyId && b.ownerId !== p.id);
  if (!shops.length) return false;
  const b = pick(w, shops);
  const o = w.chars[b.ownerId];
  const goods = GOODS[b.kind];
  const value = Math.round((b.income * w.rng.range(1.2, 2.4)) / 50) * 50;
  const fam = b.protection ? w.fam[b.protection.familyId].name : '';
  const tip = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.isPlayer && c.id !== o.id && c.district === b.district);
  const src = tip.length ? pick(w, tip) : undefined;
  mkJob(w, {
    kind: 'gig', title: `A truck of ${goods} is due at ${b.name}`, giver: src?.id ?? null, via: 'tip', assignee: p.id, biz: b.id, pay: Math.round(value * 0.6), days: 5,
    brief: `${src ? src.name + ' drives for the supplier and says' : 'Word is'} a truck with about ${money(value)} of ${goods} goes to ${b.name} in ${b.district} on ${when(w, 3)} night, one driver, no escort. ${fam ? `${b.name} pays the ${fam} family, and they will want to know who touched it.` : `${b.name} pays nobody, so nobody will come looking out of duty.`} You can take it, take a little of it quietly, or sell the warning.`,
    extra: { gig: 'shipment', value },
  });
  return true;
}
function escortGig(w: World, p: Character): boolean {
  if (open(w, 'escort')) return false;
  const shops = deliveryShops(w).filter((b) => b.protection?.familyId === p.familyId);
  if (!shops.length) return false;
  const b = pick(w, shops);
  const o = w.chars[b.ownerId];
  const goods = GOODS[b.kind];
  const col = w.chars[b.protection!.collectorId];
  const pay = Math.round(w.rng.int(180, 360) / 10) * 10;
  mkJob(w, {
    kind: 'gig', title: `Ride shotgun for ${b.name}’s delivery`, giver: col?.alive ? col.id : o.id, via: 'opportunity', assignee: p.id, biz: b.id, pay, days: 4,
    brief: `${b.name} pays your family, and ${o.name} has a truck of ${goods} coming in on ${when(w, 2)} night. Word is someone from outside has been watching the route. ${col?.alive ? col.name + ' would' : o.name + ' would'} like a man in the cab. It pays ${money(pay)}.`,
    extra: { gig: 'escort' },
  });
  return true;
}
function courierGig(w: World, p: Character): boolean {
  if (open(w, 'courier')) return false;
  const books = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.hustle && (c.hustle.kind === 'numbers' || c.hustle.kind === 'bookie') && c.familyId === p.familyId && c.hustle.gross > 200);
  if (!books.length) return false;
  const bk = pick(w, books);
  const bag = Math.round(Math.min(2400, Math.max(500, bk.hustle!.gross * 0.8)) / 50) * 50;
  const pay = Math.round(bag * 0.08 / 10) * 10;
  mkJob(w, {
    kind: 'gig', title: `${first(bk)} has a bag that needs to move`, giver: bk.id, via: 'opportunity', assignee: p.id, pay, days: 4,
    brief: `${bk.name} has about ${money(bag)} from the week’s book that has to get to the family by morning, and he’d rather not carry it himself. It pays ${money(pay)} to deliver it. Whoever carries it could also be tempted. ${first(bk)} counts it twice.`,
    extra: { gig: 'courier', bag },
  });
  return true;
}
function inspectorGig(w: World, p: Character): boolean {
  if (open(w, 'inspector')) return false;
  const shops = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && b.income >= 500 && w.chars[b.ownerId]?.alive && b.ownerId !== p.id && (b.protection?.collectorId === p.id || b.protection?.familyId === p.familyId));
  if (!shops.length) return false;
  const b = pick(w, shops);
  const o = w.chars[b.ownerId];
  const amt = Math.round(w.rng.int(150, 320) / 10) * 10;
  mkJob(w, {
    kind: 'gig', title: `${first(o)} has an inspector on him`, giver: o.id, via: 'opportunity', assignee: p.id, biz: b.id, pay: 0, days: 5,
    brief: `A city inspector has found something wrong at ${b.name} and is hinting what it would cost to unfind it. ${o.name} pays the family for exactly this kind of trouble. A ${money(amt)} envelope to the right man would end it, or a conversation might.`,
    extra: { gig: 'inspector', amt },
  });
  return true;
}

// ---------------------------------------------------------------- the choices
export function gigApproaches(w: World, j: Job): Approach[] {
  switch (gigOf(j)) {
    case 'muscle': return [
      { code: 'stand', label: 'Stand behind him and say nothing', hint: 'Low risk. Most men pay when they see who’s listening.' },
      { code: 'lean', label: 'Lean on the man yourself', hint: 'Bigger fee. He may get hurt, and he’ll remember your face.' },
    ];
    case 'shipment': return [
      { code: 'hijack', label: 'Take the whole truck', hint: 'The big money. The family that protects the shop will want to know who did it.' },
      { code: 'skim', label: 'Take a little off the back, quietly', hint: 'Smaller, safer, harder to trace.' },
      { code: 'warn', label: 'Sell the warning to whoever protects it', hint: 'Safe and small. They owe you; the thieves, if there are any, won’t.' },
    ];
    case 'escort': return [
      { code: 'ride', label: 'Ride in the cab', hint: 'If someone tries it, you’re the one they meet.' },
      { code: 'scout', label: 'Drive the route ahead and watch', hint: 'Lower risk, smaller thanks.' },
    ];
    case 'courier': return [
      { code: 'straight', label: 'Take it straight there', hint: 'The honest way. The fee, and a bookie who trusts you.' },
      { code: 'cab', label: 'Switch cabs twice', hint: 'Slower and safer if the law is watching.' },
      { code: 'dip', label: 'Take a tenth off the top', hint: 'Easy money. He counts it twice, and he’ll know.' },
    ];
    case 'inspector': return [
      { code: 'bribe', label: `Pay him ${money(Number(j.extra?.amt ?? 200))} from your own pocket`, hint: 'Clean, and the owner owes you.' },
      { code: 'lean', label: 'Have a word with the inspector', hint: 'Free if it works. If it doesn’t, he writes a report.' },
    ];
    default: return [{ code: 'go', label: 'Get on it', hint: '' }];
  }
}

export function gigResolve(w: World, j: Job, doer: Character, code: string): Result {
  const rng = w.rng;
  const p = PL(w);
  const giver = j.giver ? w.chars[j.giver] : undefined;
  const b = j.biz ? w.biz[j.biz] : undefined;
  const o = b ? w.chars[b.ownerId] : undefined;
  const lines: string[] = [];
  let minutes = rng.int(90, 220), ok = false, gained = 0, note: string | undefined;
  const res = (): Result => ({ lines, minutes, ok, money: gained || undefined, note });
  const caution = doer.traits.caution, courage = doer.traits.courage, violence = doer.traits.violence;
  switch (gigOf(j)) {
    case 'muscle': {
      const t = w.chars[j.target!];
      if (!giver?.alive || !t?.alive) { lines.push('The man you were meant to stand behind, or the man he was asking, is gone.'); return res(); }
      doer.district = t.district;
      const lean = code === 'lean';
      const pr = clamp(0.62 + (lean ? 0.15 : 0) + (violence - 0.5) * 0.3 - rel(t, doer.id).respect * 0.1, 0.35, 0.92);
      const owed = Number(j.extra?.owed ?? 400);
      if (rng.chance(pr)) {
        const pay = Math.round((lean ? j.pay * 1.4 : j.pay) / 10) * 10;
        const settle = Math.min(owed, Math.max(0, t.cash));
        t.cash -= settle; giver.cash += settle;
        gained = paid(w, doer, pay, giver, 'handle');
        ok = true;
        lines.push(lean ? `${t.name} sees who’s come with ${first(giver)} and finds ${money(settle)} in his pocket he’d forgotten about.` : `You don’t say a word. ${t.name} looks at you, looks at ${first(giver)}, and pays ${money(settle)} on the spot.`);
        lines.push(`${giver.name} pays you ${money(gained)}.`);
        rel(giver, doer.id).trust = clamp(rel(giver, doer.id).trust + 0.08);
        if (lean && rng.chance(0.4 + violence * 0.3)) {
          addFact(w, { kind: 'beating', actor: doer.id, victim: t.id, hiddenActor: true, text: `${doer.name} roughed up ${t.name}.`, textHidden: `${t.name} was roughed up outside his own door.`, district: t.district }, { witnesses: witnessesAt(w, t.district, [doer.id, t.id], 2) });
          bump(doer, 0.08); rel(t, doer.id).grudge = clamp(rel(t, doer.id).grudge + 0.25);
          lines.push(`It got rougher than it needed to. ${first(t)} will remember.`);
        }
      } else {
        bump(doer, 0.06);
        lines.push(`${t.name} refuses and says things about ${first(giver)}’s mother. ${lean ? 'You don’t take it further than you were paid to.' : 'You were told to say nothing, so you say nothing, and leave.'}`);
        rel(giver, doer.id).trust = clamp(rel(giver, doer.id).trust - 0.04);
      }
      return res();
    }
    case 'shipment': {
      if (!b || !o) { lines.push('The shop has closed. There’s no truck.'); return res(); }
      doer.district = b.district;
      const value = Number(j.extra?.value ?? 800);
      const prot = b.protection ? w.chars[b.protection.collectorId] : undefined;
      if (code === 'warn') {
        const who = prot?.alive ? prot : o;
        const fee = Math.min(Math.max(0, Math.round(value * 0.12 / 10) * 10), Math.round(Math.max(0, who.cash + b.cash)));
        gained = paid(w, doer, Math.max(100, fee), who, 'handle');
        ok = true;
        addFavour(w, doer.id, who.id, 1, `warning about the truck headed for ${b.name}`);
        rel(who, doer.id).trust = clamp(rel(who, doer.id).trust + 0.1); rel(o, doer.id).trust = clamp(rel(o, doer.id).trust + 0.06);
        lines.push(`${who.name} listens without interrupting. "Nobody tells me anything for free. You did." He pays you ${money(gained)}.`);
        if (j.giver && w.chars[j.giver]) rel(w.chars[j.giver]!, doer.id).trust = clamp(rel(w.chars[j.giver]!, doer.id).trust - 0.02);
        note = `Sold the warning about the ${b.name} truck.`;
        return res();
      }
      const hijack = code === 'hijack';
      const guarded = b.guardedUntil !== undefined && b.guardedUntil > w.now;
      const risk = clamp((hijack ? 0.38 : 0.16) + (guarded ? 0.2 : 0) + (0.5 - caution) * 0.2 + (0.4 - courage) * 0.1, 0.06, 0.8);
      if (rng.chance(risk)) {
        bump(doer, hijack ? 0.3 : 0.12);
        lines.push(hijack ? 'The driver doesn’t stop. A second car is behind him that nobody mentioned. You get out of there with a bruised shoulder and nothing in your hands.' : 'A watchman who wasn’t on the list comes round the corner with a flashlight. You walk away like you meant to.');
        if (hijack && rng.chance(0.3)) { jail(w, doer, rng.int(4, 18)); lines.push('The police are quicker than you hoped. You’re arrested.'); note = `${doer.name} was arrested.`; }
        return res();
      }
      const take = Math.round((hijack ? value : value * 0.25) * 0.6 / 10) * 10;
      gained = paid(w, doer, take, undefined, hijack ? 'hijack' : 'boost');
      ok = true;
      bump(doer, hijack ? 0.25 : 0.08);
      const f = addFact(w, { kind: 'robbery', actor: doer.id, victim: o.id, business: b.id, amount: take, hiddenActor: true, text: `${doer.name} hijacked the ${GOODS[b.kind]} headed for ${b.name}.`, textHidden: `A truck of ${GOODS[b.kind]} headed for ${b.name} was hijacked.`, district: b.district }, { witnesses: witnessesAt(w, b.district, [doer.id, o.id], 2).filter(() => rng.chance(hijack ? 0.5 : 0.2)) });
      notifyProtector(w, b, f);
      lines.push(hijack ? `It goes the way the tip said it would. You take the truck, the fence takes a cut, and ${money(gained)} lands in your hand.` : `You take a few cases off the back while the driver’s inside. The fence gives you ${money(gained)}.`);
      if (b.protection && b.protection.familyId !== doer.familyId) lines.push(`${b.name} pays the ${w.fam[b.protection.familyId].name} family. If they find out, they’ll take it as a personal insult.`);
      if (j.giver && w.chars[j.giver]) { const cut = Math.round(gained * 0.1); if (cut > 0 && p.cash >= cut) { p.cash -= cut; w.chars[j.giver]!.cash += cut; lines.push(`You give ${first(w.chars[j.giver]!)} his ${money(cut)} for the tip.`); } }
      return res();
    }
    case 'escort': {
      if (!b || !o) { lines.push('The shop has closed. There’s nothing to escort.'); return res(); }
      doer.district = b.district;
      const attacked = rng.chance(code === 'scout' ? 0.2 : 0.3);
      const col = giver?.alive ? giver : o;
      if (!attacked) {
        gained = paid(w, doer, j.pay, col, 'handle'); ok = true;
        lines.push(`Nothing happens, which is how it’s supposed to go. The truck backs in, ${o.name} signs, and ${first(col)} pays you ${money(gained)}.`);
        rel(col, doer.id).trust = clamp(rel(col, doer.id).trust + 0.05); rel(o, doer.id).trust = clamp(rel(o, doer.id).trust + 0.05);
      } else {
        const win = rng.chance(clamp(0.55 + (violence - 0.5) * 0.3 + (courage - 0.5) * 0.3 + (code === 'ride' ? 0.1 : -0.05), 0.2, 0.9));
        bump(doer, 0.15);
        if (win) {
          gained = paid(w, doer, Math.round(j.pay * 1.5 / 10) * 10, col, 'handle'); ok = true;
          p.standing = clamp(p.standing + 2, 0, 100);
          lines.push(`Somebody tries to stop the truck at the corner of ${b.district}. They didn’t expect a man in the cab. They leave faster than they came, and ${first(col)} pays you ${money(gained)} plus a bonus.`);
          addFact(w, { kind: 'report', actor: doer.id, minor: true, text: `${doer.name} drove off a hijack attempt on the ${b.name} truck.`, district: b.district }, { witnesses: [p.id] });
        } else {
          doer.hurtUntil = w.now + 2 * DAY;
          lines.push('Two men and a car across the road. You hold them off long enough for the driver to get away, and not long enough to avoid a beating. The truck is safe. You’re laid up for a couple of days.');
          rel(col, doer.id).respect = clamp(rel(col, doer.id).respect + 0.03);
          gained = paid(w, doer, Math.round(j.pay * 0.5 / 10) * 10, col, 'handle');
          ok = true;
        }
      }
      return res();
    }
    case 'courier': {
      const bk = giver;
      if (!bk?.alive) { lines.push('The man with the bag is gone.'); return res(); }
      const bag = Number(j.extra?.bag ?? 800);
      minutes = rng.int(120, 240);
      const stopped = rng.chance(clamp((code === 'cab' ? 0.05 : 0.12) + (0.5 - caution) * 0.1 + doer.heat * 0.3, 0.02, 0.5));
      if (stopped) {
        bump(doer, 0.15);
        lines.push('A patrol car sits behind your cab for six blocks. Nothing happens, but you’re shaking when you get out, and you were late. The bag arrives. The fee is cut.');
        gained = paid(w, doer, Math.round(j.pay / 2 / 10) * 10, bk, 'handle'); ok = true;
        return res();
      }
      let dip = 0;
      if (code === 'dip') dip = Math.round(bag * 0.1 / 10) * 10;
      gained = paid(w, doer, j.pay, bk, 'handle');
      ok = true;
      lines.push(`The bag gets where it’s going. ${bk.name} pays you ${money(gained)}.`);
      if (dip) {
        earn(doer, dip, 'side');
        const caught = rng.chance(0.45 + bk.traits.caution * 0.35);
        lines.push(`You keep ${money(dip)}.`);
        if (caught) {
          rel(bk, doer.id).trust = clamp(rel(bk, doer.id).trust - 0.3); rel(bk, doer.id).grudge = clamp(rel(bk, doer.id).grudge + 0.2); rel(bk, doer.id).respect = clamp(rel(bk, doer.id).respect - 0.15);
          addFact(w, { kind: 'theft', actor: doer.id, victim: bk.id, amount: dip, hiddenActor: false, text: `${doer.name} came up ${money(dip)} short on a bag he carried for ${bk.name}.`, district: bk.district }, { witnesses: [bk.id] });
          lines.push(`${first(bk)} counted twice. He knows exactly how much. He doesn’t say a word, which is worse.`);
        } else lines.push(`${first(bk)} counts it once and nods. You got away with it, this time.`);
      } else rel(bk, doer.id).trust = clamp(rel(bk, doer.id).trust + 0.06);
      return res();
    }
    case 'inspector': {
      if (!b || !o) { lines.push('The shop has closed. The inspector has nothing to inspect.'); return res(); }
      doer.district = b.district;
      const amt = Number(j.extra?.amt ?? 200);
      if (code === 'bribe') {
        if (p.cash < amt) { lines.push(`You haven’t got ${money(amt)} on you.`); return res(); }
        p.cash -= amt; ok = true;
        b.distress = Math.max(0, b.distress - 1);
        addFavour(w, doer.id, o.id, 2, `making the inspector at ${b.name} go away`);
        rel(o, doer.id).trust = clamp(rel(o, doer.id).trust + 0.12); rel(o, doer.id).affection = clamp(rel(o, doer.id).affection + 0.06);
        lines.push(`You put an envelope in the inspector’s coat on the way out of ${b.name}. His report is lost. ${o.name} stands a little straighter. "I won’t forget that."`);
        note = `Made the inspector at ${b.name} go away.`;
      } else {
        const pr = clamp(0.45 + (doer.traits.sociability - 0.5) * 0.4 + (violence - 0.5) * 0.2 + p.standing / 400, 0.2, 0.85);
        if (rng.chance(pr)) {
          ok = true; b.distress = Math.max(0, b.distress - 1);
          rel(o, doer.id).trust = clamp(rel(o, doer.id).trust + 0.1);
          lines.push(`You find the inspector at lunch and mention that ${o.name} is a friend of some friends. He remembers an urgent call. ${first(o)} owes you a good word.`);
          addFavour(w, doer.id, o.id, 1, `a word with the inspector at ${b.name}`);
        } else {
          bump(doer, 0.05); bizMove(w, b, -Math.min(200, Math.max(0, b.cash)), 'fine');
          lines.push(`The inspector writes down your name. ${b.name} gets fined ${money(200)} and ${first(o)} doesn’t look at you when he says thank you.`);
          rel(o, doer.id).trust = clamp(rel(o, doer.id).trust - 0.03);
        }
      }
      return res();
    }
  }
  return res();
}

export function gigStale(w: World, j: Job): string | null {
  if (j.kind !== 'gig') return null;
  const b = j.biz ? w.biz[j.biz] : undefined;
  const g = gigOf(j);
  const p = PL(w);
  if ((g === 'shipment') && b?.protection?.familyId === p.familyId && b.protection.collectorId === p.id) return `${b.name} is yours now. You wouldn’t rob your own shop.`;
  if (g === 'inspector' && b && b.distress === 0 && b.damaged === 0 && j.status === 'offered' && w.now - j.created > 3 * DAY) return 'It was sorted without you.';
  if (g === 'courier' && j.giver && !w.chars[j.giver]?.hustle) return 'He’s not running the book any more.';
  void ownerBiz; void ({} as Id);
  return null;
}
