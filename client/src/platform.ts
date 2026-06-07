// Capacitor seam. On the web these stay no-ops; inside the native app they call
// the WifiPlugin (see ios/App/App/AppDelegate.swift). Consumers don't change.
import { Capacitor, registerPlugin } from '@capacitor/core';

interface WifiPlugin {
  canConnect(): Promise<{ value: boolean }>;
  connect(options: { ssid: string; password?: string }): Promise<{
    connected: boolean;
    alreadyConnected?: boolean;
  }>;
}

const Wifi = registerPlugin<WifiPlugin>('Wifi');

export const isNative = Capacitor.isNativePlatform();

/** True only where the platform can programmatically join a network (iOS + Android native). */
export const canConnect = isNative;

/**
 * True only where the platform can list visible SSIDs.
 * Android can; iOS cannot (Apple forbids scanning). Web cannot.
 */
export const canScan = isNative && Capacitor.getPlatform() === 'android';

/** Join a network. Returns true on success. No-op (false) on the web. */
export async function connectToNetwork(ssid: string, password?: string): Promise<boolean> {
  if (!canConnect) return false;
  try {
    const res = await Wifi.connect({ ssid, password });
    return res.connected;
  } catch {
    return false;
  }
}

/** List visible SSIDs (Android only). Empty everywhere else. */
export async function scanNetworks(): Promise<string[]> {
  // Android scan plugin lands with the Android target; iOS/web return nothing.
  return [];
}

export async function getConnectedSsid(): Promise<string | null> {
  return null;
}
