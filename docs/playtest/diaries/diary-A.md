# Playthrough A: Lawrence Oliveri, Small Businessman (cooperative). Origin a.localhost:5173. Desktop 1440x900.
## Day 0, Mon 2 Mar 1970 08:00, $1,000
- Opening text: owns a tenth of Oliveri's Meats (Mickey Rizzo runs it). Boss: Rocco Neri.
- ISSUE: rail says Reputation "Trusted" on day 0 for a nobody.
- ISSUE: intro line "Rackets says how to earn" — there is no Rackets section (Business > Rackets). Stale copy.
- ISSUE(minor): "Give orders · Put a man to work" tile shown with 0 men.
## Day 0 — Rocco Neri (my captain), Barber Shop, morning. Headings: Business, Personal (no Confront).
Header: "He likes you." Greeting: "There he is! Come here."
### Business (top): b_need, promo, Other business, Something else, Leave
- b_need "Is there anything you need done?" -> offers job "bring Lombardi's Jewellers under the family". OK.
- job follow-up option "About what he asked: …" -> player line "You had something for me?" -> Rocco: "We just went over that… Short memory?" CONTRADICTION: the game's own option makes the player forget. Hint "Pays $0" = mechanical.
  - sub: I'll take care of it / Not this time / Talk about something else.
- promo "What would it take to be moved up?" -> "Right now people call you trusted." / "$0 of $3,000 passed up in total" / "Who would speak for you? 1 of 3." = NPC speaking database numbers (violates design rule). "trusted" on day 0.
- b_more "I'm ready for more" (day 0, nothing done) -> "Fine. Don't make me regret it." Respect▲. Reward for hollow claim.
### Business > Other business (10): biz_none, earn, rate_ask, borrow, tribute $300, recommend, pick_concern, Back, Something else, Leave
- After every answer you're dropped to top list; re-open "Other business…" each time (friction).
- biz_none: "Better than some people think." generic.
- earn "How do my numbers look?" -> "Let's see how my favourite earner's doing." (day 0, earned nothing: archetype line not grounded) / "20 cents in the dollar comes to me. You're square with me."
- rate_ask "I've been carrying a lot lately…" offered day 0 (carried nothing) -> "Watch yourself. You'll pay what everybody pays." Goodwill▼. Fine.
  - "I'm only asking." (hint: let it lie with grace) -> "Good. Because I don't." NON-SEQUITUR; then offered to keep haggling (sweeten/persuade) despite "let it lie".
  - sweeten hint "Ask for 18% instead — More from you, easier for him" — 18% < 20%: hint backwards/confusing.
  - Quoting inconsistent: “Forget it.” in quotes, other lines not.
- recommend "Would you put in a word for me?" day 0 -> "Sure, sure, I'll put in a word. I like you." Instant backing + favour owed. Too easy.
- CTX box shows an empty line between items (" /  / ").
- pick_concern "There's something you ought to know about a man" -> list of 5 Corrente men incl. Rocco's own boss Bobby Leone. Choosing "About Bobby Leone" (no content at all) -> "I'll keep an eye on Bobby. Thanks for telling me." Trust▲ Respect▲.
  - EXPLOIT (High): repeatable once per man: 5× Trust▲Respect▲ on day 0 by naming names with nothing to say. 5th: "He has nothing more to say on it." still Trust▲Respect▲. Informing on his own superior to him is rewarded.
### Personal (top): tk:trouble, news, spend, Something else personal, Something else, Leave
- tk:trouble "What's weighing on you?" -> "I don't get what I'm worth." Options: "You need to straighten yourself out." (to your captain on day 0 — rank-inappropriate) / "Go on. I'm listening." -> "You let him talk…" Warmth▲. 
- news "What's new?" -> "Ralphie has taken on Lombardi's Jewellers. $70 a week."
  - CONTRADICTION (High): this is the shop Rocco *just* asked me to bring under the family. Job still open.
  - follow-ups are crime-incident questions applied to a benign protection deal: "Who have you heard it was?" -> "Word is it was Ralphie. Don't quote me"; "Will anyone do something about it?"; "Who would know?" -> "Ralphie"; "What do you make of it?" -> "Doesn't sound like Ralphie. Somebody's stirring." / "ask Teddy. He was there." Treats a deal as a mystery crime.
- pick_incident "What else have you heard?" -> "Which business? There's always something." -> "Anything else going round?" -> narration "You ask Rocco about it." + "I wasn't there…" “Teddy Sorrento refused to pay protection and ran Louie Valenti out…” (a database fact pasted inside his quotes, narrator voice).
### Personal > Something else personal (11 options; 10th+ unreachable by number key)
- how: "Alive, fed, owed money by nobody. A good week." Warmth▲. ok
- old_times "Mind if I sit a minute?" -> gives gossip (Ralphie put $800 in Sonny Giordano's hand). Trust▲Warmth▲. Label/answer mismatch.
- pick_member "What do you make of the others?" -> "Who? Spit it out." (rude to a man who 'likes you') -> list (Bobby Leone underboss, Sal Santoro, Ralphie Bellini, Jimmy Fiore, Jimmy DeSantis). Ralphie: "We get on. Smooth talker, gambler, I'd say." ok.
- leaders "Who's really running things?" -> "I answer to Bobby… Mickey runs the family. I barely know the man." Captain barely knows his boss: implausible.
- ask_rep -> "People say, 'Lawrence? Still proving himself.'" ok (contradicts rail "Trusted").
- b_stand "Where do I stand with you?" -> "You're all right. Not more than that yet." + "To be a soldier… Declare it straight, hand it over in person, and be generous to the man above you." = explains game systems.
- tk:hurting -> "Nobody's crying that I know of." -> "Good to know." ok
- think "What do you make of…?" -> "Ask." -> loops back to pick_member. redundant with pick_member.
- spend "Let me buy you a drink." (at 08:00 at the barber shop) -> "You spent the evening at the club with Rocco… talked about a girl he knew in Bensonhurst. Nobody said anything that mattered." Ends the visit; clock jumps 08:00->20:45; -$40; no ▲ shown. Ended the visit before I'd answered his job offer.
### After the visit (Mon 20:45, $960)
- World "Needs you · 1 waiting" (red badge): "Your move — A smaller share — He turned you down". A dropped request shown as urgent.
- The offered job (Lombardi's Jewellers) appears nowhere: not World/Needs/Opportunities, not Journal. Silently gone (probably because Ralphie already took the shop = stale offer).
- Journal story "A seat at the table — Turned down for now — You spoke to Rocco: 'Where do I stand with you?'" Nobody turned me down. Misreport.
- Journal > Your word: "Favours: … you owe nobody" AND "Agreed terms: He put in a word for you. You owe him one." Contradiction: the recommend favour is a memo, not a favour record.
## Day 0 evening — Cafe Roma (Social Club). "Open 11:00 to 2:00" (ambiguous). In: Rocco (behind the counter), Artie Vitale, Louie Valenti.
### Louie Valenti (soldier, under Joey Palumbo) — first meeting; header "You know each other." Greeting "Sit down."
- Business: work "Is there anything I can do for you?" -> "Nothing. I'll let you know." ok
- rk_back "I'd be grateful if you'd back me" (hint explains mechanic: "A made man's word is how an associate gets made") -> "I don't know you well enough to put my name on you." GOOD. -> back_what -> "Let me see you pay on time, do what you say you'll do… A few weeks of that." -> memo "He wants to see you reliable…" (shown as "About what we agreed" — not really an agreement). Inconsistent with Rocco agreeing instantly.
- promo (asked of a soldier) -> "I'm hardly the man to ask. I don't decide that." GOOD.
- loan "I need $500. I'll pay the usual." -> "I'd like to help. I'd also like to see my money again." good. THEN:
  - "You'll have it back by the end of the month. My word." -> "I already told you," says Louie. "Keep up." WRONG (first time making that argument).
  - "I'm good for it. Ask anyone." -> "Everybody's good for it, until they're not. I don't know you." good.
  - "Make it 8 percent a week" -> "Again? We just did this." WRONG.
  - promise again -> "He has nothing more to say on it." The two remaining options ping-pong forever. Negotiation dead-end loop; every argument after the first is treated as a repeat. (Same family of bug as Rocco "Short memory?") HIGH.
  - "All right. I'll leave it." shows no exchange at all (reading area unchanged).
- Personal: pick_incident "What do you know about the recent trouble?" -> "Which business? There's always something." (same canned line as Rocco) -> "What's the story with Sorrento's Billiard Hall?" -> "You ask Louie about it." + “Teddy Sorrento refused to pay protection and ran me out of Sorrento's Billiard Hall.” (the victim recites the database sentence in 1st person; no feeling)
  - involve -> "Not that I've heard. Which doesn't mean it's over." (to the victim himself)
  - view "What are you going to do about it?" -> "If it were mine, there'd be nothing left to discuss." WRONG PERSPECTIVE: it IS his. HIGH.
  - can_do "What can be done about it?" -> "You could have a word with Teddy, or put the two of us across a table. Either way you're putting your name to it." Good hook — but no option to take it up; drops back to the Personal list.
- tk:boss "How do you find working for Joey?" -> "Joey's fair, mostly." ok
- Conversation took ~3h (20:45 -> 00:04).
### Story page "Protection at Sorrento's Billiard Hall"
- Timeline lists only "Rocco Neri told you" (Louie told me himself — not recorded as a source).
- "What you don't know: You don't know how he will answer." ambiguous 'he'.
- "What you can do: It is between Louie and Teddy." CONTRADICTS Louie's own invitation. No affordance for the hook. HIGH (design).
- Your word: Louie's condition listed under "Agreed terms" — fine-ish.
## Tue 3 Mar 00:04–03:56 — Mickey Rizzo (civilian, runs Oliveri's Meats, of which I own 1/10), at his home in Staten Island, late at night
- People row and his page show nothing about my 1/10 stake (between.ts ignores stakes). His page "What you know: Mickey Rizzo bought Oliveri's Meats from you, who kept a tenth of it." (awkward); dated "Day 1 08:00" (two date systems; Day N vs Mon 2 Mar).
- Turning up at a nervous civilian's home after midnight: "He nods you to a chair." No reaction to the hour.
- Business: suggest (protection pitch), Other: buy_ask ("would he sell the place" — he bought it from me yesterday), stake_ask ("buy a quarter" — I already own a tenth; no option about my existing share), tk:shop.
- tk:shop "How's business?" -> "Steady. Nothing to write home about." + "He mentions the envelope for Danny without being asked, and his mouth goes thin." GOOD texture. -> "How do you get on with Danny?" -> "Fine. Fine. Everything's fine with him." GOOD (nervous lie).
- suggest "A man with a place like yours could use some friends" -> "Not interested. This place is looked after. Ask around." Goodwill▼ Standing▼. Sensible. -> "Who do you pay?" -> "That's between me and him." (but he volunteered "Danny" a moment ago).
  - Options include "Send the boys in to wreck the place" — I have 0 men; and it's a shop I part-own.
- Personal variants for civilians: "Everything all right with you?" -> "Fine. Yes. No complaints." Warmth▲; "Got a minute?" -> "You talk about the weather, the Mets, the price of everything… the polite kind of nothing." Trust▲Warmth▲ (lovely writing; but free trust at 3 a.m.). tk:hurting -> identical canned line to Rocco "Nobody's crying that I know of."
- news "What's new?" -> **CRITICAL**: “Lawrence wants money off me. I won't pay him. Can you do anything?” — Lawrence is ME. He asks the player for help against the player, in the 3rd person, right after the player's own pitch. [CTX] "He has been looking for you." Options: "I'll talk to Rocco about it." / "I'll do what I can." / "I'll make sure he leaves you alone." / "I can't get involved in this." Took "make sure he leaves you alone" -> "You mean that? Then I'll hold you to it." Screenshot: docs/playtest/screens/A-01-mickey-asks-me-about-myself.jpg
- The visit took ~4 hours (00:04 -> 03:56). Rail reputation flipped Trusted -> Unproven over the night.
- AFTER: Your word shows NO promise to Mickey ("You have given nobody your word…") although he said "I'll hold you to it". Conversation-layer promises (social obligations) are not surfaced anywhere: not Your word, not Stories. HIGH.
- Stories: "Protection at Oliveri's Meats — He turned you down — You asked Mickey Rizzo for a weekly payment… and was shown the door." Grammar ("You… was"). I was at his home, not shown a door. Listed under NEEDS YOU, as is the rate refusal: refusals pile up as "needs you".
## Your page (Tue 03:56)
- "THE ROAD TO BEING MADE 1 of 5": "A name worth having ✓ people speak well of you" on day 1, before doing anything. "Made men who'll back you 1 of 3" (Rocco's free word counted).
- "Next in line for soldier": six rivals ahead, each with a "Deal with him" button. Removing rivals presented as progression.
- Ambition chooser: 6 ambitions. Took "Become respected" -> shows "reputation 40 of 75" (internal number) and "Next: Keep your word, do favours, and be seen to pay your debts."
## Wed 4 – Sun 8 Mar: NEXT EVENT ×5 (each a full 24h)
- Every jump says "A long day. Nothing stirs." while new Opportunities arrive (christening invite from Ralphie; truck of car parts at Orsini's from Richie Russo "about $960"; Sonny Giordano "has an inspector on him"; Louie "has something to sell"). NEXT EVENT does not stop for them, and the message contradicts the screen.
- Guide step 4 "Go back to Mickey Rizzo… better terms, an argument, pressure, or time." Pushes a cooperative player to extort.
- Sun 04:06: "LOOKING FOR YOU: Mickey Rizzo has been asking for you." -> visit: "Mickey Rizzo has come to find you." but header says "home in Staten Island · late at night" (he came to me; we're at his home at 4 a.m.).
  - "Did you— is anything happening?" Options: "Not yet. Give me a few days." / "I took it to Rocco." (hint: You haven't been to see Rocco — lie flagged: GOOD) / "I couldn't get anywhere with it. I'm sorry." / Something else…
  - GOOD: the promise was remembered and followed up.
  - BAD: no option to admit I'm the one leaning on him. "Something else…" discards his question with no way back; leaving then removed him from "Looking for you". Player loses the approach by navigating.
## Sun 8 Mar
- Christening invite (Ralphie): text typo "My grandson is being christened the hall on Bay Ridge Avenue" (missing "at"). Went with $100 (-$100). Scene GOOD: "Babies, wine, and a priest who has the sense not to ask where the envelopes come from." Introduction to Bobby Leone (underboss) — whom I "informed on" on day 0; no echo. Overheard: Paulie Fiore collects $60/wk from Pellegrino's.
- Sonny Giordano's inspector (tip from Sonny himself): "Have a word with the inspector" -> "You find the inspector at lunch [at 10 a.m. on a Sunday]… Sonny owes you a good word." Worked; no 'what changed' line.
- Louie sells a tip ($300): offered half -> "I don't need your money that badly. Another time." Offer gone. Haggle no longer accepted too easily (V85 bug not reproduced). (Louie, who refused me a $500 loan for not knowing me, now trades with me: plausible.)
- Ride shotgun (Sal Santoro): job says "truck of liquor coming in on Friday night" — done Sunday 10:27->13:55. "Nothing happens… Sal pays you $280." Time incoherence. +$280 → $1,140.
## Sun 8 Mar 20:30 — the week turns
- +$32 (my stake's share). Money room says "YOUR WEEK $0 IN · $66 OUT" — the stake isn't in money.ts (my own model misses it). "You are behind by $66" minutes after it fell due (it's due Tuesday).
- Envelope prompt is still the flat arithmetic (V85 known): "Last week you made $332 … 20% of $332 is $66. Total $66."
- Handed to Rocco in person. Rocco remembers the unanswered job: "I had something for you. You didn't want it, I suppose." GOOD memory. Header district now "The Bronx" (Monday: Little Italy).
  - Exchange repeats the arithmetic, then "You put an envelope on the table… 'That's what I wanted to see.' $66 handed up. Last week is settled." Trust▲ Respect▲ −$66. Then "Rocco Neri says there's nothing for you right now, and means it as a compliment." (odd)
  - Then offered $250 / $1,000 personal gifts ("He'll owe you one") — money buys favours.
### Teddy Sorrento (civilian, billiard hall owner; first meeting, his home, night)
- His page "Between you": "Teddy has something on his mind: louie valenti wants sorrento's billiard hall to pay him." — names lower-cased (bug); and it's between him and Louie, not me.
- Greeting: “Friend. What brings you?” + "Teddy looks past you at the door when it opens." GOOD.
- Business > Other: “Who does Lawrence answer to?” — the PLAYER asking about himself in 3rd person. HIGH (second self-reference bug). Also "I need $500" to a stranger.
- tk:pressed "Anyone been bothering you?" (hint: "He looks like a man waiting for someone to come back") -> "Nobody. Why? What have you heard?" -> "I heard Louie came round." -> "So it's all over the street. Fine." / "Louie came in. $70 a week, or else. I told him where to go. Now I wait for the or else." GOOD, coherent with the fact.
- Offers: "I'll look after you myself" / "I'll tell Louie to leave you alone" (promise) / leave it. Took the promise -> "You'd do that for me?" Trust▲Warmth▲. Memo "You said you would tell Louie Valenti to leave him alone. Due 15 March." Recorded properly (unlike the Mickey promise). Then "Ask around about him first" appears (after the fact).
### Louie again (his home, The Bronx, night)
- Home screen gives no hint of the promise (memo sits on Teddy, CTX shows only Louie's own memo). Option found under Business: "About Leave Teddy alone — Waiting on his answer." (label grammar; and I hadn't asked yet).
- Player line rendered: "About leave Teddy alone." (garbled)
- "Teddy is with me. Leave it alone." -> "Watch yourself. Nobody walks in here and tells me what to do." Goodwill▼. Options include "Everybody pays. You're not special." — a protection-pitch line in a cease-and-desist (template reuse).
- "Nobody's telling you. I'm asking." -> "Asking, telling. It comes to the same." good.
- "Be sensible. This is good for both of us." (it isn't, for him) -> "Don't push your luck."
- No cooperative levers at all after that: only pressure / "Have him taught a lesson" (against a made soldier of my own family, by an associate with 0 men) / "Rocco is behind this" (a lie) / drop. Missing: compensation, a sit-down, appeal to Joey (his capo). 
- Lied "Rocco is behind this" -> "Word goes round that Rocco Neri is behind you." / "Watch yourself. No." -> dropped. Will watch whether Rocco reacts to my using his name.
- Promise to Teddy now unkeepable by persuasion; will let it lapse (due 15 Mar).
## Sun 8 -> Mon 16 Mar: A FULL WEEK
- World after: +$32, Standing −3 (no reason given), "1 new thing learned".
- AUTONOMY GOOD: Mickey went to his protector: "Danny Bellini told Mickey Rizzo he would deal with you." (source tag says "you saw it" — I was away all week). Then "Danny Bellini · WANTS SOMETHING · Leave Mickey alone".
- Teddy promise lapsed: Needs you "What you told Teddy Sorrento… He expected it done by now." (tracked, good). No visible consequence yet beyond that.
- Danny's warning: “Mickey is with me. Leave it alone.” — the SAME line the player used on Louie (NPC and player share templates). Story: "What you know: Nothing has reached you yet beyond what is above" though news told me. Answered “All right. You have it.” -> page shows only "That matter is over, or nobody is talking about it any more." World: "You back off." No reaction from Danny; outcome barely communicated.
- Guide immediately: "Offer a shopkeeper protection — Rackets, under “Shops you could lean on”" (stale nav; pushes extortion right after backing off).
- Mickey again: "Lawrence's people haven't been back. Was that you?" (to Lawrence). Options "That wasn't me…" / "I had a word." (hint: You had nothing to do with it — but I DID back off). -> "Then why did they stop?" He doesn't like not knowing. Screenshot A-02.
- Rocco asks about Dom (Dom Sorrento inside): "I know you know a lawyer, and a clerk who knows a judge." — presumptuous; never established. Face to face Rocco: "I put work your way. You never came." (memory of unanswered job, 2nd time — GOOD). No reaction to my lie "Rocco is behind this" (word went round) — consequence never lands.
  - "Make a call, put up $300" -> "A call, a clerk, an envelope. Dom Sorrento is out in two days, and Rocco Neri will remember whose phone it was." GOOD writing. Trust▲ −$300. He owes me a big favour.
  - CRITICAL (3rd instance): Business option 1: “Mickey Rizzo's having trouble with Lawrence Oliveri. I want to bring it to the family.” — reporting myself to my captain. Rocco: "Mickey? He's not one of ours. Why should we get involved?" — doesn't notice Lawrence is me.
  - Immediately "Call in the favour he owes you: $450" -> "Watch yourself. I haven't got it right now." Goodwill▼. Resistance GOOD. But follow-up "I'd think hard before saying no to me." = threatening your own captain offered to an associate.
## Mon 16 – Tue 17 Mar
- Legit work: all four jobs are at mob-run places (flavour ok). Took "Drive for Rocco Neri" ($120/shift).
- EXPLOIT (High): shifts have no limit or fatigue: 4 back-to-back 6-hour shifts incl. 03:47 = $480/24h, identical text "A long shift driving Rocco Neri. You earn $120." ×4. ≈$3,300/week from a "doesn't make you rich" job vs $332 from week 1's other earnings. "Good for hearing things" — nothing heard.
- Unexplained "Standing −1" after the first shift.
- Teddy after broken promise (his billiard hall, morning): greeting “There he is! Come in.” + “About what you promised me. Nothing came of it.” (cheerful greeting/grievance clash). Page meters unchanged ("Wary/None"). CONFRONT heading appears for the first time:
  - "I let you down. I want to make it right." -> "You told me you'd see to it. Then nothing. I noticed." GOOD.
  - "Own up to him, no excuses" (hint: "Put your terms to him plainly" = negotiation template; player 'says' a stage direction) -> "What's the catch?" Goodwill▼ (deal template for an apology)
  - "No catch. I want you on my side." -> "There's always a catch."
  - "Offer $150 with it — More from you, easier for him." -> "Now that I can live with." "Teddy counts it without picking it up. 'We're square. Mostly.'" Trust▲ Goodwill▲ −$150. Nice line, but a broken promise of protection is bought off with cash while Louie's threat still stands.
