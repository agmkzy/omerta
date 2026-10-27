# The Family: audit of the hierarchy (27 October 2026)

The owner's brief: six positions (associate, soldier, captain, underboss, consigliere, boss), each a different game in the same family,
playable from a new game, with rank deciding what a man is *entitled* to do and his relationships deciding what he can actually do.
This is what exists, read from the code, before anything is changed.

## 1. What works
- **One door for rank** (`rank.applyRank`): rank, wage, career record, the historical fact, then `repairHierarchy`, which keeps every
  family valid (a living boss heading it, everyone answering to a living senior man of his own family, no loops). `hierarchyIssues`
  reads the same rules for tests and `audit()`.
- **Families as records** (`orgs.ts`, V76): history, leader and since when, standing, treasury with a ledger that reconciles, relations
  between organisations, unrest after a contested succession, headquarters. Membership is read from the characters, never stored twice.
- **Scored succession** (`orgs.candidates/chooseLeader/succeed`): rank, authority, support of the men who matter, reputation, a named
  heir, the consigliere's small weight; death, long imprisonment, retirement, stepping down and a successful plot; consequences after.
- **An acting boss** (`fam.acting`), chosen automatically when the boss is inside more than three weeks; steps back when he is out.
- **Membership churn**: retirement, expulsion, defection to another family, and a passed-over captain founding a splinter group.
- **NPC careers** (`career.careerTick`): soldiers and captains made when seats open and a man's road is done (with a trial before being
  made), the underboss's chair filled from the captains the boss rates, men passed over resenting it, the player passed over noticing.
- **The player's road** (`path.ts`, `career.promoTick`): sponsor, rival, the boss, a decision; the made-man induction as a ceremony.
- **Crew and authority for a made man** (`authority.ts`, `crewlife.ts`, `orders.ts`): men come to be taken on, the captain hands him a
  man, quarrels between his men come to him, he answers upstairs for them; orders his men carry out their own way, with honesty and
  reliability; Sunday envelopes.
- **Matters and situations** (`situ.ts`, `matters.ts`): one record for anything unresolved between people, with parties, what each
  knows, history and an ending; designed around "what the player can do from where he stands: in it, close to someone in it, or only
  hearing about it". This is the natural place for one situation to be lived differently at each rank.
- **The economy** (just built): enterprises with operators, stakes, captains wanting a piece, the player as captain covering and
  ruling between his men and deciding who gets a dead man's racket.
- **Knowledge**: men know only what they saw or were told, and can believe the wrong thing; the base a consigliere's work needs.

## 2. What is incomplete
- **Above soldier, rank is a menu.** `powers2.powerOptions` gives each rank a list of one-click levers with cooldowns ("Tax the
  captains", "Rewrite the rules: tighten the kick-up", "Convene the family council", "Christmas envelopes"). They move numbers; they are
  not situations with people in them. This is the "rank-specific menus" the brief rules out.
- **The underboss's agenda** is three random encounter types (a captain wants to expand, two captains and territory, a captain wants
  money), rolled at 40% a week.
- **The consigliere is a field** a player-boss can fill (`powers2.setConsigliere`). No NPC family has one at the start; nobody can play
  one; what he does is pass the boss one fact a week.
- **The player can never be acting boss**, and is excluded from NPC acting appointments.
- **Starts**: every new game starts the player as an associate in the first family, under its second captain. No other position.
- **Formal authority versus practical control**: there is one notion (rank), plus scattered measures (`books.influence`, support in
  succession, the Commission's support). Nothing says whether a man would actually do what a superior tells him, or why not.
- **Orders** exist only from the player to his own crew (`orders.ts`), and from NPC superiors as jobs. A captain cannot direct a
  soldier's choices beyond errands; an underboss cannot direct a captain; nobody can decline an order for a reason.
- **Demotion and removal** exist (put down to soldier, shelved while inside) but are not playable afterwards: the removed man's
  influence, friends and grievance are mostly a grudge.

## 3. What is inconsistent
- **Families are thin**: one boss, one underboss, two captains (a few families have more), two or three soldiers each, up to two
  associates each: about fifteen men. Too few for a boss or underboss to govern, or for a captain start to have a real crew.
- **"Associate" means two things**: a man on the family's record attached to a made man, and a man who runs with an associate
  (`career.isRunner`: an associate answering to an associate). The player's own men, when he is an associate, are labelled associates
  like him.
- **Information** is the same at every rank: the boss reads the same Today as an associate, plus his own encounters. Higher rank doesn't
  change what reaches a man or how reliable it is.
- **Dialogue** has rank in places (register, how a man addresses the player) but most acts don't depend on the speakers' positions.
- **The underboss and boss powers** act instantly and completely ("Order every crew to push harder"): no one resists, delays or asks why.

## 4. Preserve
- `applyRank` and `repairHierarchy` as the one door and the invariants; `hierarchyIssues` and `orgIssues` in `audit()`.
- The family record, treasury, succession scoring, acting boss, churn, splinter groups.
- The player's road and the induction ceremony; NPC careers and trials.
- The crew and authority systems, orders and reports; the matters/situations engine; the economy's enterprises.
- Save compatibility (SCHEMA 7): every new field optional, every older career kept.

## 5. Redesign
- **Rank powers** become situations and decisions with people in them, not a list of levers; what genuinely belongs to a position
  (a captain's say over who in his crew runs what; a boss's appointments) stays, as decisions with consequences.
- **The underboss's agenda** becomes delegated objectives from the boss, arising from what is actually wrong in the family.
- **Information by position**: what reaches a man is shaped by where he sits and who reports to him, and reports carry the reporter's
  interest (incomplete, late, coloured).
- **World generation** of families: enough men for a boss to govern and a captain to command; a consigliere in every family.

## 6. Introduce
- **Positions as offices**, separate from made status: soldier, captain, underboss, consigliere, boss, and acting boss as a temporary
  appointment. (Consigliere is an office held by a senior made man with no crew of his own, beside the boss, not a rung on the ladder.)
- **Four kinds of power, kept apart**: formal authority (from the office), economic power (rackets, businesses, earning network),
  personal influence (favours, reputation, relationships with men who matter), practical control (who would actually follow him).
- **Authority with reasons**: whom a position may direct and what needs a superior's leave; an order answered by a man's own
  motives (comply, object, delay, negotiate, refuse), never at random; breaches of authority recognised and answered.
- **One situation, lived by position**: the hierarchy decides each man's relation to a situation (carries the message, is involved, is
  responsible, arbitrates, investigates, judges); the player's position gives him his part.
- **A loop for each position** (the brief's six games), the consigliere's built on the knowledge system (conflicting accounts, what
  each man saw or was told, advice the boss may take or not).
- **Starts at every position**, each in a coherent family with history.
- **The family's structure on screen**: who holds each office, who answers to whom, which seats are empty, how it has changed.

## Risks
- **Scope.** Delivered in increments, each deployed and playable.
- **Rank order is read in about 150 places** (`LADDER.indexOf`). Offices are added beside rank, not as new rank values, so none of
  those comparisons change meaning.
- **Notification spam** at high rank. The rule from the economy holds: routine runs itself; only real circumstances reach the player.
- **Save size** with larger families: measured as families grow.

## The owner's five principles (27 October, after the first draft of this audit)
1. **Proactive agency at every rank**: things to pursue, not only situations to answer.
2. **Shared activities, different consequences**: nothing is forbidden by rank; the same act means something different from a boss
   (collecting a debt himself undercuts his captain) and from an associate (it impresses his sponsor).
3. **A complete career at every position**: staying is a choice, with ambitions of its own (the best earning network in the crew,
   loyal capable men, being indispensable to successive bosses, a stable family and a successor).
4. **Status, position and role are three things**: *status* (associate, or made), *position* (soldier, captain, underboss,
   consigliere, boss; acting boss as a temporary appointment), *role* (crewman, driver, collector, racket operator, lieutenant). The
   men in a player's own operation are **crewmen**, whatever their status; taking a man on never makes him a member, and giving him
   responsibility never changes his standing. Only the family's authorised induction makes a man.
5. **Measurable progress, political promotion**: (A) a career record of what a man has demonstrated, (B) how the family regards him,
   (C) an appointment someone actually makes, for reasons; a Career view that shows all three as the player could know them.

## Promotion today (audit of the road, `path.ts` and `career.ts`)
| measure | today | verdict |
|---|---|---|
| Money passed up (`lifetimeKick` against $1,500 / $10,000 / $20,000) | a hard gate | keep as the **earning record**, but read the recent run as well as the lifetime sum |
| Jobs finished (3 / 3 / 6, his own and his men's) | a count | arbitrary: replace with **service** (work done for superiors) and **criminal experience** (what kinds, how well) |
| The family's hard work (1 for underboss) | a count of violence on orders | fold into experience; violence ordered by the family is service, not a gate |
| A name (`standing` 30 / 40 / 50) | reputation | keep as **reputation** |
| Backers (3 made men at trust 0.4; boss and underboss at 0.5; boss at 0.6) | trust thresholds | keep as **organisational standing**, widened: respect, grudges of powerful men, political support |
| The trial (before being made) | a played job | keep: the induction's proof, part of the decision, not a checklist item |
| A seat | `vacancy`, or the boss opening one for a finished road | keep as **organisational need** |
| Readiness | finished road, then a coin toss among candidates | becomes the appointment: the man who decides weighs the candidates by record, standing and his own interests |
| Underboss | a captain the boss rates, or the boss's pick after a season | becomes an appointment with reasons, and no automatic step to boss |
| Boss | "the chair is taken, not given" | keeps succession politics (`orgs.candidates`); no automatic underboss succession |
| Consigliere | none | an appointment by the boss for judgment, discretion, credibility and trust |

Missing dimensions the record must add from what is already recorded: **reliability** (envelopes on time, word kept or broken, jobs
failed), **leadership** (men supervised and for how long, orders carried out, quarrels settled, men under him who rose), **discretion**
(heat kept down, arrests, nothing said inside), **service** (work for superiors, favours done the family), **influence** (who trusts
him, who owes him, made men who would speak for him).
