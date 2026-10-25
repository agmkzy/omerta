// The social club screen: who is in, and who has come over to you. Sitting down with a man is the conversation (Stage 5C).
import { clubOf, clubOpen, clubPresent, topicsFor, waiting } from '../club';
import { fmtTime } from '../core';
import { sundayDue } from './sunday';
import { avatar, back } from './common';
import { esc, lk, P, W } from './links';

export function clubView(): string {
  const w = W(), p = P();
  const cl = clubOf(w, p.familyId);
  if (!cl) return back() + `<p class="muted pad">Your family has no club.</p>`;
  const owner = w.chars[cl.ownerId];
  let out = back() + `<div class="ui-card"><h2>${esc(cl.name)}</h2><p class="muted">${esc(cl.district)} &middot; run by ${owner ? esc(owner.name) : 'nobody now'}. Open ${cl.open[0]}:00 to ${cl.open[1] % 24}:00.</p></div>`;
  if (!clubOpen(w, cl)) return out + `<p class="muted pad">The shutters are down. ${owner ? esc(owner.name.split(' ')[0]) + ' opens' : 'It opens'} at ${cl.open[0]}:00.</p>`;

  const here = clubPresent(w, cl);
  if (sundayDue()) out += `<button class="need" data-a="sunday:"><span class="dot blue"></span><span><span class="t">Sunday</span><span class="s" style="display:block">Your men are bringing their envelopes in.</span></span></button>`;
  if (!here.length) return out + `<p class="muted pad">Nobody you know is in right now.</p>`;
  const wait = waiting(w, p, cl, here);
  if (wait.length) {
    out += `<h2 class="ui-h">Wants a word</h2>` + wait.map(({ c, t }) => `<button class="need" data-a="cscene:${c.id}"><span class="dot amber"></span><span><span class="t">${esc(c.name)}</span><span class="s" style="display:block">${esc(c.rank)} &middot; ${esc(t.cue)}</span></span></button>`).join('');
  }
  const others = here.filter((h) => !wait.some((x) => x.c.id === h.c.id));
  if (others.length) out += `<h2 class="ui-h">In the room<small>${here.length}</small></h2>` + others.map((h) => `<button class="need" data-a="cscene:${h.c.id}"><span class="dot"></span><span><span class="t">${esc(h.c.name)}</span><span class="s" style="display:block">${esc(h.c.rank)} &middot; ${esc(h.doing)}</span></span></button>`).join('');
  void topicsFor;
  return out;
}
