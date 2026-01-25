import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MainLayout from './components/MainLayout';
import EditorPage from './pages/EditorPage';
import OptionsPage from './pages/Options';
import DataPage from './pages/DataPage';
import TrainingPage from './pages/TrainingPage';
import LoadingPage from './pages/LoadingPage';
import { API_BASE_URL } from './config';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Connecting to backend...');

  const initApp = async () => {
    setInitError(null);
    setIsReady(false);

    try {
      // 1. Wait for backend to be reachable
      setStatusMessage('Connecting to backend...');
      let connected = false;
      let attempts = 0;
      while (!connected && attempts < 50) {
        try {
          const res = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
          if (res.ok || res.status === 404) {
            connected = true;
          }
        } catch (e) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (!connected) {
        throw new Error('Backend server is not responding. Please check if the background process is running.');
      }

      // 2. Check model status
      setStatusMessage('Checking recognition model...');
      const statusRes = await fetch(`${API_BASE_URL}/api/status`);
      if (!statusRes.ok) throw new Error('Failed to fetch model status');

      const statusData = await statusRes.json();
      if (!statusData.model_loaded) {
        throw new Error('Recognition model failed to load. You might need to train it in the Training page if it persists.');
      }

      // 3. Fetch settings
      setStatusMessage('Loading preferences...');
      const settingsRes = await fetch(`${API_BASE_URL}/api/settings`);
      if (!settingsRes.ok) throw new Error('Failed to fetch application settings');

      // Success
      setIsReady(true);
    } catch (e: any) {
      console.error('Initialization error:', e);
      setInitError(e.message || 'An unexpected error occurred during startup.');
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  if (!isReady) {
    return (
      <LoadingPage
        statusMessage={statusMessage}
        errorMessage={initError || undefined}
        onRetry={initApp}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route element={<MainLayout />}>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/options" element={<OptionsPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/training" element={<TrainingPage />} />
      </Route>
    </Routes>
  )
}
export default App
