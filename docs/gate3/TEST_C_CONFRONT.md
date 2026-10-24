# Test C: confrontation, in the browser

*Run 4's world, on day 31, in the running game.*

*An associate in his first month has nobody under him, so this test needed a developer setup. It was done openly in the console:*
- *Sonny Vitale made Dante's man, with two light envelopes;*
- *Dante saw Sonny take $200 from his coat;*
- *Sonny had told Dante that Richie (Dante's captain) had him beaten.*

*Everything after that is the game's own response. Earlier in the session the same setup was played once on the build before two fixes (the accusation's wording and the rank rule); that is why Sonny greets Dante coolly here. He remembers the first accusation.*

```
### Day 31. Sonny Vitale (now Dante's man)
SONNY: He’s cooler than he was. He hasn’t forgotten the last time.
    [Business | Personal | Confront | Leave]
  → Confront
    [“I know what you did. I saw it.” | Your envelope’s been light. What’s going on? | You’re on thin ice. I’m telling you as a courtesy | Something else | Leave]
> Your envelope’s been light. What’s going on?
SONNY: He spreads his hands. “Nothing I can point to. Some weeks are thin.”
    [“I know what you did. I saw it.” | I’ll look into it myself | You’re on thin ice. I’m telling you as a courtesy | Something else | Leave]
> I’ll look into it myself                                   (approach 1: check his story)
  (Nobody has a bad word for him. It checks out: the corner is busy and the slips are thick.)
  (Trust ▲)
> “I know what you did. I saw it.”                            (approach 2: what Dante saw)
SONNY: He doesn’t look at you. “All right. It was me. It was business.”
    [Give him a chance to make it right — He will owe you for it. | Warn him | Leave it there | Talk about something else | Leave]
> “It doesn’t happen again.”                                  (Warn him)
SONNY: He holds your eye, then nods.

### Day 31. Richie DeSantis (Dante's captain)
RICHIE: “You again.” He doesn’t get up.
  → Confront
    [“Sonny. I know that was you.” | Ask why: ‘Coffee at the club’ | Refuse: ‘Coffee at the club’ | Something else | Leave]
> “Sonny. I know that was you.”
RICHIE: He doesn’t look at you. “All right. It was me. It was business.”
    [Ask him to leave yours alone | Leave it there | Talk about something else | Leave]      (no "make it right": a captain is not put in his man's debt)
> “I’d ask you to leave my people alone.”
RICHIE: He considers you. “I’ll think about it.”

### Day 33. Richie DeSantis
RICHIE: He’s cooler than he was. He hasn’t forgotten the last time.
RICHIE: “I don’t offer twice.”          (coffee at the club, which Dante never went to)

### Day 33. Sonny Vitale
SONNY: He nods, and waits. The last time is still in the room.

[Sonny on Dante: trust 0.26 → 0.27, fear 0.11 (from nothing); one favour owed from the earlier "make it right";
 Richie's respect for Dante unchanged (0.37), no grudge]
```

**Also shown in the earlier pass of the same setup:**
- Sonny was given "a chance to make it right" and now owes Dante a favour.
- He later brought it up himself. The line then read badly (it quoted the whole incident), and has been fixed to the game's usual short form.

**What depends on who he is to Dante:**

| Who | Pressure | Making it right | Warning |
|---|---|---|---|
| A man under the player | Fear rises sharply | Possible (he owes a favour) | "It doesn't happen again." |
| A peer | Fear rises a little; he likes the player less | Possible | As for a man under the player |
| The man above | Barely frightens him; costs the player respect, and he holds a grudge | Not offered | Only a request to leave the player's people alone |

**What the browser run didn't reach:**
- **Denial, and pressing a denial:** "Tell him how you know", "Pressure". Both men admitted. These paths are exercised by the automated tests:
  - "a confrontation stays on its subject: denied, the player can tell how he knows, press, or let it go; pressing a superior costs his respect";
  - "a man accused, who did not own up, greets the player the next time…".
- **"Settle it another way"** opens the game's existing "take action against him" screen.
