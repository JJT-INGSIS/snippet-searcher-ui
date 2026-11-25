import {useState} from 'react';
import {AddRounded, UploadFileRounded} from '@mui/icons-material';
import {Button, Menu, MenuItem} from '@mui/material';
import {SnippetDraft} from '../../utils/snippet';
import {FileReadErrorMessages, useSnippetFileReader} from '../../hooks/useSnippetFileReader';
import {AddSnippetModal} from './AddSnippetModal';

const CREATION_FILE_MESSAGES: FileReadErrorMessages = {
  catalogUnavailable: 'No se pudo cargar el catálogo. Abrí Nuevo snippet y reintentá su carga.',
  unreadable: 'No se pudo leer el archivo. No se creó ningún snippet.',
};

export function NewSnippetActions() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SnippetDraft>();
  const creationFileReader = useSnippetFileReader(file => {setDraft(file); setOpen(true);}, CREATION_FILE_MESSAGES);
  return <>
    <Button variant="contained" startIcon={creationFileReader.isReading ? <UploadFileRounded/> : <AddRounded/>} disabled={creationFileReader.isReading}
      aria-haspopup="menu" aria-controls={anchor ? 'new-snippet-menu' : undefined} aria-expanded={!!anchor}
      onClick={event => setAnchor(event.currentTarget)}>{creationFileReader.isReading ? 'Leyendo archivo…' : 'Nuevo snippet'}</Button>
    <Menu id="new-snippet-menu" anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      <MenuItem onClick={() => {setAnchor(null); setDraft(undefined); setOpen(true);}}>Crear snippet</MenuItem>
      <MenuItem onClick={() => {setAnchor(null); creationFileReader.openFileChooser();}}>Subir archivo</MenuItem>
    </Menu>
    <input {...creationFileReader.hiddenFileInputProps} data-testid="upload-file-input"/>
    <AddSnippetModal open={open} defaultSnippet={draft} onClose={() => setOpen(false)}/>
  </>;
}
