import React from 'react';
import App from './App';
import './index.css';
import {createRoot} from 'react-dom/client';
import {PaginationProvider} from './contexts/paginationProvider';
import {SnackbarProvider} from './contexts/snackbarProvider';
import {ApiContext} from './contexts/apiContext';
import {configuredApi} from './utils/api/http';
import {loadRuntimeConfig} from './utils/api/config';
import {Alert} from '@mui/material';
const root = createRoot(document.getElementById('root')!);
loadRuntimeConfig().then(config => {
  root.render(<React.StrictMode><ApiContext.Provider value={configuredApi(config)}>
    <PaginationProvider><SnackbarProvider><App/></SnackbarProvider></PaginationProvider>
  </ApiContext.Provider></React.StrictMode>);
}).catch(() => root.render(<Alert severity="error">Could not load valid runtime configuration. The application was not started.</Alert>));
