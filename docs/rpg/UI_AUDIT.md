# OMERTÀ: UI audit for the redesign (Phase 2b)

*26 October 2026. The audit the scope asks for before any redesign: every screen set against what the game now does, with evidence
from a fresh game played five weeks in the browser (an associate, Union Man background, one shop on his book, the Herald and the
stories live). The proposal at the end is the structure to agree before any visual work.*

## What the game now asks of the player
Since the last UI rebuild (25 October) the game has gained:
- a crew to run: men who come to him, quarrels, answering for them, Sunday envelopes;
- a book to run: big bets, a rival book, the precinct;
- trucks to plan and take;
- a street to walk (Little Italy's places and who is in them);
- rival captains and other families approaching him;
- the Herald as the city's paper;
- more kinds of story;
- an ending.

The screens were built for an associate doing jobs and talking to men. The new systems arrived as cards in the same lists.

## The screens as they are

**Shell.** Left rail with name, rank, date, place, cash, heat, reputation, influence, the five sections and Save; a side column
("Where you stand", career).
- Works: always visible, readable, calm.
- Problems:
  - On a phone the side column falls below a very long page.
  - Heat, reputation and influence are words with no sense of direction until a week has passed.

**World (today).** Welcome line; the time bar; the first-week guide; Needs you; Opportunities; Go and do something (Social Club,
Around town, Find someone, Give orders, Legit work, Gamble); Lately you've heard; the Herald.
- **The same matter three times.** In the playthrough "Needs you" showed "What you owe Nicky" (the new story), "Your envelope for
  Nicky" (the Sunday card) and "Nicky Sorrento wants to see you about the money" (the summons): one matter, three rows, three
  different wordings.
- **Answers and offers mixed.** "Needs you" mixes things that need an answer by a day with things merely waiting. "Opportunities"
  mixes a captain's request, a robbery at the player's own shop and a burglary tip.
- **"Go and do something" is a menu of places and modes,** not a sense of the day. Problems:
  - "Give orders" appears with no men to order;
  - the Social Club tile duplicates the club listed under Around town;
  - "Legit work" and "Work a shift" are the same thing under two names.
- The guide stays on screen into week five.
- The Herald is a single line at the very bottom.

**People.** At home (family, dating); "The people you know" (39), filterable by family.
- Every row reads "a face you know": the player's own captain, his shopkeepers and strangers from other families look the same.
- No ordering by what matters: who you answer to, who answers to you, who pays you, who owes you, who is waiting on you.

**Family.** The families; the tree with crews and places in line; "Call on the family", "Your place in line".
- **The player's crew has no page.** His men are leaves in the family tree. There is nowhere to see each man's earnings, trouble,
  loyalty and arc, the quarrels among them, or to give orders from.
- The Sunday envelopes from his men live on a screen reached only from a card.

**Business.** Your rackets (running); Ways to earn (12 open, 9 not yet).
- **The book has no page of its own.** Its big bets, rival book and precinct arrive as cards elsewhere; here it is one line.
- "Ways to earn" lists set-ups and one-off crimes together ("Bookmaking: ready to set up for $400" beside "Burglary: 3 places worth
  a look"). It overlaps "Opportunities" on World.
- No weekly picture: what came in, what went up, what went out, and from where.

**Journal.** Stories, Your word, What you know.
- Stories are now the best summary of what is going on, but they live in the last section.
- The Herald is reached from World, not from here.

**The player's own page** (from the rail).
- On one long page:
  - background and character ("proud, steady"; "The man you've shown them");
  - the road to being made;
  - the line for the next seat (with "Deal with him" beside each rival);
  - ambition; what he's known for; home life.
- It is the most important page for a climbing player and the hardest to scan.

**Conversation.** The strongest screen. The new encounters (quarrels, answering upstairs, the book, the truck) open as cards whose
choices continue in place, which works. Problems:
- The encounter page repeats a "Go and see him" choice above choices that already are the conversation.
- Long encounters (the truck's preparation) grow into a long column of narration.

**Places.** Around town lists Little Italy's places and shops with open/shut and who you know inside; a place shows who's in and who
comes in.
- It works as a list, but it reads as a directory, not a street.
- The family club opens a different screen from every other place.

## What the redesign has to do
1. **One card per matter.** A matter the player is in appears once on the first screen, in its most urgent form, with its other
   aspects inside it.
2. **Separate what needs an answer from what is on offer from what is going on.** Three kinds of thing, three places.
3. **Give the new systems homes:** the crew, the book and rackets, the street.
4. **Show the week as a shape:** money in and out, what went up to the captain, what's due when.
5. **Put stories and the Herald at the front.** They are how the world reaches the player.
6. **Order people by what they are to him.**
7. **Phone first:** the side column's content folds into the pages, not below them.
8. **Build on the existing kit** (ui/kit.ts) and the noir look; every save keeps working; no internal numbers shown.

## Proposed structure (to agree before visual work)
Six sections in the rail, each a home page with a clear job:

| Section | Its job | What lives there |
|---|---|---|
| **Today** | What the day asks of you | the time bar; *Needs an answer* (one card per matter, with its deadline); *On offer* (work, tips, trucks: each once); *The street now* (two or three places worth going, and who is in); the week's Herald headline |
| **The street** | Where you can go | Little Italy as a place (the street's places and shops, who is in, who comes in, whose ground); elsewhere; the track on Saturdays |
| **Your crew** | The men you answer for | each man's card (what he earns you, his trouble, how he feels about you, his arc), quarrels, orders, Sunday envelopes, men who want to run with you; for an associate, the crew he's in and his captain |
| **Business** | Your money | the week (in, up, out); the book's own page (bets taken, the drawer, the precinct, the runner); protection (each shop and how it pays); other rackets; ways to earn (set-ups only) |
| **People** | Who's who to you | ordered: who you answer to, who answers to you, who pays you, who owes you or is owed, who's waiting on you, then everyone else by family |
| **The record** | What's going on, and what you are | Stories (front), the Herald (every edition), your word, what you know, your road and character (the player's page split into readable parts) |

The rail keeps name, rank, money and heat, with direction arrows (cash and heat this week).

## How we would build it
1. **Agree the structure above** (this document).
2. **Clickable wireframes** of the six home pages and one card per kind, published as an artifact for review, phone and desktop.
3. **Build one section at a time,** starting with Today: its one-card-per-matter rule fixes the most visible problem. Each section
   ships when it's tested and played, with the old screens retired as each new one lands.
4. **The scorecard and a browser playthrough** after each section.
