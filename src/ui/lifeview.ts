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
import { queueView } from './family';
import { pathCard, powersCard } from './pathview';
import { ambitionCard } from './ambview';
import { disputesList } from './views_c';
import { crewList } from './views_b';

export type LifeRoom = 'you' | 'people' | 'business' | 'known';
const ROOMS: [LifeRoom, string][] = [['you', 'You'], ['people', 'People'], ['business', 'Business'], ['known', 'What you know']];

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

const sect = (title: string, aside = '') => `<h2 class="lf-h">${title}${aside ? `<small>${aside}</small>` : ''}</h2>`;
const quiet = (text: string) => `<p class="lf-quiet">${text}</p>`;
const first = (c: Character) => c.name.split(' ')[0];

export function lifeTab(): string {
  S.lifeSub = roomOf(S.lifeSub);
  const nav = `<nav class="lf-nav" aria-label="Your life">${ROOMS.map(([id, label]) => `<button class="${S.lifeSub === id ? 'on' : ''}" data-a="lsub:${id}" aria-current="${S.lifeSub === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>`;
  const body = S.lifeSub === 'people' ? peopleRoom() : S.lifeSub === 'business' ? businessRoom() : S.lifeSub === 'known' ? knownRoom() : youRoom();
  return nav + body;
}

// =================================================================== You
export function youRoom(): string {
  const w = W(), p = P();
  const bgx = p.bg ? bgLabel(p.bg) : undefined;
  let out = `<header class="lf-me">${avatar(p)}<div><h1>${esc(p.name)}</h1><div class="sub">${esc(cap(p.rank))}${p.familyId ? ` of the ${esc(famName(w, p))} family` : ''} &middot; ${esc(p.district)}</div>${bgx ? `<p class="lf-bg"><b>${esc(bgx)}.</b>${bgOf(p.bg) ? ' ' + esc(bgOf(p.bg)!.blurb) : ''}</p>` : ''}<div class="tags">${traitTags(p)}</div></div></header>`;
  if (p.jailedUntil > w.now) out += `<p class="callout bad">You’re locked up. The world goes on without you for now.</p>`;
  else if (p.hurtUntil > w.now) out += `<p class="callout bad">You’re hurt. Take it easy until you mend.</p>`;

  // where you stand, and the road ahead: one account of it, not two
  out += standing(w, p);
  // V90: who you have shown yourself to be, in words, from what you have done (never chosen, never a score)
  out += `<div class="card"><h2>The man you’ve shown them</h2>${characterWords(p).map((x) => `<p>${esc(x)}</p>`).join('')}<p class="muted">Each man sees you through what he has seen and heard himself.</p></div>`;
  if (p.familyId) out += queueView();
  out += ambitionCard();

  // what you are known for: the four reputations, said once; skills beside them
  const sc = specScores(w, p);
  const specs = (Object.keys(SPEC_LABEL) as Spec[]).filter((s) => tierOf(sc[s]) > 0).sort((a, b) => sc[b] - sc[a]);
  out += sect('What you’re known for');
  out += specs.length
    ? `<ul class="rows">${specs.map((s) => `<li><span>${SPEC_LABEL[s]}${tierOf(sc[s]) >= 2 ? `<small class="lf-perk">${esc(SPEC_PERK[s])}</small>` : ''}</span><span class="v ${tierOf(sc[s]) >= 2 ? 'good' : ''}">${TIER_WORD[tierOf(sc[s])]}</span></li>`).join('')}</ul>`
    : quiet('Nothing yet. A name is made by what you do: earn, run something, talk a man round, or put one down, and people start to say it of you.');
  out += `<details class="lf-fold"><summary>What you’re good at</summary>${skillBars(p)}</details>`;
  { const pc = powersCard(); if (pc) out += `<details class="lf-fold"><summary>What your rank lets you do</summary>${pc}</details>`; }
  out += `<div class="lf-links"><button class="more" data-a="goals:">Milestones &rsaquo;</button><button class="more" data-a="dayjob:">${p.job ? `Your job: ${esc(p.job.kind)} &rsaquo;` : 'Find legitimate work &rsaquo;'}</button></div>`;
  out += savesFold();

  // beside it: how the street sees you, who is around you, and what you have going
  let side = `<div class="lf-side">${sect('What they say about you')}${repLines(w, p).map((l) => `<p class="say">${esc(l)}</p>`).join('')}</div>`;
  const patron = p.bossId ? w.chars[p.bossId] : undefined;
  const men = crewList().length;
  side += `<div class="lf-side">${sect('Around you')}<ul class="rows">${patron ? `<li><span>You answer to</span><span class="v">${pl(patron)}</span></li>` : ''}${p.sponsor && w.chars[p.sponsor] ? `<li><span>Speaks for you</span><span class="v">${pl(w.chars[p.sponsor])}</span></li>` : ''}${p.backer && w.chars[p.backer] ? `<li><span>Backs you</span><span class="v">${pl(w.chars[p.backer])}</span></li>` : ''}<li class="lf-phone"><span>Your name</span><span class="v">${esc(standingWord(p.standing))}</span></li><li class="lf-phone"><span>Your pull</span><span class="v">${esc(influenceWord(influence(w, p)))}</span></li>${men ? `<li><span>Men under you</span><span class="v">${men}</span></li>` : ''}</ul></div>`;
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
  side += `<div class="lf-side">${sect('What you have going')}${rows.length ? `<ul class="rows">${rows.join('')}</ul>` : quiet("Nothing on the books yet. Nobody pays you, nobody owes you, nobody works for you. Make yourself useful and that changes.")}<button class="more" data-a="lsub:business">The money &rsaquo;</button></div>`;
  toSide(side);
  return out;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Where you stand for the next rank. A promotion under way says so; otherwise the road, one line per thing still to do.
function standing(w: World, p: Character): string {
  const steps = promoSteps(w, p);
  if (steps) return `<div class="card lf-road"><h2>Being considered</h2><ul class="rows">${steps.map((x) => `<li><span class="${x.state === 'wait' ? 'muted' : ''}">${x.state === 'done' ? '&#10003;' : x.state === 'now' ? '&#9679;' : '&#9675;'} ${esc(x.label)}</span><span class="v ${x.state === 'now' ? 'warn' : x.state === 'done' ? 'good' : ''}">${lk(x.note)}</span></li>`).join('')}</ul></div>`;
  if (pathInfo(w, p)) return pathCard();
  const st = standingTable(w, p);
  if (st.rows.length) return `<div class="card lf-road"><h2>Your standing in the ${esc(famName(w, p))} family</h2><ul class="rows">${st.rows.map((r) => `<li><span>${esc(r.label)}</span><span class="v ${r.tone}">${esc(r.value)}</span></li>`).join('')}</ul><div class="callout ${st.verdict.startsWith('Held') ? '' : 'info'}">${esc(st.verdict)}</div></div>`;
  return careerLines(w, p).map((l) => `<p class="lf-bg">${lk(l)}</p>`).join('');
}

const snapList = (): { day: number; key: string; label: string }[] => saveBox()?.snaps ?? [];
// The game itself: saving, backups, going back a day, starting over. Kept out of the way, at the foot of the page.
function savesFold(): string {
  const open = !!S.open['saves'] || S.confirmReset;
  let out = `<div class="lf-saves"><button class="lf-saves__t" data-a="tog:saves" aria-expanded="${open}">Saves and backups <span>${open ? '&lsaquo;' : '&rsaquo;'}</span></button>`;
  if (!open) return out + `</div>`;
  out += `<div class="list"><button class="opt" data-a="save:"><b>Save now</b><span class="because">${S.save ? (S.save.ok ? `Last saved ${esc(S.saveGood || fmtTime(W().now))}. This game takes ${(S.save.bytes / 1e6).toFixed(2)} MB; with ${S.save.snapshots} earlier-day snapshot${S.save.snapshots === 1 ? '' : 's'}, ${(S.save.used / 1e6).toFixed(2)} MB${deepStorage() ? ' in all, kept in this browser' : ' of roughly 5 MB this browser allows'}.` : 'NOT saved: ' + esc(S.save.error ?? '')) : 'The game saves itself after every action, in this browser only.'}</span></button>`;
  out += `<button class="opt" data-a="dlsave:"><b>Download a backup file</b><span class="because">A copy you can keep outside the browser.</span></button><button class="opt" data-a="ulsave:"><b>Load a backup file</b><span class="because">Replaces the game you are playing.</span></button>`;
  out += `<button class="opt ${S.confirmReset ? 'danger' : ''}" data-a="reset:"><b>${S.confirmReset ? 'Tap again to erase this game and start over' : 'Start a new game'}</b></button></div><input type="file" id="ulfile" accept=".json,application/json" hidden>`;
  if (storageNote()) out += `<div class="callout info">${esc(storageNote())}</div>`;
  const l = snapList();
  if (l.length) out += `<h3 class="sub">Earlier days, if you need to undo</h3><div class="list">${l.map((x) => `<button class="opt" data-a="restore:${x.key}"><b>${esc(x.label)}</b><span class="because">Go back to this day. Everything since is lost.</span></button>`).join('')}</div>`;
  return out + `</div>`;
}

// =================================================================== People
export function peopleRoom(): string {
  const w = W(), p = P();
  let out = homeSection(w, p);

  // everyone else you know
  const fam = S.worldFilter;
  const fil = (id: string, label: string) => `<button class="pill small ${fam === id ? 'on' : ''}" data-a="pf:${id}">${label}</button>`;
  // (the people at home are above; they are not contacts)
  const home = new Set([...(w.life?.kin ?? []).map((k) => k.id), ...(w.life?.partner && w.life.partner.stage !== 'split' ? [w.life.partner.id] : [])]);
  const known = Object.entries(p.rels).map(([id, r]) => [w.chars[id], r] as const).filter(([x]) => x && x.alive && x.id !== p.id && !home.has(x.id));
  const rows = known.filter(([x]) => fam === 'all' || (fam === 'pin' ? !!p.notes?.[x.id]?.pin : fam === 'none' ? !x.familyId : x.familyId === fam))
    .sort((a, b) => Number(!!p.notes?.[b[0].id]?.pin) - Number(!!p.notes?.[a[0].id]?.pin) || b[1].trust - a[1].trust);
  const lim = S.open['lfall'] ? 120 : 30;
  out += sect('The people you know', known.length ? String(known.length) : '');
  if (!known.length) return out + quiet('You don’t know anybody yet. Go to the club, sit at the bar, get a shave. Faces become names.') + peopleSide(w, p);
  out += `<div class="pills lf-filter">${fil('all', 'Everyone')}${Object.values(w.fam).map((f) => fil(f.id, esc(f.name))).join('')}${fil('none', 'Not in the life')}${fil('pin', '&#9733; Pinned')}</div>`;
  out += rows.length ? `<ul class="rows lf-people">${rows.slice(0, lim).map(([x, r]) => {
    const n = p.notes?.[x.id];
    const what = x.rank === 'civilian' ? (ownerBiz(w, x.id)?.name ?? x.district) : `${x.rank}${x.familyId ? ', ' + w.fam[x.familyId].name : ''}`;
    const feel = r.grudge >= 0.3 ? grudgeWord(r.grudge) : r.trust > 0.6 ? 'close' : r.trust > 0.35 ? 'friendly' : 'a face you know';
    return `<li><span>${n?.pin ? '<span class="lf-star" title="Pinned">&#9733;</span> ' : ''}${pl(x)}<small class="muted">${esc(what)}${n?.tags.length ? ' &middot; ' + esc(n.tags.join(', ')) : ''}</small></span><span class="v ${r.grudge >= 0.3 ? 'warn' : ''}">${esc(feel)}</span></li>`;
  }).join('')}</ul>${rows.length > lim ? `<button class="more" data-a="tog:lfall">Show all ${rows.length} &rsaquo;</button>` : ''}`
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
  const rows: string[] = [];
  const rowbtn = (id: string, left: string, right: string, tone = '') => `<li><button class="rowbtn lf-row" data-a="ent:${id}"><span>${left}</span><span class="v ${tone}">${right}</span></button></li>`;
  if (pr) rows.push(rowbtn(pr.id, `${esc(w.chars[pr.id].name)} <small class="muted">${esc(stageWord[pr.stage])}</small>`, esc(warmthWord(pr.warmth))));
  for (const k of kin) rows.push(rowbtn(k.id, `${esc(w.chars[k.id].name)} <small class="muted">${esc(kinWord(k).replace('Your ', ''))}</small>`, k.sick ? 'unwell' : esc(warmthWord(k.warmth)), k.sick ? 'warn' : ''));
  out += rows.length ? `<ul class="rows">${rows.join('')}</ul>` : quiet('Nobody’s waiting up for you.');
  if (pr) return out + partnerBlock(w, p, pr);

  // nobody yet: an invitation, and the girls you might ask, when you want to see them
  const pool = datingPool(w, p).list.filter((x) => w.chars[x.id]?.alive);
  const open = !!S.open['dating'];
  out += `<div class="lf-invite"><p>${L.ex && w.chars[L.ex] ? `${esc(w.chars[L.ex].name)} is the one you let go. ` : ''}A man should have someone to go home to. Ask a girl out and it costs you an evening and a little money; the better your name and your manner, the better your odds. A no stays a no for a while.</p>`;
  out += pool.length ? `<button class="mini" data-a="tog:dating" aria-expanded="${open}">${open ? 'Not now' : `Who you might ask (${pool.length})`}</button>` : `<p class="muted">Nobody you’ve met this week. Give it time.</p>`;
  if (open && pool.length) out += `<div class="list">${pool.map((x) => { const g = w.chars[x.id]; return `<button class="opt" data-a="askout:${g.id}"><b>${esc(g.name)}</b><span class="because">${esc(x.job)}, ${esc(g.district)}. You see her ${esc(x.where)}. Ask her out ($20).</span></button>`; }).join('')}</div>`;
  return out + `</div>`;
}

function partnerBlock(w: World, p: Character, pr: NonNullable<NonNullable<World['life']>['partner']>): string {
  const g = w.chars[pr.id];
  const months = pr.due ? Math.max(1, Math.ceil((pr.due - w.now) / DAY / 30)) : 0;
  let out = `<div class="lf-her"><div class="lf-her__head">${avatar(g)}<div><h3>${pl(g)}</h3><p>${esc(cap(stageWord[pr.stage]))}. She is ${({ devoted: 'devoted to you', close: 'close to you', friendly: 'warm toward you', cooling: 'cooling on you', distant: 'distant with you' } as Record<string, string>)[warmthWord(pr.warmth)] ?? warmthWord(pr.warmth)}. ${pr.dates} evening${pr.dates === 1 ? '' : 's'} together.${pr.due ? ` She is expecting: ${months} month${months > 1 ? 's' : ''} to go.` : ''}</p></div></div>`;
  out += `<h3 class="sub">An evening with her</h3><div class="list">${DATES.map((d) => `<button class="opt" data-a="dateplan:${d.code}"><b>${esc(d.label)} <small class="muted">$${d.cost}</small></b><span class="because">${esc(d.hint)}</span></button>`).join('')}</div>`;
  const next: string[] = [];
  if (pr.stage === 'seeing') next.push(`<button class="opt" data-a="steady:"><b>Ask her to be your girl</b><span class="because">${pr.dates >= 3 && pr.warmth >= 0.5 ? 'She might say yes.' : 'Too early. A few more evenings first.'}</span></button>`);
  if (pr.stage === 'steady') next.push(`<button class="opt" data-a="marryask:"><b>Ask her to marry you ($400 ring)</b><span class="because">${pr.dates >= 8 && pr.warmth >= 0.7 ? 'You are both ready.' : 'She isn’t there yet. More time, more evenings.'}</span></button>`);
  if (pr.stage === 'engaged') next.push(`<button class="opt" data-a="wed:"><b>Hold the wedding ($1,500)</b><span class="because">The whole family will come. They will bring envelopes.</span></button>`);
  if (pr.stage === 'married') next.push(`<button class="opt" data-a="baby:"><b>${pr.due ? 'She is expecting' : 'Talk about having a baby'}</b><span class="because">${pr.due ? 'Nothing to do but be there.' : 'A child changes what is at stake.'}</span></button>`);
  if (pr.stage !== 'married') next.push(`<button class="opt danger" data-a="breakoff:"><b>End it</b><span class="because">It is kinder done properly.</span></button>`);
  out += `<h3 class="sub">Where this goes</h3><div class="list">${next.join('')}</div>`;
  return out + `</div>`;
}

function peopleSide(w: World, p: Character): string {
  let side = `<div class="lf-side">${sect('Find someone')}<p class="muted">Who is where, right now, and how far.</p><button class="btn" data-a="people:">Who’s where</button></div>`;
  const pins = Object.entries(p.notes ?? {}).filter(([id, n]) => n.pin && w.chars[id]?.alive).map(([id]) => w.chars[id]);
  side += `<div class="lf-side">${sect('Pinned')}${pins.length ? `<ul class="rows">${pins.slice(0, 10).map((c) => `<li><span>${pl(c)}</span><span class="v"><button class="mini" data-a="talk:${c.id}">Talk</button></span></li>`).join('')}</ul>` : quiet('Pin a man from his page and he stays close at hand, here and at the top of your list.')}</div>`;
  const sore = Object.entries(p.rels).filter(([id, r]) => r.grudge >= 0.3 && w.chars[id]?.alive).sort((a, b) => b[1].grudge - a[1].grudge).slice(0, 4);
  if (sore.length) side += `<div class="lf-side">${sect('Men you haven’t forgiven')}<ul class="rows">${sore.map(([id, r]) => `<li><span>${pl(w.chars[id])}</span><span class="v warn">${esc(grudgeWord(r.grudge))}</span></li>`).join('')}</ul><button class="more" data-a="grudges:">Settle a score &rsaquo;</button></div>`;
  toSide(side);
  return '';
}

// =================================================================== Business
export function businessRoom(): string {
  const w = W(), p = P();
  const b = p.books;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  let out = '';
  if (boss) {
    const st = b.stance ?? 'honest';
    const pill = (id: string, label: string) => `<button class="pill small ${st === id ? 'on' : ''}" data-a="stance:${id}" aria-pressed="${st === id}">${label}</button>`;
    out += sect('The envelope', 'every Sunday');
    out += `<p>${pl(boss)} takes <b>${Math.round(effectiveRate(w, p) * 100)}%</b> of what you declare.${b.arrears > 0 ? ` You are behind by <b class="hurt">${money(b.arrears)}</b>.` : ''}</p>`;
    out += `<p class="muted">How straight are you with him?</p><div class="pills">${pill('honest', 'Straight')}${pill('shave', 'Shave 30%')}${pill('stall', 'Stall')}</div>`;
    out += `<p class="lf-note">${st === 'honest' ? 'You declare everything. It builds your name.' : st === 'shave' ? 'You under-report. He may notice, and if he does, you’ll hear about it.' : 'You pay nothing this week. He’ll notice.'}</p>`;
  }

  // what is owed, either way: debts and favours together, because that is how a man thinks of them
  const debts = w.debts.filter((d) => d.status === 'active' && (d.creditor === p.id || d.debtor === p.id));
  const mine = owedTo(w, p.id), ours = owing(w, p.id);
  out += sect('What’s owed');
  if (!debts.length && !mine.length && !ours.length) out += quiet('Nobody owes you and you owe nobody. That won’t last.');
  else {
    const rows: string[] = [];
    for (const d of debts) {
      const other = w.chars[d.creditor === p.id ? d.debtor : d.creditor];
      if (!other) continue;
      rows.push(`<li><span>${d.creditor === p.id ? `${pl(other)} owes you` : `You owe ${pl(other)}`}<small class="muted">${money(d.weeklyPayment)} a week${d.missed ? `, ${d.missed} missed` : ''}</small></span><span class="v ${d.debtor === p.id ? 'warn' : ''}">${money(d.balance)}</span></li>`);
    }
    for (const f of mine) if (w.chars[f.to]) rows.push(`<li><span>${pl(w.chars[f.to])} owes you a favour</span><span class="v good">${esc(favourWord(f.size))}</span></li>`);
    for (const f of ours) if (w.chars[f.from]) rows.push(`<li><span>You owe ${pl(w.chars[f.from])} a favour</span><span class="v warn">${esc(favourWord(f.size))}</span></li>`);
    out += `<ul class="rows lf-people lf-owed">${rows.join('')}</ul>`;
  }
  out += lendingCard();

  // beside it: the books, in words and real money
  const shops = Object.values(w.biz).filter((x) => x.protection?.collectorId === p.id);
  const behind = shops.filter((x) => owedOf(x) > 0);
  const stakes = stakesOf(w, p.id).length;
  const rows: string[] = [];
  const row = (k: string, v: string, tone = '') => rows.push(`<li><span>${k}</span><span class="v ${tone}">${v}</span></li>`);
  if (p.weekIncome) row('Made last week', money(p.weekIncome));
  if (shops.length) row('Shops paying you', `${shops.length}, ${money(shops.reduce((a, x) => a + (x.protection?.fee ?? 0), 0))} a week`);
  if (behind.length) row('Shops behind', `${behind.length}, ${money(behind.reduce((a, x) => a + owedOf(x), 0))}`, 'warn');
  if (stakes) row('Stakes in businesses', String(stakes));
  const owedIn = debts.filter((d) => d.creditor === p.id), owedOut = debts.filter((d) => d.debtor === p.id);
  if (owedIn.length) row('Coming back to you', `${money(owedIn.reduce((a, d) => a + d.weeklyPayment, 0))} a week`, 'good');
  if (owedOut.length) row('Going out', `${money(owedOut.reduce((a, d) => a + d.weeklyPayment, 0))} a week`, 'warn');
  if (p.lifetimeKick) row('Passed up, all told', money(p.lifetimeKick));
  let side = `<div class="lf-side">${sect('Your books')}${rows.length ? `<ul class="rows">${rows.join('')}</ul>` : quiet('Nothing coming in yet beyond what’s in your pocket. Rackets is where the money starts.')}${rows.length ? '' : `<button class="more" data-a="tab:rackets">Ways to earn &rsaquo;</button>`}</div>`;
  const cur = Math.floor(w.now / (7 * DAY));
  const hist = b.history.slice(-6).reverse();
  if (hist.length) side += `<div class="lf-side">${sect('Sundays past')}<ul class="rows lf-people lf-owed">${hist.map((h) => { const n = cur - 1 - h.week; return `<li><span>${n <= 0 ? 'Last week' : n === 1 ? 'The week before' : `${cap(NUM[n + 1] ?? String(n + 1))} weeks back`}<small class="muted">earned ${money(h.gross)}${h.received ? `, your men brought ${money(h.received)}` : ''}</small></span><span class="v ${h.due && h.paid < h.due ? 'warn' : ''}">${h.due ? `paid ${money(h.paid)} of ${money(h.due)}` : 'nothing due'}</span></li>`; }).join('')}</ul></div>`;
  else side += `<div class="lf-side">${sect('Sundays past')}${quiet('No Sunday has come round yet. When it does, what you made and what you handed up will be written here.')}</div>`;
  toSide(side);
  return out;
}

function lendingCard(): string {
  const w = W(), p = P();
  const rows = Object.values(w.biz)
    .filter((b) => b.open && b.kind !== 'casino')
    .map((b) => ({ b, o: w.chars[b.ownerId] }))
    .filter(({ o }) => o?.alive && o.rank === 'civilian' && !w.debts.some((d) => d.status === 'active' && d.debtor === o.id))
    .sort((a, c) => Number(c.b.district === p.district) - Number(a.b.district === p.district) || c.b.distress - a.b.distress)
    .slice(0, 8);
  return sect('Who could use a loan', 'owners with no lender') + (rows.length
    ? `<ul class="rows">${rows.map(({ b, o }) => `<li><button class="rowbtn lf-row" data-a="talk:${o.id}"><span>${esc(o.name)} <small class="muted">${esc(b.name)}, ${esc(b.district)}</small></span><span class="v ${b.distress > 0.4 ? 'warn' : ''}">${b.distress > 0.6 ? 'struggling' : b.distress > 0.25 ? 'tight' : 'steady'}</span></button></li>`).join('')}</ul><p class="lf-note">Tap a name and go and offer him money. Struggling men take it more readily, and pay back less easily.</p>`
    : quiet('Everyone around here has a lender already.'));
}

// =================================================================== What you know
export function knownRoom(): string {
  const w = W(), p = P();
  let out = disputesList();
  const all = Object.entries(p.known).filter(([id]) => w.facts[id] && !w.facts[id].minor).sort((a, b) => w.facts[b[0]].t - w.facts[a[0]].t);
  const lim = S.open['lfknown'] ? 80 : 25;
  const items = all.slice(0, lim);
  if (!items.length) out += sect('What you’ve heard') + quiet('You know nothing yet. Go and be seen; sit at the club, listen at the bar. What you hear will be written here.');
  else {
    const day = (t: number) => Math.floor(w.now / DAY) - Math.floor(t / DAY);
    const band = (t: number) => { const d = day(t); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This past week' : 'Before that'; };
    let cur = '';
    for (const [id, k] of items) {
      const f = w.facts[id];
      const b = band(f.t);
      if (b !== cur) { out += (cur ? '</ul>' : '') + sect(b) + '<ul class="lf-heard">'; cur = b; }
      out += `<li><a class="lf-fact" href="#" data-a="fact:${id}">${esc(youify(factText(f, k.knowsActor)))}</a>${day(f.t) >= 2 ? `<span class="lf-when">${esc(agoWord(w.now, f.t))}</span>` : ''}</li>`;
    }
    out += '</ul>';
    if (all.length > lim) out += `<button class="more" data-a="tog:lfknown">Further back &rsaquo;</button>`;
  }

  // beside it: your notebook (who you have marked, and why), the scores you carry, and where the stories are followed
  let side = '';
  const noted = Object.entries(p.notes ?? {}).filter(([id, n]) => n.tags.length && w.chars[id]?.alive);
  side += `<div class="lf-side">${sect('Your notebook')}${noted.length ? `<ul class="rows">${noted.slice(0, 12).map(([id, n]) => `<li><span>${pl(w.chars[id])}</span><span class="v lf-tags">${esc(n.tags.join(', '))}</span></li>`).join('')}</ul>` : quiet(`Mark a man from his page (${esc(TAGS.slice(0, 3).map((t) => `“${t}”`).join(', '))}…) and what you have marked gathers here.`)}</div>`;
  const wronged = all.filter(([id]) => { const f = w.facts[id]; return f.victim === p.id && ['beating', 'robbery', 'vandalism', 'poach'].includes(f.kind) && w.now - f.t < 40 * DAY; }).length;
  if (wronged) side += `<div class="lf-side">${sect('Scores to settle')}<p class="muted">${wronged === 1 ? 'One thing' : `${wronged} things`} done to you that you haven’t forgotten.</p><button class="btn" data-a="grudges:">Settle a score</button></div>`;
  side += `<div class="lf-side">${sect('Stories')}<p class="muted">What you know, followed as it unfolds: who did what, and what may come of it.</p><button class="more" data-a="tab:stories">Open the stories &rsaquo;</button></div>`;
  toSide(side);
  return out;
}
