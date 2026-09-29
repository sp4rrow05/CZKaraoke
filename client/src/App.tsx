import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.tsx';
import Remote from './pages/Remote.tsx';
import HostScreen from './pages/HostScreen.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:code" element={<Remote />} />
      <Route path="/room/:code/screen" element={<HostScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
