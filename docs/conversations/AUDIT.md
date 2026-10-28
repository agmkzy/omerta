# Conversations: the audit (28 October 2026)

The owner's brief, *Complete conversation & dialogue system overhaul*, asks for an audit before any change. This is it. It was made
from the code and from a measuring tool that plays the game's conversations the way the screen does
(`src/tests/tools/convaudit.ts`): for every seat (associate, soldier, captain, underboss, consigliere, boss), a fresh world run for
twenty days, a conversation with each kind of man the player would talk to (his own superior, his own man, a peer, a senior man,
the boss, another family's made man, a shopkeeper, a civilian), and every opening choice played in a copy of the world, with what was
said and what was offered next written out. Run it with `npx tsx src/tests/tools/convaudit.ts <seed> <out.md>`.

## 1. The numbers, before (seed 3)

| | |
|---|---|
| conversations sampled | 36 (six seats × up to eight kinds of man) |
| opening choices offered | 583, **16.2 per conversation** |
| to his own superior | 21.2 |
| to his own man | 22.0 |
| to a peer / a senior man / another family | 17.0 / 17.0 / 15.3 |
| to a shopkeeper / a civilian | 13.7 / 10.3 |
| distinct actions | 61 interaction codes (`conv/acts/*`, 132 including answers and follow-ups) |
| answers followed only by the generic subject menu | most: after nearly every answer the "next" is *Business / Personal* |
| relationship arrows shown as cards (Trust ▲, Warmth ▲, Goodwill ▼) | after almost every social exchange (138 cards in one run) |

The screen groups these under five subjects (Work & money, Family business, People & rumours, Personal, Settle something), plus two
"lead" lines, so the player does not see sixteen buttons at once; but every subject opens onto its share of them, and the same
question is asked several ways under different subjects.

## 2. The architecture

| Layer | Modules | What it does |
|---|---|---|
| Presentation | `ui/talk2.ts`, `ui/between.ts`, `web/css/conversation.css` | the screen: the man, how he sees you, what is between you, the exchange, numbered choices sorted into subjects (`SUBJECT_OF`, `ENTRY` groups) |
| Conversation context | `conv/kit.ts` (`Visit`, `Thread`, `TalkMemory`), `conv/visit.ts` (begin, opening line, `everything`, `choose`, patience) | who is speaking to whom, where, what has been said this visit (`th.asked`, `th.used`, `th.spoken`), what he is waiting on, memory across visits (`social.talks`: topics, refusals, signatures) |
| Interactions | `conv/acts/{personal,info,business,org,confront,subjects,family}.ts` via `conv/acts/index.ts` | each `Act` says when it is offered (`offers`) and what happens (`run`): decision, world change, words |
| Running | `conv/run.ts` | performs an act: used-this-visit, asked-lately memory (`repeat`), patience, the ▲▼ card, the voice pass |
| Decisions | `conv/decide.ts`, `conv/deciders.ts`, `conv/minds.ts`, `conv/respond.ts` | the man's choice, with terms and grounds (honest or a cover) |
| Words | `conv/render.ts`, `voicesheet.ts`, `voice.ts`, `conv/acts/words.ts` (`speechFor`) | meanings to sentences by archetype (proud, bitter, schemer, earnest, hothead, cold, jovial, frightened); the speech pass |
| World doors | `conv/doors.ts` | the only way acts change the world (regard, favours, backers, matters, memos) |
| Knowledge | `conv/perception.ts`, `conv/beliefs.ts`, `core` facts and `known` | what each man knows and believes; what he may say |
| Commitments | `memos` (promise/threat/agreement), `favours`, `conv/obligations.ts`, `matters.ts` asks | what a conversation leaves behind |
| Subjects of talk | `conv/subjects/{between,life}.ts`, `matters.topicsWith` | what is between two men (debts, disputes, matters, promises) to raise |
| Arriving conversations | `encounters.ts` (`addEnc`, kinds: ent, place, matter, counsel, allegiance, courted, …), `conv/approach.ts` | men who come to the player with something; answered as numbered choices on their own screen, or by going to see him |
| Matters | `matters.ts`, `situ.ts`, `hearing.ts`, `charge.ts`, `contest.ts` | multi-day situations; their moves appear in Stories and, for the man in front of you, in conversation (`topicsWith`) |
| Orders | `command.ts`, `ui/orderview.ts`, `orders.ts`, `jobs.ts` | sending men, asking leave, reports |

There is one conversation engine (Gate 4 removed the old one). The fragmentation is not two engines; it is many small interactions
added one at a time, each with its own idea of who may be asked, and several family features (hearings, charges, the contest,
counsel, allegiance) that talk through *encounters and matters* rather than through the conversation, with their own wording.

## 3. The actions, and who is offered them

Each row: the interaction, how often it was offered in the sample, its label, and to whom.

| action | n | label | offered to |
|---|---|---|---|
| tk (an event) | 82 | What do you know about what happened to Mario? / Which places around here are hurting? | everyone |
| news | 36 | "What's new?" | everyone |
| spend | 36 | "Let me buy you a drink." | everyone |
| how | 36 | How are you keeping? / Everything all right with you? | everyone |
| old_times | 36 | Mind if I sit a minute? / Got a minute? | everyone |
| think | 36 | What do you make of…? | everyone |
| loan | 28 | "Could you lend me $500?" | everyone but his own men |
| ask_rep | 24 | What are people saying about me? | most |
| biz_none / op / sit_ask | 27 | How's business? / How's the business going? | most |
| ask_around | 19 | Ask around about him first | a man you are already talking to |
| intro | 19 | Walk over and say who you are | strangers |
| intro_via | 5 | Ask Louie to put in a word | strangers, another family's boss, your own boss |
| pick_member | 18 | What do you make of the others? | family |
| recommend | 15 | Would you put in a word for me? | his boss, peers, the boss, **his own man** |
| tell | 11 | "You hear what happened at …?" | many |
| promo | 9 | What would it take to be moved up? | his boss, senior men |
| leaders | 9 | Who's really running things? | his boss, **the boss himself** |
| work / b_need / b_more | 18 | Got any work? / Is there anything you need done? / I'm ready for more | superiors, peers |
| pick_concern | 7 | There's something you ought to know about a man | superiors |
| rv_drink, rv_mood, rv_ears, rv_warn | 24 | another family | another family |
| suggest, buy_ask, stake_ask | 18 | protection, buying, a piece | shopkeepers |
| earn | 5 | How do my numbers look? | his boss |
| b_tribute / help_gift | 8 | A little something for you ($300) / Take this ($200) | his boss / men |
| b_stand | 5 | Where do I stand with you? | his boss |
| run_ask | 5 | Offer to run his chop shop | a peer, **his own man** |
| fam_report, fam_more | 10 | "How are things at your end?" / "I expect more from you." | his own man, senior men |
| assign_low, assign_hustle | 8 | Keep your head down / Find yourself something extra | his own man |
| ask_want, ask_crew, ask_history, congrats, cr_* | 14 | What are you after? / How are you getting along with the others? / We've been through a bit | his own man |
| borrow, help_loan | 5 | Ask to borrow money / Offer to lend him money | |
| fam_books, fam_crew, fam_name, rk_back | 6 | the books; a crew of my own; put a man's name forward; back me | |
| enc_open | 2 | About what he asked: … | the man who asked |

## 4. What is wrong

### Structural (the cause is in how things are built)
1. **Who may be asked is decided per action, inconsistently.** There is no shared notion of what the other man is to the player
   (his superior, his man, a peer, a stranger, another family) and of what each seat may ask of each. Result: a captain asks his own
   soldier to "put in a word" for him; the consigliere asks the boss to put in a word (with whom?) and who is really running things;
   a captain offers to run his own soldier's chop shop; "Ask Louie to put in a word" is offered to a shopkeeper and to another family's
   boss. (`recommend`, `leaders`, `run_ask`, `intro_via`.)
2. **Several actions for one intention.** Career: *Is there anything you need done*, *What would it take to be moved up*, *Where do I
   stand with you*, *Would you put in a word for me*, *What about the books*, *I'm ready for more*, *I'd be grateful if you'd back me*:
   seven buttons for three intentions (where do I stand; what would it take; will you speak for me). Small talk: *How are you
   keeping*, *Mind if I sit a minute*, *Let me buy you a drink*, *What's new*: four for two. Ambition: *What do you want out of all
   this* and *What are you after, in all this*. Business: three "How's business?" codes. Events: *What do you know about what
   happened at X* and *You hear what happened at X* both offered at once.
3. **Answers wired to the wrong intention.** *Mind if I sit a minute?* answers with a police report; *Let me buy you a drink* runs
   three unrelated things together (the hour spent, a rumour, his ambitions); asking *what do you know about X* **tells** him about
   X ("He files it away. Now he knows").
4. **Follow-ups are the subject menu.** After nearly every answer the next choices are the generic subjects, not what one would say
   next about what was just said. Only the event, loan, haggle and opinion branches have real follow-ups.
5. **Mechanics shown as speech-adjacent text.** The ▲▼ card after every exchange (Trust ▲ · Warmth ▲ · Goodwill ▼), the "where do I
   stand" answer that recites the promotion road ("it all adds up over the whole climb: what you declare and hand over… Gifts make
   friends; they are not earnings"), rumours with ledger figures ("It costs Tommy Russo $249 and some weeks").
6. **The family features talk elsewhere.** Hearings, the underboss's charge, the contest, counsel and allegiance are matters and
   encounters with their own wording; in conversation with the man concerned they appear only through `topicsWith`, and the
   consigliere has nothing of his own to say to his boss.
7. **Perspective is assembled by string replacement.** `speechFor` and the voice pass rewrite lines after the fact; names are
   interpolated without regard to who is speaking (a shopkeeper called Louie says "If Louie says" of the player's captain Louie).

### Content (the words)
- "a underboss"; "To be a boss, the only way up is for the man above you to stop being the boss. How that happens is your business"
  (said by the boss to his underboss); "You ask a lot of questions for a man I hardly know" (said by the player's own captain);
  "Nobody's asked me anything straight in years" as a preface to answering what people say about you; doubled quotation marks in
  labels (""Let me buy you a drink.""); a lone grunt as the whole answer to *Who's really running things?*.

### What works and should stay
- Knowledge: what a man tells is what he knows (`known`, beliefs, honest or cover grounds); the event branch (who told you, who did it,
  who would know) is a real, short, coherent exchange.
- Memory: asked again unchanged, he says so (`repeat` signatures); used-this-visit greys out; refusals remembered.
- Commitments: backers, favours, memos and matters are real records with consequences.
- Voices by archetype; the loan and haggle branches; the man's opening line (what is on his mind first).

## 5. What should be consolidated, and what kept apart
- **One relation, one place:** a single `standingBetween(player, man)` (his superior; his man; above him in the chain; a peer of the
  family; another family; outside the life; stranger) that every action's availability reads, instead of each act testing ranks.
- **Career, three intentions:** *Where do I stand?* (information: how he sees you, what he knows of the line or of a crew, as he would
  know it), *What would it take?* (follow-up to it, not a separate button), *Would you speak for me?* (a request, remembered,
  with its own follow-ups); *I want a crew of my own* (ambition, soldier to captain) and *I want to put X's name forward* (a made
  man's request for his man) as distinct.
- **Small talk, two intentions:** *How are you keeping?* (him) and *Let me buy you a drink* (time together; what comes up is what is
  on his mind, said once); news is *Heard anything?* and leads to the event branch.
- **Your own man:** *How are things at your end?* (his work and money), *What are you after?* (what he wants), *Something's wrong*
  (when it is), orders as orders (*Keep your head down*, *Find something extra*), *I expect more* — one each.
- **Keep apart:** encounters (a man came to you, now) and conversation (you went to him); Stories (the record of a matter) and
  conversation (raising it with the man in it); organisational screens (setting the family's direction, appointments) and
  conversation (talking about them with a man).
- **Move out of conversation:** *Ask around about him first* (it is not said to him; belongs on his page), *Ask Louie to put in a
  word* (becomes saying who sent you, to strangers only).

## 6. The plan
1. Structural: the relation helper; availability rules read from it; the speaker-relative wording helper (`conv/persp.ts`).
2. The menu: consolidate the duplicates above; remove the misdirected; at most a handful of opening lines per man, those most
   relevant to what is between you first.
3. Coherence: every remaining action reviewed as intention → interpretation → answer → state → follow-up; the ▲▼ card replaced by
   narration when something noticeable changed; mechanics out of speech.
4. The family features in conversation: the hearing's moves, the charge, the contest, counsel and the consigliere's advice raised
   with the man concerned, in his words.
5. Tests: the audit run as a test (no misdirected actions, no self-naming, no player named to his face, no empty answers, nothing
   offered that the seat may not ask), continuity scenarios, and the browser at all six seats.
