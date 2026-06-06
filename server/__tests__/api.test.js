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
