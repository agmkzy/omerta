// V90 acceptance audit: the conversation, explored exhaustively. From each of a set of staged circumstances (chosen to reach the
// rare branches as well as the common ones: a boss, his own man, a shop he protects and one he doesn't, a debtor, a creditor, a man
// of another family, bad blood, a broken promise, a request of his, a frightened man, a hot-headed one...), every option on every
// screen is tried, on its own copy of the world, breadth first, and every follow-up after it, until the subject closes, the
// conversation ends or the exploration budget is spent. Each transition is checked: did he answer, did anything break, did his
// words contradict his decision, is there a way out, did what was said leave a mark on the world. AUDIT=dir writes the coverage
// matrix and the problems found. Opt-in (slow): SLOW=1 npx vitest run audit.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deserialize, serialize, advance } from '../../engine';
import { DAY, type Character, type World } from '../../types';
import { arrive, options, say, answered, isNavCode, focusTitle, type Convo, type DOpt } from '../../dialogue';
import { openAsk, putToPlayer, stance } from '../../asks';
import { addEnc, addFavour } from '../../encounters';
import { createDebt, ownerBiz, rel, addFact, learn } from '../../core';
import { mkJob } from '../../jobs';
import { startRivalry } from '../../matters';
import { spawn, know } from '../../situ';
import { temper } from '../../temper';
import { kinOf, closeKin } from '../../kin';
import { createWorld } from '../../world';
import { whereIs } from '../../where';
import { world60 } from './fixtures';
import { P } from '../helpers';

const DEV = /undefined|NaN|\[object|\bnull\b|knowsActor|textHidden|\bctx\b|cooldown/;
const NULLISH = /^(Nothing comes of it\.?|Nothing happens\.?|You leave it there\.?)$/;
const REFUSE = /“(No[.,!]|I can’t[.!]|Then it’s no|Not interested)|still no|same answer|answer’s still|It’s still too much|I still can’t/i;
const AGREE = /We have a deal|That suits me|Fine\. Agreed|You’ll have it|“All right\. All right\.”|Why didn’t you say so/;
const PROMISE = /^(I’ll|I will|Want me to|Let me deal|I’ll put|I can lend|I’ll look after)/;

type Stage = { name: string; set: (w: World) => Character | undefined };
const civ = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian').sort((a, b) => (a.id < b.id ? -1 : 1));
const made = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian').sort((a, b) => (a.id < b.id ? -1 : 1));
const T = (c: Character, t: Partial<Character['traits']>) => Object.assign(c.traits, t);

const STAGES: Stage[] = [
  { name: 'his boss', set: (w) => w.chars[P(w).bossId!] },
  { name: 'a capo above him', set: (w) => made(w).find((c) => c.rank === 'capo' && c.familyId === P(w).familyId && c.id !== P(w).bossId) },
  { name: 'a peer in the family', set: (w) => made(w).find((c) => c.rank === 'associate' && c.familyId === P(w).familyId) },
  { name: 'his own man', set: (w) => { const c = made(w).find((x) => x.rank === 'associate' && x.familyId === P(w).familyId && x.id !== P(w).bossId); if (c) { c.bossId = P(w).id; c.books.missed = 2; c.problem = { kind: 'gambling', sev: 0.6, revealed: false } as never; } return c; } },
  { name: 'a man of another family', set: (w) => made(w).find((c) => c.familyId && c.familyId !== P(w).familyId && c.rank === 'soldier') },
  { name: 'an unprotected shopkeeper, offered protection', set: (w) => { const c = civ(w).find((x) => ownerBiz(w, x.id)?.open); if (!c) return; const b = ownerBiz(w, c.id)!; delete b.protection; openAsk(w, 'protect', P(w), c, { biz: b.id, amt: Math.max(20, Math.round(b.income * 0.1 / 5) * 5) }); return c; } },
  { name: 'a proud shopkeeper, offered protection', set: (w) => { const c = civ(w).filter((x) => ownerBiz(w, x.id)?.open)[1]; if (!c) return; const b = ownerBiz(w, c.id)!; delete b.protection; T(c, { courage: 1, caution: 0.1, violence: 0.9, ambition: 1, greed: 0.8 }); openAsk(w, 'protect', P(w), c, { biz: b.id, amt: Math.max(40, Math.round(b.income * 0.2 / 5) * 5) }); return c; } },
  { name: 'a shop he protects, envelope late', set: (w) => { const c = civ(w).filter((x) => ownerBiz(w, x.id)?.open)[2]; if (!c) return; const b = ownerBiz(w, c.id)!; b.protection = { collectorId: P(w).id, familyId: P(w).familyId!, fee: 30, since: w.now - 30 * DAY, owed: 60 } as never; return c; } },
  { name: 'a man who owes him money', set: (w) => { const c = civ(w)[5]; if (!c) return; createDebt(w, P(w).id, c.id, 400, 0.05, 'a loan'); const d = w.debts.at(-1)!; d.missed = 2; return c; } },
  { name: 'a man he owes money', set: (w) => { const c = made(w).find((x) => x.rank === 'soldier' && x.familyId === P(w).familyId); if (!c) return; P(w).cash += 500; createDebt(w, c.id, P(w).id, 500, 0.05, 'a loan'); return c; } },
  { name: 'a man with bad blood', set: (w) => { const c = made(w).find((x) => x.rank === 'soldier' && x.familyId === P(w).familyId && x.id !== P(w).bossId); if (!c) return; rel(c, P(w).id).grudge = 0.55; addFact(w, { kind: 'beating', actor: P(w).id, victim: c.id, text: `${P(w).name} beat up ${c.name}.`, district: c.district }, { witnesses: [c.id, P(w).id] }); return c; } },
  { name: 'a man he broke his word to', set: (w) => { const c = civ(w)[8]; if (!c) return; c.memos.push({ id: 'm' + w.nextId++, t: w.now - 20 * DAY, other: P(w).id, kind: 'promise', text: 'You said you would have a word for him.', due: w.now - 5 * DAY } as never); (P(w).rep ??= { kept: 0, broken: 0, asked: 0, ignored: 0, favoured: null }).broken++; return c; } },
  { name: 'a man who owes him a favour', set: (w) => { const c = civ(w)[10]; if (!c) return; addFavour(w, P(w).id, c.id, 2, 'what you did for his brother'); return c; } },
  { name: 'a man with a request', set: (w) => { const c = made(w).find((x) => x.rank === 'soldier' && x.familyId === P(w).familyId); if (!c) return; const s = openAsk(w, 'borrow', c, P(w), { amt: 200 }); if (s) putToPlayer(w, s); return c; } },
  { name: 'a frightened man', set: (w) => { const c = civ(w)[12]; if (!c) return; T(c, { courage: 0, caution: 1, violence: 0 }); rel(c, P(w).id).fear = 0.8; rel(c, P(w).id).respect = 0.1; return c; } },
  { name: 'a stranger', set: (w) => { const c = civ(w)[14]; if (c) delete P(w).intro?.[c.id]; return c; } },
  { name: 'a civilian with trouble', set: (w) => { const c = civ(w).find((x) => !ownerBiz(w, x.id) && x.id !== civ(w)[5]?.id); if (c) { c.problem = { kind: 'debt', sev: 0.7, revealed: true } as never; c.cash = 40; rel(c, P(w).id).trust = 0.6; } return c; } },
  { name: 'a prospect to recruit', set: (w) => { const c = civ(w).find((x) => !ownerBiz(w, x.id) && x.traits.ambition > 0.5); if (c) { c.prospect = true; P(w).rank = 'soldier'; } return c; } },
  { name: 'a man in a feud he knows of', set: (w) => { const [x, y] = made(w).filter((c) => c.familyId === P(w).familyId && c.id !== P(w).bossId && c.rank === 'soldier'); if (!x || !y) return; rel(x, y.id).grudge = 0.6; rel(y, x.id).grudge = 0.5; const s = startRivalry(w, x, y, 'an old insult'); if (s) { for (const id of [x.id, y.id, P(w).id]) (s.k ??= {})[id] = { l: 2, via: 'heard', t: w.now }; } return x; } },
  { name: 'a man just arrested and released', set: (w) => { const c = made(w).find((x) => x.rank === 'associate' && x.familyId === P(w).familyId && x.bossId !== P(w).id); if (!c) return; const f = addFact(w, { kind: 'arrest', actor: c.id, text: `${c.name} was picked up by the police.`, district: c.district }, { witnesses: [c.id, P(w).id] }); learn(w, P(w).id, f, 'public', true); return c; } },
  { name: 'a man who beat him', set: (w) => { const c = made(w).find((x) => x.rank === 'soldier' && x.familyId !== P(w).familyId); if (!c) return; addFact(w, { kind: 'beating', actor: c.id, victim: P(w).id, text: `${c.name} beat up ${P(w).name}.`, district: c.district }, { witnesses: [P(w).id, c.id] }); rel(P(w), c.id).grudge = 0.6; return c; } },
  { name: 'a man who lied to him', set: (w) => { const c = civ(w)[16]; if (!c) return; const v = civ(w)[17]; const f = addFact(w, { kind: 'vandalism', actor: c.id, victim: v.id, text: `${c.name} smashed up ${v.name}'s window.`, district: v.district }, { witnesses: [P(w).id] }); (c.denied ??= {})[f.id] = Math.floor(w.now / 1440); return c; } },
  { name: 'a man whose shop is in trouble (he told you)', set: (w) => { const c = civ(w).find((x) => ownerBiz(w, x.id)?.open && x.id !== civ(w)[0]?.id); if (!c) return; ownerBiz(w, c.id)!.distress = 2; (w.situations ??= []).push({ id: 's' + w.nextId++, kind: 'money', who: c.id, biz: ownerBiz(w, c.id)!.id, since: w.now - 14 * DAY, stage: 'handling', cause: `${ownerBiz(w, c.id)!.name} has been losing money`, knows: true, told: true, weeks: 2 } as never); return c; } },
  { name: 'a man just back from jail', set: (w) => { const c = made(w).find((x) => x.rank === 'soldier' && x.familyId === P(w).familyId); if (!c) return; addFact(w, { kind: 'arrest', actor: c.id, text: `${c.name} was picked up.`, district: c.district }, { witnesses: [c.id] }); c.jailedUntil = w.now - DAY; return c; } },
  { name: 'a man just made', set: (w) => { const c = made(w).find((x) => x.rank === 'soldier' && x.familyId === P(w).familyId); if (!c) return; addFact(w, { kind: 'promotion', actor: c.id, text: `${c.name} was made.`, district: c.district }, { witnesses: [P(w).id, c.id] }); return c; } },
  { name: 'a garage owner', set: (w) => civ(w).find((x) => ownerBiz(w, x.id)?.kind === 'garage') },
  { name: 'a pawnbroker', set: (w) => civ(w).find((x) => ownerBiz(w, x.id)?.kind === 'pawnshop') },
  { name: 'a capo of another family', set: (w) => made(w).find((c) => c.familyId && c.familyId !== P(w).familyId && c.rank === 'capo') },
  { name: 'a man with a grudge against another', set: (w) => { const [x, y] = civ(w).slice(20, 22); if (!x || !y) return; rel(x, y.id).grudge = 0.6; rel(x, P(w).id).trust = 0.6; return x; } },
  { name: 'his boss, on Sunday with the envelope due', set: (w) => { const p = P(w); w.sunday = { t: w.now, tells: [] }; p.cooldown.handed = 0; p.books.arrears = 120; p.cash = 3000; return w.chars[p.bossId!]; } },
  { name: 'his boss, with a job of his done', set: (w) => { const p = P(w), b = w.chars[p.bossId!]; mkJob(w, { kind: 'collect', title: 'Collect from somebody', brief: '', giver: b.id, via: 'boss', assignee: p.id, target: civ(w)[3].id, pay: 100, status: 'active', days: 7 } as never); return b; } },
  { name: 'a man in his own feud', set: (w) => { const p = P(w); const c = made(w).find((x) => x.familyId === p.familyId && x.id !== p.bossId && x.rank !== 'boss' && x.bossId); if (!c) return; rel(c, p.id).grudge = 0.6; rel(p, c.id).grudge = 0.5; p.cash = 1000; const s = startRivalry(w, p, c, 'words at the club') ?? (w.situations ?? []).find((x) => x.key === 'rival:' + [p.id, c.id].sort().join(':')); if (!s) return; for (const id of [c.id, p.id]) (s.k ??= {})[id] = { l: 2, via: 'his own', t: w.now }; return c; } },
  { name: 'the man above him and his rival', set: (w) => { const p = P(w); const c = made(w).find((x) => x.familyId === p.familyId && x.id !== p.bossId && x.rank !== 'boss' && x.bossId); if (!c) return; rel(c, p.id).grudge = 0.6; const s = startRivalry(w, p, c, 'words at the club'); if (!s) return; know(w, s, p.id, 2, 'his own'); return w.chars[p.bossId!]; } },
  { name: 'a man out for revenge on him', set: (w) => { const v = made(w).find((x) => x.rank === 'associate' && x.familyId !== P(w).familyId); if (!v) return; const kin = made(w).find((x) => x.id !== v.id && x.familyId === v.familyId && x.rank === 'soldier'); if (!kin) return; T(kin, { violence: 1, caution: 0, courage: 1 }); addFact(w, { kind: 'beating', actor: P(w).id, victim: v.id, text: `${P(w).name} beat up ${v.name}.`, district: v.district }, { witnesses: [v.id, kin.id, P(w).id] }); return kin; } },
  { name: 'a man of another family who likes him', set: (w) => { const c = made(w).find((x) => x.familyId && x.familyId !== P(w).familyId && x.rank === 'soldier'); if (c) { rel(c, P(w).id).trust = 0.7; rel(c, P(w).id).affection = 0.7; } return c; } },
  { name: 'his own man, angry', set: (w) => { const c = made(w).filter((x) => x.rank === 'associate' && x.familyId === P(w).familyId && x.id !== P(w).bossId)[1]; if (c) { c.bossId = P(w).id; rel(c, P(w).id).grudge = 0.5; T(c, { violence: 0.9, courage: 0.9, caution: 0.1 }); } return c; } },
  // V90 acceptance audit: matters of every kind, opened as the game opens them, and the subjects a man raises himself
  { name: 'a man out of jail, the family wondering what he said', set: (w) => { const p = P(w); const c = made(w).find((x) => x.rank === 'associate' && x.familyId === p.familyId && x.bossId && x.bossId !== p.id); if (!c) return; const s = spawn(w, 'arrest', 'arrest:audit', c.id, { cause: `${c.name} was picked up by the police`, parties: [{ id: c.id, role: 'held' }, { id: c.bossId!, role: 'boss' }], sev: 0.35, phase: 'out', next: w.now + 3 * DAY, truth: 'quiet', orgs: [c.familyId!] } as never); if (!s) return; know(w, s, p.id, 2, 'heard'); rel(c, p.id).trust = 0.5; return c; } },
  { name: 'the boss of a man who was picked up', set: (w) => { const p = P(w); const c = made(w).find((x) => x.rank === 'associate' && x.familyId === p.familyId && x.bossId && x.bossId !== p.id); if (!c) return; const s = spawn(w, 'arrest', 'arrest:audit', c.id, { cause: `${c.name} was picked up by the police`, parties: [{ id: c.id, role: 'held' }, { id: c.bossId!, role: 'boss' }], sev: 0.35, phase: 'out', next: w.now + 3 * DAY, truth: 'talked', orgs: [c.familyId!] } as never); if (!s) return; know(w, s, p.id, 1, 'heard'); return w.chars[c.bossId!]; } },
  ...(['the man', 'his boss'] as const).map((who) => ({ name: `a man coming for him over a beating (${who})`, set: (w: World) => { const p = P(w); const v = made(w).find((x) => x.rank === 'associate' && x.familyId !== p.familyId); const av = made(w).find((x) => x.rank === 'soldier' && x.familyId === v?.familyId && x.bossId); if (!v || !av) return; p.cash = 3000; const f = addFact(w, { kind: 'beating', actor: p.id, victim: v.id, text: `${p.name} beat up ${v.name}.`, district: v.district }, { witnesses: [v.id, p.id] }); const s = spawn(w, 'revenge', 'revenge:audit', av.id, { cause: `${f.text.replace(/\.$/, '')}, and ${av.name} is his cousin`, parties: [{ id: av.id, role: 'avenger' }, { id: v.id, role: 'wronged' }], sev: 0.35, phase: 'hunting', next: w.now + 3 * DAY, orgs: [av.familyId!], m: { fact: f.id, target: p.id } } as never); if (!s) return; know(w, s, p.id, 2, 'heard'); return who === 'the man' ? av : w.chars[av.bossId!]; } })),
  ...(['the avenger', 'the wrong man'] as const).map((who) => ({ name: `a man after the wrong man (${who})`, set: (w: World) => { const p = P(w); const [v, real, wrong] = civ(w).slice(30, 33); const av = made(w).find((x) => x.familyId === p.familyId && x.rank === 'soldier' && x.id !== p.bossId); if (!v || !real || !wrong || !av) return; rel(av, p.id).trust = 0.6; rel(p, wrong.id).trust = 0.5; const f = addFact(w, { kind: 'beating', actor: real.id, victim: v.id, text: `${real.name} beat up ${v.name}.`, district: v.district }, { witnesses: [v.id, p.id] }); learn(w, p.id, f, 'saw', true); const s = spawn(w, 'revenge', 'revenge:audit2', av.id, { cause: `${f.text.replace(/\.$/, '')}, and ${av.name} is his brother`, parties: [{ id: av.id, role: 'avenger' }, { id: v.id, role: 'wronged' }], sev: 0.35, phase: 'hunting', next: w.now + 3 * DAY, orgs: [av.familyId!], m: { fact: f.id, target: wrong.id } } as never); if (!s) return; know(w, s, p.id, 2, 'heard'); return who === 'the avenger' ? av : wrong; } })),
  ...(['the man', 'his boss'] as const).map((who) => ({ name: `a man who wants to rise (${who})`, set: (w: World) => { const p = P(w); p.rank = 'capo'; const c = made(w).find((x) => x.rank === 'associate' && x.familyId === p.familyId && x.bossId && x.bossId !== p.id); if (!c) return; rel(c, p.id).trust = 0.6; const s = spawn(w, 'climb', 'climb:audit', c.id, { cause: `${c.name} wants to rise`, parties: [{ id: c.id, role: 'climber' }, { id: c.bossId!, role: 'above' }], sev: 0.25, phase: 'climbing', next: w.now + 3 * DAY, orgs: [c.familyId!], m: { goal: 'audit' } } as never); if (!s) return; know(w, s, p.id, 2, 'heard'); return who === 'the man' ? c : w.chars[c.bossId!]; } })),
  { name: 'two of his own men in a feud', set: (w) => { const p = P(w); p.rank = 'underboss'; const [x, y] = made(w).filter((c) => c.familyId === p.familyId && (c.rank === 'associate' || c.rank === 'soldier') && c.id !== p.bossId).slice(3); if (!x || !y) return; x.bossId = p.id; y.bossId = p.id; const s = startRivalry(w, x, y, 'a card game') ?? (w.situations ?? []).find((z) => z.key === 'rival:' + [x.id, y.id].sort().join(':')); if (!s) return; know(w, s, p.id, 2, 'his own'); return x; } },
  { name: 'a loan shark with a man slow to pay', set: (w) => { const p = P(w); const c = made(w).find((x) => x.familyId === p.familyId && x.rank === 'soldier' && x.bossId !== p.id && x.id !== p.bossId); const d = civ(w)[34]; if (!c || !d) return; c.hustle = { kind: 'loans', level: 2, since: w.now - 60 * DAY, gross: 500 } as never; createDebt(w, c.id, d.id, 300, 0.05, 'a loan'); w.debts.at(-1)!.missed = 2; rel(c, p.id).trust = 0.6; return c; } },
  { name: 'an associate who wants to be made', set: (w) => { const p = P(w); p.rank = 'capo'; const c = made(w).find((x) => x.rank === 'associate' && x.familyId === p.familyId); if (!c) return; c.want = { kind: 'made', since: w.now - 30 * DAY }; T(c, { ambition: 1 }); rel(c, p.id).trust = 0.7; return c; } },
  { name: 'a man who wants a start of his own', set: (w) => { const p = P(w); p.cash = 5000; const c = civ(w).find((x) => !ownerBiz(w, x.id) && x.cash < 1500); if (!c) return; c.want = { kind: 'rich', since: w.now - 30 * DAY }; T(c, { ambition: 1 }); rel(c, p.id).trust = 0.7; return c; } },
  { name: 'his own man, trouble at home', set: (w) => { const p = P(w); const c = made(w).filter((x) => x.rank === 'associate' && x.familyId === p.familyId && x.id !== p.bossId)[2]; if (!c) return; c.bossId = p.id; c.problem = { kind: 'family', sev: 0.6, revealed: false } as never; rel(c, p.id).trust = 0.8; return c; } },
  { name: 'a man whose brother was beaten', set: (w) => { const p = P(w); for (const t of made(w)) { const k = kinOf(w, t).map((x) => w.chars[x.id]).find((y) => y && y.alive && !y.isPlayer && closeKin(w, t, y) && ['brother', 'cousin'].includes(kinOf(w, t).find((z) => z.id === y.id)!.role)); if (!k || kinOf(w, t).some((z) => z.id === p.id)) continue; const f = addFact(w, { kind: 'beating', actor: civ(w)[36].id, victim: k.id, text: `${civ(w)[36].name} beat up ${k.name}.`, district: k.district }, { witnesses: [k.id, t.id] }); const s = spawn(w, 'revenge', 'revenge:audit3', t.id, { cause: f.text, parties: [{ id: t.id, role: 'avenger' }, { id: k.id, role: 'wronged' }], sev: 0.35, phase: 'seething', next: w.now + 3 * DAY, orgs: [], m: { fact: f.id } } as never); if (!s) continue; rel(t, p.id).trust = 0.7; return t; } return undefined; } },
  { name: 'a shopkeeper another man is leaning on', set: (w) => { const p = P(w); const c = civ(w).filter((x) => ownerBiz(w, x.id)?.open)[3]; const a = made(w).find((x) => x.familyId && x.familyId !== p.familyId && x.rank === 'soldier'); if (!c || !a) return; const b = ownerBiz(w, c.id)!; delete b.protection; openAsk(w, 'protect', a, c, { biz: b.id, amt: 60 }); rel(c, p.id).trust = 0.7; return c; } },
  { name: 'a frightened shopkeeper, offered protection', set: (w) => { const p = P(w); const c = civ(w).filter((x) => ownerBiz(w, x.id)?.open)[4]; if (!c) return; const b = ownerBiz(w, c.id)!; delete b.protection; T(c, { courage: 0, caution: 1 }); rel(c, p.id).fear = 0.9; openAsk(w, 'protect', p, c, { biz: b.id, amt: Math.max(20, Math.round(b.income * 0.08 / 5) * 5) }); return c; } },
  { name: 'a proud shopkeeper who can pay', set: (w) => { const p = P(w); const c = civ(w).filter((x) => ownerBiz(w, x.id)?.open && temper(x).pride > 0.6)[0]; if (!c) return; const b = ownerBiz(w, c.id)!; delete b.protection; c.cash = 5000; rel(c, p.id).trust = 0.45; rel(c, p.id).respect = 0.4; openAsk(w, 'protect', p, c, { biz: b.id, amt: 15 }); return c; } },
  { name: 'a proud man who owes him a favour', set: (w) => { const p = P(w); const c = civ(w).filter((x) => temper(x).pride > 0.6)[1]; if (!c) return; addFavour(w, p.id, c.id, 2, 'what you did for his brother'); rel(c, p.id).grudge = 0.4; return c; } },
];

interface Rec { n: number; ok: number; fails: Record<string, number>; labels: Set<string>; effects: Set<string>; sample?: string; replies: Map<string, string> }
interface Audit { cov: Map<string, Rec>; problems: string[]; transitions: number; states: number; convos: number; screens: Map<string, number> }
const base = (code: string) => { const k = code.split(':')[0]; return k === 'f' || k === 'mv' || k === 'x' || k === 'tk' || k === 'mt' || k === 'enc' || k === 'fl' || k === 'deal' ? `${k}:${code.split(':').at(-1)}` : k; };

// what changed in the world, in kinds (not amounts)
function snap(w: World, t: Character) {
  const p = P(w), r = t.rels[p.id];
  return { trust: r?.trust ?? 0, aff: r?.affection ?? 0, resp: r?.respect ?? 0, grudge: r?.grudge ?? 0, fear: r?.fear ?? 0, cash: p.cash, tcash: t.cash, memos: t.memos.length, debts: w.debts.length, favours: w.favours.length, sits: (w.situations ?? []).length, facts: Object.keys(w.facts).length, jobs: w.jobs.length + w.jobs.filter((j) => j.status === 'active').length * 1000 + w.jobs.filter((j) => j.status === 'declined').length * 100000, heat: p.heat, standing: p.standing, open: (w.situations ?? []).filter((s) => s.stage !== 'resolved').length, encs: w.enc.filter((e) => e.status === 'open').length, known: Object.keys(p.known).length, notes: (p.insight?.[t.id] ?? []).length };
}
function diff(a: ReturnType<typeof snap>, b: ReturnType<typeof snap>): string[] {
  return (Object.keys(a) as (keyof typeof a)[]).filter((k) => Math.abs(Number(a[k]) - Number(b[k])) > 1e-6).map((k) => k);
}

function explore(stage: Stage, worldSave: string, A: Audit, budget = 260) {
  const w0 = deserialize(worldSave), t0 = stage.set(w0);
  if (!t0) { A.problems.push(`[${stage.name}] could not be staged`); return; }
  const p0 = P(w0); if (stage.name !== 'a stranger') (p0.intro ??= {})[t0.id] = w0.now;
  const start = serialize(w0);
  // a state is a path of codes from arrival; replayed on a fresh copy of the staged world
  const replay = (path: string[]) => {
    const w = deserialize(start), p = P(w), t = w.chars[t0.id];
    let c: Convo | null = arrive(w, p, t, { lines: [] }, whereIs(w, p, t), t.rels[p.id]?.lastMet ?? -1e9).convo;
    for (const code of path) { if (!c) break; c = say(w, p, t, c, code).convo; }
    return { w, p, t, c };
  };
  const seen = new Set<string>();
  const queue: string[][] = [[]];
  let spent = 0;
  while (queue.length && spent < budget) {
    const path = queue.shift()!;
    const { w, t, c } = replay(path);
    if (!c) continue;
    const os = options(w, P(w), t, c);
    const key = `${c.node}|${c.ctx.focus ?? ''}|${os.map((o) => o.code + (o.done ? '*' : '')).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key); A.states++;
    const screen = os.some((o) => o.group) ? 'hub' : c.ctx.focus ? `subject:${c.ctx.focus.split(':')[0]}` : `follow:${c.node}`;
    A.screens.set(screen, (A.screens.get(screen) ?? 0) + 1);
    if (!os.some((o) => o.code === 'root' || o.code === 'f:' || isNavCode(o.code))) A.problems.push(`[${stage.name}] dead end at ${screen}: ${os.map((o) => o.label).join(' | ')}`);
    if (os.some((o) => o.group) && os.filter((o) => o.group === 'Between you' && o.code !== 'f:more').length > 3) A.problems.push(`[${stage.name}] hub shows more than three matters`);
    for (const o of os) {
      if (DEV.test(o.label) || DEV.test(o.hint ?? '')) A.problems.push(`[${stage.name}] database wording in option: ${o.label}`);
      if (o.done || (o.code === 'root' && c.node === 'root')) continue;
      spent++;
      const r0 = replay(path);
      if (!r0.c) continue;
      const before = snap(r0.w, r0.t);
      let res;
      try { res = say(r0.w, r0.p, r0.t, r0.c, o.code); } catch (e) { A.problems.push(`[${stage.name}] "${o.label}" (${o.code}) threw: ${(e as Error).message}`); continue; }
      A.transitions++;
      const ch = diff(before, snap(r0.w, r0.t));
      const k = base(o.code), rec: Rec = A.cov.get(k) ?? { n: 0, ok: 0, fails: {}, labels: new Set(), effects: new Set(), replies: new Map() };
      A.cov.set(k, rec); rec.n++; rec.labels.add(o.label); ch.forEach((x) => rec.effects.add(x));
      const said = res.lines.filter((l) => !l.startsWith('⟡'));
      const fail = (why: string) => { rec.fails[why] = (rec.fails[why] ?? 0) + 1; A.problems.push(`[${stage.name}] "${o.label}" (${o.code}) ${why}: ${said.join(' / ').slice(0, 220)}`); };
      let bad = false;
      if (!isNavCode(o.code)) {
        if (!said.length) { fail('no reply'); bad = true; }
        else if (!said.some((l) => answered(l, r0.t.name.split(' ')[0]))) { fail('not answered'); bad = true; }
        if (said.length === 1 && NULLISH.test(said[0])) { fail('null outcome'); bad = true; }
        if (PROMISE.test(o.label) && !ch.some((x) => ['memos', 'favours', 'jobs', 'debts', 'sits', 'facts', 'cash', 'tcash', 'trust', 'notes', 'known'].includes(x))) { fail('promise left no record'); bad = true; }
      }
      for (const l of res.lines) if (DEV.test(l)) { fail('database wording'); bad = true; }
      const mid = /^(mv|x):([^:]+):/.exec(o.code)?.[2];
      if (mid) {
        const m = (r0.w.situations ?? []).find((x) => x.id === mid), his = said.filter((l) => /[“"]/.test(l)).join(' ');
        if (m?.stage === 'resolved' && ['agreed', 'gave in'].includes(m.out ?? '') && REFUSE.test(his)) { fail('agreed but refused in words'); bad = true; }
        if (m && m.stage !== 'resolved' && stance(r0.w, m, r0.t.id).last === 'no' && AGREE.test(his)) { fail('refused but agreed in words'); bad = true; }
      }
      if (!bad) rec.ok++;
      rec.sample ??= said.join(' / ').slice(0, 160);
      // every distinct reply, with where it was said, for reading (a few per action)
      { const rep = said.map((l) => l.replace(new RegExp(r0.t.name.split(' ')[0], 'g'), '‹him›')).join(' / '); if (rec.replies.size < 8 && !rec.replies.has(rep)) rec.replies.set(rep, `${stage.name} · ${screen} · “${o.label}”${ch.length ? ' · changed: ' + ch.join(' ') : ''}`); }
      if (res.convo) queue.push([...path, o.code]); else A.convos++;
    }
  }
  // and coming back days later: the matter is still there, named, and opening it is answered from where it stood
  const { w, p, t } = replay([]);
  advance(w, w.now + 5 * DAY);
  if (t.alive) {
    const a = arrive(w, p, t, { lines: [] }, whereIs(w, p, t), t.rels[p.id]?.lastMet ?? -1e9);
    const os = options(w, p, t, a.convo);
    const door = os.find((o) => o.code.startsWith('f:m:') || o.code.startsWith('f:enc:'));
    if (door) { const r = say(w, p, t, a.convo, door.code); if (!r.lines.some((l) => answered(l, t.name.split(' ')[0]))) A.problems.push(`[${stage.name}] revisit: opening ${door.label} was not answered`); if (r.convo && !focusTitle(w, p, t, r.convo)) A.problems.push(`[${stage.name}] revisit: subject unnamed`); }
  }
}

describe('conversation audit (opt-in)', { tags: ['property', 'slow'] }, () => {
  ok('every option on every screen, from every staged circumstance', { timeout: 60 * 60_000 }, () => {
    const A: Audit = { cov: new Map(), problems: [], transitions: 0, states: 0, convos: 0, screens: new Map() };
    const w7 = createWorld(7, 'Tony Marino'); advance(w7, w7.now + 60 * DAY);
    const saves = [serialize(world60()), ...(process.env.ONEWORLD ? [] : [serialize(w7)])];
    for (const sv of saves) for (const st of STAGES) explore(st, sv, A, Number(process.env.BUDGET ?? 260));
    const rows = [...A.cov.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const status = (r: Rec) => (r.ok === r.n ? 'Exercised successfully' : r.ok === 0 ? 'Exercised and failed' : 'Exercised, some failures');
    const md = [`# V90 conversation audit — coverage matrix`, '', `States explored: ${A.states} · transitions: ${A.transitions} · conversations ended: ${A.convos} · distinct actions exercised: ${rows.length}`, '',
      `Screens: ${[...A.screens].map(([k, v]) => `${k} ${v}`).join(' · ')}`, '',
      '| Action | Status | Times | OK | Failures | Example wording | Effects seen | Example reply |', '|---|---|---|---|---|---|---|---|',
      ...rows.map(([k, r]) => `| \`${k}\` | ${status(r)} | ${r.n} | ${r.ok} | ${Object.entries(r.fails).map(([f, n]) => `${f} ×${n}`).join(', ')} | ${[...r.labels][0]?.replace(/\|/g, '/')} | ${[...r.effects].join(' ')} | ${(r.sample ?? '').replace(/\|/g, '/')} |`)];
    if (process.env.AUDIT) { mkdirSync(process.env.AUDIT, { recursive: true }); writeFileSync(process.env.AUDIT + '/coverage.md', md.join('\n')); writeFileSync(process.env.AUDIT + '/problems.txt', [...new Set(A.problems)].join('\n')); writeFileSync(process.env.AUDIT + '/codes.txt', rows.map(([k]) => k).join('\n')); writeFileSync(process.env.AUDIT + '/replies.md', rows.map(([k, r]) => `## ${k}\n` + [...r.replies].map(([rep, where]) => `- ${rep}\n  _${where}_`).join('\n')).join('\n\n')); }
    const uniq = [...new Set(A.problems.map((x) => x.replace(/^\[[^\]]+\] /, '').replace(/:.*$/, '')))];
    assert.deepEqual(uniq.slice(0, 25), [], `${A.problems.length} problems:\n${uniq.slice(0, 25).join('\n')}`);
  });
});
