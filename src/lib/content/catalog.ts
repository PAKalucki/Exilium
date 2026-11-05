export const attributes = {
  agility: 'Zręczność',
  smarts: 'Spryt',
  spirit: 'Duch',
  strength: 'Siła',
  vigor: 'Wigor',
} as const;
export type Attribute = keyof typeof attributes;
export const dice = [4, 6, 8, 10, 12] as const;
export const ranks = ['Nowicjusz', 'Doświadczony', 'Weteran', 'Heros', 'Legenda'];
export const RULESET = 'sw2015-exilium-1';
export const STARTING_FUNDS = 400;
export const skills: { id: string; name: string; attribute: Attribute }[] = [
  ['gambling', 'Hazard', 'smarts'],
  ['riding', 'Jeździectwo', 'agility'],
  ['healing', 'Leczenie', 'smarts'],
  ['piloting', 'Pilotowanie', 'agility'],
  ['swimming', 'Pływanie', 'agility'],
  ['driving', 'Prowadzenie', 'agility'],
  ['persuasion', 'Przekonywanie', 'spirit'],
  ['survival', 'Przetrwanie', 'smarts'],
  ['repair', 'Reperowanie', 'smarts'],
  ['throwing', 'Rzucanie', 'agility'],
  ['stealth', 'Skradanie', 'agility'],
  ['notice', 'Spostrzegawczość', 'smarts'],
  ['shooting', 'Strzelanie', 'agility'],
  ['tracking', 'Tropienie', 'smarts'],
  ['fighting', 'Walka', 'agility'],
  ['lockpicking', 'Włamywanie', 'agility'],
  ['climbing', 'Wspinaczka', 'strength'],
  ['streetwise', 'Wypytywanie', 'smarts'],
  ['investigation', 'Wyszukiwanie', 'smarts'],
  ['taunt', 'Wyśmiewanie', 'smarts'],
  ['intimidation', 'Zastraszanie', 'spirit'],
  ['boating', 'Żeglowanie', 'agility'],
].map(([id, name, attribute]) => ({ id, name, attribute: attribute as Attribute }));
export function skillInfo(id: string) {
  if (id.startsWith('knowledge:') && id.length > 10)
    return { id, name: `Wiedza (${id.slice(10)})`, attribute: 'smarts' as Attribute };
  return skills.find((s) => s.id === id);
}
type Requirements = {
  attributes?: Partial<Record<Attribute, number>>;
  skills?: Record<string, number>;
  edge?: string;
  anySkill?: string[];
  anyDie?: number;
};
export type Edge = {
  id: string;
  name: string;
  rank: number;
  summary: string;
  requirements: Requirements;
  professional?: boolean;
  target?: 'trait' | 'knowledge' | 'weapon';
  repeat?: number;
};
const edge = (
  id: string,
  name: string,
  rank: number,
  summary: string,
  requirements: Requirements = {},
  extra: Partial<Edge> = {},
): Edge => ({ id, name, rank, summary, requirements, ...extra });
// Summaries are deliberately short. Source: SW PL 2015 pp. 29–48; see docs/rules.md.
export const edges: Edge[] = [
  edge(
    'acrobat',
    'Akrobata',
    0,
    'Gibkość +2; Obrona +1 bez przeciążenia.',
    { attributes: { agility: 8, strength: 6 } },
    { professional: true },
  ),
  edge(
    'ace',
    'As',
    0,
    'Obsługa pojazdów +2; wyparowanie obrażeń pojazdu.',
    { attributes: { agility: 8 } },
    { professional: true },
  ),
  edge('command', 'Baczność!', 0, 'Pomoc podwładnym przy wychodzeniu z Szoku.', {
    attributes: { smarts: 6 },
  }),
  edge('command-presence', 'Autorytet', 0, 'Zasięg dowodzenia 10 cali.', { edge: 'command' }),
  edge('fervor', 'Do szturmu!', 2, 'Podwładni: obrażenia wręcz +1.', {
    edge: 'command',
    attributes: { spirit: 8 },
  }),
  edge('hold-line', 'Nie przejdą!', 1, 'Podwładni: Wytrzymałość +1.', {
    edge: 'command',
    attributes: { smarts: 8 },
  }),
  edge('inspire', 'Odwagi!', 1, 'Podwładni: pomoc przeciw strachowi.', {
    edge: 'command',
    skills: { persuasion: 8 },
  }),
  edge('tactician', 'Taktyk', 1, 'Dodatkowe opcje kart akcji dla sojuszników.', {
    edge: 'command',
    attributes: { smarts: 8 },
    skills: { 'knowledge:Strategia': 6 },
  }),
  edge('natural-leader', 'Urodzony przywódca', 0, 'Możesz przekazywać fuksy podwładnym.', {
    edge: 'command',
    attributes: { spirit: 8 },
  }),
  edge('command-spirit', 'Trzymać szyk!', 1, 'Podwładni: testy Ducha +1.', { edge: 'command' }),
  edge(
    'investigator',
    'Badacz',
    0,
    'Badania i wypytywanie +2.',
    { attributes: { smarts: 8 }, skills: { investigation: 8, streetwise: 8 } },
    { professional: true },
  ),
  edge('berserk', 'Berserk', 0, 'Szał bojowy po zranieniu; rozstrzygany przy stole.'),
  edge('no-mercy', 'Bez przebaczenia', 1, 'Fuksy można przeznaczyć na obrażenia.'),
  edge('quick', 'Błyskawiczny refleks', 0, 'Możliwość wymiany niskiej Karty Akcji.', {
    attributes: { agility: 8 },
  }),
  edge(
    'first-strike',
    'Szybki cios',
    0,
    'Darmowy atak przeciw jednemu wrogowi wchodzącemu w zwarcie.',
    { attributes: { agility: 8 } },
  ),
  edge(
    'improved-first-strike',
    'Błyskawiczny cios',
    3,
    'Darmowy atak przeciw każdemu wrogowi wchodzącemu w zwarcie.',
    { edge: 'first-strike' },
  ),
  edge('rich', 'Bogaty', 0, 'Początkowe fundusze ×3; dochód według MG.'),
  edge('filthy-rich', 'Obrzydliwie bogaty', 0, 'Początkowe fundusze ×5.', { edge: 'rich' }),
  edge('strong-willed', 'Charakterny', 0, 'Próby woli +2.', {
    skills: { taunt: 6, intimidation: 6 },
  }),
  edge('charismatic', 'Charyzmatyczny', 0, 'Charyzma +2.', { attributes: { spirit: 8 } }),
  edge('fleet', 'Chyży', 0, 'Tempo +2; kość biegania k10.', { attributes: { agility: 6 } }),
  edge('improvisational', 'Co się nawinie', 1, 'Bez zwykłej kary za improwizowaną broń.', {
    attributes: { smarts: 6 },
  }),
  edge('alertness', 'Czujny', 0, 'Spostrzegawczość +2.'),
  edge('liquid-courage', 'Dla kurażu', 0, 'Czasowy efekt alkoholu; rozstrzygany przy stole.', {
    attributes: { vigor: 8 },
  }),
  edge('quick-draw', 'Dobywanie', 0, 'Dobywanie broni bez zwykłej akcji.', {
    attributes: { agility: 8 },
  }),
  edge('brave', 'Dzielny', 0, 'Opieranie się strachowi +2.', { attributes: { spirit: 6 } }),
  edge('weapon-master', 'Fechmistrz', 4, 'Obrona +1.', { skills: { fighting: 12 } }),
  edge('master-at-arms', 'Arcyfechmistrz', 4, 'Kolejne +1 do Obrony.', { edge: 'weapon-master' }),
  edge('block', 'Garda', 1, 'Obrona +1.', { skills: { fighting: 8 } }),
  edge('improved-block', 'Podwójna garda', 2, 'Kolejne +1 do Obrony.', { edge: 'block' }),
  edge('frenzy', 'Grad ciosów', 1, 'Dodatkowy atak wręcz z karą.', { skills: { fighting: 10 } }),
  edge('improved-frenzy', 'Nawałnica ciosów', 2, 'Dodatkowy atak bez kary.', { edge: 'frenzy' }),
  edge('killer-instinct', 'Instynkt zabójcy', 3, 'Przewaga w testach przeciwstawnych.'),
  edge('connections', 'Koneksje', 0, 'Przydatne kontakty; opisz je w historii.'),
  edge('counterattack', 'Kontratak', 1, 'Kontratak raz na rundę, z karą.', {
    skills: { fighting: 8 },
  }),
  edge('improved-counterattack', 'Imperialny kontratak', 2, 'Kontratak bez kary.', {
    edge: 'counterattack',
  }),
  edge('fast-healer', 'Końskie zdrowie', 0, 'Testy naturalnego zdrowienia +2.', {
    attributes: { vigor: 8 },
  }),
  edge('brawny', 'Krzepki', 0, 'Wytrzymałość +1; udźwig 8 × Siła.', {
    attributes: { strength: 6, vigor: 6 },
  }),
  edge('attractive', 'Ładny', 0, 'Charyzma +2.', { attributes: { vigor: 6 } }),
  edge('very-attractive', 'Śliczny', 0, 'Kolejne +2 do Charyzmy.', { edge: 'attractive' }),
  edge(
    'mcgyver',
    'McGyver',
    0,
    'Improwizowane narzędzia i proste rozwiązania.',
    { attributes: { smarts: 6 }, skills: { repair: 6, notice: 8 } },
    { professional: true },
  ),
  edge('nerves', 'Nerwy ze stali', 0, 'Ignorujesz jeden punkt kary za Rany.', {
    attributes: { vigor: 8 },
  }),
  edge('improved-nerves', 'Nerwy z tytanu', 0, 'Ignorujesz dwa punkty kary za Rany.', {
    edge: 'nerves',
  }),
  edge('ambidextrous', 'Oburęczny', 0, 'Bez kary za mniej sprawną rękę.', {
    attributes: { agility: 8 },
  }),
  edge('extraction', 'Odejście', 0, 'Łatwiejsze wycofanie ze zwarcia.', {
    attributes: { agility: 8 },
  }),
  edge('improved-extraction', 'Niezawodne odejście', 0, 'Skuteczniejsze wycofanie.', {
    edge: 'extraction',
  }),
  edge('level-headed', 'Opanowany', 1, 'Wybór lepszej z dwóch Kart Akcji.', {
    attributes: { smarts: 8 },
  }),
  edge('improved-level-headed', 'Wyjątkowo opanowany', 1, 'Wybór najlepszej z trzech Kart Akcji.', {
    edge: 'level-headed',
  }),
  edge('steady-hands', 'Pewna ręka', 0, 'Bez zwykłej kary za niestabilne podłoże.', {
    attributes: { agility: 8 },
  }),
  edge('brawler', 'Pięściarz', 0, 'Obrażenia gołymi rękami +2.', { attributes: { strength: 8 } }),
  edge('bruiser', 'Bokser', 1, 'Dodatkowa kość obrażeń przy przebiciu: k8.', { edge: 'brawler' }),
  edge(
    'woodsman',
    'Podróżnik',
    0,
    'Przetrwanie i opieranie się klimatowi +2.',
    { attributes: { vigor: 6 }, skills: { survival: 8 } },
    { professional: true },
  ),
  edge(
    'followers',
    'Podwładni',
    4,
    'Pięciu podwładnych; rozstrzygani przy stole.',
    {},
    { repeat: 20 },
  ),
  edge(
    'two-fisted',
    'Podwójne uderzenie',
    0,
    'Walka dwiema broniami bez zwykłej kary za wiele akcji.',
    { attributes: { agility: 8 } },
  ),
  edge('linguist', 'Poliglota', 0, 'Znajomość języków zależna od Sprytu.', {
    attributes: { smarts: 6 },
  }),
  edge('sidekick', 'Pomagier', 4, 'Towarzysz będący Figurą.'),
  edge('common-bond', 'Prawdziwy przyjaciel', 0, 'Przekazywanie fuksów towarzyszom.', {
    attributes: { spirit: 8 },
  }),
  edge('beast-bond', 'Przyjaciel zwierząt', 0, 'Możliwość wydawania fuksów za zwierzę.'),
  edge('rock-roll', 'Rock and Roll!', 1, 'Łatwiejszy ogień automatyczny bez ruchu.', {
    skills: { shooting: 8 },
  }),
  edge(
    'assassin',
    'Skrytobójca',
    0,
    'Obrażenia przeciw nieświadomej ofierze +2.',
    { attributes: { agility: 8 }, skills: { climbing: 6, fighting: 6, stealth: 8 } },
    { professional: true },
  ),
  edge('marksman', 'Sokole oko', 1, 'Premia za celowanie bez ruchu.'),
  edge('luck', 'Szczęściarz', 0, 'Jeden dodatkowy fuks na sesję.'),
  edge('great-luck', 'Cholerny szczęściarz', 0, 'Dwa dodatkowe fuksy na sesję łącznie.', {
    edge: 'luck',
  }),
  edge('florentine', 'Szermierz', 0, 'Korzyści w walce dwiema broniami.', {
    attributes: { agility: 8 },
    skills: { fighting: 8 },
  }),
  edge('noble', 'Szycha', 0, 'Charyzma +2; korzyści Bogatego; status ustala MG.'),
  edge(
    'ranger',
    'Tropiciel',
    0,
    'Tropienie, Przetrwanie i Skradanie w naturze +2.',
    { attributes: { spirit: 6 }, skills: { survival: 8, tracking: 8 } },
    { professional: true },
  ),
  edge('tough', 'Twardy jak skała', 4, 'Wytrzymałość +1.'),
  edge('tougher', 'Twardy jak diament', 4, 'Kolejne +1 do Wytrzymałości.', { edge: 'tough' }),
  edge('hard-kill', 'Twardziel', 0, 'Ignorowanie kar z Ran w teście po wyeliminowaniu.', {
    attributes: { spirit: 8 },
  }),
  edge('harder-kill', 'Niezniszczalny', 2, 'Szansa przeżycia śmiertelnego zdarzenia.', {
    edge: 'hard-kill',
  }),
  edge('martial', 'Uczeń sztuk walki', 0, 'Nieuzbrojone ataki: Si+k4.', {
    skills: { fighting: 6 },
  }),
  edge('improved-martial', 'Adept sztuk walki', 2, 'Nieuzbrojone ataki: Si+k6.', {
    edge: 'martial',
    skills: { fighting: 10 },
  }),
  edge(
    'master-martial',
    'Mistrz sztuk walki',
    4,
    'Obrażenia nieuzbrojone +2 za wybór.',
    { edge: 'improved-martial', skills: { fighting: 12 } },
    { repeat: 5 },
  ),
  edge(
    'scholar',
    'Uczony',
    0,
    'Dwie wybrane dziedziny Wiedzy +2.',
    {},
    { professional: true, target: 'knowledge' },
  ),
  edge(
    'trademark',
    'Ulubiona broń',
    0,
    'Wybrany egzemplarz broni: atak +1.',
    { anySkill: ['fighting', 'shooting'], anyDie: 10 },
    { target: 'weapon' },
  ),
  edge(
    'improved-trademark',
    'Ukochana broń',
    2,
    'Wybrany egzemplarz broni: atak +2.',
    { edge: 'trademark' },
    { target: 'weapon' },
  ),
  edge('dodge', 'Unik', 1, 'Przeciwnicy: ataki dystansowe −1.', { attributes: { agility: 8 } }),
  edge('improved-dodge', 'Błyskawiczny unik', 2, 'Przeciwnicy: ataki dystansowe łącznie −2.', {
    edge: 'dodge',
  }),
  edge('healer', 'Uzdrowiciel', 0, 'Leczenie +2; pomoc w zdrowieniu towarzyszy.', {
    attributes: { spirit: 8 },
  }),
  edge('elan', 'Werwa', 0, 'Premia +2 do testu ponawianego fuksem.', { attributes: { spirit: 8 } }),
  edge(
    'jack-trades',
    'Wszechstronny',
    0,
    'Improwizowanie umiejętności Sprytu bez zwykłego −2.',
    { attributes: { smarts: 10 } },
    { professional: true },
  ),
  edge('master-leader', 'Wybitny wódz', 2, 'Podwładni używają k10 jako Kości Figury.'),
  edge(
    'giant-killer',
    'Zabójca olbrzymów',
    2,
    'Dodatkowe obrażenia przeciw znacznie większym celom.',
  ),
  edge('mighty-blow', 'Zabójczy cios', 1, 'Joker: podwójne obrażenia wręcz.', {
    skills: { fighting: 10 },
  }),
  edge('dead-shot', 'Zabójczy strzał', 1, 'Joker: podwójne obrażenia dystansowe.', {
    anySkill: ['shooting', 'throwing'],
    anyDie: 10,
  }),
  edge('sweep', 'Zamaszyste cięcie', 0, 'Atak przeciw pobliskim wrogom z karą.', {
    attributes: { strength: 8 },
    skills: { fighting: 8 },
  }),
  edge('improved-sweep', 'Niezwykle zamaszyste cięcie', 2, 'Zamaszyste cięcie bez kary.', {
    edge: 'sweep',
  }),
  edge('combat-reflexes', 'Zaprawiony w walce', 1, 'Wychodzenie z Szoku +2.'),
  edge('professional', 'Zawodowiec', 4, 'Wybrany współczynnik: k12+1.', {}, { target: 'trait' }),
  edge(
    'expert',
    'Ekspert',
    4,
    'Wybrany współczynnik: k12+2.',
    { edge: 'professional' },
    { target: 'trait' },
  ),
  edge(
    'master',
    'Mistrz',
    4,
    'Wybrany współczynnik: Kość Figury k10.',
    { edge: 'expert' },
    { target: 'trait' },
  ),
  edge('scrounger', 'Zbieracz', 0, 'Raz na sesję przydatny drobny przedmiot za zgodą MG.', {
    edge: 'luck',
  }),
  edge(
    'thief',
    'Złodziej',
    0,
    'Wspinaczka, Włamywanie i Skradanie w mieście +2; pomoc przy pułapkach.',
    { attributes: { agility: 8 }, skills: { climbing: 6, lockpicking: 6, stealth: 8 } },
    { professional: true },
  ),
];
export type Hindrance = { id: string; name: string; severities: number[]; summary: string };
const hindranceData: [string, string, number[], string][] = [
  ['illiterate', 'Analfabeta', [1], 'Brak umiejętności czytania i pisania.'],
  ['arrogant', 'Arogancki', [2], 'Potrzeba udowodnienia wyższości.'],
  ['poverty', 'Biedak', [1], 'Połowa początkowych funduszy.'],
  ['heroic', 'Bohaterski', [2], 'Obowiązek pomocy potrzebującym.'],
  ['ugly', 'Brzydal', [1], 'Charyzma −2.'],
  ['greedy', 'Chciwy', [1, 2], 'Przywiązanie do bogactwa.'],
  ['overconfident', 'Chojrak', [2], 'Przecenianie własnych możliwości.'],
  ['anemic', 'Chuchro', [1], 'Odporność na choroby i warunki −2.'],
  ['curious', 'Ciekawski', [2], 'Trudno oprzeć się tajemnicom.'],
  ['big-mouth', 'Długi język', [1], 'Trudności z dochowaniem sekretów.'],
  ['young', 'Dzieciak', [2], 'Budżet cech 3, umiejętności 10; dodatkowy fuks.'],
  ['quirk', 'Dziwactwo', [1], 'Drobne natręctwo.'],
  ['phobia', 'Fobia', [1, 2], 'Kara w obecności źródła lęku; opisz w notatkach.'],
  ['obese', 'Grubas', [1], 'Wytrzymałość +1; Tempo −1; bieganie k4.'],
  ['code', 'Honorowy', [2], 'Wiążący kodeks postępowania.'],
  ['one-leg', 'Jednonogi', [2], 'Tempo −2; bieganie k4; ograniczenia ruchu.'],
  ['one-eye', 'Jednooki', [2], 'Charyzma −1; ograniczenia widzenia głębi.'],
  ['one-arm', 'Jednoręki', [2], 'Kara −4 do czynności oburęcznych.'],
  ['jinx', 'Jonasz', [1, 2], 'Przyciąganie kłopotów.'],
  ['bad-eyes', 'Kiepski wzrok', [1, 2], 'Ograniczenia widzenia.'],
  ['small', 'Konus', [2], 'Wytrzymałość −1.'],
  ['nightmares', 'Koszmary', [2], 'Ryzyko Zmęczenia po przebudzeniu.'],
  [
    'bloodthirsty',
    'Krwiożerczy',
    [2],
    'Bez litości dla pokonanych; Charyzma −4 wobec znających tę reputację.',
  ],
  ['lame', 'Kulawy', [2], 'Tempo −2; bieganie k4.'],
  ['loyal', 'Lojalny', [1], 'Lojalność wobec przyjaciół.'],
  ['vengeful', 'Mściwy', [1, 2], 'Dążenie do zemsty.'],
  ['habit', 'Nawyk', [1, 2], 'Charyzma −1; poważny nałóg wymaga rozstrzygnięć MG.'],
  ['all-thumbs', 'Niezdara', [1], 'Reperowanie −2; ryzyko awarii.'],
  ['cautious', 'Ostrożny', [1], 'Nadmierna ostrożność.'],
  ['pacifist', 'Pacyfista', [1, 2], 'Ograniczenia stosowania przemocy.'],
  ['bad-luck', 'Pech', [2], 'Jeden fuks mniej na sesję.'],
  ['wanted', 'Poszukiwany', [1, 2], 'Ścigany przez prawo.'],
  ['deaf', 'Przygłuchy', [1, 2], 'Ograniczenia słuchu.'],
  [
    'elderly',
    'Ramol',
    [2],
    'Tempo −1; Siła i Wigor o kość niżej (minimum k4), bez zwiększania; 5 punktów na umiejętności Sprytu.',
  ],
  ['ritual', 'Rytuał', [1, 2], 'Rytualne zachowanie w walce.'],
  ['weak-willed', 'Safanduła', [1], 'Opieranie się Próbom woli −2.'],
  ['death-wish', 'Straceniec', [1], 'Niebezpieczny cel życiowy.'],
  ['blind', 'Ślepiec', [2], 'Ograniczenia wzroku; dodatkowa przewaga.'],
  ['sleepy', 'Śpioch', [1], 'Trudności z wybudzeniem i zwalczaniem senności.'],
  ['delusional', 'Świr', [1, 2], 'Urojone przekonanie.'],
  ['yellow', 'Tchórz', [2], 'Opieranie się strachowi −2.'],
  ['clueless', 'Tępak', [2], 'Wiedza ogólna −2.'],
  ['stubborn', 'Uparciuch', [1], 'Trudność ze zmianą zdania.'],
  ['mean', 'Wredny', [1], 'Charyzma −2.'],
  ['enemy', 'Wróg', [1, 2], 'Stały przeciwnik; opisz w historii.'],
  ['outsider', 'Odszczepieniec', [1], 'Charyzma −2 w odpowiedniej społeczności.'],
  ['vow', 'Zobowiązanie', [1, 2], 'Wiążąca przysięga.'],
];
export const hindrances: Hindrance[] = hindranceData.map(([id, name, severities, summary]) => ({
  id,
  name,
  severities,
  summary,
}));
export const origins = [
  'Jericho',
  'New Detroit',
  'El Dorado',
  'Alexandria',
  'Babylon',
  'Tombstone',
  'Silver Creek',
  'New Canaan',
  'Salvation',
  'Deadwood',
  'Pustkowia',
  'Karawana',
];
export const castes = ['Wolni', 'Uposażeni', 'Dziedzice', 'Zależni', 'Bezprzydziałowi'];
export const professions = [
  'Łowca nagród',
  'Mechanik',
  'Karawaniarz',
  'Ochroniarz',
  'Ranczer',
  'Złomiarz',
  'Medyk terenowy',
  'Kaznodzieja',
  'Wędrowny artysta',
];
