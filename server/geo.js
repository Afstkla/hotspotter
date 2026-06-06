const EARTH_RADIUS_M = 6371000;
const DEG_PER_M_LAT = 1 / 111320;

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function boundingBox(lat, lon, radiusMeters) {
  const dLat = radiusMeters * DEG_PER_M_LAT;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const dLon = (radiusMeters * DEG_PER_M_LAT) / cosLat;
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}
