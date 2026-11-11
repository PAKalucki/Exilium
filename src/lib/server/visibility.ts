import { canViewPrivateCharacter } from '../access';
import { derived } from '../rules/engine';
import { newCharacter } from '../rules/model';
import type { CharacterRecord, HiddenSection } from '../rules/model';
import type { User } from './identity';
import { DomainError } from './errors';

// Apply privacy before any page, API or export serializes the record.
export function characterForViewer(
  record: CharacterRecord,
  viewer: User,
  revealPrivate = false,
): CharacterRecord {
  if (canViewPrivateCharacter(viewer, record.ownerId, revealPrivate)) return record;
  const result = structuredClone(record),
    c = result.document;
  result.redacted = (Object.keys(c.privacy) as HiddenSection[]).filter((key) => c.privacy[key]);
  if (c.privacy.background) c.background = '';
  if (c.privacy.origin) c.origin = '';
  if (c.privacy.equipment) {
    if (!c.privacy.statistics) {
      const d = derived(record.document);
      result.visibleStats = {
        parry: d.parry,
        totalToughness: d.totalToughness,
        toughness: d.toughness,
        armor: d.armor,
        pace: d.pace,
        running: d.running,
        charisma: d.charisma,
      };
    }
    const ids = new Set(c.inventory.map((i) => i.id));
    c.build.edges.forEach((e) => {
      if (ids.has(e.target)) e.target = 'Ukryty ekwipunek';
    });
    c.advances.forEach((a) => {
      if (ids.has(a.edgeTarget)) a.edgeTarget = 'Ukryty ekwipunek';
    });
    c.inventory = [];
    c.cash = 0;
    c.credits = 0;
  }
  if (c.privacy.statistics) {
    const empty = newCharacter();
    c.build = empty.build;
    c.legacy = null;
    c.conditions = empty.conditions;
    c.xp = [];
    c.advances = [];
    c.rulings = [];
    c.adjustments = empty.adjustments;
    delete result.visibleStats;
  }
  return result;
}

// An administrator must explicitly reveal private sections before editing/copying them.
export function requirePrivateCharacterAccess(
  record: CharacterRecord,
  viewer: User,
  revealPrivate = false,
) {
  if (
    !canViewPrivateCharacter(viewer, record.ownerId, revealPrivate) &&
    Object.values(record.document.privacy).some(Boolean)
  )
    throw new DomainError(403, 'Najpierw odkryj prywatne szczegóły tej postaci.');
}
