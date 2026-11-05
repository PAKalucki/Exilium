<script lang="ts">
  import { attributes, edges, skills, skillInfo, ranks } from '../content/catalog';
  import {
    availableAdvances,
    derived as calculateStats,
    earnedAdvances,
    previewAdvance,
    rankName,
    spentAdvances,
    totalXp,
  } from '../rules/engine';
  import type { AdvanceChoice, Character } from '../rules/model';
  import type { Command } from '../server/commands';
  import HelpPopover from './HelpPopover.svelte';
  import { playerHelp } from '../content/help';
  let {
    character,
    choice = $bindable(),
    busy = false,
    oncommand,
    onruling,
  }: {
    character: Character;
    choice: AdvanceChoice;
    busy?: boolean;
    oncommand: (c: Command) => Promise<boolean>;
    onruling: (code: string) => void;
  } = $props();
  let award = $state(2),
    awardNote = $state(''),
    knowledge = $state('');
  let xp = $derived(totalXp(character)),
    b = $derived(calculateStats(character).build),
    preview = $derived(previewAdvance(character, choice));
  let next = $derived(calculateStats(preview.next)),
    current = $derived(calculateStats(character));
  let selectedEdge = $derived(edges.find((e) => e.id === choice.target));
  function setKind() {
    choice.target =
      choice.kind === 'attribute' ? 'agility' : choice.kind === 'edge' ? edges[0].id : 'fighting';
    choice.second = 'shooting';
    choice.edgeTarget = '';
  }
  async function grant() {
    if (await oncommand({ type: 'xp', amount: award, note: awardNote })) awardNote = '';
  }
</script>

<div class="section-heading">
  <div>
    <p class="eyebrow">KAŻDA SESJA ZOSTAWIA ŚLAD</p>
    <h2>Rozwój postaci</h2>
  </div>
  <div class="help-heading">
    <span class="rank-pill">{rankName(xp)}</span><HelpPopover help={playerHelp.advancement} />
  </div>
</div>
<div class="development-stats">
  <div><span>PUNKTY DOŚWIADCZENIA</span><strong>{xp}<small> PD</small></strong></div>
  <div><span>ZDOBYTE ROZWINIĘCIA</span><strong>{earnedAdvances(xp)}</strong></div>
  <div><span>WYDANE</span><strong>{spentAdvances(character)}</strong></div>
  <div class="accent-stat">
    <span>DO WYKORZYSTANIA</span><strong>{availableAdvances(character)}</strong>
  </div>
</div>
<div class="rank-track">
  {#each ranks as rank, i}<div class:reached={xp >= i * 20}>
      <span>{rank}</span><small>{i * 20}{i === 4 ? '+' : `–${i * 20 + 19}`} PD</small>
    </div>{/each}
</div>
<div class="split-panel development-columns">
  <section class="panel">
    <h3>Zapisz doświadczenie</h3>
    <p class="small muted">Zapisz nagrodę za sesję. Ujemna wartość oznacza jawną korektę.</p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        grant();
      }}
    >
      <div class="form-grid">
        <label
          >Punkty PD<input
            type="number"
            bind:value={award}
            min="-10000"
            max="10000"
            required
          /></label
        ><label
          >Sesja / uzasadnienie<input
            bind:value={awardNote}
            placeholder="np. Sesja 3 — droga do Jericho"
            maxlength="160"
            required
          /></label
        >
      </div>
      <button class="button secondary" disabled={busy || !awardNote.trim()}>Zapisz PD</button>
    </form>
    <div class="xp-ledger">
      {#if character.legacy}<p class="small muted">
          Podstawa istniejącej karty: {character.legacy.xp} PD · {character.legacy.spent} wydanych rozwinięć.
        </p>{/if}{#each [...character.xp].reverse() as entry}<div>
          <span>{entry.note}<small>{new Date(entry.date).toLocaleDateString('pl-PL')}</small></span
          ><b>{entry.amount >= 0 ? '+' : ''}{entry.amount} PD</b>
        </div>{/each}
    </div>
  </section>
  <section class="panel">
    <h3>Wydaj rozwinięcie</h3>
    <p class="small muted">
      Przewagi sprawdzamy według obecnej Rangi. Zobacz efekt przed zatwierdzeniem.
    </p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        oncommand({ type: 'advance', choice });
      }}
    >
      <label
        >Rodzaj rozwinięcia<select bind:value={choice.kind} onchange={setKind}
          ><option value="edge">Nowa przewaga</option><option value="attribute"
            >Zwiększenie cechy</option
          ><option value="skill">Jedna umiejętność (równa lub wyższa od cechy)</option><option
            value="twoSkills">Dwie umiejętności poniżej cech</option
          ><option value="newSkill">Nowa umiejętność na k4</option></select
        ></label
      >
      {#if choice.kind === 'edge'}<label
          >Przewaga<select bind:value={choice.target}
            >{#each edges as edge}<option value={edge.id}>{edge.name} · {ranks[edge.rank]}</option
              >{/each}</select
          ></label
        >{#if selectedEdge}<p class="small">{selectedEdge.summary}</p>
          {#if selectedEdge.target === 'trait'}<label
              >Współczynnik<select bind:value={choice.edgeTarget}
                ><option value="">Wybierz</option
                >{#each Object.entries(attributes) as [key, label]}<option value={key}
                    >{label}</option
                  >{/each}{#each Object.keys(b.skills) as key}<option value={key}
                    >{skillInfo(key)?.name}</option
                  >{/each}</select
              ></label
            >{:else if selectedEdge.target === 'knowledge'}
            {#each [0, 1] as index}
              <label
                >Dziedzina Wiedzy {index + 1}
                <select
                  value={choice.edgeTarget.split('|')[index] || ''}
                  onchange={(event) => {
                    const targets = choice.edgeTarget.split('|');
                    targets[index] = event.currentTarget.value;
                    choice.edgeTarget = [targets[0] || '', targets[1] || ''].join('|');
                  }}
                >
                  <option value="">Wybierz dziedzinę na co najmniej k8</option>
                  {#each Object.keys(b.skills).filter((key) => key.startsWith('knowledge:')) as key}
                    <option value={key}>{skillInfo(key)?.name} · k{b.skills[key]}</option>
                  {/each}
                </select>
              </label>
            {/each}
          {:else if selectedEdge.target === 'weapon'}<label
              >Egzemplarz broni<select bind:value={choice.edgeTarget}
                ><option value="">Wybierz</option
                >{#each character.inventory.filter((i) => i.kind === 'weapon') as item}<option
                    value={item.id}>{item.name}</option
                  >{/each}</select
              ></label
            >{/if}{/if}
      {:else if choice.kind === 'attribute'}<label
          >Cecha<select bind:value={choice.target}
            >{#each Object.entries(attributes) as [key, label]}<option value={key}
                >{label} · k{b.attributes[key as keyof typeof attributes]}</option
              >{/each}</select
          ></label
        >
      {:else}<label
          >Umiejętność<select bind:value={choice.target}
            >{#each [...skills, ...Object.keys(b.skills)
                .filter((k) => k.startsWith('knowledge:'))
                .map((k) => skillInfo(k)!)] as skill}<option value={skill.id}
                >{skill.name} · {b.skills[skill.id]
                  ? `k${b.skills[skill.id]}`
                  : 'niewykupiona'}</option
              >{/each}{#if knowledge.trim()}<option value={`knowledge:${knowledge.trim()}`}
                >Wiedza ({knowledge.trim()})</option
              >{/if}</select
          ></label
        >{#if choice.kind === 'newSkill'}<label
            >Nowa dziedzina Wiedzy (opcjonalnie)<input
              bind:value={knowledge}
              oninput={() => {
                choice.target = `knowledge:${knowledge.trim()}`;
              }}
              placeholder="np. Elektronika"
              maxlength="70"
            /></label
          >{/if}{#if choice.kind === 'twoSkills'}<label
            >Druga umiejętność<select bind:value={choice.second}
              >{#each Object.keys(b.skills) as key}<option value={key}
                  >{skillInfo(key)?.name} · k{b.skills[key]}</option
                >{/each}</select
            ></label
          >{/if}{/if}
      <label
        >Notatka do rozwinięcia<input
          bind:value={choice.note}
          maxlength="160"
          placeholder="Opcjonalnie"
        /></label
      >
      {#each preview.issues as i}<div class:waived={i.waived} class="validation-message">
          <span>{i.waived ? 'Decyzja MG: ' : ''}{i.message}</span
          >{#if !i.waived && !i.code.endsWith('unavailable')}<button
              type="button"
              class="text-button"
              onclick={() => onruling(i.code)}>Zapisz decyzję MG →</button
            >{/if}
        </div>{/each}
      {#if !preview.issues.some((i) => !i.waived)}<div class="advance-preview">
          <b>Po rozwinięciu</b>{#if choice.kind === 'attribute'}<p>
              {attributes[choice.target as keyof typeof attributes]}: k{b.attributes[
                choice.target as keyof typeof attributes
              ]} → k{next.build.attributes[choice.target as keyof typeof attributes]}
            </p>{:else if choice.kind === 'edge'}<p>Nowa przewaga: {selectedEdge?.name}</p>{:else}<p
            >
              {skillInfo(choice.target)?.name}: {b.skills[choice.target]
                ? `k${b.skills[choice.target]}`
                : 'brak'} → k{next.build.skills[choice.target]}
            </p>
            {#if choice.kind === 'twoSkills'}<p>
                {skillInfo(choice.second)?.name}: k{b.skills[choice.second]} → k{next.build.skills[
                  choice.second
                ]}
              </p>{/if}{/if}<small
            >Obrona {current.parry} → {next.parry} · Wytrzymałość {current.totalToughness} → {next.totalToughness}</small
          >
        </div>{/if}
      <button
        class="button primary"
        disabled={busy ||
          availableAdvances(character) <= 0 ||
          preview.issues.some((i) => !i.waived)}>Potwierdź rozwinięcie →</button
      >
    </form>
  </section>
</div>
<section class="panel">
  <h3>Historia rozwoju</h3>
  {#if !character.advances.length}<p class="muted small">
      Pierwsze rozwinięcie jest jeszcze przed tobą.
    </p>{/if}{#each character.advances as advance, i}<div class="advancement-row">
      <span class="advance-number"
        >{String((character.legacy?.spent ?? 0) + i + 1).padStart(2, '0')}</span
      >
      <div>
        <b
          >{advance.kind === 'edge'
            ? edges.find((e) => e.id === advance.target)?.name
            : advance.kind === 'attribute'
              ? attributes[advance.target as keyof typeof attributes]
              : skillInfo(advance.target)?.name}{advance.kind === 'twoSkills'
            ? ` + ${skillInfo(advance.second)?.name}`
            : ''}</b
        ><small
          >{ranks[advance.rank]} · {advance.xp} PD · {new Date(advance.date).toLocaleDateString(
            'pl-PL',
          )}{advance.note ? ` · ${advance.note}` : ''}</small
        >
      </div>
    </div>{/each}
</section>
