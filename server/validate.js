// server/validate.js
const TYPES = ['open', 'password', 'captive'];

export function validateNetworkInput(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['body required'];
  if (!body.ssid || typeof body.ssid !== 'string') errors.push('ssid required');
  if (!TYPES.includes(body.type)) errors.push('invalid type');
  if (body.type === 'password' && !body.password) {
    errors.push('password required for type=password');
  }
  if (!Array.isArray(body.locations) || body.locations.length < 1) {
    errors.push('at least one location required');
  } else {
    for (const loc of body.locations) {
      if (typeof loc.lat !== 'number' || loc.lat < -90 || loc.lat > 90) errors.push('invalid lat');
      if (typeof loc.lon !== 'number' || loc.lon < -180 || loc.lon > 180) errors.push('invalid lon');
    }
  }
  return errors;
}
