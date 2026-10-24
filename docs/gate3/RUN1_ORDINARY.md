# Run 1: an ordinary game, 30 days, in the browser (Tests A, C, E)

*Recorded in the running game (`npm run dev`, the in-app browser). It is a new game, not the scenario: Daniel DiStefano, an associate in Lou Santoro's crew, with a random seed. The new conversation screen is on.*

*The game was driven through its own buttons by a small in-page script, so that a month could be played in one sitting. Every choice below was a button on the screen when it was pressed. The only shortcut was opening a man's page by the same handler the People list uses.*

*The routine:*
- *answer whoever comes looking;*
- *see Marty Ferrara every two or three days (Test A: an ambitious, unsociable soldier in the same crew);*
- *see Lou Santoro weekly (asking for work, later asking about advancement);*
- *put protection to a shop three times;*
- *spend two evenings with Sonny Conti.*

*At each step the routine takes the first engaging reply. It is a dumb player, and it shows: on days 28–30 it keeps choosing the $500 gift it cannot afford.*

*Format:*
- *"→" is opening a heading;*
- *">" is what Daniel says;*
- *( ) is narration;*
- *[ ] lists the choices on the screen after each step.*

*This run used the build before four last fixes, which were made after it and are noted where they show:*
1. *the unaffordable "$500" option;*
2. *Marty's "Lou's fair, mostly" after "I've no use for Lou";*
3. *subject titles such as "His trouble with Lou Santoro";*
4. *the old engine's top menu after Sonny's "Another time, maybe" (day 6).*

```
### Day 0. Marty Ferrara
(You know each other.)
MARTY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Lou? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Same as ever.” He leaves it there.
    [How do you find working for Lou? | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 1. Lou Santoro
(He likes you.)
LOU: “There he is! Come here.”
    [Business | Personal | Leave]
  → Business
    [Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> Is there anything you need done?
LOU: He waves a hand. “Nothing now. Don’t look for work. It finds you.”
    [What would it take to be moved up? | Other business… | Something else | Leave]

### Day 2. Marty Ferrara
(You’ve been to see him once before.)
MARTY: He nods you to a chair.
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Lou? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about working for Lou. It was all he wanted to talk about. You’re no closer than you were, and no further.)
MARTY: “Lou’s fair, mostly.”

### Day 3. Paulie Bianchi wants a word (Paulie has something to sell)
(You know each other.)
PAULIE: “Sit down.”
PAULIE: “I know something you’d want to know. $130, and it’s about a place where money is lying around, and not many people know.”
    [Pay $130 — You learn where the money is. | Offer half ($70) — He may take it. He may walk. | No thanks | Talk about something else | Leave]
> Pay $130
  (He gives you a place and a time. It’s under World. It’s a real one.)
  (Trust ▲  ·  −$130)
    [Business | Personal | Leave]

### Day 3. Mickey Silvestri, Silvestri's Candy Store
(You haven’t met.)
MICKEY: “Can I— can I help you with something?”
    [Business | Personal | Leave]
  → Business
    [“$30 a week, and nothing happens to the place.” | Other business… | Something else | Leave]
> “$30 a week, and nothing happens to the place.”
MICKEY: “$20 I could do, if it means the street stays quiet. What do I get for it?”
    [Take his offer — $20 a week. | Pressure — Make him think about it. | Let it go | Leave]
> “$20 a week, then.”
  (Mickey nods.)
  (Agreed: $20 a week. He says he wants the street kept quiet for it.)
    [How’s the shop doing? | Has anyone else been around? | Other business… | Something else | Leave]

### Day 4. Mickey Rizzo wants a word (A christening)
(You haven’t met.)
MICKEY: He looks you over. “Do I know you?”
MICKEY: “There’s a christening at the club's back room. Come. Bring something.”
    [Go, with a $250 envelope — People see the thickness of it. | Go, with $100 — The right amount. | Go, with $40 — Somebody will notice. Maybe not out loud. | Send regrets — A man who doesn’t turn up is noticed. | Talk about something else | Leave]
> Go, with a $250 envelope
  (Babies, wine, and a priest who has the sense not to ask where the envelopes come from.)
  (Your envelope is thick, and a man at the next table notices. By the end of the night so does everyone else.)
  (Somebody makes the introduction. Artie Corrente, boss, Bensonhurst. You talk about nothing for twenty minutes, which is how it’s done.)
  (Wine makes Hank Pellegrino careless, and he says it where you can hear: Marty Ferrara now collects $35 a week from DeLuca's Tailors.)
  (Respect ▲  ·  −$250  ·  Standing ▲)
    [Business | Personal | Leave]

### Day 5. Marty Ferrara
(You’ve been to see him a few times.)
MARTY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [“What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about the old neighbourhood, and the men who used to run it. It never quite caught. He kept looking at the door. You’re no closer than you were, and no further.)

### Day 6. Sonny Conti
(You know each other.)
SONNY: He nods. Nothing more.
    [Business | Personal | Leave]
  → Personal
    [What’s weighing on you? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Sonny. He talked about what is weighing on him. It was all he wanted to talk about. Another evening; it counts for something.)
SONNY: “Don’t ask.”
    [Something’s wrong. I can see it | Let’s leave it there | Talk about something else | Leave]
> Something’s wrong. I can see it
SONNY: “Another time, maybe.”
    [How do you find working for Lou? | What happened to you | I wanted to discuss some business | How are things with you? | Other ways to put it… | Talk about something else | Leave]   ← (fixed after this run: the old engine's top menu)
> How do you find working for Lou?
SONNY: “He pays, I work.”
    [What happened to you | I wanted to discuss some business | How are things with you? | Could I ask you something? | Other ways to put it… | Talk about something else | Leave]

### Day 8. Marty Ferrara
(You’ve been to see him a few times.)
MARTY: “Good night, the other night.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about what he wants out of all this. It was all he wanted to talk about. You’re no closer than you were, and no further.)
MARTY: “What everybody wants. A little more than I’ve got.”

### Day 8. Lou Santoro
(You’ve been to see him once before.)
LOU: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Business
    [Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> Is there anything you need done?
LOU: He waves a hand. “Nothing now. Don’t look for work. It finds you.”
    [What would it take to be moved up? | Other business… | Something else | Leave]

(Days 10 to 12 passed without the routine: a wait ran on to the next event. The run picks up on day 13.)

### Day 13. Marty Ferrara
(You’ve been to see him a few times.)
MARTY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Lou? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about Paulie. It was all he wanted to talk about. You’re no closer than you were, and no further.)
MARTY: “I’ve no use for Paulie.”
    [I never liked Paulie either | Paulie’s all right. Give him a chance | Let’s leave it there | Talk about something else | Leave]
> I never liked Paulie either
MARTY: “I knew you had sense.”
    [How do you find working for Lou? | His trouble with Paulie Bianchi | Talk about something else | Leave]
> How do you find working for Lou?
MARTY: “Lou’s fair, mostly.”
    [His trouble with Paulie Bianchi | Talk about something else | Leave]

### Day 14. Lou Santoro
(You’ve been to see him a few times.)
LOU: “Twice in a day! People will talk.”
    [Business | Personal | Leave]
  → Business
    [Call in the favour he owes you: $150 | Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> Is there anything you need done?
LOU: He raises a glass at you. “To a generous wedding gift. I’ll never get tired of saying it.”
  (He thinks a moment.)
LOU: “Here’s one for you. I say Marty has to go.”
    [Lou Santoro says Marty Ferrara has to go — Pays $1,500. He wants an answer. | Call in the favour he owes you: $150 | What would it take to be moved up? | Other business… | Something else | Leave]
> You had something for me?
  (He says Marty Ferrara has been skimming from the family. He wants it ended.)
    [I’ll take care of it — It’s yours. Pays $1,500. | Not this time | Talk about something else | Leave]

### Day 14. Rocco Gallo, Gallo's Hardware
(You haven’t met.)
ROCCO: He looks you over. “Do I know you?”
    [Business | Personal | Leave]
  → Business
    [A man with a place like yours could use some friends | Other business… | Something else | Leave]
> A man with a place like yours could use some friends
  (You steer the conversation toward the neighbourhood and who watches over it.)
ROCCO: “All right. We have a deal.”
  (He agrees to $45 a week.)
  (Trust ▲  ·  Standing ▲)
    [How’s the shop doing? | Has anyone else been around? | Other business… | Something else | Leave]

### Day 14. Marty Ferrara
(You’ve been to see him often.)
MARTY: “Something else?”
    [Business | Personal | Leave]
  → Personal
    [What do you know about the recent trouble? | Who do you think is behind it? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about his racket. He kept coming back to it. You’re no closer than you were, and no further.)
MARTY: “It goes. Why do you ask?”

### Day 15. Theresa DiStefano wants a word (Sunday dinner)
  (the routine could not reach her: a man's mother is seen through the family page, not the conversation screen)

### Day 15. Lou Santoro
(You’ve been to see him a few times.)
LOU: “Sit down.”
LOU: “Here’s one for you. I say Marty has to go.”
  (He says Marty Ferrara has been skimming from the family. He wants it ended.)
    [I’ll take care of it — It’s yours. Pays $1,500. | Not this time | Talk about something else | Leave]
> I’ll take care of it
LOU: “Good. Don’t make a mess of it.”
    [Business | Personal | Confront | Leave]
  → Business
    [Call in the favour he owes you: $150 | Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> What would it take to be moved up?
LOU: “Ambitious! Good. Right now people say you’re trusted, so there’s work to do.”
    [How much more do you expect from me? | Talk about something else | Leave]
> How much more do you expect from me?
LOU: “More than this. Nobody puts a name forward on what you’ve passed up so far.”
    [Call in the favour he owes you: $150 | Is there anything you need done? | Other business… | Something else | Leave]

### Day 17. Marty Ferrara
(You’ve been to see him often.)
MARTY: He nods to you like a man who has said more than he meant to, and doesn’t mind.
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about what he wants out of all this. It was all he wanted to talk about. You’re no closer than you were, and no further.)
MARTY: “What everybody wants. A little more than I’ve got.”

### Day 17. Benny Bruno, Bruno's Jewellers
(You haven’t met.)
BENNY: “Can I— can I help you with something?”
    [Business | Personal | Leave]
  → Business
    [A man with a place like yours could use some friends | Other business… | Something else | Leave]
> A man with a place like yours could use some friends
  (You steer the conversation toward the neighbourhood and who watches over it.)
BENNY: “I can do $45 a week. Not a cent more. That’s what the place can carry.”
    [You’re doing plenty of business | Name your own figure | All right. $45 a week — Settle on his terms. | It’d be a shame if something happened to the place — Lean on him. Fear works. So does resentment, later. | Other ways to put it… | Talk about something else | Leave]
> You’re doing plenty of business
BENNY: He looks away. “Business is… all right. Some weeks.”
    [Then show me your books | Name your own figure | All right. $45 a week — Settle on his terms. | It’d be a shame if something happened to the place — Lean on him. Fear works. So does resentment, later. | Other ways to put it… | Talk about something else | Leave]

### Day 19. Sonny Conti
(You’ve been to see him once before.)
SONNY: He nods you to a chair.
    [Business | Personal | Leave]
  → Personal
    [What’s weighing on you? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Sonny. He talked about what he wants out of all this. It was all he wanted to talk about. Another evening; it counts for something.)
SONNY: “That’s my business.”

### Day 20. Marty Ferrara
(You’ve been to see him often.)
MARTY: He nods you to a chair.
    [Business | Personal | Leave]
  → Personal
    [What do you make of Paulie? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about working for Lou. It was all he wanted to talk about. If anything, you’re further apart.)
MARTY: “Lou’s fair, mostly.”

### Day 22. Lou Santoro wants a word (Lou asks about Gino)
(You’ve been to see him often.)
LOU: “There he is! Sit, sit.”
LOU: “Gino Sorrento is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
    [Make a call, put up $300 — A man who gets out remembers who got him out. | It’s not your business | Talk about something else | Leave]
> Make a call, put up $300
  (A call, a clerk, an envelope. Gino Sorrento is out in two days, and Lou Santoro will remember whose phone it was.)
  (Trust ▲  ·  −$300)
    [Business | Personal | Confront | Leave]

### Day 22. Lou Santoro
(He likes you.)
LOU: “Back already?”
    [Business | Personal | Confront | Leave]
  → Business
    [Call in the favour he owes you: $150 | Let me sit you and Marty Ferrara down | Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> What would it take to be moved up?
LOU: “Ambitious! Good. Right now people say you’re trusted, so there’s work to do.”
    [How much more do you expect from me? | Talk about something else | Leave]
> How much more do you expect from me?
LOU: “More than this. Nobody puts a name forward on what you’ve passed up so far.”
    [Call in the favour he owes you: $150 | Let me sit you and Marty Ferrara down | Is there anything you need done? | Other business… | Something else | Leave]

### Day 23. Marty Ferrara
(You’ve been to see him often.)
MARTY: “About the other night. What I said stays between us, right?”
    [Business | Personal | Leave]
  → Personal
    [What do you make of Lou? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about Lou. He kept coming back to it. If anything, you’re further apart.)
MARTY: “I’ve no use for Lou.”
    [I never liked Lou either | Lou’s all right. Give him a chance | What’s really between you two? | Let’s leave it there | Talk about something else | Leave]
> I never liked Lou either
MARTY: “I knew you had sense.”
    [His trouble with Lou Santoro | Talk about something else | Leave]
> You and Lou. What’s going on?
MARTY: “What about it?”
    [What do you know about the recent trouble? | Who do you think is behind it? | Let me sit you and Lou Santoro down | Talk about something else | Leave]

### Day 26. Marty Ferrara
(You’ve been to see him often.)
MARTY: “Sit. I’ve been thinking about what we talked about.”
MARTY: “Here’s one for you. Marty has a bag that needs to move.”
  (He has about $500 from the week’s book that has to get to the family by morning, and he’d rather not carry it himself. It pays $40 to deliver it. Whoever carries it could also be tempted. Marty counts it twice.)
    [I’ll take care of it — It’s yours. Pays $40. | Not this time | Talk about something else | Leave]
> I’ll take care of it
MARTY: “Good. Don’t make a mess of it.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about the recent trouble? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about what he wants out of all this. It was all he wanted to talk about. If anything, you’re further apart.)
MARTY: “What everybody wants. A little more than I’ve got.”

### Day 28. Lou Santoro wants a word (Lou needs $500)
(You’ve been to see him often.)
LOU: “There he is! Sit, sit.”
LOU: “My brother is in trouble. $500 would fix it. I’ll pay you back. I wouldn’t ask if there was anyone else.”
    [Give it to him: $500 — A man who’s helped doesn’t forget. | Lend it, with terms — Business, but friendly. | Turn him down — He’ll understand. Probably. | Say you’ll see — He can’t wait forever. | Talk about something else | Leave]
> Give it to him: $500
  (You haven’t got it.)       ← (fixed after this run: an option the player cannot afford is no longer offered)
  (He grunts.)
    [Lend it, with terms — Business, but friendly. | Turn him down — He’ll understand. Probably. | Say you’ll see — He can’t wait forever. | Talk about something else | Leave]

(Days 29 and 30: the routine answers Lou's request the same way twice more, and Marty again: “I’ve no use for Lou.” → “I never liked Lou either” → “I knew you had sense.” → “How do you find working for Lou?” → “Lou’s fair, mostly.” ← fixed after this run: the guarded line no longer contradicts what he has just said.)
```

## What the month shows

- **Test A, Marty Ferrara.** He is an ambitious, unsociable soldier, and a poor match for Daniel (the evenings end "no closer", later "further apart"). He never opens up about what he wants ("What everybody wants. A little more than I've got."). But over the month he does say who he can't stand:
  - Paulie (day 13);
  - his own captain, Lou (days 23 and 29).

  Daniel's notes on him at the end hold exactly those two facts: "Can't stand Paulie Bianchi." and "Can't stand Lou Santoro."

  The greetings remember: "Good night, the other night", "About the other night. What I said stays between us, right?", "Sit. I've been thinking about what we talked about." On day 26 he trusts Daniel with a bag run.

  His trust in Daniel ends where it began (0.10). The relationship is recognisable, and it is not warm, because of who the two men are.
- **The world's own story.** On day 14 Lou Santoro tells Daniel that Marty "has to go": skimming from the family, $1,500. The routine accepted, and went on drinking with Marty, who tells Daniel he has no use for Lou. Whether Marty knows is his own business; nothing in the run shows it. Nobody scripted this.
- **Test C, independent concerns.** These came to Daniel unprompted, each from the man's own circumstances:
  - Paulie selling a tip;
  - a christening invitation;
  - Lou's man in jail ("I know you know a lawyer");
  - Lou's brother in trouble ($500);
  - Marty's bag.
- **Test E, ordinary play.** Things the routine did through the new screen:
  - work offered and taken (a hit, a bag run);
  - protection put to three shops: a counter-offer at $20 accepted, a straight $45, a negotiation;
  - advancement asked about twice ("Nobody puts a name forward on what you've passed up so far");
  - a favour owed and offered;
  - a sit-down offered between Lou and Marty.
