# The conversation overhaul: what changed, and why (28 October 2026)

The owner asked for a smaller, more coherent conversation, organised around the man in front of you and what is happening between
you; for answers that answer what was said; for names that are right; and for an account of what was removed, merged, moved and
rewritten, with before-and-after examples. This is that account. The audit that began it is `AUDIT.md`; the running log is `LOG.md`.

A smaller list is not the measure. The measure is whether, talking to a man, you can see at once why you would want to, whether he
answers what you said, and whether what passes between you is still there next time. The numbers are here because they show where
the clutter was.

## The shape of a conversation, before and after

**Before.** Up to three "lead" lines, then five categories to browse (Work & money, Family business, People & rumours, Personal,
Settle something), each opening onto entries that opened again ("Your standing (2)", "Pass the time (3)"). Behind them, 16.2 things
to say per man on average; 21–22 to your own captain or your own man. After most answers, the next choices were the categories
again. A card after nearly every exchange read "Trust ▲ · Warmth ▲".

**After.** One short list, in the order a man would think of it:
1. **What is between you**: his request, a matter you are both in, a debt, a promise. Always first; a man who came to you with
   something has it answered before anything else.
2. **Why you'd talk to this man**: what you are to each other decides it (your captain: where you stand, work, an envelope; your own
   man: his week, and what he is to do now; a shopkeeper: his place; a man of another family: how things stand between the families,
   or a warning; a stranger: who you are, before anything else).
3. **The man himself**: how he's keeping; an evening with him.
4. **Something else**: whatever else there is, flat, for the occasion it fits.

When a subject opens, what follows is what one says next about it; when it is done, the list comes back. No categories to browse;
the side panel shows what is between you, not subjects. Measured: 7.7–7.9 things a man can be asked, of which the screen shows the
first handful and folds the rest; 32–39 interactions in use (61 before); no audit flags on three seeds.

## Removed

| What | Why | What took its place, if anything |
|---|---|---|
| The five subject categories and their nested entries | Browsing filing cabinets, not talking to a man | One list ordered by relevance (above) |
| *Mind if I sit a minute / Reminisce* | Answered with a police report or a rumour; the same as asking how he is, or an evening | *How are you keeping?*, *Let me buy you a drink* |
| *What do you make of…?* (a menu of opinions) | A second menu inside the conversation | The one question that mattered in it (*What are people saying about me?*) asked directly, of a man who would tell you straight |
| *What do you make of the others?* | A list of every man in the family to ask about, answered in generalities | A man in a matter is asked about in it |
| *Who's really running things?* | Asked of your own captain ("you ask a lot of questions for a man I hardly know") and of the boss himself | The family's structure is on the Family screen |
| *We've been through a bit, you and I* | Said for its own sake | What is between you is shown beside the conversation |
| *Trade a little gossip*, *Stand him a drink ($30)* (another family) | The same as news over a drink, and the same evening | The evening; *How are things between our people and yours?* stays |
| *Ask around about him first* | Offered while already talking to him | — |
| *How do my numbers look?* (to your captain) | Recited the envelope arithmetic | Your money is part of *Where do I stand?*; what is owed between you stays as *Discuss what's owed* |
| *I'm ready for more* (old) | A duplicate of asking for work | *I want more responsibility*, redesigned (below) |
| The relationship card (▲▼) | A meter, not a man | A line of narration when the change would show ("Louie will remember that you did") |

## Merged

| These | Into |
|---|---|
| *Is there anything you need done / What would it take to be moved up / Where do I stand with you / What about the books / I'm ready for more* | **Where do I stand with you?** — answers for the step you are on (an associate's road to being made, the books as a made man knows them; a made man's to a crew); leads to *I want more responsibility*, *Would you put in a word for me?*, and for a soldier *One day I want a crew of my own*. *Is there anything you need done?* stays: it asks for work |
| *What do you want out of all this* / *What are you after, in all this* | One question, with one wording for what a man wants whichever question reaches it |
| *How's business* / *How's the business going* / *How's business treating you* | One, for the man who has a business or racket; for your own man, his week (*How are things at your end?*) |
| *What do you know about what happened at X* / *You hear what happened at X* / *What do you know about the recent trouble* | One way into an event at a time |
| *Walk over and say who you are* / *Let me buy you a drink* (to a stranger) | A stranger is met first; the evening comes after |
| Two "lend you money" and two "here's $200" offers | Offered as the answer when he has said he is short |

## Moved

| What | From | To |
|---|---|---|
| Orders to your own man (*Keep your head down*, *Find yourself something extra*) and *I expect more from you* | The opening list | What you say after he has told you how his week went |
| *Ask Louie to put in a word* | Said to the man you were talking to | *Louie Costa sent me*, said to a stranger, with the vouching it implies |
| Asking about the leadership | Conversation | The Family screen |
| Setting the family's direction | (new tonight) the boss's family screen | Discussed with a captain in conversation (*About what I told the captains*) |

## Rewritten or redesigned

- **What the man is to you, decided once** (`conv/relation.ts`): requests go up, orders go down. A captain no longer asks his own
  soldier to put in a word for him; the consigliere no longer asks the boss to; nobody asks the boss who runs the family; a superior
  no longer offers to run his own man's racket; street orders are not given to an underboss.
- **Who is who in a line** (`conv/persp.ts`, and the speech pass in `conv/acts/words.ts`): a man is "I" and "me" in his own mouth, the
  player is "you", a third party goes by his first name unless that name is the speaker's, the listener's or the player's ("Louie Costa
  sent me" to a shopkeeper called Louie). Encounters (men who come to you) go through the same pass; they were reading out record text
  ("Angelo Bianchi missed a $20 payment to Charlie Cassano", said by Charlie Cassano).
- **Where do I stand?** Asked of the boss by his underboss or consigliere, it is how the boss sees him, not a road to a chair above the
  boss ("the only way up is for the man above you to stop being the boss"). The road is said for the step: no "nobody puts a name
  forward" to a made man; no "you're close on the money… has to bring more up than that".
- **I want more responsibility** (redesigned): his answer is his situation: a captain who is stretched hands you something now; one who
  trusts you encourages you; one who thinks you're ahead of yourself asks what you think you've done; bad blood, and he won't hear it.
- **How are things at your end?** (your own man): his account of his week; a man holding out shades it with a plausible reason. Then:
  *That's not what your envelope says* (he owns it or digs in, by his nerve; if he hasn't been holding out, he's insulted and
  remembers), *I expect more from you*, or an order.
- **One day I want a crew of my own** (soldier to captain): his answer from the contenders, his own choice for his chair and how he
  takes being asked; then *What would you need to see from me?*, *I've already got men working for me*, *Then I'll prove it*. Asked
  again, he remembers when, and whether you've led men since.
- **The consigliere**: the boss asks *What are you hearing?* (a captain with a grievance, money that doesn't add up; nothing, from a
  consigliere who doesn't trust him); the consigliere asks *Is there something you want my view on?* and gives his finding to the
  boss's face.
- **The boss's direction, raised with a captain**: a captain going along says so; one who isn't admits it if he respects or fears you,
  and otherwise says he is ("He says it easily").
- **The evening**: the hour spent, then either what is on his mind or one thing he passes on, introduced as such, not three run
  together.
- **A man's trouble in his own words** ("I'm in deep with a bookmaker", not "He's in deep…" of himself).
- **Rumours without ledger figures** ("Police raided the chop shop in Red Hook. Richie will be a while getting it going again"; a
  robbery "a few hundred dollars").
- **The player's words without quotation marks**, everywhere he speaks (the list is what he says; "You:" marks it); everyone else's
  speech in curly quotes, apart from narration.
- **Hearings in person**: what has been found can be put to the accused; the consigliere's advice is given to the boss in
  conversation.

## Duplicated logic removed
- Each interaction's own rank test for who may be asked → one relation (`tieOf`), read by all.
- Each interaction's own first-name handling → one rule (`nameIn`), used by the speech pass, events and incidents.
- Quotation-mark fixes line by line → one normaliser (`curly`) in the speech pass, encounters included.
- A matter's moves were cut at the first colon when chosen in conversation (so leaning on a captain or giving advice was lost):
  carried whole.
- The opening list deduplicated in one place (`conv/run.ts tidy`) instead of per interaction.

## Meaningful capabilities kept
Work, loans (asked of men you have met, not of another family's boss), gifts, backing and putting in a word (remembered; a second ask
in the month pays nothing), the books and your place in line, captaincy ambition, putting a crewman's name forward, informing on a man,
protection and its haggle, buying a place or a piece of it, partnerships, running a man's racket (within the family), recruiting,
your own man's trouble and what you do about it, warnings to another family, how things stand between the families, event questions
(who told you, who did it), the evening and what it brings, what a man wants, what people say about you, every matter's moves in
person (hearings, the underboss's charge, the contest), the consigliere's counsel and inquiry, the boss's direction.

## Before and after

### 1. An associate with his captain (seed 3, Louie Costa)
**Before** — 20 things to say. Among them:
> **You:** Mind if I sit a minute?
> **Louie:** He sighs as if it were a burden. "Listen. Word is: Police raided the fencing operation in Little Italy. It costs Tommy
> Russo $249 and some weeks."
> *Trust ▲ · Warmth ▲*

> **You:** Where do I stand with you?
> **Louie:** "To be a soldier," he says, "it all adds up over the whole climb: what you declare and hand over. Declare it straight and
> hand it over in person. Gifts make friends; they are not earnings."

> **You:** Who's really running things?
> **Louie:** "You ask a lot of questions for a man I hardly know." *(He is your captain.)*

**After** — what you might say: *Is there anything you need done? · Where do I stand with you? · Would you put in a word for me? ·
A little something for you ($300) · How are you keeping? · Let me buy you a drink · Something else*
> **You:** Where do I stand with you?
> **Louie:** "You're not there. Right now people call you unproven."
> "You've hardly passed anything up. Nobody puts a name forward for a man short of it."
> "You need made men who'll stand up for you. Right now nobody would."
> "The books are open. There are seats to fill."
> He lowers his voice. "There are men ahead of you. Mickey, for one. You're in it, though."
>
> *Next:* I want more responsibility · Would you put in a word for me?

### 2. A captain with his own man (before: seed 3, Angelo Rizzo; after: seed 9, Benny Amato, who had been holding out)
**Before** — 21 things to say, including *Would you put a word in for me?* (to his own soldier) and *Offer to run his chop shop* (to
work for his own man), and both *What do you want out of all this?* and *What are you after, in all this?*.
> **You:** Sit down a minute. Talk to me.
> **Angelo:** He lowers his voice. "Word is: Charlie found out Artie has been running something on the side."
> *Trust ▲ · Warmth ▲*

**After** — *How are things at your end? · How are you getting on? · Let me buy you a drink · Something else*
> **You:** How are things at your end?
> **Benny:** "About $400, with the crew. It would have been more, but there was a fight at one of the spots and people stayed away."
> **You:** That's not what your envelope says.
> **Benny:** Benny looks at the table. "All right. I've been keeping a little back. It stops."
*(He had been holding out; a man who hadn't would have been insulted, and remembered it.)*

### 3. The consigliere with the boss (seed 3 / 7)
**Before** — *Would you put in a word for me?* (to the boss: with whom?), *Who's really running things?* (answered with a grunt),
*Where do I stand?*, *How do my numbers look?*; nothing a consigliere is for.

**After**
> **You:** Is there something you want my view on?
> **Teddy:** Teddy doesn't waste time. "Louie. What did you find?"
> *Next:* Louie did it. I'm sure of it. · There's nothing in it. Mario has his reasons. · I can't tell you for certain.
> **You:** Louie did it. I'm sure of it.
> Teddy hears you out, and does what you said.
*(And when the truth comes out later, he remembers whose advice it was.)*

### 4. The underboss asking the boss where he stands
**Before**
> **Tommy:** "To be a boss," he says, "the only way up is for the man above you to stop being the boss. How that happens is your
> business."

**After**
> **Tommy:** "You do your job. That's where you stand."

### 5. A stranger
**Before** — to a shopkeeper named Louie Ferrara: *Ask Louie to put in a word*, answered "Louie. All right. If Louie says." (which
Louie?); to an associate you had never met, *What do you want out of all this?* and *Offer to run his chop shop* before you'd said
your name.

**After** — introductions first (*Walk over and say who you are*, *Louie Costa sent me*), and the rest after:
> **You:** Louie Costa sent me.
> **Louie:** He lets out a breath. "Louie Costa. All right. If Louie Costa says."

### 6. The same captain, a month apart (continuity; seed 5, soldier start)
**Day 5**
> **You:** Where do I stand with you?
> **Danny:** "You're not there. Right now people call you unproven." "You're close on the money. Keep it coming." "When a chair comes
> up, the men who decide have to think of you. Right now nobody would."
> **You:** One day I want a crew of my own.
> **Danny:** "People talk about you. That's a start. A crew's the boss's to give, and he gives it when there's one to give."
> **You:** What would you need to see from me?
> **Danny:** "Men who do what you say, and keep doing it when you're not there."

**Day 30**, after three weeks of leading men and passing money up:
> **Danny:** "Where've you been keeping yourself?"
> **You:** Where do I stand with you?
> **Danny:** "You've come on since you asked me a month ago. The money you pass up, for one." "You're ready. There's no chair.
> Somebody has to die, retire or go away first. Be ready when it happens."
> **You:** One day I want a crew of my own.
> **Danny:** "You asked me that a month ago. You've done some leading since. I noticed."

Nothing here is a separate conversation memory: what he remembers is what the world recorded (the topics a man has been asked, the
record of what the player has done).

## What remains imperfect
- Many answers are still drawn from tables by archetype; two men of one temperament can say the same short line on the same day.
- *What's new?* is kept for what it shows of a man (a friend tells, a wary man gives a rumour at most, a hostile one nothing), but the
  rumours it gives are not always the ones that matter to the player.
- Some of the older, longer branches (protection, loans, a man's trouble) have not been rewritten line by line; they were checked for
  identity and coherence, not voice.
- The consigliere's *What are you hearing?* now names only what could have reached him (a captain who talks to him, men of a crew who
  trust him); it is still a judgement about plausibility, not a record of words said in his hearing.
- Browser playthroughs were made at all six seats and the transcripts read, but not yet the long multi-week playthroughs per seat the
  brief describes.

---

# The deepening pass (28 October, late): men who decide, and know only what reached them

## The structural weaknesses found
| Weakness | Kind | Where |
|---|---|---|
| Characters spoke from another man's private record (his books, his grudge) | Incorrect knowledge handling; a missing simulation concept (what men can see of each other) | the consigliere's report, hearing witnesses, the underboss's look at a crew |
| Outcomes computed from the player's choice with a token weighing | Missing NPC decision logic | the consigliere's advice; a challenged crewman; *Where do I stand* asked of the boss; a name put forward |
| Follow-ups lost after a matter move; a question put to the player with no answer | Poorly structured follow-ups | matter moves in conversation; the boss's "Are you?" |
| Record text (third person) inside a speaker's quotes | Generic templates over records | the job pitch |
| New conversation code writing the world directly | Duplicated responsibility (caught by existing architecture tests) | the new family interactions |

## Knowledge and its provenance (invariant A)
One rule (`conv/notice.ts`): what a man can see of another (`seesLifeOf`: his captain, his own men, his crew, the men who work his
places, the made men at the club, men who know him well) and what that shows (`signsOf`: living beyond what he passes up, going
without, hurt), said as a sign, not a finding; and what he has heard a man say or do against another (`heardAgainst`: facts he holds,
said as seen or as told by a named man). A man's private state drives his own behaviour only. Relationships decide whether a man
*shares* what he has, never whether he has it.

## Judgment and reactivity
- The boss weighs advice (trust in the consigliere, what was actually found, his own ties to both men, the stakes, his temper) and
  accepts, challenges, refuses, or keeps it to think over and decides later by his own weighing.
- A challenged crewman answers as he is and as he stands with you; what follows depends on what he said; only an admission is recorded.
- *Where do I stand*, from the boss, is his situation: succession on his mind, pressure on the family, the man's reach, trust.
- *I want more responsibility* is the captain's situation; a name put forward can be refused; an introduction is a reason to talk.

## Transcripts (real game states, through the engine the screen uses: `src/tests/tools/transcripts.ts`)

### The consigliere advises the boss (consigliere start, seed 7)
**A boss who trusts him, with nothing between him and the accused**
> You: Louie did it. I'm sure of it.
> Teddy: Teddy nods. "I thought as much."
> *(Recorded: found against him.)*

**A boss who is fond of the accused** (he refuses)
> You: Louie did it. I'm sure of it.
> Teddy: Teddy shakes his head. "No. Not Louie. I don't see it."
> *(Recorded: the charge thrown out.)*

**A boss who wants to know what it rests on** (he challenges; then decides himself)
> You: Louie did it. I'm sure of it.
> Teddy: Teddy leans back. "You're sure? Louie has been with us a long time. What have you got?"
> You: Here's what I found.
> (You lay it out: A man around him told you he has been spending more than his envelopes explain.)
> Teddy: Teddy looks at you a long time. "Leave it with me." Whatever he decides, it won't be tonight.
> *(Two days later he decided: found against him. With nothing to lay out and only the consigliere's word, the same boss decided: no
> finding.)*

**An uncertain consigliere**
> You: I can't tell you for certain.
> Teddy: Teddy rubs his eyes. "Then I'll sleep on it." *(He decided on the day he meant to.)*

### A captain challenges his own men about their envelopes (captain starts, seeds 3, 5, 7)
| Man | As he is | What happened |
|---|---|---|
| Louie Caruso (holding out; careful, with men under him) | "It's not me. Mickey's been light, and I've been covering for him." → *Don't lie to me* → "I told you how it is." He holds your eye. | No admission recorded; the lie stands until disproved |
| Angelo Rizzo (holding out; proud, but fears and respects his captain) | "You calling me a thief?" → *I'm asking you* → "All right. I've been keeping a little back." → *Put it back / Once / You're out* | Admission recorded; the holding back stops |
| Ralphie Russo (holding out; proud, little fear or respect) | "You calling me a thief?" → *I'm asking you* → "Then the answer's no." | No admission; a little grudge |
| Carmine Costa (holding out; cautious) | "What makes you say that?" → (his books show no short week, so the only answer is) *Call it a feeling* → "Then there's nothing to talk about." | Nothing; you had nothing to show |
| Sonny Lupo (honest; proud) | "Count it yourself. Every dollar. Then you can apologise." → *I'll count it* → "Go ahead." | His grudge against you, recorded with its reason |
| Marty Bellini (honest; easy) | "Go through my books with me, any time you want. It's all there." | Nothing |

### A soldier asks his captain for more responsibility (soldier start, seed 5)
| The captain's situation | What he said |
|---|---|
| Stretched (few men, behind) | "I'm stretched thin, as it happens. Next thing that comes up, it's yours." |
| Trusts him | "Good. That's what I like to hear. Keep doing what you're doing, and I'll put more your way." |
| Thinks he's ahead of himself | Danny studies you. "What do you think you've done, that you're asking me that?" |
| Bad blood | Danny doesn't even look up. "More? After the way things are between us? No." |

### The underboss asks the boss where he stands (underboss start, seed 7)
| The boss's situation | What he said |
|---|---|
| Trusts him, has him in mind to follow | "I won't be in this chair for ever. When I'm done, the family will need a man who knows it. Keep doing what you're doing." |
| Pressure on the family | "Right now I need to know who's with me. Nothing else matters this month. Are you?" → *I'm with you. You know that.* (a promise, kept) |
| Distrusts his reach among the captains | "I hear you've been making friends among the captains. Be careful whose friend you are." |

### The boss raises his direction with captains (boss start, seed 5; "keep your heads down")
| Captain | What he said |
|---|---|
| Going along | "We're doing it. Some of my men grumble. They'll live." |
| Ignoring it, respects the boss | "Not yet. My men don't like it, and I haven't pushed them." → *Push them* → "All right." He doesn't like it. He'll do it. |
| The same captain, without that respect | "We're doing it," Danny says. He says it easily. *(He isn't.)* |

### An associate, introduced by name to a stranger, asks him for money (associate start, seed 3)
> You: Louie Costa sent me.
> (Louie had a word with Teddy Lucchese before you arrived.)
> Teddy: He nods slowly. "A recommendation. I do like to know what a recommendation costs."
> You: Could you lend me $500? I'll pay interest, whatever's fair.
> Teddy: "I don't know you well enough for that."

## Consequences that persist (checked)
- Advice refused is recorded as refused; advice taken is recorded as the boss's ruling; a decision put off is made later by the boss's
  own weighing, and when the truth surfaces he remembers whose advice it was.
- An admission is a fact both men hold; a denial is not; a lie told in blame stays a lie told.
- "I'm with you" is a promise in the boss's memos; a captain's "I'm with you" in the contest that he doesn't keep is on the record.
- A month later, a captain says what has changed since you last asked (the money you pass up; the leading you've done).

## Tests and play
- Full suite: 756 passed (before the last additions; 478 conversation tests after them, with the new judgment and provenance tests).
- `coherence.test.ts` now also checks: knowledge provenance (a man holding out but living poor shows nothing; a private grudge is not
  heard; said in front of him, it is); a boss fond of the accused refusing the advice, recorded as refused; a denial is never recorded
  as a confession, an admission is.
- Played in the browser at all six seats (associate to captain, soldier to captain, captain to his own man, underboss to captains and to
  the boss, consigliere to the boss, boss to the underboss, consigliere and captains); the transcripts above were played through the same
  engine the screen uses.

## What remains imperfect
- Older parts of the conversation (a man's trouble, protection, loans) still choose many lines from tables by temperament; they were
  checked for identity and coherence, not rebuilt around each man's situation.
- Some older encounter outcomes narrate compliance without showing a decision (register R2), and some older code still reads private
  state for a third party's words (register R6); both are listed for the next review.
- What a man can see of another (`seesLifeOf`) is a rule of proximity; it is a judgment about plausibility, and a stricter version
  would record sightings as facts. It never asserts wrongdoing, only signs.
- Long multi-week play in the browser at each seat has not been done; continuity was checked by scripted month-apart conversations.
