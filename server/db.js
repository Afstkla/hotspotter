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
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
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
