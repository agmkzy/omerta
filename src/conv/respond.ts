// The response decision (spec §4.4), minimal for Gate 1: first what he cannot or must not do (constraints), then what each
// permissible move is worth to him, from his own perception. Every term is recorded, so the trace can say why.
import type { Character } from '../types';
import type { Perception } from './perception';
import type { Candidate, Decision, Meaning, Term } from './types';
import type { EncounterMemory } from './encounter';

const r2 = (x: number) => Math.round(x * 100) / 100;
const first = (n: string) => n.split(' ')[0];
const sur = (n: string) => n.split(' ').slice(-1)[0];
const cand = (move: string, terms: Term[], crosses: string[] = []): Candidate => ({ move, terms: terms.map((t) => ({ ...t, value: r2(t.value) })), crosses, value: r2(terms.reduce((a, t) => a + t.value, 0)) });
const best = (cs: Candidate[]) => cs.filter((c) => c.value > -9).sort((a, b) => b.value - a.value)[0];
export interface Reply { decision: Decision; meaning: Meaning; intent: string; honest: boolean; aim?: string; changes?: string[] }

// ---------------------------------------------------------------- arriving: does he talk to you at all
export function onArrival(p: Perception, visitor: Character, hour: string): Reply {
  const t = p.temper, f = p.feelingFor(visitor);
  const bad = p.knownFacts((x) => (x.actor === visitor.id || x.victim === visitor.id) && ['protection_refused', 'vandalism', 'beating', 'threat'].includes(x.kind));
  const wary = Math.min(1, bad.length * 0.6 + f.grudge);
  const cs = [
    cand('greet', [{ name: 'ordinary courtesy', value: 0.5 }, { name: 'agreeable', value: t.agreeable * 0.3 }, { name: 'what he has heard of you', value: -wary * 0.9, basis: bad[0]?.id }]),
    cand('dismiss.pretext', [{ name: 'what he has heard of you', value: wary * 0.8, basis: bad[0]?.id }, { name: 'caution', value: t.caution * 0.3 }, { name: 'fear of you', value: f.fear * 0.3 }]),
    cand('dismiss.hostile', [{ name: 'what he has heard of you', value: wary * 0.6 }, { name: 'pride', value: t.pride * 0.4 }, { name: 'volatility', value: t.volatility * 0.3 }, { name: 'fear of you', value: -f.fear - (1 - t.courage) * 0.3 }]),
  ];
  const c = best(cs);
  const known = f.known >= 0.3;
  return {
    decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, aim: c.move === 'greet' ? undefined : 'get rid of you' },
    meaning: c.move === 'greet' ? { key: known ? 'greet.known' : 'greet.customer', stance: 'polite', toward: 'speaker' } : { key: c.move === 'dismiss.pretext' ? 'dismiss.pretext' : 'dismiss.hostile', stance: c.move === 'dismiss.pretext' ? 'cold' : 'hostile', toward: 'speaker', slots: { hour } },
    intent: c.move === 'dismiss.pretext' ? 'dismiss' : c.move, honest: c.move !== 'dismiss.pretext', aim: c.move === 'greet' ? undefined : 'get rid of you',
  };
}

// ---------------------------------------------------------------- hearing who a man is, and choosing what to say back
export function onIntroduction(p: Perception, speaker: Character, family: string): Reply {
  const t = p.temper, f = p.feelingFor(speaker), arr = p.own.arrangement, kin = p.own.kin.find((k) => k.inLife && k.family && k.family !== family);
  const distress = (p.own.shop?.distress ?? 0) > 0 || (p.own.shop && p.own.cash < 150);
  const st = p.streetPressure().n;
  const cs = [
    arr ? cand('warnOff.protector', [{ name: 'he is looked after already', value: 0.4, basis: 'arrangement' }, { name: 'caution', value: t.caution * 0.5 }, { name: arr.family === family ? 'the same family: he can name the man' : 'another family stands behind him', value: arr.family === family ? 0.1 : 0.3 }, { name: 'fear of you', value: -f.fear * 0.2 }]) : cand('warnOff.protector', [{ name: 'nobody to name', value: -10 }]),
    kin ? cand('warnOff.kin', [{ name: `his cousin is with the ${kin.family}s`, value: 0.55, basis: 'kin' }, { name: 'caution', value: t.caution * 0.3 }, { name: 'pride', value: t.pride * 0.2 }]) : cand('warnOff.kin', [{ name: 'no kin in the life', value: -10 }]),
    cand('probe', [{ name: 'his business is in trouble', value: distress ? 0.55 : 0 }, { name: 'he does not trust you yet', value: (1 - f.trust) * 0.15 }, { name: 'agreeable', value: t.agreeable * 0.15 }]),
    cand('appease', [{ name: 'fear of a family man (his courage)', value: (1 - t.courage) * 0.9 }, { name: 'trouble on his street', value: st * 0.15 }]),
    cand('proud', [{ name: 'pride', value: t.pride * 0.8 }, { name: 'volatility', value: t.volatility * 0.2 }, { name: 'fear', value: -(1 - t.courage) * 0.5 }, { name: 'he already pays someone', value: arr ? -0.3 : 0 }]),
    cand('neutral', [{ name: 'nothing to say about it', value: 0.3 }]),
  ];
  const c = best(cs);
  const youName = speaker.name, slots: Record<string, string> = { youName, youFamily: family, youSurname: sur(youName) };
  let key = 'react.introduction.' + c.move;
  if (c.move === 'warnOff.protector' && arr) { key = 'react.introduction.warnOff.' + (arr.family === family ? 'sameFamily' : 'otherFamily'); Object.assign(slots, { collectorFirst: first(arr.collector), collectorFamily: arr.family }); }
  if (c.move === 'warnOff.kin' && kin) { key = 'react.introduction.warnOff.kin'; Object.assign(slots, { kinFirst: first(kin.name), kinFamily: kin.family! }); }
  const aim = c.move.startsWith('warnOff') ? 'warn you off' : c.move === 'probe' ? 'find out what you want' : c.move === 'appease' ? 'keep you sweet' : c.move === 'proud' ? 'stand his ground' : undefined;
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, aim }, meaning: { key, stance: c.move === 'appease' ? 'afraid' : c.move === 'proud' ? 'cold' : c.move === 'probe' ? 'flat' : 'polite', toward: c.move.startsWith('warnOff') ? 'third' : 'speaker', implies: c.move.startsWith('warnOff') ? 'warning' : 'none', slots }, intent: 'inform', honest: true, aim, changes: [`${p.self.name} now believes ${speaker.name} is with the ${family} family (he said so)`] };
}

// ---------------------------------------------------------------- a demand for protection (said outright, or read into a remark)
export function onProtectionDemand(p: Perception, asker: Character, fee: number, how: 'plain' | 'soft' | 'lean' | 'inferred', mem?: EncounterMemory): Reply & { counterAmt?: number; followups: { key: string; note: string }[] } {
  const t = p.temper, f = p.feelingFor(asker), arr = p.own.arrangement, shop = p.own.shop!;
  const who = p.identityOf(asker), st = p.streetPressure();
  const kin = p.own.kin.find((k) => k.inLife && k.family && k.family !== who.family);
  const distressed = shop.distress > 0 || p.own.cash < 150;
  const burden = fee / Math.max(20, shop.income * 0.1);
  // stage 1: what he cannot, or must not, do
  const constraints: Decision['constraints'] = [];
  if (arr) constraints.push({ kind: 'obliged', source: `he pays ${arr.collector} (${arr.family})` });
  if (burden > 1.4) constraints.push({ kind: 'cannot', source: `$${fee} a week is beyond what the place makes` });
  // stage 2: what each move is worth to him
  // (how much he fears what follows a refusal, then how much of that fear his nerve lets through)
  const fear = Math.min(1, 0.08 + (who.known ? 0.3 : 0) + st.n * 0.12 + (how === 'lean' ? 0.3 : 0) + f.fear) * (1.2 - t.courage);
  const money = -burden * (distressed ? 0.7 : 0.4);
  const cs = [
    cand('accept', [{ name: 'fear of what happens if he says no', value: fear * 1.4, basis: st.basis[0]?.ref }, { name: 'what it costs him', value: money }, { name: 'pride', value: -t.pride * 0.4 }, ...(arr ? [{ name: `paying twice, and crossing ${first(arr.collector)}`, value: -0.6 - t.caution * 0.3 }] : []), ...(burden > 1.4 ? [{ name: 'he cannot pay it', value: -1 }] : [])], [...(arr ? ['obliged'] : []), ...(burden > 1.4 ? ['cannot'] : [])]),
    cand('counter', arr ? [{ name: 'he is already looked after', value: -10 }] : [{ name: 'he wants the street quiet', value: (st.n * 0.12 + (distressed ? 0.2 : 0)) }, { name: 'fear (bargaining with it takes nerve)', value: fear * 0.9 * Math.min(1, t.courage * 2) }, { name: 'it costs less than asked', value: money * 0.4 }, { name: 'he would rather bargain than refuse', value: (t.agreeable * 0.2 + (distressed ? 0.3 : 0)) * (0.4 + t.courage) }, { name: 'pride', value: -t.pride * 0.3 }]),
    cand('refuse', [{ name: 'pride', value: t.pride * 0.45 }, { name: 'courage', value: t.courage * 0.35 }, ...(arr ? [{ name: `${first(arr.collector)} looks after him`, value: 0.55, basis: 'arrangement' }] : []), ...(!who.known ? [{ name: 'he does not know who you are', value: 0.25 }] : []), { name: 'fear', value: -fear * 1.1 }]),
    cand('refer', kin ? [{ name: `his cousin ${first(kin.name)} is with the ${kin.family}s`, value: 0.6, basis: 'kin' }, { name: 'caution', value: t.caution * 0.4 }, { name: 'fear', value: fear * 0.3 }] : [{ name: 'nobody to send you to', value: -10 }]),
    cand('dismiss', [{ name: 'pride', value: t.pride * 0.6 }, { name: 'volatility', value: t.volatility * 0.45 }, { name: 'fear', value: -fear * 1.3 }, { name: 'caution', value: -t.caution * 0.35 }, { name: 'he is looked after', value: arr ? 0.1 : 0 }]),
  ];
  const c = best(cs);
  // the reason he gives: the decisive factor, or a cover for it
  let grounds = 'doesNotKnow', honest = true, stance: Meaning['stance'] = 'flat', toward: Meaning['toward'] = 'speaker', implies: Meaning['implies'] = 'none';
  const slots: Record<string, string> = { youName: asker.name, youSurname: sur(asker.name), youFamily: who.family ?? '', amt: `$${fee}` };
  let key = 'refuse.protection';
  let counterAmt: number | undefined;
  if (c.move === 'refuse') {
    const top = [...c.terms].sort((a, b) => b.value - a.value)[0];
    if (top.name.includes('looks after him') && arr) {
      grounds = how === 'inferred' ? 'hasArrangement.inferred' : 'hasArrangement'; stance = 'cold'; toward = 'third'; implies = 'warning';
      Object.assign(slots, { collectorFirst: first(arr.collector) });
    } else if (top.name === 'pride') { grounds = t.pride > 0.6 && t.volatility > 0.5 ? 'pride' : 'doesNotKnow'; stance = grounds === 'pride' ? 'hostile' : 'indignant'; toward = 'request'; }
    else grounds = 'doesNotKnow';
    // a man who is really afraid of being unable to pay, and too proud to say so, gives another reason
    if (burden > 1 && t.pride > 0.6 && grounds !== 'pride') honest = false;
  } else if (c.move === 'counter') { key = 'counter.protection'; counterAmt = Math.max(10, Math.round(Math.min(fee * 0.75, shop.income * 0.05) / 5) * 5); slots.amt = `$${counterAmt}`; stance = 'pleading'; toward = 'request'; grounds = ''; }
  else if (c.move === 'accept') { key = fear > 0.4 ? 'accept.protection.afraid' : 'accept.protection'; stance = fear > 0.4 ? 'afraid' : 'flat'; grounds = ''; }
  else if (c.move === 'refer' && kin) { key = 'refer.protection.kin'; Object.assign(slots, { kinFirst: first(kin.name), kinFamily: kin.family! }); stance = 'cold'; toward = 'third'; implies = 'warning'; grounds = ''; }
  else if (c.move === 'dismiss') { key = 'refuse.protection'; grounds = 'pride'; stance = 'hostile'; }
  const meaning: Meaning = { key, stance, toward, implies, grounds: grounds || undefined, slots };
  const aim = implies === 'warning' ? 'warn you off' : c.move === 'counter' ? 'get something for his money' : c.move === 'accept' ? 'make it stop' : 'be rid of you';
  // what the player can say back: only replies to what he just said (spec §4.8, §17.3)
  const followups: { key: string; note: string }[] = [];
  const named = mem?.has('named:collector') || (grounds.startsWith('hasArrangement') && !grounds.endsWith('inferred'));
  if (grounds.startsWith('hasArrangement') && !grounds.endsWith('inferred')) mem?.note('named:collector');
  if (c.move === 'refuse' && grounds.startsWith('doesNotKnow')) followups.push({ key: 'tell.reputation', note: 'Stand on your name. He’ll ask about you, and what he hears decides the next visit.' }, { key: 'press.now', note: 'Press him. He’ll fold or dig in.' });
  if (c.move === 'refuse' && grounds.startsWith('hasArrangement')) { if (!named) followups.push({ key: 'ask.whoPays', note: 'Find out who collects from him.' }); followups.push({ key: 'offer.better', note: 'Offer to look after him for less. Whoever he pays now will hear of it.' }); }
  if (c.move === 'refuse') followups.push({ key: 'announce.return', note: 'Give him time. You’re only saying you’ll come back; he hasn’t promised you anything.' });
  if (c.move === 'counter') followups.push({ key: 'accept.counter', note: 'Take his figure. It’s agreed.' }, { key: 'press.now', note: 'Hold out for yours. He may fold, or turn you down.' });
  return { decision: { by: p.self.id, constraints, candidates: cs, chosen: c.move, grounds: grounds ? { factor: grounds, said: grounds, honest } : undefined, aim }, meaning, intent: c.move, honest, aim, counterAmt, followups };
}

// ---------------------------------------------------------------- a stated intention: he hears it; it binds nobody
export function onAnnouncement(p: Perception, speaker: Character): Reply {
  const arr = p.own.arrangement, t = p.temper;
  const plan = arr && t.caution > 0.5 ? `tell ${arr.collector} that ${speaker.name} came asking` : t.caution > 0.55 ? `ask around about ${speaker.name}` : t.pride > 0.6 ? 'give the same answer' : 'think it over';
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('acknowledge', [{ name: 'he heard it; he has promised nothing', value: 1 }])], chosen: 'acknowledge', aim: 'end the conversation' },
    meaning: { key: 'acknowledge.return', stance: t.pride > 0.6 ? 'cold' : 'flat', toward: 'speaker' }, intent: 'acknowledge', honest: true,
    changes: [`Recorded: ${speaker.name}'s stated intention to come back (binds nobody)`, `${p.self.name}'s own next step, privately: ${plan}`],
  };
}

// ---------------------------------------------------------------- a man who won't leave
export function onWait(p: Perception, speaker: Character): Reply {
  const t = p.temper, arr = p.own.arrangement;
  const cs = [
    cand('tolerate', [{ name: 'caution', value: t.caution * 0.4 }, { name: 'he does not want a scene', value: 0.2 }]),
    cand('threaten', arr ? [{ name: `${first(arr.collector)} would come if called`, value: 0.4 }, { name: 'pride', value: t.pride * 0.4 }, { name: 'courage', value: t.courage * 0.3 }] : [{ name: 'nobody to call', value: -10 }]),
    cand('call', arr ? [{ name: `${first(arr.collector)} looks after him`, value: 0.35 }, { name: 'caution', value: t.caution * 0.45 }, { name: 'fear', value: (1 - t.courage) * 0.2 }] : [{ name: 'nobody to call', value: -10 }]),
    cand('giveIn', [{ name: 'fear', value: (1 - t.courage) * 0.9 }, { name: 'pride', value: -t.pride * 0.5 }]),
  ];
  const c = best(cs);
  return {
    decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, aim: c.move === 'giveIn' ? 'make it stop' : 'be rid of you' },
    meaning: { key: 'react.wait.' + c.move, stance: c.move === 'giveIn' ? 'afraid' : 'cold', toward: 'speaker', slots: arr ? { protectorFirst: first(arr.collector) } : {} },
    intent: c.move, honest: true,
    changes: c.move === 'call' && arr ? [`${p.self.name} sent for ${arr.collector}: a request of that man, made by the shopkeeper (it reaches him in the world, not on your screen)`] : [],
  };
}

// ---------------------------------------------------------------- "So-and-so sent me": a claim, believed or not, from what he knows
export function onAuthorityClaim(p: Perception, speaker: Character, authority: Character): Reply {
  const arr = p.own.arrangement, knowsName = p.feelingFor(authority).known >= 0.2 || arr?.collectorId === authority.id;
  const trust = p.feelingFor(speaker).trust, t = p.temper;
  const belief = knowsName ? Math.max(0, Math.min(1, 0.3 + trust * 0.5 - t.caution * 0.3)) : 0;
  const key = !knowsName ? 'react.claim.unknownName' : belief > 0.5 ? 'react.claim.believed' : 'react.claim.test';
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand(key.split('.').pop()!, [{ name: knowsName ? `he has heard of ${authority.name}` : `he has never heard of ${authority.name}`, value: 0 }, { name: 'belief in the claim', value: belief }])], chosen: key.split('.').pop()!, aim: key.endsWith('test') ? 'test you' : undefined },
    meaning: { key, stance: belief > 0.5 ? 'afraid' : 'cold', toward: 'third', implies: key.endsWith('test') ? 'test' : 'none', slots: { authority: authority.name, collectorFirst: arr ? first(arr.collector) : '' } },
    intent: key, honest: true,
    changes: [`${p.self.name} holds the claim "${authority.name} sent him" at belief ${Math.round(belief * 100) / 100}${knowsName ? '' : ' (he does not know the name)'}`],
  };
}

// ---------------------------------------------------------------- the captain and an intervention
export interface Captaincy { groundHasFor: boolean; forProtected: boolean; knowsTrouble: boolean; trouble?: { shop: string }; theirCaptain: Character; asked: number; agreed: boolean; done: boolean }
export function onIntervention(p: Perception, henry: Character, forC: Character, against: Character, k: Captaincy, args: ('ground' | 'word' | 'money')[], mem?: EncounterMemory): Reply & { argReplies: { arg: string; key: string; effect: number; supported: boolean }[]; nextArgs: ('ground' | 'word' | 'money')[] } {
  const t = p.temper, fh = p.feelingFor(henry), fc = p.feelingFor(k.theirCaptain);
  const argReplies: { arg: string; key: string; effect: number; supported: boolean }[] = [];
  let argSum = 0;
  for (const a of args) {
    if (a === 'ground') { const sup = k.knowsTrouble; const e = sup ? 0.35 : -0.05; argSum += e; argReplies.push({ arg: a, key: sup ? 'react.argument.ground.supported' : 'doubt.argument.ground', effect: e, supported: sup }); }
    if (a === 'word') { const e = fh.trust * 0.08; argSum += e; argReplies.push({ arg: a, key: 'reject.argument.word', effect: r2(e), supported: true }); }
    if (a === 'money') { const sup = !k.forProtected && k.groundHasFor; const e = sup ? 0.12 : 0; argSum += e; argReplies.push({ arg: a, key: 'weigh.argument.money', effect: e, supported: sup }); }
  }
  const order = 0.35 + t.caution * 0.3 + Math.max(0, fc.trust - fc.grudge) * 0.2; // the cost of going to another captain over a civilian
  const cs = [
    cand('accept', [{ name: 'Lou’s people on his own streets (as he knows it)', value: k.knowsTrouble ? 0.75 : 0, basis: k.trouble?.shop }, { name: `his regard for ${first(henry.name)}`, value: fh.trust * 0.25 }, { name: 'arguments', value: argSum }, { name: 'trouble with another captain', value: -order }, { name: 'the man is not one of ours', value: k.forProtected ? 0 : -0.15 }]),
    cand('refuse', [{ name: 'not ours, not worth the friction', value: (k.forProtected ? 0 : 0.25) + order * 0.4 }, { name: 'he has not heard of trouble on his streets', value: k.knowsTrouble ? -0.3 : 0.1 }]),
  ];
  const c = best(cs);
  const slots = { forFirst: first(forC.name), againstFirst: first(against.name), theirCaptainFirst: first(k.theirCaptain.name), hitShop: k.trouble?.shop ?? '' };
  const liable = c.move === 'accept' && order > 0.4;
  // within the visit: a refusal he has already given, argued again without anything new, is answered as such
  if (mem && c.move === 'refuse' && mem.has('reason:notOurs') && args.length) {
    mem.pressed++;
    const last = argReplies[argReplies.length - 1];
    const moved = last && last.effect > 0.2;
    if (!moved) {
      const gap = r2((cs.find((x) => x.move === 'refuse')!.value) - (cs.find((x) => x.move === 'accept')!.value));
      const out = mem.pressed > mem.patience ? 'cutOff' : !k.knowsTrouble && !mem.has('said:condition') ? 'condition' : 'reject';
      if (out === 'condition') mem.note('said:condition');
      const key = out === 'cutOff' ? 'cutOff.argument' : out === 'condition' ? 'condition.intervention' : last?.key ?? 'reject.argument.word';
      return {
        decision: { by: p.self.id, constraints: [], candidates: cs, chosen: 'refuse', grounds: { factor: 'notOurs', said: out === 'condition' ? 'what would change his mind' : 'the same', honest: true }, aim: out === 'cutOff' ? 'end the subject' : out === 'condition' ? 'tell him what it would take' : 'hold his ground' },
        meaning: { key, stance: out === 'cutOff' ? 'weary' : 'firm', toward: 'request', slots: { ...slots, gap: String(gap) } },
        intent: 'refuse', honest: true, argReplies, nextArgs: out === 'cutOff' ? [] : (['ground', 'word', 'money'] as const).filter((a) => !mem.argued.includes(a)),
        changes: [`${p.self.name} has refused once already this visit; argument ${mem.pressed} adds ${last ? last.effect : 0}`, ...(out === 'cutOff' ? [`${p.self.name}'s patience on this is spent for today`] : [])],
      };
    }
  }
  if (mem && c.move === 'refuse') mem.note('reason:notOurs');
  return {
    decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, grounds: c.move === 'refuse' ? { factor: 'notOurs', said: 'notOurs', honest: true } : undefined, aim: c.move === 'accept' ? 'protect his ground' : 'avoid trouble with another captain' },
    meaning: c.move === 'accept' ? { key: 'accept.intervention.liable', stance: 'firm', toward: 'request', implies: liable ? 'warning' : 'none', slots } : { key: 'refuse.intervention', grounds: 'notOurs', stance: 'flat', toward: 'request', slots },
    intent: c.move, honest: true, argReplies, nextArgs: c.move === 'refuse' ? (['ground', 'word', 'money'] as const).filter((a) => !(mem?.argued ?? []).includes(a)) : [],
    changes: c.move === 'accept' ? [`Agreement: ${p.self.name} will speak to ${k.theirCaptain.name} (his promise to act, within 7 days)`, ...(liable ? [`Liability on ${henry.name}: if this turns violent within 30 days, it falls on him`] : []), `${forC.name}'s request is now carried by ${p.self.name} as well (referred, on ${first(forC.name)}'s behalf)`] : [],
  };
}
export function onProgressQuestion(p: Perception, henry: Character, forC: Character, against: Character, k: Captaincy): Reply {
  const t = p.temper, n = k.asked;
  const slots = { forFirst: first(forC.name), againstFirst: first(against.name), theirCaptainFirst: first(k.theirCaptain.name), nTimes: ['', 'once', 'twice', 'three times', 'four times'][n] ?? `${n} times` };
  const irritation = n * (0.3 + t.volatility * 0.2 + t.pride * 0.2) - p.feelingFor(henry).trust * 0.4;
  const key = k.done ? 'answer.progress.done' : irritation > 0.9 ? 'dismiss.persistence' : irritation > 0.45 ? 'answer.progress.irritated' : 'answer.progress.pending';
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand(key, [{ name: 'times asked', value: n }, { name: 'irritation', value: irritation }])], chosen: key, aim: key === 'dismiss.persistence' ? 'stop being asked' : undefined },
    meaning: { key, stance: key === 'answer.progress.pending' ? 'flat' : key === 'answer.progress.done' ? 'flat' : 'weary', toward: 'speaker', slots },
    intent: key, honest: true,
    changes: key === 'dismiss.persistence' ? [`${p.self.name}'s respect for ${henry.name} falls a little: he was told and kept asking`] : [],
  };
}

// ---------------------------------------------------------------- a question between men: what he knows, and whether he'll say it
export function onWhoQuestion(p: Perception, asker: Character, factId: string, actor: Character | undefined): Reply {
  const k = p.self.known[factId], f = p.feelingFor(asker), t = p.temper;
  const knowsWho = !!k?.knowsActor && !!actor;
  const protects = !!actor && p.feelingFor(actor).affection >= 0.6;
  const willSay = knowsWho && !protects && f.trust >= 0.45;
  const seen = k?.from === 'witness' || k?.from === 'self';
  const key = !k || !knowsWho ? 'answer.who.unknown' : !willSay ? 'answer.who.withhold' : seen ? 'answer.who.knows' : 'answer.who.rumour';
  return {
    decision: { by: p.self.id, constraints: protects ? [{ kind: 'loyalty', source: `he is close to ${actor!.name}` }] : [], candidates: [cand(key.split('.').pop()!, [{ name: 'he knows who', value: knowsWho ? 1 : 0 }, { name: `trust in ${first(asker.name)}`, value: f.trust }, { name: 'caution', value: -t.caution * 0.2 }])], chosen: key.split('.').pop()!, aim: willSay ? 'help you' : undefined },
    meaning: { key, stance: 'flat', toward: 'third', slots: { actorFirst: actor ? first(actor.name) : '', basis: seen ? 'I was across the street.' : '' } },
    intent: willSay ? 'inform' : 'withhold', honest: !(key === 'answer.who.withhold' && knowsWho),
    changes: willSay ? [`${asker.name} now knows who did it (from ${p.self.name}, who ${seen ? 'saw it' : 'heard it'})`] : [],
  };
}

// ---------------------------------------------------------------- spending time: an account of what happened, not a score
export function spendTimeAccount(pa: Perception, pb: Perception, b: Character, venue: string, compat: number): { text: string; changes: string[] } {
  const tb = pb.temper, shop = pb.own.shop, kin = pb.own.kin[0];
  const topic = shop && shop.distress > 0 ? `how slow the shop has been, and the rent` : kin ? `his ${kin.role} ${first(kin.name)}` : tb.pride > 0.6 ? 'the old neighbourhood, and the men who used to run it' : 'the fights on Saturday, and who should have won';
  const went = compat > 0.15 ? 'It was easy. He laughed more than you expected.' : compat > -0.1 ? 'It was pleasant enough, and no more than that.' : 'It never quite caught. He kept looking at the door.';
  const change = compat > 0.15 ? 'He likes you better for it.' : compat > -0.1 ? 'You’re no closer than you were, and no further.' : 'If anything, you’re further apart.';
  return { text: `You spent the evening at ${venue} with ${first(b.name)}. He talked about ${topic}. ${went} ${change}`, changes: [`familiarity up (time together)`, compat > 0.15 ? 'his liking for you up (compatibility)' : compat < -0.1 ? 'a little friction (compatibility)' : 'no change in his regard'] };
}

// ---------------------------------------------------------------- a request the worked examples never covered: a loan
// The same two stages: what he can't do (spare the money), then what each answer is worth to him, from what he believes of the man
// asking. Reasons, counters and what the player can say back follow from the decision, as for any request.
export function onLoanRequest(p: Perception, asker: Character, amt: number, mem: EncounterMemory, offered: { rate?: number; reputation?: boolean; promise?: string } = {}): Reply & { counter?: { amt: number; rate: number }; followups: { key: string; note: string; slots?: Record<string, string> }[] } {
  const t = p.temper, f = p.feelingFor(asker), who = p.identityOf(asker);
  const missed = p.knownFacts((x) => x.kind === 'debt_missed' && x.actor === asker.id);
  const spare = Math.max(0, p.own.cash - 300);
  const rate = offered.rate ?? 0.05;
  const constraints: Decision['constraints'] = [];
  if (spare < amt * 0.4) constraints.push({ kind: 'cannot', source: `he has about $${Math.round(p.own.cash / 50) * 50} on him, and needs most of it` });
  // what he believes of the risk: how well he knows you, what he has heard, and that a family man is hard to chase
  const risk = 0.55 - f.trust * 0.5 - f.known * 0.2 + missed.length * 0.25 - (offered.reputation && who.known ? 0.08 : 0) + (who.known ? 0.05 : 0);
  const gain = rate * 4; // a month of vig, as he thinks of it
  const cs = [
    cand('accept', [{ name: 'what it earns him', value: gain * 2 }, { name: 'the chance he never sees it again', value: -risk }, { name: 'greed', value: p.self.traits.greed * 0.2 }, ...(spare < amt ? [{ name: 'he hasn’t got it to spare', value: -1 }] : [])], spare < amt ? ['cannot'] : []),
    cand('counter', spare >= Math.min(amt, 150) ? [{ name: 'a smaller sum, a smaller risk', value: gain * 1.6 - risk * 0.5 }, { name: 'he would rather deal than refuse', value: t.agreeable * 0.3 }] : [{ name: 'nothing to offer', value: -10 }]),
    cand('refuse', [{ name: 'the risk', value: risk * 0.9 }, { name: 'caution', value: t.caution * 0.15 }, { name: 'he hasn’t got it', value: spare < amt * 0.4 ? 0.6 : 0 }]),
  ];
  let c = best(cs);
  // the same request, pushed with nothing new, is answered as the same request
  if (mem.has('answered:loan') && !offered.rate && !offered.reputation && !offered.promise) c = cs.find((x) => x.move === 'refuse')!;
  const slots: Record<string, string> = { amt: `$${amt}`, youName: asker.name, youFirst: first(asker.name) };
  let meaning: Meaning, counter: { amt: number; rate: number } | undefined;
  const followups: { key: string; note: string; slots?: Record<string, string> }[] = [];
  if (c.move === 'accept') meaning = { key: 'accept.loan', stance: 'flat', toward: 'request', slots: { ...slots, rate: `${Math.round(rate * 100)} percent` } };
  else if (c.move === 'counter') {
    counter = { amt: Math.max(100, Math.round(Math.min(amt * 0.6, spare) / 50) * 50), rate: Math.round((rate + (risk > 0.3 ? 0.02 : 0)) * 100) / 100 };
    meaning = { key: 'counter.loan', stance: 'flat', toward: 'request', grounds: risk > 0.3 ? 'risk' : 'cannotSpare', slots: { ...slots, amt: `$${counter.amt}`, rate: `${Math.round(counter.rate * 100)} percent` } };
    followups.push({ key: 'accept.counter.loan', note: 'Take what he offers, on his terms.', slots: { amt: `$${counter.amt}`, rate: `${Math.round(counter.rate * 100)}` } });
  } else {
    const nothingNew = !offered.rate && !offered.reputation && !offered.promise;
    const g = mem.has('answered:loan') && nothingNew ? 'already' : spare < amt * 0.4 ? 'cannotSpare' : offered.reputation && !mem.has('argued:reputation') ? 'wordNotEnough' : f.known < 0.3 && !offered.rate ? 'doesNotKnow' : 'risk';
    meaning = { key: 'refuse.loan', stance: g === 'already' ? 'weary' : 'flat', toward: g === 'doesNotKnow' ? 'speaker' : 'request', grounds: g, slots };
  }
  mem.note('answered:loan');
  if (c.move !== 'accept') {
    if (!offered.reputation && !mem.has('argued:reputation')) followups.push({ key: 'argue.reputation', note: 'Stand on your name. It counts for what he’s heard of you.' });
    if (!offered.rate) followups.push({ key: 'sweeten.rate', note: 'Pay more for the money.', slots: { rate: '8' } });
    if (!offered.promise) followups.push({ key: 'promise.repay', note: 'Give him your word on when. He’ll hold you to it.', slots: { when: 'the end of the month' } });
  }
  if (offered.reputation) mem.note('argued:reputation');
  return { decision: { by: p.self.id, constraints, candidates: cs, chosen: c.move, grounds: meaning.grounds ? { factor: meaning.grounds, said: meaning.grounds, honest: true } : undefined, aim: c.move === 'refuse' ? 'keep his money' : 'make money on it' }, meaning, intent: c.move, honest: true, counter, followups, changes: c.move === 'accept' ? [`Agreement: ${p.self.name} lends ${asker.name} $${amt} at ${Math.round(rate * 100)}% a week (a debt, through core.createDebt)`] : [] };
}

// ---------------------------------------------------------------- asking about something he has never heard of
export function onUnknownTopic(p: Perception, asker: Character, topic: string): Reply {
  const t = p.temper;
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('answer', [{ name: 'he has not heard of it', value: 1 }, { name: 'curiosity (sociability)', value: p.self.traits.sociability * 0.5 }])], chosen: 'answer', aim: p.self.traits.sociability > 0.5 ? 'find out more' : undefined },
    meaning: { key: 'answer.unknownTopic', stance: 'flat', toward: 'third', slots: { topic } },
    intent: 'answer', honest: true,
    changes: [`${p.self.name} now knows what ${first(asker.name)} told him: ${topic} (from ${asker.name}; he may repeat it)`, ...(t.caution > 0.6 ? [] : [])],
  };
}

// ---------------------------------------------------------------- the man you promised, when you come back (spec §6.7, §17.9 C)
// He opens with where things stand as HE knows it: still waiting, or he has seen Lou's people stop coming and wonders why.
export function onReturnToPromisee(p: Perception, henry: Character, seenStop: boolean, daysSince: number): Reply {
  const t = p.temper;
  const key = seenStop ? 'followup.observed' : 'followup.pending';
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand(key, [{ name: seenStop ? 'he has seen Lou’s people stay away' : 'he has heard nothing from you', value: 1 }, { name: 'days since you promised', value: daysSince * 0.1 }, { name: 'patience (caution, agreeable)', value: t.caution * 0.2 + t.agreeable * 0.2 }])], chosen: key, aim: seenStop ? 'find out who to thank' : 'hold you to it' },
    meaning: { key, stance: seenStop ? 'warm' : 'flat', toward: 'speaker' }, intent: 'question', honest: true,
  };
}
export function onReport(p: Perception, henry: Character, kind: 'honest' | 'stall' | 'done' | 'admitNotDone'): Reply {
  const t = p.temper;
  const key = kind === 'done' ? 'thanks.kept' : kind === 'honest' ? 'react.report.honest' : kind === 'admitNotDone' ? 'react.report.admit' : 'react.report.stall';
  const changes = kind === 'done' ? [`${p.self.name}'s trust in ${henry.name} rises (a promise kept, as he sees it: Lou stopped, and Henry says he took it to the family)`, 'A favour is owed to Henry (encounters.addFavour)']
    : kind === 'admitNotDone' ? [`${p.self.name} had thought it was Henry's doing; now he knows it wasn't. His trust falls a little, less than if he had found out another way`]
    : kind === 'honest' ? [`${p.self.name} keeps waiting, a little less sure; patience shortened`, ...(t.pride > 0.6 ? ['He starts looking at other routes (his own pursuit)'] : [])]
    : [`${p.self.name} does not believe it; his trust in ${henry.name} falls`];
  return { decision: { by: p.self.id, constraints: [], candidates: [cand(kind, [{ name: kind === 'stall' ? 'he hears an evasion' : 'he believes what you said', value: 1 }])], chosen: kind }, meaning: { key, stance: kind === 'done' ? 'warm' : kind === 'stall' ? 'cold' : 'flat', toward: 'speaker' }, intent: kind, honest: true, changes };
}

// ---------------------------------------------------------------- reporting back on a collection: honestly, or not (a reason to lie)
// He collected `got`. He decides what to hand over and what to say, from his own state (his money, his debts, his greed, his
// conscience) and from what he believes of the man he answers to: how likely Henry is to check.
export function onCollectionReport(p: Perception, boss: Character, debtor: Character, got: number): Reply & { says: number; keeps: number } {
  const t = p.temper, f = p.feelingFor(boss), g = p.self.traits.greed;
  const owes = p.knownFacts((x) => x.kind === 'debt_missed' && x.actor === p.self.id).length;
  const need = (p.own.cash - got < 100 ? 0.4 : 0) + owes * 0.2; // his own money: what he collected is not his
  const checkRisk = 0.25 + f.known * 0.3 + (1 - t.courage) * 0.1; // as he imagines it: a boss who knows him better checks more
  const keep = Math.round(got / 2 / 10) * 10;
  const cs = [
    cand('honest', [{ name: `loyalty to ${first(boss.name)}`, value: f.trust * 0.5 + f.respect * 0.2 }, { name: 'conscience (empathy)', value: t.empathy * 0.3 }]),
    cand('skim', [{ name: 'he needs the money', value: need }, { name: 'greed', value: g * 0.5 }, { name: 'the chance he is found out (as he sees it)', value: -checkRisk * 0.8 }, { name: 'fear of what happens then', value: -(1 - t.courage) * 0.2 }]),
  ];
  const c = best(cs);
  const says = c.move === 'skim' ? got - keep : got;
  return {
    decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, aim: c.move === 'skim' ? 'keep some of it' : undefined },
    meaning: { key: c.move === 'skim' ? 'report.collection.short' : 'report.collection.honest', stance: 'flat', toward: 'third', slots: { amt: `$${says}`, debtorFirst: first(debtor.name) } },
    intent: c.move, honest: c.move === 'honest', says, keeps: got - says,
    changes: c.move === 'skim' ? [`${p.self.name} hands over $${says} and keeps $${got - says} (private: the truth is $${got})`, `Claim made to ${boss.name}: "${first(debtor.name)} paid $${says}" (honest: false)`] : [`${p.self.name} hands over all $${got}`],
  };
}
// What the debtor says when asked about it: from his own state, so it is the truth as he knows it.
export function onDebtQuestion(p: Perception, asker: Character, paid: number, to: Character, day: string): Reply {
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('answer', [{ name: 'he paid, and wants it known', value: 1 }])], chosen: 'answer', aim: 'not be asked twice for the same money' },
    meaning: { key: 'answer.debt.paid', stance: 'firm', toward: 'third', slots: { amt: `$${paid}`, day, toFirst: first(to.name) } },
    intent: 'inform', honest: true, changes: [`Claim made to ${asker.name}: "I paid ${to.name} $${paid}" (honest: true)`],
  };
}
// Put to him: the contradiction, with whatever weight the other man's word carries for him.
export function onConfrontation(p: Perception, accuser: Character, lied: boolean, otherWord: number): Reply & { admits: boolean } {
  const t = p.temper, f = p.feelingFor(accuser);
  const cs = [
    cand('admit', [{ name: 'the evidence (another man’s word, as he weighs it)', value: otherWord * 0.6 }, { name: 'fear of you', value: (f.fear + (1 - t.courage) * 0.3) }, { name: 'conscience', value: t.empathy * 0.3 }, { name: 'he did it', value: lied ? 0.2 : -10 }]),
    cand('deny', [{ name: 'caution (hold the story)', value: t.caution * 0.4 }, { name: 'pride', value: t.pride * 0.2 }, { name: 'he did not do it', value: lied ? 0 : 1 }]),
    cand('defy', [{ name: 'pride', value: t.pride * 0.5 }, { name: 'volatility', value: t.volatility * 0.4 }, { name: 'fear', value: -f.fear - (1 - t.courage) * 0.4 }]),
  ];
  const c = best(cs);
  return {
    decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, aim: c.move === 'admit' ? 'limit the damage' : 'keep the money and the story' },
    meaning: { key: 'confront.' + c.move, stance: c.move === 'admit' ? 'afraid' : c.move === 'defy' ? 'hostile' : 'firm', toward: 'speaker', slots: { youFirst: first(accuser.name) } },
    intent: c.move, honest: c.move === 'admit' || !lied, admits: c.move === 'admit',
  };
}
// How a man in trouble takes what you've promised him (the kind of promise is in what you said, never named on screen).
export function onPromise(p: Perception, henry: Character, type: 'action' | 'effort' | 'result' | 'restraint'): Reply {
  const t = p.temper;
  const relief = { action: 0.4, effort: 0.25, result: 0.8, restraint: 0.5 }[type];
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('acknowledge', [{ name: 'what it gives him', value: relief }, { name: 'trust in you', value: p.feelingFor(henry).trust * 0.3 }])], chosen: 'acknowledge', aim: type === 'result' ? 'hold you to it' : undefined },
    meaning: { key: 'ack.promise.' + type, stance: type === 'result' ? 'warm' : 'flat', toward: 'speaker' }, intent: 'acknowledge', honest: true,
    changes: [`${p.self.name}'s trust in ${henry.name} rises a little now (more for a bigger promise); it will move again when he sees what comes of it`, ...(t.caution > 0.6 ? ['He keeps his own counsel on whether to believe it'] : [])],
  };
}
export function onPromiseSeenBroken(p: Perception, henry: Character): Reply {
  return { decision: { by: p.self.id, constraints: [], candidates: [cand('reproach', [{ name: 'he was promised it would stop, and it didn’t', value: 1 }])], chosen: 'reproach', aim: 'let you know' }, meaning: { key: 'followup.broken', stance: 'cold', toward: 'speaker' }, intent: 'reproach', honest: true, changes: [`${p.self.name}'s trust in ${henry.name} falls (a broken promise, as he saw it)`] };
}
// What Henry expects of an approach before he makes it, from HIS perception of the other man (spec §7.3): a guess, which can be wrong.
export function predictAcceptance(ph: Perception, other: Character, believesOtherKnowsTrouble: boolean): number {
  const f = ph.feelingFor(other);
  return Math.round(Math.max(0, Math.min(1, 0.1 + (believesOtherKnowsTrouble ? 0.35 : 0) + f.trust * 0.2 + f.known * 0.1)) * 100) / 100;
}
