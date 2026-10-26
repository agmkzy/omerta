# OMERTÀ: from coherent simulation to compelling RPG: report

*26 October 2026. Two parts:*
- *the overnight autonomous stage (to mid-morning);*
- *Phase 1 of the agreed scope (docs/rpg/SCOPE.md, SCOPE_OVERVIEW.md), from late morning, under the owner's seven principles and
  full autonomy.*

*Every increment was tested (full suite, two chunks), built, deployed, and verified live (page hash against the build). The working
log, with what was found, changed and measured at each step, is docs/rpg/LOG.md.*

## What is live now

### Overnight
- **A road to being made that a player can walk.**
  - Made men have work of their own (envelopes carried up, warnings to another family, men watched), put it the player's way, and
    come to him with it.
  - A soldier needs $1,500 passed up and three jobs; a seat opens within three weeks; the ceremony is held on a set night.
- **Errands are decisions:** a pickup skimmed or carried straight; a message said civilly or hard.
- **Loyalty tested:**
  - a rival captain asks the player to inform on his crew;
  - a man of another family puts a job to him behind his captain's back.
  Either can come out weeks later, told by the captain himself.
- **The world notices the player:** men of his family remark on what has just happened to him.
- **No blame for what lapses while he is inside.**
- **Conversation fixes:** names held back properly, spoken times, the captain's progress answer, backing conditions by role.

### Phase 1 (since late morning, nine deploys)
- **Time controls:** Morning, Evening, Sunday, Next week (stops early when something comes up); summons carry "Go at 10:00".
- **Crew and authority (authority.ts):**
  - **Men come to a made man:** his captain gives him his first man; others ask to run with him, with their reasons.
  - **His men's quarrels come to him.** He can hear them out, and the man in the wrong tells it differently the second time; then
    back one, pay it himself, make them shake hands, or leave it, which can end in a beating that costs him.
  - **He answers upstairs** when one of his men hits what the family protects. He can hear his side (a debt, bad blood, didn't
    know, greed), then make it right, rough him up, stand up for him, or put him out.
  - **Grudges matter:** a man with a grudge against him works less cleanly and skims more; discipline and favours are remembered.
- **The road to captain, measured:** made in week 7, captain around week 42 in a 400-day run, with a crew of four or five and a
  book.
- **The book, run (book.ts):**
  - big bets taken, split, laid off with another book, or refused, settled at Saturday's race;
  - a winner the drawer can't cover;
  - a rival book on his ground;
  - the precinct's envelope.
  The new made man's captain tells him to get something of his own.
- **A truck, played (score.ts):**
  - a tip from a man with a reason;
  - preparation: case the route, the driver, whose load, the fence, who comes;
  - the ways in that preparation opened, with honest odds;
  - a patrol car sometimes; abort, push, or let his man handle it;
  - after: the fence, the cuts, a theft on record, the protector told; or sell the warning to the protectors instead.
  The old one-step truck is retired.
- **Jail, a stopgap until the police are a faction:**
  - arrest odds rise from the line;
  - time inside scales with heat;
  - no double federal sentence;
  - the bot lies low when hot.
  Careful play is jailed 0 to 4 times in 240 days (it had been 4 to 9).
- **Places and routines, the Little Italy slice (city.ts):**
  - the street's own places (the family's club, Ferrara's, Sal's barber, The Grotto, Most Precious Blood) and every business to
    walk into, keeping its trade's hours;
  - where a man is follows his life and the clock;
  - regulars, and waiting for a man where he comes in;
  - the club's own reckoning is the one truth for who is at any club.
- **The end, told:**
  - how it ended, and who the street says did it (only if a man of his family knows);
  - the life;
  - who came to the funeral and who was not sorry;
  - the Herald's notice.
- **From playing a new game in the browser (two passes):**
  - first exchanges said as first;
  - refusals recorded as what was said;
  - figures spoken as figures;
  - a man's own terms hold in a negotiation (closes the V85 "haggling" item);
  - jobs referred to by place or man;
  - actions not voiced as speech;
  - remarks only on meeting;
  - "your men first" about the envelope;
  - tipsters rest between tips;
  - jail favours are about a man's own;
  - a rival family's job waits until the player has been around and done some work.

## How it was checked
- **Full suite before every deploy:** about 730 tests in two chunks. New experience tests cover crew, the book, the truck, places,
  the end, negotiation, loyalty and jail.
- **The climber** (an ambitious, loyal, careful player driven through the real code) over 200 to 400 days in several worlds, with
  diagnostics for what reached him, what moved his standing, when and why he was jailed, and what lapsed.
- **Browser play:**
  - the crew encounters, the book's big bet, a truck from tip to failure, Little Italy at different hours, and the epilogue;
  - a new game played from character creation through five weeks.
- **Live checks** after every deploy.

## Candid limitations
- **One district is built properly.** Little Italy has real places and routines; the other six still use the old rooms, and the
  family's men mostly live in Bensonhurst, so the regulars a player sees are few until he gets to know people. Approaches don't
  yet happen at a place.
- **Breadth waits on the slices,** by design:
  - one racket (the book) and one score (the truck) are deep;
  - the other rackets, scores, the track and the underground games are as they were.
- **The police are still a heat meter.** The jail changes are a stopgap. A careful player can still be picked up a few times a year.
- **Some things are measured only by the bot and my own play:**
  - how much fun the crew and the book are over months;
  - pacing across many worlds (quiet weeks average about a third).
  I haven't seen anyone else play them.
- **Shortcuts that remain:**
  - "Ask your captain first" about another family's job resolves without going to see him.
  - A soldier's own reputation (fair, cruel, greedy) and his dreams are not yet built.
- **Tests that were changed rather than simply passed,** each with its reason in the test:
  - several sampling tests now sample more worlds, or use the likeliest case, to test the mechanism rather than the odds;
  - parity tests name each intended change;
  - the quiet-weeks floor is checked across worlds.

## Next, in order
1. Phase 2, making the stories visible: a monthly Herald page and a story view, so what the world does reaches the player as stories.
2. Approaches at places, and the other six districts on the Little Italy pattern, once a second playtest confirms it plays well.
3. Who the player is: his reputation by conduct (read by his crew first), his dreams, his background's lasting effects.
4. Breadth on the proven slices: loans and numbers on the book's pattern; the warehouse and the card game on the truck's; the track.
5. Phase 3's first slice: one police investigation, end to end.
