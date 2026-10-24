# Gate 2b: Scenario G, thirty days with the same five people

*Produced by `npx tsx src/conv/gate2b.ts`. Seed 3, run three times. The only thing set going is one man’s demand on a shopkeeper on day 1; Henry’s choices are scripted (spec §17.9: “run headless at Gate 2b, with the player’s choices scripted”); everything anyone else does is his own, in the real engine. The runs differ in one thing each: whether Henry knew the shopkeeper before the trouble, and, when the shopkeeper comes to him, whether Henry keeps his word or lies about it. Traces are folded under each line; the off-stage block at the end of each run shows what the others did that Henry never saw.*

| Run | Visits | Refused requests re-offered without a change | Routine visits | …that manufactured a development | Did the shopkeeper come to Henry? | Lies told / found out | Shopkeeper’s trust in Henry, every 5 days |
|---|---|---|---|---|---|---|---|
| acquainted | 30 | 0 | 24 | 0 | yes | 0 / 0 | 0.15 → 0.14 → 0.18 → 0.15 → 0.14 → 0.17 |
| stranger | 30 | 0 | 28 | 0 | no | 0 / 0 | 0.1 → 0.1 → 0.1 → 0.1 → 0.1 → 0.12 |
| liar | 30 | 0 | 26 | 0 | yes | 1 / 0 | 0.15 → 0.19 → 0.17 → 0.14 → 0.14 → 0.17 |

## Scenario G: thirty days with the same five people (acquainted)

*Henry Tedesco, Louie Costa (his captain), Jimmy DeSantis (DeSantis's Bakery), Peter Lombardi (Lombardi's Fish Market), Marty Bellini (in Henry's crew), and Richie Valenti, a soldier in another crew, who on day 4 starts leaning on Jimmy DeSantis. Henry has been in to see Nate on the first days.*

*Day 1, morning: Richie Valenti asks Jimmy DeSantis for money. Jimmy DeSantis says no.*

### Day 1: Marty Bellini
**Marty:** “Friend. What brings you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about a girl he knew in Bensonhurst. The hours went quickly. He likes you better for it.

### Day 2: Jimmy DeSantis
**Jimmy:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a loaf, thanks.”  
>   *Buy something.*
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about what has been going on around him, and what he thinks of it. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 3: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Peter:** “$30 a week.”

<details><summary>trace</summary>

```
▶ accept = 0.15: fear of what happens if he says no +0.46, what it costs him -0.17, pride -0.13
  counter = 0.13: he wants the street quiet +0, fear (bargaining with it takes nerve) +0.2, it costs less than asked -0.07, he would rather bargain than refuse +0.1, pride -0.1
  refuse = -0.09: pride +0.15, courage +0.12, fear -0.36
  dismiss = -0.45: pride +0.2, volatility +0.08, fear -0.43, caution -0.3, he is looked after +0
meaning: accept.protection · flat · toward speaker · private intent: accept · aim: make it stop
```
</details>

> **Outcome:** Agreed: $30 a week.

### Day 4: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about the fights on Saturday, and who should have won. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 5: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 6: Marty Bellini
**Marty:** He looks you over. “Do I know you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the price of everything. It was easy. He laughed more than you expected. He likes you better for it.

### Day 7: Jimmy DeSantis
**Jimmy:** “Richie’s people were in 5 days ago. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Richie wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *A promise to act: you’ll raise it with Louie. Kept when you do, whatever he says.*
> - “I’ll do what I can.”  
>   *A promise to try.*
> - “I’ll make sure he leaves you alone.”  
>   *A promise of a result. You can’t order Richie yourself.*
> - Leave

**You:** “I’ll speak to my captain about it.”
**Jimmy:** “That’s something. Tell him what they’ve been doing.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.44: what it gives him +0.4, trust in you +0.04
meaning: ack.promise.action · flat · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy you’d raise it with your captain. That’s what you’ve promised: to raise it.

### Day 8: Marty Bellini
**Marty:** “Friend. What brings you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the price of everything. He ordered another round without being asked. He likes you better for it.

### Day 9: Jimmy DeSantis
**Jimmy:** “Well? Did you talk to them?”

<details><summary>trace</summary>

```
▶ followup.pending = 1.48: he has heard nothing from you +1, days since you promised +0.2, patience (caution, agreeable) +0.28
meaning: followup.pending · flat · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “No. I never got to it.”  
>   *Tell him the truth: you haven’t yet.*
> - “I took it to the family. He won’t bother you again.”  
>   *Tell him you took it to the family. It isn’t true.*
> - Leave

**You:** “No. I never got to it.”
**Jimmy:** He takes that in. “Well. At least you didn’t take the credit.”

<details><summary>trace</summary>

```
▶ admitNotDone = 1: he believes what you said +1
meaning: react.report.admit · flat · toward speaker · private intent: admitNotDone
change: Jimmy DeSantis had thought it was Henry's doing; now he knows it wasn't. His trust falls a little, less than if he had found out another way
```
</details>

### Day 10: Peter Lombardi
**Peter:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Peter:** “I already pay someone. Please. I can’t pay two people.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Ralphie Palumbo (Corrente))
▶ refuse = 0.34: pride +0.15, courage +0.12, Ralphie looks after him +0.55, fear -0.47
  dismiss = -0.48: pride +0.2, volatility +0.08, fear -0.56, caution -0.3, he is looked after +0.1
  accept = -0.56 [would cross: obliged]: fear of what happens if he says no +0.6, what it costs him -0.17, pride -0.13, paying twice, and crossing Ralphie -0.86
reason given: hasArrangement
meaning: refuse.protection.hasArrangement · cold · toward third · implies warning · private intent: refuse · aim: warn you off
```
</details>

### Day 11: Louie Costa
**Louie:** “Sit down.”

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - “Richie’s people smashed up DeSantis's Bakery. That’s our ground.”  
>   *Tell him what Richie’s people did.*
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
**Louie:** “Jimmy? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.56: Richie’s people on his own streets (as he knows it) +0, his regard for Henry +0.11, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>

### Day 12: Richie Valenti
**Richie:** He looks you over. “Do I know you?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 13: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about his mother, who is not well. The hours went quickly. He likes you better for it.

### Day 14: Jimmy DeSantis
**Jimmy:** “Well? Did you talk to them?”

<details><summary>trace</summary>

```
▶ followup.pending = 1.98: he has heard nothing from you +1, days since you promised +0.7, patience (caution, agreeable) +0.28
meaning: followup.pending · flat · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “I took it to the family. He won’t bother you again.”  
>   *Tell him you took it to the family.*
> - Leave

**You:** “I took it to the family. He won’t bother you again.”
**Jimmy:** “I won’t forget it. Anything you need here, you ask.”

<details><summary>trace</summary>

```
▶ done = 1: he believes what you said +1
meaning: thanks.kept · warm · toward speaker · private intent: done
change: Jimmy DeSantis's trust in Henry Tedesco rises (a promise kept, as he sees it: the trouble stopped, and Henry says he took it to the family)
```
</details>

### Day 15: Marty Bellini
**Marty:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the Yankees, and what has happened to them. It was easy. He laughed more than you expected. He likes you better for it.

### Day 16: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the price of everything. Nobody said anything that mattered. You’re no closer than you were, and no further.

### Day 17: Peter Lombardi
**Peter:** “What can I get you?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 18: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about his mother, who is not well. Nobody said anything that mattered. You’re no closer than you were, and no further.

### Day 19: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 20: Marty Bellini
**Marty:** “Sit down.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the Yankees, and what has happened to them. He ordered another round without being asked. He likes you better for it.

### Day 21: Jimmy DeSantis
**Jimmy:** “Ah. It’s you.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the fights on Saturday, and who should have won. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 22: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about what has been going on around him, and what he thinks of it. The hours went quickly. He likes you better for it.

### Day 23: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about his mother, who is not well. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 24: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just this, thanks.”
### Day 25: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about what has been going on around him, and what he thinks of it. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 26: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 27: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the fights on Saturday, and who should have won. It was easy. He laughed more than you expected. He likes you better for it.

### Day 28: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the price of everything. The hours went quickly. He likes you better for it.

### Day 29: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the fights on Saturday, and who should have won. He ordered another round without being asked. He likes you better for it.

### Day 30: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the fights on Saturday, and who should have won. It was easy. He laughed more than you expected. He likes you better for it.


<details><summary>what happened between them, off stage (Henry sees none of it)</summary>

```
day 0: Jimmy DeSantis starts a pursuit: make Richie Valenti leave him alone
day 1: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Artie Silvestri) 0.59, intercessor (Ralphie Palumbo) 0.51, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 2: Jimmy DeSantis: going to Artie Silvestri came to nothing; he thinks again
day 2: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Ralphie Palumbo) 0.51, intercessor (Henry Tedesco) 0.48, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 3: Jimmy DeSantis: going to Ralphie Palumbo came to nothing; he thinks again
day 3: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Henry Tedesco) 0.48, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 7: Jimmy DeSantis starts a pursuit: see that Henry Tedesco does what he promised (o82)
day 9: Jimmy DeSantis now believes ob:o82: notYet (Henry Tedesco told him); he will think again
day 14: Jimmy DeSantis now believes ob:o82: done (Henry Tedesco told him); he will think again
day 16: Jimmy DeSantis: tired of waiting on Henry Tedesco; he thinks again
day 16: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Sal Gallo) 0.38, askAround 0.24, endure 0.04
day 17: Jimmy DeSantis: going to Sal Gallo came to nothing; he thinks again
day 17: Jimmy DeSantis weighs what to do about Richie Valenti: askAround 0.24, endure 0.04
day 17: Jimmy DeSantis now believes Richie Valenti answers to Johnny Lucchese (Artie Silvestri told him); he will think again
day 18: Jimmy DeSantis weighs what to do about Richie Valenti: chair (Johnny Lucchese) 0.21, endure 0.04
day 18: Jimmy DeSantis changes his plan: askAround (Artie Silvestri) → chair (Johnny Lucchese), because he now believes Richie Valenti answers to Johnny Lucchese
day 19: Jimmy DeSantis: going to Johnny Lucchese came to nothing; he thinks again
day 19: Jimmy DeSantis weighs what to do about Richie Valenti: endure 0.04
day 19: Jimmy DeSantis gives up: make Richie Valenti leave him alone (there is nothing more he can do)
day 24: Jimmy DeSantis has what he wanted: see that Henry Tedesco does what he promised (o82) (as he believes it: done)
```
</details>


<details><summary>records at the end</summary>

```
Henry's promise: kept (he did it: raise with Louie Costa); the captain's: never made
Jimmy DeSantis believes of Henry's promise: "done"; his trust in Henry over the month: 0.15 → 0.14 → 0.18 → 0.15 → 0.14 → 0.17
the world: 5 pursuits, 30 requests, 2 obligations (0 broken), 6 belief revisions
```
</details>


## Scenario G: thirty days with the same five people (stranger)

*Henry Tedesco, Louie Costa (his captain), Jimmy DeSantis (DeSantis's Bakery), Peter Lombardi (Lombardi's Fish Market), Marty Bellini (in Henry's crew), and Richie Valenti, a soldier in another crew, who on day 4 starts leaning on Jimmy DeSantis. Henry has never been into Nate’s shop before the trouble.*

*Day 1, morning: Richie Valenti asks Jimmy DeSantis for money. Jimmy DeSantis says no.*

### Day 1: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Peter:** “$30 a week.”

<details><summary>trace</summary>

```
▶ accept = 0.15: fear of what happens if he says no +0.46, what it costs him -0.17, pride -0.13
  counter = 0.13: he wants the street quiet +0, fear (bargaining with it takes nerve) +0.2, it costs less than asked -0.07, he would rather bargain than refuse +0.1, pride -0.1
  refuse = -0.09: pride +0.15, courage +0.12, fear -0.36
  dismiss = -0.45: pride +0.2, volatility +0.08, fear -0.43, caution -0.3, he is looked after +0
meaning: accept.protection · flat · toward speaker · private intent: accept · aim: make it stop
```
</details>

> **Outcome:** Agreed: $30 a week.

### Day 2: Marty Bellini
**Marty:** “Friend. What brings you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about his mother, who is not well. He ordered another round without being asked. He likes you better for it.

### Day 3: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about the price of everything. Nobody said anything that mattered. You’re no closer than you were, and no further.

### Day 4: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 5: Marty Bellini
**Marty:** He looks you over. “Do I know you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the fights on Saturday, and who should have won. He ordered another round without being asked. He likes you better for it.

### Day 6: Peter Lombardi
**Peter:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Peter:** “I already pay someone. Please. I can’t pay two people.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Ralphie Palumbo (Corrente))
▶ refuse = 0: pride +0.15, courage +0.12, Ralphie looks after him +0.55, fear -0.82
  accept = -0.12 [would cross: obliged]: fear of what happens if he says no +1.04, what it costs him -0.17, pride -0.13, paying twice, and crossing Ralphie -0.86
  dismiss = -0.89: pride +0.2, volatility +0.08, fear -0.97, caution -0.3, he is looked after +0.1
reason given: hasArrangement
meaning: refuse.protection.hasArrangement · cold · toward third · implies warning · private intent: refuse · aim: warn you off
```
</details>

### Day 7: Jimmy DeSantis
**Jimmy:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a loaf, thanks.”  
>   *Buy something.*
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the Yankees, and what has happened to them. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 8: Peter Lombardi
**Peter:** “What can I get you?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 9: Marty Bellini
**Marty:** “Friend. What brings you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about his mother, who is not well. It was easy. He laughed more than you expected. He likes you better for it.

### Day 10: Louie Costa
**Louie:** “Sit down.”

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about the Yankees, and what has happened to them. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 11: Richie Valenti
**Richie:** He looks you over. “Do I know you?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 12: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about a girl he knew in Bensonhurst. It was easy. He laughed more than you expected. He likes you better for it.

### Day 13: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just this, thanks.”
### Day 14: Jimmy DeSantis
**Jimmy:** “What can I get you?”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a loaf, thanks.”  
>   *Buy something.*
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the old neighbourhood, and the men who used to run it. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 15: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 16: Marty Bellini
**Marty:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the Yankees, and what has happened to them. The hours went quickly. He likes you better for it.

### Day 17: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about a girl he knew in Bensonhurst. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 18: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 19: Marty Bellini
**Marty:** “Sit down.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the price of everything. The hours went quickly. He likes you better for it.

### Day 20: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 21: Jimmy DeSantis
**Jimmy:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a loaf, thanks.”  
>   *Buy something.*
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the fights on Saturday, and who should have won. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 22: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 23: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the price of everything. He ordered another round without being asked. He likes you better for it.

### Day 24: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about his mother, who is not well. Nobody said anything that mattered. You’re no closer than you were, and no further.

### Day 25: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 26: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about a girl he knew in Bensonhurst. He ordered another round without being asked. He likes you better for it.

### Day 27: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 28: Jimmy DeSantis
**Jimmy:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a loaf, thanks.”  
>   *Buy something.*
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the price of everything. The hours went quickly. He likes you better for it.

### Day 29: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 30: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about a girl he knew in Bensonhurst. It was easy. He laughed more than you expected. He likes you better for it.


<details><summary>what happened between them, off stage (Henry sees none of it)</summary>

```
day 0: Jimmy DeSantis starts a pursuit: make Richie Valenti leave him alone
day 1: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Artie Silvestri) 0.59, intercessor (Ralphie Palumbo) 0.51, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 2: Jimmy DeSantis: going to Artie Silvestri came to nothing; he thinks again
day 2: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Ralphie Palumbo) 0.51, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 3: Jimmy DeSantis: going to Ralphie Palumbo came to nothing; he thinks again
day 3: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 4: Jimmy DeSantis: going to Sal Gallo came to nothing; he thinks again
day 4: Jimmy DeSantis weighs what to do about Richie Valenti: askAround 0.24, endure 0.04
day 4: Jimmy DeSantis now believes Richie Valenti answers to Johnny Lucchese (Artie Silvestri told him); he will think again
day 5: Jimmy DeSantis weighs what to do about Richie Valenti: chair (Johnny Lucchese) 0.2, endure 0.04
day 5: Jimmy DeSantis changes his plan: askAround (Artie Silvestri) → chair (Johnny Lucchese), because he now believes Richie Valenti answers to Johnny Lucchese
day 6: Jimmy DeSantis: going to Johnny Lucchese came to nothing; he thinks again
day 6: Jimmy DeSantis weighs what to do about Richie Valenti: endure 0.04
day 6: Jimmy DeSantis gives up: make Richie Valenti leave him alone (there is nothing more he can do)
```
</details>


<details><summary>records at the end</summary>

```
Henry's promise: never made; the captain's: never made
Jimmy DeSantis believes of Henry's promise: -; his trust in Henry over the month: 0.1 → 0.1 → 0.1 → 0.1 → 0.1 → 0.12
the world: 7 pursuits, 32 requests, 1 obligations (0 broken), 4 belief revisions
```
</details>


## Scenario G: thirty days with the same five people (liar)

*Henry Tedesco, Louie Costa (his captain), Jimmy DeSantis (DeSantis's Bakery), Peter Lombardi (Lombardi's Fish Market), Marty Bellini (in Henry's crew), and Richie Valenti, a soldier in another crew, who on day 4 starts leaning on Jimmy DeSantis. Henry knows Nate, promises to help, never does, and says he did.*

*Day 1, morning: Richie Valenti asks Jimmy DeSantis for money. Jimmy DeSantis says no.*

### Day 1: Marty Bellini
**Marty:** “Friend. What brings you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about a girl he knew in Bensonhurst. The hours went quickly. He likes you better for it.

### Day 2: Jimmy DeSantis
**Jimmy:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a loaf, thanks.”  
>   *Buy something.*
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about what has been going on around him, and what he thinks of it. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 3: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Peter:** “$30 a week.”

<details><summary>trace</summary>

```
▶ accept = 0.15: fear of what happens if he says no +0.46, what it costs him -0.17, pride -0.13
  counter = 0.13: he wants the street quiet +0, fear (bargaining with it takes nerve) +0.2, it costs less than asked -0.07, he would rather bargain than refuse +0.1, pride -0.1
  refuse = -0.09: pride +0.15, courage +0.12, fear -0.36
  dismiss = -0.45: pride +0.2, volatility +0.08, fear -0.43, caution -0.3, he is looked after +0
meaning: accept.protection · flat · toward speaker · private intent: accept · aim: make it stop
```
</details>

> **Outcome:** Agreed: $30 a week.

### Day 4: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about the fights on Saturday, and who should have won. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 5: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 6: Marty Bellini
**Marty:** He looks you over. “Do I know you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the price of everything. It was easy. He laughed more than you expected. He likes you better for it.

### Day 7: Jimmy DeSantis
**Jimmy:** “Richie’s people were in 5 days ago. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Richie wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *A promise to act: you’ll raise it with Louie. Kept when you do, whatever he says.*
> - “I’ll do what I can.”  
>   *A promise to try.*
> - “I’ll make sure he leaves you alone.”  
>   *A promise of a result. You can’t order Richie yourself.*
> - Leave

**You:** “I’ll speak to my captain about it.”
**Jimmy:** “That’s something. Tell him what they’ve been doing.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.44: what it gives him +0.4, trust in you +0.04
meaning: ack.promise.action · flat · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy you’d raise it with your captain. That’s what you’ve promised: to raise it.

### Day 8: Marty Bellini
**Marty:** “Friend. What brings you?”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the price of everything. He ordered another round without being asked. He likes you better for it.

### Day 9: Jimmy DeSantis
**Jimmy:** “Well? Did you talk to them?”

<details><summary>trace</summary>

```
▶ followup.pending = 1.48: he has heard nothing from you +1, days since you promised +0.2, patience (caution, agreeable) +0.28
meaning: followup.pending · flat · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “No. I never got to it.”  
>   *Tell him the truth: you haven’t yet.*
> - “I took it to the family. He won’t bother you again.”  
>   *Tell him you took it to the family. It isn’t true.*
> - Leave

**You:** “I took it to the family. He won’t bother you again.”
**Jimmy:** “I won’t forget it. Anything you need here, you ask.”

<details><summary>trace</summary>

```
▶ done = 1: he believes what you said +1
meaning: thanks.kept · warm · toward speaker · private intent: done
change: Jimmy DeSantis's trust in Henry Tedesco rises (a promise kept, as he sees it: the trouble stopped, and Henry says he took it to the family)
```
</details>

### Day 10: Peter Lombardi
**Peter:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Peter:** “I already pay someone. Please. I can’t pay two people.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Ralphie Palumbo (Corrente))
▶ refuse = 0.34: pride +0.15, courage +0.12, Ralphie looks after him +0.55, fear -0.47
  dismiss = -0.48: pride +0.2, volatility +0.08, fear -0.56, caution -0.3, he is looked after +0.1
  accept = -0.56 [would cross: obliged]: fear of what happens if he says no +0.6, what it costs him -0.17, pride -0.13, paying twice, and crossing Ralphie -0.86
reason given: hasArrangement
meaning: refuse.protection.hasArrangement · cold · toward third · implies warning · private intent: refuse · aim: warn you off
```
</details>

### Day 11: Louie Costa
**Louie:** “Sit down.”

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about a girl he knew in Bensonhurst. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 12: Richie Valenti
**Richie:** He looks you over. “Do I know you?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 13: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about his mother, who is not well. The hours went quickly. He likes you better for it.

### Day 14: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the old neighbourhood, and the men who used to run it. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 15: Marty Bellini
**Marty:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the Yankees, and what has happened to them. It was easy. He laughed more than you expected. He likes you better for it.

### Day 16: Jimmy DeSantis
**Jimmy:** “Ah. It’s you.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the price of everything. Nobody said anything that mattered. You’re no closer than you were, and no further.

### Day 17: Peter Lombardi
**Peter:** “What can I get you?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just a couple of those, thanks.”
### Day 18: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about his mother, who is not well. Nobody said anything that mattered. You’re no closer than you were, and no further.

### Day 19: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 20: Marty Bellini
**Marty:** “Sit down.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the Yankees, and what has happened to them. He ordered another round without being asked. He likes you better for it.

### Day 21: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the fights on Saturday, and who should have won. It was pleasant enough, and no more than that. You’re no closer than you were, and no further.

### Day 22: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about what has been going on around him, and what he thinks of it. The hours went quickly. He likes you better for it.

### Day 23: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about his mother, who is not well. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 24: Peter Lombardi
**Peter:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.69: ordinary courtesy +0.5, agreeable +0.19, what he has heard of you +0
  dismiss.pretext = 0.26: what he has heard of you +0, caution +0.26, fear of you +0
  dismiss.hostile = -0.01: what he has heard of you +0, pride +0.13, volatility +0.05, fear of you -0.2
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Just a couple of those, thanks.”  
>   *Buy something.*
> - Leave

**You:** “Just this, thanks.”
### Day 25: Louie Costa
**Louie:** He nods you to a chair.

<details><summary>trace</summary>

```
▶ greet = 0.62: ordinary courtesy +0.5, agreeable +0.12, what he has heard of you +0
  dismiss.hostile = 0.28: what he has heard of you +0, pride +0.33, volatility +0.11, fear of you -0.15
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at the club with Louie. He talked about what has been going on around him, and what he thinks of it. He was polite, and a little tired. You’re no closer than you were, and no further.

### Day 26: Richie Valenti
**Richie:** “Yeah?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.21: what he has heard of you +0, pride +0.22, volatility +0.19, fear of you -0.2
  dismiss.pretext = 0.1: what he has heard of you +0, caution +0.1, fear of you +0
meaning: greet.stranger · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

*You leave.*
### Day 27: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the fights on Saturday, and who should have won. It was easy. He laughed more than you expected. He likes you better for it.

### Day 28: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the price of everything. The hours went quickly. He likes you better for it.

### Day 29: Marty Bellini
**Marty:** “There he is! Sit, sit.”

<details><summary>trace</summary>

```
▶ greet = 0.63: ordinary courtesy +0.5, agreeable +0.13, what he has heard of you +0
  dismiss.hostile = 0.24: what he has heard of you +0, pride +0.19, volatility +0.11, fear of you -0.06
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.acquaintance · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Have a drink with him.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at Fino’s with Marty. He talked about the fights on Saturday, and who should have won. He ordered another round without being asked. He likes you better for it.

### Day 30: Jimmy DeSantis
**Jimmy:** “Back again.”

<details><summary>trace</summary>

```
▶ greet = 0.75: ordinary courtesy +0.5, agreeable +0.25, what he has heard of you +0
  dismiss.hostile = 0.27: what he has heard of you +0, pride +0.3, volatility +0.06, fear of you -0.1
  dismiss.pretext = 0.17: what he has heard of you +0, caution +0.17, fear of you +0
meaning: greet.known · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Let me buy you a drink.”  
>   *Stay and talk a while.*
> - Leave

**You:** “Let me buy you a drink.”
> You spent the evening at DeSantis's Bakery with Jimmy. He talked about the fights on Saturday, and who should have won. It was easy. He laughed more than you expected. He likes you better for it.


<details><summary>what happened between them, off stage (Henry sees none of it)</summary>

```
day 0: Jimmy DeSantis starts a pursuit: make Richie Valenti leave him alone
day 1: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Artie Silvestri) 0.59, intercessor (Ralphie Palumbo) 0.51, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 2: Jimmy DeSantis: going to Artie Silvestri came to nothing; he thinks again
day 2: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Ralphie Palumbo) 0.51, intercessor (Henry Tedesco) 0.48, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 3: Jimmy DeSantis: going to Ralphie Palumbo came to nothing; he thinks again
day 3: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Henry Tedesco) 0.48, intercessor (Sal Gallo) 0.39, askAround 0.24, endure 0.04, pay -0.08
day 7: Jimmy DeSantis starts a pursuit: see that Henry Tedesco does what he promised (o82)
day 9: Jimmy DeSantis now believes ob:o82: done (Henry Tedesco told him); he will think again
day 16: Jimmy DeSantis: tired of waiting on Henry Tedesco; he thinks again
day 16: Jimmy DeSantis weighs what to do about Richie Valenti: intercessor (Sal Gallo) 0.38, askAround 0.24, endure 0.04
day 17: Jimmy DeSantis: going to Sal Gallo came to nothing; he thinks again
day 17: Jimmy DeSantis weighs what to do about Richie Valenti: askAround 0.24, endure 0.04
day 17: Jimmy DeSantis now believes Richie Valenti answers to Johnny Lucchese (Artie Silvestri told him); he will think again
day 18: Jimmy DeSantis weighs what to do about Richie Valenti: chair (Johnny Lucchese) 0.21, endure 0.04
day 18: Jimmy DeSantis changes his plan: askAround (Artie Silvestri) → chair (Johnny Lucchese), because he now believes Richie Valenti answers to Johnny Lucchese
day 19: Jimmy DeSantis: going to Johnny Lucchese came to nothing; he thinks again
day 19: Jimmy DeSantis weighs what to do about Richie Valenti: endure 0.04
day 19: Jimmy DeSantis gives up: make Richie Valenti leave him alone (there is nothing more he can do)
day 24: Jimmy DeSantis has what he wanted: see that Henry Tedesco does what he promised (o82) (as he believes it: done)
```
</details>


<details><summary>records at the end</summary>

```
Henry's promise: broken (the time ran out and it was never done (whatever else happened)); the captain's: never made
Jimmy DeSantis believes of Henry's promise: "done"; his trust in Henry over the month: 0.15 → 0.19 → 0.17 → 0.14 → 0.14 → 0.17
the world: 5 pursuits, 29 requests, 2 obligations (1 broken), 5 belief revisions
```
</details>


