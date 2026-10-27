// What the player has a hand in (the economy, October 2026): each enterprise as itself, with the man who runs it and what last happened
// to it; what he runs for other men; his shares in other men's rackets and businesses; the businesses he owns. One line each, the
// whole story a tap away (opView, bizView). Not a ledger: the week's money is a line above all this (Business, This week).
import { money } from '../core';
import { stakesOf } from '../econ';
import { enterpriseLabel } from '../enterprise';
import { placeWord } from '../establishments';
import { OPS } from '../rackets';
import type { Op, World } from '../types';
import { avatar } from './common';
import { h, rows, type Row } from './kit';
import { esc, lk, P, W } from './links';

const live = (o: Op) => o.state === 'running' || o.state === 'raided';
// how it is going, in a word: this week against its own run
function trend(o: Op): string {
  if (o.state === 'raided') return 'shut by the police for now';
  if ((o.bad ?? 0) >= 2) return 'slipping';
  const avg = o.weeks ? o.total / o.weeks : 0;
  if (o.weeks < 3) return 'new';
  return o.last > avg * 1.25 ? 'a good week' : o.last < avg * 0.6 ? 'a poor week' : 'steady';
}
const plain = (x: string) => lk(x).replace(/<[^>]+>/g, '');
function opRow(w: World, o: Op, how: string): Row {
  const r = o.runner ? w.chars[o.runner] : undefined, base = o.base ? w.biz[o.base] : undefined;
  const open = w.enc.some((e) => e.status === 'open' && e.kind === 'ent' && e.data?.op === o.id);
  const last = o.hist?.at(-1);
  const label = OPS[o.kind as keyof typeof OPS]?.label ?? enterpriseLabel(o);
  return {
    face: r ? avatar(r) : undefined, mark: r ? undefined : open ? 'amber' : 'blue',
    kick: `${label}${base ? ` · ${base.name}` : ` · ${o.district}`}`,
    title: esc(r ? `${r.name} runs it${o.cut ? ` for ${Math.round(o.cut * 100)}%` : ''}` : how),
    sub: esc(`${trend(o)}${last && w.now - last.t < 21 * 1440 ? ` · ${plain(last.text)}` : ''}`),
    end: `<span class="fig">${esc(money(o.last))}</span>`, tone: open ? 'warn' : o.last < 0 ? 'warn' : '', a: `op:${o.id}`,
  };
}

export function holdingsBlock(): string {
  const w = W(), p = P();
  let out = '';
  const own = w.ops.filter((o) => live(o) && o.owner === p.id && o.kind !== 'hijack').sort((a, b) => b.total - a.total);
  if (own.length) out += h('Your rackets', String(own.length)) + rows(own.map((o) => opRow(w, o, 'You run it yourself')));
  const forOthers = w.ops.filter((o) => live(o) && o.runner === p.id && o.owner !== p.id);
  const pieces = w.ops.filter((o) => live(o) && o.owner !== p.id && (o.stakes ?? []).some((s) => s.holder === p.id));
  const bizStakes = stakesOf(w, p.id);
  const mine = Object.values(w.biz).filter((b) => b.open && b.ownerId === p.id);
  const rs: Row[] = [
    ...forOthers.map((o): Row => { const ow = w.chars[o.owner]; return { face: ow ? avatar(ow) : undefined, kick: `You run it · ${OPS[o.kind as keyof typeof OPS]?.label ?? ''}`, title: esc(`${ow?.name ?? 'Somebody'}’s ${enterpriseLabel(o)}`), sub: esc(`${o.district} · ${Math.round((o.cut ?? 0) * 100)}% of the take is yours`), a: `op:${o.id}` }; }),
    ...pieces.map((o): Row => { const ow = w.chars[o.owner], s = o.stakes!.find((x) => x.holder === p.id)!; return { face: ow ? avatar(ow) : undefined, kick: `A share · ${OPS[o.kind as keyof typeof OPS]?.label ?? ''}`, title: esc(`${Math.round(s.share * 100)}% of ${ow?.name ?? 'somebody'}’s ${enterpriseLabel(o)}`), sub: esc(`${o.district} · ${s.how}`), a: `op:${o.id}` }; }),
    ...mine.map((b): Row => { const a = b.acct?.at(-1); return { kick: `Yours · ${b.district}`, title: esc(b.name), sub: esc(`${b.managerId && w.chars[b.managerId] ? `${w.chars[b.managerId].name} manages it` : 'You run it'} · ${placeWord(w, b)}`), end: a ? `<span class="fig">${esc(money(a.net))}</span>` : undefined, tone: a && a.net < 0 ? 'warn' : '', a: `biz:${b.id}` }; }),
    ...bizStakes.map(({ b, s }): Row => ({ kick: `A share · ${b.district}`, title: esc(`${Math.round(s.share * 100)}% of ${b.name}`), sub: esc(s.how), a: `biz:${b.id}` })),
  ];
  if (rs.length) out += h('Your interests', String(rs.length)) + rows(rs);
  // your men's own rackets: theirs to run, and yours to watch over
  const theirs = w.ops.filter((o) => live(o) && o.kind !== 'hijack' && w.chars[o.owner]?.bossId === p.id && w.chars[o.owner]?.alive).sort((a, b) => b.total - a.total);
  if (theirs.length) out += h('Your men’s rackets', String(theirs.length)) + rows(theirs.map((o): Row => { const ow = w.chars[o.owner]; const piece = (o.stakes ?? []).find((s) => s.holder === p.id); return { face: avatar(ow), kick: `${OPS[o.kind as keyof typeof OPS]?.label ?? ''} · ${o.district}`, title: esc(`${ow.name}’s`), sub: esc(`${trend(o)}${piece ? ` · ${Math.round(piece.share * 100)}% of it is yours` : ''}`), end: `<span class="fig">${esc(money(o.last))}</span>`, a: `op:${o.id}` }; }));
  return out;
}
