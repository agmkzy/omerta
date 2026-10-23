// Work down the hierarchy (Stage 4, increment 4). One way for a superior to give a man work, the same for every superior and every
// man: an NPC captain sending a soldier, the player's boss sending the player, the player sending his own crew.
//
//   needsOf   what a superior actually needs done, read from his affairs: money owed him, shops on his book that are late, his crew's
//             ground still paying nobody, one of his men inside, a shop of his in trouble, a man who hurt one of his own
//   giveWork  the one door: he picks the man, the man may refuse; the work is a job carried out through the order model (orders.ts),
//             where a man may do it well, botch it, skim, gamble it away, show mercy, start a fight, and report something else
//   judge     the superior weighs the report; a lie may be caught, and what he concludes is on the record with its reason
//   delegate  a senior man puts one of his men in charge of an enterprise of his, and counts the take now and then
//
// Nothing here makes work up to keep men busy: no need, no job. A man's own enterprise is his own (rackets.ts); this is work for
// someone else.
import { temper } from './temper';
import { addFact, bear, clamp, feel, money, recordCareer, regard, rel, repute } from './core';
import { aptitude, lateOf } from './people';
import { crewGround, owedOf } from './econ';
import { shopInPlay } from './asks';
import { activityOf, assign, inHand, mkJob } from './jobs';
import { countOp, opRule, OPS } from './rackets';
import { Character, DAY, Id, Job, JobKind, World } from './types';

export interface Need { kind: JobKind; title: string; brief: string; target?: Id; biz?: Id; debt?: Id; cause?: Id; pay: number; why: string; weight: number }

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const open = (w: World, n: Pick<Need, 'kind' | 'target' | 'biz'>) => !inHand(w, n) && !w.jobs.some((q) => q.status === 'offered' && q.kind === n.kind && q.target === n.target && q.biz === n.biz);
export const menOf = (w: World, g: Character) => Object.values(w.chars).filter((c) => c.alive && c.bossId === g.id && c.id !== g.id).sort(byId);
const HOSTILE = ['beating', 'vandalism', 'robbery', 'poach'];

// What needs doing in a man's affairs, most pressing first. The same list for an NPC and for the player.
export function needsOf(w: World, g: Character): Need[] {
  const out: Need[] = [];
  const first = (c: Character) => c.name.split(' ')[0];
  // money owed him and not being paid
  for (const d of w.debts) {
    if (d.status !== 'active' || d.creditor !== g.id || d.missed < 1 || (g.cooldown['coll:' + d.id] ?? 0) > w.now) continue; // (he waits a while after sending someone)
    const t = w.chars[d.debtor];
    if (!t?.alive || t.isPlayer || t.bossId === g.id) continue;
    const n = { kind: 'collect' as const, target: t.id };
    if (open(w, n)) out.push({ ...n, debt: d.id, title: `Collect from ${t.name}`, brief: `${g.name} is owed ${money(d.balance)} by ${t.name}, who has missed ${d.missed} payment${d.missed > 1 ? 's' : ''}. Get the money; a quarter of it is yours.`, pay: 0, why: `Owes ${money(d.balance)}, ${d.missed} missed.`, weight: 0.6 + Math.min(0.3, d.missed * 0.08) });
  }
  // shops on his book that are behind
  for (const b of Object.values(w.biz)) {
    if (!b.open || b.protection?.collectorId !== g.id || lateOf(b) < 1) continue;
    const o = w.chars[b.ownerId];
    if (!o?.alive || o.isPlayer) continue;
    const n = { kind: 'shake' as const, target: o.id, biz: b.id };
    if (open(w, n)) out.push({ ...n, title: `Shake ${o.name} at ${b.name}`, brief: `${o.name} is behind at ${b.name}: ${money(Math.max(b.protection!.fee, owedOf(b)))}. ${first(g)} wants it.`, pay: 0, why: `Late ${lateOf(b)} time${lateOf(b) > 1 ? 's' : ''}, owes ${money(Math.max(b.protection!.fee, owedOf(b)))}.`, weight: 0.5 + Math.min(0.3, lateOf(b) * 0.1) });
  }
  // one of his men inside
  for (const m of menOf(w, g)) {
    if (m.jailedUntil - w.now < 5 * DAY || g.cash < 400) continue;
    const n = { kind: 'fix' as const, target: m.id };
    if (open(w, n)) out.push({ ...n, title: `Get ${m.name} out`, brief: `${m.name} is inside. A lawyer, a clerk and an envelope.`, pay: 400, why: 'A lawyer, a clerk, an envelope. $400.', weight: 0.5 });
  }
  // a man who hurt him or one of his men, that he knows of
  const mine = new Set([g.id, ...menOf(w, g).map((m) => m.id)]);
  for (const [id, k] of Object.entries(g.known)) {
    const f = w.facts[id];
    if (!f || !HOSTILE.includes(f.kind) || w.now - f.t > 20 * DAY || !f.victim || !mine.has(f.victim) || !f.actor || !k.knowsActor) continue;
    const t = w.chars[f.actor];
    if (!t?.alive || t.isPlayer || (t.familyId && t.familyId === g.familyId) || w.jobs.some((j) => j.cause === f.id)) continue;
    const n = { kind: 'handle' as const, target: t.id };
    if (open(w, n)) out.push({ ...n, cause: f.id, title: `${g.name} wants ${t.name} dealt with`, brief: `"${f.text}" ${g.name} won't let that stand.`, pay: 0, why: f.text, weight: 0.35 });
  }
  // his crew's ground: a shop there paying nobody (the other purpose behind an approach, beside a man's own book)
  if (['capo', 'underboss', 'boss'].includes(g.rank) || g.isPlayer && g.rank !== 'associate') {
    const ground = crewGround(w, g);
    const b = Object.values(w.biz).filter((x) => x.open && x.kind !== 'casino' && !x.protection && ground.has(x.district) && w.chars[x.ownerId]?.alive && !w.chars[x.ownerId].isPlayer && !w.chars[x.ownerId].familyId && !shopInPlay(w, x.id) && (x.lastApproach === undefined || w.now - x.lastApproach > 7 * DAY)).sort((a, c) => c.income - a.income || byId(a, c))[0];
    if (b) {
      const o = w.chars[b.ownerId], n = { kind: 'lean' as const, target: o.id, biz: b.id };
      if (open(w, n)) out.push({ ...n, title: `Bring ${b.name} under the family`, brief: `${b.name} in ${b.district} is in ${first(g)}'s ground and paying nobody. ${o.name} owns it. Put it on your book.`, pay: 0, why: 'In the crew’s ground. Nobody looks after it yet.', weight: 0.4 });
    }
  }
  // a shop on his book that has had trouble
  for (const b of Object.values(w.biz)) {
    if (!b.open || b.protection?.collectorId !== g.id || b.damaged <= 0 || (b.guardedUntil ?? 0) > w.now) continue;
    const n = { kind: 'guard' as const, biz: b.id };
    if (open(w, n)) out.push({ ...n, title: `Guard ${b.name}`, brief: `${b.name} has had trouble. Be seen there for a week.`, pay: 0, why: 'A week of being seen. Quiets trouble.', weight: 0.3 });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// Whom a superior sends: one of his own men who is free, suited to the work and trusted with it. The player is one of his men like
// any other, and isn't sent on something while he still has work from him on his plate.
export function pickMan(w: World, g: Character, n: Need, men = menOf(w, g)): Character | undefined {
  const cands = men.filter((m) => m.id !== n.target && !activityOf(w, m) && (!m.isPlayer || !w.jobs.some((j) => j.via === 'boss' && j.assignee === m.id && (j.status === 'offered' || j.status === 'active'))));
  let best: Character | undefined, top = -1;
  for (const m of cands) {
    const s = aptitude(m, n.kind) * 0.6 + rel(g, m.id).trust * 0.5 + w.rng.next() * 0.1;
    if (s > top) { top = s; best = m; }
  }
  return best;
}

// A man may say no: to a superior he holds something against or doesn't rate, or to rough work that isn't in him.
function refuses(w: World, g: Character, m: Character, n: Need): boolean {
  const r = rel(m, g.id), tp = temper(m);
  const rough = ['collect', 'shake', 'lean', 'handle'].includes(n.kind) ? Math.max(0, 0.3 - m.traits.violence) * 0.4 : 0;
  return w.rng.chance(clamp(r.grudge * 0.9 - r.respect * 0.3 - (r.fear ?? 0) * 0.4 + tp.pride * 0.08 + rough - 0.12, 0, 0.8));
}

// The one door through which any superior gives a man work. The player gets it as an offer he can take or turn down (his Today
// screen); an NPC weighs it on the spot.
export function giveWork(w: World, g: Character, m: Character, n: Need, orders: 'quiet' | 'hard' = 'quiet'): Job | string {
  const base = { kind: n.kind, title: n.title, brief: n.brief, target: n.target, biz: n.biz, debt: n.debt, cause: n.cause, pay: n.pay };
  if (m.isPlayer) return mkJob(w, { ...base, giver: g.id, via: 'boss', assignee: m.id, days: 5 });
  const busy = activityOf(w, m);
  if (busy) return `${m.name} is ${busy.why}. Pick someone else.`;
  if (refuses(w, g, m, n)) {
    bear(w, g, m.id, 0.08, `${m.name} refused his order`);
    feel(w, g, m.id, 'trust', -0.05);
    recordCareer(w, m, `Refused: ${n.title}`, false);
    addFact(w, { kind: 'report', actor: m.id, victim: g.id, text: `${m.name} refused when ${g.name} told him: ${n.title.replace(/^(.)/, (c) => c.toLowerCase())}.`, district: m.district }, { witnesses: [g.id, m.id] });
    return `${m.name} won’t do it. He doesn’t say why, and he doesn’t have to.`;
  }
  if (n.debt) g.cooldown['coll:' + n.debt] = w.now + 3 * 7 * DAY;
  const before = w.jobs.length;
  const j = mkJob(w, { ...base, giver: g.isPlayer ? null : g.id, via: 'order', assignee: m.id, status: 'offered', days: 3 });
  const err = assign(w, j, m.id, orders);
  if (err) { if (w.jobs.length > before && j.status === 'offered') w.jobs.splice(w.jobs.indexOf(j), 1); return err; }
  j.due = w.now + w.rng.int(1, 2) * DAY;
  rel(m, g.id).lastMet = w.now;
  return j;
}

// An NPC superior weighs what he was told. He can see some of it for himself (money owed him that didn't arrive), and a careful man
// checks; a lie found out is a grudge with its reason, a fall in trust and a word that gets round. An honest report, good or bad,
// is taken as it comes. (The player judges his own men himself: orders.questionReport.)
export function judge(w: World, j: Job) {
  const g = j.giver ? w.chars[j.giver] : undefined, m = w.chars[j.assignee], rep = j.rep;
  if (!g || g.isPlayer || !m || !rep || j.status === 'active') return;
  if (!rep.lie) {
    if (j.status === 'done') { regard(w, g, m, 'trust', 0.05, 'job'); regard(w, g, m, 'respect', 0.03, 'job'); }
    else if (rep.truth === 'bungle') feel(w, g, m.id, 'trust', -0.03);
    return;
  }
  const sees = ['collect', 'shake'].includes(j.kind) ? 0.25 : 0; // he knows what was owed him
  if (!w.rng.chance(clamp(0.25 + temper(g).caution * 0.3 + sees, 0.1, 0.85))) return;
  rep.found = true;
  feel(w, g, m.id, 'trust', -0.12);
  const what = rep.truth === 'skim' ? 'kept part of it' : rep.truth === 'gamble' ? 'lost it at cards' : 'lied about it';
  const f = addFact(w, { kind: 'discipline', actor: g.id, victim: m.id, amount: rep.amt, text: `${g.name} found out ${m.name} ${what} on "${j.title}".`, district: m.district }, { witnesses: [g.id, m.id] });
  bear(w, g, m.id, 0.2, f);
  repute(w, m, -3, 'caught');
  recordCareer(w, m, `Caught out: ${j.title}`, false);
  const back = Math.min(Math.max(0, m.cash), rep.amt ?? 0);
  if (back > 0) { m.cash -= back; g.cash += back; }
}

// A senior man doesn't run his enterprises himself: he puts one of his men on them, and now and then counts the take. A runner may
// skim (rackets.ts); a count that doesn't add up is found out, and what the owner does about it follows his temperament.
export function delegate(w: World, g: Character) {
  if (!['capo', 'underboss', 'boss'].includes(g.rank)) return;
  for (const op of w.ops.filter((o) => o.owner === g.id && o.kind !== 'hijack' && (o.state === 'running' || o.state === 'raided')).sort(byId)) {
    const d = OPS[op.kind as keyof typeof OPS];
    if (!op.runner || !w.chars[op.runner]?.alive) {
      const m = menOf(w, g).filter((x) => !x.isPlayer && x.jailedUntil <= w.now && !w.ops.some((o) => o.runner === x.id && o.state !== 'closed' && o.state !== 'done'))
        .sort((a, b) => aptitude(b, d.skill) + rel(g, b.id).trust - aptitude(a, d.skill) - rel(g, a.id).trust || byId(a, b))[0];
      if (m) {
        op.runner = m.id;
        recordCareer(w, m, `Put in charge of ${g.name}'s ${d.label.toLowerCase()}`, true);
        addFact(w, { kind: 'report', actor: g.id, victim: m.id, text: `${g.name} put ${m.name} in charge of his ${d.label.toLowerCase()} in ${op.district}.`, district: op.district }, { witnesses: [g.id, m.id] });
      }
      continue;
    }
    // a count, now and then: more often for a careful man, and when the take has fallen
    if (op.skimmed <= 0 || !w.rng.chance(0.08 + temper(g).caution * 0.2 + (op.last < 0 ? 0.1 : 0))) continue;
    const r = w.chars[op.runner];
    const { found } = countOp(w, g, op);
    if (found <= 30) continue;
    const tp = temper(g);
    const code = tp.volatility > 0.6 || tp.pride > 0.7 ? 'fire' : g.traits.greed > 0.55 ? 'repay' : 'warn';
    const f = addFact(w, { kind: 'discipline', actor: g.id, victim: r.id, amount: found, text: `${g.name} found ${r.name} had been skimming his ${d.label.toLowerCase()}: about ${money(found)}.${code === 'fire' ? ' He took it off him.' : code === 'repay' ? ' He made him pay it back.' : ' He told him it stops.'}`, district: op.district }, { witnesses: [g.id, r.id] });
    bear(w, g, r.id, 0.15, f);
    repute(w, r, -2, 'caught');
    opRule(w, g, op, code, found);
  }
}

// Each week every NPC superior looks at what needs doing and hands it out to whichever of his men are free. Nothing is handed out
// that isn't needed, and no more than he has men for.
export function workWeek(w: World) {
  const supers = Object.values(w.chars).filter((g) => g.alive && !g.isPlayer && g.familyId && g.jailedUntil <= w.now && ['soldier', 'capo', 'underboss', 'boss'].includes(g.rank)).sort(byId);
  for (const g of supers) {
    delegate(w, g);
    let men = menOf(w, g);
    if (!men.length) continue;
    const hard = temper(g).volatility > 0.6 ? 'hard' : 'quiet';
    for (const n of needsOf(w, g)) {
      if (!men.length) break;
      const m = pickMan(w, g, n, men);
      if (!m) continue;
      men = men.filter((x) => x !== m);
      giveWork(w, g, m, n, hard);
    }
  }
}
