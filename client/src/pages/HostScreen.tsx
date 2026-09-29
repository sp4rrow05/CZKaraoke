import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import ScreenPlayer from '../components/ScreenPlayer.tsx';
import { useFullscreen, useIdle } from '../lib/fullscreen.ts';
import { loadSession, useRoom } from '../lib/socket.ts';
import { useWakeLock } from '../lib/wakeLock.ts';

export default function HostScreen() {
  const code = useParams().code!.toUpperCase();
  const [session] = useState(() => loadSession(code));
  const { state, status, socket } = useRoom(session);

  const [unlocked, setUnlocked] = useState(false);
  const isScreen = !!state && !!session && state.screenId === session.memberId;

  const stageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, pseudo, toggle: toggleFullscreen } = useFullscreen(stageRef);
  const idle = useIdle(isFullscreen);
  const wakeLock = useWakeLock(isScreen && unlocked);
  const wakeLockProblem =
    unlocked && (wakeLock === 'unsupported' || wakeLock === 'failed')
      ? wakeLock === 'unsupported'
        ? 'This browser can’t keep the screen on here (needs an HTTPS link). Set Auto-Lock / Screen timeout to “Never” in your phone settings.'
        : 'Couldn’t keep the screen on (battery saver may be blocking it). Set Auto-Lock / Screen timeout to “Never” in your phone settings.'
      : null;

  // "F" toggles fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f' && !(e.target instanceof HTMLInputElement)) toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  const reportEnded = (playId: number) => socket.current?.emit('player:ended', playId);

  if (!session) {
    return (
      <main className="center-screen">
        <p>The host screen must be opened from the host's device.</p>
        <Link to={`/room/${code}`}>Go to room</Link>
      </main>
    );
  }
  if (status === 'unauthorized' || status === 'closed') {
    return (
      <main className="center-screen">
        <p>This room is no longer available.</p>
        <Link to="/">Home</Link>
      </main>
    );
  }
  if (!state) return <main className="center-screen">Connecting…</main>;

  if (!isScreen) {
    const screenName = state.members.find((m) => m.id === state.screenId)?.nickname ?? 'someone else';
    return (
      <main className="center-screen">
        <h2>📺 The screen is on {screenName}'s device</h2>
        <p className="muted">Only the device the host chose can play the videos. You can close this tab.</p>
        <Link to={`/room/${code}`}>Back to room</Link>
      </main>
    );
  }

  const joinUrl = `${location.origin}/room/${state.code}`;

  return (
    <main className="host-screen-layout">
      <div
        ref={stageRef}
        className={`stage${isFullscreen ? ' is-fullscreen' : ''}${pseudo ? ' pseudo-fullscreen' : ''}${idle ? ' idle' : ''}`}
      >
        <ScreenPlayer state={state} unlocked={unlocked} onEnded={reportEnded} />
        {/* Keeps clicks off the video (so it can't drift from the room state) and lets us see mouse moves. */}
        <div className="stage-shield" onDoubleClick={toggleFullscreen} />
        {!state.current && (
          <div className="stage-idle">
            <h1>🎤 Karaoke</h1>
            <p>Scan the code or go to the room page to reserve a song.</p>
          </div>
        )}
        {state.current && state.status !== 'playing' && (
          <div className="stage-status">{state.status === 'paused' ? '⏸ Paused' : '⏹ Stopped'}</div>
        )}
        {isFullscreen && (
          <div className="fs-info">
            <div>
              {state.current ? (
                <>
                  <strong>{state.current.title}</strong>
                  <span>🎤 {state.current.reservedByName}</span>
                </>
              ) : (
                <strong>Reserve a song to start</strong>
              )}
            </div>
            <div className="fs-next">
              {state.queue[0] ? (
                <span>
                  Next: {state.queue[0].title} · 🎤 {state.queue[0].reservedByName}
                </span>
              ) : (
                <span className="muted">No more reservations</span>
              )}
              <span className="fs-code">Room {state.code}</span>
              {wakeLockProblem && <span className="fs-warn">⚠ Screen may turn off</span>}
            </div>
          </div>
        )}
        <button className="fs-toggle" onClick={toggleFullscreen} title="Fullscreen (F)">
          {isFullscreen ? '✕ Exit fullscreen' : '⛶ Fullscreen'}
        </button>
        {!unlocked && (
          <button className="unlock" onClick={() => setUnlocked(true)}>
            ▶ Tap to start the host screen
            <span className="small">(browsers need one click before playing sound)</span>
          </button>
        )}
      </div>

      <aside className="sidebar">
        <div className="join-box">
          <QRCodeSVG value={joinUrl} size={120} bgColor="transparent" fgColor="currentColor" />
          <div>
            <span className="muted small">Room code</span>
            <div className="room-code big">{state.code}</div>
            <span className="muted small">Password required</span>
          </div>
        </div>
        {state.current && (
          <div className="screen-now">
            <span className="muted small">Now singing</span>
            <strong>{state.current.title}</strong>
            <span>🎤 {state.current.reservedByName}</span>
          </div>
        )}
        <h3>Up next</h3>
        <ol className="screen-queue">
          {state.queue.slice(0, 8).map((q) => (
            <li key={q.id}>
              <strong>{q.title}</strong>
              <span className="muted">🎤 {q.reservedByName}</span>
            </li>
          ))}
          {!state.queue.length && <li className="muted">No reservations</li>}
          {state.queue.length > 8 && <li className="muted">+{state.queue.length - 8} more</li>}
        </ol>
        {status !== 'connected' && <span className="badge paused">Reconnecting…</span>}
        {wakeLock === 'on' && <p className="muted small">☀ Screen will stay on while this page is open.</p>}
        {wakeLockProblem && <p className="wake-warn small">⚠ {wakeLockProblem}</p>}
      </aside>
    </main>
  );
}
