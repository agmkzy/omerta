// The road to the next rank, and what your rank lets you do.
import { famName, money } from '../core';
import { chairOptions, pathInfo, powerOptions, raisable, RANKS } from '../path';
import { members } from '../career';
import { commOf, lifeOptions, proposals, supportOf, supportWord, ledgerOf } from '../powers2';
import { esc, lk, P, W } from './links';

export function pathCard(): string {
  const w = W(), p = P();
  const i = pathInfo(w, p);
  if (!i) return '';
  const done = i.goals.filter((g) => g.done).length;
  let out = `<div class="card"><h2>The road to ${i.to === 'soldier' ? 'being made' : i.to}<small>${done} of ${i.goals.length} done</small></h2><ul class="rows q lf-road">`;
  // V89: one line per thing asked of you, in words; what it takes shows only while it is still to do.
  for (const g of i.goals) {
    out += `<li class="${g.done ? 'done' : ''}"><span class="lf-tick" aria-hidden="true">${g.done ? '&#10003;' : '&#9675;'}</span><span class="qb"><b>${esc(g.label)}</b><small class="muted">${esc(g.note)}</small>${g.done ? '' : `<small class="lf-tip">${esc(g.tip)}</small>`}</span></li>`;
  }
  out += `</ul>`;
  const co = chairOptions(w, p);
  if (i.to === 'boss' && !co.length) out += `<div class="callout">${i.ready ? 'You are ready to take the chair.' : 'The chair is the last thing. You get there by being needed first.'}</div>`;
  else if (i.ready && i.trial !== 'passed') out += `<div class="callout info">You’ve done everything asked. A job is being put to you: ${i.trial === 'open' ? 'it’s waiting in your messages.' : 'expect word within a day or two.'}</div>`;
  else if (i.ready) out += `<div class="callout info">That’s the lot. The family is making room.</div>`;
  else out += `<div class="callout">When every line above is done there is no waiting for a seat. The family makes room.</div>`;
  if (co.length) out += `<h2 class="sect">Take the chair</h2><div class="list">` + co.map((o) => `<button class="opt ${o.chance ? '' : 'off'}" data-a="chair:${o.code}"><b>${esc(o.label)}</b><span class="because">${esc(o.hint)}</span></button>`).join('') + `</div>`;
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
  let out = `<div class="card"><h2>What being ${p.rank === 'underboss' ? 'underboss' : 'a ' + p.rank} lets you do</h2><p>${esc(word[p.rank])}</p>`;
  const pw = powerOptions(w, p);
  const btn = (o: { code: string; label: string; hint: string; off?: boolean }) => `<button class="opt ${o.off ? 'off' : ''}" data-a="power:${o.code}"><b>${esc(o.label)}</b><span class="because">${esc(o.hint)}</span></button>`;
  const mine = pw.filter((o) => (o as { rank?: string }).rank === p.rank), older = pw.filter((o) => (o as { rank?: string }).rank !== p.rank);
  if (mine.length) out += `<div class="list">` + mine.map(btn).join('') + `</div>`;
  if (older.length) out += `<details><summary class="muted">Earlier powers (${older.length})</summary><div class="list">` + older.map(btn).join('') + `</div></details>`;
  if (p.rank === 'boss') out += `<button class="btn" data-a="manage:">Reshape the family</button> <button class="btn" data-a="comm:">The Commission</button>`;
  const lo = lifeOptions(w, p);
  if (lo.length) out += `<details><summary class="muted">How you live</summary><div class="list">` + lo.map((x) => `<button class="opt ${x.ok ? '' : 'off'}" data-a="buy:${x.code}"><b>${esc(x.label)}${x.owned ? ' ✓' : ''}</b><span class="because">${esc(x.owned ? 'Yours.' : x.hint + ' ' + money(x.cost) + ', ' + money(x.upkeep) + '/wk. ' + x.why)}</span></button>`).join('') + `</div></details>`;
  const led = (w.path?.ledger ?? []).slice(-6).reverse();
  if (led.length) out += `<details><summary class="muted">Who owes you</summary><ul class="rows">${led.map((e) => `<li><span>${esc(e.text)}</span></li>`).join('')}</ul></details>`;
  const r = raisable(w, p);
  if (r.length) {
    out += `<h2 class="sect">Make a man<small>${esc(famName(w, p))}</small></h2><div class="list">` + r.map((x) => `<button class="opt" data-a="raise:${x.c.id}|${x.to}"><b>Make ${esc(x.c.name)} a soldier</b><span class="because">${lk(x.c.name)}: ${money(x.c.lifetimeKick)} passed up so far. He will not forget who did it.</span></button>`).join('') + `</div>`;
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
  let out = `<h1 class="page">The ${esc(fam.name)} family</h1><p class="muted pad">You’re the boss. Make a man, or break one. Men remember both. Demotions especially.</p>`;
  for (const c of all.slice(0, 40)) {
    out += `<div class="card"><div class="row"><b>${lk(c.name)}</b><small class="muted"> ${esc(c.rank)} &middot; ${money(c.lifetimeKick)} passed up${c.bossId && w.chars[c.bossId] ? ' &middot; under ' + esc(w.chars[c.bossId].name.split(' ')[0]) : ''}</small></div><div class="pills">`
      + RANKS.map((r) => `<button class="pill ${c.rank === r ? 'on' : ''}" ${c.rank === r ? 'disabled' : `data-a="setrank:${c.id}|${r}"`}>${r === 'underboss' ? 'Underboss' : r[0].toUpperCase() + r.slice(1)}</button>`).join('') + `</div></div>`;
  }
  return out + manageExtras();
}

export function commView(): string {
  const w = W(), p = P();
  const cm = commOf(w);
  let out = `<h1 class="page">The Commission</h1><p class="muted pad">Five bosses and a table. What passes is what enough of them can live with.</p>`;
  out += `<h2 class="sect">The other bosses</h2>` + Object.values(w.fam).filter((f) => f.id !== p.familyId).map((f) => { const b = w.chars[f.bossId]; return `<div class="card"><b>${esc(b?.name ?? f.name)}</b> <small class="muted">${esc(f.name)}${cm.allies.includes(f.id) ? ' · ally' : ''}</small> <span class="v">${esc(supportWord(supportOf(w, p, f.id)))}</span><div><button class="btn" data-a="court:${f.id}">Court him ($2,000)</button></div></div>`; }).join('');
  out += `<h2 class="sect">Put to the table</h2><div class="list">` + proposals(w, p).map((x) => `<button class="opt" data-a="propose:${x.code}|${x.fam ?? ''}"><b>${esc(x.label)}</b><span class="because">${esc(x.hint)}${x.cost ? ' ' + money(x.cost) + '.' : ''}</span></button>`).join('') + `</div>`;
  return out;
}
export function manageExtras(): string {
  const w = W(), p = P();
  const fam = w.fam[p.familyId!];
  const all = members(w, fam.id).filter((c) => c.id !== p.id && c.rank !== 'associate');
  const nm = (id?: string) => (id && w.chars[id] ? esc(w.chars[id].name) : 'nobody');
  let out = `<div class="card"><h2>Your inner circle</h2><p>Consigliere: <b>${nm(fam.consigliere)}</b> &middot; Heir: <b>${nm(fam.heir)}</b></p><div class="list">`;
  for (const c of all.slice(0, 12)) out += `<div class="row"><b>${lk(c.name)}</b> <button class="btn" data-a="consig:${c.id}">Consigliere</button> <button class="btn" data-a="heir:${c.id}">Heir</button></div>`;
  out += `</div></div>`;
  const caps = all.filter((c) => c.rank === 'capo');
  const men = all.filter((c) => c.rank === 'soldier').slice(0, 8);
  if (caps.length > 1 && men.length) {
    out += `<div class="card"><h2>Move a soldier to another captain</h2>` + men.map((m) => `<div class="row"><b>${lk(m.name)}</b> ` + caps.filter((c) => c.id !== m.bossId).map((c) => `<button class="btn" data-a="setboss:${m.id}|${c.id}">to ${esc(c.name.split(' ')[0])}</button>`).join(' ') + `</div>`).join('') + `</div>`;
  }
  return out;
}
