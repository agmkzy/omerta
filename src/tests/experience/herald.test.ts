// The Herald (Phase 2): the city's paper, the whole city's news whoever made it, a week's repeats as one story, and its footer the
// real news of those same days.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { makePaper, realNews } from '../../news';
import { DAY } from '../../types';
import { P } from '../helpers';
import { worldFor } from './play';

describe('the Herald', { tags: ['scenario'] }, () => {
  ok('its footer is the real news of the week it covers', () => {
    // (day 0 is Monday 2 March 1970: the week to Monday 9 March has the Village townhouse and the eclipse)
    assert.ok(realNews(7 * DAY).some((x) => /West 11th Street/.test(x)));
    assert.ok(realNews(7 * DAY).some((x) => /eclipse/i.test(x)));
    // (the week to 10 May: Kent State, the hard-hat riot, the Knicks)
    assert.ok(realNews(69 * DAY).some((x) => /Knicks/.test(x)));
    assert.equal(realNews(30 * DAY + 3 * DAY).some((x) => /Knicks/.test(x)), false);
  });
  ok('it carries the city’s news, not only the player’s, and the same story twice is one story', () => {
    const w = worldFor(3), p = P(w);
    advance(w, w.now + 70 * DAY);
    const paper = makePaper(w), heads = [paper.lead, ...paper.items.map((i) => i.head)];
    assert.ok(heads.length >= 3, `a thin paper: ${heads.join(' | ')}`);
    assert.equal(new Set(heads).size, heads.length, 'no story printed twice');
    const facts = Object.values(w.facts).filter((f) => f.t >= w.now - 7 * DAY && !f.minor);
    assert.ok(facts.some((f) => f.actor !== p.id && f.victim !== p.id), 'the week had other men’s news');
    assert.ok(paper.filler.length >= 1);
  });
  ok('a family feuding with three others is one story, not three', () => {
    const w = worldFor(3);
    const [a, ...rest] = Object.values(w.fam);
    for (const f of Object.values(w.fam)) f.tension = {};
    for (const b of rest.slice(0, 3)) { a.tension[b.id] = 7; b.tension[a.id] = 7; }
    const paper = makePaper(w), heads = [paper.lead, ...paper.items.map((i) => i.head)];
    assert.equal(heads.filter((h) => /open war between/.test(h)).length, 0, heads.join(' | '));
    assert.equal(heads.filter((h) => new RegExp(`${a.name} crime family is at war on three fronts`).test(h)).length, 1, heads.join(' | '));
  });
});
