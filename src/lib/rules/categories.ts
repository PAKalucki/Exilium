import { derived } from './engine';
import { newCharacter, type Character, type CharacterCategory } from './model';

export function changeCharacterCategory(
  character: Character,
  category: CharacterCategory,
): Character {
  if (character.category === category) return character;
  if (character.legacy || character.xp.length || character.advances.length)
    throw Error('Kategorii postaci z zapisaną podstawą rozwoju lub PD nie można zmienić.');
  const next = { ...character, category, conditions: { ...character.conditions } };
  if (category === 'extra') {
    next.privacy = newCharacter('', 'extra').privacy;
    next.conditions.wounds = Math.min(1, next.conditions.wounds);
  }
  next.conditions.bennies = derived(next).bennies;
  return next;
}
