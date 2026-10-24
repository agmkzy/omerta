# Gate 3: Business, Personal, Confront

*The new conversation screen, reworked to the brief "Gate 3 Conversation Interface Redesign". It sits behind the existing switch (`?talk=new`, or the link on the Today page). The old screen is untouched and stays the default.*

## What was wrong first

In an ordinary game the new screen offered almost nothing: "What's new?", "Let me buy you a drink" and, under "Something else…", "I need $500". The new engine only knew the matters the conversation layer models (promises, disputes, requests, protection, a loan). Everything else lived only in the old engine (`dialogue.ts`):
- work and jobs;
- the boss's requests, the Sunday envelope;
- debts, shop arrangements, rackets;
- standing and promotion;
- crew management;
- stakes, fencing;
- sit-downs.

The scenario playthroughs hid this, because the scenario is exactly the slice the new engine models. Your report was right: the screen was not a replacement.

## What it is now

```
INTENTION  →  SUBJECT  →  APPROACH
Business      Jimmy’s trouble with Richie     Persuade · Appeal to your word · Negotiate · Accept his decision
Personal      What’s new? · A drink · …
Confront      Your envelope’s been light …
```

- **A visit opens on the man.** If he has something of his own (a request, work for you, news of what he did for you, a broken promise), he raises it himself. The screen is then his question and its answers, with no heading to go through. Otherwise there is a greeting, then **Business / Personal / Confront** (only the headings with something under them), then **Leave**. Leave is always on the screen.
- **Under a heading:** the four most relevant subjects, then "Other business…" (or its equivalent), then "Something else" (back to the headings), then Leave.
- **A subject keeps the talk.** His reply comes with its answers. When the subject has run its course (agreed, refused, dropped), the talk stays under the heading it was raised from, not back at the top.
- **Approaches** are chosen by name and said in words. "Persuade" says "Richie's been leaning on Jimmy for money, at DeSantis's Bakery. That's our ground." The engine decides whether it works. At most four approaches show; "Other ways to put it…" has the rest (a figure, a threat).

## How the headings map to what exists

The headings are presentation only, in `conv/visit.ts`. No new simulation. Each subject is an intention one of the two engines already carries out:

| Heading | From the conversation layer (`conv/*`) | From the old engine (`dialogue.ts`, through `say`) |
|---|---|---|
| Business | Taking a promised matter to your captain (intervene); telling a man how it went (pass); protection put to a shop; who a man answers to; a fixed loan (only where the old engine has no loan) | What he brings up and what is between you: jobs, his requests, the envelope, debts, a shop's arrangement, matters under way. The natural proposal for who he is (`leadCodes`: work from your boss, orders to your man). Under "Other…": its business, org and settle groups |
| Personal | What's new; an evening out; telling him of trouble that bears on him; asking who did something | What is on his mind; how he is; his view of others; what people say of you; gifts, congratulations |
| Confront | Not needed so far: a man's own grievance (a broken promise, a lie) comes to the player directly | Light envelopes, thin ice, a late fee and leaning on it, demands, challenges, a lie you can prove, bad blood |

Each old subject is classified once, by code (`paneOf`). The old engine's doors (his debt, his shop, your crew man, the bad blood, what is outstanding) are opened. Each thing behind a door becomes a subject in its own right, so a light envelope is under Confront, not hidden behind "How he's getting on".

Choosing an old-engine subject runs `dialogue.say`, so its consequences are exactly the old engine's. Meetings go to the meeting screen. A figure the player names (a loan, a stake) has its field on the new screen. Links from other pages ("go and see him about this") open the visit on that subject.

## How subjects are chosen

Subjects come from the world and from what the player knows, never from a fixed list per character:
- what is pending between them, in either engine;
- what the player's role makes natural with this man;
- what the player knows that bears on him.

Subjects are suppressed where they would be redundant or false:
- trouble a man has already brought to the player is not offered back to him as news;
- you never tell a man news he already has;
- a matter he refused, where nothing has changed, drops under "Other…" with a note ("He said no 3 days ago. Nothing has changed since.").

A heading with nothing under it is not shown.

## How context persists

- **Within a visit:**
  - the subject in hand (`topic`, and the old engine's `Convo`);
  - the heading the talk is under (`pane`);
  - arguments made, which are not offered again;
  - pressure applied;
  - offers and counter-offers.
- **Across visits** (`World.social.talks`, saved): what each subject came to, with a signature of the circumstances, so a refusal is remembered until something changes. Also:
  - lines he has said recently, which are not repeated;
  - the last evening out.

  Greetings now read that memory. A man you haven't seen in two weeks says so. The visit after an evening out says "You recovered?". A man who refused you last time greets you guardedly.

## Played

- **In the real game** (browser, dev server, `?scenario=dispute` and an ordinary new game):
  - **Test A.** Louie → Business → "Jimmy DeSantis's having trouble with Richie Valenti." Louie: "Jimmy? He's not one of ours. Why should we get involved?" → **Persuade** → Henry: "Richie's been leaning on Jimmy for money, at DeSantis's Bakery. That's our ground." Louie: "All right. I'll have a word with Johnny. But if this turns ugly, it's on you." The screen stays on Business.
  - **Test D.** In an ordinary game, "Artie Silvestri wants a word" appeared on the Today page by itself. Going to see him: Artie raises it ("$180, and it's about a place where money is lying around"). The choices are the answers: Pay $180 / Offer half / No thanks. Offering half: "I don't need your money that badly. Another time, then." Then the headings.
  - **Boss, ordinary game.** Business → "Is there anything you need done?" → Rocco: "Nothing now. Don't look for work. It finds you."
- **Through the same engine, scripted** (transcripts in this folder):
  - **Tests C, D, F:** `MONTH.md`, 30 days with Marty, Jimmy and Louie.
  - **Tests B, E:** `TESTS_B_E.md`.
- The Run 1 / Run 2 transcripts in `PLAYTHROUGH.md` predate the headings. The engine behind them is unchanged.

Numbers from the month (16 things said, 11 headings opened, over about 18 visits):
- **Most ordinary intentions take two selections:** a heading and the subject.
- **A man's own matter takes one.**
- **Repetition.** 10 of 35 lines were repeated verbatim across the month. They were short greetings ("Sit down.", "He nods you to a chair."), Jimmy's "Well? Did you talk to them?" asked again in a later week, and Marty's "Nothing ever happens to me."

## Tests

- `src/tests/conversation/visit.test.ts`: the 10 Gate 3 tests, now navigating the headings as a player would, plus 6 new ones:
  - at most three headings, none empty;
  - Business with your boss offers work and is answered;
  - "Other business" reaches borrowing and is answered;
  - Confront appears only when there is something to have out (a light envelope), and a debtor's arrears are business;
  - a man who came with something is answered directly, without headings;
  - an approach is said as its argument, and a settled matter stays under its heading.
- `src/tests/matters/matters.test.ts`: "a superior who hears his man brought trouble wants a word" now uses the first shopkeeper who holds out. Since the fix that puts vandalism in the shop's own district, the seed-5 shop's owner gives in on the spot (the street pressure is now his). That closes the matter before anyone above hears of it. The rule tested is unchanged.
- The test that limited a screen to five choices now limits it to at most four things to say and three headings, beside the ways back and out. That is the brief's rule.
- **Typecheck:** clean.
- **Full suite (`npm run test:all`, 357 s):** 426 passed, 1 failed, 14 skipped. The one failure was the old five-choice rule, now restated as above and passing.
- **After the last edits:** the dialogue, conversation and save tests were run again (170 passed, 4 skipped), along with the conversation and matters tests.

## Limitations

**Incomplete:**
- **The old engine's lines read a little differently:**
  - full names in narration ("Louie Costa waves a hand");
  - some long hints;
  - some subject labels are titles rather than speech ("Louie asks about Paulie").

  They are its own text, passed through.
- **Approaches** are named for the conversation layer's disputes and protection. The old engine's negotiations keep its own wording ("Ask around. I keep my word", "I'd think hard before saying no to me"). These are already speech, so they were left as they are.
- **Confront from the conversation layer** has no subjects of its own yet. A player who believes a man lied about a promise to him can't raise it from the layer's records, only from the old engine's.
- **Personal with crew men** is still thin. "What's new?" is often "Nothing", and the evening accounts draw on a small set of topics.
- **Only one figure field per screen** is supported (a second would share its input).

**Bugs found and fixed in this pass:**
- the screen had no access to the rest of the game;
- Jimmy was offered news of his own bakery;
- "the other night" was said a week and a visit later;
- the old engine's subjects leaked its own navigation rows ("I wanted to discuss some business").

## Critical assessment

- **The structure works.** You can now reach everything the game supports from the new screen.
- **Two selections is the normal cost of saying something.** What people come to you with arrives directly.
- **Refusals lead to approaches that say real things.**
- **The weakest part is ordinary personal talk with men who have nothing going on.** It is short and honest, but repeated visits to Marty read as pleasant and uneventful rather than as a relationship developing. The greeting memory helps, but the substance of an evening is still a small set of topics.

That is the next thing to improve. I would not call Gate 3 done until a month with a crew man reads as a relationship.
