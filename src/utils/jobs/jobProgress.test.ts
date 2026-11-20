import {describe, expect, it} from 'vitest';
import {fromJobProgressDto, isFinished, jobKeys} from './jobProgress';

const id = '990e8400-e29b-41d4-a716-446655440000';
const dto = {id, status: 'RUNNING', processed: 3, failed: 1, pending: 6, selectionComplete: true};

describe('job progress contract', () => {
  it('keeps the counts and the state reported by the backend', () => {
    expect(fromJobProgressDto(dto, id)).toEqual(dto);
  });

  it.each([
    ['another job', {...dto, id: '990e8400-e29b-41d4-a716-446655440001'}],
    ['an unknown state', {...dto, status: 'DONE'}],
    ['a negative count', {...dto, pending: -1}],
    ['a decimal count', {...dto, processed: 1.5}],
    ['a missing selection flag', {...dto, selectionComplete: undefined}],
  ])('rejects %s', (_, value) => {
    expect(() => fromJobProgressDto(value, id)).toThrow('Unexpected API response');
  });

  it('knows which states are final', () => {
    const finished = ['COMPLETED', 'PARTIAL', 'FAILED', 'SUPERSEDED'];
    const running = ['PENDING', 'RUNNING', 'RETRY', 'UNKNOWN'];

    finished.forEach(status => expect(isFinished(fromJobProgressDto({...dto, status}, id))).toBe(true));
    running.forEach(status => expect(isFinished(fromJobProgressDto({...dto, status}, id))).toBe(false));
  });

  it('separates the cache of each identity', () => {
    expect(jobKeys.progress('dev-juan', id)).not.toEqual(jobKeys.progress('dev-ana', id));
  });
});
