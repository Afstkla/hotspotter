# Hotspotter iOS (Capacitor) — build & ship guide

The iOS app is a Capacitor wrap of the web app. It adds native **"Connect now"**
(`NEHotspotConfiguration`). Everything else is the same web UI.

> Note on capabilities: iOS apps **cannot scan for nearby SSIDs** (Apple forbids it), so
> "see what your phone can currently see" is Android-only. iOS only gets one-tap connect.

## Layout

- Web app: `client/` (the source of truth for the UI).
- Capacitor config: `client/capacitor.config.ts` (`appId: nl.afstkla.hotspotter`, `webDir: dist`).
- Native project: `client/ios/` (committed; build artifacts are gitignored).
- The connect-now plugin lives in `client/ios/App/App/AppDelegate.swift` (`WifiPlugin`,
  exposed to JS as `Wifi`). The web seam that calls it is `client/src/platform.ts`.

## One-time setup (on a Mac with Xcode)

1. Install tooling (already done on the build machine):
   ```bash
   brew install cocoapods            # Capacitor iOS dependency
   cd client && npm install
   ```
2. Build the web assets and sync them into the native project:
   ```bash
   cd client
   npm run build
   npx cap sync ios
   ```
3. Open the project in Xcode:
   ```bash
   npx cap open ios
   ```

## Make it run on a device (required for WiFi — the simulator can't join networks)

1. In Xcode → **Signing & Capabilities**:
   - Set your **Team** (needs a free or paid Apple ID; the Hotspot capability below needs a
     **paid Apple Developer account, $99/yr**).
   - Click **+ Capability → Hotspot Configuration**. This adds the
     `com.apple.developer.networking.HotspotConfiguration` entitlement and wires it into the
     build. Without it, `connect` fails at runtime with a permission error.
   - (Optional) **+ Capability → Access WiFi Information** if you later want to read the
     currently-connected SSID.
2. Plug in an iPhone, select it as the run target, and press ▶.
3. Open a network in the list and tap **📶 Connect now**.

## Day-to-day

After any web change:
```bash
cd client && npm run build && npx cap sync ios
```
Then re-run from Xcode. (`cap sync` = copy web build + update native plugins.)

## App icon

The marketing icon source is `client/public/icons/icon.svg`. To regenerate the native iOS
icon set from it, drop a 1024×1024 PNG at `client/assets/icon.png` and run
`npx @capacitor/assets generate --ios` (install `@capacitor/assets` first).

## How "Connect now" works

`client/src/platform.ts` calls the native `Wifi.connect({ ssid, password })`. On iOS that
runs `NEHotspotConfigurationManager.shared.apply(...)`. On the web (and anywhere
`canConnect` is false) it's a no-op that returns `false`, so the button is simply hidden.
