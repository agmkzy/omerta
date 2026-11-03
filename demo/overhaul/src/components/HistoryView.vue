<script setup lang="ts">
import { clock, describeFact, facts, history, nameOf, words } from '../state';
</script>

<template>
  <section class="bottom">
    <div class="panel">
      <h2>What happened</h2>
      <div v-if="!history.length" class="muted">Nothing yet. Start with "Something happens", then have people lie about it and tell each other.</div>
      <article v-for="(e, i) in history" :key="history.length - i" class="entry">
        <div class="row"><span class="muted">{{ clock(e.at) }}</span><strong>{{ e.title }}</strong></div>
        <div v-if="e.seen.length" class="seen">
          <span v-for="s in e.seen" :key="s.who" class="chip">{{ s.who }} saw: {{ words(s.text) }}</span>
          <span class="muted">Anyone else saw nothing.</span>
        </div>
        <ul>
          <li v-for="(line, j) in e.truth" :key="j">{{ line }}</li>
        </ul>
      </article>
    </div>
    <div class="panel">
      <h2>The record of facts</h2>
      <div class="muted" style="margin-bottom: 6px">What really happened, as the simulation holds it. No character sees this list.</div>
      <div v-if="!facts.length" class="muted">No facts yet.</div>
      <table v-else>
        <tr><th>Id</th><th>When</th><th>What</th><th>Witnesses</th><th>Notes</th></tr>
        <tr v-for="f in [...facts].reverse()" :key="f.id">
          <td class="muted">{{ f.id }}</td>
          <td class="muted">{{ clock(f.at) }}</td>
          <td>{{ describeFact(f) }}</td>
          <td>{{ f.witnesses.map(nameOf).join(', ') || '—' }}</td>
          <td>
            <span v-if="f.hiddenActor" class="chip">unseen</span>
            <span v-if="f.invented" class="chip bad">never happened, invented by {{ nameOf(f.invented) }}</span>
            <span v-if="f.ending" class="chip">{{ words(f.ending) }}</span>
            <span v-if="f.claim && 'blame' in f.claim" class="chip">claimed {{ nameOf(f.claim.blame) }} did it</span>
            <span v-if="f.claim && 'exaggerated' in f.claim" class="chip">claimed it was {{ f.claim.exaggerated ? 'bigger' : 'smaller' }}</span>
            <span v-if="f.cause" class="chip">about {{ f.cause }}</span>
            <span v-if="f.amount !== undefined" class="chip">{{ f.amount }}</span>
          </td>
        </tr>
      </table>
    </div>
  </section>
</template>

<style scoped>
.bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 16px 24px; align-items: start; }
@media (max-width: 1100px) { .bottom { grid-template-columns: 1fr; } }
.entry { border-top: 1px solid var(--line); padding: 8px 0; }
.entry ul { margin: 4px 0 0; padding-left: 18px; }
.seen { margin-top: 4px; }
</style>
