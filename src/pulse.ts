// The world's own pulse: things that happen between other people whether or not the player is involved,
// the shifts in what men want, and the two kinds of situation that come from the shape of the organisation
// itself: a border dispute over a shop, and work or advancement that the family hands out.
import { lineOf } from './rackets';
import { clearArrears, setCollector } from './econ';
import { leaveCrew } from './rank';
import { addFact, bear, bearOn, clamp, feel, feelOn, money, rel, repute } from './core';
import { addEnc, addFavour } from './encounters';
import { members } from './career';
import { wantFor } from './crewlife';
import { addShops } from './world';
import { post } from './ledger';
import { hasPerk } from './specs';
import { Character, DAY, Enc, Id, Situation, WEEK, World } from './types';

import { hostility } from './orgs';
const first = (c: Character) => c.name.split(' ')[0];
const PL = (w: World) => w.chars[w.playerId!];
const LIVING: Record<string, number> = { civilian: 70, associate: 100, soldier: 170, capo: 330, underboss: 520, boss: 900 };

// ================================================================ what men want, and how it changes
// A man's want is not fixed. It moves with how his life is going: money, being passed over, being hurt, being trusted.
export function motiveTick(w: World) {
  const p = PL(w);
  if (!p?.alive) return;
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || c.rank === 'civilian' || c.rank === 'boss' || !c.familyId) continue;
    c.want ??= { kind: wantFor(c), since: w.now };
    if (w.now - c.want.since < 3 * WEEK) continue;
    const fam = w.fam[c.familyId];
    const boss = c.bossId ? w.chars[c.bossId] : undefined;
    const r = boss ? rel(c, boss.id) : undefined;
    const T = c.traits;
    const debtor = w.debts.some((d) => d.status === 'active' && d.debtor === c.id && d.missed > 0);
    const living = LIVING[c.rank] ?? 100;
    const recentHurt = (c.hurtUntil > w.now - 2 * WEEK) || (c.jailedUntil > w.now - 2 * WEEK && c.jailedUntil > 0);
    let to: typeof c.want.kind | undefined, why = '';
    if ((debtor || c.cash < living * 0.8) && c.want.kind !== 'rich' && c.want.kind !== 'gamble') { to = T.vice > 0.5 ? 'gamble' : 'rich'; why = 'money has been tight'; }
    else if ((fam.watch?.[c.id] ?? 0) >= 4 && c.want.kind !== 'independent' && c.want.kind !== 'respect') { to = T.ambition > 0.7 ? 'independent' : 'respect'; why = 'he keeps being passed over'; }
    else if (r && (r.trust < 0.2 || r.grudge > 0.3) && c.want.kind !== 'independent') { to = 'independent'; why = `he’s sore at ${first(boss!)}`; }
    else if (recentHurt && c.want.kind !== 'respect' && T.courage > 0.4) { to = 'respect'; why = 'he took a beating to his pride'; }
    else if (c.cash > living * 8 && T.ambition > 0.5 && c.rank === 'associate' && c.want.kind !== 'made') { to = 'made'; why = 'he has money and wants the name that goes with it'; }
    else if (r && r.trust > 0.7 && T.ambition > 0.5 && c.rank !== 'associate' && c.want.kind !== 'lieutenant' && c.want.kind !== 'independent') { to = 'lieutenant'; why = `he’s been trusted and wants more of it`; }
    if (!to || !w.rng.chance(0.3)) continue;
    c.want = { kind: to, since: w.now, why };
    // What you had worked out about him is out of date.
    if (p.insight?.[c.id]) p.insight[c.id] = p.insight[c.id].filter((t) => t !== 'want');
    if (c.bossId === p.id) addFact(w, { kind: 'rumour', actor: c.id, minor: true, text: `${c.name} is not the man he was a month ago: ${why}.`, district: c.district }, { witnesses: [] });
  }
}

// ================================================================ the ambient world
export function ambientWeek(w: World) {
  const p = PL(w);
  if (!p?.alive || !p.familyId) return;
  const rng = w.rng;
  // Shops change hands between families where there is tension. Nobody asked you.
  const fams = Object.values(w.fam);
  for (const A of fams) for (const B of fams) {
    if (A.id >= B.id) continue;
    const t = (A.tension[B.id] ?? 0) + (B.tension[A.id] ?? 0);
    if (t < 1.5 || !rng.chance((0.04 + Math.min(0.12, t * 0.015)) * hostility(w, A.id, B.id))) continue;
    const [loser, winner] = rng.chance(0.5) ? [A, B] : [B, A];
    const shops = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && b.protection?.familyId === loser.id && b.protection.collectorId !== p.id && w.chars[b.protection.collectorId]?.bossId !== p.id && winner.districts.includes(b.district));
    const taker = members(w, winner.id).filter((c) => c.alive && c.rank !== 'civilian' && c.rank !== 'boss' && c.id !== p.id);
    if (!shops.length || !taker.length) continue;
    const b = rng.pick(shops);
    const pool = taker.filter((c) => c.id !== b.ownerId); // a man cannot take a shop he already owns and then collect from himself
    if (!pool.length) continue;
    const by = rng.pick(pool);
    const old = w.chars[b.protection!.collectorId];
    setCollector(w, b, by.id, winner.id);
    addFact(w, { kind: 'poach', actor: by.id, victim: old?.id, business: b.id, text: `${by.name} (${winner.name}) took ${b.name} away from ${old?.name ?? 'the ' + loser.name + ' family'}.`, district: b.district }, { broadcast: [...members(w, winner.id).map((c) => c.id).slice(0, 6), ...members(w, loser.id).map((c) => c.id).slice(0, 6)] });
    A.tension[B.id] = (A.tension[B.id] ?? 0) + 0.3; B.tension[A.id] = (B.tension[A.id] ?? 0) + 0.3;
  }
  // A new place opens somewhere. In your family's ground that is somebody to talk to.
  if (rng.chance(0.14)) {
    const [oid] = addShops(w, 1);
    const b = Object.values(w.biz).find((x) => x.ownerId === oid);
    if (b) {
      const mine = w.fam[p.familyId].districts.includes(b.district);
      addFact(w, { kind: 'event', actor: oid, business: b.id, minor: !mine, text: `${b.name} has opened in ${b.district}.`, district: b.district }, mine ? { witnesses: [p.id] } : {});
    }
  }
}

// ================================================================ a border dispute over a shop
const famOf = (w: World, id: Id) => w.fam[id];
function turfStart(w: World, p: Character) {
  const list = (w.situations ??= []);
  if (list.some((s) => s.kind === 'turf' && s.stage !== 'resolved')) return;
  if ((p.cooldown.turf ?? 0) > w.now) return;
  const mine = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && b.protection?.familyId === p.familyId && (b.protection.collectorId === p.id || w.chars[b.protection.collectorId]?.bossId === p.id) && (p.cooldown[`turf:${b.id}`] ?? 0) < w.now);
  if (!mine.length) return;
  const fam = w.fam[p.familyId!];
  const rivals = Object.values(w.fam).filter((f) => f.id !== fam.id).map((f) => ({ f, t: (fam.tension[f.id] ?? 0) + (f.tension[fam.id] ?? 0) })).filter((x) => x.t > 0.4);
  if (!rivals.length) return;
  const b = w.rng.pick(mine);
  const pool = rivals.filter((r) => r.f.districts.includes(b.district));
  const tgt = (pool.length ? pool : rivals).sort((a, b2) => b2.t - a.t)[0];
  if (!w.rng.chance((0.08 + Math.min(0.3, tgt.t * 0.04)) * hostility(w, fam.id, tgt.f.id))) return;
  const men = members(w, tgt.f.id).filter((c) => c.alive && (c.rank === 'soldier' || c.rank === 'capo') && c.id !== p.id && c.id !== b.ownerId);
  if (!men.length) return;
  const rv = men.sort((a, b2) => b2.traits.ambition - a.traits.ambition)[0];
  p.cooldown.turf = w.now + 6 * WEEK;
  const o = w.chars[b.ownerId];
  list.push({ id: 's' + w.nextId++, kind: 'turf', who: b.ownerId, biz: b.id, fam: tgt.f.id, rivalMan: rv.id, since: w.now, stage: 'brewing', weeks: 0, cause: `${tgt.f.name} men have been telling ${o.name} he’s paying the wrong people`, knows: false, told: false });
}
function turfAdvance(w: World, p: Character, s: Situation) {
  const b = s.biz ? w.biz[s.biz] : undefined;
  const rv = s.rivalMan ? w.chars[s.rivalMan] : undefined;
  const o = w.chars[s.who];
  if (!b?.open || !rv?.alive || !o?.alive || b.protection?.familyId !== p.familyId) { s.stage = 'resolved'; s.resolvedAt = w.now; s.how = 'alone'; return; }
  s.weeks++;
  if (s.stage === 'brewing' && s.weeks >= 1) {
    s.stage = 'asking'; s.asked = w.now; s.knows = true;
    const col = w.chars[b.protection!.collectorId];
    const from = col && col.id !== p.id && col.alive ? col : o;
    const fn = famOf(w, s.fam!).name;
    addEnc(w, {
      kind: 'crew', from: from.id, title: `${fn} men are leaning on ${first(o)}`, days: 6,
      lines: [from.id === o.id ? `${o.name} comes to find you himself.` : `${from.name} catches you at the club.`, from.id === o.id ? `"${rv.name} from the ${fn} family was in again. He says ${b.name} is on his side of the line now, and that it’s ${money(b.protection!.fee)} to him or trouble. I pay you. I don’t know who to be afraid of."` : `"${rv.name}, ${fn} family, has been telling ${o.name} that ${b.name} is on their side of the line. ${o.name} is starting to listen. We either answer this or lose the shop."`],
      opts: [
        { code: 'show', label: 'Put men on the street outside', hint: 'It holds the shop if you have the numbers. It also raises the temperature with them.' },
        { code: 'parley', label: `Go and talk to ${first(rv)}`, hint: 'Quiet, and it might end it. It might also be taken for weakness.' },
        { code: 'pay', label: `Pay ${first(rv)} $600 to look elsewhere`, hint: 'Buys a few weeks. He’ll remember it worked.' },
        { code: 'yield', label: 'Let them have the shop', hint: 'Keeps the peace. Costs standing, and everyone sees.' },
      ],
      data: { what: 'sit_turf', sid: s.id },
    });
  }
  // Left unanswered, the other side simply takes it.
  if (s.stage === 'asking' && s.asked && w.now - s.asked > 7 * DAY && !w.enc.some((e) => e.data?.sid === s.id && e.status === 'open')) turfLose(w, p, s, 'You didn’t answer, so they did.');
}
function turfLose(w: World, p: Character, s: Situation, why: string): string[] {
  const b = w.biz[s.biz!], rv = w.chars[s.rivalMan!], o = w.chars[s.who];
  const old = b.protection ? w.chars[b.protection.collectorId] : undefined;
  const fee = b.protection?.fee ?? 50;
  setCollector(w, b, rv.id, rv.familyId!, { fee });
  if (old && old.id !== p.id) repute(w, p, -2, 'lost a shop'); // (his own shop lost is the poach itself: core.DEED)
  if (o) feel(w, o, p.id, 'trust', -0.15);
  addFact(w, { kind: 'poach', actor: rv.id, victim: old?.id ?? p.id, business: b.id, text: `${rv.name} (${w.fam[rv.familyId!].name}) took ${b.name} away from ${old?.name ?? p.name}.`, district: b.district }, { witnesses: [p.id], broadcast: members(w, p.familyId!).map((c) => c.id).slice(0, 6) });
  s.stage = 'resolved'; s.resolvedAt = w.now; s.how = 'closed';
  return [`${why} ${b.name} pays ${first(rv)} now. It’s ${fee} a week you won’t see again, and everybody on the street knows who lost it.`];
}
function turfChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const s = (w.situations ?? []).find((x) => x.id === e.data?.sid);
  if (!s) return ['It has gone quiet.'];
  const b = w.biz[s.biz!], rv = w.chars[s.rivalMan!], o = w.chars[s.who];
  if (!b?.open || !rv?.alive) { s.stage = 'resolved'; return ['It no longer matters.']; }
  const A = w.fam[p.familyId!], B = w.fam[rv.familyId!];
  const crewN = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.jailedUntil <= w.now && c.hurtUntil <= w.now).length;
  const finish = (how: 'helped' | 'alone') => { s.stage = 'resolved'; s.resolvedAt = w.now; s.how = how; s.helped = true; };
  if (code === 'show') {
    const pr = clamp(0.4 + Math.min(3, crewN) * 0.14 + p.standing / 400 + (hasPerk(w, p, 'enforcer') ? 0.12 : 0) - ((A.tension[B.id] ?? 0) + (B.tension[A.id] ?? 0)) * 0.03, 0.25, 0.9);
    A.tension[B.id] = (A.tension[B.id] ?? 0) + 0.4; B.tension[A.id] = (B.tension[A.id] ?? 0) + 0.4;
    bear(w, rv, p.id, 0.1, `${p.name} faced him down over the shop`);
    if (w.rng.chance(pr)) {
      finish('helped');
      if (o) feel(w, o, p.id, 'trust', 0.12);
      repute(w, p, 1, 'held a shop');
      addFact(w, { kind: 'event', actor: p.id, victim: rv.id, business: b.id, text: `${p.name} put men outside ${b.name}. ${rv.name}’s people didn’t come back.`, district: b.district }, { witnesses: [p.id], broadcast: [rv.id] });
      return [`You put ${crewN ? 'your men' : 'yourself'} outside ${b.name} for three days, visible and doing nothing. ${first(rv)}’s people drive past once and don’t come back.`, `${o ? first(o) : 'The owner'} looks twelve years younger. The ${B.name} family now knows exactly where you stand.`];
    }
    return turfLose(w, p, s, `You tried to hold the street and ${first(rv)} had more men than you.`);
  }
  if (code === 'parley') {
    const pr = clamp(0.32 + rel(rv, p.id).respect * 0.35 + p.standing / 350, 0.2, 0.8);
    if (w.rng.chance(pr)) {
      finish('helped');
      A.tension[B.id] = Math.max(0, (A.tension[B.id] ?? 0) - 0.6); B.tension[A.id] = Math.max(0, (B.tension[A.id] ?? 0) - 0.6);
      addFavour(w, p.id, rv.id, 1, `backing off ${b.name}`);
      addFact(w, { kind: 'sitdown', actor: p.id, victim: rv.id, business: b.id, text: `${p.name} and ${rv.name} agreed ${b.name} stays where it is.`, district: b.district }, { witnesses: [p.id] });
      return [`You meet ${first(rv)} at neutral ground. It takes an hour and nobody raises a voice. He agrees ${b.name} stays as it is, and he agrees to owe you one for the trouble of asking.`];
    }
    bear(w, rv, p.id, 0.05, `${p.name} held on to the shop`);
    s.stage = 'handling'; s.weeks = 0; delete s.asked;
    return [`${first(rv)} listens, smiles, and says nothing was ever really agreed. You leave with the feeling the conversation is going to happen again, and the next one will be less friendly.`];
  }
  if (code === 'pay') {
    if (p.cash < 600) return ['You haven’t got $600 on you.'];
    p.cash -= 600; rv.cash += 600;
    post(w, { from: p.id, to: rv.id, amt: 600, flow: 'gift', note: `to ${first(rv)} to stay off ${b.name}` });
    p.cooldown[`turf:${b.id}`] = w.now + 6 * WEEK;
    if (w.rng.chance(0.72)) { finish('alone'); return [`${first(rv)} counts it, smiles, and finds he has business in another part of the borough. For now.`]; }
    return turfLose(w, p, s, `${first(rv)} took the $600 and took the shop anyway.`);
  }
  return turfLose(w, p, s, 'You let it go.');
}

// ================================================================ what the family hands out
function orgOffer(w: World, p: Character) {
  if (w.enc.some((e) => e.data?.what === 'sit_org' && e.status === 'open')) return;
  if ((p.cooldown.org ?? 0) > w.now || !p.familyId) return;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const fam = w.fam[p.familyId];
  const rng = w.rng;
  const kinds: string[] = [];
  // (Stage 4: a superior's shops for the player to bring in are work like any other, through the negotiation: work.ts 'lean'.)
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).length;
  const cand = ['soldier', 'capo', 'underboss'].includes(p.rank) ? Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'associate' && c.bossId && c.bossId !== p.id && (c.rels[p.id]?.trust ?? 0) > 0.25 && c.traits.ambition > 0.4) : [];
  if (cand.length && crew < 6) kinds.push('transfer');
  if (!kinds.length || !rng.chance(0.35)) return;
  p.cooldown.org = w.now + 3 * WEEK;
  const k = rng.pick(kinds);
  if (k === 'transfer') {
    const a = rng.pick(cand);
    const ob = a.bossId ? w.chars[a.bossId] : undefined;
    addEnc(w, {
      kind: 'crew', from: a.id, title: `${first(a)} wants to come over to you`, days: 8,
      lines: [`${a.name} finds you outside the club.`, `"I’ve been working under ${ob ? first(ob) : 'someone'} for a while. I like how you run things. If you had room, I’d like to be one of your men."`],
      opts: [
        { code: 'ask', label: `Clear it with ${ob ? first(ob) : 'his boss'} first`, hint: 'Slower and respectful. His boss will remember being asked.' },
        { code: 'take', label: 'Take him on', hint: 'Fast. His boss will see it as poaching.' },
        { code: 'no', label: 'Tell him you’re full', hint: 'Nobody’s offended.' },
      ],
      data: { what: 'sit_org', org: 'transfer', who: a.id },
    });
  }
}
function orgChoose(w: World, p: Character, e: Enc, code: string): string[] {
  if (e.data?.org === 'transfer') {
    const a = w.chars[String(e.data.who)];
    if (!a?.alive) return ['He’s gone.'];
    if (code === 'no') { feel(w, a, p.id, 'respect', -0.02); return [`${first(a)} nods. "Another time."`]; }
    const ob = a.bossId ? w.chars[a.bossId] : undefined;
    a.bossId = p.id;
    feel(w, a, p.id, 'trust', 0.15);
    if (ob?.alive) { if (code === 'ask') { feel(w, ob, p.id, 'respect', 0.05); } else { bear(w, ob, p.id, 0.1, `${p.name} took his man`); feel(w, ob, p.id, 'trust', -0.06); addFact(w, { kind: 'poach', actor: p.id, victim: ob.id, text: `${p.name} took ${a.name} out from under ${ob.name} without asking.`, district: a.district }, { witnesses: [p.id], broadcast: [ob.id] }); } }
    return [code === 'ask' ? `You talk to ${ob ? first(ob) : 'his boss'} first. He lets him go with the air of a man who’s been shown a courtesy. ${first(a)} is yours.` : `${first(a)} is yours from today. ${ob ? first(ob) + ' will hear about it.' : ''}`];
  }
  return ['Nothing comes of it.'];
}

// ================================================================ the weekly entry points

// ---- everyday situations: a wedding, a robbery, a policeman, a man being courted, a stranger with money.
function lifeOffer(w: World, p: Character) {
  if (w.enc.some((e) => e.data?.what === 'sit_life' && e.status === 'open')) return;
  if ((p.cooldown.lifeev ?? 0) > w.now || !p.familyId) return;
  const rng = w.rng;
  const fam = w.fam[p.familyId];
  const kinds: string[] = [];
  const mine = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id);
  const paying = Object.values(w.biz).filter((b) => b.open && b.protection?.collectorId === p.id);
  const friends = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && (c.rels[p.id]?.trust ?? 0) > 0.3);
  if (friends.length) kinds.push('wedding');
  if (paying.length) kinds.push('robbed');
  if (p.rank !== 'associate' || p.lifetimeKick > 500) kinds.push('cop');
  if (mine.length) kinds.push('defect');
  const steady = mine.filter((c) => c.books.history.length >= 4 && c.books.missed === 0 && (c.rels[p.id]?.trust ?? 0) > 0.5 && c.kickRate > 0.1);
  if (steady.length) kinds.push('rate', 'rate');
  if (fam.districts.includes(p.district)) kinds.push('newcomer');
  if (!kinds.length || !rng.chance(0.45)) return;
  p.cooldown.lifeev = w.now + 2 * WEEK;
  const k = rng.pick(kinds);
  if (k === 'rate') {
    const c = rng.pick(steady);
    const cur = Math.round(c.kickRate * 100);
    addEnc(w, {
      kind: 'crew', from: c.id, title: `${first(c)} wants to talk about his share`, days: 8,
      lines: [`${c.name} has paid on time for weeks. He asks for a minute.`, `"I’ve never been short with you. I want to put some money back into what I do. Could I pass up ${cur - 5} instead of ${cur}? I’ll make it up in volume."`],
      opts: [
        { code: 'agree', label: `Agree: ${cur - 5}%`, hint: 'You take a little less. He works harder and likes you more.' },
        { code: 'counter', label: `Meet him: ${cur - 2}%`, hint: 'A compromise. He accepts, a little grudgingly.' },
        { code: 'refuse', label: 'Refuse, politely', hint: 'Nothing changes. He pays, but he’ll remember.' },
      ],
      data: { what: 'sit_life', life: 'rate', who: c.id },
    });
  } else if (k === 'wedding') {
    const c = rng.pick(friends);
    addEnc(w, {
      kind: 'crew', from: c.id, title: `${first(c)}’s daughter is getting married`, days: 6,
      lines: [`${c.name} stops you outside the club, embarrassed, with a cream-coloured card.`, `"The reception’s tonight, at the hall. My wife thought you’d been asked weeks ago. It would mean a lot if you came."`],
      opts: [
        { code: 'big', label: 'Go, with a fat envelope ($300)', hint: 'The whole family sees it. He won’t forget it.' },
        { code: 'go', label: 'Go, with a modest envelope ($100)', hint: 'Correct and unremarkable.' },
        { code: 'skip', label: 'Send your regrets', hint: 'You have your reasons. He will notice.' },
      ],
      data: { what: 'sit_life', life: 'wedding', who: c.id },
    });
  } else if (k === 'robbed') {
    const b = rng.pick(paying), o = w.chars[b.ownerId];
    addEnc(w, {
      kind: 'crew', from: o.id, title: `${b.name} was robbed`, days: 6,
      lines: [`${o.name} is waiting when you come in, white in the face.`, `"Two men with a gun, last night. Took the register and the safe. I pay you to keep this from happening."`],
      opts: [
        { code: 'hunt', label: 'Find the men who did it ($200)', hint: 'Word goes round that your shops are not for robbing.' },
        { code: 'waive', label: 'Waive his fee for a month', hint: 'Costs you the money. Buys his loyalty.' },
        { code: 'shrug', label: 'Tell him that’s the risk of doing business', hint: 'He still pays. He’ll think less of you.' },
      ],
      data: { what: 'sit_life', life: 'robbed', biz: b.id },
    });
  } else if (k === 'cop') {
    addEnc(w, {
      kind: 'crew', from: null as any, title: 'A detective wants a quiet word', days: 5,
      lines: ['A man in a bad raincoat sits down opposite you in a coffee shop.', '"I know who you work for. I’m not here for you. I’m here for a name. Somebody who’s going to cause both of us trouble this year."'],
      opts: [
        { code: 'pay', label: 'Slip him $300 and say nothing', hint: 'Cools him off. He’ll be back.' },
        { code: 'feed', label: 'Give him a name that isn’t yours', hint: 'It buys you quiet and costs somebody else. If it gets out, it costs you.' },
        { code: 'refuse', label: 'Stand up and walk out', hint: 'Heat goes up. Nobody in the family can say you talked.' },
      ],
      data: { what: 'sit_life', life: 'cop' },
    });
  } else if (k === 'defect') {
    const c = rng.pick(mine);
    const other = rng.pick(Object.values(w.fam).filter((f) => f.id !== p.familyId));
    addEnc(w, {
      kind: 'crew', from: c.id, title: `${first(c)} has been made an offer`, days: 6,
      lines: [`${c.name} says he needs to be straight with you.`, `"Someone from ${other.name} came to see me. Better money, a chair. I said I’d think about it. I’m telling you because I’d rather it came from me."`],
      opts: [
        { code: 'raise', label: 'Lower his kick-up (−5 points)', hint: 'Costs you. He stays, and he knows what you’ll do to keep a man.' },
        { code: 'trust', label: 'Tell him you trust him to decide', hint: 'A big risk. Some men stay because you asked nothing.' },
        { code: 'warn', label: 'Tell him he’s yours and always will be', hint: 'Fear or pride. It could go either way.' },
      ],
      data: { what: 'sit_life', life: 'defect', who: c.id, fam: other.id },
    });
  } else if (k === 'newcomer') {
    addEnc(w, {
      kind: 'crew', from: null as any, title: 'A stranger wants to open on your ground', days: 6,
      lines: ['A man in a good coat introduces himself over a drink he won’t let you pay for.', '"I’m opening a place on this street. I’d like it to be understood that I’m a friend. I’m told you’re the man who decides that."'],
      opts: [
        { code: 'tax', label: 'Name your price ($400 now)', hint: 'Money in your hand. He knows the terms.' },
        { code: 'friend', label: 'Welcome him, ask for nothing', hint: 'Goodwill now. A favour owed to you later.' },
        { code: 'no', label: 'Tell him this street is closed', hint: 'He goes elsewhere. Nobody gains anything.' },
      ],
      data: { what: 'sit_life', life: 'newcomer' },
    });
  }
}
function lifeChoose(w: World, p: Character, e: Enc, code: string): string[] {
  const life = e.data?.life;
  const c = e.data?.who ? w.chars[String(e.data.who)] : undefined;
  if (life === 'wedding' && c?.alive) {
    const r = rel(c, p.id);
    if (code === 'skip') { feelOn(w, r, 'trust', -0.05); feelOn(w, r, 'respect', -0.04); return [`${first(c)} says it’s no problem. It’s a problem.`]; }
    const amt = code === 'big' ? 300 : 100;
    if (p.cash < amt) return ['You can’t cover it right now. You send your regrets, and your embarrassment goes with them.'];
    p.cash -= amt; post(w, { from: p.id, to: c.id, amt, flow: 'gift', note: 'wedding envelope' });
    feelOn(w, r, 'trust', (code === 'big' ? 0.12 : 0.05)); feelOn(w, r, 'affection', (code === 'big' ? 0.08 : 0.03));
    repute(w, p, (code === 'big' ? 1 : 0.3), 'generous');
    if (code === 'big') addFavour(w, p.id, c.id, 1, 'a generous wedding gift');
    addFact(w, { kind: 'favour', actor: p.id, victim: c.id, minor: true, text: `${p.name} went to the wedding of ${c.name}’s daughter.`, district: c.district }, { witnesses: [p.id, c.id] });
    return [code === 'big' ? `You hand over the envelope and half the room sees how thick it is. ${first(c)} embraces you. You eat well and you leave early.` : `You eat, you dance once, you give a correct envelope. Nobody is offended.`];
  }
  if (life === 'rate' && c?.alive) {
    const r = rel(c, p.id);
    if (code === 'agree') { c.kickRate = Math.max(0.05, c.kickRate - 0.05); feelOn(w, r, 'trust', 0.1); feelOn(w, r, 'affection', 0.06); { const o = lineOf(w, c); if (o) o.level = Math.min(3, (o.level ?? 1) + (w.rng.chance(0.3) ? 1 : 0)); } return [`${first(c)} shakes your hand. "You won't regret it." From now on he passes up ${Math.round(c.kickRate * 100)}%.`]; }
    if (code === 'counter') { c.kickRate = Math.max(0.05, c.kickRate - 0.02); feelOn(w, r, 'trust', 0.04); return [`"Fine," says ${first(c)}. He passes up ${Math.round(c.kickRate * 100)}% from now on.`]; }
    feelOn(w, r, 'trust', -0.04); feelOn(w, r, 'respect', -0.02);
    return [`${first(c)} nods and says that’s fine. He doesn’t say it’s fine.`];
  }
  if (life === 'robbed') {
    const b = w.biz[String(e.data?.biz)]; const o = b ? w.chars[b.ownerId] : undefined;
    if (!b || !o) return ['It turns out to be nothing.'];
    const r = rel(o, p.id);
    if (code === 'hunt') {
      if (p.cash < 200) return ['You can’t spare the money to look properly.'];
      p.cash -= 200; feelOn(w, r, 'trust', 0.1); repute(w, p, 1.5, 'generous');
      addFact(w, { kind: 'favour', actor: p.id, victim: o.id, business: b.id, minor: false, text: `${p.name} found the men who robbed ${b.name}.`, district: b.district }, { witnesses: [p.id, o.id] });
      return [`Two days later the men who hit ${b.name} are found. The register comes back. They don’t. ${first(o)} sends you a case of wine.`];
    }
    if (code === 'waive') { clearArrears(b); feelOn(w, r, 'trust', 0.12); feelOn(w, r, 'affection', 0.05); if (b.protection) { b.protection.fee = Math.max(10, Math.round(b.protection.fee * 0.9 / 5) * 5); } return [`You tell ${first(o)} to keep his fee this month. He nearly cries. It will cost you about ${money(b.protection?.fee ?? 0)} a week less from now on.`]; }
    feelOn(w, r, 'trust', -0.1); feelOn(w, r, 'respect', -0.08); repute(w, p, -1, 'hard');
    return [`"Sorry for your trouble." ${first(o)} pays up on Friday, in cash, not looking at you.`];
  }
  if (life === 'cop') {
    if (code === 'pay') { if (p.cash < 300) return ['You haven’t got it on you. He leaves, unhappy.']; p.cash -= 300; p.heat = clamp(p.heat - 0.08, 0, 1); return ['The envelope disappears into the raincoat. "Be seeing you," he says, which isn’t reassuring.']; }
    if (code === 'feed') {
      const victim = Object.values(w.chars).filter((x) => x.alive && !x.isPlayer && x.familyId && x.familyId !== p.familyId && x.rank !== 'civilian')[0];
      p.heat = clamp(p.heat - 0.12, 0, 1);
      if (victim) { victim.heat = clamp(victim.heat + 0.2, 0, 1); addFact(w, { kind: 'report', actor: p.id, victim: victim.id, minor: true, text: `Someone gave the police ${victim.name}’s name.`, district: victim.district }, { witnesses: [] }); }
      if (w.rng.chance(0.25)) { repute(w, p, -6, 'informer'); return [`You give him ${victim?.name ?? 'a name'}. It works. Then somebody sees you getting into the same car as the man in the raincoat. Within days people look at you differently.`]; }
      return [`You give him ${victim?.name ?? 'a name'}. He writes it down without thanking you. Your heat falls, and so does something else.`];
    }
    p.heat = clamp(p.heat + 0.1, 0, 1); repute(w, p, 1, 'informer');
    return ['You leave your coffee and your silence. Within the week you hear that he asked about you. It gets round that he got nothing.'];
  }
  if (life === 'defect' && c?.alive) {
    const r = rel(c, p.id);
    if (code === 'raise') { c.kickRate = Math.max(0.05, c.kickRate - 0.05); feelOn(w, r, 'trust', 0.15); feelOn(w, r, 'affection', 0.08); return [`${first(c)} thanks you and doesn’t mention it again. He keeps a bit more of what he makes, and he stays.`]; }
    if (code === 'trust') {
      if (w.rng.chance(0.3 + r.trust * 0.5)) { feelOn(w, r, 'trust', 0.2); return [`${first(c)} looks at you for a long moment. "Then I’m staying." It costs you nothing, and it’s the strongest thing you could have done.`]; }
      leaveCrew(w, c, String(e.data?.fam)); bearOn(w, r, 0.1, `${p.name} let him go`);
      return [`${first(c)} thanks you for your trust. A week later he’s gone, working for ${w.fam[String(e.data?.fam)]?.name ?? 'another family'}.`];
    }
    if (w.rng.chance(0.5)) { feelOn(w, r, 'respect', 0.1); feelOn(w, r, 'trust', -0.05); return [`"Yes, boss." You can’t tell if he means it, but he stays.`]; }
    leaveCrew(w, c, String(e.data?.fam)); bearOn(w, r, 0.2, `${p.name} let him go`);
    return [`${first(c)} looks at you and nods slowly. A week later he’s gone. You told him he was yours; he didn’t like hearing it.`];
  }
  if (life === 'newcomer') {
    if (code === 'tax') { p.cash += 400; post(w, { from: 'world', to: p.id, amt: 400, flow: 'earn', src: 'cut' }); p.lifetimeGross = (p.lifetimeGross ?? 0) + 400; return ['"Understood," he says, counting it into your hand. The first of many envelopes, if he lasts.']; }
    if (code === 'friend') { repute(w, p, 0.5, 'friend'); const stranger = Object.values(w.chars).find((x) => x.alive && x.rank === 'civilian' && !x.familyId); if (stranger) addFavour(w, p.id, stranger.id, 1, 'let him open without a tax'); return ['You shake his hand. He looks like a man who will remember it.']; }
    return ['"A pity," he says, and leaves. Somebody else’s street will get his money.'];
  }
  return ['Nothing comes of it.'];
}

export function pulseWeek(w: World) {
  const p = PL(w);
  if (!p?.alive) return;
  motiveTick(w);
  ambientWeek(w);
  turfStart(w, p);
  for (const s of (w.situations ??= [])) if (s.kind === 'turf' && s.stage !== 'resolved') turfAdvance(w, p, s);
  orgOffer(w, p);
  lifeOffer(w, p);

}
export function pulseChoose(w: World, p: Character, e: Enc, code: string): string[] | undefined {
  if (e.data?.what === 'sit_turf') return turfChoose(w, p, e, code);
  if (e.data?.what === 'sit_org') return orgChoose(w, p, e, code);
  if (e.data?.what === 'sit_life') return lifeChoose(w, p, e, code);
  return undefined;
}
void DAY;
