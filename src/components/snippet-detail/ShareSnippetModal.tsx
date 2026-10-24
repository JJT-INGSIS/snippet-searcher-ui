import {Autocomplete, Button, CircularProgress, TextField} from '@mui/material';
import {ModalWrapper} from '../common/ModalWrapper';
import {useGetUsers} from '../../utils/queries';
import {useEffect, useRef, useState} from 'react';
import {User} from '../../utils/users';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import useDebounce from '../../hooks/useDebounce';

type Props = {open: boolean; onClose: () => void; onShare: (userId: string) => Promise<void>; loading: boolean};
export function ShareSnippetModal({open, onClose, onShare, loading}: Props) {
  const [name, setName] = useState('');
  const search = useDebounce(name);
  const [selected, setSelected] = useState<User | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const submitting = useRef(false);
  const waiting = name !== search;
  const {data, isLoading, error, refetch} = useGetUsers(search, 0, 5, open && !waiting);
  useEffect(() => {if (!open) {setSelected(null); setFailure(null); setName('');}}, [open]);
  async function share() {
    if (!selected || loading || submitting.current || waiting) return;
    submitting.current = true;
    try {await onShare(selected.id); onClose();}
    catch (cause) {setFailure(cause instanceof Error ? cause : new Error('Share not confirmed'));}
    finally {submitting.current = false;}
  }
  return <ModalWrapper open={open} onClose={onClose} title="Compartir snippet" pending={loading}
    description="Elegí un destinatario. Podrá leer el snippet; no podrá editarlo ni volver a compartirlo."
    actions={<>
      <Button disabled={loading} onClick={onClose}>Cancelar</Button>
      <Button data-testid="confirm-share" variant="contained" disabled={!selected || loading || waiting} onClick={share}
        startIcon={loading ? <CircularProgress size={18} color="inherit"/> : undefined}>{loading ? 'Compartiendo…' : 'Compartir'}</Button>
    </>}>
    <ApiErrorAlert error={failure || (!waiting && error instanceof Error ? error : null)} focusOnError={!!failure}/>
    {!!error && !waiting && <Button onClick={() => refetch()}>Reintentar destinatarios</Button>}
    <Autocomplete options={waiting || error ? [] : data?.users ?? []} value={selected} filterOptions={options => options}
      getOptionLabel={option => option.name} isOptionEqualToValue={(left, right) => left.id === right.id}
      loading={waiting || isLoading} loadingText="Buscando destinatarios…" noOptionsText={error ? 'Destinatarios no disponibles' : 'No hay coincidencias'}
      disabled={loading} inputValue={name}
      onInputChange={(_, value, reason) => {setName(value); if (reason === 'input' || reason === 'clear') setSelected(null);}}
      onChange={(_, value) => setSelected(value)}
      renderInput={params => <TextField {...params} label="Buscar destinatario" autoComplete="off"/>}/>
  </ModalWrapper>;
}
