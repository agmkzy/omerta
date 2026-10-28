// Hearings (The Family, October 2026): one man says another has wronged him or the family, and somebody above them has to find out
// what happened and decide. The truth is the simulation's (`truth`), and nobody is shown it: the man who decides learns what he learns
// by hearing each side, pressing them, going through the books, asking the men around them, or sending someone he trusts to look
// into it; every one of those can mislead him, because the men in it have their own interests. Meanwhile it does not wait: the
// accused may come to him privately, lean on the men who know, or the accuser may lose patience and settle it himself.
//
// The same matter is a different job by where the player stands (the owner's rule that ranks have different processes):
//   captain      it is his crew; he investigates and rules, and the crew watches whether his rulings are fair
//   underboss    it is between men of different crews, or a captain is accused; he rules on the boss's authority, and the man he
//                rules against can go over his head to the boss, who may overturn him
//   consigliere  the boss has asked him to find out; he gathers testimony and weighs it, may bring the two to a settlement, and in the
//                end advises; the boss decides, and when the truth comes out the boss remembers whose advice it was
//   boss         a captain is accused; he hears it himself or sends his consigliere, and whatever he decides the family reads
import { temper } from './temper';
import { addFact, bear, clamp, ease, feel, money, peek } from './core';
import { addEnc } from './encounters';
import { closeSit, isOpen, know, spawn, tell, registerStep } from './situ';
import { MATTERS, confront, type Opt } from './matters';
import { noteRuling, positionOf } from './standing';
import { leaveCrew } from './rank';
import { heardAgainst, seesLifeOf, signsOf } from './conv/notice';
import { DAY, WEEK, type Character, type Id, type Situation, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const live = (w: World, id?: string | number | null) => { const c = id ? w.chars[String(id)] : undefined; return c?.alive ? c : undefined; };
const role = (s: Situation, r: string) => (s.parties ?? []).find((p) => p.role === r)?.id;
const M = (s: Situation) => (s.m ??= {});
const num = (s: Situation, k: string) => Number(s.m?.[k] ?? 0);
const sits = (w: World) => (w.situations ??= []);
const P = (w: World) => (w.playerId ? w.chars[w.playerId] : undefined);
const guilty = (s: Situation) => s.truth === 'guilty';
const CHARGE: Record<string, (b: string) => string> = {
  envelope: (b) => `${b} has been holding out on his envelope`,
  took: (b) => `${b} took money that was the crew’s`,
  talk: (b) => `${b} has been talking about the family’s business where he shouldn’t`,
};
// what the player has learned, in order: plain sentences kept on the matter (bounded)
const note = (s: Situation, text: string) => { const n = num(s, 'nn'); M(s)['n' + (n % 8)] = text; M(s).nn = n + 1; };
export const notesOf = (s: Situation): string[] => { const n = num(s, 'nn'), out: string[] = []; for (let i = Math.max(0, n - 8); i < n; i++) out.push(String(s.m?.['n' + (i % 8)] ?? '')); return out.filter(Boolean); };

// ------------------------------------------------------------------------------------------------ who hears it, by where they stand
type Seat = 'judge' | 'inq';
export function seatIn(w: World, s: Situation, p: Character): Seat | undefined {
  if (role(s, 'judge') === p.id) return 'judge';
  if (role(s, 'inq') === p.id) return 'inq';
  return undefined;
}
const crewOf = (w: World, c: Character) => Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id && !x.isPlayer);
// every man below c, at any depth
function below(w: World, c: Character): Character[] {
  const out: Character[] = [], seen = new Set<Id>([c.id]);
  let q = crewOf(w, c);
  for (let d = 0; d < 4 && q.length; d++) { const nx: Character[] = []; for (const x of q) if (!seen.has(x.id)) { seen.add(x.id); out.push(x); nx.push(...crewOf(w, x)); } q = nx; }
  return out;
}

// ------------------------------------------------------------------------------------------------ how a hearing starts
// From what is really going on: a man who is in fact holding out, noticed by one who works beside him; or a man with a grudge and the
// ambition to use it, who makes a charge that isn't true. Once a week, rarely, for the player's own people (and, for a consigliere,
// for the boss's).
export function hearingWeek(w: World) {
  const p = P(w);
  if (!p?.alive || !p.familyId) return;
  if (sits(w).some((s) => s.kind === 'hearing' && isOpen(s))) return;
  if ((w.sitcool?.['hearing:' + p.id] ?? 0) > w.now) return;
  const f = w.fam[p.familyId], boss = live(w, f.bossId), pos = positionOf(w, p);
  let pool: Character[] = [], judge: Character | undefined = p, inq: Character | undefined;
  if (pos === 'consigliere') { if (!boss || boss.isPlayer) return; pool = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id && (c.rank === 'capo' || c.rank === 'soldier') && !c.isPlayer); judge = boss; inq = p; }
  else if (pos === 'boss' || pos === 'acting boss') pool = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id && c.rank === 'capo');
  else if (pos === 'underboss' || pos === 'captain') pool = below(w, p).filter((c) => c.rank !== 'civilian');
  else return;
  if (pool.length < 2 || !w.rng.chance(0.4)) return;
  // the accused: a man actually holding out (truth: guilty), or one somebody has it in for (truth: not)
  const holding = pool.filter((c) => c.books.skim || c.books.hide || c.books.arrears > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  // for the boss and his consigliere, two more ways it starts: a captain whose crew's money has fallen off (holding out, or only a bad
  // month), and a man in the family the police seem to know too much about (the informant, or a man who only looks like one)
  if (inq || pos === 'boss' || pos === 'acting boss') {
    const ub = Object.values(w.chars).find((c) => c.alive && c.familyId === f.id && c.rank === 'underboss' && !c.isPlayer);
    const fell = pool.filter((c) => c.rank === 'capo').map((c) => { const h = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id).map((x) => x.books.history.slice(-6)); const now = h.reduce((a, x) => a + x.slice(-2).reduce((b, y) => b + y.paid, 0), 0), was = h.reduce((a, x) => a + x.slice(0, 3).reduce((b, y) => b + y.paid, 0), 0) / 1.5; return { c, d: was > 150 ? now / was : 1 }; }).filter((x) => x.d < 0.75).sort((a, b) => a.d - b.d)[0];
    const informer = Object.values(w.chars).find((c) => c.alive && c.familyId === f.id && c.informant && !c.informant.exposed && !c.isPlayer);
    const looks = pool.filter((c) => c.id !== informer?.id && c.jailedUntil > w.now - 60 * DAY && c.jailedUntil > 0).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    const accuser = ub ?? pool.find((c) => c.rank === 'capo');
    if (accuser && w.rng.chance(0.5) && (informer || looks)) {
      const truth2 = informer && (!looks || w.rng.chance(0.5)) ? 'guilty' : 'false', who = truth2 === 'guilty' ? informer! : looks!;
      if (who.id !== accuser.id) return open(w, p, accuser, who, judge!, inq, truth2, 'talk');
    }
    if (accuser && fell && fell.c.id !== accuser.id) return open(w, p, accuser, fell.c, judge!, inq, fell.c.books.skim || fell.c.books.hide ? 'guilty' : 'false', 'envelope');
  }
  const grudges: [Character, Character][] = [];
  for (const a of pool) for (const b of pool) if (a.id !== b.id && peek(a, b.id).grudge > 0.3 && (a.traits.ambition > 0.5 || temper(a).empathy < 0.4)) grudges.push([a, b]);
  let acc: Character | undefined, def: Character | undefined, truth: 'guilty' | 'false';
  if (holding.length && (!grudges.length || w.rng.chance(0.6))) {
    def = w.rng.pick(holding);
    // who would notice: a man of the same crew, or one who works his places, who doesn't love him
    acc = pool.filter((c) => c.id !== def!.id && (c.bossId === def!.bossId || c.bossId === def!.id || def!.bossId === c.id) && peek(c, def!.id).affection < 0.5).sort((a, b) => peek(b, def!.id).grudge - peek(a, def!.id).grudge || (a.id < b.id ? -1 : 1))[0];
    truth = 'guilty';
  } else if (grudges.length) { [acc, def] = w.rng.pick(grudges); truth = 'false'; } else return;
  if (!acc || !def || !judge) return;
  open(w, p, acc, def, judge, inq, truth, def.rank === 'capo' ? 'envelope' : w.rng.pick(['envelope', 'took', 'envelope']));
}
function open(w: World, p: Character, acc: Character, def: Character, judge: Character, inq: Character | undefined, truth: 'guilty' | 'false', charge: string) {
  const amt = Math.max(150, Math.round((def.books.arrears || def.books.history.at(-1)?.due || 200) * w.rng.range(1.5, 3) / 10) * 10);
  const parties = [{ id: acc.id, role: 'acc' }, { id: def.id, role: 'def' }, { id: judge.id, role: 'judge' }, ...(inq ? [{ id: inq.id, role: 'inq' }] : [])];
  const s = spawn(w, 'hearing', `hearing:${def.id}`, p.id, { cause: CHARGE[charge](def.name), parties, sev: 0.45, phase: 'brought', next: w.now + 3 * DAY, orgs: [p.familyId!], truth, amt, m: { charge, nn: 0 } });
  if (!s) return;
  s.stage = 'handling';
  know(w, s, p.id, 2, 'brought to him'); know(w, s, acc.id, 2, 'his charge'); know(w, s, def.id, truth === 'guilty' ? 2 : 1, 'self');
  (w.sitcool ??= {})['hearing:' + p.id] = w.now + 3 * WEEK;
  const lines = inq
    ? [`${first(judge)} keeps you back after the others have gone. “${acc.name} came to me. He says ${CHARGE[charge](def.name).replace(def.name, first(def))}. ${def.rank === 'capo' ? 'A captain. ' : ''}I want to know what’s true before I do anything. Find out for me.”`]
    : [`${first(acc)} asks for a word in private. “${CHARGE[charge](def.name)}. ${truth === 'guilty' ? `I’ve seen it with my own eyes.` : `Everybody knows it, they just won’t say.`} I’m telling you because it’s yours to deal with.”`];
  tell(w, s, `${acc.name} told ${(inq ? judge : p).name} that ${CHARGE[charge](def.name)}.`, { actor: acc.id, victim: def.id, witnesses: [p.id, acc.id, ...(inq ? [judge.id] : [])], minor: true });
  addEnc(w, { kind: 'matter', from: (inq ? judge : acc).id, title: inq ? `${first(judge)} wants it looked into` : `${first(acc)} has a charge to make`, days: 4, lines,
    opts: inq ? [{ code: 'look', label: '“Leave it with me.”', hint: 'Find out what happened, and bring him what you find.' }] : [
      { code: 'look', label: '“I’ll look into it.”', hint: 'Find out what happened before you decide anything.' },
      { code: 'now', label: `“Bring ${first(def)} here. We settle it now.”`, hint: 'Hear them both now and rule on what you hear.' },
      { code: 'drop', label: '“Settle it between yourselves.”', hint: 'It isn’t worth your time. He may not agree.' },
    ], data: { sit: s.id, what: 'open' } });
}

// ------------------------------------------------------------------------------------------------ what each move finds
// What the man accused tells you to your face: admits only if it's true and he's the kind to, otherwise denies (or squares up).
function hearDef(w: World, s: Situation, p: Character, def: Character): string[] {
  const r = confront(w, s, p, def, guilty(s));
  M(s).heardDef = 1;
  if (r === 'admit') { M(s).admit = 1; note(s, `${first(def)} admitted it to you.`); return [`${first(def)} looks at the floor a long time. “It was a bad month. I meant to put it back.”`]; }
  const an = first(w.chars[role(s, 'acc')!]);
  if (r === 'defy') { note(s, `${first(def)} wouldn’t answer you; he called it an insult.`); return [w.rng.pick([`${first(def)} goes red. “You’re asking me that? On ${an}’s word?”`, `${first(def)} gets up. “I don’t have to sit here for this.”`, `“${an} said that?” ${first(def)} laughs, and there is nothing in it. “Then ask ${an} where he was in March.”`])]; }
  note(s, `${first(def)} denies it${guilty(s) ? '' : ', and he seemed steady'}.`);
  return [guilty(s) && temper(def).caution < 0.45 ? `“Never,” ${first(def)} says, too quickly.` : `“Never,” ${first(def)} says. “Ask anybody. Ask him what he’s really after.”`];
}
function hearAcc(w: World, s: Situation, p: Character, acc: Character): string[] {
  const def = w.chars[role(s, 'def')!];
  M(s).heardAcc = 1;
  if (s.m?.charge === 'talk') { note(s, guilty(s) ? `${first(acc)} says the police knew about a meeting only a few men knew of, and ${first(def)} was one.` : `${first(acc)} says ${first(def)} came out of a cell sooner than he should have.`); return [guilty(s) ? `${first(acc)}: “The police knew about the meeting at the Ravenite. Six men knew. He was one, and he’s been seen with a man in a grey suit.”` : `${first(acc)}: “He was inside, and he came out quick. Too quick. Men who come out quick have usually said something.”`]; }
  if (guilty(s)) { note(s, `${first(acc)} gave you particulars: which weeks, and how much.`); return [`${first(acc)} gives you particulars: the weeks, the places, what came in and what went up. ${money(s.amt ?? 0)}, near enough.`]; }
  note(s, `${first(acc)}’s account is general: what everybody says, not what he saw.`);
  return [`${first(acc)} talks for a while about ${first(def)}: the car he drives, what people say. When you ask what he saw himself, it is less.`];
}
// pressing the accuser: an honest man holds; a liar may slip, by his nerve against yours
function pressAcc(w: World, s: Situation, p: Character, acc: Character): string[] {
  M(s).pressed = 1;
  if (guilty(s)) { note(s, `Pressed, ${first(acc)} held to every detail.`); return [`You push him on every detail. He doesn’t move off one of them.`]; }
  const slips = w.rng.chance(clamp(0.45 + p.skills.brains * 0.25 - temper(acc).caution * 0.3, 0.15, 0.8));
  if (slips) { M(s).slip = 1; note(s, `Pressed, ${first(acc)}’s story changed: the week he named, he was in Atlantic City.`); bear(w, acc, p.id, 0.04, 'pressed hard on his word'); return [`You take him through it again. The week he names, he was in Atlantic City; he corrects himself, then corrects that.`]; }
  note(s, `Pressed, ${first(acc)} didn’t give anything away.`);
  return [`He takes it calmly. Either it is true or he is a better liar than most.`];
}
// the numbers: what the books show, which is what is true for money, and says nothing about anything else
function readBooks(w: World, s: Situation, p: Character, def: Character): string[] {
  M(s).books = 1;
  const h = def.books.history.slice(-6);
  const short = h.filter((x) => x.due > 0 && x.paid < x.due * 0.9).length;
  if (s.m?.charge === 'talk') { note(s, 'The books say nothing either way: this isn’t about money.'); return ['You go through his numbers. They are what they are; this isn’t about money.']; }
  if (guilty(s) && (def.books.skim || def.books.hide || short >= 1 || def.books.arrears > 0)) { M(s).bookSays = 1; note(s, `His numbers don’t add up: ${short ? `${short} light ${short === 1 ? 'week' : 'weeks'} lately` : 'what he declares is less than what his places do'}.`); return [`You sit with his numbers for an hour. They don’t add up: ${short ? `${short} light ${short === 1 ? 'week' : 'weeks'}` : 'his places do better than he says they do'}.`]; }
  if (guilty(s)) { note(s, 'His numbers look clean. If he took it, he took it carefully.'); return ['You go through his numbers. They look clean. If he took it, he was careful.']; }
  M(s).bookSays = -1; note(s, 'His numbers hold up, week by week.'); return ['You go through his numbers, week by week. They hold up.'];
}
// asking around: men who know something tell it if they trust you and aren't his friends; a man who has been paid or frightened
// stays quiet; men who know the accuser's grudge mention it
function askAround(w: World, s: Situation, p: Character): string[] {
  M(s).around = 1;
  const acc = w.chars[role(s, 'acc')!], def = w.chars[role(s, 'def')!];
  const men = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.id !== acc.id && c.id !== def.id && c.familyId === def.familyId && (c.bossId === def.bossId || c.bossId === def.id || c.bossId === acc.bossId)).slice(0, 6);
  const talk = men.filter((c) => peek(c, p.id).trust >= 0.3 && peek(c, def.id).affection < 0.5 && !num(s, 'hush:' + c.id));
  const quiet = men.filter((c) => num(s, 'hush:' + c.id));
  const out: string[] = [];
  if (!talk.length) { note(s, 'Nobody around them would say anything to you.'); return ['Nobody will say anything. Whether that is loyalty or fear, you can’t tell.']; }
  const c = talk[0];
  // (what he can say is what he has seen: how the accused lives, or what has passed between the two men in front of him)
  const flush = signsOf(w, c, def).includes('flush'), bad = heardAgainst(w, c, acc, def);
  if (flush) { M(s).around = 2; note(s, `${first(c)} told you ${first(def)} has been spending more than his envelopes explain.`); out.push(`${first(c)}, after a while: “He’s been flush. Flusher than his envelopes, if you ask me. I didn’t say that.”`); }
  else if (bad || peek(acc, def.id).grudge > 0.3 && seesLifeOf(w, c, acc)) { M(s).around = -1; note(s, `${first(c)} told you ${first(acc)} has had it in for ${first(def)}${bad ? `: he saw it himself` : ''}.`); out.push(`${first(c)} shrugs. “${first(acc)}’s had it in for him a long time. ${bad ? 'I’ve seen it.' : 'Everybody around them knows it.'}”`); }
  else { note(s, `${first(c)} didn’t know anything about it.`); out.push(`${first(c)} doesn’t know anything about it, and seems to mean it.`); }
  if (quiet.length) { note(s, `${first(quiet[0])} wouldn’t meet your eye.`); out.push(`${first(quiet[0])} won’t meet your eye.`); }
  if (w.rng.chance(0.35)) { know(w, s, def.id, 2, 'heard he was asking'); M(s).defHeard = 1; }
  return out;
}
// sending a man to look into it: he comes back in a few days with what he makes of it, coloured by whom he likes and how sharp he is
const DELEGATE = 'lt';
function delegateTo(w: World, s: Situation, p: Character, m: Character): string[] {
  (s.parties ??= []).push({ id: m.id, role: DELEGATE });
  M(s).ltDue = w.now + w.rng.int(2, 3) * DAY;
  return [`${first(m)} nods. “Give me a couple of days.”`];
}
function delegateReport(w: World, s: Situation, p: Character, m: Character) {
  const acc = w.chars[role(s, 'acc')!], def = w.chars[role(s, 'def')!];
  const lean = peek(m, def.id).affection + peek(m, def.id).trust - peek(m, acc.id).affection - peek(m, acc.id).trust; // >0: favours the accused
  const sharp = m.skills.brains * 0.6 + 0.3;
  const right = w.rng.chance(clamp(sharp - Math.abs(lean) * 0.4, 0.2, 0.9));
  const says = right ? guilty(s) : lean > 0 ? false : true;
  M(s).ltSays = says ? 1 : -1; delete s.m!.ltDue;
  note(s, `${first(m)} looked into it and says ${says ? `${first(def)} did it` : `there’s nothing in it`}.`);
  addEnc(w, { kind: 'matter', from: m.id, title: `${first(m)} has looked into it`, days: 3, lines: [says ? `${first(m)} sits down. “He did it. ${first(def)}. Not much doubt.”` : `${first(m)} sits down. “I don’t think there’s anything in it. ${first(acc)} has his reasons.”`], opts: [{ code: 'ok', label: '“All right.”', hint: 'You have his word on it. It is his word.' }], data: { sit: s.id, what: 'report' } });
}
const delegates = (w: World, s: Situation, p: Character): Character[] => {
  const f = w.fam[p.familyId!], acc = role(s, 'acc'), def = role(s, 'def');
  const pool = positionOf(w, p) === 'boss' && f.consigliere && live(w, f.consigliere) ? [w.chars[f.consigliere]] : crewOf(w, p).filter((c) => c.rank !== 'civilian').sort((a, b) => peek(p, b.id).trust - peek(p, a.id).trust);
  return pool.filter((c) => c.id !== acc && c.id !== def && c.jailedUntil <= w.now).slice(0, 2);
};

// ------------------------------------------------------------------------------------------------ deciding
// The judge rules; what follows is by what was actually true. The men who knew the truth judge the ruling as soon as they hear it.
type Ruling = 'guilty' | 'out' | 'false' | 'none' | 'down';
function rule(w: World, s: Situation, j: Character, r: Ruling, by?: { advice?: string }): string[] {
  const acc = w.chars[role(s, 'acc')!], def = w.chars[role(s, 'def')!];
  const right = r === 'none' ? undefined : (r === 'false') === !guilty(s);
  const lines: string[] = [];
  const crew = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === def.familyId && (c.bossId === def.bossId || c.bossId === j.id || c.bossId === def.id) && c.id !== acc.id && c.id !== def.id).slice(0, 8);
  const knew = crew.filter((c) => !!s.k?.[c.id] || peek(c, def.id).trust > 0.5 || peek(c, acc.id).trust > 0.5);
  if (r === 'guilty' || r === 'out' || r === 'down') {
    const pay = s.m?.charge === 'talk' ? 0 : Math.min(def.cash, s.amt ?? 0);
    if (s.m?.charge === 'talk' && def.informant) def.informant.exposed = true; // (found out: what he could still tell them dries up)
    def.cash -= pay; (j.isPlayer ? j : acc).cash += pay;
    bear(w, def, j.id, right ? 0.15 : 0.45, right ? `${j.name} made him pay back what he took` : `${j.name} found against him on ${acc.name}’s lie`);
    if (!right) { feel(w, def, j.id, 'trust', -0.2); for (const c of crew) if (peek(c, def.id).affection > 0.3) feel(w, c, j.id, 'trust', -0.06, `${j.name} believed a lie about ${def.name}`); }
    if (r === 'out' && def.bossId) { leaveCrew(w, def); lines.push(`${first(def)} is out of the crew.`); }
    if (r === 'down' && def.rank === 'capo') lines.push(`${first(def)}’s crew is no longer his to run.`);
    if (def.books.skim) delete def.books.skim;
    // the man who put his name forward is remembered for it, when it was true (conv/acts/family putName)
    { const v = def.backer ? w.chars[def.backer] : undefined; if (right && v?.alive && v.id !== j.id) feel(w, j, v.id, 'trust', -0.04, `${v.name} put ${def.name}’s name forward`); }
    // he paid the man deciding, and was found against anyway: he says so, to the men who matter
    if (num(s, 'took') && j.isPlayer) { bear(w, def, j.id, 0.3, `${j.name} took his money and ruled against him anyway`); addFact(w, { kind: 'rumour', actor: j.id, victim: def.id, minor: false, text: `${def.name} is telling people ${j.name} took an envelope from him while he was deciding about him.`, district: def.district }, { witnesses: crew.slice(0, 4).map((c) => c.id) }); for (const c of crew.slice(0, 4)) feel(w, c, j.id, 'trust', -0.06, `${j.name} takes envelopes from men he is judging`); lines.push(`${first(def)} won’t keep quiet about the envelope.`); }
    lines.push(s.m?.charge === 'talk' ? `Nobody tells ${first(def)} anything from now on. Whatever happens to him next is the boss’s business.` : `${first(def)} pays back ${money(pay)}${pay < (s.amt ?? 0) ? ', all he has on him' : ''}.`);
  } else if (r === 'false') {
    bear(w, acc, j.id, right ? 0.08 : 0.3, right ? `${j.name} called him a liar in front of the crew` : `${j.name} wouldn’t believe him`);
    feel(w, def, j.id, 'trust', right ? 0.08 : 0.02);
    if (right) { feel(w, acc, j.id, 'respect', 0.03); for (const c of crew) feel(w, c, acc.id, 'trust', -0.05, `${acc.name} made a false charge against ${def.name}`); }
    else if (guilty(s)) { def.books.skim = { until: w.now + 6 * WEEK, frac: Math.max(def.books.skim?.frac ?? 0, 0.15) }; lines.push(`${first(def)} walks out a free man, and lighter on his conscience than he should be.`); }
    lines.push(`${first(acc)} has to swallow it.`);
  } else { bear(w, acc, j.id, 0.06, `${j.name} wouldn’t decide`); lines.push('Nothing is decided. Both of them take that badly, in different ways.'); }
  // the men who knew: a fair ruling is respected, a wrong one is remembered
  if (right !== undefined) for (const c of knew) feel(w, c, j.id, 'respect', right ? 0.03 : -0.05, right ? `${j.name} got it right about ${def.name}` : `${j.name} got it wrong about ${def.name}`);
  if (j.isPlayer) noteRuling(j);
  tell(w, s, `${j.name} ruled on ${acc.name}’s charge against ${def.name}: ${r === 'false' ? 'no case, and the charge was false' : r === 'none' ? 'no finding' : r === 'out' ? 'guilty, and out of the crew' : r === 'down' ? 'guilty, and his crew taken from him' : 'guilty, and he pays it back'}.`, { actor: j.id, victim: def.id, witnesses: [acc.id, def.id, j.id, ...(by?.advice ? [role(s, 'inq')!] : []), ...crew.map((c) => c.id)].filter(Boolean), minor: false, kind: 'ruling' });
  closeSit(w, s, r === 'none' ? 'no finding' : r === 'false' ? 'the charge thrown out' : 'found against him', [right === undefined ? 'nobody satisfied' : right ? 'the men who knew think it was fair' : 'the men who knew think it was wrong'], 6);
  M(s).ruled = r; M(s).right = right === undefined ? 0 : right ? 1 : -1;
  return lines;
}
// the consigliere's advice, taken or not by a boss who has his own view; when the truth comes out later he remembers whose advice it was
// What the consigliere can point to, as the boss would weigh it: the books, an admission, what a man said he saw, an accuser whose story
// changed, what the man sent to look made of it. Positive leans to guilt. (The truth is not in here: only what was found.)
function weightOf(s: Situation): number {
  return (num(s, 'admit') ? 0.6 : 0) + (num(s, 'bookSays') === 1 ? 0.35 : num(s, 'bookSays') === -1 ? -0.35 : 0) + (num(s, 'around') === 2 ? 0.2 : num(s, 'around') === -1 ? -0.2 : 0) + (num(s, 'slip') ? -0.35 : 0) + num(s, 'ltSays') * 0.15;
}
// The boss weighs the consigliere's advice: how far he trusts him, what he can point to, how the boss himself stands with the two men,
// how much is at stake, and his temper. He may take it, ask what it rests on, decide against it, or keep it to think over and decide
// later on his own. He is a man deciding, not an instrument of the advice. (Invariant F.)
function advise(w: World, s: Situation, p: Character, advice: 'guilty' | 'false' | 'unsure', pressed?: 'show' | 'insist'): string[] {
  const boss = w.chars[role(s, 'judge')!], acc = w.chars[role(s, 'acc')!], def = w.chars[role(s, 'def')!], tp = temper(boss);
  const trustCon = peek(boss, p.id).trust, lean = peek(boss, def.id).trust + peek(boss, def.id).affection * 0.5 - peek(boss, acc.id).trust; // >0: he is on the accused's side
  const e = weightOf(s), serious = s.m?.charge === 'talk' || def.rank === 'capo' ? 0.2 : 0;
  const B = first(boss), D = first(def), A = first(acc);
  M(s).advice = advice;
  const decide = (r: Ruling, said: string) => { const lines = [said, ...rule(w, s, boss, r, { advice })]; remember(); return lines; };
  const remember = () => {
    const right = advice === 'unsure' ? 0 : (advice === 'false') === !guilty(s) ? 1 : -1;
    M(s).adv = right;
    if (right !== 0) (w.pending ??= []).push({ id: 'p' + w.nextId++, due: w.now + w.rng.int(3, 8) * WEEK, kind: 'advice', a: boss.id, b: p.id, note: right > 0 ? 'right' : 'wrong', c: def.id });
  };
  if (advice === 'unsure') {
    const own = e - lean;
    if (Math.abs(own) < 0.15) { M(s).postAt = w.now + w.rng.int(3, 6) * DAY; s.next = Math.min(s.next ?? 1e12, M(s).postAt as number); return [`${B} rubs his eyes. “Then I’ll sleep on it.” He doesn’t say when he’ll decide.`]; }
    return decide(own > 0 ? 'guilty' : 'false', `${B} doesn’t like “I don’t know.” “Then I’ll decide it myself.”`);
  }
  const toward = advice === 'guilty' ? 1 : -1;
  let support = trustCon * 0.6 + toward * e * 0.6 - toward * lean * 0.5 - serious + tp.volatility * 0.1 - tp.caution * 0.1;
  if (pressed === 'show') support += toward * e * 0.5;          // (what you found, laid out: it counts as far as it goes)
  if (pressed === 'insist') support += trustCon * 0.3 - 0.1;    // (your word: it counts as far as he trusts it)
  const verdict: Ruling = advice === 'guilty' ? 'guilty' : 'false';
  if (support > 0.45) return decide(verdict, advice === 'guilty'
    ? (lean > 0.2 ? `${B} is quiet a long time. “I’ve known ${D} a long time. All right. If you say so.”` : `${B} nods. “I thought as much.”`)
    : (lean < -0.2 ? `${B} frowns. “I’d have bet on it the other way. All right. ${D} keeps his place.”` : `${B} nods. “Good. I didn’t want it to be him.”`));
  if (support > 0.15 && !pressed) {
    M(s).challenged = advice;
    return [advice === 'guilty' ? `${B} leans back. “You’re sure? ${D} has been with us a long time. What have you got?”` : `${B} isn’t convinced. “${A} doesn’t make things up for nothing. What makes you so sure?”`];
  }
  if (toward * lean > 0.25 || support < -0.1) return decide(advice === 'guilty' ? 'false' : 'guilty', advice === 'guilty' ? `${B} shakes his head. “No. Not ${D}. I don’t see it.”` : `${B} shakes his head. “No. I believe ${A}.”`);
  M(s).postAt = w.now + w.rng.int(3, 6) * DAY; s.next = Math.min(s.next ?? 1e12, M(s).postAt as number);
  return [`${B} looks at you a long time. “Leave it with me.” Whatever he decides, it won’t be tonight.`];
}
// a boss who said he'd think it over decides on his own: what was found, and how he stands with the two men
function decideLater(w: World, s: Situation) {
  const boss = w.chars[role(s, 'judge')!], def = w.chars[role(s, 'def')!], acc = w.chars[role(s, 'acc')!];
  const own = weightOf(s) - (peek(boss, def.id).trust - peek(boss, acc.id).trust) * 0.5;
  delete s.m!.postAt;
  rule(w, s, boss, own > 0.1 ? 'guilty' : own < -0.1 ? 'false' : 'none');
}
export function adviceDue(w: World, boss: Character, con: Character, right: boolean, def?: Character) {
  if (!boss.alive || !con.alive || !w.rng.chance(0.6)) return;
  feel(w, boss, con.id, 'trust', right ? 0.08 : -0.12, right ? `${con.name}’s advice about ${def?.name ?? 'a man'} was sound` : `${con.name} advised him wrong about ${def?.name ?? 'a man'}`);
  addFact(w, { kind: 'event', actor: boss.id, victim: con.id, minor: false, text: right ? `It came out that ${con.name} had read ${def?.name ?? 'the matter'} right. ${boss.name} remembered.` : `It came out that ${con.name} had read ${def?.name ?? 'the matter'} wrong. ${boss.name} remembered.`, district: boss.district }, { witnesses: [boss.id, con.id] });
}
// the underboss's ruling can be taken over his head: the man ruled against, if he thinks the boss will hear him, goes to him
function appeal(w: World, s: Situation, ub: Character): string[] {
  const f = w.fam[ub.familyId!], boss = live(w, f.bossId);
  const r = s.m?.ruled as Ruling | undefined, loser = r === 'false' || r === 'none' ? w.chars[role(s, 'acc')!] : w.chars[role(s, 'def')!];
  if (!boss || boss.isPlayer || !loser?.alive || !r) return [];
  const goes = peek(loser, ub.id).grudge > 0.2 && (loser.rank === 'capo' || peek(boss, loser.id).trust > 0.45) && temper(loser).pride > 0.4;
  if (!goes) return [];
  const overturn = peek(boss, loser.id).trust - peek(boss, ub.id).trust + (num(s, 'right') < 0 ? 0.2 : 0) > 0.1;
  addFact(w, { kind: 'ruling', actor: boss.id, victim: ub.id, minor: false, text: overturn ? `${loser.name} went over ${ub.name}’s head to ${boss.name}, and ${boss.name} overturned his ruling.` : `${loser.name} went over ${ub.name}’s head to ${boss.name}. ${boss.name} told him the underboss’s word stands.`, district: boss.district }, { witnesses: [boss.id, ub.id, loser.id] });
  if (overturn) { for (const c of Object.values(w.chars)) if (c.alive && c.familyId === f.id && c.rank === 'capo') feel(w, c, ub.id, 'respect', -0.04, `${boss.name} overturned ${ub.name}`); ease(loser, ub.id, -0.1); return [`${loser.name} went over your head to ${boss.name}, and ${boss.name} overturned you. The captains will have heard.`]; }
  feel(w, loser, boss.id, 'respect', 0.02); for (const c of Object.values(w.chars)) if (c.alive && c.familyId === f.id && c.rank === 'capo') feel(w, c, ub.id, 'respect', 0.02);
  return [`${loser.name} went over your head to ${boss.name}. ${boss.name} sent him back: your word stands.`];
}

// ------------------------------------------------------------------------------------------------ while it waits
// Every few days the people in it act: the accused, if he did it, comes privately or leans on the men who know; the accuser grows
// impatient, and in the end may settle it with his hands; the man sent to look comes back; a consigliere's boss wants an answer.
function step(w: World, s: Situation) {
  const acc = live(w, role(s, 'acc')), def = live(w, role(s, 'def')), j = live(w, role(s, 'judge')), p = P(w);
  if (!acc || !def || !j || !p) return closeSit(w, s, 'gone', ['one of them is gone'], 4);
  if (num(s, 'postAt') && num(s, 'postAt') <= w.now) return decideLater(w, s);
  const lt = live(w, role(s, DELEGATE));
  if (lt && num(s, 'ltDue') && num(s, 'ltDue') <= w.now) delegateReport(w, s, p, lt);
  const age = (w.now - s.since) / DAY;
  // the accused, if he did it and has heard he is being looked at: a quiet word with a witness, or with the man deciding
  if (guilty(s) && (num(s, 'defHeard') || num(s, 'heardDef')) && !num(s, 'approached') && def.cash > 150) {
    if (temper(def).caution > 0.5) {
      const wit = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.bossId === def.bossId && c.id !== def.id && c.id !== acc.id && !num(s, 'hush:' + c.id));
      if (wit) { const amt = Math.min(def.cash, 200); def.cash -= amt; wit.cash += amt; M(s)['hush:' + wit.id] = amt; tell(w, s, `${def.name} saw to it that ${wit.name} would keep his mouth shut.`, { actor: def.id, victim: wit.id, witnesses: [def.id, wit.id], minor: true }); }
    } else if (seatIn(w, s, p)) {
      M(s).approached = 1;
      const gift = Math.min(def.cash, Math.round((s.amt ?? 200) * 0.8 / 10) * 10);
      M(s).bribeAmt = gift;
      addEnc(w, { kind: 'matter', from: def.id, title: `${first(def)} wants a private word`, days: 3, lines: [`${first(def)} catches you alone. “Whatever ${first(acc)} told you, it’s not how it was. Look, I know you’ve got expenses.” He puts an envelope on the table: ${money(gift)}.`],
        opts: [{ code: 'take', label: 'Take the envelope', hint: 'Nobody else is in the room. He will know what you are.' }, { code: 'refuse', label: '“Put that away.”', hint: 'He tried to buy you. That says something, or he’s just scared.' }], data: { sit: s.id, what: 'bribe', amt: gift } });
    }
  }
  // the accuser waits, then doesn't
  if (age > 8 && !num(s, 'warned')) { M(s).warned = 1; bear(w, acc, def.id, 0.1, 'it still isn’t settled'); if (seatIn(w, s, p) === 'judge') addEnc(w, { kind: 'matter', from: acc.id, title: `${first(acc)} is still waiting`, days: 3, lines: [`${first(acc)} again. “It’s been a week. Is anything going to happen about ${first(def)}, or do I see to it myself?”`], opts: [{ code: 'wait', label: '“You’ll have my answer. Not yet.”', hint: 'He’ll wait a little longer. Not much.' }, { code: 'hands', label: '“Do what you have to.”', hint: 'You let him settle it his way. It won’t be quiet.' }], data: { sit: s.id, what: 'impatient' } }); }
  if (age > 16 && temper(acc).volatility > 0.45 && acc.hurtUntil <= w.now) { return blows(w, s, acc, def, j); }
  // a consigliere's boss wants his answer
  if (role(s, 'inq') && age > 10 && !num(s, 'asked')) { M(s).asked = 1; addEnc(w, { kind: 'matter', from: j.id, title: `${first(j)} wants your answer`, days: 4, lines: [`${first(j)}: “Well? ${first(def)}. What did you find?”`], opts: [{ code: 'soon', label: '“A few more days.”', hint: 'He’ll give you them. He’ll notice.' }], data: { sit: s.id, what: 'chase' } }); }
  if (age > 24) {
    // nobody decided: an NPC judge decides himself; the player's silence is an answer too
    if (seatIn(w, s, p) === 'inq') { const lines = advise(w, s, p, 'unsure'); feel(w, j, p.id, 'trust', -0.04, 'he never came back with an answer'); void lines; return; }
    bear(w, acc, p.id, 0.1, `${p.name} never settled it`); for (const c of crewOf(w, p)) feel(w, c, p.id, 'respect', -0.02, `${p.name} let a charge sit unanswered`);
    return closeSit(w, s, 'left unanswered', ['nobody settled it', 'the crew noticed'], 6);
  }
  s.next = w.now + w.rng.int(2, 4) * DAY;
  if (num(s, 'postAt')) s.next = Math.min(s.next, num(s, 'postAt')); // (a boss who said he would think it over decides on the day he meant)
}
function blows(w: World, s: Situation, acc: Character, def: Character, j: Character) {
  addFact(w, { kind: 'beating', actor: acc.id, victim: def.id, story: 'sit:' + s.id, text: `${acc.name} beat up ${def.name} over the money, when nobody would settle it.`, district: def.district }, { witnesses: [acc.id, def.id, j.id] });
  def.hurtUntil = w.now + 3 * DAY; bear(w, def, acc.id, 0.3, `${acc.name} beat him over it`);
  if (j.isPlayer) for (const c of crewOf(w, j)) feel(w, c, j.id, 'respect', -0.04, `${j.name} let it come to blows in his crew`);
  closeSit(w, s, 'came to blows', [`${first(acc)} settled it his own way`, `${j.isPlayer ? 'your' : `${first(j)}’s`} crew saw nobody stop it`], 6);
}

// ------------------------------------------------------------------------------------------------ the player's moves
MATTERS.hearing = {
  title: (w, s) => { const a = w.chars[role(s, 'acc')!], d = w.chars[role(s, 'def')!]; return `${a ? first(a) : 'A man'}’s charge against ${d ? first(d) : 'another'}`; },
  step,
  stage: (w, s, p) => {
    const seat = seatIn(w, s, p), ns = notesOf(s);
    const head = s.stage === 'resolved' ? s.out ?? 'settled' : seat === 'inq' ? 'The boss is waiting for what you find' : seat === 'judge' ? 'Yours to find out, and decide' : 'Being looked into';
    return ns.length && s.stage === 'resolved' ? `${head}` : head;
  },
  opts: (w, s, p, t) => {
    const seat = seatIn(w, s, p);
    if (!seat || !isOpen(s)) return [];
    const acc = w.chars[role(s, 'acc')!], def = w.chars[role(s, 'def')!], out: Opt[] = [];
    const add = (code: string, label: string, hint: string, who?: Id, big?: boolean) => { if (!num(s, 'did:' + code)) out.push({ code, label, hint, who, big }); };
    if (!t || t.id === acc.id) { add('hear_acc', `“Tell me exactly what ${first(def)} did.”`, `${first(acc)}’s account. It will be his account.`, acc.id); if (num(s, 'heardAcc')) add('press_acc', `“How do you know? Take me through it again.”`, 'An honest man holds to his story. A liar may not.', acc.id); }
    // what has been found can be put to him: the numbers, or what a man said (only what has actually been found)
    if ((!t || t.id === def.id) && (num(s, 'bookSays') === 1 || num(s, 'around') === 2) && !num(s, 'admit')) add('show', num(s, 'bookSays') === 1 ? `“Your numbers don’t add up, ${first(def)}. Explain it.”` : `“People say you’ve been flush. Explain it.”`, 'Put what you found to his face. A guilty man has less room; an innocent one has an answer.', def.id);
    if (!t || t.id === def.id) add('hear_def', `“${first(acc)} says you’ve been ${s.m?.charge === 'talk' ? 'talking to people you shouldn’t' : s.m?.charge === 'took' ? 'helping yourself to the crew’s money' : 'holding out'}.”`, `Put it to ${first(def)}’s face. He’ll know who told you.`, def.id);
    if (!t) {
      if (s.m?.charge !== 'talk') add('books', seat === 'inq' ? `Ask to see ${first(def)}’s numbers` : `Go through ${first(def)}’s numbers`, seat === 'inq' ? 'His captain will show you, and know you asked. They say what they say about money, and nothing else.' : 'An hour with the books. They say what they say about money, and nothing else.');
      add('around', 'Ask around quietly', `The men around them may know something. ${first(def)} may hear you’re asking.`);
      if (!role(s, DELEGATE) && seat === 'judge') for (const m of delegates(w, s, p).slice(0, 1)) add('lt:' + m.id, `Have ${m.name} look into it`, `He’ll come back in a few days with what he makes of it. What he makes of it depends on whom he likes.`);
      if (seat === 'judge') {
        out.push({ code: 'rule:guilty', label: s.m?.charge === 'talk' ? `Rule against ${first(def)}: he talked` : `Rule against ${first(def)}: he pays it back`, hint: s.m?.charge === 'talk' ? 'He’s cut off from everything. If he didn’t, you have just ruined a loyal man.' : `${money(s.amt ?? 0)} back. If he didn’t do it, the men who know will know you got it wrong.`, big: true });
        if (def.rank !== 'capo') out.push({ code: 'rule:out', label: `Rule against ${first(def)}: he’s out of the crew`, hint: 'Pays it back and goes. The hardest ruling.', big: true });
        else if (positionOf(w, p) === 'boss') out.push({ code: 'rule:down', label: `Rule against ${first(def)}: take his crew from him`, hint: 'Pays it back and loses his crew. Every captain will read it.', big: true });
        out.push({ code: 'rule:false', label: `Throw the charge out: ${first(acc)} was lying`, hint: `${first(acc)} is shamed in front of the crew. If he was telling the truth, ${first(def)} walks.`, big: true });
        out.push({ code: 'rule:none', label: 'No finding', hint: 'You can’t tell, and you say so. Neither of them will thank you.' });
      }
    }
    // the consigliere's finding, said to the boss himself, here or from the record
    if (seat === 'inq' && !num(s, 'postAt') && (!t || t.id === role(s, 'judge'))) { // (not while he is thinking it over: your advice has been given)
      // (to his face, it is said; from the record, it is what you go and tell him)
      const j = first(w.chars[role(s, 'judge')!]), face = !!t;
      if (s.m?.challenged) {
        out.push({ code: 'adv:show', label: face ? `“Here’s what I found.”` : `Lay out for ${j} what you found`, hint: 'What you can point to, and no more. It counts as far as it goes.', big: true });
        out.push({ code: 'adv:insist', label: face ? '“It’s my judgment. That’s what you keep me for.”' : `Tell ${j} it’s your judgment`, hint: 'It counts as far as he trusts you.', big: true });
        return out;
      }
      out.push({ code: 'adv:guilty', label: face ? `“${first(def)} did it. I’m sure of it.”` : `Tell ${j}: ${first(def)} did it`, hint: 'He decides. If you are wrong, he will remember whose advice it was.', big: true });
      out.push({ code: 'adv:false', label: face ? `“There’s nothing in it. ${first(acc)} has his reasons.”` : `Tell ${j}: there’s nothing in it`, hint: `If you’re wrong, that is remembered too.`, big: true });
      out.push({ code: 'adv:unsure', label: face ? '“I can’t tell you for certain.”' : `Tell ${j} you can’t be sure`, hint: 'Honest. He doesn’t like it, and decides by his own lights.' });
      if (!face && !num(s, 'did:mediate')) out.push({ code: 'mediate', label: `Bring ${first(acc)} and ${first(def)} together`, hint: 'A settlement without a verdict. It works if both want to be done with it.' });
    }
    return out;
  },
  act: (w, s, p, code, who) => {
    const acc = w.chars[role(s, 'acc')!], def = w.chars[role(s, 'def')!];
    if (code.startsWith('enc:')) {
      const [, what, c] = code.split(':');
      if (what === 'open') { if (c === 'drop') { bear(w, acc, p.id, 0.06, `${p.name} wouldn’t hear his charge`); closeSit(w, s, 'turned away', [`${first(acc)} was told to settle it himself`], 6); return [`${first(acc)} doesn’t like it. “Fine.” He’ll settle it himself, one way or another.`]; } if (c === 'now') return [...hearAcc(w, s, p, acc), ...hearDef(w, s, p, def), 'They’re both in front of you. It’s yours to decide, now or later.']; return [`You’ll look into it. ${first(acc)} goes away satisfied for now.`]; }
      if (what === 'bribe') { if (c === 'take') { const amt = Number(s.m?.bribeAmt ?? 0) || Math.min(def.cash, 200); def.cash -= amt; p.cash += amt; M(s).took = 1; addFact(w, { kind: 'event', actor: p.id, victim: def.id, minor: true, text: `${p.name} took ${money(amt)} from ${def.name} while he was deciding about him.`, district: p.district }, { witnesses: [p.id, def.id] }); feel(w, def, p.id, 'respect', -0.08); return [`You take it. ${first(def)} looks relieved, and a little contemptuous.`]; } feel(w, def, p.id, 'respect', 0.05); note(s, `${first(def)} tried to put an envelope in your hand.`); return [`${first(def)} takes it back. He doesn’t look at you on the way out.`]; }
      if (what === 'impatient') { if (c === 'hands') { blows(w, s, acc, def, p); return [`${first(acc)} takes you at your word.`]; } return [`${first(acc)} goes. He won’t wait for ever.`]; }
      return [];
    }
    M(s)['did:' + code] = 1;
    if (code === 'hear_acc') return hearAcc(w, s, p, acc);
    if (code === 'press_acc') return pressAcc(w, s, p, acc);
    if (code === 'hear_def') return hearDef(w, s, p, def);
    if (code === 'show') {
      // the evidence in front of him: a guilty man with little nerve owns it; a cool one has a story that doesn't quite hold
      if (guilty(s) && temper(def).caution + def.skills.nerve * 0.5 < 0.95) { M(s).admit = 1; note(s, `Faced with it, ${first(def)} admitted it.`); return [`${first(def)} looks at what you have for a long time. “All right. I took it. I was going to put it back.”`]; }
      if (guilty(s)) { note(s, `Faced with it, ${first(def)} had an explanation. It was thin.`); return [`“A couple of the spots were slow, and I covered the difference out of what I was owed.” He has an answer for everything. It doesn’t quite add up.`]; }
      note(s, `Faced with it, ${first(def)} explained it plainly.`); return [`“Ask anybody where it went. I’ll show you every dollar.” He doesn’t hesitate.`];
    }
    if (code === 'books') return readBooks(w, s, p, def);
    if (code === 'around') return askAround(w, s, p);
    if (code.startsWith('lt:')) { const m = w.chars[code.slice(3)]; return m ? delegateTo(w, s, p, m) : []; }
    if (code.startsWith('rule:')) { const r = code.slice(5) as Ruling; const lines = rule(w, s, p, r); if (positionOf(w, p) === 'underboss') lines.push(...appeal(w, s, p)); return lines; }
    if (code === 'adv:show' || code === 'adv:insist') { const a = String(s.m?.challenged) as 'guilty' | 'false'; delete s.m!.challenged; const found = notesOf(s); return [...(code === 'adv:show' && found.length ? [`You lay it out: ${found.slice(-3).join(' ')}`] : []), ...advise(w, s, p, a, code === 'adv:show' ? 'show' : 'insist')]; }
    if (code.startsWith('adv:')) return advise(w, s, p, code.slice(4) as 'guilty' | 'false' | 'unsure');
    if (code === 'mediate') {
      const willing = peek(acc, def.id).grudge < 0.5 && peek(def, acc.id).grudge < 0.5 && (guilty(s) ? temper(def).agreeable > 0.4 : temper(acc).agreeable > 0.4);
      if (!willing) { note(s, 'You tried to bring them together. Neither would give an inch.'); return ['You sit them down. Neither will give an inch, and you learn more from how they refuse than from anything they say.']; }
      const j = w.chars[role(s, 'judge')!]; ease(acc, def.id, 0.5); ease(def, acc.id, 0.5); feel(w, j, p.id, 'trust', 0.04, `${p.name} settled ${acc.name} and ${def.name} quietly`);
      if (guilty(s)) { const pay = Math.min(def.cash, Math.round((s.amt ?? 0) * 0.6)); def.cash -= pay; acc.cash += pay; }
      closeSit(w, s, 'settled between them', [`you brought ${first(acc)} and ${first(def)} to terms`, `${first(j)} didn’t have to decide`], 6);
      return [`It takes an evening and a bottle. In the end ${first(acc)} and ${first(def)} shake hands${guilty(s) ? ', and some money changes hands under the table' : ''}. ${first(j)} won’t have to decide anything.`];
    }
    void who;
    return [];
  },
};
registerStep('hearing', (w, s) => step(w, s));
export const isHearing = (s: Situation) => s.kind === 'hearing';
