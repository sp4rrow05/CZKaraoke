import { useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeEvent, type YouTubePlayer } from 'react-youtube';
import type { RoomState } from '../../../shared/types.ts';

interface Props {
  state: RoomState;
  /** False until the viewer has clicked once, so the browser allows sound. */
  unlocked: boolean;
  /** Called with the playId that finished (or failed to play). */
  onEnded: (playId: number) => void;
}

const PLAYER_OPTS = { playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0, modestbranding: 1 } } as const;

/**
 * The YouTube player, kept in sync with the room state.
 *
 * It owns its player reference, so it only ever talks to the player it created itself. A
 * destroyed player (after an unmount, or React's dev-mode double mount) throws when called,
 * so every call is also guarded.
 */
export default function ScreenPlayer({ state, unlocked, onEnded }: Props) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const loadedPlayId = useRef<number | null>(null);
  const playIdRef = useRef(state.playId);
  playIdRef.current = state.playId;

  useEffect(
    () => () => {
      playerRef.current = null;
    },
    [],
  );

  const call = (fn: (player: YouTubePlayer) => void) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      fn(player);
    } catch (err) {
      console.warn('YouTube player call failed', err);
    }
  };

  // Make the player follow the server state.
  useEffect(() => {
    if (!ready || !unlocked) return;
    if (loadedPlayId.current !== state.playId) {
      loadedPlayId.current = state.playId;
      const current = state.current;
      if (!current) return call((p) => p.stopVideo());
      if (state.status === 'playing') call((p) => p.loadVideoById(current.videoId));
      else call((p) => p.cueVideoById(current.videoId));
      return;
    }
    if (state.status === 'playing') call((p) => p.playVideo());
    else if (state.status === 'paused') call((p) => p.pauseVideo());
    else call((p) => p.stopVideo());
  }, [state.playId, state.status, ready, unlocked]);

  const onReady = (e: YouTubeEvent) => {
    // Ignore a player whose iframe is already gone (destroyed before it finished loading).
    let alive = false;
    try {
      alive = !!e.target.getIframe()?.isConnected;
    } catch {}
    if (!alive) return;
    playerRef.current = e.target;
    setReady(true);
  };

  return (
    <YouTube
      className="player"
      iframeClassName="player-frame"
      opts={PLAYER_OPTS}
      onReady={onReady}
      onEnd={() => onEnded(playIdRef.current)}
      // For example, embedding disabled for this video: skip it.
      onError={() => {
        const failed = playIdRef.current;
        setTimeout(() => onEnded(failed), 1500);
      }}
    />
  );
}
