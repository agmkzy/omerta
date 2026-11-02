import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { SIMULATED_FIGHTS, assess, assessFight, describeRisk, likelihood, simulateFights, tallyFights, type FightAssessment } from '../src/assessment';
import { rollCharacter } from '../src/backgrounds';
import { roller, seeded } from '../src/random';

const assessment = (over: Partial<FightAssessment> = {}): FightAssessment => ({
  runs: 500, win: 0.5, stalemate: 0, anyKnockedOut: 0.5, anyLostNerve: 0.5, fighters: [{ id: 'A1', name: 'Fighter 1', downed: 0.5 }], ...over,
});

describe('likelihood', { tags: ['unit'] }, () => {
  test('puts a chance into words on a fixed scale', () => {
    assert.deepEqual([0.97, 0.8, 0.6, 0.5, 0.35, 0.12, 0.03].map(likelihood), [
      'almost certain', 'very likely', 'likely', 'about even', 'unlikely', 'very unlikely', 'almost no chance',
    ]);
  });

  test('the boundaries belong to the higher word', () => {
    assert.deepEqual([0.93, 0.75, 0.58, 0.42, 0.25, 0.07].map(likelihood), ['almost certain', 'very likely', 'likely', 'about even', 'unlikely', 'very unlikely']);
  });
});

describe('describeRisk', { tags: ['unit'] }, () => {
  test('says how likely Left is to win', () => {
    const outcome = (win: number) => describeRisk(assessment({ win })).outcome;
    assert.deepEqual([0.97, 0.8, 0.6, 0.5, 0.35, 0.12, 0.03].map(outcome), [
      'Left will almost certainly win.',
      'Left will very likely win.',
      'Left will probably win.',
      'It is about even.',
      'Left will probably lose.',
      'Left will very likely lose.',
      'Left has almost no chance of winning.',
    ]);
  });

  test('when a stalemate is a real possibility, leads with it, then says who would win if someone does', () => {
    const outcome = (win: number, stalemate: number) => describeRisk(assessment({ win, stalemate })).outcome;
    assert.equal(outcome(0.3, 0.45), 'It may well end in a stalemate. If not, it is about even.');
    assert.equal(outcome(0.1, 0.7), 'It will probably end in a stalemate. If not, Left will probably lose.');
    assert.equal(outcome(0.6, 0.3), 'It could end in a stalemate. If not, Left will very likely win.');
  });

  test('a near-certain stalemate is not described as a loss', () => {
    const outcome = describeRisk(assessment({ win: 0.001, stalemate: 0.988 })).outcome;
    assert.equal(outcome, 'It will almost certainly end in a stalemate.');
    assert.doesNotMatch(outcome, /lose|chance of winning/);
  });

  test('a small chance of a stalemate is not mentioned, and does not count as a loss', () => {
    assert.equal(describeRisk(assessment({ win: 0.64, stalemate: 0.2 })).outcome, 'Left will very likely win.');
    // Left loses 56% of the time and wins 20%: of the fights with a winner, Left wins about a quarter.
    assert.equal(describeRisk(assessment({ win: 0.2, stalemate: 0.24 })).outcome, 'Left will probably lose.');
  });

  test('who would win does not change as a stalemate becomes worth mentioning', () => {
    assert.equal(describeRisk(assessment({ win: 0.5, stalemate: 0.249 })).outcome, 'Left will probably win.');
    assert.equal(describeRisk(assessment({ win: 0.5, stalemate: 0.25 })).outcome, 'It could end in a stalemate. If not, Left will probably win.');
  });

  test('says how likely someone on Left is to be knocked out', () => {
    const hurt = (p: number) => describeRisk(assessment({ anyKnockedOut: p })).hurt;
    assert.deepEqual([0.97, 0.8, 0.6, 0.5, 0.35, 0.12, 0.03].map(hurt), [
      'Someone on Left will almost certainly be knocked out.',
      'Someone on Left will very likely be knocked out.',
      'Someone on Left will probably be knocked out.',
      'Someone on Left may well be knocked out.',
      'Probably nobody on Left will be knocked out.',
      'It is very unlikely anyone on Left will be knocked out.',
      'Nobody on Left is at real risk of being knocked out.',
    ]);
  });

  test('says how likely someone on Left is to lose their nerve', () => {
    assert.equal(describeRisk(assessment({ anyLostNerve: 0.8 })).nerve, 'Someone on Left will very likely lose their nerve and run, surrender or back off.');
    assert.equal(describeRisk(assessment({ anyLostNerve: 0.35 })).nerve, 'Probably nobody on Left will lose their nerve.');
    assert.equal(describeRisk(assessment({ anyLostNerve: 0.03 })).nerve, 'Nobody on Left is at real risk of losing their nerve.');
  });

  test('names the Left fighter most at risk when one clearly stands out', () => {
    const fighters = [{ id: 'A1', name: 'Fighter 1', downed: 0.2 }, { id: 'A2', name: 'Accountant 1', downed: 0.7 }];
    assert.equal(describeRisk(assessment({ fighters })).mostAtRisk, 'Accountant 1 is the most at risk: they will probably be knocked out or lose their nerve.');
  });

  test('names nobody when the risk is spread evenly, or when Left is one fighter', () => {
    assert.equal(describeRisk(assessment({ fighters: [{ id: 'A1', name: 'F', downed: 0.5 }, { id: 'A2', name: 'G', downed: 0.45 }] })).mostAtRisk, null);
    assert.equal(describeRisk(assessment()).mostAtRisk, null);
  });
});

describe('describeRisk', { tags: ['property'] }, () => {
  test('says Left will lose only when losing is more likely than winning, and win only when winning is', () => {
    // Any split of the fights into wins, losses and stalemates: win first, then a share of what is left for stalemates.
    const chances = fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }));
    fc.assert(
      fc.property(chances, ([a, b]) => {
        const [win, stalemate] = [a, b * (1 - a)];
        const loss = 1 - win - stalemate;
        const outcome = describeRisk(assessment({ win, stalemate })).outcome;
        if (/lose|chance of winning/.test(outcome)) assert.ok(loss > win, outcome);
        if (/ win\./.test(outcome)) assert.ok(win > loss, outcome);
        assert.equal(/stalemate/.test(outcome), stalemate >= 0.25, outcome);
      }),
    );
  });
});

describe('assessFight', { tags: ['unit'] }, () => {
  const spec = () => {
    const r = roller(seeded(3));
    return { attackers: [rollCharacter('F', 'fighter', r), rollCharacter('G', 'labourer', r)], defenders: [rollCharacter('S', 'shopkeeper', r)] };
  };

  test('estimates the chances from simulated fights, the same every time for the same line-up', () => {
    const a = assessFight(spec(), 300);
    assert.deepEqual(a, assessFight(spec(), 300));
    assert.equal(a.runs, 300);
    for (const p of [a.win, a.stalemate, a.anyKnockedOut, a.anyLostNerve]) assert.ok(p >= 0 && p <= 1);
    assert.deepEqual(a.fighters.map((f) => [f.id, f.name]), [['A1', 'F'], ['A2', 'G']]);
    assert.ok(a.win > 0.5, `two against one should usually win, got ${a.win}`);
  });

  test('counts stalemates', () => {
    assert.ok(assessFight({ ...spec(), maxRounds: 1 }, 100).stalemate > 0);
  });

  test('a lone fighter is down whenever someone on Left is', () => {
    const r = roller(seeded(5));
    const a = assessFight({ attackers: [rollCharacter('F', 'accountant', r)], defenders: [rollCharacter('S', 'fighter', r)] }, 200);
    assert.ok(Math.abs(a.fighters[0]!.downed - (a.anyKnockedOut + a.anyLostNerve)) < 1e-12);
  });
});

describe('tallyFights', { tags: ['unit'] }, () => {
  test('counts each fight once: the winner, how each fighter ended up, and whether each side had someone knocked out or losing their nerve', () => {
    // A frail fighter (5 HP) against a sturdy one: some fights end in a knockout, some in a lost nerve, some in a stalemate.
    const r = roller(seeded(4));
    const spec = { attackers: [rollCharacter('F', 'fighter', r)], defenders: [rollCharacter('S', 'shopkeeper', r)], maxRounds: 3 };
    const t = tallyFights(spec, roller(seeded(2)), 300);
    assert.equal(t.runs, 300);
    assert.equal(t.wins.attacker + t.wins.defender + t.wins.stalemate, 300);
    assert.deepEqual(t.fighters.map((f) => [f.id, f.name, f.side]), [['A1', 'F', 'attacker'], ['B1', 'S', 'defender']]);
    for (const f of t.fighters) assert.equal(Object.values(f.statuses).reduce((a, b) => a + b, 0), 300, f.id);
    // One fighter a side, so a side had someone knocked out exactly when its fighter was, and lost nerve likewise.
    const [left, right] = t.fighters;
    assert.deepEqual([t.anyKnockedOut.attacker, t.anyKnockedOut.defender], [left?.statuses['knocked-out'], right?.statuses['knocked-out']]);
    assert.equal(t.anyLostNerve.defender, (right?.statuses.surrendered ?? 0) + (right?.statuses.fled ?? 0));
    assert.equal(t.anyLostNerve.attacker, (left?.statuses['backed-off'] ?? 0) + (left?.statuses.fled ?? 0));
  });

  test('a stalemate is counted as one', () => {
    const r = roller(seeded(3));
    const spec = { attackers: [rollCharacter('A', 'accountant', r)], defenders: [rollCharacter('B', 'accountant', r)], maxRounds: 1 };
    assert.ok(tallyFights(spec, roller(seeded(3)), 50).wins.stalemate > 0);
  });
});

describe('simulateFights and assess', { tags: ['unit'] }, () => {
  const spec = () => {
    const r = roller(seeded(3));
    return { attackers: [rollCharacter('F', 'fighter', r)], defenders: [rollCharacter('S', 'shopkeeper', r)] };
  };

  test('simulate the same fights every time, so the assessment and the Simulate button agree', () => {
    assert.deepEqual(simulateFights(spec()), simulateFights(spec()));
    assert.equal(simulateFights(spec()).runs, SIMULATED_FIGHTS);
    assert.deepEqual(assessFight(spec()), assess(simulateFights(spec())));
  });

  test('assess reads the chances for the left side from a tally', () => {
    const t = simulateFights(spec(), 200);
    const a = assess(t);
    assert.deepEqual([a.runs, a.win, a.stalemate, a.anyKnockedOut, a.anyLostNerve], [200, t.wins.attacker / 200, t.wins.stalemate / 200, t.anyKnockedOut.attacker / 200, t.anyLostNerve.attacker / 200]);
    assert.deepEqual(a.fighters, [{ id: 'A1', name: 'F', downed: (200 - (t.fighters[0]?.statuses.fighting ?? 0)) / 200 }]);
  });
});
