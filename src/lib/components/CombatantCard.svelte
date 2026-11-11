<script lang="ts">
  import { untrack } from 'svelte';
  import { characterCategoryLabels } from '../rules/model';
  import { derived as calculateStats, effectiveBuild } from '../rules/engine';
  import type { CombatCommand, CombatView, InitiativeUnit } from '../combat';
  import { jokerBonus } from '../combat';
  import { combatParry } from '../rules/combat';
  let {
    participant: p,
    unit,
    encounter,
    busy,
    send,
  }: {
    participant: CombatView['participants'][number];
    unit: InitiativeUnit;
    encounter: CombatView;
    busy: boolean;
    send: (command: CombatCommand) => Promise<boolean>;
  } = $props();
  let record = $derived(p.character),
    c = $derived(record.document),
    d = $derived({ ...calculateStats(c), ...record.visibleStats });
  let hidden = $derived(record.redacted?.includes('statistics'));
  let canEdit = $derived(
    encounter.canManage && encounter.phase === 'active' && record.status === 'active',
  );
  let ownTurn = $derived(encounter.currentId === unit.id);
  let extra = $derived(c.category === 'extra');
  let damage = $state(0),
    toughness = $state(untrack(() => calculateStats(p.character.document).totalToughness)),
    manualToughness = $state(false),
    soaked = $state(0),
    pool = $state<'none' | 'personal' | 'gm'>('none'),
    recovery = $state(4),
    defenseResult = $state(4);
  let notes = $state(untrack(() => p.notes)),
    notesDirty = $state(false);
  let reflexes = $derived(effectiveBuild(c).edges.some((e) => e.id === 'combat-reflexes'));
  $effect(() => {
    if (!manualToughness) toughness = d.totalToughness;
  });
  $effect(() => {
    if (!notesDirty) notes = p.notes;
  });
  function tracker(field: 'wounds' | 'fatigue' | 'bennies', delta: number) {
    return send({
      type: 'tracker',
      characterId: record.id,
      characterRevision: record.revision,
      field,
      delta,
    });
  }
  function condition(field: 'shaken' | 'incapacitated', value: boolean) {
    return send({
      type: 'condition',
      characterId: record.id,
      characterRevision: record.revision,
      field,
      value,
    });
  }
</script>

<article
  class="combatant"
  class:combatant-out={d.incapacitated && !hidden}
  aria-label={`Uczestnik: ${c.name}`}
>
  <div class="combatant-heading">
    <div>
      <span class="eyebrow">{characterCategoryLabels[c.category]}</span>
      <h3>
        <a href={`/characters/${record.id}${encounter.revealed ? '?revealPrivate=1' : ''}`}
          >{c.name} ↗</a
        >
      </h3>
    </div>
    {#if !hidden && d.incapacitated}<span class="badge">WYELIMINOWANIE</span>{/if}
  </div>
  {#if hidden}<p class="notice" role="note" aria-label="Statystyki: ukryte">
      Statystyki i stany ukryte — zapytaj w grze.
    </p>{:else}
    <div class="combatant-stats">
      <span>Obrona <b>{combatParry(d.parry, p)}</b></span><span
        >Wytrzymałość <b>{d.totalToughness}</b></span
      ><span>Tempo <b>{Math.max(1, d.pace - d.woundPenalty)}</b></span><span
        >Kara <b>−{d.penalty}</b></span
      >
    </div>
    {#if jokerBonus(unit, encounter.round)}<p class="combat-joker-note">
        Joker: +2 do testów współczynników i obrażeń w tej rundzie.
      </p>{/if}
    <fieldset class="combatant-controls" disabled={busy || !canEdit}>
      <div class="combat-counters">
        {#each [['wounds', 'Rany', extra ? 1 : 3], ['fatigue', 'Zmęczenie', 3], ...(!extra ? [['bennies', 'Fuksy', 10000]] : [])] as [field, label, max]}
          {@const key = field as 'wounds' | 'fatigue' | 'bennies'}
          <div class="combat-counter">
            <span>{label}</span>
            <div>
              <button
                aria-label={`Zmniejsz ${label}: ${c.name}`}
                disabled={c.conditions[key] === 0}
                onclick={() => tracker(key, -1)}>−</button
              ><b
                >{c.conditions[key]}{#if key !== 'bennies'}<small>/{max}</small>{/if}</b
              ><button
                aria-label={`Zwiększ ${label}: ${c.name}`}
                disabled={c.conditions[key] >= Number(max)}
                onclick={() => tracker(key, 1)}>+</button
              >
            </div>
          </div>
        {/each}
      </div>
      <div class="combat-statuses">
        <button
          class:state-on={c.conditions.shaken}
          aria-pressed={c.conditions.shaken}
          onclick={() => condition('shaken', !c.conditions.shaken)}>Szok</button
        >
        <button
          class:state-on={d.incapacitated}
          aria-pressed={d.incapacitated}
          disabled={(extra && c.conditions.wounds > 0) || c.conditions.fatigue === 3}
          onclick={() => condition('incapacitated', !c.conditions.incapacitated)}
          >Wyeliminowanie</button
        >
        {#each [['prone', 'Leży'], ['defending', 'Obrona +2'], ['wildAttack', 'Desperacki atak']] as [field, label]}
          {@const key = field as 'prone' | 'defending' | 'wildAttack'}
          <button
            class:state-on={p[key]}
            aria-pressed={p[key]}
            onclick={() =>
              send({ type: 'maneuver', characterId: record.id, field: key, value: !p[key] })}
            >{label}</button
          >
        {/each}
      </div>
      {#if p.wildAttack}<p class="small">
          Desperacki atak: Walka i obrażenia wręcz +2, Obrona −2 do następnej akcji.
        </p>{/if}
      {#if p.defending}<p class="small">Obrona +2 do następnej akcji.</p>{/if}
      {#if p.prone}<p class="small">
          Leżący: uwzględnij osłonę przy ostrzale; w zwarciu Obrona 2 i Walka −2. Wstanie kosztuje 2
          cale ruchu.
        </p>{/if}
      {#if c.conditions.shaken && canEdit && !d.incapacitated}
        <div class="combat-recovery">
          <strong>Otrząśnij się z Szoku</strong>
          <p class="small muted">
            W swojej turze test Ducha: 4 wystarcza do normalnego działania. Uwzględnij karę −{d.penalty}{reflexes
              ? ', Zaprawiony w walce +2'
              : ''}{jokerBonus(unit, encounter.round) ? ', Jokera +2' : ''} i ustalenia stołu.
          </p>
          {#if ownTurn && p.recoveryRound !== encounter.round}<form
              onsubmit={(e) => {
                e.preventDefault();
                send({
                  type: 'recover',
                  characterId: record.id,
                  characterRevision: record.revision,
                  result: recovery,
                });
              }}
            >
              <label
                >Suma testu Ducha po modyfikatorach<input
                  type="number"
                  bind:value={recovery}
                  min="-100"
                  max="100"
                  required
                /></label
              ><button class="button secondary">Rozlicz test Ducha</button>
            </form>{:else if p.recoveryRound === encounter.round}<p class="notice">
              Test wykonany. Nadal w Szoku: tylko akcje darmowe, bez biegania. Fuks pozwala
              otrząsnąć się i działać normalnie.
            </p>{:else}<p class="small muted">Test Ducha wykonasz na początku swojej tury.</p>{/if}
          <div class="combat-inline-actions">
            {#if !extra}<button
                class="button secondary"
                disabled={!c.conditions.bennies}
                onclick={() =>
                  send({
                    type: 'unshake',
                    characterId: record.id,
                    characterRevision: record.revision,
                    pool: 'personal',
                  })}>Fuks osobisty → usuń Szok</button
              >{/if}{#if extra || unit.side === 'gm'}<button
                class="button secondary"
                disabled={!encounter.gmBennies}
                onclick={() =>
                  send({
                    type: 'unshake',
                    characterId: record.id,
                    characterRevision: record.revision,
                    pool: 'gm',
                  })}>Fuks MG → usuń Szok</button
              >{/if}
          </div>
        </div>
      {/if}
      {#if p.fullDefense !== null}<p class="small">
          Pełna obrona: wynik {p.fullDefense}, co najmniej zwykła Obrona, do następnej akcji. Bez
          dodatkowych akcji i biegania.
        </p>{/if}
      {#if canEdit}<details class="combat-damage">
          <summary>Pełna obrona</summary>
          <form
            onsubmit={(e) => {
              e.preventDefault();
              send({ type: 'fullDefense', characterId: record.id, result: defenseResult });
            }}
          >
            <label
              >Wynik Walki +2 po wszystkich modyfikatorach<input
                type="number"
                min="-100"
                max="100"
                bind:value={defenseResult}
                required
              /></label
            ><button class="button secondary">Zastosuj pełną obronę</button
            >{#if p.fullDefense !== null}<button
                class="text-button"
                type="button"
                onclick={() => send({ type: 'fullDefense', characterId: record.id, result: null })}
                >Usuń pełną obronę</button
              >{/if}
          </form>
        </details>
        <details class="combat-damage">
          <summary>Rozlicz obrażenia i wyparowanie</summary>
          <p class="small muted">
            Wpisz końcowe obrażenia i efektywną Wytrzymałość po uwzględnieniu pancerza, PP,
            trafienia w lokację i premii. Atak fizyczny: sukces wywołuje Szok, ponowny Szok daje
            Ranę, każde przebicie daje Ranę. Wynik wyparowania rozstrzygnij przed zapisem.
          </p>
          <form
            onsubmit={(e) => {
              e.preventDefault();
              send({
                type: 'damage',
                characterId: record.id,
                characterRevision: record.revision,
                damage,
                toughness,
                soaked,
                pool,
              });
            }}
          >
            <div class="form-grid">
              <label
                >Obrażenia<input
                  type="number"
                  min="0"
                  max="100000"
                  bind:value={damage}
                  required
                /></label
              ><label
                >Efektywna Wytrzymałość<input
                  type="number"
                  min="1"
                  max="100000"
                  bind:value={toughness}
                  oninput={() => (manualToughness = true)}
                  required
                /></label
              ><label
                >Wyparowane Rany<input
                  type="number"
                  min="0"
                  max="25000"
                  bind:value={soaked}
                  required
                /></label
              ><label
                >Fuks na wyparowanie<select bind:value={pool}
                  ><option value="none">Bez wyparowania</option>{#if !extra}<option value="personal"
                      >Osobisty</option
                    >{/if}{#if extra || unit.side === 'gm'}<option value="gm">Pula MG</option
                    >{/if}</select
                ></label
              >
            </div>
            <button class="button secondary">Zastosuj obrażenia do karty</button>
          </form>
        </details>{/if}
    </fieldset>
    {#if canEdit}<form
        class="combat-note-form"
        onsubmit={async (e) => {
          e.preventDefault();
          if (await send({ type: 'notes', characterId: record.id, notes })) notesDirty = false;
        }}
      >
        <label
          >Notatka bojowa<input
            bind:value={notes}
            maxlength="1000"
            oninput={() => (notesDirty = true)}
            disabled={busy}
            placeholder="Broń, pełna obrona, sytuacyjne premie…"
          /></label
        ><button class="button secondary" disabled={busy || !notesDirty}>Zapisz</button>
      </form>{:else if p.notes}<p class="small combat-note">{p.notes}</p>{/if}
    {#if record.status === 'archived'}<p class="notice">
        Karta jest zarchiwizowana. Przywróć ją przed zmianą stanów.
      </p>{/if}
  {/if}
</article>
