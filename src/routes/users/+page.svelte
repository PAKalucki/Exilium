<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { roles, roleLabels, type Role } from '../../lib/access';
  import type { User } from '../../lib/server/identity';
  let { data } = $props();
  let users = $state<User[]>(untrack(() => data.users)),
    history = $state(untrack(() => data.history));
  let mounted = $state(false),
    busy = $state(false),
    error = $state(''),
    message = $state('');
  onMount(() => {
    mounted = true;
  });
  async function change(user: User, role: Role, enabled: boolean) {
    if (busy) return;
    if (
      !confirm(
        `Zapisać uprawnienia konta ${user.name}: ${roleLabels[role]}, ${enabled ? 'aktywne' : 'wyłączone'}?`,
      )
    )
      return;
    busy = true;
    error = '';
    message = '';
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          enabled,
          expectedRole: user.role,
          expectedEnabled: !!user.enabled,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      users = result.users;
      history = result.history;
      message = 'Zapisano uprawnienia użytkownika.';
      await invalidateAll();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function refresh() {
    busy = true;
    try {
      const r = await fetch('/api/users');
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      users = v.users;
      history = v.history;
      error = '';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Użytkownicy i role · Exilium</title></svelte:head>
<div class="page-wrap library" inert={!mounted}>
  <div class="page-heading">
    <div>
      <p class="eyebrow">ADMINISTRACJA</p>
      <h1>Użytkownicy <em>i role</em></h1>
      <p class="muted">
        Nowe konta otrzymują rolę Gracza. Tylko administrator zmienia role i dostęp.
      </p>
    </div>
    <button class="button secondary" disabled={!mounted || busy} onclick={refresh}
      >Odśwież użytkowników</button
    >
  </div>
  <p class="notice">
    Gracz tworzy i edytuje własne karty, czyta pozostałe i zgłasza przedmioty. MG zarządza
    wszystkimi kartami i kompendium, w tym zatwierdzaniem wpisów. Administrator dodatkowo zarządza
    kontami. Wyłączenie konta usuwa jego sesje i tokeny API.
  </p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}{#if message}<p
      class="success"
      role="status"
    >
      {message}
    </p>{/if}
  {#each users as user (user.id)}<section
      class="panel user-row"
      aria-label={`Użytkownik ${user.name}`}
    >
      <div>
        <h3>{user.name}</h3>
        <p class="small muted">
          Discord: {user.discordId} · {user.enabled ? 'Aktywne' : 'Wyłączone'}
        </p>
      </div>
      <label
        >Rola użytkownika<select
          disabled={!mounted || busy}
          value={user.role}
          onchange={(e) => change(user, e.currentTarget.value as Role, !!user.enabled)}
          >{#each roles as role}<option value={role}>{roleLabels[role]}</option>{/each}</select
        ></label
      ><button
        class="button secondary"
        disabled={!mounted || busy}
        onclick={() => change(user, user.role, !user.enabled)}
        >{user.enabled ? 'Wyłącz konto' : 'Włącz konto'}</button
      >
    </section>{/each}
  <section class="panel">
    <h3>Historia uprawnień</h3>
    {#each history as event}<details>
        <summary
          >{event.userName} · {event.actorName || 'Konfiguracja wdrożenia'} · {new Date(
            String(event.date),
          ).toLocaleString('pl-PL')}</summary
        >
        <p class="small">{event.before} → {event.after}</p>
      </details>{/each}
  </section>
</div>

<style>
  .user-row {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .user-row > div {
    flex: 1;
    min-width: 200px;
  }
  .user-row select {
    min-width: 160px;
  }
  details {
    margin: 0.7rem 0;
  }
</style>
