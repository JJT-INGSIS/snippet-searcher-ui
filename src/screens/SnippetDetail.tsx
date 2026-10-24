import {useEffect, useRef, useState} from 'react';
import Editor from 'react-simple-code-editor';
import {highlight, languages} from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-okaidia.css';
import {Alert, Box, Button, CircularProgress, IconButton, Input, InputLabel, Typography} from '@mui/material';
import {Close, Download, Save, Share} from '@mui/icons-material';
import {useGetSnippetById, useShareSnippet, useUpdateSnippetById} from '../utils/queries';
import {Bòx} from '../components/snippet-table/SnippetBox';
import {ShareSnippetModal} from '../components/snippet-detail/ShareSnippetModal';
import {Snippet} from '../utils/snippet';
import {ApiErrorAlert} from '../components/common/ApiErrorAlert';
const DownloadButton = ({snippet}: {snippet: Snippet}) => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([snippet.content], {type: 'text/plain'}));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [snippet.content]);
  return <Button component="a" href={url} download={snippet.name + '.' + snippet.extension} startIcon={<Download/>}>Download original</Button>;
};
export const SnippetDetail = ({id, handleCloseModal}: {id: string; handleCloseModal: () => void}) => {
  const {data: snippet, isLoading, error, refetch} = useGetSnippetById(id);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const hydrated = useRef(false);
  const update = useUpdateSnippetById();
  const share = useShareSnippet();
  useEffect(() => {
    // Background refreshes must not erase an unsaved draft.
    if (snippet && !hydrated.current) {
      setCode(snippet.content); setName(snippet.name); setDescription(snippet.description); hydrated.current = true;
    }
  }, [snippet]);
  const readonly = !snippet?.capabilities.modify;
  async function save() {
    if (!snippet) return;
    try {
      await update.mutateAsync({id, updateSnippet: {name, description, language: snippet.language, version: snippet.version, content: code}});
    } catch { /* Mutation error is rendered below; keep the draft. */ }
  }
  return <Box p={4} minWidth="60vw">
    <Box display="flex" justifyContent="flex-end"><IconButton aria-label="Close detail" onClick={handleCloseModal}><Close/></IconButton></Box>
    {isLoading && <CircularProgress/>}
    <ApiErrorAlert error={error instanceof Error ? error : null}/>
    {!!error && <Button onClick={() => refetch()}>Retry detail</Button>}
    {snippet && <>
      <Typography variant="h4">{snippet.name}</Typography>
      <Typography>{snippet.language} {snippet.version} · {snippet.author} · {snippet.relation}</Typography>
      <Typography>Lint: {snippet.compliance}</Typography>
      {readonly && <Alert severity="info">Read only</Alert>}
      <InputLabel htmlFor="detail-name">Name</InputLabel>
      <Input id="detail-name" value={name} disabled={readonly || update.isLoading} onChange={e => setName(e.target.value)}/>
      <InputLabel htmlFor="detail-description">Description</InputLabel>
      <Input id="detail-description" value={description ?? ''} disabled={readonly || update.isLoading} onChange={e => setDescription(e.target.value)}/>
      <Box display="flex" gap={1} my={2}>
        <Button startIcon={<Share/>} disabled={!snippet.capabilities.share || share.isLoading} onClick={() => setShareOpen(true)}>Share</Button>
        <Button data-testid="save-changes" startIcon={<Save/>} disabled={readonly || update.isLoading || !name.trim()} onClick={save}>Save changes</Button>
        <DownloadButton snippet={snippet}/><Button disabled>Test</Button><Button disabled>Format</Button><Button disabled>Delete</Button>
      </Box>
      <ApiErrorAlert error={update.error instanceof Error ? update.error : null}/>
      {update.isSuccess && <Alert severity="success">Changes saved. List and detail refresh independently.</Alert>}
      <Bòx flex={1} height="fit-content" minHeight="500px" bgcolor="black" color="white" code={code}>
        <Editor textareaId="detail-code" value={code} padding={10} readOnly={readonly || update.isLoading} onValueChange={setCode}
          highlight={value => highlight(value, languages.js, 'javascript')}
          style={{minHeight: 500, fontFamily: 'monospace', fontSize: 17}}/>
      </Bòx>
      <Alert severity="info">Execution and tests are not available yet.</Alert>
    </>}
    <ShareSnippetModal open={shareOpen} loading={share.isLoading} onClose={() => setShareOpen(false)}
      onShare={async userId => {await share.mutateAsync({snippetId: id, userId});}}/>
  </Box>;
};
