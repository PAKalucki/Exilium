import { canEditCharacter } from '../access';
import { derived } from '../rules/engine';
import type { CharacterRecord, HiddenSection } from '../rules/model';
import type { User } from './identity';

// Never send the original private fields to a player who cannot see them.
export function characterForViewer(record: CharacterRecord, viewer: User): CharacterRecord {
  if (canEditCharacter(viewer, record.ownerId)) return record;
  const result = structuredClone(record),
    c = result.document;
  result.redacted = (Object.keys(c.privacy) as HiddenSection[]).filter((key) => c.privacy[key]);
  if (c.privacy.background) c.background = '';
  if (c.privacy.origin) c.origin = '';
  if (c.privacy.equipment) {
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
  return result;
}
