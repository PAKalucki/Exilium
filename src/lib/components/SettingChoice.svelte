<script lang="ts">
  import { untrack } from 'svelte';
  import HelpPopover from './HelpPopover.svelte';
  import type { HelpContent } from '../content/help';
  let {
    value = $bindable(),
    label,
    options,
    descriptions = {},
    help,
    onchange,
  }: {
    value: string;
    label: string;
    options: string[];
    descriptions?: Record<string, string>;
    help: HelpContent;
    onchange: () => void;
  } = $props();
  const id = $props.id();
  let custom = $state(untrack(() => value !== '' && !options.includes(value)));
  let isCustom = $derived(custom || (value !== '' && !options.includes(value)));
</script>

<div class="setting-choice">
  <div class="field-label"><label for={id}>{label}</label><HelpPopover {help} /></div>
  <select
    {id}
    value={isCustom ? '__custom' : value}
    onchange={(e) => {
      custom = e.currentTarget.value === '__custom';
      value = custom ? '' : e.currentTarget.value;
      onchange();
    }}
  >
    {#if !value && !custom}<option value="">Wybierz lub pozostaw puste</option>{/if}
    {#each options as option}<option value={option}>{option}</option>{/each}
    <option value="__custom">Własne — wpisz</option>
  </select>
  {#if isCustom}<label class="custom-setting"
      >Własne: {label.toLowerCase()}<input
        bind:value
        maxlength="160"
        placeholder="Wpisz własną odpowiedź"
      /></label
    >{/if}
  {#if descriptions[value]}<p class="setting-description">{descriptions[value]}</p>{/if}
</div>
