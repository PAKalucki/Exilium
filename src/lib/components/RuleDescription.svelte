<script lang="ts">
  import { edges, hindrances } from '../content/catalog';
  import {
    edgeDescription,
    edgeRequirements,
    hindranceDescription,
    wealthWarning,
  } from '../content/descriptions';
  let {
    kind,
    id,
    showTitle = true,
  }: { kind: 'edge' | 'hindrance'; id: string; showTitle?: boolean } = $props();
  let rule = $derived(
    kind === 'edge' ? edges.find((e) => e.id === id) : hindrances.find((h) => h.id === id),
  );
  let warning = $derived(kind === 'edge' ? wealthWarning(id) : null);
</script>

{#if rule}
  <div class="rule-description">
    {#if showTitle}<h4>{rule.name}</h4>{/if}
    <p>{kind === 'edge' ? edgeDescription(id) : hindranceDescription(id)}</p>
    {#if kind === 'edge'}<p class="rule-requirements">
        <b>Wymagania:</b>
        {edgeRequirements(id)}
      </p>{:else}<p class="rule-requirements">
        <b>Stopień:</b>
        {hindrances
          .find((h) => h.id === id)
          ?.severities.map((v) => (v === 1 ? 'drobna (1 pkt)' : 'poważna (2 pkt)'))
          .join(' lub ')}
      </p>{/if}
    {#if warning}<aside class="gm-approval-warning" role="note">
        <b>Wymaga rozmowy i zgody MG</b>
        <p>{warning}</p>
      </aside>{/if}
  </div>
{/if}
