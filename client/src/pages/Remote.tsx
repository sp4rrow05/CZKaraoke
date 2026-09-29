import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Session, Video } from '../../../shared/types.ts';
import { JoinRoomForm } from '../components/RoomForms.tsx';
import NowPlaying from '../components/NowPlaying.tsx';
import PlayerControls from '../components/PlayerControls.tsx';
import QueueList from '../components/QueueList.tsx';
import SearchPanel from '../components/SearchPanel.tsx';
import { clearSession, loadSession, useRoom } from '../lib/socket.ts';

export default function Remote() {
  const code = useParams().code!.toUpperCase();
  const [session, setSession] = useState<Session | null>(() => loadSession(code));

  if (!session) {
    return (
      <main className="home">
        <JoinRoomForm initialCode={code} onDone={setSession} />
        <p className="center">
          <Link to="/">← Back</Link>
        </p>
      </main>
    );
  }
  return <RoomView session={session} onLeave={() => setSession(null)} />;
}

function RoomView({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const navigate = useNavigate();
  const { state, status, send } = useRoom(session);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (status === 'unauthorized' || status === 'closed') {
      clearSession(session.code);
      onLeave();
    }
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (p: Promise<void>) => p.catch((err: Error) => setToast(err.message));

  if (!state) return <main className="center-screen">Connecting…</main>;

  const me = state.members.find((m) => m.id === session.memberId);
  const isHost = me?.isHost ?? false;
  const canControl = isHost || state.current?.reservedBy === session.memberId;

  const leave = () => {
    clearSession(session.code);
    navigate('/');
  };

  return (
    <main className="remote">
      <header className="topbar">
        <div>
          <span className="muted small">Room</span>
          <div className="room-code">{state.code}</div>
        </div>
        <div className="topbar-right">
          {status !== 'connected' && <span className="badge paused">Reconnecting…</span>}
          <span className="muted small">
            {session.nickname}
            {isHost && ' (host)'} · {state.members.filter((m) => m.online).length} online
          </span>
          {isHost && (
            <a className="button" href={`/room/${state.code}/screen`} target="_blank" rel="noreferrer">
              📺 Open host screen
            </a>
          )}
          <button onClick={leave}>Leave</button>
        </div>
      </header>

      <section className="card">
        <h2>Now playing</h2>
        <NowPlaying state={state} />
        <PlayerControls state={state} canControl={canControl} onAction={(e) => run(send(e))} />
      </section>

      <div className="remote-grid">
        <SearchPanel session={session} onReserve={(video: Video) => send('queue:add', video)} />
        <QueueList
          state={state}
          memberId={session.memberId}
          isHost={isHost}
          onRemove={(id) => run(send('queue:remove', id))}
          onMove={(id, dir) => run(send('queue:move', id, dir))}
        />
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
