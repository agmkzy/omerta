// V79: the conversation crawler. Random walks through every menu, for many men at every level of trust, checking that nothing
// breaks, nothing is a dead end, nothing is said twice for a reward, and nobody talks like a database. DUMP=file writes every problem found.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { writeFileSync } from 'node:fs';
import { deserialize, serialize } from '../../engine';
import { World } from '../../types';
import { options, say, startConvo, arrive, isNavCode, Convo } from '../../dialogue';
import { whereIs } from '../../where';
import { Rng } from '../../rng';
import { world60 } from './fixtures';

const P = (w: World) => w.chars[w.playerId!];
const men = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1));

const DEV = /undefined|NaN|\[object|\bnull\b|knowsActor|textHidden|first-hand|The matter|Which incident|Day \d+ \d\d:\d\d|\bfact\b|\brecord(?:s|ed)?\b(?! of)|cooldown|\bctx\b/;
const stateOf = (w: World, t: { id: string }) => { const p = P(w), q = w.chars[t.id].rels[p.id], m = p.rels[t.id]; return JSON.stringify([q?.trust, q?.affection, q?.respect, q?.grudge, m?.trust, p.cash, p.standing, p.heat, w.chars[t.id].cash, w.now]); };

interface Walk { transcript: string[]; steps: number; ended: boolean; problems: string[] }
function walk(seed: number, id: string, trust: number, steps = 22): Walk {
  const w = world60(); const p = P(w), t = w.chars[id];
  (p.intro ??= {})[id] = w.now;
  const r = (t.rels[p.id] ??= { trust: 0, affection: 0, respect: 0.3, grudge: 0, lastMet: -1e9 } as never) as { trust: number; affection: number; grudge: number };
  r.trust = trust; r.affection = Math.min(1, trust + 0.05); r.grudge = trust < 0.1 ? 0.35 : 0;
  const rng = new Rng(seed * 7919 + id.length);
  const out: Walk = { transcript: [], steps: 0, ended: false, problems: [] };
  const bad = (m: string) => out.problems.push(`${t.name} (trust ${trust}) seed ${seed}: ${m}`);
  let convo: Convo = arrive(w, p, t, { lines: [] }, whereIs(w, p, t), -1e9).convo;
  const spoken = new Map<string, number>();
  for (let i = 0; i < steps; i++) {
    let os;
    try { os = options(w, p, t, convo); } catch (e) { bad(`options threw at ${convo.node}: ${(e as Error).message}`); return out; }
    if (!os.length) { bad(`no options at node ${convo.node}`); return out; }
    const live = os.filter((o) => !o.done);
    if (!live.some((o) => o.code === 'root' || isNavCode(o.code))) bad(`dead end at ${convo.node}: ${live.map((o) => o.label).join(' | ')}`);
    const labels = os.filter((o) => !isNavCode(o.code)).map((o) => o.label);
    if (new Set(labels).size !== labels.length) bad(`duplicate options at ${convo.node}: ${labels.filter((l, k) => labels.indexOf(l) !== k).join(' | ')}`);
    for (const o of os) { if (DEV.test(o.label) || DEV.test(o.hint ?? '')) bad(`database wording in option "${o.label}" / "${o.hint ?? ''}"`); if (o.label.length > 110) bad(`very long option "${o.label.slice(0, 40)}…"`); if (!o.label.trim()) bad(`empty option label for ${o.code}`); }
    // a used option can be forced, and must pay nothing
    const done = os.find((o) => o.done);
    if (done) {
      const before = stateOf(w, t);
      const s = say(w, p, t, convo, done.code);
      if (stateOf(w, t) !== before) bad(`repeating "${done.label}" changed the relationship, money or time`);
      if (!s.lines.length) bad(`repeating "${done.label}" gave no reply`);
    }
    const pick = rng.pick(live.filter((o) => !(o.code === 'root' && convo.node === 'root' && i < steps - 1) || rng.chance(0.05)).length ? live.filter((o) => !(o.code === 'root' && convo.node === 'root' && i < steps - 1) || rng.chance(0.05)) : live);
    let s;
    try { s = say(w, p, t, convo, pick.code); } catch (e) { bad(`say threw on "${pick.label}" (${pick.code}) at ${convo.node}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' ')}`); return out; }
    out.steps++; out.transcript.push(`> ${pick.label}`, ...s.lines);
    if (s.meeting) { out.ended = true; return out; }
    if (!s.lines.length && !isNavCode(pick.code)) bad(`"${pick.label}" (${pick.code}) produced no reply at ${convo.node}`);
    for (const l of s.lines) {
      if (!l.trim()) bad(`blank line after "${pick.label}"`);
      if (DEV.test(l)) bad(`database wording in line "${l.slice(0, 120)}" after "${pick.label}"`);
      // he never calls himself by his own name when he talks
      for (const q of l.matchAll(/["“]([^"“”]+)["”]/g)) if (q[1].includes(t.name)) bad(`${t.name} names himself aloud: "${q[1].slice(0, 100)}"`);
      if (!l.startsWith('⟡') && l.length > 30) { const n = (spoken.get(l) ?? 0) + 1; spoken.set(l, n); if (n > 1) bad(`line repeated in one conversation: "${l.slice(0, 90)}"`); }
    }
    // what he has just told you he must himself know; and nothing is written twice
    for (const [fid, k] of Object.entries(p.known)) if (k.from === t.id && !t.known[fid]) bad(`he told you something he does not know himself: ${w.facts[fid]?.text?.slice(0, 80)}`);
    { const seen = new Set<string>(); for (const m of t.memos) { if (m.done || m.other !== p.id) continue; const key = m.kind + m.text; if (seen.has(key)) bad(`duplicate open memo "${m.text.slice(0, 60)}"`); seen.add(key); } }
    { const open = w.grievances.filter((g) => g.status === 'open'); const keys = open.map((g) => g.from + '>' + g.about + '>' + g.cause); if (new Set(keys).size !== keys.length) bad('duplicate open grievance'); }
    { const ds = w.debts.filter((d) => d.status === 'active').map((d) => d.creditor + '>' + d.debtor + '>' + d.reason); if (new Set(ds).size !== ds.length && ds.length < 40) bad('duplicate active debt records'); }
    if (!s.convo) { out.ended = true; return out; }
    // whatever he was given, the option just used shows as used if it is offered again
    if (!isNavCode(pick.code)) { const again = options(w, p, t, s.convo).find((o) => o.code === pick.code); if (again && !again.done) bad(`"${pick.label}" is offered again and not greyed out`); }
    convo = s.convo;
  }
  return out;
}

function fast() {
  const w0 = world60();
  const ms = men(w0);
  const sample = [...ms.filter((m) => m.rank !== 'civilian').slice(0, 24), ...ms.filter((m) => m.rank === 'civilian').slice(0, 10)];

  ok('crawl: nothing throws, nothing dead-ends, nothing is said twice, nobody names himself or talks like a database', { tags: ['property'] }, () => {
    const problems: string[] = [];
    let steps = 0;
    for (const m of sample) for (const tr of [0.05, 0.35, 0.85]) for (let seed = 1; seed <= 3; seed++) {
      const r = walk(seed, m.id, tr);
      steps += r.steps; problems.push(...r.problems);
    }
    assert.ok(steps > 1500, `only ${steps} steps walked`);
    const uniq = [...new Set(problems.map((x) => x.replace(/^.*?seed \d+: /, '')))];
    if (process.env.DUMP) writeFileSync(process.env.DUMP, uniq.join('\n'));
    assert.deepEqual(uniq.slice(0, 12), [], `${problems.length} problems, ${uniq.length} kinds:\n` + uniq.slice(0, 12).join('\n'));
  });

  ok('crawl is deterministic: the same walk gives the same conversation', { tags: ['determinism'] }, () => {
    for (const m of sample.slice(0, 6)) {
      const a = walk(2, m.id, 0.5), b = walk(2, m.id, 0.5);
      assert.deepEqual(a.transcript, b.transcript, m.name);
    }
  });

  ok('what is said persists through save and reload: memory, promises, backing and the used-option rule', { tags: ['determinism'] }, () => {
    const w = world60(); const p = P(w); const m0 = sample.find((x) => x.rank === 'soldier' && x.familyId === p.familyId) ?? sample.find((x) => x.rank === 'soldier')!; const m = w.chars[m0.id];
    (p.intro ??= {})[m.id] = w.now;
    const r = (m.rels[p.id] ??= { trust: 0.7, affection: 0.7, respect: 0.6, grudge: 0, lastMet: -1e9 } as never) as { trust: number; respect: number; affection: number };
    r.trust = 0.7; r.respect = 0.6;
    let c = startConvo(m.id);
    say(w, p, m, c, 'how');
    const talkBefore = JSON.stringify(m.talk);
    const w2 = deserialize(serialize(w));
    assert.equal(JSON.stringify(w2.chars[m.id].talk), talkBefore, 'conversational memory survives a save ' + m.name + ' ' + talkBefore + ' => ' + JSON.stringify(w2.chars[m.id].talk));
    const again = say(w2, w2.chars[w2.playerId!], w2.chars[m.id], startConvo(m.id), 'how');
    assert.match(again.lines[0], /already|changed|enough|same|ask/i, 'and he remembers after reload: ' + again.lines[0]);
  });

  ok('backing: asking, pressing and agreeing records one favour and one backer, never twice', { tags: ['scenario'] }, () => {
    const w = world60(); const p = P(w);
    const m = men(w).find((x) => x.rank === 'capo' && x.familyId === p.familyId && x.id !== p.bossId);
    if (!m || p.rank !== 'associate') return;
    (p.intro ??= {})[m.id] = w.now;
    const rr = (m.rels[p.id] ??= { trust: 0.7, affection: 0.7, respect: 0.6, grudge: 0, lastMet: -1e9 } as never) as { trust: number; respect: number };
    rr.trust = 0.7; rr.respect = 0.6;
    let c = startConvo(m.id);
    let s = say(w, p, m, c, 'rk_back'); c = s.convo!;
    const owed0 = w.favours.length;
    s = say(w, p, m, c, 'fl:back_take'); c = s.convo ?? c;
    assert.equal(p.backer, m.id);
    assert.equal(w.favours.length, owed0 + 1, 'one favour written');
    const s2 = say(w, p, m, c, 'fl:back_take');
    assert.equal(w.favours.length, owed0 + 1, 'a repeat writes nothing');
    assert.ok(s2.lines.length);
    const s3 = say(w, p, m, startConvo(m.id), 'rk_back');
    assert.equal(w.favours.length, owed0 + 1, 'asking again later writes nothing');
    assert.match(s3.lines.join(' '), /already/i);
  });

  ok('a man of lower rank cannot be threatened without consequence, a rival warned off costs tension, and a recruit costs once', { tags: ['scenario'] }, () => {
    const w = world60(); const p = P(w);
    const crew = men(w).find((x) => x.rank === 'associate' && x.id !== p.id);
    if (crew) { crew.bossId = p.id; (p.intro ??= {})[crew.id] = w.now; const t0 = crew.rels[p.id]?.trust ?? 0.1; const s = say(w, p, crew, startConvo(crew.id), 'cr_thin'); assert.ok(s.lines.length); const s2 = say(w, p, crew, startConvo(crew.id), 'cr_thin'); assert.match(s2.lines.join(' '), /already|told/i, 'a second threat the same week is not a second threat'); assert.ok((crew.rels[p.id]?.trust ?? 0) <= t0 + 0.0001); }
    const riv = men(w).find((x) => x.rank !== 'civilian' && x.familyId && x.familyId !== p.familyId);
    if (riv && p.familyId) { (p.intro ??= {})[riv.id] = w.now; const before = w.fam[p.familyId].tension[riv.familyId!] ?? 0; say(w, p, riv, startConvo(riv.id), 'rv_warn'); assert.ok((w.fam[p.familyId].tension[riv.familyId!] ?? 0) >= before, 'tension does not fall from a warning'); }
    const pr = men(w).find((x) => x.prospect && x.rank === 'civilian');
    if (pr && p.rank !== 'civilian') { (p.intro ??= {})[pr.id] = w.now; const cash0 = p.cash; let c = startConvo(pr.id); let s = say(w, p, pr, c, 'recruit_offer'); c = s.convo!; s = say(w, p, pr, c, 'fl:rc_more'); if (pr.rank === 'associate') { assert.ok(cash0 - p.cash <= 300 + 1, 'costs once'); assert.equal(pr.bossId, p.id); } }
  });

  ok('a used option is greyed out for the rest of the conversation, and a new conversation starts clean', { tags: ['unit'] }, () => {
    const w = world60(); const p = P(w); const m = sample.find((x) => x.rank === 'soldier') ?? sample[0];
    (p.intro ??= {})[m.id] = w.now;
    let c = startConvo(m.id);
    const first = options(w, p, m, c).find((o) => o.code === 'how')!;
    assert.ok(first && !first.done);
    const s = say(w, p, m, c, 'how'); c = s.convo!;
    assert.ok(options(w, p, m, c).find((o) => o.code === 'how')!.done, 'greyed after use');
    const before = stateOf(w, m);
    const again = say(w, p, m, c, 'how');
    assert.equal(stateOf(w, m), before, 'a repeat pays nothing');
    assert.match(again.lines[0], /already/);
    const fresh2 = startConvo(m.id);
    assert.ok(!options(w, p, m, fresh2).find((o) => o.code === 'how')?.done, 'a new conversation starts clean');
  });
}
describe('conversation crawler', fast);
