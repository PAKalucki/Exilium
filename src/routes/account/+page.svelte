<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { roleLabels, type ApiScope } from '../../lib/access';
  let { data } = $props();
  let tokens = $state(untrack(() => data.tokens)),
    name = $state(''),
    days = $state(30),
    read = $state(true),
    write = $state(false),
    secret = $state(''),
    busy = $state(false),
    error = $state(''),
    mounted = $state(false);
  onMount(() => {
    mounted = true;
  });
  async function refresh() {
    const r = await fetch('/api/tokens');
    if (!r.ok) throw Error('Nie udało się wczytać tokenów.');
    tokens = await r.json();
  }
  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    error = '';
    secret = '';
    try {
      const scopes: ApiScope[] = [];
      if (read) scopes.push('read');
      if (write) scopes.push('compendium:write');
      const r = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, days, scopes }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      secret = v.token;
      name = '';
      await refresh();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function revoke(id: string) {
    if (busy || !confirm('Unieważnić ten token API?')) return;
    busy = true;
    error = '';
    try {
      const r = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
      if (!r.ok) throw Error('Nie udało się usunąć tokena.');
      secret = '';
      await refresh();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Moje konto i API · Exilium</title></svelte:head>
<div class="page-wrap library" inert={!mounted}>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{data.user?.name} / {data.user ? roleLabels[data.user.role] : ''}</p>
      <h1>Moje konto <em>i API</em></h1>
    </div>
  </div>
  <p><a href="/api-docs">Swagger — interaktywna dokumentacja API ↗</a></p>
  <p class="notice">
    Token działa z Twoją bieżącą rolą. Odczyt respektuje prywatność kart. Zapis obejmuje kompendium;
    propozycje Gracza czekają na MG lub administratora. Token nie zmienia ról ani kont. Przechowuj
    go jak hasło; po utracie usuń go i utwórz nowy.
  </p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if secret}<section class="panel">
      <h3>Skopiuj token teraz</h3>
      <p>Wartość jest wyświetlana tylko raz. Serwer przechowuje wyłącznie jej skrót.</p>
      <textarea aria-label="Nowy token API" readonly value={secret}></textarea><button
        class="text-button"
        onclick={() => (secret = '')}>Ukryj token</button
      >
    </section>{/if}
  <form class="panel token-form" onsubmit={create}>
    <h3>Nowy token API</h3>
    <label
      >Nazwa tokena<input
        disabled={!mounted || busy}
        required
        maxlength="80"
        bind:value={name}
      /></label
    ><label
      >Ważność (dni)<input
        disabled={!mounted || busy}
        type="number"
        min="1"
        max="90"
        required
        bind:value={days}
      /></label
    ><label class="toggle"
      ><input disabled={!mounted || busy} type="checkbox" bind:checked={read} />Odczyt kart i
      kompendium</label
    ><label class="toggle"
      ><input disabled={!mounted || busy} type="checkbox" bind:checked={write} />Zapis kompendium</label
    ><button class="button primary" disabled={!mounted || busy || (!read && !write)}
      >Utwórz token</button
    >
  </form>
  <section class="panel">
    <h3>Twoje tokeny</h3>
    {#each tokens as token (token.id)}<div class="token-row">
        <div>
          <b>{token.name}</b>
          <p class="small muted">
            {token.scopes.join(', ')} · ważny do {new Date(Number(token.expiresAt)).toLocaleString(
              'pl-PL',
            )} · ostatnie użycie: {token.lastUsedAt
              ? new Date(String(token.lastUsedAt)).toLocaleString('pl-PL')
              : 'brak'}
          </p>
        </div>
        <button
          class="text-button"
          disabled={!mounted || busy}
          onclick={() => revoke(String(token.id))}>Unieważnij</button
        >
      </div>{/each}{#if !tokens.length}<p>Brak tokenów.</p>{/if}
  </section>
  <p class="small muted">
    API: GET /api/me, /api/characters, /api/characters/:id, /api/health, /api/compendium,
    /api/compendium/:id. Zapis: POST /api/compendium oraz /api/compendium/:id. Użyj nagłówka
    Authorization: Bearer TWÓJ_TOKEN. Użyj adresu bieżącej instancji aplikacji.
  </p>
</div>

<style>
  .token-form {
    display: grid;
    gap: 1rem;
    margin: 1.25rem 0;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .toggle input {
    width: auto;
  }
  .token-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid #ddd;
    padding: 1rem 0;
    overflow-wrap: anywhere;
  }
</style>
