import {useEffect} from 'react';
import {useQuery} from 'react-query';
import {useApi} from '../../contexts/apiContext';
import {isFinished, jobKeys} from './jobProgress';
import {nextPoll, pollingExpired} from './jobPolling';

export type TrackedJob = {jobId: string; startedAt: number};

export function useJobProgress(job: TrackedJob | undefined, onFinished?: () => void) {
  const {actor, operations} = useApi();
  const jobId = job?.jobId ?? '';
  const startedAt = job?.startedAt ?? 0;
  const query = useQuery(jobKeys.progress(actor, jobId), ({signal}) => operations.getJobProgress(jobId, signal), {
    enabled: !!job,
    retry: false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    refetchInterval: (progress, current) => nextPoll(progress, current.state.status === 'error', startedAt, Date.now()),
  });
  const finished = !!query.data && isFinished(query.data);
  useEffect(() => {
    if (finished) onFinished?.();
  }, [finished, onFinished]);
  return {
    progress: query.data,
    error: query.error,
    expired: !!job && pollingExpired(query.data, startedAt, Date.now()),
    refresh: () => query.refetch(),
  };
}
