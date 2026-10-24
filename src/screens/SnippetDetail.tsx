import {useEffect, useState} from 'react';
import {Alert, Box, Button, Chip, CircularProgress, IconButton, Skeleton, Stack, TextField, Typography} from '@mui/material';
import {CloseRounded, DownloadRounded, SaveRounded, ShareRounded} from '@mui/icons-material';
import {useGetSnippetById, useShareSnippet} from '../utils/queries';
import {ShareSnippetModal} from '../components/snippet-detail/ShareSnippetModal';
import {Snippet} from '../utils/snippet';
import {ApiErrorAlert} from '../components/common/ApiErrorAlert';
import {CodeEditor} from '../components/common/CodeEditor';
import {lintLabels} from '../utils/presentation';
import {useSnippetEditor} from '../hooks/useSnippetEditor';

function DownloadButton({snippet}: {snippet: Snippet}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([snippet.content], {type: 'text/plain'}));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [snippet.content]);
  return <Button component="a" href={url} download={snippet.name + '.' + snippet.extension} startIcon={<DownloadRounded/>}>Descargar original</Button>;
}
export function SnippetDetail({id, handleCloseModal}: {id: string; handleCloseModal: () => void}) {
  const {data: snippet, isLoading, error, refetch} = useGetSnippetById(id);
  const editor = useSnippetEditor(id, snippet);
  const [shareOpen, setShareOpen] = useState(false);
  const share = useShareSnippet();
  const readonly = !snippet?.capabilities.modify;
  return <Box role="region" aria-label="Detalle del snippet" sx={{p: {xs: 2, sm: 4}, minWidth: 0}}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
      <Typography variant="overline" color="text.secondary">Detalle del snippet</Typography>
      <IconButton aria-label="Cerrar detalle" onClick={handleCloseModal}><CloseRounded/></IconButton>
    </Stack>
    {isLoading && <Stack spacing={2} aria-label="Cargando detalle"><Skeleton height={50}/><Skeleton variant="rounded" height={240}/></Stack>}
    <ApiErrorAlert error={error instanceof Error ? error : null}/>
    {!!error && <Button onClick={() => refetch()}>Reintentar detalle</Button>}
    {snippet && <Stack spacing={2.5}>
      <Box><Typography component="h2" variant="h2" sx={{overflowWrap: 'anywhere'}}>{snippet.name}</Typography>
        <Typography color="text.secondary" variant="body2" sx={{overflowWrap: 'anywhere'}}>Propietario: {snippet.author}</Typography></Box>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Chip size="small" variant="outlined" label={snippet.language + ' ' + snippet.version}/>
        <Chip size="small" label={snippet.relation === 'owned' ? 'Propio' : 'Compartido'}/>
        <Chip size="small" label={'Lint: ' + lintLabels[snippet.compliance]}/>
      </Stack>
      {readonly && <Alert severity="info">Solo lectura. El propietario conserva los permisos de edición.</Alert>}
      <TextField id="detail-name" label="Nombre" value={editor.draft.name} disabled={readonly || editor.saving}
        onChange={event => editor.change({name: event.target.value})}/>
      <TextField id="detail-description" label="Descripción" multiline minRows={2} value={editor.draft.description ?? ''}
        disabled={readonly || editor.saving} onChange={event => editor.change({description: event.target.value})}/>
      <CodeEditor id="detail-code" value={editor.draft.content} readOnly={readonly || editor.saving} onChange={content => editor.change({content})}/>
      <ApiErrorAlert error={editor.error} focusOnError/>
      {editor.saved && <Alert severity="success">Cambios guardados.</Alert>}
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Button data-testid="save-changes" variant="contained" startIcon={editor.saving ? <CircularProgress size={18} color="inherit"/> : <SaveRounded/>}
          disabled={readonly || editor.saving || !editor.draft.name.trim()} onClick={editor.save}>{editor.saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        <Button startIcon={<ShareRounded/>} disabled={!snippet.capabilities.share || share.isLoading} onClick={() => setShareOpen(true)}>Compartir</Button>
        <DownloadButton snippet={snippet}/>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1}><Button disabled>Ejecutar tests</Button><Button disabled>Formatear</Button><Button disabled>Eliminar</Button></Stack>
      <Typography variant="body2" color="text.secondary">Tests, formato, ejecución y eliminación todavía no están disponibles.</Typography>
    </Stack>}
    <ShareSnippetModal open={shareOpen} loading={share.isLoading} onClose={() => setShareOpen(false)}
      onShare={async userId => {await share.mutateAsync({snippetId: id, userId});}}/>
  </Box>;
}
