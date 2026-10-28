// The road to the next rank, and what your rank lets you do.
import { POLICY, policyReport, type Policy } from '../direction';
import { famName, money } from '../core';
import { chairOptions, pathInfo, powerOptions, raisable, RANKS } from '../path';
import { members } from '../career';
import { commOf, lifeOptions, proposals, supportOf, supportWord, ledgerOf } from '../powers2';
import { esc, lk, P, W } from './links';
import { choices, h } from './kit';

export function pathCard(): string {
  const w = W(), p = P();
  const i = pathInfo(w, p);
  if (!i) return '';
  const done = i.goals.filter((g) => g.done).length;
  let out = `<div class="ui-card"><h2>The road to ${i.to === 'soldier' ? 'being made' : i.to}<small>${done} of ${i.goals.length} done</small></h2><ul class="ui-list q lf-road">`;
  // V89: one line per thing asked of you, in words; what it takes shows only while it is still to do.
  for (const g of i.goals) {
    out += `<li class="${g.done ? 'done' : ''}"><span class="lf-tick" aria-hidden="true">${g.done ? '&#10003;' : '&#9675;'}</span><span class="qb"><b>${esc(g.label)}</b><small class="muted">${esc(g.note)}</small>${g.done ? '' : `<small class="lf-tip">${esc(g.tip)}</small>`}</span></li>`;
  }
  out += `</ul>`;
  const co = chairOptions(w, p);
  if (i.to === 'boss' && !co.length) out += `<div class="ui-callout">${i.ready ? 'You are ready to take the chair.' : 'The chair is the last thing. You get there by being needed first.'}</div>`;
  else if (i.ready && i.trial !== 'passed') out += `<div class="ui-callout is-info">You’ve done everything asked. A job is being put to you: ${i.trial === 'open' ? 'it’s waiting in your messages.' : 'expect word within a day or two.'}</div>`;
  else if (i.ready) out += `<div class="ui-callout is-info">That’s the lot. The family is making room.</div>`;
  else out += `<div class="ui-callout">When every line above is done there is no waiting for a seat. The family makes room.</div>`;
  if (co.length) out += h('Take the chair') + choices(co.map((o) => ({ a: `chair:${o.code}`, label: o.label, hint: o.hint, kind: o.chance ? '' : 'more' as const })), 'Take the chair');
  return out + `</div>`;
}

export function powersCard(): string {
  const w = W(), p = P();
  if (!['associate', 'soldier', 'capo', 'underboss', 'boss'].includes(p.rank)) return '';
  const word: Record<string, string> = {
    associate: 'You’re not made, but you’re not nobody. These are the things a man on the way up does for himself.',
    soldier: 'You’re made. Nobody touches you without the family’s say, and you can recruit men of your own.',
    capo: 'You run a crew and put names forward. You answer for everything your men do.',
    underboss: 'Every captain answers to you. You can make soldiers, and the boss listens to you before anyone else.',
    boss: 'Everything comes to you. You can make anyone anything, and nobody can refuse you openly.',
  };
  let out = `<div class="ui-card"><h2>What being ${p.rank === 'underboss' ? 'underboss' : 'a ' + p.rank} lets you do</h2><p>${esc(word[p.rank])}</p>`;
  const pw = powerOptions(w, p);
  // (a power not ready now still answers when chosen, with why: it reads quieter, but it is not shut)
  const pick = (o: { code: string; label: string; hint: string; off?: boolean }) => ({ a: `power:${o.code}`, label: o.label, hint: o.hint, kind: o.off ? 'more' as const : '' as const });
  const mine = pw.filter((o) => (o as { rank?: string }).rank === p.rank), older = pw.filter((o) => (o as { rank?: string }).rank !== p.rank);
  if (mine.length) out += choices(mine.map(pick), 'What you can do');
  if (older.length) out += `<details class="ui-fold"><summary>Earlier powers (${older.length})</summary>${choices(older.map(pick), 'Earlier powers')}</details>`;
  if (p.rank === 'boss') out += `<button class="ui-btn" data-a="manage:">Reshape the family</button> <button class="ui-btn" data-a="comm:">The Commission</button>`;
  const lo = lifeOptions(w, p);
  if (lo.length) out += `<details class="ui-fold"><summary>How you live</summary>${choices(lo.map((x) => ({ a: `buy:${x.code}`, label: `${x.label}${x.owned ? ' ✓' : ''}`, hint: x.owned ? 'Yours.' : `${x.hint} ${money(x.cost)}, ${money(x.upkeep)}/wk. ${x.why}`, kind: x.ok ? '' as const : 'more' as const })), 'How you live')}</details>`;
  const led = (w.path?.ledger ?? []).slice(-6).reverse();
  if (led.length) out += `<details><summary class="muted">Who owes you</summary><ul class="ui-list">${led.map((e) => `<li><span>${esc(e.text)}</span></li>`).join('')}</ul></details>`;
  const r = raisable(w, p);
  if (r.length) {
    out += h('Make a man', famName(w, p)) + choices(r.map((x) => ({ a: `raise:${x.c.id}|${x.to}`, label: `Make ${x.c.name} a soldier`, hint: `${money(x.c.lifetimeKick)} passed up so far. He will not forget who did it.` })), 'Make a man');
  }
  return out + `</div>`;
}

// The boss can make anyone anything.
export function manageView(): string {
  const w = W(), p = P();
  const fam = w.fam[p.familyId!];
  const all = members(w, fam.id).filter((c) => c.id !== p.id);
  const order = ['underboss', 'capo', 'soldier', 'associate'];
  all.sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank) || b.lifetimeKick - a.lifetimeKick);
  let out = `<h1 class="page">The ${esc(fam.name)} family</h1><p class="muted pad">You’re the boss. Make a man, or break one. Men remember both. Demotions especially.</p>` + directionCard();
  for (const c of all.slice(0, 40)) {
    out += `<div class="ui-card"><div class="row"><b>${lk(c.name)}</b><small class="muted"> ${esc(c.rank)} &middot; ${money(c.lifetimeKick)} passed up${c.bossId && w.chars[c.bossId] ? ' &middot; under ' + esc(w.chars[c.bossId].name.split(' ')[0]) : ''}</small></div><div class="ui-pills">`
      + RANKS.map((r) => `<button class="ui-pill ${c.rank === r ? 'on' : ''}" ${c.rank === r ? 'disabled' : `data-a="setrank:${c.id}|${r}"`}>${r === 'underboss' ? 'Underboss' : r[0].toUpperCase() + r.slice(1)}</button>`).join('') + `</div></div>`;
  }
  return out + manageExtras();
}
// The family's direction: the boss's word to the captains on what the family is doing for now (direction.ts)
function directionCard(): string {
  const w = W(), p = P(), f = w.fam[p.familyId!], pol = f.policy && f.policy.until > w.now ? f.policy : undefined;
  const heard = policyReport(w, p);
  return h('The family’s direction', pol ? POLICY[pol.kind as Policy].label : 'none given') + (heard.length ? heard.map((x) => `<p class="cr-note">${esc(x)}</p>`).join('') : '') + choices((Object.keys(POLICY) as Policy[]).map((k) => ({ a: `policy:${k}`, label: POLICY[k].label, hint: POLICY[k].hint, sel: pol?.kind === k })), 'The family’s direction');
}

export function commView(): string {
  const w = W(), p = P();
  const cm = commOf(w);
  let out = `<h1 class="page">The Commission</h1><p class="muted pad">Five bosses and a table. What passes is what enough of them can live with.</p>`;
  out += `<h2 class="ui-h">The other bosses</h2>` + Object.values(w.fam).filter((f) => f.id !== p.familyId).map((f) => { const b = w.chars[f.bossId]; return `<div class="ui-card"><b>${esc(b?.name ?? f.name)}</b> <small class="muted">${esc(f.name)}${cm.allies.includes(f.id) ? ' · ally' : ''}</small> <span class="v">${esc(supportWord(supportOf(w, p, f.id)))}</span><div><button class="ui-btn" data-a="court:${f.id}">Court him ($2,000)</button></div></div>`; }).join('');
  out += h('Put to the table') + choices(proposals(w, p).map((x) => ({ a: `propose:${x.code}|${x.fam ?? ''}`, label: x.label, hint: `${x.hint}${x.cost ? ' ' + money(x.cost) + '.' : ''}` })), 'Put to the table');
  return out;
}
export function manageExtras(): string {
  const w = W(), p = P();
  const fam = w.fam[p.familyId!];
  const all = members(w, fam.id).filter((c) => c.id !== p.id && c.rank !== 'associate');
  const nm = (id?: string) => (id && w.chars[id] ? esc(w.chars[id].name) : 'nobody');
  let out = `<div class="ui-card"><h2>Your inner circle</h2><p>Consigliere: <b>${nm(fam.consigliere)}</b> &middot; Heir: <b>${nm(fam.heir)}</b></p><div class="list">`;
  for (const c of all.slice(0, 12)) out += `<div class="row"><b>${lk(c.name)}</b> <button class="ui-btn" data-a="consig:${c.id}">Consigliere</button> <button class="ui-btn" data-a="heir:${c.id}">Heir</button></div>`;
  out += `</div></div>`;
  const caps = all.filter((c) => c.rank === 'capo');
  const men = all.filter((c) => c.rank === 'soldier').slice(0, 8);
  if (caps.length > 1 && men.length) {
    out += `<div class="ui-card"><h2>Move a soldier to another captain</h2>` + men.map((m) => `<div class="row"><b>${lk(m.name)}</b> ` + caps.filter((c) => c.id !== m.bossId).map((c) => `<button class="ui-btn" data-a="setboss:${m.id}|${c.id}">to ${esc(c.name.split(' ')[0])}</button>`).join(' ') + `</div>`).join('') + `</div>`;
  }
  return out;
}
