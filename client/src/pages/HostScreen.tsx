import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import YouTube, { type YouTubeEvent, type YouTubePlayer } from 'react-youtube';
import { loadSession, useRoom } from '../lib/socket.ts';

export default function HostScreen() {
  const code = useParams().code!.toUpperCase();
  const [session] = useState(() => loadSession(code));
  const { state, status, socket } = useRoom(session);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const loadedPlayId = useRef<number | null>(null);
  const playIdRef = useRef(0);
  playIdRef.current = state?.playId ?? 0;

  // Make the player follow the server state.
  useEffect(() => {
    const player = playerRef.current;
    if (!state || !player || !ready || !unlocked) return;

    if (loadedPlayId.current !== state.playId) {
      loadedPlayId.current = state.playId;
      if (!state.current) return void player.stopVideo();
      if (state.status === 'playing') player.loadVideoById(state.current.videoId);
      else player.cueVideoById(state.current.videoId);
      return;
    }
    if (state.status === 'playing') player.playVideo();
    else if (state.status === 'paused') player.pauseVideo();
    else player.stopVideo();
  }, [state?.playId, state?.status, ready, unlocked]);

  const reportEnded = () => socket.current?.emit('player:ended', playIdRef.current);

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

  const me = state.members.find((m) => m.id === session.memberId);
  if (!me?.isHost) {
    return (
      <main className="center-screen">
        <p>Only the room host can open the host screen.</p>
        <Link to={`/room/${code}`}>Go to room</Link>
      </main>
    );
  }

  const joinUrl = `${location.origin}/room/${state.code}`;

  return (
    <main className="screen">
      <div className="stage">
        <YouTube
          className="player"
          iframeClassName="player-frame"
          opts={{ playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0, modestbranding: 1 } }}
          onReady={(e: YouTubeEvent) => {
            playerRef.current = e.target;
            setReady(true);
          }}
          onEnd={reportEnded}
          onError={() => setTimeout(reportEnded, 1500)} // e.g. embedding disabled: skip it
        />
        {!state.current && (
          <div className="stage-idle">
            <h1>🎤 Karaoke</h1>
            <p>Scan the code or go to the room page to reserve a song.</p>
          </div>
        )}
        {state.current && state.status !== 'playing' && (
          <div className="stage-status">{state.status === 'paused' ? '⏸ Paused' : '⏹ Stopped'}</div>
        )}
        {!unlocked && (
          <button className="unlock" onClick={() => setUnlocked(true)}>
            ▶ Tap to start the host screen
            <span className="small">(browsers need one click before playing sound)</span>
          </button>
        )}
      </div>

      <aside className="sidebar">
        <div className="join-box">
          <QRCodeSVG value={joinUrl} size={140} bgColor="transparent" fgColor="currentColor" />
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
      </aside>
    </main>
  );
}
