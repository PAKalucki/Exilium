<script lang="ts">
  import swaggerJs from 'swagger-ui-dist/swagger-ui-bundle.js?url';
  import swaggerCss from 'swagger-ui-dist/swagger-ui.css?url';
</script>

<svelte:head
  ><link rel="preload" as="script" href={swaggerJs} /><link
    rel="preload"
    as="style"
    href={swaggerCss}
  /><title>Swagger · API Exilium</title></svelte:head
>
<div class="page-wrap api-docs">
  <p class="eyebrow">DOKUMENTACJA DLA AUTOMATYZACJI</p>
  <h1>Swagger <em>API</em></h1>
  <p>
    Utwórz token w <a href="/account">Moje konto i API</a>, następnie wybierz <b>Authorize</b> i wklej
    sam token. „Try it out” używa tokena, bez Twojej sesji przeglądarki. Token nie jest zapisywany po
    opuszczeniu lub odświeżeniu dokumentacji.
  </p>
  <p class="notice">
    Operacje zapisu zmieniają prawdziwe kompendium. Zgłoszenia Gracza wymagają zatwierdzenia. Przed
    kolejnym, innym działaniem zmień commandId na nowy UUID; przy ponowieniu tego samego zapisu
    zachowaj go. Nie wpisuj tutaj sekretu aplikacji ani tokena Discord.
  </p>
  <p><a href="/api/openapi.json" target="_blank" rel="noopener">Pobierz OpenAPI JSON ↗</a></p>
  <iframe title="Swagger UI API Exilium" src="/api-docs/ui"></iframe>
</div>

<style>
  .api-docs {
    padding-top: 2rem;
    padding-bottom: 2rem;
  }
  .api-docs > p {
    line-height: 1.7;
  }
  .api-docs a {
    text-decoration: underline;
  }
  iframe {
    border: 1px solid var(--line, #d7d9ce);
    width: 100%;
    min-height: 1400px;
    background: white;
  }
</style>
