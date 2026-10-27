# The economy: working log

The Economic World Expansion (owner's brief, 27 October 2026). The rule throughout: *the businesses create circumstances; the people
create gameplay.* Audit first: [AUDIT.md](AUDIT.md).

## Increment 1: the shared foundations and the four rackets

**Foundations (one record, deepened, not a parallel economy).** An enterprise stays an `Op` in `w.ops`, run every week for every
owner by `rackets.enterpriseWeek`. It now carries, all optional so every older save loads:
- `links`: the people and places it depends on, by role (runner, spot, thief, buyer, regular), each with what he has done for it;
- `base`: the establishment it works out of (a garage for a chop shop, a candy store for a numbers bank; one operation of a kind
  per place);
- `stakes`: other men's shares of the take (the garage owner's, a captain's), paid out of a good week (`payOpStakes`);
- `owners`: everyone who has had it, and how it changed hands; `hist`: what has happened to it (bounded);
- `cool`: when each kind of development may next arise.
Ownership, operation and entitlement stay distinct: the owner (`owner`), the man who runs it (`runner`, for his `cut`), and the men
with a claim on the take (`stakes`). The player may own one, run another man's (asks `run`), or hold a piece of one.

**Consolidated.** The two chop shops are one: an open venture (`w.ventures`) in an older save becomes a chop-shop op housed in its
garage, the host's share his stake, its cars in the bay (`foldVentures`, on load). Starting a chop shop in a garage (the deed, the
conversation, the scheme) opens that op. Stolen cars and goods a man brings home go to his own chop shop or fence when he has one.

**The four pilot rackets, by their people** (`enterprise.pilotWeek`; the rest of the world weighs on it as on any racket: the man
running it, the family's directive, the ground, how crowded the trade is):
- *Chop shop.* Its thieves take cars off the street and are paid for each; the shop strips what it can (more with a garage); its
  buyers take the parts, or the scrap men do at their price. Every car is a record: make, model and year of the period (never later
  than the game's year), condition, value, whose it was, who took it, where it went, for what. Now and then it was a made man's, one
  of our own, or an unmarked police car.
- *Numbers.* Its runners carry slips from its spots (shops in the district, one bank to a shop) and from their own players on the
  street, and keep a fifth; the bank pays the hits. A dishonest runner keeps some back. Now and then the number everybody played
  comes in.
- *Fencing.* Its thieves bring loads (a man's real goods when he has some), paid a third; its buyers take them. Goods out of a shop
  another family protects are known as such.
- *The book.* Its regulars bet what their habit and pockets say; a man who loses more than he has signs a marker (a real debt); a
  regular on a winning run, flush, is who comes in with the big bet. The counter's walk-in action is the rest of the handle.
The book's decisions (book.ts) no longer come from a roll of the week: the big bet comes from a flush regular, the rival book from a
book that has actually opened on his ground, the precinct from a book grown big enough to be noticed.

**What arises** (`enterprise.developments`, only from what has happened, each with its own long cooldown; the player's through the
man concerned, an NPC owner answering by his temper):
- a car that belonged to the wrong man (return it, strip it, give up the thief; a police car: dump it, strip it);
- the number came in and the bank can't cover it (pay, go to the captain, pay half and lose spots);
- goods out of a protected shop (move them, send them back, give up the thief);
- a buyer arrested, who knows the shop (a lawyer, shut it for a while, nothing);
- the man running it wants a bigger cut, once it has made money and he is the kind to ask;
- the captain wants a piece of a racket that is doing well, on top of the envelope (a stake, if given);
- a rival of the same trade on the same ground takes a spot, a buyer or a regular (win him back, lean on the rival, let it go).

**Hands change for understood reasons** (`opsChangeHands`): the owner dies (to the man running it if his captain trusts him, else
the captain's choice: his own blood, then the man he trusts most); the owner goes inside for a long stretch (the runner keeps it
going, or the captain gives it to another man: the player can lose a racket this way, and can be given one).

**Legitimate places.** A bar, restaurant, café, diner or billiard hall of the player's own (or one he has a share in) can be where his
crew meets: what is said at the bar reaches him, his men like having a place, and when the police are interested in him they are
interested in it. A business's page shows what he knows has happened there. **Money on paper:** what he can show (his businesses'
takings, wages, a front) against what he can't; the Business screen says it in a line, and a man living well on unexplained money
slowly draws attention.

**Presentation.** Business, What you run: *Your rackets* (each one: who runs it, how it is going in a word, the last thing that
happened, last week's figure), *Your interests* (what you run for other men, your shares, your places), *On paper*. A racket's page:
the arrangement (whose, who runs it, who has a share), its people by role with what each has done, the chop shop's bay and its last
cars, its story. Put one of your men in charge, or take it back. Developments come to Today under *Waiting on you*.

**Measured** (climber, 150 days, seeds 3, 7 and 11). Average per week, per running racket, across every owner in the world:

| | seed 7 | seed 3 | seed 11 |
|---|---|---|---|
| Chop shop | $438 | $273 | $235 |
| Numbers | $298 | $365 | $235 |
| Fencing | $360 | $246 | $163 |
| Book | $325 | $255 | $209 |

(Before the change every racket took about its base, $400–$480, less bad weeks; the spread now comes from the people.) Cars are all
model years 1962–1970. In seed 7 the player inherited a chop shop when its owner died (it went to him as the man in the crew his
captain trusted), his captain asked for and was given 15% of his book, and three developments were waiting on him at day 150 (a
police car in the bay, a made man's Cadillac, the captain's piece). Stripping the police car raised his heat, and with a month of
jobs behind him it put him inside for nine days. Saves are about 7% larger at day 150 (car records; other men's sold cars are kept
ten days, the player's a season).

**Not yet.** Played scenes for collections, courier and escort work; restaurants' staff and regulars as people of their own; the
restaurant and garage as enterprises with their own developments; a racket bought or sold outright; the federal side of unexplained
money. Next: the long runs of the brief's eight player types, and the browser playtest.

## Increment 2: places, work that feeds the rackets, reasons, and what it reaches

The owner's direction for this increment: depth over more named events; legitimate businesses as working enterprises; the player
taking part, not watching; every demand, betrayal and takeover with a reason a man could understand; and proof that what starts in the
economy reaches conversation, relationships, family politics and later events.

**Why men do what they do (`establishments.motives`).** One reading of what presses on a man, from the world's own record: what he owes
and to whom, his trouble, what he wants, how short he is, what he holds against someone, and his nature (greed, ambition). The
developments read it instead of rolling dice: a man asks for a bigger cut only when something presses on him (a contented man paid
fairly doesn't, however well the racket does); a rival poaches only when he has a reason to grow; a manager or a barman puts his hand
in the till when he is pressed and not held by the owner. What the player is told is only what he could know: the debt if he has heard
of it, the trouble if it has come out, the grudge he gave the man, the nature anyone can see.

**The man who goes his own way (`goesOwnWay`).** The man running a racket walks out and sets up the same trade on the same ground when
he has a grievance (a cut refused, being leaned on), wants something of his own, the owner isn't there to stop him (inside, laid up) or
isn't feared; he takes whoever trusts him more than the owner. The player can take it to his captain (who weighs the two of them),
lean on him (a careful man folds; another makes it a matter between them), or let him go.

**When the player is the captain.** His men's rackets are theirs, but he is who they come to: for the money when a bank can't cover its
hits, for a ruling when two of his own men fight over a spot or a buyer, and to say who gets a racket when its man dies or goes inside
for a long stretch (his runner, another of his men, himself, or kept for the man until he's out). He can ask any of his men for a
piece of what they built, as his own captain asks him. Business shows *Your men's rackets*. A man of his own no longer opens a rival
racket beside the one he runs for him (that is walking out, which has its reasons).

**Restaurants, bars and garages, run (`establishments.ts`).** Each has its people: the cook, the waiters, the bartender, the mechanics
(civilians of the district, each with a start date) and its regulars (the neighbourhood and men in the life who drink near home; a
bar takes the drinkers, a restaurant those with money). Its week is in its accounts. What arises, each from the people's own
circumstances, with an NPC owner meeting the same things himself:
- *the till* comes up short when someone pressed handles the money; the owner sees it in the takings, and can count it in front of
  him, let him go, or let it be;
- *a man in the life who never pays*: one man to a place, a man well above the owner, who takes it as his due; let it ride (he owes
  you), ask him (a man who outranks you takes it badly, in front of the regulars), or go to his captain;
- *an advance*: a cook in over his head asks for money against his wages; given, he is grateful; refused, he is tempted;
- *an offer*: a man with money wants the place, sometimes another family wanting a foot on the street; NPC owners sell when the place
  is struggling or the price is very good.
A made man's own place stops paying protection to his own family (the collector who loses it knows to whom). The place's page shows
who works there and who comes in, how it is doing in a word, and its own story. Business shows each place with its week's figure.

**Work that feeds the rackets.** A buyer the shop has dealt with long enough asks for one car in particular (a Lincoln Continental, two
years old at most), as work offered to the shop's owner: take it himself or hand it to one of his men. Taken himself, it is played:
out of a private garage or off the street, and now and then the owner comes out onto the stoop (start it and go, and he sees your
face; tell him you're from the garage; walk away). The car goes through the shop to the buyer with its history. Cars the player boosts
go straight into his own bay, named; goods he or his men steal go to his own fence.

**Grounded in the world (fixes from play).** Men who steal and carry slips for a racket are its owner's own people or nobody's (a
Marchetti associate was bringing a Corrente man's shop its cars and didn't know him); working for a racket makes a man known to its
owner, week by week; car thieves are men; a man works for one bank, a thief for two outfits at most; a hot car stays in the bay until
someone decides; a captain asks for one piece at a time; a request left unanswered is an answer (the cut is no, the captain was
ignored).

**Measured: eight kinds of player** (`src/tests/tools/economy.ts`, 150 days, seeds 3 and 7, each answering by one plain policy):

| | cash, 150 days | what reached him | what it left |
|---|---|---|---|
| 1. associate, nothing | $1,500 → $1,080 | nothing | the economy leaves a man with no stake alone |
| 2. soldier, one chop shop | → $11,600–13,400 | 4–7: a made man's Cadillac, police cars, a car to order, his man's raise, his captain's piece | a captain who feels haggled with |
| 3. soldier, all four | → $29,900–31,600 | 9–13 | the captain's piece on two of them; a runner who walked out and was brought back |
| 4. captain over earners | → $12,000–13,300 | a man dead; who gets his chop shop | the man chosen grateful; the others watching |
| 5. chop shop and a restaurant | → $16,300–16,700 | 4–6, and an offer for the restaurant | $60–220 a week he can show on paper |
| 6. delegates, answers nothing | → $23,800–27,400 | 9, all left to lapse | a captain ignored, with that reason; runners refused by silence |
| 7. pushes hard | → $18,600–19,200 | 8–9 | captain's grudge "wouldn't give him a piece of his book"; men leaned on |
| 8. inside for two months | → $6,200–6,600 | nothing while inside | his numbers bank given to another man, his captain taking 15% |

Money stays coherent in every run (the ledger audit finds nothing). The player who answers nothing earns as well as one who answers
everything, and pays for it in the regard of the men around him, which is the trade the owner asked for.

**The chains, proven** (`src/tests/economy/chains.test.ts`): a made man's car through the shop becomes his grudge, his captain's
knowledge and tension between the families; a refused raise is a grudge with its reason, and the man who walks out says it; a man's
bank short of its hits comes to the player as his captain, and refusing him is a grudge and a welsh the street hears of; a manager in
debt skims the till and the owner hears of it with the debt, because he knew of it; a captain ignored holds it, with the reason.

**Played in the browser** (seed 11, a made man with a chop shop and a numbers bank run by his men, and a trattoria where his crew meets;
26 weeks, answered through the real screens):
- *What worked.* The rackets ran without asking anything for weeks at a time, and money grew. What came was about people: a police car
  in the bay (into the river), the chop shop's man asking for a cut after eight weeks of running it for nothing, a rival taking a
  numbers spot. Refusing the cut was remembered; four months later the man walked out to set up on his own, the captain ruled for the
  player, and the man closed up holding a grudge whose reason says exactly that. The car to order played well: a Lincoln lifted off the
  street outside a restaurant, a thousand dollars, and the car on the shop's page with whose it was. The chop shop's page is the best
  screen in this work: a 1970 Cadillac Coupe de Ville from a nurse on nights, stripped for $1,010.
- *What it showed was wrong, and was fixed.* The thief was another family's man who didn't know the player; two car thieves were women;
  "under What you could do" named a section that no longer exists; the order's car was seven years older than asked; the history list
  broke a name onto a line of its own; a made man's own restaurant paid his family protection.
- *What is still thin.* The trattoria ran honestly and quietly the whole time (its staff were never pressed), which is right but means
  the place-life is seen mostly in other men's places. A legitimate restaurant barely pays its way (about $60–220 a week), so owning
  one is about the place, not the money; whether that is enough is the owner's call. Losing a racket while inside reaches the player
  only as something he hears; his captain should say it to his face when he's out.

**Not yet.** Played scenes for collection, courier and escort work; a garage as its own kind of place (its customers, a mechanic who
knows cars, the chop shop's front); buying or selling a racket outright; the federal side of unexplained money; the captain telling a
man who comes out of prison what became of his racket.
