import type { RoomState } from '../../../shared/types.ts';

interface Props {
  state: RoomState;
  memberId: string;
  isHost: boolean;
  onSetScreen: (memberId: string) => void;
}

export default function MembersList({ state, memberId, isHost, onSetScreen }: Props) {
  return (
    <section className="card">
      <h2>People ({state.members.length})</h2>
      {isHost && <p className="muted small">Choose whose device plays the videos.</p>}
      <ul className="members">
        {state.members.map((m) => {
          const isScreen = m.id === state.screenId;
          return (
            <li key={m.id} className="member-row">
              <span className={`dot ${m.online ? 'online' : ''}`} title={m.online ? 'Online' : 'Offline'} />
              <span className="member-name">
                {m.nickname}
                {m.id === memberId && ' (you)'}
                {m.isHost && <span className="tag">host</span>}
                {isScreen && <span className="tag screen">📺 Current song screen</span>}
              </span>
              {isHost && !isScreen && (
                <button onClick={() => onSetScreen(m.id)} disabled={!m.online} title="Play videos on this device">
                  Make screen
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
