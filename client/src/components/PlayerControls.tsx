import type { RoomState } from '../../../shared/types.ts';

interface Props {
  state: RoomState;
  canControl: boolean;
  onAction: (event: 'player:play' | 'player:pause' | 'player:stop' | 'player:next') => void;
}

export default function PlayerControls({ state, canControl, onAction }: Props) {
  const { current, status, queue } = state;
  const disabled = !canControl || !current;

  return (
    <div className="controls">
      {status === 'playing' ? (
        <button disabled={disabled} onClick={() => onAction('player:pause')} title="Pause">
          ⏸ Pause
        </button>
      ) : (
        <button disabled={disabled} onClick={() => onAction('player:play')} title="Play" className="primary">
          ▶ Play
        </button>
      )}
      <button disabled={disabled || status === 'stopped'} onClick={() => onAction('player:stop')} title="Stop">
        ⏹ Stop
      </button>
      <button disabled={disabled} onClick={() => onAction('player:next')} title="Next song">
        ⏭ Next{queue.length ? '' : ' (end)'}
      </button>
      {current && !canControl && (
        <p className="muted small">Only the host or {current.reservedByName} can control this song.</p>
      )}
    </div>
  );
}
