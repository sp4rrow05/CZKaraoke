import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '../../../shared/types.ts';
import { postJson, saveSession } from '../lib/socket.ts';
import QrScanner from './QrScanner.tsx';

interface Props {
  onDone: (session: Session) => void;
}

function useSubmit(onDone: (s: Session) => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (url: string, body: unknown) => {
    setBusy(true);
    setError('');
    try {
      const session = await postJson<Session>(url, body);
      saveSession(session);
      onDone(session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

export function CreateRoomForm({ onDone }: Props) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const { error, busy, submit } = useSubmit(onDone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit('/api/rooms', { nickname, password });
  };

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Create a room</h2>
      <label>
        Your name
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} required />
      </label>
      <label>
        Room password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={4}
          required
          autoComplete="new-password"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create room'}
      </button>
    </form>
  );
}

interface JoinProps extends Props {
  initialCode?: string;
  /** Set from outside (e.g. the active rooms list) to fill in a code; `at` makes repeat picks count. */
  prefill?: { code: string; at: number } | null;
}

export function JoinRoomForm({ onDone, initialCode = '', prefill }: JoinProps) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [nickname, setNickname] = useState('');
  const [scanning, setScanning] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const onScanned = useCallback((scanned: string) => {
    setCode(scanned);
    setScanning(false);
    setTimeout(() => nameRef.current?.focus(), 0);
  }, []);
  const closeScanner = useCallback(() => setScanning(false), []);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!prefill) return;
    setCode(prefill.code);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameRef.current?.focus({ preventScroll: true });
  }, [prefill]);
  const [password, setPassword] = useState('');
  const { error, busy, submit } = useSubmit(onDone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(`/api/rooms/${encodeURIComponent(code.trim())}/join`, { nickname, password });
  };

  return (
    <form ref={formRef} className="card form" onSubmit={onSubmit}>
      <h2>Join a room</h2>
      <label>
        Room code
        <div className="code-row">
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            autoCapitalize="characters"
          />
          <button type="button" onClick={() => setScanning(true)} title="Scan the QR code on the karaoke screen">
            📷 Scan QR
          </button>
        </div>
      </label>
      {scanning && <QrScanner onCode={onScanned} onClose={closeScanner} />}
      <label>
        Your name
        <input ref={nameRef} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} required />
      </label>
      <label>
        Room password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Joining…' : 'Join room'}
      </button>
    </form>
  );
}
