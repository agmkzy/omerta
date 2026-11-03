<script setup lang="ts">
import { computed } from 'vue';
import { ATTRIBUTES, ATTRIBUTE_INFO, abilityModifier } from '../../../../src/overhaul/character/attributes';
import { CONDUCT } from '../../../../src/overhaul/character/conduct';
import type { Fact } from '../../../../src/overhaul/character/facts';
import { ITEM_INFO } from '../../../../src/overhaul/character/items';
import { partOf, type Version } from '../../../../src/overhaul/character/knowledge';
import { believedActor } from '../../../../src/overhaul/character/learning';
import { FEELINGS } from '../../../../src/overhaul/character/relationships';
import { SKILLS, SKILL_INFO } from '../../../../src/overhaul/character/skills';
import { TRAITS, TRAIT_INFO } from '../../../../src/overhaul/character/temperament';
import { backgroundOf, characters, clock, describeFact, facts, nameOf, person, selectedId, viewerId, words } from '../state';

const c = computed(() => person(selectedId.value));
const viewer = computed(() => person(viewerId.value));
const seen = computed(() => c.value.seenBy(viewer.value));
const others = computed(() => characters.value.filter((o) => o.id !== c.value.id));
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const fixed2 = (n: number) => n.toFixed(2);

/** How they came by a part of a fact, in words. */
function source(v: Version, part: 'who' | 'size'): string {
  const p = partOf(v, part);
  if (p === undefined) return '';
  return p.teller === undefined ? p.how : `${p.how}, from ${nameOf(p.teller)}`;
}

/** Each fact they know, with what they believe of it against what happened. */
const known = computed(() =>
  facts.value
    .filter((f) => c.value.knowledge[f.id] !== undefined)
    .map((f: Fact) => {
      const v = c.value.knowledge[f.id]!;
      const believed = believedActor(f, v);
      return {
        f,
        v,
        believed,
        wrong: f.actor !== undefined && believed !== undefined && believed !== f.actor,
        sizeWrong: f.kind !== 'lie' && v.exaggerated === true,
      };
    }),
);
</script>

<template>
  <section class="panel">
    <div class="row" style="justify-content: space-between">
      <h2>{{ c.name }} <span class="muted">· {{ backgroundOf(c) }}</span></h2>
      <span class="muted">The simulation's view: everything about them</span>
    </div>
    <div class="seen">
      <strong>As {{ viewer.name }} sees them:</strong>
      {{ seen.looks }}<template v-if="seen.items.length">, with {{ seen.items.map((h) => `${ITEM_INFO[h.item].name.toLowerCase()} (${h.state})`).join(', ') }}</template>.
      <span class="muted">Cash and carried items are private.</span>
    </div>

    <div class="cols">
      <div>
        <h3>Attributes</h3>
        <table>
          <tr v-for="a in ATTRIBUTES" :key="a">
            <td>{{ ATTRIBUTE_INFO[a].name }}</td>
            <td class="num">{{ c.data.attributes[a] }}</td>
            <td class="num muted">{{ signed(abilityModifier(c.data.attributes[a])) }}</td>
          </tr>
        </table>
        <h3>Temperament</h3>
        <table>
          <tr v-for="t in TRAITS" :key="t" :title="TRAIT_INFO[t].description">
            <td>{{ TRAIT_INFO[t].name }}</td>
            <td style="width: 40%"><div class="bar"><span :style="{ width: `${c.temperament[t] * 100}%` }" /></div></td>
            <td class="num">{{ fixed2(c.temperament[t]) }}</td>
            <td class="num muted">
              <template v-if="Math.abs(c.temperament[t] - c.data.startingTemperament[t]) > 1e-9">from {{ fixed2(c.data.startingTemperament[t]) }}</template>
            </td>
          </tr>
        </table>
      </div>
      <div>
        <h3>Skills</h3>
        <table>
          <tr><th>Skill</th><th>Training</th><th class="num">Bonus</th></tr>
          <tr v-for="s in SKILLS" :key="s" :class="{ muted: c.skills[s].training === 'untrained' }">
            <td>{{ SKILL_INFO[s].name }}</td>
            <td>{{ c.skills[s].training }}</td>
            <td class="num" :title="c.skills[s].modifiers.map((m) => `${m.reason} ${signed(m.value)}`).join('\n')">{{ signed(c.skills[s].bonus) }}</td>
          </tr>
        </table>
        <div class="muted" style="margin-top: 4px">Proficiency bonus {{ signed(c.data.proficiencyBonus) }}. Hover a bonus for its parts.</div>
      </div>
    </div>

    <h3>How they feel about others</h3>
    <table>
      <tr>
        <th>Towards</th>
        <th v-for="f in FEELINGS" :key="f" class="num">{{ f }}</th>
        <th>Last met</th>
      </tr>
      <tr v-for="o in others" :key="o.id">
        <td>{{ o.name }}</td>
        <template v-if="c.towards(o)">
          <td v-for="f in FEELINGS" :key="f" class="num">{{ fixed2(c.towards(o)![f]) }}</td>
          <td class="muted">{{ c.towards(o)!.lastMet === undefined ? 'only heard of' : clock(c.towards(o)!.lastMet!) }}</td>
        </template>
        <td v-else :colspan="FEELINGS.length + 1" class="muted">a stranger</td>
      </tr>
    </table>

    <h3>What they know</h3>
    <div v-if="!known.length" class="muted">Nothing yet.</div>
    <table v-else>
      <tr><th>Fact</th><th>What really happened</th><th>Who they think did it</th><th>How big</th><th>Learned</th></tr>
      <tr v-for="k in known" :key="k.f.id">
        <td class="muted">{{ k.f.id }}</td>
        <td>
          {{ describeFact(k.f) }}
          <span v-if="k.f.hiddenActor" class="chip">unseen</span>
          <span v-if="k.f.invented" class="chip bad">never happened</span>
        </td>
        <td>
          <span :class="{ bad: k.wrong }">{{ k.believed === undefined ? 'does not know' : nameOf(k.believed) }}</span>
          <span v-if="k.v.knownFalse" class="chip">knows it is false</span>
          <div class="muted">{{ source(k.v, 'who') }}<template v-if="k.v.blamed"> · has blamed {{ k.v.blamed.map(nameOf).join(', ') }}</template></div>
        </td>
        <td>
          <span :class="{ bad: k.sizeWrong }">{{ k.v.exaggerated ? 'bigger than it was' : 'as it was' }}</span>
          <div class="muted">{{ source(k.v, 'size') }}</div>
        </td>
        <td class="muted">{{ clock(k.v.learnedAt) }}<br />{{ words(k.v.source) }}</td>
      </tr>
    </table>

    <h3>Conduct</h3>
    <div v-if="!c.conduct.length" class="muted">Nothing has moved their traits yet.</div>
    <table v-else>
      <tr v-for="(s, i) in c.conduct" :key="i">
        <td class="muted">{{ clock(s.at) }}</td>
        <td>{{ CONDUCT[s.conduct].what }}</td>
        <td>{{ TRAIT_INFO[s.trait].name }} {{ s.direction > 0 ? '+' : '−' }}</td>
      </tr>
    </table>
  </section>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 700px) { .cols { grid-template-columns: 1fr; } }
.seen { background: var(--chip); border-radius: 8px; padding: 6px 10px; margin: 6px 0; }
</style>
