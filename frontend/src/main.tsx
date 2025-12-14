import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import '@mantine/core/styles.css';
import './index.css'
import { MathfieldElement } from 'mathlive';

MathfieldElement.fontsDirectory = '/fonts';

const theme = createTheme({
  primaryColor: 'blue',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
)
