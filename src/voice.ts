// Voice. Everything a character says is written from his own mouth: first person, in his own temperament,
// about the thing that actually matters to him. Nobody explains himself by repeating the facts.
import type { Character, Fact, Id, World } from './types';

export type Arch = 'proud' | 'bitter' | 'schemer' | 'earnest' | 'hothead' | 'cold' | 'jovial' | 'frightened';

export function arch(c: Character): Arch {
  const t = c.traits;
  if (t.courage < 0.4 || (t.caution > 0.72 && t.violence < 0.3)) return 'frightened';
  if (t.violence > 0.72 && t.caution < 0.5) return 'hothead';
  if (t.ambition > 0.72 && t.caution > 0.45) return 'schemer';
  if (t.violence > 0.6 && t.sociability < 0.45) return 'cold';
  if (t.sociability > 0.72) return 'jovial';
  if (t.greed > 0.66 && t.sociability < 0.55) return 'bitter';
  if (t.ambition > 0.55 || ['soldier', 'capo', 'underboss', 'boss'].includes(c.rank)) return 'proud';
  return 'earnest';
}

export const ARCH_WORD: Record<Arch, string> = {
  proud: 'proud', bitter: 'bitter', schemer: 'a schemer', earnest: 'earnest', hothead: 'a hothead', cold: 'cold', jovial: 'easy company', frightened: 'nervous',
};

// A stable pseudo-random choice, so the same man tells the same story about the same event every time.
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const pick = <T,>(xs: T[], seed: string): T => xs[hash(seed) % xs.length];

// ------------------------------------------------------------ perspective

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Rewrite narration as the mouth of `who` would say it: "Lenny beat up Joey" told by Joey is "Lenny beat me up".
export function fp(text: string, who: { name: string }): string {
  const n = esc(who.name);
  return text
    .replace(new RegExp(`^${n}(?= )`), 'I')
    .replace(new RegExp(`${n}'s`, 'g'), 'my')
    .replace(new RegExp(`\\b${n}\\b`, 'g'), 'me')
    .replace(/\bme (was|had|has|got|took|made|came|went|did|said|knew|owed|lent|paid)\b/g, 'I $1')
    .replace(/^me\b/, 'I');
}

export function told(w: World, f: Fact, teller: Character, knowsActor = true): string {
  const actor = f.actor ? w.chars[f.actor] : undefined;
  const victim = f.victim ? w.chars[f.victim] : undefined;
  const biz = f.business ? w.biz[f.business] : undefined;
  const A = !actor || !knowsActor ? 'somebody' : actor.id === teller.id ? 'I' : actor.name;
  const V = !victim ? 'someone' : victim.id === teller.id ? 'me' : victim.name;
  const mine = (b?: { name: string }) => (b ? (victim?.id === teller.id ? b.name.replace(/^\S+'s /, 'my ') : b.name) : 'the place');
  switch (f.kind) {
    case 'beating':
      return `${A} beat up ${V}`;
    case 'vandalism':
      return `${A} wrecked ${mine(biz)}`;
    case 'robbery':
      return `${A} robbed ${mine(biz)}`;
    case 'poach':
      return `${A} muscled in on ${mine(biz)}`;
    case 'murder':
      return `${A} had ${V} killed`;
    case 'scam':
      return `${A} took ${V} for a fool`;
    case 'burglary':
      return `${A} broke into ${mine(biz)}`;
    case 'theft':
      return `${A} took what was ${V === 'me' ? 'mine' : V + "'s"}`;
    default:
      return fp(f.text, teller);
  }
}

// ----------------------------------------------------------------- places

const DISTRICT_PLACE: Record<string, string[]> = {
  'Little Italy': ['outside the bakery on Mulberry', 'by the church steps on Mott', 'on Grand, in front of the feast stalls'],
  Bensonhurst: ['outside the social club on 18th', 'on 86th under the El', 'behind the butcher on Bay Parkway'],
  'Red Hook': ['down by the piers', 'in the lot behind the warehouses', 'on Van Brunt after the late shift'],
  "Hell's Kitchen": ['on Ninth Avenue', 'outside the bar on 46th', 'in the stairwell of my own building'],
  'The Bronx': ['on Arthur Avenue', 'outside the pork store on Belmont', 'under the elevated on Webster'],
  'Staten Island': ['by the ferry terminal', 'on Victory Boulevard', 'out past the boatyards'],
  Astoria: ['under the elevated on Steinway', 'outside the Greek bakery on 31st', 'on Ditmars after dark'],
};
const where = (w: World, f: Fact, seed: string) => (f.business && w.biz[f.business] ? 'at ' + w.biz[f.business].name : pick(DISTRICT_PLACE[f.district] ?? ['on the street'], seed));
export const ago = (w: World, f: Fact) => {
  const d = Math.max(0, Math.floor((w.now - f.t) / 1440));
  return d < 1 ? 'this morning' : d < 2 ? 'yesterday' : d < 7 ? `${d} days ago` : d < 14 ? 'last week' : `${Math.round(d / 7)} weeks ago`;
};

// What happened, in the words of the man it happened to.
export function injury(w: World, f: Fact, teller: Character, knowsActor: boolean): string {
  const seed = f.id + teller.id;
  const actor = f.actor ? w.chars[f.actor] : undefined;
  const him = knowsActor && actor ? actor.name : 'whoever it was';
  const at = where(w, f, seed);
  switch (f.kind) {
    case 'beating':
      return pick([
        `${knowsActor ? him : 'Two men'} caught me ${at}. I never saw it coming, and I was on the ground before I knew what it was.`,
        `It happened ${at}, ${ago(w, f)}. ${knowsActor ? him + ' did it' : 'I didn’t get a good look'}, and I didn’t get a punch in.`,
        `I came out ${at} and there ${knowsActor ? 'he was' : 'they were'}. Then I was looking at the sky. I woke up with somebody's shoe in my ribs.`,
      ], seed);
    case 'vandalism':
      return pick([
        `Somebody took a bat to my place ${ago(w, f)}. Every window. I swept glass for two days.`,
        `I came in ${ago(w, f)} and the place was torn apart. A message, ${knowsActor ? 'from ' + him : 'from somebody who didn’t sign it'}.`,
      ], seed);
    case 'robbery':
      return pick([
        `I got cleaned out ${ago(w, f)}. ${knowsActor ? him : 'Somebody'} walked in like he owned the register.`,
        `They took everything in the till, and a man who takes the till is telling you something about what he thinks of you.`,
      ], seed);
    case 'poach':
      return pick([
        `That was my place, my arrangement, my name on it. ${knowsActor ? him : 'Somebody'} walked in and put his own hand out like I'd never existed.`,
        `I put three years into that place. Then ${knowsActor ? him : 'somebody'} started collecting there, and nobody asked me.`,
      ], seed);
    case 'burglary':
    case 'theft':
      return pick([
        `They went through my things ${ago(w, f)}. It’s not the money. It’s that they stood in my kitchen.`,
        `Somebody was in my place while I was out. They knew where to look, which means someone told them.`,
      ], seed);
    case 'scam':
      return pick([
        `I was sold a story ${ago(w, f)} and I paid for it. It was a good story, I’ll say that.`,
        `A man sat at my table and talked, and by the time he left I was lighter by a fair bit.`,
      ], seed);
    case 'murder':
      return `They killed ${f.victim && w.chars[f.victim] ? w.chars[f.victim].name : 'a friend of mine'}. I’m not asking you to understand. I’m asking you to remember.`;
    default:
      return told(w, f, teller, knowsActor) + '.';
  }
}

// ----------------------------------------------------------------- motives

export type Motive = 'face' | 'fear' | 'money' | 'family' | 'order' | 'ambition' | 'pride' | 'debt';

export interface Why {
  motive: Motive;
  surface: string; // what he says when you ask
  deep: string; // what he says when you press him, if he trusts you enough
  hidden?: boolean; // the surface answer is a cover story
}

// Pick the reason behind a request. It depends on who he is and what he stands to lose, not on what was done to him.
export function whyOf(w: World, speaker: Character, target: Character | undefined, f: Fact | undefined, p: Character): Why {
  const a = arch(speaker);
  const seed = speaker.id + (target?.id ?? '') + (f?.id ?? '');
  const hurtBiz = f?.business ? w.biz[f.business] : undefined;
  const t = target?.name ?? 'him';
  const inFamily = !!speaker.familyId;
  const protectedBy = hurtBiz?.protection ? w.chars[hurtBiz.protection.collectorId] : undefined;
  const district = f?.district ?? speaker.district;

  const FACE = [
    `It’s not the bruises. It’s that he did it where people could watch. ${district} has a long memory, and right now it remembers me on the pavement.`,
    `I walk past that corner now and people look at my shoes. A man can’t work like that. A man can’t buy a loaf of bread like that.`,
    `Everybody knows. That’s the thing nobody tells you: the beating ends in an afternoon, the knowing doesn’t.`,
  ];
  const FEAR = [
    `Because he’ll do it again. A man like ${t} reads silence as permission. I have a wife who watches the door now, and I don’t like what that does to her.`,
    `I don’t sleep. I hear the stairs. If this goes unanswered I’ll be waiting for the next one, and I would sooner be done waiting.`,
    `He knows where I live. That’s all of it. It’s not anger, it’s arithmetic.`,
  ];
  const MONEY = [
    `Three weeks of trade I won’t see again, a doctor I can’t afford, and a landlord asking questions. Somebody should pay for that, and ${t} isn’t going to open his wallet unless he’s given a reason.`,
    `I’m not a violent man. I’m a man who’s out money. There’s a difference, and I would like the difference to be respected.`,
    `It cost me. Real money, the kind with a number on it. I want the number back, and I want him to feel the weight of it.`,
  ];
  const FAMILY = [
    `My kid asked who did this to me. I had no answer I could say out loud in my own house.`,
    `My brother-in-law won’t look at me. He says I let it happen. I need that to stop being true.`,
    `It’s my mother. She heard it from a neighbour before she heard it from me. You don’t forgive a thing like that.`,
  ];
  const ORDER = [
    `He did it under the family's name. That’s what I can’t get past. You don’t do that to a man who answers to ${w.chars[speaker.bossId ?? '']?.name ?? 'our table'}. It’s not me he disrespected.`,
    `There are rules, and he knows them. A man who ignores the rules because he thinks nobody will check has to be checked.`,
    `If it goes unanswered, the next man thinks the family is soft. I’m not asking for me. I’m asking for the door we all use.`,
  ];
  const PRIDE = [
    `Because I would do the same for you. And you would want to know that when it counts.`,
    `A man has to answer to something. If he doesn’t answer to this, then what does he answer to?`,
    `Because there’s a way these things are done, and he didn’t do it that way. That’s the whole of my reason.`,
  ];
  const DEBT = [
    `Because he owes me, and he knows he does. The beating was his way of telling me he doesn’t intend to pay.`,
    `It’s about the money, and then it’s about the money again. Nothing else I can say makes it any clearer than that.`,
  ];

  // The cover story and the truth, for men who have both.
  const AMBITION_SURFACE = [PRIDE, ORDER];
  const AMBITION_DEEP = [
    `There’s a chair opening at ${w.chars[speaker.bossId ?? '']?.name ?? 'the table'}'s table, and ${t} is the only man between me and it. I won’t pretend that didn’t cross my mind.`,
    `${t} has the ear of the people I need. While he’s standing in front of me, I’m a man nobody introduces.`,
  ];

  const order = inFamily && (protectedBy || (f && f.victim && w.chars[f.victim]?.familyId === speaker.familyId));
  let motive: Motive = 'face';
  let surface = '';
  let deep = '';
  let hidden = false;
  switch (a) {
    case 'proud':
      motive = order ? 'order' : 'face';
      surface = pick(order ? ORDER : FACE, seed);
      deep = `I’ll tell you what it is. I have been told to my face that I’m the sort of man things get done to. I would like to be somebody else, and this is how.`;
      break;
    case 'bitter':
      motive = 'money';
      surface = pick(MONEY, seed);
      deep = `And the rest is that I have watched men with half my brains get the table, while I get the bill. I’m tired of being the one who pays.`;
      break;
    case 'schemer':
      motive = 'ambition';
      surface = pick(w.rng.chance(0.5) ? PRIDE : ORDER, seed);
      deep = pick(AMBITION_DEEP, seed);
      hidden = true;
      break;
    case 'earnest':
      motive = 'family';
      surface = pick(FAMILY, seed);
      deep = `If you want it plainly: I’m frightened. I don’t want to be. That’s why I came to you instead of doing something stupid.`;
      break;
    case 'hothead':
      motive = 'pride';
      surface = pick(PRIDE, seed);
      deep = `All right. I wanted to go there myself with a pipe. My own captain told me if I did, he would have me put down. So I’m doing this properly. Through you.`;
      break;
    case 'cold':
      motive = f ? 'debt' : 'money';
      surface = pick(DEBT, seed);
      deep = `It’s a ledger. He took something and the ledger is open. Nothing about it’s personal. Everything about it’s correct.`;
      break;
    case 'jovial':
      motive = 'face';
      surface = pick([
        `Ha. Look at me. A man with my reputation for being good company, and half the neighbourhood saw me carried home. It’s hard to buy a round after that.`,
        ...FACE,
      ], seed);
      deep = `Truth is I laughed at it when I told people. I didn’t laugh when I was alone.`;
      break;
    case 'frightened':
      motive = 'fear';
      surface = pick(FEAR, seed);
      deep = `I’m not brave. I know that. I just can’t be the man waiting by the window any longer. I would rather it was over, one way or the other.`;
      break;
  }
  void AMBITION_SURFACE;
  return { motive, surface, deep, hidden };
}

// The opening line when someone brings you a problem.
export function pitch(w: World, speaker: Character, target: Character, f: Fact | undefined, knowsActor: boolean, pay: number): string {
  const a = arch(speaker);
  const seed = speaker.id + target.id;
  const o = {
    proud: [`I wouldn’t come to you if I had another way. I haven’t asked anyone for anything in a long time.`, `A word, in private. I would take it as a kindness.`],
    bitter: [`You and I both know how this goes. Men like us pay and pay.`, `I won’t waste your time with pleasantries.`],
    schemer: [`I have been thinking about who I trust. You came to mind.`, `Sit down. This is the kind of thing that’s better discussed before it’s a problem.`],
    earnest: [`I didn’t know who else to ask. I hope you don’t mind.`, `Thank you for seeing me. I know you have your own business.`],
    hothead: [`I’ll make this short, because if I make it long I’ll do something I regret.`, `I need somebody to do what I can’t.`],
    cold: [`There’s a matter that needs correcting.`, `I’ll be brief. It’s a business matter, although it won’t look like one.`],
    jovial: [`You’ll laugh. Everyone will laugh, except me.`, `Pour yourself something. This one needs a drink.`],
    frightened: [`Please, keep your voice down.`, `I shouldn’t be talking to you here, but I don’t know where else.`],
  }[a];
  const open = pick(o, seed);
  const story = f ? injury(w, f, speaker, knowsActor) : '';
  const ask = knowsActor
    ? pick([
        `I want ${target.name} to understand what that costs.`,
        `I want ${target.name} handled. I don’t need to know how.`,
        `Someone should speak to ${target.name}. In a way he’ll remember.`,
      ], seed + 'a')
    : pick([
        `I can’t prove it, but I think it was ${target.name}. Look into it.`,
        `I have a name, and it’s ${target.name}. Make up your own mind.`,
      ], seed + 'b');
  const fee = pay > 0 ? ` ${pick([`There is ${money$(pay)} in it for you.`, `I will pay ${money$(pay)}, and I will not haggle.`, `${money$(pay)}, and my thanks.`], seed + 'c')}` : '';
  return `${open} ${story} ${ask}${fee}`.replace(/\s+/g, ' ').trim();
}
const money$ = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

// What a man says when someone he reports to asks "why?" and he is not telling the truth, or only some of it.
export function dodge(a: Arch, seed: string): string {
  return pick({
    proud: [`I don’t explain myself to men who haven’t earned the right to ask.`, `Ask around. Everyone knows.`],
    bitter: [`You’re going to make me say it out loud? Fine. It’s what it is.`, `Believe what you like. You always do.`],
    schemer: [`Let’s say it’s a matter of the family's interest and leave it there.`, `I would tell you, but I would be making you responsible for knowing.`],
    earnest: [`I just know it’s right. I wouldn’t ask otherwise.`, `Please. I wouldn’t lie to you.`],
    hothead: [`What’s to explain? He did it. Do it back.`, `You’re going to stand there and weigh it? Weigh it later.`],
    cold: [`The reasons are mine. The outcome is yours.`, `Understanding isn’t part of what I’m paying for.`],
    jovial: [`Ha, always the questions. Have a drink and trust your friend.`, `It’s a long story and I tell it badly. Trust me on the ending.`],
    frightened: [`I can’t say. Just please, I need this.`, `If I said it out loud, it would be worse.`],
  }[a], seed);
}

// A man's excuse for coming up short, in his own voice. `truth` is whether he is telling it straight.
export function excuse(a: Arch, kind: string, seed: string): string {
  const E: Record<string, Partial<Record<Arch, string[]>> & { any: string[] }> = {
    gambling: {
      any: [`It was a slow week. People aren’t spending.`, `I got hit with a few unexpected costs. You know how it is.`, `A man owed me and didn’t pay. Cascading, you know?`],
      proud: [`I had expenses I won’t discuss.`],
      jovial: [`Ha, the horses had a mind of their own. I’m joking. Mostly.`],
      frightened: [`I had a bad few days. I’ll make it right, I swear on my mother.`],
    },
    debt: {
      any: [`I owe a man, and he came to my door. I paid him first. I had to.`, `There was a note I forgot about. It got to me before you did.`],
      cold: [`I settled an old account. It was due.`],
    },
    family: {
      any: [`My wife isn’t well. The doctor wanted cash.`, `Something at home. I would rather not say. It’s handled.`, `My daughter needed things. I couldn’t say no.`],
      earnest: [`My mother had a fall. I don’t want to make excuses, but I couldn’t leave her.`],
    },
    drink: {
      any: [`I was sick, a bug of some kind. It laid me out for days.`, `I lost track of a couple of days. It won’t happen again.`],
    },
    house: {
      any: [`I’m putting something aside. A house, a place of my own. I should have said.`, `I took a little. It’s all going toward something permanent.`],
      schemer: [`Every man needs a plan for when this ends. I’m just early.`],
    },
    resentment: {
      any: [`It was what it was. Take it up with whoever set the numbers.`, `I did what I could with what I was given.`],
      bitter: [`You want the full number? Ask what I get for my trouble.`],
      hothead: [`I carry this crew, and I get a pat on the back. Maybe I’m done carrying.`],
    },
    woman: {
      any: [`It was a personal thing. A woman. I won’t say more, you understand.`, `I had something to settle. It’s settled now.`],
      jovial: [`Ha. Let’s say it was an expensive weekend and a worthwhile one.`],
    },
  };
  const e = E[kind] ?? E.gambling;
  const pool = [...(e[a] ?? []), ...e.any];
  return pick(pool, seed);
}

// And the truth, when he finally says it.
export function admit(a: Arch, kind: string, seed: string): string {
  const A: Record<string, string[]> = {
    gambling: [`I have been losing. Cards, mostly. I thought I could win it back before you noticed.`, `I’m in deep. I didn’t want you to find out from somebody else.`],
    debt: [`I owe a man who isn’t patient. I have been paying him before you, and I knew it was wrong.`],
    family: [`It’s my family. It’s always my family. I was ashamed to say.`],
    drink: [`I have been drinking. More than I let on. Some mornings I can’t do the work.`],
    house: [`I have been skimming. Not much, not at first. I want out of the neighbourhood and I don’t know any other way to pay for it.`],
    resentment: [`I have been holding back because I feel nobody’s looking out for me. I know how that sounds.`],
    woman: [`There’s somebody. It costs money, and it’s not the kind of somebody you tell people about.`],
  };
  return pick(A[kind] ?? A.gambling, seed);
}

// A boss giving a reason is giving an order with a reason attached, and he may not mean it.
export function bossWhy(w: World, boss: Character, x: Character, subject: 'disloyal' | 'skimming' | 'wrong', claimTrue: boolean, rival: string): Why {
  const a = arch(boss);
  const seed = boss.id + x.id + subject;
  const S: Record<string, string[]> = {
    disloyal: [
      `${x.name} sat at a table with the ${rival} people. A man who eats with them is a man who will talk to them.`,
      `I have it from someone I trust that ${x.name} has been carrying messages to ${rival}. I don’t need more than that.`,
      `Somebody saw ${x.name} where ${x.name} had no reason to be. Men remember where they’re not supposed to be.`,
    ],
    skimming: [
      `The numbers from ${x.name}'s end don’t look like the numbers from his street. A man who lies about money lies about other things.`,
      `${x.name} is living better than his envelope. I can count, and I don’t like what I count.`,
      `I don’t tolerate a man who thinks the family's money is his money. That’s all it is.`,
    ],
    wrong: [`He put his hands on one of ours. It’s not a debate.`, `The family answers when it’s touched. That’s the whole of it.`],
  };
  const surface = pick(S[subject], seed);
  const truth: Record<string, string> = {
    disloyal: `${x.name} was seen by a man who wouldn’t lie to me. I didn’t go looking for it. It found me, and now I have to do something with it.`,
    skimming: `I had it checked twice. The gap is real, and it has been there long enough that he thinks nobody will notice.`,
    wrong: `You do it because I asked. And because a family that doesn’t answer is a family that’s answered by others.`,
  };
  const politics: Record<string, string> = {
    disloyal: `The truth is ${x.name} has been collecting friends, and the friends aren’t mine. I don’t need him to be a traitor. I only need him not to be here.`,
    skimming: `Between us: he’s popular with the men, and popular men become choices. I would sooner it was never a choice.`,
    wrong: truth.wrong,
  };
  const deep = claimTrue ? truth[subject] : politics[subject];
  void a;
  return { motive: claimTrue ? 'order' : 'ambition', surface, deep, hidden: !claimTrue };
}
