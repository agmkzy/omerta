# Run 2: commitments and a disagreement, in the browser (Tests B and D)

*Recorded in the running game, with the developer start `?scenario=dispute`.*
- *Henry Tedesco knows Jimmy DeSantis.*
- *Richie Valenti, a soldier in another crew, has started leaning on Jimmy's bakery.*
- *Louie Costa is Henry's captain, and Mario Testa is Louie's superior.*

*As in Run 1, the game was driven through its own buttons by an in-page script. Every choice was a button on the screen. In each run, Henry's choices were fixed in advance to test one thing.*

*Format:*
- *"→" is opening a heading;*
- *">" is what Henry says;*
- *[ ] lists the choices on the screen after each step;*
- *[[ ]] notes are read from the world's records: a man's regard for Henry.*

## Run 2a: Henry promises Jimmy, never goes, and keeps saying "not yet" (Test D)

```
### Day 1. Jimmy DeSantis
(You know each other.)
JIMMY: “Back again.”
    [Business | Personal | Leave]
  → Personal
    [Anyone been bothering you? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
JIMMY: “Richie wants money off me. I won’t pay him. Can you do anything?”
    [“I’ll talk to Louie about it.” | “I’ll do what I can.” | “I’ll make sure he leaves you alone.” | “I can’t get involved in this.” | Leave]
> “I’ll talk to Louie about it.”
JIMMY: “That’s something. Tell him what they’ve been doing.”

### Day 5. Jimmy DeSantis
(You’ve been to see him once before.)
JIMMY: “Well? Did you talk to them?”
    [“Not yet. Give me a few days.” | “I took it to Louie.” — You haven’t been to see Louie. | “I couldn’t get anywhere with it. I’m sorry.” | Something else… | Leave]
> “Not yet. Give me a few days.”
JIMMY: “All right. A few days.”

### Day 9. Jimmy DeSantis
JIMMY: “You said a few days. That was 4 days ago.”
> “Not yet. Give me a few days.”
JIMMY: “A few more days.” He says it flatly.

### Day 13. Jimmy DeSantis
JIMMY: “I’ve asked you before. More than once.”
> “Not yet. Give me a few days.”
JIMMY: “Then don’t tell me a few days.”

### Day 14. Jimmy DeSantis came looking for you
  (Jimmy DeSantis has come to find you.)
JIMMY: “Richie’s back. You never did go to Louie, did you?”
    [“I’ll talk to Louie about it.” | “I’ll do what I can.” | “I’ll make sure he leaves you alone.” | “I can’t get involved in this.” | Not now]
> “I’ll talk to Louie about it.”
JIMMY: “You said that before.”

### Day 17. Jimmy DeSantis
(You’ve been to see him often.)
JIMMY: “Every time I ask, it’s a few more days.”
> “Not yet. Give me a few days.”
JIMMY: “Then I’ll stop asking you.”

[[ Jimmy's trust in Henry: 0.04 at the end ]]

### Days 18 to 26 (only answering whoever comes)
Jimmy does not ask about it again. On day 24 he comes for a new reason:
JIMMY: “Richie’s people haven’t been back. Was that you?”
    [“That wasn’t me. But I’m glad they’ve stopped.” | “I had a word.” — You had nothing to do with it. | Something else… | Leave]
```

What this shows:
- **Each "not yet" is remembered.** It is remembered across the second promise too: day 17 is not treated as a first time.
- **The words change, and so does his trust:** each delay after the first costs some.
- **A second promise after a broken one gets no warmth:** "You said that before."
- **When he says he will stop asking, he does.** He comes back only when something new happens. That is the brief's distinction between a new development, a reasonable follow-up, and asking again with nothing changed.
- **The lie is still on offer and still undetectable,** labelled with what Henry knows ("You haven't been to see Louie."), not "It isn't true."

## Run 2b: a disagreement with Louie, taken over his head (Test B)

```
### Day 1. Jimmy DeSantis
> “What’s new?”
JIMMY: “Richie wants money off me. I won’t pay him. Can you do anything?”
> “I’ll make sure he leaves you alone.”
JIMMY: “You mean that? Then I’ll hold you to it.”

[[ Louie's regard for Henry before: trust 0.50, respect 0.40 ]]

### Day 2. Louie Costa
(He likes you.)
LOUIE: He’s glad to see you, and doesn’t hide it.
    [Business | Personal | Leave]
  → Business
    [“Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.” | Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
LOUIE: “Jimmy? He’s not one of ours. Why should we get involved?”
    [Persuade — Tell him what you know of it. | Appeal to your word — You promised Jimmy. | Negotiate — Make it worth his while. | Accept his decision | Leave]
> “I gave Jimmy my word I’d raise it.”                         (Appeal to your word)
LOUIE: “Tell me something I don’t know. Show me Richie’s people on our streets and we’ll talk.”
    [Persuade — Tell him what you know of it. | Negotiate — Make it worth his while. | Accept his decision | Leave]
> “There’s money in bringing Jimmy under our protection.”      (Negotiate)
LOUIE: “Maybe. It’s not much of an envelope.”
    [Persuade — Tell him what you know of it. | Accept his decision | Leave]
(Henry leaves: he has walked out on a refusal, and it is remembered as one)

### Day 3. Louie Costa
LOUIE: He looks up, a little guarded. “If this is about the other thing…”
  → Business
    [Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
  → Other business…
    [“About Jimmy and Richie.” — He said no yesterday. Nothing has changed since. | … ]

### Day 3. Mario Testa (Louie's superior)
(You haven’t met.)
MARIO: He looks you over. “Do I know you?”
  → Business
    [“Louie won’t take it up. I’m bringing it to you: Richie and Jimmy.” | I’d be grateful if you’d back me | Is there anything I can do for you? | Other business… | Something else | Leave]
> “Louie won’t take it up. I’m bringing it to you: Richie and Jimmy.”
MARIO: “Jimmy? He’s not one of ours. Why should we get involved?”
> “Richie’s been leaning on Jimmy for money, at DeSantis's Bakery. That’s our ground.”   (Persuade)
MARIO: “Tell me something I don’t know. Show me Richie’s people on our streets and we’ll talk.”

[[ Louie's regard for Henry after Henry went over his head: trust 0.50, respect 0.35 ]]

### Day 8. Louie Costa
LOUIE: “Mario tells me you came to see him. About the thing I said no to.”
  → Personal
> “What’s new?”
LOUIE: “Not much.”

### Day 12. Louie Costa
LOUIE: “Sit down.”
LOUIE: “Here’s one for you. A family meeting.”
  (He is calling the family together. Attendance isn’t optional.)

[[ Louie's regard for Henry at the end: trust 0.39, respect 0.35 ]]
```

What this shows:
- **Each approach is chosen by name and said as an argument,** and each is answered from Louie's own reasons. Once an argument has been made, it is not offered again.
- **The refusal is remembered:**
  - the next day's greeting ("If this is about the other thing…");
  - the matter moves under "Other business…" with "He said no yesterday. Nothing has changed since.";
  - going over his head becomes possible.
- **Going over his head costs something.** Louie's respect for Henry falls (0.40 → 0.35), and the next time he says so in his own words. After that he is curt ("Not much."), then back to business on day 12.
- **One thing the run does not show:** why his trust fell further to 0.39 between days 3 and 12. It is a change in the world's own records; the transcript does not reveal its cause.
- **The "do what I can" version** (an effort promise) was also played. It is kept the moment Henry raises the matter with Louie, so after Louie refuses there is nothing left to take higher. That is what the promise means. Escalation belongs to a promise that is still open after a refusal: here, "I'll make sure he leaves you alone".
