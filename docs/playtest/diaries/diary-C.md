# Playthrough C: Pasquale Castiglione, Bookmaker (ambitious climber). Origin c.localhost:5173. Desktop.
Start Mon 2 Mar, $900; Tony Lucchese owes me $500 ($60/wk). Captain: Vincent Ricci.
## Day 0
- Ambition "Rise in the family". Set up Bookmaking ($400), run by me. Other standing rackets moved to "not open" (can't afford).
- Vincent (captain): "He's glad to see you, and doesn't hide it." b_need -> same first job as A: "bring Mancini's Pharmacy under the family. It's yours if you want it."
  - "About what he asked…" -> player "You had something for me?" -> “We did that one,” says Vincent Ricci. “Try another.” (REPRODUCED from A: systematic.)
  - "I'll take care of it" -> “Good. I knew I could count on you.”
- The accepted job appears NOWHERE: not World (Needs/Opportunities), not Journal Stories, not Your word; the shop's own page doesn't mention it.
- Went to Mancini's Pharmacy (via Family › shops): "Talk business with Nicky" -> option “$80 a week, and nothing happens to the place.” -> Nicky (nervous): “$80 a week.” [FX] Agreed. Instant, no resistance, flat echo.
- Back to Vincent: “Back already?” + “I had something for you. You didn't want it, I suppose.” — he thinks I REFUSED the job I accepted and completed. No "report" option.
- Your page: "Get the work done — 0 of 2 jobs finished." The completed job doesn't count.
- ROOT CAUSE (code, after observing): conv/visit.ts doProtect -> openAsk/agree sets the protection but never resolves the Job; jobs resolve only via jobs.resolve() from the job screen (data-a "job:"/"mine:"/"go:"), which is reachable only from World's *offered* list. An *active* job taken in conversation has no surface at all. CRITICAL: breaks the capo → job → report → "get the work done" → made loop.
## Tony Lucchese (my debtor from the book; $500 at $60/wk)
- His page: "How he sees you: You haven't met." — contradicts the background ("One of your old customers… you have never once let him forget it"). Greeting “Friend. What brings you?” (stranger line).
- Debt talk: “$500, last I counted. I'm paying, aren't I?” — IDENTICAL to Bobby Russo (B). "How much can you manage?" -> “I could do $250 today.” -> pays $250 cash on first visit (no friction). "Pay up, or there'll be trouble." -> “There's nothing to take. Do what you have to.” — IDENTICAL to Bobby. "Who else do you owe?" -> "That's my business." Debtors share one voice regardless of personality. HIGH (interchangeable NPCs).
- Then (Sun) "Tony Lucchese let a $60 payment to you slide." plausible.
## Week 1 (Mon 2 – Sun 8)
- "Ambition met: Get a shop paying you every week. (+$150, standing +2)" — I chose "Rise in the family"; hidden default ambition again (also seen in B). Later "Ambition met: Put $2,500 in your pocket. (standing +2)" — another unchosen one.
- Influence "Has Pull" on day 2.
- Ride shotgun (World tip, Lenny Greco): "…Lenny pays you $540 plus a bonus" (listed $360). Counted: "Get the work done 1 of 2". => World jobs resolve; conversation jobs don't.
- Sunday: earned $1,114 in week 1 (book $419, protection, jobs). Envelope $223 in person: same template as A ("That's what I wanted to see.") + "Vincent Ricci asks after your men, one by one." (I have 0 men).
- $1,000 personal gift -> 'Vincent Ricci: "A favour like a thousand dollars pressed into my hand with no reason given is an investment. I mean to repay it properly."' (NPC narrates the mechanic) + "You add another $1,000" (first one). He owes me a favour (real one). It's offered back as "Call in the favour he owes you: $300".
- "Would you put in a word for me?" -> “I'll mention you. A recommendation is a thing that's remembered, both ways.” Instant; doesn't consume his favour; I now owe him one too.
- promo -> “Not yet. trusted, that's what I hear.” (lowercase after full stop) / "$1,223 of $3,000 passed up" — the $1,000 gift counts as passed up: promotion money is buyable. / "Who would speak for you? 1 of 3" — unchanged after he just put in a word.
## Week 2 (Mon 9 – Fri 13)
- Muscle job for Ralphie Mancini: "You don't say a word. Georgie Pellegrino looks at you… pays $140 on the spot. Ralphie Mancini pays you $180." GOOD.
- SELF-JOB: "Ride shotgun for Mancini's Pharmacy's delivery — From you, about $240" -> "…Pasquale pays you $360 plus a bonus." I pay myself; cash unchanged; counts as a finished job. EXPLOIT + absurd.
- Truck hits on Santangelo-protected Fiore's Lounge ($1,140) and Mancini's Bakery ($600): "If they find out, they'll take it as a personal insult." Heat Hot -> Burning. No police consequence by day 12.
- Burglary text: "Bobby Palumbo has had a rough week and is watching the place like a hawk." then "You carry out about $450 in goods." (warning without effect).
- Inspector job: paid $200 -> Nicky: "I won't forget that." Scam: "Sonny DeSantis swallows every word. You leave $230 richer and he thanks you for it."
- Summons "Your recent earnings" from Vincent: Go -> "Vincent Ricci isn't available right now. He expects you to try again soon." (he summoned me). Found him at home: same lawyer-and-clerk template as A ("Mario Esposito is inside. I know you know a lawyer…"). Paid $300 again -> favour.
  - In conversation the summons appears as a JOB: "About what he asked: Your recent earnings — Pays $0" -> “Here's one for you. Your recent earnings.” -> "I'll take care of it" -> "Good. I knew I could count on you." The meeting never happens.
## Sat 14 Mar – Sun 15 Mar: more World jobs (ride shotgun $220; burglary $1,200). "Ambition met: Earn your boss's trust. (standing +3)" (another unchosen).
## Sun 15 Mar -> Fri 17 Apr: ONE "NEXT EVENT" CLICK = 33 DAYS (arrested, jailed)
- World on return: "Something has come up." Only line: "The law picked up you. His friends have started saying he's a good man." (garbled grammar, 3rd-person pronouns about the player). No arrest scene, no charge, no sentence, no "you're inside until…" message, nothing about what it cost. CRITICAL (communication): a month of the player's life vanishes.
- During it: summons stayed pending; Vincent brought Vincent Lupo into his crew; a family levy; Danny Santangelo bought 30% of Barone's Hardware.
- Then: "Vincent wants a word about the arrest" -> 'Vincent doesn't ask how you are. "They had you for 35 days. What did they want, and what did you give them?"' EXCELLENT scene. Answered with details -> "Good. You kept your head." Story: "Pasquale kept quiet" / "You kept his mouth shut." (pronouns).
## Road at day 48: "2 of 5": Pass up $1,223/3,000; work 2/2 ✓ (incl. the self-paid job); name ✓; backers 1/3; bones. "A SEAT IS OPEN… Right now, that's you." #1 in line. "The man you've shown them: You haven't shown anyone who you are yet." (after a crime spree and keeping quiet inside).
- Vincent (captain) asks HIS associate: "My brother is in trouble. $500 would fix it…" while owing me two favours; and plays matchmaker ("There's a girl. Marie…"). Generic friend/kin encounters given to a captain.
  - Lent with terms (misclick): "Vincent takes it, grateful and slightly insulted that there are terms. It's fair. He knows it." GOOD line; my captain becomes my debtor.
  - Tribute $300: '"For what?" "For nothing." He almost smiles. "Nothing is a good reason."' GOOD. Counts toward passed-up ($1,523). Not repeatable in the visit (good).
  - Dinner with Marie happens immediately inside the conversation (it was for "Saturday"): "Marie Caruso isn't what you expected. She laughs at the right moments and not at the wrong ones…" GOOD writing, wrong time.
- Asking soldiers to back me (Lenny Greco, Patsy Mancini, Benny Bellini, Mickey Esposito, Paulie Caruso):
  - Lenny (gave me 2 jobs): “I hear ‘Ride shotgun for Cassano's Trattoria's delivery’ got done. Tell me about it.” (quotes a job title; he gave me the job). Backing option didn't appear for him.
  - Patsy: "Do I know you?" then "I put work your way. You never came." (contradiction).
  - Patsy, Benny, Mickey, Paulie: IDENTICAL replies verbatim — "I don't know you well enough to put my name on you. Come back when I do." / "Let me see you pay on time… A few weeks of that." Mickey greets "There he is! Sit, sit." then doesn't know me. Interchangeable. The condition ("a few weeks of reliability") is never tracked or shown.
## Apr 19 -> Wed 3 Jun (batch of next-event cycles; log lost to a tool timeout; reconstructed from Journal)
- Arrested AGAIN ("You are in a cell tonight, and every friend he has is thinking about what he knows." ×2).
- "Vincent Ricci counted it twice. You were $1,007 light." and "$1,158 light"; "raised your share for ignoring him" ×2 — envelopes missed while inside. Coherent chain: heat -> arrests -> missed envelopes -> captain punishes -> backer withdrawn ("Made men who'll back you 0 of 3, and nobody to speak for you").
- World autonomy visible in the Journal: Commission ruled between Falco and Santangelo ("Both sides say they were robbed."), cross-family protection takeovers, the boss beating a captain (Mickey Corrente put Frankie Marino in the dirt), police raids on others' operations, a gambling habit (Lenny seen at the track), Sonny Mancini running something on the side. GOOD world texture.
- TEXT BUG (High): concatenated facts: "Artie Rizzo got a lesson from Artie Rizzo took Frankie Marino to task over what happened: Frankie Marino, delivered with fists." / "Hank Testa got a lesson from Lenny Greco took Richie Orsini to task over what happened: Richie Orsini, delivered with fists."
- Day ~93: still an associate. $6,298. Passed up $2,600/3,000. Backers 0/3. Rail "Reputation Unproven".
- Repeated borrowing: Vincent (owes ME $185) -> "I'd like to see my money again." -> "$300 is what I can spare. 5 percent a week." -> took it. Now mutual debts with my own captain. Second ask: "You asked me. I answered." (repeat guard OK). Asking a loan while holding $6,298 is allowed and granted.
## Information exposure (checked day ~93)
- Family › The families › Santangelo: full org chart of a rival family incl. every associate and their succession order ("#3 IN LINE", "NEXT IN LINE"), men I have never met; side panel lists all 47 shops with their protecting family city-wide. HIGH (the player sees what his character can't know).
- The same page reports "Falco: on a war footing" — a war never mentioned on World or in news.
