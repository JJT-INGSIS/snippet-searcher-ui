import {Alert, Button, CircularProgress, TextField} from '@mui/material';
import {SaveRounded} from '@mui/icons-material';
import {SnippetDraft, versionsOf} from '../../utils/snippet';
import {ModalWrapper} from '../common/ModalWrapper';
import {useGetFileTypes} from '../../utils/queries';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {CodeEditor} from '../common/CodeEditor';
import {LanguageVersionFields} from '../common/LanguageVersionFields';
import {useSnippetCreation} from '../../hooks/useSnippetCreation';

export function AddSnippetModal({open, onClose, defaultSnippet}: {open: boolean; onClose: () => void; defaultSnippet?: SnippetDraft}) {
  const form = useSnippetCreation(open, defaultSnippet, onClose);
  const {data: types, error, refetch} = useGetFileTypes();
  const versions = versionsOf(types, form.draft.language);
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
    <LanguageVersionFields types={types} language={form.draft.language} version={form.draft.version} disabled={form.locked}
      onLanguageChange={language => form.change({language, version: ''})} onVersionChange={version => form.change({version})}/>
    <CodeEditor id="create-code" value={form.draft.content} readOnly={form.locked} onChange={content => form.change({content})}/>
  </ModalWrapper>;
}
