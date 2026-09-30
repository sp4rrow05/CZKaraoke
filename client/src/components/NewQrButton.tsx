import { useEffect, useState } from 'react';

/** Host only: replaces the QR invite key, e.g. if a photo of the QR code got shared. Asks once to confirm. */
export default function NewQrButton({ onReset }: { onReset: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const reset = async () => {
    setConfirming(false);
    try {
      await onReset();
      setMessage('New QR code ready. The old one no longer works.');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <div className="new-qr">
      {confirming ? (
        <>
          <span className="small">Old QR codes will stop working. People already in the room stay.</span>
          <div className="new-qr-actions">
            <button className="primary" onClick={reset}>
              Make new QR
            </button>
            <button onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <button onClick={() => setConfirming(true)} title="Use if a photo of the QR code was shared">
          🔄 New QR code
        </button>
      )}
      {message && <span className="muted small">{message}</span>}
    </div>
  );
}
