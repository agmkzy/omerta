// V89: the registry of ask kinds (asks.ts), kept in a module with no imports of its own, so that whichever file the program is
// entered from, the registry exists before any file registers a kind in it (matters.ts adds 'permit'; asks.ts adds the rest).
import type { AskKind } from './asks';
export const ASKS: Record<string, AskKind> = {};
