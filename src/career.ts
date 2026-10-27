import { chooseCaptain, madeFromLine, nextToMake, recordAppt, underbossPicture, underbossStanding } from './succession';
import { promotedOver } from './situ';
import { ledgerAdd } from './powers2';
// Career: associate -> soldier -> capo -> underboss -> boss. Nobody is promoted because a number ticked over.
// Someone with standing has to speak for you, there has to be a vacancy, and the man at the top has to agree.
import { addFact, bear, clamp, famName, feel, feelOn, money, peek, recordCareer, rel, repute } from './core';
import { influence } from './books';
import { mkJob } from './jobs';
import { addEnc } from './encounters';
import { arch, pick } from './voice';
import type { Enc } from './types';
import { Character, DAY, Id, Rank, World } from './types';

export { LADDER, WAGE } from './rank';
import { LADDER, WAGE, applyRank, repairHierarchy } from './rank';
const next = (r: Rank): Rank | undefined => LADDER[LADDER.indexOf(r) + 1];

// A man who works for an associate is a runner, not a rival: he isn't in the line for a seat and can't be made ahead of his own boss.
export const isRunner = (w: World, c: Character) => c.rank === 'associate' && !!c.bossId && w.chars[c.bossId]?.rank === 'associate';
export const members = (w: World, fid: Id) => Object.values(w.chars).filter((c) => c.alive && c.familyId === fid);
export const seats = (w: World, fid: Id, r: Rank) => members(w, fid).filter((c) => c.rank === r).length;
// Foundation step 2 (Oct 2026): how many seats a family can carry at each rank comes from its shape, not a fixed number. A captain
// needs men under him (one to about every five soldiers and associates, the shape the families start with), a captain carries about three soldiers, and there is one
// underboss. On top of the structure, the one seat the boss may choose to open for a strong record (capBonus, see openSeatFor). A family that grows can carry more officers; one that has run short of men below cannot
// keep making them.
export function capOf(w: World, fid: Id, r: Rank): number {
  const ms = members(w, fid), n = (x: Rank) => ms.filter((c) => c.rank === x).length;
  const extra = w.fam[fid]?.capBonus?.[r] ?? 0;
  if (r === 'capo') return Math.max(2, Math.round((n('soldier') + n('associate')) / 5)) + extra;
  if (r === 'soldier') return Math.max(4, 3 * n('capo')) + extra;
  if (r === 'underboss') return 1;
  return 0;
}
// the boss opens a seat beyond what the structure carries, for a record that has earned it; never more than one above it
export const SEAT_EXTRA = 1;
export function openSeatFor(w: World, fid: Id, r: Rank): boolean {
  const f = w.fam[fid];
  if (!f || (f.capBonus?.[r] ?? 0) >= SEAT_EXTRA) return false;
  f.capBonus = { ...(f.capBonus ?? {}), [r]: (f.capBonus?.[r] ?? 0) + 1 };
  return true;
}
export const vacancy = (w: World, fid: Id, r: Rank) => r === 'boss' ? false : seats(w, fid, r) < capOf(w, fid, r);

export interface Readiness {
  to: Rank;
  score: number; // 0..1
  earn: number; // 0..1
  sponsor?: Character;
  openSeat: boolean;
  parts: string[];
  blockers: string[];
  ready?: boolean; // set for the player: path.ts has the final say
}

// Who could vouch for c: his own superior, if that man is at least a soldier and thinks well of him.
export function sponsorOf(w: World, c: Character): Character | undefined {
  const s = c.backer && w.chars[c.backer]?.alive ? w.chars[c.backer] : c.bossId ? w.chars[c.bossId] : undefined;
  if (!s?.alive || LADDER.indexOf(s.rank) < 1) return undefined;
  return rel(s, c.id).trust >= 0.35 ? s : undefined;
}

// The one place that answers "is he ready to move up?", for every man: the road in path.ts (what he has passed up, the work he has
// done, the backing of the right men, his name, proof of himself), so every screen, every conversation and the family's own
// decision about an NPC read the same state. A seat is the family's: open, or opened for a record that has earned one (noticeTick).
export function readiness(w: World, c: Character): Readiness | undefined {
  const info = pathInfo(w, c);
  if (!info || !c.familyId) return undefined;
  const goals = info.goals.filter((g) => g.key !== 'trial');
  const earn = info.goals.find((g) => g.key === 'earn')?.frac ?? 1;
  const score = goals.length ? goals.reduce((a, g) => a + g.frac, 0) / goals.length : 1;
  const you = (s: string) => (c.isPlayer ? s : s.replace(/\byou(r)?\b/g, (_m, r) => (r ? 'his' : 'he')));
  const blockers = info.goals.filter((g) => !g.done && (g.key !== 'trial' || !c.isPlayer)).map((g) => you(`${g.label.toLowerCase()} (${g.note})`));
  if (c.jailedUntil > w.now) blockers.push(c.isPlayer ? 'you’re locked up' : 'he’s locked up');
  // (the player is set his proof in person once the rest is done; another man's is part of his road)
  const ready = c.isPlayer ? info.ready : info.ready && info.trial === 'passed';
  return { to: info.to, score, earn, sponsor: sponsorOf(w, c), openSeat: info.to === 'boss' ? false : vacancy(w, c.familyId, info.to), parts: [], blockers, ready };
}

export function eligibleIgnoringSeat(w: World, c: Character): boolean {
  return !!readiness(w, c)?.ready;
}
export const eligible = (r?: Readiness) => !!r && !!r.ready && r.openSeat;

// The chair beside the boss goes to a captain whose road is done: into an empty chair, or in place of the man in it if the boss
// rates him well above that man (and the man moved aside holds it against him). The same rule for the player (path.ts).
const rateBy = (boss: Character, c: Character) => peek(boss, c.id).trust + peek(boss, c.id).respect * 0.5 + c.standing / 100;
export function canSeatUnderboss(w: World, boss: Character, c: Character): boolean {
  const u = members(w, c.familyId!).find((x) => x.rank === 'underboss' && x.id !== c.id);
  return !u || !u.alive || rateBy(boss, c) > rateBy(boss, u) + 0.3;
}

export function promote(w: World, c: Character, to: Rank, by?: Character) {
  const fid = c.familyId!;
  const boss = w.chars[w.fam[fid].bossId];
  const was = c.rank;
  const fact = { text: `${c.name} was made ${to === 'soldier' ? 'a soldier' : 'a ' + to} in the ${famName(w, c)} family${by ? `, vouched for by ${by.name}` : ''}.`, broadcast: members(w, fid).map((x) => x.id) };
  if (!applyRank(w, c, to, { by, fact })) return; // already holds that rank: a promotion is never applied twice
  promotedOver(w, c, was);
  c.sponsor = by?.id ?? c.bossId ?? undefined;
  if (c.isPlayer && by && by.id !== c.id) ledgerAdd(w, 'sponsor', by.id, `${by.name} sponsored you to ${to}.`);
  delete c.backer;
  if (to === 'capo') {
    c.bossId = (members(w, fid).find((x) => x.rank === 'underboss') ?? boss)?.id ?? null;
    // a new captain takes his own people with him
  } else if (to === 'underboss') {
    c.bossId = boss?.id ?? null;
    for (const x of members(w, fid)) if (x.rank === 'capo' && x.id !== c.id) x.bossId = c.id;
    {
      // the crew he ran passes to another captain; he runs captains now (anyone's crew, not only the player's)
      const heir = members(w, fid).filter((x) => x.rank === 'capo' && x.id !== c.id).sort((a, b) => b.lifetimeKick - a.lifetimeKick)[0];
      const mine = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.rank !== 'capo' && x.rank !== 'civilian');
      if (heir && mine.length) {
        for (const x of mine) x.bossId = heir.id;
        addFact(w, { kind: 'promotion', actor: c.id, minor: true, text: `${c.name}’s old crew now answers to ${heir.name}.`, district: c.district }, { broadcast: [c.id, heir.id, ...mine.map((x) => x.id)] });
      }
    }
  }
  if (c.isPlayer && was === 'associate') {
    // the men who ran for an associate become associates of the family once he is made
    const crew = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && x.rank === 'associate');
    for (const x of crew) { x.familyId = fid; x.wage = Math.max(x.wage ?? 0, 100); feel(w, x, c.id, 'respect', 0.1); }
    if (crew.length) addFact(w, { kind: 'promotion', actor: c.id, text: `${crew.map((x) => x.name).join(', ')} ${crew.length > 1 ? 'are' : 'is'} now recognised as ${crew.length > 1 ? 'associates' : 'an associate'} of the ${famName(w, c)} family, under ${c.name}.`, district: c.district }, { broadcast: [c.id, ...crew.map((x) => x.id)] });
  }
  if (c.isPlayer) {
    const gift = to === 'soldier' ? 1000 : to === 'capo' ? 2500 : to === 'underboss' ? 6000 : 0;
    if (gift) {
      c.cash += gift;
      recordCareer(w, c, `The family’s gift on being made ${to}: ${money(gift)}`);
    }
    if (to === 'capo') {
      // a new captain is handed a crew: the best unattached associates in the family
      const pool = members(w, fid).filter((x) => x.rank === 'associate' && !x.isPlayer && !isRunner(w, x) && !x.prospect && (!x.bossId || w.chars[x.bossId]?.rank === 'soldier')).sort((a, b) => b.lifetimeKick - a.lifetimeKick).slice(0, 3);
      for (const x of pool) { x.bossId = c.id; feel(w, x, c.id, 'trust', 0.1); }
      if (pool.length) addFact(w, { kind: 'promotion', actor: c.id, minor: true, text: `${pool.map((x) => x.name).join(', ')} now answer to ${c.name}.`, district: c.district }, { broadcast: pool.map((x) => x.id) });
      // You don't get a blank crew. One of them is glad of you, and one isn't.
      if (pool.length >= 2) {
        const [glad, sour] = [pool[0], pool[pool.length - 1]];
        feel(w, glad, c.id, 'trust', 0.15);
        feel(w, sour, c.id, 'trust', -0.12);
        bear(w, sour, c.id, 0.15, `${c.name} was put over him`);
        sour.problem = { kind: 'resentment', sev: 0.6, since: w.now };
        addFact(w, { kind: 'rumour', actor: sour.id, minor: true, text: `${sour.name} didn’t take it well that ${c.name} was put over him. ${glad.name} was pleased.`, district: c.district }, { witnesses: [c.id] });
      }
    }
  }
  const rivals = members(w, fid).filter((x) => x.id !== c.id && x.rank === was && !x.isPlayer && x.traits.ambition >= 0.6 && x.lifetimeKick >= (ROAD[to]?.kick ?? 1e9) * 0.7);
  for (const x of rivals) bear(w, x, c.id, 0.1, `${c.name} was made ahead of him`);
  repairHierarchy(w, fid);
}

// Weekly: the families decide who moves up.
export function careerTick(w: World) {
  for (const fam of Object.values(w.fam)) {
    const boss = w.chars[fam.bossId];
    if (!boss?.alive) continue;
    if ((fam.lastPromo ?? 0) > w.now - 10 * DAY) continue;
    // Foundation step 2: an empty underboss's chair is filled. The boss names the captain he trusts and rates most, free to serve
    // (the others' resentment of being passed over is promote's, as for any step up). The player rises by his own road (path.ts).
    // The chair beside the boss: a captain whose road is done, the one the boss rates most. While the chair is empty and nobody's road
    // is done, the family still needs a second: after a season he names the captain he rates most (an empty seat the structure needs
    // filling, not a reward for waiting).
    if (!boss.isPlayer) {
      const caps = members(w, fam.id).filter((c) => c.rank === 'capo' && !c.isPlayer && c.jailedUntil <= w.now).sort((a, b) => rateBy(boss, b) - rateBy(boss, a) || (a.id < b.id ? -1 : 1));
      // (The Family: the boss's own picture of his second; he fills an empty chair after a while, and replaces a sitting underboss only
      // when he thinks much better of another man)
      const empty = vacancy(w, fam.id, 'underboss');
      if (empty) fam.ubSince ??= w.now; else delete fam.ubSince;
      const pic = underbossPicture(w, fam.id);
      const pref = pic.preferred && pic.preferred.id !== pic.current?.id && fam.consigliere !== pic.preferred.id ? pic.preferred : undefined;
      const ready = pref && !empty && pic.current && underbossStanding(w, pref) > underbossStanding(w, pic.current) + 0.25 ? pref : undefined;
      const pick = ready ?? (empty && pref && w.now - (fam.ubSince ?? w.now) > 6 * 7 * DAY ? pref : undefined);
      void caps;
      if (pick && w.rng.chance(0.5)) {
        const u = members(w, fam.id).find((x) => x.rank === 'underboss');
        if (u && u.id !== pick.id) { bear(w, u, pick.id, 0.25, `${pick.name} was given the seat above him`); applyRank(w, u, 'capo', { wage: 300, place: (x) => { x.bossId = boss.id; }, fact: { actor: boss.id, victim: u.id, story: 'seat:underboss', text: `${boss.name} has moved ${u.name} aside. He is a captain again.`, broadcast: members(w, fam.id).map((y) => y.id) } }); }
        promote(w, pick, 'underboss', boss); fam.lastPromo = w.now; delete fam.ubSince;
        recordAppt(w, fam.id, { office: 'Underboss', who: pick.id, by: boss.id, why: u ? `${boss.name} thought more of him than of ${u.name}` : 'the chair beside the boss had stood empty', passed: pic.others.map((x) => x.id), backers: [] });
        continue;
      }
    }
    for (const to of ['capo', 'soldier'] as Rank[]) {
      if (to === 'soldier' && fam.booksClosed) continue;
      if (w.path?.hold === to && w.chars[w.playerId!]?.familyId === fam.id) continue; // the seat is spoken for
      const from = LADDER[LADDER.indexOf(to) - 1];
      // (The Family: a man is made only when the books are open, and then from the family's line, in order; a captain is the boss's
      // choice among the contenders, weighed for the men he would command; succession.ts)
      if (to === 'soldier') {
        const next = nextToMake(w, fam).map((id) => w.chars[id]).filter((c) => c && !c.isPlayer && c.jailedUntil <= w.now);
        const c = next[0];
        if (!c) continue;
        if (c.career?.proved !== 'soldier') { npcTrial(w, c, 'soldier', sponsorOf(w, c) ?? boss); continue; }
        promote(w, c, 'soldier', sponsorOf(w, c) ?? boss); madeFromLine(w, fam, c, sponsorOf(w, c) ?? boss); fam.lastPromo = w.now;
        break;
      }
      if (!vacancy(w, fam.id, to)) { noticeTick(w, fam, boss, to, from); continue; }
      if (to === 'capo') {
        if (w.path?.hold === 'capo' && w.chars[w.playerId!]?.familyId === fam.id) continue;
        const ch = chooseCaptain(w, fam.id, []);
        if (!ch || ch.c.isPlayer) continue;
        if (w.rng.chance(0.5)) { promote(w, ch.c, 'capo', boss); fam.lastPromo = w.now; recordAppt(w, fam.id, { office: 'Captain', who: ch.c.id, by: boss.id, why: 'the family needed another crew, and he was the man for it', passed: ch.passed.map((x) => x.id), backers: [] }); }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- the player

export function inductPlayer(w: World, p: Character, to: Rank, shown: number) {
  if (to === 'soldier' && p.familyId) madeFromLine(w, w.fam[p.familyId], p, sponsorOf(w, p));
  const sp = sponsorOf(w, p);
  repute(w, p, shown, 'induction');
  promote(w, p, to, sp);
  w.fam[p.familyId!].lastPromo = w.now;
}

export function turnedDown(w: World, p: Character) {
  const boss = w.chars[w.fam[p.familyId!].bossId];
  if (boss) feel(w, boss, p.id, 'respect', -0.2);
  repute(w, p, -8, 'turned down');
  p.cooldown['induct'] = w.now + 70 * DAY;
}

// A captain puts a man's name forward.
export function recommendable(w: World, p: Character): Character[] {
  if (LADDER.indexOf(p.rank) < 1) return [];
  return members(w, p.familyId!).filter((c) => c.bossId === p.id && c.rank === 'associate' && !isRunner(w, c) && c.id !== p.id && !c.backer);
}
export function recommend(w: World, p: Character, c: Character): string[] {
  const boss = w.chars[w.fam[p.familyId!].bossId];
  c.backer = p.id;
  feel(w, c, p.id, 'trust', 0.15);
  feel(w, c, p.id, 'affection', 0.1);
  const r = readiness(w, c);
  const lines = [`You tell ${boss?.name ?? 'the boss'} that ${c.name} has earned it. Your name is on him now.`];
  if (r && r.earn < 1) lines.push(`${c.name} has only passed up ${money(c.lifetimeKick)} so far. It will count for less until that changes.`);
  return lines;
}

// Recruit a civilian who likes you into your crew.
export function recruitable(w: World, p: Character): Character[] {
  if (LADDER.indexOf(p.rank) < 1) return [];
  return Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.isPlayer && (c.rels[p.id]?.trust ?? 0) >= 0.45 && c.traits.violence + c.traits.ambition > 0.7).slice(0, 4);
}
export function recruit(w: World, p: Character, c: Character): string[] {
  if (['soldier', 'capo', 'underboss', 'boss'].includes(p.rank)) applyRank(w, c, 'associate', { fact: false, place: (x) => { x.familyId = p.familyId; x.bossId = p.id; } });
  else { c.bossId = p.id; c.kickRate = Math.max(c.kickRate, 0.2); } // (an associate's man is his crewman, not the family's)
  addFact(w, { kind: 'promotion', actor: c.id, minor: true, text: `${c.name} has started running with ${p.name}.`, district: c.district }, { witnesses: [p.id] });
  feel(w, c, p.id, 'trust', 0.1);
  return [`${c.name} shakes your hand. He works for you now, and you answer for him.`];
}

export function careerLines(w: World, p: Character): string[] {
  const i = pathInfo(w, p);
  if (!i) return [`There’s nowhere higher to go. You’re the one they come to.`];
  const left = i.goals.filter((x) => !x.done);
  return [left.length ? `Next: ${i.to}. Still to do: ${left.map((x) => x.label.toLowerCase()).join(', ')}.` : `Next: ${i.to}. You’ve done what was asked. They’re making their minds up.`];
}

// -------------------------------------------------- promotion as a process

export interface Row {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | '';
}
export function standingTable(w: World, p: Character): { rows: Row[]; verdict: string } {
  const r = readiness(w, p);
  if (!r || !p.familyId) return { rows: [], verdict: 'There’s only one chair above you.' };
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const trust = boss ? rel(boss, p.id).trust : 0;
  const rows: Row[] = [
    { label: 'Earnings', value: r.earn >= 1 ? 'Meeting expectations' : r.earn > 0.6 ? 'Getting there' : r.earn > 0.25 ? 'Building' : 'Not yet', tone: r.earn >= 1 ? 'good' : r.earn > 0.6 ? 'warn' : 'bad' },
    { label: 'Reputation', value: p.standing >= 60 ? 'Respected' : p.standing >= 45 ? 'Trusted' : p.standing >= 30 ? 'Unproven' : 'Thin ice', tone: p.standing >= 45 ? 'good' : p.standing >= 30 ? 'warn' : 'bad' },
    { label: boss ? `${boss.name.split(' ')[0]}'s support` : 'Your captain', value: trust > 0.65 ? 'Strong' : trust > 0.45 ? 'Fair' : 'Weak', tone: trust > 0.65 ? 'good' : trust > 0.45 ? 'warn' : 'bad' },
    { label: 'Senior sponsor', value: r.sponsor ? r.sponsor.name : 'Not secured', tone: r.sponsor ? 'good' : 'bad' },
    { label: `Seats open at ${r.to}`, value: String(Math.max(0, capOf(w, p.familyId, r.to) - seats(w, p.familyId, r.to))), tone: r.openSeat ? 'good' : 'bad' },
  ];
  const rivals = members(w, p.familyId).filter((c) => c.id !== p.id && c.rank === p.rank && c.lifetimeKick >= (ROAD[r.to]?.kick ?? 1e9) * 0.8).length;
  if (rivals) rows.push({ label: 'Others in line', value: String(rivals), tone: 'warn' });
  const inbox = w.jobs.find((j) => j.kind === 'summons' && j.meeting === 'induction' && j.status === 'offered');
  const verdict = inbox ? 'They’re ready for you. Go.' : eligible(r) ? 'You’re being considered.' : r.blockers.length ? 'Held up: ' + r.blockers.map((b) => b.replace('you ', 'you ').replace(/^./, (c) => c.toLowerCase())).join('; ') + '.' : 'You’re being considered.';
  return { rows, verdict };
}


// -------------------------------------------------- the process itself

const first = (c: Character) => c.name.split(' ')[0];

export interface Step {
  label: string;
  note: string;
  state: 'done' | 'now' | 'wait';
}
export function promoSteps(w: World, p: Character): Step[] | undefined {
  const pc = w.promo;
  if (!pc) return undefined;
  const sp = w.chars[pc.sponsor];
  const rv = pc.rival ? w.chars[pc.rival] : undefined;
  const st = (n: number): Step['state'] => (pc.stage > n || pc.result ? 'done' : pc.stage === n ? 'now' : 'wait');
  const rows: Step[] = [
    { label: 'Your sponsor speaks to you', note: sp ? sp.name : '', state: st(0) },
    { label: 'Another man is in the running', note: rv ? rv.name : pc.stage > 1 ? 'Nobody else stood' : 'to be seen', state: st(1) },
    { label: 'You sit down with the boss', note: 'one question, and he listens to the answer', state: st(2) },
    { label: 'They decide', note: pc.result === 'chosen' ? 'in your favour' : pc.result === 'passed' ? 'against you' : 'behind closed doors', state: pc.result ? 'done' : st(3) },
    { label: 'The ceremony', note: pc.result === 'chosen' ? 'summoned' : '', state: pc.result === 'chosen' ? 'now' : 'wait' },
  ];
  return rows;
}

function promoEnc(w: World, p: Character, pc: NonNullable<World['promo']>, stage: number): void {
  const sp = w.chars[pc.sponsor];
  const boss = w.chars[w.fam[p.familyId!].bossId];
  if (stage === 0) {
    const lead = pick(
      arch(sp) === 'proud'
        ? ['"I’m going to put your name forward. Not because I like you. Because you have earned it. But once I do, whatever you do is on me."']
        : arch(sp) === 'jovial'
          ? ['"My friend. I’ve been talking about you to some people. Good things. Don’t make me a liar."']
          : arch(sp) === 'cold'
            ? ['"I’m putting your name in. If you embarrass me, I’ll be the one who has to deal with it, and I won’t be gentle."']
            : ['"There’s a vacancy, and I think you should be considered. Before I say anything to anyone, I want to hear how you see it."'],
      pc.sponsor + pc.since,
    );
    addEnc(w, {
      kind: 'promo', from: sp.id, title: 'Your name is being considered', days: 6,
      lines: [`${sp.name} asks you to walk with him.`, lead],
      opts: [
        { code: 'humble', label: 'I won’t forget it. Whatever you need.', hint: 'The right thing to say to most men.' },
        { code: 'earn', label: 'I would like to prove myself on something real first', hint: 'Shows you don’t take it for granted.' },
        { code: 'envelope', label: 'Slip him $300 for the trouble', hint: 'Some men expect it. Some are insulted.' },
        { code: 'ask', label: 'Who else is in the running?', hint: 'Knowing the field costs you nothing. Asking may cost you something.' },
      ],
      data: { case: pc.since, stage: 0 },
    });
  } else if (stage === 1) {
    const rv = w.chars[pc.rival!];
    addEnc(w, {
      kind: 'promo', from: sp.id, about: rv.id, title: `${first(rv)} is in the running too`, days: 6,
      lines: [`${sp.name} doesn’t soften it.`, `"${rv.name} has been proposed as well. There’s one seat. Both of you can’t have it, and ${boss?.name ?? 'the boss'} won’t decide on how nice you’re to each other."`],
      opts: [
        { code: 'undermine', label: `Make sure the right people hear about ${first(rv)}'s failings`, hint: 'Dangerous. If it comes back to you, it ends your chances.' },
        { code: 'outdo', label: 'Make a show of generosity: $500 in tribute', hint: 'It will be noticed.' },
        { code: 'ally', label: `Go to ${first(rv)} and agree to back whoever wins`, hint: 'It costs you nothing now. It might buy you a friend.' },
        { code: 'trust', label: 'Let the work speak', hint: 'Nobody’s offended. Nobody’s persuaded.' },
      ],
      data: { case: pc.since, stage: 1 },
    });
  } else if (stage === 2) {
    addEnc(w, {
      kind: 'promo', from: boss.id, title: `${first(boss)} wants to see you`, days: 6,
      lines: [`${boss.name} receives you in the back room. There’s coffee. He doesn’t offer you any.`, `"I’ve heard what everybody has to say about you. Now I want to hear it from you. Why you, and not somebody else?"`],
      opts: [
        { code: 'loyal', label: '"Because nobody here is more loyal to you than I am."', hint: 'Safe. He has heard it before.' },
        { code: 'earner', label: '"Look at what I bring in."', hint: 'Works if your numbers are good.' },
        { code: 'quiet', label: 'Say nothing, and let the silence do it', hint: 'Only works on a man who respects silence.' },
        { code: 'bold', label: '"Because I’ll do the things the others won’t."', hint: 'It’s what he wants to hear, or what he fears.' },
      ],
      data: { case: pc.since, stage: 2 },
    });
  }
}

const lastEnc = (w: World, pc: NonNullable<World['promo']>, stage: number) => w.enc.filter((e) => e.kind === 'promo' && e.data?.case === pc.since && e.data?.stage === stage).slice(-1)[0];

export function promoTick(w: World) {
  const p = w.chars[w.playerId!];
  const pc = w.promo;
  if (!pc || !p?.alive || !p.familyId) return;
  if (pc.result) {
    // (a man passed over is told to try again in a week or two, and can be: the record goes when his wait does; a man chosen keeps it
    // while the ceremony and its aftermath run)
    if (pc.stage >= 4 && (pc.result === 'passed' ? (p.cooldown['induct'] ?? 0) <= w.now : w.now - pc.since > 60 * DAY)) delete w.promo;
    return;
  }
  const sp = w.chars[pc.sponsor];
  if (!sp?.alive) pc.sponsor = w.fam[p.familyId].bossId;
  if (p.jailedUntil > w.now) {
    pc.result = 'passed';
    pc.stage = 4;
    pc.log.push('The process stalls, and then it ends.');
    p.cooldown['induct'] = w.now + 5 * DAY;
    return;
  }
  if (w.now < pc.next) return;
  const fam = w.fam[p.familyId];
  const e = lastEnc(w, pc, pc.stage);
  if (pc.stage <= 2) {
    if (!e) {
      if (pc.stage === 1) {
        const rv = members(w, fam.id).filter((c) => c.id !== p.id && c.rank === p.rank && !c.isPlayer && c.jailedUntil <= w.now && readiness(w, c) && readiness(w, c)!.score > 0.35).sort((a, b) => readiness(w, b)!.score - readiness(w, a)!.score)[0];
        if (!rv) { pc.stage = 2; pc.next = w.now + 4 * 60; return; }
        pc.rival = rv.id;
      }
      promoEnc(w, p, pc, pc.stage);
      return;
    }
    if (e.status === 'open') return;
    if (e.status === 'lapsed') pc.points -= 0.5;
    pc.stage++;
    pc.next = w.now + DAY;
    return;
  }
  // decide
  const r = readiness(w, p);
  const rv = pc.rival ? w.chars[pc.rival] : undefined;
  const to = pc.to;
  const boss = w.chars[fam.bossId];
  pc.stage = 4;
  const room = vacancy(w, fam.id, to);
  const myScore = (r?.score ?? 0.4) + pc.points * 0.05;
  const rvScore = rv?.alive ? (readiness(w, rv)?.score ?? 0.3) + rv.traits.ambition * 0.08 : 0;
  void myScore; void rvScore;
  // You did the whole road. What you say at the table can still sink you, but not for long.
  const win = room && pc.points > -2.5;
  if (win) {
    pc.result = 'chosen';
    p.cooldown['induct'] = w.now + 3 * DAY;
    // (a ceremony is held on a night, at a place: the second night from now, at nine; going to it before then is waiting for it)
    const at = (Math.floor(w.now / DAY) + 2) * DAY + 21 * 60, day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][Math.floor(at / DAY) % 7];
    mkJob(w, { kind: 'summons', meeting: 'induction', extra: { to, at }, giver: boss.id, via: 'boss', assignee: p.id, pay: 0, days: 7, title: to === 'soldier' ? 'You’re being proposed' : to === 'capo' ? 'They want to make you a captain' : 'The boss wants you beside him', brief: `${sp.name} has put your name forward and ${boss.name} has agreed.${rv ? ` ${rv.name} was also considered.` : ''} ${to === 'soldier' ? `There will be a ceremony, ${day} night at nine. You don’t get a second one.` : to === 'capo' ? `${day} night at nine. You’ll have your own crew and answer for it.` : `${day} night at nine. You’ll be the second man in the family. Every captain will answer to you.`}` });
  } else {
    pc.result = 'passed';
    p.cooldown['induct'] = w.now + 10 * DAY;
    if (w.path) delete w.path.hold;
    feel(w, p, boss.id, 'respect', -0.02);
    p.memos.push({ id: 'm' + w.nextId++, kind: 'question', other: sp.id, text: 'You had done everything asked, and then said the wrong things at the table. They want to see you try again in a week or two. It is not the end.', t: w.now, done: true });
  }
}

export function promoChoose(w: World, p: Character, e: Enc, code: string): string[] {
  if (e.data?.stage === 'trial') return trialChoose(w, p, e, code);
  const pc = w.promo;
  const lines: string[] = [];
  if (!pc) return ['It has gone quiet.'];
  const stage = Number(e.data?.stage);
  const c = e.from ? w.chars[e.from] : undefined;
  if (stage === 0 && c) {
    const a = arch(c);
    if (code === 'humble') { pc.points += 1; feel(w, c, p.id, 'trust', 0.04); lines.push(`${c.name} nods. "Good. That’s the right answer. Remember you gave it."`); }
    else if (code === 'earn') { pc.points += 0.7; feel(w, c, p.id, 'respect', 0.04); lines.push(`"Humble. I like that." ${c.name} almost smiles.`); }
    else if (code === 'envelope') {
      if (p.cash < 300) { lines.push('You reach for it and have nothing to reach for.'); }
      else {
        p.cash -= 300; c.cash += 300;
        if (['proud', 'earnest'].includes(a)) { pc.points -= 1.2; feel(w, c, p.id, 'respect', -0.1); lines.push(`${c.name} looks at the envelope, and then at you. "I didn’t ask for that." He doesn’t give it back, and he doesn’t forget it.`); }
        else { pc.points += 1.2; lines.push(`${c.name} makes the envelope disappear. "Thoughtful." That’s all.`); }
      }
    } else {
      const rv = members(w, p.familyId!).filter((x) => x.id !== p.id && x.rank === p.rank && !x.isPlayer && readiness(w, x)).sort((x, y) => readiness(w, y)!.score - readiness(w, x)!.score)[0];
      if (rv) lines.push(`${c.name} thinks. "${rv.name}. He’s good. He’s also not you." Asking cost you a little: he knows you’re worried.`);
      else lines.push(`${c.name} says nobody comes to mind, and you think he might actually be right.`);
      pc.points -= 0.2;
    }
  } else if (stage === 1) {
    const rv = e.about ? w.chars[e.about] : undefined;
    if (code === 'undermine' && rv) {
      if (w.rng.chance(0.62)) { pc.points += 1; if (rv.rels) bear(w, rv, p.id, 0.1, `${p.name} talked him down to get ahead`); lines.push(`A few careful words in the right places, and by the end of the week people are saying things about ${rv.name} that weren’t said before. Nobody traces it to you.`); }
      else { pc.points -= 2.5; bear(w, rv, p.id, 0.4, `${p.name} talked him down to get ahead`); lines.push(`It gets back to ${rv.name}. And to ${c?.name ?? 'your sponsor'}. A man who does that to a rival in front of the people who decide isn’t a man they want to make.`); }
    } else if (code === 'outdo') {
      if (p.cash < 500) lines.push('You can’t cover it, and you don’t pretend you can.');
      else { p.cash -= 500; pc.points += 1.2; repute(w, p, 1, 'lobbying'); lines.push(`Five hundred goes round the room in the form of a round of drinks, a donation to the church and an envelope for a widow. People are very aware of it.`); }
    } else if (code === 'ally' && rv) {
      pc.points += 0.4;
      feel(w, rv, p.id, 'trust', 0.15);
      addFavour(w, p.id, rv.id, 2, `the way you agreed to back him for the seat`);
      lines.push(`${rv.name} studies you, and shakes your hand. Whichever of you gets it, the other won’t be a problem. That’s worth something.`);
    } else lines.push('You say nothing. Some men would call that confidence.');
  } else if (stage === 2 && c) {
    const a = arch(c);
    const earn = readiness(w, p)?.earn ?? 0.5;
    if (code === 'loyal') { pc.points += 0.8; lines.push(`${c.name} nods slowly. "They all say that. But you say it like you mean it."`); }
    else if (code === 'earner') { const g = earn >= 1 ? 1.6 : earn > 0.7 ? 0.6 : -0.6; pc.points += g; lines.push(g > 0 ? `${c.name} turns a page. "Yes. That’s true." He sounds pleased.` : `${c.name} turns a page. "That’s less than you think it is." You feel your face heat.`); }
    else if (code === 'quiet') { const g = ['cold', 'proud'].includes(a) ? 1.5 : -0.8; pc.points += g; lines.push(g > 0 ? `The silence goes on for a long time. ${c.name} finally looks away first. "Good."` : `${c.name} waits, and then gets impatient. "Say something." You wish you had.`); }
    else { const ok = w.rng.chance(0.45 + p.traits.violence * 0.2); pc.points += ok ? 1.4 : -1.2; lines.push(ok ? `${c.name} looks at you for a long moment. "Yes. I believe you." It’s not clear he’s happy about it.` : `${c.name} frowns. "That’s not what I asked." You said the wrong thing to the wrong man.`); }
  }
  pc.log.push(...lines);
  return lines;
}
import { addFavour } from './encounters';
import { npcTrial, trialChoose, pathInfo, ROAD } from './path';

// A seat doesn't appear because a box was ticked. A man who keeps it up, week after week, gets noticed; the
// sponsor says something; the boss thinks about it. Slip, and it all cools off.
function noticeTick(w: World, fam: import('./types').Family, boss: Character, to: Rank, from: Rank) {
  const watch = (fam.watch ??= {});
  const p = w.chars[w.playerId!];
  const cands = members(w, fam.id).filter((c) => c.rank === from && c.jailedUntil <= w.now && !isRunner(w, c));
  let top: { c: Character; r: Readiness } | undefined;
  for (const c of cands) {
    const r = readiness(w, c);
    if (r && eligibleIgnoringSeat(w, c)) { watch[c.id] = (watch[c.id] ?? 0) + 1; if (!top || r.score > top.r.score) top = { c, r }; }
    else if (watch[c.id]) { watch[c.id] = Math.max(0, watch[c.id] - 2); if (!watch[c.id]) delete watch[c.id]; }
  }
  if (!top || (fam.seatNo?.[to] ?? 0) > w.now || (fam.capBonus?.[to] ?? 0) >= SEAT_EXTRA) return;
  const { c, r } = top;
  const n = watch[c.id];
  const who = c.isPlayer ? 'you' : c.name;
  const say = (text: string, textKin: string) => addFact(w, { kind: 'report', actor: c.id, minor: false, text: c.isPlayer ? textKin : text, story: 'seat:' + to, district: c.district }, { broadcast: [c.id, r.sponsor?.id ?? c.id, boss.id] });
  const sp = r.sponsor ?? boss; // (a man whose road is done may since have lost the man who spoke for him)
  if (n === 3) say(`${boss.name} has started to hear the name ${c.name}. Results, mostly.`, `${boss.name} has started to hear your name. Results, mostly. Keep it up.`);
  else if (n === 7) {
    say(`${sp.name} told ${boss.name} the family is short of ${to}s, and that ${c.name} is the reason he knows it.`, `${sp.name} told ${boss.name} the family is short of ${to}s, and named you as the reason he knows it.`);
    feel(w, boss, c.id, 'respect', 0.04);
    if (c.isPlayer && p) p.memos.push({ id: 'm' + w.nextId++, kind: 'question', other: boss.id, text: `${boss.name} is weighing another ${to}’s chair. ${sp.name} says to keep the numbers up, and to stay out of trouble.`, t: w.now, done: false });
  } else if (n >= 12) {
    const chance = clamp(0.45 + r.score * 0.4 + rel(boss, c.id).trust * 0.05 - boss.traits.greed * 0.15, 0.2, 0.85);
    if (w.rng.chance(chance)) {
      openSeatFor(w, fam.id, to);
      say(`${boss.name} has decided the ${famName(w, boss)} family can use another ${to}. A seat has been opened. He didn’t say who it’s for, but ${c.name} has been the one people mention.`, `${boss.name} has decided the family can use another ${to}. A seat has been opened. He didn’t say who it’s for, but you’ve been the name people mention.`);
    } else {
      fam.seatNo = { ...(fam.seatNo ?? {}), [to]: w.now + 30 * DAY };
      watch[c.id] = 6;
      say(`${boss.name} weighed another ${to} and decided the family’s the right size for now. ${who === 'you' ? 'It’s not about you.' : ''}`.trim(), `${boss.name} weighed another ${to} and decided the family’s the right size for now. It isn’t about you. Keep going.`);
    }
  }
}

// ---------------------------------------------------------------- rewarding your own men
export interface RewardOpt { code: string; label: string; hint: string; off?: boolean }
const earned = (w: World, c: Character) => {
  const h = c.books.history.slice(-4);
  const steady = h.length >= 2 && h.filter((x) => x.due === 0 || x.paid >= x.due * 0.95).length >= Math.min(3, h.length);
  return steady || (c.career?.done ?? 0) > (c.career?.failed ?? 0) + 1;
};
export function rewardOptions(w: World, p: Character, c: Character): RewardOpt[] {
  const cd = (k: string) => (p.cooldown[`rw:${k}:${c.id}`] ?? 0) > w.now;
  const good = earned(w, c);
  const o: RewardOpt[] = [];
  o.push({ code: 'bonus1', label: 'Slip him $250', hint: good ? 'He’s been dependable. It will be remembered.' : 'He hasn’t earned it yet. He’ll take it anyway.', off: cd('bonus') || p.cash < 250 });
  o.push({ code: 'bonus2', label: 'Give him $800 and a good word', hint: 'Real money. Buys real loyalty.', off: cd('bonus') || p.cash < 800 });
  o.push({ code: 'praise', label: 'Praise him in front of the crew', hint: 'Free. Works best on a man who has done something.', off: cd('praise') });
  if (LADDER.indexOf(p.rank) >= 1 && c.rank === 'associate' && !isRunner(w, c) && !c.backer) o.push({ code: 'sponsor', label: 'Put him forward to be made', hint: 'Your name goes with his. If he fails, you answer for it.' });
  return o.filter((x) => !x.off || x.code.startsWith('bonus') || x.code === 'praise');
}
export function reward(w: World, p: Character, c: Character, code: string): string[] {
  const r = rel(c, p.id);
  const good = earned(w, c);
  const f = c.name.split(' ')[0];
  if (code === 'sponsor') return recommend(w, p, c);
  if (code === 'praise') {
    if ((p.cooldown[`rw:praise:${c.id}`] ?? 0) > w.now) return [`${f} has had his share of praise this week.`];
    p.cooldown[`rw:praise:${c.id}`] = w.now + 10 * DAY;
    feelOn(w, r, 'trust', (good ? 0.08 : 0.02)); feelOn(w, r, 'respect', (good ? 0.1 : 0.0)); feelOn(w, r, 'affection', 0.03);
    for (const x of Object.values(w.chars)) if (x.alive && x.bossId === p.id && x.id !== c.id) { const q = rel(x, p.id); feelOn(w, q, 'respect', 0.01); feelOn(w, q, 'trust', (good ? 0.01 : -0.02)); }
    return [good ? `You make a point of saying what ${f} did, with the others listening. He stands a little straighter. The others notice what gets noticed.` : `${f} hasn’t done much to be praised for, and everyone in the room knows it. It rings a little hollow.`];
  }
  const amt = code === 'bonus2' ? 800 : 250;
  if ((p.cooldown[`rw:bonus:${c.id}`] ?? 0) > w.now) return [`${f} was paid a bonus not long ago. Again so soon and it becomes his due.`];
  if (p.cash < amt) return ['You haven’t got it to give.'];
  p.cash -= amt; c.cash += amt;
  p.cooldown[`rw:bonus:${c.id}`] = w.now + 14 * DAY;
  const k = (good ? 1 : 0.4) * (amt >= 800 ? 2 : 1);
  feelOn(w, r, 'trust', 0.05 * k); feelOn(w, r, 'affection', 0.05 * k); feelOn(w, r, 'respect', 0.03 * k);
  c.books.missed = Math.max(0, c.books.missed - 1);
  if (c.problem && c.problem.sev > 0.2) c.problem.sev = Math.max(0, c.problem.sev - 0.1 * k);
  return [good ? `${f} counts it without seeming to. "I won’t forget this." It’s the kind of thing a man repeats to his friends.` : `${f} takes it. Whether it buys anything beyond today, you’ll find out.`];
}
