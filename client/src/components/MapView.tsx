import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Network } from '../api';

// Fix default marker icons under bundlers
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapView({
  lat,
  lon,
  networks,
}: {
  lat: number;
  lon: number;
  networks: Network[];
}) {
  return (
    <MapContainer center={[lat, lon]} zoom={16} style={{ height: '60vh', borderRadius: 12 }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle center={[lat, lon]} radius={20} />
      {networks.map((n) =>
        n.nearest_location ? (
          <Marker key={n.id} position={[n.nearest_location.lat, n.nearest_location.lon]} icon={icon}>
            <Popup>
              <strong>{n.ssid}</strong>
              <br />
              {n.venue_name ?? n.type}
              {n.type === 'password' && <><br />🔒 open the list for the password</>}
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
