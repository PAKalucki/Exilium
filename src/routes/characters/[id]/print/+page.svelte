<script lang="ts">
  import { portraitUrl } from '../../../../lib/portraits';
  let { data } = $props();
  let v = $derived(data.view);
</script>

<svelte:head><title>{v.name} · Karta do druku</title></svelte:head>
<div class="print-toolbar">
  <a class="button secondary" href={`/characters/${data.id}`}>← Wróć do karty</a><button
    class="button primary"
    onclick={() => window.print()}>Drukuj / zapisz PDF</button
  >
</div>
<article class="print-sheet">
  <p class="eyebrow">EXILIUM / SAVAGE WORLDS PL 2015</p>
  {#if v.portraitId}<img
      class="print-portrait"
      src={portraitUrl(data.id, v.portraitId)}
      alt={`Portret: ${v.name}`}
      width="95"
      height="120"
    />{/if}
  <h1>{v.name}</h1>
  <p>{v.description}</p>
  <p><b>{v.advancement}</b></p>
  {#if v.appearance}<section class="print-section">
      <h3>Wygląd</h3>
      <p class="print-text">{v.appearance}</p>
    </section>{/if}
  <section class="print-section">
    <h3>Współczynniki</h3>
    <dl>
      {#each v.stats as [label, value]}<div>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>{/each}
    </dl>
    <h3>Cechy</h3>
    <dl>
      {#each v.attributes as [label, value]}<div>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>{/each}
    </dl>
  </section>
  <section class="print-section">
    <h3>Umiejętności</h3>
    <dl>
      {#each v.skills as [label, value]}<div>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>{/each}
    </dl>
  </section>
  <section class="print-section">
    <h3>Podczas sesji</h3>
    <p>{v.conditions}</p>
  </section>
  {#each [['Przewagi', v.edges], ['Zawady', v.hindrances]] as [string, string[]][] as [title, lines]}<section
      class="print-section"
    >
      <h3>{title}</h3>
      {#each lines as line}<p>{line}</p>{/each}
    </section>{/each}
  <section class="print-section">
    <h3>Ekwipunek</h3>
    {#each v.inventory as item}<div class="print-item">
        <b>{item.name}</b>
        <p>{item.detail}</p>
      </div>{/each}
    <p>{v.funds}</p>
    <p>{v.load}</p>
  </section>
  {#each [['Historia i motywacja', [v.background, v.motivation, v.affiliation]], ['Notatki', [v.notes]], ['Doświadczenie i rozwinięcia', [v.legacy, ...v.xp, ...v.history]], ['Decyzje MG — zapis gracza', [...v.rulings, v.adjustments]]] as [string, string[]][] as [title, lines]}<section
      class="print-section"
    >
      <h3>{title}</h3>
      {#each lines.filter(Boolean) as line}<p class="print-text">{line}</p>{/each}
    </section>{/each}
  <p class="small muted">{v.ruleset} · Zapis {data.revision} · {data.date}</p>
</article>
