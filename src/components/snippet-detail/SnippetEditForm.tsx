import {Alert, Button, CircularProgress, Stack, TextField} from '@mui/material';
import {SaveRounded, UploadFileRounded} from '@mui/icons-material';
import {SnippetEditor} from '../../hooks/useSnippetEditor';
import {FileReadErrorMessages, useSnippetFileReader} from '../../hooks/useSnippetFileReader';
import {useGetFileTypes} from '../../utils/queries';
import {useSnackbarContext} from '../../contexts/snackbarContext';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {CodeEditor} from '../common/CodeEditor';
import {LanguageVersionFields} from '../common/LanguageVersionFields';

const REPLACEMENT_FILE_MESSAGES: FileReadErrorMessages = {
  catalogUnavailable: 'No se pudo cargar el catálogo. El snippet no cambió.',
  unreadable: 'No se pudo leer el archivo. El snippet no cambió.',
};

export function SnippetEditForm({editor, readonly}: {editor: SnippetEditor; readonly: boolean}) {
  const {data: types} = useGetFileTypes();
  const {createSnackbar} = useSnackbarContext();
  const replacementFileReader = useSnippetFileReader(file => {
    editor.loadCodeFromFile(file);
    createSnackbar('info', 'Revisá el código cargado y guardá para reemplazar el snippet.');
  }, REPLACEMENT_FILE_MESSAGES);
  const fieldsLocked = readonly || editor.saving;
  return <Stack spacing={2.5}>
    <TextField id="detail-name" label="Nombre" value={editor.draft.name} disabled={fieldsLocked}
      onChange={event => editor.changeFields({name: event.target.value})}/>
    <TextField id="detail-description" label="Descripción" multiline minRows={2} value={editor.draft.description ?? ''}
      disabled={fieldsLocked} onChange={event => editor.changeFields({description: event.target.value})}/>
    <LanguageVersionFields idPrefix="detail-" types={types} language={editor.draft.language} version={editor.draft.version}
      disabled={fieldsLocked} onLanguageChange={editor.changeLanguage} onVersionChange={version => editor.changeFields({version})}/>
    <CodeEditor id="detail-code" value={editor.draft.content} readOnly={fieldsLocked} onChange={content => editor.changeFields({content})}/>
    <ApiErrorAlert error={editor.error} focusOnError/>
    {editor.savedSuccessfully && <Alert severity="success">Cambios guardados.</Alert>}
    <Stack direction="row" flexWrap="wrap" gap={1}>
      <Button data-testid="save-changes" variant="contained" startIcon={editor.saving ? <CircularProgress size={18} color="inherit"/> : <SaveRounded/>}
        disabled={fieldsLocked || !editor.canSave} onClick={editor.save}>{editor.saving ? 'Guardando…' : 'Guardar cambios'}</Button>
      {!readonly && <Button startIcon={<UploadFileRounded/>} disabled={fieldsLocked || replacementFileReader.isReading} onClick={replacementFileReader.openFileChooser}>
        {replacementFileReader.isReading ? 'Leyendo archivo…' : 'Reemplazar desde archivo'}
      </Button>}
    </Stack>
    {!readonly && <input {...replacementFileReader.hiddenFileInputProps} data-testid="replace-file-input"/>}
  </Stack>;
}
