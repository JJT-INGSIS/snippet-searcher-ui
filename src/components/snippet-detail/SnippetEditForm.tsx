import {Alert, Button, CircularProgress, Stack, TextField} from '@mui/material';
import {SaveRounded, UploadFileRounded} from '@mui/icons-material';
import {SnippetEditor} from '../../hooks/useSnippetEditor';
import {FileReadMessages, useSnippetFileReader} from '../../hooks/useSnippetFileReader';
import {useGetFileTypes} from '../../utils/queries';
import {useSnackbarContext} from '../../contexts/snackbarContext';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {CodeEditor} from '../common/CodeEditor';
import {LanguageVersionFields} from '../common/LanguageVersionFields';

const REPLACEMENT_FILE_MESSAGES: FileReadMessages = {
  catalogUnavailable: 'No se pudo cargar el catálogo. El snippet no cambió.',
  unreadable: 'No se pudo leer el archivo. El snippet no cambió.',
};

export function SnippetEditForm({editor, readonly}: {editor: SnippetEditor; readonly: boolean}) {
  const {data: types} = useGetFileTypes();
  const {createSnackbar} = useSnackbarContext();
  const replacement = useSnippetFileReader(file => {
    editor.loadFile(file);
    createSnackbar('info', 'Revisá el código cargado y guardá para reemplazar el snippet.');
  }, REPLACEMENT_FILE_MESSAGES);
  const locked = readonly || editor.saving;
  return <Stack spacing={2.5}>
    <TextField id="detail-name" label="Nombre" value={editor.draft.name} disabled={locked}
      onChange={event => editor.change({name: event.target.value})}/>
    <TextField id="detail-description" label="Descripción" multiline minRows={2} value={editor.draft.description ?? ''}
      disabled={locked} onChange={event => editor.change({description: event.target.value})}/>
    <LanguageVersionFields idPrefix="detail-" types={types} language={editor.draft.language} version={editor.draft.version}
      disabled={locked} onLanguageChange={editor.chooseLanguage} onVersionChange={version => editor.change({version})}/>
    <CodeEditor id="detail-code" value={editor.draft.content} readOnly={locked} onChange={content => editor.change({content})}/>
    <ApiErrorAlert error={editor.error} focusOnError/>
    {editor.saved && <Alert severity="success">Cambios guardados.</Alert>}
    <Stack direction="row" flexWrap="wrap" gap={1}>
      <Button data-testid="save-changes" variant="contained" startIcon={editor.saving ? <CircularProgress size={18} color="inherit"/> : <SaveRounded/>}
        disabled={locked || !editor.savable} onClick={editor.save}>{editor.saving ? 'Guardando…' : 'Guardar cambios'}</Button>
      {!readonly && <Button startIcon={<UploadFileRounded/>} disabled={locked || replacement.reading} onClick={replacement.choose}>
        {replacement.reading ? 'Leyendo archivo…' : 'Reemplazar desde archivo'}
      </Button>}
    </Stack>
    {!readonly && <input {...replacement.input} data-testid="replace-file-input"/>}
  </Stack>;
}
