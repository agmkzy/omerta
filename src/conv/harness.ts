// The Gate 1 harness: plays a visit the way the screen would. The player can only pick a row that is on screen (it throws
// otherwise), every NPC line is rendered from a decision, and each exchange is written with its trace.
import { render } from './render';
import { perceive, type Session } from './perception';
import { EncounterMemory } from './encounter';
import type { interpret } from './speech';
import type { Reply } from './respond';
import type { Meaning, Spoken } from './types';
import type { Character, World } from '../types';

export class Out { lines: string[] = []; P(s = '') { this.lines.push(s); } text() { return this.lines.join('\n'); } }
export interface Row { key: string; note: string; slots?: Record<string, string>; leave?: boolean }
export const LEAVE: Row = { key: 'leave', note: '', leave: true };
export const first = (n: string) => n.split(' ')[0];
const famOf = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId].name : '');

export class Visit {
  spoken = new Set<string>(); n = 0; rows: Row[] = []; mem: EncounterMemory;
  constructor(public o: Out, public w: World, public s: Session, public henry: Character, public him: Character, public where: string, patience = 2) { this.mem = new EncounterMemory(patience); }
  private slots(x: Record<string, string> = {}) { return { selfName: this.henry.name, selfFamily: famOf(this.w, this.henry), ...x }; }
  label(r: Row) { return r.leave ? 'Leave' : render({ key: r.key, stance: 'flat', toward: 'speaker', slots: this.slots(r.slots) }, this.henry.id, 'earnest'); }
  offer(rows: Row[]) {
    if (rows.length > 5) throw new Error(`more than five choices offered: ${rows.map((r) => r.key).join(', ')}`);
    this.rows = rows;
    this.o.P(''); this.o.P('> **What you can say**');
    for (const r of rows) this.o.P(r.note ? `> - ${this.label(r)}  \n>   *${r.note}*` : `> - ${this.label(r)}`);
    this.o.P('');
  }
  pick(key: string, opts: { act?: string; explicit?: 0 | 1 | 2 } = {}): Spoken {
    const r = this.rows.find((x) => x.key === key);
    if (!r) throw new Error(`choice "${key}" was not on screen (offered: ${this.rows.map((x) => x.key).join(', ') || 'nothing'})`);
    const m: Meaning = { key: r.key, stance: 'flat', toward: 'speaker', slots: this.slots(r.slots) };
    this.o.P(`**You:** ${render(m, this.henry.id, 'earnest', this.spoken)}`);
    this.rows = [];
    return { speaker: this.henry.id, listener: this.him.id, act: opts.act ?? key, explicit: opts.explicit ?? 2, meaning: m, where: this.where, at: this.w.now + this.n++ };
  }
  him_(r: Reply, extra?: { heard?: ReturnType<typeof interpret>; trace?: string[] }) {
    const p = perceive(this.w, this.s, this.him);
    this.o.P(`**${first(this.him.name)}:** ${render(r.meaning, this.him.id, p.arch, this.spoken, String(this.n))}`);
    trace(this.o, r, extra);
  }
  card(key: string, slots: Record<string, string>, more = '') { this.o.P(`> **Outcome:** ${render({ key, stance: 'flat', toward: 'speaker', slots: { first: first(this.him.name), ...slots } }, 'card', 'earnest')}${more ? ' ' + more : ''}`); this.o.P(''); }
  note(text: string) { this.o.P(`*${text}*`); this.o.P(''); }
}
export function trace(o: Out, r: Reply, extra?: { heard?: ReturnType<typeof interpret>; trace?: string[] }) {
  const d = r.decision, lines: string[] = [];
  if (extra?.heard) { const h = extra.heard; lines.push(`heard as: ${h.act} (confidence ${h.confidence}${h.literal ? ', taken literally' : ''})`); for (const c of h.cues) lines.push(`  cue: ${c.kind} (${c.weight >= 0 ? '+' : ''}${c.weight}; basis: ${c.basis.kind}${c.basis.ref ? ' ' + c.basis.ref : ''})`); }
  if (d.constraints.length) lines.push(`constraints: ${d.constraints.map((c) => `${c.kind} (${c.source})`).join('; ')}`);
  for (const c of [...d.candidates].sort((a, b) => b.value - a.value)) if (c.value > -9) lines.push(`${c.move === d.chosen ? '▶' : ' '} ${c.move} = ${c.value}${c.crosses.length ? ` [would cross: ${c.crosses.join(', ')}]` : ''}: ${c.terms.map((t) => `${t.name} ${t.value >= 0 ? '+' : ''}${t.value}`).join(', ')}`);
  if (d.grounds) lines.push(`reason given: ${d.grounds.factor}${d.grounds.honest ? '' : ' (a cover: not his real reason)'}`);
  lines.push(`meaning: ${r.meaning.key}${r.meaning.grounds ? '.' + r.meaning.grounds : ''} · ${r.meaning.stance} · toward ${r.meaning.toward}${r.meaning.implies && r.meaning.implies !== 'none' ? ` · implies ${r.meaning.implies}` : ''} · private intent: ${r.intent}${r.honest ? '' : ' (not honest)'}${r.aim ? ` · aim: ${r.aim}` : ''}`);
  for (const c of r.changes ?? []) lines.push(`change: ${c}`);
  for (const t of extra?.trace ?? []) lines.push(t);
  o.P(''); o.P('<details><summary>trace</summary>'); o.P(''); o.P('```'); for (const l of lines) o.P(l); o.P('```'); o.P('</details>'); o.P('');
}
export function traceLines(o: Out, title: string, lines: string[]) { o.P(''); o.P(`<details><summary>${title}</summary>`); o.P(''); o.P('```'); for (const l of lines) o.P(l); o.P('```'); o.P('</details>'); o.P(''); }
