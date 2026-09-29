import { useState, type FormEvent } from 'react';
import type { Session } from '../../../shared/types.ts';
import { postJson, saveSession } from '../lib/socket.ts';

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

export function JoinRoomForm({ onDone, initialCode = '' }: Props & { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const { error, busy, submit } = useSubmit(onDone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(`/api/rooms/${encodeURIComponent(code.trim())}/join`, { nickname, password });
  };

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Join a room</h2>
      <label>
        Room code
        <input
          className="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          required
          autoCapitalize="characters"
        />
      </label>
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
