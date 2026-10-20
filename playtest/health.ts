// Long-run world health. Runs the real simulation with no player input (time only) for a number of days and samples the world
// every 30 days: population, deaths, arrests, promotions, money, protection, violence, matters, NPC goals, the player's passive
// drift, news volume, speed and save size. Nothing here changes the world except advance().
//
//   npx tsx playtest/health.ts                      seeds 3 7 11, 180 days, this checkout
//   npx tsx playtest/health.ts 3 7 11 19 --days 90  other seeds / length
//   HEALTH_SRC=/path/to/other/src LABEL=v88 npx tsx playtest/health.ts   run against another checkout's source (V88 comparison)
//   HEALTH_JSON=out.json ...                        also write every sample as JSON
//
// Wall-clock time is read here (performance only); the simulation itself never sees it.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = (process.env.HEALTH_SRC || fileURLToPath(new URL('../src', import.meta.url))).replace(/\/$/, '');
const LABEL = process.env.LABEL || 'this';
const argv = process.argv.slice(2);
const di = argv.indexOf('--days');
const DAYS = di >= 0 ? Number(argv[di + 1]) : 180;
const SEEDS = argv.filter((a, i) => /^\d+$/.test(a) && (di < 0 || i !== di + 1)).map(Number);
if (!SEEDS.length) SEEDS.push(3, 7, 11);
const STEP = 30;
const DAY = 1440;
const RANKS = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const VIOLENT = ['beating', 'vandalism', 'murder', 'robbery', 'arrest', 'burglary', 'theft', 'poach', 'protection_started', 'protection_refused', 'informant', 'promotion', 'rumour', 'gambling_loss', 'threat'];

const engine = await import(SRC + '/engine.ts');
const world = await import(SRC + '/world.ts');
const goals = await import(SRC + '/goals.ts');
const consistency = await import(SRC + '/consistency.ts');
const econ = await import(SRC + '/econ.ts');
const situ: any = await import(SRC + '/situ.ts').catch(() => ({}));

type Any = any;
const inc = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

interface Sample {
  day: number;
  pop: Record<string, Record<string, number>>; // family -> rank -> alive count (and 'jailed')
  alive: number; dead: number; jailed: number; informants: number; exposed: number;
  deaths: Record<string, number>; // window, by cause
  deathsByRank: Record<string, number>;
  promotions: number; demotions: number; promoByRank: Record<string, number>;
  money: number; moneyDelta: number; charCash: number; bizCash: number; treasury: Record<string, number>;
  top5: number; top1man: string; playerCash: number; debtsActive: number; debtBal: number;
  bizOpen: number; bizClosed: number; distressed: number; distressAvg: number;
  protected: Record<string, number>; protChanges: { gained: number; lost: number; poached: number };
  facts: Record<string, number>; // window, by kind (selected)
  allFacts: number;
  tension: Record<string, number>;
  asks: Record<string, number>; // window: negotiations opened by kind (open.<ak>) and how they ended (<ak>.<outcome>)
  sit: Record<string, number>; // stats delta for the window (start.*, out.*, ...)
  open: Record<string, number>; // open situations by kind (asks by ak)
  caps: Record<string, number>;
  goals: { active: number; byKind: Record<string, number>; done: number; failed: number; dropped: number; started: number };
  player: { cash: number; standing: number; heat: number; rank: string; bossTrust: number | null; bossRespect: number | null; boss: string; known: number; alive: boolean; jailed: boolean };
  papers: number; paperItems: number;
  ms: number; msPerDay: number; save: number; audit: string[]; ledger: string[];
}

function deathCause(w: Any, id: string, newFacts: Any[]): string {
  const c = w.chars[id];
  const f = newFacts.find((x) => x.victim === id && x.kind === 'murder') ?? Object.values(w.facts).find((x: Any) => x.victim === id && x.kind === 'murder');
  if (f) return 'murder';
  const g = newFacts.find((x) => x.victim === id && Math.abs(x.t - (c.diedAt ?? 0)) < DAY);
  if (g) return g.kind;
  const h = newFacts.find((x) => x.actor === id && Math.abs(x.t - (c.diedAt ?? 0)) < DAY && /die|dead|kill|found/i.test(x.text ?? ''));
  return h ? h.kind : 'unrecorded';
}

function runSeed(seed: number) {
  const w: Any = world.createWorld(seed, 'Tony Marino');
  const samples: Sample[] = [];
  const rank: Record<string, string> = {}, alive: Record<string, boolean> = {};
  for (const c of Object.values(w.chars) as Any[]) { rank[c.id] = c.rank; alive[c.id] = c.alive; }
  const seenFacts = new Set<string>(Object.keys(w.facts));
  const askSeen = new Map<string, boolean>(); // ask id -> already counted as ended
  const prot: Record<string, string | undefined> = {};
  for (const b of Object.values(w.biz) as Any[]) prot[b.id] = b.protection?.familyId;
  let lastStats: Record<string, number> = { ...(w.sitpace?.stats ?? {}) };
  let lastGoalStats: Record<string, number> = { ...(goals.agencyOf(w).stats ?? {}) };
  let lastMoney = goals.moneyTotal(w);
  const win = () => ({ deaths: {} as Record<string, number>, deathsByRank: {} as Record<string, number>, promotions: 0, demotions: 0, promoByRank: {} as Record<string, number>, facts: {} as Record<string, number>, asks: {} as Record<string, number>, allFacts: 0, prot: { gained: 0, lost: 0, poached: 0 }, ms: 0 });
  let cur = win();
  const sample = (day: number): Sample => {
    const chars = Object.values(w.chars) as Any[];
    const pop: Record<string, Record<string, number>> = {};
    let jailed = 0, informants = 0, exposed = 0, nAlive = 0;
    for (const c of chars) {
      if (!c.alive || c.isPlayer) continue;
      nAlive++;
      const f = c.familyId ? w.fam[c.familyId]?.name ?? c.familyId : 'none';
      (pop[f] ??= {})[c.rank] = (pop[f][c.rank] ?? 0) + 1;
      if (c.jailedUntil > w.now) { jailed++; inc(pop[f], 'jailed'); }
      if (c.informant) { informants++; if (c.informant.exposed) exposed++; }
    }
    const cash = chars.filter((c) => c.alive).map((c) => c.cash).sort((a, b) => b - a);
    const totalCash = cash.reduce((a, b) => a + Math.max(0, b), 0);
    const k = Math.max(1, Math.ceil(cash.length * 0.05));
    const top5 = totalCash > 0 ? cash.slice(0, k).reduce((a, b) => a + b, 0) / totalCash : 0;
    const rich = chars.filter((c) => c.alive).sort((a, b) => b.cash - a.cash)[0];
    const biz = Object.values(w.biz) as Any[];
    const open = biz.filter((b) => b.open);
    const protectedBy: Record<string, number> = {};
    for (const b of open) if (b.protection) inc(protectedBy, w.fam[b.protection.familyId]?.name ?? b.protection.familyId);
    protectedBy['(none)'] = open.filter((b) => !b.protection).length;
    const tension: Record<string, number> = {};
    const fams = Object.values(w.fam) as Any[];
    for (const a of fams) for (const b of fams) if (a.id < b.id) tension[`${a.name}/${b.name}`] = Math.round(Math.max(a.tension?.[b.id] ?? 0, b.tension?.[a.id] ?? 0) * 100) / 100;
    const treasury: Record<string, number> = {};
    for (const f of fams) treasury[f.name] = f.treasury ?? 0;
    const st = w.sitpace?.stats ?? {};
    const sit: Record<string, number> = {};
    for (const [kk, v] of Object.entries(st) as [string, number][]) if (v - (lastStats[kk] ?? 0)) sit[kk] = v - (lastStats[kk] ?? 0);
    lastStats = { ...st };
    const openK: Record<string, number> = {};
    for (const s of (w.situations ?? []) as Any[]) if (s.stage !== 'resolved') inc(openK, s.kind === 'ask' ? 'ask.' + (s.ak ?? '?') : s.kind ?? '?');
    const caps: Record<string, number> = { ...(situ.SIT?.cap?.own ?? {}), open: situ.SIT?.cap?.open ?? 0 };
    const ag = goals.agencyOf(w);
    const gs = ag.stats ?? {};
    const gd = (pfx: string) => Object.entries(gs).filter(([kk]) => kk.startsWith(pfx)).reduce((a, [kk, v]: Any) => a + v - Object.entries(lastGoalStats).filter(([k2]) => k2 === kk).reduce((x, [, y]: Any) => x + y, 0), 0);
    const g = { active: ag.goals.length, byKind: {} as Record<string, number>, done: gd('done.'), failed: gd('failed.'), dropped: gd('dropped.'), started: gd('started.') };
    for (const x of ag.goals) inc(g.byKind, x.kind);
    lastGoalStats = { ...gs };
    const p = w.chars[w.playerId];
    const boss = p.bossId ? w.chars[p.bossId] : undefined;
    const r = boss?.rels?.[p.id];
    const m = goals.moneyTotal(w);
    const t0 = performance.now();
    const save = engine.serialize(w).length;
    void t0;
    const s: Sample = {
      day, pop, alive: nAlive, dead: chars.filter((c) => !c.alive).length, jailed, informants, exposed,
      deaths: cur.deaths, deathsByRank: cur.deathsByRank, promotions: cur.promotions, demotions: cur.demotions, promoByRank: cur.promoByRank,
      money: m, moneyDelta: m - lastMoney, charCash: chars.reduce((a, c) => a + c.cash, 0), bizCash: biz.reduce((a, b) => a + b.cash, 0), treasury,
      top5: Math.round(top5 * 1000) / 10, top1man: rich ? `${rich.name} (${rich.rank}) $${rich.cash}` : '', playerCash: p.cash,
      debtsActive: w.debts.filter((d: Any) => d.status === 'active').length, debtBal: w.debts.filter((d: Any) => d.status === 'active').reduce((a: number, d: Any) => a + d.balance, 0),
      bizOpen: open.length, bizClosed: biz.length - open.length, distressed: open.filter((b) => b.distress > 0).length, distressAvg: open.length ? Math.round((open.reduce((a, b) => a + b.distress, 0) / open.length) * 100) / 100 : 0,
      protected: protectedBy, protChanges: cur.prot, facts: cur.facts, asks: cur.asks, allFacts: cur.allFacts, tension, sit, open: openK, caps, goals: g,
      player: { cash: p.cash, standing: Math.round(p.standing * 10) / 10, heat: Math.round(p.heat * 100) / 100, rank: p.rank, bossTrust: r ? Math.round(r.trust * 1000) / 1000 : null, bossRespect: r ? Math.round(r.respect * 1000) / 1000 : null, boss: boss?.name ?? '-', known: Object.keys(p.known).length, alive: p.alive, jailed: p.jailedUntil > w.now },
      papers: (w.papers ?? []).length, paperItems: (w.papers ?? []).reduce((a: number, x: Any) => a + x.items.length, 0),
      ms: Math.round(cur.ms), msPerDay: Math.round((cur.ms / STEP) * 10) / 10, save, audit: consistency.audit(w).slice(0, 5), ledger: econ.ledgerCheck(w).slice(0, 5),
    };
    lastMoney = m;
    cur = win();
    return s;
  };
  samples.push(sample(0));
  for (let d = 1; d <= DAYS; d++) {
    const t = performance.now();
    engine.advance(w, w.now + DAY);
    cur.ms += performance.now() - t;
    const fresh: Any[] = [];
    for (const id in w.facts) if (!seenFacts.has(id)) { seenFacts.add(id); fresh.push(w.facts[id]); }
    for (const f of fresh) { cur.allFacts++; if (VIOLENT.includes(f.kind)) inc(cur.facts, f.kind); }
    for (const c of Object.values(w.chars) as Any[]) {
      if (alive[c.id] === undefined) { alive[c.id] = c.alive; rank[c.id] = c.rank; continue; }
      if (alive[c.id] && !c.alive) { inc(cur.deaths, deathCause(w, c.id, fresh)); inc(cur.deathsByRank, rank[c.id]); }
      alive[c.id] = c.alive;
      if (c.alive && rank[c.id] !== c.rank) {
        const up = RANKS.indexOf(c.rank) > RANKS.indexOf(rank[c.id]);
        if (up) { cur.promotions++; inc(cur.promoByRank, `${rank[c.id]}>${c.rank}`); } else cur.demotions++;
      }
      rank[c.id] = c.rank;
    }
    for (const s of (w.situations ?? []) as Any[]) {
      if (s.kind !== 'ask') continue;
      if (!askSeen.has(s.id)) { askSeen.set(s.id, false); inc(cur.asks, 'open.' + (s.ak ?? '?')); }
      if (s.stage === 'resolved' && !askSeen.get(s.id)) { askSeen.set(s.id, true); inc(cur.asks, (s.ak ?? '?') + '.' + (s.out ?? '?')); }
    }
    for (const b of Object.values(w.biz) as Any[]) {
      const now = b.open ? b.protection?.familyId : undefined, was = prot[b.id];
      if (now !== was) { if (!was) cur.prot.gained++; else if (!now) cur.prot.lost++; else cur.prot.poached++; }
      prot[b.id] = now;
    }
    if (d % STEP === 0) {
      samples.push(sample(d));
      const s = samples[samples.length - 1];
      console.error(`  [${LABEL} seed ${seed}] day ${d}: alive ${s.alive}, ${s.msPerDay} ms/day, save ${Math.round(s.save / 1024)} KB, audit ${s.audit.length}, ledger ${s.ledger.length}`);
    }
  }
  return samples;
}

// ---------------------------------------------------------------- print
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const fmt = (o: Record<string, number>) => Object.entries(o).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '-';
const all: Record<number, Sample[]> = {};
for (const seed of SEEDS) {
  console.error(`${LABEL}: seed ${seed}, ${DAYS} days`);
  const ss = runSeed(seed);
  all[seed] = ss;
  console.log(`\n==================== ${LABEL} seed ${seed} ====================`);
  console.log(pad('day', 5) + ['alive', 'dead', 'jail', 'inf', 'promo', 'murd', 'beat', 'vand', 'arrest', 'poach', 'money$k', 'top5%', 'biz', 'dist', 'prot', 'trust', 'stand', 'pcash', 'goals', 'ms/d', 'saveKB'].map((x) => pad(x, 8)).join(''));
  for (const s of ss) {
    const prot = sum(s.protected) - (s.protected['(none)'] ?? 0);
    console.log(pad(s.day, 5) + [s.alive, s.dead, s.jailed, s.informants, s.promotions, s.facts.murder ?? 0, s.facts.beating ?? 0, s.facts.vandalism ?? 0, s.facts.arrest ?? 0, s.facts.poach ?? 0, Math.round(s.money / 1000), s.top5, s.bizOpen, s.distressed, prot, s.player.bossTrust ?? '-', s.player.standing, s.player.cash, s.goals.active, s.msPerDay, Math.round(s.save / 1024)].map((x) => pad(x, 8)).join(''));
  }
  for (const s of ss.slice(1)) {
    console.log(`-- day ${s.day}`);
    console.log(`   population: ${Object.entries(s.pop).map(([f, r]) => `${f}: ${RANKS.filter((k) => r[k]).map((k) => `${k} ${r[k]}`).join(' ')}${r.jailed ? ` (jailed ${r.jailed})` : ''}`).join(' | ')}`);
    console.log(`   deaths: ${fmt(s.deaths)} | by rank: ${fmt(s.deathsByRank)} | promotions: ${fmt(s.promoByRank)} demotions ${s.demotions} | informants ${s.informants} (exposed ${s.exposed})`);
    console.log(`   money: total ${s.money} (${s.moneyDelta >= 0 ? '+' : ''}${s.moneyDelta}), men ${s.charCash}, shops ${s.bizCash}, treasuries ${fmt(s.treasury)}; richest ${s.top1man}; debts ${s.debtsActive} owing ${s.debtBal}`);
    console.log(`   shops: open ${s.bizOpen} closed ${s.bizClosed} distressed ${s.distressed} (avg ${s.distressAvg}); protected ${fmt(s.protected)}; changes gained ${s.protChanges.gained} lost ${s.protChanges.lost} poached ${s.protChanges.poached}`);
    console.log(`   facts (${s.allFacts}): ${fmt(s.facts)}`);
    console.log(`   tension: ${fmt(s.tension)}`);
    console.log(`   negotiations: ${fmt(s.asks)}`);
    console.log(`   matters stats: ${fmt(s.sit)}`);
    console.log(`   open: ${fmt(s.open)}`);
    console.log(`   goals: active ${s.goals.active} (${fmt(s.goals.byKind)}), window started ${s.goals.started} done ${s.goals.done} failed ${s.goals.failed} dropped ${s.goals.dropped}`);
    console.log(`   player: ${JSON.stringify(s.player)}; papers ${s.papers} (${s.paperItems} items)`);
    if (s.audit.length || s.ledger.length) console.log(`   AUDIT: ${s.audit.join(' / ')} LEDGER: ${s.ledger.join(' / ')}`);
  }
}
if (process.env.HEALTH_JSON) writeFileSync(process.env.HEALTH_JSON, JSON.stringify({ label: LABEL, days: DAYS, samples: all }, null, 1));
