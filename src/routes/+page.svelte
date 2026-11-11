<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { rankName, totalXp, derived as calculateStats } from '../lib/rules/engine';
  import { portraitUrl } from '../lib/portraits';
  import { characterCategoryLabels, type CharacterCategory } from '../lib/rules/model';
  import heroLarge from '../lib/assets/exilium-hero-1536.webp';
  import heroSmall from '../lib/assets/exilium-hero-768.webp';
  let { data } = $props();
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });
  let name = $state(''),
    creating = $state(false),
    error = $state(''),
    lifecycleBusy = $state(''),
    lifecycleMessage = $state(''),
    lifecycleError = $state(''),
    showArchived = $state(false),
    ownerFilter = $state('all');
  let categoryFilter = $state<'all' | CharacterCategory>('all');
  let newCategory = $state<CharacterCategory>('wildCard');
  let owners = $derived(
    Array.from(new Map(data.characters.map((c) => [c.ownerId, c.ownerName])), ([id, name]) => ({
      id,
      name,
    })).sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.id.localeCompare(b.id)),
  );
  let characters = $derived(
    data.characters.filter(
      (c) =>
        (showArchived ? c.status === 'archived' : c.status !== 'archived') &&
        (categoryFilter === 'all' || c.document.category === categoryFilter) &&
        (ownerFilter === 'all' || (ownerFilter === 'mine' ? c.isOwner : c.ownerId === ownerFilter)),
    ),
  );
  async function create() {
    if (!name.trim() || creating || lifecycleBusy) return;
    creating = true;
    error = '';
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category: newCategory }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await goto(`/characters/${result.id}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      creating = false;
    }
  }
  async function changeArchiveStatus(character: (typeof data.characters)[number]) {
    if (!mounted || lifecycleBusy || creating || !character.canEdit || character.redacted?.length)
      return;
    const restoring = character.status === 'archived';
    if (
      !restoring &&
      !confirm(
        `Przenieść „${character.document.name}” do archiwum? Postać zniknie z bieżącej listy. Przywrócisz ją w zakładce Archiwum.`,
      )
    )
      return;
    lifecycleBusy = character.id;
    lifecycleMessage = '';
    lifecycleError = '';
    try {
      const response = await fetch(`/api/characters/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: character.revision,
          commandId: crypto.randomUUID(),
          command: { type: restoring ? 'restore' : 'archive' },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Nie udało się zmienić statusu postaci.');
      lifecycleMessage = restoring
        ? `Przywrócono postać „${character.document.name}”.`
        : `Przeniesiono postać „${character.document.name}” do archiwum. Możesz ją stamtąd przywrócić.`;
    } catch (e) {
      lifecycleError =
        e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError')
          ? 'Nie udało się potwierdzić zmiany. Sprawdź połączenie i odśwież listę.'
          : (e as Error).message;
    } finally {
      try {
        await invalidateAll();
      } catch {
        lifecycleError = 'Nie udało się odświeżyć listy. Sprawdź połączenie i odśwież stronę.';
      }
      lifecycleBusy = '';
    }
  }
</script>

{#if !data.user}
  <section class="landing page-wrap">
    <div class="landing-copy">
      <p class="eyebrow"><span class="tiny-line"></span> DWIE GWIAZDY. JEDNA HISTORIA.</p>
      <h1>Świat nie jest<br />łaskawy.<br /><em>Ty nie musisz być.</em></h1>
      <p class="lead">
        Pustkowia Exilium czekają. Stwórz bohatera, miej swoją kartę pod ręką i zobacz, dokąd
        zaprowadzi cię następna sesja.
      </p>
      {#if data.loginError}<p class="error" role="alert">{data.loginError}</p>{/if}
      {#if data.authReady}<a class="button primary" href="/auth/discord"
          >Zaloguj przez Discord <span aria-hidden="true">↗</span></a
        >{:else}<div class="notice">
          Archiwum czeka na konfigurację logowania Discord przez gospodarza.
        </div>{/if}
      {#if data.developmentLogin}<form action="/auth/dev" method="POST" class="development-login">
          <input type="hidden" name="player" value="a" /><button class="button secondary"
            >Wejdź do lokalnego podglądu</button
          >
        </form>{/if}
      <p class="small muted">Twoja postać. Twoje decyzje. Twoja historia.</p>
    </div>
    <div class="frontier-art">
      <img
        src={heroLarge}
        srcset={`${heroSmall} 768w, ${heroLarge} 1536w`}
        sizes="(max-width: 760px) 100vw, 50vw"
        decoding="async"
        alt="Osada Exilium pośród czerwonych kanionów pod dwoma słońcami"
        width="1536"
        height="1024"
        fetchpriority="high"
      />
      <span class="frontier-caption">EXILIUM<small>KAŻDA HISTORIA ZOSTAWIA ŚLAD</small></span>
    </div>
  </section>
  <div class="landing-features page-wrap">
    <div>
      <span>01 / KONCEPCJA</span>
      <h3>Człowiek pośród piasków</h3>
      <p>Od mechanika karawan po łowcę nagród. Zbuduj postać według zasad swojej drużyny.</p>
    </div>
    <div>
      <span>02 / SESJA</span>
      <h3>Wszystko pod ręką</h3>
      <p>Rany, fuksy, amunicja i ekwipunek. Karta, która nadąża za wydarzeniami.</p>
    </div>
    <div>
      <span>03 / ROZWÓJ</span>
      <h3>Każda sesja zostawia ślad</h3>
      <p>Zapisuj doświadczenie, wybieraj rozwinięcia i wracaj do historii swojego bohatera.</p>
    </div>
  </div>
{:else}
  <div class="page-wrap library">
    <div class="page-heading">
      <div>
        <p class="eyebrow">TWÓJ FRAGMENT EXILIUM</p>
        <h1>
          Archiwum <em>postaci</em><span class="heading-count"
            >{characters.length.toString().padStart(2, '0')}</span
          >
        </h1>
        <p class="muted">
          Poznaj historie drużyny albo rozpocznij własną. Karty edytują ich twórcy, MG i
          administrator.
        </p>
      </div>
      <span class="system-stamp">TYLKO LUDZIE.<br />NIEOGRANICZONE HISTORIE.</span>
    </div>
    <div class="library-scene">
      <img
        src={heroLarge}
        srcset={`${heroSmall} 768w, ${heroLarge} 1536w`}
        sizes="(min-width: 1200px) 1140px, 100vw"
        decoding="async"
        alt="Pustynne pogranicze Exilium z warsztatami, karawaną i dwoma słońcami"
        width="1536"
        height="1024"
      /><span>MORZE POPIOŁU / EXILIUM</span>
    </div>
    <div class="library-toolbar">
      <div class="segmented">
        <button
          disabled={!mounted}
          aria-pressed={!showArchived}
          class:chosen={!showArchived}
          onclick={() => (showArchived = false)}>Bieżące postacie</button
        ><button
          disabled={!mounted}
          aria-pressed={showArchived}
          class:chosen={showArchived}
          onclick={() => (showArchived = true)}>Archiwum</button
        >
      </div>
      <div class="library-filters">
        <label class="library-owner-filter">
          Twórca postaci
          <select bind:value={ownerFilter} disabled={!mounted}>
            <option value="all">Wszystkie postacie</option>
            <option value="mine">Moje postacie</option>
            <optgroup label="Wybrany użytkownik">
              {#each owners as owner (owner.id)}
                <option value={owner.id}>{owner.name}</option>
              {/each}
            </optgroup>
          </select>
        </label>
        <label
          >Kategoria postaci<select bind:value={categoryFilter} disabled={!mounted}>
            <option value="all">Wszystkie kategorie</option><option value="wildCard"
              >Figury (Wild Cards)</option
            ><option value="extra">Blotki (Extras)</option>
          </select></label
        >
      </div>
    </div>
    {#if lifecycleError}<p class="error library-feedback" role="alert">{lifecycleError}</p>{/if}
    {#if lifecycleMessage}<p class="notice library-feedback" role="status">
        {lifecycleMessage}
      </p>{/if}
    {#if !characters.length}<p class="notice" role="status">
        Brak postaci pasujących do wybranych filtrów.
      </p>{/if}
    <div class="character-grid">
      {#each characters as character}
        {@const c = character.document}{@const d = {
          ...calculateStats(c),
          ...character.visibleStats,
        }}
        <article class="character-card-entry" aria-label={`Postać: ${c.name}`}>
          <a class="character-card" href={`/characters/${character.id}`}
            ><div class="card-topline">
              <span class:active={character.status === 'active'} class="badge"
                >{character.status === 'draft'
                  ? 'SZKIC'
                  : character.status === 'active'
                    ? 'AKTYWNA'
                    : 'ARCHIWUM'}</span
              ><span class="card-id">EX / {character.id.slice(0, 6).toUpperCase()}</span>
              <span class="character-category">{characterCategoryLabels[c.category]}</span>
            </div>
            <div class="character-monogram" aria-hidden="true">
              {#if c.portraitId}<img
                  class="card-portrait"
                  src={portraitUrl(character.id, c.portraitId)}
                  alt=""
                  width="300"
                  height="137"
                  loading="lazy"
                />{:else}{c.name[0].toUpperCase()}<span>+</span>{/if}
            </div>
            <div class="card-heading">
              <small>{c.profession || 'Niezapisana historia'} · {c.origin || 'Exilium'}</small>
              <h2>{c.name}</h2>
              <p class="small muted">
                Twórca: {character.ownerName}<br />{character.canEdit
                  ? character.isOwner
                    ? 'Twoja karta · możesz edytować'
                    : 'MG / administrator · możesz edytować'
                  : 'Tylko do odczytu'}
              </p>
              {#if c.category !== 'extra' && !character.redacted?.includes('statistics')}<span
                  class="muted small"
                  >{rankName(totalXp(c))} <span class="dot-separator">/</span> {totalXp(c)} PD</span
                >{/if}
            </div>
            <div class="card-stats">
              {#if character.redacted?.includes('statistics')}
                <span>Statystyki ukryte</span>
              {:else}
                <span>OBRONA <b>{d.parry}</b></span><span>WYTRZ. <b>{d.totalToughness}</b></span
                ><span>TEMPO <b>{d.pace}</b></span>{/if}<span class="card-arrow" aria-hidden="true"
                >↗</span
              >
            </div></a
          >
          {#if character.canEdit && !character.redacted?.length}
            <div class="character-card-actions">
              <button
                class="text-button"
                class:danger={character.status !== 'archived'}
                disabled={!mounted || !!lifecycleBusy || creating}
                aria-label={`${character.status === 'archived' ? 'Przywróć' : 'Archiwizuj'} postać ${c.name}`}
                onclick={() => changeArchiveStatus(character)}
                >{lifecycleBusy === character.id
                  ? character.status === 'archived'
                    ? 'Przywracanie…'
                    : 'Archiwizowanie…'
                  : character.status === 'archived'
                    ? 'Przywróć postać'
                    : 'Archiwizuj'}</button
              >
            </div>
          {/if}
        </article>
      {/each}
      {#if !showArchived}<form
          class="new-character-card"
          onsubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <span class="plus-circle" aria-hidden="true">+</span>
          <h2>Nowa historia</h2>
          <p>Stwórz człowieka, którego<br />Exilium jeszcze nie zna.</p>
          {#if data.canCreateExtras}<label
              >Kategoria nowej postaci<select
                bind:value={newCategory}
                disabled={!mounted || creating}
              >
                <option value="wildCard">Figura (Wild Card)</option><option value="extra"
                  >Blotka (Extra) — tylko MG</option
                >
              </select></label
            >{:else}<p class="small muted">Figura (Wild Card)</p>{/if}
          <label class="sr-only" for="new-name">Imię nowej postaci</label><input
            id="new-name"
            placeholder="Imię postaci"
            bind:value={name}
            maxlength="160"
            required
          /><button
            class="button primary"
            disabled={!mounted || creating || !!lifecycleBusy || !name.trim()}
            >{creating ? 'Tworzenie…' : 'Stwórz postać'} <span aria-hidden="true">→</span></button
          >
        </form>{/if}
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}
