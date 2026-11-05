import { describe, expect, it } from 'vitest';
import source from './fixtures/sw2015-options.json';
import { edges, hindrances, origins, castes } from '../src/lib/content/catalog';
import { unavailableRules, ruleSearch } from '../src/lib/content/availability';
import { originDescriptions, casteDescriptions } from '../src/lib/content/setting';
import { validateCreation } from '../src/lib/rules/engine';
import { sample } from './fixtures';

describe('coverage against the independent 2015 book index', () => {
  it('accounts for every Edge and Hindrance, as selectable or explicitly excluded', () => {
    for (const [kind, available, expected] of [
      ['edge', edges, source.edges],
      ['hindrance', hindrances, source.hindrances],
    ] as const) {
      const names = [
        ...available.map((x) => x.name),
        ...unavailableRules.filter((x) => x.kind === kind).map((x) => x.name),
      ].map(ruleSearch);
      expect(new Set(names).size).toBe(names.length);
      expect(names.toSorted()).toEqual(expected.map(ruleSearch).toSorted());
    }
  });
  it('keeps the supernatural inventor excluded and the ordinary inventor available', () => {
    expect(edges.find((e) => e.id === 'mcgyver')).toBeDefined();
    expect(edges.some((e) => e.name === 'Pomysłowy Dobromir')).toBe(false);
    const inventor = unavailableRules.find((e) => e.name === 'Pomysłowy Dobromir');
    expect(inventor?.reason).toContain('Niesamowita nauka');
    expect(inventor?.alternative).toBe('McGyver');
    expect(ruleSearch('Pomysłowy Dobromir')).toBe(ruleSearch('Pomyslowy Dobromir'));
  });
  it('enforces the full-entry Agility k8 requirement for Błyskawiczny refleks', () => {
    const c = sample();
    c.build.edges = [{ id: 'quick', target: '' }];
    c.build.attributes.agility = 6;
    expect(validateCreation(c).some((i) => i.code.includes('.quick.agility'))).toBe(true);
    c.build.attributes.agility = 8;
    expect(validateCreation(c).some((i) => i.code.includes('.quick.agility'))).toBe(false);
  });
  it('has a guide-backed explanation for every offered origin and all five castes', () => {
    for (const origin of origins) expect(originDescriptions[origin]?.length).toBeGreaterThan(40);
    expect(castes).toHaveLength(5);
    for (const caste of castes) expect(casteDescriptions[caste]?.length).toBeGreaterThan(40);
    expect(origins).toContain('New Canaan');
  });
});
