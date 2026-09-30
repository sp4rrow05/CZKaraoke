import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '../../../shared/types.ts';
import { postJson, saveSession } from '../lib/socket.ts';
import QrScanner, { type ScannedRoom } from './QrScanner.tsx';

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
  /** Invite key from a scanned QR link: join with just a name, no password. */
  initialInvite?: string | null;
  /** Set from outside (e.g. the active rooms list) to fill in a code; `at` makes repeat picks count. */
  prefill?: { code: string; at: number } | null;
}

export function JoinRoomForm({ onDone, initialCode = '', initialInvite = null, prefill }: JoinProps) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [invite, setInvite] = useState<string | null>(initialInvite);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [scanning, setScanning] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { error, busy, submit } = useSubmit(onDone);

  const onScanned = useCallback((scanned: ScannedRoom) => {
    setCode(scanned.code);
    setInvite(scanned.invite);
    setScanning(false);
    setTimeout(() => nameRef.current?.focus(), 0);
  }, []);
  const closeScanner = useCallback(() => setScanning(false), []);

  useEffect(() => {
    if (!prefill) return;
    setCode(prefill.code);
    setInvite(null); // picked from the list: needs the password
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameRef.current?.focus({ preventScroll: true });
  }, [prefill]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = invite ? { nickname, invite } : { nickname, password };
    submit(`/api/rooms/${encodeURIComponent(code.trim())}/join`, body);
  };

  // Came from a QR code: the invite key replaces the code and password, so only ask for a name.
  if (invite) {
    return (
      <form ref={formRef} className="card form" onSubmit={onSubmit}>
        <h2>Join room {code}</h2>
        <p className="muted small qr-note">📷 You scanned the room’s QR code, so no password is needed.</p>
        <label>
          Your name
          <input
            ref={nameRef}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            required
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Joining…' : 'Join room'}
        </button>
        <button type="button" className="link-button" onClick={() => setInvite(null)}>
          Use the room code and password instead
        </button>
      </form>
    );
  }

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
      {scanning && <QrScanner onScan={onScanned} onClose={closeScanner} />}
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
