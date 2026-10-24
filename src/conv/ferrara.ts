// Gate 2a: the Ferrara dispute end to end (spec §11.2), on a real world. Nobody is renamed and nothing is set by hand: a soldier from
// another crew leans on a shopkeeper on Henry's captain's ground through the world's own ask, and presses it with force; the
// shopkeeper comes to Henry; Henry promises; Henry takes it to his captain; days pass in the real engine; the captain takes it to the
// other man's captain; that captain orders his man (the world's own "leave him alone" ask, whose answer is the man's); the man
// decides whether he means it; the conditions are checked daily and on every hostile fact; and the shopkeeper's first word when
// Henry comes back is from what he knows. Every change goes through conv/doors.ts; every record is in World.social.
import { createWorld } from '../world';
import { advance } from '../engine';
import { ownerBiz } from '../core';
import { crewGround } from '../econ';
import { askBetween } from '../asks';
import { DAY, type Character, type Fact, type Id, type World } from '../types';
import { newSession, perceive, type Session } from './perception';
import { onIntervention, onPromise, onPromiseSeenBroken, onReport, onReturnToPromisee, onSeekHelp, predictAcceptance, type Captaincy } from './respond';
import { Out, Visit, LEAVE, first, traceLines, type Row } from './harness';
import { HOSTILE, type ObType, type Obligation } from './obligations';
import { social } from './social';
import { agreement, captaincyOf, offstage, promise, request, settleNow } from './tick';
import { captainOf, chairFor, reach } from './authority';
import * as door from './doors';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const dayOf = (w: World, t0: number) => Math.floor((w.now - t0) / DAY);
const MATTER = 'ferrara';

export interface Cast { w: World; henry: Character; riz: Character; lou: Character; marchese: Character; nate: Character; biz: Id }
// The people, from the world as generated: Henry's captain; a soldier of the same family under another captain; that man's captain;
// a shopkeeper nobody protects on Henry's captain's ground. `n` picks which soldier, in order, so a run can follow a different man.
export function cast(seed: number, n = 0): Cast | undefined {
  const w = createWorld(seed, 'Henry Tedesco'), henry = w.chars[w.playerId!];
  const riz = captainOf(w, henry);
  if (!riz) return undefined;
  const lous = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId === henry.familyId && captainOf(w, c) && captainOf(w, c)!.id !== riz.id).sort(byId);
  const lou = lous[n];
  if (!lou) return undefined;
  const ground = crewGround(w, riz);
  const nate = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection && ownerBiz(w, c.id)!.kind !== 'casino' && ground.has(ownerBiz(w, c.id)!.district)).sort(byId)[0];
  if (!nate) return undefined;
  return { w, henry, riz, lou, marchese: captainOf(w, lou)!, nate, biz: ownerBiz(w, nate.id)!.id };
}

export interface Run {
  c: Cast; o: Out; type: ObType; t0: number;
  o1?: Obligation; o2?: Obligation; o3?: Obligation;
  grievance?: Fact; outcome: string;
}
const PROMISES = (lou: Character): Record<ObType, Row> => ({
  action: { key: 'promise.action', note: 'A promise to act: you’ll raise it with your captain. Kept when you do, whatever he says.' },
  effort: { key: 'promise.effort', note: 'A promise to try: you’ll need to take it to someone who can act. Kept by a real attempt, even one that fails.' },
  result: { key: 'promise.result', note: `A promise of a result: he’s left alone for thirty days. You can’t order ${first(lou.name)} yourself; it rests on others.` },
  restraint: { key: 'promise.restraint', note: 'A promise to keep quiet about it.' },
});
const status = (ob?: Obligation) => (ob ? `${ob.id} ${ob.type} (${ob.status}${ob.why ? ': ' + ob.why : ''}${ob.credit ? '; credit: ' + ob.credit : ''})` : '(none)');

// One run of the chain. `tell` decides whether Henry tells his captain what Lou did (the only thing that can change the captain's mind).
export function chain(c: Cast, type: ObType, opts: { tell?: boolean; days?: number; noRaise?: boolean } = {}): Run {
  const { w, henry, riz, lou, marchese, nate, biz } = c, o = new Out(), P = (x = '') => o.P(x), s: Session = newSession();
  const run: Run = { c, o, type, t0: w.now, outcome: '' }, PROMISE = PROMISES(lou);
  offstage.length = 0;
  const shop = w.biz[biz];
  const sitrep = (title: string) => traceLines(o, title, [
    ...social(w).requests.map((r) => `request ${r.id}: ${w.chars[r.by].name} → ${w.chars[r.of].name} (${r.wants}${r.parent ? ', serving ' + r.parent : ''}${r.sit ? ', riding on ask ' + r.sit : ''}): ${r.status}${r.hist.length ? ' · ' + r.hist.map((h) => h.event).join('; ') : ''}`),
    ...social(w).agreements.map((a) => `agreement ${a.id}: ${a.terms} (${a.parties.map((p) => w.chars[p].name).join(', ')}) → ${a.obligations.join(', ')}`),
    ...social(w).obs.map((x) => `obligation ${x.id}: ${w.chars[x.obligor].name}, ${x.type}${x.order ? ' (an order)' : ''}, to ${w.chars[x.beneficiary].name}, days ${Math.floor((x.from - run.t0) / DAY)}–${Math.floor((x.by - run.t0) / DAY)}: ${x.status}${x.why ? ' (' + x.why + ')' : ''}${x.credit ? ', credit ' + x.credit : ''}${x.parent ? ', serving ' + x.parent : ''}${x.liabilities?.length ? `, liability on ${x.liabilities.map((l) => `${w.chars[l.who].name}${l.fell ? ` (fell on day ${Math.floor((l.fell - run.t0) / DAY)}: ${w.chars[l.by].name} thinks less of him)` : ''}`).join(', ')}` : ''}${x.intends ? `, he ${x.intends === 'keep' ? 'means to keep it' : 'means to break it'} (private)` : ''}`),
  ]);

  // ---------------------------------------------------------------- day 0: the trouble, by the world's own doors
  P(`### Day 0: ${lou.name} leans on ${nate.name}`);
  const fee = Math.max(15, Math.round((shop.income * 0.08) / 5) * 5);
  const dm = door.demand(w, lou, nate, biz, fee, MATTER);
  P(`*${lou.name}, a soldier in ${marchese.name}’s crew, asks ${nate.name} for $${fee} a week at ${shop.name} (the world’s own protection ask). ${nate.name} answers for himself: ${dm.answer ?? 'nothing'}.*`); P('');
  if (dm.answer === 'yes' || !dm.sit) { run.outcome = `${nate.name} agreed to pay ${lou.name}; there is no dispute`; P(`*${run.outcome}.*`); return run; }
  door.force(w, dm.sit, MATTER);
  run.grievance = Object.values(w.facts).filter((f) => f.kind === 'vandalism' && f.actor === lou.id && f.business === biz).sort((a, b) => b.t - a.t)[0];
  P(`*${lou.name} presses it with force: ${run.grievance?.text ?? 'nothing comes of it'}*`); P('');
  advance(w, w.now + DAY);

  // ---------------------------------------------------------------- day 1: Nate comes to Henry
  P(`### Day 1: ${shop.name}`);
  let v = new Visit(o, w, s, henry, nate, shop.name);
  const help = onSeekHelp(perceive(w, s, nate), lou); v.him_(help);
  if (run.grievance) door.inform(w, nate, henry, run.grievance, MATTER);
  const r1 = request(w, { by: nate.id, of: henry.id, wants: 'intervene', about: MATTER, for: nate.id, against: lou.id, biz, fact: run.grievance?.id });
  v.offer([PROMISE[type], LEAVE]);
  v.pick(PROMISE[type].key);
  const ack = onPromise(perceive(w, s, nate), henry, type, lou); v.him_(ack);
  door.regard(w, nate, henry.id, 'trust', { action: 0.03, effort: 0.02, result: 0.05, restraint: 0.03 }[type], `${henry.name} promised to help`);
  const a1 = agreement(w, [nate.id, henry.id], `${henry.name} to ${nate.name}: ${type === 'result' ? `${lou.name} leaves him alone for 30 days` : type === 'action' ? `he will raise it with ${riz.name}` : `he will try to get ${lou.name} to stop`}`, [nate.id], r1.id);
  const matter = { for: nate.id, against: lou.id, biz, fact: run.grievance?.id };
  const o1 = run.o1 = promise(w, {
    type, obligor: henry.id, beneficiary: nate.id, promisee: nate.id, from: w.now, by: w.now + (type === 'result' ? 30 : 14) * DAY, matter, notify: [nate.id], words: PROMISE[type].key,
    spec: type === 'action' ? { kind: 'actionDone', act: 'raise', target: riz.id, about: MATTER } : type === 'effort' ? { kind: 'effort', acts: ['raise', 'warn'], about: MATTER, floor: 0.15 } : { kind: 'noHostility', actor: lou.id, target: nate.id, biz, days: 30 },
  }, a1);
  r1.status = 'agreed';
  const rh = reach(w, henry, lou);
  v.card('card.promise.' + type, { againstFirst: first(lou.name), days: '30' });
  traceLines(o, 'what Henry can deliver (authority, §6.2)', [rh.can ? `${henry.name} can order ${lou.name} himself` : `${henry.name} cannot order ${lou.name}; the man who can is ${w.chars[rh.via ?? '']?.name ?? 'nobody'}. ${type === 'result' ? 'A result promise beyond his own power: an overpromise if it fails.' : 'He has promised only what he can do himself.'}`]);
  sitrep('records after day 1');

  // ---------------------------------------------------------------- day 2: Henry takes it to his captain
  advance(w, w.now + DAY);
  if (opts.noRaise) { P(`### Day 2: Henry has other things to do`); P(`*Henry never gets round to ${riz.name}. Nothing is said to anyone.*`); P(''); }
  else {
  P(`### Day 2: the club, with ${riz.name}`);
  v = new Visit(o, w, s, henry, riz, 'the club', 2);
  const slotsC = { forName: nate.name, againstName: lou.name };
  v.offer([{ key: 'ask.intervention', note: 'Ask him to take it up with the family.', slots: slotsC }, LEAVE]);
  v.pick('ask.intervention');
  const pred = predictAcceptance(perceive(w, s, henry), riz, false);
  door.raise(w, henry, riz, MATTER, pred, true);
  const r2 = request(w, { by: henry.id, of: riz.id, wants: 'intervene', about: MATTER, for: nate.id, against: lou.id, biz, fact: run.grievance?.id, parent: o1.id });
  let k: Captaincy = captaincyOf(w, riz, nate, lou, henry);
  let r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, [], v.mem); v.him_(r);
  // what Henry can say next is what he has: if he knows what Lou's people did on the captain's ground, he can tell him
  const henryKnows = perceive(w, s, henry).knownFacts((f) => HOSTILE.has(f.kind) && f.actor === lou.id && crewGround(w, riz).has(f.district))[0];
  if (r.decision.chosen !== 'accept') {
    const rows: Row[] = [];
    if (henryKnows) rows.push({ key: 'tell.trouble', note: `Tell him what ${first(lou.name)}’s people did, and where. He may not have heard.`, slots: { againstFirst: first(lou.name), shop: w.biz[henryKnows.business ?? '']?.name ?? 'a shop of ours' } });
    rows.push({ key: 'argue.word', note: 'Put your own word on it. It’s worth what he thinks of you.', slots: { forFirst: first(nate.name) } }, LEAVE);
    v.offer(rows);
    if (opts.tell !== false && henryKnows) {
      v.pick('tell.trouble');
      door.inform(w, henry, riz, henryKnows, MATTER);
      k = captaincyOf(w, riz, nate, lou, henry);
      r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, ['ground'], v.mem); v.him_(r);
    } else v.pick('leave');
  }
  settleNow(w);
  if (r.decision.chosen === 'accept') {
    const chair = chairFor(w, lou, nate) ?? marchese;
    const a2 = agreement(w, [henry.id, riz.id], `${riz.name} will speak to ${chair.name}`, [henry.id], r2.id);
    run.o2 = promise(w, { type: 'action', obligor: riz.id, beneficiary: henry.id, promisee: henry.id, spec: { kind: 'actionDone', act: 'raise', target: chair.id, about: MATTER }, from: w.now, by: w.now + 7 * DAY, parent: o1.id, matter, notify: [henry.id], liabilities: [{ who: henry.id, by: riz.id, feeling: 'trust', amount: 0.15, why: `it turned ugly over ${henry.name}'s matter` }], words: 'accept.intervention.liable' }, a2);
    r2.status = 'agreed';
    v.card('card.accept.intervention.liable', { theirCaptainFirst: first(chair.name) });
  } else { r2.status = 'refused'; v.card('card.refuse.intervention', { forFirst: first(nate.name) }); }
  sitrep('records after day 2');
  }

  // ---------------------------------------------------------------- the days that follow, in the real engine
  P(`### Days 3–${opts.days ?? 32}: the world goes on`);
  const seen = new Set<string>(), lines: string[] = [];
  const status0 = new Map<string, string>();
  for (let d = 3; d <= (opts.days ?? 32); d++) {
    advance(w, run.t0 + d * DAY);
    for (const e of offstage) { const key = e.t + e.what; if (seen.has(key)) continue; seen.add(key); lines.push(`day ${Math.floor((e.t - run.t0) / DAY)}: ${e.what}${e.reply ? `  [${e.reply.decision.candidates.map((x) => `${x.move === e.reply!.decision.chosen ? '▶' : ''}${x.move} ${x.value}`).join(', ')}]` : ''}`); }
    for (const f of Object.values(w.facts)) if (!seen.has(f.id) && f.t > run.t0 + 2 * DAY && HOSTILE.has(f.kind) && f.actor && (f.actor === lou.id || w.chars[f.actor]?.bossId === lou.id) && (f.victim === nate.id || f.business === biz)) { seen.add(f.id); lines.push(`day ${Math.floor((f.t - run.t0) / DAY)}: ${f.text}`); }
    for (const x of social(w).obs) { const st = x.status + (x.why ?? ''); if (status0.get(x.id) !== st && x.status !== 'pending') lines.push(`day ${Math.floor(((x.settled ?? w.now) - run.t0) / DAY)}: ${x.id} (${w.chars[x.obligor].name}, ${x.type}) ${x.status}: ${x.why}${x.credit ? `; credit: ${x.credit}` : ''}${x.liabilities?.some((l) => l.fell) ? '' : ''}`); status0.set(x.id, st); }
    run.o3 ??= social(w).obs.find((x) => x.order && x.obligor === lou.id);
  }
  traceLines(o, 'what happened off stage (Henry sees none of it)', lines.length ? lines : ['nothing']);
  sitrep(`records on day ${opts.days ?? 32}`);

  // ---------------------------------------------------------------- Henry goes back to Nate
  P(`### Day ${(opts.days ?? 32) + 1}: back at ${shop.name}`);
  advance(w, w.now + DAY);
  v = new Visit(o, w, s, henry, nate, shop.name);
  const pN = perceive(w, s, nate);
  const since = pN.knownFacts((f) => HOSTILE.has(f.kind) && (f.actor === lou.id || w.chars[f.actor ?? '']?.bossId === lou.id) && (f.victim === nate.id || f.business === biz) && f.t > o1.from);
  if (since.length && type === 'result') {
    v.him_(onPromiseSeenBroken(pN, henry));
  } else {
    v.him_(onReturnToPromisee(pN, henry, since.length === 0, dayOf(w, run.t0), lou));
    const rows: Row[] = o1.status === 'kept' || run.o2?.status === 'kept' ? [{ key: 'report.done', note: 'Tell him you took it to the family.' }] : [{ key: 'report.admitNotDone', note: 'Tell him the truth: it didn’t get anywhere.' }];
    v.offer([...rows, LEAVE]);
    v.pick(rows[0].key);
    v.him_(onReport(perceive(w, s, nate), henry, rows[0].key === 'report.done' ? 'done' : 'admitNotDone'));
    if (o1.status === 'kept' && since.length === 0) { door.favour(w, nate, henry, 1, `${henry.name} saw to ${lou.name}`, MATTER); v.card('card.kept', { againstFirst: first(lou.name) }); }
  }
  run.outcome = `O1 ${status(run.o1)}; O2 ${status(run.o2)}; O3 ${status(run.o3)}`;
  traceLines(o, 'how it ended (records)', [run.outcome, `${nate.name}’s trust in ${henry.name}: ${(nate.rels[henry.id]?.trust ?? 0).toFixed(2)}; ${riz.name}’s: ${(riz.rels[henry.id]?.trust ?? 0).toFixed(2)}; ${marchese.name}’s grudge against ${lou.name}: ${(marchese.rels[lou.id]?.grudge ?? 0).toFixed(2)}`, `favours: ${w.favours.filter((f) => f.to === henry.id && f.from === nate.id).length ? `${nate.name} owes ${henry.name} one` : 'none'}`, `${lou.name}’s demand on ${shop.name}: ${askBetween(w, 'protect', lou.id, nate.id, biz) ? 'still open' : 'withdrawn or settled'}`]);
  return run;
}
