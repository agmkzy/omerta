import { huntDue } from './violence';
// Delayed consequences. Violence and secrets do not resolve when they happen: witnesses come forward,
// the police take an interest, a client calls in a favour, a false accusation comes apart.
import { addFact, bear, clamp, DEED, ease, feel, handleDeath, learn, ownerBiz, rel, repute } from './core';
import { mkJob } from './jobs';
import { Character, DAY, Fact, Id, World } from './types';
import { money } from './core';
import { intentDue, noteDispute, settleDispute } from './disputes';
import { perform } from './actions';
import { capOf, openSeatFor, seats } from './career';

export interface KillOpts {
  client?: Id; // who paid for it
  false?: boolean; // the reason given for it was untrue
  accuser?: Id; // who made the accusation
}

// Called whenever someone is killed. Nothing here happens today.
export function afterKilling(w: World, killer: Character, victim: Character, f: Fact | undefined, o: KillOpts = {}) {
  (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(7, 21) * DAY, kind: 'heat', a: killer.id, b: victim.id, amount: w.rng.range(0.25, 0.45) });
  clientParts(w, killer, victim, f, o);
}

function clientParts(w: World, killer: Character, victim: Character, f: Fact | undefined, o: KillOpts) {
  const push = (p: Omit<import('./types').Pending, 'id'>) => (w.pending ??= []).push({ id: 'p' + w.nextId++, ...p });
  if (o.client && killer.isPlayer && w.rng.chance(0.55)) push({ due: w.now + w.rng.int(21, 42) * DAY, kind: 'blackmail', a: o.client, b: killer.id, fact: f?.id });
  if (o.false && o.accuser && w.rng.chance(0.7)) push({ due: w.now + w.rng.int(21, 56) * DAY, kind: 'truth', a: o.accuser, b: victim.id, c: killer.id, fact: f?.id });
}

// A client for a contract killing: attach the fallout that depends on who asked and whether they lied.
export function afterClient(w: World, killer: Character, victim: Character, o: KillOpts) {
  const f = Object.values(w.facts).filter((q) => q.kind === 'murder' && q.victim === victim.id).sort((a, b) => b.t - a.t)[0];
  clientParts(w, killer, victim, f, o);
}

export function pendingTick(w: World) {
  if (!w.pending?.length) return;
  const due = w.pending.filter((q) => q.due <= w.now);
  if (!due.length) return;
  w.pending = w.pending.filter((q) => q.due > w.now);
  for (const q of due) {
    switch (q.kind) {
      case 'intent': {
        intentDue(w, q, perform);
        break;
      }
      case 'hunt': {
        huntDue(w, q);
        break;
      }
      case 'seat': {
        seatDecision(w, q);
        break;
      }
      case 'dispute': {
        disputeStep(w, q);
        break;
      }
      case 'reveal': {
        const f = q.fact ? w.facts[q.fact] : undefined;
        if (!f || !f.actor || !w.chars[f.actor]) break;
        const hurt = new Set<Id>();
        if (f.victim) hurt.add(f.victim);
        const b = f.business ? w.biz[f.business] : undefined;
        if (b?.protection) hurt.add(b.protection.collectorId);
        if (f.victim) for (const c of Object.values(w.chars)) if (c.alive && (c.rels[f.victim]?.affection ?? 0) >= 0.5 && c.id !== f.actor) hurt.add(c.id);
        for (const id of hurt) {
          const c = w.chars[id];
          if (!c?.alive) continue;
          const k = c.known[f.id];
          if (k?.knowsActor) continue;
          learn(w, id, f, 'public', true);
        }
        // the hand behind it is known now, and so is the name it earns him (core.DEED)
        { const d = DEED[f.kind]; if (d?.[0] && !f.minor) repute(w, w.chars[f.actor], d[0], 'deed:' + f.kind); }
        break;
      }
      case 'heat': {
        const c = q.a ? w.chars[q.a] : undefined;
        if (c?.alive) {
          c.heat = clamp(c.heat + (q.amount ?? 0.3), 0, 1.5);
          if (c.isPlayer) addFact(w, { kind: 'report', actor: c.id, minor: false, text: `The police have started asking questions about ${w.chars[q.b ?? '']?.name ?? 'a killing'} and the people around it.`, district: c.district }, { witnesses: [c.id] });
        }
        break;
      }
      case 'blackmail': {
        const client = q.a ? w.chars[q.a] : undefined;
        const p = q.b ? w.chars[q.b] : undefined;
        if (!client?.alive || !p?.alive) break;
        const foe = Object.entries(client.rels).filter(([id, r]) => r.grudge >= 0.3 && w.chars[id]?.alive && w.chars[id].familyId !== p.familyId && id !== p.id).sort((a, b) => b[1].grudge - a[1].grudge)[0];
        if (!foe) break;
        const t = w.chars[foe[0]];
        mkJob(w, {
          kind: 'handle', title: `${client.name} calls in what you owe him`, giver: client.id, via: 'contract', assignee: p.id, target: t.id, pay: 0, days: 6,
          brief: `${client.name} hasn’t forgotten what you did for him, and he hasn’t let you forget it either. "One more small favour," he says, "and we’re even." The favour is ${t.name}. It’s not really a request.`,
          reason: 'blackmail', claimTrue: undefined,
        });
        break;
      }
      case 'truth': {
        const accuser = q.a ? w.chars[q.a] : undefined;
        const victim = q.b ? w.chars[q.b] : undefined;
        const killer = q.c ? w.chars[q.c] : undefined;
        if (!accuser?.alive || !victim) break;
        const kin = Object.values(w.chars).filter((c) => c.alive && c.familyId === victim.familyId && (c.rels[victim.id]?.trust ?? 0) >= 0.4);
        for (const m of kin) {
          feel(w, m, accuser.id, 'respect', -0.25);
          bear(w, m, accuser.id, 0.2, `${accuser.name} told lies about ${victim.name}`);
          if (killer && killer.id !== accuser.id) bear(w, m, killer.id, 0.25, `${killer.name} killed ${victim.name} on a lie`);
        }
        addFact(w, { kind: 'exposed', actor: accuser.id, victim: victim.id, text: `It has come out that ${victim.name} was never what ${accuser.name} said he was. People are asking why ${accuser.name} wanted him gone.`, district: victim.district }, { broadcast: Object.values(w.chars).filter((c) => c.alive && c.familyId === victim.familyId).map((c) => c.id) });
        if (killer?.isPlayer) repute(w, killer, -4, 'killed on a lie');
        else if (killer && w.chars[w.playerId!]?.id === killer.bossId) repute(w, w.chars[w.playerId!], -2, 'killed on a lie');
        break;
      }
    }
  }
}

// The family does its own housekeeping. Now and then a powerful man decides someone in his own house has to go,
// whether or not the reason he gives is true.
export function purge(w: World) {
  const rng = w.rng;
  for (const a of Object.values(w.chars)) {
    if (!a.alive || a.isPlayer || !a.familyId || !['capo', 'underboss', 'boss'].includes(a.rank)) continue;
    if (a.traits.violence < 0.65 || a.traits.ambition < 0.6 || !rng.chance(0.012)) continue;
    const rankOrder = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
    const tgt = Object.entries(a.rels)
      .map(([id, r]) => ({ x: w.chars[id], r }))
      .filter(({ x, r }) => x?.alive && !x.isPlayer && x.familyId === a.familyId && x.id !== a.id && r.grudge >= 0.3 && rankOrder.indexOf(x.rank) < rankOrder.indexOf(a.rank) && rankOrder.indexOf(x.rank) >= 1)
      .sort((p, q) => q.r.grudge - p.r.grudge)[0]?.x;
    if (!tgt) continue;
    const subs = Object.values(w.chars).filter((c) => c.alive && c.bossId === a.id && !c.isPlayer && c.id !== tgt.id);
    const killer = subs.length ? rng.pick(subs) : a;
    const kin = Object.values(w.chars).filter((y) => y.alive && y.id !== tgt.id && ((y.familyId === tgt.familyId && (y.rels[tgt.id]?.trust ?? 0) > 0.4) || (y.rels[tgt.id]?.affection ?? 0) > 0.4)).map((y) => y.id);
    const bz = ownerBiz(w, tgt.id);
    void bz;
    handleDeath(w, tgt.id);
    const f = addFact(w, { kind: 'murder', actor: a.id, victim: tgt.id, hiddenActor: true, text: `${a.name} had ${tgt.name} killed.`, textHidden: `${tgt.name} was found dead.`, district: tgt.district }, { broadcast: kin });
    afterKilling(w, killer, tgt, f, { false: rng.chance(0.5), accuser: a.id });
  }
}

// A superior takes up someone's complaint. He has to find the other man, get time with his boss, and decide whether it's worth the favour.
// Nothing here is guaranteed: the go-between may be busy, locked up, dead, unwilling, or told to mind his own business.
function disputeStep(w: World, q: import('./types').Pending) {
  const p = q.a ? w.chars[q.a] : undefined;
  const x = q.b ? w.chars[q.b] : undefined;
  const mid = q.c ? w.chars[q.c] : undefined;
  if (!p || !x || !mid) return;
  const fn = p.name.split(' ')[0];
  const voice = (t: string) => p.isPlayer ? t : t.replace(/leave you alone/g, `leave ${fn} alone`).replace(/leave you be/g, `leave ${fn} be`).replace(/\byour quarrel\b/g, `${fn}’s quarrel`).replace(/tells you,/g, `tells ${fn},`).replace(/tells you\b/g, `tells ${fn}`).replace(/in your hands/g, 'in his hands');
  const say = (text0: string) => { const text = voice(text0); const story = noteDispute(w, p.id, x.id, text); return addFact(w, { kind: 'report', actor: p.id, minor: false, text, story, district: p.district }, { witnesses: p.alive ? [p.id] : [] }); };
  if (!p.alive || !x.alive) return;
  if (!mid.alive) { say(`${mid.name} can’t take up your quarrel with ${x.name} any more. It’s back in your hands.`); return; }
  if (mid.jailedUntil > w.now && (q.tries ?? 0) < 3) {
    (w.pending ??= []).push({ ...q, id: 'p' + w.nextId++, due: mid.jailedUntil + DAY, tries: (q.tries ?? 0) + 1 });
    return;
  }
  const cross = !!x.familyId && x.familyId !== mid.familyId;
  const counter = cross ? (w.chars[w.fam[x.familyId!].bossId] ?? x) : x;
  const tn = cross && mid.familyId ? (w.fam[mid.familyId].tension[x.familyId!] ?? 0) : 0;
  const base = 0.3 + rel(mid, p.id).trust * 0.3 + p.standing / 400 + (q.note === 'true' ? 0.2 : 0) - rel(counter, mid.id).grudge * 0.3 - Math.min(0.25, tn * 0.05) + (rel(counter, mid.id).respect - 0.4) * 0.2;
  const roll = w.rng.next();
  const comp = Math.min(Math.max(0, x.cash), w.rng.int(150, 500));
  if ((q.tries ?? 0) < 1 && roll > base + 0.45) {
    (w.pending ??= []).push({ ...q, id: 'p' + w.nextId++, due: w.now + w.rng.int(2, 5) * DAY, tries: 1 });
    say(`${mid.name} hasn’t managed to get ${cross ? counter.name + ' ' : ''}to sit down yet. He says give it a few days.`);
    return;
  }
  if (roll < base) {
    x.cash -= comp; p.cash += comp;
    settleDispute(w, p.id, x.id, `${mid.name} brokered an end to it${comp ? '; ' + money(comp) + ' paid' : ''}.`, { text: `${x.name} leaves it alone`, by: w.now + 60 * DAY, barred: x.familyId ?? undefined, biz: (w.disputes ?? []).find((d) => d.a === p.id && d.b === x.id)?.biz });
    ease(x, p.id, 0.6 + 0.05);
    ease(p, x.id, 0.3);
    feel(w, mid, x.id, 'respect', -0.03);
    if (cross && mid.familyId) { const A = w.fam[mid.familyId], B = w.fam[x.familyId!]; A.tension[x.familyId!] = Math.max(0, (A.tension[x.familyId!] ?? 0) - 0.5); B.tension[mid.familyId] = Math.max(0, (B.tension[mid.familyId] ?? 0) - 0.5); }
    say(cross
      ? `${mid.name} and ${counter.name} have spoken. ${x.name} is to leave you alone${comp ? ` and make good ${money(comp)}` : ''}. Neither family wants a war over this, and that’s all it took.`
      : `${mid.name} had a word with ${x.name}. He’ll leave you be${comp ? ` and pays ${money(comp)} to put it right` : ''}. He doesn’t like it, but he’s done it.`);
  } else if (roll < base + 0.3) {
    bear(w, x, p.id, 0.05, `${p.name} went over his head`);
    say(`${mid.name} raised it with ${cross ? counter.name : x.name} and got a shrug. "Nothing was agreed," he tells you. Whatever ${x.name} wants, he hasn’t been told to stop wanting it.`);
  } else {
    feel(w, mid, p.id, 'respect', -0.05);
    bear(w, x, p.id, 0.12, `${p.name} went over his head`);
    if (cross && mid.familyId) { w.fam[mid.familyId].tension[x.familyId!] = (w.fam[mid.familyId].tension[x.familyId!] ?? 0) + 0.4; w.fam[x.familyId!].tension[mid.familyId] = (w.fam[x.familyId!].tension[mid.familyId] ?? 0) + 0.4; }
    say(`${mid.name} tried and was brushed off. ${cross ? counter.name + ' told him' : x.name + ' told him'} the matter is closed. ${mid.name} doesn’t like being told that, and nobody on the other side enjoyed being asked.`);
  }
}

// A request for another seat at the table. The boss weighs what the family needs against what it costs him in standing with the men who are already waiting.
function seatDecision(w: World, q: import('./types').Pending) {
  const p = q.a ? w.chars[q.a] : undefined;
  const boss = q.b ? w.chars[q.b] : undefined;
  const rank = (q.note ?? 'soldier') as import('./types').Rank;
  if (!p?.alive || !boss?.alive || !p.familyId) return;
  const fam = w.fam[p.familyId];
  const sponsor = q.c ? w.chars[q.c] : undefined;
  const waiting = Object.values(w.chars).filter((c) => c.alive && c.familyId === fam.id && c.rank === (rank === 'soldier' ? 'associate' : 'soldier') && c.id !== p.id && c.lifetimeKick > 800).length;
  const tens = Object.values(fam.tension).reduce((a, b) => a + b, 0);
  const short = capOf(w, fam.id, rank) - seats(w, fam.id, rank) < 0 ? 1 : 0;
  const score = 0.15 + rel(boss, p.id).trust * 0.35 + Math.min(0.2, p.lifetimeKick / 30000) + (sponsor ? rel(boss, sponsor.id).respect * 0.2 : 0) + Math.min(0.25, tens * 0.04) - Math.min(0.2, waiting * 0.04) - boss.traits.greed * 0.1 + short * 0.1;
  const say = (text: string) => addFact(w, { kind: 'report', actor: p.id, minor: false, text, story: 'seat:' + rank, district: p.district }, { witnesses: [p.id] });
  if (w.rng.chance(clamp(score, 0.05, 0.8)) && openSeatFor(w, fam.id, rank)) {
    say(`${boss.name} has decided the family can use another ${rank}. A seat has been opened. He didn’t say who it’s for.`);
  } else {
    fam.seatNo = { ...(fam.seatNo ?? {}), [rank]: w.now + 40 * DAY };
    say(`${boss.name} turned down the idea of another ${rank}. "The family’s the right size," is what reached you. He won’t hear it again for a while.`);
    feel(w, boss, p.id, 'respect', -0.02);
  }
}
