// A decision made over the player's head (the coherence repair, phase 5). A senior man may settle a quarrel against him, take his
// money to do it, or set terms on his behalf: that is the family's order, and it stands without asking him. What he is owed is to be
// told, by the man who did it, with the reason; and to be able to take it, ask why, or say he does not like it, each of which that man
// remembers. Nothing here undoes the decision.
import { addEnc } from './encounters';
import { addFact, feel, bear, rel } from './core';
import { noteConduct, temper } from './temper';
import type { Character, Enc, World } from './types';

const first = (c: Character) => c.name.split(' ')[0];

/** He is told what was decided over his head, by whom and why, and the man who did it waits to hear how he takes it. */
export function imposed(w: World, p: Character, by: Character, o: { title: string; said: string; why: string; record: string }) {
  if (!p.isPlayer || !by.alive) return;
  addFact(w, { kind: 'report', actor: by.id, victim: p.id, minor: false, text: o.record, district: p.district }, { witnesses: [p.id] });
  addEnc(w, {
    kind: 'imposed', from: by.id, title: o.title, lines: [o.said], days: 6, data: { why: o.why },
    opts: [
      { code: 'take', label: 'Take it, and say nothing more', hint: 'It was his to decide. He will remember you took it well.' },
      { code: 'why', label: 'Ask him why', hint: 'He will tell you, as far as he thinks you need to know.' },
      { code: 'protest', label: 'Tell him you don’t like it', hint: 'It changes nothing that was decided. He will remember you said it.' },
    ],
  });
}

/** His answer, and what the man who decided makes of it. */
export function answerImposed(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  const by = e.from ? w.chars[e.from] : undefined, lines: string[] = [];
  if (!by) { e.status = 'done'; return { lines: ['There is nobody left to say it to.'], minutes: 5 }; }
  const tp = temper(by), above = isAbove(w, by, p), hot = tp.volatility + tp.pride > 1.15;
  if (code === 'why') {
    lines.push(`${first(by)} looks at you a moment. “${String(e.data?.why ?? 'Because it needed settling.')}”`);
    e.opts = e.opts.filter((x) => x.code !== 'why');
    return { lines, minutes: 10 };
  }
  e.status = 'done';
  if (code === 'take') {
    feel(w, by, p.id, 'respect', 0.03); feel(w, by, p.id, 'trust', 0.02);
    lines.push(hot ? `“Good.” ${first(by)} says nothing else, which from him is something.` : `${first(by)} nods. “You understand how these things go. That’s worth knowing about a man.”`);
    return { lines, minutes: 10 };
  }
  // he said he did not like it: the decision stands; what it costs depends on who the man is to him
  noteConduct(p, 'defied');
  feel(w, by, p.id, 'respect', above ? -0.03 : 0.01);
  if (above && (hot || rel(by, p.id).trust < 0.3)) bear(w, by, p.id, 0.06, `${p.name} complained about how he settled it`);
  lines.push(above
    ? (hot ? `“You don’t like it.” ${first(by)} lets that sit. “I didn’t ask you to like it.”` : `“I hear you. It’s done, and it stays done. Next time, don’t give me a reason to settle it for you.”`)
    : `${first(by)} shrugs. “Take it up with your own people if you want. It was settled.”`);
  return { lines, minutes: 10 };
}

// whether he is above the player in the family's order (his own superiors, or a man of higher rank in his family)
function isAbove(w: World, by: Character, p: Character): boolean {
  const R = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
  let c: Character | undefined = p;
  for (let i = 0; i < 6 && c?.bossId; i++) { if (c.bossId === by.id) return true; c = w.chars[c.bossId]; }
  return by.familyId === p.familyId && R.indexOf(by.rank) > R.indexOf(p.rank);
}
