import {Button, Chip, Skeleton, Stack, TableCell, TableRow} from '@mui/material';
import {SnippetDescriptor} from '../../utils/snippet';
import {lintLabels} from '../../utils/presentation';

export function SnippetRow({snippet, onClick}: {snippet: SnippetDescriptor; onClick: () => void}) {
  return <TableRow data-testid="snippet-row" hover>
    <TableCell sx={{maxWidth: 360}}>
      <Button onClick={onClick} sx={{fontWeight: 600, textAlign: 'left', justifyContent: 'flex-start', overflowWrap: 'anywhere', minWidth: 0, px: 0}}>
        {snippet.name}
      </Button>
      {snippet.description && <Stack component="span" sx={{color: 'text.secondary', fontSize: 13, overflowWrap: 'anywhere'}}>{snippet.description}</Stack>}
    </TableCell>
    <TableCell><Chip size="small" label={snippet.language} variant="outlined"/><span> {snippet.version}</span></TableCell>
    <TableCell sx={{maxWidth: 220, overflowWrap: 'anywhere'}}>{snippet.author}</TableCell>
    <TableCell><Chip size="small" label={snippet.relation === 'owned' ? 'Propio' : 'Compartido'} color={snippet.relation === 'owned' ? 'primary' : 'default'} variant="outlined"/></TableCell>
    <TableCell sx={{whiteSpace: 'nowrap', color: 'text.secondary'}}>{lintLabels[snippet.compliance]}</TableCell>
  </TableRow>;
}
export function LoadingSnippetRow() {
  return <TableRow><TableCell colSpan={5}><Skeleton variant="rounded" height={48}/></TableCell></TableRow>;
}
