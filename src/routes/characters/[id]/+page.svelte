<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { beforeNavigate, invalidateAll } from '$app/navigation';
  import {
    attributes,
    edges,
    hindrances,
    skillInfo,
    origins,
    castes,
    professions,
  } from '../../../lib/content/catalog';
  import {
    availableAdvances,
    creationBudget,
    derived as calculateStats,
    previewAdvance,
    rankName,
    totalXp,
    traitValue,
    validateCreation,
  } from '../../../lib/rules/engine';
  import {
    characterCategoryLabels,
    hasAmmunitionCounters,
    type AdvanceChoice,
    type Character,
    type CharacterRecord,
    type Item,
  } from '../../../lib/rules/model';
  import type { Command } from '../../../lib/server/commands';
  import PrivacyControls from '../../../lib/components/PrivacyControls.svelte';
  import Creator from '../../../lib/components/Creator.svelte';
  import ItemEditor from '../../../lib/components/ItemEditor.svelte';
  import Development from '../../../lib/components/Development.svelte';
  import PortraitPicker from '../../../lib/components/PortraitPicker.svelte';
  import PortraitViewer from '../../../lib/components/PortraitViewer.svelte';
  import HelpPopover from '../../../lib/components/HelpPopover.svelte';
  import RuleDescription from '../../../lib/components/RuleDescription.svelte';
  import ReadOnlyCharacter from '../../../lib/components/ReadOnlyCharacter.svelte';
  import { attributeGuides, playerHelp, skillHelp } from '../../../lib/content/help';
  import SettingChoice from '../../../lib/components/SettingChoice.svelte';
  import { originDescriptions, casteDescriptions } from '../../../lib/content/setting';
  let { data } = $props();
  let revealQuery = $derived(data.privateDetailsRevealed ? '?revealPrivate=1' : '');
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  let record = $state.raw<CharacterRecord>(untrack(() => data.record)),
    character = $state<Character>(untrack(() => clone(data.record.document)));
  let statisticsHidden = $derived(record.redacted?.includes('statistics'));
  let extra = $derived(character.category === 'extra');
  let maxWounds = $derived(extra ? 1 : 3);
  let history = $state(untrack(() => data.history)),
    tab = $state(
      untrack(() =>
        data.record.status === 'draft' &&
        (data.record.document.category !== 'extra' || data.canCreateExtras)
          ? 'creator'
          : 'overview',
      ),
    );
  let mounted = $state(false);
  let busy = $state(false),
    dirty = $state(false),
    online = $state(true),
    message = $state(''),
    conflict = $state(false),
    timer: ReturnType<typeof setTimeout> | undefined;
  type UploadPortrait = { type: 'portrait'; file: File };
  type ClientCommand = Command | UploadPortrait;
  const isTextSave = (command: ClientCommand) =>
    command.type === 'saveDraft' || command.type === 'saveExtra' || command.type === 'profile';
  let actionBusy = $state(false);
  let inFlight: Promise<boolean> | null = null;
  let pending = $state.raw<{ revision: number; commandId: string; command: ClientCommand } | null>(
    null,
  );
  let choice = $state<AdvanceChoice>({
    kind: 'edge',
    target: 'alertness',
    second: '',
    edgeTarget: '',
    note: '',
  });
  let showItem = $state(false),
    editingItem = $state<Item | null>(null),
    moneyDelta = $state(0),
    moneyNote = $state(''),
    currency = $state<'cash' | 'credits'>('cash');
  let rulingCode = $state('narrative'),
    rulingReason = $state(''),
    rulingText = $state(''),
    adjustments = $state(untrack(() => clone(data.record.document.adjustments)));
  let d = $derived(calculateStats(character)),
    xp = $derived(totalXp(character)),
    budget = $derived(creationBudget(character));
  let issues = $derived(
    record.status === 'draft'
      ? validateCreation(character)
      : previewAdvance(character, choice).issues,
  );
  let locked = $derived(
    !data.canEdit ||
      !mounted ||
      actionBusy ||
      !online ||
      conflict ||
      (!!pending && !isTextSave(pending.command)) ||
      record.status === 'archived',
  );
  let managementLocked = $derived(
    !data.canEdit || !mounted || busy || actionBusy || !online || conflict || !!pending,
  );
  const labels: Record<string, string> = {
    privacy: 'Zmiana prywatności',
    saveDraft: 'Zapis szkicu',
    saveExtra: 'Zapis statystyk Blotki',
    combat: 'Walka: zmiana stanów',
    finalize: 'Zatwierdzenie postaci',
    profile: 'Notatki i historia',
    tracker: 'Zmiana licznika',
    condition: 'Zmiana stanu',
    resetSession: 'Nowa sesja',
    money: 'Zmiana funduszy',
    item: 'Zapis ekwipunku',
    removeItem: 'Usunięcie przedmiotu',
    fire: 'Zużycie amunicji',
    reload: 'Przeładowanie',
    xp: 'Zapis doświadczenia',
    advance: 'Rozwinięcie postaci',
    ruling: 'Zapis decyzji MG',
    adjustments: 'Korekta MG',
    archive: 'Archiwizacja',
    restore: 'Przywrócenie',
    undo: 'Cofnięcie ostatniej zmiany',
    portrait: 'Wgranie portretu',
    removePortrait: 'Usunięcie portretu',
  };
  function changed() {
    if (!data.canEdit) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => save(), 700);
  }
  beforeNavigate(({ cancel }) => {
    if (dirty || busy || pending) cancel();
  });
  onMount(() => {
    mounted = true;
    const offline = () => (online = false),
      connected = () => {
        online = true;
        if (dirty && !pending) save();
        else if (!dirty && !pending) refresh(false);
      };
    const focus = () => {
      const editing = document.activeElement?.matches(
        'input, textarea, select, [contenteditable="true"]',
      );
      if (!editing && !dirty && !pending && !busy && !actionBusy) refresh(false);
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty || busy || pending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    online = navigator.onLine;
    window.addEventListener('offline', offline);
    window.addEventListener('online', connected);
    window.addEventListener('focus', focus);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', connected);
      window.removeEventListener('focus', focus);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  });
  async function refresh(discard = true) {
    if (!discard && (dirty || pending || busy || actionBusy)) return;
    if (
      discard &&
      (dirty || pending) &&
      !confirm('Odrzucić lokalne niezapisane zmiany i wczytać kartę z serwera?')
    )
      return;
    if (discard) clearTimeout(timer);
    const startedRevision = record.revision;
    const startedDocument = JSON.stringify(character);
    const startedPending = pending;
    try {
      let result: CharacterRecord;
      if (data.canEdit) {
        const response = await fetch(`/api/characters/${record.id}${revealQuery}`);
        if (!response.ok) throw new Error('Nie udało się odświeżyć karty.');
        result = await response.json();
      } else {
        await invalidateAll();
        result = data.record;
        history = data.history;
      }
      // A refresh started before typing or a save must not replace newer local work.
      if (
        record.revision !== startedRevision ||
        JSON.stringify(character) !== startedDocument ||
        pending !== startedPending ||
        busy ||
        actionBusy ||
        (!discard && dirty)
      )
        return;
      if (
        discard ||
        result.revision !== startedRevision ||
        JSON.stringify(result.document) !== JSON.stringify(record.document)
      ) {
        character = clone(result.document);
        adjustments = clone(result.document.adjustments);
      }
      record = result;
      if (data.canEdit && result.redacted?.length) {
        window.location.reload();
        return;
      }
      dirty = false;
      pending = null;
      conflict = false;
      message = '';
      online = true;
    } catch (e) {
      message = (e as Error).message;
    }
  }
  function deliver(payload: NonNullable<typeof pending>): Promise<boolean> {
    if (inFlight) return inFlight;
    inFlight = performDelivery(payload).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  async function performDelivery(payload: NonNullable<typeof pending>): Promise<boolean> {
    if (!data.canEdit) return false;
    busy = true;
    message = '';
    try {
      const response =
        payload.command.type === 'portrait'
          ? await fetch(`/api/characters/${record.id}/portrait${revealQuery}`, {
              method: 'POST',
              headers: {
                'Content-Type': payload.command.file.type,
                'X-Character-Revision': String(payload.revision),
                'X-Command-Id': payload.commandId,
              },
              body: payload.command.file,
              signal: AbortSignal.timeout(30000),
            })
          : await fetch(`/api/characters/${record.id}${revealQuery}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(15000),
            });
      const result = await response.json();
      if (!response.ok) {
        pending = null;
        if (response.status === 409) conflict = true;
        throw new Error(
          result.error +
            (result.details?.[0]
              ? ` (${result.details[0].field}: ${result.details[0].message})`
              : ''),
        );
      }
      record = result;
      if (result.redacted?.length) {
        pending = null;
        dirty = false;
        window.location.reload();
        return true;
      }
      if (
        payload.command.type === 'saveDraft' ||
        payload.command.type === 'saveExtra' ||
        payload.command.type === 'profile'
      ) {
        const unchanged =
          payload.command.type !== 'profile'
            ? JSON.stringify(character) === JSON.stringify(payload.command.document)
            : Object.entries(payload.command).every(
                ([key, value]) =>
                  key === 'type' ||
                  value === undefined ||
                  character[key as keyof Character] === value,
              );
        // Acknowledge the sent data without rewriting the focused input or its caret.
        // In particular, server trimming must not remove a space between typed words.
        if (unchanged) dirty = false;
        else changed();
      } else {
        character = clone(result.document);
        dirty = false;
      }
      pending = null;
      history = [
        { id: Date.now(), kind: payload.command.type, date: new Date().toISOString() },
        ...history,
      ].slice(0, 80);
      if (payload.command.type === 'finalize') tab = 'overview';
      return true;
    } catch (e) {
      if (e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError'))
        message = 'Brak odpowiedzi serwera. Ponów to samo działanie po odzyskaniu połączenia.';
      else message = (e as Error).message;
      return false;
    } finally {
      busy = false;
    }
  }
  async function save() {
    if (!data.canEdit) return false;
    clearTimeout(timer);
    if (!dirty) return true;
    if (inFlight) return inFlight;
    if (busy || pending || !online || conflict) return false;
    const command: Command =
      record.status === 'draft' && (!extra || data.canCreateExtras)
        ? { type: 'saveDraft', document: clone(character) }
        : extra && data.canCreateExtras
          ? { type: 'saveExtra', document: clone(character) }
          : {
              type: 'profile',
              name: character.name,
              age: character.age,
              origin: character.origin,
              caste: character.caste,
              profession: character.profession,
              affiliation: character.affiliation,
              motivation: character.motivation,
              background: character.background,
              appearance: character.appearance,
              notes: character.notes,
            };
    pending = { revision: record.revision, commandId: crypto.randomUUID(), command };
    return deliver(pending);
  }
  async function flush() {
    clearTimeout(timer);
    if (inFlight && !(await inFlight)) return false;
    if (pending) return false;
    while (dirty) {
      if (!(await save())) return false;
    }
    return true;
  }
  async function send(command: ClientCommand): Promise<boolean> {
    if (!data.canEdit || actionBusy || !online || conflict || (pending && !inFlight)) return false;
    actionBusy = true;
    try {
      if (!(await flush())) return false;
      pending = {
        revision: record.revision,
        commandId: crypto.randomUUID(),
        command: command.type === 'portrait' ? command : clone(command),
      };
      return await deliver(pending);
    } finally {
      actionBusy = false;
    }
  }
  async function itemSave(item: Item, purchase: boolean) {
    if (await send({ type: 'item', item, purchase })) {
      showItem = false;
      editingItem = null;
    }
  }
  async function duplicate() {
    if (!data.canEdit || actionBusy || !online || conflict || (pending && !inFlight)) return;
    actionBusy = true;
    let destination = '';
    try {
      if (!(await flush())) return;
      busy = true;
      const response = await fetch(`/api/characters/${record.id}/duplicate${revealQuery}`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      destination = `/characters/${result.id}`;
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
      actionBusy = false;
    }
    if (destination) window.location.assign(destination);
  }
  async function money() {
    if (await send({ type: 'money', currency, delta: moneyDelta, note: moneyNote })) {
      moneyNote = '';
      moneyDelta = 0;
    }
  }
  async function ruling() {
    if (
      await send({
        type: 'ruling',
        ruling: { code: rulingCode, reason: rulingReason, ruling: rulingText },
      })
    ) {
      rulingReason = '';
      rulingText = '';
    }
  }
  function openRuling(code: string) {
    rulingCode = code;
    tab = 'rulings';
  }
  function archive() {
    if (managementLocked) return;
    if (
      confirm(
        `Przenieść „${character.name}” do archiwum? Postać zniknie z bieżącej listy. Przywrócisz ją w zakładce Archiwum.`,
      )
    )
      send({ type: 'archive' });
  }
</script>

<svelte:head><title>{character.name} · Exilium</title></svelte:head>
<div class="page-wrap character-page">
  <div class="breadcrumb">
    <a href="/">Postacie</a><span>/</span><span>{character.name}</span><span
      class="save-status"
      aria-live="polite"
      role="status"
      ><span class:warning-dot={message || !online || dirty} class="online-dot"></span>{busy
        ? 'Zapisywanie…'
        : !online
          ? 'Brak połączenia'
          : pending
            ? 'Działanie czeka na ponowienie'
            : dirty
              ? 'Niezapisane zmiany'
              : message
                ? 'Zapis wymaga uwagi'
                : !data.canEdit
                  ? 'Tylko do odczytu'
                  : 'Zapisano'}</span
    >
  </div>
  <div class="sheet-heading" class:has-portrait={!!character.portraitId}>
    {#if character.portraitId}<PortraitViewer
        characterId={record.id}
        portraitId={character.portraitId}
        name={character.name}
      />{/if}
    <div class="sheet-identity">
      <p class="eyebrow">
        {character.origin || 'EXILIUM'} <span class="dot-separator">/</span>
        {character.caste || 'CZŁOWIEK'}
      </p>
      <h1>{character.name}</h1>
      <p class="small muted">
        Twórca: {record.ownerName}{data.isOwner
          ? ' · Twoja karta'
          : data.canEdit
            ? ' · Edycja jako MG / administrator'
            : ''}
      </p>
      <p class="muted">
        {character.profession || 'Historia dopiero się zaczyna'}{character.motivation
          ? ` · ${character.motivation}`
          : ''}
      </p>
    </div>
    <div class="sheet-actions">
      <span class="character-category">{characterCategoryLabels[character.category]}</span>
      {#if record.status === 'archived'}<span class="badge">ARCHIWUM</span
        >{:else if record.status === 'draft'}<span class="badge">SZKIC</span
        >{#if data.canEdit && (!extra || data.canCreateExtras)}<button
            class="button primary"
            disabled={locked}
            onclick={() => send({ type: 'finalize' })}>Zatwierdź postać →</button
          >{/if}{:else if !statisticsHidden && !extra}<span class="rank-pill"
          >{rankName(xp)} <span>/ {xp} PD</span></span
        >{/if}<a
        class="button secondary"
        target="_blank"
        rel="noopener"
        href={`/characters/${record.id}/print${revealQuery}`}>Drukuj / PDF ↗</a
      >
      {#if data.canEdit}
        {#if record.status === 'archived'}<button
            class="button primary"
            disabled={managementLocked}
            onclick={() => send({ type: 'restore' })}>Przywróć postać</button
          >
        {:else}<button class="button secondary" disabled={managementLocked} onclick={archive}
            >Archiwizuj postać</button
          >{/if}
      {/if}
    </div>
  </div>
  {#if data.canRevealPrivate}
    <div class="notice" role="note" aria-label="Prywatne szczegóły — administrator">
      {#if data.privateDetailsRevealed}
        Prywatne szczegóły są odkryte w tym widoku administratora.
        <a class="button secondary compact" data-sveltekit-reload href={`/characters/${record.id}`}
          >Ukryj prywatne szczegóły</a
        >
      {:else}
        Prywatne szczegóły są ukryte. Jako administrator możesz je odkryć, aby je przeglądać lub
        edytować.
        <a
          class="button secondary compact"
          data-sveltekit-reload
          data-sveltekit-preload-data="false"
          href={`/characters/${record.id}?revealPrivate=1`}>Odkryj prywatne szczegóły</a
        >
      {/if}
    </div>
  {/if}
  {#if message}<div class="error error-bar" role="alert">
      <span>{message}</span>
      <div>
        {#if pending}<button
            class="button secondary compact"
            disabled={busy || !online}
            onclick={() => pending && deliver(pending)}>Ponów działanie</button
          >{/if}<button class="text-button" disabled={busy} onclick={() => refresh()}
          >Wczytaj zapisane dane</button
        >{#if dirty && !pending && !conflict}<button class="text-button" onclick={save}
            >Ponów zapis</button
          >{/if}
      </div>
    </div>{/if}
  {#if record.status === 'archived'}<div class="notice">
      Ta postać jest w archiwum. Zapisane dane i historia są zachowane.
    </div>{/if}
  {#if !data.canEdit}
    <div class="notice">
      Karta jest widoczna dla wszystkich zalogowanych graczy. Edytować ją może jej twórca, MG lub
      administrator. Twórca: {record.ownerName}.
      <button class="text-button" onclick={() => refresh(false)}>Odśwież kartę</button>
    </div>
    <ReadOnlyCharacter {record} {history} eventLabels={labels} />
  {:else}
    <nav class="sheet-tabs" aria-label="Karta postaci" inert={!mounted}>
      {#if (record.status === 'draft' && !extra) || (extra && data.canCreateExtras)}<button
          class:current={tab === 'creator'}
          onclick={() => (tab = 'creator')}
          >{extra ? 'Statystyki Blotki' : 'Kreator'}
          {#if !extra}<small>{budget.attributeSpent}/{budget.attributeTotal}</small>{/if}</button
        >{/if}<button class:current={tab === 'overview'} onclick={() => (tab = 'overview')}
        >Karta postaci</button
      ><button class:current={tab === 'equipment'} onclick={() => (tab = 'equipment')}
        >Ekwipunek <small>{character.inventory.length}</small></button
      >{#if !extra}<button
          class:current={tab === 'development'}
          onclick={() => (tab = 'development')}
          >Rozwój {#if availableAdvances(character) > 0}<small class="available-badge"
              >{availableAdvances(character)}</small
            >{/if}</button
        >{/if}
      <button class:current={tab === 'notes'} onclick={() => (tab = 'notes')}>Notatki</button
      ><button class:current={tab === 'rulings'} onclick={() => (tab = 'rulings')}
        >Decyzje MG</button
      ><button class:current={tab === 'history'} onclick={() => (tab = 'history')}>Historia</button
      ><button class:current={tab === 'settings'} onclick={() => (tab = 'settings')}
        >Ustawienia</button
      >
    </nav>
    <fieldset class="sheet-body" disabled={locked}>
      {#if tab === 'creator'}<Creator
          bind:character
          canCreateExtras={data.canCreateExtras}
          allowCategoryChange={record.status === 'draft'}
          characterId={record.id}
          onchange={changed}
          onupload={(file) => send({ type: 'portrait', file })}
          onremove={() => send({ type: 'removePortrait' })}
        />
      {:else if tab === 'overview'}
        <div class="overview-layout">
          <div class="main-stats">
            {#if character.appearance}<section class="panel appearance-panel">
                <h3>Wygląd</h3>
                <p>{character.appearance}</p>
              </section>{/if}
            <div class="stat-row">
              {#each [['Obrona', d.parry, 'parry'], ['Wytrzymałość', d.totalToughness, 'toughness'], ['Tempo', d.pace, 'pace'], ['Charyzma', d.charisma, 'charisma']] as [label, value, helpKey]}<div
                  class="stat-tile"
                >
                  <div class="help-heading">
                    <span>{label}</span><HelpPopover help={playerHelp[helpKey as string]} />
                  </div>
                  <strong>{value}</strong><small
                    >{label === 'Wytrzymałość'
                      ? `${d.toughness} + ${d.armor} pancerza`
                      : label === 'Tempo'
                        ? `bieganie k${d.running}`
                        : 'Wartość bieżąca'}</small
                  >
                </div>{/each}
            </div>
            <section class="panel attributes-panel">
              <div class="section-heading">
                <div class="help-heading">
                  <h3>Cechy</h3>
                  <HelpPopover help={playerHelp.attributes} />
                </div>
                <div class="help-heading">
                  {#if extra}<span class="small muted">Blotka · bez indywidualnej Kości Figury</span
                    >{:else}<span class="small muted">Kość Figury: k6</span><HelpPopover
                      help={playerHelp.dice}
                    />{/if}
                </div>
              </div>
              <div class="attribute-display">
                {#each Object.entries(attributes) as [key, label]}<div>
                    <div class="help-heading">
                      <span>{label}</span><HelpPopover
                        help={attributeGuides[key as keyof typeof attributes]}
                      />
                    </div>
                    <b class="die-badge"
                      >{traitValue(d.build, key) > 12
                        ? `k12+${traitValue(d.build, key) - 12}`
                        : `k${traitValue(d.build, key)}`}</b
                    >
                  </div>{/each}
              </div>
            </section>
            <section class="panel">
              <div class="section-heading">
                <div class="help-heading">
                  <h3>Umiejętności</h3>
                  <HelpPopover help={playerHelp.skills} />
                </div>
                <span class="small muted">Niewykupiona: k4−2</span>
              </div>
              <div class="skill-list">
                {#each Object.keys(d.build.skills).sort( (a, b) => (skillInfo(a)?.name || a).localeCompare(skillInfo(b)?.name || b, 'pl') ) as key}<div
                  >
                    <div class="skill-name">
                      <span
                        >{skillInfo(key)?.name}<small>{attributes[skillInfo(key)!.attribute]}</small
                        ></span
                      ><HelpPopover help={skillHelp(key)} />
                    </div>
                    <strong
                      >{traitValue(d.build, key) > 12
                        ? `k12+${traitValue(d.build, key) - 12}`
                        : `k${traitValue(d.build, key)}`}{#if d.skillModifiers[key]}
                        <small class="modifier"
                          >{d.skillModifiers[key] > 0 ? '+' : ''}{d.skillModifiers[key]}</small
                        >{/if}</strong
                    >
                  </div>{/each}{#if !Object.keys(d.build.skills).length}<p class="muted">
                    Umiejętności wybierzesz w kreatorze.
                  </p>{/if}
              </div>
              <p class="small muted">
                Modyfikatory sytuacyjne sprawdź w opisach przewag i zawad. {#if d.build.edges.some((e) => e.id === 'master')}Mistrz:
                  Kość Figury k10 dla wybranych współczynników.{/if}
              </p>
            </section>
            <div class="split-panel">
              <section class="panel">
                <div class="help-heading">
                  <h3>Przewagi</h3>
                  <HelpPopover help={playerHelp.edges} />
                </div>
                {#each d.build.edges as e}<div class="rule-entry">
                    <b>{edges.find((v) => v.id === e.id)?.name}</b>
                    <RuleDescription kind="edge" id={e.id} showTitle={false} />
                  </div>{/each}
              </section>
              <section class="panel">
                <div class="help-heading">
                  <h3>Zawady</h3>
                  <HelpPopover help={playerHelp.hindrances} />
                </div>
                {#each d.build.hindrances as h}<div class="rule-entry">
                    <b
                      >{hindrances.find((v) => v.id === h.id)?.name}
                      <span class="muted small">{h.severity === 1 ? 'drobna' : 'poważna'}</span></b
                    >
                    <RuleDescription kind="hindrance" id={h.id} showTitle={false} />
                  </div>{/each}
              </section>
            </div>
          </div>
          <aside class="session-panel">
            <p class="eyebrow">PODCZAS SESJI</p>
            <h2>Trzymaj rękę<br /><em>na pulsie.</em></h2>
            <div class="tracker-block">
              <div>
                <div class="help-heading">
                  <h3>Rany</h3>
                  {#if !extra}<HelpPopover help={playerHelp.wounds} />{/if}
                </div>
                <span>Kara −{d.woundPenalty}</span>
              </div>
              <div class="tracker-controls">
                <button
                  aria-label="Zmniejsz Rany"
                  disabled={character.conditions.wounds === 0}
                  onclick={() => send({ type: 'tracker', field: 'wounds', delta: -1 })}>−</button
                ><strong>{character.conditions.wounds}<small> / {maxWounds}</small></strong><button
                  aria-label="Zwiększ Rany"
                  disabled={character.conditions.wounds === maxWounds}
                  onclick={() => send({ type: 'tracker', field: 'wounds', delta: 1 })}>+</button
                >
              </div>
            </div>
            <div class="tracker-block">
              <div>
                <div class="help-heading">
                  <h3>Zmęczenie</h3>
                  <HelpPopover help={playerHelp.fatigue} />
                </div>
                <span
                  >{['Brak', 'Zmęczony', 'Wyczerpany', 'Wyeliminowany'][
                    character.conditions.fatigue
                  ]}</span
                >
              </div>
              <div class="tracker-controls">
                <button
                  aria-label="Zmniejsz Zmęczenie"
                  disabled={character.conditions.fatigue === 0}
                  onclick={() => send({ type: 'tracker', field: 'fatigue', delta: -1 })}>−</button
                ><strong>{character.conditions.fatigue}<small> / 3</small></strong><button
                  aria-label="Zwiększ Zmęczenie"
                  disabled={character.conditions.fatigue === 3}
                  onclick={() => send({ type: 'tracker', field: 'fatigue', delta: 1 })}>+</button
                >
              </div>
            </div>
            {#if !extra}<div class="tracker-block bennies-block">
                <div>
                  <div class="help-heading">
                    <h3>Fuksy</h3>
                    <HelpPopover help={playerHelp.bennies} />
                  </div>
                  <span>Na początek sesji: {d.bennies}</span>
                </div>
                <div class="tracker-controls">
                  <button
                    aria-label="Wydaj fuksa"
                    disabled={character.conditions.bennies === 0}
                    onclick={() => send({ type: 'tracker', field: 'bennies', delta: -1 })}>−</button
                  ><strong>{character.conditions.bennies}</strong><button
                    aria-label="Dodaj fuksa"
                    onclick={() => send({ type: 'tracker', field: 'bennies', delta: 1 })}>+</button
                  >
                </div>
              </div>{:else}<p class="small">
                Jedna Rana eliminuje Blotkę. Fuksy przydziela MG ze swojej wspólnej puli.
              </p>{/if}
            <div class="help-heading condition-help">
              <span>Stany postaci</span><HelpPopover help={playerHelp.shaken} /><HelpPopover
                help={playerHelp.incapacitated}
              />
            </div>
            <button
              class:state-on={character.conditions.shaken}
              class="state-toggle"
              aria-pressed={character.conditions.shaken}
              onclick={() =>
                send({ type: 'condition', field: 'shaken', value: !character.conditions.shaken })}
              ><span>Szok</span><span
                >{character.conditions.shaken ? 'TAK' : 'NIE'}
                <span aria-hidden="true">{character.conditions.shaken ? '●' : '○'}</span></span
              ></button
            ><button
              class:state-on={d.incapacitated}
              class="state-toggle"
              aria-pressed={d.incapacitated}
              disabled={extra && character.conditions.wounds > 0}
              onclick={() =>
                send({
                  type: 'condition',
                  field: 'incapacitated',
                  value: !character.conditions.incapacitated,
                })}
              ><span>Wyeliminowanie (Rany)</span><span>{d.incapacitated ? 'TAK' : 'NIE'}</span
              ></button
            >
            <p class="session-penalty">Kara z Ran i Zmęczenia <b>−{d.penalty}</b></p>
            {#if d.incapacitated}<p class="session-warning">
                Postać jest wyeliminowana. Wynik rozstrzygnij przy stole.
              </p>{/if}{#if !extra}<button
                class="button session-reset"
                onclick={() => {
                  if (
                    confirm(
                      'Rozpocząć nową sesję i przywrócić początkową liczbę fuksów? Pozostałe stany pozostaną bez zmian.',
                    )
                  )
                    send({ type: 'resetSession', confirmed: true });
                }}>Nowa sesja ↗</button
              >{/if}
            <p class="small session-footnote">
              Liczniki zapisują się po każdej zmianie. Wyniki testów i odzyskiwanie sił
              rozstrzygacie przy stole.
            </p>
          </aside>
        </div>
      {:else if tab === 'equipment'}
        <div class="section-heading">
          <div>
            <p class="eyebrow">TO, CO ZABIERASZ W DROGĘ</p>
            <h2>Ekwipunek i zasoby</h2>
          </div>
          <button
            class="button primary"
            onclick={() => {
              editingItem = null;
              showItem = true;
            }}>+ Dodaj przedmiot</button
          >
        </div>
        <div class="resource-grid">
          <div class="panel resource">
            <span>GOTÓWKA</span><strong>{character.cash}<small> $</small></strong>
          </div>
          <div class="panel resource">
            <span>KREDYTY ELEKTRONICZNE</span><strong>{character.credits}</strong>
          </div>
          <div class="panel resource">
            <span>NIESIONA WAGA / UDŹWIG</span><strong
              >{d.weightKnown}<small> / {d.capacity}</small></strong
            ><small
              >{d.weightUnknown ? 'Część wag jest nieznana.' : 'Jednostki podręcznika.'}
              {d.encumbrance ? `Przeciążenie co najmniej −${d.encumbrance}.` : ''}</small
            >
          </div>
        </div>
        {#if showItem}<ItemEditor
            item={editingItem}
            {busy}
            onsave={itemSave}
            oncancel={() => {
              showItem = false;
              editingItem = null;
            }}
          />{/if}
        <div class="panel inventory-list">
          {#if !character.inventory.length}<p class="muted">
              Jeszcze nic tu nie ma. Dodaj to, co bierzesz ze sobą.
            </p>{/if}{#each character.inventory as item}<article class="inventory-detail">
              <div class="inventory-heading">
                <div>
                  <span class="eyebrow"
                    >{item.kind === 'weapon'
                      ? 'BROŃ'
                      : item.kind === 'armor'
                        ? 'PANCERZ'
                        : item.kind === 'cybernetic'
                          ? 'CYBERNETYKA'
                          : 'SPRZĘT'}
                    {item.equipped ? ' / UŻYWANY' : ''}</span
                  >
                  <h3>{item.name} {item.quantity > 1 ? `×${item.quantity}` : ''}</h3>
                </div>
                <div class="inline-fields">
                  <button
                    class="text-button"
                    onclick={() => {
                      editingItem = clone(item);
                      showItem = true;
                    }}>Edytuj</button
                  ><button
                    class="text-button"
                    onclick={() => {
                      if (confirm(`Usunąć ${item.name}?`))
                        send({ type: 'removeItem', id: item.id });
                    }}>Usuń</button
                  >
                </div>
              </div>
              {#if item.damage}<p>
                  Obrażenia <b>{item.damage}</b> <span class="dot-separator">/</span> Zasięg {item.range ||
                    '—'}
                </p>{/if}{#if hasAmmunitionCounters(item)}<div class="ammo-controls">
                  {#if item.capacity > 0}<span>AMUNICJA <b>{item.loaded} / {item.capacity}</b></span
                    >{/if}<span>ZAPAS <b>{item.reserve}</b></span>{#if item.capacity > 0}<button
                      class="button secondary compact"
                      disabled={item.loaded === 0}
                      onclick={() => send({ type: 'fire', id: item.id, rounds: 1 })}
                      >Zużyj 1 nabój</button
                    ><button
                      class="button secondary compact"
                      disabled={item.reserve === 0 || item.loaded === item.capacity}
                      onclick={() => send({ type: 'reload', id: item.id })}>Przeładuj</button
                    >{/if}
                </div>{/if}
              <p class="small muted">{item.notes}</p>
              <small class="muted"
                >{item.carried ? 'Niesiony' : 'Przechowywany'} · {item.weight ?? '?'} jedn. / szt.{item.kind ===
                'armor'
                  ? ` · Pancerz ${item.armor}`
                  : ''}</small
              >
            </article>{/each}
        </div>
        <section class="panel">
          <h3>Zapisz zmianę funduszy</h3>
          <form
            class="money-form"
            onsubmit={(e) => {
              e.preventDefault();
              money();
            }}
          >
            <label
              >Rodzaj<select bind:value={currency}
                ><option value="cash">Gotówka ($)</option><option value="credits">Kredyty</option
                ></select
              ></label
            ><label>Zmiana (+/−)<input type="number" bind:value={moneyDelta} required /></label
            ><label
              >Uzasadnienie<input
                bind:value={moneyNote}
                maxlength="160"
                placeholder="Zakup, zapłata, nagroda…"
                required
              /></label
            ><button class="button secondary" disabled={!moneyNote.trim()}>Zapisz zmianę</button>
          </form>
          <p class="small muted">
            Gotówka i kredyty mają osobne salda. Brak automatycznego kursu wymiany.
          </p>
        </section>
      {:else if tab === 'development'}{#if record.status === 'draft'}<div class="notice">
            Najpierw zatwierdź postać w kreatorze. Następnie zapiszesz PD i wydasz rozwinięcia.
          </div>{:else}<Development
            {character}
            bind:choice
            busy={locked}
            oncommand={send}
            onruling={openRuling}
          />{/if}
      {:else if tab === 'notes'}<div class="section-heading">
          <div>
            <p class="eyebrow">WIĘCEJ NIŻ WSPÓŁCZYNNIKI</p>
            <h2>Historia i notatki</h2>
          </div>
        </div>
        <PortraitPicker
          characterId={record.id}
          portraitId={character.portraitId}
          onupload={(file) => send({ type: 'portrait', file })}
          onremove={() => send({ type: 'removePortrait' })}
        />
        <div oninput={changed}>
          <label>Imię<input bind:value={character.name} maxlength="160" /></label>
          <div class="form-grid">
            <label>Wiek<input bind:value={character.age} maxlength="160" /></label>
            <SettingChoice
              label="Pochodzenie"
              bind:value={character.origin}
              options={origins}
              descriptions={originDescriptions}
              help={playerHelp.origin}
              onchange={changed}
            />
            <SettingChoice
              label="Status społeczny"
              bind:value={character.caste}
              options={castes}
              descriptions={casteDescriptions}
              help={playerHelp.caste}
              onchange={changed}
            />
            <SettingChoice
              label="Profesja"
              bind:value={character.profession}
              options={professions}
              help={playerHelp.profession}
              onchange={changed}
            /><label>Afiliacje<input bind:value={character.affiliation} maxlength="160" /></label
            ><label>Motywacja<input bind:value={character.motivation} maxlength="160" /></label>
          </div>
          <label
            >Wygląd (opcjonalnie)<textarea
              bind:value={character.appearance}
              rows="3"
              maxlength="4000"></textarea></label
          ><label
            >Historia postaci<textarea bind:value={character.background} rows="10" maxlength="12000"
            ></textarea></label
          ><label
            >Notatki z sesji<textarea
              bind:value={character.notes}
              rows="12"
              maxlength="12000"
              placeholder="Nazwiska, długi, miejsca i sprawy, których lepiej nie zapomnieć."
            ></textarea></label
          >
        </div>
      {:else if tab === 'rulings'}<div class="section-heading">
          <div>
            <p class="eyebrow">ZASADY WASZEGO STOŁU</p>
            <h2>Decyzje MG</h2>
          </div>
        </div>
        <p class="muted">
          Zapisujesz ustalenie otrzymane od MG. To zapis gracza; nie wymaga osobnego zatwierdzenia w
          aplikacji.
        </p>
        <form
          class="panel"
          onsubmit={(e) => {
            e.preventDefault();
            ruling();
          }}
        >
          <label
            >Czego dotyczy decyzja?<select bind:value={rulingCode}
              ><option value="narrative">Ustalenie opisowe</option
              >{#each issues.filter((i) => !i.waived) as issue}<option value={issue.code}
                  >{issue.message}</option
                >{/each}{#if rulingCode !== 'narrative' && !issues.some((i) => i.code === rulingCode)}<option
                  value={rulingCode}>Wybrana reguła rozwinięcia</option
                >{/if}</select
            ></label
          >
          <div class="form-grid">
            <label
              >Ustalenie MG<input
                bind:value={rulingText}
                required
                minlength="3"
                maxlength="160"
              /></label
            ><label
              >Uzasadnienie / kto ustalił<input
                bind:value={rulingReason}
                required
                minlength="3"
                maxlength="160"
              /></label
            >
          </div>
          <button class="button secondary">Zapisz decyzję</button>
        </form>
        <form
          class="panel"
          onsubmit={(e) => {
            e.preventDefault();
            send({ type: 'adjustments', adjustments });
          }}
        >
          <h3>Jawne korekty współczynników</h3>
          <div class="form-grid four">
            {#each [['parry', 'Obrona'], ['toughness', 'Wytrzymałość'], ['pace', 'Tempo'], ['charisma', 'Charyzma']] as [key, label]}<label
                >{label}<input
                  type="number"
                  bind:value={adjustments[key as 'parry']}
                  min={key === 'pace' ? -6 : -20}
                  max="20"
                  required
                /></label
              >{/each}
          </div>
          <label
            >Uzasadnienie MG<input
              bind:value={adjustments.reason}
              minlength="3"
              maxlength="160"
              required
            /></label
          ><button class="button secondary">Zapisz korekty</button>
        </form>
        {#each character.rulings as r}<div class="panel ruling-entry">
            <span class="eyebrow">DECYZJA MG — ZAPISANA PRZEZ GRACZA</span>
            <h3>{r.ruling}</h3>
            <p>{r.reason}</p>
            <small class="muted">{new Date(r.date).toLocaleString('pl-PL')}</small>
          </div>{/each}
      {:else if tab === 'settings'}<div class="section-heading">
          <div>
            <p class="eyebrow">TWOJA POSTAĆ</p>
            <h2>Ustawienia postaci</h2>
          </div>
        </div>
        <PrivacyControls
          privacy={character.privacy}
          disabled={locked || busy || dirty || !!pending}
          onchange={(privacy) => send({ type: 'privacy', privacy })}
        />
      {:else if tab === 'history'}<div class="section-heading">
          <div>
            <p class="eyebrow">ŚLADY NA PIASKU</p>
            <h2>Historia zmian</h2>
          </div>
          <button
            class="button secondary"
            onclick={() => {
              if (confirm('Cofnąć ostatnią zapisaną zmianę?')) send({ type: 'undo' });
            }}>Cofnij ostatnią zmianę</button
          >
        </div>
        <p class="muted small">
          Cofanie obejmuje wyłącznie ostatnią zmianę. Dzięki temu późniejsze rozwinięcia nie tracą
          swoich wymagań.
        </p>
        <div class="panel">
          {#each history as event}<div class="history-row">
              <span class="history-dot"></span><b>{labels[event.kind] || event.kind}</b><time
                >{new Date(event.date).toLocaleString('pl-PL')}</time
              >
            </div>{/each}{#if !history.length}<p class="muted">
              Historia zacznie się od pierwszej zmiany.
            </p>{/if}
        </div>
        <button class="button secondary" onclick={duplicate}>Utwórz kopię jako szkic</button>
      {/if}
    </fieldset>
    {#if tab === 'settings'}
      <section class="panel" aria-label="Zarządzanie postacią">
        <h3>Zarządzanie postacią</h3>
        <p class="small muted">
          Archiwizacja usuwa postać z bieżącej listy, zachowując jej dane i historię. Przywrócisz ją
          z zakładki Archiwum.
        </p>
        {#if record.status === 'archived'}
          <button
            class="button secondary"
            disabled={managementLocked}
            onclick={() => send({ type: 'restore' })}>Przywróć postać</button
          >
        {:else}
          <button class="button secondary" disabled={managementLocked} onclick={archive}
            >Archiwizuj postać</button
          >
        {/if}
      </section>
    {/if}
  {/if}
</div>
