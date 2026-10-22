// V75: the player's side of situations. What he can see (only what he has been told or witnessed), and what he can do about it.
// Availability depends on rank, on who trusts him, and on what he knows; nothing here reads a situation's hidden `truth`.
import { clamp, learn, rel, repute } from './core';
import { LADDER } from './rank';
import * as situ from './situ';
import { attendees, chairPick, claim, closeSit, hold, isOpen, kitOf, know, stanceOf, tell, titleOf } from './situ';
import { Character, DAY, Id, Situation, World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const rk = (c: Character) => LADDER.indexOf(c.rank);
export interface Move { code: string; label: string; hint: string; who?: Id }

export const knownFacts = (w: World, p: Character, s: Situation) =>
  Object.keys(p.known).map((id) => w.facts[id]).filter((f) => f && f.story === 'sit:' + s.id).sort((a, b) => b.t - a.t);
export const isParty = (s: Situation, id: Id) => s.who === id || (s.parties ?? []).some((x) => x.id === id);
// A matter is on the player's list when he is in it or has been told about it.
export const visibleTo = (w: World, p: Character, s: Situation) => !!s.kind && !!s.key && (isParty(s, p.id) || knownFacts(w, p, s).length > 0);

export function movesFor(w: World, p: Character, s: Situation): Move[] {
  if (!isOpen(s) || !s.kind) return [];
  const out: Move[] = [];
  const cd = (k: string) => Number(s.m?.[k + ':' + p.id] ?? 0) > w.now;
  const parts = attendees(s).filter((id) => id !== p.id && w.chars[id]?.alive);
  const party = isParty(s, p.id);
  if (!cd('inq') && s.stage !== 'asking') out.push({ code: 'inquire', label: 'Ask around', hint: 'Someone who trusts you may tell you what they know. Word gets back that you were asking.' });
  if (kitOf(s) && s.stage !== 'asking' && !party && parts.length >= 2) {
    const bothLike = parts.every((id) => rel(w.chars[id], p.id).respect >= 0.3);
    if ((rk(p) >= 1 && bothLike) || rk(p) >= 2) out.push({ code: 'mediate', label: 'Offer to settle it', hint: 'Sit them down and decide. Whoever you rule against will remember it.' });
  }
  if (!party) for (const id of parts.slice(0, 3)) if (rel(p, id).trust >= 0.3 && rel(w.chars[id], p.id).trust >= 0.2 && !cd('sup'))
    out.push({ code: 'support', label: `Speak up for ${first(w.chars[id])}`, hint: 'It weighs with whoever decides. It costs you with the other side.', who: id });
  if (s.kind === 'skim' && !party) {
    const acc = (s.parties ?? []).find((x) => x.role === 'accused')?.id;
    if (acc && w.chars[acc]?.alive && rel(p, acc).trust >= 0.3 && !cd('vouch')) out.push({ code: 'vouch', label: `Vouch for ${first(w.chars[acc])}`, hint: 'If he is lying, you wear it.', who: acc });
  }
  if (s.kind === 'debt' && s.link?.debt) {
    const d = w.debts.find((x) => x.id === s.link!.debt);
    if (d && d.debtor === p.id && d.status === 'active') out.push({ code: 'negotiate', label: 'Ask for terms', hint: 'Go to him yourself.', who: d.creditor });
  }
  return out;
}

// The player asks the debtor-side question on a debt he owes: the creditor answers from his own interests.
export function negotiateDebt(w: World, p: Character, debtId: Id): string[] {
  const d = w.debts.find((x) => x.id === debtId);
  if (!d || d.debtor !== p.id || d.status !== 'active') return ['There is nothing to negotiate.'];
  const cr = w.chars[d.creditor];
  if (!cr?.alive) return ['He is gone.'];
  const key = `debt:${d.id}`;
  let s = (w.situations ?? []).find((x) => x.key === key && isOpen(x));
  if (!s) {
    const spawn = situ.spawn;
    s = spawn(w, 'debt', key, p.id, { cause: `${p.name} asked ${cr.name} for terms`, parties: [{ id: cr.id, role: 'creditor' }, { id: p.id, role: 'debtor' }], sev: 0.2, phase: 'neg', next: w.now + 30 * DAY, truth: 'unable', amt: d.balance, link: { debt: d.id } });
    if (!s) return ['It is not a good time to ask.'];
    s.stage = 'handling';
  }
  know(w, s, p.id, 2, 'self'); know(w, s, cr.id, 2, 'asked');
  const kit = kitOf(s)!;
  const st = stanceOf(w, s, cr.id);
  // He gives what suits him, or something near it; the player picks his best ask, and the creditor accepts what he can live with.
  const ask = ['writedown', 'restructure', 'extend'].find((o) => kit.util(w, s!, cr.id, o) >= kit.util(w, s!, cr.id, st.want) - st.flex) ?? 'enforce';
  const said = hold(w, s, cr, ask).said;
  return [said];
}

export function doMove(w: World, p: Character, sid: Id, code: string, who?: Id): { lines: string[]; minutes: number } {
  const s = (w.situations ?? []).find((x) => x.id === sid);
  if (!s || !isOpen(s)) return { lines: ['It has been settled.'], minutes: 5 };
  if (!movesFor(w, p, s).some((m) => m.code === code && m.who === who)) return { lines: ['That is not open to you now.'], minutes: 5 };
  const mset = (k: string, days: number) => { s.m = { ...(s.m ?? {}), [k + ':' + p.id]: w.now + days * DAY }; };
  if (code === 'inquire') {
    mset('inq', 5);
    const friends = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && s.k?.[c.id] && rel(c, p.id).trust >= 0.25 && !isParty(s, c.id));
    const sources = [...friends, ...attendees(s).map((id) => w.chars[id]).filter((c) => c?.alive && c.id !== p.id && rel(c, p.id).trust >= 0.45)];
    const src = sources.sort((a, b) => rel(b, p.id).trust - rel(a, p.id).trust)[0];
    // Asking is noticed by the people it is about.
    for (const id of attendees(s)) if (id !== p.id && w.rng.chance(0.3)) { const r = rel(w.chars[id], p.id); r.respect = clamp(r.respect - 0.01); if (id === src?.id) continue; }
    if (!src) return { lines: ['Nobody who knows is willing to talk to you about it.'], minutes: 45 };
    const unknown = Object.keys(src.known).map((id) => w.facts[id]).filter((f) => f && f.story === 'sit:' + s.id && !p.known[f.id]).sort((a, b) => b.t - a.t);
    if (!unknown.length) return { lines: [`${src.name} tells you what you already have.`], minutes: 45 };
    const f = unknown[0];
    learn(w, p.id, f, 'told', true);
    know(w, s, p.id, 1, 'asked ' + first(src));
    s.knows = true;
    const cl = (s.claims ?? []).find((x) => x.by === src.id);
    return { lines: [`${src.name} tells you: “${f.text}”`, ...(cl && cl.text !== f.text ? [`He says: ${cl.text}`] : []), 'That is what he says. Whether it is so is another matter.'], minutes: 45 };
  }
  if (code === 'mediate') {
    const parts = attendees(s).filter((id) => w.chars[id]?.alive && id !== p.id);
    const refuse = parts.find((id) => rel(w.chars[id], p.id).respect < 0.3);
    if (refuse) return { lines: [`${w.chars[refuse].name} will not sit across from you.`], minutes: 20 };
    for (const id of parts) know(w, s, id, 2, 'sat down');
    const pick = chairPick(w, s, p);
    const v = hold(w, s, p, pick); // the player's offer is a recommendation; the table settles on what the man in the chair would settle on
    repute(w, p, (v.opposed.length ? 0 : 1), 'ruling');
    return { lines: [v.said, v.opposed.length ? `${v.opposed.map((id) => first(w.chars[id])).join(', ')} did not like it.` : 'Everyone at the table can live with it.'], minutes: 90 };
  }
  if (code === 'support' && who) {
    mset('sup', 14);
    s.m = { ...(s.m ?? {}), ['sup:' + who]: Number(s.m?.['sup:' + who] ?? 0) + 0.35 };
    rel(w.chars[who], p.id).trust = clamp(rel(w.chars[who], p.id).trust + 0.08);
    for (const id of attendees(s)) if (id !== who && id !== p.id && w.chars[id]) rel(w.chars[id], p.id).respect = clamp(rel(w.chars[id], p.id).respect - 0.04);
    tell(w, s, `${p.name} spoke up for ${w.chars[who].name}.`, { actor: p.id, minor: true, witnesses: attendees(s) });
    return { lines: [`You put your weight behind ${w.chars[who].name}. Everybody will hear about it.`], minutes: 30 };
  }
  if (code === 'vouch' && who) {
    mset('vouch', 21);
    const guilty = s.truth === 'guilty';
    s.m = { ...(s.m ?? {}), cert: clamp(Number(s.m?.cert ?? 30) - 15, 0, 100) };
    claim(w, s, p.id, `${p.name} vouched for ${w.chars[who].name}.`, !guilty);
    tell(w, s, `${p.name} told ${w.chars[(s.parties ?? []).find((x) => x.role === 'boss')?.id ?? who].name} that ${w.chars[who].name} is straight.`, { actor: p.id, victim: (s.parties ?? []).find((x) => x.role === 'boss')?.id, minor: true });
    // If he was lying to everyone, that comes back on the man who vouched.
    s.m.vouched = Number(s.m.vouched ?? 0) + 1;
    return { lines: [`You tell them ${w.chars[who].name} is straight. If you’re wrong, that’s on you too.`], minutes: 30 };
  }
  if (code === 'negotiate' && s.link?.debt) return { lines: negotiateDebt(w, p, s.link.debt), minutes: 60 };
  return { lines: ['Nothing came of it.'], minutes: 10 };
}
void titleOf;
void closeSit;

// What a room looks like when people in it have something between them. You see behaviour, not causes, unless you were told the cause.
export function sceneLines(w: World, p: Character, here: Character[]): string[] {
  const out: string[] = [];
  for (const s of w.situations ?? []) {
    if (!isOpen(s) || !s.kind || !s.key || (s.sev ?? 0) < 0.3 || ['dispute', 'crew', 'turf', 'org', 'money', 'ambition'].includes(s.kind)) continue;
    const at = attendees(s).map((id) => here.find((c) => c.id === id)).filter((c): c is Character => !!c && c.id !== p.id);
    if (at.length >= 2) out.push(`${at[0].name} and ${at[1].name} are at opposite ends of the room. Neither looks at the other.`);
    else if (at.length === 1 && s.kind !== 'intel') out.push(`${at[0].name} keeps to himself tonight${visibleTo(w, p, s) ? ', and you know why' : ''}.`);
    if (out.length >= 1) break;
  }
  return out;
}
export function personTexture(w: World, p: Character, c: Character): string[] {
  const out: string[] = [];
  for (const s of w.situations ?? []) {
    if (!isOpen(s) || !s.kind || !s.key || !isParty(s, c.id) || c.id === p.id || !visibleTo(w, p, s)) continue;
    if (['dispute', 'crew', 'turf', 'org', 'money', 'ambition'].includes(s.kind)) continue;
    out.push(`${first(c)} has something on his mind: ${titleOf(w, s).toLowerCase()}.`);
  }
  return out.slice(0, 2);
}

// ---------------------------------------------------------------- word that reaches the player (V75 tuning)
// What a man could pass to the player, given only what he himself knows: the newest fact about a live matter that the player has not heard.
// Rank, trust and the source's own position decide what he will say; nothing is made up and nothing comes from a man who was not told.
const secretKind = (s: Situation) => s.kind === 'intel';
const levelOf = (w: World, s: Situation) => Math.max(0, ...(s.parties ?? []).map((x) => (w.chars[x.id] ? rk(w.chars[x.id]) : 0)));
export const rankMult = (p: Character) => 1 + 0.25 * Math.max(0, rk(p)) + p.standing / 250;
export function whisper(w: World, p: Character, src: Character, mode: 'club' | 'friend'): { f: import('./types').Fact; s: Situation } | undefined {
  const t = rel(src, p.id).trust;
  let best: { f: import('./types').Fact; s: Situation } | undefined;
  for (const s of w.situations ?? []) {
    if (!s.kind || !s.key || ['dispute', 'crew', 'turf', 'org', 'money', 'ambition'].includes(s.kind) || (s.sev ?? 0) < 0.3) continue;
    if (!isOpen(s) && w.now - (s.resolvedAt ?? 0) > 14 * DAY) continue;
    if (isParty(s, p.id)) continue;
    if (Number(s.m?.['tp'] ?? -1e9) > w.now - 5 * DAY) continue; // the same matter is not brought up again straight away
    // a man talks freely about what is not his own business, and carefully about what is
    if (isParty(s, src.id) && t < 0.5) continue;
    // matters far above the listener's rank are only passed on by someone who trusts him
    if (levelOf(w, s) - Math.max(0, rk(p)) >= 2 && t < 0.45) continue;
    if (secretKind(s) && (src.traits.sociability < 0.7 || t < 0.5)) continue;
    if (mode === 'friend' && t < 0.3) continue;
    for (const id of Object.keys(src.known)) {
      const f = w.facts[id];
      if (!f || f.story !== 'sit:' + s.id || p.known[id] || f.kind === 'sitdown' && w.now - f.t > 14 * DAY) continue;
      if (!best || f.t > best.f.t) best = { f, s };
    }
  }
  return best;
}
const passOn = (w: World, p: Character, src: Character, hit: { f: import('./types').Fact; s: Situation }, how: string) => {
  learn(w, p.id, hit.f, src.id, true);
  know(w, hit.s, p.id, 1, how + ' ' + first(src));
  hit.s.m = { ...(hit.s.m ?? {}), tp: w.now };
  hit.s.knows = true;
};
// An evening at the club: the men who are there and know something may let it drop, more readily to a man they trust and respect.
export function clubTalk(w: World, p: Character, here: Character[]): string[] {
  const out: string[] = [];
  const m = rankMult(p);
  for (const c of here) {
    if (out.length >= 2) break;
    if (c.id === p.id || !c.alive) continue;
    const r = rel(c, p.id);
    const chance = Math.min(0.75, (0.1 + c.traits.sociability * 0.22 + r.trust * 0.25 + r.respect * 0.1) * m);
    if (!w.rng.chance(chance)) continue;
    const hit = whisper(w, p, c, 'club');
    if (!hit) continue;
    passOn(w, p, c, hit, 'overheard from');
    const how = r.trust >= 0.45 ? `${c.name} lowers his voice and tells you` : `You half-hear ${c.name} telling the man beside him`;
    out.push(`${how}: ${hit.f.text.replace(/^[^:]+ says: /, '')}`);
    w.sitpace!.stats = w.sitpace!.stats ?? {}; w.sitpace!.stats['club'] = (w.sitpace!.stats['club'] ?? 0) + 1;
  }
  return out;
}
// Once a week the people close to the player may bring him something. At most one a week, and never the same matter twice within five days.
export function friendsTell(w: World) {
  const p = w.chars[w.playerId ?? ''];
  if (!p?.alive) return;
  const m = rankMult(p);
  const near = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank !== 'civilian' && c.jailedUntil <= w.now && (c.familyId === p.familyId) && rel(c, p.id).trust >= 0.3);
  near.sort((a, b) => rel(b, p.id).trust - rel(a, p.id).trust);
  for (const c of near) {
    const r = rel(c, p.id);
    if (!w.rng.chance(Math.min(0.5, (0.03 + c.traits.sociability * 0.07 + r.trust * 0.08 + (c.bossId === p.id || p.bossId === c.id ? 0.04 : 0)) * m))) continue;
    const hit = whisper(w, p, c, 'friend');
    if (!hit) continue;
    passOn(w, p, c, hit, 'told by');
    const f2 = w.facts[hit.f.id]; void f2;
    w.sitpace!.stats = w.sitpace!.stats ?? {}; w.sitpace!.stats['friend'] = (w.sitpace!.stats['friend'] ?? 0) + 1;
    w.sitpace!.weekVis++; w.sitpace!.lastVisible = w.now;
    return;
  }
}
