import type { Character } from '../rules/model';

export type Archetype = {
  id: string;
  name: string;
  page: 11 | 12;
  description: string;
  note: string;
  build: Character['build'];
};

function archetype(
  id: string,
  name: string,
  page: 11 | 12,
  description: string,
  overrides: Partial<Character['build']['attributes']>,
  skills: Character['build']['skills'],
  edges: (string | Character['build']['edges'][number])[],
  note = '',
): Archetype {
  const attributes: Character['build']['attributes'] = {
    agility: 6,
    smarts: 6,
    spirit: 6,
    strength: 6,
    vigor: 6,
    ...overrides,
  };
  const attributePoints = Object.values(attributes).reduce((sum, die) => sum + (die - 4) / 2, 0);
  return {
    id,
    name,
    page,
    description,
    note,
    build: {
      attributes,
      skills,
      edges: edges.map((edge) => (typeof edge === 'string' ? { id: edge, target: '' } : edge)),
      hindrances: [],
      bonus: { attributes: Math.max(0, attributePoints - 5), skills: 0, funds: 0 },
    },
  };
}

// SW PL 2015, printed pp. 11–12 (PDF pp. 12–13). These are starting templates:
// Hindrances and unspent skill points remain the player's choices. See docs/archetypes.md.
export const archetypes: readonly Archetype[] = [
  archetype(
    'investigator',
    'Badacz tajemnic',
    11,
    'Śledczy, dziennikarz lub poszukiwacz odpowiedzi w ruinach i osadach Exilium.',
    { smarts: 8 },
    { persuasion: 6, notice: 8, shooting: 6, fighting: 6, streetwise: 8, investigation: 8 },
    ['investigator', 'connections'],
  ),
  archetype(
    'face',
    '„Buźka”',
    11,
    'Negocjator karawany, pośrednik lub rozmówca, który potrafi przekonać i zastraszyć.',
    { spirit: 8 },
    {
      persuasion: 10,
      notice: 6,
      shooting: 4,
      streetwise: 6,
      taunt: 6,
      fighting: 4,
      intimidation: 6,
    },
    ['strong-willed', 'attractive'],
  ),
  archetype(
    'driver',
    'Kierowca',
    11,
    'Kierowca łazika lub karawaniarz, który przeprowadza transport przez pustkowia.',
    { agility: 8 },
    { driving: 8, notice: 6, shooting: 6, fighting: 4 },
    ['ace', 'quick'],
  ),
  archetype(
    'rogue',
    'Łotrzyk',
    11,
    'Włamywacz, zwiadowca lub złomiarz, który polega na skradaniu i sprawnych rękach.',
    { agility: 8 },
    { stealth: 8, notice: 6, fighting: 6, lockpicking: 6, climbing: 6, streetwise: 6, taunt: 6 },
    ['assassin', 'thief'],
  ),
  archetype(
    'scientist',
    'Naukowiec',
    12,
    'Badacz technologii i mechanik, który korzysta z wiedzy oraz zwykłych narzędzi.',
    { agility: 4, smarts: 10, strength: 4 },
    { repair: 6, notice: 8, 'knowledge:Inna': 10, 'knowledge:Nauka': 10, streetwise: 6 },
    ['mcgyver', { id: 'scholar', target: 'knowledge:Inna|knowledge:Nauka' }, 'jack-trades'],
    'Nazwij dziedzinę Wiedza (Inna) w kroku Umiejętności; powiązanie z Uczonym zaktualizuje się automatycznie.',
  ),
  archetype(
    'pilot',
    'Pilot',
    12,
    'Pilot samolotu lub wiropłatu, który potrafi też zadbać o sprawność swojej maszyny.',
    { agility: 8 },
    { piloting: 10, repair: 6, notice: 8, shooting: 6, fighting: 4 },
    ['ace', 'alertness'],
  ),
  archetype(
    'leader',
    'Przywódca',
    12,
    'Dowódca ochrony, organizator wyprawy lub lider osady, który wspiera swoich ludzi.',
    { spirit: 8, strength: 4 },
    {
      persuasion: 6,
      notice: 6,
      shooting: 6,
      fighting: 6,
      'knowledge:Strategia': 6,
      intimidation: 6,
    },
    ['command', 'natural-leader'],
  ),
  archetype(
    'gunslinger',
    'Rewolwerowiec',
    12,
    'Strzelec dwóch broni: łowca nagród, ochroniarz lub pojedynkowicz na pograniczu.',
    { agility: 8 },
    { notice: 6, shooting: 10, fighting: 6, taunt: 6 },
    ['ambidextrous', 'two-fisted'],
  ),
  archetype(
    'sniper',
    'Snajper',
    12,
    'Czujny strzelec osłaniający karawanę, posterunek albo towarzyszy na pustkowiu.',
    { agility: 10 },
    { notice: 6, shooting: 10, fighting: 6, taunt: 6 },
    ['alertness'],
  ),
  archetype(
    'brute',
    'Wojownik – rębacz',
    12,
    'Silny ochroniarz lub najemnik walczący w zwarciu i odpierający kilku przeciwników.',
    { smarts: 4, strength: 8, vigor: 8 },
    { notice: 6, fighting: 10, intimidation: 6 },
    ['brawny', 'sweep'],
    'Korekta budżetu: Siła k8 zamiast drukowanego k10. Zachowuje obie przewagi i mieści się w 4 punktach z zawad.',
  ),
  archetype(
    'fencer',
    'Wojownik – szermierz',
    12,
    'Specjalista walki dwiema broniami, przydatny w ciasnych przejściach i bliskich starciach.',
    { agility: 8 },
    { stealth: 6, notice: 6, fighting: 12, taunt: 8 },
    ['two-fisted', 'florentine'],
  ),
  archetype(
    'martial-artist',
    'Wojownik – sztuki walki',
    12,
    'Wyszkolony w walce wręcz ochroniarz, pięściarz lub bywalec walk w saloonach.',
    { agility: 8, strength: 8 },
    { notice: 6, fighting: 10, intimidation: 6 },
    ['martial'],
  ),
];
