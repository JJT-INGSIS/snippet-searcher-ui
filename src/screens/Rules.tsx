import {Alert, Stack, Typography} from '@mui/material';
import {withNavbar} from '../components/navbar/withNavbar';
const RulesScreen = () => <Stack spacing={2}>
  <Typography variant="h1">Reglas de código</Typography>
  <Typography color="text.secondary">Configuración de formato y lint.</Typography>
  <Alert severity="info">Esta funcionalidad todavía no está disponible. Podés seguir creando y consultando tus snippets.</Alert>
</Stack>;
export default withNavbar(RulesScreen);
