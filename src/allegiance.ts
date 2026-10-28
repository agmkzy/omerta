// Competing allegiances (The Family, October 2026): an associate who is doing well is worth having, and the man he works for is not
// the only made man who has noticed. Another one may ask him to come and work with him instead: better terms, a word put in, or only
// the promise of one. Going is a choice with a cost: the man he leaves holds it, and the man he goes to now answers for him.
import { addEnc } from './encounters';
import { addFact, bear, feel, peek } from './core';
import { WEEK, type Character, type Enc, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
export function allegianceWeek(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (!p?.alive || p.rank !== 'associate' || !p.familyId || !p.bossId || p.standing < 35 || (p.cooldown.poached ?? 0) > w.now) return;
  if (w.enc.some((e) => e.status === 'open' && e.kind === 'allegiance')) return;
  const cur = w.chars[p.bossId];
  const who = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && (c.rank === 'soldier' || c.rank === 'capo') && c.id !== p.bossId && c.id !== cur?.bossId && peek(c, p.id).trust >= 0.45 && c.traits.ambition > 0.5)
    .sort((a, b) => peek(b, p.id).trust - peek(a, p.id).trust || (a.id < b.id ? -1 : 1))[0];
  // (once in a while, not every week a man is noticed: by the calendar, so it takes nothing from the world's dice)
  if (!who || (Math.floor(w.now / WEEK) + who.id.length) % 5 !== 0) return;
  p.cooldown.poached = w.now + 8 * WEEK;
  const offer = who.rank === 'capo' ? 'a place in my crew, and my word when the books open' : 'better work than you’re getting, and my word for you when it matters';
  addEnc(w, { kind: 'allegiance', from: who.id, title: `${first(who)} wants you with him`, days: 5,
    lines: [`${first(who)} buys you a coffee and gets to it. “${cur ? `${first(cur)} doesn’t know what he’s got.` : 'You’re wasted where you are.'} Come and work with me. ${offer.charAt(0).toUpperCase() + offer.slice(1)}.”`],
    opts: [
      { code: 'go', label: `“All right. I’m with you.”`, hint: `${cur ? `${first(cur)} will hear of it, and hold it against you. ` : ''}${first(who)} answers for you now, and speaks for you.` },
      { code: 'stay', label: `“I’m with ${cur ? first(cur) : 'who I’m with'}.”`, hint: `${first(who)} won’t like it much. ${cur ? `If ${first(cur)} hears you turned it down, he’ll think better of you.` : ''}` },
      { code: 'tell', label: cur ? `Tell ${first(cur)} about the offer` : 'Turn it down', hint: cur ? `It shows ${first(cur)} where you stand. ${first(who)} will know who told.` : '' },
    ], data: { cur: cur?.id ?? '' } });
}
export function allegianceChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  const who = e.from ? w.chars[e.from] : undefined, cur = e.data?.cur ? w.chars[String(e.data.cur)] : undefined;
  if (!who?.alive) return { lines: ['He’s gone, and so is the offer.'], minutes: 5 };
  if (code === 'go') {
    if (cur?.alive) { bear(w, cur, p.id, 0.25, `${p.name} left him for ${who.name}`); feel(w, cur, p.id, 'trust', -0.15); }
    p.bossId = who.id; p.backer = who.id;
    feel(w, who, p.id, 'trust', 0.05);
    addFact(w, { kind: 'event', actor: p.id, victim: cur?.id, minor: false, text: `${p.name} went over to ${who.name}${cur ? `, leaving ${cur.name}` : ''}.`, district: p.district }, { witnesses: [p.id, who.id, ...(cur ? [cur.id] : [])] });
    return { lines: [`You shake on it. From tomorrow you answer to ${who.name}.${cur ? ` ${first(cur)} will hear by tonight.` : ''}`], minutes: 30 };
  }
  if (code === 'tell' && cur?.alive) {
    feel(w, cur, p.id, 'trust', 0.08, `${p.name} told him ${who.name} tried to take him`); bear(w, who, p.id, 0.12, `${p.name} told ${cur.name} about his offer`); bear(w, cur, who.id, 0.15, `${who.name} tried to take his man`);
    return { lines: [`${first(cur)} listens, and his face goes still. “Good. You did right telling me.” Whatever is between him and ${first(who)} now, you started it.`], minutes: 30 };
  }
  feel(w, who, p.id, 'respect', 0.02); feel(w, who, p.id, 'trust', -0.03);
  if (cur?.alive && w.rng.chance(0.4)) feel(w, cur, p.id, 'trust', 0.04, `${p.name} turned down ${who.name}`);
  return { lines: [`${first(who)} shrugs. “Your loss.” He means it, a little.`], minutes: 10 };
}

