// What has passed within one visit (spec §17.3): which points each man has made, what has been argued and how often, what has
// already been named. A man answers the conversation he is in, not each line as if it were the first.
export class EncounterMemory {
  said = new Set<string>();        // point keys already made, by either side ('named:collector', 'reason:notOurs', ...)
  argued: string[] = [];           // the player's arguments, in order
  pressed = 0;                     // how many times the same request has been pushed after an answer
  patience: number;                // how much more of it he will hear (temperament and regard)
  constructor(patience: number) { this.patience = patience; }
  has(point: string) { return this.said.has(point); }
  note(point: string) { this.said.add(point); }
}
