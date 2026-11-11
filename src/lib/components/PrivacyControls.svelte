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
    statistics: 'Ukryj statystyki',
    background: 'Ukryj historię',
    origin: 'Ukryj pochodzenie',
    equipment: 'Ukryj ekwipunek i zasoby',
  };
  const descriptions = {
    statistics:
      'Cechy, umiejętności, współczynniki, przewagi, zawady, stan podczas sesji, PD, rozwinięcia i decyzje MG.',
    background: 'Opowieść o przeszłości postaci.',
    origin: 'Miejsce pochodzenia postaci.',
    equipment: 'Przedmioty, gotówka i kredyty elektroniczne.',
  };
</script>

<section class="panel privacy-controls" aria-label="Prywatność postaci">
  <h3>Prywatność postaci</h3>
  <p class="small muted">
    Każde ustawienie działa niezależnie. Zaznaczone sekcje są ukryte dla pozostałych graczy i
    domyślnie dla administratora, który może je odkryć. Ty i MG zawsze widzicie pełną kartę. Inni
    gracze mogą zapytać o ukryte informacje w grze.
  </p>
  {#each Object.entries(labels) as [key, label]}<label class="privacy-toggle"
      ><input
        type="checkbox"
        aria-label={label}
        aria-describedby={`privacy-${key}-description`}
        {disabled}
        checked={privacy[key as keyof typeof privacy]}
        onchange={(e) => onchange({ ...privacy, [key]: e.currentTarget.checked })}
      /><span
        ><b>{label}</b><small id={`privacy-${key}-description`}
          >{descriptions[key as keyof typeof descriptions]}</small
        ></span
      ></label
    >{/each}
</section>

<style>
  .privacy-controls {
    margin: 1.25rem 0;
  }
  .privacy-toggle {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.7rem;
    margin: 0.7rem 0;
    padding: 0.85rem 1rem;
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .privacy-toggle span {
    display: grid;
    gap: 0.3rem;
  }
  .privacy-toggle small {
    font-weight: 400;
    line-height: 1.6;
    color: var(--muted);
  }
  .privacy-toggle input {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    margin: 0;
  }
</style>
