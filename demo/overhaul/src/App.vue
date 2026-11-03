<script setup lang="ts">
import ActionPanel from './components/ActionPanel.vue';
import CastList from './components/CastList.vue';
import CharacterView from './components/CharacterView.vue';
import HistoryView from './components/HistoryView.vue';
import { advance, characters, clock, now, reset, seed, viewerId } from './state';
</script>

<template>
  <header class="top">
    <div>
      <h1>Character overhaul demo</h1>
      <div class="muted">The character code in <code>src/overhaul/character/</code>, running in the browser. Nothing here touches the game.</div>
    </div>
    <div class="row">
      <strong>{{ clock(now) }}</strong>
      <button class="quiet" @click="advance(10)">+10 min</button>
      <button class="quiet" @click="advance(60)">+1 hour</button>
      <button class="quiet" @click="advance(8 * 60)">+8 hours</button>
      <button class="quiet" @click="advance(24 * 60)">+1 day</button>
    </div>
    <div class="row">
      <label class="row">Seeing as
        <select v-model="viewerId">
          <option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="row">Seed <input v-model.number="seed" type="number" style="width: 5em" /></label>
      <button class="quiet" @click="reset">New world</button>
    </div>
  </header>
  <main class="grid">
    <CastList />
    <CharacterView />
    <ActionPanel />
  </main>
  <HistoryView />
</template>

<style scoped>
.top { display: flex; gap: 16px; justify-content: space-between; align-items: center; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); }
.grid { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(0, 2.2fr) minmax(300px, 1.4fr); gap: 12px; padding: 12px 16px; align-items: start; }
@media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
</style>
