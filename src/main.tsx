import React from 'react';
import App from './App';
import './index.css';
import {createRoot} from 'react-dom/client';
import {SnackbarProvider} from './contexts/snackbarProvider';
import {loadRuntimeConfig} from './utils/api/config';
import {Alert, CssBaseline, ThemeProvider} from '@mui/material';
import {theme} from './theme';
import {SessionRoot} from './components/session/SessionRoot';
import {browserEnvironment} from './observability/browserEnvironment';

const root = createRoot(document.getElementById('root')!);
loadRuntimeConfig().then(config => {
  const monitoredEnvironment = browserEnvironment(config, window.location);
  if (monitoredEnvironment) {
    void import('./observability/startNewRelicBrowser')
      .then(({startNewRelicBrowser}) => startNewRelicBrowser(monitoredEnvironment))
      .catch(() => undefined);
  }
  root.render(<React.StrictMode><ThemeProvider theme={theme}><CssBaseline/>
    <SessionRoot config={config}><SnackbarProvider><App/></SnackbarProvider></SessionRoot>
  </ThemeProvider></React.StrictMode>);
}).catch(() => root.render(<ThemeProvider theme={theme}><CssBaseline/>
  <Alert severity="error">No se pudo cargar la configuración. Recargá la página para volver a intentarlo.</Alert>
</ThemeProvider>));
