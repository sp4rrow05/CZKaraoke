import type { RoomState } from '../../../shared/types.ts';

const STATUS_LABEL = { playing: '▶ Playing', paused: '⏸ Paused', stopped: '⏹ Stopped' };

export default function NowPlaying({ state }: { state: RoomState }) {
  const { current, status } = state;
  if (!current) {
    return (
      <div className="now-playing empty">
        <p className="muted">Nothing is playing. Reserve a song to start!</p>
      </div>
    );
  }
  return (
    <div className="now-playing">
      <img src={current.thumbnail} alt="" />
      <div>
        <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
        <h3>{current.title}</h3>
        <p className="muted">🎤 {current.reservedByName}</p>
      </div>
    </div>
  );
}
