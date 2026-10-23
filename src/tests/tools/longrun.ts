// Long-run baseline (October 2026). Runs a world for one to two years and records, without touching it, how work, money and
// reputation move through the hierarchy; whether men rise and get what they want; how friendships, rivalries and grudges form
// and fade; whether events lead to further events; how families and their leaders change; and whether the world stays coherent.
// It writes the totals over time and readable histories of individual men, chosen by what happened to them.
// Usage: npx tsx src/tests/tools/longrun.ts <seed> [weeks=104] [outdir=longrun-out]
// It only reads: nothing here draws on the world's random numbers or writes to the world (determinism.test.ts proves the world
// comes out byte-identical with the observer and without it). It reads w.agency directly rather than through agencyOf, which
// would create the record if it were missing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { advance, serialize } from '../../engine';
import { createWorld } from '../../world';
import { audit } from '../../consistency';
import { ledgerCheck } from '../../econ';
import * as core from '../../core';
// (how well two men get on is the game's own judgement, core.compat, where the game has one: earlier versions don't, and the harness runs on them too)
const compat: (w: World, a: Character, b: Character) => number = (core as unknown as { compat?: (w: World, a: Character, b: Character) => number }).compat ?? (() => NaN);
import { DAY, WEEK, type Character, type World } from '../../types';

const RANKS = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'] as const;
const LIFE = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
const rk = (r: string) => RANKS.indexOf(r as (typeof RANKS)[number]);
// The same date the game shows: day 0 is Monday 2 March 1970 (minutes since then). Only for the report.
export const when = (t: number) => { const d = new Date(Date.UTC(1970, 2, 2) + t * 60_000); return `${d.toISOString().slice(0, 10)} (wk ${Math.floor(t / WEEK) + 1})`; };
const r2 = (x: number) => Math.round(x * 100) / 100;

interface FactRec { id: string; t: number; kind: string; actor?: string; victim?: string; minor: boolean; cause?: string; story?: string; text: string }
interface Ev { t: number; tag: string; text: string }
interface Snap { name: string; rank: string; boss: string | null; fam: string | null; alive: boolean; jailed: boolean; standing: number; want?: string; problem?: string; hustle?: string; informant: boolean }
interface FamSnap { boss: string; under?: string; consig?: string; heir?: string; members: number; capos: number; soldiers: number; associates: number; treasury: number; standing: number; unrest: number; hunt?: string }
export interface WeekRow {
  week: number; t: number;
  pop: Record<string, number>; jailed: number; deaths: number;
  cash: Record<string, number>; treasury: number; debts: number; debtBal: number; hustles: number; hustleNet: number;
  loans?: { principal: number; arrears: number; worst: number; made: number; defaults: number };
  intents?: Record<string, number>;
  fund?: { lawyers: number; rescued: number; treasury: number };
  work?: { given: number; done: number; failed: number; refused: number; caught: number; delegated: number };
  prot?: { paying: number; started: number; refused: number; poached: number; smashed: number };
  ent?: { running: number; byKind: Record<string, number>; byRank: Record<string, number>; take: number; markers: number; started: number };
  kickPaid: Record<string, number>; kickReceived: Record<string, number>;
  standing: Record<string, number>; standing45: number; standingSpread: { sd: number; min: number; max: number; boss: number }; respectFalls: number;
  goals: Record<string, number>; wants: Record<string, number>; problems: number;
  rel: { pairs: number; trust5: number; aff5: number; friends: number; mutualFriends: number; grudge3: number; grudge6: number; enemies: number; mutualEnemies: number; fear3: number; respect5: number };
  kin?: { known: number; known5: number; compatFriends: number; compatEnemies: number; compatAll: number; bossTrust: number; bossGrudge: number; friendsBond: number };
  sitsOpen: Record<string, number>;
  facts: number; factsCaused: number; factsStoried: number;
  audit: number; ledger: number; saveKB: number; ms: number;
}

const npc = (c?: Character) => !!c && c.alive && !c.isPlayer;
// a man's own enterprise: the enterprise record (Stage 4) or, on older versions, the hustle it replaced
type Ent = { kind: string; level: number; net: number };
function entOf(w: World, c: Character): Ent | undefined {
  const o = (w.ops ?? []).filter((x) => x.owner === c.id && x.kind !== 'hijack' && (x.state === 'running' || x.state === 'raided')).sort((a, b) => (b.level ?? 1) - (a.level ?? 1) || b.total - a.total)[0];
  if (o) return { kind: o.kind, level: o.level ?? 1, net: o.last };
  const h = (c as unknown as { hustle?: { kind: string; level: number; net: number } }).hustle;
  return h ? { kind: h.kind, level: h.level, net: h.net } : undefined;
}
const nm = (w: World, id?: string | null) => (id && w.chars[id] ? w.chars[id].name : '—');
const famName = (w: World, id?: string | null) => (id && w.fam[id] ? w.fam[id].name : 'no family');

export class Observer {
  readonly w: World;
  facts: FactRec[] = [];
  minorByKind: Record<string, number> = {};
  life = new Map<string, Ev[]>();
  famLog = new Map<string, Ev[]>();
  weeks: WeekRow[] = [];
  private seen = new Set<string>();
  private prev = new Map<string, Snap>();
  private famPrev = new Map<string, FamSnap>();
  private pair = new Map<string, number>(); // a|b -> 1 friend, 2 enemy, 4 afraid
  private goalSeen = new Set<string>();
  private endSeen = new Set<string>();
  private sitStage = new Map<string, string>();
  sitStarted: Record<string, number> = {};
  sitEnded: { kind: string; weeks: number; out: string }[] = [];
  goalStarted: Record<string, number> = {};
  goalEnded: Record<string, number> = {};
  goalWhy: Record<string, number> = {};
  rankChanges: { t: number; id: string; from: string; to: string; plan: boolean; active?: boolean; want?: string }[] = [];
  wantChanges: Record<string, number> = {};
  crossings = { friend: 0, unfriend: 0, enemy: 0, forgive: 0, afraid: 0, enemyExplained: 0, enemyWhy: 0, enemyWhyEvent: 0, friendBond: 0, friendTurned: 0 };
  private everFriends = new Set<string>();
  private kinNow?: WeekRow['kin'];
  private respectWas = new Map<string, number>();
  everPlan = new Set<string>(); // men who at some point had a plan to rise
  firstSnap = new Map<string, Snap>();
  deaths = 0;
  private lastMs = 0;
  private t0 = 0;

  constructor(w: World) { this.w = w; this.t0 = Date.now(); this.scanFacts(); this.sample(); }

  private log(id: string, tag: string, text: string, t = this.w.now) { let l = this.life.get(id); if (!l) this.life.set(id, (l = [])); l.push({ t, tag, text }); }
  private flog(id: string, text: string) { let l = this.famLog.get(id); if (!l) this.famLog.set(id, (l = [])); l.push({ t: this.w.now, tag: 'family', text }); }

  // Every new event, as it was recorded. Run daily, so that events the world prunes within the week are still counted.
  jobsSeen = new Map<string, string>(); // work NPC superiors handed down, and how it ended (jobs are pruned, so seen daily)
  scanFacts() {
    for (const j of this.w.jobs ?? []) if (j.via === 'order' && j.giver && !this.w.chars[j.giver]?.isPlayer) this.jobsSeen.set(j.id, j.status);
    for (const f of Object.values(this.w.facts)) {
      if (this.seen.has(f.id)) continue;
      this.seen.add(f.id);
      if (f.minor) this.minorByKind[f.kind] = (this.minorByKind[f.kind] ?? 0) + 1;
      this.facts.push({ id: f.id, t: f.t, kind: f.kind, actor: f.actor, victim: f.victim, minor: !!f.minor, cause: f.cause, story: f.story, text: f.text.slice(0, 220) });
    }
  }

  // Once a week: who everyone is now, what changed since last week, and the totals.
  sample() {
    const w = this.w, now = w.now;
    this.scanFacts();
    // ---- people
    for (const c of Object.values(w.chars)) {
      if (c.isPlayer) continue;
      const s: Snap = { name: c.name, rank: c.rank, boss: c.bossId, fam: c.familyId, alive: c.alive, jailed: c.jailedUntil > now, standing: Math.round(c.standing), want: c.want?.kind, problem: c.problem?.kind, hustle: (() => { const e = entOf(w, c); return e ? `${e.kind}:${e.level}` : undefined; })(), informant: !!c.informant };
      const p = this.prev.get(c.id);
      if (!this.firstSnap.has(c.id)) this.firstSnap.set(c.id, s);
      if (p) {
        if (p.alive && !s.alive) { this.deaths++; this.log(c.id, 'death', `died`); }
        if (s.rank !== p.rank) {
          const up = rk(s.rank) > rk(p.rank);
          this.rankChanges.push({ t: now, id: c.id, from: p.rank, to: s.rank, plan: this.everPlan.has(c.id), active: (w.agency?.goals ?? []).some((g) => g.who === c.id && g.kind === 'advance') || (w.agency?.ended ?? []).some((e) => e.who === c.id && e.kind === 'advance' && e.how === 'done' && now - e.t < 2 * WEEK), want: p.want });
          this.log(c.id, up ? 'rise' : 'fall', `${up ? 'rose' : 'went'} from ${p.rank} to ${s.rank}${this.everPlan.has(c.id) ? ' (he had been pushing to rise)' : ''}`);
        }
        if (s.fam !== p.fam) this.log(c.id, 'family', `left ${famName(w, p.fam)} for ${famName(w, s.fam)}`);
        else if (s.boss !== p.boss && s.alive) this.log(c.id, 'boss', `now answers to ${nm(w, s.boss)} (was ${nm(w, p.boss)})`);
        if (s.jailed && !p.jailed) this.log(c.id, 'jail', 'locked up');
        if (!s.jailed && p.jailed && s.alive) this.log(c.id, 'jail', 'out of jail');
        if (s.want !== p.want && s.want) { const why = c.want?.why; this.wantChanges[why ?? '(no reason recorded)'] = (this.wantChanges[why ?? '(no reason recorded)'] ?? 0) + 1; this.log(c.id, 'want', `now wants ${WANT[s.want] ?? s.want}${why ? ` (${why})` : p.want ? '' : ' (first ambition)'}`); }
        if (s.problem !== p.problem) this.log(c.id, 'problem', s.problem ? `trouble begins: ${s.problem}` : `his ${p.problem} trouble is over`);
        if (s.hustle !== p.hustle && s.hustle) { const [k, l] = s.hustle.split(':'); const [pk] = (p.hustle ?? '').split(':'); this.log(c.id, 'hustle', pk === k ? `grows his ${k} business (level ${l})` : `starts a ${k} hustle`); }
        if (s.informant && !p.informant) this.log(c.id, 'informant', 'starts talking to the police');
      }
      this.prev.set(c.id, s);
    }
    // ---- plans (read directly: agencyOf would create the record)
    const ag = w.agency;
    if (ag) {
      for (const g of ag.goals) if (!this.goalSeen.has(g.id)) {
        this.goalSeen.add(g.id); this.goalStarted[g.kind] = (this.goalStarted[g.kind] ?? 0) + 1;
        if (g.kind === 'advance') this.everPlan.add(g.who);
        this.log(g.who, 'plan', `begins a plan (${g.kind}): ${g.motive}`);
      }
      for (const e of ag.ended) if (!this.endSeen.has(e.id)) {
        this.endSeen.add(e.id); const k = `${e.kind}: ${e.how}`; this.goalEnded[k] = (this.goalEnded[k] ?? 0) + 1;
        const kw = `${e.kind} ${e.how}: ${e.why}`; this.goalWhy[kw] = (this.goalWhy[kw] ?? 0) + 1;
        this.log(e.who, 'plan', `plan (${e.kind}) ${e.how}: ${e.why}`, e.t);
      }
    }
    // ---- storylines
    for (const s of w.situations ?? []) {
      const k = s.kind ?? 'money', was = this.sitStage.get(s.id);
      if (was === undefined) {
        this.sitStarted[k] = (this.sitStarted[k] ?? 0) + 1;
        for (const pt of s.parties ?? [{ id: s.who, role: 'who' }]) if (w.chars[pt.id] && !w.chars[pt.id].isPlayer) this.log(pt.id, 'story', `drawn into a ${k} (${pt.role}): ${s.cause}`, s.since);
      }
      if (s.stage === 'resolved' && was !== 'resolved') {
        this.sitEnded.push({ kind: k, weeks: Math.round((now - s.since) / WEEK), out: s.out ?? s.how ?? 'resolved' });
        for (const pt of s.parties ?? [{ id: s.who, role: 'who' }]) if (w.chars[pt.id] && !w.chars[pt.id].isPlayer) this.log(pt.id, 'story', `the ${k} ends: ${s.out ?? s.how ?? 'resolved'}`);
      }
      this.sitStage.set(s.id, s.stage);
    }
    // ---- relationships between NPCs
    let respectFalls = 0;
    const rel = { pairs: 0, trust5: 0, aff5: 0, friends: 0, mutualFriends: 0, grudge3: 0, grudge6: 0, enemies: 0, mutualEnemies: 0, fear3: 0, respect5: 0 };
    for (const a of Object.values(w.chars)) {
      if (!npc(a)) continue;
      for (const [bid, r] of Object.entries(a.rels)) {
        const b = w.chars[bid];
        if (!npc(b)) continue;
        rel.pairs++;
        const friend = r.trust >= 0.5 && r.affection >= 0.5, enemy = r.grudge >= 0.4, afraid = (r.fear ?? 0) >= 0.4;
        if (r.trust >= 0.5) rel.trust5++; if (r.affection >= 0.5) rel.aff5++; if (r.grudge >= 0.3) rel.grudge3++; if (r.grudge >= 0.6) rel.grudge6++;
        if ((r.fear ?? 0) >= 0.3) rel.fear3++; if (r.respect >= 0.5) rel.respect5++;
        if (friend) { rel.friends++; const o = b.rels[a.id]; if (o && o.trust >= 0.5 && o.affection >= 0.5 && a.id < b.id) rel.mutualFriends++; }
        if (enemy) { rel.enemies++; const o = b.rels[a.id]; if (o && o.grudge >= 0.4 && a.id < b.id) rel.mutualEnemies++; }
        const rkey = a.id + '>' + bid, rw = this.respectWas.get(rkey);
        if (rw !== undefined && r.respect < rw - 0.005) respectFalls++;
        this.respectWas.set(rkey, r.respect);
        const key = a.id + '|' + bid, was = this.pair.get(key) ?? 0, is = (friend ? 1 : 0) | (enemy ? 2 : 0) | (afraid ? 4 : 0);
        if (is !== was) {
          if (is & 1 && !(was & 1)) { this.crossings.friend++; this.everFriends.add(key); if (r.bond) this.crossings.friendBond++; this.log(a.id, 'friend', `counts ${b.name} a friend${r.bond ? ` (it rests on: ${r.bond.text})` : ''}`); }
          if (!(is & 1) && was & 1) { this.crossings.unfriend++; this.log(a.id, 'friend', `drifts apart from ${b.name}`); }
          if (is & 2 && !(was & 2)) {
            this.crossings.enemy++;
            // is there anything on record between them in the last two months that could explain it?
            const why = this.between(a.id, bid, now - 60 * DAY);
            if (why) this.crossings.enemyExplained++;
            // what the world itself says the grudge is about (core.bear keeps the reason on the relationship), where it says anything
            if (r.why) { this.crossings.enemyWhy++; if (r.why.f) this.crossings.enemyWhyEvent++; }
            if (this.everFriends.has(key)) { this.crossings.friendTurned++; this.log(a.id, 'grudge', `(he once counted ${b.name} a friend)`); }
            this.log(a.id, 'grudge', `turns against ${b.name}${r.why ? ` (because: ${r.why.text})` : why ? ` (after: ${why.text}; no reason recorded)` : ' (nothing on record between them)'}`);
          }
          if (!(is & 2) && was & 2) { this.crossings.forgive++; this.log(a.id, 'grudge', `lets go of his grudge against ${b.name}`); }
          if (is & 4 && !(was & 4)) { this.crossings.afraid++; this.log(a.id, 'fear', `has become afraid of ${b.name}`); }
          this.pair.set(key, is);
        }
      }
    }
    // ---- what the relationships rest on: familiarity, whether friends get on better than enemies, loyalty to one's own boss
    {
      let kn = 0, kn5 = 0, n = 0, cf = 0, nf = 0, ce = 0, ne = 0, ca = 0, na = 0, fb = 0;
      const people = Object.values(w.chars).filter(npc);
      for (const a of people) for (const [bid, r] of Object.entries(a.rels)) {
        const b = w.chars[bid]; if (!npc(b)) continue;
        n++; kn += r.known ?? 0; if ((r.known ?? 0) >= 0.5) kn5++;
        const friend = r.trust >= 0.5 && r.affection >= 0.5, enemy = r.grudge >= 0.4;
        if (friend) { cf += compat(w, a, b); nf++; if (r.bond) fb++; }
        if (enemy) { ce += compat(w, a, b); ne++; }
        if ((n % 17) === 0) { ca += compat(w, a, b); na++; }
      }
      const under = people.filter((c) => c.bossId && w.chars[c.bossId] && !w.chars[c.bossId].isPlayer && c.rank !== 'civilian');
      this.kinNow = { known: r2(kn / Math.max(1, n)), known5: kn5, compatFriends: r2(cf / Math.max(1, nf)), compatEnemies: r2(ce / Math.max(1, ne)), compatAll: r2(ca / Math.max(1, na)), bossTrust: r2(under.reduce((x, c) => x + (c.rels[c.bossId!]?.trust ?? 0), 0) / Math.max(1, under.length)), bossGrudge: under.filter((c) => (c.rels[c.bossId!]?.grudge ?? 0) >= 0.3).length, friendsBond: nf ? Math.round((100 * fb) / nf) : 0 };
    }
    // ---- families
    for (const f of Object.values(w.fam)) {
      const mem = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id);
      const s: FamSnap = { boss: f.bossId, under: mem.find((c) => c.rank === 'underboss')?.id, consig: f.consigliere, heir: f.heir, members: mem.length, capos: mem.filter((c) => c.rank === 'capo').length, soldiers: mem.filter((c) => c.rank === 'soldier').length, associates: mem.filter((c) => c.rank === 'associate').length, treasury: Math.round(f.treasury ?? 0), standing: Math.round(f.standing ?? 0), unrest: f.unrest && f.unrest.until > now ? f.unrest.level : 0, hunt: f.hunt?.target };
      const p = this.famPrev.get(f.id);
      if (p) {
        if (s.boss !== p.boss) this.flog(f.id, `new boss: ${nm(w, s.boss)} (was ${nm(w, p.boss)}${w.chars[p.boss]?.alive ? '' : ', dead'}${w.chars[p.boss]?.jailedUntil > now ? ', in jail' : ''})`);
        if (s.under !== p.under) this.flog(f.id, `underboss: ${nm(w, s.under)} (was ${nm(w, p.under)})`);
        if (s.consig !== p.consig) this.flog(f.id, `consigliere: ${nm(w, s.consig)} (was ${nm(w, p.consig)})`);
        if (s.heir !== p.heir) this.flog(f.id, `named heir: ${nm(w, s.heir)}`);
        if (s.capos !== p.capos) this.flog(f.id, `capos: ${p.capos} → ${s.capos}`);
        if (s.unrest && !p.unrest) this.flog(f.id, `unrest after a contested succession (level ${s.unrest})`);
        if (s.hunt && s.hunt !== p.hunt) this.flog(f.id, `puts out word on ${nm(w, s.hunt)}`);
      }
      this.famPrev.set(f.id, s);
    }
    // ---- totals
    const alive = Object.values(w.chars).filter(npc);
    const by = <T,>(f: (c: Character) => T, agg: (xs: T[]) => number) => Object.fromEntries(RANKS.map((r) => [r, agg(alive.filter((c) => c.rank === r).map(f))]));
    const mean = (xs: number[]) => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0));
    const lastBook = (c: Character) => { const h = c.books?.history?.at(-1); return h && now - h.week * WEEK < 2 * WEEK ? h : undefined; };
    const goals: Record<string, number> = {}; for (const g of ag?.goals ?? []) goals[g.kind] = (goals[g.kind] ?? 0) + 1;
    const wants: Record<string, number> = {}; for (const c of alive) if (c.want) wants[c.want.kind] = (wants[c.want.kind] ?? 0) + 1;
    const sitsOpen: Record<string, number> = {}; for (const s of w.situations ?? []) if (s.stage !== 'resolved') sitsOpen[s.kind ?? 'money'] = (sitsOpen[s.kind ?? 'money'] ?? 0) + 1;
    const major = this.facts.filter((f) => !f.minor);
    const ms = Date.now() - this.t0 - this.lastMs; this.lastMs = Date.now() - this.t0;
    const life = alive.filter((c) => LIFE.includes(c.rank));
    this.weeks.push({
      week: Math.round(now / WEEK), t: now,
      pop: by(() => 1, (xs) => xs.length), jailed: alive.filter((c) => c.jailedUntil > now).length, deaths: this.deaths,
      cash: by((c) => c.cash, mean), treasury: sum(Object.values(w.fam).map((f) => f.treasury ?? 0)),
      debts: w.debts.filter((d) => d.status === 'active').length, debtBal: sum(w.debts.filter((d) => d.status === 'active').map((d) => d.balance)),
      loans: (() => { const act = w.debts.filter((d) => d.status === 'active'); const left = (d: typeof act[0]) => d.owed ?? d.balance - (d.arrears ?? 0);
        return { principal: sum(act.map(left)), arrears: sum(act.map((d) => d.arrears ?? 0)), worst: r2(Math.max(0, ...act.map((d) => d.balance / Math.max(1, d.principal)))), made: w.debts.length, defaults: w.debts.filter((d) => d.status === 'defaulted').length }; })(),
      intents: { ...(w.intentStats ?? {}) },
      fund: { lawyers: this.facts.filter((f) => /family's lawyer took/.test(f.text)).length, rescued: this.facts.filter((f) => / family cleared /.test(f.text)).length, treasury: sum(Object.values(w.fam).map((f) => f.treasury ?? 0)) },
      work: (() => { const st = [...this.jobsSeen.values()]; const n = (re: RegExp, k?: string) => this.facts.filter((f) => (!k || f.kind === k) && re.test(f.text)).length;
        return { given: st.length, done: st.filter((x) => x === 'done').length, failed: st.filter((x) => x === 'failed').length, refused: n(/ refused when /, 'report'), caught: n(/found out .* on "|had been skimming his/, 'discipline'), delegated: n(/ put .* in charge of his /, 'report') }; })(),
      prot: (() => { const n = (k: string) => this.facts.filter((f) => f.kind === k).length;
        return { paying: Object.values(w.biz).filter((b) => b.open && b.protection).length, started: n('protection_started'), refused: n('protection_refused'), poached: n('poach'), smashed: this.facts.filter((f) => f.kind === 'vandalism' && /refused to pay/.test(f.text)).length }; })(),
      ent: (() => { const run = (w.ops ?? []).filter((o) => o.kind !== 'hijack' && (o.state === 'running' || o.state === 'raided'));
        const byKind: Record<string, number> = {}, byRank: Record<string, number> = {};
        for (const o of run) { byKind[o.kind] = (byKind[o.kind] ?? 0) + 1; const r = w.chars[o.owner]?.rank ?? '?'; byRank[r] = (byRank[r] ?? 0) + 1; }
        return { running: run.length, byKind, byRank, take: sum(run.map((o) => o.last)), markers: w.debts.filter((d) => d.reason === 'a marker on the book').length, started: (w.ops ?? []).filter((o) => o.kind !== 'hijack').length }; })(),
      hustles: life.filter((c) => entOf(w, c)).length, hustleNet: sum(life.map((c) => entOf(w, c)?.net ?? 0)),
      kickPaid: by((c) => lastBook(c)?.paid ?? 0, sum), kickReceived: by((c) => lastBook(c)?.received ?? 0, sum),
      standing: by((c) => c.standing, mean), standing45: life.filter((c) => c.standing >= 45).length,
      standingSpread: (() => { const xs = life.map((c) => c.standing), m = mean(xs); return { sd: r2(Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))), min: Math.round(Math.min(...xs)), max: Math.round(Math.max(...xs)), boss: mean(life.filter((c) => c.rank === 'boss').map((c) => c.standing)) }; })(), respectFalls,
      goals, wants, problems: alive.filter((c) => c.problem).length, rel, sitsOpen, kin: this.kinNow,
      facts: major.length, factsCaused: major.filter((f) => f.cause).length, factsStoried: major.filter((f) => f.story).length,
      audit: audit(w).length, ledger: ledgerCheck(w).length, saveKB: Math.round(serialize(w).length / 1024), ms,
    });
  }

  // The most recent recorded event between two men since a time, either way round (for explaining a grudge).
  private between(a: string, b: string, since: number): FactRec | undefined {
    for (let i = this.facts.length - 1; i >= 0; i--) {
      const f = this.facts[i];
      if (f.t < since) break;
      if (!f.minor && ((f.actor === a && f.victim === b) || (f.actor === b && f.victim === a))) return f;
    }
    return undefined;
  }
}

const WANT: Record<string, string> = { made: 'to be made', gamble: 'a game of his own', independent: 'to answer to nobody', lieutenant: 'to be close to the top', rich: 'money, real money', respect: 'to be taken seriously' };

// Run a world day by day (so no event slips past the daily scan), sampling weekly.
export function run(seed: number, weeks: number): Observer {
  const w = createWorld(seed, 'Tony Marino');
  const o = new Observer(w);
  for (let wk = 1; wk <= weeks; wk++) {
    for (let d = 1; d <= 7; d++) { advance(w, w.now + DAY); o.scanFacts(); }
    o.sample();
  }
  return o;
}

// ============================================================================ the report
const FACT_SKIP = new Set(['gambling_loss', 'rumour']); // counted, not listed one by one in a man's history

export function report(o: Observer, seed: number): { md: string; json: unknown } {
  const w = o.w, W = o.weeks, last = W.at(-1)!, first = W[0];
  const out: string[] = [];
  const at = (wk: number) => W.find((r) => r.week >= wk) ?? last;
  const marks = [0, 13, 26, 52, 78, 104, 156].filter((m) => m <= last.week).map(at);
  const row = (label: string, f: (r: WeekRow) => string | number) => `| ${label} | ${marks.map(f).join(' | ')} |`;
  out.push(`# Long-run baseline: seed ${seed}, ${last.week} weeks`, '', `World ${seed}, the player idle (he takes no action, so this is the world on its own). Run ${when(first.t)} to ${when(last.t)}. ${Math.round(W.reduce((a, r) => a + r.ms, 0) / 1000)} s to simulate.`, '');
  out.push('## Over time', '', `| | ${marks.map((r) => `wk ${r.week}`).join(' | ')} |`, `|---|${marks.map(() => '---').join('|')}|`,
    row('People in the life (assoc/sold/capo/under/boss)', (r) => `${r.pop.associate}/${r.pop.soldier}/${r.pop.capo}/${r.pop.underboss}/${r.pop.boss}`),
    row('Civilians', (r) => r.pop.civilian), row('In jail now', (r) => r.jailed), row('Deaths so far', (r) => r.deaths),
    row('Mean cash: associate / soldier / capo', (r) => `$${Math.round(r.cash.associate)} / $${Math.round(r.cash.soldier)} / $${Math.round(r.cash.capo)}`),
    row('Family treasuries (total)', (r) => `$${r.treasury.toLocaleString('en-US')}`),
    row('Active debts (count / balance)', (r) => `${r.debts} / $${r.debtBal.toLocaleString('en-US')}`),
    row('Loans: principal out / unpaid vig / worst owed÷lent / ever made / defaulted', (r) => (r.loans ? `$${r.loans.principal.toLocaleString('en-US')} / $${r.loans.arrears.toLocaleString('en-US')} / ${r.loans.worst}× / ${r.loans.made} / ${r.loans.defaults}` : '–')),
    row('Men with a side business / its weekly net', (r) => `${r.hustles} / $${r.hustleNet.toLocaleString('en-US')}`),
    row('Men who went to see someone, by reason (to date): time / intercede / help / report / amends / confront / work / of which to the player', (r) => (r.intents ? ['time', 'intercede', 'help', 'report', 'amends', 'confront', 'work', 'player'].map((k) => r.intents![k] ?? 0).join(' / ') : '–')),
    row('The family fund: lawyers paid for / outside debts cleared for its men (to date) / in the funds now', (r) => (r.fund ? `${r.fund.lawyers} / ${r.fund.rescued} / $${r.fund.treasury.toLocaleString('en-US')}` : '–')),
    row('Work handed down by NPC superiors: given / done / came to nothing / refused / lies caught / enterprises delegated (to date)', (r) => (r.work ? `${r.work.given} / ${r.work.done} / ${r.work.failed} / ${r.work.refused} / ${r.work.caught} / ${r.work.delegated}` : '–')),
    row('Protection: shops paying / deals / refusals / taken from another / smashed after refusing (to date)', (r) => (r.prot ? `${r.prot.paying} / ${r.prot.started} / ${r.prot.refused} / ${r.prot.poached} / ${r.prot.smashed}` : '–')),
    row('Enterprises running / ever started / weekly take / betting markers', (r) => (r.ent ? `${r.ent.running} / ${r.ent.started} / $${r.ent.take.toLocaleString('en-US')} / ${r.ent.markers}` : '–')),
    row('Enterprises by kind', (r) => (r.ent ? Object.entries(r.ent.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') : '–')),
    row('Kick-ups paid this week: assoc / sold / capo / under', (r) => `$${r.kickPaid.associate} / $${r.kickPaid.soldier} / $${r.kickPaid.capo} / $${r.kickPaid.underboss}`),
    row('Kick-ups received: sold / capo / under / boss', (r) => `$${r.kickReceived.soldier} / $${r.kickReceived.capo} / $${r.kickReceived.underboss} / $${r.kickReceived.boss}`),
    row('Mean standing: assoc / sold / capo', (r) => `${Math.round(r.standing.associate)} / ${Math.round(r.standing.soldier)} / ${Math.round(r.standing.capo)}`),
    row('Men in the life with standing ≥ 45', (r) => r.standing45),
    row('Standing in the life: spread (sd) / lowest / highest / bosses', (r) => r.standingSpread ? `${r.standingSpread.sd} / ${r.standingSpread.min} / ${r.standingSpread.max} / ${Math.round(r.standingSpread.boss)}` : '–'),
    row('Times someone’s respect for another fell, that week', (r) => r.respectFalls ?? '–'),
    row('Open plans (rise / business / wealth / other)', (r) => `${r.goals.advance ?? 0} / ${r.goals.business ?? 0} / ${r.goals.wealth ?? 0} / ${(r.goals.recruit ?? 0) + (r.goals.debt ?? 0) + (r.goals.independence ?? 0)}`),
    row('Wants (made / rich / respect / independent / other)', (r) => `${r.wants.made ?? 0} / ${r.wants.rich ?? 0} / ${r.wants.respect ?? 0} / ${r.wants.independent ?? 0} / ${(r.wants.gamble ?? 0) + (r.wants.lieutenant ?? 0)}`),
    row('Men with a personal problem', (r) => r.problems),
    row('NPC pairs with any relationship', (r) => r.rel.pairs),
    row('Friends (trust & affection ≥ .5) / mutual', (r) => `${r.rel.friends} / ${r.rel.mutualFriends}`),
    row('Grudges ≥ .3 / ≥ .6', (r) => `${r.rel.grudge3} / ${r.rel.grudge6}`),
    row('Enemies (grudge ≥ .4) / mutual', (r) => `${r.rel.enemies} / ${r.rel.mutualEnemies}`),
    row('Fear ≥ .3 / respect ≥ .5', (r) => `${r.rel.fear3} / ${r.rel.respect5}`),
    row('How well men know each other: average / pairs who know each other well', (r) => (r.kin ? `${r.kin.known} / ${r.kin.known5}` : '–')),
    row('How well they get on: friends / enemies / everyone', (r) => (r.kin ? `${r.kin.compatFriends} / ${r.kin.compatEnemies} / ${r.kin.compatAll}` : '–')),
    row('Friendships resting on something recorded', (r) => (r.kin ? `${r.kin.friendsBond}%` : '–')),
    row('Men in the life: trust in their own boss / holding a grudge against him', (r) => (r.kin ? `${r.kin.bossTrust} / ${r.kin.bossGrudge}` : '–')),
    row('Open storylines', (r) => Object.values(r.sitsOpen).reduce((a, b) => a + b, 0)),
    row('Lasting events so far / with a cause / in a storyline', (r) => `${r.facts} / ${r.factsCaused} / ${r.factsStoried}`),
    row('Consistency / ledger problems', (r) => `${r.audit} / ${r.ledger}`),
    row('Save size', (r) => `${r.saveKB} KB`), '');

  // ---- careers
  const ups = o.rankChanges.filter((c) => rk(c.to) > rk(c.from) && c.from !== 'civilian'), joins = o.rankChanges.filter((c) => c.from === 'civilian'), downs = o.rankChanges.filter((c) => rk(c.to) < rk(c.from) && c.to !== 'civilian'), left = o.rankChanges.filter((c) => c.to === 'civilian' && c.from !== 'civilian');
  const tally = (xs: { from: string; to: string }[]) => Object.entries(xs.reduce<Record<string, number>>((a, c) => ((a[`${c.from} → ${c.to}`] = (a[`${c.from} → ${c.to}`] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ×${v}`).join(', ') || 'none';
  out.push('## Careers and ambition', '',
    `- **Promotions:** ${ups.length} (${tally(ups)}). Of these, ${ups.filter((c) => c.plan).length} had at some point pushed to rise (${ups.filter((c) => c.active).length} were still pushing when it came); ${ups.filter((c) => c.want === 'made' || c.want === 'lieutenant' || c.want === 'respect').length} wanted it.`,
    `- **Taken into the life from the street:** ${joins.length}. **Left the life alive** (retired, put out): ${left.length}${left.length ? ` (${tally(left)})` : ''}. **Demotions:** ${downs.length}${downs.length ? ` (${tally(downs)})` : ''}.`,
    `- **Plans begun:** ${Object.entries(o.goalStarted).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `- **Plans ended:** ${Object.entries(o.goalEnded).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `- **Why plans to rise ended:** ${Object.entries(o.goalWhy).filter(([k]) => k.startsWith('advance')).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace('advance ', '')} ×${v}`).join('; ') || 'none ended'}.`,
    `- **Changes of ambition:** ${Object.values(o.wantChanges).reduce((a, b) => a + b, 0)}. Reasons: ${Object.entries(o.wantChanges).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ×${v}`).join('; ')}.`,
    '');
  // ---- relationships
  const cx = o.crossings;
  out.push('## Relationships between NPCs', '',
    `- Became friends ${cx.friend} times; drifted apart ${cx.unfriend} times.`,
    `- Turned against someone ${cx.enemy} times; **${cx.enemy ? Math.round((100 * cx.enemyExplained) / cx.enemy) : 0}% had anything on record between the two men** in the two months before. Let a grudge go ${cx.forgive} times.`,
    `- **The reason the world records for the grudge:** ${cx.enemy ? Math.round((100 * cx.enemyWhy) / cx.enemy) : 0}% of grudges carry one; ${cx.enemy ? Math.round((100 * cx.enemyWhyEvent) / cx.enemy) : 0}% name the event behind them.`,
    `- Became afraid of someone ${cx.afraid} times.`,
    `- **Friendships resting on something recorded when they formed:** ${cx.friend ? Math.round((100 * cx.friendBond) / cx.friend) : 0}%. **Former friends who turned against each other:** ${cx.friendTurned}.`, '');
  // ---- causality
  const major = o.facts.filter((f) => !f.minor), byId = new Map(o.facts.map((f) => [f.id, f]));
  const depth = (f: FactRec) => { let d = 0, x: FactRec | undefined = f; while (x?.cause && d < 30) { x = byId.get(x.cause); d++; } return d; };
  const depths = major.map(depth);
  const kinds = Object.entries(major.reduce<Record<string, number>>((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const stories = Object.entries(major.reduce<Record<string, number>>((a, f) => (f.story ? ((a[f.story] = (a[f.story] ?? 0) + 1), a) : a), {}));
  const ended = Object.entries(o.sitEnded.reduce<Record<string, { n: number; wk: number; outs: Record<string, number> }>>((a, s) => { const x = (a[s.kind] ??= { n: 0, wk: 0, outs: {} }); x.n++; x.wk += s.weeks; x.outs[s.out] = (x.outs[s.out] ?? 0) + 1; return a; }, {}));
  out.push('## Cause and consequence', '',
    `- **Lasting events:** ${major.length}; minor events: ${Object.values(o.minorByKind).reduce((a, b) => a + b, 0)}.`,
    `- **Most common lasting events:** ${kinds.slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `- **Recorded cause:** ${Math.round((100 * major.filter((f) => f.cause).length) / Math.max(1, major.length))}% of lasting events. Chains: ${depths.filter((d) => d >= 2).length} events two links deep, ${depths.filter((d) => d >= 3).length} three or more.`,
    `- **In a storyline:** ${Math.round((100 * major.filter((f) => f.story).length) / Math.max(1, major.length))}% of lasting events, across ${stories.length} storylines (median ${median(stories.map(([, v]) => v))} events each, longest ${Math.max(0, ...stories.map(([, v]) => v))}).`,
    `- **Storylines started:** ${Object.entries(o.sitStarted).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `- **How they ended (count, average weeks, outcomes):**`, ...ended.sort((a, b) => b[1].n - a[1].n).map(([k, x]) => `  - ${k}: ${x.n}, ${r2(x.wk / x.n)} wk; ${Object.entries(x.outs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([oo, n]) => `${oo} ×${n}`).join('; ')}`), '');
  // ---- families
  out.push('## Families', '', '| Family | Boss at start → end | Members | Capos | Soldiers | Associates | Treasury |', '|---|---|---|---|---|---|---|');
  for (const f of Object.values(w.fam)) {
    const mem = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id);
    const b0 = o.firstSnap.size ? [...o.firstSnap.entries()].find(([, s]) => s.fam === f.id && s.rank === 'boss')?.[1].name : '';
    out.push(`| ${f.name} | ${b0 ?? '?'} → ${nm(w, f.bossId)} | ${mem.length} | ${mem.filter((c) => c.rank === 'capo').length} | ${mem.filter((c) => c.rank === 'soldier').length} | ${mem.filter((c) => c.rank === 'associate').length} | $${Math.round(f.treasury ?? 0).toLocaleString('en-US')} |`);
  }
  out.push('');
  for (const f of Object.values(w.fam)) { const l = o.famLog.get(f.id) ?? []; out.push(`**${f.name}:** ${l.length ? l.map((e) => `${when(e.t)} ${e.text}`).join('; ') : 'no change of leadership or structure.'}`, ''); }
  // ---- coherence
  const worst = W.reduce((a, r) => (r.audit + r.ledger > a.audit + a.ledger ? r : a), first);
  out.push('## Coherence', '', `- Consistency or ledger problems at any weekly check: ${W.filter((r) => r.audit + r.ledger > 0).length} of ${W.length} weeks (worst: ${worst.audit} + ${worst.ledger} at week ${worst.week}).${last.audit ? ` At the end: ${audit(w).slice(0, 3).join('; ')}` : ''}${last.ledger ? ` Ledger: ${ledgerCheck(w).slice(0, 3).join('; ')}` : ''}`,
    `- Save size: ${first.saveKB} KB at the start, ${at(52).saveKB} KB after a year, ${last.saveKB} KB at the end.`,
    `- Simulation speed: ${Math.round(W.slice(1, 14).reduce((a, r) => a + r.ms, 0) / 13)} ms per week in the first quarter, ${Math.round(W.slice(-13).reduce((a, r) => a + r.ms, 0) / 13)} ms in the last.`, '');
  // ---- histories
  out.push('## Lives', '', 'Chosen by what happened to them, not by hand. Each is everything the harness saw: his rank, boss and family, what he wanted and planned and how it ended, his troubles and side business, the storylines he was drawn into, the friendships and grudges he formed (with whatever was on record between the two men), and the lasting events in which he acted or was acted on. Gambling losses and rumours are counted at the end, not listed.', '');
  for (const [label, id] of pickLives(o)) out.push(...history(o, id, label), '');
  const json = { seed, weeks: W, crossings: o.crossings, rankChanges: o.rankChanges, goalStarted: o.goalStarted, goalEnded: o.goalEnded, goalWhy: o.goalWhy, wantChanges: o.wantChanges, sitStarted: o.sitStarted, sitEnded: o.sitEnded, minorByKind: o.minorByKind, factKinds: Object.fromEntries(kinds), causeDepth: { two: depths.filter((d) => d >= 2).length, three: depths.filter((d) => d >= 3).length } };
  return { md: out.join('\n'), json };
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// Who to write up: the man who rose furthest, an ambitious man who never rose, the longest trouble, the bitterest man, the
// player's own captain, the boss of the player's family, the busiest shopkeeper, the first man in the life to die, and one
// ordinary associate.
function pickLives(o: Observer): [string, string][] {
  const w = o.w, ids = [...o.firstSnap.keys()];
  const evs = (id: string, tag?: string) => (o.life.get(id) ?? []).filter((e) => !tag || e.tag === tag);
  const inLife = (id: string) => LIFE.includes(o.firstSnap.get(id)!.rank);
  const best = (xs: string[], score: (id: string) => number) => xs.filter((id) => score(id) > 0).sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))[0];
  const out: [string, string][] = [];
  const add = (label: string, id?: string) => { if (id && !out.some(([, x]) => x === id)) out.push([label, id]); };
  add('The man who rose furthest', best(ids, (id) => evs(id, 'rise').length));
  add('An ambitious man who never rose', best(ids.filter((id) => !evs(id, 'rise').length && inLife(id)), (id) => evs(id, 'plan').filter((e) => /\(advance\)/.test(e.text)).length));
  add('The longest personal trouble', best(ids, (id) => { let n = 0, on: number | undefined; for (const e of evs(id, 'problem')) { if (/begins/.test(e.text)) on = e.t; else if (on !== undefined) { n += e.t - on; on = undefined; } } if (on !== undefined) n += w.now - on; return n; }));
  add('The man with the most grudges', best(ids, (id) => evs(id, 'grudge').filter((e) => /turns against/.test(e.text)).length));
  const p = w.chars[w.playerId!];
  const capo = [...o.firstSnap.entries()].find(([id]) => id === p.bossId)?.[0];
  add('The player’s own captain', capo);
  add('The boss of the player’s family', [...o.firstSnap.entries()].find(([, s]) => s.fam === p.familyId && s.rank === 'boss')?.[0]);
  add('The busiest shopkeeper', best(ids.filter((id) => o.firstSnap.get(id)!.rank === 'civilian'), (id) => o.facts.filter((f) => !f.minor && (f.actor === id || f.victim === id)).length));
  add('The first man in the life to die', ids.filter((id) => inLife(id) && evs(id, 'death').length).sort((a, b) => evs(a, 'death')[0].t - evs(b, 'death')[0].t)[0]);
  add('An ordinary associate', ids.filter((id) => o.firstSnap.get(id)!.rank === 'associate').sort((a, b) => (o.life.get(a)?.length ?? 0) - (o.life.get(b)?.length ?? 0))[Math.floor(ids.filter((id) => o.firstSnap.get(id)!.rank === 'associate').length / 2)]);
  return out;
}

function history(o: Observer, id: string, label: string): string[] {
  const w = o.w, c = w.chars[id], s0 = o.firstSnap.get(id)!;
  const facts = o.facts.filter((f) => !f.minor && (f.actor === id || f.victim === id));
  const listed = facts.filter((f) => !FACT_SKIP.has(f.kind)).map((f) => ({ t: f.t, tag: 'event', text: f.text + (f.cause ? ' [cause recorded]' : '') + (f.story ? '' : '') }));
  const all = [...(o.life.get(id) ?? []), ...listed].sort((a, b) => a.t - b.t);
  // friendships are many and alike: keep the first few and count the rest
  const friendLines = all.filter((e) => e.tag === 'friend');
  const kept = all.filter((e) => e.tag !== 'friend' || friendLines.indexOf(e) < 4);
  const MAX = 70, shown = kept.slice(0, MAX);
  const skipped = facts.filter((f) => FACT_SKIP.has(f.kind)).reduce<Record<string, number>>((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {});
  const lines = [`### ${label}: ${c.name}`, '', `Started as ${s0.rank === 'civilian' ? 'a civilian' : `${s0.rank === 'associate' ? 'an' : 'a'} ${s0.rank}`} of ${famName(w, s0.fam)} under ${nm(w, s0.boss)}, standing ${s0.standing}${s0.want ? `, wanting ${WANT[s0.want]}` : ''}${s0.problem ? `, with a ${s0.problem} problem` : ''}. Ended ${c.alive ? `as ${c.rank === 'associate' ? 'an' : 'a'} ${c.rank} of ${famName(w, c.familyId)} under ${nm(w, c.bossId)}, standing ${Math.round(c.standing)}, $${Math.round(c.cash).toLocaleString('en-US')} in his pocket` : 'dead'}.`, ''];
  for (const e of shown) lines.push(`- ${when(e.t)}: ${e.text}`);
  if (kept.length > MAX) lines.push(`- … and ${kept.length - MAX} more entries`);
  if (friendLines.length > 4) lines.push(`- (${friendLines.length - 4} more friendships formed or lost, not listed)`);
  if (Object.keys(skipped).length) lines.push(`- Also: ${Object.entries(skipped).map(([k, v]) => `${v} ${k.replace('_', ' ')}${v > 1 ? 's' : ''}`).join(', ')} involving him.`);
  return lines;
}

// ============================================================================ command line
if (process.argv[1] && /longrun\.ts$/.test(process.argv[1])) {
  const seed = Number(process.argv[2] ?? 3), weeks = Number(process.argv[3] ?? 104), dir = process.argv[4] ?? 'longrun-out';
  const o = run(seed, weeks);
  const { md, json } = report(o, seed);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/seed${seed}.md`, md);
  writeFileSync(`${dir}/seed${seed}.json`, JSON.stringify(json));
  console.log(`seed ${seed}: ${weeks} weeks, report in ${dir}/seed${seed}.md`);
}
