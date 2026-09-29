import { useState, type FormEvent } from 'react';
import type { Session, Video } from '../../../shared/types.ts';
import { apiUrl } from '../lib/config.ts';

interface Props {
  session: Session;
  onReserve: (video: Video) => Promise<void>;
}

export default function SearchPanel({ session, onReserve }: Props) {
  const [query, setQuery] = useState('');
  const [karaoke, setKaraoke] = useState(true);
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reserved, setReserved] = useState<Set<string>>(new Set());

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: query, karaoke: karaoke ? '1' : '0' });
      const res = await fetch(apiUrl(`/api/search?${params}`), {
        headers: { 'x-room': session.code, 'x-member': session.memberId, 'x-token': session.token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed.');
      setResults(data.results);
      if (!data.results.length) setError('No results.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const [pending, setPending] = useState<string | null>(null);

  const reserve = async (video: Video) => {
    setPending(video.videoId);
    setError('');
    try {
      await onReserve(video);
      setReserved((s) => new Set(s).add(video.videoId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="card">
      <h2>Search songs</h2>
      <form className="search-bar" onSubmit={search}>
        <input
          type="search"
          placeholder="Song or artist…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
        />
        <button className="primary" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </form>
      <label className="checkbox">
        <input type="checkbox" checked={karaoke} onChange={(e) => setKaraoke(e.target.checked)} />
        Karaoke versions only
      </label>
      {error && <p className="error">{error}</p>}
      <ul className="results">
        {results.map((v) => (
          <li key={v.videoId} className="song-row">
            <img src={v.thumbnail} alt="" loading="lazy" />
            <div className="song-info">
              <strong>{v.title}</strong>
              <span className="muted">
                {v.channel} · {v.duration}
              </span>
            </div>
            <button
              onClick={() => reserve(v)}
              disabled={pending === v.videoId}
              className={reserved.has(v.videoId) ? '' : 'primary'}
            >
              {pending === v.videoId ? 'Reserving…' : reserved.has(v.videoId) ? 'Reserved ✓' : 'Reserve'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
