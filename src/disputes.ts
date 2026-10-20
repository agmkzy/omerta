// Disputes are things in the world, not menus. A quarrel starts from an incident, then goes on without anyone watching:
// the injured side asks its superiors, the other side presses or backs off, someone plans a reply, a sit-down gets called, terms are agreed and sometimes broken.
import { addEnc } from './encounters';
import { addFact, clamp, famName, money, ownerBiz, rel, witnessesAt } from './core';
import { Character, DAY, Dispute, Fact, Id, World } from './types';

const KINDS: Record<string, Dispute['kind']> = { poach: 'territory', beating: 'violence', vandalism: 'violence', robbery: 'theft' };
const OLDER = (w: World, a: Character, b: Character, where: string) => [
  `an old understanding between the ${famName(w, b)} and ${famName(w, a)} families gave the ${famName(w, b)} side a share of ${where}`,
  `the ${famName(w, b)} family says it once paid for peace in ${where} and was never repaid`,
  `a favour from years back, never settled, which the ${famName(w, b)} side says buys them a piece of ${where}`,
];

export const disputesOf = (w: World, id: Id) => (w.disputes ?? []).filter((d) => d.a === id || d.b === id);
export const openFor = (w: World, id: Id) => (w.disputes ?? []).filter((d) => (d.status === 'open' || d.status === 'violated') && (d.a === id || d.b === id));

function log(w: World, d: Dispute, text: string) {
  if (d.history.at(-1)?.text === text) return; // nothing new, so nothing to announce
  d.history.push({ t: w.now, text });
  if (d.history.length > 14) d.history.shift();
}

function mergePairs(w: World) {
  const keep = new Map<string, Dispute>();
  for (const d of w.disputes ?? []) {
    if (d.status !== 'open' && d.status !== 'violated') continue;
    const k = [d.a, d.b].sort().join('|');
    const first = keep.get(k);
    if (!first) { keep.set(k, d); continue; }
    first.history = [...first.history, ...d.history].sort((x, y) => x.t - y.t).filter((h, i, l) => !i || h.text !== l[i - 1].text).slice(-14);
    first.created = Math.min(first.created, d.created);
    if (d.status === 'violated') first.status = 'violated';
    d.status = 'dropped'; d.history = [];
    (d as Dispute & { merged?: boolean }).merged = true;
  }
  w.disputes = (w.disputes ?? []).filter((d) => !(d as Dispute & { merged?: boolean }).merged);
}

// Called daily: notice new incidents between families and open a dispute for each.
export function disputeScan(w: World) {
  w.disputes ??= [];
  mergePairs(w);
  const since = w.disputeScan ?? w.now - DAY;
  w.disputeScan = w.now;
  for (const f of Object.values(w.facts)) {
    if (f.t <= since || f.minor || !KINDS[f.kind] || !f.actor || !f.victim) continue;
    const a = w.chars[f.victim];
    const b = w.chars[f.actor];
    if (!a?.alive || !b?.alive || !a.familyId || !b.familyId || a.familyId === b.familyId) continue;
    // terms already agreed: a fresh move on the same ground breaks them
    const bound = w.disputes.find((d) => d.status === 'settled' && d.terms && d.terms.barred === b.familyId && d.terms.biz === f.business && d.terms.by > w.now && w.chars[d.a]?.alive && w.chars[d.b]?.alive);
    if (bound) {
      bound.status = 'violated';
      bound.next = w.now + DAY;
      log(w, bound, `${b.name} (${famName(w, b)}) broke the agreement: ${f.text}`);
      const mid = w.chars[w.fam[bound.a === a.id ? a.familyId : b.familyId].bossId];
      if (mid) rel(mid, b.id).respect = clamp(rel(mid, b.id).respect - 0.05);
      const mine = w.chars[w.playerId!];
      if (mine && b.bossId === mine.id) { mine.standing = clamp(mine.standing - 2, 0, 100); if (mine.bossId) rel(w.chars[mine.bossId], mine.id).trust = clamp(rel(w.chars[mine.bossId], mine.id).trust - 0.05); }
      continue;
    }
    // One quarrel per pair of men, whichever of them struck last: what happens next is added to the same record.
    const ongoing = w.disputes.find((d) => (d.status === 'open' || d.status === 'violated') && ((d.a === a.id && d.b === b.id) || (d.a === b.id && d.b === a.id) || d.fact === f.id));
    if (ongoing) { if (ongoing.fact !== f.id) log(w, ongoing, f.text); continue; }
    const biz = f.business ? w.biz[f.business] : undefined;
    const d: Dispute = { id: 'd' + w.nextId++, kind: KINDS[f.kind], a: a.id, b: b.id, biz: biz?.id, fact: f.id, claim: f.amount ?? 0, status: 'open', history: [], created: w.now, next: w.now + w.rng.int(1, 3) * DAY };
    log(w, d, f.text);
    if (w.rng.chance(0.25)) d.older = w.rng.pick(OLDER(w, a, b, biz?.district ?? b.district));
    w.disputes.push(d);
  }
  // a dispute nobody has touched for two months simply dies
  for (const d of w.disputes) if (d.status === 'open' && w.now - (d.history.at(-1)?.t ?? d.created) > 60 * DAY) { d.status = 'dropped'; log(w, d, 'Nobody has raised it for two months. It lapses.'); }
  w.disputes = w.disputes.filter((d) => d.status === 'open' || d.status === 'violated' || d.status === 'settled' && (d.terms?.by ?? 0) > w.now - 30 * DAY || w.now - (d.history.at(-1)?.t ?? 0) < 45 * DAY);
}

// Each side decides what to do next, when it gets round to it.
export function disputeTick(w: World) {
  const P = w.chars[w.playerId!];
  for (const d of w.disputes ?? []) {
    if (d.status === 'settled' && d.terms && d.terms.by <= w.now) { delete d.terms; continue; }
    if (d.status !== 'open' && d.status !== 'violated') continue;
    if (d.next > w.now) continue;
    const a = w.chars[d.a], b = w.chars[d.b];
    if (!a?.alive || !b?.alive) { d.status = 'dropped'; log(w, d, 'One of the two is gone. There is nobody left to argue with.'); continue; }
    d.next = w.now + w.rng.int(2, 5) * DAY;
    d.status = 'open';
    const biz = d.biz ? w.biz[d.biz] : undefined;
    const rng = w.rng;
    // The man who did it: press, ease off, or make an offer.
    if (!b.isPlayer) {
      const fear = rel(b, a.id).respect * 0.5 + (a.rank === 'capo' || a.rank === 'soldier' ? 0.2 : 0);
      const roll = rng.next();
      if (roll < 0.45 - fear * 0.3 + b.traits.greed * 0.2 && biz?.open) {
        log(w, d, `${b.name} keeps leaning on ${biz.name}. The owner is getting nervous about who he will end up paying.`);
        if (biz.protection && biz.protection.collectorId === a.id && rng.chance(0.2)) { biz.protection.hold = w.now + 8 * 1440; log(w, d, `${biz.name} is holding back its envelope. It says it’s not sure who to give it to.`); }
      } else if (roll < 0.6 && rng.chance(b.traits.caution + 0.2)) {
        const comp = Math.min(Math.max(0, b.cash), rng.int(100, 300));
        if (comp > 0) { a.cash += comp; b.cash -= comp; }
        rel(b, a.id).grudge = clamp(rel(b, a.id).grudge - 0.05);
        d.status = 'dropped';
        log(w, d, `${b.name} sent ${comp ? money(comp) + ' and ' : ''}word that he’s finished with it. Either he got what he wanted, or he got scared.`);
        continue;
      }
    }
    // The injured side, if it isn't the player: take it up the chain, or plan a reply.
    if (!a.isPlayer) {
      const boss = a.bossId ? w.chars[a.bossId] : undefined;
      const goes = boss?.alive && !(w.pending ?? []).some((q) => q.kind === 'dispute' && q.a === a.id && q.b === b.id) && rng.chance(0.4 + a.traits.caution * 0.2 - a.traits.violence * 0.25);
      if (goes) {
        (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + rng.int(2, 4) * DAY, kind: 'dispute', a: a.id, b: b.id, c: boss!.id, tries: 0, note: 'true' });
        log(w, d, `${a.name} took it to ${boss!.name}, who says he’ll raise it.`);
      } else if (a.traits.violence + rel(a, b.id).grudge > 0.9 && rng.chance(0.3) && a.hurtUntil <= w.now) {
        planReply(w, a, b, d);
      }
    }
    // The longer it runs, the hotter the families get.
    if (w.now - d.created > 14 * DAY && !d.ignored === false && a.familyId && b.familyId) { /* ignored by the player: handled below */ }
    if (w.now - d.created > 14 * DAY && (w.now - d.created) % (7 * DAY) < 5 * DAY && a.familyId && b.familyId) {
      w.fam[a.familyId].tension[b.familyId] = (w.fam[a.familyId].tension[b.familyId] ?? 0) + 0.15;
      w.fam[b.familyId].tension[a.familyId] = (w.fam[b.familyId].tension[a.familyId] ?? 0) + 0.15;
    }
    // The player's own: something he can see changes.
    if (P && (d.a === P.id || (biz?.protection?.collectorId === P.id)) && !d.seen) d.seen = true;
  }
}

// An NPC decides to answer in kind. This is only an intention: it has to survive the days between.
function planReply(w: World, a: Character, b: Character, d: Dispute) {
  if ((w.pending ?? []).some((q) => q.kind === 'intent' && q.a === a.id && q.b === b.id)) return;
  const biz = ownerBiz(w, b.id);
  const mode = a.traits.violence > 0.7 && b.hurtUntil <= w.now ? 'beat' : biz ? 'torch' : 'beat';
  const due = w.now + w.rng.int(2, 6) * DAY;
  (w.pending ??= []).push({ id: 'p' + w.nextId++, due, kind: 'intent', a: a.id, b: b.id, c: biz?.id, note: mode, fact: d.id });
  log(w, d, `Word is that ${a.name} is thinking of answering ${b.name} in his own way.`);
  // someone close to him may hear it, and might pass it on
  const friend = Object.values(w.chars).find((x) => x.alive && x.id !== a.id && (x.rels[a.id]?.affection ?? 0) > 0.5 && x.familyId === a.familyId);
  if (friend) addFact(w, { kind: 'trouble', actor: a.id, victim: b.id, minor: true, text: `${a.name} has been talking about settling things with ${b.name}.`, district: a.district }, { witnesses: [friend.id] });
}

// An intention comes due. Circumstances may have changed.
export function intentDue(w: World, q: import('./types').Pending, perform: (w: World, a: import('./types').Action) => unknown) {
  const a = q.a ? w.chars[q.a] : undefined;
  const b = q.b ? w.chars[q.b] : undefined;
  const d = (w.disputes ?? []).find((x) => x.id === q.fact);
  if (!a?.alive || !b?.alive) return;
  if (q.note === 'raidop') {
    const op = w.ops.find((o) => o.id === q.c);
    if (!op || op.state !== 'running' || a.jailedUntil > w.now || w.rng.chance(0.3)) return;
    op.state = 'raided'; op.until = w.now + 14 * DAY;
    rel(a, b.id).grudge = clamp(rel(a, b.id).grudge + 0.1);
    addFact(w, { kind: 'vandalism', actor: a.id, victim: b.id, text: `${a.name}'s men wrecked the place ${b.name} was running a racket from.`, textHidden: `Somebody wrecked a back room in ${op.district}.`, district: op.district }, { witnesses: [b.id] });
    return;
  }
  const why = (t: string) => d && log(w, d, t);
  if (d && d.status !== 'open' && d.status !== 'violated') return void why(`${a.name} dropped the idea of answering ${b.name}. The matter is closed.`);
  if (a.jailedUntil > w.now) return void why(`${a.name} is locked up, so nothing comes of his plan against ${b.name}.`);
  if (a.hurtUntil > w.now) return void why(`${a.name} is laid up and can’t do anything about it.`);
  const boss = a.bossId ? w.chars[a.bossId] : undefined;
  if (boss?.alive && !a.isPlayer && boss.traits.caution > 0.55 && w.rng.chance(0.4)) return void why(`${boss.name} told ${a.name} to leave ${b.name} alone for now. He will.`);
  if (rel(a, b.id).grudge < 0.15 || w.rng.chance(0.18)) return void why(`${a.name} thought better of it.`);
  perform(w, { kind: 'retaliate', mode: (q.note as 'beat' | 'torch') ?? 'beat', actor: a.id, target: b.id, biz: q.c, approved: true, label: 'planned reply', score: 0 });
  why(`${a.name} answered ${b.name}.`);
}

// ---- settlement and terms

export function settleDispute(w: World, aId: Id, bId: Id, text: string, terms?: Dispute['terms']) {
  const d = (w.disputes ?? []).find((x) => (x.status === 'open' || x.status === 'violated') && ((x.a === aId && x.b === bId) || (x.a === bId && x.b === aId)));
  if (!d) return;
  d.status = 'settled';
  d.terms = terms;
  log(w, d, text);
}

// ---- what the player can do about it (all of it through the clock, none of it instant)

export function investigate(w: World, p: Character, d: Dispute): { minutes: number; lines: string[] } {
  d.found = true;
  const a = w.chars[d.a], b = w.chars[d.b];
  const lines: string[] = [];
  if (d.older) {
    lines.push(`You ask around, and an old man in a card room remembers: ${d.older}. It’s not a claim you can wave away. It also isn’t a licence to lean on a shop.`);
    log(w, d, `Found out why ${b.name} thinks he has a right: ${d.older}.`);
  } else {
    lines.push(`You ask around and find nothing behind it. ${b.name} saw an opening and took it. There’s no old arrangement and no one speaking for him.`);
    log(w, d, `Looked into ${b.name}’s claim. There is none; it is plain opportunism.`);
  }
  void a;
  return { minutes: 120, lines };
}

export function callSitdown(w: World, p: Character, d: Dispute): string[] {
  const x = w.chars[d.a === p.id || w.chars[d.b]?.isPlayer ? d.b : d.a] ?? w.chars[d.b];
  const other = x.id === p.id ? w.chars[d.a] : x;
  const host = other.familyId !== p.familyId ? (w.fam[p.familyId!] && w.chars[w.fam[p.familyId!].bossId]) : undefined;
  if (!other.alive) return ['He is dead. There is nobody to sit with.'];
  const where = Object.values(w.biz).find((b) => b.kind === 'restaurant' && b.open) ?? Object.values(w.biz).find((b) => b.open);
  addEnc(w, {
    kind: 'sitdown', from: other.id, about: host?.id, title: `Sit-down with ${other.name}`,
    lines: [`${other.name}, representing the ${famName(w, other)} side, is at a corner table${where ? ` at ${where.name}` : ''}. ${host ? `${host.name} has sent word that he’s watching how it goes.` : ''}`,
      d.older ? `Between you, the matter is ${d.history[0]?.text.replace(/\.$/, '') ?? 'the quarrel'}. He lets it be known that ${d.older}.` : `"We’re here about ${d.biz ? w.biz[d.biz]?.name : 'the matter'}," he says. "Say your piece."`],
    opts: [
      { code: 'hold', label: 'Hold your ground', hint: 'It’s yours. You say so.' },
      { code: 'pay', label: 'Offer $400 and call it even', hint: 'It buys peace and costs face.' },
      { code: 'share', label: 'Offer him a small cut of the weekly', hint: 'A shared arrangement binds both of you.' },
      { code: 'walk', label: 'Get up and leave', hint: 'It will be remembered.' },
    ],
    data: { dispute: d.id }, days: 3,
  });
  log(w, d, `A sit-down was called with ${other.name}.`);
  return [`You send word through the usual channels. ${other.name} agrees to meet. It’s now waiting on Today.`];
}

export function sitdownChoose(w: World, p: Character, e: import('./types').Enc, code: string): string[] {
  const d = (w.disputes ?? []).find((x) => x.id === e.data?.dispute);
  const o = e.from ? w.chars[e.from] : undefined;
  const lines: string[] = [];
  if (!d || !o?.alive) return ['The meeting comes to nothing.'];
  const rr = rel(o, p.id);
  const legit = !!d.older && !d.found ? 0.0 : d.older ? 0.25 : -0.1;
  const willing = clamp(0.45 + rr.respect * 0.3 + rr.trust * 0.2 + legit * -0.2 - o.traits.greed * 0.15 + (e.about ? 0.12 : 0), 0.1, 0.9);
  const biz = d.biz ? w.biz[d.biz] : undefined;
  const bId = d.a === p.id || (biz?.protection?.collectorId === p.id) ? d.b : d.a;
  const barredFam = o.familyId ?? undefined;
  if (code === 'walk') {
    rr.respect = clamp(rr.respect - 0.1);
    rel(o, p.id).grudge = clamp(rel(o, p.id).grudge + 0.1);
    log(w, d, `${p.name} walked out of the sit-down.`);
    lines.push(`You push back your chair and go. Nobody says a word until you’re out the door, and after that nobody says anything else. It won’t be forgotten.`);
    return lines;
  }
  if (code === 'hold') {
    if (w.rng.chance(willing * (d.older && d.found ? 0.5 : 0.8))) {
      settleDispute(w, p.id, bId, `At the sit-down ${o.name} agreed to keep off ${biz?.name ?? 'the ground'}.`, { text: `${o.name}'s side stays off ${biz?.name ?? 'it'}`, by: w.now + 90 * DAY, barred: barredFam, biz: d.biz });
      rr.respect = clamp(rr.respect + 0.04);
      lines.push(`You say it plainly: it’s yours and it stays yours. ${o.name} looks at you a while, then nods. "All right. We’ll keep off." He won’t pretend to like it. The agreement is good for three months, if everyone keeps it.`);
    } else {
      rr.grudge = clamp(rr.grudge + 0.1);
      log(w, d, `The sit-down broke up with no agreement.`);
      lines.push(`${o.name} listens to all of it and gives you nothing. "That isn’t how I heard it." The meeting ends politely, which is worse than loudly.`);
    }
    return lines;
  }
  if (code === 'pay') {
    if (p.cash < 400) return ['You haven’t got it on you. You’re left looking like a man who offers what he doesn’t have.'];
    p.cash -= 400; o.cash += 400;
    settleDispute(w, p.id, bId, `${p.name} paid ${o.name} $400 at the sit-down to end it.`, { text: `${o.name}'s side stays off ${biz?.name ?? 'it'}, for $400`, by: w.now + 120 * DAY, barred: barredFam, biz: d.biz });
    rr.respect = clamp(rr.respect - 0.02); rr.trust = clamp(rr.trust + 0.04);
    lines.push(`You slide an envelope across without being asked twice. ${o.name} doesn’t count it in front of you. "That’ll do," he says. It buys peace and some quiet gossip about how easily you paid.`);
    return lines;
  }
  if (code === 'share') {
    if (w.rng.chance(willing + 0.15)) {
      const fee = biz?.protection?.fee ?? 100;
      settleDispute(w, p.id, bId, `${p.name} and ${o.name} agreed to share ${biz?.name ?? 'the take'}; a small cut goes his way each week.`, { text: `${o.name} gets a cut of ${biz?.name ?? 'it'} (about ${money(Math.round(fee * 0.25))} a week) and keeps off`, by: w.now + 120 * DAY, barred: barredFam, biz: d.biz, cut: 0.25, to: o.id });
      rr.trust = clamp(rr.trust + 0.08);
      lines.push(`"A quarter of the weekly," you say. He thinks it over and laughs, not unkindly. "You’re a practical man." Hands are shaken. It costs you money and removes an enemy, and that’s often a fair trade.`);
    } else {
      lines.push(`${o.name} doesn’t want a share. He wants the whole thing, and says so. The meeting ends without terms.`);
      log(w, d, 'He refused a shared arrangement.');
    }
    return lines;
  }
  return lines;
}

export function ignoreDispute(d: Dispute, w: World) { d.ignored = true; log(w, d, 'You are leaving this alone for now.'); }

export function noteDispute(w: World, aId: Id, bId: Id, text: string): string | undefined {
  const d = (w.disputes ?? []).find((x) => (x.status === 'open' || x.status === 'violated') && ((x.a === aId && x.b === bId) || (x.a === bId && x.b === aId)));
  if (d) log(w, d, text);
  return d?.id;
}

// Everything that is yours to answer for in a dispute: the ones where you are a party, where the injured man is yours, or where the shop pays you.
export function mineAgainst(w: World, p: Character, x: Character): Dispute[] {
  return (w.disputes ?? []).filter((d) => (d.status === 'open' || d.status === 'violated') && d.b === x.id && (d.a === p.id || w.chars[d.a]?.bossId === p.id || (d.biz && w.biz[d.biz]?.protection?.collectorId === p.id)));
}
// The other way round: he is the one who was wronged, and you are the man who did it.
export function againstMe(w: World, p: Character, x: Character): Dispute[] {
  return (w.disputes ?? []).filter((d) => (d.status === 'open' || d.status === 'violated') && d.a === x.id && d.b === p.id);
}
export function touchDispute(w: World, p: Character, x: Character, text?: string) {
  for (const d of [...mineAgainst(w, p, x), ...againstMe(w, p, x)]) { d.handled = w.now; d.seen = true; if (text) log(w, d, text); }
}
// Making amends to the man you wronged: what you say and what you pay changes where the quarrel stands.
export function amends(w: World, p: Character, x: Character, how: 'own' | 'pay' | 'start' | 'defy'): void {
  const rng = w.rng;
  for (const d of [...againstMe(w, p, x), ...mineAgainst(w, p, x)]) {
    d.handled = w.now; d.seen = true;
    const soft = clamp(rel(x, p.id).trust + rel(x, p.id).respect * 0.5 - x.traits.violence * 0.3 - rel(x, p.id).grudge * 0.4, 0, 1);
    if (how === 'own') {
      if (rng.chance(0.3 + soft * 0.5)) { d.status = 'settled'; log(w, d, `${p.name} owned up to what he did to ${x.name}, to his face. ${x.name} accepted it. The quarrel is over.`); }
      else { log(w, d, `${p.name} owned up to ${x.name}. He heard it out. It isn’t forgotten, but it helped.`); d.next = w.now + 4 * DAY; }
    } else if (how === 'pay') {
      d.status = 'settled'; log(w, d, `${p.name} paid ${x.name} for what he did. ${x.name} took it. They’re square, more or less.`);
    } else if (how === 'start') {
      log(w, d, `${p.name} told ${x.name} he started it. ${x.name} didn’t like hearing it.`); d.next = w.now + 2 * DAY;
    } else { log(w, d, `${p.name} told ${x.name} he would do it again. ${x.name} took that as a declaration.`); d.next = w.now + DAY; }
  }
}

// What you did to him changes the dispute, one way or another. Nothing you do leaves it exactly where it was.
export function playerActed(w: World, p: Character, x: Character, how: string) {
  const rng = w.rng;
  for (const d of mineAgainst(w, p, x)) {
    d.handled = w.now;
    d.seen = true;
    const resp = clamp(rel(x, p.id).respect + (x.rank === 'associate' ? 0.15 : 0) - x.traits.courage * 0.25, 0, 1);
    switch (how) {
      case 'beat':
        if (rng.chance(0.45 + resp * 0.3)) { d.status = 'dropped'; log(w, d, `${p.name} had ${x.name} beaten. He’s keeping clear of the place now.`); }
        else { log(w, d, `${p.name} had ${x.name} beaten. He hasn’t backed down; he’s nursing it.`); d.next = w.now + 2 * DAY; rel(x, p.id).grudge = clamp(rel(x, p.id).grudge + 0.15); }
        break;
      case 'hit': d.status = 'dropped'; log(w, d, `${x.name} is dead. The quarrel went with him, and what follows won’t be settled by anyone in this room.`); break;
      case 'warn':
        if (rng.chance(0.3 + resp * 0.4)) { d.status = 'dropped'; log(w, d, `${p.name} warned ${x.name} off. He took the hint.`); }
        else { log(w, d, `${p.name} warned ${x.name} off. He took it as a challenge.`); d.next = w.now + DAY; }
        break;
      case 'drop': d.status = 'dropped'; log(w, d, `${p.name} let it go.`); break;
      case 'smash': case 'rob': case 'torch': log(w, d, `${p.name} answered ${x.name} through his own business. It isn’t over, but now ${x.name} knows what it costs.`); d.next = w.now + 2 * DAY; break;
      case 'shame': log(w, d, `${p.name} let it be known what ${x.name} did.`); break;
      case 'sup': case 'mine': log(w, d, `${p.name} took it to a superior.`); break;
      default: log(w, d, `${p.name} dealt with ${x.name}.`);
    }
  }
}
