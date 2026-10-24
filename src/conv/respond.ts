// The response decision (spec §4.4), minimal for Gate 1: first what he cannot or must not do (constraints), then what each
// permissible move is worth to him, from his own perception. Every term is recorded, so the trace can say why.
import type { Character } from '../types';
import type { Perception } from './perception';
import type { Candidate, Decision, Meaning, Term } from './types';

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
export function onProtectionDemand(p: Perception, asker: Character, fee: number, how: 'plain' | 'soft' | 'lean' | 'inferred'): Reply & { counterAmt?: number; followups: { key: string; note: string }[] } {
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
  if (c.move === 'refuse' && grounds.startsWith('doesNotKnow')) followups.push({ key: 'tell.reputation', note: 'Stand on your name. He’ll ask about you, and what he hears decides the next visit.' }, { key: 'press.now', note: 'Press him. He’ll fold or dig in.' }, { key: 'announce.return', note: 'Give him time. You’re only saying you’ll come back; he hasn’t promised you anything.' });
  if (c.move === 'refuse' && grounds.startsWith('hasArrangement')) followups.push({ key: 'ask.whoPays', note: 'Find out who collects from him.' }, { key: 'offer.better', note: 'Offer to look after him for less. Whoever he pays now will hear of it.' });
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
export function onIntervention(p: Perception, henry: Character, forC: Character, against: Character, k: Captaincy, args: ('ground' | 'word' | 'money')[]): Reply & { argReplies: { arg: string; key: string; effect: number; supported: boolean }[] } {
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
  return {
    decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, grounds: c.move === 'refuse' ? { factor: 'notOurs', said: 'notOurs', honest: true } : undefined, aim: c.move === 'accept' ? 'protect his ground' : 'avoid trouble with another captain' },
    meaning: c.move === 'accept' ? { key: 'accept.intervention.liable', stance: 'firm', toward: 'request', implies: liable ? 'warning' : 'none', slots } : { key: 'refuse.intervention', grounds: 'notOurs', stance: 'flat', toward: 'request', slots },
    intent: c.move, honest: true, argReplies,
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
