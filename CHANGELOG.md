# Changelog

## 0.6.0

- Add a shared combat panel with persistent encounters, existing character selection, NPC initiative groups, rounds and turn controls. MG/Admin manage combat; Players follow a privacy-filtered view.
- Implement 2015 card initiative with two Jokers, suit tie-breaks, Quick/Level Headed, held actions, opposed interrupts and ties, surprise, and Tactician reserves including detached Extra allies.
- Update linked character conditions transactionally, with revision checks and retry deduplication. Track damage/Soak, Shaken recovery, wounds, fatigue, personal/GM Fuksy and common defense/position markers.
- Add audited encounter storage in migration 6 and preserve it through snapshots/restores. Keep shuffled deck order server-side and require explicit Admin reveal for private participants.

## 0.5.0

- Add Figura (Wild Card, default) and GM-only Blotka (Extra) categories to creation, sheets, exports and the main character filter. Existing sheets default to Figura without rewriting saved data.
- Simplify Blotka creation with free stat and equipment assignment, editable active stats and no player budgets or XP advancement. Apply one-wound elimination, no individual Wild Die and no personal Fuksy.
- Enable all four independent privacy settings by default for new Blotki, copies and drafts converted to Blotka, preserving the usual owner/GM visibility and explicit administrator reveal.

## 0.4.1

- Make character archive/restore actions visible on character cards, in the sheet header and in Settings. Confirm archiving, preserve pending edits and restore the original draft/active state with existing edit/privacy permissions.

## 0.4.0

- Add a creator quick-start picker with 12 mundane book archetypes, stat previews, protected build replacement and ordinary creation validation; document the Rębacz budget correction.
- Filter the character list by all creators, your own characters or a selected user, independently of the current/archive view.
- Add independent statistics privacy alongside background, origin and equipment, enforced in shared sheets, character lists, API responses and print/PDF exports.
- Hide private sections from administrators by default, with an explicit per-sheet reveal/hide control; creators and MG always see full details.

## 0.3.1

- Rebuild the A4 print sheet in landscape, inspired by the 2015 manual's character sheet, with grouped skills, dice markers, equipment tables and condition trackers. Keep narrative text and long records on continuation pages.
- Replace separate print and PDF download buttons with one print/PDF action using the browser's print dialog.

## 0.3.0

- Open character portraits in a larger, uncropped dialog, with keyboard controls and responsive sizing for owners and read-only viewers.

## 0.2.6

- Enlarge character-sheet portraits and give the name its own flexible column, with responsive action placement on tablets and phones.

## 0.2.5

- Keep ammunition fields and focus stable while editing temporarily blank counters on an empty gun.

## 0.2.4

- Move character privacy controls into a dedicated Settings tab for drafts and active sheets.
- Hide ammunition fields and counters on melee weapons, grenades and ordinary items, including shared sheets and exports; allow custom weapons to enable ammunition tracking explicitly.

## 0.2.3

- Allow grenade and other weapon quantities when they have no ammunition counters, in creator drafts and active-sheet purchases.
- Keep weapons with ammunition counters separate and enforce their quantity limit in equipment forms.
- Remove shared BuildKit cache transfers that could stall CI after a successful image build.

## 0.2.2

- Keep public source and documentation application-specific; remove PLAN.md and retain relevant design in docs.
- Add ESLint, Trivy repository/image gates and scan artifacts, and Dependabot updates.
- Fix runtime image package findings and remove unused bundled package managers.

## 0.2.1

- Add authenticated, self-hosted Swagger UI and an OpenAPI 3.1 specification for the automation API, with scope-aware examples and bearer-only execution.
- Disable install analytics for the Swagger build dependency.

## 0.2.0

- Add Player, GM and Administrator roles, account disabling, and an audited administrator user panel.
- Require GM/Admin approval for Player compendium submissions; keep existing items approved.
- Add independent privacy settings for background, origin and equipment, enforced in shared reads and exports.
- Add scoped, expiring personal API tokens and read/compendium-write endpoints, plus GM/Admin diagnostics.
- Show the application version in the footer and health API; publish matching Docker version tags.
- Support configured application origins and HTTPS redirects behind a reverse proxy.

## 0.1.0

Initial Exilium character creator and tracker for Polish Savage Worlds 2015: Discord guild login, guided creation, advancement, session tracking, portraits, shared sheet reads, PDF/print export and persistent equipment compendium.

The original 0.1.0 builds were identified by immutable commit/image digests. Starting with 0.2.0, use semantic versions: patch for fixes, minor for compatible features, and major for incompatible changes. Update `package.json`, `package-lock.json` and this changelog together. The footer and health version are built from `package.json`; CI derives the Docker version tag and OCI version label from it. A `vX.Y.Z` Git tag must match the package version.
