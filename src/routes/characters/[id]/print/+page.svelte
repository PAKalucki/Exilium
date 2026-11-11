<script lang="ts">
  import CharacterPrintSheet from '../../../../lib/components/CharacterPrintSheet.svelte';
  let { data } = $props();
</script>

<svelte:head><title>{data.view.name} · Karta do druku</title></svelte:head>
<div class="print-toolbar">
  <a
    class="button secondary"
    href={`/characters/${data.id}${data.privateDetailsRevealed ? '?revealPrivate=1' : ''}`}
    >← Wróć do karty</a
  >
  <button class="button primary" onclick={() => window.print()}>Drukuj / zapisz PDF</button>
  <p>PDF zapiszesz, wybierając „Zapisz jako PDF” w oknie drukowania.</p>
</div>
<CharacterPrintSheet
  view={data.view}
  characterId={data.id}
  revision={data.revision}
  date={data.date}
/>
