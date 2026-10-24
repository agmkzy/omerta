# Gate 3: playing the new conversations

*Recorded from the running game (`npm run dev`, the in-app browser), not from a harness. The game was started with `?scenario=dispute`, a developer start on the Scenario G premise:*
- *Henry Tedesco has been into Jimmy DeSantis's bakery a few evenings before the month begins, so they know each other.*
- *On the first morning, Richie Valenti, a soldier in another crew, asks Jimmy for money.*

*Nothing else is set. Who refuses whom, who comes to Henry, what the captains do, and whether anyone goes back to the shop are all the world's own decisions.*

*Henry's choices were made by a short script so that the run could be repeated; everything shown is the screen as the player sees it. Each block is one visit:*
- *the header (name, rank or shop, where, and what he is to Henry);*
- *what he says (under his name);*
- *what Henry says (in quotes);*
- *what Henry could say next.*

*Two runs differ in one thing: whether Henry keeps his word.*

## Run 1: Henry keeps his word

```
### Day 0. Angelo Rizzo, a man in Henry’s crew
Angelo Rizzo
CORRENTE The Barber Shop
You know each other.
ANGELO
“You’re here.”
“What’s new?”
ANGELO
“Same as ever.” He leaves it there.
“Let me buy you a drink.”
You spent the evening at the club with Angelo. He talked about the Yankees, and what has happened to them. He was polite, and a little tired. Another evening; it counts for something.

### Day 3. Henry calls on Jimmy DeSantis
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You know each other.
JIMMY
“Back again.”
“What’s new?”
JIMMY
“Richie wants money off me. I won’t pay him. Can you do anything?”
“I’ll talk to Louie about it.”
JIMMY
“That’s something. Tell him what they’ve been doing.”
“Let me buy you a drink.”
Something else…
Leave

### Day 3. Louie Costa, Henry’s captain
Louie Costa
CORRENTE home in The Bronx
He likes you.
LOUIE
He’s glad to see you, and doesn’t hide it.
“Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
LOUIE
“Jimmy? He’s not one of ours. Why should we get involved?”
“I gave Jimmy my word I’d raise it.”
LOUIE
“Tell me something I don’t know. Show me Richie’s people on our streets and we’ll talk.”
“Richie’s been leaning on Jimmy for money, at DeSantis's Bakery. That’s our ground.”
LOUIE
“All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 6. Someone came looking: Louie Costa sent word he has something to tell you.
Louie Costa
CORRENTE home in Bensonhurst
He likes you.
Louie Costa has come to find you.
LOUIE
“I took it to Johnny. He won’t rein Richie in.”
“Thanks for trying.”
LOUIE
“Don’t mention it.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 7. Henry looks in on Jimmy
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him once before.
JIMMY
“Well? Did you talk to them?”
“I took it to Louie.”
JIMMY
“I won’t forget it. Anything you need here, you ask.”
“I took it to Louie. Their side won’t rein Richie in. I’m sorry.”
JIMMY
He takes it in. “So I’m on my own.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 9. Angelo Rizzo again
Angelo Rizzo
CORRENTE The Barber Shop
You’ve been to see him once before.
ANGELO
He nods you to a chair.
“What’s new?”
ANGELO
“Nothing.” He doesn’t seem inclined to say more.
“Let me buy you a drink.”
Something else…
Leave

### Day 11. Louie Costa again
Louie Costa
CORRENTE The Barber Shop
You’ve been to see him a few times.
LOUIE
He nods you to a chair.
“What’s new?”
LOUIE
“Somebody smashed up Greco's Caffè 6 days ago.”
“Let me buy you a drink.”
Something else…
Leave

### Day 13. Someone came looking: Jimmy DeSantis came by looking for you. He wants a word.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
Jimmy DeSantis has come to find you.
JIMMY
“Richie’s back. I know you tried before. Is there anything else you can do?”
“I’ll do what I can.”
JIMMY
“I suppose that’s all anyone can do.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 13. Henry calls on Jimmy again
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
JIMMY
“Well? Did you talk to them?”
“Not yet. Give me a few days.”
JIMMY
“All right. A few days.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 17. Angelo Rizzo, weeks on
Angelo Rizzo
CORRENTE home in Bensonhurst
You’ve been to see him a few times.
ANGELO
“Sit down.”
“Let me buy you a drink.”
You spent the evening at the club with Angelo. He talked about the price of everything. Nobody said anything that mattered. Another evening; it counts for something.

### Day 20. Someone came looking: Jimmy DeSantis has been asking for you.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
Jimmy DeSantis has come to find you.
JIMMY
“Well? Did you talk to them?”
“Not yet. Give me a few days.”
JIMMY
“A few days.” He nods, but he’s counting.
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 27. Someone came looking: Jimmy DeSantis has been asking for you.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him often.
Jimmy DeSantis has come to find you.
JIMMY
“Richie’s people haven’t been back. Was that you?”
“That wasn’t me. But I’m glad they’ve stopped.”
JIMMY
“Huh.” He thinks about that. “Well. Somebody did.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave
```

## Run 2: Henry promises, never goes, and says he did

```
### Day 0. Henry calls on Jimmy DeSantis, and promises
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You know each other.
JIMMY
“Sit down.”
“What’s new?”
JIMMY
“Richie wants money off me. I won’t pay him. Can you do anything?”
“I’ll talk to Louie about it.”
JIMMY
“That’s something. Tell him what they’ve been doing.”
“Let me buy you a drink.”
Something else…
Leave

### Day 6. Someone came looking: Jimmy DeSantis has been asking for you.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him once before.
Jimmy DeSantis has come to find you.
JIMMY
“Well? Did you talk to them?”
“I took it to Louie.”                         ← the lie (on screen the choice is marked “It isn’t true.”)
JIMMY
“I won’t forget it. Anything you need here, you ask.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 13. Someone came looking: Jimmy DeSantis came by looking for you. He wants a word.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
Jimmy DeSantis has come to find you.
JIMMY
“Richie’s back. I know you tried before. Is there anything else you can do?”
“I’ll talk to Louie about it.”
“I’ll do what I can.”
“I’ll make sure he leaves you alone.”
“I can’t get involved in this.”
Leave
```

*At the end of the month, in Jimmy's own records:*
- *he believes the promise was done, and judges it kept;*
- *his trust in Henry has gone up (0.16).*

*He never found out. Henry's promise was to raise the matter with Louie, and Richie coming back doesn't contradict that. Jimmy keeps the deed he was promised apart from the dispute itself, so he had no reason to check with Louie.*

*The path by which he would find out is real and tested (`autonomy.test.ts`, "a broken promise believed kept earns trust; found out, it costs more"). It is triggered when what he was told and what he sees disagree.*

## What the engine offers that these runs didn't use

From the same scenario, driven headlessly through the same engine the screen draws. These are the "Something else…" lists:

```
at the captain:  “I need $500. I’ll pay the usual.” | “Who does Richie answer to?” | “You hear what happened at DeSantis's Bakery?” | “What’s new?” | “Let me buy you a drink.” | Never mind | Leave
at a shop:       “$55 a week, and nothing happens to the place.” | “Who does Richie answer to?” | “You hear what happened at DeSantis's Bakery?” | “What’s new?” | “Let me buy you a drink.” | Never mind | Leave
at a crew man:   “I need $500. I’ll pay the usual.” | “Who does Richie answer to?” | “You hear what happened at DeSantis's Bakery?” | “What’s new?” | “Let me buy you a drink.” | Never mind | Leave
  MARTY: “There he is! Sit, sit.”
  YOU: “Who does Richie answer to?”
  MARTY: “I couldn’t tell you. Nobody’s saying.”
```
