import { newCharacter } from '../src/lib/rules/model';
export function sample() {
  const c = newCharacter('Łucja Żelazna');
  c.origin = 'Jericho';
  c.profession = 'Mechanik';
  c.build.attributes = { agility: 6, smarts: 6, spirit: 6, strength: 6, vigor: 6 };
  c.build.skills = {
    fighting: 6,
    shooting: 6,
    notice: 6,
    repair: 6,
    survival: 6,
    healing: 6,
    persuasion: 6,
    intimidation: 4,
  };
  c.build.edges = [{ id: 'alertness', target: '' }];
  return c;
}
