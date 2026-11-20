import {useState} from 'react';
import {Alert, Box, Button, CircularProgress, Stack, TextField, Typography} from '@mui/material';
import {useExecution} from '../hooks/useExecution';
import {ExecutionTarget, isTerminal} from '../utils/api/executionDtos';

const labels = {
  IDLE: 'Sin iniciar', STARTING: 'Iniciando…', RUNNING: 'Ejecutando…', WAITING_INPUT: 'Esperando input',
  CANCELLING: 'Esperando cancelación', UNKNOWN: 'Resultado desconocido', COMPLETED: 'Completado',
  PROGRAM_ERROR: 'Error del programa', INPUT_EXHAUSTED: 'Se agotaron los inputs del test',
  LIMIT_EXCEEDED: 'Se alcanzó un límite', CANCELLED: 'Cancelación confirmada',
  TECHNICAL_FAILURE: 'Falla técnica', INTERRUPTED: 'Ejecución interrumpida',
};
export function SnippetExecution({snippetId, testId, disabled = false}: ExecutionTarget & {disabled?: boolean}) {
  const execution = useExecution({snippetId, testId}), {view} = execution;
  const [input, setInput] = useState('');
  const active = !['IDLE', 'UNKNOWN'].includes(view.phase) && !isTerminal(view.phase);
  const mayStart = !active && (view.phase !== 'UNKNOWN' || view.startUncertain || view.unavailable);
  return <Stack component="section" aria-label={testId ? 'Ejecución del test' : 'Ejecución interactiva'} spacing={1.5}>
    <Typography variant="h3">{testId ? 'Ejecución del test' : 'Ejecución interactiva'}</Typography>
    <Typography variant="body2">Se ejecuta el código guardado en el servidor. Los cambios sin guardar no se envían.</Typography>
    <Stack direction="row" flexWrap="wrap" gap={1}>
      <Button variant="contained" disabled={disabled || execution.blocked || !mayStart} onClick={() => {setInput(''); void execution.start();}}>
        {view.startUncertain ? 'Volver a iniciar (inicio anterior incierto)' : view.unavailable ? 'Iniciar otra ejecución (resultado anterior desconocido)' : testId ? 'Ejecutar test' : 'Ejecutar snippet'}
      </Button>
      <Button disabled={!view.descriptor || isTerminal(view.phase) || view.phase === 'CANCELLING'} onClick={() => {void execution.cancel();}}>Detener</Button>
      {view.phase === 'UNKNOWN' && view.descriptor && <Button disabled={view.connecting} onClick={() => {void execution.reconnect();}}>Reconectar ejecución</Button>}
    </Stack>
    {execution.blocked && <Alert severity="info">Hay otra ejecución en curso o sin confirmar. Volvé a su panel para detenerla o reconectarla.</Alert>}
    <Stack direction="row" spacing={1} alignItems="center" role="status">
      {(active || view.connecting) && <CircularProgress size={18}/>}
      <Typography>{labels[view.phase]}</Typography>
    </Stack>
    {view.message && <Alert severity={view.phase === 'UNKNOWN' ? 'warning' : 'info'}>{view.message}</Alert>}
    {view.descriptor && <Typography variant="caption" sx={{overflowWrap: 'anywhere'}}>
      Ejecución {view.descriptor.executionId}. Resultado de la versión guardada al iniciar; vigencia actual sin verificar.
    </Typography>}
    <Box component="ol" aria-label="Output de ejecución" sx={{m: 0, p: 2, pl: 5, minHeight: 100, maxHeight: 300,
      overflow: 'auto', bgcolor: 'grey.900', color: 'common.white', fontFamily: 'monospace'}}>
      {view.outputs.map((text, index) => <li key={index} style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '1.4em'}}>{text}</li>)}
    </Box>
    {view.prompt && <Box component="form" onSubmit={event => {event.preventDefault(); void execution.input(input);}}>
      <Stack spacing={1}>
        <Typography sx={{whiteSpace: 'pre-wrap'}}>{view.prompt.prompt}</Typography>
        <TextField label="Input solicitado" value={input} disabled={view.sending || view.phase !== 'WAITING_INPUT'}
          onChange={event => setInput(event.target.value)} helperText="El valor vacío también es válido."/>
        <Button type="submit" disabled={view.sending || view.phase !== 'WAITING_INPUT'}>Enviar input</Button>
      </Stack>
    </Box>}
    {view.terminal && <Alert severity={view.terminal.comparison === 'PASSED' ? 'success' : view.terminal.comparison === 'FAILED' ? 'warning' : 'info'}>
      {view.terminal.comparison === 'PASSED' ? 'Test aprobado: los outputs coinciden exactamente.' :
        view.terminal.comparison === 'FAILED' ? 'Test con diferencias respecto de los outputs esperados.' : labels[view.terminal.outcome]}
      {' Motivo: ' + view.terminal.reason + '.'}
      {view.terminal.unusedInputs !== undefined && ' Inputs sin consumir: ' + view.terminal.unusedInputs + '.'}
    </Alert>}
    {view.terminal?.diagnostics?.map((diagnostic, index) => <Typography key={index} variant="body2" sx={{whiteSpace: 'pre-wrap'}}>
      {diagnostic.rule + ' — ' + diagnostic.message + ' (' + diagnostic.line + ':' + diagnostic.column + ')'}
    </Typography>)}
  </Stack>;
}
