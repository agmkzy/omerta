# The Family: log

What was built, how it was measured, and what is still open, increment by increment. The brief and the owner's principles are in
`AUDIT.md`; the owner's rule for the rank games (28 October) is that ranks differ by *process*, not by situations with four answers:
a situation is often the beginning of play, NPCs conceal and pursue their own interests, and each rank must have meaningful things
to do between situations.

## Increment 1: foundations (deployed 27 Oct)
Status, position and role kept apart (`standing.ts`); a consigliere in every family; the player's own men are crewmen, not members;
the career record; the induction line with books that open only for a stated organisational reason; captaincy contenders; the boss's
underboss picture; a recognised successor; every appointment recorded with who decided, why and who was passed over. Story › Your career.

## Increment 2: start at any rank (deployed 27 Oct, 23:56 UTC)
A new game at any of the six seats, taking the real seat in the generated family; first morning told from the world as it is. A vacant
consigliere's chair is filled by the boss weekly (seated on load only for older saves, so a loaded world and a running one agree).

## Increment 3: orders by the hierarchy (deployed 28 Oct, 00:21 UTC)
`command.ts`, `ui/orderview.ts`. Whom you can send (your own chain), whose word a deed needs (by who the target is), asking for it, the
man sent deciding for himself (refuse with his reason, botch, or do it and report), going around recorded and held. Settle screen and
business page. Measured: at captain and boss starts on seed 5, a beating and a wrecking ordered and carried out, reported on Today;
a captain asking leave to kill a civilian refused by his underboss; ledger audit clean.

## Increment 4: the rank processes (in progress, 28 Oct)
- **Hearings** (`hearing.ts`): a charge brought, with a hidden truth (a man really holding out; a false charge from a grudge; for the
  boss and consigliere, a captain whose crew's money fell off, and a man the police seem to know too much about). The player hears
  each side, presses the accuser (a liar may slip), puts it to the accused (admits only if true and his nature allows), reads the
  books (true about money only), asks around (men talk if they trust you and aren't his friends; a man who has been paid stays
  quiet), or sends someone to look (his report leans to whom he likes). Meanwhile the accused may lean on witnesses or offer the judge
  an envelope, and the accuser loses patience and may settle it with his hands. Different by seat: a captain rules; an underboss rules
  and can be appealed over his head to the boss; a consigliere investigates, may mediate, and advises (the boss decides; the truth
  surfacing later moves the boss's trust in him); a boss judges captains and may take a crew away.
- **The boss's charge to his underboss** (`charge.ts`): a task from a real problem (the fund low, the crews too loud, a crew's money
  fallen), done only through the captains, each of whom agrees, bargains for something, stalls, or refuses and goes over his head;
  measured at the end from what actually changed (money paid in, arrests and beatings, the crew's envelopes).
- **The family's direction** (`direction.ts`): the boss's word to the captains (make money; keep your heads down; nobody pushes us;
  clean house), read by men's own choices (paybacks weighed, second rackets started, numbers looked at), and ignored by a captain
  it doesn't suit, which is noticed.
- **Conversation** (`conv/acts/family.ts`): an associate asks a made man about the books; a soldier tells his captain he wants a crew;
  a made man puts his crewman's name forward; a superior asks a man how things are at his end (a man holding out shades it) and
  tells him he expects more; going to a second man for backing offends the first.
- **Counsel**: when a crew needs a captain and the player is consigliere, the boss asks him first; his advice weighs as far as the
  boss trusts him.

Measured (scripted 50–70 day runs, seeds 5, 7, 11): captain, underboss, consigliere and boss each received hearings; true and false
charges both occurred; the consigliere's evidence correctly separated a false charge from a true one; an underboss's leaned-on
captain went over his head; the boss's "clean house" was ignored by one captain; audits clean, save round-trips exact.
