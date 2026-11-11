<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import CombatantCard from '../../../lib/components/CombatantCard.svelte';
  import {
    cardInfo,
    combatEventLabels,
    jokerBonus,
    type CombatCommand,
    type CombatView,
  } from '../../../lib/combat';
  import { orderedUnits } from '../../../lib/rules/combat';
  import { characterCategoryLabels } from '../../../lib/rules/model';
  import { effectiveBuild } from '../../../lib/rules/engine';
  let { data } = $props();
  let encounter = $state.raw<CombatView>(untrack(() => data.encounter));
  let mounted = $state(false),
    busy = $state(false),
    refreshing = $state(false),
    error = $state(''),
    message = $state(''),
    lastRead = $state('');
  let pending = $state.raw<{ revision: number; commandId: string; command: CombatCommand } | null>(
    null,
  );
  let selectedCharacter = $state(''),
    selectedUnit = $state(''),
    side = $state<'players' | 'gm'>('players');
  let gmBennies = $state(0),
    tacticianId = $state(''),
    tacticsResult = $state(4),
    tacticCard = $state(''),
    tacticUnit = $state('');
  let tacticMembers = $state<string[]>([]);
  let interruptId = $state(''),
    agility = $state(4),
    opponent = $state(4);
  let adding = $derived(
    data.characters.filter((r) => !encounter.participants.some((p) => p.characterId === r.id)),
  );
  let selected = $derived(adding.find((r) => r.id === selectedCharacter));
  let candidates = $derived(
    encounter.participants.filter((p) =>
      effectiveBuild(p.character.document).edges.some((e) => e.id === 'tactician'),
    ),
  );
  let units = $derived(orderedUnits(encounter));
  let current = $derived(encounter.units.find((u) => u.id === encounter.currentId));
  let active = $derived(encounter.phase === 'active');
  let locked = $derived(!mounted || busy || !!pending);
  let canRun = $derived(encounter.canManage && encounter.phase !== 'finished');
  let readyNext = $derived(
    active &&
      !encounter.awaitingTactics &&
      !encounter.units.some((u) => u.state === 'waiting') &&
      encounter.units.some((u) => u.state !== 'skipped'),
  );
  let privateChoices = $derived(data.characters.some((r) => r.redacted?.length));
  const api = () => `/api/combats/${encounter.id}${data.revealRequested ? '?revealPrivate=1' : ''}`;
  function accept(next: CombatView) {
    encounter = next;
    lastRead = new Date().toLocaleTimeString('pl');
  }
  async function refresh() {
    if (busy || pending || refreshing) return;
    refreshing = true;
    const revisionAtStart = encounter.revision;
    try {
      const response = await fetch(api(), { cache: 'no-store' });
      if (!response.ok)
        throw Error(
          response.status === 401
            ? 'Sesja wygasła. Zaloguj się ponownie.'
            : 'Nie udało się odświeżyć walki.',
        );
      const next = await response.json();
      if (
        !busy &&
        !pending &&
        encounter.revision === revisionAtStart &&
        !document.activeElement?.matches('input,textarea,select')
      ) {
        accept(next);
        error = '';
      }
    } catch (e) {
      error = (e as Error).message || 'Brak połączenia. Wyświetlasz ostatni odczyt.';
    } finally {
      refreshing = false;
    }
  }
  async function deliver(): Promise<boolean> {
    if (!pending || busy) return false;
    busy = true;
    error = '';
    message = '';
    const payload = pending;
    try {
      const response = await fetch(api(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          pending = null;
          error = result.error;
          if (response.status === 409 || response.status === 403) {
            busy = false;
            await refresh();
            error = result.error;
          }
        } else error = result.error + ' Ponów to samo działanie.';
        return false;
      }
      pending = null;
      accept(result);
      message =
        payload.command.type === 'interrupt' && payload.command.agility === payload.command.opponent
          ? 'Remis Zręczności: akcje rozstrzygnijcie jednocześnie.'
          : payload.command.type === 'interrupt' &&
              payload.command.agility < payload.command.opponent
            ? 'Przerywający przegrał: jego tura nastąpi po bieżącej akcji.'
            : 'Zapisano.';
      return true;
    } catch {
      error =
        'Brak potwierdzenia zapisu. Ponów to samo działanie; nie zostanie wykonane podwójnie.';
      return false;
    } finally {
      busy = false;
    }
  }
  async function send(command: CombatCommand) {
    if (locked || !canRun) return false;
    pending = { revision: encounter.revision, commandId: crypto.randomUUID(), command };
    return deliver();
  }
  onMount(() => {
    mounted = true;
    const interval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !document.activeElement?.matches('input,textarea,select')
      )
        refresh();
    }, 3000);
    return () => clearInterval(interval);
  });
  async function add() {
    if (!selectedCharacter) return;
    if (
      await send({
        type: 'add',
        characterId: selectedCharacter,
        side,
        ...(selectedUnit ? { unitId: selectedUnit } : {}),
      })
    )
      selectedCharacter = '';
  }
  function suggestedPool() {
    gmBennies = new Set(
      encounter.units
        .filter((u) => u.side === 'players')
        .flatMap((u) => u.members)
        .map((id) => encounter.participants.find((p) => p.characterId === id)!)
        .filter((p) => p.character.document.category === 'wildCard')
        .map((p) => p.character.ownerId),
    ).size;
  }
</script>

<svelte:head><title>{encounter.name} · Walka · Exilium</title></svelte:head>
<div class="page-wrap combat-page">
  <div class="breadcrumb">
    <a href="/combat">Walka</a><span>/</span><span>{encounter.name}</span>
  </div>
  <header class="combat-heading">
    <div>
      <p class="eyebrow">
        {encounter.phase === 'setup'
          ? 'PRZYGOTOWANIE STARCIA'
          : encounter.phase === 'finished'
            ? 'ZAKOŃCZONA WALKA'
            : 'KOLEJNOŚĆ DZIAŁANIA'}
      </p>
      <h1>{encounter.name}</h1>
      <p class="muted">
        {encounter.participants.length} uczestników · {encounter.units.length} kart inicjatywy
      </p>
    </div>
    <div class="combat-round">
      <span>RUNDA</span><strong>{encounter.round || '—'}</strong><small
        >{encounter.round ? `około ${encounter.round * 6} s` : 'SW PL 2015'}</small
      >
    </div>
  </header>
  <div class="combat-sync" role="status">
    <span class="online-dot"></span>{busy
      ? 'Zapisywanie…'
      : refreshing
        ? 'Odświeżanie…'
        : pending
          ? 'Zapis wymaga ponowienia'
          : `Stan wspólny${lastRead ? ' · ' + lastRead : ''}`}<button
      class="text-button"
      onclick={refresh}
      disabled={locked || refreshing}>Odśwież</button
    >{#if !encounter.canManage}<span class="muted">Tylko do odczytu</span>{/if}
  </div>
  {#if error}<div class="error combat-feedback" role="alert">
      <p>{error}</p>
      {#if pending}<button class="button secondary" disabled={busy} onclick={deliver}
          >Ponów ten sam zapis</button
        >{/if}
    </div>{/if}
  {#if message}<p class="small combat-feedback" role="status">{message}</p>{/if}
  {#if data.admin && (encounter.canReveal || privateChoices || data.revealRequested)}<div
      class="panel combat-private"
    >
      <p>
        {data.revealRequested
          ? 'Prywatne szczegóły uczestników i listy postaci są odkryte w tym widoku administratora.'
          : 'Prywatne szczegóły pozostają ukryte. Aby zarządzać prywatnymi uczestnikami, odkryj je w tym widoku.'}
      </p>
      <a
        class="button secondary"
        href={`/combat/${encounter.id}${data.revealRequested ? '' : '?revealPrivate=1'}`}
        >{data.revealRequested ? 'Ukryj prywatne szczegóły' : 'Odkryj prywatne szczegóły'}</a
      >
    </div>{/if}
  <fieldset class="combat-surface" disabled={!mounted}>
    <div class="combat-layout">
      <div class="combat-board">
        {#if active}<section class="panel combat-turn" aria-label="Bieżąca tura">
            <p class="eyebrow">TERAZ DZIAŁA</p>
            <h2>
              {current?.name ||
                (encounter.awaitingTactics
                  ? 'Ustalenie kart przed rundą'
                  : encounter.units.some((u) => u.state === 'held')
                    ? 'Pozostały akcje wstrzymane'
                    : 'Runda zakończona')}
            </h2>
            {#if current?.card}<span class="action-card" class:red-card={cardInfo(current.card).red}
                >{cardInfo(current.card).label}</span
              >{/if}{#if !current && !encounter.awaitingTactics}<p class="muted">
                Rozdaj następną rundę lub zakończ starcie. Gotowe akcje wstrzymane możesz podjąć
                teraz; zachowują swoje karty przy przejściu do nowej rundy.
              </p>{/if}{#if canRun}<div class="combat-inline-actions">
                {#if encounter.awaitingTactics}<button
                    class="button primary"
                    disabled={locked}
                    onclick={() => send({ type: 'ready' })}
                    >Pomiń kartę Taktyka — rozpocznij tury</button
                  >{/if}<button
                  class="button primary"
                  disabled={locked || !current}
                  onclick={() => send({ type: 'complete' })}>Koniec tury →</button
                ><button
                  class="button secondary"
                  disabled={locked || !current}
                  onclick={() => send({ type: 'hold' })}>Wstrzymaj akcję</button
                ><button
                  class="button secondary"
                  disabled={locked || !readyNext || !encounter.units.length}
                  onclick={() => send({ type: 'nextRound' })}>Rozdaj następną rundę</button
                >
              </div>{/if}
          </section>{/if}
        {#if !units.length}<div class="panel">
            <h2>Dodaj uczestników</h2>
            <p class="muted">
              Wybierz istniejące, zatwierdzone karty postaci. Każda Figura ma własną kartę
              inicjatywy; Blotki mogą działać razem w grupie lub z Figurą kontrolującą sojuszników.
            </p>
          </div>{/if}
        {#each units as unit (unit.id)}
          <section
            class="panel initiative-unit"
            class:current-unit={encounter.currentId === unit.id}
            class:held-unit={unit.state === 'held'}
            aria-label={`Inicjatywa: ${unit.name}`}
          >
            <div class="initiative-heading">
              <div class="action-card" class:red-card={!!unit.card && cardInfo(unit.card).red}>
                {unit.card ? cardInfo(unit.card).label : '—'}
              </div>
              <div>
                <span class="eyebrow"
                  >{unit.side === 'players' ? 'POSTACIE GRACZY / SOJUSZNICY' : 'POSTACIE MG'}</span
                >
                <h2>{unit.name}</h2>
                <p class="small muted">
                  {encounter.phase === 'setup'
                    ? 'Karta po rozpoczęciu walki'
                    : unit.state === 'held'
                      ? jokerBonus(unit, encounter.round)
                        ? 'Joker — działaj w każdym momencie'
                        : 'Wstrzymana akcja — karta pozostaje do chwili działania'
                      : unit.state === 'skipped'
                        ? 'Bez tury: zaskoczenie lub wyeliminowanie'
                        : unit.state === 'done'
                          ? 'Tura zakończona'
                          : encounter.currentId === unit.id
                            ? 'Bieżąca tura'
                            : encounter.resumeIds.includes(unit.id)
                              ? 'Przerwana tura — nastąpi jej wznowienie'
                              : 'Czeka na swoją kartę'}
                </p>
                {#if encounter.simultaneousIds.includes(unit.id)}<p class="notice">
                    Jednoczesne akcje — rozstrzygnij obie, nawet jeśli ktoś zostanie wyeliminowany.
                  </p>{/if}{#if encounter.afterCurrentId === unit.id}<p class="notice">
                    Zadziała po bieżącej akcji.
                  </p>{/if}
              </div>
            </div>
            {#if unit.draws.length > 1 && encounter.canManage}<p class="small muted">
                Rozdane karty: {unit.draws.map((id) => cardInfo(id).label).join(' · ')}. Wybrano
                kartę według przewag reprezentanta.
              </p>{/if}
            {#if canRun && active && unit.state === 'held'}<div class="combat-inline-actions">
                <button
                  class="button secondary"
                  disabled={locked ||
                    encounter.awaitingTactics ||
                    encounter.afterCurrentId === unit.id}
                  onclick={() => send({ type: 'activate', unitId: unit.id })}
                  >{jokerBonus(unit, encounter.round)
                    ? 'Joker — działaj teraz'
                    : 'Działaj w przerwie między akcjami'}</button
                >{#if current && !jokerBonus(unit, encounter.round)}<button
                    class="text-button"
                    disabled={locked}
                    onclick={() => (interruptId = interruptId === unit.id ? '' : unit.id)}
                    >Przerwij bieżącą akcję…</button
                  >{/if}
              </div>
              {#if interruptId === unit.id && current}<form
                  class="combat-interrupt"
                  onsubmit={async (e) => {
                    e.preventDefault();
                    if (await send({ type: 'interrupt', unitId: unit.id, agility, opponent }))
                      interruptId = '';
                  }}
                >
                  <p class="small">
                    Obie strony testują Zręczność. Wyższy wynik działa pierwszy; przy remisie
                    rozstrzygnijcie akcje jednocześnie. Wpisz sumy po wszystkich modyfikatorach.
                  </p>
                  <div class="form-grid">
                    <label
                      >Zręczność przerywającego<input
                        type="number"
                        min="-100"
                        max="100"
                        bind:value={agility}
                        required
                      /></label
                    ><label
                      >Zręczność działającego<input
                        type="number"
                        min="-100"
                        max="100"
                        bind:value={opponent}
                        required
                      /></label
                    >
                  </div>
                  <button class="button secondary" disabled={locked}>Rozstrzygnij kolejność</button>
                </form>{/if}
            {/if}
            {#if canRun && encounter.phase === 'setup'}<form
                class="combat-unit-form"
                onsubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  send({
                    type: 'unit',
                    unitId: unit.id,
                    name: String(form.get('name')),
                    opening: String(form.get('opening')) as 'normal' | 'ambush' | 'surprised',
                    notice: Number(form.get('notice')),
                  });
                }}
              >
                <div class="form-grid">
                  <label
                    >Nazwa grupy<input
                      name="name"
                      value={unit.name}
                      maxlength="160"
                      required
                    /></label
                  ><label
                    >Pierwsza runda<select name="opening" value={unit.opening}
                      ><option value="normal">Normalna inicjatywa</option><option value="ambush"
                        >Inicjuje zasadzkę — akcja wstrzymana</option
                      ><option value="surprised">Zaskoczony — test Spostrzegawczości</option
                      ></select
                    ></label
                  ><label
                    >Suma Spostrzegawczości po modyfikatorach<input
                      name="notice"
                      type="number"
                      min="-100"
                      max="100"
                      value={unit.notice}
                      required
                    /></label
                  >
                </div>
                <p class="small muted">
                  Reprezentant inicjatywy: {encounter.participants.find(
                    (p) => p.characterId === unit.leaderId,
                  )?.character.document.name}. Jego przewagi określają dobieranie kart grupy.
                </p>
                <button class="button secondary" disabled={locked}>Zapisz ustawienia grupy</button>
              </form>{/if}
            {#each unit.members as member (member)}
              {@const p = encounter.participants.find((p) => p.characterId === member)!}
              <CombatantCard participant={p} {unit} {encounter} busy={locked} {send} />
              {#if canRun}<button
                  class="text-button combat-remove"
                  disabled={locked || encounter.currentId === unit.id}
                  onclick={() => {
                    if (
                      confirm(
                        `Usunąć ${p.character.document.name} z tego starcia? Stany na karcie postaci pozostaną zapisane.`,
                      )
                    )
                      send({ type: 'remove', characterId: member });
                  }}>Usuń ze starcia: {p.character.document.name}</button
                >{/if}
            {/each}
          </section>
        {/each}
      </div>
      <aside class="combat-sidebar">
        {#if canRun}<section class="panel">
            <h2>Dodaj postać</h2>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <label
                >Karta postaci<select
                  bind:value={selectedCharacter}
                  disabled={locked}
                  required
                  onchange={(event) => {
                    if (
                      adding.find((r) => r.id === event.currentTarget.value)?.document.category ===
                      'wildCard'
                    )
                      selectedUnit = '';
                  }}
                  ><option value="">Wybierz postać…</option>{#each adding as character}<option
                      value={character.id}
                      >{character.document.name} · {characterCategoryLabels[
                        character.document.category
                      ]}{character.redacted?.length ? ' · szczegóły prywatne' : ''}</option
                    >{/each}</select
                ></label
              ><label
                >Kontrolujący<select bind:value={side} disabled={locked || !!selectedUnit}
                  ><option value="players">Gracz / sojusznicy graczy</option><option value="gm"
                    >MG</option
                  ></select
                ></label
              >{#if encounter.phase === 'setup'}<label
                  >Grupa inicjatywy<select
                    bind:value={selectedUnit}
                    disabled={locked || selected?.document.category === 'wildCard'}
                    onchange={() => {
                      const u = encounter.units.find((u) => u.id === selectedUnit);
                      if (u) side = u.side;
                    }}
                    ><option value="">Własna karta / nowa grupa</option
                    >{#each encounter.units as unit}<option value={unit.id}>{unit.name}</option
                      >{/each}</select
                  ></label
                >{/if}{#if selected?.redacted?.length}<p class="notice">
                  Odkryj prywatne szczegóły przed dodaniem tej postaci.
                </p>{/if}<button
                class="button secondary"
                disabled={locked || !selectedCharacter || !!selected?.redacted?.length}
                >Dodaj do walki</button
              >
            </form>
            <p class="small muted">
              Każda karta postaci występuje raz. Kolejnych przeciwników utwórz jako kopie Blotki.
              Posiłki dodane w trakcie walki otrzymają kartę w następnej rundzie.
            </p>
          </section>{/if}
        {#if canRun && encounter.phase === 'setup'}<section class="panel combat-start">
            <h2>Rozpocznij walkę</h2>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                send({ type: 'start', gmBennies, tacticianId: tacticianId || null, tacticsResult });
              }}
            >
              <label
                >Początkowa pula fuksów MG<input
                  type="number"
                  min="0"
                  max="10000"
                  bind:value={gmBennies}
                  required
                /></label
              ><button class="text-button" type="button" onclick={suggestedPool}
                >Po jednym fuksie na gracza</button
              >
              <p class="small muted">
                Pula jest wspólna dla BNów. Osobiste Fuksy pozostają na kartach; Figura MG
                rozpoczyna sesję z dwoma osobistymi fuksami.
              </p>
              <label
                >Taktyk — jeden na starcie<select bind:value={tacticianId}
                  ><option value="">Bez Taktyka</option>{#each candidates as candidate}<option
                      value={candidate.characterId}>{candidate.character.document.name}</option
                    >{/each}</select
                ></label
              >{#if tacticianId}<label
                  >Suma testu Wiedzy (Strategia)<input
                    type="number"
                    min="-100"
                    max="100"
                    bind:value={tacticsResult}
                    required
                  /></label
                >
                <p class="small muted">
                  Sukces i każde przebicie odkładają kartę poza talię do końca walki.
                </p>{/if}<button
                class="button primary"
                disabled={locked || !encounter.participants.length}>Rozdaj pierwszą rundę</button
              >
            </form>
          </section>{/if}
        {#if active}<section class="panel">
            <p class="eyebrow">WSPÓLNA PULA</p>
            <h2>Fuksy MG <span class="combat-pool">{encounter.gmBennies}</span></h2>
            {#if canRun}<div class="combat-inline-actions">
                <button
                  class="button secondary"
                  aria-label="Wydaj fuksa z puli MG"
                  disabled={locked || !encounter.gmBennies}
                  onclick={() => send({ type: 'gmBenny', delta: -1 })}>−1</button
                ><button
                  class="button secondary"
                  aria-label="Dodaj fuksa do puli MG"
                  disabled={locked}
                  onclick={() => send({ type: 'gmBenny', delta: 1 })}>+1</button
                >
              </div>{/if}
            <p class="small muted">
              Blotki nie mają własnych fuksów. Pula dotyczy sesji; jej niewykorzystane znaczniki nie
              przechodzą do kolejnej sesji.
            </p>
          </section>{/if}
        {#if active && encounter.canManage && encounter.reserve.length}<section class="panel">
            <h2>Karty Taktyka</h2>
            <p class="small muted">
              Jedna karta dla sojusznika na początku rundy. Niewykorzystane karty pozostają poza
              tasowaniem. Możesz odłączyć Blotki od Figury i przydzielić im osobną kartę na tę
              rundę.
            </p>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                send({
                  type: 'tactic',
                  unitId: tacticUnit,
                  card: tacticCard,
                  ...(tacticMembers.length ? { memberIds: tacticMembers } : {}),
                });
              }}
            >
              <label
                >Karta z rezerwy<select bind:value={tacticCard} required
                  ><option value="">Wybierz…</option>{#each encounter.reserve as card}<option
                      value={card}>{cardInfo(card).label}</option
                    >{/each}</select
                ></label
              ><label
                >Sojusznicza grupa<select
                  bind:value={tacticUnit}
                  required
                  onchange={() => (tacticMembers = [])}
                  ><option value="">Wybierz…</option
                  >{#each encounter.units.filter((u) => u.card && u.cardRound === encounter.round) as unit}<option
                      value={unit.id}>{unit.name}</option
                    >{/each}</select
                ></label
              >
              {#if (encounter.units.find((u) => u.id === tacticUnit)?.members.length ?? 0) > 1}<fieldset
                  class="combat-tactic-members"
                >
                  <legend>Odłącz Blotki na tę rundę (opcjonalnie)</legend>{#each encounter.units
                    .find((u) => u.id === tacticUnit)!
                    .members.filter((id) => encounter.participants.find((p) => p.characterId === id)?.character.document.category === 'extra') as id}<label
                      class="check-label"
                      ><input
                        type="checkbox"
                        bind:group={tacticMembers}
                        value={id}
                      />{encounter.participants.find((p) => p.characterId === id)!.character
                        .document.name}</label
                    >{/each}
                  <p class="small muted">
                    Bez zaznaczeń kartę otrzyma cała grupa. Po działaniu odłączone Blotki wrócą do
                    pierwotnej grupy w następnej rundzie.
                  </p>
                </fieldset>{/if}<button
                class="button secondary"
                disabled={locked ||
                  !encounter.awaitingTactics ||
                  !!encounter.actions ||
                  encounter.tacticUsedRound === encounter.round}>Przekaż kartę</button
              >
            </form>
          </section>{/if}
        <details class="panel combat-rules">
          <summary>Zasady kolejności · 2015</summary>
          <p>
            As do dwójki; przy remisie pik, kier, karo, trefl. Każda Figura ma własną kartę, Blotki
            mogą działać na wspólnej. Błyskawiczny refleks dobiera przy 5 lub mniej, po wyborze kart
            Opanowanego (2) albo Wyjątkowo opanowanego (3).
          </p>
          <p>
            Joker pozwala działać w dowolnej chwili i daje +2 do testów współczynników oraz obrażeń
            tylko w rundzie rozdania. Po tej rundzie talia jest tasowana; zachowane karty i rezerwa
            Taktyka pozostają poza nią.
          </p>
          <p>
            Wstrzymana akcja zachowuje kartę w następnej rundzie. „Działaj w przerwie” wybierz
            między deklarowanymi akcjami; przy przerwaniu trwającej akcji obie strony testują
            Zręczność. Wyższy wynik działa pierwszy, remis oznacza jednoczesność. Wstrzymujący w
            Szoku musi działać po turze innej postaci.
          </p>
          <p>
            Inicjujący zasadzkę zaczyna ze wstrzymaną akcją; zaskoczony dostaje kartę w pierwszej
            rundzie tylko po udanym teście Spostrzegawczości. Rzuty, deklaracje, sytuacyjne
            modyfikatory, leczenie i skutki wyeliminowania rozstrzygacie przy stole.
          </p>
          <p class="small muted">
            Podręcznik PL 2015, s. 29, 33, 35, 69–75. Obrona, Pełna obrona i Desperacki atak
            wygasają przy następnej akcji; pozycję leżącą usuń przy wstaniu.
          </p>
        </details>
        <details class="panel">
          <summary>Historia starcia</summary>
          <ol class="combat-history">
            {#each encounter.history as event}<li>
                <b>{combatEventLabels[event.kind] || event.kind}</b><small
                  >Runda {event.round} · {new Date(event.date).toLocaleTimeString('pl')}</small
                >
              </li>{/each}
          </ol>
        </details>
        {#if canRun}<button
            class="button secondary combat-finish"
            disabled={locked}
            onclick={() => {
              if (
                confirm(
                  'Zakończyć starcie? Jego zapis pozostanie do odczytu, a stany na kartach postaci zostaną zachowane.',
                )
              )
                send({ type: 'finish' });
            }}>Zakończ starcie</button
          >{/if}
        {#if encounter.phase === 'finished'}<p class="notice">
            Starcie zakończone. Stany wyświetlane przy uczestnikach pochodzą z aktualnych kart
            postaci.
          </p>{/if}
      </aside>
    </div>
  </fieldset>
</div>
