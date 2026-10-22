// Settling a score: the player picks the method. Each method has its own price and its own reply.
import { bizMove } from './econ';
import { perform, tension } from './actions';
import { addFact, bear, bearAtLeast, clamp, easeOn, factText, famName, money, ownerBiz, rel, repute, witnessesAt } from './core';
import { askPermission, isMade, sanctioned } from './politics';
import { aftermath, warningFor, killMethods } from './violence';
import { handleDeath } from './core';
import { afterKilling } from './consequences';
import { Character, DAY, Fact, World } from './types';

export interface SettleOpt { code: string; label: string; hint?: string; danger?: boolean }

const SHAME = ['theft', 'shortfall', 'scam', 'betrayal', 'poach', 'informant', 'burglary', 'robbery'];

const shameOf = (w: World, p: Character, x: Character): Fact | undefined =>
  Object.values(w.facts).find((f) => f.actor === x.id && p.known[f.id]?.knowsActor && SHAME.includes(f.kind) && !f.minor);

export const superiorOf = (w: World, p: Character, x: Character): Character | undefined => {
  const b = x.bossId ? w.chars[x.bossId] : undefined;
  return b?.alive && b.id !== p.id ? b : undefined;
};

export function settleOptions(w: World, p: Character, x: Character, kill = false): SettleOpt[] {
  const o: SettleOpt[] = [];
  if (kill) {
    const wf = warningFor(w, p, x, 'hit');
    for (const m of killMethods(w, p, x)) {
      if (m.cost && p.cash < m.cost) continue;
      o.push({ code: 'hit:' + m.code, label: `${m.label}${m.cost ? ` ($${m.cost.toLocaleString()})` : ''}`, hint: `${Math.round(m.ok * 100)}% it works · ${Math.round(m.seen * 100)}% you're seen. ${m.what} ${wf}`, danger: true });
    }
    o.push({ code: 'back', label: 'Think better of it', hint: 'Go back.' });
    return o;
  }
  const made = isMade(x);
  const ok = sanctioned(w, p, x);
  const biz = ownerBiz(w, x.id);
  const sup = superiorOf(w, p, x);
  const mine = p.bossId ? w.chars[p.bossId] : undefined;
  const same = !!p.familyId && p.familyId === x.familyId;
  const pend = (w.pending ?? []).find((q) => q.kind === 'dispute' && q.a === p.id && q.b === x.id);
  if (pend) { const m = pend.c ? w.chars[pend.c] : undefined; o.push({ code: 'pend', label: `${m?.name ?? 'He'} is already on it`, hint: 'Give it a few days. You’ll hear.' }); }
  // Words first: always available and often the smartest play.
  if (sup && !pend) o.push({ code: 'sup', label: `Go to ${sup.name}`, hint: `${x.name} answers to him. Put it on the table.` });
  if (same && x.rank === p.rank && x.rank !== 'boss' && !(p.cooldown[`under:${x.id}`] > w.now)) o.push({ code: 'undercut', label: `Make sure the right people hear about ${x.name.split(' ')[0]}’s failings`, hint: 'Cheap and quiet. If it comes back to you, it costs you.' });
  if (!pend && !same && mine && mine.alive && (!sup || sup.familyId !== p.familyId)) o.push({ code: 'mine', label: `Take it to ${mine.name}`, hint: 'Let your own boss deal with the other family.' });
  const sh = shameOf(w, p, x);
  if (sh) o.push({ code: 'shame', label: `Let it be known what he did`, hint: 'Tell the right people. It costs him respect, not blood.' });
  {
    if (x.hurtUntil <= w.now) o.push({ code: 'beat', label: `Beat ${x.name} up`, hint: warningFor(w, p, x, 'beat'), danger: true });
    if (biz) {
      o.push({ code: 'smash', label: `Send a message through ${biz.name}`, hint: 'Break it up, no fire. A warning he can read.', danger: true });
      o.push({ code: 'rob', label: `Empty the till at ${biz.name}`, hint: 'It costs him, and it pays you.', danger: true });
      o.push({ code: 'torch', label: `Burn ${biz.name}`, hint: 'There’s no walking that back.', danger: true });
    }
    o.push({ code: 'whack', label: `Whack ${x.name}`, hint: `Choose how. The quieter it is, the likelier it fails. ${warningFor(w, p, x, 'hit')}`, danger: true });
  }
  if (made && !ok && !same) o.push({ code: 'perm', label: 'Ask permission to touch him', hint: 'He’s made. With your boss’s blessing it costs far less.' });
  o.push({ code: 'drop', label: 'Let it go', hint: 'Some men live longer for it.' });
  return o;
}

export function settleDo(w: World, p: Character, x: Character, code: string): { minutes: number; lines: string[]; done: boolean } {
  const L: string[] = [];
  const rng = w.rng;
  const rp = rel(p, x.id);
  const act = (mode: 'beat' | 'torch' | 'hit') => {
    const r = perform(w, { kind: 'retaliate', mode, actor: p.id, target: x.id, biz: ownerBiz(w, x.id)?.id, label: mode, score: 0 });
    return { minutes: r.minutes, lines: r.lines, done: true };
  };
  switch (code) {
    case 'beat': { const r = act('beat'); r.lines.push(...aftermath(w, p, x, 'beat')); return r; }
    case 'torch': return act('torch');
    case 'hit': case 'hit:open': case 'hit:street': case 'hit:ambush': case 'hit:contract': case 'hit:accident': case 'hit:poison': case 'hit:pro': {
      const m = killMethods(w, p, x).find((k) => 'hit:' + k.code === code) ?? killMethods(w, p, x)[0];
      if (m.cost) p.cash -= m.cost;
      const lines: string[] = [];
      const wit = witnessesAt(w, x.district, [p.id, x.id], 3);
      const seen = rng.chance(m.seen);
      const worked = rng.chance(m.ok);
      p.heat = clamp(p.heat + (worked ? (seen ? 0.6 : 0.25) : 0.15), 0, 1.5);
      const mins = rng.int(60, 180);
      if (!worked) {
        bearAtLeast(w, x, p.id, 0.95, `${p.name} tried to have him killed`); rel(x, p.id).trust = 0;
        if (m.code === 'poison' || m.code === 'accident') {
          lines.push(rng.chance(0.5) ? `It doesn’t take. ${x.name} gets ill, or gets lucky, and walks away none the wiser.` : `It goes wrong, and ${x.name} works out why. He knows it was meant for him.`);
          if (!rng.chance(0.5)) bearAtLeast(w, x, p.id, 0.3, `${p.name} may have tried to have him killed`);
        } else {
          lines.push(`${x.name} gets away. Shots, a slammed door, and now he knows exactly who wants him dead.`);
          x.hurtUntil = rng.chance(0.4) ? w.now + 4 * DAY : x.hurtUntil;
        }
        if (seen) {
          addFact(w, { kind: 'attempt', actor: p.id, victim: x.id, text: `${p.name} tried to have ${x.name} killed.`, district: x.district }, { witnesses: wit });
          lines.push('And someone saw your face.');
        }
        tension(w, p, x, 1);
        return { minutes: mins, lines, done: true };
      }
      const kin = Object.values(w.chars).filter((y) => y.alive && y.id !== x.id && ((x.familyId && y.familyId === x.familyId) || (y.rels[x.id]?.affection ?? 0) > 0.4)).map((y) => y.id);
      handleDeath(w, x.id);
      const mf = addFact(w, seen
        ? { kind: 'murder', actor: p.id, victim: x.id, text: `${p.name} killed ${x.name}.`, district: x.district }
        : { kind: 'murder', actor: p.id, victim: x.id, hiddenActor: true, text: `${p.name} had ${x.name} killed.`, textHidden: `${x.name} was found dead.`, district: x.district },
        { witnesses: seen ? (wit.length ? wit : witnessesAt(w, x.district, [p.id, x.id], 1)) : [], broadcast: kin });
      afterKilling(w, p, x, mf);
      tension(w, p, x, 3);
      lines.push(`${x.name} is dead. This can’t be undone.`);
      if (seen) {
        lines.push('It was in front of people. Your name will be said.');
        lines.push(...aftermath(w, p, x, 'hit'));
      } else if (rng.chance(m.code === 'pro' ? 0.08 : 0.4)) {
        lines.push('Nobody saw it, but the people who matter can add.');
        lines.push(...aftermath(w, p, x, 'hit'));
      } else lines.push('Clean. Nobody saw anything, and nobody is asking you.');
      return { minutes: mins, lines, done: true };
    }
    case 'smash': {
      const b = ownerBiz(w, x.id);
      if (!b) return { minutes: 10, lines: ['He has nothing left to break.'], done: false };
      b.damaged = Math.max(b.damaged, 1);
      bizMove(w, b, -120, 'damage');
      p.heat = clamp(p.heat + 0.05, 0, 1.5);
      const f = addFact(w, { kind: 'vandalism', actor: p.id, victim: x.id, business: b.id, text: `${p.name} had ${b.name} smashed up as a message to ${x.name}.`, textHidden: `Someone wrecked ${b.name}.`, district: b.district }, { witnesses: witnessesAt(w, b.district, [p.id, x.id], 3) });
      void f;
      bear(w, x, p.id, 0.1, `${p.name} had his place smashed up`);
      tension(w, p, x, 0.5);
      L.push(`Windows go, shelves go, nobody’s hurt. The owner of ${b.name} gets the message and the word travels to ${x.name} by supper.`);
      return { minutes: 80, lines: L, done: true };
    }
    case 'rob': {
      const b = ownerBiz(w, x.id);
      if (!b) return { minutes: 10, lines: ['There’s nothing to take.'], done: false };
      const take = Math.max(0, Math.min(Math.round(b.cash * 0.6), 900));
      bizMove(w, b, -take, 'theft', p.id);
      p.cash += take;
      p.heat = clamp(p.heat + 0.15, 0, 1.5);
      addFact(w, { kind: 'robbery', actor: p.id, victim: x.id, business: b.id, amount: take, text: `${p.name} cleaned out ${b.name}.`, district: b.district }, { witnesses: witnessesAt(w, b.district, [p.id, x.id], 3) });
      bear(w, x, p.id, 0.15, `${p.name} cleaned out his place`);
      tension(w, p, x, 0.7);
      L.push(take > 0 ? `You walk out of ${b.name} with ${money(take)}. ${x.name} won’t need to be told who.` : `${b.name} has nothing worth taking. The insult lands anyway.`);
      return { minutes: 75, lines: L, done: true };
    }
    case 'shame': {
      const f = shameOf(w, p, x);
      if (!f) return { minutes: 5, lines: ['There’s nothing you can prove.'], done: false };
      const people = Object.values(w.chars).filter((y) => y.alive && y.id !== p.id && y.id !== x.id && (y.familyId === x.familyId || y.district === x.district)).slice(0, 8);
      for (const y of people) {
        if (!y.known[f.id]) y.known[f.id] = { t: w.now, from: p.id, knowsActor: true };
        rel(y, x.id).respect = clamp(rel(y, x.id).respect - 0.1);
        rel(y, x.id).trust = clamp(rel(y, x.id).trust - 0.08);
      }
      bear(w, x, p.id, 0.08, `${p.name} turned people against him`);
      easeOn(rp, 0.6);
      L.push(`You say nothing loud. You say it to the right six people. By the weekend ${x.name} can’t walk into a room without a pause. ${factText(f, true)}`);
      return { minutes: 120, lines: L, done: true };
    }
    case 'undercut': {
      p.cooldown[`under:${x.id}`] = w.now + 21 * DAY;
      const boss = x.bossId ? w.chars[x.bossId] : undefined;
      const caught = rng.chance(clamp(0.25 + x.traits.caution * 0.1 - p.skills.charm * 0.1, 0.1, 0.5));
      if (caught) {
        bear(w, x, p.id, 0.25, `${p.name} spread lies about him`);
        repute(w, p, -8, 'lies');
        const b = w.chars[w.fam[p.familyId!].bossId]; if (b) rel(b, p.id).respect = clamp(rel(b, p.id).respect - 0.06);
        L.push(`You drop a word in two ears. One of them is ${x.name.split(' ')[0]}’s cousin. It’s back to him by dinner, and to the boss by the weekend: you’re a man who talks behind backs.`);
      } else {
        repute(w, x, -8, 'lies');
        if (boss) rel(boss, x.id).trust = clamp(rel(boss, x.id).trust - 0.07);
        const b = w.chars[w.fam[p.familyId!].bossId]; if (b) rel(b, x.id).trust = clamp(rel(b, x.id).trust - 0.05);
        L.push(`You say nothing you can’t take back. You say it to men who repeat it. By the end of the week people are quietly wondering about ${x.name.split(' ')[0]}.`);
      }
      return { minutes: 90, lines: L, done: true };
    }
    case 'pend': return { minutes: 5, lines: ['He’s already working on it. Pushing him would only annoy him.'], done: false };
    case 'sup':
    case 'mine': {
      const mid = code === 'sup' ? superiorOf(w, p, x) : p.bossId ? w.chars[p.bossId] : undefined;
      if (!mid?.alive) return { minutes: 5, lines: ['There’s nobody to take it to.'], done: false };
      const grievance = Object.values(w.facts).some((f) => f.victim === p.id && f.actor === x.id && p.known[f.id]);
      rel(mid, p.id).lastMet = w.now;
      (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(2, 4) * DAY, kind: 'dispute', a: p.id, b: x.id, c: mid.id, tries: 0, note: grievance ? 'true' : '' });
      p.cooldown[`sup:${x.id}`] = w.now + 30 * DAY;
      L.push(code === 'sup'
        ? `You put it to ${mid.name}: ${x.name} has been giving you grief. He listens, asks who else knows, and says he’ll talk to ${x.name} himself. "Give me a couple of days." Going over a man’s head is a card you only play once.`
        : `${mid.name} listens without interrupting. "I’ll speak to the ${x.familyId ? famName(w, x) : 'other'} side when I can. Do nothing until you hear from me." Take that as an order. A war should never begin with your boss finding out afterwards.`);
      return { minutes: 60, lines: L, done: true };
    }
    case 'perm': return { minutes: 60, lines: askPermission(w, p, x), done: true };
    case 'drop': {
      easeOn(rp, 0.4);
      L.push(`You let it go. ${x.name} will hear that you did, and may read it as either wisdom or weakness.`);
      rel(x, p.id).respect = clamp(rel(x, p.id).respect + (rel(x, p.id).grudge > 0.5 ? -0.03 : 0.02));
      return { minutes: 5, lines: L, done: true };
    }
  }
  return { minutes: 5, lines: [], done: false };
}
