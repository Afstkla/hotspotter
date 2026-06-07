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
