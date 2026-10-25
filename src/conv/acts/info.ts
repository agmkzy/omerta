// Information: something that happened, as he knows it (Gate 4, from the old engine's incident leaves). The player asks about an
// event; he tells what he knows, or denies a thing he did; then the questions that follow from what he has just said: who, what it cost,
// who else was there, where he heard it, why, what he will do, what can be done. And a man he has a problem with: who he suspects, what
// the player knows of that man, an offer to deal with him or to sit the two of them down. Each answer is his (decision.ts: his odds
// where the rules leave it to chance), what it changes goes through doors.ts, and he only says what he knows.
import { famName, ownerBiz } from '../../core';
import { mkJob } from '../../jobs';
import { arch } from '../../voice';
import { addr } from '../subjects/life';
import { temper } from '../../temper';
import { DAY, type Character, type Fact } from '../../types';
import * as door from '../doors';
import { chance, settled, term } from '../decide';
import type { Act, Ctx, Offer } from '../kit';
import { first, line, out, R, T, tweak, voice } from './common';
import { BORING, connected, first1, grudgeTarget, holdsBack, HUMILIATING, incidentsOf, inHisVoice, involvedIn, openness, RKN, SCENE, takeOn, thenLine, told, TROUBLE } from './words';
import { said } from './personal';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const fact = (c: Ctx) => (c.v.th.fact ? c.w.facts[c.v.th.fact] : undefined);
const asked = (c: Ctx, k: string) => c.v.th.asked.includes(k);
const ask = (c: Ctx, k: string) => { c.v.th.asked.push(k); };
// the questions that follow from an event in hand, as the old engine allowed them (learn more, how he sees it, what can be done)
function questions(c: Ctx): Offer[] {
  const { w, h: p, n: t } = c, f = fact(c);
  if (!f) return [];
  if (c.v.th.denied) return [{ code: 'press', label: 'People are saying it was you' }, { code: 'drop', label: 'Let it drop' }];
  const k = t.known[f.id], pk = p.known[f.id], inv = involvedIn(w, t, f);
  const mineToHim = f.actor === p.id && f.victim === t.id, hisToMe = f.actor === t.id && f.victim === p.id;
  const learn: Offer[] = [], spec: Offer[] = [], act: Offer[] = [], urgent: Offer[] = [];
  const q = (xs: Offer[], code: string, label: string, note?: string) => { if (!asked(c, code)) xs.push({ code, label: said(c, code, label), note }); };
  if (k?.knowsActor && f.actor && f.actor !== p.id && !pk?.knowsActor) q(learn, 'who', inv ? 'Who was it?' : 'Who have you heard it was?');
  if (f.victim === t.id && f.amount && !mineToHim) q(learn, 'how_much', 'What did it cost you?');
  if (inv && SCENE.has(f.kind)) q(learn, 'witness', 'Who else was there?');
  const biz = f.business ? w.biz[f.business] : undefined;
  if (f.kind === 'protection_started' && biz) {
    if (f.actor === t.id) { q(spec, 'p_how', 'How did you come by that arrangement?'); q(spec, 'p_claim', 'Does anyone else have a claim on it?'); q(spec, 'p_owner', 'How did the owner take it?'); }
    else if (biz.ownerId === t.id) { q(spec, 'p_how', 'How did it come about?'); q(spec, 'p_claim', 'Is anyone else leaning on you?'); }
  } else if (f.actor === t.id && f.victim) q(spec, 'why', 'Why did you do it?');
  if (f.actor === p.id) { if (!asked(c, 'own')) urgent.push({ code: 'own', label: said(c, 'own', 'It was me'), note: 'Better from you than from someone else.' }); if (!asked(c, 'own') && !asked(c, 'lie')) urgent.push({ code: 'lie', label: said(c, 'lie', 'It wasn’t me'), note: 'He may believe you. He may not.' }); }
  if (!k?.knowsActor && f.victim === t.id && f.actor !== p.id) q(act, 'find', 'I’ll find out who did it');
  const actor = f.actor ? w.chars[f.actor] : undefined;
  if (actor?.alive && actor.id !== p.id && pk?.knowsActor && actor.id !== t.id && actor.familyId !== t.familyId && f.victim === t.id) q(act, 'speak', `I’ll speak with ${actor.familyId ? 'the ' + famName(w, actor) + ' family' : actor.name}`, 'You’re promising to act.');
  if (actor?.alive && actor.id !== p.id && pk?.knowsActor && actor.id !== t.id && f.victim === t.id) q(act, 'sitdown', `I could arrange a sit-down with ${first(actor)}`);
  const view = asked(c, 'view') || f.actor === t.id ? [] : [{ code: 'view', label: mineToHim ? 'Where does that leave us?' : hisToMe ? 'Are we square now?' : inv && f.victim === t.id ? 'What are you going to do about it?' : 'What do you make of it?' }];
  if (mineToHim && asked(c, 'own')) urgent.push({ code: 'amends_open', label: 'Let me make it right', note: 'It will cost you something. He will remember that you came.' });
  if (connected(w, t, p, f)) q(learn, 'tell_more', 'Is there more to it?');
  if (!mineToHim && !hisToMe) q(learn, 'involve', f.kind === 'ruling' && !f.actor ? 'Does this touch us?' : f.actor === t.id ? 'Will it get you trouble?' : f.actor && f.victim ? 'Will anyone do something about it?' : 'Does anyone know what’s behind it?');
  const who = !inv && !asked(c, 'source') ? [{ code: 'source', label: 'Who would know?' }] : [];
  const mine = f.actor === p.id;
  return [...urgent, ...spec, ...learn.slice(0, 3), ...who, ...view, ...(act.length && !mine ? [{ code: 'can_do', label: 'What can be done about it?' }] : []), ...(incidentsOf(w, t).length > 1 ? [{ code: 'pick_incident', label: 'What else have you heard?' }] : [])];
}
const stay = (c: Ctx, minutes: number) => ({ minutes, next: questions(c) });
// trouble between him and another that is a matter between him and the player: a grudge of his, or an incident of the hard kind that
// touches one of them (the old engine's "grievances" door, shown only then)
export function troubleHere(c: Ctx): boolean {
  const { w, h: p, n: t } = c;
  if (!incidentsOf(w, t).length && !grudgeTarget(w, t)) return false;
  return !!grudgeTarget(w, t) || incidentsOf(w, t).some(({ f }) => TROUBLE.has(f.kind) && !!p.known[f.id] && (f.victim === t.id || f.actor === t.id || f.actor === p.id || f.victim === p.id));
}

// What he says as a sit-down is set up: what he wants from it, in his own terms (it is only words; the meeting is unchanged), and
// whether it is the second in three weeks
function sitdownTalk(c: Ctx, other: Character): string[] {
  const { w, h: p, n: t } = c, a = arch(t);
  const lead = a === 'hothead' ? '“I’ll come. Don’t expect me to be calm about it.”' : a === 'frightened' ? '“If it’ll end it, I’ll sit. I don’t want any more of this.”' : a === 'cold' ? '“I’ll sit. I want it said to his face, and I want it made right.”' : '“All right. A sit-down. I’ll say what I have to say, and he’ll say his.”';
  const prior = (p.cooldown[`sd:${t.id}`] ?? 0) > w.now - 20 * DAY ? ' “And let’s not have another one like the last.”' : '';
  door.cool(p, `sd:${t.id}`, w.now);
  return [`${lead}${prior}`, `He expects ${other.name.split(' ')[0]} to be there, and he expects you to be fair.`];
}

// ---------------------------------------------------------------- asking about an event
const inc: Act = {
  base: 'inc', pane: 'personal', questions,
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, id = code.split(':')[1], f = w.facts[id], k = t.known[id];
    if (!f || !k) return out(3);
    c.v.th.fact = id; c.v.th.asked = []; c.v.th.denied = false;
    c.v.lines.push({ who: 'narr', text: `You ask ${first(t)} about it.` });
    if (f.actor === t.id) {
      // whether he owns it or denies it: his caution against how far he trusts the player
      const d = chance(w, t.id, 'denies it', 'owns it', [term('base', 0.3), term('his caution × 0.35', t.traits.caution * 0.35), term('his trust in you × −0.3', -R(x).trust * 0.3)], 0.05, 0.7);
      if (d.yes) { line(x, voice(x, 'inc_deny'), d); c.v.th.denied = true; door.denied(w, t, id); }
      else { line(x, voice(x, 'inc_admit'), d); if (!p.known[id]) door.learnFrom(w, p, f, t.id, true); tweak(x, 0.02); }
      return stay(c, 25);
    }
    const inv = involvedIn(w, t, f), pk = p.known[id];
    const ac = f.actor ? w.chars[f.actor] : undefined, vc = f.victim ? w.chars[f.victim] : undefined;
    const take = ac && ac.id !== p.id && (t.rels[ac.id]?.grudge ?? 0) >= 0.3 ? `"${first(ac)}? I’m not surprised. That one has it coming."`
      : ac && ac.id !== p.id && (t.rels[ac.id]?.trust ?? 0) >= 0.4 ? `"Doesn’t sound like ${first(ac)}. Somebody’s stirring."`
      : vc && vc.familyId === t.familyId && vc.id !== t.id ? `"That’s one of ours. It doesn’t get forgotten."`
      : temper(t).volatility > 0.6 ? `"Some things you settle with a bat, not a conversation."`
      : temper(t).caution > 0.6 ? `"Best nobody in this room gets involved."` : `"Not my business unless it becomes my business."`;
    if (inv) line(x, `"${inHisVoice(told(w, t, f, k.knowsActor), t, f.victim === t.id)}"`);
    else line(x, pk ? `${t.name} lifts a shoulder. "I wasn’t there. You know as much as I do." ${take}` : `${t.name} lifts a shoulder. "I wasn’t there. I only know what was going round." "${told(w, t, f, k.knowsActor)}"`);
    if (!pk) door.learnFrom(w, p, f, t.id, k.knowsActor);
    if (!k.knowsActor && !pk) c.v.lines.push({ who: 'narr', text: 'He doesn’t know who did it.' });
    return stay(c, 25);
  },
};
// which event: the ones the player knows of by what they were about, and anything else as one open question
const pickIncident: Act = {
  base: 'pick_incident', pane: 'personal', opens: true,
  offers: (c) => (incidentsOf(c.w, c.n).length && troubleHere(c) ? [{ code: 'pick_incident', label: said(c, 'pick_incident', 'Ask about a recent incident'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), { w, p, t } = x, tp = temper(t), hot = tp.volatility + tp.pride > 1.15;
    line(x, hot ? '“Which business? There’s always something.”' : '“What, the business with…? Which one?”');
    const fn = (id?: string) => (id && w.chars[id] ? first(w.chars[id]) : '');
    const topic = (f: Fact) => { const b = f.business ? w.biz[f.business] : undefined, k = p.known[f.id]; return f.actor === p.id ? 'What have you heard about me?' : b ? `What’s the story with ${b.name}?` : k?.knowsActor && f.actor && f.victim ? `What went on between ${fn(f.actor)} and ${fn(f.victim)}?` : f.victim && f.victim !== t.id ? `What happened to ${fn(f.victim)}?` : 'What’s that about?'; };
    const next: Offer[] = [], seen = new Set<string>(), all = incidentsOf(w, t);
    for (const { f } of all.filter(({ f }) => p.known[f.id])) { const l = topic(f); if (seen.has(l) || seen.size >= 3) continue; seen.add(l); next.push({ code: 'inc:' + f.id, label: l }); }
    const fresh = all.find(({ f }) => !p.known[f.id]);
    if (fresh) next.push({ code: 'inc:' + fresh.f.id, label: 'Anything else going round?' });
    return { minutes: 5, next };
  },
};
// ---------------------------------------------------------------- the questions about it
const own: Act = { base: 'own', pane: 'personal', run: (c) => { const x = T(c); ask(c, 'own'); line(x, `You tell ${x.t.name} straight that it was you. He takes a long moment. "At least you said it to my face."`); door.softens(x.w, x.t, x.p, 0.08, 'owned up'); tweak(x, 0.03, 0, 0.03); return stay(c, 15); } };
const lie: Act = {
  base: 'lie', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'lie');
    const d = chance(w, t.id, 'believes you', 'knows better', [term('base', 0.35), term('his trust in you × 0.4', R(x).trust * 0.4), term(t.known[f.id]?.knowsActor ? 'he knows who did it' : 'he does not know who did it', t.known[f.id]?.knowsActor ? -0.25 : 0)], 0.1, 0.8);
    if (d.yes) line(x, `${t.name} studies you, then nods slowly. "All right. I hear you."`, d);
    else { line(x, `${t.name} doesn’t blink. "Don’t insult me. I know what I know."`, d); door.grudge(w, t, p.id, 0.12, `${p.name} denied what he knows`); tweak(x, -0.08, -0.04, -0.03); }
    return stay(c, 15);
  },
};
const view: Act = {
  base: 'view', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'view');
    line(x, takeOn(w, t, p, f));
    if (!involvedIn(w, t, f)) { const vc = f.victim ? w.chars[f.victim] : undefined; if (vc?.alive && vc.id !== p.id && vc.id !== t.id) line(x, `“If it’s the whole of it you want, ask ${first(vc)}. He was there.”`); }
    if (f.victim === t.id && f.actor && f.actor !== p.id) {
      const up = (w.pending ?? []).find((q) => q.kind === 'dispute' && q.a === t.id && q.b === f.actor), intent = (w.pending ?? []).find((q) => q.kind === 'intent' && q.a === t.id && q.b === f.actor);
      if (up && w.chars[up.c!]?.alive) line(x, `“I’ve taken it to ${w.chars[up.c!].name}. He’s said he’ll raise it.”`);
      else if (intent) line(x, R(x).trust >= 0.5 ? 'He lowers his voice. “I’m not letting it lie. I’ll answer it my own way, in my own time.”' : 'He looks past you. “I’ll see what’s to be done.”', settled(t.id, R(x).trust >= 0.5 ? 'tells you' : 'keeps it back', 'whether he trusts you (≥ 0.5) with what he means to do'));
    }
    return stay(c, 8);
  },
};
const tellMore: Act = {
  base: 'tell_more', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'tell_more');
    const m = connected(w, t, p, f);
    if (!m) { line(x, `${t.name} spreads his hands. “That’s all I’ve got, same as you.”`); return stay(c, 5); }
    line(x, `${t.name} thinks for a second. ${thenLine(f, m.g, inHisVoice(told(w, t, m.g, m.kk.knowsActor), t, m.g.victim === t.id || m.g.actor === t.id))}`);
    door.learnFrom(w, p, m.g, t.id, m.kk.knowsActor);
    return stay(c, 12);
  },
};
const involve: Act = {
  base: 'involve', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!, r = R(x); ask(c, 'involve');
    if (f.kind === 'ruling' && !f.actor) {
      // the houses: what he says depends on how far he trusts the player with it, and on who he is
      const need = ({ cold: 0.45, proud: 0.45, schemer: 0.45, bitter: 0.4, hothead: 0.3, jovial: 0.25, earnest: 0.25, frightened: 0.2 } as Record<string, number>)[arch(t)] ?? 0.35;
      if (r.trust < need && RKN(t.rank) > RKN(p.rank)) {
        line(x, ({ cold: `${t.name} says nothing for a moment. “That isn’t for you.”`, proud: '“Matters between houses are not discussed with men of your standing.”', schemer: `${t.name} smiles. “Everyone wants to know that. Ask me again when I know what you’d do with it.”`, bitter: '“What’s it to you? You’ll find out when you’re told.”' } as Record<string, string>)[arch(t)] ?? `${t.name} looks round the room. “Not here. Not yet.”`, settled(t.id, 'keeps it back', `not trusted enough (${r.trust.toFixed(2)} < ${need}) for talk of the houses`));
        return stay(c, 5);
      }
      const fams = Object.values(w.fam).filter((fm) => f.text.includes(fm.name)), ours = fams.some((fm) => fm.id === p.familyId);
      const ten = fams.length >= 2 ? w.fam[fams[0].id].tension[fams[1].id] ?? 0 : 0;
      line(x, ours ? '“That’s us, as far as anyone’s concerned. Whatever the table said, our people will be watched to see they keep to it.”' : ten >= 3 ? '“The paper’s on the table, but those two still hate each other. If it breaks, every house gets asked whose side it’s on.”' : '“For now it holds. We’re not a party to it, and I’d like to keep it that way.”');
      return stay(c, 10);
    }
    const dsp = (w.disputes ?? []).find((q) => q.fact === f.id || (!!f.story && q.id === f.story));
    const ac = f.actor ? w.chars[f.actor] : undefined, vc = f.victim ? w.chars[f.victim] : undefined;
    const ten = ac?.familyId && vc?.familyId && ac.familyId !== vc.familyId ? w.fam[ac.familyId].tension[vc.familyId] ?? 0 : 0;
    if (dsp && (dsp.status === 'open' || dsp.status === 'violated')) line(x, dsp.status === 'violated' ? '“Whatever was agreed, somebody broke it. That doesn’t end quietly.”' : '“It’s still open. Neither side has given an inch, and neither has gone to anybody who could settle it.”');
    else if (ten >= 3) line(x, '“Between those two houses? There’s more bad blood than this one thing. People are watching.”');
    else if (!f.actor || !f.victim) line(x, `${t.name} shakes his head. “If anyone knows, they’re not saying.”`);
    else line(x, '“Not that I’ve heard. Which doesn’t mean it’s over.”');
    return stay(c, 8);
  },
};
// what can be done: he says, and then those things are what the player can say
const canDo: Act = {
  base: 'can_do', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'can_do');
    const b = f.business ? w.biz[f.business] : undefined, mine = b?.protection?.collectorId === p.id, ac = f.actor ? w.chars[f.actor] : undefined, pk = p.known[f.id];
    const mineToFix = f.victim === t.id || (!!b && ownerBiz(w, t.id)?.id === b.id);
    if (f.kind === 'levy' && f.actor && w.chars[f.actor]?.familyId === p.familyId) line(x, '“It comes out of every envelope in the house, yours too. Pay it and keep your head down.”');
    else if (mine) line(x, '“It’s your envelope. That’s yours to sort out, and people will notice how.”');
    else if (mineToFix && ac && ac.id !== p.id && pk?.knowsActor) line(x, `“You could have a word with ${first(ac)}, or put the two of us across a table. Either way you’re putting your name to it.”`);
    else if (mineToFix) line(x, '“Find out who first. After that, we’ll see.”');
    else line(x, `${t.name} considers you. “It isn’t yours to fix. Keep your ears open and your mouth shut. That’s the most useful thing I can tell you.”`);
    const acts = questions(c).filter((o) => ['find', 'speak', 'sitdown', 'own', 'lie'].includes(o.code));
    return { minutes: 8, next: acts.length ? acts : questions(c) };
  },
};
const press: Act = {
  base: 'press', pane: 'confront',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'press');
    const d = chance(w, t.id, 'owns it', 'holds to his story', [term('base', 0.15), term('his trust in you × 0.6', R(x).trust * 0.6), term('his caution × −0.2', -t.traits.caution * 0.2)], 0.05, 0.85);
    if (d.yes) { c.v.th.denied = false; door.learnFrom(w, p, f, t.id, true); line(x, `${t.name} says nothing for a while. “All right. It was me. I’d sooner you heard it from me than from the street.”`, d); tweak(x, 0.02); }
    else { line(x, `“You’re pushing, ${addr(w, t, p)}. I said what I said.”`, d); door.grudge(w, t, p.id, 0.04, `${p.name} kept pushing him`); tweak(x, -0.03, 0, -0.02); }
    return stay(c, 8);
  },
};
const drop: Act = { base: 'drop', pane: 'personal', run: (c) => { const x = T(c); line(x, `${x.t.name} watches you let it go. “Good.”`); tweak(x, 0.01); c.v.th.fact = undefined; c.v.th.denied = false; return out(5); } };
// how the arrangement came about, who else has a claim, how the owner took it; why he did it
const why: Act = {
  base: 'why', pane: 'personal',
  run: (c, code) => {
    const x = T(c), { w, t } = x, f = fact(c)!, k0 = code.split(':')[0]; ask(c, k0);
    const b = f.business ? w.biz[f.business] : undefined, mine = f.actor === t.id, tr = R(x).trust;
    const sayIt = (s: string, d?: ReturnType<typeof settled>) => line(x, `“${s}”`, d);
    if (k0 === 'why') {
      const g = f.cause ? w.facts[f.cause] : undefined;
      if (g && t.known[g.id]) sayIt(`It came out of something before it. ${inHisVoice(told(w, t, g, true), t, true)}`);
      else if (tr < 0.4) sayIt('That’s my business.', settled(t.id, 'keeps it back', `not trusted enough (${tr.toFixed(2)} < 0.4)`));
      else if (arch(t) === 'hothead') sayIt('Because he had it coming. I’m not going to apologise for it.');
      else if (arch(t) === 'cold') sayIt('Because it needed doing. I don’t go in for explaining myself.');
      else sayIt('Everyone has their reasons. I had mine, and I’d rather keep them.');
      return stay(c, 8);
    }
    if (!b) { sayIt('That’s all there is to it.'); return stay(c, 5); }
    if (k0 === 'p_how') {
      const before = Object.values(w.facts).filter((g) => g.id !== f.id && g.business === b.id && g.t <= f.t && t.known[g.id] && ['protection_refused', 'poach', 'vandalism'].includes(g.kind)).sort((a, z) => z.t - a.t)[0];
      const o = first1(w, b.ownerId);
      if (tr < 0.35) sayIt('That’s between him and me.', settled(t.id, 'keeps it back', `not trusted enough (${tr.toFixed(2)} < 0.35)`));
      else if (before?.kind === 'poach' && before.actor === t.id) { const old = before.victim ? first1(w, before.victim) : 'someone else'; sayIt(mine ? `It was paying ${old}. It pays me now. That’s how it works.` : `It was paying ${old}. That ended.`); }
      else if (before?.kind === 'protection_refused') sayIt(mine ? `${o} turned me down the first time. I went back.` : 'I turned him down the first time. He came back.');
      else if (before?.kind === 'vandalism') sayIt(mine ? 'There was trouble at the place. I won’t say more than that.' : 'There was trouble at the place first. After that I agreed.');
      else sayIt(mine ? 'It’s an arrangement, and it’s in place. How it came about is nobody else’s business.' : 'It’s in place. I’d rather not go over how.');
      return stay(c, 8);
    }
    if (k0 === 'p_claim') {
      const ps = Object.values(w.facts).filter((g) => g.kind === 'poach' && g.business === b.id && t.known[g.id] && g.id !== f.id);
      const since = ps.find((g) => g.actor && g.actor !== t.id && g.t > f.t), before = ps.find((g) => g.actor === t.id && g.victim);
      const cl = since?.actor ? w.chars[since.actor] : undefined, old = before?.victim ? w.chars[before.victim] : undefined;
      if (cl?.alive) sayIt(`${cl.name} has muscled in on it since${cl.familyId ? ', one of the ' + famName(w, cl) + ' men' : ''}. That’s a claim, whatever else it is.`);
      else if (old?.alive && old.id !== t.id) sayIt(mine ? `${old.name} had it before me. He may still think it’s his.` : `${old.name} had it before. I couldn’t say if he’s let it go.`);
      else sayIt(mine ? 'Not that I’ve heard. If somebody thinks so, they haven’t said it to me.' : 'Not that I know of.');
      return stay(c, 8);
    }
    const o = w.chars[b.ownerId], pr = b.protection, gr = o?.rels[t.id]?.grudge ?? 0;
    if (pr?.late) sayIt(`He’s ${pr.late} week${pr.late === 1 ? '' : 's'} behind. I’m not saying more than that until I know why.`);
    else if (gr >= 0.3) sayIt('He pays. He looks at me like he’s counting the days.');
    else if ((o?.rels[t.id]?.trust ?? 0) >= 0.4) sayIt('He pays on the day, no fuss. We understand each other.');
    else sayIt('He pays. He doesn’t say much, and I don’t ask him to.');
    return stay(c, 8);
  },
};
const who: Act = {
  base: 'who', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!, a = w.chars[f.actor!]; ask(c, 'who');
    const hb = holdsBack(w, t, p, f, 'who');
    if (hb) { line(x, hb, settled(t.id, 'keeps it back', 'what he would be giving away (holdsBack)')); return stay(c, 8); }
    door.learnFrom(w, p, f, t.id, true);
    line(x, involvedIn(w, t, f) ? `"It was ${a.name}${a.familyId ? ' of the ' + famName(w, a) + ' family' : ''}."` : `"Word is it was ${a.name}. Don’t quote me, I only know what got back to me."`);
    return stay(c, 10);
  },
};
const howMuch: Act = {
  base: 'how_much', pane: 'personal',
  run: (c) => { const x = T(c), f = fact(c)!; ask(c, 'how_much'); const hb = holdsBack(x.w, x.t, x.p, f, 'cost'); if (hb) { line(x, hb, settled(x.t.id, 'keeps it back', 'his pride (holdsBack)')); return stay(c, 5); } line(x, `"${money(f.amount ?? 0)}," says ${x.t.name}.`); return stay(c, 5); },
};
const witness: Act = {
  base: 'witness', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'witness');
    const hb = holdsBack(w, t, p, f, 'witness');
    if (hb) { line(x, hb, settled(t.id, 'keeps it back', 'naming names (holdsBack)')); return stay(c, 8); }
    const seen = Object.values(w.chars).filter((y) => y.alive && y.id !== t.id && y.id !== p.id && y.known[f.id]?.from === 'witness');
    if (seen.length) { const ns = seen.slice(0, 2); line(x, `"${ns.map((y) => y.name).join(' and ')} ${ns.length > 1 ? 'were' : 'was'} there."`); for (const y of ns) door.trustAtLeast(w, p, y.id, 0.1); }
    else line(x, '"Nobody I know of."');
    return stay(c, 10);
  },
};
// where he heard it (the old engine offered this as a question; its answer is what he heard and from whom, as he is willing to say)
const source: Act = {
  base: 'source', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!; ask(c, 'source');
    const k = t.known[f.id], src = k && k.from !== 'public' && k.from !== 'witness' && k.from !== 'self' ? w.chars[k.from] : undefined;
    line(x, src ? `${t.name} thinks. "${src.name}. He was closer to it than I was."` : `${t.name} spreads his hands. "It was going round. You know how it is. Nobody owns a story like that."`);
    if (src && src.id !== p.id) door.trustAtLeast(w, p, src.id, 0.1);
    return stay(c, 10);
  },
};
const find: Act = {
  base: 'find', pane: 'personal',
  run: (c) => { const x = T(c), f = fact(c)!; ask(c, 'find'); door.memo(x.w, x.t, x.p.id, 'question', `You said you would find out who was behind it: ${f.text}`, { ref: f.id, due: x.w.now + 14 * DAY }); tweak(x, 0.04); line(x, `${x.t.name} nods slowly. "I would appreciate that."`); return stay(c, 10); },
};
const speak: Act = {
  base: 'speak', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!, a = w.chars[f.actor!]; ask(c, 'speak');
    door.promiseToHandle(w, p, t, a, { title: `Speak to ${a.name} for ${t.name}`, brief: `You told ${t.name} you would see to ${a.name}. ${f.text}`, pay: 0, cause: f.id, memo: `You promised to deal with ${a.name}.` });
    tweak(x, 0.06, 0.03);
    line(x, `${t.name} looks relieved. "I knew I could count on you." He’s counting on you now.`);
    return stay(c, 15);
  },
};
const sitdown: Act = {
  base: 'sitdown', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, f = fact(c)!, a = w.chars[f.actor!]; ask(c, 'sitdown');
    const have = w.grievances.find((q) => q.status === 'open' && (q.cause === f.id || (q.from === t.id && q.about === a.id)));
    const g = have ?? door.draftGrievance(w, { from: t.id, about: a.id, kind: f.kind === 'poach' ? 'territory' : 'violence', text: `${t.name} says ${a.name} wronged him: ${f.text}`, claim: f.amount ?? 0, valid: true, cause: f.id });
    for (const l of sitdownTalk(c, a)) line(x, l);
    const m = door.sitdown(w, p, g, !have);
    if (typeof m === 'string') { c.v.lines.push({ who: 'narr', text: m }); return stay(c, 15); }
    return { minutes: 15, meeting: m };
  },
};
// ---------------------------------------------------------------- a man he has a problem with
const subjectOf = (c: Ctx) => (c.v.th.subject ? c.w.chars[c.v.th.subject] : undefined);
function subjectQs(c: Ctx): Offer[] {
  const { w, h: p, n: t } = c, s = subjectOf(c);
  if (!s) return [];
  const o: Offer[] = [];
  const theirs = Object.values(w.facts).find((f) => f.actor === s.id && p.known[f.id]?.knowsActor && !t.known[f.id]?.knowsActor && !BORING.has(f.kind));
  if (theirs) o.push({ code: 'tell:' + theirs.id, label: said(c, 'tell', `Tell him what you know about ${s.name}`) });
  const exon = Object.values(w.facts).find((f) => f.actor && f.actor !== s.id && p.known[f.id]?.knowsActor && f.victim === t.id && t.rels[s.id]?.grudge >= 0.3);
  if (exon) o.push({ code: 'exon:' + exon.id, label: said(c, 'exon', `Tell him it wasn’t ${s.name}`), note: 'You know who it was.' });
  if (!asked(c, 'handle') && s.rank !== 'boss' && s.rank !== 'underboss' && s.familyId !== p.familyId) o.push({ code: 'handle', label: said(c, 'handle', `Offer to deal with ${s.name}`) });
  if (!asked(c, 'mediate')) o.push({ code: 'mediate2', label: said(c, 'mediate2', 'Offer to mediate') });
  return o;
}
const subject: Act = { base: 'subject', pane: 'personal', questions: subjectQs, run: () => out(0) };
const suspect: Act = {
  base: 'suspect', pane: 'personal',
  offers: (c) => (grudgeTarget(c.w, c.n) && troubleHere(c) ? [{ code: 'suspect', label: said(c, 'suspect', 'Ask who he suspects'), kind: 'between' }] : []),
  run: (c) => {
    const x = T(c), g = grudgeTarget(x.w, x.t);
    if (!g) return out(5);
    const s = x.w.chars[g[0]];
    line(x, `"If you want to know, I think it was ${s.name}."`);
    c.v.th.subject = s.id; c.v.th.asked = [];
    return { minutes: 20, next: subjectQs(c) };
  },
};
const tell: Act = {
  base: 'tell', pane: 'personal',
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, f = w.facts[code.split(':')[1]], s = w.chars[f.actor!];
    door.learnFrom(w, t, f, p.id, true);
    door.grudge(w, t, p.id, 0.15, `${p.name} told him who did it`);
    door.grudge(w, t, s.id, 0.15, f as never);
    tweak(x, 0.04);
    line(x, `${t.name} goes very still. "I didn’t know that."`);
    return { minutes: 15, next: subjectQs(c) };
  },
};
const exon: Act = {
  base: 'exon', pane: 'personal',
  run: (c, code) => {
    const x = T(c), { w, p, t } = x, f = w.facts[code.split(':')[1]], s = subjectOf(c)!, real = f.actor ? w.chars[f.actor] : undefined;
    door.easeGrudge(w, t, s.id, 0.4);
    if (real) { door.learnFrom(w, t, f, p.id, true); door.grudge(w, t, real.id, 0.25, f as never); }
    tweak(x, 0.05);
    line(x, `${t.name} frowns. "Then I’ve been looking at the wrong man."`);
    return { minutes: 15, next: subjectQs(c) };
  },
};
const handle: Act = {
  base: 'handle', pane: 'personal',
  run: (c) => {
    const x = T(c), { w, p, t } = x, s = subjectOf(c)!; ask(c, 'handle');
    door.promiseToHandle(w, p, t, s, { title: `${t.name} wants ${s.name} dealt with`, brief: `${t.name} has a grudge against ${s.name}. You offered to see to it. He hasn’t said what ${s.name} actually did.`, pay: 200, memo: `You offered to deal with ${s.name}.` });
    tweak(x, 0.05);
    line(x, `${t.name} nods. "I would pay for that."`);
    return { minutes: 15, next: subjectQs(c) };
  },
};
// a sit-down between him and the man he has a problem with: a grievance on the books if it takes place
function mediateWith(c: Ctx, sid: string | undefined) {
  const x = T(c), { w, p, t } = x;
  if (!sid) return out(5);
  const s = w.chars[sid];
  const have = w.grievances.find((q) => q.status === 'open' && ((q.from === t.id && q.about === s.id) || (q.from === s.id && q.about === t.id)));
  ask(c, 'mediate');
  // (whether his complaint would stand up at the table is the world's to say: an even chance, as it always was)
  const g = have ?? door.draftGrievance(w, { from: t.id, about: s.id, kind: 'respect', text: `${t.name} and ${s.name} have a problem with each other. ${t.name} asked you to settle it.`, claim: 0, valid: chance(w, t.id, 'a fair complaint', 'not a fair complaint', [term('even odds', 0.5)]).yes });
  const m = door.sitdown(w, p, g, !have);
  line(x, typeof m === 'string' ? (temper(t).agreeable > 0.5 ? '“I’d come. I don’t know that he would.”' : '“Good luck getting him to sit down.”') : temper(t).pride > 0.6 ? '“Fine. But I’m not the one who should be apologising.”' : '“All right. If he comes, I’ll come.”');
  if (typeof m === 'string') { c.v.lines.push({ who: 'narr', text: m }); return { minutes: 15, next: subjectQs(c) }; }
  return { minutes: 15, meeting: m };
}
const feud = (c: Ctx) => Object.entries(c.n.rels).filter(([id, q]) => q.grudge >= 0.3 && id !== c.w.playerId && c.w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge)[0];
const mediate: Act = {
  base: 'mediate', pane: 'business',
  offers: (c) => { const f = feud(c); return f && troubleHere(c) ? [{ code: 'mediate', label: said(c, 'mediate', `Offer to mediate between him and ${c.w.chars[f[0]].name}`), note: 'A sit-down. Both have to show up.', kind: 'between' }] : []; },
  run: (c) => mediateWith(c, Object.entries(c.n.rels).filter(([id, q]) => q.grudge >= 0.3 && c.w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge)[0]?.[0]),
};
const mediate2: Act = { base: 'mediate2', pane: 'personal', run: (c) => mediateWith(c, c.v.th.subject) };

// ---------------------------------------------------------------- what is going round (the old "Heard anything?", part of "What's new?")
// His openness with the player sets what he passes on: everything, only some of it, a line about nothing much, or a brush-off. Once a day.
export function streetNews(c: Ctx): { told: boolean; next?: Offer[] } {
  const x = T(c), { w, p, t } = x, day = Math.floor(w.now / 1440), key = `chat:${t.id}`;
  if ((p.cooldown[key] ?? -1) >= day) return { told: false };
  door.cool(p, key, day);
  const tier = openness(w, t, p);
  if (tier === 'hostile') { line(x, voice(x, 'chat_hostile'), settled(t.id, 'hostile', 'what he thinks of you (openness)')); return { told: true }; }
  if (tier === 'brush') { line(x, voice(x, 'chat_brush'), settled(t.id, 'brushes you off', 'what he thinks of you (openness)')); return { told: true }; }
  if (tier === 'general') { line(x, voice(x, 'chat_general')); if (!chance(w, t.id, 'goes on', 'leaves it there', [term('a man who keeps it general', 0.4)]).yes) return { told: true }; }
  const sup = RKN(t.rank) > RKN(p.rank) || t.id === p.bossId, lines: string[] = [];
  const heard = door.passOn(w, t, p, lines, { partial: tier !== 'open', avoidActor: sup ? t.id : undefined, say: (f, k) => { const base = told(w, t, f, k), mine = p.known[f.id], b = !k && mine?.blame ? w.chars[mine.blame] : undefined; return b ? `${base.replace(/[.!]?$/, '.')} If you ask me, it was ${b.name}.` : base; }, exclude: (f) => (tier === 'general' && (f.victim === t.id || f.actor === t.id)) || (tier === 'partial' && f.victim === t.id && HUMILIATING.has(f.kind)) });
  for (const l of lines) line(x, l);
  if (!heard.length) { if (tier !== 'general') line(x, voice(x, 'chat_none')); return { told: tier !== 'general' }; }
  c.v.th.fact = heard[0].id; c.v.th.asked = []; c.v.th.denied = false;
  return { told: true, next: questions(c) };
}

export const INFO: Act[] = [inc, pickIncident, own, lie, view, tellMore, involve, canDo, press, drop, { ...why, base: 'why' }, { ...why, base: 'p_how' }, { ...why, base: 'p_claim' }, { ...why, base: 'p_owner' }, who, howMuch, witness, source, find, speak, sitdown, subject, suspect, tell, exon, handle, mediate, mediate2];
