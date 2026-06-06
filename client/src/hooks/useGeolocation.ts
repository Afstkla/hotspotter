import { useState, useCallback } from 'react';

export interface GeoState {
  lat: number | null;
  lon: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lon: null,
    error: null,
    loading: false,
  });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'Geolocation not supported' }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          error: null,
          loading: false,
        }),
      (err) => setState((s) => ({ ...s, error: err.message, loading: false })),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, []);

  return { ...state, request };
}
