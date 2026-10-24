# Gate 3: a month with the same people (Tests C, D, F)

*Seed 3, the `?scenario=dispute` premise. Driven through `conv/visit.ts`, the engine the new screen draws; the player’s choices follow a fixed rule so the run repeats. "→" is opening a heading; ">" is what Henry says; [ ] is the screen’s choices after each step. "(nothing like … on offer)" marks where the script’s rule found nothing matching: the screen had moved on (usually because the man raised his own matter).*

```

### Day 0. Marty Bellini
(You know each other.)
MARTY: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Louie? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Me? Nothing ever happens to me.”
    [How do you find working for Louie? | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 1. Jimmy DeSantis
(You know each other.)
JIMMY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [Anyone been bothering you? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
JIMMY: “Richie wants money off me. I won’t pay him. Can you do anything?”
    [“I’ll talk to Louie about it.” | “I’ll do what I can.” | “I’ll make sure he leaves you alone.” | “I can’t get involved in this.” | Leave]
> “I’ll talk to Louie about it.”
JIMMY: “That’s something. Tell him what they’ve been doing.”
    [What do you know about the recent trouble? | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 1. Louie Costa
(He likes you.)
LOUIE: He’s glad to see you, and doesn’t hide it.
    [Business | Personal | Leave]
  → Business
    [“Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.” | Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
LOUIE: “Jimmy? He’s not one of ours. Why should we get involved?”
    [Persuade — Tell him what you know of it. | Appeal to your word — You promised Jimmy. | Negotiate — Make it worth his while. | Accept his decision | Leave]
> “Richie’s been leaning on Jimmy for money, at DeSantis's Bakery. That’s our ground.”
LOUIE: “All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”
    [Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
    (nothing like /^Appeal/ on offer)
    (nothing like /^Accept/ on offer)

### Day 4. Marty Bellini
(You’ve been to see him once before.)
MARTY: He nods you to a chair.
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Louie? | “What’s new?” | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about what has been going on around him, and what he thinks of it. The hours went quickly. You leave on better terms than you came.)

### Day 6. Someone came looking: Louie Costa sent word he has something to tell you.
(He likes you.)
  (Louie Costa has come to find you.)
LOUIE: “I took it to Johnny. He won’t rein Richie in.”
    [“Thanks for trying.” | Business | Personal | Leave]
> “Thanks for trying.”
LOUIE: “Don’t mention it.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 8. Someone came looking: Jimmy DeSantis has been asking for you.
(You’ve been to see him once before.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Well? Did you talk to them?”
    [“I took it to Louie.” | Something else… | Leave]
> “I took it to Louie.”
JIMMY: “I won’t forget it. Anything you need here, you ask.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 8. Marty Bellini
(You’ve been to see him a few times.)
MARTY: “My head still hurts from the other night. Sit down.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | “What’s new?” | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Nothing.” He doesn’t seem inclined to say more.
    [What do you want out of all this? | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]

### Day 9. Louie Costa
(You’ve been to see him a few times.)
LOUIE: He nods you to a chair.
LOUIE: “Paulie Santoro is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
    [Make a call, put up $300 — A man who gets out remembers who got him out. | It’s not your business | Talk about something else | Leave]
    (nothing like u:business on offer)
    (nothing like /anything you need done/ on offer)
    (nothing like home on offer)
    (nothing like u:personal on offer)
    (nothing like /What’s new/ on offer)

### Day 12. Marty Bellini
(You’ve been to see him a few times.)
MARTY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about the price of everything. It was easy. He laughed more than you expected. He likes you better for it.)

### Day 14. Someone came looking: Jimmy DeSantis came by looking for you. He wants a word.
(You’ve been to see him a few times.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Richie’s back. I know you tried before. Is there anything else you can do?”
    [“I’ll talk to Louie about it.” | “I’ll do what I can.” | “I’ll make sure he leaves you alone.” | “I can’t get involved in this.” | Leave]
> “I’ll talk to Louie about it.”
JIMMY: “That’s something. Tell him what they’ve been doing.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 15. Jimmy DeSantis
(You’ve been to see him a few times.)
JIMMY: “Well? Did you talk to them?”
    [“Not yet. Give me a few days.” | “I took it to Louie.” — It isn’t true. | “I couldn’t get anywhere with it. I’m sorry.” | Something else… | Leave]
    (nothing like u:business on offer)
    (nothing like /friends|a week/ on offer)

### Day 16. Marty Bellini
(You’ve been to see him a few times.)
MARTY: “Good night, the other night.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Same as ever.” He leaves it there.
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]

### Day 18. Marty Bellini
(You’ve been to see him often.)
MARTY: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Business
    [I’d be grateful if you’d back me | Is there anything I can do for you? | Other business… | Something else | Leave]
  → Other business…
    [I’d be grateful if you’d back me | Is there anything I can do for you? | “I need $500. I’ll pay the usual.” | “Who does Richie answer to?” | How’s business? | Offer to run his fencing operation | There’s something you ought to know about a man | What would it take to be moved up? | Something else | Leave]
    (nothing like /borrow/ on offer)

### Day 20. Marty Bellini
(You’ve been to see him often.)
MARTY: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about the Yankees, and what has happened to them. He ordered another round without being asked. You leave on better terms than you came.)

### Day 21. Someone came looking: Jimmy DeSantis has been asking for you.
(You’ve been to see him a few times.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Well? Did you talk to them?”
    [“Not yet. Give me a few days.” | “I took it to Louie.” — It isn’t true. | “I couldn’t get anywhere with it. I’m sorry.” | Something else… | Leave]
> “Not yet. Give me a few days.”
JIMMY: “A few days.” He nods, but he’s counting.
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 23. Louie Costa
(You’ve been to see him a few times.)
LOUIE: “Sit down.”
LOUIE: “Sonny Russo is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
    [Make a call, put up $300 — A man who gets out remembers who got him out. | It’s not your business | Talk about something else | Leave]
    (nothing like u:business on offer)
    (nothing like /anything you need done/ on offer)
    (nothing like home on offer)
    (nothing like u:personal on offer)
    (nothing like /What’s new/ on offer)

### Day 24. Marty Bellini
(You’ve been to see him often.)
MARTY: “I’m still feeling the other night.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Me? Nothing ever happens to me.”
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 28. Someone came looking: Jimmy DeSantis has been asking for you.
(You’ve been to see him often.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Richie’s people haven’t been back. Was that you?”
    [“That wasn’t me. But I’m glad they’ve stopped.” | “I had a word.” — It isn’t true. | Something else… | Leave]
> “That wasn’t me. But I’m glad they’ve stopped.”
JIMMY: “Huh.” He thinks about that. “Well. Somebody did.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 28. Marty Bellini
(You’ve been to see him often.)
MARTY: “There he is! Sit, sit.”
MARTY: “My grandson is being christened the club's back room, and I want everyone I like in the room. You’re on that list.”
    [Go, with a $250 envelope — People see the thickness of it. | Go, with $100 — The right amount. | Go, with $40 — Somebody will notice. Maybe not out loud. | Send regrets — A man who doesn’t turn up is noticed. | Talk about something else | Leave]
    (nothing like u:personal on offer)
    (nothing like /drink|sit a minute|keeping/ on offer)

---
Selections that said something: 16; headings opened: 11. NPC lines: 35, repeated verbatim: 10 (He nods you to a chair. / “Sit down.” / “That’s something. Tell him what they’ve been doing.” / “Well? Did you talk to them?” / “There he is! Sit, sit.” / “Me? Nothing ever happens to me.”).
```
