import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addNetwork, type NetworkType, type NetworkLocation } from '../api';
import { useGeolocation } from '../hooks/useGeolocation';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function Picker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddPage() {
  const geo = useGeolocation();
  const navigate = useNavigate();
  const [ssid, setSsid] = useState('');
  const [type, setType] = useState<NetworkType>('open');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [venue, setVenue] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [point, setPoint] = useState<NetworkLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const center: [number, number] =
    point ? [point.lat, point.lon] : geo.lat != null ? [geo.lat, geo.lon!] : [52.3731, 4.8922];

  function useMyLocation() {
    geo.request();
  }

  // Pre-fill point from GPS once available and not yet set
  useEffect(() => {
    if (point == null && geo.lat != null && geo.lon != null) {
      setPoint({ lat: geo.lat, lon: geo.lon });
    }
  }, [geo.lat, geo.lon, point]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!point) {
      setError('Tap the map to set a location, or use your location.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addNetwork({
        ssid,
        type,
        password: type === 'password' ? password : undefined,
        notes: notes || undefined,
        venue_name: venue || undefined,
        locations: [point],
        ...(website ? { website } : {}), // honeypot passthrough (server rejects)
      } as any);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Add WiFi</h1>

      <label>Network name (SSID)</label>
      <input value={ssid} onChange={(e) => setSsid(e.target.value)} required />

      <label>Type</label>
      <select value={type} onChange={(e) => setType(e.target.value as NetworkType)}>
        <option value="open">Open (no password)</option>
        <option value="password">Password</option>
        <option value="captive">Captive portal / voucher</option>
      </select>

      {type === 'password' && (
        <>
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required />
        </>
      )}

      {type === 'captive' && (
        <>
          <label>How to get on (portal/voucher notes)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </>
      )}

      <label>Venue name (optional)</label>
      <input value={venue} onChange={(e) => setVenue(e.target.value)} />

      {/* honeypot: real users never see/fill this */}
      <input
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />

      <label>Location {point ? '(tap map to adjust)' : '(tap map to set)'}</label>
      <button type="button" className="btn secondary" onClick={useMyLocation} style={{ marginBottom: '0.5rem' }}>
        Use my location
      </button>
      <MapContainer center={center} zoom={16} style={{ height: '40vh', borderRadius: 12 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Picker onPick={(lat, lon) => setPoint({ lat, lon })} />
        {point && <Marker position={[point.lat, point.lon]} icon={icon} />}
      </MapContainer>

      {error && <p className="muted" style={{ color: '#f87171' }}>{error}</p>}

      <p className="muted">Only share networks you're allowed to share.</p>
      <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '0.5rem' }}>
        {submitting ? 'Adding…' : 'Add network'}
      </button>
    </form>
  );
}
