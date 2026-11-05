import type { Character } from './model';

function keyFor(character: Character, name: string, previous = '') {
  const topic = name.trim();
  if (!topic || topic.length > 70 || topic.includes('|'))
    throw Error('Podaj jedną nazwę dziedziny Wiedzy (1–70 znaków, bez znaku |).');
  const key = `knowledge:${topic}`;
  if (
    Object.keys(character.build.skills).some(
      (existing) =>
        existing !== previous && existing.toLocaleLowerCase('pl') === key.toLocaleLowerCase('pl'),
    )
  )
    throw Error('Ta dziedzina Wiedzy już istnieje.');
  return key;
}
export function addKnowledgeSkill(character: Character, name: string) {
  character.build.skills[keyFor(character, name)] = 4;
}
export function renameKnowledge(character: Character, key: string, name: string) {
  if (!key.startsWith('knowledge:') || !Object.hasOwn(character.build.skills, key))
    throw Error('Nie znaleziono dziedziny Wiedzy.');
  const replacement = keyFor(character, name, key);
  character.build.skills = Object.fromEntries(
    Object.entries(character.build.skills).map(([current, die]) => [
      current === key ? replacement : current,
      die,
    ]),
  );
  for (const edge of character.build.edges)
    edge.target = edge.target
      .split('|')
      .map((value) => (value === key ? replacement : value))
      .join('|');
}
export function removeKnowledge(character: Character, key: string) {
  if (!key.startsWith('knowledge:') || !Object.hasOwn(character.build.skills, key))
    throw Error('Nie znaleziono dziedziny Wiedzy.');
  delete character.build.skills[key];
  let affected = false;
  for (const edge of character.build.edges)
    edge.target = edge.target
      .split('|')
      .map((value) => {
        if (value === key) {
          affected = true;
          return '';
        }
        return value;
      })
      .join('|');
  return affected;
}
