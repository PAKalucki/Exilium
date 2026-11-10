<script lang="ts">
  import { dice } from '../content/catalog';
  import type { exportView } from '../rules/export';
  import { portraitUrl } from '../portraits';

  let {
    view: v,
    characterId,
    revision,
    date,
  }: {
    view: ReturnType<typeof exportView>;
    characterId: string;
    revision: number;
    date: string;
  } = $props();
  let weapons = $derived(v.inventory.filter((item) => item.kind === 'weapon'));
  let equipment = $derived(v.inventory.filter((item) => item.kind !== 'weapon'));
  let supplements = $derived(
    [
      { title: 'Wygląd', lines: [v.appearance] },
      { title: 'Historia i motywacja', lines: [v.background, v.motivation, v.affiliation] },
      { title: 'Notatki', lines: [v.notes] },
      { title: 'Doświadczenie i rozwinięcia', lines: [v.legacy, ...v.xp, ...v.history] },
      { title: 'Decyzje MG — zapis gracza', lines: [...v.rulings, v.adjustments] },
    ]
      .map((section) => ({ ...section, lines: section.lines.filter(Boolean) }))
      .filter((section) => section.lines.length),
  );
</script>

{#snippet dieTrack(value: number)}
  <span class="dice-track" aria-hidden="true">
    {#each dice as die}
      <span class="die" class:selected={Math.min(value, 12) === die}><span>{die}</span></span>
    {/each}
  </span>
{/snippet}

<article class="print-sheet" aria-label={`Karta do druku: ${v.name}`}>
  <header class="print-heading">
    <div class="print-identity">
      <p class="sheet-kicker">Savage Worlds · Edycja Polska 2015</p>
      <h1>{v.name}</h1>
      <p class="identity-line">{v.description}</p>
    </div>
    {#if v.portraitId}
      <img
        class="print-portrait"
        src={portraitUrl(characterId, v.portraitId)}
        alt={`Portret: ${v.name}`}
        width="62"
        height="78"
      />
    {/if}
    <div class="print-emblem"><strong>EXILIUM</strong><span>Karta postaci</span></div>
  </header>
  <div class="advancement-strip">
    <span><b>Ranga</b> {v.rank}</span>
    <span><b>Doświadczenie</b> {v.experience} PD</span>
    <span><b>Niewydane rozwinięcia</b> {v.unspentAdvances}</span>
    <span><b>Kość Figury</b> k6</span>
  </div>
  <div class="print-columns">
    <section class="traits-column" aria-labelledby="print-traits">
      <h2 id="print-traits">Cechy i umiejętności</h2>
      {#each v.traitGroups as group}
        <div class="trait-group">
          <div class="attribute-line">
            <h3>{group.label}</h3>
            {@render dieTrack(group.die)}
            <b class="trait-value">{group.value}</b>
          </div>
          {#each group.skills as skill}
            <div class="skill-line" class:untrained={!skill.die}>
              <span class="skill-label">{skill.label}</span>
              {@render dieTrack(skill.die)}
              <b class="trait-value"
                >{skill.value}{skill.modifier
                  ? ` (${skill.modifier > 0 ? '+' : ''}${skill.modifier})`
                  : ''}</b
              >
            </div>
          {/each}
        </div>
      {/each}
      <p class="sheet-caption">Niewykupiona umiejętność: k4−2. Zaznaczono aktualne kości.</p>
    </section>
    <div class="equipment-column">
      <section aria-labelledby="print-weapons">
        <h2 id="print-weapons">Broń</h2>
        <table class="weapons-table">
          <thead><tr><th>Broń</th><th>Zasięg</th><th>Obrażenia</th><th>Amunicja</th></tr></thead>
          <tbody>
            {#each weapons as item}
              <tr>
                <td
                  ><b>{item.name}</b><span class="item-note"
                    >{item.weight} SW · {item.carried ? 'niesiony' : 'przechowywany'}{item.notes
                      ? ` · ${item.notes}`
                      : ''}</span
                  ></td
                >
                <td>{item.range || '—'}</td><td>{item.damage || '—'}</td><td
                  >{item.ammunition || '—'}</td
                >
              </tr>
            {:else}
              <tr><td colspan="4" class="empty-cell">Brak zapisanej broni.</td></tr>
            {/each}
          </tbody>
        </table>
      </section>
      <section class="equipment-section" aria-labelledby="print-equipment">
        <h2 id="print-equipment">Sprzęt i pancerz</h2>
        <table>
          <thead
            ><tr><th>Przedmiot / właściwości</th><th class="weight-cell">Waga SW</th></tr></thead
          >
          <tbody>
            {#each equipment as item}
              <tr
                ><td><b>{item.name}</b><span class="item-note">{item.detail}</span></td><td
                  class="weight-cell">{item.weight}</td
                ></tr
              >
            {:else}
              <tr><td colspan="2" class="empty-cell">Brak zapisanego sprzętu.</td></tr>
            {/each}
          </tbody>
        </table>
        <div class="resources">
          <p>{v.funds}</p>
          {#if v.load}<p>{v.load}</p>{/if}
        </div>
      </section>
      <section class="field-notes" aria-label="Miejsce na notatki z sesji">
        <h2>Notatki z sesji</h2>
        <div class="ruled-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </section>
    </div>
    <div class="reference-column">
      <section aria-labelledby="print-stats">
        <h2 id="print-stats">Współczynniki</h2>
        <dl class="combat-stats">
          {#each v.combatStats as stat}
            <div>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
              <small>{stat.note || '\u00a0'}</small>
            </div>
          {/each}
        </dl>
      </section>
      <section class="session-section" aria-labelledby="print-session">
        <h2 id="print-session">Podczas sesji</h2>
        {#each [{ label: 'Rany', count: v.session.wounds, max: 3 }, { label: 'Zmęczenie', count: v.session.fatigue, max: 3 }] as track}
          <div class="condition-line">
            <b>{track.label}</b>
            <span class="condition-boxes" aria-hidden="true">
              {#each Array(track.max) as _, index}
                <span class:marked={index < track.count}>{index < track.count ? '×' : ''}</span>
              {/each}
            </span>
            <span>{track.count}/{track.max}</span>
          </div>
        {/each}
        <div class="condition-line">
          <b>Szok</b><span>{v.session.shaken ? 'TAK' : 'NIE'}</span><b>Fuksy</b><span
            class="benny-count">{v.session.bennies}</span
          >
        </div>
        <p class="condition-summary">
          Kara za Rany i Zmęczenie: −{v.session.penalty}{#if v.session.incapacitated}<br /><b
              >WYELIMINOWANIE</b
            >{/if}
        </p>
      </section>
      {#each [{ title: 'Zawady', lines: v.hindrances }, { title: 'Przewagi', lines: v.edges }] as section}
        <section class="abilities-section">
          <h2>{section.title}</h2>
          {#each section.lines as line}<p class="ability-entry">{line}</p>
          {:else}<p class="empty-cell">Brak.</p>{/each}
        </section>
      {/each}
      <p class="sheet-caption">Modyfikatory sytuacyjne sprawdź w opisach przewag i zawad.</p>
    </div>
  </div>
  {#if supplements.length}
    <div class="print-supplements">
      {#each supplements as section}
        <section class="print-section">
          <h2>{section.title}</h2>
          {#each section.lines as line}<p class="print-text">{line}</p>{/each}
        </section>
      {/each}
    </div>
  {/if}
  <footer class="print-record">
    <span>EXILIUM · {v.ruleset}</span><span>Zapis {revision} · {date}</span>
  </footer>
</article>

<style>
  .print-sheet {
    width: 297mm;
    max-width: calc(100% - 32px);
    margin: 24px auto 40px;
    padding: 10mm;
    background: #fff;
    color: #171717;
    box-shadow: 0 3px 24px #0002;
    font-family: Exilium, Arial, sans-serif;
    font-size: 8pt;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .print-sheet p {
    margin: 0;
    line-height: 1.5;
  }
  .print-heading {
    display: flex;
    align-items: center;
    gap: 5mm;
    border-bottom: 2px solid;
    padding-bottom: 3mm;
  }
  .print-identity {
    flex: 1;
    min-width: 0;
  }
  .sheet-kicker {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 1.4px;
  }
  .print-sheet h1 {
    font-size: 26pt;
    line-height: 1.15;
    letter-spacing: -0.6px;
    margin: 1mm 0 2mm;
    font-weight: 700;
  }
  .identity-line {
    font-size: 8pt;
  }
  .print-portrait {
    width: 16mm;
    height: 20mm;
    object-fit: contain;
  }
  .print-emblem {
    text-align: center;
    border: 2px solid;
    padding: 2mm 4mm;
    flex-shrink: 0;
  }
  .print-emblem strong {
    display: block;
    font-family: Georgia, serif;
    font-size: 19pt;
    letter-spacing: 1px;
  }
  .print-emblem span {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .advancement-strip {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 2mm 5mm;
    border-bottom: 1px solid;
    padding: 1.5mm 0;
    margin-bottom: 3mm;
    font-size: 7.5pt;
  }
  .advancement-strip b {
    margin-right: 1mm;
  }
  .print-columns {
    display: grid;
    grid-template-columns: 1.08fr 1.25fr 1fr;
    gap: 6mm;
  }
  .print-columns > * {
    min-width: 0;
  }
  .print-sheet h2 {
    font-size: 13pt;
    font-weight: 700;
    font-variant: small-caps;
    letter-spacing: 0;
    line-height: 1.2;
    border-bottom: 1.5px solid;
    padding-bottom: 1.2mm;
    margin: 0 0 2mm;
    break-after: avoid;
  }
  .trait-group {
    margin-bottom: 1mm;
  }
  .attribute-line,
  .skill-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 25mm 13mm;
    align-items: center;
    gap: 2mm;
    min-height: 4.2mm;
    break-inside: avoid;
  }
  .attribute-line {
    border-bottom: 1px solid;
    margin-top: 1mm;
    padding: 0.3mm 0;
  }
  .attribute-line h3 {
    font-family: Georgia, serif;
    font-size: 11pt;
    font-weight: 700;
    font-variant: small-caps;
    letter-spacing: 0;
    line-height: 1.2;
    margin: 0;
  }
  .skill-line {
    border-bottom: 0.5px solid #bbb;
    font-size: 7.2pt;
  }
  .skill-label {
    padding-left: 1.5mm;
  }
  .untrained {
    color: #555;
  }
  .trait-value {
    text-align: right;
    font-size: 7pt;
  }
  .dice-track {
    display: flex;
    justify-content: space-between;
    gap: 1mm;
    padding: 0.4mm 1mm;
  }
  .die {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3mm;
    height: 3mm;
    border: 0.6px solid #777;
    transform: rotate(45deg);
    flex-shrink: 0;
    font-size: 5.5pt;
    line-height: 1;
  }
  .die > span {
    transform: rotate(-45deg);
  }
  .die.selected {
    background: #171717;
    color: #fff;
    border: 1.5px solid #171717;
    outline: 1px solid #171717;
    outline-offset: 0.5px;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    font-weight: 700;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 7.3pt;
  }
  th {
    text-align: left;
    font-size: 6.5pt;
    font-weight: 700;
    border-bottom: 1px solid;
    padding: 0 1mm 1.5mm;
  }
  td {
    padding: 2mm 1mm;
    border-bottom: 0.5px solid #aaa;
    vertical-align: top;
    white-space: pre-wrap;
  }
  tr {
    break-inside: avoid;
  }
  thead {
    display: table-header-group;
  }
  .weapons-table th:first-child {
    width: 37%;
  }
  .weapons-table th:nth-child(2) {
    width: 20%;
  }
  .weapons-table th:nth-child(3) {
    width: 21%;
  }
  .weapons-table th:nth-child(4) {
    width: 22%;
  }
  .item-note {
    display: block;
    font-size: 6.8pt;
    margin-top: 1mm;
  }
  .weight-cell {
    width: 17mm;
    text-align: right;
  }
  .empty-cell {
    color: #555;
    font-style: italic;
    font-size: 7pt;
    padding: 1.5mm 0;
  }
  .equipment-section,
  .field-notes,
  .session-section,
  .abilities-section {
    margin-top: 4mm;
  }
  .resources {
    margin-top: 2mm;
    font-size: 7pt;
  }
  .resources p + p {
    margin-top: 1mm;
  }
  .ruled-lines i {
    display: block;
    height: 6mm;
    border-bottom: 0.5px solid #aaa;
  }
  .combat-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2mm;
    margin: 0;
  }
  .combat-stats > div {
    border: 1px solid;
    border-radius: 3mm;
    text-align: center;
    padding: 1.5mm 1mm;
    break-inside: avoid;
  }
  .combat-stats dt {
    font-size: 7pt;
    font-weight: 700;
  }
  .combat-stats dd {
    font-family: Georgia, serif;
    font-size: 23pt;
    font-weight: 700;
    line-height: 1.15;
    margin: 0;
  }
  .combat-stats small {
    display: block;
    font-size: 6pt;
    line-height: 1.4;
  }
  .condition-line {
    display: flex;
    align-items: center;
    gap: 3mm;
    margin: 1.5mm 0;
    font-size: 8pt;
    break-inside: avoid;
  }
  .condition-line > b:first-child {
    margin-right: auto;
  }
  .condition-boxes {
    display: flex;
    gap: 1.2mm;
  }
  .condition-boxes span {
    border: 1px solid;
    width: 5mm;
    height: 5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16pt;
    line-height: 1;
  }
  .marked {
    font-weight: 700;
  }
  .benny-count {
    border: 1px solid;
    border-radius: 50%;
    min-width: 7mm;
    min-height: 7mm;
    text-align: center;
    padding: 1mm;
    font-weight: 700;
  }
  .condition-summary {
    font-size: 7pt;
  }
  .ability-entry {
    font-size: 7.4pt;
    border-bottom: 0.5px solid #aaa;
    padding: 1.5mm 0;
    white-space: pre-wrap;
    break-inside: avoid;
  }
  .print-sheet .sheet-caption {
    font-size: 6.5pt;
    margin-top: 2mm;
  }
  .print-supplements {
    border-top: 2px solid;
    margin-top: 5mm;
    padding-top: 4mm;
  }
  .print-section {
    margin-bottom: 4mm;
  }
  .print-text {
    white-space: pre-wrap;
    orphans: 3;
    widows: 3;
  }
  .print-text + .print-text {
    margin-top: 2mm;
  }
  .print-record {
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    border-top: 1px solid;
    padding-top: 2mm;
    margin-top: 4mm;
    font-size: 6pt;
    break-inside: avoid;
  }
  @media screen and (max-width: 1000px) {
    .print-sheet {
      padding: 6mm;
    }
    .print-columns {
      grid-template-columns: 1fr 1fr;
    }
    .traits-column {
      grid-row: span 2;
    }
  }
  @media screen and (max-width: 600px) {
    .print-heading {
      flex-wrap: wrap;
      gap: 3mm;
    }
    .print-identity {
      flex-basis: 70%;
    }
    .print-emblem {
      display: none;
    }
    .print-sheet h1 {
      font-size: 22pt;
    }
    .print-columns {
      display: block;
    }
    .equipment-column,
    .reference-column {
      margin-top: 5mm;
    }
    .advancement-strip {
      justify-content: flex-start;
    }
  }
  @media print {
    .print-sheet {
      width: auto;
      max-width: none;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
    .print-heading,
    .advancement-strip,
    .field-notes {
      break-inside: avoid;
    }
    .print-supplements {
      break-before: page;
      border-top: 0;
      margin-top: 0;
      padding-top: 0;
    }
  }
</style>
