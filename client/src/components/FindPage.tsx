import { useEffect, useState } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchNearby, type Network } from '../api';
import NetworkCard from './NetworkCard';
import MapView from './MapView';

export default function FindPage() {
  const geo = useGeolocation();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Ask for location on first mount
  useEffect(() => {
    geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (geo.lat == null || geo.lon == null) return;
    setLoading(true);
    fetchNearby(geo.lat, geo.lon, 2000)
      .then((rows) => {
        setNetworks(rows);
        setError(null);
      })
      .catch(() => setError('Could not load networks (offline shows last results).'))
      .finally(() => setLoading(false));
  }, [geo.lat, geo.lon]);

  return (
    <div>
      <h1>WiFi near you</h1>

      {geo.error && (
        <div className="card">
          <p>Location needed to find nearby WiFi.</p>
          <button className="btn" onClick={geo.request}>Enable location</button>
        </div>
      )}

      {geo.lat != null && (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <span className="muted">{loading ? 'Searching…' : `${networks.length} found`}</span>
          <button className="btn secondary" onClick={() => setShowMap((m) => !m)}>
            {showMap ? 'List view' : 'Map view'}
          </button>
        </div>
      )}

      {error && <p className="muted">{error}</p>}

      {showMap && geo.lat != null && geo.lon != null ? (
        <MapView lat={geo.lat} lon={geo.lon} networks={networks} />
      ) : (
        <>
          {networks.map((n) => (
            <NetworkCard key={n.id} network={n} />
          ))}
          {!loading && geo.lat != null && networks.length === 0 && (
            <p className="muted">Nothing nearby yet. Be the first to add one!</p>
          )}
        </>
      )}
    </div>
  );
}
