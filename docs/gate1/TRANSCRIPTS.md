# Gate 1: generated conversations (second pass)

*Produced by `npx tsx src/conv/gate1.ts` from the proof-of-concept engine in `src/conv/`. Every line spoken by a character other than Henry is rendered from a decision and its meaning; every line of Henry’s is one of the rows that was on screen (the harness refuses anything else). Outcome cards say only what was said or seen, attributed. Names are fixtures; the men behind them are ordinary characters of a generated world.*

## 1. The bakery: a first visit, five different men

Henry Tedesco (an associate of the Corrente family) walks into Russo’s Bakery for the first time. Same Henry, same afternoon, same choices. Only the man behind the counter differs. Every reply is the engine’s, and every choice Henry makes is one of the rows on screen at that moment.

### Cautious Frank
*Careful by nature; pays a Corrente soldier for protection already.*

*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*

**Frank:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.65: ordinary courtesy +0.5, agreeable +0.15, what he has heard of you +0
  dismiss.pretext = 0.24: what he has heard of you +0, caution +0.24, fear of you +0
  dismiss.hostile = 0.12: what he has heard of you +0, pride +0.16, volatility +0.09, fear of you -0.13
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Frank:** “Corrente. Then you know Tommy already. He comes by on the first of the month.”

<details><summary>trace</summary>

```
▶ warnOff.protector = 0.9: he is looked after already +0.4, caution +0.4, the same family: he can name the man +0.1, fear of you +0
  appease = 0.41: fear of a family man (his courage) +0.41, trouble on his street +0
  neutral = 0.3: nothing to say about it +0.3
  probe = 0.21: his business is in trouble +0, he does not trust you yet +0.14, agreeable +0.08
  proud = -0.14: pride +0.32, volatility +0.06, fear -0.22, he already pays someone -0.3
meaning: react.introduction.warnOff.sameFamily · polite · toward third · implies warning · private intent: inform · aim: warn you off
change: Frank Russo now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$40 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a loaf, thanks.”  
>   *Leave it at an introduction.*
> - Leave

**You:** “$40 a week, and nothing happens to the place.”
**Frank:** “I already pay Tommy. I’m not paying twice.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Tommy Conti (Corrente))
▶ refuse = 0.65: pride +0.18, courage +0.19, Tommy looks after him +0.55, fear -0.27
  dismiss = -0.13: pride +0.24, volatility +0.14, fear -0.32, caution -0.28, he is looked after +0.1
  accept = -0.88 [would cross: obliged]: fear of what happens if he says no +0.35, what it costs him -0.23, pride -0.16, paying twice, and crossing Tommy -0.84
reason given: hasArrangement
meaning: refuse.protection.hasArrangement · cold · toward third · implies warning · private intent: refuse · aim: warn you off
```
</details>


> **What you can say**
> - “Whoever it is, I could do better for you.”  
>   *Offer to look after him for less. Whoever he pays now will hear of it.*
> - “Think it over. I’ll be back Friday.”  
>   *Give him time. You’re only saying you’ll come back; he hasn’t promised you anything.*
> - Leave

**You:** “Think it over. I’ll be back Friday.”
**Frank:** “Friday, then.”

<details><summary>trace</summary>

```
▶ acknowledge = 1: he heard it; he has promised nothing +1
meaning: acknowledge.return · flat · toward speaker · private intent: acknowledge
change: Recorded: Henry Tedesco's stated intention to come back (binds nobody)
change: Frank Russo's own next step, privately: tell Tommy Conti that Henry Tedesco came asking
```
</details>

> **Outcome:** Frank turned you down. He says he already pays Tommy. You said you’d be back Friday.

### Proud Frank
*Proud and quick to anger; nobody protects him and he likes it that way.*

*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*

**Frank:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.59: ordinary courtesy +0.5, agreeable +0.09, what he has heard of you +0
  dismiss.hostile = 0.49: what he has heard of you +0, pride +0.34, volatility +0.21, fear of you -0.06
  dismiss.pretext = 0.08: what he has heard of you +0, caution +0.08, fear of you +0
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Frank:** “Good for you. I don’t need anything from the Correntes.”

<details><summary>trace</summary>

```
▶ proud = 0.72: pride +0.68, volatility +0.14, fear -0.1, he already pays someone +0
  neutral = 0.3: nothing to say about it +0.3
  probe = 0.18: his business is in trouble +0, he does not trust you yet +0.14, agreeable +0.05
  appease = 0.18: fear of a family man (his courage) +0.18, trouble on his street +0
meaning: react.introduction.proud · cold · toward speaker · private intent: inform · aim: stand his ground
change: Frank Russo now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$40 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a loaf, thanks.”  
>   *Leave it at an introduction.*
> - Leave

**You:** “$40 a week, and nothing happens to the place.”
**Frank:** “Get out of my shop before I throw you out.”

<details><summary>trace</summary>

```
▶ dismiss = 0.54: pride +0.51, volatility +0.32, fear -0.2, caution -0.09, he is looked after +0
  refuse = 0.5: pride +0.38, courage +0.28, fear -0.17
  counter = -0.14: he wants the street quiet +0, fear (bargaining with it takes nerve) +0.14, it costs less than asked -0.09, he would rather bargain than refuse +0.07, pride -0.25
  accept = -0.36: fear of what happens if he says no +0.21, what it costs him -0.23, pride -0.34
reason given: pride
meaning: refuse.protection.pride · hostile · toward speaker · private intent: dismiss · aim: be rid of you
```
</details>


> **What you can say**
> - Leave

> **Outcome:** Frank told you to get out.

### Desperate Frank
*Three bad weeks running; almost no cash; nobody protects him.*

*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*

**Frank:** “What do you want?”

<details><summary>trace</summary>

```
▶ greet = 0.68: ordinary courtesy +0.5, agreeable +0.18, what he has heard of you +0
  dismiss.pretext = 0.15: what he has heard of you +0, caution +0.15, fear of you +0
  dismiss.hostile = 0.04: what he has heard of you +0, pride +0.12, volatility +0.09, fear of you -0.16
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Frank:** “Corrente. Course you are. So what’s this about?”

<details><summary>trace</summary>

```
▶ probe = 0.78: his business is in trouble +0.55, he does not trust you yet +0.14, agreeable +0.09
  appease = 0.5: fear of a family man (his courage) +0.5, trouble on his street +0
  neutral = 0.3: nothing to say about it +0.3
  proud = 0.02: pride +0.24, volatility +0.06, fear -0.28, he already pays someone +0
meaning: react.introduction.probe · flat · toward speaker · private intent: inform · aim: find out what you want
change: Frank Russo now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$40 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a loaf, thanks.”  
>   *Leave it at an introduction.*
> - Leave

**You:** “$40 a week, and nothing happens to the place.”
**Frank:** “$30. That’s all there is, and what do I get for it?”

<details><summary>trace</summary>

```
▶ counter = 0.54: he wants the street quiet +0.2, fear (bargaining with it takes nerve) +0.23, it costs less than asked -0.16, he would rather bargain than refuse +0.36, pride -0.09
  refuse = -0.02: pride +0.14, courage +0.16, fear -0.31
  accept = -0.12: fear of what happens if he says no +0.4, what it costs him -0.4, pride -0.12
  dismiss = -0.23: pride +0.18, volatility +0.14, fear -0.37, caution -0.17, he is looked after +0
meaning: counter.protection · pleading · toward request · private intent: counter · aim: get something for his money
```
</details>


> **What you can say**
> - “$30. Fridays.”  
>   *Take his figure. It’s agreed.*
> - “I’m asking now.”  
>   *Hold out for yours. He may fold, or turn you down.*
> - Leave

**You:** “$30. Fridays.”
> **Outcome:** Agreed: $30 a week, Fridays. He says he wants the street kept quiet for it.

### Frightened Frank
*Timid; a shop on his street was smashed up last week, and he saw it.*

*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*

**Frank:** “Can I— can I help you with something?”

<details><summary>trace</summary>

```
▶ greet = 0.68: ordinary courtesy +0.5, agreeable +0.18, what he has heard of you +0
  dismiss.pretext = 0.18: what he has heard of you +0, caution +0.18, fear of you +0
  dismiss.hostile = -0.09: what he has heard of you +0, pride +0.1, volatility +0.06, fear of you -0.25
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Frank:** “Mr. Tedesco. Yes. Of course. Whatever you need.”

<details><summary>trace</summary>

```
▶ appease = 0.92: fear of a family man (his courage) +0.77, trouble on his street +0.15
  neutral = 0.3: nothing to say about it +0.3
  probe = 0.23: his business is in trouble +0, he does not trust you yet +0.14, agreeable +0.09
  proud = -0.18: pride +0.2, volatility +0.04, fear -0.42, he already pays someone +0
meaning: react.introduction.appease · afraid · toward speaker · private intent: inform · aim: keep you sweet
change: Frank Russo now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$40 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a loaf, thanks.”  
>   *Leave it at an introduction.*
> - Leave

**You:** “$40 a week, and nothing happens to the place.”
**Frank:** He looks at the window, then at you. “Fine. $40. Fridays. Just— fine.”

<details><summary>trace</summary>

```
▶ accept = 0.41: fear of what happens if he says no +0.74, what it costs him -0.23, pride -0.1
  counter = 0.16: he wants the street quiet +0.12, fear (bargaining with it takes nerve) +0.14, it costs less than asked -0.09, he would rather bargain than refuse +0.07, pride -0.07
  refuse = -0.41: pride +0.11, courage +0.05, fear -0.58
  dismiss = -0.65: pride +0.15, volatility +0.09, fear -0.68, caution -0.21, he is looked after +0
meaning: accept.protection.afraid · afraid · toward speaker · private intent: accept · aim: make it stop
```
</details>

> **Outcome:** Agreed: $40 a week, Fridays. He said it fast, and he wouldn’t look at you.

### Connected Frank
*His cousin is a soldier in another family; nobody else protects him.*

*Russo’s Bakery, Mulberry Street. Tuesday afternoon. He doesn’t know you.*

**Frank:** “Help you?”

<details><summary>trace</summary>

```
▶ greet = 0.64: ordinary courtesy +0.5, agreeable +0.14, what he has heard of you +0
  dismiss.pretext = 0.18: what he has heard of you +0, caution +0.18, fear of you +0
  dismiss.hostile = 0.17: what he has heard of you +0, pride +0.2, volatility +0.11, fear of you -0.13
meaning: greet.customer · polite · toward speaker · private intent: greet
```
</details>


> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Frank:** “Corrente. My cousin Sal runs with the Marchettis. Small world.”

<details><summary>trace</summary>

```
▶ warnOff.kin = 0.83: his cousin is with the Marchettis +0.55, caution +0.18, pride +0.1
  appease = 0.41: fear of a family man (his courage) +0.41, trouble on his street +0
  neutral = 0.3: nothing to say about it +0.3
  proud = 0.25: pride +0.4, volatility +0.07, fear -0.22, he already pays someone +0
  probe = 0.2: his business is in trouble +0, he does not trust you yet +0.14, agreeable +0.07
meaning: react.introduction.warnOff.kin · polite · toward third · implies warning · private intent: inform · aim: warn you off
change: Frank Russo now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$40 a week, and nothing happens to the place.”  
>   *Put it to him plainly.*
> - “Just a loaf, thanks.”  
>   *Leave it at an introduction.*
> - Leave

**You:** “$40 a week, and nothing happens to the place.”
**Frank:** “You’ll want to talk to my cousin Sal about that. The Marchettis take an interest in this street.”

<details><summary>trace</summary>

```
▶ refer = 0.91: his cousin Sal is with the Marchettis +0.6, caution +0.24, fear +0.07
  refuse = 0.15: pride +0.23, courage +0.19, fear -0.27
  counter = 0.07: he wants the street quiet +0, fear (bargaining with it takes nerve) +0.22, it costs less than asked -0.09, he would rather bargain than refuse +0.09, pride -0.15
  dismiss = -0.07: pride +0.3, volatility +0.16, fear -0.32, caution -0.21, he is looked after +0
  accept = -0.08: fear of what happens if he says no +0.35, what it costs him -0.23, pride -0.2
meaning: refer.protection.kin · cold · toward third · implies warning · private intent: refer · aim: warn you off
```
</details>

> **Outcome:** Frank sent you to his cousin Sal. He says anything about the place goes through the Marchettis.

## 2. "Nice place. You must do well here."

The same indirect remark, before Henry has said who he is. Whether Frank hears a demand depends only on what *he* knows. Henry’s real intention is never visible to him.

### Cautious Frank

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Nice place. You must do well here.”
**Frank:** “I know where this is going. I already have someone who looks after the place.”

<details><summary>trace</summary>

```
heard as: demand.protection (confidence 0.66)
  cue: he already pays someone, so he knows how this goes (+0.9; basis: own arrangement)
  cue: he has the look of a man in the life (+0.4; basis: inferred appearance)
  cue: his own suspicion (+0.58; basis: own temperament)
constraints: obliged (he pays Tommy Conti (Corrente))
▶ refuse = 1.12: pride +0.18, courage +0.19, Tommy looks after him +0.55, he does not know who you are +0.25, fear -0.06
  dismiss = 0.13: pride +0.24, volatility +0.14, fear -0.07, caution -0.28, he is looked after +0.1
  accept = -1.16 [would cross: obliged]: fear of what happens if he says no +0.07, what it costs him -0.23, pride -0.16, paying twice, and crossing Tommy -0.84
reason given: hasArrangement.inferred
meaning: refuse.protection.hasArrangement.inferred · cold · toward third · implies warning · private intent: refuse · aim: warn you off
```
</details>

### Proud Frank

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Nice place. You must do well here.”
**Frank:** “Better than most.”

<details><summary>trace</summary>

```
heard as: compliment (confidence 0.11, taken literally)
  cue: he has the look of a man in the life (+0.4; basis: inferred appearance)
  cue: his own suspicion (+0.14; basis: own temperament)
meaning: reply.compliment · polite · toward speaker · private intent: remark
```
</details>

*He took it as a compliment. To ask for anything now, Henry has to say it plainly.*

### Desperate Frank

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Nice place. You must do well here.”
**Frank:** “Do well? You seen the rents around here?”

<details><summary>trace</summary>

```
heard as: compliment (confidence 0.16, taken literally)
  cue: he has the look of a man in the life (+0.4; basis: inferred appearance)
  cue: his own suspicion (+0.34; basis: own temperament)
meaning: reply.compliment · polite · toward speaker · private intent: remark
```
</details>

*He took it as a compliment. To ask for anything now, Henry has to say it plainly.*

### Frightened Frank

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Nice place. You must do well here.”
**Frank:** “Oh— thank you. We get by.”

<details><summary>trace</summary>

```
heard as: compliment (confidence 0.32, taken literally)
  cue: trouble on his street (1 thing he knows of) (+0.35; basis: seen f221)
  cue: he has the look of a man in the life (+0.4; basis: inferred appearance)
  cue: his own suspicion (+0.42; basis: own temperament)
meaning: reply.compliment · polite · toward speaker · private intent: remark
```
</details>

*He took it as a compliment. To ask for anything now, Henry has to say it plainly.*

### Connected Frank

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Nice place. You must do well here.”
**Frank:** “Well enough. Why do you ask?”

<details><summary>trace</summary>

```
heard as: compliment (confidence 0.19, taken literally)
  cue: he has the look of a man in the life (+0.4; basis: inferred appearance)
  cue: his own suspicion (+0.42; basis: own temperament)
meaning: reply.compliment · polite · toward speaker · private intent: remark
```
</details>

*He took it as a compliment. To ask for anything now, Henry has to say it plainly.*

## 3. The door shut, "I’ll wait", and a claim of authority

### Cautious Frank, who has heard what happened next door
**Frank:** He keeps his eyes on the till. “We’re closing.” It’s three in the afternoon.

<details><summary>trace</summary>

```
▶ dismiss.pretext = 0.72: what he has heard of you +0.48, caution +0.24, fear of you +0
  dismiss.hostile = 0.48: what he has heard of you +0.36, pride +0.16, volatility +0.09, fear of you -0.13
  greet = 0.11: ordinary courtesy +0.5, agreeable +0.15, what he has heard of you -0.54
meaning: dismiss.pretext · cold · toward speaker · private intent: dismiss · aim: get rid of you
```
</details>


> **What you can say**
> - “Another time, then.”  
>   *Go, and come back another day.*
> - “I’ll wait.”  
>   *Stay where you are. He won’t like it.*
> - Leave

**You:** “I’ll wait.”
**Frank:** He goes into the back. You hear him on the telephone, low. When he comes out he doesn’t look at you.

<details><summary>trace</summary>

```
▶ call = 0.8: Tommy looks after him +0.35, caution +0.36, fear +0.09
  threaten = 0.73: Tommy would come if called +0.4, pride +0.16, courage +0.17
  tolerate = 0.52: caution +0.32, he does not want a scene +0.2
  giveIn = 0.2: fear +0.41, pride -0.2
meaning: react.wait.call · cold · toward speaker · private intent: call
change: Frank Russo sent for Tommy Conti: a request of that man, made by the shopkeeper (it reaches him in the world, not on your screen)
```
</details>

### Frightened Frank, who has heard what happened next door
**Frank:** He keeps his eyes on the till. “We’re closing.” It’s three in the afternoon.

<details><summary>trace</summary>

```
▶ dismiss.pretext = 0.66: what he has heard of you +0.48, caution +0.18, fear of you +0
  dismiss.hostile = 0.27: what he has heard of you +0.36, pride +0.1, volatility +0.06, fear of you -0.25
  greet = 0.14: ordinary courtesy +0.5, agreeable +0.18, what he has heard of you -0.54
meaning: dismiss.pretext · cold · toward speaker · private intent: dismiss · aim: get rid of you
```
</details>


> **What you can say**
> - “Another time, then.”  
>   *Go, and come back another day.*
> - “I’ll wait.”  
>   *Stay where you are. He won’t like it.*
> - Leave

**You:** “I’ll wait.”
**Frank:** After a minute he can’t stand it. “All right. What is it you want?”

<details><summary>trace</summary>

```
▶ giveIn = 0.64: fear +0.77, pride -0.12
  tolerate = 0.44: caution +0.24, he does not want a scene +0.2
meaning: react.wait.giveIn · afraid · toward speaker · private intent: giveIn
```
</details>

### A false claim: "Louie Costa sent me" (Cautious Frank)
*Henry’s captain sent him nowhere. Frank can only judge the claim from what he knows.*


> **What you can say**
> - “Louie Costa sent me.”  
>   *Say your captain sent you. It isn’t true.*
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself. He’ll know who you are from now on, for better or worse.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection. He doesn’t know you, and he owes you nothing.*
> - “Just a loaf, thanks.”  
>   *Buy something and leave it there. Next time you’re a face he knows.*
> - Leave

**You:** “Louie Costa sent me.”
**Frank:** “I don’t know any Louie Costa. I pay Tommy.”

<details><summary>trace</summary>

```
▶ unknownName = 0: he has never heard of Louie Costa +0, belief in the claim +0
meaning: react.claim.unknownName · cold · toward third · private intent: react.claim.unknownName
change: Frank Russo holds the claim "Louie Costa sent him" at belief 0 (he does not know the name)
private (Henry): honest = false (his captain did not send him)
```
</details>

## 4. A straightforward question, and two evenings

### Scenario A: asking Marty, whom you trust, who smashed the window at The Gilded Lily
*One choice, one answer, an outcome.*


> **What you can say**
> - “Who did the window at The Gilded Lily?”  
>   *Ask what he knows.*
> - “Let me buy you a drink.”  
>   *Spend the evening with him.*
> - Leave

**You:** “Who did the window at The Gilded Lily?”
**Marty:** “Angelo’s boys. I was across the street.”

<details><summary>trace</summary>

```
▶ knows = 1.6: he knows who +1, trust in Henry +0.7, caution -0.1
meaning: answer.who.knows · flat · toward third · private intent: inform
change: Henry Tedesco now knows who did it (from Marty Russo, who saw it)
```
</details>

> **Outcome:** Marty says it was Angelo’s people. He says he saw it.

### Spend time with Marty
> You spent the evening at Fino’s with Marty. He talked about the fights on Saturday, and who should have won. It was easy. He laughed more than you expected. He likes you better for it.

### Spend time with Mario, with whom it doesn’t take
> You spent the evening at the club with Mario. He talked about the old neighbourhood, and the men who used to run it. It never quite caught. He kept looking at the door. If anything, you’re further apart.

## 5. A contested request: your captain, Nate Ferrara and Lou Valenti

*Henry promised Nate Ferrara he would raise Lou Valenti’s shakedown with the family. Vic Rizzo is Henry’s captain; Joe Marchese is Lou’s. Within a visit Rizzo remembers what Henry has already argued; across visits, what has changed.*

### Day 1: raising it, and arguing it

> **What you can say**
> - “Nate Ferrara’s having trouble with Lou Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - “Let me buy you a drink.”  
>   *Leave Nate for another day.*
> - Leave

**You:** “Nate Ferrara’s having trouble with Lou Valenti. I want to bring it to the family.”
**Vic:** “Nate? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.55: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Lou’s making trouble on our streets.”  
>   *Say what’s in it for the crew. He may want to know how you know.*
> - “I gave Nate my word I’d raise it.”  
>   *Put your own word on it. It’s worth what he thinks of you.*
> - “There’s money in bringing Nate under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go for now.*

**You:** “Lou’s making trouble on our streets.”
**Vic:** “Tell me something I don’t know. Show me Lou’s people on our streets and we’ll talk.”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.6: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments -0.05, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: condition.intervention · firm · toward request · private intent: refuse
change: Vic Rizzo has refused once already this visit; argument 1 adds -0.05
```
</details>


> **What you can say**
> - “I gave Nate my word I’d raise it.”  
>   *Put your own word on it. It’s worth what he thinks of you.*
> - “There’s money in bringing Nate under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go for now.*

**You:** “I gave Nate my word I’d raise it.”
**Vic:** “Then you gave it too quickly. That’s yours to carry, not mine.”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.56: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments -0.01, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: reject.argument.word · firm · toward request · private intent: refuse
change: Vic Rizzo has refused once already this visit; argument 2 adds 0.04
```
</details>


> **What you can say**
> - “There’s money in bringing Nate under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go for now.*

**You:** “There’s money in bringing Nate under our protection.”
**Vic:** “We’re done with this, Henry. Bring me something, or let it go.”

<details><summary>trace</summary>

```
▶ refuse = 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1
  accept = -0.44: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.13, arguments +0.11, trouble with another captain -0.52, the man is not one of ours -0.15
reason given: notOurs
meaning: cutOff.argument · weary · toward request · private intent: refuse
change: Vic Rizzo has refused once already this visit; argument 3 adds 0.12
change: Vic Rizzo's patience on this is spent for today
```
</details>

> **Outcome:** Vic won’t hear any more about it today.

### Day 3: Nate, still waiting
**Nate:** “Well? Did you talk to them?”

<details><summary>trace</summary>

```
▶ followup.pending = 1.48: he has heard nothing from you +1, days since you promised +0.2, patience (caution, agreeable) +0.28
meaning: followup.pending · flat · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “I raised it. The captain won’t move on it yet.”  
>   *Tell him the truth: the captain won’t move yet.*
> - “Give it time. These things take time.”  
>   *Put him off.*
> - Leave

**You:** “I raised it. The captain won’t move on it yet.”
**Nate:** He lets out a breath. “At least you’re straight with me.”

<details><summary>trace</summary>

```
▶ honest = 1: he believes what you said +1
meaning: react.report.honest · flat · toward speaker · private intent: honest
change: Nate Ferrara keeps waiting, a little less sure; patience shortened
change: He starts looking at other routes (his own pursuit)
```
</details>

*Day 4. Without Henry: Lou’s people smash up Barone's Grocery, a shop on Rizzo’s own book. The man who collects there tells Rizzo.*

### Day 5: back to Rizzo, after something has changed
*He raises it before you can.*
**Vic:** “You heard about Barone's Grocery? Lou’s people. On my book.”

<details><summary>trace</summary>

```
meaning: raise.newinfo · cold · toward third · private intent: inform
```
</details>


> **What you can say**
> - “About Nate and Lou.”  
>   *Bring Nate into it.*
> - Leave

**You:** “About Nate and Lou.”
**Vic:** “All right. I’ll have a word with Joe. But if this turns ugly, it’s on you.”

<details><summary>trace</summary>

```
▶ accept = 0.2: Lou’s people on his own streets (as he knows it) +0.75, his regard for Henry +0.13, arguments +0, trouble with another captain -0.52, the man is not one of ours -0.15
  refuse = 0.16: not ours, not worth the friction +0.46, he has not heard of trouble on his streets -0.3
meaning: accept.intervention.liable · firm · toward request · implies warning · private intent: accept
change: Agreement: Vic Rizzo will speak to Joe Marchese (his promise to act, within 7 days)
change: Liability on Henry Tedesco: if this turns violent within 30 days, it falls on him
change: Nate Ferrara's request is now carried by Vic Rizzo as well (referred, on Nate's behalf)
```
</details>

> **Outcome:** Vic says he’ll speak to Joe. If it turns ugly, he says, it’s on you.

### Day 7: asking how it’s going

> **What you can say**
> - “Anything on Nate?”  
>   *Ask whether he’s done it.*
> - Leave

**You:** “Anything on Nate?”
**Vic:** “I said I’d talk to him. Give it a few days.”

<details><summary>trace</summary>

```
▶ answer.progress.pending = 1.33: times asked +1, irritation +0.33
meaning: answer.progress.pending · flat · toward speaker · private intent: answer.progress.pending
```
</details>

### Day 8: asking again

> **What you can say**
> - “Anything on Nate?”  
>   *Ask whether he’s done it.*
> - Leave

**You:** “Anything on Nate?”
**Vic:** “You’ve asked me twice now. I heard you the first time.”

<details><summary>trace</summary>

```
▶ answer.progress.irritated = 2.87: times asked +2, irritation +0.87
meaning: answer.progress.irritated · weary · toward speaker · private intent: answer.progress.irritated
```
</details>

### Day 9: and again

> **What you can say**
> - “Anything on Nate?”  
>   *Ask whether he’s done it.*
> - Leave

**You:** “Anything on Nate?”
**Vic:** “Don’t come to me about Nate again. When there’s something to tell you, you’ll hear it.”

<details><summary>trace</summary>

```
▶ dismiss.persistence = 4.4: times asked +3, irritation +1.4
meaning: dismiss.persistence · weary · toward speaker · private intent: dismiss.persistence
change: Vic Rizzo's respect for Henry Tedesco falls a little: he was told and kept asking
```
</details>

### Day 11: word from Rizzo, and Nate
*Rizzo has spoken to Marchese, and Marchese to Lou. Henry learns it the way he would: Rizzo sends word with one of his men.*

> *A message from Rizzo:* “It’s done. Joe spoke to him. Lou stays away from Nate.”

**Nate:** “Lou’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 2.28: he has seen Lou’s people stay away +1, days since you promised +1, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “I took it to the family. He won’t bother you again.”  
>   *Tell him you took it to the family.*
> - Leave

**You:** “I took it to the family. He won’t bother you again.”
**Nate:** “I won’t forget it. Anything you need here, you ask.”

<details><summary>trace</summary>

```
▶ done = 1: he believes what you said +1
meaning: thanks.kept · warm · toward speaker · private intent: done
change: Nate Ferrara's trust in Henry Tedesco rises (a promise kept, as he sees it: Lou stopped, and Henry says he took it to the family)
change: A favour is owed to Henry (encounters.addFavour)
```
</details>

> **Outcome:** Nate says his trouble with Lou is over. He thanks you.

## 6. Unfamiliar ground: asking a man you barely know for a loan

*Not one of the worked examples. The same engine: what he can’t do, what each answer is worth to him from what he believes of Henry, a reason, and replies to that reason. Lines come from the general banks where no specific one exists.*

### Tony Fiore, a soldier Henry has met once

> **What you can say**
> - “I need $500. I’ll pay the usual.”  
>   *Ask him for money, on the usual terms.*
> - “You hear what happened at the Gilded Lily?”  
>   *Tell him what happened at the Gilded Lily.*
> - Leave

**You:** “I need $500. I’ll pay the usual.”
**Tony:** “I don’t know you well enough for that.”

<details><summary>trace</summary>

```
▶ refuse = 0.45: the risk +0.42, caution +0.02, he hasn’t got it +0
  counter = 0.2: a smaller sum, a smaller risk +0.09, he would rather deal than refuse +0.12
  accept = 0.03: what it earns him +0.4, the chance he never sees it again -0.47, greed +0.1
reason given: doesNotKnow
meaning: refuse.loan.doesNotKnow · flat · toward speaker · private intent: refuse
```
</details>


> **What you can say**
> - “I’m good for it. Ask anyone.”  
>   *Stand on your name. It counts for what he’s heard of you.*
> - “Make it 8 percent a week, then.”  
>   *Pay more for the money.*
> - “You’ll have it back by the end of the month. My word.”  
>   *Give him your word on when. He’ll hold you to it.*
> - Leave

**You:** “I’m good for it. Ask anyone.”
**Tony:** “Everybody’s good for it, until they’re not. I don’t know you.”

<details><summary>trace</summary>

```
▶ refuse = 0.38: the risk +0.35, caution +0.02, he hasn’t got it +0
  counter = 0.24: a smaller sum, a smaller risk +0.13, he would rather deal than refuse +0.12
  accept = 0.11: what it earns him +0.4, the chance he never sees it again -0.39, greed +0.1
reason given: wordNotEnough
meaning: refuse.loan.wordNotEnough · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Make it 8 percent a week, then.”  
>   *Pay more for the money.*
> - “You’ll have it back by the end of the month. My word.”  
>   *Give him your word on when. He’ll hold you to it.*
> - Leave

**You:** “Make it 8 percent a week, then.”
**Tony:** “I can do $300. 10 percent a week, and I want it on time.”

<details><summary>trace</summary>

```
▶ counter = 0.43: a smaller sum, a smaller risk +0.32, he would rather deal than refuse +0.12
  refuse = 0.38: the risk +0.35, caution +0.02, he hasn’t got it +0
  accept = 0.35: what it earns him +0.64, the chance he never sees it again -0.39, greed +0.1
reason given: risk
meaning: counter.loan.risk · flat · toward request · private intent: counter
```
</details>


> **What you can say**
> - “$300 at 10. Done.”  
>   *Take what he offers, on his terms.*
> - “You’ll have it back by the end of the month. My word.”  
>   *Give him your word on when. He’ll hold you to it.*
> - Leave

**You:** “$300 at 10. Done.”
> **Outcome:** Agreed: Tony lends you $300 at 10 percent a week. He says he wants it on time.

### The same man, told something he hasn’t heard

> **What you can say**
> - “You hear what happened at the Gilded Lily?”  
>   *Tell him what happened at the Gilded Lily.*
> - Leave

**You:** “You hear what happened at the Gilded Lily?”
**Tony:** “First I’ve heard of it.”

<details><summary>trace</summary>

```
▶ answer = 1.15: he has not heard of it +1, curiosity (sociability) +0.15
meaning: answer.unknownTopic · flat · toward third · private intent: answer
change: Tony Fiore now knows what Henry told him: the window at the Gilded Lily (from Henry Tedesco; he may repeat it)
```
</details>
