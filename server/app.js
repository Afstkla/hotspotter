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
