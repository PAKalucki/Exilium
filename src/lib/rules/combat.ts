import {
  actionCards,
  cardInfo,
  compareCards,
  jokerBonus,
  type CombatDocument,
  type InitiativeUnit,
  type CombatParticipant,
} from '../combat';
import type { Character } from './model';
import { derived, effectiveBuild } from './engine';

export type CombatCharacters = Map<string, Character>;
export function combatError(message: string): never {
  throw Error(message);
}
export function shuffleCards(cards: string[], random: () => number) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function newCombat(name: string): CombatDocument {
  return {
    schemaVersion: 1,
    name,
    phase: 'setup',
    round: 0,
    gmBennies: 0,
    participants: [],
    units: [],
    currentId: null,
    resumeIds: [],
    afterCurrentId: null,
    simultaneousIds: [],
    deck: [...actionCards],
    discard: [],
    shuffleAfterRound: false,
    actions: 0,
    awaitingTactics: false,
    tacticianId: null,
    reserve: [],
    tacticUsedRound: 0,
  };
}
export function unitAlive(unit: InitiativeUnit, characters: CombatCharacters) {
  return unit.members.some((id) => !derived(characters.get(id)!).incapacitated);
}
export function orderedUnits(c: Pick<CombatDocument, 'units'>) {
  return [...c.units].sort((a, b) =>
    a.card && b.card ? compareCards(a.card, b.card) : Number(!!b.card) - Number(!!a.card),
  );
}
export function beginTurn(c: CombatDocument, unit: InitiativeUnit) {
  c.currentId = unit.id;
  unit.state = 'waiting';
  for (const member of c.participants.filter((p) => unit.members.includes(p.characterId))) {
    member.defending = false;
    member.wildAttack = false;
    member.fullDefense = null;
    member.recoveryRound = 0;
  }
}
export function selectNext(c: CombatDocument, characters: CombatCharacters, checkHeld = false) {
  c.currentId = null;
  for (const unit of c.units)
    if (!unitAlive(unit, characters) && !c.simultaneousIds.includes(unit.id))
      unit.state = 'skipped';
  const simultaneous = c.units.find(
    (u) => c.simultaneousIds.includes(u.id) && u.state === 'waiting',
  );
  if (simultaneous) {
    c.currentId = simultaneous.id;
    c.resumeIds = c.resumeIds.filter((id) => id !== simultaneous.id);
    return;
  }
  const forced = checkHeld
    ? c.units.find(
        (u) =>
          u.state === 'held' &&
          !jokerBonus(u, c.round) &&
          u.members.some(
            (id) =>
              characters.get(id)!.conditions.shaken && !derived(characters.get(id)!).incapacitated,
          ),
      )
    : undefined;
  const scheduled = c.afterCurrentId
    ? c.units.find((u) => u.id === c.afterCurrentId && u.state === 'held')
    : undefined;
  if (forced) {
    if (c.afterCurrentId === forced.id) c.afterCurrentId = null;
    beginTurn(c, forced);
    return;
  }
  if (scheduled) {
    c.afterCurrentId = null;
    beginTurn(c, scheduled);
    return;
  }
  c.afterCurrentId = null;
  while (c.resumeIds.length) {
    const resumeId = c.resumeIds.pop();
    const resume = c.units.find((u) => u.id === resumeId && u.state === 'waiting');
    if (resume) {
      c.currentId = resume.id;
      return;
    }
  }
  const next = orderedUnits(c).find((u) => u.state === 'waiting');
  if (next) beginTurn(c, next);
}
function draw(c: CombatDocument, random: () => number) {
  if (!c.deck.length) {
    c.deck = shuffleCards(c.discard, random);
    c.discard = [];
  }
  const card = c.deck.shift();
  if (!card)
    combatError('Brak wolnych kart. Zmniejsz liczbę grup lub kart odłożonych przez Taktyka.');
  if (cardInfo(card).joker) c.shuffleAfterRound = true;
  return card;
}
export function drawInitiative(c: CombatDocument, character: Character, random: () => number) {
  const edges = effectiveBuild(character).edges.map((e) => e.id);
  const count = edges.includes('improved-level-headed')
    ? 3
    : edges.includes('level-headed')
      ? 2
      : 1;
  const draws = Array.from({ length: count }, () => draw(c, random));
  let best = [...draws].sort(compareCards)[0];
  for (const card of draws) if (card !== best) c.discard.push(card);
  if (edges.includes('quick')) {
    let attempts = 0;
    while (cardInfo(best).rank <= 5) {
      if (++attempts > 54)
        combatError('Brak dostępnej karty powyżej piątki dla Błyskawicznego refleksu.');
      c.discard.push(best);
      best = draw(c, random);
      draws.push(best);
    }
  }
  return { card: best, draws };
}
export function dealRound(c: CombatDocument, characters: CombatCharacters, random: () => number) {
  for (const unit of [...c.units]) {
    if (!unit.returnTo || unit.state === 'held') continue;
    const host = c.units.find((u) => u.id === unit.returnTo);
    if (host) {
      host.members.push(...unit.members);
      if (unit.card) c.discard.push(unit.card);
      c.units = c.units.filter((u) => u.id !== unit.id);
    } else unit.returnTo = null;
  }
  if (!c.units.length || !c.units.some((u) => unitAlive(u, characters)))
    combatError('Dodaj do walki przynajmniej jedną niewyeliminowaną postać.');
  for (const u of c.units) {
    if (u.state !== 'held' || !unitAlive(u, characters)) {
      if (u.card) c.discard.push(u.card);
      u.card = null;
    }
    u.draws = [];
  }
  if (c.shuffleAfterRound || c.round === 0) {
    c.deck = shuffleCards([...c.deck, ...c.discard], random);
    c.discard = [];
  }
  c.shuffleAfterRound = false;
  c.round++;
  c.actions = 0;
  c.currentId = null;
  c.resumeIds = [];
  c.afterCurrentId = null;
  c.simultaneousIds = [];
  for (const u of c.units) {
    if (!unitAlive(u, characters)) {
      u.state = 'skipped';
      continue;
    }
    if (u.state === 'held') continue;
    if (c.round === 1 && u.opening === 'ambush') {
      u.state = 'held';
      continue;
    }
    if (c.round === 1 && u.opening === 'surprised' && u.notice < 4) {
      u.state = 'skipped';
      continue;
    }
    const hand = drawInitiative(c, characters.get(u.leaderId)!, random);
    Object.assign(u, hand, {
      cardRound: c.round,
      state: cardInfo(hand.card).joker ? 'held' : 'waiting',
    });
  }
  c.awaitingTactics =
    !!c.reserve.length &&
    !!c.tacticianId &&
    characters.has(c.tacticianId) &&
    !derived(characters.get(c.tacticianId)!).incapacitated;
  if (!c.awaitingTactics) selectNext(c, characters);
}
export function startCombat(
  c: CombatDocument,
  characters: CombatCharacters,
  random: () => number,
  tacticianId: string | null,
  tacticsResult: number,
) {
  if (c.phase !== 'setup') combatError('To starcie już się rozpoczęło.');
  if (tacticianId) {
    const character = characters.get(tacticianId);
    if (!character || !effectiveBuild(character).edges.some((e) => e.id === 'tactician'))
      combatError('Wybierz uczestnika z przewagą Taktyk.');
    c.tacticianId = tacticianId;
    c.deck = shuffleCards(c.deck, random);
    const count = tacticsResult < 4 ? 0 : 1 + Math.floor((tacticsResult - 4) / 4);
    for (let i = 0; i < count; i++) {
      const card = c.deck.shift();
      if (!card) combatError('Za mało kart dla Taktyka.');
      c.reserve.push(card);
    }
  }
  c.phase = 'active';
  dealRound(c, characters, random);
}
export function damageOutcome(character: Character, damage: number, toughness: number, soaked = 0) {
  const hit = damage >= toughness;
  const raises = hit ? Math.floor((damage - toughness) / 4) : 0;
  const inflicted = !hit ? 0 : raises || Number(character.conditions.shaken);
  if (soaked > inflicted) combatError('Nie można wyparować więcej Ran niż spowodował atak.');
  const wounds = inflicted - soaked;
  const max = character.category === 'extra' ? 1 : 3;
  const total = character.conditions.wounds + wounds;
  return {
    inflicted,
    conditions: {
      ...character.conditions,
      wounds: Math.min(max, total),
      shaken: hit ? (inflicted > 0 && wounds === 0 ? false : true) : character.conditions.shaken,
      incapacitated:
        character.conditions.incapacitated ||
        (character.category === 'extra' ? total >= 1 : total > 3),
    },
  };
}
export function cardZones(c: CombatDocument) {
  return [
    ...c.deck,
    ...c.discard,
    ...c.reserve,
    ...c.units.flatMap((u) => (u.card ? [u.card] : [])),
  ];
}

export function combatParry(
  base: number,
  participant: Pick<CombatParticipant, 'prone' | 'defending' | 'wildAttack' | 'fullDefense'>,
) {
  const normal = participant.prone ? 2 : base;
  return (
    Math.max(normal, participant.fullDefense ?? normal) +
    (participant.defending ? 2 : 0) -
    (participant.wildAttack ? 2 : 0)
  );
}
