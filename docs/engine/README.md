# Engine reference

One document per group of systems. Each covers every module's purpose, the `World` state it owns, its public API, its tick hooks, who calls it, its invariants, save-compatibility notes, known issues, and what a replacement would have to provide. Read [../04-architecture.md](../04-architecture.md) first for how the groups fit together.

| Doc | Systems |
| --- | --- |
| [01-core-simulation.md](01-core-simulation.md) | The clock and **the tick, step by step**; the `World` shape; facts, knowledge, relationships, scheduling; world generation; retention; consistency checks; news and pulse |
| [02-economy.md](02-economy.md) | Businesses and their cash door (`bizMove`), books and kick-ups, the ledger, debts, rackets, hustles, gigs, blackjack, specialisations, reports; **money conservation** |
| [03-npc-autonomy.md](03-npc-autonomy.md) | The utility AI (**how an NPC decides**), NPC goals, ambitions, crew life, revenge, delayed consequences, disputes, violence, threats; the **situations lifecycle** |
| [04-organisations-careers.md](04-organisations-careers.md) | Families as organisations, rank and hierarchy repair, careers and promotion, the player's path, boss powers, politics, coups, the Commission; **the player's career end to end** |
| [05-social-meetings-life.md](05-social-meetings-life.md) | Social clubs and resumable scenes, meetings and sit-downs, the induction ceremony, private life, orders and day jobs |
| [06-jobs-encounters.md](06-jobs-encounters.md) | Jobs (offers, approaches, resolution, delegation), encounters, favours; the **job lifecycle** and every **commitment** record |
| [07-conversation.md](07-conversation.md) | Dialogue, flows, negotiation, voices; **spec rules and where they are enforced**; adding a conversation option |
| [08-ui-and-entry-points.md](08-ui-and-entry-points.md) | `web.ts`, the views, the template; the **rendering model**, the **action code table**, UI state vs world state; the CLI, bot, stress and playtest tools |

## Module lookup

| Module | Doc | | Module | Doc |
| --- | --- | --- | --- | --- |
| actions.ts | [03](03-npc-autonomy.md#actionsts) | | meetings.ts | [05](05-social-meetings-life.md) |
| ambition.ts | [03](03-npc-autonomy.md) | | memory.ts | [01](01-core-simulation.md#memoryts) |
| background.ts | [01](01-core-simulation.md#backgroundts) | | negotiate.ts | [07](07-conversation.md) |
| blackjack.ts | [02](02-economy.md) | | news.ts | [01](01-core-simulation.md#newsts) |
| books.ts | [02](02-economy.md) | | notebook.ts | [01](01-core-simulation.md#notebookts) |
| bot.ts | [08](08-ui-and-entry-points.md) | | orders.ts | [05](05-social-meetings-life.md) |
| career.ts | [04](04-organisations-careers.md) | | orgs.ts | [04](04-organisations-careers.md) |
| cli.ts | [08](08-ui-and-entry-points.md) | | path.ts | [04](04-organisations-careers.md) |
| club.ts, clubdata.ts | [05](05-social-meetings-life.md) | | people.ts | [01](01-core-simulation.md#peoplets) |
| consequences.ts | [03](03-npc-autonomy.md) | | places.ts | [01](01-core-simulation.md#placests) |
| consistency.ts | [01](01-core-simulation.md#consistencyts) | | politics.ts | [04](04-organisations-careers.md) |
| core.ts | [01](01-core-simulation.md#corets) | | powers2.ts | [04](04-organisations-careers.md) |
| crewlife.ts | [03](03-npc-autonomy.md) | | pulse.ts | [01](01-core-simulation.md#pulsets) |
| danger.ts | [03](03-npc-autonomy.md) | | rackets.ts | [02](02-economy.md) |
| dialogue.ts | [07](07-conversation.md) | | rank.ts | [04](04-organisations-careers.md) |
| disputes.ts | [03](03-npc-autonomy.md) | | reports.ts | [02](02-economy.md) |
| econ.ts | [02](02-economy.md) | | retain.ts | [01](01-core-simulation.md#retaints) |
| encounters.ts | [06](06-jobs-encounters.md) | | revenge.ts | [03](03-npc-autonomy.md) |
| engine.ts | [01](01-core-simulation.md#enginets) | | rng.ts | [01](01-core-simulation.md#rngts) |
| flows.ts | [07](07-conversation.md) | | situations.ts, situ.ts, sitmoves.ts | [03](03-npc-autonomy.md) |
| gigs.ts | [02](02-economy.md) | | specs.ts | [02](02-economy.md) |
| goals.ts | [03](03-npc-autonomy.md) | | storage.ts | [../02-state-saves-and-compatibility.md](../02-state-saves-and-compatibility.md#3-browser-persistence) |
| hustle.ts | [02](02-economy.md) | | stress.ts | [08](08-ui-and-entry-points.md) |
| jobs.ts | [06](06-jobs-encounters.md) | | types.ts | [01](01-core-simulation.md#typests) |
| ledger.ts | [02](02-economy.md) | | violence.ts | [03](03-npc-autonomy.md) |
| life.ts | [05](05-social-meetings-life.md) | | voice.ts, voicesheet.ts | [07](07-conversation.md) |
| ways.ts | [06](06-jobs-encounters.md) | | web.ts, ui/*, web/template.html | [08](08-ui-and-entry-points.md) |
| where.ts | [01](01-core-simulation.md#wherets) | | world.ts | [01](01-core-simulation.md#worldts) |
| playtest/pt.ts | [08](08-ui-and-entry-points.md) | | tests | [../05-testing.md](../05-testing.md) |

## A note on accuracy

These documents were written by reading the V85 source in full, module by module. Signatures are copied from the code. Every "Known issues" entry that was a bug was then checked against the source a second time before being filed in the [V85 baseline review](https://github.com/agmkzy/omerta/milestone/1) milestone. When the code changes, update the relevant section in the same pull request. A stale reference doc is worse than none.
