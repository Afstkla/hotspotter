export default function AboutPage() {
  return (
    <div>
      <h1>About</h1>
      <p>
        Hotspotter is a community map of semi-public WiFi — cafés, hostels, co-working
        spots and other networks meant to be shared. Find what's near you, and add what
        you know.
      </p>
      <h2>Privacy</h2>
      <p className="muted">
        No accounts, no personal data. A random ID stored on your device lets us count one
        vote per person — that's it.
      </p>
      <h2>Please be fair</h2>
      <p className="muted">
        Only add networks you're permitted to share. Found something private or wrong?
        Use the "Report" button on any entry.
      </p>
      <h2>Heads up</h2>
      <p className="muted">
        The web app ranks WiFi by distance and lets you copy the password. The iOS app adds
        one-tap <strong>Connect</strong>. Listing the networks your phone can currently see is
        Android-only — Apple doesn't allow it.
      </p>
    </div>
  );
}
