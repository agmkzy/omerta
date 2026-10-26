// What stands between the player and one man, as the player knows it: money either way, favours, a place that pays, who answers to
// whom, what he is waiting on, and the words on record. The conversation's context box and his page both read it, so the two never
// disagree. Only records the player is a party to are read: nothing here is the man's private business.
import { money, ownerBiz } from '../core';
import { favourWord } from '../encounters';
import { isFemale } from '../life';
import { owedOf } from '../econ';
import { approaches } from '../conv/approach';
import type { Character, World } from '../types';
import { DAY } from '../types';
import { esc } from './links';
import { byWhenWord } from './when';

export interface Tie { text: string; tone: '' | 'good' | 'warn' | 'bad'; kind: 'money' | 'favour' | 'place' | 'rank' | 'waiting' | 'word' }

const fig = (n: number) => `<b class="fig">${esc(money(n))}</b>`;
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

// Favours one way, said once: "a favour (a big one)", or "three favours, the largest a big one".
function favours(sizes: number[]): string {
  if (sizes.length === 1) return `a favour (${favourWord(sizes[0])})`;
  return `${NUM[sizes.length] ?? sizes.length} favours, the largest ${favourWord(Math.max(...sizes))}`;
}

const his = (c: Character) => (isFemale(c) ? 'her' : 'his');
export function between(w: World, p: Character, c: Character): Tie[] {
  const out: Tie[] = [];
  const He = isFemale(c) ? 'She' : 'He', him = isFemale(c) ? 'her' : 'him';
  // who answers to whom, when it is the two of you
  if (c.bossId === p.id) out.push({ kind: 'rank', tone: '', text: `${He} is one of your men.` });
  else if (p.bossId === c.id) out.push({ kind: 'rank', tone: '', text: `You answer to ${him}.` });
  // money, either way
  for (const d of w.debts.filter((x) => x.status === 'active' && ((x.creditor === p.id && x.debtor === c.id) || (x.debtor === p.id && x.creditor === c.id)))) {
    const mine = d.creditor === p.id;
    const late = d.missed ? `, ${NUM[d.missed] ?? d.missed} missed` : '';
    out.push({ kind: 'money', tone: mine ? (d.missed ? 'warn' : 'good') : 'warn', text: mine ? `${He} owes you ${fig(d.balance)}, at ${esc(money(d.weeklyPayment))} a week${late}.` : `You owe ${him} ${fig(d.balance)}, at ${esc(money(d.weeklyPayment))} a week${late}.` });
  }
  // a place of his that pays you, or one of your men
  const b = ownerBiz(w, c.id);
  if (b?.protection) {
    const col = w.chars[b.protection.collectorId];
    const behind = owedOf(b) > 0 ? ` and is ${fig(owedOf(b))} behind` : '';
    if (col?.id === p.id) out.push({ kind: 'place', tone: behind ? 'warn' : 'good', text: `${esc(b.name)} pays you ${esc(money(b.protection.fee))} a week${behind}.` });
    else if (col && col.bossId === p.id) out.push({ kind: 'place', tone: behind ? 'warn' : '', text: `${esc(b.name)} pays your man ${esc(col.name)} ${esc(money(b.protection.fee))} a week${behind}.` });
  }
  // a share the player holds in his trade (econ.stakesOf): what it is, and what it pays out of his till each week
  for (const x of Object.values(w.biz).filter((y) => y.ownerId === c.id && y.open)) for (const st of (x.stakes ?? []).filter((y) => y.holder === p.id))
    out.push({ kind: 'place', tone: 'good', text: `You hold ${Math.round(st.share * 100)}% of ${esc(x.name)}. It pays you about ${esc(money(Math.round(x.income * st.share * 0.8)))} a week out of ${his(c)} till.` });
  // favours (from: the one owed; to: the one who owes)
  const toMe = w.favours.filter((f) => !f.settled && f.from === p.id && f.to === c.id).map((f) => f.size);
  const toHim = w.favours.filter((f) => !f.settled && f.from === c.id && f.to === p.id).map((f) => f.size);
  if (toMe.length) out.push({ kind: 'favour', tone: 'good', text: `${He} owes you ${favours(toMe)}.` });
  if (toHim.length) out.push({ kind: 'favour', tone: 'warn', text: `You owe ${him} ${favours(toHim)}.` });
  // what he is waiting on you for
  for (const e of w.enc.filter((x) => x.status === 'open' && x.from === c.id)) out.push({ kind: 'waiting', tone: 'warn', text: `${He} wants your answer ${esc(byWhenWord(w.now, e.expires))}: ${esc(e.title.replace(/\.$/, ''))}.` });
  if (approaches(w).some((a) => a.who === c.id) && !out.some((t) => t.kind === 'waiting')) out.push({ kind: 'waiting', tone: 'warn', text: `${He} has been looking for you.` });
  // the words on record between you, newest first: what you told him, and what he told you
  const words = [...c.memos.filter((m) => m.other === p.id && !m.done), ...p.memos.filter((m) => m.other === c.id && !m.done)]
    .filter((m) => m.kind !== 'question' && w.now - m.t < 30 * DAY)
    .sort((a, b2) => b2.t - a.t)
    .slice(0, 3);
  for (const m of words) {
    const late = m.kind === 'promise' && m.due ? (m.due <= w.now ? ' It was due.' : ` Due ${esc(byWhenWord(w.now, m.due).replace(/^by /, ''))}.`) : '';
    out.push({ kind: 'word', tone: m.kind === 'threat' ? 'bad' : m.kind === 'promise' && m.due && m.due <= w.now ? 'warn' : '', text: esc(m.text) + late });
  }
  return out;
}

// What the player knows of the man, in a line or two: what he runs, where he stands, whom he answers to.
export function knownOf(w: World, p: Character, c: Character): string {
  const b = ownerBiz(w, c.id);
  const He = isFemale(c) ? 'She' : 'He';
  const bits: string[] = [];
  if (b) bits.push(`Runs ${esc(b.name)}, ${esc(b.district)}.`);
  if (c.rank !== 'civilian' && c.familyId) {
    const boss = c.bossId ? w.chars[c.bossId] : undefined;
    const fam = w.fam[c.familyId]?.name ?? '';
    const role = c.rank === 'boss' ? `Heads the ${esc(fam)} family.` : `${c.rank === 'capo' ? 'A captain' : c.rank === 'underboss' ? 'Underboss' : c.rank === 'soldier' ? 'A soldier' : 'An associate'} in the ${esc(fam)} family${boss && boss.id !== p.id ? `, under ${esc(boss.name)}` : ''}.`;
    bits.push(role);
  }
  if (!bits.length) bits.push(`${He} lives in ${esc(c.district)}.`);
  return bits.join(' ');
}
