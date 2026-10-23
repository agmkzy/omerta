# Stage 4: the criminal economy and work. Assessment and proposed design

October 2026. **For review; nothing here is built yet.** This is a read-only assessment of the code as of commit `24c2beb` (foundation steps 1–3), with figures from the two-year baseline (`docs/baseline/rerun/`). The implementation log stays in `docs/FOUNDATION.md`, and `docs/BASELINE.md` stays the unchanged reference.

The aim, in the owner's words: *a living criminal economy in which characters independently pursue opportunities, work within Mafia organizations, earn and lose money, develop relationships and generate consequences.* The aim is not more rackets, jobs or money screens.

---

## 1. Current state

### What exists and is worth keeping

- **Businesses** are already rich records, and the economy's best-built part:
  - an owner (`ownerId`), a manager (`managerId`), other people's stakes (`stakes`) and a history of past owners;
  - a protection arrangement with a collector, a family and an agreed weekly fee that persists, plus arrears;
  - real weekly accounts.

  All of a business's money moves through one door (`econ.bizMove`), and the ledger checks it.

  NPCs already buy businesses, raise money for them, borrow to buy them and lose them through plans (`goals.ts`). Businesses change hands through sale, default, takeover and poaching. **Ownership, management, protection and economic interest are already distinguished.** The missing piece is criminal activity that has the same kind of record.
- **Debts** are one store of real records:
  - principal, balance, weekly rate and payment;
  - missed payments and default;
  - default seizes a share of the debtor's business.

  Collection is an existing negotiation (`asks` "collect") and storyline ("debt", "tribute" in `situ.ts`).
- **Protection negotiations** (`asks` "protect", V89/V90): the man asked weighs the demand against what his business can carry, his fear, his temperament, who already protects him and the asker's reputation. He can accept, refuse, counter or stall, and **an agreed fee persists as an actual arrangement**. Unpaid weeks become arrears and an enforcement storyline.
- **Kick-ups** (`books.ts`): every man declares his week, passes a share up and may skim or hide income. Superiors notice discrepancies and discipline.
- **The order model** (`orders.ts`): a man sent on a job may do it well, skim, lose half of it at cards, find nobody home, start a fight, or come back with a story that isn't true. **This is the best behavioural model in the economy, and today it runs only when the player gives an order.**

### Where it overlaps or fails

| Problem | Evidence |
|---|---|
| **Two separate racket systems.** NPCs have *hustles* (`hustle.ts`): eight kinds, one per man, abstract weekly income with a level and a police risk. The player has *operations* (`rackets.ts`): thirteen kinds, with a runner, skimming and raids. Numbers, bookmaking and vending exist in both. | read in code |
| **Rackets that produce income but nothing in the world.** An NPC's "loans" hustle and the player's "shylock" operation earn interest without a single real loan. The "shakedown" hustle earns protection money without a single protection arrangement. "Cars" and "fence" hustles earn from stolen goods that don't exist (the `cars` / `goods` fields are used only by the player). | read in code |
| **The protection-demand storm.** Every associate and soldier considers every open shop in the city every day, whatever its district or protector. The brakes are a 14-day cooldown per man per shop and a 7-day pause after any approach. Each demand is a fixed 8% of income. | 548–1,113 refusals against 29–40 deals per world in two years: twenty to thirty refusals per shop that pays |
| **Loans made in many places.** There are at least 11 routes for the player and about 6 for NPCs: conversation menus, encounters, situations, meetings, crew events, two kinds of ask, plans, personal crises, gambling markers. Each sets its own amount and rate (4–10% a week). | read in code |
| **Interest compounds weekly on the whole balance,** so a few unpaid debts balloon. | seed 7 baseline: $34k → $157k owed in six months |
| **Work never flows down between NPCs.** Only the player is given jobs by a boss (`jobs.ts`); only the player gives orders (`orders.ts`). Captains never assign their men anything. | read in code; the baseline's reputation figures |
| **Family treasuries only accumulate.** Dues come in (3% of what a made man holds above a floor), jailed men are supported, and a greedy boss occasionally draws. Nothing else spends it. | $180k–$330k unspent per world after two years |
| **Gambling is mostly noise.** NPCs gamble at casinos, and every loss is recorded. | 4,600–12,100 gambling-loss records per world in two years, a third of all events |
| **The player can't name a figure.** Protection demands are set by code (7–8% of income), and loan amounts are fixed per menu option. The player can sweeten or press, but never say "$60 a week". The interface has no number input anywhere. | read in code |
| **Two rulebooks for rising.** The player's road (`path.ts`) and the NPC formula (`career.ts`), as noted in FOUNDATION.md. | read in code |

---

## 2. Proposed gameplay model

### Five relationships to anything that makes money

The owner's distinction, mostly already present for businesses, extended to criminal enterprises:

| Relationship | Meaning | Where it lives |
|---|---|---|
| **Owner** | Whose it is: started it, bought it, inherited it | business `ownerId`; enterprise `owner` (new field on the merged record, see below) |
| **Runner / manager** | Who operates it day to day | business `managerId`; enterprise `runner` (exists on operations) |
| **Protector / claim** | Which man, and through him which family, claims it | business `protection` (exists); an enterprise's claim is its owner's family |
| **Stakeholders** | Who gets a share of its earnings | `stakes` (exists on businesses; extended to enterprises) |
| **The hierarchy** | Who is owed tribute from the owner's earnings | kick-ups (`books.ts`, exists) |

**Authority is not ownership.** A captain doesn't own his soldier's loan book. He's owed a share of the soldier's declared earnings through kick-ups, as today, and he can *demand* a stake, which is a negotiation like any other (`asks`). A soldier who refuses keeps his book and earns his captain's resentment. One who agrees has a captain who now profits from his success. Both outcomes are recorded and both have consequences.

### One kind of enterprise, with real effects

Merge NPC hustles and player operations into **one enterprise record** that anyone can own. Each kind *produces real records* instead of abstract income:

| Kind | What it does in the world |
|---|---|
| **Loansharking** | A book of actual loans (debt records) to real people, at the owner's terms, collected weekly. Missed payments, defaults, collections and dependence follow from the debt rules that already exist. |
| **Protection** | A set of protection arrangements with real shops, in his crew's ground. Resistance, arrears and competing claims follow from the existing protection rules. |
| **Bookmaking / numbers** | Takes bets from real men. Wins and losses fall on them; a man who can't pay gets a marker, which is a debt. A dishonest runner skims (the order model). |
| **Stolen goods / hijacking** | Takes goods and moves them through a fence. Heat, arrests and partners follow. *(Can wait: see section 5.)* |
| **Fronts, unions, docks, carting and the rest** | Steady earners with their own risk. Kept, but abstract, unless and until something reads them. |

The money still flows through the existing doors: the business ledger, the debt records and kick-ups.

### Independent enterprise and assigned work, side by side

- **Independent.** Any man may start, buy, grow or wind down his own enterprise when his circumstances justify it. That uses the existing plans system: an NPC's "business" plan is extended to enterprises, not a new ambition system. It needs money (savings, a loan or a partner), a place (his crew's ground or a business that will host it) and, for some kinds, a word with his captain. Starting a book in another crew's ground is a deliberate act with consequences, not something that happens by chance.
- **Assigned.** A superior gives work to a man below him: collect from my book, run my bookmaking for a month, lean on this shop, guard this, deliver that. **One mechanic, the same for an NPC captain, the player's boss and the player himself,** carried out through the order model. The outcome is an event, so it flows through the doors steps 1–3 built: reputation, the superior's trust (with the reason), discipline if he's caught skimming, and resentment if he's treated unfairly.
- **Both shape careers.** A superior's opinion of a man rests partly on what he actually did. A man whose own book outgrows his captain's has a choice, and so does his captain.

### The protection storm, solved by structure

1. **A crew's ground.** The shops a crew protects, and the unclaimed shops around them in its family's districts, count as that crew's ground. This is read from existing records, not a new territory system. Places and HQs will refine it later.
2. **Approaches come from someone's purpose.** Either a man's own protection book is growing in his crew's ground, or his captain sends him. The daily citywide scan, where every man considers every shop, is **deleted**.
3. **Shops remember.** A shop that has refused, and who it refused, is recorded. A man doesn't go back to a door that just closed on him unless something has changed: his reputation, the shop's trouble, a new captain behind him, or a deliberate decision to press harder.
4. **Another man's shop is a decision, not a habit.** Taking a shop from another crew of your own family is an internal dispute. Taking one from another family is poaching, with the tension and retaliation that already exist.

No cap on demands: they fall because each one now has a reason.

### Loans: one act, real terms

- **One way to lend,** for everyone: the existing lend/borrow negotiation. The amount, the weekly rate and the weekly payment are terms both sides agree to, and they persist on the debt. The ~17 separate routes are deleted.
- **Interest as the street charges it:** a weekly vig on what was lent. Missed weeks add to what's owed, by agreed rules. This replaces compounding on the whole balance, which is what made debts balloon.
- **Partial payment, renegotiation, collection and enforcement** reuse the existing collection negotiation and debt storyline.
- **Dependence and consequences:** a man in debt to another family is easier to turn, which already affects the chance he talks to the police. That could extend to poaching later.

### Money, tribute and pressure

- **Kick-ups stay as they are,** and they're the hierarchy's income.
- **The treasury gets spent on what a family actually pays for:**
  - lawyers and bail when a man is arrested;
  - support for families of the men inside;
  - stakes in members' enterprises, on terms;
  - the boss's draw.

  Bribes come with the police stage.
- **Financial pressure drives decisions.** Wants already shift with money trouble. Under the new model, pressure also leads a man to borrow, skim from an operation he runs, take a risky enterprise or sell a stake. These are the same decisions the player faces.
- **Influence without rank:** a wealthy associate with stakes in other men's enterprises has leverage, and stakes are already read for regard and disputes.

### The player names his own figures

- When the player demands protection, offers or asks for a loan, or demands a stake, **he names the amount** and, for loans, the terms. The man answers through the existing negotiation:
  - his ability to pay, read from his business's real accounts;
  - his obligations;
  - his fear and temperament;
  - the player's reputation;
  - who protects him now;
  - the family and territorial relationship between them.

  He can accept, refuse or counter, and gives his reason.
- **An agreed figure persists as the arrangement,** as protection fees already do.
- **An excessive demand has its consequences:** missed weeks, distress, resentment, a protector called in.
- **NPCs name their figures** through the same rules: their demands come from what the business can carry and what they want.
- **The interface needs one new control:** a way to enter an amount. The decisions underneath already accept any amount.

---

## 3. What playing at each rank would involve

- **Associate.** You earn for yourself and for the man you're with.
  - Start small: lend a few hundred at your own terms, run a numbers spot from a friendly candy store, or put a struggling shop on your protection book in your crew's ground.
  - Your captain sends you to collect from his book or lean on a shop that owes him.
  - Do it straight, skim and hope, or come back with a story.
  - What you pass up, and how the jobs went, is what your captain remembers when someone asks whether you're ready.
- **Soldier.** You're made, so men can work for you.
  - Give your associates collections and errands, and their mistakes become your problem.
  - Grow a book until it rivals your captain's, take a partner to finance a bookmaking operation, or buy into a business.
  - Your captain may want a piece, and how you answer matters.
- **Captain.** You run a crew and its ground.
  - Decide who runs which operation, settle disputes between your men, defend your shops against another crew, and pass tribute up.
  - A soldier who earns more than you is an asset and a threat.
- **Don.** The family's economy is yours:
  - tribute rates;
  - what the treasury pays for;
  - which crew gets which ground;
  - how disputes over shops and shares are settled.

  *(The full Don phase is later; this stage only makes sure the levers are real.)*

At every rank, other men are doing all of this on their own, and some of it lands on you.

---

## 4. NPC autonomy

NPCs use **the same acts and records:**
- An associate saves, or borrows, to start a loan book.
- Two soldiers each take a stake to finance a bookmaking operation.
- A captain hands a promising associate a struggling business to manage.
- An ambitious soldier's operation outgrows his captain's, and his captain demands a stake.

All of it happens through the existing plans, negotiations, debts, stakes and the order model, and each step is an event with its causes on record. NPC plans can succeed or fail through the actual economy. The harness will show this in individual histories, not just totals.

---

## 5. Implementation sequence

### Essential foundation, in dependency order

1. **Loans consolidated.**
   - One lending act with negotiated, persistent terms.
   - Vig on the amount lent, not weekly compounding.
   - Delete the ~17 separate routes.
   - *First, because enterprises (loansharking), stakes and financial pressure all depend on loans being real.*
2. **One enterprise record.**
   - Merge hustles and operations.
   - Each kind produces real records: loans as debts, protection as arrangements, bets as wins and losses with markers.
   - Delete the abstract income paths and the duplicate kinds.
   - Stakes extended to enterprises (partnerships).
3. **Protection by crew ground and purpose.**
   - Shops remember refusals.
   - Approaches come from a man's own book or his captain's instruction.
   - Delete the daily citywide shakedown scan.
4. **Work down the hierarchy.**
   - One assignment mechanic for everyone, carried out through the order model, with outcomes as events.
   - Delete the player-only boss-offer copy and the "work the family hands out" copy in `pulse.ts`.
5. **One career rulebook,** reading the record from 1–4: what a man earned and passed up, the work he did and how it went, reputation, a sponsor, a seat, and a test job before being made (the player's trial, for everyone). The player's road becomes a view onto it. Delete the separate NPC formula.
6. **Money circulation.**
   - Treasury spending on lawyers, bail, support, stakes and the boss's draw.
   - Financial pressure feeding borrowing, skimming and risk.
   - Stake demands up the hierarchy.
7. **The player names his figures.**
   - The mechanics are covered by 1–3.
   - The interface control (entering an amount) comes last: small, but it touches the screen the conversation rebuild will replace. My recommendation is a simple amount picker now, carried into the rebuild.

Each step deletes what it replaces and is measured on the four worlds before the next begins.

### Can reasonably wait

- **Stolen goods and hijacking as a full enterprise,** with goods that physically exist. Keep it abstract for now.
- **Cheating at the tables,** and casino ownership politics.
- **Detailed territory, blocks and premises:** the places and HQs stage.
- **Bribery and the police's share:** the consequence stage.
- **Gambling-loss noise:** record only losses that matter (large ones, or ones that create a marker). This is cheap and can ride along with step 2.

---

## 6. Testing approach

- **The same long-run harness:** four worlds, two years, compared with the original baseline and the previous step, plus the existing determinism, ledger and consistency checks.
- **New measures:**
  - **Enterprises:** by kind and by the owner's rank; how many are started, grown, sold or failed; who owns, who runs, who holds stakes.
  - **Where money comes from:** each man's earnings by source, with every racket's income traceable to real records (loans, arrangements, bets).
  - **Loans:** count, terms, missed payments, defaults, renegotiations, and whether any balance balloons.
  - **Protection:** approaches per shop per month, refusals per deal, and how many approaches came from a man's own book versus an instruction.
  - **Work:** assignments given, by whom and to whom, and their outcomes (done, botched, skimmed, lied about), and whether a superior's trust in a man follows what he actually did.
  - **Careers:** promotions with the record behind them, and how often the player-style trial job is given.
  - **Money circulation:** treasury in and out by purpose, and how wealth is spread at each rank.
- **Economic lives in the histories,** for example "started a loan book in March; lent Joey Costa $400 at $40 a week; Joey missed three weeks; collected with a beating; book grew; captain demanded a quarter; refused; captain turned against him".
- **Architecture tests:** one door for creating a loan, one for starting an enterprise, one for giving an assignment.

---

## Decisions for the owner

1. **Order:** loans → enterprises → protection → work → careers → money → the player's figures. Agree, or change the order?
2. **Interest:** a weekly vig on what was lent, rather than compounding on the whole balance. Agree?
3. **Asking permission:** should starting an enterprise in your own crew's ground need a word with your captain for some kinds (bookmaking, numbers) and not others (lending your own money)? I'd suggest yes, as a social act whose refusal you can defy at a cost.
4. **The amount control:** a simple picker now, or wait for the conversation rebuild?
5. **Gambling-loss records:** keep only the losses that matter, as part of step 2?
