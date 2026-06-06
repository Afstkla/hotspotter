export type NetworkType = 'open' | 'password' | 'captive';

export interface NetworkLocation {
  id?: number;
  lat: number;
  lon: number;
  label?: string | null;
}

export interface Network {
  id: number;
  ssid: string;
  type: NetworkType;
  password: string | null;
  notes: string | null;
  venue_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  locations: NetworkLocation[];
  score: number;
  last_confirmed: string | null;
  distance_m?: number;
  nearest_location?: { lat: number; lon: number; label: string | null; distance_m: number };
}

export interface AddNetworkInput {
  ssid: string;
  type: NetworkType;
  password?: string;
  notes?: string;
  venue_name?: string;
  locations: NetworkLocation[];
}

const BASE = '/api';

export function getClientId(): string {
  let id = localStorage.getItem('wifi_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('wifi_client_id', id);
  }
  return id;
}

export async function fetchNearby(lat: number, lon: number, radius = 1000): Promise<Network[]> {
  const res = await fetch(`${BASE}/networks?lat=${lat}&lon=${lon}&radius=${radius}`);
  if (!res.ok) throw new Error('Failed to load networks');
  return res.json();
}

export async function addNetwork(input: AddNetworkInput): Promise<Network> {
  const res = await fetch(`${BASE}/networks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.errors?.join(', ') || body.error || 'Failed to add network');
  }
  return res.json();
}

export async function voteNetwork(id: number, works: boolean): Promise<Network> {
  const res = await fetch(`${BASE}/networks/${id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ works, client_id: getClientId() }),
  });
  if (!res.ok) throw new Error('Vote failed');
  return res.json();
}

export async function reportNetwork(id: number, reason: string): Promise<void> {
  const res = await fetch(`${BASE}/networks/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Report failed');
}
