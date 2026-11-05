import {
  attributes,
  edges,
  hindrances,
  ranks,
  skillInfo,
  STARTING_FUNDS,
  type Attribute,
} from '../content/catalog';
import type { Advance, AdvanceChoice, Build, Character } from './model';

export type Issue = { code: string; message: string; waived: boolean };
export const rankIndex = (xp: number) => Math.min(4, Math.floor(Math.max(0, xp) / 20));
export const rankName = (xp: number) => ranks[rankIndex(xp)];
export const earnedAdvances = (xp: number) =>
  xp <= 80 ? Math.floor(xp / 5) : 16 + Math.floor((xp - 80) / 10);
export const totalXp = (c: Character) =>
  (c.legacy?.xp ?? 0) + c.xp.reduce((sum, e) => sum + e.amount, 0);
export const spentAdvances = (c: Character) => (c.legacy?.spent ?? 0) + c.advances.length;
export const availableAdvances = (c: Character) => earnedAdvances(totalXp(c)) - spentAdvances(c);
export function hasEdge(b: Build, id: string) {
  return b.edges.some((e) => e.id === id || (id === 'rich' && e.id === 'noble'));
}
const hasHindrance = (b: Build, id: string) => b.hindrances.some((h) => h.id === id);
const issue = (c: Character, code: string, message: string): Issue => ({
  code,
  message,
  waived: c.rulings.some((r) => r.code === code),
});

export function baseBuild(c: Character): Build {
  const b: Build = JSON.parse(JSON.stringify(c.build));
  if (hasHindrance(b, 'elderly') && !c.legacy) {
    b.attributes.strength = Math.max(4, b.attributes.strength - 2) as 4;
    b.attributes.vigor = Math.max(4, b.attributes.vigor - 2) as 4;
  }
  return b;
}
function replay(b: Build, a: AdvanceChoice) {
  if (a.kind === 'edge') b.edges.push({ id: a.target, target: a.edgeTarget });
  else if (a.kind === 'attribute') b.attributes[a.target as Attribute] += 2;
  else {
    b.skills[a.target] = (b.skills[a.target] ?? 2) + 2;
    if (a.kind === 'twoSkills') b.skills[a.second] = (b.skills[a.second] ?? 2) + 2;
  }
}
export function effectiveBuild(c: Character): Build {
  const b = baseBuild(c);
  c.advances.forEach((a) => replay(b, a));
  return b;
}
export function traitValue(b: Build, key: string) {
  const raw = Object.hasOwn(attributes, key)
    ? b.attributes[key as Attribute]
    : Object.hasOwn(b.skills, key)
      ? b.skills[key]
      : 0;
  return (
    raw +
    (b.edges.some((e) => e.id === 'expert' && e.target === key)
      ? 2
      : b.edges.some((e) => e.id === 'professional' && e.target === key)
        ? 1
        : 0)
  );
}
export function skillCost(value: number, linked: number) {
  let cost = 0;
  for (let die = 4; die <= value; die += 2) cost += die <= linked ? 1 : 2;
  return cost;
}
export function creationBudget(c: Character) {
  const b = baseBuild(c);
  const minor = b.hindrances.filter((h) => h.severity === 1).length;
  const major = b.hindrances.filter((h) => h.severity === 2).length;
  const hindrancePoints = Math.min(2, minor) + Math.min(1, major) * 2;
  const freeEdges = 1 + Number(hasHindrance(b, 'blind'));
  const spentHindrance =
    b.bonus.attributes * 2 +
    b.bonus.skills +
    b.bonus.funds +
    Math.max(0, b.edges.length - freeEdges) * 2;
  const attributeSpent = Object.values(c.build.attributes).reduce((sum, v) => sum + (v - 4) / 2, 0);
  const attributeTotal = (hasHindrance(b, 'young') ? 3 : 5) + b.bonus.attributes;
  const smartsCost = Object.entries(b.skills)
    .filter(([k]) => skillInfo(k)?.attribute === 'smarts')
    .reduce((sum, [k, v]) => sum + skillCost(v, b.attributes.smarts), 0);
  const skillSpent = Object.entries(b.skills).reduce(
    (sum, [k, v]) => sum + skillCost(v, b.attributes[skillInfo(k)!.attribute]),
    0,
  );
  const elderCredit = hasHindrance(b, 'elderly') ? Math.min(5, smartsCost) : 0;
  const skillTotal = (hasHindrance(b, 'young') ? 10 : 15) + b.bonus.skills + elderCredit;
  return {
    hindrancePoints,
    spentHindrance,
    freeEdges,
    attributeSpent,
    attributeTotal,
    skillSpent,
    skillTotal,
    elderCredit,
  };
}
export function startingFunds(c: Character) {
  const b = c.build;
  const multiplier = hasEdge(b, 'filthy-rich') ? 5 : hasEdge(b, 'rich') ? 3 : 1;
  return STARTING_FUNDS * multiplier * (hasHindrance(b, 'poverty') ? 0.5 : 1) * (1 + b.bonus.funds);
}
export const equipmentCost = (c: Character) =>
  c.inventory.reduce((sum, i) => sum + i.price * i.quantity, 0);

export function edgeIssues(
  c: Character,
  b: Build,
  id: string,
  target: string,
  rank: number,
  prefix: string,
  creation = false,
): Issue[] {
  const e = edges.find((e) => e.id === id);
  if (!e) return [issue(c, `${prefix}.unknown:${id}`, 'Nieznana przewaga.')];
  const out: Issue[] = [];
  const add = (suffix: string, message: string) =>
    out.push(issue(c, `${prefix}.${id}.${suffix}`, `${e.name}: ${message}`));
  if (rank < e.rank) add(`rank:${rank}/${e.rank}`, `wymagana ranga ${ranks[e.rank]}.`);
  for (const [key, min] of Object.entries(e.requirements.attributes ?? {}))
    if (traitValue(b, key) < min)
      add(
        `${key}:${traitValue(b, key)}/${min}`,
        `wymagana ${attributes[key as Attribute]} k${min}.`,
      );
  for (const [key, min] of Object.entries(e.requirements.skills ?? {}))
    if (traitValue(b, key) < min)
      add(
        `${key}:${traitValue(b, key)}/${min}`,
        `wymagana umiejętność ${skillInfo(key)?.name ?? key} k${min}.`,
      );
  if (e.requirements.edge && !hasEdge(b, e.requirements.edge))
    add(
      'prerequisite',
      `wymagana przewaga ${edges.find((v) => v.id === e.requirements.edge)?.name}.`,
    );
  if (
    e.requirements.anySkill &&
    !e.requirements.anySkill.some((k) => traitValue(b, k) >= (e.requirements.anyDie ?? 0))
  )
    add(
      'any-skill',
      `wymagana jedna z umiejętności: ${e.requirements.anySkill.map((k) => skillInfo(k)?.name).join(', ')} k${e.requirements.anyDie}.`,
    );
  if (!creation && e.professional)
    add('professional-consent', 'zapisz zgodę MG na nabycie przewagi zawodowej podczas gry.');
  if (e.target === 'trait') {
    const raw = Object.hasOwn(attributes, target)
      ? b.attributes[target as Attribute]
      : Object.hasOwn(b.skills, target)
        ? b.skills[target]
        : undefined;
    if (!raw || raw < 12) add('target', 'wybierz współczynnik na k12.');
    if (
      e.requirements.edge &&
      !b.edges.some((x) => x.id === e.requirements.edge && x.target === target)
    )
      add('target-prerequisite', 'poprzednia przewaga musi dotyczyć tego samego współczynnika.');
  }
  if (e.target === 'knowledge') {
    const targets = target.split('|');
    if (
      targets.length !== 2 ||
      new Set(targets).size !== 2 ||
      targets.some((k) => !k.startsWith('knowledge:') || (b.skills[k] ?? 0) < 8)
    )
      add('target', 'wybierz dwie różne dziedziny Wiedzy na co najmniej k8.');
  }
  if (e.target === 'weapon') {
    if (!c.inventory.some((i) => i.id === target && i.kind === 'weapon'))
      add('target', 'wybierz egzemplarz broni z ekwipunku.');
    if (
      id === 'improved-trademark' &&
      !b.edges.some((x) => x.id === 'trademark' && x.target === target)
    )
      add('target-prerequisite', 'Ulubiona broń musi dotyczyć tego samego egzemplarza.');
  }
  return out;
}
export function validateCreation(c: Character): Issue[] {
  const out: Issue[] = [];
  const add = (code: string, message: string) => out.push(issue(c, code, message));
  const b = baseBuild(c),
    budget = creationBudget(c);
  if (!c.legacy) {
    if (budget.attributeSpent !== budget.attributeTotal)
      add(
        `budget.attributes:${budget.attributeSpent}/${budget.attributeTotal}`,
        `Cechy: wykorzystano ${budget.attributeSpent} z ${budget.attributeTotal} punktów.`,
      );
    if (budget.skillSpent !== budget.skillTotal)
      add(
        `budget.skills:${budget.skillSpent}/${budget.skillTotal}`,
        `Umiejętności: wykorzystano ${budget.skillSpent} z ${budget.skillTotal} punktów.`,
      );
    if (budget.spentHindrance > budget.hindrancePoints)
      add(
        `budget.hindrances:${budget.spentHindrance}/${budget.hindrancePoints}`,
        'Brak punktów z zawad na wybrane korzyści.',
      );
    if (b.edges.length < budget.freeEdges)
      add('budget.free-edge', 'Wybierz darmową przewagę człowieka (oraz Ślepca, jeśli dotyczy).');
    if (equipmentCost(c) > startingFunds(c))
      add(
        `budget.funds:${equipmentCost(c)}/${startingFunds(c)}`,
        'Koszt ekwipunku przekracza początkowe fundusze.',
      );
  }
  if (hasHindrance(b, 'young') && hasHindrance(b, 'elderly'))
    add('hindrances.age', 'Dzieciak i Ramol wzajemnie się wykluczają.');
  if (
    hasHindrance(b, 'elderly') &&
    !c.legacy &&
    (c.build.attributes.strength > 4 || c.build.attributes.vigor > 4)
  )
    add('hindrances.elderly', 'Ramol nie może zwiększać Siły ani Wigoru.');
  b.hindrances.forEach((h) => {
    const def = hindrances.find((x) => x.id === h.id);
    if (!def || !def.severities.includes(h.severity))
      add(`hindrance.invalid:${h.id}`, 'Nieprawidłowa zawada lub jej stopień.');
  });
  if (new Set(b.hindrances.map((h) => h.id)).size !== b.hindrances.length)
    add('hindrances.duplicate', 'Ta sama zawada występuje więcej niż raz.');
  b.edges.forEach((e, index) => {
    const def = edges.find((x) => x.id === e.id);
    const prior = b.edges
      .slice(0, index)
      .filter((x) => x.id === e.id && (def?.target ? x.target === e.target : true)).length;
    if (prior >= (def?.repeat ?? 1))
      add(`edge.duplicate:${e.id}:${e.target}`, 'Powtórzona przewaga przekracza dozwolony limit.');
    out.push(
      ...edgeIssues(c, b, e.id, e.target, c.legacy ? rankIndex(c.legacy.xp) : 0, 'creation', true),
    );
  });
  return out;
}
export function previewAdvance(c: Character, choice: AdvanceChoice) {
  const out: Issue[] = [];
  const add = (code: string, message: string) => out.push(issue(c, `advance.${code}`, message));
  const b = effectiveBuild(c),
    rank = rankIndex(totalXp(c));
  if (availableAdvances(c) <= 0) add('unavailable', 'Brak niewydanych rozwinięć.');
  if (choice.kind === 'edge') {
    const def = edges.find((e) => e.id === choice.target);
    if (!def) add('unknown-edge', 'Nieznana przewaga.');
    else {
      const count = b.edges.filter(
        (e) => e.id === def.id && (!def.target || e.target === choice.edgeTarget),
      ).length;
      if (count >= (def.repeat ?? 1)) add('duplicate-edge', 'Ta przewaga jest już wykupiona.');
      out.push(...edgeIssues(c, b, choice.target, choice.edgeTarget, rank, 'advance'));
    }
  } else if (choice.kind === 'attribute') {
    if (!Object.hasOwn(attributes, choice.target)) add('attribute', 'Nieznana cecha.');
    else {
      if (b.attributes[choice.target as Attribute] >= 12)
        add('attribute-cap', 'Zwykłe rozwinięcie nie zwiększa cechy powyżej k12.');
      if (hasHindrance(b, 'elderly') && ['strength', 'vigor'].includes(choice.target))
        add('elderly', 'Ramol nie może zwiększać Siły ani Wigoru.');
      const prior = c.advances.filter((a) => a.kind === 'attribute' && a.rank === rank);
      if (
        rank < 4 &&
        (prior.length > 0 || (c.legacy?.attributeUsed && rank === rankIndex(c.legacy.xp)))
      )
        add(`attribute-frequency:${rank}`, 'Możesz zwiększyć cechę tylko raz na daną Rangę.');
      if (rank === 4) {
        const last = c.advances.findLastIndex((a) => a.kind === 'attribute' && a.rank === 4);
        const lastIndex =
          last >= 0 ? (c.legacy?.spent ?? 0) + last + 1 : c.legacy?.lastLegendaryAttribute;
        if (
          last < 0 &&
          c.legacy?.attributeUsed &&
          rankIndex(c.legacy.xp) === 4 &&
          lastIndex == null
        )
          add(
            'legacy-legendary-history',
            'Uzupełnij numer ostatniego historycznego zwiększenia cechy albo zapisz ustalenie MG przed kolejnym zwiększeniem.',
          );
        if (lastIndex != null && spentAdvances(c) + 1 - lastIndex < 2)
          add('legendary-frequency', 'Legenda może zwiększać cechy co drugie rozwinięcie.');
      }
    }
  } else {
    const targets = choice.kind === 'twoSkills' ? [choice.target, choice.second] : [choice.target];
    if (new Set(targets).size !== targets.length)
      add('duplicate-skill', 'Wybierz dwie różne umiejętności.');
    for (const key of targets) {
      const info = skillInfo(key),
        value = b.skills[key] ?? 0;
      if (!info) {
        add('skill', 'Nieznana umiejętność lub brak dziedziny Wiedzy.');
        continue;
      }
      if (choice.kind === 'newSkill' && value !== 0)
        add('new-skill', 'Ta umiejętność jest już wykupiona.');
      if (choice.kind !== 'newSkill' && !value)
        add('missing-skill', 'Nową umiejętność wykup osobnym rozwinięciem.');
      if (value >= 12)
        add('skill-cap', 'Zwykłe rozwinięcie nie zwiększa umiejętności powyżej k12.');
      if (choice.kind === 'skill' && value < b.attributes[info.attribute])
        add('single-skill', 'Umiejętność poniżej cechy zwiększ razem z drugą umiejętnością.');
      if (choice.kind === 'twoSkills' && value >= b.attributes[info.attribute])
        add('two-skills', 'Obie umiejętności muszą być niższe od związanych cech.');
    }
  }
  const next: Character = JSON.parse(JSON.stringify(c));
  const advance: Advance = {
    ...choice,
    id: crypto.randomUUID(),
    xp: totalXp(c),
    rank,
    date: new Date().toISOString(),
  };
  if (!out.some((i) => !i.waived)) next.advances.push(advance);
  return { issues: out, next, advance };
}
export function integrityIssues(c: Character): string[] {
  const errors: string[] = [];
  if (totalXp(c) < 0) errors.push('PD nie mogą być ujemne.');
  if (availableAdvances(c) < 0)
    errors.push('Korekta PD pozostawiłaby więcej wydanych rozwinięć niż zdobytych.');
  if (c.legacy && c.legacy.spent > earnedAdvances(c.legacy.xp))
    errors.push('Historycznie wydane rozwinięcia przekraczają PD podstawy.');
  if (c.legacy?.lastLegendaryAttribute != null && c.legacy.lastLegendaryAttribute > c.legacy.spent)
    errors.push('Numer historycznego rozwinięcia jest nieprawidłowy.');
  for (const e of c.build.edges)
    if (!edges.some((x) => x.id === e.id)) errors.push('Nieznana przewaga.');
  for (const h of c.build.hindrances)
    if (!hindrances.some((x) => x.id === h.id && x.severities.includes(h.severity)))
      errors.push('Nieznana zawada lub stopień.');
  for (const a of c.advances) {
    if (a.kind === 'edge' && !edges.some((e) => e.id === a.target))
      errors.push('Nieznana przewaga w rozwinięciu.');
    if (a.kind === 'attribute' && !Object.hasOwn(attributes, a.target))
      errors.push('Nieznana cecha w rozwinięciu.');
    if (['skill', 'twoSkills', 'newSkill'].includes(a.kind) && !skillInfo(a.target))
      errors.push('Nieznana umiejętność w rozwinięciu.');
    if (a.kind === 'twoSkills' && !skillInfo(a.second)) errors.push('Nieznana druga umiejętność.');
  }
  if (!errors.length) {
    const b = effectiveBuild(c);
    for (const e of b.edges) {
      const definition = edges.find((entry) => entry.id === e.id);
      if (definition?.target === 'trait') {
        const raw = Object.hasOwn(attributes, e.target)
          ? b.attributes[e.target as Attribute]
          : Object.hasOwn(b.skills, e.target)
            ? b.skills[e.target]
            : 0;
        if (raw < 12)
          errors.push(
            'Przewagi legendarne współczynnika wymagają istniejącej kości k12. Inne premie zapisz jako korektę MG.',
          );
      }
    }
  }
  return errors;
}
export function derived(c: Character) {
  const b = effectiveBuild(c),
    has = (id: string) => hasEdge(b, id),
    hind = (id: string) => hasHindrance(b, id);
  const weightKnown = c.inventory
    .filter((i) => i.carried && i.weight !== null)
    .reduce((sum, i) => sum + i.weight! * i.quantity, 0);
  const weightUnknown = c.inventory.some((i) => i.carried && i.weight === null);
  const capacity = traitValue(b, 'strength') * (has('brawny') ? 8 : 5);
  const encumbrance = Math.max(0, Math.ceil(weightKnown / capacity) - 1);
  const armor = Math.max(
    0,
    ...c.inventory
      .filter(
        (i) =>
          i.equipped && i.carried && i.kind === 'armor' && ['torso', 'all'].includes(i.coverage),
      )
      .map((i) => i.armor),
  );
  const weaponModifiers = c.inventory
    .filter((i) => i.equipped && i.carried && i.kind === 'weapon')
    .map((i) => i.parry);
  const weaponParry = weaponModifiers.length ? Math.max(...weaponModifiers) : 0;
  const fighting = traitValue(b, 'fighting');
  const parry =
    2 +
    Math.floor(fighting / 2) +
    weaponParry +
    Number(has('block')) +
    Number(has('improved-block')) +
    Number(has('weapon-master')) +
    Number(has('master-at-arms')) +
    (has('acrobat') && encumbrance === 0 && !weightUnknown ? 1 : 0) +
    c.adjustments.parry;
  const toughness =
    2 +
    Math.floor(traitValue(b, 'vigor') / 2) +
    Number(has('brawny')) +
    Number(has('tough')) +
    Number(has('tougher')) +
    Number(hind('obese')) -
    Number(hind('small')) +
    c.adjustments.toughness;
  const pace =
    6 +
    (has('fleet') ? 2 : 0) -
    Number(hind('obese')) -
    Number(hind('elderly')) -
    (hind('lame') ? 2 : 0) -
    (hind('one-leg') ? 2 : 0) +
    c.adjustments.pace;
  const charisma =
    Number(has('charismatic')) * 2 +
    Number(has('attractive')) * 2 +
    Number(has('very-attractive')) * 2 +
    Number(has('noble')) * 2 -
    Number(hind('ugly')) * 2 -
    Number(hind('mean')) * 2 -
    Number(hind('outsider')) * 2 -
    Number(hind('one-eye')) -
    Number(hind('habit')) +
    c.adjustments.charisma;
  const bennies =
    3 +
    (has('great-luck') ? 2 : Number(has('luck'))) +
    Number(hind('young')) -
    Number(hind('bad-luck'));
  const woundPenalty = Math.max(
    0,
    c.conditions.wounds - (has('improved-nerves') ? 2 : Number(has('nerves'))),
  );
  const fatiguePenalty = Math.min(2, c.conditions.fatigue);
  const skillModifiers: Record<string, number> = {};
  if (has('alertness')) skillModifiers.notice = 2;
  if (has('healer')) skillModifiers.healing = 2;
  if (hind('all-thumbs')) skillModifiers.repair = -2;
  if (has('investigator')) {
    skillModifiers.investigation = 2;
    skillModifiers.streetwise = 2;
  }
  if (has('strong-willed')) {
    skillModifiers.taunt = 2;
    skillModifiers.intimidation = 2;
  }
  if (has('ace')) for (const key of ['driving', 'piloting', 'boating']) skillModifiers[key] = 2;
  for (const e of b.edges.filter((e) => e.id === 'scholar'))
    for (const key of e.target.split('|')) skillModifiers[key] = 2;
  return {
    build: b,
    parry,
    toughness,
    armor,
    totalToughness: toughness + armor,
    pace: Math.max(1, pace),
    charisma,
    bennies,
    running: hind('obese') || hind('lame') || hind('one-leg') ? 4 : has('fleet') ? 10 : 6,
    weightKnown,
    weightUnknown,
    capacity,
    encumbrance,
    woundPenalty,
    fatiguePenalty,
    penalty: woundPenalty + fatiguePenalty,
    incapacitated: c.conditions.incapacitated || c.conditions.fatigue === 3,
    skillModifiers,
  };
}
