import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock react-leaflet: a real Leaflet map can't render in jsdom. We capture
// setView so we can assert the map recenters when a location is obtained.
const setView = vi.fn();
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({ setView }),
  useMapEvents: () => null,
}));

import AddPage from '../components/AddPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <AddPage />
    </MemoryRouter>
  );
}

describe('AddPage — use my location', () => {
  beforeEach(() => {
    setView.mockClear();
  });

  it('recenters the map when geolocation resolves', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition)
    );
    Object.assign(navigator, { geolocation: { getCurrentPosition } });

    renderPage();
    fireEvent.click(screen.getByText('Use my location'));

    await waitFor(() => expect(setView).toHaveBeenCalled());
    expect(setView).toHaveBeenCalledWith([51.5, -0.12], expect.any(Number));
  });

  it('shows an error when geolocation is denied', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ message: 'User denied Geolocation' } as GeolocationPositionError)
    );
    Object.assign(navigator, { geolocation: { getCurrentPosition } });

    renderPage();
    fireEvent.click(screen.getByText('Use my location'));

    await waitFor(() =>
      expect(screen.getByText('User denied Geolocation')).toBeInTheDocument()
    );
  });
});
