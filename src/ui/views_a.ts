import { epilogue } from '../epilogue';
import { spots } from '../city';
import { tradeOf } from './streetmap';
import { fallingDue } from '../commitments';
import { knowsProtection } from '../acquaint';
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
import { activityOf, KIND_LABEL, playerSide, standingWord, staleReason } from '../jobs';
import { GIG_LABEL } from '../gigs';
import { lateOf, PROBLEM_LABEL } from '../people';
import { Character, DAY, Enc, Id, World } from '../types';
import { isOpen } from '../situ';
import { arch } from '../voice';
import { isMade, sanctioned } from '../politics';
import { isFemale, isPartner, kinOf, kinWord, stageWord, warmthWord } from '../life';
import { dangerLevel, LADDER_WORDS } from '../danger';
import { favourWord, owedTo, owing } from '../encounters';
import { crewList, waitChoices } from './views_b';
import { canMeetAt } from '../enterprise';
import { prospects } from '../orders';
import { myDisputes, playerMoved } from './views_c';
import { storiesTab, storiesOf, storyKnown, type Story } from './stories';
import { ambitionCard } from './ambview';
import { AMBS } from '../ambition';
import { whereIs } from '../where';
import { TAGS, noteOf } from '../notebook';
import { WANT_LINE } from '../crewlife';
import { comingUp } from './brief';
import { sundayDue } from './sunday';
import { byWhenWord } from './when';
import { between } from './between';
import { acts, btn, choices, context, h, kv, meter, note, quiet, rows, title, type KV, type Pick, type Row } from './kit';
import { relationOf } from '../conv/kit';
import { ARCH_WORD } from '../voice';
import { traitWords } from '../jobs';
import { avatar, banner, back, chevron, meterRow, skillBars, skillLine, traitTags } from './common';
import { toSide } from './layout';
import { bl, chip, esc, famClass, fl, known, lk, P, pl, S, statusOf, W, who } from './links';

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
  pay?: number; // (what it pays, when it is work on offer)
  from?: Id; // (who it comes from, when that is not a man waiting on you)
  due?: number; // (when it runs out)
}
export const isAttn = (n: Need) => n.dot === 'red' || n.dot === 'amber' || n.a === 'sunday:';
export const attentionCount = () => needs().filter(isAttn).length;

// (when something runs out, as a man would put it: ui/when.ts)
export const byWhen = byWhenWord;
const firstName = (c: Character) => c.name.split(' ')[0];
// What kind of approach it is, in a word or two (never the record's own label).
const ENC_K: Record<string, string> = {
  threat: 'A threat', ask: 'Wants something', word: 'Wants a word', matter: 'Wants your answer', callin: 'Calling in a favour',
  squeeze: 'Another family', ent: 'Your racket', invite: 'An invitation', kin: 'Family', imposed: 'Decided over your head', courting: 'A quiet word', crossdeal: 'Another family', cometo: 'Your crew', quarrel: 'Your crew', answer: 'Answer for your man', score: 'A truck', bigbet: 'Your book', cantpay: 'Your book', rivalbook: 'Your book', pad: 'Your book',
};
function approach(w: World, e: Enc, story?: Story): Need {
  const c = e.from ? w.chars[e.from] : undefined;
  const by = byWhen(w.now, e.expires);
  const he = !c ? 'They' : isFemale(c) ? 'She' : 'He';
  const wait = e.kind === 'kin' ? '' : `${he}’ll want an answer ${by}.`;
  const dot = e.kind === 'threat' ? 'red' : story ? (story.tone === 'red' ? 'red' : 'amber')
    : e.kind === 'callin' || e.data?.what === 'sit_turf' || e.kind === 'ask' || e.kind === 'word' || e.kind === 'matter' || e.kind === 'imposed' || e.kind === 'courting' || e.kind === 'crossdeal' || e.kind === 'answer' || e.kind === 'quarrel' || e.kind === 'cantpay' || e.kind === 'bigbet' || e.kind === 'ent' ? 'amber' : e.kind === 'invite' ? 'blue' : 'green';
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
  return { debt: 'Money owed', threat: 'Coming after you', hunt: 'Coming after you', turf: 'Your ground', dispute: 'A quarrel', crew: 'One of your men', seat: 'Your future', shop: 'Your shop', envelope: 'Your envelope' }[s.kind];
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
    // (one card per matter: when he has sent for the player about the money, that summons is the card, and says what is owed)
    const sentFor = !!boss && w.jobs.some((j) => j.kind === 'summons' && j.status === 'offered' && j.giver === boss.id && j.meeting === 'accounts');
    const owes = !!boss?.alive && !!w.sunday && kickWindow(w, p) && envelopeDue(w, p) > 0 && !sentFor;
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
    if (s.kind === 'envelope') continue; // (the envelope, or the summons about it, is already its card)
    if (s.pending && out.some((n) => n.a === `story:${s.key}`)) continue;
    if (out.some((n) => n.a === `dispute:${s.key}` || n.a === `story:${s.key}`)) continue;
    // (a request of the player's that was turned down is not something wanting him: it is there if he wants to try again)
    const sit = s.kind === 'matter' ? (w.situations ?? []).find((x) => 'sit:' + x.id === s.key) : undefined;
    const refused = !!sit && sit.terms?.by === p.id && (sit.phase === 'refused' || sit.st?.[sit.terms?.of ?? '']?.last === 'no');
    out.push({ dot: refused ? 'green' : s.tone === 'red' ? 'red' : 'amber', k: refused ? 'Turned down' : storyK(w, p, s), title: s.title, sub: refused ? `${s.stage.replace(/[.!?]?$/, '.')} You can try again, or let it go.` : s.stage, a: `story:${s.key}` });
  }
  // his word, falling due: what he promised a man, and when he said it would be done (commitments.ts: every record his word is kept in)
  for (const r of fallingDue(w, p)) {
    const c = w.chars[r.with];
    if (r.src === 'memo') { const m = c.memos.find((x) => x.id === r.ref), j = m?.ref ? w.jobs.find((x) => x.id === m.ref) : undefined; if (j && j.status !== 'offered' && j.status !== 'active') continue; }
    out.push({ dot: r.late ? 'red' : 'amber', k: 'Your word', title: `What you told ${c.name}`, sub: `${r.text} ${isFemale(c) ? 'She' : 'He'} ${r.late ? 'expected it done by now.' : `expects it done ${byWhen(w.now, r.due!)}.`}`, a: `talk:${c.id}`, who: c.id });
  }
  for (const j of w.jobs.filter((x) => x.status === 'offered' && playerSide(w, x) && !staleReason(w, x)).sort((a, b) => Number(b.kind === 'summons') - Number(a.kind === 'summons') || Number(b.via === 'boss') - Number(a.via === 'boss'))) {
    out.push({ dot: j.kind === 'summons' || j.via === 'boss' ? 'amber' : j.via === 'tip' || j.kind === 'gig' ? 'green' : 'green', k: j.kind === 'gig' ? GIG_LABEL[String(j.extra?.gig) as keyof typeof GIG_LABEL] ?? 'Opportunity' : KIND_LABEL[j.kind], title: j.title, sub: `${j.meeting === 'accounts' && p.books.arrears >= 20 ? `You owe him ${money(Math.round(p.books.arrears))}. ` : ''}${j.giver ? 'From ' + w.chars[j.giver]?.name : 'A tip'}${j.pay > 0 ? ', about ' + money(j.pay) : ''}. It won’t wait past ${byWhen(w.now, j.expires).replace(/^by /, '')}.`, when: byWhen(w.now, j.expires).replace(/^by /, ''), a: `job:${j.id}`, pay: j.pay, from: j.giver ?? undefined, due: j.expires });
  }
  // work he has taken on and not finished: his, wherever he said yes to it, until it is done (doing what it asks, his own way, does it)
  for (const j of w.jobs.filter((x) => x.status === 'active' && x.assignee === p.id && x.kind !== 'summons' && x.giver !== p.id)) {
    const g = j.giver ? w.chars[j.giver] : undefined;
    // (one card per matter: putting it to the owner is the work; once that talk is under way, its card is this job's card too)
    const owner = j.kind === 'lean' && j.biz ? w.biz[j.biz]?.ownerId : undefined;
    const talk = owner ? (w.situations ?? []).find((x) => x.ak === 'protect' && x.terms?.by === p.id && x.terms?.of === owner && isOpen(x)) : undefined;
    const card = talk ? out.find((n) => n.a === `story:sit:${talk.id}`) : undefined;
    if (card) { if (g) card.sub = `${card.sub.replace(/[.!?]?$/, '.')} ${g.name} is waiting on it.`; continue; }
    out.push({ dot: 'amber', k: 'Work you took on', title: j.title, sub: `${g ? `For ${g.name}. ` : ''}${j.kind === 'lean' && j.biz && w.biz[j.biz] ? `Go and see ${w.chars[w.biz[j.biz].ownerId]?.name ?? 'the owner'} and put it to him. It’s done when he pays you.` : 'Open it to see it through.'}`, a: `job:${j.id}`, who: g?.id });
  }
  // work done and not yet told to the man who gave it
  // (a man who gave you work wants to hear it's done: owed him, not on offer; one card a man, however many jobs; coming when he sent for
  // you is not work to report)
  const told = new Map<string, string[]>();
  for (const j of w.jobs.filter((x) => x.status === 'done' && !x.reported && x.kind !== 'summons' && x.assignee === p.id && x.giver && x.giver !== p.id && w.chars[x.giver]?.alive && w.now - x.created < 30 * DAY)) told.set(j.giver!, [...(told.get(j.giver!) ?? []), j.title]);
  const above = new Set<string>(); for (let c = p.bossId ? w.chars[p.bossId] : undefined, i = 0; c && i < 5; c = c.bossId ? w.chars[c.bossId] : undefined, i++) above.add(c.id);
  for (const [gid, titles] of told) { const g = w.chars[gid]; out.push({ dot: above.has(gid) ? 'amber' : 'blue', k: 'Done', title: `Tell ${g.name} how it went`, sub: titles.join(' · '), a: `talk:${g.id}`, who: g.id }); }
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
export function needRow(n: Need): Row {
  const w = W(), c = n.who ? w.chars[n.who] : undefined;
  const plain = (x: string) => lk(x).replace(/<a [^>]*>(.*?)<\/a>/g, '$1');
  // (a label that the title already says is left off: "A quarrel" over "A quarrel: Sammy and Gino")
  const k = n.k && !plain(n.title).toLowerCase().startsWith(n.k.toLowerCase()) ? n.k : '';
  return { face: c ? avatar(c) : undefined, mark: c ? undefined : n.dot === 'blue' ? 'blue' : n.dot, kick: c ? `${c.name}${k ? ' · ' + k : ''}` : k, title: plain(n.title), sub: plain(n.sub), tone: n.dot === 'red' ? 'bad' : '', a: n.a };
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
    : [prot ? 'Offer a shopkeeper protection, and press it' : 'Offer a shopkeeper protection', 'Under Business, Work going, Protection: pick a shop and put it to the owner. If he says no, it isn’t over: you can come back to it with better terms, an argument, or time.', prot, 'sub:business.work', 'Find a shop'];
  const steps: [string, string, boolean, string, string][] = [
    ['Show your face to ' + (boss?.name ?? 'your boss'), 'He is the man you answer to. Respect starts with turning up.', !!g['g:boss'], boss ? `talk:${boss.id}` : '', 'Go and find him'],
    ['Ask a man what’s on his mind', `Every man has his own worries. In a conversation, open Personal or People & rumours: ask how he’s keeping, buy him a drink, and let him talk about himself.${peer && peer !== boss ? ` ${peer.name} is in the same crew as you.` : ''}`, tk, peer ? `talk:${peer.id}` : 'people:', peer ? `Talk to ${firstName(peer)}` : 'Find someone'],
    ['Sit down with a man at the club', 'Sit with one of your own at the club. What is between you comes first; then pick a subject: Work & money, Personal, Settle something.', !!g['g:aside'], 'place:club', 'Go to the club'],
    protStep,
    ['Follow a story', 'Stories keeps every matter you know of, in the order you learned it, and what you can do about it. Open one.', !!g['g:story'], 'tab:stories', 'Open Stories'],
    ['Let a week go by', 'Choose Next week under Let time pass. The world moves while you do: men answer you, rackets pay, stories move on. It stops early if something comes for you.', !!g['g:wait'] && w.now >= 7 * DAY, 'wait:', 'Let time pass'],
  ];
  const done = steps.filter((x) => x[2]).length;
  if (done === steps.length) return '';
  const next = steps.findIndex((x) => !x[2]);
  // One step at a time: the step in front of you, a way to get there, and the rest folded away.
  const rest = steps.map((x, i) => `<li class="${x[2] ? 'ok' : i === next ? 'now' : ''}">${x[2] ? '✓ ' : i === next ? '→ ' : '· '}${esc(x[0])}</li>`).join('');
  return `<div class="ui-card guide g-guide"><h2>Your first week<small>${done} of ${steps.length}</small></h2><p class="g-guide__step">${esc(steps[next][0])}</p><p class="muted">${esc(steps[next][1])}</p><div class="g-guide__acts">${steps[next][3] ? `<button class="ui-btn ui-btn--primary" data-a="${esc(steps[next][3])}">${esc(steps[next][4])}</button>` : ''}<details class="fold"><summary class="ui-btn ui-btn--quiet">All ${steps.length} steps</summary><ul class="gl">${rest}</ul></details><button class="ui-btn ui-btn--quiet" data-a="guideoff:">Skip the guide</button></div></div>`;
}

// What just happened, and what it changed: shown wherever the player is when it happens (Today, or the place he is in)
// Who in this room has something for you: what Today would list, found where he is
export function wantsHere(ids: Set<string>): string {
  const xs = needs().filter((n) => n.who && ids.has(n.who));
  return xs.length ? h('Wants a word', String(xs.length)) + rows(xs.map(needRow)) : '';
}
export function justNow(at?: string): string {
  if (at && S.logAt !== at) return '';
  const fx = S.chips.length ? `<p class="wd-fx" aria-label="What changed">${S.chips.map((c) => (c.a ? `<button class="${c.tone}" data-a="${esc(c.a)}" title="Where it came from">${esc(c.t)} ›</button>` : `<span class="${c.tone}">${esc(c.t)}</span>`)).join('')}</p>` : '';
  if (S.log.length) return `<section class="wd-just" aria-label="Just now">${S.log.map((l) => `<p>${l}</p>`).join('')}${fx}</section>`;
  return fx;
}
export function todayView(): string {
  const w = W();
  const p = P();
  let out = '';
  if (!p.alive) {
    // the end, told: how it ended, the life, the funeral, the Herald (epilogue.ts)
    const e = epilogue(w, p);
    return title('The end', esc(e.how)) + (e.who ? context([esc(e.who)]) : '') + h('The life') + e.life.map((l) => `<p>${esc(l)}</p>`).join('')
      + h('The funeral', String(e.mourners.length)) + (e.mourners.length ? `<p>${esc(e.mourners.map((c) => c.name).join(', '))} came.</p>` : quiet('Hardly anyone came. The ones who did kept their hats on.'))
      + (e.glad.length ? `<p>${esc(e.glad.map((c) => c.name).join(', '))} ${e.glad.length === 1 ? 'was' : 'were'} not sorry.</p>` : '')
      + h('The Herald') + `<p class="herald-line">${esc(e.herald)}</p>` + acts(btn('reset:go', 'Start a new life', 'primary'));
  }
  // Today (owner, 27 October): the man and the hour first, with time in reach beneath them; what is waiting on him; the
  // opportunities as one list, each opening to what it is; his crew as faces; the Herald's headline. The rest has its own section.
  out += todayHead(w, p) + timeStrip();
  const dg = dangerLevel(w);
  if (dg.level > 0 && dg.who) out += context([`<b>Watch your back.</b> ${lk(dg.who.name)} is after you: ${esc(LADDER_WORDS[dg.level])}. It won’t stop by itself.`], true);
  // out from inside: the account of it, once, before anything else (inside.ts)
  if (p.inside?.done && !p.inside.seen && p.inside.account?.length) out += `<section class="wd-inside ui-card" aria-label="Inside"><h2>Back on the street</h2>${p.inside.account.map((l, i) => `<p${i ? '' : ' class="lead"'}>${lk(l)}</p>`).join('')}${acts(btn('insideok:', 'Get back to it', 'primary'))}</section>`;
  // what just happened, and what it changed
  out += justNow();
  // ---- waiting on you: one card per matter, the most pressing first
  const ns = needs();
  // (the same thing twice is one card: "Tell Sal Gallo how it went" for three jobs is one visit)
  const seen = new Set<string>();
  const attn = ns.filter(isAttn), opps = ns.filter((n) => !attn.includes(n) && !seen.has(n.title) && !!seen.add(n.title));
  if (attn.length) {
    const first = attn[0], c0 = first.who ? w.chars[first.who] : undefined;
    out += fold('wait', 'Waiting on you', attn.length, esc(stripLinks(first.title)) + (attn.length > 1 ? ` <i>and ${attn.length - 1} more</i>` : ''), rows(attn.map(needRow)), true, c0 ? [c0] : [], attn.some((n) => n.dot === 'red'));
  } else out += `<p class="td-calm">Nothing is pressing. The day is yours.</p>`;
  out += guideCard();
  // ---- what reached you while time passed
  const word = S.news.slice(0, 3);
  if (word.length) out += h('Word reaches you') + `<ul class="wd-news">${word.map((n) => `<li>${n}</li>`).join('')}</ul>`;
  // ---- opportunities: one list, each a line that opens
  out += oppList(w, [...opps, ...couldDo(w, p)]);
  // ---- your crew, as faces
  out += crewStrip(w, p);
  // ---- the paper: its headline
  const paper = (w.papers ?? []).at(-1);
  if (paper) { const fresh = (S.seenBrief ?? 0) < paper.t; out += `<button class="td-paper" data-a="brief:"><span class="td-paper__mast">The Herald</span><span class="td-paper__date">${esc(longDate(paper.t))}${fresh ? ' · <b>new</b>' : ''}</span><span class="td-paper__lead">${esc(paper.lead)}</span></button>`; }

  // ---- beside it (desktop): where you stand, briefly
  const steps = promoSteps(w, p), a_ = p.ambition, amb = a_ ? AMBS.find((x) => x.kind === a_.kind) : undefined;
  const now = steps ? `being considered: ${steps.filter((x) => x.state === 'done').length} of ${steps.length} steps` : pathInfo(w, p) ? 'on the path' : `reputation ${standingWord(p.standing)}`;
  let side = `<button class="ui-card g-career" data-a="career:"><h2>Your road<small>&rsaquo;</small></h2><p><b class="g-cap">${esc(p.rank)}</b> · ${esc(now)}</p>${amb ? `<p class="muted">Ambition: ${esc(amb.label)}${a_?.done ? ' (done)' : ''}</p>` : ''}</button>`;
  const more = comingUp().slice(1, 4);
  if (more.length) side += `<div class="ui-card"><h2>Later</h2><ul class="ui-list">${more.map((c) => `<li><span>${esc(shortTime(c.t))}</span><span class="v" style="text-align:left;margin-left:12px">${esc(c.text)}</span></li>`).join('')}</ul></div>`;
  toSide(side);
  return out;
}

// What your position puts in reach today, as opportunities with no deadline: never what another section already offers as a matter
// of course (the heat is in the top bar, the crew has its own row).
function couldDo(w: World, p: Character): Need[] {
  const out: Need[] = [];
  if (p.job) { const done = p.job.last === Math.floor(w.now / DAY); if (!done) out.push({ dot: 'blue', k: 'Honest work', title: 'Work a shift', sub: `${p.job.kind} at ${p.job.biz ? w.biz[p.job.biz].name : w.chars[p.job.boss].name}. Honest money, and cover.`, a: 'shift:' }); }
  else if (p.rank === 'associate' && w.now < 21 * DAY && !w.goals?.done['g:club']) { const cl = spots(w).find((x) => x.kind === 'club' && x.famId === p.familyId); out.push({ dot: 'blue', k: 'Be seen', title: 'Go down to the club', sub: 'The men who matter drink their coffee there, and work goes to the faces it sees.', a: cl ? `spot:${cl.id}` : 'tab:street' }); }
  const hint = grudgeHint();
  if (!/^no\b|nobody|nothing/i.test(hint)) out.push({ dot: 'blue', k: 'A score to settle', title: 'Settle a score', sub: hint.charAt(0).toUpperCase() + hint.slice(1) + '.', a: 'grudges:' });
  return out;
}

const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hhmm = (t: number) => `${String(Math.floor((t % DAY) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
// (the world's minute 0 is Monday 2 March 1970, 00:00)
export function longDate(t: number): string { const d = new Date(Date.UTC(1970, 2, 2) + t * 60000); return `${WEEKDAY[Math.floor(t / DAY) % 7]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; }

// The man and the hour: his face, the day and the time as the clock says it, and where he stands in a line.
function todayHead(w: World, p: Character): string {
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const men = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id).length;
  const rank = p.jailedUntil > w.now ? 'Inside' : ({ civilian: 'Nobody’s man yet', associate: 'Associate', soldier: 'Made man', capo: 'Captain', underboss: 'Underboss', boss: 'Boss' } as Record<string, string>)[p.rank] ?? p.rank;
  const where = [rank, p.rank === 'underboss' || p.rank === 'boss' ? `the ${famName(w, p)} family` : boss ? `${boss.name.split(' ').at(-1)}’s crew` : p.familyId ? `the ${famName(w, p)} family` : '', men ? `${men} ${men === 1 ? 'man' : 'men'} of your own` : ''].filter(Boolean).join(' · ');
  return `<header class="td-hero"><button class="td-hero__me" data-a="ent:${p.id}" aria-label="Your page">${avatar(p)}</button><div class="td-hero__t"><p class="td-hero__day">${esc(longDate(w.now))} 1970</p><p class="td-hero__clock">${hhmm(w.now)}</p><p class="td-hero__who"><b>${esc(p.name)}</b> ${esc(where)}</p></div></header>`;
}

// Time, in reach under the clock: where each choice takes him, by the clock.
function timeStrip(): string {
  const w = W(), today = Math.floor(w.now / DAY);
  const day = (t: number) => WEEKDAY[Math.floor(t / DAY) % 7].slice(0, 3);
  return `<nav class="td-time" aria-label="Let time pass">${waitChoices().map((o, i) => {
    const at = w.now + o.mins;
    const sub = o.event ? 'or sooner' : Math.floor(at / DAY) === today || o.label === 'Sunday' ? hhmm(at) : `${day(at)} ${hhmm(at)}`;
    return `<button data-a="waitgo:${i}"><b>${esc(o.label === 'Next week' ? 'A week' : o.label)}</b><span>${esc(sub)}</span></button>`;
  }).join('')}</nav>`;
}

// The opportunities: one list, each line what it is and what it pays, opening to who it is from, until when, and the way in.
function oppList(w: World, xs: Need[]): string {
  if (!xs.length) return '';
  const today = Math.floor(w.now / DAY);
  const tone = (x: Need) => x.due !== undefined ? (Math.floor(x.due / DAY) <= today ? 'now' : Math.floor(x.due / DAY) - today < 3 ? 'soon' : 'later') : x.dot === 'red' ? 'now' : x.dot === 'amber' ? 'soon' : 'later';
  const plain = (x: string) => lk(x).replace(/<a [^>]*>(.*?)<\/a>/g, '$1');
  const order = { now: 0, soon: 1, later: 2 } as const;
  const sorted = xs.slice().sort((a, b) => order[tone(a)] - order[tone(b)] || (a.due ?? 1e12) - (b.due ?? 1e12));
  const item = (x: Need) => {
    const c = x.from ? w.chars[x.from] : x.who ? w.chars[x.who] : undefined, tn = tone(x);
    const facts: KV[] = [];
    if (c) facts.push(['From', pl(c)]);
    if (x.pay) facts.push(['Pays', `about ${money(x.pay)}`]);
    if (x.due !== undefined) facts.push(['Until', esc(Math.floor(x.due / DAY) <= today ? `today, ${hhmm(x.due)}` : `${longDate(x.due)}`)]);
    const about = x.due !== undefined && x.pay !== undefined ? '' : `<p class="td-op__sub">${plain(x.sub)}</p>`;
    return `<details class="td-op ${tn}"><summary><i class="td-op__dot" aria-hidden="true"></i><span class="td-op__t"><small>${esc(x.k ?? '')}</small>${plain(x.title)}</span><span class="td-op__v">${x.pay ? money(x.pay) : tn === 'now' ? 'today' : esc(x.when ?? '')}</span></summary><div class="td-op__body">${about}${facts.length ? `<dl class="td-op__facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}<button class="ui-btn ui-btn--primary" data-a="${esc(x.a)}">Look into it</button></div></details>`;
  };
  const top = sorted.slice(0, 5), rest = sorted.slice(5);
  const nToday = sorted.filter((x) => tone(x) === 'now').length, onOffer = sorted.reduce((a, x) => a + (x.pay ?? 0), 0);
  const line = [nToday ? `<em>${nToday} today</em>` : '', onOffer ? `${money(onOffer)} on offer` : '', !nToday && !onOffer ? esc(stripLinks(sorted[0].title)) : ''].filter(Boolean).join(' · ');
  return fold('ops', 'Opportunities', xs.length, line, `<div class="td-ops">${top.map(item).join('')}${rest.length ? `<details class="td-ops__more"><summary>${rest.length} more</summary>${rest.map(item).join('')}</details>` : ''}</div>`);
}

const stripLinks = (x: string) => lk(x).replace(/<[^>]+>/g, '');
// A section of Today folded to one line: what it is, how many, and the gist (with faces where it is about men); open, the whole of
// it. Remembered while you play (S.open); what is waiting on you starts open, the rest closed.
function fold(key: string, label: string, n: number, line: string, body: string, startOpen = false, faces: Character[] = [], hot = false): string {
  const k = `td:${key}${startOpen ? ':shut' : ''}`, open = startOpen ? !S.open[k] : !!S.open[k];
  const fs = faces.length ? `<span class="td-fold__faces">${faces.map((c) => avatar(c)).join('')}</span>` : '';
  return `<section class="td-fold${open ? ' open' : ''}${hot ? ' hot' : ''}"><button class="td-fold__h" data-a="tog:${k}" aria-expanded="${open}"><span class="td-fold__l">${esc(label)}${n ? `<b>${n}</b>` : ''}</span>${fs}<span class="td-fold__s">${line}</span><i class="td-fold__c" aria-hidden="true">›</i></button>${open ? `<div class="td-fold__b">${body}</div>` : ''}</section>`;
}

// His crew as faces: what each is doing, in a word, and a man in trouble marked.
function crewStrip(w: World, p: Character): string {
  const men = crewList();
  // (before the first man: the crew is still there, as what a man builds)
  if (!men.length) return fold('crew', 'Your crew', 0, 'Nobody yet', `<p class="td-fold__p">Nobody takes your orders yet. A man of your own brings you an envelope every Sunday and does what you send him to do.</p>${acts(prospects(w, p).length ? btn('recruit:', 'Take on a man', 'primary') : btn('sub:people.men', 'Your men'))}`);
  const state = (c: Character): [string, string] => {
    const st = statusOf(w, c);
    if (st.dot === 'red') return [st.word, 'bad'];
    if (c.books.arrears > 0) return [`owes ${money(Math.round(c.books.arrears))}`, 'bad'];
    return activityOf(w, c) ? ['working', ''] : ['free', 'idle'];
  };
  const trouble = men.filter((c) => state(c)[1] === 'bad').length, free = men.filter((c) => state(c)[1] === 'idle').length;
  const line = [trouble ? `<em>${trouble} in trouble</em>` : '', free ? `${free} free` : 'all working'].filter(Boolean).join(' · ');
  return fold('crew', 'Your crew', men.length, line, `<div class="td-crew">${men.map((c) => { const [word, tn] = state(c); return `<button class="td-man ${tn}" data-a="ent:${c.id}">${avatar(c)}<b>${esc(c.name.split(' ')[0])}</b><span>${esc(word)}</span></button>`; }).join('')}<button class="td-man td-man--orders" data-a="orders:"><i aria-hidden="true">›</i><b>Orders</b><span>${free} free</span></button></div>`, false, men.slice(0, 4), trouble > 0);
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
  if (!c) return back() + quiet('Nobody by that name.');
  const st = statusOf(w, c);
  const isMe = c.id === p.id;
  const kn = known(w, c);
  const b = ownerBiz(w, c.id);
  const boss = c.bossId ? w.chars[c.bossId] : undefined;
  const men = Object.values(w.chars).filter((x) => x.alive && x.bossId === c.id);
  const r = c.rels[p.id];
  const He = isFemale(c) ? 'She' : 'He';
  const k = kinOf(w, c.id);
  const inLife = !!k && c.rank !== 'civilian';
  const partner = isPartner(w, c.id);
  // ---- who he is
  const rank = c.rank === 'capo' ? 'captain' : c.rank;
  const role = c.rank === 'civilian' ? (b ? `Owner, ${esc(b.name)}` : 'Not in the life') : c.familyId ? `${esc(w.fam[c.familyId].name)} family` : 'Independent';
  let out = back();
  out += `<header class="pp-head">${avatar(c)}<div class="pp-id"><h1 class="ui-title">${esc(c.name)}${isMe ? ' <small>(you)</small>' : ''}</h1><p class="pp-meta"><span class="ui-chip ${c.rank === 'civilian' ? '' : famClass(c.familyId)}">${esc(rank)}</span> ${role} · ${esc(c.district)}</p>`;
  out += `<p class="pp-tags"><span class="ui-mark ${st.dot}" aria-hidden="true"></span>${esc(st.word)}${kn ? ` · ${esc(ARCH_WORD[arch(c)])} · ${esc(traitWords(c))}` : ''}${kn && c.problem?.revealed ? ` · <b>${esc(PROBLEM_LABEL[c.problem.kind])}</b>` : ''}${c.prospect ? ' · looking for a start' : ''}</p>`;
  if (k && c.alive) out += `<p class="pp-kin">${esc(kinWord(k))} · ${esc(warmthWord(k.warmth))} · last seen ${(() => { const d = Math.max(0, Math.floor((w.now - k.lastSeen) / DAY)); return d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; })()}</p>`;
  else if (partner && c.alive) out += `<p class="pp-kin">${esc(stageWord[w.life!.partner!.stage])} · ${esc(warmthWord(w.life!.partner!.warmth))}</p>`;
  out += `</div></header>`;
  if (!kn) out += context(['You have never met him. Everything you know is a name.']);
  // ---- what you can do with him: talking first; taking action against him last, and not as loud
  if (!isMe && c.alive) {
    const wh = whereIs(w, p, c);
    const first: string[] = [];
    if (k && !inLife) first.push(btn(`visit:${c.id}`, 'Spend an hour', 'primary'), btn('tab:life', 'Your life'));
    else if (partner) first.push(btn(`date:${c.id}`, 'Take her out ($60)', 'primary'), btn('tab:life', 'Your life'));
    else first.push(wh.kind === 'jail' ? btn(`talk:${c.id}`, 'Locked up', 'primary', ' disabled') : btn(`talk:${c.id}`, `Talk: ${wh.name}`, 'primary'));
    if (c.bossId === p.id) first.push(btn(`orders:${c.id}`, 'Give orders'), btn(`books:${c.id}`, 'His books'));
    if (c.bossId === p.id && c.problem) first.push(btn(`help:${c.id}`, 'Something is wrong'));
    if (inLife) first.push(btn(`visit:${c.id}`, 'Family time (an hour)'));
    out += acts(...first);
    const more: string[] = [];
    if (b) more.push(btn(`biz:${b.id}`, 'His business', 'quiet'));
    if (c.familyId) more.push(btn(`tree:${c.familyId}`, 'Their family', 'quiet'));
    if (kn) { const nt = noteOf(p, c.id); more.push(btn(`npin:${c.id}`, nt?.pin ? '★ Pinned' : '☆ Pin', 'quiet')); }
    if (!k && !partner) more.push(btn(`settle:${c.id}`, 'Take action against him', 'danger'));
    // (the rest folds away: his business, his family, a pin, and taking action against him)
    if (more.length) out += `<details class="pp-more"><summary>More</summary>${acts(...more)}</details>`;
  }
  if (isMe) out += acts(btn('tab:life', 'Your life'));
  // ---- what is between you, as the conversation shows it (ui/between.ts), and what shows on him
  if (kn && !isMe) {
    const ties = between(w, p, c);
    const shows = personTexture(w, p, c);
    // how he sees you, in words (no meters: a man is not a set of numbers), then what is between you
    const f = viewOf(w, c, p).fear, He_ = isFemale(c) ? 'She' : 'He';
    const how = [relationOf(w, p, c).words, f >= 0.55 ? `${He_}’s afraid of you.` : f >= 0.3 ? `${He_}’s wary of you.` : ''].filter(Boolean).join(' ');
    out += h('Between you') + `<p class="pp-how">${esc(how)}</p>` + rows([...ties.map((t): Row => ({ title: t.text, mark: t.tone === 'good' ? 'green' : t.tone === 'bad' ? 'red' : t.tone === 'warn' ? 'amber' : 'blue' })), ...shows.map((t): Row => ({ title: esc(t), mark: 'blue' }))]);
    void r;
  }
  if (kn && c.bossId === p.id && !isMe) {
    const ins = p.insight?.[c.id] ?? [];
    const lines: string[] = [];
    if (ins.includes('want') && c.want) lines.push(WANT_LINE[c.want.kind](c));
    for (const t of ins) { if (t.startsWith('tie:') && w.chars[t.slice(4)]) lines.push(`${He} and ${w.chars[t.slice(4)].name.split(' ')[0]} are friendly.`); if (t.startsWith('rival:') && w.chars[t.slice(6)]) lines.push(`${He} and ${w.chars[t.slice(6)].name.split(' ')[0]} don’t get on.`); if (t.startsWith('loan:') && w.chars[t.slice(5)]) lines.push(`There’s money between ${isFemale(c) ? 'her' : 'him'} and ${w.chars[t.slice(5)].name.split(' ')[0]}.`); if (t === 'leaving') lines.push(`${He}’s getting restless. ${He} may not stay.`); }
    out += h('What you’ve worked out') + (lines.length ? lines.map((l) => `<p>${esc(l)}</p>`).join('') : quiet('You don’t know what makes him tick yet. Talk to him, and watch.'));
    out += recordCard(w, p, c);
  }
  // ---- beside it: where he fits, what he told you, your notes, what you know of him
  let side = '';
  if (kn) {
    const fits: KV[] = [];
    if (boss) fits.push(['Answers to', boss.id === p.id ? 'you' : pl(boss)]);
    if (men.length) fits.push(['His men', `${men.slice(0, 4).map((m) => (m.id === p.id ? 'you' : pl(m))).join(', ')}${men.length > 4 ? ` +${men.length - 4}` : ''}`]);
    if (b) fits.push(['Runs', bl(b.id)]);
    if (c.familyId) fits.push(['Family', fl(c.familyId)]);
    if (c.bossId === p.id && lineOf(w, c)) fits.push(['His line', esc(enterpriseLine(w, c)!)]);
    if (c.rank !== 'civilian' && c.bossId === p.id) fits.push(['Skills', esc(skillLine(c))], ['Passes up', `${Math.round(effectiveRate(w, c) * 100)}%`]);
    side += h('Where he fits') + kv(fits);
  }
  // what you know of him, and what he has told you: the latest few of each, in the page itself
  if (kn) {
    const facts = Object.entries(p.known).filter(([fid]) => w.facts[fid] && (w.facts[fid].actor === c.id || w.facts[fid].victim === c.id) && (!w.facts[fid].minor || w.facts[fid].kind === 'trouble')).sort((a2, b2) => w.facts[b2[0]].t - w.facts[a2[0]].t).slice(0, 4);
    if (facts.length) out += h(isMe ? 'What’s known' : `What you know of ${isFemale(c) ? 'her' : 'him'}`) + rows(facts.map(([fid, x]): Row => ({ title: lk(factText(w.facts[fid], x.knowsActor)).replace(/<a [^>]*>(.*?)<\/a>/g, '$1'), sub: esc(shortTime(w.facts[fid].t)), a: `fact:${fid}` })));
  }
  if (!isMe && kn) {
    const told = Object.entries(p.known).filter(([, x]) => x.from === c.id).sort((x, y) => y[1].t - x[1].t).slice(0, 4).filter(([fid]) => w.facts[fid]);
    if (told.length) out += h(`${He} told you`) + rows(told.map(([fid, x]): Row => ({ title: esc(factText(w.facts[fid], x.knowsActor)), sub: esc(shortTime(x.t)), a: `fact:${fid}` })));
    const nt = noteOf(p, c.id);
    out += `<details class="pp-more"><summary>Your notes${nt?.tags.length ? `: ${esc(nt.tags.join(', '))}` : ''}</summary><div class="pp-notes">${TAGS.map((t, i) => `<button class="pp-tag${nt?.tags.includes(t) ? ' is-on' : ''}" data-a="ntag:${c.id}|${i}" aria-pressed="${!!nt?.tags.includes(t)}">${esc(t)}</button>`).join('')}</div></details>`;
  }
  toSide(side);
  return out;
}

export function encView(id: string, lines: string[]): string {
  const w = W();
  const e = w.enc.find((x) => x.id === id);
  if (!e) return back() + quiet('That moment has passed.');
  const c = e.from ? w.chars[e.from] : undefined;
  let out = back();
  // someone has come to you: who, what he says, and how you answer; or go and see him, and take it up in conversation
  out += `<header class="pp-head">${c ? avatar(c) : ''}<div class="pp-id">${title(e.title, `${c ? esc(c.name) + (c.rank !== 'civilian' ? ' · ' + esc(c.rank === 'capo' ? 'captain' : c.rank) : '') : 'Nobody you can name'}${e.status === 'open' && e.kind !== 'kin' ? ` · ${!c ? 'they' : isFemale(c) ? 'she' : 'he'}’ll want an answer ${esc(byWhen(w.now, e.expires))}` : ''}`)}</div></header>`;
  out += `<div class="sc-said">${e.lines.map((l, i) => `<p class="${i ? 'sc-say' : 'sc-narr'}">${lk(l)}</p>`).join('')}${lines.map((l) => `<p class="sc-narr">${lk(l)}</p>`).join('')}</div>`;
  if (e.status !== 'open') return out + choices([{ a: 'back:', label: 'Done', hint: 'Back to where you were.' }], 'Where now');
  const picks: Pick[] = e.opts.map((o) => ({ a: `echoose:${e.id}|${o.code}`, label: o.label, hint: o.hint }));
  if (c?.alive && !c.isPlayer && e.opts.length) picks.unshift({ a: `talk:${c.id}`, label: `Go and see ${c.name.split(' ')[0]}`, hint: 'Take it up face to face, with everything else between you.' });
  return out + choices(picks, 'How you answer');
}
export function bizView(id: Id): string {
  const w = W();
  const p = P();
  const b = w.biz[id];
  if (!b) return back() + quiet('It’s gone.');
  const o = w.chars[b.ownerId];
  const prot = b.protection;
  let out = back();
  const state = [b.open ? 'open' : 'closed', b.damaged > 0 ? 'recovering' : '', prot && lateOf(b) > 0 ? 'late with the money' : ''].filter(Boolean).join(' · ');
  out += `<header class="pp-head"><div class="bz-mark" aria-hidden="true">${esc(b.name[0])}</div><div class="pp-id">${title(b.name, `${esc(tradeOf(b.kind))} · ${esc(b.district)}`)}<p class="pp-tags"><span class="ui-mark ${b.open ? (prot && lateOf(b) > 0 ? 'amber' : 'green') : 'red'}" aria-hidden="true"></span>${esc(state)}</p></div></header>`;
  // the place leads to its owner first, and to the business you could do with him there: buying in, lending, protection
  out += acts(btn(`talk:${o.id}`, whereIs(w, p, o).kind === 'shop' ? `Walk in and talk to ${o.name.split(' ')[0]}` : `Find ${o.name.split(' ')[0]}`, 'primary'),
    o.id !== p.id && o.alive ? btn(`talk:${o.id}|g:business`, `Talk business with ${o.name.split(' ')[0]}`) : '',
    // (leaning on a place is putting it to its owner: the same conversation, the same rule of whose place it is to lean on)
    !prot && o.alive && o.id !== p.id ? btn(`talk:${o.id}|g:business`, 'Lean on it') : prot && prot.familyId !== p.familyId ? btn(`plan:lean|${b.id}`, 'Lean on it') : btn(`plan:burgle|${b.id}`, 'Other ideas'));
  if (prot && lateOf(b) > 0 && prot.collectorId === p.id) out += context([`${esc(o.name)} is behind by <b>${esc(money(owedOf(b)))}</b>. You can send a man to shake him, or go yourself.`], true) + acts(btn(`shake:${b.id}`, 'Shake him myself', 'danger'), btn('orders:', 'Send a man'));
  const who: KV[] = [['Owner', o.id === p.id ? 'you' : pl(o)]];
  // (who looks after it is known on his own streets, or where he has been or heard; not across the whole city: acquaint.knowsProtection)
  if (!knowsProtection(w, p, b)) who.push(['Protection', 'you don’t know who looks after it, if anyone']);
  else if (prot) who.push(['Protected by', `${prot.collectorId === p.id ? 'you' : pl(w.chars[prot.collectorId])} · ${fl(prot.familyId)}`], ['Pays', prot.collectorId === p.id || prot.familyId === p.familyId ? (prot.fee > 0 ? `<span class="fig">${esc(money(prot.fee))}</span> a week` : 'run by the family') : 'that’s their business']);
  else who.push(['Protection', 'nobody yet', 'warn']);
  { const m = b.managerId ? w.chars[b.managerId] : undefined; if (m?.alive) who.push(['Runs it', pl(m)]); }
  for (const s of b.stakes ?? []) if (s.holder === p.id || known(w, w.chars[s.holder])) who.push([s.holder === p.id ? 'Your share' : 'Also has a share', s.holder === p.id ? Math.round(s.share * 100) + '%' : pl(w.chars[s.holder]) + ' · ' + Math.round(s.share * 100) + '%']);
  if ((b.owners ?? []).length) who.push(['Before that', esc(b.owners!.map((x) => w.chars[x.id]?.name ?? '?').join(', '))]);
  if (known(w, o)) { const tr = trade(w, b); who.push(['Trade', `about <span class="fig">${esc(money(Math.round(tr.weeks ? tr.revenue : b.income)))}</span> a week`]); const pf = perf(w, b).notes; if (pf.length) who.push(['People say', esc(pf.join(', '))]); }
  out += h('Who has it') + kv(who);
  // your own place: who runs it (econ.setManager); selling it is a price you name to a man with money, in conversation
  if (b.ownerId === p.id && b.open) {
    const mgr = b.managerId ? w.chars[b.managerId] : undefined;
    const men = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.id !== b.managerId).slice(0, 3);
    out += h('Running it') + note(`${mgr?.alive ? `${esc(mgr.name)} runs the day-to-day. How well it is run is down to him.` : 'You run it yourself. How well it is run is down to you.'} To sell it, or a piece of it, offer it to a man with money when you talk business.`)
      + choices([...men.map((c) => ({ a: `bmgr:${b.id}|${c.id}`, label: `Put ${c.name.split(' ')[0]} in charge`, hint: skillLine(c) })), { a: `bmgr:${b.id}|hire`, label: 'Hire a manager', hint: 'A man from outside, on wages.' }, ...(mgr ? [{ a: `bmgr:${b.id}|self`, label: 'Run it yourself', hint: 'Nobody between you and the till.' }] : [])], 'Who runs it');
  }
  // the place your crew meets: a bar or a restaurant of your own (enterprise.meetWeek)
  if (canMeetAt(w, p, b)) {
    const here = w.path?.meet === b.id;
    out += h('Your crew’s place') + note(here ? `Your men drink here and find you here. What the bar hears, you hear. When the police take an interest in you, they take one in ${esc(b.name)}.` : 'A place of your own where your men drink and find you. What is said at the bar reaches you.')
      + choices([{ a: `bmeet:${b.id}`, label: here ? 'Stop meeting here' : 'Make it where your crew meets', hint: here ? 'Your men will drink somewhere else.' : 'Your men like having a place. So do the police.' }], 'Your crew’s place');
  }
  // what has happened there that you know of
  const told = Object.values(w.facts).filter((f) => f.business === b.id && p.known[f.id] && !f.minor).sort((a, c) => c.t - a.t).slice(0, 5);
  if (told.length) out += h('What you know of it') + `<ul class="op-hist">${told.map((f) => `<li><span>${esc(shortTime(f.t).replace(/,? \d\d:\d\d$/, ''))}</span>${lk(factText(f, p.known[f.id].knowsActor))}</li>`).join('')}</ul>`;
  return out;
}
export function factView(id: Id): string {
  const w = W();
  const p = P();
  const f = w.facts[id];
  if (!f) return back() + quiet('Nobody remembers it.');
  const k = p.known[id];
  // how it came about: only the links of the chain the player knows
  const chain: string[] = [];
  let c = f.cause ? w.facts[f.cause] : undefined;
  for (let i = 0; c && i < 4; i++) {
    if (p.known[c.id]) chain.push(`${factText(c, p.known[c.id].knowsActor)}`);
    c = c.cause ? w.facts[c.cause] : undefined;
  }
  let out = back();
  out += `<p class="ui-label">${esc(f.kind.replace(/_/g, ' '))}</p><div class="sc-said"><p class="sc-say">${lk(k ? factText(f, k.knowsActor) : f.text)}</p></div>`;
  out += kv([['When', esc(shortTime(f.t))], ['Where', esc(f.district)], ...(k ? [['How you know', k.from === 'witness' ? 'you saw it' : k.from === 'self' ? 'you did it' : k.from === 'public' ? 'word on the street' : `${esc(w.chars[k.from]?.name ?? 'someone')} told you`] as KV] : [])]);
  if (f.story && storyKnown(w, f.story)) out += acts(btn(`story:${f.story}`, 'Follow the story', 'quiet'));
  if (chain.length) out += h('How it came about') + rows(chain.map((t): Row => ({ title: lk(t).replace(/<a [^>]*>(.*?)<\/a>/g, '$1') })));
  // those involved, as far as you know who did it (a man you only suspect is not named here)
  const people = [k?.knowsActor ? f.actor : undefined, f.victim].filter(Boolean).map((x) => w.chars[x!]).filter(Boolean);
  if (people.length) out += h('Those involved') + rows(people.map((x): Row => ({ face: avatar(x), title: esc(x.id === p.id ? 'You' : x.name), sub: x.id === f.victim ? 'Hurt by it' : 'Did it', a: x.id === p.id ? 'tab:life' : `ent:${x.id}` })));
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
  let out = title('The families') + `<div class="ui-seg" role="group" aria-label="Which family">${Object.values(w.fam).map((f) => `<button class="ui-seg__b${f.id === fam.id ? ' is-on' : ''}" data-a="tree:${f.id}" aria-pressed="${f.id === fam.id}">${esc(f.name)}</button>`).join('')}</div>`;
  // (another family is seen from outside: its boss and underboss are known to everyone in the life, its captains and men only as far as
  // the player has met them or heard of them; how it stands with families other than his own is not his to know)
  const theirs = fam.id !== p.familyId, seen = (c: Character) => !theirs || c.rank === 'boss' || c.rank === 'underboss' || known(w, c);
  const tens = Object.values(w.fam).filter((o) => o.id !== fam.id && (!theirs || o.id === p.familyId)).map((o) => `${esc(o.name)}: ${tensionWord(fam.id, o.id)}`).join(' &middot; ');
  const hidden = all.filter((c) => !seen(c)).length;
  out += note(`${esc(fam.districts.join(', '))} · ${theirs ? `${all.length - hidden} men you know of${hidden ? `, and more you don’t` : ''}` : `${all.length} men · <b>yours</b>`}<br>${tens}`);
  out += `<div class="tree">`;
  if (boss?.alive) out += node(boss, 'top');
  else out += `<div class="node top open"><div class="nn"><span>No boss</span><small>the family is without a head</small></div></div>`;
  out += `<div class="vline"></div>`;
  if (under) out += node(under, 'top');
  else out += `<div class="node top open"><div class="nn"><span>No underboss</span><small>vacant</small></div></div>`;
  out += `<div class="vline"></div></div>`;
  const kidsOf = (id: Id) => all.filter((c) => c.bossId === id && seen(c)).sort((a, b) => ['soldier', 'associate'].indexOf(a.rank) - ['soldier', 'associate'].indexOf(b.rank) || b.lifetimeKick - a.lifetimeKick);
  const openS = Math.max(0, capOf(w, fam.id, 'soldier') - seats(w, fam.id, 'soldier'));
  const openC = Math.max(0, capOf(w, fam.id, 'capo') - seats(w, fam.id, 'capo'));
  const q = queueOf(w, fam.id);
  const qx = (c: Character) => { if (theirs) return ''; const k = q.findIndex((r) => r.c.id === c.id); return k < 0 ? '' : ` &middot; <b>${k === 0 ? 'next in line' : '#' + (k + 1) + ' in line'}</b>`; };
  out += `<div class="crews">`;
  capos.forEach((cp, i) => {
    const kids = kidsOf(cp.id);
    // A crew opens when it is yours (or, in another family, the first); any crew opens or closes with a tap and stays that way.
    const below = (c: Character) => { let b = c.bossId; for (let n = 0; b && n < 4; n++) { if (b === cp.id) return true; b = w.chars[b]?.bossId ?? null; } return false; };
    const dflt = fam.id === p.familyId ? below(p) || cp.id === p.id : i === 0;
    const key = (dflt ? 'crewx:' : 'crew:') + cp.id;
    const open = dflt ? !S.open[key] : !!S.open[key];
    if (!seen(cp)) { out += `<div class="crew"><div class="hd"><span>A crew you don’t know</span><span></span></div><div class="node faded"><span class="dot"></span><div class="nn"><span>A captain</span><small>you don’t know him</small></div></div></div>`; return; }
    out += `<div class="crew ${open ? 'open' : ''}"><button class="hd" data-a="tog:${key}" aria-expanded="${open}"><span>The ${esc(cp.name.split(' ').slice(1).join(' ') || cp.name)} Crew</span><span>${theirs ? '' : `${all.filter(below).length} under him `}${chevron}</span></button>${node(cp, 'top').replace('node top', 'node')}`;
    if (!open) { out += `</div>`; return; }
    const soldiers = kids.filter((k) => k.rank !== 'associate');
    const direct = kids.filter((k) => k.rank === 'associate');
    for (const s of soldiers) {
      out += node(s, 'sub');
      for (const a of kidsOf(s.id)) { out += node(a, 'sub2', qx(a)); for (const r of kidsOf(a.id)) out += node(r, 'sub3'); }
    }
    if (direct.length) out += `<div class="org-lab">Reporting straight to ${esc(cp.name.split(' ')[0])}</div>` + direct.map((a) => node(a, 'sub', qx(a)) + kidsOf(a.id).map((r) => node(r, 'sub2')).join('')).join('');
    if (i < openS && !theirs) out += openNode('soldier');
    out += `</div>`;
  });
  if (openC && !theirs) for (let i = 0; i < openC; i++) out += `<div class="crew"><div class="hd"><span>Open</span><span></span></div>${openNode('capo')}</div>`;
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
  return `<div class="ui-card"><h2>His record<small>as far as you know</small></h2>${bars}<ul class="ui-list">${rows.join('')}</ul>${ev.length ? `<h3 class="ui-h">What’s happened to him</h3>${ev.map((e) => `<div class="note">${esc(shortTime(e.t))}: ${esc(e.text)}</div>`).join('')}` : ''}</div>`;
}
