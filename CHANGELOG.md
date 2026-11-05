# Changelog

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
