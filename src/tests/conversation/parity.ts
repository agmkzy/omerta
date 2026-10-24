// Gate 4 parity: the same interaction run by the old engine (dialogue.say) and by the conversation layer (conv/run.perform), each on
// its own copy of one world, and everything either changed compared: money, regard, what each man knows, memos, cooldowns, insight,
// what he remembers being asked, facts, debts, favours, jobs, grievances, situations, families, businesses, the dice. Only the record
// of a story line's wording and the ledger are compared apart (the layer posts every movement of money; the old engine did not).
// Removed with the old engine at the end of Gate 4: from then the parity cases stand as the gameplay record (see parity.test.ts).
import { deserialize, serialize } from '../../engine';
import { say, startConvo, type Convo } from '../../dialogue';
import { ctx, newThread, type Visit } from '../../conv/kit';
import { perform } from '../../conv/run';
import type { World } from '../../types';

const r3 = (x: unknown) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);
// What an interaction can change, as one flat map of path → value
export function state(w: World): Map<string, unknown> {
  const m = new Map<string, unknown>(), put = (k: string, v: unknown) => { if (v !== undefined) m.set(k, typeof v === 'object' && v !== null ? JSON.stringify(v, (_k, x) => r3(x)) : r3(v)); };
  for (const c of Object.values(w.chars)) {
    const k = `char.${c.id}`;
    put(k + '.cash', c.cash); put(k + '.heat', c.heat); put(k + '.standing', c.standing); put(k + '.backer', c.backer); put(k + '.bossId', c.bossId); put(k + '.rank', c.rank);
    put(k + '.want', c.want); put(k + '.problem', c.problem); put(k + '.intro', c.intro); put(k + '.denied', c.denied); put(k + '.insight', c.insight); put(k + '.books', c.books);
    for (const [o, r] of Object.entries(c.rels)) for (const f of ['trust', 'affection', 'respect', 'grudge', 'fear', 'known', 'lastMet'] as const) put(`${k}.rel.${o}.${f}`, (r as unknown as Record<string, number>)[f]);
    for (const [f, kn] of Object.entries(c.known)) put(`${k}.known.${f}`, { a: kn.knowsActor, from: kn.from, blame: kn.blame });
    for (const mm of c.memos) put(`${k}.memo.${mm.id}`, { kind: mm.kind, other: mm.other, text: mm.text, due: mm.due, ref: mm.ref, done: mm.done });
    for (const [ck, v] of Object.entries(c.cooldown)) if (!/^say:/.test(ck)) put(`${k}.cool.${ck}`, v);
    for (const [tk, v] of Object.entries(c.talk ?? {})) put(`${k}.talk.${tk}`, v);
  }
  for (const f of Object.values(w.facts)) put(`fact.${f.id}`, { kind: f.kind, actor: f.actor, victim: f.victim, story: f.story, minor: f.minor, amount: f.amount, business: f.business });
  for (const d of w.debts) put(`debt.${d.id}`, d);
  for (const f of w.favours) put(`favour.${f.id}`, f);
  for (const j of w.jobs) put(`job.${j.id}`, j);
  for (const g of w.grievances) put(`grievance.${g.id}`, g);
  for (const s of w.situations ?? []) put(`sit.${s.id}`, { ...s, log: undefined });
  for (const e of w.enc) put(`enc.${e.id}`, { status: e.status, expires: e.expires });
  for (const f of Object.values(w.fam)) put(`fam.${f.id}.tension`, f.tension);
  for (const b of Object.values(w.biz)) { put(`biz.${b.id}.cash`, b.cash); put(`biz.${b.id}.protection`, b.protection); put(`biz.${b.id}.owner`, b.ownerId); }
  for (const d of w.disputes ?? []) put(`dispute.${d.id}`, { status: d.status, handled: d.handled, seen: d.seen });
  put('ventures', w.ventures.length); put('nextId', w.nextId); put('rng', w.rng.state); put('meetings', (w as unknown as { meetings?: unknown[] }).meetings?.length);
  return m;
}
export function diff(a: Map<string, unknown>, b: Map<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) if (a.get(k) !== b.get(k)) out.push(`${k}: ${String(a.get(k))} → ${String(b.get(k))}`);
  return out.sort();
}
export interface Run { w: World; lines: string[]; changed: string[]; ledger: number }
// the old engine, as the old screen called it: a conversation at a node, with what was in hand
export function legacy(w0: World, npc: string, code: string, at: Partial<Convo> = {}): Run {
  const w = deserialize(serialize(w0)), before = state(w), led = (w.ledger?.length ?? 0);
  const c0 = startConvo(npc), c: Convo = { ...c0, ...at, ctx: { ...c0.ctx, ...(at.ctx ?? {}) } };
  const r = say(w, w.chars[w.playerId!], w.chars[npc], c, code);
  return { w, lines: r.lines, changed: diff(before, state(w)), ledger: (w.ledger?.length ?? 0) - led };
}
// the conversation layer: the same thing said in a visit, with what is in hand
export function layer(w0: World, npc: string, code: string, th: Partial<Visit['th']> = {}, label = '…'): Run {
  const w = deserialize(serialize(w0)), before = state(w), led = (w.ledger?.length ?? 0);
  const v: Visit = { npc, where: '', t0: w.now, lines: [], choices: [], relation: '', mem: { said: [], argued: [], pressed: 0, points: [], offered: {} }, th: { ...newThread(), ...th } };
  perform(ctx(w, v), code, label);
  return { w, lines: v.lines.map((l) => l.text), changed: diff(before, state(w)), ledger: (w.ledger?.length ?? 0) - led };
}
// what differs between the two runs' effects (both started from the same world): the paths, with each side's final value
// (named differences: the old engine, listing its menus, made an empty relationship record, at the default values, for every man it
// looked at; the layer reads without writing. A default record and none are the same footing.)
export const DEFAULT_REL = /\.rel\.[^.]+\.(?:(affection: 0\.1|grudge: 0|lastMet: -1000000000|respect: 0\.3|trust: 0\.1) → undefined|(affection|grudge|lastMet|respect|trust): undefined → (0\.1|0|-1000000000|0\.3))$/;
export function parity(a: Run, b: Run, allow: RegExp[] = []): string[] {
  const sa = state(a.w), sb = state(b.w);
  return diff(sa, sb).filter((d) => !DEFAULT_REL.test(d) && !allow.some((re) => re.test(d)));
}
