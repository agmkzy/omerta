// The first morning, at whatever seat the game began (The Family, October 2026): who you are, who is around you, and what is already
// going on, said from the world as it is, so that a captain, an underboss, a consigliere or a boss has something real in front of him
// on the first day, not an empty office.
import { famName, money } from './core';
import { careerRecord, positionOf } from './standing';
import { captaincyContenders, successionPicture, underbossPicture } from './succession';
import type { Character, World } from './types';
import type { StartAt } from './world';

const first = (c: Character) => c.name.split(' ')[0];
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export function openingLines(w: World, p: Character, start: StartAt): string[] {
  const f = w.fam[p.familyId!], fam = famName(w, p);
  const boss = w.chars[f.bossId], sup = p.bossId ? w.chars[p.bossId] : undefined;
  const under = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id);
  const ms = Object.values(w.chars).filter((c) => c.alive && c.familyId === f.id);
  const caps = ms.filter((c) => c.rank === 'capo' && f.consigliere !== c.id);
  const out: string[] = [`New York, March 1970. You’re ${p.name}.`];
  if (start === 'soldier') {
    out.push(`You were made three years ago. You’re a soldier in ${sup ? `${sup.name}’s` : 'a'} crew of the ${fam} family: your own money, your own name, and a captain who takes his share every Sunday.`);
    out.push(under.length ? `${list(under.map((c) => c.name))} ${under.length === 1 ? 'works' : 'work'} with you. Nobody else is going to build your earning for you.` : 'You have nobody working for you yet. A made man can take men on, and put them on the family’s record.');
    const cs = captaincyContenders(w, f.id).filter((x) => x.c.id !== p.id).slice(0, 2);
    if (cs.length) out.push(`When men talk about who could run a crew one day, they mention ${list(cs.map((x) => x.c.name))}.`);
  } else if (start === 'capo') {
    out.push(`You’ve run a crew of the ${fam} family for six years. ${list(under.map((c) => c.name))} answer to you; you answer to ${sup ? sup.name : boss.name}.`);
    const weak = under.filter((c) => c.books.arrears > 0 || c.traits.ambition > 0.75 || (c.rels[p.id]?.grudge ?? 0) > 0.1);
    if (weak.length) out.push(`${first(weak[0])} is the one to watch: ${weak[0].traits.ambition > 0.75 ? 'he wants more than he has' : 'he has been light lately'}.`);
    out.push('What they earn comes through you; what they do is put against your name. Who gets what is yours to say.');
  } else if (start === 'underboss') {
    out.push(`You’re underboss of the ${fam} family. ${list(caps.map((c) => c.name))} answer to you, and you answer to ${boss.name}.`);
    const rec = careerRecord(w, p).find((d) => d.key === 'influence');
    out.push(`The authority is his, lent to you. ${rec && rec.v > 0.4 ? 'Some of the captains are your friends.' : 'Not every captain thinks you should have it.'}`);
    const s = successionPicture(w, f.id);
    if (s.rival && s.rival.id !== p.id) out.push(`${s.rival.name} is a captain who wouldn’t mind your chair, or the one above it.`);
  } else if (start === 'consigliere') {
    out.push(`You’re consigliere to ${boss.name}, boss of the ${fam} family, and have been for five years. You command nobody.`);
    out.push(`Men bring you what they can’t settle by orders, and ${first(boss)} listens to you, most days. What you know, and who trusts you, is all the power you have.`);
    const u = underbossPicture(w, f.id);
    if (u.current) out.push(`${u.current.name} is underboss. ${caps.length ? `${list(caps.map((c) => c.name))} run the crews.` : ''}`);
  } else if (start === 'boss') {
    const u = underbossPicture(w, f.id), con = f.consigliere ? w.chars[f.consigliere] : undefined;
    out.push(`The ${fam} family is yours, and has been for seven years. ${u.current ? `${u.current.name} is your underboss` : 'You have no underboss'}${con ? `, ${con.name} your consigliere` : ''}.`);
    out.push(`${caps.length} ${caps.length === 1 ? 'captain runs a crew' : 'captains run crews'} under you: ${list(caps.map((c) => c.name))}. ${ms.length} men in all, with ${money(f.treasury ?? 0)} in the family’s fund.`);
    const s = successionPicture(w, f.id);
    if (s.rival) out.push(`${s.rival.name} is the captain with the most behind him, and the most ambition.`);
    out.push('Routine runs without you. What reaches you is what only the boss can decide.');
  }
  return out;
}
