# Roles, privacy and API (0.2.0)

Every new Discord guild member signs in as **Gracz** (`player`). `DEPLOYMENT_ADMIN_DISCORD_ID` bootstraps the app owner's Discord identity as **Administrator** (`admin`), including an existing account on restart. Keep this ID in deployment settings. The configured owner cannot be disabled or demoted through the app. There is no first-user-wins or email/name-based administrator grant.

| Capability                                           | Gracz                     | MG (`gm`)             | Administrator                              |
| ---------------------------------------------------- | ------------------------- | --------------------- | ------------------------------------------ |
| Create and edit own sheets                           | Yes                       | Yes                   | Yes                                        |
| Read other sheets                                    | With privacy applied      | Full                  | Privacy applied; explicit reveal available |
| Edit another person's sheet                          | No                        | Yes                   | Reveal private sections first              |
| Submit an item                                       | Pending approval          | Published immediately | Published immediately                      |
| Edit own pending/rejected item                       | Yes; resubmits for review | Yes                   | Yes                                        |
| Edit approved items, approve/reject, archive/restore | No                        | Yes                   | Yes                                        |
| Manage accounts and roles                            | No                        | No                    | Yes                                        |
| View diagnostics API                                 | No                        | Yes                   | Yes                                        |

The administrator uses `/users` to assign roles and enable/disable accounts after the person has signed in once. Changes are audited. A stale account change is rejected. The last active administrator cannot be disabled or demoted. Disabling an account invalidates its sessions and personal API tokens. Roles are read from the database for each session/token request, so changing a role also changes existing sessions and tokens immediately. GM edits retain the sheet's creator and record the GM's own actor ID.

## Archiving characters

Editors can choose **Archiwizuj** on a character card, **Archiwizuj postać** in the sheet header, or **Ustawienia → Zarządzanie postacią**. Archiving asks for confirmation and saves pending sheet edits first. The character leaves the current list, with its full document and change history retained. The creator filter also applies to the **Archiwum** view.

Archived cards and sheet headers offer **Przywróć postać**; Settings also offers restoration even while the rest of an archived sheet is read-only. Restoration returns a draft to draft status and a finalized character to active status. Only the creator, MG or Admin can archive/restore; an Admin must first reveal another person's private sheet. Ordinary readers have no management controls or mutation permission.

## Privacy

The **Ustawienia** tab on draft and active character sheets has four independent switches: **Ukryj statystyki**, **Ukryj historię**, **Ukryj pochodzenie**, and **Ukryj ekwipunek i zasoby**. All default to visible for new sheets. Existing privacy choices are preserved and statistics remain visible until explicitly hidden. “Historia” means the character's personal background. Statistics hiding covers attributes, skills, combat values, Edges, Hindrances, session conditions, XP, advances, legacy baselines and GM rulings/adjustments; change history is also omitted from that shared view. Equipment hiding includes inventory, cash, credits and targeted inventory references. When statistics remain public, combat totals are calculated from the full saved sheet before equipment redaction. Hiding statistics leaves independently public equipment and background visible, but omits carrying capacity and encumbrance that could disclose private traits.

Other players and, by default, administrators see placeholders. The actual hidden content is removed server-side from page data, list/detail API responses, print views and PDF exports. The creator and MG always see full content. Independently written session notes and motivations remain public; avoid copying a secret into another field if it should stay private.

An administrator can choose **Odkryj prywatne szczegóły** on another person's sheet, then **Ukryj prywatne szczegóły** to return to the private view. Reveal applies to that sheet's current URL and its print link, preserves the owner's privacy choices and does not enable disclosure on the character list or other sheets. Editing, copying and portrait uploads on a private sheet require explicit reveal first, so an administrator cannot save a redacted document over the original. The detail API, PDF endpoint and browser-session mutations accept `?revealPrivate=1` for this explicit administrator action; Players cannot bypass privacy with that parameter. MG never needs it.

Privacy changes cannot retract information another player already saw or exported while it was public. Existing saved inventory copies do not change when the compendium changes.

## Catalog approval

`/compendium` has available, pending, rejected and archived views. Players can see their own submissions; MG/Admin can see the full review queue. Pending/rejected items are excluded from all equipment pickers. Rejection requires a reason; the author can edit and resubmit. MG/Admin approval is tied to the displayed revision, so an old review cannot approve a newer unreviewed edit. Existing catalog rows are grandfathered as approved during schema migration 5. GM/Admin editing a pending entry publishes their reviewed version immediately. Archive never deletes audit history.

## Swagger / OpenAPI

Sign in and open **Moje konto → Swagger** at `/api-docs`. The interactive UI and all its assets are hosted by the app; no CDN or external specification validator receives data. `/api/openapi.json` returns the matching OpenAPI 3.1 document to a signed-in session or a `read` API token. The specification documents the automation API; session-only account/role/token management and character mutations remain outside the token API.

Use **Authorize** with a personal token. “Try it out” omits browser-session cookies, respects token scopes and role/privacy rules, and can make real catalog writes. Tokens are not persisted across a docs reload/navigation. Examples use UUIDs generated for that document instance: change `commandId` for a different write and retain it for a retry. No production OAuth secret or Discord token belongs in this form.

## Personal API tokens

Create/revoke a token at `/account` using a Discord browser session. The secret is shown once and stored only as a SHA-256 hash. Choose `read`, `compendium:write`, or both. Tokens expire in 1–90 days (default 30); each account may have up to 20 active tokens. Restoring a backup invalidates tokens and browser sessions. Tokens retain their issuing guild binding and cannot bypass a disabled account or the owner's current role.

Use `Authorization: Bearer TOKEN` over the configured HTTPS origin. Tokens accept originless machine requests on explicitly allowed API routes; an explicit foreign Origin is rejected. Cookie mutations still require a matching Origin. Tokens cannot manage accounts/roles/tokens or write character sheets, even for Administrators. Browser sessions can use those operations according to their role.

| Method   | Endpoint                                  | Token permission / behavior                                                        |
| -------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| GET      | `/api/health`                             | Public minimal status and application version                                      |
| GET      | `/api/me`                                 | `read`; current name, ID, role and scopes                                          |
| GET      | `/api/characters`                         | `read`; all sheets with viewer privacy                                             |
| GET      | `/api/characters/:id`                     | `read`; one sheet with viewer privacy                                              |
| GET      | `/api/characters/:id/pdf`                 | `read`; viewer privacy, optional explicit administrator reveal                     |
| GET      | `/api/characters/:id/portrait`            | `read`; authenticated portrait                                                     |
| GET      | `/api/compendium`                         | `read`; approved active catalog only                                               |
| GET      | `/api/compendium?archived=1`              | `read`; approved catalog plus own submissions, or all for MG/Admin                 |
| GET      | `/api/compendium/:id`                     | `read`; visible entry and last 100 audit events                                    |
| POST     | `/api/compendium`                         | `compendium:write`; submit/create                                                  |
| POST     | `/api/compendium/:id`                     | `compendium:write`; update/review/archive/restore by current role                  |
| GET      | `/api/diagnostics`                        | `read` plus MG/Admin; version, schema, SQLite check and row counts, no credentials |
| GET/POST | `/api/tokens`, `/api/tokens/:id` (DELETE) | Browser session only; own tokens                                                   |
| GET/POST | `/api/users`, `/api/users/:id`            | Administrator browser session only                                                 |

Example reads (load `EXILIUM_API_TOKEN` from your secret store; never commit it):

```sh
export EXILIUM_URL=https://characters.example.com
curl --fail --silent --show-error \
  -H "Authorization: Bearer $EXILIUM_API_TOKEN" \
  "$EXILIUM_URL/api/me"
```

### Write format and retry safety

Send `Content-Type: application/json`. Creation body:

```json
{
  "commandId": "NEW-UUID",
  "document": {
    "category": "Narzędzia",
    "source": "Exilium — ustalenie drużyny",
    "item": {
      "id": "NEW-UUID",
      "name": "Przenośne imadło",
      "kind": "gear",
      "quantity": 1,
      "weight": null,
      "price": 20,
      "equipped": false,
      "carried": true,
      "notes": "Cena uzgodniona z MG.",
      "armor": 0,
      "coverage": "torso",
      "damage": "",
      "range": "",
      "loaded": 0,
      "capacity": 0,
      "reserve": 0,
      "parry": 0
    }
  }
}
```

Use actual UUIDs in both fields; the server assigns the final catalog ID. Return status is 201, with `approvalStatus: pending` for a Player or `approved` for MG/Admin. Updates use the last read revision:

```json
{
  "commandId": "NEW-UUID",
  "revision": 1,
  "command": { "type": "update", "document": { "category": "...", "source": "...", "item": {} } }
}
```

The update `document` must contain the full valid document, as on create or GET. Other commands are `{"type":"approve"}`, `{"type":"reject","note":"Wyjaśnij poprawki"}`, `{"type":"archive"}`, and `{"type":"restore"}`. Review decisions require MG/Admin; an author can withdraw their own pending/rejected submission by archiving it.

A network retry must reuse the **same commandId and identical payload**. A different action needs a new UUID. Duplicate retries do not create extra rows/events; reusing an ID for a different payload returns 409. Stale revisions return 409. Re-read, compare and explicitly reapply your intended changes. Invalid values return 422; missing/invalid authentication returns 401; insufficient role/scope or a foreign Origin returns 403. Do not retry a validation or authorization failure unchanged.

For troubleshooting, compare `/api/health` and `/api/diagnostics`, the catalog detail's revision/audit events and the container logs. Neither response includes OAuth secrets, session cookies or token hashes. Take a current SQLite snapshot before a bulk catalog edit. There is no arbitrary SQL or shell execution endpoint.
