<script lang="ts">
  import { goto } from '$app/navigation';
  import { rankName, totalXp, derived as calculateStats } from '../lib/rules/engine';
  import { portraitUrl } from '../lib/portraits';
  let { data } = $props();
  let name = $state(''),
    creating = $state(false),
    error = $state(''),
    showArchived = $state(false);
  let characters = $derived(
    data.characters.filter((c) =>
      showArchived ? c.status === 'archived' : c.status !== 'archived',
    ),
  );
  async function create() {
    if (!name.trim() || creating) return;
    creating = true;
    error = '';
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
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
        src="/images/exilium-hero-v1.png"
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
        <p class="muted">Wróć do swojej historii albo rozpocznij kolejną.</p>
      </div>
      <span class="system-stamp">TYLKO LUDZIE.<br />NIEOGRANICZONE HISTORIE.</span>
    </div>
    <div class="library-scene">
      <img
        src="/images/exilium-hero-v1.png"
        alt="Pustynne pogranicze Exilium z warsztatami, karawaną i dwoma słońcami"
        width="1536"
        height="1024"
      /><span>MORZE POPIOŁU / EXILIUM</span>
    </div>
    <div class="library-toolbar">
      <div class="segmented">
        <button class:chosen={!showArchived} onclick={() => (showArchived = false)}
          >Moje postacie</button
        ><button class:chosen={showArchived} onclick={() => (showArchived = true)}>Archiwum</button>
      </div>
      <span class="small muted">Prywatne archiwum · tylko twoje karty</span>
    </div>
    <div class="character-grid">
      {#each characters as character}
        {@const c = character.document}{@const d = calculateStats(c)}
        <a class="character-card" href={`/characters/${character.id}`}
          ><div class="card-topline">
            <span class:active={character.status === 'active'} class="badge"
              >{character.status === 'draft'
                ? 'SZKIC'
                : character.status === 'active'
                  ? 'AKTYWNA'
                  : 'ARCHIWUM'}</span
            ><span class="card-id">EX / {character.id.slice(0, 6).toUpperCase()}</span>
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
            <span class="muted small"
              >{rankName(totalXp(c))} <span class="dot-separator">/</span> {totalXp(c)} PD</span
            >
          </div>
          <div class="card-stats">
            <span>OBRONA <b>{d.parry}</b></span><span>WYTRZ. <b>{d.totalToughness}</b></span><span
              >TEMPO <b>{d.pace}</b></span
            ><span class="card-arrow" aria-hidden="true">↗</span>
          </div></a
        >
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
          <label class="sr-only" for="new-name">Imię nowej postaci</label><input
            id="new-name"
            placeholder="Imię postaci"
            bind:value={name}
            maxlength="160"
            required
          /><button class="button primary" disabled={creating || !name.trim()}
            >{creating ? 'Tworzenie…' : 'Stwórz postać'} <span aria-hidden="true">→</span></button
          >
        </form>{/if}
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}
