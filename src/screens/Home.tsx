import {withNavbar} from '../components/navbar/withNavbar';
import {SnippetTable} from '../components/snippet-table/SnippetTable';
import {useEffect, useState} from 'react';
import {SnippetDetail} from './SnippetDetail';
import {Box, Button, Drawer, MenuItem, TextField} from '@mui/material';
import {useGetSnippets} from '../utils/queries';
import {usePaginationContext} from '../contexts/paginationContext';
import {SnippetFilters} from '../utils/snippet';
import {ApiErrorAlert} from '../components/common/ApiErrorAlert';
const HomeScreen = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [snippetName, setSnippetName] = useState('');
  const [snippetId, setSnippetId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SnippetFilters>({relation: 'all', sort: 'name', direction: 'asc'});
  const {page, page_size, count, handleChangeCount} = usePaginationContext();
  const {data, isLoading, error, refetch} = useGetSnippets(page, page_size, {...filters, name: snippetName});
  useEffect(() => {
    if (data?.count && data.count !== count) handleChangeCount(data.count);
  }, [count, data?.count, handleChangeCount]);
  useEffect(() => {
    const timer = setTimeout(() => setSnippetName(searchTerm), 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  return <>
    <Box display="flex" gap={2} my={2}>
      <TextField select label="Relation" value={filters.relation} onChange={e => setFilters({...filters, relation: e.target.value as SnippetFilters['relation']})}>
        {['all', 'owned', 'shared'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
      <TextField label="Language filter" value={filters.language ?? ''} onChange={e => setFilters({...filters, language: e.target.value})}/>
      <TextField select label="Sort by" value={filters.sort} onChange={e => setFilters({...filters, sort: e.target.value as SnippetFilters['sort']})}>
        <MenuItem value="name">Name</MenuItem><MenuItem value="language">Language</MenuItem>
      </TextField>
      <TextField select label="Direction" value={filters.direction} onChange={e => setFilters({...filters, direction: e.target.value as SnippetFilters['direction']})}>
        <MenuItem value="asc">Ascending</MenuItem><MenuItem value="desc">Descending</MenuItem>
      </TextField>
    </Box>
    <ApiErrorAlert error={error instanceof Error ? error : null}/>
    {error && <Button onClick={() => refetch()}>Retry list</Button>}
    <SnippetTable loading={isLoading} handleClickSnippet={setSnippetId} snippets={error ? undefined : data?.snippets} handleSearchSnippet={setSearchTerm}/>
    <Drawer open={!!snippetId} anchor="right" onClose={() => setSnippetId(null)}>
      {snippetId && <SnippetDetail key={snippetId} handleCloseModal={() => setSnippetId(null)} id={snippetId}/>}
    </Drawer>
  </>;
};
export default withNavbar(HomeScreen);
