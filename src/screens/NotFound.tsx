import {Box, Button, Stack, Typography} from '@mui/material';
import {ExploreOffRounded} from '@mui/icons-material';
import {Link} from 'react-router-dom';
import {withNavbar} from '../components/navbar/withNavbar';
import {HOME_PATH} from '../utils/auth/returnPaths';

const TEXT_WIDTH = 440;

function NotFound() {
  return <Stack role="status" alignItems="center" spacing={1.5} sx={{py: 7, px: 3, textAlign: 'center'}}>
    <Box sx={{display: 'grid', placeItems: 'center', p: 1.5, borderRadius: '50%', bgcolor: '#edf4fb', color: 'primary.main'}}>
      <ExploreOffRounded fontSize="large"/>
    </Box>
    <Typography variant="h1">No encontramos esa página</Typography>
    <Typography color="text.secondary" sx={{maxWidth: TEXT_WIDTH}}>La dirección no existe o cambió. Volvé a tus snippets para seguir.</Typography>
    <Button variant="contained" component={Link} to={HOME_PATH} replace>Ir a tus snippets</Button>
  </Stack>;
}

export const NotFoundScreen = withNavbar(NotFound);
