import type { RoomState } from '../../../shared/types.ts';

interface Props {
  state: RoomState;
  memberId: string;
  isHost: boolean;
  onRemove: (itemId: string) => void;
  onMove: (itemId: string, dir: -1 | 1) => void;
  onPlayNow: (itemId: string) => void;
}

export default function QueueList({ state, memberId, isHost, onRemove, onMove, onPlayNow }: Props) {
  const { queue } = state;
  return (
    <section className="card">
      <h2>Up next ({queue.length})</h2>
      {!queue.length && <p className="muted">No songs reserved yet.</p>}
      <ol className="queue">
        {queue.map((item, i) => (
          <li key={item.id} className={`song-row${item.reservedBy === memberId ? ' mine' : ''}${isHost ? ' with-actions' : ''}`}>
            <span className="queue-num">{i + 1}</span>
            <img src={item.thumbnail} alt="" loading="lazy" />
            <div className="song-info">
              <strong>{item.title}</strong>
              <span className="muted">
                🎤 {item.reservedByName} · {item.duration}
              </span>
            </div>
            <div className="row-actions">
              {isHost && (
                <>
                  <button className="primary play-now" onClick={() => onPlayNow(item.id)} title="Play this song now">
                    ▶ Play now
                  </button>
                  <button disabled={i === 0} onClick={() => onMove(item.id, -1)} title="Move up">
                    ↑
                  </button>
                  <button disabled={i === queue.length - 1} onClick={() => onMove(item.id, 1)} title="Move down">
                    ↓
                  </button>
                </>
              )}
              {(isHost || item.reservedBy === memberId) && (
                <button className="danger" onClick={() => onRemove(item.id)} title="Remove">
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
