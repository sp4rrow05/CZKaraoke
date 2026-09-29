import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, RoomState, ServerToClientEvents, Session } from '../../../shared/types.ts';

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const sessionKey = (code: string) => `karaoke:session:${code.toUpperCase()}`;

export function saveSession(session: Session) {
  try {
    localStorage.setItem(sessionKey(session.code), JSON.stringify(session));
  } catch {}
}

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(sessionKey(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  try {
    localStorage.removeItem(sessionKey(code));
  } catch {}
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed.');
  return data as T;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'unauthorized' | 'closed';

/** Connects to the room with the stored session and tracks the broadcast state. */
export function useRoom(session: Session | null) {
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef<RoomSocket | null>(null);

  useEffect(() => {
    if (!session) return;
    const socket: RoomSocket = io({
      auth: { code: session.code, memberId: session.memberId, token: session.token },
    });
    socketRef.current = socket;

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('reconnecting'));
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') {
        setStatus('unauthorized');
        socket.disconnect();
      } else {
        setStatus('reconnecting');
      }
    });
    socket.on('room:state', setState);
    socket.on('room:closed', () => setStatus('closed'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.code, session?.memberId, session?.token]);

  /** Emits an event and resolves with the server's ack; rejects with the error message. */
  const send = (event: Exclude<keyof ClientToServerEvents, 'player:ended'>, ...args: unknown[]) =>
    new Promise<void>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) return reject(new Error('Not connected.'));
      (socket.emit as any)(event, ...args, (res: { ok: boolean; error?: string }) =>
        res.ok ? resolve() : reject(new Error(res.error)),
      );
    });

  return { state, status, send, socket: socketRef };
}
