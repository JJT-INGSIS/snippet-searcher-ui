import {useRef, useState} from 'react';
import {AddRounded, UploadFileRounded} from '@mui/icons-material';
import {Button, Menu, MenuItem} from '@mui/material';
import {useGetFileTypes} from '../../utils/queries';
import {useSnackbarContext} from '../../contexts/snackbarContext';
import {SnippetDraft} from '../../utils/snippet';
import {readSnippetFile} from '../../utils/upload';
import {AddSnippetModal} from './AddSnippetModal';

export function NewSnippetActions() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SnippetDraft>();
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const {data: types} = useGetFileTypes();
  const {createSnackbar} = useSnackbarContext();
  async function upload(element: HTMLInputElement) {
    const file = element.files?.[0];
    if (!file || busy.current) return;
    busy.current = true; setReading(true);
    try {
      if (!types?.length) throw new Error('No se pudo cargar el catálogo. Abrí Nuevo snippet y reintentá su carga.');
      const snippet = await readSnippetFile(file, types);
      setDraft(snippet); setOpen(true);
    } catch (error) {
      createSnackbar('error', error instanceof Error ? error.message : 'No se pudo leer el archivo. No se creó ningún snippet.');
    } finally {element.value = ''; busy.current = false; setReading(false);}
  }
  return <>
    <Button variant="contained" startIcon={reading ? <UploadFileRounded/> : <AddRounded/>} disabled={reading}
      aria-haspopup="menu" aria-controls={anchor ? 'new-snippet-menu' : undefined} aria-expanded={!!anchor}
      onClick={event => setAnchor(event.currentTarget)}>{reading ? 'Leyendo archivo…' : 'Nuevo snippet'}</Button>
    <Menu id="new-snippet-menu" anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      <MenuItem onClick={() => {setAnchor(null); setDraft(undefined); setOpen(true);}}>Crear snippet</MenuItem>
      <MenuItem onClick={() => {setAnchor(null); input.current?.click();}}>Subir archivo</MenuItem>
    </Menu>
    <input ref={input} hidden type="file" data-testid="upload-file-input" disabled={reading}
      accept={types?.map(type => '.' + type.extension).join(',')} onChange={event => void upload(event.currentTarget)}/>
    <AddSnippetModal open={open} defaultSnippet={draft} onClose={() => setOpen(false)}/>
  </>;
}
