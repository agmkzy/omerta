// The Family (October 2026): what a man asks, and offers, about his place in the family, to the men who would know. Each answer comes
// from what that man knows and how he regards the one asking: the line and the books as a made man knows them, a crew and who is
// talked of for one as a captain knows it, and the risk a made man takes when he puts his own crewman's name forward. Nothing is
// a number; a man who doesn't trust you says less, and a proud captain may not like being asked at all.
import { bear, peek } from '../../core';
import { booksOpen, captaincyContenders, lineOf, preferredSuccessor, tellLine } from '../../succession';
import { positionOf } from '../../standing';
import { temper } from '../../temper';
import { DAY, type Character, type World } from '../../types';
import type { Act, Ctx, Offer } from '../kit';
import { first, line, out, R, T, tweak } from './common';

const MADE = new Set(['soldier', 'capo', 'underboss', 'boss']);
const sameFam = (c: Ctx) => !!c.h.familyId && c.h.familyId === c.n.familyId;
const asked = (c: Ctx, k: string) => c.v.th.asked.includes(k);
const ask = (c: Ctx, k: string) => { c.v.th.asked.push(k); };
const offer = (code: string, label: string, note?: string): Offer => ({ code, label, note });
const lately = (w: World, t: Character, k: string, days: number) => { const m = t.talk?.[k]; return !!m && Math.floor(w.now / DAY) - m.d <= days; };
const stamp = (w: World, t: Character, k: string) => { (t.talk ??= {})[k] = { d: Math.floor(w.now / DAY), sig: 'x', n: 1 }; };

// "What about the books?" An associate asks a made man of his own family. He knows whether they are open, and why, because the
// family's made men are told; the order of the line he tells only a man he trusts.
const booksAsk: Act = {
  base: 'fam_books', pane: 'business',
  offers: (c) => (sameFam(c) && c.h.rank === 'associate' && MADE.has(c.n.rank) && !asked(c, 'fam_books') ? [offer('fam_books', '“What about the books?”', 'Whether anybody is being made, and where you stand.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = w.fam[p.familyId!], r = R(x); ask(c, 'fam_books');
    if (r.trust < 0.25) { line(x, `${first(t)} looks at you. “That’s not something we talk about with you.”`); return out(5); }
    if (!booksOpen(w, f)) line(x, `“Closed,” ${first(t)} says. “Nobody’s getting made until there’s a reason to. Room, or need. Keep doing what you’re doing.”`);
    else line(x, `“They’re open. ${f.books?.why ? f.books.why.charAt(0).toUpperCase() + f.books.why.slice(1) + '.' : ''} ${f.books?.n ? `A ${f.books.n === 1 ? 'name' : 'couple of names'} will go through.` : ''}”`);
    const order = lineOf(w, f.id), mine = order.indexOf(p.id);
    if (r.trust >= 0.45 && order.length) {
      tellLine(w, p, t);
      line(x, mine === 0 ? `He lowers his voice. “When it’s time, you’re first. Don’t make me wrong.”` : mine > 0 ? `He lowers his voice. “There are men ahead of you. ${first(w.chars[order[0]])}, for one. You’re in it, though.”` : `“Your name hasn’t come up. Not yet. Somebody has to say it.”`);
    } else line(x, '“Where you are in it isn’t mine to tell you.”');
    tweak(x, 0, 0, 0.01);
    return out(15);
  },
};
// "I want a crew one day." A soldier says it to his captain. The captain answers from where things stand (a seat, the men talked
// of, his own choice for his chair), and from how he takes being asked: a proud, unsure captain hears a man after his job.
const crewAsk: Act = {
  base: 'fam_crew', pane: 'business',
  offers: (c) => (sameFam(c) && c.h.rank === 'soldier' && c.n.id === c.h.bossId && c.n.rank === 'capo' && !asked(c, 'fam_crew') && !lately(c.w, c.n, 'fam_crew', 21) ? [offer('fam_crew', '“One day I want a crew of my own.”', 'He’ll tell you what he thinks of it. He may not like being asked.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x), tp = temper(t); ask(c, 'fam_crew'); stamp(w, t, 'fam_crew');
    const heir = preferredSuccessor(w, t), cs = captaincyContenders(w, p.familyId!), me = cs.findIndex((y) => y.c.id === p.id);
    const touchy = tp.pride > 0.6 && r.trust < 0.55;
    if (touchy) { bear(w, t, p.id, 0.05, `${p.name} let it be known he wants a crew`); line(x, `${first(t)}’s face doesn’t change. “You want my chair? Get in line.” It isn’t a joke.`); return out(10); }
    if (heir?.id === p.id && r.trust >= 0.5) { line(x, `${first(t)} nods slowly. “When I move up, I’ll say your name. Don’t tell anybody I said that.”`); tweak(x, 0.02, 0, 0.02); return out(15); }
    if (me === 0) line(x, `“People talk about you. That’s a start. A crew’s the boss’s to give, and he gives it when there’s one to give.”`);
    else if (me > 0) line(x, `“You’re talked about. So is ${first(cs[0].c)}, more. ${heir && heir.id !== p.id && r.trust >= 0.45 ? `And if I moved up tomorrow, I’d want ${first(heir)} in my chair. I’m telling you straight.` : 'Earn, lead your men, keep your mouth shut.'}”`);
    else line(x, `${first(t)} laughs, not unkindly. “You? Lead men first. Right now you couldn’t lead a horse to water.”`);
    if (t.traits.ambition > 0.7) bear(w, t, p.id, 0.02, `${p.name} has ambitions`);
    return out(15);
  },
};
// "Put my man's name in." A made man vouches for one of his own crewmen to be made. It goes on record, and on him: if that man
// shames the family later, the men who listened remember whose word it was.
const putName: Act = {
  base: 'fam_name', pane: 'business',
  offers: (c) => {
    if (!sameFam(c) || !MADE.has(c.h.rank) || !(MADE.has(c.n.rank) && (c.n.id === c.h.bossId || c.n.rank === 'boss' || c.n.rank === 'underboss'))) return [];
    const mine = Object.values(c.w.chars).filter((m) => m.alive && m.bossId === c.h.id && m.rank === 'associate' && m.familyId === c.h.familyId && m.backer !== c.h.id);
    return mine.slice(0, 2).map((m) => offer('fam_name:' + m.id, `“I want to put ${m.name.split(' ')[0]}’s name forward.”`, 'Your word that he should be made. If he shames the family, it’s on you too.'));
  },
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, id = code.split(':')[1] ?? '', m = w.chars[id];
    if (!m?.alive) return out(3);
    ask(c, 'fam_name:' + id);
    m.backer = p.id;
    (p.career ??= { done: 0, failed: 0, log: [] }).log.push({ t: w.now, text: `Put ${m.name}’s name forward to be made, to ${t.name}` });
    const v = peek(t, m.id).trust;
    line(x, v >= 0.45 ? `${first(t)} nods. “He’s all right. I’ll remember you said it.”` : `${first(t)} takes a while. “I don’t know him like you do. It’s your word, then.”`);
    tweak(x, 0, 0, 0.01);
    return out(10);
  },
};
// "How are things at your end?" A man asked by the man above him gives his own account of his week. A man who has been holding out
// shades it, with a reason that sounds right; his books (and his crew's) say what they say.
const below = (c: Ctx) => c.n.bossId === c.h.id && c.n.rank !== 'civilian';
const report: Act = {
  base: 'fam_report', pane: 'business',
  offers: (c) => (below(c) && !asked(c, 'fam_report') ? [offer('fam_report', '“How are things at your end?”', 'His account of his week. It is his account.')] : []),
  run: (c) => {
    const x = T(c), { w, t } = x; ask(c, 'fam_report');
    const crew = Object.values(w.chars).filter((m) => m.alive && m.bossId === t.id);
    const last = t.books.history.at(-1), gross = (last?.gross ?? 0) + crew.reduce((a, m) => a + (m.books.history.at(-1)?.paid ?? 0), 0);
    const hiding = !!(t.books.skim || t.books.hide);
    const said = hiding ? Math.round(gross * 0.7 / 10) * 10 : Math.round(gross / 10) * 10;
    const why = ['the weather kept people home', 'one of the spots got raided', 'two of the regulars are tapped out', 'the Fourth of July took everybody out of town', 'there was a fight at one of the spots and people stayed away'];
    line(x, said <= 0 ? `“Quiet week. Nothing to speak of.”` : `“About ${'$' + said.toLocaleString('en-US')}${crew.length ? ', with the crew' : ''}. ${hiding ? `It would have been more, but ${w.rng.pick(why)}.` : temper(t).pride > 0.6 ? 'Good week.' : 'Not bad.'}”`);
    stamp(w, t, 'fam_report');
    return out(15);
  },
};
// "I expect more from you." A man who fears or respects you stops what he has been doing; a proud one who doesn't, resents it.
const more: Act = {
  base: 'fam_more', pane: 'business',
  offers: (c) => (below(c) && !asked(c, 'fam_more') && !lately(c.w, c.n, 'fam_more', 14) ? [offer('fam_more', '“I expect more from you.”', 'He may take it to heart. He may take it badly.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x); ask(c, 'fam_more'); stamp(w, t, 'fam_more');
    const weight = (r.fear ?? 0) * 0.6 + r.respect * 0.5 + r.trust * 0.2 - temper(t).pride * 0.3 - r.grudge * 0.5;
    if (weight > 0.2) { if (t.books.skim) delete t.books.skim; if (t.books.hide) delete t.books.hide; line(x, `${first(t)} nods slowly. “You’ll have it.”`); tweak(x, -0.01, 0, 0.02); }
    else { bear(w, t, p.id, 0.06, `${p.name} told him he wasn’t doing enough`); line(x, `${first(t)}’s jaw sets. “I’m doing what I can. If that’s not enough, say so plainly.”`); }
    return out(10);
  },
};
export const FAMILY: Act[] = [booksAsk, crewAsk, putName, report, more];
// (the position word is read where each answer says what the man can know; kept here so the import is used by intent)
export const canSpeakToBooks = (w: World, c: Character) => MADE.has(c.rank) && positionOf(w, c) !== 'none';
