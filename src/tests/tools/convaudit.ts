// The conversation audit (docs/conversations/AUDIT.md): plays every opening choice with every kind of man, at every seat, in a copy of
// the world, and writes what was said, what came next, and what looks wrong. Run: npx tsx src/tests/tools/convaudit.ts [seed] [out.md]
// It is the measuring stick for the conversation overhaul: the same run before and after.
import { writeFileSync } from 'node:fs';
import { createWorld, type StartAt } from '../../world';
import { advance, deserialize, serialize } from '../../engine';
import { begin, choose, everything } from '../../conv/visit';
import { DAY, type Character, type World } from '../../types';
import { ownerBiz } from '../../core';

export interface Flag { kind: string; text: string; where: string }
export interface Probe { start: StartAt; role: string; npc: string; choices: { id: string; label: string; group: string }[]; runs: { id: string; label: string; said: string[]; next: string[]; empty: boolean }[] }

const first = (n: string) => n.split(' ')[0];
// the men a player at this seat would talk to, by what they are to him
export function cast(w: World): [string, Character][] {
  const p = w.chars[w.playerId!], all = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.jailedUntil <= w.now);
  const fam = all.filter((c) => c.familyId === p.familyId);
  const out: [string, Character | undefined][] = [
    ['his boss', p.bossId ? w.chars[p.bossId] : undefined],
    ['his own man', all.find((c) => c.bossId === p.id)],
    ['a peer in the family', fam.find((c) => c.rank === p.rank && c.id !== p.bossId && c.bossId !== p.id)],
    ['a senior man of the family', fam.find((c) => ['capo', 'underboss', 'boss'].includes(c.rank) && c.id !== p.bossId && c.bossId !== p.id && c.rank !== p.rank)],
    ['the boss', p.familyId ? w.chars[w.fam[p.familyId].bossId] : undefined],
    ['another family’s made man', all.find((c) => c.familyId && c.familyId !== p.familyId && c.rank !== 'associate')],
    ['a shopkeeper', all.find((c) => c.rank === 'civilian' && !!ownerBiz(w, c.id))],
    ['a civilian', all.find((c) => c.rank === 'civilian' && !ownerBiz(w, c.id))],
  ];
  const seen = new Set<string>();
  return out.filter((x): x is [string, Character] => { if (!x[1] || x[1].isPlayer || seen.has(x[1].id)) return false; seen.add(x[1].id); return true; });
}
// What looks wrong in a line, mechanically: the speaker naming himself, the player named to his face, broken text
export function lint(text: string, who: 'him' | 'you' | 'narr' | 'card', speaker: Character, player: Character, where: string): Flag[] {
  const f: Flag[] = [];
  const quoted = who === 'him' ? (text.match(/“[^”]*”|"[^"]*"/g) ?? (/[“"]/.test(text) ? [] : [text])).join(' ') : '';
  if (quoted) {
    if (first(speaker.name) !== first(player.name) && new RegExp(`\\b${first(speaker.name)}\\b(?! (?!${speaker.name.split(' ').slice(1).join(' ')})[A-Z])`).test(quoted)) f.push({ kind: 'self-named', text, where });
    if (new RegExp(`\\b${player.name}\\b`).test(quoted)) f.push({ kind: 'player-full-name-to-his-face', text, where });
    if (/\b(ask|speak to|talk to|go to|clear it with|get leave from|get the word of)\s+(yourself|you)\b(?! (are|were|need|want|know))/i.test(quoted)) f.push({ kind: 'send-to-self', text, where });
  }
  if (/(?<!\.)\.\.(?!\.)|,,|\s[.,;:!?](?!\.)|\s{2,}|“\s|\s”|\b(\w+) \1\b/i.test(text)) f.push({ kind: 'punctuation-or-repeat', text, where });
  if (/undefined|NaN|\[object|\{\w+\}|null\b/.test(text)) f.push({ kind: 'template-leak', text, where });
  if (/\ba [aeiou]\w/i.test(text) && !/\ba (one|uni|use|eu|u[sr])/i.test(text)) f.push({ kind: 'a-an', text, where });
  if (/(^|(?<!\.\.)[.!?]\s+|“)[a-z]/.test(text)) f.push({ kind: 'lowercase-start', text, where });
  return f;
}
export function probe(w0: World, start: StartAt, role: string, npc: Character, flags: Flag[]): Probe {
  const snap = serialize(w0);
  const w = deserialize(snap), p = w.chars[w.playerId!];
  const v = begin(w, npc.id);
  const where = `${start} → ${role} (${npc.name}, ${npc.rank})`;
  for (const l of v.lines) flags.push(...lint(l.text, l.who, npc, p, where + ' · opening'));
  const choices = everything(w, v).filter((c) => c.group !== 'leave' && c.id !== 'home').map((c) => ({ id: c.id, label: c.label, group: c.group }));
  const runs: Probe['runs'] = [];
  for (const ch of choices) {
    const w2 = deserialize(snap), p2 = w2.chars[w2.playerId!];
    try {
      const v2 = begin(w2, npc.id); const n0 = v2.lines.length;
      everything(w2, v2);
      const r = choose(w2, v2, ch.id);
      const said = r.v.lines.slice(n0).map((l) => `${l.who === 'him' ? first(npc.name) : l.who === 'you' ? 'You' : l.who === 'narr' ? '·' : 'Card'}: ${l.text}`);
      for (const l of r.v.lines.slice(n0)) flags.push(...lint(l.text, l.who, npc, p2, `${where} · “${ch.label}”`));
      const empty = !r.v.lines.slice(n0).some((l) => l.who !== 'you');
      if (empty) flags.push({ kind: 'no-response', text: ch.label, where });
      runs.push({ id: ch.id, label: ch.label, said, next: r.v.choices.filter((c) => c.group !== 'leave' && c.id !== 'home').map((c) => c.label), empty });
    } catch (e) { flags.push({ kind: 'error', text: `${ch.label}: ${String(e).slice(0, 200)}`, where }); }
  }
  return { start, role, npc: `${npc.name} (${npc.rank})`, choices, runs };
}
export function auditRun(seed: number, days = 20): { probes: Probe[]; flags: Flag[] } {
  const probes: Probe[] = [], flags: Flag[] = [];
  for (const start of ['associate', 'soldier', 'capo', 'underboss', 'consigliere', 'boss'] as StartAt[]) {
    const w = createWorld(seed, 'Tony Marino', { start });
    advance(w, w.now + days * DAY);
    w.now = Math.floor(w.now / DAY) * DAY + 14 * 60; // (the middle of the afternoon: men are up and about)
    for (const [role, npc] of cast(w)) probes.push(probe(w, start, role, npc, flags));
  }
  return { probes, flags };
}
if (process.argv[1]?.endsWith('convaudit.ts')) {
  const seed = Number(process.argv[2] ?? 3), out = process.argv[3];
  const { probes, flags } = auditRun(seed);
  const n = probes.reduce((a, p) => a + p.choices.length, 0), labels = new Set(probes.flatMap((p) => p.choices.map((c) => c.id.split(':').slice(0, 2).join(':'))));
  const kinds: Record<string, number> = {}; for (const f of flags) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  let md = `# Conversation audit run (seed ${seed})\n\n${probes.length} conversations; ${n} opening choices in all (${(n / probes.length).toFixed(1)} each); ${labels.size} distinct actions.\n\nFlags: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}\n\n`;
  for (const pr of probes) {
    md += `## ${pr.start} → ${pr.npc}\n\n${pr.choices.length} choices\n\n`;
    for (const r of pr.runs) md += `- **${r.label}**\n${r.said.map((s) => `  - ${s}`).join('\n')}\n${r.next.length ? `  - _then:_ ${r.next.join(' / ')}\n` : ''}`;
    md += '\n';
  }
  md += `## Flags\n\n${flags.map((f) => `- [${f.kind}] ${f.where}: ${f.text}`).join('\n')}\n`;
  if (out) writeFileSync(out, md);
  console.log(`${probes.length} conversations, ${n} choices (${(n / probes.length).toFixed(1)} each), ${labels.size} distinct actions; flags:`, kinds);
}
