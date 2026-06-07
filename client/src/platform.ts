// Capacitor seam. On the web these are no-ops / not-supported.
// A future Capacitor wrap re-implements these against native WiFi plugins,
// and all consumers keep working unchanged.

export const isNative = false;

/** True only where the platform can programmatically join a network. */
export const canConnect = isNative;

/** True only where the platform can list visible SSIDs (Android native). */
export const canScan = isNative;

export async function connectToNetwork(_ssid: string, _password?: string): Promise<boolean> {
  return false;
}

export async function scanNetworks(): Promise<string[]> {
  return [];
}

export async function getConnectedSsid(): Promise<string | null> {
  return null;
}
