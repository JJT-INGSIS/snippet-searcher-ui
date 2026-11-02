import {describe, expect, it} from 'vitest';
import {POLL_INTERVAL_MS, POLL_LIMIT_MS, nextPoll, pollingExpired} from './jobPolling';
import {JobProgress} from './jobProgress';

const running: JobProgress = {id: 'job', status: 'RUNNING', processed: 1, failed: 0, pending: 2, selectionComplete: true};
const start = 1_000_000;

describe('bounded job polling', () => {
  it('asks again every three seconds while the job is running', () => {
    expect(nextPoll(undefined, false, start, start)).toBe(POLL_INTERVAL_MS);
    expect(nextPoll(running, false, start, start + 60_000)).toBe(3000);
  });

  it('stops on a final state, after a failed read or once the time limit is reached', () => {
    expect(nextPoll({...running, status: 'COMPLETED'}, false, start, start)).toBe(false);
    expect(nextPoll({...running, status: 'PARTIAL'}, false, start, start)).toBe(false);
    expect(nextPoll(running, true, start, start)).toBe(false);
    expect(nextPoll(running, false, start, start + POLL_LIMIT_MS)).toBe(false);
  });

  it('reports an expired follow-up only when the job is still running', () => {
    expect(pollingExpired(running, start, start + POLL_LIMIT_MS)).toBe(true);
    expect(pollingExpired(running, start, start + POLL_LIMIT_MS - 1)).toBe(false);
    expect(pollingExpired({...running, status: 'COMPLETED'}, start, start + POLL_LIMIT_MS)).toBe(false);
  });
});
