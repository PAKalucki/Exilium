import { archetypes } from '../content/archetypes';
import type { Character } from './model';

export function applyArchetype(character: Character, id: string): Character {
  if (character.legacy || character.xp.length || character.advances.length)
    throw Error(
      'Archetypy są dostępne tylko dla nowej postaci bez podstawy rozwoju i zapisanych PD.',
    );
  const archetype = archetypes.find((entry) => entry.id === id);
  if (!archetype) throw Error('Nie znaleziono archetypu.');
  return { ...character, build: structuredClone(archetype.build) };
}
