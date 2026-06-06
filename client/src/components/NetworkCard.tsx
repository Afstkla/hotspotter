import { useState } from 'react';
import type { Network } from '../api';
import { voteNetwork, reportNetwork } from '../api';

const TYPE_LABEL: Record<Network['type'], string> = {
  open: 'open',
  password: '🔒 password',
  captive: 'portal',
};

function formatDistance(m?: number): string {
  if (m == null) return '';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function confirmedLabel(iso: string | null): string {
  if (!iso) return 'never confirmed';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'confirmed today';
  if (days === 1) return 'confirmed 1 day ago';
  return `confirmed ${days} days ago`;
}

export default function NetworkCard({ network }: { network: Network }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(network.score);
  const [reported, setReported] = useState(false);

  async function handleVote(works: boolean) {
    try {
      const updated = await voteNetwork(network.id, works);
      setScore(updated.score);
    } catch {
      /* offline / failed: ignore, UI stays */
    }
  }

  async function handleReport() {
    try {
      await reportNetwork(network.id, 'reported from app');
      setReported(true);
    } catch {
      /* offline / failed: leave the button active to retry */
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer' }}>
          {network.ssid}
          <span className="badge">{TYPE_LABEL[network.type]}</span>
        </strong>
        <span className="muted">{formatDistance(network.distance_m)}</span>
      </div>
      {network.venue_name && <div className="muted">{network.venue_name}</div>}
      <div className="muted">
        score {score} · {confirmedLabel(network.last_confirmed)}
      </div>

      {open && (
        <div style={{ marginTop: '0.6rem' }}>
          {network.type === 'password' && network.password && (
            <div className="row">
              <code>{network.password}</code>
              <button className="btn secondary" onClick={() => navigator.clipboard.writeText(network.password!)}>
                Copy
              </button>
            </div>
          )}
          {network.type === 'open' && <div className="muted">Open network — no password.</div>}
          {network.notes && <p>{network.notes}</p>}

          <div className="row" style={{ marginTop: '0.6rem' }}>
            <button className="btn secondary" onClick={() => handleVote(true)}>👍 Works</button>
            <button className="btn secondary" onClick={() => handleVote(false)}>👎 Nope</button>
            <button className="btn secondary" onClick={handleReport} disabled={reported}>
              {reported ? 'Reported' : 'Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
