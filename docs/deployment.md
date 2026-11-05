# Application deployment and operations

This document describes the application's runtime contract. Real hostnames, network inventories, infrastructure state and operational runbooks belong outside this public repository.

Build with `docker build -t exilium:local .` or use an immutable image from [CI](ci.md). The image supports Linux AMD64/ARM64, runs nonroot, and requires persistent writable `/data` storage and bounded `/tmp` storage. Configure your own HTTPS reverse proxy.

```dotenv
APP_ORIGIN=https://characters.example.com
APP_ADDITIONAL_ORIGINS=
DATABASE_PATH=/data/exilium.sqlite
BODY_SIZE_LIMIT=6M
DISCORD_CLIENT_ID=YOUR_APPLICATION_ID
DISCORD_CLIENT_SECRET=YOUR_PRIVATE_SECRET
DISCORD_GUILD_ID=YOUR_DISCORD_SERVER_ID
DEPLOYMENT_ADMIN_DISCORD_ID=YOUR_DISCORD_USER_ID
DEV_LOGIN_ENABLED=false
```

Store actual values privately. Register each origin plus `/auth/discord/callback` in Discord. Start with `npm start` / `node scripts/serve.mjs`; do not bypass the configured-host entry point with `node build`. It validates exact origins and prevents forwarded headers from choosing a host, callback or cookie policy. HTTPS termination is external. Optional additional origins do not enable cross-origin writes. When retiring an origin, remove its listener/proxy route, allowlist entry and OAuth callback in the private deployment configuration.

New users default to Player. The configured owner becomes the protected Administrator. Membership is checked during login; sessions last up to seven days, so leaving the guild does not immediately revoke an existing session. Disabling an account revokes its sessions and personal API tokens. Discord tokens are discarded after login.

## Recovery

Portraits, characters, catalog, accounts and audit history are all in SQLite. Snapshot committed WAL data consistently:

```sh
docker exec exilium node scripts/backup.mjs /data/backups/latest.sqlite
node scripts/restore.mjs SNAPSHOT.sqlite EMPTY_DESTINATION.sqlite
```

Restore requires an empty destination and refuses existing database/WAL files. Stop the application, preserve current data, restore into a fresh destination and verify before reopening access. Restores invalidate sessions and API tokens. Schema 5 adds roles, catalog approval and tokens without changing ownership; old catalog rows remain approved and old characters acquire visible privacy defaults. An image rollback does not undo a schema migration: keep a matching pre-upgrade snapshot and protect later player writes.

Snapshot before upgrades, deploy the reviewed immutable image, verify `/api/health` and authenticated operations, and rehearse restore separately. Keep scheduling, ingress policy, native-host verification and rollout commands in private operational documentation. See [OAuth setup](discord-oauth.md), [roles/API](access-and-api.md) and [validation](validation.md).
