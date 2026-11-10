# Application validation

The application has 101 unit/integration tests and 23 Chromium workflows. Run the commands in [README](../README.md) and inspect the matching CI result. Isolated checks do not establish the state of a hosted instance.

- Rules: creation budgets, the 400-dollar default, prerequisites/exceptions, rank thresholds and advancement limits. The independent title fixture accounts for all 111 book Edges and 48 Hindrances.
- Persistence: creator/GM permissions, audit actor identity, optimistic revisions, idempotent retries, transactional counters/money/ammunition and preservation during migrations. Grenade quantities save in drafts and purchases, while weapons with ammunition counters remain individual.
- Accounts: Player defaults, first/existing Admin bootstrap, protected/last Admin guards, stale changes, live role changes on credentials, disabling and token revocation.
- Catalog: 117-item one-time seed, persistent edits, approved-only pickers, pending visibility, rejection/resubmission, stale reviews and inventory snapshot independence.
- Privacy: independent switches and server-side redaction for page/API/print/PDF data; privileged reads retain content and public combat totals remain accurate.
- Portraits/exports: decoding, normalization, metadata and size limits, authorized updates, undo, ETag revalidation, Polish PDF text and pagination. The browser print dialog produces a landscape A4 sheet; a representative sheet fits one page, while long equipment lists, custom skills and narrative text preserve their endings across pages. Printing from a phone uses the same landscape layout.
- Recovery: consistent WAL snapshots preserve documents, roles, catalog/history and portraits; restores invalidate sessions and API tokens.
- Browser workflows: guided creation, beginner help, Knowledge rename/removal, trackers, equipment, advancement, permissions, approval and API tokens. Autosaves preserve focus/caret and newer text through delayed/lost responses and refresh races. Tablet and print layouts are exercised.
- Swagger: schema references resolve and examples validate against live Zod contracts. Browser execution uses a supplied token without session cookies, clears authorization on reload and fetches no external assets/validator.
- Production image: a disposable nonroot, read-only container with no published ports or external network verifies origin/cookie/header policy, CSRF, guild binding, production development-login denial, scoped tokens, Swagger assets, image/font delivery, snapshots and restart persistence.

Formatting, TypeScript/Svelte checks and the production dependency audit are part of CI. See [CI](ci.md) for linting and image scanning. Verify real OAuth consent, target-platform behavior, availability and scheduled recovery separately; keep those instance-specific results private.
