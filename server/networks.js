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
