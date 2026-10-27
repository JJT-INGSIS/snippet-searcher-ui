import {useState} from 'react';
import {Box, Button, Drawer, LinearProgress, Paper, Stack, Typography} from '@mui/material';
import {withNavbar} from '../components/navbar/withNavbar';
import {SnippetTable} from '../components/snippet-table/SnippetTable';
import {SnippetFilters} from '../components/snippet-table/SnippetFilters';
import {NewSnippetActions} from '../components/snippet-table/NewSnippetActions';
import {EmptyState} from '../components/common/EmptyState';
import {ApiErrorAlert} from '../components/common/ApiErrorAlert';
import {SnippetDetail} from './SnippetDetail';
import {useSnippetList} from '../hooks/useSnippetList';

function HomeScreen() {
  const list = useSnippetList();
  const [snippetId, setSnippetId] = useState<string | null>(null);
  return <Stack spacing={3}>
    <Stack direction={{xs: 'column', sm: 'row'}} justifyContent="space-between" alignItems={{xs: 'stretch', sm: 'center'}} gap={2}>
      <Box><Typography variant="h1">Tus snippets</Typography><Typography color="text.secondary">Creá, encontrá y compartí tu código.</Typography></Box>
      <NewSnippetActions/>
    </Stack>
    <Paper variant="outlined" sx={{p: {xs: 2, sm: 3}}}>
      <SnippetFilters name={list.name} onName={list.setName} filters={list.filters} onFilters={list.setFilters} onClear={list.clear}/>
    </Paper>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography role="status" aria-live="polite" variant="body2" color="text.secondary">
        {list.loading ? 'Buscando snippets…' : list.error ? 'Listado no disponible' : list.count + (list.count === 1 ? ' snippet' : ' snippets')}
      </Typography>
      {list.refreshing && !list.loading && <Typography variant="body2" color="text.secondary">Actualizando…</Typography>}
    </Stack>
    {list.refreshing && !list.loading && <LinearProgress aria-label="Actualizando listado"/>}
    {list.error ? <Paper variant="outlined" sx={{p: 3}}><Stack spacing={2}>
      <ApiErrorAlert error={list.error}/><Button onClick={() => list.retry()} sx={{alignSelf: 'flex-start'}}>Reintentar listado</Button>
    </Stack></Paper> : !list.loading && list.count === 0 ? <Paper variant="outlined">
      <EmptyState title={list.filtered ? 'No encontramos coincidencias' : 'Todavía no hay snippets'}
        description={list.filtered ? 'Probá con otro nombre o limpiá los filtros para ver todos los snippets disponibles.' : 'Creá tu primer snippet o subí un archivo desde el botón Nuevo snippet.'}
        action={list.filtered ? <Button variant="outlined" onClick={list.clear}>Limpiar filtros</Button> : undefined}/>
    </Paper> : <SnippetTable snippets={list.snippets} loading={list.loading} count={list.count} page={list.page} size={list.size}
      onPage={list.setPage} onSize={list.setSize} onOpen={setSnippetId}/>}
    <Drawer open={!!snippetId} anchor="right" onClose={() => setSnippetId(null)} PaperProps={{sx: {width: {xs: '100%', md: 'min(860px, 85vw)'}, overscrollBehavior: 'contain'}}}>
      {snippetId && <SnippetDetail key={snippetId} handleCloseModal={() => setSnippetId(null)} id={snippetId}/>}
    </Drawer>
  </Stack>;
}
export default withNavbar(HomeScreen);
