import { doMove } from './sitmoves';
import { matterAct } from './matters';
import { openAsks, playerMove, type AskMove } from './asks';
import { subjectRows } from './talk';
// Mobile web front end. Same engine as the CLI, different skin.
import { generate, perform } from './actions';
import { crewOf } from './crewlife';
import { clubOf } from './clubdata';
import { addFact, bearOn, clamp, factText, famName, feelOn, fmtTime, money, rel } from './core';
import { advance, deserialize, serialize } from './engine';
import { pruneJobs, approaches, assign, declineJob, dropJob, performMove, resolve, startScheme, takeJob, askAroundJob, haggleJob, investigateJob, pressJob, questionJob } from './jobs';
import { recommend, recruit, reward } from './career';
import { chairAct, raise, setRank, usePower } from './path';
import { manageView, commView } from './ui/pathview';
import { bjLobby, bjTable, bjDeal, bjAct } from './ui/blackjack';
import { buyLife, courtBoss, propose, setBoss, setConsigliere, setHeir } from './powers2';
import { auditMember, checkBooks, envelopeSum, handOver, rule, setStance } from './books';
import { post } from './ledger';
import { statement } from './ledger';
import { say, startConvo, introduced, arrive, isNavCode } from './dialogue';
import { closeMeeting, choose as meetChoose, current as meetCurrent, openAccountsMeeting, openCrewMeeting, openFamilyMeeting, openGathering, openInduction, openSitdown } from './meetings';
import { setManager } from './econ';
import { giveOrder, ownJob, questionReport, recruitProspect, takeDayJob, quitDayJob, workShift } from './orders';
import { helpMan } from './people';
import { drinkAt, shave, sitAtClub } from './places';
import { toggleTag, togglePin } from './notebook';
import { seePartner, visitKin, askOut, askSteady, askMarry, wedding, tryForBaby, breakOff, datePlan, datingPool } from './life';
import { askPermission } from './politics';
import { settleDo } from './revenge';
import { closeOp, countOp, hijack, opRule, startOp } from './rackets';
import { Kind } from './types';
import { createWorld } from './world';
import type { World } from './types';
import { relevance } from './reports';
import { ignoreDispute, investigate, callSitdown, playerActed, touchDispute } from './disputes';
import { whereIs } from './where';
import { back as backBtn } from './ui/common';
import { esc, lk, P, S, W } from './ui/links';
import type { Tab, View } from './ui/state';
import { storiesTab, newStories } from './ui/stories';
import { goalsView, disputeView, storyView, storyExists } from './ui/views_c';
import { encView, factView, bizView, attentionCount, personView, todayView } from './ui/views_a';
import { choose as encChoose } from './encounters';
import {
  approachView, booksView, crewList, crewView, dayjobView, delegateView, familyTab, grudgesView, settleView, guestsView, helpView, jobView, lifeTab, meetingView,
  menuView, placesView, opStartView, opView, hijackView, ordersView, peopleView, placeView, planView, recruitView, reportView, sendView, talkView, waitChoices, waitView,
} from './ui/views_b';
import { treeView } from './ui/views_a';
import { leaveCrew } from './rank';
import type { Snap } from './storage';
import { onSaved, openSaves, saveBox, storageNote } from './savestore';
import { briefView } from './ui/brief';
import { bottomTabs, rail, takeSide, topBar } from './ui/layout';
import { roomOf } from './ui/lifeview';
import { openSection, sectionView } from './ui/sections';
import { startingLines } from './background';
import { draftBg, draftDone, draftName, forgetSummary, openingAct, openingView, typed } from './ui/opening';
import { fullName } from './names';
import { sundayView, sKey } from './ui/sunday';
import { racketsView, wayView } from './ui/views_c';


// ------------------------------------------------------------------ storage
// The save lives in IndexedDB (savestore.ts), read into memory once before the first screen. A week of earlier days is
// kept, one per game day, so one bad day is never the end of a run.
export function snapList(): Snap[] {
  return saveBox()?.snaps ?? [];
}
// Saving is never silent: every outcome lands in S.save, and render() shows it whenever it is bad. The world is
// serialized now, so later changes cannot race the write; the write itself happens in the background.
function save(): void {
  if (!S.w) return;
  const b = saveBox();
  if (!b) { S.save = { ok: false, available: false, bytes: 0, used: 0, snapshots: 0, error: 'this browser will not let the game keep anything' }; return; }
  try {
    b.put(serialize(S.w), Math.floor(S.w.now / 1440), fmtTime(S.w.now));
  } catch (e) {
    S.save = { ok: false, available: true, bytes: 0, used: 0, snapshots: 0, error: e instanceof Error ? e.message : 'the game could not be written down' };
  }
}
// A finished write: a failure (or the first good write after one) is shown at once; a quiet success waits for the next screen.
onSaved((st) => {
  const was = S.save;
  if (st.ok && S.w) S.saveGood = fmtTime(S.w.now);
  S.save = st;
  if (S.w && (!st.ok || (was && !was.ok))) { const y = window.scrollY; render(); window.scrollTo(0, y); }
});
function downloadSave() {
  if (!S.w) return;
  const name = `omerta-day-${Math.floor(S.w.now / 1440)}.json`;
  const data = serialize(S.w);
  const say = (m: string) => { S.notice = m; render(); };
  // Inside claude.ai a page cannot download directly; it asks the viewer through the downloads capability.
  const cl = (window as unknown as { claude?: { use(n: string): Promise<{ save(r: { filename: string; data: string }): Promise<unknown> } | null> } }).claude;
  if (cl) {
    cl.use('downloads').then((d) => {
      if (!d) return say('Backup files can’t be saved from this view.');
      return d.save({ filename: name, data }).then(() => say('Backup saved.'), (e: { code?: string }) => say(e?.code === 'declined' ? 'Backup cancelled.' : 'Could not save a backup file here.'));
    }, () => say('Could not save a backup file here.'));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const hasSave = () => !!saveBox()?.hasSave();
// The saved game, opened. If the main save will not open, the newest snapshot that does is used, and the player is told.
async function load(): Promise<World | null> {
  const b = saveBox();
  const s = b?.main;
  if (!b || !s) return null;
  try { return deserialize(s); } catch (e) { console.error(e); }
  for (const sn of b.snaps) {
    const raw = await b.readSnap(sn.key);
    if (!raw) continue;
    try { const w = deserialize(raw); S.notice = `Your latest save could not be opened, so this is the snapshot from ${sn.label}. The damaged save will be replaced by your next save.`; return w; } catch { /* try the next */ }
  }
  S.notice = 'Your saved game could not be opened and no readable snapshot was found. It has not been deleted.';
  return null;
}

// -------------------------------------------------------------------- news
const sourceOf = (k: { from: string }) => (k.from === 'witness' ? 'you saw it' : k.from === 'self' ? 'you did it' : k.from === 'public' ? 'word on the street' : `heard from ${W().chars[k.from]?.name ?? 'someone'}`);
function storyLink(fid: string): string {
  const w = W();
  const f = w.facts[fid];
  let key = f.story;
  if (!key) { let c: typeof f | undefined = f; for (let i = 0; c && i < 6 && !key; i++) { const d = (w.disputes ?? []).find((x) => x.fact === c!.id); if (d) key = d.id; c = c.cause ? w.facts[c.cause] : undefined; } }
  return key && storyExists(w, key) ? ` <a class="nm story" href="#" data-a="story:${key}">follow this &rsaquo;</a>` : '';
}
function collectNews(since: number): string[] {
  const w = W();
  const p0 = P();
  const fresh = Object.entries(p0.known).filter(([id, k]) => k.t > since && w.facts[id]);
  // Everything is judged by one rule: does it touch me, a man close to me, something I own, or something I can act on?
  const scored = fresh.map(([id, k]) => ({ id, k, f: w.facts[id], r: relevance(w, p0, w.facts[id]) }));
  S.routine = scored.filter((x) => x.r.level === 0).length;
  const seen = new Set<string>();
  const picked = scored
    .filter((x) => x.r.level > 0 && (x.f.kind === 'report' || !x.f.minor))
    .sort((a, b) => b.r.level - a.r.level || b.k.t - a.k.t)
    .filter((x) => { const key = `${x.f.kind}|${x.f.actor ?? ''}|${x.f.victim ?? ''}|${x.f.business ?? ''}`; if (seen.has(key)) { S.routine++; return false; } seen.add(key); return true; })
    .slice(0, 5);
  return picked.map(({ id, k, f, r }) => {
    const body = lk(f.kind === 'report' ? f.text : factText(f, k.knowsActor));
    const tag = `<span class="why${r.level === 2 ? ' crit' : ''}">${esc(r.why.replace(/^./, (m) => m.toUpperCase()))}</span>`;
    const src = f.kind === 'report' ? '' : ` <span class="src">${esc(sourceOf(k))} &middot; <a class="nm" href="#" data-a="fact:${id}">details</a></span>`;
    return `${r.level === 2 ? `<b class="crit">${body}</b>` : `<span>${body}</span>`}${f.kind === 'report' ? '' : storyLink(id)}${src}${tag}`;
  });
}

// -------------------------------------------------------------- navigation
const same = (a: View, b: View) => a.t === b.t && JSON.stringify(a, (k, v) => (k === 'm' || k === 'convo' ? undefined : v)) === JSON.stringify(b, (k, v) => (k === 'm' || k === 'convo' ? undefined : v));
function go(v: View) {
  if (!same(S.view, v)) S.stack.push(S.view);
  if (S.stack.length > 30) S.stack.shift();
  S.view = v;
}
function tab(name: Tab) {
  S.stack = [];
  S.view = { t: 'tab', name: openSection(name) };
}
function pop() {
  const prev = S.stack.pop();
  S.view = prev ?? { t: 'tab', name: 'today' };
  // do not return into a dead conversation or meeting
  while (S.stack.length && (S.view.t === 'talk' || S.view.t === 'meeting' || S.view.t === 'approach' || S.view.t === 'sendorder')) S.view = S.stack.pop()!;
}

function pass(minutes: number, lines: string[], next: View = { t: 'tab', name: 'today' }, from?: number) {
  const w = W();
  const t0 = from ?? w.now;
  const p0 = P();
  const snap = { cash: p0.cash, heat: p0.heat, standing: p0.standing, known: Object.keys(p0.known).length, rank: p0.rank };
  advance(w, w.now + minutes);
  pruneJobs(w);
  S.log = lines.map((l) => lk(l));
  const p = P();
  if (p.alive && p.jailedUntil > w.now) {
    S.log.push(lk(`You were picked up. You’re inside until ${fmtTime(p.jailedUntil)}.`));
    advance(w, p.jailedUntil);
  }
  S.news = collectNews(t0);
  S.chips = [];
  const pn = P();
  const dc = Math.round(pn.cash - snap.cash);
  if (dc) S.chips.push({ t: `${dc > 0 ? '+' : '−'}${money(Math.abs(dc))}`, tone: dc > 0 ? 'good' : 'bad' });
  const dh = pn.heat - snap.heat;
  if (Math.abs(dh) >= 0.04) S.chips.push({ t: `Heat ${dh > 0 ? 'up' : 'down'}`, tone: dh > 0 ? 'bad' : 'good' });
  const ds = Math.round(pn.standing - snap.standing);
  if (ds) S.chips.push({ t: `Standing ${ds > 0 ? '+' : '−'}${Math.abs(ds)}`, tone: ds > 0 ? 'good' : 'bad' });
  const dk = Object.keys(pn.known).length - snap.known;
  if (dk > 0) S.chips.push({ t: `${dk} new thing${dk > 1 ? 's' : ''} learned`, tone: '' });
  if (pn.rank !== snap.rank) S.chips.push({ t: `Now ${pn.rank}`, tone: 'good' });
  S.stack = [];
  S.view = next;
  save();
}

function doAction(a: import('./types').Action) {
  const prevMet = (a.target ? W().chars[a.target]?.rels[P().id]?.lastMet : undefined) ?? -1e9;
  if (a.kind === 'socialise') a.quiet = true;
  const r = perform(W(), a);
  if (a.kind === 'socialise' && a.target && W().chars[a.target]?.alive) { const x = W().chars[a.target]; const aa = arrive(W(), P(), x, r, whereIs(W(), P(), x), prevMet); return pass(r.minutes, [], { t: 'talk', convo: aa.convo, lines: aa.lines }); }
  pass(r.minutes, r.lines);
}

const job = (id: string) => W().jobs.find((j) => j.id === id);

function talkTo(id: string) {
  const w = W();
  const p = P();
  const x = w.chars[id];
  const wh = x ? whereIs(w, p, x) : undefined;
  if (wh?.kind === 'jail') return pass(5, [`${x.name} is locked up. Nothing to do but wait.`]);
  const known = introduced(w, p, x);
  const act = known ? generate(w, p, 'socialise').find((a) => a.target === id) : undefined;
  if (!known) return pass(wh?.mins ?? 15, [], { t: 'talk', convo: startConvo(id), lines: [wh ? `You find ${x.name}: ${wh.line.replace(/^He’s /, 'he is ')}` : '', `You’ve never met ${x.name}. He has no reason to know who you are.`].filter(Boolean) });
  if (act) {
    const prevMet = x.rels[p.id]?.lastMet ?? -1e9;
    act.quiet = true;
    const r = perform(w, act);
    const a = arrive(w, p, x, r, wh!, prevMet);
    return pass(r.minutes, [], { t: 'talk', convo: a.convo, lines: a.lines });
  }
  // (V90: however you came to be in front of him, he greets you, and whatever he has come to raise comes up)
  const prevMet = x.rels[p.id]?.lastMet ?? -1e9;
  const a = wh ? arrive(w, p, x, { lines: [], minutes: wh.mins ?? 15 } as never, wh, prevMet) : undefined;
  pass(wh?.mins ?? 15, [], { t: 'talk', convo: a?.convo ?? startConvo(id), lines: a?.lines ?? [] });
}

// ------------------------------------------------------------------- views
function body(): string {
  const w = W();
  const v = S.view;
  const j = (id: string) => job(id);
  switch (v.t) {
    case 'tab':
      return sectionView(v.name);
    case 'person': return personView(v.id);
    case 'brief': return briefView();
    case 'sunday': return sundayView();
    case 'biz': return bizView(v.id);
    case 'fact': return factView(v.id);
    case 'tree': return backBtn() + treeView(v.fam);
    case 'manage': return backBtn() + manageView();
    case 'comm': return backBtn() + commView();
    case 'bj': return v.id ? bjTable(v.id) : bjLobby();
    case 'menu': return menuView(v.kind);
    case 'wait': return waitView();
    case 'job': return j(v.id) ? jobView(j(v.id)!) : todayView();
    case 'approach': return j(v.id) ? approachView(j(v.id)!) : todayView();
    case 'delegate': return j(v.id) ? delegateView(j(v.id)!) : todayView();
    case 'sendorder': return j(v.id) ? sendView(j(v.id)!, w.chars[v.who]) : todayView();
    case 'plan': return planView(v.idx, v.who);
    case 'orders': return ordersView(v.who);
    case 'recruit': return recruitView();
    case 'dayjob': return dayjobView();
    case 'books': return booksView(v.id, v.lines);
    case 'meeting': return meetingView(v);
    case 'guests': return guestsView(v.picked);
    case 'talk': return talkView(v);
    case 'people': return peopleView();
    case 'report': return j(v.id) ? reportView(j(v.id)!, v.lines) : todayView();
    case 'grudges': return grudgesView();
    case 'goals': return goalsView();
    case 'dispute': return disputeView(v.id, v.lines);
    case 'story': return storyView(v.id, v.lines);
    case 'way': return wayView(v.id, v.lines);
    case 'settle': return settleView(v.id, v.lines, v.kill);
    case 'place': return placeView(v.id);
    case 'places': return placesView();
    case 'help': return helpView(v.who, v.lines);
    case 'enc': return encView(v.id, v.lines);
    case 'opstart': return opStartView(v.kind);
    case 'op': return opView(v.id, v.lines, v.found);
    case 'hijack': return hijackView(v.picked);
  }
}

function saveBanner(): string {
  const st = S.save;
  if (!st) return '';
  if (!st.ok) return `<div class="callout bad"><b>Your progress is not being saved.</b> ${esc(st.error ?? 'Storage is not available.')}. ${S.saveGood ? `The last good save is from ${esc(S.saveGood)}.` : 'Nothing has been saved yet this session.'} <button class="pill small" data-a="dlsave:">Download a backup</button></div>`;
  if (st.warn) return `<div class="callout info">${esc(st.warn)} <button class="pill small" data-a="dlsave:">Download a backup</button></div>`;
  return '';
}

function render() {
  const app = document.getElementById('app')!;
  document.body.classList.toggle('om-open', !S.w);
  document.body.classList.toggle('g-on', !!S.w);
  // Scenes (a conversation, a meeting, an encounter, the card table) take the whole phone: the tabs step aside until you leave.
  document.body.classList.toggle('g-scene', !!S.w && ['talk', 'meeting', 'enc', 'bj', 'sunday', 'approach', 'settle'].includes(S.view.t));
  takeSide();
  if (!S.w) {
    app.innerHTML = openingView(S.notice, hasSave());
    S.notice = '';
    return;
  }
  let b: string;
  try {
    b = body();
  } catch (e) {
    console.error(e);
    S.view = { t: 'tab', name: 'today' };
    S.stack = [];
    b = todayView();
  }
  if (S.notice) { b = `<div class="callout info">${esc(S.notice)}</div>` + b; S.notice = ''; }
  b = saveBanner() + b;
  const side = takeSide();
  app.innerHTML = `<div class="g-shell${side ? '' : ' g-noside'}">${rail()}${topBar()}<main class="g-main">${b}</main>${side ? `<aside class="g-side" aria-label="More about where you stand">${side}</aside>` : ''}</div>${bottomTabs()}`;
}

// ------------------------------------------------------------------ events
function startMeeting(m: ReturnType<typeof openCrewMeeting>, fail: View = { t: 'tab', name: 'crew' }) {
  if (typeof m === 'string') {
    S.notice = m;
    S.view = fail;
    S.stack = [];
  } else go({ t: 'meeting', m, lines: [] });
}

function handle(a: string, v: string) {
  // Stage 4: a figure named in a conversation goes with the choice it belongs to (dialogue.ts 'nm:')
  if (a === 'sayamt') {
    const o = S.dopts[Number(v)];
    const amt = Number((document.getElementById('fig-' + v) as HTMLInputElement | null)?.value);
    const rateEl = document.getElementById('figr-' + v) as HTMLInputElement | null;
    if (!o || !Number.isFinite(amt)) return;
    S.dopts[Number(v)] = { ...o, code: `${o.code}:${Math.round(amt)}${rateEl ? `:${Number(rateEl.value) / 100}` : ''}` };
    return handle('say', v);
  }
  const w = S.w;
  const args = v.split('|');
  if (a === 'om') return openingAct(v);
  if (a !== 'reset') S.confirmReset = false;
  if (w && w.goals && w.playerId) {
    const g = w.goals.done;
    if (a === 'talk') { g['g:talk'] = w.now; if (v === w.chars[w.playerId].bossId) g['g:boss'] = w.now; else g['g:friend'] = w.now; }
    if (a === 'waitgo') g['g:wait'] = w.now;
    if (['job', 'approach', 'delegate', 'sendorder'].includes(S.view.t) && !['back', 'tab', 'ent', 'biz', 'fact', 'tog'].includes(a)) g['g:job'] = w.now;
    // V89 first-week guide: what's on his mind, a word aside at the club, the Stories page, and one story followed
    if (a === 'say' && S.view.t === 'talk' && S.dopts[Number(v)]?.code.startsWith('tk:')) g['g:tk'] = w.now;
    if (a === 'caside' || a === 'cscene') { g['g:aside'] = w.now; if (args[1]) g['g:tk'] = w.now; } // (V90: sitting down with a man at the club is the step)
    if (a === 'tab' && v === 'stories') g['g:stories'] = w.now;
    if (a === 'story') g['g:story'] = w.now;
  }
  if (a === 'new') {
    const n = draftName();
    if (!n.first || !n.last) { S.notice = 'He needs a first name and a surname before anyone will deal with him.'; openingAct('sec|name'); return; }
    const bg = draftBg();
    S.w = createWorld(Math.floor(Math.random() * 1e6), fullName(n.first, n.last), { bg });
    S.w.chars[S.w.playerId!].look = { ...S.look };
    draftDone();
    const p = P();
    const bs = S.w.chars[p.bossId!];
    S.log = [esc(`New York, March 1970. You’re ${p.name}, an associate of the ${famName(S.w, p)} family. You’re not made, and you’re nobody’s friend yet.`), ...startingLines(S.w, p).map(esc), esc(`${bs.name} is the man you answer to. Go and find him at his usual place, and let him see your face. Then make yourself useful.`), 'Needs you, on this page, says what wants doing. Rackets says how to earn. Everything else is people.'];
    S.news = [];
    S.stack = [];
    S.view = { t: 'tab', name: 'today' };
    // a new man starts with a clean slate: the old game and its earlier days go first, then he is saved
    saveBox()?.erase().catch(() => { /* nothing to clear */ });
    save();
    return;
  }
  if (a === 'continue') {
    load().then((s) => {
      if (s) {
        S.w = s;
        S.save = saveBox()?.status ?? null;
        S.log = ['Welcome back.'];
        S.news = [];
        S.stack = [];
        S.view = { t: 'tab', name: 'today' };
      }
      render();
      window.scrollTo(0, 0);
    }, (e) => { console.error(e); S.notice = 'Your saved game could not be opened. It has not been deleted.'; render(); });
    return;
  }
  if (!w) return;
  switch (a) {
    case 'tab': return tab(v as Tab);
    case 'back': return pop();
    case 'career': S.lifeSub = 'you'; return tab('life');
    case 'paper': S.paperAt = Number(v); return;
    case 'tog': S.open[v] = !S.open[v]; return;
    case 'ent': return go({ t: 'person', id: v });
    case 'biz': return go({ t: 'biz', id: v });
    case 'fact': return go({ t: 'fact', id: v });
    case 'tree': S.treeFam = v || undefined; if (S.view.t === 'tab' && S.view.name === 'family') return; return go({ t: 'tree', fam: v || P().familyId! });
    // (the four rooms of the old Life tab now live in the sections: you on your page, people, the money under Business, what you know in the Journal)
    case 'lsub': {
      const r = roomOf(v);
      if (r === 'people' && W().life) { datingPool(W(), P()); save(); }
      if (r === 'business') S.sub.business = 'money';
      if (r === 'known') S.sub.journal = 'known';
      return tab(r === 'you' ? 'life' : r === 'people' ? 'people' : r === 'business' ? 'business' : 'journal');
    }
    case 'sub': { const [sec, room] = v.split('.'); S.sub[sec] = room; if (S.view.t !== 'tab' || S.view.name !== sec) tab(sec as Tab); return; }
    case 'pf': S.worldFilter = v; return;
    case 'place': return go({ t: 'place', id: v });
    case 'places': return go({ t: 'places' });
    case 'cscene': {
      // V90: the club's separate small talk is retired. Sitting down with a man at the club is the same conversation as anywhere
      // else, opened at the club (a scene already under way in an old save still plays out below).
      const p = P(), cl = clubOf(w, p.familyId), x = w.chars[v];
      if (!cl || !x?.alive) return;
      const prevMet = x.rels[p.id]?.lastMet ?? -1e9;
      const act = introduced(w, p, x) ? generate(w, p, 'socialise').find((a) => a.target === v) : undefined;
      const r = act ? (act.quiet = true, perform(w, act)) : { lines: [] as string[], minutes: 10 };
      const a = arrive(w, p, x, r, { kind: 'club', name: cl.name, line: `${x.name.split(' ')[0]} is at the club.`, mins: 0 } as never, prevMet);
      return pass(r.minutes ?? 10, [], { t: 'talk', convo: a.convo, lines: a.lines });
    }
    case 'club': {
      const r = v === 'sit' ? sitAtClub(w, P()) : v === 'shave' ? shave(w, P()) : drinkAt(w, P());
      return pass(r.minutes, r.lines);
    }
    case 'people': return go({ t: 'people' });
    case 'grudges': return go({ t: 'grudges' });
    case 'goals': return go({ t: 'goals' });
    case 'dispute': return go({ t: 'dispute', id: v, lines: [] });
    case 'rival': return W().chars[v]?.alive ? go({ t: 'settle', id: v, lines: [] }) : undefined;
    case 'story': return /^d\d+$/.test(v) ? go({ t: 'dispute', id: v, lines: [] }) : go({ t: 'story', id: v });
    case 'dv': {
      const [code, did] = v.split('|');
      const d = (w.disputes ?? []).find((x) => x.id === did);
      if (!d) return;
      const pp = P();
      const opp = d.a === pp.id || w.chars[d.a]?.bossId === pp.id ? w.chars[d.b] : w.chars[d.a];
      if (code === 'talk') return talkTo(opp.id);
      if (code === 'settle') return go({ t: 'settle', id: opp.id, lines: [] });
      if (code === 'ignore') { ignoreDispute(d, w); return pass(5, ['You let it ride. The other side will notice.'], { t: 'dispute', id: did, lines: ['You let it ride. The other side will notice.'] }); }
      if (code === 'look') { const r = investigate(w, pp, d); return pass(r.minutes, [], { t: 'dispute', id: did, lines: r.lines }); }
      if (code === 'sit') { const ls = callSitdown(w, pp, d); return pass(30, ls, { t: 'dispute', id: did, lines: ls }); }
      return;
    }
    case 'recruit': return go({ t: 'recruit' });
    case 'dayjob': return go({ t: 'dayjob' });
    case 'orders': return go({ t: 'orders', who: v });
    case 'wait': return go({ t: 'wait' });
    case 'guideoff': if (w.goals) w.goals.done['g:off'] = w.now; save(); return;
    case 'waitgo': {
      const o = waitChoices(true)[Number(v)];
      if (!o) return;
      if (!o.event) return doAction({ kind: 'wait', actor: w.playerId!, hours: o.mins / 60, label: 'wait', score: 0 });
      const t0 = w.now;
      const before = attentionCount();
      let stopped = false;
      for (let i = 0; i < 48; i++) {
        advance(w, w.now + 30);
        pruneJobs(w);
        if (!P().alive || P().jailedUntil > w.now || attentionCount() > before) { stopped = true; break; }
      }
      return pass(0, [stopped ? 'Something has come up.' : 'A long day. Nothing stirs.'], undefined, t0);
    }
    case 'cat': {
      const kind = v as Kind;
      S.opts = generate(w, P(), kind).sort((x, y) => y.score - x.score).slice(0, 12);
      if (kind === 'work' && S.opts.length) return doAction(S.opts[0]);
      return go({ t: 'menu', kind });
    }
    case 'opt': return doAction(S.opts[Number(v)]);
    case 'talk': return talkTo(v);
    case 'settle': return W().chars[v]?.alive ? go({ t: 'settle', id: v, lines: [] }) : undefined;
    case 'sv': {
      const [code, id] = v.split('|');
      const x = w.chars[id];
      if (code === 'back') return go({ t: 'settle', id, lines: [] });
      if (code === 'whack') return go({ t: 'settle', id, lines: [], kill: true });
      const r = settleDo(w, P(), x, code);
      if (r.done) playerActed(w, P(), x, code);
      if (!r.done) return go({ t: 'settle', id, lines: r.lines });
      return pass(r.minutes, r.lines, { t: 'tab', name: 'today' });
    }
    case 'ntag': { toggleTag(P(), args[0], Number(args[1])); save(); return; }
    case 'npin': { togglePin(P(), v); save(); return; }
    case 'restore': {
      const b = saveBox();
      if (!b) return;
      b.idle().then(() => b.readSnap(v)).then((raw) => {
        if (!raw) { S.notice = 'That earlier day could not be found any more.'; render(); return; }
        try { S.w = deserialize(raw); } catch { S.notice = 'That earlier day could not be opened.'; render(); return; }
        S.log = ['You go back to an earlier day.']; S.news = []; S.stack = []; S.view = { t: 'tab', name: 'today' };
        save(); render(); window.scrollTo(0, 0);
      });
      return;
    }
    case 'brief': S.paperAt = undefined; return go({ t: 'brief' });
    case 'sunday': return go({ t: 'sunday' });
    case 'sbooks': {
      const c = w.chars[v];
      if (c) { S.sundayBooks[sKey(v)] = checkBooks(w, P(), c); }
      save(); return;
    }
    case 'srule': {
      // Answer one man across the table. Nothing here moves you to another page.
      const c = w.chars[args[0]], p = P(), code = args[1];
      if (!c || !c.alive || S.sundayRes[sKey(c.id)]) return;
      const s = statement(w, c);
      const r = rel(c, p.id), first = c.name.split(' ')[0];
      let lines: string[] = [];
      if (code === 'accept') {
        feelOn(w, r, 'trust', (s.light ? 0 : 0.02)); feelOn(w, r, 'respect', (s.light ? -0.02 : 0.01));
        lines = [s.light ? `You take it without a word. ${money(s.short)} stays on ${first}’s tab.` : `You take the envelope and nod. ${first} relaxes.`];
      } else if (code === 'keep') {
        const back = Math.round(s.handed / 2 / 5) * 5;
        if (back <= 0 || p.cash < back) { S.log = ['You can’t afford the gesture right now.']; return; }
        p.cash -= back; c.cash += back; feelOn(w, r, 'trust', 0.08); feelOn(w, r, 'affection', 0.05);
        post(w, { from: p.id, to: c.id, amt: back, flow: 'gift', note: 'let him keep half' });
        lines = [`You slide ${money(back)} back across the table to ${first}. "For your mother, or something." He doesn’t forget it.`];
      } else if (code === 'praise') {
        feelOn(w, r, 'trust', 0.04); feelOn(w, r, 'respect', 0.02);
        lines = [`You tell ${first} he’s the kind of man this family needs. He walks out a little taller.`];
      } else if (code === 'shout') {
        feelOn(w, r, 'trust', -0.1); feelOn(w, r, 'respect', -0.05); bearOn(w, r, 0.06, `${p.name} shouted at him in front of the others`);
        for (const m of crewOf(w, p)) if (m.id !== c.id) { const q = rel(m, p.id); feelOn(w, q, 'respect', (c.books.missed > 1 ? 0.02 : -0.01)); }
        lines = [`You raise your voice until the room goes quiet. ${first} stares at the table. The others pretend not to listen. He’ll pay next week, and he’ll remember how you made him.`];
        if (s.short > 0) c.books.arrears += Math.round(s.short);
      } else if (code === 'cut') {
        bearOn(w, r, 0.3, `${p.name} cut his share`); feelOn(w, r, 'trust', -0.3);
        leaveCrew(w, c);
        lines = [`"We’re done, ${first}." He puts his hat on and doesn’t say anything. He’s no longer one of yours, and he knows how your crew runs.`];
      } else {
        if (code === 'demand' && (p.books.flags[c.id]?.amt ?? 0) <= 0) (p.books.flags[c.id] ??= { amt: 0, n: 0, last: 0 }).amt = Math.max(s.short, 1);
        const res = rule(w, p, c, code);
        lines = res.lines;
      }
      addFact(w, { kind: 'favour', actor: p.id, victim: c.id, story: 'man:' + c.id, minor: true, text: `${p.name} sat down with ${c.name} on Sunday and went over what he handed up.`, district: c.district }, { witnesses: [p.id] });
      S.sundayRes[sKey(c.id)] = lines; save(); return;
    }
    case 'saccall': {
      const p = P();
      for (const c of crewOf(w, p)) {
        const s = statement(w, c);
        if (s.light || c.books.missed > 1 || S.sundayRes[sKey(c.id)]) continue;
        const r = rel(c, p.id); feelOn(w, r, 'trust', 0.02);
        S.sundayRes[sKey(c.id)] = [`You take ${c.name.split(' ')[0]}’s envelope and nod. ${c.name.split(' ')[0]} relaxes.`];
      }
      save(); return;
    }
    case 'shand': {
      const p = P(), boss = p.bossId ? w.chars[p.bossId] : undefined;
      if (!boss) return;
      const e = envelopeSum(w, p);
      const amt = v === 'half' ? Math.round(e.due / 2 / 5) * 5 : e.due;
      S.sundayMine = handOver(w, p, boss, amt);
      save(); return;
    }
    case 'date': return pass(240, seePartner(w, P()));
    case 'dateplan': return pass(v === 'walk' ? 90 : 240, datePlan(w, P(), v), { t: 'tab', name: 'life' });
    case 'askout': { const r = askOut(w, P(), w.chars[v]); return pass(r.minutes, r.lines, { t: 'tab', name: 'life' }); }
    case 'steady': { const r = askSteady(w, P()); return pass(60, r.lines, { t: 'tab', name: 'life' }); }
    case 'marryask': { const r = askMarry(w, P()); return pass(90, r.lines, { t: 'tab', name: 'life' }); }
    case 'wed': return pass(480, wedding(w, P()), { t: 'tab', name: 'life' });
    case 'baby': return pass(120, tryForBaby(w, P()), { t: 'tab', name: 'life' });
    case 'breakoff': return pass(60, breakOff(w, P()), { t: 'tab', name: 'life' });
    case 'visit': {
      const k = w.life?.kin.find((x) => x.id === v);
      return k ? pass(90, visitKin(w, P(), k)) : undefined;
    }
    case 'perm': {
      const lines = askPermission(w, P(), w.chars[v]);
      return pass(60, lines, { t: 'grudges' });
    }
    case 'shift': {
      const r = workShift(w, P());
      return pass(r.minutes, r.lines);
    }
    case 'takejob': takeDayJob(w, P(), S.jobOpts[Number(v)]); save(); return;
    case 'quitjob': quitDayJob(P()); save(); return;
    case 'hire': {
      const lines = recruitProspect(w, P(), w.chars[v]);
      return pass(30, lines, { t: 'tab', name: 'crew' });
    }
    case 'enc': return go({ t: 'enc', id: v, lines: [] });
    case 'way': return go({ t: 'way', id: v, lines: [] });
    case 'opstart': S.opDist = ''; S.opRunner = 'me'; return go({ t: 'opstart', kind: v });
    case 'opdist': S.opDist = v; return;
    case 'oprun': S.opRunner = v; return;
    case 'opgo': {
      const lines = startOp(w, P(), v as never, S.opDist, S.opRunner === 'me' ? null : S.opRunner);
      return pass(30, lines, { t: 'tab', name: 'rackets' });
    }
    case 'op': return go({ t: 'op', id: v, lines: [] });
    case 'opcount': {
      const op = w.ops.find((o) => o.id === v)!;
      const r = countOp(w, P(), op);
      advance(w, w.now + 60);
      S.view = { t: 'op', id: v, lines: r.lines, found: r.found };
      save();
      return;
    }
    case 'oprule': {
      const op = w.ops.find((o) => o.id === args[0])!;
      const lines = opRule(w, P(), op, args[1], Number(args[2]));
      S.view = { t: 'op', id: args[0], lines };
      save();
      return;
    }
    case 'opclose': {
      const lines = closeOp(w, w.ops.find((o) => o.id === v)!);
      return pass(10, lines, { t: 'tab', name: 'rackets' });
    }
    case 'hijack': return go({ t: 'hijack', picked: [] });
    case 'hjpick': {
      if (S.view.t === 'hijack') {
        const i = S.view.picked.indexOf(v);
        if (i >= 0) S.view.picked.splice(i, 1);
        else if (S.view.picked.length < 3) S.view.picked.push(v);
      }
      return;
    }
    case 'hjgo': return S.view.t === 'hijack' ? pass(60, hijack(w, P(), S.view.picked), { t: 'tab', name: 'rackets' }) : undefined;
    case 'echoose': {
      const e = w.enc.find((x) => x.id === args[0])!;
      const r = encChoose(w, P(), e, args[1]);
      if (e.status === 'open') {
        advance(w, w.now + r.minutes);
        S.view = { t: 'enc', id: e.id, lines: r.lines };
        save();
        return;
      }
      // (answered from a story, the answer is read there, under the story it belongs to)
      return pass(r.minutes, r.lines, S.view.t === 'story' ? { t: 'story', id: S.view.id, lines: r.lines } : { t: 'tab', name: 'today' });
    }
    case 'mt': { // V89: something the player does in a matter, from its story
      const r = matterAct(w, P(), args[0], args[1], args[2] || undefined);
      return pass(r.minutes, r.lines, { t: 'story', id: 'sit:' + args[0], lines: r.lines });
    }
    case 'mv': {
      const r = doMove(w, P(), args[0], args[1], args[2] || undefined);
      return pass(r.minutes, r.lines, { t: 'story', id: 'sit:' + args[0], lines: r.lines });
    }
    case 'am': { // V89: a move in a negotiation the player is pursuing (asks.ts), made from its story
      const r = playerMove(w, P(), args[0], args[1] as AskMove);
      return pass(r.minutes, r.lines, { t: 'story', id: 'sit:' + args[0], lines: r.lines });
    }
    case 'help': return go({ t: 'help', who: v, lines: [] });
    case 'helpdo': {
      const lines = helpMan(w, P(), w.chars[args[0]], args[1] as 'cash' | 'duties' | 'leave');
      S.view = { t: 'help', who: args[0], lines };
      save();
      return;
    }
    case 'plan': {
      const [i, who] = args;
      if (who) return go({ t: 'plan', idx: Number(i), who });
      if (S.view.t === 'tab' && Number.isNaN(Number(i))) return;
      return go({ t: 'plan', idx: Number(i) });
    }
    case 'bmgr': { // Stage 4: who runs your place
      const b = w.biz[args[0]];
      if (!b) return;
      const r = setManager(w, b, P(), args[1] === 'self' ? null : args[1] === 'hire' ? 'hire' : args[1]);
      return pass(20, [r], { t: 'biz', id: b.id });
    }
    case 'doplan': {
      const o = S.planOpts[Number(args[0])];
      if (!o) return;
      if (args[1] === 'me') {
        const j = ownJob(w, P(), o);
        S.stack = [];
        S.view = { t: 'approach', id: j.id };
        S.stack.push({ t: 'tab', name: 'rackets' });
        return;
      }
      const m = w.chars[args[1]];
      const j = giveOrder(w, P(), m, o, args[2] as 'quiet' | 'hard');
      if (typeof j === 'string') { S.log = [j]; return; }
      return pass(15, [`${m.name} is on it: ${o.label}. He’ll report back.`], { t: 'tab', name: 'rackets' });
    }
    case 'shake': {
      const b = w.biz[v];
      const list = require_plan();
      const i = list.findIndex((o) => o.label.startsWith('Shake') && o.label.includes(w.chars[b.ownerId].name));
      if (i >= 0) {
        const j = ownJob(w, P(), list[i]);
        S.view = { t: 'approach', id: j.id };
      }
      return;
    }
    case 'scheme': {
      const o = S.schemeMoves[Number(v)];
      if (o?.move) {
        const r = performMove(w, o.move);
        return pass(r.minutes, r.lines);
      }
      return;
    }
    case 'say': {
      if (S.view.t !== 'talk') return;
      const t = w.chars[S.view.convo.id];
      const tv = S.view, picked = S.dopts[Number(v)];
      const history = [...(tv.history ?? []), ...(tv.lines.length ? [{ q: tv.q, lines: tv.lines }] : [])].slice(-12);
      const res = say(w, P(), t, tv.convo, picked.code);
      if (res.meeting && typeof res.meeting !== 'string') {
        advance(w, w.now + res.minutes);
        S.view = { t: 'meeting', m: res.meeting, lines: res.lines };
        save();
        return;
      }
      const lines = typeof res.meeting === 'string' ? [...res.lines, res.meeting] : res.lines;
      const keep = isNavCode(picked.code) && !res.lines.length && !!res.convo;
      // (a conversation that ends stays on the page: the last thing said, and how you left it)
      return pass(res.minutes, [], res.convo ? (keep ? { t: 'talk', convo: res.convo, lines: tv.lines, q: tv.q, history: tv.history } : { t: 'talk', convo: res.convo, lines, q: res.q ?? (isNavCode(picked.code) ? undefined : picked.label), history }) : { t: 'talk', convo: tv.convo, lines, q: res.q ?? picked.label, history, ended: true });
    }
    case 'cmove': {
      const r = performMove(w, S.moves[Number(v)]);
      return pass(r.minutes, r.lines, { t: 'tab', name: 'crew' });
    }
    case 'meet':
      if (v === 'dinner') return go({ t: 'guests', picked: [] });
      if (v === 'family') return startMeeting(openFamilyMeeting(w, P()), { t: 'tab', name: 'family' });
    {
      // If the men are asleep, send word and wait until the afternoon rather than just refusing.
      let m = openCrewMeeting(w, P());
      if (typeof m === 'string' && /asleep/.test(m)) {
        const t0 = w.now; const day = Math.floor(w.now / 1440) * 1440; let at = day + 14 * 60; if (at <= w.now) at += 1440;
        advance(w, at); pruneJobs(w);
        const m2 = openCrewMeeting(w, P());
        if (typeof m2 !== 'string') { S.log = [`You send word round and wait until the afternoon.`]; m = m2; } else m = m2;
        void t0;
      }
      return startMeeting(m);
    }
    case 'gpick': {
      if (S.view.t === 'guests') {
        const i = S.view.picked.indexOf(v);
        if (i >= 0) S.view.picked.splice(i, 1);
        else if (S.view.picked.length < 4) S.view.picked.push(v);
      }
      return;
    }
    case 'ghost': return S.view.t === 'guests' ? startMeeting(openGathering(w, P(), S.view.picked)) : undefined;
    case 'attend': {
      const j = job(v)!;
      const p = P();
      const m = j.meeting === 'induction' ? openInduction(w, p, j) : j.meeting === 'accounts' ? openAccountsMeeting(w, p, j) : j.meeting === 'family' ? openFamilyMeeting(w, p, j) : j.meeting === 'sitdown' ? (w.grievances.find((g) => g.id === j.extra?.g) ? openSitdown(w, p, w.grievances.find((g) => g.id === j.extra?.g)!) : 'It has sorted itself out.') : openCrewMeeting(w, p);
      if (typeof m !== 'string' && j.meeting === 'sitdown') j.status = 'done';
      return startMeeting(m, { t: 'tab', name: 'today' });
    }
    case 'excuse': declineJob(w, job(v)!); save(); S.stack = []; S.view = { t: 'tab', name: 'today' }; return;
    case 'mopt': {
      if (S.view.t === 'meeting') {
        const it = meetCurrent(S.view.m);
        if (it) S.view.lines = meetChoose(w, P(), S.view.m, it.opts[Number(v)].code);
      }
      return;
    }
    case 'mdone': {
      if (S.view.t === 'meeting') {
        const r = closeMeeting(w, P(), S.view.m);
        return pass(r.minutes, [...S.view.lines, ...r.lines]);
      }
      return;
    }
    case 'books': return go({ t: 'books', id: v, lines: [] });
    case 'stance': setStance(P(), v as 'honest' | 'shave' | 'stall'); save(); return;
    case 'audit': {
      const r = auditMember(w, P(), w.chars[v]);
      addFact(w, { kind: 'favour', actor: P().id, victim: v, story: 'man:' + v, minor: true, text: `${P().name} went through ${w.chars[v].name}’s books.`, district: w.chars[v].district }, { witnesses: [P().id] });
      return pass(r.minutes, [], { t: 'books', id: v, lines: r.lines });
    }
    case 'rule': {
      const r = rule(w, P(), w.chars[args[0]], args[1]);
      addFact(w, { kind: 'favour', actor: P().id, victim: args[0], story: 'man:' + args[0], minor: true, text: `${P().name} dealt with ${w.chars[args[0]].name}’s books and told him where he stands.`, district: w.chars[args[0]].district }, { witnesses: [P().id] });
      return pass(r.minutes, [], { t: 'books', id: args[0], lines: r.lines });
    }
    case 'reward': {
      const lines = reward(w, P(), w.chars[args[0]], args[1]);
      return pass(20, [], { t: 'books', id: args[0], lines });
    }
    case 'manage': return go({ t: 'manage' });
    case 'comm': return go({ t: 'comm' });
    case 'bj': return go({ t: 'bj' });
    case 'bjt': return go({ t: 'bj', id: v });
    case 'bjbet': { const lines = bjDeal(args[0], Number(args[1])); return pass(10, lines, { t: 'bj', id: args[0] }); }
    case 'bjact': { const lines = bjAct(v as 'hit' | 'stand' | 'double'); return pass(5, lines, { t: 'bj', id: w.bj?.biz }); }
    case 'buy': return pass(10, buyLife(w, P(), v), { t: 'tab', name: 'today' });
    case 'court': return pass(60, courtBoss(w, P(), v), { t: 'comm' });
    case 'propose': return pass(90, propose(w, P(), args[0], args[1] || undefined), { t: 'comm' });
    case 'consig': return pass(5, setConsigliere(w, P(), w.chars[v]), { t: 'manage' });
    case 'heir': return pass(5, setHeir(w, P(), w.chars[v]), { t: 'manage' });
    case 'setboss': return pass(5, setBoss(w, P(), w.chars[args[0]], w.chars[args[1]]), { t: 'manage' });
    case 'setrank': { const lines = setRank(w, P(), w.chars[args[0]], args[1] as import('./types').Rank); return pass(5, lines, { t: 'manage' }); }
    case 'power': return pass(40, usePower(w, P(), v), { t: 'tab', name: 'today' });
    case 'chair': return pass(40, chairAct(w, P(), v), { t: 'tab', name: 'today' });
    case 'raise': {
      const lines = raise(w, P(), w.chars[args[0]], args[1] as import('./types').Rank);
      return pass(30, lines, { t: 'tab', name: 'today' });
    }
    case 'rec':
    case 'recr': {
      const lines = (a === 'rec' ? recommend : recruit)(w, P(), w.chars[v]);
      return pass(30, lines, { t: 'tab', name: 'crew' });
    }
    case 'jx': {
      const j = job(args[0])!;
      const fn = { press: pressJob, ask: questionJob, inv: investigateJob, around: askAroundJob, haggle: haggleJob }[args[1]]!;
      const r = fn(w, j);
      return pass(r.minutes, [], { t: 'job', id: j.id });
    }
    case 'job': return go({ t: 'job', id: v });
    case 'report': return go({ t: 'report', id: v, lines: [] });
    case 'qrep': {
      const j = job(v)!;
      const lines = questionReport(w, j);
      S.view = { t: 'report', id: v, lines };
      save();
      return;
    }
    case 'ack': {
      const j = job(v);
      if (j) j.acked = true;
      save();
      S.stack = [];
      S.view = { t: 'tab', name: 'today' };
      return;
    }
    case 'mine': {
      const j = job(v)!;
      if (j.status === 'offered') takeJob(w, j);
      return go({ t: 'approach', id: v });
    }
    case 'go': {
      const j = job(args[0])!, r = resolve(w, j, args[1]);
      // V90: an approach that has become a matter between you and him (protection, a word, terms) carries on in front of him: the
      // conversation opens on it, with what he said, rather than his answer turning up on another screen
      const t = j.target ? w.chars[j.target] : undefined;
      const m = t?.alive ? openAsks(w).find((x) => x.terms?.by === P().id && x.terms?.of === t.id && Number(x.m?.at ?? -1) >= w.now - r.minutes - 1) : undefined;
      if (t && m) { (P().intro ??= {})[t.id] ??= w.now; return pass(r.minutes, [], { t: 'talk', convo: { ...startConvo(t.id), ctx: { asked: [], focus: 'm:' + m.id } }, lines: r.lines }); }
      return pass(r.minutes, r.lines);
    }
    case 'talkm': { // go and see him about a particular matter (from its page): the conversation opens on it
      const [id, sid] = args, t = w.chars[id];
      if (!t?.alive) return;
      talkTo(id);
      // (and you raise it: what you say and what he answers follow the greeting, as their own exchange)
      if (S.view.t === 'talk' && introduced(w, P(), t)) {
        const v = S.view, res = say(w, P(), t, { ...v.convo, ctx: { ...v.convo.ctx, focus: undefined } }, 'f:m:' + sid);
        if (res.convo) S.view = { t: 'talk', convo: res.convo, lines: res.lines, q: res.q, history: [...(v.history ?? []), { q: v.q, lines: v.lines }] };
      }
      return;
    }
    case 'deleg': return go({ t: 'delegate', id: v });
    case 'who': return go({ t: 'sendorder', id: args[0], who: args[1] });
    case 'send': {
      const err = assign(w, job(args[0])!, args[1], args[2] as 'quiet' | 'hard');
      if (err) { S.log = [err]; S.view = { t: 'delegate', id: args[0] }; return; }
      return pass(15, [`${w.chars[args[1]].name} is on it. He’ll report back.`]);
    }
    case 'pass': declineJob(w, job(v)!); save(); S.stack = []; S.view = { t: 'tab', name: 'today' }; return;
    case 'drop': dropJob(w, job(v)!); save(); S.stack = []; S.view = { t: 'tab', name: 'today' }; return;
    case 'amb': { const p = P(); p.ambition = { kind: v, since: w.now, rank0: p.rank }; save(); return; }
    case 'save': {
      save();
      const b = saveBox();
      S.log = ['Saving…'];
      tab('today');
      (b ? b.idle() : Promise.resolve(null)).then((st) => {
        const ok = !!st?.ok && S.save?.ok !== false;
        if (S.view.t === 'tab' && S.log[0] === 'Saving…') { S.log = [ok ? 'Saved.' : 'Could not save: ' + (S.save?.error ?? 'unknown problem') + '. Your last good save is untouched.']; render(); }
      });
      return;
    }
    case 'dlsave': downloadSave(); return;
    case 'ulsave': document.getElementById('ulfile')?.click(); return;
    case 'reset':
      if (v === 'go' || S.confirmReset) {
        saveBox()?.erase().catch(() => { /* nothing to clear */ });
        forgetSummary();
        S.save = null;
        S.saveGood = '';
        S.w = null;
        S.confirmReset = false;
        S.intro = 'title';
        S.confirmNew = false;
        S.introPlayed = false;
      } else S.confirmReset = true;
      return;
  }
}

import { orderMenu } from './orders';
function require_plan() {
  return orderMenu(W(), P());
}

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (!el) return;
  e.preventDefault();
  const raw = el.dataset.a!;
  const i = raw.indexOf(':');
  const before = window.scrollY;
  try {
    handle(raw.slice(0, i), raw.slice(i + 1));
  } catch (err) {
    console.error(err);
    S.log = ['Something went wrong with that. Nothing was lost.'];
    S.view = { t: 'tab', name: 'today' };
    S.stack = [];
  }
  render();
  const inPlace = ['tog', 'gpick', 'lsub', 'sub', 'pf', 'stance', 'tree', 'opdist', 'oprun', 'hjpick'].includes(raw.slice(0, i)) || /^om:(both|first|last|bg|shuffle|look|keep|new|lg)/.test(raw);
  // a conversation keeps its place: the newest exchange is brought into view, with what was said before it just above
  const now = S.view.t === 'talk' && raw.startsWith('say:') ? document.querySelector('.cv-now') as HTMLElement | null : null;
  if (now) window.scrollTo(0, Math.max(0, now.getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 900 ? 120 : 90)));
  else window.scrollTo(0, inPlace ? before : 0);
  // On the opening screens a keyboard user keeps their place: the control they pressed has focus again after the redraw.
  if (!S.w && e.detail === 0) (document.querySelector(`[data-a="${CSS.escape(raw)}"]`) as HTMLElement | null)?.focus();
});

document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el?.id === 'om-first' || el?.id === 'om-last') typed(el);
});
document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (e.key === 'Enter' && (el?.id === 'om-first' || el?.id === 'om-last')) (el as HTMLInputElement).blur();
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el?.id !== 'ulfile' || !el.files?.[0]) return;
  el.files[0].text().then((raw) => {
    try { S.w = deserialize(raw); S.stack = []; S.view = { t: 'tab', name: 'today' }; S.log = ['Save file loaded.']; save(); } catch { S.notice = 'That file is not a readable OMERTÀ save.'; }
    render();
  });
});

// The saved game is read once, before anything is drawn: the opening screen has to know whether there is one.
openSaves().then(() => { const n = storageNote(); if (n && !S.notice) S.notice = n; }, (e) => console.error(e)).then(() => render());
