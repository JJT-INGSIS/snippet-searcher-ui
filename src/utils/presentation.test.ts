import {expect, it} from 'vitest';
import {ApiError} from './api/errors';
import {errorMessage, lintLabels} from './presentation';
it('translates known problems and handles unknown failures without reporting success or emptiness', () => {
  expect(errorMessage(new ApiError('raw', {type: 'urn:snippets:problem:dependency-failure', status: 502}))).toContain('servicio');
  expect(errorMessage(new ApiError('unknown secret detail', undefined, true))).toContain('confirmación');
  expect(errorMessage(new Error('internal detail'))).not.toContain('internal detail');
  expect(errorMessage(new ApiError('raw', {type: 'urn:snippets:problem:invalid-formatting-rules', status: 422}))).toContain('marcadas');
  expect(errorMessage(new ApiError('raw', {type: 'urn:snippets:problem:formatting-stale', status: 409}))).toContain('cambió');
  expect(errorMessage(new ApiError('raw', {type: 'urn:snippets:problem:unformattable-code', status: 422}))).toContain('errores');
  expect(errorMessage(new ApiError('raw', {type: 'urn:snippets:problem:formatting-limit-exceeded', status: 422}))).toContain('tamaño');
  expect(lintLabels['not-implemented']).toBe('Sin evaluación');
});

it('distinguishes a directory outage from a search that needs refining without exposing provider details', () => {
  const outage = new ApiError('private provider detail', {type: 'urn:snippets:problem:directory-unavailable', status: 502});
  const broad = new ApiError('private provider detail', {type: 'urn:snippets:problem:directory-search-too-broad', status: 422});
  expect(errorMessage(outage)).toContain('consultar los destinatarios');
  expect(errorMessage(broad)).toContain('más específico');
  expect(errorMessage(outage)).not.toContain('private provider detail');
  expect(errorMessage(broad)).not.toContain('private provider detail');
});
