// The Family (October 2026): what a man asks, and offers, about his place in the family, to the men who would know. Each answer comes
// from what that man knows and how he regards the one asking: the line and the books as a made man knows them, a crew and who is
// talked of for one as a captain knows it, and the risk a made man takes when he puts his own crewman's name forward. Nothing is
// a number; a man who doesn't trust you says less, and a proud captain may not like being asked at all.
import { bear, peek } from '../../core';
import { OPS } from '../../rackets';
import { booksOpen, captaincyContenders, lineOf, preferredSuccessor, tellLine } from '../../succession';
import { careerRecord, isConsigliere, positionOf } from '../../standing';
import { agoWords, lastOf, remember } from '../kit';
import * as door from '../doors';
import { jobSaid } from '../../jobs';
import { pathInfo } from '../../path';
import { mtOpen } from './business';
import { under } from '../../command';
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
export function booksAnswer(c: Ctx) {
  const x = T(c), { w, p, t } = x, f = w.fam[p.familyId!], r = R(x);
  if (r.trust < 0.25) return;
  if (!booksOpen(w, f)) line(x, `“As for the books, they’re closed. Nobody gets made until there’s a reason to.”`);
  else line(x, `“The books are open. ${f.books?.why ? f.books.why.charAt(0).toUpperCase() + f.books.why.slice(1) + '.' : ''}”`);
  const order = lineOf(w, f.id), mine = order.indexOf(p.id);
  if (r.trust >= 0.45 && order.length) {
    tellLine(w, p, t);
    line(x, mine === 0 ? `He lowers his voice. “When it’s time, you’re first. Don’t make me wrong.”` : mine > 0 ? `He lowers his voice. “There are men ahead of you. ${first(w.chars[order[0]])}, for one. You’re in it, though.”` : `“Your name hasn’t come up. Somebody has to say it.”`);
  }
}
const booksAsk: Act = {
  base: 'fam_books', pane: 'business',
  offers: () => [], // (the books are answered as part of "Where do I stand?" (org.ts promo) since the conversation overhaul)
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
    const rec = careerRecord(w, p), lead = rec.find((d) => d.key === 'leadership')?.v ?? 0, men = Object.values(w.chars).filter((m) => m.alive && m.bossId === p.id).length;
    // (he remembers the last time: what he said then, and whether anything has changed since)
    const prev = lastOf(w, t.id, 'crewask'), was = Number(prev?.sig ?? -1);
    remember(w, t.id, 'crewask', me === 0 ? 'leading' : me > 0 ? 'talked of' : 'not yet', String(Math.round(lead * 10)));
    if (prev && was >= 0) line(x, Math.round(lead * 10) > was ? `“You asked me that ${agoWords(w.now, prev.t)}. You’ve done some leading since. I noticed.”` : `“You asked me that ${agoWords(w.now, prev.t)}. What’s changed?”`);
    const touchy = tp.pride > 0.6 && r.trust < 0.55;
    if (touchy) { bear(w, t, p.id, 0.05, `${p.name} let it be known he wants a crew`); line(x, `${first(t)}’s face doesn’t change. “You want my chair? Get in line.” It isn’t a joke.`); return out(10); }
    if (heir?.id === p.id && r.trust >= 0.5) { line(x, `${first(t)} nods slowly. “When I move up, I’ll say your name. Don’t tell anybody I said that.”`); tweak(x, 0.02, 0, 0.02); return out(15, [{ code: 'fam_crew_prove', label: '“I won’t let you down.”' }]); }
    if (me === 0) line(x, `“People talk about you. That’s a start. A crew’s the boss’s to give, and he gives it when there’s one to give.”`);
    else if (me > 0) line(x, `“You’re talked about. So is ${first(cs[0].c)}, more. ${heir && heir.id !== p.id && r.trust >= 0.45 ? `And if I moved up tomorrow, I’d want ${first(heir)} in my chair. I’m telling you straight.` : 'Earn, lead your men, keep your mouth shut.'}”`);
    else line(x, `“You’ve done well for yourself. Running men is different from earning. Show me you can keep your own people in line.”`);
    if (t.traits.ambition > 0.7) bear(w, t, p.id, 0.02, `${p.name} has ambitions`);
    // what one says next, having heard it
    return out(15, [
      { code: 'fam_crew_need', label: '“What would you need to see from me?”' },
      ...(men ? [{ code: 'fam_crew_men', label: `“I’ve already got ${men === 1 ? 'a man' : 'men'} working for me.”` }] : []),
      { code: 'fam_crew_prove', label: '“Then I’ll prove it.”' },
    ]);
  },
};
// what he would need to see: the parts of the record a crew asks for, said as a captain says them, weakest first
const crewNeed: Act = {
  base: 'fam_crew_need', pane: 'business',
  run: (c) => {
    // (consistent with what he has just told you of the money: if he called you close on it, it isn't what he names now)
    const earnClose = (pathInfo(c.w, c.h)?.goals.find((g) => g.key === 'earn')?.frac ?? 0) >= 0.75;
    const x = T(c), { w, p } = x, rec = careerRecord(w, p).filter((d) => ['leadership', 'earning', 'reliability'].includes(d.key) && !(earnClose && d.key === 'earning')).sort((a, b) => a.v - b.v);
    const say: Record<string, string> = { leadership: 'Men who do what you say, and keep doing it when you’re not there.', earning: 'Money. More than you’re bringing up now, week in, week out.', reliability: 'Your envelope in full, every Sunday, and your word kept.' };
    line(x, `“${say[rec[0].key]}${rec[1] && rec[1].v < 0.45 ? ' ' + say[rec[1].key] : ''}”`);
    return out(10);
  },
};
const crewMen: Act = {
  base: 'fam_crew_men', pane: 'business',
  run: (c) => {
    const x = T(c), { w, p } = x, men = Object.values(w.chars).filter((m) => m.alive && m.bossId === p.id);
    const loyal = men.filter((m) => peek(m, p.id).trust >= 0.5).length;
    line(x, loyal >= Math.max(1, men.length / 2) ? `“I know. They stick with you. That counts.”` : `“Working for you and being yours aren’t the same thing. Half of them would go with whoever paid more.”`);
    return out(10);
  },
};
const crewProve: Act = { base: 'fam_crew_prove', pane: 'business', run: (c) => { const x = T(c); line(x, `${first(x.t)} nods. “Do that.”`); remember(x.w, x.t.id, 'crewpromise', 'said he would prove it'); return out(5); } };
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
const below = (c: Ctx) => c.n.rank !== 'civilian' && !isConsigliere(c.w, c.n) && (c.n.bossId === c.h.id || (['capo', 'underboss'].includes(c.n.rank) && under(c.w, c.h, c.n)));
const report: Act = {
  base: 'fam_report', pane: 'business',
  offers: (c) => (below(c) && !asked(c, 'fam_report') ? [offer('fam_report', '“How are things at your end?”', 'His account of his week. It is his account.')] : []),
  run: (c) => {
    const x = T(c), { w, t } = x; ask(c, 'fam_report');
    const crew = Object.values(w.chars).filter((m) => m.alive && m.bossId === t.id);
    const last = t.books.history.at(-1), gross = (last?.gross ?? 0) + crew.reduce((a, m) => a + (m.books.history.at(-1)?.paid ?? 0), 0);
    const hiding = !!(t.books.skim || t.books.hide), op = w.ops.find((o) => (o.runner === t.id || o.owner === t.id) && o.state === 'running');
    const said = hiding ? Math.round(gross * 0.7 / 10) * 10 : Math.round(gross / 10) * 10;
    // (reasons a man gives for a light week: plausible ones, none tied to a date that might not fit the calendar)
    const why = ['the weather kept people home', 'one of the spots got raided', 'two of the regulars are tapped out', 'there was a fight at one of the spots and people stayed away', 'the cops were sitting on the corner half the week'];
    line(x, said <= 0 ? `“Quiet week. Nothing to speak of.”` : `“About ${'$' + said.toLocaleString('en-US')}${crew.length ? ', with the crew' : ''}${op ? `, most of it from the ${(OPS[op.kind as keyof typeof OPS]?.label ?? 'business').toLowerCase()}` : ''}. ${hiding ? `It would have been more, but ${w.rng.pick(why)}.` : temper(t).pride > 0.6 ? 'Good week.' : 'Not bad.'}”`);
    stamp(w, t, 'fam_report');
    // what a man above him says next, having heard it: that it isn't enough, or what he is to do now (orders to a man on the street)
    const next: Offer[] = [];
    if (!lately(w, t, 'fam_more', 14)) next.push(offer('fam_more', '“I expect more from you.”', 'He may take it to heart. He may take it badly.'));
    next.push({ code: 'fam_challenge', label: '“That’s not what your envelope says.”', note: 'If he’s been keeping some back, he may own it. If he hasn’t, he won’t forget you said it.' });
    if (t.bossId === x.p.id && (t.rank === 'associate' || t.rank === 'soldier')) next.push({ code: 'assign_low', label: '“Keep your head down for a while.”', note: 'Heat drops. He earns less.' }, { code: 'assign_hustle', label: '“Find yourself something extra.”', note: 'It will show up in the books, and in the heat.' });
    next.push({ code: 'fl_drop', label: '“All right.”' });
    return out(15, next);
  },
};
// "I expect more from you." A man who fears or respects you stops what he has been doing; a proud one who doesn't, resents it.
const more: Act = {
  base: 'fam_more', pane: 'business',
  offers: () => [], // (said after he has told you how his week went: fam_report's follow-ups)
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x); ask(c, 'fam_more'); stamp(w, t, 'fam_more');
    const weight = (r.fear ?? 0) * 0.6 + r.respect * 0.5 + r.trust * 0.2 - temper(t).pride * 0.3 - r.grudge * 0.5;
    if (weight > 0.2) { if (t.books.skim) delete t.books.skim; if (t.books.hide) delete t.books.hide; line(x, `${first(t)} nods slowly. “You’ll have it.”`); tweak(x, -0.01, 0, 0.02); }
    else { bear(w, t, p.id, 0.06, `${p.name} told him he wasn’t doing enough`); line(x, `${first(t)}’s jaw sets. “I’m doing what I can. If that’s not enough, say so plainly.”`); }
    return out(10);
  },
};
// "Is there something you want my view on?" The consigliere to his boss. The boss raises what is waiting on him where a consigliere's
// view matters: the inquiry he set him, if there is one open; otherwise a man he isn't sure of; otherwise nothing.
const counsel: Act = {
  base: 'fam_counsel', pane: 'business',
  offers: (c) => (isConsigliere(c.w, c.h) && c.n.familyId === c.h.familyId && c.w.fam[c.h.familyId!]?.bossId === c.n.id && !asked(c, 'fam_counsel') ? [offer('fam_counsel', '“Is there something you want my view on?”', 'He raises what is on his mind, if he wants your view on it.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x; ask(c, 'fam_counsel');
    const s = (w.situations ?? []).find((q) => q.kind === 'hearing' && q.stage !== 'resolved' && (q.parties ?? []).some((y) => y.role === 'inq' && y.id === p.id));
    if (s) {
      const d = w.chars[(s.parties ?? []).find((y) => y.role === 'def')!.id];
      line(x, `${first(t)} doesn’t waste time. “${d ? first(d) : 'That business'}. What did you find?”`);
      return out(10, (mtOpen.offersFor?.(c, s.id) ?? []).filter((o) => o.code.includes(':adv:')));
    }
    const caps = Object.values(w.chars).filter((m) => m.alive && m.familyId === t.familyId && m.rank === 'capo').sort((a, b) => peek(t, a.id).trust - peek(t, b.id).trust || (a.id < b.id ? -1 : 1));
    const doubt = caps[0] && peek(t, caps[0].id).trust < 0.45 ? caps[0] : undefined;
    if (doubt) { line(x, `${first(t)} turns his glass. “${first(doubt)}. I don’t know what to make of him lately. Keep an eye on him for me.”`); tweak(x, 0.02); return out(15); }
    line(x, `“Not today. Keep your ears open.”`);
    return out(5);
  },
};
// "About what I told the captains." The boss, or the man acting for him, raises the family's direction with one captain. A captain who
// is going along says so; one who isn't either admits it, if he respects or fears the man asking, or says he is, if he doesn't.
const dirTalk: Act = {
  base: 'fam_dir', pane: 'business',
  offers: (c) => {
    const f = c.h.familyId ? c.w.fam[c.h.familyId] : undefined, pol = f?.policy;
    return pol && pol.until > c.w.now && pol.by === c.h.id && c.n.rank === 'capo' && c.n.familyId === c.h.familyId && !asked(c, 'fam_dir') ? [offer('fam_dir', '“About what I told the captains.”', 'Whether his crew is going along with it. He may not tell you the truth.')] : [];
  },
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = w.fam[p.familyId!], r = R(x); ask(c, 'fam_dir');
    const deaf = (f.policy?.deaf ?? []).includes(t.id);
    if (!deaf) { line(x, `“We’re doing it. Some of my men grumble. They’ll live.”`); return out(10); }
    if ((r.fear ?? 0) * 0.6 + r.respect * 0.5 > 0.45) {
      line(x, `${first(t)} doesn’t look away. “Not yet. My men don’t like it, and I haven’t pushed them.”`);
      return out(10, [{ code: 'fam_dir_press', label: '“Push them.”', note: 'He’ll do it, or he’ll resent being told twice.' }, { code: 'fam_dir_let', label: '“Do it your way, then.”', note: 'His crew goes on as before, with your blessing.' }]);
    }
    line(x, `“We’re doing it,” ${first(t)} says. He says it easily.`);
    return out(10);
  },
};
const dirPress: Act = {
  base: 'fam_dir_press', pane: 'business',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = w.fam[p.familyId!], r = R(x);
    if ((r.fear ?? 0) * 0.6 + r.respect * 0.5 + r.trust * 0.3 > 0.55) { if (f.policy) f.policy.deaf = (f.policy.deaf ?? []).filter((id) => id !== t.id); line(x, `“All right.” He doesn’t like it. He’ll do it.`); return out(5); }
    bear(w, t, p.id, 0.08, `${p.name} told him twice`); line(x, `${first(t)}’s jaw sets. “I heard you the first time.”`); return out(5);
  },
};
const dirLet: Act = { base: 'fam_dir_let', pane: 'business', run: (c) => { const x = T(c); tweak(x, 0.02, 0, -0.01); line(x, `${first(x.t)} nods. He’ll remember you let him.`); return out(5); } };
// "I want more responsibility." Said to the man above you, after hearing where you stand. What he says is what his own situation
// makes of it: a man who needs help puts something in your hands now; one who trusts you encourages you; one who thinks you're ahead
// of yourself asks what you think you've done; one with bad blood between you won't hear it.
const moreResp: Act = {
  base: 'fam_resp', pane: 'business',
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x), n0 = w.jobs.length;
    remember(w, t.id, 'resp', 'asked');
    if (r.grudge > 0.3) { line(x, `${first(t)} doesn’t even look up. “More? After the way things are between us? No.”`); return out(5); }
    const short = Object.values(w.chars).filter((m) => m.alive && m.bossId === t.id).length < 3 || t.books.arrears > 0 || (t.problem?.sev ?? 0) > 0.3;
    if (short && r.trust >= 0.35) {
      if (t.id === p.bossId) door.bossWork(w); else door.peerWork(w, t, p);
      line(x, w.jobs.length > n0 ? `“Funny you should say that. I’m stretched thin. Here, take this off my hands.”` : `“I’m stretched thin, as it happens. Next thing that comes up, it’s yours.”`);
      if (w.jobs.length > n0) { const j = w.jobs.at(-1)!; line(x, jobSaid(j)); }
      tweak(x, 0.02, 0, 0.02); return out(15);
    }
    if (r.trust >= 0.55) { line(x, `“Good. That’s what I like to hear. Keep doing what you’re doing, and I’ll put more your way.”`); tweak(x, 0.01, 0, 0.02); return out(10); }
    line(x, `${first(t)} studies you. “What do you think you’ve done, that you’re asking me that?”`);
    if (t.traits.ambition > 0.7) bear(w, t, p.id, 0.03, `${p.name} is getting ahead of himself`);
    return out(10);
  },
};
// "That's not what your envelope says." Said to your own man after his account of his week: a man who has been holding out owns it
// or digs in, by his nerve; a man who hasn't is insulted, and remembers it.
const challenge: Act = {
  base: 'fam_challenge', pane: 'business',
  run: (c) => {
    const x = T(c), { w, p, t } = x, hiding = !!(t.books.skim || t.books.hide), tp = temper(t);
    if (hiding && tp.caution + t.skills.nerve * 0.5 < 0.9) { delete t.books.skim; delete t.books.hide; line(x, `${first(t)} looks at the table. “All right. I’ve been keeping a little back. It stops.”`); tweak(x, -0.02, 0, 0.04); return out(10); }
    if (hiding) { line(x, `“Then the envelope’s wrong,” ${first(t)} says, and holds your eye. He’s lying, or he’s very sure of himself.`); return out(10); }
    bear(w, t, p.id, 0.08, `${p.name} as good as called him a thief`); line(x, `${first(t)} goes very still. “Count it yourself. Every dollar. Then you can apologise.”`);
    return out(10);
  },
};
// "What are you hearing?" The boss, or the man acting for him, to his consigliere: what a consigliere is for. He tells what he could
// know of: a captain with a grievance against the boss, or one whose money doesn't add up; a consigliere who doesn't trust the man
// asking keeps it to himself.
const hearing: Act = {
  base: 'fam_hear', pane: 'business',
  offers: (c) => (isConsigliere(c.w, c.n) && c.n.familyId === c.h.familyId && (c.w.fam[c.h.familyId!]?.bossId === c.h.id || positionOf(c.w, c.h) === 'acting boss') && !asked(c, 'fam_hear') ? [offer('fam_hear', '“What are you hearing?”', 'What he knows that you should. If he trusts you with it.')] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, r = R(x); ask(c, 'fam_hear');
    if (r.trust < 0.35) { line(x, `“Nothing worth your time.” He says it smoothly. Too smoothly, maybe.`); return out(5); }
    const caps = Object.values(w.chars).filter((m) => m.alive && m.familyId === p.familyId && m.rank === 'capo' && m.id !== t.id).sort((a, b) => (a.id < b.id ? -1 : 1));
    // (only what could have reached him: a captain who talks to him, or something he knows of the man; never the books' own truth)
    const heard = (m: Character) => peek(m, t.id).trust >= 0.3 || Object.keys(t.known).some((id) => w.facts[id]?.actor === m.id && !w.facts[id].minor);
    const sore = caps.filter((m) => peek(m, p.id).grudge > 0.2 && heard(m)).sort((a, b) => peek(b, p.id).grudge - peek(a, p.id).grudge)[0];
    const light = caps.find((m) => (m.books.skim || m.books.hide) && heard(m) && Object.values(w.chars).some((x) => x.bossId === m.id && peek(x, t.id).trust >= 0.3));
    if (sore) line(x, `“${first(sore)}. He hasn’t forgotten ${peek(sore, p.id).why?.text ?? 'whatever it is between you'}, and he talks about it where he shouldn’t.”`);
    if (light) line(x, `“And ${first(light)}’s money is lighter than his crew. I can’t prove it. I’d look.”`);
    if (!sore && !light) line(x, `“It’s quiet. The captains are earning and nobody is talking out of turn. Quiet doesn’t last.”`);
    tweak(x, 0.01); return out(15);
  },
};
export const FAMILY: Act[] = [hearing, moreResp, challenge, booksAsk, crewAsk, crewNeed, crewMen, crewProve, putName, report, more, counsel, dirTalk, dirPress, dirLet];
// (the position word is read where each answer says what the man can know; kept here so the import is used by intent)
export const canSpeakToBooks = (w: World, c: Character) => MADE.has(c.rank) && positionOf(w, c) !== 'none';
