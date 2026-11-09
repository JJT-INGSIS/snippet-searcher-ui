import {useCallback} from 'react';
import {useQueryClient} from 'react-query';
import {useApi} from '../contexts/apiContext';
import {LintingRules} from './api/lintingRules';
import {LintingDraft} from './lintingDraft';
import {snippetKeys} from './queries';
import {ruleScopeHooks} from './ruleScopeHooks';

const linting = ruleScopeHooks<LintingRules, LintingDraft>({
  name: 'linting',
  read: (operations, language, version, signal) => operations.getLintingRules(language, version, signal),
  save: (operations, language, version, draft) => operations.saveLintingRules(language, version, draft),
});

export const lintingKeys = linting.keys;
export const useLintingRules = linting.useRules;
export const useLintingJob = linting.useJob;

export function useRefreshLintResults() {
  const {actor} = useApi();
  const cache = useQueryClient();
  return useCallback(() => {
    void cache.invalidateQueries(snippetKeys.lists(actor));
    void cache.invalidateQueries(snippetKeys.details(actor));
  }, [actor, cache]);
}

export function useSaveLintingRules(language: string, version: string) {
  const refresh = useRefreshLintResults();
  return linting.useSaveRules(language, version, refresh);
}
