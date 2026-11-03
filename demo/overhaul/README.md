# Character overhaul demo

A browser page for trying the character code in `src/overhaul/character/` by hand: a small cast of rolled characters, and
the things they can do to each other. It uses the overhaul's code directly and nothing of the game's, and is not shipped.

```
npm run demo:dev         # http://localhost:5185
npm run demo:typecheck   # vue-tsc
```

- **The cast** (left): everyone's condition, cash and items. Pick someone to see them in full.
- **A character** (middle): the simulation's view of them: attributes, skills, current traits against their starting ones,
  how they feel about everyone else, each fact they know with what they believe of it against what happened, and their
  conduct. The box at the top is how the "Seeing as" character sees them.
- **Do something** (right): record an event, intimidate, persuade, lie, tell, fight, drink, spend time together, give an item
  or rest. Before a roll, the odds and the explanation are shown as the "Seeing as" character would judge them.
- **What happened** (bottom): each action, with the truth and how each person there saw it, and the record of facts.

Built with Vue 3. The cast is held in a shallow ref and swapped whole, never made reactive in depth, since a reactive proxy
would break the cast's identity checks. The overhaul's boundary test lets this page, and only this page, import from
`src/overhaul/`, and checks that it imports nothing of the game's or the lab's.
