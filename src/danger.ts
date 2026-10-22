// The player can die, but never without a ladder: rumour, warning, menace, an attempt he survives, and only then the real thing.
// Every rung offers a way out, and every way out costs something.
import { addEnc } from './encounters';
import { addFact, bear, clamp, handleDeath, money, rel } from './core';
import { tension } from './actions';
import { Arch, arch, pick } from './voice';
import { DAY, Character, Enc, Threat, World } from './types';

const PL = (w: World) => w.chars[w.playerId!];
const first = (c: Character) => c.name.split(' ')[0];
const GAP = [0, 4, 4, 5, 6, 7];

export function threatOf(w: World, enemy: Character): Threat {
  return (w.threats[enemy.id] ??= { enemy: enemy.id, level: 0, since: w.now, last: -1e9, warned: 0, truce: 0, hidden: 0, lethal: 0 });
}

export const LADDER_WORDS = ['nothing', 'word on the street', 'a warning', 'being watched', 'an attempt on you'];
export function dangerLevel(w: World): { level: number; who?: Character } {
  let best = 0;
  let who: Character | undefined;
  for (const t of Object.values(w.threats)) {
    const e = w.chars[t.enemy];
    if (e?.alive && t.level > best && w.now >= t.truce) {
      best = t.level;
      who = e;
    }
  }
  return { level: best, who };
}

function informant(w: World, p: Character, enemy: Character): Character | undefined {
  return Object.values(w.chars)
    .filter((c) => c.alive && c.id !== p.id && c.id !== enemy.id && (c.rels[p.id]?.trust ?? 0) >= 0.4 && c.rank !== 'civilian')
    .sort((a, b) => (b.rels[p.id]?.trust ?? 0) - (a.rels[p.id]?.trust ?? 0))[0];
}

const OPTS = (level: number, hasBoss: boolean) => [
  ...(hasBoss ? [{ code: 'boss', label: 'Take it to your boss', hint: 'He may step in. It won’t be free, and he may think less of you for asking.' }] : []),
  { code: 'sitdown', label: 'Ask him for a sit-down', hint: 'Some men will sit. Some think it’s a sign of weakness.' },
  { code: 'pay', label: `Send him ${money(300 * Math.max(1, level))}`, hint: 'Money talks. Sometimes it says the wrong thing.' },
  { code: 'strike', label: 'Move first', hint: 'Hurt him before he hurts you. He won’t take it quietly.' },
  { code: 'hide', label: 'Go to ground for a week', hint: 'Nobody finds a man who isn’t there. You lose the week.' },
  { code: 'shrug', label: 'Do nothing', hint: 'Maybe it will blow over.' },
];

export function menace(w: World, enemy: Character, p: Character) {
  step(w, threatOf(w, enemy), p);
}

function step(w: World, t: Threat, p: Character) {
  const enemy = w.chars[t.enemy];
  if (!enemy?.alive || !p.alive || w.now < t.truce || enemy.jailedUntil > w.now) return;
  if (w.now < t.hidden && w.rng.chance(0.85)) return;
  if (w.now - t.last < (GAP[t.level + 1] ?? 7) * DAY) return;
  t.last = w.now;
  const a = arch(enemy);
  const hasBoss = !!p.bossId && w.chars[p.bossId]?.alive && w.chars[p.bossId].familyId !== enemy.familyId;
  const lvl = t.level;
  if (lvl === 0) {
    t.level = 1;
    t.warned++;
    const f = informant(w, p, enemy);
    const text = `${enemy.name} has been asking where you drink, who you drive with, what time you leave.`;
    addFact(w, { kind: 'rumour', actor: enemy.id, victim: p.id, minor: true, text, district: p.district }, { witnesses: [p.id] });
    addEnc(w, {
      kind: 'threat', from: f?.id ?? null, about: enemy.id, title: 'Word on the street',
      lines: f ? [`${f.name} keeps his voice down.`, `"I’m only telling you because I would want to be told. ${text} I don’t know what it means. I know what it usually means."`] : [`Word reaches you from a man who wouldn’t give his name.`, `"${text}"`],
      opts: OPTS(1, hasBoss), data: { enemy: enemy.id }, days: 6,
    });
  } else if (lvl === 1) {
    t.level = 2;
    t.warned++;
    const msg: Record<Arch, string> = {
      hothead: `"Tell him I’m coming for him. Tell him I want him to know."`,
      cold: `"He knows what he did. Tell him that’s all I’m going to say."`,
      schemer: `"He and I should talk, before anyone does anything we both regret. There’s a number he can call."`,
      proud: `"He disrespected me in front of people. He can come to me and say he’s sorry, or he can wait and see what comes."`,
      bitter: `"He thinks nobody remembers. I remember."`,
      earnest: `"I don’t want this. But I won’t be pushed around. Tell him that."`,
      jovial: `"Tell him no hard feelings. And tell him to watch his back anyway."`,
      frightened: `"Tell him to leave me alone. Or else I’ll make him."`,
    };
    const f = informant(w, p, enemy);
    addEnc(w, {
      kind: 'threat', from: f?.id ?? null, about: enemy.id, title: `A message from ${first(enemy)}`,
      lines: [`A man you don’t know finds you outside your door and delivers it, word for word, like he was paid to.`, msg[a]],
      opts: OPTS(2, hasBoss), data: { enemy: enemy.id }, days: 6,
    });
  } else if (lvl === 2) {
    t.level = 3;
    t.warned++;
    const act = pick([
      `A dark Buick sits outside your door two nights running. The second night you see a cigarette glow in the front seat, and then it’s gone.`,
      `Somebody has been in your place. Nothing is missing. A chair is moved. A glass is turned upside down on the table, like a man who wanted you to know he had been there.`,
      `You come out in the morning and the dog next door is dead on your step, neatly, with a rope round its neck. Nobody saw anything.`,
      `Two men follow you from the club to the corner and then simply stop, and stand there looking at you, and one of them smiles.`,
    ], enemy.id + w.now);
    addEnc(w, {
      kind: 'threat', from: null, about: enemy.id, title: `You’re being watched`,
      lines: [act, `You know whose work this is. ${enemy.name} isn’t hiding it any more.`],
      opts: OPTS(3, hasBoss), data: { enemy: enemy.id }, days: 5,
    });
  } else {
    // an attempt
    const guards = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.skills.muscle > 0.5 && c.hurtUntil <= w.now && c.jailedUntil <= w.now).length;
    const boss = p.bossId ? w.chars[p.bossId] : undefined;
    const protectedBy = boss && boss.alive && rel(boss, p.id).trust > 0.55 && w.rng.chance(0.4) ? 0.1 : 0;
    const lethalReady = t.level >= 4 && t.warned >= 3;
    const kill = lethalReady ? clamp(0.42 + t.lethal * 0.1 - guards * 0.07 - protectedBy - (w.now < t.hidden ? 0.15 : 0), 0.12, 0.7) : 0;
    t.level = 4;
    t.warned++;
    if (kill > 0 && w.rng.chance(kill)) {
      handleDeath(w, p.id);
      p.hurtUntil = w.now;
      addFact(w, { kind: 'murder', actor: enemy.id, victim: p.id, text: `${enemy.name} had ${p.name} killed.`, district: p.district });
      return;
    }
    if (lethalReady) t.lethal++;
    const how = pick([
      `Two shots come out of a parked car on ${p.district === 'The Bronx' ? 'Arthur Avenue' : 'the corner'}. The first takes the window of the shop beside you. The second takes a piece of your sleeve.`,
      `The car comes up on the kerb too fast, and a man gets halfway out of it with something in his hand. A woman screams, and he changes his mind. You stand there with your heart going.`,
      `You’re three steps from your door when somebody steps out of the stairwell. You see the gun a second before he fires, and drop. It hits the wall where your head was.`,
      `A bottle with a rag in it comes through your window at two in the morning. You’re out the back before it has finished burning.`,
    ], enemy.id + w.now);
    p.hurtUntil = w.now + 3 * DAY;
    addEnc(w, {
      kind: 'threat', from: null, about: enemy.id, title: 'They tried to kill you',
      lines: [how, `It was ${enemy.name}'s work. You were lucky. You won’t be lucky forever.`],
      opts: OPTS(4, hasBoss), data: { enemy: enemy.id }, days: 4,
    });
  }
}

export function threatChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const t = w.threats[String(e.data?.enemy)];
  const enemy = t && w.chars[t.enemy];
  const lines: string[] = [];
  if (!t || !enemy) return ['It seems to have blown over.'];
  const a = arch(enemy);
  if (code === 'shrug') {
    lines.push('You tell yourself it will blow over. Nothing about the way your shoulders feel agrees.');
  } else if (code === 'boss') {
    const boss = p.bossId ? w.chars[p.bossId] : undefined;
    if (!boss?.alive) return ['There’s nobody to take it to.'];
    const ok = w.rng.chance(clamp(0.3 + rel(boss, p.id).trust * 0.4 + p.standing / 250 - (t.level >= 3 ? 0 : 0.1), 0.15, 0.85));
    if (ok) {
      t.truce = w.now + 30 * DAY;
      t.level = Math.max(0, t.level - 2);
      tension(w, p, enemy, 1);
      rel(boss, p.id).respect = clamp(rel(boss, p.id).respect - 0.03);
      lines.push(`${boss.name} listens without interrupting. "I’ll make a call." Two days later you’re told it’s settled. Nobody tells you what it cost, and you know that you owe ${first(boss)} for it.`);
      lines.push(`The word is that ${enemy.name} will keep away from you for a good while.`);
    } else {
      rel(boss, p.id).respect = clamp(rel(boss, p.id).respect - 0.06);
      lines.push(`${boss.name} waves it away. "Handle your own business. I don’t want a war over you." He’s not wrong, and it still lands badly.`);
    }
  } else if (code === 'sitdown') {
    const refuse = ['hothead', 'cold', 'bitter'].includes(a) && t.level >= 2 && !w.rng.chance(0.25);
    const ok = !refuse && w.rng.chance(clamp(0.5 + rel(enemy, p.id).respect * 0.3 - t.level * 0.08, 0.15, 0.8));
    if (ok) {
      p.cash = Math.max(0, p.cash - 150);
      t.truce = w.now + 20 * DAY;
      t.level = Math.max(0, t.level - 1);
      bear(w, enemy, p.id, -(0.25), 'settled');
      lines.push(a === 'proud' ? `${enemy.name} sits stiffly and takes an apology that’s not quite an apology. It’s enough. For now.` : `You meet ${enemy.name} in a back room. Nobody apologises and everybody pays for the coffee. That’s how you know it went well.`);
    } else {
      t.level = Math.min(4, t.level + (refuse ? 1 : 0));
      lines.push(refuse ? `${enemy.name} sends back a word: "Tell him I have nothing to say to him." That’s worse than a no.` : `${enemy.name} won’t meet you. The message that comes back is polite, and it’s not an answer.`);
    }
  } else if (code === 'pay') {
    const amt = 300 * Math.max(1, t.level);
    if (p.cash < amt) return [`You don’t have ${money(amt)}.`];
    p.cash -= amt;
    enemy.cash += amt;
    if (w.rng.chance(0.55 - (a === 'proud' ? 0.25 : 0) + (a === 'bitter' || a === 'schemer' ? 0.15 : 0))) {
      t.truce = w.now + 25 * DAY;
      t.level = Math.max(0, t.level - 2);
      lines.push(`The money is taken. It’s not said what for. ${enemy.name} goes quiet, which is the nearest thing to an answer you’ll get.`);
    } else {
      rel(enemy, p.id).respect = clamp(rel(enemy, p.id).respect - 0.1);
      lines.push(`The money comes back the next day in the same envelope. That’s a message too.`);
    }
  } else if (code === 'strike') {
    enemy.hurtUntil = w.now + 3 * DAY;
    p.heat = clamp(p.heat + 0.12, 0, 1.5);
    addFact(w, { kind: 'beating', actor: p.id, victim: enemy.id, text: `${p.name} beat up ${enemy.name}.`, district: enemy.district }, { witnesses: [p.id] });
    tension(w, p, enemy, 1);
    bear(w, enemy, p.id, 0.15, `${p.name} beat him`);
    t.lethal += 1;
    lines.push(`You find ${enemy.name} before he finds you. It’s quick and ugly. He’ll be laid up a few days. He’ll also not forget it.`);
  } else if (code === 'hide') {
    t.hidden = w.now + 8 * DAY;
    p.heat = clamp(p.heat - 0.2, 0, 1.5);
    lines.push(`You go to a cousin's place in Jersey and stay inside. Nobody calls. Nothing happens. A week is gone, and you haven’t been shot.`);
    e.data = { ...e.data, hide: 1 };
  }
  return lines;
}

export function dangerTick(w: World) {
  const p = PL(w);
  if (!p?.alive) return;
  for (const t of Object.values(w.threats)) {
    const e = w.chars[t.enemy];
    if (!e?.alive) {
      delete w.threats[t.enemy];
      continue;
    }
    const g = e.rels[p.id]?.grudge ?? 0;
    if (g < 0.3 && t.level > 0 && w.now - t.last > 7 * DAY) {
      t.level--;
      t.last = w.now;
    }
    if (t.level > 0 && w.now >= t.truce && g >= 0.3 && w.rng.chance(0.3)) step(w, t, p);
  }
  // somebody with a good reason starts one
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || !c.familyId || c.rank === 'civilian') continue;
    const r = c.rels[p.id];
    const hunting = w.fam[c.familyId]?.hunt?.target === p.id;
    if (!r || r.grudge < (hunting ? 0.5 : 0.7) || c.traits.violence < (hunting ? 0.3 : 0.55) || (c.familyId === p.familyId && !hunting)) continue;
    if ((w.threats[c.id]?.level ?? 0) === 0 && w.rng.chance(hunting ? 0.12 : 0.04)) step(w, threatOf(w, c), p);
  }
}
