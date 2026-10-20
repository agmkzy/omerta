// A situation is something going on in the world that has consequences whether or not the player is involved.
// It emerges from real state (a business losing money, a man in trouble), the people involved respond on their own,
// and it reaches the player through a believable channel: a conversation, a request for help, or a report.
import { addFact, clamp, createDebt, money, ownerBiz, rel } from './core';
import { bizMove } from './econ';
import { addEnc, addFavour, makeLoan } from './encounters';
import { Character, DAY, Enc, Id, Situation, WEEK, World } from './types';

const LIVING_LINE: Record<string, number> = { civilian: 70, associate: 100, soldier: 170, capo: 330, underboss: 520, boss: 900 };
const first = (c: Character) => c.name.split(' ')[0];
export const openSits = (w: World) => (w.situations ??= []).filter((s) => s.stage !== 'resolved');
export const sitOf = (w: World, who: Id) => openSits(w).find((s) => s.who === who);

function causeOf(w: World, c: Character): string | undefined {
  const b = ownerBiz(w, c.id);
  if (b && b.distress >= 1) { const rv = Object.values(w.biz).find((x) => x.open && x.id !== b.id && x.kind === b.kind && x.district === b.district); return rv ? `${b.name} is losing customers to ${rv.name}` : `${b.name} has been losing money`; }
  if (c.problem && c.problem.sev > 0.2) return ({ gambling: 'he’s in deep with a bookmaker', debt: 'he’s behind on money he owes', family: 'there’s trouble at home that costs money', drink: 'the drinking is costing him', house: 'he needs money for a place to live', woman: 'a woman is costing him', resentment: 'he thinks he’s being squeezed' } as Record<string, string>)[c.problem.kind];
  if (c.rank !== 'civilian' && c.cash < (LIVING_LINE[c.rank] ?? 100) * 0.8 && c.books.history.length > 0) return 'he’s run short of cash';
  return undefined;
}
const cleared = (w: World, c: Character, s: Situation) => {
  const b = s.biz ? w.biz[s.biz] : undefined;
  if (b && b.open && b.distress === 0 && b.cash > 150) return true;
  if (!b && !(c.problem && c.problem.sev > 0.2) && c.cash >= (LIVING_LINE[c.rank] ?? 100) * 0.6) return true;
  return false;
};

export function situationTick(w: World) {
  const p = w.chars[w.playerId!];
  if (!p?.alive) return;
  const list = (w.situations ??= []);
  // Emerge: anyone near the player's world who is in real trouble. Most of it never needs the player.
  const near = (c: Character) => c.bossId === p.id || c.familyId === p.familyId || w.biz[ownerBiz(w, c.id)?.id ?? '']?.protection?.collectorId === p.id;
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || c.rank === 'boss' || !near(c) || list.some((s) => s.who === c.id && s.stage !== 'resolved')) continue;
    if (list.some((s) => s.who === c.id && w.now - (s.resolvedAt ?? 0) < 4 * WEEK)) continue;
    const cause = causeOf(w, c);
    const rv = ownerBiz(w, c.id) && cause?.includes('losing customers to') ? Object.values(w.biz).find((x) => cause.endsWith(x.name))?.id : undefined;
    if (cause) list.push({ id: 's' + w.nextId++, kind: 'money', who: c.id, biz: ownerBiz(w, c.id)?.id, rival: rv, since: w.now, stage: 'brewing', cause, knows: false, told: false, weeks: 0 });
    else if (c.bossId === p.id && c.want && ['made', 'independent', 'lieutenant', 'rich'].includes(c.want.kind) && c.traits.ambition > 0.5)
      list.push({ id: 's' + w.nextId++, kind: 'ambition', who: c.id, since: w.now, stage: 'brewing', cause: ({ made: 'he wants to be made', independent: 'he wants out from under you', lieutenant: 'he wants to be your right hand', rich: 'he wants more money' } as Record<string, string>)[c.want.kind], knows: false, told: false, weeks: 0 });
  }
  for (const s of list) {
    if (s.stage === 'resolved') continue;
    if (s.key) continue; // V75 situations (src/situ.ts) run on their own clock
    const c = w.chars[s.who];
    if (!c?.alive) { s.stage = 'resolved'; s.resolvedAt = w.now; s.how = 'gone'; continue; }
    if (s.kind === 'turf' || s.kind === 'org') continue; // those run in pulse.ts
    if (s.key) continue; // V75 situations (src/situ.ts) run on their own clock
    s.weeks++;
    if (s.kind === 'ambition') {
      if (!c.want || !['made', 'independent', 'lieutenant', 'rich'].includes(c.want.kind) || c.rank !== 'associate' && c.want.kind === 'made') { s.stage = 'resolved'; s.resolvedAt = w.now; s.how = 'alone'; continue; }
      if (s.stage === 'brewing' && s.weeks >= 2) s.stage = 'handling';
      if (s.stage === 'handling' && s.weeks >= 3 && !s.asked && !w.enc.some((e) => e.kind === 'crew' && e.status === 'open')) { s.asked = w.now; s.stage = 'asking'; s.knows = true; askAmbition(w, p, c, s); }
      continue;
    }
    if (cleared(w, c, s)) {
      s.stage = 'resolved'; s.resolvedAt = w.now; s.how = s.helped ? 'helped' : 'alone';
      if (s.knows) addFact(w, { kind: 'report', actor: c.id, minor: true, text: s.helped ? `${c.name} is back on his feet. ${s.cause.replace(/^./, (m) => m.toUpperCase())}, and your help turned it around.` : `${c.name} sorted it out himself: ${s.cause}. No help needed.`, district: c.district }, { witnesses: [p.id] });
      continue;
    }
    if (s.stage === 'brewing' && s.weeks >= 1) s.stage = 'handling';
    // He asked and nothing came of it. Time passes, he tries again.
    if (s.stage === 'asking' && s.asked && w.now - s.asked > 10 * DAY && !w.enc.some((e) => e.from === c.id && e.status === 'open')) { s.stage = 'handling'; delete s.asked; s.weeks = Math.max(0, s.weeks - 2); }
    // He tries on his own first. Proud and capable men take longer to ask.
    if (s.stage === 'handling' && !s.asked) {
      const t = rel(c, p.id).trust;
      const proud = c.traits.ambition * 0.5 + c.traits.courage * 0.3;
      const patience = 1 + Math.round(proud * 2);
      if (s.weeks >= patience && t >= (c.bossId === p.id || c.familyId === p.familyId ? 0.12 : 0.25) && w.enc.filter((e) => e.kind === 'loan' && e.status === 'open').length < 2) {
        s.asked = w.now; s.stage = 'asking'; s.knows = true;
        makeLoan(w, p, c);
      } else if (s.weeks >= patience + 3 && t < 0.3) {
        // He goes to someone he trusts more. The situation moves on without you.
        const friend = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && x.id !== p.id && x.cash > 800 && (c.rels[x.id]?.trust ?? 0) > 0.3).sort((a, b) => b.cash - a.cash)[0];
        if (friend) { const g = Math.min(500, Math.round(friend.cash * 0.2)); friend.cash -= g; const b = s.biz ? w.biz[s.biz] : undefined; if (b) { bizMove(w, b, g, 'aid', friend.id); b.distress = 0; } else c.cash += g; createDebt(w, friend.id, c.id, g, 0.05, 'a loan'); rel(c, friend.id).trust = clamp(rel(c, friend.id).trust + 0.1); s.weeks = 0; }
      }
    }
    // Left to rot, a business gives out (the economy engine closes it); the situation records it.
    if (s.biz && w.biz[s.biz] && !w.biz[s.biz].open) { s.stage = 'resolved'; s.resolvedAt = w.now; s.how = 'closed'; }
  }
  // keep the record from growing without end. Only finished ones go (V89: this used to cut the oldest whatever their state, so
  // matters still under way vanished mid-course once the world had more than sixty of them; situ.ts prunes its own)
  const old = list.filter((s) => s.stage === 'resolved' && !s.key);
  if (old.length > 60) { const drop = new Set(old.slice(0, old.length - 60)); w.situations = list.filter((s) => !drop.has(s)); }
}

function askAmbition(w: World, p: Character, c: Character, s: Situation) {
  const f = first(c);
  const want = c.want!.kind;
  addEnc(w, {
    kind: 'crew', from: c.id, title: `${f} wants a word about his future`, days: 7,
    lines: [`${c.name} waits until you’re alone.`, want === 'made' ? '"I’ve put in my time. I want to know where I stand. I want to be made."' : want === 'independent' ? '"I’m not going to be somebody’s man forever. I want my own thing, and I’d rather you were part of it than against it."' : want === 'lieutenant' ? '"Anybody can see I’m the one who does the work. I want to be your right hand, and I want it said."' : '"I’m not complaining. I just see what I bring in, and what comes back."'],
    opts: [
      { code: 'back', label: want === 'made' ? 'Tell him you’ll put his name forward' : 'Promise him something real', hint: 'He’ll hold you to it. If you keep it, he’s yours.' },
      { code: 'pay', label: 'Give him a bigger piece ($300 now)', hint: 'Money buys time. It doesn’t buy him.' },
      { code: 'wait', label: 'Tell him it isn’t his time', hint: 'He’ll take it as an answer, or as an insult.' },
    ],
    data: { what: 'sit_ambition', sid: s.id },
  });
}
export function sitChoose(w: World, p: Character, e: Enc, code: string): string[] | undefined {
  if (e.data?.what !== 'sit_ambition') return undefined;
  const c = e.from ? w.chars[e.from] : undefined;
  const s = (w.situations ?? []).find((x) => x.id === e.data?.sid);
  if (!c || !s) return ['It has gone quiet.'];
  const r = rel(c, p.id);
  s.stage = 'resolved'; s.resolvedAt = w.now; s.helped = code !== 'wait'; s.how = code === 'wait' ? 'alone' : 'helped';
  if (code === 'back') { r.trust = clamp(r.trust + 0.12); r.respect = clamp(r.respect + 0.05); addFavour(w, p.id, c.id, 2, 'the promise you made about his future'); if (c.want) c.want.since = w.now; return [`${c.name} nods slowly. "I’ll remember you said that." He means it as a compliment and a warning.`]; }
  if (code === 'pay') { if (p.cash < 300) return ['You haven’t got it on you.']; p.cash -= 300; c.cash += 300; r.trust = clamp(r.trust + 0.04); return [`${c.name} takes it. "It’s a start." He’s still wanting what he wanted.`]; }
  r.trust = clamp(r.trust - 0.06); r.respect = clamp(r.respect - 0.02); c.traits.ambition = clamp(c.traits.ambition + 0.04);
  return [`${c.name} keeps his face still. "Understood." It will come back, and it will be less polite.`];
}

// What he says, when you ask how business is going. A proud man hides it; someone who trusts you doesn’t.
export function askAbout(w: World, p: Character, c: Character): string[] {
  const s = sitOf(w, c.id);
  if (!s) return [`${c.name}: "Business is business."`];
  const r = rel(c, p.id);
  const open = r.trust >= 0.4 || s.stage === 'asking' || c.traits.caution < 0.3;
  if (!open) { p.cooldown[`sitask:${c.id}`] = w.now + 3 * DAY; return [`${c.name} shrugs. "Fine. Slow, but fine."`, 'He isn’t telling you everything. Give it time, or ask someone who knows him.']; }
  s.told = true; s.knows = true;
  return [`${c.name} lets out a breath. "Since you ask. ${s.cause.replace(/^./, (m) => m.toUpperCase())}."`, 'He doesn’t ask you for anything. He wants you to see it.'];
}
export function helpWith(w: World, p: Character, c: Character, how: 'cover' | 'lend' | 'leave' | 'rival'): string[] {
  const s = sitOf(w, c.id);
  if (!s) return [];
  const b = s.biz ? w.biz[s.biz] : undefined;
  const r = rel(c, p.id);
  const amt = how === 'cover' ? 600 : 400;
  if (how === 'rival') {
    const rb = s.rival ? w.biz[s.rival] : undefined;
    if (!rb) return ['There’s nobody to lean on.'];
    const ro = w.chars[rb.ownerId];
    rb.distress += 1; if (b) b.distress = Math.max(0, b.distress - 1);
    p.heat = Math.min(1, p.heat + 0.04); r.trust = clamp(r.trust + 0.08); s.helped = true; s.knows = true;
    if (ro) rel(ro, p.id).grudge = clamp(rel(ro, p.id).grudge + 0.15);
    return [`A word goes to ${ro?.name ?? 'the owner of ' + rb.name}. Nothing violent. By the end of the week ${rb.name} is quieter and ${c.name}’s door is busier.`, `${ro ? first(ro) : 'He'} knows who sent it.`];
  }
  if (how === 'leave') { s.knows = true; r.respect = clamp(r.respect + 0.02); r.trust = clamp(r.trust - 0.06); return [`"You’ll work it out." ${c.name} nods once. He hears what you’re saying about what he’s worth to you.`]; }
  if (p.cash < amt) return [`You can’t put your hand on ${money(amt)} right now.`];
  p.cash -= amt; if (b) { bizMove(w, b, amt, 'aid', p.id); b.distress = Math.max(0, b.distress - 1); } else c.cash += amt;
  if (c.problem) c.problem.sev = clamp(c.problem.sev - 0.25);
  s.helped = true;
  if (how === 'cover') { addFavour(w, p.id, c.id, 2, `covering ${money(amt)} when things were bad`); r.trust = clamp(r.trust + 0.12); r.affection = clamp(r.affection + 0.1); return [`You cover ${money(amt)}. ${c.name} doesn’t say much. He doesn’t need to.`]; }
  createDebt(w, p.id, c.id, amt, 0.05, 'a loan from you'); r.trust = clamp(r.trust + 0.05);
  return [`You lend ${c.name} ${money(amt)} on the book. He signs the way a man does who means to pay.`];
}
void addEnc;
