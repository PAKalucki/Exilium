<script lang="ts">
  import type { Item } from '../rules/model';
  let { draft = $bindable() }: { draft: Item } = $props();
</script>

<div class="form-grid">
  <label>Nazwa<input bind:value={draft.name} required maxlength="160" /></label><label
    >Rodzaj przedmiotu<select bind:value={draft.kind}
      ><option value="gear">Sprzęt</option><option value="weapon">Broń</option><option value="armor"
        >Pancerz</option
      ><option value="cybernetic">Kończyna cybernetyczna</option></select
    ></label
  ><label
    >Liczba sztuk<input
      type="number"
      bind:value={draft.quantity}
      min="1"
      max="10000"
      required
    /></label
  ><label
    >Cena za sztukę ($)<input
      type="number"
      bind:value={draft.price}
      min="0"
      max="100000000"
      required
    /></label
  ><label
    >Waga sztuki (jedn. SW)<input
      type="number"
      value={draft.weight ?? ''}
      oninput={(e) =>
        (draft.weight = e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
      min="0"
      step="0.01"
      placeholder="Nieznana"
    /></label
  >
  <div class="checkboxes">
    <label><input type="checkbox" bind:checked={draft.carried} /> Niesiony</label><label
      ><input type="checkbox" bind:checked={draft.equipped} /> Używany / założony</label
    >
  </div>
</div>
{#if draft.kind === 'weapon'}<div class="form-grid">
    <label
      >Obrażenia<input bind:value={draft.damage} placeholder="np. 2k6+1" maxlength="160" /></label
    ><label
      >Zasięg (cale gry)<input
        bind:value={draft.range}
        placeholder="12/24/48"
        maxlength="160"
      /></label
    ><label
      >Pojemność magazynka<input
        type="number"
        bind:value={draft.capacity}
        min="0"
        max="10000"
        required
      /></label
    ><label
      >Załadowane naboje<input
        type="number"
        bind:value={draft.loaded}
        min="0"
        max={draft.capacity}
        required
      /></label
    ><label
      >Zapas amunicji / ogniw<input
        type="number"
        bind:value={draft.reserve}
        min="0"
        max="100000"
        required
      /></label
    ><label
      >Premia do Obrony<input
        type="number"
        bind:value={draft.parry}
        min="-10"
        max="10"
        required
      /></label
    >
  </div>{/if}
{#if draft.kind === 'armor'}<div class="form-grid">
    <label
      >Pancerz podstawowy<input
        type="number"
        bind:value={draft.armor}
        min="0"
        max="100"
        required
      /></label
    ><label
      >Chroniony obszar<select bind:value={draft.coverage}
        ><option value="torso">Korpus</option><option value="head">Głowa</option><option
          value="arms">Ramiona</option
        ><option value="legs">Nogi</option><option value="all">Całe ciało</option></select
      ></label
    >
  </div>
  <p class="small muted">
    Warianty ochrony (np. przeciw pociskom), PP i ograniczenia wpisz w uwagach. Główna Wytrzymałość
    uwzględnia korpus.
  </p>{/if}
{#if draft.kind === 'cybernetic'}<p class="notice">
    Kończyny cybernetyczne są opisowe. Bez ustalonej decyzji MG nie przyznają premii mechanicznych.
  </p>{/if}
<label
  >Uwagi, źródło i właściwości<textarea bind:value={draft.notes} rows="2" maxlength="12000"
  ></textarea></label
>
