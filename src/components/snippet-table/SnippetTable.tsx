import {Box, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TablePagination, TableRow} from '@mui/material';
import {SnippetDescriptor} from '../../utils/snippet';
import {LoadingSnippetRow, SnippetRow} from './SnippetRow';

type Props = {
  snippets: SnippetDescriptor[]; loading: boolean; count: number; page: number; size: number;
  onPage: (page: number) => void; onSize: (size: number) => void; onOpen: (id: string) => void;
};
export function SnippetTable({snippets, loading, count, page, size, onPage, onSize, onOpen}: Props) {
  return <Paper variant="outlined" sx={{overflow: 'hidden'}}>
    <Box role="region" aria-label="Listado de snippets" tabIndex={0} sx={{overflowX: 'auto'}}>
      <TableContainer sx={{minWidth: 680}}>
        <Table aria-label="Snippets disponibles" aria-busy={loading}>
          <TableHead><TableRow>{['Nombre', 'Lenguaje', 'Propietario', 'Acceso', 'Lint'].map(title => <TableCell key={title}>{title}</TableCell>)}</TableRow></TableHead>
          <TableBody>{loading
            ? Array.from({length: Math.min(size, 5)}, (_, index) => <LoadingSnippetRow key={index}/>)
            : snippets.map(snippet => <SnippetRow key={snippet.id} snippet={snippet} onClick={() => onOpen(snippet.id)}/>)}</TableBody>
          <TableFooter><TableRow><TablePagination count={count} page={page} rowsPerPage={size} rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Por página" labelDisplayedRows={({from, to, count: total}) => from + '–' + to + ' de ' + total}
            getItemAriaLabel={type => type === 'next' ? 'Página siguiente' : type === 'previous' ? 'Página anterior' : type === 'first' ? 'Primera página' : 'Última página'}
            onPageChange={(_, next) => onPage(next)} onRowsPerPageChange={event => onSize(Number(event.target.value))}
            nextIconButtonProps={{disabled: loading || (page + 1) * size >= count}} backIconButtonProps={{disabled: loading || page === 0}} colSpan={5}/></TableRow></TableFooter>
        </Table>
      </TableContainer>
    </Box>
  </Paper>;
}
