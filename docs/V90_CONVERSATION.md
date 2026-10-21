# V90: Conversation Overhaul — audit and design

## 1. Audit: what the conversation is today

The conversation has grown in layers, each sensible on its own, never reconciled:

| Layer | Where | What it adds |
|---|---|---|
| V76 action list | `dialogue.ts optionsRaw` | ~150 option codes across 13 sub-menus (`personal`, `business`, `family`, `disputes`, `orders`, `memos`, `shop`, `crew`, `debt`, `myboss`, `rival`, `amends`, `incident`) |
| V77 wording | `options()` + `speak()` | the same actions relabelled as things a person would say |
| V78 arrangement | `flatRoot` | a short opening screen ("Between you", "Talk") with everything else behind "I wanted to talk to you about something", which opens five intent categories |
| V89 additions | `talk.ts`, `matters.ts`, `asks.ts` | his subjects (`tk:`), storyline topics (`mt:`), negotiation moves (`mv:`), requests (`enc:`) layered into the same lists |
| Club quick-chat | `club.ts` | a second, separate conversation engine with its own topics and lines |

**Structural weaknesses**

1. **Two navigation models at once.** The opening screen is a flat list; everything else is a tree of menus (sub-menus, then categories, then sub-sub-menus such as `pick_member`). The player cannot see where anything lives.
2. **Duplication.** At least six ways to ask the same thing: "How are you holding up?", "Ask if something is wrong", "Ask how he's fixed for money", "How's business?", "Ask how the shop is doing", "Discuss earnings". Three ways to buy a drink.
3. **Subjects without focus.** Choosing an option returns to the opening list or to an unrelated sub-menu (`personal`), so the reply and the next choices often have nothing to do with each other.
4. **Matters without names.** "Lean on him", "Reason with him" or "Ask what's really between them" appear without saying which of several ongoing matters they concern.
5. **Silent outcomes.** Some actions change the world and return only a stat line, or a narration, with no reply from the man.
6. **Generic reactions.** The negotiation engine decides well (yes / counter / stall / no / help), but the man's reaction to *how* he was approached is one fixed line per kind: a pressured shopkeeper says exactly what a persuaded one says.
7. **Temperament exists but is shallow.** Eight voice archetypes pick wording; seven traits drive decisions. Pride, cooperativeness and empathy are not modelled, and nothing tracks fear of a man separately from respect for him.

**What is worth keeping**

- Every *capability* behind the options (the handlers in `say`/`sayRaw`, `flows.ts`, `talk.ts`, `matters.ts`, `asks.ts`), with their rules, costs and consequences. They are tested and integrated with the world.
- The availability rules in `optionsRaw` (who can be asked what, by rank, relationship and knowledge).
- Conversation memory (`Convo.used`, `Convo.spoken`, `t.talk`), the voices, and the knowledge rules.
- The V89 screen's transcript-first layout and the side panel of what you know.

## 2. Design (as built)

### 2.1 One structure: a hub and subjects

A conversation is always in one of two places, recorded on the conversation as `ctx.focus`.

- **The hub.** What you can take up with this man now, short and always the same shape:
  1. **He brings it up / On his mind.** His request of you (`enc:`), the envelope on a Sunday, or failing those the one subject heaviest on his mind (`talk.ts`).
  2. **Between you.** Each matter one row, by name ("Protection at Rossi's Bakery", "His trouble with Paulie Vitale", "The money he owes you"). The most pressing three are shown, then a single "Other things between you (n)" row.
  3. **Talk.** Four questions, always worded the same: *How are you keeping?* · *How's business?* · *Heard anything?* · *What do you make of…?* His answer is where the variety lives. "How's business?" asks after whatever his business is: his shop, his racket, his crew's money, or nothing.
  4. **You could put to him.** The two proposals that fit who he is to you:
     - your boss: work, a bigger piece, being moved up;
     - a man above you: backing, a word, work;
     - your own man: orders;
     - a shopkeeper: protection, a loan, a partnership;
     - a man of another family: a favour, a warning.

     Everything else possible sits behind one quiet "Something else in mind…" row.
  5. **Leave.**
- **A subject.** The screen is about one thing:
  - its name ("Talking about: …");
  - only what can be said about it;
  - *Talk about something else* and *Take your leave*.

  Opening a subject is said, and answered from where it stands ("About the place. I'd like a better answer than last time." / "I gave you my answer.").

Every capability lives in exactly one place. The old sub-menus (`n:…`) remain only as the internal source of each subject's leaves. The intent categories ("I wanted to talk to you about something", `more:…`) and the nested incident menus ("Tell me more", "Go back") are removed.

### 2.2 One resolved turn, then words

Each turn in a matter is settled before anything is said (`asks.ts`):

1. How he was approached.
2. What that did to his stance.
3. What he decided: yes, counter, stall, no, or going to someone.
4. Why.

Only then is it put into words, once (`react.speak`). This means his reaction, decision and reason cannot contradict each other. How a man sounds giving in, refusing or holding out comes from his temperament and how he sees you, and his words change with the approach used (pressure, reasoning, a better offer, a name, force).

### 2.3 The point in hand

A matter has a subject (protection at Rossi's) and a state (terms, stances). An exchange also has the **point just made**, kept on the matter (`s.m.beat`, `claim`, `claimT`), so it is still there days later.

When he refuses, stalls or names terms, he gives a reason drawn from what actually weighed most:

- someone else's claim on him;
- bad blood;
- the money;
- not knowing you;
- pride.

A proud or guarded man may give a more respectable reason than the true one.

The replies on screen then answer that point (`exchange.ts`). For example:

- "You're doing plenty of business." → "Then show me your books." → "Since when do I have to show you anything?" → "Then I'll take it you can pay."
- "Who do you pay?"
- "I'm with Louie Costa."

Each reply tests the world: whether his reason is true, whether he will show you, whether the name means anything to him. It moves his stance, he decides again on the matter itself, and his words come from that decision. A new move by you supersedes the old point.

### 2.4 He has a say

Each man has only so much patience for a conversation, set by:

- his temperament;
- how he sees you (trust, liking, fear, resentment).

Pressure, force and going over the same ground use it up; ordinary talk barely does. When it runs low he turns cold: no more small talk or proposals, only what is between you, and the door. When it runs out he ends the conversation. A volatile or resentful man also won't start another one that day; a frightened one goes silent instead.

He can also:

- refuse a subject, and grow shorter each time you push it;
- break in with his own request, which then becomes the only thing in hand until it is dealt with;
- ask you things back, as part of his reasons.

### 2.5 Temperament (`temper.ts`)

Six dimensions:

| Dimension | Leans on |
|---|---|
| Courage | `courage` |
| Caution | `caution` |
| Volatility | `violence` |
| Pride | `ambition` |
| Agreeableness | `1 − greed` |
| Empathy | `1 − violence` |

Each dimension leans on that one trait, and over half of it is the man's own deterministic signature. A per-man "definition" makes some men one thing above all and others balanced. Measured over a world, the dimensions vary widely (SD ≈ 0.22–0.27) and correlate weakly (|r| ≤ 0.36). Contradictory men exist: brave-and-careful, volatile-and-kind.

Nothing new is stored for NPCs, so every old save has temperament.

It drives decisions, not only words:

- **Negotiation:** reasons, counters, giving in, holding out.
- **Retaliation:** pride feels a grudge more, volatility acts on it, caution and fear hold back.
- **Avenging kin:** strike or have a word.
- **Confronting, denying, owning up.**
- **Making peace.**
- **Talking to the police when arrested:** nerve and self-preservation against trust and respect for the boss; resentment of a boss he only fears.
- **Skimming:** more from a boss he fears but doesn't respect.
- **Disputes:** going to the boss or planning a reply.
- **Bosses:** checking books and disciplining.
- **Crew on jobs:** confrontation or mercy, and obeying orders.
- **Risk-taking in rackets.**
- **Retiring.**
- **Making peace between leaders.**
- **Shop owners:** paying the collector.
- **Report styles.**

Voice archetypes remain the voice (how he words things); temperament decides what he does and how he takes things.

### 2.6 The player

The player has no temperament at creation. His emerges from conduct counted in context:

- threats, and force against a man who never wronged him;
- retribution against one who did;
- deals and compromises;
- generosity and forgiveness;
- standing up to men above him, and giving way to them;
- his kept and broken word, read from the existing record.

It never restricts a choice. His Life page describes, in words, the man he has shown them.

### 2.7 Perception: fear is not respect

`Rel` gains an optional `fear`, which fades a tenth a week if nothing feeds it. A man's view of another (`viewOf`) is read only from what he believes:

- trust, respect and liking from the relationship;
- **danger:** what he has seen or heard the other man do to anyone;
- **fear:** what the other man did to him or those close to him, the power to hurt him, and his own caution and courage;
- **resentment:** grudge, plus fear turned sour in a proud man.

Nothing the player did unseen counts. Side panel wording: "is afraid of you", "knows what you can do", "thinks little of you", "trusts you", "resents you".

A man who gives in out of fear does not leave it there:

- he trusts you less, and so tells you less;
- an agreeable or soft-hearted man tells a friend, as a fact that travels as gossip, and a friend in the life takes against you;
- a proud, brave man nurses the grudge himself, which feeds the retaliation the world already runs.

### 2.8 The club

The club's separate small-talk scenes are retired. Sitting down with a man at the club opens the same conversation, at the club. A scene already under way in an old save still plays out.
