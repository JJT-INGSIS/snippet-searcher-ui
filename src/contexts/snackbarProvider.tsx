import {ReactNode, useRef, useState} from 'react';
import {Alert, AlertColor, Snackbar} from '@mui/material';
import {SnackbarContext} from './snackbarContext';

export const TOAST_DURATION_MS = 6000;
type Message = {id: number; severity: AlertColor; text: string};
export function SnackbarProvider({children}: {children: ReactNode}) {
  const [queue, setQueue] = useState<Message[]>([]);
  const nextId = useRef(0);
  const active = queue[0];
  function close() {setQueue(previous => previous.slice(1));}
  return <SnackbarContext.Provider value={{
    active: queue,
    createSnackbar: (severity, text) => setQueue(previous => [...previous, {severity, text, id: ++nextId.current}]),
  }}>
    {children}
    {active && <Snackbar key={active.id} open autoHideDuration={TOAST_DURATION_MS} anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      onClose={(_, reason) => {if (reason !== 'clickaway') close();}} sx={{maxWidth: 'calc(100% - 32px)'}}>
      <Alert onClose={close} severity={active.severity} variant="filled" sx={{width: '100%'}}>{active.text}</Alert>
    </Snackbar>}
  </SnackbarContext.Provider>;
}
