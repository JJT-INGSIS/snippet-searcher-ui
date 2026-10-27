import React from 'react';
import App from './App';
import './index.css';
import {createRoot} from 'react-dom/client';
import {SnackbarProvider} from './contexts/snackbarProvider';
import {ApiContext} from './contexts/apiContext';
import {configuredApi} from './utils/api/http';
import {loadRuntimeConfig} from './utils/api/config';
import {Alert, CssBaseline, ThemeProvider} from '@mui/material';
import {theme} from './theme';
const root = createRoot(document.getElementById('root')!);
loadRuntimeConfig().then(config => {
  root.render(<React.StrictMode><ThemeProvider theme={theme}><CssBaseline/>
    <ApiContext.Provider value={configuredApi(config)}><SnackbarProvider><App/></SnackbarProvider></ApiContext.Provider>
  </ThemeProvider></React.StrictMode>);
}).catch(() => root.render(<ThemeProvider theme={theme}><CssBaseline/>
  <Alert severity="error">No se pudo cargar la configuración. Recargá la página para volver a intentarlo.</Alert>
</ThemeProvider>));
