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
  // (greetings that remember the last time: a long absence, an evening out, a refusal he gave)
  'greet.since.long': { _: ['“Look who it is. It’s been a while.”', '“Where’ve you been keeping yourself?”', 'He looks up. “I was starting to think you’d forgotten me.”'], cold: ['He looks up. “It’s been a while.”'], jovial: ['“Ha! I thought you were dead. Sit down.”'] },
  'greet.since.evening': { _: ['“Good night, the other night.”', '“I’m still feeling the other night.”', 'He grins. “You recovered?”'], cold: ['He nods. “The other night was all right.”'], jovial: ['“My head still hurts from the other night. Sit down.”'] },
  // Confront, from the conversation layer's own records: his word to the player, and something the player knows he did
  'react.promise.again': { _: ['“You said that before.”', '“I’ve heard that one.” He doesn’t say no. He doesn’t say thank you either.', '“We’ll see.”'], proud: ['“Words. I had words from you last time.”'], frightened: ['“Please. This time, please.”'] },
  'react.putOff': { _: ['He nods slowly. “Another time, then.”', '“Sure. Another time.” He doesn’t hide that he minds.'], proud: ['“I see.”'], frightened: ['“Oh. All right.”'], hothead: ['“Fine. Forget I asked.”'] },
  'raise.over': { _: ['“I took this to {captainFirst} and he wouldn’t touch it. {againstFirst} is still leaning on {forFirst}.”', '“{captainFirst} won’t take it up. I’m bringing it to you: {againstFirst} and {forFirst}.”'] },
  // where the player stands (conv/visit.ts doAdvance: the family's actual road, path.ts), said against what was said last time
  'advance.notMe': { _: ['“I’m hardly the man to ask. I don’t decide that.”'], jovial: ['“Me? Ask somebody who sits at the table.”'] },
  'advance.top': { _: ['“There’s only one chair above you. Think carefully about what you’re asking.”'] },
  'advance.open': { _: ['“You’re not there. Right now people call you {standing}.”', '“Not yet. People call you {standing}, from what I hear.”'], jovial: ['“Ambitious! Good. Right now people call you {standing}.”'], proud: ['“So does every man here. Right now I’d call you {standing}.”'] },
  'advance.same': { _: ['“Same as when you asked me {ago}. Nothing’s moved.”', '“You asked me {ago}. The answer hasn’t changed.”'], cold: ['“{ago}, you asked. Same answer.”'] },
  'advance.better': { _: ['“You’ve come on since {ago}: {what}, for one.”', '“Better than {ago}. I’ve noticed {what}.”'] },
  'advance.worse': { _: ['“You’ve gone backwards since {ago}: {what}.”', '“Worse than {ago}, not better: {what}.”'], cold: ['“You’ve slipped since {ago}. {what}.”'] },
  'advance.ready': { _: ['“You’ve done what was asked. It’s with the people above me now. Be patient, and be seen.”'] },
  'advance.noSeat': { _: ['“You’re ready. There’s no chair. Somebody has to die, retire or go away first. Be ready when it happens.”'] },
  // (what he still needs to see, said as a man says it: how far off, never the family's own tally)
  'advance.gap.earn': { _: ['“The money isn’t there yet. {how} Nobody puts a name forward for a man short of it.”'] },
  'advance.gap.deeds': { _: ['“I need to see more work done. {how} Take what you’re given and finish it.”'] },
  'advance.gap.kills': { _: ['“There’s been no hard work from you. When the family has some, ask for it.”'] },
  'advance.gap.name': { _: ['“People don’t speak of you yet. You’re {standing}. That comes from what you do, and who sees it.”'] },
  'advance.gap.sponsor': { _: ['“You need made men who’ll stand up for you. {how}”', '“Who would speak for you? {how} That’s the part that matters.”'] },
  'advance.gap.trial': { _: ['“Once the rest is done, they’ll set you something to prove.”'] },
  'advance.gap.trialOpen': { _: ['“They’ve put something to you. Do it, and do it well.”'] },
  // work he gave the player, come to an end since they last met (jobs.ts)
  'job.ack.done': { _: ['“Well? {job}. How did it go?”', '“I hear {job} got done. Tell me about it.”'] },
  'job.ack.thanks': { _: ['“{job}. Good work.”', '“You did right by me with {job}.”'], cold: ['“{job}. Fine.”'] },
  'job.ack.failed': { _: ['“{job}. I heard how that went.”', '“About {job}. That was a mess.”'], hothead: ['“{job}? What happened there?”'] },
  'job.ack.moot': { _: ['“{job}. Forget it, it sorted itself out.”', '“That business, {job}. It doesn’t need doing any more.”'] },
  'job.ack.declined': { _: ['“You turned down {job}. I gave it to someone else.”'], proud: ['“You said no to {job}. I remember.”'] },
  'job.ack.ignored': { _: ['“I put work your way. You never came.”', '“I had something for you. You didn’t want it, I suppose.”'], proud: ['“I don’t offer twice.”'] },
  'report.job': { _: ['“It’s done. Here’s how it went.”'] },
  // the same question, the same answer, nothing changed: he says so
  'again.same': { _: ['“Same as I told you {ago}.”', '“Nothing’s changed since {ago}.”', 'He gives you the look of a man who has answered this before.'] },
  // what the player says, pressing an accusation or holding a man to his word (by who the man is to him)
  'accuse.saw': { _: ['“I didn’t hear it from anybody. I know.”', '“Don’t. I know it was you.”'] },
  'accuse.heard': { _: ['“More than one man has told me. I believe them.”', '“I heard it from someone who has no reason to lie.”'] },
  'accuse.press.under': { _: ['“You answer to me. Try that again.”', '“Think about who you’re talking to.”'] },
  'accuse.press.peer': { _: ['“Think hard about what you say next.”', '“I’d be careful, if I were you.”'] },
  'accuse.press.over': { _: ['“With respect, I know what I know.”', '“I’m not saying it lightly. I know it was you.”'] },
  'accuse.amends': { _: ['“Make it right, and we’ll say no more about it.”'] },
  'accuse.warn': { _: ['“It doesn’t happen again.”', '“Once. That’s all you get.”'] },
  'accuse.warn.up': { _: ['“I’d ask you to leave my people alone.”'] },
  'accuse.back': { _: ['“Forget I said anything.”'] },
  'accuse.accept': { _: ['“All right. I’ll take your word.”'] },
  'accuse.leave': { _: ['“That’s all I wanted to hear.”'] },
  'accuse.settle': { _: ['“Then we’ll settle this another way.”'] },
  'accused.amends': { _: ['“I owe you for that. I won’t forget it.”', 'He nods slowly. “Fair. I’ll make it right.”'], proud: ['“Fine. I’ll square it.”'] },
  'accused.warned': { _: ['“Understood.”', 'He holds your eye, then nods.'], hothead: ['“You don’t need to tell me twice.”'] },
  'accused.warned.up': { _: ['He considers you. “I’ll think about it.”', '“I’ll bear it in mind.”'] },
  'accused.backed': { _: ['“That’s what I thought.”', 'He lets you go without another word.'] },
  'hold.word': { _: ['“I’m holding you to it.”', '“See that you do. This week.”'] },
  'hold.word.up': { _: ['“I’d take it as a kindness if you saw to it.”'] },
  'release.word': { _: ['“Forget it. It’s done.”'] },
  'react.held': { _: ['“This week. You have my word.”', '“All right. I’ll see to it.”'], proud: ['“I said I would.”'] },
  'react.held.up': { _: ['“I heard you the first time.”', 'He gives you a long look. “I’ll get to it.”'] },
  'confront.hisWord': { _: ['“You told me you’d speak to {targetFirst}. Did you?”', '“You gave me your word on {targetFirst}. What happened?”'] },
  'confront.hisWord.plain': { _: ['“You gave me your word. What happened?”'] },
  'answer.word.done': { _: ['“I did. I spoke to {targetFirst}. It’s in his hands now.”', '“It’s done. I saw {targetFirst} myself.”'], proud: ['“I said I would, and I did.”'] },
  'answer.word.notYet': { _: ['“I haven’t got to it yet. I will.”', '“Not yet. It’s coming.”'], proud: ['“I’ll get to it when I get to it.”'], frightened: ['“I— not yet. Soon.”'] },
  'answer.word.notDone': { _: ['“I didn’t get to it. I should have told you.”', '“No. I let it slide. That’s on me.”'], proud: ['“Things came up. It happens.”'], hothead: ['“I had other things to do. You want to make something of it?”'] },
  'accuse.act': { _: ['“{shop}. I know that was you.”', '“I know what you did at {shop}.”'] },
  'accuse.act.me': { _: ['“I know what you did. I saw it.”', '“You know what I’m going to say. I know it was you.”'] },
  'accuse.act.man': { _: ['“{victimFirst}. I know that was you.”', '“I know what you did to {victimFirst}.”'] },
  'accused.admit': { _: ['He doesn’t look at you. “All right. It was me. It was business.”', '“So you know. Fine. It was me.”'], frightened: ['“I— it wasn’t meant to come back on you. I swear.”'], proud: ['“It was me. I don’t hide what I do.”'] },
  'accused.deny': { _: ['“Me? Somebody’s been telling you stories.”', '“I don’t know what you’re talking about.”'], schemer: ['“Who told you that? Think about why they would.”'], cold: ['“No.”'] },
  'accused.defy': { _: ['“And if it was? What are you going to do about it?”', '“Say I did. Then what?”'], hothead: ['“Yeah, it was me. You want to take it outside?”'] },
  'greet.since.overhead': { _: ['“I hear you went to {aboveFirst}.” He lets it sit there.', '“{aboveFirst} tells me you came to see him. About the thing I said no to.”'], hothead: ['“You went to {aboveFirst}? Over my head?”'], cold: ['He doesn’t get up. “{aboveFirst} mentioned you.”'], jovial: ['“My friend went to see {aboveFirst}.” The smile is thin.'] },
  'greet.since.slighted': { _: ['He’s cooler than he was. He hasn’t forgotten the last time.', '“You again.” He doesn’t get up.', 'He nods, and waits. The last time is still in the room.'], hothead: ['“Come to say it again?”'], jovial: ['The smile is there, but it doesn’t reach his eyes.'], frightened: ['He watches you the way he’d watch a dog that bit him once.'] },
  'greet.since.confided': { _: ['“About the other night. What I said stays between us, right?”', 'He nods to you like a man who has said more than he meant to, and doesn’t mind.', '“Sit. I’ve been thinking about what we talked about.”'], cold: ['He gives you a look that says the other night is not to be mentioned.'], jovial: ['“My confessor! Sit down.”'] },
  'greet.since.refused': { _: ['He looks up, a little guarded. “If this is about the other thing…”', '“You again.” He doesn’t say it unkindly.'], proud: ['“I gave you my answer.”'], cold: ['He waits for you to speak first.'] },
  'greet.acquaintance': { _: ['He nods you to a chair.', '“Sit down.”'], jovial: ['“There he is! Sit, sit.”'], cold: ['He nods. Nothing more.'], proud: ['“You’re here.”'] },
  'greet.stranger': { _: ['He looks you over. “Do I know you?”'], jovial: ['“Friend. What brings you?”'], cold: ['“Yeah?”'] },
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
  'spend.time.morning': { _: ['“Let me buy you a coffee.”'] },
  'spend.time.afternoon': { _: ['“Let me buy you a drink.”'] },
  'spend.time.evening': { _: ['“Let me buy you a drink. Make an evening of it.”', '“Let me buy you a drink.”'] },
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

  // (each owner names his figure as the man he is: a careful man asks what he gets, a proud one makes it sound like his idea, a
  // frightened one can hardly say it)
  'counter.protection': {
    _: ['“{amt} I could do, if it means the street stays quiet. What do I get for it?”', '“{amt}. More than that and I’m working for you.”'],
    bitter: ['“{amt}. That’s all there is, and what do I get for it?”'],
    frightened: ['“I— {amt}? Could it be {amt}? That’s what I can manage. I swear it is.”'],
    proud: ['“{amt}. And the street stays quiet, or we talk again.”'],
    hothead: ['“{amt}, and that’s generous. Take it or don’t.”'],
    jovial: ['“You’re a reasonable man, I can see it. {amt}, and we both sleep at night.”'],
    schemer: ['“Let’s say {amt}, and you remember I didn’t make you work for it.”'],
    cold: ['“{amt}.”'],
    earnest: ['“{amt} is what the place can carry. I’m being straight with you.”'],
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
  // (a loan negotiation: each argument gets its own answer; the last, when nothing is left to argue, closes it)
  'refuse.loan.cannotSpare.terms': { _: ['“It isn’t the terms. I haven’t got it, that’s all.”', '“Whatever you offer, it isn’t there to lend.”'], proud: ['“Terms don’t come into it. It isn’t there.”'] },
  'refuse.loan.notClose': { _: ['“We know each other to nod to. That isn’t lending money.”', '“I know your face. I don’t know you well enough for that.”'], jovial: ['“We’ve had a drink or two. That’s not the same thing as five hundred dollars, friend.”'] },
  'refuse.loan.rateNotEnough': { _: ['“It isn’t the vig. It’s whether I ever see the money again.”', '“A higher rate on money I never get back is nothing.”'], cold: ['“The rate isn’t the problem.”'], schemer: ['“Eight percent of nothing is nothing.”'] },
  'refuse.loan.promiseNotEnough': { _: ['“Your word. I don’t know yet what your word is worth.”', '“A promise is a promise. It isn’t collateral.”'], cold: ['“Everyone gives me their word.”'], jovial: ['“The end of the month, he says. I’ve heard that one before, friend.”'] },
  'refuse.loan.promiseBroken': { _: ['“Your word? I’ve heard what your word is worth.”', '“You gave a man your word not long ago. Ask him how that went.”'] },
  'refuse.loan.wordNotEnough.last': { _: ['“You’ve made your case. I heard all of it. It’s still no.”'], cold: ['“No. That’s all of it.”'] },
  'refuse.loan.rateNotEnough.last': { _: ['“You’ve put everything on the table. I still can’t.”', '“I’ve heard you out. The answer is no.”'], jovial: ['“You’ve tried everything but flowers, friend. Still no.”'] },
  'refuse.loan.promiseNotEnough.last': { _: ['“You’ve made your case. Come back when I know you better.”', '“I’ve heard all of it. Not this time.”'] },
  'refuse.loan.promiseBroken.last': { _: ['“I’ve heard you out. Not with your record.”'] },
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
  // (asked what is new by the man leaning on him: the trouble on his mind is the man asking, and he says so to his face)
  'news.yourDemand': { _: ['“What’s new? You are. I told you, I’m not paying.”', '“You know what’s on my mind. You’re looking at it.”', '“Same as last time you were here. The answer’s still no.”'], hothead: ['“You want to know what’s new? Nothing. Same answer. Get used to it.”'], proud: ['“You know very well what’s on my mind. I gave you my answer.”'], jovial: ['He laughs without much in it. “What’s new? You, coming round about the money.”'], cold: ['“You are what’s new. And no.”'] },
  'news.yourDemand.afraid': { _: ['He doesn’t meet your eye. “I’ve been worrying about what you said. About the money.”', '“I haven’t slept much. Since you came about the money.”'], frightened: ['“I— I’ve been thinking about what you asked. I can’t, I really can’t.”'] },
  'seek.help': { _: ['“{againstFirst}’s people were in {lastSeen}. I won’t pay him. Can you do anything?”', '“{againstFirst} wants money off me. I won’t pay him. Can you do anything?”'] },
  'promise.action': { _: ['“I’ll talk to {captainFirst} about it.”', '“I’ll speak to my captain about it.”'] },
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
  // ---------------------------------------------------------------- Gate 3: the visit (the vocabulary of its acts)
  'greet.friend': { _: ['“{selfFirst}. Sit down, sit down.”', 'He’s glad to see you, and doesn’t hide it.'], cold: ['He nods you over. For him, that’s warm.'], jovial: ['“There he is! Come here.”'], proud: ['“Good. You’re here.”'], frightened: ['He looks relieved to see a friendly face.'] },
  'greet.cold': { _: ['He doesn’t get up.', '“What is it?”'], jovial: ['The smile doesn’t quite reach his eyes.'], hothead: ['“What do you want?”'] },
  'greet.hostile': { _: ['He looks at you a long moment before he says anything. “You’ve got a nerve.”', '“You. What do you want?”'], frightened: ['He goes still when he sees you.'] },
  'greet.again': { _: ['“Back already?”', '“Something else?”'], jovial: ['“Twice in a day! People will talk.”'], cold: ['He waits for you to say it.'] },
  'ask.happened': { _: ['“What happened?”'] },
  'refuse.help': { _: ['“I can’t get involved in this.”'] },
  'react.help.refused': { _: ['“Right. Of course.” He doesn’t look at you.'], proud: ['“I shouldn’t have asked.”'], frightened: ['“Then what do I do?” He doesn’t expect an answer.'], hothead: ['“Then what good are you?”'] },
  'tell.happened': { _: ['“{againstFirst}’s people {did} {lastSeen}.”', '“{againstFirst}’s people {did}.”'], frightened: ['“They {did}. {againstFirst}’s people. {lastSeen}.”'] },
  'report.raised': { _: ['“I took it to {captainFirst}.”'] },
  'report.notYet': { _: ['“Not yet. Give me a few days.”'] },
  'report.cannot': { _: ['“I couldn’t get anywhere with it. I’m sorry.”'] },
  // (a man told "a few days" before remembers it: the second time is not the first, and a third is an answer of its own)
  'followup.pending.again': { _: ['“You said a few days. That was {ago}.”', '“Last time it was a few days. Well?”'], frightened: ['“You said a few days. They haven’t stopped.”'], proud: ['“You told me {ago} it was in hand.”'] },
  'followup.pending.again2': { _: ['“I’ve asked you before. More than once.”', '“Every time I ask, it’s a few more days.”'], proud: ['“I won’t ask again after this.”'], frightened: ['“Please. Just tell me straight.”'] },
  'react.report.notYet.again': { _: ['“Again.” He doesn’t hide that he minds.', '“A few more days.” He says it flatly.'], frightened: ['“Again? All right. All right.”'], proud: ['“That’s what you said last time.”'] },
  'react.report.notYet.last': { _: ['“Then I’ll stop asking you.”', '“Then don’t tell me a few days.”'], frightened: ['“I can’t keep waiting. I’m sorry.”'], proud: ['“I’ve stopped counting on it.”'] },
  'react.report.notYet': { _: ['“A few days.” He nods, but he’s counting.', '“All right. A few days.”'], frightened: ['“A few days. All right. All right.”'], proud: ['“I’ve waited this long.”'] },
  'confront.lie': { _: ['“You told me you’d taken it to {captainFirst}. He says you never went near him.”'], hothead: ['“You lied to me. {captainFirst} never heard a word from you.”'] },
  'confront.sorry': { _: ['“You’re right. I should have told you.”'] },
  'apologise.broken': { _: ['“I know. It didn’t go the way I said it would.”'] },
  'confront.insist': { _: ['“He’s wrong. I spoke to {captainFirst}.”'] },
  'react.sorry': { _: ['“At least you said it.” It doesn’t make it right.', 'He shrugs. It will take more than that.'], proud: ['“Next time, don’t promise.”'] },
  'react.insist.believed': { _: ['He studies you. “All right. Maybe I heard wrong.”'] },
  'react.insist.doubted': { _: ['“Sure you did.” He doesn’t believe you.', 'He says nothing. He doesn’t believe you.'] },
  'report.refusedByChair': { _: ['“I took it to {theirCaptainFirst}. He won’t rein {againstFirst} in.”'] },
  'report.raisedIt': { _: ['“I took it to {theirCaptainFirst}, like I said. It’s with him now.”'] },
  'report.couldNot': { _: ['“About {forFirst}. I couldn’t do it. I’m telling you straight.”'] },
  'ask.news': { _: ['“What’s new?”'] },
  'thank.tried': { _: ['“Thanks for trying.”'] },
  'credit.notMe': { _: ['“That wasn’t me. But I’m glad they’ve stopped.”'] },
  'credit.claim': { _: ['“I had a word.”'] },
  'react.credit.notMe': { _: ['“Huh.” He thinks about that. “Well. Somebody did.”'], frightened: ['“Then why did they stop?” He doesn’t like not knowing.'] },
  'react.credit.claimed': { _: ['“I won’t forget it.”'], jovial: ['“I owe you a dinner. A good one.”'], cold: ['He nods. “I owe you.”'] },
  'seek.help.again.unheard': { _: ['“{againstFirst}’s back. I never heard what came of it from you. Can you do anything?”'], proud: ['“{againstFirst} again. Last time I heard nothing from you.”'] },
  'seek.help.again.never': { _: ['“{againstFirst}’s back. You never did go to {captainFirst}, did you?”'], frightened: ['“He’s back. I know you didn’t go to {captainFirst}. Please.”'] },
  'seek.help.again': { _: ['“{againstFirst}’s back. I know you tried before. Is there anything else you can do?”'], proud: ['“{againstFirst} again. I hate to ask twice.”'], frightened: ['“He’s back. {againstFirst}. I didn’t know who else to come to.”'] },
  'thank.done': { _: ['“Thanks. I owe you.”'] },
  'react.thanks': { _: ['He waves it off.', '“Don’t mention it.”'] },
  'pass.done': { _: ['“{captainFirst} took it up. {againstFirst}’s been told to leave you alone.”'] },
  'pass.refused': { _: ['“I took it to {captainFirst}. Their side won’t rein {againstFirst} in. I’m sorry.”'] },
  'react.pass.done': { _: ['He lets out a long breath. “Thank God.”'], cold: ['He nods. “Good.”'] },
  'react.pass.refused': { _: ['He takes it in. “So I’m on my own.”'], frightened: ['“Then what do I do?”'], proud: ['“Then I’ll deal with it.”'] },
  'react.letgo': { _: ['He nods. That’s the end of it.', '“Good.”'] },
  'ask.answersTo': { _: ['“Who does {manFirst} answer to?”'] },
  'answer.answersTo': { _: ['“{manFirst}? He’s with {chairName}.”'], cold: ['“{chairName}.”'] },
  'answer.knewTopic': { _: ['“I heard.”', '“I know. Everybody knows.”'] },
  'news.vandalism': { _: ['“Somebody smashed up {shop} {when}.”', '“{whoFirst}’s people smashed up {shop} {when}.”'] },
  'news.robbery': { _: ['“{shop} got robbed {when}.”'] },
  'news.beating': { _: ['“{victimFirst} took a beating {when}.”', '“{whoFirst} gave {victimFirst} a beating {when}.”'] },
  'news.arrest': { _: ['“The cops picked up {victimFirst} {when}.”', '“They pulled {whoFirst} in {when}.”'] },
  'news.murder': { _: ['“You heard about {victimFirst}? {when}.”'] },
  'news.protection_started': { _: ['“{shop} is paying {whoFirst} now.”'] },
  'news.promotion': { _: ['“{whoFirst} got moved up.”'] },
  'news.business_failed': { _: ['“{shop} closed its doors.”'] },
  'news.notForYou': { _: ['“Nothing.” He doesn’t seem inclined to say more.', '“Same as ever.” He leaves it there.'], jovial: ['“Me? Nothing ever happens to me.”'] },
  'news.slow': { _: ['“Business is slow. That’s my news.”'], bitter: ['“Same as always. Nobody’s buying.”'] },
  'news.money': { _: ['“Money’s tight. Same as everybody.”'] },
  'news.quiet': { _: ['“Quiet. Nothing worth telling.”', '“Not much.”'], jovial: ['“Quiet week, thank God.”'], cold: ['“Nothing.”'] },
  // ---------------------------------------------------------------- Gate 2a additions: the vocabulary of new acts only
  'tell.trouble': { _: ['“{againstFirst}’s people smashed up {shop}. That’s our ground.”'] },
  'tell.trouble.protection_refused': { _: ['“{againstFirst}’s been leaning on {victimFirst} for money, at {shop}. That’s our ground.”'] },
  'tell.trouble.beating': { _: ['“{againstFirst}’s people beat {victimFirst}. On our ground.”'] },
  'tell.trouble.threat': { _: ['“{againstFirst}’s people have been leaning on {shop}. That’s our ground.”'] },
  'tell.trouble.robbery': { _: ['“{againstFirst}’s people robbed {shop}. That’s our ground.”'] },
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
