// The conversation screen (conv/visit.ts; the only one since Gate 4), drawn to the approved design: who he is at the top, with how he
// sees you and what you know of him beside it; what is being said in its own reading area; what stands between you in a context box,
// apart from speech; and what you can say as numbered choices, the way out last. It decides nothing: every line and every choice comes
// from the engine, and every fact in the context box from records the player is a party to (ui/between.ts).
// On a phone the screen is three fixed regions (ui/conversation.css): the man, the reading box, and the choices anchored at the bottom.
import type { Visit } from '../conv/visit';
import type { Choice } from '../conv/kit';
import { approaches } from '../conv/approach';
import { everything } from '../conv/visit';
import { narrow } from './streetmap';
import { ownerBiz } from '../core';
import { avatar } from './common';
import { between, knownOf } from './between';
import { choices, context, label, type Pick } from './kit';
import { esc, famClass, P, S, W } from './links';
import { dayPart } from './when';

const DEBUG = 'omerta.debug';
const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
const debug = () => { try { const q = new URLSearchParams(globalThis.location?.search ?? '').get('debug'); if (q) store()?.setItem(DEBUG, q); return store()?.getItem(DEBUG) === '1'; } catch { return false; } };

// What each heading is for, said once under its name (the headings themselves are the engine's).
const HEAD_HINT: Record<string, string> = { business: 'Work, money, the family’s affairs.', personal: 'The man himself: how he is, what he thinks.', confront: 'What needs having out between you.' };
const RANK = (r: string) => (r === 'capo' ? 'captain' : r);
const ICON = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  about: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

// The exchanges of this visit: each begins with what you said (the first, with his greeting, begins with nothing).
type Ex = Visit['lines'];
function exchanges(v: Visit): Ex[] {
  const xs: Ex[] = [[]];
  for (const l of v.lines) { if (l.who === 'you' && xs.at(-1)!.length) xs.push([]); xs.at(-1)!.push(l); }
  return xs.filter((x) => x.length);
}

// One exchange as it reads: your words quiet above, the room in italics, his words in the book face. The ▲▼ record of what changed
// is information, not speech, so it is kept apart (fx).
function exHtml(x: Ex, dbg: boolean): { said: string; fx: string[] } {
  let said = '';
  const fx: string[] = [];
  for (const l of x) {
    if (l.who === 'you') said += `<p class="cx-you"><span class="sr-only">You: </span>${esc(bare(l.text))}</p>`;
    else if (l.who === 'him') said += `<p class="cx-say">${esc(l.text)}</p>${dbg && l.trace?.length ? `<details class="cx-dbg"><summary>why (developer view)</summary><pre>${esc(l.trace.join('\n'))}</pre></details>` : ''}`;
    else if (l.who === 'card') fx.push(esc(l.text));
    else said += `<p class="cx-narr">${esc(l.text)}</p>`;
  }
  return { said, fx };
}

// A figure to name before it is said: the amount, and for a loan the weekly rate; "Put it to him" says it.
function figure(c: Choice): string {
  const a = c.amount!;
  return `<label>$ <input type="number" id="t2fig:${esc(c.id)}" value="${a.value}" min="${a.min}" max="${a.max}" step="${a.step}" inputmode="numeric" aria-label="Amount"></label>`
    + (a.rate ? `<label><input type="number" id="t2figr:${esc(c.id)}" value="${Math.round(a.rate.value * 100)}" min="${Math.round(a.rate.min * 100)}" max="${Math.round(a.rate.max * 100)}" step="1" inputmode="numeric" aria-label="Weekly rate"> % a week</label>` : '')
    + `<button class="ui-btn" data-a="t2amt:${esc(c.id)}">Put it to him</button>`;
}

// ---------------------------------------------------------------- subjects (the redesign, owner 26 October)
// The conversation is presented as a few clearly organised subjects rather than a list of everything that could be said. Nothing here
// changes what can be said: every option is the engine's (visit.everything), browsed by subject, with what is already between the two
// men first. Options that are ways into the same thing are one entry ("Ask for work"), opening to the particular ones when there are
// several ("A debt" shows the debts). Presentation only: choosing any of them is the engine's own choice, as before.
type Subj = 'work' | 'family' | 'people' | 'personal' | 'settle';
const SUBJ: { k: Subj; name: string; hint: string }[] = [
  { k: 'work', name: 'Work & money', hint: 'Jobs, loans, his business, deals' },
  { k: 'family', name: 'Family business', hint: 'Your standing, the family, its men' },
  { k: 'people', name: 'People & rumours', hint: 'What he makes of men, what he’s heard' },
  { k: 'personal', name: 'Personal', hint: 'The man himself' },
  { k: 'settle', name: 'Settle something', hint: 'What needs having out' },
];
// what each interaction is, by its code: the subject it belongs under, and the entry it shares with others like it
const codeOf = (id: string) => { const x = id.split(':'); return x[0] === 'a' ? (x[1] === 'tk' ? 'tk:' + (x[2] ?? '') : x[1]) : x[0]; };
const BETWEEN = /^(answer|report|job|jobtake|jobpass|m|memo|sit|b_envelope|b_env_wait|mt_open|enc_open|enc|apx|pass|intervene|hisword|tk:debt|tk:job|tk:trouble|tk:pressed)$/;
const SUBJECT_OF: Record<string, Subj> = {};
const put = (k: Subj, xs: string) => { for (const x of xs.split(' ')) SUBJECT_OF[x] = k; };
put('work', 'work b_need b_more rate_ask b_tribute borrow loan favcall offer_loan buy_ask stake_ask sell_ask run_ask partner_chop partner_fence op biz_none sh_how sh_ears sh_back sh_time sh_why sh_lean suggest terms_cut terms_raise deal d_time d_half d_favour d_forgive d_pay d_all d_ask d_remind cr_cash cr_duties assign_low assign_hustle recruit_offer protect tk:shop tk:racket');
put('family', 'fam_books fam_crew fam_name fam_report fam_more fam_counsel fam_dir promo recommend rk_back rk_back_ask b_stand earn tk:earn leaders mediate pick_concern concern ask_rep ask_crew answers rv_mood');
put('people', 'tk:op tk:ev tk:tell tk:hurting think pick_member suspect pick_incident tell who news rv_ears ask_around about inc');
put('personal', 'how old_times spend rv_drink congrats welcome ask_want ask_history help_gift help_loan cr_ask sit_ask intro intro_via rv_favour tk:kin');
put('settle', 'demand confront amends word_make accuse rv_warn cr_drop cr_thin cr_look challenge refuse');
// the entries several options share: one row (the fitting wording, when only one may be said), or the choice of them when there are more
const ENTRY: { key: string; name: string; codes: string[]; one?: boolean }[] = [
  { key: 'work', name: 'Ask for work', codes: ['b_need', 'work', 'b_more'] }, // (every one reachable: alone, it is said as itself; several, they open)
  { key: 'standing', name: 'Your standing', codes: ['earn', 'tk:earn', 'b_stand', 'fam_books', 'fam_crew', 'ask_rep', 'promo', 'recommend', 'rk_back', 'rk_back_ask', 'fam_name'] },
  { key: 'money', name: 'Money between you', codes: ['borrow', 'loan', 'offer_loan', 'help_loan', 'favcall', 'b_tribute', 'rate_ask'] },
  { key: 'debt', name: 'A debt', codes: ['d_time', 'd_half', 'd_favour', 'd_forgive', 'd_pay', 'd_all', 'd_ask', 'd_remind'] },
  { key: 'shop', name: 'His business', codes: ['sh_how', 'sh_ears', 'op', 'biz_none', 'tk:shop', 'tk:racket'] },
  { key: 'protect', name: 'Protection', codes: ['protect', 'suggest', 'terms_cut', 'terms_raise', 'sh_back', 'sh_time', 'sh_why', 'sh_lean'] },
  { key: 'deal', name: 'A deal', codes: ['buy_ask', 'stake_ask', 'sell_ask', 'partner_chop', 'partner_fence', 'run_ask', 'deal'] },
  { key: 'crew', name: 'His work for you', codes: ['assign_low', 'assign_hustle', 'cr_cash', 'cr_duties'] },
  { key: 'someone', name: 'Ask about someone', codes: ['tk:op', 'think', 'pick_member', 'suspect'] },
  { key: 'happened', name: 'What happened', codes: ['tk:ev', 'pick_incident', 'tell', 'who', 'tk:tell'] },
  { key: 'word', name: 'The word around', codes: ['news', 'rv_ears', 'tk:hurting', 'ask_around'] },
  { key: 'time', name: 'Pass the time', codes: ['how', 'old_times', 'spend', 'rv_drink'] },
];
const entryOf = (code: string) => ENTRY.find((e) => e.codes.includes(code));
const subjOf = (c: Choice): Subj => SUBJECT_OF[codeOf(c.id)] ?? (c.pane === 'business' ? 'work' : c.pane === 'confront' ? 'settle' : 'personal');
const isMatter = (c: Choice) => BETWEEN.test(codeOf(c.id));
// a choice as a numbered pick, with its figure when it takes one
export const bare = (s: string) => s.replace(/^[“"]\s*/, '').replace(/\s*[”"]([.!?]?)$/, '$1');
const pickOf = (c: Choice, lead = false): Pick => ({ a: 't2:' + c.id, label: bare(c.label), hint: c.note, kind: lead ? 'lead' : '', fig: c.amount ? figure(c) : undefined });
// What can be said, sorted out: his question and its answers (the exchange in hand), what is between you, and the subjects
function sorted(w: ReturnType<typeof W>, v: Visit) {
  const now = v.choices.filter((c) => c.group === 'reply');
  const all = [...v.choices, ...everything(w, v)].filter((c, i, xs) => xs.findIndex((y) => y.id === c.id) === i && !/^(u|all):|^(home|more|back|leave)$/.test(c.id) && !now.some((y) => y.id === c.id));
  const by = new Map<Subj, Choice[]>(SUBJ.map((s) => [s.k, []]));
  for (const c of all.filter((x) => !isMatter(x))) by.get(subjOf(c))!.push(c);
  return { now, matters: all.filter(isMatter), by };
}
// One subject's options: an entry several share opens to them; one alone is said as itself
function subjectPicks(xs: Choice[]): string {
  const done = new Set<string>(), rows: Pick[] = [];
  for (const c of xs) {
    if (done.has(c.id)) continue;
    const e = entryOf(codeOf(c.id));
    const mates = e ? xs.filter((y) => entryOf(codeOf(y.id)) === e) : [c];
    mates.forEach((y) => done.add(y.id));
    if (mates.length === 1 || e?.one) { rows.push(pickOf(e?.one ? [...mates].sort((a, b) => e.codes.indexOf(codeOf(a.id)) - e.codes.indexOf(codeOf(b.id)))[0] : mates[0])); continue; }
    const open = !!S.open['cxg:' + e!.key];
    rows.push({ a: 'tog:cxg:' + e!.key, label: open ? e!.name : `${e!.name} (${mates.length})`, hint: open ? undefined : mates.slice(0, 2).map((y) => y.label.replace(/^“|”$/g, '')).join(' · ') + (mates.length > 2 ? ' …' : ''), kind: 'more' });
    if (open) rows.push(...mates.map((y) => ({ ...pickOf(y), kind: 'sub' as const })));
  }
  return choices(rows, 'What you say');
}
void HEAD_HINT;
// ---------------------------------------------------------------- the conversation, organised around the man (the overhaul, 28 Oct)
// Not a set of categories to browse: one short list, in the order a man would think of it. What is unfinished between you first; then
// the reasons a man in your position talks to this man (what each is for, to whom, is the engine's: conv/relation.ts); then the man
// himself; and whatever else there is, under one "Something else", flat, for the occasion it fits.
const CORE = ['intro', 'intro_via', 'promo', 'recommend', 'rk_back', 'rk_back_ask', 'fam_crew', 'fam_name', 'fam_counsel', 'fam_dir', 'fam_hear', 'b_need', 'work', 'pick_concern', 'b_tribute', 'borrow', 'earn',
  'fam_report', 'cr_ask', 'recruit_offer',
  'suggest', 'protect', 'offer_loan', 'buy_ask', 'sell_ask', 'run_ask', 'partner_chop', 'partner_fence', 'terms_cut', 'terms_raise', 'sh_how', 'sh_ears', 'sh_back', 'sh_time', 'sh_why', 'sh_lean',
  'rv_mood', 'rv_warn', 'rv_favour'];
const PERSONAL = ['how', 'spend', 'congrats', 'welcome', 'ask_want', 'ask_rep', 'tk:want', 'tk:kin'];
const rankOf = (c: Choice) => { const k = codeOf(c.id), i = CORE.indexOf(k), j = PERSONAL.indexOf(k); return c.lead ? -1 : i >= 0 ? i : j >= 0 ? 100 + j : 200; };
function ordered(sx: ReturnType<typeof sorted>) {
  const rest = [...sx.by.values()].flat().sort((a, b) => rankOf(a) - rankOf(b));
  const core = rest.filter((c) => rankOf(c) < 100).slice(0, 4), mine = rest.filter((c) => rankOf(c) >= 100 && rankOf(c) < 200).slice(0, 2);
  const more = rest.filter((c) => !core.includes(c) && !mine.includes(c));
  return { core, mine, more };
}

export function talk2View(v: Visit): string {
  const w = W(), p = P(), t = w.chars[v.npc];
  if (!t || !t.alive) return `<section class="cx"><p class="ui-quiet">He’s gone.</p><button class="ui-btn" data-a="back:">Go on</button></section>`;
  const b = ownerBiz(w, t.id);
  const dbg = debug();
  const role = t.rank === 'civilian' ? (b ? b.name : '') : t.familyId ? `${w.fam[t.familyId]?.name ?? ''} family` : '';
  const meta = [role, v.where !== role ? v.where : '', dayPart(w.now)].filter(Boolean).map(esc).join(' · ');
  const chip = `<span class="ui-chip ${t.rank === 'civilian' ? '' : famClass(t.familyId)}">${esc(RANK(t.rank))}</span>`;
  // what stands between you: information, not speech (ui/between.ts), most pressing first
  const ties = between(w, p, t);
  const order = { waiting: 0, blood: 1, money: 2, place: 3, favour: 4, rank: 5, word: 6 } as const;
  const shown = ties.sort((a, c) => order[a.kind] - order[c.kind]).slice(0, 3).map((x) => x.text);
  if (v.approach && !ties.some((x) => x.kind === 'waiting') && approaches(w).some((a) => a.id === v.approach)) shown.unshift(`${esc(t.name.split(' ')[0])} came to you about this.`);
  // (on a short phone screen the context box moves in here, behind the ☰, so the choices keep their room)
  const about = `<div class="cx-know__part">${label('How he sees you')}<p>${esc(v.relation)}</p></div><div class="cx-know__part">${label('What you know')}<p>${knownOf(w, p, t)}</p></div>${shown.length ? `<div class="cx-know__part cx-know__ctx">${label('Between you')}${shown.map((x) => `<p>${x}</p>`).join('')}</div>` : ''}`;
  const aboutOpen = !!S.open.cxabout;

  let out = `<section class="cx${v.ended ? ' is-ended' : ''}" aria-label="Talking with ${esc(t.name)}">`;
  // ---- the man
  out += `<header class="cx-head">
    <div class="cx-bar"><button class="cx-leave" data-a="back:" aria-label="Leave the conversation">${ICON.back}<span>Leave</span></button><span class="cx-brand" aria-hidden="true">Omertà</span><button class="cx-aboutbtn" data-a="tog:cxabout" aria-expanded="${aboutOpen}" aria-controls="cx-about" aria-label="What you know of him">${ICON.about}</button></div>
    <div class="cx-who"><div class="cx-face">${avatar(t)}</div><div class="cx-id"><h1 class="cx-name"><a href="#" data-a="ent:${t.id}">${esc(t.name)}</a></h1><p class="cx-meta">${chip} <span>${meta}</span></p><p class="cx-where">${esc(t.district)}</p></div></div>
    <aside class="cx-know${aboutOpen ? ' is-open' : ''}" id="cx-about" aria-label="What you know of him">${about}</aside>
  </header>`;
  // ---- what is being said
  const xs = exchanges(v);
  const now = xs.at(-1) ?? [];
  const before = xs.slice(0, -1);
  const cur = exHtml(now, dbg);
  out += `<div class="cx-read" tabindex="-1" aria-label="The conversation">`;
  if (before.length) out += `<div class="cx-earlier" aria-label="Said earlier">${before.map((x) => `<div class="cx-ex">${exHtml(x, dbg).said}</div>`).join('')}</div>`;
  out += `<div class="cx-now" aria-live="polite">${cur.said || '<p class="cx-narr">He waits for you to speak.</p>'}</div>`;
  if (cur.fx.length) out += `<p class="cx-fx" aria-label="What changed">${cur.fx.join(' · ')}</p>`;
  out += `</div>`;
  // ---- what you can say: the exchange in hand, or the subject you have opened, or what is between you; beside it, the subjects
  // (a man who will not talk today, or has stopped: only the way out)
  const sx = v.ended || v.th?.shut ? undefined : sorted(w, v);
  const subj = undefined as Subj | undefined; // (no subjects to browse since the overhaul: one list, ordered by what matters with him)
  const leaveLabel = v.choices.find((c) => c.id === 'leave')?.label ?? 'Leave';
  out += `<div class="cx-act">`;
  if (!v.ended && v.th?.shut) out += choices([{ a: 't2:leave', label: 'Leave', kind: 'out' }], 'Leave');
  else if (v.ended || !sx) out += choices([{ a: 'back:', label: 'Go on', hint: 'Back to where you were.' }, { a: `ent:${t.id}`, label: `${t.name.split(' ')[0]}’s page`, hint: 'Everything you know of him, and what is between you.' }], 'Where now');
  else if (sx.now.length && !subj) out += `<p class="cx-under">${v.waiting ? 'He’s waiting on you' : 'Your answer'}</p>` + choices([...sx.now.map((c, i) => pickOf(c, i === 0 && !!v.approach)), { a: 't2:leave', label: leaveLabel, kind: 'out' }], 'Your answer');
  else {
    // what is between you, the reasons to talk to him, the man himself; the rest folded under "Something else"
    const o = ordered(sx), open = !!S.open.cxmore;
    const rows: Pick[] = [...sx.matters.slice(0, 4).map((c) => ({ ...pickOf(c), kind: 'lead' as const })), ...o.core.map((c) => pickOf(c)), ...o.mine.map((c) => pickOf(c))];
    if (o.more.length) rows.push({ a: 'tog:cxmore', label: open ? 'Something else' : `Something else (${o.more.length})`, hint: open ? undefined : o.more.slice(0, 2).map((y) => y.label.replace(/^“|”$/g, '')).join(' · ') + (o.more.length > 2 ? ' …' : ''), kind: 'more' });
    if (open) rows.push(...o.more.map((c) => ({ ...pickOf(c), kind: 'sub' as const })));
    rows.push({ a: 't2:leave', label: leaveLabel, kind: 'out' });
    out += `<p class="cx-under">${sx.matters.length ? 'Between you, and what else you might say' : 'What you might say'}</p>` + choices(rows, 'What you say');
  }
  if (sx && sx.now.length) out += `<button class="cx-subjbtn" data-a="tog:cxsubj" aria-expanded="${!!S.open.cxsubj}"><span>Between you</span><b>${sx.matters.length ? `${sx.matters.length} open` : ''}</b></button>`;
  out += `</div>`;
  // ---- beside it: what is between you (a panel beside on a desktop, a drawer on a phone)
  if (sx) {
    let side = `<h2 class="cx-sh">Between you</h2>${shown.length ? `<div class="cx-ctx">${shown.map((x) => `<p>${x}</p>`).join('')}</div>` : ''}`;
    side += sx.matters.length ? `<ul class="cx-subjs">${sx.matters.map((c) => `<li><button data-a="t2:${esc(c.id)}"><b>${esc(c.label.replace(/^“|”$/g, ''))}</b>${c.note ? `<small>${esc(c.note)}</small>` : ''}</button></li>`).join('')}</ul>` : (shown.length ? '' : `<p class="cx-none">Nothing unfinished.</p>`);
    side += `<button class="cx-leave2" data-a="t2:leave">${leaveLabel === 'Not now' ? 'Not now' : 'Leave conversation'}</button>`;
    out += `<aside class="cx-side${S.open.cxsubj ? ' is-open' : ''}" aria-label="Subjects">${side}</aside>`;
  }
  if (dbg) out += `<p class="cx-dbgnote">Developer view on.</p>`;
  out += `</div></section>`;
  return out;
}

// Who has come looking for you, for the top of the day
export function approachesBlock(): string {
  const w = W();
  const xs = approaches(w);
  if (!xs.length) return '';
  return `<section class="cx-looking" aria-label="Looking for you"><h2 class="ui-h">Looking for you</h2><ul class="ui-rows">${xs.map((a) => { const c = w.chars[a.who]; return `<li><button class="ui-row" data-a="see2:${a.id}"><span class="ui-row__face">${avatar(c)}</span><span class="ui-row__body"><span class="ui-row__title">${esc(a.line)}</span><span class="ui-row__sub">Go and see him</span></span></button></li>`; }).join('')}</ul></section>`;
}
