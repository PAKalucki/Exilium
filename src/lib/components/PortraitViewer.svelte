<script lang="ts">
  import { portraitUrl } from '../portraits';

  let { characterId, portraitId, name }: { characterId: string; portraitId: string; name: string } =
    $props();
  const id = $props.id();
  let dialog = $state<HTMLDialogElement>();
  const src = $derived(portraitUrl(characterId, portraitId));

  function dismissBackdrop(event: PointerEvent) {
    const target = event.currentTarget as HTMLDialogElement;
    if (event.target !== target) return;
    const bounds = target.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      event.preventDefault();
      target.close();
    }
  }
</script>

<button
  type="button"
  class="sheet-portrait"
  disabled={!dialog}
  aria-label={`Powiększ portret: ${name}`}
  aria-haspopup="dialog"
  aria-controls={id}
  onclick={() => dialog?.showModal()}
>
  <img {src} alt={`Portret: ${name}`} width="160" height="200" />
  <span class="portrait-zoom-hint" aria-hidden="true">Powiększ ↗</span>
</button>

<dialog
  bind:this={dialog}
  {id}
  class="portrait-viewer"
  aria-labelledby={`${id}-title`}
  onpointerdown={dismissBackdrop}
>
  <div class="portrait-viewer-heading">
    <span id={`${id}-title`}>Portret: {name}</span>
    <button
      type="button"
      class="button secondary compact"
      aria-label="Zamknij podgląd portretu"
      onclick={() => dialog?.close()}>Zamknij ×</button
    >
  </div>
  <img {src} alt={`Portret: ${name}`} />
</dialog>
