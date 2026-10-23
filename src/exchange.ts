// V90: the exchange inside a matter. A matter (asks.ts) has a subject (protection at Rossi's) and a state (what is on the table,
// how each side stands). An exchange also has the point just made: when a man refuses, puts you off or names his own terms he
// gives a reason, and the next thing said is about that reason, not the matter in general. "I can't afford it." "You're doing
// plenty of business." "You see customers. You don't see what I owe my suppliers." "Then show me your books." "Since when do I
// have to show you anything?" Each step is a real test of the world: whether the reason is true (his money, who protects him,
// what is between you), and how he takes being challenged (his temperament). What the exchange learns changes the matter's state
// through the same stance the rest of the negotiation uses, and the decision is still the matter's own (asks.reconsider).
//
// The point in hand lives on the matter (s.m.beat, s.m.claim, s.m.claimT), so it is there when you come back days later.
import { bear, clamp, feel, money, ownerBiz, peek, rel } from './core';
import { askee, kindOf, reconsider, stance } from './asks';
import { noteHard, temper, viewOf } from './temper';
import type { Character, Situation, World } from './types';

export type Claim = 'money' | 'taken' | 'you' | 'pride' | 'doubt' | 'time';
// What kind of thing is being asked of him decides what his reasons and your answers to them can be: a demand (pay me, back off),
// a request (lend me, cut my share, let me), an offer (a loan, a place, amends) or a claim on something owed (the favour, the pay).
export type AskClass = 'demand' | 'request' | 'offer' | 'claim' | 'trade'; // (Stage 4: a deal, buying or selling a place or a share, or running a man's enterprise for a cut)
const CLS: Record<string, AskClass> = { protect: 'demand', collect: 'demand', warn: 'demand', layoff: 'demand', borrow: 'request', rate: 'request', permit: 'request', help: 'request', lend: 'offer', recruit: 'offer', amends: 'offer', join: 'offer', favour: 'claim', jobpay: 'claim', buy: 'trade', sell: 'trade', run: 'trade', time: 'request' };
export const classOf = (s: Situation): AskClass => CLS[s.ak ?? ''] ?? 'request';
const first = (c: Character) => c.name.split(' ')[0];
const pick = (w: World, s: Situation, k: string, xs: string[]) => { let h = 7; for (const ch of s.id + k + Math.floor(w.now / 1440)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return xs[h % xs.length]; };
const rk = (c: Character) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.rank);

// What he can actually carry: the money the matter asks of him against what he and his business have.
function canPay(w: World, s: Situation, t: Character): boolean {
  const amt = Number(s.m?.offer ?? s.terms?.amt ?? 0);
  if (!amt) return true;
  const b = ownerBiz(w, t.id), weekly = s.ak === 'protect' || s.ak === 'rate';
  if (weekly && b) return amt <= Math.max(20, b.income * 0.12) && b.distress === 0;
  return t.cash + (b?.cash ?? 0) * 0.5 >= amt;
}

// His reasons, in his words, by what was asked of him and who he is (hot: volatile or proud; above: he outranks the asker).
function reasonWords(cls: AskClass, ak: string, c: Claim, hot: boolean, above: boolean, amt: boolean): string[] {
  switch (cls) {
    case 'demand': return ({
      money: hot ? ['“Where do you think I get that kind of money?”', '“Look around. Does this look like a gold mine?”'] : ['“I can’t afford it. I’m telling you the truth.”', '“I haven’t got it. Not every week.”'],
      taken: ['“I already pay someone. You know how this works.”', '“This place is looked after. Ask around.”'],
      you: hot ? ['“Not from you. Not after everything.”', '“You? I wouldn’t give you the time of day.”'] : ['“I don’t feel right doing this with you.”', '“After what’s happened, I can’t.”'],
      pride: hot ? ['“Nobody walks in here and tells me what to do.”', '“I don’t take orders in my own place.”'] : ['“I’ve managed this long without anybody’s help.”', '“I like to stand on my own feet.”'],
      doubt: hot ? ['“Why should I listen to you? I don’t even know who you’re with.”', '“And what do I get, besides your word?”'] : ['“I don’t know you. I don’t know who you’re with.”', '“How would I know you’ll keep your end?”'],
      time: ['“I need to talk to my wife.”', '“Give me a few days. This isn’t nothing.”'],
    } as Record<Claim, string[]>)[c];
    case 'request': return ({
      money: ['“I haven’t got it to spare.”', '“Money’s tight for me too, believe it or not.”'],
      taken: ['“It’s spoken for.”'],
      you: hot ? ['“After everything? You’ve got some nerve asking.”'] : ['“I don’t think so. Not after what happened.”'],
      pride: above ? (ak === 'rate' ? ['“Everybody pays the same. You’ll pay what you’re told.”', '“You’ll pay what everybody pays.”'] : ['“Don’t push your luck.”', '“You’ve had your answer.”']) : ['“Don’t ask me that.”', '“That’s not something I do.”'],
      doubt: ak === 'borrow' ? ['“And when would I see it back?”', '“I lend to people I know.”'] : above ? ['“What have you done to earn it?”', '“Show me first. Then ask.”'] : ['“Why would I do that for you?”'],
      time: ['“Let me think about it.”', '“Ask me again in a few days.”'],
    } as Record<Claim, string[]>)[c];
    case 'offer': return ({
      money: ak === 'recruit' ? ['“It isn’t enough to live on.”', '“For that? I can do better on my own.”'] : ['“I couldn’t pay it back. Not on those terms.”'],
      taken: ['“I’m already spoken for.”'],
      you: ak === 'amends' ? (hot ? ['“Saying it doesn’t undo it.”', '“You think that fixes it?”'] : ['“I hear you. It doesn’t undo it.”']) : hot ? ['“Not from you.”'] : ['“I can’t take anything from you. Not now.”'],
      pride: ak === 'amends' && amt ? ['“You think money fixes this?”'] : ['“I don’t need your help.”', '“I manage. I always have.”'],
      doubt: ['“What’s the catch?”', '“Nobody offers something for nothing.”'],
      time: ['“I need to think it over.”', '“Let me sleep on it.”'],
    } as Record<Claim, string[]>)[c];
    case 'trade': return ({
      money: ak === 'buy' ? ['“That’s not what the place is worth.”', '“For that? I’d rather keep it.”'] : ak === 'sell' ? ['“It isn’t worth that to me.”', '“I haven’t got that kind of money lying around.”'] : ['“That cut? It’s my money you’re talking about.”', '“For that, I’d run it myself.”'],
      taken: ak === 'run' ? ['“I’ve already got a man on it.”'] : ['“It’s not for sale.”'],
      you: hot ? ['“Not to you. Not at any price.”'] : ['“I’d rather not do business with you.”'],
      pride: ak === 'buy' ? ['“I built this place. It isn’t for sale to just anybody.”'] : ak === 'run' ? ['“I run my own business.”'] : ['“I don’t buy what I haven’t looked at.”'],
      doubt: ['“I don’t know you well enough for this.”', '“How do I know it’s straight?”'],
      time: ak === 'sell' ? ['“Let me look at the books first.”'] : ['“Let me think about it. It’s my living.”'],
    } as Record<Claim, string[]>)[c];
    case 'claim': return ({
      money: ['“I haven’t got it right now.”', '“Not this week. I’m short.”'],
      taken: ['“It’s spoken for.”'],
      you: ['“I don’t owe you that much.”', '“We’re not that close any more.”'],
      pride: ['“I’ll decide when I’m square with you.”'],
      doubt: ['“I don’t remember it that way.”', '“That was a long time ago.”'],
      time: ['“Give me a little time.”'],
    } as Record<Claim, string[]>)[c];
  }
}

// Why he said what he said. The real reason is whichever weighed most; a proud or guarded man may give a more respectable one.
export function giveReason(w: World, s: Situation, a: Character, t: Character, ans: 'no' | 'counter' | 'stall'): string | undefined {
  if (!a.isPlayer || t.isPlayer) return undefined;
  const S = stance(w, s, t.id), tp = temper(t), v = viewOf(w, t, a), K = kindOf(s), cls = classOf(s);
  const b = s.biz ? w.biz[s.biz] : undefined;
  const money0 = !!(s.terms?.amt || s.m?.offer) && !['warn', 'layoff', 'join', 'rate', 'permit'].includes(K?.id ?? '');
  const taken = s.ak === 'protect' && !!b?.protection && b.protection.collectorId !== a.id;
  if (cls === 'trade') { // (a deal: the price is usually the point, unless it is you, or the place is spoken for)
    const o = s.ak === 'run' ? w.ops.find((x) => x.id === s.terms?.what) : undefined;
    const real: Claim = ans === 'stall' ? 'time' : v.resent > 0.35 || S.anger > 0.45 ? 'you' : o?.runner && w.chars[o.runner]?.alive ? 'taken' : ans !== 'counter' && v.trust < 0.15 && S.good < 0.2 ? 'doubt' : 'money';
    s.m = { ...(s.m ?? {}), beat: 'claim', claim: real, claimT: 1 };
    if (ans === 'counter') return undefined; // (a counter already gives its reason)
    return pick(w, s, 'r' + real, reasonWords(cls, s.ak ?? '', real, tp.volatility + tp.pride > 1.15, rk(t) > rk(a), true));
  }
  // (what weighs most: someone else's claim on him, bad blood, the money, then whether he knows you at all, then his pride)
  const real: Claim = ans === 'stall' ? 'time' : taken ? 'taken' : v.resent > 0.35 || S.anger > 0.45 ? 'you' : money0 && cls !== 'offer' && !canPay(w, s, t) ? 'money' : v.trust < 0.2 && S.good < 0.25 ? 'doubt' : tp.pride > 0.55 || rk(t) > rk(a) ? 'pride' : money0 && cls !== 'offer' ? 'money' : 'doubt';
  // what he says: a man who would rather not say "it's you" or "it's my pride" talks about money, if money is in it
  let said = real;
  // (naming his own terms, the terms are his point: what they can carry. Nothing unsaid is left in hand.)
  if (ans === 'counter') said = 'money';
  if ((real === 'you' || real === 'pride') && money0 && cls !== 'offer' && (tp.caution > 0.55 || tp.empathy > 0.6) && S.fear > 0.25) said = 'money';
  s.m = { ...(s.m ?? {}), beat: 'claim', claim: said, claimT: said === real && (said !== 'money' || !canPay(w, s, t)) ? 1 : 0 };
  if (said === 'money' && canPay(w, s, t) && cls !== 'offer') s.m.claimT = 0; // (he can pay; whatever else is true, that isn't)
  const hot = tp.volatility + tp.pride > 1.15;
  if (ans === 'counter' && said === 'money') return undefined; // (a counter already gives its reason)
  return pick(w, s, 'r' + said, reasonWords(cls, s.ak ?? '', said, hot, rk(t) > rk(a), money0));
}

export interface Reply { k: string; label: string; hint: string; big?: boolean }
// What can be said back to the point he just made. Few, specific, and each one a different test of the world; what makes sense to
// say back depends on what was asked of him (you don't ask a man you are lending to to show you his books).
export function replies(w: World, p: Character, s: Situation): Reply[] {
  const t = askee(w, s);
  if (!t || s.terms?.by !== p.id) return [];
  // (once he has named a figure, asking him what he can manage is asking what he just said)
  const named = stance(w, s, t.id).last === 'counter';
  // (and once he has been caught out, calling him on it again goes over what is already settled between you)
  return repliesTo(w, p, s, t).filter((r) => !(named && r.k === 'manage') && !(s.m?.caught && r.k === 'doubt'));
}
function repliesTo(w: World, p: Character, s: Situation, t: Character): Reply[] {
  const beat = String(s.m?.beat ?? ''), claim = String(s.m?.claim ?? '') as Claim, cls = classOf(s);
  if (!beat) return [];
  const boss = p.bossId ? w.chars[p.bossId] : undefined, above = rk(t) > rk(p);
  if (beat === 'claim') {
    if (cls === 'demand') switch (claim) {
      case 'money': return [{ k: 'doubt', label: 'You’re doing plenty of business.', hint: 'Call him on it. If he’s lying, he knows you know.' }, { k: 'manage', label: 'Then what can you manage?', hint: 'Let him name a figure.' }];
      case 'taken': return [{ k: 'whopays', label: 'Who do you pay?', hint: 'Find out whose ground this is.' }, { k: 'notthere', label: 'He isn’t here. I am.', hint: 'Make him choose. Word will get back to the other man.', big: true }];
      case 'you': return [{ k: 'past', label: 'Whatever happened, that’s behind us.', hint: 'A man with a heart may meet you halfway. A proud one won’t.' }, { k: 'respect', label: 'I’m not asking you to like me.', hint: 'Business is business. Some men respect that.' }];
      case 'pride': return [{ k: 'asking', label: 'Nobody’s telling you. I’m asking.', hint: 'Give him his dignity back.' }, { k: 'nochoice', label: 'Everybody pays. You’re not special.', hint: 'Wounds his pride. He may give in, or dig in.', big: true }];
      case 'doubt': return [boss ? { k: 'name', label: `I’m with ${boss.name}.`, hint: 'Say whose man you are. It carries weight, and it travels.' } : undefined, { k: 'word', label: 'Ask around. I keep my word.', hint: 'Only as good as what people say about you.' }].filter((x): x is Reply => !!x);
      case 'time': return [{ k: 'give', label: 'Take till the end of the week.', hint: 'Patience. He’ll remember you gave it.' }, { k: 'now', label: 'I need an answer now.', hint: 'Push. He may give one you don’t like.' }];
    }
    if (cls === 'request') switch (claim) {
      case 'money': return [{ k: 'manage', label: 'Even a little would help.', hint: 'Let him say what he can spare.' }];
      case 'doubt': return [{ k: 'word', label: s.ak === 'borrow' ? 'You’ll have it back. My word on it.' : 'Ask around. I keep my word.', hint: 'Only as good as what people say about you.' }, ...(above ? [] : boss ? [{ k: 'name', label: `${boss.name} will vouch for me.`, hint: 'Bring your boss’s name into it.' }] : [])];
      case 'you': return [{ k: 'past', label: 'Whatever happened, that’s behind us.', hint: 'A man with a heart may meet you halfway. A proud one won’t.' }];
      case 'pride': return above ? [{ k: 'respect', label: 'I’m only asking.', hint: 'Let it lie with grace. He will remember that you asked well.' }] : [{ k: 'asking', label: 'I wouldn’t ask if I didn’t need it.', hint: 'Swallow a little pride of your own.' }];
      case 'time': return [{ k: 'give', label: 'Take your time.', hint: 'He’ll remember you gave it.' }, { k: 'now', label: 'I need to know now.', hint: 'Push. He may give one you don’t like.' }];
      default: return [];
    }
    if (cls === 'trade') switch (claim) {
      case 'money': return [{ k: 'manage', label: s.ak === 'sell' ? 'Then what would you pay?' : s.ak === 'run' ? 'Then what would you give a man?' : 'Then name your price.', hint: 'Let him put a figure on it.' }];
      case 'doubt': return [{ k: 'word', label: 'Ask around. I keep my word.', hint: 'Only as good as what people say about you.' }, ...(boss ? [{ k: 'name', label: `I’m with ${boss.name}.`, hint: 'Say whose man you are. It carries weight, and it travels.' }] : [])];
      case 'you': return [{ k: 'past', label: 'Whatever happened, this is business.', hint: 'A man with a heart may meet you halfway. A proud one won’t.' }];
      case 'pride': return [{ k: 'asking', label: 'I’m making you an offer, that’s all.', hint: 'Give him his dignity back.' }];
      case 'time': return [{ k: 'give', label: 'Take your time.', hint: 'He’ll remember you gave it.' }, { k: 'now', label: 'I need to know now.', hint: 'Push. He may give one you don’t like.' }];
      default: return [];
    }
    if (cls === 'offer') switch (claim) {
      case 'doubt': return [{ k: 'nocatch', label: 'No catch. I want you on my side.', hint: 'He may believe you, if he trusts you at all.' }];
      case 'pride': return [{ k: 'asking', label: 'Nobody says you need it. I’m offering.', hint: 'Let him keep his pride.' }];
      case 'you': return [{ k: 'past', label: s.ak === 'amends' ? 'I know. I’m trying to put it right.' : 'Whatever happened, that’s behind us.', hint: 'A man with a heart may meet you halfway. A proud one won’t.' }];
      case 'money': return [{ k: 'manage', label: 'What would it take?', hint: 'Let him name his terms.' }];
      case 'time': return [{ k: 'give', label: 'Take your time.', hint: 'He’ll remember you gave it.' }];
      default: return [];
    }
    switch (claim) { // a claim on what he owes you
      case 'money': return [{ k: 'manage', label: 'Then what can you give me now?', hint: 'Part now is better than nothing.' }];
      case 'you': case 'doubt': case 'pride': return [{ k: 'remind', label: 'You remember what I did for you.', hint: 'Hold it in front of him. It costs a little goodwill.' }];
      case 'time': return [{ k: 'give', label: 'All right. Not long.', hint: 'Give him a little time.' }];
      default: return [];
    }
  }
  if (beat === 'nottrue') return [{ k: 'books', label: 'Then show me your books.', hint: 'Make him prove it.' }, { k: 'manage', label: 'All right. What can you manage?', hint: 'Let him name a figure.' }];
  if (beat === 'nobooks') return [{ k: 'assume', label: 'Then I’ll take it you can pay.', hint: 'You have called his bluff, or his pride.', big: true }, { k: 'manage', label: 'Suit yourself. What can you manage?', hint: 'Let it go, and let him name a figure.' }];
  return [];
}

// Saying it, and his answer. The point is tested against the world (is his reason true? will he show you? does the name you
// drop mean anything to him?), that moves how he stands, he decides again on the matter itself (asks.reconsider), and only then
// are his words chosen: from what he decided, so a softening that ends in a refusal is never said as agreement.
export function reply(w: World, p: Character, s: Situation, k: string): string[] {
  const t = askee(w, s)!, S = stance(w, s, t.id), tp = temper(t), v = viewOf(w, t, p);
  const T = Number(s.m?.claimT ?? 1) === 1, hot = tp.volatility + tp.pride > 1.15, soft = tp.agreeable + tp.empathy > 1.1;
  const beat = (b: string | undefined) => { s.m = { ...(s.m ?? {}), beat: b ?? '' }; };
  // he decides; his words follow from the decision ([yes, no]; a counter speaks for itself, a stall says he wants time)
  // (mid: how he turns from your point to his own figure, when he names one; every reply has its own)
  const settle = (yes: string, no: string, mid = '“All right. Here’s what I can do.”'): string[] => {
    beat(undefined);
    const o = reconsider(w, s);
    const said = o.answer === 'yes' ? yes : o.answer === 'counter' ? mid : o.answer === 'stall' ? (soft ? '“Let me think about it. Honestly.”' : '“I’ll think about it.”') : no;
    return [...(said ? [said] : []), ...o.lines];
  };
  switch (k) {
    case 'doubt':
      if (!T) { // he can pay, and he knows you know it: the point is now whether he will prove otherwise
        S.resolve = clamp(S.resolve - 0.2); S.anger = clamp(S.anger + tp.pride * 0.1);
        s.m = { ...(s.m ?? {}), beat: 'nottrue', claimT: 0, caught: 1 };
        return [hot ? '“…So I do all right. That doesn’t make it yours.”' : 'He looks away. “Business is… all right. Some weeks.”'];
      }
      S.anger = clamp(S.anger + 0.04 + tp.pride * 0.06); beat('nottrue');
      return [pick(w, s, 'sup', hot ? ['“You see customers. You don’t see what I owe my suppliers.”', '“You think you know my business better than me?”'] : ['“You see the front of the shop. You don’t see the bills.”', '“It looks busy. Busy isn’t the same as making money.”'])];
    case 'books': {
      // a guarded or proud man won't open his books to you; an agreeable one will, or one telling the truth who wants you to see it
      const shows = tp.agreeable * 0.5 + (T ? 0.25 : -0.2) + v.trust * 0.3 + S.fear * 0.2 - tp.pride * 0.35 - tp.caution * 0.1 > 0.2;
      if (!shows) { S.anger = clamp(S.anger + 0.06); beat('nobooks'); return [hot ? '“Since when do I have to show you anything?”' : '“My books are my business. I’m sorry.”']; }
      if (T) { S.good = clamp(S.good + 0.08); s.m!.shown = 1; return ['He brings out a ledger and turns it round for you. He isn’t lying: what you’re asking is more than the place clears.', ...settle('“So. Now you know.”', '“So now you’ve seen it. It’s still too much.”', '“So now you know what I can really do.”')]; }
      S.resolve = clamp(S.resolve - 0.3); s.m!.caught = 1;
      return ['He opens the ledger, and closes it again too quickly. You saw enough. He can pay.', ...settle('“…All right. All right.”', '“Whatever you think you saw, the answer’s the same.”', '“…All right. Here’s what I can really do.”')];
    }
    case 'assume':
      S.fear = clamp(S.fear + 0.12 * (1 - tp.courage * 0.5)); S.anger = clamp(S.anger + 0.05 + tp.pride * 0.1); noteHard(w, p, t, 'threats', 0.5);
      return settle(T ? '“Then you’ll have it, and God help me finding it.”' : '“…Maybe I can find something.”', T ? (hot ? '“Take it how you like. It won’t make the money appear.”' : 'He spreads his hands. “Then you’ll be disappointed.”') : '“Take what you like. You won’t get it from me.”', T ? '“If I must, here’s what I can manage.”' : '“…Maybe I can find something.”');
    case 'manage': {
      const K = kindOf(s), c = K?.counter?.(w, s, p, t);
      if (!c) { beat(undefined); return [T ? '“Nothing. That’s what I’m telling you.”' : '“I didn’t say I’d pay anything.”']; }
      S.last = 'counter'; s.m = { ...(s.m ?? {}), offer: c.amt, why: c.why, beat: '' };
      return [`“${K?.fmt ? K.fmt(c.amt) : money(c.amt)}${s.ak === 'protect' ? ' a week' : ''}. That I could do.”`];
    }
    case 'whopays': {
      const b = s.biz ? w.biz[s.biz] : undefined, col = b?.protection ? w.chars[b.protection.collectorId] : undefined;
      beat(undefined);
      if (!col || !(tp.agreeable > 0.45 || S.fear > 0.4)) return ['“That’s between me and him.”'];
      return [`“${col.name}’s people. ${col.familyId === p.familyId ? 'Your own family, if I’m not mistaken.' : 'You want to take it up with somebody, take it up with him.'}”`];
    }
    case 'notthere':
      S.fear = clamp(S.fear + 0.15 * (0.7 + tp.caution * 0.4 - tp.courage * 0.3)); S.anger = clamp(S.anger + 0.08); noteHard(w, p, t, 'threats', 0.5);
      return settle('He glances at the door, as if the man might walk in. “…All right. You. From now on, you.”', tp.courage > 0.6 ? '“He’ll be here soon enough if I call him.”' : 'He glances at the door. “I can’t. He’d know by tonight.”', '“You. Maybe. But not at that price.”');
    case 'past':
      if (tp.empathy + tp.agreeable > 1.05 && peek(t, p.id).grudge < 0.6) { S.anger = clamp(S.anger - 0.15); S.good = clamp(S.good + 0.08); return settle('“Maybe it is. All right.”', '“Maybe. But that doesn’t change my answer.”', '“Maybe it is behind us. The price isn’t.”'); }
      S.anger = clamp(S.anger + 0.04); beat(undefined);
      return [hot ? '“For you, maybe.”' : '“It isn’t behind me.”'];
    case 'respect':
      if (tp.pride < 0.55 || tp.agreeable > 0.55) { S.anger = clamp(S.anger - 0.06); return settle('“…No. I suppose you’re not. All right.”', '“No, you’re not. And I’m still not doing it.”', '“No, you’re not. So let’s talk about the number.”'); }
      beat(undefined); return ['“Good. Because I don’t.”'];
    case 'asking':
      S.anger = clamp(S.anger - tp.pride * 0.12); S.resolve = clamp(S.resolve - tp.pride * 0.12);
      return settle(tp.pride > 0.55 ? 'Something in his shoulders eases. “Asking. All right. That’s different.”' : '“Asking, telling. Fine.”', tp.pride > 0.55 ? '“I appreciate you saying it. The answer’s still no.”' : '“Asking, telling. It comes to the same.”', '“Asking. All right. Then here’s what I’d say back.”');
    case 'nochoice':
      if (tp.courage + tp.pride > 1.2) { S.resolve = clamp(S.resolve + 0.12); S.anger = clamp(S.anger + 0.15); bear(w, t, p.id, 0.04, `${p.name} told him he had no choice`); beat(undefined); return ['“Then I’ll be the first.”']; }
      S.fear = clamp(S.fear + 0.12); S.resolve = clamp(S.resolve - 0.1); noteHard(w, p, t, 'threats', 0.5);
      return settle('He says nothing for a long moment. “…Fine.”', 'He says nothing for a long moment, and then shakes his head.', 'He says nothing for a long moment. “…Then here’s what I can do.”');
    case 'name': {
      const boss = p.bossId ? w.chars[p.bossId] : undefined, vb = boss ? viewOf(w, t, boss) : undefined;
      if (vb) { S.fear = clamp(S.fear + vb.fear * 0.3 + vb.danger * 0.2); S.good = clamp(S.good + vb.respect * 0.1); }
      const knows = !!vb && (vb.danger > 0.2 || vb.respect > 0.4);
      return settle(knows ? `He knows the name. “${first(boss!)}. Why didn’t you say so?”` : `“${boss ? first(boss) : 'Him'}? …All right. All right.”`, knows ? `He knows the name. “${first(boss!)}. I still can’t.”` : `“${boss ? first(boss) : 'Him'}? Should that mean something to me?”`, knows ? `He knows the name. “${first(boss!)}. All right, then. Let’s talk about the number.”` : `“${boss ? first(boss) : 'Him'}? Fine. Let’s talk about the number.”`);
    }
    case 'word': {
      const rep = p.rep ?? { kept: 0, broken: 0 };
      if (v.trust > 0.35 || rep.kept > rep.broken + 2) { S.good = clamp(S.good + 0.08); return settle('“I’ve heard you’re straight. All right.”', '“I’ve heard you’re straight. It isn’t enough.”', '“Maybe you are. Let’s talk about the number.”'); }
      beat(undefined); return ['“I haven’t heard anything about you. That’s the problem.”'];
    }
    case 'nocatch': {
      const believes = v.trust * 0.6 + tp.agreeable * 0.3 + (1 - tp.caution) * 0.2 > 0.45;
      if (believes) { S.good = clamp(S.good + 0.1); S.resolve = clamp(S.resolve - 0.1); return settle('“…All right. I’ll take you at your word.”', '“Maybe there isn’t. It’s still no.”', '“All right. On what terms?”'); }
      beat(undefined); return [soft ? '“There’s always a catch. I’m sorry.”' : '“There’s always a catch.”'];
    }
    case 'remind': {
      S.fear = clamp(S.fear + 0.06); S.good = clamp(S.good + 0.05); S.anger = clamp(S.anger + tp.pride * 0.06); feel(w, t, p.id, 'affection', -0.02);
      return settle('He looks away. “I remember. All right.”', tp.pride > 0.6 ? '“I remember. I don’t like being reminded.”' : '“I remember. I still can’t.”', '“I remember. I can’t do all of it.”');
    }
    case 'give': S.good = clamp(S.good + 0.05); s.next = w.now + 4 * 1440; s.phase = 'waiting'; beat(undefined); return [soft ? '“Thank you. I mean it.”' : '“Fine.”'];
    case 'now': S.anger = clamp(S.anger + 0.05); S.fear = clamp(S.fear + 0.05); return settle(soft ? '“All right. Yes. Fine.”' : '“You want it now? Fine. Yes.”', hot ? '“Then it’s no.”' : '“Then I’m sorry. No.”', '“Now? Then it’s this.”');
  }
  return [];
}
