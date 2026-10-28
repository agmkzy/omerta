// V90 playtests (since Gate 4, on the one conversation: conv/visit.ts): ten conversations played through the real conversation code, as a player would, with the transcript kept.
// Each one checks the behaviour the overhaul is for (docs/V90_CONVERSATION.md). PLAYTEST=docs/V90_PLAYTESTS.md writes the
// transcripts out for reading.
import assert from 'node:assert';
import { afterAll, describe, test as ok } from 'vitest';
import { writeFileSync } from 'node:fs';
import { advance } from '../../engine';
import { DAY, type Character, type World } from '../../types';
import { begin, choose, everything, type Choice, type Visit } from '../../conv/visit';
import { openAsk, stance, askBetween } from '../../asks';
import { makeLoan } from '../../encounters';
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
  v: Visit; log: string[] = []; c: Visit | null;
  constructor(public w: World, public t: Character, public title: string) {
    const p = P(w); (p.intro ??= {})[t.id] ??= w.now;
    this.v = begin(w, t.id); this.c = this.v.ended ? null : this.v;
    this.log.push(`### ${title}`, '', `*${t.name}: ${who(t)}*`, '', ...this.v.lines.map((l) => `> ${l.text}`), '');
    this.screen();
  }
  opts(): Choice[] { return this.c ? this.v.choices : []; }
  screen() {
    if (!this.c) return;
    const o = this.opts(), groups = [...new Set(o.map((x) => x.group))];
    this.log.push('```', ...(this.v.pane ? [`Under: ${this.v.pane}`] : []), ...groups.flatMap((g) => [`  ${g.toUpperCase()}`, ...o.filter((x) => x.group === g).map((x) => `    ${x.label}`)]), '```', '');
  }
  // choose by what it does: a move in the matter in hand (ask, pressure, force...), or a point answered (x:...)
  act(mv: string): string[] { return this.pick(new RegExp(`^a:(mv|x):[^:]+:${mv}$`), true); }
  can(mv: string) { return this.opts().some((x) => new RegExp(`^a:(mv|x):[^:]+:${mv}$`).test(x.id)); }
  pick(m: RegExp | string, byId = false): string[] {
    const hit = (x: Choice) => (typeof m === 'string' ? x.id === m : m.test(byId ? x.id : x.label));
    // (as a player would: if it is not on the screen, it is under one of the headings, or among the rest of them)
    if (!this.opts().some(hit) && this.c) for (const k of ['business', 'personal', 'confront']) {
      if (this.opts().some(hit)) break;
      if (everything(this.w, this.v).some(hit)) { choose(this.w, this.v, 'home'); if (this.v.choices.some((x) => x.id === 'u:' + k)) { choose(this.w, this.v, 'u:' + k); if (!this.v.choices.some(hit) && this.v.choices.some((x) => x.id === 'all:' + k)) choose(this.w, this.v, 'all:' + k); } }
    }
    const o = this.opts().find(hit) ?? (this.c ? everything(this.w, this.v).find(hit) : undefined);
    assert.ok(o, `${this.title}: no "${m}" among: ${this.opts().map((x) => x.label).join(' | ')}`);
    const n0 = this.v.lines.length, r = choose(this.w, this.v, o!.amount ? `${o!.id}:${o!.amount.value}` : o!.id);
    const said = this.v.lines.slice(n0);
    this.log.push(...said.map((l) => (l.who === 'you' ? `**You:** ${l.text}` : `> ${l.text}`)), '');
    if (r.meeting || this.v.ended) { this.c = null; this.log.push('*(the conversation is over)*', ''); } else this.screen();
    return said.filter((l) => l.who !== 'you' && l.who !== 'card').map((l) => l.text);
  }
  has(m: RegExp) { return !!this.c && (this.opts().some((x) => m.test(x.label)) || everything(this.w, this.v).some((x) => m.test(x.label))); }
  leave() { if (this.c) this.pick('leave'); }
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
  ok('1. an ordinary man: the ways in, the everyday questions inside them, answers that follow from what he says, and a way back', { tags: ['scenario'] }, () => {
    const w = world60(), t = civ(w).find((c) => !ownerBiz(w, c.id))!;
    rel(t, P(w).id).trust = 0.4;
    const x = new Talk(w, t, '1. An ordinary man');
    // (the everyday questions: what is new, an evening out, how he is keeping; "what do you make of…" went in the overhaul)
    const all = everything(w, x.v).map((o) => o.id);
    assert.ok(['news', 'spend', 'a:how'].every((k) => all.includes(k)), 'the everyday questions: ' + all.join());
    x.pick('a:how');
    if (x.c && x.opts().some((o) => o.group === 'reply')) x.pick(x.opts().find((o) => o.group === 'reply')!.id); // whatever his answer opened, answer it
    if (x.has(/What’s new/)) x.pick(/What’s new/);
    if (x.c && x.has(/What do you make of…/)) { x.pick('a:think'); const o = x.opts().find((o) => o.group === 'reply'); if (o) x.pick(o.id); }
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
    assert.ok(x.opts().filter((o) => o.group !== 'intent' && o.group !== 'leave').length <= 2, 'what he raises himself, two at most, and the headings');
    x.pick('u:business');
    assert.ok(x.opts().filter((o) => !['more', 'leave'].includes(o.group)).length <= 4, 'four at most under a heading, the rest one step away');
    x.pick(/rotection at/);
    x.act('ask');
    x.leave();
    x.done();
  });

  ok('3. protection: the offer, his reason, a challenge to it, and where that leads', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t, s } = offer(w, 1, 'proud', (i) => Math.max(40, i * 0.2));
    const x = new Talk(w, t, '3. Protection: persuasion, refusal, intimidation');
    x.pick(/rotection at/);
    x.act('ask');
    // whatever his reason, the answers on screen are about it
    if (s.stage !== 'resolved' && s.m?.beat === 'claim') {
      const claim = String(s.m.claim);
      x.note(`(his reason: ${claim}; ${Number(s.m.claimT) ? 'true' : 'not the whole truth'})`);
      if (claim === 'money') { x.act('doubt'); if (x.can('books')) { x.act('books'); if (x.can('assume')) x.act('assume'); } }
      else { const o = x.opts().find((o) => o.id.startsWith('a:x:')); if (o) x.pick(o.id); }
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
    x.pick(/rotection at/);
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
      x.pick(/rotection at/); x.act('ask');
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
    x.pick(/rotection at/); x.act('ask');
    x.leave();
    x.done();
    advance(w, w.now + 4 * DAY);
    const y = new Talk(w, t, '6. Revisiting days later (four days on)');
    if (s.stage === 'resolved') { y.note('(it was settled in the meantime)'); y.done(); return; }
    const row = everything(w, y.v).find((o) => o.id === 'a:m:' + s.id);
    assert.ok(row?.note && /no|time|terms|waiting|someone/i.test(row.note), 'the row says where it stands: ' + row?.note);
    const l = y.pick(/rotection at/);
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
    x.pick(/What’s new/);
    for (const l of x.log) if (l.startsWith('> ')) assert.ok(!l.includes(culprit.name) || l.includes('You'), 'he never names a man he does not know did it');
    const o = x.opts().find((q) => q.group === 'reply'); if (o) x.pick(o.id);
    x.leave();
    x.done();
  });

  ok('8. he starts it: he asks for a minute, and once you say so, what he came to say is the subject', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), t = Object.values(w.chars).find((c) => c.alive && c.familyId === p.familyId && c.rank === 'soldier')!;
    p.cash = Math.max(p.cash, 1000); makeLoan(w, p, t); const e = w.enc.at(-1)!; // (his own request, as the game makes it)
    const x = new Talk(w, t, '8. NPC-initiated');
    // (he raises it himself, and what can be said to it is what is on screen: his request's answers, or how you take being asked)
    assert.ok(x.opts().some((o) => o.id.startsWith(`a:enc:${e.id}:`)), 'his request is the subject: ' + x.opts().map((o) => o.id).join());
    for (const l of [/Can it wait/, /Not right now/]) assert.ok(x.opts().some((o) => l.test(o.label)), 'you choose how to take it: ' + l);
    if (x.has(/What’s it really for/)) x.pick(/What’s it really for/);
    if (x.c && x.has(/Lend him/)) x.pick(/Lend him/);
    x.leave();
    x.done();
  });

  ok('9. impasse: pushed too far, he ends it, and won’t start again today', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t } = offer(w, 4, 'proud', (i) => i * 0.25 + 30);
    const x = new Talk(w, t, '9. Impasse');
    x.pick(/rotection at/); x.act('ask');
    for (let i = 0; i < 6 && x.c; i++) {
      const o = x.opts().find((o) => /^a:(mv:[^:]+:(pressure|force)|x:[^:]+:(nochoice|assume|now|notthere))$/.test(o.id));
      if (!o) break;
      x.pick(o.id);
    }
    assert.ok(!x.c || x.v.th.cold || x.v.th.shut || !x.opts().some((o) => /^a:(mv|x):/.test(o.id)), 'he has had enough: cold, or the conversation is over, or there is nothing more to push\n' + x.log.join('\n'));
    x.done();
    if (!x.c && (p.cooldown[`shut:${t.id}`] ?? 0) > w.now) {
      const y = new Talk(w, t, '9. Impasse (trying again the same day)');
      assert.ok(y.opts().every((o) => o.id === 'leave'), 'he won’t talk');
      y.done();
    }
  });

  ok('10. switching subjects: from a matter to talk and back, and he breaks in with his own', { tags: ['scenario'] }, () => {
    const w = world60(), p = P(w), { t } = offer(w, 5, 'agreeable', (i) => i * 0.05 + 10);
    rel(t, p.id).trust = 0.5;
    const x = new Talk(w, t, '10. Subject switching');
    x.pick(/rotection at/);
    x.pick('back');
    makeLoan(w, p, t); // (a real request of his own, as the game makes it)
    if (x.c && x.has(/How’s business/)) x.pick(/How’s business/);
    if (x.c && x.has(/What’s new/)) x.pick(/What’s new/);
    assert.ok(!x.c || x.opts().some((o) => o.id.startsWith('a:enc:')) || x.log.some((l) => /cuts across you|raises something of his own|needs money|I’ll make it right/.test(l)), 'he broke in with his own\n' + x.log.join('\n'));
    if (x.c && x.has(/What’s it really for/)) x.pick(/What’s it really for/);
    if (x.c && x.has(/Lend half/)) x.pick(/Lend half/);
    if (x.c && x.opts().some((o) => o.id === 'back')) x.pick('back');
    if (x.c && x.has(/rotection at/)) x.pick(/rotection at/);
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
        const o = x.opts().filter((q) => q.id !== 'leave');
        const pointed = o.filter((q) => /^a:(x|enc):/.test(q.id));
        const inHand = o.filter((q) => q.group === 'reply' || q.group === 'matter');
        const heads = o.filter((q) => q.group === 'intent' || /^all:/.test(q.id));
        const talk = o.filter((q) => q.group === 'social');
        const c = pointed[0] ?? (inHand.length && rng.chance(0.7) ? rng.pick(inHand) : talk.length && rng.chance(0.5) ? rng.pick(talk) : heads.length ? rng.pick(heads) : o.find((q) => q.id === 'back' || q.id === 'home') ?? o[0]);
        if (!c) break;
        x.pick(c.id);
      }
      x.leave(); x.done();
    };
    for (const t of cast) play(t, `11. ${t.name}, ${t.rank === 'civilian' ? (ownerBiz(w, t.id)?.name ?? 'a civilian') : t.rank}`, 12);
    advance(w, w.now + 7 * DAY);
    for (const t of cast.slice(0, 3)) play(t, `11. ${t.name}, a week later`, 6);
  });
});
