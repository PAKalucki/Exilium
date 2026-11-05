<script lang="ts">
  import { onMount } from 'svelte';
  import type { Item } from '../rules/model';
  import { copyEquipment, type EquipmentRecord } from '../compendium';
  import { ruleSearch } from '../content/availability';
  let { onchoose }: { onchoose: (item: Item) => void } = $props();
  let entries = $state<EquipmentRecord[]>([]),
    search = $state(''),
    category = $state(''),
    selected = $state(''),
    loading = $state(false),
    error = $state('');
  let categories = $derived(
    [...new Set(entries.map((e) => e.document.category))].sort((a, b) => a.localeCompare(b, 'pl')),
  );
  let visible = $derived(
    entries.filter(
      (e) =>
        (!category || e.document.category === category) &&
        ruleSearch(e.document.item.name + ' ' + e.document.item.notes).includes(ruleSearch(search)),
    ),
  );
  onMount(() => {
    load();
  });
  async function load() {
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/compendium');
      if (!response.ok)
        throw Error('Nie udało się wczytać kompendium. Możesz nadal wpisać własny przedmiot.');
      entries = await response.json();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }
</script>

<section class="equipment-picker" aria-label="Wybór z kompendium">
  <div class="section-heading">
    <h4>Wybierz z kompendium</h4>
    <button type="button" class="text-button" onclick={load} disabled={loading}
      >Odśwież kompendium</button
    >
  </div>
  <div class="form-grid">
    <label>Szukaj wyposażenia<input bind:value={search} placeholder="Nazwa lub właściwość" /></label
    >
    <label
      >Kategoria wyposażenia<select bind:value={category}
        ><option value="">Wszystkie kategorie</option>{#each categories as value}<option
            >{value}</option
          >{/each}</select
      ></label
    >
  </div>
  <label
    >Przedmiot z kompendium<select
      bind:value={selected}
      disabled={loading}
      onchange={() => {
        const entry = entries.find((e) => e.id === selected);
        if (entry) onchoose(copyEquipment(entry));
      }}
      ><option value="">Własny przedmiot</option>{#each visible as entry}<option value={entry.id}
          >{entry.document.item.name} · {entry.document.item.price} $</option
        >{/each}</select
    ></label
  >
  <p class="small muted">
    {visible.length} propozycji. Dodajesz kopię; późniejsze zmiany kompendium nie zmienią twojego ekwipunku.
    <a class="text-button" href="/compendium" target="_blank" rel="noopener">Otwórz kompendium ↗</a>
  </p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>
