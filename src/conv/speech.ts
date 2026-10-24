// Interpretation (spec §4.2): the listener reads what was said through what HE believes. It is handed the spoken part of an
// utterance only (the type has no intent or honesty in it), and his perception: never the speaker's mind, never the world.
import { hash } from '../voice';
import type { Character } from '../types';
import type { Perception } from './perception';
import type { Cue, Spoken, Understood } from './types';

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const jitter = (s: string, span = 0.06) => ((hash(s) % 1000) / 1000 - 0.5) * 2 * span;

export function interpret(p: Perception, spoken: Spoken, speaker: Character): Understood {
  if (spoken.explicit === 2) return { act: spoken.act, confidence: 1, cues: [], literal: true };
  // an indirect remark about his business, from a man he may or may not take for what he is
  if (spoken.act === 'compliment' && p.own.shop) {
    const cues: Cue[] = [];
    if (p.own.arrangement) cues.push({ kind: 'he already pays someone, so he knows how this goes', weight: 0.9, basis: { kind: 'own', ref: 'arrangement' } });
    const prior = p.knownFacts((f) => (f.kind === 'protection_refused' || f.kind === 'protection_started') && f.business === p.own.shop!.id);
    if (prior.length) cues.push({ kind: 'he has been asked before', weight: 0.7, basis: { kind: 'own', ref: prior[0].id } });
    const st = p.streetPressure();
    if (st.n) cues.push({ kind: `trouble on his street (${st.n} thing${st.n > 1 ? 's' : ''} he knows of)`, weight: 0.35 * Math.min(3, st.n), basis: st.basis[0] });
    const who = p.identityOf(speaker);
    if (who.known && who.family) cues.push({ kind: `he believes the man is with the ${who.family} family`, weight: 1.1, basis: who.basis[0] });
    // what he can see for himself: a man in the life usually looks it (an inference, and it can be wrong)
    if (!who.known && speaker.rank !== 'civilian') cues.push({ kind: 'he has the look of a man in the life', weight: 0.4, basis: { kind: 'inferred', ref: 'appearance' } });
    const t = p.temper, f = p.feelingFor(speaker);
    const sus = t.caution * 0.8 - f.trust * 0.6;
    cues.push({ kind: 'his own suspicion', weight: Math.round(sus * 100) / 100, basis: { kind: 'own', ref: 'temperament' } });
    const x = -1.5 + cues.reduce((a, c) => a + c.weight, 0);
    const confidence = Math.max(0, Math.min(1, logistic(x * 2) + jitter(p.self.id + spoken.speaker + spoken.at)));
    const readsDemand = confidence >= 0.5;
    return { act: readsDemand ? 'demand.protection' : 'compliment', confidence: Math.round(confidence * 100) / 100, cues, literal: !readsDemand };
  }
  return { act: spoken.act, confidence: 0.6, cues: [], literal: true };
}
