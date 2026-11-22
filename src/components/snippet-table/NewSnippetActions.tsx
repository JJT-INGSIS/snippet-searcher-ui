import {useState} from 'react';
import {AddRounded, UploadFileRounded} from '@mui/icons-material';
import {Button, Menu, MenuItem} from '@mui/material';
import {SnippetDraft} from '../../utils/snippet';
import {FileReadMessages, useSnippetFileReader} from '../../hooks/useSnippetFileReader';
import {AddSnippetModal} from './AddSnippetModal';

const CREATION_FILE_MESSAGES: FileReadMessages = {
  catalogUnavailable: 'No se pudo cargar el catálogo. Abrí Nuevo snippet y reintentá su carga.',
  unreadable: 'No se pudo leer el archivo. No se creó ningún snippet.',
};

export function NewSnippetActions() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SnippetDraft>();
  const upload = useSnippetFileReader(file => {setDraft(file); setOpen(true);}, CREATION_FILE_MESSAGES);
  return <>
    <Button variant="contained" startIcon={upload.reading ? <UploadFileRounded/> : <AddRounded/>} disabled={upload.reading}
      aria-haspopup="menu" aria-controls={anchor ? 'new-snippet-menu' : undefined} aria-expanded={!!anchor}
      onClick={event => setAnchor(event.currentTarget)}>{upload.reading ? 'Leyendo archivo…' : 'Nuevo snippet'}</Button>
    <Menu id="new-snippet-menu" anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      <MenuItem onClick={() => {setAnchor(null); setDraft(undefined); setOpen(true);}}>Crear snippet</MenuItem>
      <MenuItem onClick={() => {setAnchor(null); upload.choose();}}>Subir archivo</MenuItem>
    </Menu>
    <input {...upload.input} data-testid="upload-file-input"/>
    <AddSnippetModal open={open} defaultSnippet={draft} onClose={() => setOpen(false)}/>
  </>;
}
