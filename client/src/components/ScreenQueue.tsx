import { useEffect, useState } from 'react';
import type { QueueItem } from '../../../shared/types.ts';

interface Props {
  queue: QueueItem[];
  onPlayNext: (itemId: string) => Promise<void>;
  onPlayNow: (itemId: string) => Promise<void>;
}

/** The screen's "Up next" list. Tap a song to play it next or right away. */
export default function ScreenQueue({ queue, onPlayNext, onPlayNow }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Forget the selection if that song left the queue (played, removed, or picked elsewhere).
  useEffect(() => {
    if (selected && !queue.some((q) => q.id === selected)) setSelected(null);
  }, [queue, selected]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const run = async (action: (id: string) => Promise<void>, id: string) => {
    setBusy(true);
    setError('');
    try {
      await action(id);
      setSelected(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!queue.length) return <p className="muted">No reservations</p>;

  return (
    <>
      <p className="muted small screen-queue-hint">Tap a song to choose what plays next.</p>
      <ol className="screen-queue">
        {queue.map((q, i) => {
          const isSelected = q.id === selected;
          return (
            <li key={q.id} className={isSelected ? 'selected' : ''}>
              <button
                className="screen-queue-item"
                onClick={() => setSelected(isSelected ? null : q.id)}
                aria-expanded={isSelected}
              >
                <span className="screen-queue-num">{i + 1}</span>
                <span className="screen-queue-text">
                  <strong>{q.title}</strong>
                  <span className="muted">🎤 {q.reservedByName}</span>
                </span>
              </button>
              {isSelected && (
                <div className="screen-queue-actions">
                  {i === 0 ? (
                    <span className="muted small">Already next</span>
                  ) : (
                    <button disabled={busy} onClick={() => run(onPlayNext, q.id)}>
                      ⏭ Play next
                    </button>
                  )}
                  <button className="primary" disabled={busy} onClick={() => run(onPlayNow, q.id)}>
                    ▶ Play now
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p className="error small">{error}</p>}
    </>
  );
}
