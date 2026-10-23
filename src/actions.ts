import { menace } from './danger';
import { temper } from './temper';
import { noteGrievance } from './orgs';
import { sanctioned } from './politics';
import { knowing, pass, salience, versionOf } from './rumour';
import { fp } from './voice';
import { askBetween, collectAsk, move as askMove, openAsk, shopInPlay } from './asks';
import { addFact, bearOn, clamp, compat, createDebt, factText, famName, feelOn, handleDeath, knowMore, learn, money, notifyProtector, ownerBiz, payDebt, regard, rel, travelTime, witnessesAt } from './core';
import { afterKilling } from './consequences';
import { Action, Character, DAY, Fact, Id, Kind, World } from './types';
import { say as vsay } from './voicesheet';

import { gossipCap, gossipFresh, tierOf } from './retain';
import { bizMove, changedSince, crewGround, setCollector } from './econ';
const SENSITIVE = new Set(['beating', 'vandalism', 'murder', 'robbery', 'poach']);
const PRIVATE = new Set(['loan', 'debt_missed', 'debt_paid']);

export function describe(w: World, x: Character): string {
  const b = ownerBiz(w, x.id);
  const role = b ? `owner of ${b.name}` : x.rank;
  return `${x.name} (${role}${x.familyId ? ', ' + famName(w, x) : ''}, ${x.district})`;
}
export function grudgeWord(g: number): string {
  return g >= 0.8 ? 'murderous' : g >= 0.55 ? 'bitter' : g >= 0.3 ? 'resentful' : 'wary';
}

// ------------------------------------------------------------------ options
// Used by NPCs (pick the best-scoring) and by the player (menu of the same options).

const aliveCache = new WeakMap<World, { t: number; list: Character[] }>();
function aliveList(w: World): Character[] {
  const c = aliveCache.get(w);
  if (c && c.t === w.now) return c.list;
  const list = Object.values(w.chars).filter((x) => x.alive);
  aliveCache.set(w, { t: w.now, list });
  return list;
}

export function generate(w: World, c: Character, kind: Kind): Action[] {
  const out: Action[] = [];
  const T = c.traits;
  const now = w.now;
  const made = c.rank !== 'civilian';
  const cd = (k: string) => (c.cooldown[k] ?? 0) > now;
  // Every living man but him. aliveList is called here on every generate, as it always was, because its per-minute cache
  // decides who counts as alive for everyone else who acts that minute; only the copy without him waits until a kind needs it.
  const living = aliveList(w);
  let others: Character[] | undefined;
  const alive = () => (others ??= living.filter((x) => x.id !== c.id));
  const crime = c.heat * 0.3;
  const push = (a: Omit<Action, 'actor'>) => out.push({ ...a, actor: c.id });

  switch (kind) {
    case 'work': {
      const own = ownerBiz(w, c.id);
      push({ kind: 'work', hours: 4, label: own ? `Work at ${own.name} (4h)` : 'Work / lay low (4h)', score: (made ? 0.24 : 0.5) + (own ? 0.1 : 0) + c.heat * 0.4 });
      break;
    }
    case 'socialise': {
      for (const x of alive()) {
        if (x.jailedUntil > now) continue;
        const r = c.rels[x.id];
        const near = x.district === c.district;
        if (!r && !near) continue;
        const since = r ? (now - r.lastMet) / DAY : 99;
        const isBoss = x.id === c.bossId;
        const s = 0.1 + T.sociability * 0.35 + (r ? r.affection * 0.1 : 0) + (near ? 0.08 : -0.04) + (isBoss && since > 4 ? 0.3 : 0) - (since < 1 ? 0.35 : 0);
        push({ kind: 'socialise', target: x.id, label: c.isPlayer ? `Spend time with ${describe(w, x)}` : '', score: s });
      }
      break;
    }
    case 'lend': {
      if (!made || c.cash < 700 || c.rank === 'boss') break;
      for (const o of alive()) {
        const b = ownerBiz(w, o.id);
        if (!b || o.rank !== 'civilian' || cd('lend:' + o.id)) continue;
        if (w.debts.some((d) => d.status === 'active' && d.debtor === o.id)) continue;
        const struggling = c.struggling[b.id] !== undefined && now - c.struggling[b.id] < 14 * DAY;
        for (const amt of [500, 1000]) {
          if (c.cash < amt + 300 || (amt === 1000 && !struggling)) continue;
          const s = T.greed * 0.5 + (struggling ? 0.35 : 0) + (b.cash < 250 ? 0.08 : 0) - T.caution * 0.15 + (c.cash > 2500 ? 0.1 : 0) - (amt === 1000 ? 0.05 : 0) - crime;
          push({ kind: 'lend', target: o.id, biz: b.id, amount: amt, label: `Lend ${money(amt)} to ${o.name} (${b.name}, ${b.district})${struggling ? ' - known to be struggling' : ''}`, score: s });
        }
      }
      break;
    }
    case 'collect': {
      for (const d of w.debts) {
        if (d.status !== 'active' || d.creditor !== c.id || d.missed < 1 || cd('collect:' + d.id)) continue;
        const debtor = w.chars[d.debtor];
        if (!debtor.alive || debtor.jailedUntil > now) continue;
        push({ kind: 'collect', target: d.debtor, debt: d.id, label: `Collect from ${debtor.name} (owes ${money(d.balance)}, ${d.missed} missed)`, score: 0.8 + T.violence * 0.15 + d.missed * 0.05 - crime * 0.3 });
      }
      break;
    }
    case 'shakedown': {
      // Stage 4: an approach has a purpose. A man grows his own book in his crew's ground (econ.crewGround); he doesn't go back to
      // a door that closed on him unless something has changed (econ.changedSince), unless he is the kind to press; and another
      // family's shop is taken only for a reason: its man is gone or inside, a grudge against him, or bad blood between the families.
      // A shop of his own family's is never his to lean on (an internal matter, not a daily choice).
      if (!c.familyId || !(c.rank === 'associate' || c.rank === 'soldier')) break;
      const fam = w.fam[c.familyId], ground = crewGround(w, c), tp = temper(c);
      const presses = T.violence > 0.6 && tp.volatility > 0.6;
      for (const b of Object.values(w.biz)) {
        if (!b.open || b.kind === 'casino' || b.protection?.familyId === c.familyId || cd('shake:' + b.id) || shopInPlay(w, b.id)) continue; // a shop somebody is already working on is left to him
        // Word gets round: nobody else leans on a shop for a week after someone has.
        if (b.lastApproach !== undefined && now - b.lastApproach < 7 * DAY) continue;
        const o = w.chars[b.ownerId];
        if (!o || !o.alive) continue;
        const rival = !!b.protection;
        const home = fam.districts.includes(b.district);
        let why = '';
        if (!rival) { if (!ground.has(b.district)) continue; }
        else {
          const x = w.chars[b.protection!.collectorId];
          why = !x?.alive ? 'its man is dead' : x.jailedUntil > now ? 'its man is inside' : (c.rels[x.id]?.grudge ?? 0) >= 0.4 ? `a grudge against ${x.name}` : (fam.tension[b.protection!.familyId] ?? 0) >= 2 ? `bad blood with the ${w.fam[b.protection!.familyId].name}` : '';
          if (!why || !(home || (c.rels[x?.id ?? '']?.grudge ?? 0) >= 0.4)) continue;
        }
        const again = !changedSince(w, b, c);
        if (again && !presses) continue;
        const s = T.greed * 0.45 + T.ambition * 0.3 + (home ? 0.15 : -0.1) - T.caution * (rival ? 0.6 : 0.25) - (rival ? 0.15 : 0) - (again ? 0.15 : 0) + (b.district === c.district ? 0.05 : 0) + b.income / 10000 - crime;
        const who = rival ? ` - pays ${w.chars[b.protection!.collectorId]?.name ?? 'someone'} (${w.fam[b.protection!.familyId].name}); ${why}` : ' - unprotected';
        push({ kind: 'shakedown', target: o.id, biz: b.id, approach: again ? 'hard' : undefined, label: `Lean on ${o.name} at ${b.name} (${b.district})${who}`, score: s });
      }
      break;
    }
    case 'gamble': {
      const broke = c.cash < 120;
      for (const b of Object.values(w.biz)) {
        if (b.kind !== 'casino' || !b.open || b.ownerId === c.id) continue;
        const near = b.district === c.district;
        const s = T.vice * 0.65 - (made ? 0 : 0.1) - (broke ? (T.vice > 0.75 ? 0 : 0.7) : 0) + (near ? 0.08 : -0.08) - crime * 0.5;
        push({ kind: 'gamble', target: b.ownerId, biz: b.id, label: `Gamble at ${b.name} (${b.district})`, score: s });
      }
      break;
    }
    case 'retaliate': {
      if (!made || c.hurtUntil > now) break;
      const tp = temper(c); // V90: a proud man feels a grudge more, a volatile one acts on it, a careful one and a frightened one hold back
      for (const x of alive()) {
        const r = c.rels[x.id];
        if (!r || r.grudge < 0.5 || (x.familyId && x.familyId === c.familyId) || x.jailedUntil > now) continue; // (V89: 0.45 → 0.5, docs/V89_HEALTH.md)
        if (c.isPlayer && !sanctioned(w, c, x)) continue;
        const hi = x.rank === 'boss' || x.rank === 'underboss' ? 0.4 : 0;
        const base = r.grudge * (0.6 + tp.pride * 0.2) + T.violence * 0.2 + tp.volatility * 0.15 - T.caution * 0.25 - tp.caution * 0.2 - (r.fear ?? 0) * 0.4 * (1 - tp.courage) + T.ambition * 0.05 - hi - crime - 0.08;
        const tag = `${grudgeWord(r.grudge)} grudge`;
        // Someone already laid up in bed isn't beaten again; each kind of revenge has its own cooldown.
        if (x.hurtUntil <= now && !cd(`ret:beat:${x.id}`)) push({ kind: 'retaliate', mode: 'beat', target: x.id, label: `Beat up ${x.name} (${tag})`, score: base });
        const b = ownerBiz(w, x.id);
        if (b && !cd(`ret:torch:${x.id}`)) push({ kind: 'retaliate', mode: 'torch', target: x.id, biz: b.id, label: `Torch ${b.name} - ${x.name}'s (${tag})`, score: base - 0.05 });
        // Killing is for made men settling things with made men. Associates need permission they don't have.
        const canHit = r.grudge >= 0.9 && x.rank !== 'civilian' && (c.isPlayer || (T.violence >= 0.7 && c.rank !== 'associate'));
        if (canHit && !cd(`ret:hit:${x.id}`)) push({ kind: 'retaliate', mode: 'hit', target: x.id, label: `Have ${x.name} killed (${tag})`, score: base - 0.15 + T.ambition * 0.15 });
      }
      break;
    }
    case 'wait':
      break;
  }
  return out;
}

export function chooseAction(w: World, c: Character): Action {
  // Restraint: after something violent, a man keeps his head down for a while. Fewer incidents, each one heavier.
  const calm = (c.cooldown.restraint ?? 0) > w.now;
  const kinds: Kind[] = c.hurtUntil > w.now ? ['work'] : calm ? ['work', 'socialise', 'lend', 'collect', 'gamble'] : ['work', 'socialise', 'lend', 'collect', 'shakedown', 'gamble', 'retaliate'];
  const all: Action[] = [];
  for (const k of kinds) all.push(...generate(w, c, k));
  let best = all[0];
  for (const a of all) {
    a.score += w.rng.next() * 0.12;
    if (a.score > best.score) best = a;
  }
  return best;
}

// ------------------------------------------------------------------ effects

export function share(w: World, from: Character, to: Character, lines: string[], opt?: { partial?: boolean; avoidActor?: Id; exclude?: (f: Fact) => boolean; say?: (f: Fact, knows: boolean) => string }): Fact[] {
  const r = rel(from, to.id);
  if (!(r.trust >= 0.25 || from.traits.sociability > 0.65)) return [];
  // What is happening to him comes up before what is happening to other people.
  const fb = Object.values(w.biz).find((b) => b.ownerId === from.id && b.open);
  const own = (f: Fact) => f.victim === from.id || f.actor === from.id || (!!fb && f.business === fb.id);
  const cands = Object.entries(from.known)
    .map(([id, k]) => ({ f: w.facts[id], k }))
    .filter(({ f }) => f && !f.minor && !to.known[f.id] && !(f.actor === from.id && SENSITIVE.has(f.kind)) && (!PRIVATE.has(f.kind) || r.trust > 0.5) && !(opt?.avoidActor && f.actor === opt.avoidActor) && !opt?.exclude?.(f) && (to.isPlayer || (gossipFresh(w, f) && (f.heard ?? 0) < gossipCap(f))))
    // V89: an NPC passes on what matters to the man he is talking to (rumour.ts salience); a stranger's bad night at cards is dropped
    .filter(({ f }) => to.isPlayer || salience(w, to, f) >= 0)
    .sort((a, b) => (to.isPlayer ? Number(own(b.f)) - Number(own(a.f)) : salience(w, to, b.f) - salience(w, to, a.f)) || Number(tierOf(a.f) === 'routine') - Number(tierOf(b.f) === 'routine') || b.f.t - a.f.t)
    .slice(0, to.isPlayer ? 1 : 2); // you are told one thing at a time; the rest comes up if you ask
  const told: Fact[] = [];
  let spoken = 0;
  for (const { f, k } of cands) {
    if (!to.isPlayer) f.heard = (f.heard ?? 0) + 1; // the cap limits how far news travels between NPCs, not what you can be told
    // holding back the name: he tells you something happened, not who; and he tells it his way (rumour.ts)
    const knows = pass(w, from, to, f, opt?.partial ? false : k.knowsActor);
    if (to.isPlayer) {
      // The same event can be on record twice (a night at the club, and the money lost there): you learn both, he tells it once.
      const again = f.amount && told.some((g) => g.actor === f.actor && g.amount === f.amount);
      told.push(f);
      if (again) continue;
      // (Stage 5B: he says how he knows it: seen, from a man who was there, or only what the street says)
      const how = knowing(w, from, f), frame = how === 'seen' ? 'I saw it myself. ' : how === 'told' ? 'I had it from a man who was there. ' : how === 'rumour' ? 'Word is: ' : '';
      lines.push(`${spoken++ ? vsay(w, from, to, 'lead2') : vsay(w, from, to, 'lead')} “${opt?.say ? opt.say(f, knows) : frame + fp(versionOf(w, to, f), from)}”`);
    }
  }
  return told;
}

export function confide(w: World, c: Character, t: Character, lines: string[]) {
  const b = ownerBiz(w, t.id);
  if (!b || !(b.cash < 200 || b.distress > 0)) return;
  if (c.struggling[b.id] !== undefined && w.now - c.struggling[b.id] < 14 * DAY) return;
  if (!w.rng.chance(0.3 + rel(t, c.id).trust * 0.6)) return;
  addFact(w, { kind: 'business_struggling', actor: t.id, business: b.id, text: `${t.name} admits ${b.name} is struggling to cover its costs.`, district: b.district }, { witnesses: [c.id] });
  lines.push(`${t.name} lowers his voice. ${b.name} is bleeding money, and he’s running out of ways to hide it.`);
}

export function tension(w: World, a: Character, b: Character, d: number) {
  if (a.familyId && b.familyId && a.familyId !== b.familyId) {
    w.fam[a.familyId].tension[b.familyId] = (w.fam[a.familyId].tension[b.familyId] ?? 0) + d;
    w.fam[b.familyId].tension[a.familyId] = (w.fam[b.familyId].tension[a.familyId] ?? 0) + d;
    if (d >= 3) noteGrievance(w, a.familyId, b.familyId, `${a.name} and ${b.name} came to blows`, 0.12);
  }
}

export function perform(w: World, a: Action): { minutes: number; lines: string[] } {
  const c = w.chars[a.actor];
  const lines: string[] = [];
  const rng = w.rng;
  const go = (t: Character) => {
    const m = travelTime(c.district, t.district);
    c.district = t.district;
    return m;
  };

  switch (a.kind) {
    case 'wait':
      return { minutes: (a.hours ?? 1) * 60, lines };

    case 'work': {
      const own = ownerBiz(w, c.id);
      c.heat = Math.max(0, c.heat - 0.01 * (a.hours ?? 4));
      if (own) {
        bizMove(w, own, 30, 'revenue');
        lines.push(`You put in the hours at ${own.name}. Honest work, for a change.`);
      } else if (c.familyId) {
        const g = rng.int(15, 70);
        c.cash += g;
        c.weekIncome += g;
        c.books.gross.odd = (c.books.gross.odd ?? 0) + g;
        lines.push(`You run errands around the neighbourhood and pick up ${money(g)}. Small money, and nobody looks twice at you.`);
      } else lines.push('A quiet shift. You keep your head down and your hands clean.');
      return { minutes: (a.hours ?? 4) * 60, lines };
    }

    case 'socialise': {
      const t = w.chars[a.target!];
      if (!t || !t.alive || t.jailedUntil > w.now) {
        lines.push('He isn’t around. Another time.');
        return { minutes: 20, lines };
      }
      const m = go(t) + rng.int(80, 150);
      const r1 = rel(c, t.id);
      const r2 = rel(t, c.id);
      r1.lastMet = r2.lastMet = w.now;
      // Foundation step 3: time together makes two men know each other better (core.knowMore), and whether it warms or chafes is how
      // they get on (core.compat): natural friends grow close, men who can't stand each other grow sore (core.bear, with the reason).
      // Drinking together buys no respect: that is earned by deeds (core.DEED). The same for the player, at the pace the player's
      // regard is earned (core.regard).
      const k = compat(w, c, t);
      knowMore(c, t, 0.06);
      const warm = (a: Character, b: Character, r: typeof r1) => {
        const dt = 0.03 * Math.max(0, k + 0.2), da = 0.06 * k;
        if (b.isPlayer) { regard(w, a, b, 'trust', dt, 'visit'); regard(w, a, b, 'affection', da, 'visit'); }
        else { feelOn(w, r, 'trust', dt, `time spent with ${b.name}`); feelOn(w, r, 'affection', da, `time spent with ${b.name}`); }
        if (k < -0.15) bearOn(w, r, -k * 0.06, `${b.name} rubs him the wrong way`);
      };
      warm(c, t, r1);
      warm(t, c, r2);
      share(w, c, t, lines);
      if (!a.quiet) { share(w, t, c, lines); confide(w, c, t, lines); }
      return { minutes: m, lines };
    }

    case 'lend': {
      const t = w.chars[a.target!];
      const amount = a.amount!;
      const b = a.biz ? w.biz[a.biz] : undefined;
      const m = go(t) + 45;
      c.cooldown['lend:' + t.id] = w.now + 10 * DAY;
      if (c.cash < amount) {
        lines.push('You’re short. You can’t afford it.');
        return { minutes: m, lines };
      }
      // V89: an offer of money is a matter between them (asks.ts 'lend'): he may take it, take less, think about it or say no,
      // and the lender can come back to it
      const s = askBetween(w, 'lend', c.id, t.id) ?? openAsk(w, 'lend', c, t, { amt: amount, biz: b?.id, why: `${c.name} offered ${t.name} a loan` });
      if (!s) { lines.push(`${t.name} has had enough offers this week.`); return { minutes: m, lines }; }
      lines.push(...askMove(w, s, 'ask').lines);
      return { minutes: m, lines };
    }

    case 'collect': {
      const d = w.debts.find((x) => x.id === a.debt);
      if (!d || d.status !== 'active') return { minutes: 10, lines };
      const t = w.chars[d.debtor];
      const m = go(t) + 45;
      c.cooldown['collect:' + d.id] = w.now + 2 * DAY;
      // V89: collecting is a matter between creditor and debtor (matters.ts 'collect'): he can pay, offer what he has, beg for time,
      // refuse, or go to his people; the creditor can come back. The approach is the first move.
      const sit = collectAsk(w, c, d);
      if (!sit) { lines.push(`${t.name} isn’t to be found today.`); return { minutes: m, lines }; }
      const mv = a.approach === 'hard' ? 'force' : a.approach === 'firm' ? 'pressure' : 'ask';
      const o = askMove(w, sit, mv);
      lines.push(...o.lines);
      // a man who offers what he has puts it on the table there and then; the creditor takes it unless he means to hold out
      if (o.answer === 'counter' && !c.isPlayer && c.traits.greed < 0.8) lines.push(...askMove(w, sit, 'take').lines);
      if (mv === 'force') { c.cooldown.restraint = w.now + 18 * DAY; c.heat = clamp(c.heat + 0.07, 0, 1.5); }
      return { minutes: m, lines };
    }

    case 'shakedown': {
      const b = w.biz[a.biz!];
      const o = w.chars[b.ownerId];
      const m = go(o) + 40;
      c.cooldown['shake:' + b.id] = w.now + 14 * DAY;
      b.lastApproach = w.now;
      if (!b.open || !o.alive || b.protection?.familyId === c.familyId) {
        lines.push('There’s nothing to do there.');
        return { minutes: m, lines };
      }
      // V89: an approach is the first move in a matter, not the whole of it (matters.ts). The owner answers from where he stands;
      // a refusal leaves the matter open, to be pursued, dropped, or taken further by the people around him.
      const sit = askBetween(w, 'protect', c.id, o.id, b.id) ?? openAsk(w, 'protect', c, o, { biz: b.id, amt: Math.max(15, Math.round((b.income * 0.08) / 5) * 5), why: `${c.name} wants ${b.name} to pay him` });
      if (!sit) { lines.push(`${o.name} has too many people at his door already. Not today.`); return { minutes: m, lines }; }
      lines.push(...askMove(w, sit, a.approach === 'hard' ? 'pressure' : 'ask').lines);
      return { minutes: m, lines };
    }

    case 'gamble': {
      const b = w.biz[a.biz!];
      const o = w.chars[b.ownerId];
      const m = go(o) + rng.int(120, 240);
      let stake = Math.round(rng.int(40, 400) / 10) * 10;
      if (c.cash > 100) stake = Math.min(stake, Math.max(10, Math.round((c.cash * 0.4) / 10) * 10));
      if (c.cash < stake) {
        const ok = c.traits.vice > 0.6 && o.alive && o.cash >= stake && !w.debts.some((d) => d.debtor === c.id && d.creditor === o.id && (d.status === 'active' || d.status === 'defaulted'));
        if (!ok) {
          lines.push('You can’t cover a stake, and the house won’t extend credit tonight.');
          return { minutes: m, lines };
        }
        o.cash -= stake;
        c.cash += stake;
        const f = addFact(w, { kind: 'loan', actor: o.id, victim: c.id, amount: stake, text: `${b.name} gave ${c.name} a ${money(stake)} marker.`, district: b.district });
        createDebt(w, o.id, c.id, stake, 0.1, 'gambling marker', f.id);
        lines.push(`${o.name} slides you a ${money(stake)} marker. A debt in a stranger’s pocket, signed in your own hand.`);
      }
      if (rng.chance(0.46)) {
        c.cash += stake;
        bizMove(w, b, -stake, 'gamble');
        lines.push(`The cards fall your way. You leave ${b.name} ${money(stake)} ahead and a little too pleased about it.`);
      } else {
        c.cash -= stake;
        bizMove(w, b, stake, 'gamble');
        lines.push(`The cards turn on you. ${money(stake)} gone at ${b.name}, and the house doesn’t even look up.`);
        // (Stage 4: a loss is recorded when it matters: a heavy one, one that leaves him close to broke, or the player's own. An
        // ordinary night's losing moves the money, which is the consequence; it is not a lasting event for the whole city to repeat.)
        const matters = stake >= 500 || c.cash < 100 || c.isPlayer;
        if (stake >= 250 && matters) addFact(w, { kind: 'gambling_loss', actor: c.id, business: b.id, amount: stake, text: `${c.name} dropped ${money(stake)} at ${b.name}${c.cash < 100 ? ', and it was most of what he had' : ''}.`, minor: stake < 350 && c.cash >= 100, district: b.district }, { witnesses: witnessesAt(w, b.district, [c.id], 2) });
      }
      return { minutes: m, lines };
    }

    case 'retaliate': {
      const x = w.chars[a.target!];
      if (!x || !x.alive) return { minutes: 15, lines };
      if (!c.isPlayer && !a.approved) {
        // An NPC decides to hit back. It is an intention first; it may never happen.
        const dueIn = w.rng.int(1, 4) * DAY;
        if (!(w.pending ?? []).some((q) => q.kind === 'intent' && q.a === c.id && q.b === x.id)) {
          (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + dueIn, kind: 'intent', a: c.id, b: x.id, c: a.biz, note: a.mode ?? 'beat' });
        }
        c.cooldown[`ret:${a.mode}:${x.id}`] = w.now + 6 * DAY;
        return { minutes: 20, lines };
      }
      if (x.isPlayer && a.mode === 'hit') {
        menace(w, c, x);
        c.cooldown[`ret:hit:${x.id}`] = w.now + 4 * DAY;
        return { minutes: 30, lines };
      }
      const m = go(x) + rng.int(40, 90);
      c.cooldown[`ret:${a.mode}:${x.id}`] = w.now + { beat: 25, torch: 35, hit: 60 }[a.mode ?? 'beat'] * DAY;
      c.cooldown.restraint = w.now + { beat: 28, torch: 45, hit: 70 }[a.mode ?? 'beat'] * DAY;
      const wit = witnessesAt(w, x.district, [c.id, x.id], 3);
      const cause = c.rels[x.id]?.why?.f; // what he is paying back: the event his grudge is about (core.bear), so the chain is on record
      if (a.mode === 'beat') {
        x.hurtUntil = w.now + 3 * DAY;
        c.heat = clamp(c.heat + 0.15, 0, 1.5);
        addFact(w, { kind: 'beating', actor: c.id, cause, victim: x.id, text: `${c.name} beat up ${x.name}.`, district: x.district }, { witnesses: wit });
        tension(w, c, x, 1);
        lines.push(`You work ${x.name} over until he stops answering back. He knows who did it.`);
      } else if (a.mode === 'torch') {
        const b = ownerBiz(w, x.id);
        if (!b) {
          lines.push('There’s nothing left to burn.');
          return { minutes: m, lines };
        }
        b.damaged = 3;
        bizMove(w, b, -200, 'damage');
        c.heat = clamp(c.heat + 0.1, 0, 1.5);
        const f = addFact(w, { kind: 'vandalism', actor: c.id, cause, victim: x.id, business: b.id, hiddenActor: true, text: `${c.name} torched ${b.name}.`, textHidden: `Someone torched ${b.name}.`, district: b.district }, { witnesses: wit.filter(() => rng.chance(0.4)) });
        notifyProtector(w, b, f);
        tension(w, c, x, 1);
        lines.push(`${b.name} goes up in the night, orange against the sky. Nobody saw you. Probably.`);
      } else {
        if (rng.chance(0.25)) {
          lines.push('At the last moment your nerve goes. You walk away with your hands shaking.');
          return { minutes: m, lines };
        }
        c.heat = clamp(c.heat + 0.6, 0, 1.5);
        const kin = Object.values(w.chars)
          .filter((y) => y.alive && y.id !== x.id && ((x.familyId && y.familyId === x.familyId) || (y.rels[x.id]?.affection ?? 0) > 0.4))
          .map((y) => y.id);
        handleDeath(w, x.id);
        const mf = addFact(w, { kind: 'murder', actor: c.id, cause, victim: x.id, hiddenActor: true, text: `${c.name} had ${x.name} killed.`, textHidden: `${x.name} was found dead.`, district: x.district }, { witnesses: wit.filter(() => rng.chance(0.3)), broadcast: kin });
        afterKilling(w, c, x, mf);
        tension(w, c, x, 3);
        lines.push(`${x.name} is dead. This can't be undone.`);
      }
      return { minutes: m, lines };
    }
  }
}
