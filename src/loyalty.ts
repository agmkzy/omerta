// Loyalty, tested (the compelling-RPG stage). A captain who has no love for the player's own captain sees a useful man in his crew, and
// asks him, quietly, to tell him how things go there: who earns, who is short, what his captain is planning. The player decides what kind
// of man he is: he takes the money and the friend higher up, he says he is his captain's man, or he goes to his captain with it. Each
// choice is remembered by the men it touches, and the first can come out later: weeks on, his captain may learn who has been talking.
// Everything goes through the world's own records (regard, grudges, favours, facts, the family's tension, the pending queue).
import { addFact, bear, clamp, feel, money, rel, repute, transfer } from './core';
import { addEnc, addFavour } from './encounters';
import { temper } from './temper';
import { imposed } from './imposed';
import { DAY, type Character, type Enc, type Pending, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const R = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];

/** Who might court the player now: a captain of his own family, not his own, with something against his captain. */
export function courter(w: World, p: Character): { x: Character; cap: Character } | undefined {
  const cap = p.bossId ? w.chars[p.bossId] : undefined;
  if (!cap?.alive || !p.familyId || !['associate', 'soldier'].includes(p.rank) || p.jailedUntil > w.now) return undefined;
  if ((p.cooldown['court'] ?? 0) > w.now || w.enc.some((e) => e.kind === 'courting' && e.status === 'open')) return undefined;
  const x = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.id !== cap.id && R.indexOf(c.rank) >= R.indexOf(cap.rank) && c.rank !== 'boss' && c.jailedUntil <= w.now && rel(c, cap.id).grudge >= 0.2)
    .sort((a, b) => rel(b, cap.id).grudge - rel(a, cap.id).grudge || (a.id < b.id ? -1 : 1))[0];
  // (he notices a man worth having: one who is earning, or being talked about)
  if (!x || p.standing < 38 || (p.career?.done ?? 0) < 2) return undefined;
  return { x, cap };
}

/** The approach itself: he finds the player, alone, and says what he wants. */
export function makeCourting(w: World, p: Character, x: Character, cap: Character) {
  p.cooldown['court'] = w.now + 45 * DAY;
  const a = temper(x), pay = 150 + Math.round(Math.min(350, x.cash * 0.02) / 50) * 50;
  const lead = a.agreeable > 0.55
    ? `“You’re doing good work for ${first(cap)}. Better than he deserves, between us. I like to know how things go in other men’s crews: who’s earning, who isn’t, what ${first(cap)} has in mind. A man who keeps me informed finds me grateful. ${money(pay)} grateful, to start.”`
    : `“I’ll be plain. ${first(cap)} and I don’t see eye to eye, and I like to know what he’s doing before he does it. You’re in his crew. Tell me now and then how things stand there, and there’s ${money(pay)} in it, and a friend who sits higher than he does.”`;
  addEnc(w, {
    kind: 'courting', from: x.id, title: `${first(x)} wants a quiet word`, days: 5, data: { cap: cap.id, pay },
    lines: [`${x.name}, a captain in your own family, finds you alone.`, lead],
    opts: [
      { code: 'deal', label: `Tell him what he wants to know (${money(pay)})`, hint: `Money now, and a friend above your captain. If ${first(cap)} ever finds out, you are finished in his crew.` },
      { code: 'no', label: `Tell him you’re ${first(cap)}’s man`, hint: 'He will respect it. He won’t like it.' },
      { code: 'tell', label: `Say nothing now, and take it to ${first(cap)}`, hint: `${first(cap)} will remember who came to him. ${first(x)} may find out who did.` },
    ],
  });
}

/** What the player says, and what it starts. */
export function answerCourting(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const x = e.from ? w.chars[e.from] : undefined, cap = w.chars[String(e.data?.cap ?? '')], lines: string[] = [];
  e.status = 'done';
  if (!x?.alive || !cap?.alive) return { lines: ['He has other things on his mind now. It came to nothing.'], minutes: 5 };
  if (code === 'deal') {
    const got = transfer(w, x, p, Number(e.data?.pay ?? 150), 'gift', 'for keeping him informed');
    feel(w, x, p.id, 'trust', 0.15); feel(w, x, p.id, 'respect', 0.05);
    addFavour(w, p.id, x.id, 1, `telling him how things go in ${first(cap)}’s crew`);
    lines.push(`You tell him what you know: who is earning in ${first(cap)}’s crew, who is short, what ${first(cap)} has said in front of you. ${first(x)} listens without writing anything down. He counts out ${money(got)}. “We’ll talk again.”`);
    // (it can come out: weeks on, the man it was about may hear who has been talking)
    (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(14, 42) * DAY, kind: 'loyalty', a: p.id, b: cap.id, c: x.id });
    return { lines, minutes: 40 };
  }
  if (code === 'no') {
    feel(w, x, p.id, 'respect', 0.06); bear(w, x, p.id, 0.06, `${p.name} turned him down for ${cap.name}`);
    lines.push(`“I’m ${first(cap)}’s man,” you tell him. ${first(x)} looks at you a long moment. “Loyal. That’s worth something. Remember I asked nicely.”`);
    return { lines, minutes: 15 };
  }
  // he goes to his captain with it
  feel(w, cap, p.id, 'trust', 0.14); feel(w, cap, p.id, 'respect', 0.06); repute(w, p, 1, 'stood up');
  bear(w, cap, x.id, 0.2, `${x.name} tried to turn one of his men`);
  const learns = w.rng.chance(0.45);
  if (learns) bear(w, x, p.id, 0.25, `${p.name} ran to ${cap.name} with what he said`);
  addFact(w, { kind: 'report', actor: p.id, victim: x.id, minor: false, text: `${p.name} told ${cap.name} that ${x.name} had come asking about his crew.${learns ? ` Word got back to ${x.name} who told.` : ''}`, district: p.district }, { witnesses: [p.id, cap.id] });
  lines.push(`You go to ${first(cap)} and tell him, word for word. His face doesn’t move. “Good,” he says at last. “You did right. I won’t forget it.”${learns ? ` Somewhere, ${first(x)} hears it was you.` : ''}`);
  return { lines, minutes: 60 };
}

/** Weeks after the player sold his captain's business: whether it comes out, and what his captain does about it. */
export function loyaltyDue(w: World, q: Pending) {
  const p = w.chars[q.a ?? ''], cap = w.chars[q.b ?? ''], x = w.chars[q.c ?? ''];
  if (!p?.alive || !cap?.alive || p.bossId !== cap.id) return;
  const found = w.rng.chance(clamp(0.25 + temper(cap).caution * 0.35 + (x && !x.alive ? 0.2 : 0), 0.2, 0.7));
  if (!found) return;
  feel(w, cap, p.id, 'trust', -0.35); feel(w, cap, p.id, 'respect', -0.15); bear(w, cap, p.id, 0.4, `${p.name} sold his crew’s business to ${x?.name ?? 'another captain'}`);
  repute(w, p, -5, 'informer');
  if (p.backer === cap.id) delete p.backer;
  addFact(w, { kind: 'discipline', actor: cap.id, victim: p.id, minor: false, text: `${cap.name} found out ${p.name} had been telling ${x?.name ?? 'another captain'} about his crew.`, district: p.district }, { witnesses: [] });
  imposed(w, p, cap, {
    title: `${first(cap)} knows`,
    said: `${first(cap)} doesn’t raise his voice. “${x ? first(x) : 'He'} knew things he could only have had from inside my crew. It took me a while. It doesn’t take me long to forget a man, though.”`,
    why: `You sat at my table and carried what you heard to ${x ? first(x) : 'another man'}. A man who does that once does it again.`,
    record: `${cap.name} found out you had been telling ${x?.name ?? 'another captain'} about his crew. He will not speak for you now.`,
  });
}
void DAY;
