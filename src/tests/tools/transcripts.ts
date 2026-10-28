// Multi-turn conversations from real game states, played through the conversation engine the screen uses (conv/visit.ts), for the
// conversation overhaul's report (docs/conversations/REPORT.md). Each scenario sets up a credible circumstance in a generated world
// (who trusts whom, who has been holding out), plays the exchange by what a player would pick, and prints what was said, what could be
// said next, and what the world recorded. Run: npx tsx src/tests/tools/transcripts.ts
import { createWorld, type StartAt } from '../../world';
import { advance } from '../../engine';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { rel } from '../../core';
import { temper } from '../../temper';
import { DAY, type Character, type World } from '../../types';

export interface Played { lines: string[]; v: Visit; w: World }
const first = (n: string) => n.split(' ')[0];
export function world(start: StartAt, seed: number, days = 10): World {
  const w = createWorld(seed, 'Tony Marino', { start }); advance(w, w.now + days * DAY);
  w.now = Math.floor(w.now / DAY) * DAY + 15 * 60; for (const e of w.enc) e.status = 'done';
  return w;
}
// talk to a man, saying the things that match, in order; a step that isn't on offer ends the walk (and says so)
export function play(w: World, t: Character, steps: RegExp[]): Played {
  const out: string[] = [];
  let v = begin(w, t.id), n = 0;
  const flush = () => { for (const l of v.lines.slice(n)) out.push(l.who === 'you' ? `You: ${l.text}` : l.who === 'him' ? `${first(t.name)}: ${l.text}` : l.who === 'narr' ? `  (${l.text})` : `  [${l.text}]`); n = v.lines.length; };
  flush();
  for (const re of steps) {
    const all = [...v.choices, ...everything(w, v)];
    const c = all.find((x) => re.test(x.label));
    if (!c) { out.push(`  — not offered: ${re} (offered: ${all.filter((x) => x.group !== 'leave').map((x) => x.label).slice(0, 8).join(' / ')})`); break; }
    v = choose(w, v, c.id).v; flush();
  }
  out.push(`  → next: ${v.choices.filter((x) => x.group !== 'leave' && x.id !== 'home').map((x) => x.label).join(' / ') || '(the list)'}`);
  return { lines: out, v, w };
}
export const setRel = (from: Character, to: Character, r: Partial<{ trust: number; respect: number; affection: number; grudge: number; fear: number }>) => Object.assign(rel(from, to.id), r);
export const tempers = (c: Character) => { const t = temper(c); return `caution ${t.caution.toFixed(2)}, pride ${t.pride.toFixed(2)}, volatility ${t.volatility.toFixed(2)}, nerve ${c.skills.nerve.toFixed(2)}`; };
