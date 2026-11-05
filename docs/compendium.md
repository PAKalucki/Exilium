# Shared equipment compendium

Open **Kompendium** in the main navigation. Every signed-in campaign member may add, edit, archive and restore equipment entries. Each save records its author, time and before/after values. There is no separate catalog-editor role or approval queue.

The initial database contains **117 entries** from the supplied Polish 2015 rulebook, printed pages 55–62: travel gear, tools, clothing, food, electronics, surveillance equipment, ammunition, melee weapons, bows, firearms, energy weapons and armor. Energy weapons are explicitly present in the Exilium guide. Vehicles, mounts, fantastical weapons and military-only equipment with no numeric purchase price are omitted from this carryable-item catalog.

Book prices are a starting point for the group, not an assertion of Exilium availability. Update the source field when recording house prices or modified statistics. Unknown book weights remain unknown; the app does not invent a kilogram conversion. Fractional arrow prices are represented as two-arrow packs costing one dollar. Conditional armor, minimum Strength, rate of fire and other special rules remain in notes; laser-only armor is not added to general Toughness. Ammunition packs do not automatically refill a weapon's counters. The ordinary starting budget remains **400 dollars**.

## Updating during play

- Use **Dodaj wpis** for a new template or **Edytuj** for an existing one. Save explicitly with **Zapisz wpis kompendium**.
- Search ignores Polish accent differences. Categories are editable text, so a new category does not require a new app version.
- **Historia** shows up to 100 recent events. All events remain in the database and its backups.
- **Archiwizuj** removes an entry from future equipment choices without deleting its history. Restore it from **Archiwum wpisów**.
- Refresh the list or the equipment picker to see another player's latest changes. Updates do not require an image build, app restart or redeployment.

The creator and the active sheet's item editor fetch the same live catalog. Choosing an entry copies its current values into an independent inventory item with a fresh ID. You can adjust that copy before adding it. Catalog edits and archiving never rewrite existing character inventories, prices paid, ammo counters or item references used by Edges. Character editing remains restricted to its creator.

Concurrent saves use revisions: a stale edit returns a conflict instead of replacing another player's work. The unsaved form stays intact. Cancel the edit, refresh the list and reopen the current entry before reapplying your changes. If a response is lost, **Ponów zapis kompendium** repeats the same command ID and does not duplicate the entry or audit event.

## Persistence and maintenance

Schema migration **4** adds `equipment_catalog` and `equipment_catalog_events`. It inserts the initial catalog once, in one transaction, while retaining characters, portraits, users and sessions. The source seed in `src/lib/content/equipment-seed.ts` bootstraps new databases only. Later application starts and redeployments never overwrite edited or archived entries. Maintain the live catalog through the app.

Catalog data lives in the same persistent SQLite volume as the character sheets and is included in the existing consistent snapshots. The restore helper accepts schema versions 1–4; restoring into an empty destination retains catalog records/history and clears restored login sessions. No additional service, secret, external database or Discord scope is required.

Authenticated routes:

- `GET /api/compendium`: active entries; `?archived=1` includes archived entries.
- `POST /api/compendium`: create with `commandId` and `document`.
- `GET /api/compendium/{id}`: current record and recent history.
- `POST /api/compendium/{id}`: revision-checked `update`, `archive` or `restore` command.

The server derives the actor from the session, validates the complete item schema and applies the same origin protection as character mutations. Anonymous reads and writes are denied.

## Custom Knowledge fields

Creator step 4 now provides **Zmień nazwę** and **Usuń Wiedzę** for custom specializations. Renaming keeps the die and updates targeted Edge references. Removal recalculates the point budget and clears affected Edge choices, which must be selected again. Empty and duplicate names are rejected. Standard system skills are not renamed through these controls.
