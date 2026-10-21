// What reaches the player, and how. The world records everything; each man decides what to tell you, and the game decides how loudly to say it.
import { temper } from './temper';
import { addEnc } from './encounters';
import { addFact, clamp, learn, money, rel } from './core';
import { Character, DAY, Enc, Fact, Id, World } from './types';

export type Style = 'open' | 'alarmist' | 'solo' | 'hider' | 'cautious';
export const STYLE_WORD: Record<Style, string> = { open: 'tells you things', alarmist: 'makes everything sound urgent', solo: 'prefers to handle it himself', hider: 'keeps his mistakes quiet', cautious: 'won’t discuss it on the phone' };

export function styleOf(c: Character): Style {
  const T = c.traits;
  if (T.greed > 0.7 || (c.problem && !c.problem.revealed && temper(c).courage < 0.5)) return 'hider';
  if (temper(c).caution > 0.68 && T.sociability < 0.5) return 'cautious';
  if (temper(c).caution > 0.6) return 'alarmist';
  if (temper(c).courage > 0.62 && temper(c).pride > 0.5) return 'solo';
  return 'open';
}

export const expectOf = (w: World) => (w.expect ??= { report: 'weekly', trouble: 'tell', invest: 'ask' });

export type Level = 0 | 1 | 2; // background, relevant, critical
const SERIOUS = ['murder', 'beating', 'arrest', 'raid', 'robbery', 'discipline', 'promotion', 'exposed'];
const first = (c?: Character) => (c ? c.name.split(' ')[0] : 'someone');

// Why a thing reaches the player at all. Something is only news to him if it touches him, a man close to him, something he owns,
// or something he can act on. Everything else stays in History.
export interface Rele { level: Level; why: string }
export function relevance(w: World, p: Character, f: Fact): Rele {
  const crew = (id?: Id) => (id && w.chars[id]?.alive && w.chars[id].bossId === p.id ? w.chars[id] : undefined);
  const close = (id?: Id) => { const c = id ? w.chars[id] : undefined; const r = c ? p.rels[c.id] : undefined; return c && c.alive && c.id !== p.id && r && (r.affection > 0.5 || r.trust > 0.6) ? c : undefined; };
  const biz = f.business ? w.biz[f.business] : undefined;
  const myShop = biz?.protection?.collectorId === p.id || (biz && crew(biz.protection?.collectorId));
  const serious = SERIOUS.includes(f.kind) && !f.minor;
  const mine = f.actor === p.id || f.victim === p.id;
  const cm = crew(f.actor) ?? crew(f.victim);
  const hunt = !!f.story && f.story.startsWith('hunt:');
  // Level 2 is reserved for what is happening to you or your own people and is hard to ignore.
  if (hunt) return { level: 2, why: 'it’s about you' };
  if (mine && serious) return { level: 2, why: 'it involves you' };
  if (f.kind === 'murder' && (cm || f.victim === p.bossId)) return { level: 2, why: cm ? `${first(cm)} is one of your men` : 'it’s your boss' };
  if (cm && serious) return { level: 2, why: `${first(cm)} is one of your men` };
  if (f.victim === p.bossId && serious) return { level: 2, why: 'it’s your boss' };
  if (f.kind === 'report') {
    if (mine) return { level: 1, why: 'your own business' };
    if (cm) return { level: 1, why: `${first(cm)} is one of your men` };
    if (f.story && (w.disputes ?? []).some((d) => d.id === f.story && (d.a === p.id || d.b === p.id || crew(d.a) || crew(d.b) || d.biz && w.biz[d.biz]?.protection?.collectorId === p.id))) return { level: 1, why: 'a quarrel you’re part of' };
    if (f.story?.startsWith('seat:')) return { level: 1, why: 'your standing in the family' };
    if (!f.actor) return { level: 1, why: 'your business' };
    if (f.actor === p.bossId) return { level: 1, why: 'your boss' };
    return { level: 0, why: '' };
  }
  if (mine) return { level: 1, why: 'it involves you' };
  if (cm) return { level: 1, why: `${first(cm)} is one of your men` };
  if (f.victim === p.bossId || f.actor === p.bossId) return { level: 1, why: 'your boss is in it' };
  const cl = close(f.actor) ?? close(f.victim);
  if (cl) return { level: 1, why: `${first(cl)} is a friend` };
  // Money matters on your own shops: only the ones that are a sign of trouble you could act on.
  if (myShop && !['gambling_loss'].includes(f.kind)) return { level: 1, why: `it’s at ${biz!.name}, which pays you` };
  if (myShop && f.kind === 'gambling_loss' && (f.amount ?? 0) >= 500) return { level: 1, why: `a heavy loss at ${biz!.name}. He may be good for a loan, or in trouble` };
  // A new place opening in your family's ground is somebody to talk to.
  if (f.kind === 'event' && biz && !biz.protection && !f.minor) return { level: 1, why: 'a new place in your family’s ground. You could lean on it' };
  if (f.kind === 'poach' && biz && (w.chars[biz.protection?.collectorId ?? '']?.familyId === p.familyId)) return { level: 1, why: 'a shop in your family’s ground' };
  // A debt you hold or owe.
  const d = (w.debts ?? []).find((x) => x.status !== 'paid' && x.status !== 'void' && (x.creditor === p.id || x.debtor === p.id) && (x.debtor === f.actor || x.debtor === f.victim || x.creditor === f.actor || x.creditor === f.victim));
  if (d) return { level: 1, why: d.creditor === p.id ? 'he owes you' : 'you owe him' };
  if (serious && f.victim && w.chars[f.victim]?.familyId === p.familyId && ['capo', 'underboss', 'boss'].includes(w.chars[f.victim].rank)) return { level: 1, why: 'a man of rank in your family' };
  return { level: 0, why: '' };
}
export const levelOf = (w: World, p: Character, f: Fact): Level => relevance(w, p, f).level;

// Weekly: each man in your crew decides which of the things he knows he'll bring to you.
export function reportTick(w: World) {
  const p = w.chars[w.playerId!];
  if (!p?.alive) return;
  const ex = expectOf(w);
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.bossId !== p.id || c.jailedUntil > w.now) continue;
    const st = styleOf(c);
    const r = rel(c, p.id);
    for (const [fid, k] of Object.entries(c.known)) {
      const f = w.facts[fid];
      if (!f || p.known[fid] || w.now - k.t > 10 * DAY || k.t < w.now - 7 * DAY) continue;
      const own = f.actor === c.id;
      const serious = SERIOUS.includes(f.kind) && !f.minor;
      if (f.minor && st !== 'alarmist') continue;
      let pr = { open: 0.75, alarmist: 0.85, solo: 0.2, hider: own ? 0.08 : 0.35, cautious: 0.4 }[st];
      pr += ex.trouble === 'tell' ? 0.2 : -0.25;
      if (serious) pr += 0.2;
      pr += (r.trust - 0.4) * 0.3;
      if (!w.rng.chance(clamp(pr, 0.03, 0.95))) continue;
      learn(w, p.id, f, c.id, k.knowsActor);
      if (st === 'alarmist' && f.minor) addFact(w, { kind: 'report', actor: c.id, minor: true, text: `${c.name} came to you about ${f.text.replace(/\.$/, '')}. He’s sure it matters. It might not.`, district: c.district }, { witnesses: [p.id] });
    }
    // Voluntary honesty about his own trouble, if you told him to bring it to you
    if (ex.report === 'weekly' && c.problem && !c.problem.revealed && st !== 'hider' && st !== 'solo' && w.rng.chance(0.05 + r.trust * 0.08)) {
      c.problem.revealed = true;
      addFact(w, { kind: 'report', actor: c.id, minor: true, text: `${c.name} told you he’s in trouble: it’s something he’d have kept quiet if you hadn’t asked him to come to you.`, district: c.district }, { witnesses: [p.id] });
    }
  }
}

// A man with a good business and money in his pocket may ask before putting it to work.
export function askToInvest(w: World, c: Character, cost: number, line: string) {
  if ((w.enc ?? []).some((e) => e.status === 'open' && e.kind === 'invest' && e.from === c.id)) return;
  addEnc(w, {
    kind: 'invest', from: c.id, title: `${c.name.split(' ')[0]} wants to grow his business`,
    lines: [`${c.name} has been doing well with ${line}. He’s come to ask your leave.`, `"I’d put ${money(cost)} into it," he says. "More men, a better spot. You’d see more of it every week. I wouldn’t do it behind your back."`],
    opts: [{ code: 'yes', label: 'Tell him to go ahead', hint: 'He grows it. Your cut grows too.' }, { code: 'back', label: `Put in half yourself (${money(Math.round(cost / 2))})`, hint: 'He’ll remember that you backed him.' }, { code: 'no', label: 'Tell him to keep it small', hint: 'You keep control. He may chafe.' }],
    data: { cost },
    days: 5,
  });
}

export function investChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const c = e.from ? w.chars[e.from] : undefined;
  const cost = Number(e.data?.cost ?? 350);
  if (!c?.alive || !c.hustle) return ['It no longer matters.'];
  const r = rel(c, p.id);
  if (code === 'no') {
    r.trust = clamp(r.trust - 0.02);
    c.hustle.bad = 0;
    return [`${c.name} nods. "Whatever you say." He doesn’t sound convinced.`];
  }
  if (code === 'back') {
    const half = Math.round(cost / 2);
    if (p.cash < half) return ['You can’t cover half of it right now.'];
    p.cash -= half; c.cash += half;
  }
  c.cash -= Math.min(c.cash, code === 'back' ? Math.round(cost / 2) : cost);
  c.hustle.level = Math.min(3, c.hustle.level + 1);
  c.hustle.stake += cost;
  r.trust = clamp(r.trust + (code === 'back' ? 0.1 : 0.04));
  r.affection = clamp(r.affection + (code === 'back' ? 0.05 : 0.01));
  return [code === 'back' ? `You put your own money in beside his. ${c.name} won’t forget that.` : `${c.name} thanks you and goes off to find a bigger room for it.`];
}
