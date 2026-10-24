import {Box, InputLabel, Typography} from '@mui/material';
import Editor from 'react-simple-code-editor';
import {highlight, languages} from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-okaidia.css';

export function CodeEditor({id, value, onChange, readOnly = false}: {
  id: string; value: string; onChange: (value: string) => void; readOnly?: boolean;
}) {
  return <Box sx={{minWidth: 0}}>
    <InputLabel htmlFor={id} sx={{mb: 1, color: 'text.primary', fontSize: 14}}>Código</InputLabel>
    <Box sx={{borderRadius: 2, bgcolor: '#111827', color: '#f3f4f6', overflow: 'auto', maxHeight: '55dvh', border: '1px solid #334155',
      '&:focus-within': {outline: '3px solid #4ea8ff', outlineOffset: 2}, '& textarea:focus-visible': {outline: 'none'}}}>
      <Editor textareaId={id} textareaClassName="code-input" value={value} padding={18} readOnly={readOnly} ignoreTabKey
        onValueChange={onChange} highlight={code => highlight(code, languages.js, 'javascript')}
        style={{minHeight: 220, fontFamily: 'Geist Mono, monospace', fontSize: 14, lineHeight: 1.7}}/>
    </Box>
    <Typography variant="caption" color="text.secondary">Tab mueve el foco al siguiente control. El código se valida al guardar.</Typography>
  </Box>;
}
