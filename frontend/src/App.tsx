import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

import MainLayout from './components/MainLayout';
import EditorPage from './pages/EditorPage';
import OptionsPage from './pages/Options';
import DataPage from './pages/DataViewerPage';
import TrainingPage from './pages/TrainingPage';
import LoadingPage from './pages/LoadingPage';
import AboutPage from './pages/AboutPage';
import { getApiBaseUrl, setApiPort } from './api/config';
import { info, debug, error } from '@tauri-apps/plugin-log';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initializing...');

  const initApp = async () => {
    setInitError(null);
    setIsReady(false);

    try {
      // 0. In production, get the dynamic port from Tauri
      setStatusMessage('Setting up communication...');
      info("Getting backend port")
      try {
        // This call blocks until the backend reports its actual port
        const port = await invoke<number>('get_backend_port');
        setApiPort(port);
        info(`Using dynamic backend port: ${port}`);
      } catch (e) {
        error('Failed to get backend port from Tauri:' + e);
        throw new Error('System communication failed to initialize.');
      }

      const API_BASE_URL = getApiBaseUrl();

      // 1. Wait for backend to be reachable
      setStatusMessage('Connecting to the math engine...');
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
        throw new Error('The math engine didn\'t respond in time. Please try restarting the application.');
      }

      // 2. Check model status
      debug("Checking model status");
      setStatusMessage('Preparing handwriting recognition...');
      const statusRes = await fetch(`${API_BASE_URL}/api/status`);
      if (!statusRes.ok) {
        throw new Error('Could not verify the recognition engine status.');
      }

      const statusData = await statusRes.json();
      if (!statusData.model_loaded) {
        throw new Error('Unable to load the handwriting engine.');
      }

      // 3. Fetch settings
      setStatusMessage('Applying your settings...');
      const settingsRes = await fetch(`${API_BASE_URL}/api/settings`);
      if (!settingsRes.ok) {
        throw new Error('We couldn\'t load your personal preferences.');
      }

      // Success
      setIsReady(true);
    } catch (e: any) {
      error("Initialization error: " + e);
      setInitError(e.message || 'Ran into an unexpected problem while starting up. Please try again.');
    }
  };

  useEffect(() => {
    invoke('show_main_window');
    initApp();
  }, []);

  if (!isReady) {
    return (
      <LoadingPage
        statusMessage={statusMessage}
        errorMessage={initError || undefined}
        onRetry={() => invoke('relaunch')}
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
        <Route path="/about" element={<AboutPage />} />
      </Route>
    </Routes>
  )
}
export default App
