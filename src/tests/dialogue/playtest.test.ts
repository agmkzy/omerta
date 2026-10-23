// V90 playtests: ten conversations played through the real conversation code, as a player would, with the transcript kept.
// Each one checks the behaviour the overhaul is for (docs/V90_CONVERSATION.md). PLAYTEST=docs/V90_PLAYTESTS.md writes the
// transcripts out for reading.
import assert from 'node:assert';
import { afterAll, describe, test as ok } from 'vitest';
import { writeFileSync } from 'node:fs';
import { advance } from '../../engine';
import { DAY, type Character, type World } from '../../types';
import { arrive, options, say, focusTitle, QUESTIONS, type Convo, type DOpt } from '../../dialogue';
import { openAsk, stance, askBetween } from '../../asks';
import { makeLoan } from '../../encounters';
import { whereIs } from '../../where';
import { ownerBiz, rel, addFact } from '../../core';
import { temper, viewOf, characterWords, conductOf } from '../../temper';
import { world60 } from './fixtures';
import { createWorld } from '../../world';
import { Rng } from '../../rng';
import { P } from '../helpers';

const OUT: string[] = [];
afterAll(() => { if (process.env.PLAYTEST) writeFileSync(process.env.PLAYTEST, OUT.join('\n')); });

// A conversation, played: what is on screen, what you choose, what he says.
class Talk {
  c: Convo | null; log: string[] = [];
  constructor(public w: World, public t: Character, public title: string) {
    const p = P(w); (p.intro ??= {})[t.id] ??= w.now;
    const a = arrive(w, p, t, { lines: [] }, whereIs(w, p, t), t.rels[p.id]?.lastMet ?? -1e9);
    this.c = a.convo; this.log.push(`### ${title}`, '', `*${t.name}: ${who(t)}*`, '', ...a.lines.map((l) => `> ${l}`), '');
    this.screen();
  }
  opts(): DOpt[] { return this.c ? options(this.w, P(this.w), this.t, this.c) : []; }
  screen() {
    if (!this.c) return;
    const o = this.opts(), title = focusTitle(this.w, P(this.w), this.t, this.c);
    const groups = [...new Set(o.map((x) => x.group ?? ''))];
    this.log.push('```', ...(title ? [`Talking about: ${title}`] : []), ...groups.flatMap((g) => [...(g ? [`  ${g.toUpperCase()}`] : []), ...o.filter((x) => (x.group ?? '') === g).map((x) => `    ${x.done ? '(' : ''}${x.label}${x.done ? ')' : ''}`)]), '```', '');
  }
  // choose by the words on the screen (or a code)
  // choose by what it does: a move in the matter in hand (ask, pressure, force...), or a point answered (x:...)
  act(mv: string): string[] { return this.pick(new RegExp(`^(mv|x):[^:]+:${mv}$`), true); }
  can(mv: string) { return this.opts().some((x) => !x.done && new RegExp(`^(mv|x):[^:]+:${mv}$`).test(x.code)); }
  pick(m: RegExp | string, byCode = false): string[] {
    const o = this.opts().find((x) => (typeof m === 'string' ? x.code === m : m.test(byCode ? x.code : x.label)) && !x.done);
    assert.ok(o, `${this.title}: no "${m}" among: ${this.opts().map((x) => x.label).join(' | ')}`);
    const r = say(this.w, P(this.w), this.t, this.c!, o!.code);
    this.log.push(`**You:** ${r.q ?? o!.label}`, '', ...r.lines.filter((l) => !l.startsWith('⟡')).map((l) => `> ${l}`), '');
    this.c = r.convo;
    if (!this.c) this.log.push('*(the conversation is over)*', ''); else this.screen();
    return r.lines;
  }
  has(m: RegExp) { return this.opts().some((x) => !x.done && m.test(x.label)); }
  // back out of whatever is in hand, and go
  // (a follow-up may offer only its own way out, "Let's leave it": the way out is always there, not always in the same words)
  leave() { for (let i = 0; i < 4 && this.c; i++) this.pick(this.has(/Take your leave/) ? /Take your leave/ : this.has(/Talk about something else/) ? /Talk about something else/ : /leave it/i); }
  note(s: string) { this.log.push(`*${s}*`, ''); }
  done() { OUT.push(...this.log, '---', ''); }
}
const who = (t: Character) => { const tp = temper(t); return `${t.rank}; ` + (Object.entries(tp) as [string, number][]).map(([k, v]) => `${k} ${v >= 0.66 ? 'high' : v <= 0.34 ? 'low' : 'middling'}`).join(', '); };
const civ = (w: World) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian');
// (shopkeepers nobody yet protects; whoever did is let go, so the offer is the only one on the table)
const shopkeepers = (w: World) => civ(w).filter((c) => ownerBiz(w, c.id)?.open).map((c) => { delete ownerBiz(w, c.id)!.protection; return c; });
// a shopkeeper (the n-th that can be asked) with an offer of protection from you open on the table
function offer(w: World, n: number, k: 'meek' | 'proud' | 'agreeable' | undefined, amt: (inc: number) => number) {
  const p = P(w), all = shopkeepers(w);
  for (let i = n; i < all.length + n; i++) {
    const t = all[i % all.length], b = ownerBiz(w, t.id)!;
    if (k) temperament(t, k);
    b.distress = 0;
    const s = openAsk(w, 'protect', p, t, { biz: b.id, amt: Math.max(15, Math.round(amt(b.income) / 5) * 5) });
    if (s && s.stage !== 'resolved') return { t, b, s };
  }
  throw new Error('no shop to ask');
}
const setT = (c: Character, t: Partial<Character['traits']>) => Object.assign(c.traits, t);
// a man made to measure, for the comparisons: the traits each dimension leans on, pushed
const temperament = (c: Character, k: 'meek' | 'proud' | 'agreeable') => setT(c, k === 'meek' ? { courage: 0, caution: 1, violence: 0, ambition: 0, greed: 0.3 } : k === 'proud' ? { courage: 1, caution: 0.2, violence: 0.8, ambition: 1, greed: 0.8 } : { courage: 0.5, caution: 0.5, violence: 0, ambition: 0.2, greed: 0 });

describe('V90 playtests', () => {
  ok('1. an ordinary man: the four questions, answers that follow from what he says, and a way back', { tags: ['scenario'] }, () => {
    const w = world60(), t = civ(w).find((c) => !ownerBiz(w, c.id))!;
    rel(t, P(w).id).trust = 0.4;
    const x = new Talk(w, t, '1. An ordinary man');
    assert.deepEqual(x.opts().filter((o) => o.group === 'Talk').map((o) => o.label), QUESTIONS);
    x.pick(/How are you keeping/);
    if (x.c && x.c.node !== 'root') x.pick(/./); // whatever his answer opened, answer it
    if (x.has(/Heard anything/)) x.pick(/Heard anything/);
    if (x.has(/What do you make of/)) { x.pick(/What do you make of/); const o = x.opts().find((o) => !o.done && !o.group && o.code !== 'f:' && o.code !== 'root'); if (o) x.pick(o.code); }
    x.leave();
    x.done();
  });

  ok('2. a man with several matters: the hub stays short, the most pressing first, the rest one row away', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), t = shopkeepers(w)[0], b = ownerBiz(w, t.id)!;
    p.cash = 3000; rel(t, p.id).trust = 0.45;
    w.debts.push({ id: 'pt-d', creditor: p.id, debtor: t.id, principal: 400, balance: 400, weeklyPayment: 40, missed: 2, status: 'active', rate: 0.05, since: w.now - 20 * DAY } as never);
    openAsk(w, 'protect', p, t, { biz: b.id, amt: 40 });
    w.favours.push({ id: 'pt-f', from: p.id, to: t.id, size: 1, what: 'a word with the inspector', settled: false, t: w.now - 5 * DAY } as never);
    rel(t, p.id).grudge = 0.3;
    const x = new Talk(w, t, '2. A man with several matters between you');
    const between = x.opts().filter((o) => o.group === 'Between you' && o.code !== 'f:more');
    assert.ok(between.length <= 3, 'three at most');
    if (x.has(/Other things between you/)) { x.pick(/Other things between you/); x.pick(/Talk about something else/); }
    x.pick(/Protection at/);
    assert.ok(focusTitle(w, p, t, x.c!)?.startsWith('Protection at'), 'the subject is named');
    x.act('ask');
    x.leave();
    x.done();
  });

  ok('3. protection: the offer, his reason, a challenge to it, and where that leads', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t, s } = offer(w, 1, 'proud', (i) => Math.max(40, i * 0.2));
    const x = new Talk(w, t, '3. Protection: persuasion, refusal, intimidation');
    x.pick(/Protection at/);
    x.act('ask');
    // whatever his reason, the answers on screen are about it
    if (s.stage !== 'resolved' && s.m?.beat === 'claim') {
      const claim = String(s.m.claim);
      x.note(`(his reason: ${claim}; ${Number(s.m.claimT) ? 'true' : 'not the whole truth'})`);
      if (claim === 'money') { x.act('doubt'); if (x.can('books')) { x.act('books'); if (x.can('assume')) x.act('assume'); } }
      else x.pick(x.opts().find((o) => o.code.startsWith('x:'))!.code);
    }
    if (s.stage !== 'resolved' && x.c && x.can('pressure')) x.act('pressure');
    if (s.stage !== 'resolved' && x.c && x.can('force')) x.act('force');
    x.note(`(the matter: ${s.stage === 'resolved' ? s.out : 'still open, ' + (stance(w, s, t.id).last ?? 'unanswered')})`);
    x.leave();
    x.done();
  });

  ok('4. feared, not respected: he gives in, and afterwards it does not stay between you', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t, s } = offer(w, 2, 'agreeable', (i) => i * 0.06 + 5);
    t.traits.courage = 0.1; t.traits.caution = 0.9;
    const r = rel(t, p.id); r.fear = 0.8; r.respect = 0.1; r.trust = 0.3;
    const friend = civ(w).find((c) => c.id !== t.id)!; rel(t, friend.id).trust = 0.8; rel(t, friend.id).affection = 0.8;
    const facts0 = Object.keys(w.facts).length;
    const x = new Talk(w, t, '4. Feared, not respected');
    const v0 = viewOf(w, t, p);
    x.note(`(how he sees you: fear ${v0.fear > 0.5 ? 'high' : 'some'}, respect ${v0.respect < 0.2 ? 'low' : 'some'}, trust ${v0.trust < 0.35 ? 'low' : 'some'})`);
    x.pick(/Protection at/);
    x.act('ask');
    for (let i = 0; i < 2 && s.stage !== 'resolved' && x.c && x.can('pressure'); i++) x.act('pressure');
    x.note(`(outcome: ${s.stage === 'resolved' ? s.out : 'open'}; afterwards he told ${Object.values(w.facts).slice(facts0).some((f) => f.kind === 'threat' && f.victim === t.id) ? 'someone' : 'no one'} that he was squeezed; his trust in you is now ${rel(t, p.id).trust < 0.3 ? 'low' : 'unchanged'})`);
    if (s.out === 'gave in') assert.ok(Object.values(w.facts).slice(facts0).some((f) => f.kind === 'threat' && f.victim === t.id) || rel(t, p.id).grudge > 0.1, 'a frightened yes has an afterwards');
    x.leave();
    x.done();
  });

  ok('5. the same approach, three temperaments: different reactions and different decisions', { tags: ['scenario'] }, () => {
    const outcomes: string[] = [];
    for (const k of ['meek', 'proud', 'agreeable'] as const) {
      const w = world60(), { t, s } = offer(w, 3, k, (i) => i * 0.1 + 10);
      const x = new Talk(w, t, `5. The same approach, a ${k} man`);
      x.pick(/Protection at/); x.act('ask');
      let said: string[] = [];
      if (s.stage !== 'resolved' && x.c && x.can('pressure')) said = x.act('pressure');
      outcomes.push(`${k}: ${s.stage === 'resolved' ? s.out : stance(w, s, t.id).last}, saying ${said.filter((l) => /[“"]/.test(l)).join(' ')}`);
      x.done();
    }
    OUT.push('*Outcomes:* ' + outcomes.join(' · '), '');
    assert.ok(new Set(outcomes).size === 3, 'three men, three different reactions: ' + outcomes.join(' | '));
  });

  ok('6. coming back days later: the matter remembers where it stood, and he says so', { tags: ['scenario'] }, () => {
    const w = world60(), { t, s } = offer(w, 1, 'proud', (i) => i * 0.2 + 20);
    const x = new Talk(w, t, '6. Revisiting days later (first visit)');
    x.pick(/Protection at/); x.act('ask');
    x.leave();
    x.done();
    advance(w, w.now + 4 * DAY);
    const y = new Talk(w, t, '6. Revisiting days later (four days on)');
    if (s.stage === 'resolved') { y.note('(it was settled in the meantime)'); y.done(); return; }
    const row = y.opts().find((o) => o.code === 'f:m:' + s.id);
    assert.ok(row?.hint && /no|time|terms|waiting|someone/i.test(row.hint), 'the row says where it stands: ' + row?.hint);
    const l = y.pick(/Protection at/);
    assert.ok(l.length >= 1 && /[“"]/.test(l.join(' ')), 'naming it is answered from where it stands');
    y.leave();
    y.done();
  });

  ok('7. what he does not know, or knows wrongly: he says only what he could', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w);
    const t = civ(w).find((c) => !ownerBiz(w, c.id) && Object.keys(c.known).length < 40)!;
    const victim = civ(w).find((c) => c.id !== t.id)!, culprit = Object.values(w.chars).find((c) => c.alive && c.rank === 'soldier')!;
    const f = addFact(w, { kind: 'beating', actor: culprit.id, victim: victim.id, text: `${culprit.name} beat up ${victim.name}.`, textHidden: `Somebody beat up ${victim.name}.`, district: victim.district }, { witnesses: [p.id] });
    t.known[f.id] = { t: w.now, from: 'public', knowsActor: false } as never; // he heard it happened, not who did it
    rel(t, p.id).trust = 0.5;
    const x = new Talk(w, t, '7. Incomplete information');
    x.pick(/Heard anything/);
    for (const l of x.log) if (l.startsWith('> ')) assert.ok(!l.includes(culprit.name) || l.includes('You'), 'he never names a man he does not know did it');
    if (x.c && x.c.node !== 'root') x.pick(/./);
    x.leave();
    x.done();
  });

  ok('8. he starts it: what he came to say is the subject, at once', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), t = Object.values(w.chars).find((c) => c.alive && c.familyId === p.familyId && c.rank === 'soldier')!;
    p.cash = Math.max(p.cash, 1000); makeLoan(w, p, t); const e = w.enc.at(-1)!; // (his own request, as the game makes it)
    const x = new Talk(w, t, '8. NPC-initiated');
    assert.equal(x.c!.ctx.focus, 'enc:' + e.id, 'his request is the subject from the start');
    x.pick(/What’s it really for/);
    if (x.c && x.has(/Lend him/)) x.pick(/Lend him/);
    x.leave();
    x.done();
  });

  ok('9. impasse: pushed too far, he ends it, and won’t start again today', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t } = offer(w, 4, 'proud', (i) => i * 0.25 + 30);
    const x = new Talk(w, t, '9. Impasse');
    x.pick(/Protection at/); x.act('ask');
    for (let i = 0; i < 6 && x.c; i++) {
      const o = x.opts().find((o) => !o.done && /^(mv:[^:]+:(pressure|force)|x:[^:]+:(nochoice|assume|now|notthere))$/.test(o.code));
      if (!o) break;
      x.pick(o.code);
    }
    assert.ok(!x.c || x.c.ctx.cold || x.c.ctx.shut, 'he has had enough: cold, or the conversation is over\n' + x.log.join('\n'));
    x.done();
    if (!x.c && (p.cooldown[`shut:${t.id}`] ?? 0) > w.now) {
      const y = new Talk(w, t, '9. Impasse (trying again the same day)');
      assert.ok(y.opts().every((o) => o.code === 'root'), 'he won’t talk');
      y.done();
    }
  });

  ok('10. switching subjects: from a matter to talk and back, and he breaks in with his own', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t } = offer(w, 5, 'agreeable', (i) => i * 0.05 + 10);
    rel(t, p.id).trust = 0.5;
    const x = new Talk(w, t, '10. Subject switching');
    x.pick(/Protection at/);
    x.pick(/Talk about something else/);
    x.pick(/How’s business/);
    makeLoan(w, p, t); // (a real request of his own, as the game makes it)
    if (x.c && x.c.node !== 'root') { x.pick(/./); if (x.c && x.c.node !== 'root') x.pick(/Talk about something else/); }
    if (x.c && x.has(/Heard anything|How are you keeping/)) x.pick(/Heard anything|How are you keeping/);
    assert.ok(!x.c || x.c.ctx.focus?.startsWith('enc:') || x.log.some((l) => /needs money|I’ll make it right/.test(l)), 'he broke in with his own');
    if (x.c && x.has(/What’s it really for/)) x.pick(/What’s it really for/);
    if (x.c && x.has(/Lend half/)) x.pick(/Lend half/);
    if (x.c && x.has(/Talk about something else/)) x.pick(/Talk about something else/);
    if (x.c && x.has(/Protection at/)) x.pick(/Protection at/);
    x.leave();
    x.done();
    OUT.push(`*Your character, as you have shown it in these conversations:* ${characterWords(p).join(' ')} (conduct: ${JSON.stringify(conductOf(p))})`, '');
  });

  // Fresh conversations, not scripted: another world, men of every station, a plain player who goes where the conversation goes
  // (answers what is in hand first, then talks, then changes the subject), at length, and again a week later.
  ok('11. fresh men, long conversations, and a week later', { tags: ['scenario'] }, () => {
    const w = createWorld(7, 'Tony Marino'); advance(w, w.now + 45 * DAY);
    const p = P(w); p.cash = 4000;
    const pickMan = (f: (c: Character) => boolean) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && f(c)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    const cast = [
      pickMan((c) => c.rank === 'capo' && c.familyId === p.familyId && c.id !== p.bossId),
      pickMan((c) => c.rank === 'soldier' && !!c.familyId && c.familyId !== p.familyId),
      pickMan((c) => c.id === p.bossId),
      pickMan((c) => c.rank === 'civilian' && !!ownerBiz(w, c.id)?.protection),
      pickMan((c) => c.rank === 'civilian' && !ownerBiz(w, c.id) && !!c.problem),
      pickMan((c) => c.rank === 'associate' && c.familyId === p.familyId),
    ].filter(Boolean) as Character[];
    const rng = new Rng(11);
    const play = (t: Character, title: string, steps: number) => {
      const x = new Talk(w, t, title);
      for (let i = 0; i < steps && x.c; i++) {
        const o = x.opts().filter((q) => !q.done && q.code !== 'root');
        const pointed = o.filter((q) => /^(x|enc):/.test(q.code));
        const inHand = o.filter((q) => /^(mv|mt|tk|inc|f_|d_|cr_|sh_|a_)/.test(q.code) || (!q.group && !q.nav));
        const doors = o.filter((q) => q.group && q.code.startsWith('f:') && q.code !== 'f:');
        const talk = o.filter((q) => q.group === 'Talk' && !q.nav);
        const c = pointed[0] ?? (inHand.length && rng.chance(0.7) ? rng.pick(inHand) : talk.length && rng.chance(0.5) ? rng.pick(talk) : doors.length ? rng.pick(doors) : o.find((q) => q.code === 'f:') ?? o[0]);
        if (!c) break;
        x.pick(c.code);
      }
      x.leave(); x.done();
    };
    for (const t of cast) play(t, `11. ${t.name}, ${t.rank === 'civilian' ? (ownerBiz(w, t.id)?.name ?? 'a civilian') : t.rank}`, 12);
    advance(w, w.now + 7 * DAY);
    for (const t of cast.slice(0, 3)) play(t, `11. ${t.name}, a week later`, 6);
  });
});
