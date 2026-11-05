<script lang="ts">
  import { untrack } from 'svelte';
  import { newItem } from '../rules/model';
  import type { EquipmentDocument, EquipmentRecord } from '../compendium';
  import ItemFields from './ItemFields.svelte';
  let {
    record = null,
    busy = false,
    onsave,
    oncancel,
  }: {
    record?: EquipmentRecord | null;
    busy?: boolean;
    onsave: (value: EquipmentDocument) => void;
    oncancel: () => void;
  } = $props();
  let draft = $state(
    untrack(() => (record ? JSON.parse(JSON.stringify(record.document.item)) : newItem())),
  );
  let category = $state(untrack(() => record?.document.category ?? 'Podróż i przetrwanie'));
  let source = $state(untrack(() => record?.document.source ?? 'Exilium — ustalenia drużyny'));
</script>

<form
  class="panel"
  onsubmit={(event) => {
    event.preventDefault();
    onsave({ category, source, item: draft });
  }}
>
  <fieldset disabled={busy}>
    <div class="section-heading">
      <h2>{record ? 'Edytuj wpis' : 'Nowy wpis kompendium'}</h2>
      <button type="button" class="text-button" onclick={oncancel}>Zamknij edycję</button>
    </div>
    <div class="form-grid">
      <label
        >Kategoria<input
          bind:value={category}
          required
          maxlength="80"
          list="equipment-categories"
        /></label
      ><label>Źródło / ustalenie<input bind:value={source} required maxlength="160" /></label>
    </div>
    <datalist id="equipment-categories"
      >{#each ['Podróż i przetrwanie', 'Narzędzia', 'Odzież', 'Żywność', 'Elektronika', 'Medycyna', 'Amunicja i akcesoria', 'Broń biała', 'Broń krótka', 'Karabiny', 'Broń energetyczna', 'Pancerze i ochrona', 'Cybernetyka'] as value}<option
          >{value}</option
        >{/each}</datalist
    >
    <ItemFields bind:draft />
    <p class="small muted">
      Wpis jest wspólny dla całej drużyny. Nie zmieni przedmiotów już zapisanych na kartach postaci.
      Zapisujemy autora i historię zmian.
    </p>
    <div class="form-actions">
      <button type="button" class="button secondary" onclick={oncancel}>Anuluj edycję</button
      ><button class="button primary">{busy ? 'Zapisywanie…' : 'Zapisz wpis kompendium'}</button>
    </div>
  </fieldset>
</form>

<style>
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
</style>
