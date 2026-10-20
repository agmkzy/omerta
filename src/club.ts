// The social club, as conversations. A man has something to say because something in the world gives him a reason,
// and you have a few things you can raise with him yourself. Each conversation is a short scene that changes real state
// (books, debts, favours, quarrels, situations, jobs, careers) and then ends. The scene is kept in the world so a reload resumes it.
import { amends, callSitdown, ignoreDispute, mineAgainst, againstMe, playerActed } from './disputes';
import { addFact, clamp, learn, money, payDebt, rel } from './core';
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
  // ---- what you can raise yourself
  const ds = debtsOf(w, c.id, p.id)[0];
  if (ds) add({ key: 'debtor', sig: ds.id + ':' + ds.balance + ':me', label: 'Bring up what he owes you', cue: `${money(ds.balance)} outstanding`, by: 'me', prio: 3 });
  if (!out.some((t) => t.key === 'creditor') && debtsOf(w, c.id, p.id)[0] === undefined) { const d = w.debts.find((x) => x.status === 'active' && x.creditor === c.id && x.debtor === p.id); if (d) add({ key: 'creditor', sig: d.id + ':' + d.balance + ':me', label: 'Settle what you owe him', cue: `${money(d.balance)}`, by: 'me', prio: 3 }); }
  if (crew && rk(p) >= 1 && c.rank === 'associate' && recommendable(w, p).some((x) => x.id === c.id)) add({ key: 'sponsor', sig: c.id + ':me', label: 'Tell him you will put his name forward', cue: '', by: 'me', prio: 2 });
  if (crew || sitOf(w, c.id) || c.hustle) add({ key: 'biz', sig: String(Math.floor(w.now / DAY)), label: 'Ask how business is', cue: '', by: 'me', prio: 2 });
  if (c.id === p.bossId || rk(c) > rk(p) && rk(c) >= 2) add({ key: 'ask_work', sig: String(Math.floor(w.now / (3 * DAY))), label: 'Ask if there’s anything for you', cue: '', by: 'me', prio: 2 });
  add({ key: 'heard', sig: String(Math.floor(w.now / (2 * DAY))), label: 'Ask what he’s heard', cue: '', by: 'me', prio: 1 });
  add({ key: 'drink', sig: String(Math.floor(w.now / DAY)), label: 'Buy him a drink ($20)', cue: '', by: 'me', prio: 1 });
  return out.filter((t, i, a) => a.findIndex((x) => x.key === t.key && x.by === t.by) === i);
}

// who has come to you, and how many people can reach you at once depends on where you stand
export function waiting(w: World, p: Character, cl: Club, here: Here[]): { c: Character; t: Topic }[] {
  const cap = rk(p) >= 2 ? 3 : rk(p) >= 1 ? 2 : 1;
  const all: { c: Character; t: Topic }[] = [];
  for (const h of here) { const t = topicsFor(w, p, cl, h.c).filter((x) => x.by === 'him').sort((a, b) => b.prio - a.prio)[0]; if (t) all.push({ c: h.c, t }); }
  return all.sort((a, b) => b.t.prio - a.t.prio || hash(a.c.id + Math.floor(w.now / 180)) - hash(b.c.id + Math.floor(w.now / 180))).slice(0, cap);
}

// ------------------------------------------------------------------ greetings that remember
function greet(w: World, p: Character, cl: Club, c: Character): string {
  const r = rel(c, p.id), m = memOf(cl, c.id);
  const seed = c.id + Math.floor(w.now / 180);
  const pick = (xs: string[]) => xs[hash(seed) % xs.length];
  const up = rk(c) > rk(p), down = rk(c) < rk(p);
  let g: string;
  if (w.now - m.last < 5 * 60) g = pick([`${first(c)} glances up. "Forgot something?"`, `"Back already," says ${first(c)}.`]);
  else if (r.grudge > 0.35) g = `${first(c)} looks at you for a second too long. "${p.name.split(' ')[0]}."`;
  else if (up && r.trust < 0.3) g = pick([`${first(c)} nods without getting up. "${p.name.split(' ').slice(1).join(' ') || p.name}."`, `${first(c)} waits to see what you want.`]);
  else if (up) g = pick([`"Sit," says ${first(c)}, and moves a chair out with his foot.`, `${first(c)} pours you a coffee without asking.`]);
  else if (down && r.respect > 0.5) g = pick([`${first(c)} half stands. "${p.name.split(' ')[0]}."`, `${first(c)} straightens up as you come over.`]);
  else if (down) g = pick([`${first(c)} looks up. "Boss."`, `"${p.name.split(' ')[0]}," says ${first(c)}.`]);
  else g = pick([`"${p.name.split(' ')[0]}," says ${first(c)}.`, `${first(c)} lifts his cup an inch.`, `${first(c)} makes room at the table.`]);
  if (m.note && m.note.until > w.now) { g += ' ' + m.note.text; delete m.note; }
  return g;
}

// ------------------------------------------------------------------ scenes
interface Opt { code: string; label: string; hint?: string }
interface Res { say: string[]; next?: string; end?: boolean; mins?: number; note?: string }
interface Node { lines: string[]; opts: (Opt & { run: () => Res })[] }
const END = (say: string[], mins = 15, note?: string): Res => ({ say, end: true, mins, note });

export function sceneOf(w: World): Scene | null { return w.scene ?? null; }
export function startScene(w: World, p: Character, id: Id, topic: string) {
  const cl = clubOf(w, p.familyId); const c = w.chars[id];
  if (!cl || !c?.alive) return;
  w.scene = { npc: id, topic, node: 'open', data: {}, log: [], mins: 0, t: w.now };
  const m = memOf(cl, id);
  const g = greet(w, p, cl, c);
  if (topic !== 'chat') w.scene.data.greet = g; else w.scene.data.g0 = g;
  m.last = w.now;
}

function script(w: World, p: Character, cl: Club, c: Character, s: Scene): Node {
  const f = first(c), r = rel(c, p.id);
  const o = (code: string, label: string, hint: string, run: () => Res) => ({ code, label, hint, run });
  // effects that happen when a node is first shown happen exactly once, however many times the screen is drawn
  const once = (key: string, fn: () => string[]): string[] => {
    const k = 'L_' + key + '_' + s.topic + '_' + s.node;
    if (s.data[k] === undefined) s.data[k] = fn().join('\n');
    return String(s.data[k]) ? String(s.data[k]).split('\n') : [];
  };
  const leave = o('leave', 'Say nothing more', '', () => END([`You let it lie. ${f} nods.`], 5));
  const topic = s.topic, node = s.node;
  switch (topic) {
    case 'chat': {
      const ts = topicsFor(w, p, cl, c).filter((t) => t.by === 'me').sort((a, b) => b.prio - a.prio).slice(0, 4);
      return { lines: [String(s.data.g0 ?? (s.data.g0 = greet(w, p, cl, c)))], opts: [...ts.map((t) => o('t:' + t.key, t.label, t.cue, () => ({ say: [], next: 'goto:' + t.key }))), o('sit', 'Sit with him a while', 'No business. Just company.', () => { r.affection = clamp(r.affection + 0.01); return END([`You sit with ${f} and talk about nothing. It is a good hour.`], 60); })] };
    }
    case 'enc': {
      const e = w.enc.find((x) => x.id === s.data.enc) ?? w.enc.find((x) => x.status === 'open' && x.from === c.id);
      if (!e || e.status !== 'open') return { lines: [`${f} has already said what he came to say.`], opts: [o('x', 'Leave it there', '', () => END([], 5))] };
      return { lines: e.lines, opts: e.opts.map((x) => o(x.code, x.label, x.hint ?? '', () => { const res = choose(w, p, e, x.code); return END(res.lines, Math.min(res.minutes, 40)); })) };
    }
    case 'tab': {
      const owes = Math.max(20, Math.round(c.books.arrears));
      const why = c.problem?.revealed ? { gambling: 'The horses', debt: 'Money he owes someone else', family: 'Trouble at home', drink: 'Drink', house: 'The house', woman: 'A woman', resentment: 'Bad feeling' }[c.problem.kind] ?? '' : '';
      if (node === 'why') {
        const prob = c.problem;
        once('why', () => { if (prob) { prob.revealed = true; const k = ((p.insight ??= {})[c.id] ??= []); if (!k.includes('problem')) k.push('problem'); } return []; });
        const reason = prob ? { gambling: 'He lost it at the track. Not all of it, but enough.', debt: 'He owes someone else and they got to him first.', family: 'His wife’s mother is ill and it has been costing him.', drink: 'He doesn’t say it, but you can smell last night on him.', house: 'The roof, the bank, the usual.', woman: 'There’s a woman, and she isn’t cheap.', resentment: 'He thinks you take too much, and he’s been taking it back.' }[prob.kind] : 'He says business was slow. It might even be true.';
        return { lines: [reason], opts: [
          o('cover', `Cover it (${money(Math.min(owes, 400))})`, 'He owes you one, and he knows it.', () => { const amt = Math.min(owes, 400, Math.floor(p.cash)); if (amt < 20) return { say: ['You can’t put your hand on it just now.'], end: true, mins: 5 }; p.cash -= amt; c.books.arrears = Math.max(0, c.books.arrears - amt); c.books.missed = 0; r.trust = clamp(r.trust + 0.12); r.affection = clamp(r.affection + 0.08); if (prob) prob.sev = clamp(prob.sev - 0.15); addFavour(w, p.id, c.id, 1, `covering ${money(amt)} of his envelope`); post(w, { from: p.id, to: c.id, amt, flow: 'gift', note: 'covered his envelope' }); return END([`You put ${money(amt)} on the table. ${f} doesn’t argue. "I won’t forget it."`], 20, `${f} hasn’t mentioned the money you put in. He doesn’t need to.`); }),
          o('lean', 'Tell him to find it by Sunday', 'Direct. He won’t love it.', () => { r.trust = clamp(r.trust - 0.07); r.respect = clamp(r.respect + 0.02); r.grudge = clamp(r.grudge + 0.03); return END([`"By Sunday," you say. ${f} nods once, tight.`], 15, `${f} is still sore about the deadline you gave him.`); }),
          o('carry', 'Carry it, but he has to say so next time', 'He keeps the tab. Costs you nothing.', () => { r.trust = clamp(r.trust + 0.04); return END([`${f} nods. "Next week. Straight."`], 10); }),
        ] };
      }
      return { lines: [`${f} doesn’t make you ask. "I’m short, ${p.name.split(' ')[0]}. About ${money(owes)}."${why ? ` He doesn’t quite explain, but it’s ${why.toLowerCase()}.` : ''}`], opts: [
        o('why', 'What happened?', 'Ask him straight.', () => ({ say: [`You wait. ${f} looks at his hands.`], next: 'why', mins: 5 })),
        o('carry', 'Carry it', 'He keeps the tab.', () => { r.trust = clamp(r.trust + 0.03); return END([`"It stays on your tab," you say. ${f} breathes out.`], 10); }),
        o('forgive', 'Forget it', 'He stops owing. Some read that as weakness.', () => { c.books.arrears = 0; c.books.missed = 0; r.trust = clamp(r.trust + 0.1); r.respect = clamp(r.respect - 0.04); return END([`"Forget it." ${f} stares, then thanks you quietly.`], 10, `${f} hasn’t forgotten you wiped his tab.`); }),
        o('lean', 'Tell him that isn’t good enough', 'Hard. Costs trust.', () => { r.trust = clamp(r.trust - 0.08); r.grudge = clamp(r.grudge + 0.04); return END([`${f} takes it without answering. That’s an answer.`], 10); }),
      ] };
    }
    case 'trouble': {
      const sit = sitOf(w, c.id);
      if (!sit) return { lines: [`${f} changes his mind.`], opts: [leave] };
      if (node === 'open') { const ls = once('ask', () => askAbout(w, p, c)); return { lines: ls, opts: [
        o('go', 'Hear the rest', '', () => ({ say: [], next: 'help', mins: 5 })),
      ] }; }
      const opts = [
        o('cover', 'Cover it ($600)', 'Big gesture. He’ll remember.', () => END(helpWith(w, p, c, 'cover'), 20)),
        o('lend', 'Lend him $400 on the book', 'He pays it back with interest.', () => END(helpWith(w, p, c, 'lend'), 20)),
        ...(sit.rival ? [o('rival', 'Lean on the man taking his customers', 'Quiet pressure. A grievance with someone else.', () => END(helpWith(w, p, c, 'rival'), 20))] : []),
        o('leave', 'Tell him he’ll work it out', 'He hears what you think he’s worth.', () => END(helpWith(w, p, c, 'leave'), 10)),
      ];
      return { lines: [`${f} isn’t asking. He wants you to see it.`], opts };
    }
    case 'quarrel': {
      const mine = againstMe(w, p, c)[0], his = mineAgainst(w, p, c)[0];
      const d = mine ?? his;
      if (!d || (d.status !== 'open' && d.status !== 'violated')) return { lines: ['There is nothing left to say about it.'], opts: [leave] };
      const hist = d.history.slice(-2).map((h) => h.text);
      const ls = [mine ? `${f} is civil, and no more. "We should talk about it."` : `${f} knows why you've come.`, ...hist];
      if (mine) return { lines: ls, opts: [
        o('own', 'Own your part', 'To his face. It may end it.', () => { amends(w, p, c, 'own'); return END([`You tell ${f} it was you, and you don’t dress it up.`], 20); }),
        o('pay', 'Make it right ($200)', 'Money closes most things.', () => { if (p.cash < 200) return { say: ['You haven’t got it on you.'], end: true, mins: 5 }; p.cash -= 200; c.cash += 200; amends(w, p, c, 'pay'); return END([`You count out ${money(200)}. ${f} takes it and the matter closes.`], 20); }),
        o('sitdown', 'Propose a sit-down', 'Formal. Others will watch.', () => END(callSitdown(w, p, d), 15)),
        o('defy', 'Tell him he can try', 'It will not end well.', () => { amends(w, p, c, 'defy'); return END([`${f} stands. The room goes quiet. That is how wars start.`], 15); }),
      ] };
      return { lines: ls, opts: [
        o('warn', 'Warn him off', 'Firm. Quiet. He may not take it.', () => { playerActed(w, p, c, 'warn'); return END([`You speak low and clear. ${f} listens.`], 15); }),
        o('sitdown', 'Propose a sit-down', 'Formal. Others will watch.', () => END(callSitdown(w, p, d), 15)),
        o('drop', 'Let it go', 'Peace, at some cost.', () => { playerActed(w, p, c, 'drop'); return END([`"It's finished," you say. ${f} isn't sure he believes you.`], 10); }),
        o('ignore', 'Say nothing for now', 'It stays open.', () => { ignoreDispute(d, w); return END([], 5); }),
      ] };
    }
    case 'creditor': {
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === c.id && x.debtor === p.id);
      if (!d) return { lines: ['You owe him nothing.'], opts: [leave] };
      const dueNow = d.missed > 0;
      return { lines: [dueNow ? `${f} keeps his voice down. "${money(d.balance)}, ${p.name.split(' ')[0]}. It's been ${d.missed} week${d.missed > 1 ? 's' : ''}."` : `You owe ${f} ${money(d.balance)}.`], opts: [
        o('pay', `Pay it all (${money(d.balance)})`, p.cash >= d.balance ? 'Clears it. He respects that.' : 'You cannot cover this.', () => { if (p.cash < d.balance) return { say: ['You do not have it.'], end: true, mins: 5 }; payDebt(w, d, d.balance); r.respect = clamp(r.respect + 0.05); r.trust = clamp(r.trust + 0.06); return END([`You count it out. ${f} nods. "Good."`], 20, `${f} has no complaint about your money. Not now.`); }),
        o('part', `Pay half (${money(Math.round(d.balance / 2))})`, 'Shows good faith.', () => { const amt = Math.min(Math.round(d.balance / 2), Math.floor(p.cash)); if (amt < 20) return { say: ['You can’t manage even that.'], end: true, mins: 5 }; payDebt(w, d, amt); d.nextDue = w.now + WEEK; d.missed = 0; r.trust = clamp(r.trust + 0.02); return END([`${f} takes ${money(amt)}. "The rest next week."`], 20); }),
        o('later', 'Ask for time', 'He does not like it.', () => { d.nextDue = w.now + 4 * DAY; r.respect = clamp(r.respect - 0.04); r.trust = clamp(r.trust - 0.03); return END([`"Four days," ${f} says. It is not a favour; it is a warning.`], 10); }),
      ] };
    }
    case 'debtor': {
      const d = w.debts.find((x) => x.status === 'active' && x.creditor === p.id && x.debtor === c.id);
      if (!d) return { lines: ['He owes you nothing.'], opts: [leave] };
      const cash = Math.floor(c.cash);
      const pay = Math.min(cash, Math.max(d.weeklyPayment, 20));
      return { lines: [cash >= d.weeklyPayment ? `${f} puts some money on the table before you speak. "${money(pay)}. All I have this week."` : `${f} won’t meet your eye. "I haven’t got it, ${p.name.split(' ')[0]}. Not this week."`], opts: [
        ...(cash >= 20 ? [o('take', `Take ${money(pay)}`, 'Keeps the book moving.', () => { payDebt(w, d, pay); r.respect = clamp(r.respect + 0.02); return END([`You take it. ${f} relaxes a little.`], 15); })] : []),
        o('ease', 'Give him a week', 'Goodwill. The interest still runs.', () => { d.nextDue = w.now + WEEK; d.missed = Math.max(0, d.missed - 1); r.trust = clamp(r.trust + 0.05); r.affection = clamp(r.affection + 0.02); return END([`"A week," you say. ${f} thanks you too many times.`], 10, `${f} knows you gave him the extra week.`); }),
        o('lean', 'Lean on him', 'He pays what he has. He resents it.', () => { const amt = Math.min(Math.floor(c.cash), d.balance); if (amt > 0) payDebt(w, d, amt); r.trust = clamp(r.trust - 0.08); r.grudge = clamp(r.grudge + 0.08); return END([amt > 0 ? `${f} empties his pockets onto the table. ${money(amt)}. He will not forget this.` : `${f} has nothing to give, and sees that you saw it.`], 15, `${f} is cold with you about the money.`); }),
      ] };
    }
    case 'sponsor': {
      if (node === 'open' && s.data.me !== 1) return { lines: [`${f} has been working up to it. "I've done what you asked, ${p.name.split(' ')[0]}. I want to be made some day, and I need a man to put my name forward. I'd like it to be you."`], opts: [
        o('back', 'Put his name forward', 'Your name goes with his.', () => { const ls = recommend(w, p, c); return END(ls, 20, `${f} knows you put his name forward.`); }),
        o('earn', 'Not yet. Show me more', 'He keeps trying.', () => { r.trust = clamp(r.trust - 0.02); return END([`${f} nods. "Then I will."`], 10); }),
        o('no', 'Tell him it is not going to happen', 'Straight. It will cost you his loyalty.', () => { r.trust = clamp(r.trust - 0.1); r.respect = clamp(r.respect - 0.03); if (c.want) c.want.kind = 'independent'; return END([`${f}'s face doesn't change. Something behind it does.`], 15); }),
      ] };
      return { lines: [`You tell ${f} you have been watching him.`], opts: [o('back', 'Put his name forward', 'Your name goes with his.', () => END(recommend(w, p, c), 20)), leave] };
    }
    case 'report': {
      const men = underlings(w, c).filter((x) => x.books.arrears > 0).sort((a, b) => b.books.arrears - a.books.arrears);
      const ar = Math.round(men.reduce((a, x) => a + x.books.arrears, 0));
      return { lines: [`${f} gets to it. "${men.length} of my men are behind. ${money(ar)} between them. I can squeeze, but you should know before I do."`], opts: [
        o('cover', `Cover it (${money(Math.min(ar, 600))})`, 'Costs you. The men see where it came from.', () => { let left = Math.min(ar, 600, Math.floor(p.cash)); if (left < 50) return { say: ['You can’t cover it right now.'], end: true, mins: 5 }; const spent = left; for (const m of men) { const take = Math.min(m.books.arrears, left); m.books.arrears -= take; left -= take; rel(m, p.id).trust = clamp(rel(m, p.id).trust + 0.05); if (left <= 0) break; } p.cash -= spent; post(w, { from: p.id, to: c.id, amt: spent, flow: 'gift', note: 'covered his men' }); r.trust = clamp(r.trust + 0.08); return END([`You settle ${money(spent)} of it. ${f} makes a note and does not argue.`], 20); }),
        o('squeeze', 'Tell him to collect', 'His men feel it. He feels backed.', () => { r.respect = clamp(r.respect + 0.04); for (const m of men) { rel(m, c.id).trust = clamp(rel(m, c.id).trust - 0.05); } return END([`"Collect it," you say. ${f} nods. It is what he wanted to hear.`], 10); }),
        o('ease', 'Tell him to be patient', 'The men get breathing room. He may think you soft.', () => { for (const m of men) { m.books.missed = 0; rel(m, c.id).trust = clamp(rel(m, c.id).trust + 0.04); } r.respect = clamp(r.respect - 0.03); return END([`"Give them a week." ${f} agrees, in the tone of a man who has noted it.`], 10); }),
      ] };
    }
    case 'work': {
      const j = s.data.job ? w.jobs.find((x) => x.id === s.data.job) : offerFrom(w, c, p);
      if (!j || j.status !== 'offered') return { lines: [`${f} has nothing more for you just now.`], opts: [leave] };
      return { lines: [`${f} lowers his voice. "${j.title}."`, j.brief], opts: [
        o('take', 'Take it', `Pays ${money(j.pay)}.`, () => { takeJob(w, j); r.trust = clamp(r.trust + 0.03); return END([`"I'll handle it." It's on your plate now, under Today.`], 10); }),
        o('later', 'Say you need time', 'It stays open for a day or two.', () => END([`${f} lets his eyes drop. "Don't take too long."`], 5)),
        o('pass', 'Turn it down', 'He remembers who says no.', () => { declineJob(w, j); return END([`${f} says nothing. That is the answer.`], 10); }),
      ] };
    }
    case 'ask_work': {
      if (node !== 'open') return { lines: [], opts: [leave] };
      once('ask', () => {
        const before = new Set(w.jobs.map((j) => j.id));
        const done = (p.cooldown['clubwork'] ?? 0) > w.now;
        if (c.id === p.bossId && !done && forceBossOffer(w)) { p.cooldown['clubwork'] = w.now + 3 * DAY; const nj = w.jobs.find((j) => !before.has(j.id) && j.status === 'offered' && j.giver === c.id); if (nj) s.data.job = nj.id; }
        else p.cooldown['clubwork'] = w.now + 2 * DAY;
        return [];
      });
      if (s.data.job) { s.topic = 'work'; s.node = 'open'; return script(w, p, cl, c, s); }
      return { lines: [c.id === p.bossId ? `${f} shakes his head. "Not today. When I've got something I'll send for you."` : `${f} considers you. "Not from me. Ask ${w.chars[p.bossId!]?.name.split(' ')[0] ?? 'your captain'}."`], opts: [o('ok', 'Leave it', '', () => END([], 5))] };
    }
    case 'biz': {
      const sit = sitOf(w, c.id);
      const st = statement(w, c);
      const ls: string[] = [];
      if (c.bossId === p.id && st.has) ls.push(`${f} gives you the short version. Last week he made ${money(st.own)}${st.crew ? ` and his own men passed up ${money(st.crew)}` : ''}, and handed up ${money(st.handed)} of ${money(st.due)}.`);
      else if (c.hustle) ls.push(`${f} shrugs. "It goes. ${c.hustle.net > 0 ? 'I can’t complain.' : 'Quiet.'}"`);
      else ls.push(`"Same as always," says ${f}.`);
      if (sit && sit.kind !== 'ambition' && (!sit.told || s.data.L_ask)) { ls.push(...once('ask', () => askAbout(w, p, c))); s.data.L_ask = 1; return { lines: ls, opts: [o('help', 'Ask what would help', '', () => { s.topic = 'trouble'; return { say: [], next: 'help' }; }), o('x', 'Leave it there', '', () => END([], 10))] }; }
      return { lines: ls, opts: [o('x', 'Good', '', () => END([], 10))] };
    }
    case 'heard': {
      const stored = s.data.L_heard_heard_open;
      const fact = stored !== undefined ? undefined : Object.keys(c.known).map((id) => w.facts[id]).filter((x) => x && !p.known[x.id] && w.now - x.t < 30 * DAY && relevance(w, p, x).level >= 1 && !x.minor).sort((a, b) => b.t - a.t)[0];
      const ls = once('heard', () => { if (!fact) return [`${f} thinks about it. "Nothing worth repeating."`]; learn(w, p.id, fact, c.id, true); return [`${f} lowers his voice. "${fact.text}"`]; });
      return { lines: ls, opts: [o('x', fact || /lowers/.test(ls[0] ?? '') ? 'Nod and say nothing' : 'Fair enough', '', () => END([], 10))] };
    }
    case 'drink': {
      if (p.cash < 20 && s.data.L_drink_drink_open === undefined) return { lines: ['You haven’t got twenty dollars.'], opts: [leave] };
      const ls = once('drink', () => {
        p.cash -= 20; r.affection = clamp(r.affection + 0.04); r.trust = clamp(r.trust + 0.02);
        const hint = c.problem && !c.problem.revealed && r.trust > 0.35 ? (() => { const k = ((p.insight ??= {})[c.id] ??= []); if (!k.includes('hint')) k.push('hint'); return ' He says very little, and drinks faster than he should.'; })() : c.want ? ' He says he is not planning to be where he is forever.' : '';
        return [`You stand ${f} a drink. He tells you about the neighbourhood and an uncle in Brooklyn.${hint}`];
      });
      return { lines: ls, opts: [o('x', 'Finish your drink', '', () => END([], 40))] };
    }
  }
  return { lines: [], opts: [leave] };
}

export function sceneNode(w: World, p: Character): { c: Character; lines: string[]; opts: Opt[]; ended: boolean; log: string[]; title: string } | null {
  const s = w.scene; if (!s) return null;
  const c = w.chars[s.npc]; const cl = clubOf(w, p.familyId);
  if (!c || !cl) { w.scene = null; return null; }
  const prefix = s.node === 'open' && s.data.greet ? [String(s.data.greet)] : [];
  if (s.ended) return { c, lines: [], opts: [], ended: true, log: s.log, title: c.name };
  const n = script(w, p, cl, c, s);
  return { c, lines: [...prefix, ...n.lines], opts: n.opts.map(({ code, label, hint }) => ({ code, label, hint })), ended: false, log: s.log, title: c.name };
}

export function sceneAct(w: World, p: Character, code: string) {
  const s = w.scene; if (!s || s.ended) return;
  const c = w.chars[s.npc]; const cl = clubOf(w, p.familyId); if (!c || !cl) { w.scene = null; return; }
  // choosing a player-initiated topic from the opener
  const n = script(w, p, cl, c, s);
  const opt = n.opts.find((x) => x.code === code); if (!opt) return;
  const shown = [...(s.node === 'open' && s.data.greet ? [String(s.data.greet)] : []), ...n.lines];
  const res = opt.run();
  s.log.push(...shown);
  if (res.say.length) s.log.push(...res.say);
  s.mins += res.mins ?? 5;
  if (res.next?.startsWith('goto:')) { const k = res.next.slice(5); s.topic = k; s.node = 'open'; s.data = { me: 1 }; delete s.data.greet; markSeen(w, cl, c, k, p); return; }
  if (res.next) { s.node = res.next; return; }
  if (res.end) {
    s.ended = true;
    markSeen(w, cl, c, s.topic, p);
    const m = memOf(cl, c.id); m.last = w.now; m.said = s.topic;
    if (res.note) m.note = { text: res.note, until: w.now + 10 * DAY };
    addFact(w, { kind: 'favour', actor: p.id, victim: c.id, minor: true, text: `${p.name} sat down with ${c.name} at the club.`, district: cl.district }, { witnesses: [p.id, c.id] });
  }
}
function markSeen(w: World, cl: Club, c: Character, key: string, p: Character) {
  const sig = topicsFor(w, p, cl, c).find((t) => t.key === key)?.sig;
  if (sig !== undefined) memOf(cl, c.id).seen[key] = sig + '|' + w.now;
}

// ending the conversation hands back the minutes it took
export function closeScene(w: World): number {
  const m = w.scene?.mins ?? 0; w.scene = null; return Math.max(5, Math.min(120, m));
}

// the lobby
export { clubOf, clubOpen, clubPresent, weekday };
