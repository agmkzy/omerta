// Scenario G (spec §17.9), headless at Gate 2b: thirty days, the same five people, the player's choices scripted. Each visit opens
// with what that man brings to it, from his own state: a request he has decided to make of Henry, a promise of Henry's he is waiting
// on, a promise of his own he has news of, a grievance, or nothing (a greeting). Henry's options are what the situation offers, and
// remember what was refused: a request he was turned down on is not offered again unless something has changed. Days pass in the real
// engine; everyone else goes on with their own pursuits in between.
//
// Three runs differ in one thing each: Henry knew Nate before the trouble or didn't (does Nate come to him?), and, when Nate does,
// whether Henry keeps his word or lies about it (what Nate comes to believe, and what it costs Henry when he finds out).
import { createWorld } from '../world';
import { advance } from '../engine';
import { compat, ownerBiz, peek } from '../core';
import { crewGround } from '../econ';
import { openAsk, shopInPlay } from '../asks';
import { DAY, type Character, type Fact, type Id, type World } from '../types';
import { newSession, perceive, type Session } from './perception';
import { onArrival, onIntervention, onPromise, onPromiseSeenBroken, onProtectionDemand, onReport, onReturnToPromisee, onSeekHelp, predictAcceptance, spendTimeAccount, type Reply } from './respond';
import { Out, Visit, LEAVE, first, traceLines, type Row } from './harness';
import { HOSTILE, type ObType, type Obligation } from './obligations';
import { social } from './social';
import { agreement, captaincyOf, promise, request } from './tick';
import { captainOf, chairFor } from './authority';
import { belief, judge, say } from './minds';
import { annals } from './annals';
import { emergence } from './emergence';
import * as door from './doors';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
export type Variant = 'acquainted' | 'stranger' | 'liar';
export interface GCast { w: World; henry: Character; riz: Character; lou: Character; nate: Character; frank: Character; friend: Character; biz: Id }
export function gcast(seed = 3): GCast | undefined {
  const w = createWorld(seed, 'Henry Tedesco'); social(w);
  const henry = w.chars[w.playerId!], riz = captainOf(w, henry);
  if (!riz) return undefined;
  const lou = Object.values(w.chars).filter((c) => c.alive && c.rank === 'soldier' && c.familyId === henry.familyId && captainOf(w, c) && captainOf(w, c)!.id !== riz.id).sort(byId)[0];
  const ground = crewGround(w, riz);
  const shops = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId && ownerBiz(w, c.id)?.open && !ownerBiz(w, c.id)!.protection && ownerBiz(w, c.id)!.kind !== 'casino' && ground.has(ownerBiz(w, c.id)!.district)).sort(byId);
  const friend = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && captainOf(w, c)?.id === riz.id).sort(byId)[0];
  if (!lou || shops.length < 2 || !friend) return undefined;
  // Nate is the first of them nobody is already working on who would turn Lou down (his own decision, asked of his own perception);
  // Frank another
  const fee = (c: Character) => Math.max(15, Math.round((ownerBiz(w, c.id)!.income * 0.08) / 5) * 5);
  const nate = shops.find((c) => { const ss = newSession(); ss.told[c.id] = { [lou.id]: { family: w.fam[lou.familyId!].name, name: lou.name, basis: { kind: 'claimed', ref: 'x' } } }; return !shopInPlay(w, ownerBiz(w, c.id)!.id) && ['refuse', 'dismiss'].includes(onProtectionDemand(perceive(w, ss, c), lou, fee(c), 'plain').decision.chosen); }) ?? shops[0];
  const frank = shops.find((c) => c.id !== nate.id && !shopInPlay(w, ownerBiz(w, c.id)!.id)) ?? shops.find((c) => c.id !== nate.id)!;
  return { w, henry, riz, lou, nate, frank, friend, biz: ownerBiz(w, nate.id)!.id };
}

export interface GMetrics { visits: number; reoffered: number; openings: Record<string, string[]>; nateCame: boolean; routineVisits: number; routineDevelopments: number; spendTexts: string[]; liesBelieved: number; liesFound: number; trustNate: number[] }
export function scenarioG(variant: Variant, seed = 3): { o: Out; m: GMetrics; c: GCast } {
  const c = gcast(seed)!, { w, henry, riz, lou, nate, frank, friend, biz } = c, o = new Out(), P = (x = '') => o.P(x), s: Session = newSession();
  annals.length = 0;
  const t0 = w.now, day = () => Math.floor((w.now - t0) / DAY);
  const m: GMetrics = { visits: 0, reoffered: 0, openings: {}, nateCame: false, routineVisits: 0, routineDevelopments: 0, spendTexts: [], liesBelieved: 0, liesFound: 0, trustNate: [] };
  // what Henry was turned down on, and when: it is offered again only if something that bears on it has changed since, as Henry
  // knows it (for the captain: something new about Lou's people, or Henry has told him; for a shopkeeper: who protects him, or
  // trouble on his street)
  const refused = new Map<string, { t: number; seen: number }>();
  const bearing: Record<string, () => number> = {
    'ask:riz': () => Object.values(w.facts).filter((f) => henry.known[f.id] && HOSTILE.has(f.kind) && (f.actor === lou.id || w.chars[f.actor ?? '']?.bossId === lou.id)).length + (toldRiz ? 100 : 0),
    'demand:frank': () => { const b = ownerBiz(w, frank.id)!; return (b.protection ? 1000 + b.protection.collectorId.length : 0) + Object.values(w.facts).filter((f) => henry.known[f.id] && HOSTILE.has(f.kind) && f.district === b.district).length; },
  };
  const henryKnows = (k: string) => bearing[k]?.() ?? 0;
  const changed = (k: string) => { const r = refused.get(k); return !r || henryKnows(k) !== r.seen; };
  let o1: Obligation | undefined, o2: Obligation | undefined, grievance: Fact | undefined, toldRiz = false, reproached = false, thanked = false, reported: string | undefined;
  const said = new Map<Id, Set<string>>();
  const opened = (who: Character, key: string) => { (m.openings[who.name] ??= []).push(key); };
  const say1 = (v: Visit, r: Reply, who: Character) => { v.him_(r); opened(who, r.meaning.key); };
  const records = () => { const x = social(w); return x.requests.length + x.obs.length + x.agreements.length; };
  const MATTER = 'trouble:' + lou.id;

  P(`# Scenario G: thirty days with the same five people (${variant})`); P('');
  P(`*${henry.name}, ${riz.name} (his captain), ${nate.name} (${ownerBiz(w, nate.id)!.name}), ${frank.name} (${ownerBiz(w, frank.id)!.name}), ${friend.name} (in Henry's crew), and ${lou.name}, a soldier in another crew, who on day 4 starts leaning on ${nate.name}. ${variant === 'acquainted' ? 'Henry has been in to see Nate on the first days.' : variant === 'stranger' ? 'Henry has never been into Nate’s shop before the trouble.' : 'Henry knows Nate, promises to help, never does, and says he did.'}*`); P('');
  // (before the month begins: in two of the runs Henry has been in Nate's shop a few evenings; a player's own doing, through the door)
  if (variant !== 'stranger') for (let i = 0; i < 4; i++) door.spendTime(w, henry, nate, 'before');
  const plan: (Character | null)[] = variant === 'stranger' ? [frank, friend, riz, lou, friend, frank, nate] : [friend, nate, frank, riz, lou, friend, nate];
  for (let d = 1; d <= 30; d++) {
    if (d === 1) {
      // the one thing set going: Lou asks Nate for money. Everything after (Nate's answer, what Lou does next, what Nate does about
      // it) is theirs
      const dm = door.demand(w, lou, nate, biz, Math.max(15, Math.round((w.biz[biz].income * 0.08) / 5) * 5), MATTER);
      P(`*Day 1, morning: ${lou.name} asks ${nate.name} for money. ${nate.name} says ${dm.answer}.*`); P('');
    }
    advance(w, t0 + d * DAY);
    grievance ??= Object.values(w.facts).filter((f) => HOSTILE.has(f.kind) && f.business === biz && (f.actor === lou.id || f.victim === lou.id)).sort((a, b) => b.t - a.t)[0];
    const who = plan[(d - 1) % plan.length];
    if (!who) continue;
    m.visits++;
    const before = records();
    P(`### Day ${d}: ${who.name}`);
    // (what he has said to Henry lately, across visits: a man doesn't greet you with the same words every time; forgotten after a while)
    const lately = (said.get(who.id) ?? new Set<string>()); said.set(who.id, lately); if (lately.size > 12) lately.clear();
    const v = new Visit(o, w, s, henry, who, ownerBiz(w, who.id)?.name ?? 'the club', 2, lately);
    let routine = false;
    if (who === nate) {
      const asking = social(w).requests.find((r) => r.by === nate.id && r.of === henry.id && r.status === 'open');
      if (asking && !o1) {
        m.nateCame = true;
        say1(v, onSeekHelp(perceive(w, s, nate), lou), nate);
        if (grievance) door.inform(w, nate, henry, grievance, MATTER);
        const rows: Row[] = [{ key: 'promise.action', note: `A promise to act: you’ll raise it with ${first(riz.name)}. Kept when you do, whatever he says.` }, { key: 'promise.effort', note: 'A promise to try.' }, { key: 'promise.result', note: `A promise of a result. You can’t order ${first(lou.name)} yourself.` }, LEAVE];
        v.offer(rows);
        const type: ObType = 'action';
        v.pick('promise.' + type);
        v.him_(onPromise(perceive(w, s, nate), henry, type, lou));
        const g = agreement(w, [nate.id, henry.id], `${henry.name} will raise it with ${riz.name}`, [nate.id], asking.id);
        o1 = promise(w, { type, obligor: henry.id, beneficiary: nate.id, promisee: nate.id, spec: { kind: 'actionDone', act: 'raise', target: riz.id, about: MATTER }, from: w.now, by: w.now + 10 * DAY, matter: { for: nate.id, against: lou.id, biz, fact: grievance?.id }, notify: [nate.id], words: 'promise.action' }, g);
        asking.status = 'agreed';
        v.card('card.promise.action', {});
      } else if (o1 && reported && belief(w, nate, 'ob:' + o1.id).value === reported && !reproached && !(reported !== 'done' && social(w).log.some((a) => a.actor === henry.id && a.act === 'raise' && a.about === MATTER))) {
        // he has heard from Henry, believes it, and nothing has changed: an ordinary visit, warmer or cooler for it
        routine = true;
        say1(v, onArrival(perceive(w, s, nate), henry, 'the afternoon'), nate);
        v.offer([{ key: 'spend.time', note: 'Stay and talk a while.' }, LEAVE]); v.pick('spend.time'); door.spendTime(w, henry, nate, 'visit');
        const a = spendTimeAccount(perceive(w, s, henry), perceive(w, s, nate), nate, ownerBiz(w, nate.id)!.name, compat(w, henry, nate), String(d)); P(`> ${a.text}`); P('');
      } else if (o1 && (o1.status === 'pending' || w.now - (o1.settled ?? w.now) < 12 * DAY) && !thanked && !reproached) {
        // he opens with where things stand as he knows it
        const troubleSince = Object.values(w.facts).some((f) => HOSTILE.has(f.kind) && (f.actor === lou.id || w.chars[f.actor ?? '']?.bossId === lou.id) && f.business === biz && f.t > o1!.from && nate.known[f.id]);
        const bv = belief(w, nate, 'ob:' + o1.id);
        if ((s as Session & { lied?: boolean }).lied && (bv.value === 'notDone' || bv.value === 'broken')) {
          say1(v, onPromiseSeenBroken(perceive(w, s, nate), henry), nate); reproached = true; m.liesFound++;
        } else {
          say1(v, onReturnToPromisee(perceive(w, s, nate), henry, !troubleSince && day() > 14, Math.floor((w.now - o1.from) / DAY), lou), nate);
          const raised = social(w).log.some((a) => a.actor === henry.id && a.act === 'raise' && a.about === MATTER);
          const rows: Row[] = raised ? [{ key: 'report.done', note: 'Tell him you took it to the family.' }] : [{ key: 'report.admitNotDone', note: 'Tell him the truth: you haven’t yet.' }, { key: 'report.done', note: 'Tell him you took it to the family. It isn’t true.' }];
          v.offer([...rows, LEAVE]);
          const lie = !raised && variant === 'liar';
          const pick = raised ? 'report.done' : lie ? 'report.done' : 'report.admitNotDone';
          v.pick(pick);
          // (not yet, while there is time: that is not the same as not done)
          const val = pick === 'report.done' ? 'done' : w.now > o1.by ? 'notDone' : 'notYet';
          say(w, henry, nate, 'ob:' + o1.id, val, 'own', pick === 'report.done' ? raised : true, pick === 'report.done' ? 'I took it to the family' : 'I haven’t got to it');
          if (lie) { (s as Session & { lied?: boolean }).lied = true; m.liesBelieved++; }
          reported = val;
          judge(w, nate, o1);
          v.him_(onReport(perceive(w, s, nate), henry, pick === 'report.done' ? 'done' : 'admitNotDone'));
          if (raised) thanked = true;
        }
      } else {
        routine = true;
        say1(v, onArrival(perceive(w, s, nate), henry, 'the afternoon'), nate);
        v.offer([{ key: 'buy.small', note: 'Buy something.', slots: { item: perceive(w, s, henry).particulars.smallBuy(biz) ?? '' } }, { key: 'spend.time', note: 'Stay and talk a while.' }, LEAVE]);
        v.pick('spend.time'); door.spendTime(w, henry, nate, 'visit');
        const a = spendTimeAccount(perceive(w, s, henry), perceive(w, s, nate), nate, ownerBiz(w, nate.id)!.name, compat(w, henry, nate), String(d)); P(`> ${a.text}`); P('');
      }
    } else if (who === riz) {
      // Rizzo raises what is significant to him and to Henry: what came of something he promised; otherwise a greeting
      const news = o2 && o2.status !== 'pending' && !(o2 as Obligation & { told?: boolean }).told;
      if (news) { (o2 as Obligation & { told?: boolean }).told = true; say1(v, { decision: { by: riz.id, constraints: [], candidates: [], chosen: 'report', aim: 'tell you what came of it' }, meaning: { key: o2!.status === 'kept' ? 'answer.progress.done' : 'answer.progress.pending', stance: 'flat', toward: 'speaker', slots: { theirCaptainFirst: first((chairFor(w, lou, nate) ?? riz).name), againstFirst: first(lou.name), forFirst: first(nate.name) } }, intent: 'inform', honest: true }, riz); }
      else say1(v, onArrival(perceive(w, s, riz), henry, 'the evening', false), riz);
      const owe = o1 && o1.status === 'pending' && variant !== 'liar';
      const rows: Row[] = [];
      if (owe && !o2 && changed('ask:riz')) rows.push({ key: 'ask.intervention', note: 'Ask him to take it up with the family.', slots: { forName: nate.name, againstName: lou.name } });
      else if (owe && !o2) m.reoffered += 0; // (refused, and nothing has changed: not offered)
      if (owe && !o2 && grievance && henry.known[grievance.id] && !toldRiz) rows.push({ key: 'tell.trouble', note: `Tell him what ${first(lou.name)}’s people did.`, slots: { againstFirst: first(lou.name), shop: w.biz[biz].name } });
      rows.push({ key: 'spend.time', note: 'Have a drink with him.' }, LEAVE);
      v.offer(rows);
      if (rows[0].key === 'tell.trouble' || rows[0].key === 'ask.intervention') {
        if (rows.some((r) => r.key === 'tell.trouble') && refused.has('ask:riz')) { v.pick('tell.trouble'); door.inform(w, henry, riz, grievance!, MATTER); toldRiz = true; v.offer([{ key: 'ask.intervention', note: 'Ask him again, now he knows.', slots: { forName: nate.name, againstName: lou.name } }, LEAVE]); }
        if (refused.has('ask:riz') && !changed('ask:riz') && !toldRiz) m.reoffered++;
        v.pick('ask.intervention');
        door.raise(w, henry, riz, MATTER, predictAcceptance(perceive(w, s, henry), riz, toldRiz), true);
        const r2 = request(w, { by: henry.id, of: riz.id, wants: 'intervene', about: MATTER, for: nate.id, against: lou.id, biz, fact: grievance?.id, parent: o1!.id });
        const k = captaincyOf(w, riz, nate, lou, henry);
        const r = onIntervention(perceive(w, s, riz), henry, nate, lou, k, toldRiz ? ['ground'] : [], v.mem); v.him_(r);
        if (r.decision.chosen === 'accept') {
          const chair = chairFor(w, lou, nate) ?? riz;
          const g = agreement(w, [henry.id, riz.id], `${riz.name} will speak to ${chair.name}`, [henry.id], r2.id);
          o2 = promise(w, { type: 'action', obligor: riz.id, beneficiary: henry.id, promisee: henry.id, spec: { kind: 'actionDone', act: 'raise', target: chair.id, about: MATTER }, from: w.now, by: w.now + 7 * DAY, parent: o1!.id, matter: { for: nate.id, against: lou.id, biz, fact: grievance?.id }, notify: [henry.id], liabilities: [{ who: henry.id, by: riz.id, feeling: 'trust', amount: 0.15, why: `it turned ugly over ${henry.name}'s matter` }], words: 'accept.intervention.liable' }, g);
          r2.status = 'agreed';
        } else { r2.status = 'refused'; refused.set('ask:riz', { t: w.now, seen: henryKnows('ask:riz') }); }
      } else { routine = true; v.pick('spend.time'); door.spendTime(w, henry, riz, 'visit'); const a = spendTimeAccount(perceive(w, s, henry), perceive(w, s, riz), riz, 'the club', compat(w, henry, riz), String(d)); P(`> ${a.text}`); P(''); }
    } else if (who === frank) {
      const arr = onArrival(perceive(w, s, frank), henry, 'the morning'); say1(v, arr, frank);
      const rows: Row[] = [];
      if (ownerBiz(w, frank.id)!.protection?.collectorId !== henry.id && changed('demand:frank')) rows.push({ key: 'demand.protection', note: 'Put it to him plainly.', slots: { amt: '$30' } });
      rows.push({ key: 'buy.small', note: 'Buy something.', slots: { item: perceive(w, s, henry).particulars.smallBuy(ownerBiz(w, frank.id)!.id) ?? '' } }, LEAVE);
      v.offer(rows);
      if (rows[0].key === 'demand.protection' && arr.decision.chosen === 'greet') {
        if (refused.has('demand:frank')) m.reoffered += changed('demand:frank') ? 0 : 1;
        v.pick('demand.protection');
        s.told[frank.id] = { [henry.id]: { family: w.fam[henry.familyId!].name, name: henry.name, basis: { kind: 'claimed', ref: 'he said so' } } };
        const r = onProtectionDemand(perceive(w, s, frank), henry, 30, 'plain', v.mem); v.him_(r);
        if (r.decision.chosen !== 'accept' && r.decision.chosen !== 'counter') refused.set('demand:frank', { t: w.now, seen: henryKnows('demand:frank') });
        else {
          // agreed: carried out by the world's own protection ask (the same yes any collector's agreement gets)
          const sit = openAsk(w, 'protect', henry, frank, { biz: ownerBiz(w, frank.id)!.id, amt: r.decision.chosen === 'counter' ? r.counterAmt : 30, why: `${henry.name} wants ${frank.name} to pay him` });
          if (sit) door.agree(w, sit, 'protect:' + frank.id);
          v.card(r.decision.chosen === 'counter' ? 'card.agreed.counter' : 'card.accept.protection', { amt: `$${r.counterAmt ?? 30}` });
        }
      } else { routine = true; v.pick(rows.find((r) => r.key === 'buy.small') ? 'buy.small' : 'leave'); }
    } else if (who === lou) {
      // the man leaning on Nate: Henry has no business with him, and nothing is made up to fill the visit
      routine = true;
      say1(v, onArrival(perceive(w, s, lou), henry, 'the evening', false), lou);
      v.offer([{ key: 'spend.time', note: 'Have a drink with him.' }, LEAVE]); v.pick('leave');
    } else if (who === friend) {
      routine = true;
      say1(v, onArrival(perceive(w, s, friend), henry, 'the evening', false), friend);
      v.offer([{ key: 'spend.time', note: 'Have a drink with him.' }, LEAVE]); v.pick('spend.time'); door.spendTime(w, henry, friend, 'visit');
      const a = spendTimeAccount(perceive(w, s, henry), perceive(w, s, friend), friend, 'Fino’s', compat(w, henry, friend), String(d));
      m.spendTexts.push(a.text); P(`> ${a.text}`); P('');
    }
    const dev = records() - before;
    if (routine) { m.routineVisits++; if (dev) m.routineDevelopments++; }
    if (day() % 5 === 0 || d === 30) m.trustNate.push(Math.round(peek(nate, henry.id).trust * 100) / 100);
  }
  // what happened that Henry did not see
  const mine = annals.filter((e) => [nate.id, riz.id, lou.id, frank.id, friend.id].includes(e.who) && !/next move|answers .*demand/.test(e.what)).map((e) => `day ${Math.floor((e.t - t0) / DAY)}: ${e.what}`);
  traceLines(o, 'what happened between them, off stage (Henry sees none of it)', mine.length ? mine.slice(0, 60) : ['nothing']);
  const e = emergence(w);
  traceLines(o, 'records at the end', [`Henry's promise: ${o1 ? `${o1.status}${o1.why ? ' (' + o1.why + ')' : ''}` : 'never made'}; the captain's: ${o2 ? `${o2.status}${o2.why ? ' (' + o2.why + ')' : ''}` : 'never made'}`, `${nate.name} believes of Henry's promise: ${o1 ? JSON.stringify(belief(w, nate, 'ob:' + o1.id).value ?? 'nothing') : '-'}; his trust in Henry over the month: ${m.trustNate.join(' → ')}`, `the world: ${e.pursuits} pursuits, ${e.requests} requests, ${e.obligations} obligations (${e.broken} broken), ${e.revisions} belief revisions`]);
  return { o, m, c };
}
