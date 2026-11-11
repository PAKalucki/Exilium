# Exilium application design

A Polish creator and interactive sheet tracker for Savage Worlds PL 2015 and grounded Exilium science fiction: humans only, no supernatural powers or alien races.

## Product rules

Guide new players through concept, traits, Edges/Hindrances, skills, equipment and validation with explanations. Optional book archetypes prefill an editable build, with Hindrances and remaining skill points chosen by the player. Begin with 400 Exilium dollars. Validate prerequisites and budgets with explicitly recorded GM exceptions; use the current rank when spending saved advances. Support existing-character entry, descriptive cybernetic limbs, portraits, appearance, world origins/status, inventory, money, session conditions, XP and leveling. Unknown weights remain unknown and conditional equipment effects remain descriptive unless implemented by the rules engine.

## State and permissions

SvelteKit/TypeScript and Node 24 LTS use SQLite for documents, portraits, accounts, catalog and audit events. Commands run transactionally with revisions and idempotent command IDs. Preserve text/caret through background saves; serialize explicit actions after pending text.

Discord OAuth verifies a deployment-configured guild. Player edits own sheets and reads shared projections; GM edits all sheets and moderates equipment; Admin additionally manages accounts/roles. New users are Players and the owner's Admin identity is environment-configured. Statistics, background, origin and equipment/resources have independent server-enforced visibility controls, including exports and APIs. Owners and GM always see full details; Admin explicitly reveals other people's private sections before viewing or editing them. The character list can be filtered by all creators, the viewer's own characters or one selected creator, alongside its archive filter.

A persistent shared catalog accepts Player proposals and GM/Admin review without a release. Inventory copies retain their saved price/statistics. Personal tokens are scoped to reads and catalog writes, inherit current roles and expire/revoke independently. Swagger/OpenAPI documents the automation contract.

## Delivery boundaries

Provide desktop/tablet editing with a live connection, A4 print/PDF, consistent snapshots, nonroot AMD64/ARM64 images and a package-derived version in the footer/health API. Keep actual origins, network policy, infrastructure code/state, deployment commands and live acceptance outside public application source.

Offline editing, initiative/encounters, shared session logs, English localization and automated cybernetic mechanics are outside the current release. See [rules](rules.md), [roles/API](access-and-api.md), [catalog](compendium.md) and [validation](validation.md).
