// Time as a man says it, for every screen: when something runs out (today, by tomorrow, by Thursday, by 14 March), and the part of
// the day it is. (Day 0 is Monday 2 March 1970.)
import { DAY } from '../types';

const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function byWhenWord(now: number, t: number): string {
  const d = Math.floor(t / DAY) - Math.floor(now / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'by tomorrow';
  if (d < 7) return `by ${WEEKDAY[Math.floor(t / DAY) % 7]}`;
  const dt = new Date(Date.UTC(1970, 2, 2) + t * 60000);
  return `by ${dt.getUTCDate()} ${MONTH[dt.getUTCMonth()]}`;
}
export function dayPart(t: number): string {
  const h = Math.floor((t % DAY) / 60);
  return h < 5 ? 'late at night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
}
