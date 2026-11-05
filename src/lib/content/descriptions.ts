import { attributes, edges, hindrances, ranks, skillInfo, type Attribute } from './catalog';

const edgeDetails: Record<string, string> = {
  berserk:
    'Po Ranie lub Szoku od obrażeń wykonujesz test Sprytu; porażka oznacza szał. W szale masz +2 do Walki, testów Siły i obrażeń wręcz, +2 do Wytrzymałości i −2 do Obrony. Ignorujesz kary z Ran, lecz nie możesz wykonywać czynności wymagających koncentracji. Wynik 1 na kości Walki grozi trafieniem innego pobliskiego celu, także sojusznika. Zakończenie szału rozstrzygacie przy stole (s. 29).',
  quick:
    'Jeśli otrzymasz Kartę Akcji o wartości 5 lub mniejszej, możesz ciągnąć kolejną, aż uzyskasz co najmniej 6. Nie zmienia to stale Tempa ani żadnej cechy.',
  rich: 'Na początku gry masz trzykrotność zwykłych funduszy. Przy bazowym budżecie Exilium 400 $ oznacza to 1200 $ przed innymi modyfikatorami. Dochody i źródło majątku ustalasz z MG.',
  'filthy-rich':
    'Zastępuje mnożnik Bogatego: początkowe fundusze wynoszą pięciokrotność bazy, czyli 2000 $ w Exilium przed innymi modyfikatorami. Mnożników ×3 i ×5 nie mnoży się przez siebie. Źródło i dostępność majątku ustalasz z MG.',
  noble:
    'Zapewnia status społeczny, +2 do Charyzmy i korzyści Bogatego. W Exilium trzeba ustalić z MG, jak ten status pasuje do kast, pochodzenia i wspólnego ubogiego początku drużyny.',
  'strong-willed':
    'Dodajesz +2 do Zastraszania i Wyśmiewania oraz do opierania się Próbom woli. Premie dotyczą tych zastosowań, a nie wszystkich testów Ducha i Sprytu.',
  'liquid-courage':
    'Po wypiciu odpowiedniej ilości alkoholu przez godzinę Wigor rośnie o rodzaj kości, Wytrzymałość o 1, a bohater ignoruje jeden punkt kary za Rany. Jest to efekt czasowy, rozstrzygany przy stole; nie zwiększa stale współczynników.',
  'quick-draw':
    'Dobycie broni nie nakłada zwykłej kary −2 do ataku w tej samej rundzie. Jeśli do sięgnięcia po broń potrzebny jest test Zręczności, dodajesz do niego +2. Szczegóły i sytuacyjne ograniczenia rozstrzyga MG.',
  frenzy:
    'Pozwala wykonać dodatkowy atak wręcz w rundzie; ataki mają modyfikator −2. Nie przyznaje dodatkowych rozwinięć ani stałej premii do Walki.',
  'improved-frenzy':
    'Dodatkowy atak z Gradu ciosów wykonujesz bez przewidzianej przez tę przewagę kary −2. Pozostałe modyfikatory sytuacyjne nadal mogą obowiązywać.',
  'killer-instinct':
    'W przeciwstawnych testach wygrywasz remisy. Wynik 1 na kości umiejętności w takim teście możesz przerzucić. To zasada rozstrzygania testów, nie stały wzrost kostki.',
  connections:
    'Wybierz organizację lub grupę, w której masz kontakty. Mogą pomóc informacjami, ludźmi albo wyposażeniem, lecz rodzaj pomocy i warunki zależą od relacji oraz decyzji MG. Opisz kontakty w historii.',
  counterattack:
    'Raz na rundę możesz odpowiedzieć darmowym atakiem wręcz na przeciwnika, który właśnie chybił cię w zwarciu. Kontratak wykonujesz z karą −2.',
  'improved-counterattack':
    'Darmowy kontratak z Kontrataku nie otrzymuje jego kary −2. Nie zmienia to zwykłej wartości Obrony ani limitu tej zdolności.',
  mcgyver:
    'Nie otrzymujesz zwykłej kary za brak narzędzi, jeśli możesz znaleźć sensowny zamiennik. Pozwala też improwizować proste przydatne urządzenia z dostępnych części; ich możliwości i czas wykonania określa MG. Nie daje nadnaturalnych wynalazków.',
  ambidextrous:
    'Ignorujesz zwykłą karę −2 za używanie mniej sprawnej ręki. Samo Oburęczny nie usuwa kar za wiele akcji; do walki dwiema broniami służy również Podwójne uderzenie.',
  extraction:
    'Gdy wycofujesz się ze zwarcia, udany test Zręczności pozwala uniknąć darmowego ataku jednego przeciwnika. Pozostali wrogowie mogą nadal reagować.',
  'improved-extraction':
    'Korzystasz z Odejścia, a przebicie w wymaganym teście sprawia, że żaden z przeciwników nie wykonuje darmowego ataku za twoje wycofanie.',
  'level-headed':
    'W każdej rundzie dostajesz dwie Karty Akcji i wybierasz korzystniejszą. Przewaga dotyczy inicjatywy, nie szybkości przemieszczania.',
  'improved-level-headed':
    'Zamiast dwóch Kart Akcji z Opanowanego otrzymujesz trzy i wybierasz najkorzystniejszą.',
  'steady-hands':
    'Ignorujesz zwykłą karę za niestabilne podłoże, np. strzelając z jadącego pojazdu. Kara za działanie w biegu spada z −2 do −1.',
  bruiser:
    'Gdy uzyskasz przebicie w walce gołymi rękami, dodatkowa kość obrażeń ma wartość k8 zamiast k6. Nie zastępuje podstawowego efektu Pięściarza.',
  followers:
    'Dołączają do ciebie podwładni będący Blotkami. Ich rola, wyposażenie i obecność w scenach zależą od świata i MG. Nie są dodatkowymi prywatnymi kartami graczy w tej aplikacji.',
  'two-fisted':
    'Przy ataku bronią w każdej ręce nie otrzymujesz zwykłej kary za wykonywanie wielu akcji. Kara za mniej sprawną rękę nadal obowiązuje, jeśli nie masz Oburęcznego.',
  linguist:
    'Znasz tyle języków, ile wynosi rodzaj kości Sprytu. Po odpowiednim osłuchaniu możesz próbować porozumieć się w nieznanym narzeczu testem Sprytu −2. Konkretne języki wpisz w historii.',
  sidekick:
    'Zyskujesz towarzysza będącego Figurą, który rozwija się jak postać. Jego koncepcję i obecność w grze ustalasz z MG; przewaga nie daje automatycznie następnego gracza ani konta.',
  'rock-roll':
    'Jeśli nie poruszasz się w danej turze, możesz ignorować zwykłą karę za ogień automatyczny. Nadal zużywasz właściwą ilość amunicji.',
  marksman:
    'Jeśli nie poruszasz się w turze, korzystasz z efektu celowania (+2 do odpowiedniego ataku dystansowego). Obowiązują ograniczenia szybkostrzelności z opisu przewagi.',
  florentine:
    'Gdy używasz dwóch broni, otrzymujesz +1 do Walki przeciw przeciwnikowi z jedną bronią bez tarczy. Gdy atakuje cię grupa, ignorujesz premię za jednego napastnika. To efekty sytuacyjne, nie stałe +1 do wszystkich testów Walki.',
  'hard-kill':
    'Testując Wigor po Wyeliminowaniu, ignorujesz w tym teście modyfikatory za Rany. Rany pozostają na karcie, a ich kary w innych sytuacjach nadal obowiązują.',
  'harder-kill':
    'Daje szansę przeżycia zdarzenia, które normalnie oznaczałoby śmierć. Wynik i konsekwencje ustala się według opisu z MG; aplikacja nie rozstrzyga śmierci automatycznie.',
  scholar:
    'Wybierz dwie różne dziedziny Wiedzy na co najmniej k8. Przy testach tych dziedzin dodajesz +2. Przewaga nie podnosi samych kości Wiedzy ani nie daje premii do wszystkich dziedzin.',
  trademark:
    'Wybierz konkretny egzemplarz broni. Atakując nim, dodajesz +1 do odpowiedniego testu Walki lub Strzelania. Premia nie dotyczy wszystkich broni tego typu ani obrażeń.',
  'improved-trademark':
    'Premia do ataku wybranym egzemplarzem broni wzrasta z +1 do +2. Musi to być ten sam egzemplarz, którego dotyczy Ulubiona broń.',
  dodge:
    'Przeciwnicy mają −1 do ataków dystansowych przeciw tobie. Nie jest to +1 do Obrony używanej w walce wręcz.',
  'improved-dodge':
    'Kara do ataków dystansowych przeciw tobie wzrasta do −2 łącznie. Nie dodawaj jej do Obrony w zwarciu.',
  healer:
    'Dodajesz +2 do Leczenia. Do pięciu towarzyszy może także korzystać z pomocy w naturalnym zdrowieniu zgodnie z opisem. W Exilium dotyczy to zwykłej medycyny, bez nadnaturalnego leczenia.',
  'master-leader':
    'Podwładni podczas testów grupowych używają k10 jako Kości Figury zamiast k6. Nie podnosi to wszystkich współczynników przywódcy.',
  'giant-killer':
    'Zadajesz dodatkowe k6 obrażeń przeciwnikom odpowiednio większym od ciebie według zasad rozmiaru. Premia jest sytuacyjna i nie dotyczy każdego wroga.',
  sweep:
    'Jednym zamachem atakujesz wszystkich pobliskich przeciwników z modyfikatorem −2. Uważaj na sojuszników w zasięgu; rozstrzygnięcie zależy od sceny.',
  'improved-sweep':
    'Zamaszyste cięcie nie otrzymuje już własnej kary −2. Pozostałe okoliczności ataku nadal mają znaczenie.',
};
const hindranceDetails: Record<string, string> = {
  illiterate:
    'Bohater nie umie czytać ani pisać poza najprostszymi rozpoznawanymi znakami. Utrudnia korzystanie z dokumentów, instrukcji i pisanych wiadomości; nie odejmuje automatycznie punktów Sprytu.',
  arrogant:
    'Bohater chce dowieść swojej wyższości, upokorzyć przeciwnika i zmierzyć się z jego przywódcą. To istotne zobowiązanie w odgrywaniu, nie darmowe punkty bez konsekwencji.',
  poverty:
    'Początkowe fundusze są o połowę mniejsze, a po każdym tygodniu czasu gry oszczędności maleją o połowę. Przy bazie Exilium 400 $ oznacza to 200 $ przed innymi modyfikatorami. Sam ubogi początek kampanii nie wybiera tej zawady za gracza.',
  heroic:
    'Bohater pomaga potrzebującym, nawet gdy naraża siebie lub opóźnia własne plany. MG może stawiać go przed trudnymi wyborami wynikającymi z tej postawy.',
  greedy:
    'Wersja drobna oznacza silne przywiązanie do własnego majątku. Wersja poważna skłania do ryzykowania i szkodzenia relacjom, by zyskać więcej. Nie zwiększa początkowych funduszy.',
  overconfident:
    'Bohater przecenia własne możliwości i podejmuje wyzwania, których rozsądniej byłoby unikać. Efekt jest fabularny i wpływa na podejmowane decyzje.',
  curious:
    'Bohater musi poznawać tajemnice, zaglądać w podejrzane miejsca i sprawdzać to, co powinien zostawić w spokoju. Często sprowadza to niebezpieczeństwo na drużynę.',
  'big-mouth':
    'Bohater ma trudności z dochowywaniem sekretów i może wygadać informacje w niewłaściwym momencie. Konkretne konsekwencje wynikają ze scen i ustaleń z MG.',
  phobia:
    'Określ konkretne źródło lęku. W jego obecności kara do odpowiednich testów wynosi −2 dla drobnej albo −4 dla poważnej wersji. Źródło i istotne sytuacje wpisz w notatkach.',
  'one-leg':
    'Tempo spada o 2, bieganie używa k4, a czynności wymagające ruchu i Pływanie mają odpowiednie kary. Sprawną protezę i jej wpływ na zawadę trzeba omówić z MG; opisowa cybernetyka sama nie usuwa zawady.',
  'one-eye':
    'Charyzma spada o 1, a czynności wymagające oceny głębi mają karę −2. Zwykłe zasłonięcie oka nie daje premii; wpływ ewentualnej protezy ustala MG.',
  jinx: 'Bohater przyciąga kłopoty, które mogą dotknąć jego i towarzyszy. Wersja poważna oznacza dotkliwsze konsekwencje. W Exilium są to zbiegi okoliczności i komplikacje fabularne, bez paranormalnej mocy.',
  'bad-eyes':
    'Postać ma trudności z odległym widzeniem: dostrzeganie lub atakowanie celów dalej niż 5 cali skali gry otrzymuje karę −2. Wersje różnią się możliwością korygowania wady; ustal to z MG.',
  nightmares:
    'Po przebudzeniu wykonujesz odpowiedni test Ducha. Niepowodzenie może oznaczać Zmęczenie. To skutki snu i stanu psychicznego, bez zakładania zjawisk paranormalnych.',
  loyal:
    'Bohater nie zdradza i nie porzuca przyjaciół. Ta lojalność może wymagać poświęceń, ryzyka albo rezygnacji z własnego zysku.',
  vengeful:
    'Bohater długo pamięta krzywdy i dąży do wyrównania rachunków. Wersja poważna może skłaniać go nawet do zabójstwa dla zemsty.',
  habit:
    'Nawyk obniża Charyzmę o 1. W wersji poważnej brak zaspokojenia nałogu może prowadzić do testów i narastających konsekwencji Wyczerpania. Opisz nawyk i ustal jego realne znaczenie z MG.',
  'all-thumbs':
    'Otrzymujesz −2 do Reperowania. Wynik 1 na kości umiejętności podczas używania urządzenia może oznaczać jego awarię, niezależnie od Kości Figury.',
  cautious:
    'Bohater waha się, planuje i unika niepotrzebnego ryzyka, także wtedy, gdy liczy się czas. Nie daje to stałej premii do testów obronnych.',
  pacifist:
    'W drobnej wersji postać unika przemocy poza obroną własną. W poważnej nie chce krzywdzić żywych istot. Ustal z MG granice i sposób działania w scenach zagrożenia.',
  wanted:
    'Bohater jest ścigany. Rodzaj zarzutów, zasięg pościgu i grożąca kara decydują o drobnej lub poważnej wersji. Opisz, kto go szuka i dlaczego.',
  deaf: 'Drobna wersja daje −2 do Spostrzegawczości przy nasłuchiwaniu. Poważna oznacza całkowitą głuchotę i automatyczną porażkę w czynnościach wymagających słuchu.',
  ritual:
    'Na początku walki bohater traci czas na ustalone rytualne zachowanie. W poważnej wersji dodatkowo narzuca sobie szczególne postępowanie wobec pokonanych. Jest to zachowanie psychologiczne, nie magiczny rytuał.',
  'weak-willed':
    'Postać otrzymuje −2 przy opieraniu się Próbom woli. W Exilium nie są używane zawarte w podręczniku odniesienia do mocy nadnaturalnych.',
  'death-wish':
    'Bohater chce dokonać czegoś przed śmiercią, a następnie niewiele dba o własne przetrwanie. Opisz cel i uzgodnij z MG, jak ma wpływać na decyzje postaci.',
  blind:
    'Postać ma −6 do czynności wymagających wzroku oraz −2 do interakcji społecznych, w których nie widzi reakcji rozmówcy. Otrzymuje dodatkową darmową przewagę. Ewentualne technologiczne kompensacje ustal z MG.',
  sleepy:
    'Postać ma −4 do Spostrzegawczości przy próbie obudzenia się oraz −4 do Wigoru przy zwalczaniu senności. Nie oznacza to stałej kary do wszystkich testów tych cech.',
  delusional:
    'Bohater trwa przy określonym nieprawdziwym przekonaniu. Wersja drobna lub poważna zależy od tego, jak często i jak mocno wpływa ono na jego życie. Opisz przekonanie w historii.',
  stubborn:
    'Bohater upiera się przy swoim stanowisku, nawet gdy inni przedstawiają dobre argumenty. To zobowiązanie do odgrywania, nie premia za opieranie się wpływowi innych.',
  enemy:
    'Postać ma trwałego przeciwnika. Jego siła, zasoby i częstotliwość działań decydują o stopniu zawady. Opisz przeciwnika i powód konfliktu z MG.',
  vow: 'Postać złożyła wiążącą przysięgę. Jej rygor i konsekwencje wyznaczają drobny albo poważny stopień. W Exilium może być osobista, zawodowa lub religijna, bez nadnaturalnego efektu.',
};
export const edgeDescription = (id: string) =>
  edgeDetails[id] ?? edges.find((e) => e.id === id)?.summary ?? '';
export const hindranceDescription = (id: string) =>
  hindranceDetails[id] ?? hindrances.find((h) => h.id === id)?.summary ?? '';
export function edgeRequirements(id: string): string {
  const edge = edges.find((e) => e.id === id);
  if (!edge) return '';
  return [
    ranks[edge.rank],
    ...Object.entries(edge.requirements.attributes ?? {}).map(
      ([key, n]) => `${attributes[key as Attribute]} k${n}`,
    ),
    ...Object.entries(edge.requirements.skills ?? {}).map(
      ([key, n]) => `${skillInfo(key)?.name ?? key} k${n}`,
    ),
    edge.requirements.edge ? (edges.find((e) => e.id === edge.requirements.edge)?.name ?? '') : '',
    edge.requirements.anySkill
      ? `${edge.requirements.anySkill.map((key) => skillInfo(key)?.name).join(' lub ')} k${edge.requirements.anyDie}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export function wealthWarning(id: string): string | null {
  if (!['rich', 'filthy-rich', 'noble'].includes(id)) return null;
  return (
    'W naszej kampanii wszyscy zaczynają jako biedni. Przed wybraniem tej przewagi porozmawiaj z MG i uzyskaj jego zgodę.' +
    (id === 'noble' ? ' Szycha również obejmuje korzyści Bogatego.' : '')
  );
}
