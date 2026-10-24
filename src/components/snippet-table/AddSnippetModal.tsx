import {Alert, Button, CircularProgress, MenuItem, Stack, TextField} from '@mui/material';
import {SaveRounded} from '@mui/icons-material';
import {SnippetDraft} from '../../utils/snippet';
import {ModalWrapper} from '../common/ModalWrapper';
import {useGetFileTypes} from '../../utils/queries';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {CodeEditor} from '../common/CodeEditor';
import {useSnippetCreation} from '../../hooks/useSnippetCreation';

export function AddSnippetModal({open, onClose, defaultSnippet}: {open: boolean; onClose: () => void; defaultSnippet?: SnippetDraft}) {
  const form = useSnippetCreation(open, defaultSnippet, onClose);
  const {data: types, error, refetch} = useGetFileTypes();
  const versions = types?.find(type => type.language === form.draft.language)?.versions ?? [];
  return <ModalWrapper open={open} onClose={onClose} title="Nuevo snippet" pending={form.saving}
    description="Escribí tu código o revisá el archivo subido. Elegí el lenguaje y su versión antes de guardar."
    actions={<>
      <Button disabled={form.saving} onClick={onClose}>Cerrar</Button>
      <Button data-testid="save-snippet" variant="contained" startIcon={form.saving ? <CircularProgress size={18} color="inherit"/> : <SaveRounded/>}
        onClick={form.save} disabled={form.saving || (!form.uncertain && (!form.draft.name.trim() || !versions.includes(form.draft.version)))}>
        {form.saving ? 'Guardando…' : form.uncertain ? 'Reintentar misma creación' : 'Guardar snippet'}
      </Button>
    </>}>
    <ApiErrorAlert error={form.error} creation focusOnError/>
    {!!error && <Alert severity="warning" action={<Button onClick={() => refetch()}>Reintentar</Button>}>No se pudo cargar el catálogo de lenguajes. No se elegirá una versión por defecto.</Alert>}
    {form.uncertain && <Alert severity="warning">Conservamos los datos de esta creación mientras esta página siga abierta. Reintentá la misma solicitud. Recargar la página pierde esta información.</Alert>}
    <TextField id="name" label="Nombre" name="snippetName" value={form.draft.name} disabled={form.locked}
      autoComplete="off" required onChange={event => form.change({name: event.target.value})}/>
    <TextField id="description" label="Descripción (opcional)" name="description" multiline minRows={2} value={form.draft.description ?? ''}
      disabled={form.locked} onChange={event => form.change({description: event.target.value})}/>
    <Stack direction={{xs: 'column', sm: 'row'}} gap={2} sx={{'& > *': {flex: 1, minWidth: 0}}}>
      <TextField select id="language" label="Lenguaje" SelectProps={{labelId: 'language-label'}} value={form.draft.language} disabled={form.locked || !types?.length}
        onChange={event => form.change({language: event.target.value, version: ''})}>
        {types?.map(type => <MenuItem key={type.language} value={type.language}>{type.language}</MenuItem>)}
      </TextField>
      <TextField select id="version" label="Versión" SelectProps={{labelId: 'version-label'}} value={form.draft.version} disabled={form.locked || !versions.length}
        onChange={event => form.change({version: event.target.value})}>
        {versions.map(version => <MenuItem key={version} value={version}>{version}</MenuItem>)}
      </TextField>
    </Stack>
    <CodeEditor id="create-code" value={form.draft.content} readOnly={form.locked} onChange={content => form.change({content})}/>
  </ModalWrapper>;
}
