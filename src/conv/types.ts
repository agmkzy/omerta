// Gate 1 of the conversation rebuild (docs/CONVERSATION_SPEC.md §15): the shapes the proof of concept works with. Spoken and
// private parts of an utterance are separate types, so a listener can only ever be handed what was said (§4.1).
import type { Id } from '../types';

export type BasisKind = 'own' | 'seen' | 'told' | 'claimed' | 'rumour' | 'inferred' | 'setup';
export interface Basis { kind: BasisKind; ref: string }

export type Stance = 'warm' | 'polite' | 'flat' | 'firm' | 'cold' | 'hostile' | 'afraid' | 'indignant' | 'pleading' | 'weary';
export type Toward = 'request' | 'speaker' | 'third' | 'self';
export type Implies = 'warning' | 'threat' | 'offer' | 'appeal' | 'test' | 'none';

// What the speaker is to the event he is speaking of (Gate 2a): it decides how he can speak of it and what he can honestly claim.
// The man it was done to, a man who saw it, a man who only heard, the man who did it, or a man who knows nothing of it.
export type Role = 'victim' | 'witness' | 'hearsay' | 'actor' | 'none';
// What each role lets a man claim as the basis of what he says (anything else is a false claim, honest: false)
export const CLAIMABLE: Record<Role, BasisKind[]> = { victim: ['own'], witness: ['seen'], hearsay: ['rumour', 'told'], actor: ['own'], none: [] };

// What a line is about, as a key the renderer understands, and the facts it needs to say it.
export interface Meaning {
  key: string;                         // e.g. 'refuse.protection', 'ask.intervention'
  stance: Stance;
  toward: Toward;
  implies?: Implies;
  grounds?: string;                    // the reason given, when there is one ('doesNotKnow', 'hasArrangement', ...)
  slots?: Record<string, string>;      // names, sums, places: only what the speaker knows (a line naming an empty slot is never used)
  role?: Role;                         // what he is to the event he speaks of, from his own knowledge (perception.roleIn)
}

export interface Spoken {              // what anyone present can observe
  speaker: Id; listener: Id;
  act: string;                         // what is done on the surface
  explicit: 0 | 1 | 2;
  meaning: Meaning;
  where: string; at: number;
}
export interface Private {             // the speaker's own: never given to a listener
  intent: string;
  honest: boolean;
  aim?: string;
}
export interface Utterance { spoken: Spoken; private: Private }

export interface Cue { kind: string; weight: number; basis: Basis }
export interface Understood { act: string; confidence: number; cues: Cue[]; literal: boolean }

export interface Term { name: string; value: number; basis?: string }
export interface Candidate { move: string; value: number; terms: Term[]; crosses: string[] }
export interface Decision {
  by: Id;
  constraints: { kind: string; source: string }[];
  candidates: Candidate[];
  chosen: string;
  grounds?: { factor: string; said: string; honest: boolean };
  aim?: string;
  predicted?: { by: Id; move: string };
}

export interface TraceEntry {
  who: string;
  line: string;
  spoken: Spoken;
  private: Private;
  heard?: Understood;
  decision?: Decision;
  changes?: string[];
}
