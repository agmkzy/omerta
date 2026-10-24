# Gate 4: dependency audit and migration inventory

*Written from the code on `conversation-rebuild` at 7072e71, before any change. "Status" is updated as each stage lands.*

## 1. What the old conversation system is

| File | Lines | What it is |
|---|---|---|
| `src/dialogue.ts` | 2,846 | The old engine: menus (`options`, `optionsRaw`, `hub`, `focused`, `groupRows`, nodes), the patience model (`govern`), repetition memory (`POLICY`), arrival (`arrive`), and `sayRaw`: about 130 interactions, each mixing the decision, the words and the gameplay effect. Also two pieces of world logic that live here by accident: `introduced()` (who the player has met) and `memoTick()` (promises falling due, called by the engine every day). |
| `src/flows.ts` | 370 | 25 follow-up exchanges for `dialogue.ts`: being backed, promotion, thin ice, a rival's ear, warning a rival, recruiting, orders that meet resistance. Same mixture. Only `dialogue.ts` imports it. |
| `src/talk.ts` | 626 | "What is on his mind": 9 subjects (troubles, shop, racket, wants, opinions, family, boss, telling on a man, who leans on him), each with its own replies and consequences. Already subject-shaped; used by `dialogue.ts`, the new screen, `clubview.ts` and `web.ts`. |
| `src/threads.ts` | 375 | 5 more subjects registered into `talk.ts`: his light envelopes, a debt either way, work he did for you, something that happened, which places are hurting. |
| `src/ui/talkview.ts` | 184 | The old screen. |
| `src/web.ts` (parts) | ~120 | The old screen's routes: `goSee`/`arrive`, `sayIt`, `raiseMatter`, `say`/`sayamt`, the `talkm` link, the club's "sit with", the `?talk=` switch. |

## 2. Classification

- **A. Presentation (to remove):**
  - `ui/talkview.ts`;
  - the old routes in `web.ts`;
  - the `?talk=` switch and its links (`talk2.ts`, `views_a.ts`);
  - in `dialogue.ts`: `options`, `optionsRaw`, `hub`, `focused`, `groupRows`, `openers`, `leadPuts`, `doorLabel`, `matterWhere`, `talkRows`, `putRows`, `focusTitle`, `openSubject`, `matterOpen`, `markStories`'s menu marks, `INTENTS`/`GROUPS`/`PLACE`/`GRP`, `isNavCode`, `usedKey`, the `Convo`/`DOpt`/`FollowOpt`/`Said` types, `lighten`, and the `n:`/`f:`/`sub:` navigation codes;
  - the `Convo`/`DOpt` view state in `ui/state.ts`.
- **B. Conversation decisions (to migrate into the conversation layer, rules unchanged):**
  - every `sayRaw` and `flows` case's decision: who agrees, admits, lies, pays or gives in, mostly a roll on the world's seeded random generator against a stated formula;
  - `govern` (patience, coldness, ending a conversation, a man breaking in with his own matter);
  - `POLICY` (what he remembers being asked, and when it is worth asking again);
  - `openness`, `holdsBack`, `told` (what he will say, and how);
  - `arrive`'s reminders (a promise falling due, a favour he owes, a broken word);
  - the subjects of `talk.ts` and `threads.ts`.
- **C. Gameplay execution (to keep, called from the conversation layer).** All of it already lives outside the old engine, except where marked:
  - `jobs.ts`: `takeJob`, `declineJob`, `bossOffer`, `tipFrom`, `oppFrom`, `mkJob`;
  - `asks.ts`: `openAsk`, `askBetween`, `playerMove`, `playerMoves`, `nameFigure`, `rateAsk`, `amendsAsk`, `callFavour`;
  - `econ.ts`: `bizMove`, `takeFromBiz`, `clearArrears`, `giveTime`, `evidence`, `owedOf`, `priceOf`, `stakeRoom`, `setCollector`;
  - `core.ts`: `payDebt`, `restructure`, `writeDown`, `createDebt`, `repute`, `earn`, `learn`, `addFact`, `feel`, `bear`, `ease`;
  - `encounters.ts`: `addFavour`, `choose` (an encounter answered);
  - `meetings.ts`: `openSitdown`;
  - `books.ts`: `handOver`, `envelopeDue`, `kickWindow`, `react`;
  - `people.ts`: `helpMan`;
  - `situations.ts`: `askAbout`, `helpWith`;
  - `matters.ts`: `matterAct`;
  - `disputes.ts`: `amends`, `playerActed`, `touchDispute`;
  - `actions.ts`: `share`, `confide`;
  - `powers2.ts`: `historyLines`;
  - `memory.ts`: `recall`;
  - `temper.ts`: `noteConduct`;
  - `crewlife.ts`: `learnAbout`, `repLines`;
  - `exchange.ts`: replies to a point made in a matter.

  **Gameplay written inline in `sayRaw` with no function of its own**, to extract into functions:
  - money handed over (`help_gift`, `drink`, `b_extra`, `b_tribute`, `a_gift`, `rv_drink`, `sh_back`, `demand` repayment);
  - the chop-shop venture (`partner_chop`);
  - protection fee changes (`terms_cut`, `terms_raise`, the fee deal);
  - debt easing (`d_time`, `d_half`, `d_favour`, `d_forgive`, `d_ask`);
  - heat and side income (`assign_low`, `assign_hustle`);
  - introductions (`intro`, `intro_via`);
  - job refusal (`refuse`), report (`report`);
  - memo records (promises, threats, agreements);
  - rival tension (`rv_warn`).
- **D. Shared infrastructure (kept as is):**
  - character, relationship, fact, job, debt, favour and memo records;
  - `voice.ts`/`voicesheet.ts` (a man's way of saying things, used by twenty world modules);
  - `negotiate.ts`;
  - the seeded random generator;
  - save/load.
  - **Two pieces move out of `dialogue.ts`:** `introduced()` and `memoTick()`, because the world needs them.

## 3. Migration inventory

**Where everything goes:**
- *Replacement* names the conversation-layer module: `conv/acts/*.ts` (new), `conv/visit.ts` (subjects, approaches, opening, patience), `conv/subjects/*.ts` (`talk.ts`/`threads.ts` moved).
- *Pane* is where the subject appears: B = Business, P = Personal, C = Confront, "his" = he raises it himself, "follow" = only as an answer to what he just said.

### 3.1 Personal and information (Stage A)

| Legacy interaction | Handler | Gameplay dependency | Replacement · pane | Status |
|---|---|---|---|---|
| How are you keeping | `how` | relationship, follow-ups to his wound, shop, money | `acts/personal` · P | migrated (Stage A; parity) |
| What happened to you / the shop / can I help | `f_hurt`, `f_biz`, `f_help` | `feePosition`; leads to incident or help | `acts/personal` · follow | migrated (Stage A; parity) |
| Slip him $200 | `help_gift` | cash moves, relationship, conduct "generous" | `acts/personal` · P/follow | migrated (Stage A; parity) |
| Lend him money as a friend | `help_loan` | `asks.openAsk('lend')` → a matter | `acts/personal` · P/follow | migrated (Stage A; parity) |
| Welcome back / congratulate | `welcome`, `congrats` | relationship | `acts/personal` · P | migrated (Stage A; parity) |
| Reminisce | `old_times` | relationship, `actions.share` (passes news, may open an incident) | `acts/personal` · P | migrated (Stage A; parity) |
| Stand him a drink ($40) | `drink` | cash, relationship, `share` | merged with the layer's "Let me buy you a drink" (`doSpend`), keeping the $40 and the trust | migrated (Stage A; parity) |
| Heard anything? | `chat` | `openness`, `share` (passes facts, may open an incident), daily cooldown | merged with the layer's "What's new?" | migrated (Stage A; parity) |
| What do you want out of all this | `ask_want`, `f_want` | `learnAbout('want')`, memo "question" | `acts/personal` · P (`talk.ts` "wants" also covers it) | migrated (Stage A; parity) |
| How does he get on with the others | `ask_crew` | `learnAbout` ties, rivals, loans | `acts/personal` · P (own crew) | migrated (Stage A; parity) |
| His view of a man | `pick_member` → `about:<id>` | `learn` a fact he knows | `acts/personal` · P (a subject per man) | migrated (Stage A; parity) |
| The leadership | `leaders` | none (his view) | `acts/personal` · P | migrated (Stage A; parity) |
| What people say about me / where from | `ask_rep`, `f_rep_who` | `repLines`, trust in a source | `acts/personal` · P | migrated (Stage A; parity) |
| What's between us | `ask_history` | `historyLines`, respect | `acts/personal` · P | migrated (Stage A; parity) |
| Ask around about him (a stranger) | `ask_around` | none | `acts/personal` · P | migrated (Stage A; parity) |
| Introduce yourself / through a man | `intro`, `intro_via` | `p.intro`, `lastMet`, cooldown, relationship | `acts/personal` · stranger opening (replaces the layer's simpler introduction) | migrated (Stage A; parity) |
| A recent incident | `pick_incident` → `inc:<fact>` | `learn`; he may lie (`denied`) or admit | `acts/info` · P (a subject per incident) | migrated (Stage A; parity) |
| Who / how much / witness / source / view / more / involve / can be done / why / how it came about / claims / the owner | `who`, `how_much`, `witness`, `source`, `view`, `tell_more`, `involve`, `can_do`, `why`, `p_how`, `p_claim`, `p_owner` | `learn`, `holdsBack`, trust in witnesses | `acts/info` · follow (the incident's own questions) | migrated (Stage A; parity) |
| Press his denial / let it drop | `press`, `drop` | `learn`, grudge | `acts/info` · follow | migrated (Stage A; parity) |
| Own up / deny it was you | `own`, `lie` | grudge, relationship | `acts/info` · follow | migrated (Stage A; parity) |
| I'll find out who / I'll speak to him / a sit-down | `find`, `speak`, `sitdown` | memo "question"; `mkJob('handle')` + memo "promise"; `openSitdown` (a meeting) | `acts/info` · follow | migrated (Stage A; parity) |
| Who he suspects → that man | `suspect`, `tell`, `exon`, `handle`, `mediate2` | `learn`, `bear`, `ease`, `mkJob`, grievance + `openSitdown` | `acts/info` · follow | migrated (Stage A; parity) |
| Mediate his feud | `mediate` | grievance + `openSitdown` | `acts/info` · P | migrated (Stage A; parity) |
| His trouble (situation) | `sit_ask`, `sit_cover`, `sit_lend`, `sit_rival`, `sit_leave` | `situations.askAbout`, `helpWith` (money, loan, a rival's heat) | `acts/personal` · P/follow | pending |
| Something you heard about him / a matter he is in | `mt:<matter>:<code>` | `matters.matterAct` | `acts/info` · P | pending |
| What is on his mind | `tk:*` (`talk.ts`, 9 subjects) | as each subject's replies (loans, favours, jobs, notes, grudges) | `conv/subjects/life.ts` · P / "he raises it" | pending (already used by the new screen, through the old engine) |
| A rival family's man: gossip, drink, mood, favour | `rv_ears` (+trade/pass), `rv_drink`, `rv_mood`, `rv_favour` | `learn` facts both ways, cash, favour, heat | `acts/personal` · P | migrated (Stage A; parity) |

### 3.2 Money and business (Stage B)

| Legacy interaction | Handler | Gameplay dependency | Replacement · pane | Status |
|---|---|---|---|---|
| How's business | `op`, `biz_none` | `confide`; may reveal a side operation (fact) or open an incident | `acts/business` · B | pending |
| Earnings / what's owed | `earn` | none (his account) | `acts/business` · B | pending |
| Ask for a smaller share | `rate_ask` | `asks.rateAsk` → a matter | `acts/business` · B (boss) | pending |
| Chop-shop partnership | `partner_chop` | cash $2,000, a venture record, memo | `acts/business` · B | pending |
| Move goods for you | `partner_fence` | `jobs.oppFrom` | `acts/business` · B | pending |
| Cut / raise his protection fee (and the haggle) | `terms_cut`, `terms_raise`, `deal:take/hold/drop/nothing/remember` | the fee, memo, fact "terms", favour, grudge, fact "protection_refused" | `acts/business` · B (collector) | pending |
| Protection put to a shop | `suggest` | `asks.openAsk('protect')` | already the layer's own (`doProtect`) where it may be put; otherwise `acts/business` · B | pending |
| Borrow from him | `borrow` | `asks.openAsk('borrow')`, cooldown | `acts/business` · B | pending |
| Buy the place / a piece / run his racket / sell him yours | `buy_ask`, `stake_ask`, `run_ask`, `sell_ask` | `asks.openAsk('buy'/'run'/'sell')` | `acts/business` · B | pending |
| Offer him a loan | `offer_loan` | `asks.openAsk('lend')` | `acts/business` · B | pending |
| A matter between you (a figure, a move, an answer to his point) | `f:m:<matter>`, `mv:`, `x:`, `nm:` | `asks.playerMove`, `nameFigure`, `exchange.reply` | `acts/business` · B/follow | pending |
| The shop that pays you: how, why late, ears, hand back, time, lean | `sh_how`, `sh_why`, `sh_ears`, `sh_back`, `sh_time`, `sh_lean` | `evidence`, `bizMove`, `giveTime`, `takeFromBiz`, `clearArrears`, `earn`, `repute` | `acts/business` · B (`sh_lean` C) | pending |
| Debts: remind, time, halve, favour, forgive, pay, settle, ask for time, put money down | `d_remind`, `d_time`, `d_half`, `d_favour`, `d_forgive`, `d_pay`, `d_all`, `d_ask`, `deal:part` | `payDebt`, `restructure`, `writeDown`, favour, `repute` | `acts/business` · B (`d_remind` C) | pending |
| A debt as a conversation | `tk:debt:*` (`threads.ts`) | as above | `conv/subjects` · B | pending |
| The envelope / extra / tribute | `b_envelope`, `b_extra`, `b_extra2`, `b_tribute` | `books.handOver`, cash, `lifetimeKick`, `repute`, favour; may pass news or a job | `acts/business` · his/B (boss) | pending |
| Call in a favour he owes | `favcall:<favour>` | `asks.callFavour` + `playerMove` | `acts/business` · B | pending |

### 3.3 Organisation (Stage C)

| Legacy interaction | Handler | Gameplay dependency | Replacement · pane | Status |
|---|---|---|---|---|
| Is there work / what he needs done / more | `work`, `b_need`, `b_more` | `jobs.bossOffer`, `tipFrom`, `oppFrom` | `acts/org` · B | pending |
| Work he offers: take it / not this time | `f:job:` → `jobtake`, `jobpass` | `takeJob`, `declineJob` | `acts/org` · his | pending |
| Report on work done | `report` | `j.reported`, relationship, `repute` | `acts/org` · B (first, when due) | pending (already surfaced, through the old engine) |
| Ask why / refuse an order | `challenge:<job>`, `refuse:<job>` | relationship; refusal: `j.status = declined`, `repute` | `acts/org` · C | pending |
| Where you stand / advancement | `b_stand`, `promo`, `fl:promo_*` | `pathInfo`, `readiness` (read only) | the layer's `doAdvance` (Gate 3) · B | partly done |
| Put in a word for me | `recommend` | memo "favour", the boss's respect | `acts/org` · B | pending |
| Back me / what has he said / call in, take, haggle | `rk_back`, `rk_back_ask`, `fl:back_*` | `p.backer`, favours, memos | `acts/org` · B | pending |
| A concern about a man | `pick_concern` → `concern:<id>` | `books.react` (a superior acts on skimming), grudge | `acts/org` · B | pending |
| Your own man: keep head down / extra income (and resistance) | `assign_low`, `assign_hustle`, `fl:ord_*` | heat, side income, grudge | `acts/org` · B | pending |
| Your own man: what's wrong, help, light envelope, look into it, money, thin ice | `cr_ask`, `cr_cash`, `cr_duties`, `cr_drop`, `cr_look`, `cr_money`, `cr_thin`, `fl:th_*` | `helpMan`, problem revealed, notes, restraint, threat fact | `acts/org` · P/C | pending (`cr_drop`, `cr_thin` reach Confront through the old engine) |
| His light envelopes as a conversation | `tk:earn` (`threads.ts`) | the books, skimming admitted, payments | `conv/subjects` · C | pending |
| Work he did for you | `tk:job:` (`threads.ts`) | `questionReport` | `conv/subjects` · B | pending |
| Take a man on | `recruit_offer`, `fl:rc_*` | `asks.openAsk('recruit')`, $150 | `acts/org` · B | pending |

### 3.4 Confrontation, amends and his own requests (Stage D)

| Legacy interaction | Handler | Gameplay dependency | Replacement · pane | Status |
|---|---|---|---|---|
| Demand an explanation | `demand:<fact>` | repayment, grudge, memo "threat" | `acts/confront` · C | pending |
| You told me it wasn't you | `confront:<fact>` | `learn`, grudge, relationship | `acts/confront` · C | pending |
| Clear the air: own up, pay, he started it, I'd do it again, what's he got against me, a drink | `a_own`, `a_pay`, `a_start`, `a_defy`, `a_ask`, `a_gift` | `asks.amendsAsk`, `disputes.amends`, grudge, memo "threat", cash | `acts/confront` · C/P | pending |
| I let you down (a broken word) | `word_make`, `fl:word_*` | `asks.amendsAsk` | `acts/confront` · C | pending |
| What's outstanding between us / tell him what you found | `memo:<memo>`, `answer:<memo>` | memo done, `learn`, `bear`, `repute` | `acts/confront` · B | pending |
| Warn a rival off (and ease it) | `rv_warn`, `fl:rv_ease` | family tension, grudge, threat fact | `acts/confront` · C | pending |
| He wants a word (an encounter): what's it about, wait, not now, his options | `apx:*`, `f:enc:` → `enc:<id>:<option>` | `encounters.choose` | `acts/confront` · his | pending (raised by the new screen, through the old engine) |
| The rules around every exchange | `govern`, `POLICY`, social caps, conduct, the ▲▼ card, `recall`, story facts | patience, cooldowns, trust caps, `noteConduct`, `addFact` | `conv/acts/kit` + `visit.ts` | migrated (Stage A; parity) |
| The opening | `arrive` | `t.talk` stamps, shut cooldown | `visit.ts` `open` | pending |

### 3.5 World logic misplaced in the old engine

| Function | Used by | Move to | Status |
|---|---|---|---|
| `introduced`, `introducers` | `web.ts`, the old screen, the new screen | `src/acquaint.ts` | migrated (Stage A; parity) |
| `memoTick` | `engine.ts` (daily) | `src/memos.ts` | migrated (Stage A; parity) |

## 4. Save state

| Field | Written by | Classification |
|---|---|---|
| `Character.talk` | `POLICY`, `talk.ts`, `threads.ts`, `flows.ts` stamps, `arrive` | **Still required** (the migrated code keeps writing and reading it, with the same keys) |
| `Character.memos` | promises, threats, agreements, questions, favours | **Still required** (`memoTick` reads them) |
| `Character.denied` | `inc` (a lie on record) | **Still required** (the layer's Confront reads and writes it) |
| `Character.insight`, `notes` | `talk.ts` notes, `learnAbout` | **Still required** |
| `Character.cooldown` keys (`soc:`, `socw:`, `chat:`, `rep:`, `intro:`, `shut:`, `cut:`, `rate:ask`, `borrow:`, `sd:`, `sitask:`) | the old engine | **Still required** (same keys, same meaning) |
| `World.social` (`talks`, requests, obligations…) | the conversation layer | **Required for every game**: created for old saves on load (migration) |

The old screen's own state (`Convo`, `DOpt`) was never saved; the view is not part of a save. **Nothing saved is dropped.**
