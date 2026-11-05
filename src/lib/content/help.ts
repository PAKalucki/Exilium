import { attributes, skillInfo, type Attribute } from './catalog';
export type HelpContent = { title: string; paragraphs: string[]; example?: string };

export const attributeGuides: Record<Attribute, HelpContent & { short: string }> = {
  agility: {
    title: 'Zręczność',
    short: 'Koordynacja, refleks i precyzja ruchów.',
    paragraphs: [
      'Zręczność opisuje koordynację i sprawność ruchową. MG może poprosić o jej test np. przy utrzymywaniu równowagi lub unikaniu nagłego zagrożenia.',
      'Łączą się z nią m.in. Strzelanie, Walka, Skradanie i Prowadzenie. Przy strzale rzucasz kością Strzelania, a nie Zręczności. Zręczność określa koszt nauki tych umiejętności.',
    ],
    example:
      'Zręczność k6 i Strzelanie k8 oznaczają rzut k8 na strzał. Podnoszenie Strzelania powyżej k6 kosztuje więcej punktów podczas tworzenia postaci.',
  },
  smarts: {
    title: 'Spryt',
    short: 'Rozumowanie, pamięć i orientacja w sytuacji.',
    paragraphs: [
      'Spryt przydaje się do rozumowania, zapamiętywania, wiedzy ogólnej i oceny sytuacji.',
      'Wiąże się m.in. ze Spostrzegawczością, Leczeniem, Reperowaniem, Przetrwaniem i dziedzinami Wiedzy. Wysoki Spryt ułatwia kupowanie tych umiejętności, lecz nie zastępuje ich kości.',
    ],
    example:
      'By rozpoznać uszkodzenie łazika, zwykle testujesz Reperowanie. Żeby przypomnieć sobie powszechnie znany fakt, MG może poprosić o test Sprytu.',
  },
  spirit: {
    title: 'Duch',
    short: 'Odwaga, siła woli i opanowanie.',
    paragraphs: [
      'Duch opisuje odporność psychiczną, wolę i opanowanie. Używasz go m.in. do otrząsania się z Szoku i przeciwstawiania się strachowi.',
      'Jest cechą powiązaną z Przekonywaniem i Zastraszaniem. Nie oznacza magicznej energii ani mocy paranormalnej.',
    ],
    example:
      'Na początku swojej tury postać w Szoku testuje Ducha. Sukces pozwala otrząsnąć się i działać normalnie według zasad z podręcznika 2015.',
  },
  strength: {
    title: 'Siła',
    short: 'Moc mięśni, udźwig i obrażenia w zwarciu.',
    paragraphs: [
      'Siła służy do wysiłku fizycznego: podnoszenia, wyważania czy mocowania się. Wiąże się ze Wspinaczką.',
      'Wpływa na udźwig oraz obrażenia wielu ataków wręcz. Samo trafienie w zwarciu rozstrzyga Walka, a nie Siła. Broń może wymagać odpowiedniej Siły.',
    ],
    example:
      'Z Siłą k6 i bronią opisaną jako Si+k4 rzucasz k6+k4 na obrażenia. Test trafienia wykonujesz osobno Walką.',
  },
  vigor: {
    title: 'Wigor',
    short: 'Kondycja, zdrowie i odporność organizmu.',
    paragraphs: [
      'Wigor oznacza wytrzymałość organizmu. Pomaga opierać się chorobom, truciznom, trudnym warunkom i skutkom urazów.',
      'Wpływa na Wytrzymałość. Test Wigoru wykonujesz m.in. przy wyparowaniu obrażeń po wydaniu fuksa oraz w sytuacjach zdrowotnych wskazanych przez MG.',
    ],
    example:
      'Bez dodatkowych modyfikatorów Wigor k6 daje bazową Wytrzymałość 2 + 6/2 = 5. Pancerz dodajesz osobno.',
  },
};
export const playerHelp: Record<string, HelpContent> = {
  dice: {
    title: 'Jak czytać kości i testy?',
    paragraphs: [
      'k4, k6, k8, k10 i k12 oznaczają kości o tylu ściankach. Zapis na karcie wskazuje kość cechy lub umiejętności, nie liczbę punktów dodawaną do rzutu.',
      'Twoja postać jest Figurą. W zwykłym teście współczynnika rzuca jego kością oraz Kością Figury (zwykle k6) i wybiera lepszy wynik. Następnie uwzględnia odpowiednie modyfikatory.',
      'Zwykły próg sukcesu to 4. Każde pełne 4 punkty ponad próg dają przebicie. Testy przeciwstawne i niektóre ataki mają inne progi; MG wskazuje właściwy.',
      'Maksymalny wynik na kości to as: rzucasz nią ponownie i dodajesz wynik. Rzut na obrażenia jest osobny i zwykle nie używa Kości Figury.',
    ],
    example:
      'Dla testu Strzelania k8 rzucasz k8 i k6 Figury. Wyniki 3 oraz 5 dają 5 przed modyfikatorami, więc przy progu 4 masz sukces.',
  },
  attributes: {
    title: 'Cechy a umiejętności',
    paragraphs: [
      'Cechy opisują ogólne możliwości bohatera. Umiejętności mówią, czego się nauczył. Testujesz tę kość, o którą poprosi MG; nie dodajesz do niej kości powiązanej cechy.',
      'Nowa postać zaczyna z k4 w każdej z pięciu cech. Zwykle masz 5 punktów: każdy kupuje jeden stopień, np. k4 → k6. Wyjątki wynikające z zawad i uzgodnień MG pokaże budżet.',
      'Pomyśl najpierw, czym bohater zajmuje się w drużynie. Możesz rozłożyć punkty równo albo wyróżnić kilka cech. Wyższa cecha ułatwia kupowanie powiązanych umiejętności w następnym kroku.',
    ],
    example:
      'Podniesienie jednej cechy z k4 do k8 kosztuje 2 punkty. Pięć cech na k6 zużywa zwykły budżet 5 punktów.',
  },
  skills: {
    title: 'Umiejętności i cecha powiązana',
    paragraphs: [
      'Podczas tworzenia postaci zwykle masz 15 punktów na umiejętności. Pierwsza kość k4 kosztuje 1 punkt. Każdy kolejny stopień do poziomu cechy powiązanej kosztuje 1 punkt, a każdy stopień ponad nią 2 punkty.',
      'Cecha powiązana określa koszt nauki; nie dodajesz jej wartości do testu umiejętności. Niewykupioną umiejętność zwykle improwizujesz na k4−2, jeśli MG dopuści próbę.',
      'Dziedziny Wiedzy są osobnymi umiejętnościami. Wiedza ogólna to test Sprytu, a nie automatycznie darmowa dziedzina Wiedzy.',
    ],
    example:
      'Przy Zręczności k6 zakup Strzelania k8 kosztuje 1 za k4 + 1 za k6 + 2 za k8, czyli 4 punkty.',
  },
  edges: {
    title: 'Jak wybierać przewagi?',
    paragraphs: [
      'Przewagi dają szczególne możliwości albo premie. Każdy człowiek ma jedną darmową przewagę, ale nadal musi spełniać jej wymagania: rangę, cechy, umiejętności i wcześniejsze przewagi.',
      'Kolejne przewagi podczas tworzenia kosztują po 2 punkty uzyskane z zawad. Przewagi wymagające wyższej rangi zobaczysz na liście, lecz zwykle zdobędziesz je dopiero podczas rozwoju.',
      'Stałe premie obsługiwane przez kartę są uwzględniane w liczbach. Efekty zależne od sytuacji, np. dodatkowy atak czy premia przy zasadzce, stosuj zgodnie z opisem przy stole. Zawodowe przewagi kupowane podczas gry wymagają zapisanego uzgodnienia z MG.',
    ],
  },
  hindrances: {
    title: 'Zawady i ich korzyści',
    paragraphs: [
      'Zawada to rzeczywiste utrudnienie lub zobowiązanie do odgrywania postaci. Drobna daje 1 punkt, a poważna 2 punkty. Zwykle punktuje najwyżej jedna poważna i dwie drobne zawady, łącznie do 4 punktów.',
      'Za 2 punkty możesz dokupić punkt na cechy albo przewagę. Za 1 punkt możesz dokupić punkt umiejętności albo zwiększyć początkowe fundusze o bazową kwotę.',
      'Wybierz trudności, które chcesz odgrywać. Wspólny ubogi początek drużyny nie wybiera automatycznie zawady Biedak. Dodatkowe fabularne zawady nie powiększają normalnego limitu korzyści.',
    ],
  },
  origin: {
    title: 'Pochodzenie na Exilium',
    paragraphs: [
      'Wybierz miejsce lub środowisko, w którym bohater dorastał albo z którym się utożsamia. Lista zawiera miejscowości z przewodnika i ogólne tła pustkowia/karawany.',
      'To element historii: może podpowiedzieć kontakty, zwyczaje i motywację. Nie przyznaje automatycznie umiejętności, przewag ani pieniędzy. Dla innego miejsca wybierz „Własne — wpisz”.',
    ],
  },
  caste: {
    title: 'Status społeczny i kasta',
    paragraphs: [
      'Kasta opisuje pozycję prawną i społeczną w świecie Exilium. Pięć nazw pochodzi z przewodnika po świecie. Nie jest klasą postaci ani rangą doświadczenia.',
      'Wybór kasty sam nie zmienia budżetu, Charyzmy ani przewag. W tej kampanii wszyscy zaczynają ubogo. Nietypowe pochodzenie i jego skutki fabularne omów z MG; Bogaty i Obrzydliwie Bogaty wymagają osobnej zgody.',
    ],
  },
  profession: {
    title: 'Profesja bohatera',
    paragraphs: [
      'Profesja to dotychczasowe zajęcie bohatera, a nie klasa ograniczająca rozwój. Możesz wybrać podpowiedź albo wpisać własną.',
      'Nazwa zawodu nie przyznaje automatycznie umiejętności ani przewagi zawodowej. Kup je osobno, jeśli pasują do pomysłu na postać.',
    ],
  },
  parry: {
    title: 'Obrona',
    paragraphs: [
      'Obrona to próg, który przeciwnik musi osiągnąć w zwykłym ataku wręcz przeciw tobie. Nie jest uniwersalnym progiem dla wszystkich ataków dystansowych.',
      'Podstawa to 2 + połowa kości Walki; przewagi, broń i odpowiednie modyfikatory mogą ją zmieniać. Karta pokazuje wyliczony wynik.',
    ],
    example: 'Walka k6 daje zwykle Obronę 5: 2 + 6/2.',
  },
  toughness: {
    title: 'Wytrzymałość i pancerz',
    paragraphs: [
      'Z Wytrzymałością porównujesz wynik obrażeń, a nie test trafienia. Podstawa to 2 + połowa Wigoru, z odpowiednimi modyfikatorami.',
      'Karta dodaje do niej aktywny pancerz tułowia i pokazuje go osobno. Trafienia w inne miejsca, przebicie pancerza i szczególne rodzaje ochrony rozstrzygaj zgodnie z sytuacją.',
      'Sukces w obrażeniach zwykle powoduje Szok, a przebicia Rany. To MG rozstrzyga obrażenia; zapisujesz ich ostateczne skutki licznikami.',
    ],
  },
  pace: {
    title: 'Tempo i bieganie',
    paragraphs: [
      'Tempo to odległość zwykłego ruchu w skali walki z podręcznika. Standardowa podstawa wynosi 6. Wartość nie oznacza metrów na sekundę.',
      'Bieg dodaje wynik kości biegania, zwykle k6, ale może utrudniać inne działania. Zawady i przewagi mogą zmieniać Tempo lub kość biegania.',
    ],
  },
  charisma: {
    title: 'Charyzma',
    paragraphs: [
      'Charyzma to modyfikator społeczny z edycji 2015, a nie osobna cecha z własną kością. Zwykle zaczyna od 0.',
      'Stosuj ją w odpowiednich testach społecznych, np. Przekonywania i Wypytywania, zgodnie z zasadami i sytuacją. Nie dodawaj jej do każdego testu Ducha.',
      'Karta pokazuje Charyzmę osobno. Efekty warunkowe, np. reputacja w konkretnej społeczności, mogą wymagać dodatkowego uzgodnienia przy stole.',
    ],
  },
  wounds: {
    title: 'Rany i Wyeliminowanie',
    paragraphs: [
      'Figura może mieć do 3 Ran. Każda zwykle daje −1 do testów współczynników; odpowiednie przewagi mogą zmniejszać tę karę.',
      'Kolejne obrażenia mogą Wyeliminować bohatera. Licznik kończy się na 3; zaznacz wtedy także „Wyeliminowanie (Rany)” i rozstrzygnij z MG test Wigoru oraz dalsze skutki.',
      'Usunięcie Ran wymaga rozstrzygnięcia leczenia lub zdrowienia. Początek nowej sesji nie leczy automatycznie postaci.',
    ],
  },
  fatigue: {
    title: 'Zmęczenie',
    paragraphs: [
      '0 oznacza brak Zmęczenia, 1 — Zmęczonego (−1), 2 — Wyczerpanego (−2), a 3 — Wyeliminowanego wskutek Zmęczenia.',
      'Kara ze Zmęczenia sumuje się z karą z Ran. Źródło i sposób odpoczynku zależą od sytuacji, np. upału, odwodnienia lub braku snu.',
      'Karta pokazuje łączną karę osobno; uwzględnij ją w odpowiednim rzucie przy stole.',
    ],
  },
  bennies: {
    title: 'Fuksy',
    paragraphs: [
      'Fuksy pozwalają m.in. ponowić test współczynnika, wyparować obrażenia testem Wigoru lub natychmiast otrząsnąć się z Szoku. Zwykle nie służą do przerzucania obrażeń; wyjątek daje np. Bez przebaczenia.',
      'Po wydaniu zmniejsz licznik. Efekt, test i ewentualne zmiany Ran lub Szoku rozstrzygacie przy stole.',
      'Liczba na początek sesji uwzględnia odpowiednie przewagi i zawady. „Nowa sesja” przywraca tę pulę, ale zachowuje Rany, Zmęczenie i inne stany.',
    ],
  },
  shaken: {
    title: 'Szok',
    paragraphs: [
      'Szok oznacza chwilową dezorientację, a nie utratę przytomności.',
      'Na początku swojej akcji testujesz Ducha. Według używanego podręcznika 2015 sukces pozwala otrząsnąć się i działać normalnie. Porażka zostawia tylko akcje darmowe, w tym ruch o Tempo; bez biegu.',
      'Możesz też wydać fuksa, aby natychmiast usunąć Szok. Zmień wtedy licznik fuksów i przełącznik Szoku.',
    ],
  },
  incapacitated: {
    title: 'Wyeliminowanie',
    paragraphs: [
      'Wyeliminowany bohater nie może działać normalnie. Przyczyną mogą być obrażenia lub skrajne Zmęczenie; to oddzielne stany.',
      'Przełącznik dotyczy Wyeliminowania wskutek Ran. Zmęczenie na poziomie 3 oznacza Wyeliminowanie niezależnie od niego. Testy Wigoru, urazy i dalsze skutki rozstrzyga MG.',
    ],
  },
  advancement: {
    title: 'PD, ranga i rozwinięcia',
    paragraphs: [
      'MG przyznaje Punkty doświadczenia. Na początku każde 5 PD daje rozwinięcie; po 80 PD kolejne uzyskujesz co 10 PD. Rangi zmieniają się przy 20, 40, 60 i 80 PD.',
      'Rozwinięcie wydajesz w zakładce Rozwój na dozwolony wzrost cechy, umiejętności lub przewagę. W tej kampanii odłożone rozwinięcie sprawdza wymagania wobec obecnej rangi, gdy je wydajesz.',
      'Historia zapisuje dokonany wybór. Nie musisz od razu wydawać każdego uzyskanego rozwinięcia.',
    ],
  },
};
const skillUses: Record<string, string> = {
  gambling: 'Gry hazardowe, ocena szans i przechytrzanie innych graczy.',
  riding: 'Jazda na wierzchowcu i panowanie nad nim w trudnych warunkach.',
  healing: 'Pierwsza pomoc, opatrywanie i leczenie urazów.',
  piloting: 'Kierowanie statkami powietrznymi i innymi maszynami wskazanymi przez MG.',
  swimming: 'Pływanie i radzenie sobie w wodzie.',
  driving: 'Prowadzenie pojazdów lądowych, np. łazika.',
  persuasion: 'Przekonywanie, negocjacje i wpływanie na nastawienie rozmówcy.',
  survival: 'Znajdowanie wody, schronienia i żywności oraz przetrwanie poza osadą.',
  repair: 'Rozpoznawanie usterek i naprawianie urządzeń.',
  throwing: 'Celne rzucanie przedmiotami i bronią miotaną.',
  stealth: 'Poruszanie się i ukrywanie bez zwracania uwagi.',
  notice: 'Dostrzeganie, nasłuchiwanie i zauważanie szczegółów.',
  shooting: 'Ataki bronią strzelecką.',
  tracking: 'Odczytywanie śladów i podążanie za tropem.',
  fighting: 'Ataki wręcz, walka bronią i bez broni; wpływa też na Obronę.',
  lockpicking: 'Otwieranie zamków i obchodzenie odpowiednich zabezpieczeń.',
  climbing: 'Wspinanie się i pokonywanie stromych przeszkód.',
  streetwise: 'Zdobywanie informacji i rozeznania przez kontakty z ludźmi.',
  investigation: 'Poszukiwanie informacji w dokumentach, archiwach i dostępnych źródłach.',
  taunt: 'Prowokowanie i wytrącanie przeciwnika z równowagi słowami.',
  intimidation: 'Zastraszanie, groźby i wywieranie presji.',
  boating: 'Prowadzenie jednostek pływających.',
};
export function skillHelp(key: string): HelpContent {
  const skill = skillInfo(key);
  return {
    title: skill?.name || 'Umiejętność',
    paragraphs: [
      key.startsWith('knowledge:')
        ? 'Wiedza specjalistyczna w tej konkretnej dziedzinie. Każdą dziedzinę kupujesz i rozwijasz osobno.'
        : skillUses[key] || 'Zastosowanie umiejętności określa sytuacja i MG.',
      `Cecha powiązana: ${skill ? attributes[skill.attribute] : 'Spryt'}. Wpływa na koszt nauki, a nie jest dodatkową kością w teście.`,
      'Przy rzucie wybierz lepszy wynik z kości umiejętności i Kości Figury, a następnie zastosuj właściwe modyfikatory, w tym kary z Ran i Zmęczenia.',
    ],
  };
}
