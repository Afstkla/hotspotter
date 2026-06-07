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
