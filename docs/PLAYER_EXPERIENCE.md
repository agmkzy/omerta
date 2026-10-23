# OMERTÀ: player experience, conversation and interface overhaul

*October 2026. The running record of this overhaul, after Stages 4 and 5 (see FOUNDATION.md).*

## A. Audit: why the game still felt the same

The simulation under the screens had changed a great deal by the end of Stage 5. The screens had not: almost everything the player sees was laid out for the game before Stage 4.

### The conversation

- **The matters between two men were still one-shot menu lines.** Money a man owes you, money you owe, his envelope coming up short, a job he did for you, something that happened: each was a sub-menu ("Remind him what he owes", "Give him more time", "Halve his weekly payment", "Ask why his money dropped") whose lines each did one thing and put you back on the sub-menu. Nothing he said opened anything further; nothing you said was answered on its own terms.
- **Answers were generic where the world was specific.** "Ask why his money dropped" gave a reason from a short list. The books knew which week was short and why, which of his shops were behind and by how much, whom he owed. The conversation said none of it.
- **What was said was not kept.** A man who told you his money was short because business was slow was not held to it when the books showed otherwise. A week's grace was a line of text, not a date.
- **The opening screen led with structure, not with the man.** Stage 5 added "On your mind" and five ways in, but the first four rows were usually the same five headings, and the thing you actually had to talk about (his short envelope, the money he owes) was one sub-menu down.
- **Negotiations read like forms.** You named a figure and got a sentence back; the reason he gave rarely mentioned what you had offered, and the only things to say back were general ("Be sensible").
- **Help was forgotten in conversation.** The relationship records it (a favour owed, a bond), but the man never said so.
- **Taken one at a time, the pieces were good:** talk.ts's subjects, the negotiation framework, the exchange's points and replies, temperament. The overhaul builds on them rather than replacing them.

### The interface

- **Six sections for five ideas.** Today, Rackets, Crew, Family, Life (itself four rooms: you, people, business, what you know), Stories. People and business lived inside "Life"; the crew and the family were two tabs; the stories and "what you know" were two places.
- **Mechanics with no front door.**
  - A business's page offered "talk to the owner" but not what talking would allow.
  - A debt had no page.
  - A man of yours had no "discuss his performance".
  - The Family tab didn't say what a promotion would take.
- **The world looked empty unless something was due.** Who is where, what is going on around them, and what has just happened were scattered, or reachable only through someone's page.

### Action coverage

What the player can do, the mechanic that does it, where it lived, and where it lives now. Nothing was removed.

| Action | Mechanic | Was | Now |
|---|---|---|---|
| Talk to anyone | dialogue.ts | Person page, places, Today | Same, and from every business, debt, job and story that names him |
| His money coming up short | books.ts; threads.ts `earn` | Crew sub-menu one-liners | A conversation: why, which places, the missing money, gambling, make it up, a week's grace |
| Money owed either way | core debts; threads.ts `debt` | Debt sub-menu one-liners | A conversation: the sums, how much he can manage, pay now, a week, easier terms, forgive, lean, who else he owes |
| A job he did for you | orders.ts; threads.ts `job` | Report screen | A conversation, and the report screen |
| Something that happened | rumour.ts; threads.ts `ev` | "What happened?" | A conversation: how he knows, who told him, who did it |
| Which places are hurting | threads.ts `hurting` | none | Asking about something |
| Buy, sell, stake, run, lend, borrow, protection | asks.ts (Stage 4) | Proposals | Business, with the figure in the exchange and replies that change the terms |
| His request of you | encounters, asks | Hub row / encounter screen | He asks for a minute, and the conversation |
| Orders to your men | work.ts | Crew → Orders | Family → your man → give him work |
| Rackets | rackets.ts | Rackets tab | Business |
| Businesses you own, your stakes, managers | econ.ts | Life → business; business page | Business; business page |
| Loans out and in | core debts | Life → business | Business, each with its man |
| Career, standing, seat | path.ts, career.ts | Life → you; Family | Family |
| Stories, what you know, history | situ.ts, rumour.ts | Stories; Life → known | Journal |
| Places, the club | places.ts, clubdata.ts | Today → around town | World |

### Replacement architecture

1. **The matters between you are conversations** (threads.ts, built on talk.ts subjects). The man answers from the world, the next things to say follow from his answer and from what has already been said, and claims, promises and admissions are kept on the man (`Character.talk`, `memos`).
2. **The opening screen leads with what is real.** It shows what he brought you, then the matters between you, then what's on his mind. The five ways in come after, as the way into everything else.
3. **Negotiation is an exchange.** He says the terms back in his own way. You can ask his figure, go up, change what's asked for, tell him you know he needs it, or walk away. It all runs through the same negotiation rules.
4. **Five sections: World, People, Family, Business, Journal.** The player's own page opens from his portrait.
5. **Every record leads to the man it concerns.** A business, a debt, a job, an enterprise or a story offers "go and see him", and the conversation opens on that matter.
6. **A noir visual identity** across all of it: charcoal, sepia and muted gold; period type; speech set apart from narration.

## B. Conversation state and progression

**New subjects** (`threads.ts`), registered with talk.ts's subjects (`talk.MORE`) so they share its memory, its follow-up mechanics and its rule that a subject gone over and unchanged waits a week.

| Subject | Opens with | He answers from | What can follow |
|---|---|---|---|
| **His money** (one of your men, envelopes short) | "Your money's been light lately." | The real week: a downturn and its cause, a man who stopped paying him, jail, money held back for a few days, or a lie (a slow patch) if he has been keeping it | **"Which places?"** He names the shops on his book and his racket, truthfully or not. **"That doesn't explain the missing money"**, only when what you can see doesn't match: he breaks or denies it, and an honest man is insulted. **"I heard you've been gambling"**, only if you know. **"Make up the $X"**: he pays what he has. **"Another week"**: his promise, with a date. **"Don't let it happen again."** |
| **A debt** (either way) | "About the money you owe me." / "About what I owe you." | The balance, payments missed, whether he has it | **"How much can you manage?"** The truth, or less, if he's greedy and careful. **"Pay what you can now."** **"Another week"** moves the payment. **"Easier payments"** halves it. **"Take a quarter off"** is forgiveness. **"Pay up, or there'll be trouble."** **"Who else do you owe?"** He names them, if he trusts you. Owing him: pay, settle, or "I need easier terms" (the negotiation). |
| **A job** he did for you | "What happened with that job?" | His report, true or not | **"Tell me again. From the start."** A false story slips. **"Who else was there?"** You learn what he did. **"Good work."** **"That's not good enough."** |
| **Something that happened** that you've heard of | "What do you know about what happened at …?" | What he knows, and how (seen, told, rumour, suspected, out of date), or "First I've heard of it" (and now he knows) | **"Who told you that?"** A name, unless he protects the man or doesn't trust you. **"Who did it?"** If he knows and will say, now you know. **"Are you sure it was …?"** |
| **Which places are hurting** | "Which places around here are hurting?" | The shops he owns, collects from or manages, and what the street knows is struggling | You learn which, and he said so |

**What's said stays said:**
- **His claim about his money** (slow, coming, denied, admitted) is kept on him. Raised again, he stands by it ("I told you before. Business is slow.") or, having admitted it, doesn't repeat the lie.
- **An admission ends the holding back** (`Books.skim`, `Books.hide`).
- **A week's grace is his promise,** held to by the existing rule: if he still owes anything up when the week is out, it's a broken word, trust falls, and the world hears of it.
- **An accusation he didn't deserve** is a grudge with its reason.

**The opening screen** now leads with these. What he brought you comes first; then the matters between you, said as you'd open them ("Your money's been light lately.", "About the money you owe me.", "What happened with that job?"), most pressing first; then what's on his mind (his own concerns, never your questions); then the five ways in. Inside the ways in, each subject sits where it belongs: a debt under Business, his money under Settle Matters, a job under Organization, an event and the hurting places under Ask About.

**Negotiation as an exchange** (`exchange.ts`, deals):
- **He says your terms back, in his manner:**
  - "Thirty percent? For $5,000? You're asking for a lot."
  - "$2,000 for the whole place? It's worth more than that."
  - a proud man offered less than half a fair price: "You insult me", and he remembers it;
  - a cautious man near the top: "I'll pass", and no reason.
- **What you can say back:**
  - **"What would you accept?"** He names the least he'd take, from the same rules.
  - **"I'll make it $X."** A better figure, said to his face.
  - **"Then make it twenty percent."** The same money for less of the place.
  - **"You need the money more than you're admitting."** Only when you know his place is struggling. It costs you with a proud man, and if he isn't actually in trouble it's an insult.
  - **"Forget it."**

**Help remembered.** A man who owes you a favour for what you did says so when you see him ("I haven't forgotten what you did for me." / "I remember what you did. I pay my debts."), now and then rather than every time.

**Tests:**
- `social/threads.test.ts`:
  - the money conversation from the truth, with real places and the week as a dated promise that breaks if unpaid;
  - a man holding money back breaks or denies, and is held to his story;
  - a debt's sums, a week moving the payment, and his other creditors named;
  - an event: how he knows, who told him, who did it;
  - help remembered;
  - a low offer answered with its terms, with the share changed by reply.
- **Updated:** the debt is a conversation now, not a sub-menu (menus and conversation tests), and the "quiet man" in the subjects test is a man with something of his own.
