# OMERTÀ: the redesign (Phase 2b)

*26 October 2026. The owner's brief: a complete redesign for enjoyment, not boxes moved around. Reword, improve, move things to
where they make sense, add a "More" menu so the main pages stay uncluttered. Clean, slick, not overloaded. This document is the plan;
it was written after rendering every section of a soldier's game 150 days in (crew of three, a book, two shops, 95 people known).*

## Principles
1. **One page, one job.** Each page answers one question. Anything that answers another question lives where that question is asked.
2. **Lead with what matters now.** The first thing on every page is what the player is most likely to act on. Reference material
   (history, tables, every option there is) is one tap away, never in the way.
3. **Words, not figures.** Show money where money is the point (Business). Elsewhere, men are described, not scored. No meters, no
   tables on the main pages.
4. **Short lists.** Three to five items, then "more". A list longer than a screen is a sign the page is doing two jobs.
5. **Group, don't repeat.** "Sammy Bianchi owes you five favours", not five rows.
6. **Every choice is numbered** (the kit's `choices()`), and every row leads somewhere.
7. **The secondary goes in More,** so the five destinations stay about play.

## The shell
**Street · People · TODAY · Business · Story · More**
- **Today** is raised at the centre and always returns you to the present. A single mark on it when something needs an answer.
- **The other four** pick up where you left them.
- **More** (far right, smaller) opens a menu of everything secondary:
  - the Herald (every edition);
  - what you know (the full record);
  - your notebook (pinned men and notes);
  - the families (every family, its crews and its places);
  - who's where;
  - scores to settle;
  - honest work;
  - how to play;
  - saves and backups;
  - start a new life.
- **Your portrait** (top left on a phone, top of the rail on a desktop) opens Story › Your life.

## Today: what's happening, what needs me, what could I do
1. Your situation in a line, changing with rank, and the next thing coming due.
2. **Needs you:** one card per matter, three at most, then "more".
3. **Word reaches you:** what reached you while time passed (or what you've heard lately), three at most.
4. **What you could do:** the offers, then what your position puts in reach (your men, a shift, lying low, a score), three or four.
5. **Let time pass.**
6. The Herald's headline in one line.

## Street: where you go
- The district's places as cards: the name, whether it's open (and until when), and who's in, in a phrase ("Louie behind the
  counter; four more you know"). The family club first.
- **The shops:** yours first (they pay you), then your men's, then everyone else's, folded.
- **Elsewhere:** the card table, the old rooms, the track on Saturdays.
- **Later:** the illustrated neighbourhood as the page's header and picker (the mockup), with the district switch.

## People: who matters
**Rooms:** Your men (when you have any) · The family · Everyone.
- **Everyone**, ordered by what each person is to you:
  - who's waiting on you;
  - who you answer to;
  - your men;
  - money and favours either way;
  - at home;
  - then everyone else, by family, with a search.
- **Wording:** a man is described only when there is something to say ("owes you a favour", "holds a grudge", "likes you"). "A face
  you know" is gone. The date options move to her page.
- **Your men:**
  - the week in one line (what they brought, what's owed);
  - each man as a card: what he's doing, what he brought, the one thing wrong with him, if anything;
  - "Run the crew" as numbered choices.
  - The side-by-side table moves to each man's books.
- **The family:**
  - the tree, and your place in it;
  - the shops list moves to More › The families.
- **A man's page:**
  - who he is, in a line;
  - what you can do with him (Talk first);
  - what's between you, in sentences;
  - what you know of him (the latest few, then more).
  - No trust and respect meters. The notes tags fold away.

## Business: what you run
One page, in order:
1. **This week:** money in and out in one line, tapping into the breakdown.
2. **What you run:** each racket and each shop, with how it's doing, and where it needs a decision.
3. **Sunday's envelope:** the choice, and how last Sunday went.
4. **Money owed,** either way.
5. **Start something new:** one row, opening the ways to earn and who could use a loan.

## Story: who you're becoming
**Rooms:** Stories · Your road · Your life · Your word.
- **Stories:** what needs you, what you're in, what's around you. The ended ones are folded.
- **Your road:** the rank you hold and the steps to the next; the line for the next seat; your ambition. What your rank lets you do
  is a short list of headings, opened on demand.
- **Your life:**
  - who you are: character, what they say about you, what you're known for;
  - home: family, the girl;
  - how you live.
  - Milestones and saves move to More.
- **Your word:** favours grouped by man; promises, terms and hard words only when there are any.

## Order of work
Each step is tested, played in the browser, and deployed before the next:
1. **The shell:** More, and the menu.
2. **People:** Everyone and a man's page.
3. **People:** your men.
4. **Business:** one page.
5. **Story:** road, life, word.
6. **Street:** cards, then the illustrated picker.
7. **A visual pass** across all of it.

## The conversation, by subject (owner's brief, 26 October)
Presentation only; the engine is unchanged, and every option it offers is still there.
- **What is between you comes first:** his question and its answers when he has asked one; otherwise what is unfinished between
  you two (a report owed, the envelope, a matter, a debt, his trouble, his word, a job in hand).
- **Five subjects:** Work & money, Family business, People & rumours, Personal, Settle something.
- **Options that lead into the same thing are one entry:**
  - "Ask for work": the wording that fits the man;
  - "Your standing", "Money between you", "A debt", "His business", "Protection", "A deal", "His work for you", "Ask about
    someone", "What happened", "The word around", "Pass the time": these open to their particular options.
- **Desktop:** the man across the top; the dialogue and your responses on the left; the subjects beside them, each part scrolling on
  its own.
- **Phone:** the subjects in place when nothing is pending, and a Subjects drawer otherwise.
- When an exchange is over, the subject it began from is open again. Leave takes you straight back to where you were.
- The player is no longer offered a loan from his own men.
