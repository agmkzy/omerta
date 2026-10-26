import { move, openAsk } from './asks';
import { agendaChoose } from './powers2';
import { goalChoose, joinChoose } from './goals';
import { sitChoose75 } from './situ';
import { sitChoose } from './situations';
import { pulseChoose } from './pulse';
// The crew as people: what each man wants, who he likes and who he doesn't, and what he asks of you.
// None of it is shown until you work it out. Most of it comes out on a Sunday.
import { addFact, bear, bearOn, clamp, compat, createDebt, feel, feelAtLeast, feelOn, money, rel } from './core';
import { addEnc, addFavour } from './encounters';
import { authorityWeek, quarrel } from './authority';
import { Character, DAY, Enc, Id, World } from './types';
import { arch, pick } from './voice';

type Want = NonNullable<Character['want']>['kind'];
const PL = (w: World) => w.chars[w.playerId!];
const first = (c: Character) => c.name.split(' ')[0];
export const crewOf = (w: World, p: Character) => Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.id !== p.id);
// Sunday comes in order: a man with a crew takes his men's envelopes at the club first, and only then hands his own up. Until he has
// sat down with them this week, his own envelope waits (it is recorded in the world, so it holds across a reload).
export const crewEnvelopesWaiting = (w: World, p: Character) => !!w.sunday && !w.sunday.seen && crewOf(w, p).length > 0;

export const WANT_LINE: Record<Want, (c: Character) => string> = {
  made: (c) => `${first(c)} wants to be made. Everything he does is aimed at it.`,
  gamble: (c) => `${first(c)} wants a gambling operation of his own.`,
  independent: (c) => `${first(c)} wants out from under anyone. He wants his own money and nobody’s hand on it.`,
  lieutenant: (c) => `${first(c)} wants to be your right hand, and he’s watching who stands closer to you.`,
  rich: (c) => `${first(c)} just wants to be rich, and he doesn’t much care how.`,
  respect: (c) => `${first(c)} wants respect. Money’s second.`,
};
export const WANT_SHORT: Record<Want, string> = { made: 'wants to be made', gamble: 'wants his own book', independent: 'wants his independence', lieutenant: 'wants to be your right hand', rich: 'wants to be rich', respect: 'wants respect' };

export function wantFor(c: Character): Want {
  const T = c.traits;
  if (c.rank === 'associate' && T.ambition > 0.6) return 'made';
  if (T.vice > 0.55 && T.greed > 0.45) return 'gamble';
  if (T.ambition > 0.55 && T.caution < 0.5) return 'independent';
  if (T.sociability > 0.55) return 'lieutenant';
  if (T.greed > 0.55) return 'rich';
  return 'respect';
}
export const knows = (p: Character, id: Id, tag: string) => !!p.insight?.[id]?.includes(tag);
export function learnAbout(p: Character, id: Id, tag: string) { const l = ((p.insight ??= {})[id] ??= []); if (!l.includes(tag)) l.push(tag); }

const NICKS: [(c: Character) => boolean, string[]][] = [
  [(c) => c.traits.violence > 0.8, ['the Hammer', 'Knuckles', 'the Bull', 'Two-Ton']],
  [(c) => c.traits.greed > 0.85, ['Penny', 'the Accountant', 'Pockets']],
  [(c) => c.traits.caution > 0.78, ['the Mouse', 'Slow Joe', 'the Owl']],
  [(c) => c.traits.courage < 0.3, ['the Sheep', 'Pigeon']],
  [(c) => c.traits.sociability > 0.85, ['the Mayor', 'Sunday', 'Smiley']],
  [(c) => c.traits.vice > 0.85, ['Lucky', 'Eight-Ball', 'Dice']],
];

// ---------------------------------------------------------------- weekly
export function crewTick(w: World) {
  const p = PL(w);
  if (!p?.alive) return;
  const rng = w.rng;
  const crew = crewOf(w, p).filter((c) => c.rank !== 'civilian');
  const tells: NonNullable<World['sunday']>['tells'] = [];
  // everyone with a reason to want something does
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || c.rank === 'civilian') continue;
    c.want ??= { kind: wantFor(c), since: w.now };
    // wants change: the made man wants the next thing
    if (c.want.kind === 'made' && c.rank !== 'associate') c.want = { kind: c.traits.ambition > 0.6 ? 'independent' : 'respect', since: w.now };
    if (!c.nick && c.rank !== 'associate' && rng.chance(0.004)) {
      const opt = NICKS.find(([f]) => f(c));
      if (opt) { c.nick = pick(opt[1], c.id); addFact(w, { kind: 'rumour', actor: c.id, minor: true, text: `People have started calling ${c.name} “${c.nick}”.`, district: c.district }, { witnesses: [] }); }
    }
  }
  const ok = crew.filter((c) => c.jailedUntil <= w.now);
  // friendships and fallings-out, between the men you answer for. One thing at most, now and then, never the same pair twice in a while.
  if (ok.length >= 2 && (p.cooldown.crewTie ?? 0) <= w.now && rng.chance(0.3)) {
    const pairs: [Character, Character][] = [];
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) if ((ok[i].cooldown[`pair:${ok[j].id}`] ?? 0) <= w.now) pairs.push([ok[i], ok[j]]);
    if (pairs.length) {
      const [a, b] = rng.pick(pairs);
      p.cooldown.crewTie = w.now + 18 * DAY;
      a.cooldown[`pair:${b.id}`] = w.now + 70 * DAY;
      const ra = rel(a, b.id), rb = rel(b, a.id);
      const gr = a.traits.greed + b.traits.greed;
      const roll = rng.next();
      // (who becomes friends and who falls out is how they get on, core.compat, not a throw of the dice)
      const k = compat(w, a, b);
      const bad = k < -0.05;
      if (roll < 0.45 && k > 0.25) {
        feelOn(w, ra, 'trust', 0.2, `getting on with ${b.name}`); feelOn(w, rb, 'trust', 0.2, `getting on with ${a.name}`);
        tells.push({ who: a.id, text: pick([`${first(a)} says he and ${first(b)} have been spending more time together. Good. A man should have a friend.`, `${first(a)} and ${first(b)} were seen at the same table twice this week, and neither looked like he was being made to.`, `${first(b)} has started sending ${first(a)} the work he can’t get to. They seem to like each other.`], a.id + w.now), learn: `tie:${b.id}` });
      } else if (roll < 0.62 && bad) {
        bearOn(w, ra, 0.25, `${b.name} rubs him the wrong way`); bearOn(w, rb, 0.25, `${a.name} rubs him the wrong way`);
        a.cooldown.friction = w.now + 14 * DAY; b.cooldown.friction = w.now + 14 * DAY;
        const about = (['money', 'words', 'credit'] as const)[[...(a.id + b.id + w.now)].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 3];
        addFact(w, { kind: 'trouble', actor: a.id, victim: b.id, minor: true, text: about === 'money' ? `${a.name} and ${b.name} had words over money.` : about === 'words' ? `${a.name} and ${b.name} stopped speaking after an argument nobody will repeat.` : `${a.name} thinks ${b.name} got credit he didn’t earn.`, district: a.district }, { witnesses: [p.id] });
        // (it comes to the man they both answer to, to settle: authority.ts)
        if (!quarrel(w, p, a, b, about)) tells.push({ who: b.id, text: `${first(b)} isn’t saying much about ${first(a)}. Whatever it was, it isn’t finished.`, learn: `rival:${a.id}` });
      } else if (roll < 0.82 && gr > 0.9) {
        const borrower = a.cash < b.cash ? a : b, lender = borrower === a ? b : a;
        if (lender.cash > 400 && !w.debts.some((d) => d.status === 'active' && d.debtor === borrower.id && d.creditor === lender.id)) {
          // (between friends, on a friend's terms, and the other man takes it or not: asks 'lend', the one way a loan is made)
          const o = openAsk(w, 'lend', lender, borrower, { amt: rng.pick([200, 300, 500]), rate: 0.03, why: `${lender.name} offered ${borrower.name} a loan` });
          if (o && move(w, o, 'ask').answer === 'yes') tells.push({ who: lender.id, text: `${first(lender)} mentions, as if it were nothing, that ${first(borrower)} owes him a few hundred.`, learn: `loan:${borrower.id}` });
        }
      } else {
        a.books.side = (a.books.side ?? 0) + 60; b.books.side = (b.books.side ?? 0) + 60;
        tells.push({ who: a.id, text: `${first(a)} and ${first(b)} have a little arrangement going. They didn’t say what. They’re both slightly richer.`, learn: `tie:${b.id}` });
      }
    }
  }
  // what they want shapes what they do
  for (const c of ok) {
    const k = c.want?.kind;
    if (k === 'made' && rng.chance(0.07)) {
      c.traits.courage = clamp(c.traits.courage + 0.01);
      tells.push({ who: c.id, text: `${first(c)} keeps asking for the dangerous work. He says he’s bored. He isn’t bored.`, learn: 'want' });
    }
    if (k === 'lieutenant' && p.rep?.favoured && p.rep.favoured !== c.id && rng.chance(0.2)) {
      feel(w, c, p.id, 'trust', -0.04);
      tells.push({ who: c.id, text: `${first(c)} says nothing about the way you’ve been treating ${first(w.chars[p.rep.favoured])}. He says it very quietly.`, learn: 'want' });
    }
    if (k === 'gamble' && rng.chance(0.05) && !w.enc.some((e) => e.kind === 'crew' && e.status === 'open')) askInvest(w, p, c);
    if (k === 'independent') {
      const t = rel(c, p.id).trust;
      c.cooldown.restless = (c.cooldown.restless ?? 0) + (t < 0.45 ? 1 : -1);
      if (c.cooldown.restless < 0) c.cooldown.restless = 0;
      if (c.cooldown.restless >= 3 && c.cooldown.restless < 9 && rng.chance(0.35)) tells.push({ who: c.id, text: `${first(c)} has been asking what a man in your position gets for himself. He’s starting to ask it more pointedly.`, learn: 'leaving' });
      if (c.cooldown.restless >= 12) { // he goes over your head
        const up = p.bossId ? w.chars[p.bossId] : undefined;
        if (up?.alive) { c.bossId = up.id; c.cooldown.restless = 0; feel(w, c, p.id, 'trust', -0.2); addFact(w, { kind: 'report', actor: c.id, victim: p.id, minor: false, text: `${c.name} has gone to ${up.name} and asked to answer to him directly instead of ${p.name}.`, district: c.district }, { witnesses: [p.id, up.id] }); }
      }
    }
    if (k === 'rich' && c.traits.greed > 0.7) c.traits.greed = clamp(c.traits.greed + 0.002);
  }
  // somebody asks you for something
  favourRequest(w, p, ok);
  // men who come to him, and what he answers for upstairs
  authorityWeek(w, p);
  // keep only a couple of tells for Sunday
  w.sunday = { t: w.now, tells: tells.sort(() => rng.next() - 0.5).slice(0, 2), seen: false };
}

// ---------------------------------------------------------------- Sunday
export function openSunday(w: World, p: Character): string[] {
  const s = w.sunday;
  if (!s || s.seen) return [];
  s.seen = true;
  const out: string[] = [];
  for (const t of s.tells) { out.push(t.text); if (t.learn) learnAbout(p, t.who, t.learn); }
  return out;
}

// ---------------------------------------------------------------- asks
function askInvest(w: World, p: Character, c: Character) {
  const amt = w.rng.pick([400, 600, 800]);
  addEnc(w, {
    kind: 'crew', from: c.id, title: `${first(c)} has a proposition`, days: 7,
    lines: [`${c.name} catches you at the club.`, `"I have an idea. A little book on the numbers on Seventh Avenue. I need ${money(amt)} to start it. You get a share. Nobody has to know where it came from."`],
    opts: [{ code: 'yes', label: `Put up ${money(amt)}`, hint: 'He’ll owe you, and it might make money.' }, { code: 'half', label: 'Give him half and tell him to prove it', hint: 'Cautious.' }, { code: 'no', label: 'Tell him no', hint: 'He’ll remember it.' }, { code: 'think', label: 'Tell him you’ll think about it', hint: 'Fine, for a week. Not forever.' }],
    data: { what: 'invest', amt },
  });
}
const REQS = ['money', 'intro', 'recommend', 'goodword'] as const;
function favourRequest(w: World, p: Character, crew: Character[]) {
  const rng = w.rng;
  if (!rng.chance(0.08) || (p.cooldown.favReq ?? 0) > w.now || w.enc.some((e) => e.kind === 'crew' && e.status === 'open')) return;
  p.cooldown.favReq = w.now + 12 * DAY;
  const pool = [...crew, ...Object.values(w.chars).filter((c) => c.alive && c.rank !== 'civilian' && c.id !== p.id && (c.rels[p.id]?.trust ?? 0) > 0.3 && c.familyId === p.familyId)];
  if (!pool.length) return;
  const c = rng.pick(pool);
  const kind = rng.pick([...REQS]);
  const f = first(c);
  if (kind === 'money') {
    const amt = rng.pick([300, 500, 800]);
    const who = rng.pick(['brother', 'brother-in-law', 'mother', 'cousin']);
    addEnc(w, { kind: 'crew', from: c.id, title: `${f} needs ${money(amt)}`, days: 7, lines: [`${c.name} takes you aside.`, `"My ${who} is in trouble. ${money(amt)} would fix it. I’ll pay you back. I wouldn’t ask if there was anyone else."`], opts: [{ code: 'give', label: `Give it to him: ${money(amt)}`, hint: 'A man who’s helped doesn’t forget.' }, { code: 'lend', label: 'Lend it, with terms', hint: 'Business, but friendly.' }, { code: 'no', label: 'Turn him down', hint: 'He’ll understand. Probably.' }, { code: 'think', label: 'Say you’ll see', hint: 'He can’t wait forever.' }], data: { what: 'money', amt } });
  } else if (kind === 'intro') {
    const target = rng.pick(Object.values(w.chars).filter((x) => x.alive && x.rank === 'soldier' && x.id !== c.id));
    if (!target) return;
    addEnc(w, { kind: 'crew', from: c.id, about: target.id, title: `${f} wants an introduction`, days: 7, lines: [`${c.name} has a favour to ask.`, `"There’s a man I need to meet. ${target.name}. I can’t just walk up to him. If you made the introduction, I’d be grateful."`], opts: [{ code: 'intro', label: `Introduce him to ${first(target)}`, hint: 'Your name goes with his.' }, { code: 'no', label: 'Say it isn’t your place', hint: 'He’ll find another way.' }, { code: 'think', label: 'Say you’ll see', hint: '' }], data: { what: 'intro' } });
  } else if (kind === 'recommend' && c.rank === 'associate' && c.bossId === p.id && ['soldier', 'capo', 'underboss', 'boss'].includes(p.rank)) {
    addEnc(w, { kind: 'crew', from: c.id, title: `${f} wants a chance`, days: 7, lines: [`${c.name} waits until the others have left.`, `"I’ve done what you’ve asked. I’d like you to put my name forward. I want to be someone."`], opts: [{ code: 'yes', label: 'Put his name forward', hint: 'Your name goes with his.' }, { code: 'later', label: 'Tell him to keep earning', hint: 'Fair. He’ll wait.' }, { code: 'no', label: 'Tell him he isn’t ready', hint: 'True or not, it stings.' }], data: { what: 'recommend' } });
  } else if (kind === 'goodword' && c.rank === 'soldier' && p.bossId) {
    const cap = w.chars[p.bossId];
    addEnc(w, { kind: 'crew', from: c.id, about: cap.id, title: `${f} asks for a word`, days: 7, lines: [`${c.name} approaches you as you’re leaving.`, `"You’re close to ${cap.name}. Could you put in a good word for me?"`], opts: [{ code: 'yes', label: `Say something to ${first(cap)}`, hint: 'It costs a little of your credit.' }, { code: 'no', label: 'Say you can’t', hint: 'He’ll keep his opinion of you.' }, { code: 'think', label: 'Say you’ll see', hint: '' }], data: { what: 'goodword' } });
  }
}

export function crewChoose(w: World, p: Character, e: Enc, code: string): string[] {
  {
    const ag = sitChoose75(w, p, e, code) ?? goalChoose(w, p, e, code) ?? joinChoose(w, p, e, code) ?? agendaChoose(w, p, e, code) ?? sitChoose(w, p, e, code) ?? pulseChoose(w, p, e, code);
    if (ag) {
      // A refusal ("you haven't got it") leaves the choice open; anything else settles it, and the screen shows the outcome only.
      if (e.data?.hold) return ag;
      if (!ag.some((l) => /haven’t got|can’t afford|can’t cover|not enough/i.test(l))) e.status = 'done';
      return ag;
    }
  }
  const c = e.from ? w.chars[e.from] : undefined;
  const lines: string[] = [];
  const r = p.rep ??= { kept: 0, broken: 0, asked: 0, ignored: 0, favoured: null };
  if (!c) return ['It has gone quiet.'];
  const f = first(c);
  r.asked++;
  const what = String(e.data?.what);
  if (code === 'think') { e.data = { ...(e.data ?? {}), delayed: 1 }; e.status = 'open'; e.expires = Math.max(e.expires, w.now + 5 * DAY); feel(w, c, p.id, 'respect', -0.01); return [`${f} nods. "Sure. Take your time." He doesn’t sound like he’s got much.`]; }
  const rc = rel(c, p.id);
  if (what === 'invest') {
    const amt = Number(e.data?.amt);
    if (code === 'no') { feelOn(w, rc, 'respect', -0.04); feelOn(w, rc, 'trust', -0.03); r.broken += 0; lines.push(`${f} nods slowly. "All right." You’ve told him what you think of his idea. You’ve told him what you think of him too.`); }
    else {
      const put = code === 'half' ? amt / 2 : amt;
      if (p.cash < put) return ['You haven’t got it to give.'];
      p.cash -= put; c.cash += put; c.books.side = (c.books.side ?? 0) + Math.round(put / 6);
      addFavour(w, p.id, c.id, put >= 600 ? 3 : 2, 'the money to start his own book');
      feelOn(w, rc, 'trust', 0.12); feelOn(w, rc, 'affection', 0.05); r.kept++;
      learnAbout(p, c.id, 'want');
      lines.push(`${f} grips your hand. "I won’t forget this." He means it. He also means to be your equal one day.`);
    }
  } else if (what === 'money') {
    const amt = Number(e.data?.amt);
    if (code === 'no') { feelOn(w, rc, 'respect', -0.03); feelOn(w, rc, 'trust', -0.04); lines.push(`${f} says he understands. He’ll remember that you did.`); r.broken += 0; }
    else if (code === 'lend') { if (p.cash < amt) return ['You haven’t got it.']; p.cash -= amt; c.cash += amt; createDebt(w, p.id, c.id, amt, 0.02, 'a favour, with terms'); feelOn(w, rc, 'trust', 0.07); r.kept++; lines.push(`${f} takes it, grateful and slightly insulted that there are terms. It’s fair. He knows it.`); }
    else { if (p.cash < amt) return ['You haven’t got it.']; p.cash -= amt; c.cash += amt; addFavour(w, p.id, c.id, amt >= 800 ? 3 : 2, `${money(amt)} when he needed it`); feelOn(w, rc, 'trust', 0.14); feelOn(w, rc, 'affection', 0.08); r.kept++; lines.push(`${f} doesn’t say anything for a second. "I owe you for this." Those aren’t words he says to many men.`); }
  } else if (what === 'intro') {
    const t = e.about ? w.chars[e.about] : undefined;
    if (code === 'intro' && t) { feelAtLeast(w, c, t.id, 'trust', 0.25); feelAtLeast(w, t, c.id, 'trust', 0.25); (c.intro ??= {})[t.id] = w.now; addFavour(w, c.id, p.id, 1, `the introduction to ${t.name}`); feel(w, t, p.id, 'respect', -((c.traits.violence > 0.7 ? 0.02 : 0))); feelOn(w, rc, 'trust', 0.08); r.kept++; lines.push(`You walk ${f} over and say his name to ${t.name}. Nothing else is needed. ${f} won’t forget who opened the door.`); }
    else { feelOn(w, rc, 'respect', -0.02); lines.push(`${f} thanks you for being honest. He’ll find another door.`); }
  } else if (what === 'recommend') {
    if (code === 'yes') { c.backer = p.id; feelOn(w, rc, 'trust', 0.15); feelOn(w, rc, 'affection', 0.1); r.kept++; learnAbout(p, c.id, 'want'); lines.push(`"You won’t regret it," ${f} says. You might. Your name is on him now.`); }
    else if (code === 'later') { feelOn(w, rc, 'trust', 0.01); lines.push(`${f} nods. "Then I’ll earn it." He sounds like he means it.`); }
    else { feelOn(w, rc, 'respect', -0.06); feelOn(w, rc, 'trust', -0.06); if (c.traits.ambition > 0.6) c.cooldown.restless = (c.cooldown.restless ?? 0) + 2; lines.push(`${f}’s face doesn’t move. He thanks you for your time, and goes. Ambitious men don’t forget a no.`); }
  } else if (what === 'goodword') {
    const cap = e.about ? w.chars[e.about] : undefined;
    if (code === 'yes' && cap) { feel(w, cap, c.id, 'respect', 0.07); feel(w, cap, p.id, 'respect', -0.01); feelOn(w, rc, 'trust', 0.1); addFavour(w, c.id, p.id, 1, `a good word with ${cap.name}`); r.kept++; lines.push(`You mention ${f} to ${cap.name}, casually, the way it works. ${cap.name} files it away. So does ${f}.`); }
    else { feelOn(w, rc, 'respect', -0.02); lines.push(`${f} nods. "Sure. I understand." He doesn’t.`); }
  }
  p.rep!.favoured = code === 'no' || code === 'later' ? r.favoured : c.id;
  e.status = 'done';
  return lines;
}

// Nobody answered: the ask lapses. Called each week.
export function lapsedAsks(w: World) {
  const p = PL(w);
  if (!p) return;
  const r = (p.rep ??= { kept: 0, broken: 0, asked: 0, ignored: 0, favoured: null });
  for (const e of w.enc) {
    if (e.kind !== 'crew' || e.status !== 'lapsed' || e.data?.done || !e.from) continue;
    e.data = { ...(e.data ?? {}), done: 1 };
    const c = w.chars[e.from];
    if (!c?.alive) continue;
    r.ignored++; r.broken++;
    feel(w, c, p.id, 'trust', -0.07);
    feel(w, c, p.id, 'respect', -0.06);
    if (arch(c) === 'proud') bear(w, c, p.id, 0.08, `${p.name} broke his word to him`);
  }
}

// ---------------------------------------------------------------- what they say about you
export interface Reputation { earner: number; word: number; feared: number; loyal: number }
export function reputationOf(w: World, p: Character): Reputation {
  const facts = Object.values(w.facts).filter((f) => f.actor === p.id);
  const paid = facts.filter((f) => f.kind === 'debt_paid').length;
  const missed = facts.filter((f) => f.kind === 'debt_missed' || f.kind === 'debt_default').length;
  const r = p.rep ?? { kept: 0, broken: 0, asked: 0, ignored: 0, favoured: null };
  const kept = r.kept + paid + (p.books.honest > 3 ? 2 : 0), broken = r.broken + missed + p.books.missed;
  const word = (kept + 1) / (kept + broken + 2);
  const earner = clamp(p.lifetimeKick / 4000, 0, 1);
  const violent = facts.filter((f) => f.kind === 'beating' || f.kind === 'murder').length;
  return { earner, word, feared: clamp(violent / 4, 0, 1), loyal: clamp(0.5 + (p.books.honest - p.books.missed) * 0.05, 0, 1) };
}
export function repLines(w: World, p: Character): string[] {
  const r = reputationOf(w, p);
  const n = p.name.split(' ')[0];
  const out: string[] = [];
  if (r.earner > 0.55 && r.word < 0.45) out.push(`“${n}’s a good earner. But don’t lend him anything.”`);
  else if (r.earner > 0.55) out.push(`“${n}? Always has an envelope on Sunday.”`);
  else if (r.earner < 0.2) out.push(`“${n}? Still proving himself.”`);
  if (r.word > 0.7) out.push(`“If ${n} says it, it’s done.”`);
  else if (r.word < 0.4) out.push(`“I wouldn’t take ${n}’s word to the bank.”`);
  if (r.feared > 0.5) out.push(`“People walk around ${n}. He’s quick with his hands.”`);
  if (r.loyal > 0.7) out.push(`“${n} knows who he answers to.”`);
  else if (r.loyal < 0.3) out.push(`“${n} shorts his boss sometimes. People notice.”`);
  return out.length ? out : [`“${n}? I don’t know enough to say.”`];
}
