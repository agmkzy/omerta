// Orders: giving your men work yourself, and what they do with it.
// A man you send out is not a function call. He may do it well, do it and skim, lose half of it at cards,
// find the debtor was not home, get distracted by something at home, start a fight, or decide the debtor
// deserves more time. When he comes back he tells you a story, and the story may not be the true one.
import { chopOf, deliverCars, deliverGoods, fenceOf } from './enterprise';
import { knowsProtection } from './acquaint';
import { temper } from './temper';
import { applyRank } from './rank';
import { addFact, bear, clamp, feel, feelOn, feelTo, learn, money, ownerBiz, recordCareer, rel, repute, shortTime, transfer, travelTime, witnessesAt } from './core';
import { aptitude, grow, lateOf, PROBLEM_LABEL } from './people';
import { bizMove, clearArrears, owedOf, takeFromBiz } from './econ';
import { arch, admit, excuse, pick } from './voice';
import { approaches, mkJob, resolve } from './jobs';
import { giveWork, needsOf, noteWork, type Need } from './work';
import { perform } from './actions';
import { Behaviour, Character, DAY, Id, Job, JobKind, Report, World } from './types';

const PL = (w: World) => w.chars[w.playerId!];
const MONEY_KINDS: JobKind[] = ['collect', 'lean', 'scam', 'burgle', 'boost', 'handle', 'shake'];

// ------------------------------------------------------------- behaviour

// (judged against the man who sent him: the player, or an NPC superior; work.ts)
const senderOf = (w: World, j?: Job) => (j?.giver && w.chars[j.giver]) || PL(w);
export function reliability(w: World, m: Character, by: Character = PL(w)): number {
  const r = m.rels[by.id];
  return clamp(0.5 + (r?.trust ?? 0.4) * 0.3 + (1 - m.traits.vice) * 0.15 + m.traits.caution * 0.1 - (m.problem ? m.problem.sev * 0.35 : 0), 0.15, 0.95);
}

export function behaviour(w: World, j: Job, m: Character): Behaviour {
  const T = m.traits;
  const p = senderOf(w, j);
  const trust = m.rels[p.id]?.trust ?? 0.4, sore = m.rels[p.id]?.grudge ?? 0; // (a man who holds something against the man who sent him works for him less well, and helps himself more)
  const pr = m.problem;
  const money = MONEY_KINDS.includes(j.kind);
  const apt = aptitude(m, j.kind);
  const weights: [Behaviour, number][] = [
    ['clean', 1.4 * reliability(w, m, p) * (1 - sore * 0.5)],
    ['bungle', (1 - apt) * 0.3],
    ['skim', money ? (T.greed * 0.4 + sore * 0.4 + (pr && ['house', 'gambling', 'debt'].includes(pr.kind) ? 0.5 * pr.sev : 0)) * (1 - trust * 0.5) : 0],
    ['gamble', money ? T.vice * 0.35 + (pr?.kind === 'gambling' ? 0.7 * pr.sev : 0) : 0],
    ['unavailable', 0.07],
    ['distracted', pr ? pr.sev * 0.7 : 0.02],
    ['confront', ['collect', 'lean', 'handle', 'shake'].includes(j.kind) ? (T.violence * 0.5 + temper(m).volatility * 0.5) * 0.3 * (j.orders === 'quiet' ? 0.5 : 1.2) : 0],
    ['mercy', j.kind === 'collect' || j.kind === 'shake' ? temper(m).empathy * 0.18 * (j.target && (m.rels[j.target]?.affection ?? 0) > 0.2 ? 1.5 : 0.7) : 0],
  ];
  const total = weights.reduce((a, [, v]) => a + v, 0);
  let r = w.rng.next() * total;
  for (const [k, v] of weights) {
    r -= v;
    if (r <= 0) return k;
  }
  return 'clean';
}

// What a man says happened, in his own voice. Honest men are plain. Men with something to hide are smooth.
function story(w: World, j: Job, m: Character, b: Behaviour, lie: boolean, amt = 0): string {
  const t = j.target ? w.chars[j.target] : undefined;
  const who = t?.name ?? 'the man';
  const a = arch(m);
  const seed = m.id + j.id;
  switch (b) {
    case 'unavailable':
      return pick([`${who} wasn’t there. I tried twice. His wife said he was out, and I believed her.`, `Nobody home, nobody around. I asked down the street and nobody had seen him. I’ll go again.`], seed);
    case 'bungle':
      return pick([`It went wrong. I won’t dress it up. I walked in too early and I walked out with nothing.`, `I made a mess of it. There was a man there I didn’t expect. It won’t happen again.`], seed);
    case 'distracted':
      return lie ? excuse(a, m.problem?.kind ?? 'family', seed) : admit(a, m.problem?.kind ?? 'family', seed);
    case 'confront':
      return pick([`He got mouthy. So things got a bit heated. He’ll remember it, I can promise you that.`, `I had to make a point. It was necessary. You said no half-measures.`], seed);
    case 'mercy':
      return pick([`He’s good for it. He asked for until Friday. I gave it to him. A man who’s given a day pays double.`, `I didn’t have the heart. He has kids, and I could see the money wasn’t there. I told him you would hear about it from me.`], seed);
    case 'skim':
      return lie ? `Short week for him. This is what there was: ${money$(amt)}.` : `I kept some for myself. I know I shouldn’t have.`;
    case 'gamble':
      return lie ? `Unlucky. He paid, but then I got robbed on the way back. Can you believe it? ${money$(amt)} is what I have left.` : `I had it all. Then I went to a game, thinking I would double it. I didn’t.`;
    default:
      return `It’s done.`;
  }
}
const money$ = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export function runCrewJob(w: World, j: Job) {
  const m = w.chars[j.assignee];
  const p = senderOf(w, j); // the man he answers to on this job
  if (!m || !m.alive) {
    j.status = 'failed';
    return;
  }
  if (m.jailedUntil > w.now) {
    j.due = m.jailedUntil + DAY;
    return;
  }
  if (m.hurtUntil > w.now) {
    j.due = m.hurtUntil + DAY;
    return;
  }
  const b = behaviour(w, j, m);
  let codes = approaches(w, j).map((a) => a.code);
  // He does it his way: a quick temper goes hard, a careful man goes quiet, whatever you said.
  let code = j.orders === 'hard' ? codes[codes.length - 1] : codes[0];
  if (codes.length > 1 && !m.isPlayer) {
    if (temper(m).volatility > 0.72 && w.rng.chance(0.4)) code = codes[codes.length - 1];
    else if (temper(m).caution > 0.7 && w.rng.chance(0.3)) code = codes[0];
    else if (j.orders !== 'hard' && j.orders !== 'quiet') code = codes[Math.min(codes.length - 1, Math.floor(aptitude(m, j.kind) * codes.length))];
  }
  let text = '';
  let rep: Report | undefined;
  let extra = '';
  const finish = (ok: boolean) => {
    j.status = ok ? 'done' : 'failed';
    noteWork(w, j, ok);
  };
  const failWith = (kind: Behaviour, lie: boolean) => {
    finish(false);
    rep = { text: story(w, j, m, kind, lie), truth: kind, lie, by: m.id };
    text = `${m.name} couldn’t get it done on "${j.title}".`;
  };

  if (b === 'unavailable') failWith('unavailable', false);
  else if (b === 'bungle') {
    failWith('bungle', false);
    m.heat = clamp(m.heat + 0.05, 0, 1.5);
    grow(m, j.kind, 0.012);
  } else if (b === 'distracted') {
    const liar = !!m.problem && w.rng.chance(0.65);
    failWith('distracted', liar);
  } else if (b === 'mercy') {
    finish(false);
    rep = { text: story(w, j, m, 'mercy', false), truth: 'mercy', lie: false, by: m.id };
    text = `${m.name} let the matter slide on "${j.title}".`;
    const t = j.target ? w.chars[j.target] : undefined;
    if (t) feel(w, t, m.id, 'affection', 0.1);
  } else {
    const res = resolve(w, j, b === 'confront' ? codes[codes.length - 1] : code);
    let amt = res.money ?? 0;
    // the man takes his cut; the player's cut is what he reports
    if (!m.isPlayer && amt > 0 && b !== 'clean') {
      const mine = Math.round(amt * (b === 'skim' ? 0.45 : 0.6));
      const take = Math.min(p.cash, Math.round(mine * 0.7));
      p.cash -= take;
      m.cash += take;
      if (b === 'gamble') m.cash = Math.max(0, m.cash - Math.round(take * 0.8));
      rep = { text: story(w, j, m, b, true, amt - take), truth: b, lie: true, amt: take, by: m.id };
    }
    if (b === 'confront' && j.target) {
      const t = w.chars[j.target];
      if (t?.alive && t.hurtUntil <= w.now && !t.familyId) {
        const r = perform(w, { kind: 'retaliate', mode: 'beat', actor: m.id, target: t.id, label: '', score: 0 });
        extra += ' ' + r.lines.join(' ');
      }
      rep = { text: story(w, j, m, 'confront', false), truth: 'confront', lie: false, by: m.id };
    }
    if (!rep && res.ok) rep = { text: story(w, j, m, 'clean', false), truth: 'clean', lie: false, by: m.id };
    if (!rep) rep = { text: pick([`It didn’t go our way. I’ll try again.`, `They were ready for me. I took what I could and left.`], m.id + j.id), truth: 'clean', lie: false, by: m.id };
    grow(m, j.kind, res.ok ? 0.025 : 0.01);
    if (!m.isPlayer) {
      const split = (amt: number) => {
        const mine = Math.round(amt * 0.3);
        m.cash += mine;
        p.cash += amt - mine;
      };
      if (m.cars > 0) {
        const v = chopOf(w, p);
        if (v) {
          deliverCars(w, v, m.cars, m);
          extra += ` ${m.cars} cars went to the chop shop.`;
        } else {
          split(m.cars * 550);
          extra += ` Fenced ${m.cars} cars for ${money(m.cars * 550)}.`;
        }
        m.cars = 0;
      }
      if (m.goods > 0) {
        const f = fenceOf(w, p);
        if (f) { deliverGoods(w, f, m.goods, m); extra += ` The goods went to your fence.`; }
        else { const g = Math.round(m.goods * 0.4); split(g); extra += ` Pawned the goods for ${money(g)}.`; }
        m.goods = 0;
      }
    }
    text = `${m.name} ${res.ok ? 'got it done' : 'couldn’t get it done'} on "${j.title}"${res.money ? ` and brought in ${money(res.money)}` : ''}.${res.note ? ' ' + res.note : ''}`;
  }
  j.rep = rep;
  addFact(w, { kind: 'report', actor: m.id, text: text + extra, minor: true, district: m.district }, { witnesses: [p.id] });
  // a man who lied and was not caught gets bolder; one who was honest earns trust
  if (rep && !rep.lie) feel(w, m, p.id, 'trust', 0.01);
}

// Question a man about his report. The more he trusts you, the more of the truth he lets slip.
export function questionReport(w: World, j: Job): string[] {
  const p = PL(w);
  const m = w.chars[j.rep?.by ?? j.assignee];
  const rep = j.rep;
  if (!m || !rep) return ['There’s nothing to ask.'];
  if (rep.found) return [`${m.name} has told you everything he’s going to.`];
  const r = rel(m, p.id);
  const pr = clamp(0.2 + r.trust * 0.3 + r.respect * 0.2 + p.traits.caution * 0.1 + (rep.lie ? 0 : 0.2), 0.1, 0.9);
  if (!rep.lie) {
    rep.found = true;
    return [`You press ${m.name} on it. He tells it the same way twice, in the same words, and doesn’t mind being asked.`];
  }
  if (w.rng.chance(pr)) {
    rep.found = true;
    feelOn(w, r, 'trust', -0.03);
    const a = arch(m);
    const lines: string[] = [];
    if (rep.truth === 'distracted' && m.problem) {
      lines.push(`${m.name}: "${admit(a, m.problem.kind, m.id + j.id)}"`);
      m.problem.revealed = true;
    } else if (rep.truth === 'skim' || rep.truth === 'gamble') {
      lines.push(`${m.name} stares at the floor. "${rep.truth === 'skim' ? 'I took more than I should have.' : 'I lost it. Some of yours with it.'} I’ll make it right."`);
      if (rep.amt) lines.push(`That’s about ${money(rep.amt)} you won’t see.`);
    } else lines.push(`${m.name} gives it up in the end, and it’s not the story he first told.`);
    return lines;
  }
  return [`${m.name} holds to what he said, and does it well. You walk away unsure whether you were lied to.`];
}

// ----------------------------------------------------------- errands

export interface ErrandResult {
  lines: string[];
  minutes: number;
  ok: boolean;
  money?: number;
}

export function resolveErrand(w: World, j: Job, doer: Character, code: string): ErrandResult | undefined {
  const rng = w.rng;
  const t = j.target ? w.chars[j.target] : undefined;
  const apt = aptitude(doer, j.kind);
  const lines: string[] = [];
  const caught = (base: number) => rng.chance(clamp(base - (apt - 0.5) * 0.4, 0.05, 0.8));
  switch (j.kind) {
    case 'watch': {
      if (!t?.alive) return { lines: ['There’s nobody to watch.'], minutes: 30, ok: false };
      const minutes = travelTime(doer.district, t.district) + 240;
      doer.district = t.district;
      if (caught(0.3 + t.traits.caution * 0.3)) {
        bear(w, t, doer.id, 0.15, `${doer.name} came after him`);
        t.cooldown.suspects = w.now + 14 * DAY;
        lines.push(`${t.name} noticed the tail within an hour and stared straight at you. He knows someone wants to know what he does.`);
        return { lines, minutes, ok: false };
      }
      // What a day of watching turns up.
      const found: string[] = [];
      const contacts = Object.entries(t.rels).filter(([id, r]) => r.trust > 0.35 && w.chars[id]?.alive && w.chars[id].familyId !== t.familyId && w.chars[id].familyId).map(([id]) => w.chars[id]);
      if (contacts.length) found.push(`he spent an hour with ${contacts[0].name} of the ${w.fam[contacts[0].familyId!].name} family`);
      if (t.problem && t.problem.sev > 0.25) found.push(`he’s ${PROBLEM_LABEL[t.problem.kind]}`);
      const b = ownerBiz(w, t.id);
      if (b) found.push(`${b.name} did about ${money(Math.round(b.income / 6))} in a day`);
      if (!found.length) found.push('he had a dull day and went home to sleep');
      lines.push(`${doer.name} watched ${t.name} from morning to night. ${found.map((s) => s[0].toUpperCase() + s.slice(1)).join('. ')}.`);
      if (t.problem) t.problem.revealed = true;
      // anything he knows that was hidden from you, you now know too
      const to = senderOf(w, j).id === doer.id ? PL(w) : senderOf(w, j);
      const f = Object.values(w.facts).filter((q) => q.actor === t.id && !q.minor && t.known[q.id] && !to.known[q.id]).sort((a, b) => b.t - a.t)[0];
      if (f) learn(w, to.id, f, doer.id, true);
      return { lines, minutes, ok: true };
    }
    case 'deliver': {
      const minutes = 150;
      // a little taken off the top of a made man's envelopes: money in the pocket, and a chance he counts
      if (code === 'skim' && doer.isPlayer) {
        const g = j.giver ? w.chars[j.giver] : undefined, take = g ? transfer(w, g, doer, Math.max(10, Math.round((j.pay || 30) * 1.2)), 'earn', 'off the top of his envelopes') : 0;
        if (g && rng.chance(clamp(0.3 + temper(g).caution * 0.35, 0.2, 0.75))) {
          feel(w, g, doer.id, 'trust', -0.18); bear(w, g, doer.id, 0.25, `${doer.name} was into his envelopes`);
          repute(w, doer, -3, 'caught');
          addFact(w, { kind: 'discipline', actor: g.id, victim: doer.id, amount: take, text: `${g.name} counted his envelopes and found ${doer.name} had been into them.`, district: doer.district }, { witnesses: [g.id, doer.id] });
          lines.push(`You take ${money(take)} from the envelopes and deliver the rest. ${g.name.split(' ')[0]} counts. He always counts. You will hear about this.`);
          return { lines, minutes, ok: false };
        }
        lines.push(`You take ${money(take)} from the envelopes and deliver the rest. Nobody says anything. Not yet.`);
        return { lines, minutes, ok: true, money: j.pay };
      }
      if (caught(0.14)) {
        doer.heat = clamp(doer.heat + 0.1, 0, 1.5);
        lines.push(`A patrolman stops the car and goes through the glovebox. The envelope is in the lining of the seat. It stays there.`);
        return { lines, minutes, ok: true, money: j.pay };
      }
      lines.push(`Delivered. The man on the other end counted it twice and nodded.`);
      if (t) feel(w, t, doer.id, 'trust', 0.05);
      return { lines, minutes, ok: true, money: j.pay };
    }
    case 'message': {
      if (!t?.alive) return { lines: ['He’s gone.'], minutes: 30, ok: false };
      const minutes = travelTime(doer.district, t.district) + 90;
      doer.district = t.district;
      // said so he remembers it: he backs off, or he takes it as an insult to his family, as the man he is
      if (code === 'hard' && doer.isPlayer) {
        const g = j.giver ? w.chars[j.giver] : undefined, tp = temper(t), backs = rng.chance(clamp(0.55 - tp.pride * 0.35 - tp.courage * 0.25 + (apt - 0.5) * 0.3, 0.1, 0.85));
        addFact(w, { kind: 'threat', actor: doer.id, victim: t.id, minor: false, text: `${doer.name} warned ${t.name} off ${g ? g.name + '’s' : 'the family’s'} ground, and made sure he’d remember it.`, district: t.district }, { witnesses: [doer.id, t.id] });
        if (backs) { feel(w, t, doer.id, 'fear', 0.15); lines.push(`${t.name} goes a shade paler than he’d like. "All right. I heard you." He means it, for now.`); if (g) feel(w, g, doer.id, 'respect', 0.04); return { lines, minutes, ok: true, money: j.pay }; }
        bear(w, t, doer.id, 0.25, `${doer.name} threatened him on behalf of ${g?.name ?? 'his people'}`);
        if (t.familyId && doer.familyId && t.familyId !== doer.familyId) { const A = w.fam[doer.familyId], B = w.fam[t.familyId]; A.tension[t.familyId] = (A.tension[t.familyId] ?? 0) + 0.5; B.tension[doer.familyId] = (B.tension[doer.familyId] ?? 0) + 0.5; }
        lines.push(`${t.name} hears you out, then laughs in your face. "Tell ${g ? g.name.split(' ')[0] : 'him'} to come himself next time." It’s gone further than it was. People will hear.`);
        return { lines, minutes, ok: false };
      }
      const reply = pick([`${t.name} listens, says nothing for a while, then: "Tell him I heard."`, `${t.name} smiles. "He always did know how to ask."`, `${t.name} reads you more than the message. "And what do you think of it?"`], t.id + j.id);
      lines.push(reply);
      feel(w, t, doer.id, 'trust', (caught(0.2) ? -0.03 : 0.05));
      return { lines, minutes, ok: true, money: j.pay };
    }
    case 'guard': {
      const b = j.biz ? w.biz[j.biz] : undefined;
      if (!b) return { lines: ['There’s nothing to guard.'], minutes: 30, ok: false };
      b.damaged = 0;
      b.guardedUntil = w.now + 7 * DAY;
      lines.push(`${doer.name} spends the week where people can see him. Nobody tries anything at ${b.name}.`);
      return { lines, minutes: 360, ok: true, money: j.pay };
    }
    case 'find': {
      if (!t?.alive) return { lines: ['He’s beyond finding.'], minutes: 30, ok: false };
      const minutes = travelTime(doer.district, t.district) + 150;
      lines.push(caught(0.35) ? `${t.name} hasn’t been seen in days, and nobody will say why. You get a cold look and a closed door.` : `${t.name} was last seen in ${t.district}, ${t.jailedUntil > w.now ? 'and he’s locked up' : t.hurtUntil > w.now ? 'laid up and out of sight' : 'going about his business'}.`);
      return { lines, minutes, ok: true };
    }
    case 'shake': {
      const b = j.biz ? w.biz[j.biz] : undefined;
      if (!b?.protection) return { lines: ['Nothing is owed there any more.'], minutes: 30, ok: false };
      const o = w.chars[b.ownerId];
      const owed = Math.max(b.protection.fee, owedOf(b));
      const style = code === 'soft' ? 0.8 : code === 'firm' ? 1 : 1.35;
      const pr = clamp(0.5 + (apt - 0.5) * 0.4 + (code === 'hard' ? 0.2 : code === 'soft' ? -0.1 : 0) - (temper(o).courage - 0.5) * 0.3, 0.15, 0.95);
      if (rng.chance(pr)) {
        const got = takeFromBiz(w, b, Math.round(owed * style), doer.id, true);
        clearArrears(b);
        lines.push(code === 'soft' ? `${o.name} makes his excuses and hands it over, with an apology.` : code === 'firm' ? `${o.name} pays up, and doesn’t look you in the eye.` : `${o.name} pays, and you leave the door open on purpose so the street can see.`);
        if (code === 'hard') {
          bear(w, o, doer.id, 0.15, `${doer.name} leaned on him hard`);
          doer.heat = clamp(doer.heat + 0.08, 0, 1.5);
        }
        return { lines, minutes: 90, ok: true, money: got };
      }
      bear(w, o, doer.id, 0.1, `${doer.name} came for the money`);
      lines.push(`${o.name} can’t or won’t pay. Business has been bad, he says, and you can see the shelves are half empty.`);
      return { lines, minutes: 90, ok: false };
    }
    case 'fix': {
      if (!t?.alive) return { lines: ['Nobody to help.'], minutes: 30, ok: false };
      const cost = j.pay;
      const pr = clamp(0.55 + (apt - 0.5) * 0.5, 0.2, 0.9);
      if (doer.cash < cost && !doer.isPlayer) return { lines: [`${doer.name} can’t cover the ${money(cost)}.`], minutes: 30, ok: false };
      if (rng.chance(pr)) {
        t.jailedUntil = Math.min(t.jailedUntil, w.now + 2 * DAY);
        lines.push(`A lawyer, a clerk and an envelope. ${t.name} walks out in two days instead of weeks.`);
        feel(w, t, doer.id, 'trust', 0.2);
        feel(w, t, doer.id, 'affection', 0.1);
        return { lines, minutes: 180, ok: true };
      }
      lines.push(`The clerk takes the envelope and nothing happens. ${t.name} stays where he is.`);
      return { lines, minutes: 180, ok: false };
    }
  }
  return undefined;
}

export const ERRAND_KINDS: JobKind[] = ['watch', 'deliver', 'message', 'guard', 'find', 'shake', 'fix'];

// ------------------------------------------------------------- the menu

export interface OrderOpt {
  group: 'Money' | 'Cars' | 'Burglary' | 'Scams' | 'Watch' | 'Other';
  label: string;
  hint?: string;
  need: Need;
}

// What the player can send his men to do: what his own affairs need (work.needsOf, the same list an NPC superior hands out from:
// money owed, late shops, his crew's ground, a man inside, a shop in trouble), and work of his own choosing.
export function orderMenu(w: World, p: Character): OrderOpt[] {
  const out: OrderOpt[] = [];
  const near = (a: { district: string }, b: { district: string }) => Number(b.district === p.district) - Number(a.district === p.district);
  const GROUP: Partial<Record<JobKind, OrderOpt['group']>> = { collect: 'Money', shake: 'Money', lean: 'Money', handle: 'Money', watch: 'Watch' };
  for (const n of needsOf(w, p)) out.push({ group: GROUP[n.kind] ?? 'Other', label: n.title, hint: n.why, need: n });
  out.push({ group: 'Cars', label: 'Boost cars', hint: 'Steal cars to sell or chop.', need: { kind: 'boost', title: 'Boost some cars', brief: 'Steal cars.', pay: 0, why: '', weight: 0 } });
  for (const b of Object.values(w.biz).filter((x) => x.open && x.kind !== 'casino' && x.protection?.familyId !== p.familyId && w.chars[x.ownerId]?.alive).sort(near).slice(0, 3))
    // (what he knows of who looks after it is part of the choice: acquaint.knowsProtection; a place across the city may be anybody's)
    out.push({ group: 'Burglary', label: `Burgle ${b.name}`, hint: `${b.district}. ${!knowsProtection(w, p, b) ? 'You don’t know who looks after it, if anyone.' : b.protection ? `It pays the ${w.fam[b.protection.familyId].name} family. They’ll take it personally.` : 'Nobody looks after it.'}`, need: { kind: 'burgle', title: `Burgle ${b.name}`, brief: `Take what’s in ${b.name}.`, biz: b.id, pay: 0, why: '', weight: 0 } });
  for (const b of Object.values(w.biz).filter((x) => x.open && x.kind !== 'casino' && x.ownerId !== p.id && w.chars[x.ownerId]?.alive).sort(near).slice(0, 4)) {
    const o = w.chars[b.ownerId];
    out.push({ group: 'Scams', label: `Work ${o.name} at ${b.name}`, hint: o.traits.caution > 0.65 ? 'Looks careful with his money.' : 'Looks trusting.', need: { kind: 'scam', title: `Work ${o.name}`, brief: `Find out how much ${o.name} will give up.`, biz: b.id, target: o.id, pay: 0, why: '', weight: 0 } });
  }
  // people worth watching
  const watch = Object.values(w.chars).filter((x) => x.alive && x.id !== p.id && x.rank !== 'civilian' && (p.rels[x.id]?.grudge ?? 0) > 0.2 || (x.familyId && x.familyId !== p.familyId && x.rank === 'soldier')).filter((x) => !out.some((o) => o.need.kind === 'watch' && o.need.target === x.id)).slice(0, 4);
  for (const t of watch) out.push({ group: 'Watch', label: `Watch ${t.name}`, hint: `${t.rank}, ${t.familyId ? w.fam[t.familyId].name : 'independent'}. A day of following him around.`, need: { kind: 'watch', title: `Watch ${t.name}`, brief: 'Find out what he does and who he sees.', target: t.id, pay: 0, why: '', weight: 0 } });
  return out;
}

// Or he does it himself: the same piece of work, in his own hands.
export function ownJob(w: World, p: Character, o: OrderOpt): Job {
  const n = o.need;
  return mkJob(w, { kind: n.kind, title: n.title, brief: n.brief, target: n.target, biz: n.biz, debt: n.debt, cause: n.cause, pay: n.pay, giver: null, via: 'order', assignee: p.id, status: 'active', days: 3 });
}

// Give the order and send him: the one way any superior gives a man work (work.giveWork).
export function giveOrder(w: World, p: Character, m: Character, o: OrderOpt, style: 'quiet' | 'hard'): Job | string {
  return giveWork(w, p, m, o.need, style);
}

// -------------------------------------------------------- recruiting

export interface Prospect {
  c: Character;
  note: string;
  vouch: boolean; // he needs your name behind him
}
export function prospects(w: World, p: Character): Prospect[] {
  return Object.values(w.chars)
    .filter((c) => c.alive && c.prospect && c.rank === 'civilian' && !ownerBiz(w, c.id))
    .map((c) => ({ c, note: c.traits.violence > 0.5 ? 'rough' : c.traits.sociability > 0.65 ? 'smooth' : c.traits.caution > 0.6 ? 'careful' : 'keen', vouch: c.traits.ambition > 0.8 }))
    .sort((a, b) => Number(b.c.district === p.district) - Number(a.c.district === p.district))
    .slice(0, 6);
}
export const RECRUIT_COST = 150;
export function recruitProspect(w: World, p: Character, c: Character): string[] {
  if (p.cash < RECRUIT_COST) return [`You need ${money(RECRUIT_COST)} to bring a man on properly.`];
  if (p.rank === 'civilian') return ['You’re nobody yet.'];
  p.cash -= RECRUIT_COST;
  recordCareer(w, c, `Taken on by ${p.name}`);
  c.prospect = false;
  // (The Family: a made man takes a man on as an associate of the family, on its record through him; an associate can't put anyone on
  // the family's record: his men are crewmen, civilians who work for him, and they give him his piece all the same)
  if (['soldier', 'capo', 'underboss', 'boss'].includes(p.rank)) applyRank(w, c, 'associate', { fact: false, career: false, place: (x) => { x.familyId = p.familyId; x.bossId = p.id; } });
  else { c.bossId = p.id; c.kickRate = Math.max(c.kickRate, 0.2); }
  c.cash += 150;
  (c.rels[p.id] ??= { trust: 0.4, respect: 0.35, affection: 0.3, grudge: 0, lastMet: w.now });
  feelTo(c, p.id, 'trust', 0.45);
  addFact(w, { kind: 'promotion', actor: c.id, minor: true, text: `${c.name} has started running with ${p.name}.`, district: c.district }, { witnesses: [p.id] });
  repute(w, p, 0.5, 'took a man on');
  return [`${c.name} shakes your hand. He’s yours now, and what he does will be put against your name.`];
}

// ------------------------------------------------------------ day jobs

export interface DayJobOpt {
  kind: 'bartender' | 'driver' | 'doorman' | 'runner' | 'porter';
  label: string;
  hint: string;
  biz?: Id;
  boss: Id;
}
export function dayJobOptions(w: World, p: Character): DayJobOpt[] {
  const out: DayJobOpt[] = [];
  if (!p.familyId) return out;
  const fam = w.fam[p.familyId];
  for (const b of Object.values(w.biz).filter((x) => x.open && x.protection?.familyId === p.familyId && ['casino', 'bar'].includes(x.kind)).slice(0, 2)) {
    const o = w.chars[b.protection!.collectorId];
    if (!o?.alive) continue;
    out.push({ kind: 'bartender', label: `Tend bar at ${b.name}`, hint: `${o.name}'s place. Good for hearing things. $90 a shift.`, biz: b.id, boss: o.id });
    if (b.kind === 'casino') out.push({ kind: 'doorman', label: `Work the door at ${b.name}`, hint: `${o.name} notices who’s dependable. $100 a shift.`, biz: b.id, boss: o.id });
  }
  const capos = Object.values(w.chars).filter((x) => x.alive && x.familyId === fam.id && ['capo', 'underboss'].includes(x.rank) && (x.rels[p.id]?.trust ?? 0) >= 0.3);
  for (const c of capos.slice(0, 2)) out.push({ kind: 'driver', label: `Drive for ${c.name}`, hint: 'You hear everything and say nothing. $120 a shift.', boss: c.id });
  const b0 = Object.values(w.chars).find((x) => x.id === fam.bossId);
  if (b0?.alive && (b0.rels[p.id]?.trust ?? 0) >= 0.45) out.push({ kind: 'driver', label: `Drive for ${b0.name}`, hint: 'The boss himself. Nobody gets closer. $150 a shift.', boss: b0.id });
  return out;
}
export function takeDayJob(w: World, p: Character, o: DayJobOpt) {
  p.job = { kind: o.kind, biz: o.biz, boss: o.boss, since: w.now, noticed: 0, shifts: 0 };
}
// A man who has not worked a shift in a week is let go, and told why (the job is a commitment, not a tap to turn on when he likes)
export function dayJobWeek(w: World, p: Character) {
  const j = p.job;
  if (!j) return;
  const since = Math.floor(w.now / DAY) - (j.last ?? Math.floor(j.since / DAY));
  if (since < 8) return;
  const boss = w.chars[j.boss];
  delete p.job;
  if (boss?.alive) { const r = (boss.rels[p.id] ??= { trust: 0.3, respect: 0.3, affection: 0.3, grudge: 0, lastMet: w.now }); feelOn(w, r, 'trust', -0.04); }
  addFact(w, { kind: 'report', actor: boss?.id, victim: p.id, minor: false, text: `${boss?.name ?? 'Your employer'} has let you go: you haven’t been in for a week. “Don’t bother coming back.”`, district: p.district }, { witnesses: [p.id] });
}
export const quitDayJob = (p: Character) => {
  delete p.job;
};
const PAY = { bartender: 90, doorman: 100, driver: 120, runner: 70, porter: 75 };
export function workShift(w: World, p: Character): { minutes: number; lines: string[] } {
  const j = p.job;
  if (!j) return { minutes: 0, lines: ['You have no job to go to.'] };
  const boss = w.chars[j.boss];
  const lines: string[] = [];
  if (!boss?.alive) {
    delete p.job;
    return { minutes: 0, lines: ['The man you worked for is gone. So is the job.'] };
  }
  // A place that has shut can't employ anyone.
  const place = j.biz ? w.biz[j.biz] : undefined;
  if (place && !place.open) {
    delete p.job;
    return { minutes: 0, lines: [`${place.name} has closed its doors. There’s no work there any more.`] };
  }
  // (a job is a job: one shift a day, five days a week. A man who stops turning up is told not to bother.)
  const day = Math.floor(w.now / DAY), wk = Math.floor(day / 7);
  if (j.last === day) return { minutes: 0, lines: [`You’ve done your shift today. ${boss.name.split(' ')[0]} expects you tomorrow, not twice today.`] };
  if (j.wk?.n === wk && j.wk.k >= 5) return { minutes: 0, lines: ['That’s your five shifts this week. The place doesn’t need you again until the week turns.'] };
  let pay = PAY[j.kind] + (j.kind === 'driver' && boss.rank === 'boss' ? 30 : 0);
  // Union scale comes out of the employer's own till, so a bad week at the place is a short week for you.
  if (j.kind === 'porter' && place) {
    const can = Math.max(0, Math.min(pay, place.cash));
    if (can > 0) bizMove(w, place, -can, 'expense', p.id);
    if (can < pay) lines.push(can > 0 ? `${boss.name} is short this week. He pays you ${money(can)} and swears the rest is coming.` : `${boss.name} opens an empty till and shrugs. Nothing for you this week.`);
    pay = can;
  }
  p.cash += pay;
  p.books.gross.odd = (p.books.gross.odd ?? 0) + pay;
  p.weekIncome += pay;
  j.shifts++;
  j.last = day; j.wk = j.wk?.n === wk ? { n: wk, k: j.wk.k + 1 } : { n: wk, k: 1 };
  const r = (boss.rels[p.id] ??= { trust: 0.3, respect: 0.3, affection: 0.3, grudge: 0, lastMet: w.now });
  const good = w.rng.chance(0.55 + p.traits.caution * 0.2);
  j.noticed = clamp(j.noticed + (good ? 0.07 : 0.02));
  feelOn(w, r, 'trust', (good ? 0.02 : 0));
  feelOn(w, r, 'respect', (good ? 0.015 : 0));
  r.lastMet = w.now;
  if (j.biz) p.district = w.biz[j.biz].district;
  else p.district = boss.district;
  lines.push(j.kind === 'porter' ? `Four hours on the loading floor at ${place?.name ?? 'the market'} before the city wakes up.${pay ? ` You earn ${money(pay)}.` : ''}` : `A long shift ${j.kind === 'driver' ? `driving ${boss.name}` : `for ${boss.name}`}. You earn ${money(pay)}.`);
  // what you pick up
  if (w.rng.chance(0.45)) {
    const f = Object.values(w.facts)
      .filter((q) => !q.minor && boss.known[q.id] && !p.known[q.id] && w.now - q.t < 40 * DAY)
      .sort((a, b) => b.t - a.t)[0];
    if (f) {
      learn(w, p.id, f, boss.id, boss.known[f.id].knowsActor);
      lines.push(j.kind === 'porter' ? `Over the crates, ${boss.name} talks. You hear: "${f.text}"` : j.kind === 'driver' ? `In the back seat they forget you’re there. You hear: "${f.text}"` : `Between orders you catch it: "${f.text}"`);
    } else lines.push('Nothing worth hearing tonight.');
  }
  if (j.noticed >= 0.6 && !p.backer && ['soldier', 'capo', 'underboss', 'boss'].includes(boss.rank) && (j.shifts % 4 === 0)) {
    p.backer = boss.id;
    lines.push(`${boss.name} pulls you aside. "I’ve been watching you work. If anyone asks, I have a good word for you."`);
    repute(w, p, 3, 'good work');
  }
  return { minutes: j.kind === 'porter' ? 240 : 360, lines };
}
