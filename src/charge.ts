// The boss's charge to his underboss (The Family, October 2026): a task drawn from a real problem in the family, which the underboss
// can only get done through the captains. The authority is the boss's, lent: a captain may agree, bargain for something he wants, say
// yes and do little, or refuse and go over the underboss's head; what the boss sees at the end is what actually changed.
//
//   fund   the family's fund is low: the captains are to put money in. Measured by what they paid in.
//   quiet  the police are too interested in the family: the crews are to keep their heads down for a month (men under restraint do
//          no shakedowns and no paybacks: actions.chooseAction). Measured by arrests and beatings while it ran.
//   crew   one crew's money has fallen off: its captain is to get it back up (he leans on his men). Measured by his crew's envelopes.
import { temper } from './temper';
import { addFact, bear, clamp, feel, money, peek } from './core';
import { addEnc, addFavour } from './encounters';
import { treasuryMove } from './orgs';
import { closeSit, isOpen, know, registerStep, spawn, tell } from './situ';
import { MATTERS, type Opt } from './matters';
import { positionOf } from './standing';
import { DAY, WEEK, type Character, type Situation, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const M = (s: Situation) => (s.m ??= {});
const num = (s: Situation, k: string) => Number(s.m?.[k] ?? 0);
const str = (s: Situation, k: string) => String(s.m?.[k] ?? '');
const sits = (w: World) => (w.situations ??= []);
const P = (w: World) => (w.playerId ? w.chars[w.playerId] : undefined);
const captains = (w: World, fid: string) => Object.values(w.chars).filter((c) => c.alive && c.familyId === fid && c.rank === 'capo' && w.fam[fid].consigliere !== c.id).sort((a, b) => (a.id < b.id ? -1 : 1));
const crewOf = (w: World, c: Character) => Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id);
const kickOf = (w: World, cap: Character) => crewOf(w, cap).reduce((a, x) => a + (x.books.history.at(-1)?.paid ?? 0), 0);
const TITLE: Record<string, string> = { fund: 'The family’s fund', quiet: 'Keep the crews quiet', crew: 'A crew’s numbers' };
// where each captain stands on it: '' not asked, 'yes' agreed, 'deal' agreed on terms, 'stall' said yes and means little, 'no' refused
const stance = (s: Situation, c: Character) => str(s, 'st:' + c.id);

// ------------------------------------------------------------------------------------------------ the boss sets it
export function chargeWeek(w: World) {
  const p = P(w);
  if (!p?.alive || !p.familyId || positionOf(w, p) !== 'underboss') return;
  if (sits(w).some((s) => s.kind === 'charge' && isOpen(s)) || (w.sitcool?.['charge:' + p.id] ?? 0) > w.now) return;
  const f = w.fam[p.familyId], boss = w.chars[f.bossId];
  if (!boss?.alive || boss.isPlayer) return;
  const caps = captains(w, f.id);
  if (caps.length < 2) return;
  const heat = caps.reduce((a, c) => a + c.heat + crewOf(w, c).reduce((b, x) => b + x.heat, 0) / Math.max(1, crewOf(w, c).length), 0) / caps.length;
  const fall = caps.map((c) => { const h = crewOf(w, c).map((x) => x.books.history.slice(-6)); const now = h.reduce((a, x) => a + x.slice(-2).reduce((b, y) => b + y.paid, 0), 0), was = h.reduce((a, x) => a + x.slice(0, 3).reduce((b, y) => b + y.paid, 0), 0) / 1.5; return { c, d: was > 200 ? now / was : 1 }; }).sort((a, b) => a.d - b.d)[0];
  let kind: string, why: string, target = 0, cap: Character | undefined;
  if ((f.treasury ?? 0) < 4000) { kind = 'fund'; target = Math.max(1500, Math.round((5000 - (f.treasury ?? 0)) / 500) * 500); why = `The family’s fund is down to ${money(f.treasury ?? 0)}. Lawyers, bail, the men inside: it all comes out of there.`; }
  else if (heat > 0.35) { kind = 'quiet'; why = 'The police are taking too much interest in us. For a month I want the crews quiet: no shakedowns, no paybacks, nothing in the papers.'; }
  else if (fall && fall.d < 0.7) { kind = 'crew'; cap = fall.c; why = `${fall.c.name}’s crew is bringing in a lot less than it was. Find out why, and get it back up.`; }
  else return;
  const s = spawn(w, 'charge', `charge:${f.id}:${kind}`, p.id, { cause: why.replace(/\.$/, ''), parties: [{ id: boss.id, role: 'boss' }, { id: p.id, role: 'ub' }, ...caps.map((c) => ({ id: c.id, role: 'cap' }))], sev: 0.4, phase: 'set', next: w.now + 3 * DAY, orgs: [f.id], m: { kind, target, due: w.now + 4 * WEEK, t0: f.treasury ?? 0, cap: cap?.id ?? '', k0: cap ? kickOf(w, cap) : 0, paid: 0 } });
  if (!s) return;
  s.stage = 'handling'; know(w, s, p.id, 2, 'set by the boss'); know(w, s, boss.id, 2, 'his charge');
  (w.sitcool ??= {})['charge:' + p.id] = w.now + 6 * WEEK;
  // (the arrests and beatings already on record, so the month's count starts from zero)
  if (kind === 'quiet') M(s).f0 = Object.values(w.facts).filter((x) => (x.kind === 'arrest' || x.kind === 'beating') && x.actor && w.chars[x.actor]?.familyId === f.id).length;
  addEnc(w, { kind: 'matter', from: boss.id, title: `${first(boss)} has something for you`, days: 4, lines: [`${first(boss)}: “${why}${kind === 'fund' ? ` I want ${money(target)} in it inside the month, from the captains.` : ''} You see to it. It’s what you’re for.”`], opts: [{ code: 'ok', label: '“It’ll be done.”', hint: 'Now you have to get the captains to do it.' }], data: { sit: s.id, what: 'set' } });
}

// ------------------------------------------------------------------------------------------------ a captain answers
// By his own interests: what it costs him, how he sees the underboss, how much he fears the boss behind him, and what he wants.
function answer(w: World, s: Situation, ub: Character, c: Character, how: 'ask' | 'lean' | 'offer'): string[] {
  const kind = str(s, 'kind'), tp = temper(c), r = peek(c, ub.id), boss = w.chars[(s.parties ?? []).find((x) => x.role === 'boss')!.id];
  const cost = kind === 'fund' ? clamp(num(s, 'target') / Math.max(1, captains(w, c.familyId!).length) / Math.max(300, c.cash), 0, 1.2) : kind === 'quiet' ? 0.25 + c.traits.violence * 0.3 : str(s, 'cap') === c.id ? 0.35 : 0.05;
  const lean = r.trust * 0.4 + r.respect * 0.3 + peek(c, boss.id).trust * 0.25 + tp.agreeable * 0.15 - cost * 0.5 - c.traits.ambition * 0.15 - r.grudge * 0.6 + (how === 'lean' ? 0.15 + (r.fear ?? 0) * 0.2 : 0) + (how === 'offer' ? 0.25 : 0);
  let st: string, line: string;
  if (how === 'offer' && stance(s, c) === 'deal') { M(s)['st:' + c.id] = 'yes'; comply(w, s, c); M(s)['owed:' + c.id] = 1; return [`${first(c)} nods. “Then we understand each other.”`]; }
  if (how === 'lean' && (tp.pride > 0.6 || r.grudge > 0.3) && lean < 0.35) { st = 'no'; line = `${first(c)} stands up. “You don’t talk to me like that. I’ll take it to ${first(boss)} myself.”`; }
  else if (lean > 0.45) { st = 'yes'; line = `${first(c)} nods. “All right. For ${first(boss)}.”`; }
  else if (lean > 0.25 && how !== 'offer' && c.traits.ambition > 0.45 && !num(s, 'asked:' + c.id)) { st = 'deal'; M(s)['asked:' + c.id] = 1; line = `${first(c)} thinks. “I can do that. And when the next racket comes up for a crew, I want it to be mine.”`; }
  else if (lean > 0.1) { st = 'stall'; line = `“Sure, sure,” ${first(c)} says, and changes the subject.`; }
  else { st = 'no'; line = `${first(c)} shakes his head. “Not this month. Tell ${first(boss)} I said so, if you like.”`; }
  M(s)['st:' + c.id] = st;
  if (how === 'lean') bear(w, c, ub.id, st === 'no' ? 0.15 : 0.05, `${ub.name} leaned on him for ${first(boss)}`);
  if (st === 'yes' || (st === 'deal' && how === 'offer')) comply(w, s, c);
  if (st === 'no' && (tp.pride > 0.5 || how === 'lean')) M(s)['over:' + c.id] = w.now + w.rng.int(1, 3) * DAY;
  return [line];
}
// what agreeing actually does
function comply(w: World, s: Situation, c: Character) {
  const kind = str(s, 'kind');
  if (kind === 'fund') { const share = Math.round(num(s, 'target') / Math.max(1, captains(w, c.familyId!).length) / 50) * 50; const paid = treasuryMove(w, c.familyId!, c, Math.min(share, c.cash), `${c.name}’s share, at the underboss’s asking`); M(s).paid = num(s, 'paid') + paid; M(s)['paid:' + c.id] = paid; }
  if (kind === 'quiet') for (const x of [c, ...crewOf(w, c)]) x.cooldown.restraint = Math.max(x.cooldown.restraint ?? 0, num(s, 'due'));
  if (kind === 'crew' && str(s, 'cap') === c.id) for (const x of crewOf(w, c)) { if (x.books.skim) delete x.books.skim; feel(w, x, c.id, 'respect', 0.02); bear(w, x, c.id, 0.03, `${c.name} leaned on the crew for their numbers`); }
}

// ------------------------------------------------------------------------------------------------ while the month runs
function step(w: World, s: Situation) {
  const p = P(w), boss = w.chars[(s.parties ?? []).find((x) => x.role === 'boss')!.id];
  if (!p?.alive || !boss?.alive || positionOf(w, p) !== 'underboss') return closeSit(w, s, 'overtaken', [], 6);
  // a captain who refused goes over his head; the boss backs one of them
  for (const c of captains(w, p.familyId!)) {
    const at = num(s, 'over:' + c.id);
    if (!at || at > w.now) continue;
    delete s.m!['over:' + c.id];
    const backs = peek(boss, p.id).trust + 0.1 >= peek(boss, c.id).trust;
    addFact(w, { kind: 'ruling', actor: boss.id, victim: c.id, minor: false, text: backs ? `${c.name} went to ${boss.name} over ${p.name}’s head. ${boss.name} told him to do as the underboss says.` : `${c.name} went to ${boss.name} over ${p.name}’s head, and ${boss.name} let him off.`, district: boss.district }, { witnesses: [boss.id, c.id, p.id] });
    if (backs) { M(s)['st:' + c.id] = 'yes'; comply(w, s, c); bear(w, c, p.id, 0.08, `${p.name} made him look small in front of ${boss.name}`); }
    else { M(s)['st:' + c.id] = 'excused'; for (const o of captains(w, p.familyId!)) if (o.id !== c.id) feel(w, o, p.id, 'respect', -0.03, `${boss.name} let ${c.name} go around the underboss`); }
  }
  if (s.phase === 'accounting') return finish(w, s);
  // a captain who stalls may come through, or not, by the end
  if (w.now >= num(s, 'due')) return judge(w, s, p, boss);
  s.next = w.now + w.rng.int(3, 5) * DAY;
}
function measure(w: World, s: Situation): { done: number; word: string } {
  const kind = str(s, 'kind'), f = w.fam[w.chars[w.playerId!].familyId!];
  if (kind === 'fund') { const d = num(s, 'paid') / Math.max(1, num(s, 'target')); return { done: d, word: `${money(num(s, 'paid'))} of ${money(num(s, 'target'))} came in` }; }
  if (kind === 'quiet') { const n = Object.values(w.facts).filter((x) => (x.kind === 'arrest' || x.kind === 'beating') && x.actor && w.chars[x.actor]?.familyId === f.id).length - num(s, 'f0'); return { done: n <= 1 ? 1 : n <= 3 ? 0.6 : 0.2, word: n ? `${n} ${n === 1 ? 'arrest or beating' : 'arrests and beatings'} while it ran` : 'not one arrest or beating while it ran' }; }
  const cap = w.chars[str(s, 'cap')], k = cap ? kickOf(w, cap) : 0, k0 = num(s, 'k0');
  return { done: k0 ? clamp(k / (k0 * 1.2), 0, 1.2) : stance(s, cap) === 'yes' ? 0.8 : 0.3, word: cap ? `${first(cap)}’s crew brought in ${money(k)} last week, against ${money(k0)} when it started` : 'the crew is gone' };
}
function judge(w: World, s: Situation, p: Character, boss: Character) {
  for (const c of captains(w, p.familyId!)) if (stance(s, c) === 'stall' && w.rng.chance(0.4)) comply(w, s, c);
  const m = measure(w, s);
  const good = m.done >= 0.8, poor = m.done < 0.4;
  feel(w, boss, p.id, 'trust', good ? 0.06 : poor ? -0.07 : 0, good ? `${p.name} got the captains to do what he asked` : poor ? `${p.name} couldn’t get the captains to do it` : undefined);
  for (const c of captains(w, p.familyId!)) if (num(s, 'owed:' + c.id)) addFavour(w, c.id, p.id, 2, 'the racket you promised him for his part');
  M(s).out = good ? 'done' : poor ? 'fell short' : 'half done'; M(s).word = m.word; M(s).verdict = good ? 'the boss is pleased' : poor ? 'the boss is not pleased' : 'the boss expected more';
  s.phase = 'accounting'; s.next = w.now + 4 * DAY;
  addEnc(w, { kind: 'matter', from: boss.id, title: `${first(boss)} wants an accounting`, days: 3, lines: [`${first(boss)}: “Well?” You tell him: ${m.word}. ${good ? 'He nods. It is the most he says.' : poor ? '“That’s it?” He doesn’t raise his voice. He doesn’t have to.' : '“Could be better.”'}`], opts: [{ code: 'ok', label: '“That’s where it stands.”', hint: good ? 'He’s pleased, in his way.' : 'He’ll remember it.' }], data: { sit: s.id, what: 'end' } });
}
function finish(w: World, s: Situation) { closeSit(w, s, str(s, 'out') || 'over', [str(s, 'word'), str(s, 'verdict')].filter(Boolean), 4); }

// ------------------------------------------------------------------------------------------------ the underboss's moves
MATTERS.charge = {
  title: (w, s) => TITLE[str(s, 'kind')] ?? 'The boss’s charge',
  step,
  stage: (w, s, p) => {
    if (!isOpen(s)) return s.out ?? 'settled';
    const caps = captains(w, p.familyId!), days = Math.max(0, Math.ceil((num(s, 'due') - w.now) / DAY));
    const word: Record<string, string> = { yes: 'agreed', deal: 'wants something for it', stall: 'said yes, means little', no: 'refused', excused: 'let off by the boss', '': 'not asked yet' };
    const who = str(s, 'kind') === 'crew' ? caps.filter((c) => c.id === str(s, 'cap')) : caps;
    const found = str(s, 'found') ? ` You found: ${str(s, 'found')}.` : '';
    return `${days} days left.${found} ${who.map((c) => `${first(c)}: ${word[stance(s, c)] ?? 'not asked yet'}`).join('; ')}.${str(s, 'kind') === 'fund' ? ` ${money(num(s, 'paid'))} of ${money(num(s, 'target'))} in.` : ''}`;
  },
  opts: (w, s, p, t) => {
    if (!isOpen(s) || s.phase === 'accounting' || (s.parties ?? []).find((x) => x.role === 'ub')?.id !== p.id) return [];
    const out: Opt[] = [];
    for (const c of captains(w, p.familyId!)) {
      if (t && t.id !== c.id) continue;
      if (str(s, 'kind') === 'crew' && str(s, 'cap') !== c.id) continue;
      const st = stance(s, c);
      if (st === 'yes' || st === 'excused') continue;
      if (!st || st === 'stall') out.push({ code: 'ask:' + c.id, label: `“${first(c)}, I need your help with something.”`, hint: str(s, 'kind') === 'fund' ? 'Ask him for his share.' : str(s, 'kind') === 'quiet' ? 'Ask him to keep his crew quiet for a month.' : str(s, 'cap') === c.id ? 'Ask him what’s wrong with his numbers, and to fix it.' : 'Ask for his help.', who: c.id });
      if (st !== 'no' || !num(s, 'leaned:' + c.id)) out.push({ code: 'lean:' + c.id, label: `“${first(c)}, this comes from the boss.”`, hint: 'Use the boss’s name. It works on most men. A proud one will take it over your head.', who: c.id });
      if (str(s, 'kind') === 'crew' && !num(s, 'why')) out.push({ code: 'why:' + c.id, label: `Find out what’s wrong with ${first(c)}’s crew`, hint: 'Spend a day around his men and his spots. What you find is what is there.' });
      if (st === 'deal') out.push({ code: 'offer:' + c.id, label: `“All right. You’ll have it.”`, hint: 'Promise him what he asked. He will hold you to it.', who: c.id });
    }
    return out.slice(0, t ? 3 : 6);
  },
  act: (w, s, p, code) => {
    if (code.startsWith('enc:end')) { finish(w, s); return [`${str(s, 'verdict').replace(/^./, (m) => m.toUpperCase())}.`]; }
    if (code.startsWith('enc:')) return [];
    if (code.startsWith('why:')) {
      const c = w.chars[code.slice(4)]; M(s).why = 1;
      if (!c) return [];
      const men = crewOf(w, c), skim = men.filter((x) => x.books.skim || x.books.hide), self = !!(c.books.skim || c.books.hide), inside = men.filter((x) => x.jailedUntil > w.now);
      const found = self ? `${first(c)} himself is keeping more than he should: his men pay him, and less of it comes up` : skim.length ? `${skim.map((x) => first(x)).join(' and ')} ${skim.length === 1 ? 'is' : 'are'} holding out on ${first(c)}, and he hasn’t caught it` : inside.length ? `${inside.map((x) => first(x)).join(' and ')} ${inside.length === 1 ? 'is' : 'are'} inside, and the crew is short-handed` : 'nobody is stealing: it has been a slow season on his streets';
      M(s).found = found;
      tell(w, s, `${p.name} spent a day around ${c.name}’s crew.`, { actor: p.id, victim: c.id, witnesses: [p.id, c.id], minor: true });
      if (self) bear(w, c, p.id, 0.05, `${p.name} has been looking into his crew`);
      return [`You spend a day around ${first(c)}’s men and his spots. ${found.charAt(0).toUpperCase() + found.slice(1)}.`];
    }
    const [how, id] = code.split(':') as ['ask' | 'lean' | 'offer', string];
    const c = w.chars[id];
    if (!c?.alive) return [];
    if (how === 'lean') M(s)['leaned:' + c.id] = 1;
    const lines = answer(w, s, p, c, how);
    tell(w, s, `${p.name} put the boss’s business to ${c.name}.`, { actor: p.id, victim: c.id, witnesses: [p.id, c.id], minor: true });
    return lines;
  },
};
registerStep('charge', (w, s) => step(w, s));
