// The social club, as conversations. A man has something to say because something in the world gives him a reason,
// and you have a few things you can raise with him yourself. Each conversation is a short scene that changes real state
// (books, debts, favours, quarrels, situations, jobs, careers) and then ends. The scene is kept in the world so a reload resumes it.
import { lineOf } from './rackets';
import { pass, versionOf } from './rumour';
import { fp } from './voice';
import { amends, callSitdown, ignoreDispute, mineAgainst, againstMe, playerActed } from './disputes';
import { addFact, bearOn, clamp, feel, feelOn, learn, money, payDebt, rel } from './core';
import { recommend, recommendable } from './career';
import { Club, Here, Scene, clubOf, clubOpen, clubPresent, memOf, weekday } from './clubdata';
import { addFavour, choose } from './encounters';
import { forceBossOffer, takeJob, declineJob } from './jobs';
import { post, statement } from './ledger';
import { relevance } from './reports';
import { askAbout, helpWith, sitOf } from './situations';
import { hash } from './voice';
import { Character, DAY, Debt, Id, Job, WEEK, World } from './types';

const RK = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
const rk = (c: Character) => RK.indexOf(c.rank);
const first = (c: Character) => c.name.split(' ')[0];

// ------------------------------------------------------------------ why a man would have something to say
export interface Topic { key: string; sig: string; label: string; cue: string; by: 'him' | 'me'; prio: number }

const debtsOf = (w: World, a: Id, b: Id) => w.debts.filter((d) => d.status === 'active' && d.creditor === a && d.debtor === b);
const underlings = (w: World, c: Character) => Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.rank !== 'civilian');
const arrearsOf = (w: World, c: Character) => underlings(w, c).reduce((a, x) => a + x.books.arrears, 0);
export const offerFrom = (w: World, c: Character, p: Character): Job | undefined => w.jobs.find((j) => j.status === 'offered' && j.via === 'boss' && j.giver === c.id && j.assignee === p.id);
const seenRecently = (cl: Club, id: Id, key: string, sig: string, w: World, days = 3) => {
  const s = cl.mem[id]?.seen[key]; if (!s) return false;
  const [sg, t] = s.split('|'); return sg === sig && w.now - Number(t) < days * DAY;
};

export function topicsFor(w: World, p: Character, cl: Club, c: Character): Topic[] {
  const out: Topic[] = [];
  const add = (t: Topic) => { if (t.by === 'me' || !seenRecently(cl, c.id, t.key, t.sig, w)) out.push(t); };
  const crew = c.bossId === p.id;
  // ---- his reasons
  const enc = w.enc.find((e) => e.status === 'open' && e.from === c.id && e.t + 0 < w.now + 1);
  if (enc) add({ key: 'enc', sig: enc.id, label: 'Hear him out', cue: 'has been waiting to speak to you', by: 'him', prio: 9 });
  const q = [...againstMe(w, p, c), ...mineAgainst(w, p, c)].find((d) => d.status === 'open' || d.status === 'violated');
  if (q) add({ key: 'quarrel', sig: q.id + ':' + q.history.length, label: 'The quarrel', cue: 'there is something between you', by: 'him', prio: 8 });
  const owe = debtsOf(w, c.id, p.id).find((d) => d.nextDue <= w.now + DAY || d.missed > 0);
  if (owe) add({ key: 'creditor', sig: owe.id + ':' + owe.balance, label: 'What you owe', cue: `you owe him ${money(owe.balance)}`, by: 'him', prio: 8 });
  const job = offerFrom(w, c, p);
  if (job) add({ key: 'work', sig: job.id, label: 'Work', cue: 'has something for you', by: 'him', prio: 8 });
  if (crew) {
    const st = statement(w, c);
    if (c.books.arrears > 20 || (st.light && c.books.missed > 0)) add({ key: 'tab', sig: String(c.books.arrears) + ':' + c.books.missed, label: 'His envelope', cue: 'is behind and knows it', by: 'him', prio: 7 });
    const s = sitOf(w, c.id);
    if (s && s.kind !== 'ambition' && !s.told && s.weeks >= 2 && rel(c, p.id).trust >= 0.35) add({ key: 'trouble', sig: s.id + ':' + s.stage, label: 'His trouble', cue: 'looks like he wants to tell you something', by: 'him', prio: 6 });
    if (rk(p) >= 1 && c.rank === 'associate' && rel(c, p.id).trust >= 0.35 && (c.want?.kind === 'made' || (c.career?.done ?? 0) >= 3) && recommendable(w, p).some((x) => x.id === c.id)) add({ key: 'sponsor', sig: c.id, label: 'His future', cue: 'wants to ask you something', by: 'him', prio: 5 });
  }
  const dueTo = debtsOf(w, p.id, c.id).find((d) => d.nextDue <= w.now && d.missed > 0);
  if (dueTo && !crew) add({ key: 'debtor', sig: dueTo.id + ':' + dueTo.missed, label: 'What he owes', cue: 'is behind on what he owes you', by: 'him', prio: 5 });
  if (rk(p) > rk(c) && c.bossId === p.id && rk(c) >= 1) {
    const ar = arrearsOf(w, c);
    if (ar > 100) add({ key: 'report', sig: String(Math.round(ar / 50)), label: 'His report', cue: 'has a problem with his men', by: 'him', prio: 6 });
  }
  // (Stage 5C: what you raise yourself is the conversation's, opened at the club like anywhere else: dialogue.ts)
  return out.filter((t, i, a) => a.findIndex((x) => x.key === t.key && x.by === t.by) === i);
}

// who has come to you, and how many people can reach you at once depends on where you stand
export function waiting(w: World, p: Character, cl: Club, here: Here[]): { c: Character; t: Topic }[] {
  const cap = rk(p) >= 2 ? 3 : rk(p) >= 1 ? 2 : 1;
  const all: { c: Character; t: Topic }[] = [];
  for (const h of here) { const t = topicsFor(w, p, cl, h.c).filter((x) => x.by === 'him').sort((a, b) => b.prio - a.prio)[0]; if (t) all.push({ c: h.c, t }); }
  return all.sort((a, b) => b.t.prio - a.t.prio || hash(a.c.id + Math.floor(w.now / 180)) - hash(b.c.id + Math.floor(w.now / 180))).slice(0, cap);
}

// (Stage 5C: the club's own conversation scenes are gone. Sitting down with a man at the club is the conversation, opened there
// (web.ts 'cscene'); a scene left open in an old save is closed when it loads (engine.deserialize).)

// the lobby
export { clubOf, clubOpen, clubPresent, weekday };
