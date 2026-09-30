import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RoomClosedReason, Session, Video } from '../../../shared/types.ts';
import InviteDialog from '../components/InviteDialog.tsx';
import Logo from '../components/Logo.tsx';
import { inviteFrom } from '../components/QrScanner.tsx';
import { JoinRoomForm } from '../components/RoomForms.tsx';
import MembersList from '../components/MembersList.tsx';
import NowPlaying from '../components/NowPlaying.tsx';
import ParticleBackground from '../components/ParticleBackground.tsx';
import PlayerControls from '../components/PlayerControls.tsx';
import QueueList from '../components/QueueList.tsx';
import SearchPanel from '../components/SearchPanel.tsx';
import { clearSession, loadSession, useRoom } from '../lib/socket.ts';

export default function Remote() {
  const code = useParams().code!.toUpperCase();
  const [session, setSession] = useState<Session | null>(() => loadSession(code));
  // A QR link looks like /room/ABC123#invite=…; keep the key in memory only.
  const [invite] = useState(() => inviteFrom(window.location.hash));

  // Take the invite key out of the address bar so it isn't left in history or shared by accident.
  useEffect(() => {
    if (window.location.hash.includes('invite=')) {
      history.replaceState(history.state, '', window.location.pathname + window.location.search);
    }
  }, []);

  // One background for the whole page, so it doesn't restart when switching from joining to the room.
  return (
    <>
      <ParticleBackground />
      {session ? (
        <RoomView session={session} onLeave={() => setSession(null)} />
      ) : (
        <main className="home">
          <JoinRoomForm initialCode={code} initialInvite={invite} onDone={setSession} />
          <p className="center">
            <Link to="/">← Back</Link>
          </p>
        </main>
      )}
    </>
  );
}

function RoomView({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const navigate = useNavigate();
  const { state, status, closedReason, send } = useRoom(session);
  const [toast, setToast] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // A stale or rejected session: forget it and show the join form again.
  useEffect(() => {
    if (status === 'unauthorized') {
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

  if (status === 'closed') return <RoomClosed reason={closedReason} />;
  if (!state) return <main className="center-screen">Connecting…</main>;

  const me = state.members.find((m) => m.id === session.memberId);
  const isHost = me?.isHost ?? false;
  const isScreen = state.screenId === session.memberId;
  const screenName = state.members.find((m) => m.id === state.screenId)?.nickname ?? 'someone';
  const canControl = isHost || state.current?.reservedBy === session.memberId;
  const screenLink = (
    <a className="button" href={`/room/${state.code}/screen`} target="_blank" rel="noreferrer">
      📺 Open screen
    </a>
  );

  const leave = () => {
    clearSession(session.code);
    navigate('/');
  };

  return (
    <main className="remote">
      <header className="topbar">
        <div className="topbar-brand">
          <Logo width={92} linkHome />
          <div>
            <span className="muted small">Room</span>
            <div className="room-code">{state.code}</div>
          </div>
        </div>
        <div className="topbar-right">
          {status !== 'connected' && <span className="badge paused">Reconnecting…</span>}
          <span className="muted small">
            {session.nickname}
            {isHost && ' (host)'} · {state.members.filter((m) => m.online).length} online
          </span>
          <button onClick={() => setShowInvite(true)} title="Show the room's QR code and invite link">
            📲 Invite
          </button>
          {isScreen && isHost && screenLink}
          {isHost &&
            (confirmClose ? (
              <span className="confirm-close">
                <span className="small">Close for everyone?</span>
                <button className="danger-solid" onClick={() => run(send('room:close'))}>
                  Yes, close
                </button>
                <button onClick={() => setConfirmClose(false)}>Cancel</button>
              </span>
            ) : (
              <button className="danger" onClick={() => setConfirmClose(true)} title="End the room for everyone">
                Close room
              </button>
            ))}
          <button onClick={leave}>Leave</button>
        </div>
      </header>

      {isScreen && !isHost && (
        <div className="banner">
          <span>📺 The host chose your device as the screen. Open it to play the videos here.</span>
          {screenLink}
        </div>
      )}
      {!isScreen && (
        <p className="muted small screen-note">📺 Videos are playing on {screenName}'s screen.</p>
      )}

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
          onPlayNow={(id) => run(send('queue:playNow', id))}
        />
        <MembersList
          state={state}
          memberId={session.memberId}
          isHost={isHost}
          onSetScreen={(id) => run(send('room:setScreen', id))}
        />
      </div>

      {showInvite && (
        <InviteDialog
          code={state.code}
          inviteToken={state.inviteToken}
          isHost={isHost}
          onResetInvite={() => send('room:resetInvite')}
          onClose={() => setShowInvite(false)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function RoomClosed({ reason }: { reason: RoomClosedReason | null }) {
  return (
    <main className="center-screen">
      <h2>🎤 This room has been closed</h2>
      <p className="muted">
        {reason === 'idle'
          ? 'It was closed after a long time without activity.'
          : 'The host ended the room. Thanks for singing!'}
      </p>
      <Link className="button primary-link" to="/">
        Back to home
      </Link>
    </main>
  );
}
