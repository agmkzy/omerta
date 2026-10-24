# Run 4: an ordinary game, 30 days, in the browser (Tests A, B, D, E)

*Recorded in the running game: a new game with a random seed, the new conversation screen on.*
- *Dante Sanfilippo, an associate in Richie DeSantis's crew;*
- *the crew: Mario Lucchese (fairly sociable; Test A's man) and Sonny Vitale.*

*The game was driven through its own buttons by an in-page script. The routine:*
- *answers whoever comes looking;*
- *sees Mario every two or three days;*
- *sees Richie weekly, and asks about advancement on days 2, 16 and 31;*
- *puts protection to shops;*
- *from day 20, takes up work offered on the Today page, does it on the job's own screen, and goes back to the man who gave it (Test B).*

*The page reloaded once, on day 20, with two fixes found in this run (marked). At each step the routine takes the first engaging reply; it is a plain player, not a clever one.*

*Format:*
- *"→" opens a heading;*
- *">" is what Dante says;*
- *( ) is narration;*
- *[ ] lists the choices on the screen.*

```
### Day 0. Mario Lucchese
(You know each other.)
MARIO: “You’re here.”
  → Personal
    [How do you find working for Richie? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> How do you find working for Richie?
MARIO: “Richie is a man you can follow.”

### Day 1. Richie DeSantis
(He likes you.)
RICHIE: “Good. You’re here.”
  → Business
    [Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> Is there anything you need done?
RICHIE: He waves a hand. “Nothing now. Don’t look for work. It finds you.”

### Day 2. Sonny Vitale wants a word (Sonny has something to sell)
SONNY: He nods. Nothing more.
SONNY: “I know something you’d want to know. $250, and it’s about a place where money is lying around, and not many people know.”
    [Pay $250 — You learn where the money is. | Offer half ($130) — He may take it. He may walk. | No thanks | Talk about something else | Leave]
> Pay $250
  (He has nothing solid after all. He gives half your money back.)
  (Trust ▲  ·  −$125)

### Day 2. Mario Lucchese
  → Personal
> “Let me buy you a drink.”
  (You spent the evening at the club with Mario. He talked about the Yankees, and what has happened to them. He was polite, and a little tired. Another evening; it counts for something.)

### Day 2. Richie DeSantis                                   [Test D: before]
  → Business
> What would it take to be moved up?
RICHIE: “So does every man here. Right now I’d call you trusted.”
RICHIE: “The money isn’t there yet: $0 of $3,000 passed up in total. Nobody puts a name forward short of it.”
RICHIE: “You need made men who’ll stand up for you: 2 of 3.”

### Day 3. Ralphie Neri, Neri's Candy Store
(You haven’t met.)
RALPHIE: “Come in, come in. What can I get you?”
    [Personal | Leave]                    (protection here is not Dante's to offer: no Business heading)

### Day 5. Mario Lucchese
MARIO: “I’m still feeling the other night.”
> “Let me buy you a drink.”
  (… He talked about the fights on Saturday, and who should have won. … You know each other a little better.)

### Day 6. Sonny Vitale
> “Let me buy you a drink.”
  (… He talked about working for Richie. …)
SONNY: “He pays, I work.”

### Day 8. Mario Lucchese
MARIO: “Good night, the other night.”
  → Personal
    [What do you want out of all this? | “What’s new?” | “Let me buy you a drink.” | …]
> What do you want out of all this?
MARIO: “Oh, the usual things.”

### Day 8. Richie DeSantis
> Is there anything you need done?
RICHIE: “Nothing’s changed since last week.”

### Day 10. Georgie Conti, Conti's Diner
> A man with a place like yours could use some friends
GEORGIE: “I can do $50 a week. Not a cent more. That’s what the place can carry.”
> You’re doing plenty of business
GEORGIE: He looks away. “Business is… all right. Some weeks.”

### Day 11. Mario Lucchese
> “Let me buy you a drink.”
  (… He talked about his racket. It was all he wanted to talk about. …)
MARIO: “Cigarettes, jukeboxes. Pennies, but pennies add up.”
    [Keep your ears open for me, will you? | Let’s leave it there | Talk about something else | Leave]
> Keep your ears open for me, will you?
MARIO: “I hear plenty. I keep most of it.”
> How do you find working for Richie?
MARIO: He gives you the look of a man who has answered this before.

### Day 13. Mario Lucchese
> “Let me buy you a drink.”
  (… He talked about his mother, who is not well. Nobody said anything that mattered. …)

### Day 15. Richie DeSantis
RICHIE: “You’re here.”
RICHIE: “I don’t offer twice.”            (work he had offered on the Today page expired unanswered)
> Is there anything you need done?
RICHIE: “Same as I told you last week.”

### Day 16. Mario Lucchese
MARIO: He grins. “You recovered?”
> What do you want out of all this?
MARIO: “Same as I told you last week.”
  (He knows you by now. He keeps that to himself all the same.)

### Day 16. Richie DeSantis                                  [Test D: after a fall]
> What would it take to be moved up?
RICHIE: “You’ve come on since 2 weeks ago. people call you unproven now, for one.”   ← DEFECT, fixed on day 20: "unproven" is lower
                                                                                       than "trusted"; now "You’ve gone backwards since…"
RICHIE: “The money isn’t there yet: $0 of $3,000 passed up in total. Nobody puts a name forward short of it.”
RICHIE: “Who would speak for you? 2 of 3. That’s the part that matters.”

### Day 17. Tony Santoro wants a word (A wedding)
TONY: “There’s a wedding at a restaurant on Mulberry Street. Come. Bring something.”
> Go, with a $250 envelope
  (… Somebody makes the introduction. Rocco DeSantis, capo, Little Italy. …)
  (Respect ▲  ·  −$250  ·  Standing ▲)

### Day 17. Georgie Conti, Conti's Diner
GEORGIE: “There he is! Come in.”
  → Business
    [About protection at Conti's Diner — He named his own terms. | Other business… | Something else | Leave]

### Day 19. Mario Lucchese
(He knows you well, and keeps his own counsel.)
> “Let me buy you a drink.”
  (… He talked about working for Richie. …)
MARIO: “Nothing’s changed since last week.”      ← DEFECT, fixed on day 20: the evening went back to a subject just asked about

(The page reloads here with those two fixes.)

### Day 20. Tony Santoro, about the work he offered          [Test B: a job failed]
TONY: “Here’s one for you. Danny Bianchi has been flush.”
  (He says Danny Bianchi (Bianchi's Hardware) has had a good run and keeps cash on hand. A smooth talker could part him from some of it.)
> I’ll take care of it
TONY: “Good. Don’t make a mess of it.”
### (The job screen) Fake charity drive → failed: “Danny Bianchi sees through it and shows you the door. He won't forget your face.”
### Day 20. Tony Santoro, after the job
TONY: “‘Danny Bianchi has been flush’? What happened there?”

### Day 21. Paulie Testa, about the work he offered            [Test B: a job done]
PAULIE: “Here’s one for you. Paulie has a bag that needs to move.”
> I’ll take care of it
### (The job screen) Take it straight there → done: “The bag gets where it’s going. Paulie Testa pays you $40.”
### Day 21. Paulie Testa, after the job
PAULIE: “Twice in a day! People will talk.”
PAULIE: “I hear ‘Paulie has a bag that needs to move’ got done. Tell me about it.”
  → Business
    [Tell him how the job went | I’d be grateful if you’d back me | Is there anything I can do for you? | Other business… | …]
> Tell him how the job went
  (You walk Paulie Testa through what you did. He seems satisfied.)
  (Trust ▲  ·  Respect ▲  ·  Standing ▲)

### Day 22. Mario Lucchese
(He knows you well, and keeps his own counsel.)
> “Let me buy you a drink.”
  (… He talked about what has been going on around him, and what he thinks of it. Nobody said anything that mattered. …)

### Day 22. Richie DeSantis
RICHIE: “Here’s one for you. Coffee at the club.”
  (He has invited you for coffee at the club. It’s not business. It’s always business.)
> I’ll take care of it
> Is there anything you need done?
RICHIE: He gives you the look of a man who has answered this before.

### Day 23. Richie DeSantis wants a word (Richie asks about Vincent)
RICHIE: “Vincent Testa is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
> Make a call, put up $300
  (A call, a clerk, an envelope. Vincent Testa is out in two days, and Richie DeSantis will remember whose phone it was.)

### Day 23. Tony Santoro, about the work he offered             [Test B: the same man, a second job]
TONY: “I need somebody to ride shotgun for Vitale's Meats’s delivery. It’s yours if you want it.”
> I’ll take care of it
### (The job screen) Ride in the cab → done: “Somebody tries to stop the truck at the corner of Little Italy. They didn’t expect a man in the cab. They leave faster than they came.”
### Day 23. Tony Santoro, after the job
TONY: “I hear ‘Ride shotgun for Vitale's Meats’s delivery’ got done. Tell me about it.”
> Tell him how the job went
  (Trust ▲  ·  Respect ▲  ·  Standing ▲)

### Day 25. Mario Lucchese
> “Let me buy you a drink.”
  (… He talked about the Yankees, and what has happened to them. …)

### Day 28. Richie DeSantis wants a word (Richie’s daughter is getting married)
RICHIE: “Saturday. St. Anthony’s, then the hall. It would mean a lot if you came.”
> Go, with a fat envelope ($300)
  (You hand over the envelope and half the room sees how thick it is. Richie embraces you. You eat well and you leave early.)
  (Trust ▲  ·  Warmth ▲  ·  −$300  ·  Standing ▲)

### Day 28. Mario Lucchese                                     [Test A]
(He knows you well, and keeps his own counsel.)
MARIO: “I’m still feeling the other night.”
> What do you want out of all this?
MARIO: “I want to stand next to the man who decides.”
    [I’ll put in a word with Richie | You’re not ready | Let’s leave it there | Talk about something else | Leave]
> I’ll put in a word with Richie
MARIO: “I owe you one.”
    [… | Call in the favour he owes you: $150 | Talk about something else | Leave]

### Day 29. Richie DeSantis wants a word (Richie asks about Ralphie)
RICHIE: “Ralphie Esposito is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
    [It’s not your business | Talk about something else | Leave]      (the $300 call is not offered: Dante can't afford it)

### Day 30. Sonny Vitale, about the work he offered             [Test B: work ignored, then done]
SONNY: He looks up. “It’s been a while.”
SONNY: “I put work your way. You never came.”
SONNY: “I need somebody to ride shotgun for Zito's Pharmacy’s delivery. It’s yours if you want it.”
> I’ll take care of it
### (The job screen) Ride in the cab → done: “Nothing happens, which is how it’s supposed to go. The truck backs in, Carmine Zito signs, and Sonny pays you $280.”
### Day 30. Sonny Vitale, after the job
SONNY: “Well? ‘Ride shotgun for Zito's Pharmacy’s delivery’. How did it go?”
> Tell him how the job went
SONNY: “You did what I asked. No noise. I noticed.”
  (Trust ▲  ·  Respect ▲  ·  Standing ▲)

[Dante's standing: 47 (40 on day 0)]

### Day 31. Richie DeSantis                                    [Test D: after a month's work]
> It’s not your business                      (Ralphie, still: Richie takes it, “Another time.”; Trust ▼ Respect ▼)
  → Business
> What would it take to be moved up?
RICHIE: “You’ve come on since 2 weeks ago: the work, for one.”
RICHIE: “The money isn’t there yet: $0 of $3,000 passed up in total. Nobody puts a name forward short of it.”
RICHIE: “You need made men who’ll stand up for you: 2 of 3.”
```

## What it shows

- **Test A, Mario.** Over a month, Dante learns:
  - that Mario follows Richie gladly;
  - that his racket is the machines, "pennies, but pennies add up";
  - that he keeps what he hears to himself;
  - that his mother is unwell (an evening topic);
  - finally, what he wants: "to stand next to the man who decides."

  Dante puts in a word for him, and Mario now owes him a favour (on the screen: "Call in the favour he owes you"). The header moves from "You know each other" to "He knows you well, and keeps his own counsel." Familiarity, without trust, is now visible.

  Six of his ten evenings had nothing fresh on his mind and were the Yankees, the fights, the neighbourhood.
- **Test B, jobs.** Taken through conversation, done on the job screen, and recognised on return:
  - a failure ("What happened there?");
  - two successes ("I hear … got done. Tell me about it.", with the report rewarded);
  - work offered and ignored ("I don't offer twice." / "I put work your way. You never came.").
- **Test D, advancement:**
  - day 2: trusted, the money short ($0 of $3,000), two of three men behind him;
  - day 16: his name had slipped from ignoring Richie's offer (the reply wrongly called it progress: fixed);
  - day 31: "the work" has come on. The money is still the blocker, because Dante never handed his Sunday envelope up. The captain names the condition that actually stops him.
- **Test E, ordinary play:**
  - tips bought;
  - protection put to two shops, one shop not his to approach;
  - three jobs done and one failed;
  - two weddings, one favour for a man inside, one refused;
  - advancement asked three times.

  Everything was reached through the three headings, or answered directly when a man came with it.
