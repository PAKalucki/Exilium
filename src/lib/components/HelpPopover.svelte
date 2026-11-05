<script lang="ts">
  import type { HelpContent } from '../content/help';
  let { help }: { help: HelpContent } = $props();
  const id = $props.id();
</script>

<button
  type="button"
  class="help-trigger"
  title={help.title}
  popovertarget={id}
  aria-label={`Pomoc: ${help.title}`}>?</button
>
<div {id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} class="help-popup">
  <button
    type="button"
    class="help-close"
    popovertarget={id}
    popovertargetaction="hide"
    aria-label="Zamknij pomoc">×</button
  >
  <p class="eyebrow">SAVAGE WORLDS · POMOC GRACZA</p>
  <h3 id={`${id}-title`}>{help.title}</h3>
  {#each help.paragraphs as text}<p>{text}</p>{/each}
  {#if help.example}<div class="help-example">
      <b>Przykład</b>
      <p>{help.example}</p>
    </div>{/if}
</div>
