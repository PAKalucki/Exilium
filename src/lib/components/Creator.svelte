<script lang="ts">
  import {
    attributes,
    dice,
    skills,
    edges,
    hindrances,
    origins,
    castes,
    professions,
    skillInfo,
  } from '../content/catalog';
  import {
    creationBudget,
    startingFunds,
    equipmentCost,
    validateCreation,
    earnedAdvances,
  } from '../rules/engine';
  import {
    characterCategoryLabels,
    type Character,
    type CharacterCategory,
    type Item,
  } from '../rules/model';
  import { changeCharacterCategory } from '../rules/categories';
  import ItemEditor from './ItemEditor.svelte';
  import ArchetypePicker from './ArchetypePicker.svelte';
  import PortraitPicker from './PortraitPicker.svelte';
  import RuleDescription from './RuleDescription.svelte';
  import HelpPopover from './HelpPopover.svelte';
  import SettingChoice from './SettingChoice.svelte';
  import { attributeGuides, playerHelp } from '../content/help';
  import { originDescriptions, casteDescriptions } from '../content/setting';
  import { unavailableRules, ruleSearch } from '../content/availability';
  import { addKnowledgeSkill, renameKnowledge, removeKnowledge } from '../rules/knowledge';
  let {
    character = $bindable(),
    characterId,
    onchange,
    onupload,
    onremove,
    canCreateExtras = false,
    allowCategoryChange = true,
  }: {
    character: Character;
    characterId: string;
    onchange: () => void;
    onupload: (file: File) => Promise<boolean>;
    onremove: () => void;
    canCreateExtras?: boolean;
    allowCategoryChange?: boolean;
  } = $props();
  let step = $state(0),
    categoryError = $state(''),
    newEdge = $state(edges[0].id),
    newHindrance = $state(hindrances[0].id),
    knowledge = $state(''),
    showItem = $state(false),
    search = $state('');
  let knowledgeEditing = $state(''),
    knowledgeName = $state(''),
    knowledgeError = $state(''),
    knowledgeMessage = $state('');
  const steps = [
    'Koncepcja',
    'Cechy',
    'Zawady i Przewagi',
    'Umiejętności',
    'Ekwipunek',
    'Podsumowanie',
  ];
  let budget = $derived(creationBudget(character)),
    issues = $derived(validateCreation(character));
  let extra = $derived(character.category === 'extra');
  let visibleEdges = $derived(
    edges
      .filter((e) => ruleSearch(e.name).includes(ruleSearch(search)))
      .toSorted((a, b) => a.name.localeCompare(b.name, 'pl')),
  );
  let visibleHindrances = $derived(
    hindrances
      .filter((h) => ruleSearch(h.name).includes(ruleSearch(search)))
      .toSorted((a, b) => a.name.localeCompare(b.name, 'pl')),
  );
  let unavailable = $derived(
    unavailableRules.filter((rule) => ruleSearch(rule.name).includes(ruleSearch(search))),
  );
  $effect(() => {
    if (!visibleEdges.some((e) => e.id === newEdge)) newEdge = visibleEdges[0]?.id || '';
    if (!visibleHindrances.some((h) => h.id === newHindrance))
      newHindrance = visibleHindrances[0]?.id || '';
  });
  function addKnowledge() {
    knowledgeError = '';
    knowledgeMessage = '';
    try {
      addKnowledgeSkill(character, knowledge);
      knowledge = '';
      onchange();
    } catch (e) {
      knowledgeError = (e as Error).message;
    }
  }
  function renameKnowledgeEntry() {
    knowledgeError = '';
    knowledgeMessage = '';
    try {
      renameKnowledge(character, knowledgeEditing, knowledgeName);
      knowledgeEditing = '';
      onchange();
    } catch (e) {
      knowledgeError = (e as Error).message;
    }
  }
  function removeKnowledgeEntry(key: string) {
    knowledgeError = '';
    const affected = removeKnowledge(character, key);
    if (knowledgeEditing === key) knowledgeEditing = '';
    knowledgeMessage = affected
      ? 'Usunięto dziedzinę Wiedzy. Wskaż nową dziedzinę w powiązanych przewagach.'
      : 'Usunięto dziedzinę Wiedzy i przeliczono punkty.';
    onchange();
  }
  function addItem(item: Item) {
    character.inventory.push(item);
    showItem = false;
    onchange();
  }
  function scholarTarget(edge: Character['build']['edges'][number], index: number, value: string) {
    const targets = edge.target.split('|');
    targets[index] = value;
    edge.target = [targets[0] || '', targets[1] || ''].join('|');
    onchange();
  }
</script>

<div class="creator-layout">
  <aside class="creator-steps" aria-label="Etapy tworzenia">
    {#each steps as label, i}<button class:selected={step === i} onclick={() => (step = i)}
        ><span>{String(i + 1).padStart(2, '0')}</span>{label}<b aria-hidden="true"
          >{step === i ? '→' : ''}</b
        ></button
      >{/each}
    <div class="creator-hint">
      <span class="eyebrow">TWÓJ BOHATER</span>
      <p>Koncepcja najpierw.<br />Liczby za chwilę.</p>
      <small>Możesz wracać do każdego kroku. Szkic zapisuje się automatycznie.</small>
    </div>
  </aside>
  <div class="creator-content" oninput={onchange} {onchange}>
    <div class="section-heading">
      <div>
        <p class="eyebrow">KROK {step + 1} / {steps.length}</p>
        <h2>{steps[step]}</h2>
      </div>
      <span class="small muted"
        >{characterCategoryLabels[character.category]} · Człowiek · Exilium</span
      >
    </div>
    {#if step === 0}
      <p class="muted">Kim jesteś, zanim padnie pierwszy strzał?</p>
      <section class="panel" aria-label="Kategoria postaci">
        <label
          >Kategoria postaci<select
            value={character.category}
            disabled={!canCreateExtras || !allowCategoryChange || !!character.legacy}
            oninput={(event) => event.stopPropagation()}
            onchange={(event) => {
              event.stopPropagation();
              categoryError = '';
              try {
                character = changeCharacterCategory(
                  character,
                  event.currentTarget.value as CharacterCategory,
                );
                onchange();
              } catch (error) {
                categoryError = (error as Error).message;
              }
            }}
          >
            <option value="wildCard">Figura (Wild Card)</option>
            {#if canCreateExtras || extra}<option value="extra">Blotka (Extra) — tylko MG</option
              >{/if}
          </select></label
        >
        <p class="small muted">
          Figura to postać gracza lub główny przeciwnik. Blotki to postacie drugoplanowe i
          przeciwnicy o statystykach ustalanych przez MG; ich szczegóły są domyślnie prywatne.
        </p>
        {#if categoryError}<p class="error" role="alert">{categoryError}</p>{/if}
      </section>
      <ArchetypePicker bind:character {onchange} />
      <PortraitPicker {characterId} portraitId={character.portraitId} {onupload} {onremove} />
      <div class="form-grid">
        <label>Imię postaci<input bind:value={character.name} maxlength="160" required /></label
        ><label>Wiek<input bind:value={character.age} maxlength="160" /></label>
        <SettingChoice
          label="Pochodzenie"
          bind:value={character.origin}
          options={origins}
          descriptions={originDescriptions}
          help={playerHelp.origin}
          {onchange}
        />
        <SettingChoice
          label="Status społeczny"
          bind:value={character.caste}
          options={castes}
          descriptions={casteDescriptions}
          help={playerHelp.caste}
          {onchange}
        />
        <SettingChoice
          label="Profesja"
          bind:value={character.profession}
          options={professions}
          help={playerHelp.profession}
          {onchange}
        />
        <label>Afiliacje<input bind:value={character.affiliation} maxlength="160" /></label>
      </div>
      <label
        >Motywacja<input
          bind:value={character.motivation}
          placeholder="Co sprawia, że ruszasz dalej?"
          maxlength="160"
        /></label
      ><label
        >Wygląd (opcjonalnie)<textarea
          bind:value={character.appearance}
          rows="3"
          maxlength="4000"
          placeholder="Sylwetka, twarz, ubiór, znaki szczególne…"></textarea></label
      ><label
        >Historia<textarea
          bind:value={character.background}
          rows="5"
          maxlength="12000"
          placeholder="Ludzie, miejsca i decyzje, które cię ukształtowały."></textarea></label
      >
      {#if !extra}<details class="legacy-details">
          <summary>Wpisuję istniejącą postać</summary>
          <p class="small muted">
            Jeśli nie znasz pełnej historii rozwoju, zapisz obecne statystyki jako podstawę.
            Historycznie wydane rozwinięcia nie zostaną przyznane ponownie.
          </p>
          <label class="check-label"
            ><input
              type="checkbox"
              checked={!!character.legacy}
              onchange={(e) => {
                character.legacy = e.currentTarget.checked
                  ? {
                      xp: 0,
                      spent: 0,
                      attributeUsed: false,
                      lastLegendaryAttribute: null,
                      reason: 'Przepisanie istniejącej karty',
                    }
                  : null;
                onchange();
              }}
            /> Użyj istniejącej karty jako podstawy</label
          >{#if character.legacy}<div class="form-grid">
              <label
                >Obecne PD<input
                  type="number"
                  bind:value={character.legacy.xp}
                  min="0"
                  required
                /></label
              ><label
                >Historycznie wydane rozwinięcia<input
                  type="number"
                  bind:value={character.legacy.spent}
                  min="0"
                  max={earnedAdvances(character.legacy.xp)}
                  required
                /></label
              ><label class="check-label"
                ><input type="checkbox" bind:checked={character.legacy.attributeUsed} /> Cecha zwiększona
                na obecnej Randze</label
              ><label
                >Numer ostatniego zwiększenia cechy (Legenda)<input
                  type="number"
                  value={character.legacy.lastLegendaryAttribute ?? ''}
                  oninput={(e) => {
                    if (character.legacy)
                      character.legacy.lastLegendaryAttribute =
                        e.currentTarget.value === '' ? null : Number(e.currentTarget.value);
                  }}
                  min="0"
                  max={character.legacy.spent}
                /></label
              >
            </div>
            <label
              >Uzasadnienie podstawy<input
                bind:value={character.legacy.reason}
                minlength="3"
                maxlength="160"
              /></label
            >
            <div class="form-grid">
              <label
                >Obecna gotówka<input type="number" bind:value={character.cash} min="0" /></label
              ><label
                >Obecne kredyty<input type="number" bind:value={character.credits} min="0" /></label
              >
            </div>{/if}
        </details>{/if}
    {:else if step === 1}
      <div class="beginner-guide">
        <div class="help-heading">
          <h3>Czym są cechy?</h3>
          <HelpPopover help={playerHelp.attributes} /><HelpPopover help={playerHelp.dice} />
        </div>
        <p>
          Cechy opisują ogólne możliwości bohatera. Umiejętności to wyuczone działania. Wybierz
          kości pasujące do swojej roli w drużynie; znak „?” wyjaśnia zastosowania.
        </p>
      </div>
      {#if !extra}<div class="budget-banner">
          <span>Punkty na cechy</span><strong
            class:over-budget={budget.attributeSpent > budget.attributeTotal}
            >{budget.attributeSpent} <small>/ {budget.attributeTotal}</small></strong
          >
        </div>
        <p class="muted">Każda cecha zaczyna od k4. Jeden punkt podnosi ją o jeden rodzaj kości.</p>
      {:else}<p class="notice">
          Wybierz cechy potrzebne tej Blotce. MG ustala je bez rozliczania punktów tworzenia
          postaci.
        </p>{/if}
      <div class="attribute-editor">
        {#each Object.entries(attributes) as [key, label]}<div class="attribute-row">
            <div class="attribute-explanation">
              <div class="help-heading">
                <strong>{label}</strong><HelpPopover
                  help={attributeGuides[key as keyof typeof attributes]}
                />
              </div>
              <small>{attributeGuides[key as keyof typeof attributes].short}</small>
            </div>
            <div class="die-options">
              {#each dice as die}<button
                  class:picked={character.build.attributes[key as keyof typeof attributes] === die}
                  onclick={() => {
                    character.build.attributes[key as keyof typeof attributes] = die;
                    onchange();
                  }}>k{die}</button
                >{/each}
            </div>
          </div>{/each}
      </div>
    {:else if step === 2}
      <div class="help-heading section-help">
        <span>Nie wiesz, co wybrać?</span><HelpPopover help={playerHelp.hindrances} /><HelpPopover
          help={playerHelp.edges}
        />
      </div>
      <label class="rule-search"
        >Szukaj zawady lub przewagi<input
          type="search"
          bind:value={search}
          oninput={(e) => e.stopPropagation()}
          onchange={(e) => e.stopPropagation()}
          placeholder="Nazwa, np. Czujny, McGyver lub Pomysłowy Dobromir"
        /></label
      >
      {#if !extra}<div class="budget-banner">
          <span>Wydane punkty z zawad</span><strong
            class:over-budget={budget.spentHindrance > budget.hindrancePoints}
            >{budget.spentHindrance}<small> / {budget.hindrancePoints}</small></strong
          >
        </div>{:else}<p class="notice">
          Przewagi i zawady są opcjonalne. MG wybiera zdolności pasujące do roli Blotki.
        </p>{/if}
      <div class="split-panel">
        <div>
          <h3>
            Zawady <span class="muted small">{visibleHindrances.length} z {hindrances.length}</span>
          </h3>
          {#if !extra}<p class="small muted">
              Punkty przyznają maksymalnie dwie drobne i jedna poważna zawada.
            </p>{/if}
          <div class="inline-fields">
            <select aria-label="Wybierz zawadę" bind:value={newHindrance}
              >{#each visibleHindrances as h}<option value={h.id}>{h.name}</option>{/each}</select
            ><button
              class="button secondary compact"
              disabled={!newHindrance}
              onclick={() => {
                if (!character.build.hindrances.some((h) => h.id === newHindrance)) {
                  character.build.hindrances.push({
                    id: newHindrance,
                    severity: hindrances.find((h) => h.id === newHindrance)!.severities[0] as 1 | 2,
                  });
                  onchange();
                }
              }}>Dodaj</button
            >
          </div>
          {#if newHindrance}<section class="rule-preview" aria-label="Opis wybranej zawady">
              <RuleDescription kind="hindrance" id={newHindrance} />
            </section>{:else}<p class="small muted">
              Brak dostępnych zawad pasujących do nazwy.
            </p>{/if}
          {#each character.build.hindrances as h, i}{@const def = hindrances.find(
              (v) => v.id === h.id,
            )!}
            <div class="choice-card">
              <div>
                <b>{def.name}</b><button
                  class="text-button"
                  aria-label={`Usuń zawadę ${def.name}`}
                  onclick={() => {
                    character.build.hindrances.splice(i, 1);
                    onchange();
                  }}>×</button
                >
              </div>
              <RuleDescription kind="hindrance" id={h.id} showTitle={false} />
              <select aria-label={`Stopień zawady ${def.name}`} bind:value={h.severity}
                >{#each def.severities as v}<option value={v}
                    >{v === 1 ? 'Drobna (1 pkt)' : 'Poważna (2 pkt)'}</option
                  >{/each}</select
              >
            </div>{/each}
        </div>
        <div>
          <h3>Przewagi <span class="muted small">{visibleEdges.length} z {edges.length}</span></h3>
          {#if !extra}<p class="small muted">
              Człowiek otrzymuje jedną darmową przewagę. Kolejne kosztują po dwa punkty z zawad.
            </p>{/if}
          <div class="inline-fields">
            <select aria-label="Wybierz przewagę" bind:value={newEdge}
              >{#each visibleEdges as e}<option value={e.id}>{e.name}</option>{/each}</select
            ><button
              class="button secondary compact"
              disabled={!newEdge}
              onclick={() => {
                character.build.edges.push({ id: newEdge, target: '' });
                onchange();
              }}>Dodaj</button
            >
          </div>
          {#if newEdge}<section class="rule-preview" aria-label="Opis wybranej przewagi">
              <RuleDescription kind="edge" id={newEdge} />
            </section>{:else}<p class="small muted">
              Brak dostępnych przewag pasujących do nazwy.
            </p>{/if}
          {#each character.build.edges as e, i}{@const def = edges.find((v) => v.id === e.id)!}
            <div class="choice-card">
              <div>
                <b>{def.name}</b><button
                  class="text-button"
                  aria-label={`Usuń przewagę ${def.name}`}
                  onclick={() => {
                    character.build.edges.splice(i, 1);
                    onchange();
                  }}>×</button
                >
              </div>
              <RuleDescription kind="edge" id={e.id} showTitle={false} />
              {#if def.target === 'trait'}<label
                  >Współczynnik<select bind:value={e.target}
                    ><option value="">Wybierz</option
                    >{#each Object.entries(attributes) as [key, label]}<option value={key}
                        >{label}</option
                      >{/each}{#each Object.keys(character.build.skills) as key}<option value={key}
                        >{skillInfo(key)?.name}</option
                      >{/each}</select
                  ></label
                >{:else if def.target === 'weapon'}<label
                  >Egzemplarz broni<select bind:value={e.target}
                    ><option value="">Wybierz po dodaniu ekwipunku</option
                    >{#each character.inventory.filter((i) => i.kind === 'weapon') as item}<option
                        value={item.id}>{item.name}</option
                      >{/each}</select
                  ></label
                >{:else if def.target === 'knowledge'}
                {#each [0, 1] as index}
                  <label
                    >Dziedzina Wiedzy {index + 1}
                    <select
                      value={e.target.split('|')[index] || ''}
                      onchange={(event) => scholarTarget(e, index, event.currentTarget.value)}
                    >
                      <option value="">Wybierz dziedzinę na co najmniej k8</option>
                      {#each Object.keys(character.build.skills).filter( (key) => key.startsWith('knowledge:') ) as key}
                        <option value={key}
                          >{skillInfo(key)?.name} · k{character.build.skills[key]}</option
                        >
                      {/each}
                    </select>
                  </label>
                {/each}
              {/if}
            </div>{/each}
        </div>
      </div>
      {#if unavailable.length}<details class="unavailable-rules" open={!!search}>
          <summary>Opcje z podręcznika pominięte w Exilium ({unavailable.length})</summary>
          <p class="small muted">
            Są częścią książki, ale nie są dostępnymi wyborami w tej kampanii. Pełny opis ma
            pierwszeństwo przed skrótem w tabeli.
          </p>
          {#each unavailable as rule}<article>
              <b>{rule.name}</b><span class="rule-status"
                >Niedostępne · {rule.kind === 'edge' ? 'przewaga' : 'zawada'}</span
              >
              <p>{rule.reason}</p>
              {#if rule.alternative}<p class="alternative-rule">
                  Zobacz dostępną opcję: <b>{rule.alternative}</b>.
                </p>{/if}
            </article>{/each}
        </details>{/if}
      {#if !extra}<h3>Pozostałe korzyści z zawad</h3>
        <div class="form-grid three">
          <label
            >Dodatkowe punkty cech (po 2 pkt)<input
              type="number"
              min="0"
              max="2"
              bind:value={character.build.bonus.attributes}
            /></label
          ><label
            >Dodatkowe punkty umiejętności<input
              type="number"
              min="0"
              max="4"
              bind:value={character.build.bonus.skills}
            /></label
          ><label
            >Dodatkowe początkowe fundusze<input
              type="number"
              min="0"
              max="4"
              bind:value={character.build.bonus.funds}
            /></label
          >
        </div>
      {/if}
    {:else if step === 3}
      <div class="help-heading section-help">
        <span
          >{extra
            ? 'Wybierz umiejętności potrzebne tej Blotce.'
            : 'Kupujesz umiejętności, nie dodajesz do nich cechy.'}</span
        ><HelpPopover help={playerHelp.skills} /><HelpPopover help={playerHelp.dice} />
      </div>
      {#if !extra}<div class="budget-banner">
          <span>Punkty umiejętności</span><strong
            class:over-budget={budget.skillSpent > budget.skillTotal}
            >{budget.skillSpent}<small> / {budget.skillTotal}</small></strong
          >
        </div>
        <p class="muted">
          Kość do poziomu związanej cechy kosztuje 1 punkt. Wyższa — 2 punkty. Wiedza ogólna
          korzysta ze Sprytu.
        </p>{:else}<p class="notice">
          MG ustala kości umiejętności bez budżetu punktów. Blotka nie rzuca indywidualną Kością
          Figury.
        </p>{/if}
      <div class="skill-editor">
        {#each [...skills, ...Object.keys(character.build.skills)
            .filter((k) => k.startsWith('knowledge:'))
            .map((k) => skillInfo(k)!)] as s}<div class="knowledge-skill">
            <label class="skill-edit-row"
              ><span>{s.name}<small>{attributes[s.attribute]}</small></span><select
                aria-label={s.name}
                value={character.build.skills[s.id] ?? 0}
                onchange={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (v === 0 && s.id.startsWith('knowledge:')) {
                    removeKnowledgeEntry(s.id);
                    return;
                  }
                  if (v === 0) delete character.build.skills[s.id];
                  else character.build.skills[s.id] = v as 4;
                  onchange();
                }}
                ><option value="0">Niewykupiona</option>{#each dice as die}<option value={die}
                    >k{die}</option
                  >{/each}</select
              ></label
            >
            {#if s.id.startsWith('knowledge:')}<div class="knowledge-actions">
                <button
                  type="button"
                  class="text-button"
                  aria-label={`Zmień nazwę ${s.name}`}
                  onclick={() => {
                    knowledgeEditing = s.id;
                    knowledgeName = s.id.slice(10);
                    knowledgeError = '';
                  }}>Zmień nazwę</button
                >
                <button
                  type="button"
                  class="text-button danger"
                  aria-label={`Usuń ${s.name}`}
                  onclick={() => removeKnowledgeEntry(s.id)}>Usuń Wiedzę</button
                >
              </div>{/if}
          </div>{/each}
      </div>
      {#if knowledgeEditing}<div
          class="panel knowledge-rename"
          oninput={(event) => event.stopPropagation()}
          onchange={(event) => event.stopPropagation()}
        >
          <label
            >Nowa nazwa dziedziny Wiedzy<input bind:value={knowledgeName} maxlength="70" /></label
          >
          <button type="button" class="button secondary" onclick={renameKnowledgeEntry}
            >Zapisz nazwę Wiedzy</button
          >
          <button type="button" class="text-button" onclick={() => (knowledgeEditing = '')}
            >Anuluj zmianę nazwy</button
          >
        </div>{/if}
      <div class="inline-fields">
        <input
          aria-label="Dziedzina Wiedzy"
          bind:value={knowledge}
          placeholder="Dziedzina Wiedzy, np. Elektronika"
          maxlength="70"
          oninput={(event) => event.stopPropagation()}
          onchange={(event) => event.stopPropagation()}
        /><button class="button secondary" onclick={addKnowledge}>Dodaj Wiedzę</button>
      </div>
      {#if knowledgeError}<p class="error" role="alert">{knowledgeError}</p>{/if}
      {#if knowledgeMessage}<p class="small muted" role="status">{knowledgeMessage}</p>{/if}
    {:else if step === 4}
      {#if !extra}<div class="budget-banner">
          <span>Ekwipunek / dostępne fundusze</span><strong
            class:over-budget={equipmentCost(character) > startingFunds(character)}
            >{equipmentCost(character)}<small> / {startingFunds(character)} $</small></strong
          >
        </div>
        <p class="muted">
          Bazowy budżet Exilium: 400 $. Zapisuj również wodę, racje, amunicję i ogniwa. Własne
          przedmioty oraz kończyny cybernetyczne możesz dodać opisowo.
        </p>{:else}
        <p class="notice">
          MG dobiera wyposażenie Blotki według jej roli. Nie obowiązuje budżet zakupów postaci
          gracza.
        </p>
        <div class="form-grid">
          <label
            >Gotówka przy postaci<input type="number" min="0" bind:value={character.cash} /></label
          ><label
            >Kredyty przy postaci<input
              type="number"
              min="0"
              bind:value={character.credits}
            /></label
          >
        </div>
      {/if}
      {#each character.inventory as item, i}<div class="inventory-row">
          <div>
            <b>{item.name}</b><small>{item.quantity} szt. · {item.price * item.quantity} $</small>
          </div>
          <button
            class="text-button"
            onclick={() => {
              character.inventory.splice(i, 1);
              onchange();
            }}>Usuń</button
          >
        </div>{/each}{#if showItem}<ItemEditor
          onsave={addItem}
          oncancel={() => (showItem = false)}
        />{:else}<button class="button secondary" onclick={() => (showItem = true)}
          >+ Dodaj przedmiot</button
        >{/if}
    {:else}
      {#if extra}<p class="muted">
          Sprawdź statystyki i wyposażenie Blotki. MG może później zmienić je w zakładce Statystyki
          Blotki.
        </p>
        <div class="summary-grid">
          <div><small>Kategoria</small><b>Blotka</b></div>
          <div><small>Umiejętności</small><b>{Object.keys(character.build.skills).length}</b></div>
          <div><small>Przedmioty</small><b>{character.inventory.length}</b></div>
        </div>
      {:else}
        <p class="muted">
          Sprawdź wybory. Decyzje MG możesz zapisać w zakładce „Decyzje MG”. Po zatwierdzeniu nowe
          umiejętności i cechy rozwijasz przez „Rozwój”.
        </p>
        <div class="summary-grid">
          <div><small>Cechy</small><b>{budget.attributeSpent} / {budget.attributeTotal}</b></div>
          <div><small>Umiejętności</small><b>{budget.skillSpent} / {budget.skillTotal}</b></div>
          <div>
            <small>Fundusze po zakupach</small><b
              >{character.legacy
                ? character.cash
                : startingFunds(character) - equipmentCost(character)} $</b
            >
          </div>
        </div>
      {/if}
      {#if issues.length === 0}<p class="success">
          {allowCategoryChange
            ? 'Wybory są zgodne z regułami. Możesz zatwierdzić postać.'
            : 'Statystyki Blotki można dalej edytować.'}
        </p>{/if}{#each issues as i}<div class:waived={i.waived} class="validation-message">
          <b>{i.waived ? 'Decyzja MG' : 'Do sprawdzenia'}</b><span>{i.message}</span>
        </div>{/each}
    {/if}
    <div class="wizard-actions">
      <button class="button secondary" disabled={step === 0} onclick={() => step--}>← Wstecz</button
      >{#if step < steps.length - 1}<button class="button primary" onclick={() => step++}
          >Dalej →</button
        >{:else}<span class="small muted"
          >{allowCategoryChange
            ? 'Zatwierdź postać przyciskiem u góry karty.'
            : 'Zmiany zapisują się automatycznie.'}</span
        >{/if}
    </div>
  </div>
</div>
