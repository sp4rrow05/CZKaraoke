import { useEffect, useState } from 'react';
import type { RoomSummary } from '../../../shared/types.ts';

const REFRESH_MS = 5000;

export default function ActiveRooms({ onJoin }: { onJoin: (code: string) => void }) {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          setRooms(data.rooms);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
      // Only keep polling while the page is visible.
      if (!cancelled && document.visibilityState === 'visible') timer = setTimeout(load, REFRESH_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      load();
    };

    load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <section className="card active-rooms">
      <div className="card-head">
        <h2>Active rooms {rooms && rooms.length > 0 && <span className="muted">({rooms.length})</span>}</h2>
        <span className="muted small">{error ? 'Can’t reach the server' : 'Updates automatically'}</span>
      </div>
      {rooms === null && !error && <p className="muted">Loading…</p>}
      {rooms?.length === 0 && <p className="muted">No active rooms right now. Create one above!</p>}
      {!!rooms?.length && (
        <ul className="room-list">
          {rooms.map((r) => (
            <li key={r.code} className="room-item">
              <div className="room-item-info">
                <span className="room-item-code">
                  {r.code}
                  {r.playing && <span className="tag live">🎵 live</span>}
                </span>
                <span className="muted small">
                  {r.hostName ? `${r.hostName}’s room` : 'Karaoke room'}
                </span>
              </div>
              <span className="room-item-count" title={`${r.online} online of ${r.members} joined`}>
                <span className="dot online" /> {r.online} {r.online === 1 ? 'person' : 'people'}
              </span>
              <button onClick={() => onJoin(r.code)}>Join</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
