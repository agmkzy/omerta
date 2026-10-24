// Gate 4: side-effect parity between the old engine and the conversation layer, interaction by interaction, on several worlds and at
// several levels of trust (so both sides of every decision are taken). An empty difference is parity; where the layer deliberately
// differs (the ledger now records money the old engine moved by hand) the difference is named, not hidden.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, createDebt, feelToOn, rel } from '../../core';
import { addFavour } from '../../encounters';
import { openAsk, playerMove } from '../../asks';
import { replies as exReplies } from '../../exchange';
import { mkJob } from '../../jobs';
import { addEnc } from '../../encounters';
import { social } from '../../conv/social';
import { DAY, type Character, type World } from '../../types';
import { newWorld, P } from '../helpers';
import { fingerprint, layer, legacy, parity } from './parity';
import { writeFileSync } from 'node:fs';
import { afterAll } from 'vitest';

// (GOLDEN=write: the old engine's effects for every case are recorded, for when the old engine is gone)
const GOLD: Record<string, string> = {};
afterAll(() => { if (process.env.GOLDEN === 'write') writeFileSync(new URL('../fixtures/gate4-parity.json', import.meta.url), JSON.stringify(GOLD, Object.keys(GOLD).sort(), 1)); });

const SEEDS = [3, 7, 11];
const TRUST = [0.1, 0.4, 0.75];
// the men a conversation is had with: his boss, a man of his own family, one of another family, a shopkeeper, and one of his own crew
// (every world has the conversation layer's record, as every game does after Gate 4: new games, and old saves on load)
function cast(seed: number) {
  const w = newWorld(seed); social(w);
  const p = P(w), alive = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer);
  const boss = w.chars[p.bossId!];
  const fam = alive.find((c) => c.familyId === p.familyId && c.rank === 'soldier' && c.id !== boss.id)!;
  const rival = alive.find((c) => c.familyId && c.familyId !== p.familyId && c.rank === 'soldier')!;
  const shop = alive.find((c) => c.rank === 'civilian' && Object.values(w.biz).some((b) => b.ownerId === c.id && b.open))!;
  const crew = alive.find((c) => c.familyId === p.familyId && c.rank === 'associate' && c.id !== p.id)!;
  crew.bossId = p.id;
  // a second man under the player, so there is somebody to get on with or not
  const mate = alive.find((c) => c.familyId === p.familyId && c.rank === 'associate' && c.id !== p.id && c.id !== crew.id)!;
  mate.bossId = p.id;
  for (const c of [boss, fam, rival, shop, crew, mate]) { (p.intro ??= {})[c.id] = 0; }
  return { w, p, boss, fam, rival, shop, crew, mate };
}
type Cast = ReturnType<typeof cast>;
const trusting = (w: World, t: Character, p: Character, v: number) => { const r = rel(t, p.id); feelToOn(r, 'trust', v); feelToOn(r, 'affection', v * 0.8); feelToOn(r, 'respect', v); r.known = Math.max(r.known ?? 0, 0.5); };
// an event the man knows of: what he did, what was done to him, what he heard
function event(w: World, kind: string, actor: Character | undefined, victim: Character | undefined, knowers: { c: Character; actor: boolean }[], amount?: number) {
  const f = addFact(w, { kind: kind as never, actor: actor?.id, victim: victim?.id, amount, text: `${actor?.name ?? 'Somebody'} did a ${kind} to ${victim?.name ?? 'somebody'}.`, textHidden: `Somebody did a ${kind} to ${victim?.name ?? 'somebody'}.`, district: victim?.district ?? 'Little Italy' }, { witnesses: [] });
  for (const k of knowers) k.c.known[f.id] = { t: w.now, from: 'witness', knowsActor: k.actor };
  return f;
}
interface Case { name: string; who: (x: Cast) => Character; setup?: (x: Cast, t: Character) => Record<string, unknown> | void; old: string | ((s: Record<string, unknown>) => string); now?: string | ((s: Record<string, unknown>) => string); node?: string; ctx?: (s: Record<string, unknown>) => Record<string, unknown>; th?: (s: Record<string, unknown>) => Record<string, unknown>; allow?: RegExp[]; both?: boolean }
// (where the layer posts money the old engine moved by hand: the ledger is the only difference, and it is named)
function check(cs: Case) {
  const outcomes = new Set<string>();
  for (const seed of SEEDS) for (const tr of TRUST) {
    const x = cast(seed), t = cs.who(x);
    trusting(x.w, t, x.p, tr);
    const s = cs.setup?.(x, t) ?? {};
    const oc = typeof cs.old === 'string' ? cs.old : cs.old(s), nc = cs.now === undefined ? oc : typeof cs.now === 'string' ? cs.now : cs.now(s);
    const a = legacy(x.w, t.id, oc, { node: cs.node ?? 'root', ctx: { asked: [], ...(cs.ctx?.(s) ?? {}) } as never });
    const b = layer(x.w, t.id, nc, (cs.th?.(s) ?? {}) as never);
    const d = parity(a, b, cs.allow);
    assert.deepEqual(d, [], `${cs.name} (seed ${seed}, trust ${tr})\nold: ${a.lines.join(' / ')}\nnew: ${b.lines.join(' / ')}\nold changed: ${a.changed.join('; ')}\nnew changed: ${b.changed.join('; ')}`);
    GOLD[`${cs.name}|${seed}|${tr}`] = fingerprint(a.changed);
    assert.equal(fingerprint(b.changed), fingerprint(a.changed), `${cs.name} (seed ${seed}, trust ${tr}): fingerprints differ\nold: ${a.changed.join('; ')}\nnew: ${b.changed.join('; ')}`);
    outcomes.add(a.changed.filter((k) => !/\.(cool|talk)\./.test(k)).map((k) => k.split(':')[0]).sort().join(','));
  }
  // (a decision left to chance: across the worlds and levels of trust tried, it went more than one way, so both ways are proved)
  if (cs.both) assert.ok(outcomes.size >= 2, `${cs.name}: only one outcome was tried`);
}

describe('Gate 4 parity, Stage A: personal talk and what a man knows', () => {
  const A: Case[] = [
    { name: 'how he is keeping', who: (x) => x.fam, old: 'how', node: 'personal' },
    { name: 'how he is keeping, short of money and nursing a grudge', who: (x) => x.shop, setup: (x, t) => { t.cash = 90; rel(t, x.fam.id).grudge = 0.5; }, old: 'how', node: 'personal' },
    { name: 'what happened to him (hurt)', who: (x) => x.fam, setup: (x, t) => { t.hurtUntil = x.w.now + 3 * DAY; event(x.w, 'beating', x.rival, t, [{ c: t, actor: true }]); }, old: 'f_hurt', node: 'follow' },
    { name: 'what is wrong at the shop', who: (x) => x.shop, setup: (x, t) => { const b = Object.values(x.w.biz).find((q) => q.ownerId === t.id)!; b.distress = 2; }, old: 'f_biz', node: 'follow' },
    { name: 'is there anything I can do', who: (x) => x.shop, setup: (_x, t) => { t.cash = 100; }, old: 'f_help', node: 'follow' },
    { name: 'a gift, no questions', who: (x) => x.shop, setup: (_x, t) => { t.cash = 100; }, old: 'help_gift', node: 'personal', allow: [] },
    { name: 'welcome back', who: (x) => x.fam, setup: (x, t) => { addFact(x.w, { kind: 'arrest', actor: t.id, text: 'arrested', district: t.district }, { witnesses: [] }); }, old: 'welcome', node: 'personal' },
    { name: 'congratulations', who: (x) => x.fam, old: 'congrats', node: 'personal' },
    { name: 'reminiscing', who: (x) => x.fam, setup: (x, t) => { event(x.w, 'robbery', x.rival, x.shop, [{ c: t, actor: true }]); }, old: 'old_times', node: 'personal' },
    { name: 'what he wants', both: true, who: (x) => x.crew, old: 'ask_want' },
    { name: 'what I can do about what he wants', who: (x) => x.crew, setup: (_x, t) => { t.want = { kind: 'made', since: 0 }; }, old: 'f_want', node: 'follow' },
    { name: 'how he gets on with the others', both: true, who: (x) => x.crew, setup: (x, t) => { rel(t, x.mate.id).trust = 0.6; }, old: 'ask_crew' },
    { name: 'about another man', who: (x) => x.fam, setup: (x, t) => { rel(t, x.boss.id).trust = 0.8; event(x.w, 'beating', x.boss, x.rival, [{ c: t, actor: true }]); return { id: x.boss.id }; }, old: (s) => 'about:' + s.id, node: 'pick_member' },
    { name: 'the leadership', who: (x) => x.boss, old: 'leaders', node: 'family' },
    { name: 'what people say', who: (x) => x.fam, old: 'ask_rep' },
    { name: 'where he heard what people say', who: (x) => x.fam, setup: (x, t) => { const f = event(x.w, 'beating', x.p, x.rival, []); t.known[f.id] = { t: x.w.now, from: x.boss.id, knowsActor: true }; }, old: 'f_rep_who', node: 'follow' },
    { name: 'what is between you', who: (x) => x.fam, setup: (x, t) => { addFact(x.w, { kind: 'favour', actor: x.p.id, victim: t.id, text: 'a favour', district: t.district }, { witnesses: [x.p.id, t.id] }); }, old: 'ask_history' },
    { name: 'asking around about him', who: (x) => x.rival, setup: (x, t) => { delete x.p.intro![t.id]; }, old: 'ask_around' },
    { name: 'introducing yourself', both: true, who: (x) => x.rival, setup: (x, t) => { delete x.p.intro![t.id]; }, old: 'intro' },
    { name: 'a drink across the line', who: (x) => x.rival, old: 'rv_drink', node: 'rival', allow: [] },
    { name: 'how things are between the families', who: (x) => x.rival, old: 'rv_mood', node: 'rival' },
    { name: 'a favour across the line', who: (x) => x.rival, old: 'rv_favour', node: 'rival' },
    { name: 'trading gossip', both: true, who: (x) => x.rival, setup: (x, t) => { event(x.w, 'robbery', x.fam, x.shop, [{ c: t, actor: true }]); event(x.w, 'vandalism', x.crew, x.shop, [{ c: x.p, actor: true }]); }, old: 'rv_ears', node: 'rival' },
    { name: 'the trade itself', who: (x) => x.rival, setup: (x, t) => { event(x.w, 'robbery', x.fam, x.shop, [{ c: t, actor: true }]); event(x.w, 'vandalism', x.crew, x.shop, [{ c: x.p, actor: true }]); }, old: 'fl:rv_trade', now: 'rv_trade', node: 'follow' },
  ];
  for (const cs of A) ok(cs.name, { tags: ['compat'] }, () => check(cs));
});

describe('Gate 4 parity, Stage A: an event in hand', () => {
  const E = (name: string, code: string, mk: (x: Cast, t: Character) => string, extra: Partial<Case> = {}): Case => ({ name, who: (x) => x.shop, setup: (x, t) => ({ f: mk(x, t) }), old: code, node: 'incident', ctx: (s) => ({ fact: s.f }), th: (s) => ({ fact: s.f }), ...extra });
  const robbed = (x: Cast, t: Character) => event(x.w, 'robbery', x.rival, t, [{ c: t, actor: true }, { c: x.p, actor: true }, { c: x.fam, actor: false }], 400).id;
  const heard = (x: Cast, t: Character) => event(x.w, 'beating', x.rival, x.fam, [{ c: t, actor: true }]).id;
  const mine = (x: Cast, t: Character) => event(x.w, 'vandalism', x.p, t, [{ c: t, actor: true }, { c: x.p, actor: true }]).id;
  const his = (x: Cast, t: Character) => event(x.w, 'beating', t, x.fam, [{ c: t, actor: true }, { c: x.p, actor: true }]).id;
  const cases: Case[] = [
    { name: 'asking about it (he did it)', both: true, who: (x) => x.fam, setup: (x, t) => ({ f: his(x, t) }), old: (s) => 'inc:' + s.f },
    { name: 'asking about it (it was done to him)', who: (x) => x.shop, setup: (x, t) => ({ f: robbed(x, t) }), old: (s) => 'inc:' + s.f },
    { name: 'asking about it (he heard of it)', who: (x) => x.shop, setup: (x, t) => ({ f: heard(x, t) }), old: (s) => 'inc:' + s.f },
    E('owning up', 'own', mine), E('denying it', 'lie', mine, { both: true }), E('his view', 'view', robbed), E('is there more', 'tell_more', robbed), E('will anyone do something', 'involve', heard),
    E('what can be done', 'can_do', robbed), E('who it was', 'who', heard), E('what it cost', 'how_much', robbed), E('who else was there', 'witness', robbed), E('where he heard it', 'source', heard),
    E('I will find out who', 'find', (x, t) => event(x.w, 'robbery', x.rival, t, [{ c: t, actor: false }]).id), E('I will speak to them', 'speak', robbed), E('a sit-down', 'sitdown', robbed),
    E('why he did it', 'why', his, { who: (x) => x.fam }),
    { name: 'pressing him on a denial', both: true, who: (x) => x.fam, setup: (x, t) => ({ f: his(x, t) }), old: 'press', node: 'incident', ctx: (s) => ({ fact: s.f, denied: true }), th: (s) => ({ fact: s.f, denied: true }) },
    { name: 'letting it drop', who: (x) => x.fam, setup: (x, t) => ({ f: his(x, t) }), old: 'drop', node: 'incident', ctx: (s) => ({ fact: s.f, denied: true }), th: (s) => ({ fact: s.f, denied: true }) },
  ];
  for (const cs of cases) ok(cs.name, { tags: ['compat'] }, () => check(cs));
});

describe('Gate 4 parity, Stage A: a man he has a problem with', () => {
  const grudge = (x: Cast, t: Character) => { rel(t, x.rival.id).grudge = 0.6; return { s: x.rival.id }; };
  const cases: Case[] = [
    { name: 'who he suspects', who: (x) => x.shop, setup: grudge, old: 'suspect', node: 'disputes' },
    { name: 'telling him what you know', who: (x) => x.shop, setup: (x, t) => { const g = grudge(x, t); const f = event(x.w, 'robbery', x.rival, x.fam, [{ c: x.p, actor: true }]); return { ...g, f: f.id }; }, old: (s) => 'tell:' + s.f, node: 'subject', ctx: (s) => ({ subject: s.s }), th: (s) => ({ subject: s.s }) },
    { name: 'telling him it was not that man', who: (x) => x.shop, setup: (x, t) => { const g = grudge(x, t); const f = event(x.w, 'robbery', x.fam, t, [{ c: x.p, actor: true }]); return { ...g, f: f.id }; }, old: (s) => 'exon:' + s.f, node: 'subject', ctx: (s) => ({ subject: s.s }), th: (s) => ({ subject: s.s }) },
    { name: 'offering to deal with him', who: (x) => x.shop, setup: grudge, old: 'handle', node: 'subject', ctx: (s) => ({ subject: s.s }), th: (s) => ({ subject: s.s }) },
    { name: 'offering to mediate', who: (x) => x.shop, setup: grudge, old: 'mediate', node: 'disputes' },
    { name: 'offering to mediate (from the subject)', who: (x) => x.shop, setup: grudge, old: 'mediate2', node: 'subject', ctx: (s) => ({ subject: s.s }), th: (s) => ({ subject: s.s }) },
  ];
  for (const cs of cases) ok(cs.name, { tags: ['compat'] }, () => check(cs));
});

describe('Gate 4 parity, Stage B: money and business', () => {
  // the shop that pays the player: a civilian's place with the player as its collector
  const shopFor = (x: Cast, t: Character, o: { late?: number; why?: 'unable' | 'delayed'; distress?: number } = {}) => {
    const b = Object.values(x.w.biz).find((q) => q.ownerId === t.id)!;
    b.protection = { collectorId: x.p.id, familyId: x.p.familyId!, fee: 60, since: 0, ...(o.late ? { late: o.late, owed: 60 * o.late, why: o.why ?? 'unable' } : {}) };
    if (o.distress) b.distress = o.distress;
    return b;
  };
  const garage = (x: Cast) => { const b = Object.values(x.w.biz).find((q) => q.kind === 'garage' && q.open && x.w.chars[q.ownerId]?.rank === 'civilian')!; x.p.cash = 5000; return x.w.chars[b.ownerId]; };
  const pawn = (x: Cast) => { const b = Object.values(x.w.biz).find((q) => q.kind === 'pawnshop' && q.open && x.w.chars[q.ownerId]?.rank === 'civilian'); return b ? x.w.chars[b.ownerId] : x.shop; };
  const owes = (x: Cast, t: Character, missed = 0) => { const d = createDebt(x.w, x.p.id, t.id, 800, 0.05, 'a loan'); d.missed = missed; t.cash = 500; return { d: d.id }; };
  const owe = (x: Cast, t: Character, missed = 0) => { const d = createDebt(x.w, t.id, x.p.id, 800, 0.05, 'a loan'); d.missed = missed; x.p.cash = 2000; return { d: d.id }; };
  const B: Case[] = [
    { name: 'how is business (his shop, with trouble there)', who: (x) => x.shop, setup: (x, t) => { event(x.w, 'vandalism', x.rival, t, [{ c: t, actor: true }]); }, old: 'op', node: 'business', both: true },
    { name: 'how is business (a made man, a side line)', who: (x) => x.fam, setup: (_x, t) => { t.books.side = 150; }, old: 'op', node: 'business' },
    { name: 'how is business (no business of his own)', who: (x) => x.crew, old: 'biz_none' },
    { name: 'earnings, with his boss', who: (x) => x.boss, old: 'earn', node: 'business' },
    { name: 'what is owed, with a debtor', who: (x) => x.fam, setup: (x, t) => { owes(x, t, 1); }, old: 'earn', node: 'business' },
    { name: 'a smaller share', who: (x) => x.boss, old: 'rate_ask', node: 'business' },
    { name: 'a chop shop', who: garage, old: 'partner_chop', node: 'business', both: true },
    { name: 'moving goods', who: pawn, old: 'partner_fence', node: 'business' },
    { name: 'cutting his fee', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t); }, old: 'terms_cut', node: 'business' },
    { name: 'raising his fee', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t); }, old: 'terms_raise', node: 'business' },
    { name: 'the haggle: nothing for it', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t); }, old: 'deal:nothing', node: 'follow' },
    { name: 'the haggle: remember it', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t); }, old: 'deal:remember', node: 'follow' },
    { name: 'the haggle: settle at his figure', who: (x) => x.shop, setup: (x, t) => ({ b: shopFor(x, t).id }), old: 'deal:take', node: 'follow', ctx: (s) => ({ deal: { kind: 'fee', biz: s.b, ask: 75, old: 60, offer: 65 } }), th: (s) => ({ deal: { kind: 'fee', biz: s.b, ask: 75, old: 60, offer: 65 } }) },
    { name: 'the haggle: hold out', who: (x) => x.shop, setup: (x, t) => ({ b: shopFor(x, t).id }), old: 'deal:hold', node: 'follow', ctx: (s) => ({ deal: { kind: 'fee', biz: s.b, ask: 75, old: 60, offer: 65 } }), th: (s) => ({ deal: { kind: 'fee', biz: s.b, ask: 75, old: 60, offer: 65 } }), both: true },
    { name: 'the haggle: let it lie', who: (x) => x.shop, setup: (x, t) => ({ b: shopFor(x, t).id }), old: 'deal:drop', node: 'follow', ctx: (s) => ({ deal: { kind: 'fee', biz: s.b, ask: 75, old: 60, offer: 65 } }), th: (s) => ({ deal: { kind: 'fee', biz: s.b, ask: 75, old: 60, offer: 65 } }) },
    { name: 'protection, put to a shop', who: (x) => x.shop, old: 'suggest', node: 'business' },
    { name: 'borrowing', who: (x) => x.boss, setup: (_x, t) => { t.cash = 5000; }, old: 'borrow', node: 'business' },
    { name: 'buying the place', who: (x) => x.shop, old: 'buy_ask', node: 'business' },
    { name: 'buying a piece', who: (x) => x.shop, old: 'stake_ask', node: 'business' },
    { name: 'selling him yours', who: (x) => x.boss, setup: (x, t) => { const b = Object.values(x.w.biz).find((q) => q.open && q.kind !== 'casino' && q.ownerId !== t.id && x.w.chars[q.ownerId]?.rank === 'civilian')!; b.ownerId = x.p.id; t.cash = 50000; }, old: 'sell_ask', node: 'business' },
    { name: 'a loan, offered', who: (x) => x.shop, old: 'offer_loan', node: 'business' },
    { name: 'the shop: how it does', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t, { distress: 1 }); }, old: 'sh_how', node: 'shop' },
    { name: 'the shop: why it is late', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t, { late: 1, why: 'delayed' }); }, old: 'sh_why', node: 'shop', both: true },
    { name: 'the shop: anyone else around', who: (x) => x.shop, setup: (x, t) => { const b = shopFor(x, t); const f = event(x.w, 'vandalism', x.rival, t, [{ c: t, actor: true }]); f.business = b.id; }, old: 'sh_ears', node: 'shop' },
    { name: 'the shop: this week handed back', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t, { distress: 2 }); }, old: 'sh_back', node: 'shop' },
    { name: 'the shop: a week’s grace', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t, { late: 1 }); }, old: 'sh_time', node: 'shop' },
    { name: 'the shop: leaning on him', who: (x) => x.shop, setup: (x, t) => { shopFor(x, t, { late: 2 }); }, old: 'sh_lean', node: 'shop' },
    { name: 'a debt: reminding him', who: (x) => x.fam, setup: (x, t) => { owes(x, t, 1); }, old: 'd_remind', node: 'debt', both: true },
    { name: 'a debt: more time', who: (x) => x.fam, setup: (x, t) => { owes(x, t, 1); }, old: 'd_time', node: 'debt' },
    { name: 'a debt: halved', who: (x) => x.fam, setup: (x, t) => { owes(x, t); }, old: 'd_half', node: 'debt' },
    { name: 'a debt: a favour for $300', who: (x) => x.fam, setup: (x, t) => { owes(x, t); }, old: 'd_favour', node: 'debt' },
    { name: 'a debt: a quarter forgiven', who: (x) => x.fam, setup: (x, t) => { owes(x, t); }, old: 'd_forgive', node: 'debt' },
    { name: 'a debt: paying the week', who: (x) => x.fam, setup: (x, t) => { owe(x, t); }, old: 'd_pay', node: 'debt' },
    { name: 'a debt: settling it', who: (x) => x.fam, setup: (x, t) => { owe(x, t); }, old: 'd_all', node: 'debt' },
    { name: 'a debt: asking for time', who: (x) => x.fam, setup: (x, t) => { owe(x, t, 1); }, old: 'd_ask', node: 'debt', both: true },
    { name: 'a debt: money down for the week', who: (x) => x.fam, setup: (x, t) => owe(x, t), old: 'deal:part', node: 'follow', ctx: (s) => ({ deal: { kind: 'ext', debt: s.d, ask: 0, offer: 100 } }), th: (s) => ({ deal: { kind: 'ext', debt: s.d, ask: 0, offer: 100 } }) },
    { name: 'the envelope', who: (x) => x.boss, setup: (x) => { x.p.cash = 3000; }, old: 'b_envelope', node: 'myboss' },
    { name: 'over and above: $250', who: (x) => x.boss, setup: (x) => { x.p.cash = 3000; }, old: 'b_extra', node: 'myboss' },
    { name: 'over and above: $1,000', who: (x) => x.boss, setup: (x) => { x.p.cash = 3000; }, old: 'b_extra2', node: 'myboss' },
    { name: 'a gift for nothing', who: (x) => x.boss, setup: (x) => { x.p.cash = 3000; }, old: 'b_tribute', node: 'myboss' },
    { name: 'calling in a favour', who: (x) => x.fam, setup: (x, t) => ({ f: addFavour(x.w, x.p.id, t.id, 2, 'a good turn').id }), old: (s) => 'favcall:' + s.f },
  ];
  for (const cs of B) ok(cs.name, { tags: ['compat'] }, () => check(cs));
  // a matter between them, opened by the old engine's own entry, then moved, answered and given a figure
  const matter = (x: Cast, t: Character) => { const b = Object.values(x.w.biz).find((q) => q.ownerId === t.id)!; const s = openAsk(x.w, 'protect', x.p, t, { biz: b.id, amt: 60, why: 'test' })!; return { s: s.id }; };
  const M: Case[] = [
    { name: 'a matter: raising it', who: (x) => x.shop, setup: matter, old: (s) => 'f:m:' + s.s, now: (s) => 'm:' + s.s },
    { name: 'a matter: asking', who: (x) => x.shop, setup: matter, old: (s) => `mv:${s.s}:ask`, both: true },
    { name: 'a matter: making the case', who: (x) => x.shop, setup: matter, old: (s) => `mv:${s.s}:persuade` },
    { name: 'a matter: pressure', who: (x) => x.shop, setup: matter, old: (s) => `mv:${s.s}:pressure` },
    { name: 'a matter: a figure named', who: (x) => x.shop, setup: matter, old: (s) => `nm:${s.s}:45` },
  ];
  // (his answer to the ask leaves a point the player can answer: the first such answer, as the screen would offer it)
  const pointed = (x: Cast, t: Character) => { const m = matter(x, t); playerMove(x.w, x.p, m.s, 'ask'); const s0 = (x.w.situations ?? []).find((q) => q.id === m.s)!; const k = exReplies(x.w, x.p, s0)[0]?.k ?? 'drop'; return { ...m, k }; };
  M.push({ name: 'a matter: answering his point', who: (x) => x.shop, setup: pointed, old: (s) => `x:${s.s}:${s.k}` });
  // his trouble: the shop losing money, he has told the player
  const trouble = (x: Cast, t: Character, told = true) => { const b = Object.values(x.w.biz).find((q) => q.ownerId === t.id)!; const rv = Object.values(x.w.biz).find((q) => q.open && q.id !== b.id)!; b.distress = 2; (x.w.situations ??= []).push({ id: 's' + x.w.nextId++, kind: 'money', who: t.id, biz: b.id, rival: rv.id, since: 0, stage: 'handling', cause: `${b.name} is losing customers to ${rv.name}`, knows: told, told, weeks: 1 }); x.p.cash = 2000; };
  M.push(
    { name: 'his trouble: asking', who: (x) => x.shop, setup: (x, t) => { trouble(x, t, false); }, old: 'sit_ask' },
    { name: 'his trouble: covering it', who: (x) => x.shop, setup: (x, t) => { trouble(x, t); }, old: 'sit_cover' },
    { name: 'his trouble: a loan', who: (x) => x.shop, setup: (x, t) => { trouble(x, t); }, old: 'sit_lend' },
    { name: 'his trouble: a word to the rival', who: (x) => x.shop, setup: (x, t) => { trouble(x, t); }, old: 'sit_rival' },
    { name: 'his trouble: left to him', who: (x) => x.shop, setup: (x, t) => { trouble(x, t); }, old: 'sit_leave' },
  );
  // running a racket of his
  M.push({ name: 'running his racket', who: (x) => { const o = x.w.ops.find((q) => q.kind !== 'hijack' && q.state === 'running' && !x.w.chars[q.owner]?.isPlayer && x.w.chars[q.owner]?.alive); return o ? x.w.chars[o.owner] : x.fam; }, old: 'run_ask', node: 'business' });
  for (const cs of M) ok(cs.name, { tags: ['compat'] }, () => check(cs));
});

describe('Gate 4 parity, Stage C: the family', () => {
  const job = (x: Cast, t: Character, status: 'offered' | 'active' | 'done', via: 'boss' | 'tip' = 'tip') => mkJob(x.w, { kind: 'handle', title: 'See to a man', brief: 'A man needs seeing to.', giver: t.id, via, assignee: x.p.id, target: x.rival.id, pay: 200, status, days: 14 } as never);
  const trouble = (t: Character, revealed = false) => { t.problem = { kind: 'gambling', sev: 0.5, since: 0, revealed } as never; };
  const light = (t: Character) => { t.books.arrears = 120; t.books.missed = 2; };
  const C: Case[] = [
    { name: 'is there work (a man of the family)', who: (x) => x.fam, old: 'work', node: 'orders', both: true },
    { name: 'is there work (his boss)', who: (x) => x.boss, old: 'work', node: 'orders' },
    { name: 'what he needs done', who: (x) => x.boss, old: 'b_need', node: 'myboss' },
    { name: 'a bigger piece', who: (x) => x.boss, old: 'b_more', node: 'myboss', both: true },
    { name: 'work he offers: taken', who: (x) => x.fam, setup: (x, t) => ({ j: job(x, t, 'offered').id }), old: (s) => 'jobtake:' + s.j },
    { name: 'work he offers: passed', who: (x) => x.fam, setup: (x, t) => ({ j: job(x, t, 'offered').id }), old: (s) => 'jobpass:' + s.j },
    { name: 'work he offers: raised', who: (x) => x.fam, setup: (x, t) => ({ j: job(x, t, 'offered').id }), old: (s) => 'f:job:' + s.j, now: (s) => 'job:' + s.j },
    { name: 'reporting work done', who: (x) => x.fam, setup: (x, t) => { job(x, t, 'done'); }, old: 'report', node: 'orders' },
    { name: 'asking why', who: (x) => x.boss, setup: (x, t) => ({ j: job(x, t, 'active', 'boss').id }), old: (s) => 'challenge:' + s.j, node: 'orders' },
    { name: 'refusing an order', who: (x) => x.boss, setup: (x, t) => ({ j: job(x, t, 'active', 'boss').id }), old: (s) => 'refuse:' + s.j, node: 'orders' },
    { name: 'where you stand', who: (x) => x.boss, old: 'b_stand', node: 'myboss' },
    { name: 'a word put in', who: (x) => x.fam, old: 'recommend', node: 'family', both: true },
    { name: 'backing: asked', who: (x) => x.fam, old: 'rk_back' },
    { name: 'backing: asked, with a favour he owes', who: (x) => x.fam, setup: (x, t) => { addFavour(x.w, x.p.id, t.id, 1, 'a good turn'); }, old: 'rk_back' },
    { name: 'backing: what he needs to see', who: (x) => x.fam, old: 'fl:back_what', now: 'back_what', node: 'follow' },
    { name: 'backing: the favour called in', who: (x) => x.fam, setup: (x, t) => { addFavour(x.w, x.p.id, t.id, 1, 'a good turn'); }, old: 'fl:back_call', now: 'back_call', node: 'follow' },
    { name: 'backing: on his terms', who: (x) => x.fam, old: 'fl:back_take', now: 'back_take', node: 'follow' },
    { name: 'backing: haggled', who: (x) => x.fam, setup: (x) => { x.p.standing = 60; }, old: 'fl:back_press', now: 'back_press', node: 'follow', both: true },
    { name: 'what my backer has said', who: (x) => x.fam, setup: (x, t) => { x.p.backer = t.id; }, old: 'rk_back_ask' },
    { name: 'a concern about a man', who: (x) => x.boss, setup: (x) => ({ y: x.crew.id }), old: (s) => 'concern:' + s.y, node: 'pick_concern', both: true },
    { name: 'my man: what is wrong', who: (x) => x.crew, setup: (_x, t) => { trouble(t); }, old: 'cr_ask', node: 'crew', both: true },
    { name: 'my man: money for his trouble', who: (x) => x.crew, setup: (x, t) => { trouble(t, true); x.p.cash = 3000; }, old: 'cr_cash', node: 'crew' },
    { name: 'my man: lighter duties', who: (x) => x.crew, setup: (_x, t) => { trouble(t, true); }, old: 'cr_duties', node: 'crew' },
    { name: 'my man: a light envelope', who: (x) => x.crew, setup: (_x, t) => { light(t); trouble(t); }, old: 'cr_drop', node: 'crew' },
    { name: 'my man: looking into it', who: (x) => x.crew, setup: (_x, t) => { light(t); trouble(t); }, old: 'cr_look', node: 'crew', ctx: () => ({ asked: ['cr_drop'] }), th: () => ({ asked: ['cr_drop'] }) },
    { name: 'my man: thin ice', who: (x) => x.crew, setup: (_x, t) => { trouble(t); }, old: 'cr_thin', node: 'crew', both: true },
    { name: 'thin ice: a good week', who: (x) => x.crew, old: 'fl:th_ease', now: 'th_ease', node: 'follow' },
    { name: 'thin ice: listening', who: (x) => x.crew, setup: (_x, t) => { trouble(t); }, old: 'fl:th_hear', now: 'th_hear', node: 'follow' },
    { name: 'thin ice: it stands', who: (x) => x.crew, old: 'fl:th_hold', now: 'th_hold', node: 'follow' },
    { name: 'thin ice: backing down', who: (x) => x.crew, old: 'fl:th_back', now: 'th_back', node: 'follow' },
    { name: 'thin ice: pushing', who: (x) => x.crew, old: 'fl:th_push', now: 'th_push', node: 'follow' },
    { name: 'my man: keep your head down', who: (x) => x.crew, setup: (_x, t) => { light(t); }, old: 'assign_low', node: 'orders', both: true },
    { name: 'my man: find some extra', who: (x) => x.crew, old: 'assign_hustle', node: 'orders' },
    { name: 'an order insisted on', who: (x) => x.crew, old: 'fl:ord_insist:assign_low', now: 'ord_insist:assign_low', node: 'follow' },
    { name: 'an order let go', who: (x) => x.crew, old: 'fl:ord_ok:assign_hustle', now: 'ord_ok:assign_hustle', node: 'follow' },
    { name: 'taking a man on', who: (x) => x.shop, setup: (x, t) => { t.prospect = true; x.p.rank = 'soldier'; x.p.cash = 1000; }, old: 'recruit_offer' },
  ];
  for (const cs of C) ok(cs.name, { tags: ['compat'] }, () => check(cs));
});

describe('Gate 4 parity, Stage D: having things out, his ask, and what is on his mind', () => {
  const D: Case[] = [
    { name: 'demanding an explanation', who: (x) => x.fam, setup: (x, t) => { t.cash = 900; return { f: event(x.w, 'robbery', t, x.p, [{ c: x.p, actor: true }, { c: t, actor: true }], 300).id }; }, old: (s) => 'demand:' + s.f, node: 'disputes', both: true },
    { name: 'he lied, and the player knows', who: (x) => x.fam, setup: (x, t) => { const f = event(x.w, 'beating', t, x.shop, [{ c: t, actor: true }]); x.p.known[f.id] = { t: 0, from: x.boss.id, knowsActor: true }; (t.denied ??= {})[f.id] = 0; t.traits.courage = 0.8; return { f: f.id }; }, old: (s) => 'confront:' + s.f, both: true },
    { name: 'the bad blood, raised', who: (x) => x.fam, setup: (x, t) => { rel(t, x.p.id).grudge = 0.4; }, old: 'f:amends', now: 'amends' },
    { name: 'clearing the air: owning up', who: (x) => x.fam, setup: (x, t) => ({ f: event(x.w, 'beating', x.p, t, [{ c: t, actor: true }]).id }), old: (s) => 'a_own:' + s.f, node: 'amends' },
    { name: 'paying to make it right', who: (x) => x.fam, setup: (x, t) => { x.p.cash = 2000; return { f: event(x.w, 'beating', x.p, t, [{ c: t, actor: true }], 200).id }; }, old: (s) => 'a_pay:' + s.f, node: 'amends' },
    { name: 'he started it', who: (x) => x.fam, setup: (x, t) => { event(x.w, 'beating', t, x.p, [{ c: x.p, actor: true }]); t.traits.violence = 0.7; return { f: event(x.w, 'beating', x.p, t, [{ c: t, actor: true }]).id }; }, old: (s) => 'a_start:' + s.f, node: 'amends', both: true },
    { name: 'I would do it again', who: (x) => x.fam, setup: (x, t) => ({ f: event(x.w, 'beating', x.p, t, [{ c: t, actor: true }]).id }), old: (s) => 'a_defy:' + s.f, node: 'amends' },
    { name: 'what has he got against me', who: (x) => x.fam, setup: (x, t) => { rel(t, x.p.id).grudge = 0.4; }, old: 'a_ask', node: 'amends' },
    { name: 'a drink to let it lie', who: (x) => x.fam, setup: (x, t) => { rel(t, x.p.id).grudge = 0.4; }, old: 'a_gift', node: 'amends' },
    { name: 'a broken word, made right', who: (x) => x.fam, setup: (x, t) => { addFact(x.w, { kind: 'ruling', actor: x.p.id, victim: t.id, text: `${x.p.name} did not keep his word to ${t.name}.`, district: t.district }, { witnesses: [] }); }, old: 'word_make' },
    { name: 'what is outstanding: a promise', who: (x) => x.fam, setup: (x, t) => { const j = mkJob(x.w, { kind: 'handle', title: 'x', brief: 'x', giver: t.id, via: 'tip', assignee: x.p.id, target: x.rival.id, pay: 0, status: 'done', days: 14 } as never); t.memos.push({ id: 'mm1', t: 0, other: x.p.id, kind: 'promise', text: 'You promised.', ref: j.id }); }, old: 'memo:mm1', node: 'memos' },
    { name: 'what is outstanding: a threat', who: (x) => x.fam, setup: (x, t) => { t.memos.push({ id: 'mm2', t: 0, other: x.p.id, kind: 'threat', text: 'You threatened him.' }); }, old: 'memo:mm2', node: 'memos' },
    { name: 'what was found out', who: (x) => x.shop, setup: (x, t) => { const f = event(x.w, 'robbery', x.rival, t, [{ c: x.p, actor: true }]); t.memos.push({ id: 'mm3', t: 0, other: x.p.id, kind: 'question', text: 'Find out.', ref: f.id }); }, old: 'answer:mm3', node: 'memos' },
    { name: 'warning a rival off', who: (x) => x.rival, old: 'rv_warn', node: 'rival' },
    { name: 'easing the warning', who: (x) => x.rival, old: 'fl:rv_ease', now: 'rv_ease', node: 'follow' },
  ];
  for (const cs of D) ok(cs.name, { tags: ['compat'] }, () => check(cs));
  // what he has come to ask (an encounter of his), answered, put off, or turned away
  const asks = (x: Cast, t: Character) => ({ e: addEnc(x.w, { kind: 'crew', from: t.id, title: 'A word', lines: [`${t.name} wants a word.`, '"Can you lend me a hand?"'], opts: [{ code: 'no', label: 'No', hint: 'x' }], data: { what: 'none' } } as never).id });
  const E: Case[] = [
    { name: 'his ask: answered', who: (x) => x.fam, setup: asks, old: (s) => `enc:${s.e}:no` },
    { name: 'his ask: can it wait', who: (x) => x.fam, setup: asks, old: (s) => `apx:wait:${s.e}` },
    { name: 'his ask: not now', who: (x) => x.fam, setup: asks, old: (s) => `apx:no:${s.e}` },
  ];
  for (const cs of E) ok(cs.name, { tags: ['compat'] }, () => check(cs));
  // what is on his mind (conv/subjects): raised, and answered
  const troubled = (_x: Cast, t: Character) => { t.problem = { kind: 'gambling', sev: 0.6, since: 0, revealed: true } as never; t.traits.vice = 0.7; };
  const T: Case[] = [
    { name: 'his trouble: raised', who: (x) => x.crew, setup: troubled, old: 'tk:trouble' },
    { name: 'his trouble: pressed', who: (x) => x.crew, setup: (x, t) => { troubled(x, t); t.problem!.revealed = false; }, old: 'tk:trouble:press' },
    { name: 'his trouble: money, no strings', who: (x) => x.crew, setup: (x, t) => { troubled(x, t); x.p.cash = 3000; }, old: 'tk:trouble:gift' },
    { name: 'his trouble (on his mind): a loan', who: (x) => x.crew, setup: (x, t) => { troubled(x, t); x.p.cash = 3000; }, old: 'tk:trouble:lend' },
    { name: 'his trouble: straighten out', who: (x) => x.crew, setup: troubled, old: 'tk:trouble:straighten' },
    { name: 'his trouble: listened to', who: (x) => x.crew, setup: troubled, old: 'tk:trouble:listen' },
    { name: 'his shop: raised', who: (x) => x.shop, old: 'tk:shop' },
    { name: 'his shop: a place like this could use friends', who: (x) => x.shop, old: 'tk:shop:friends' },
    { name: 'his shop: money put in', who: (x) => x.shop, setup: (x) => { x.p.cash = 3000; }, old: 'tk:shop:invest' },
    { name: 'what he wants: raised', who: (x) => x.crew, setup: (_x, t) => { t.want = { kind: 'made', since: 0 }; }, old: 'tk:want' },
    { name: 'what he wants: not ready', who: (x) => x.crew, setup: (_x, t) => { t.want = { kind: 'made', since: 0 }; }, old: 'tk:want:doubt' },
    { name: 'what he wants: a stake', who: (x) => x.crew, setup: (x, t) => { t.want = { kind: 'rich', since: 0 }; t.cash = 100; x.p.cash = 5000; }, old: 'tk:want:fund' },
    { name: 'a man he cannot stand: raised', who: (x) => x.fam, setup: (x, t) => { rel(t, x.boss.id).grudge = 0.6; return { o: x.boss.id }; }, old: (s) => 'tk:op:' + s.o },
    { name: 'a man he cannot stand: agreed with', who: (x) => x.fam, setup: (x, t) => { rel(t, x.boss.id).grudge = 0.6; return { o: x.boss.id }; }, old: (s) => `tk:op:${s.o}:agree`, both: true },
    { name: 'a man he cannot stand: defended', who: (x) => x.fam, setup: (x, t) => { rel(t, x.boss.id).grudge = 0.6; return { o: x.boss.id }; }, old: (s) => `tk:op:${s.o}:defend` },
    { name: 'his boss: raised', who: (x) => x.fam, setup: (x, t) => { if (t.bossId) rel(t, t.bossId).grudge = 0.4; }, old: 'tk:boss' },
    { name: 'his boss: loyal', who: (x) => x.fam, setup: (x, t) => { if (t.bossId) rel(t, t.bossId).grudge = 0.4; }, old: 'tk:boss:loyal' },
    { name: 'his money, light: raised', who: (x) => x.crew, setup: (_x, t) => { t.books.arrears = 200; t.books.history.push({ week: 0, gross: 300, due: 100, paid: 40, expected: 300, declared: 200, tone: 'underreported' } as never); }, old: 'tk:earn' },
    { name: 'his money, light: make it up', who: (x) => x.crew, setup: (_x, t) => { t.cash = 500; t.books.arrears = 200; t.books.history.push({ week: 0, gross: 300, due: 100, paid: 40, expected: 300, declared: 200, tone: 'underreported' } as never); }, old: 'tk:earn:makeup' },
    { name: 'his money, light: a week', who: (x) => x.crew, setup: (_x, t) => { t.books.arrears = 200; t.books.history.push({ week: 0, gross: 300, due: 100, paid: 40, expected: 300, declared: 200, tone: 'underreported' } as never); }, old: 'tk:earn:week' },
    { name: 'his money, light: a warning', who: (x) => x.crew, setup: (_x, t) => { t.books.arrears = 200; t.books.history.push({ week: 0, gross: 300, due: 100, paid: 40, expected: 300, declared: 200, tone: 'underreported' } as never); }, old: 'tk:earn:warn' },
    { name: 'a debt owed him: pay now', who: (x) => x.fam, setup: (x, t) => ({ d: (t.cash = 600, createDebt(x.w, x.p.id, t.id, 500, 0.05, 'a loan')).id }), old: (s) => `tk:debt:${s.d}:now` },
    { name: 'a debt owed him: leaned on', who: (x) => x.fam, setup: (x, t) => ({ d: (t.cash = 600, createDebt(x.w, x.p.id, t.id, 500, 0.05, 'a loan')).id }), old: (s) => `tk:debt:${s.d}:lean` },
    { name: 'a debt owed him: forgiven', who: (x) => x.fam, setup: (x, t) => ({ d: createDebt(x.w, x.p.id, t.id, 500, 0.05, 'a loan').id }), old: (s) => `tk:debt:${s.d}:forgive` },
    { name: 'a debt I owe him: paid', who: (x) => x.fam, setup: (x, t) => { x.p.cash = 3000; return { d: createDebt(x.w, t.id, x.p.id, 500, 0.05, 'a loan').id }; }, old: (s) => `tk:debt:${s.d}:pay` },
    { name: 'which places are hurting', who: (x) => x.fam, old: 'tk:hurting' },
  ];
  for (const cs of T) ok(cs.name, { tags: ['compat'] }, () => check(cs));
});
