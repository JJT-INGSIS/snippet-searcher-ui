import {Autocomplete, Button, CircularProgress, TextField} from '@mui/material';
import {ModalWrapper} from '../common/ModalWrapper';
import {useGetUsers} from '../../utils/queries';
import {useEffect, useRef, useState} from 'react';
import {User} from '../../utils/users';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {BUTTON_PROGRESS_SIZE} from '../common/buttonProgress';
import useDebounce from '../../hooks/useDebounce';

const RECIPIENT_SEARCH_FIRST_PAGE = 0;
const RECIPIENTS_PER_PAGE = 5;

type Props = {open: boolean; onClose: () => void; onShare: (userId: string) => Promise<void>; loading: boolean};
export function ShareSnippetModal({open, onClose, onShare, loading}: Props) {
  const [recipientNameInput, setRecipientNameInput] = useState('');
  const debouncedRecipientName = useDebounce(recipientNameInput);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [shareFailure, setShareFailure] = useState<Error | null>(null);
  const shareInProgress = useRef(false);
  const isTypingRecipientName = recipientNameInput !== debouncedRecipientName;
  const recipientSearch = useGetUsers(debouncedRecipientName, RECIPIENT_SEARCH_FIRST_PAGE, RECIPIENTS_PER_PAGE, open && !isTypingRecipientName);
  const recipientSearchError = !isTypingRecipientName && recipientSearch.error instanceof Error ? recipientSearch.error : null;
  useEffect(() => {if (!open) {setSelectedRecipient(null); setShareFailure(null); setRecipientNameInput('');}}, [open]);
  async function shareWithSelectedRecipient() {
    if (!selectedRecipient || loading || shareInProgress.current || isTypingRecipientName) return;
    shareInProgress.current = true;
    try {await onShare(selectedRecipient.id); onClose();}
    catch (cause) {setShareFailure(cause instanceof Error ? cause : new Error('Share not confirmed'));}
    finally {shareInProgress.current = false;}
  }
  return <ModalWrapper open={open} onClose={onClose} title="Compartir snippet" pending={loading}
    description="Elegí un destinatario. Podrá leer el snippet; no podrá editarlo ni volver a compartirlo."
    actions={<>
      <Button disabled={loading} onClick={onClose}>Cancelar</Button>
      <Button data-testid="confirm-share" variant="contained" disabled={!selectedRecipient || loading || isTypingRecipientName} onClick={shareWithSelectedRecipient}
        startIcon={loading ? <CircularProgress size={BUTTON_PROGRESS_SIZE} color="inherit"/> : undefined}>{loading ? 'Compartiendo…' : 'Compartir'}</Button>
    </>}>
    <ApiErrorAlert error={shareFailure || recipientSearchError} focusOnError={!!shareFailure}/>
    {!!recipientSearchError && <Button onClick={() => recipientSearch.refetch()}>Reintentar destinatarios</Button>}
    <Autocomplete options={isTypingRecipientName || recipientSearch.error ? [] : recipientSearch.data?.users ?? []} value={selectedRecipient}
      filterOptions={options => options} getOptionLabel={option => option.name} isOptionEqualToValue={(left, right) => left.id === right.id}
      loading={isTypingRecipientName || recipientSearch.isLoading} loadingText="Buscando destinatarios…"
      noOptionsText={recipientSearch.error ? 'Destinatarios no disponibles' : 'No hay coincidencias'}
      disabled={loading} inputValue={recipientNameInput}
      onInputChange={(_, value, reason) => {setRecipientNameInput(value); if (reason === 'input' || reason === 'clear') setSelectedRecipient(null);}}
      onChange={(_, value) => setSelectedRecipient(value)}
      renderInput={params => <TextField {...params} label="Buscar destinatario" helperText="Escribí el comienzo del nombre para buscar." autoComplete="off"/>}/>
  </ModalWrapper>;
}
