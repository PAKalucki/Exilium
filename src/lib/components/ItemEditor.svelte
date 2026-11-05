<script lang="ts">
  import { newItem, type Item } from '../rules/model';
  import ItemFields from './ItemFields.svelte';
  import EquipmentPicker from './EquipmentPicker.svelte';
  let {
    item = null,
    busy = false,
    onsave,
    oncancel,
  }: {
    item?: Item | null;
    busy?: boolean;
    onsave: (item: Item, purchase: boolean) => void;
    oncancel: () => void;
  } = $props();
  let draft = $state<Item>(newItem());
  $effect(() => {
    draft = item ? JSON.parse(JSON.stringify(item)) : newItem();
  });
  let purchase = $state(false);
</script>

<form
  class="panel item-editor"
  oninput={(event) => event.stopPropagation()}
  onchange={(event) => event.stopPropagation()}
  onsubmit={(e) => {
    e.preventDefault();
    onsave(draft, purchase);
  }}
>
  <div class="section-heading">
    <h3>{item ? 'Edytuj przedmiot' : 'Dodaj ekwipunek'}</h3>
    <button type="button" class="text-button" onclick={oncancel}>Zamknij ×</button>
  </div>
  {#if !item}<EquipmentPicker
      onchoose={(value) => {
        draft = value;
      }}
    />{/if}
  <ItemFields bind:draft />
  {#if !item}<label class="check-label"
      ><input type="checkbox" bind:checked={purchase} /> Kup za gotówkę (po zatwierdzeniu postaci)</label
    >{/if}
  <div class="form-actions">
    <button type="button" class="button secondary" onclick={oncancel}>Anuluj</button><button
      class="button primary"
      disabled={busy}>Zapisz przedmiot</button
    >
  </div>
</form>
