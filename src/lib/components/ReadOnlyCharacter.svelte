<script lang="ts">
  import { attributes, edges, hindrances, skillInfo } from '../content/catalog';
  import { attributeGuides, playerHelp, skillHelp } from '../content/help';
  import { originDescriptions, casteDescriptions } from '../content/setting';
  import { derived as calculateStats, traitValue } from '../rules/engine';
  import { exportView, formatDie } from '../rules/export';
  import type { CharacterRecord } from '../rules/model';
  import HiddenSection from './HiddenSection.svelte';
  import HelpPopover from './HelpPopover.svelte';
  import RuleDescription from './RuleDescription.svelte';

  let {
    record,
    history,
    eventLabels,
  }: {
    record: CharacterRecord;
    history: { id: number; kind: string; date: string }[];
    eventLabels: Record<string, string>;
  } = $props();
  let c = $derived(record.document);
  let d = $derived({ ...calculateStats(c), ...record.visibleStats });
  let v = $derived(exportView(c, record.visibleStats));
  const kinds = { gear: 'Sprzęt', weapon: 'Broń', armor: 'Pancerz', cybernetic: 'Cybernetyka' };
  const coverage = { torso: 'tułów', head: 'głowa', arms: 'ręce', legs: 'nogi', all: 'całe ciało' };
</script>

<div class="read-only-sheet">
  {#if record.status === 'draft'}<p class="notice">
      To szkic postaci. Wybory i budżety czekają na zatwierdzenie przez twórcę.
    </p>{/if}
  <section class="panel">
    <h2>Karta postaci</h2>
    <div class="stat-row">
      {#each [['Obrona', d.parry, 'parry'], ['Wytrzymałość', d.totalToughness, 'toughness'], ['Tempo', d.pace, 'pace'], ['Charyzma', d.charisma, 'charisma']] as [label, value, key]}<div
          class="stat-tile"
        >
          <div class="help-heading">
            <span>{label}</span><HelpPopover help={playerHelp[key as string]} />
          </div>
          <strong>{value}</strong>
          {#if key === 'toughness'}<small>{d.toughness} + {d.armor} pancerza</small
            >{:else if key === 'pace'}<small>bieganie k{d.running}</small>{/if}
        </div>{/each}
    </div>
  </section>
  <div class="split-panel">
    <section class="panel">
      <div class="help-heading">
        <h3>Cechy</h3>
        <HelpPopover help={playerHelp.attributes} />
      </div>
      <div class="attribute-display">
        {#each Object.entries(attributes) as [key, label]}<div>
            <div class="help-heading">
              <span>{label}</span><HelpPopover
                help={attributeGuides[key as keyof typeof attributes]}
              />
            </div>
            <b class="die-badge">{formatDie(traitValue(d.build, key))}</b>
          </div>{/each}
      </div>
      <div class="help-heading">
        <span>Kość Figury: k6</span><HelpPopover help={playerHelp.dice} />
      </div>
    </section>
    <section class="panel">
      <div class="help-heading">
        <h3>Umiejętności</h3>
        <HelpPopover help={playerHelp.skills} />
      </div>
      <div class="skill-list">
        {#each Object.keys(d.build.skills).sort( (a, b) => (skillInfo(a)?.name || a).localeCompare(skillInfo(b)?.name || b, 'pl') ) as key}<div
          >
            <div class="skill-name">
              <span>{skillInfo(key)?.name || key}</span><HelpPopover help={skillHelp(key)} />
            </div>
            <strong
              >{formatDie(traitValue(d.build, key))}{#if d.skillModifiers[key]}
                ({d.skillModifiers[key] > 0 ? '+' : ''}{d.skillModifiers[key]}){/if}</strong
            >
          </div>{/each}
      </div>
      <p class="small muted">
        Niewykupiona: k4−2. Modyfikatory sytuacyjne sprawdź w opisach przewag i zawad.
      </p>
    </section>
  </div>
  <section class="panel">
    <h3>Podczas sesji</h3>
    <p>{v.conditions}</p>
    <div class="session-help">
      {#each [['Rany', 'wounds'], ['Zmęczenie', 'fatigue'], ['Szok', 'shaken'], ['Fuksy', 'bennies'], ['Wyeliminowanie', 'incapacitated']] as [label, key]}<div
          class="help-heading"
        >
          <span>{label}</span><HelpPopover help={playerHelp[key]} />
        </div>{/each}
    </div>
  </section>
  <div class="split-panel">
    <section class="panel">
      <div class="help-heading">
        <h3>Przewagi</h3>
        <HelpPopover help={playerHelp.edges} />
      </div>
      {#each d.build.edges as e}<div class="rule-entry">
          <b
            >{edges.find((item) => item.id === e.id)?.name}{e.target
              ? ` [${skillInfo(e.target)?.name || attributes[e.target as keyof typeof attributes] || c.inventory.find((item) => item.id === e.target)?.name || e.target}]`
              : ''}</b
          >
          <RuleDescription kind="edge" id={e.id} showTitle={false} />
        </div>{/each}
      {#if !d.build.edges.length}<p class="muted">Brak przewag.</p>{/if}
    </section>
    <section class="panel">
      <div class="help-heading">
        <h3>Zawady</h3>
        <HelpPopover help={playerHelp.hindrances} />
      </div>
      {#each d.build.hindrances as h}<div class="rule-entry">
          <b
            >{hindrances.find((item) => item.id === h.id)?.name}
            <span class="muted small">{h.severity === 1 ? 'drobna' : 'poważna'}</span></b
          >
          <RuleDescription kind="hindrance" id={h.id} showTitle={false} />
        </div>{/each}
      {#if !d.build.hindrances.length}<p class="muted">Brak zawad.</p>{/if}
    </section>
  </div>
  <section class="panel">
    <h3>Koncepcja i Exilium</h3>
    <p>{v.description}</p>
    {#if record.redacted?.includes('origin')}<HiddenSection label="Pochodzenie" />{/if}
    {#if record.redacted?.includes('background')}<HiddenSection label="Historia" />{/if}
    {#if originDescriptions[c.origin]}<div class="help-heading">
        <b>Pochodzenie: {c.origin}</b><HelpPopover help={playerHelp.origin} />
      </div>
      <p>{originDescriptions[c.origin]}</p>{/if}
    {#if casteDescriptions[c.caste]}<div class="help-heading">
        <b>Status społeczny: {c.caste}</b><HelpPopover help={playerHelp.caste} />
      </div>
      <p>{casteDescriptions[c.caste]}</p>{/if}
    {#each [['Wygląd', c.appearance], ['Historia', c.background], ['Motywacja', c.motivation], ['Przynależność', c.affiliation]] as [label, text]}{#if text}<h4
        >
          {label}
        </h4>
        <p class="prose">{text}</p>{/if}{/each}
  </section>
  <section class="panel">
    <h3>Ekwipunek</h3>
    {#if record.redacted?.includes('equipment')}<HiddenSection label="Ekwipunek" />{:else}
      <p>{v.funds}</p>
      <p>{v.load}</p>
      {#each c.inventory as item}<div class="rule-entry">
          <h4>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</h4>
          <p>
            {kinds[item.kind]} · {item.equipped ? 'używany' : 'nieużywany'} · {item.carried
              ? 'niesiony'
              : 'przechowywany'} · Cena: {item.price} $ / szt. · Waga: {item.weight ?? '?'} jedn. SW /
            szt.
          </p>
          {#if item.kind === 'weapon'}<p>
              Obrażenia: {item.damage || '—'} · Zasięg: {item.range || '—'} · Obrona: {item.parry >
              0
                ? '+'
                : ''}{item.parry} · Amunicja: {item.loaded}/{item.capacity}; zapas {item.reserve}
            </p>{/if}
          {#if item.kind === 'armor'}<p>
              Pancerz: {item.armor} · Osłona: {coverage[item.coverage]}
            </p>{/if}
          {#if item.notes}<p class="prose">{item.notes}</p>{/if}
        </div>{/each}
      {#if !c.inventory.length}<p class="muted">Brak przedmiotów.</p>{/if}{/if}
  </section>
  <section class="panel">
    <div class="help-heading">
      <h3>Doświadczenie i rozwinięcia</h3>
      <HelpPopover help={playerHelp.advancement} />
    </div>
    <p>{v.advancement}</p>
    {#if v.legacy}<p>{v.legacy}</p>{/if}
    <h4>Doświadczenie</h4>
    {#each v.xp as line}<p>{line}</p>{/each}
    {#if !v.xp.length}<p class="muted">Brak zapisów PD.</p>{/if}
    <h4>Rozwinięcia</h4>
    {#each v.history as line}<p>{line}</p>{/each}
    {#if !v.history.length}<p class="muted">Brak zapisanych rozwinięć.</p>{/if}
  </section>
  <section class="panel">
    <h3>Notatki z sesji</h3>
    <p class="prose">{c.notes || 'Brak notatek.'}</p>
  </section>
  <section class="panel">
    <h3>Decyzje MG — zapis gracza</h3>
    {#each c.rulings as ruling}<div class="rule-entry">
        <h4>{ruling.ruling}</h4>
        <p>{ruling.reason}</p>
        <p class="small muted">{ruling.code} · {new Date(ruling.date).toLocaleString('pl-PL')}</p>
      </div>{/each}
    {#if v.adjustments}<p>{v.adjustments}</p>{/if}
    {#if !c.rulings.length && !v.adjustments}<p class="muted">Brak zapisanych decyzji.</p>{/if}
  </section>
  <section class="panel">
    <h3>Historia zmian</h3>
    {#each history as event}<div class="history-row">
        <span class="history-dot"></span><b>{eventLabels[event.kind] || event.kind}</b><time
          >{new Date(event.date).toLocaleString('pl-PL')}</time
        >
      </div>{/each}
    {#if !history.length}<p class="muted">Historia zacznie się od pierwszej zmiany.</p>{/if}
  </section>
</div>

<style>
  .read-only-sheet {
    display: grid;
    gap: 1.25rem;
  }
  .prose {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .session-help {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
</style>
