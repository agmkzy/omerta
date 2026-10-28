# Integrity register

Systemic issues found and how they were resolved, so that the same failure is not met twice. One entry per class, not per instance.
Invariants are lettered as in `INVARIANTS.md`. Newest first.

## Open risks (seen, not yet resolved)

| # | Risk | Invariant | Where | Notes |
|---|---|---|---|---|
| R1 | Third parties speaking from another man's private state (skimming flags, problems, the hidden truth of a case) instead of from what they know | A | hearing witnesses (`hearing.askAround`), the consigliere's report (`conv/acts/family.ts fam_hear`), the underboss's "find out why" (`charge.ts`) | Being resolved in the conversation deepening pass (entry 6) |
| R2 | Outcomes narrated as compliance ("does what you said") where the NPC's decision is not shown or not his own | F, J | the consigliere's advice (`hearing.advise`), several `answer`-style encounter outcomes | Being resolved in the deepening pass |
| R3 | Seniority and "who is above whom" decided in several places | B | `conv/relation.tieOf`, `conv/acts/org.ts stanceOf / superior`, `conv/acts/personal.ts superior`, `command.leaveFor` (`SENIORITY`), `rank.ts` | Candidates for one rule; they agree today on the cases tested |
| R4 | Position read from the stored rung (`c.rank`) where the office differs (a consigliere is rank `soldier`) | B | scattered `rank === 'soldier'` / `'capo'` tests | Use `standing.positionOf` where the office matters |
| R5 | Record text (facts written in the third person, with ledger figures) used as speech | A, C | rumours and reports passed on in conversation and encounters | The speech pass now rewrites the speaker and player; figures were removed from raid and robbery facts; other fact kinds still carry amounts |

## Resolved

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
