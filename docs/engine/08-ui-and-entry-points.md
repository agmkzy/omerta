# User interface and entry points

This group is everything that sits between a person and the simulation. In game terms it is the phone-sized browser game (the Today, Rackets, Crew, Family, Life and Stories tabs, every person sheet, conversation, meeting, Sunday table and blackjack table), the start screen where the player picks a face and background, the save and backup controls, and four command-line tools used for headless simulation, bots, stress runs and scripted play-tests. In code terms it is a hand-written string-template UI with no framework: [web.ts](../../src/web.ts) owns a single document-level click listener that parses `data-a="action:value"` attributes, a large `handle()` dispatcher that calls engine functions and mutates a module-level UI state object `S` ([ui/state.ts](../../src/ui/state.ts)), and a `render()` that rebuilds `#app.innerHTML` from strings produced by the view functions in `src/ui/*.ts`. The UI imports 43 engine modules; no engine module imports the UI, so the dependency is one-way. The CLI tools ([cli.ts](../../src/cli.ts), [bot.ts](../../src/bot.ts), [stress.ts](../../src/stress.ts), [playtest/pt.ts](../../playtest/pt.ts)) drive the same engine without the browser.

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: ui`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+ui%22), [`area: tooling`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+tooling%22).

## Modules

| File | Lines | Responsibility |
|---|---|---|
| [src/web.ts](../../src/web.ts) | 879 | Browser entry: storage glue, news digest, navigation stack, `pass()` turn wrapper, start screen, `body()` view switch, `render()`, `handle()` dispatcher, click/change listeners. |
| [src/ui/state.ts](../../src/ui/state.ts) | 93 | The `View` union, `Tab`/`LifeSub` types, the mutable UI state object `S`, and the `W()`/`P()` accessors. |
| [src/ui/links.ts](../../src/ui/links.ts) | 83 | HTML escaping (`esc`), name-to-link conversion (`lk`, `youify`), link builders, small character helpers (`chip`, `who`, `statusOf`, `known`). |
| [src/ui/common.ts](../../src/ui/common.ts) | 62 | Shared widgets: icons, expandable banners, back button, the status strip, skill/trait rows, avatar wrapper, meter rows. |
| [src/ui/views_a.ts](../../src/ui/views_a.ts) | 409 | Today screen and its "needs" list, person, business, fact and encounter sheets, family tree. |
| [src/ui/views_b.ts](../../src/ui/views_b.ts) | 776 | Menus, waiting, orders and planning, job screens, crew, recruiting, day jobs, books, conversation, people, places, grudges, meetings, dinners, Family and Life tabs, rackets operations, hijacks, settling scores. |
| [src/ui/views_c.ts](../../src/ui/views_c.ts) | 347 | Rackets tab ("ways to earn"), single-way page, milestones, dispute page and list, seat story, dispute stage helpers. |
| [src/ui/stories.ts](../../src/ui/stories.ts) | 234 | Builds the player's list of ongoing "stories" from disputes, debts, crew trouble, threats, hunts, turf and situations; Stories tab and story page. |
| [src/ui/brief.ts](../../src/ui/brief.ts) | 59 | Weekly brief: the Herald front page, week-on-week deltas, news, "coming up". |
| [src/ui/sunday.ts](../../src/ui/sunday.ts) | 92 | Sunday envelope table: each crew man's envelope, check-books and ruling buttons, the player's own kick-up. |
| [src/ui/family.ts](../../src/ui/family.ts) | 40 | Promotion queue ("next in line") for the player's rank. |
| [src/ui/pathview.ts](../../src/ui/pathview.ts) | 92 | Road-to-next-rank card, rank powers card, boss "reshape the family" and Commission screens. |
| [src/ui/clubview.ts](../../src/ui/clubview.ts) | 36 | Social club screen: who is in, who wants a word, the club scene in progress. |
| [src/ui/ambview.ts](../../src/ui/ambview.ts) | 13 | Ambition picker and progress card. |
| [src/ui/blackjack.ts](../../src/ui/blackjack.ts) | 40 | Casino lobby and blackjack table; thin wrappers over the engine `blackjack.ts`. |
| [src/ui/portrait.ts](../../src/ui/portrait.ts) | 258 | Procedurally painted SVG portraits. Must never change (CLAUDE.md). |
| [src/ui/portraits_pack.ts](../../src/ui/portraits_pack.ts) | 3 | Intentionally empty override slot for supplied portrait images. |
| [web/template.html](../../web/template.html) | 303 | Page shell: title, meta tags, Google Fonts link, all CSS (light/dark tokens), `<div id="app">`. |
| [src/cli.ts](../../src/cli.ts) | 220 | `sim` (headless run and history report) and `play` (old text-mode game with autosave). |
| [src/bot.ts](../../src/bot.ts) | 106 | Scripted player policy that exercises jobs, meetings, schemes and books. |
| [src/stress.ts](../../src/stress.ts) | 73 | Long-run stress player with per-step consistency audit. |
| [playtest/pt.ts](../../playtest/pt.ts) | 146 | Command-per-invocation play-test harness with persistent state and an action log. |

Build: [build-web.sh](../../build-web.sh) bundles `src/web.ts` with esbuild (`--bundle --format=iife --minify --target=es2020`) to `dist/web.js`, refuses a bundle containing `</script`, then concatenates `web/template.html` + `<script>` + bundle into `dist/omerta.html`. Because the script is appended after `<div id="app"></div>`, the top-level `render()` call at [web.ts:878](../../src/web.ts) finds `#app` without waiting for `DOMContentLoaded`.

## Rendering model

**One frame, end to end.**

1. Every interactive element carries `data-a="code:value"`. The value may be empty (`back:`) or pipe-separated (`srule:<id>|praise`, `doplan:3|<id>|hard`).
2. A single `document.addEventListener('click', …)` at [web.ts:849](../../src/web.ts) finds `e.target.closest('[data-a]')`, calls `e.preventDefault()`, splits the attribute at the first `:` and calls `handle(code, value)`. `handle()` itself splits the value on `|` into `args`.
3. `handle()` ([web.ts:357](../../src/web.ts)) does one of three things: changes only UI state (`S.view`, `S.stack`, `S.open`, pickers), calls an engine function and then usually `pass(minutes, lines, nextView)`, or calls an engine function and `save()` without moving the clock. Any exception thrown inside `handle()` is caught by the listener, which sets `S.log = ['Something went wrong with that. Nothing was lost.']` and returns to Today.
4. `pass()` ([web.ts:169](../../src/web.ts)) is the turn wrapper: snapshot cash/heat/standing/known/rank, `advance(w, w.now + minutes)`, `pruneJobs(w)`, run lines through `lk()` into `S.log`, fast-forward through jail if the player was picked up, rebuild `S.news` via `collectNews()` (scored by `reports.relevance`, top five, duplicates collapsed into `S.routine`), build delta chips, clear the back stack, set `S.view = next`, `save()`.
5. After `handle()` returns, the listener always calls `render()` ([web.ts:327](../../src/web.ts)). With no world it writes the start screen. Otherwise it calls `body()` (a `switch` over all 39 `View` variants, [web.ts:271](../../src/web.ts)) inside a try/catch that falls back to Today, prepends a one-shot `S.notice` and the save banner, appends the tab bar, and assigns the whole string to `document.getElementById('app').innerHTML`.
6. The listener then scrolls: `window.scrollTo(0, inPlace ? before : 0)`, where `inPlace` is the fixed list `tog, gpick, lsub, pf, stance, tree, opdist, oprun, hjpick` ([web.ts:865](../../src/web.ts)). Every other action scrolls to the top.

The only other event listener is `change` on `#ulfile` (the hidden backup-file input), which reads the file, `deserialize`s it, saves and renders ([web.ts:869](../../src/web.ts)). There are no keyboard handlers, timers (apart from the 1 s blob-URL revoke in `downloadSave`), resize handlers or observers.

**Reactivity.** There is none in the framework sense: no virtual DOM, no diffing, no subscriptions, no dirty flags. Every click re-renders the entire `#app`, including every portrait SVG on the page and the tab bar badges (`attentionCount()` and `newStories()` are recomputed per render, and `newStories` runs the whole `storiesOf()` builder). Consequences:

- Form state that is not held in `S` is lost on every render. The start screen works around this by reading the name `<input>` into `S.startName` inside the `bg` and `look` handlers before re-rendering. Native `<details>` folds ("Earlier in this conversation", "What your rank lets you do", "This week…") are not tracked and collapse on every click; only banners and a few toggles tracked in `S.open` survive.
- Keyboard focus is destroyed on every render.
- Views are not pure. Several write to `S` while rendering (option arrays that later action codes index into, "seen" markers), and a few write to the `World` (see "UI state vs world state").

**Index-based action codes.** `opt:i`, `say:i`, `plan:i`, `doplan:i|…`, `scheme:i`, `cmove:i`, `takejob:i` and `waitgo:i` are indices into arrays that the view filled during the last render (`S.opts`, `S.dopts`, `S.planOpts`, `S.schemeMoves`, `S.moves`, `S.jobOpts`) or that `handle()` recomputes (`waitChoices(true)`; the timebar uses `waitChoices()` whose entries are a prefix of the full list, so indices agree). This is safe only because a render always follows each action and the world cannot change between render and click.

**Escaping.** `esc()` ([links.ts:6](../../src/ui/links.ts)) replaces `& < > " '`. `lk()` ([links.ts:39](../../src/ui/links.ts)) escapes, applies `youify`, then wraps known names in `<a class="nm" data-a="ent:|biz:|tree:…">`. View code is expected to pass all free text through `esc` or `lk`. The places where text reaches `innerHTML` without escaping:

- `S.log` entries assigned directly in `handle()` rather than via `pass()` are rendered raw by `todayView` (`<p>${l}</p>`, [views_a.ts:96](../../src/ui/views_a.ts)): the `giveOrder` error in `doplan`, the `assign` error in `send` (e.g. `${m.name} is busy…`), the save error message in `save`, and fixed strings. The `new` handler deliberately escapes its own lines because they contain the typed player name.
- The portrait SVG's `aria-label="${c.name}"` ([portrait.ts:247](../../src/ui/portrait.ts)) is unescaped. On the start screen the preview character's name is `S.startName`, i.e. whatever the player typed.
- Enum-typed fields (`c.rank`, `p.rank` in some places), ids in `data-a` attributes and story keys are interpolated raw on the assumption that the engine generated them.

The only external inputs are the typed player name and imported backup files, so the realistic risk is a doctored save file shared between players (names or ids containing markup). Severity is low, but a replacement should escape at the sink. The aria-label case could be closed without touching `portrait.ts` by having `common.avatar` pass a copy of the character with an escaped name; output for ordinary names would be byte-identical.

## The action code table

All 130 codes handled by `handle()` in [web.ts](../../src/web.ts). Every code emitted anywhere in `src/` has a handler and every handler has an emitter (checked by grepping literal `data-a="…`, the Sunday `BTN()` helper, `a:` fields in stories/ambition/guide/needs). "Time" is the minutes passed to `pass()` (`r` means the engine result's `minutes`); "save" means `save()` is called without moving the clock; "UI" means nothing is persisted.

| Code | Value | What it does | Engine call(s) | Time / persistence |
|---|---|---|---|---|
| `bg` | background id | Start screen: keep typed name, set `S.bg`. | none | UI |
| `look` | `key\|n` or `shuffle\|0` | Start screen face chooser; `shuffle` uses `Math.random`. | none | UI |
| `new` | – | Create a world with a random seed and the typed name, copy `S.look` to the player, apply background, intro lines. | `world.createWorld`, `background.applyBackground` | save |
| `continue` | – | Load main save (falling back to newest readable snapshot). | `engine.deserialize`, `storage.usageStatus` | none |
| `tab` | tab name | Clear stack, show tab. | – | UI |
| `back` | – | `pop()`; skips dead talk/meeting/approach/sendorder views. | – | UI |
| `tog` | banner key | Toggle `S.open[key]`. | – | UI |
| `ent` | char id | Person sheet. | – | UI |
| `biz` | biz id | Business sheet. | – | UI |
| `fact` | fact id | Fact sheet. | – | UI |
| `tree` | family id or empty | Set `S.treeFam`; on Family tab stays in place, otherwise opens tree view. | – | UI |
| `lsub` | life sub-tab | Set `S.lifeSub`; for `love` generates the dating pool. | `life.datingPool` (uses `w.rng`, may spawn civilians) | save (for `love`) |
| `pf` | filter | Life > People family filter. | – | UI |
| `place` | place id | Place screen (`club` → club screen). | – | UI |
| `places` | – | "Around town" list. | – | UI |
| `cscene` | char id | Start a club scene with the top topic that man raises; links an open encounter if the topic is `enc`. | `clubdata.clubOf`, `club.topicsFor`, `club.startScene` | save |
| `cact` | option code | Act within the club scene. | `club.sceneAct` | save |
| `cend` | `stay`/`leave` | Close the scene. | `club.closeScene` | r |
| `club` | `sit`/`shave`/`drink` | Sit at the club, barber, corner bar. | `places.sitAtClub`, `places.shave`, `places.drinkAt` | r |
| `people` | – | Who's where. | – | UI |
| `grudges` | – | Grudges list. | – | UI |
| `goals` | – | Milestones. | – | UI |
| `dispute` | dispute id | Dispute page. | – | UI |
| `rival` | char id | Settle view against a rival in the promotion queue (if alive). | – | UI |
| `story` | story key | `dNN` → dispute page; anything else → story page. | – | UI |
| `dv` | `code\|disputeId` | Dispute actions: `talk` (→ `talkTo` opponent), `settle` (→ settle view), `ignore`, `look`, `sit`. | `disputes.ignoreDispute`, `disputes.investigate`, `disputes.callSitdown` | 5 / r / 30 |
| `recruit` | – | Prospects list. | – | UI |
| `dayjob` | – | Legitimate work screen. | – | UI |
| `orders` | char id or empty | Orders for one man, or pick a man. | – | UI |
| `wait` | – | Full wait menu. | – | UI |
| `guideoff` | – | Hide the first-week guide: `w.goals.done['g:off'] = now`. | – | save |
| `waitgo` | index | Fixed waits perform a `wait` action; "Next event" advances in 30-minute steps (max 48) until attention count rises, death or jail. | `actions.perform` / `engine.advance`, `jobs.pruneJobs` | r / elapsed |
| `cat` | `Kind` | Generate player actions of a kind (top 12) into `S.opts`; `work` auto-performs the best. | `actions.generate` | UI / r |
| `opt` | index | Perform `S.opts[i]`; socialising opens a conversation. | `actions.perform`, `dialogue.arrive` | r |
| `talk` | char id | `talkTo()`: jail check, stranger → fresh `Convo`, known → perform a quiet `socialise` and `arrive`. Also marks guide goals. | `where.whereIs`, `dialogue.introduced`, `actions.generate`, `actions.perform`, `dialogue.arrive`, `dialogue.startConvo` | r or travel minutes |
| `settle` | char id | Settle view (if alive). | – | UI |
| `sv` | `code\|charId` | `back`/`whack` switch settle-view variants; other codes act. | `revenge.settleDo`, `disputes.playerActed` | r when done |
| `ntag` | `charId\|tagIndex` | Toggle a notebook tag. | `notebook.toggleTag` | save |
| `npin` | char id | Toggle a notebook pin. | `notebook.togglePin` | save |
| `restore` | snapshot key | Replace the world with an older snapshot, no confirmation. | `engine.deserialize` | save (overwrites main save) |
| `brief` | – | Weekly brief. | – | UI |
| `sunday` | – | Sunday table. | – | UI |
| `sbooks` | char id | Check a man's books from the Sunday table; result kept in `S.sundayBooks`. | `books.checkBooks` (uses `w.rng`) | save |
| `srule` | `charId\|code` | Answer one man on Sunday. `accept`, `keep`, `praise`, `shout`, `cut` are implemented inline in web.ts (relationship deltas, cash transfer + `ledger.post`, arrears, `rank.leaveCrew`); `demand`, `warn`, `forgive`, `raise`, `beat` go to `books.rule`. Always adds a minor `favour` fact. | `ledger.statement`, `core.rel`, `ledger.post`, `rank.leaveCrew`, `books.rule`, `core.addFact` | save (no time, even for `beat`) |
| `saccall` | – | Accept every envelope that is in order (+0.02 trust each). | `ledger.statement`, `core.rel` | save |
| `shand` | `all`/`half` | Hand the player's own envelope to his boss. | `books.envelopeSum`, `books.handOver` | save |
| `date` | (ignored) | Take partner out. | `life.seePartner` | 240 |
| `dateplan` | date code | Planned date. | `life.datePlan` | 90 (`walk`) or 240 |
| `askout` | char id | Ask a woman out. | `life.askOut` | r |
| `steady` | – | Ask her to go steady. | `life.askSteady` | 60 |
| `marryask` | – | Propose. | `life.askMarry` | 90 |
| `wed` | – | Wedding. | `life.wedding` | 480 |
| `baby` | – | Try for a baby. | `life.tryForBaby` | 120 |
| `breakoff` | – | End it. | `life.breakOff` | 60 |
| `visit` | kin char id | Visit family. | `life.visitKin` | 90 |
| `perm` | char id | Ask permission to touch a made man. | `politics.askPermission` | 60 |
| `shift` | – | Work a shift. | `orders.workShift` | r |
| `takejob` | index | Take `S.jobOpts[i]`. | `orders.takeDayJob` | save |
| `quitjob` | – | Quit day job. | `orders.quitDayJob` | save |
| `hire` | char id | Take on a prospect. | `orders.recruitProspect` | 30 |
| `enc` | encounter id | Encounter sheet. | – | UI |
| `way` | way id | Single "way to earn" page. | – | UI |
| `opstart` | op kind | Racket start screen; resets district/runner pickers. | – | UI |
| `opdist` | district | Set `S.opDist`. | – | UI |
| `oprun` | `me` or char id | Set `S.opRunner`. | – | UI |
| `opgo` | op kind | Start the racket. | `rackets.startOp` | 30 |
| `op` | op id | Racket page. | – | UI |
| `opcount` | op id | Go through the count (finds skim). | `rackets.countOp`, `engine.advance` (60) | save (no `pass`) |
| `oprule` | `opId\|code\|found` | Repay / warn / fire the runner. | `rackets.opRule` | save |
| `opclose` | op id | Shut a racket. | `rackets.closeOp` | 10 |
| `hijack` | – | Hijack crew picker. | – | UI |
| `hjpick` | char id | Toggle a man (max 3) in `S.view.picked`. | – | UI |
| `hjgo` | – | Send the hijack crew. | `rackets.hijack` | 60 |
| `echoose` | `encId\|code` | Answer an encounter; if still open stay on it. | `encounters.choose`, `engine.advance` | r (via `pass` only when closed) |
| `mv` | `sitId\|code\|who` | Story move on a situation. | `sitmoves.doMove` | r |
| `help` | char id | "Something is wrong" screen. | – | UI |
| `helpdo` | `charId\|cash\|duties\|leave` | Help a troubled crew man. | `people.helpMan` | save |
| `plan` | `index[\|charId]` | Plan screen for an order option, optionally pre-filtered to one man. | – | UI |
| `doplan` | `index\|me\|mode` or `index\|charId\|mode` | `me`: create the job, mark active, go to approach screen. Otherwise order a crew man. | `OrderOpt.make` (→ `jobs.mkJob`), `orders.giveOrder` | UI (job created, unsaved) / 15 |
| `shake` | biz id | Find the "Shake …" order for this shop, create the job, open approach screen. | `orders.orderMenu`, `OrderOpt.make` | UI (job created, unsaved) |
| `scheme` | index | Perform a stock-selling move. | `jobs.performMove` | r |
| `say` | index | Say `S.dopts[i]`; may hand off to a meeting or end the conversation. | `dialogue.say`, `dialogue.isNavCode`, `engine.advance` (meeting branch) | r |
| `cmove` | index | Crew move. | `jobs.performMove` | r |
| `meet` | `dinner`/`family`/`crew` | Dinner → guest picker; family meeting; crew meeting (if the men are asleep, advance to 14:00 and retry). | `meetings.openFamilyMeeting`, `meetings.openCrewMeeting`, `engine.advance`, `jobs.pruneJobs` | UI (meeting opened) |
| `gpick` | char id | Toggle a guest (max 4). | – | UI |
| `ghost` | – | Host the dinner. | `meetings.openGathering` | UI (meeting opened) |
| `attend` | job id | Open the summons' meeting (induction, accounts, family, sit-down, crew); sit-down marks job done. | `meetings.openInduction` / `openAccountsMeeting` / `openFamilyMeeting` / `openSitdown` / `openCrewMeeting` | UI |
| `excuse` | job id | Decline a summons. | `jobs.declineJob` | save |
| `mopt` | index | Choose a meeting option; lines into `S.view.lines`. | `meetings.current`, `meetings.choose` | none (world mutated, not saved) |
| `mdone` | – | Close the meeting. | `meetings.closeMeeting` | r |
| `books` | char id | A man's books. | – | UI |
| `stance` | `honest`/`shave`/`stall` | Player's reporting stance. | `books.setStance` | save |
| `audit` | char id | Audit a man; adds minor `favour` fact. | `books.auditMember`, `core.addFact` | r |
| `rule` | `charId\|code` | Ruling on a man's books; adds minor `favour` fact. | `books.rule`, `core.addFact` | r |
| `reward` | `charId\|code` | Reward a man. | `career.reward` | 20 |
| `manage` | – | Boss: reshape the family. | – | UI |
| `comm` | – | Boss: the Commission. | – | UI |
| `bj` | – | Casino lobby. | – | UI |
| `bjt` | biz id | Blackjack table. | – | UI |
| `bjbet` | `bizId\|amount` | Deal a hand. | `blackjack.deal` (via `bjDeal`) | 10 |
| `bjact` | `hit`/`stand`/`double` | Play the hand. | `blackjack.act` (via `bjAct`) | 5 |
| `buy` | life option | Buy a lifestyle item. | `powers2.buyLife` | 10 |
| `court` | family id | Court another boss. | `powers2.courtBoss` | 60 |
| `propose` | `code\|famId` | Put a proposal to the Commission. | `powers2.propose` | 90 |
| `consig` | char id | Name consigliere. | `powers2.setConsigliere` | 5 |
| `heir` | char id | Name heir. | `powers2.setHeir` | 5 |
| `setboss` | `charId\|capoId` | Move a soldier to another capo. | `powers2.setBoss` | 5 |
| `setrank` | `charId\|rank` | Boss sets anyone's rank. | `path.setRank` | 5 |
| `power` | power code | Use a rank power. | `path.usePower` | 40 |
| `chair` | code | Bid for the chair. | `path.chairAct` | 40 |
| `raise` | `charId\|rank` | Make a man. | `path.raise` | 30 |
| `rec` | char id | Put a man forward. | `career.recommend` | 30 |
| `recr` | char id | Take a man on. | `career.recruit` | 30 |
| `jx` | `jobId\|press\|ask\|inv\|around\|haggle` | Question an offered job. | `jobs.pressJob` / `questionJob` / `investigateJob` / `askAroundJob` / `haggleJob` | r |
| `job` | job id | Job screen. | – | UI |
| `report` | job id | Report screen. | – | UI |
| `qrep` | job id | Question the man who reported. | `orders.questionReport` | save |
| `ack` | job id | Dismiss a report: `j.acked = true`. | – | save |
| `mine` | job id | Take the job yourself and choose an approach. | `jobs.takeJob` | UI |
| `go` | `jobId\|approach` | Resolve a job with an approach. | `jobs.resolve` | r |
| `deleg` | job id | Delegate picker. | – | UI |
| `who` | `jobId\|charId` | Orders screen for that man. | – | UI |
| `send` | `jobId\|charId\|quiet\|hard` | Assign the job. | `jobs.assign` | 15 |
| `pass` | job id | Decline an offered job. | `jobs.declineJob` | save |
| `drop` | job id | Drop an active job. | `jobs.dropJob` | save |
| `amb` | ambition kind | Set `p.ambition = { kind, since, rank0 }`. | – | save |
| `save` | – | Manual save. | `storage.writeSave` (via `save()`) | save |
| `dlsave` | – | Download a JSON backup (claude.ai `downloads` capability, or a blob link). | `engine.serialize` | none |
| `ulsave` | – | Click the hidden `#ulfile` input; the `change` listener loads it. | `engine.deserialize` | save |
| `reset` | `go` or empty | Two-tap erase of the main save (`go` skips confirmation, used on the death screen); snapshots are left. | – | removes `omerta-save-v3` |

Guide side effects: before the switch, `handle()` writes `w.goals.done['g:talk' | 'g:boss' | 'g:friend' | 'g:wait' | 'g:job']` for `talk`, `waitgo`, and any non-navigation action taken while on a job/approach/delegate/sendorder screen ([web.ts:370](../../src/web.ts)).

## UI state vs world state

Only `S.w` is persisted (via `serialize` on every `save()`). Everything else in `S` lives in memory for the current page and is gone on reload.

| `S` field | Purpose | Written by | Effect of reload |
|---|---|---|---|
| `w` | The `World`. | `new`, `continue`, `restore`, file upload, `reset` | Saved. |
| `view`, `stack` | Current screen and back stack (max 30). | `go`, `tab`, `pop`, `pass`, many handlers | Reset to Today. An open conversation (`Convo`, including its spoken lines and greyed options) or meeting (`Meeting`) is lost. |
| `log`, `news`, `routine`, `chips` | "Just now", "Word reaches you", routine count, delta chips. | `pass`, a few handlers | Reset to "Welcome back.". |
| `notice` | One-shot message at the top of the next screen. | `load`, `startMeeting`, `downloadSave`, upload errors | Cleared once shown. |
| `opts`, `dopts`, `planOpts`, `schemeMoves`, `moves`, `jobOpts` | Arrays that index-based codes refer to. | `cat`; `talkView`; `ordersView`, `views_c.bucket`; `wayView`; `crewView`; `dayjobView` | Rebuilt on render. |
| `lifeSub`, `worldFilter`, `treeFam`, `open` | Sub-tab, people filter, family shown, expanded banners. | handlers | Reset. |
| `look`, `startName`, `bg` | Start-screen choices. | `look`, `bg` | Reset to defaults. |
| `seen`, `seenTab`, `seenBrief` | When each story / the Stories list / the brief was last viewed. | `storyPage`, `storyView`, `storiesTab`, `briefView` (during render) | Every running story counts as new; the brief shows "new". |
| `sundaySeen`, `sundayHeard`, `sundayLines`, `sundayRes`, `sundayBooks`, `sundayMine` | Sunday table progress keyed by `sKey(id) = "<sunday.t>:<id>"`. | `sundayView` (render), `srule`, `saccall`, `sbooks`, `shand` | Sunday reappears in Needs; per-man answers reset, so `praise`/`accept` can be repeated for the same Sunday (each repeat adds trust); the "somebody has something to tell you" lines are lost because `w.sunday.seen` is already true. |
| `sundayDone` | Declared, never read or written. | – | – |
| `confirmReset` | First tap of "Start a new game". | `reset`, every other action clears it | Reset. |
| `save`, `saveGood` | Last `SaveStatus` and label of last good save. | `save()`, `continue` | Recomputed by `usageStatus` on continue. |
| `opDist`, `opRunner` | Racket start pickers. | `opstart`, `opdist`, `oprun`, `opStartView` | Reset. |

**World fields written by the UI layer directly**, not through an engine function: `w.goals.done['g:*']` (guide, `guideoff`), `p.ambition` (`amb`), `j.acked` (`ack`), `j.status = 'active'` and `j.assignee` (`doplan` "me", `shake`), `j.status = 'done'` (`attend` sit-down), `w.scene.data.enc` (`cscene`), and in `srule`/`saccall`: `Rel.trust/respect/affection/grudge`, `p.cash`, `c.cash`, `c.books.arrears`, `p.books.flags[id].amt`, plus `addFact` calls in `srule`, `audit` and `rule`.

**World mutations that happen during render** (so they happen whether or not the player "acts"):

- `loveView` calls `life.datingPool` ([views_b.ts:756](../../src/ui/views_b.ts)), which, once per 7 game days, consumes `w.rng` and may `spawnCivilian` new characters into `w.chars`, storing `w.life.pool`.
- `sundayView` calls `crewlife.openSunday` ([sunday.ts:57](../../src/ui/sunday.ts)), which sets `w.sunday.seen = true` and teaches the player crew insights (`learnAbout`).
- `settleView` calls `core.rel(x, p.id)` and `core.rel(p, x.id)` ([views_b.ts:691](../../src/ui/views_b.ts)); `rel()` creates missing relationship entries, so opening "Take action against him" on a stranger makes him count as known (`links.known` checks `p.rels`) and puts him in the People lists.

These are persisted by the next `save()`. They make the "same seed + same actions = same history" rule depend on which screens were viewed.

**Preserved across reload because they live in the World:** club scenes (`w.scene`), the blackjack hand (`w.bj`), notebook tags and pins (`p.notes`), ambition, guide progress, the dating pool.

**Storage keys** (from [storage.ts](../../src/storage.ts)): main save `omerta-save-v3`, snapshot index `omerta-snaps-v1`, snapshots `omerta-snap-<day>` (every 3 game days, max 3, budgeted against a 4.2 MB ceiling). `save()` runs on almost every world-changing click and serialises the whole world each time; `writeSave` reads it back and compares before reporting success, and every failure lands in `S.save` and is shown by `saveBanner()`.

## Command-line tools

All tools run under `tsx`. npm passes arguments after `--`.

| Tool | Command | What it does |
|---|---|---|
| Headless sim | `npm run sim -- --seed 3 --days 60 --last 40 --out history.txt` | `createWorld(seed)`, `advance` N days with no player input, print `engine.report(w)` and the last N lines of `engine.history(w)`, optionally write the full history. Defaults: seed 1, 180 days, last 40. Run it with `</dev/null` (see cli.ts known issues). |
| Text play | `npm run play -- --new --seed 7 --name "Tony Marino" --save my.json` | Old menu-driven game: seven action categories, wait, intel, people, businesses, ledger. Autosaves to `omerta-save.json` (or `--save`) after every action and on quit. Without `--seed` the seed is `Date.now() % 100000`. |
| Bot | `npm run bot -- 3 120` | Policy player for seed/days (defaults 3, 120); prints final stats, action counts, fact kinds and job statuses. |
| Stress | `npx tsx src/stress.ts 1 300` | Random-ish player for seed/days (defaults 1, 300) that starts every affordable racket, runs `consistency.audit()` after every step, and prints rank timings, cash curve, violations and agency stats. No npm script. |
| Play-test | `npm run playtest -- status`, `-- wait 2`, `-- talk Louie`, `-- do <code>`, `-- enc <id> <code>`, `-- take <jobId> yes`, `-- job <id> <approach>`, `-- attend <jobId>`, `-- mchoose <code>`, `-- mclose`, `-- prospects`, `-- sunday`, `-- srule <charId> praise`, `-- man <name>`, `-- who`, `-- leave` | One command per process against seed 3 "Tony Marino"; state and the open conversation/meeting persist in `playtest/state.json`, every command is appended to `playtest/actions.log`. Currently broken on this machine (hard-coded path, see pt.ts). |

---

## web.ts

**Purpose.** The browser entry point and the only module that touches the DOM, `localStorage` and `window`. It owns saving and loading, the turn wrapper `pass()`, the navigation stack, the start screen, the top-level view switch, the action dispatcher and the two event listeners. It also contains a surprising amount of game logic that has no engine home (Sunday rulings, the "next event" wait loop, guide markers).

**Screens rendered directly.** Start screen (`startView`, face chooser using `SKIN_LIST`/`HAIR_LIST`, six backgrounds, name input, New/Continue), the save banner, and the bottom tab bar (`tabs()`, with badges from `attentionCount()` and `newStories()`). Every other screen is delegated by `body()`.

**View variants handled.** All 39 in `body()` ([web.ts:271](../../src/web.ts)). `job`, `approach`, `delegate`, `sendorder`, `report` fall back to Today if the job no longer exists. `tree`, `manage`, `comm` get a back button prepended here.

**Actions emitted.** `look`, `bg`, `new`, `continue` (start screen), `dlsave` (save banner), `tab` (tab bar), plus `story` and `fact` links inside news items built by `collectNews`/`storyLink`.

**State owned.** `S` (shared with all views, defined in state.ts). World fields listed under "UI state vs world state".

**Public API.**

| Export | Description |
|---|---|
| `snapList(): { day; key; label }[]` | Snapshot list from `localStorage`, `[]` if storage throws. Used internally by `load()` and `restore`; `views_b.ts` has its own copy. |

Internal functions worth knowing: `save(): boolean` (wraps `storage.writeSave`, records `S.save`/`S.saveGood`), `downloadSave()`, `load(): World | null` (main save, then newest readable snapshot, never deletes), `collectNews(since)`, `storyLink(fid)` (walks up to 6 causes to find a dispute), `same(a, b)` (view equality ignoring `m` and `convo`), `go(v)`, `tab(name)`, `pop()`, `pass(minutes, lines, next?, from?)`, `doAction(action)`, `talkTo(id)`, `startMeeting(m, fail?)`, `render()`, `handle(a, v)`, `require_plan()` (wrapper over `orders.orderMenu`, with a mid-file import).

**Tick hooks.** None; the engine never calls the UI. The UI drives the clock: `engine.advance` is called from `pass()` (plus a second call for jail), the `waitgo` event loop, `opcount`, the open-encounter branch of `echoose`, the meeting branch of `say`, and the "men are asleep" branch of `meet`. Only `pass()`, `waitgo` and `meet` call `jobs.pruneJobs`; only `pass()` does the jail fast-forward, news digest and chips.

**Depends on / used by.** Imports from actions, crewlife, clubdata, club, core, engine, jobs, career, path, powers2, books, ledger, dialogue, meetings, orders, people, places, notebook, life, politics, revenge, rackets, types, world, reports, disputes, where, rank, storage, background, encounters, sitmoves, and the UI modules. Imported by nothing (it is the bundle entry).

**Invariants & rules.**
- Every click ends in exactly one `render()`.
- Any action that spends game time must go through `pass()` if the news digest, jail check, chips and stack reset are wanted; the six direct `advance` sites skip some of these.
- `pass()` always clears the back stack, so "Back" never crosses a time step.
- Saving is never silent: every outcome is stored in `S.save` and bad outcomes are shown on every screen.
- `Math.random` is used only for the start-screen face shuffle and the new-game seed ([web.ts:365](../../src/web.ts), [web.ts:378](../../src/web.ts)). Both happen before or outside `advance()`; the seed is stored as `w.seed`, so a browser game is reproducible from its save. No `Date` use.

**Save compatibility notes.** Reads and writes only through `engine.serialize/deserialize` and `storage.ts`, so migrations live there. Renaming `KEY` would orphan every existing save (the Continue button checks only `KEY`). Uploaded backups go through the same `deserialize`, so old fixtures load the same way.

**Known issues / gaps.**
- `srule`, `saccall` and the relationship maths for Sunday answers live in web.ts ([web.ts:496](../../src/web.ts)) rather than in `books.ts`/`crewlife.ts`; `playtest/pt.ts` re-implements three of them without the `addFact`, so play-test Sundays leave a different record from browser Sundays. Sunday answers never cost game time, even `beat`, whose `books.rule` result includes minutes that are discarded.
- Sunday progress is UI-only, so reloading during the same Sunday allows each man to be praised or accepted again (trust farming).
- `mopt` applies meeting choices to the world without saving or passing time. Leaving a meeting through the tab bar skips `closeMeeting` (and its time cost); the choices are then persisted by the next unrelated save.
- `doplan` "me" and `shake` create a job and mark it active before the player picks an approach. Backing out leaves an active player job that no Needs entry shows.
- `restore` overwrites the main save immediately with no confirmation. Because snapshots are only taken when the day number advances past the newest snapshot by 3, the newer progress is not snapshotted and cannot be recovered.
- `reset` removes the main save but not the snapshots; after a reset they are reachable only by starting a new game and restoring from Life > More.
- The error handler says "Nothing was lost", but an exception part-way through `handle()` leaves any world mutations already made in memory, and the next `save()` persists them.
- The "Next event" wait stops only when `attentionCount()` rises, the player dies or is jailed; news that is not an attention item does not stop it.
- Unused imports flagged by `tsc --noUnusedLocals`: `approaches`, `startScheme`, `touchDispute`, `crewList`.
- Scroll is reset to the top for Sunday answers (`srule`, `sbooks`, `saccall`, `shand`), notebook toggles and club scene actions, which works against the Sunday screen's stated aim of never losing your place.

## ui/state.ts

**Purpose.** Declares the shape of UI state and the screen union. It is the only module every view shares, and the reason views can read and write UI state without parameters.

**State owned.** The `S` singleton (fields listed in "UI state vs world state").

**Public API.**

| Export | Description |
|---|---|
| `type Tab = 'today' \| 'rackets' \| 'crew' \| 'family' \| 'life' \| 'stories'` | Bottom tabs. |
| `type LifeSub = 'me' \| 'people' \| 'intel' \| 'history' \| 'money' \| 'love' \| 'more'` | Life sub-tabs. `history` has no pill and no renderer. |
| `type View` | 39-variant discriminated union on `t`: `tab, manage, comm, bj, person, biz, fact, tree, menu, wait, job, approach, delegate, sendorder, plan, orders, recruit, dayjob, books, meeting, guests, talk, people, brief, sunday, report, grudges, goals, dispute, story, way, settle, place, places, help, enc, opstart, op, hijack`. `meeting` carries a live `Meeting`, `talk` carries a live `Convo` plus `lines`, `q` and `history`. |
| `S` | Mutable UI state object. |
| `W(): World` | `S.w!` (throws if no game). |
| `P(): Character` | The player character. |

**Tick hooks.** None.

**Depends on / used by.** Type-only imports from dialogue, meetings, orders, types, jobs. Imported by web.ts and links.ts; every other view gets `S`, `W`, `P` re-exported from links.ts.

**Invariants & rules.** `body()`'s switch must stay exhaustive over `View` (TypeScript enforces this through the `string` return type). Views assume `S.w` is non-null; only `render()` checks.

**Save compatibility notes.** Nothing here is saved.

**Known issues / gaps.** `S.sundayDone` and the `history` sub-tab are dead. The `View` values for `meeting` and `talk` hold engine objects that cannot be rebuilt from the world, which is why conversations and meetings do not survive reload.

## ui/links.ts

**Purpose.** Text helpers that every view uses: HTML escaping, turning any known name in engine prose into a tappable link, rewriting the player's own name as "you", and small character badges.

**State owned.** A module-level regex cache `cache: { w, n, re, map }`, keyed by world identity and the combined count of characters and businesses.

**Public API.**

| Export | Description |
|---|---|
| `esc(s: string): string` | Escape `& < > " '`. |
| `pl(c, label?)`, `bl(id, label?)`, `fl(id, label?)` | Person (`ent:`), business (`biz:`) and family (`tree:`) links. |
| `youify(text): string` | Replace the player's name and possessive with "you"/"your", fix a fixed list of verbs (`was, has, is, owes, wants, …`), capitalise after sentence starts. |
| `lk(text): string` | `esc(youify(text))` then wrap every known name (longest first; the player excluded; families as "<name> family"). |
| `chip(c)`, `famClass(id)` | Family badge and CSS class (`f0`–`f4` by family order, `fx` for none). |
| `who(c)` | Link + badge + role ("owns X" or rank). |
| `initials(c)` | Two initials. |
| `statusOf(w, c): { dot; word }` | dead / locked up / laid up / running hot / free. |
| `known(w, c): boolean` | Whether the player has a reason to know the man: self, a relationship entry, same family, or any known fact naming him as actor or victim. |
| `stamp(t)` | `fmtTime`. |
| re-exports | `money`, `S`, `P`, `W`. |

**Tick hooks.** None.

**Depends on / used by.** core (`fmtTime`, `money`, `ownerBiz`), state. Used by every UI module and web.ts.

**Invariants & rules.** The name map keys are escaped names because `lk` matches against escaped text; any change to `esc` must keep that symmetry. `lk` output is HTML; callers that need plain text strip anchors with a regex (`needHtml`, `storiesTab` rows).

**Save compatibility notes.** None.

**Known issues / gaps.** The cache is not invalidated when a name changes without the count changing (renamed business, for instance). The alternation regex grows with every spawned civilian and runs on every `lk` call (dozens per render). `known()` scans all of the player's known facts per call and is called per tree node in `treeView`, which is O(members × known facts). `youify` rewrites the player's name inside quoted NPC speech as well.

## ui/common.ts

**Purpose.** Reusable widgets and the status header.

**State owned.** `sink: { on: string[] | null }`, a global collector that diverts `banner()` output into an array.

**Public API.**

| Export | Description | Emits |
|---|---|---|
| `ICON`, `svg(name, size?)`, `chevron` | Inline SVG icons. | – |
| `sink` | Banner collector; only set by the unused `views_b.racketsView`. | – |
| `banner(id, icon, tone, title, sub, body, mode?)` | Expandable group whose open state is `S.open[id]`. When `mode` is omitted it is guessed from the id prefix (`p:`, `o:`, `op:`, `r:`) and by sniffing `sub` for "running", "out right now" or a leading "0 "/"none". | `tog:<id>` |
| `back(label?)` | Back button. | `back:` |
| `strip()` | Header: game time, cash, heat meter, name/family/district, rank, reputation word, influence word. | – |
| `skillBars(c)`, `skillLine(c)`, `traitTags(c)` | Skills and archetype/trait words. | – |
| `avatar(c)` | `<div class="avatar pt">` around `portrait(c)`. | – |
| `meterRow(label, word, v, tone?)` | Labelled bar. | – |

**Engine calls.** `core.fmtTime/money`, `books.influence/influenceWord`, `jobs.standingWord/traitWords`, `people.skillWord/SKILLS/SKILL_LABEL`, `voice.arch/ARCH_WORD`.

**Tick hooks.** None. **Used by** all view modules and web.ts.

**Known issues / gaps.** Banner mode inference by substring of display text is fragile. `famClass` and `initials` are imported but unused. With `views_b.racketsView` dead, `sink` is dead too.

## ui/views_a.ts

**Purpose.** The home screen and the "sheets" that any name link opens, plus the family tree.

| Function | Renders (View / where) | Emits | Engine calls | Side effects |
|---|---|---|---|---|
| `needs(): Need[]`, `attentionCount()`, `isAttn(n)` | Items for "Needs your attention" and "Opportunities"; tab badge. Open encounters, Sunday, disputes that are the player's move, offered non-stale jobs, unacknowledged reports, late protection payers, troubled crew. | `enc:`, `sunday:`, `dispute:`, `job:`, `report:`, `biz:`, `ent:` | `jobs.staleReason/KIND_LABEL`, `gigs.GIG_LABEL`, `people.lateOf`, `econ.owedOf`, `views_c.myDisputes/playerMoved`, `sunday.sundayDue` | – |
| `todayView()` | `tab:today`. Strip, Just now, chips, news, danger callout, timebar, club scene shortcut, first-week guide, ambition card, needs, interests, coming up, brief/stories shortcuts, action tiles, promotion card or standing table, rank powers, milestones, week's earnings. Death screen when the player is dead. | `reset:go`, `place:club`, `places:`, `tab:*`, `orders:`, `people:`, `shift:`, `dayjob:`, `grudges:`, `bj:`, `cat:work`, `brief:`, `goals:`, `tog:needs`, `guideoff:`, guide steps (`talk:`, `recruit:`, `tab:`, `wait:`) | `danger.dangerLevel`, `career.standingTable/promoSteps`, `path.pathInfo`, `clubdata.clubOf/clubOpen/clubPresent`, `club.waiting`, `books.SOURCE_LABEL`, `brief.comingUp`, `stories.storiesOf`, `pathview.pathCard/powersCard`, `ambview.ambitionCard`, `views_b.timeBar` | – |
| `personView(id)` | `person`. Portrait, status and trait tags, situation texture, how he sees you, where he fits (boss, men, business, family, favours, debts, hustle, skills, pass-up rate), what he has told you, notebook, worked-out insights and record card (own crew), what you know, kin/partner actions, action buttons. Shows little for unknown men. | `npin:`, `ntag:`, `fact:`, `visit:`, `date:`, `talk:`, `orders:`, `tree:`, `books:`, `help:`, `settle:`, `biz:`, `tab:life` | `sitmoves.personTexture`, `encounters.favourWord`, `hustle.hustleLine`, `books.effectiveRate/visibleSources`, `core.factText/ownerBiz`, `notebook.noteOf/TAGS`, `crewlife.WANT_LINE`, `life.kinOf/kinWord/warmthWord/isPartner/stageWord`, `where.whereIs`, `people.PROBLEM_LABEL` | – |
| `encView(id, lines)` | `enc`. Encounter text and options. | `echoose:`, `back:` | – | – |
| `favoursCard()` | Embedded in Life > Money. | – | `encounters.owedTo/owing/favourWord` | – |
| `bizView(id)` | `biz`. Owner, protection, manager, stakes, previous owners, trade and gossip (if owner known), late-payer callout. | `shake:`, `orders:`, `talk:`, `plan:lean\|<biz>`, `plan:burgle\|<biz>` | `people.lateOf`, `econ.owedOf/trade/perf`, `where.whereIs` | – |
| `factView(id)` | `fact`. Text as the player knows it, source, cause chain (up to 4 known causes), parties, who else knows. | links | `core.factText` | – |
| `treeView(famId)` | `tree` and embedded in the Family tab. Boss, underboss, capos with soldiers, associates and runners, open seats, queue positions, inter-family tension words. | `tree:`, `ent:` | `career.members/capOf/seats/isRunner/vacancy`, `family.queueOf` | – |
| `tensionWord(a, b)` | calm / uneasy / tense / on a war footing from `fam.tension`. | – | – | – |

**State owned.** None of its own; reads `S.log`, `S.chips`, `S.news`, `S.routine`, `S.open.needs`, `S.seenBrief`.

**Tick hooks.** None. **Depends on / used by.** Imports listed above plus views_b, views_c, stories, family, pathview, ambview, brief, sunday, common, links. Used by web.ts and views_b.ts (`favoursCard`, `treeView`).

**Invariants & rules.** Person sheets only show trust/respect/grudge, what he told you and what you know for men `known()` to the player, which is the UI side of the knowledge-is-a-mechanic rule. Fact text is always rendered via `factText(f, k.knowsActor)` so unknown culprits stay unknown.

**Known issues / gaps.**
- The business sheet's "Lean on it" and "Other ideas" buttons emit `plan:lean|<bizId>` / `plan:burgle|<bizId>` ([views_a.ts:301](../../src/ui/views_a.ts)). The `plan` handler turns that into `{ t: 'plan', idx: NaN, who: <bizId> }`, and `planView` finds no `S.planOpts[NaN]`, so both buttons always show "That moment has passed."
- Today says routine matters are "filed under History" ([views_a.ts:98](../../src/ui/views_a.ts)), but there is no History sub-tab.
- The guide's "Talk to another man in the family" step is satisfied by talking to anyone other than the boss, and "Take on a first piece of work" by any non-navigation action on a job screen, including turning the job down.
- Unused (per `tsc --noUnusedLocals`): the `politics` import on line 18, `storiesTab`, and a local `mine` in `personView`.

## ui/views_b.ts

**Purpose.** The bulk of the screens. Most functions are one screen each.

| Function | Renders | Emits | Engine calls | Side effects |
|---|---|---|---|---|
| `menuView(kind)` | `menu`: `S.opts` for one action kind. | `opt:i` | – (labels from `CATS`) | – |
| `waitChoices(full?)`, `waitView()`, `timeBar()` | `wait` and the Today timebar: an hour, the next two of morning/afternoon/evening/late, next event, next Monday 09:00, plus two days and a week in the full list. | `waitgo:i`, `wait:` | – | – |
| `racketsView()` | **Unused.** Older Rackets tab built from banners; web.ts imports the views_c version. | `tog:`, `op:`, `opstart:`, `hijack:`, `job:`, `plan:`, `scheme:` | `orders.orderMenu`, `jobs.schemes/ventureOf`, `rackets.OPS/OP_GROUPS` | Sets `S.planOpts`, `S.schemeMoves`, `sink.on`. |
| `planView(idx, whoId?)` | `plan`: do it myself, or send a crew man (aptitude, reliability, busy state). | `doplan:` | `people.aptitude`, `orders.reliability`, `jobs.activityOf` | – |
| `ordersView(whoId)` | `orders`: choose a man, or that man's order menu grouped into banners. | `orders:<id>`, `plan:i\|<id>`, `tog:o:*` | `jobs.activityOf`, `orders.orderMenu` | Sets `S.planOpts`. |
| `jobView(j)` | `job`: kind, source, brief, giver, target, place, pay, deadline, notes; questioning options; summons go/excuse; do it / delegate / turn down / drop. | `jx:`, `attend:`, `excuse:`, `mine:`, `deleg:`, `pass:`, `drop:` | `gigs.GIG_LABEL/GIG_HELP`, `jobs.KIND_LABEL/KIND_HELP/canQuestion/jobChecks` | – |
| `approachView(j)` | `approach`: approaches. | `go:` | `jobs.approaches` | – |
| `delegateView(j)` | `delegate`: crew picker. | `who:` | `jobs.activityOf` | – |
| `sendView(j, c)` | `sendorder`: quiet or hard. | `send:` | `jobs.traitWords` | – |
| `reportView(j, lines)` | `report`: crew report, question him, acknowledge. | `qrep:`, `ack:` | – | – |
| `crewView()` | `tab:crew`: crew overview stats and table, each man with flags, last Sunday's envelopes, run-the-crew tiles, crew moves, put forward / take on. | `ent:`, `books:`, `orders:`, `meet:crew`, `meet:dinner`, `recruit:`, `cmove:i`, `rec:`, `recr:` | `jobs.activityOf/crewMoves`, `books.effectiveRate`, `orders.prospects`, `career.recommendable/recruitable` | Sets `S.moves`. |
| `crewTrend(c)` | Envelope trend flag used by `crewView`. | – | – | – |
| `recruitView()` | `recruit`: prospects at `RECRUIT_COST`. | `hire:` | `orders.prospects/RECRUIT_COST` | – |
| `dayjobView()` | `dayjob`: current job or offers. | `shift:`, `quitjob:`, `takejob:i` | `orders.dayJobOptions` | Sets `S.jobOpts`. |
| `booksView(id, lines)` | `books`: declared/paid history, flags, audit, rewards, rulings. | `audit:`, `reward:`, `rule:` | `books.effectiveRate/RULINGS`, `career.rewardOptions`, `jobs.traitWords` | – |
| `helpView(id, lines)` | `help`: troubled crew man. | `helpdo:` | – | – |
| `talkView(v)` | `talk`: portrait, mood, folded history, current exchange, grouped options; used options are disabled and carry no `data-a`. | `say:i` | `dialogue.options`, `actions.grudgeWord` | Sets `S.dopts`. |
| `peopleView()` | `people`: known men grouped by where they are now. | `ent:` | `where.whereIs`, `core.ownerBiz` | – |
| `placesView()`, `placeView(id)` | `places`, `place`: barber, bar, and the club (delegated to `clubView`). | `place:`, `club:shave/drink/sit`, `talk:` | `places.PLACES/isOpen/present`, `voice.arch/ARCH_WORD` | – |
| `grudgesView()` | `grudges`: men who hurt the player (known culprit, not own family) or whom he holds a grudge against. | `perm:`, `settle:` | `core.factText`, `politics.isMade/sanctioned` | – |
| `meetingView(v)` | `meeting`: attendees, what happened, current item and options, summary when over. | `mopt:i`, `mdone:` | `meetings.current` | – |
| `guestsView(picked)` | `guests`: up to four of the 14 most trusted. | `gpick:`, `ghost:` | `meetings.available` | – |
| `familyTab()` | `tab:family`: strip, hunt banners and promotion queue (own family), tree, organisation record card, call on the family, shops list. | `story:hunt:<fid>`, `meet:family`, `tog:shops` (+ tree/queue codes) | `orgs.orgRecord`, `family.queueView`, `views_a.treeView` | – |
| `lifeTab()` | `tab:life` with sub-tabs Me (stats, specialisations, skills, standing, reputation lines, day job, home, patrons), People (filtered relationships), Intel (disputes list and known facts), Money (own envelope stance, recent weeks, favours, debts, lending candidates), Romance, More (save, reset, backup, snapshots). | `lsub:`, `pf:`, `dayjob:`, `ent:`, `fact:`, `stance:`, `talk:`, `askout:`, `dateplan:`, `steady:`, `marryask:`, `wed:`, `baby:`, `breakoff:`, `save:`, `reset:`, `dlsave:`, `ulsave:`, `restore:` | `specs.*`, `books.influence/influenceWord/effectiveRate`, `econ.stakesOf/owedOf`, `background.bgLabel`, `career.careerLines`, `crewlife.repLines`, `life.datingPool/DATES/kinWord/stageWord/warmthWord`, `storage.readSnaps` | Romance calls `datingPool` (rng, may spawn characters). |
| `opStartView(kind)` | `opstart`: cost, typical week, heat, district pills, runner, start. | `opdist:`, `oprun:`, `opgo:` | `rackets.OPS/canStart` | Sets `S.opDist` to the first district if the current one is invalid. |
| `opView(id, lines, found?)` | `op`: racket figures, count, rulings on skim, close. | `opcount:`, `oprule:`, `opclose:` | `rackets.OPS` | – |
| `hijackView(picked)` | `hijack`: pick two or three free men. | `hjpick:`, `hjgo:` | – | – |
| `settleView(id, lines, kill?)` | `settle`: why, grudge words both ways, options. | `sv:` | `revenge.settleOptions`, `core.rel` | `rel()` creates relationship entries both ways. |
| `VIA`, `CATS`, `crewList()`, `WaitOpt` | Labels, the kind menu table, live crew list. | – | – | – |

**Tick hooks.** None. **Depends on / used by.** Imports listed above plus views_a, views_c, clubview, family, common, links. Used by web.ts and views_a.ts (`timeBar`).

**Invariants & rules.** Conversation options marked `done` are rendered disabled with no action code, which is how "used options grey out and give no benefit until a new conversation" is enforced in the UI. Crew men who are busy or hurt get disabled buttons without `data-a`.

**Save compatibility notes.** None directly; `datingPool` writes `w.life.pool`.

**Known issues / gaps.** `racketsView` is dead (about 70 lines) and is the only user of `sink`. `snapList` duplicates web.ts's. `job` and `sentence` locals are unused. `import` statements appear mid-file (line 501). Render-time `datingPool` and `rel()` calls mutate the world (see "UI state vs world state").

## ui/views_c.ts

**Purpose.** The current Rackets tab, built around a catalogue of "ways to earn" (`ways.ts`), plus milestones, dispute pages and the seat story.

| Function | Renders | Emits | Engine calls | Side effects |
|---|---|---|---|---|
| `racketsView()` | `tab:rackets`: earnings, running ways, crew out on jobs, catalogue by category with Running/Ready/Locked badges, the hidden side racket. | `way:`, `job:` | `orders.orderMenu`, `rackets.OPS/canStart`, `jobs.schemes`, `people.lateOf`, `ways.WAYS/WAY_CATS`, `books.SOURCE_LABEL` | Sets `S.planOpts` via `bucket()`. |
| `wayView(id, lines?)` | `way`: how it works, pays, needs, risks, advice, then the concrete options for that way (running ops, shops to lean on, late payers, loans, cars, burglary, scams, favours, hijack, fencing). | `plan:i`, `opstart:`, `op:`, `cat:lend`, `hijack:`, `scheme:i` | `ways.wayById`, `rackets.OPS/canStart`, `jobs.schemes/ventureOf`, `people.lateOf` | Sets `S.planOpts`, `S.schemeMoves`. |
| `goalsView()` | `goals`: milestones for the player's rank band, progress, rewards, done list. | – | `ambition.progress/bandOf` | – |
| `myDisputes(w)` | Disputes involving the player, his men or shops he collects from. | – | – | – |
| `disputeView(id, lines)` | `dispute`: stage, parties, terms, history, actions. | `dv:talk/look/sit/settle/ignore` | `core.famName` | – |
| `disputesList()` | Embedded in Life > Intel. | `dispute:` | – | – |
| `seatStoryKeys(w, p)`, `seatStage(w, p, rank)` | Seat stories from known `seat:*` facts and the pending seat request. | – | – | – |
| `storyExists(w, key)` | Whether a story key still resolves. | – | – | – |
| `playerMoved(w, d)`, `stageOf(w, d)` | Whose move it is in a dispute, and its stage text (reads `w.pending`). | – | – | – |
| `storyView(key)` | `story`: seat stories here; `dNN` → `disputeView`; other keys → `stories.storyPage`. | `talk:`, `tab:family` | – | Sets `S.seen[key]` for dispute keys. |
| `WORD` | Dispute status labels. | – | – | – |

**Tick hooks.** None. **Depends on / used by.** Imports books, core, jobs, orders, people, rackets, politics, types, ambition, ways, disputes, common, links, stories. Used by web.ts, views_a, views_b, stories.

**Known issues / gaps.** Circular import with stories.ts (each imports the other; safe only because nothing is used at module load). Mid-file imports at line 235. The `fence` status line has identical branches. `disputesOf`, `ownerBiz`, `pl`, `ago`, `isMade` are imported or defined only to be `void`ed.

## ui/stories.ts

**Purpose.** Assembles "stories", the player's ongoing matters, from many engine structures and presents them with a timeline and suggested actions. It is the main place where the UI decides what the player is aware of, so it filters facts through `p.known` throughout.

**Story sources.** `huntStories` (families whose `hunt.target` is the player, with hunters from `w.threats`), `threatStories` (`danger.dangerLevel`), `turfStories` (`w.situations` of kind `turf`), `disputeStories` (`myDisputes` plus recently dropped own disputes), `crewStories` (revealed problems, money flags, recent help), `debtStories` (active or defaulted debts involving the player), `matterStories` (other situations visible to the player via `sitmoves.visibleTo`), and seat stories. Afterwards every story's timeline is merged with known facts tagged `f.story === key` from the last 120 days, and a story is marked "You acted … Waiting on the other side" if the player's own tagged `favour` fact is newer than anything the other side did.

**Public API.**

| Export | Description | Emits |
|---|---|---|
| `interface Story` | `key, kind, title, stage, tone, closed?, last, lastText, timeline, blurb?, why?, actions?` | – |
| `storiesOf(w): Story[]` | All stories, sorted red, amber, other, closed, then by recency. | – |
| `isNew(s)` | Moved since `S.seen[key]`. | – |
| `newStories(w): number` | Tab badge: running stories that moved since the story or the list was last seen. | – |
| `storiesTab()` | `tab:stories`. | `story:<key>` |
| `storyPage(key)` | Story page. | each story's `actions[].a`: `talk:`, `ent:`, `grudges:`, `mv:<sitId>\|<code>\|<who>` |

**Side effects.** `storiesTab` sets `S.seenTab = w.now`; `storyPage` sets `S.seen[key] = w.now`.

**Engine calls.** `danger.dangerLevel/LADDER_WORDS`, `people.PROBLEM_LABEL`, `sitmoves.movesFor/visibleTo/isParty/knownFacts`, `situ.isOpen/titleOf`, `core.shortTime`.

**Tick hooks.** None. **Used by** web.ts (`newStories`, `storiesTab`), views_a, views_c, brief.

**Invariants & rules.** Only facts in `p.known` appear in timelines and blurbs; matter stories never reveal outcomes ("Only what you know is shown, never how it will end").

**Known issues / gaps.** `storiesOf` runs on every render (for the tab badge) and scans `Object.values(w.facts)` once per story, so render cost grows with facts × stories. Seen markers are UI-only, so all stories become "new" after reload.

## ui/brief.ts

**Purpose.** The weekly brief: the latest Herald issue (`w.papers`), the player's week compared with the last `w.snaps` entry, news since then, still-brewing stories, coming events and pinned people.

**Public API.** `comingUp(): { t; text }[]` (open world events from `w.events` within the last day onwards, plus loan payments due to the player within 4 days; max 6; also used by Today), `briefView()` (`brief` view; emits `story:`, `ent:`).

**Side effects.** `briefView` sets `S.seenBrief = w.now`.

**Engine calls.** `core.fmtTime/money/shortTime`, `notebook.pinned`, `stories.storiesOf`.

**Tick hooks.** None; the papers and snapshots it shows are produced by the engine's weekly tick. **Used by** web.ts, views_a.

## ui/sunday.ts

**Purpose.** The Sunday envelope screen, designed so the player can deal with every crew man on one page.

**Public API.**

| Export | Description |
|---|---|
| `sundayDue(): boolean` | `w.sunday` exists, `S.sundaySeen < w.sunday.t`, and the player has crew. Drives the Sunday need and club shortcut. |
| `sKey(id)` | `"<w.sunday.t>:<id>"`, the key for per-man Sunday UI state. |
| `sundayView()` | `sunday` view. Envelope totals, "accept all in order", one card per man (`manCard`), what men told you, insights about wants, and the player's own envelope with hand-over buttons and stance pills. |

**Emits.** `ent:`, `sbooks:<id>`, `srule:<id>|<code>` with codes `accept`, `keep`, `praise` (envelope in order), `warn`, `demand`, `forgive`, `shout`, `raise`, `beat`, `cut` (light envelope; `demand`/`shout`/`beat` also offered after a books check finds a flag), `saccall:`, `shand:all|half`, `stance:`, `back:`.

**Engine calls.** `books.envelopeSum/kickWindow`, `crewlife.crewOf/openSunday/WANT_SHORT/knows`, `ledger.previous/statement`.

**Side effects during render.** On the first render of a given Sunday (`S.sundayHeard !== w.sunday.t`) it calls `openSunday(w, p)` (sets `w.sunday.seen`, applies learned insights), stores the lines in `S.sundayLines` and resets `S.sundayRes`, `S.sundayBooks`, `S.sundayMine`. Every render sets `S.sundaySeen`.

**Tick hooks.** None; `w.sunday` is built by the engine's weekly tick. **Used by** web.ts, views_a, clubview.

**Known issues / gaps.** See web.ts: the rulings themselves are implemented in web.ts, answers do not cost time, and per-Sunday progress resets on reload. `name` in `manCard` is unused. `manCard` nests a `pl()` anchor inside another `ent:` anchor.

## ui/family.ts

**Purpose.** The promotion queue shown at the top of the Family tab.

**Public API.** `interface QRow { c; r: Readiness }`; `queueOf(w, fid, rank?): QRow[]` (members of one rank, excluding runners, sorted by eligibility then readiness score; also used by `treeView` to annotate positions); `queueView()` (top five plus the player's neighbourhood, open seats, the player's blockers; emits `rival:<id>`).

**Engine calls.** `career.eligible/isRunner/LADDER/members/readiness/seats/capOf`.

**Tick hooks.** None. **Used by** views_a, views_b.

## ui/pathview.ts

**Purpose.** Rank progression and rank powers, and the boss-only management screens.

| Function | Renders | Emits | Engine calls |
|---|---|---|---|
| `pathCard()` | Road to the next rank: goals with progress, trial status, chair options. | `chair:` | `path.pathInfo/chairOptions` |
| `powersCard()` | What the rank allows: current and earlier powers, boss buttons, lifestyle purchases, who owes you (`w.path.ledger`), make a man. | `power:`, `manage:`, `comm:`, `buy:`, `raise:` | `path.powerOptions/raisable`, `powers2.lifeOptions` |
| `manageView()` | `manage`: every family member with rank pills. | `setrank:` | `career.members`, `path.RANKS` |
| `manageExtras()` | Consigliere/heir buttons; move soldiers between capos. | `consig:`, `heir:`, `setboss:` | `career.members` |
| `commView()` | `comm`: other bosses with support level, proposals. | `court:`, `propose:` | `powers2.commOf/supportOf/supportWord/proposals` |

**Tick hooks.** None. **Used by** web.ts, views_a. **Known issues.** `ledgerOf` imported but unused.

## ui/clubview.ts

**Purpose.** The family social club: opening hours, the club scene in progress (`w.scene`, rendered from `club.sceneNode`), the Sunday shortcut, men waiting for a word and others in the room.

**Public API.** `clubView()` (rendered for `place` with id `club`). Emits `cend:stay|leave`, `cact:<code>`, `sunday:`, `cscene:<id>`, `back:`.

**Engine calls.** `club.clubOf/clubOpen/clubPresent/sceneNode/topicsFor/waiting`, `core.fmtTime`, `sunday.sundayDue`.

**Tick hooks.** None. **Used by** views_b (`placeView`). **Notes.** Club scenes are World state, so they survive reload, unlike conversations.

## ui/ambview.ts

**Purpose.** The ambition card on Today: pick one of `ambition.AMBS`, then see progress and a "Next" button.

**Public API.** `ambitionCard()`. Emits `amb:<kind>` and the progress object's `next.a` (`tab:crew`, `tab:rackets`, `tab:life`, `tab:family`, `recruit:`, `way:bookie`, `way:protection`).

**Engine calls.** `ambition.AMBS/ambProgress`. **Used by** views_a.

## ui/blackjack.ts

**Purpose.** Casino lobby and table screens for the engine's blackjack game.

**Public API.** `bjLobby()` (`bj` without id; emits `bjt:`, `cat:gamble`), `bjTable(id)` (`bj` with id: house rules, current hand from `w.bj`, hit/stand/double, bet pills; emits `bjact:`, `bjbet:`), `bjDeal(id, bet)` → `blackjack.deal(w, P(), w.biz[id], bet)`, `bjAct(what)` → `blackjack.act(W(), P(), what)`.

**Engine calls.** `blackjack.act/cardName/casinos/deal/rulesFor/total`. **Used by** web.ts.

**Notes.** `bjTable` injects a `<style>` block with hard-coded card colours that ignore the dark-mode tokens. The hand lives in `w.bj`, so it survives reload.

## ui/portrait.ts and ui/portraits_pack.ts

**Do not modify.** CLAUDE.md: "Portraits must not change." The code and its output are frozen; this section is description only.

**Purpose.** `portrait(c: Character): string` paints a 64×64 SVG "oil sketch" for any character: background lamp and smoke, shoulders and clothing chosen by rank (suits for bosses and capos, open shirts and jackets for associates, civilian colours), head shape, hair style and colour, brows set by violence and sociability, eyes or dark glasses, nose, mouth and smile, facial hair, scars, cigar, hat, a bruise and plaster while `c.hurtUntil > W().now`, then lighting, optional venetian-blind shadows, canvas noise and vignette. Women (first name in `world.FEMALE`) get different clothing and hair.

**Determinism.** Randomness comes from a local hash PRNG (`hashOf` FNV-1a over `c.look.seed ?? c.id`, then an integer mixer), never from `w.rng`, so drawing portraits never disturbs the simulation. The player's `Look` (skin, hair colour, style, beard, glasses, jaw, seed) overrides the hashed choices.

**Public API.** `SKIN_LIST`, `HAIR_LIST` (palettes used by the start-screen chooser), `portrait(c)`. `portraits_pack.ts` exports `PACK: { src; tier: 'top' | 'mid' | 'low' }[] = []`; when non-empty, `portrait` returns an `<image>` chosen by rank tier and id hash instead of painting.

**Depends on / used by.** links (`famClass`, `W`), portraits_pack, world (`FEMALE`), types. Used by common (`avatar`) and web.ts (palettes).

**Known issues (report only, do not fix here).** `aria-label="${c.name}"` is unescaped (see "Escaping"). SVG element ids are `p<hash(c.id)>…`, so the same man drawn twice on a page duplicates ids (harmless because the definitions are identical). The local `fam` is computed and never used. Each portrait carries several filters including `feTurbulence`, and every click re-renders every portrait on the page, which is the heaviest part of a render on long lists (recruit, plan, grudges).

## web/template.html

**Purpose.** The page shell that the bundle is appended to: `<title>Omertà</title>`, UTF-8 and viewport meta (`viewport-fit=cover`, plus `claude:viewport-fit-sides` for the claude.ai host), a Google Fonts stylesheet (Big Shoulders Display, Public Sans), one `<style>` block and `<div id="app"></div>`.

**Theming.** Colours are custom properties on `:root` (`--bg`, `--card`, `--soft`, `--line`, `--ink`, `--muted`, green/brass/red/blue with soft variants, family colours `--f0`–`--f4`, `--fx`, fonts `--display`/`--body`). Dark values apply under `@media (prefers-color-scheme: dark)` unless `[data-theme="light"]`, and under `:root[data-theme="dark"]`. No code sets `data-theme`; it is there for a host to set. Layout is mobile-first: `#app` max 560 px with safe-area padding, a fixed six-column bottom tab bar, body bottom padding to clear it, 44 px minimum touch targets.

**Known issues / gaps.** No `<!doctype html>`, `<html>` or `<body>`: hosts that wrap the page (claude.ai artifacts) add a skeleton, but the GitHub Pages `index.html` copy renders in quirks mode. `--dim`, `--fg` and `--accent` are used but never defined (`--accent` has a fallback). `.pers .chooser` never matches because the chooser is not inside `.pers`. `.bar` and `.avatar.pt` are declared twice. The paper and blackjack cards use fixed light colours in dark mode. The fonts are an external request, so the page is not fully offline.

## cli.ts

**Purpose.** Two commands: `sim` runs the world with no player and prints `engine.report(w)` and the tail of `engine.history(w)`; `play` is the original text-mode game.

**Public API.** None (script). Options parsed from argv: `--seed`, `--days`, `--last`, `--out` (sim); `--new`, `--seed`, `--name`, `--save` (play).

**Engine calls.** `world.createWorld`, `engine.advance/report/history/serialize/deserialize`, `actions.generate/perform/describe/grudgeWord`, `core.factText/famName/fmtTime/money/shortTime`.

**Play loop.** Status line, seven action categories (socialise, lend, collect, shakedown, gamble, retaliate, work) using `actions.generate` top 9, waits of 1 h, 4 h, until 09:00, 3 days, and read-only views (intel, people, businesses in district, ledger). After each action: `perform`, `advance(t0 + minutes)`, print new non-minor facts, save. Jail is skipped through automatically.

**Tick hooks.** None; drives `advance`.

**Known issues / gaps.**
- The readline interface on stdin is created at module load ([cli.ts:39](../../src/cli.ts)), even for `sim`. With stdin open (an interactive terminal), `sim` prints its report and then does not exit until stdin closes (Ctrl-D) or it is interrupted. Confirmed by running `sim --days 2` with an open pipe: output complete, process still alive after 35 s. Use `npm run sim -- … </dev/null`.
- `play` predates jobs, dialogue, encounters, meetings and rackets; socialising is a bare action with no conversation, and `jobs.pruneJobs` is never called. It is not a substitute for the browser game.
- `Date.now()` is used only as the default seed for `play`.
- `ownerBiz` imported but unused.

## bot.ts

**Purpose.** A crude player policy (`tsx src/bot.ts [seed=3] [days=120]`) that checks the job system works end to end: attends 80% of summons and plays meetings with random options, ignores, declines (hits), delegates or personally resolves offered jobs, sometimes runs schemes, changes stance, audits and rules on crew books, calls crew meetings, hosts dinners and raises conversation topics, then advances at least 12 hours per loop.

**Engine calls.** `meetings.*`, `jobs.approaches/assign/performMove/resolve/schemes/startScheme/takeJob/topicOptions`, `books.RULINGS/auditMember/influence/rule/setStance`, `engine.advance`, `world.createWorld`.

**Invariants & rules.** All bot decisions use `w.rng`, so a given seed always produces the same run, but the bot's choices consume the world's random stream (its run is not comparable to a no-player `sim` of the same seed).

**Known issues / gaps.** Declining a hit sets `j.status = 'declined'` directly instead of calling `jobs.declineJob`, so any consequences of declining are skipped. `crewMoves` imported but unused.

## stress.ts

**Purpose.** Long-run stress run (`tsx src/stress.ts [seed=1] [days=300]`): answers every open encounter randomly, skips summons and 30% of other offered jobs, declines hits directly, delegates or personally resolves the rest, starts any affordable racket with 50% chance, sends lean-on orders, runs schemes, advances at least 12 hours, and calls `consistency.audit(w)` after every step to tally violations. Prints alive/dead, day, rank timings, cash, standing, heat, ambitions done (`Object.keys(w.goals.done).length` against `AMBITIONS.length`), NPC deaths and murders, max family tension, cash curve every 50 days, action counts, open encounters/ops/threats, violations and agency ask stats.

**Engine calls.** `ambition.AMBITIONS`, `jobs.*`, `encounters.choose`, `engine.advance`, `rackets.OPS/canStart/startOp`, `orders.orderMenu/giveOrder`, `consistency.audit`, `world.createWorld`.

**Notes.** `Date.now()` measures elapsed wall time only. Same direct `j.status = 'declined'` shortcut as bot.ts. No npm script.

## playtest/pt.ts

**Purpose.** An unassisted play-test harness: each invocation runs one player command against a persistent world (seed 3, "Tony Marino"), prints the result, appends the command to `actions.log` and saves. The commands are restricted to what a player can do, and the file header promises no direct edits to trust, cash or relationships.

**State owned.** `playtest/state.json` holds `{ world: serialize(w), convo, lastWait, meet }`. Unlike the browser, it persists the open `Convo` and `Meeting`.

**Commands.** `status`, `wait [days]` (advance in 60-minute steps until the attention count rises or a new Sunday starts), `talk <name>`, `do <code or label>`, `leave`, `enc <id> [code]`, `take <jobId> yes|no`, `job <id> [approach]`, `attend <jobId>`, `mchoose <code|index>`, `mclose`, `prospects`, `sunday`, `srule <charId> accept|praise|shout`, `man <name>`, `who`.

**Engine calls.** `engine.advance/serialize/deserialize`, `world.createWorld`, `dialogue.arrive/options/say/startConvo/introduced`, `actions.generate/perform`, `encounters.choose`, `jobs.takeJob/declineJob/staleReason/approaches/resolve`, `where.whereIs`, `ledger.statement`, `crewlife.crewOf`, `core.rel/clamp`, `orders.prospects`, `meetings.*`.

**Known issues / gaps.**
- `DIR` is hard-coded to `/home/claude/omerta/playtest` ([pt.ts:21](../../playtest/pt.ts)). On this machine `npm run playtest -- status` fails with `ENOENT … /home/claude/omerta/playtest/state.json`, and the committed `playtest/state.json` and `actions.log` are never read. Deriving the directory from `import.meta.url` would fix it.
- `playtest/` is outside `tsconfig.json`'s `include: ["src"]`, so `npm run typecheck` does not check it.
- `srule` duplicates three of web.ts's Sunday answers but adds no fact and does not record that the man was answered, so it can be repeated and leaves a different trace from the browser.
- `talk` duplicates `web.ts talkTo()`; the two can drift.
- `do`, `mchoose` and `mclose` silently do nothing when there is no open conversation or meeting, but still log and save. `recruitProspect` is imported but there is no hire command.

## How this group connects to the rest

- **Clock:** UI action → `pass()` → `engine.advance` → the engine's think/daily/weekly ticks; then `jobs.pruneJobs` and `reports.relevance` decide what news the player sees.
- **Persistence:** `save()` → `engine.serialize` → `storage.writeSave` (read-back verified, snapshots); `continue`/`restore`/upload → `engine.deserialize` (migrations live there).
- **Knowledge:** every news item, person sheet, fact sheet, story timeline and brief is filtered through `p.known` and `core.factText(f, knowsActor)`; `links.known()` gates how much of a person sheet is shown.
- **Conversation:** `talkTo`/`doAction` → `actions.perform` (quiet socialise) → `dialogue.arrive`; each `say:i` → `dialogue.say`, which may return a `Meeting` (→ meeting view) or end the conversation.
- **Commitments:** offered jobs, reports and encounters reach the player only through `needs()`; answering goes to `jobs.*`, `orders.*`, `encounters.choose`, `meetings.*`.
- **Money:** the UI never moves money itself except in the Sunday `keep` answer (direct `cash` transfer recorded with `ledger.post`); everything else goes through engine functions (`books.handOver`, `rackets.*`, `life.*`, `blackjack.*`, `orders.recruitProspect`).
- **Render-time engine effects:** `life.datingPool` (rng, spawned civilians), `crewlife.openSunday` (`w.sunday.seen`, insights), `core.rel` in `settleView`.
- **Guide and ambition:** `handle()` writes `w.goals.done['g:*']` and `p.ambition`; `ambition.ambProgress` and `career`/`path` functions feed the Today cards.

## Replacing this system

A drop-in replacement front end (a framework UI, a native app, a test driver) has to provide:

- **The turn wrapper.** `pass()` semantics: `advance`, `pruneJobs`, jail fast-forward, news digest via `reports.relevance` over facts newer than the start time, delta chips, then save. The `waitgo` "next event" loop and the "men are asleep, wait until 14:00" crew-meeting retry are also UI logic today.
- **Logic that currently lives only in web.ts.** Sunday answers `accept`, `keep`, `praise`, `shout`, `cut` and `saccall` (relationship deltas, cash transfer, arrears, `leaveCrew`, the `favour` fact), the `addFact` calls after `audit`, `rule` and `srule`, the guide markers in `w.goals.done`, setting `p.ambition`, acknowledging reports, creating "do it myself" jobs from `OrderOpt.make`, and the summons-to-meeting mapping in `attend`. These should move into engine modules before any replacement, or they will be duplicated again (pt.ts already has a drifted copy).
- **Render-time side effects the engine relies on.** `openSunday` must be called when the player first sees a Sunday; `datingPool` must be called before showing the romance list. A replacement that only reads would never mark `w.sunday.seen` or generate a pool.
- **The engine surface the UI uses.** About 250 distinct imported symbols (functions, label tables, constants) from 43 modules; the action table above lists the mutating ones and the per-view tables list the read-only ones. The World fields read directly are wide: `chars`, `biz`, `fam`, `facts`, `jobs`, `enc`, `debts`, `favours`, `ops`, `disputes`, `situations`, `pending`, `threats`, `events`, `papers`, `snaps`, `sunday`, `scene`, `bj`, `life`, `goals`, `path`, plus many `Character` fields (`known`, `rels`, `books`, `career`, `problem`, `insight`, `notes`, `ambition`, `job`, `look`, `cooldown`).
- **Storage.** The `omerta-save-v3` / `omerta-snaps-v1` / `omerta-snap-<day>` keys, or existing players lose their games.

What makes it hard:

- **No view-model layer.** Views read raw World structures and call engine helpers inline, so the UI contract is "the whole World".
- **Index-based actions.** `say:i`, `plan:i`, `opt:i` and friends depend on arrays captured in `S` during the last render. A UI that renders lazily or out of order must carry stable ids instead.
- **Strings as the interface.** Engine functions return prose `lines` containing names; linkification relies on a regex over every name in the world, and some engine strings reach the DOM unescaped.
- **Global mutable singletons.** `S`, `sink` and the link cache are module-level, imported everywhere; views write to them while rendering.
- **Circular imports inside the UI.** views_a ↔ views_b and views_c ↔ stories, with mid-file imports in web.ts, views_b and views_c. They work only because nothing is called at module load.
- **Transient engine objects in UI state.** `Convo` and `Meeting` live only in `S.view`, so conversations and meetings cannot survive reload or be shared with another front end without being moved into the World (pt.ts shows one way: serialise them alongside the world).
