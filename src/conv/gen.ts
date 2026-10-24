// Gate 1 generalisation run: the same engine pointed at people and situations nobody scripted. Four seeds, each world run forward
// twenty days so it has its own history; real men with their own temperaments and manner (no fixture overrides), real relationships,
// real facts. Henry makes the same kinds of request of whoever the world puts in front of him. What is measured is not whether the
// outcome is "right" but whether the architecture holds: decisions that differ for reasons, lines that say what the decision means,
// and where the renderer has nothing written for the case and falls back to more general wording.
import { createWorld } from '../world';
import { advance } from '../engine';
import { ownerBiz, rel } from '../core';
import { crewGround } from '../econ';
import { DAY, type Character, type Fact, type World } from '../types';
import { newSession, perceive, type Session } from './perception';
import { interpret } from './speech';
import { lastRender, type RenderInfo } from './render';
import { Out, Visit, LEAVE, first, type Row } from './harness';
import { onAnnouncement, onIntervention, onIntroduction, onLoanRequest, onProtectionDemand, onUnknownTopic, onWhoQuestion, type Captaincy, type Reply } from './respond';

export interface Rec { kind: string; regard: string; seed: number; speaker: string; arch: string; chosen: string; info: RenderInfo; gap: boolean }
export interface GenStats { assumed: { line: string; n: number; word: string }[]; roleMismatch: string[]; visits: number; recs: Rec[]; missing: string[]; gaps: string[]; shared: { line: string; speakers: number; key: string }[]; decisions: Record<string, Record<string, number>> }

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const famOf = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : '');
const spread = <T>(xs: T[], n: number) => (xs.length <= n ? xs : Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]));
function captainOf(w: World, c: Character): Character | undefined { let x: Character | undefined = c; for (let i = 0; i < 6 && x; i++) { x = x.bossId ? w.chars[x.bossId] : undefined; if (x?.rank === 'capo') return x; } return undefined; }

interface Run { kind: string; regard: string; title: string; chosen: string; out: Out }
export function generalisation(o: Out, seeds = [3, 7, 11, 19]): GenStats {
  const recs: Rec[] = [], runs: Run[] = [], roleMismatch: string[] = [], assumed: GenStats['assumed'] = [];
  for (const seed of seeds) {
    const w = createWorld(seed, 'Henry Tedesco');
    advance(w, w.now + 20 * DAY);
    const henry = w.chars[w.playerId!];
    // one visit: a fresh session (nothing scripted into it), the harness, and a record of every NPC line
    // one visit, twice: once as things really stand between them (Henry has done nothing for twenty days, so to most men he is a
    // stranger), and once as if Henry were a man he knows and trusts (his regard set; everything else as it is). A fresh session
    // each time (nothing scripted into it), the harness, and a record of every NPC line.
    const visit = (kind: string, him: Character, where: string, play: (v: Visit, s: Session, say: (r: Reply, heard?: ReturnType<typeof interpret>) => void) => string) => {
      for (const regard of ['as it stands', 'knows and trusts him']) {
        const r0 = { ...rel(him, henry.id) };
        if (regard !== 'as it stands') Object.assign(rel(him, henry.id), { trust: Math.max(r0.trust, 0.65), known: Math.max(r0.known ?? 0, 0.6), respect: Math.max(r0.respect, 0.45), affection: Math.max(r0.affection, 0.4) });
        const s = newSession(), out = new Out(), v = new Visit(out, w, s, henry, him, where);
        const arch = perceive(w, s, him).arch, fr = perceive(w, s, him).feelingFor(henry);
        out.P(`#### ${him.name} (${arch}; ${him.rank}${ownerBiz(w, him.id) ? ', ' + ownerBiz(w, him.id)!.name : ''}), seed ${seed}: ${regard} (trust ${fr.trust.toFixed(2)}, known ${fr.known.toFixed(2)})`);
        const say = (r: Reply, heard?: ReturnType<typeof interpret>) => {
          v.him_(r, heard ? { heard } : undefined);
          const info = lastRender.info!;
          recs.push({ kind, regard, seed, speaker: him.id, arch, chosen: r.decision.chosen, info: { ...info }, gap: /\{\w+\}/.test(info.line) || /\b(the|a|at|with|to)\s*[”.,]/.test(info.line) });
        };
        const chosen = play(v, s, say);
        runs.push({ kind, regard, title: him.name, chosen, out });
        Object.assign(rel(him, henry.id), r0);
      }
    };

    // 1. protection, asked of shopkeepers nobody chose: plainly after an introduction, or by the indirect remark. (Not shops his
    // own family already protects: the screen would never suggest shaking those down, so neither does this run.)
    const shops = spread(Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && ownerBiz(w, c.id)!.protection?.familyId !== henry.familyId).sort(byId), 6);
    shops.forEach((c, i) => {
      const b = ownerBiz(w, c.id)!, fee = Math.max(20, Math.round((b.income * 0.08) / 5) * 5);
      visit('protection', c, b.name, (v, s, say) => {
        v.offer([{ key: 'introduce.self', note: 'Introduce yourself.' }, { key: 'compliment.business', note: 'Get to the point: protection.' }, LEAVE]);
        let r: ReturnType<typeof onProtectionDemand> | undefined;
        if (i % 2 === 0) {
          v.pick('introduce.self');
          s.told[c.id] = { [henry.id]: { family: famOf(w, henry), name: henry.name, basis: { kind: 'claimed', ref: 'introduced himself' } } };
          say(onIntroduction(perceive(w, s, c), henry, famOf(w, henry)));
          const how = (['plain', 'soft', 'lean'] as const)[(i / 2) % 3];
          const key = how === 'plain' ? 'demand.protection' : 'demand.protection.' + how;
          v.offer([{ key, note: 'Put it to him.', slots: { amt: `$${fee}` } }, LEAVE]);
          v.pick(key);
          r = onProtectionDemand(perceive(w, s, c), henry, fee, how, v.mem); say(r);
        } else {
          const sp = v.pick('compliment.business', { act: 'compliment', explicit: 0 });
          const heard = interpret(perceive(w, s, c), sp, henry);
          if (heard.act !== 'demand.protection') { say({ decision: { by: c.id, constraints: [], candidates: [], chosen: 'reply' }, meaning: { key: 'reply.compliment', stance: 'polite', toward: 'speaker' }, intent: 'remark', honest: true }, heard); return 'heard as a compliment'; }
          r = onProtectionDemand(perceive(w, s, c), henry, fee, 'inferred', v.mem); say(r, heard);
        }
        if (r.followups.some((f) => f.key === 'announce.return')) {
          v.offer([...r.followups.map((f) => ({ key: f.key, note: f.note, slots: { day: 'Friday', amt: `$${r!.counterAmt ?? fee}` } })), LEAVE]);
          v.pick('announce.return', { act: 'announce' }); say(onAnnouncement(perceive(w, s, c), henry));
        }
        return r.decision.chosen;
      });
    });

    // 2. a loan, asked of men with money, at sums nobody tuned for
    const lenders = spread(Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.cash > 400).sort(byId), 5);
    lenders.forEach((c, i) => {
      const amt = [200, 500, 1000, 300, 800][i % 5];
      visit('loan', c, 'the club', (v, s, say) => {
        v.offer([{ key: 'ask.loan', note: 'Ask him for money.', slots: { amt: `$${amt}` } }, LEAVE]);
        v.pick('ask.loan');
        let r = onLoanRequest(perceive(w, s, c), henry, amt, v.mem); say(r);
        if (!r.followups.length) return r.decision.chosen;
        const rows: Row[] = r.followups.slice(0, 4).map((f) => ({ key: f.key, note: f.note, slots: f.slots }));
        v.offer([...rows, LEAVE]);
        const f = rows[i % rows.length];
        v.pick(f.key);
        if (f.key === 'accept.counter.loan') return 'counter, taken';
        r = onLoanRequest(perceive(w, s, c), henry, amt, v.mem, f.key === 'argue.reputation' ? { reputation: true } : f.key === 'sweeten.rate' ? { rate: 0.08 } : { promise: 'the end of the month' });
        say(r);
        return r.decision.chosen;
      });
    });

    // 3. who did it: real damage in this world's own history, asked of men who saw it and men who didn't
    const damage = Object.values(w.facts).filter((f) => f.kind === 'vandalism' && f.actor && f.business && w.biz[f.business]).sort(byId).slice(0, 3);
    for (const f of damage) {
      const knowers = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.id !== f.actor && c.known[f.id]).sort(byId);
      const stranger = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.district === f.district && !c.known[f.id]).sort(byId)[0];
      for (const c of [knowers[0], knowers[1], stranger].filter((x): x is Character => !!x)) {
        visit('who', c, 'the street', (v, s, say) => {
          v.offer([{ key: 'ask.who', note: 'Ask him who did it.', slots: { shop: w.biz[f.business!].name } }, LEAVE]);
          v.pick('ask.who');
          const r = onWhoQuestion(perceive(w, s, c), henry, f.id, w.chars[f.actor!]); say(r);
          // the meaning has no place for what he is to it (the man it was done to, a man who saw it, a man who heard): a victim gets a bystander's line
          if (c.id === f.victim) roleMismatch.push(`${c.name}, whose own ${w.biz[f.business!].name} it was: ${lastRender.info!.line}`);
          return r.meaning.key.split('.').pop()!;
        });
      }
    }

    // 4. news he hasn't heard
    const news: Fact | undefined = Object.values(w.facts).filter((f) => !f.minor && f.business && w.biz[f.business] && ['vandalism', 'robbery', 'burglary', 'theft'].includes(f.kind)).sort(byId)[0];
    if (news) for (const c of spread(Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && !c.known[news.id]).sort(byId), 2)) {
      const topic = w.biz[news.business!].name;
      visit('news', c, 'the street', (v, s, say) => {
        v.offer([{ key: 'tell.news', note: 'Tell him what you heard.', slots: { topic } }, LEAVE]);
        v.pick('tell.news'); say(onUnknownTopic(perceive(w, s, c), henry, topic)); return 'told';
      });
    }

    // 5. an intervention for a shopkeeper against a man from another crew: pairs nobody chose
    const riz = captainOf(w, henry);
    if (riz) {
      const ground = crewGround(w, riz);
      const against = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId === henry.familyId && captainOf(w, c) && captainOf(w, c)!.id !== riz.id).sort(byId);
      shops.slice(0, 3).forEach((forC, i) => {
        const vs = against[i * 2 % Math.max(1, against.length)];
        if (!vs) return;
        const b = ownerBiz(w, forC.id)!;
        const k: Captaincy = { groundHasFor: ground.has(b.district), forProtected: !!b.protection, knowsTrouble: false, theirCaptain: captainOf(w, vs)!, asked: 0, agreed: false, done: false };
        visit('intervention', riz, 'the club', (v, s, say) => {
          v.offer([{ key: 'ask.intervention', note: 'Ask him to take it up with the family.', slots: { forName: forC.name, againstName: vs.name } }, LEAVE]);
          v.pick('ask.intervention');
          let r = onIntervention(perceive(w, s, riz), henry, forC, vs, k, [], v.mem); say(r);
          const args: ('ground' | 'word' | 'money')[] = [];
          for (let n = 0; n < 2 && r.nextArgs.length && r.decision.chosen !== 'accept'; n++) {
            const ARG: Record<string, Row> = { ground: { key: 'argue.ground', note: 'What’s in it for the crew.', slots: { againstFirst: first(vs.name) } }, word: { key: 'argue.word', note: 'Your word on it.', slots: { forFirst: first(forC.name) } }, money: { key: 'argue.money', note: 'Make it business.', slots: { forFirst: first(forC.name) } } };
            v.offer([...r.nextArgs.map((a) => ARG[a]), { key: 'let.go', note: 'Let it go.' }]);
            const a = r.nextArgs[(i + n) % r.nextArgs.length];
            v.pick(ARG[a].key); v.mem.argued.push(a); args.push(a);
            r = onIntervention(perceive(w, s, riz), henry, forC, vs, k, args, v.mem);
            say(r.meaning.key === 'refuse.intervention' ? { ...r, meaning: { ...r.meaning, key: r.argReplies.at(-1)!.key, grounds: undefined, slots: { ...r.meaning.slots, againstFirst: first(vs.name), youFirst: first(henry.name) } } } : { ...r, meaning: { ...r.meaning, slots: { ...r.meaning.slots, youFirst: first(henry.name) } } });
            if (r.meaning.key === 'cutOff.argument') break;
          }
          return r.decision.chosen;
        });
      });
    }
  }

  // ---------------------------------------------------------------- what it shows
  const decisions: Record<string, Record<string, number>> = {};
  for (const r of runs) { const d = (decisions[`${r.kind} · ${r.regard}`] ??= {}); d[r.chosen] = (d[r.chosen] ?? 0) + 1; }
  const levels = ['specific', 'reason', 'kind', 'verb', 'missing'] as const;
  const count = (f: (x: Rec) => boolean) => recs.filter(f).length;
  const missing = [...new Set(recs.filter((r) => r.info.level === 'missing').map((r) => r.info.key))];
  const gaps = [...new Set(recs.filter((r) => r.gap).map((r) => r.info.line))];
  const by = new Map<string, { speakers: Set<string>; key: string }>();
  for (const r of recs) { const x = by.get(r.info.line) ?? { speakers: new Set(), key: r.info.key }; x.speakers.add(r.speaker); by.set(r.info.line, x); }
  const shared = [...by].filter(([, x]) => x.speakers.size >= 3).map(([line, x]) => ({ line, speakers: x.speakers.size, key: x.key })).sort((a, b) => b.speakers - a.speakers);

  const P = (x = '') => o.P(x);
  P('## 9. Generalisation: people and requests nobody scripted'); P('');
  P(`*Four seeds (${seeds.join(', ')}), each world run forward twenty days before Henry starts. Whoever the world puts in front of him, with his own temperament, manner, money and knowledge. Each visit is played twice: with the man’s regard for Henry as it really stands (Henry has done nothing for twenty days, so mostly a stranger), and with it set as if he knew and trusted Henry. No temperament or manner overrides, nothing added to the line library for this run. Five kinds of request: protection (plainly, softly, leaning, or by the indirect remark), a loan at varying sums, who did a piece of real damage from the world’s own history, news he hasn’t heard, and asking a captain to intervene for a shopkeeper against a man from another crew.*`); P('');
  P(`### What came out (${runs.length} visits, ${recs.length} NPC lines)`); P('');
  P('| Request | Visits | Decisions |'); P('|---|---|---|');
  for (const [k, d] of Object.entries(decisions)) P(`| ${k} | ${Object.values(d).reduce((a, b) => a + b, 0)} | ${Object.entries(d).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ')} |`);
  P('');
  P('| Where each NPC line came from | Lines | Share |'); P('|---|---|---|');
  const label: Record<string, string> = { specific: 'written for this request and reason', reason: 'a general line for the reason (e.g. any refusal for risk)', kind: 'the request, no reason-specific line', verb: 'the bare act (most generic)', missing: 'nothing at all (a hole)' };
  for (const l of levels) P(`| ${label[l]} | ${count((r) => r.info.level === l)} | ${Math.round((count((r) => r.info.level === l) / Math.max(1, recs.length)) * 100)}% |`);
  P(`| …of which in the speaker’s own manner (archetype line) | ${count((r) => r.info.own)} | ${Math.round((count((r) => r.info.own) / Math.max(1, recs.length)) * 100)}% |`);
  P('');
  P(`Archetypes met: ${Object.entries(recs.reduce((a, r) => ((a[r.arch] = (a[r.arch] ?? new Set()).add(r.speaker)), a), {} as Record<string, Set<string>>)).map(([a, s]) => `${a} ${s.size}`).join(', ')}.`); P('');
  P('### Where it falls back to generic wording'); P('');
  const fb = recs.filter((r) => r.info.level !== 'specific');
  const fbKeys = new Map<string, { n: number; line: string; level: string }>();
  for (const r of fb) { const k = `${r.info.key} (${r.info.level})`; const x = fbKeys.get(k) ?? { n: 0, line: r.info.line, level: r.info.level }; x.n++; fbKeys.set(k, x); }
  if (!fbKeys.size) P('None: every line came from a bank written for that request and reason.');
  for (const [k, x] of [...fbKeys].sort((a, b) => b[1].n - a[1].n)) P(`- \`${k}\` ×${x.n}: ${x.line}`);
  P('');
  P('### Lines heard from three or more different men'); P('');
  if (!shared.length) P('None.');
  for (const x of shared.slice(0, 12)) P(`- ${x.speakers} men: ${x.line} \`${x.key}\``);
  P('');
  P('### Holes and broken lines'); P('');
  P(missing.length ? `Missing banks: ${missing.map((m) => '`' + m + '`').join(', ')}` : 'No missing banks.');
  P(gaps.length ? `Lines with an unfilled slot or a dangling word: ${gaps.map((g) => '“' + g + '”').join('; ')}` : 'No unfilled slots.');
  P('');
  P(roleMismatch.length ? `Lines that misstate what the speaker is to the matter (${roleMismatch.length}):\n${roleMismatch.map((x) => '- ' + x).join('\n')}` : 'No role mismatches detected.');
  P('');
  // words that came in with the worked examples and assert something the meaning does not carry (found by reading this run's
  // lines, then counted by pattern): the kind of business, the damage, the day, how long, where he stood
  const ASSUMED = /bakery|loaf|window|for years|Tuesday|across the street/i;
  const am = new Map<string, { n: number; word: string }>();
  for (const r of recs) { const m = r.info.line.match(ASSUMED); if (m) { const x = am.get(r.info.line) ?? { n: 0, word: m[0] }; x.n++; am.set(r.info.line, x); } }
  assumed.push(...[...am].map(([line, x]) => ({ line, ...x })).sort((a, b) => b.n - a.n));
  P(assumed.length ? `NPC lines asserting something from the worked examples that the decision did not establish (${assumed.reduce((a, x) => a + x.n, 0)} of ${recs.length}):\n${assumed.map((x) => `- “${x.word}” ×${x.n}: ${x.line}`).join('\n')}` : 'No fixture assumptions in NPC lines.');
  P('');
  P('### Representative transcripts'); P('');
  P('*One visit for each distinct outcome of each request and standing, up to two each; the rest are in the run, not printed.*'); P('');
  const shown = new Set<string>();
  for (const kind of Object.keys(decisions)) {
    let n = 0;
    for (const r of runs.filter((x) => `${x.kind} · ${x.regard}` === kind)) {
      if (n >= 2 || shown.has(kind + r.chosen)) continue;
      shown.add(kind + r.chosen); n++;
      for (const l of r.out.lines) P(l);
      P('');
    }
  }
  return { assumed, roleMismatch, visits: runs.length, recs, missing, gaps, shared, decisions };
}
