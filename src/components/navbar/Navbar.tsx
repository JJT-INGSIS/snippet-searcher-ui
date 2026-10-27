import {AppBar, Box, Button, Container, Toolbar, Typography} from '@mui/material';
import {CodeRounded, TuneRounded} from '@mui/icons-material';
import {Link, useLocation} from 'react-router-dom';

export function Navbar() {
  const {pathname} = useLocation();
  return <>
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    <AppBar position="static" color="inherit" elevation={0} sx={{borderBottom: 1, borderColor: 'divider'}}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{gap: 2, flexWrap: 'wrap', py: 1}}>
          <Box component={Link} to="/" sx={{display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none', mr: 'auto'}}>
            <Box sx={{display: 'grid', placeItems: 'center', bgcolor: '#e8f3ff', color: 'primary.main', borderRadius: 2, p: 1}}><CodeRounded/></Box>
            <Typography fontWeight={700} fontSize={{xs: 17, sm: 19}}>Snippet Searcher</Typography>
          </Box>
          <Box component="nav" aria-label="Navegación principal" sx={{display: 'flex', gap: .5}}>
            <Button component={Link} to="/" startIcon={<CodeRounded/>} aria-current={pathname === '/' ? 'page' : undefined}
              sx={{bgcolor: pathname === '/' ? '#e8f3ff' : undefined}}>Snippets</Button>
            <Button component={Link} to="/rules" startIcon={<TuneRounded/>} aria-current={pathname === '/rules' ? 'page' : undefined}
              sx={{bgcolor: pathname === '/rules' ? '#e8f3ff' : undefined}}>Reglas</Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  </>;
}
