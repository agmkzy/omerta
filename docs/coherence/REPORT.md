# OMERTÀ: gameplay coherence and conversation repair

**Branch:** `coherence`, from `main` at dcd3718.

**Evidence base:** the player-experience playtest (`docs/playtest/REPORT.md`), which this work treats as its acceptance criteria.

**What this was, and wasn't:**
- It was a repair of how the existing systems relate to each other.
- It was not a rewrite, and no new gameplay system was added.
- Every change is listed below with the record it now owns or reads.

---

## 1. Root-cause analysis

Each of the playtest's failures had a cause shared with others, so each was fixed at that cause.

| # | Root cause | Failures it produced |
|---|---|---|
| R1 | **No rule that a man is never his own counterparty.** A request, promise, job or option could name the same man in two opposed roles. | Mickey asked Lawrence for help against Lawrence; "Mickey's having trouble with Lawrence Oliveri" offered to Lawrence's captain; "Who does Lawrence answer to?"; self-given escort work; "What happened to Marty?" said to Marty; "What went on between Gino and Lawrence?" |
| R2 | **A commitment kept in several records, each read by a different screen.** Jobs, the conversation layer's obligations, the old engine's memos and the favour list each held part of the player's commitments, and each screen read only some of them. | A job taken in conversation was shown nowhere and never completed. The captain said "you didn't want it". Promises were missing from *Your word*. "Favours: you owe nobody" sat beside a favour memo. |
| R3 | **Job completion only through the job's own screen.** When the objective was met some other way, the job was pruned as "no longer needed". | The captain's work was never credited, so "Get the work done" stayed at 0. |
| R4 | **"Already said" decided by the words, not by the choice.** A duplicate-line filter replaced any repeated NPC line with an "already" retort, and the loan negotiation treated each argument as the whole request. | "Short memory?" on the first follow-up; "Keep up" to a new argument; the loan options cycling for ever. |
| R5 | **Line templates chosen by intent, blind to role and situation.** | A victim answered as an onlooker; a new protection arrangement was discussed as an unsolved crime; an apology answered "What's the catch?"; "Everybody pays" used to tell a man to stop. |
| R6 | **Consequences recorded but addressed to nobody.** Facts with no player witness, decisions made over his head and never told him, and an arrest that simply advanced the clock. | $248 settled out of the player's pocket unannounced; a share raised silently; a 33-day jail summed up as "Something has come up"; unexplained standing changes. |
| R7 | **Progress credited for things that aren't progress.** | Gifts counted as money passed up; hidden milestones paid cash (cash created outside the ledger) and standing for goals never chosen; informing with nothing to tell earned trust; unlimited shifts. |
| R8 | **Each screen applied its own rule to the same question.** | Rackets said "no shop worth leaning on" while conversation allowed any pitch; rival family trees and city-wide protectors shown in full; "Lean on it" leading to "That moment has passed". |

---

## 2. Changes made

### Authoritative records and the one read interface
- **`src/commitments.ts` (new, read-only).** `commitmentsOf(w, p)` reads every commitment from the record that owns it:
  - **work:** `w.jobs`;
  - **promises:** `social.obs`, plus the old promise memos still in saves;
  - **favours:** `w.favours`, with legacy favour memos read as the favour they stood for;
  - **terms and threats:** memos;
  - **money:** `w.debts`.

  *Your word* and World's "falling due" list now read only this. No synchronisation code was added.
- **Jobs (`jobs.ts`).**
  - The lifecycle is explicit: offered → active (with a new `accepted` time) → done → reported → rewarded; or declined, expired, failed.
  - `objectiveMet()` / `reached()` complete a job when what it asked for is done, however it was done: the shop pays the player, or the target has been dealt with.
  - This runs before any staleness pruning, on agreement (`doors.agree`) and after every conversation act.
  - An unsettled pitch keeps the job open. Accepted work is listed on World as "Work you took on", and finished work as "Tell X how it went".
  - The captain's memory distinguishes done, failed, declined, "it sorted itself out" (taken but no longer needed) and genuinely ignored.
  - No new work is handed out while his last is still in hand.
  - A summons is never a job to "take care of".
- **Favours.** "Put in a word" and backing are recorded once, in `w.favours`. The duplicate favour memo is no longer written.
- **No man is his own counterparty.**
  - `tick.request()` closes any request whose asker, beneficiary or askee is the man it is against.
  - `mkJob()` never records a giver equal to the assignee.
  - Escort work on the player's own shops comes from the owner.
  - A shopkeeper the player leans on says so to his face ("You know what's on my mind. You're looking at it.") rather than asking him for help against himself.
  - Promises made in person are linked to the man's own pursuit, so he waits on the promise instead of asking again.
- **Speech.** Every line a man speaks passes through `speechFor`, which now also turns the listener's name into "you" with the verbs agreeing. A man is never attributed by his own full name in front of you.

### Conversational continuity (phase 3)
- **Restating isn't repetition.** "Again" is now keyed on the player's own choices (`Thread.picked`). Coming back to something he raised gets "Like I said, …" or "My answer's the same". A brush-off happens only when the player really repeats himself.
- **The loan is one negotiation** (`Thread.loan`).
  - Arguments accumulate and none is offered twice.
  - Each gets its own answer: rate, word, reputation, a broken record, "can't spare it".
  - The last one closes the negotiation.
  - The rate shaken on is the rate owed.
- **His questions stay open.** A question he asked stays open across "Something else…" (`Visit.waiting`). Leaving unanswered is noticed.
- **Work he raises is answered at once.** A job raised in conversation is answered then and there, and "About that work you mentioned" replaces "You had something for me?".
- **The hour matters.** A coffee in the morning, a drink in the afternoon, an evening at night; only the evening ends the visit.

### Context and roles (phase 4)
- `takeOn` and the incident questions speak from the speaker's role (victim, actor, bystander) and the event's kind. A deal (`DEALS`) is discussed as business: how it came about, who else has a claim.
- Amends (an apology) has its own reasons and replies, not an offer's.
- "Everybody pays" belongs only to money demands.
- Incident topics and event labels say "you" and "me", never the man's own name back at him.

### Consequences reach the player (phase 5)
- **`src/inside.ts`:** an arrest opens an account, however it began: the weekly heat, a job, a raid or a federal sweep. Release closes it with how long, why as far as he could tell, the money, his share, his backer, the shops, rackets and work lost, broken promises and what was done to him. World shows it once, as "Back on the street".
- **`src/imposed.ts`:** a decision made over the player's head is told to him by the man who made it, and he can take it, ask why or object. That man remembers which. This is used for:
  - settlements paid from his money;
  - a share raised for ignoring summonses;
  - being roughed up;
  - being taken to task.
- **Gaining or losing a backer** is announced with its reason (`path.backingTick`).
- **Standing changes** carry their reasons to the screen ("Standing −3: not coming when sent for"), from `core.repute` (`standingWhy`, kept to the last 12).
- **The money summary** now includes stakes, wages, living costs and dues.
- **The clock** says what stopped it ("Something new is on offer").

### Progression (phase 6)
- Gifts don't count as money passed up (`deeds.tribute`).
- Milestones pay nothing out of nothing; they're markers.
- The captain speaks progress in words ("You've hardly passed anything up"), never tallies.
- A backer's conditions are concrete and recorded: envelope in person, work finished, word kept.
- A newcomer is "unproven", not "trusted".

### Exploits (phase 7)
- **Informing** needs something real (money seen missing, a known deed) and is told once. A dislike is heard as an opinion.
- **Day jobs:** one shift a day and five a week; a week away and he is let go.
- **Loans:**
  - need a borrower who needs it;
  - no calling a loan in before anything is due;
  - no borrowing from a man who owes the player.
- **Options require authority and means:**
  - no "send the boys in" without men;
  - no laying hands on a made man of his own family;
  - "straighten yourself out" is never said up the ladder;
  - "ready for more" and "look at my number" only once there is a record.
- A dead man's work ends with him.

### Voices and writing (phase 8)
Debtors, backers, envelope scenes and protection counter-offers now vary by character type and circumstance. Claims are grounded in the record: the lawyer request reads past releases.

Grammar and wording fixed:
- one-fact-inside-another retellings no longer garble;
- "you" verb agreement, and "picked you up";
- names capitalised;
- "About leaving Teddy alone";
- the lender says "if you need it";
- christening/funeral "at" and "from";
- club hours in words.

### Information boundaries (phase 9)
- **Another family's tree** shows its boss and underboss, then only men the player knows. There's no succession order and no view of other families' quarrels.
- **Shop protectors** are known on his own streets or where he has been or heard (`acquaint.knowsProtection`). This applies on the shop page, in the city list and in the burglary list.

### Contradictions (phase 10)
- **Protection:** one leanable-shop rule (`authority.leanable`) serves Rackets, conversation, the guide and "Lean on it".
- **Summonses:** coffee is a word with him at the club, and "He isn't available" now says why and when.
- **Night jobs** happen on their night.
- **Refusals** are opportunities, not "Needs you".
- **Stakes** show on the owner's page.
- **Invitations** are distinct occasions and paced.
- **The background debtor** is acquainted.
- **Dates** use one format.
- **Choices 10+** can be picked with two digits.

### Save compatibility
Every new field is optional with a safe default:
- `Job.accepted`
- `Character.inside`
- `Character.standingWhy`
- `Character.spoke`
- `DayJob.last`
- `DayJob.wk`
- `Visit`/`Thread` state, which is never saved

No migration was needed. Old saves load (the `compat` tests pass) and old favour memos are read as favours.

---

## 3. Regression evidence

**`src/tests/experience/` (new)** is a reusable harness (`play.ts`). It plays conversations as the screen does and records structured turns. It also reads the records directly:
- self-requests, self-jobs and self-promises;
- third-person self-reference;
- the player speaking of himself, or of the listener, as somebody else;
- false repetition (keyed on choices).

Its files:
- **`roles.test.ts`:** self-reference (3 seeds), the captain, victim speech, deal-vs-crime, apology.
- **`commitments.test.ts`:** the job lifecycle (2 seeds), work never re-offered, no self-given work over 60 days, promises in *Your word*, the favour record, a question surviving navigation, no asking again after a promise.
- **`continuity.test.ts`:** the first follow-up (2 seeds), loan arguments (3 seeds), a legitimate repeat, morning coffee.
- **`consequences.test.ts`:** a settlement told, a share raise told, an arrest account.
- **`exploits.test.ts`:** informing, shifts, loans, gifts, milestones, progress talk, rank and means.
- **`knowledge.test.ts`:** rival trees, protectors, one leanable rule, refusals, dates, the background debtor, night jobs.
- **`walker.test.ts` (property):** every kind of man (captain, family, shops, rivals), three walks each, at days 0, 20 and 45, on seeds 3, 7 and 11. It checks every rule above plus "never the same long line twice".

**Before:** 20 of 27 scenarios failed on the deployed build (`docs/coherence/before.txt`, captured before any fix). The walker found 13 to 26 problems per seed.

**After:** all experience scenarios pass, and the full suite result is in section 6.

**Existing tests changed, each named:**
- **Gate 4 parity:** six interactions now differ from the old engine on purpose, each recorded with its reason under the test's own `differs` mechanism:
  - work taken;
  - a word put in;
  - backing, on his terms;
  - backing, haggled;
  - backing, what he needs to see;
  - a concern about a man.
- **A regression fixture** gave a job no assignee (impossible in play).
- **The union-shift test** worked three shifts in one day (now one a day).
- **The situations fixture** now clears the pacing of the situations it clears.

---

## 4. Browser playtest diaries (after the repair)

All four playthroughs ran in the real build in the browser pane, each in a fresh origin: `e`, `f`, `g` and `h.localhost`. The user's own save wasn't touched.

### E: cooperative (Small Businessman; captain Vincent Moretti)
- **Day 0, 08:00.**
  - The rail says "Reputation: unproven" and the intro sends the player to Business, not "Rackets".
  - Asked for work, Vincent puts Bellini's Funeral Home to him with the answers right there. "Talk about something else", then back: "About that work you mentioned." / "So. Will you take care of it?" There is no "Short memory".
  - Taken. World shows *Work you took on: Bring Bellini's Funeral Home under the family. Go and see Vito Bellini and put it to him.*
- **Day 0, Vito Bellini.**
  - "$95 a week" → "I don't know you" → "Ask around. Gaetano Scalise, Corrente family." → "$60 I could do…" → agreed at $60.
  - World immediately shows *Done: Tell Vincent Moretti how it went*. Vincent: "Well? 'Bring Bellini's…'. How did it go?"
  - The report is taken and Trust, Respect and Standing go up.
  - "What would it take?" gets "You've hardly passed anything up… Right now nobody would [speak for you]". No tallies.
- **Teddy.** A morning coffee "at the club, over the morning papers", and the visit goes on.
- **Sal Moretti, a loan.**
  - Refused ("I'd like to see my money again").
  - "I'm good for it" → "Everybody's good for it, until they're not."
  - "8 percent" → a counter of $300 at 10.
  - Taken. The first try recorded the debt at 6% in the memo, not the 10 agreed; that was fixed but not re-checked in the browser.
- **Week 1.**
  - "Vincent Moretti will speak for you." The milestone is noted without pay.
  - The envelope is handed in person, each captain in his own manner. This exposed "I was starting to worry" when on time, which was fixed.
- **Week 2.** Vito's shop was robbed. As his protector, the player "Find the men who did it", and Vito sends wine.
- **The invitation** reads "Mario's niece's wedding".

### F: aggressive (Connected Family; captain Richie Silvestri)
- **Business › Protection** lists four shops on day 0, each leading to its owner. Before the repair it said "No shop worth leaning on".
- **Leaning on shops.** Paulie was pressed into $120. Nate Lupo and Russo countered. Jimmy Ricci, frightened: "I— $35? Could it be $35?…".
  - The owners' counters used to be one shared line; they now vary.
  - Pressing again gets a legitimate "I told you already". "says Jimmy Ricci" full-name attributions were found and removed.
- **A smash-and-grab** at a jewellers the list said was "not paying anyone's protection" turned out to pay the Marchetti family. Fixed: the list now says what the player knows of protection, and "Lean on it" no longer dead-ends in "That moment has passed".
- **A week later:**
  - World reports a robbery at a shop he collects from, "heard from Paulie Bianchi". The source line said Paulie "heard it somewhere", though it was his own shop; fixed.
  - The backer announcement and the envelope due both appear.

### G: ambitious (Bookmaker; captain Richie Leone)
- **The background debtor** Stevie Neri: "You know each other." Before, it said "You haven't met". "Pay what you can now" isn't offered before anything is due.
- **A job done from World's job screen:**
  - Vincent's work was taken, then done through the job's own screen ("Lay it out plainly").
  - The owner said no for now, and the old code failed the job. Vincent later: "That was a mess."
  - Fixed: an unsettled pitch keeps the job open, and the conversation no longer opens with an invented "better answer than last time".
- **No more work was available** ("It finds you"). A burglary tip failed on its own dice.
- **Advancement was not followed to induction.** The ambitious climb wasn't replayed to being made: see section 6.

### H: passive (Street Hustler, five weeks of waiting)
- **Week 1:** −$20, then "Mickey Barone will speak for you".
- **Week 2:** "Standing −3: not coming when sent for". He was sent for while the player sat through a full week.
- **Week 4:** "Mickey Barone has stopped speaking for you. He hasn't seen you in weeks. A man doesn't speak for a stranger."
- **Week 5:**
  - "Standing −5: not coming when sent for, what people heard."
  - "Mickey had you roughed up" appears as *Decided over your head*: "Two of Mickey's men catch you outside… 'He sent for you twice. You didn't come.'"
  - *Ask him why* gets "When I send for a man, he comes…"; the player can take it or object.

  The previous passive run saw nothing of this.
- **Money:** the weekly −$20 had no reason on screen. The chip now says it is a week's living; fixed after the run, not re-checked in the browser.

---

## 5. Before and after

| Playtest failure (before) | Now |
|---|---|
| Mickey: "Lawrence wants money off me… Can you do anything?" (said to Lawrence) | "You know what's on my mind. You're looking at it." The protection matter is what can be answered. No request against the player exists (`selfRequests` is empty across 3 seeds × 3 dates). |
| Captain's job taken in conversation: never shown, never completed, then "You didn't want it, I suppose"; deeds at 0 | Shown as *Work you took on*, completed when the shop agrees, then *Tell X how it went*. "Well? … How did it go?" and the deeds count rises (browser, E; test, 2 seeds). |
| "You had something for me?" → "We just went over that. Short memory?" | "About that work you mentioned." → "So. Will you take care of it?" |
| Loan: "Keep up", "Again? We just did this", options cycling | Each argument answered on its own terms, none offered twice, the last one closes it (3 seeds; browser E). |
| Victim asked what he'll do: "If it were mine…" | He answers from a victim's lines, by his temperament (test; not seen in the browser). |
| Apology: "What's the catch?" → "No catch" → sweeten | "We'll see whether you mean it" / "Saying sorry is easy"; "I'm not asking you to forget it. Let me make it right." |
| 33 days in jail: "Something has come up" | "Back on the street": how long, why, what it cost, and what changed. |
| −$248 settlement, never told | Told by the man who settled it, with the amount, the reason, and take / ask why / object. |
| "$0 of $3,000 passed up… 1 of 3" | "You've hardly passed anything up. Nobody puts a name forward for a man short of it." |
| Rackets: "No shop worth leaning on" vs pitching any owner | One list: Rackets and conversation agree (test). |
| Day 0 "Reputation: Trusted" | "unproven". |

---

## 6. Remaining limitations (stated plainly)

### Not demonstrated in the browser
- **Being made (scenario 7, advancement).** The job loop now counts work and the road reads naturally, but no browser run was carried to induction. Doing so takes several in-game months of ambitious play, which there wasn't time for. Advancement is covered by unit and scenario tests, not by play.
- **The Mickey self-reference case.** In the browser every owner countered rather than refused, so this was demonstrated by the automated scenarios (3 seeds) and the walker, not in play.
- **The settlement-over-your-head flow.** Shown by test. In play, the same mechanism (imposed) was seen for a beating.

### Not changed, by choice
- **No new progression design.** The thresholds are unchanged; they are a balance decision for you:
  - every man starts at standing 40 and the soldier's "name" goal is 30, so that goal is met at once;
  - $3,000 passed up for soldier.
- **Day-job pay** still comes from nowhere outside the porter's till. Only the frequency was limited.

### Known rough edges
- **"Find the men who did it"** still narrates "two days later" without time passing.
- **The burglary list** names shops in any district, though it now says when the player doesn't know who protects them.
- **A rival family's member count** is "men you know of, and more you don't".
- **Writing variety** is improved for debtors, backers, envelopes and protection counters, not across every interaction. Many interactions still have one line per meaning.

### Coverage
- **Walker:** 3 seeds × 3 dates × about 11 men × 3 walks.
- **Not walked:** made-man and capo play, crew management at scale, the Commission.

---

## 7. Updated assessment (scores out of 10; previous playtest in brackets)

| | Score | Why it moved, or why not more |
|---|---|---|
| Conversation quality | **6** (4) | False repetition, self-reference and wrong templates are gone where tested, and negotiations develop. Many lines are still one per meaning, and some old phrasing remains. |
| NPC intelligence and consistency | **6** (4) | Men remember work rightly, don't ask the player to act against himself, and wait on a promise instead of asking again. Their reasons are still simple. |
| NPC autonomy | **6** (6) | Unchanged underneath. More of it now reaches the player. |
| World coherence | **6** (4) | One record per commitment, one rule per question, and the information boundaries are respected. A few lists still disagree (burglary). |
| Player agency | **5** (4) | Decisions over his head can be answered; work can be done his own way. Violence is still cheap in places. |
| Progression | **4** (2) | Work counts however it is done; gifts and milestones no longer buy it; backers' conditions are readable. The climb itself is still long and unvalidated in play. |
| Gameplay variety | **4** (4) | Not this brief's subject. |
| Immersion | **6** (5) | Hours, places, voices and dates are more consistent; numbers no longer appear in men's mouths. |
| Interface usability | **7** (6) | Work in hand, things to report, decisions over your head, and the time inside are all on World. |
| Overall enjoyment | **5** (4) | The first hours now make sense, and passive play produces consequences you can feel. The mid-game loop is unchanged. |

**The standard asked for**, "characters understand who they are speaking to, what has happened, what they know, what they want, and what they have already said":
- It is now met in every case the playtest found and the walker checks.
- It is not yet met everywhere the game can go.
