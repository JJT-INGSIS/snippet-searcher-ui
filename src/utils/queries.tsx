import {useMutation, useQuery, useQueryClient} from 'react-query';
import {SnippetFilters, UpdateSnippet} from './snippet';
import {useApi} from '../contexts/apiContext';
import {CreationIntent} from './api/creationIntent';
import {TestCase} from '../types/TestCase';
import {Rule} from '../types/Rule';
export const useSnippetsOperations = () => useApi().operations;
export const snippetKeys = {
  lists: (actor: string) => ['listSnippets', actor],
  list: (actor: string, page: number, size: number, filters: SnippetFilters) => ['listSnippets', actor, page, size, filters],
  detail: (actor: string, id: string) => ['snippet', actor, id],
  users: (actor: string, name: string, page: number, size: number) => ['users', actor, name, page, size],
};
export function useGetSnippets(page = 0, size = 10, filters: SnippetFilters = {}, enabled = true) {
  const {actor, operations} = useApi();
  return useQuery(snippetKeys.list(actor, page, size, filters), ({signal}) => operations.listSnippetDescriptors(page, size, filters, signal), {retry: false, enabled});
}
export function useGetSnippetById(id: string) {
  const {actor, operations} = useApi();
  return useQuery(snippetKeys.detail(actor, id), () => operations.getSnippetById(id), {enabled: !!id, retry: false});
}
export function useCreateSnippet() {
  const {actor, operations} = useApi();
  const cache = useQueryClient();
  return useMutation((intent: CreationIntent) => operations.createSnippet(intent), {
    retry: false,
    onSuccess: () => {void cache.invalidateQueries(snippetKeys.lists(actor));},
  });
}
export function useUpdateSnippetById() {
  const {actor, operations} = useApi();
  const cache = useQueryClient();
  return useMutation(({id, updateSnippet}: {id: string; updateSnippet: UpdateSnippet}) => operations.updateSnippetById(id, updateSnippet), {
    retry: false,
    onSuccess: (_, {id}) => {
      void cache.invalidateQueries(snippetKeys.lists(actor));
      void cache.invalidateQueries(snippetKeys.detail(actor, id));
    },
  });
}
export function useGetUsers(name = '', page = 0, size = 10, enabled = true) {
  const {actor, operations} = useApi();
  return useQuery(snippetKeys.users(actor, name, page, size), ({signal}) => operations.getUserFriends(name, page, size, signal), {enabled, retry: false});
}
export function useShareSnippet() {
  const {actor, operations} = useApi();
  const cache = useQueryClient();
  return useMutation(({snippetId, userId}: {snippetId: string; userId: string}) => operations.shareSnippet(snippetId, userId), {
    retry: false,
    onSuccess: (_, {snippetId}) => {
      void cache.invalidateQueries(snippetKeys.lists(actor));
      void cache.invalidateQueries(snippetKeys.detail(actor, snippetId));
    },
  });
}
export function useGetFileTypes() {
  const operations = useSnippetsOperations();
  return useQuery(['languages'], () => operations.getFileTypes(), {retry: false});
}
// Supplied components are retained for later stories, but never query a Fake or run unavailable operations.
export const useGetTestCases = () => {
  const op = useSnippetsOperations();
  return useQuery(['unavailable', 'testCases'], () => op.getTestCases(), {enabled: false});
};
export const useGetFormatRules = () => {
  const op = useSnippetsOperations();
  return useQuery(['unavailable', 'formatRules'], () => op.getFormatRules(), {enabled: false});
};
export const useGetLintingRules = () => {
  const op = useSnippetsOperations();
  return useQuery(['unavailable', 'lintingRules'], () => op.getLintingRules(), {enabled: false});
};
export const usePostTestCase = () => {
  const op = useSnippetsOperations();
  return useMutation((tc: Partial<TestCase>) => op.postTestCase(tc), {retry: false});
};
export const useRemoveTestCase = ({onSuccess}: {onSuccess: () => void}) => {
  const op = useSnippetsOperations();
  return useMutation((id: string) => op.removeTestCase(id), {onSuccess, retry: false});
};
export type TestCaseResult = 'success' | 'fail';
export const useTestSnippet = () => {
  const op = useSnippetsOperations();
  return useMutation((tc: Partial<TestCase>) => op.testSnippet(tc), {retry: false});
};
export const useModifyFormatRules = ({onSuccess}: {onSuccess: () => void}) => {
  const op = useSnippetsOperations();
  return useMutation((rules: Rule[]) => op.modifyFormatRule(rules), {onSuccess, retry: false});
};
export const useModifyLintingRules = ({onSuccess}: {onSuccess: () => void}) => {
  const op = useSnippetsOperations();
  return useMutation((rules: Rule[]) => op.modifyLintingRule(rules), {onSuccess, retry: false});
};
export const useFormatSnippet = () => {
  const op = useSnippetsOperations();
  return useMutation((content: string) => op.formatSnippet(content), {retry: false});
};
export const useDeleteSnippet = ({onSuccess}: {onSuccess: () => void}) => {
  const op = useSnippetsOperations();
  return useMutation((id: string) => op.deleteSnippet(id), {onSuccess, retry: false});
};
