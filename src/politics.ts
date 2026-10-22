// What happens above and around you: an informant in the ranks, an underboss who wants the chair,
// the Commission settling what the families cannot, and the rule that a made man cannot be touched on your say-so.
import { tension } from './actions';
import { addFact, bear, clamp, feel, handleDeath, money, rel, repute } from './core';
import { addEnc, addFavour } from './encounters';
import { threatOf } from './danger';
import { discontent, logOrg } from './orgs';
import { Character, DAY, Enc, Id, World } from './types';
import { arch, pick } from './voice';

const PL = (w: World) => w.chars[w.playerId!];
const first = (c: Character) => c.name.split(' ')[0];
const RANKW: Record<string, number> = { associate: 0.6, soldier: 1, capo: 1.4, underboss: 1.6, boss: 0 };

// ------------------------------------------------------------ made men and permission

export const isMade = (c: Character) => ['soldier', 'capo', 'underboss', 'boss'].includes(c.rank);
export function sanctioned(w: World, p: Character, target: Character): boolean {
  if (!isMade(target)) return true;
  if ((p.cooldown[`sanction:${target.id}`] ?? 0) > w.now) return true;
  if (p.familyId && target.familyId && (w.fam[p.familyId].tension[target.familyId] ?? 0) >= 9) return true;
  return false;
}
export function askPermission(w: World, p: Character, target: Character): string[] {
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  if (!boss?.alive) return ['There’s nobody to ask.'];
  const grievance = Object.values(w.facts).some((f) => f.victim === p.id && f.actor === target.id && p.known[f.id]);
  const rank = p.rank === 'associate' ? 0 : 0.1;
  const same = target.familyId === p.familyId;
  const ok = !same && w.rng.chance(clamp(0.2 + rel(boss, p.id).trust * 0.35 + (grievance ? 0.2 : 0) + rank + p.standing / 400, 0.1, 0.8));
  boss && (rel(boss, p.id).lastMet = w.now);
  if (same) return [`${boss.name} looks at you as if you had suggested burning down the church. "He’s one of ours. If he wronged you, there’s a sit-down. That’s the rule."`];
  if (ok) {
    p.cooldown[`sanction:${target.id}`] = w.now + 14 * DAY;
    return [`${boss.name} thinks about it. "${target.name} is a made man. Be sure of what you’re doing. You have two weeks, and I didn’t tell you anything."`];
  }
  feel(w, boss, p.id, 'respect', -0.03);
  return [`${boss.name} shakes his head. "I’m not starting a thing with the ${target.familyId ? w.fam[target.familyId].name : ''} over this. Let it go, or let me handle it my own way."`];
}

// ------------------------------------------------------------ the informant

export function politicsWeek(w: World) {
  const p = PL(w);
  // choose one, once
  if (!Object.values(w.chars).some((c) => c.informant) && w.now > 45 * DAY && w.rng.chance(0.2)) {
    const pool = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && isMade(c) && c.rank !== 'boss' && (c.problem?.kind === 'debt' || c.problem?.kind === 'gambling' || arch(c) === 'frightened' || c.jailedUntil > w.now - 60 * DAY));
    const mine = pool.filter((c) => c.familyId === p?.familyId);
    const pick_ = mine.length && w.rng.chance(0.45) ? w.rng.pick(mine) : pool.length ? w.rng.pick(pool) : undefined;
    if (pick_) pick_.informant = { since: w.now, evidence: 0, agent: pick(['a man in a grey suit', 'a polite man with a briefcase', 'two men who sit too still'], pick_.id) };
  }
  for (const c of Object.values(w.chars)) {
    const inf = c.informant;
    if (!inf || !c.alive || inf.exposed) continue;
    inf.evidence += w.rng.range(0.025, 0.06) * (RANKW[c.rank] ?? 1);
    if (w.rng.chance(0.2)) {
      const wit = Object.values(w.chars).filter((x) => x.alive && x.familyId === c.familyId && x.id !== c.id && x.rank !== 'associate');
      const seer = wit.length ? w.rng.pick(wit) : undefined;
      addFact(w, { kind: 'rumour', actor: c.id, minor: true, hiddenActor: false, text: `${c.name} was seen having coffee with ${inf.agent} who doesn’t look like he’s from the neighbourhood.`, district: c.district }, { witnesses: seer ? [seer.id] : [] });
    }
    if (inf.evidence >= 1) return indict(w, c);
    if (p?.alive && p.familyId === c.familyId && inf.evidence > 0.25 && w.rng.chance(0.22) && !w.enc.some((e) => e.status === 'open' && e.kind === 'suspect')) suspicion(w, p, c);
  }
}

function indict(w: World, inf: Character) {
  // a man who has since left his family has nobody left to give them (V89: informants can now come out of an arrest)
  if (!inf.familyId || !w.fam[inf.familyId]) { inf.informant!.exposed = true; return; }
  const fam = inf.familyId;
  const targets = Object.values(w.chars).filter((c) => c.alive && c.familyId === fam && ['boss', 'underboss', 'capo', 'soldier'].includes(c.rank) && c.id !== inf.id).sort(() => w.rng.next() - 0.5);
  const hit = targets.filter((c) => w.rng.chance(c.rank === 'boss' ? 0.5 : c.rank === 'underboss' ? 0.6 : c.rank === 'capo' ? 0.55 : 0.3)).slice(0, 5);
  for (const c of hit) {
    c.jailedUntil = w.now + w.rng.int(45, 150) * DAY;
    c.heat = clamp(c.heat + 0.4, 0, 1.5);
  }
  inf.informant!.exposed = true;
  inf.jailedUntil = w.now + 900 * DAY;
  const names = hit.map((c) => c.name);
  addFact(w, { kind: 'raid', actor: inf.id, text: `Federal agents arrested ${names.length ? names.join(', ') : 'nobody they could hold'} in the ${w.fam[fam].name} family. ${inf.name} had been talking to them for months, and he’s gone.`, district: inf.district }, { broadcast: Object.values(w.chars).filter((c) => c.alive).map((c) => c.id) });
  const p = PL(w);
  if (p?.alive && p.familyId === fam) {
    p.heat = clamp(p.heat + 0.3, 0, 1.5);
    if (w.rng.chance(0.25 + p.heat * 0.2)) {
      p.jailedUntil = w.now + w.rng.int(14, 45) * DAY;
      addFact(w, { kind: 'arrest', actor: p.id, text: `${p.name} was picked up in the same sweep.`, district: p.district }, { witnesses: [p.id] });
    }
  }
}

function suspicion(w: World, p: Character, c: Character) {
  const guilty = !!c.informant;
  const sus = guilty && w.rng.chance(0.55) ? c : (() => {
    const pool = Object.values(w.chars).filter((x) => x.alive && x.familyId === p.familyId && x.id !== p.id && isMade(x) && x.rank !== 'boss' && !x.informant);
    return pool.length ? w.rng.pick(pool) : c;
  })();
  const teller = Object.values(w.chars).filter((x) => x.alive && x.id !== sus.id && x.id !== p.id && x.familyId === p.familyId && (x.rels[p.id]?.trust ?? 0) > 0.4)[0];
  if (!teller) return;
  addEnc(w, {
    kind: 'suspect', from: teller.id, about: sus.id, title: `Is ${first(sus)} talking?`, days: 6,
    lines: [`${teller.name} checks the room before he says it.`, `"I’m going to say a thing I have no proof of. ${sus.name} has been seen with a man who isn’t one of us. Twice. I don’t know what it is. I know what it could be."`],
    opts: [
      { code: 'watch', label: `Have ${first(sus)} watched`, hint: 'Take a few days. Might find something. Might find a girlfriend.' },
      { code: 'boss', label: 'Take it to the boss', hint: 'Once it’s said, it can’t be unsaid. Bosses don’t wait for proof.' },
      { code: 'confront', label: `Ask ${first(sus)} to his face`, hint: 'A guilty man lies. An innocent one gets angry. You won’t know which.' },
      { code: 'ignore', label: 'Keep it to yourself', hint: 'And hope you’re wrong.' },
    ],
    data: { sus: sus.id },
  });
}

export function suspectChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const sus = w.chars[String(e.data?.sus)];
  if (!sus) return ['It seems to have gone away.'];
  const guilty = !!sus.informant && !sus.informant.exposed;
  const lines: string[] = [];
  if (code === 'ignore') return ['You file it away, and hope you’re not going to regret it.'];
  if (code === 'watch') {
    const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.jailedUntil <= w.now);
    if (!crew.length) return ['You have nobody you can trust with it.'];
    if (guilty && w.rng.chance(0.7)) {
      lines.push(`Three days later ${crew[0].name} comes back with a time, a diner on Flatbush, and a man in a grey suit who paid for the coffee. It’s as bad as it looks.`);
      sus.informant!.evidence = Math.min(sus.informant!.evidence, 0.95);
      e.data = { ...e.data, confirmed: 1 };
      p.known = p.known ?? {};
    } else if (guilty) lines.push(`Three days. ${crew[0].name} sees nothing at all. Either there’s nothing, or he’s careful.`);
    else {
      lines.push(`Three days later ${crew[0].name} reports: ${sus.name} spent every evening at a woman's apartment in Queens. That was the man in the doorway. It’s not nothing, but it’s not that.`);
    }
    return lines;
  }
  if (code === 'boss') {
    const boss = p.bossId ? w.chars[p.bossId] : undefined;
    const top = w.chars[w.fam[p.familyId!].bossId];
    const who = top?.alive ? top : boss;
    if (!who?.alive) return ['Nobody to tell.'];
    const confirmed = e.data?.confirmed === 1;
    if (guilty) {
      sus.alive && handleDeath(w, sus.id);
      sus.informant!.exposed = true;
      addFact(w, { kind: 'murder', actor: who.id, victim: sus.id, hiddenActor: true, text: `${who.name} had ${sus.name} killed.`, textHidden: `${sus.name} was found in the trunk of a car.`, district: sus.district }, {});
      repute(w, p, (confirmed ? 6 : 4), 'gave up an informant');
      feel(w, who, p.id, 'respect', 0.1);
      addFavour(w, who.id, p.id, 3, `giving him ${sus.name} before it was too late`);
      lines.push(`${who.name} listens, and says nothing for a long time. Four days later ${sus.name} is gone, and so is whatever he was going to tell them. Nobody thanks you out loud. ${who.name} will remember it.`);
    } else if (confirmed || w.rng.chance(0.3)) {
      handleDeath(w, sus.id);
      repute(w, p, -4, 'false accusation');
      lines.push(`${who.name} doesn’t wait for proof. ${sus.name} is dead within the week. It turns out he was seeing a woman in Queens. You’ll think about that for a long time.`);
      addFact(w, { kind: 'murder', actor: who.id, victim: sus.id, hiddenActor: true, text: `${who.name} had ${sus.name} killed on a bad rumour.`, textHidden: `${sus.name} was found dead.`, district: sus.district }, {});
    } else {
      feel(w, who, p.id, 'respect', -0.04);
      lines.push(`${who.name} listens. "I’ll keep an eye." That’s all you get. He looks at ${first(sus)} differently for a while.`);
    }
    return lines;
  }
  // confront
  if (guilty) {
    if (arch(sus) === 'frightened' || w.rng.chance(0.3)) {
      lines.push(`${sus.name} goes grey. "They have my brother," he says, and then he can’t stop. You have what you need. What you do with it’s the question.`);
      e.data = { ...e.data, confirmed: 1 };
    } else lines.push(`${sus.name} laughs, offended, and swears on his mother. It’s a very good performance.`);
  } else {
    feel(w, sus, p.id, 'trust', -0.25);
    bear(w, sus, p.id, 0.2, `${p.name} accused him of talking`);
    lines.push(`${sus.name} goes red, then white. "You think I'm a rat?" He doesn’t hit you. He walks out. That was an innocent man's anger, and now he’s an enemy.`);
  }
  return lines;
}

// ------------------------------------------------------------ the plot

export function politicsCoup(w: World) {
  const p = PL(w);
  if (w.coup) {
    const c = w.coup;
    if (w.now >= c.resolveAt) resolveCoup(w);
    return;
  }
  for (const fam of Object.values(w.fam)) {
    const boss = w.chars[fam.bossId];
    const u = Object.values(w.chars).find((c) => c.alive && c.familyId === fam.id && c.rank === 'underboss');
    if (!boss?.alive || !u) continue;
    const weak = boss.jailedUntil > w.now ? 0.07 : 0;
    // Foundation step 3: an underboss moves against his boss when he has reason to, not because he is ambitious and thinks little of
    // him: his grievances, his want of trust, ambition with nowhere to go and an unsettled house (orgs.discontent, what defection
    // reads), as well as how little he thinks of the man. A man the boss has just raised, with nothing against him, does not plot.
    if (u.traits.ambition < 0.65 || rel(u, boss.id).respect > 0.55 || discontent(w, u, boss, fam.unrest && fam.unrest.until > w.now ? fam.unrest.level : 0) < 0.55) continue;
    if (!w.rng.chance((0.012 + weak) * (1 + (fam.unrest && fam.unrest.until > w.now ? fam.unrest.level * 2 : 0)))) continue;
    w.coup = { fam: fam.id, plotter: u.id, boss: boss.id, start: w.now, resolveAt: w.now + w.rng.int(28, 56) * DAY, back: { plotter: [], boss: [] } };
    addFact(w, { kind: 'rumour', actor: u.id, victim: boss.id, minor: true, text: `People are saying ${u.name} isn’t happy with how ${boss.name} runs things.`, district: u.district }, { broadcast: Object.values(w.chars).filter((c) => c.alive && c.familyId === fam.id && c.rank !== 'associate').map((c) => c.id) });
    if (p?.alive && p.familyId === fam.id && p.rank !== 'associate') {
      addEnc(w, {
        kind: 'side', from: u.id, about: boss.id, title: `${first(u)} wants to know where you stand`, days: 10,
        lines: [`${u.name} doesn’t come to your door. He sends someone to ask you to a quiet place.`, `"${boss.name} has been running this family into the ground. Things are going to change. I would like to know whether you’ll be standing with the people who change them."`],
        opts: [
          { code: 'plotter', label: `Stand with ${first(u)}`, hint: 'If he wins, you’re made for life. If he loses, you’re finished.' },
          { code: 'boss', label: `Go straight to ${first(boss)}`, hint: 'You warn him. He won’t forget you did it. Neither will his enemies.' },
          { code: 'stay', label: 'Say nothing, and stay out of it', hint: 'Nobody’s grateful for neutrality, but nobody’s angry either.' },
        ],
        data: { fam: fam.id },
      });
    }
    return;
  }
}

export function sideChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const c = w.coup;
  if (!c) return ['It has already been settled without you.'];
  const u = w.chars[c.plotter];
  const b = w.chars[c.boss];
  if (code === 'plotter') {
    c.back.plotter.push(p.id);
    feel(w, u, p.id, 'trust', 0.2);
    return [`You nod. ${u.name} clasps your hand. "I won’t forget who was there." You have just made yourself a hostage to his luck.`];
  }
  if (code === 'boss') {
    c.back.boss.push(p.id);
    feel(w, b, p.id, 'trust', 0.25);
    bear(w, u, p.id, 0.2, `${p.name} stood with the boss against him`);
    c.resolveAt = Math.min(c.resolveAt, w.now + 10 * DAY);
    return [`${b.name} listens without moving, and then he says: "You did right." The look on his face isn’t gratitude. It’s calculation. Within a fortnight this will be settled one way or the other.`];
  }
  return [`You say nothing, and the silence is read the way silence always is. Nobody trusts you quite as much afterwards.`];
}

function resolveCoup(w: World) {
  const c = w.coup!;
  delete w.coup;
  const fam = w.fam[c.fam];
  const u = w.chars[c.plotter];
  const b = w.chars[c.boss];
  const p = PL(w);
  if (!u?.alive || !b?.alive) return;
  const members = Object.values(w.chars).filter((x) => x.alive && x.familyId === fam.id && ['capo', 'soldier'].includes(x.rank) && !x.isPlayer);
  const side = (x: Character) => (rel(x, u.id).trust + x.traits.ambition * 0.3 - rel(x, b.id).trust - x.traits.caution * 0.1 > 0 ? 'u' : 'b');
  let su = 1 + c.back.plotter.length * 1.2;
  let sb = 1.4 + c.back.boss.length * 1.2;
  for (const x of members) (side(x) === 'u' ? (su += x.rank === 'capo' ? 1.4 : 0.7) : (sb += x.rank === 'capo' ? 1.4 : 0.7));
  if (b.jailedUntil > w.now) sb *= 0.6;
  const uWins = w.rng.chance(clamp(su / (su + sb), 0.1, 0.9));
  const everyone = Object.values(w.chars).filter((x) => x.alive && x.familyId === fam.id).map((x) => x.id);
  if (uWins) {
    handleDeath(w, b.id, { cause: 'coup', favoured: u.id });
    addFact(w, { kind: 'murder', actor: u.id, victim: b.id, hiddenActor: true, text: `${u.name} had ${b.name} killed and took the chair.`, textHidden: `${b.name} was shot outside his club. The family is ${u.name}'s now.`, district: b.district }, { broadcast: everyone });
    if (p?.alive && p.familyId === fam.id) {
      if (c.back.plotter.includes(p.id)) {
        repute(w, p, 6, 'coup');
        p.backer = u.id;
        addFavour(w, u.id, p.id, 3, `standing with him when it counted`);
      } else if (c.back.boss.includes(p.id)) {
        threatOf(w, u).level = 1;
        bear(w, u, p.id, 0.5, `${p.name} stood with the boss against him`);
        repute(w, p, -6, 'coup');
      }
    }
  } else {
    handleDeath(w, u.id);
    logOrg(w, fam.id, 'coup', `${u.name} moved against ${b.name} and lost. ${b.name} stays.`, b.id);
    fam.standing = clamp((fam.standing ?? 50) + 2, 5, 95);
    addFact(w, { kind: 'murder', actor: b.id, victim: u.id, hiddenActor: true, text: `${b.name} had ${u.name} killed. He had known about the plot for weeks.`, textHidden: `${u.name} was found dead in his car. People aren’t asking why.`, district: u.district }, { broadcast: everyone });
    for (const x of c.back.plotter.map((id) => w.chars[id]).filter(Boolean)) {
      if (x.isPlayer) {
        threatOf(w, b).level = 1;
        bear(w, b, x.id, 0.6, `${x.name} plotted against him`);
        repute(w, x, -12, 'coup');
      }
    }
    if (p?.alive && p.familyId === fam.id && c.back.boss.includes(p.id)) {
      repute(w, p, 5, 'coup');
      p.backer = b.id;
      addFavour(w, b.id, p.id, 3, `warning him before it was too late`);
    }
  }
}

// ------------------------------------------------------------ the Commission

export function commissionTick(w: World) {
  if (w.now - (w.commissionAt ?? 0) < 28 * DAY) return;
  w.commissionAt = w.now;
  const pairs: [number, string, string][] = [];
  const ids = Object.keys(w.fam);
  for (const a of ids) for (const b of ids) if (a < b) pairs.push([(w.fam[a].tension[b] ?? 0) + (w.fam[b].tension[a] ?? 0), a, b]);
  pairs.sort((x, y) => y[0] - x[0]);
  const [heat, a, b] = pairs[0];
  if (heat < 6) return;
  const fa = w.fam[a];
  const fb = w.fam[b];
  const everyone = Object.values(w.chars).filter((c) => c.alive && (c.familyId === a || c.familyId === b) && c.rank !== 'associate').map((c) => c.id);
  const roll = w.rng.next();
  if (roll < 0.55) {
    fa.tension[b] = (fa.tension[b] ?? 0) * 0.4;
    fb.tension[a] = (fb.tension[a] ?? 0) * 0.4;
    addFact(w, { kind: 'ruling', text: `The Commission sat down over the ${fa.name} and the ${fb.name}. It ruled that the shooting stops and whoever started it pays. Nobody was happy, and nobody was in a position to argue.`, district: fa.districts[0] }, { broadcast: everyone });
  } else if (roll < 0.8) {
    fa.tension[b] = (fa.tension[b] ?? 0) * 0.7;
    fb.tension[a] = (fb.tension[a] ?? 0) * 0.7;
    addFact(w, { kind: 'ruling', text: `The Commission ruled between the ${fa.name} and the ${fb.name} and split a disputed neighbourhood down the middle. Both sides say they were robbed.`, district: fa.districts[0] }, { broadcast: everyone });
  } else {
    fa.tension[b] = (fa.tension[b] ?? 0) + 2;
    fb.tension[a] = (fb.tension[a] ?? 0) + 2;
    addFact(w, { kind: 'ruling', text: `The Commission couldn’t agree on the ${fa.name} and the ${fb.name}, and walked out without a ruling. That’s the kind of silence that comes before something.`, district: fa.districts[0] }, { broadcast: everyone });
  }
}

export function politicsChoose(w: World, p: Character, e: Enc, code: string): string[] {
  if (e.kind === 'suspect') return suspectChoose(w, p, e, code);
  if (e.kind === 'side') return sideChoose(w, p, e, code);
  return [];
}
void (null as unknown as Id);
