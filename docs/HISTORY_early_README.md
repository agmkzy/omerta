# OMERTÀ

A single-player sandbox mafia RPG set in 1970s New York. This is the **simulation core plus a text interface**: the foundation everything else (map, portraits, management screens) will sit on top of.

If the world can't produce good stories as plain text, no illustrated map will save it, so that is what exists first.

## Run it

```
npm install            # tsx, typescript, @types/node
npm run sim -- --seed 4 --days 180 --last 60     # watch the world run without you
npm run sim -- --seed 4 --out history.txt         # full history to a file
npm run play -- --new --seed 4                    # play (autosaves to omerta-save.json)
npm run play                                      # continue your save
npm test                                          # determinism, save/load, sanity
```

## What's in it

- **One character.** You're an associate of the Corrente family with $1,500 and three men of your own. Your crew acts on its own and kicks 20% of what it earns up to you each week.
- **A living world.** 3 families (boss, underboss, capos, soldiers, associates), 15 shopkeepers, 5 casinos and shops, rackets, loans. Everyone acts on their own schedule through a utility AI scored by personality (greed, violence, caution, ambition, vice...).
- **Knowledge is a mechanic.** Every event is a `Fact`. A character only knows facts they witnessed or were told. Some events hide who did it (arson, robbery, murder), and victims *guess*, sometimes wrongly, which starts feuds.
- **Real debts.** A loan is an object with a weekly payment, interest, missed payments, defaults and consequences (collection visits, beatings, grudges).
- **Same rules for you and the NPCs.** `generate()` produces the options; NPCs pick the best-scoring one, you pick from a menu.
- **Time stops while you decide.** Each action costs in-game minutes. The world advances by exactly that amount. There is no offline progression.

## Jobs, schemes and delegation (v2)

- **Fewer, heavier events.** NPCs keep their heads down after violence (a `restraint` cooldown), so incidents are rarer and each one leaves a mark.
- **Inbox.** Work reaches you from your boss (collect, bring a shop under the family, handle someone who wronged the family), from people who trust you (tip-offs: "this guy did this to me, I'll pay you to handle him"), from contracts (murder for hire) and from opportunities (a garage that buys cars, a pawnbroker, a flush mark).
- **Approaches with consequences.** Every job has 2-3 ways to play it. A guessed culprit may be innocent.
- **Delegation.** Hand any job to a crew member with quiet or hard orders; he reports back later and kicks up your cut.
- **Your own schemes.** Boost cars, burgle, con a mark, open a chop shop, fence goods and cars.
- **Conversations.** After spending time with someone you pick what to say: ask around, ask for work, ask about business, suggest protection, buy a drink.
- **Families.** Every name carries a family tag; the World tab filters people by family and shows how tense the families are.
- `src/jobs.ts` holds all of it; `npm run bot` plays the game with a random policy as a regression check.

## Layout

| File | Role |
| --- | --- |
| `src/types.ts` | Data model (characters, businesses, debts, facts) |
| `src/core.ts` | Knowledge/gossip, facts, debts, death and succession |
| `src/world.ts` | World generator |
| `src/actions.ts` | Options, NPC AI scoring, action effects |
| `src/engine.ts` | Event queue, weekly economy, saves, reports |
| `src/jobs.ts` | Offers, jobs, delegation, schemes, chop shop, conversation topics |
| `src/web.ts` | Mobile UI (the main interface now) |
| `src/cli.ts` | `sim` and `play` commands (legacy: no jobs UI) |
| `src/rng.ts` | Seeded RNG: same seed, same history |

## Design rule

Nothing happens without a reason, and nothing significant happens without consequences. Facts carry a `cause` link so the game can answer "why did this happen?" (see the `Intel` screen).

## Known gaps / next steps

- Player income is generous when you grind schemes; needs sinks (upkeep, bribes, boss's cut).
- Conversation topics are a short menu; no branching dialogue trees yet.
- Rank progression above soldier, family politics and boss-level decisions are not implemented.
- NPCs don't yet seek out information on purpose (asking around, informants).
- No tension-balancing beyond grudge decay and cooldowns; long runs (years) need tuning.
- Visual layer (illustrated map, portraits) is deliberately not started.

## Mob life expansion (v3)

- **Books and kick-ups** (`books.ts`): every member has per-source earnings, expenses, what he owes up and receives from below, arrears and flags. Hidden income is skimming space. Superiors audit, warn, demand, punish; the boss can levy. You can be honest, shave or stall.
- **Meetings** (`meetings.ts`): crew, accounts, family, sit-downs and dinners built from real world state; grievances may or may not be valid.
- **Dialogue** (`dialogue.ts`): Personal, Business, Family, Disputes, Orders; NPCs remember promises, threats and agreements.
- **Contracts that can lie** (`jobs.ts`, `consequences.ts`): ask why, check it out, ask around, haggle. Killings bring delayed heat, blackmail and exposed lies.
- **Career** (`career.ts`): promotion needs earnings, a sponsor, a vacancy and the boss's agreement. Made-man induction is a playable ceremony; captains recommend and recruit; NPCs compete under the same rules; succession is by merit.
- Bot: `npm run bot -- <seed> <days>`.
