// A contested succession (The Family, October 2026). When a boss dies and the chair goes to a man whose rival came close, the rival
// does not always accept it: for a couple of weeks the family is divided, the two of them work on the captains, and the men of the
// family (the player among them, if he is a captain, the underboss or the consigliere) have to decide whom they stand with. It ends
// with the new boss confirmed, a settlement that buys the rival off, or the captains putting the rival in the chair instead.
//
// The chair is never empty while it runs: the new man holds it (orgs.succeed), and the contest is whether he keeps it.
import { temper } from './temper';
import { addFact, bear, clamp, ease, feel, peek, rel } from './core';
import { addEnc } from './encounters';
import { applyRank, repairHierarchy } from './rank';
import { candidates, leaderChanged, membersOf, onSucceed, type Cand } from './orgs';
import { closeSit, isOpen, know, registerStep, spawn, tell } from './situ';
import { MATTERS, type Opt } from './matters';
import { positionOf } from './standing';
import { DAY, type Character, type Id, type Situation, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const M = (s: Situation) => (s.m ??= {});
const num = (s: Situation, k: string) => Number(s.m?.[k] ?? 0);
const str = (s: Situation, k: string) => String(s.m?.[k] ?? '');
const role = (s: Situation, r: string) => (s.parties ?? []).find((p) => p.role === r)?.id;
const W8: Record<string, number> = { underboss: 2, capo: 1.5, consigliere: 1 };
// the men whose word decides it: the underboss, the captains and the consigliere (not the two contenders)
const voices = (w: World, s: Situation) => {
  const f = w.fam[str(s, 'fid')], a = role(s, 'boss'), b = role(s, 'rival');
  return membersOf(w, f.id).filter((c) => c.alive && c.id !== a && c.id !== b && (c.rank === 'underboss' || c.rank === 'capo' || f.consigliere === c.id)).sort((x, y) => (x.id < y.id ? -1 : 1));
};
// where a man stands, as it really is: his own feeling for each, and what each side has done to win him (never shown to the player)
function leanOf(w: World, s: Situation, v: Character): number {
  const a = w.chars[role(s, 'boss')!], b = w.chars[role(s, 'rival')!];
  const feelFor = (c: Character) => rel(v, c.id).trust * 0.6 + rel(v, c.id).respect * 0.3 - rel(v, c.id).grudge * 0.7;
  return feelFor(a) - feelFor(b) + num(s, 'pull:' + v.id); // >0 with the new boss, <0 with the rival
}

// ------------------------------------------------------------------------------------------------ how it starts
export function contestStart(w: World, fid: Id, boss: Character, cs: Cand[]): boolean {
  const p = w.playerId ? w.chars[w.playerId] : undefined, f = w.fam[fid];
  if (!p?.alive || p.familyId !== fid || boss.isPlayer) return false;
  const pos = positionOf(w, p);
  if (!['captain', 'underboss', 'consigliere'].includes(pos)) return false;
  const top = cs.find((x) => x.c.id === boss.id), rival = cs.find((x) => x.c.id !== boss.id && x.c.alive && (x.c.rank === 'capo' || x.c.rank === 'underboss' || x.c.isPlayer) && x.c.jailedUntil <= w.now);
  if (!top || !rival || rival.score < top.score * 0.7) return false;
  // a rival with the stomach for it: ambition and pride, or a real grudge against the new man (the player decides for himself)
  if (!rival.c.isPlayer && rival.c.traits.ambition + temper(rival.c).pride * 0.5 + rel(rival.c, boss.id).grudge < 0.9) return false;
  const s = spawn(w, 'contest', `contest:${fid}`, p.id, { cause: `${rival.c.isPlayer ? 'You came' : `${rival.c.name} came`} close to the chair, and ${rival.c.isPlayer ? 'you don’t' : 'he doesn’t'} accept ${boss.name} in it`, parties: [{ id: boss.id, role: 'boss' }, { id: rival.c.id, role: 'rival' }, { id: p.id, role: 'voice' }], sev: 0.7, phase: 'divided', next: w.now + 3 * DAY, orgs: [fid], m: { fid, due: w.now + 14 * DAY } });
  if (!s) return false;
  s.stage = 'handling'; know(w, s, p.id, 2, 'he is in the family');
  addFact(w, { kind: 'event', actor: rival.c.id, victim: boss.id, minor: false, text: `${rival.c.name} hasn’t accepted ${boss.name} as boss. The family is divided until it’s settled.`, district: boss.district }, { broadcast: membersOf(w, fid).map((c) => c.id) });
  if (!rival.c.isPlayer) addEnc(w, { kind: 'matter', from: rival.c.id, title: `${first(rival.c)} wants to know where you stand`, days: 4, lines: [`${first(rival.c)} finds you alone. “You know ${first(boss)} isn’t right for it. When it comes to it, I need to know you’re with me.”`], opts: [{ code: 'later', label: '“I’ll let you know.”', hint: 'He’ll take it as a no if he has to wait too long.' }], data: { sit: s.id, what: 'ask' } });
  return true;
}

// ------------------------------------------------------------------------------------------------ while it runs
function step(w: World, s: Situation) {
  const a = w.chars[role(s, 'boss')!], b = w.chars[role(s, 'rival')!];
  if (!a?.alive || !b?.alive || w.fam[str(s, 'fid')].bossId !== a.id) return closeSit(w, s, 'overtaken', [], 8);
  // each contender works on one man of his own choosing: whoever he has a hold on and hasn't won yet
  for (const [c, sign] of [[a, 1], [b, -1]] as [Character, number][]) {
    if (c.isPlayer) continue;
    const v = voices(w, s).filter((x) => !x.isPlayer && Math.sign(leanOf(w, s, x)) !== sign).sort((x, y) => peek(x, c.id).trust - peek(y, c.id).trust).reverse()[0];
    if (!v) continue;
    const pull = (peek(v, c.id).trust * 0.3 + (sign > 0 ? 0.1 : 0)) * (W8[v.rank] ?? 1) * 0.3;
    M(s)['pull:' + v.id] = num(s, 'pull:' + v.id) + sign * pull;
    tell(w, s, `${c.name} had a long dinner with ${v.name}.`, { actor: c.id, victim: v.id, witnesses: [c.id, v.id], minor: true });
  }
  // a rival who is losing and has the temper for it reaches for something harder
  const tally = total(w, s);
  if (tally > 1 && !b.isPlayer && temper(b).volatility > 0.6 && b.traits.violence > 0.6 && !num(s, 'struck')) {
    const v = voices(w, s).find((x) => !x.isPlayer && leanOf(w, s, x) > 0.3);
    if (v) { M(s).struck = 1; v.hurtUntil = w.now + 4 * DAY; addFact(w, { kind: 'beating', actor: b.id, victim: v.id, story: 'sit:' + s.id, text: `${v.name} was beaten outside his club. Everybody knows whose men did it.`, district: v.district }, { broadcast: membersOf(w, str(s, 'fid')).map((c) => c.id) }); bear(w, v, b.id, 0.4, `${b.name} had him beaten over the chair`); }
  }
  if (w.now >= num(s, 'due')) return settle(w, s);
  s.next = w.now + w.rng.int(2, 4) * DAY;
}
const total = (w: World, s: Situation) => voices(w, s).reduce((x, v) => x + (W8[v.rank] ?? 1) * clamp(leanOf(w, s, v), -1, 1), 0);
function settle(w: World, s: Situation) {
  const a = w.chars[role(s, 'boss')!], b = w.chars[role(s, 'rival')!], fid = str(s, 'fid');
  const t = total(w, s);
  if (t >= 0) {
    // the captains stand with the new boss; the rival swallows it, or is made to
    bear(w, b, a.id, 0.2, `the family went with ${a.name} over him`); feel(w, a, b.id, 'trust', -0.15);
    if (b.rank === 'capo' && !b.isPlayer && temper(a).pride + temper(a).volatility > 1) { applyRank(w, b, 'soldier', { fact: false, career: `Put down to soldier by ${a.name} after the contest for the chair` }); }
    addFact(w, { kind: 'event', actor: a.id, victim: b.id, minor: false, text: `The captains stood with ${a.name}. ${b.name}’s claim to the chair is finished.`, district: a.district }, { broadcast: membersOf(w, fid).map((c) => c.id) });
    for (const v of voices(w, s)) if (leanOf(w, s, v) < 0) bear(w, a, v.id, 0.1, `${v.name} stood with ${b.name} against him`);
    if (w.chars[w.playerId!]) judgedBy(w, s, a, b, 'boss');
    return closeSit(w, s, `${first(a)} keeps the chair`, ['the captains stood with him', b.isPlayer ? 'your claim failed' : `${first(b)} lost`], 12);
  }
  // the captains put the rival in the chair: the new boss steps down to a crew
  const cs = candidates(w, fid, a.id, { cause: 'coup', favoured: b.id });
  w.fam[fid].bossId = b.id;
  applyRank(w, b, 'boss', { fact: false, repair: false, place: (x) => { x.bossId = null; for (const c of Object.values(w.chars)) if (c.alive && c.bossId === a.id && c.id !== x.id) c.bossId = x.id; } });
  repairHierarchy(w, fid);
  leaderChanged(w, fid, b, a.id, 'coup', cs);
  addFact(w, { kind: 'event', actor: b.id, victim: a.id, minor: false, text: `The captains went with ${b.name}. ${a.name} is out of the chair after a few weeks in it.`, district: b.district }, { broadcast: membersOf(w, fid).map((c) => c.id) });
  if (w.chars[w.playerId!]) judgedBy(w, s, b, a, 'rival');
  return closeSit(w, s, b.isPlayer ? 'You take the chair' : `${first(b)} takes the chair`, [b.isPlayer ? 'the captains went with you' : 'the captains went with him', `${first(a)} is out`], 12);
}
// what the outcome means for the player: whom he stood with, and how it went
function judgedBy(w: World, s: Situation, winner: Character, loser: Character, side: 'boss' | 'rival') {
  const p = w.chars[w.playerId!], mine = str(s, 'side');
  if (!mine || winner.isPlayer) return;
  if (mine === side) { feel(w, winner, p.id, 'trust', 0.15, `${p.name} stood with him for the chair`); return; }
  bear(w, winner, p.id, 0.25, `${p.name} stood with ${loser.name} against him`); feel(w, winner, p.id, 'trust', -0.15);
}

// ------------------------------------------------------------------------------------------------ the player's part
MATTERS.contest = {
  title: (w, s) => { const a = w.chars[role(s, 'boss')!], b = w.chars[role(s, 'rival')!]; return `${a ? first(a) : 'The boss'} or ${b ? (b.isPlayer ? 'you' : first(b)) : 'his rival'}: the chair`; },
  step,
  stage: (w, s) => {
    if (!isOpen(s)) return s.out ?? 'settled';
    const days = Math.max(0, Math.ceil((num(s, 'due') - w.now) / DAY)), side = str(s, 'side');
    const told = voices(w, s).map((v) => str(s, 'said:' + v.id) ? `${first(v)} ${str(s, 'said:' + v.id)}` : '').filter(Boolean);
    return `About ${days} days until the captains settle it. ${side ? `You stand with ${side === 'boss' ? first(w.chars[role(s, 'boss')!]) : w.chars[role(s, 'rival')!].isPlayer ? 'yourself' : first(w.chars[role(s, 'rival')!])}.` : 'You haven’t said where you stand.'}${told.length ? ' What they told you: ' + told.join('; ') + '.' : ''}`;
  },
  opts: (w, s, p, t) => {
    if (!isOpen(s)) return [];
    const a = w.chars[role(s, 'boss')!], b = w.chars[role(s, 'rival')!], out: Opt[] = [], side = str(s, 'side');
    if (!side && !t) {
      out.push({ code: 'side:boss', label: b.isPlayer ? `Accept ${a.name} as boss` : `Stand with ${a.name}`, hint: b.isPlayer ? 'Let it go. He’ll remember that you could have made trouble and didn’t.' : 'He holds the chair. If he keeps it, he remembers who stood with him.', big: true });
      out.push({ code: 'side:rival', label: b.isPlayer ? 'Press your own claim' : `Stand with ${b.name}`, hint: b.isPlayer ? 'You came close. Win the captains and the chair is yours; lose, and the man in it knows what you tried.' : `If the captains go with ${first(b)}, he’ll remember it. If they don’t, so will ${first(a)}.`, big: true });
    }
    if (side) for (const v of voices(w, s)) {
      if (v.isPlayer || num(s, 'won:' + v.id) || (t && t.id !== v.id)) continue;
      out.push({ code: 'win:' + v.id, label: `Talk to ${v.name}`, hint: `Bring him round to ${side === 'boss' ? first(a) : b.isPlayer ? 'you' : first(b)}. What he tells you may not be what he does.`, who: v.id });
    }
    if (side && !t && !num(s, 'tried') && !b.isPlayer) out.push({ code: 'deal', label: `Try to settle it between ${first(a)} and ${first(b)}`, hint: `${first(b)} gets something big enough to stand down for: the underboss’s chair, or a crew of his choosing. Both have to want it settled.` });
    return out.slice(0, 9);
  },
  act: (w, s, p, code) => {
    const a = w.chars[role(s, 'boss')!], b = w.chars[role(s, 'rival')!];
    if (code.startsWith('enc:')) return [];
    if (code === 'side:boss' && b.isPlayer) {
      feel(w, a, p.id, 'trust', 0.1, `${p.name} could have fought him for the chair and didn’t`); ease(a, p.id, 0.5);
      addFact(w, { kind: 'event', actor: p.id, victim: a.id, minor: false, text: `${p.name} accepted ${a.name} as boss.`, district: p.district }, { broadcast: membersOf(w, str(s, 'fid')).map((c) => c.id) });
      closeSit(w, s, `${first(a)} keeps the chair`, ['you accepted him'], 12);
      return [`You go to ${first(a)} and kiss his cheek in front of the captains. It costs you something to do it. He sees that, and remembers it.`];
    }
    if (code.startsWith('side:')) {
      const side = code.slice(5); M(s).side = side;
      const with_ = side === 'boss' ? a : b, against = side === 'boss' ? b : a;
      if (!with_.isPlayer) feel(w, with_, p.id, 'trust', 0.06, `${p.name} said he stood with him`);
      if (!against.isPlayer) bear(w, against, p.id, 0.08, `${p.name} stood against him for the chair`);
      tell(w, s, `${p.name} let it be known he stands with ${with_.isPlayer ? 'himself' : with_.name}.`, { actor: p.id, victim: with_.id, broadcast: voices(w, s).map((v) => v.id), minor: false });
      return [with_.isPlayer ? 'You let it be known you mean to have the chair. There’s no taking that back.' : `You let it be known you stand with ${first(with_)}. ${first(against)} will hear by tonight.`];
    }
    if (code.startsWith('win:')) {
      const v = w.chars[code.slice(4)]; if (!v) return [];
      M(s)['won:' + v.id] = 1;
      const side = str(s, 'side'), sign = side === 'boss' ? 1 : -1, cand = side === 'boss' ? a : b;
      const sway = peek(v, p.id).trust * 0.5 + peek(v, p.id).respect * 0.2 + peek(v, cand.id).trust * 0.3 - peek(v, cand.id).grudge * 0.6;
      const lean = leanOf(w, s, v) * sign; // >0: already leaning our way
      if (sway > 0.3) { M(s)['pull:' + v.id] = num(s, 'pull:' + v.id) + sign * clamp(sway, 0.2, 0.6); M(s)['said:' + v.id] = 'said he’s with you'; return [`${first(v)} hears you out. “All right. When it comes to it, I’m with ${cand.isPlayer ? 'you' : first(cand)}.”`]; }
      // a man firmly on the other side may tell you what you want to hear
      if (lean < -0.3 && temper(v).caution > 0.5) { M(s)['said:' + v.id] = 'said he’s with you'; return [`${first(v)} nods along. “Sure. You can count on me.” He doesn’t quite meet your eye.`]; }
      M(s)['said:' + v.id] = 'wouldn’t commit'; return [`${first(v)} won’t commit. “Let’s see how it shakes out.”`];
    }
    if (code === 'deal') {
      M(s).tried = 1;
      const willing = b.traits.ambition < 0.8 && total(w, s) > -0.5 && peek(b, a.id).grudge < 0.5;
      if (!willing) return [`You sit with ${first(b)}. He listens to the offer and laughs. “The underboss? I came for the chair.”`];
      ease(b, a.id, 0.5); feel(w, a, p.id, 'trust', 0.08, `${p.name} settled ${b.name} for him`); feel(w, b, p.id, 'respect', 0.05);
      const ub = membersOf(w, str(s, 'fid')).find((c) => c.rank === 'underboss' && c.id !== b.id);
      if (!ub && b.rank === 'capo') applyRank(w, b, 'underboss', { fact: { actor: a.id, text: `${a.name} named ${b.name} underboss, and the matter of the chair was settled.` }, career: `Named underboss by ${a.name}, as the price of the chair` });
      addFact(w, { kind: 'event', actor: p.id, minor: false, text: `${p.name} brought ${a.name} and ${b.name} to terms. ${b.name} accepts ${a.name} as boss${!ub && b.rank === 'underboss' ? ', as his underboss' : ''}.`, district: p.district }, { broadcast: membersOf(w, str(s, 'fid')).map((c) => c.id) });
      closeSit(w, s, 'settled by agreement', [`you brought ${first(a)} and ${first(b)} to terms`, `${first(b)} stood down`], 12);
      return [`It takes two nights and a great deal of wine. In the end ${first(b)} takes ${a.name.split(' ')[0]}’s hand. ${!ub ? `He’ll be underboss.` : 'He gets what he asked for.'} Nobody forgets who brought them to it.`];
    }
    return [];
  },
};
registerStep('contest', (w, s) => step(w, s));
onSucceed.push((w, fid, cand, cs, cause) => { if (cause === 'death') contestStart(w, fid, cand, cs); });
