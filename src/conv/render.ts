// Rendering (spec §9): a line is composed from what it means (key, stance, who the feeling is aimed at, the subtext, the grounds)
// and from who is saying it (archetype, temperament). Nothing here reads the world: only the meaning's slots, which the decision
// filled from the speaker's own perception. Variants are chosen by a stable hash, and a visit never repeats a line.
import type { Arch } from '../voice';
import { hash } from '../voice';
import type { Meaning } from './types';

type Pick = string | string[];
// a bank entry: lines by archetype (default '_'), optionally by grounds or stance
type Entry = Partial<Record<Arch | '_', Pick>>;
const B: Record<string, Entry> = {
  // ---------------------------------------------------------------- arriving
  'greet.customer': {
    _: ['“Help you?”', '“What can I get you?”'],
    jovial: ['“Afternoon! What’ll it be?”', '“Come in, come in. What can I get you?”'],
    cold: ['“Yeah?”', '“What do you need?”'],
    frightened: ['“Can I— can I help you with something?”'],
    proud: ['“Yes?”'],
    bitter: ['“What do you want?”'],
  },
  'greet.known': { _: ['“Ah. It’s you.”', '“Back again.”'], jovial: ['“There he is! Come in.”'], cold: ['He nods. Nothing more.'] },
  'beat.greet': { _: ['He looks up from the counter.', 'He doesn’t stop what he’s doing.'], frightened: ['He looks up too quickly.'], jovial: ['He wipes his hands on his apron.'], cold: ['He looks at you, then at the door behind you.'] },

  // ---------------------------------------------------------------- what the player says (rendered the same way)
  'introduce.self': { _: ['“{selfName}. I’m with the {selfFamily} family.”'] },
  'compliment.business': { _: ['“Nice place. You must do well here.”'] },
  'demand.protection': { _: ['“{amt} a week, and nothing happens to the place.”'] },
  'demand.protection.soft': { _: ['“{amt} a week, and I’m around if anyone gives you trouble.”'] },
  'demand.protection.lean': { _: ['“It’d be a shame if something happened to {bizName}.”', '“Places like this, things happen to them. Not if you’re with us.”'] },
  'tell.reputation': { _: ['“Ask around. {selfName}, {selfFamily} family.”'] },
  'press.now': { _: ['“I’m asking now.”'] },
  'announce.return': { _: ['“Think it over. I’ll be back {day}.”'] },
  'buy.small': { _: ['“Just {item}, thanks.”', '“Just this, thanks.”'] },
  'stay.wait': { _: ['“I’ll wait.”'] },
  'claim.authority': { _: ['“{authority} sent me.”'] },
  'ask.who': { _: ['“Who was behind what happened at {shop}?”'] },
  'ask.intervention': { _: ['“{forName}’s having trouble with {againstName}. I want to bring it to the family.”'] },
  'argue.ground': { _: ['“{againstFirst}’s making trouble on our streets.”'] },
  'argue.word': { _: ['“I gave {forFirst} my word I’d raise it.”'] },
  'argue.money': { _: ['“There’s money in bringing {forFirst} under our protection.”'] },
  'leave.another': { _: ['“Another time, then.”'] },
  'spend.time': { _: ['“Let me buy you a drink.”'] },
  'let.go': { _: ['“All right. I’ll leave it.”'] },
  'ask.whoPays': { _: ['“Who collects from you?”'] },
  'offer.better': { _: ['“Whoever it is, I could do better for you.”'] },
  'accept.counter': { _: ['“{amt} a week, then.”'] },
  'raise.again': { _: ['“About {forFirst} and {againstFirst}.”'] },
  'ask.progress': { _: ['“Have you talked to {theirCaptainFirst}?”', '“Anything on {forFirst}?”'] },

  // ---------------------------------------------------------------- hearing who you are
  'react.introduction.warnOff.sameFamily': {
    _: ['“Then you know {collectorFirst}. He looks after this place.”'],
    cold: ['“{collectorFirst} looks after this place. You’re not him.”'],
    earnest: ['“{youFamily}. Then you know {collectorFirst} already. He looks after this place.”'],
  },
  'react.introduction.warnOff.otherFamily': {
    _: ['“I’m looked after. The {collectorFamily} people. Have been for {since}.”', '“I’m looked after. The {collectorFamily} people.”'],
    cold: ['“The {collectorFamily}s look after this place. You’d want to talk to them first.”'],
  },
  'react.introduction.warnOff.kin': {
    _: ['“{youFamily}, huh. My cousin {kinFirst}’s with the {kinFamily}s. Just so you know.”'],
    schemer: ['“{youFamily}. My cousin {kinFirst} runs with the {kinFamily}s. Small world.”'],
  },
  'react.introduction.probe': {
    _: ['“The {youFamily} family. And what does the {youFamily} family want with a place like this?”'],
    bitter: ['“{youFamily}. Course you are. So what’s this about?”'],
  },
  'react.introduction.appease': {
    _: ['“Mr. {youSurname}. Of course. What can I do for you?”'],
    frightened: ['“Mr. {youSurname}. Yes. Of course. Whatever you need.”'],
  },
  'react.introduction.proud': {
    _: ['“I know who the {youFamily}s are. I don’t need anything from them.”'],
    hothead: ['“Good for you. I don’t need anything from the {youFamily}s.”'],
  },
  'react.introduction.neutral': { _: ['“{youName}.” He nods. “All right.”'], jovial: ['“{youName}! Good to meet you.”'] },

  // ---------------------------------------------------------------- a compliment taken at face value
  'reply.compliment': {
    _: ['“We do all right.”', '“Can’t complain. Wouldn’t do any good if I did.”'],
    proud: ['“It didn’t happen by accident.”'],
    bitter: ['“Do well? You seen the rents around here?”'],
    schemer: ['“Well enough. Why do you ask?”'],
    hothead: ['“Better than most.”'],
    earnest: ['“We do all right, thank God.”'],
    jovial: ['“Flattery! You’ll go far. What can I get you?”'],
    frightened: ['“Oh— thank you. We get by.”'],
  },

  // ---------------------------------------------------------------- refusing protection, by the reason given
  'refuse.protection.doesNotKnow': {
    _: ['“I don’t know you. I don’t know who you’re with. Come back with someone I know.”'],
    earnest: ['“I don’t know you, Mr. {youSurname}. I don’t do business with people I don’t know.”'],
  },
  'refuse.protection.doesNotKnow.indignant': {
    _: ['“You walk in off the street asking for money, and I’m supposed to hand it over?”'],
  },
  'refuse.protection.hasArrangement': {
    _: ['“You tell whoever sent you I already have an arrangement.”'],
    earnest: ['“I already pay {collectorFirst}. I’m not paying twice.”'],
    cold: ['“I pay {collectorFirst}. Take it up with him.”'],
    frightened: ['“I already pay someone. Please. I can’t pay two people.”'],
  },
  'refuse.protection.hasArrangement.inferred': {
    _: ['“I know where this is going. I already have someone who looks after the place.”'],
    cold: ['“If this is about an envelope, I already have someone.”'],
  },
  'refuse.protection.pride': {
    _: ['“Nobody tells me what to pay in my own shop. Get out.”'],
    hothead: ['“Get out of my shop before I throw you out.”'],
    proud: ['“I’ve run this {ownNoun} without anybody’s help. Get out.”'],
  },
  'refuse.protection.cannotAfford': {
    _: ['“I can’t carry it. Look at this place.”'],
  },

  'counter.protection': {
    _: ['“{amt} I could do, if it means the street stays quiet. What do I get for it?”'],
    bitter: ['“{amt}. That’s all there is, and what do I get for it?”'],
  },
  'accept.protection.afraid': {
    _: ['“All right. All right. {amt} a week.”'],
    frightened: ['He looks at the door, then at you. “Fine. {amt}. Just— fine.”'],
  },
  'accept.protection': { _: ['“{amt} a week.”'] },
  'refer.protection.kin': {
    _: ['“Talk to my cousin {kinFirst}. He’s with the {kinFamily}s. Anything about this place goes through him.”'],
    schemer: ['“You’ll want to talk to my cousin {kinFirst} about that. The {kinFamily}s take an interest in this street.”'],
  },

  // ---------------------------------------------------------------- a stated intention, acknowledged (no promise from him)
  'acknowledge.return': {
    _: ['“{day}, then.”'],
    cold: ['He’s already turning back to his work. “Suit yourself.”'],
    frightened: ['“{day}. All right.”'],
    proud: ['“Come back whenever you like. The answer won’t change.”'],
  },

  // ---------------------------------------------------------------- not wanting to talk, and staying anyway
  'dismiss.pretext': { _: ['He keeps his eyes on the till. “We’re closing.” It’s {hour}.'], jovial: ['“Not today, friend. I’m run off my feet.”'] },
  'dismiss.hostile': { _: ['“I’ve got nothing to say to you. Go on.”'], hothead: ['“Out. Now.”'] },
  'react.wait.tolerate': { _: ['He goes back to his work as if you weren’t there.'] },
  'react.wait.threaten': { _: ['“Stand there all day if you like. I’ll call {protectorFirst} and he can stand there with you.”'] },
  'react.wait.giveIn': { _: ['He sighs and puts the cloth down. “All right. What do you want?”'], frightened: ['After a minute he can’t stand it. “All right. What is it you want?”'] },
  'react.wait.call': { _: ['He goes into the back. You hear him on the telephone, low. When he comes out he doesn’t look at you.'] },

  // ---------------------------------------------------------------- a claim of authority
  'react.claim.unknownName': { _: ['“I don’t know any {authority}. I pay {collectorFirst}.”'], cold: ['“Never heard of him.”'] },
  'react.claim.test': { _: ['“{authority}? Then he can come and tell me himself.”'], schemer: ['“Did he. Funny, he never mentioned you.”'] },
  'react.claim.believed': { _: ['He goes a little pale. “If {authority} sent you…”'] },

  // ---------------------------------------------------------------- information between men who trust each other
  // (by what he is to it: the man it was done to, a man who saw it, a man who heard. What each can claim is in types.CLAIMABLE.)
  'answer.who.knows.victim': { _: ['“It was {actorFirst}’s people. They did it to me.”'], cold: ['“{actorFirst}. It was my place.”'] },
  'answer.who.knows.witness': { _: ['“{actorFirst}’s boys. I saw it.”'], cold: ['“{actorFirst}. I saw them.”'], jovial: ['“That was {actorFirst}’s crowd, God help us. I saw the whole thing.”'] },
  'answer.who.knows.hearsay': { _: ['“Word is it was {actorFirst}’s boys. I didn’t see it myself.”'] },
  'answer.who.withhold.victim': { _: ['“I don’t want any more trouble.”'], cold: ['“That’s my business.”'] },
  'answer.who.withhold.witness': { _: ['“I didn’t see anything.”'], cold: ['“Not my business.”'] },
  'answer.who.withhold.hearsay': { _: ['“I wouldn’t want to say.”'], cold: ['“Not my business.”'] },
  'answer.who.unknown.victim': { _: ['“I wish I knew. Nobody’s saying.”'] },
  'answer.who.unknown': { _: ['“I couldn’t tell you. Nobody’s saying.”'] },

  // ---------------------------------------------------------------- the captain
  'refuse.intervention.notOurs': {
    _: ['“{forFirst}? He’s not one of ours. Why should we get involved?”'],
    cold: ['“{forFirst} isn’t ours. It isn’t our business.”'],
  },
  'doubt.argument.ground': { _: ['“Our streets? Says who? I haven’t heard a word about it.”'] },
  'reject.argument.word': { _: ['“Then you gave it too quickly. That’s yours to carry, not mine.”'] },
  'weigh.argument.money': { _: ['“Maybe. A {forNoun}’s not much of an envelope.”', '“Maybe. It’s not much of an envelope.”'] },
  'react.argument.ground.supported': { _: ['“I know what {againstFirst}’s been doing on my streets.”'] },
  'raise.newinfo': {
    _: ['“You heard about {hitShop}? {againstFirst}’s people. On my book.”'],
    cold: ['“{againstFirst}’s people were at {hitShop}. That’s mine.”'],
  },
  'accept.intervention.liable': {
    _: ['“All right. I’ll have a word with {theirCaptainFirst}. But if this turns ugly, it’s on you.”'],
    proud: ['“I’ll speak to {theirCaptainFirst}. Understand me: if this goes bad, it’s on you.”'],
  },
  'answer.progress.pending': { _: ['“I said I’d talk to him. Give it a few days.”'], proud: ['“I told you I’d see to it. I don’t need reminding.”'] },
  'answer.progress.irritated': { _: ['“You’ve asked me {nTimes} now. I heard you the first time.”'] },
  'dismiss.persistence': { _: ['“Don’t come to me about {forFirst} again. When there’s something to tell you, you’ll hear it.”'] },
  'answer.progress.done': { _: ['“It’s done. {theirCaptainFirst} spoke to him. {againstFirst} stays away from {forFirst}.”'] },
  // ---------------------------------------------------------------- general answers, for any request (fallbacks by reason)
  'refuse.doesNotKnow': { _: ['“I don’t know you well enough for that.”'], cold: ['“I don’t know you.”'], jovial: ['“Ah, I don’t know you from Adam, friend. Ask me again in a month.”'] },
  'refuse.risk': { _: ['“I’d like to help. I’d also like to see my money again.”'], cold: ['“I don’t lend to people I’d have to chase.”'], bitter: ['“And when would I see it back? Never, that’s when.”'] },
  'refuse.cannotSpare': { _: ['“I haven’t got it to spare. Not this week.”'], proud: ['“It isn’t there to lend. Leave it.”'] },
  'refuse.wordNotEnough': { _: ['“Everybody’s good for it, until they’re not. I don’t know you.”'], jovial: ['“Sure you are. They all are. Ask me again when I know you.”'], cold: ['“Anyone can say that.”'] },
  'refuse.already': { _: ['“You asked me. I answered.”'], hothead: ['“I heard you the first time.”'], jovial: ['“Same question, same answer, friend.”'] },
  'refuse': { _: ['“No.”'] },

  // ---------------------------------------------------------------- the captain, pressed within one visit
  'condition.intervention': { _: ['“Tell me something I don’t know. Show me {againstFirst}’s people on our streets and we’ll talk.”'], cold: ['“You’re telling me what you want. Bring me what {againstFirst}’s actually done on our streets.”'] },
  'cutOff.argument': { _: ['“We’re done with this, {youFirst}. Bring me something, or let it go.”'], proud: ['“Enough. You’ve made your case. The answer’s the same.”'] },

  // ---------------------------------------------------------------- a loan (a situation the worked examples never covered)
  'ask.loan': { _: ['“I need {amt}. I’ll pay the usual.”'] },
  'argue.reputation': { _: ['“I’m good for it. Ask anyone.”'] },
  'sweeten.rate': { _: ['“Make it {rate} percent a week, then.”'] },
  'promise.repay': { _: ['“You’ll have it back by {when}. My word.”'] },
  'accept.counter.loan': { _: ['“{amt} at {rate}. Done.”'] },
  'accept.loan': { _: ['He counts it out without looking at it. “{amt}. {rate} a week. Don’t make me come looking.”'], jovial: ['“{amt}. {rate} a week, and the first drink’s on you.”'] },
  'counter.loan.risk': { _: ['“I can do {amt}. {rate} a week, and I want it on time.”'], cold: ['“{amt}. {rate}. Miss a week and we have a different conversation.”'] },
  'counter.loan.cannotSpare': { _: ['“{amt} is what I can spare. {rate} a week.”'] },

  // ---------------------------------------------------------------- telling him something he has never heard
  'tell.news': { _: ['“You hear what happened at {topic}?”'] },
  'answer.unknownTopic': { _: ['“First I’ve heard of it.”'], jovial: ['“No! When was this? First I’ve heard.”'], cold: ['“No. Should I have?”'], frightened: ['“No. God. Is it— is it bad?”'] },

  // ---------------------------------------------------------------- the man you made a promise to, when you come back
  'followup.pending': { _: ['“Well? Did you talk to them?”'], frightened: ['“Did you— is anything happening? They were back {lastSeen}.”', '“Did you— is anything happening?”'], proud: ['“I’m still waiting on you.”'] },
  'report.refusedSoFar': { _: ['“I raised it. The captain won’t move on it yet.”'] },
  'report.stall': { _: ['“Give it time. These things take time.”'] },
  'react.report.honest': { _: ['He lets out a breath. “At least you’re straight with me.”'], proud: ['“So I’m on my own.”'], frightened: ['“What do I do if they come back?”'] },
  'react.report.stall': { _: ['“Time. Right.” He doesn’t believe you.'] },
  'followup.observed': { _: ['“{againstFirst}’s people haven’t been back. Was that you?”'] },
  'report.done': { _: ['“I took it to the family. He won’t bother you again.”'] },
  'thanks.kept': { _: ['“I won’t forget it. Anything you need here, you ask.”'], cold: ['He nods once. “I owe you.”'], frightened: ['“Thank you. Thank you. I didn’t think anybody would.”'] },

  // ---------------------------------------------------------------- Gate 1 additions: the vocabulary of new acts only (one plain line each)
  'order.collect': { _: ['“Go and see {debtorFirst}. Collect {amt}.”'] },
  'accept.report': { _: ['“All right.”'] },
  'ask.debt': { _: ['“About what you owe me.”'] },
  'confront.claim': { _: ['“{otherFirst} says he paid you {amt}.”'] },
  'report.collection.honest': { _: ['“{amt}. All of it.”'] },
  'report.collection.short': { _: ['“{debtorFirst} only had {amt}. Says the rest next week.”'] },
  'answer.debt.paid': { _: ['“I paid your man {amt} {when}. Ask him.”', '“I paid your man {amt}. Ask him.”'] },
  'confront.admit': { _: ['He looks at the floor. “All right. I kept some of it. I’ll get it back to you.”'] },
  'confront.deny': { _: ['“He’s lying. I got what I told you.”'] },
  'confront.defy': { _: ['“You’d take his word over mine?”'] },
  'seek.help': { _: ['“{againstFirst}’s people were in {lastSeen}. I won’t pay him. Can you do anything?”', '“{againstFirst} wants money off me. I won’t pay him. Can you do anything?”'] },
  'promise.action': { _: ['“I’ll speak to my captain about it.”'] },
  'promise.effort': { _: ['“I’ll do what I can.”'] },
  'promise.result': { _: ['“I’ll make sure he leaves you alone.”'] },
  'promise.restraint': { _: ['“I won’t tell a soul you came to me.”'] },
  'ack.promise.action': { _: ['“That’s something. Tell him what they’ve been doing.”'] },
  'ack.promise.effort': { _: ['“I suppose that’s all anyone can do.”'] },
  'ack.promise.result': { _: ['“You mean that? Then I’ll hold you to it.”'] },
  'ack.promise.restraint': { _: ['“Good. If {againstFirst} hears I came to you…”'] },
  'followup.broken': { _: ['“They were back. You said you’d make sure.”'] },
  'report.admitNotDone': { _: ['“No. I never got to it.”'] },
  'react.report.admit': { _: ['He takes that in. “Well. At least you didn’t take the credit.”'] },
  'tell.secret': { _: ['“{forName} came to me about you.”'] },
  'react.told': { _: ['“Did he.”'] },
  'ask.again': { _: ['“Tell me again. From the start.”'] },
  // ---------------------------------------------------------------- Gate 2a additions: the vocabulary of new acts only
  'tell.trouble': { _: ['“{againstFirst}’s people smashed up {shop}. That’s our ground.”'] },
  'card.promise.action': { _: ['You told {first} you’d raise it with your captain. That’s what you’ve promised: to raise it.'] },
  'card.promise.effort': { _: ['You told {first} you’d do what you can. He’ll expect you to try.'] },
  'card.promise.result': { _: ['You told {first} {againstFirst} will leave him alone. He’ll hold you to it for {days} days.'] },
  'card.promise.restraint': { _: ['You told {first} you’d keep it to yourself.'] },
  'card.report.collection': { _: ['{first} says {debtorFirst} paid {amt}.'] },
  'card.answer.debt.paid': { _: ['{first} says he paid {toFirst} {amt}.'] },
  'card.confront.admit': { _: ['{first} admitted keeping {amt}, and says he’ll give it back.'] },
  'card.confront.deny': { _: ['{first} sticks to his story. He says {otherFirst} is lying.'] },
  // ---------------------------------------------------------------- outcome cards: only what was said or seen, attributed
  'card.refuse.hasArrangement': { _: ['{first} turned you down. He says he already pays {collectorFirst}.'] },
  'card.refuse.hasArrangement.inferred': { _: ['{first} turned you down before you’d asked. He says he already has someone.'] },
  'card.refuse.doesNotKnow': { _: ['{first} turned you down. He says he doesn’t know you.'] },
  'card.refuse.pride': { _: ['{first} told you to get out.'] },
  'card.counter.protection': { _: ['{first} offered {amt} a week instead, and asked what he gets for it.'] },
  'card.accept.protection.afraid': { _: ['Agreed: {amt} a week. He said it fast, and he wouldn’t look at you.'] },
  'card.accept.protection': { _: ['Agreed: {amt} a week.'] },
  'card.refer.protection.kin': { _: ['{first} sent you to his cousin {kinFirst}. He says anything about the place goes through the {kinFamily}s.'] },
  'card.agreed.counter': { _: ['Agreed: {amt} a week. He says he wants the street kept quiet for it.'] },
  'card.refuse.intervention': { _: ['{first} won’t take it up. He says {forFirst} isn’t one of ours.'] },
  'card.condition.intervention': { _: ['{first} won’t take it up yet. He says he’d need to see {againstFirst}’s people on our streets.'] },
  'card.cutOff.argument': { _: ['{first} won’t hear any more about it today.'] },
  'card.accept.intervention.liable': { _: ['{first} says he’ll speak to {theirCaptainFirst}. If it turns ugly, he says, it’s on you.'] },
  'card.refuse.loan': { _: ['{first} won’t lend to you. He says {groundsWords}.'] },
  'card.counter.loan': { _: ['{first} offered {amt} at {rate} a week instead.'] },
  'card.agreed.loan': { _: ['Agreed: {first} lends you {amt} at {rate} percent a week. He says he wants it on time.'] },
  'card.intention.return': { _: ['You said you’d be back {day}.'] },
  'card.answer.who.knows.witness': { _: ['{first} says it was {actorFirst}’s people. He says he saw it.'] },
  'card.answer.who.knows.hearsay': { _: ['{first} says he heard it was {actorFirst}’s people. He didn’t see it himself.'] },
  'card.answer.who.knows.victim': { _: ['{first} says it was {actorFirst}’s people who did it to him.'] },
  'card.kept': { _: ['{first} says his trouble with {againstFirst} is over. He thanks you.'] },
};


// Narration for what is done rather than said
const N: Record<string, Entry> = {
  'outcome.metOnly': { _: ['You’ve met {listenerFirst}.'] },
};

const fill = (s: string, slots: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k) => slots[k] ?? `{${k}}`);

// How a line was found: the bank level it came from (for the generalisation report). 'specific' = written for this request and
// reason; 'reason' = the general line for this kind of answer and reason; 'kind' = the line for the request with no reason;
// 'verb' = the bare answer ("No."); 'missing' = nothing at all. 'own' says whether the speaker's archetype had a line of its own.
export interface RenderInfo { line: string; key: string; level: 'specific' | 'reason' | 'kind' | 'verb' | 'missing'; own: boolean; template?: string }
export const lastRender: { info?: RenderInfo } = {};
export function render(m: Meaning, speakerId: string, arch: Arch, spoken: Set<string> = new Set(), salt = ''): string {
  // most specific first; then the general line for this kind of answer and reason, so a new kind of request reuses what exists.
  // What he is to the event (his role) comes before the bare key: a victim is never given a bystander's line if he has his own.
  const verb = m.key.split('.')[0];
  const keys = [m.grounds ? `${m.key}.${m.grounds}${m.stance === 'indignant' ? '.indignant' : ''}` : '', m.grounds ? `${m.key}.${m.grounds}` : '', m.grounds ? `${verb}.${m.grounds}` : '', m.role ? `${m.key}.${m.role}` : '', m.key, verb].filter(Boolean);
  const slots = m.slots ?? {};
  // a line may be used only if everything it names is known: a slot the decision could not fill from the speaker's perception
  // (empty or absent) rules the line out, so he never says a particular he has no basis for
  const usable = (l: string) => [...l.matchAll(/\{(\w+)\}/g)].every(([, k]) => !!slots[k]);
  const level = (k: string): RenderInfo['level'] => !k ? 'missing' : k === m.key && !m.grounds ? (k.includes('.') ? 'specific' : 'verb') : k.startsWith(m.key + '.') ? 'specific' : k === m.key ? 'kind' : k === verb ? 'verb' : 'reason';
  for (const k of keys) {
    const entry = B[k] ?? N[k];
    if (!entry) continue;
    // (a man's own manner first: the default lines are for men without one of their own for this)
    const own = ([] as string[]).concat(entry[arch] ?? []).filter(usable), def = ([] as string[]).concat(entry._ ?? []).filter(usable);
    const lines = own.length ? [...own, ...def] : def;
    if (!lines.length) continue;
    const n = own.length || lines.length;
    const start = hash(speakerId + '|' + keys[0] + '|' + salt) % n;
    for (let i = 0; i < lines.length; i++) {
      const l = fill(lines[(start + i) % lines.length], slots);
      if (!spoken.has(l)) { spoken.add(l); lastRender.info = { line: l, key: k, level: level(k), own: own.length > 0, template: lines[(start + i) % lines.length] }; return l; }
    }
    lastRender.info = { line: fill(lines[start], slots), key: k, level: level(k), own: own.length > 0, template: lines[start] };
    return lastRender.info.line;
  }
  lastRender.info = { line: `[missing bank: ${keys[0]}]`, key: keys[0], level: 'missing', own: false };
  return lastRender.info.line;
}
// Particulars no line may carry in its own words (Gate 2a): the kind of a business, a weekday, how long, where a man stood, a
// piece of evidence, a name. Each must come through a slot filled from the speaker's perception, or not be said.
export const PARTICULARS = /\b(bakery|bread|loaf|cannoli|oven|window|glass|grocery|deli|monday|tuesday|wednesday|thursday|friday|saturday|sunday|fridays|for years|a long time|twenty years|across the street|on the first|first of the month|lou|nate|gino|rizzo|ferrara|frank|tommy)\b/i;
// The words of every bank line with its slots taken out: what a speaker would say whatever the world (for the particulars scan).
export function bankText(): { key: string; line: string }[] {
  const out: { key: string; line: string }[] = [];
  for (const [key, e] of Object.entries({ ...B, ...N })) for (const ls of Object.values(e)) for (const l of ([] as string[]).concat(ls ?? [])) out.push({ key, line: l.replace(/\{\w+\}/g, '') });
  return out;
}
