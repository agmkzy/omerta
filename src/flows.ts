// Conversations about standing, pressure and the crew: being backed, being promoted, leaning on a man, a rival's ear, taking a man on,
// orders that meet resistance, and the lead-up to a sit-down. Each one is a short negotiation: he answers from his own position, you
// choose how to respond, and the result goes through the records that already exist (favours, memos, facts, relationships, tension).
import { temper, viewOf } from './temper';
import type { Convo, FollowOpt, Said } from './dialogue';
import { readiness } from './career';
import { addFact, clamp, learn, money, rel } from './core';
import { addFavour } from './encounters';
import { RECRUIT_COST } from './orders';
import { amendsAsk, askBetween, openAsk, playerMove, playerMoves, type AskMove } from './asks';
import { arch } from './voice';
import { standingWord } from './jobs';
import { PROBLEM_LABEL } from './people';
import { Character, DAY, Id, Situation, World } from './types';
import type { Arch } from './voice';

type Pool = Partial<Record<Arch, string[]>> & { _: string[] };
const RANKS = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const rk = (c: Character) => RANKS.indexOf(c.rank);

// How the two of you stand: who has the say.
export type Stance = 'over' | 'under' | 'peer' | 'rival' | 'outside';
export function stanceOf(w: World, p: Character, t: Character): Stance {
  if (t.rank === 'civilian') return 'outside';
  if (p.familyId && t.familyId && p.familyId !== t.familyId) return 'rival';
  const chain = (x: Character) => { const out = new Set<Id>(); let q: Character | undefined = x; for (let i = 0; i < 6 && q?.bossId; i++) { out.add(q.bossId); q = w.chars[q.bossId]; } return out; };
  if (chain(t).has(p.id) || rk(p) > rk(t)) return 'over';
  if (chain(p).has(t.id) || rk(t) > rk(p)) return 'under';
  return 'peer';
}

export const FLOW_BASE = new Set(['word_make', 'rk_back', 'rk_back_ask', 'promo', 'cr_thin', 'rv_ears', 'rv_warn', 'recruit_offer', 'assign_low', 'assign_hustle', 'fl']);
const pick = (w: World, t: Character, pool: Pool) => w.rng.pick(pool[arch(t)] ?? pool._);
const said = (lines: string[], c: Convo, follow: FollowOpt[] | undefined, minutes: number): Said => {
  c.ctx.follow = follow;
  return { lines, minutes, convo: { id: c.id, node: follow?.length ? 'follow' : 'root', ctx: c.ctx } };
};
const memoOnce = (t: Character, p: Character, w: World, kind: 'agreement' | 'threat' | 'favour', text: string, due?: number) => {
  if (t.memos.some((m) => m.other === p.id && !m.done && m.text === text)) return;
  t.memos.push({ id: 'm' + w.nextId++, t: w.now, other: p.id, kind, text, ...(due ? { due } : {}) });
};
const D = (w: World) => Math.floor(w.now / 1440);
// V89: what you can do next in a matter you have just raised with him, as the conversation's next choices (the same moves as anywhere)
const movesOf = (w: World, p: Character, s: Situation): FollowOpt[] | undefined => { const m = playerMoves(w, p, s).filter((x) => !x.off); return m.length ? m.map((x) => ({ code: `mv:${s.id}:${x.move}`, label: x.label, hint: x.hint, big: ['take', 'sweeten', 'pressure'].includes(x.move) })) : undefined; };
const stamp = (t: Character, key: string, w: World) => { (t.talk ??= {})[key] = { d: D(w), sig: 'x', n: 1 }; };
const recent = (t: Character, key: string, w: World, days: number) => { const m = t.talk?.[key]; return !!m && D(w) - m.d <= days; };

export function flow(w: World, p: Character, t: Character, c: Convo, code: string): Said | null {
  const [c0, arg] = code.split(':');
  if (!FLOW_BASE.has(c0)) return null;
  const r = rel(t, p.id);
  const st = stanceOf(w, p, t);
  const lines: string[] = [];
  const tweak = (trust: number, aff = 0, resp = 0) => { r.trust = clamp(r.trust + trust); r.affection = clamp(r.affection + aff); r.respect = clamp(r.respect + resp); };
  const drop: FollowOpt = { code: 'fl:drop', label: '“Let’s leave it there.”' };

  // ------------------------------------------------------------------ a promise you did not keep
  if (c0 === 'word_make') {
    const f0 = brokenWord(w, p, t);
    if (!f0) { lines.push('“It’s done with. Let it be.”'); return said(lines, c, undefined, 3); }
    lines.push(pick(w, t, { hothead: [`“You said you would. You didn’t. Talk is cheap, ${p.name.split(' ').slice(1).join(' ') || p.name}.”`], proud: ['“I don’t forget when a man gives his word and sits on it.”'], _: ['“You told me you’d see to it. Then nothing. I noticed.”'] }));
    // V89: making it right is a matter between you (asks.ts 'amends'): own up, put money with it, tell him why; he may accept,
    // name what it would take and why, or turn you away, and you can come back to it.
    const s = askBetween(w, 'amends', p.id, t.id) ?? amendsAsk(w, p, t, { word: f0.id, why: `${p.name} came to make it right with ${t.name}` });
    return said(lines, c, s ? movesOf(w, p, s) : undefined, 15);
  }
  // (the V85 follow-ups, kept so an old conversation still answers: they are moves in the same matter now)
  if (c0 === 'fl' && (arg === 'word_pay' || arg === 'word_explain')) {
    const f0 = brokenWord(w, p, t);
    const s = f0 ? askBetween(w, 'amends', p.id, t.id) ?? amendsAsk(w, p, t, { word: f0.id }) : undefined;
    if (!s) { lines.push('“Already settled.”'); return said(lines, c, undefined, 3); }
    lines.push(...playerMove(w, p, s.id, arg === 'word_pay' ? 'sweeten' : 'persuade').lines);
    return said(lines, c, undefined, 15);
  }

  // ------------------------------------------------------------------ being backed
  if (c0 === 'rk_back_ask') {
    lines.push(r.trust >= 0.7 ? '“I told them you’re solid. Don’t make a liar of me.”' : '“I said you’re coming along. That’s all I’ve said, and all I’ll say.”');
    return { lines, minutes: 10, convo: { id: c.id, node: 'root', ctx: c.ctx } };
  }
  if (c0 === 'rk_back') {
    if (p.backer === t.id) { lines.push('“I’m already speaking for you. Don’t ask twice.”'); return said(lines, c, undefined, 5); }
    if (recent(t, 'rk_back_no', w, 5) && !(r.trust >= 0.5 && r.respect >= 0.35)) { lines.push('“I gave you my answer. Nothing’s changed since.”'); return said(lines, c, undefined, 5); }
    const trustOk = r.trust >= 0.5, respectOk = r.respect >= 0.35;
    c.ctx.deal = { kind: 'back', ask: 0 };
    // A favour he owes you is the best reason there is: he can repay it with his word, and you owe him nothing for it.
    const owedFav = w.favours.find((q) => !q.settled && q.from === p.id && q.to === t.id);
    if (owedFav && r.respect >= 0.3) {
      lines.push(pick(w, t, { proud: ['“You got Nicky out when you didn’t have to. I keep my debts. My name is yours, once.”'], hothead: ['“You did right by me. I don’t forget. Fine. I’ll say your name.”'], _: ['“I owe you. This is a fair way to square it. I’ll speak for you.”'] }));
      return said(lines, c, [
        { code: 'fl:back_call', label: '“You owe me one. I’m calling it in.”', hint: 'He speaks for you and the debt is cleared. You can only spend it once.', big: true },
        ...(trustOk && respectOk ? [{ code: 'fl:back_take', label: '“Keep it. I’ll owe you one instead.”', hint: 'He speaks for you. You owe him, and he still owes you.' } as FollowOpt] : []),
        drop,
      ], 15);
    }
    if (!trustOk || !respectOk) {
      lines.push(!trustOk
        ? pick(w, t, { cold: ['“I don’t put my name on men I haven’t watched. I haven’t watched you.”'], proud: ['“My name is worth something. I don’t spend it on a man I barely know.”'], frightened: ['“If it goes wrong, it goes wrong on me. I can’t. Not yet.”'], _: ['“I don’t know you well enough to put my name on you. Come back when I do.”'] })
        : pick(w, t, { cold: ['“I like you fine. But nobody I’d say your name to would take it seriously yet.”'], _: ['“It isn’t that I don’t trust you. It’s that you haven’t been seen doing much yet.”', '“People don’t know what you’re worth. Make them know, then ask me.”'] }));
      stamp(t, 'rk_back_no', w);
      return said(lines, c, [{ code: 'fl:back_what', label: '“What would you need to see from me?”' }, drop], 15);
    }
    lines.push(pick(w, t, {
      proud: ['“I’ll say your name when it matters. A man who speaks for another is owed for it, though. You’ll understand that.”'],
      cold: ['“I can do it. It puts you in my pocket a little. That’s how it works.”'],
      jovial: ['“Sure, I’ll put in a word. Don’t forget who did, that’s all.”'],
      _: ['“I’ll speak for you. But if I put my name on you, you owe me. Fair?”'],
    }));
    return said(lines, c, [
      { code: 'fl:back_take', label: '“All right. I’ll owe you one.”', hint: 'He speaks for you. You owe him a favour, and he can call it in.', big: true },
      { code: 'fl:back_press', label: '“I’d rather not owe anybody.”', hint: 'He may do it for less. He may not like being haggled with.' },
      drop,
    ], 20);
  }
  if (c0 === 'fl' && arg === 'back_what') {
    const why = r.trust < 0.5 ? '“Let me see you pay on time, do what you say you’ll do, and not give me a reason to worry. A few weeks of that.”' : '“Do something people notice. Stand up for someone, or come through on a job. Then I’ll have something to say.”';
    lines.push(why);
    memoOnce(t, p, w, 'agreement', r.trust < 0.5 ? 'He wants to see you reliable before he’ll speak for you.' : 'He wants to see you make a name for yourself before he’ll speak for you.');
    return said(lines, c, undefined, 10);
  }
  if (c0 === 'fl' && arg === 'back_call') {
    const owedFav = w.favours.find((q) => !q.settled && q.from === p.id && q.to === t.id);
    if (!owedFav) { lines.push('“There’s nothing outstanding between us.”'); return said(lines, c, undefined, 3); }
    owedFav.settled = true; p.backer = t.id;
    memoOnce(t, p, w, 'agreement', 'He repaid what he owed you by agreeing to speak for you.');
    tweak(0.02, 0, 0.04);
    lines.push('“Done. We’re square, and I’ll say your name when it matters.”');
    return said(lines, c, undefined, 15);
  }
  if (c0 === 'fl' && arg === 'back_take') {
    p.backer = t.id;
    addFavour(w, t.id, p.id, 2, 'agreed to speak for you');
    memoOnce(t, p, w, 'favour', 'He agreed to speak for you. He’ll want something back one day.');
    tweak(0.03, 0, 0.03);
    lines.push('“Done. I’ll say your name when it matters. If you shame me, I’ll say that too.”');
    return said(lines, c, undefined, 15);
  }
  if (c0 === 'fl' && arg === 'back_press') {
    const ok = w.rng.chance(clamp(0.2 + (r.respect - 0.35) * 0.9 + (r.trust - 0.5) * 0.4 + p.standing / 400, 0.1, 0.8));
    if (ok) {
      p.backer = t.id;
      addFavour(w, t.id, p.id, 1, 'agreed to speak for you, for a smaller debt');
      memoOnce(t, p, w, 'favour', 'He agreed to speak for you, and asked less than he might have.');
      tweak(0.02, 0, 0.04);
      lines.push('He weighs you up. “You drive a hard bargain for a man asking a favour. All right. A small one.”');
      return said(lines, c, undefined, 15);
    }
    tweak(-0.04, -0.02, -0.03);
    lines.push('“Then we’re done. I don’t haggle over my name.” He is not angry, only closed to it.');
    stamp(t, 'rk_back_no', w);
    return said(lines, c, [{ code: 'fl:back_take', label: '“All right. Your terms.”', hint: 'He may still do it, with a worse taste in his mouth.' }, drop], 10);
  }

  // ------------------------------------------------------------------ promotion
  if (c0 === 'promo') {
    if (rk(t) < 2) { lines.push(pick(w, t, { jovial: ['“Me? I’m the last man you want to ask. Ask somebody who sits at the table.”'], _: ['“I’m hardly the man to ask. I don’t decide that.”'] })); return said(lines, c, undefined, 10); }
    const rd = readiness(w, p);
    if (!rd) { lines.push('“There’s only one chair above you. Think carefully about what you’re asking.”'); return said(lines, c, undefined, 10); }
    const gaps = promoGaps(w, p);
    if (!gaps.length) {
      lines.push(pick(w, t, { proud: ['“You’ve done what was asked. They’re making up their minds. Be patient and be seen.”'], _: ['“Your numbers are right, you’re spoken for, and there’s a chair. The rest isn’t in my hands.”'] }));
      return said(lines, c, undefined, 15);
    }
    lines.push(pick(w, t, {
      proud: [`“You want to be made. So does every man here. Right now I’d call you ${standingWord(p.standing)}.”`],
      cold: [`“Not yet. ${standingWord(p.standing)[0].toUpperCase() + standingWord(p.standing).slice(1)}, that’s what I hear.”`],
      jovial: [`“Ambitious! Good. Right now people say you’re ${standingWord(p.standing)}, so there’s work to do.”`],
      _: [`“You’re not there. People call you ${standingWord(p.standing)}.”`],
    }));
    return said(lines, c, gaps, 15);
  }
  if (c0 === 'fl' && arg?.startsWith('promo_')) {
    const rd = readiness(w, p);
    if (arg === 'promo_earn') lines.push(rd && rd.earn > 0.6 ? '“You’re close. A few more good weeks passed up the line and that stops being a question.”' : '“More than this. Nobody puts a name forward on what you’ve passed up so far.”');
    if (arg === 'promo_sponsor') { const b = p.bossId ? w.chars[p.bossId] : undefined; lines.push(b && b.id !== t.id ? `“It’s ${b.name.split(' ')[0]} who answers for you. Take it up with him, not me.”` : '“I’d have to stand up and say you’re sound. I can’t yet.”'); }
    if (arg === 'promo_seat') lines.push('“Nobody’s moving. A man has to die, retire, or go away first. Be ready when it happens, because it happens fast.”');
    if (arg === 'promo_talk') lines.push(r.trust >= 0.45 ? '“People think you’re careless, or that you’ve been rough where you needn’t be. Fix that and it stops.”' : '“You’d have to be a closer friend before I told you that.”');
    return said(lines, c, promoGaps(w, p), 10);
  }

  // ------------------------------------------------------------------ leaning on a man
  if (c0 === 'cr_thin') {
    if (recent(t, 'thin', w, 6)) { lines.push('“You told me already. I heard.”'); return said(lines, c, undefined, 3); }
    stamp(t, 'thin', w);
    const a = arch(t);
    const over = st === 'over';
    const fear = clamp(0.4 + (0.5 - temper(t).courage) * 0.7 + viewOf(w, t, p).fear * 0.3 + (over ? 0.15 : -0.15) - r.grudge * 0.3 * temper(t).pride * 2, 0.05, 0.95);
    const mood = a === 'hothead' ? 'defy' : a === 'frightened' || w.rng.chance(fear) ? (a === 'frightened' || a === 'earnest' ? 'plead' : 'submit') : 'defy';
    memoOnce(t, p, w, 'threat', 'You told him he’s on thin ice.');
    if (mood === 'submit') {
      lines.push(pick(w, t, { cold: ['He holds your eye a second too long, then nods. “Understood.”'], proud: ['“I hear you.” He says it flatly, like a man swallowing something.'], _: ['“All right. I know where I stand.”'] }));
      tweak(-0.04, -0.04, 0.02); t.cooldown.restraint = Math.max(t.cooldown.restraint ?? 0, w.now);
      return said(lines, c, [{ code: 'fl:th_ease', label: '“I’d sooner settle this with a good week.”', hint: 'Takes the edge off. He’ll try to earn it back.' }, drop], 10);
    }
    if (mood === 'plead') {
      const why = t.problem ? PROBLEM_LABEL[t.problem.kind] : t.hustle?.cause ?? 'a bad stretch';
      lines.push(`He goes pale and keeps his voice low. “It isn’t what you think. It’s ${why}. Give me a little time and I’ll put it right.”`);
      tweak(-0.02, -0.02, -0.01);
      return said(lines, c, [{ code: 'fl:th_hear', label: '“Go on. I’m listening.”', hint: 'He may tell you what is really wrong.' }, { code: 'fl:th_hold', label: '“It stands. I’m not changing it.”', hint: 'Fear works, for a while.' }], 15);
    }
    lines.push(pick(w, t, { hothead: ['“Thin ice? You come to me with that?” He doesn’t step back. “Say it plain, or don’t say it.”'], _: ['He gives a short, humourless laugh. “You’re threatening me? I’ve been in this longer than you think.”'] }));
    tweak(-0.1, -0.06, -0.05); r.grudge = clamp(r.grudge + 0.12);
    return said(lines, c, [{ code: 'fl:th_back', label: '“All right. Let’s calm down.”', hint: 'You lose face. You lose less than a fight.' }, { code: 'fl:th_push', label: '“Don’t make me say it twice.”', hint: 'He may break, or the two of you may. Others will hear.', big: true }], 15);
  }
  if (c0 === 'fl' && arg === 'th_ease') { tweak(0.03, 0.02, 0); lines.push('“Then I’ll give you one.” He means it, mostly.'); return said(lines, c, undefined, 5); }
  if (c0 === 'fl' && arg === 'th_hear') {
    if (t.problem) t.problem.revealed = true;
    tweak(0.05, 0.03, 0); lines.push(t.problem ? `“It’s ${PROBLEM_LABEL[t.problem.kind]}. I didn’t want it getting back to you.”` : '“I’m not skimming. I’ve just not had the work. That’s the truth.”');
    return said(lines, c, undefined, 15);
  }
  if (c0 === 'fl' && arg === 'th_hold') { tweak(-0.05, -0.03, 0.01); lines.push('He looks at the floor. “You’ll have it.” Nothing more.'); return said(lines, c, undefined, 5); }
  if (c0 === 'fl' && arg === 'th_back') { tweak(0.0, 0, -0.03); lines.push('“Good,” he says, as if he’d decided it. You both let it go. It will not be forgotten.'); return said(lines, c, undefined, 5); }
  if (c0 === 'fl' && arg === 'th_push') {
    const breaks = temper(t).courage < 0.55 && w.rng.chance(0.55);
    if (breaks) { tweak(-0.05, -0.04, 0.04); lines.push('Something in his face gives. “All right. All right. Whatever you want.”'); }
    else { tweak(-0.1, -0.08, -0.04); r.grudge = clamp(r.grudge + 0.2); lines.push('“Then do it,” he says quietly. Nobody moves. You have made an enemy without winning anything.'); }
    addFact(w, { kind: 'threat', actor: p.id, victim: t.id, minor: true, text: `${p.name} had hard words with ${t.name}.`, district: t.district }, { witnesses: [] });
    return said(lines, c, undefined, 10);
  }

  // ------------------------------------------------------------------ a man from another family
  if (c0 === 'rv_ears') {
    if (recent(t, 'rv_ears', w, 3)) { lines.push('“We did that already. I haven’t heard anything since.”'); return said(lines, c, undefined, 3); }
    const give = Object.values(w.facts).filter((f) => !p.known[f.id] && t.known[f.id] && !f.minor && f.kind !== 'report');
    const swap = Object.values(w.facts).filter((f) => p.known[f.id] && !t.known[f.id] && !f.minor && f.kind !== 'report');
    stamp(t, 'rv_ears', w);
    if (!give.length) { lines.push('“Nothing worth a drink.” He shrugs.'); return said(lines, c, undefined, 15); }
    if (r.trust < 0.4 && swap.length) {
      lines.push(pick(w, t, { schemer: ['“You want what I hear? Everyone does. What do you have for me?”'], cold: ['“I don’t give. I trade. Bring me something.”'], _: ['“A fair swap, then. Something I haven’t heard, and I’ll find you something.”'] }));
      c.ctx.deal = { kind: 'ears', ask: 0 };
      return said(lines, c, [{ code: 'fl:rv_trade', label: '“Here’s something you didn’t hear from me.”', hint: 'He hears it, and so may his people.', big: true }, { code: 'fl:rv_pass', label: '“It isn’t worth it.”' }], 15);
    }
    if (w.rng.chance(clamp(0.25 + r.trust * 0.5, 0.15, 0.8))) {
      const f = w.rng.pick(give); learn(w, p.id, f, t.id, false);
      lines.push('He looks around, then lowers his voice. “You didn’t hear it from me.” You have something new to think about.');
      tweak(0.02, 0.01);
    } else lines.push('“I hear nothing,” he says. “That’s why I’m still here.”');
    return said(lines, c, undefined, 20);
  }
  if (c0 === 'fl' && arg === 'rv_trade') {
    const swap = Object.values(w.facts).filter((f) => p.known[f.id] && !t.known[f.id] && !f.minor && f.kind !== 'report');
    const give = Object.values(w.facts).filter((f) => !p.known[f.id] && t.known[f.id] && !f.minor && f.kind !== 'report');
    if (!swap.length || !give.length) { lines.push('“Nothing there I can use.” The swap does not happen.'); return said(lines, c, undefined, 5); }
    const a = w.rng.pick(swap), b = w.rng.pick(give);
    learn(w, t.id, a, p.id, true); learn(w, p.id, b, t.id, false);
    tweak(0.03, 0.01, 0.02);
    lines.push('He listens without a flicker, then nods. “That’s fair.” And he gives you his in return.');
    return said(lines, c, undefined, 20);
  }
  if (c0 === 'fl' && arg === 'rv_pass') { lines.push('“Suit yourself.” He goes back to his drink.'); return said(lines, c, undefined, 5); }
  if (c0 === 'rv_warn') {
    if (recent(t, 'rv_warn', w, 7)) { lines.push('“You said that already. I’m still standing here.”'); return said(lines, c, undefined, 3); }
    stamp(t, 'rv_warn', w);
    const tn = (id: Id | undefined) => (p.familyId && id ? w.fam[p.familyId]?.tension[id] ?? 0 : 0);
    const bump = (d: number) => { if (p.familyId && t.familyId) { const A = w.fam[p.familyId], B = w.fam[t.familyId]; A.tension[t.familyId] = (A.tension[t.familyId] ?? 0) + d; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + d; } };
    const higher = rk(t) > rk(p);
    const a = arch(t);
    if (a === 'frightened' || (!higher && temper(t).courage < 0.45)) {
      lines.push('He holds up both hands. “I’m not looking for trouble. I’ll pass it on.” He does not like it, and he will say so only to his own.');
      tweak(-0.03, -0.02, 0.02); bump(0.15);
    } else if (higher || a === 'hothead' || a === 'proud') {
      lines.push(higher ? '“From you? Keep a civil tongue. You’re speaking out of turn to a man above you. I’ll pass your message on, and mine to your boss.”' : '“Our ground? Since when? Careful what you start.”');
      tweak(-0.08, -0.05, -0.03); r.grudge = clamp(r.grudge + 0.1); bump(0.6);
    } else { lines.push('“Message received. Pass mine to your boss.” He smiles with no warmth.'); tweak(-0.06, -0.04, 0.03); bump(0.4); }
    addFact(w, { kind: 'threat', actor: p.id, victim: t.id, minor: true, text: `${p.name} warned ${t.name} off.`, district: t.district }, { witnesses: [] });
    return said(lines, c, [{ code: 'fl:rv_ease', label: '“I meant no insult by it.”', hint: 'Takes some heat out. It also reads as weakness.' }, drop], 10);
  }
  if (c0 === 'fl' && arg === 'rv_ease') {
    if (p.familyId && t.familyId) { const A = w.fam[p.familyId], B = w.fam[t.familyId]; A.tension[t.familyId] = Math.max(0, (A.tension[t.familyId] ?? 0) - 0.2); B.tension[p.familyId] = Math.max(0, (B.tension[p.familyId] ?? 0) - 0.2); }
    tweak(0.02, 0, -0.02); lines.push('“Fine. Fine. Let’s say it was a long day.” The air eases, a little.');
    return said(lines, c, undefined, 5);
  }

  // ------------------------------------------------------------------ taking a man on
  if (c0 === 'recruit_offer') {
    if (!t.prospect || t.rank !== 'civilian') { lines.push('“Not for me. I’ve got my own life.”'); return said(lines, c, undefined, 5); }
    if (rk(p) < 1) { lines.push('“You? You’re nobody yet. Come back when you are somebody.”'); return said(lines, c, undefined, 5); }
    // V89: an offer of a place is a matter between you (asks.ts 'recruit'). He may take it, name the start he needs and why, want
    // time, or say no; and whatever he says, you can come back to it: offer more, make your case, lean on him, or let it go.
    if (p.cash < RECRUIT_COST) { lines.push(`You need ${money(RECRUIT_COST)} to bring a man on properly.`); return said(lines, c, undefined, 3); }
    const open = askBetween(w, 'recruit', p.id, t.id);
    const s = open ?? openAsk(w, 'recruit', p, t, { amt: RECRUIT_COST, why: `${p.name} offered ${t.name} a place` });
    if (!s) { lines.push('“I gave you my answer. Ask when something’s different.”'); return said(lines, c, undefined, 3); }
    const bold = t.traits.ambition > 0.6;
    // (V90: his answer is decided first; a man who is interested says so before he names his terms, a man who isn't doesn't. What
    // follows is the matter itself, in the conversation, with its own answers to whatever he said.)
    const r = playerMove(w, p, s.id, 'ask'), last = s.st?.[t.id]?.last;
    if (!open && (last === 'counter' || last === 'yes' || last === 'stall')) lines.push(bold ? '“I’ve been waiting for somebody to ask. I want to know what I’m getting, and who I answer to.”' : '“It’s a big thing, to put my name to yours. I want to know what you expect.”');
    lines.push(...r.lines);
    return said(lines, c, undefined, 20);
  }
  // (the V85 follow-ups, kept so an old conversation still answers: they are the same matter now)
  if (c0 === 'fl' && (arg === 'rc_std' || arg === 'rc_more' || arg === 'rc_wait')) {
    const s = askBetween(w, 'recruit', p.id, t.id);
    if (!s) { lines.push('“We’ve been through that.”'); return said(lines, c, undefined, 3); }
    const mv: AskMove = arg === 'rc_wait' ? 'wait' : arg === 'rc_more' ? (s.st?.[t.id]?.last === 'counter' ? 'take' : 'sweeten') : 'ask';
    lines.push(...playerMove(w, p, s.id, mv).lines);
    return said(lines, c, undefined, 20);
  }

  // ------------------------------------------------------------------ orders that meet resistance
  if (c0 === 'assign_low' || c0 === 'assign_hustle') {
    const low = c0 === 'assign_low';
    const a = arch(t);
    const owesMe = t.books.arrears > 0;
    const resists = low ? (owesMe || t.cash < 150) && w.rng.chance(0.6) : (a === 'frightened' || temper(t).caution > 0.65) && w.rng.chance(0.65);
    if (resists && st === 'over' && !recent(t, 'ord:' + c0, w, 1)) {
      stamp(t, 'ord:' + c0, w);
      lines.push(low
        ? '“Keep my head down? That’s money I need. I’m behind as it is, and you know it.”'
        : '“Another angle? I’d be drawing eyes. If it goes bad it goes bad on both of us.”');
      return said(lines, c, [
        { code: 'fl:ord_insist:' + c0, label: '“It isn’t a request.”', hint: 'He does it. He remembers being told.', big: true },
        { code: 'fl:ord_ok:' + c0, label: '“Forget it.”', hint: 'No change. He sees you listen.' },
      ], 10);
    }
    return doOrder(w, p, t, c, c0, false);
  }
  if (c0 === 'fl' && arg === 'ord_ok') { tweak(0.02, 0, 0.01); lines.push('“Thanks for hearing me.” He relaxes a little.'); return said(lines, c, undefined, 5); }
  if (c0 === 'fl' && arg === 'ord_insist') return doOrder(w, p, t, c, code.split(':')[2], true);

  // ------------------------------------------------------------------ before a sit-down
  if (c0 === 'fl' && arg === 'drop') { lines.push('You leave it at that.'); return said(lines, c, undefined, 3); }
  return null;
}

function doOrder(w: World, p: Character, t: Character, c: Convo, code: string, forced: boolean): Said {
  const r = rel(t, p.id);
  const lines: string[] = [];
  if (forced) { r.trust = clamp(r.trust - 0.04); r.respect = clamp(r.respect + 0.02); r.grudge = clamp(r.grudge + 0.05); }
  if (code === 'assign_low') {
    t.heat = Math.max(0, t.heat - 0.2);
    lines.push(forced ? 'He nods once and says nothing more. He will stay out of sight, and he will not forget how it was put.' : '“All right. I’ll be quiet a while.”');
  } else {
    if (!t.books.side) t.books.side = w.rng.int(80, 220);
    t.books.sideKnown = true; t.heat = clamp(t.heat + 0.1, 0, 1.5);
    lines.push(forced ? 'He nods. “I’ll find something.” It will show in his books from now on, and so will the heat.' : '“I know a couple of things.” It will show in his books from now on.');
  }
  c.ctx.follow = undefined;
  return { lines, minutes: 15, convo: { id: c.id, node: 'orders', ctx: c.ctx } };
}

// What he says as a sit-down is set up: what he wants from it, in his own terms. It is only words; the meeting is unchanged.
export function sitdownTalk(w: World, p: Character, t: Character, other: Character): string[] {
  const a = arch(t);
  const lead = a === 'hothead' ? '“I’ll come. Don’t expect me to be calm about it.”'
    : a === 'frightened' ? '“If it’ll end it, I’ll sit. I don’t want any more of this.”'
    : a === 'cold' ? '“I’ll sit. I want it said to his face, and I want it made right.”'
    : '“All right. A sit-down. I’ll say what I have to say, and he’ll say his.”';
  const prior = (p.cooldown[`sd:${t.id}`] ?? 0) > w.now - 20 * DAY ? ' “And let’s not have another one like the last.”' : '';
  p.cooldown[`sd:${t.id}`] = w.now;
  return [`${lead}${prior}`, `He expects ${other.name.split(' ')[0]} to be there, and he expects you to be fair.`];
}

// A promise to him that lapsed unkept, and that he has not yet been dealt with over.
export function brokenWord(w: World, p: Character, t: Character) {
  return Object.values(w.facts).find((f) => f.kind === 'ruling' && f.actor === p.id && f.victim === t.id && /keep his word/.test(f.text) && w.now - f.t < 30 * DAY && !t.talk?.['word:' + f.id]);
}

// What stands between you and the next rank, as things you can ask him about, one at a time.
function promoGaps(w: World, p: Character): FollowOpt[] {
  const rd = readiness(w, p); const gaps: FollowOpt[] = [];
  if (!rd) return gaps;
  if (rd.earn < 1) gaps.push({ code: 'fl:promo_earn', label: '“How much more do you expect from me?”' });
  if (!rd.sponsor) gaps.push({ code: 'fl:promo_sponsor', label: '“Who has to speak for me?”' });
  if (!rd.openSeat) gaps.push({ code: 'fl:promo_seat', label: '“When will there be room?”' });
  if (p.standing < 45) gaps.push({ code: 'fl:promo_talk', label: '“What are people saying about me?”' });
  return gaps;
}
