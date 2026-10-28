import { intentDay } from './intent';
import { successionWeek } from './succession';
import { workWeek } from './work';
import { mattersWeek } from './matters';
import { pulseWeek } from './pulse';
import { careerTick, openSeatFor, promoTick } from './career';
import { agencyDay, agencyWeek, goalAsks } from './goals';
goalAsks(); // V89: the asks NPC plans make (join), registered once every module has loaded
import { sitDay, sitWeek } from './situ';
import { friendsTell } from './sitmoves';
import { pathTick, turfWeek } from './path';
import { rankWeek } from './powers2';
import { situationTick } from './situations';
import { peopleWeek, rollSkills } from './people';
import { chooseAction, perform } from './actions';
import { accrueVig, addFact, clamp, earn, easeOn, famName, feelingsWeek, isAwake, learn, money, nextWake, notifyProtector, ownerBiz, payDebt, schedule, shortTime, witnessesAt } from './core';
import { BASE_RATE, emptyBooks, settleWeek } from './books';
import { addStake, bizMove, businessWeek, seizeShare } from './econ';
import { daily, ventureWeek } from './jobs';
import { pendingTick, purge } from './consequences';
import { memoTick } from './memos';
import { socialDay } from './conv/tick';
import './conv/pursuits'; // (Gate 2b: registers pursuits, and where they start, on the tick)
import './conv/deciders'; // (Gate 2b: the conversation layer's decisions for the world's asks, in worlds that run it)
import './conv/daily'; // (Gate 2b: and for what NPCs do with their days)
import { encounterTick, eventTick } from './encounters';
import { enterpriseWeek, opsDaily } from './rackets';
import { commissionTick, politicsCoup, politicsWeek } from './politics';
import { lifeDaily, christeningDue } from './life';
import { ambitionTick } from './ambition';
import { reportTick } from './reports';
import { disputeScan, disputeTick } from './disputes';
import { reconcile } from './consistency';
import { orgWeek } from './orgs';
import { dangerTick } from './danger';
import { summonsTick } from './meetings';
import { Rng } from './rng';
import { addShops } from './world';
import { paperTick } from './news';
import { crewTick, lapsedAsks } from './crewlife';
import { DAY, Fact, Id, OpKind, WEEK, World, SCHEMA } from './types';

// ------------------------------------------------------------------ the loop

export function advance(w: World, until: number) {
  while (w.queue.length && w.queue[0].t <= until) {
    const ev = w.queue.shift()!;
    w.now = ev.t;
    if (ev.kind === 'weekly') {
      weekly(w);
      sweep(w);
      repairAll(w);
      ventureWeek(w);
      politicsWeek(w);
      schedule(w, w.now + WEEK, 'weekly');
    } else if (ev.kind === 'daily') {
      daily(w);
      sitDay(w);
      agencyDay(w); // V89: NPC plans move on the day they fall due
      intentDay(w); // Stage 5: men go and see each other for their own reasons (intent.ts)
      summonsTick(w);
      memoTick(w);
      pendingTick(w);
      socialDay(w); // Gate 2a: the conversation layer's requests and obligations (conv/tick.ts); nothing without its records
      encounterTick(w);
      eventTick(w);
      dangerTick(w);
      opsDaily(w);
      promoTick(w);
      pathTick(w);
      politicsCoup(w);
      commissionTick(w);
      lifeDaily(w);
      { const pl = w.playerId ? w.chars[w.playerId] : undefined; if (pl?.alive) { christeningDue(w, pl); if (pl.jailedUntil <= w.now) dayJobWeek(w, pl); } }
      ambitionTick(w);
      reconcile(w);
      disputeScan(w);
      disputeTick(w);
      schedule(w, w.now + DAY, 'daily');
    } else think(w, ev.who!);
    insideTick(w); // (the player picked up, or walking out: his time inside is an account, opened and closed here, however it began)
  }
  w.now = Math.max(w.now, until);
  insideTick(w);
}

function think(w: World, id: string) {
  const c = w.chars[id];
  if (!c || !c.alive || c.isPlayer) return;
  if (c.jailedUntil > w.now) return void schedule(w, c.jailedUntil + w.rng.int(10, 120), 'think', id);
  if (!isAwake(c, w.now)) return void schedule(w, nextWake(c, w.now) + w.rng.int(0, 90), 'think', id);
  const r = perform(w, chooseAction(w, c));
  schedule(w, w.now + r.minutes + w.rng.int(15, 90), 'think', id);
}

// ------------------------------------------------------------ weekly economy

export const LIVING: Record<string, number> = { civilian: 70, associate: 100, soldier: 170, capo: 330, underboss: 520, boss: 900 };

function weekly(w: World) {
  const rng = w.rng;
  paperTick(w);
  lapsedAsks(w);
  crewTick(w);
  { const pl = w.playerId ? w.chars[w.playerId] : undefined; if (pl) { (w.snaps ??= []).push({ t: w.now, cash: pl.cash, standing: pl.standing, heat: pl.heat, rank: pl.rank, kids: w.life?.kin.filter((k) => k.role === 'son' || k.role === 'daughter').length ?? 0 }); if (w.snaps.length > 6) w.snaps.shift(); } }
  // a hunt runs out, or ends when the man it was for is gone
  for (const fam of Object.values(w.fam)) if (fam.hunt && (!w.chars[fam.hunt.target]?.alive || w.now - fam.hunt.since > (60 + fam.hunt.sev * 15) * DAY)) delete fam.hunt;

  // random crime: someone robs a shop
  const thieves = Object.values(w.chars).filter((c) => c.alive && (c.rank === 'associate' || c.rank === 'soldier') && c.jailedUntil <= w.now);
  for (const b of Object.values(w.biz)) {
    if (!b.open || b.kind === 'casino' || !thieves.length || (b.guardedUntil ?? 0) > w.now || !rng.chance(b.protection ? 0.01 : 0.04)) continue;
    const t = rng.pick(thieves);
    const o = w.chars[b.ownerId];
    if (!o || t.id === o.id || (t.familyId && b.protection?.familyId === t.familyId)) continue;
    const amt = rng.int(150, 450);
    bizMove(w, b, -amt, 'theft', t.id);
    earn(t, amt, 'scheme');
    t.heat = clamp(t.heat + 0.1, 0, 1.5);
    const wit = witnessesAt(w, b.district, [t.id, o.id], 2).filter(() => rng.chance(0.4));
    const f = addFact(w, { kind: 'robbery', actor: t.id, victim: o.id, business: b.id, amount: amt, hiddenActor: true, text: `${t.name} robbed ${b.name} of ${money(amt)}.`, textHidden: `${b.name} was robbed of ${money(amt)}.`, district: b.district }, { witnesses: wit });
    notifyProtector(w, b, f);
  }

  // business accounting: revenue, costs, the protection fee, other people's shares, the owner's draw (econ.ts)
  businessWeek(w);

  // the former protector hears he's been cut out
  for (const b of Object.values(w.biz)) {
    if (!b.informPrev) continue;
    const f: Fact | undefined = w.facts[b.informPrev.fact];
    if (f) learn(w, b.informPrev.who, f, b.ownerId, true);
    delete b.informPrev;
  }

  // debts fall due
  for (const d of w.debts) {
    if (d.status !== 'active' || d.nextDue > w.now) continue;
    const debtor = w.chars[d.debtor];
    const cred = w.chars[d.creditor];
    if (!debtor.alive || !cred.alive) {
      d.status = 'void';
      continue;
    }
    accrueVig(d); // (the week's vig falls due on the principal still out: core.accrueVig)
    const pay = Math.min(d.weeklyPayment, d.balance);
    const b = ownerBiz(w, debtor.id);
    const avail = debtor.cash + (b ? Math.max(0, b.cash - 100) : 0);
    if (avail >= pay) payDebt(w, d, pay);
    else {
      d.missed++;
      addFact(w, { kind: 'debt_missed', actor: debtor.id, victim: cred.id, amount: pay, text: `${debtor.name} missed a ${money(pay)} payment to ${cred.name}.`, minor: d.missed > 1, cause: d.cause, district: debtor.district });
      if (d.missed >= 4) {
        d.status = 'defaulted';
        // (a matter about this debt is looked at again now, not on whatever later day it was next due: it ends with the debt)
        for (const sx of w.situations ?? []) if (sx.link?.debt === d.id && (sx.next ?? 0) > w.now) sx.next = w.now;
        addFact(w, { kind: 'debt_default', actor: debtor.id, victim: cred.id, amount: d.balance, text: `${debtor.name} defaulted on ${money(d.balance)} owed to ${cred.name}.`, cause: d.cause, district: debtor.district });
        seizeShare(w, d);
      }
    }
    d.nextDue += WEEK;
  }

  enterpriseWeek(w); // (Stage 4: everyone's enterprises, one pass: rackets.ts)
  workWeek(w); // (Stage 4: superiors hand out what needs doing: work.ts)
  turfWeek(w);
  orgWeek(w);
  rankWeek(w);
  reportTick(w);
  situationTick(w);
  sitWeek(w);
  mattersWeek(w);
  hearingWeek(w); // (The Family: a charge brought to the player to find out and decide: hearing.ts)
  chargeWeek(w); // (the boss's charge to his underboss: charge.ts)
  // V89: bad feeling between families cools when nothing feeds it (it used to only ever rise; docs/V89_HEALTH.md). A tenth a week
  // above a floor of quiet suspicion, so old wars are remembered but a quiet month is felt.
  for (const f of Object.values(w.fam)) for (const k of Object.keys(f.tension)) if (f.tension[k] > 1) f.tension[k] = Math.round((1 + (f.tension[k] - 1) * 0.9) * 100) / 100;
  friendsTell(w);
  pulseWeek(w);
  // Bosses revise the size of their families now and then: a family at war wants soldiers, a rich one wants more earners.
  for (const fam of Object.values(w.fam)) {
    const b = w.chars[fam.bossId];
    if (!b?.alive || b.isPlayer) continue;
    const tens = Object.values(fam.tension).reduce((a, x) => a + x, 0);
    if (rng.chance(0.004 + Math.min(0.02, tens * 0.003))) {
      const r = rng.chance(0.8) ? 'soldier' : 'capo';
      openSeatFor(w, fam.id, r);
    }
  }

  // wages and living costs
  for (const c of Object.values(w.chars)) {
    if (!c.alive) continue;
    c.cash = Math.max(0, c.cash + c.wage - LIVING[c.rank]);
    // Lifestyle: money that is not working gets spent on clothes, cars, rent and friends.
    const floor = { civilian: 3000, associate: 3000, soldier: 5000, capo: 8000, underboss: 15000, boss: 25000 }[c.rank] ?? 3000;
    const lux = Math.round(Math.max(0, c.cash - floor) * (c.rank === 'boss' || c.rank === 'underboss' ? 0.1 : c.rank === 'capo' ? 0.08 : 0.06));
    c.cash -= lux;
    c.books.expenses += LIVING[c.rank] + lux;
  }

  // (Stage 4: the player's random weekly "obligations" are gone. What the life asks of him is what it asks of every made man: dues to
  // the family fund (orgs.treasuryWeek), which pays for lawyers (matters.ts), men inside, and debts it clears for men it trusts.)

  // kick-ups: everyone declares, passes a share up, and superiors compare notes (see books.ts)
  peopleWeek(w);
  settleWeek(w);
  successionWeek(w); // (The Family: the line and the books, the recognised successor)
  careerTick(w);
  agencyWeek(w);
  purge(w);

  // police heat, arrests, promotions
  for (const c of Object.values(w.chars)) {
    if (!c.alive) continue;
    feelingsWeek(w, c);
    // (the player's arrest odds rise from nothing at the line, and his time inside scales with how hot he was, a week to a month;
    // a stopgap until the police are a faction with cases of their own, docs/rpg/SCOPE.md 1.8. Everyone else as before.)
    if (c.heat > 0.45 && rng.chance(c.isPlayer ? Math.min(0.85, (c.heat - 0.45) * 1.2) : c.heat * 0.5)) {
      c.jailedUntil = w.now + (c.isPlayer ? Math.round(5 + Math.min(1, (c.heat - 0.45) / 0.6) * 25 + rng.int(-2, 2)) : rng.int(5, 40)) * DAY;
      if (c.isPlayer) pickedUp(w, c, heatWhy(w, c)); // (why, said while the heat is still on him)
      c.heat = 0.1;
      c.cash -= Math.min(Math.round(c.cash * 0.15), 500); // lawyers
      const kin = Object.values(w.chars).filter((x) => x.alive && x.familyId && x.familyId === c.familyId).map((x) => x.id);
      addFact(w, { kind: 'arrest', actor: c.id, text: `${c.name} was arrested.`, district: c.district }, { broadcast: kin });
    } else c.heat = Math.max(0, c.heat - 0.08);
  }
}

// ---------------------------------------------------------- saves and reports

export function serialize(w: World): string {
  return JSON.stringify({ ...w, schema: SCHEMA, rng: w.rng.state });
}
export { SCHEMA };
import { ensureClubs } from './clubdata';
import { heatWhy, insideTick, pickedUp } from './inside';
import { dayJobWeek } from './orders';
import { sweep } from './retain';
import { repairAll } from './rank';
import { ensureShape } from './world';
import { hearingWeek } from './hearing';
import { chargeWeek } from './charge';
export function deserialize(s: string): World {
  const o = JSON.parse(s);
  const rng = new Rng(0);
  rng.state = o.rng;
  const w = { ...o, rng } as World;
  ensureShape(w);
  // V89 repair: men recruited from civilian life before the fix kept a civilian's 0% share. No rate in the game goes below 5%,
  // so a man in the life on exactly nothing is one of them: he goes onto the usual share.
  for (const c of Object.values(w.chars)) if (c.rank !== 'civilian' && !c.isPlayer && c.kickRate === 0 && BASE_RATE[c.rank] > 0) c.kickRate = BASE_RATE[c.rank];
  // Schema version: bump SCHEMA when a change needs old saves repaired, and add a step below.
  const v = (o.schema as number | undefined) ?? 1;
  // v7 (V76): organisations carry history, treasury, standing and relations; ensureShape (via ensureOrgs) gives older saves all of it.
  // v6 (V75): situations carry parties, phase, knowledge and history. Older ones keep their old fields; new ones start as the world runs.
  // v5 (V74): NPC goals. Older saves start with none; ensureShape gives them an empty agency and the NPCs form goals as the world runs.
  if (v < 4) {
    // v4 (V73): a share in a business is part of the business's own record, not a list on the player; arrears on a protection
    // arrangement are an amount owed, not a count of weeks.
    const old = (w.path as { stakes?: { biz: Id; share: number; since: number; shaken?: number }[] } | undefined)?.stakes;
    if (old && w.playerId) {
      for (const s of old) { const b = w.biz[s.biz]; if (b) { const x = addStake(w, b, w.playerId, s.share, 'bought in'); x.since = s.since; if (s.shaken) x.shaken = s.shaken; } }
      delete (w.path as { stakes?: unknown }).stakes;
    }
    for (const b of Object.values(w.biz)) if (b.protection && (b.protection.late ?? 0) > 0 && !b.protection.owed) { b.protection.owed = Math.min(b.protection.fee * b.protection.late!, b.protection.fee * 8); b.protection.why = 'unable'; }
  }
  if (v < 3) {
    // v3 (V72): who the player has been introduced to is recorded explicitly. Older saves derive it from who they have met.
    const pl = w.playerId ? w.chars[w.playerId] : undefined;
    if (pl && !pl.intro) { pl.intro = {}; for (const [id, r] of Object.entries(pl.rels)) if (r.lastMet > -1e8) pl.intro[id] = r.lastMet; }
  }
  if (v < 2) {
    // v2: hustles, seat quotas and dispute processes are optional fields that fill in as the world runs.
    for (const fam of Object.values(w.fam)) { fam.capBonus ??= {}; fam.seatNo ??= {}; }
  }
  // Stage 4: a man's hustle became an enterprise in w.ops (rackets.ts), the one record for everyone's. Loans become a book of street
  // loans; protection is real arrangements now (econ.ts) and odd jobs are not an enterprise, so those two are left behind.
  for (const c of Object.values(w.chars)) {
    const h = c.hustle;
    if (!h) continue;
    const kind = ({ loans: 'shylock', numbers: 'numbers', bookie: 'bookie', cars: 'chop', fence: 'fencing', vending: 'vending' } as Record<string, OpKind | undefined>)[h.kind];
    if (kind && c.alive) w.ops.push({ id: 'op' + w.nextId++, kind, owner: c.id, runner: null, district: c.district, since: h.since, state: 'running', last: h.net, total: h.total, skimmed: 0, weeks: 0, level: h.level, bad: h.bad, cause: h.cause, stake: h.stake, lull: h.lull });
    delete c.hustle;
  }
  // Stage 5C: the club's own conversation scenes are gone (a man at the club is talked to like anywhere else): one left open is closed
  if (w.scene) w.scene = null;
  w.schema = SCHEMA;
  if (Object.keys(w.biz).length < 34) addShops(w, 14);
  for (const c of Object.values(w.chars)) {
    c.skills ??= rollSkills(new Rng(w.seed + c.id.length * 7 + c.name.length), c.rank);
    c.standing ??= 40;
    c.books ??= emptyBooks();
    c.memos ??= [];
    c.kickRate ??= BASE_RATE[c.rank];
    c.cars ??= 0;
    c.goods ??= 0;
  }
  return w;
}

export function history(w: World, opts: { includeMinor?: boolean } = {}): string[] {
  return Object.values(w.facts)
    .filter((f) => opts.includeMinor || !f.minor)
    .map((f) => `[${shortTime(f.t)}] ${f.text}`);
}

export function report(w: World): string {
  const out: string[] = [];
  const chars = Object.values(w.chars);
  out.push('FAMILIES');
  for (const f of Object.values(w.fam)) {
    const m = chars.filter((c) => c.familyId === f.id && c.alive);
    const cash = m.reduce((s, c) => s + c.cash, 0);
    const prot = Object.values(w.biz).filter((b) => b.open && b.protection?.familyId === f.id && b.kind !== 'casino').length;
    out.push(`  ${f.name.padEnd(10)} members ${String(m.length).padStart(2)}  cash ${money(cash).padStart(9)}  protecting ${prot} shops  boss: ${w.chars[f.bossId].name}`);
  }
  const bz = Object.values(w.biz);
  out.push(`BUSINESSES  open ${bz.filter((b) => b.open).length}/${bz.length}`);
  const active = w.debts.filter((d) => d.status === 'active');
  out.push(`DEBTS       active ${active.length} (${money(active.reduce((s, d) => s + d.balance, 0))}), defaulted ${w.debts.filter((d) => d.status === 'defaulted').length}, repaid ${w.debts.filter((d) => d.status === 'paid').length}`);
  const kinds: Record<string, number> = {};
  for (const f of Object.values(w.facts)) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  out.push('EVENTS      ' + Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', '));
  out.push(`DEAD        ${chars.filter((c) => !c.alive).map((c) => c.name).join(', ') || 'nobody'}`);
  const feuds: { a: string; b: string; g: number }[] = [];
  for (const c of chars) for (const [id, r] of Object.entries(c.rels)) if (r.grudge >= 0.4 && w.chars[id]) feuds.push({ a: c.name, b: w.chars[id].name, g: r.grudge });
  feuds.sort((x, y) => y.g - x.g);
  out.push('FEUDS       ' + (feuds.slice(0, 6).map((f) => `${f.a} -> ${f.b} (${f.g.toFixed(2)})`).join('; ') || 'none'));
  return out.join('\n');
}
