<script lang="ts">
  import { archetypes } from '../content/archetypes';
  import { attributes, edges, skillInfo } from '../content/catalog';
  import { applyArchetype } from '../rules/archetypes';
  import { creationBudget } from '../rules/engine';
  import { formatDie } from '../rules/export';
  import { newCharacter, type Character } from '../rules/model';

  let { character = $bindable(), onchange }: { character: Character; onchange: () => void } =
    $props();
  let selectedId = $state(''),
    message = $state(''),
    error = $state('');
  let selected = $derived(archetypes.find((entry) => entry.id === selectedId));
  let budget = $derived(
    selected ? creationBudget({ ...newCharacter(), build: selected.build }) : null,
  );
  let existingCharacter = $derived(
    !!character.legacy || !!character.xp.length || !!character.advances.length,
  );
  const emptyBuild = JSON.stringify(newCharacter().build);

  function apply() {
    if (!selected || existingCharacter) return;
    error = '';
    const currentBuild = JSON.stringify(character.build);
    if (
      currentBuild !== emptyBuild &&
      currentBuild !== JSON.stringify(selected.build) &&
      !confirm(
        'Wczytać archetyp? Zastąpi to cechy, umiejętności, przewagi, zawady i przydział punktów w tym szkicu. Imię, opis, portret, ekwipunek i ustawienia prywatności zostaną zachowane.',
      )
    )
      return;
    try {
      character = applyArchetype(character, selected.id);
      onchange();
      message = `Wczytano archetyp: ${selected.name}. Dobierz zawady, wydaj pozostałe punkty umiejętności i wybierz ekwipunek.`;
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<section class="panel archetype-picker" aria-label="Szybkie tworzenie z archetypu">
  <h3>Zacznij od archetypu</h3>
  <p class="small muted">
    Gotowe cechy, umiejętności i przewagi z Savage Worlds PL 2015 (s. 11–12), dobrane do Exilium:
    ludzie bez mocy nadprzyrodzonych. Możesz je później zmienić albo uzupełnić statystyki
    samodzielnie.
  </p>
  <label>
    Archetyp z podręcznika
    <select
      bind:value={selectedId}
      disabled={existingCharacter}
      oninput={(event) => event.stopPropagation()}
      onchange={(event) => {
        event.stopPropagation();
        message = '';
        error = '';
      }}
    >
      <option value="">Wybierz archetyp…</option>
      {#each archetypes as archetype (archetype.id)}<option value={archetype.id}
          >{archetype.name}</option
        >{/each}
    </select>
  </label>
  {#if existingCharacter}<p class="small muted">
      Archetypy są dostępne dla nowych postaci. Włączono wpisywanie istniejącej karty z podstawą
      rozwoju.
    </p>{/if}
  {#if selected && budget}
    <div class="archetype-preview" aria-label="Podgląd archetypu">
      <p>{selected.description}</p>
      <dl class="archetype-attributes">
        {#each Object.entries(attributes) as [key, label]}<div>
            <dt>{label}</dt>
            <dd>{formatDie(selected.build.attributes[key as keyof typeof attributes])}</dd>
          </div>{/each}
      </dl>
      <h4>Umiejętności</h4>
      <p class="small">
        {Object.entries(selected.build.skills)
          .map(([id, die]) => `${skillInfo(id)?.name || id} ${formatDie(die)}`)
          .join(' · ')}
      </p>
      <h4>Przewagi</h4>
      <p class="small">
        {selected.build.edges
          .map((edge) => edges.find((entry) => entry.id === edge.id)?.name || edge.id)
          .join(' · ')}
      </p>
      {#if selected.note}<p class="notice">{selected.note}</p>{/if}
      <p class="small muted">
        Do wydania: <b>{budget.skillTotal - budget.skillSpent} pkt umiejętności</b>. Wzorzec
        wykorzystuje <b>{budget.spentHindrance} pkt z zawad</b>. Podręcznik zakłada jedną poważną i
        dwie drobne zawady — dobierzesz je w kroku 3. Ekwipunek wybierzesz osobno z budżetu 400 $.
      </p>
      <div class="archetype-actions">
        <button type="button" class="button secondary" disabled={existingCharacter} onclick={apply}
          >Wczytaj archetyp</button
        >
        <span class="small muted">SW PL 2015 · s. {selected.page}</span>
      </div>
    </div>
  {/if}
  {#if message}<p class="small" role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .archetype-picker {
    margin: 1.25rem 0;
  }
  .archetype-picker > label {
    margin-bottom: 0;
  }
  .archetype-preview {
    margin-top: 1rem;
  }
  .archetype-attributes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0;
  }
  .archetype-attributes > div {
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.5rem;
  }
  .archetype-attributes dt {
    font-size: 11px;
    color: var(--muted);
  }
  .archetype-attributes dd {
    margin: 0.4rem 0 0;
    font-weight: 700;
  }
  .archetype-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
</style>
