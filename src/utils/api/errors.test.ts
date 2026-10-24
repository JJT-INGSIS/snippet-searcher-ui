import {describe, expect, it} from 'vitest';
import {AxiosError, AxiosHeaders} from 'axios';
import {toApiError} from './errors';
function httpError(status: number, data: unknown) {
  const config = {headers: new AxiosHeaders()};
  return new AxiosError('Request failed', undefined, config, {}, {status, data, statusText: '', headers: {}, config});
}
describe('Problem Details and uncertain results', () => {
  it('preserves stable type, field and every parser diagnostic', () => {
    const diagnostics = [{rule: 'syntax', message: 'Expected ;', line: 2, column: 4}];
    const error = toApiError(httpError(422, {type: 'urn:snippets:problem:invalid-code', detail: 'Invalid', field: 'code', diagnostics}));
    expect(error.problem).toMatchObject({type: 'urn:snippets:problem:invalid-code', status: 422, field: 'code', diagnostics});
    expect(error.uncertain).toBe(false);
  });
  it.each([401, 403, 404, 409])('does not turn HTTP %s into success', status => {
    expect(toApiError(httpError(status, {type: 'urn:snippets:problem:conflict'})).problem?.status).toBe(status);
  });
  it('treats technical failure and network loss as uncertain, never as invalid code', () => {
    expect(toApiError(httpError(503, {type: 'urn:snippets:problem:storage-unavailable'})).uncertain).toBe(true);
    const error = toApiError(new AxiosError('timeout', 'ECONNABORTED'));
    expect(error.uncertain).toBe(true);
    expect(error.problem).toBeUndefined();
  });
  it('handles HTML/non-problem errors without rendering or parsing them as successful data', () => {
    const error = toApiError(httpError(502, '<html>gateway</html>'));
    expect(error.problem).toMatchObject({status: 502, type: 'about:blank'});
    expect(error.message).not.toContain('<html>');
  });
});
