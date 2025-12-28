import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Command } from '@tauri-apps/plugin-shell';
import MainLayout from './components/MainLayout';
import EditorPage from './pages/EditorPage';
import OptionsPage from './pages/Options';
import TrainingPage from './pages/Training';

function App() {
  useEffect(() => {
    const startBackend = async () => {
      try {
        // Spawn the sidecar
        // Note: 'binaries/trackpad-chars-backend' matches the externalBin entry in tauri.conf.json
        const command = Command.sidecar('binaries/trackpad-chars-backend');
        const child = await command.spawn();
        console.log('Backend process started with PID:', child.pid);
      } catch (error) {
        console.error('Failed to start backend sidecar:', error);
      }
    };

    startBackend();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route element={<MainLayout />}>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/options" element={<OptionsPage />} />
        <Route path="/training" element={<TrainingPage />} />
      </Route>
    </Routes>
  )
}
export default App
