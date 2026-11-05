<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import type { EquipmentDocument, EquipmentRecord, EquipmentEvent } from '../../lib/compendium';
  import { ruleSearch } from '../../lib/content/availability';
  import EquipmentEditor from '../../lib/components/EquipmentEditor.svelte';
  let { data } = $props();
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
    const guard = (event: BeforeUnloadEvent) => {
      if (showEditor || pending || busy) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  });
  let entries = $state<EquipmentRecord[]>(untrack(() => data.entries));
  let search = $state(''),
    category = $state(''),
    archived = $state(false),
    limit = $state(24),
    busy = $state(false),
    error = $state(''),
    message = $state('');
  let editing = $state<EquipmentRecord | null>(null),
    showEditor = $state(false),
    editorKey = $state(0);
  let historyId = $state('');
  let history = $state<EquipmentEvent[]>([]),
    historyTitle = $state('');
  type Payload = { url: string; body: unknown };
  let pending = $state.raw<Payload | null>(null);
  beforeNavigate(({ cancel }) => {
    if (busy || pending) cancel();
    else if (showEditor && !confirm('Odrzucić niezapisany wpis kompendium?')) cancel();
  });
  let categories = $derived(
    [...new Set(entries.map((e) => e.document.category))].sort((a, b) => a.localeCompare(b, 'pl')),
  );
  let visible = $derived(
    entries
      .filter(
        (e) =>
          (archived ? e.status === 'archived' : e.status === 'active') &&
          (!category || e.document.category === category) &&
          ruleSearch(
            [e.document.item.name, e.document.item.notes, e.document.source].join(' '),
          ).includes(ruleSearch(search)),
      )
      .sort((a, b) => a.document.item.name.localeCompare(b.document.item.name, 'pl')),
  );
  const labels = {
    create: 'Dodanie wpisu',
    update: 'Edycja wpisu',
    archive: 'Archiwizacja',
    restore: 'Przywrócenie',
  };
  async function refresh() {
    if (busy || pending) return;
    busy = true;
    error = '';
    try {
      const response = await fetch('/api/compendium?archived=1');
      if (!response.ok) throw Error('Nie udało się odświeżyć listy.');
      entries = await response.json();
      const viewed = entries.find((record) => record.id === historyId);
      if (viewed) await showHistory(viewed);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function edit(record: EquipmentRecord | null) {
    if (busy || pending) return;
    editing = record;
    showEditor = true;
    editorKey++;
    error = '';
    message = '';
  }
  function save(document: EquipmentDocument) {
    if (busy || pending) return;
    pending = editing
      ? {
          url: `/api/compendium/${editing.id}`,
          body: {
            revision: editing.revision,
            commandId: crypto.randomUUID(),
            command: { type: 'update', document },
          },
        }
      : { url: '/api/compendium', body: { commandId: crypto.randomUUID(), document } };
    pending = { url: pending.url, body: JSON.parse(JSON.stringify(pending.body)) };
    deliver();
  }
  async function deliver() {
    if (busy || !pending) return;
    busy = true;
    error = '';
    message = '';
    try {
      const response = await fetch(pending.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.body),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) {
        pending = null;
        if (response.status === 409)
          result.error +=
            ' Twoje zmiany pozostały w formularzu. Zamknij edycję, odśwież listę i otwórz wpis ponownie.';
        throw Error(result.error + (result.details?.[0] ? ` (${result.details[0].message})` : ''));
      }
      const record = result as EquipmentRecord;
      entries = [record, ...entries.filter((e) => e.id !== record.id)];
      pending = null;
      showEditor = false;
      editing = null;
      message = 'Zapisano zmianę kompendium.';
      if (historyId === record.id) await showHistory(record);
    } catch (e) {
      error = pending
        ? 'Brak odpowiedzi serwera. Ponów ten sam zapis; nie utworzy to duplikatu.'
        : (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function change(record: EquipmentRecord, type: 'archive' | 'restore') {
    if (busy || pending || showEditor) return;
    if (
      type === 'archive' &&
      !confirm(
        `Przenieść „${record.document.item.name}” do archiwum kompendium? Karty postaci pozostaną bez zmian.`,
      )
    )
      return;
    pending = {
      url: `/api/compendium/${record.id}`,
      body: { revision: record.revision, commandId: crypto.randomUUID(), command: { type } },
    };
    deliver();
  }
  async function showHistory(record: EquipmentRecord) {
    historyId = record.id;
    try {
      const response = await fetch(`/api/compendium/${record.id}`);
      if (!response.ok) throw Error('Nie udało się wczytać historii.');
      const result = await response.json();
      if (historyId !== record.id) return;
      history = result.history;
      historyTitle = record.document.item.name;
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<svelte:head><title>Kompendium ekwipunku · Exilium</title></svelte:head>
<div class="page-wrap library compendium-page" inert={!mounted}>
  <div class="page-heading">
    <div>
      <p class="eyebrow">WSPÓLNE ZASOBY DRUŻYNY</p>
      <h1>Kompendium <em>ekwipunku</em></h1>
      <p class="muted">
        Każdy zalogowany gracz może dodawać i edytować wpisy. Zmiany są dostępne od razu w kreatorze
        i na kartach.
      </p>
    </div>
    <button
      class="button primary"
      disabled={!mounted || busy || !!pending}
      onclick={() => edit(null)}>+ Dodaj wpis</button
    >
  </div>
  <p class="notice">
    Ceny i dostępność dostosujcie do Exilium. Podręcznikowe wartości są punktem wyjścia; bazowy
    budżet nowej postaci nadal wynosi 400 $. Brak wagi oznacza wartość nieustaloną. Amunicja dodana
    jako osobny przedmiot nie uzupełnia automatycznie zapasu broni.
  </p>
  {#if error}<div class="error" role="alert">
      {error}{#if pending}<button class="button secondary" disabled={busy} onclick={deliver}
          >Ponów zapis kompendium</button
        >{/if}
    </div>{/if}
  {#if message}<p class="success" role="status">{message}</p>{/if}
  {#if showEditor}{#key editorKey}<EquipmentEditor
        record={editing}
        busy={busy || !!pending}
        onsave={save}
        oncancel={() => {
          showEditor = false;
          editing = null;
        }}
      />{/key}{/if}
  <div class="catalog-filters">
    <label
      >Szukaj w kompendium<input
        disabled={!mounted}
        bind:value={search}
        oninput={() => (limit = 24)}
        placeholder="Nazwa, właściwość lub źródło"
      /></label
    >
    <label
      >Kategoria kompendium<select
        disabled={!mounted}
        bind:value={category}
        onchange={() => (limit = 24)}
        ><option value="">Wszystkie kategorie</option>{#each categories as value}<option
            >{value}</option
          >{/each}</select
      ></label
    >
    <label
      >Widok kompendium<select
        disabled={!mounted}
        bind:value={archived}
        onchange={() => (limit = 24)}
        ><option value={false}>Dostępne wpisy</option><option value={true}>Archiwum wpisów</option
        ></select
      ></label
    >
    <button class="button secondary" disabled={!mounted || busy || !!pending} onclick={refresh}
      >Odśwież listę</button
    >
  </div>
  <p class="small muted">
    Znaleziono: {visible.length}. Każdy zakup lub wybór w kreatorze tworzy osobną kopię przedmiotu.
  </p>
  <div class="catalog-grid">
    {#each visible.slice(0, limit) as record (record.id)}{@const item = record.document.item}
      <article class="panel catalog-card">
        <p class="eyebrow">{record.document.category}</p>
        <h2>{item.name}</h2>
        <p>
          <strong>{item.price} $</strong> / szt. · Waga: {item.weight ?? 'nieustalona'} jedn. SW
        </p>
        {#if item.kind === 'weapon'}<p>
            Obrażenia: {item.damage || '—'} · Zasięg: {item.range || '—'} · Pojemność: {item.capacity}
          </p>{:else if item.kind === 'armor'}<p>Pancerz podstawowy: {item.armor}</p>{/if}
        <details>
          <summary>Parametry i opis</summary>
          <p class="prose">{item.notes || 'Brak dodatkowego opisu.'}</p>
          <p class="small">
            Źródło: {record.document.source}<br />Liczba domyślna: {item.quantity}<br />Ostatnia
            zmiana: {record.updatedByName} · {new Date(record.updatedAt).toLocaleString('pl-PL')} · wersja
            {record.revision}
          </p>
        </details>
        <div class="card-actions">
          <button
            class="text-button"
            disabled={busy || !!pending || record.status === 'archived'}
            onclick={() => edit(record)}>Edytuj</button
          ><button class="text-button" onclick={() => showHistory(record)}>Historia</button><button
            class="text-button"
            disabled={busy || !!pending || showEditor}
            onclick={() => change(record, record.status === 'active' ? 'archive' : 'restore')}
            >{record.status === 'active' ? 'Archiwizuj' : 'Przywróć'}</button
          >
        </div>
      </article>
    {/each}
  </div>
  {#if !visible.length}<p class="notice">Brak pasujących wpisów.</p>{/if}
  {#if visible.length > limit}<button class="button secondary" onclick={() => (limit += 24)}
      >Pokaż kolejne wpisy</button
    >{/if}
  {#if historyTitle}<section class="panel catalog-history" aria-label="Historia wpisu kompendium">
      <div class="section-heading">
        <h2>Historia: {historyTitle}</h2>
        <button
          class="text-button"
          onclick={() => {
            historyTitle = '';
            historyId = '';
          }}>Zamknij historię</button
        >
      </div>
      <p class="small muted">Ostatnie 100 zmian. Archiwizacja nie usuwa historii.</p>
      {#each history as event}<details>
          <summary
            >{labels[event.kind]} · {event.actorName} · {new Date(event.date).toLocaleString(
              'pl-PL',
            )}</summary
          >
          <p>
            {event.before ? `${event.before.item.name}: ${event.before.item.price} $ → ` : ''}{event
              .after.item.name}: {event.after.item.price} $
          </p>
          <p>Kategoria: {event.after.category} · Źródło: {event.after.source}</p>
          <p class="prose">{event.after.item.notes}</p>
        </details>{/each}
    </section>{/if}
</div>

<style>
  .catalog-filters {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr auto;
    gap: 16px;
    align-items: end;
    margin: 24px 0;
  }
  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
  .catalog-card h2 {
    font-size: 24px;
    overflow-wrap: anywhere;
  }
  .catalog-card {
    min-width: 0;
  }
  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 18px;
  }
  .prose {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  details {
    margin: 12px 0;
  }
  summary {
    cursor: pointer;
    line-height: 1.6;
  }
  .catalog-history {
    margin-top: 24px;
  }
  @media (max-width: 1100px) {
    .catalog-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .catalog-filters {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 650px) {
    .catalog-grid,
    .catalog-filters {
      grid-template-columns: 1fr;
    }
  }
</style>
