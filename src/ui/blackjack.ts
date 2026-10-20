import { money } from '../core';
import { act, cardName, casinos, deal, rulesFor, total } from '../blackjack';
import { back } from './common';
import { esc, P, W } from './links';

export function bjLobby(): string {
  const w = W(), p = P();
  let out = back() + `<h1 class="page">The tables</h1><p class="muted pad">Every house runs its own game. Cheaper tables take a bigger bite; the single-deck room is the one men lose houses in. You have ${money(p.cash)} on you.</p><div class="list">`;
  for (const b of casinos(w)) {
    const r = rulesFor(w, b);
    out += `<button class="opt" data-a="bjt:${b.id}"><b>${esc(b.name)}</b><span class="because">${esc(r.label)} · ${esc(b.district)} · bets ${money(r.min)} to ${money(r.max)}. ${esc(r.note)}</span></button>`;
  }
  return out + `</div><p class="small-note pad"><a href="#" data-a="cat:gamble">Or just a roll of the dice somewhere</a></p>`;
}

const cards = (h: number[], hide = false) => h.map((c, i) => hide && i === 1 ? '<span class="card-face back">?</span>' : `<span class="card-face ${[1, 2].includes(Math.floor(c / 13) % 4) ? 'red' : ''}">${cardName(c)}</span>`).join('');
export function bjTable(id: string): string {
  const w = W(), p = P();
  const b = w.biz[id];
  if (!b) return back() + '<p class="muted pad">No such place.</p>';
  const r = rulesFor(w, b);
  const g = w.bj && w.bj.biz === id ? w.bj : undefined;
  let out = back() + `<style>.card-face{display:inline-block;min-width:38px;text-align:center;padding:10px 6px;margin:0 6px 6px 0;border:1px solid var(--line,#d8d4c8);border-radius:8px;background:#fff;color:#222;font-weight:700;font-size:1.1rem}.card-face.red{color:#b3402f}.card-face.back{background:#2f5d46;color:#fff}</style>`;
  out += `<h1 class="page">${esc(b.name)}</h1><div class="sub pad">${esc(r.label)} &middot; bets ${money(r.min)} to ${money(r.max)} &middot; ${r.decks} deck${r.decks > 1 ? 's' : ''} &middot; blackjack pays ${r.bj === 1.5 ? '3 to 2' : '6 to 5'} &middot; dealer ${r.h17 ? 'hits' : 'stands on'} soft 17</div>`;
  if (g) {
    const live = !g.done;
    out += `<div class="card"><h2>Dealer${live ? '' : ' ' + total(g.d).n}</h2>${cards(g.d, live)}<h2>You ${total(g.p).n}</h2>${cards(g.p)}<p class="muted">Bet ${money(g.bet)}${g.doubled ? ' (doubled)' : ''}</p></div>`;
    if (live) {
      out += `<div class="row2"><button class="btn" data-a="bjact:hit">Hit</button><button class="btn" data-a="bjact:stand">Stand</button>${g.p.length === 2 && p.cash >= g.bet ? `<button class="btn" data-a="bjact:double">Double down</button>` : ''}</div>`;
      return out;
    }
    out += `<div class="callout ${g.net > 0 ? '' : 'info'}">${g.msg.map(esc).join(' ')} <b>${g.net > 0 ? '+' : g.net < 0 ? '−' : ''}${g.net === 0 ? 'Even' : money(Math.abs(g.net))}</b></div>`;
  }
  out += `<h2 class="sect">Place a bet<small>${money(p.cash)} on you</small></h2><div class="pills">`;
  const bets = [...new Set([r.min, r.min * 2, r.min * 5, r.min * 10, r.max].map((x) => Math.min(r.max, x)))].filter((x) => x >= r.min);
  for (const x of bets) out += `<button class="pill ${p.cash < x ? 'off' : ''}" ${p.cash < x ? 'disabled' : `data-a="bjbet:${id}|${x}"`}>${money(x)}</button>`;
  return out + `</div>`;
}
export const bjDeal = (id: string, bet: number) => { const w = W(); return deal(w, P(), w.biz[id], bet); };
export const bjAct = (what: 'hit' | 'stand' | 'double') => act(W(), P(), what);
