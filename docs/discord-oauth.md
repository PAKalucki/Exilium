# Discord OAuth setup

Exilium admits anyone who is a member of one configured Discord server. Every signed-in player can read every character sheet, including drafts, archives, notes, portraits and PDF/print exports. Only its creator can edit a sheet. The server ID is read from `DISCORD_GUILD_ID` at deployment; it is not embedded in the application or example configuration. There is no user-ID allowlist or five-account admission cap.

## Developer Portal

1. Open your application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **OAuth2 → Redirects**, register each exact application origin followed by `/auth/discord/callback`. For local development use `http://localhost:5173/auth/discord/callback`; for your own HTTPS host use `https://characters.example.com/auth/discord/callback`.
3. Copy the Client ID and Client Secret into deployment configuration. The app uses the OAuth client secret, not a bot token. Keep the secret out of chat/version control.
4. The app automatically requests `identify guilds.members.read`. Start login from **Zaloguj przez Discord** so state and PKCE are created correctly. The URL Generator, bot installation, privileged intents and role permissions are not needed.

Discord documents [authorization-code login and scopes](https://docs.discord.com/developers/topics/oauth2), and the [current-user guild-member endpoint](https://github.com/discord/discord-api-docs/blob/main/developers/resources/user.mdx#get-current-user-guild-member).

## Environment

```dotenv
APP_ORIGIN=http://localhost:5173
APP_ADDITIONAL_ORIGINS=
DATABASE_PATH=./data/preview.sqlite
BODY_SIZE_LIMIT=6M
DISCORD_CLIENT_ID=YOUR_APPLICATION_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET
DISCORD_GUILD_ID=YOUR_DISCORD_SERVER_ID
DEV_LOGIN_ENABLED=false
```

Use your current database path; `preview.sqlite` is the existing local preview database. In production use the mounted database path and the configured HTTPS origin. `APP_ORIGIN` has no trailing slash and must match the browser origin, including host and port. `localhost` and `127.0.0.1` are different origins. Restart the app after changing its environment. Remove the old `DISCORD_ALLOWED_USER_IDS` setting; it is ignored.

Set `APP_ORIGIN` to the externally reachable application origin and register its exact callback with Discord. Optional additional origins need their own callback registration. Start production with `npm start`. Each origin uses its own browser cookies, and a login must return to the origin where it began. HTTPS cookies are Secure.

To get the server ID, enable **Discord User Settings → Advanced → Developer Mode**, then right-click the server icon → **Copy Server ID**. Use the numeric server ID, not an invite link, channel ID or user ID. [Discord ID instructions](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID)

## Verification and session behavior

- Sign in as a server member and accept the additional membership permission. Existing Discord authorization may need consent again for the added scope.
- An account outside that server must be denied. A failed or unavailable membership check must not create a session.
- The backend needs outbound Discord access during login. The browser returns to the registered application callback.
- Membership is checked at each login. Local sessions last at most seven days without further Discord calls; leaving or being kicked from the server does not immediately revoke an active session. Operators can disable the account or remove its sessions for immediate revocation on its next request.
- Changing the configured server rejects old guild-bound sessions on the next request. Upgrading from user-ID-based access also requires a fresh Discord login. Characters remain attached to the same stable Discord user identity.
- The app discards access/refresh tokens after checking membership. It does not read channels/messages or enforce a Discord role.
- The development preview identity has separate characters from your real Discord account.

`/api/health` reports `authenticationConfigured: true` when the client settings and a valid numeric server ID are present. That flag does not establish that the credentials are accepted by Discord; verify an actual login.
