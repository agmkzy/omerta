# Integrity register

Systemic issues found and how they were resolved, so that the same failure is not met twice. One entry per class, not per instance.
Invariants are lettered as in `INVARIANTS.md`. Newest first.

## Open risks (seen, not yet resolved)

| # | Risk | Invariant | Where | Notes |
|---|---|---|---|---|
| R2 | Older encounter outcomes that narrate compliance without showing the man's decision | F, J | some `answer`-style encounter outcomes in `encounters.ts` | The consigliere's advice is resolved (entry 7); the rest not yet reviewed one by one |
| R3 | Seniority and "who is above whom" decided in several places | B | `conv/relation.tieOf`, `conv/acts/org.ts stanceOf / superior`, `conv/acts/personal.ts superior`, `command.leaveFor` (`SENIORITY`), `rank.ts` | Candidates for one rule; they agree today on the cases tested |
| R4 | Position read from the stored rung (`c.rank`) where the office differs (a consigliere is rank `soldier`) | B | scattered `rank === 'soldier'` / `'capo'` tests | Use `standing.positionOf` where the office matters |
| R6 | Third-party knowledge read from private state in older code (`conv/subjects/life.ts`, `encounters.ts`, `situations.ts`) not yet reviewed against `conv/notice.ts` | A | see the counts in the conversation LOG | Next audit of knowledge provenance |
| R5 | Record text (facts written in the third person, with ledger figures) used as speech | A, C | rumours and reports passed on in conversation and encounters | The speech pass now rewrites the speaker and player; figures were removed from raid and robbery facts; other fact kinds still carry amounts |

## Resolved

### 9. A question put to the player with no way to answer it; a matter move followed by nothing
- **Symptom**: the boss asked "Are you?" and the conversation moved on; the boss challenged the consigliere ("What have you got?") and
  the answers to the challenge were not offered.
- **Class**: J (follow-ups follow what was said). A matter move chosen in conversation returned no follow-ups (`conv/acts/business.ts mt`).
- **Correction**: after any matter move in conversation, the matter's next moves with that man are offered (one change covering hearings,
  the charge and the contest); the boss's question has its answers, and "I'm with you" is a promise kept in the memos.

### 8. Record text inside a man's own quotes
- **Symptom**: "Here's one for you. Sonny has a bag that needs to move", said by Sonny.
- **Class**: C, systemic: job titles are written as records (third person); the job pitch (`jobs.jobSaid`) put every non-imperative
  title inside the giver's quotes. Every such job had its giver speak of himself as another man.
- **Correction**: the title is narration outside his quotes. **Coverage**: the transcript scenarios; the audit lint (self-naming).

### 7. NPCs processing the player's statement instead of deciding
- **Symptom**: "Teddy hears you out, and does what you said"; a challenged crewman confessed every time.
- **Class**: F, systemic in the newer family interactions: outcomes were computed from the player's choice with a token weighing.
- **Correction**: the boss weighs advice by trust, what was actually found (`hearing.weightOf`: the books, an admission, a witness, an
  accuser's changed story, the delegate's view), his own ties to the two men, the stakes and his temper, and accepts, challenges ("What
  have you got?"), refuses, or keeps it to think over and decides later by his own weighing. A challenged crewman reacts as he is
  (admits from fear or lack of nerve, blames a man under him, takes offence, asks what you have), and what is recorded follows what he
  said: a denial is never an admission. *Where do I stand* asked of the boss by his underboss answers from the boss's situation
  (succession on his mind, pressure on the family, the man's reach among the captains, trust). Putting a man's name forward can be
  refused. An introduction gives a reason to talk, not trust. **Coverage**: `coherence.test.ts` (refused advice recorded as refused;
  denial not a confession; admission recorded), transcript scenarios in `REPORT.md`.

### 6. A man's private state read into another man's mouth (supersedes 5)
- **Symptom**: the consigliere, a hearing witness and the underboss's day around a crew all spoke from the accused man's books.
- **Class**: A, missing simulation concept: nothing modelled what men around a man can see of him, so the code reached into his private
  record; and grievances were inferred from private grudges instead of from facts witnessed.
- **Correction**: `conv/notice.ts`: who sees a man's life (`seesLifeOf`: his captain, his men, his crew, the men who work his places,
  the made men at the club, men who know him well) and what they can see (`signsOf`: flush, short, hurt) — signs, said as signs
  ("spending more than his crew brings in"), never findings; grievances only from facts the speaker holds (`heardAgainst`), said as
  seen or as told by a named man. The three consumers use it. **Coverage**: `coherence.test.ts` (a man holding out but living poor shows
  nothing; a grudge kept to himself is not heard; said in front of him, it is).
- **Remaining**: other consumers of private state for a third party's speech have not all been reviewed (R6).

### 5b. Conversation writes outside the doors
- **Symptom**: new family interactions wrote world records directly (a cash transfer, facts, crew membership).
- **Class**: B/H, duplicated responsibility; caught by the existing architecture tests (`conversation/integration.test.ts`: only
  `conv/doors.ts` writes; money only through `core.transfer`).
- **Correction**: the writes moved into doors (`admitHolding`, `stopHolding`, `repay`, `putOut`, `saidOf`, `vouch`).

### 5. A man's private state used as another man's knowledge (consigliere's report) — interim, superseded by 6
- **Symptom**: the consigliere could name a captain's grievance or skimming because the code read the captain's grudge and books.
- **Class**: knowledge without provenance (A); the interim fix substituted trust for "he told him", which the owner rightly rejected as
  the same failure in a different form.

### 4. Encounters bypassed the speech rules
- **Symptom**: a witness said "Angelo Bianchi missed a $20 payment to Charlie Cassano" as Charlie Cassano; listed the player by full
  name among "who knows".
- **Class**: duplicated responsibility (C): conversation lines went through the speech pass, encounter lines did not.
- **Correction**: `encounters.addEnc` and `encounters.choose` use the same pass (`speechFor`, `curly`). **Coverage**: the encounter
  audit at every seat (`coherence.test.ts`).

### 3. Matter moves truncated in conversation
- **Symptom**: leaning on a captain, or advising the boss, chosen in conversation, did nothing.
- **Class**: local, with systemic effect: `mt:` codes were split at the first colon, dropping the rest of any move code with a colon.
- **Correction**: the code is carried whole (`conv/acts/business.ts mt`). **Coverage**: `coherence.test.ts` (charge and advice in
  person).

### 2. Names assembled without knowing who speaks
- **Symptom**: "Louie. All right. If Louie says." (a shopkeeper Louie, of the player's captain Louie); "my 1969 Cadillac" uncapitalised;
  "What went on between Charlie and Lawrence?" flagged as the player when another Lawrence was meant.
- **Class**: duplicated responsibility (C): each line shortened names its own way.
- **Correction**: `conv/persp.nameIn` (first name unless the speaker, listener or player shares it), used by the speech pass, incidents
  and events; capitalisation in the pass. **Coverage**: audit lint (self-naming, player named), walker (third-person self).

### 1. Requests and orders misdirected by rank
- **Symptom**: a captain asking his own soldier to put in a word; the consigliere asking the boss; asking the boss who runs the family;
  street orders to an underboss; offering to run one's own soldier's racket.
- **Class**: duplicated responsibility (B): each interaction tested ranks its own way.
- **Correction**: `conv/relation.tieOf` read by the interactions' availability. **Coverage**: `coherence.test.ts` (five seats, every
  man of the family).
