import {Alert, AlertTitle, Button, Container, Stack} from '@mui/material';
import {HOME_PATH} from '../utils/auth/returnPaths';

const PANEL_WIDTH = 'sm';

export function AppErrorScreen() {
  return <Container maxWidth={PANEL_WIDTH} sx={{py: 8}}>
    <Stack spacing={2}>
      <Alert severity="error">
        <AlertTitle>Algo salió mal</AlertTitle>
        La pantalla no se pudo mostrar. Volvé a cargar la app para seguir.
      </Alert>
      <Button variant="contained" onClick={() => window.location.assign(HOME_PATH)}>Volver a cargar</Button>
    </Stack>
  </Container>;
}
