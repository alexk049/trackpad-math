import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals';
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css'
import { MathfieldElement } from 'mathlive';
import { info } from '@tauri-apps/plugin-log';
import { Notifications } from '@mantine/notifications';

MathfieldElement.fontsDirectory = '/fonts';
// turn off math virtual keyboard button click sounds
MathfieldElement.soundsDirectory = null;

// Log startup
info('Frontend application started').catch(console.error);

const theme = createTheme({
  primaryColor: 'blue',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <ModalsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
)
