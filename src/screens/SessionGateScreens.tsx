import {ReactNode} from 'react';
import {Box, Button, Grid, Paper, Stack, Typography} from '@mui/material';
import {CodeRounded, LoginRounded, PersonAddRounded, PlayArrowRounded, TuneRounded, VerifiedUserRounded} from '@mui/icons-material';
import {withNavbar} from '../components/navbar/withNavbar';
import {useSession} from '../components/session/SessionContext';
import {SessionFailure, SessionWaiting} from '../components/session/SessionScreens';

const HERO_SPACING = 3;
const FEATURE_SPACING = 2;
const ICON_PADDING = 1;
const FEATURE_PADDING = 2.5;
const HERO_TITLE_SIZE = {xs: '2rem', md: '2.6rem'};
const HERO_TEXT_SIZE = '1.1rem';
const HERO_TEXT_WIDTH = 520;

type Feature = {icon: ReactNode; title: string; text: string};

const features: Feature[] = [
  {icon: <CodeRounded/>, title: 'Tus snippets en un solo lugar', text: 'Creá, buscá y compartí código PrintScript con tu equipo.'},
  {icon: <TuneRounded/>, title: 'Formato y lint a tu medida', text: 'Configurá tus reglas y mirá el cumplimiento de cada snippet.'},
  {icon: <PlayArrowRounded/>, title: 'Ejecutá y probá', text: 'Corré tus programas con inputs y definí tests que se ejecutan solos.'},
];

function FeatureCard({icon, title, text}: Feature) {
  return <Paper variant="outlined" component="li" sx={{p: FEATURE_PADDING, display: 'flex', gap: 2, listStyle: 'none'}}>
    <Box sx={{display: 'grid', placeItems: 'center', bgcolor: '#e8f3ff', color: 'primary.main', borderRadius: 2, p: ICON_PADDING, height: 'fit-content'}}>
      {icon}
    </Box>
    <Box>
      <Typography component="h2" variant="h3">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{text}</Typography>
    </Box>
  </Paper>;
}

function Welcome({returnTo}: {returnTo: string}) {
  const session = useSession();
  return <Grid container spacing={{xs: 4, md: 8}} alignItems="center" sx={{minHeight: {md: '60vh'}}}>
    <Grid item xs={12} md={6}>
      <Stack spacing={HERO_SPACING}>
        <Typography variant="h1" sx={{fontSize: HERO_TITLE_SIZE}}>Tu código, ordenado y listo para compartir</Typography>
        <Typography color="text.secondary" fontSize={HERO_TEXT_SIZE} sx={{maxWidth: HERO_TEXT_WIDTH}}>
          Iniciá sesión para ver tus snippets, los que compartieron con vos y tus reglas de formato y lint.
        </Typography>
        <Stack direction={{xs: 'column', sm: 'row'}} gap={1.5}>
          <Button variant="contained" size="large" startIcon={<LoginRounded/>} onClick={() => session.login(returnTo)} data-testid="login">
            Iniciar sesión
          </Button>
          <Button variant="outlined" size="large" startIcon={<PersonAddRounded/>} onClick={session.signup}>Crear cuenta</Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{color: 'text.secondary'}}>
          <VerifiedUserRounded fontSize="small"/>
          <Typography variant="body2">Inicio de sesión seguro con Auth0. Snippet Searcher no guarda tu contraseña.</Typography>
        </Stack>
      </Stack>
    </Grid>
    <Grid item xs={12} md={6}>
      <Stack component="ul" spacing={FEATURE_SPACING} sx={{p: 0, m: 0}} aria-label="Qué podés hacer">
        {features.map(feature => <FeatureCard key={feature.title} {...feature}/>)}
      </Stack>
    </Grid>
  </Grid>;
}

export const WelcomeScreen = withNavbar(Welcome);
export const SessionWaitingScreen = withNavbar(SessionWaiting);
export const SessionFailureScreen = withNavbar(SessionFailure);
