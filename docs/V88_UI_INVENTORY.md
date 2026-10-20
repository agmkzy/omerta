# V88 UI functional inventory (before the redesign)

Generated from the source on branch `v88-ui` before any UI change. Every player action in OMERTÀ is a `data-a="action:arg"`
attribute handled by `handle()` in `src/web.ts`. 129 actions. After the redesign, each must still be reachable from
an appropriate place; the "After" column of the verification table at the end records where.

| Action | Offered by (file:view) | Handler (first line) |
|---|---|---|
| `ack` | views_b.ts:m | `{` |
| `amb` | ambview.ts:pick | `{ const p = P(); p.ambition = { kind: v, since: w.now, rank0: p.rank }; save(); return; }` |
| `askout` | views_b.ts:pr | `{ const r = askOut(w, P(), w.chars[v]); return pass(r.minutes, r.lines, { t: 'tab', name: ` |
| `attend` | views_b.ts:t | `{` |
| `audit` | views_b.ts:h | `{` |
| `baby` | views_b.ts:kids | `return pass(120, tryForBaby(w, P()), { t: 'tab', name: 'life' });` |
| `back` | common.ts:back, views_a.ts:c | `return pop();` |
| `biz` | links.ts:bl, views_a.ts:k | `return go({ t: 'biz', id: v });` |
| `bj` | views_a.ts:out_ | `return go({ t: 'bj' });` |
| `bjact` | blackjack.ts:g | `{ const lines = bjAct(v as 'hit' / 'stand' / 'double'); return pass(5, lines, { t: 'bj', i` |
| `bjbet` | blackjack.ts:bets | `{ const lines = bjDeal(args[0], Number(args[1])); return pass(10, lines, { t: 'bj', id: ar` |
| `bjt` | blackjack.ts:w | `return go({ t: 'bj', id: v });` |
| `books` | views_a.ts:k, views_b.ts:env | `return go({ t: 'books', id: v, lines: [] });` |
| `breakoff` | views_b.ts:kids | `return pass(60, breakOff(w, P()), { t: 'tab', name: 'life' });` |
| `brief` | views_a.ts:needHtml | `return go({ t: 'brief' });` |
| `buy` | pathview.ts:lo | `return pass(10, buyLife(w, P(), v), { t: 'tab', name: 'today' });` |
| `cact` | clubview.ts:sc | `{ sceneAct(w, P(), v); save(); return; }` |
| `cat` | blackjack.ts:w, views_a.ts:out_, views_c.ts:optList | `{` |
| `cend` | clubview.ts:sc | `{ const mins = closeScene(w); return pass(mins, [], v === 'stay' ? { t: 'place', id: 'club` |
| `chair` | pathview.ts:co | `return pass(40, chairAct(w, P(), v), { t: 'tab', name: 'today' });` |
| `club` | views_b.ts:here, views_b.ts:pl_ | `{` |
| `cmove` | views_b.ts:moves | `{` |
| `comm` | pathview.ts:mine | `return go({ t: 'comm' });` |
| `consig` | pathview.ts:nm | `return pass(5, setConsigliere(w, P(), w.chars[v]), { t: 'manage' });` |
| `continue` | opening.ts:cont | `{` |
| `court` | pathview.ts:cm | `return pass(60, courtBoss(w, P(), v), { t: 'comm' });` |
| `cscene` | clubview.ts:others, clubview.ts:wait | `{` |
| `date` | views_a.ts:k | `return pass(240, seePartner(w, P()));` |
| `dateplan` | views_b.ts:kids | `return pass(v === 'walk' ? 90 : 240, datePlan(w, P(), v), { t: 'tab', name: 'life' });` |
| `dayjob` | views_a.ts:out_, views_b.ts:sub | `return go({ t: 'dayjob' });` |
| `deleg` | views_b.ts:t | `return go({ t: 'delegate', id: v });` |
| `dispute` | views_c.ts:list | `return go({ t: 'dispute', id: v, lines: [] });` |
| `dlsave` | views_b.ts:sub, web.ts:st | `downloadSave(); return;` |
| `doplan` | views_b.ts:crew | `{` |
| `drop` | views_b.ts:t | `dropJob(w, job(v)!); save(); S.stack = []; S.view = { t: 'tab', name: 'today' }; return;` |
| `dv` | views_c.ts:nm | `{` |
| `echoose` | views_a.ts:c | `{` |
| `enc` | needs list (views_a needs: open encounters) | `return go({ t: 'enc', id: v, lines: [] });` |
| `ent` | brief.ts:pins, links.ts:pl, sunday.ts:vs, views_b.ts:crew, views_b.ts:kids, views_b.ts:list, views_b.ts:rows, views_b.ts:sub | `return go({ t: 'person', id: v });` |
| `excuse` | views_b.ts:t | `declineJob(w, job(v)!); save(); S.stack = []; S.view = { t: 'tab', name: 'today' }; return` |
| `fact` | views_a.ts:mine, views_b.ts:sub, web.ts:picked | `return go({ t: 'fact', id: v });` |
| `ghost` | views_b.ts:kn | `return S.view.t === 'guests' ? startMeeting(openGathering(w, P(), S.view.picked)) : undefi` |
| `go` | views_b.ts:approachView | `{` |
| `goals` | views_a.ts:st | `return go({ t: 'goals' });` |
| `gpick` | views_b.ts:kn | `{` |
| `grudges` | views_a.ts:out_ | `return go({ t: 'grudges' });` |
| `guideoff` | views_a.ts:next | `if (w.goals) w.goals.done['g:off'] = w.now; save(); return;` |
| `heir` | pathview.ts:nm | `return pass(5, setHeir(w, P(), w.chars[v]), { t: 'manage' });` |
| `help` | views_a.ts:k | `return go({ t: 'help', who: v, lines: [] });` |
| `helpdo` | views_b.ts:c | `{` |
| `hijack` | views_b.ts:hj, views_c.ts:optList | `return go({ t: 'hijack', picked: [] });` |
| `hire` | views_b.ts:ps | `{` |
| `hjgo` | views_b.ts:crew | `return S.view.t === 'hijack' ? pass(60, hijack(w, P(), S.view.picked), { t: 'tab', name: '` |
| `hjpick` | views_b.ts:crew | `{` |
| `job` | views_b.ts:out_, views_c.ts:jobsOut | `return go({ t: 'job', id: v });` |
| `jx` | views_b.ts:t | `{` |
| `lsub` | views_b.ts:sub | `S.lifeSub = v as typeof S.lifeSub; if (v === 'love' && W().life) { datingPool(W(), P()); s` |
| `manage` | pathview.ts:mine | `return go({ t: 'manage' });` |
| `marryask` | views_b.ts:kids | `{ const r = askMarry(w, P()); return pass(90, r.lines, { t: 'tab', name: 'life' }); }` |
| `mdone` | views_b.ts:it | `{` |
| `meet` | views_b.ts:env, views_b.ts:p | `` |
| `mine` | views_b.ts:t | `{` |
| `mopt` | views_b.ts:it | `{` |
| `mv` | move lists (jobs/racket moves, built dynamically) | `{` |
| `new` | opening.ts:panel | `{` |
| `npin` | views_a.ts:mine | `{ togglePin(P(), v); save(); return; }` |
| `ntag` | views_a.ts:mine | `{ toggleTag(P(), args[0], Number(args[1])); save(); return; }` |
| `om` | opening.ts:begin, opening.ts:chips, opening.ts:field, opening.ts:next, opening.ts:panel, opening.ts:r, opening.ts:strengths, opening.ts:swatches, opening.ts:t, opening.ts:tab | `return openingAct(v);` |
| `op` | views_b.ts:gicons, views_c.ts:state | `return go({ t: 'op', id: v, lines: [] });` |
| `opclose` | views_b.ts:r | `{` |
| `opcount` | views_b.ts:r | `{` |
| `opdist` | views_b.ts:err | `S.opDist = v; return;` |
| `opgo` | views_b.ts:err | `{` |
| `oprule` | views_b.ts:r | `{` |
| `oprun` | views_b.ts:err | `S.opRunner = v; return;` |
| `opstart` | views_b.ts:gicons, views_c.ts:optList | `S.opDist = ''; S.opRunner = 'me'; return go({ t: 'opstart', kind: v });` |
| `opt` | views_b.ts:c | `return doAction(S.opts[Number(v)]);` |
| `orders` | views_a.ts:k, views_a.ts:out_, views_a.ts:prot, views_b.ts:env, views_b.ts:p | `return go({ t: 'orders', who: v });` |
| `pass` | views_b.ts:t | `declineJob(w, job(v)!); save(); S.stack = []; S.view = { t: 'tab', name: 'today' }; return` |
| `people` | views_a.ts:out_ | `return go({ t: 'people' });` |
| `perm` | views_b.ts:rows | `{` |
| `pf` | views_b.ts:sub | `S.worldFilter = v; return;` |
| `place` | views_a.ts:dg, views_a.ts:out_, views_b.ts:w | `return go({ t: 'place', id: v });` |
| `places` | views_a.ts:out_ | `return go({ t: 'places' });` |
| `plan` | views_a.ts:prot, views_b.ts:groups, views_b.ts:gtone, views_c.ts:optList | `{` |
| `power` | pathview.ts:btn | `return pass(40, usePower(w, P(), v), { t: 'tab', name: 'today' });` |
| `propose` | pathview.ts:cm | `return pass(90, propose(w, P(), args[0], args[1] // undefined), { t: 'comm' });` |
| `qrep` | views_b.ts:m | `{` |
| `quitjob` | views_b.ts:p | `quitDayJob(P()); save(); return;` |
| `raise` | pathview.ts:r | `{` |
| `rec` | views_b.ts:rk | `` |
| `recr` | views_b.ts:rk | `{` |
| `recruit` | views_b.ts:env | `return go({ t: 'recruit' });` |
| `report` | needs list (crew reports back) | `return go({ t: 'report', id: v, lines: [] });` |
| `reset` | views_a.ts:p, views_b.ts:sub | `` |
| `restore` | views_b.ts:sub | `{ const s = snapList().find((x) => x.key === v); const raw = s ? localStorage.getItem(s.ke` |
| `reward` | views_b.ts:h | `{` |
| `rival` | family.ts:mine | `return W().chars[v]?.alive ? go({ t: 'settle', id: v, lines: [] }) : undefined;` |
| `rule` | views_b.ts:h | `{` |
| `saccall` | built dynamically (see source) | `{` |
| `save` | views_b.ts:sub | `{ const ok = save(); S.log = [ok ? 'Saved.' : 'Could not save: ' + (S.save?.error ?? 'unkn` |
| `say` | views_b.ts:btn | `{` |
| `sbooks` | built dynamically (see source) | `{` |
| `scheme` | views_b.ts:sc, views_c.ts:optList | `{` |
| `send` | views_b.ts:sendView | `{` |
| `setboss` | pathview.ts:men | `return pass(5, setBoss(w, P(), w.chars[args[0]], w.chars[args[1]]), { t: 'manage' });` |
| `setrank` | pathview.ts:order | `{ const lines = setRank(w, P(), w.chars[args[0]], args[1] as import('./types').Rank); retu` |
| `settle` | views_a.ts:k, views_b.ts:rows | `return W().chars[v]?.alive ? go({ t: 'settle', id: v, lines: [] }) : undefined;` |
| `shake` | views_a.ts:prot | `{` |
| `shand` | built dynamically (see source) | `{` |
| `shift` | views_a.ts:out_, views_b.ts:p | `{` |
| `srule` | built dynamically (see source) | `{` |
| `stance` | sunday.ts:boss, views_b.ts:pill | `setStance(P(), v as 'honest' / 'shave' / 'stall'); save(); return;` |
| `steady` | views_b.ts:kids | `{ const r = askSteady(w, P()); return pass(60, r.lines, { t: 'tab', name: 'life' }); }` |
| `story` | brief.ts:run, stories.ts:row, views_b.ts:hs, web.ts:f | `return /^d\d+$/.test(v) ? go({ t: 'dispute', id: v, lines: [] }) : go({ t: 'story', id: v ` |
| `sunday` | clubview.ts:here | `return go({ t: 'sunday' });` |
| `sv` | views_b.ts:why | `{` |
| `tab` | views_a.ts:k, views_a.ts:needHtml, views_a.ts:out_, views_c.ts:q, web.ts:t | `return tab(v as Tab);` |
| `takejob` | views_b.ts:opts | `takeDayJob(w, P(), S.jobOpts[Number(v)]); save(); return;` |
| `talk` | views_a.ts:k, views_a.ts:prot, views_b.ts:here, views_b.ts:rows, views_c.ts:facts, views_c.ts:q | `return talkTo(v);` |
| `tog` | common.ts:html, views_a.ts:needHtml, views_b.ts:rest, views_b.ts:shops | `S.open[v] = !S.open[v]; return;` |
| `tree` | links.ts:fl, views_a.ts:capos, views_a.ts:k | `S.treeFam = v // undefined; if (S.view.t === 'tab' && S.view.name === 'family') return; re` |
| `ulsave` | views_b.ts:sub | `document.getElementById('ulfile')?.click(); return;` |
| `visit` | views_a.ts:k | `{` |
| `wait` | views_b.ts:timeBar | `return go({ t: 'wait' });` |
| `waitgo` | views_b.ts:timeBar, views_b.ts:waitView | `{` |
| `way` | views_c.ts:cardOf | `return go({ t: 'way', id: v, lines: [] });` |
| `wed` | views_b.ts:kids | `return pass(480, wedding(w, P()), { t: 'tab', name: 'life' });` |
| `who` | views_b.ts:w | `return go({ t: 'sendorder', id: args[0], who: args[1] });` |

## Verification after the V88 restructure (in progress)

- Static check: all 129 actions above are still emitted by some screen (the seven built dynamically are unchanged in
  `needs()` and `ui/sunday.ts`); one new action, `career:` (opens Life > Career). Nothing is emitted that the handler
  doesn't know.
- Moved, not removed: the Today tiles "Your crew" and "Rackets" (the bottom tabs and the desktop rail open them);
  "Next in line" (Family → Life > Career, with a link from Family); ambition, standing, powers and milestones (Today →
  Life > Career, with a summary card on Today); Stories (bottom tab on phones → a link on Today; still in the desktop rail).
- Browser crawl (phone 375×812 and desktop 1440×900): 34 screen types opened, including talk, encounters, meetings,
  jobs, rackets, the family tree, businesses, people, the Herald and blackjack; no errors, no horizontal overflow.
