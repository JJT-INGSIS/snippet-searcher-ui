import {expect, it} from 'vitest';
import {ApiError} from './api/errors';
import {errorMessage, lintLabels} from './presentation';
it('translates known problems and handles unknown failures without reporting success or emptiness', () => {
  expect(errorMessage(new ApiError('raw', {type: 'urn:snippets:problem:dependency-failure', status: 502}))).toContain('servicio');
  expect(errorMessage(new ApiError('unknown secret detail', undefined, true))).toContain('confirmación');
  expect(errorMessage(new Error('internal detail'))).not.toContain('internal detail');
  expect(lintLabels['not-implemented']).toBe('Sin evaluación');
});
