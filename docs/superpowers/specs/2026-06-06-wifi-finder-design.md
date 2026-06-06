# WiFi Finder — Design

**Date:** 2026-06-06
**Status:** Approved (design phase)

## Concept

A mobile-first PWA where anyone can **anonymously** register semi-public WiFi
networks — open, password-protected, or captive-portal — each tagged to **one or
more locations**, and **find the nearest working networks** around their current
position. Kept honest by community "still works?" votes and last-confirmed dates.

## Goals

- When you're anywhere, open the app and immediately see the nearest WiFi you can use.
- Frictionless contribution: no accounts, no signup.
- Trustworthy data despite being anonymous, via community trust signals.
- Usable offline — because you often need this exactly when you have no connection.
- Architected so native "connect now" / "scan visible networks" can be added later
  without a rewrite.

## Non-Goals (YAGNI)

- No user accounts / profiles / auth.
- No native app in v1 (PWA only; Capacitor wrap is a future phase).
- No SSID scanning or programmatic "connect now" in v1 (impossible in a PWA;
  reserved for the future Capacitor phase).
- No Postgres/PostGIS — SQLite is sufficient at expected scale.
- No heavy captcha — lightweight anti-abuse only.

## Platform Reality (why the scope is what it is)

A PWA **cannot** scan for nearby SSIDs or connect to a network — browsers sandbox
this away. A PWA only has **GPS**. Therefore v1 ranks by GPS distance and offers
copy-password; it cannot prioritise "what the device can see" or auto-connect.

Those powerful features require a **native app** and are asymmetric:

| Capability | PWA | Android (native) | iOS (native) |
|---|---|---|---|
| Scan/list visible SSIDs | ❌ | ✅ (location perm, throttled) | ❌ Apple forbids it |
| "Connect now" to known SSID+password | ❌ | ✅ (`addNetworkSuggestion`) | ✅ (`NEHotspotConfiguration`) |
| Read currently-connected SSID | ❌ | ✅ | ✅ (with perm) |

**Decision:** Build the PWA now, **Capacitor-ready**, and add native powers as a
later additive phase.

## Architecture

- **Frontend:** Vite + React + TypeScript, mobile-first, PWA (installable, offline).
  Leaflet + OpenStreetMap for the secondary map view and the add-location picker.
- **Backend:** Express + SQLite (matches the existing Recipe Vault pattern).
- **Process mgmt:** pm2 on the VPS.
- **Web server:** nginx + SSL.
- **Deploy:** GitHub repo + GitHub Actions, subdomain `wifi.afstkla.nl` (via the
  `new-web-project` flow). Pick an unused production port (Recipe Vault uses 7742;
  choose a distinct one, e.g. 7743).

## Data Model (SQLite)

### `networks`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| ssid | TEXT | network name |
| type | TEXT | `open` \| `password` \| `captive` |
| password | TEXT NULL | required when type=`password` |
| notes | TEXT NULL | captive-portal / voucher instructions, hints |
| venue_name | TEXT NULL | e.g. "Café Blà" |
| status | TEXT | `active` \| `removed` (default `active`) |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `network_locations` (1:many — "one or more lat/lon pairs")
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| network_id | INTEGER FK → networks.id | |
| lat | REAL | indexed |
| lon | REAL | indexed |
| label | TEXT NULL | optional ("terrace", "2nd floor") |

Index on `(lat, lon)` for bounding-box prefilter.

### `votes`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| network_id | INTEGER FK | |
| value | INTEGER | +1 (works) / -1 (doesn't) |
| client_id | TEXT | random UUID from localStorage; best-effort de-dupe, **not** security |
| created_at | TEXT | ISO timestamp |

Derived per network: `score = sum(value)`, `last_confirmed = max(created_at where value=+1)`.
One vote per `(network_id, client_id)`; re-voting updates the existing row.

### `reports`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| network_id | INTEGER FK | |
| reason | TEXT NULL | |
| created_at | TEXT | ISO timestamp |

## Geo Queries

**Approach:** bounding-box prefilter then exact distance.

1. Given `lat, lon, radius`, compute a lat/lon delta box (radius / 111_320 m for lat;
   adjusted by `cos(lat)` for lon).
2. `SELECT` locations within the box using the `(lat, lon)` index, joined to active networks.
3. Compute exact **haversine** distance, filter `<= radius`, sort ascending.
4. A network with multiple locations collapses to its nearest location for the result.

This is simple and fast at hobby scale. **Upgrade path (not built now):** SQLite R-tree
module if the dataset ever grows large.

## API (Express, JSON)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/networks?lat&lon&radius` | nearby networks, sorted by distance; each includes `distance_m`, `score`, `last_confirmed`, nearest location |
| GET | `/api/networks/:id` | full detail incl. all locations |
| POST | `/api/networks` | add network `{ ssid, type, password?, notes?, venue_name?, locations: [{lat,lon,label?}] }` |
| POST | `/api/networks/:id/vote` | `{ works: boolean }` + `client_id` |
| POST | `/api/networks/:id/report` | `{ reason? }` |

**Validation:** `type=password` requires `password`; `locations` must have ≥1 entry with
valid lat/lon ranges.

**Anti-abuse:** `express-rate-limit` per IP on write routes + a hidden honeypot field on
the add form (reject if filled). No captcha in v1.

## UX

### Find (home screen)
- Request geolocation permission on load.
- **Nearest-first list.** Each card: SSID, type badge (open / 🔒 password / portal),
  venue name, distance, confidence indicator (score + "confirmed N days ago").
- Tap to expand → password with a **copy button**, or portal/voucher notes.
- 👍 / 👎 "Still works?" buttons (writes a vote). "Report" link.
- Secondary **map toggle** (Leaflet) showing pins around you.

### Add screen
- Current GPS pre-filled as the first location; Leaflet pin to fine-tune and add extra
  points.
- Fields: SSID, type, password (if password type), notes, venue name.
- Disclaimer: "Only share networks you're permitted to share."

## Proactive Inclusions

### Offline cache
Service worker (app shell) + IndexedDB caching of the last nearby results **and their
credentials**, so the last-known nearby list is viewable with no connection — the most
common real-world moment of need.

### Capacitor seam
All native-only actions live behind a thin `platform` module:
`connectToNetwork()`, `scanNetworks()`, `getConnectedSsid()` — no-ops / hidden on web.
The web build stays a clean static bundle Capacitor can wrap; phase-2 native is purely
additive.

## Privacy / Legal

- No PII collected (no accounts; `client_id` is a random local UUID).
- Add-form disclaimer about permission to share.
- `reports` table + report button enable takedown of abusive/private entries.
- Simple About/ToS page.

## Testing

- **TDD** on the geo logic: bounding box + haversine distance (Vitest) — riskiest part,
  tested first.
- API route tests (supertest): add → query-nearby → vote → report flows, plus validation.
- A couple of component smoke tests (find list, add form).

## Deployment Checklist (handled by `new-web-project`)

- GitHub repo (public or private — decide at scaffold time).
- VPS: pm2 process `wifi-finder`, distinct production port (e.g. 7743).
- nginx vhost + SSL for `wifi.afstkla.nl`.
- GitHub Actions deploy on push to main.
- Frontend built (`npm run build`) before pm2 restart (same pattern as Recipe Vault).
