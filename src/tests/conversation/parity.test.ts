// Gate 4: side-effect parity between the old engine and the conversation layer, interaction by interaction, on several worlds and at
// several levels of trust (so both sides of every decision are taken). An empty difference is parity; where the layer deliberately
// differs (the ledger now records money the old engine moved by hand) the difference is named, not hidden.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact } from '../../core';
import { feelToOn, rel } from '../../core';
import { DAY, type Character, type World } from '../../types';
import { newWorld, P } from '../helpers';
import { layer, legacy, parity } from './parity';

const SEEDS = [3, 7, 11];
const TRUST = [0.1, 0.4, 0.75];
// the men a conversation is had with: his boss, a man of his own family, one of another family, a shopkeeper, and one of his own crew
function cast(seed: number) {
  const w = newWorld(seed), p = P(w), alive = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer);
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
    { name: 'where he heard it', who: (x) => x.fam, setup: (x, t) => { const f = event(x.w, 'beating', x.p, x.rival, []); t.known[f.id] = { t: x.w.now, from: x.boss.id, knowsActor: true }; }, old: 'f_rep_who', node: 'follow' },
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
