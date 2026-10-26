// The part of the man that is not the job: a mother who wants Sundays, a woman who wants an answer, a sister who needs a favour.
// None of it is a score. It is what you are choosing between when you are always choosing money.
import { addFact, clamp, feel, feelAtLeast, feelTo, learn, money, rel, repute } from './core';
import { addEnc } from './encounters';
import { Character, DAY, Enc, Id, Kin, Life, Partner, World } from './types';
import { FEMALE, spawnCivilian } from './world';
import { arch, pick } from './voice';

const PL = (w: World) => w.chars[w.playerId!];
const first = (c: Character) => c.name.split(' ')[0];

// `brother`, when given, is a man who already exists in the world (the connected family's soldier): he is the sibling,
// and nobody else is invented to stand in for one.
export function lifeInit(w: World, p: Character, brother?: Character) {
  const last = p.name.split(' ').slice(1).join(' ') || p.name;
  const rng = w.rng;
  const mother = spawnCivilian(w, `${pick(['Rosa', 'Carmela', 'Theresa', 'Josephine', 'Antonia', 'Lucia'], p.id)} ${last}`, p.district, 80);
  mother.traits.sociability = 0.7;
  const sib = brother ?? spawnCivilian(w, `${rng.chance(0.5) ? pick(FEMALE, p.id + 'sib') : pick(['Frankie', 'Danny', 'Joey', 'Mikey'], p.id + 'sib')} ${last}`, p.district, 140);
  const kin: Kin[] = [
    { id: mother.id, role: 'mother', warmth: 0.6, lastSeen: w.now - 5 * DAY },
    { id: sib.id, role: FEMALE.includes(sib.name.split(' ')[0]) ? 'sister' : 'brother', warmth: 0.5, lastSeen: w.now - 12 * DAY },
  ];
  for (const k of kin) {
    const c = w.chars[k.id];
    feelTo(c, p.id, 'trust', 0.7);
    feelTo(c, p.id, 'affection', 0.8);
    feelTo(p, c.id, 'trust', 0.7);
    feelTo(p, c.id, 'affection', 0.8);
  }
  // A made brother loves you and is still waiting to see what you are. His trust is earned like anyone's.
  if (brother) {
    Object.assign(rel(brother, p.id), { trust: 0.45, affection: 0.75, respect: 0.25, lastMet: w.now - 12 * DAY });
    Object.assign(rel(p, brother.id), { trust: 0.6, affection: 0.75, respect: 0.55, lastMet: w.now - 12 * DAY });
  }
  w.life = { kin, met: [], lastSunday: w.now };
}

export const warmthWord = (v: number) => (v > 0.8 ? 'devoted' : v > 0.6 ? 'close' : v > 0.4 ? 'friendly' : v > 0.22 ? 'cooling' : 'distant');
export const kinWord = (k: Kin) => (k.role === 'mother' ? 'Your mother' : k.role === 'father' ? 'Your father' : k.role === 'sister' ? 'Your sister' : k.role === 'son' ? 'Your son' : k.role === 'daughter' ? 'Your daughter' : 'Your brother');

export function kinOf(w: World, id: Id): Kin | undefined {
  return w.life?.kin.find((k) => k.id === id);
}
export function isPartner(w: World, id: Id): boolean {
  return w.life?.partner?.id === id && w.life.partner.stage !== 'split';
}
export const stageWord: Record<Partner['stage'], string> = { seeing: 'seeing each other', steady: 'together', engaged: 'engaged', married: 'married', split: 'it ended' };

// ------------------------------------------------------------ daily

export function lifeDaily(w: World) {
  const p = PL(w);
  const L = w.life;
  if (!p?.alive || !L) return;
  // warmth fades if you stay away
  for (const k of L.kin) if (w.now - k.lastSeen > 10 * DAY) k.warmth = clamp(k.warmth - 0.006);
  const pr = L.partner;
  if (pr && pr.stage !== 'split') {
    if (w.now - pr.lastSeen > 6 * DAY) pr.warmth = clamp(pr.warmth - 0.012);
    // (she says it once in a while, not every week it stays cold: three weeks between)
    if (pr.warmth < 0.3 && (p.cooldown['partnerTrouble'] ?? 0) <= w.now && !w.enc.some((e) => e.status === 'open' && e.kind === 'partner') && w.rng.chance(0.2)) { p.cooldown['partnerTrouble'] = w.now + 21 * DAY; partnerTrouble(w, p, pr); }
    if (pr.due && w.now >= pr.due) birth(w, p, pr);
    if (pr.stage === 'steady' && pr.dates >= 14 && pr.warmth > 0.75 && !w.enc.some((e) => e.status === 'open' && e.kind === 'partner') && w.rng.chance(0.3)) proposal(w, p, pr);
  } else if (!pr || pr.stage === 'split') {
    if (w.now > 25 * DAY && w.now - (L.ex ? w.chars[L.ex]?.diedAt ?? 0 : 0) > 0 && w.rng.chance(0.025) && !w.enc.some((e) => e.status === 'open' && e.kind === 'meet')) introduce(w, p);
  }
  // Sunday
  // (every three weeks or so, and she leaves it longer when he didn't come last time)
  const skipped = w.enc.some((e) => e.kind === 'kin' && e.title === 'Sunday dinner' && e.status === 'lapsed' && e.t === L.lastSunday);
  if (w.now - L.lastSunday >= (skipped ? 28 : 21) * DAY && !w.enc.some((e) => e.status === 'open' && e.kind === 'kin')) {
    L.lastSunday = w.now;
    const k = L.kin[0];
    if (k && w.chars[k.id]?.alive) sunday(w, p, k);
  }
  // illness
  const m = L.kin[0];
  if (m && w.chars[m.id]?.alive && !m.sick && w.rng.chance(0.004) && w.now > 40 * DAY) {
    m.sick = w.now;
    const c = w.chars[m.id];
    addEnc(w, {
      kind: 'kin', from: c.id, title: `${first(c)} is unwell`, days: 8,
      lines: [`Your sister calls you at the club. It’s the first time she has called you there.`, `"Ma is in the hospital. Maria Immaculata, on Court Street. They say it’s her heart. They want money before they’ll say anything else."`],
      opts: [
        { code: 'pay', label: 'Pay for the best doctor: $800', hint: 'Whatever it takes.' },
        { code: 'some', label: 'Pay what you can: $300', hint: 'It will do something.' },
        { code: 'go', label: 'Go and sit with her', hint: 'Money can’t buy what an afternoon can.' },
        { code: 'no', label: 'You’re busy', hint: 'You’ll have to live with it.' },
      ],
      data: { what: 'ill' },
    });
  }
}

function introduce(w: World, p: Character) {
  const L = w.life!;
  const friend = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && c.familyId === p.familyId && (c.rels[p.id]?.trust ?? 0) > 0.3).sort(() => w.rng.next() - 0.5)[0];
  if (!friend) return;
  const name = `${pick(FEMALE.filter((n) => !L.met.includes(n)), w.now + friend.id)} ${pick(['Esposito', 'Conti', 'Caruso', 'Amato', 'Barone', 'Fontana', 'Greco', 'Ricci'], friend.id + w.now)}`;
  const g = spawnCivilian(w, name, friend.district, 90);
  const job = pick(['a teacher at the parish school', 'a nurse at Maimonides', 'behind the counter at her uncle\'s bakery', 'a bookkeeper at a dental office', 'a seamstress in the garment district', 'a waitress who is saving for school'], g.id);
  addEnc(w, {
    kind: 'meet', from: friend.id, about: g.id, title: `${first(friend)} wants you to meet someone`, days: 8,
    lines: [`${friend.name} has been working up to it all evening.`, `"There’s a girl. ${name.split(' ')[0]}. ${job.charAt(0).toUpperCase() + job.slice(1)}. She has no idea what you do for a living, and I would like it to stay that way for a while. Dinner Saturday. Say yes."`],
    opts: [
      { code: 'yes', label: 'All right. Saturday', hint: 'You’ll have to dress up.' },
      { code: 'no', label: 'Not now', hint: 'You’re busy being what you are.' },
    ],
    data: { g: g.id },
  });
}

function partnerTrouble(w: World, p: Character, pr: Partner) {
  const g = w.chars[pr.id];
  const lead = pick([
    `"I’m not asking you to give up whatever it’s you do. I’m asking you to turn up. Is that so much?"`,
    `"You called to say you were coming and then you didn’t come. Again. I made dinner, ${p.name.split(' ')[0]}. I always make dinner."`,
    `"My mother asks me what you do. I say I don’t know. She says that’s the problem."`,
    `"I don’t know who you’re on the nights you’re not with me, and I’m starting to think I should be afraid of the answer."`,
  ], g.id + w.now);
  addEnc(w, {
    kind: 'partner', from: g.id, title: `${first(g)} has had enough`, days: 5,
    lines: [`${g.name} meets you outside her building. She has been crying and has fixed her face so you won’t see it.`, lead],
    opts: [
      { code: 'sorry', label: 'Apologise, and mean it', hint: 'Show up this week.' },
      { code: 'gift', label: 'Bring her something: $150', hint: 'It helps. It’s not the same thing.' },
      { code: 'truth', label: 'Tell her a little of the truth', hint: 'Some women leave. Some stay forever.' },
      { code: 'end', label: 'Let her go', hint: 'You knew this would happen.' },
    ],
    data: { pr: 1 },
  });
}

function proposal(w: World, p: Character, pr: Partner) {
  const g = w.chars[pr.id];
  addEnc(w, {
    kind: 'partner', from: g.id, title: `${first(g)} is waiting for you to ask`, days: 10,
    lines: [`${g.name} says nothing about it. She has stopped saying anything about it, which is how you know.`, `At dinner she puts her hand over yours and doesn’t say a word. The ring is in your pocket. It has been in your pocket for a week.`],
    opts: [
      { code: 'propose', label: 'Ask her', hint: 'It changes how people see you, and what they can do to you.' },
      { code: 'wait', label: 'Not yet', hint: 'She will wait. Not forever.' },
    ],
    data: { pr: 2 },
  });
}

function sunday(w: World, p: Character, k: Kin) {
  const c = w.chars[k.id];
  const lead = pick([
    `"It’s Sunday. There’s a roast. Your sister is coming. I won’t eat until you’re here."`,
    `"I’ve made too much. I always make too much. Come, and take some home."`,
    `"Father Dominic asked about you. I said you were very busy. He said busy isn’t always a virtue."`,
    `"You never come. I’m not complaining. I’m just telling you I have a very big table and a very small number of people at it."`,
  ], c.id + w.now);
  addEnc(w, {
    kind: 'kin', from: c.id, title: 'Sunday dinner', days: 3,
    lines: [`${c.name} calls the club. Somebody fetches you.`, lead],
    opts: [
      { code: 'go', label: 'Go', hint: 'Four hours. Nobody will call you there.' },
      { code: 'late', label: 'Come for dessert', hint: 'Better than nothing.' },
      { code: 'no', label: 'Send regrets', hint: 'You’ll hear about it.' },
    ],
    data: { what: 'sunday' },
  });
}

// ------------------------------------------------------------ answering

export function lifeChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const L = w.life!;
  const c = e.from ? w.chars[e.from] : undefined;
  const lines: string[] = [];
  if (e.kind === 'meet') {
    if (code === 'no') return { lines: [`"Your loss," ${first(c!)} says, and means it kindly.`], minutes: 5 };
    const g = w.chars[String(e.data?.g)];
    L.partner = { id: g.id, stage: 'seeing', warmth: 0.45, dates: 1, since: w.now, lastSeen: w.now };
    feelTo(g, p.id, 'trust', 0.3);
    feelTo(p, g.id, 'trust', 0.3);
    lines.push(`${g.name} isn’t what you expected. She laughs at the right moments and not at the wrong ones, and she asks what you do and then lets you not answer. The evening goes on three hours longer than dinner should.`);
    p.cash -= 70;
    return { lines, minutes: 240 };
  }
  if (e.kind === 'partner' && L.partner) {
    const pr = L.partner;
    const g = w.chars[pr.id];
    if (e.data?.pr === 2) {
      if (code === 'propose') {
        pr.stage = 'engaged';
        pr.warmth = 1;
        repute(w, p, 1, 'family');
        p.cash -= 400;
        lines.push(`${g.name} says yes before you have finished the sentence. Within a week every man in the family has heard, and each of them has an opinion about the ring.`);
      } else {
        pr.warmth = clamp(pr.warmth - 0.1);
        lines.push(`${g.name} nods. She smiles. It’s a good smile and it’s a little tired.`);
      }
      return { lines, minutes: 120 };
    }
    if (code === 'sorry') {
      pr.warmth = clamp(pr.warmth + 0.25);
      pr.lastSeen = w.now;
      lines.push(`${g.name} lets you hold her. "Come Thursday. Really come." You write it on your hand.`);
    } else if (code === 'gift') {
      if (p.cash < 150) lines.push('You don’t have it on you.');
      else {
        p.cash -= 150;
        pr.warmth = clamp(pr.warmth + 0.12);
        pr.lastSeen = w.now;
        lines.push(`${g.name} turns the box over without opening it. "I didn’t want a present." She keeps it.`);
      }
    } else if (code === 'truth') {
      const bold = w.rng.chance(0.55);
      if (bold) {
        pr.warmth = clamp(pr.warmth + 0.3);
        pr.note = 'knows';
        lines.push(`You tell her some of it. Not the worst. She’s quiet for a very long time. "I thought it was something like that." She doesn’t leave. She doesn’t ask again.`);
      } else {
        pr.stage = 'split';
        L.ex = pr.id;
        lines.push(`You tell her some of it and watch her face close like a door. "I can’t," she says. She says it gently. It’s the gentleness that does it.`);
      }
    } else {
      pr.stage = 'split';
      L.ex = pr.id;
      lines.push(`You say it as kindly as you can. ${g.name} says only, "I know." She doesn’t make you say it twice.`);
    }
    return { lines, minutes: 90 };
  }
  if (e.kind === 'kin' && c) {
    const k = kinOf(w, c.id)!;
    if (e.data?.what === 'christening') {
      const ev = w.events.find((x) => x.id === e.data?.ev); if (ev) ev.done = true;
      const guests = Object.values(w.chars).filter((g) => g.alive && g.id !== p.id && g.familyId && g.familyId === p.familyId && g.rank !== 'associate' && (g.rels[p.id]?.trust ?? 0) > 0.2).slice(0, 14);
      if (code === 'grand' && p.cash >= 900) { p.cash -= 900; for (const g of guests) feel(w, g, p.id, 'respect', 0.05); repute(w, p, 2, 'wedding'); k.warmth = clamp(k.warmth + 0.05); lines.push(`Our Lady of Pity is full to the doors. Your boss holds the baby for the photograph. Every man in the room remembers who paid for the wine.`); }
      else if (code === 'modest' && p.cash >= 250) { p.cash -= 250; for (const g of guests) feel(w, g, p.id, 'respect', 0.01); repute(w, p, 0.5, 'wedding'); lines.push(`A small room, a good cake, and your mother crying in the second row. Nobody can say you didn’t do it right.`); }
      else { for (const g of guests) feel(w, g, p.id, 'respect', -0.03); k.warmth = clamp(k.warmth - 0.03); lines.push(`The priest, your wife, and an empty church. It’s noticed, and not said out loud.`); }
      return { lines, minutes: 240 };
    }
    if (e.data?.what === 'birth') { k.warmth = clamp(k.warmth + 0.05); k.lastSeen = w.now; return { lines: [`You hold ${first(c)} until your arms ache. Nobody calls. For one afternoon the world is exactly the size of this room.`], minutes: 120 }; }
    if (e.data?.what === 'ill') {
      if (code === 'pay') { p.cash -= 800; k.warmth = clamp(k.warmth + 0.1); delete k.sick; lines.push(`The doctor is a man who charges a lot and explains very little. Your mother comes home in nine days. She tells everyone you paid. She tells them several times.`); }
      else if (code === 'some') { p.cash -= 300; k.warmth = clamp(k.warmth + 0.04); if (w.rng.chance(0.65)) delete k.sick; lines.push(`It buys what it buys. The doctor is tactful about the rest.`); }
      else if (code === 'go') { k.warmth = clamp(k.warmth + 0.18); k.lastSeen = w.now; delete k.sick; lines.push(`You sit for four hours. She sleeps for three of them. When she wakes up she says only, "You came." It’s all you needed to hear and more than you deserved.`); return { lines, minutes: 270 }; }
      else { k.warmth = clamp(k.warmth - 0.15); lines.push(`You send the message back that you can’t come. It’s the kind of thing a man remembers about himself at three in the morning.`); if (w.rng.chance(0.3)) { const mom = w.chars[k.id]; mom.alive = false; mom.diedAt = w.now; addFact(w, { kind: 'event', victim: mom.id, minor: true, text: `${p.name}'s mother died in hospital.`, district: p.district }, { witnesses: [p.id] }); lines.push(`Your sister calls two days later. You don’t need her to say it.`); } }
      return { lines, minutes: 30 };
    }
    if (code === 'no') { k.warmth = clamp(k.warmth - 0.08); lines.push(`${first(c)} doesn’t make a speech. She just says, "I understand," in the voice that means something else.`); return { lines, minutes: 5 }; }
    const full = code === 'go';
    k.warmth = clamp(k.warmth + (full ? 0.12 : 0.05));
    k.lastSeen = w.now;
    lines.push(full ? pick([`Roast chicken, escarole, the good wine. Your sister interrogates you politely. Your mother watches you eat. By the end you have forgotten your pockets are heavy.`, `The apartment smells like the apartment always smelled. Somebody has put out the photograph of your father. You don’t look at it too long.`], c.id + w.now) : `You get there for coffee. It’s enough to say you were there.`);
    // old women know everything
    const f = Object.values(w.facts).filter((q) => !q.minor && q.district === c.district && !p.known[q.id] && w.now - q.t < 30 * DAY)[0];
    if (full && f) {
      learn(w, p.id, f, c.id, true);
      lines.push(`Over coffee your mother says, in the voice she uses for gossip, ${f.text}`);
    }
    return { lines, minutes: full ? 240 : 90 };
  }
  return { lines: ['Nothing comes of it.'], minutes: 5 };
}

// ------------------------------------------------------------ do things yourself

export function seePartner(w: World, p: Character): string[] {
  const pr = w.life?.partner;
  if (!pr || pr.stage === 'split') return ['There’s nobody to see.'];
  const g = w.chars[pr.id];
  if (p.cash < 60) return ['You can’t afford an evening out right now.'];
  p.cash -= 60;
  pr.lastSeen = w.now;
  pr.dates++;
  const hot = p.heat > 0.45;
  pr.warmth = clamp(pr.warmth + (hot ? 0.03 : 0.07));
  p.heat = clamp(p.heat - 0.05, 0, 1.5);
  feel(w, g, p.id, 'trust', 0.02);
  return [hot ? `Dinner at a place on Mulberry. You spend half of it watching the windows. ${first(g)} notices, and says nothing, and that’s worse.` : pick([`A movie, a late dinner, a walk back that takes twice as long as it needs to. ${first(g)} laughs at something you didn’t know was funny.`, `You take ${first(g)} dancing. You’re bad at it. She’s kind about it.`, `Dinner, a bottle of wine you can’t afford. ${first(g)} tells you about her week. You realise you haven’t talked about anything but business in a month.`], g.id + pr.dates)];
}
export function visitKin(w: World, p: Character, k: Kin): string[] {
  const c = w.chars[k.id];
  k.lastSeen = w.now;
  k.warmth = clamp(k.warmth + 0.06);
  if (c.rank !== 'civilian') return [`You find ${first(c)} at his table and sit with him an hour. Family talk, nothing about work. That part stays outside.`];
  return [`You drop in on ${first(c)}. It’s nothing, an hour and a cup of coffee, and ${isFemale(c) ? 'she acts' : 'he acts'} as though you have crossed an ocean.`];
}

// ------------------------------------------------------------ romance, on purpose

const VENUES = ['at the counter of a bakery you pass most days', 'at a table by the window of a caffè', 'waiting for a bus on a wet evening', 'at a church social on Sunday', 'in the line for a picture house', 'behind the register of a corner shop', 'at her cousin’s wedding reception', 'dancing with her friends at a hall on a Saturday night'];
const JOBS = ['a teacher at the parish school', 'a nurse at Maimonides', 'behind the counter at her uncle’s bakery', 'a bookkeeper at a dental office', 'a seamstress in the garment district', 'a waitress who is saving for school', 'a telephone operator', 'a secretary at an insurance office', 'a hairdresser with her own chair', 'a clerk at the post office'];
export const isFemale = (c: Character) => FEMALE.includes(c.name.split(' ')[0]);
export const jobOf = (c: Character) => pick(JOBS, c.id);

// Who you might meet this week. The same people show up for a while, then the city shuffles.
export function datingPool(w: World, p: Character): NonNullable<Life['pool']> {
  const L = w.life!;
  if (L.pool && w.now - L.pool.t < 7 * DAY) return L.pool;
  const kin = new Set(L.kin.map((k) => k.id));
  const taken = new Set([L.partner?.id, L.ex].filter(Boolean) as string[]);
  const refused = (c: Character) => (p.cooldown[`askout:${c.id}`] ?? 0) > w.now;
  const free = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && isFemale(c) && !kin.has(c.id) && !taken.has(c.id) && !refused(c) && c.id !== p.id && !Object.values(w.biz).some((b) => b.ownerId === c.id));
  const near = free.filter((c) => c.district === p.district);
  const pool: { id: Id; where: string; job: string }[] = [];
  const take = (arr: Character[]) => { const c = arr.splice(w.rng.int(0, arr.length - 1), 1)[0]; if (c && !pool.some((x) => x.id === c.id)) pool.push({ id: c.id, where: pick(VENUES, c.id + w.now), job: jobOf(c) }); };
  const a = [...near], b = [...free];
  for (let i = 0; i < 2 && a.length; i++) take(a);
  while (pool.length < 3 && b.length > 0) take(b);
  while (pool.length < 3) {
    const name = `${w.rng.pick(FEMALE)} ${w.rng.pick(['Esposito', 'Conti', 'Caruso', 'Amato', 'Barone', 'Fontana', 'Greco', 'Ricci', 'Vitale', 'Lombardi', 'Moretti', 'Gallo'])}`;
    const g = spawnCivilian(w, name, w.rng.chance(0.6) ? p.district : w.rng.pick(['Little Italy', 'Bensonhurst', 'Red Hook', "Hell's Kitchen", 'The Bronx', 'Staten Island', 'Astoria']), 90);
    pool.push({ id: g.id, where: pick(VENUES, g.id), job: jobOf(g) });
  }
  L.pool = { t: w.now, list: pool };
  return L.pool;
}

export function askOut(w: World, p: Character, g: Character): { lines: string[]; minutes: number; ok: boolean } {
  const L = w.life!;
  const f = first(g);
  if (L.partner && L.partner.stage !== 'split') return { lines: ['You’ve already got somebody.'], minutes: 5, ok: false };
  const chance = clamp(0.3 + p.standing / 300 + g.traits.sociability * 0.1 + p.skills.charm * 0.25 + (p.cash > 800 ? 0.07 : 0) - (p.heat > 0.5 ? 0.1 : 0) + (rel(g, p.id).trust > 0.3 ? 0.1 : 0), 0.15, 0.85);
  p.cash -= 20;
  learnIntro(p, g, w);
  if (w.rng.chance(chance)) {
    L.partner = { id: g.id, stage: 'seeing', warmth: 0.4, dates: 1, since: w.now, lastSeen: w.now };
    delete L.pool;
    feelAtLeast(w, g, p.id, 'trust', 0.3);
    feelAtLeast(w, p, g.id, 'trust', 0.3);
    return { lines: [`You say it badly, and ${f} laughs, and then says yes. A coffee turns into a walk and the walk goes on longer than it should. She doesn’t ask what you do. You don’t say.`], minutes: 150, ok: true };
  }
  p.cooldown[`askout:${g.id}`] = w.now + 20 * DAY;
  L.pool = { t: L.pool?.t ?? w.now, list: (L.pool?.list ?? []).filter((x) => x.id !== g.id) };
  return { lines: [pick([`${f} smiles, and it’s the smile that means no. "That’s kind. I don’t think so."`, `"I don’t know you," ${f} says. "And what I do know of men like you I don’t love."`, `${f} tells you she’s spoken for. You’re not sure it’s true. It doesn’t matter.`], g.id + w.now)], minutes: 20, ok: false };
}
function learnIntro(p: Character, g: Character, w: World) { (p.intro ??= {})[g.id] = w.now; rel(p, g.id).lastMet = w.now; rel(g, p.id).lastMet = w.now; }

export interface DatePlan { code: string; label: string; cost: number; gain: number; hint: string }
export const DATES: DatePlan[] = [
  { code: 'walk', label: 'A walk and a coffee', cost: 15, gain: 0.04, hint: 'Cheap, and she likes being asked.' },
  { code: 'dinner', label: 'Dinner somewhere nice', cost: 90, gain: 0.08, hint: 'The classic.' },
  { code: 'dance', label: 'Dancing', cost: 50, gain: 0.07, hint: 'You are not good at it. She likes that.' },
  { code: 'big', label: 'A proper night out', cost: 300, gain: 0.13, hint: 'The good table, a car, flowers. She will remember it.' },
];
export function datePlan(w: World, p: Character, code: string): string[] {
  const pr = w.life?.partner;
  if (!pr || pr.stage === 'split') return ['There’s nobody to take out.'];
  const d = DATES.find((x) => x.code === code) ?? DATES[1];
  const g = w.chars[pr.id];
  if (p.cash < d.cost) return [`You can’t afford it tonight.`];
  if ((pr.lastSeen ?? 0) > w.now - 1 * DAY && d.code !== 'walk') return [`You saw ${first(g)} not long ago. Give it a day.`];
  p.cash -= d.cost;
  const hot = p.heat > 0.45;
  pr.lastSeen = w.now;
  pr.dates++;
  pr.warmth = clamp(pr.warmth + (hot ? d.gain * 0.5 : d.gain));
  p.heat = clamp(p.heat - 0.04, 0, 1.5);
  feel(w, g, p.id, 'trust', 0.02);
  if (hot) return [`You spend half of it watching the windows. ${first(g)} notices, and says nothing, and that’s worse.`];
  const line = {
    walk: [`You walk the length of the avenue and back. ${first(g)} tells you what she wants, one small thing at a time.`, `A bench, a paper bag of roasted chestnuts, nothing to prove. She leans on your arm without seeming to notice.`],
    dinner: [`Candles, a table in the back, a waiter who knows when to disappear. ${first(g)} tells you about her week and you listen to all of it.`, `The veal is good. The wine is better. She teases you until you laugh.`],
    dance: [`You take ${first(g)} dancing. You’re bad at it. She’s kind about it.`, `A hall with a band that’s too loud. She pulls you onto the floor and refuses to let go.`],
    big: [`A car at the kerb, the good table, a bunch of roses she pretends she wasn’t expecting. Around midnight ${first(g)} goes quiet and looks at you for a long time.`, `You close the place down. She takes her shoes off on the walk home and carries them.`],
  }[d.code as 'walk'] ?? ['A good evening.'];
  return [pick(line, g.id + pr.dates)];
}

// She asks for nothing. You ask.
export function askSteady(w: World, p: Character): { lines: string[]; ok: boolean } {
  const pr = w.life?.partner;
  if (!pr || pr.stage !== 'seeing') return { lines: ['It isn’t the moment.'], ok: false };
  const g = w.chars[pr.id];
  if (pr.dates < 3 || pr.warmth < 0.5) return { lines: [`${first(g)} isn’t there yet. A few more evenings, and show her you’re worth the wait.`], ok: false };
  const ok = w.rng.chance(clamp(pr.warmth + 0.1, 0.4, 0.95));
  if (ok) { pr.stage = 'steady'; pr.warmth = clamp(pr.warmth + 0.1); pr.since = w.now; return { lines: [`"Are you asking me to be your girl?" ${first(g)} says, enjoying it. "Ask properly." You do. She says yes, and people on the street smile at you for no reason.`], ok: true }; }
  pr.warmth = clamp(pr.warmth - 0.1);
  return { lines: [`${first(g)} puts her hand on your arm. "Not yet. I’m not saying never." It stings more than you expected.`], ok: false };
}
export function askMarry(w: World, p: Character): { lines: string[]; ok: boolean } {
  const pr = w.life?.partner;
  if (!pr || pr.stage !== 'steady') return { lines: ['It isn’t the moment.'], ok: false };
  const g = w.chars[pr.id];
  if (pr.dates < 8 || pr.warmth < 0.7) return { lines: [`You’re not ready, and she knows it. More time. More evenings. Let her know you’re serious.`], ok: false };
  if (p.cash < 400) return { lines: ['You can’t afford a ring that you’d be proud of.'], ok: false };
  p.cash -= 400;
  pr.stage = 'engaged'; pr.warmth = 1;
  repute(w, p, 1, 'engaged');
  return { lines: [`${g.name} says yes before you have finished the sentence. Within a week every man in the family has heard, and each of them has an opinion about the ring.`], ok: true };
}
export function wedding(w: World, p: Character): string[] {
  const pr = w.life?.partner;
  if (!pr || pr.stage !== 'engaged') return ['Not yet.'];
  const g = w.chars[pr.id];
  if (p.cash < 1500) return [`A proper wedding costs $1,500: the church, the hall, the band, and the cousins. You haven’t got it.`];
  p.cash -= 1500;
  pr.stage = 'married';
  pr.since = w.now;
  repute(w, p, 3, 'married');
  const guests = Object.values(w.chars).filter((c) => c.alive && c.familyId && c.familyId === p.familyId && (c.rels[p.id]?.trust ?? 0) > 0.25).slice(0, 12);
  for (const c of guests) { feel(w, c, p.id, 'respect', 0.03); }
  addFact(w, { kind: 'event', actor: p.id, text: `${p.name} married ${g.name}. The whole family came.`, district: p.district }, { broadcast: guests.map((c) => c.id) });
  return [`St. Anthony’s, a hall with a band, an envelope of cash from nearly every man in your family. ${g.name} is married to you by the end of the afternoon, and you don’t remember most of it. You remember her.`];
}
export function tryForBaby(w: World, p: Character): string[] {
  const pr = w.life?.partner;
  if (!pr || pr.stage !== 'married') return ['Not yet.'];
  const g = w.chars[pr.id];
  if (pr.due) return [`${first(g)} is already expecting.`];
  if (pr.tried && w.now - pr.tried < 20 * DAY) return [`There is no rush. Give it a few weeks.`];
  pr.tried = w.now;
  if (pr.warmth < 0.4) return [`${first(g)} isn’t in the mood to discuss it. Things at home have to be better first.`];
  if (w.rng.chance(clamp(0.2 + pr.warmth * 0.25, 0.2, 0.45))) {
    pr.due = w.now + 270 * DAY;
    pr.warmth = clamp(pr.warmth + 0.05);
    return [`${first(g)} tells you at breakfast, and then forgets to finish her coffee. She is going to have your baby. You sit down on the kitchen floor.`];
  }
  pr.warmth = clamp(pr.warmth + 0.03);
  return [`Nothing yet. ${first(g)} says it takes time, and kisses you, and the subject is dropped for now.`];
}
function birth(w: World, p: Character, pr: Partner) {
  delete pr.due;
  const L = w.life!;
  const boy = w.rng.chance(0.5);
  const last = p.name.split(' ').slice(-1)[0];
  const given = boy ? w.rng.pick(['Anthony', 'Vincent', 'Salvatore', 'Michael', 'Joseph', 'Dominic', 'Frank', 'Paul']) : w.rng.pick(['Angela', 'Rosa', 'Maria', 'Gina', 'Lucia', 'Sophia', 'Theresa', 'Carmela']);
  const kid = spawnCivilian(w, `${given} ${last}`, p.district, 0);
  kid.wake = 7; kid.sleep = 20;
  feelTo(kid, p.id, 'trust', 0.9); feelTo(kid, p.id, 'affection', 1); feelTo(p, kid.id, 'affection', 1); feelTo(p, kid.id, 'trust', 0.9);
  L.kin.push({ id: kid.id, role: boy ? 'son' : 'daughter', warmth: 0.9, lastSeen: w.now });
  pr.warmth = clamp(pr.warmth + 0.1);
  repute(w, p, 1, 'family');
  addFact(w, { kind: 'event', actor: p.id, minor: false, text: `${p.name} is the father of a ${boy ? 'boy' : 'girl'}: ${kid.name}.`, district: p.district }, { witnesses: [p.id] });
  w.events.push({ id: 'ev' + w.nextId++, kind: 'christening', t: w.now + 30 * DAY, host: p.id, about: kid.id, place: 'Our Lady of Pity', invited: [] });
  addEnc(w, { kind: 'kin', from: kid.id, title: 'A new arrival', days: 5, lines: [`${w.chars[pr.id].name} puts a small shape in your arms. ${kid.name.split(' ')[0]}. ${boy ? 'He' : 'She'} has your father’s hands.`, `You have never been this frightened. Everything you do from here on has an extra name on it.`], opts: [{ code: 'go', label: 'Hold ' + (boy ? 'him' : 'her') + ' a while', hint: 'Nobody will call you here.' }], data: { what: 'birth' } });
}
// The christening of your own child: the whole family counts who comes and what you spend.
export function christeningDue(w: World, p: Character) {
  for (const ev of w.events) {
    if (ev.kind !== 'christening' || ev.host !== p.id || ev.done || w.now < ev.t - 3 * DAY || ev.invited.includes('asked')) continue;
    ev.invited.push('asked');
    const kid = ev.about ? w.chars[ev.about] : undefined;
    if (!kid?.alive) { ev.done = true; continue; }
    addEnc(w, {
      kind: 'kin', from: kid.id, title: `${first(kid)}’s christening`, days: 6,
      lines: [`The priest has a date, and your mother has opinions about the guest list.`, `A christening is a statement. Every man in the family will notice how big a room you can fill.`],
      opts: [
        { code: 'grand', label: 'A proper party: $900', hint: 'The whole family. Respect is earned in a room like that.' },
        { code: 'modest', label: 'Keep it modest: $250', hint: 'Family and a few friends.' },
        { code: 'quiet', label: 'Just the priest', hint: 'Nobody will say anything. Everybody will notice.' },
      ],
      data: { what: 'christening', ev: ev.id },
    });
  }
}
export function breakOff(w: World, p: Character): string[] {
  const L = w.life!; const pr = L.partner;
  if (!pr || pr.stage === 'split' || pr.stage === 'married') return ['There’s no easy way to do that.'];
  const g = w.chars[pr.id];
  pr.stage = 'split'; L.ex = pr.id;
  return [`You tell ${first(g)} it isn’t working. She nods before you’ve finished, and you realise she saw it coming for a while.`];
}
