import { attributes, edges, hindrances, skills, skillInfo } from '../content/catalog';
import { derived, rankName, totalXp, availableAdvances, traitValue } from './engine';
import {
  hasAmmunitionCounters,
  type Character,
  type VisibleStats,
  type HiddenSection,
} from './model';
export function exportView(
  c: Character,
  visibleStats?: VisibleStats,
  redacted: HiddenSection[] = [],
) {
  const d = { ...derived(c), ...visibleStats };
  const statisticsHidden = redacted.includes('statistics');
  const equipmentHidden = redacted.includes('equipment') || !!visibleStats;
  const view = {
    statisticsHidden,
    name: c.name,
    appearance: c.appearance,
    portraitId: c.portraitId,
    description: [
      c.profession,
      c.privacy.origin && !c.origin ? 'Pochodzenie ukryte' : c.origin,
      c.caste,
      c.age ? `Wiek: ${c.age}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    ruleset: c.ruleset,
    advancement: `${rankName(totalXp(c))} · ${totalXp(c)} PD · ${availableAdvances(c)} niewydanych rozwinięć`,
    rank: rankName(totalXp(c)),
    experience: totalXp(c),
    unspentAdvances: availableAdvances(c),
    traitGroups: Object.entries(attributes).map(([key, label]) => ({
      label,
      die: traitValue(d.build, key),
      value: formatDie(traitValue(d.build, key)),
      skills: [
        ...skills.filter((s) => s.attribute === key),
        ...Object.keys(d.build.skills)
          .filter((id) => id.startsWith('knowledge:') && skillInfo(id)?.attribute === key)
          .map((id) => skillInfo(id)!),
      ]
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        .map((s) => ({
          label: s.name,
          die: traitValue(d.build, s.id),
          value: d.build.skills[s.id] ? formatDie(traitValue(d.build, s.id)) : 'k4−2',
          modifier: d.skillModifiers[s.id] ?? 0,
        })),
    })),
    combatStats: [
      { label: 'Tempo', value: String(d.pace), note: `bieganie k${d.running}` },
      { label: 'Obrona', value: String(d.parry), note: '' },
      {
        label: 'Wytrzymałość',
        value: String(d.totalToughness),
        note: `${d.toughness} + ${d.armor} pancerza`,
      },
      { label: 'Charyzma', value: String(d.charisma), note: '' },
    ],
    session: { ...c.conditions, incapacitated: d.incapacitated, penalty: d.penalty },
    stats: [
      ['Obrona', String(d.parry)],
      ['Wytrzymałość', `${d.totalToughness} (${d.toughness} + ${d.armor} pancerza)`],
      ['Tempo', `${d.pace} / bieganie k${d.running}`],
      ['Charyzma', String(d.charisma)],
    ],
    attributes: Object.entries(attributes).map(([key, label]) => [
      label,
      formatDie(traitValue(d.build, key)),
    ]),
    skills: Object.keys(d.build.skills)
      .sort((a, b) => (skillInfo(a)?.name || a).localeCompare(skillInfo(b)?.name || b, 'pl'))
      .map((key) => [
        skillInfo(key)?.name ?? key,
        `${formatDie(traitValue(d.build, key))}${d.skillModifiers[key] ? ` (${d.skillModifiers[key] > 0 ? '+' : ''}${d.skillModifiers[key]})` : ''}`,
      ]),
    conditions: `Rany: ${c.conditions.wounds}/3 · Zmęczenie: ${c.conditions.fatigue}/3 · Szok: ${c.conditions.shaken ? 'tak' : 'nie'} · Fuksy: ${c.conditions.bennies}${d.incapacitated ? ' · WYELIMINOWANIE' : ''} · Kara za Rany i Zmęczenie: −${d.penalty}`,
    edges: d.build.edges.map(
      (e) =>
        `${edges.find((v) => v.id === e.id)?.name}${e.target ? ` [${skillInfo(e.target)?.name || attributes[e.target as keyof typeof attributes] || c.inventory.find((i) => i.id === e.target)?.name || e.target}]` : ''}: ${edges.find((v) => v.id === e.id)?.summary}`,
    ),
    hindrances: d.build.hindrances.map(
      (h) =>
        `${hindrances.find((v) => v.id === h.id)?.name} (${h.severity === 1 ? 'drobna' : 'poważna'}): ${hindrances.find((v) => v.id === h.id)?.summary}`,
    ),
    inventory: c.inventory.map((i) => ({
      kind: i.kind,
      damage: i.damage,
      range: i.range,
      ammunition: hasAmmunitionCounters(i) ? `${i.loaded}/${i.capacity} · zapas ${i.reserve}` : '',
      weight: i.weight === null ? '?' : String(i.weight * i.quantity),
      carried: i.carried,
      notes: i.notes,
      name: `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}${i.equipped ? ' [używany]' : ''}`,
      detail: [
        i.damage ? `Obrażenia ${i.damage}` : '',
        i.range ? `Zasięg ${i.range}` : '',
        hasAmmunitionCounters(i)
          ? [
              i.capacity > 0 ? `Amunicja ${i.loaded}/${i.capacity}` : '',
              `Zapas amunicji ${i.reserve}`,
            ]
              .filter(Boolean)
              .join('; ')
          : '',
        i.kind === 'armor' ? `Pancerz ${i.armor}; ${i.coverage}` : '',
        `Waga ${i.weight ?? '?'} jedn. SW / szt.`,
        i.carried ? 'niesiony' : 'przechowywany',
        i.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    funds: equipmentHidden
      ? 'Ekwipunek i zasoby ukryte — zapytaj w grze.'
      : `Gotówka: ${c.cash} $ · Kredyty elektroniczne: ${c.credits}`,
    load: equipmentHidden
      ? ''
      : statisticsHidden
        ? `Waga: ${d.weightKnown}${d.weightUnknown ? ' + nieznana' : ''} jedn. SW.`
        : `Waga: ${d.weightKnown}${d.weightUnknown ? ' + nieznana' : ''} / udźwig ${d.capacity} jedn. SW. Przeciążenie: co najmniej −${d.encumbrance}.`,
    history: c.advances.map(
      (a, i) =>
        `${(c.legacy?.spent ?? 0) + i + 1}. ${a.kind === 'edge' ? edges.find((e) => e.id === a.target)?.name : a.kind === 'attribute' ? attributes[a.target as keyof typeof attributes] : skillInfo(a.target)?.name}${a.kind === 'twoSkills' ? ` + ${skillInfo(a.second)?.name}` : ''} · ${a.xp} PD${a.note ? ` · ${a.note}` : ''}`,
    ),
    xp: c.xp.map(
      (e) => `${e.amount >= 0 ? '+' : ''}${e.amount} PD · ${e.note} · ${e.date.slice(0, 10)}`,
    ),
    background:
      c.privacy.background && !c.background ? 'Historia ukryta — zapytaj w grze.' : c.background,
    notes: c.notes,
    motivation: c.motivation,
    affiliation: c.affiliation,
    rulings: c.rulings.map(
      (r) => `${r.ruling} — ${r.reason} (${r.date.slice(0, 10)}; zapis gracza)`,
    ),
    adjustments: Object.values(c.adjustments).some((v) => typeof v === 'number' && v !== 0)
      ? `Korekty MG: Obrona ${c.adjustments.parry}; Wytrzymałość ${c.adjustments.toughness}; Tempo ${c.adjustments.pace}; Charyzma ${c.adjustments.charisma}. ${c.adjustments.reason}`
      : '',
    legacy: c.legacy
      ? `Podstawa istniejącej karty: ${c.legacy.xp} PD; ${c.legacy.spent} historycznych rozwinięć. ${c.legacy.reason}`
      : '',
  };
  if (statisticsHidden) {
    view.advancement = '';
    view.rank = '';
    view.experience = 0;
    view.unspentAdvances = 0;
    view.traitGroups = [];
    view.combatStats = [];
    view.stats = [];
    view.attributes = [];
    view.skills = [];
    view.conditions = '';
    view.edges = [];
    view.hindrances = [];
    view.history = [];
    view.xp = [];
    view.rulings = [];
    view.adjustments = '';
    view.legacy = '';
  }
  return view;
}
export function formatDie(value: number) {
  return value > 12 ? `k12+${value - 12}` : `k${value}`;
}
