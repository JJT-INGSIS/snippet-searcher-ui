import {JobProgress, isFinished} from './jobProgress';

export const POLL_INTERVAL_MS = 3000;
export const POLL_LIMIT_MS = 10 * 60 * 1000;

export function nextPoll(progress: JobProgress | undefined, failed: boolean, startedAt: number, now: number): number | false {
  if (failed || (progress && isFinished(progress)) || now - startedAt >= POLL_LIMIT_MS) return false;
  return POLL_INTERVAL_MS;
}

export function pollingExpired(progress: JobProgress | undefined, startedAt: number, now: number): boolean {
  return !(progress && isFinished(progress)) && now - startedAt >= POLL_LIMIT_MS;
}
