# Gate 2a: the Ferrara dispute, on real records

*Produced by `npx tsx src/conv/gate2a.ts`. A generated world (seed 3), its own people under their own names, nothing renamed and nothing set by hand except where a section says so. The trouble starts with the world’s own protection ask; every change after that goes through `src/conv/doors.ts` to a door the world already has; the days pass in the real engine (`engine.advance`), which now also runs the conversation layer’s daily tick. What Henry says is one of the rows on screen; what the others say is rendered from their decisions; what happens between the others has no text, only a trace. The record blocks show the requests, agreements and obligations as they stand in `World.social`.*

## 1. Kept: Henry promises a result, the captains carry it, the man obeys

*Henry promises Jimmy DeSantis that Richie Valenti will leave him alone (a result promise: beyond Henry’s own power, so it rests on others). His captain says no until Henry tells him what Richie’s people did on his ground; then he agrees, with a liability on Henry. Days later he takes it to Richie’s captain, who orders Richie; Richie agrees and means it, and lets his demand drop. Thirty clean days keep Henry’s promise, with the credit shared by delegation.*

### Day 0: Richie Valenti leans on Jimmy DeSantis
*Richie Valenti, a soldier in Johnny Lucchese’s crew, asks Jimmy DeSantis for $55 a week at DeSantis's Bakery (the world’s own protection ask). Jimmy DeSantis answers for himself: no.*

*Richie Valenti presses it with force: Richie Valenti's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.*

### Day 1: DeSantis's Bakery
**Jimmy:** “Richie’s people were in yesterday. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Richie wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll make sure he leaves you alone.”  
>   *A promise of a result: he’s left alone for thirty days. You can’t order Richie yourself; it rests on others.*
> - Leave

**You:** “I’ll make sure he leaves you alone.”
**Jimmy:** “You mean that? Then I’ll hold you to it.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.83: what it gives him +0.8, trust in you +0.03
meaning: ack.promise.result · warm · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy Richie will leave him alone. He’ll hold you to it for 30 days.


<details><summary>what Henry can deliver (authority, §6.2)</summary>

```
Henry Tedesco cannot order Richie Valenti; the man who can is Johnny Lucchese. A result promise beyond his own power: an overpromise if it fails.
```
</details>


<details><summary>records after day 1</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Richie Valenti leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: pending
```
</details>

### Day 2: the club, with Louie Costa

> **What you can say**
> - “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
**Louie:** “Jimmy? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.55: Richie’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Richie’s people smashed up DeSantis's Bakery. That’s our ground.”  
>   *Tell him what Richie’s people did, and where. He may not have heard.*
> - “I gave Jimmy my word I’d raise it.”  
>   *Put your own word on it. It’s worth what he thinks of you.*
> - Leave

**You:** “Richie’s people smashed up DeSantis's Bakery. That’s our ground.”
**Louie:** “All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”

<details><summary>trace</summary>

```
▶ accept = 0.55: Richie’s people on his own streets (as he knows it) +0.75, his regard for Henry +0.13, arguments +0.35, trouble with another captain -0.52, the man is not one of ours -0.15
  refuse = 0.16: not ours, not worth the friction +0.46, he has not heard of trouble on his streets -0.3
meaning: accept.intervention.liable · firm · toward request · implies warning · private intent: accept
change: Agreement: Louie Costa will speak to Johnny Lucchese (his promise to act, within 7 days)
change: Liability on Henry Tedesco: if this turns violent within 30 days, it falls on him
change: Jimmy DeSantis's request is now carried by Louie Costa as well (referred, on Jimmy's behalf)
```
</details>

> **Outcome:** Louie says he’ll speak to Johnny. If it turns ugly, he says, it’s on you.


<details><summary>records after day 2</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Richie Valenti leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
agreement g10: Louie Costa will speak to Johnny Lucchese (Henry Tedesco, Louie Costa) → o11
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: pending
obligation o11: Louie Costa, action, to Henry Tedesco, days 2–9: pending, serving o6, liability on Henry Tedesco
```
</details>

### Days 3–45: the world goes on

<details><summary>what happened off stage (Henry sees none of it)</summary>

```
day 5: Louie Costa takes it to Johnny Lucchese, as he said he would
day 5: o11 (Louie Costa, action) kept: he did it: raise with Johnny Lucchese
day 6: Johnny Lucchese tells Richie Valenti to leave Jimmy DeSantis alone  [▶order 0.69, refuse 0.6]
day 7: Richie Valenti tells Johnny Lucchese he'll leave Jimmy DeSantis alone, and means it  [▶obey 0.59, violate 0]
day 31: o6 (Henry Tedesco, result) kept: the whole 30 days passed cleanly; credit: delegate
day 37: o16 (Richie Valenti, restraint) kept: the whole 30 days passed cleanly
```
</details>


<details><summary>records on day 45</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): agreed
request r13: Louie Costa → Johnny Lucchese (order, serving o11, riding on ask s405): done · Louie Costa took it to Johnny Lucchese; Johnny Lucchese told Richie Valenti; Richie Valenti agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Richie Valenti leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
agreement g10: Louie Costa will speak to Johnny Lucchese (Henry Tedesco, Louie Costa) → o11
agreement g15: Richie Valenti leaves Jimmy DeSantis alone (Johnny Lucchese, Richie Valenti) → o16
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: kept (the whole 30 days passed cleanly), credit delegate
obligation o11: Louie Costa, action, to Henry Tedesco, days 2–9: kept (he did it: raise with Johnny Lucchese), serving o6, liability on Henry Tedesco
obligation o16: Richie Valenti, restraint (an order), to Johnny Lucchese, days 7–37: kept (the whole 30 days passed cleanly), serving o11, he means to keep it (private)
```
</details>

### Day 46: back at DeSantis's Bakery
**Jimmy:** “Richie’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 5.88: he has seen Richie’s people stay away +1, days since you promised +4.6, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
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

> **Outcome:** Jimmy says his trouble with Richie is over. He thanks you.


<details><summary>how it ended (records)</summary>

```
O1 o6 result (kept: the whole 30 days passed cleanly; credit: delegate); O2 o11 action (kept: he did it: raise with Johnny Lucchese); O3 o16 restraint (kept: the whole 30 days passed cleanly)
Jimmy DeSantis’s trust in Henry Tedesco: 0.11; Louie Costa’s: 0.17; Johnny Lucchese’s grudge against Richie Valenti: 0.31
favours: Jimmy DeSantis owes Henry Tedesco one
Richie Valenti’s demand on DeSantis's Bakery: withdrawn or settled
```
</details>

*World audit after the run: clean. Business ledgers: consistent.*

## 2. Broken: the man has a reason, refuses his captain, and strikes

*The one staged input in this document: Sal Gallo is given a grudge against Jimmy (through the grudge door, core.bear) before anything happens, because in the natural runs below no man had one (see section 7). Everything after is the world’s: his captain orders him; he refuses (the world’s own “leave him alone” ask, answered by him); his grudge carries him back to the shop through the world’s own retaliation. Henry’s result promise breaks at the first violation, not at the end of the period; the liability his captain laid on him falls; Jimmy’s first word is a reproach.*

### Day 0: Sal Gallo leans on Jimmy DeSantis
*Sal Gallo, a soldier in Johnny Lucchese’s crew, asks Jimmy DeSantis for $55 a week at DeSantis's Bakery (the world’s own protection ask). Jimmy DeSantis answers for himself: no.*

*Sal Gallo presses it with force: Sal Gallo's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.*

### Day 1: DeSantis's Bakery
**Jimmy:** “Sal’s people were in yesterday. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Sal wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll make sure he leaves you alone.”  
>   *A promise of a result: he’s left alone for thirty days. You can’t order Sal yourself; it rests on others.*
> - Leave

**You:** “I’ll make sure he leaves you alone.”
**Jimmy:** “You mean that? Then I’ll hold you to it.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.83: what it gives him +0.8, trust in you +0.03
meaning: ack.promise.result · warm · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy Sal will leave him alone. He’ll hold you to it for 30 days.


<details><summary>what Henry can deliver (authority, §6.2)</summary>

```
Henry Tedesco cannot order Sal Gallo; the man who can is Johnny Lucchese. A result promise beyond his own power: an overpromise if it fails.
```
</details>


<details><summary>records after day 1</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Sal Gallo leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: pending
```
</details>

### Day 2: the club, with Louie Costa

> **What you can say**
> - “Jimmy DeSantis’s having trouble with Sal Gallo. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Jimmy DeSantis’s having trouble with Sal Gallo. I want to bring it to the family.”
**Louie:** “Jimmy? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.55: Sal’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Sal’s people smashed up DeSantis's Bakery. That’s our ground.”  
>   *Tell him what Sal’s people did, and where. He may not have heard.*
> - “I gave Jimmy my word I’d raise it.”  
>   *Put your own word on it. It’s worth what he thinks of you.*
> - Leave

**You:** “Sal’s people smashed up DeSantis's Bakery. That’s our ground.”
**Louie:** “All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”

<details><summary>trace</summary>

```
▶ accept = 0.55: Sal’s people on his own streets (as he knows it) +0.75, his regard for Henry +0.13, arguments +0.35, trouble with another captain -0.52, the man is not one of ours -0.15
  refuse = 0.16: not ours, not worth the friction +0.46, he has not heard of trouble on his streets -0.3
meaning: accept.intervention.liable · firm · toward request · implies warning · private intent: accept
change: Agreement: Louie Costa will speak to Johnny Lucchese (his promise to act, within 7 days)
change: Liability on Henry Tedesco: if this turns violent within 30 days, it falls on him
change: Jimmy DeSantis's request is now carried by Louie Costa as well (referred, on Jimmy's behalf)
```
</details>

> **Outcome:** Louie says he’ll speak to Johnny. If it turns ugly, he says, it’s on you.


<details><summary>records after day 2</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Sal Gallo leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
agreement g10: Louie Costa will speak to Johnny Lucchese (Henry Tedesco, Louie Costa) → o11
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: pending
obligation o11: Louie Costa, action, to Henry Tedesco, days 2–9: pending, serving o6, liability on Henry Tedesco
```
</details>

### Days 3–45: the world goes on

<details><summary>what happened off stage (Henry sees none of it)</summary>

```
day 5: Louie Costa takes it to Johnny Lucchese, as he said he would
day 5: o11 (Louie Costa, action) kept: he did it: raise with Johnny Lucchese
day 6: Johnny Lucchese tells Sal Gallo to leave Jimmy DeSantis alone  [▶order 0.69, refuse 0.62]
day 12: Sal Gallo beat up Jimmy DeSantis.
day 12: o6 (Henry Tedesco, result) broken: a violation inside the period: Sal Gallo beat up Jimmy DeSantis.
day 13: Sal Gallo won’t leave Jimmy DeSantis alone (dropped)
day 18: Dom Mancini's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.
```
</details>


<details><summary>records on day 45</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): agreed
request r13: Louie Costa → Johnny Lucchese (order, serving o11, riding on ask s399): refused · Louie Costa took it to Johnny Lucchese; Johnny Lucchese told Sal Gallo; Sal Gallo would not have it (dropped)
agreement g5: Henry Tedesco to Jimmy DeSantis: Sal Gallo leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
agreement g10: Louie Costa will speak to Johnny Lucchese (Henry Tedesco, Louie Costa) → o11
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: broken (a violation inside the period: Sal Gallo beat up Jimmy DeSantis.)
obligation o11: Louie Costa, action, to Henry Tedesco, days 2–9: kept (he did it: raise with Johnny Lucchese), serving o6, liability on Henry Tedesco (fell on day 12: Louie Costa thinks less of him)
```
</details>

### Day 46: back at DeSantis's Bakery
**Jimmy:** “They were back. You said you’d make sure.”

<details><summary>trace</summary>

```
▶ reproach = 1: he was promised it would stop, and it didn’t +1
meaning: followup.broken · cold · toward speaker · private intent: reproach
change: Jimmy DeSantis's trust in Henry Tedesco falls (a broken promise, as he saw it)
```
</details>


<details><summary>how it ended (records)</summary>

```
O1 o6 result (broken: a violation inside the period: Sal Gallo beat up Jimmy DeSantis.); O2 o11 action (kept: he did it: raise with Johnny Lucchese); O3 (none)
Jimmy DeSantis’s trust in Henry Tedesco: 0.10; Louie Costa’s: 0.20; Johnny Lucchese’s grudge against Sal Gallo: 0.00
favours: none
Sal Gallo’s demand on DeSantis's Bakery: withdrawn or settled
```
</details>

*World audit after the run: clean. Business ledgers: consistent.*

## 3. An action promise, kept though the captain says no

*Henry promised only to raise it. He does; the captain refuses (Henry doesn’t tell him what happened). The promise was to raise it, and it is kept the moment he does.*

### Day 0: Richie Valenti leans on Jimmy DeSantis
*Richie Valenti, a soldier in Johnny Lucchese’s crew, asks Jimmy DeSantis for $55 a week at DeSantis's Bakery (the world’s own protection ask). Jimmy DeSantis answers for himself: no.*

*Richie Valenti presses it with force: Richie Valenti's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.*

### Day 1: DeSantis's Bakery
**Jimmy:** “Richie’s people were in yesterday. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Richie wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *A promise to act: you’ll raise it with your captain. Kept when you do, whatever he says.*
> - Leave

**You:** “I’ll speak to my captain about it.”
**Jimmy:** “That’s something. Tell him what they’ve been doing.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.43: what it gives him +0.4, trust in you +0.03
meaning: ack.promise.action · flat · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy you’d raise it with your captain. That’s what you’ve promised: to raise it.


<details><summary>what Henry can deliver (authority, §6.2)</summary>

```
Henry Tedesco cannot order Richie Valenti; the man who can is Johnny Lucchese. He has promised only what he can do himself.
```
</details>


<details><summary>records after day 1</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: he will raise it with Louie Costa (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, action, to Jimmy DeSantis, days 1–15: pending
```
</details>

### Day 2: the club, with Louie Costa

> **What you can say**
> - “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
**Louie:** “Jimmy? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.55: Richie’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Richie’s people smashed up DeSantis's Bakery. That’s our ground.”  
>   *Tell him what Richie’s people did, and where. He may not have heard.*
> - “I gave Jimmy my word I’d raise it.”  
>   *Put your own word on it. It’s worth what he thinks of you.*
> - Leave

**You:** [missing bank: leave]
> **Outcome:** Louie won’t take it up. He says Jimmy isn’t one of ours.


<details><summary>records after day 2</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): refused
agreement g5: Henry Tedesco to Jimmy DeSantis: he will raise it with Louie Costa (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, action, to Jimmy DeSantis, days 1–15: kept (he did it: raise with Louie Costa)
```
</details>

### Days 3–16: the world goes on

<details><summary>what happened off stage (Henry sees none of it)</summary>

```
day 2: o6 (Henry Tedesco, action) kept: he did it: raise with Louie Costa
```
</details>


<details><summary>records on day 16</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): refused
agreement g5: Henry Tedesco to Jimmy DeSantis: he will raise it with Louie Costa (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, action, to Jimmy DeSantis, days 1–15: kept (he did it: raise with Louie Costa)
```
</details>

### Day 17: back at DeSantis's Bakery
**Jimmy:** “Richie’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 2.98: he has seen Richie’s people stay away +1, days since you promised +1.7, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
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

> **Outcome:** Jimmy says his trouble with Richie is over. He thanks you.


<details><summary>how it ended (records)</summary>

```
O1 o6 action (kept: he did it: raise with Louie Costa); O2 (none); O3 (none)
Jimmy DeSantis’s trust in Henry Tedesco: 0.12; Louie Costa’s: 0.42; Johnny Lucchese’s grudge against Richie Valenti: 0.00
favours: Jimmy DeSantis owes Henry Tedesco one
Richie Valenti’s demand on DeSantis's Bakery: withdrawn or settled
```
</details>

*World audit after the run: clean. Business ledgers: consistent.*

## 4. An effort promise, kept by a failed attempt

*Henry promised to try. His captain refuses. The attempt counts, because Henry had reason to think it might work when he made it.*

### Day 0: Richie Valenti leans on Jimmy DeSantis
*Richie Valenti, a soldier in Johnny Lucchese’s crew, asks Jimmy DeSantis for $55 a week at DeSantis's Bakery (the world’s own protection ask). Jimmy DeSantis answers for himself: no.*

*Richie Valenti presses it with force: Richie Valenti's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.*

### Day 1: DeSantis's Bakery
**Jimmy:** “Richie’s people were in yesterday. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Richie wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll do what I can.”  
>   *A promise to try: you’ll need to take it to someone who can act. Kept by a real attempt, even one that fails.*
> - Leave

**You:** “I’ll do what I can.”
**Jimmy:** “I suppose that’s all anyone can do.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.28: what it gives him +0.25, trust in you +0.03
meaning: ack.promise.effort · flat · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy you’d do what you can. He’ll expect you to try.


<details><summary>what Henry can deliver (authority, §6.2)</summary>

```
Henry Tedesco cannot order Richie Valenti; the man who can is Johnny Lucchese. He has promised only what he can do himself.
```
</details>


<details><summary>records after day 1</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: he will try to get Richie Valenti to stop (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, effort, to Jimmy DeSantis, days 1–15: pending
```
</details>

### Day 2: the club, with Louie Costa

> **What you can say**
> - “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
**Louie:** “Jimmy? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.55: Richie’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Richie’s people smashed up DeSantis's Bakery. That’s our ground.”  
>   *Tell him what Richie’s people did, and where. He may not have heard.*
> - “I gave Jimmy my word I’d raise it.”  
>   *Put your own word on it. It’s worth what he thinks of you.*
> - Leave

**You:** [missing bank: leave]
> **Outcome:** Louie won’t take it up. He says Jimmy isn’t one of ours.


<details><summary>records after day 2</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): refused
agreement g5: Henry Tedesco to Jimmy DeSantis: he will try to get Richie Valenti to stop (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, effort, to Jimmy DeSantis, days 1–15: kept (a real attempt: raise with Louie Costa, which he expected might work (0.26), whatever came of it)
```
</details>

### Days 3–16: the world goes on

<details><summary>what happened off stage (Henry sees none of it)</summary>

```
day 2: o6 (Henry Tedesco, effort) kept: a real attempt: raise with Louie Costa, which he expected might work (0.26), whatever came of it
```
</details>


<details><summary>records on day 16</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): refused
agreement g5: Henry Tedesco to Jimmy DeSantis: he will try to get Richie Valenti to stop (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, effort, to Jimmy DeSantis, days 1–15: kept (a real attempt: raise with Louie Costa, which he expected might work (0.26), whatever came of it)
```
</details>

### Day 17: back at DeSantis's Bakery
**Jimmy:** “Richie’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 2.98: he has seen Richie’s people stay away +1, days since you promised +1.7, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
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

> **Outcome:** Jimmy says his trouble with Richie is over. He thanks you.


<details><summary>how it ended (records)</summary>

```
O1 o6 effort (kept: a real attempt: raise with Louie Costa, which he expected might work (0.26), whatever came of it); O2 (none); O3 (none)
Jimmy DeSantis’s trust in Henry Tedesco: 0.12; Louie Costa’s: 0.42; Johnny Lucchese’s grudge against Richie Valenti: 0.00
favours: Jimmy DeSantis owes Henry Tedesco one
Richie Valenti’s demand on DeSantis's Bakery: withdrawn or settled
```
</details>

*World audit after the run: clean. Business ledgers: consistent.*

## 5. A result kept with no credit

*Henry’s captain takes it up, but the other captain won’t rein his man in. The man stays away anyway: Henry’s promise is kept, and nobody brought it about.*

### Day 0: Tommy Russo leans on Jimmy DeSantis
*Tommy Russo, a soldier in Johnny Lucchese’s crew, asks Jimmy DeSantis for $55 a week at DeSantis's Bakery (the world’s own protection ask). Jimmy DeSantis answers for himself: no.*

*Tommy Russo presses it with force: Tommy Russo's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.*

### Day 1: DeSantis's Bakery
**Jimmy:** “Tommy’s people were in yesterday. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Tommy wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll make sure he leaves you alone.”  
>   *A promise of a result: he’s left alone for thirty days. You can’t order Tommy yourself; it rests on others.*
> - Leave

**You:** “I’ll make sure he leaves you alone.”
**Jimmy:** “You mean that? Then I’ll hold you to it.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.83: what it gives him +0.8, trust in you +0.03
meaning: ack.promise.result · warm · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy Tommy will leave him alone. He’ll hold you to it for 30 days.


<details><summary>what Henry can deliver (authority, §6.2)</summary>

```
Henry Tedesco cannot order Tommy Russo; the man who can is Johnny Lucchese. A result promise beyond his own power: an overpromise if it fails.
```
</details>


<details><summary>records after day 1</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Tommy Russo leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: pending
```
</details>

### Day 2: the club, with Louie Costa

> **What you can say**
> - “Jimmy DeSantis’s having trouble with Tommy Russo. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Jimmy DeSantis’s having trouble with Tommy Russo. I want to bring it to the family.”
**Louie:** “All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”

<details><summary>trace</summary>

```
▶ accept = 0.2: Tommy’s people on his own streets (as he knows it) +0.75, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
  refuse = 0.16: not ours, not worth the friction +0.46, he has not heard of trouble on his streets -0.3
meaning: accept.intervention.liable · firm · toward request · implies warning · private intent: accept
change: Agreement: Louie Costa will speak to Johnny Lucchese (his promise to act, within 7 days)
change: Liability on Henry Tedesco: if this turns violent within 30 days, it falls on him
change: Jimmy DeSantis's request is now carried by Louie Costa as well (referred, on Jimmy's behalf)
```
</details>

> **Outcome:** Louie says he’ll speak to Johnny. If it turns ugly, he says, it’s on you.


<details><summary>records after day 2</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: Tommy Russo leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
agreement g9: Louie Costa will speak to Johnny Lucchese (Henry Tedesco, Louie Costa) → o10
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: pending
obligation o10: Louie Costa, action, to Henry Tedesco, days 2–9: pending, serving o6, liability on Henry Tedesco
```
</details>

### Days 3–45: the world goes on

<details><summary>what happened off stage (Henry sees none of it)</summary>

```
day 4: Louie Costa takes it to Johnny Lucchese, as he said he would
day 4: o10 (Louie Costa, action) kept: he did it: raise with Johnny Lucchese
day 5: Johnny Lucchese won’t rein in Tommy Russo  [order 0.54, ▶refuse 0.61]
day 31: o6 (Henry Tedesco, result) kept: the whole 30 days passed cleanly; credit: none
```
</details>


<details><summary>records on day 45</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
request r8: Henry Tedesco → Louie Costa (intervene, serving o6): agreed
request r12: Louie Costa → Johnny Lucchese (order, serving o10): refused · Louie Costa took it to Johnny Lucchese; Johnny Lucchese refused
agreement g5: Henry Tedesco to Jimmy DeSantis: Tommy Russo leaves him alone for 30 days (Jimmy DeSantis, Henry Tedesco) → o6
agreement g9: Louie Costa will speak to Johnny Lucchese (Henry Tedesco, Louie Costa) → o10
obligation o6: Henry Tedesco, result, to Jimmy DeSantis, days 1–31: kept (the whole 30 days passed cleanly), credit none
obligation o10: Louie Costa, action, to Henry Tedesco, days 2–9: kept (he did it: raise with Johnny Lucchese), serving o6, liability on Henry Tedesco
```
</details>

### Day 46: back at DeSantis's Bakery
**Jimmy:** “Tommy’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 5.88: he has seen Tommy’s people stay away +1, days since you promised +4.6, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
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

> **Outcome:** Jimmy says his trouble with Tommy is over. He thanks you.


<details><summary>how it ended (records)</summary>

```
O1 o6 result (kept: the whole 30 days passed cleanly; credit: none); O2 o10 action (kept: he did it: raise with Johnny Lucchese); O3 (none)
Jimmy DeSantis’s trust in Henry Tedesco: 0.10; Louie Costa’s: 0.25; Johnny Lucchese’s grudge against Tommy Russo: 0.00
favours: Jimmy DeSantis owes Henry Tedesco one
Tommy Russo’s demand on DeSantis's Bakery: withdrawn or settled
```
</details>

*World audit after the run: clean. Business ledgers: consistent.*

## 6. An action promise broken by doing nothing

*Henry promises to raise it and never does. Nothing happens to Jimmy either; the promise breaks when the time runs out, whatever else happened.*

### Day 0: Richie Valenti leans on Jimmy DeSantis
*Richie Valenti, a soldier in Johnny Lucchese’s crew, asks Jimmy DeSantis for $55 a week at DeSantis's Bakery (the world’s own protection ask). Jimmy DeSantis answers for himself: no.*

*Richie Valenti presses it with force: Richie Valenti's people smashed up DeSantis's Bakery after Jimmy DeSantis refused to pay.*

### Day 1: DeSantis's Bakery
**Jimmy:** “Richie’s people were in yesterday. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
▶ seekHelp = 1: Richie wants money off him +1
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *A promise to act: you’ll raise it with your captain. Kept when you do, whatever he says.*
> - Leave

**You:** “I’ll speak to my captain about it.”
**Jimmy:** “That’s something. Tell him what they’ve been doing.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.43: what it gives him +0.4, trust in you +0.03
meaning: ack.promise.action · flat · toward speaker · private intent: acknowledge
change: Jimmy DeSantis's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

> **Outcome:** You told Jimmy you’d raise it with your captain. That’s what you’ve promised: to raise it.


<details><summary>what Henry can deliver (authority, §6.2)</summary>

```
Henry Tedesco cannot order Richie Valenti; the man who can is Johnny Lucchese. He has promised only what he can do himself.
```
</details>


<details><summary>records after day 1</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: he will raise it with Louie Costa (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, action, to Jimmy DeSantis, days 1–15: pending
```
</details>

### Day 2: Henry has other things to do
*Henry never gets round to Louie Costa. Nothing is said to anyone.*

### Days 3–20: the world goes on

<details><summary>what happened off stage (Henry sees none of it)</summary>

```
day 15: o6 (Henry Tedesco, action) broken: the time ran out and it was never done (whatever else happened)
```
</details>


<details><summary>records on day 20</summary>

```
request r4: Jimmy DeSantis → Henry Tedesco (intervene): agreed
agreement g5: Henry Tedesco to Jimmy DeSantis: he will raise it with Louie Costa (Jimmy DeSantis, Henry Tedesco) → o6
obligation o6: Henry Tedesco, action, to Jimmy DeSantis, days 1–15: broken (the time ran out and it was never done (whatever else happened))
```
</details>

### Day 21: back at DeSantis's Bakery
**Jimmy:** “Richie’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 3.38: he has seen Richie’s people stay away +1, days since you promised +2.1, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “No. I never got to it.”  
>   *Tell him the truth: it didn’t get anywhere.*
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


<details><summary>how it ended (records)</summary>

```
O1 o6 action (broken: the time ran out and it was never done (whatever else happened)); O2 (none); O3 (none)
Jimmy DeSantis’s trust in Henry Tedesco: 0.10; Louie Costa’s: 0.40; Johnny Lucchese’s grudge against Richie Valenti: 0.06
favours: none
Richie Valenti’s demand on DeSantis's Bakery: withdrawn or settled
```
</details>

*World audit after the run: clean. Business ledgers: consistent.*

## 7. Across many worlds, with nothing staged

*The same chain (a result promise, Henry tells his captain what happened) for each soldier of another crew, in seeds 1–12: whoever the world has. Counted from the records.*

| | Runs |
|---|---|
| chains run | 61 |
| no dispute (the shopkeeper paid) | 0 |
| Henry’s captain took it up | 53 |
| the other captain ordered his man | 37 |
| the man agreed | 32 |
| …and meant it | 32 |
| …and broke it | 0 |
| Henry’s promise kept | 61 |
| …with credit shared by delegation | 32 |
| …with no credit (it held by itself) | 29 |
| Henry’s promise broken | 0 |
| a liability fell on Henry | 0 |
| runs with an audit or ledger failure | 0 |

