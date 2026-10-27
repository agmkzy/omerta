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
