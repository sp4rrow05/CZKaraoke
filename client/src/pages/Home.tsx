import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateRoomForm, JoinRoomForm } from '../components/RoomForms.tsx';

export default function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (
    <main className="home">
      <header className="hero">
        <h1>🎤 Karaoke Rooms</h1>
        <p>Create a private room, open the host screen on a TV, and let everyone reserve songs from their phone.</p>
      </header>
      <div className="home-grid">
        <CreateRoomForm onDone={(s) => navigate(`/room/${s.code}`)} />
        <JoinRoomForm initialCode={params.get('code') ?? ''} onDone={(s) => navigate(`/room/${s.code}`)} />
      </div>
    </main>
  );
}
