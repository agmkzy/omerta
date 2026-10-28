# Conversations: the overhaul log

The owner's brief (28 October 2026): a smaller, more intelligent, more natural conversation system, in which every answer responds
to what was said, every name is right, every option fits the man and the moment, and the family's matters can be carried in person.
The audit that started it is `AUDIT.md`; the measuring tool is `src/tests/tools/convaudit.ts`; the standing checks are
`src/tests/dialogue/coherence.test.ts`.

## Increment 1 (28 October)

### Measured (convaudit, seed 3; seeds 7 and 11 alike)
| | before | after |
|---|---|---|
| opening choices per conversation | 16.2 | 11.7 |
| to his own man / his superior | 22.0 / 21.2 | 11–14 |
| distinct actions offered | 61 | 43 |
| flags (self-naming, player named to his face, broken text, no answer) | 148 | 0 |
| relationship arrows shown (Trust ▲ …) | after almost every exchange | none |

### Structure
- **What the man is to the player, in one place** (`conv/relation.ts`, `tieOf`: superior, above, mine, below, peer, rival, outside).
  The interactions that were misdirected now read it: asking a man to put in a word goes upward, to a man who has someone above him
  (not your own soldier, not the boss); "who's really running things" is not asked of the boss; a superior does not offer to run his
  own man's racket; street orders ("keep your head down", "find something extra") go to men on the street, not to an underboss.
- **Who is who in a line** (`conv/persp.ts`): a third party by his first name unless the speaker, the listener or the player shares
  it; "I"/"me"/"you" for the two men talking; possessives; "a"/"an". The speech pass (`conv/acts/words.ts speechFor`) no longer
  shortens a full name to a first name the speaker or player also has ("Louie Costa sent me", said to a shopkeeper called Louie, is
  answered "Louie Costa. All right"), and a sentence that begins "my" begins with a capital.
- **The opening list, said once each** (`conv/run.ts tidy`): a man's view of people is asked through "What do you make of…?", not
  also one by one; one way of asking how business is; one event at a time; one question about what he wants; your own man's week is
  "How are things at your end?", not also "How's business?".
- **What changed, shown as a man would show it**: the ▲▼ card is gone; a change that shows becomes a line of narration ("Louie will
  remember that you did", "Something in Mario cools toward you"); money changes remain as a figure.
- **Matters in person**: a matter's move chosen in conversation now arrives whole (its code was being cut at the first colon, so
  "lean on this captain" and "advise: guilty" were lost).

### The menu
Removed or merged: *Reminisce/Mind if I sit a minute* (into How are you keeping? and the evening), *Ask around about him first* (not
something said to him), *Ask Louie to put in a word* (now "Louie Costa sent me", to strangers), *Is there anything you need done* /
*I'm ready for more* / *What would it take to be moved up* / *Where do I stand* / *What about the books* (into **Where do I stand with
you?**, which answers in words what he thinks, what it would take for the next step, and, for an associate, the books as a made man
knows them, and leads to *Would you put in a word for me?* and, for a soldier, *One day I want a crew of my own*), *What do you want
out of all this* (the same as *What are you after?*), *You hear what happened at X* when *What do you know about X* is offered.
Empty subjects are no longer shown.

### Answers that now answer
- *Let me buy you a drink*: the evening, then either what is on his mind or one piece of news he passes on, introduced as such
  (it ran the three together).
- *Where do I stand with you?*, asked of the boss by his underboss or consigliere: how the boss sees him, not a road to a chair
  above the boss ("the only way up is for the man above you to stop being the boss").
- The road to the next step said for the step: an associate's to being made; a made man's to a crew ("a man who wants more has to
  bring more up than that"), not "nobody puts a name forward".
- A man's trouble in his own words ("I'm in deep with a bookmaker", not "He's in deep…" said of himself).
- Rumours without ledger figures ("Police raided the chop shop in Red Hook. Richie will be a while getting it going again"; a
  robbery "a few hundred dollars", not "$193").
- Quotation marks normalised in every line said or narrated in a conversation.

### New, from the family overhaul, in conversation
- **One day I want a crew of my own** (soldier to his captain): his answer from the contenders, his own choice for his chair and how
  he takes being asked; then *What would you need to see from me?* (the weakest parts of the record, in his words), *I've already
  got men working for me* (whether they are really yours), *Then I'll prove it*; asked again, he remembers when, and whether anything
  has changed.
- **Is there something you want my view on?** (the consigliere to his boss): the inquiry he set, *Louie. What did you find?*, and
  the advice given to his face; otherwise a captain he isn't sure of.
- **About what I told the captains** (the boss to a captain): a captain going along says so; one who isn't admits it if he
  respects or fears the man asking, and otherwise says he is ("He says it easily"); *Push them* / *Do it your way, then*.
- **Hearings**: what has been found can be put to the accused (*Your numbers don't add up. Explain it.*): a guilty man with little
  nerve owns it, a cool one has a thin story, an innocent one an answer. A man who put the accused's name forward is remembered when
  the charge proves true.

### Tests
- `coherence.test.ts`: the audit run at every seat finds nothing; the opening list is short (≤ 13 on average, ≤ 18 for any man);
  every choice is answered; requests go up and orders down for every man of the family at five seats; the consigliere gives the boss
  his finding in person and the boss decides; the underboss puts the charge to a captain in person and the answer is recorded.
- Existing: the dialogue crawler and audit, the experience walker (its check for the player named as another man now tells a first
  name followed by another surname from the player's own), the full suite.

### Still to do
- Another pass on the shopkeeper and other-family conversations, and on what arrives through encounters (their wording is separate).
- Commitments from conversation into the world's records beyond those that exist (backing, favours, memos): a captain's promise to
  recommend, a captain's agreement to the underboss, kept or broken.
- Adversarial play in the browser at all six seats, read as a player; recorded below as it is done.

## Increment 2 (28 October)
Measured (convaudit): **10.5–11.0 choices per conversation** (from 16.2), 43–50 actions, no flags on seeds 3, 7, 11.
- Money is asked only of a man you have met, and never of another family's boss; work is asked of a man you have met.
- A stranger is met first (*Walk over and say who you are*, or *X sent me*): the evening is not also offered as an introduction.
- One way into an event: the menu of recent trouble when there is more than one; the single question otherwise.
- What a man wants is said in one wording, whichever question reaches it (*What's new?* and *What are you after?* no longer give
  two different ambitions).
- Asked to put in a word a second time within the month, he has already answered: it is remembered and pays nothing again.
- The road to a chair, said by the boss himself, is not "the men above me".
- Hints that described the game instead of the man ("Opens the protection conversation") reworded.
- Tests added: asked twice, he says so; a man already working for you is not offered work with you; a man who changed sides is
  spoken to as what he is now; a decided hearing cannot be reopened, nobody judges or investigates his own case; the word put in
  is kept, not paid twice.
