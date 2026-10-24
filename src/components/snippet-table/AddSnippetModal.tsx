import {Alert, Box, Button, CircularProgress, Input, InputLabel, MenuItem, Select, Typography} from '@mui/material';
import {highlight, languages} from 'prismjs';
import {useEffect, useRef, useState} from 'react';
import Editor from 'react-simple-code-editor';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-okaidia.css';
import {Save} from '@mui/icons-material';
import {SnippetDraft} from '../../utils/snippet';
import {ModalWrapper} from '../common/ModalWrapper';
import {useCreateSnippet, useGetFileTypes} from '../../utils/queries';
import {CreationIntent, createCreationIntent} from '../../utils/api/creationIntent';
import {ApiError} from '../../utils/api/errors';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {useApi} from '../../contexts/apiContext';
export const AddSnippetModal = ({open, onClose, defaultSnippet}: {
  open: boolean; onClose: () => void; defaultSnippet?: SnippetDraft;
}) => {
  const [language, setLanguage] = useState('');
  const [version, setVersion] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const intent = useRef<CreationIntent>();
  const submitting = useRef(false);
  const {actor} = useApi();
  const {mutateAsync, isLoading} = useCreateSnippet();
  const {data: types, error: catalogError, refetch} = useGetFileTypes();
  const uncertain = error instanceof ApiError && error.uncertain;
  const locked = isLoading || uncertain;
  useEffect(() => {
    if (open && !intent.current) {
      setName(defaultSnippet?.name ?? ''); setCode(defaultSnippet?.content ?? '');
      setLanguage(defaultSnippet?.language ?? ''); setVersion(''); setDescription(null); setError(null);
    }
  }, [open, defaultSnippet]);
  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    if (!intent.current) intent.current = createCreationIntent({name, description, language, version, content: code}, actor);
    try {
      await mutateAsync(intent.current);
      intent.current = undefined;
      setError(null);
      onClose();
    } catch (cause) {
      const failure = cause instanceof ApiError ? cause : new ApiError('Could not confirm the save.', undefined, true);
      setError(failure);
      if (failure instanceof ApiError && !failure.uncertain) intent.current = undefined;
    } finally {submitting.current = false;}
  }
  const versions = types?.find(type => type.language === language)?.versions ?? [];
  return <ModalWrapper open={open} onClose={() => {if (!isLoading) onClose();}}>
    <Box display="flex" justifyContent="space-between">
      <Typography variant="h5">Add Snippet</Typography>
      <Button data-testid="save-snippet" variant="contained" onClick={save}
        disabled={isLoading || (!uncertain && (!name.trim() || !language || !versions.includes(version)))}>
        {isLoading ? <CircularProgress size={24}/> : <Save/>}{uncertain ? 'Retry same creation' : 'Save Snippet'}
      </Button>
    </Box>
    <ApiErrorAlert error={error}/>
    {!!catalogError && <><Alert severity="warning">Language catalog unavailable. GET /languages is required; there is no default language/version.</Alert>
      <Button onClick={() => refetch()}>Retry catalog</Button></>}
    {uncertain && <Alert severity="warning">This creation is kept while this page remains open. Its identity, key and data will be reused. Reloading loses that retry information.</Alert>}
    <InputLabel htmlFor="name">Name</InputLabel>
    <Input id="name" value={name} disabled={locked} onChange={e => setName(e.target.value)}/>
    <InputLabel htmlFor="description">Description (optional)</InputLabel>
    <Input id="description" value={description ?? ''} disabled={locked} onChange={e => setDescription(e.target.value)}/>
    <InputLabel id="language-label">Language</InputLabel>
    <Select labelId="language-label" value={language} disabled={locked} onChange={e => {setLanguage(e.target.value); setVersion('');}}>
      {types?.map(type => <MenuItem key={type.language} value={type.language}>{type.language}</MenuItem>)}
    </Select>
    <InputLabel id="version-label">Version</InputLabel>
    <Select labelId="version-label" value={version} disabled={locked} onChange={e => setVersion(e.target.value)}>
      {versions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
    </Select>
    <InputLabel htmlFor="create-code">Code Snippet</InputLabel>
    <Box bgcolor="black" color="white" borderRadius="8px">
      <Editor textareaId="create-code" value={code} padding={10} readOnly={locked} onValueChange={setCode}
        highlight={value => highlight(value, languages.js, 'javascript')}
        style={{minHeight: 200, maxHeight: 400, overflow: 'auto', fontFamily: 'monospace', fontSize: 17}}/>
    </Box>
  </ModalWrapper>;
};
