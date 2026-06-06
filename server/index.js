// server/index.js
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 7743;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'wifi.db');

const db = createDb(DB_PATH);
const app = createApp(db);

const clientDist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`wifi-finder listening on :${PORT}`));
