// V89: the Life tab, the player's own screen. Four rooms instead of seven:
//   You            who you are, where you stand, the road ahead, what you are after, what you are known for
//   People         the people at home (romance folded in as one of them), and everyone else you know
//   Business       the envelope you pass up, what is owed either way, and who could use a loan
//   What you know  the things you have seen or been told, in the order they reached you
// Every room puts its supporting material in the context column (toSide): beside the screen on desktop, after it on a phone.
// Nothing here changes the game; it is presentation only. Every action the old seven sub-tabs offered is still offered here.
import type { Character, World } from '../types';
import { DAY } from '../types';
import { owedOf, stakesOf } from '../econ';
import { grudgeWord } from '../actions';
import { effectiveRate } from '../books';
import { bgLabel, bgOf } from '../background';
import { repLines } from '../crewlife';
import { careerLines, promoSteps, standingTable } from '../career';
import { factText, famName, fmtTime, money, ownerBiz } from '../core';
import { influence, influenceWord } from '../books';
import { SPEC_LABEL, SPEC_PERK, TIER_WORD, specScores, tierOf, Spec } from '../specs';
import { standingWord } from '../jobs';
import { characterWords } from '../temper';
import { kinWord, stageWord, warmthWord, DATES, datingPool } from '../life';
import { pathInfo } from '../path';
import { favourWord, owedTo, owing } from '../encounters';
import { TAGS } from '../notebook';
import { deepStorage, saveBox, storageNote } from '../savestore';
import { avatar, skillBars, traitTags } from './common';
import { esc, lk, P, pl, S, W, youify } from './links';
import { toSide } from './layout';
import { acts, btn, choices, h, kv, note, quiet, rows, title, type KV, type Pick, type Row } from './kit';
import { between } from './between';
import { week } from './money';
import { queueView } from './family';
import { pathCard, powersCard } from './pathview';
import { ambitionCard } from './ambview';
import { disputesList } from './views_c';
import { crewList } from './views_b';

export type LifeRoom = 'you' | 'people' | 'business' | 'known';

// Older names for the rooms (links elsewhere in the game, and the seven sub-tabs before V89) land in the room that now holds them.
export function roomOf(v: string | undefined): LifeRoom {
  switch (v) {
    case 'people': case 'love': return 'people';
    case 'business': case 'money': return 'business';
    case 'known': case 'intel': case 'history': return 'known';
    default: return 'you';
  }
}

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// Time the way a man says it: today, yesterday, three days ago, last week.
export function agoWord(now: number, t: number): string {
  const d = Math.floor(now / DAY) - Math.floor(t / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${NUM[d]} days ago`;
  if (d < 14) return 'last week';
  if (d < 60) return `${NUM[Math.round(d / 7)]} weeks ago`;
  const m = Math.round(d / 30);
  return m <= 1 ? "a month ago" : `${NUM[m] ?? m} months ago`;
}

// (every room's headings and quiet lines are the kit's, so they read the same as every other screen)
const sect = (title: string, aside = '') => h(title, aside);
const first = (c: Character) => c.name.split(' ')[0];

// Story › Your road: the rank you hold and the steps to the next, the line for the next seat, what you are after, and what your rank
// lets you do (folded: a list to consult, not to read).
export function roadRoom(): string {
  const w = W(), p = P();
  let out = standing(w, p);
  if (p.familyId) out += queueView();
  out += ambitionCard();
  const pc = powersCard();
  if (pc) out += `<details class="lf-fold"><summary>What being ${p.rank === 'associate' ? 'an' : 'a'} ${esc(p.rank === 'capo' ? 'captain' : p.rank)} lets you do</summary>${pc}</details>`;
  return out;
}
export function youRoom(): string {
  const w = W(), p = P();
  const bgx = p.bg ? bgLabel(p.bg) : undefined;
  let out = `<header class="lf-me">${avatar(p)}<div><h1>${esc(p.name)}</h1><div class="sub">${esc(cap(p.rank))}${p.familyId ? ` of the ${esc(famName(w, p))} family` : ''} &middot; ${esc(p.district)}</div>${bgx ? `<p class="lf-bg"><b>${esc(bgx)}.</b>${bgOf(p.bg) ? ' ' + esc(bgOf(p.bg)!.blurb) : ''}</p>` : ''}<div class="tags">${traitTags(p)}</div></div></header>`;
  if (p.jailedUntil > w.now) out += `<p class="ui-callout is-bad">You’re locked up. The world goes on without you for now.</p>`;
  else if (p.hurtUntil > w.now) out += `<p class="ui-callout is-bad">You’re hurt. Take it easy until you mend.</p>`;

  // V90: who you have shown yourself to be, in words, from what you have done (never chosen, never a score)
  out += `<div class="ui-card"><h2>The man you’ve shown them</h2>${characterWords(p).map((x) => `<p>${esc(x)}</p>`).join('')}<p class="muted">Each man sees you through what he has seen and heard himself.</p></div>`;
  const says = repLines(w, p);
  if (says.length) out += sect('What they say about you') + says.map((l) => `<p class="say">${esc(l)}</p>`).join('');
  out += h('Home') + loveBlock(w, p);

  // what you are known for: the four reputations, said once; skills beside them
  const sc = specScores(w, p);
  const specs = (Object.keys(SPEC_LABEL) as Spec[]).filter((s) => tierOf(sc[s]) > 0).sort((a, b) => sc[b] - sc[a]);
  out += sect('What you’re known for');
  out += specs.length
    ? `<ul class="ui-list">${specs.map((s) => `<li><span>${SPEC_LABEL[s]}${tierOf(sc[s]) >= 2 ? `<small class="lf-perk">${esc(SPEC_PERK[s])}</small>` : ''}</span><span class="v ${tierOf(sc[s]) >= 2 ? 'good' : ''}">${TIER_WORD[tierOf(sc[s])]}</span></li>`).join('')}</ul>`
    : quiet('Nothing yet. A name is made by what you do: earn, run something, talk a man round, or put one down, and people start to say it of you.');
  out += `<details class="lf-fold"><summary>What you’re good at</summary>${skillBars(p)}</details>`;
  // (your road, rank and powers are Your road; milestones, honest work and the saves live in More)

  // beside it: who is around you
  let side = '';
  const patron = p.bossId ? w.chars[p.bossId] : undefined;
  const men = crewList().length;
  side += `<div class="lf-side">${sect('Around you')}<ul class="ui-list">${patron ? `<li><span>You answer to</span><span class="v">${pl(patron)}</span></li>` : ''}${p.sponsor && w.chars[p.sponsor] ? `<li><span>Speaks for you</span><span class="v">${pl(w.chars[p.sponsor])}</span></li>` : ''}${p.backer && w.chars[p.backer] ? `<li><span>Backs you</span><span class="v">${pl(w.chars[p.backer])}</span></li>` : ''}<li class="lf-phone"><span>Your name</span><span class="v">${esc(standingWord(p.standing))}</span></li><li class="lf-phone"><span>Your pull</span><span class="v">${esc(influenceWord(influence(w, p)))}</span></li>${men ? `<li><span>Men under you</span><span class="v">${men}</span></li>` : ''}</ul></div>`;
  toSide(side);
  return out;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Where you stand for the next rank. A promotion under way says so; otherwise the road, one line per thing still to do.
function standing(w: World, p: Character): string {
  const steps = promoSteps(w, p);
  if (steps) return `<div class="ui-card lf-road"><h2>Being considered</h2><ul class="ui-list">${steps.map((x) => `<li><span class="${x.state === 'wait' ? 'muted' : ''}">${x.state === 'done' ? '&#10003;' : x.state === 'now' ? '&#9679;' : '&#9675;'} ${esc(x.label)}</span><span class="v ${x.state === 'now' ? 'warn' : x.state === 'done' ? 'good' : ''}">${lk(x.note)}</span></li>`).join('')}</ul></div>`;
  if (pathInfo(w, p)) return pathCard();
  const st = standingTable(w, p);
  if (st.rows.length) return `<div class="ui-card lf-road"><h2>Your standing in the ${esc(famName(w, p))} family</h2><ul class="ui-list">${st.rows.map((r) => `<li><span>${esc(r.label)}</span><span class="v ${r.tone}">${esc(r.value)}</span></li>`).join('')}</ul><div class="ui-callout ${st.verdict.startsWith('Held') ? '' : 'info'}">${esc(st.verdict)}</div></div>`;
  return careerLines(w, p).map((l) => `<p class="lf-bg">${lk(l)}</p>`).join('');
}

const snapList = (): { day: number; key: string; label: string }[] => saveBox()?.snaps ?? [];
// The game itself: saving, backups, going back a day, starting over. Kept out of the way, at the foot of the page.
export function savesFold(always = false): string {
  const open = always || !!S.open['saves'] || S.confirmReset;
  let out = always ? '<div class="lf-saves">' : `<div class="lf-saves"><button class="lf-saves__t" data-a="tog:saves" aria-expanded="${open}">Saves and backups <span>${open ? '&lsaquo;' : '&rsaquo;'}</span></button>`;
  if (!open) return out + `</div>`;
  out += choices([
    { a: 'save:', label: 'Save now', hint: S.save ? (S.save.ok ? `Last saved ${S.saveGood || fmtTime(W().now)}. This game takes ${(S.save.bytes / 1e6).toFixed(2)} MB; with ${S.save.snapshots} earlier-day snapshot${S.save.snapshots === 1 ? '' : 's'}, ${(S.save.used / 1e6).toFixed(2)} MB${deepStorage() ? ' in all, kept in this browser' : ' of roughly 5 MB this browser allows'}.` : 'NOT saved: ' + (S.save.error ?? '')) : 'The game saves itself after every action, in this browser only.' },
    { a: 'dlsave:', label: 'Download a backup file', hint: 'A copy you can keep outside the browser.' },
    { a: 'ulsave:', label: 'Load a backup file', hint: 'Replaces the game you are playing.' },
    { a: 'reset:', label: S.confirmReset ? 'Choose again to erase this game and start over' : 'Start a new game', kind: 'danger' },
  ], 'Saves') + `<input type="file" id="ulfile" accept=".json,application/json" hidden>`;
  if (storageNote()) out += `<div class="ui-callout is-info">${esc(storageNote())}</div>`;
  const l = snapList();
  if (l.length) out += h('Earlier days, if you need to undo') + choices(l.map((x) => ({ a: `restore:${x.key}`, label: x.label, hint: 'Go back to this day. Everything since is lost.' })), 'Earlier days');
  return out + `</div>`;
}

// =================================================================== People
export function peopleRoom(): string {
  const w = W(), p = P();
  const home = new Set([...(w.life?.kin ?? []).map((k) => k.id), ...(w.life?.partner && w.life.partner.stage !== 'split' ? [w.life.partner.id] : [])]);
  const known = Object.entries(p.rels).map(([id, r]) => [w.chars[id], r] as const).filter(([x]) => x && x.alive && x.id !== p.id && !home.has(x.id));
  if (!known.length && !home.size) return title('Everyone') + quiet('You don’t know anybody yet. Go to the club, sit at the bar, get a shave. Faces become names.');
  const fam = S.worldFilter;
  let out = '';
  const placed = new Set<string>();
  // (a man is described only when there is something to say)
  const feel = (x: Character) => { const r = x.rels[p.id], mine = p.rels[x.id]; return (mine?.grudge ?? 0) >= 0.3 ? 'you haven’t forgiven him' : (r?.grudge ?? 0) >= 0.3 ? 'holds it against you' : (r?.trust ?? 0) > 0.6 ? 'close' : (r?.trust ?? 0) > 0.35 ? 'friendly' : ''; };
  const what = (x: Character) => x.rank === 'civilian' ? (ownerBiz(w, x.id)?.name ?? x.district) : `${x.rank === 'capo' ? 'captain' : x.rank}${x.familyId && x.familyId !== p.familyId ? ', ' + w.fam[x.familyId].name : ''}`;
  const man = (x: Character, sub?: string): Row => { placed.add(x.id); const f = feel(x); return { face: avatar(x), title: esc(x.name), sub: esc(sub ?? what(x)), end: esc(f), tone: /forgiven|against/.test(f) ? 'bad' : '', a: `ent:${x.id}` }; };
  if (fam === 'all') {
    // who you answer to, up the line
    const up: Row[] = [];
    for (let c = p.bossId ? w.chars[p.bossId] : undefined, i = 0; c && i < 3; c = c.bossId ? w.chars[c.bossId] : undefined, i++) if (c.alive) up.push(man(c, i === 0 ? `${what(c)} · you answer to him` : what(c)));
    if (up.length) out += h('Above you') + rows(up);
    // your men, in a line each
    const crew = crewList();
    if (crew.length) out += h('Your men', String(crew.length)) + rows(crew.map((c) => man(c, c.problem?.revealed ? `${what(c)} · something is wrong` : what(c))));
    // money and favours, either way, one row a man
    const ties = new Map<string, { you: number; them: number; money: number; owe: number }>();
    const tie = (id: string) => { if (!ties.has(id)) ties.set(id, { you: 0, them: 0, money: 0, owe: 0 }); return ties.get(id)!; };
    for (const f of owedTo(w, p.id)) tie(f.to).them++;
    for (const f of owing(w, p.id)) tie(f.from).you++;
    for (const d of w.debts.filter((d) => d.status === 'active')) { if (d.creditor === p.id) tie(d.debtor).money += d.balance; else if (d.debtor === p.id) tie(d.creditor).owe += d.balance; }
    const n = (k: number, one: string) => (k === 1 ? `a ${one}` : `${['', '', 'two', 'three', 'four', 'five', 'six'][k] ?? k} ${one}s`);
    const owed = [...ties].filter(([id]) => w.chars[id]?.alive && !placed.has(id)).sort((a, b) => (b[1].money + b[1].owe) - (a[1].money + a[1].owe) || (b[1].them + b[1].you) - (a[1].them + a[1].you))
      .map(([id, t]) => man(w.chars[id], [t.money ? `owes you ${money(t.money)}` : '', t.owe ? `you owe him ${money(t.owe)}` : '', t.them ? `owes you ${n(t.them, 'favour')}` : '', t.you ? `you owe him ${n(t.you, 'favour')}` : ''].filter(Boolean).join(' · ')));
    if (owed.length) out += h('Owed, either way', String(owed.length)) + rows(owed.slice(0, S.open['pp:owed'] ? 40 : 5)) + (owed.length > 5 ? acts(btn('tog:pp:owed', S.open['pp:owed'] ? 'Fewer' : `${owed.length - 5} more`, 'quiet')) : '');
    // bad blood, either way
    const sore = known.filter(([x, r]) => !placed.has(x.id) && ((x.rels[p.id]?.grudge ?? 0) >= 0.3 || r.grudge >= 0.3)).map(([x]) => man(x));
    if (sore.length) out += h('Bad blood', String(sore.length)) + rows(sore.slice(0, 5));
    // home
    const L = w.life;
    if (L) {
      const pr = L.partner && L.partner.stage !== 'split' ? L.partner : undefined;
      const hm: Row[] = [];
      if (pr && w.chars[pr.id]) hm.push({ face: avatar(w.chars[pr.id]), title: esc(w.chars[pr.id].name), sub: esc(stageWord[pr.stage]), end: esc(warmthWord(pr.warmth)), a: `ent:${pr.id}` });
      for (const k of L.kin.filter((k) => w.chars[k.id]?.alive)) hm.push({ face: avatar(w.chars[k.id]), title: esc(w.chars[k.id].name), sub: esc(kinWord(k).replace('Your ', '')), end: k.sick ? 'unwell' : esc(warmthWord(k.warmth)), tone: k.sick ? 'warn' : '', a: `ent:${k.id}` });
      if (hm.length) out += h('At home') + rows(hm);
    }
  }
  // everyone else, by family, with the closest first
  const fil = (id: string, label: string) => `<button class="ui-pill is-small ${fam === id ? 'on' : ''}" data-a="pf:${id}">${label}</button>`;
  const rest = known.filter(([x]) => (fam === 'all' ? !placed.has(x.id) : fam === 'pin' ? !!p.notes?.[x.id]?.pin : fam === 'none' ? !x.familyId : x.familyId === fam))
    .sort((a, b) => Number(!!p.notes?.[b[0].id]?.pin) - Number(!!p.notes?.[a[0].id]?.pin) || b[1].trust - a[1].trust);
  const lim = S.open['lfall'] ? 150 : 12;
  out += h(fam === 'all' ? 'Everyone else' : 'Who you know', String(rest.length));
  out += `<div class="ui-pills lf-filter">${fil('all', 'All')}${Object.values(w.fam).map((f) => fil(f.id, esc(f.name))).join('')}${fil('none', 'Not in the life')}${fil('pin', '&#9733; Pinned')}</div>`;
  out += rest.length ? rows(rest.slice(0, lim).map(([x]) => { const r = man(x); if (p.notes?.[x.id]?.pin) r.title = '★ ' + r.title; return r; })) + (rest.length > lim ? acts(btn('tog:lfall', `Show all ${rest.length}`, 'quiet')) : '')
    : quiet(fam === 'pin' ? 'Nobody pinned. Open a man’s page and pin him, and he stays at the top of this list.' : 'Nobody you know fits.');
  return out;
}

// Home and love: whoever you are seeing (an evening, where it goes), or, with nobody, the girls you might ask. Lives in Your life.
export function loveBlock(w: World, p: Character): string {
  const L = w.life;
  if (!L) return '';
  const pr = L.partner && L.partner.stage !== 'split' ? L.partner : undefined;
  if (pr) return partnerBlock(w, p, pr);
  const pool = datingPool(w, p).list.filter((x) => w.chars[x.id]?.alive);
  const open = !!S.open['dating'];
  let out = `<div class="lf-invite"><p>${L.ex && w.chars[L.ex] ? `${esc(w.chars[L.ex].name)} is the one you let go. ` : ''}A man should have someone to go home to. Ask a girl out and it costs you an evening and a little money; the better your name and your manner, the better your odds. A no stays a no for a while.</p>`;
  out += pool.length ? `<button class="mini" data-a="tog:dating" aria-expanded="${open}">${open ? 'Not now' : `Who you might ask (${pool.length})`}</button>` : `<p class="muted">Nobody you’ve met this week. Give it time.</p>`;
  if (open && pool.length) out += choices(pool.map((x) => { const g = w.chars[x.id]; return { a: `askout:${g.id}`, label: g.name, hint: `${x.job}, ${g.district}. You see her ${x.where}. Ask her out ($20).` }; }), 'Who you might ask');
  return out + `</div>`;
}

function partnerBlock(w: World, p: Character, pr: NonNullable<NonNullable<World['life']>['partner']>): string {
  const g = w.chars[pr.id];
  const months = pr.due ? Math.max(1, Math.ceil((pr.due - w.now) / DAY / 30)) : 0;
  let out = `<div class="lf-her"><div class="lf-her__head">${avatar(g)}<div><h3>${pl(g)}</h3><p>${esc(cap(stageWord[pr.stage]))}. She is ${({ devoted: 'devoted to you', close: 'close to you', friendly: 'warm toward you', cooling: 'cooling on you', distant: 'distant with you' } as Record<string, string>)[warmthWord(pr.warmth)] ?? warmthWord(pr.warmth)}. ${pr.dates} evening${pr.dates === 1 ? '' : 's'} together.${pr.due ? ` She is expecting: ${months} month${months > 1 ? 's' : ''} to go.` : ''}</p></div></div>`;
  out += `<details class="pp-more"><summary>An evening with her</summary>${choices(DATES.map((d) => ({ a: `dateplan:${d.code}`, label: `${d.label} ($${d.cost})`, hint: d.hint })), 'An evening with her')}</details>`;
  const next: Pick[] = [];
  if (pr.stage === 'seeing') next.push({ a: 'steady:', label: 'Ask her to be your girl', hint: pr.dates >= 3 && pr.warmth >= 0.5 ? 'She might say yes.' : 'Too early. A few more evenings first.' });
  if (pr.stage === 'steady') next.push({ a: 'marryask:', label: 'Ask her to marry you ($400 ring)', hint: pr.dates >= 8 && pr.warmth >= 0.7 ? 'You are both ready.' : 'She isn’t there yet. More time, more evenings.' });
  if (pr.stage === 'engaged') next.push({ a: 'wed:', label: 'Hold the wedding ($1,500)', hint: 'The whole family will come. They will bring envelopes.' });
  if (pr.stage === 'married') next.push({ a: 'baby:', label: pr.due ? 'She is expecting' : 'Talk about having a baby', hint: pr.due ? 'Nothing to do but be there.' : 'A child changes what is at stake.' });
  if (pr.stage !== 'married') next.push({ a: 'breakoff:', label: 'End it', hint: 'It is kinder done properly.', kind: 'danger' });
  out += `<details class="pp-more"><summary>Where this goes</summary>${choices(next, 'Where this goes')}</details>`;
  return out + `</div>`;
}

// =================================================================== Business
// Business (the redesign): one page. The week in a line; what you run; Sunday's envelope; money owed; and one way into starting
// something new. The week in full and the ways to earn are a tap away (ui/business.ts puts the page together).
export function weekFull(): string {
  const w = W(), p = P();
  const b = p.books;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const wk = week(w, p);
  let out = '';
  // the week: what comes in, what goes out, and how far into it you are (ui/money.ts, the one account every screen reads)
  out += h('Your week', wk.inTotal || wk.outTotal ? `${money(wk.inTotal)} in · ${money(wk.outTotal)} out` : '');
  if (!wk.comingIn.length && !wk.goingOut.length) out += quiet('Nothing comes in yet beyond what’s in your pocket. Rackets is where the money starts.') + acts(btn('sub:business.work', 'Start something'));
  else out += rows([
    ...wk.comingIn.map((f): Row => ({ title: esc(f.label), sub: f.note ? esc(f.note) : '', end: `<span class="fig">+${esc(money(f.amt))}</span> <small>a week</small>`, tone: 'good', a: f.a })),
    ...wk.goingOut.map((f): Row => ({ title: esc(f.label), sub: f.note ? esc(f.note) : '', end: `<span class="fig">−${esc(money(f.amt))}</span> <small>a week</small>`, tone: 'warn', a: f.a })),
  ]);
  out += kv([
    ['This week so far', wk.soFar ? `<span class="fig">${esc(money(wk.soFar))}</span>` : 'nothing yet: it comes in on Sunday evening'],
    ...(wk.last ? [['Last week', `earned <span class="fig">${esc(money(wk.last.earned))}</span>${wk.last.due ? `, handed up <span class="fig">${esc(money(wk.last.handed))}</span> of ${esc(money(wk.last.due))}` : ''}`, wk.last.due && wk.last.handed < wk.last.due ? 'warn' : ''] as KV] : []),
  ]);
  // beside it: the Sundays past
  const cur = Math.floor(w.now / (7 * DAY));
  const hist = b.history.slice(-6).reverse();
  let side = h('Sundays past');
  side += hist.length ? rows(hist.map((x): Row => { const n = cur - 1 - x.week; return { title: n <= 0 ? 'Last week' : n === 1 ? 'The week before' : `${cap(NUM[n + 1] ?? String(n + 1))} weeks back`, sub: `earned ${esc(money(x.gross))}${x.received ? `, your men brought ${esc(money(x.received))}` : ''}`, end: x.due ? `paid ${esc(money(x.paid))} of ${esc(money(x.due))}` : 'nothing due', tone: x.due && x.paid < x.due ? 'warn' : '' }; }))
    : quiet('No Sunday has come round yet. When it does, what you made and what you handed up will be written here.');
  if (p.lifetimeKick) side += kv([['Passed up, all told', `<span class="fig">${esc(money(p.lifetimeKick))}</span>`]]);
  toSide(side);
  return out;
}
export function envelopeBlock(): string {
  const w = W(), p = P();
  const b = p.books;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const wk = week(w, p);
  let out = '';
  if (boss) {
    const st = b.stance ?? 'honest';
    const seg = (id: string, label: string) => `<button class="ui-seg__b${st === id ? ' is-on' : ''}" data-a="stance:${id}" aria-pressed="${st === id}">${label}</button>`;
    out += h('The envelope', 'every Sunday');
    out += `<p>${pl(boss)} takes <b>${Math.round(effectiveRate(w, p) * 100)}%</b> of what you declare.${b.arrears > 0 ? ` You are behind by <b class="hurt">${money(b.arrears)}</b>.` : ''}</p>`;
    out += `<div class="ui-seg" role="group" aria-label="How straight you are with him">${seg('honest', 'Straight')}${seg('shave', 'Shave 30%')}${seg('stall', 'Stall')}</div>`;
    out += `<p class="ui-note">${st === 'honest' ? 'You declare everything. It builds your name.' : st === 'shave' ? 'You under-report. He may notice, and if he does, you’ll hear about it.' : 'You pay nothing this week. He’ll notice.'}</p>`;
  }
  return out;
}
export function owedBlock(): string {
  const w = W(), p = P();
  const b = p.books;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const wk = week(w, p);
  let out = '';
  // money owed either way (favours and promises are kept in the Journal, under Your word)
  const debts = w.debts.filter((d) => d.status === 'active' && (d.creditor === p.id || d.debtor === p.id));
  out += h('Money owed', debts.length ? String(debts.length) : '');
  out += debts.length ? rows(debts.filter((d) => w.chars[d.creditor === p.id ? d.debtor : d.creditor]).map((d): Row => {
    const other = w.chars[d.creditor === p.id ? d.debtor : d.creditor], mine = d.creditor === p.id;
    return { face: avatar(other), title: mine ? `${esc(other.name)} owes you` : `You owe ${esc(other.name)}`, sub: `${esc(money(d.weeklyPayment))} a week${d.missed ? `, ${d.missed} missed` : ''} · ${mine ? 'see him about it' : 'talk terms'}`, end: `<span class="fig">${esc(money(d.balance))}</span>`, tone: mine ? (d.missed ? 'warn' : '') : 'warn', a: `talk:${other.id}|tk:debt:${d.id}` };
  })) : quiet('Nobody owes you money and you owe nobody. That won’t last.');
  const fav = owedTo(w, p.id).length + owing(w, p.id).length;
  if (fav) out += acts(btn('sub:story.word', `Favours either way (${fav})`, 'quiet'));
  return out;
}
export { lendingCard };


function lendingCard(): string {
  const w = W(), p = P();
  const xs = Object.values(w.biz)
    .filter((b) => b.open && b.kind !== 'casino')
    .map((b) => ({ b, o: w.chars[b.ownerId] }))
    .filter(({ o }) => o?.alive && o.rank === 'civilian' && !w.debts.some((d) => d.status === 'active' && d.debtor === o.id))
    .sort((a, c) => Number(c.b.district === p.district) - Number(a.b.district === p.district) || c.b.distress - a.b.distress)
    .slice(0, 8);
  return h('Who could use a loan', 'owners with no lender') + (xs.length
    ? rows(xs.map(({ b, o }): Row => ({ title: esc(o.name), sub: `${esc(b.name)}, ${esc(b.district)} · go and offer him money`, end: b.distress > 0.6 ? 'struggling' : b.distress > 0.25 ? 'tight' : 'steady', tone: b.distress > 0.4 ? 'warn' : '', a: `talk:${o.id}|offer_loan` }))) + `<p class="ui-note">Struggling men take it more readily, and pay back less easily.</p>`
    : quiet('Everyone around here has a lender already.'));
}

// =================================================================== What you know
export function knownRoom(): string {
  const w = W(), p = P();
  let out = disputesList();
  const all = Object.entries(p.known).filter(([id]) => w.facts[id] && !w.facts[id].minor).sort((a, b) => w.facts[b[0]].t - w.facts[a[0]].t);
  const lim = S.open['lfknown'] ? 80 : 25;
  const items = all.slice(0, lim);
  if (!items.length) out += h('What you’ve heard') + quiet('You know nothing yet. Go and be seen; sit at the club, listen at the bar. What you hear will be written here.');
  else {
    const day = (t: number) => Math.floor(w.now / DAY) - Math.floor(t / DAY);
    const band = (t: number) => { const d = day(t); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This past week' : 'Before that'; };
    // by when it happened, newest first; each line leads to the record of it
    const bands = new Map<string, Row[]>();
    for (const [id, k] of items) {
      const f = w.facts[id], b2 = band(f.t);
      (bands.get(b2) ?? bands.set(b2, []).get(b2)!).push({ title: esc(youify(factText(f, k.knowsActor))), sub: day(f.t) >= 2 ? esc(agoWord(w.now, f.t)) : '', a: `fact:${id}` });
    }
    for (const [b2, xs] of bands) out += h(b2) + rows(xs);
    if (all.length > lim) out += acts(btn('tog:lfknown', 'Further back', 'quiet'));
  }
  // beside it: your notebook (who you have marked, and why), the scores you carry, and where the stories are followed
  let side = '';
  const noted = Object.entries(p.notes ?? {}).filter(([id, n]) => n.tags.length && w.chars[id]?.alive);
  side += h('Your notebook') + (noted.length ? rows(noted.slice(0, 12).map(([id, n]): Row => ({ face: avatar(w.chars[id]), title: esc(w.chars[id].name), sub: esc(n.tags.join(', ')), a: `ent:${id}` }))) : quiet(`Mark a man from his page (${esc(TAGS.slice(0, 3).map((t) => `“${t}”`).join(', '))}…) and what you have marked gathers here.`));
  const wronged = all.filter(([id]) => { const f = w.facts[id]; return f.victim === p.id && ['beating', 'robbery', 'vandalism', 'poach'].includes(f.kind) && w.now - f.t < 40 * DAY; }).length;
  if (wronged) side += h('Scores to settle') + note(`${wronged === 1 ? 'One thing' : `${wronged} things`} done to you that you haven’t forgotten.`) + acts(btn('grudges:', 'Settle a score'));
  side += h('Stories') + note('What you know, followed as it unfolds: who did what, and what may come of it.') + acts(btn('tab:stories', 'Open the stories', 'quiet'));
  toSide(side);
  return out;
}
