# OMERTÀ UI/UX rebuild: final report

Branch `ui-rebuild` from `main` at 7c1810c, the Gate 4 deploy. The audit and the design decisions behind it are in `docs/ui/AUDIT.md`. The screenshots below are in `docs/ui/screens/`.

## 1. What changed

### Stage A: the design system
- **One token set.** `web/css/tokens.css` defines the palette, the four type families, spacing, shape, motion and the frame widths. The V86 `--om-*` set and the V88 `--bg/--ink/…` set are gone, along with their aliases.
- **The stylesheet left the page shell.** All CSS is now in `web/css/`, in order:
  - tokens, base, components;
  - shell, conversation;
  - screens, herald, opening.

  `web/main.ts` imports the files, the build inlines them into the single page, and `vite.config.ts` places the inlined stylesheet after the meta tags.
- **The 999-line layered `<style>` is retired.**
  - 306 rules no screen uses any more are deleted.
  - The rest moved to the file it belongs to, on the new tokens.
  - `legacy.css` no longer exists. Fonts go from seven families to five.
- **Components (`src/ui/kit.ts`, styled by `components.css`).** Every screen is written with these:
  - a page title and section headings;
  - rows (face or mark, kicker, title, sub, end value, one action);
  - a key/value list;
  - **numbered choices** (label and hint, with way-out, unavailable, picked, danger and lead states, and a figure to name);
  - the **context box** (information, never speech);
  - a chip, a meter (a bar only when there is something to show), buttons (primary, ordinary, quiet, danger), a segmented choice, pills, a card, a callout, a fold.

### Stage B: the conversation (`src/ui/talk2.ts`, `web/css/conversation.css`)
- **Desktop, to the approved design:**
  - the left rail;
  - the man at the top (portrait, name, rank chip, where and when, district);
  - *How he sees you* and *What you know* beside him;
  - his words in a reading area marked by a gold rule, with earlier exchanges dimmed above;
  - the ▲▼ record of what changed kept apart from speech;
  - a **context box** of what stands between you;
  - numbered choices, with the way out last.
- **What stands between you** (`src/ui/between.ts`) is read only from records the player is a party to:
  - money either way;
  - favours, said once ("three favours, the largest a big one");
  - a place of his that pays you or your man, and what it is behind;
  - who answers to whom;
  - what he is waiting on you for;
  - the words on record between you (promises, threats, terms).

  His page reads the same function, so the two never disagree.
- **Phone: three fixed regions.**
  - The man at the top, with a ☰ that opens what you know of him **over** the reading box, so nothing moves.
  - A bounded dialogue box that scrolls on its own and keeps the newest exchange in view.
  - The choices anchored at the bottom, at the same height every turn.

  The section tabs and the top bar step aside. Measured over three turns with 4, 7 and 4 choices, the three regions stay at the same pixels: 0–170, 182–382, 390–812 on a 375×812 screen. Safe-area insets are respected, and on short screens the context box moves behind the ☰.
- **Keyboard:**
  - 1–9 choose;
  - Escape takes the way out (or Back);
  - ↑/↓ move between choices;
  - focus lands on the first choice after each turn when the keyboard is in use.

  This applies on **every** screen with numbered choices, not only the conversation.

### Stage C: the shell (`src/ui/layout.ts`, `web/css/shell.css`)
- **Every screen names its section.** The map is typed over every view, so a new screen cannot be added without one. A conversation and a man's page light People (they lit World before); books and orders light Family; a racket lights Business; a story lights the Journal.
- **The rail follows the mockup:** brand, you, the hour and district, cash in typed figures, heat, reputation and influence, the five sections, and Save with when it last saved.
- **The phone bar** shows the money, the day and hour in full, and the district beside the heat. The district was cut off before.
- **Width.** The desktop content column is fluid up to 780px (860px on wide screens) beside a context column. A conversation takes the full width.
- **One Back button** everywhere.

### Stage D: People, Family, Business
- **His page:**
  - who he is (chip, role, status and temperament in words);
  - one primary act ("Talk", where he is), then orders and books for your own man;
  - "Take action against him" demoted from a second wine-coloured button to a quiet danger button;
  - *Between you*, the same facts as the conversation;
  - *How he sees you*, with meters that show no bar when the answer is "none";
  - beside it: *Where he fits*, *What he has told you*, *Your notes*, *What you know*.
- **People:** every row has his face, what he is, how he stands with you, and the first thing between you ("owes you $399").
- **Family › Your men:** one row per man with what he is doing, how he pays, last Sunday's envelope and what is wrong, with his three acts under his name. The separate envelopes card, which repeated the same men, is gone. *Run the crew* and *Build your crew* are rows. The family card now says "In the chair: since before your time" (it said "At the head for years").
- **Money in one account (`src/ui/money.ts`):**
  - what comes in each week, by source (protection, each racket, loans, your men's envelopes, the side deal);
  - what goes out (your envelope, what you are paying back);
  - this week so far, and last week.

  Business › Money, the Rackets side panel and World's side column all read it, so "$0 this week" no longer sits beside a racket paying $50 a week. The hidden racket's card offers "Make a side arrangement" where it is described (it pointed to "under World" before).
- **Every decision screen is numbered choices:** jobs and approaches, delegation and orders, reports, a man's trouble, his books, legit work, places, scores to settle, meetings, dinner guests, starting a racket, a racket's count, hijackings, the card tables, dates and marriage, ambitions, powers, saves and backups. The old `.opt` lists are gone.

### Stage E: World, Journal, cross-system navigation
- **World:**
  - danger as a context box;
  - *Just now* with what it changed directly under it (cash, heat, standing, rank);
  - *Word reaches you* with "Because →" reasons;
  - *Needs you* and *Opportunities* as rows with the man's face when a man has come to you;
  - *Lately you've heard* as rows that lead to the story.
- **Journal:** three rooms.
  - **Stories**, as rows. A story's page puts his question as numbered choices and *What you can do* as numbered choices, and each person in it is one tap from a conversation.
  - **Your word (new):** favours either way, what you promised, what you were promised, agreed terms and hard words, all from the records. A kept promise is not listed.
  - **What you know**, grouped by day.
- **Person → conversation → decision → consequence → record:**
  - every row with a man leads to his page or straight to him;
  - "Who's where" and the people in a story go **straight to the conversation**;
  - a business leads to its owner, and an event to the story it belongs to;
  - consequences show on World as what changed, and on the story.

### Stage F: phone, accessibility, regression
- **Phone, checked at 375×812 and 320×568:**
  - the conversation;
  - World, People, his page, Family, Rackets, Money;
  - Stories, *Let time pass*.

  None scrolls sideways. Touch targets are 44px or more, and choices 58px.
- **Accessibility:**
  - labelled regions and lists (the conversation, its reading area as a polite live region, the choices);
  - `aria-current` on sections, `aria-pressed` on toggles and picks, `aria-expanded` on folds;
  - one focus ring for everything;
  - keyboard choice on every decision screen;
  - reduced motion respected.
- **Obsolete code removed:**
  - the duplicate `racketsView`, `favoursCard`, the old Life tab (`lifeTab`, `LifeSub`, `S.lifeSub`), the empty `strip()`;
  - the V89 conversation CSS;
  - every `.opt` list;
  - the token aliases;
  - `legacy.css`.

### Things the UI showed that the player could not know (fixed)
- **A man's page listed his debts with third parties** ("Owes Dante Sanfilippo $399"). It now shows only money between him and the player.
- **An event's page named the man who did it** even when the player didn't know it was him. It also listed **who else knows** of the event. The first now needs the player to know; the second is gone.

## 2. Screenshots
| Before | After |
|---|---|
| `before-conversation-desktop.jpg` | `conversation-desktop.jpg`, `conversation-desktop-business.jpg` |
| `before-conversation-mobile.jpg` | `conversation-mobile.jpg` |
| `before-person-desktop.jpg` | `person-desktop.jpg` |
| `before-money-desktop.jpg` | `money-desktop.jpg` |
| | `world-mobile.jpg` |

## 3. Testing
TESTING

## 4. Limitations
- **Some section pieces kept their own markup.** These are the family tree, the ways-to-earn cards, the first-week guide, Sunday at the club, the road to the next rank and the Herald. They are restyled on the tokens, but not rebuilt on the components, because each is a one-off layout with no shared component.
- **The keyboard picks from the first numbered list on a screen.** A story with both a question and *What you can do* shows the second as plain rows for that reason.
- **The browser checks used a fresh test game** (day 7, two men, no rackets) on `play.localhost`. The test save from Gate 4 was lost when the app restarted. Screens that need a long game (a broken promise, a quarrel, a crew in arrears) are covered by the interface tests and Gate 4's scenarios, not re-played here.
- **A simulation bug found along the way is left to its own task:** "Collect on a favour" collects from men the player owes (`powers2.ts`). It is being fixed in a separate session.
