// The response decision (spec §4.4), minimal for Gate 1: first what he cannot or must not do (constraints), then what each
// permissible move is worth to him, from his own perception. Every term is recorded, so the trace can say why.
import { DAY, type Character } from '../types';
import type { Perception } from './perception';
import { CLAIMABLE, type Candidate, type Decision, type Meaning, type Role, type Term } from './types';
import type { EncounterMemory } from './encounter';

const agoWords = (now: number, t: number) => { const d = Math.floor(now / DAY) - Math.floor(t / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : 'last week'; };
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
  const youName = speaker.name, slots: Record<string, string> = { youName, youFamily: family, youSurname: sur(youName), since: p.particulars.protectedSince() ?? '' };
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
  const slots: Record<string, string> = { youName: asker.name, youSurname: sur(asker.name), youFamily: who.family ?? '', amt: `$${fee}`, ownNoun: p.particulars.ownShopNoun() ?? '' };
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
export function onAnnouncement(p: Perception, speaker: Character, day = ''): Reply {
  const arr = p.own.arrangement, t = p.temper;
  const plan = arr && t.caution > 0.5 ? `tell ${arr.collector} that ${speaker.name} came asking` : t.caution > 0.55 ? `ask around about ${speaker.name}` : t.pride > 0.6 ? 'give the same answer' : 'think it over';
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('acknowledge', [{ name: 'he heard it; he has promised nothing', value: 1 }])], chosen: 'acknowledge', aim: 'end the conversation' },
    meaning: { key: 'acknowledge.return', stance: t.pride > 0.6 ? 'cold' : 'flat', toward: 'speaker', slots: { day: day ? day[0].toUpperCase() + day.slice(1) : '' } }, intent: 'acknowledge', honest: true,
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
    cand('accept', [{ name: `${first(against.name)}’s people on his own streets (as he knows it)`, value: k.knowsTrouble ? 0.75 : 0, basis: k.trouble?.shop }, { name: `his regard for ${first(henry.name)}`, value: fh.trust * 0.25 }, { name: 'arguments', value: argSum }, { name: 'trouble with another captain', value: -order }, { name: 'the man is not one of ours', value: k.forProtected ? 0 : -0.15 }]),
    cand('refuse', [{ name: 'not ours, not worth the friction', value: (k.forProtected ? 0 : 0.25) + order * 0.4 }, { name: 'he has not heard of trouble on his streets', value: k.knowsTrouble ? -0.3 : 0.1 }]),
  ];
  const c = best(cs);
  const slots = { forFirst: first(forC.name), againstFirst: first(against.name), theirCaptainFirst: first(k.theirCaptain.name), hitShop: k.trouble?.shop ?? '', forNoun: p.particulars.shopNounOf(forC.id) ?? '', youFirst: first(henry.name) };
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
  const fact = p.knownFacts((x) => x.id === factId)[0], f = p.feelingFor(asker), t = p.temper;
  const k = p.self.known[factId];
  // what he is to it decides how he can speak of it and what he can honestly claim: the man it was done to speaks of his own
  // loss, a witness of what he saw, a man who heard of it only of what is said (types.CLAIMABLE)
  const role: Role = fact ? p.roleIn(fact) : 'none';
  const knowsWho = !!k?.knowsActor && !!actor;
  const protects = !!actor && p.feelingFor(actor).affection >= 0.6;
  const afraid = role === 'victim' && !!actor && (p.feelingFor(actor).fear ?? 0) + (1 - t.courage) * 0.4 > 0.5;
  const willSay = knowsWho && !protects && !afraid && f.trust >= 0.45;
  const move = !k || !knowsWho ? 'unknown' : !willSay ? 'withhold' : 'knows';
  const key = 'answer.who.' + move;
  const basis = CLAIMABLE[role][0];
  // withholding what he saw by saying he saw nothing is a lie; a victim or a man who only heard, keeping quiet, says so plainly
  const honest = !(move === 'withhold' && role === 'witness');
  return {
    decision: { by: p.self.id, constraints: [...(protects ? [{ kind: 'loyalty', source: `he is close to ${actor!.name}` }] : []), ...(afraid ? [{ kind: 'fear', source: `${actor!.name} did it to him` }] : [])], candidates: [cand(move, [{ name: 'he knows who', value: knowsWho ? 1 : 0 }, { name: `trust in ${first(asker.name)}`, value: f.trust }, { name: 'caution', value: -t.caution * 0.2 }])], chosen: move, aim: willSay ? 'help you' : undefined },
    meaning: { key, stance: 'flat', toward: 'third', role, slots: { actorFirst: actor && move === 'knows' ? first(actor.name) : '' } },
    intent: willSay ? 'inform' : 'withhold', honest,
    changes: willSay ? [`Claim made to ${asker.name}: ${actor!.name} did it (basis: ${basis}; he is the ${role === 'victim' ? 'man it was done to' : role === 'witness' ? 'man who saw it' : 'man who heard of it'})`] : !honest ? [`Claim made to ${asker.name}: he saw nothing (honest: false; he saw it)`] : [],
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
export function onReturnToPromisee(p: Perception, henry: Character, seenStop: boolean, daysSince: number, against?: Character): Reply {
  const t = p.temper;
  const key = seenStop ? 'followup.observed' : 'followup.pending';
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand(key, [{ name: seenStop ? `he has seen ${against ? first(against.name) + '’s' : 'their'} people stay away` : 'he has heard nothing from you', value: 1 }, { name: 'days since you promised', value: daysSince * 0.1 }, { name: 'patience (caution, agreeable)', value: t.caution * 0.2 + t.agreeable * 0.2 }])], chosen: key, aim: seenStop ? 'find out who to thank' : 'hold you to it' },
    meaning: { key, stance: seenStop ? 'warm' : 'flat', toward: 'speaker', slots: { againstFirst: against ? first(against.name) : '', lastSeen: against ? p.particulars.lastAt(HOSTILE_KINDS, against.id) ?? '' : '' } }, intent: 'question', honest: true,
  };
}
const HOSTILE_KINDS = ['vandalism', 'threat', 'beating', 'protection_refused', 'robbery'];
// A man in trouble asks for help: with what he knows of it (who, and when he last saw them), from his own knowledge.
export function onSeekHelp(p: Perception, against: Character): Reply {
  return { decision: { by: p.self.id, constraints: [], candidates: [cand('seekHelp', [{ name: `${first(against.name)} wants money off him`, value: 1 }])], chosen: 'seekHelp', aim: `get someone to make ${first(against.name)} stop` }, meaning: { key: 'seek.help', stance: 'pleading', toward: 'third', role: 'victim', slots: { againstFirst: first(against.name), lastSeen: p.particulars.lastAt(HOSTILE_KINDS, against.id) ?? '' } }, intent: 'ask', honest: true };
}
export function onReport(p: Perception, henry: Character, kind: 'honest' | 'stall' | 'done' | 'admitNotDone'): Reply {
  const t = p.temper;
  const key = kind === 'done' ? 'thanks.kept' : kind === 'honest' ? 'react.report.honest' : kind === 'admitNotDone' ? 'react.report.admit' : 'react.report.stall';
  const changes = kind === 'done' ? [`${p.self.name}'s trust in ${henry.name} rises (a promise kept, as he sees it: the trouble stopped, and ${first(henry.name)} says he took it to the family)`]
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
export function onDebtQuestion(p: Perception, asker: Character, paid: number, to: Character): Reply {
  const when = p.knownFacts((x) => x.kind === 'debt_paid' && x.actor === p.self.id).sort((a, b) => b.t - a.t)[0];
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('answer', [{ name: 'he paid, and wants it known', value: 1 }])], chosen: 'answer', aim: 'not be asked twice for the same money' },
    meaning: { key: 'answer.debt.paid', stance: 'firm', toward: 'third', role: 'actor', slots: { amt: `$${paid}`, when: when ? agoWords(p.at, when.t) : '', toFirst: first(to.name) } },
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
export function onPromise(p: Perception, henry: Character, type: 'action' | 'effort' | 'result' | 'restraint', against?: Character): Reply {
  const t = p.temper;
  const relief = { action: 0.4, effort: 0.25, result: 0.8, restraint: 0.5 }[type];
  return {
    decision: { by: p.self.id, constraints: [], candidates: [cand('acknowledge', [{ name: 'what it gives him', value: relief }, { name: 'trust in you', value: p.feelingFor(henry).trust * 0.3 }])], chosen: 'acknowledge', aim: type === 'result' ? 'hold you to it' : undefined },
    meaning: { key: 'ack.promise.' + type, stance: type === 'result' ? 'warm' : 'flat', toward: 'speaker', slots: { againstFirst: against ? first(against.name) : '' } }, intent: 'acknowledge', honest: true,
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

// ---------------------------------------------------------------- Gate 2a: between men, with no player present (no text: a trace)
// A captain asked by another captain to rein in his own man over a civilian. What he weighs, from his own perception: the man asking
// (how he regards him), keeping the peace in the family, and his own man (what he thinks of him, and that he earns).
export function onOrderRequest(p: Perception, asker: Character, man: Character, forC: Character): Reply {
  const t = p.temper, fa = p.feelingFor(asker), fm = p.feelingFor(man);
  const sameFamily = !!asker.familyId && asker.familyId === p.self.familyId;
  const heard = p.knownFacts((x) => ['vandalism', 'beating', 'threat'].includes(x.kind) && x.actor === man.id && (x.victim === forC.id)).length;
  const cs = [
    cand('order', [{ name: `his regard for ${first(asker.name)}`, value: fa.trust * 0.4 + fa.respect * 0.2 }, { name: sameFamily ? 'peace in the family' : 'peace with another family', value: sameFamily ? 0.3 : 0.15 }, { name: 'caution', value: t.caution * 0.2 }, { name: `what he knows ${first(man.name)} has done`, value: heard ? 0.15 : 0 }]),
    cand('refuse', [{ name: `his regard for ${first(man.name)}, his own man`, value: fm.trust * 0.3 + fm.affection * 0.2 }, { name: 'a civilian’s complaint', value: forC.rank === 'civilian' ? 0.15 : 0 }, { name: 'pride (nobody tells him how to run his crew)', value: t.pride * 0.3 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move, aim: c.move === 'order' ? 'keep the peace' : 'stand by his man' }, meaning: { key: c.move === 'order' ? 'agree.order' : 'refuse.order', stance: 'flat', toward: 'request', slots: { manFirst: first(man.name), forFirst: first(forC.name) } }, intent: c.move, honest: true };
}
// The man ordered to leave someone alone, having agreed: does he mean it? From his perception: what he fears of the man who gave the
// order and what he owes him, against what the shop is worth to him, his grudge, and his temper. Breaking it is his explicit choice.
export function onOrder(p: Perception, superior: Character, forC: Character, fee: number): Reply {
  const t = p.temper, fs = p.feelingFor(superior), ff = p.feelingFor(forC), g = p.self.traits.greed;
  const cs = [
    cand('obey', [{ name: `fear of ${first(superior.name)}`, value: fs.fear * 0.5 + (1 - t.courage) * 0.3 }, { name: `regard for ${first(superior.name)}`, value: fs.trust * 0.3 + fs.respect * 0.3 }, { name: 'caution', value: t.caution * 0.3 }]),
    cand('violate', [{ name: 'what the shop would pay him', value: Math.min(0.5, fee / 200) * g }, { name: `his grudge against ${first(forC.name)}`, value: ff.grudge * 0.6 }, { name: 'volatility', value: t.volatility * 0.3 }, { name: 'pride (being told)', value: t.pride * 0.2 }, { name: 'what breaking an order costs', value: -0.35 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: [{ kind: 'ordered', source: `${superior.name} told him to leave ${forC.name} alone` }], candidates: cs, chosen: c.move, aim: c.move === 'obey' ? 'stay out of trouble' : `keep at ${first(forC.name)}` }, meaning: { key: c.move === 'obey' ? 'obey.order' : 'violate.order', stance: 'flat', toward: 'third' }, intent: c.move, honest: c.move === 'obey' };
}

// ================================================================ Gate 2b: the decisions NPCs make of each other, by the same rules
// Each is a response from the decider's own perception (what he knows, whom he trusts, his temperament, his obligations), with every
// term recorded. The world's asks carry the result out (asks.ts DECIDERS); pursuits (conv/pursuits.ts) make the requests.

// Asked to leave a man alone (asks 'layoff' / 'warn'): by his own superior it is an order; by anyone else, a warning he weighs.
export function onLayoff(p: Perception, asker: Character, forC: Character, superior: boolean, guilty: boolean): Reply {
  const t = p.temper, fa = p.feelingFor(asker), ff = p.feelingFor(forC);
  const cs = [
    cand('agree', [
      ...(superior ? [{ name: `${first(asker.name)} is over him`, value: 0.45 }, { name: `regard for ${first(asker.name)}`, value: fa.trust * 0.2 + fa.respect * 0.2 }, { name: `fear of ${first(asker.name)}`, value: fa.fear * 0.3 + (1 - t.courage) * 0.15 }] : [{ name: `fear of ${first(asker.name)}`, value: fa.fear * 0.4 + (1 - t.courage) * 0.2 }, { name: `regard for ${first(asker.name)}`, value: fa.trust * 0.2 }]),
      { name: 'caution', value: t.caution * 0.2 },
      ...(guilty ? [] : [{ name: 'he never touched him (an insult to be warned off)', value: -0.3 }]),
    ]),
    cand('refuse', [{ name: `his grudge against ${first(forC.name)}`, value: ff.grudge * 0.6 }, { name: 'pride (being told)', value: t.pride * 0.3 }, { name: 'volatility', value: t.volatility * 0.2 }, ...(superior ? [{ name: 'what defying his superior costs', value: -0.3 }] : [])]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: superior ? [{ kind: 'ordered', source: `${asker.name} is over him` }] : [], candidates: cs, chosen: c.move }, meaning: { key: c.move === 'agree' ? 'agree.layoff' : 'refuse.layoff', stance: 'flat', toward: 'request' }, intent: c.move, honest: true };
}
// A protector asked by a man he collects from to deal with someone troubling him (asks 'help').
export function onHelp(p: Perception, asker: Character, trouble: Character, collects: boolean): Reply {
  const t = p.temper, fa = p.feelingFor(asker), ft = p.feelingFor(trouble);
  const sameFamily = !!trouble.familyId && trouble.familyId === p.self.familyId;
  const cs = [
    cand('yes', [{ name: collects ? 'he pays me for exactly this' : 'he asked', value: collects ? 0.45 : 0.1 }, { name: `regard for ${first(asker.name)}`, value: fa.trust * 0.2 }, { name: 'standing (a man who does not look after his own is nobody)', value: t.pride * 0.15 }]),
    cand('no', [{ name: `trouble with ${first(trouble.name)}`, value: ft.fear * 0.4 + (sameFamily ? 0.25 : 0.1) }, { name: 'caution', value: t.caution * 0.2 }, { name: `regard for ${first(trouble.name)}`, value: ft.trust * 0.2 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move }, meaning: { key: c.move === 'yes' ? 'agree.help' : 'refuse.help', stance: 'flat', toward: 'request' }, intent: c.move, honest: true };
}
// Who does a man answer to? He tells what he believes, if he trusts the asker enough and has no reason not to.
export function onAnswersTo(p: Perception, asker: Character, man: Character, believed: string | undefined): Reply {
  const f = p.feelingFor(asker), fm = p.feelingFor(man), t = p.temper;
  const tell = !!believed && f.trust + (1 - t.caution) * 0.3 - fm.affection * 0.4 > 0.35;
  return { decision: { by: p.self.id, constraints: [], candidates: [cand(tell ? 'tell' : believed ? 'withhold' : 'unknown', [{ name: 'he knows', value: believed ? 1 : 0 }, { name: `trust in ${first(asker.name)}`, value: f.trust }, { name: `close to ${first(man.name)}`, value: -fm.affection * 0.4 }])], chosen: tell ? 'tell' : believed ? 'withhold' : 'unknown' }, meaning: { key: tell ? 'answer.answersTo' : 'answer.who.unknown', stance: 'flat', toward: 'third' }, intent: tell ? 'inform' : 'withhold', honest: true };
}
// Asked whether he has done what he promised: the truth, a stall, or a lie, from his own position.
export function onProgressAsked(p: Perception, asker: Character, done: boolean, daysLeft: number): Reply & { says: 'done' | 'notYet' | 'notDone' } {
  const t = p.temper, f = p.feelingFor(asker);
  const cs = done ? [cand('truth', [{ name: 'he did it', value: 1 }])] : [
    cand('truth', [{ name: 'honesty (empathy)', value: t.empathy * 0.3 }, { name: `regard for ${first(asker.name)}`, value: f.trust * 0.3 }, { name: 'time left to do it', value: daysLeft > 1 ? 0.2 : 0 }]),
    cand('lie', [{ name: 'saving face (pride)', value: t.pride * 0.3 }, { name: 'he does not think he will be found out (as he sees it)', value: (1 - t.caution) * 0.25 }, { name: 'greed for credit', value: p.self.traits.greed * 0.1 }, { name: 'decency', value: -t.empathy * 0.2 }]),
  ];
  const c = best(cs);
  const says = done ? 'done' : c.move === 'lie' ? 'done' : daysLeft > 0 ? 'notYet' : 'notDone';
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move }, meaning: { key: 'answer.progress.' + says, stance: 'flat', toward: 'request' }, intent: c.move, honest: c.move === 'truth', says };
}
// A man who has promised to act decides, today, what to do about it: do it, let it wait, ask to be let off or given time, or let it go.
export function onKeepWord(p: Perception, promisee: Character, cost: number, daysLeft: number, canAct: boolean): Reply {
  const t = p.temper, f = p.feelingFor(promisee);
  const regard = f.trust * 0.35 + f.respect * 0.15 + f.affection * 0.1;
  const urgent = daysLeft <= 1 ? 0.35 : daysLeft <= 3 ? 0.15 : 0;
  const cs = [
    cand('act', canAct ? [{ name: `regard for ${first(promisee.name)}`, value: regard }, { name: 'he gave his word (agreeable)', value: 0.2 + t.agreeable * 0.15 }, { name: 'the deadline', value: urgent }, { name: 'what it will cost him', value: -cost }] : [{ name: 'he cannot do it now', value: -10 }]),
    cand('delay', daysLeft > 1 ? [{ name: 'there is time', value: 0.25 }, { name: 'caution', value: t.caution * 0.1 }] : [{ name: 'no time left', value: -10 }]),
    cand('renegotiate', [{ name: 'it costs more than he thought', value: cost * 0.5 }, { name: `regard for ${first(promisee.name)} (he would rather ask than fail him)`, value: regard * 0.5 }, { name: 'pride (asking to be let off)', value: -t.pride * 0.2 }, { name: 'the deadline', value: urgent * 0.5 }]),
    cand('abandon', [{ name: 'what it would cost him', value: cost * 0.8 }, { name: `little regard for ${first(promisee.name)}`, value: (0.4 - regard) * 0.5 }, { name: 'his word (agreeable)', value: -t.agreeable * 0.3 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move }, meaning: { key: 'keepWord.' + c.move, stance: 'flat', toward: 'self' }, intent: c.move, honest: true };
}
// Asked to let a man off a promise, or give him more time.
export function onRenegotiate(p: Perception, obligor: Character, stakes: number): Reply {
  const t = p.temper, f = p.feelingFor(obligor);
  const cs = [
    cand('extend', [{ name: `regard for ${first(obligor.name)}`, value: f.trust * 0.3 }, { name: 'agreeable', value: t.agreeable * 0.25 }, { name: 'how much it matters to him', value: -stakes * 0.1 }]),
    cand('release', [{ name: `regard for ${first(obligor.name)}`, value: f.trust * 0.2 }, { name: 'agreeable', value: t.agreeable * 0.2 }, { name: 'how much it matters to him', value: -stakes * 0.4 }]),
    cand('hold', [{ name: 'how much it matters to him', value: stakes * 0.35 }, { name: 'pride', value: t.pride * 0.2 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move }, meaning: { key: 'renegotiate.' + c.move, stance: 'flat', toward: 'request' }, intent: c.move, honest: true };
}
// A superior who believes his man went against his order.
export function onDisobedience(p: Perception, man: Character): Reply {
  const t = p.temper, f = p.feelingFor(man);
  const cs = [
    cand('discipline', [{ name: 'an order is an order', value: 0.35 }, { name: 'volatility', value: t.volatility * 0.3 }, { name: 'pride', value: t.pride * 0.2 }]),
    cand('rebuke', [{ name: `regard for ${first(man.name)}`, value: f.trust * 0.3 + f.affection * 0.2 }, { name: 'caution', value: t.caution * 0.2 }]),
    cand('letGo', [{ name: `he needs ${first(man.name)}`, value: f.trust * 0.2 }, { name: 'agreeable', value: t.agreeable * 0.2 }, { name: 'an order ignored makes him look weak', value: -0.2 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: [], candidates: cs, chosen: c.move }, meaning: { key: 'disobedience.' + c.move, stance: 'cold', toward: 'third' }, intent: c.move, honest: true };
}
// A collector deciding his next move on a shop that refused him (asks 'protect', the asker's side).
export function onPressDemand(p: Perception, owner: Character, refusals: number, rounds: number, restrained: number): Reply {
  const t = p.temper, T = p.self.traits, ff = p.feelingFor(owner);
  const cs = [
    cand('ask', [{ name: 'try again', value: rounds === 0 ? 1 : 0.05 }]),
    cand('pressure', [{ name: 'violence (temperament)', value: T.violence * 0.35 }, { name: 'nerve (courage)', value: t.courage * 0.15 }, { name: 'already pressed', value: -0.15 * Math.max(0, rounds - 1) }, { name: 'bound to leave him alone', value: -restrained }]),
    cand('force', refusals >= 1 ? [{ name: 'violence (temperament)', value: T.violence * 0.5 }, { name: `his grudge against ${first(owner.name)}`, value: ff.grudge * 0.4 }, { name: 'caution', value: -t.caution * 0.4 }, { name: 'bound to leave him alone', value: -restrained }] : [{ name: 'he has not refused yet', value: -10 }]),
    cand('wait', [{ name: 'caution', value: 0.05 + t.caution * 0.2 }]),
    cand('drop', [{ name: 'caution', value: t.caution * 0.2 }, { name: 'turned down again and again', value: refusals >= 3 ? 0.4 : refusals >= 2 ? 0.15 : 0 }, { name: 'the time it has taken', value: rounds >= 6 ? 0.4 : 0 }, { name: 'greed', value: -T.greed * 0.15 }, { name: 'bound to leave him alone', value: restrained * 0.8 }]),
  ];
  const c = best(cs);
  return { decision: { by: p.self.id, constraints: restrained > 0 ? [{ kind: 'forbidden', source: 'he is bound to leave the man alone' }] : [], candidates: cs, chosen: c.move }, meaning: { key: 'press.' + c.move, stance: 'flat', toward: 'third' }, intent: c.move, honest: true };
}
