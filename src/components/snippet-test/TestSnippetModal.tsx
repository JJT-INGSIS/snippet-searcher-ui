import {useEffect, useRef, useState} from 'react';
import {Alert, Box, Button, CircularProgress, Stack, Tab, Tabs, Typography} from '@mui/material';
import {ModalWrapper} from '../common/ModalWrapper';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {useCreateSnippetTest, useSnippetTests} from '../../utils/queries';
import {TestDefinitionDraft} from '../../types/TestDefinition';
import {ApiError} from '../../utils/api/errors';
import {TabPanel} from './TabPanel';
import {SnippetExecution} from '../../screens/SnippetExecution';

export function TestSnippetModal({snippetId, canCreate, onClose}: {
  snippetId: string; canCreate: boolean; onClose: () => void;
}) {
  const tests = useSnippetTests(snippetId);
  const creation = useCreateSnippetTest(snippetId);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  const [selection, setSelection] = useState<string | null>(null);
  const [draft, setDraft] = useState<TestDefinitionDraft>({inputs: [], expectedOutputs: []});
  // Never display cached private tests alongside an authorization/refresh failure.
  const items = tests.isError ? [] : tests.data ?? [];
  const selected = (selection === 'new' && canCreate) || items.some(item => item.id === selection)
    ? selection : items[0]?.id ?? (canCreate ? 'new' : null);
  const error = creation.error instanceof Error ? creation.error : null;
  const uncertain = error instanceof ApiError && error.uncertain;

  async function save() {
    if (!canCreate || submitting.current || !tests.isSuccess || tests.isFetching) return;
    submitting.current = true;
    try {
      await creation.mutateAsync(draft);
      if (mounted.current) onClose();
    } catch { /* Keep the exact draft; the mutation exposes the failure. No automatic retry. */ }
    finally {submitting.current = false;}
  }

  return <ModalWrapper open onClose={onClose} pending={creation.isLoading} title="Tests del snippet"
    description="Inputs y outputs son listas ordenadas. Guardar no ejecuta el test ni exige que pase.">
    {!canCreate && <Alert severity="info">Solo lectura: podés consultar tests. Solo el propietario puede crearlos.</Alert>}
    {tests.isLoading && <Stack direction="row" spacing={1} role="status"><CircularProgress size={20}/><Typography>Cargando tests…</Typography></Stack>}
    <ApiErrorAlert error={tests.error instanceof Error ? tests.error : null}/>
    {tests.isError && <Button disabled={tests.isFetching} onClick={() => {void tests.refetch();}}>Reintentar listado de tests</Button>}
    {tests.isSuccess && <>
      {items.length === 0 && <Alert severity="info">Este snippet todavía no tiene tests.</Alert>}
      <Box sx={{display: 'flex', flexDirection: {xs: 'column', sm: 'row'}, gap: 2, minWidth: 0}}>
        <Tabs orientation="vertical" variant="scrollable" value={selected ?? false} aria-label="Tests guardados"
          onChange={(_, next: string) => setSelection(next)} sx={{minWidth: 130}}>
          {items.map((item, index) => <Tab key={item.id} value={item.id} label={'Test ' + (index + 1)}
            id={'test-tab-' + item.id} aria-controls={'test-panel-' + item.id}/>)}
          {canCreate && <Tab value="new" label="Nuevo test" id="test-tab-new" aria-controls="test-panel-new"/>}
        </Tabs>
        {items.map((item, index) => <TabPanel key={item.id} value={selected ?? ''} id={item.id}
          title={'Test ' + (index + 1)} definition={item}/>)}
        {canCreate && <TabPanel value={selected ?? ''} id="new" title="Nuevo test" definition={draft}
          disabled={creation.isLoading} onChange={setDraft}/>}
      </Box>
    </>}
    <ApiErrorAlert error={error} focusOnError/>
    {uncertain && <Alert severity="warning">No sabemos si el servidor guardó el test. Revisá los tests guardados antes de volver a enviarlo: podría duplicarse.</Alert>}
    {uncertain && <Button disabled={tests.isFetching || creation.isLoading} onClick={() => {void tests.refetch();}}>Revisar tests guardados</Button>}
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {canCreate && selected === 'new' && <Button variant="contained" data-testid="save-test"
        disabled={creation.isLoading || !tests.isSuccess || tests.isFetching} onClick={save}>
        {creation.isLoading ? 'Guardando…' : uncertain ? 'Volver a enviar (puede duplicar)' : 'Guardar test'}
      </Button>}
      <Button disabled>Editar test</Button><Button disabled>Eliminar test</Button>
    </Stack>
    {tests.isSuccess && selected && selected !== 'new' && <SnippetExecution key={snippetId + ':' + selected}
      snippetId={snippetId} testId={selected} disabled={tests.isFetching || creation.isLoading}/>}
    <Typography variant="body2" color="text.secondary">La edición y eliminación de tests no están disponibles en esta entrega.</Typography>
  </ModalWrapper>;
}
