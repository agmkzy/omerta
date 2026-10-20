// The social club screen: who is in, who has come over to you, and the conversation in progress.
import { clubOf, clubOpen, clubPresent, sceneNode, topicsFor, waiting } from '../club';
import { fmtTime } from '../core';
import { sundayDue } from './sunday';
import { avatar, back } from './common';
import { esc, lk, P, W } from './links';

export function clubView(): string {
  const w = W(), p = P();
  const cl = clubOf(w, p.familyId);
  if (!cl) return back() + `<p class="muted pad">Your family has no club.</p>`;
  const owner = w.chars[cl.ownerId];
  let out = back() + `<div class="card"><h2>${esc(cl.name)}</h2><p class="muted">${esc(cl.district)} &middot; run by ${owner ? esc(owner.name) : 'nobody now'}. Open ${cl.open[0]}:00 to ${cl.open[1] % 24}:00.</p></div>`;
  if (!clubOpen(w, cl)) return out + `<p class="muted pad">The shutters are down. ${owner ? esc(owner.name.split(' ')[0]) + ' opens' : 'It opens'} at ${cl.open[0]}:00.</p>`;

  const sc = sceneNode(w, p);
  if (sc) {
    out += `<div class="card"><div class="pers" style="margin:0">${avatar(sc.c)}<div><b>${esc(sc.c.name)}</b><div class="sub">${esc(sc.c.rank)} &middot; ${esc(fmtTime(w.now))}</div></div></div></div>`;
    if (sc.log.length) out += `<div class="card scenelog">${sc.log.map((l) => `<p class="muted">${lk(l)}</p>`).join('')}</div>`;
    if (sc.ended) return out + `<div class="list"><button class="opt" data-a="cend:stay"><b>Stay a while</b><span class="because">Back to the room.</span></button><button class="opt" data-a="cend:leave"><b>Leave the club</b></button></div>`;
    out += `<div class="card">${sc.lines.map((l) => `<p class="say">${lk(l)}</p>`).join('')}</div>`;
    return out + `<div class="list">${sc.opts.map((o) => `<button class="opt" data-a="cact:${o.code}"><b>${esc(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>`;
  }

  const here = clubPresent(w, cl);
  if (sundayDue()) out += `<button class="need" data-a="sunday:"><span class="dot blue"></span><span><span class="t">Sunday</span><span class="s" style="display:block">Your men are bringing their envelopes in.</span></span></button>`;
  if (!here.length) return out + `<p class="muted pad">Nobody you know is in right now.</p>`;
  const wait = waiting(w, p, cl, here);
  if (wait.length) {
    out += `<h2 class="sect">Wants a word</h2>` + wait.map(({ c, t }) => `<button class="need" data-a="cscene:${c.id}"><span class="dot amber"></span><span><span class="t">${esc(c.name)}</span><span class="s" style="display:block">${esc(c.rank)} &middot; ${esc(t.cue)}</span></span></button>`).join('');
  }
  const others = here.filter((h) => !wait.some((x) => x.c.id === h.c.id));
  if (others.length) out += `<h2 class="sect">In the room<small>${here.length}</small></h2>` + others.map((h) => `<button class="need" data-a="cscene:${h.c.id}"><span class="dot"></span><span><span class="t">${esc(h.c.name)}</span><span class="s" style="display:block">${esc(h.c.rank)} &middot; ${esc(h.doing)}</span></span></button>`).join('');
  void topicsFor;
  return out;
}
