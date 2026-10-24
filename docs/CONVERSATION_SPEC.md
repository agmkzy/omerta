# OMERTÀ: conversation and social interaction specification

*Revision 3.2, October 2026. A draft for review. It replaces the current conversation system in its entirety. It builds on [SYSTEMS_ARCHITECTURE_AUDIT.md](SYSTEMS_ARCHITECTURE_AUDIT.md), referred to below as "the audit". Nothing here is implemented yet, and implementation does not start until the gates in §15 are passed.*

### Changes in revision 3.2

- §8.3: the notes on choices describe what a promise undertakes in plain words; obligation kinds are never named on screen.
- §17.7: **delivery** of a request to the player is an event. The asker's patience and any resentment run only from delivery, as he believes it; undelivered requests are not refusals.

### Changes in revision 3.1 (final amendments before Gate 1)

| Review item | Where it is addressed |
|---|---|
| Suggested actions vs player-initiated actions: any plausible action stays reachable, whatever its rank | §8.2, §17.2 |
| Limits on incoming requests apply to presentation, never to what NPCs do | §17.7 |
| The four-step flow is a default pattern, not a state machine; participants can change the subject | §17.3 |
| A 30-day repeated-interaction test | §17.9, Scenario G |
| The player learns outcomes through plausible channels, not because the engine resolved them | §17.6 |
| An option must offer a real opportunity, not a guaranteed reward; nothing can come of a visit | §8.6, §10, §17.8 |
| Build in end-to-end playable slices within the gates | §15 |

### Changes in revision 3

| Review item | Where it is addressed |
|---|---|
| Players and NPCs choose actions from what they believe; the world decides what happens (attempt vs execution) | §2.2, §3.1, §8.2, §8.10 |
| A listener never sees the speaker's private intention or honesty | §4.1 (spoken vs private), §4.2, §10, §14 |
| Predicting another man is separate from his actual decision | §7.3, §8.4 |
| Time rules for obligations: early completion, continuing compliance, instalments, deadlines, impossibility and who caused it | §6.5 (new) |
| Effort must be in good faith; secrecy judges the promiser's conduct, not the world's knowledge | §3.3, §5.4, §6.3 |
| Relationship acts write different kinds of social history | §2.4 (new) |
| Gate 1 tests sequences over several visits; Gate 2 split into integration and autonomy | §15 |
| Player experience, simplicity and interaction flow, with a simplicity audit of this document | §17 (new) |

### Changes in revision 2

| Review item | Where it is addressed |
|---|---|
| P0: separate action, effort, result and restraint obligations | §6.3, §6.4 |
| P0: enforce subjective knowledge in every decision | §2.2, §4, §7, and an architecture test in §14 |
| P0: separate actions, agreements, arrangements and conditions | §3 (rewritten) |
| P1: NPC planning dependencies and information gathering | §7 (rewritten) |
| P1: hard constraints separate from negotiable factors | §4.4 (rewritten as two stages) |
| P1: prove language generation before full implementation | §9 (rewritten), Gate 1 in §15 |
| P1: player and NPC capability parity | §8.10, a matrix test in §11.5 |
| P2: access to lower-ranked actions | §8.2 ("Something else…") |
| P2: adversarial acceptance tests | §11.4 |
| P2: retention by significance, not recency | §12.1 |
| §13 of the review: three motives for interacting | §2.3, §4.1 acts, §7.1 sources |
| The tension between banning hand-written scenes and illustrative dialogue | §11 preamble, §15 Gate 1 |

---

## 0. Governing rules

> **Rule 1.** Every spoken line must be consistent with the speaker's knowledge, intentions and circumstances. Every mechanical consequence must follow from what was actually communicated or done.

> **Rule 2.** Dialogue quality and simulation quality are judged separately. Every exchange has a **player-facing scene** and an **interaction trace** (§10). The trace must justify the scene.

> **Rule 3.** Behaviour first, wording second. Different men in the same circumstances must *decide* differently for reasons the trace can show.

> **Rule 4.** A conversation is how a character gets something done with another: changing something, understanding something, or managing what is between them. It is not a way to browse what the game can do.

> **Rule 5.** One model for everyone. The player and NPCs initiate, answer, refer and keep through the same records and the same rules. They choose what to do by different means (the player picks; an NPC plans) from the same set of capabilities.

> **Rule 6.** A character decides from what he believes, never from what is true. Objective state is used only to carry out what was attempted and to check what came of it. This applies to the player's character as much as to anyone.

> **Rule 7.** Increase simulation depth while reducing player-facing complexity. The player experiences people, situations, choices and consequences, never the machinery (§17).

**Design constraints:**

- **Choices on screen.** Typically two to four; five is the absolute maximum. A typical visit takes two to four exchanges (§17).
- **Ranking.** The screen is a view of a larger set the engine ranks; it limits nothing.
- **Approaches.** Offered only when they change the likely answer or carry a real extra cost.
- **What every option must do.** Change something in the world, or in what someone knows or feels. No filler and no turns spent opening a category.
- **The present, not the log.** Show where things stand now.
- **Outcomes are observed and attributed.** Only what the player saw is stated as fact.
- **What may end a visit.** A refusal, silence, or being turned away are legitimate outcomes. Nothing is invented.
- **"Spend time with him"** is one choice, with a short account of what happened.

---

## 1. Scope

### 1.1 What is deleted (only after the gates in §15)

| Module / part | Fate |
|---|---|
| `dialogue.ts` (hub, `options`, `optionsRaw`, `gather`, `groupRows`, `say`, `govern`, `sayOne`, `sayRaw`, `openSubject`, `memoTick`, `arrive`) | Deleted. Effects worth keeping are re-homed as actions, agreements and arrangements (§3) |
| `talk.ts`, `threads.ts`, `flows.ts`, `memory.ts` | Deleted |
| `matters.ts` `opts`/`act`, `sitmoves.ts`, `situations.ts` player moves | Deleted. Matter steps become pursuits (§7) |
| `encounters.ts` scenes | Deleted. Generators become incoming requests from pursuits (§6.8) |
| `meetings.ts` agendas | Re-expressed as group visits (§6.9) |
| `revenge.ts` settle menu, `danger.ts` options, `club.ts` scenes | Deleted. Effects become actions |
| `voicesheet.speak`, option-label banks | Deleted. Lines are rendered from meanings (§9) |
| `ui/talkview.ts`, matter pages' action sections | Rebuilt (§8) |
| Life conversations | Re-expressed on the same model (§6.10) |

### 1.2 What is kept

| Kept | Notes |
|---|---|
| Facts (`core.addFact`) and knowledge (`core.learn`, `rumour.*`) | With the belief fixes in §5 |
| Relationships (`core.feel/regard/bear/ease/knowMore`), temperament (`temper.ts`), archetypes (`voice.arch`) | Unchanged |
| The negotiation core of `asks.ts` (stance, counter-terms, NPC move choice) | Generalised into the response engine (§4) |
| `exchange.ts` reasons and challenges | Folded into reasons and follow-ups (§4.6) |
| Economy, debts, work, rank, organisations, situations, consequences | All actions call their existing doors |
| `voicesheet` `say` banks | Reused as raw material for the renderer (§9) |

### 1.3 Not in scope

- Stage 6 locations.
- New economic or violent mechanics. Where an action needs a capability the world lacks (a captain mediating for a civilian), this document says so, and it is added deliberately.

---

## 2. Core model

### 2.1 At a glance

```
          OBJECTIVE WORLD (true state)                         PERCEPTION (per character)
  facts · relationships · money · ranks · arrangements   ──▶  beliefs · claims heard · uncertainty
                ▲                                                      │
                │ carry out / check                                    │ the only input to decisions
                │                                                      ▼
   Actions ◀── Agreements ◀── Response (two-stage decision) ◀── Interpretation ◀── Utterance (said / meant)
   (one-off)   (recorded      1. constraints: authority, orders,      (listener's
               terms)            obligations, resources, knowledge     inference)
      │            │          2. evaluation: interests, relationship,
      │            ▼             arguments, risk
      │      Arrangements (ongoing: protection, a loan, a share)
      │            │
      ▼            ▼
   Conditions (desired states, checked against the world) ◀── Obligations (action / effort / result / restraint)
                                                                   │
                                                  Pursuits (objectives, plans, dependencies, unknowns)
```

### 2.2 Objective, perceived and uncertain

Every decision function receives a **perception**, never the world. A perception is a read-only view built for one character:

```ts
interface Perception {
  self: Id; at: number;
  knows(fact): Knowledge | undefined;                // core.learn records
  believes(proposition): { p: number; basis: Basis[] } // §5: belief with its grounds, 0..1
  identityOf(c): { known: boolean; family?: Id; rank?: Rank; basis: Basis[] } // what he believes a man is
  authorityOf(c, power): { believed: boolean; basis: Basis[] } // what he believes a man may do
  holdings(c): PerceivedHoldings                     // what he believes a man has: money, shop, men
  myOwn: OwnState                                    // his own cash, debts, arrangements, orders: always true to himself
  uncertain(): Unknown[]                             // things he knows he doesn't know (§7.3)
}
type Basis = { kind: 'seen' | 'told' | 'claimed' | 'rumour' | 'inferred' | 'own'; ref: Id };
```

**Rules:**

- **A man knows his own state truly:** his money, debts, arrangements, orders received, and his relationships as he feels them.
- **Everything about others is belief**, with a basis that cites a record. Frank does not know Henry is Corrente until Henry says so, someone tells him, or he infers it from cues he has (§4.2). The inference is a belief with `basis: inferred` and can be wrong.
- **A claim of authority is believed or not;** it is not checked against the truth at the moment it is made. ("The captain sent me." He may believe it. If he later learns otherwise, that is a contradiction, §5.3.)
- **Allowed access, per function:**

  | Function | May read |
  |---|---|
  | `candidates` (what a character, player or NPC, may attempt), `interpret`, `respond`, `argumentsFor`, `planPursuit`, `predict` and `read` (§7.3, §8.4) | Perception only (and, for `interpret`, the spoken part of an utterance only: §4.1) |
  | `Action.execute` (what actually happens when an action is attempted), `Condition.holds`, obligation checks | The world |
  | `render` | The utterance's meaning and the speaker's perception (never the world) |

- **Attempt and execution are separate.** A character, the player's included, attempts what he believes he can do. The world decides the result:
  - it succeeds;
  - it fails (he hadn't the money, the man wasn't there);
  - it is challenged ("Who says you collect here?");
  - or it exposes him (he acted on an authority that had been withdrawn: a violation, discovered).

  Nothing is removed from a character's options because the world, unknown to him, makes it impossible. The player learns that the same way his character would: by trying.

  An architecture test enforces it (§14).

### 2.3 Why characters interact

Every interaction has one of three motives. They are not three engines: they are three kinds of aim feeding the same model.

| Motive | Typical acts | Typical results |
|---|---|---|
| **To change something** | ask, offer, demand, propose, order, threaten, promise | Actions, agreements, arrangements, obligations |
| **To understand something** | question, investigate, disclose, challenge, deceive, test | Beliefs and claims change; knowledge is gained or withheld |
| **To manage a relationship** | spend time, reassure, warn privately, protect, test loyalty, express displeasure, reconcile, distance oneself | Relationship changes, favours, grudges, signals that others read |

A friend who hears that his friend is skimming can confront him (understand), warn him privately (relationship), tell their captain (change), cover for him (relationship and restraint) or distance himself (relationship). He weighs these from the same interests (§4.3).

### 2.4 Relationship acts write different kinds of social history

Relationship acts are not variations on "raise his regard". Each writes particular records through the existing doors, and is read back by different decisions:

| Act | Records written (existing doors) | What later reads it |
|---|---|---|
| Spend time | Familiarity (`knowMore`); trust and liking by compatibility (`feel`), with a bond reason "time spent" | Openness, trust gates, the precision of reads |
| Warn him privately ("They're looking at your numbers") | A **favour** owed to the warner (`addFavour`, size by risk); `inform`; a **secret held together** (a restraint obligation on both, implicitly) | Calling the favour in; loyalty tests; if the warning leaks, the warner's standing with whoever was investigating |
| Defend him publicly | Respect from the defended (`feel`); a public fact; the audience's view of the defender (respect up, or a grudge from the accuser) | His loyalty; others' perception of an alliance (`identityOf`, who stands with whom) |
| Lie to protect him | A favour owed, size by risk; a **lie claim** held by the lied-to party (§5.2) | If found out: the liar's credibility, and the lied-to party's grudge, with its reason |
| Test his loyalty | A probe utterance; the response is a claim, true or not | The tester's belief about him (`believes`), which changes his predictions (§7.3) |
| Express displeasure / reproach | A grudge with its reason on the reproached (`bear`), or respect if he accepts it as deserved (temperament) | Retaliation thresholds; future openness |
| Reconcile | Grudge eased with a reason (`ease`); may need amends (`pay`) | Rivalry and revenge pursuits close; trust can grow again |
| Distance oneself | `lastMet` ages; familiarity decays; a public signal if done openly | Others' perception of the alliance; his predictions about you |

---

## 3. Actions, agreements, arrangements and conditions

The old catalogue mixed four different things. They are now separate types, because each behaves differently.

### 3.1 The four types

| Type | What it is | Has | Example |
|---|---|---|---|
| **Action** | A one-off act that is carried out now, or fails | `can(perception)`, `execute(world)`, a fact it leaves | Pay $200; beat a man; introduce two men; hold a meeting; give a name |
| **Agreement** | Recorded terms between parties: what each said they will do or not do | Parties, terms, the obligations it creates (§6), witnesses | "Lou agrees to leave Nate alone"; "Frank pays $30 a week from Friday" |
| **Arrangement** | A standing relationship of the world that persists and acts weekly | Created and ended by actions; already exists as world records | Protection (`Business.protection`), a debt (`Debt`), a stake, a manager, a runner's cut |
| **Condition** | A state of the world someone wants, checked against the world | `holds(world, window)` | "Nate is left alone for 30 days"; "Lou's demand on the shop is withdrawn"; "Lou's captain has been spoken to" |

**The rules that follow:**

- **An agreement is never evidence that its condition holds.** Lou agreeing on Monday to leave Nate alone creates an agreement and a **restraint obligation** on Lou. If he sends someone on Wednesday, the agreement stands, the obligation is **broken**, and the condition "Nate left alone" **fails**. All three are separate records.
- **Accepting a request** produces one of three things, depending on what was asked:
  - an action executed at once;
  - an agreement (with obligations);
  - or the start or change of an arrangement.
- **An arrangement's weekly behaviour** is already in the world (protection fees, debt payments). Agreements change its terms through its existing doors.
- **Actions are attempted, then executed.** `can(perception)` decides whether a character believes he can try; `execute(world)` decides what happens, and may succeed, fail, be challenged or expose him (§2.2). A failed or challenged attempt is itself an event others can learn of.

### 3.2 Action catalogue

Each action calls existing doors only.

| Action | Parameters | Door | Fact left |
|---|---|---|---|
| `pay` | from, to, amount, reason | cash + `ledger.post` (+ `econ.bizMove` from a till) | `pay` (minor unless witnessed) |
| `lendMoney` | lender, borrower, amount, rate | `core.createDebt` | `loan` |
| `repay` / `collect` | debt, amount | `core.payDebt` | `debt_paid` |
| `alterDebt` | debt, time / easier / forgive | `core.giveTime` (new), `restructure`, `writeDown` | `terms` |
| `startProtection` / `alterProtection` / `endProtection` | shop, collector, fee | `econ.setCollector` and its terms | `protection_started` / `terms` |
| `transfer` / `stake` / `appoint` | business, to, price, share | `econ.sellTo`, `addStake`, `setManager` | `ownership` |
| `inform` | about, to | `core.learn` (fixed, §5.1) | (none; it is knowledge) |
| `introduce` | a, b | `intro`, `knowMore` | (none) |
| `convene` | parties, chair, matter, when | Schedules a group visit (§6.9) | `gathering` when held |
| `rule` | matter, verdict | Verdict effects (from `situ` kits) | `ruling` |
| `assignWork` | giver, doer, job | `work.giveWork` | job record |
| `grantLeave` | grantor, who, act, against | Records an authority grant (§6.2) | (private) |
| `vouch` | sponsor, candidate | `backer` / sponsor ledger | (private) |
| `takeOn` | boss, man | `orders.recruitProspect` | `promotion` (minor) |
| `harm` | actor, target, mode | `actions.perform` retaliate | `beating` / `vandalism` / `murder` |
| `grantFavour` / `callFavour` | from, to | `addFavour` / settle | `favour` (minor) |
| `setRate` | member, share | books | `terms` |
| `spendTime` | a, b, duration | `knowMore`, `compat` warmth, disclosure (§8.6) | (none) |
| `stay` / `leave` / `turnAway` | actor, place | Presence (§8.7) | (none, unless it escalates) |

### 3.3 Conditions

A condition is a predicate over the world, with a window:

```ts
type Condition =
  | { kind: 'noHostility'; actor: Id; actorsMen?: boolean; target: Id | { biz: Id }; from: number; until: number }
  | { kind: 'demandWithdrawn'; by: Id; of: Id; what: 'protect' | 'collect' | string }
  | { kind: 'actionDone'; action: ActionKind; by?: Id; params: Record<string, unknown>; within: [number, number] }
  | { kind: 'arrangementHolds'; ref: Id; until: number }
  | { kind: 'knows'; who: Id; about: Id }
  | { kind: 'notKnows'; who: Id | 'anyone'; about: Id }      // a guarantee that nobody learns something (a result)
  | { kind: 'notDisclosedBy'; by: Id; about: Id; to?: Id[] }   // he does not tell, or knowingly let it be told (a restraint)
  | { kind: 'paid'; from: Id; to: Id; amount: number; by: number }
  | { kind: 'all' | 'any'; of: Condition[] };                // at most two levels
```

Conditions are evaluated by a daily tick and by an `addFact` hook (a hostile fact can break `noHostility` on the spot).

---

## 4. Utterances, interpretation and decisions

### 4.1 The utterance and its meaning

The renderer needs more than an act and an attitude (review §7). An utterance therefore carries a **meaning**:

An utterance has two parts. Only the first ever reaches the listener:

```ts
interface Utterance { id: Id; t: number; spoken: Spoken; private: Private }
interface Spoken {          // what anyone present can observe: the words, the delivery, the setting
  speaker: Id; listener: Id; audience?: Id[];
  act: Act;                 // what is done on the surface
  explicit: 0 | 1 | 2;      // outright, a clear hint, or indirect
  meaning: Meaning;         // what the line says and how it is delivered (rendered from this, §9)
  where: Id; at: number;    // the setting, which is itself read (§8.7)
}
interface Private {         // the speaker's own: kept for consequences, the trace and tests, never passed to a listener
  intent: Act;              // what he means (differs when indirect or deceptive)
  honest: boolean;          // whether he believes what he says
  aim?: string;             // why he said it (§4.5)
}
interface Meaning {
  about?: Content;                         // the action, agreement, condition, claim, person or fact
  stance: 'warm' | 'polite' | 'flat' | 'firm' | 'cold' | 'hostile' | 'afraid' | 'indignant' | 'pleading';
  toward: 'request' | 'speaker' | 'third';  // what the feeling is aimed at: the demand, the man, someone else
  grounds?: Claim[];                       // the reasons given (§4.6)
  invokes?: { kind: 'obligation' | 'protector' | 'authority' | 'kin' | 'favour' | 'history'; ref: Id }[];
  implies?: 'warning' | 'threat' | 'offer' | 'appeal' | 'test' | 'none'; // the subtext
  terms?: Terms;
}
type Act =
  // change
  | 'ask' | 'offer' | 'demand' | 'propose' | 'order' | 'accept' | 'counter' | 'defer' | 'refer' | 'refuse'
  | 'promise' | 'announce' | 'threaten'
  // understand
  | 'question' | 'answer' | 'inform' | 'claim' | 'deny' | 'challenge' | 'admit' | 'probe'
  // relationship
  | 'greet' | 'introduce' | 'reassure' | 'warnPrivately' | 'reproach' | 'reconcile' | 'testLoyalty' | 'distance'
  | 'compliment' | 'remark' | 'acknowledge'
  // presence
  | 'dismiss' | 'wait' | 'leave';
```

The three refusal lines from the review come out of the same decision (`refuse`) with different meanings:

| Line | stance | toward | grounds | invokes | implies |
|---|---|---|---|---|---|
| "I don't know you." | flat | speaker | `doesNotKnow(speaker)` | none | none |
| "You come into my place asking for money, and I'm supposed to trust you?" | indignant | request | `unreasonable(request)` | none | none |
| "You tell whoever sent you that I already have an arrangement." | cold | third | `hasArrangement` | `protector` | warning |

**What chooses the meaning:** the decision (§4.4) chooses which factor is given, honestly or not, and the speaker's temperament and his reading of the asker choose the stance, the target and the subtext. Each is recorded in the trace.

### 4.2 Interpretation (from perception only)

`interpret(perception, spoken) → Understood { act, content, confidence, cues }`. The function receives the `Spoken` part only; it cannot reach `Private` (§14):

1. **Explicit speech is taken at its word.**
2. **An indirect act is read through the listener's perception.** The cues, each citing a basis:

   | Cue | Basis |
   |---|---|
   | Believed affiliation of the speaker | `identityOf` |
   | Prior demands on him | His own records |
   | Street pressure he knows of | Known facts |
   | His current arrangement | His own state |
   | The speaker's reputation as he has heard it | Known facts and claims |
   | His suspicion | Temperament, trust |
   | Setting | Hour, place: a visit at 1am to a man's home is itself read |

3. **Confidence** is the logistic of the cue sum plus a deterministic hash jitter. Below a threshold the literal reading stands.
4. **Misreadings are allowed and recorded.** He answers his interpretation.
5. **Claims are judged as beliefs** (§5).

### 4.3 Interests (from perception)

`interestsOf(perception, matter)` is derived per decision, never stored:

| Interest | Read from |
|---|---|
| `money` | His own state |
| `safety` | Perceived threats; his own fear and protection |
| `standing` | Own rank, pride, the audience |
| `family` | His organisation, perceived ground and tension |
| `loyalty` | His own relationships and obligations |
| `kin` | Kin ties |
| `regard` / `grudge` | Toward each party (his own feelings) |
| `order` | Keeping the peace, the boss's known wishes |
| `secrecy` | What he is hiding |

The weights come from temperament and circumstances. `stakes(perception, option)` returns the vector for each candidate response.

### 4.4 The response decision: two stages

**Stage 1: what is possible and permissible.** This produces **constraints**, each a qualitative fact, not a weight:

| Constraint | Source | Example |
|---|---|---|
| `forbidden` | An order he has received and believes in force | "Don't touch the Russo bakery" from his boss |
| `exceeds` | Beyond his authority (§6.2), as he understands it | A soldier can't speak for the family |
| `obliged` | An obligation he holds (§6.3) that the response would break | He promised Costa to pay only him |
| `cannot` | Resources: money, men, presence | He hasn't got $500 |
| `unknown` | He lacks information needed to act | He doesn't know who Lou answers to |
| `exposes` | A secret he keeps would come out | Accepting means admitting he skimmed |

**Every candidate response is labelled with the constraints it would cross.** Crossing one is possible, but only as an explicit choice: a **violation**, with a known cost (§6.4, on break), a willingness test from temperament (pride, volatility, loyalty, fear), and a record in the trace. No accumulation of goodwill silently overrides an order.

**Stage 2: evaluation of the permissible responses** (and of violations, at their cost). The candidate moves:

| Move | Typical cause |
|---|---|
| **accept** | The best value, no constraint crossed |
| **counter** | Better terms exist for him |
| **defer** | `unknown`, a consult needed, or a careful man under pressure. This starts his own pursuit (§7) |
| **refer** | `exceeds`. He names who decides, in his belief |
| **refuse** | The best is to say no |
| **dismiss** | He won't engage: hostile, frightened, the hour, already told you |
| **violate** | He chooses to cross a constraint. Recorded as such |

```
value(move) = Σ weight_i × stake_i(move)                    // interests, from perception
            + relation(asker)                               // goodwill − resentment + fear × (1 − courage)
            + arguments accepted (§4.7)
            − risk(move)                                    // what he believes could happen to him
            − violationCost(move)                           // only for moves that cross a constraint
            + jitter(hash)
```

He picks the move with the highest value. **The trace records the constraints, each candidate's value and its terms.**

### 4.5 Disclosure has a motive

An NPC volunteers information only when it serves an aim in the exchange:

| Aim | Example |
|---|---|
| warn off | "Mr. Costa's people come by on the first." |
| appeal | "My wife's sick." |
| deflect | "Ask Vito." |
| bargain | "Thirty I could do." |
| seek help | "Lou's people smashed my window." |
| test | "Who told you to come here?" |
| reassure | "Nobody's asked me anything about you." |

The aim is chosen from his interests and his reading of the speaker, and recorded.

### 4.6 Reasons and concealment

Every refuse, counter, defer and refer carries grounds: the decisive factor, said honestly or replaced by a **cover** from the other true factors, or a pretext (`honest: false`), by `honestyOf` (trust in the asker, caution, pride, the cost of saying it). The grounds are stored as claims (§5.2) and drive the follow-ups.

### 4.7 Arguments

Arguments are generated from the **speaker's** perception: for each interest of the listener *as the speaker understands it*, a claim linking the outcome to that interest. Each has:

| Field | Meaning |
|---|---|
| `support` | Whether the listener believes the claim, from his perception |
| `fit` | His weight on that interest |
| `cost` | Your word, your name, a favour |

An unsupported argument can be doubted, checked later, and found false (§5.3). At most three are shown, and only those with a real effect.

### 4.8 Follow-ups

There are at most two after a reply with grounds. Each acts on the grounds and can change the decision or reveal something. A challenge needs evidence in the player's perception.

### 4.9 When to offer an approach

For a request of the player's, evaluate the decision under each approach: plainly, sweetened, pressure, leverage, a favour, a superior's name, arguments. Offer the approach step only if:

- the decisions differ across approaches; **or**
- one approach carries a significant extra cost: an enemy made, a favour spent, a name used.

Otherwise the request is made plainly in one click.

---

## 5. Knowledge, claims and beliefs

### 5.1 The knowledge door is fixed first

- **`core.learn` updates an existing record:**
  - `knowsActor` can go false → true;
  - `how` improves;
  - a wrong `blame` is cleared when the actor becomes known;
  - the deed effects apply when the actor first becomes known.

  These are audit §6.6 defects 1 and 2.
- **No direct writes to `known`** (architecture test).

### 5.2 Claims

```ts
interface Claim {
  id: Id; by: Id; t: number;
  about: { kind: 'fact' | 'person' | 'business' | 'debt' | 'agreement' | 'authority'; id: Id };
  says: ClaimKind; value?: Id | number;
  honest: boolean;          // simulation only
  heardBy: Id[];
  weight: Significance;     // §12.1
}
```

Belief in a claim is computed from the listener's perception: `trust(speaker) × plausibility(claim | what he knows) × (1 − suspicion)`, with a basis.

### 5.3 Contradiction, verification and revision

- **Contradiction.** A claim conflicts with another claim or a known fact. `contradictions(perception)` lists them.
- **Verification.** A character can act to check a claim:
  - ask the person it names ("Did the captain send him?");
  - look (books, the shop);
  - ask around.

  These are actions under the "understand" motive, and part of pursuits (§7.3).
- **Revision.** When better information arrives, beliefs change. Grudges based on a wrong blame are eased with a reason. The changed belief can trigger replanning (§7.4).
- **Two trusted, contradictory accounts.** He holds both at reduced belief, marks the matter `uncertain`, and is more likely to verify before acting.
- **Player lies are claims.** Learning the truth later is a contradiction with consequences: trust falls, `conduct.lies` grows, and the liar's name suffers among those who know.

### 5.4 Secrecy

- **"Not a word"** is a **restraint obligation** on the promiser's conduct: `notDisclosedBy(him, X)`. It is broken by an `inform` act of his, or one he knowingly enables (telling someone who he knows will pass it on). If another man finds out independently, Henry has not broken his word.
- **"Nobody will find out"** is a different promise: a **result** obligation on `notKnows(anyone, X)`. It is rare, and only offered when the promiser could plausibly guarantee it.

---

## 6. Requests, agreements, obligations and authority

### 6.1 Requests

Requests extend today's ask situations, reusing their storage, caps, cooling keys and bounded history:

```ts
interface Request {
  id: Id; by: Id; of: Id;
  for?: Id; via?: Id; parent?: Id;       // on whose behalf, through whom, which request this serves
  wants: { action?: ActionSpec; agreement?: AgreementSpec; condition?: Condition };
  terms?: Terms;
  authority?: Grant;                     // what the asker claims entitles him (§6.2): believed or not by the listener
  status: 'open' | 'agreed' | 'countered' | 'deferred' | 'referred' | 'refused' | 'withdrawn' | 'lapsed' | 'done';
  stance: Record<Id, Stance>;
  grounds: Claim[];                      // ≤ 3
  next: number;
  hist: { t: number; event: string; public: boolean }[]; // ≤ 8; only public events also become facts
}
```

### 6.2 Authority

`may(world, actor, power, over?) → Grant | undefined` is objective: what a man is entitled to do. What other people *believe* he may do comes from their perception (`authorityOf`).

| Power | Holder |
|---|---|
| `order` | A superior over men in his chain |
| `chair` | The lowest common superior. For a civilian against a family man: that man's captain or above. Across families: their bosses, or their delegates, together |
| `speakForFamily` | The boss, the underboss, the consigliere; a captain within his ground; any delegate for a matter |
| `authoriseHarm` | The target's own chain, or the asker's boss across families when tension allows |
| `protect` | Associates and up in their crew's ground, unless another family holds it |
| `rule` | A superior over his men's matter |
| `delegate` | Anyone, for a power he holds, for one matter |
| `refer` | Anyone, always |

**Overpromising.** A man can promise what he lacks the power to deliver ("I'll get the boss to back you"). The promise stands as an obligation, and failing it is a break. Others who know he lacked the power may think less of him.

**Claimed authority.** "The captain sent me" is a claim (§5.2). It is believed or not, checked or not. If it is false and found out, that is a contradiction with consequences.

### 6.3 Agreements and obligations

Accepting a request creates an **agreement**. An agreement creates one or more **obligations**:

```ts
interface Agreement {
  id: Id; t: number; parties: Id[]; terms: Terms; madeIn: Id /* request */; witnesses: Id[];
  obligations: Id[];
}
interface Obligation {
  id: Id; agreement?: Id;                  // promises without an agreement (an offer accepted later) have none
  obligor: Id; beneficiary: Id; promisee: Id;
  type: 'action' | 'effort' | 'result' | 'restraint';
  spec: ActionSpec | Condition;            // what must be done (action, effort) or held (result, restraint)
  effort?: EffortSpec;                     // for effort: what counts as a real attempt
  window: { from: number; by: number };
  delegatedTo?: Id[];
  liabilities?: { if: Condition; who: Id; effect: Effect }[];
  notify: Id[];
  status: 'open' | 'kept' | 'broken' | 'released' | 'withdrawn' | 'void';
  credit?: { how: 'self' | 'delegate' | 'other' | 'none' };   // who brought it about: separate from fulfilment
}
```

**The four obligation types:**

| Type | Promise | Kept when | Broken when | Example |
|---|---|---|---|---|
| **action** | "I'll speak to my captain." | The obligor (or a delegate he names, if the spec allows) performs the specified action within the window | The window closes without it | `actionDone(convene/inform…, by: obligor)` |
| **effort** | "I'll do what I can about Lou." | The obligor makes the attempts defined by the effort spec within the window, whatever the result | No qualifying attempt by the deadline | See the effort specification below |
| **result** | "I'll make sure Lou leaves you alone." | The condition holds over the window, however it came about | The condition fails within the window, or doesn't hold by its deadline | `noHostility(Lou, Nate's shop, 30 days)` and `demandWithdrawn` |
| **restraint** | "Not a word." / "I'll leave the shop alone." | The window passes without the forbidden act by the obligor | The obligor (or someone he knowingly directs) does the forbidden act | `notDisclosedBy`, `noHostility` with the obligor as actor |

**An effort specification** lists what counts as a real attempt. It is satisfied by *any one* of its actions, done by the obligor or his delegate:

```ts
interface EffortSpec { attempts: ActionSpec[]; min: 1 | 2 }  // e.g. any of: ask Lou's captain, ask our captain, warn Lou directly
```

The effort spec is fixed when the promise is made, from the promise's wording.

**Good faith.** An attempt counts towards an effort obligation only if, **when he made it**, the obligor had reason to think it might work:
- his own prediction of success (`predict`, §7.3) was above a floor;
- or it was the best route he had.

A failed attempt counts. A knowingly pointless gesture, such as asking a man he believed would refuse while a better route was open to him, does not. The test reads the obligor's perception at the time (recorded in the trace), so it is judged on what he knew, not on hindsight.

**Fulfilment and credit are separate.** A result obligation is kept if the condition holds, but `credit` records who brought it about:

| Brought about by | Credit |
|---|---|
| The obligor | Full |
| A delegate | Shared |
| Someone else | None |
| Nobody | It held by itself |

The beneficiary's regard for the obligor follows **credit as he perceives it**: he may wrongly believe you did it.

**Which type a promise is** comes from what was said: the utterance's act and meaning. "I'll speak to" makes an action obligation, "I'll do what I can" an effort, "I'll make sure" a result, and "I won't" a restraint. The player's options state the type plainly in the note ("A promise to try: you'll need to raise it with someone who can act"), and NPC promises carry their type in the trace.

### 6.4 Lifecycle

- **Checking.** A daily `obligationTick` (after `pendingTick`) and an `addFact` hook. Action and effort obligations are matched against action records (by type, actor and parameters); result and restraint against conditions.
- **On keep:**
  - the beneficiary's and promisee's trust rises, scaled by credit as they perceive it;
  - a reputation gain if witnessed;
  - the `notify` list learns it.
- **On break:**
  - trust and respect fall;
  - a broken-word fact goes to the witnesses;
  - the liabilities are evaluated;
  - the beneficiary may start a pursuit (go elsewhere).
- **Release, withdrawal, void.**
  - **Released:** freed by the promisee.
  - **Withdrawn:** taken back by the obligor before the deadline, at a smaller cost than a break.
  - **Void:** made impossible by events the obligor did not cause and could not reasonably foresee when promising (§6.5).
- **Conflicts.** Two obligations of one man that cannot both be kept (he promised Costa exclusivity and Henry protection) are found when the second is made: `conflicts(obligor)`. The trace and the obligor's perception record that he knows. When one must break, the break is his explicit choice (§4.4, `violate`).
- **Liabilities.** Conditions evaluated alongside. "If it turns ugly, it's on you" = `{ if: hostility between the parties' people concerning this matter within 30 days, who: Henry, effect: the captain's trust −, standing − }`.

### 6.5 Time rules for obligations

Every obligation is in one of three states at any moment: **pending**, **kept** (conclusively) or **broken** (conclusively). The rules, per type:

| Type | Kept | Broken | Pending |
|---|---|---|---|
| **action** | The moment the action is done within the window (early completion counts) | The window closes without it | Until then |
| **effort** | The moment the required good-faith attempts are made (§6.3) | The window closes without them | Until then |
| **result, by a date** ("paid by Friday") | The moment the condition first holds within the window | The window closes with it false | Until then |
| **result, over a period** ("Lou leaves Nate alone for 30 days") | Only when the whole period has passed with the condition holding throughout | **At the first violation** within the period | Throughout the period, however well it is going |
| **restraint** | When the window closes without the forbidden act | At the first forbidden act | Throughout the window |
| **recurring** ("$30 every Friday", a loan's payments) | Each instalment is its own action or result obligation, as above; the whole is kept when the last instalment is | An instalment broken is a breach of that instalment; the whole is broken after N missed instalments (the agreement's terms; default 2, as debts default after missed payments) | While instalments remain |

**Impossibility.**
- **Void, not broken:** if the obligation becomes impossible (the beneficiary dies, the shop burns down, the man who had to be spoken to is jailed indefinitely) **and the obligor neither caused it nor could reasonably have foreseen it when promising.**
- **Broken:** if the obligor (or someone acting for him) caused the impossibility, or if it was foreseeable from his perception when he promised (the man was already in prison).
- **Recorded:** the trace records which case applied and on what basis.

**Early warning.** A pending result or restraint obligation that has just become hard to keep (a violation is threatened, a deadline is near) is a **significant development** (§17.6). The obligor learns it if he could plausibly know, and only then.

### 6.6 Orders and their breach

An **order** from a superior is a restraint or action obligation of the subordinate, with the superior as beneficiary:

- created by `order` (§4.1);
- broken knowingly only by `violate` (§4.4);
- discovered by whoever learns of the act;
- with consequences through discipline (`books.discipline`, `situ` kits).

### 6.7 Follow-up and patience

The beneficiary of an open obligation raises it only when there is something to raise: the deadline is near, something relevant has happened (as he knows it), or his patience has run out. He doesn't ask about what he already knows the answer to, and he doesn't ask every visit. Past his patience, he starts his own pursuit. An obligor or delegate reports unprompted when something significant changes; routine progress is not reported (§17.6).

### 6.8 Incoming requests

Every current encounter becomes a **pursuit step** of an NPC that requests something of the player:

- a loan;
- a favour;
- a tip;
- mediation;
- a pushed shop;
- a debtor's plea;
- a crew want;
- a superior's word.

It is raised at the start of a visit, or sent as word (shown on the World screen). It is answered with the same moves anyone has.

### 6.9 Group visits

A **group visit** is a scheduled meeting created by `convene`, with a chair (`may(chair)`), parties, a matter and a date. Its agenda is the open requests, claims and obligations among the parties. Each party speaks in turn; the chair rules; parties accept, resent or defy (a `violate` of the ruling as an order). It replaces all nine sit-down and mediation paths.

### 6.10 Life conversations

These are the same model:

| Situation | Becomes |
|---|---|
| Dates | `spendTime` |
| A proposal | A request for an agreement |
| Kin favours | Incoming requests |
| A mother wanting Sundays | A pursuit with patience |

---

## 7. Pursuits: objectives, dependencies and information

### 7.1 Where pursuits come from

| Source | Example | Motive |
|---|---|---|
| Events he knows of | A demand on his shop: make it stop | change |
| Needs | Can't pay a debt | change |
| Ambitions (`goals.ts` today) | A business, advancement | change |
| Obligations he holds | Keep his promise | change |
| Requests referred or delegated to him | A captain asked to intervene | change |
| Uncertainty that matters to him | Who smashed the window? Is the new man really Corrente? | understand |
| Relationships under strain | A friend suspected of skimming; a protégé who's gone quiet | relationship |

### 7.2 The pursuit record

```ts
interface Pursuit {
  id: Id; who: Id;
  motive: 'change' | 'understand' | 'relationship';
  objective: Condition | ActionSpec;      // what he wants to be true or done
  why: Id | string;                      // the cause (a fact, a claim, an obligation)
  needs: Need[];                         // what he believes he needs: (§7.3)
  unknowns: Unknown[];                   // what he knows he doesn't know
  plan: PlanStep[];                      // the current route, re-planned at review
  tried: { step: string; with?: Id; result: string; t: number }[]; // ≤ 6
  patience: number; next: number;
  status: 'active' | 'achieved' | 'abandoned' | 'blocked';
}
interface Need { kind: 'someoneWhoCan' | 'leverage' | 'money' | 'permission' | 'knowledge' | 'trust'; detail: string }
interface Unknown { question: 'whoDidIt' | 'whoAnswersTo' | 'canTrust' | 'whatHeWants' | 'isTrue'; about: Id; resolvedBy: ActionSpec[] }
interface PlanStep {
  id: string; do: ActionSpec | RequestSpec;
  requires: Precondition[];   // beliefs or states that must hold first (e.g. knows(whoAnswersTo(Lou)))
  provides: Effect[];         // what success gives him (a belief, a grant, an agreement, a condition)
  ifFails?: 'replan' | 'abandon' | 'escalate';
}
```

### 7.3 Planning with dependencies (shallow, explicit)

The planner is a backward chain at most three steps deep over **preconditions** and **provides**, using the character's perception. It is not a general AI planner.

1. **What does the objective need?** For `noHostility(Lou → my shop)`, the candidate routes are:
   - Lou agrees to stop (a request of Lou);
   - someone over Lou orders him to stop;
   - someone who protects me makes him stop;
   - I pay Lou;
   - I make Lou afraid.
2. **For each route, what must be true first** (preconditions), as he believes it?
   - "Someone over Lou orders him" requires `knows(whoAnswersTo(Lou))` and `someone will ask that man for me`.
   - "Someone who protects me" requires that I have a protector.
3. **Unmet preconditions become steps or unknowns.**
   - `whoAnswersTo(Lou)` is an **unknown**, resolved by asking someone likely to know (an `understand` step: who in his circle would know?).
   - "Someone will ask for me" is a request to a man who can reach Lou's superior (his protector, his kin, a man in the family he trusts: Henry).
4. **Rank the routes** by expected value from his perception: the predicted likelihood of each request's acceptance, the costs, the risks and his temperament. The route's first unblocked step is acted on.

   **Prediction is not decision.** To estimate how another man would answer, a character runs `predict(myPerception, him, request)`. That evaluates `respond` on a **model of him built only from the predictor's beliefs**:
   - his identity and allegiance as believed;
   - his temperament as the predictor has seen it, blurred towards the average by unfamiliarity;
   - his relationship to the predictor as the predictor feels it;
   - his interests as the predictor imagines them;
   - none of his private orders, debts or secrets unless the predictor knows them.

   When the request is actually made, the other man decides with `respond` on **his own** perception. The two can differ, and the trace records both. A man misjudging another's loyalty, courage or willingness is a source of stories, not a defect.
5. **Information unlocks routes.** When a step provides a belief (he learns Lou answers to Captain Marchese), routes that needed it become available and the plan is re-ranked.

### 7.4 Reassessment

A pursuit is reviewed:
- when a step resolves (success, refusal or lapse);
- when **relevant new information** arrives (a fact or claim that changes a precondition or a value: hooked to `learn`);
- or at `next`.

On review he:
- records `tried`;
- doesn't repeat a refused step with the same person;
- re-plans;
- and on patience exhausted takes the best remaining route, or abandons (a fact his circle hears).

**A better route discovered halfway** replaces the current one if its value exceeds it by a margin (to avoid dithering).

### 7.5 Bounds

- **Per character:** at most two active social pursuits, plus economic goals as today.
- **World-wide:** pursuits ≤ 120, open requests capped per kind (`SIT.cap`).
- **Planning depth** ≤ 3; candidate routes ≤ 5.

### 7.6 NPC-to-NPC exchanges

These run the same `interpret` and `respond` on perceptions, with traces and no text. Public events become facts.

### 7.7 The review's Nate case, by design

| Step | Mechanism |
|---|---|
| He wants Lou to stop | Objective |
| He doesn't know who Lou answers to | Unknown, resolved by asking around |
| Can he trust Henry? | Unknown, resolved by a `testLoyalty` or `probe` act, or by Henry's record with him |
| He asks Henry to bring it to the family | A request, with an obligation if accepted |
| The intervention fails | Review: re-plan (pay Lou, find another protector, go to Marchese himself through someone he trusts), or abandon |

---

## 8. The player interface

### 8.1 The visit

```
Header:   name · where · when · one line of how he seems (from your perception)
Scene:    where you find him; his greeting, or his refusal to talk
His word: his request, a follow-up on an obligation, a reaction to something you did
Choices:  ≤ 5 rows (§8.2)
Exchange: your line → his reply (with grounds) → ≤ 2 follow-ups → an outcome card
End:      he ends it, or you leave
```

The transcript shows this visit only.

### 8.2 Choices: the full set, the five, and "Something else…"

**The full candidate set** is everything the player's character believes he may attempt with this man now. It is generated from the **capability matrix** (§8.10), filtered by:
- `can` / `may` **as the player's character perceives them**, the same rule an NPC follows. What the world allows is decided only when he tries (§2.2);
- the two tests:
  - **his side:** would he understand this line, judged by `interpret` on *his* perception;
  - **your side:** can it change something or reveal something, judged by `respond` on his perception and `inform`.

**Ranking:** his request, obligations due, your pursuits, urgency, value, novelty.

**On screen:** typically two to four rows, five at most (§17.2):
- the top two or three;
- **Something else…**, only when lower-ranked actions that pass the relevance test (§17.8) exist;
- **Leave**.

**Two different things are kept apart:**

| | What it is | Filtering |
|---|---|---|
| **Suggested actions** (the main screen) | What the game believes matters now | Aggressive: ranked, relevance-tested (§17.8), two to four shown |
| **Player-initiated actions** ("Something else…") | Everything the player's character could reasonably attempt with this man now | **Only** plausibility: he believes he could try it (`can`/`may` from his perception) and it would make sense to say to this man here (§17.8 tests 1 and 5). **Never** removed for ranking low or for the engine judging it unimportant |

**Something else…** opens that list:
- one flat list, each row a line you'd say with its note;
- functionally equivalent actions merged;
- ordered by verb (asks, offers, demands, telling him something), without headings or nesting.

It is usually short because few things are plausible with any one man. It is not capped: if you came to ask your captain's leave to take a man on, that request is always there, however the engine ranks it.

The loan you want to offer Frank is always reachable: on the main screen if it ranks, otherwise one click away under Offer.

### 8.3 Wording a choice

A row is your line (rendered from its meaning) and one plain note: what it does, what it risks, and, for a promise, what you are undertaking, in plain words ("You're saying you'll try, not that you'll manage it"; "He'll expect it done"). The kinds of obligation in §6.3 are never named on screen (§17.4). Indirect lines say in the note what you mean.

### 8.4 Reads

A read is `predict` (§7.3) from the player's character's perception of him, rendered in one short line of words. It is accurate in proportion to how well you know him, and can be wrong. It is shown only where an approach choice is shown (§4.9). It never appears on ordinary rows.

### 8.5 Ask or tell him about…

**A single entry,** not two. It appears only when you know something worth raising with this man. It covers only what **you** know and have reason to raise, including things he has never heard of (his ignorance is the answer, and he now knows). It is the understand-motive entry point.

### 8.6 Spend time with him

One choice. Time passes. A short paragraph in the narrator's voice, composed from:
- what you did;
- what he talked about (one or two of his real concerns);
- how it went (compatibility);
- the relationship change, in words, if there was one (two men can spend an afternoon together and be no closer);
- sometimes a disclosure or his request.

It is the main relationship-motive entry point, with diminishing returns as now.

### 8.7 Presence

- **The hour and the place** are interpreted.
- **"I'll wait"** is a `stay` action: he tolerates it, gives in, threatens, calls his protector (a request to that man), or is frightened.
- **Being turned away** sets a cooldown. Repeated unwelcome visits are themselves read: as harassment, a threat, or pitiable, by temperament. They have consequences (§11.4).

### 8.8 Matter pages

| State | Shown |
|---|---|
| **Live** | One line of where it stands; the moves that resolve it, here, without a visit, where none is needed; "Go and see him" when the next move needs him |
| **Closed** | How it ended and what it left behind |

The history is folded and condensed. It contains only what the player observed: no provenance tags, no housekeeping, no hidden state.

### 8.9 Outcome cards

Shown only when something changed or was learned, in plain words, never in the system's terms:
- **agreed;**
- **promised,** said as the promise was made ("You said you'd do what you can. Nate expects to hear by Saturday"). Obligation types, effort lists and windows stay internal;
- **referred;**
- **refused** ("he says…");
- **intention;**
- **learned** ("he says…");
- **nothing** ("He wouldn't talk to you today").

### 8.10 Capability parity

Every action, agreement kind and request is defined once, with `can`/`may` rules, and is available to **any** character who meets them. **Both the player and NPCs choose from what their character perceives** and are judged by the world when they act. The player selects from the ranked screen. An NPC selects through pursuits. If an NPC captain can investigate misconduct, the player as captain can initiate the same investigation, and vice versa. A matrix test checks it (§11.5).

---

## 9. Language generation

### 9.1 Rendering from meaning

`render(u.meaning, speaker, listener, perception) → string` composes from:

- **banks** keyed by `act × stance × toward × implies`, with slots for grounds, invocations, terms and names;
- the speaker's **archetype and temperament:** length, directness, idiom;
- the **register:** up, down, level; stranger or friend;
- **slots** filled from the meaning's content only (never from the world);
- a **hash-chosen variant** and the no-repeat rule within a visit.

### 9.2 Behaviour first

Variety of wording matters less than variety of decisions (Rule 3). Banks need enough breadth that the same meaning from the same man doesn't repeat within a visit.

### 9.3 Proof before build (Gate 1)

The renderer is built and judged **before** anything is deleted (§15). The illustrative dialogue in this document is a target, not evidence: Gate 1 must show the engine producing comparable lines.

---

## 10. The interaction trace

```ts
interface Trace {
  t: number; visit?: Id; request?: Id;
  spoken: Spoken;                                    // what was observable
  private: Private;                                  // intent, honesty, aim: for tests only
  heard: Understood & { cues: Cue[] };               // built from `spoken` and the listener's perception only
  predicted?: { by: Id; move: string; basis: Basis[] }; // what the asker expected (§7.3), to compare with the decision
  decision?: {
    by: Id;
    constraints: { kind: string; source: Id; crossed: boolean }[];
    candidates: { move: string; value: number; terms: { name: string; value: number; basis?: Id }[] }[];
    chosen: string; violation?: { constraint: string; cost: number };
    grounds: { factor: string; said: Claim; honest: boolean };
    aim?: string;
  };
  perceptionUsed: { item: string; basis: Basis[] }[];  // every belief the decision relied on
  changes: { kind: string; ref: Id; before?: unknown; after?: unknown }[];
  records: { agreements?: Id[]; obligations?: Id[]; claims?: Id[]; facts?: Id[] };
  rendered: { line: string; bank: string; variant: number };
}
```

**Checks over traces:**

- **Subjectivity:** every `perceptionUsed` item has a basis the character actually holds. No decision reads objective state about another man.
- **No reading of minds:** `heard` depends on `spoken` and the listener's perception only; changing `private` (intent, honesty) without changing `spoken` must not change `heard` (a property test).
- **Consistency:** everything named in a line is in the speaker's knowledge or perception.
- **Causation:** every `changes` entry comes from an action's execution or an obligation event.
- **No dead options:** for every option offered, the trace shows the decision was live: the response engine had at least one plausible result that would change something or reveal something. Whether it did on this occasion is not required.
- **Attribution:** every card statement is observed or attributed.

Traces are not saved: they are kept in memory for the current visit, and collected by tests and the harness.

---

## 11. Acceptance cases

The engine must satisfy every case without special-case code. The dialogue shown here describes the target shape. **The test is the trace plus Gate 1's judgement of the generated lines**, not these words.

### 11.1 A. The bakery: a first visit to a civilian owner

**Setup.** Frank Russo, civilian, owns Russo's Bakery and pays Costa's man. He has never met Henry Tedesco (Corrente associate). Tuesday afternoon.

| Step | Shape | Trace must show |
|---|---|---|
| Arrival | "Help you?" | `greet`, polite. Frank's perception of Henry: **unknown identity** |
| Choices | Introduce yourself; "Nice place. You must do well here." (indirect protection demand); buy something; Ask him about…; Leave | Each filtered by both tests; the indirect line offered because `may(protect)` holds for Henry in the world |
| "Nice place…" | He reads a demand, or takes the compliment | Cues from **his** perception only: his own arrangement (true to him), street pressure he knows, Henry's believed identity (unknown). Threshold and jitter shown |
| Introduce yourself | "Mr. Costa's people come by on the first. You're not him." | Identity now believed (basis: claimed); aim `warnOff` (loyalty to protector, safety); disclosure recorded |
| Protection, plainly | Refuses: "I don't know you." | Constraints: `obliged` (his arrangement with Costa, as he understands it). Evaluation: low trust; the grounds honest or cover |
| "I'll be back Friday" | "Friday, then." | `announce` → intention only; `acknowledge`; request open (refused); Frank's own pursuit may start (understand: who is Henry? change: tell Costa). **No obligation** |
| He won't talk | "We're closing." (at 3pm) | `dismiss`; with "I'll wait" → `stay` → his response decision |

### 11.2 B. Ferrara's Grocery: four men, typed obligations

| Step | Who | Shape | Records |
|---|---|---|---|
| 1 | Nate → Henry | "Lou's people smashed my window. I won't pay him." Henry's options include: "I'll take it to the family." (an **action** obligation: raise it with a superior), "I'll do what I can." (**effort**: any of: ask Rizzo, warn Lou, ask Lou's captain), "I'll make sure he leaves you alone." (**result**: `noHostility` + `demandWithdrawn`, 30 days) | Request by Nate of Henry; agreement; obligation O1 of the chosen type; the card states the type and window |
| 2 | Henry → Rizzo | "Nate Ferrara's having trouble with Lou Valenti. I want to bring it to the family." Rizzo: "Ferrara? He's not one of ours. Why should we get involved?" | Request R2 (`for` Nate, `parent` O1). If O1 is an action obligation, **making R2 keeps it** |
| 3 | Arguments | Family / your word / money, each generated from Henry's perception of Rizzo's interests, evaluated on Rizzo's | Trace: each argument's support and fit |
| 4 | Rizzo decides | "I'll have a word with Lou's captain. But if this turns ugly, it's on you." | Agreement; O2: Rizzo, **action** (speak to Marchese, 7 days); liability on Henry. If O1 is effort, R2's acceptance counts as an attempt; if result, O1 stays open on the condition |
| 5 | Rizzo → Marchese (no text) | Marchese decides from his perception: Lou earns for him, peace in the family, Rizzo's standing | Possible results: an order to Lou (O3: Lou, **restraint**); a refusal; a `convene` proposal |
| 6 | Lou | Obeys or **violates** (an explicit choice with costs) | Restraint kept or broken |
| 7 | World | Conditions checked daily and on facts | O1 (result) kept or broken by `noHostility`. Credit to Henry shared, by delegation. Nate is notified |
| 8 | Nate ↔ Henry | Nate's first word is the follow-up, from what he knows | |

**Variants that must work without new code:**
- Henry promised only to try and Rizzo refuses: O1 (effort) is **kept**. Nate is disappointed but not betrayed.
- Henry promised a result and Lou stops by himself: O1 is **kept**, with no credit.
- Lou agrees and then strikes on Wednesday: the agreement exists, O3 is **broken**, O1 (result) is **broken**, and the liability falls on Henry.
- Rizzo promises something he can't deliver: an overpromise, broken, and Henry's view of Rizzo changes.
- Nate loses patience and starts his own pursuit.

### 11.3 C. Five Franks

The same demand by the same Henry, the same week, against five profiles differing only as stated:

| Profile | Differs | Expected | Decisive terms |
|---|---|---|---|
| Cautious | caution 0.8, pays Costa | Refuse, naming his protector; defer and consult Costa | `obliged` constraint; loyalty; safety via protector |
| Proud | pride 0.8, unprotected | Refuse and dismiss | standing weight; low fear |
| Desperate | distress, cash < expenses | Counter, asking what he gets for it | money weight; safety value |
| Frightened | courage 0.2, vandalism on his street last week | Accept (coerced, resentment recorded) | fear effect; street-pressure cue |
| Connected | cousin is a Marchetti soldier | Refer to his cousin; starts a consult pursuit | kin; `exceeds`/contested ground |

**Pass criteria:**
1. At least four distinct decisions.
2. Each decision's largest terms match its profile.
3. Reverting the single attribute restores the baseline decision.
4. **Believability:** reviewed against the profile in Gate 1, not only counted.

### 11.4 D. Adversarial cases

| Scenario | Must hold |
|---|---|
| A captain promises something he lacks the power to deliver | The obligation is recorded; the break is real; those who knew he lacked the power read it as overpromising |
| Two characters make contradictory promises to the same man | Both obligations exist; `conflicts` is detected; one is broken by an explicit choice; the man who relied on the broken one reacts |
| A character lies about having authorization ("The captain sent me") | The listener believes or doubts it from his perception; he may verify; discovery makes a contradiction with consequences |
| An NPC discovers a better route halfway through a pursuit | New information triggers review; the plan switches only past a margin |
| The player promises only to try, then genuinely fails | The effort obligation is kept; the beneficiary's disappointment is a relationship change, not a broken word |
| An agreement is accepted and then violated | The agreement stands; the restraint is broken; the condition fails; all three are distinct in the records |
| A man hears contradictory accounts from two trusted people | Reduced belief in both; the matter is marked uncertain; he verifies before acting |
| The player keeps visiting a man who wants nothing to do with him | Turned away; cooldowns; repeated visits read as harassment, a threat or pitiable, by temperament; consequences follow (he goes to his protector or the police, or the street talks) |
| An order is defied | `violate` is chosen with its cost; discovery leads to discipline |
| A secret promised and then told | A restraint break; the teller's credibility falls among those who know |

### 11.5 E. Capability parity matrix

For every action kind, agreement kind and request in §3, the test confirms all of the following:

1. The player can initiate it when the world rules allow (`may`, `can`).
2. An NPC of the same standing can initiate it through a pursuit.
3. Both are evaluated by the same `respond`.
4. Both have the same consequences.

For example: investigate misconduct (player as captain vs NPC captain), protection pressure (player vs NPC associate), mediation (player as chair vs NPC chair), calling a meeting (player vs NPC).

### 11.6 F. Emergence (long runs)

Over 4 seeds × 180 days in the harness:
- count pursuits that complete through **two or more people**;
- count chains of **three or more linked requests** (`parent`/`via`);
- count broken agreements followed by consequences;
- count belief revisions that changed a plan.

Thresholds are set from a first baseline run and then held as regression floors. The **interesting stories** a run produces (the longest chains) are printed for human review.

### 11.7 G. Regressions from the audit and the discussion

| Case | Must hold |
|---|---|
| Amato, the morning after | No "what he did to you" framing for a refusal; no "Anyone been bothering you?" from the man who bothered him; the hour and venue interpreted; at most five choices |
| Freddie, a first meeting at 2am | No navigation turns; no empty exchanges; stage directions not shown as speech; no narrated scores |
| Debt time | Agreed time creates the debtor's action obligation (pay by the new date); intercession is a request of the creditor, who decides |
| Misconduct | The player as boss runs the same inquiry an NPC boss does (claims, a witness, evidence, confrontation) |
| "Ask who it was" | The name becomes knowledge; options that need it appear |

---

## 12. Persistence, retention and migration

### 12.1 Retention by significance

Records are kept according to what they mean, not only how recent they are:

| Significance | What | Retention |
|---|---|---|
| **Binding** | Agreements, obligations (open, and closed for 180 days), orders | Until closed + 180 days; a ring of 200 closed world-wide |
| **Consequential** | Accusations, admissions, lies that were acted on, claims of authority, promises, claims that are the grounds of an open matter or an obligation | 1 year, or while anything references them |
| **Political** | Claims about rulings, families, who stands with whom | 1 year |
| **Ordinary** | Remarks, routine reasons, small talk | The visit only (in the trace), or a ring of 6 per NPC when acted on |

**What may be compressed.** A consequential claim older than 90 days may be compressed to `{by, about, says, value, honest, t}` (its `heardBy` reduced to the people who acted on it).

**Facts** keep `retain.ts`'s rules; claims and obligations add to `referencedFacts`, so the facts they rest on survive.

### 12.2 Budget

The new records must add **< 150 KB at day 120** across the harness seeds, and **< 250 KB at day 365**. This is enforced as a test. If significance-based retention exceeds the budget, compression thresholds tighten before anything consequential is dropped.

### 12.3 Migration (schema 8)

- **Memos:**

  | Memo | Becomes |
  |---|---|
  | `promise` with `ref` = job | Obligation, action type (the job) |
  | `promise` without `ref` from a crew man about arrears | Obligation, result type (arrears 0 by due) |
  | `pressed:warn` | Obligation, effort type (warn the man) |
  | `question` | Obligation, action type (inform) |
  | Others | Dropped |

- **`Character.talk`:** dropped.
- **`Character.denied`:** becomes consequential claims (`honest: false`).
- **Open asks:** become requests in place.
- **Open encounters:** become incoming requests where they map; others lapse with a line on the World screen.
- **A schema-7 fixture** with open memos, asks and encounters is added to `saves/oldsave.test.ts`.

---

## 13. Module plan

| Module | Contents |
|---|---|
| `perception.ts` | `perceive(w, c) → Perception` (§2.2): beliefs with bases, identity, authority as believed, uncertainty |
| `actions2.ts` | The action catalogue (§3.2): `can`, `execute` (via existing doors) |
| `agreements.ts` | Agreements and obligations, the four types, `obligationTick`, conflicts, liabilities, credit, notify (§6.3–6.7) |
| `conditions.ts` | Conditions and `holds` (§3.3); the `addFact` hook |
| `speech.ts` | Utterances, meanings, `interpret` (§4.1–4.2) |
| `respond.ts` | Interests, constraints (stage 1), evaluation (stage 2), grounds, disclosure aims, arguments, follow-ups, approach selection (§4.3–4.9) |
| `beliefs.ts` | Claims, belief, contradiction, verification, revision (§5); the `learn` fix in `core.ts` |
| `requests.ts` | Request lifecycle, refer, defer (§6.1) |
| `authority.ts` | `may()`; grants; delegation (§6.2) |
| `pursuits.ts` | Pursuits, needs, unknowns, the dependency planner, review (§7) |
| `visit.ts` | Candidates, filtering, ranking, "Something else…", Spend time, presence (§8) |
| `render.ts` | Banks and composition from meaning (§9) |
| `trace.ts` | Traces and checks (§10) |
| `ui/visitview.ts`, `ui/matterview.ts` | Screens |

---

## 14. Architecture rules (enforced by tests)

- **Decision code reads perception only.** `speech.ts`, `respond.ts`, `pursuits.ts` (planning) and `render.ts` may not import or call world readers. They receive a `Perception`. Checked by a source scan of their imports and of property access on `World`.
- **Listeners never see the private part of an utterance.** `interpret` takes a `Spoken`; `Private` is not importable by `speech.ts`'s interpretation or `respond.ts` (type separation and a scan), and the property test in §10 holds.
- **Player candidates are built from perception,** like NPCs' (scan of `visit.ts`).
- **Knowledge changes only** through `core.learn` / `rumour.pass`.
- **Obligations and agreements** change only through `agreements.ts`; requests only through `requests.ts`.
- **Every action's `execute`** calls an existing door (scan).
- **No player-facing dialogue strings** outside `render.ts` for visit text.
- **The existing doors stay closed:** rank, business cash, regard, grudge and standing, debts, work.

---

## 15. Implementation gates

Nothing is deleted until Gates 0, 1, 2a and 2b pass.

**Within the gates, work proceeds in small end-to-end slices,** each playable or at least runnable headless with readable transcripts before the next begins:
1. **The bakery:** a first visit to one shop owner (perception, interpretation, a request, refusal and counter, an intention, the five Franks).
2. **The Ferrara chain:** typed obligations, referral, delegation, an NPC-to-NPC exchange, fulfilment by outcome, notification.
3. **The remaining capabilities,** added slice by slice: debts, business deals, work, relationship acts, group visits, life.

No capability is built in full before the central interaction has been seen working.

| Gate | What | Pass criteria |
|---|---|---|
| **0. Model on paper** | This specification approved, with the P0 items | Review sign-off |
| **1. Language proof of concept** | `perception`, `speech` (meanings), `render` and a minimal `respond`, run on structured decisions for: refusals (the three meanings in §4.1), counters, warnings, introductions, deception (a cover reason, a false claim of authority), referrals, a promise of each type, Spend time. Generated for the five Franks, Nate, Rizzo, Stevie the morning after, Freddie at 2am. **Plus sequences:** the same pair over several visits with an unresolved matter. For example, Henry visits Rizzo four times over two weeks: Rizzo refuses, hears new information, reluctantly agrees, then is irritated by Henry's persistence | A human review rates the lines natural, faithful to the decision, and not repetitive within a visit **or across a sequence**; the sequence reflects the changing relationship and circumstances. Traces pass the consistency checks. The simplicity scenarios (§17.9) are walked on paper with the generated lines |
| **2a. Integration** | The new records (actions, agreements, obligations of four types, conditions, requests, authority) executing against the **existing** economy, hierarchy, knowledge and world tick, with no duplicated mechanics | Every action calls an existing door (scan); ledger and economy audits pass; obligation time rules (§6.5) pass unit tests; Ferrara chain steps 1–4 run headless against real records |
| **2b. Autonomy** | Beliefs and revision, prediction, pursuits with dependencies, NPC↔NPC exchanges, the trace | §11.1–11.5 pass on traces; prediction vs decision diverges where beliefs differ; determinism; save budget on a 120-day run |
| **3. Screens** | Visit and matter pages, behind a switch, alongside the old system | Playtest of the acceptance cases; ≤ 5 choices; no empty options (crawler) |
| **4. Cut-over** | Delete the old layer; migrate saves; replace tests | Full suite, SLOW runs, old saves load, §11.6 emergence floors |
| **5. Deploy** | | As before: build, verify live |

---

## 16. Open questions for review

1. **Reads.** Always shown, with precision set by familiarity? (Assumed: yes.)
2. **NPC↔NPC exchanges.** Visible to the player only through facts, reports and gossip? (Assumed: yes.)
3. **The player's boss.** Extra rules, or the general authority table?
4. **Calling a meeting without the authority to chair it.** Allowed as a referral to the man who has it? (Assumed: yes.)
5. **Spend time with family.** The same paragraph form, or a richer scene?
6. **Gate 1 reviewers.** Who judges the generated lines, and on what sample size? (Proposed: you, on at least 60 generated exchanges across the listed cases.)
7. **Effort specifications.** Resolved by §17: the player sees only what he said ("You said you'd do what you can"). The qualifying attempts stay internal; a failed but genuine attempt counts.

---

## 17. Player experience, simplicity and interaction flow

*Binding. Every other section serves this one. Where any part of this document would add player-facing complexity, this section wins.*

### 17.1 The principle

**Increase simulation depth while reducing player-facing complexity.** The engine tracks interpretations, beliefs, interests, authority, obligations, pursuits, relationships and favours. The player sees people, situations, a few choices and what changed. He never operates the machinery, and he never has to keep its records for it.

### 17.2 Choices

- **Typically two to four; five is the absolute maximum,** counting Leave and Something else….
- **What earns a place:**
  - what matters in this situation, not everything technically available;
  - one option for each meaningfully different intention, with equivalent options merged.
- **What doesn't:**
  - dialogue offered because a system supports it;
  - something already tried with him, unless circumstances have meaningfully changed;
  - anything in the old system that hasn't earned its place under §17.8.
- **Less prominent actions** stay reachable through **Something else…** (§8.2). It is flat, and filtered only for plausibility, never for importance. **Any action the player's character could reasonably attempt is always reachable in at most two choices.** The ranking decides what is suggested, never what is possible.
- **A straightforward objective is done in one interaction** wherever it can be: one choice, one answer, an outcome.

### 17.3 Flow

The **default pattern** of a conversation (a preferred shape, not a state machine) is:

1. **The player raises something,** or the NPC does.
2. **The NPC responds** from his knowledge, interests and circumstances.
3. **The player addresses the actual objection,** accepts the position, or leaves.
4. **A meaningful stopping point.**

**Changes of direction are allowed when the participants cause them.** Examples:
- an explanation is challenged, and evidence follows;
- he changes his mind, then raises a related matter of his own;
- something revealed opens a new subject.

These continue naturally. What is ruled out is the *machinery* resetting the conversation, not people changing the subject.

**Binding rules:**
- Every choice offered follows from the immediately preceding line. There is no return to a general list after each exchange: the general list appears once, at the start, and after a matter is concluded.
- Nothing introductory is repeated within a visit.
- No follow-ups once he has made his position clear and final ("No. And don't ask again").
- One intention, one screen. Expressing a single straightforward intention never takes more than one choice.
- Conversations are not prolonged to show the engine. Two meaningful turns beat eight mechanical ones.

### 17.4 Words, not mechanics

**Choices are lines a person would say,** with at most one short plain note. For the captain:
- "Lou's causing trouble on our streets."
- "I gave Nate my word I'd raise it."
- "Leave it with me. I'll handle it."

Never "Create intervention request", "Invoke loyalty argument" or "Register effort obligation".

**No system vocabulary on screen:** request, obligation, condition, pursuit, claim, effort, restraint, authority, stance, credit, window.

**Notes say consequences in plain words** ("He'll remember it", "Nate will expect to hear"), and never show numbers.

### 17.5 The present situation

The player should see at once:
- who he's speaking to;
- why it matters now;
- what the other man wants or believes, as far as the player knows;
- the choices;
- what changed.

There are no history logs, system explanations or numbers in an ordinary conversation. **The past acts through the present:** a promise made last week shapes this week's first line, without the player having to look it up.

### 17.6 No administrative play

**The player never:**
- updates a promise's status, or tells the game that something fulfilled it;
- reopens a matter to register progress;
- crosses several pages to finish one conversation;
- asks a man whether something happened when **his character** already knows: news reaches him only through a plausible channel (a man tells him, he sees it, word gets round, a message comes). The engine resolving something does not tell the player. If his captain settles with Lou in private, Henry learns of it when someone tells him or when he sees Lou stay away, and the screen shows only what Henry knows;
- manages the intermediate steps of something he delegated.

**The game recognises outcomes itself** and updates obligations in the world. What the player sees of them is what his character has learned, and he is told of a development only when it has reached him through a plausible channel and there is a decision to make or something he would genuinely want to know.

**Significance filter:**
- *Reported:* a promise kept or broken; a request answered; a threat to something he cares about; a decision only he can make.
- *Not reported:* routine progress; intermediate steps of NPC pursuits; each instalment of an arrangement that is going as agreed.

### 17.7 NPC initiative reduces work

NPCs resolve routine matters within their authority, follow through on what was delegated to them, report significant developments, and ask the player only when they genuinely need him.

**World activity and player attention are separate:**
- **World activity is never limited by the interface.** NPCs make requests of the player whenever their circumstances justify it. The request exists, its clock runs, and the NPC acts on the answer or the silence, exactly as it would between NPCs.
- **Player attention is managed:** the interface orders, groups and paces how requests reach him. As a guide, at most two new ones are put in front of him on a typical day; further significant ones are grouped ("Three men want to see you") or come up when he next meets the man.
- **Delivery is an event.** A request made of the player exists in the world from the moment the NPC decides to make it, but it is **delivered** only when it reaches the player's character through a channel:
  - in person;
  - word that reaches him;
  - a man sent to find him.

  Delivery is when the request is shown to the player, and the trace records it.
- **The asker's view follows delivery, as he believes it:**
  - The asker's patience with the player, and any resentment of his silence, runs **only from delivery**, and only if the asker **believes** it was delivered: he told him himself, or his messenger reported back.
  - An undelivered request is not a refusal. If the asker's need is pressing and he cannot reach Henry, his pursuit tries its other routes (§7.3), as it would with any man he could not reach. That is not resentment of Henry.
  - A request the asker wrongly believes delivered (his messenger lied, or never found Henry) can produce resentment. That is a misunderstanding in the world, consistent with Rule 6, and Henry can put it right when they meet.
- **Presentation may pace delivery, not hide it.** The interface's attention budget decides when undelivered requests are delivered (grouped, or at the next meeting). It never holds back one whose deadline would pass first: those are delivered at once. Once delivered, a request is always visible to the player until it is answered or lapses.
- **Presentation may defer, never suppress.** A request whose deadline would pass before he could plausibly learn of it is always shown. Deferring how it is shown never delays the event or penalises him for not having seen it.
- **Routine matters** that an NPC can settle within his own authority are settled by him (§7.2) and never become requests to the player.
- **A subordinate with clear responsibilities** does not ask for instructions.

### 17.8 The relevance test (mandatory for every option)

An option appears only if it passes all five:

1. **Context:** it makes sense in this conversation and these circumstances, to him as well as to the player (Rule 1).
2. **Purpose:** the player has a plausible reason to say or do it.
3. **Distinction:** it differs meaningfully from the other choices shown.
4. **Consequence:** it offers a **real opportunity**: there is a plausible way it could change the situation, the relationship, what someone knows, or future possibilities. It need not change anything every time. Asking a friend how he is may produce nothing; an attempt at reconciliation may get nowhere; an afternoon together may leave two men no closer. What is ruled out is an option that **cannot** lead anywhere (a guaranteed dead end), not one that happened not to.
5. **Clarity:** it is understandable without knowing the mechanics.

An option that fails is removed, merged, or deferred until it becomes relevant. The candidate filter in §8.2 implements tests 1 and 4; tests 2, 3 and 5 are added to it. All five are recorded per option in the trace, so the crawler can check them.

### 17.9 Simplicity acceptance tests

For each scenario, measure:
- decisions required;
- screens or menus opened;
- whether every choice was relevant (§17.8);
- whether the flow was logical (§17.3);
- whether a step could be removed without losing agency;
- whether the player understood the outcome.

| Scenario | Expected |
|---|---|
| **A. A straightforward request:** asking a trusted associate for information | One choice, one meaningful answer, an outcome. No approach step, no follow-up list. **1 decision, 0 extra screens** |
| **B. A contested request:** asking your captain to intervene | A natural objection; at most three relevant replies; a clear decision or next step. **≤ 3 decisions** |
| **C. Returning to an unresolved matter:** someone you promised to help | His first line reflects the current state. The conversation starts there, not from the beginning. **≤ 2 decisions** to resolve or update |
| **D. An ordinary social visit:** a friend, no objective | A short, believable exchange reflecting the relationship. No invented drama. **1–2 decisions** |
| **E. A busy player:** several NPC pursuits running | Routine matters progress unseen. Only significant developments reach him (§17.6). Measured over a 14-day run: the incoming requests and reports per day stay within budget, and each passes the significance filter |
| **F. An irrelevant interaction:** a man you have no business with | A brief greeting, perhaps Spend time or Ask about, or a natural end. Nothing is manufactured to fill the screen. **≤ 3 options shown** |

| **G. Repeated visits over 30 days:** the player repeatedly deals with the same five characters while their relationships, responsibilities and circumstances change | Characters remember what has been discussed. A refused request does not reappear without a reason (something changed). Lines reflect changing circumstances. **Relationships change what people initiate**, not only how warmly they answer. Routine visits don't manufacture developments. The same action does not always produce the same exchange. Measured on generated transcripts and traces over the 30 days, and reviewed by a person |

These are pass/fail gates at Gate 3 (§15), alongside the technical cases. Scenario G is also run headless at Gate 2b, with the player's choices scripted.

### 17.10 Simplicity audit of this document

| Where | Conflict with §17 | Amendment (made in this revision unless noted) |
|---|---|---|
| §0 constraints (rev. 2) | "At most five, three or four exchanges" read as a target | Changed to "typically two to four; five absolute" |
| §8.2 Something else… (rev. 2–3) | Rev. 2 was a catalogue; rev. 3 over-corrected by relevance-filtering it, which could hide what the player came to do | Rev. 3.1: suggested actions are relevance-filtered; Something else… holds every plausible action, flat, filtered only for plausibility |
| §8.9 outcome cards (rev. 2) | Showed obligation type, window and effort list: exposed mechanics | Now plain words, said as the promise was made; types internal |
| §16 Q7 (rev. 2) | The proposed exact effort list on the card | Resolved: not shown |
| §8.5 Ask him about… / Tell him… | Two entries for one intention ("raise something I know") | Merged into one entry, shown only when there is something worth raising |
| §8.4 reads | A read on every approach risked a second layer of text | Only where an approach step is shown; one short line |
| §4.9 approaches + §4.7 arguments + §4.8 follow-ups | Could stack into three successive screens for one request | **Amend:** after an objection, the replies shown are drawn from arguments, follow-ups and alternative approaches **together**, at most three plus Leave, on one screen. An approach step before the request is used only when the first answer itself depends on it (§4.9) |
| §6.7 follow-ups by beneficiaries | Risk of nagging every visit | Now raised only when something changed, a deadline is near or patience is exhausted |
| §6.8 incoming requests | Every encounter becoming a request risked notification overload | **Amend:** budgeted and significance-filtered (§17.7) |
| §8.6 Spend time | "Always" on the list | **Amend:** offered only where it fits the relationship, the place and the hour (not mid-negotiation with a stranger; at a shop counter it is "buy something"). It counts against the five |
| §8.1 "His word" + choices | His opener and a list could both demand attention | **Amend:** if he raises something, the choices answer *it* first. The general list appears only after his matter is answered or set aside |
| §8.8 matter pages | Moves from a page could become a second place to manage matters | **Amend:** only resolving moves that need no conversation (accept his counter, withdraw). Everything else is "Go and see him". No statuses to maintain |
| §7 pursuits for the player | A player "pursuit" list would be administration | **Amend:** the player has no pursuit records to manage. His aims are inferred from his requests and promises, and they only rank his options |
| §11 acceptance cases | Technical cases alone could pass a cluttered UI | §17.9 added as gates |
