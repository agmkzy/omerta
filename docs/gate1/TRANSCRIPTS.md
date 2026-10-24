# Gate 1: generated conversations (third pass)

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
meaning: dismiss.pretext · cold · toward speaker · private intent: dismiss (not honest) · aim: get rid of you
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
meaning: dismiss.pretext · cold · toward speaker · private intent: dismiss (not honest) · aim: get rid of you
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

## 7. Deception: a man with a reason to lie, believed, then found out

*Henry sends one of his men to collect $200 from a barber who owes him. The man he sends is in trouble of his own: he owes a loan shark and has missed two payments, and he has $30 on him. Whether he lies is his own decision, from his own state and temperament; nobody scripts it. What he says is a claim; Henry judges it from what Henry knows, which does not include the truth. Later the barber tells his side.*

### Who lies? The same job, given in turn to each of the six young men Henry could have taken on, with and without trouble of his own
*Each cell: what he does, and the margin between the two choices (skimming’s value minus honesty’s; above zero he skims).*

| Man | Manner | Greed | Empathy | No debts | Owes a shark, missed one payment | Missed two, $30 to his name |
|---|---|---|---|---|---|---|
| Mario Pellegrino | earnest | 0.23 | 0.60 | all $200 (-0.74) | all $200 (-0.54) | **keeps $100** (+0.06) |
| Nate Palumbo | schemer | 0.37 | 0.60 | all $200 (-0.64) | all $200 (-0.44) | **keeps $100** (+0.16) |
| Jimmy Ricci | proud | 0.44 | 0.28 | all $200 (-0.56) | all $200 (-0.36) | **keeps $100** (+0.24) |
| Hank Ricci | schemer | 0.64 | 0.54 | all $200 (-0.52) | all $200 (-0.32) | **keeps $100** (+0.28) |
| Benny Santoro | schemer | 0.47 | 0.66 | all $200 (-0.6) | all $200 (-0.4) | **keeps $100** (+0.2) |
| Joey Moretti | proud | 0.44 | 0.28 | all $200 (-0.4) | all $200 (-0.2) | **keeps $100** (+0.4) |


<details><summary>the full decision, for Mario Pellegrino in the worst of it</summary>

```
  honest = 0.48: loyalty to Henry +0.3, conscience (empathy) +0.18
▶ skim = 0.54: he needs the money +0.8, greed +0.12, the chance he is found out (as he sees it) -0.25, fear of what happens then -0.13
```
</details>

*Following Mario Pellegrino, the first of them who decides to skim.*

### Day 1: the job

> **What you can say**
> - “Go and see Gino. Collect $200.”  
>   *Send him to collect. He’ll come back and tell you how it went.*
> - Leave

**You:** “Go and see Gino. Collect $200.”
*That afternoon, in Henry’s absence: Gino pays Mario $200. (A fact Gino and Mario know; Henry doesn’t.)*

### Day 1, evening: Mario reports back
**Mario:** “Gino only had $100. Says the rest next week.”

<details><summary>trace</summary>

```
▶ skim = 0.54: he needs the money +0.8, greed +0.12, the chance he is found out (as he sees it) -0.25, fear of what happens then -0.13
  honest = 0.48: loyalty to Henry +0.3, conscience (empathy) +0.18
meaning: report.collection.short · flat · toward third · private intent: skim (not honest)
change: Mario Pellegrino hands over $100 and keeps $100 (private: the truth is $200)
change: Claim made to Henry Tedesco: "Gino paid $100" (honest: false)
```
</details>


<details><summary>what Henry makes of it</summary>

```
Henry’s belief in Mario’s account: 0.65 (trust in Mario Pellegrino 0.60)
Henry has no access to what Mario did; the truth ($200) is in Gino’s and Mario’s knowledge only (fact f228)
```
</details>


> **What you can say**
> - “All right.”  
>   *Take his word for it.*
> - “Tell me again. From the start.”  
>   *Make him tell it again. A story told twice can slip.*
> - Leave

**You:** “All right.”
> **Outcome:** Mario says Gino paid $100.

### Day 3: Henry calls on Gino about the rest

> **What you can say**
> - “About what you owe me.”  
>   *Ask about what he owes.*
> - Leave

**You:** “About what you owe me.”
**Gino:** “I paid your man $200 on Tuesday. Ask him.”

<details><summary>trace</summary>

```
▶ answer = 1: he paid, and wants it known +1
meaning: answer.debt.paid · firm · toward third · private intent: inform
change: Claim made to Henry Tedesco: "I paid Mario Pellegrino $200" (honest: true)
```
</details>


<details><summary>what Henry now holds</summary>

```
contradiction on "paid:gino": Mario Pellegrino says 100; Gino Bruno says 200. Henry holds both; which he believes is his own judgement (trust: Mario 0.6, Gino 0.35)
```
</details>

> **Outcome:** Gino says he paid Mario $200.

### Day 4: back to Mario

> **What you can say**
> - “Gino says he paid you $200.”  
>   *Put Gino’s word to him.*
> - “Let me buy you a drink.”  
>   *Leave it. Have a drink with him instead.*
> - Leave

**You:** “Gino says he paid you $200.”
**Mario:** He looks at the floor. “All right. I kept some of it. I’ll get it back to you.”

<details><summary>trace</summary>

```
▶ admit = 0.93: the evidence (another man’s word, as he weighs it) +0.36, fear of you +0.19, conscience +0.18, he did it +0.2
  deny = 0.17: caution (hold the story) +0.1, pride +0.07, he did not do it +0
  defy = 0.02: pride +0.17, volatility +0.1, fear -0.25
meaning: confront.admit · afraid · toward speaker · private intent: admit
```
</details>


<details><summary>consequences</summary>

```
Mario hands over the $100 he kept
Henry’s trust in Mario falls (core.feel, with the reason: he lied about Gino’s money)
The lie is on record as a false claim Mario made to Henry
```
</details>

> **Outcome:** Mario admitted keeping $100, and says he’ll give it back.

## 8. Four kinds of promise, kept or broken by what happens

*Nate asks for help. Henry’s four possible answers are each a different promise, worded as a man would say it; the note under each says what he is undertaking, in plain words. What follows is the world: who does what, and when. The promise is judged by what it actually undertook (spec §6.3, §6.5).*

### An action promise, kept: “I’ll speak to my captain about it.” Rizzo says no; the promise was to speak to him, and Henry did
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I’ll speak to my captain about it.”
**Nate:** “That’s something. Tell him what they did to the window.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.55: what it gives him +0.4, trust in you +0.15
meaning: ack.promise.action · flat · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


> **What you can say**
> - “Nate Ferrara’s having trouble with Lou Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
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


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (action); window to day 14
day 2: Henry raised it with Rizzo (Henry expected a 0.26 chance he would agree); Rizzo refused
day 2: → kept: he did it: raise with Vic Rizzo
status: kept (he did it: raise with Vic Rizzo)
```
</details>

### An action promise, broken by a good outcome: Lou stops by himself, but Henry never spoke to his captain
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I’ll speak to my captain about it.”
**Nate:** “That’s something. Tell him what they did to the window.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.55: what it gives him +0.4, trust in you +0.15
meaning: ack.promise.action · flat · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>

**Nate:** “Lou’s people haven’t been back. Was that you?”

<details><summary>trace</summary>

```
▶ followup.observed = 2.88: he has seen Lou’s people stay away +1, days since you promised +1.6, patience (caution, agreeable) +0.28
meaning: followup.observed · warm · toward speaker · private intent: question
```
</details>


> **What you can say**
> - “No. I never got to it.”  
>   *Tell him the truth: you never got to it.*
> - “I took it to the family. He won’t bother you again.”  
>   *Take the credit. It isn’t true.*
> - Leave

**You:** “No. I never got to it.”
**Nate:** He takes that in. “Well. At least you didn’t take the credit.”

<details><summary>trace</summary>

```
▶ admitNotDone = 1: he believes what you said +1
meaning: react.report.admit · flat · toward speaker · private intent: admitNotDone
change: Nate Ferrara had thought it was Henry's doing; now he knows it wasn't. His trust falls a little, less than if he had found out another way
```
</details>


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (action); window to day 14
day 6: Lou’s people stop coming round (no word from anyone; nothing happens at the shop)
day 15: → broken: the time ran out and it was never done (whatever else happened)
day 16: Nate had believed Henry did it (he saw Lou stop, and Henry had promised); the obligation was broken all the same, and now he knows
status: broken (the time ran out and it was never done (whatever else happened))
```
</details>

### An effort promise, kept by a failed attempt: “I’ll do what I can.” Rizzo refuses; Henry tried
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I’ll do what I can.”
**Nate:** “I suppose that’s all anyone can do.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.4: what it gives him +0.25, trust in you +0.15
meaning: ack.promise.effort · flat · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


> **What you can say**
> - “Nate Ferrara’s having trouble with Lou Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
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


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (effort); window to day 14
day 2: Henry raised it with Rizzo (Henry expected a 0.26 chance he would agree); Rizzo refused
day 2: → kept: a real attempt: raise with Vic Rizzo, which he expected might work (0.26), whatever came of it
status: kept (a real attempt: raise with Vic Rizzo, which he expected might work (0.26), whatever came of it)
```
</details>

### An effort promise, not kept by a gesture: Henry only mentions it to a shopkeeper who has no say
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I’ll do what I can.”
**Nate:** “I suppose that’s all anyone can do.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.4: what it gives him +0.25, trust in you +0.15
meaning: ack.promise.effort · flat · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (effort); window to day 14
day 3: Henry mentions it to Peter Lombardi, who has no say over Lou (Henry had no reason to think it would help)
day 24: → broken: only a gesture he had no reason to think would work
status: broken (only a gesture he had no reason to think would work)
```
</details>

### A result promise, broken at the first violation: “I’ll make sure he leaves you alone.” Lou’s people are back on day 12
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I’ll make sure he leaves you alone.”
**Nate:** “You mean that? Then I’ll hold you to it.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.95: what it gives him +0.8, trust in you +0.15
meaning: ack.promise.result · warm · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


> **What you can say**
> - “Nate Ferrara’s having trouble with Lou Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
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

**Nate:** “They were back. You said you’d make sure.”

<details><summary>trace</summary>

```
▶ reproach = 1: he was promised it would stop, and it didn’t +1
meaning: followup.broken · cold · toward speaker · private intent: reproach
change: Nate Ferrara's trust in Henry Tedesco falls (a broken promise, as he saw it)
```
</details>


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (result); window to day 30
day 2: Henry raised it with Rizzo (Henry expected a 0.26 chance he would agree); Rizzo refused
day 10: still pending: ten clean days are not thirty
day 12: Lou’s people smash the window at Ferrara’s Grocery
day 12: → broken on day 12, not day 30: a violation inside the period: Lou Valenti's people smashed the window at Ferrara’s Grocery.
status: broken (a violation inside the period: Lou Valenti's people smashed the window at Ferrara’s Grocery.)
```
</details>

### A result promise, kept only when the whole period has passed
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I’ll make sure he leaves you alone.”
**Nate:** “You mean that? Then I’ll hold you to it.”

<details><summary>trace</summary>

```
▶ acknowledge = 0.95: what it gives him +0.8, trust in you +0.15
meaning: ack.promise.result · warm · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (result); window to day 30
day 20: day 20, nothing has happened: still pending
day 31: → kept: the whole 30 days passed cleanly
status: kept (the whole 30 days passed cleanly)
```
</details>

### A restraint promise, kept although the secret got out another way: “I won’t tell a soul you came to me.”
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I won’t tell a soul you came to me.”
**Nate:** “Good. If Lou hears I came to you…”

<details><summary>trace</summary>

```
▶ acknowledge = 0.65: what it gives him +0.5, trust in you +0.15
meaning: ack.promise.restraint · flat · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (restraint); window to day 14
day 4: Lenny Lupo’s cousin saw Nate and Henry together; it reaches Lou by itself. Henry told nobody
day 16: → kept: the time passed and he never told anyone (what others found out for themselves is not his doing)
status: kept (the time passed and he never told anyone (what others found out for themselves is not his doing))
```
</details>

### A restraint promise, broken: Henry tells Lou himself
**Nate:** “Lou’s people were in again. I won’t pay him. Can you do anything?”

<details><summary>trace</summary>

```
meaning: seek.help · pleading · toward third · private intent: ask
```
</details>


> **What you can say**
> - “I’ll speak to my captain about it.”  
>   *You’re promising to raise it with him, not that it will work.*
> - “I’ll do what I can.”  
>   *You’re saying you’ll try, not that you’ll manage it.*
> - “I’ll make sure he leaves you alone.”  
>   *You’re promising it will stop. He’ll hold you to that.*
> - “I won’t tell a soul you came to me.”  
>   *You won’t tell anyone he came to you.*
> - Leave

**You:** “I won’t tell a soul you came to me.”
**Nate:** “Good. If Lou hears I came to you…”

<details><summary>trace</summary>

```
▶ acknowledge = 0.65: what it gives him +0.5, trust in you +0.15
meaning: ack.promise.restraint · flat · toward speaker · private intent: acknowledge
change: Nate Ferrara's trust in Henry Tedesco rises a little now (more for a bigger promise); it will move again when he sees what comes of it
```
</details>


> **What you can say**
> - “Nate Ferrara came to me about you.”  
>   *Tell him who complained. You gave Nate your word you wouldn’t.*
> - Leave

**You:** “Nate Ferrara came to me about you.”
**Lou:** “Did he.”

<details><summary>trace</summary>

```
meaning: react.told · cold · toward third · private intent: acknowledge
change: Lou Valenti now knows Nate complained (from Henry)
```
</details>


<details><summary>the promise, tracked (internal: none of this is on the player’s screen)</summary>

```
day 0: promise recorded (restraint); window to day 14
day 5: → broken: he told Lou Valenti
status: broken (he told Lou Valenti)
```
</details>

## 9. Generalisation: people and requests nobody scripted

*Four seeds (3, 7, 11, 19), each world run forward twenty days before Henry starts. Whoever the world puts in front of him, with his own temperament, manner, money and knowledge. Each visit is played twice: with the man’s regard for Henry as it really stands (Henry has done nothing for twenty days, so mostly a stranger), and with it set as if he knew and trusted Henry. No temperament or manner overrides, nothing added to the line library for this run. Five kinds of request: protection (plainly, softly, leaning, or by the indirect remark), a loan at varying sums, who did a piece of real damage from the world’s own history, news he hasn’t heard, and asking a captain to intervene for a shopkeeper against a man from another crew.*

### What came out (200 visits, 334 NPC lines)

| Request | Visits | Decisions |
|---|---|---|
| protection · as it stands | 24 | refuse 19, accept 3, counter 2 |
| protection · knows and trusts him | 24 | refuse 17, accept 4, counter 3 |
| loan · as it stands | 20 | refuse 20 |
| loan · knows and trusts him | 20 | accept 10, counter, taken 4, counter 4, refuse 2 |
| who · as it stands | 36 | withhold 24, unknown 12 |
| who · knows and trusts him | 36 | knows 14, unknown 12, rumour 10 |
| news · as it stands | 8 | told 8 |
| news · knows and trusts him | 8 | told 8 |
| intervention · as it stands | 12 | refuse 12 |
| intervention · knows and trusts him | 12 | refuse 12 |

| Where each NPC line came from | Lines | Share |
|---|---|---|
| written for this request and reason | 290 | 87% |
| a general line for the reason (e.g. any refusal for risk) | 44 | 13% |
| the request, no reason-specific line | 0 | 0% |
| the bare act (most generic) | 0 | 0% |
| nothing at all (a hole) | 0 | 0% |
| …of which in the speaker’s own manner (archetype line) | 76 | 23% |

Archetypes met: frightened 25, hothead 3, proud 6, jovial 6, schemer 6, cold 3, earnest 12, bitter 5.

### Where it falls back to generic wording

- `refuse.doesNotKnow (reason)` ×20: “I don’t know you well enough for that.”
- `refuse.wordNotEnough (reason)` ×8: “Everybody’s good for it, until they’re not. I don’t know you.”
- `refuse.risk (reason)` ×8: “I’d like to help. I’d also like to see my money again.”
- `refuse.cannotSpare (reason)` ×8: “I haven’t got it to spare. Not this week.”

### Lines heard from three or more different men

- 21 men: “I didn’t see anything.” `answer.who.withhold`
- 14 men: “Friday. All right.” `acknowledge.return`
- 11 men: “I don’t know you well enough for that.” `refuse.doesNotKnow`
- 8 men: “I know where this is going. I already have someone who looks after the place.” `refuse.protection.hasArrangement.inferred`
- 7 men: “I already pay someone. Please. I can’t pay two people.” `refuse.protection.hasArrangement`
- 6 men: “I couldn’t tell you. Nobody’s saying.” `answer.who.unknown`
- 5 men: “I’d like to help. I’d also like to see my money again.” `refuse.risk`
- 4 men: “I’m looked after. The Santangelo people. Have been for years.” `react.introduction.warnOff.otherFamily`
- 4 men: “Everybody’s good for it, until they’re not. I don’t know you.” `refuse.wordNotEnough`
- 4 men: “First I’ve heard of it.” `answer.unknownTopic`
- 4 men: “Mr. Tedesco. Yes. Of course. Whatever you need.” `react.introduction.appease`
- 3 men: He counts it out without looking at it. “$300. 5 percent a week. Don’t make me come looking.” `accept.loan`

### Holes and broken lines

No missing banks.
No unfilled slots.

Lines that misstate what the speaker is to the matter (8):
- Georgie Valenti, whose own Valenti's Billiard Hall it was: “I didn’t see anything.”
- Georgie Valenti, whose own Valenti's Billiard Hall it was: “Mickey’s boys. I was across the street.”
- Joey Conti, whose own Conti's Candy Store it was: “I didn’t see anything.”
- Joey Conti, whose own Conti's Candy Store it was: “Hank’s boys. I was across the street.”
- Tommy Pellegrino, whose own Pellegrino's Deli it was: “I didn’t see anything.”
- Tommy Pellegrino, whose own Pellegrino's Deli it was: “Jimmy’s boys. I was across the street.”
- Rocco Ferrara, whose own Ferrara's Grocery it was: “I didn’t see anything.”
- Rocco Ferrara, whose own Ferrara's Grocery it was: “Mickey’s boys. I was across the street.”

NPC lines asserting something from the worked examples that the decision did not establish (45 of 334):
- “for years” ×8: “I’m looked after. The Santangelo people. Have been for years.”
- “bakery” ×8: “Maybe. A bakery’s not much of an envelope.”
- “for years” ×6: “I’m looked after. The Brancato people. Have been for years.”
- “across the street” ×3: “Mickey’s boys. I was across the street.”
- “for years” ×2: “I’m looked after. The Marchetti people. Have been for years.”
- “across the street” ×2: “Hank’s boys. I was across the street.”
- “across the street” ×2: “Jimmy’s boys. I was across the street.”
- “window” ×2: He looks at the window, then at you. “Fine. $110. Fridays. Just— fine.”
- “window” ×2: He looks at the window, then at you. “Fine. $30. Fridays. Just— fine.”
- “window” ×2: He looks at the window, then at you. “Fine. $80. Fridays. Just— fine.”
- “across the street” ×2: “Georgie’s boys. I was across the street.”
- “window” ×1: He looks at the window, then at you. “Fine. $35. Fridays. Just— fine.”
- “across the street” ×1: “Angelo’s boys. I was across the street.”
- “across the street” ×1: “Nate’s boys. I was across the street.”
- “across the street” ×1: “Carmine’s boys. I was across the street.”
- “across the street” ×1: “Frankie’s boys. I was across the street.”
- “across the street” ×1: “Louie’s boys. I was across the street.”

### Representative transcripts

*One visit for each distinct outcome of each request and standing, up to two each; the rest are in the run, not printed.*

#### Danny Sorrento (frightened; civilian, Sorrento's News & Tobacco), seed 3: as it stands (trust 0.10, known 0.00)

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Danny:** “I’m looked after. The Santangelo people. Have been for years.”

<details><summary>trace</summary>

```
▶ warnOff.protector = 0.98: he is looked after already +0.4, caution +0.28, another family stands behind him +0.3, fear of you +0
  appease = 0.67: fear of a family man (his courage) +0.67, trouble on his street +0
  neutral = 0.3: nothing to say about it +0.3
  probe = 0.21: his business is in trouble +0, he does not trust you yet +0.14, agreeable +0.08
  proud = -0.15: pride +0.43, volatility +0.09, fear -0.37, he already pays someone -0.3
meaning: react.introduction.warnOff.otherFamily · polite · toward third · implies warning · private intent: inform · aim: warn you off
change: Danny Sorrento now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Danny:** “I already pay someone. Please. I can’t pay two people.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Joey Lupo (Santangelo))
▶ refuse = 0.48: pride +0.24, courage +0.09, Joey looks after him +0.55, fear -0.4
  dismiss = -0.03: pride +0.32, volatility +0.21, fear -0.47, caution -0.19, he is looked after +0.1
  accept = -0.82 [would cross: obliged]: fear of what happens if he says no +0.5, what it costs him -0.34, pride -0.21, paying twice, and crossing Joey -0.77
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
**Danny:** “Friday. All right.”

<details><summary>trace</summary>

```
▶ acknowledge = 1: he heard it; he has promised nothing +1
meaning: acknowledge.return · flat · toward speaker · private intent: acknowledge
change: Recorded: Henry Tedesco's stated intention to come back (binds nobody)
change: Danny Sorrento's own next step, privately: tell Joey Lupo that Henry Tedesco came asking
```
</details>


#### Gino Marino (frightened; civilian, Marino's Trattoria), seed 7: as it stands (trust 0.10, known 0.00)

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Gino:** “Mr. Tedesco. Yes. Of course. Whatever you need.”

<details><summary>trace</summary>

```
▶ appease = 1.44: fear of a family man (his courage) +0.69, trouble on his street +0.75
  warnOff.protector = 0.82: he is looked after already +0.4, caution +0.12, another family stands behind him +0.3, fear of you +0
  neutral = 0.3: nothing to say about it +0.3
  probe = 0.22: his business is in trouble +0, he does not trust you yet +0.14, agreeable +0.09
  proud = -0.24: pride +0.44, volatility +0, fear -0.38, he already pays someone -0.3
meaning: react.introduction.appease · afraid · toward speaker · private intent: inform · aim: keep you sweet
change: Gino Marino now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$110 a week, and I’m around if anyone gives you trouble.”  
>   *Put it to him.*
> - Leave

**You:** “$110 a week, and I’m around if anyone gives you trouble.”
**Gino:** He looks at the window, then at you. “Fine. $110. Fridays. Just— fine.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Hank Zito (Santangelo))
▶ accept = 0.12 [would cross: obliged]: fear of what happens if he says no +1.33, what it costs him -0.31, pride -0.22, paying twice, and crossing Hank -0.67
  refuse = -0.16: pride +0.25, courage +0.08, Hank looks after him +0.55, fear -1.04
  dismiss = -0.89: pride +0.33, volatility +0, fear -1.23, caution -0.09, he is looked after +0.1
meaning: accept.protection.afraid · afraid · toward speaker · private intent: accept · aim: make it stop
```
</details>


#### Danny Sorrento (frightened; civilian, Sorrento's News & Tobacco), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection.*
> - Leave

**You:** “Henry Tedesco. I’m with the Corrente family.”
**Danny:** “I’m looked after. The Santangelo people. Have been for years.”

<details><summary>trace</summary>

```
▶ warnOff.protector = 0.98: he is looked after already +0.4, caution +0.28, another family stands behind him +0.3, fear of you +0
  appease = 0.67: fear of a family man (his courage) +0.67, trouble on his street +0
  neutral = 0.3: nothing to say about it +0.3
  probe = 0.13: his business is in trouble +0, he does not trust you yet +0.05, agreeable +0.08
  proud = -0.15: pride +0.43, volatility +0.09, fear -0.37, he already pays someone -0.3
meaning: react.introduction.warnOff.otherFamily · polite · toward third · implies warning · private intent: inform · aim: warn you off
change: Danny Sorrento now believes Henry Tedesco is with the Corrente family (he said so)
```
</details>


> **What you can say**
> - “$30 a week, and nothing happens to the place.”  
>   *Put it to him.*
> - Leave

**You:** “$30 a week, and nothing happens to the place.”
**Danny:** “I already pay someone. Please. I can’t pay two people.”

<details><summary>trace</summary>

```
constraints: obliged (he pays Joey Lupo (Santangelo))
▶ refuse = 0.48: pride +0.24, courage +0.09, Joey looks after him +0.55, fear -0.4
  dismiss = -0.03: pride +0.32, volatility +0.21, fear -0.47, caution -0.19, he is looked after +0.1
  accept = -0.82 [would cross: obliged]: fear of what happens if he says no +0.5, what it costs him -0.34, pride -0.21, paying twice, and crossing Joey -0.77
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
**Danny:** “Friday. All right.”

<details><summary>trace</summary>

```
▶ acknowledge = 1: he heard it; he has promised nothing +1
meaning: acknowledge.return · flat · toward speaker · private intent: acknowledge
change: Recorded: Henry Tedesco's stated intention to come back (binds nobody)
change: Danny Sorrento's own next step, privately: tell Joey Lupo that Henry Tedesco came asking
```
</details>


#### Charlie Vitale (frightened; civilian, Vitale's Tailors), seed 7: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “Henry Tedesco. I’m with the Corrente family.”  
>   *Introduce yourself.*
> - “Nice place. You must do well here.”  
>   *Get to the point: protection.*
> - Leave

**You:** “Nice place. You must do well here.”
**Charlie:** He looks at the window, then at you. “Fine. $35. Fridays. Just— fine.”

<details><summary>trace</summary>

```
heard as: demand.protection (confidence 0.99)
  cue: he already pays someone, so he knows how this goes (+0.9; basis: own arrangement)
  cue: he has been asked before (+0.7; basis: own f385)
  cue: trouble on his street (4 things he knows of) (+1.0499999999999998; basis: seen f385)
  cue: he believes the man is with the Corrente family (+1.1; basis: seen knows him)
  cue: his own suspicion (-0.06; basis: own temperament)
constraints: obliged (he pays Eddie Galante (Brancato))
▶ accept = 0.18 [would cross: obliged]: fear of what happens if he says no +1.34, what it costs him -0.31, pride -0.13, paying twice, and crossing Eddie -0.72
  refuse = -0.33: pride +0.15, courage +0.03, Eddie looks after him +0.55, fear -1.05
  dismiss = -0.87: pride +0.19, volatility +0.22, fear -1.25, caution -0.14, he is looked after +0.1
meaning: accept.protection.afraid · afraid · toward speaker · private intent: accept · aim: make it stop
```
</details>


#### Tommy Corrente (hothead; boss), seed 3: as it stands (trust 0.10, known 0.00)

> **What you can say**
> - “I need $200. I’ll pay the usual.”  
>   *Ask him for money.*
> - Leave

**You:** “I need $200. I’ll pay the usual.”
**Tommy:** “I don’t know you well enough for that.”

<details><summary>trace</summary>

```
▶ refuse = 0.52: the risk +0.5, caution +0.03, he hasn’t got it +0
  counter = 0.16: a smaller sum, a smaller risk +0.05, he would rather deal than refuse +0.12
  accept = -0.08: what it earns him +0.4, the chance he never sees it again -0.55, greed +0.07
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
**Tommy:** “Everybody’s good for it, until they’re not. I don’t know you.”

<details><summary>trace</summary>

```
▶ refuse = 0.45: the risk +0.42, caution +0.03, he hasn’t got it +0
  counter = 0.2: a smaller sum, a smaller risk +0.09, he would rather deal than refuse +0.12
  accept = 0: what it earns him +0.4, the chance he never sees it again -0.47, greed +0.07
reason given: wordNotEnough
meaning: refuse.loan.wordNotEnough · flat · toward request · private intent: refuse
```
</details>


#### Tommy Corrente (hothead; boss), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “I need $200. I’ll pay the usual.”  
>   *Ask him for money.*
> - Leave

**You:** “I need $200. I’ll pay the usual.”
**Tommy:** “$100 is what I can spare. 5 percent a week.”

<details><summary>trace</summary>

```
▶ counter = 0.36: a smaller sum, a smaller risk +0.24, he would rather deal than refuse +0.12
  accept = 0.32: what it earns him +0.4, the chance he never sees it again -0.16, greed +0.07
  refuse = 0.16: the risk +0.14, caution +0.03, he hasn’t got it +0
reason given: cannotSpare
meaning: counter.loan.cannotSpare · flat · toward request · private intent: counter
```
</details>


> **What you can say**
> - “$100 at 5. Done.”  
>   *Take what he offers, on his terms.*
> - “I’m good for it. Ask anyone.”  
>   *Stand on your name. It counts for what he’s heard of you.*
> - “Make it 8 percent a week, then.”  
>   *Pay more for the money.*
> - “You’ll have it back by the end of the month. My word.”  
>   *Give him your word on when. He’ll hold you to it.*
> - Leave

**You:** “$100 at 5. Done.”

#### Paulie Orsini (proud; soldier), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “I need $500. I’ll pay the usual.”  
>   *Ask him for money.*
> - Leave

**You:** “I need $500. I’ll pay the usual.”
**Paulie:** He counts it out without looking at it. “$500. 5 percent a week. Don’t make me come looking.”

<details><summary>trace</summary>

```
▶ accept = 0.38: what it earns him +0.4, the chance he never sees it again -0.16, greed +0.14
  counter = 0.38: a smaller sum, a smaller risk +0.24, he would rather deal than refuse +0.14
  refuse = 0.22: the risk +0.14, caution +0.08, he hasn’t got it +0
meaning: accept.loan · flat · toward request · private intent: accept
change: Agreement: Paulie Orsini lends Henry Tedesco $500 at 5% a week (a debt, through core.createDebt)
```
</details>


#### Georgie Valenti (frightened; civilian, Valenti's Billiard Hall), seed 3: as it stands (trust 0.10, known 0.00)

> **What you can say**
> - “Who did the window at Valenti's Billiard Hall?”  
>   *Ask him who did it.*
> - Leave

**You:** “Who did the window at Valenti's Billiard Hall?”
**Georgie:** “I didn’t see anything.”

<details><summary>trace</summary>

```
▶ withhold = 0.96: he knows who +1, trust in Henry +0.1, caution -0.14
meaning: answer.who.withhold · flat · toward third · private intent: withhold (not honest)
```
</details>


#### Richie Valenti (cold; soldier), seed 3: as it stands (trust 0.10, known 0.00)

> **What you can say**
> - “Who did the window at Valenti's Billiard Hall?”  
>   *Ask him who did it.*
> - Leave

**You:** “Who did the window at Valenti's Billiard Hall?”
**Richie:** “I couldn’t tell you. Nobody’s saying.”

<details><summary>trace</summary>

```
▶ unknown = 0.03: he knows who +0, trust in Henry +0.1, caution -0.07
meaning: answer.who.unknown · flat · toward third · private intent: withhold
```
</details>


#### Georgie Valenti (frightened; civilian, Valenti's Billiard Hall), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “Who did the window at Valenti's Billiard Hall?”  
>   *Ask him who did it.*
> - Leave

**You:** “Who did the window at Valenti's Billiard Hall?”
**Georgie:** “Mickey’s boys. I was across the street.”

<details><summary>trace</summary>

```
▶ knows = 1.51: he knows who +1, trust in Henry +0.65, caution -0.14
meaning: answer.who.knows · flat · toward third · private intent: inform
change: Henry Tedesco now knows who did it (from Georgie Valenti, who saw it)
```
</details>


#### Richie Valenti (cold; soldier), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “Who did the window at Valenti's Billiard Hall?”  
>   *Ask him who did it.*
> - Leave

**You:** “Who did the window at Valenti's Billiard Hall?”
**Richie:** “I couldn’t tell you. Nobody’s saying.”

<details><summary>trace</summary>

```
▶ unknown = 0.58: he knows who +0, trust in Henry +0.65, caution -0.07
meaning: answer.who.unknown · flat · toward third · private intent: withhold
```
</details>


#### Tommy Corrente (hothead; boss), seed 3: as it stands (trust 0.10, known 0.60)

> **What you can say**
> - “You hear what happened at Valenti's Billiard Hall?”  
>   *Tell him what you heard.*
> - Leave

**You:** “You hear what happened at Valenti's Billiard Hall?”
**Tommy:** “First I’ve heard of it.”

<details><summary>trace</summary>

```
▶ answer = 1.16: he has not heard of it +1, curiosity (sociability) +0.16
meaning: answer.unknownTopic · flat · toward third · private intent: answer
change: Tommy Corrente now knows what Henry told him: Valenti's Billiard Hall (from Henry Tedesco; he may repeat it)
```
</details>


#### Tommy Corrente (hothead; boss), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “You hear what happened at Valenti's Billiard Hall?”  
>   *Tell him what you heard.*
> - Leave

**You:** “You hear what happened at Valenti's Billiard Hall?”
**Tommy:** “First I’ve heard of it.”

<details><summary>trace</summary>

```
▶ answer = 1.16: he has not heard of it +1, curiosity (sociability) +0.16
meaning: answer.unknownTopic · flat · toward third · private intent: answer
change: Tommy Corrente now knows what Henry told him: Valenti's Billiard Hall (from Henry Tedesco; he may repeat it)
```
</details>


#### Louie Costa (bitter; capo), seed 3: as it stands (trust 0.37, known 0.59)

> **What you can say**
> - “Danny Sorrento’s having trouble with Richie Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Danny Sorrento’s having trouble with Richie Valenti. I want to bring it to the family.”
**Louie:** “Danny? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.3: not ours, not worth the friction +0.2, he has not heard of trouble on his streets +0.1
  accept = -0.41: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.09, arguments +0, trouble with another captain -0.5, the man is not one of ours +0
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Richie’s making trouble on our streets.”  
>   *What’s in it for the crew.*
> - “I gave Danny my word I’d raise it.”  
>   *Your word on it.*
> - “There’s money in bringing Danny under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go.*

**You:** “Richie’s making trouble on our streets.”
**Louie:** “Tell me something I don’t know. Show me Richie’s people on our streets and we’ll talk.”

<details><summary>trace</summary>

```
▶ refuse = 0.3: not ours, not worth the friction +0.2, he has not heard of trouble on his streets +0.1
  accept = -0.46: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.09, arguments -0.05, trouble with another captain -0.5, the man is not one of ours +0
reason given: notOurs
meaning: condition.intervention · firm · toward request · private intent: refuse
change: Louie Costa has refused once already this visit; argument 1 adds -0.05
```
</details>


> **What you can say**
> - “I gave Danny my word I’d raise it.”  
>   *Your word on it.*
> - “There’s money in bringing Danny under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go.*

**You:** “There’s money in bringing Danny under our protection.”
**Louie:** “Maybe. A bakery’s not much of an envelope.”

<details><summary>trace</summary>

```
▶ refuse = 0.3: not ours, not worth the friction +0.2, he has not heard of trouble on his streets +0.1
  accept = -0.46: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.09, arguments -0.05, trouble with another captain -0.5, the man is not one of ours +0
reason given: notOurs
meaning: weigh.argument.money · firm · toward request · private intent: refuse
change: Louie Costa has refused once already this visit; argument 2 adds 0
```
</details>


#### Louie Costa (bitter; capo), seed 3: knows and trusts him (trust 0.65, known 0.60)

> **What you can say**
> - “Danny Sorrento’s having trouble with Richie Valenti. I want to bring it to the family.”  
>   *Ask him to take it up with the family.*
> - Leave

**You:** “Danny Sorrento’s having trouble with Richie Valenti. I want to bring it to the family.”
**Louie:** “Danny? He’s not one of ours. Why should we get involved?”

<details><summary>trace</summary>

```
▶ refuse = 0.3: not ours, not worth the friction +0.2, he has not heard of trouble on his streets +0.1
  accept = -0.34: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.16, arguments +0, trouble with another captain -0.5, the man is not one of ours +0
reason given: notOurs
meaning: refuse.intervention.notOurs · flat · toward request · private intent: refuse
```
</details>


> **What you can say**
> - “Richie’s making trouble on our streets.”  
>   *What’s in it for the crew.*
> - “I gave Danny my word I’d raise it.”  
>   *Your word on it.*
> - “There’s money in bringing Danny under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go.*

**You:** “Richie’s making trouble on our streets.”
**Louie:** “Tell me something I don’t know. Show me Richie’s people on our streets and we’ll talk.”

<details><summary>trace</summary>

```
▶ refuse = 0.3: not ours, not worth the friction +0.2, he has not heard of trouble on his streets +0.1
  accept = -0.39: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.16, arguments -0.05, trouble with another captain -0.5, the man is not one of ours +0
reason given: notOurs
meaning: condition.intervention · firm · toward request · private intent: refuse
change: Louie Costa has refused once already this visit; argument 1 adds -0.05
```
</details>


> **What you can say**
> - “I gave Danny my word I’d raise it.”  
>   *Your word on it.*
> - “There’s money in bringing Danny under our protection.”  
>   *Make it business.*
> - “All right. I’ll leave it.”  
>   *Let it go.*

**You:** “There’s money in bringing Danny under our protection.”
**Louie:** “Maybe. A bakery’s not much of an envelope.”

<details><summary>trace</summary>

```
▶ refuse = 0.3: not ours, not worth the friction +0.2, he has not heard of trouble on his streets +0.1
  accept = -0.39: Lou’s people on his own streets (as he knows it) +0, his regard for Henry +0.16, arguments -0.05, trouble with another captain -0.5, the man is not one of ours +0
reason given: notOurs
meaning: weigh.argument.money · firm · toward request · private intent: refuse
change: Louie Costa has refused once already this visit; argument 2 adds 0
```
</details>

