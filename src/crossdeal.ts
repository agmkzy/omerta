// A man from another family proposes a job (the compelling-RPG stage). He has seen a place nobody of either family looks after, and he
// would rather split it with a man he can use than do it short-handed. Doing business with another family is his captain's business:
// the player does it quietly and keeps all of it (and it can come out), takes it to his captain first (who says yes, or says not with
// them), or turns it down. The job itself is the world's ordinary burglary (jobs.ts): its risk, its heat, the arrest, the goods and the
// fence, and the place's protector who may want to know who did it.
import { addFact, bear, feel, repute } from './core';
import { addEnc } from './encounters';
import { mkJob } from './jobs';
import { temper } from './temper';
import { imposed } from './imposed';
import { DAY, type Business, type Character, type Enc, type Pending, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const tension = (w: World, a?: string | null, b?: string | null) => (a && b ? (w.fam[a]?.tension?.[b] ?? 0) : 0);

/** Who might come to the player with a job, and where: a made man of another family, not at war with his and with nothing against him,
 *  once the player has a name, and a place neither family looks after. */
export function dealer(w: World, p: Character): { x: Character; cap: Character; b: Business } | undefined {
  const cap = p.bossId ? w.chars[p.bossId] : undefined;
  if (!cap?.alive || !p.familyId || !['associate', 'soldier'].includes(p.rank) || p.jailedUntil > w.now || p.standing < 30) return undefined;
  if ((p.cooldown['crossdeal'] ?? 0) > w.now || w.enc.some((e) => e.kind === 'crossdeal' && e.status === 'open')) return undefined;
  const x = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId && c.familyId !== p.familyId && ['soldier', 'capo'].includes(c.rank) && c.jailedUntil <= w.now
    && c.traits.greed > 0.5 && tension(w, p.familyId, c.familyId) < 3 && (c.rels[p.id]?.grudge ?? 0) < 0.2)
    // (a man with a name gets heard of: the one who knows him best comes, else the one on his ground, else the greediest; read, not
    // created, since looking at a man doesn't make a relationship)
    .sort((a, b) => (b.rels[p.id]?.trust ?? -1) - (a.rels[p.id]?.trust ?? -1) || (b.district === p.district ? 1 : 0) - (a.district === p.district ? 1 : 0) || b.traits.greed - a.traits.greed || (a.id < b.id ? -1 : 1))[0];
  if (!x) return undefined;
  const b = Object.values(w.biz).filter((q) => q.open && q.income >= 150 && q.protection?.familyId !== p.familyId && q.protection?.familyId !== x.familyId && w.chars[q.ownerId]?.alive && !w.chars[q.ownerId].isPlayer)
    .sort((a, c) => (c.district === x.district ? 1 : 0) - (a.district === x.district ? 1 : 0) || c.income - a.income || (a.id < c.id ? -1 : 1))[0];
  return b ? { x, cap, b } : undefined;
}

/** He finds the player and says what he has in mind. */
export function makeDeal(w: World, p: Character, x: Character, cap: Character, b: Business) {
  p.cooldown['crossdeal'] = w.now + 40 * DAY;
  const fam = w.fam[x.familyId!]?.name ?? 'another family', guarded = b.protection ? ` It pays the ${w.fam[b.protection.familyId]?.name ?? 'other'} people, and they don’t watch it.` : ' Nobody looks after it.';
  addEnc(w, {
    kind: 'crossdeal', from: x.id, title: `${first(x)}, a ${fam} man, has a job`, days: 5, data: { cap: cap.id, biz: b.id },
    lines: [`${x.name}, a ${x.rank === 'capo' ? 'captain' : 'made man'} of the ${fam} family, buys you a drink you didn’t ask for.`, `“${b.name}. The stock sits in the back over the weekend.${guarded} I need a second man I don’t have to explain things to. We go in, I move the goods, we split it. Nobody upstairs needs to hear about it, yours or mine.”`],
    opts: [
      { code: 'quiet', label: 'Do it with him, and keep it between you', hint: `Money, and a friend in the ${fam} family. Business with another family is ${first(cap)}’s to allow. If he hears of it from somebody else, it will cost you.` },
      { code: 'cap', label: `Say you’ll ask ${first(cap)} first`, hint: `The proper way. ${first(cap)} may allow it, or may want nothing to do with them.` },
      { code: 'no', label: 'Tell him you don’t work with his people', hint: 'Nothing gained, nothing risked.' },
    ],
  });
}

function theJob(w: World, p: Character, x: Character, b: Business, allowed: boolean) {
  return mkJob(w, {
    kind: 'burgle', via: 'opportunity', giver: x.id, assignee: p.id, biz: b.id, target: b.ownerId, pay: 0, days: 4, status: 'active',
    title: `${first(x)}’s job at ${b.name}`, brief: `The stock in the back of ${b.name}, with ${x.name}. He moves the goods and pays you your half.${allowed ? '' : ' Your captain doesn’t know.'}`,
  });
}

/** What the player says, and what it starts. */
export function answerDeal(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const x = e.from ? w.chars[e.from] : undefined, cap = w.chars[String(e.data?.cap ?? '')], b = w.biz[String(e.data?.biz ?? '')];
  e.status = 'done';
  if (!x?.alive || !cap?.alive || !b?.open) return { lines: ['By the time you have an answer, he has gone cold on it.'], minutes: 5 };
  if (code === 'quiet') {
    const j = theJob(w, p, x, b, false);
    feel(w, x, p.id, 'trust', 0.08);
    (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(10, 35) * DAY, kind: 'crossdeal', a: p.id, b: cap.id, c: x.id, note: j.id });
    return { lines: [`“When you’re ready, then, and soon,” ${first(x)} says. “Come alone.” It’s in your work now.`], minutes: 20 };
  }
  if (code === 'no') {
    feel(w, x, p.id, 'respect', 0.03);
    return { lines: [`${first(x)} shrugs and finishes his drink. “Your loss. It’ll get done either way.”`], minutes: 15 };
  }
  // he takes it to his captain: whether a man allows it is his greed against what lies between the families
  const t = tension(w, p.familyId, x.familyId), yes = cap.traits.greed > 0.45 && t < 2;
  feel(w, cap, p.id, 'trust', yes ? 0.05 : 0.08); feel(w, cap, p.id, 'respect', 0.04);
  addFact(w, { kind: 'report', actor: p.id, victim: x.id, minor: true, text: `${p.name} told ${cap.name} that ${x.name} had put a job to him.`, district: p.district }, { witnesses: [p.id, cap.id] });
  if (yes) {
    theJob(w, p, x, b, true);
    return { lines: [`${first(cap)} thinks about it. “${first(x)}. He’s greedy, but he isn’t stupid. Go. Bring me my end, and watch him.” You tell ${first(x)} you’re in.`], minutes: 50 };
  }
  feel(w, x, p.id, 'respect', 0.02); bear(w, x, p.id, 0.04, `${p.name} took his job to his captain`);
  return { lines: [`${first(cap)} shakes his head. “Not with them. ${t >= 2 ? 'Not now, with how things are.' : 'You don’t need their money.'} Tell him no, and tell him politely.” ${first(x)} takes it with a look that says he knows where the no came from.`], minutes: 50 };
}

/** Weeks after a job done with another family behind his captain's back: whether his captain hears of it, and from whom. */
export function dealDue(w: World, q: Pending) {
  const p = w.chars[q.a ?? ''], cap = w.chars[q.b ?? ''], x = w.chars[q.c ?? ''], j = w.jobs.find((y) => y.id === q.note);
  if (!p?.alive || !cap?.alive || p.bossId !== cap.id || j?.status !== 'done') return; // (a job never done has nothing to come out)
  if (!w.rng.chance(Math.min(0.65, 0.2 + temper(cap).caution * 0.3 + (x && tension(w, p.familyId, x.familyId) >= 2 ? 0.15 : 0)))) return;
  feel(w, cap, p.id, 'trust', -0.2); bear(w, cap, p.id, 0.25, `${p.name} did a job with ${x?.name ?? 'another family'} behind his back`);
  repute(w, p, -4, 'went behind');
  addFact(w, { kind: 'discipline', actor: cap.id, victim: p.id, minor: false, text: `${cap.name} found out ${p.name} had done a job with ${x?.name ?? 'another family'} without asking him.`, district: p.district }, { witnesses: [] });
  imposed(w, p, cap, {
    title: `${first(cap)} heard about ${x ? first(x) : 'the job'}`,
    said: `${first(cap)} doesn’t look up. “${x ? `You did a job with ${first(x)}` : 'You did a job with another family'}. I heard it from a man who isn’t even one of ours. Do you know how that makes me look?”`,
    why: 'Business with another family goes through me. You went round me, and the first I knew of it was from outside.',
    record: `${cap.name} found out you did a job with ${x?.name ?? 'another family'} without asking him. He trusts you less for it.`,
  });
}
