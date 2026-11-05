<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<div class="hidden-section" role="note" aria-label={`${label}: ukryte`}>
  <span class="blurred" aria-hidden="true">Tajemnice podróżnika z Exilium</span>
  <span>{label}: ukryte · zapytaj w grze</span>
</div>

<style>
  .hidden-section {
    position: relative;
    padding: 1rem 0;
    display: grid;
    gap: 0.5rem;
  }
  .blurred {
    filter: blur(6px);
    user-select: none;
    pointer-events: none;
    opacity: 0.5;
  }
  .hidden-section > span:last-child {
    font-size: 0.85rem;
    color: var(--muted, #626c60);
  }
</style>
