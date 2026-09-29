import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActiveRooms from '../components/ActiveRooms.tsx';
import ParticleBackground from '../components/ParticleBackground.tsx';
import { CreateRoomForm, JoinRoomForm } from '../components/RoomForms.tsx';

export default function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [prefill, setPrefill] = useState<{ code: string; at: number } | null>(null);

  return (
    <>
      <ParticleBackground />
      <main className="home">
        <header className="hero">
          <h1>🎤 CZKaraoke</h1>
          <p>Create a private room, open the host screen on a TV, and let everyone reserve songs from their phone.</p>
        </header>
        <div className="home-grid">
          <CreateRoomForm onDone={(s) => navigate(`/room/${s.code}`)} />
          <JoinRoomForm
            initialCode={params.get('code') ?? ''}
            prefill={prefill}
            onDone={(s) => navigate(`/room/${s.code}`)}
          />
        </div>
        <ActiveRooms onJoin={(code) => setPrefill({ code, at: Date.now() })} />
      </main>
    </>
  );
}
