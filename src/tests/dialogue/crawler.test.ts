// V79: the conversation crawler (since Gate 4, through the one conversation: conv/visit.ts). Random walks through every screen, for many men at every level of trust, checking that nothing
// breaks, nothing is a dead end, nothing is said twice for a reward, and nobody talks like a database. DUMP=file writes every problem found.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { writeFileSync } from 'node:fs';
import { deserialize, serialize } from '../../engine';
import { World } from '../../types';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { answered } from '../../conv/acts/words';
import { talk } from './fixtures';
import { openAsk, openAsks, stance } from '../../asks';
import { addEnc } from '../../encounters';
import { ownerBiz } from '../../core';
import { Rng } from '../../rng';
import { world60 } from './fixtures';

const P = (w: World) => w.chars[w.playerId!];
const men = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1));

const DEV = /undefined|NaN|\[object|\bnull\b|knowsActor|textHidden|first-hand|The matter|Which incident|Day \d+ \d\d:\d\d|\bfact\b|\brecord(?:s|ed)?\b(?! of)|cooldown|\bctx\b/;
const stateOf = (w: World, t: { id: string }) => { const p = P(w), q = w.chars[t.id].rels[p.id], m = p.rels[t.id]; return JSON.stringify([q?.trust, q?.affection, q?.respect, q?.grudge, m?.trust, p.cash, p.standing, p.heat, w.chars[t.id].cash, w.now]); };

const NAVIGATE = (id: string) => /^(u|all):/.test(id) || ['home', 'more', 'back', 'leave'].includes(id);
const hisLines = (v: Visit, from: number) => v.lines.slice(from).filter((l) => l.who !== 'you' && l.who !== 'card').map((l) => l.text);

interface Walk { transcript: string[]; steps: number; ended: boolean; problems: string[] }
function walk(seed: number, id: string, trust: number, steps = 22): Walk {
  const w = world60(); const p = P(w), t = w.chars[id];
  (p.intro ??= {})[id] = w.now;
  const r = (t.rels[p.id] ??= { trust: 0, affection: 0, respect: 0.3, grudge: 0, lastMet: -1e9 } as never) as { trust: number; affection: number; grudge: number };
  r.trust = trust; r.affection = Math.min(1, trust + 0.05); r.grudge = trust < 0.1 ? 0.35 : 0;
  const rng = new Rng(seed * 7919 + id.length);
  const out: Walk = { transcript: [], steps: 0, ended: false, problems: [] };
  const bad = (m: string) => out.problems.push(`${t.name} (trust ${trust}) seed ${seed}: ${m}`);
  const v = begin(w, id);
  const spoken = new Map<string, number>(), said = new Set<string>();
  for (const l of v.lines) if (l.who === 'him' && l.text.length > 30) spoken.set(l.text, 1);
  for (let i = 0; i < steps && !v.ended; i++) {
    const os = v.choices;
    if (!os.length) { bad('nothing to say'); return out; }
    if (!os.some((o) => o.id === 'leave')) bad(`no way out: ${os.map((o) => o.label).join(' | ')}`);
    const labels = os.filter((o) => !NAVIGATE(o.id)).map((o) => o.label);
    if (new Set(labels).size !== labels.length) bad(`duplicate choices: ${labels.filter((l, k) => labels.indexOf(l) !== k).join(' | ')}`);
    for (const o of os) { if (DEV.test(o.label) || DEV.test(o.note ?? '')) bad(`database wording in a choice "${o.label}" / "${o.note ?? ''}"`); if (o.label.length > 130) bad(`very long choice "${o.label.slice(0, 40)}…"`); if (!o.label.trim()) bad(`empty label for ${o.id}`); }
    // something already said in this visit can be said again, and pays nothing
    const again = [...said].find((x) => [...os, ...everything(w, v)].some((o) => o.id === x));
    if (again) { const before = stateOf(w, t), n0 = v.lines.length; choose(w, v, again); if (stateOf(w, t).replace(/,[^,]*\]$/, ']') !== before.replace(/,[^,]*\]$/, ']')) bad(`saying "${again}" again changed the relationship or money`); if (v.lines.length === n0) bad(`saying "${again}" again gave no reply`); if (v.ended) break; }
    // choose: mostly what is on screen (as it is now), now and then anything under the headings
    const now = v.choices;
    const pool = rng.chance(0.25) ? everything(w, v).filter((o) => o.id !== 'leave') : now.filter((o) => o.id !== 'leave' || rng.chance(0.05));
    const pick = rng.pick(pool.length ? pool : now);
    const n0 = v.lines.length;
    let res;
    try { res = choose(w, v, pick.amount ? `${pick.id}:${pick.amount.value}` : pick.id); } catch (e) { bad(`"${pick.label}" (${pick.id}) threw: ${(e as Error).stack?.split('\n').slice(0, 3).join(' ')}`); return out; }
    out.steps++; out.transcript.push(`> ${pick.label}`, ...v.lines.slice(n0).map((l) => l.text));
    if (res.meeting || res.settle) { out.ended = true; return out; }
    if (!NAVIGATE(pick.id)) {
      said.add(pick.id);
      const ls = hisLines(v, n0);
      if (!ls.length) bad(`"${pick.label}" (${pick.id}) produced no reply`);
      else if (!v.lines.slice(n0).some((l) => l.who === 'him' || answered(l.text, t.name.split(' ')[0]))) bad(`"${pick.label}" (${pick.id}) got no answer from him: ${ls.join(' / ').slice(0, 140)}`);
    }
    for (const l of v.lines.slice(n0)) {
      if (!l.text.trim()) bad(`blank line after "${pick.label}"`);
      if (DEV.test(l.text)) bad(`database wording in line "${l.text.slice(0, 120)}" after "${pick.label}"`);
      if (l.who === 'him') for (const q of l.text.matchAll(/["“]([^"“”]+)["”]/g)) if (q[1].includes(t.name)) bad(`${t.name} names himself aloud: "${q[1].slice(0, 100)}"`);
      if (l.who === 'him' && l.text.length > 30) { const n = (spoken.get(l.text) ?? 0) + 1; spoken.set(l.text, n); if (n > 1) bad(`line repeated in one conversation: "${l.text.slice(0, 90)}"`); }
    }
    // what he has just told you he must himself know; and nothing is written twice
    for (const [fid, k] of Object.entries(p.known)) if (k.from === t.id && !t.known[fid]) bad(`he told you something he does not know himself: ${w.facts[fid]?.text?.slice(0, 80)}`);
    { const seen = new Set<string>(); for (const m of t.memos) { if (m.done || m.other !== p.id) continue; const key = m.kind + m.text; if (seen.has(key)) bad(`duplicate open memo "${m.text.slice(0, 60)}"`); seen.add(key); } }
    { const open = w.grievances.filter((g) => g.status === 'open'); const keys = open.map((g) => g.from + '>' + g.about + '>' + g.cause); if (new Set(keys).size !== keys.length) bad('duplicate open grievance'); }
    { const ds = w.debts.filter((d) => d.status === 'active').map((d) => d.creditor + '>' + d.debtor + '>' + d.reason); if (new Set(ds).size !== ds.length && ds.length < 40) bad('duplicate active debt records'); }
  }
  out.ended = !!v.ended;
  return out;
}

// V90: the rules, walked. Men of every temperament (their traits drawn at random, so every combination turns up), in every kind of
// circumstance (a matter of yours with them, a request of theirs, bad blood, nothing at all), talked to at length, with the
// conversation's rules checked at every step rather than particular lines: what he says agrees with what he decided; the replies
// on screen answer the point he has just made; a request he breaks in with is answered before anything else; a man who has turned
// cold is offered no small talk; every statement is answered.
const REFUSE = /“(No[.,!]|I can’t[.!]|Then it’s no|Not interested)|still no|same answer|answer’s still|It’s still too much|I still can’t/i;
const AGREE = /We have a deal|That suits me|Fine\. Agreed|You’ll have it|“All right\. All right\.”|Asking\. All right|Why didn’t you say so/;
function rulesWalk(seed: number, id: string): string[] {
  const w = world60(), p = P(w), t = w.chars[id], rng = new Rng(seed * 104729 + id.length * 31);
  const bad: string[] = [], who = `${t.name} (seed ${seed})`;
  (p.intro ??= {})[id] = w.now; p.cash = 3000;
  for (const k of ['courage', 'caution', 'violence', 'ambition', 'greed', 'sociability'] as const) t.traits[k] = rng.next();
  const r = (t.rels[p.id] ??= { trust: 0.1, affection: 0.1, respect: 0.3, grudge: 0, lastMet: -1e9 });
  r.trust = rng.next() * 0.8; r.affection = rng.next() * 0.8; r.respect = rng.next(); r.grudge = rng.chance(0.3) ? rng.next() * 0.6 : 0; if (rng.chance(0.3)) r.fear = rng.next() * 0.8;
  const b = ownerBiz(w, t.id);
  if (b?.open && t.rank === 'civilian') { if (b.protection?.collectorId === p.id || rng.chance(0.5)) delete b.protection; openAsk(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round(b.income * (0.03 + rng.next() * 0.15) / 5) * 5) }); }
  else if (rng.chance(0.5)) openAsk(w, rng.chance(0.5) ? 'borrow' : 'recruit', p, t, { amt: 150 + Math.floor(rng.next() * 6) * 50 });
  let encAt = rng.chance(0.4) ? 2 + Math.floor(rng.next() * 6) : -1;
  const v = begin(w, id);
  for (let i = 0; i < 26 && !v.ended; i++) {
    if (i === encAt) { addEnc(w, { kind: 'loan', from: t.id, title: `${t.name.split(' ')[0]} needs a favour`, days: 4, lines: ['“While you’re here, I need two hundred until Friday.”'], opts: [{ code: 'yes', label: '“All right. Here.”', hint: 'He will owe you.' }, { code: 'no', label: '“Not this time.”', hint: 'He will remember.' }], data: {} }); encAt = -1; }
    const os = v.choices;
    if (!os.length) { bad.push(`${who}: nothing to say`); break; }
    // a cold man is offered no small talk
    if (v.th.cold && os.some((o) => o.id === 'news' || o.id === 'spend')) bad.push('small talk offered to a man who has turned cold');
    // the point he has just made is what the replies are about
    // (a request he has broken in with is the only thing in hand until it is answered: then nothing else is on screen)
    if (v.topic?.startsWith('enc:') && os.some((o) => o.group === 'reply' && !/^a:(enc|apx):/.test(o.id))) bad.push(`his request is mixed with other things: ${os.map((o) => o.id).join(',')}`);
    const sm = v.topic === 'act:m' || v.topic === 'act:mv' || v.topic === 'act:x' || v.topic === 'act:nm' ? openAsks(w).find((x) => x.terms?.by === p.id && x.terms?.of === t.id) : undefined;
    if (sm && ['claim', 'nottrue', 'nobooks'].includes(String(sm.m?.beat ?? '')) && os.some((o) => o.group === 'reply') && !os.some((o) => o.id.startsWith('a:x:') || (stance(w, sm, t.id).last === 'counter' && /:(take|sweeten)$/.test(o.id)))) bad.push(`he made a point (${sm.m?.beat}:${sm.m?.claim}) and nothing on screen answers it`);
    // choose: mostly the matter in hand, sometimes anything
    const inMatter = os.filter((o) => /^a:(mv|x|enc|m|enc_open):/.test(o.id));
    const pool = inMatter.length && rng.chance(0.65) ? inMatter : os.filter((o) => o.id !== 'leave' || rng.chance(0.04));
    const pick = rng.pick(pool.length ? pool : os);
    const mid = /^a:(mv|x):([^:]+):/.exec(pick.id)?.[2], n0 = v.lines.length;
    const res = choose(w, v, pick.amount ? `${pick.id}:${pick.amount.value}` : pick.id);
    if (res.meeting || res.settle) break;
    const ls = v.lines.slice(n0), his = ls.filter((l) => l.who === 'him').map((l) => l.text).join(' ');
    if (!NAVIGATE(pick.id) && ls.some((l) => l.who !== 'you') && !ls.some((l) => l.who === 'him' || answered(l.text, t.name.split(' ')[0]))) bad.push(`"${pick.label}" (${pick.id.split(':')[1]}) not answered: ${ls.map((l) => l.text).join(' / ').slice(0, 160)}`);
    if (mid) {
      const m = (w.situations ?? []).find((x) => x.id === mid), S = m ? stance(w, m, t.id) : undefined;
      const agreed = m?.stage === 'resolved' && ['agreed', 'gave in'].includes(m.out ?? '');
      if (agreed && REFUSE.test(his)) bad.push(`he agreed, but said: ${his.slice(0, 120)}`);
      if (m && m.stage !== 'resolved' && S?.last === 'no' && AGREE.test(his)) bad.push(`he refused, but said: ${his.slice(0, 120)}`);
    }
  }
  return bad;
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

  ok('the rules hold for men of every temperament, in every circumstance, at length', { tags: ['property'] }, () => {
    const w0 = world60(), all = Object.values(w0.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, 80).filter((m) => m.rank !== 'boss');
    const problems: string[] = [];
    for (const m of all) for (let seed = 1; seed <= 4; seed++) problems.push(...rulesWalk(seed, m.id));
    const uniq = [...new Set(problems.map((x) => x.replace(/^.*?\(seed \d+\): /, '')))];
    if (process.env.DUMP) writeFileSync(process.env.DUMP + '.rules', problems.join('\n'));
    assert.deepEqual(uniq.slice(0, 12), [], `${problems.length} problems, ${uniq.length} kinds:\n` + uniq.slice(0, 12).join('\n'));
  });

  ok('crawl is deterministic: the same walk gives the same conversation', { tags: ['determinism'] }, () => {
    for (const m of sample.slice(0, 6)) {
      const a = walk(2, m.id, 0.5), b = walk(2, m.id, 0.5);
      assert.deepEqual(a.transcript, b.transcript, m.name);
    }
  });

  ok('what is said persists through save and reload: what he was asked, and that it was asked', { tags: ['determinism'] }, () => {
    const w = world60(); const p = P(w); const m0 = sample.find((x) => x.rank === 'soldier' && x.familyId === p.familyId) ?? sample.find((x) => x.rank === 'soldier')!; const m = w.chars[m0.id];
    (p.intro ??= {})[m.id] = w.now;
    const r = (m.rels[p.id] ??= { trust: 0.7, affection: 0.7, respect: 0.6, grudge: 0, lastMet: -1e9 } as never) as { trust: number; respect: number; affection: number };
    r.trust = 0.7; r.respect = 0.6;
    talk(w, m.id, 'how');
    const talkBefore = JSON.stringify(m.talk);
    const w2 = deserialize(serialize(w));
    assert.equal(JSON.stringify(w2.chars[m.id].talk), talkBefore, 'conversational memory survives a save');
    const again = talk(w2, m.id, 'how');
    assert.match(again.lines[0], /already|changed|enough|same|ask|went over|memory|told you|asked|over this/i, 'and he remembers after reload: ' + again.lines[0]);
  });

  ok('backing: asking, pressing and agreeing records one favour and one backer, never twice', { tags: ['scenario'] }, () => {
    const w = world60(); const p = P(w);
    const m = men(w).find((x) => x.rank === 'capo' && x.familyId === p.familyId && x.id !== p.bossId);
    if (!m || p.rank !== 'associate') return;
    (p.intro ??= {})[m.id] = w.now;
    const rr = (m.rels[p.id] ??= { trust: 0.7, affection: 0.7, respect: 0.6, grudge: 0, lastMet: -1e9 } as never) as { trust: number; respect: number };
    rr.trust = 0.7; rr.respect = 0.6;
    const a = talk(w, m.id, 'rk_back');
    const owed0 = w.favours.length;
    talk(w, m.id, 'back_take', {}, a.v);
    assert.equal(p.backer, m.id);
    assert.equal(w.favours.length, owed0 + 1, 'one favour written');
    const s2 = talk(w, m.id, 'back_take', {}, a.v);
    assert.equal(w.favours.length, owed0 + 1, 'a repeat writes nothing');
    assert.ok(s2.lines.length);
    const s3 = talk(w, m.id, 'rk_back');
    assert.equal(w.favours.length, owed0 + 1, 'asking again later writes nothing');
    assert.match(s3.lines.join(' '), /already/i);
  });

  ok('a man of lower rank cannot be threatened without consequence, a rival warned off costs tension, and a recruit costs once', { tags: ['scenario'] }, () => {
    const w = world60(); const p = P(w);
    const crew = men(w).find((x) => x.rank === 'associate' && x.id !== p.id);
    if (crew) { crew.bossId = p.id; (p.intro ??= {})[crew.id] = w.now; const t0 = crew.rels[p.id]?.trust ?? 0.1; const s = talk(w, crew.id, 'cr_thin'); assert.ok(s.lines.length); const s2 = talk(w, crew.id, 'cr_thin'); assert.match(s2.lines.join(' '), /already|told/i, 'a second threat the same week is not a second threat'); assert.ok((crew.rels[p.id]?.trust ?? 0) <= t0 + 0.0001); }
    const riv = men(w).find((x) => x.rank !== 'civilian' && x.familyId && x.familyId !== p.familyId);
    if (riv && p.familyId) { (p.intro ??= {})[riv.id] = w.now; const before = w.fam[p.familyId].tension[riv.familyId!] ?? 0; talk(w, riv.id, 'rv_warn'); assert.ok((w.fam[p.familyId].tension[riv.familyId!] ?? 0) >= before, 'tension does not fall from a warning'); }
    const pr = men(w).find((x) => x.prospect && x.rank === 'civilian');
    if (pr && p.rank !== 'civilian') { (p.intro ??= {})[pr.id] = w.now; const cash0 = p.cash; const s = talk(w, pr.id, 'recruit_offer'); const take = s.r.next?.find((o) => /:(take|sweeten)$/.test(o.code)); if (take) talk(w, pr.id, take.code, {}, s.v); if (pr.rank === 'associate') { assert.ok(cash0 - p.cash <= 300 + 1, 'costs once'); assert.equal(pr.bossId, p.id); } }
  });

  ok('something said in a visit pays nothing the second time in it, and the next visit starts clean', { tags: ['unit'] }, () => {
    const w = world60(); const p = P(w); const m = sample.find((x) => x.rank === 'soldier') ?? sample[0];
    (p.intro ??= {})[m.id] = w.now;
    const v = begin(w, m.id);
    assert.ok(everything(w, v).some((o) => o.id === 'a:how'), 'how he is keeping can be asked');
    choose(w, v, 'a:how');
    assert.ok(!everything(w, v).some((o) => o.id === 'a:how'), 'once said, it is not offered again in the visit');
    // (and put to him anyway, it pays nothing: the rule holds whatever the screen offers)
    const before = stateOf(w, m), r = talk(w, m.id, 'how', {}, v);
    assert.equal(stateOf(w, m), before, 'a repeat pays nothing');
    assert.match(r.lines.join(' '), /already/);
    const v2 = begin(w, m.id);
    assert.ok(everything(w, v2).some((o) => o.id === 'a:how'), 'a new visit starts clean');
  });
}
describe('conversation crawler', fast);
