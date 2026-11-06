import {Alert, Box, Button, Stack, Typography} from '@mui/material';
import {useAutomaticTests} from '../../utils/queries';
import {ApiErrorAlert} from '../common/ApiErrorAlert';

export function AutomaticTestsPanel({snippetId}: {snippetId: string}) {
  const query = useAutomaticTests(snippetId);
  // A failed authorization/refresh must hide cached results too.
  const view = query.isError ? undefined : query.data;
  return <Stack spacing={1} role="region" aria-label="Tests automáticos">
    <Typography variant="h3">Tests automáticos</Typography>
    <Typography variant="body2">Se ejecutan al guardar cambios. Las ejecuciones manuales son independientes.</Typography>
    {query.isLoading && <Typography role="status">Consultando resultados…</Typography>}
    <ApiErrorAlert error={query.error instanceof Error ? query.error : null}/>
    <Button size="small" disabled={query.isFetching} onClick={() => query.refetch()}>Actualizar resultados</Button>
    {view?.validity === 'SUPERSEDED' && <Alert severity="info">Los resultados anteriores no corresponden al código, tests o procesador actuales.</Alert>}
    {view?.validity === 'UNVERIFIABLE' && <Alert severity="warning">No se pudo confirmar la versión del procesador. Los resultados no están disponibles.</Alert>}
    {view?.validity === 'CURRENT' && <>
      {!view.revision && <Typography>Todavía no hay una ejecución automática para este snippet.</Typography>}
      {view.progress && <Typography role="status">Estado: {view.progress.status}. Procesados: {view.progress.processed}; pendientes: {view.progress.pending}; errores: {view.progress.failed}.</Typography>}
      {view.progress?.selectionComplete && view.tests.length === 0 && <Typography>No había tests al guardar esta revisión.</Typography>}
      {view.tests.map((test, index) => <Box key={test.testId} sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 1}}>
        <Typography>Test {index + 1}: {test.comparison === 'PASSED' ? 'Aprobado' : test.comparison === 'FAILED' ? 'No coincide' : test.outcome ?? test.state ?? 'Pendiente'}</Typography>
        {test.reason && <Typography variant="body2">{test.reason}</Typography>}
        {test.outputs.length > 0 && <Box component="pre" sx={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{JSON.stringify(test.outputs, null, 2)}</Box>}
      </Box>)}
    </>}
  </Stack>;
}
