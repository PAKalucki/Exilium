import { describe, it, expect } from 'vitest';
import {
  creationBudget,
  validateCreation,
  startingFunds,
  derived,
  skillCost,
  earnedAdvances,
  rankName,
  previewAdvance,
  availableAdvances,
  integrityIssues,
  effectiveBuild,
  traitValue,
} from '../src/lib/rules/engine';
import { newItem, type AdvanceChoice } from '../src/lib/rules/model';
import { sample } from './fixtures';
const choice = (
  kind: AdvanceChoice['kind'],
  target: string,
  second = '',
  edgeTarget = '',
): AdvanceChoice => ({ kind, target, second, edgeTarget, note: '' });
const award = (c: ReturnType<typeof sample>, amount: number) =>
  c.xp.push({ id: crypto.randomUUID(), amount, note: 'Sesja', date: new Date().toISOString() });
describe('2015 creation and Exilium table rules', () => {
  it('includes a negative weapon Parry modifier for an equipped two-handed weapon', () => {
    const c = sample();
    c.inventory.push({
      ...newItem(),
      kind: 'weapon',
      name: 'Miecz dwuręczny',
      equipped: true,
      parry: -1,
    });
    expect(derived(c).parry).toBe(4);
  });
  it('validates a hand-budgeted human with five attribute and fifteen skill points', () => {
    const c = sample();
    expect(creationBudget(c)).toMatchObject({
      attributeSpent: 5,
      attributeTotal: 5,
      skillSpent: 15,
      skillTotal: 15,
    });
    expect(validateCreation(c)).toEqual([]);
    expect(startingFunds(c)).toBe(400);
    expect(derived(c)).toMatchObject({
      parry: 5,
      toughness: 5,
      armor: 0,
      pace: 6,
      charisma: 0,
      bennies: 3,
      capacity: 30,
      skillModifiers: { notice: 2 },
    });
  });
  it('charges two points per skill step above the linked attribute and none for untrained', () => {
    expect(skillCost(0, 6)).toBe(0);
    expect(skillCost(4, 6)).toBe(1);
    expect(skillCost(8, 6)).toBe(4);
    expect(skillCost(12, 4)).toBe(9);
  });
  it('caps Hindrance credit and does not give extra points for extra Major choices', () => {
    const c = sample();
    c.build.hindrances = [
      { id: 'heroic', severity: 2 },
      { id: 'arrogant', severity: 2 },
      { id: 'loyal', severity: 1 },
      { id: 'quirk', severity: 1 },
      { id: 'mean', severity: 1 },
    ];
    expect(creationBudget(c).hindrancePoints).toBe(4);
    c.build.bonus = { attributes: 2, skills: 1, funds: 0 };
    expect(validateCreation(c).some((i) => i.code.startsWith('budget.hindrances:'))).toBe(true);
  });
  it('uses the 400-dollar table budget, including poverty and starting-fund purchases', () => {
    const c = sample();
    c.build.hindrances = [{ id: 'poverty', severity: 1 }];
    c.build.bonus.funds = 1;
    expect(startingFunds(c)).toBe(400);
    c.build.edges.push({ id: 'rich', target: '' });
    expect(startingFunds(c)).toBe(1200);
    c.build.edges.push({ id: 'filthy-rich', target: '' });
    expect(startingFunds(c)).toBe(2000);
  });
  it('retains 2015 Charyzma and represents armor separately', () => {
    const c = sample();
    c.build.edges.push(
      { id: 'attractive', target: '' },
      { id: 'very-attractive', target: '' },
      { id: 'charismatic', target: '' },
    );
    c.build.hindrances.push({ id: 'ugly', severity: 1 });
    const armor = { ...newItem(), kind: 'armor' as const, equipped: true, armor: 2, weight: 8 };
    c.inventory.push(armor, { ...armor, id: crypto.randomUUID(), armor: 4, coverage: 'head' });
    expect(derived(c)).toMatchObject({ charisma: 4, toughness: 5, armor: 2, totalToughness: 7 });
  });
  it('keeps cybernetic limbs descriptive and does not stack duplicate torso armor', () => {
    const c = sample();
    c.inventory.push({ ...newItem(), kind: 'cybernetic', name: 'Proteza ręki', equipped: true });
    expect(derived(c).toughness).toBe(5);
    c.inventory.push(
      { ...newItem(), kind: 'armor', equipped: true, armor: 2 },
      { ...newItem(), kind: 'armor', equipped: true, armor: 3 },
    );
    expect(derived(c).armor).toBe(3);
  });
  it('requires prerequisites and scopes a recorded ruling to an exact issue', () => {
    const c = sample();
    c.build.edges = [{ id: 'acrobat', target: '' }];
    let issues = validateCreation(c);
    const agility = issues.find((i) => i.code.includes('agility'))!;
    expect(agility).toBeDefined();
    c.rulings.push({
      id: crypto.randomUUID(),
      code: agility.code,
      reason: 'Ustalenie przy stole',
      ruling: 'MG dopuszcza ten wybór',
      date: new Date().toISOString(),
    });
    issues = validateCreation(c);
    expect(issues.find((i) => i.code === agility.code)?.waived).toBe(true);
    c.build.attributes.agility = 4;
    expect(validateCreation(c).find((i) => i.code.includes('agility'))?.waived).toBe(false);
  });
  it('handles child budgets and elder smarts-only skill credit', () => {
    const c = sample();
    c.build.hindrances = [{ id: 'young', severity: 2 }];
    expect(creationBudget(c)).toMatchObject({ attributeTotal: 3, skillTotal: 10 });
    expect(derived(c).bennies).toBe(4);
    c.build.hindrances = [{ id: 'elderly', severity: 2 }];
    expect(creationBudget(c).elderCredit).toBe(5);
    expect(creationBudget(c).skillTotal).toBe(20);
  });
});
describe('in-app leveling', () => {
  it('never treats inherited object names as attribute identifiers', () => {
    const c = sample();
    award(c, 5);
    expect(previewAdvance(c, choice('attribute', '__proto__')).issues.some((i) => !i.waived)).toBe(
      true,
    );
    expect(
      previewAdvance(c, choice('attribute', 'constructor')).issues.some((i) => !i.waived),
    ).toBe(true);
    award(c, 85);
    expect(
      previewAdvance(c, choice('edge', 'professional', '', 'constructor')).issues.some(
        (i) => !i.waived,
      ),
    ).toBe(true);
  });
  it.each([
    [0, 0, 'Nowicjusz'],
    [19, 3, 'Nowicjusz'],
    [20, 4, 'Doświadczony'],
    [79, 15, 'Heros'],
    [80, 16, 'Legenda'],
    [89, 16, 'Legenda'],
    [90, 17, 'Legenda'],
  ])('XP %i earns %i advances and rank %s', (xp, earned, rank) => {
    expect(earnedAdvances(Number(xp))).toBe(earned);
    expect(rankName(Number(xp))).toBe(rank);
  });
  it('spends an advance once and preserves the original creation budget', () => {
    const c = sample();
    award(c, 5);
    const p = previewAdvance(c, choice('attribute', 'agility'));
    expect(p.issues).toEqual([]);
    expect(effectiveBuild(p.next).attributes.agility).toBe(8);
    expect(p.next.build.attributes.agility).toBe(6);
    expect(creationBudget(p.next).skillSpent).toBe(15);
    expect(availableAdvances(p.next)).toBe(0);
  });
  it('validates single, paired and new skill advancement using linked attributes', () => {
    const c = sample();
    award(c, 15);
    expect(previewAdvance(c, choice('skill', 'fighting')).issues).toEqual([]);
    expect(
      previewAdvance(c, choice('twoSkills', 'fighting', 'shooting')).issues.length,
    ).toBeGreaterThan(0);
    c.build.skills.fighting = 4;
    c.build.skills.shooting = 4;
    const p = previewAdvance(c, choice('twoSkills', 'fighting', 'shooting'));
    expect(p.issues).toEqual([]);
    expect(effectiveBuild(p.next).skills).toMatchObject({ fighting: 6, shooting: 6 });
    expect(previewAdvance(c, choice('newSkill', 'knowledge:Elektronika')).issues).toEqual([]);
    expect(previewAdvance(c, choice('newSkill', 'fighting')).issues.some((i) => !i.waived)).toBe(
      true,
    );
  });
  it('uses current rank for banked advances, as explicitly requested', () => {
    const c = sample();
    c.build.skills.fighting = 8;
    award(c, 20);
    expect(previewAdvance(c, choice('edge', 'block')).issues).toEqual([]);
  });
  it('allows only one attribute increase per nonlegendary rank', () => {
    const c = sample();
    award(c, 10);
    const p = previewAdvance(c, choice('attribute', 'agility'));
    expect(p.issues).toEqual([]);
    expect(
      previewAdvance(p.next, choice('attribute', 'strength')).issues.some((i) =>
        i.code.includes('attribute-frequency'),
      ),
    ).toBe(true);
    award(p.next, 10);
    expect(previewAdvance(p.next, choice('attribute', 'strength')).issues).toEqual([]);
  });
  it('applies Legendary cadence and respects the imported historical ledger', () => {
    const c = sample();
    c.legacy = {
      xp: 80,
      spent: 16,
      attributeUsed: true,
      lastLegendaryAttribute: 16,
      reason: 'Stara karta',
    };
    award(c, 20);
    expect(
      previewAdvance(c, choice('attribute', 'strength')).issues.some((i) =>
        i.code.includes('legendary-frequency'),
      ),
    ).toBe(true);
    const p = previewAdvance(c, choice('edge', 'brave'));
    expect(p.issues).toEqual([]);
    expect(previewAdvance(p.next, choice('attribute', 'strength')).issues).toEqual([]);
  });
  it('does not grant imported historical advances twice and rejects XP underflow', () => {
    const c = sample();
    c.legacy = {
      xp: 20,
      spent: 4,
      attributeUsed: true,
      lastLegendaryAttribute: null,
      reason: 'Stara karta',
    };
    expect(availableAdvances(c)).toBe(0);
    award(c, -1);
    expect(integrityIssues(c).length).toBeGreaterThan(0);
  });
  it('requires a GM record for professional Edges acquired during play', () => {
    const c = sample();
    c.build.attributes.agility = 8;
    award(c, 5);
    const p = previewAdvance(c, choice('edge', 'acrobat'));
    expect(p.issues.some((i) => i.code.includes('professional-consent'))).toBe(true);
  });
  it('caps ordinary die increases and targets legendary expertise', () => {
    const c = sample();
    c.build.skills.fighting = 12;
    award(c, 90);
    expect(
      previewAdvance(c, choice('skill', 'fighting')).issues.some((i) =>
        i.code.includes('skill-cap'),
      ),
    ).toBe(true);
    const p = previewAdvance(c, choice('edge', 'professional', '', 'fighting'));
    expect(p.issues).toEqual([]);
    expect(traitValue(effectiveBuild(p.next), 'fighting')).toBe(13);
    expect(
      previewAdvance(p.next, choice('edge', 'expert', '', 'shooting')).issues.some(
        (i) => !i.waived,
      ),
    ).toBe(true);
  });
});
