<script lang="ts">
  import type { Character } from '../rules/model';
  let {
    privacy,
    disabled = false,
    onchange,
  }: {
    privacy: Character['privacy'];
    disabled?: boolean;
    onchange: (privacy: Character['privacy']) => void;
  } = $props();
  const labels = {
    background: 'Ukryj historię',
    origin: 'Ukryj pochodzenie',
    equipment: 'Ukryj ekwipunek i zasoby',
  };
</script>

<section class="panel privacy-controls" aria-label="Prywatność postaci">
  <h3>Prywatność postaci</h3>
  <p class="small muted">
    Zaznaczone sekcje są ukryte dla pozostałych graczy. Ty, MG i administrator widzicie pełną kartę.
    Inni gracze mogą zapytać o te informacje w grze. Ukrycie ekwipunku obejmuje też gotówkę i
    kredyty; współczynniki walki pozostają widoczne.
  </p>
  {#each Object.entries(labels) as [key, label]}<label class="privacy-toggle"
      ><input
        type="checkbox"
        {disabled}
        checked={privacy[key as keyof typeof privacy]}
        onchange={(e) => onchange({ ...privacy, [key]: e.currentTarget.checked })}
      />{label}</label
    >{/each}
</section>

<style>
  .privacy-controls {
    margin: 1.25rem 0;
  }
  .privacy-toggle {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin: 0.7rem 0;
  }
  .privacy-toggle input {
    width: auto;
  }
</style>
