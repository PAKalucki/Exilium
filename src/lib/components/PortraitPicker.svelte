<script lang="ts">
  import { PORTRAIT_UPLOAD_LIMIT, portraitUrl } from '../portraits';
  let {
    characterId,
    portraitId,
    onupload,
    onremove,
  }: {
    characterId: string;
    portraitId: string | null;
    onupload: (file: File) => Promise<boolean>;
    onremove: () => void;
  } = $props();
  let error = $state('');
  async function choose(event: Event) {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement,
      file = input.files?.[0];
    input.value = '';
    error = '';
    if (!file) return;
    if (file.size > PORTRAIT_UPLOAD_LIMIT) {
      error = 'Portret może mieć maksymalnie 5 MB.';
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      error = 'Wybierz obraz JPG lub PNG.';
      return;
    }
    await onupload(file);
  }
</script>

<section class="portrait-picker" aria-label="Portret postaci">
  <img
    class:portrait-placeholder={!portraitId}
    src={portraitId ? portraitUrl(characterId, portraitId) : '/images/portrait-default-v1.png'}
    alt={portraitId ? 'Portret postaci' : 'Ilustracja domyślna: anonimowy podróżnik Exilium'}
    width="128"
    height="160"
  />
  <div>
    <h3>Portret <span class="muted small">(opcjonalnie)</span></h3>
    <p class="small muted">Dodaj własny obraz bohatera. JPG lub PNG, do 5 MB.</p>
    <label class="portrait-file-label"
      >{portraitId ? 'Zmień portret' : 'Wgraj portret'}<input
        type="file"
        accept="image/jpeg,image/png"
        aria-label="Wgraj portret"
        oninput={(event) => event.stopPropagation()}
        onchange={choose}
      /></label
    >{#if portraitId}<button type="button" class="text-button" onclick={onremove}
        >Usuń portret</button
      >{/if}{#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
</section>
