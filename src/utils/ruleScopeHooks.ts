import {useMutation, useQuery, useQueryClient} from 'react-query';
import {useApi} from '../contexts/apiContext';
import {SnippetOperations} from './snippetOperations';
import {TrackedJob} from './jobs/useJobProgress';

type SavedRules = {jobId: string | null};

type RuleScopeApi<R extends SavedRules, D> = {
  name: string;
  read: (operations: SnippetOperations, language: string, version: string, signal?: AbortSignal) => Promise<R>;
  save: (operations: SnippetOperations, language: string, version: string, draft: D) => Promise<R>;
};

export function ruleScopeHooks<R extends SavedRules, D>(api: RuleScopeApi<R, D>) {
  const keys = {
    rules: (actor: string, language: string, version: string) => [api.name + 'Rules', actor, language, version],
    job: (actor: string, language: string, version: string) => [api.name + 'Job', actor, language, version],
  };

  function useRules(language: string, version: string) {
    const {actor, operations} = useApi();
    return useQuery(keys.rules(actor, language, version), ({signal}) => api.read(operations, language, version, signal),
      {enabled: !!language && !!version, retry: false, refetchOnWindowFocus: false});
  }

  function useSaveRules(language: string, version: string, afterSave?: () => void) {
    const {actor, operations} = useApi();
    const cache = useQueryClient();
    return useMutation((draft: D) => api.save(operations, language, version, draft), {
      retry: false,
      onSuccess: (saved: R) => {
        cache.setQueryData(keys.rules(actor, language, version), saved);
        if (saved.jobId) {
          cache.setQueryData<TrackedJob>(keys.job(actor, language, version), {jobId: saved.jobId, startedAt: Date.now()});
          afterSave?.();
        }
      },
    });
  }

  function useJob(language: string, version: string) {
    const {actor} = useApi();
    return useQuery<TrackedJob | undefined>(keys.job(actor, language, version), () => undefined,
      {enabled: false, staleTime: Infinity, cacheTime: Infinity}).data;
  }

  return {keys, useRules, useSaveRules, useJob};
}
