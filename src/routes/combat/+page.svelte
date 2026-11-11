<script lang="ts">
  import { onMount } from 'svelte';
  let { data } = $props();
  let name = $state(''),
    finished = $state(false),
    busy = $state(false),
    mounted = $state(false),
    error = $state('');
  let pending: { name: string; commandId: string } | null = null;
  let records = $derived(
    data.combats.filter((c) => (finished ? c.phase === 'finished' : c.phase !== 'finished')),
  );
  onMount(() => {
    mounted = true;
  });
  async function create() {
    if (busy) return;
    busy = true;
    error = '';
    pending ??= { name: name.trim(), commandId: crypto.randomUUID() };
    try {
      const response = await fetch('/api/combats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) pending = null;
        throw Error(result.error);
      }
      location.href = '/combat/' + result.id;
    } catch (e) {
      error = (e as Error).message || 'Brak połączenia. Ponów zapis.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Walka · Exilium</title></svelte:head>
<div class="page-wrap combat-library">
  <div class="section-heading">
    <div>
      <p class="eyebrow">KARTY NA STÓŁ</p>
      <h1>Panel <em>walki</em></h1>
      <p class="muted">Inicjatywa, tury i stany postaci · Savage Worlds 2015</p>
    </div>
    <span class="badge">54 KARTY / 2 JOKERY</span>
  </div>
  <p class="notice">
    MG lub administrator prowadzi starcie. Gracze śledzą jego przebieg. Rany, Zmęczenie, Szok,
    Wyeliminowanie i osobiste Fuksy zapisują się również na powiązanych kartach postaci.
  </p>
  <div class="segmented combat-list-tabs">
    <button class:active={!finished} onclick={() => (finished = false)}>Bieżące starcia</button
    ><button class:active={finished} onclick={() => (finished = true)}>Zakończone</button>
  </div>
  <div class="combat-list">
    {#each records as record (record.id)}<a
        class="panel combat-list-card"
        href={`/combat/${record.id}`}
        ><span class="eyebrow"
          >{record.phase === 'setup'
            ? 'PRZYGOTOWANIE'
            : record.phase === 'finished'
              ? 'ZAKOŃCZONA'
              : `RUNDA ${record.round}`}</span
        >
        <h2>{record.name}</h2>
        <p>{record.participants} uczestników <span aria-hidden="true">↗</span></p></a
      >{/each}
    {#if !records.length}<p class="muted">
        {finished
          ? 'Nie ma zakończonych starć.'
          : 'Nie ma jeszcze przygotowanych ani trwających starć.'}
      </p>{/if}
  </div>
  {#if data.canManage}<form
      class="panel combat-create"
      onsubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <h2>Nowe starcie</h2>
      <label
        >Nazwa starcia<input
          bind:value={name}
          maxlength="160"
          required
          disabled={busy || !mounted}
          oninput={() => (pending = null)}
          placeholder="Potyczka przy studni"
        /></label
      ><button class="button primary" disabled={!mounted || busy || !name.trim()}
        >{busy ? 'Zapisywanie…' : 'Przygotuj walkę →'}</button
      >{#if error}<p role="alert" class="error">{error}</p>{/if}
    </form>{/if}
</div>
