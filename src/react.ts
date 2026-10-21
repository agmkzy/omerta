// V90: what a man says when he answers, composed from one resolved turn. A turn is settled first (asks.ts: how he was approached,
// what that did to how he stands, what he decided, why), and only then put into words, so his reaction, his decision and his reason
// can never contradict each other: a man who gives in sounds like a man giving in, a man who refuses sounds like a man refusing,
// and how either sounds is his temperament's (temper.ts) and how he sees you. The point he leaves in hand (his reason, his terms)
// is what the replies offered next are about (exchange.ts).
import { temper, viewOf, type Temper } from './temper';
import type { Character, World } from './types';

export type Approach = 'ask' | 'again' | 'pressure' | 'force' | 'persuade' | 'sweeten' | 'leverage' | 'senior' | 'take';
export type Decision = 'yes' | 'counter' | 'stall' | 'no' | 'help';
export interface Turn {
  ap: Approach; // how he was approached this time
  n: number; // how often it has been tried on him in this matter (1 = the first time)
  decision: Decision;
  again: number; // how often he has given this answer before in this matter
  coerced?: boolean; // a yes given out of fear
  reason?: string; // why, in his words (said the first time he refuses or puts you off)
  terms?: string; // his own terms, in his words (a counter)
  cls?: 'demand' | 'request' | 'offer' | 'claim'; // what was asked of him (exchange.classOf)
  kind?: string; // the kind of matter (asks.ts), where it changes what a refusal sounds like
  above?: boolean; // he outranks the man asking
  claim?: string; // the reason in hand, if any (exchange.ts)
}
type Mood = 'cowed' | 'bitter' | 'moved' | 'keen' | 'agree' | 'grudging' | 'wary' | 'nervous' | 'impatient' | 'flare' | 'defiant' | 'hurt' | 'sorry' | 'cold';

// How he takes it: decided by what he decided, then by who he is.
function moodOf(d: Decision, ap: Approach, tp: Temper, fear: number, affection: number, coerced?: boolean): Mood {
  const hot = tp.volatility + tp.pride > 1.15;
  switch (d) {
    case 'yes': return coerced ? (tp.pride > 0.6 && tp.courage > 0.45 ? 'bitter' : 'cowed') : ap === 'persuade' ? 'moved' : ap === 'sweeten' || ap === 'take' || tp.agreeable > 0.6 ? 'keen' : 'agree';
    case 'counter': return tp.pride > 0.62 && tp.agreeable < 0.5 ? 'grudging' : tp.agreeable > 0.55 ? 'keen' : 'wary';
    case 'stall': return fear > 0.45 || tp.caution > 0.62 ? 'nervous' : hot ? 'impatient' : 'wary';
    default:
      if (hot && tp.courage > 0.45) return 'flare';
      if (tp.courage + tp.pride > 1.2) return 'defiant';
      if (affection > 0.5 && tp.empathy > 0.5) return 'hurt';
      if (tp.caution > 0.55 || fear > 0.45 || tp.empathy > 0.65) return 'sorry';
      return 'cold';
  }
}

// What he says first, by mood and by what was just done to him. '_' is for any approach not named.
type Pool = Partial<Record<Approach | '_', string[]>>;
const OPEN: Record<Mood, Pool> = {
  cowed: { pressure: ['“All right. All right, I hear you.”', '“There’s no need for that. You’ll have it.”', 'His hands aren’t quite steady. “Fine. Fine.”'], force: ['He looks at the damage, and then at you. “Enough. You’ll have it.”'], leverage: ['He goes pale. “Keep your voice down. All right.”'], senior: ['“If he’s behind it… all right.”'], _: ['He swallows. “All right.”'] },
  bitter: { pressure: ['“Fine. Take it. Just remember I didn’t want this.”'], force: ['“You’ve made your point. You’ll get it. I won’t forget how.”'], _: ['“Fine. Remember it was you who made it this way.”'] },
  moved: { _: ['“You make sense. I hate that you make sense. All right.”', '“Put like that… all right.”'] },
  keen: { sweeten: ['“Now that I can live with.”', '“That’s better. All right.”'], take: ['“Good. Then we understand each other.”'], _: ['“All right. We have a deal.”', '“That suits me.”'] },
  agree: { _: ['“All right.”', '“Fine. Agreed.”', 'He thinks it over, then nods.'] },
  wary: { _: ['“I need to think about it.”', '“Not today. Let me think.”'] },
  grudging: { _: [] },
  nervous: { pressure: ['“Please. Just give me a few days.”'], _: ['“I need a little time. Please.”', '“Let me think. I’m not saying no.”'] },
  impatient: { _: ['“You’ll get your answer when I have one.”', '“I said I’d think about it. Let me.”'] },
  flare: { pressure: ['“Who do you think you’re talking to?”', '“Try that again and see what happens.”'], force: ['He’s shaking with it. “You’ll pay for every chair.”'], persuade: ['“Don’t lecture me in my own place.”'], sweeten: ['“You think I can be bought?”'], leverage: ['“You’d use that against me? Get out.”'], _: ['“No. And don’t ask me again.”', '“Get out of here.”'] },
  defiant: { pressure: ['“You think that scares me? I’ve been threatened by better.”', '“I don’t frighten. Ask around.”'], force: ['He doesn’t flinch. “Do what you want. It’s still no.”'], senior: ['“I don’t care whose name you use.”'], _: ['“No.”', '“My answer’s my answer.”'] },
  hurt: { pressure: ['“I thought we were friends.”', '“That’s how it is now? Between us?”'], _: ['“I can’t. And I didn’t think you’d ask me like this.”'] },
  sorry: { pressure: ['“I hear you. I do. But I can’t.”', '“Please. Don’t do this.”', 'He swallows. “I can’t. I just can’t.”'], persuade: ['“I know you mean well.”'], sweeten: ['“It’s kind of you. It’s still too much.”'], _: ['“I’m sorry.”', '“I can’t, I’m sorry.”'] },
  cold: { pressure: ['“I heard you the first time.”', 'He lets it hang. “Is that everything?”', 'He looks at you as if he is learning your face.'], _: ['“No.”', '“Not interested.”'] },
};
// A refusal or a stall given before is said as one given before, in his own way.
const AGAIN: Partial<Record<Mood, string[]>> = {
  flare: ['“What part of no didn’t you hear?”', '“How many times? No.”'],
  defiant: ['“I told you no. I’m not going to keep telling you.”', '“Same answer. It’ll be the same next week.”', '“You heard me the first time.”', '“Ask me a hundred times.”'],
  hurt: ['“Please. Don’t make me say it again.”'],
  sorry: ['“I’m sorry. It’s still no.”', '“I thought about it, I really did. No.”', '“Please. I’ve told you how it is.”', '“I wish the answer was different.”'],
  cold: ['“No.”', '“We’ve been over this.”', 'He doesn’t bother to answer.', '“Still no.”'],
  nervous: ['“A few more days. Please.”', '“I haven’t decided. I’m not trying to be difficult.”'],
  impatient: ['“I said I need time. I still need time.”'],
  wary: ['“I’m still thinking.”'],
};
const pick = (xs: string[], k: number) => xs[((k % xs.length) + xs.length) % xs.length];
const unquote = (l: string) => l.replace(/^“/, '').replace(/”$/, '');
// a man's words run together when they are one breath: "No." and "Where would I get that money?" are one line, not two
const join = (a: string, b: string) => (/^“.*”$/.test(a) && /^“/.test(b) ? `“${unquote(a)} ${unquote(b)}”` : `${a} ${b}`);

// Where who is asking whom, or what was asked, changes how a refusal is said: a man above you does not throw you out of his
// own conversation, he tells you no; an offer is declined, not resisted; a better price for something that was never about the
// price is answered as such.
function special(turn: Turn, m: Mood): string[] | undefined {
  // paying back what he owes is not a bargain struck: it is a debt honoured, gladly or not
  if (turn.decision === 'yes' && turn.cls === 'claim') return m === 'bitter' || m === 'cowed' ? ['“All right. Now we’re even.”', 'He pays, and doesn’t look at you while he does it.'] : ['“You’re right. I owe you.”', '“Fair enough. Here.”', '“I don’t forget what I owe.”'];
  const refusing = turn.decision === 'no' || turn.decision === 'help';
  if (!refusing) return undefined;
  if (turn.ap === 'sweeten' && turn.claim && turn.claim !== 'money') return ['“It isn’t the money.”', '“You’re not listening. It isn’t about the money.”'];
  // an apology refused is not an offer declined
  if (turn.kind === 'amends') return m === 'flare' || m === 'defiant' ? ['“Sorry doesn’t cover it.”', '“That’s a start. It isn’t enough.”'] : m === 'cold' ? ['He hears you out, and says nothing for a while.'] : ['“I believe you mean it.”', '“I know you’re trying.”'];
  if (turn.cls === 'offer') return m === 'flare' ? ['“I don’t want anything from you.”'] : m === 'defiant' ? ['“I don’t need it.”', '“No.”'] : m === 'sorry' || m === 'hurt' ? ['“That’s good of you. But no.”', '“Thank you. No.”'] : ['“No, thanks.”'];
  if (turn.above) return m === 'flare' || m === 'defiant' ? ['“Don’t push your luck.”', '“Watch yourself.”'] : m === 'sorry' || m === 'hurt' ? ['“Not now.”', '“No. Not this time.”'] : ['“No.”'];
  if (turn.cls === 'request' || turn.cls === 'claim') return m === 'flare' ? ['“No. And don’t ask me again.”'] : m === 'sorry' || m === 'hurt' ? ['“I’m sorry.”', '“I wish I could.”'] : ['“No.”'];
  return undefined;
}
// His words for this turn, to the player. The mechanical outcome (what was agreed, who he went to) is narrated by the caller.
export function speak(w: World, a: Character, t: Character, turn: Turn): string[] {
  if (!a.isPlayer || t.isPlayer) return [];
  const tp = temper(t), v = viewOf(w, t, a);
  const m = moodOf(turn.decision, turn.ap, tp, v.fear, v.affection, turn.coerced);
  const k = turn.n + t.id.charCodeAt(t.id.length - 1);
  // asked the same thing again, he says so; met with something new (a threat, an argument, a better price), he answers that
  if ((turn.decision === 'no' || turn.decision === 'stall') && turn.again > 0 && (turn.ap === 'ask' || turn.ap === 'again')) return [pick(AGAIN[m] ?? AGAIN.cold!, turn.again - 1 + k)];
  if ((turn.decision === 'no' || turn.decision === 'stall') && turn.again > 0) {
    const r = special(turn, m) ?? OPEN[m][turn.ap] ?? OPEN[m]._ ?? ['He nods.'];
    const tail = turn.decision === 'stall' ? '“I still need time.”' : pick(['“It’s still no.”', '“The answer’s the same.”', '“No.”'], k);
    return [/[Nn]o\b|can’t/.test(pick(r, k)) ? pick(r, k) : join(pick(r, k), tail)];
  }
  const pool = special(turn, m) ?? OPEN[m][turn.ap] ?? OPEN[m]._ ?? ['He nods.'];
  const first = pick(pool, k);
  if (turn.decision === 'counter' && turn.terms) {
    const lead = m === 'keen' ? '“Look, I want this to work.”' : m === 'grudging' ? '“I’ll tell you what I’ll do, and it’s more than you deserve.”' : undefined;
    return [lead && turn.ap !== 'ask' ? join(lead, turn.terms) : turn.terms];
  }
  if (turn.reason && (turn.decision === 'no' || turn.decision === 'stall' || turn.decision === 'help')) {
    // a flare or a defiance is answer enough; a man who explains himself does
    return m === 'flare' && turn.ap !== 'ask' ? [first] : [join(first, turn.reason)];
  }
  return [first];
}
// How he takes a turn, as a word (for measuring: the experiments compare men of different temperament in the same turn).
export const moodFor = (w: World, a: Character, t: Character, turn: Turn): string => { const v = viewOf(w, t, a); return moodOf(turn.decision, turn.ap, temper(t), v.fear, v.affection, turn.coerced); };
