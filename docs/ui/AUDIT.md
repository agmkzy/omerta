# UI/UX rebuild: Stage A audit

Branch `ui-rebuild`, from `main` at 7c1810c (Gate 4 live).

**Method:**
- Every route in `src/web.ts` (`handle()`, 120 action codes) and every view (`src/ui/*`, 41 screens) was read.
- The game was played in the browser at 1440×900 and 375×812 on the `play.localhost` test save (day 61, an associate of the Corrente family with a racket, a loan and a crew).
- The current simulation is the source of truth: the conversation layer (`conv/visit.ts`), the ledger and books, debts, favours and memos, stories and situations, ranks and families.

## 1. What exists

### Screens and routes

| Section | Screens (view type) | Reached from |
|---|---|---|
| World (`tab:today`) | Today: just now, word reaches you, let time pass, first-week guide, Needs you, Opportunities, Go and do something, lately heard, Herald link. Side: where you stand, career, coming up, this week | rail, tabs |
| | `wait`, `menu` (lay low), `places`, `place`, `people` (who's where), `bj` (blackjack), `brief` (Herald), `enc` (an approach), `job`/`approach`/`delegate`/`sendorder`/`report`, `dayjob`, `grudges`, `settle` | Today tiles and rows |
| People (`tab:people`) | At home (kin, partner, dating), the people you know (filter by family, pinned). Side: who's where, pinned | rail |
| | `person` (his page), `talk2` (the conversation) | any name link |
| Family (`tab:family`) | rooms: Your men (`crewView`), The family (`familyTab`: trees, families, shops) | rail |
| | `books`, `help`, `orders`, `plan`, `recruit`, `meeting`, `guests`, `sunday`, `manage`, `comm`, `tree` | Family rows, Today |
| Business (`tab:business`) | rooms: Rackets (`racketsView`: your rackets, ways to earn), Money (`businessRoom`: envelope, what's owed, who could use a loan). Side: hidden racket, your books, Sundays past | rail |
| | `way`, `opstart`, `op`, `hijack`, `biz` | Rackets |
| Journal (`tab:journal`) | rooms: Stories, What you know. Side: how to read, notebook, scores to settle | rail |
| | `story`, `dispute`, `fact` | Stories, news, links |
| You (`tab:life`) | your page: standing, the road ahead, ambition, specialities, saves and backups | portrait in rail/top bar |
| Opening | title, making the man (name, look, history) | no game loaded |

### Gameplay systems reachable from the UI

- conversation (Business / Personal / Confront, his asks, approaches)
- jobs: offered, approach, delegate, report
- rackets and ways to earn; protection, loans, stakes
- Sunday envelopes and books
- crew management: orders, help, recruit
- meetings: crew, family, dinner, induction, sit-down
- disputes and settling scores
- stories and matters (moves, asks)
- the family trees and powers (manage, Commission)
- legit work
- places and the club
- blackjack
- life: kin, dating, marriage, children
- ambitions and career
- notes and pins
- saves, snapshots and backups

## 2. Findings

### A. The conversation does not look or work like the approved design (highest priority)

1. **No context panel.** The header shows a portrait, a family chip, the place, and one italic line about how he sees you. Nothing on screen says what is between you, though the game knows it: money owed either way, favours, his business, what you have been told, what he wants.
2. **Choices are unnumbered rows,** with no keyboard shortcuts. The three headings are pills, and "Other business…", "Something else" and "Leave" are bare text links in another row. There are three kinds of control for one decision.
3. **No defined reading area.** Every line said so far is stacked as a scrolling log, with the speaker's name repeated over each line. Arrival can show three unconnected lines in a row ("Where've you been keeping yourself?" / "I don't offer twice." / "I don't forget a thing like what you did.").
4. **The ▲▼ effect cards** (Trust ▲ · −$110) sit inline with speech, styled like speech.
5. **Mobile:** the conversation is an ordinary scrolling page. The section tabs stay on screen, the header scrolls away, and the choices move down the page as the log grows.
6. **The wrong section is lit:** the rail shows **World** while you talk to anyone, even when you came from People.

### B. Information the player needs but can't easily find

1. **Where the money comes from** is shown in three places that disagree:
   - Rackets: "Earning this week: $0. Nothing yet."
   - World side: "$0 this week so far".
   - Money side: "Shops paying you: 1, $50 a week".

   All three appear while a $50-a-week protection racket and a loan paying $60 a week are running. None says what last week came to, or what is expected from each source.
2. **What is owed either way** is split up:
   - Money lists each favour as its own row ("Richie DeSantis owes you a favour" three times).
   - The person page lists "Owes you / a big one / a small one / a small one" and "Owes Dante Sanfilippo $399", naming the player instead of "you".
3. **Promises and obligations.** Your word to a man (memos) appears only on World, and only within three days of falling due. Promises made to you, and promises not yet due, have no screen.
4. **Who has authority over whom** is clear in the tree, but a man's page shows "Answers to" only in the side column, below the fold on a phone.
5. **What NPCs want from you:** "Looking for you" (social requests) shows on World only. A man's page doesn't say he is waiting on you.

### C. Redundant menus and extra steps

1. Four layers to say something to a man: name → his page → "Go to … and talk" → heading → subject.
2. On his page, "Take action against him" is a second wine-coloured primary button beside "Talk".
3. "Find someone" (World tile) and People's "Who's where" are the same screen behind two names.
4. A conversation's "Other business…" and "Something else" both lead to everything else.

### D. Inconsistent presentation

1. Two stylesheets' worth of tokens (`--om-*` from V86 and `--bg/--ink/...` from V88) plus overrides from V89, V90 and overhaul F, in one 999-line `<style>`. There are 444 class names, many styled two or three times. Seven web fonts are loaded; one (Big Shoulders) is never used.
2. Section headings take three forms: `h2.sect` with a rule, card `h2` in caps, and `.lf-side` headings.
3. Buttons take five forms: `.btn.primary` (wine), `.btn`, `.pill`, `.more` (text), and `.go` (tiny caps).
4. The family card reads "At the head for years", missing its number, beside "The Corrente family." repeated under the heading.
5. The person page's meters show "Grudge: None" with a red bar partly filled.

### E. Actions that are hard to discover

1. The hidden racket is described on Business but set up "from 'Make a side arrangement' under World", a different section.
2. Lending: "Who could use a loan" is under Business › Money, but the act happens in a conversation.
3. Powers (manage, Commission) appear only once you hold rank, and only as rows inside the career card on your own page.
4. Keyboard: in the conversation there are no number keys and no Escape to leave. Focus is lost on every redraw (`innerHTML`), so a keyboard user starts from the top each turn.

### F. Obsolete architecture still visible

1. **`ui/state.ts`:**
   - `Tab` still lists `rackets`, `crew`, `stories` (pre-overhaul names), and `LEGACY` maps them;
   - `View` has `{ t: 'talk2' }` commented "behind a switch";
   - `lifeSub`, `LifeSub`, `roomOf`, `lsub` keep the V89 Life tab's four rooms alive as aliases.
2. **Dead code.** `racketsView` is defined twice (`views_b.ts` and `views_c.ts`; only `views_c` is used). `favoursCard` is never called. `clubview.ts` and `cscene` handle the retired club small talk.
3. **The conversation CSS** still carries V89 `talkview.ts` rules (`.cv-*` from the old scene) under the new screen.
4. **Code mentions of retired names:** "Needs you, on this page, says what wants doing. Rackets says how to earn." (the new-game line in `web.ts`), and the guide's "Rackets, under “Shops you could lean on”".

### G. Desktop and mobile usability

1. **Desktop:** the main column is capped narrow (about 560px) at 1440 wide, leaving a large empty band between the content and the side column. The conversation uses a third of the screen.
2. **Mobile:**
   - conversation regions aren't stable (above);
   - the top bar truncates the district ("Benson…");
   - section tabs show inside scenes (conversation);
   - the side column is appended below every screen, so a person's ties and notes come after his action buttons.
3. **Safe areas:** handled for the tab bar, but not for a fixed conversation layout, which doesn't exist yet.

## 3. Navigation: decision

The five sections stay: **World, People, Family, Business, Journal.** They match the approved design and the simulation's own divisions: the street and time, men, the organisation, money, the record. What changes is what belongs where, and how a screen says which section it belongs to.

| Section | Purpose | Surfaces | Main actions | Connects to |
|---|---|---|---|---|
| **World** | What wants you now, and time | what just happened and why (the outcome of your last act, its consequences), who is looking for you, needs and opportunities, places, letting time pass | answer, go and see him, wait, go somewhere | People (a face → his page or the conversation), Journal (follow a story) |
| **People** | The men and women in your life | everyone you know, with a status and what is between you; who's where; home and family | **talk** (one tap from the list), his page | Conversation; Family (his place in the tree); Business (debts) |
| **Family** | The organisation and your place in it | your men (what each is doing, earning, owing), the families and their trees, Sunday, powers when you have them | orders, books, Sunday, meetings, recruit | People; Business (kick-ups) |
| **Business** | Money: where it comes from and where it goes | this week and last week by source, rackets, the envelope, what is owed in money either way | start or run a racket, lend, handle the envelope | People (who owes), Journal (a debt's story) |
| **Journal** | What is in motion and what you know | stories, **your word** (promises you made and were made, favours either way), what you know | follow, act from a story | everything |

**Changes with a clear usability benefit:**
- A conversation and a man's page light **People**, not World.
- **Favours and promises** get one home: Journal › *Your word*. The person page's "Between you" shows everything with that man.
- The money summary is one model (`ui/money.ts`), used by Business, the World side column and the rail, so the figures agree.
- The hidden racket's set-up link is shown where it is described.

## 4. Design language

The approved conversation mockup is the reference: near-black ground, muted gold, warm cream type, a serif for anything told (names, headings, speech, choices), a plain sans for anything read as information, typed figures for money and dates, and hairline borders. The decisions:

- **Tokens.** One set on `:root`:
  - ground `#0d0c0b` / rail `#121110` / raised `#17150f`;
  - cream `#eadfc8` / secondary `#bfb39c` / muted `#8e8473`;
  - gold `#c9a35e` / gold-2 `#e0c389`;
  - wine `#7a2230` for the one decisive act;
  - danger `#d0695d`;
  - hairline `rgba(234,223,200,.09)`.
- **Type.**
  - Cormorant Garamond for display, names, speech and choices;
  - Libre Franklin for UI text;
  - Courier Prime for figures and dates;
  - UnifrakturCook for the brand and the Herald only.

  Big Shoulders, Public Sans and Old Standard are dropped (Old Standard stays for the Herald body).
- **Components.** One of each:
  - page heading;
  - section heading (small caps, gold, with a rule);
  - row list;
  - key-value list;
  - **choice list** (numbered, label plus hint, used by the conversation, encounters, meetings and jobs);
  - **context box** (gold rule and mark: information, never speech);
  - chip;
  - meter (word plus bar, the bar only when the word is not "none");
  - primary, secondary and quiet buttons.
- **Layout.**
  - Desktop: rail 260px, content fluid up to 760px, context column 300px.
  - Phone: a fixed top bar and bottom tabs. Scenes (the conversation, meetings, encounters) take the whole screen in three fixed regions.
