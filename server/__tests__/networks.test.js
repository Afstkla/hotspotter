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
