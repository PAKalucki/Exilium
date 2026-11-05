<script lang="ts">
  import '../app.css';
  import { APP_VERSION } from '../lib/version';
  let { data, children } = $props();
</script>

<svelte:head
  ><title>Exilium · Archiwum postaci</title><meta
    name="description"
    content="Twoi bohaterowie i ich historie na Exilium."
  /></svelte:head
>
<header class="site-header">
  <a class="brand" href="/"
    ><span class="brand-symbol" aria-hidden="true">E<span></span></span><span
      >EXILIUM<small>ARCHIWUM POSTACI</small></span
    ></a
  >
  <nav aria-label="Główne">
    <a href="/">Postacie</a>{#if data.user}<a href="/compendium">Kompendium</a><a href="/account"
        >Moje konto</a
      >{#if data.user.role === 'admin'}<a href="/users">Użytkownicy</a>{/if}{/if}<span
      class="edition">SAVAGE WORLDS <b>2015</b></span
    >
  </nav>
  <div class="account">
    {#if data.user}<span class="online-dot"></span><span>{data.user.name}</span>
      <form method="POST" action="/auth/logout">
        <button class="text-button" type="submit">Wyloguj</button>
      </form>{:else}<span class="edition">MORZE POPIOŁU / EXILIUM</span>{/if}
  </div>
</header>
{#if data.user}<nav class="compact-navigation" aria-label="Sekcje aplikacji">
    <a href="/">Postacie</a><a href="/compendium">Kompendium</a><a href="/account">Moje konto</a
    >{#if data.user.role === 'admin'}<a href="/users">Użytkownicy</a>{/if}
  </nav>{/if}
<main>{@render children()}</main>
<footer class="site-footer">
  <span>EXILIUM <span aria-hidden="true">/</span> ZAPISZ SWOJĄ HISTORIĘ</span><span
    >Savage Worlds · Edycja Polska 2015 <small class="app-version" aria-label="Wersja aplikacji"
      >v{APP_VERSION}</small
    ></span
  >
</footer>

<style>
  .app-version {
    font-size: 0.65rem;
    margin-left: 0.75rem;
    opacity: 0.65;
    white-space: nowrap;
  }
</style>
