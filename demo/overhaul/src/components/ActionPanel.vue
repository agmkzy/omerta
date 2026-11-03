<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { squad, type Cast, type Character } from '../../../../src/overhaul/character/cast';
import { OUTCOMES, type Modifier } from '../../../../src/overhaul/character/check';
import type { Id } from '../../../../src/overhaul/character/character';
import { FACT_KINDS, type FactKind } from '../../../../src/overhaul/character/facts';
import type { FightEvent, FightKind, FightStart } from '../../../../src/overhaul/character/fight';
import { ITEM_INFO, type Item } from '../../../../src/overhaul/character/items';
import { ENDINGS, type Claim, type SocialCheck } from '../../../../src/overhaul/character/social';
import type { TellCheck } from '../../../../src/overhaul/character/tell';
import { attempt, characters, describeFact, facts, nameOf, person, problem, run, viewerId, words, type Entry } from '../state';

type Action = 'intimidate' | 'persuade' | 'lie' | 'tell' | 'fight' | 'drink' | 'rest' | 'together' | 'give' | 'record';
const ACTIONS: readonly { id: Action; label: string; help: string }[] = [
  { id: 'record', label: 'Something happens', help: 'Record an event, such as a robbery, with whoever saw it. Everyone there learns it.' },
  { id: 'intimidate', label: 'Intimidate', help: 'Intimidation against Nerve. A volatile target can be provoked.' },
  { id: 'persuade', label: 'Persuade', help: 'Persuasion against Insight.' },
  { id: 'lie', label: 'Lie', help: 'Deception against Insight: lie about who did something, how big it was, or invent something.' },
  { id: 'tell', label: 'Tell', help: 'Pass on what they believe of a fact. It rolls only if it contradicts what the listener believes.' },
  { id: 'fight', label: 'Fight', help: 'A real fight or a sparring match, between two squads.' },
  { id: 'drink', label: 'Drink', help: 'Drink a bottle of spirits: Carousing against DC 12, or end up drunk.' },
  { id: 'together', label: 'Spend time together', help: 'Everyone chosen meets everyone else, and nothing else changes.' },
  { id: 'give', label: 'Give an item', help: 'Hand a carried item to someone there.' },
  { id: 'rest', label: 'Rest', help: 'Rest from now. A full night (8 hours) heals fully; while resting, they can take part in nothing.' },
];

const action = ref<Action>('record');
const actorId = ref<Id>('sam');
const targetId = ref<Id>('rico');
const witnesses = ref<Id[]>([]);
// lies
const claimKind = ref<'blame' | 'size' | 'invent'>('blame');
const factId = ref<string>('');
const blameId = ref<Id>('joe');
const bigger = ref(true);
const inventKind = ref<FactKind>('robbery');
const inventActor = ref<Id>('joe');
const inventVictim = ref<Id | ''>('');
// fights
const fightKind = ref<FightKind>('real');
const fightStart = ref<FightStart>('ordinary');
const allies = ref<Id[]>([]);
const foes = ref<Id[]>([]);
// others
const company = ref<Id[]>([]);
const hours = ref(8);
const item = ref<Item | ''>('');
// recording
const recordKind = ref<FactKind>('robbery');
const recordActor = ref<Id | ''>('joe');
const recordVictim = ref<Id | ''>('vic');
const hidden = ref(false);

const help = computed(() => ACTIONS.find((a) => a.id === action.value)!.help);
const viewer = computed(() => person(viewerId.value));
const actor = computed(() => person(actorId.value));
const target = computed(() => person(targetId.value));
const needsTarget = computed(() => ['intimidate', 'persuade', 'lie', 'tell', 'fight', 'give'].includes(action.value));
const usesWitnesses = computed(() => ['intimidate', 'persuade', 'lie', 'fight', 'record'].includes(action.value));
const bystanders = computed(() =>
  characters.value.filter((c) => {
    if (action.value === 'record') return c.id !== recordActor.value && c.id !== recordVictim.value;
    return c.id !== actorId.value && (!needsTarget.value || c.id !== targetId.value) && !allies.value.includes(c.id) && !foes.value.includes(c.id);
  }),
);
const actorFacts = computed(() => facts.value.filter((f) => actor.value.knowledge[f.id] !== undefined));
const carried = computed(() => actor.value.inventory.items.filter((h) => h.state === 'carried').map((h) => h.item));
watch(actorFacts, (list) => {
  if (!list.some((f) => f.id === factId.value)) factId.value = list.at(-1)?.id ?? '';
}, { immediate: true });
watch(carried, (list) => {
  if (item.value === '' || !list.includes(item.value)) item.value = list[0] ?? '';
}, { immediate: true });

// a new action starts with no one else picked
watch(action, () => {
  witnesses.value = [];
  allies.value = [];
  foes.value = [];
  company.value = [];
});

const present = (ids: readonly Id[]) => ids.filter((id) => characters.value.some((c) => c.id === id));
const witnessIds = computed(() => present(witnesses.value).filter((id) => bystanders.value.some((c) => c.id === id)));

function claim(): Claim {
  if (claimKind.value === 'invent') {
    return { invented: { kind: inventKind.value, actor: inventActor.value, ...(inventVictim.value !== '' && { victim: inventVictim.value }) } };
  }
  if (factId.value === '') throw new RangeError(`${actor.value.name} knows of nothing to lie about yet`);
  return claimKind.value === 'blame' ? { about: factId.value, blame: blameId.value } : { about: factId.value, exaggerated: bigger.value };
}

function socialFrom(a: Character, t: Character): SocialCheck<Cast> {
  if (action.value === 'intimidate') return a.social.intimidate(t);
  if (action.value === 'persuade') return a.social.persuade(t);
  return a.social.deceive(t).claim(claim());
}

/** The check about to be rolled, for its odds and explanation, or why it cannot be made. */
const social = computed(() => (['intimidate', 'persuade', 'lie'].includes(action.value) ? attempt(() => socialFrom(actor.value, target.value)) : null));
const tell = computed(() => (action.value === 'tell' ? attempt((): TellCheck<Cast> => actor.value.social.tell(target.value, factId.value)) : null));

const percent = (p: number) => `${Math.round(p * 100)}%`;
const signed = (m: Modifier) => `${m.reason} ${m.value >= 0 ? '+' : ''}${m.value}`;
const socialOdds = computed(() => {
  const s = social.value?.value;
  if (!s) return null;
  const odds = s.odds({ for: viewer.value });
  return ENDINGS.map((e) => ({ e, p: odds[e] })).filter((x) => x.p > 0);
});
const tellOdds = computed(() => {
  const t = tell.value?.value;
  if (!t) return null;
  const odds = t.odds({ for: viewer.value });
  return OUTCOMES.map((e) => ({ e, p: odds[e] }));
});

const when = (round: number) => (round === 0 ? 'At the start' : `Round ${round}`);
const NERVE_WHY: Record<string, string> = { start: '', hurt: 'at half health, ', 'allies-down': 'half their side down, ' };
const STATUS: Record<string, string> = { fighting: 'still standing', fleeing: 'turns to run', beaten: 'is beaten', 'knocked-out': 'is knocked out', fled: 'is gone' };
const FINAL: Record<string, string> = { fighting: 'still standing', fleeing: 'still running', beaten: 'beaten', 'knocked-out': 'knocked out', fled: 'got away' };

/** How a fight went, a line for each thing that happened. */
function eventLine(e: FightEvent): string {
  switch (e.kind) {
    case 'ambush':
      return `Ambush: Stealth ${e.stealth.total}; ${e.surprised.length ? `${e.surprised.map(nameOf).join(', ')} caught by surprise` : 'they were noticed'}`;
    case 'initiative':
      return `Order: ${e.order.map(nameOf).join(', ')}`;
    case 'nerve':
      return `${when(e.round)}: ${nameOf(e.id)} ${e.check.passed ? 'holds their nerve' : 'loses their nerve'} (${NERVE_WHY[e.trigger]}${e.check.result.roll.total} against ${e.check.result.dc})${e.temper ? ', and loses their temper' : ''}`;
    case 'attack':
      return `${when(e.round)}: ${nameOf(e.by)} ${e.hit === 'miss' ? 'misses' : e.hit === 'critical' ? 'lands a critical hit on' : 'hits'} ${nameOf(e.target)}${e.hit === 'miss' ? '' : ` for ${e.damage} (${e.hp} left)`}${e.free ? ', as they run' : ''}`;
    case 'escape':
      return `${when(e.round)}: ${nameOf(e.id)} ${e.got === 'caught' ? 'tries to get away, and is caught' : e.got === 'away-chased' ? `breaks away, but ${nameOf(e.from ?? undefined)} gets a hit in first` : 'gets away'}`;
    case 'status':
      return `${when(e.round)}: ${nameOf(e.id)} ${STATUS[e.status]}`;
    case 'end':
      return `End of round ${e.round}`;
  }
}

/** Who learned a fact, and what they now believe of it. */
function learners(c: Cast, factIds: readonly string[]): string[] {
  return factIds.flatMap((id) => {
    const f = c.fact(id);
    const who = c.characters.filter((x) => x.knowledge[id] !== undefined).map((x) => x.name);
    return [`${id}: ${describeFact(f)}. Known to ${who.join(', ') || 'no one'}.`];
  });
}

function doIt(): void {
  const a = actorId.value;
  const t = targetId.value;
  const ws = witnessIds.value;
  run((c, dice, now) => {
    const me = c.character(a);
    const them = c.character(t);
    const there = (ids: readonly Id[]) => ids.map((id) => c.character(id));
    switch (action.value) {
      case 'intimidate':
      case 'persuade':
      case 'lie': {
        const out = socialFrom(me, them).roll(dice, { now, witnesses: ws });
        const check = out.truth.check;
        const seen = [a, t, ...ws].map((id) => {
          const ending = String(out.result({ for: out.cast.character(id) }).ending);
          return { who: out.cast.character(id).name, text: id === t ? `${ending} (knows exactly)` : ending };
        });
        const entry: Omit<Entry, 'at'> = {
          title: `${me.name} ${action.value === 'lie' ? 'lies to' : action.value === 'intimidate' ? 'intimidates' : 'persuades'} ${them.name}`,
          truth: [`Ending: ${words(out.truth.ending)} (${check.active.total} against ${check.passive.total})`, ...learners(out.cast, out.truth.facts.map((f) => f.id))],
          seen,
        };
        return { cast: out.cast, entry };
      }
      case 'tell': {
        const out = me.social.tell(them, factId.value).roll(dice, { now });
        const r = out.truth.roll;
        const truth = [
          r ? `It contradicted what ${them.name} believed: Persuasion ${r.roll.total} against ${r.dc}, ${words(r.outcome)}` : `No roll needed`,
          out.truth.changed === 'all' ? `${them.name} had not heard of it, and now believes it as told` : out.truth.changed.length ? `${them.name} now believes ${out.truth.changed.map((p) => (p === 'who' ? 'who did it' : 'how big it was')).join(' and ')} as told` : `${them.name} believes nothing new`,
          ...out.truth.exposed.map((id) => `A lie came out: ${id}, ${describeFact(out.cast.fact(id))}`),
        ];
        return { cast: out.cast, entry: { title: `${me.name} tells ${them.name} about ${factId.value}`, truth, seen: [] } };
      }
      case 'fight': {
        const out = squad(me, ...there(allies.value.filter((id) => id !== a && id !== t))).fight(squad(them, ...there(foes.value.filter((id) => id !== a && id !== t))), { kind: fightKind.value, start: fightStart.value }).roll(dice, { now, witnesses: ws });
        const r = out.result;
        const truth = [
          `${r.winner === null ? 'A stalemate' : `${r.winner === 'attacker' ? me.name : them.name}'s side wins`}, ${r.rounds === 0 ? 'before the first round' : `in ${r.rounds} round${r.rounds === 1 ? '' : 's'}`}`,
          ...r.fighters.map((f) => `${nameOf(f.id)}: ${FINAL[f.status]}, ${f.hp}/${f.maxHp} hit points${f.lostNerve ? ', lost their nerve' : ''}`),
          ...learners(out.cast, out.facts.map((f) => f.id)),
          ...r.events.filter((e) => e.kind !== 'end').map(eventLine),
        ];
        return { cast: out.cast, entry: { title: `${fightKind.value === 'sparring' ? 'Sparring' : 'A fight'}: ${me.name} against ${them.name}`, truth, seen: [] } };
      }
      case 'drink': {
        const out = me.drink(dice, { now, with: there(company.value.filter((id) => id !== a)) });
        return { cast: out.cast, entry: { title: `${me.name} drinks a bottle`, truth: [`Carousing ${out.result.roll.total} against ${out.result.dc}: ${out.drunk ? 'drunk' : 'holds it'}`], seen: [] } };
      }
      case 'together': {
        const people = [a, ...company.value.filter((id) => id !== a)];
        return { cast: c.together(people, { now }), entry: { title: `${people.map(nameOf).join(', ')} spend time together`, truth: ['They meet, and their familiarity grows'], seen: [] } };
      }
      case 'give': {
        if (item.value === '') throw new RangeError(`${me.name} carries nothing to give`);
        return { cast: me.give(them, item.value, { why: 'a gift', now }), entry: { title: `${me.name} gives ${them.name} the ${ITEM_INFO[item.value].name.toLowerCase()}`, truth: ['Recorded as a transfer'], seen: [] } };
      }
      case 'rest': {
        const next = me.rest({ now, hours: hours.value });
        return { cast: next, entry: { title: `${me.name} rests for ${hours.value} hours`, truth: [`${next.character(a).condition.hitPoints}/${next.character(a).condition.maxHitPoints} hit points afterwards`], seen: [] } };
      }
      case 'record': {
        const input = {
          kind: recordKind.value,
          ...(recordActor.value !== '' && { actor: recordActor.value }),
          ...(recordVictim.value !== '' && { victim: recordVictim.value }),
          ...(hidden.value && { hiddenActor: true as const }),
        };
        const out = c.record(input, { now, witnesses: ws });
        return { cast: out.cast, entry: { title: `Recorded: ${describeFact(out.fact)}`, truth: learners(out.cast, [out.fact.id]), seen: [] } };
      }
    }
  });
}

const lists = { allies, foes, company, witnesses };
const toggle = (name: keyof typeof lists, id: Id) => {
  const list = lists[name];
  list.value = list.value.includes(id) ? list.value.filter((x) => x !== id) : [...list.value, id];
};
</script>

<template>
  <section class="panel">
    <h2>Do something</h2>
    <label>Action
      <select v-model="action">
        <option v-for="a in ACTIONS" :key="a.id" :value="a.id">{{ a.label }}</option>
      </select>
    </label>
    <div class="muted">{{ help }}</div>

    <template v-if="action === 'record'">
      <label>What happened
        <select v-model="recordKind"><option v-for="k in FACT_KINDS" :key="k" :value="k">{{ words(k) }}</option></select>
      </label>
      <label>Done by
        <select v-model="recordActor"><option value="">no one</option><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
      </label>
      <label>Done to
        <select v-model="recordVictim"><option value="">no one</option><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
      </label>
      <label class="row"><input v-model="hidden" type="checkbox" /> Unseen: no one sees who did it</label>
    </template>

    <template v-else>
      <label>Who
        <select v-model="actorId"><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
      </label>
      <label v-if="needsTarget">{{ action === 'tell' ? 'Tells' : action === 'give' ? 'Gives to' : action === 'fight' ? 'Against' : 'Towards' }}
        <select v-model="targetId"><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
      </label>
    </template>

    <template v-if="action === 'lie'">
      <label>The lie
        <select v-model="claimKind">
          <option value="blame">Someone else did something</option>
          <option value="size">Something was bigger or smaller than it was</option>
          <option value="invent">Something happened that never did</option>
        </select>
      </label>
      <template v-if="claimKind !== 'invent'">
        <label>About
          <select v-model="factId">
            <option v-if="!actorFacts.length" value="">{{ actor.name }} knows of nothing yet</option>
            <option v-for="f in actorFacts" :key="f.id" :value="f.id">{{ f.id }}: {{ describeFact(f) }}</option>
          </select>
        </label>
        <label v-if="claimKind === 'blame'">Says it was
          <select v-model="blameId"><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
        <label v-else class="row"><input v-model="bigger" type="checkbox" /> Says it was bigger than it was</label>
      </template>
      <template v-else>
        <label>What
          <select v-model="inventKind"><option v-for="k in FACT_KINDS" :key="k" :value="k">{{ words(k) }}</option></select>
        </label>
        <label>Done by
          <select v-model="inventActor"><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
        <label>Done to
          <select v-model="inventVictim"><option value="">no one</option><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
      </template>
    </template>

    <label v-if="action === 'tell'">About
      <select v-model="factId">
        <option v-if="!actorFacts.length" value="">{{ actor.name }} knows of nothing yet</option>
        <option v-for="f in actorFacts" :key="f.id" :value="f.id">{{ f.id }}: {{ describeFact(f) }}</option>
      </select>
    </label>

    <template v-if="action === 'fight'">
      <label>Kind
        <select v-model="fightKind"><option value="real">A real fight</option><option value="sparring">Sparring</option></select>
      </label>
      <label v-if="fightKind === 'real'">How it starts
        <select v-model="fightStart">
          <option value="ordinary">Face to face</option>
          <option value="set-upon">Set upon</option>
          <option value="ambush">An ambush</option>
        </select>
      </label>
      <div class="pick">With {{ actor.name }}:
        <label v-for="c in characters.filter((x) => x.id !== actorId && x.id !== targetId && !foes.includes(x.id))" :key="c.id" class="row"><input type="checkbox" :checked="allies.includes(c.id)" @change="toggle('allies', c.id)" /> {{ c.name }}</label>
      </div>
      <div class="pick">With {{ target.name }}:
        <label v-for="c in characters.filter((x) => x.id !== actorId && x.id !== targetId && !allies.includes(x.id))" :key="c.id" class="row"><input type="checkbox" :checked="foes.includes(c.id)" @change="toggle('foes', c.id)" /> {{ c.name }}</label>
      </div>
    </template>

    <label v-if="action === 'give'">Item
      <select v-model="item">
        <option v-if="!carried.length" value="">{{ actor.name }} carries nothing</option>
        <option v-for="i in carried" :key="i" :value="i">{{ ITEM_INFO[i].name }}</option>
      </select>
    </label>

    <label v-if="action === 'rest'">Hours <input v-model.number="hours" type="number" min="1" style="width: 5em" /></label>

    <div v-if="action === 'drink' || action === 'together'" class="pick">{{ action === 'drink' ? 'In company with' : 'With' }}:
      <label v-for="c in characters.filter((x) => x.id !== actorId)" :key="c.id" class="row"><input type="checkbox" :checked="company.includes(c.id)" @change="toggle('company', c.id)" /> {{ c.name }}</label>
    </div>

    <div v-if="usesWitnesses" class="pick">Also there, watching:
      <label v-for="c in bystanders" :key="c.id" class="row"><input type="checkbox" :checked="witnesses.includes(c.id)" @change="toggle('witnesses', c.id)" /> {{ c.name }}</label>
    </div>

    <div v-if="social" class="preview">
      <div v-if="social.refused" class="bad">Refused: {{ social.refused }}</div>
      <template v-else>
        <strong>The odds, as {{ viewer.name }} sees them</strong>
        <table>
          <tr v-for="o in socialOdds" :key="o.e"><td>{{ words(o.e) }}</td><td class="num">{{ percent(o.p) }}</td></tr>
        </table>
        <strong>What {{ viewer.name }} knows of it</strong>
        <div class="muted">{{ actor.name }}'s roll: {{ social.value!.explain({ for: viewer }).actor.map(signed).join(', ') || 'nothing known' }}</div>
        <div class="muted">{{ target.name }}'s roll: {{ social.value!.explain({ for: viewer }).target.map(signed).join(', ') || 'nothing known' }}</div>
      </template>
    </div>
    <div v-if="tell" class="preview">
      <div v-if="tell.refused" class="bad">Refused: {{ tell.refused }}</div>
      <template v-else>
        <strong>If it needs a roll, the odds as {{ viewer.name }} sees them</strong>
        <table>
          <tr v-for="o in tellOdds" :key="o.e"><td>{{ words(o.e) }}</td><td class="num">{{ percent(o.p) }}</td></tr>
        </table>
        <div class="muted">{{ tell.value!.explain({ for: viewer }).map(signed).join(', ') || 'nothing known' }}</div>
      </template>
    </div>

    <div class="row" style="margin-top: 10px">
      <button @click="doIt">{{ ['intimidate', 'persuade', 'lie', 'tell', 'fight', 'drink'].includes(action) ? 'Roll' : 'Do it' }}</button>
    </div>
    <div v-if="problem" class="bad" style="margin-top: 8px">Refused: {{ problem }}</div>
  </section>
</template>

<style scoped>
.pick { margin: 6px 0; }
.pick label { display: inline-flex; margin: 2px 10px 2px 0; }
.preview { margin-top: 10px; padding: 8px 10px; background: var(--chip); border-radius: 8px; }
</style>
