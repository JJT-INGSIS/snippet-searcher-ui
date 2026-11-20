import {ReactNode} from 'react';
import {Alert, AlertTitle, Button, CircularProgress, Paper, Stack, Typography} from '@mui/material';
import {LoginRounded} from '@mui/icons-material';
import {useSession} from './SessionContext';
import {sessionFailureMessage} from '../../utils/auth/sessionMessages';
import {HOME_PATH} from '../../utils/auth/returnPaths';

const PANEL_WIDTH = 520;
const LOADER_SIZE = 28;
const PANEL_SPACING = 2;

function CenteredPanel({children}: {children: ReactNode}) {
  return <Stack alignItems="center" sx={{py: {xs: 6, md: 10}}}>
    <Paper variant="outlined" sx={{p: {xs: 3, sm: 4}, width: '100%', maxWidth: PANEL_WIDTH}}>{children}</Paper>
  </Stack>;
}

export function SessionWaiting({message}: {message: string}) {
  return <CenteredPanel>
    <Stack role="status" aria-live="polite" alignItems="center" spacing={PANEL_SPACING} sx={{textAlign: 'center'}}>
      <CircularProgress size={LOADER_SIZE}/>
      <Typography>{message}</Typography>
    </Stack>
  </CenteredPanel>;
}

export function SessionFailure() {
  const session = useSession();
  return <CenteredPanel>
    <Stack spacing={PANEL_SPACING}>
      <Alert severity="error">
        <AlertTitle>No pudimos completar el inicio de sesión</AlertTitle>
        {sessionFailureMessage(session.failure)}
      </Alert>
      <Button variant="contained" startIcon={<LoginRounded/>} onClick={() => session.login(HOME_PATH)}>
        Volver a iniciar sesión
      </Button>
    </Stack>
  </CenteredPanel>;
}
