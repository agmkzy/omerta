# OMERTÀ: simulation invariants and the development doctrine

Status: permanent (adopted 28 October 2026, from the owner's *Permanent Development Doctrine*). `CLAUDE.md` carries the operational
summary; this is the full statement. The register of systemic issues found and fixed is `INTEGRITY.md`, beside this file.

## The doctrine, in short

OMERTÀ is one persistent world. What is true in one system must be true in every other, and characters may be wrong, dishonest or
irrational, but the simulation must always know why. A dishonest captain is gameplay; a captain who knows something impossible is a
defect. A broken promise is gameplay; a forgotten one is a defect.

**Fix the class of problem, not the instance that exposed it.** A reported inconsistency is a diagnostic example. Before a nontrivial
fix, establish:
- **A. What happened.** **B. What should have happened**, by the simulation's own rules. **C. Which invariant** (below) was violated.
- **D. Why it was possible**: trace it to the mechanism. **E. Where else** the same mechanism can fail (search by mechanism, not by
  wording: every route by which, say, hidden financial truth reaches a character).
- **F. The scope of the fix**: local branch, shared function, domain system, world model, information architecture, or presentation.
  Classify the failure as *local*, *systemic*, *duplicated responsibility*, *missing simulation concept* or *presentation-only*, and
  choose the smallest reliable change that removes the class.

Prefer one authoritative rule used by every consumer over several patched copies; but centralise genuinely shared rules, not
superficially similar code. New features join the existing world model (commitments, knowledge, matters, ledger, hierarchy); they
do not become parallel islands with their own source of truth. Remove redundant or weak mechanisms when found, protecting the
player's agency (moving an interaction is not removing a capability). Apply all of this proportionately: a typo is a typo; but
anything touching knowledge, authority, identity, causality, persistence, autonomy or shared state is presumed systemic until shown
otherwise.

**Validate at four levels**: technical validity (it runs), simulation consistency (the world obeys its rules), gameplay coherence (it
makes sense to the player), gameplay quality (it is worth engaging with). Tests check invariants across ranks, relationships and
odd-but-valid circumstances (adversarial scenarios: changed families, deaths mid-matter, shared names, lies, acting bosses), not only
the example reported. Player-facing changes are also judged in transcripts and in the browser.

**Report** for substantial work: what changed; why that scope; what wider failure class was examined; how consistency was
established (shared rules, invariants, tests); what play showed; what remains imperfect. Never claim a class eliminated because a
finite audit is clean; distinguish what was verified from what is assumed.

**Workflow**: understand → diagnose/design → scope → implement coherently (removing what it supersedes) → validate broadly → validate
the experience → record (here and in `INTEGRITY.md`) and report.

## The invariants

Each: the rule; where it is owned in the code; who depends on it; what tests enforce it. Owners are the one place the rule should be
decided; anything deciding it elsewhere is a risk recorded in `INTEGRITY.md`.

### A. Information and knowledge
A character can say, act on or be shown to hold private information only with a basis: he saw it, was told it, heard it as rumour, or
infers it from what he has; a lie is a deliberate misstatement he knows to be false; a wrong belief is held in good faith. A
relationship (trust, liking) makes it likelier that something is passed on; it is never proof that a particular thing was.
- **Owner**: facts and knowledge (`core.addFact`, `core.learn`, `Character.known[fact] = { t, from, knowsActor }`); beliefs
  (`conv/beliefs.ts`, `conv/minds.ts`); rumour passing (`conv/doors.passOn`, `rumour.ts`); the hidden truth of a matter
  (`Situation.truth`), seen by nobody.
- **Depends**: conversation answers, encounters, hearings, gossip, reports, NPC decisions, succession politics, the UI ("what you know").
- **Rule for code**: a line said by X about Y's private affairs reads X's `known` facts (or a belief derived from them), never Y's
  private state (`books.skim`, `problem`, `informant`, `rels` of others, `Situation.truth`). Y's private state may drive **Y's own**
  behaviour (a guilty man is nervous), which other men may then observe.
- **Tests**: `dialogue/coherence.test.ts` (provenance cases), `experience/walker.test.ts`, the dialogue crawler; see `INTEGRITY.md`.

### B. Authority and hierarchy
Formal powers follow the current position (`standing.positionOf`: associate, crewman, soldier, captain, underboss, consigliere, acting
boss, boss), not the stored rung alone (a consigliere's rank is a soldier's; his position is not). Influence is not authority. An acting
boss's authority is lent and ends when the boss returns.
- **Owner**: `standing.ts` (status, position, role, seniority), `rank.ts` (the ladder, repair), `orgs.ts` (appointments, consigliere,
  acting), `command.leaveFor` (whose word a deed needs), `conv/relation.tieOf` (what a man is to the player, for conversation).
- **Tests**: `hierarchy/*`, `organisations/*`, `dialogue/coherence.test.ts` (requests up, orders down at five seats).

### C. Identity and perspective
Every line has a speaker and a listener; a man is "I"/"me" in his own mouth, the player is "you" to his face, a third party goes by a name
that cannot be confused with either of them or with the player; the dead and the departed are not spoken of as present.
- **Owner**: `conv/persp.ts` (`nameIn`, `ref`, `possessive`, `article`, `curly`); the speech pass `conv/acts/words.speechFor`, applied to
  conversation lines (`conv/run.ts`) and encounter lines (`encounters.addEnc`, `encounters.choose`).
- **Tests**: `dialogue/coherence.test.ts` (audit at every seat; encounters at every seat), `experience/walker.test.ts`.

### D. Causality
Every consequence has a recorded cause (a fact with `cause`, a commitment broken, a decision made). Nobody remembers a threat that was
never made; a boss does not act on advice he rejected; a betrayal points at a broken commitment.
- **Owner**: facts (`Fact.cause`, `Fact.story`), commitments (memos, favours, debts, asks), matters (`situ.ts`, `matters.ts`).

### E. Persistence and memory
What matters persists in the world's own records (memos, favours, debts, backers, matters, career records, facts, the conversation's
topic memory `social.talks` for what was asked and answered); nothing keeps a second private copy of the same event.
- **Owner**: those records; `conv/kit.remember / lastOf` for what was said between two men.

### F. NPC autonomy
An NPC decides by his own knowledge, temperament (`temper.ts`), interests, relationships and circumstances. The player proposing
something is not the NPC agreeing; advice is weighed, not obeyed; an accusation is answered as the accused man would answer it.
- **Owner**: `conv/decide.ts` (decisions with terms and grounds), `conv/deciders.ts`, `conv/minds.ts`, the domain deciders (`asks.ts`,
  `command.willOf`, `hearing.ts`, `charge.ts`, `contest.ts`).

### G. Shared world state
One authoritative record per thing; screens, conversation, matters and the ledger read it; disputed accounts are character
perspectives over one record, not two records.

### H. Economic integrity
Money is conserved and every movement is a recorded transaction; what a man reports is not what his business earned.
- **Owner**: `ledger.ts`, `econ.ts`, `books.ts`; `consistency.audit`, `ledgerCheck`. **Tests**: `economy/*`, every long run.

### I. Temporal consistency
Events happen in order on the one clock (`engine.ts`); nothing reacts to what has not happened; later decisions do not rewrite earlier
records; the season and date in what is said fit the calendar.

### J. Conversational coherence
Player intention → the NPC's interpretation → his response → the resulting state → the follow-ups that state allows. A refusal is not
an agreement; a denial is not a confession; a question is not answered before it is asked; follow-ups assume only what was said.
- **Owner**: `conv/run.ts` (performing an act, repeat memory), `conv/visit.ts` (the visit, what is offered), `conv/acts/*` (each act's
  offers, run and follow-ups), `ui/talk2.ts` (presentation only).
- **Tests**: `dialogue/*`, `conversation/*`, `experience/*`, the audit tools `src/tests/tools/convaudit.ts` and `encaudit.ts`.
