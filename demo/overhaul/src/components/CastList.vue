<script setup lang="ts">
import { ITEM_INFO } from '../../../../src/overhaul/character/items';
import { backgroundOf, characters, now, selectedId, viewerId } from '../state';
</script>

<template>
  <section class="panel">
    <h2>The cast</h2>
    <div class="muted" style="margin-bottom: 8px">Pick someone to look at in full.</div>
    <button
      v-for="c in characters"
      :key="c.id"
      class="card"
      :class="{ selected: c.id === selectedId }"
      @click="selectedId = c.id"
    >
      <div class="row" style="justify-content: space-between">
        <strong>{{ c.name }}</strong>
        <span class="muted">{{ backgroundOf(c) }}</span>
      </div>
      <div class="row">
        <div class="bar" style="flex: 1"><span :style="{ width: `${(100 * c.condition.hitPoints) / c.condition.maxHitPoints}%` }" /></div>
        <span class="muted">{{ c.condition.hitPoints }}/{{ c.condition.maxHitPoints }}</span>
      </div>
      <div>
        <span v-if="c.condition.unconscious" class="chip bad">unconscious</span>
        <span v-else-if="c.condition.hurt" class="chip warn">hurt</span>
        <span v-for="e in c.condition.effects" :key="e" class="chip warn">{{ e }}</span>
        <span v-if="c.restingAt(now)" class="chip">resting</span>
        <span v-if="c.id === viewerId" class="chip">seeing as</span>
      </div>
      <div class="muted">${{ c.cash }} · {{ c.inventory.items.map((h) => ITEM_INFO[h.item].name.toLowerCase() + (h.state === 'carried' ? '' : ` (${h.state})`)).join(', ') || 'no items' }}</div>
    </button>
  </section>
</template>

<style scoped>
.card { display: block; width: 100%; text-align: left; background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
.card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
</style>
