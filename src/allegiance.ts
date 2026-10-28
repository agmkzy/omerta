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


// The other side of it: one of the player's own men is being courted by another made man. A man who isn't happy where he is listens;
// the player hears of it (from another of his men), and can talk to him (a better cut keeps most men), have a word with the man doing
// the courting (made man to made man: it may settle it, or start something), or let him go, and with him what he brings in.
export function courtedWeek(w: World) {
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (!p?.alive || !p.familyId || !['soldier', 'capo'].includes(p.rank) || (p.cooldown.courted ?? 0) > w.now) return;
  if (w.enc.some((e) => e.status === 'open' && e.kind === 'courted')) return;
  const mine = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && (c.rank === 'associate' || (c.rank === 'soldier' && p.rank === 'capo')) && !c.isPlayer);
  for (const m of mine.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const r = peek(m, p.id);
    // a man listens if he isn't happy where he is, or wants more than he has
    if (r.trust >= 0.5 && r.grudge < 0.1 && m.traits.ambition <= 0.65) continue;
    // who courts him: a made man who knows him a little and wants more men (a soldier's man by a captain only if he is a soldier)
    const x = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && (m.rank === 'soldier' ? c.rank === 'capo' : c.rank === 'soldier' || c.rank === 'capo') && c.id !== p.bossId && c.id !== p.id && peek(c, m.id).trust >= 0.15 && c.traits.ambition > 0.45)
      .sort((a, b) => peek(b, m.id).trust - peek(a, m.id).trust || (a.id < b.id ? -1 : 1))[0];
    if (!x || (Math.floor(w.now / WEEK) + m.id.length) % 4 !== 0) continue;
    const teller = mine.find((c) => c.id !== m.id && peek(c, p.id).trust >= 0.35);
    p.cooldown.courted = w.now + 6 * WEEK;
    addEnc(w, { kind: 'courted', from: teller?.id ?? m.id, about: m.id, title: `${first(m)} is being courted`, days: 5,
      lines: [teller ? `${first(teller)}, quietly: “${first(m)}’s been having coffee with ${x.name}. More than once. I’m only saying.”` : `${first(m)} mentions, as if it were nothing, that ${x.name} has been asking after him.`],
      opts: [
        { code: 'cut', label: `Talk to ${first(m)}: a bigger share for him`, hint: 'He keeps more of what he brings in. Most men stay for that. You get less.' },
        { code: 'word', label: `Have a word with ${first(x)}`, hint: `Made man to made man: leave my men alone. ${first(x)} may back off, or take it badly.` },
        { code: 'let', label: `Let ${first(m)} go if he wants`, hint: 'A man who wants to leave isn’t worth keeping. What he brings in goes with him.' },
      ], data: { m: m.id, x: x.id } });
    return;
  }
}
export function courtedChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  const m = w.chars[String(e.data?.m)], x = w.chars[String(e.data?.x)];
  if (!m?.alive || !x?.alive || m.bossId !== p.id) return { lines: ['It sorted itself out before you got to it.'], minutes: 5 };
  if (code === 'cut') {
    m.kickRate = Math.max(0.1, Math.round((m.kickRate - 0.05) * 100) / 100); feel(w, m, p.id, 'trust', 0.1, `${p.name} gave him a bigger share to keep him`);
    return { lines: [`You take ${first(m)} for a drink and tell him he keeps more from now on. He doesn’t pretend not to know why. He stays.`], minutes: 40 };
  }
  if (code === 'word') {
    const backs = peek(x, p.id).respect + peek(x, p.id).trust * 0.5 + (p.rank === 'capo' && x.rank === 'soldier' ? 0.3 : 0) - x.traits.ambition * 0.3;
    if (backs > 0.2) { bear(w, m, p.id, 0.05, `${p.name} warned ${x.name} off him`); return { lines: [`${first(x)} spreads his hands. “I was only being friendly.” He won’t be again. ${first(m)} hears you went to him, and doesn’t like it much.`], minutes: 30 }; }
    bear(w, x, p.id, 0.15, `${p.name} told him to keep away from his men`); m.bossId = x.id; feel(w, m, x.id, 'trust', 0.05);
    addFact(w, { kind: 'event', actor: m.id, victim: p.id, minor: false, text: `${m.name} left ${p.name} for ${x.name}.`, district: m.district }, { witnesses: [p.id, m.id, x.id] });
    return { lines: [`${first(x)} looks at you a long time. “He’s a grown man. Ask him.” By the end of the week ${first(m)} is with ${first(x)}, and ${first(x)} has a grudge with your name on it.`], minutes: 30 };
  }
  m.bossId = x.id; feel(w, m, x.id, 'trust', 0.05); feel(w, m, p.id, 'respect', 0.03);
  addFact(w, { kind: 'event', actor: m.id, victim: p.id, minor: false, text: `${m.name} went over to ${x.name}, with ${p.name}’s leave.`, district: m.district }, { witnesses: [p.id, m.id, x.id] });
  return { lines: [`You tell ${first(m)} he can go with your blessing. He looks relieved, and goes. What he brought in goes with him.`], minutes: 15 };
}
