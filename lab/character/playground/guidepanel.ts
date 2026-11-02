// How it works: a guide to the whole system for someone new to it, building up one idea at a time. Every number in the
// worked examples is calculated by the same code the lab uses, so the guide stays correct when the rules change.
import { ATTRIBUTES, ATTRIBUTE_INFO, AVERAGE_SCORE, abilityModifier, attributeScores } from '../src/attributes';
import { BACKGROUND_INFO } from '../src/backgrounds';
import { DEFAULT_BANDS, OUTCOMES, OUTCOME_INFO, bonusOf, checkOdds, describeMargins, grade, successChance, type Modifier } from '../src/check';
import { BASE_DEFENCE, EXPERT_MULTIPLE, PROFICIENCY_MAX, PROFICIENCY_MIN, createCharacter, defence, defenceOf, maxHitPoints, rollFor, skillModifiers } from '../src/character';
import { DICE, type Dice } from '../src/dice';
import { describeModifier, describeTotal, percent, signed } from '../src/explain';
import { SIMULATED_FIGHTS } from '../src/assessment';
import { damageModifiers } from '../src/fight';
import { fightRules } from '../src/fight-log';
import { attackHitChance, averageDamage, lowestHit } from '../src/fight-odds';
import { FLEES_WHEN, NERVE_DC } from '../src/nerve';
import { SKILL_INFO, attributesFor, describeSkillBonus } from '../src/skills';
import { SOCIAL_ACTION_INFO, goesAlong, socialOdds } from '../src/social';
import { HIGH, LOW, SITUATION_INFO, TEMPERAMENT_EFFECTS, TRAIT_INFO, temperament } from '../src/temperament';
import { h } from './dom';
import type { Panel } from './views';

// The two characters used in the examples.
const sam = createCharacter({
  name: 'Sam',
  attributes: attributeScores({ str: 14, agi: 9, con: 12, int: 10, wis: 13, cha: 8 }),
  training: { brawling: 'trained', intimidation: 'trained' },
  temperament: temperament({ pride: 0.8 }),
});
const alex = createCharacter({ name: 'Alex', attributes: attributeScores({ agi: 14, wis: 12 }) });

const parts = (mods: readonly Modifier[]) => mods.map(describeModifier).join(', ');
const num = (x: number) => String(Number(x.toFixed(1)));
/** "16 + 1" or "16 − 1". */
const plus = (a: number, b: number) => `${a} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;

const p = (...text: (string | Node)[]) => h('p', {}, ...text);
const example = (title: string, ...body: (HTMLElement | string)[]) =>
  h('div', { class: 'guide-example' }, h('div', { class: 'guide-example-title' }, `Example: ${title}`), ...body.map((b) => (typeof b === 'string' ? p(b) : b)));
const table = (headers: string[], rows: (string | number)[][]) =>
  h('table', { class: 'guide-table' }, h('thead', {}, h('tr', {}, ...headers.map((x) => h('th', {}, x)))),
    h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, String(c)))))));

interface Section {
  readonly id: string;
  readonly title: string;
  readonly body: () => (HTMLElement | null)[];
}

const SECTIONS: readonly Section[] = [
  {
    id: 'big-picture',
    title: 'The big picture',
    body: () => [
      p('Every character, player or not, is described in three layers:'),
      h('ul', {},
        h('li', {}, h('strong', {}, 'Attributes'), ': what they are naturally like (strong, quick, clever…).'),
        h('li', {}, h('strong', {}, 'Skills'), ': what they have learned to do (fighting, driving, lying…).'),
        h('li', {}, h('strong', {}, 'Temperament'), ': their personality (brave, greedy, hot-tempered…). This mostly decides what they choose to do, not how well they do it.')),
      p('When the outcome of something is uncertain, the character rolls a twenty-sided die (a “d20”, giving 1 to 20) and adds a ', h('strong', {}, 'bonus'),
        ' from their attributes and skills. A high total succeeds; a low one fails. That single idea – ', h('strong', {}, 'd20 + bonus against a target number'), ' – runs through everything below.'),
      p('These are the rules of Dungeons & Dragons (5th edition), adapted to people rather than heroes and monsters.'),
    ],
  },
  {
    id: 'attributes',
    title: 'Attributes',
    body: () => [
      p('There are six attributes, each a score from 1 to 20. ', h('strong', {}, `${AVERAGE_SCORE} is an ordinary, average person.`)),
      table(['Attribute', 'What it covers'], ATTRIBUTES.map((a) => [`${ATTRIBUTE_INFO[a].name} (${ATTRIBUTE_INFO[a].short})`, ATTRIBUTE_INFO[a].covers])),
      p('A score is turned into a ', h('strong', {}, 'modifier'), ' – the bonus or penalty it adds to rolls. Average (10 or 11) adds nothing; every 2 points above or below average adds or takes away 1. Halves round down, so a 9 counts as a full −1.'),
      table(['Score', ...[3, 6, 8, 9, 10, 11, 12, 14, 16, 18, 20].map(String)], [['Modifier', ...[3, 6, 8, 9, 10, 11, 12, 14, 16, 18, 20].map((sc) => signed(abilityModifier(sc)))]]),
      example('Sam',
        `Sam has ${ATTRIBUTES.map((a) => `${ATTRIBUTE_INFO[a].name} ${sam.attributes[a]}`).join(', ')}.`,
        `So Sam’s modifiers are ${ATTRIBUTES.map((a) => `${ATTRIBUTE_INFO[a].short} ${signed(abilityModifier(sam.attributes[a]))}`).join(', ')}: fairly strong, a little clumsy, not very charming.`),
    ],
  },
  {
    id: 'skills',
    title: 'Skills',
    body: () => [
      p(`Each skill rests on one attribute – Firearms on Agility, Insight on Wisdom, and so on. A few can use either of two attributes (Intimidation can use Charisma or Strength: a big person can be frightening without being charming); the character uses whichever is better.`),
      p('A skill’s bonus is the attribute’s modifier plus training:'),
      h('ul', {},
        h('li', {}, h('strong', {}, 'Untrained'), ': just the attribute modifier.'),
        h('li', {}, h('strong', {}, 'Trained'), `: plus the proficiency bonus, which reflects experience: +${PROFICIENCY_MIN} for a newcomer up to +${PROFICIENCY_MAX} for a veteran.`),
        h('li', {}, h('strong', {}, 'Expert'), `: plus the proficiency bonus ×${EXPERT_MULTIPLE}.`)),
      example('Sam’s skills',
        `Brawling (Strength, trained): ${parts(skillModifiers(sam, 'brawling'))} = ${signed(bonusOf(skillModifiers(sam, 'brawling')))}.`,
        `Intimidation (trained) could use ${attributesFor('intimidation').map((a) => `${ATTRIBUTE_INFO[a].name} ${sam.attributes[a]} (${signed(abilityModifier(sam.attributes[a]))})`).join(' or ')}, so it uses the better: ${parts(skillModifiers(sam, 'intimidation'))} = ${signed(bonusOf(skillModifiers(sam, 'intimidation')))}.`,
        `Notice (Wisdom, untrained): ${parts(skillModifiers(sam, 'notice'))} = ${signed(bonusOf(skillModifiers(sam, 'notice')))}.`),
      p(`There are ${Object.keys(SKILL_INFO).length} skills in all; the Characters tab lists them with what each covers.`),
    ],
  },
  {
    id: 'checks',
    title: 'Making a check',
    body: () => {
      const notice = { ...rollFor(sam, 'notice'), dc: 15 };
      const odds = checkOdds(notice);
      const bonus = bonusOf(notice.modifiers);
      const b = DEFAULT_BANDS;
      return [
        p('A ', h('strong', {}, 'check'), ' is a d20 roll plus a skill’s bonus, against a ', h('strong', {}, 'difficulty class (DC)'),
          ': the total needed. As a rough guide, 10 is easy, 15 is moderate, 20 is hard and 25 is very hard.'),
        p('The result is not just pass or fail. How far the total beats or misses the DC (the ', h('strong', {}, 'margin'), ') decides one of five outcomes:'),
        table(['Margin (total − DC)', 'Outcome', 'Meaning'], [...OUTCOMES].reverse().map((o) => [describeMargins(o, b), OUTCOME_INFO[o].name, `${OUTCOME_INFO[o].effect.charAt(0).toUpperCase()}${OUTCOME_INFO[o].effect.slice(1)}.`])),
        example('Sam watches for a pickpocket',
          `Spotting a skilled pickpocket is a Notice check against DC 15. Sam’s Notice bonus is ${signed(bonus)}, so Sam needs to roll ${15 - bonus} or more on the d20 to succeed at all.`,
          `Sam rolls 16: ${plus(16, bonus)} = ${16 + bonus}, a margin of ${signed(16 + bonus - 15)}. That is a ${OUTCOME_INFO[grade(16 + bonus - 15, b)].name.toLowerCase()}: ${OUTCOME_INFO[grade(16 + bonus - 15, b)].effect}.`,
          `Before rolling, the chance of at least a partial success is ${percent(successChance(odds))} (${OUTCOMES.map((o) => `${OUTCOME_INFO[o].name.toLowerCase()} ${percent(odds[o])}`).join(', ')}). The Skill check and Dice and odds tabs show these numbers for any check.`),
      ];
    },
  },
  {
    id: 'opposed',
    title: 'Opposed checks, advantage and disadvantage',
    body: () => {
      const plain = checkOdds({ ...rollFor(sam, 'notice'), dc: 15 });
      const adv = checkOdds({ ...rollFor(sam, 'notice', { edges: ['advantage'] }), dc: 15 });
      const dis = checkOdds({ ...rollFor(sam, 'notice', { edges: ['disadvantage'] }), dc: 15 });
      return [
        p('When two characters work against each other, both roll and compare totals instead of using a fixed DC. This is an ', h('strong', {}, 'opposed check'),
          '. The one acting must ', h('em', {}, 'beat'), ' the other’s total; a tie goes to the one resisting.'),
        p(h('strong', {}, 'Advantage'), ' means rolling the d20 twice and keeping the higher; ', h('strong', {}, 'disadvantage'),
          ' means keeping the lower. Several sources of advantage do not stack, and advantage and disadvantage cancel out.'),
        example('the pickpocket again',
          `Without either, Sam’s chance is ${percent(successChance(plain))}. With advantage (say, a good vantage point) it is ${percent(successChance(adv))}; with disadvantage (a crowded street) it is ${percent(successChance(dis))}.`),
      ];
    },
  },
  {
    id: 'temperament',
    title: 'Temperament',
    body: () => [
      p('Temperament is a set of traits, each from 0 to 1, with 0.5 as average: ',
        Object.values(TRAIT_INFO).map((t) => `${t.name.toLowerCase()} (${t.low} – ${t.high})`).join(', '), '.'),
      p('Mostly temperament decides what a character ', h('em', {}, 'wants'), ` to do. In a few situations it also changes a roll, but only when a trait is clearly high (${HIGH} or more) or low (${LOW} or less):`),
      table(['Situation', 'Trait', 'Effect'], TEMPERAMENT_EFFECTS.map((e) => [SITUATION_INFO[e.situation].name, `${e.when === 'high' ? 'High' : 'Low'} ${TRAIT_INFO[e.trait].name.toLowerCase()}`, signed(e.value)])),
      p(`It also decides how someone reacts when they lose their nerve: someone with ${FLEES_WHEN} runs, a hot-tempered one may lash out when threatened with a weapon, and anyone else gives in.`),
      example('Sam is proud', `Sam’s pride is 0.8, so when someone tries to intimidate Sam, Sam gets ${signed(TEMPERAMENT_EFFECTS.find((e) => e.trait === 'pride')!.value)} to resist.`),
    ],
  },
  {
    id: 'backgrounds',
    title: 'Backgrounds: creating a character',
    body: () => [
      p('Instead of D&D’s classes, a character has a ', h('strong', {}, 'background'), ' – what they do for a living. It gives them training in a few skills, and when a character is rolled it shapes their attributes and temperament.'),
      p('Rolling a character: six scores are rolled the D&D way (four six-sided dice, keeping the best three, so 3 to 18). The background decides which score goes to which attribute, best first. Temperament is rolled around the background’s typical values.'),
      table(['Background', 'Trained in', 'Best attributes'], Object.values(BACKGROUND_INFO).map((b) => [
        b.name,
        [...b.expert.map((s) => `${SKILL_INFO[s].name} (expert)`), ...b.trained.map((s) => SKILL_INFO[s].name)].join(', '),
        b.priorities.slice(0, 2).map((a) => ATTRIBUTE_INFO[a].name).join(', '),
      ])),
      p('A rolled character can be edited freely in the Characters tab.'),
    ],
  },
  {
    id: 'social',
    title: 'Getting someone to do something: intimidate, persuade, deceive',
    body: () => {
      const odds = socialOdds({ actor: sam, target: alex, action: 'intimidate' });
      const armed = socialOdds({ actor: sam, target: alex, action: 'intimidate', armed: true });
      return [
        p('Getting someone to do something without force is a single opposed check:'),
        table(['Action', 'Roll', 'Against'], Object.values(SOCIAL_ACTION_INFO).map((a) => [a.name, SKILL_INFO[a.skill].name, `the target’s ${SKILL_INFO[a.resist].name}`])),
        p('Each outcome means something specific for the action – for intimidation, a partial success means the target ', SOCIAL_ACTION_INFO.intimidate.outcomes.partial,
          '; a critical failure means they ', SOCIAL_ACTION_INFO.intimidate.outcomes['critical-failure'], ' (and a hot-tempered target starts a fight).'),
        p('An ', h('strong', {}, 'armed'), ` intimidation (drawing a weapon) first makes the target pass a nerve check against DC ${NERVE_DC['weapon-drawn']}. If they fail, they comply at once (or run, or fight back, depending on temperament); if they hold, the intimidation is rolled with advantage.`),
        example('Sam leans on Alex',
          `Sam’s Intimidation is ${signed(bonusOf(rollFor(sam, 'intimidation').modifiers))}; Alex resists with Nerve (${parts(rollFor(alex, 'nerve', { situations: ['hold-nerve', 'resist-intimidation'] }).modifiers)}).`,
          `The chance Alex goes along with it is ${percent(goesAlong(odds))}. If Sam draws a weapon, it rises to ${percent(goesAlong(armed))}, mostly because Alex has a ${percent(armed.find((c) => c.ending.kind === 'nerve')?.chance ?? 0)} chance of giving in straight away.`),
      ];
    },
  },
  {
    id: 'fights',
    title: 'Fights',
    body: () => {
      const rules = fightRules(DICE.d20);
      const attackBonus = (c: typeof sam) => bonusOf(rollFor(c, 'brawling').modifiers);
      const samHit = attackHitChance(DICE.d20, attackBonus(sam), defence(alex));
      const alexHit = attackHitChance(DICE.d20, attackBonus(alex), defence(sam));
      const samDamage = averageDamage(bonusOf(damageModifiers(sam)));
      const alexDamage = averageDamage(bonusOf(damageModifiers(alex)));
      return [
        p('A fight follows D&D’s combat rules. Any number of people can be on each side.'),
        h('ul', {},
          h('li', {}, `${rules.hitPoints} Hit points (HP) measure how much punishment someone can take.`),
          h('li', {}, h('strong', {}, 'Defence'), ` is what an attack must reach to hit: ${BASE_DEFENCE} + ${describeSkillBonus('reflexes')}. Quick people are harder to hit.`),
          h('li', {}, rules.initiative),
          h('li', {}, h('strong', {}, 'Attacks'), `: ${rules.attack} ${rules.damage}`),
          h('li', {}, h('strong', {}, 'Critical hits'), `: ${rules.extremes}`),
          h('li', {}, h('strong', {}, 'Ganging up'), `: ${rules.gangingUp} One person cannot fend off several at once. This follows D&D’s optional flanking rule.`),
          h('li', {}, h('strong', {}, 'Nerve'), `: ${rules.nerveHurt} ${rules.nerveAlliesDown} ${rules.nerveFailure}`),
          h('li', {}, h('strong', {}, 'Winning'), `: ${rules.end}`)),
        example('Sam against Alex',
          `Sam has ${maxHitPoints(sam)} HP and Defence ${defence(sam)} (${describeTotal(defenceOf(sam))}). Alex has ${maxHitPoints(alex)} HP and Defence ${defence(alex)} (${describeTotal(defenceOf(alex))}).`,
          `Sam attacks at ${signed(attackBonus(sam))}, so needs ${lowestHit(DICE.d20, attackBonus(sam), defence(alex))} or more to hit Alex: a ${percent(samHit)} chance, for ${num(samDamage)} damage on average.`,
          `Alex attacks at ${signed(attackBonus(alex))} and needs ${lowestHit(DICE.d20, attackBonus(alex), defence(sam))} or more against Sam: ${percent(alexHit)}, for ${num(alexDamage)} damage on average.`,
          `So Sam hits ${samHit > alexHit ? 'more' : samHit < alexHit ? 'less' : 'as'} often${samHit === alexHit ? ' as Alex' : ''} and ${samDamage > alexDamage ? 'harder' : samDamage < alexDamage ? 'less hard' : 'as hard'}. ${alex.attributes.agi > sam.attributes.agi ? `Alex, being quicker (Agility ${alex.attributes.agi} against Sam’s ${sam.attributes.agi}), is more likely to act first.` : ''} Whoever drops to half HP first faces a nerve check, which ends many fights before anyone is knocked out.`),
        p(`The Fight tab can play a fight automatically, step through it one roll at a time (rolling or choosing each result, with the odds of every roll), or simulate ${SIMULATED_FIGHTS.toLocaleString()} fights to see how they tend to go.`),
      ];
    },
  },
  {
    id: 'dice',
    title: 'Dice options',
    body: () => {
      const alt = (dice: Dice) => percent(successChance(checkOdds({ ...rollFor(sam, 'notice', { dice }), dc: 15 })));
      return [
        p('D&D uses one d20, where every result from 1 to 20 is equally likely. That makes outcomes swingy: a novice can beat an expert surprisingly often.'),
        p('The lab can instead roll ', h('strong', {}, '2d10'), ' (two ten-sided dice added) or ', h('strong', {}, '3d6'),
          ' (three six-sided dice added). These cover a similar range, but results near the middle are far more likely than extremes, so skill matters more than luck.'),
        example('the pickpocket on different dice', `Sam’s chance of spotting them is ${alt(DICE.d20)} on a d20, ${alt(DICE['2d10'])} on 2d10 and ${alt(DICE['3d6'])} on 3d6.`,
          'The bell curve works both ways: it makes a hard task rarer to pull off for someone with a small bonus, like Sam here, and an easy task rarer to fail for someone skilled. Either way, luck matters less.'),
        p('The Dice and odds tab compares the dice for any bonus and difficulty.'),
      ];
    },
  },
  {
    id: 'glossary',
    title: 'Glossary',
    body: () => [
      table(['Term', 'Meaning'], [
        ['d20, 3d6, 1d4…', 'Dice: the number of dice, then “d”, then how many sides each has. 3d6 is three six-sided dice added together.'],
        ['Modifier', 'A bonus or penalty added to a roll, e.g. +2 from Strength 14.'],
        ['Proficiency bonus', `Added to rolls with trained skills (×${EXPERT_MULTIPLE} for expert ones). Grows with experience, ${signed(PROFICIENCY_MIN)} to ${signed(PROFICIENCY_MAX)}.`],
        ['DC (difficulty class)', 'The total a check must reach.'],
        ['Margin', 'How far a total beats or misses what it needed. Decides the outcome.'],
        ['Opposed check', 'Both sides roll; the one acting must beat the other’s total.'],
        ['Advantage / disadvantage', 'Roll twice, keep the higher / lower.'],
        ['Natural 20 / natural 1', 'The die itself showing 20 or 1, before bonuses. In attacks, always a hit / always a miss.'],
        ['Hit points (HP)', 'How much damage someone can take before being knocked out.'],
        ['Defence', `What an attack must reach to hit. ${BASE_DEFENCE} + Reflexes.`],
        ['Initiative', 'Who acts first in a fight. d20 + Reflexes.'],
        ['Nerve check', `Whether someone holds their nerve when threatened or hurt. d20 + ${describeSkillBonus('nerve', 'temperament')}.`],
      ]),
    ],
  },
];

export function guidePanel(): Panel {
  const root = h('section', { class: 'panel guide-page', id: 'guide', 'aria-labelledby': 'guide-title' });
  /** The open section; only one is open at a time. Kept while the page is open. */
  let open = SECTIONS[0]!.id;

  const render = () => {
    const panels = SECTIONS.map((section, i) => {
      const next = SECTIONS[i + 1];
      const details = h('details', { class: 'guide-section', id: `guide-${section.id}`, open: section.id === open },
        h('summary', {}, `${i + 1}. ${section.title}`),
        h('div', { class: 'guide-body' },
          ...section.body(),
          next ? h('button', { type: 'button', class: 'guide-next', onclick: () => openSection(next.id) }, `Next: ${next.title} →`) : null));
      details.addEventListener('toggle', () => {
        if (details.open && open !== section.id) openSection(section.id);
      });
      return details;
    });
    /** Opens one section and closes the rest, keeping the opened section's heading in view. */
    const openSection = (id: string) => {
      open = id;
      for (const d of panels) d.open = d.id === `guide-${id}`;
      document.getElementById(`guide-${id}`)?.scrollIntoView({ block: 'nearest' });
    };
    root.replaceChildren(
      h('h2', { id: 'guide-title' }, 'How it works'),
      p('A step-by-step introduction to how characters, checks and fights work in the lab, with examples. No previous knowledge of Dungeons & Dragons is needed. The numbers in the examples are worked out live by the lab’s own rules. Open one section at a time, in order.'),
      ...panels,
    );
  };
  render();
  return { element: root, render };
}
