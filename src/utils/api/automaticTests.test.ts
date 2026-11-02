import {describe, expect, it} from 'vitest';
import {automaticPending, fromAutomaticTests} from './automaticTests';
const revision = '00000000-0000-0000-0000-000000000001';
const testId = '00000000-0000-0000-0000-000000000002';
const progress = {id: revision, status: 'COMPLETED', processed: 1, failed: 0, pending: 0, selectionComplete: true};
const test = {testId, state: 'COMPLETED', outcome: 'COMPLETED', comparison: 'PASSED', outputs: ['', 'ñ', 'ñ'], reason: null};
const view = {revision, validity: 'CURRENT', progress, tests: [test]};
describe('automatic results transport', () => {
  it('preserves exact ordered output including blanks and duplicates', () => {
    expect(fromAutomaticTests(view).tests[0].outputs).toEqual(['', 'ñ', 'ñ']);
  });
  it('accepts no run and obsolete or unverifiable results with no historic rows', () => {
    expect(fromAutomaticTests({revision: null, progress: null, validity: 'CURRENT', tests: []}).tests).toEqual([]);
    for (const validity of ['SUPERSEDED', 'UNVERIFIABLE']) {
      expect(fromAutomaticTests({...view, validity, tests: []}).validity).toBe(validity);
    }
  });
  it.each([
    {...view, revision: null}, {...view, progress: {...progress, id: testId}},
    {...view, progress: {...progress, pending: -1}}, {...view, progress: {...progress, status: 'SUCCESS'}},
    {...view, tests: [test, test]}, {...view, validity: 'SUPERSEDED'},
    {...view, tests: [{...test, outputs: [1]}]}, {...view, tests: [{...test, outcome: 'PROGRAM_ERROR'}]},
    {...view, tests: [{...test, comparison: 'SUCCESS'}]}, {...view, tests: [{...test, state: 'SUCCESS'}]},
    {...view, validity: 'CURRENT', progress: null},
  ])('rejects inconsistent results rather than showing success (%#)', value => {
    expect(() => fromAutomaticTests(value)).toThrow();
  });
  it('keeps technical and unknown outcomes distinct from a failed comparison', () => {
    const unknown = fromAutomaticTests({...view, tests: [{...test, outcome: null, comparison: null, state: 'UNKNOWN', reason: 'START_ACKNOWLEDGMENT_MISSING'}]});
    expect(unknown.tests[0].comparison).toBeNull();
    expect(unknown.tests[0].state).toBe('UNKNOWN');
  });
  it('polls only unfinished jobs', () => {
    for (const status of ['PENDING', 'RUNNING', 'RETRY', 'UNKNOWN']) {
      expect(automaticPending(fromAutomaticTests({...view, progress: {...progress, status}}))).toBe(true);
    }
    expect(automaticPending(fromAutomaticTests(view))).toBe(false);
    expect(automaticPending(fromAutomaticTests({revision: null, progress: null, validity: 'CURRENT', tests: []}))).toBe(false);
  });
});
