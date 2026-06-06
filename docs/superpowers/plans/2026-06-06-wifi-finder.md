# WiFi Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first PWA where anyone can anonymously register semi-public WiFi (open / password / captive-portal) tagged to one or more locations, and find the nearest working networks around them, kept honest by community votes.

**Architecture:** Express + better-sqlite3 backend exposing a small JSON API; geo lookups use a bounding-box prefilter then exact haversine distance. Vite + React + TS frontend (mobile-first PWA) defaulting to a nearest-first list, with a secondary Leaflet map and an add form. All native-only actions sit behind a `platform` seam so a later Capacitor wrap is purely additive.

**Tech Stack:** Node + Express, better-sqlite3, express-rate-limit, Vitest + supertest (backend); Vite, React, TypeScript, react-router-dom, react-leaflet/leaflet, vite-plugin-pwa, @testing-library/react (frontend).

---

## File Structure

```
wifi-finder/
  package.json                 # backend deps + scripts (ESM)
  data/                        # sqlite file lives here at runtime (gitignored)
  server/
    geo.js                     # haversineMeters, boundingBox  (pure, tested first)
    db.js                      # createDb + schema
    networks.js                # repository: addNetwork, getById, findNearby, vote, report
    validate.js                # validateNetworkInput
    app.js                     # createApp(db) -> express app (routes only, exported for tests)
    index.js                   # bootstrap: db + app + static client + listen
    __tests__/
      geo.test.js
      networks.test.js
      api.test.js
  client/
    package.json
    vite.config.ts             # react + PWA plugin + /api dev proxy
    tsconfig.json
    index.html
    public/
      icons/icon-192.png       # placeholder icons
      icons/icon-512.png
    src/
      main.tsx                 # router setup
      App.tsx                  # layout + nav + routes
      api.ts                   # types + fetch helpers + getClientId
      platform.ts              # Capacitor seam (web no-ops)
      hooks/useGeolocation.ts
      components/
        FindPage.tsx           # geolocation -> nearest-first list
        NetworkCard.tsx        # one network: expand, copy, vote, report
        MapView.tsx            # secondary Leaflet map of nearby pins
        AddPage.tsx            # add form + Leaflet location picker
        AboutPage.tsx          # privacy / disclaimer
      index.css
      test/
        NetworkCard.test.tsx
        setup.ts
```

---

## Task 1: Backend scaffold

**Files:**
- Create: `package.json`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "wifi-finder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch server/index.js",
    "start": "node server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create runtime data dir placeholder**

Create `data/.gitkeep` with empty content.

- [ ] **Step 3: Install deps**

Run: `npm install`
Expected: installs without errors; `node_modules/better-sqlite3` present.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json data/.gitkeep
git commit -m "chore: backend scaffold"
```

---

## Task 2: Geo utilities (TDD)

**Files:**
- Create: `server/geo.js`
- Test: `server/__tests__/geo.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/geo.test.js
import { describe, it, expect } from 'vitest';
import { haversineMeters, boundingBox } from '../geo.js';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(52.37, 4.89, 52.37, 4.89)).toBe(0);
  });

  it('approximates a known short distance (~157m)', () => {
    // Amsterdam Dam square to a point ~157m away
    const d = haversineMeters(52.3731, 4.8922, 52.3745, 4.8922);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(165);
  });
});

describe('boundingBox', () => {
  it('expands symmetrically in latitude', () => {
    const box = boundingBox(52.0, 4.0, 1000);
    expect(box.maxLat - 52.0).toBeCloseTo(52.0 - box.minLat, 6);
    expect(box.maxLat).toBeGreaterThan(52.0);
  });

  it('expands longitude more than latitude at high latitude', () => {
    const box = boundingBox(60.0, 4.0, 1000);
    const dLat = box.maxLat - 60.0;
    const dLon = box.maxLon - 4.0;
    expect(dLon).toBeGreaterThan(dLat);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- geo`
Expected: FAIL — cannot find module `../geo.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/geo.js
const EARTH_RADIUS_M = 6371000;
const DEG_PER_M_LAT = 1 / 111320;

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function boundingBox(lat, lon, radiusMeters) {
  const dLat = radiusMeters * DEG_PER_M_LAT;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const dLon = (radiusMeters * DEG_PER_M_LAT) / cosLat;
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- geo`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/geo.js server/__tests__/geo.test.js
git commit -m "feat: geo distance and bounding-box utilities"
```

---

## Task 3: Database schema

**Files:**
- Create: `server/db.js`

- [ ] **Step 1: Write `server/db.js`**

```js
// server/db.js
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS networks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ssid TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open','password','captive')),
  password TEXT,
  notes TEXT,
  venue_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS network_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  label TEXT
);
CREATE INDEX IF NOT EXISTS idx_locations_latlon ON network_locations(lat, lon);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (network_id, client_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TEXT NOT NULL
);
`;

export function createDb(path = ':memory:') {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
```

- [ ] **Step 2: Smoke check it loads**

Run: `node -e "import('./server/db.js').then(m => { const db = m.createDb(); console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\"').all().map(r=>r.name).join(',')); })"`
Expected: prints `networks,network_locations,sqlite_sequence,votes,reports` (order may vary).

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: sqlite schema and createDb"
```

---

## Task 4: Networks repository (TDD)

**Files:**
- Create: `server/networks.js`
- Test: `server/__tests__/networks.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/networks.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../db.js';
import { addNetwork, getById, findNearby, vote, report } from '../networks.js';

let db;
beforeEach(() => {
  db = createDb();
});

const base = {
  ssid: 'CafeBla',
  type: 'password',
  password: 'latte123',
  notes: null,
  venue_name: 'Café Blà',
  locations: [{ lat: 52.3731, lon: 4.8922, label: 'terrace' }],
};

describe('addNetwork + getById', () => {
  it('persists a network with its locations and zeroed score', () => {
    const created = addNetwork(db, base);
    const got = getById(db, created.id);
    expect(got.ssid).toBe('CafeBla');
    expect(got.type).toBe('password');
    expect(got.password).toBe('latte123');
    expect(got.locations).toHaveLength(1);
    expect(got.locations[0].lat).toBeCloseTo(52.3731, 4);
    expect(got.score).toBe(0);
    expect(got.last_confirmed).toBeNull();
  });
});

describe('findNearby', () => {
  it('returns networks within radius sorted by distance', () => {
    const near = addNetwork(db, { ...base, ssid: 'Near', locations: [{ lat: 52.3731, lon: 4.8922 }] });
    const far = addNetwork(db, { ...base, ssid: 'Far', locations: [{ lat: 52.3900, lon: 4.8922 }] });
    addNetwork(db, { ...base, ssid: 'WayFar', locations: [{ lat: 53.0, lon: 5.0 }] });

    const results = findNearby(db, 52.3731, 4.8922, 2000);
    const ssids = results.map((r) => r.ssid);
    expect(ssids).toContain('Near');
    expect(ssids).not.toContain('WayFar');
    expect(results[0].ssid).toBe('Near');
    expect(results[0].distance_m).toBe(0);
    expect(results[0].nearest_location).toBeDefined();
  });

  it('collapses multi-location networks to their nearest point', () => {
    addNetwork(db, {
      ...base,
      ssid: 'Multi',
      locations: [
        { lat: 53.0, lon: 5.0 },
        { lat: 52.3732, lon: 4.8922 },
      ],
    });
    const results = findNearby(db, 52.3731, 4.8922, 500);
    const multi = results.find((r) => r.ssid === 'Multi');
    expect(multi).toBeDefined();
    expect(multi.distance_m).toBeLessThan(500);
  });
});

describe('vote', () => {
  it('aggregates score and last_confirmed, one vote per client', () => {
    const n = addNetwork(db, base);
    vote(db, n.id, true, 'client-a');
    vote(db, n.id, true, 'client-b');
    let got = getById(db, n.id);
    expect(got.score).toBe(2);
    expect(got.last_confirmed).not.toBeNull();

    // same client changes their vote, does not stack
    vote(db, n.id, false, 'client-a');
    got = getById(db, n.id);
    expect(got.score).toBe(0);
  });

  it('returns null for unknown network', () => {
    expect(vote(db, 999, true, 'x')).toBeNull();
  });
});

describe('report', () => {
  it('records a report', () => {
    const n = addNetwork(db, base);
    expect(report(db, n.id, 'private network')).toEqual({ ok: true });
    expect(report(db, 999, 'x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- networks`
Expected: FAIL — cannot find module `../networks.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/networks.js
import { haversineMeters, boundingBox } from './geo.js';

export function addNetwork(db, input) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO networks (ssid, type, password, notes, venue_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(
      input.ssid,
      input.type,
      input.password ?? null,
      input.notes ?? null,
      input.venue_name ?? null,
      now,
      now
    );
  const networkId = info.lastInsertRowid;
  const insLoc = db.prepare(
    `INSERT INTO network_locations (network_id, lat, lon, label) VALUES (?, ?, ?, ?)`
  );
  const tx = db.transaction((locs) => {
    for (const loc of locs) insLoc.run(networkId, loc.lat, loc.lon, loc.label ?? null);
  });
  tx(input.locations);
  return getById(db, networkId);
}

export function getById(db, id) {
  const net = db.prepare(`SELECT * FROM networks WHERE id = ?`).get(id);
  if (!net) return null;
  const locations = db
    .prepare(`SELECT id, lat, lon, label FROM network_locations WHERE network_id = ?`)
    .all(id);
  const agg = db
    .prepare(
      `SELECT COALESCE(SUM(value), 0) AS score,
              MAX(CASE WHEN value = 1 THEN created_at END) AS last_confirmed
       FROM votes WHERE network_id = ?`
    )
    .get(id);
  return {
    id: net.id,
    ssid: net.ssid,
    type: net.type,
    password: net.password,
    notes: net.notes,
    venue_name: net.venue_name,
    status: net.status,
    created_at: net.created_at,
    updated_at: net.updated_at,
    locations,
    score: agg.score,
    last_confirmed: agg.last_confirmed,
  };
}

export function findNearby(db, lat, lon, radiusMeters) {
  const box = boundingBox(lat, lon, radiusMeters);
  const rows = db
    .prepare(
      `SELECT nl.network_id, nl.lat, nl.lon, nl.label
       FROM network_locations nl
       JOIN networks n ON n.id = nl.network_id
       WHERE n.status = 'active'
         AND nl.lat BETWEEN ? AND ?
         AND nl.lon BETWEEN ? AND ?`
    )
    .all(box.minLat, box.maxLat, box.minLon, box.maxLon);

  const nearestByNetwork = new Map();
  for (const r of rows) {
    const d = haversineMeters(lat, lon, r.lat, r.lon);
    if (d > radiusMeters) continue;
    const cur = nearestByNetwork.get(r.network_id);
    if (!cur || d < cur.distance_m) {
      nearestByNetwork.set(r.network_id, {
        lat: r.lat,
        lon: r.lon,
        label: r.label,
        distance_m: d,
      });
    }
  }

  const results = [];
  for (const [networkId, nearest] of nearestByNetwork) {
    const net = getById(db, networkId);
    results.push({
      ...net,
      nearest_location: { ...nearest, distance_m: Math.round(nearest.distance_m) },
      distance_m: Math.round(nearest.distance_m),
    });
  }
  results.sort((a, b) => a.distance_m - b.distance_m);
  return results;
}

export function vote(db, networkId, works, clientId) {
  const exists = db.prepare(`SELECT id FROM networks WHERE id = ?`).get(networkId);
  if (!exists) return null;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO votes (network_id, value, client_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(network_id, client_id)
     DO UPDATE SET value = excluded.value, created_at = excluded.created_at`
  ).run(networkId, works ? 1 : -1, clientId, now);
  return getById(db, networkId);
}

export function report(db, networkId, reason) {
  const exists = db.prepare(`SELECT id FROM networks WHERE id = ?`).get(networkId);
  if (!exists) return null;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO reports (network_id, reason, created_at) VALUES (?, ?, ?)`).run(
    networkId,
    reason ?? null,
    now
  );
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- networks`
Expected: PASS (all repository tests).

- [ ] **Step 5: Commit**

```bash
git add server/networks.js server/__tests__/networks.test.js
git commit -m "feat: networks repository with geo nearby, votes, reports"
```

---

## Task 5: Input validation (TDD)

**Files:**
- Create: `server/validate.js`
- Test: add to `server/__tests__/api.test.js` later (validation is exercised through the API). For now a small standalone test.
- Test: `server/__tests__/validate.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/validate.test.js
import { describe, it, expect } from 'vitest';
import { validateNetworkInput } from '../validate.js';

const ok = {
  ssid: 'X',
  type: 'open',
  locations: [{ lat: 52, lon: 4 }],
};

describe('validateNetworkInput', () => {
  it('accepts a valid open network', () => {
    expect(validateNetworkInput(ok)).toEqual([]);
  });

  it('requires ssid', () => {
    expect(validateNetworkInput({ ...ok, ssid: '' }).length).toBeGreaterThan(0);
  });

  it('rejects bad type', () => {
    expect(validateNetworkInput({ ...ok, type: 'wep' }).length).toBeGreaterThan(0);
  });

  it('requires password when type=password', () => {
    const errs = validateNetworkInput({ ...ok, type: 'password' });
    expect(errs.some((e) => e.includes('password'))).toBe(true);
  });

  it('requires at least one valid location', () => {
    expect(validateNetworkInput({ ...ok, locations: [] }).length).toBeGreaterThan(0);
    expect(validateNetworkInput({ ...ok, locations: [{ lat: 999, lon: 4 }] }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validate`
Expected: FAIL — cannot find module `../validate.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/validate.js
const TYPES = ['open', 'password', 'captive'];

export function validateNetworkInput(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['body required'];
  if (!body.ssid || typeof body.ssid !== 'string') errors.push('ssid required');
  if (!TYPES.includes(body.type)) errors.push('invalid type');
  if (body.type === 'password' && !body.password) {
    errors.push('password required for type=password');
  }
  if (!Array.isArray(body.locations) || body.locations.length < 1) {
    errors.push('at least one location required');
  } else {
    for (const loc of body.locations) {
      if (typeof loc.lat !== 'number' || loc.lat < -90 || loc.lat > 90) errors.push('invalid lat');
      if (typeof loc.lon !== 'number' || loc.lon < -180 || loc.lon > 180) errors.push('invalid lon');
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validate`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/validate.js server/__tests__/validate.test.js
git commit -m "feat: network input validation"
```

---

## Task 6: Express API (TDD)

**Files:**
- Create: `server/app.js`
- Test: `server/__tests__/api.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/api.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

let app;
beforeEach(() => {
  app = createApp(createDb());
});

const payload = {
  ssid: 'TestNet',
  type: 'password',
  password: 'secret',
  locations: [{ lat: 52.3731, lon: 4.8922 }],
};

describe('POST /api/networks', () => {
  it('creates a network', async () => {
    const res = await request(app).post('/api/networks').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.ssid).toBe('TestNet');
    expect(res.body.id).toBeDefined();
  });

  it('rejects invalid input', async () => {
    const res = await request(app).post('/api/networks').send({ ssid: '', type: 'open', locations: [] });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects honeypot submissions', async () => {
    const res = await request(app).post('/api/networks').send({ ...payload, website: 'spam' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/networks', () => {
  it('requires lat and lon', async () => {
    const res = await request(app).get('/api/networks');
    expect(res.status).toBe(400);
  });

  it('returns nearby networks', async () => {
    await request(app).post('/api/networks').send(payload);
    const res = await request(app).get('/api/networks?lat=52.3731&lon=4.8922&radius=1000');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].distance_m).toBe(0);
  });
});

describe('vote + report + detail', () => {
  it('votes, reports, and fetches detail', async () => {
    const created = (await request(app).post('/api/networks').send(payload)).body;

    const voteRes = await request(app)
      .post(`/api/networks/${created.id}/vote`)
      .send({ works: true, client_id: 'abc' });
    expect(voteRes.status).toBe(200);
    expect(voteRes.body.score).toBe(1);

    const reportRes = await request(app)
      .post(`/api/networks/${created.id}/report`)
      .send({ reason: 'gone' });
    expect(reportRes.status).toBe(200);

    const detail = await request(app).get(`/api/networks/${created.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ssid).toBe('TestNet');

    const missing = await request(app).get('/api/networks/9999');
    expect(missing.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL — cannot find module `../app.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/app.js
import express from 'express';
import rateLimit from 'express-rate-limit';
import { addNetwork, findNearby, getById, vote, report } from './networks.js';
import { validateNetworkInput } from './validate.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get('/api/networks', (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radius = Number(req.query.radius ?? 1000);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    res.json(findNearby(db, lat, lon, Number.isNaN(radius) ? 1000 : radius));
  });

  app.get('/api/networks/:id', (req, res) => {
    const net = getById(db, Number(req.params.id));
    if (!net) return res.status(404).json({ error: 'not found' });
    res.json(net);
  });

  app.post('/api/networks', writeLimiter, (req, res) => {
    if (req.body && req.body.website) {
      return res.status(400).json({ error: 'spam detected' }); // honeypot
    }
    const errors = validateNetworkInput(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const net = addNetwork(db, req.body);
    res.status(201).json(net);
  });

  app.post('/api/networks/:id/vote', writeLimiter, (req, res) => {
    const { works, client_id } = req.body ?? {};
    if (typeof works !== 'boolean' || !client_id) {
      return res.status(400).json({ error: 'works (boolean) and client_id required' });
    }
    const net = vote(db, Number(req.params.id), works, client_id);
    if (!net) return res.status(404).json({ error: 'not found' });
    res.json(net);
  });

  app.post('/api/networks/:id/report', writeLimiter, (req, res) => {
    const result = report(db, Number(req.params.id), req.body?.reason);
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS (all API tests).

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: PASS — geo, networks, validate, api.

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/__tests__/api.test.js
git commit -m "feat: express api with rate limiting and honeypot"
```

---

## Task 7: Server bootstrap (serves API + built client)

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Write `server/index.js`**

```js
// server/index.js
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 7745;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'wifi.db');

const db = createDb(DB_PATH);
const app = createApp(db);

const clientDist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`wifi-finder listening on :${PORT}`));
```

- [ ] **Step 2: Smoke test boot (no client build yet)**

Run: `PORT=7745 node server/index.js &` then `sleep 1 && curl -s "http://localhost:7745/api/networks?lat=52&lon=4" && kill %1`
Expected: prints `[]` (empty array). Server boots; static block skipped since `client/dist` absent.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: server bootstrap serving api and static client"
```

---

## Task 8: Frontend scaffold + PWA config

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/index.css`, `client/public/icons/icon-192.png`, `client/public/icons/icon-512.png`

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "wifi-finder-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "leaflet": "^1.9.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/leaflet": "^1.9.12",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `client/vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'WiFi Finder',
        short_name: 'WiFi',
        description: 'Find shared WiFi near you',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // Offline: last successful nearby/detail responses stay viewable (incl. credentials)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/networks'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-networks',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:7745' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 4: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0f172a" />
    <title>WiFi Finder</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `client/src/index.css`**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}
a { color: #38bdf8; }
.app { max-width: 640px; margin: 0 auto; padding: 1rem; padding-bottom: 5rem; }
.nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-around;
  background: #1e293b; border-top: 1px solid #334155; padding: 0.6rem 0;
}
.nav a { text-decoration: none; font-weight: 600; }
.card {
  background: #1e293b; border: 1px solid #334155; border-radius: 12px;
  padding: 0.9rem; margin-bottom: 0.75rem;
}
.badge {
  display: inline-block; font-size: 0.7rem; padding: 0.15rem 0.5rem;
  border-radius: 999px; background: #334155; margin-left: 0.4rem;
}
.btn {
  background: #38bdf8; color: #0f172a; border: none; border-radius: 8px;
  padding: 0.6rem 1rem; font-weight: 700; cursor: pointer;
}
.btn.secondary { background: #334155; color: #e2e8f0; }
input, select, textarea {
  width: 100%; padding: 0.6rem; margin: 0.3rem 0 0.8rem;
  background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px;
}
.row { display: flex; gap: 0.5rem; align-items: center; }
.muted { color: #94a3b8; font-size: 0.85rem; }
.honeypot { position: absolute; left: -9999px; }
```

- [ ] **Step 6: Create placeholder PWA icons**

Run:
```bash
cd client && mkdir -p public/icons
# 1x1 transparent PNG placeholders (replace with real icons later)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > public/icons/icon-192.png
cp public/icons/icon-192.png public/icons/icon-512.png
cd ..
```
Expected: two PNG files exist. (Note in commit message they are placeholders.)

- [ ] **Step 7: Create `client/src/main.tsx`** (router shell; App added next task)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 8: Install client deps**

Run: `cd client && npm install && cd ..`
Expected: installs without errors.

- [ ] **Step 9: Commit**

```bash
git add client/package.json client/package-lock.json client/tsconfig.json client/vite.config.ts client/index.html client/src/main.tsx client/src/index.css client/public/icons
git commit -m "chore: frontend scaffold with PWA config (placeholder icons)"
```

---

## Task 9: API client + platform seam

**Files:**
- Create: `client/src/api.ts`
- Create: `client/src/platform.ts`

- [ ] **Step 1: Create `client/src/api.ts`**

```ts
export type NetworkType = 'open' | 'password' | 'captive';

export interface NetworkLocation {
  id?: number;
  lat: number;
  lon: number;
  label?: string | null;
}

export interface Network {
  id: number;
  ssid: string;
  type: NetworkType;
  password: string | null;
  notes: string | null;
  venue_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  locations: NetworkLocation[];
  score: number;
  last_confirmed: string | null;
  distance_m?: number;
  nearest_location?: { lat: number; lon: number; label: string | null; distance_m: number };
}

export interface AddNetworkInput {
  ssid: string;
  type: NetworkType;
  password?: string;
  notes?: string;
  venue_name?: string;
  locations: NetworkLocation[];
}

const BASE = '/api';

export function getClientId(): string {
  let id = localStorage.getItem('wifi_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('wifi_client_id', id);
  }
  return id;
}

export async function fetchNearby(lat: number, lon: number, radius = 1000): Promise<Network[]> {
  const res = await fetch(`${BASE}/networks?lat=${lat}&lon=${lon}&radius=${radius}`);
  if (!res.ok) throw new Error('Failed to load networks');
  return res.json();
}

export async function addNetwork(input: AddNetworkInput): Promise<Network> {
  const res = await fetch(`${BASE}/networks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.errors?.join(', ') || body.error || 'Failed to add network');
  }
  return res.json();
}

export async function voteNetwork(id: number, works: boolean): Promise<Network> {
  const res = await fetch(`${BASE}/networks/${id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ works, client_id: getClientId() }),
  });
  if (!res.ok) throw new Error('Vote failed');
  return res.json();
}

export async function reportNetwork(id: number, reason: string): Promise<void> {
  await fetch(`${BASE}/networks/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}
```

- [ ] **Step 2: Create `client/src/platform.ts`**

```ts
// Capacitor seam. On the web these are no-ops / not-supported.
// A future Capacitor wrap re-implements these against native WiFi plugins,
// and all consumers keep working unchanged.

export const isNative = false;

/** True only where the platform can programmatically join a network. */
export const canConnect = isNative;

/** True only where the platform can list visible SSIDs (Android native). */
export const canScan = isNative;

export async function connectToNetwork(_ssid: string, _password?: string): Promise<boolean> {
  return false;
}

export async function scanNetworks(): Promise<string[]> {
  return [];
}

export async function getConnectedSsid(): Promise<string | null> {
  return null;
}
```

- [ ] **Step 3: Type-check**

Run: `cd client && npx tsc -b && cd ..`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/api.ts client/src/platform.ts
git commit -m "feat: client api helpers and capacitor platform seam"
```

---

## Task 10: Geolocation hook

**Files:**
- Create: `client/src/hooks/useGeolocation.ts`

- [ ] **Step 1: Create `client/src/hooks/useGeolocation.ts`**

```ts
import { useState, useCallback } from 'react';

export interface GeoState {
  lat: number | null;
  lon: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lon: null,
    error: null,
    loading: false,
  });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'Geolocation not supported' }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          error: null,
          loading: false,
        }),
      (err) => setState((s) => ({ ...s, error: err.message, loading: false })),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, []);

  return { ...state, request };
}
```

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc -b && cd ..`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useGeolocation.ts
git commit -m "feat: useGeolocation hook"
```

---

## Task 11: NetworkCard component (TDD)

**Files:**
- Create: `client/src/components/NetworkCard.tsx`
- Create: `client/src/test/setup.ts`
- Test: `client/src/test/NetworkCard.test.tsx`

- [ ] **Step 1: Create `client/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 2: Write the failing test**

```tsx
// client/src/test/NetworkCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NetworkCard from '../components/NetworkCard';
import type { Network } from '../api';

const net: Network = {
  id: 1,
  ssid: 'CafeBla',
  type: 'password',
  password: 'latte123',
  notes: null,
  venue_name: 'Café Blà',
  status: 'active',
  created_at: '',
  updated_at: '',
  locations: [{ lat: 52, lon: 4 }],
  score: 3,
  last_confirmed: null,
  distance_m: 42,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('NetworkCard', () => {
  it('shows ssid, venue and distance', () => {
    render(<NetworkCard network={net} />);
    expect(screen.getByText('CafeBla')).toBeInTheDocument();
    expect(screen.getByText(/Café Blà/)).toBeInTheDocument();
    expect(screen.getByText(/42\s*m/)).toBeInTheDocument();
  });

  it('hides the password until expanded', () => {
    render(<NetworkCard network={net} />);
    expect(screen.queryByText('latte123')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('CafeBla'));
    expect(screen.getByText('latte123')).toBeInTheDocument();
  });

  it('copies the password to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<NetworkCard network={net} />);
    fireEvent.click(screen.getByText('CafeBla'));
    fireEvent.click(screen.getByText(/copy/i));
    expect(writeText).toHaveBeenCalledWith('latte123');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npm test -- NetworkCard && cd ..`
Expected: FAIL — cannot find module `../components/NetworkCard`.

- [ ] **Step 4: Write the implementation**

```tsx
// client/src/components/NetworkCard.tsx
import { useState } from 'react';
import type { Network } from '../api';
import { voteNetwork, reportNetwork } from '../api';

const TYPE_LABEL: Record<Network['type'], string> = {
  open: 'open',
  password: '🔒 password',
  captive: 'portal',
};

function formatDistance(m?: number): string {
  if (m == null) return '';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function confirmedLabel(iso: string | null): string {
  if (!iso) return 'never confirmed';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'confirmed today';
  if (days === 1) return 'confirmed 1 day ago';
  return `confirmed ${days} days ago`;
}

export default function NetworkCard({ network }: { network: Network }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(network.score);
  const [reported, setReported] = useState(false);

  async function handleVote(works: boolean) {
    try {
      const updated = await voteNetwork(network.id, works);
      setScore(updated.score);
    } catch {
      /* offline / failed: ignore, UI stays */
    }
  }

  async function handleReport() {
    await reportNetwork(network.id, 'reported from app');
    setReported(true);
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer' }}>
          {network.ssid}
          <span className="badge">{TYPE_LABEL[network.type]}</span>
        </strong>
        <span className="muted">{formatDistance(network.distance_m)}</span>
      </div>
      {network.venue_name && <div className="muted">{network.venue_name}</div>}
      <div className="muted">
        score {score} · {confirmedLabel(network.last_confirmed)}
      </div>

      {open && (
        <div style={{ marginTop: '0.6rem' }}>
          {network.type === 'password' && network.password && (
            <div className="row">
              <code>{network.password}</code>
              <button className="btn secondary" onClick={() => navigator.clipboard.writeText(network.password!)}>
                Copy
              </button>
            </div>
          )}
          {network.type === 'open' && <div className="muted">Open network — no password.</div>}
          {network.notes && <p>{network.notes}</p>}

          <div className="row" style={{ marginTop: '0.6rem' }}>
            <button className="btn secondary" onClick={() => handleVote(true)}>👍 Works</button>
            <button className="btn secondary" onClick={() => handleVote(false)}>👎 Nope</button>
            <button className="btn secondary" onClick={handleReport} disabled={reported}>
              {reported ? 'Reported' : 'Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- NetworkCard && cd ..`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/NetworkCard.tsx client/src/test/setup.ts client/src/test/NetworkCard.test.tsx
git commit -m "feat: NetworkCard with expand, copy, vote, report"
```

---

## Task 12: FindPage (nearest-first list + map toggle)

**Files:**
- Create: `client/src/components/FindPage.tsx`
- Create: `client/src/components/MapView.tsx`

- [ ] **Step 1: Create `client/src/components/MapView.tsx`**

```tsx
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Network } from '../api';

// Fix default marker icons under bundlers
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapView({
  lat,
  lon,
  networks,
}: {
  lat: number;
  lon: number;
  networks: Network[];
}) {
  return (
    <MapContainer center={[lat, lon]} zoom={16} style={{ height: '60vh', borderRadius: 12 }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle center={[lat, lon]} radius={20} />
      {networks.map((n) =>
        n.nearest_location ? (
          <Marker key={n.id} position={[n.nearest_location.lat, n.nearest_location.lon]} icon={icon}>
            <Popup>
              <strong>{n.ssid}</strong>
              <br />
              {n.type === 'password' ? n.password : n.type}
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Create `client/src/components/FindPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchNearby, type Network } from '../api';
import NetworkCard from './NetworkCard';
import MapView from './MapView';

export default function FindPage() {
  const geo = useGeolocation();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Ask for location on first mount
  useEffect(() => {
    geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (geo.lat == null || geo.lon == null) return;
    setLoading(true);
    fetchNearby(geo.lat, geo.lon, 2000)
      .then((rows) => {
        setNetworks(rows);
        setError(null);
      })
      .catch(() => setError('Could not load networks (offline shows last results).'))
      .finally(() => setLoading(false));
  }, [geo.lat, geo.lon]);

  return (
    <div>
      <h1>WiFi near you</h1>

      {geo.error && (
        <div className="card">
          <p>Location needed to find nearby WiFi.</p>
          <button className="btn" onClick={geo.request}>Enable location</button>
        </div>
      )}

      {geo.lat != null && (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <span className="muted">{loading ? 'Searching…' : `${networks.length} found`}</span>
          <button className="btn secondary" onClick={() => setShowMap((m) => !m)}>
            {showMap ? 'List view' : 'Map view'}
          </button>
        </div>
      )}

      {error && <p className="muted">{error}</p>}

      {showMap && geo.lat != null && geo.lon != null ? (
        <MapView lat={geo.lat} lon={geo.lon} networks={networks} />
      ) : (
        <>
          {networks.map((n) => (
            <NetworkCard key={n.id} network={n} />
          ))}
          {!loading && geo.lat != null && networks.length === 0 && (
            <p className="muted">Nothing nearby yet. Be the first to add one!</p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd client && npx tsc -b && cd ..`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/FindPage.tsx client/src/components/MapView.tsx
git commit -m "feat: find page with nearest-first list and map toggle"
```

---

## Task 13: AddPage (form + Leaflet location picker)

**Files:**
- Create: `client/src/components/AddPage.tsx`

- [ ] **Step 1: Create `client/src/components/AddPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addNetwork, type NetworkType, type NetworkLocation } from '../api';
import { useGeolocation } from '../hooks/useGeolocation';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function Picker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddPage() {
  const geo = useGeolocation();
  const navigate = useNavigate();
  const [ssid, setSsid] = useState('');
  const [type, setType] = useState<NetworkType>('open');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [venue, setVenue] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [point, setPoint] = useState<NetworkLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const center: [number, number] =
    point ? [point.lat, point.lon] : geo.lat != null ? [geo.lat, geo.lon!] : [52.3731, 4.8922];

  function useMyLocation() {
    geo.request();
  }

  // Pre-fill point from GPS once available and not yet set
  useEffect(() => {
    if (point == null && geo.lat != null && geo.lon != null) {
      setPoint({ lat: geo.lat, lon: geo.lon });
    }
  }, [geo.lat, geo.lon, point]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!point) {
      setError('Tap the map to set a location, or use your location.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addNetwork({
        ssid,
        type,
        password: type === 'password' ? password : undefined,
        notes: notes || undefined,
        venue_name: venue || undefined,
        locations: [point],
        ...(website ? { website } : {}), // honeypot passthrough (server rejects)
      } as any);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Add WiFi</h1>

      <label>Network name (SSID)</label>
      <input value={ssid} onChange={(e) => setSsid(e.target.value)} required />

      <label>Type</label>
      <select value={type} onChange={(e) => setType(e.target.value as NetworkType)}>
        <option value="open">Open (no password)</option>
        <option value="password">Password</option>
        <option value="captive">Captive portal / voucher</option>
      </select>

      {type === 'password' && (
        <>
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required />
        </>
      )}

      {type === 'captive' && (
        <>
          <label>How to get on (portal/voucher notes)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </>
      )}

      <label>Venue name (optional)</label>
      <input value={venue} onChange={(e) => setVenue(e.target.value)} />

      {/* honeypot: real users never see/fill this */}
      <input
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />

      <label>Location {point ? '(tap map to adjust)' : '(tap map to set)'}</label>
      <button type="button" className="btn secondary" onClick={useMyLocation} style={{ marginBottom: '0.5rem' }}>
        Use my location
      </button>
      <MapContainer center={center} zoom={16} style={{ height: '40vh', borderRadius: 12 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Picker onPick={(lat, lon) => setPoint({ lat, lon })} />
        {point && <Marker position={[point.lat, point.lon]} icon={icon} />}
      </MapContainer>

      {error && <p className="muted" style={{ color: '#f87171' }}>{error}</p>}

      <p className="muted">Only share networks you're allowed to share.</p>
      <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '0.5rem' }}>
        {submitting ? 'Adding…' : 'Add network'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc -b && cd ..`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AddPage.tsx
git commit -m "feat: add page with form and leaflet location picker"
```

---

## Task 14: AboutPage + App routing/nav

**Files:**
- Create: `client/src/components/AboutPage.tsx`
- Create: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/components/AboutPage.tsx`**

```tsx
export default function AboutPage() {
  return (
    <div>
      <h1>About</h1>
      <p>
        WiFi Finder is a community map of semi-public WiFi — cafés, hostels, co-working
        spots and other networks meant to be shared. Find what's near you, and add what
        you know.
      </p>
      <h2>Privacy</h2>
      <p className="muted">
        No accounts, no personal data. A random ID stored on your device lets us count one
        vote per person — that's it.
      </p>
      <h2>Please be fair</h2>
      <p className="muted">
        Only add networks you're permitted to share. Found something private or wrong?
        Use the “Report” button on any entry.
      </p>
      <h2>Heads up</h2>
      <p className="muted">
        The web app ranks WiFi by distance and lets you copy the password. Auto-connect and
        “see what your phone can see” need a native app — coming later.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/App.tsx`**

```tsx
import { Routes, Route, NavLink } from 'react-router-dom';
import FindPage from './components/FindPage';
import AddPage from './components/AddPage';
import AboutPage from './components/AboutPage';

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<FindPage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <nav className="nav">
        <NavLink to="/">Find</NavLink>
        <NavLink to="/add">Add</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build**

Run: `cd client && npx tsc -b && npm run build && cd ..`
Expected: `client/dist/` produced, including `manifest.webmanifest` and a service worker (`sw.js`).

- [ ] **Step 4: Run the client test suite**

Run: `cd client && npm test && cd ..`
Expected: PASS (NetworkCard tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/AboutPage.tsx
git commit -m "feat: about page and app routing/nav"
```

---

## Task 15: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build client**

Run: `cd client && npm run build && cd ..`
Expected: build succeeds.

- [ ] **Step 2: Start the server**

Run: `PORT=7745 node server/index.js &`
Expected: logs `wifi-finder listening on :7745`.

- [ ] **Step 3: Seed one network via API**

Run:
```bash
curl -s -X POST http://localhost:7745/api/networks \
  -H 'Content-Type: application/json' \
  -d '{"ssid":"DemoCafe","type":"password","password":"demo1234","venue_name":"Demo Cafe","locations":[{"lat":52.3731,"lon":4.8922}]}'
```
Expected: 201-style JSON with an `id` and `score: 0`.

- [ ] **Step 4: Query nearby**

Run: `curl -s "http://localhost:7745/api/networks?lat=52.3731&lon=4.8922&radius=1000"`
Expected: array containing DemoCafe with `distance_m: 0`.

- [ ] **Step 5: Load the UI in a browser**

Open `http://localhost:7745/` — allow location (or use a desktop browser's location override near the seeded point). Confirm: the list shows DemoCafe, tapping reveals the password + copy button, vote buttons respond, and the Add page map accepts a tapped location. Then `kill %1`.

- [ ] **Step 6: Commit any fixes found during manual testing**

```bash
git add -A
git commit -m "fix: issues found during end-to-end verification"
```
(If nothing needed fixing, skip this commit.)

---

## Task 16: Deploy (via new-web-project flow)

**Files:** deployment config produced by the `new-web-project` skill.

> This task is operational, not code. Use the `new-web-project` skill (it handles GitHub repo creation, VPS nginx + SSL, pm2, and the GitHub Actions deploy). Provide it these specifics:

- [ ] **Step 1: Create the GitHub repo and remote**

Decide public vs private with the user. Push the existing local repo.

- [ ] **Step 2: Configure the VPS service**

- pm2 process name: `wifi-finder`
- Production port: `7745` (distinct from Recipe Vault's 7742)
- Start command: `npm start` (runs `server/index.js`), with `DB_PATH` pointing at a persistent path on the VPS.
- Ensure `client && npm run build` runs before pm2 (start/restart) so `client/dist` exists — same rebuild-before-restart rule as Recipe Vault.

- [ ] **Step 3: nginx vhost + SSL**

- Subdomain: `wifi.afstkla.nl`
- Reverse proxy to `127.0.0.1:7745`.
- SSL via certbot (the skill's standard flow).

- [ ] **Step 4: GitHub Actions deploy on push to main**

- Build client, restart pm2 process `wifi-finder` on the VPS.

- [ ] **Step 5: Verify production**

Run: `curl -s https://wifi.afstkla.nl/api/networks?lat=52.3731&lon=4.8922`
Expected: JSON array (likely `[]` on a fresh DB).

---

## Notes for the implementer

- **better-sqlite3** is a native module; `npm install` compiles it. On macOS this needs Xcode CLT. If install fails, that's the cause.
- **Leaflet marker icons** are loaded from unpkg CDN in `MapView`/`AddPage` to avoid bundler asset issues; acceptable for v1.
- **Offline behaviour** comes entirely from `vite-plugin-pwa`'s `NetworkFirst` cache on `/api/networks` — no hand-rolled IndexedDB. The last successful nearby response (including credentials) is served when offline. This only works in the built app (service workers are not active in `vite dev`).
- The **honeypot** field `website` is sent only if filled; the server rejects any request containing it.
- **Multiple locations per network:** the data model and API fully support many lat/lon points per network (satisfying "one or more"), but the v1 **add form captures a single point** for simplicity. Multi-point entry in the UI is a deliberate post-v1 enhancement; the backend needs no changes to support it.
