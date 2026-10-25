// What a man knows of a thing, and how he puts it into words (moved from the old conversation engine, Gate 4): which incidents he can
// speak to, what he will and will not say of them and to whom, how a fact sounds in his mouth, and the small ways a man talks (his own
// name as "I", the men he mentions by first name). Nothing here decides or changes anything.
import { flavour, isResolved, ownerBiz } from '../../core';
import { arch } from '../../voice';
import { temper } from '../../temper';
import { introduced } from '../../acquaint';
import { DAY, type Character, type Fact, type Id, type World } from '../../types';

export const BORING = new Set(['loan', 'debt_paid', 'debt_missed', 'gambling_loss', 'business_struggling', 'report', 'gathering', 'promotion',
  // (V90: the record of who owns what, what terms were agreed and who did whom a favour is not "trouble" to be asked about)
  'ownership', 'terms', 'levy', 'favour']);


// Only the people in a story can tell you its details: the man who did it, the man it was done to, the owner of the place, and anyone who was standing there.
export function involvedIn(w: World, t: Character, f: Fact): boolean {
  const b = ownerBiz(w, t.id);
  const k = t.known[f.id];
  return f.actor === t.id || f.victim === t.id || (!!b && f.business === b.id) || k?.from === 'witness' || k?.from === 'self';
}

export function incidentsOf(w: World, t: Character): { f: Fact; known: boolean }[] {
  const b = ownerBiz(w, t.id);
  return Object.entries(t.known)
    .map(([id, k]) => ({ f: w.facts[id], k }))
    .filter(({ f }) => f && !f.minor && !BORING.has(f.kind) && w.now - f.t < 40 * DAY && !isResolved(w, f))
    .sort((a, b2) => {
      const mine = (x: Fact) => (x.victim === t.id || x.actor === t.id || (b && x.business === b.id) ? 1 : 0);
      return mine(b2.f) - mine(a.f) || b2.f.t - a.f.t;
    })
    .slice(0, 4)
    .map(({ f, k }) => ({ f, known: k.knowsActor }));
}

export const grudgeTarget = (w: World, t: Character) => Object.entries(t.rels).filter(([id, r]) => r.grudge >= 0.3 && id !== w.playerId && w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge)[0];
export const isSuperior = (w: World, t: Character, p: Character) => {
  let c: Character | undefined = p;
  for (let i = 0; i < 6 && c; i++) {
    if (c.bossId === t.id) return true;
    c = c.bossId ? w.chars[c.bossId] : undefined;
  }
  return false;
};

export const inFamily = (p: Character, t: Character) => !!p.familyId && p.familyId === t.familyId;


// A man telling his own story says "me" and "my", not his own full name.
export function inHisVoice(text: string, _t: Character, _own: boolean): string {
  return text; // the first-person and first-name rewrite is applied once, to every spoken line, by speechFor()
}


// Everything a man says aloud is put in the way a man talks: his own name becomes "I", "me" and "my", and the people he mentions are
// called by their first names (their full names only where two of them would be confused). This is applied to every line he speaks,
// whichever part of the game produced it, so no conversation reads like a record being read out.
const SELF_VERB: Record<string, string> = { has: 'have', is: 'am', was: 'was', does: 'do', 'doesn’t': 'don’t', 'isn’t': 'am not', 'hasn’t': 'haven’t', had: 'had' };
export const rx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function selfVerb(v: string): string {
  const l = v.toLowerCase();
  if (SELF_VERB[l]) return SELF_VERB[l];
  return l.length > 3 && l.endsWith('s') && !l.endsWith('ss') ? l.slice(0, -1) : l;
}
// (the man he is talking to is "you": "Lawrence was light" said to Lawrence is "you were light")
const YOU_VERB: Record<string, string> = { is: 'are', was: 'were', has: 'have', does: 'do', 'doesn’t': 'don’t', 'isn’t': 'aren’t', 'wasn’t': 'weren’t', 'hasn’t': 'haven’t', had: 'had' };
const youVerb = (v: string) => YOU_VERB[v.toLowerCase()] ?? (v.length > 3 && v.endsWith('s') && !v.endsWith('ss') ? v.slice(0, -1) : v);
function toYou(w: World, p: Character, s: string): string {
  const f = p.name.split(' ')[0], solo = !Object.values(w.chars).some((c) => c.id !== p.id && c.alive && c.name.split(' ')[0] === f);
  for (const n of [rx(p.name), ...(solo ? [rx(f)] : [])]) {
    s = s.replace(new RegExp(`\\b${n}[’']s\\b`, 'g'), 'your');
    s = s.replace(new RegExp(`(^|[.!?;,—]\\s+|\\b(?:and|but|then|so|after|before|when|because|until|since|if|that|while) )${n} ((?:now |just |also |still |never |only )?)([A-Za-z’']+)`, 'g'), (_x, pre: string, adv: string, v: string) => `${pre}${pre ? 'you' : 'You'} ${adv}${youVerb(v)}`);
    s = s.replace(new RegExp(`\\b${n}\\b`, 'g'), 'you');
  }
  return s.replace(/(^|[.!?]\s+)you\b/g, (_m, a: string) => `${a}You`);
}
export function speechFor(w: World, p: Character, t: Character, line: string): string {
  if (!/["“]/.test(line)) return line;
  if (p.isPlayer && t.id !== p.id && (line.includes(p.name) || line.includes(p.name.split(' ')[0]))) line = line.replace(/(["“])([^"“”]+)(["”])/g, (_m, a: string, body: string, z: string) => `${a}${toYou(w, p, body)}${z}`);
  const found = Object.values(w.chars).filter((c) => c.id !== p.id && line.includes(c.name));
  if (!found.length) return line;
  const first = (n: string) => n.split(' ')[0];
  const count = new Map<string, number>();
  for (const c of found) count.set(first(c.name), (count.get(first(c.name)) ?? 0) + 1);
  return line.replace(/(["“])([^"“”]+)(["”])/g, (_m, a: string, body: string, z: string) => {
    let s = body;
    if (s.includes(t.name)) {
      const n = rx(t.name);
      s = s.replace(new RegExp(`${n}[’']s`, 'g'), 'my');
      // (his name is "I" only where it begins what he says or a clause of it; elsewhere it is "me": "Tony beat me up", not "beat I up")
      s = s.replace(new RegExp(`(^|[.!?;,—]\\s+|\\b(?:and|but|then|so|after|before|when|because|until|since|if|that|while) )${n} ((?:now |just |also |still |never |only )?)([A-Za-z’']+)`, 'g'), (_x, pre: string, adv: string, v: string) => `${pre}I ${adv}${selfVerb(v)}`);
      s = s.split(t.name).join('me');
    }
    for (const c of found) if (c.id !== t.id && s.includes(c.name) && count.get(first(c.name)) === 1 && introduced(w, p, c)) s = s.split(c.name).join(first(c.name));
    return `${a}${s}${z}`;
  });
}
// How a second account sits against the first, said only as far as the records go: a recorded cause is called a cause, and
// otherwise he gives the order and the gap and says he can't tell whether one led to the other.
export function thenLine(f: Fact, g: Fact, text: string): string {
  const dt = g.t - f.t, n = Math.round(Math.abs(dt) / 1440);
  // (said the way a man says it, not as a dated record)
  const gap = Math.abs(dt) < 720 ? 'The same day,' : dt < 0 ? (n <= 1 ? 'The day before,' : n < 7 ? 'A few days before that,' : 'A while before that,') : n <= 1 ? 'The next day,' : n < 7 ? 'A few days later,' : 'Some time after,';
  if (g.cause === f.id) return `“It didn’t stop there. ${text}”`;
  if (f.cause === g.id) return `“That came out of something before it. ${text}”`;
  if (Math.abs(dt) < 720 && g.business && g.business === f.business) return `“Same day, same place: ${text}”`;
  return `“${gap} ${text} I couldn’t tell you whether the two are connected.”`;
}
// What else he has that is tied to the same matter and that you do not have yet.
export function connected(w: World, t: Character, p: Character, f: Fact) {
  return Object.entries(t.known).map(([id, kk]) => ({ g: w.facts[id], kk })).find(({ g }) => g && g.id !== f.id && !p.known[g.id] && !g.minor && !BORING.has(g.kind) && w.now - g.t < 60 * DAY && (g.actor === f.actor || g.victim === f.victim || (!!g.business && g.business === f.business)) && g.actor !== p.id);
}
// What he makes of it: his own record with the people involved comes first, then his temper.
export function takeOn(w: World, t: Character, p: Character, f: Fact): string {
  const h = [...f.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const pick = (xs: string[]) => xs[h % xs.length];
  if ((f.kind === 'ruling' && !f.actor) || f.kind === 'levy') {
    const pol: Record<string, string[]> = {
      cold: ['“A ruling is paper. What matters is who obeys it.”', '“Paper. Let’s see who it binds.”'], hothead: ['“Men with money sit down. Men who bleed don’t get asked.”', '“They talk, we pay. Same as ever.”'],
      jovial: ['“Somebody’s going to be unhappy, and it won’t be the men who made the rule. That’s politics.”', '“Everybody shakes hands. Nobody’s happy. A good ruling.”'], proud: ['“As it should be. There are people whose business this is, and people whose business it isn’t.”', '“It is for the houses to settle. And they have.”'],
      schemer: ['“Interesting who it favours. Always is.”', '“Read who gains by it. That’s the whole story.”'], bitter: ['“Rich men settle their quarrels. Poor men pay for them.”', '“It won’t be them who pays.”'],
      earnest: ['“I hope it holds. Too many good men have already been hurt.”', '“I’d like to believe it’ll hold.”'], frightened: ['“I don’t like it. When they start sitting down, it means it’s gotten bad.”', '“If they had to sit down, it was worse than we were told.”'],
    };
    return pick(pol[arch(t)] ?? ['“Not my business unless it becomes my business.”']);
  }
  const ac = f.actor ? w.chars[f.actor] : undefined;
  const vc = f.victim ? w.chars[f.victim] : undefined;
  const fa = ac && ac.id !== p.id ? ac.name.split(' ')[0] : '';
  // what he is to it comes first: the man it was done to speaks of it as his own (what he means to do, or what he can't), the man who
  // did it as his doing; only a man with no part in it speaks as an onlooker
  const bz = f.business ? w.biz[f.business] : undefined;
  if (f.kind === 'protection_started') {
    if (f.actor === t.id) return pick(['“It’s a good little place. It pays on time.”', '“It’s mine now. Nobody else had thought to ask.”']);
    if (bz?.ownerId === t.id) return pick(['“I pay. What else am I going to do?”', '“It’s a cost of doing business. That’s what I tell my wife.”']);
    return pick(['“Another envelope. That’s the neighbourhood now.”', '“It’s a living, if you’re the one holding the envelope.”', '“Somebody’s making a decent week out of that place.”']);
  }
  if ((f.victim === t.id || (bz && bz.ownerId === t.id)) && !DEALS.has(f.kind)) {
    const byFa = fa && f.actor !== t.id;
    if (t.traits.violence > 0.6 || temper(t).pride > 0.65) return pick([byFa ? `“${fa} will hear from me. I won’t say more than that.”` : '“It won’t be left like this. That’s all I’ll say.”', '“It was done to me. I’ll answer it, my way, when I’m ready.”']);
    if (t.traits.caution > 0.6 || temper(t).courage < 0.4) return pick(['“What can I do? I keep my head down and hope it doesn’t happen again.”', '“I want it to stop. That’s all I want.”']);
    return pick([byFa ? `“I haven’t decided. Not yet. But I haven’t forgotten it was ${fa}.”` : '“I haven’t decided. I want to know who first.”', '“I’m thinking about it. Something has to be done.”']);
  }
  if (f.actor === t.id) return pick(['“It was what it was. He had it coming.”', '“I did what I had to.”']);
  const tension = ac?.familyId && vc?.familyId && ac.familyId !== vc.familyId ? (w.fam[ac.familyId].tension[vc.familyId] ?? 0) : 0;
  if (fa && (t.rels[ac!.id]?.grudge ?? 0) >= 0.3) return pick([`“${fa}? I’m not surprised. That one has it coming.”`, `“${fa}. Of course it was ${fa}.”`, `“I’ve been waiting for ${fa} to do something like that.”`]);
  if (fa && (t.rels[ac!.id]?.trust ?? 0) >= 0.4) return pick([`“Doesn’t sound like ${fa}. Somebody’s stirring.”`, `“I’d want to hear it from ${fa} before I believed it.”`]);
  if (vc && vc.familyId === t.familyId && vc.id !== t.id) return pick(['“That’s one of ours. It doesn’t get forgotten.”', '“He’s one of ours. Somebody will answer for it.”']);
  if (f.kind === 'poach' && tension >= 2) return pick(['“Reaching into another house’s collection is how it starts. Those two don’t need the excuse.”', '“Two houses already looking for a reason, and one hands it to them.”']);
  if (f.kind === 'poach') return pick(['“A man takes what another man was collecting, and nobody’s asked first. That never ends quietly.”', '“Somebody’s going to want that back.”']);
  if (t.traits.violence > 0.6) return pick(['“Some things you settle with a bat, not a conversation.”', '“If it were mine, there’d be nothing left to discuss.”']);
  if (t.traits.caution > 0.6) return pick(['“Best nobody in this room gets involved.”', '“I’d keep my head down and let it play out.”']);
  return pick(['“Not my business unless it becomes my business.”', '“I’ll know what I think when I know who it touches.”', '“I hear a lot. I don’t do much with it.”']);
}

export const asksOf = (w: World, t: Character) => w.enc.filter((e) => e.status === 'open' && e.from === t.id && e.expires > w.now && e.opts.length);
export const askLead = (e: { lines: string[] }) => e.lines.filter((l) => /["“]/.test(l)).slice(-1)[0] ?? e.lines[e.lines.length - 1] ?? '';

// What a man wants, in his own mouth. The second line is how a guarded man puts it.
export const WANT_SAY: Record<string, [string, string]> = {
  made: ['I want to be made. That’s all I think about, if I’m honest.', 'There’s a button I mean to earn. I’ll leave it there.'],
  gamble: ['I’d like a book of my own. A little room, a few regulars.', 'I have ideas about money. They’re mine.'],
  independent: ['I’m tired of somebody else’s hand in my pocket. I want out from under.', 'I want what I earn to stay where I put it.'],
  lieutenant: ['I want to be the man next to you when it matters.', 'A man should be near the people who count.'],
  rich: ['I want money. Real money. I don’t much care how it comes.', 'Everybody wants a bit more than they have.'],
  respect: ['I want to be listened to when I speak. Money’s second.', 'I want to be taken seriously. That’s all.'],
};


// How much he will say when you ask what's going on: what he knows, what he is willing to tell you, and what you asked are three things.
export const RKN = (r: string) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(r);
export function openness(w: World, t: Character, p: Character): 'open' | 'partial' | 'general' | 'brush' | 'hostile' {
  const r = t.rels[p.id];
  const tr = r?.trust ?? 0, af = r?.affection ?? 0, gr = r?.grudge ?? 0;
  if (gr >= 0.3) return 'hostile';
  let s = tr * 0.6 + af * 0.4;
  if (t.traits.sociability > 0.65) s += 0.15; // a talker says more than he should
  if (t.traits.caution > 0.6 && RKN(t.rank) >= 3) s -= 0.15; // a careful capo gives nothing away, even to a friend
  if (RKN(t.rank) > RKN(p.rank) || t.id === p.bossId) s -= 0.08; // a superior tells you what he chooses to
  const a = arch(t);
  if (a === 'frightened') s += 0.08;
  if (a === 'cold') s -= 0.08;
  return s >= 0.55 ? 'open' : s >= 0.38 ? 'partial' : s >= 0.2 ? 'general' : 'brush';
}

// A fact as the man who knows it would say it. The record's own wording is for the news and the log; across a table he says "I" for
// himself, he doesn't read out a headline, and an arrangement he made is "taken on", not "put on the books".
export function told(w: World, t: Character, f: Fact, knows: boolean): string {
  const raw = knows || !f.textHidden ? f.text : f.textHidden;
  const n = [...f.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  let m = /^(.+) now collects (\$[\d,]+) a week from (.+)\.$/.exec(raw);
  if (m) {
    const [, a, fee, biz] = m;
    const owner = !!f.business && w.biz[f.business]?.ownerId === t.id;
    if (a === t.name) return [`${a} took on ${biz}. ${fee} a week.`, `${biz} is mine now, ${fee} a week.`][n % 2];
    if (owner) return `${a} collects ${fee} a week from ${biz} now. From me.`;
    return [`${a} has taken on ${biz}. ${fee} a week.`, `${a} is collecting from ${biz} now, ${fee} a week.`][n % 2];
  }
  m = /^(.+) \((.+)\) muscled in on (.+), which had been paying (.+) \((.+)\)\.$/.exec(raw);
  if (m) {
    const [, a, fa, biz, old] = m;
    if (old === t.name) return `${a} muscled in on ${biz}. It had been paying ${t.name}.`;
    if (a === t.name) return `${a} muscled in on ${biz}, which had been paying ${old}.`;
    return `${a}, one of the ${fa} crew, muscled in on ${biz}. It had been paying ${old}.`;
  }
  m = /^(.+) told (.+) to get out of (.+)\.$/.exec(raw);
  if (m && m[1] === t.name) return `${m[2]} came round to ${m[3]} wanting a weekly payment. ${m[1]} sent him out with nothing.`;
  m = /^(.+) robbed (.+) of (\$[\d,]+)\.$/.exec(raw);
  if (m && m[2] === t.name) return `${m[1]} robbed ${t.name} of ${m[3]}.`;
  m = /^(.+) beat up (.+)\.$/.exec(raw);
  if (m && m[2] === t.name) return `${m[1]} beat ${t.name} up.`;
  return flavour(f, raw);
}
// arrangements between men, not crimes: talked of as business (how it came about, who else has a claim), never as "who did it"
export const DEALS = new Set(['protection_started', 'protection_ended', 'partnership', 'sale', 'deal']);
export const SCENE = new Set(['beating', 'murder', 'robbery', 'vandalism', 'theft', 'burglary', 'raid', 'attempt', 'threat']);
export const first1 = (w: World, id: string) => (w.chars[id]?.name.split(' ')[0] ?? 'the owner');

// What he will put into words, by who he is. Not a secret flag: it follows his temperament, how far he trusts you, and whether
// the matter shames him. Returns undefined when he will say it, or the line he gives instead.
export const HUMILIATING = new Set(['beating', 'robbery', 'scam', 'shake', 'theft', 'vandalism', 'poach']);
export function holdsBack(w: World, t: Character, p: Character, f: Fact, what: 'who' | 'cost' | 'witness'): string | undefined {
  const tr = t.rels[p.id]?.trust ?? 0;
  const a = arch(t);
  const shamed = f.victim === t.id && HUMILIATING.has(f.kind);
  const actor = f.actor ? w.chars[f.actor] : undefined;
  if (a === 'proud' && shamed && tr < 0.55) return `${t.name} draws himself up. "That is my business, and I’ll deal with it myself."`;
  if (a === 'cold' && tr < 0.35) return `${t.name} looks at you for a while. "Not with you."`;
  if (a === 'bitter' && tr < 0.25) return `${t.name} shrugs. "Why would I tell you? What did anyone ever do for me?"`;
  if (a === 'hothead' && what === 'who' && actor && actor.familyId === t.familyId && tr < 0.5) return `${t.name}: "I’ll handle him myself. I don’t need the whole house knowing."`;
  if (a === 'schemer' && what === 'who' && !((t.rels[actor?.id ?? '']?.grudge ?? 0) >= 0.2) && tr < 0.55) return `${t.name} smiles. "A name is worth something. Come back when we’re better friends."`;
  if (a === 'schemer' && what === 'cost' && tr < 0.4) return `${t.name} waves it off. "Enough. Let’s not make it sound like more than it was."`;
  return undefined;
}


// What counts as trouble between men (a quarrel, a wrong), as against the ordinary record of what was agreed or owned.
export const TROUBLE = new Set(['beating', 'murder', 'robbery', 'vandalism', 'theft', 'burglary', 'raid', 'attempt', 'threat', 'poach', 'protection_refused', 'scam', 'exposed', 'discipline', 'arrest', 'debt_default']);
// whether a line answers (his words, or what he does), rather than only telling what the player did
export const answered = (l: string, name?: string) => !l.startsWith('⟡') && (!/^You\b/.test(l) || /[“"]/.test(l) || /(^|[.!?]\s+)(He|His|Him)\b/.test(l) || (!!name && new RegExp(`(^|[.!?]\\s+)${name}\\b`).test(l)));
