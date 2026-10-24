import {useEffect, useState} from 'react';
import {SnippetFilters} from '../utils/snippet';
import {useGetSnippets} from '../utils/queries';
import useDebounce from './useDebounce';

const initialFilters: SnippetFilters = {name: '', language: '', relation: 'all', sort: 'name', direction: 'asc'};
export function useSnippetList() {
  const [name, setName] = useState('');
  const [request, setRequest] = useState({page: 0, size: 10, filters: initialFilters});
  const debouncedName = useDebounce(name);
  const searching = name !== request.filters.name;
  useEffect(() => {
    if (debouncedName === name && debouncedName !== request.filters.name) {
      setRequest(previous => ({...previous, page: 0, filters: {...previous.filters, name: debouncedName}}));
    }
  }, [debouncedName, name, request.filters.name]);
  const query = useGetSnippets(request.page, request.size, request.filters, !searching);
  const count = query.data?.count ?? 0;
  const lastPage = Math.max(0, Math.ceil(count / request.size) - 1);
  const outside = !!query.data && request.page > lastPage;
  useEffect(() => {
    if (outside && !query.isFetching && !query.isError) setRequest(previous => ({...previous, page: lastPage}));
  }, [outside, lastPage, query.isFetching, query.isError]);
  return {
    name, setName, filters: request.filters,
    page: query.data ? Math.min(request.page, lastPage) : 0, size: request.size,
    count: searching || query.isError ? 0 : count,
    snippets: searching || outside || query.isError ? [] : query.data?.snippets ?? [],
    loading: searching || outside || query.isLoading,
    refreshing: query.isFetching,
    error: searching ? null : query.error instanceof Error ? query.error : null,
    retry: query.refetch,
    setFilters: (change: SnippetFilters) => setRequest(previous => ({...previous, page: 0, filters: {...previous.filters, ...change}})),
    setPage: (page: number) => setRequest(previous => ({...previous, page})),
    setSize: (size: number) => setRequest(previous => ({...previous, page: 0, size})),
    clear: () => {setName(''); setRequest(previous => ({...previous, page: 0, filters: initialFilters}));},
    filtered: !!name || !!request.filters.language || request.filters.relation !== 'all',
  };
}
