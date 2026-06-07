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
