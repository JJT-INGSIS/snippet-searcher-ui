import {invalidResponse} from './dto';
import {outcomes, Outcome} from './executionDtos';

const jobStates = ['PENDING', 'RUNNING', 'RETRY', 'UNKNOWN', 'COMPLETED', 'PARTIAL', 'FAILED', 'SUPERSEDED'] as const;
const itemStates = ['PENDING', 'RUNNING', 'RETRY', 'UNKNOWN', 'COMPLETED', 'FAILED', 'SUPERSEDED'] as const;
export type AutomaticTests = {
  revision: string | null;
  validity: 'CURRENT' | 'SUPERSEDED' | 'UNVERIFIABLE';
  progress: {id: string; status: typeof jobStates[number]; processed: number; failed: number; pending: number; selectionComplete: boolean} | null;
  tests: {testId: string; state: typeof itemStates[number] | null; outcome: Outcome | null; comparison: 'PASSED' | 'FAILED' | null; outputs: string[]; reason: string | null}[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
};
export function fromAutomaticTests(value: unknown): AutomaticTests {
  const dto = record(value);
  if (!(dto.revision === null || (typeof dto.revision === 'string' && uuid.test(dto.revision))) ||
      !['CURRENT', 'SUPERSEDED', 'UNVERIFIABLE'].includes(String(dto.validity)) || !Array.isArray(dto.tests)) throw invalidResponse();
  if (dto.progress !== null) {
    const progress = record(dto.progress);
    if (progress.id !== dto.revision || !jobStates.includes(progress.status as typeof jobStates[number]) ||
        !['processed', 'failed', 'pending'].every(key => typeof progress[key] === 'number' && Number.isSafeInteger(progress[key]) && Number(progress[key]) >= 0) ||
        typeof progress.selectionComplete !== 'boolean') throw invalidResponse();
  }
  if ((dto.revision === null) !== (dto.progress === null)) throw invalidResponse();
  const tests = dto.tests.map(value => {
    const test = record(value);
    if (typeof test.testId !== 'string' || !uuid.test(test.testId) ||
        !(test.state === null || itemStates.includes(test.state as typeof itemStates[number])) ||
        !(test.outcome === null || outcomes.includes(test.outcome as Outcome)) ||
        ![null, 'PASSED', 'FAILED'].includes(test.comparison as string | null) ||
        !Array.isArray(test.outputs) || !test.outputs.every(item => typeof item === 'string') ||
        !(test.reason === null || typeof test.reason === 'string') ||
        (test.comparison !== null && test.outcome !== 'COMPLETED')) throw invalidResponse();
    return test;
  });
  if (new Set(tests.map(test => test.testId)).size !== tests.length ||
      (dto.validity !== 'CURRENT' && tests.length > 0) || (dto.revision === null && tests.length > 0)) throw invalidResponse();
  return dto as AutomaticTests;
}
export const automaticPending = (view: AutomaticTests) => view.progress !== null &&
  ['PENDING', 'RUNNING', 'RETRY', 'UNKNOWN'].includes(view.progress.status);
