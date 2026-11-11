# Exilium · Archiwum postaci

A private, self-hosted Polish character creator and session tracker for **Savage Worlds PL 2015** and Exilium. Sized for around five players, human characters, no supernatural options. Starting equipment budget: **400 Exilium dollars**. Saved advances use the character's **current rank**, as agreed for this table.

The local application includes:

- Discord OAuth sign-in for members of one configured Discord server, revocable sessions and shared character reading with role-aware editing and section privacy.
- Guided creation, saved drafts and manual entry of existing characters with explicit historical XP/advance baselines.
- Optional [book archetypes](docs/archetypes.md) for quick creation: 12 mundane human builds with previews, editable stats and explicit remaining choices.
- Beginner help popups for traits, skills, dice, derived stats and session conditions; visible attribute explanations in step 2.
- Explicit origin/caste/profession dropdowns, custom entries and guide-backed descriptions of 12 origins and all five castes.
- Optional portrait uploads (JPG/PNG, up to 5 MB) and appearance text, readable by signed-in players and included in print/PDF output.
- Descriptions and prerequisites before selecting Hindrances/Edges; GM-consent warnings for wealth options because the party starts poor.
- Point budgets, prerequisites, derived statistics, character equipment and descriptive cybernetic limbs.
- A shared [equipment compendium](docs/compendium.md) with 117 initial entries; players submit additions and MG/Admin approve and maintain it without redeployment.
- Custom Wiedza specializations can be renamed or removed during creation.
- Wounds, fatigue, Shaken, Fuksy, ammunition/reloading, cash and electronic credits.
- In-app XP awards/corrections, rank changes, advancement previews, attribute/skill/Edge increases and development history.
- Player-recorded GM rulings and explicit numeric adjustments.
- Landscape A4 character sheet inspired by the 2015 manual, with PDF saving through the browser print dialog and embedded Polish fonts.
- Revision conflicts, retry deduplication, visible save state, latest-change undo, visible archive/restore controls on cards and sheets, and duplication.
- A nonroot production container, SQLite snapshots and a restore helper.

See [local validation and screenshots](docs/validation.md), [application design](docs/architecture.md), [rules decisions](docs/rules.md), [the full title-index audit](docs/catalog-audit.md), [graphics prompts](docs/graphics-prompts.md), [Docker Hub publishing](docs/ci.md), and [generic runtime setup](docs/deployment.md).

## Run locally

Requires Node **24.22.2 or later** and npm. The production image pins Node 24 LTS. No separate database service is needed.

```sh
npm ci
DEV_LOGIN_ENABLED=true npm run dev
```

Open **http://localhost:5173** and choose `Wejdź do lokalnego podglądu`. This development identity works only in the Vite development server, with that explicit environment setting. It is disabled in production builds even if the flag is set.

Development data is stored in `data/exilium.sqlite`, excluded from version control. To isolate a preview, set `DATABASE_PATH` to a different local file. For a `127.0.0.1` URL, also set `APP_ORIGIN=http://127.0.0.1:5173`; the configured origin must match the browser URL exactly.

For Discord sign-in:

1. Copy `.env.example` to `.env`.
2. Register a Discord application and the exact `/auth/discord/callback` for each configured origin.
3. Configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_GUILD_ID` (the numeric Discord server ID). The server ID is deployment configuration, never embedded in application code.
4. Restart the server. The app requests `identify guilds.members.read` automatically and verifies membership in that server before creating a session. No bot installation, token or privileged intent is needed. See [Discord OAuth setup](docs/discord-oauth.md).

Keep the client secret in `.env` or deployment secrets. The app never stores Discord access/refresh tokens. All current server members sign in as Players and can read shared sheets with section privacy applied. Creators, MG and Admin can edit sheets; only Admin manages users and roles; five players is a sizing target, not an admission limit. `DISCORD_ALLOWED_USER_IDS` is no longer used.

Membership is checked at each login. Existing app sessions last at most seven days and do not call Discord on each request, so leaving the server does not immediately revoke an active session. Changing the configured server rejects sessions issued for the previous server on their next request. Old allowlist sessions also require a fresh Discord login after upgrading; character ownership/data remain intact. Operators can disable an account in the database to end its access on the next request.

## Checks

```sh
npm run check
npm run lint
npm run check:public-source
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/exilium-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/exilium-browsers npm run test:e2e
docker build -t exilium:ci .
npm run test:container -- exilium:ci
```

PDF text/pagination tests additionally use the `pdftotext` and `pdfinfo` commands from Poppler. Browser tests create an isolated SQLite database under `/tmp` and do not reuse a running development server. The container smoke test creates and removes its own container and volume, publishes no port and uses no external network.

`npm run format` formats source and documentation. The production dependency audit is clean at implementation time. The development toolchain has a low-severity `deepmerge` advisory inherited through the Svelte Vite plugin; there is no fixed upstream release yet. These build tools are excluded from the production image's installed dependencies.

## Local production build

```sh
npm run build
APP_ORIGIN=https://characters.example.com DATABASE_PATH=./data/exilium.sqlite BODY_SIZE_LIMIT=6M npm start
```

Production uses Discord, never the development identity. `scripts/serve.mjs` is the production entry point: it validates the configured Host and supplies the declared scheme to SvelteKit. `APP_ADDITIONAL_ORIGINS` optionally enables exact additional origins, when explicitly configured. It does not enable cross-origin writes. The standalone Compose example binds to loopback. Configure TLS and access policy externally; keep actual deployment settings private. Discord needs internet access during sign-in.

## Backup and restore

```sh
npm run backup -- ./data/backups/latest.sqlite
node scripts/restore.mjs ./data/backups/latest.sqlite /tmp/exilium-restore-check/exilium.sqlite
```

Snapshots capture committed WAL state consistently, include portrait image blobs, and clear sessions in the backup. Restore requires an **empty destination** and refuses to replace an existing database or WAL files. For a real restore, stop the application, retain the existing data directory separately, and restore into a fresh one. Restart and sign in again. Do not restore a database while its application is running.

Uploaded portraits are decoded, oriented, reduced to at most 800 pixels per side and re-encoded as JPEG with metadata removed. They are readable by signed-in players through the character sheet; its creator, MG or Admin can upload or remove them. Portraits use private ETag revalidation, with authentication checked before each response. Replaced images are retained for undo and duplicated sheets. Existing saved characters gain empty optional portrait/appearance fields automatically.

Autosaves keep text controls focused and preserve newer typing while requests are in flight. Session actions wait for the latest text to save. The original app artwork is delivered as responsive compressed WebP assets with content-hashed cache URLs. See [graphics delivery details](docs/graphics-prompts.md).

## Current boundaries

The equipment picker reads the persistent shared compendium and supports manual items. Adding equipment makes a snapshot; catalog changes never alter existing inventories. Conditional armor, weapon properties, environmental effects and most combat Edge effects remain table-resolved and appear as notes. Weight stays in the supplied book's units; no kilogram conversion is assumed. The main armor total covers the torso and uses the highest applicable armor, with conditional protections recorded in notes.

Dice, initiative, encounters, shared logs, offline editing, English localization and automated cybernetic bonuses are outside this release. The supplied newer `SWEP_karta3.pdf` is a visual reference; the 2015 book drives mechanics.

## Version 0.2.0: roles, privacy and API

The footer and `/api/health` display the release version from `package.json`. See [changelog](CHANGELOG.md) and [roles, privacy and API](docs/access-and-api.md) for the permission matrix, administrator bootstrap, item review workflow and scoped token API. The administrator panel is `/users`; personal tokens are managed at `/account`.

Set `DEPLOYMENT_ADMIN_DISCORD_ID` to the app owner's Discord user ID in deployment settings. New users default to Player. `/compendium` accepts Player proposals for GM/Admin approval. Statistics, background, origin and equipment have independent privacy switches, enforced in page data, API and PDF/print exports. Creators and MG always see full details. Administrators see private sections hidden by default and can explicitly reveal them on each sheet.

Interactive [Swagger / OpenAPI](docs/access-and-api.md#swagger--openapi) documentation is available at `/api-docs` after signing in, with bearer-token execution and a downloadable `/api/openapi.json` specification. Swagger assets are self-hosted and loaded only on the docs page.
