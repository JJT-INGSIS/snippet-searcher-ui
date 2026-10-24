import {Autocomplete, Box, Button, Divider, TextField, Typography} from '@mui/material';
import {ModalWrapper} from '../common/ModalWrapper';
import {useGetUsers} from '../../utils/queries';
import {useEffect, useState} from 'react';
import {User} from '../../utils/users';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
type Props = {open: boolean; onClose: () => void; onShare: (userId: string) => Promise<void>; loading: boolean};
export const ShareSnippetModal = ({open, onClose, onShare, loading}: Props) => {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const {data, isLoading, error} = useGetUsers(search, 0, 5, open);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(name), 400);
    return () => clearTimeout(timer);
  }, [name]);
  useEffect(() => {if (!open) {setSelected(null); setFailure(null); setName('');}}, [open]);
  async function share() {
    if (!selected || loading) return;
    try {await onShare(selected.id); onClose();}
    catch (cause) {setFailure(cause instanceof Error ? cause : new Error('Share was not confirmed.'));}
  }
  return <ModalWrapper open={open} onClose={() => {if (!loading) onClose();}}>
    <Typography variant="h5">Share your snippet</Typography><Divider/>
    <ApiErrorAlert error={failure || (error instanceof Error ? error : null)}/>
    <Autocomplete options={data?.users ?? []} value={selected} filterOptions={options => options}
      getOptionLabel={option => option.name} isOptionEqualToValue={(a, b) => a.id === b.id}
      loading={isLoading} disabled={loading} inputValue={name}
      onInputChange={(_, value) => {setName(value); setSelected(null);}}
      onChange={(_, value) => setSelected(value)}
      renderInput={params => <TextField {...params} label="Type the user's name"/>}/>
    <Box display="flex" justifyContent="flex-end" gap={2}>
      <Button disabled={loading} onClick={onClose}>Cancel</Button>
      <Button data-testid="confirm-share" disabled={!selected || loading} onClick={share}>Share</Button>
    </Box>
  </ModalWrapper>;
};
