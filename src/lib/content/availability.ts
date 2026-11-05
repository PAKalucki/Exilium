export type UnavailableRule = {
  name: string;
  kind: 'edge' | 'hindrance';
  reason: string;
  alternative?: string;
};
const powers =
  'Wymaga zasad mocy, Punktów mocy lub Zdolności nadprzyrodzonych, których nie używamy w Exilium.';
export const unavailableRules: UnavailableRule[] = [
  { name: 'Czarodziej', kind: 'edge', reason: powers },
  { name: 'Mentalista', kind: 'edge', reason: powers },
  { name: 'Mnich-Wojownik', kind: 'edge', reason: powers, alternative: 'Uczeń sztuk walki' },
  { name: 'Nowa moc', kind: 'edge', reason: powers },
  { name: 'Odporny na moc', kind: 'edge', reason: powers },
  { name: 'Odporniejszy na moc', kind: 'edge', reason: powers },
  { name: 'Odzyskiwanie mocy', kind: 'edge', reason: powers },
  { name: 'Regeneracja mocy', kind: 'edge', reason: powers },
  {
    name: 'Pomysłowy Dobromir',
    kind: 'edge',
    reason:
      'Pełny opis z 2015 r. (s. 38) wymaga Zdolności nadprzyrodzonych (Niesamowita nauka) i tworzy urządzenia korzystające z mocy oraz Punktów mocy. Krótka tabela nie pokazuje tych wymagań. Dlatego nie jest zwykłą przewagą mechanika w Exilium.',
    alternative: 'McGyver',
  },
  { name: 'Przypływ mocy', kind: 'edge', reason: powers },
  { name: 'Punkty mocy', kind: 'edge', reason: powers },
  {
    name: 'Szósty zmysł',
    kind: 'edge',
    reason:
      'Ta kampania pomija opcje opierające się na paranormalnym wyczuwaniu niebezpieczeństwa. Ewentualne przyziemne przeformułowanie wymaga osobnego uzgodnienia z MG.',
    alternative: 'Czujny',
  },
  {
    name: 'Władca zwierząt',
    kind: 'edge',
    reason:
      'Opis zapewnia szczególny zwierzęcy magnetyzm, nieagresję zwierząt i pojawienie się nowego towarzysza. Przyziemna wersja wymaga uzgodnienia z MG.',
    alternative: 'Przyjaciel zwierząt',
  },
  { name: 'Wojownik Światła/Ciemności', kind: 'edge', reason: powers },
  { name: 'Wybraniec', kind: 'edge', reason: powers },
  { name: 'Wyssanie Duszy', kind: 'edge', reason: powers },
  { name: 'Zdolności nadprzyrodzone', kind: 'edge', reason: powers },
  {
    name: 'Złota rączka',
    kind: 'edge',
    reason:
      'Pełny opis (s. 39), mimo skrótu w tabeli, wymaga Zdolności nadprzyrodzonych (Niesamowita nauka) i umiejętności Niesamowita nauka.',
    alternative: 'McGyver',
  },
  {
    name: 'Niedowiarek',
    kind: 'hindrance',
    reason:
      'Dotyczy zaprzeczania rzeczywistym zjawiskom nadnaturalnym i kary strachu wobec nich. Bez takich zjawisk nie stanowi odpowiedniej zawady dającej punkty.',
  },
];
export const ruleSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLocaleLowerCase('pl')
    .trim();
