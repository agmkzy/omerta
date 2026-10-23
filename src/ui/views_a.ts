import { enterpriseLine, lineOf } from '../rackets';
import { personTexture } from '../sitmoves';
import { viewOf } from '../temper';
import { clubOf, clubOpen, clubPresent } from '../clubdata';
import { owedOf, perf, trade } from '../econ';
import { waiting } from '../club';
// Today, sheets (people, shops, incidents) and the family trees.
import { grudgeWord } from '../actions';
import { effectiveRate, envelopeDue, envelopeText, kickWindow, SOURCE_LABEL, visibleSources } from '../books';
import { queueOf, queueView } from './family';
import { pathCard, powersCard } from './pathview';
import { pathInfo } from '../path';
import { capOf, careerLines, isRunner, members, promoSteps, seats, standingTable, vacancy } from '../career';
import { factText, famName, money, ownerBiz, shortTime } from '../core';
import { KIND_LABEL, playerSide, standingWord, staleReason } from '../jobs';
import { GIG_LABEL } from '../gigs';
import { lateOf, PROBLEM_LABEL } from '../people';
import { Character, DAY, Enc, Id, World } from '../types';
import { salience, sourceOf, versionOf } from '../rumour';
import { isOpen } from '../situ';
import { arch } from '../voice';
import { isMade, sanctioned } from '../politics';
import { isFemale, isPartner, kinOf, kinWord, stageWord, warmthWord } from '../life';
import { dangerLevel, LADDER_WORDS } from '../danger';
import { favourWord, owedTo, owing } from '../encounters';
import { timeBar } from './views_b';
import { myDisputes, playerMoved } from './views_c';
import { storiesTab, storiesOf, storyKnown, type Story } from './stories';
import { ambitionCard } from './ambview';
import { AMBS } from '../ambition';
import { whereIs } from '../where';
import { TAGS, noteOf } from '../notebook';
import { WANT_LINE } from '../crewlife';
import { comingUp } from './brief';
import { sundayDue } from './sunday';
import { avatar, banner, back, chevron, meterRow, skillBars, skillLine, traitTags } from './common';
import { toSide } from './layout';
import { bl, chip, esc, fl, known, lk, P, pl, S, statusOf, W, who } from './links';

const word = (v: number, a: string[]) => a[Math.min(a.length - 1, Math.floor(v * a.length))];

// ------------------------------------------------------------------ today

// One thing on the Today list. `k` says plainly what kind of thing it is; `who` puts a face to it when a man has come to the player;
// `when` is how long it will wait, in words.
export interface Need {
  dot: string;
  title: string;
  sub: string;
  a: string;
  k?: string;
  who?: Id;
  when?: string;
}
export const isAttn = (n: Need) => n.dot === 'red' || n.dot === 'amber' || n.a === 'sunday:';
export const attentionCount = () => needs().filter(isAttn).length;

const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// When something runs out, as a man would put it: today, tomorrow, by Thursday, by 14 March. (Day 0 is Monday 2 March 1970.)
export function byWhen(now: number, t: number): string {
  const d = Math.floor(t / DAY) - Math.floor(now / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'by tomorrow';
  if (d < 7) return `by ${WEEKDAY[Math.floor(t / DAY) % 7]}`;
  const dt = new Date(Date.UTC(1970, 2, 2) + t * 60000);
  return `by ${dt.getUTCDate()} ${MONTH[dt.getUTCMonth()]}`;
}
const firstName = (c: Character) => c.name.split(' ')[0];
// What kind of approach it is, in a word or two (never the record's own label).
const ENC_K: Record<string, string> = {
  threat: 'A threat', ask: 'Wants something', word: 'Wants a word', matter: 'Wants your answer', callin: 'Calling in a favour',
  squeeze: 'Another family', invite: 'An invitation', kin: 'Family',
};
function approach(w: World, e: Enc, story?: Story): Need {
  const c = e.from ? w.chars[e.from] : undefined;
  const by = byWhen(w.now, e.expires);
  const he = !c ? 'They' : isFemale(c) ? 'She' : 'He';
  const wait = e.kind === 'kin' ? '' : `${he}’ll want an answer ${by}.`;
  const dot = e.kind === 'threat' ? 'red' : story ? (story.tone === 'red' ? 'red' : 'amber')
    : e.kind === 'callin' || e.data?.what === 'sit_turf' || e.kind === 'ask' || e.kind === 'word' || e.kind === 'matter' ? 'amber' : e.kind === 'invite' ? 'blue' : 'green';
  return {
    dot, title: e.title, k: e.kind === 'crew' && c?.bossId === w.playerId ? 'One of your men' : ENC_K[e.kind] ?? (c ? 'Wants a word' : 'Word comes'), who: c?.id, when: by.replace(/^by /, ''),
    sub: e.kind === 'threat' ? `This is serious. ${wait}`.trim() : wait || 'It won’t keep for ever.',
    // a question that belongs to a story is answered on the story's page, with the rest of what you know of it
    a: story ? `story:${story.key}` : `enc:${e.id}`,
  };
}
// What kind of story it is, plainly.
function storyK(w: World, p: Character, s: Story): string {
  if (s.kind === 'matter') {
    const sit = (w.situations ?? []).find((x) => 'sit:' + x.id === s.key);
    if (sit?.kind === 'ask') return sit.terms?.by === p.id ? 'Your move' : 'Put to you';
    return s.origin ?? 'A matter';
  }
  return { debt: 'Money owed', threat: 'Coming after you', hunt: 'Coming after you', turf: 'Your ground', dispute: 'A quarrel', crew: 'One of your men', seat: 'Your future' }[s.kind];
}

export function needs(): Need[] {
  const w = W();
  const p = P();
  const out: Need[] = [];
  // V89: the stories that are waiting on him (Stories, "Needs you"), so Today and Stories never disagree about what needs him
  const live = storiesOf(w).filter((s) => !s.closed);
  const pend = new Map<Id, Story>();
  for (const s of live) if (s.pending) pend.set(s.pending.id, s);
  for (const e of w.enc.filter((x) => x.status === 'open').sort((a, b) => Number(b.kind === 'threat') - Number(a.kind === 'threat') || a.expires - b.expires))
    out.push(approach(w, e, pend.get(e.id)));
  // Sunday: the weekly books have settled. Crew first (their envelopes, at the club, where his own is handed over at the end), then
  // the boss. While the Sunday screen is still to be done it is one row covering both; after it, or for a man with no crew, his own
  // envelope is its own row until he hands it over in person or the window closes.
  { const boss = p.bossId ? w.chars[p.bossId] : undefined;
    const owes = !!boss?.alive && !!w.sunday && kickWindow(w, p) && envelopeDue(w, p) > 0;
    const by = w.sunday ? byWhen(w.now, w.sunday.t + 2 * DAY) : '';
    if (sundayDue()) {
      out.push(owes && boss
        ? { dot: 'amber', k: 'Sunday', title: `Your men’s envelopes, then yours to ${firstName(boss)}`, sub: `${envelopeText(w, p)} He’ll want it in his hand ${by}.`, a: 'sunday:' }
        : { dot: 'blue', k: 'Sunday', title: 'Sunday at the social club', sub: 'Your men are bringing their envelopes in.', a: 'sunday:' });
    } else if (owes && boss) {
      out.push({ dot: 'amber', k: 'Sunday', title: `Your envelope for ${firstName(boss)}`, sub: `${envelopeText(w, p)} Hand it to him yourself ${by}; he notices who comes in person.`, a: `talk:${boss.id}`, who: boss.id });
    }
  }
  for (const d of myDisputes(w).filter((x) => (x.status === 'violated' && (x.history.at(-1)?.t ?? 0) > (x.handled ?? 0) && !playerMoved(w, x)) || (x.status === 'open' && !x.ignored && !playerMoved(w, x) && (x.history.at(-1)?.t ?? 0) > (x.handled ?? 0) && w.now - (x.history.at(-1)?.t ?? 0) < 6 * DAY))) {
    const a = w.chars[d.a], b = w.chars[d.b];
    out.push({ dot: d.status === 'violated' ? 'red' : 'amber', k: 'A quarrel', title: `${d.biz ? w.biz[d.biz]?.name : 'A quarrel'}: ${a.id === p.id ? 'you' : a.name.split(' ')[0]} and ${b.id === p.id ? 'you' : b.name.split(' ')[0]}`, sub: d.status === 'violated' ? 'The agreement was broken.' : (d.history.at(-1)?.text ?? 'Still open.'), a: `dispute:${d.id}` });
  }
  // stories that want him and are not already on the list as a man waiting on his answer or a quarrel; and a debt gone wrong
  for (const s of live) {
    const missed = s.kind === 'debt' && s.tone !== 'green';
    if (s.group !== 'now' && !missed) continue;
    if (s.pending && out.some((n) => n.a === `story:${s.key}`)) continue;
    if (out.some((n) => n.a === `dispute:${s.key}` || n.a === `story:${s.key}`)) continue;
    out.push({ dot: s.tone === 'red' ? 'red' : 'amber', k: storyK(w, p, s), title: s.title, sub: s.stage, a: `story:${s.key}` });
  }
  // his word, falling due: what he promised a man, and when he said it would be done
  for (const c of Object.values(w.chars)) {
    if (!c.alive || !c.memos?.length) continue;
    for (const m of c.memos) {
      if (m.other !== p.id || m.done || m.kind !== 'promise' || !m.due || m.due > w.now + 3 * DAY || m.due < w.now - 7 * DAY) continue;
      const j = m.ref ? w.jobs.find((x) => x.id === m.ref) : undefined;
      if (j && j.status !== 'offered' && j.status !== 'active') continue;
      const late = m.due <= w.now;
      out.push({ dot: late ? 'red' : 'amber', k: 'Your word', title: `What you told ${c.name}`, sub: `${m.text} ${isFemale(c) ? 'She' : 'He'} ${late ? 'expected it done by now.' : `expects it done ${byWhen(w.now, m.due)}.`}`, a: `talk:${c.id}`, who: c.id });
    }
  }
  for (const j of w.jobs.filter((x) => x.status === 'offered' && playerSide(w, x) && !staleReason(w, x)).sort((a, b) => Number(b.kind === 'summons') - Number(a.kind === 'summons') || Number(b.via === 'boss') - Number(a.via === 'boss'))) {
    out.push({ dot: j.kind === 'summons' || j.via === 'boss' ? 'amber' : j.via === 'tip' || j.kind === 'gig' ? 'green' : 'green', k: j.kind === 'gig' ? GIG_LABEL[String(j.extra?.gig) as keyof typeof GIG_LABEL] ?? 'Opportunity' : KIND_LABEL[j.kind], title: j.title, sub: `${j.giver ? 'From ' + w.chars[j.giver]?.name : 'A tip'}${j.pay > 0 ? ', about ' + money(j.pay) : ''}. It won’t wait past ${byWhen(w.now, j.expires).replace(/^by /, '')}.`, when: byWhen(w.now, j.expires).replace(/^by /, ''), a: `job:${j.id}` });
  }
  for (const j of w.jobs.filter((x) => x.rep && !x.acked && playerSide(w, x) && (x.status === 'done' || x.status === 'failed')).slice(-3).reverse())
    out.push({ dot: 'blue', k: 'Reporting back', title: `${w.chars[j.rep!.by].name} reports back`, sub: j.title, a: `report:${j.id}`, who: j.rep!.by });
  for (const b of Object.values(w.biz).filter((x) => x.open && x.protection && lateOf(x) > 0 && (x.protection.collectorId === p.id || w.chars[x.protection.collectorId]?.bossId === p.id)))
    out.push({ dot: 'amber', k: 'Late paying', title: `${w.chars[b.ownerId].name} is late at ${b.name}`, sub: `${money(owedOf(b))} owed`, a: `biz:${b.id}` });
  for (const c of Object.values(w.chars).filter((x) => x.alive && x.bossId === p.id && x.problem && x.problem.sev > 0.45 && !x.problem.revealed).slice(0, 2))
    out.push({ dot: 'amber', k: 'One of your men', title: `${c.name} isn’t himself`, sub: 'Something is wrong, and he hasn’t said what.', a: `ent:${c.id}` });
  // what can hurt him first; otherwise in the order above
  return out.sort((a, b) => Number(b.dot === 'red') - Number(a.dot === 'red'));
}

// One row of the Today list: a man's face when a man has come to you, a quiet mark otherwise; what it is, the thing itself, and
// what it comes to (or how long it will wait).
function needRow(n: Need): string {
  const w = W(), c = n.who ? w.chars[n.who] : undefined;
  const plain = (x: string) => lk(x).replace(/<a [^>]*>(.*?)<\/a>/g, '$1');
  const mark = c ? `<span class="td-face${n.dot === 'red' ? ' td-face--red' : ''}">${avatar(c)}</span>` : `<span class="st-mark ${n.dot === 'blue' ? 'blue' : n.dot}" aria-hidden="true"></span>`;
  const top = c ? `<span class="td-name">${esc(c.name)}</span>` : `<span class="st-origin">${esc(n.k ?? '')}</span>`;
  const right = c && n.k ? `<span class="st-origin">${esc(n.k)}</span>` : '';
  return `<button class="td-row${c ? ' td-row--man' : ''}" data-a="${esc(n.a)}">${mark}<span class="td-row__body"><span class="td-row__top">${top}${right}</span><span class="td-row__title">${plain(n.title)}</span><span class="td-row__sub">${plain(n.sub)}</span></span></button>`;
}

// A quiet line or two of what has reached him lately: his version of it, and where he had it from.
function heardLately(): string {
  const w = W(), p = P();
  const xs = Object.entries(p.known)
    .map(([id, k]) => ({ f: w.facts[id], k }))
    .filter(({ f, k }) => f && !f.minor && k.from !== 'self' && k.from !== 'witness' && w.now - k.t < 7 * DAY && f.actor !== p.id && !['gambling_loss', 'report', 'trouble'].includes(f.kind) && salience(w, p, f) >= 0.35)
    .sort((a, b) => b.k.t - a.k.t)
    .slice(0, 2);
  if (!xs.length) return '';
  const day = (t: number) => { const d = Math.floor(w.now / DAY) - Math.floor(t / DAY); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`; };
  const rows = xs.map(({ f, k }) => {
    const to = f.story && storyKnown(w, f.story) ? `story:${f.story}` : `fact:${f.id}`;
    const src = sourceOf(w, p, f);
    return `<button class="td-heard__row" data-a="${esc(to)}"><span class="td-heard__text">${lk(versionOf(w, p, f)).replace(/<a [^>]*>(.*?)<\/a>/g, '$1')}</span><span class="td-heard__src">${esc(day(k.t))}${src ? ` · ${esc(src.charAt(0).toUpperCase() + src.slice(1))}` : ''}${to.startsWith('story:') ? ' · <b>follow it</b>' : ''}</span></button>`;
  }).join('');
  return `<section class="td-heard" aria-label="Lately you’ve heard"><h3 class="sub">Lately you’ve heard</h3>${rows}</section>`;
}

// ------------------------------------------------------------------ the first week
// One step at a time, each one a way of playing: your boss, another man's worries, a word aside, an offer that is refused and then
// pressed, the stories around you, and time. Each is read from what has actually happened (w.goals.done flags set where the player
// acts, and the records themselves), so a step is never ticked for looking at a screen it asks you to use.
const triedOf = (x?: { tried?: Record<string, number> }) => Object.entries(x?.tried ?? {}).filter(([k]) => k !== 'drop').reduce((a, [, n]) => a + n, 0);
function guideCard(): string {
  const w = W();
  const p = P();
  const g = w.goals?.done ?? {};
  if (g['g:off'] || p.rank !== 'associate' && p.rank !== 'civilian') return '';
  const boss = w.chars[p.bossId!];
  const crewN = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).length;
  const earns = Object.values(w.ops).some((o) => o.owner === p.id) || Object.values(w.biz).some((b) => b.protection?.collectorId === p.id);
  // a save that saw the older guide (before V89) through to the end is not handed a new one
  if (g['g:boss'] && g['g:job'] && g['g:friend'] && g['g:wait'] && crewN > 0 && earns && !g['g:tk'] && !g['g:aside'] && !g['g:story']) return '';
  // someone in the family to talk to besides the boss: a man under the same boss, or the boss himself
  const peer = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.bossId === p.bossId && c.id !== p.id && !c.jailedUntil)[0] ?? boss;
  const tk = !!g['g:tk'] || Object.values(w.chars).some((c) => Object.keys(c.talk ?? {}).some((k) => k.startsWith('tk:')));
  // protection: an offer made, and, if he did not take it at once, taken up again
  const offers = (w.situations ?? []).filter((s) => s.kind === 'ask' && s.ak === 'protect' && s.terms?.by === p.id).sort((a, b) => b.since - a.since);
  const prot = !!g['g:prot'] || offers.some((s) => s.out === 'agreed' || s.out === 'gave in' || triedOf(s.st?.[p.id]) >= 2);
  if (prot && w.goals && !g['g:prot']) w.goals.done['g:prot'] = w.now;
  const open = offers.find((s) => isOpen(s));
  const them = open ? w.chars[open.terms!.of] : undefined;
  const said = open ? open.st?.[open.terms!.of]?.last : undefined;
  const protStep: [string, string, boolean, string, string] = open && them && !prot
    ? [said ? `Go back to ${them.name}` : `Wait for ${them.name}’s answer`,
      said ? `${said === 'counter' ? 'He named his own price.' : said === 'stall' ? 'He asked for time.' : said === 'no' ? 'He said no.' : said === 'help' ? 'He went to someone about it.' : 'He gave you an answer.'} That isn’t the end of it. The story says where it stands and what you can try: better terms, an argument, pressure, or time.` : 'He will answer in his own time. The story keeps where it stands.',
      prot, `story:sit:${open.id}`, 'Open the story']
    : [prot ? 'Offer a shopkeeper protection, and press it' : 'Offer a shopkeeper protection', 'Rackets, under “Shops you could lean on”: pick a shop and put it to the owner. If he says no, it isn’t over: you can come back to it with better terms, an argument, or time.', prot, 'tab:rackets', 'Find a shop'];
  const steps: [string, string, boolean, string, string][] = [
    ['Show your face to ' + (boss?.name ?? 'your boss'), 'He is the man you answer to. Respect starts with turning up.', !!g['g:boss'], boss ? `talk:${boss.id}` : '', 'Go and find him'],
    ['Ask a man what’s on his mind', `Every man has his own worries. In a conversation, pick something under “On his mind”: his business, not yours.${peer && peer !== boss ? ` ${peer.name} is in the same crew as you.` : ''}`, tk, peer ? `talk:${peer.id}` : 'people:', peer ? `Talk to ${firstName(peer)}` : 'Find someone'],
    ['Sit down with a man at the club', 'Sit with one of your own at the social club and talk. Ask what is on his mind, or what he makes of the others.', !!g['g:aside'], 'place:club', 'Go to the club'],
    protStep,
    ['Follow a story', 'Stories keeps every matter you know of, in the order you learned it, and what you can do about it. Open one.', !!g['g:story'], 'tab:stories', 'Open Stories'],
    ['Let a week go by', 'Hit Wait. The world moves while you do: men answer you, rackets pay, stories move on.', !!g['g:wait'] && w.now >= 7 * DAY, 'wait:', 'Let time pass'],
  ];
  const done = steps.filter((x) => x[2]).length;
  if (done === steps.length) return '';
  const next = steps.findIndex((x) => !x[2]);
  // One step at a time: the step in front of you, a way to get there, and the rest folded away.
  const rest = steps.map((x, i) => `<li class="${x[2] ? 'ok' : i === next ? 'now' : ''}">${x[2] ? '✓ ' : i === next ? '→ ' : '· '}${esc(x[0])}</li>`).join('');
  return `<div class="card guide g-guide"><h2>Your first week<small>${done} of ${steps.length}</small></h2><p class="g-guide__step">${esc(steps[next][0])}</p><p class="muted">${esc(steps[next][1])}</p><div class="g-guide__acts">${steps[next][3] ? `<button class="btn primary" data-a="${esc(steps[next][3])}">${esc(steps[next][4])}</button>` : ''}<details class="fold"><summary class="more">All ${steps.length} steps</summary><ul class="gl">${rest}</ul></details><button class="more" data-a="guideoff:">Skip the guide</button></div></div>`;
}

export function todayView(): string {
  const w = W();
  const p = P();
  let out = '';
  if (!p.alive) return `<div class="card"><h2>You’re dead</h2><p>The world goes on without you.</p><button class="btn primary" data-a="reset:go">Start a new game</button></div>`;
  // V88: the street first. What happened, what is said, what wants you, where you can go. Where you stand goes to the side.
  const dg = dangerLevel(w);
  if (dg.level > 0 && dg.who) out += `<div class="callout bad"><b>Watch your back.</b> ${lk(dg.who.name)} is after you: ${esc(LADDER_WORDS[dg.level])}. It won’t stop by itself.</div>`;
  if (S.log.length) out += `<section class="g-just" aria-label="Just now">${S.log.map((l) => `<p>${l}</p>`).join('')}</section>`;
  if (S.chips.length) out += `<div class="chips">${S.chips.map((c) => `<span class="chip2 ${c.tone}">${esc(c.t)}</span>`).join('')}</div>`;
  if (S.news.length) out += `<section class="g-word"><h3 class="sub">Word reaches you</h3><ul class="news">${S.news.map((n) => `<li>${n}</li>`).join('')}</ul>${S.routine ? `<p class="muted" style="margin:8px 0 0">${S.routine} routine matter${S.routine > 1 ? 's' : ''} besides, filed under History.</p>` : ''}</section>`;
  if (w.scene) out += `<button class="need" data-a="place:club"><span class="dot amber"></span><span><span class="t">In the middle of a conversation</span><span class="s" style="display:block">${esc(w.chars[w.scene.npc]?.name ?? 'Someone')} at the club.</span></span></button>`;
  out += `<div class="g-pass"><h3 class="sub">Let time pass</h3>${timeBar()}</div>`;
  out += guideCard();
  const ns = needs();
  const attn = ns.filter(isAttn);
  const opps = ns.filter((n) => !attn.includes(n));
  out += `<h2 class="sect">Needs you<small>${attn.length ? attn.length + ' waiting' : 'nothing urgent'}</small></h2>`;
  if (!attn.length) out += `<p class="muted pad">Nothing is demanding you. Use the quiet to build something.</p>`;
  out += `<div class="td-rows">${(S.open.needs ? attn : attn.slice(0, 5)).map(needRow).join('')}</div>`;
  if (attn.length > 5) out += `<button class="more" data-a="tog:needs">${S.open.needs ? 'Show fewer' : `Show ${attn.length - 5} more`}</button>`;
  if (opps.length) {
    out += `<h2 class="sect">Opportunities<small>${opps.length}</small></h2><div class="td-rows">${(S.open.opps ? opps : opps.slice(0, 3)).map(needRow).join('')}</div>`;
    if (opps.length > 3) out += `<button class="more" data-a="tog:opps">${S.open.opps ? 'Show fewer' : `Show ${opps.length - 3} more`}</button>`;
  }
  // Where to go. Crew and Rackets are their own sections, so they are not repeated here.
  out += `<h2 class="sect">Go and do something</h2><div class="grid g-places">`;
  out += `<button class="tile" data-a="place:club"><span class="t">Social Club</span><span class="s">${esc(clubHint())}</span></button><button class="tile" data-a="places:"><span class="t">Around town</span><span class="s">Barber shop, corner bar</span></button><button class="tile" data-a="people:"><span class="t">Find someone</span><span class="s">Who’s where, right now</span></button>`;
  out += `<button class="tile" data-a="orders:"><span class="t">Give orders</span><span class="s">Put a man to work</span></button>`;
  out += p.job
    ? `<button class="tile hot" data-a="shift:"><span class="t">Work a shift</span><span class="s">${esc(p.job.kind)} · ${p.job.biz ? esc(w.biz[p.job.biz].name) : esc(w.chars[p.job.boss].name)}</span></button>`
    : `<button class="tile" data-a="dayjob:"><span class="t">Legit work</span><span class="s">A clean job buys cover.</span></button>`;
  if (grudgeHint() && !/^no\b|nobody|nothing/i.test(grudgeHint())) out += `<button class="tile" data-a="grudges:"><span class="t">Settle a score</span><span class="s">${esc(grudgeHint())}</span></button>`;
  out += `<button class="tile" data-a="bj:"><span class="t">Gamble</span><span class="s">Blackjack at the family casinos</span></button>`;
  if (p.heat > 0.15) out += `<button class="tile" data-a="cat:work"><span class="t">Lay low</span><span class="s">Heat is on you. Let it fade.</span></button>`;
  out += `</div>`;
  out += heardLately();
  // the papers and the stories the city is telling, always one tap away
  { const run = storiesOf(w).filter((s) => !s.closed); const fresh = (w.snaps ?? []).length && (S.seenBrief ?? 0) < w.snaps![w.snaps!.length - 1].t;
    out += `<div class="g-links">${(w.snaps ?? []).length ? `<button class="more" data-a="brief:">The Herald, and your week &rsaquo;${fresh ? ' <b class="tag amber">new</b>' : ''}</button>` : ''}<button class="more" data-a="tab:stories">${run.length ? `${run.length} ${run.length > 1 ? 'stories' : 'story'} running` : 'Stories'} &rsaquo;</button></div>`; }

  // ---- beside it: where you stand
  let side = `<h2 class="sect g-side__title">Where you stand</h2>`;
  { let out = '';
  { const mine = Object.values(w.ops).filter((o) => o.owner === p.id).length + Object.values(w.biz).filter((x) => x.protection?.collectorId === p.id).length;
    const crewN = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).length;
    const wk = Math.round(Object.values(p.books.gross).reduce((a, v) => a + v, 0));
    out += `<button class="card" data-a="tab:rackets" style="text-align:left"><b>${mine} operation${mine === 1 ? '' : 's'}</b> &middot; <b>${crewN} ${crewN === 1 ? 'man' : 'men'}</b> &middot; ${money(wk)} this week so far</button>`; }
    side += out; }
  // Your career is a page of its own in Life (rank progress and ambition together); here, just where it stands.
  { const steps = promoSteps(w, p), a = p.ambition, amb = a ? AMBS.find((x) => x.kind === a.kind) : undefined;
    const now = steps ? `being considered: ${steps.filter((x) => x.state === 'done').length} of ${steps.length} steps` : pathInfo(w, p) ? 'on the path' : `reputation ${standingWord(p.standing)}`;
    side += `<button class="card g-career" data-a="career:"><h2>Your career<small>&rsaquo;</small></h2><p><b class="g-cap">${esc(p.rank)}</b> · ${esc(now)}</p><p class="muted">${amb ? `Ambition: ${esc(amb.label)}${a?.done ? ' (done)' : ''}` : 'No ambition chosen yet.'}</p></button>`; }
  { const cu = comingUp(); if (cu.length) side += `<div class="card"><h2>Coming up</h2><ul class="rows">${cu.slice(0, 3).map((c) => `<li><span>${esc(shortTime(c.t))}</span><span class="v" style="text-align:left;margin-left:12px">${esc(c.text)}</span></li>`).join('')}</ul></div>`; }
  const gross = Object.values(p.books.gross).reduce((a, v) => a + v, 0);
  side += `<details class="fold"><summary class="more">This week: ${money(Math.round(gross))} so far</summary><div class="card"><ul class="rows">${Object.entries(p.books.gross).filter(([, v]) => v > 0).map(([s, v]) => `<li><span>${esc(SOURCE_LABEL[s] ?? s)}</span><span class="v good">+${money(Math.round(v))}</span></li>`).join('') || '<li class="muted">Nothing earned yet this week.</li>'}</ul></div></details>`;
  toSide(side);
  return out;
}

function clubHint(): string {
  const w = W(), cl = clubOf(w, P().familyId); if (!cl) return 'Cards, drinks, whispers.'; if (!clubOpen(w, cl)) return 'Shut right now.'; const n = clubPresent(w, cl).length; return n ? `${n} in. ${waiting(w, P(), cl, clubPresent(w, cl)).length ? 'Somebody wants a word.' : ''}`.trim() : 'Quiet right now.';
}
function grudgeHint(): string {
  const w = W();
  const p = P();
  const n = Object.values(w.facts).filter((f) => f.victim === p.id && ['beating', 'robbery', 'vandalism', 'poach'].includes(f.kind) && p.known[f.id] && w.now - f.t < 40 * DAY).length;
  return n ? `${n} thing${n > 1 ? 's' : ''} you haven’t forgotten` : 'Nobody has crossed you. Yet.';
}

// ----------------------------------------------------------------- people

function relWords(c: Character, p: Character) {
  const r = c.rels[p.id];
  return {
    trust: word(r?.trust ?? 0.1, ['Wary', 'Guarded', 'Warm', 'Loyal']),
    respect: word(r?.respect ?? 0.1, ['None', 'Some', 'Real', 'Deep']),
    grudge: r && r.grudge >= 0.25 ? grudgeWord(r.grudge) : 'None',
  };
}

export function personView(id: Id): string {
  const w = W();
  const p = P();
  const c = w.chars[id];
  if (!c) return back() + `<p class="muted pad">Nobody by that name.</p>`;
  const st = statusOf(w, c);
  const isMe = c.id === p.id;
  const kn = known(w, c);
  const b = ownerBiz(w, c.id);
  const boss = c.bossId ? w.chars[c.bossId] : undefined;
  const men = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id);
  const r = c.rels[p.id];
  const mine = p.rels[c.id];
  let out = back();
  out += `<div class="pers">${avatar(c)}<div><h1>${esc(c.name)}${isMe ? ' (you)' : ''}</h1><div class="sub">${c.rank === 'civilian' ? (b ? 'Owner, ' + esc(b.name) : 'Civilian') : esc(c.rank[0].toUpperCase() + c.rank.slice(1))}${c.familyId ? ' &middot; ' + esc(w.fam[c.familyId].name) + ' family' : ''} &middot; ${esc(c.district)}</div></div></div>`;
  if (!kn) out += `<div class="callout">You have never met him. Everything you know is a name.</div>`;
  out += `<div class="tags"><span class="tag ${st.dot}">${st.word}</span>${kn ? traitTags(c) : ''}${kn && c.problem?.revealed ? `<span class="tag amber">${esc(PROBLEM_LABEL[c.problem.kind])}</span>` : ''}${c.prospect ? '<span class="tag blue">looking for a start</span>' : ''}</div>`;

  if (kn && !isMe) for (const t of personTexture(w, p, c)) out += `<div class="callout">${esc(t)}</div>`;
  const headEnd = out.length;
  if (kn && !isMe) {
    out += `<div class="card"><h2>How he sees you</h2>${(() => {
      const wd = relWords(c, p);
      const f = viewOf(W(), c, p).fear; // (V90: fear is its own thing, not respect)
      return meterRow('Trust', wd.trust, r?.trust ?? 0.05) + meterRow('Respect', wd.respect, r?.respect ?? 0.05, 'brass') + meterRow('Fear', f >= 0.55 ? 'Afraid of you' : f >= 0.3 ? 'Wary of you' : f >= 0.12 ? 'A little' : 'None', Math.max(0.03, f), 'red') + meterRow('Grudge', wd.grudge, r?.grudge ?? 0.03, 'red');
    })()}</div>`;
  }
  const infoStart = out.length;
  if (kn) {
    out += `<div class="card"><h2>Where he fits</h2><ul class="rows">`;
    if (boss) out += `<li><span>Answers to</span><span class="v">${pl(boss)}</span></li>`;
    if (men.length) out += `<li><span>His men</span><span class="v">${men.slice(0, 4).map((m) => pl(m)).join(', ')}${men.length > 4 ? ` +${men.length - 4}` : ''}</span></li>`;
    if (b) out += `<li><span>Runs</span><span class="v">${bl(b.id)}</span></li>`;
    if (c.familyId) out += `<li><span>Family</span><span class="v">${fl(c.familyId)}</span></li>`;
    for (const f of w.favours.filter((x) => !x.settled && ((x.from === c.id && x.to === p.id) || (x.from === p.id && x.to === c.id)))) out += `<li><span>${f.from === p.id ? 'Owes you' : 'You owe him'}</span><span class="v ${f.from === p.id ? 'good' : 'warn'}">${favourWord(f.size)}</span></li>`;
    for (const d of w.debts.filter((x) => x.status === 'active' && (x.creditor === c.id || x.debtor === c.id)).slice(0, 2)) {
      const o = w.chars[d.creditor === c.id ? d.debtor : d.creditor];
      out += `<li><span>${d.creditor === c.id ? 'Is owed by' : 'Owes'}</span><span class="v">${pl(o)} ${money(d.balance)}</span></li>`;
    }
    if (c.bossId === p.id && lineOf(w, c)) out += `<li><span>His line</span><span class="v">${esc(enterpriseLine(w, c)!)}</span></li>`;
    if (c.rank !== 'civilian' && c.bossId === p.id) out += `<li><span>Skills</span><span class="v">${esc(skillLine(c))}</span></li><li><span>Passes up</span><span class="v">${Math.round(effectiveRate(w, c) * 100)}%</span></li>`;
    out += `</ul></div>`;
  }
  if (!isMe && kn) {
    // What he has told you, kept so you can look back at it later; and what you have been over with him lately.
    const told = Object.entries(p.known).filter(([, k]) => k.from === c.id).sort((x, y) => y[1].t - x[1].t).slice(0, 6).filter(([fid]) => w.facts[fid]);
    const lately = Object.entries(c.talk ?? {}).filter(([, m]) => Math.floor(w.now / 1440) - m.d <= 7).length;
    if (told.length || lately) out += `<div class="card"><h2>What he has told you</h2>${told.length ? `<ul class="rows">${told.map(([fid, k]) => `<li><span>${esc(shortTime(k.t))}</span><span class="v">${esc(factText(w.facts[fid], k.knowsActor))}</span></li>`).join('')}</ul>` : '<p class="small-note">Nothing you could repeat.</p>'}${lately ? `<p class="small-note">You have talked over ${lately} ${lately === 1 ? 'thing' : 'things'} with him this week.</p>` : ''}</div>`;
  }
  if (!isMe && kn) {
    const nt = noteOf(p, c.id);
    out += `<div class="card"><h2>Your notes<small><button class="pill small ${nt?.pin ? 'on' : ''}" data-a="npin:${c.id}">${nt?.pin ? '&#9733; Pinned' : '&#9734; Pin'}</button></small></h2><div class="pills">${TAGS.map((t, i) => `<button class="pill small ${nt?.tags.includes(t) ? 'on' : ''}" data-a="ntag:${c.id}|${i}">${esc(t)}</button>`).join('')}</div></div>`;
  }
  if (kn && c.bossId === p.id && !isMe) {
    const ins = p.insight?.[c.id] ?? [];
    const lines: string[] = [];
    if (ins.includes('want') && c.want) lines.push(WANT_LINE[c.want.kind](c));
    for (const t of ins) { if (t.startsWith('tie:') && w.chars[t.slice(4)]) lines.push(`He and ${w.chars[t.slice(4)].name.split(' ')[0]} are friendly.`); if (t.startsWith('rival:') && w.chars[t.slice(6)]) lines.push(`He and ${w.chars[t.slice(6)].name.split(' ')[0]} don’t get on.`); if (t.startsWith('loan:') && w.chars[t.slice(5)]) lines.push(`There’s money between him and ${w.chars[t.slice(5)].name.split(' ')[0]}.`); if (t === 'leaving') lines.push('He’s getting restless. He may not stay.'); }
    out += `<div class="card"><h2>What you’ve worked out</h2>${lines.length ? lines.map((l) => `<p>${esc(l)}</p>`).join('') : '<p class="muted">You don’t know what makes him tick yet. Talk to him, and watch.</p>'}</div>`;
    out += recordCard(w, p, c);
  }
  if (kn) {
    const facts = Object.entries(p.known).filter(([fid]) => w.facts[fid] && (w.facts[fid].actor === c.id || w.facts[fid].victim === c.id) && (!w.facts[fid].minor || w.facts[fid].kind === 'trouble')).sort((a, b) => w.facts[b[0]].t - w.facts[a[0]].t).slice(0, 6);
    out += `<div class="card"><h2>What you know</h2>${facts.length ? facts.map(([fid, k]) => `<div class="note"><a href="#" class="nm" data-a="fact:${fid}" style="text-decoration:none">${lk(factText(w.facts[fid], k.knowsActor))}</a><div class="src">${esc(shortTime(w.facts[fid].t))}</div></div>`).join('') : '<p class="muted">Nothing worth repeating.</p>'}</div>`;
  }
  const infoEnd = out.length;

  const k = kinOf(w, c.id);
  // A relative who is in the life (a made brother) is a man like any other: everything you could do with anyone, and family besides.
  const inLife = !!k && c.rank !== 'civilian';
  const seen = k ? Math.max(0, Math.floor((w.now - k.lastSeen) / DAY)) : 0;
  if (k && c.alive) out += `<div class="callout info">${kinWord(k)} · ${warmthWord(k.warmth)} · last seen ${seen === 0 ? 'today' : seen === 1 ? 'yesterday' : seen + ' days ago'}</div>` + (inLife ? '' : `<div class="row2"><button class="btn primary" data-a="visit:${c.id}">Spend an hour</button><button class="btn" data-a="tab:life">Your life</button></div>`);
  else if (isPartner(w, c.id) && c.alive) out += `<div class="callout info">${esc(stageWord[w.life!.partner!.stage])}. ${warmthWord(w.life!.partner!.warmth)}.</div><div class="row2"><button class="btn primary" data-a="date:${c.id}">Take her out ($60)</button><button class="btn" data-a="tab:life">Your life</button></div>`;
  if (!isMe && c.alive && (!k || inLife) && !isPartner(w, c.id)) {
    out += `<div class="row2"><button class="btn primary" data-a="talk:${c.id}" ${(() => { const wh = whereIs(w, p, c); return wh.kind === 'jail' ? 'disabled' : ''; })()}>${(() => { const wh = whereIs(w, p, c); return wh.kind === 'jail' ? 'Locked up' : `Go to ${esc(wh.name)} and talk`; })()}</button>`;
    if (c.bossId === p.id) out += `<button class="btn primary" data-a="orders:${c.id}">Give orders</button>`;
    else out += `<button class="btn" data-a="tree:${c.familyId ?? ''}" ${c.familyId ? '' : 'disabled'}>Their family</button>`;
    out += `</div>`;
    const sec: string[] = [];
    if (c.bossId === p.id) sec.push(`<button class="btn" data-a="books:${c.id}">His books</button>`);
    if (c.bossId === p.id && c.problem) sec.push(`<button class="btn" data-a="help:${c.id}">Something is wrong</button>`);
    if (inLife) sec.push(`<button class="btn" data-a="visit:${c.id}">Family time (an hour)</button>`);
    sec.push(`<button class="btn danger" data-a="settle:${c.id}">Take action against him</button>`);
    if (b) sec.push(`<button class="btn" data-a="biz:${b.id}">His business</button>`);
    if (sec.length) out += `<div class="row2">${sec.join('')}</div>`;
  }
  if (isMe) out += `<button class="btn" data-a="tab:life">Your life</button>`;
  void arch;
  // V88: who he is, then what you can do with him, then how he sees you. His place, your notes and what you know go beside.
  toSide(out.slice(infoStart, infoEnd));
  return out.slice(0, headEnd) + `<div class="g-acts">${out.slice(infoEnd)}</div>` + out.slice(headEnd, infoStart);
}

export function encView(id: string, lines: string[]): string {
  const w = W();
  const e = w.enc.find((x) => x.id === id);
  if (!e) return back() + '<p class="muted pad">That moment has passed.</p>';
  const c = e.from ? w.chars[e.from] : undefined;
  let out = back();
  out += `<div class="pers">${c ? avatar(c) : '<div class="avatar fx">?</div>'}<div><h1>${esc(e.title)}</h1><div class="sub">${c ? lk(c.name) + (c.rank !== 'civilian' ? ' · ' + esc(c.rank[0].toUpperCase() + c.rank.slice(1)) : '') : 'Nobody you can name'}${e.status === 'open' && e.kind !== 'kin' ? ` · ${!c ? 'they' : isFemale(c) ? 'she' : 'he'}’ll want an answer ${esc(byWhen(w.now, e.expires))}` : ''}</div></div></div>`;
  out += `<div class="card">${e.lines.map((l, i) => `<p class="${i ? 'say' : ''}">${lk(l)}</p>`).join('')}${lines.map((l) => `<div class="note">${lk(l)}</div>`).join('')}</div>`;
  if (e.status === 'open') out += `<div class="list">${e.opts.map((o) => `<button class="opt" data-a="echoose:${e.id}|${o.code}"><b>${lk(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>`;
  else out += `<button class="btn primary" data-a="back:">Done</button>`;
  return out;
}

export function favoursCard(): string {
  const w = W();
  const p = P();
  const mine = owedTo(w, p.id);
  const ours = owing(w, p.id);
  let out = `<div class="card"><h2>Favours</h2>`;
  if (!mine.length && !ours.length) return out + `<p class="muted">Nobody owes you and you owe nobody. That won’t last.</p></div>`;
  out += `<ul class="rows">${mine.map((f) => `<li><span>${pl(w.chars[f.to])} owes you</span><span class="v good">${favourWord(f.size)}</span></li>`).join('')}${ours.map((f) => `<li><span>You owe ${pl(w.chars[f.from])}</span><span class="v warn">${favourWord(f.size)}</span></li>`).join('')}</ul></div>`;
  return out;
}

export function bizView(id: Id): string {
  const w = W();
  const p = P();
  const b = w.biz[id];
  if (!b) return back() + '<p class="muted pad">It’s gone.</p>';
  const o = w.chars[b.ownerId];
  const prot = b.protection;
  let out = back();
  out += `<div class="pers"><div class="avatar fx" style="border-radius:16px">${esc(b.name[0])}</div><div><h1>${esc(b.name)}</h1><div class="sub">${esc(b.kind)} &middot; ${esc(b.district)}</div></div></div>`;
  out += `<div class="tags"><span class="tag ${b.open ? 'green' : 'red'}">${b.open ? 'open' : 'closed'}</span>${b.damaged > 0 ? '<span class="tag amber">recovering</span>' : ''}${prot && lateOf(b) > 0 ? '<span class="tag red">late with the money</span>' : ''}</div>`;
  out += `<div class="card"><h2>Who has it</h2><ul class="rows"><li><span>Owner</span><span class="v">${pl(o)}</span></li>`;
  if (prot) out += `<li><span>Protected by</span><span class="v">${pl(w.chars[prot.collectorId])} &middot; ${fl(prot.familyId)}</span></li><li><span>Pays</span><span class="v">${prot.fee > 0 ? money(prot.fee) + ' a week' : 'run by the family'}</span></li>`;
  else out += `<li><span>Protection</span><span class="v warn">nobody yet</span></li>`;
  { const m = b.managerId ? w.chars[b.managerId] : undefined; if (m?.alive) out += `<li><span>Runs it</span><span class="v">${pl(m)}</span></li>`; }
  for (const s of b.stakes ?? []) if (s.holder === p.id || known(w, w.chars[s.holder])) out += `<li><span>${s.holder === p.id ? 'Your share' : 'Also has a share'}</span><span class="v">${s.holder === p.id ? Math.round(s.share * 100) + '%' : pl(w.chars[s.holder]) + ' &middot; ' + Math.round(s.share * 100) + '%'}</span></li>`;
  if ((b.owners ?? []).length) out += `<li><span>Before that</span><span class="v">${b.owners!.map((x) => esc(w.chars[x.id]?.name ?? '?')).join(', ')}</span></li>`;
  if (known(w, o)) { const tr = trade(w, b); out += `<li><span>Trade</span><span class="v">about ${money(Math.round(tr.weeks ? tr.revenue : b.income))} a week</span></li>`; const pf = perf(w, b).notes; if (pf.length) out += `<li><span>People say</span><span class="v">${esc(pf.join(', '))}</span></li>`; }
  out += `</ul></div>`;
  if (prot && lateOf(b) > 0 && prot.collectorId === p.id) out += `<div class="callout bad">${esc(o.name)} is behind by ${money(owedOf(b))}. You can send a man to shake him, or go yourself.</div><div class="row2"><button class="btn danger" data-a="shake:${b.id}">Shake him myself</button><button class="btn" data-a="orders:">Send a man</button></div>`;
  out += `<div class="row2"><button class="btn primary" data-a="talk:${o.id}">${esc(whereIs(w, p, o).kind === 'shop' ? 'Walk in and talk to ' + o.name.split(' ')[0] : 'Find ' + o.name.split(' ')[0])}</button>${!prot || prot.familyId !== p.familyId ? `<button class="btn" data-a="plan:lean|${b.id}">Lean on it</button>` : `<button class="btn" data-a="plan:burgle|${b.id}">Other ideas</button>`}</div>`;
  return out;
}

export function factView(id: Id): string {
  const w = W();
  const p = P();
  const f = w.facts[id];
  if (!f) return back() + '<p class="muted pad">Nobody remembers it.</p>';
  const k = p.known[id];
  const chain: string[] = [];
  let c = f.cause ? w.facts[f.cause] : undefined;
  for (let i = 0; c && i < 4; i++) {
    if (p.known[c.id]) chain.push(`${factText(c, p.known[c.id].knowsActor)}`);
    c = c.cause ? w.facts[c.cause] : undefined;
  }
  const knowers = Object.values(w.chars).filter((x) => x.alive && x.known[id] && x.id !== p.id).slice(0, 6);
  let out = back();
  out += `<div class="card"><h2>${esc(f.kind.replace(/_/g, ' '))}</h2><p class="say">${lk(k ? factText(f, k.knowsActor) : f.text)}</p><p class="src">${esc(shortTime(f.t))} &middot; ${esc(f.district)}${k ? ' &middot; ' + (k.from === 'witness' ? 'you saw it' : k.from === 'self' ? 'you did it' : k.from === 'public' ? 'word on the street' : 'heard from ' + esc(w.chars[k.from]?.name ?? 'someone')) : ''}</p></div>`;
  if (chain.length) out += `<div class="card"><h2>How it came about</h2>${chain.map((t) => `<div class="note">${lk(t)}</div>`).join('')}</div>`;
  const people = [f.actor, f.victim].filter(Boolean).map((x) => w.chars[x!]).filter(Boolean);
  if (people.length) out += `<div class="card"><h2>Those involved</h2><ul class="rows">${people.map((x) => `<li><span>${x.id === f.victim ? 'Hurt' : 'Did it'}</span><span class="v">${pl(x)}</span></li>`).join('')}</ul></div>`;
  if (knowers.length) out += `<div class="card"><h2>Who else knows</h2><p>${knowers.map((x) => pl(x)).join(', ')}</p></div>`;
  return out;
}

// ------------------------------------------------------------------ trees

function node(c: Character, cls = '', extra = ''): string {
  const w = W();
  const p = P();
  const st = statusOf(w, c);
  const faded = !known(w, c);
  return `<div class="node ${cls} ${c.id === p.id ? 'you' : ''} ${faded ? 'faded' : ''}"><span class="dot ${st.dot}"></span><div class="nn">${pl(c, c.id === p.id ? c.name + ' (you)' : c.name)}<small>${isRunner(w, c) ? (c.bossId === p.id ? 'your man' : 'runner') : c.rank}${c.problem?.revealed ? ' &middot; trouble' : ''}${extra}</small></div></div>`;
}
const openNode = (r: string) => `<div class="node open"><span class="dot dead"></span><div class="nn"><span>Open seat</span><small>${r}</small></div></div>`;

export function treeView(famId: Id): string {
  const w = W();
  const p = P();
  const fam = w.fam[famId] ?? w.fam[p.familyId!];
  const all = members(w, fam.id);
  const boss = w.chars[fam.bossId];
  const under = all.find((c) => c.rank === 'underboss');
  const capos = all.filter((c) => c.rank === 'capo');
  let out = `<h1 class="page">The families</h1><div class="pills">${Object.values(w.fam).map((f) => `<button class="pill ${f.id === fam.id ? 'on' : ''}" data-a="tree:${f.id}">${esc(f.name)}</button>`).join('')}</div>`;
  const tens = Object.values(w.fam).filter((o) => o.id !== fam.id).map((o) => `${esc(o.name)}: ${tensionWord(fam.id, o.id)}`).join(' &middot; ');
  out += `<p class="muted">${esc(fam.districts.join(', '))} &middot; ${all.length} men${fam.id === p.familyId ? ' &middot; <b>yours</b>' : ''}<br>${tens}</p>`;
  out += `<div class="tree">`;
  if (boss?.alive) out += node(boss, 'top');
  else out += `<div class="node top open"><div class="nn"><span>No boss</span><small>the family is without a head</small></div></div>`;
  out += `<div class="vline"></div>`;
  if (under) out += node(under, 'top');
  else out += `<div class="node top open"><div class="nn"><span>No underboss</span><small>vacant</small></div></div>`;
  out += `<div class="vline"></div></div>`;
  const kidsOf = (id: Id) => all.filter((c) => c.bossId === id).sort((a, b) => ['soldier', 'associate'].indexOf(a.rank) - ['soldier', 'associate'].indexOf(b.rank) || b.lifetimeKick - a.lifetimeKick);
  const openS = Math.max(0, capOf(w, fam.id, 'soldier') - seats(w, fam.id, 'soldier'));
  const openC = Math.max(0, capOf(w, fam.id, 'capo') - seats(w, fam.id, 'capo'));
  const q = queueOf(w, fam.id);
  const qx = (c: Character) => { const k = q.findIndex((r) => r.c.id === c.id); return k < 0 ? '' : ` &middot; <b>${k === 0 ? 'next in line' : '#' + (k + 1) + ' in line'}</b>`; };
  out += `<div class="crews">`;
  capos.forEach((cp, i) => {
    const kids = kidsOf(cp.id);
    // A crew opens when it is yours (or, in another family, the first); any crew opens or closes with a tap and stays that way.
    const below = (c: Character) => { let b = c.bossId; for (let n = 0; b && n < 4; n++) { if (b === cp.id) return true; b = w.chars[b]?.bossId ?? null; } return false; };
    const dflt = fam.id === p.familyId ? below(p) || cp.id === p.id : i === 0;
    const key = (dflt ? 'crewx:' : 'crew:') + cp.id;
    const open = dflt ? !S.open[key] : !!S.open[key];
    out += `<div class="crew ${open ? 'open' : ''}"><button class="hd" data-a="tog:${key}" aria-expanded="${open}"><span>The ${esc(cp.name.split(' ').slice(1).join(' ') || cp.name)} Crew</span><span>${all.filter(below).length} under him ${chevron}</span></button>${node(cp, 'top').replace('node top', 'node')}`;
    if (!open) { out += `</div>`; return; }
    const soldiers = kids.filter((k) => k.rank !== 'associate');
    const direct = kids.filter((k) => k.rank === 'associate');
    for (const s of soldiers) {
      out += node(s, 'sub');
      for (const a of kidsOf(s.id)) { out += node(a, 'sub2', qx(a)); for (const r of kidsOf(a.id)) out += node(r, 'sub3'); }
    }
    if (direct.length) out += `<div class="org-lab">Reporting straight to ${esc(cp.name.split(' ')[0])}</div>` + direct.map((a) => node(a, 'sub', qx(a)) + kidsOf(a.id).map((r) => node(r, 'sub2')).join('')).join('');
    if (i < openS) out += openNode('soldier');
    out += `</div>`;
  });
  if (openC) for (let i = 0; i < openC; i++) out += `<div class="crew"><div class="hd"><span>Open</span><span></span></div>${openNode('capo')}</div>`;
  out += `</div>`;
  if (fam.id === p.familyId && p.rank === 'associate' && !capos.some((cp) => kidsOf(cp.id).some((k) => k.id === p.id))) out += `<p class="muted">You answer to ${p.bossId ? pl(w.chars[p.bossId]) : 'nobody'}.</p>`;
  void vacancy;
  return out;
}

export function tensionWord(a: Id, b: Id): string {
  const t = W().fam[a].tension[b] ?? 0;
  return t < 2 ? 'calm' : t < 5 ? 'uneasy' : t < 9 ? 'tense' : 'on a war footing';
}
void banner; void skillBars; void who; void chip; void standingWord;


// What you can legitimately say about one of your men: what he reports, what he runs, what has happened to him.
function recordCard(w: World, p: Character, c: Character): string {
  const h = c.books.history.slice(-8);
  const max = Math.max(1, ...h.map((x) => x.declared));
  const bars = h.length ? `<div class="spark">${h.map((x) => `<i title="${money(x.declared)}" style="height:${Math.max(6, Math.round((x.declared / max) * 38))}px"></i>`).join('')}</div>` : '<p class="muted">Nothing on record yet.</p>';
  const srcs = new Set<string>();
  for (const x of h) for (const k of visibleSources(c, x.sources)) srcs.add(SOURCE_LABEL[k] ?? k);
  const ops = w.ops.filter((o) => o.runner === c.id && (o.state === 'running' || o.state === 'out'));
  const shops = Object.values(w.biz).filter((b) => b.open && b.protection?.collectorId === c.id).length;
  const k = c.career;
  const rows: string[] = [];
  rows.push(`<li><span>Reports (last ${h.length || 0} weeks)</span><span class="v">${h.length ? money(Math.round(h.reduce((a, x) => a + x.declared, 0))) : '–'}</span></li>`);
  rows.push(`<li><span>Passed up to you</span><span class="v">${money(h.reduce((a, x) => a + x.paid, 0))}</span></li>`);
  if (c.books.arrears > 0) rows.push(`<li><span>Owes</span><span class="v">${money(c.books.arrears)}</span></li>`);
  if (srcs.size) rows.push(`<li><span>Income he reports from</span><span class="v">${[...srcs].map(esc).join(', ')}</span></li>`);
  if (lineOf(w, c)) rows.push(`<li><span>His own line</span><span class="v">${esc(enterpriseLine(w, c)!)}</span></li>`);
  if (ops.length || shops) rows.push(`<li><span>Running for you</span><span class="v">${[ops.length ? `${ops.length} racket${ops.length > 1 ? 's' : ''}` : '', shops ? `${shops} shop${shops > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}</span></li>`);
  rows.push(`<li><span>Jobs for you</span><span class="v">${k ? `${k.done} done, ${k.failed} botched` : 'none yet'}</span></li>`);
  const ev = k?.log.slice(-5).reverse() ?? [];
  return `<div class="card"><h2>His record<small>as far as you know</small></h2>${bars}<ul class="rows">${rows.join('')}</ul>${ev.length ? `<h3 class="sub">What’s happened to him</h3>${ev.map((e) => `<div class="note">${esc(shortTime(e.t))}: ${esc(e.text)}</div>`).join('')}` : ''}</div>`;
}
