import {useMutation, useQuery, useQueryClient} from 'react-query';
import {useApi} from '../contexts/apiContext';
import {FormattingRules} from './api/formattingRules';
import {FormattingDraft} from './formattingDraft';
import {TrackedJob} from './jobs/useJobProgress';

export const formattingKeys = {
  rules: (actor: string, language: string, version: string) => ['formattingRules', actor, language, version],
  job: (actor: string, language: string, version: string) => ['formattingJob', actor, language, version],
};

export function useFormattingRules(language: string, version: string) {
  const {actor, operations} = useApi();
  return useQuery(formattingKeys.rules(actor, language, version),
    ({signal}) => operations.getFormattingRules(language, version, signal),
    {enabled: !!language && !!version, retry: false, refetchOnWindowFocus: false});
}

export function useSaveFormattingRules(language: string, version: string) {
  const {actor, operations} = useApi();
  const cache = useQueryClient();
  return useMutation((draft: FormattingDraft) => operations.saveFormattingRules(language, version, draft), {
    retry: false,
    onSuccess: (saved: FormattingRules) => {
      cache.setQueryData(formattingKeys.rules(actor, language, version), saved);
      if (saved.jobId) {
        cache.setQueryData<TrackedJob>(formattingKeys.job(actor, language, version), {jobId: saved.jobId, startedAt: Date.now()});
      }
    },
  });
}

export function useFormattingJob(language: string, version: string) {
  const {actor} = useApi();
  return useQuery<TrackedJob | undefined>(formattingKeys.job(actor, language, version), () => undefined,
    {enabled: false, staleTime: Infinity, cacheTime: Infinity}).data;
}
