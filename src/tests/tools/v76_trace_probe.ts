import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY } from '../../types';
import { rel } from '../../core';
import { pathState } from '../../path';
import { promoChoose } from '../../career';
import { openInduction, choose as mchoose, closeMeeting } from '../../meetings';
import { trialChoose } from '../../path';
import { audit } from '../../consistency';
const w = createWorld(3, 'Tony Marino'); const p = w.chars[w.playerId!];
advance(w, w.now + 20 * DAY);
const st = pathState(w);
for (let step = 0; step < 3; step++) {
  const r0 = p.rank;
  for (let d = 0; d < 60 && p.rank === r0; d++) {
    p.lifetimeKick = 1e6; st.deeds = 999; st.kills = 9; p.standing = 90; p.heat = 0;
    for (const c of Object.values(w.chars)) if (c.alive && c.familyId === p.familyId && c.id !== p.id) { rel(c, p.id).trust = 0.9; rel(c, p.id).respect = 0.8; }
    advance(w, (Math.floor(w.now / DAY) + 1) * DAY + 13 * 60);
    for (const e of w.enc.filter((e) => e.status === 'open' && e.kind === 'promo')) {
      const out = e.data?.stage === 'trial' ? trialChoose(w, p, e, e.opts![0].code) : promoChoose(w, p, e, e.opts![0].code); e.status = 'done'; console.log(' enc', e.data?.stage, '->', out[0]?.slice(0, 60));
    }
    const j = w.jobs.find((q) => q.kind === 'summons' && q.meeting === 'induction' && q.status === 'offered');
    if (j) { const m = openInduction(w, p, j); if (typeof m === 'string') { console.log('induct', m); continue; } for (let i = 0; i < 12 && m.items.length && m.idx < m.items.length; i++) mchoose(w, p, m, 'sure'); closeMeeting(w, p, m); console.log(' inducted', p.rank, j.status); }
  }
  console.log('step', step, r0, '->', p.rank, 'day', Math.round(w.now / DAY), 'issues', audit(w).slice(0, 3));
}
