import {useState} from 'react';
import {Alert, Button, Stack, Typography} from '@mui/material';
import {useLocation} from 'react-router-dom';
import {ModalWrapper} from '../common/ModalWrapper';
import {ReauthOutcome, useSession} from './SessionContext';

const outcomes: Record<Exclude<ReauthOutcome, 'signed-in'>, {severity: 'warning' | 'info' | 'error'; text: string}> = {
  blocked: {severity: 'warning', text: 'Tu navegador bloqueó la ventana de inicio de sesión. Permitila y volvé a intentarlo, o iniciá sesión en esta pestaña: lo que no guardaste se pierde.'},
  cancelled: {severity: 'info', text: 'Cerraste la ventana antes de terminar. Volvé a intentarlo cuando quieras.'},
  failed: {severity: 'error', text: 'No pudimos completar el inicio de sesión. Volvé a intentarlo.'},
};

export function SessionExpiredDialog() {
  const session = useSession();
  const {pathname} = useLocation();
  const [outcome, setOutcome] = useState<Exclude<ReauthOutcome, 'signed-in'> | null>(null);
  const [waiting, setWaiting] = useState(false);
  const signInAgain = async () => {
    setWaiting(true);
    const result = await session.reauthenticate();
    setWaiting(false);
    setOutcome(result === 'signed-in' ? null : result);
  };
  return <ModalWrapper open={session.expired} onClose={session.dismissExpired} pending={waiting} title="Tu sesión venció"
    description="Por seguridad, cada sesión dura un tiempo limitado. Volvé a iniciar sesión para seguir: lo que escribiste en esta pestaña se conserva."
    actions={<>
      <Button onClick={session.dismissExpired} disabled={waiting}>Ahora no</Button>
      <Button variant="contained" onClick={() => void signInAgain()} disabled={waiting} data-testid="reauthenticate">
        {waiting ? 'Esperando la ventana…' : 'Volver a iniciar sesión'}
      </Button>
    </>}>
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Se abre una ventana de Auth0. Si iniciás sesión con otra cuenta, la app se vuelve a cargar vacía para esa cuenta.
      </Typography>
      {outcome && <Alert severity={outcomes[outcome].severity}
        action={outcome === 'blocked' ? <Button color="inherit" size="small" onClick={() => session.login(pathname)}>Iniciar sesión acá</Button> : undefined}>
        {outcomes[outcome].text}
      </Alert>}
    </Stack>
  </ModalWrapper>;
}
