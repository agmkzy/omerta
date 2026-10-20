import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { describe, generate, grudgeWord, perform } from './actions';
import { factText, famName, fmtTime, money, ownerBiz, shortTime } from './core';
import { advance, deserialize, history, report, serialize } from './engine';
import { Action, DAY, Kind, World } from './types';
import { createWorld } from './world';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';
const opt = (n: string, d?: string) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};
const SAVE = opt('save', 'omerta-save.json')!;

// ------------------------------------------------------------ headless sim

function sim() {
  const seed = Number(opt('seed', '1'));
  const days = Number(opt('days', '180'));
  const w = createWorld(seed);
  advance(w, w.now + days * DAY);
  console.log(`OMERTÀ - headless simulation - seed ${seed} - ${days} days (${fmtTime(w.now)})\n`);
  console.log(report(w));
  const h = history(w);
  const out = opt('out');
  if (out) {
    fs.writeFileSync(out, h.join('\n') + '\n');
    console.log(`\nFull history (${h.length} events) written to ${out}`);
  }
  const last = Number(opt('last', '40'));
  console.log(`\nHISTORY (last ${Math.min(last, h.length)} of ${h.length} notable events)`);
  console.log(h.slice(-last).join('\n'));
}

// -------------------------------------------------------------- play mode

const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
async function ask(prompt: string): Promise<string | null> {
  process.stdout.write(prompt);
  const r = await lines.next();
  return r.done ? null : String(r.value).trim();
}

function sourceOf(w: World, from: string): string {
  if (from === 'witness') return 'you saw it';
  if (from === 'self') return 'you did it';
  if (from === 'public') return 'word on the street';
  return `heard from ${w.chars[from]?.name ?? 'someone'}`;
}

function status(w: World) {
  const p = w.chars[w.playerId!];
  const heat = '#'.repeat(Math.min(8, Math.round(p.heat * 8))).padEnd(8, '.');
  console.log(`\n=== ${fmtTime(w.now)} | ${p.district} ===`);
  console.log(`${p.name}, ${p.rank} (${famName(w, p)}) | ${money(p.cash)} | heat [${heat}]${p.hurtUntil > w.now ? ' | hurt' : ''}`);
}

function news(w: World, since: number) {
  const p = w.chars[w.playerId!];
  const items = Object.entries(p.known)
    .filter(([id, k]) => k.t > since && w.facts[id] && !w.facts[id].minor)
    .sort((a, b) => a[1].t - b[1].t)
    .slice(-8);
  if (!items.length) return;
  console.log('\nWhile you were busy:');
  for (const [id, k] of items) console.log(`  - ${factText(w.facts[id], k.knowsActor)} (${sourceOf(w, k.from)})`);
}

function intel(w: World) {
  const p = w.chars[w.playerId!];
  const items = Object.entries(p.known)
    .filter(([id]) => w.facts[id] && !w.facts[id].minor)
    .sort((a, b) => w.facts[b[0]].t - w.facts[a[0]].t)
    .slice(0, 12);
  console.log('\nWhat you know (most recent):');
  for (const [id, k] of items) {
    const f = w.facts[id];
    console.log(`  [${shortTime(f.t)}] ${factText(f, k.knowsActor)} (${sourceOf(w, k.from)})`);
    if (f.cause && p.known[f.cause]) console.log(`      because: ${w.facts[f.cause].text}`);
  }
  if (!items.length) console.log('  Nothing yet. Talk to people.');
}

function people(w: World) {
  const p = w.chars[w.playerId!];
  console.log('\nPeople you know:');
  Object.entries(p.rels)
    .filter(([id]) => w.chars[id]?.alive)
    .sort((a, b) => b[1].trust - a[1].trust)
    .slice(0, 14)
    .forEach(([id, r]) => {
      const x = w.chars[id];
      const grudge = r.grudge >= 0.3 ? `, your grudge: ${grudgeWord(r.grudge)}` : '';
      console.log(`  ${describe(w, x)} - trust ${r.trust.toFixed(2)}, affection ${r.affection.toFixed(2)}${grudge}`);
    });
}

function businesses(w: World) {
  const p = w.chars[w.playerId!];
  console.log(`\nBusinesses in ${p.district}:`);
  for (const b of Object.values(w.biz).filter((x) => x.district === p.district)) {
    const prot = b.protection ? `protected by ${w.chars[b.protection.collectorId]?.name ?? '?'} (${w.fam[b.protection.familyId].name})` : 'unprotected';
    console.log(`  ${b.name} - ${b.open ? 'open' : 'CLOSED'}, ${w.chars[b.ownerId].name}, ${prot}`);
  }
}

function ledger(w: World) {
  const p = w.chars[w.playerId!];
  const mine = w.debts.filter((d) => d.status === 'active' && (d.creditor === p.id || d.debtor === p.id));
  console.log('\nLedger:');
  if (!mine.length) console.log('  No open debts.');
  for (const d of mine) {
    const who = d.creditor === p.id ? `${w.chars[d.debtor].name} owes you` : `You owe ${w.chars[d.creditor].name}`;
    console.log(`  ${who} ${money(d.balance)} (${d.reason}, ${money(d.weeklyPayment)}/wk, ${d.missed} missed, next due ${shortTime(d.nextDue)})`);
  }
  const crew = Object.values(w.chars).filter((c) => c.bossId === p.id && c.alive);
  console.log(`Your crew: ${crew.map((c) => `${c.name} (${money(c.cash)})`).join(', ') || 'none'}`);
}

async function pick(title: string, items: string[]): Promise<number | null> {
  console.log(`\n${title}`);
  items.forEach((l, i) => console.log(`  [${i + 1}] ${l}`));
  console.log('  [0] Back');
  const a = await ask('> ');
  if (a === null) return -1;
  const n = Number(a);
  return n >= 1 && n <= items.length ? n - 1 : null;
}

const CATS: [string, string, Kind][] = [
  ['1', 'Spend time with someone', 'socialise'],
  ['2', 'Lend money', 'lend'],
  ['3', 'Collect a debt', 'collect'],
  ['4', 'Lean on a business', 'shakedown'],
  ['5', 'Gamble', 'gamble'],
  ['6', 'Settle a score', 'retaliate'],
  ['7', 'Work / lay low', 'work'],
];

async function play() {
  let w: World;
  if (fs.existsSync(SAVE) && !args.includes('--new')) {
    w = deserialize(fs.readFileSync(SAVE, 'utf8'));
    console.log(`Loaded ${SAVE}.`);
  } else {
    w = createWorld(Number(opt('seed', String(Date.now() % 100000))), opt('name', 'Tony Marino'));
    const p = w.chars[w.playerId!];
    const boss = w.chars[p.bossId!];
    console.log('OMERTA - New York, March 1970.');
    console.log(`You're ${p.name}, a small-time associate of the ${famName(w, p)} family, answering to ${boss.name}.`);
    console.log('You have $1,500 and nobody under you. Nobody is going to hand you a story.');
    console.log('Time only moves when you act. Everyone else keeps living while it does.');
  }
  const p = w.chars[w.playerId!];
  const save = () => fs.writeFileSync(SAVE, serialize(w));

  for (;;) {
    if (!p.alive) return console.log('\nYou are dead. The world goes on without you.');
    if (p.jailedUntil > w.now) {
      console.log(`\nYou're locked up until ${fmtTime(p.jailedUntil)}.`);
      const t0 = w.now;
      advance(w, p.jailedUntil);
      news(w, t0);
      continue;
    }
    status(w);
    console.log(CATS.map(([k, l]) => `[${k}] ${l}`).join('  '));
    console.log('[8] Wait  [i] Intel  [p] People  [b] Businesses  [l] Ledger  [s] Save  [q] Quit');
    const c = await ask('> ');
    if (c === null || c === 'q') {
      save();
      return console.log('Saved. Arrivederci.');
    }
    let act: Action | null = null;
    const cat = CATS.find(([k]) => k === c);
    if (cat) {
      const opts = generate(w, p, cat[2]).sort((a, b) => b.score - a.score).slice(0, 9);
      if (!opts.length) {
        console.log('\nNothing available right now.');
        continue;
      }
      const i = await pick(cat[1], opts.map((o) => o.label));
      if (i === -1) return save();
      if (i !== null) act = opts[i];
    } else if (c === '8') {
      const choices: [string, number][] = [['One hour', 1], ['Four hours', 4], ['Until tomorrow morning', 24 - ((w.now % DAY) / 60) + 9], ['Three days', 72]];
      const i = await pick('Wait how long?', choices.map((x) => x[0]));
      if (i === -1) return save();
      if (i !== null) act = { kind: 'wait', actor: p.id, hours: choices[i][1], label: 'wait', score: 0 };
    } else if (c === 'i') intel(w);
    else if (c === 'p') people(w);
    else if (c === 'b') businesses(w);
    else if (c === 'l') ledger(w);
    else if (c === 's') {
      save();
      console.log('Saved.');
    }
    if (act) {
      const t0 = w.now;
      const r = perform(w, act);
      console.log('');
      r.lines.forEach((l) => console.log(l));
      advance(w, t0 + r.minutes);
      news(w, t0);
      save();
    }
  }
}

// ----------------------------------------------------------------- main

if (cmd === 'sim') sim();
else if (cmd === 'play') play().then(() => process.exit(0));
else {
  console.log('OMERTÀ\n  sim  [--seed N] [--days N] [--last N] [--out file]   run the world headless and print its history');
  console.log('  play [--new] [--seed N] [--name "Name"] [--save file]   play interactively (autosaves)');
}
