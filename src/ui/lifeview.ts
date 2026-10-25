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
import { acts, btn, choices, h, kv, note, quiet, rows, rows as kitRows, type KV, type Pick, type Row } from './kit';
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

export function youRoom(): string {
  const w = W(), p = P();
  const bgx = p.bg ? bgLabel(p.bg) : undefined;
  let out = `<header class="lf-me">${avatar(p)}<div><h1>${esc(p.name)}</h1><div class="sub">${esc(cap(p.rank))}${p.familyId ? ` of the ${esc(famName(w, p))} family` : ''} &middot; ${esc(p.district)}</div>${bgx ? `<p class="lf-bg"><b>${esc(bgx)}.</b>${bgOf(p.bg) ? ' ' + esc(bgOf(p.bg)!.blurb) : ''}</p>` : ''}<div class="tags">${traitTags(p)}</div></div></header>`;
  if (p.jailedUntil > w.now) out += `<p class="ui-callout is-bad">You’re locked up. The world goes on without you for now.</p>`;
  else if (p.hurtUntil > w.now) out += `<p class="ui-callout is-bad">You’re hurt. Take it easy until you mend.</p>`;

  // where you stand, and the road ahead: one account of it, not two
  out += standing(w, p);
  // V90: who you have shown yourself to be, in words, from what you have done (never chosen, never a score)
  out += `<div class="ui-card"><h2>The man you’ve shown them</h2>${characterWords(p).map((x) => `<p>${esc(x)}</p>`).join('')}<p class="muted">Each man sees you through what he has seen and heard himself.</p></div>`;
  if (p.familyId) out += queueView();
  out += ambitionCard();

  // what you are known for: the four reputations, said once; skills beside them
  const sc = specScores(w, p);
  const specs = (Object.keys(SPEC_LABEL) as Spec[]).filter((s) => tierOf(sc[s]) > 0).sort((a, b) => sc[b] - sc[a]);
  out += sect('What you’re known for');
  out += specs.length
    ? `<ul class="ui-list">${specs.map((s) => `<li><span>${SPEC_LABEL[s]}${tierOf(sc[s]) >= 2 ? `<small class="lf-perk">${esc(SPEC_PERK[s])}</small>` : ''}</span><span class="v ${tierOf(sc[s]) >= 2 ? 'good' : ''}">${TIER_WORD[tierOf(sc[s])]}</span></li>`).join('')}</ul>`
    : quiet('Nothing yet. A name is made by what you do: earn, run something, talk a man round, or put one down, and people start to say it of you.');
  out += `<details class="lf-fold"><summary>What you’re good at</summary>${skillBars(p)}</details>`;
  { const pc = powersCard(); if (pc) out += `<details class="lf-fold"><summary>What your rank lets you do</summary>${pc}</details>`; }
  out += `<div class="lf-links"><button class="ui-btn ui-btn--quiet" data-a="goals:">Milestones &rsaquo;</button><button class="ui-btn ui-btn--quiet" data-a="dayjob:">${p.job ? `Your job: ${esc(p.job.kind)} &rsaquo;` : 'Find legitimate work &rsaquo;'}</button></div>`;
  out += savesFold();

  // beside it: how the street sees you, who is around you, and what you have going
  let side = `<div class="lf-side">${sect('What they say about you')}${repLines(w, p).map((l) => `<p class="say">${esc(l)}</p>`).join('')}</div>`;
  const patron = p.bossId ? w.chars[p.bossId] : undefined;
  const men = crewList().length;
  side += `<div class="lf-side">${sect('Around you')}<ul class="ui-list">${patron ? `<li><span>You answer to</span><span class="v">${pl(patron)}</span></li>` : ''}${p.sponsor && w.chars[p.sponsor] ? `<li><span>Speaks for you</span><span class="v">${pl(w.chars[p.sponsor])}</span></li>` : ''}${p.backer && w.chars[p.backer] ? `<li><span>Backs you</span><span class="v">${pl(w.chars[p.backer])}</span></li>` : ''}<li class="lf-phone"><span>Your name</span><span class="v">${esc(standingWord(p.standing))}</span></li><li class="lf-phone"><span>Your pull</span><span class="v">${esc(influenceWord(influence(w, p)))}</span></li>${men ? `<li><span>Men under you</span><span class="v">${men}</span></li>` : ''}</ul></div>`;
  const shops = Object.values(w.biz).filter((b) => b.protection?.collectorId === p.id);
  const rows: string[] = [];
  const row = (k: string, v: string, tone = '') => rows.push(`<li><span>${k}</span><span class="v ${tone}">${v}</span></li>`);
  if (p.weekIncome) row('Made last week', money(p.weekIncome));
  if (shops.length) row('Shops paying you', `${shops.length}, ${money(shops.reduce((a, b) => a + (b.protection?.fee ?? 0), 0))} a week`);
  if (p.lifetimeKick) row('Passed up, all told', money(p.lifetimeKick));
  const owedYou = w.debts.filter((d) => d.status === 'active' && d.creditor === p.id).reduce((a, d) => a + d.balance, 0);
  const youOwe = w.debts.filter((d) => d.status === 'active' && d.debtor === p.id).reduce((a, d) => a + d.balance, 0);
  if (owedYou) row('Owed to you', money(owedYou), 'good');
  if (youOwe) row('You owe', money(youOwe), 'warn');
  if (p.career && p.career.done + p.career.failed) row('Jobs', `${p.career.done} done${p.career.failed ? `, ${p.career.failed} botched` : ''}`);
  if (p.rep && p.rep.kept + p.rep.broken) row('Your word', `kept ${p.rep.kept}${p.rep.broken ? `, broken ${p.rep.broken}` : ''}`, p.rep.broken > p.rep.kept ? 'warn' : '');
  side += `<div class="lf-side">${sect('What you have going')}${rows.length ? `<ul class="ui-list">${rows.join('')}</ul>` : quiet("Nothing on the books yet. Nobody pays you, nobody owes you, nobody works for you. Make yourself useful and that changes.")}<button class="ui-btn ui-btn--quiet" data-a="lsub:business">The money &rsaquo;</button></div>`;
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
function savesFold(): string {
  const open = !!S.open['saves'] || S.confirmReset;
  let out = `<div class="lf-saves"><button class="lf-saves__t" data-a="tog:saves" aria-expanded="${open}">Saves and backups <span>${open ? '&lsaquo;' : '&rsaquo;'}</span></button>`;
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
  let out = homeSection(w, p);

  // everyone else you know
  const fam = S.worldFilter;
  const fil = (id: string, label: string) => `<button class="ui-pill is-small ${fam === id ? 'on' : ''}" data-a="pf:${id}">${label}</button>`;
  // (the people at home are above; they are not contacts)
  const home = new Set([...(w.life?.kin ?? []).map((k) => k.id), ...(w.life?.partner && w.life.partner.stage !== 'split' ? [w.life.partner.id] : [])]);
  const known = Object.entries(p.rels).map(([id, r]) => [w.chars[id], r] as const).filter(([x]) => x && x.alive && x.id !== p.id && !home.has(x.id));
  const rows = known.filter(([x]) => fam === 'all' || (fam === 'pin' ? !!p.notes?.[x.id]?.pin : fam === 'none' ? !x.familyId : x.familyId === fam))
    .sort((a, b) => Number(!!p.notes?.[b[0].id]?.pin) - Number(!!p.notes?.[a[0].id]?.pin) || b[1].trust - a[1].trust);
  const lim = S.open['lfall'] ? 120 : 30;
  out += sect('The people you know', known.length ? String(known.length) : '');
  if (!known.length) return out + quiet('You don’t know anybody yet. Go to the club, sit at the bar, get a shave. Faces become names.') + peopleSide(w, p);
  out += `<div class="ui-pills lf-filter">${fil('all', 'Everyone')}${Object.values(w.fam).map((f) => fil(f.id, esc(f.name))).join('')}${fil('none', 'Not in the life')}${fil('pin', '&#9733; Pinned')}</div>`;
  // each man: his face, what he is, how he stands with you, and the first thing between you (ui/between.ts, as on his page)
  out += rows.length ? kitRows(rows.slice(0, lim).map(([x, r]): Row => {
    const n = p.notes?.[x.id];
    const what = x.rank === 'civilian' ? (ownerBiz(w, x.id)?.name ?? x.district) : `${x.rank === 'capo' ? 'captain' : x.rank}${x.familyId ? ', ' + w.fam[x.familyId].name : ''}`;
    const feel = r.grudge >= 0.3 ? grudgeWord(r.grudge) : r.trust > 0.6 ? 'close' : r.trust > 0.35 ? 'friendly' : 'a face you know';
    const tie = between(w, p, x).find((t) => t.kind !== 'rank' && t.kind !== 'word');
    return { face: avatar(x), title: `${n?.pin ? '★ ' : ''}${esc(x.name)}`, sub: `${esc(what)}${n?.tags.length ? ' · ' + esc(n.tags.join(', ')) : ''}${tie ? ` · <span class="pp-tie">${tie.text.replace(/<[^>]+>/g, '')}</span>` : ''}`, end: esc(feel), tone: r.grudge >= 0.3 ? 'bad' : '', a: `ent:${x.id}` };
  })) + (rows.length > lim ? acts(btn('tog:lfall', `Show all ${rows.length}`, 'quiet')) : '')
    : quiet(fam === 'pin' ? 'Nobody pinned. Open a man’s page and pin him, and he stays at the top of this list.' : 'Nobody you know fits.');
  return out + peopleSide(w, p);
}

// The people at home: whoever you are seeing, your blood, your children. Romance is one of these relationships, not a room of its own.
function homeSection(w: World, p: Character): string {
  const L = w.life;
  if (!L) return '';
  const pr = L.partner && L.partner.stage !== 'split' ? L.partner : undefined;
  const kin = L.kin.filter((k) => w.chars[k.id]?.alive);
  let out = sect('At home');
  const home: Row[] = [];
  if (pr) home.push({ face: avatar(w.chars[pr.id]), title: esc(w.chars[pr.id].name), sub: esc(stageWord[pr.stage]), end: esc(warmthWord(pr.warmth)), a: `ent:${pr.id}` });
  for (const k of kin) home.push({ face: avatar(w.chars[k.id]), title: esc(w.chars[k.id].name), sub: esc(kinWord(k).replace('Your ', '')), end: k.sick ? 'unwell' : esc(warmthWord(k.warmth)), tone: k.sick ? 'warn' : '', a: `ent:${k.id}` });
  out += home.length ? rows(home) : quiet('Nobody’s waiting up for you.');
  if (pr) return out + partnerBlock(w, p, pr);

  // nobody yet: an invitation, and the girls you might ask, when you want to see them
  const pool = datingPool(w, p).list.filter((x) => w.chars[x.id]?.alive);
  const open = !!S.open['dating'];
  out += `<div class="lf-invite"><p>${L.ex && w.chars[L.ex] ? `${esc(w.chars[L.ex].name)} is the one you let go. ` : ''}A man should have someone to go home to. Ask a girl out and it costs you an evening and a little money; the better your name and your manner, the better your odds. A no stays a no for a while.</p>`;
  out += pool.length ? `<button class="mini" data-a="tog:dating" aria-expanded="${open}">${open ? 'Not now' : `Who you might ask (${pool.length})`}</button>` : `<p class="muted">Nobody you’ve met this week. Give it time.</p>`;
  if (open && pool.length) out += choices(pool.map((x) => { const g = w.chars[x.id]; return { a: `askout:${g.id}`, label: g.name, hint: `${x.job}, ${g.district}. You see her ${x.where}. Ask her out ($20).` }; }), 'Who you might ask');
  return out + `</div>`;
}

function partnerBlock(w: World, p: Character, pr: NonNullable<NonNullable<World['life']>['partner']>): string {
  const g = w.chars[pr.id];
  const months = pr.due ? Math.max(1, Math.ceil((pr.due - w.now) / DAY / 30)) : 0;
  let out = `<div class="lf-her"><div class="lf-her__head">${avatar(g)}<div><h3>${pl(g)}</h3><p>${esc(cap(stageWord[pr.stage]))}. She is ${({ devoted: 'devoted to you', close: 'close to you', friendly: 'warm toward you', cooling: 'cooling on you', distant: 'distant with you' } as Record<string, string>)[warmthWord(pr.warmth)] ?? warmthWord(pr.warmth)}. ${pr.dates} evening${pr.dates === 1 ? '' : 's'} together.${pr.due ? ` She is expecting: ${months} month${months > 1 ? 's' : ''} to go.` : ''}</p></div></div>`;
  out += h('An evening with her') + choices(DATES.map((d) => ({ a: `dateplan:${d.code}`, label: `${d.label} ($${d.cost})`, hint: d.hint })), 'An evening with her');
  const next: Pick[] = [];
  if (pr.stage === 'seeing') next.push({ a: 'steady:', label: 'Ask her to be your girl', hint: pr.dates >= 3 && pr.warmth >= 0.5 ? 'She might say yes.' : 'Too early. A few more evenings first.' });
  if (pr.stage === 'steady') next.push({ a: 'marryask:', label: 'Ask her to marry you ($400 ring)', hint: pr.dates >= 8 && pr.warmth >= 0.7 ? 'You are both ready.' : 'She isn’t there yet. More time, more evenings.' });
  if (pr.stage === 'engaged') next.push({ a: 'wed:', label: 'Hold the wedding ($1,500)', hint: 'The whole family will come. They will bring envelopes.' });
  if (pr.stage === 'married') next.push({ a: 'baby:', label: pr.due ? 'She is expecting' : 'Talk about having a baby', hint: pr.due ? 'Nothing to do but be there.' : 'A child changes what is at stake.' });
  if (pr.stage !== 'married') next.push({ a: 'breakoff:', label: 'End it', hint: 'It is kinder done properly.', kind: 'danger' });
  out += h('Where this goes') + choices(next, 'Where this goes');
  return out + `</div>`;
}

function peopleSide(w: World, p: Character): string {
  let side = `<div class="lf-side">${sect('Find someone')}<p class="muted">Who is where, right now, and how far.</p><button class="ui-btn" data-a="people:">Who’s where</button></div>`;
  const pins = Object.entries(p.notes ?? {}).filter(([id, n]) => n.pin && w.chars[id]?.alive).map(([id]) => w.chars[id]);
  side += `<div class="lf-side">${sect('Pinned')}${pins.length ? `<ul class="ui-list">${pins.slice(0, 10).map((c) => `<li><span>${pl(c)}</span><span class="v"><button class="mini" data-a="talk:${c.id}">Talk</button></span></li>`).join('')}</ul>` : quiet('Pin a man from his page and he stays close at hand, here and at the top of your list.')}</div>`;
  const sore = Object.entries(p.rels).filter(([id, r]) => r.grudge >= 0.3 && w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge).slice(0, 4);
  if (sore.length) side += `<div class="lf-side">${sect('Men you haven’t forgiven')}<ul class="ui-list">${sore.map(([id, r]) => `<li><span>${pl(w.chars[id])}</span><span class="v warn">${esc(grudgeWord(r.grudge))}</span></li>`).join('')}</ul><button class="ui-btn ui-btn--quiet" data-a="grudges:">Settle a score &rsaquo;</button></div>`;
  toSide(side);
  return '';
}

// =================================================================== Business
export function businessRoom(): string {
  const w = W(), p = P();
  const b = p.books;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const wk = week(w, p);
  let out = '';
  // the week: what comes in, what goes out, and how far into it you are (ui/money.ts, the one account every screen reads)
  out += h('Your week', wk.inTotal || wk.outTotal ? `${money(wk.inTotal)} in · ${money(wk.outTotal)} out` : '');
  if (!wk.comingIn.length && !wk.goingOut.length) out += quiet('Nothing comes in yet beyond what’s in your pocket. Rackets is where the money starts.') + acts(btn('sub:business.rackets', 'Ways to earn'));
  else out += rows([
    ...wk.comingIn.map((f): Row => ({ title: esc(f.label), sub: f.note ? esc(f.note) : '', end: `<span class="fig">+${esc(money(f.amt))}</span> <small>a week</small>`, tone: 'good', a: f.a })),
    ...wk.goingOut.map((f): Row => ({ title: esc(f.label), sub: f.note ? esc(f.note) : '', end: `<span class="fig">−${esc(money(f.amt))}</span> <small>a week</small>`, tone: 'warn', a: f.a })),
  ]);
  out += kv([
    ['This week so far', wk.soFar ? `<span class="fig">${esc(money(wk.soFar))}</span>` : 'nothing yet: it comes in on Sunday evening'],
    ...(wk.last ? [['Last week', `earned <span class="fig">${esc(money(wk.last.earned))}</span>${wk.last.due ? `, handed up <span class="fig">${esc(money(wk.last.handed))}</span> of ${esc(money(wk.last.due))}` : ''}`, wk.last.due && wk.last.handed < wk.last.due ? 'warn' : ''] as KV] : []),
  ]);
  if (boss) {
    const st = b.stance ?? 'honest';
    const seg = (id: string, label: string) => `<button class="ui-seg__b${st === id ? ' is-on' : ''}" data-a="stance:${id}" aria-pressed="${st === id}">${label}</button>`;
    out += h('The envelope', 'every Sunday');
    out += `<p>${pl(boss)} takes <b>${Math.round(effectiveRate(w, p) * 100)}%</b> of what you declare.${b.arrears > 0 ? ` You are behind by <b class="hurt">${money(b.arrears)}</b>.` : ''}</p>`;
    out += `<div class="ui-seg" role="group" aria-label="How straight you are with him">${seg('honest', 'Straight')}${seg('shave', 'Shave 30%')}${seg('stall', 'Stall')}</div>`;
    out += `<p class="ui-note">${st === 'honest' ? 'You declare everything. It builds your name.' : st === 'shave' ? 'You under-report. He may notice, and if he does, you’ll hear about it.' : 'You pay nothing this week. He’ll notice.'}</p>`;
  }
  // money owed either way (favours and promises are kept in the Journal, under Your word)
  const debts = w.debts.filter((d) => d.status === 'active' && (d.creditor === p.id || d.debtor === p.id));
  out += h('Money owed', debts.length ? String(debts.length) : '');
  out += debts.length ? rows(debts.filter((d) => w.chars[d.creditor === p.id ? d.debtor : d.creditor]).map((d): Row => {
    const other = w.chars[d.creditor === p.id ? d.debtor : d.creditor], mine = d.creditor === p.id;
    return { face: avatar(other), title: mine ? `${esc(other.name)} owes you` : `You owe ${esc(other.name)}`, sub: `${esc(money(d.weeklyPayment))} a week${d.missed ? `, ${d.missed} missed` : ''} · ${mine ? 'see him about it' : 'talk terms'}`, end: `<span class="fig">${esc(money(d.balance))}</span>`, tone: mine ? (d.missed ? 'warn' : '') : 'warn', a: `talk:${other.id}|tk:debt:${d.id}` };
  })) : quiet('Nobody owes you money and you owe nobody. That won’t last.');
  const fav = owedTo(w, p.id).length + owing(w, p.id).length;
  if (fav) out += acts(btn('sub:journal.word', `Favours either way (${fav})`, 'quiet'));
  out += lendingCard();

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
