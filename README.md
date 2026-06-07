# Hotspotter

A mobile-first PWA for finding and sharing **semi-public WiFi** — cafés, hostels,
co-working spots, guest networks — tagged to locations. Open the app anywhere and see
the nearest networks you can actually use. No accounts; the data is kept honest by
community "still works?" votes.

Live at **[wifi.afstkla.nl](https://wifi.afstkla.nl)**.

## How it works

- **Find:** the app uses your GPS to show a nearest-first list of networks (open,
  password, or captive-portal), with tap-to-reveal credentials and a Leaflet map view.
- **Add:** drop a pin, fill in the SSID/type/password/notes — anonymously.
- **Trust:** 👍 / 👎 votes and a last-confirmed date surface what still works.
- **Offline:** the last results (and their credentials) stay viewable with no connection,
  via a service-worker cache — because that's exactly when you need them.

> A PWA can't scan for nearby SSIDs or auto-connect (browsers sandbox that away), so v1
> ranks by GPS distance and lets you copy the password. Native "connect now" is a planned
> phase 2 — the code keeps those actions behind a `platform` seam ready for a Capacitor wrap.

## Stack

- **Backend:** Express + better-sqlite3. Geo lookups = bounding-box prefilter + haversine.
- **Frontend:** Vite + React + TypeScript, PWA via vite-plugin-pwa, Leaflet + OpenStreetMap.
- **Tests:** Vitest + supertest (backend), Vitest + Testing Library (frontend).

## Develop

```bash
npm install
cd client && npm install && cd ..

# backend (port 7745) + frontend dev server (proxies /api → 7745)
npm run dev          # in one terminal
cd client && npm run dev   # in another

npm test                   # backend tests
cd client && npm test      # frontend tests
```

## Build & run (production)

```bash
cd client && npm run build && cd ..   # builds client/dist
npm start                             # serves API + built PWA on PORT (default 7745)
```

Deployed to a VPS via GitHub Actions (`git pull` → build → `systemctl restart hotspotter`).
